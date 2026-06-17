const { MessageFlags } = require("discord.js");

// ─── Editable Rules ───────────────────────────────────────────────────────────
// Edit the rules below. Markdown formatting is supported.

const RULES_CONTENT = `
## 🚨 Rules
### General - A short summary
> **Be a good sport.** Nothing is to be taken too seriously, but neither should someone elses experience be tarnished
> by your actions. We encourage pranks, tomfoolery and fun. You're free to do most things, start a storyline, make an 
> economy, become a leader, start server-wide wars. It's all up to your imagination. Just make it fun.

### Harsh - Can result in a ban
> **Cheating:** Using severe cheats such as flight, NoClip, auto-mining, etc.
> **Harassment:** Unsolicited harassment of any kind is not allowed.
> **Server Griefing:** Griefing at a large scale that damages the server as a whole. 

### Forgiving - Can result in minor punishment
> **Annoyance:** Repeated behaviour such as forcing a storyline on a non-willing player, or nonsensical trapping.
> **Unwarented Killing:** Ending a player's life in a way that is not justifiable or recoverable.

### Soft - Won't result in major punishment
> **Light Greifing:** Small-scale griefing is allowed but any damage you cause should be justifiable or repairable.
> **Stealing:** Stealing non-valuable items from other players is okay, but so is retaliation.

-# *Any questions? Contact @WaterUnivers for assistance, or turn to any of the @moderator members.*
`.trim();

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handleRulesButton(interaction) {
  try {
    console.log(`[Button] Rules button clicked by ${interaction.user.tag}`);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: RULES_CONTENT,
    });
    console.log(`[Button] ✅ Rules button response sent to ${interaction.user.tag}`);
  } catch (err) {
    console.error("[Button] Rules button error:", err.message);
    throw err;
  }
};
