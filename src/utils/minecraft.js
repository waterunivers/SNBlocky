const fs   = require("fs");
const path = require("path");
const { status } = require("minecraft-server-util");
const { Rcon }   = require("rcon-client");

async function getServerStatus() {
  try {
    console.debug("[Minecraft] Querying server status...");
    const result = await status(
      process.env.MC_SERVER_HOST || "localhost",
      parseInt(process.env.MC_SERVER_PORT) || 25565,
      { timeout: 3000 },
    );
    console.debug(`[Minecraft] Server online: ${result.players.online}/${result.players.max} players`);
    return {
      online:     true,
      players:    result.players.online,
      maxPlayers: result.players.max,
      version:    result.version.name || process.env.SERVER_VERSION,
      motd:       result.motd?.clean || "",
    };
  } catch (err) {
    console.warn("[Minecraft] Server status query failed:", err.message);
    return { online: false, players: 0, maxPlayers: 0, version: process.env.SERVER_VERSION || "Unknown", motd: "" };
  }
}

function readWhitelist() {
  const wlPath = process.env.WHITELIST_PATH;
  try {
    if (!wlPath) {
      console.warn("[Minecraft] WHITELIST_PATH not set");
      return [];
    }
    if (!fs.existsSync(wlPath)) {
      console.warn(`[Minecraft] Whitelist file not found at ${wlPath}`);
      return [];
    }
    const list = JSON.parse(fs.readFileSync(wlPath, "utf8"));
    console.debug(`[Minecraft] Loaded whitelist: ${list.length} entries`);
    return list;
  } catch (err) {
    console.error("[Minecraft] Failed to read whitelist:", err.message);
    return [];
  }
}

function writeWhitelist(entries) {
  const wlPath = process.env.WHITELIST_PATH;
  try {
    if (!wlPath) throw new Error("WHITELIST_PATH is not set in .env");
    fs.writeFileSync(wlPath, JSON.stringify(entries, null, 2), "utf8");
    console.log(`[Minecraft] Whitelist updated: ${entries.length} entries`);
  } catch (err) {
    console.error("[Minecraft] Failed to write whitelist:", err.message);
    throw err;
  }
}

function formatUuid(raw) {
  const h = raw.replace(/-/g, "");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function addToWhitelist(entry) {
  try {
    if (!entry.uuid || !entry.name) {
      throw new Error("Invalid entry: missing uuid or name");
    }
    const list      = readWhitelist();
    const formatted = formatUuid(entry.uuid);
    const exists    = list.some((e) => formatUuid(e.uuid) === formatted);
    if (exists) {
      console.warn(`[Minecraft] ${entry.name} already on whitelist`);
      return false;
    }
    list.push({ uuid: formatted, name: entry.name });
    writeWhitelist(list);
    console.log(`[Minecraft] Added ${entry.name} to whitelist`);
    return true;
  } catch (err) {
    console.error("[Minecraft] Failed to add to whitelist:", err.message);
    return false;
  }
}

function getAssetPacks() {
  try {
    const packsDir = path.join(__dirname, "../../assets/packs");
    if (!fs.existsSync(packsDir)) {
      console.warn("[Minecraft] Packs directory not found");
      return [];
    }
    const packs = fs.readdirSync(packsDir)
      .filter((f) => !f.startsWith(".") && f !== "README.txt")
      .map((filename) => ({ filename, name: path.parse(filename).name }));
    console.debug(`[Minecraft] Found ${packs.length} asset pack(s)`);
    return packs;
  } catch (err) {
    console.error("[Minecraft] Failed to read asset packs:", err.message);
    return [];
  }
}

async function sendRcon(command) {
  const rcon = new Rcon({
    host:     process.env.RCON_HOST || "localhost",
    port:     parseInt(process.env.RCON_PORT) || 25575,
    password: process.env.RCON_PASSWORD,
  });
  try {
    console.debug(`[Minecraft] Sending RCON command: ${command}`);
    await rcon.connect();
    const response = await rcon.send(command);
    await rcon.end();
    console.log(`[Minecraft] RCON command succeeded`);
    return response;
  } catch (err) {
    console.error(`[Minecraft] RCON command failed: "${command}"`, err.message);
    return null;
  }
}

async function reloadWhitelist() {
  try {
    console.log("[Minecraft] Reloading whitelist via RCON...");
    const res = await sendRcon("whitelist reload");
    if (res !== null) {
      console.log("[Minecraft] ✅ Whitelist reloaded");
      return true;
    } else {
      console.error("[Minecraft] Whitelist reload failed");
      return false;
    }
  } catch (err) {
    console.error("[Minecraft] Failed to reload whitelist:", err.message);
    return false;
  }
}

module.exports = { getServerStatus, readWhitelist, writeWhitelist, addToWhitelist, getAssetPacks, reloadWhitelist, sendRcon };
