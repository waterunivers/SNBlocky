const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getServerStatus } = require("./minecraft");
const featureQueue = require("./featureQueue");

/**
 * Build the current server info embed + button row.
 * Used by both /blocky info and the live embed updater.
 */
async function buildInfoEmbed() {
  try {
    console.log("[EmbedBuilder] Building info embed...");
    const mc = await getServerStatus();
    const featured = featureQueue.getCurrent();

    const statusLine = mc.online
      ? `🟢 Online — **${mc.players}/${mc.maxPlayers}** players`
      : "🔴 Offline";

    const imageUrl = featured ? featured.url : (process.env.SERVER_COVER_IMAGE || null);
    const imageCredit = featured
      ? `-# Featured image by **${featured.submitterName}**`
      : `-# Featured image • ${process.env.SERVER_IMAGE_CREDIT || process.env.SERVER_NAME}`;

    const embed = new EmbedBuilder()
      .setColor(0xff90ff)
      .setAuthor({
        name: "Hosted by • SNB",
        iconURL: "https://i.imgur.com/ErGTmlQ.png",
      })
      .setTitle(`Welcome to ${process.env.SERVER_NAME || "Crossroads SMP"}`)
      .setDescription(`> ${process.env.SERVER_ABOUT || "A Minecraft SMP community server."}`)
      .addFields(
        { name: "📡 Status",     value: statusLine,                                               inline: true },
        { name: "🌐 IP Address", value: `\`${process.env.MC_SERVER_IP_DISPLAY || "Not set"}\``,  inline: true },
        { name: "🎮 Version",    value: mc.version || process.env.SERVER_VERSION || "Unknown",    inline: true },
        { name: "🔗 Server Map",value: process.env.SERVER_MAP_WEBSITE ? `[View Here](${process.env.SERVER_MAP_WEBSITE})` : "Not set", inline: true },
        { name: "",              value: imageCredit,                                               inline: false },
      )
      .setImage(imageUrl)
      .setFooter({ text: "Press a button below to get started!" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("blocky_whitelist")
        .setLabel("Join Whitelist")
        .setEmoji("🔑")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("blocky_info")
        .setLabel("Info")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("blocky_rules")
        .setLabel("Rules")
        .setEmoji("🚨")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("blocky_downloads")
        .setLabel("Downloads")
        .setEmoji("📦")
        .setStyle(ButtonStyle.Secondary),
    );

    console.log(`[EmbedBuilder] Embed built successfully (server ${mc.online ? "online" : "offline"})`);
    return { embeds: [embed], components: [row] };
  } catch (err) {
    console.error("[EmbedBuilder] Failed to build embed:", err.message);
    // Return a minimal fallback embed
    const fallbackEmbed = new EmbedBuilder()
      .setColor(0xff90ff)
      .setTitle(`Welcome to ${process.env.SERVER_NAME || "Crossroads SMP"}`)
      .setDescription("Server information temporarily unavailable")
      .setFooter({ text: "Please try again later" });
    
    return { embeds: [fallbackEmbed], components: [] };
  }
}

/**
 * Build the DM version of the server info embed with text links instead of buttons.
 * DMs don't support buttons, so we add helpful text links and instructions.
 */
async function buildDmEmbed() {
  try {
    console.log("[EmbedBuilder] Building DM embed...");
    const mc = await getServerStatus();
    const featured = featureQueue.getCurrent();

    const statusLine = mc.online
      ? `🟢 Online — **${mc.players}/${mc.maxPlayers}** players`
      : "🔴 Offline";

    const linksText = `
    **Quick Actions:**
    🔑 \`/whitelist\` — Get whitelisted on the server
    📋 \`/info\` — Learn more about Crossroads SMP
    🚨 \`/rules\` — Read the server rules
    📦 \`/downloads\` — Get modpacks & resources
    *Run these commands right here in DMs!*`;

    const imageUrl = featured ? featured.url : (process.env.SERVER_COVER_IMAGE || null);
    const imageCredit = featured
      ? `-# Featured image by **${featured.submitterName}**`
      : `-# Featured image • ${process.env.SERVER_IMAGE_CREDIT || process.env.SERVER_NAME}`;

    const embed = new EmbedBuilder()
      .setColor(0xff90ff)
      .setAuthor({
        name: "Hosted by • SNB",
        iconURL: "https://i.imgur.com/ErGTmlQ.png",
      })
      .setTitle(`Welcome to ${process.env.SERVER_NAME || "Crossroads SMP"}`)
      .setDescription(`> ${process.env.SERVER_ABOUT || "A Minecraft SMP community server."}`)
      .addFields(
        { name: "📡 Status",     value: statusLine,                                               inline: true },
        { name: "🌐 IP Address", value: `\`${process.env.MC_SERVER_IP_DISPLAY || "Not set"}\``,  inline: true },
        { name: "🎮 Version",    value: mc.version || process.env.SERVER_VERSION || "Unknown",    inline: true },
        { name: "🔗 Server Map",value: process.env.SERVER_MAP_WEBSITE ? `[View Here](${process.env.SERVER_MAP_WEBSITE})` : "Not set", inline: true },
        { name: "",              value: imageCredit,                                               inline: false },
        { name: "─────────────", value: linksText,                                                inline: false },
      )
      .setImage(imageUrl)
      .setFooter({ text: "Live updates from Crossroads SMP" });

    console.log(`[EmbedBuilder] DM embed built successfully (server ${mc.online ? "online" : "offline"})`);
    return { embeds: [embed] };
  } catch (err) {
    console.error("[EmbedBuilder] Failed to build DM embed:", err.message);
    const fallbackEmbed = new EmbedBuilder()
      .setColor(0xff90ff)
      .setTitle(`Welcome to ${process.env.SERVER_NAME || "Crossroads SMP"}`)
      .setDescription("Server information temporarily unavailable")
      .setFooter({ text: "Please try again later" });
    
    return { embeds: [fallbackEmbed] };
  }
}

module.exports = { buildInfoEmbed, buildDmEmbed };
