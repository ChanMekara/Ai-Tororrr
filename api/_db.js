// Simple JSON-file based user database
// Stores users with their Telegram info and plan

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'data', 'users.json');
const SESSIONS_FILE = path.join(process.cwd(), 'data', 'sessions.json');

// Ensure data directory exists
const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return { users: {}, sessions: {} }; }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ═══════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════

function getUser(telegramId) {
  const db = readDB();
  return db.users[String(telegramId)] || null;
}

function createOrUpdateUser(userData) {
  const db = readDB();
  const id = String(userData.id);
  const existing = db.users[id] || {};
  
  db.users[id] = {
    ...existing,
    id: userData.id,
    first_name: userData.first_name || existing.first_name || '',
    last_name: userData.last_name || existing.last_name || '',
    username: userData.username || existing.username || '',
    photo_url: userData.photo_url || existing.photo_url || '',
    // Plan: free/plus/premium — defaults to free
    plan: existing.plan || 'free',
    // Usage tracking
    questions_used_week: existing.questions_used_week || 0,
    questions_reset_at: existing.questions_reset_at || Date.now(),
    created_at: existing.created_at || Date.now(),
  };
  
  writeDB(db);
  return db.users[id];
}

function setUserPlan(telegramId, plan) {
  const db = readDB();
  const id = String(telegramId);
  if (!db.users[id]) return null;
  db.users[id].plan = plan;
  writeDB(db);
  return db.users[id];
}

function getPlanLimits(plan) {
  const limits = {
    free: { questions_per_week: 10, can_use_claude: false, models: ['Qwen3.6-35B-A3B', 'DeepSeek-V4-Pro'], label: 'Free' },
    plus: { questions_per_week: 50, can_use_claude: true, models: ['all'], label: 'Plus' },
    premium: { questions_per_week: Infinity, can_use_claude: true, models: ['all'], label: 'Premium' },
  };
  return limits[plan] || limits.free;
}

// ═══════════════════════════════════════════
// AUTH SESSIONS (bot login flow)
// ═══════════════════════════════════════════

function createAuthSession(sessionId, telegramId) {
  const db = readDB();
  db.sessions[sessionId] = {
    telegram_id: telegramId,
    created_at: Date.now(),
    status: 'pending', // pending → confirmed
  };
  writeDB(db);
}

function confirmAuthSession(sessionId) {
  const db = readDB();
  if (!db.sessions[sessionId]) return null;
  db.sessions[sessionId].status = 'confirmed';
  db.sessions[sessionId].confirmed_at = Date.now();
  writeDB(db);
  return db.sessions[sessionId];
}

function getAuthSession(sessionId) {
  const db = readDB();
  return db.sessions[sessionId] || null;
}

function cleanupOldSessions() {
  const db = readDB();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  for (const [sid, session] of Object.entries(db.sessions)) {
    if (now - session.created_at > oneHour) {
      delete db.sessions[sid];
    }
  }
  writeDB(db);
}

// ═══════════════════════════════════════════
// USAGE TRACKING
// ═══════════════════════════════════════════

function getUsage(telegramId) {
  const db = readDB();
  const user = db.users[String(telegramId)];
  if (!user) return null;
  
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - user.questions_reset_at > oneWeek) {
    user.questions_used_week = 0;
    user.questions_reset_at = Date.now();
    writeDB(db);
  }
  
  const plan = getPlanLimits(user.plan);
  return {
    plan: user.plan,
    plan_label: plan.label,
    questions_used: user.questions_used_week,
    questions_limit: plan.questions_per_week,
    questions_remaining: plan.questions_per_week === Infinity ? '∞' : Math.max(0, plan.questions_per_week - user.questions_used_week),
    can_use_claude: plan.can_use_claude,
  };
}

function incrementUsage(telegramId) {
  const db = readDB();
  const user = db.users[String(telegramId)];
  if (!user) return false;
  
  const plan = getPlanLimits(user.plan);
  if (user.questions_used_week >= plan.questions_per_week) return false;
  
  user.questions_used_week++;
  writeDB(db);
  return true;
}

// ═══════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════

function getAllUsers() {
  const db = readDB();
  return Object.values(db.users);
}

const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || '6401807592').split(',').map(s => s.trim());

function isAdmin(telegramId) {
  return ADMIN_IDS.includes(String(telegramId));
}

module.exports = {
  getUser,
  createOrUpdateUser,
  setUserPlan,
  getPlanLimits,
  getUsage,
  incrementUsage,
  createAuthSession,
  confirmAuthSession,
  getAuthSession,
  cleanupOldSessions,
  getAllUsers,
  isAdmin,
  ADMIN_IDS,
};
