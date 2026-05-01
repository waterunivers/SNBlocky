const { MessageFlags } = require("discord.js");
const { createSession } = require("../../utils/sessions");
const { buildAuthUrl } = require("../../utils/msAuth");

module.exports = async function handleWhitelistButton(interaction) {
  // Create a unique state token tied to this Discord user
  const state = createSession(interaction.user.id, interaction.channelId);
  const authUrl = buildAuthUrl(state);

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content:
      `### 🔑 Join the Crossroads SMP Whitelist\n\n` +
      `To get whitelisted, you'll need to sign in with the **Microsoft account** linked to your Minecraft profile.\n\n` +
      `> 🪟 **Java Edition** accounts will be added automatically.\n` +
      `> 📱 **Bedrock Edition** accounts are supported too — just sign in with your Xbox account.\n` +
      `> If you have **both**, both will be whitelisted in one go!\n\n` +
      `**[👉 Click here to sign in with Microsoft](${authUrl})**\n\n` +
      `> ⏱️ This link expires in **10 minutes**. After signing in you'll receive a DM with confirmation.\n` +
      `> 🔒 We only request your Minecraft profile — no email, no passwords stored.`,
  });
};
