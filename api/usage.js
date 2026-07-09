// Usage endpoint — returns current user's plan and quota info

const { getUsage } = require('./_db');

const CORS_ORIGIN = process.env.WEBAPP_URL || 'https://bayonassistancesd.vercel.app';

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-telegram-id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) {
      return res.status(401).json({ error: 'Authentication required. Missing x-telegram-id header.' });
    }

    const usage = getUsage(telegramId);
    if (!usage) {
      return res.status(401).json({ error: 'User not found. Please connect your account via @hismakarabot' });
    }

    res.json(usage);
  } catch (error) {
    console.error('[USAGE ERROR]', error.message);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
};
