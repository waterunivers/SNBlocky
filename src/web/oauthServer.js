const express = require("express");
const path = require("path");
const { consumeSession } = require("../utils/sessions");
const { performFullAuth } = require("../utils/msAuth");
const { addToWhitelist } = require("../utils/minecraft");

// Holds the Discord client reference so we can DM users after auth
let _discordClient = null;

function startOAuthServer(discordClient) {
  _discordClient = discordClient;
  const app = express();
  const port = parseInt(process.env.OAUTH_PORT) || 3000;

  // ── OAuth Callback ────────────────────────────────────────────────────────
  app.get("/auth/callback", async (req, res) => {
    const { code, state, error } = req.query;

    // Microsoft returned an error (user cancelled, etc.)
    if (error) {
      return res.send(buildPage("❌ Authentication Cancelled", `
        <p>You cancelled the sign-in or an error occurred: <strong>${escHtml(String(error))}</strong></p>
        <p>You can close this tab and try again from Discord.</p>
      `, false));
    }

    // Validate state token
    const session = consumeSession(state);
    if (!session) {
      return res.send(buildPage("❌ Session Expired", `
        <p>This login link has expired or is invalid.</p>
        <p>Please go back to Discord and click the <strong>Join Whitelist</strong> button again.</p>
      `, false));
    }

    try {
      const accounts = await performFullAuth(code);
      const added = [];
      const alreadyListed = [];

      if (accounts.java) {
        const wasAdded = addToWhitelist({ uuid: accounts.java.uuid, name: accounts.java.name });
        wasAdded ? added.push(`☕ Java: **${accounts.java.name}**`) : alreadyListed.push(`☕ Java: ${accounts.java.name}`);
      }

      if (accounts.bedrock) {
        const wasAdded = addToWhitelist({ uuid: accounts.bedrock.uuid, name: accounts.bedrock.name });
        wasAdded ? added.push(`🪨 Bedrock: **${accounts.bedrock.gamertag}** (via Geyser)`) : alreadyListed.push(`🪨 Bedrock: ${accounts.bedrock.gamertag}`);
      }

      if (!accounts.java && !accounts.bedrock) {
        // Authenticated with Microsoft but no Minecraft accounts found
        await notifyUser(session.discordUserId, session.discordChannelId,
          "⚠️ **No Minecraft account found**\n\nYou signed in with a Microsoft account, but it doesn't appear to have a Minecraft licence attached.\n\nIf you play Bedrock on mobile or console, contact the server owner for manual whitelisting."
        );
        return res.send(buildPage("⚠️ No Minecraft Account Found", `
          <p>Your Microsoft account doesn't have a Minecraft licence attached.</p>
          <p>Check your Discord DMs for more information.</p>
        `, false));
      }

      // Reload whitelist in Minecraft (send /whitelist reload via RCON or just note it)
      // (RCON support can be added later — the file change is picked up on next /whitelist reload in-game)

      // Notify on Discord
      const addedLines = added.length ? `\n✅ Added:\n${added.join("\n")}` : "";
      const alreadyLines = alreadyListed.length ? `\n📋 Already whitelisted:\n${alreadyListed.join("\n")}` : "";
      const noJavaNote = !accounts.java
        ? "\n\n> ℹ️ No Java Edition account was found on this Microsoft account."
        : "";
      const noBedrockNote = !accounts.bedrock
        ? "\n> ℹ️ No Bedrock/Xbox account was detected."
        : "";

      await notifyUser(session.discordUserId, session.discordChannelId,
        `🎉 **You're on the whitelist!**${addedLines}${alreadyLines}${noJavaNote}${noBedrockNote}\n\n` +
        `Connect to **${process.env.MC_SERVER_IP_DISPLAY || "the server"}** and start playing!`
      );

      const addedHtml = added.map((a) => `<li>${escHtml(a.replace(/\*\*/g, ""))}</li>`).join("");
      const alreadyHtml = alreadyListed.map((a) => `<li>${escHtml(a)} – already whitelisted</li>`).join("");

      return res.send(buildPage("🎉 You're whitelisted!", `
        <p>Your account${added.length !== 1 ? "s have" : " has"} been added to the Crossroads SMP whitelist.</p>
        <ul>${addedHtml}${alreadyHtml}</ul>
        <p>Head back to Discord — we've sent you a confirmation message.<br>See you in-game! ⛏️</p>
      `, true));

    } catch (err) {
      console.error("[OAuth] Auth flow error:", err.response?.data || err.message);
      await notifyUser(session.discordUserId, session.discordChannelId,
        "❌ **Whitelist error** — Something went wrong during authentication. Please try again or contact the server owner."
      ).catch(() => {});
      return res.send(buildPage("❌ Authentication Error", `
        <p>Something went wrong while authenticating your account.</p>
        <p>Please go back to Discord and try again, or contact the server owner.</p>
        <pre style="font-size:0.8em;color:#aaa;">${escHtml(err.message)}</pre>
      `, false));
    }
  });

  // ── Serve pack downloads from /assets/packs ───────────────────────────────
  const packsDir = path.join(__dirname, "../../assets/packs");
  app.get("/downloads/:filename", (req, res) => {
    const filename = path.basename(req.params.filename); // sanitise path traversal
    const filePath = path.join(packsDir, filename);
    if (!require("fs").existsSync(filePath)) {
      return res.status(404).send("File not found.");
    }
    res.download(filePath);
  });

  // ── Health check ─────────────────────────────────────────────────────────
  app.get("/health", (_, res) => res.json({ status: "ok", bot: "SNBlocky" }));

  app.listen(port, () => {
    console.log(`[OAuth] Callback server listening on port ${port}`);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function notifyUser(userId, channelId, message) {
  if (!_discordClient) return;
  try {
    const user = await _discordClient.users.fetch(userId);
    await user.send(message);
  } catch {
    // DMs disabled – fall back to ephemeral channel message if we stored channelId
    try {
      if (channelId) {
        const channel = await _discordClient.channels.fetch(channelId);
        await channel.send({ content: `<@${userId}> ${message}` });
      }
    } catch {
      console.warn(`[OAuth] Could not notify user ${userId}`);
    }
  }
}

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildPage(title, bodyHtml, success) {
  const accentColor = success ? "#57F287" : "#ED4245";
  const icon = success ? "⛏️" : "❌";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escHtml(title)} – Crossroads SMP</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#1a1a2e;color:#e0e0e0;
         min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
    .card{background:#16213e;border:1px solid ${accentColor}44;border-radius:16px;
          max-width:480px;width:100%;padding:2.5rem;text-align:center;
          box-shadow:0 8px 32px #00000066}
    .icon{font-size:3rem;margin-bottom:1rem}
    h1{color:${accentColor};font-size:1.5rem;margin-bottom:1rem}
    p,li{line-height:1.6;color:#b0b0c0;margin-bottom:.75rem}
    ul{text-align:left;padding-left:1.25rem;margin-bottom:1rem}
    pre{text-align:left;background:#0f0f1a;padding:1rem;border-radius:8px;overflow:auto}
    .footer{margin-top:2rem;font-size:.8rem;color:#555}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${escHtml(title)}</h1>
    ${bodyHtml}
    <div class="footer">Crossroads SMP · Powered by SNBlocky</div>
  </div>
</body>
</html>`;
}

module.exports = startOAuthServer;
