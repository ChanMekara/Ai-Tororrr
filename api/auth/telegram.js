// Telegram auth - store user, return with isAdmin flag
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || '6401807592').split(',').map(s => s.trim());

// Simple in-memory user store (use DB for production)
const users = new Map();

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id, first_name, last_name, username, photo_url, hash } = req.body;

    if (!id) return res.status(400).json({ error: 'Missing telegram ID' });

    // Basic verification (in production, verify hash with bot token)
    const isAdmin = ADMIN_IDS.includes(String(id));

    const user = {
      id: String(id),
      name: first_name || 'User',
      last_name: last_name || '',
      username: username || '',
      photo_url: photo_url || '',
      is_admin: isAdmin,
    };

    users.set(String(id), user);

    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
