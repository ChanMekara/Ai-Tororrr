// Auth + Plan Enforcement Middleware
// Checks Telegram user ID from headers and enforces plan limits

const { getUsage, incrementUsage, getPlanLimits, isAdmin } = require('./_db');
const { isClaudeModel } = require('./_ai');

// ═══════════════════════════════════════════
// TELEGRAM ID EXTRACTION
// ═══════════════════════════════════════════

function getTelegramId(req) {
  return req.headers['x-telegram-id'] || null;
}

// ═══════════════════════════════════════════
// PLAN ACCESS CHECKING
// ═══════════════════════════════════════════

/**
 * Check if user can make a request (has remaining quota, can use model)
 * Returns: { allowed: true } or { allowed: false, reason: '...', usage: {...} }
 */
function checkPlanAccess(telegramId, requestedModel) {
  // Get current usage data
  const usage = getUsage(telegramId);
  if (!usage) {
    return { allowed: false, reason: 'User not found. Please connect your account via @hismakarabot', usage: null };
  }

  // Check if requested model is Claude and plan allows it
  if (isClaudeModel(requestedModel) && !usage.can_use_claude) {
    return {
      allowed: false,
      reason: 'Claude models require Plus or Premium plan. Upgrade via @hismakarabot',
      usage,
      overrideModel: 'Qwen3.6-35B-A3B',
    };
  }

  return { allowed: true, usage };
}

/**
 * Increment usage and check quota
 * Returns: { allowed: true } or { allowed: false, reason: '...', usage: {...} }
 */
function checkAndIncrementUsage(telegramId) {
  const usage = getUsage(telegramId);
  if (!usage) {
    return { allowed: false, reason: 'User not found. Please connect your account via @hismakarabot', usage: null };
  }

  // Try to increment usage — returns false if limit reached
  const incremented = incrementUsage(telegramId);
  if (!incremented) {
    return {
      allowed: false,
      reason: 'Weekly limit reached. Upgrade your plan via @hismakarabot',
      usage,
    };
  }

  return { allowed: true, usage };
}

// ═══════════════════════════════════════════
// MIDDLEWARE WRAPPER
// ═══════════════════════════════════════════

/**
 * Middleware wrapper for regular endpoints (chat, vision)
 * Returns: { allowed, usage, errorResponse }
 * If allowed is false, errorResponse is a ready-to-send object
 */
function requirePlan(req, res, requestedModel) {
  const telegramId = getTelegramId(req);

  if (!telegramId) {
    const errorResponse = { error: 'Authentication required. Please connect your account via @hismakarabot' };
    return { allowed: false, usage: null, errorResponse };
  }

  // First check plan access (model restrictions)
  const accessCheck = checkPlanAccess(telegramId, requestedModel);
  if (!accessCheck.allowed) {
    // If it's a Claude restriction, suggest override instead of blocking
    if (accessCheck.overrideModel) {
      // Return allowed=true but with override model — caller should use overrideModel
      return { allowed: true, usage: accessCheck.usage, errorResponse: null, overrideModel: accessCheck.overrideModel };
    }
    const errorResponse = { error: accessCheck.reason, usage: accessCheck.usage };
    return { allowed: false, usage: accessCheck.usage, errorResponse };
  }

  // Then check and increment usage (quota)
  const usageCheck = checkAndIncrementUsage(telegramId);
  if (!usageCheck.allowed) {
    const errorResponse = { error: usageCheck.reason, usage: usageCheck.usage };
    return { allowed: false, usage: usageCheck.usage, errorResponse };
  }

  return { allowed: true, usage: usageCheck.usage, errorResponse: null };
}

/**
 * Middleware wrapper for SSE stream endpoint
 * Returns: { allowed, usage, overrideModel }
 * If allowed is false, caller should send SSE error and end
 */
function requirePlanStream(req, requestedModel) {
  const telegramId = getTelegramId(req);

  if (!telegramId) {
    return {
      allowed: false,
      usage: null,
      error: 'Authentication required. Please connect your account via @hismakarabot',
    };
  }

  // Check plan access (model restrictions)
  const accessCheck = checkPlanAccess(telegramId, requestedModel);
  if (!accessCheck.allowed) {
    if (accessCheck.overrideModel) {
      // Claude not allowed — return with override model
      return { allowed: true, usage: accessCheck.usage, overrideModel: accessCheck.overrideModel };
    }
    return { allowed: false, usage: accessCheck.usage, error: accessCheck.reason };
  }

  // Check and increment usage (quota)
  const usageCheck = checkAndIncrementUsage(telegramId);
  if (!usageCheck.allowed) {
    return { allowed: false, usage: usageCheck.usage, error: usageCheck.reason };
  }

  return { allowed: true, usage: usageCheck.usage, overrideModel: null };
}

module.exports = {
  getTelegramId,
  checkPlanAccess,
  checkAndIncrementUsage,
  requirePlan,
  requirePlanStream,
  isAdmin,
};
