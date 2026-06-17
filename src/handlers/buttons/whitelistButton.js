const { MessageFlags } = require("discord.js");
const { createSession } = require("../../utils/sessions");
const { buildAuthUrl } = require("../../utils/msAuth");

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handleWhitelistButton(interaction) {
  try {
    console.log(`[Button] Whitelist button clicked by ${interaction.user.tag}`);
    // Create a unique state token tied to this Discord user
    const state = createSession(interaction.user.id, interaction.channelId);
    const authUrl = buildAuthUrl(state);
    console.log(`[Button] Generated auth URL for ${interaction.user.tag}`);

    const WHITELIST_CONTENT = `
  ## 🔑 Join the Crossroads SMP Whitelist
  ### Sign in
  > To get whitelisted, you'll need to sign in with the 
  > **Microsoft account** linked to your Minecraft account.
  ### [Sign in with Microsoft](${authUrl})

  ### Support
  > **Java Edition** If you own only a Java Edition Minecraft account, it will be added like normal.
  > **Bedrock Edition** If you own only a Bedrock Edition Minecraft account, that will be whitelisted instead.
  > **Both** If you own both a Java *and* a Bedrock account, both will be whitelisted in one go!
  > **Alt** If you own a *second* Minecraft account, log in again with that Microsoft account and contact @WaterUnivers.

-# This link expires in **10 minutes.**
  `.trim();

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: WHITELIST_CONTENT,
    });
    console.log(`[Button] ✅ Whitelist button response sent to ${interaction.user.tag}`);
  } catch (err) {
    console.error("[Button] Whitelist button error:", err.message);
    throw err;
  }
};
