const { MessageFlags } = require("discord.js");

const BUTTON_HANDLERS = {
  blocky_whitelist: require("./buttons/whitelistButton"),
  blocky_downloads: require("./buttons/downloadsButton"),
  blocky_rules:     require("./buttons/rulesButton"),
  blocky_info:      require("./buttons/infoButton"),
};

module.exports = async function interactionHandler(client, interaction) {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[Interaction] Command not found: ${interaction.commandName}`);
      return;
    }
    try {
      console.log(`[Interaction] Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`[ERROR] Command execution failed: ${interaction.commandName}`, err.message, err.stack);
      const msg = { content: "❌ Something went wrong running that command.", flags: MessageFlags.Ephemeral };
      try {
        interaction.replied || interaction.deferred ? await interaction.followUp(msg) : await interaction.reply(msg);
      } catch (replyErr) {
        console.error("[ERROR] Failed to send error reply:", replyErr.message);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const handler = BUTTON_HANDLERS[interaction.customId];
    if (!handler) {
      console.warn(`[Interaction] Button handler not found: ${interaction.customId}`);
      return;
    }
    try {
      console.log(`[Interaction] Button pressed: ${interaction.customId} by ${interaction.user.tag}`);
      await handler(interaction, client);
    } catch (err) {
      console.error(`[ERROR] Button handler failed: ${interaction.customId}`, err.message, err.stack);
      const msg = { content: "❌ Something went wrong.", flags: MessageFlags.Ephemeral };
      try {
        interaction.replied || interaction.deferred ? await interaction.followUp(msg) : await interaction.reply(msg);
      } catch (replyErr) {
        console.error("[ERROR] Failed to send error reply:", replyErr.message);
      }
    }
  }
};
