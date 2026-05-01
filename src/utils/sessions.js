const crypto = require("crypto");

// In-memory store: state token → { discordUserId, discordChannelId, timestamp }
// This is intentionally ephemeral – tokens expire after 10 minutes.
const pendingSessions = new Map();
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Create a new OAuth state token tied to a Discord user.
 */
function createSession(discordUserId, discordChannelId) {
  // Clean up expired sessions
  const now = Date.now();
  for (const [token, session] of pendingSessions) {
    if (now - session.timestamp > TOKEN_TTL_MS) pendingSessions.delete(token);
  }

  const state = crypto.randomBytes(24).toString("hex");
  pendingSessions.set(state, {
    discordUserId,
    discordChannelId,
    timestamp: now,
  });
  return state;
}

/**
 * Retrieve and consume a session by state token.
 * Returns the session data or null if invalid/expired.
 */
function consumeSession(state) {
  const session = pendingSessions.get(state);
  if (!session) return null;
  if (Date.now() - session.timestamp > TOKEN_TTL_MS) {
    pendingSessions.delete(state);
    return null;
  }
  pendingSessions.delete(state);
  return session;
}

module.exports = { createSession, consumeSession };
