require("dotenv").config();
const express = require("express");
const path = require("path");
const { consumeSession } = require("../utils/sessions");
const { performFullAuth } = require("../utils/msAuth");
const { addToWhitelist, reloadWhitelist } = require("../utils/minecraft");

function startOAuthServer(discordClient) {
  const app = express();
  const port = parseInt(process.env.OAUTH_PORT) || 3000;

  // ── OAuth Callback ────────────────────────────────────────────────────────
  app.get("/auth/callback", async (req, res) => {
    const { code, state, error } = req.query;
    console.log("[OAuth] Callback received, code:", code ? "present" : "missing", "state:", state ? "present" : "missing");

    if (error) {
      console.warn("[OAuth] Auth error from Microsoft:", error);
      return res.send(
        buildPage(
          env("WEB_CANCELLED_TITLE", "❌ Authentication Cancelled"),
          `<p>${escHtml(env("WEB_CANCELLED_BODY", "You cancelled sign-in. Close this tab and try again from Discord."))}</p>`,
          false,
        ),
      );
    }

    const session = consumeSession(state);
    if (!session) {
      console.warn("[OAuth] Invalid or expired state token:", state);
      return res.send(
        buildPage(
          env("WEB_EXPIRED_TITLE", "❌ Session Expired"),
          `<p>${escHtml(env("WEB_EXPIRED_BODY", "This login link has expired. Go back to Discord and click Join Whitelist again."))}</p>`,
          false,
        ),
      );
    }

    try {
      console.log("[OAuth] Performing full auth for Discord user:", session.discordUserId);
      const accounts = await performFullAuth(code);
      const added = [];
      const alreadyListed = [];

      if (accounts.java) {
        console.log("[OAuth] Java profile found:", accounts.java.name);
        const wasAdded = addToWhitelist({
          uuid: accounts.java.uuid,
          name: accounts.java.name,
        });
        wasAdded
          ? added.push(
              `🖥️ Java: <strong>${escHtml(accounts.java.name)}</strong>`,
            )
          : alreadyListed.push(`🖥️ Java: ${escHtml(accounts.java.name)}`);
      }

      if (accounts.bedrock) {
        console.log("[OAuth] Bedrock profile found:", accounts.bedrock.gamertag);
        const wasAdded = addToWhitelist({
          uuid: accounts.bedrock.uuid,
          name: accounts.bedrock.name,
        });
        wasAdded
          ? added.push(
              `📱 Bedrock: <strong>${escHtml(accounts.bedrock.gamertag)}</strong> (via Geyser)`,
            )
          : alreadyListed.push(
              `📱 Bedrock: ${escHtml(accounts.bedrock.gamertag)}`,
            );
      }

      if (!accounts.java && !accounts.bedrock) {
        console.warn("[OAuth] No Minecraft accounts found for:", session.discordUserId);
        return res.send(
          buildPage(
            env("WEB_NO_ACCOUNT_TITLE", "⚠️ No Minecraft Account Found"),
            `<p>${escHtml(env("WEB_NO_ACCOUNT_BODY", "No Minecraft licence found on this Microsoft account. Try a different account or contact the server owner."))}</p>`,
            false,
          ),
        );
      }

      // Reload whitelist in Minecraft via RCON
      console.log("[OAuth] Reloading whitelist...");
      const reloadSuccess = await reloadWhitelist();

      // Assign the Minecraft Discord role if any accounts were newly added
      if (added.length > 0) {
        await assignMinecraftRole(discordClient, session.discordUserId);
      }

      // Force live embed refresh
      try {
        const { forceUpdate } = require("../utils/liveEmbed");
        await forceUpdate();
        console.log("[OAuth] Live embed updated");
      } catch (err) {
        console.warn("[OAuth] Could not update live embed:", err.message);
        /* liveEmbed may not be initialised yet */
      }

      const allAdded = added.length > 0;
      const allExisted = !allAdded && alreadyListed.length > 0;

      if (allExisted) {
        console.log("[OAuth] All accounts already whitelisted:", session.discordUserId);
        return res.send(
          buildPage(
            env("WEB_ALREADY_TITLE", "✅ Already Whitelisted"),
            `<p>${escHtml(env("WEB_ALREADY_BODY", "Your account is already on the whitelist. See you in-game!"))}</p>
           <ul>${alreadyListed.map((l) => `<li>${l}</li>`).join("")}</ul>`,
            true,
          ),
        );
      }

      const listHtml = [
        ...added.map((l) => `<li>${l}</li>`),
        ...alreadyListed.map((l) => `<li>${l} <em>(already listed)</em></li>`),
      ].join("");

      console.log("[OAuth] ✅ Whitelisting complete for", session.discordUserId, "- added:", added.length, "already listed:", alreadyListed.length);
      return res.send(
        buildPage(
          env("WEB_SUCCESS_TITLE", "🎉 You're whitelisted!"),
          `<p>${escHtml(env("WEB_SUCCESS_BODY", "Your account has been added to the whitelist. See you in-game! ⛏️"))}</p>
         <ul>${listHtml}</ul>`,
          true,
        ),
      );
    } catch (err) {
      console.error("[OAuth] Auth flow error:", err.response?.data || err.message);
      return res.send(
        buildPage(
          env("WEB_ERROR_TITLE", "❌ Authentication Error"),
          `<p>${escHtml(env("WEB_ERROR_BODY", "Something went wrong. Please try again or contact the server owner."))}</p>
         <pre style="font-size:0.8em;color:#aaa;">${escHtml(err.message)}</pre>`,
          false,
        ),
      );
    }
  });

  // ── File downloads ────────────────────────────────────────────────────────
  const packsDir = path.join(__dirname, "../../assets/packs");
  app.get("/downloads/:filename", (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      console.log("[Downloads] Request:", filename);
      
      // Security: ensure filename is safe
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        console.warn("[Downloads] Rejected unsafe filename:", filename);
        return res.status(400).send("Invalid filename");
      }
      
      const filePath = path.join(packsDir, filename);
      const fs = require("fs");
      
      if (!fs.existsSync(filePath)) {
        console.warn("[Downloads] File not found:", filename);
        return res.status(404).send("File not found.");
      }
      
      console.log("[Downloads] Sending:", filename);
      res.download(filePath, (err) => {
        if (err) {
          console.error("[Downloads] Error sending file:", filename, err.message);
        } else {
          console.log("[Downloads] ✅ Sent:", filename);
        }
      });
    } catch (err) {
      console.error("[Downloads] Unexpected error:", err.message);
      res.status(500).send("Server error");
    }
  });

  // ── Health check ──────────────────────────────────────────────────────────
  app.get("/health", (_, res) => {
    console.debug("[OAuth] Health check");
    res.json({ status: "ok", bot: "SNBlocky", timestamp: new Date().toISOString() });
  });

  app.listen(port, () => {
    console.log(`[OAuth] ✅ Callback server listening on port ${port}`);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function env(key, fallback) {
  return process.env[key] || fallback;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPage(title, bodyHtml, success) {
  const accent = success ? "#57F287" : "#ED4245";
  const icon = success ? "⛏️" : "❌";
  const name = escHtml(
    process.env.WEB_SERVER_NAME || process.env.SERVER_NAME || "Crossroads SMP",
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escHtml(title)} – ${name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#1a1a2e;color:#e0e0e0;
         min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
    .card{background:#16213e;border:1px solid ${accent}44;border-radius:16px;
          max-width:480px;width:100%;padding:2.5rem;text-align:center;
          box-shadow:0 8px 32px #00000066}
    .icon{font-size:3rem;margin-bottom:1rem}
    h1{color:${accent};font-size:1.5rem;margin-bottom:1rem}
    p,li{line-height:1.6;color:#b0b0c0;margin-bottom:.75rem}
    ul{text-align:left;padding-left:1.25rem;margin-bottom:1rem}
    pre{text-align:left;background:#0f0f1a;padding:1rem;border-radius:8px;overflow:auto;font-size:.8em;color:#aaa}
    .footer{margin-top:2rem;font-size:.8rem;color:#555}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${escHtml(title)}</h1>
    ${bodyHtml}
    <div class="footer">${name} · Powered by SNBlocky</div>
  </div>
</body>
</html>`;
}

async function assignMinecraftRole(client, userId) {
  const roleId = process.env.MINECRAFT_ROLE_ID;
  if (!roleId) {
    console.debug("[Role] MINECRAFT_ROLE_ID not set, skipping role assignment");
    return;
  }
  try {
    console.log(`[Role] Assigning Minecraft role to ${userId}...`);
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(userId);
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId);
      console.log(`[Role] ✅ Assigned Minecraft role to ${member.user.tag}`);
    } else {
      console.debug(`[Role] ${member.user.tag} already has Minecraft role`);
    }
  } catch (err) {
    console.error("[Role] Failed to assign Minecraft role:", err.message);
  }
}

module.exports = startOAuthServer;
