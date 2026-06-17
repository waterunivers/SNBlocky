const { MessageFlags } = require("discord.js");

// ─── Editable Rules ───────────────────────────────────────────────────────────
// Edit the rules and info below. Markdown formatting is supported.

const INFO_CONTENT = `
## 📋 Info
### What is Crossroads SMP?
> Crossroads is a vanilla+ Minecraft server that will run forever, keeping up with the updates of the game. It gets multiple 
> communities involved to encourage players to come together and create stories, adventures, builds, and much more.
> Anyone can play, regardless of platform or experience. With the help of GeyserMC, players can join from any Minecraft client!
> Explore the world to discover its secrets, share you disoveries and work together to progress our story.

### How to Join
> Press the *"Join Whitelist"*  button to sign in with your Microsoft account and get started.
> Open your desired Minecraft client and navigate to the multiplayer/servers tab.
> **Java:** Press *"Add Server"* and enter \`${process.env.MC_SERVER_IP_DISPLAY || "Not set"}\` as the IP adress.
> **Bedrock:** Press *"Add Server"* and enter \`${process.env.MC_SERVER_IP_DISPLAY || "Not set"}\` as the IP address, and \`${process.env.MC_SERVER_PORT || "Not set"}\` as the port.
> Choose a name for the server, (I recommend just *Crossroads SMP*) and create it.
> Now, join the server! Make sure to read the rules and check out the downloads. Until then, I'll see you in-game.

### Alt Accounts
> If you own a second Minecraft account, you can use it as an *alt profile*.
> An *alt profile* is a separate account that is placed into spectator mode.
> If you wish to have an *alt profile*, please contact @waterunivers for assistance.

### Mods
> Players can join using a completely vanilla client if they want!
> We recommend players who *can* install the complimentary mods on their client do so.
> See *"Downloads"* to install the suggested packs and other useful links.

-# *Any questions? Contact @WaterUnivers for assistance, or turn to any of the @moderator members.*
`.trim();

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handleInfoButton(interaction) {
  try {
    console.log(`[Button] Info button clicked by ${interaction.user.tag}`);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: INFO_CONTENT,
    });
    console.log(`[Button] ✅ Info button response sent to ${interaction.user.tag}`);
  } catch (err) {
    console.error("[Button] Info button error:", err.message);
    throw err;
  }
};
