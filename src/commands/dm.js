const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { createSession } = require("../utils/sessions");
const { buildAuthUrl } = require("../utils/msAuth");
const { getAssetPacks } = require("../utils/minecraft");
const dmUsers = require("../utils/dmUsers");
const { deleteDmEmbed } = require("../utils/liveEmbed");

function isOwner(userId) {
  return userId === process.env.OWNER_ID;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dm")
    .setDescription("DM commands for Crossroads SMP")
    .setDMPermission(true)

    // ── /dm info ──────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName("info").setDescription("Learn about Crossroads SMP")
    )

    // ── /dm rules ─────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName("rules").setDescription("View server rules")
    )

    // ── /dm whitelist ─────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName("whitelist").setDescription("Get whitelisted on the server")
    )

    // ── /dm downloads ─────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName("downloads").setDescription("View modpacks and resources")
    )

    // ── /dm remove ────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName("remove").setDescription("Remove yourself from the DM list")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    console.log(`[Command] /dm ${sub} executed by ${interaction.user.tag}`);

    try {
      // ── /dm info ────────────────────────────────────────────────────────────
      if (sub === "info") {
        const INFO_CONTENT = `
## 📋 Info
### What is Crossroads SMP?
> Crossroads is a vanilla+ Minecraft server that will run forever, keeping up with the updates of the game. It gets multiple 
> communities involved to encourage players to come together and create stories, adventures, builds, and much more.
> Anyone can play, regardless of platform or experience. With the help of GeyserMC, players can join from any Minecraft client!
> Explore the world to discover its secrets, share your discoveries and work together to progress our story.

### How to Join
> Press the *"Join Whitelist"* button to sign in with your Microsoft account and get started.
> Open your desired Minecraft client and navigate to the multiplayer/servers tab.
> **Java:** Press *"Add Server"* and enter \`${process.env.MC_SERVER_IP_DISPLAY || "Not set"}\` as the IP address.
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
> See the \`/dm downloads\` command to install the suggested packs and other useful links.
        `.trim();

        return interaction.reply({ content: INFO_CONTENT, flags: MessageFlags.Ephemeral });
      }

      // ── /dm rules ───────────────────────────────────────────────────────────
      if (sub === "rules") {
        const RULES_CONTENT = `
## 🚨 Rules
### General - A short summary
> **Be a good sport.** Nothing is to be taken too seriously, but neither should someone else's experience be tarnished
> by your actions. We encourage pranks, tomfoolery and fun. You're free to do most things, start a storyline, make an 
> economy, become a leader, start server-wide wars. It's all up to your imagination. Just make it fun.

### Harsh - Can result in a ban
> **Cheating:** Using severe cheats such as flight, NoClip, auto-mining, etc.
> **Harassment:** Unsolicited harassment of any kind is not allowed.
> **Server Griefing:** Griefing at a large scale that damages the server as a whole. 

### Forgiving - Can result in minor punishment
> **Annoyance:** Repeated behaviour such as forcing a storyline on a non-willing player, or nonsensical trapping.
> **Unwarranted Killing:** Ending a player's life in a way that is not justifiable or recoverable.

### Soft - Won't result in major punishment
> **Light Griefing:** Small-scale griefing is allowed but any damage you cause should be justifiable or repairable.
> **Stealing:** Stealing non-valuable items from other players is okay, but so is retaliation.

-# *Any questions? Contact @WaterUnivers for assistance, or turn to any of the @moderator members.*
        `.trim();

        return interaction.reply({ content: RULES_CONTENT, flags: MessageFlags.Ephemeral });
      }

      // ── /dm whitelist ───────────────────────────────────────────────────────
      if (sub === "whitelist") {
        const state = createSession(interaction.user.id, interaction.channelId);
        const authUrl = buildAuthUrl(state);

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

        return interaction.reply({ content: WHITELIST_CONTENT, flags: MessageFlags.Ephemeral });
      }

      // ── /dm downloads ───────────────────────────────────────────────────────
      if (sub === "downloads") {
        const INTRO_TEXT = `
## 📦 Downloads & Recommended Resources
> Crossroads SMP is compatible with a **completely vanilla** client, however we have 
> also curated a few optional mods that enhance the experience further. Below you 
> can find the suggested **Crossroads SMP modpack** and any community-made packs.
        `.trim();

        const RECOMMENDED_SITES = [
          { label: "Crossroads Live Map", url: process.env.SERVER_MAP_WEBSITE },
          { label: "Minecraft Wiki", url: "https://minecraft.fandom.com/wiki" },
          { label: "Vanilla Tweaks", url: "https://vanillatweaks.net" },
          { label: "MCTools", url: "https://mc-tools.net" },
        ];

        const packs = getAssetPacks();
        let packsText = "";
        if (packs && packs.length > 0) {
          packsText = "\n### 📂 Available Modpacks\n";
          for (const pack of packs) {
            packsText += `> **${pack.name}** — [Download](${pack.url})\n`;
          }
        } else {
          packsText = "\n### 📂 Available Modpacks\n> No modpacks available at this time.";
        }

        let sitesText = "\n### 🌐 Recommended Resources\n";
        for (const site of RECOMMENDED_SITES) {
          if (site.url) {
            sitesText += `> [${site.label}](${site.url})\n`;
          }
        }

        const fullContent = INTRO_TEXT + packsText + sitesText;
        return interaction.reply({ content: fullContent, flags: MessageFlags.Ephemeral });
      }

      // ── /dm remove ──────────────────────────────────────────────────────────
      if (sub === "remove") {
        const userId = interaction.user.id;
        const entry = dmUsers.remove(userId);
        
        if (!entry) {
          return interaction.reply({ 
            content: "ℹ️ You're not currently on the live updates list.", 
            flags: MessageFlags.Ephemeral 
          });
        }

        // Delete their DM embed
        await deleteDmEmbed(userId, entry.dmMessageId);

        return interaction.reply({
          content: `✅ You've been removed from **${process.env.SERVER_NAME || "Crossroads SMP"}** live updates.\nYou'll no longer receive server embeds or announcements via DM.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (err) {
      console.error(`[Command] /dm ${sub} error:`, err.message);
      await interaction.reply({ 
        content: `❌ Failed to execute \`/dm ${sub}\`.`, 
        flags: MessageFlags.Ephemeral 
      }).catch(() => {});
    }
  },
};
