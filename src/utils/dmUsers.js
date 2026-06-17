const fs   = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../data/dmUsers.json");

// Schema: { users: [ { userId, dmMessageId, addedAt } ] }

function load() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      console.debug("[DmUsers] Data file not found, using empty list");
      return { users: [] };
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    console.debug(`[DmUsers] Loaded ${data.users?.length || 0} users`);
    return data;
  } catch (err) {
    console.error("[DmUsers] Failed to load data:", err.message);
    return { users: [] };
  }
}

function save(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    console.debug(`[DmUsers] Saved ${data.users?.length || 0} users`);
  } catch (err) {
    console.error("[DmUsers] Failed to save data:", err.message);
  }
}

/** Get all DM user entries. */
function getAll() {
  return load().users;
}

/** Check if a user is on the list. */
function has(userId) {
  return load().users.some((u) => u.userId === userId);
}

/**
 * Add a user. Stores the ID of the live embed message in their DMs
 * so we can edit it later.
 */
function add(userId, dmMessageId) {
  const data = load();
  if (data.users.some((u) => u.userId === userId)) {
    console.warn(`[DmUsers] User ${userId} already exists`);
    return false;
  }
  data.users.push({ userId, dmMessageId, addedAt: new Date().toISOString() });
  save(data);
  console.log(`[DmUsers] Added user ${userId}`);
  return true;
}

/** Update the stored DM message ID for a user (e.g. after re-sending). */
function updateMessageId(userId, dmMessageId) {
  const data = load();
  const user = data.users.find((u) => u.userId === userId);
  if (!user) {
    console.warn(`[DmUsers] User ${userId} not found for message update`);
    return false;
  }
  user.dmMessageId = dmMessageId;
  save(data);
  console.log(`[DmUsers] Updated message ID for ${userId}`);
  return true;
}

/** Remove a user from the list. Returns the removed entry or null. */
function remove(userId) {
  const data  = load();
  const idx   = data.users.findIndex((u) => u.userId === userId);
  if (idx === -1) {
    console.warn(`[DmUsers] User ${userId} not found for removal`);
    return null;
  }
  const [entry] = data.users.splice(idx, 1);
  save(data);
  console.log(`[DmUsers] Removed user ${userId}`);
  return entry;
}

module.exports = { getAll, has, add, updateMessageId, remove };
