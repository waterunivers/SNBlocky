const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { getServerStatus } = require("../utils/minecraft");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blocky")
    .setDescription("SNBlocky root command")
    .addSubcommand((sub) =>
      sub.setName("info").setDescription("Display Crossroads SMP server info (owner only)")
    ),

  async execute(interaction) {
    // ── Owner-only guard ────────────────────────────────────────────────────
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({
        content: "🔒 Only the server owner can use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();
    if (sub !== "info") return;

    await interaction.deferReply();

    // ── Fetch live server status ────────────────────────────────────────────
    const mc = await getServerStatus();
    const statusLine = mc.online
      ? `🟢 Online — **${mc.players}/${mc.maxPlayers}** players`
      : "🔴 Offline";

    // ── Build Embed ─────────────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`⛏️ ${process.env.SERVER_NAME || "Crossroads SMP"}`)
      .setDescription(process.env.SERVER_ABOUT || "A Minecraft SMP community server.")
      .setImage(process.env.SERVER_COVER_IMAGE || null)
      .addFields(
        {
          name: "📡 Status",
          value: statusLine,
          inline: true,
        },
        {
          name: "🌐 Server IP",
          value: `\`${process.env.MC_SERVER_IP_DISPLAY || "Not set"}\``,
          inline: true,
        },
        {
          name: "🎮 Version",
          value: mc.version || process.env.SERVER_VERSION || "Unknown",
          inline: true,
        }
      )
      .setFooter({ text: "Crossroads SMP · Click a button below to get started" })
      .setTimestamp();

    // ── Action Buttons ──────────────────────────────────────────────────────
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("blocky_whitelist")
        .setLabel("Join Whitelist")
        .setEmoji("🔑")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("blocky_downloads")
        .setLabel("Downloads")
        .setEmoji("📦")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("blocky_rules")
        .setLabel("Rules & Info")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
