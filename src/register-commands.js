require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

console.log("[SETUP] Loading commands for registration...");
const commands = [];
const commandsPath = path.join(__dirname, "commands");

for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  try {
    const command = require(path.join(commandsPath, file));
    if (command.data) {
      commands.push(command.data.toJSON());
      console.log(`[SETUP] Loaded command: ${command.data.name}`);
    } else {
      console.warn(`[SETUP] File ${file} missing command.data`);
    }
  } catch (err) {
    console.error(`[ERROR] Failed to load command ${file}:`, err.message);
  }
}

console.log(`[SETUP] Total commands to register: ${commands.length}`);

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`[SETUP] Registering ${commands.length} slash command(s) to guild ${process.env.DISCORD_GUILD_ID}...`);
    const result = await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );
    console.log(`[SETUP] ✅ Commands registered successfully! (${result.length} commands)`);
  } catch (err) {
    console.error("[ERROR] Failed to register commands:", err.message, err.stack);
    process.exit(1);
  }
})();
