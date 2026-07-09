// Health check endpoint
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-telegram-id');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const hasIamhc = !!process.env.IAMHC_API_KEY;
  const hasClaudeBase = !!process.env.CLAUDE_BASE_URL;
  const claudeKeys = [];
  for (let i = 1; i <= 10; i++) {
    if (process.env[`CLAUDE_KEY_${i}`]) claudeKeys.push(`key_${i}`);
  }
  
  res.json({
    status: 'ok',
    iamhc_configured: hasIamhc,
    claude_configured: hasClaudeBase && claudeKeys.length > 0,
    claude_key_count: claudeKeys.length,
    node_version: process.version,
    timestamp: new Date().toISOString()
  });
};
