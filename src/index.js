require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

const startOAuthServer = require("./web/oauthServer");
const interactionHandler = require("./handlers/interactionHandler");

// ─── Discord Client ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// ─── Load Commands ────────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`[Commands] Loaded: ${command.data.name}`);
  }
}

// ─── Event: Ready ─────────────────────────────────────────────────────────────
client.once("ready", () => {
  console.log(`\n✅ SNBlocky is online as ${client.user.tag}`);
  console.log(`   Serving guild: ${process.env.DISCORD_GUILD_ID}`);
  console.log(`   OAuth callback: ${process.env.MS_REDIRECT_URI}\n`);
});

// ─── Event: Interactions ──────────────────────────────────────────────────────
client.on("interactionCreate", (interaction) =>
  interactionHandler(client, interaction)
);

// ─── Start OAuth Web Server ───────────────────────────────────────────────────
startOAuthServer(client);

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
