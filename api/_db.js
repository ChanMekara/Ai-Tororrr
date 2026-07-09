// In-memory user database
// Uses module-level storage (persists within a Vercel container, resets on cold start)
// For production with many users, migrate to Redis or MongoDB

// ═══════════════════════════════════════════
// IN-MEMORY STORE
// ═══════════════════════════════════════════

const memoryDB = {
  users: {},
  sessions: {},
};

// ═══════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════

function getUser(telegramId) {
  return memoryDB.users[String(telegramId)] || null;
}

function createOrUpdateUser(userData) {
  const id = String(userData.id);
  const existing = memoryDB.users[id] || {};

  memoryDB.users[id] = {
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

  return memoryDB.users[id];
}

function setUserPlan(telegramId, plan) {
  const id = String(telegramId);
  if (!memoryDB.users[id]) return null;
  memoryDB.users[id].plan = plan;
  return memoryDB.users[id];
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
  memoryDB.sessions[sessionId] = {
    telegram_id: telegramId,
    created_at: Date.now(),
    status: 'pending',
  };
}

function confirmAuthSession(sessionId) {
  if (!memoryDB.sessions[sessionId]) return null;
  memoryDB.sessions[sessionId].status = 'confirmed';
  memoryDB.sessions[sessionId].confirmed_at = Date.now();
  return memoryDB.sessions[sessionId];
}

function getAuthSession(sessionId) {
  return memoryDB.sessions[sessionId] || null;
}

function cleanupOldSessions() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  for (const [sid, session] of Object.entries(memoryDB.sessions)) {
    if (now - session.created_at > oneHour) {
      delete memoryDB.sessions[sid];
    }
  }
}

// ═══════════════════════════════════════════
// USAGE TRACKING
// ═══════════════════════════════════════════

function getUsage(telegramId) {
  const user = memoryDB.users[String(telegramId)];
  if (!user) return null;

  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - user.questions_reset_at > oneWeek) {
    user.questions_used_week = 0;
    user.questions_reset_at = Date.now();
  }

  const plan = getPlanLimits(user.plan);
  return {
    plan: user.plan,
    plan_label: plan.label,
    questions_used: user.questions_used_week,
    questions_limit: plan.questions_per_week,
    questions_remaining: plan.questions_per_week === Infinity ? '\u221e' : Math.max(0, plan.questions_per_week - user.questions_used_week),
    can_use_claude: plan.can_use_claude,
  };
}

function incrementUsage(telegramId) {
  const user = memoryDB.users[String(telegramId)];
  if (!user) return false;

  const plan = getPlanLimits(user.plan);
  if (user.questions_used_week >= plan.questions_per_week) return false;

  user.questions_used_week++;
  return true;
}

// ═══════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════

function getAllUsers() {
  return Object.values(memoryDB.users);
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
