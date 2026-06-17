const { buildInfoEmbed, buildDmEmbed } = require("./embedBuilder");
const featureQueue = require("./featureQueue");
const dmUsers      = require("./dmUsers");

// ── In-memory state ───────────────────────────────────────────────────────────
const playerSessions = new Map();

let _client = null;
let _liveMessageId = null;
let _lastPlayerList = "";
let _lastOnline = null; // tracks server online/offline state separately
let _pollInterval = null;
let _rotateInterval = null;

// ── Init ──────────────────────────────────────────────────────────────────────

async function initLiveEmbed(client) {
  _client = client;
  console.log("[LiveEmbed] Initializing...");
  try {
    await ensureLiveMessage();
    _pollInterval = setInterval(pollPlayers, 30_000);
    _rotateInterval = setInterval(checkRotation, 60 * 60 * 1000);
    console.log("[LiveEmbed] ✅ Initialized successfully");
    await pollPlayers();
  } catch (err) {
    console.error("[LiveEmbed] Initialization failed:", err.message);
    throw err;
  }
}

// ── Live message management ───────────────────────────────────────────────────

async function ensureLiveMessage() {
  const channelId = process.env.INFO_CHANNEL_ID;
  if (!channelId) {
    console.warn("[LiveEmbed] INFO_CHANNEL_ID not set, skipping message creation");
    return;
  }
  try {
    console.log(`[LiveEmbed] Ensuring live message in channel ${channelId}...`);
    const channel = await _client.channels.fetch(channelId);
    const payload = await buildInfoEmbed();
    const messages = await channel.messages.fetch({ limit: 20 });
    const existing = messages.find(
      (m) => m.author.id === _client.user.id && m.embeds.length > 0,
    );
    if (existing) {
      _liveMessageId = existing.id;
      await existing.edit(payload);
      console.log(`[LiveEmbed] Updated existing message ${_liveMessageId}`);
    } else {
      const sent = await channel.send(payload);
      _liveMessageId = sent.id;
      console.log(`[LiveEmbed] Created new message ${_liveMessageId}`);
    }
  } catch (err) {
    console.error("[LiveEmbed] Failed to ensure live message:", err.message);
    throw err;
  }
}

async function updateLiveEmbed() {
  const channelId = process.env.INFO_CHANNEL_ID;
  if (!channelId || !_liveMessageId) {
    console.debug("[LiveEmbed] Skipping update: channelId or messageId not set");
    return;
  }
  try {
    console.log("[LiveEmbed] Updating live message...");
    const channel = await _client.channels.fetch(channelId);
    const message = await channel.messages.fetch(_liveMessageId);
    const payload = await buildInfoEmbed();
    await message.edit(payload);
    console.log("[LiveEmbed] ✅ Live message updated");
  } catch (err) {
    console.warn("[LiveEmbed] Could not edit message, re-posting:", err.message);
    _liveMessageId = null;
    await ensureLiveMessage();
  }
}

// ── DM embeds ─────────────────────────────────────────────────────────────────

/**
 * Send the live embed to a user's DMs for the first time.
 * Returns the sent message ID, or null on failure.
 */
async function sendDmEmbed(userId) {
  try {
    console.log(`[DM] Sending embed to ${userId}...`);
    const user    = await _client.users.fetch(userId);
    const payload = await buildDmEmbed();
    const msg = await user.send(payload);
    console.log(`[DM] ✅ Sent embed to ${user.tag} (message ${msg.id})`);
    return msg.id;
  } catch (err) {
    console.error(`[DM] Failed to send embed to ${userId}:`, err.message);
    return null;
  }
}

/**
 * Update the live embed in a DM user's DMs.
 * If the message can't be found, re-sends and updates the stored ID.
 */
async function updateDmEmbed(userId, dmMessageId) {
  try {
    const user    = await _client.users.fetch(userId);
    const dmChan  = await user.createDM();
    const payload = await buildDmEmbed();

    try {
      const msg = await dmChan.messages.fetch(dmMessageId);
      await msg.edit(payload);
    } catch (err) {
      // Message deleted or inaccessible — re-send
      console.warn(`[DM] Message ${dmMessageId} not found, re-sending to ${user.tag}`);
      const newMsg = await user.send(payload);
      dmUsers.updateMessageId(userId, newMsg.id);
    }
  } catch (err) {
    console.error(`[DM] Failed to update embed for ${userId}:`, err.message);
  }
}

/** Update all DM users' embeds. Called whenever the channel embed updates. */
async function updateAllDmEmbeds() {
  const users = dmUsers.getAll();
  if (users.length === 0) {
    console.debug("[DM] No DM users to update");
    return;
  }
  console.log(`[DM] Updating ${users.length} DM user(s)...`);
  const results = await Promise.allSettled(
    users.map((u) => updateDmEmbed(u.userId, u.dmMessageId)),
  );
  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  console.log(`[DM] ✅ DM updates complete: ${succeeded} succeeded, ${failed} failed`);
}

/**
 * Delete a user's DM embed message.
 * Called when a user is removed from the DM list.
 */
async function deleteDmEmbed(userId, dmMessageId) {
  try {
    console.log(`[DM] Deleting embed for ${userId}...`);
    const user    = await _client.users.fetch(userId);
    const dmChan  = await user.createDM();
    const msg = await dmChan.messages.fetch(dmMessageId);
    await msg.delete();
    console.log(`[DM] ✅ Deleted embed for ${user.tag}`);
  } catch (err) {
    console.warn(`[DM] Could not delete embed for ${userId}:`, err.message);
    // Non-critical error — user may have already deleted the message or disabled DMs
  }
}

// ── Player session tracking ───────────────────────────────────────────────────
async function pollPlayers() {
  try {
    const { Rcon } = require("rcon-client");
    const rcon = new Rcon({
      host: process.env.RCON_HOST || "localhost",
      port: parseInt(process.env.RCON_PORT) || 25575,
      password: process.env.RCON_PASSWORD,
    });

    await rcon.connect();
    const response = await rcon.send("list");
    await rcon.end();

    // Parse online players
    const match = response.match(/online:\s*(.*)/i);
    const namesStr = match ? match[1].trim() : "";
    const onlineNow = namesStr
      ? namesStr
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean)
      : [];

    const serverNowOnline = true;
    const stateChanged = _lastOnline !== serverNowOnline;
    const playersChanged = namesStr !== _lastPlayerList;

    _lastOnline = serverNowOnline;
    _lastPlayerList = namesStr;

    // Detect joins
    for (const name of onlineNow) {
      if (!playerSessions.has(name)) {
        playerSessions.set(name, {
          joinedAt: new Date(),
          isBedrock: name.startsWith("."),
        });
        console.log(`[Players] ${name} joined (${name.startsWith(".") ? "Bedrock" : "Java"})`);
      }
    }
    // Detect leaves
    for (const [name] of playerSessions) {
      if (!onlineNow.includes(name)) {
        playerSessions.delete(name);
        console.log(`[Players] ${name} left`);
      }
    }

    if (stateChanged || playersChanged) {
      console.log(`[Players] State changed - updating embeds (${playerSessions.size} online)`);
      await updateLiveEmbed();
      await updateAllDmEmbeds();
    }
  } catch (err) {
    // RCON failed — server is offline or unreachable
    const serverNowOnline = false;

    if (_lastOnline !== serverNowOnline) {
      // State changed: was online, now offline
      console.warn("[Players] Server went offline (RCON error):", err.message);
      _lastOnline = serverNowOnline;
      _lastPlayerList = "";
      playerSessions.clear();
      await updateLiveEmbed();
      await updateAllDmEmbeds();
    }
  }
}

// ── Feature rotation ──────────────────────────────────────────────────────────

async function checkRotation() {
  try {
    if (!featureQueue.isRotationDue()) return;
    const changed = featureQueue.rotate();
    if (changed) {
      console.log("[LiveEmbed] Featured image rotated");
      await updateLiveEmbed();
      await updateAllDmEmbeds();
    }
  } catch (err) {
    console.error("[LiveEmbed] Rotation check failed:", err.message);
  }
}

// ── Accessors ─────────────────────────────────────────────────────────────────

function getPlayerSessions() {
  return playerSessions;
}

async function forceUpdate() {
  await updateLiveEmbed();
  await updateAllDmEmbeds();
}

module.exports = {
  initLiveEmbed,
  getPlayerSessions,
  forceUpdate,
  checkRotation,
  sendDmEmbed,
  deleteDmEmbed,
};
