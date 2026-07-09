const { chatAI } = require('./_ai');
const { requirePlan } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-telegram-id');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, model } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }
    if (!process.env.IAMHC_API_KEY) {
      return res.status(500).json({ error: 'IAMHC_API_KEY not configured on server' });
    }

    // Plan enforcement: check usage, model access, and increment quota
    const planCheck = requirePlan(req, res, model);
    if (!planCheck.allowed) {
      return res.status(429).json(planCheck.errorResponse);
    }

    // If Claude not allowed, override to Qwen fallback
    const effectiveModel = planCheck.overrideModel || model;

    const result = await chatAI(messages, effectiveModel);
    res.json(result);
  } catch (error) {
    console.error('[CHAT ERROR]', error.message);
    res.status(500).json({ error: error.message || 'Chat failed' });
  }
};
