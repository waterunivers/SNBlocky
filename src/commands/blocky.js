const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { buildInfoEmbed } = require("../utils/embedBuilder");
const { getPlayerSessions, forceUpdate, sendDmEmbed, deleteDmEmbed } = require("../utils/liveEmbed");
const featureQueue = require("../utils/featureQueue");
const dmUsers = require("../utils/dmUsers");

function isOwner(userId) {
  return userId === process.env.OWNER_ID;
}

function hasFeatureRole(member) {
  const roleId = process.env.FEATURE_ROLE_ID;
  if (!roleId || !member) return false;
  return member.roles.cache.has(roleId);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blocky")
    .setDescription("SNBlocky root command")

    // ── /blocky info ──────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName("info").setDescription("Post the server info embed (owner only)"),
    )

    // ── /blocky players ───────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName("players").setDescription("Show currently online players"),
    )

    // ── /blocky announcement ─────────────────────────────────────────────────
    .addSubcommand((s) =>
      s.setName("announcement")
        .setDescription("Post an announcement (owner only)")
        .addStringOption((o) => o.setName("message").setDescription("Announcement text").setRequired(true)),
    )

    // ── /blocky dm * ─────────────────────────────────────────────────────────
    .addSubcommandGroup((g) =>
      g.setName("dm").setDescription("Manage DM users")
        .addSubcommand((s) =>
          s.setName("add").setDescription("Add a user to the DM list (owner only)")
            .addStringOption((o) => o.setName("user_id").setDescription("Discord user ID").setRequired(true)),
        )
        .addSubcommand((s) =>
          s.setName("remove").setDescription("Remove a user from the DM list (owner only)")
            .addStringOption((o) => o.setName("user_id").setDescription("Discord user ID").setRequired(true)),
        )
        .addSubcommand((s) => s.setName("list").setDescription("List all DM users (owner only)")),
    )
    // ── /blocky feature ───────────────────────────────────────────────────────
    .addSubcommandGroup((group) =>
      group
        .setName("feature")
        .setDescription("Featured image queue")
        .addSubcommand((sub) =>
          sub
            .setName("submit")
            .setDescription("Submit an image to the featured queue")
            .addAttachmentOption((opt) =>
              opt.setName("image").setDescription("The image to submit").setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("queue")
            .setDescription("View the pending and approved queues (owner only)"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("approve")
            .setDescription("Approve a pending submission (owner only)")
            .addStringOption((opt) =>
              opt.setName("id").setDescription("Submission ID").setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("reject")
            .setDescription("Reject a pending submission (owner only)")
            .addStringOption((opt) =>
              opt.setName("id").setDescription("Submission ID").setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove an approved-but-not-yet-shown entry (owner only)")
            .addStringOption((opt) =>
              opt.setName("id").setDescription("Entry ID").setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("rotate")
            .setDescription("Manually advance to the next featured image (owner only)"),
        ),
    )
    .setDMPermission(true),

  async execute(interaction, client) {
    const sub   = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    console.log(`[Command] Executing: /blocky ${group ? group + " " : ""}${sub} by ${interaction.user.tag}`);

    // ── /blocky info ──────────────────────────────────────────────────────────
    if (sub === "info") {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: "🔒 Only the server owner can post the info embed.", flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply();
      const payload = await buildInfoEmbed();
      await interaction.editReply(payload);
      return;
    }

    // ── /blocky players ───────────────────────────────────────────────────────
    if (sub === "players") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const sessions = getPlayerSessions();

      if (sessions.size === 0) {
        return interaction.editReply({ content: "🔴 No players are currently online." });
      }

      const now   = Date.now();
      const lines = [];
      for (const [name, data] of sessions) {
        const playtime = formatDuration(now - data.joinedAt.getTime());
        const client   = data.isBedrock ? "📱 Bedrock" : "☕ Java";
        lines.push(`**${name}** — ${client} — online for ${playtime}`);
      }

      return interaction.editReply({
        content: `### 🧑‍🤝‍🧑 Players Online (${sessions.size})\n` + lines.join("\n"),
      });
    }

    // ── /blocky announcement ──────────────────────────────────────────────────
    if (sub === "announcement") {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "🔒 Owner only.", flags: MessageFlags.Ephemeral });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      console.log(`[Announcement] Posting by ${interaction.user.tag}`);

      const message  = interaction.options.getString("message");
      const roleId   = process.env.MINECRAFT_ROLE_ID;
      const threadId = process.env.ANNOUNCEMENT_THREAD_ID;
      const now      = new Date();

      const embed = new EmbedBuilder()
        .setColor(0xff90ff)
        .setAuthor({ name: process.env.SERVER_NAME || "Crossroads SMP", iconURL: "https://i.imgur.com/ErGTmlQ.png" })
        .setTitle("📢 Announcement")
        .setDescription(message)
        .setFooter({ text: "Crossroads SMP" })
        .setTimestamp(now);

      let threadPosted = false;
      let dmCount = 0, dmFailed = 0;

      if (threadId) {
        try {
          const thread = await client.channels.fetch(threadId);
          await thread.send({ content: roleId ? `<@&${roleId}>` : "", embeds: [embed] });
          threadPosted = true;
          console.log(`[Announcement] Posted to thread ${threadId}`);
        } catch (err) {
          console.error("[Announcement] Thread post failed:", err.message);
        }
      }

      for (const entry of dmUsers.getAll()) {
        try {
          const user = await client.users.fetch(entry.userId);
          await user.send({ embeds: [embed] });
          dmCount++;
        } catch (err) {
          dmFailed++;
          console.warn(`[Announcement] Failed to DM ${entry.userId}:`, err.message);
        }
      }

      const threadStatus = threadPosted ? "✅ Posted to announcement thread" : "⚠️ Could not post to thread — check `ANNOUNCEMENT_THREAD_ID`";
      const dmStatus     = dmUsers.getAll().length === 0 ? "ℹ️ No users on the DM list" : `✅ DMed ${dmCount} user${dmCount !== 1 ? "s" : ""}${dmFailed > 0 ? ` (${dmFailed} failed — DMs may be disabled)` : ""}`;
      console.log(`[Announcement] Complete: ${dmCount} DMed, ${dmFailed} failed`);

      return interaction.editReply({ content: `### 📢 Announcement sent\n> ${threadStatus}\n> ${dmStatus}` });
    }

    // ── /blocky dm * ──────────────────────────────────────────────────────────
    if (group === "dm") {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "🔒 Owner only.", flags: MessageFlags.Ephemeral });

      if (sub === "add") {
        const userId = interaction.options.getString("user_id").trim();
        console.log(`[DM] Add request: ${userId}`);
        if (dmUsers.has(userId)) return interaction.reply({ content: `ℹ️ \`${userId}\` is already on the DM list.`, flags: MessageFlags.Ephemeral });
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        let user;
        try { 
          user = await client.users.fetch(userId);
          console.log(`[DM] Found user: ${user.tag}`);
        }
        catch (err) { 
          console.error(`[DM] User fetch failed for ${userId}:`, err.message);
          return interaction.editReply({ content: `❌ No Discord user found with ID \`${userId}\`.` }); 
        }
        const msgId = await sendDmEmbed(userId);
        if (!msgId) {
          console.warn(`[DM] Could not DM ${user.tag} (DMs disabled?)`);
          return interaction.editReply({ content: `❌ Could not DM **${user.tag}** — they may have DMs disabled.` });
        }
        dmUsers.add(userId, msgId);
        console.log(`[DM] Added ${user.tag} (${userId}) to DM list`);
        return interaction.editReply({ content: `✅ Added **${user.tag}** to the DM list. They'll now receive the live embed and announcements.` });
      }

      if (sub === "remove") {
        const userId = interaction.options.getString("user_id").trim();
        const entry  = dmUsers.remove(userId);
        if (!entry) return interaction.reply({ content: `❌ \`${userId}\` is not on the DM list.`, flags: MessageFlags.Ephemeral });
        
        // Delete their DM embed
        await deleteDmEmbed(userId, entry.dmMessageId);
        
        try {
          const user = await client.users.fetch(userId);
          await user.send(`You've been removed from **${process.env.SERVER_NAME || "Crossroads SMP"}** live updates. You'll no longer receive server embeds or announcements via DM.\n-# You can ask the server owner to re-add you at any time.`);
        } catch { /* DMs disabled — silent */ }
        return interaction.reply({ content: `✅ Removed \`${userId}\` from the DM list.`, flags: MessageFlags.Ephemeral });
      }

      if (sub === "list") {
        const users = dmUsers.getAll();
        if (users.length === 0) return interaction.reply({ content: "ℹ️ The DM list is empty.", flags: MessageFlags.Ephemeral });
        const lines = await Promise.all(
          users.map(async (u) => {
            try {
              const user = await client.users.fetch(u.userId);
              return `> **${user.tag}** — \`${u.userId}\` — added <t:${Math.floor(new Date(u.addedAt).getTime() / 1000)}:R>`;
            } catch {
              return `> \`${u.userId}\` (unknown) — added <t:${Math.floor(new Date(u.addedAt).getTime() / 1000)}:R>`;
            }
          }),
        );
        return interaction.reply({ content: `### 📬 DM List (${users.length})\n` + lines.join("\n"), flags: MessageFlags.Ephemeral });
      }
    }

    // ── /blocky feature * ─────────────────────────────────────────────────────
    if (group === "feature") {

      // submit
      if (sub === "submit") {
        if (!hasFeatureRole(interaction.member)) {
          return interaction.reply({ content: "🔒 You don't have permission to submit featured images.", flags: MessageFlags.Ephemeral });
        }
        const attachment = interaction.options.getAttachment("image");
        if (!attachment.contentType?.startsWith("image/")) {
          return interaction.reply({ content: "❌ Please attach an image file (PNG, JPG, GIF, etc.).", flags: MessageFlags.Ephemeral });
        }
        const entry = featureQueue.addPending(attachment.url, interaction.user.id, interaction.user.displayName);
        return interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `✅ **Image submitted!** It will be reviewed before appearing in the queue.\n-# Submission ID: \`${entry.id}\``,
        });
      }

      // queue (owner only)
      if (sub === "queue") {
        if (!isOwner(interaction.user.id)) {
          return interaction.reply({ content: "🔒 Owner only.", flags: MessageFlags.Ephemeral });
        }
        const pending  = featureQueue.getPending();
        const approved = featureQueue.getApproved();
        const current  = featureQueue.getCurrent();

        let content = `### 🖼️ Feature Image Queue\n`;
        content += `**Currently displayed:** ${current ? `[image](${current.url}) by **${current.submitterName}**` : "Default cover image"}\n\n`;

        if (approved.length === 0) {
          content += "**Approved queue:** empty\n";
        } else {
          content += `**Approved queue (${approved.length}):**\n`;
          approved.forEach((e, i) => content += `> ${i + 1}. \`${e.id}\` by **${e.submitterName}** — [view](${e.url})\n`);
        }

        content += "\n";

        if (pending.length === 0) {
          content += "**Pending review:** none";
        } else {
          content += `**Pending review (${pending.length}):**\n`;
          pending.forEach((e) => content += `> \`${e.id}\` by **${e.submitterName}** — [view](${e.url})\n`);
          content += "\nUse `/blocky feature approve <id>` or `/blocky feature reject <id>` to moderate.";
        }

        return interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }

      // approve (owner only)
      if (sub === "approve") {
        if (!isOwner(interaction.user.id)) {
          return interaction.reply({ content: "🔒 Owner only.", flags: MessageFlags.Ephemeral });
        }
        const id    = interaction.options.getString("id");
        console.log(`[Feature] Approving submission: ${id}`);
        const entry = featureQueue.approve(id);
        if (!entry) {
          console.warn(`[Feature] Approval failed: ${id} not found`);
          return interaction.reply({ content: `❌ No pending submission with ID \`${id}\` found.`, flags: MessageFlags.Ephemeral });
        }
        // If there's no current image, rotate immediately
        if (!featureQueue.getCurrent()) {
          featureQueue.rotate();
          await forceUpdate();
          console.log(`[Feature] Auto-rotated to first approved image`);
        }
        console.log(`[Feature] Approved ${entry.submitterName}'s image`);
        return interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `✅ Approved **${entry.submitterName}**'s image and added it to the queue.\n> [View image](${entry.url})`,
        });
      }

      // reject (owner only)
      if (sub === "reject") {
        if (!isOwner(interaction.user.id)) {
          return interaction.reply({ content: "🔒 Owner only.", flags: MessageFlags.Ephemeral });
        }
        const id    = interaction.options.getString("id");
        console.log(`[Feature] Rejecting submission: ${id}`);
        const entry = featureQueue.reject(id);
        if (!entry) {
          console.warn(`[Feature] Rejection failed: ${id} not found`);
          return interaction.reply({ content: `❌ No pending submission with ID \`${id}\` found.`, flags: MessageFlags.Ephemeral });
        }
        console.log(`[Feature] Rejected ${entry.submitterName}'s submission`);
        return interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `🗑️ Rejected **${entry.submitterName}**'s submission.`,
        });
      }

      // remove (owner only)
      if (sub === "remove") {
        if (!isOwner(interaction.user.id)) {
          return interaction.reply({ content: "🔒 Owner only.", flags: MessageFlags.Ephemeral });
        }
        const id    = interaction.options.getString("id");
        console.log(`[Feature] Removing entry: ${id}`);
        const entry = featureQueue.removeApproved(id);
        if (!entry) {
          console.warn(`[Feature] Remove failed: ${id} not found`);
          return interaction.reply({ content: `❌ No approved entry with ID \`${id}\` found.`, flags: MessageFlags.Ephemeral });
        }
        console.log(`[Feature] Removed ${entry.submitterName}'s image`);
        return interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `🗑️ Removed **${entry.submitterName}**'s image from the approved queue.`,
        });
      }

      // rotate (owner only)
      if (sub === "rotate") {
        if (!isOwner(interaction.user.id)) {
          return interaction.reply({ content: "🔒 Owner only.", flags: MessageFlags.Ephemeral });
        }
        console.log(`[Feature] Manual rotation requested`);
        const changed = featureQueue.rotate();
        if (!changed) {
          console.warn(`[Feature] Rotation failed: no approved images`);
          return interaction.reply({ content: "❌ No approved images in the queue to rotate to.", flags: MessageFlags.Ephemeral });
        }
        await forceUpdate();
        const current = featureQueue.getCurrent();
        console.log(`[Feature] Rotated to ${current.submitterName}'s image`);
        return interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `🔄 Rotated to **${current.submitterName}**'s image. The embed has been updated.\n> [View image](${current.url})`,
        });
      }
    }
  },
};
