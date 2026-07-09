// Telegram Bot Handler
// Uses webhook mode (compatible with Vercel serverless)
// Handles: login, plan management, admin commands

const { createOrUpdateUser, setUserPlan, getUsage, getAllUsers, isAdmin, createAuthSession, confirmAuthSession } = require('./_db');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://bayonassistancesd.vercel.app';

// ═══════════════════════════════════════════
// BOT API HELPERS
// ═══════════════════════════════════════════

async function tgApi(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ═══════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════

async function handleStart(chatId, user) {
  const welcome = `👋 Welcome to **Bayon AI Tutor**!

I'm your AI study assistant for Cambodian students. I can help with:
📐 Mathematics
⚡ Physics  
🧪 Chemistry
🌿 Biology

Use the buttons below to get started!`;

  await tgApi('sendMessage', {
    chat_id: chatId,
    text: welcome,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔗 Connect Account', callback_data: 'connect_account' }],
        [{ text: '⬆️ Upgrade Plan', callback_data: 'show_plans' }],
        [{ text: '📊 My Status', callback_data: 'my_status' }],
      ],
    },
  });
}

async function handleConnectAccount(chatId, user) {
  // Generate a session ID
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  createAuthSession(sessionId, user.id);
  createOrUpdateUser(user);

  // Confirm session immediately — the user clicked the button, so they're authenticated
  confirmAuthSession(sessionId);

  const connectUrl = `${WEBAPP_URL}/#/auth/${sessionId}`;

  await tgApi('sendMessage', {
    chat_id: chatId,
    text: `✅ **Account connected!**

Click the button below to open the web app. You'll be automatically logged in.`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Open Web App', web_app: { url: connectUrl } }],
      ],
    },
  });
}

async function handleShowPlans(chatId, telegramId) {
  const plans = `**📋 Available Plans:**

🆓 **Free** — 10 questions/week
   Basic AI (Qwen)

⭐ **Plus** — 50 questions/week  
   Access to Claude models

👑 **Premium** — Unlimited
   All models + priority

Contact admin to upgrade your plan!`;

  await tgApi('sendMessage', {
    chat_id: chatId,
    text: plans,
    parse_mode: 'Markdown',
  });
}

async function handleMyStatus(chatId, telegramId) {
  const usage = getUsage(telegramId);
  if (!usage) {
    await tgApi('sendMessage', { chat_id: chatId, text: '❌ Please /start first to connect your account.' });
    return;
  }
  
  const status = `**📊 Your Status:**

Plan: **${usage.plan_label}**
Questions used: **${usage.questions_used} / ${usage.questions_limit}**
Remaining: **${usage.questions_remaining}**
Claude access: **${usage.can_use_claude ? '✅' : '❌'}**`;

  await tgApi('sendMessage', {
    chat_id: chatId,
    text: status,
    parse_mode: 'Markdown',
  });
}

async function handleAdminSetPlan(chatId, telegramId, text) {
  if (!isAdmin(telegramId)) {
    await tgApi('sendMessage', { chat_id: chatId, text: '❌ Admin only.' });
    return;
  }
  
  // Parse: /setplan @username premium  or  /setplan 6401807592 premium
  const parts = text.split(' ');
  if (parts.length < 3) {
    await tgApi('sendMessage', { chat_id: chatId, text: 'Usage: /setplan @username premium\nOr: /setplan 6401807592 plus' });
    return;
  }
  
  const target = parts[1].replace('@', '');
  const plan = parts[2].toLowerCase();
  
  if (!['free', 'plus', 'premium'].includes(plan)) {
    await tgApi('sendMessage', { chat_id: chatId, text: '❌ Plan must be: free, plus, or premium' });
    return;
  }
  
  // Find user by username or id
  const users = getAllUsers();
  let targetUser = users.find(u => u.username === target || String(u.id) === target);
  
  if (!targetUser) {
    await tgApi('sendMessage', { chat_id: chatId, text: `❌ User ${target} not found.` });
    return;
  }
  
  setUserPlan(targetUser.id, plan);
  await tgApi('sendMessage', {
    chat_id: chatId,
    text: `✅ Set ${targetUser.first_name} (@${targetUser.username}) to **${plan}**`,
    parse_mode: 'Markdown',
  });
  
  // Notify user
  await tgApi('sendMessage', {
    chat_id: targetUser.id,
    text: `🎉 Your plan has been upgraded to **${plan}**!\n\nEnjoy your enhanced AI experience.`,
    parse_mode: 'Markdown',
  });
}

async function handleAdminUsers(chatId, telegramId) {
  if (!isAdmin(telegramId)) {
    await tgApi('sendMessage', { chat_id: chatId, text: '❌ Admin only.' });
    return;
  }
  
  const users = getAllUsers();
  const total = users.length;
  const free = users.filter(u => u.plan === 'free').length;
  const plus = users.filter(u => u.plan === 'plus').length;
  const premium = users.filter(u => u.plan === 'premium').length;
  
  let list = `**👥 Users (${total}):**\n\n`;
  users.slice(0, 50).forEach(u => {
    list += `• ${u.first_name} — ${u.plan}\n`;
  });
  
  list += `\nFree: ${free} | Plus: ${plus} | Premium: ${premium}`;
  
  await tgApi('sendMessage', { chat_id: chatId, text: list, parse_mode: 'Markdown' });
}

// ═══════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ═══════════════════════════════════════════

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-telegram-id');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  
  if (!BOT_TOKEN) {
    return res.status(500).json({ error: 'BOT_TOKEN not configured' });
  }
  
  const update = req.body;
  
  try {
    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const cq = update.callback_query;
      const user = cq.from;
      
      if (cq.data === 'connect_account') {
        await handleConnectAccount(user.id, user);
        await tgApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'Account connected!' });
      } else if (cq.data === 'show_plans') {
        await handleShowPlans(user.id, user.id);
        await tgApi('answerCallbackQuery', { callback_query_id: cq.id });
      } else if (cq.data === 'my_status') {
        await handleMyStatus(user.id, user.id);
        await tgApi('answerCallbackQuery', { callback_query_id: cq.id });
      }
      
      return res.status(200).json({ ok: true });
    }
    
    // Handle messages (commands)
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const user = msg.from;
      const text = msg.text || '';
      
      // Create/update user on any interaction
      createOrUpdateUser(user);
      
      if (text.startsWith('/start')) {
        await handleStart(chatId, user);
      } else if (text.startsWith('/upgrade')) {
        await handleShowPlans(chatId, user.id);
      } else if (text.startsWith('/status')) {
        await handleMyStatus(chatId, user.id);
      } else if (text.startsWith('/setplan')) {
        await handleAdminSetPlan(chatId, user.id, text);
      } else if (text.startsWith('/users')) {
        await handleAdminUsers(chatId, user.id);
      } else if (text.startsWith('/help')) {
        await tgApi('sendMessage', {
          chat_id: chatId,
          text: '**Commands:**\n/start — Connect account\n/status — Check plan\n/upgrade — View plans\n/help — This message',
          parse_mode: 'Markdown',
        });
      }
      
      return res.status(200).json({ ok: true });
    }
    
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Bot Error]', error);
    res.status(200).json({ ok: false, error: error.message });
  }
};
