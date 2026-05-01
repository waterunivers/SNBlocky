const { MessageFlags } = require("discord.js");

// ─── Editable Rules ───────────────────────────────────────────────────────────
// Edit the rules and info below. Markdown formatting is supported.

const RULES_CONTENT = `
### 📋 Crossroads SMP — Rules & Info

**Be respectful.**
Treat all players with kindness. Harassment, discrimination, and hate speech will result in an immediate ban.

**No griefing or theft.**
Respect other players' builds and items. If it isn't yours, don't touch it without permission.

**No cheating or hacking.**
Only vanilla-compatible clients and approved mods are allowed. No x-ray, auto-clickers, or exploits.

**Keep the world clean.**
Don't leave floating trees, 1x1 towers, or massive holes near spawn. Clean up your messes!

**Claim your land.**
Use the in-game land claiming system to protect your builds. Unclaimed builds are not protected.

**PvP by consent only.**
Player versus player combat must be agreed upon by both parties. No surprise attacks.

**Keep chat appropriate.**
This is a community for all ages. Keep conversations friendly and on-topic.

**Report issues.**
If you find a bug, duplicate exploit, or witness rule-breaking, report it to the server owner immediately rather than abusing it.

---
*These rules may be updated at any time. Ignorance of the rules is not an excuse.*
*For appeals or questions, DM the server owner on Discord.*
`.trim();

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handleRulesButton(interaction) {
  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: RULES_CONTENT,
  });
};
