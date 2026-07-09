const { streamAI } = require('./_ai');
const { requirePlanStream } = require('./_auth');

module.exports = async (req, res) => {
  // CORS
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

    // Check if API key is configured
    if (!process.env.IAMHC_API_KEY) {
      return res.status(500).json({ error: 'IAMHC_API_KEY not configured on server' });
    }

    // Plan enforcement: check usage, model access, and increment quota
    const planCheck = requirePlanStream(req, model);
    if (!planCheck.allowed) {
      // Return as SSE error event so frontend can handle it gracefully
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ error: planCheck.error || 'Plan limit reached. Upgrade via @hismakarabot', done: true, usage: planCheck.usage })}

`);
      res.end();
      return;
    }

    // If Claude not allowed, override to Qwen fallback
    const effectiveModel = planCheck.overrideModel || model;

    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullContent = '';

    const stream = streamAI(messages, effectiveModel);
    for await (const chunk of stream) {
      fullContent += chunk;
      res.write(`data: ${JSON.stringify({ chunk, done: false })}

`);
    }

    res.write(`data: ${JSON.stringify({ chunk: '', done: true, fullContent })}

`);
    res.end();
  } catch (error) {
    console.error('[STREAM ERROR]', error.message);
    // If headers already sent (SSE started), write error as SSE event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message, done: true })}

`);
      res.end();
    } else {
      res.status(500).json({ error: error.message || 'Stream failed' });
    }
  }
};
