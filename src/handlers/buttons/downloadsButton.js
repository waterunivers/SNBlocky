const { MessageFlags } = require("discord.js");
const { getAssetPacks } = require("../../utils/minecraft");
const path = require("path");
const fs = require("fs");

// ─── Editable configuration ───────────────────────────────────────────────────
// Edit the text below to customise the downloads message shown to users.

const INTRO_TEXT = `
### 📦 Downloads & Recommended Resources

Crossroads SMP is compatible with a completely **vanilla client**, however we have curated a few optional mods that enhance the experience further.

Below you can find the suggested **Crossroads SMP modpack** and any community-made packs.
`.trim();

// External website links shown at the bottom of the message.
// Format: { label: "Display Name", url: "https://..." }
const RECOMMENDED_SITES = [
  { label: "Vanilla Tweaks", url: "https://vanillatweaks.net" },
  { label: "MCTools", url: "https://mctools.org" },
  // Add more links here as needed ↓
  // { label: "My Site", url: "https://example.com" },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handleDownloadsButton(interaction) {
  const packs = getAssetPacks();

  // Build pack download links
  // Files in /assets/packs are served via the OAuth Express server at /downloads/:filename
  const baseUrl = process.env.MS_REDIRECT_URI
    ? process.env.MS_REDIRECT_URI.replace("/auth/callback", "")
    : `http://localhost:${process.env.OAUTH_PORT || 3000}`;

  let packsSection = "";
  if (packs.length === 0) {
    packsSection = "\n> 📭 *No modpacks have been uploaded yet. Check back soon!*\n";
  } else {
    packsSection =
      "\n**📥 Available Downloads:**\n" +
      packs
        .map((p) => `> • [${p.name}](${baseUrl}/downloads/${encodeURIComponent(p.filename)})`)
        .join("\n") +
      "\n";
  }

  // Build recommended sites section
  let sitesSection = "";
  if (RECOMMENDED_SITES.length > 0) {
    sitesSection =
      "\n**🌐 We also recommend checking out:**\n" +
      RECOMMENDED_SITES.map((s) => `> • [${s.label}](${s.url})`).join("\n") +
      "\n";
  }

  const content = `${INTRO_TEXT}\n${packsSection}${sitesSection}\n` +
    `> 💡 *Hover or tap any link to download. Files are hosted directly on the Crossroads SMP server.*`;

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content,
  });
};
