const { InteractionType, MessageFlags } = require("discord.js");

// Button handlers
const handleWhitelistButton = require("./buttons/whitelistButton");
const handleDownloadsButton = require("./buttons/downloadsButton");
const handleRulesButton = require("./buttons/rulesButton");

const BUTTON_HANDLERS = {
  blocky_whitelist: handleWhitelistButton,
  blocky_downloads: handleDownloadsButton,
  blocky_rules: handleRulesButton,
};

module.exports = async function interactionHandler(client, interaction) {
  // ── Slash Commands ──────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`[Command Error] ${interaction.commandName}:`, err);
      const msg = { content: "❌ Something went wrong running that command.", flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
    return;
  }

  // ── Button Interactions ─────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const handler = BUTTON_HANDLERS[interaction.customId];
    if (!handler) return;
    try {
      await handler(interaction, client);
    } catch (err) {
      console.error(`[Button Error] ${interaction.customId}:`, err);
      const msg = { content: "❌ Something went wrong.", flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  }
};
