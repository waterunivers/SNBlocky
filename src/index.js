require("dotenv").config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require("discord.js");
const fs   = require("fs");
const path = require("path");

const startOAuthServer   = require("./web/oauthServer");
const interactionHandler = require("./handlers/interactionHandler");
const { initLiveEmbed, deleteDmEmbed } = require("./utils/liveEmbed");
const dmUsers            = require("./utils/dmUsers");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
});
client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandData  = [];

for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  try {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      commandData.push(command.data.toJSON());
      console.log(`[STARTUP] [Commands] Loaded: ${command.data.name}`);
    } else {
      console.warn(`[STARTUP] [Commands] ${file} missing data or execute`);
    }
  } catch (err) {
    console.error(`[ERROR] Failed to load command ${file}:`, err.message);
  }
}

client.once("ready", async () => {
  console.log(`\n[STARTUP] ✅ SNBlocky is online as ${client.user.tag}`);
  console.log(`[STARTUP]    Serving guild: ${process.env.DISCORD_GUILD_ID}`);
  console.log(`[STARTUP]    OAuth callback: ${process.env.MS_REDIRECT_URI}`);
  console.log(`[STARTUP]    Logged in at ${new Date().toISOString()}\n`);

  // Register slash commands
  try {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    console.log("[STARTUP] 🚀 Registering slash commands (global)...");
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commandData },
    );
    console.log(`[STARTUP] ✅ Slash commands registered globally (${commandData.length} commands).`);
    console.log(`[STARTUP]    Note: Global commands may take up to 1 hour to propagate.`);
  } catch (err) {
    console.error("[ERROR] Failed to register commands:", err.message, err.stack);
    process.exit(1);
  }

  // Start live embed
  if (process.env.INFO_CHANNEL_ID) {
    try {
      await initLiveEmbed(client);
      console.log(`[STARTUP] [LiveEmbed] Watching channel ${process.env.INFO_CHANNEL_ID}`);
    } catch (err) {
      console.error("[ERROR] Failed to initialize live embed:", err.message);
    }
  } else {
    console.warn("[STARTUP] [LiveEmbed] INFO_CHANNEL_ID not set — live embed disabled");
  }
});

// Slash command + button interactions
client.on("interactionCreate", (interaction) => interactionHandler(client, interaction));

// ── DM self-remove ────────────────────────────────────────────────────────────
// Users outside the server can DM the bot "/blocky remove" to remove themselves.
client.on("messageCreate", async (message) => {
  // Only handle DMs, ignore bots
  if (message.author.bot) return;
  if (message.guild) return; // not a DM

  const content = message.content.trim().toLowerCase();
  if (content !== "/blocky remove") return;

  const userId = message.author.id;
  if (!dmUsers.has(userId)) {
    await message.reply("You're not currently on the live updates list.");
    return;
  }

  const entry = dmUsers.remove(userId);
  
  // Delete their DM embed
  if (entry) {
    await deleteDmEmbed(userId, entry.dmMessageId);
  }
  
  await message.reply(
    `✅ You've been removed from **${process.env.SERVER_NAME || "Crossroads SMP"}** live updates.\nYou'll no longer receive server embeds or announcements via DM.`,
  );
});

// Global error handlers
client.on("error", (err) => {
  console.error("[ERROR] Discord client error:", err.message, err.stack);
});

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err.message, err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled rejection at", promise, "reason:", reason);
});

// Start OAuth server and login
try {
  startOAuthServer(client);
  console.log("[STARTUP] OAuth server initialized");
} catch (err) {
  console.error("[ERROR] Failed to start OAuth server:", err.message);
}

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("[FATAL] Failed to login to Discord:", err.message, err.stack);
  process.exit(1);
});
