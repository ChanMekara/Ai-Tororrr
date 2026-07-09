const { visionAI } = require('./_ai');
const { requirePlan } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-telegram-id');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, question } = req.body;
    if (!image) return res.status(400).json({ error: 'Image required' });
    if (!process.env.IAMHC_API_KEY) {
      return res.status(500).json({ error: 'IAMHC_API_KEY not configured on server' });
    }

    // Plan enforcement: check usage and increment quota
    // Vision always uses the fallback model, so no model override needed
    const planCheck = requirePlan(req, res, null);
    if (!planCheck.allowed) {
      return res.status(429).json(planCheck.errorResponse);
    }

    const result = await visionAI(image, question);
    res.json(result);
  } catch (error) {
    console.error('[VISION ERROR]', error.message);
    res.status(500).json({ error: error.message || 'Vision failed' });
  }
};
