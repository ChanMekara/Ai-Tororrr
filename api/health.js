// Health check endpoint — reports which services are configured
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

  // Bot configuration status (used by frontend to diagnose login issues)
  const hasBotToken = !!process.env.BOT_TOKEN;
  const hasWebappUrl = !!process.env.WEBAPP_URL;

  res.json({
    status: 'ok',
    iamhc_configured: hasIamhc,
    claude_configured: hasClaudeBase && claudeKeys.length > 0,
    claude_key_count: claudeKeys.length,
    bot_configured: hasBotToken && hasWebappUrl,
    bot_token_set: hasBotToken,
    bot_webapp_url_set: hasWebappUrl,
    node_version: process.version,
    timestamp: new Date().toISOString()
  });
};
