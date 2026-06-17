const fs   = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../data/featureQueue.json");

// ── Schema ────────────────────────────────────────────────────────────────────
// {
//   current:  { url, submitterId, submitterName, approvedAt } | null,
//   approved: [ { id, url, submitterId, submitterName, approvedAt }, ... ],
//   pending:  [ { id, url, submitterId, submitterName, submittedAt }, ... ],
//   lastRotation: ISO string | null
// }

function load() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      console.debug("[FeatureQueue] Data file not found, using empty state");
      return { current: null, approved: [], pending: [], lastRotation: null };
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    console.debug(`[FeatureQueue] Loaded: ${data.pending?.length || 0} pending, ${data.approved?.length || 0} approved, current: ${data.current ? "yes" : "no"}`);
    return data;
  } catch (err) {
    console.error("[FeatureQueue] Failed to load data:", err.message);
    return { current: null, approved: [], pending: [], lastRotation: null };
  }
}

function save(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    console.debug("[FeatureQueue] Data saved");
  } catch (err) {
    console.error("[FeatureQueue] Failed to save data:", err.message);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get the currently displayed featured image entry (or null). */
function getCurrent() {
  return load().current;
}

/** Add a submission to the pending queue. Returns the new entry. */
function addPending(url, submitterId, submitterName) {
  const data = load();
  const entry = { id: generateId(), url, submitterId, submitterName, submittedAt: new Date().toISOString() };
  data.pending.push(entry);
  save(data);
  console.log(`[FeatureQueue] Added pending submission: ${entry.id} by ${submitterName}`);
  return entry;
}

/** Get all pending (awaiting moderation) submissions. */
function getPending() {
  return load().pending;
}

/** Get all approved (queued but not yet displayed) submissions. */
function getApproved() {
  return load().approved;
}

/**
 * Approve a pending submission by ID.
 * Returns the approved entry or null if not found.
 */
function approve(id) {
  const data = load();
  const idx  = data.pending.findIndex((e) => e.id === id);
  if (idx === -1) {
    console.warn(`[FeatureQueue] Approve failed: ${id} not found`);
    return null;
  }
  const [entry] = data.pending.splice(idx, 1);
  entry.approvedAt = new Date().toISOString();
  data.approved.push(entry);
  save(data);
  console.log(`[FeatureQueue] Approved: ${entry.id} by ${entry.submitterName}`);
  return entry;
}

/**
 * Reject and remove a pending submission by ID.
 * Returns the removed entry or null if not found.
 */
function reject(id) {
  const data = load();
  const idx  = data.pending.findIndex((e) => e.id === id);
  if (idx === -1) {
    console.warn(`[FeatureQueue] Reject failed: ${id} not found`);
    return null;
  }
  const [entry] = data.pending.splice(idx, 1);
  save(data);
  console.log(`[FeatureQueue] Rejected: ${entry.id} by ${entry.submitterName}`);
  return entry;
}

/**
 * Remove an approved (queued) entry by ID.
 * Returns the removed entry or null if not found.
 */
function removeApproved(id) {
  const data = load();
  const idx  = data.approved.findIndex((e) => e.id === id);
  if (idx === -1) {
    console.warn(`[FeatureQueue] Remove failed: ${id} not found`);
    return null;
  }
  const [entry] = data.approved.splice(idx, 1);
  save(data);
  console.log(`[FeatureQueue] Removed: ${entry.id} by ${entry.submitterName}`);
  return entry;
}

/**
 * Advance to the next approved image in the queue.
 * Returns true if the image changed, false if nothing to rotate to.
 */
function rotate() {
  const data = load();
  if (data.approved.length === 0) {
    console.warn("[FeatureQueue] Rotation failed: no approved images");
    return false;
  }
  const previous = data.current?.id || "none";
  data.current     = data.approved.shift();
  data.lastRotation = new Date().toISOString();
  save(data);
  console.log(`[FeatureQueue] Rotated: ${previous} -> ${data.current.id}`);
  return true;
}

/**
 * Check if rotation is due based on FEATURE_ROTATION_DAYS env var.
 * Returns true if it's time to rotate.
 */
function isRotationDue() {
  const data = load();
  if (!data.lastRotation && !data.current) return data.approved.length > 0;
  const days    = parseInt(process.env.FEATURE_ROTATION_DAYS) || 7;
  const lastMs  = data.lastRotation ? new Date(data.lastRotation).getTime() : 0;
  const isDue = Date.now() - lastMs >= days * 24 * 60 * 60 * 1000 && data.approved.length > 0;
  if (isDue) console.debug("[FeatureQueue] Rotation is due");
  return isDue;
}

module.exports = { getCurrent, addPending, getPending, getApproved, approve, reject, removeApproved, rotate, isRotationDue };
