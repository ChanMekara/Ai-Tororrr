// Telegram Login Widget callback endpoint
// Telegram sends user data as QUERY PARAMETERS in a GET request
// e.g. GET /api/auth/telegram-callback?id=123&first_name=John&hash=abc

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    // Parse query parameters from URL
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const params = url.searchParams;
    
    const user = {
      id: params.get('id'),
      first_name: params.get('first_name'),
      last_name: params.get('last_name'),
      username: params.get('username'),
      photo_url: params.get('photo_url'),
      auth_date: params.get('auth_date'),
      hash: params.get('hash'),
    };
    
    // Validate required fields
    if (!user.id) {
      console.error('[Telegram Callback] Missing user.id in query params. URL:', req.url);
      return res.redirect(302, '/#/?login_error=missing_id');
    }

    // Encode user data for URL
    const userParam = encodeURIComponent(JSON.stringify(user));
    
    // Redirect back to frontend with auth data (HashRouter format: /#/?tg_auth=...)
    res.redirect(302, `/#/?tg_auth=${userParam}`);
  } catch (error) {
    console.error('[Telegram Callback Error]', error);
    res.redirect(302, '/#/?login_error=exception');
  }
};
