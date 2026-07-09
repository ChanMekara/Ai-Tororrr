// Check auth session status (polled by frontend)
// Session is created when user clicks /start, confirmed when user clicks "Connect Account"

const { getAuthSession, getUser, cleanupOldSessions, getUsage } = require('../../api/_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-telegram-id');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const sessionId = url.searchParams.get('session');
    
    if (!sessionId) return res.status(400).json({ error: 'Missing session' });
    
    cleanupOldSessions();
    
    const session = getAuthSession(sessionId);
    if (!session) return res.json({ status: 'not_found' });
    
    if (session.status === 'confirmed') {
      const user = getUser(session.telegram_id);
      const usage = getUsage(session.telegram_id);
      return res.json({ status: 'confirmed', user, usage });
    }
    
    return res.json({ status: 'pending' });
  } catch (error) {
    console.error('[Auth Check Error]', error);
    res.status(500).json({ error: error.message });
  }
};
