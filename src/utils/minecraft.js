const fs = require("fs");
const path = require("path");
const { status } = require("minecraft-server-util");

/**
 * Ping the local Minecraft server to get live player count + MOTD.
 * Falls back gracefully if the server is offline.
 */
async function getServerStatus() {
  try {
    const result = await status(
      process.env.MC_SERVER_HOST || "localhost",
      parseInt(process.env.MC_SERVER_PORT) || 25565,
      { timeout: 3000 }
    );
    return {
      online: true,
      players: result.players.online,
      maxPlayers: result.players.max,
      version: result.version.name || process.env.SERVER_VERSION,
      motd: result.motd?.clean || "",
    };
  } catch {
    return {
      online: false,
      players: 0,
      maxPlayers: 0,
      version: process.env.SERVER_VERSION || "Unknown",
      motd: "",
    };
  }
}

/**
 * Read the whitelist.json file and return its parsed contents.
 * Returns an empty array if the file doesn't exist yet.
 */
function readWhitelist() {
  const wlPath = process.env.WHITELIST_PATH;
  if (!wlPath || !fs.existsSync(wlPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(wlPath, "utf8"));
  } catch {
    return [];
  }
}

/**
 * Write updated whitelist array back to whitelist.json.
 */
function writeWhitelist(entries) {
  const wlPath = process.env.WHITELIST_PATH;
  if (!wlPath) throw new Error("WHITELIST_PATH is not set in .env");
  fs.writeFileSync(wlPath, JSON.stringify(entries, null, 2), "utf8");
}

/**
 * Add a player to whitelist.json.
 * Prevents duplicates by checking UUID.
 * Returns true if added, false if already present.
 */
function addToWhitelist(entry) {
  const list = readWhitelist();
  const exists = list.some((e) => e.uuid === entry.uuid);
  if (exists) return false;
  list.push(entry);
  writeWhitelist(list);
  return true;
}

/**
 * Scan /assets/packs for downloadable files.
 * Returns array of { name, filename } objects.
 */
function getAssetPacks() {
  const packsDir = path.join(__dirname, "../../assets/packs");
  if (!fs.existsSync(packsDir)) return [];
  return fs.readdirSync(packsDir)
    .filter((f) => !f.startsWith("."))
    .map((filename) => ({ filename, name: path.parse(filename).name }));
}

module.exports = { getServerStatus, readWhitelist, writeWhitelist, addToWhitelist, getAssetPacks };
