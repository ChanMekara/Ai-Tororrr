const API_BASE = '';

// Get Telegram user from localStorage
function _getTgUser() {
  try { return JSON.parse(localStorage.getItem('tg_user') || 'null'); } catch { return null; }
}

function getHeaders() {
  const user = _getTgUser();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user?.id) headers['x-telegram-id'] = String(user.id);
  return headers;
}

export async function sendMessage(
  messages: Array<{ role: string; content: string }>,
  model?: string
) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ messages, model }),
  });
  if (!res.ok) throw new Error('Chat failed');
  return res.json();
}

export async function* streamMessage(
  messages: Array<{ role: string; content: string }>,
  model?: string
) {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ messages, model }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No reader');

  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.chunk) yield parsed.chunk;
          if (parsed.done) return;
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function sendVision(image: string, question?: string) {
  const res = await fetch(`${API_BASE}/api/vision`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ image, question }),
  });
  if (!res.ok) throw new Error('Vision failed');
  return res.json();
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/api/models`, { headers: getHeaders() });
  if (!res.ok) return { models: [], subjects: [] };
  return res.json();
}

// Telegram Login callback handler
export function handleTelegramAuth(user: any) {
  if (user?.id) {
    localStorage.setItem('tg_user', JSON.stringify(user));
    return user;
  }
  return null;
}

export function logoutTelegram() {
  localStorage.removeItem('tg_user');
}

export function getTelegramUser() {
  try { return JSON.parse(localStorage.getItem('tg_user') || 'null'); } catch { return null; }
}

export function isAdmin() {
  const user = getTelegramUser();
  return user?.id === 6401807592;
}

// ── Plan Usage ──────────────────────────────

export async function fetchUsage() {
  const user = getTelegramUser();
  if (!user?.id) return null;
  const res = await fetch(`${API_BASE}/api/usage`, {
    headers: { 'x-telegram-id': String(user.id) },
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Bot-based Login ─────────────────────────

export function startBotLogin(): string {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('pending_auth_session', sessionId);
  const botLink = `https://t.me/hismakarabot?start=${sessionId}`;
  window.open(botLink, '_blank');
  return sessionId;
}

export async function checkAuthSession(
  sessionId: string
): Promise<{ status: string; user?: unknown; usage?: unknown } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/check?session=${sessionId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function confirmAuthFromSession(userData: unknown, usageData?: unknown) {
  const u = userData as { id?: number } | null;
  if (u?.id) {
    localStorage.setItem('tg_user', JSON.stringify(userData));
    localStorage.removeItem('pending_auth_session');
    return { user: userData, usage: usageData };
  }
  return null;
}

export function getAuthState() {
  const user = getTelegramUser();
  const sessionId = localStorage.getItem('pending_auth_session');
  return { user, sessionId, isLoggedIn: !!user?.id };
}
