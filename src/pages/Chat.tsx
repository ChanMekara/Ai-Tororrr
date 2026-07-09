import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Square, ImageIcon, Settings, Trash2, Plus,
  Copy, Check, ThumbsUp, ThumbsDown, Share2, X,
  MessageSquare, Sparkles, Sun, Moon,
  Calculator, ChevronLeft,
  Bot, ExternalLink, Loader2, Crown, Star, Zap,
} from 'lucide-react';
import {
  streamMessage, sendVision, getTelegramUser, logoutTelegram,
  isAdmin, handleTelegramAuth,
  fetchUsage, startBotLogin, checkAuthSession, confirmAuthFromSession,
} from '@/services/api';
import { formatMath } from '@/services/formatter';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  timestamp: number;
  liked?: boolean | null;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
const genId = () => Math.random().toString(36).slice(2, 10);

const defaultSystemPrompt = `អ្នកជា IMKHMER TUTOR ជំនួយការសិក្សា AI ឆ្លាតវៃសម្រាប់សិស្សកម្ពុជា។ ឆ្លើយត្រង់ point ច្បាស់លាស់ ប្រើ Unicode គណិត x²√∫∑π ពន្យល់ជំហានៗ ចាប់ពីងាយទៅល្អិត។ រូបមន្តស្តង់ដារ៖ Z_L=Lω Z_C=1/(Cω) មិនមែន X_L X_C។ លើកទឹកចិត្តសិស្សជានិច្ច។`;

// Smart model router for "Bayon"
function bayonRouter(userMessage: string): string {
  const m = userMessage.toLowerCase();
  const mathKeywords = ['គណិត', 'ដេរីវេ', 'អាំងតេក្រាល', 'lim', 'integral', 'derivative', 'equation', 'calculus', 'geometry', 'បញ្ហា'];
  const complexKeywords = ['វិភាគ', 'analyze', 'discuss', 'explain', 'compare', 'contrast'];
  const scienceKeywords = ['រូបវិទ្យា', 'គីមី', 'ជីវ', 'physics', 'chemistry', 'biology', 'newton', 'ohm', 'circuit'];
  const codeKeywords = ['code', 'programming', 'javascript', 'python', 'algorithm', 'កូដ'];
  if (mathKeywords.some(k => m.includes(k))) return 'claudeai/nghi/claude-opus-4.8';
  if (complexKeywords.some(k => m.includes(k))) return 'claudeai/nghi/claude-opus-4.8-thinking';
  if (scienceKeywords.some(k => m.includes(k))) return 'claudeai/nghi/claude-opus-4.7';
  if (codeKeywords.some(k => m.includes(k))) return 'claudeai/nghi/claude-opus-4.7-thinking';
  return 'Qwen3.6-35B-A3B';
}

// ═══════════════════════════════════════════
// LOCALSTORAGE
// ═══════════════════════════════════════════
function loadSessions(): ChatSession[] {
  try { return JSON.parse(localStorage.getItem('bayon_sessions') || '[]'); } catch { return []; }
}
function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem('bayon_sessions', JSON.stringify(sessions));
}
function loadSettings() {
  return {
    theme: (localStorage.getItem('bayon_theme') || 'dark') as 'light' | 'dark',
    language: (localStorage.getItem('bayon_lang') || 'km') as 'km' | 'en',
    systemPrompt: localStorage.getItem('bayon_prompt') || defaultSystemPrompt,
    bayonEnabled: localStorage.getItem('bayon_enabled') !== 'false',
  };
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
export default function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeId, setActiveId] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [showMathKb, setShowMathKb] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [tgUser, setTgUser] = useState<Record<string, unknown> | null>(getTelegramUser());
  const [showLoginModal, setShowLoginModal] = useState(false);
  // ── Bot auth + usage state ──
  const [usage, setUsage] = useState<{ plan?: string; questions_used?: number; questions_limit?: number; label?: string } | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find(s => s.id === activeId);

  // Check for Telegram auth callback in URL (from data-auth-url redirect)
  // With HashRouter, auth data is in: /#/?tg_auth={...}
  useEffect(() => {
    const hash = window.location.hash; // e.g. "#/?tg_auth=%7B...%7D"
    const match = hash.match(/tg_auth=([^&]+)/);
    if (match) {
      try {
        const user = JSON.parse(decodeURIComponent(match[1]));
        handleTelegramAuth(user);
        setTgUser(user);
        // Clean up URL - remove tg_auth from hash
        window.history.replaceState({}, '', window.location.pathname + window.location.hash.replace(/[?&]tg_auth=[^&]+/, '').replace(/\?&/, '?').replace(/\?$/, ''));
      } catch (e) {
        console.error('Failed to parse Telegram auth data:', e);
      }
    }
  }, []);

  // Check for bot auth callback: #/auth/sess_xxx
  useEffect(() => {
    const hash = window.location.hash; // e.g. "#/auth/sess_abc123"
    const match = hash.match(/#\/auth\/([a-zA-Z0-9_]+)/);
    if (match) {
      const sessionId = match[1];
      setPendingSessionId(sessionId);
      setShowLoginModal(true);
      window.history.replaceState({}, '', window.location.pathname + '#/');
    }
  }, []);

  // Fetch usage when user logs in
  useEffect(() => {
    if (tgUser?.id) {
      fetchUsage().then(data => { if (data) setUsage(data); });
    } else {
      setUsage(null);
    }
  }, [tgUser?.id]);

  // Poll auth session when waiting for confirmation
  useEffect(() => {
    if (!pendingSessionId || !isPolling) return;
    const interval = setInterval(async () => {
      const result = await checkAuthSession(pendingSessionId);
      if (result?.status === 'confirmed' && result.user) {
        const confirmed = confirmAuthFromSession(result.user, result.usage);
        if (confirmed) {
          setTgUser(confirmed.user as Record<string, unknown>);
          setUsage(confirmed.usage as typeof usage);
          setIsPolling(false);
          setPendingSessionId(null);
          setShowLoginModal(false);
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingSessionId, isPolling]);

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeSession?.messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // New chat
  const newChat = useCallback(() => {
    const s: ChatSession = { id: genId(), title: 'New Chat', messages: [], createdAt: Date.now() };
    setSessions(prev => { const updated = [s, ...prev].slice(0, 50); saveSessions(updated); return updated; });
    setActiveId(s.id);
    setSidebarOpen(false);
  }, []);

  // Init first chat
  useEffect(() => { if (!activeId) newChat(); }, [activeId, newChat]);

  // Send
  const send = useCallback(async () => {
    if (!input.trim() || isLoading || !activeId) return;
    const userMsg: Message = { id: genId(), role: 'user', content: input.trim(), timestamp: Date.now() };
    const msgs = [...(activeSession?.messages || []), userMsg];
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeId ? { ...s, messages: msgs } : s);
      saveSessions(updated);
      return updated;
    });
    setInput('');
    setIsLoading(true);

    try {
      const model = settings.bayonEnabled ? bayonRouter(input) : 'Qwen3.6-35B-A3B';
      const history = [{ role: 'system', content: settings.systemPrompt },
        ...msgs.map(m => ({ role: m.role, content: m.content }))];
      const aiMsgId = genId();
      let fullContent = '';

      const stream = streamMessage(history, model);
      for await (const chunk of stream) {
        fullContent += chunk;
        setSessions(prev => {
          const updated = prev.map(s => {
            if (s.id !== activeId) return s;
            const existing = s.messages.find(m => m.id === aiMsgId);
            if (existing) {
              return { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, content: fullContent } : m) };
            }
            return { ...s, messages: [...s.messages, { id: aiMsgId, role: 'assistant', content: fullContent, model, timestamp: Date.now() }] };
          });
          saveSessions(updated);
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errMsg = err?.message || 'Unknown error';
      const displayErr = settings.language === 'km'
        ? `⚠️ មានបញ្ហា: ${errMsg.slice(0, 100)}`
        : `⚠️ Error: ${errMsg.slice(0, 100)}`;
      setSessions(prev => {
        const updated = prev.map(s => s.id === activeId ? {
          ...s, messages: [...s.messages, { id: genId(), role: 'assistant', content: displayErr, timestamp: Date.now() }]
        } : s);
        saveSessions(updated);
        return updated;
      });
    } finally {
      setIsLoading(false);
      // Refresh usage after each message
      if (tgUser?.id) {
        fetchUsage().then(data => { if (data) setUsage(data); });
      }
    }
  }, [input, isLoading, activeId, activeSession, settings, tgUser?.id]);

  // Send with photo
  const sendPhoto = useCallback(async () => {
    if (!imgPreview || !input.trim() || !activeId) return;
    const userMsg: Message = { id: genId(), role: 'user', content: '[📷 ' + input.trim() + ']', timestamp: Date.now() };
    const msgs = [...(activeSession?.messages || []), userMsg];
    setSessions(prev => { const u = prev.map(s => s.id === activeId ? { ...s, messages: msgs } : s); saveSessions(u); return u; });
    setInput('');
    setIsLoading(true);
    try {
      const result = await sendVision(imgPreview, input.trim());
      setSessions(prev => {
        const u = prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, { id: genId(), role: 'assistant', content: formatMath(result.content), timestamp: Date.now() }] } : s);
        saveSessions(u);
        return u;
      });
    } catch (err: any) {
      setSessions(prev => {
        const u = prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, { id: genId(), role: 'assistant', content: `⚠️ ${err.message || 'Vision failed'}`, timestamp: Date.now() }] } : s);
        saveSessions(u);
        return u;
      });
    } finally { setIsLoading(false); setImgPreview(null); }
  }, [imgPreview, input, activeId, activeSession]);

  // Copy message
  const copyMsg = async (msg: Message) => {
    await navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Delete session
  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => { const u = prev.filter(s => s.id !== id); saveSessions(u); return u; });
    if (activeId === id) { const next = sessions.find(s => s.id !== id); setActiveId(next?.id || ''); }
  };

  // Export
  const exportChat = () => {
    if (!activeSession) return;
    const md = `# ${activeSession.title}\n\n` + activeSession.messages.map(m =>
      `**${m.role === 'user' ? 'You' : 'Bayon'}:**\n${m.content}\n`).join('\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bayon-${activeSession.title.slice(0, 20)}.md`; a.click();
  };

  // Math symbols
  const mathSymbols = ['x²', 'x₂', '√', '∛', '∑', '∫', '∂', 'π', 'θ', 'α', 'β', 'γ', 'Δ', '∞', '±', '×', '÷', '≤', '≥', '≠', '≈', '→', '←', '∈', '∉', '∩', '∪', '°', '′', '″', 'eˣ', 'ln', 'sin', 'cos', 'tan', 'lim', '(', ')', '[', ']', '{', '}', '|'];

  const insertSymbol = (sym: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    setInput(prev => prev.slice(0, start) + sym + prev.slice(end));
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + sym.length; el.focus(); }, 0);
  };

  const suggestions = [
    { icon: '🔢', text: settings.language === 'km' ? 'ដោះស្រាយ x² - 5x + 6 = 0' : 'Solve x² - 5x + 6 = 0' },
    { icon: '⚡', text: settings.language === 'km' ? 'ច្បាប់ញូតុនទី២' : "Newton's 2nd Law" },
    { icon: '🧪', text: settings.language === 'km' ? 'សមរភាព H₂ + O₂ → H₂O' : 'Balance H₂ + O₂ → H₂O' },
    { icon: '🌿', text: settings.language === 'km' ? 'រូបមន្តការសរស្តារពន្លឺ' : 'Photosynthesis equation' },
  ];

  const isDark = settings.theme === 'dark';
  const bg = isDark ? 'bg-[#0D0D0D]' : 'bg-white';
  const sidebarBg = isDark ? 'bg-[#171717]' : 'bg-[#F9F9F9]';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-800' : 'border-gray-200';
  const inputBg = isDark ? 'bg-[#212121]' : 'bg-white';
  const cardHover = isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-100';

  return (
    <div className={`flex h-screen w-screen ${bg} ${textPrimary} overflow-hidden text-sm`}>
      {/* ═══ SIDEBAR ═══ */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-y-0 left-0 z-40 w-[260px] ${sidebarBg} ${borderColor} border-r flex flex-col`}>
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <button onClick={newChat}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-[#212121] hover:bg-[#2A2A2A] text-white' : 'bg-white hover:bg-gray-100 text-gray-900 border border-gray-200'} transition-colors`}>
                <Plus className="w-4 h-4" /> {settings.language === 'km' ? 'សន្ទនាថ្មី' : 'New Chat'}
              </button>
              <button onClick={() => setSidebarOpen(false)} className={`p-2 rounded-lg ${cardHover} ${textSecondary}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
              {sessions.length === 0 && (
                <p className={`text-center py-8 ${textSecondary}`}>{settings.language === 'km' ? 'គ្មានប្រវត្តិ' : 'No history'}</p>
              )}
              {sessions.map(s => (
                <div key={s.id} onClick={() => { setActiveId(s.id); setSidebarOpen(false); }}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    activeId === s.id ? (isDark ? 'bg-[#212121] text-white' : 'bg-gray-200 text-gray-900') : `${cardHover} ${textSecondary}`
                  }`}>
                  <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
                  <span className="truncate flex-1">{s.title}</span>
                  <button onClick={(e) => deleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className={`p-2 border-t ${borderColor} space-y-0.5`}>
              <button onClick={() => { window.open('https://t.me/hismakarabot?start=upgrade', '_blank'); }}
                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isDark ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 hover:from-amber-500/30 hover:to-orange-500/30' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}>
                <Star className="w-4 h-4" /> {settings.language === 'km' ? 'ធ្វើឱ្យប្រសើរឡើង' : 'Upgrade Plan'}
              </button>
              <button onClick={() => { setSidebarOpen(false); navigate('/settings'); }}
                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm ${cardHover} ${textSecondary} transition-colors`}>
                <Settings className="w-4 h-4" /> {settings.language === 'km' ? 'ការកំណត់' : 'Settings'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/50" />}

      {/* ═══ MAIN CHAT ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar - Simplified for mobile */}
        <div className={`flex items-center justify-between px-2.5 py-2 border-b ${borderColor}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-1.5 rounded-lg ${cardHover} ${textSecondary} shrink-0`}>
              {sidebarOpen ? <X className="w-4.5 h-4.5" /> : <MessageSquare className="w-4.5 h-4.5" />}
            </button>
            <img src="/logo.png" alt="Bayon" className="w-6 h-6 rounded-lg shrink-0" />
            <span className="font-semibold text-sm truncate">Bayon</span>
            <button onClick={() => {
              setSettings(prev => { const next = { ...prev, bayonEnabled: !prev.bayonEnabled }; localStorage.setItem('bayon_enabled', String(next.bayonEnabled)); return next; });
            }} className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
              settings.bayonEnabled ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : `${isDark ? 'bg-[#212121] text-gray-400' : 'bg-gray-100 text-gray-500'}`
            }`}>
              <Sparkles className="w-2.5 h-2.5" />
              {settings.bayonEnabled ? (settings.language === 'km' ? 'បាយ័ន' : 'Bayon') : 'Qwen'}
            </button>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => {
              setSettings(prev => {
                const next = { ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' as const };
                localStorage.setItem('bayon_theme', next.theme);
                document.documentElement.classList.toggle('dark', next.theme === 'dark');
                return next;
              });
            }} className={`p-1.5 rounded-lg ${cardHover} ${textSecondary}`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {tgUser ? (
              <div className="flex items-center gap-1.5">
                {/* Plan badge */}
                {usage && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    usage.plan === 'premium'
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white'
                      : usage.plan === 'plus'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                  }`}>
                    {usage.plan === 'premium' ? <Crown className="w-2.5 h-2.5" /> : usage.plan === 'plus' ? <Star className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
                    {usage.label || usage.plan || 'Free'}
                    {typeof usage.questions_used === 'number' && typeof usage.questions_limit === 'number' && (
                      <span className="opacity-70"> · {usage.questions_limit - usage.questions_used} left</span>
                    )}
                  </span>
                )}
                {isAdmin() && <span title="Admin" className="text-amber-400 text-xs">🛡</span>}
                <img src={(tgUser.photo_url as string) || '/logo.png'} alt="" className="w-6 h-6 rounded-full border border-gray-700" />
                <button onClick={() => { logoutTelegram(); setTgUser(null); }} className={`p-1 rounded ${cardHover} ${textSecondary}`}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLoginModal(true)}
                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-[#2AABEE] text-white hover:bg-[#229ED9] transition-colors">
                {settings.language === 'km' ? 'ចូល' : 'Log in'}
              </button>
            )}
            <button onClick={() => navigate('/settings')} className={`p-1.5 rounded-lg ${cardHover} ${textSecondary}`}>
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {/* Empty State */}
          {(!activeSession || activeSession.messages.length === 0) && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full px-4 py-8">
              <motion.img src="/logo.png" alt="Bayon" className="w-16 h-16 mb-3 rounded-2xl"
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />
              <motion.h1 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                className="text-xl font-bold mb-1.5">
                {settings.language === 'km' ? 'សួស្តី! ខ្ញុំជា បាយ័ន' : 'Hello! I am Bayon'}
              </motion.h1>
              <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                className={`text-center ${textSecondary} mb-6 max-w-sm text-xs leading-relaxed`}>
                {settings.language === 'km'
                  ? 'ជំនួយការសិក្សា AI ឆ្លាតវៃសម្រាប់សិស្សកម្ពុជា។ សួរខ្ញុំអ្វីក៏បានពីគណិត រូបវិទ្យា គីមី និងជីវវិទ្យា។'
                  : 'Smart AI tutor for Cambodian students. Ask me anything about Math, Physics, Chemistry, and Biology.'}
              </motion.p>
              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                className="grid grid-cols-1 gap-1.5 w-full max-w-sm">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setInput(s.text)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                      isDark ? 'bg-[#1A1A1A] hover:bg-[#252525] text-gray-300 border border-gray-800' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                    <span>{s.icon}</span>
                    <span className="truncate">{s.text}</span>
                  </button>
                ))}
              </motion.div>
            </div>
          )}

          {/* Chat Messages */}
          {activeSession?.messages.map((msg) => (
            <div key={msg.id} className="px-3 py-3">
              <div className="max-w-2xl mx-auto">
                <div className="flex gap-2.5">
                  <div className="shrink-0 mt-0.5">
                    {msg.role === 'user' ? (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? 'bg-[#3B3B3B] text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                        {tgUser?.first_name?.[0] || 'U'}
                      </div>
                    ) : (
                      <img src="/logo.png" alt="B" className="w-6 h-6 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold">{msg.role === 'user' ? (tgUser?.first_name || (settings.language === 'km' ? 'អ្នក' : 'You')) : 'Bayon'}</span>
                      {msg.model && (
                        <span className={`text-[9px] px-1 py-0.5 rounded-full ${isDark ? 'bg-[#252525] text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                          {msg.model.includes('claude') ? 'Claude' : 'Qwen'}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${msg.role === 'assistant' ? textPrimary : textSecondary}`}>
                      {msg.role === 'assistant' ? formatMath(msg.content) : msg.content}
                      {msg.role === 'assistant' && isLoading && msg.id === activeSession.messages[activeSession.messages.length - 1]?.id && (
                        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-amber-400 animate-pulse rounded-sm" />
                      )}
                    </div>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-0.5 mt-1.5 opacity-0 hover:opacity-100 transition-opacity">
                        <button onClick={() => copyMsg(msg)} className={`p-1 rounded ${cardHover} ${textSecondary}`}>
                          {copiedId === msg.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <button onClick={() => {}} className={`p-1 rounded ${cardHover} ${msg.liked === true ? 'text-green-500' : textSecondary}`}>
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => {}} className={`p-1 rounded ${cardHover} ${msg.liked === false ? 'text-red-500' : textSecondary}`}>
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                        <button onClick={() => copyMsg(msg)} className={`p-1 rounded ${cardHover} ${textSecondary}`}>
                          <Share2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Typing */}
          {isLoading && (!activeSession || activeSession.messages.length === 0 || activeSession.messages[activeSession.messages.length - 1]?.role === 'user') && (
            <div className="px-3 py-3">
              <div className="max-w-2xl mx-auto flex gap-2.5">
                <div className="bayon-shimmer-container shrink-0">
                  <img src="/logo.png" alt="" className="w-6 h-6 rounded-full bayon-shimmer" />
                </div>
                <span className={`text-xs ${textSecondary} py-1`}>{settings.language === 'km' ? 'បាយ័នកំពុងគិត...' : 'Bayon is thinking...'}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`border-t ${borderColor} px-3 py-2`}>
          <div className="max-w-2xl mx-auto">
            {imgPreview && (
              <div className="relative inline-block mb-1.5">
                <img src={imgPreview} alt="" className="h-12 rounded-lg object-cover border border-gray-700" />
                <button onClick={() => setImgPreview(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
            <div className={`flex items-end gap-1.5 ${inputBg} ${borderColor} border rounded-xl px-2.5 py-1.5`}>
              <button onClick={() => fileRef.current?.click()} className={`p-1.5 rounded-lg ${cardHover} ${textSecondary} shrink-0`}>
                <ImageIcon className="w-4 h-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onloadend = () => setImgPreview(r.result as string); r.readAsDataURL(f); }} />
              <textarea ref={textareaRef} rows={1}
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); imgPreview ? sendPhoto() : send(); } }}
                placeholder={settings.language === 'km' ? 'សួរអ្វីក៏បាន...' : 'Ask anything...'}
                className={`flex-1 bg-transparent text-xs resize-none outline-none py-1.5 ${textPrimary} placeholder:text-gray-600`}
              />
              <button onClick={() => setShowMathKb(!showMathKb)} className={`p-1.5 rounded-lg ${cardHover} ${showMathKb ? 'text-amber-400' : textSecondary} shrink-0`}>
                <Calculator className="w-4 h-4" />
              </button>
              <button onClick={() => imgPreview ? sendPhoto() : send()} disabled={!input.trim() || isLoading}
                className={`p-1.5 rounded-lg transition-all shrink-0 ${input.trim() && !isLoading ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                {isLoading ? <Square className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className={`text-center text-[9px] mt-1 ${textSecondary}`}>
              {settings.language === 'km' ? 'បាយ័នអាចធ្វើកំហុសបាន។ សូមពិនិត្យចម្លើយសំខាន់ៗ។' : 'Bayon can make mistakes. Please verify important answers.'}
            </p>
          </div>
        </div>

        {/* Math Keyboard */}
        <AnimatePresence>
          {showMathKb && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className={`overflow-hidden border-t ${borderColor} ${isDark ? 'bg-[#121212]' : 'bg-gray-50'}`}>
              <div className="max-w-2xl mx-auto px-2 py-1.5">
                <div className="flex flex-wrap gap-1">
                  {mathSymbols.map(sym => (
                    <button key={sym} onClick={() => insertSymbol(sym)}
                      className={`px-2 py-1 rounded-md text-xs font-mono ${isDark ? 'bg-[#1E1E1E] hover:bg-[#2A2A2A] text-gray-300' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'}`}>
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Login Modal (Bot-based) ═══ */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`${isDark ? 'bg-[#171717]' : 'bg-white'} rounded-2xl p-6 max-w-sm w-full ${borderColor} border`}>
            <div className="text-center mb-4">
              <div className={`w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#2AABEE]/20' : 'bg-[#2AABEE]/10'}`}>
                <Bot className="w-7 h-7 text-[#2AABEE]" />
              </div>
              <h3 className="font-semibold text-base">
                {settings.language === 'km' ? 'ចូលតាម Telegram Bot' : 'Login with Telegram Bot'}
              </h3>
              <p className={`text-xs ${textSecondary} mt-1`}>
                {settings.language === 'km'
                  ? 'ចុចបើកការជជែកបូត រួចចុច "ភ្ជាប់គណនី"'
                  : 'Click below to open our bot, then click "Connect Account"'}
              </p>
            </div>

            {!isPolling ? (
              <div className="space-y-3">
                <button onClick={() => {
                  const sid = startBotLogin();
                  setPendingSessionId(sid);
                  setIsPolling(true);
                }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-[#2AABEE] text-white hover:bg-[#229ED9] transition-colors">
                  <Bot className="w-4 h-4" />
                  {settings.language === 'km' ? 'បើក @hismakarabot' : 'Open @hismakarabot'}
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <p className={`text-center text-[10px] ${textSecondary}`}>
                  {settings.language === 'km'
                    ? 'ឬ ស្វែង @hismakarabot ហើយចុច Start'
                    : 'Or manually: Search @hismakarabot and click Start'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`flex flex-col items-center gap-2 py-3 rounded-xl ${isDark ? 'bg-[#1A1A1A]' : 'bg-gray-50'} border ${borderColor}`}>
                  <Loader2 className="w-5 h-5 text-[#2AABEE] animate-spin" />
                  <p className="text-xs font-medium">
                    {settings.language === 'km' ? 'កំពុងរង់ចាំការបញ្ជាក់...' : 'Waiting for confirmation...'}
                  </p>
                  <p className={`text-[10px] ${textSecondary}`}>
                    {settings.language === 'km'
                      ? 'សូមចុច "ភ្ជាប់គណនី" នៅក្នុងការជជែកបូត'
                      : 'Please click "Connect Account" in the bot chat'}
                  </p>
                </div>
                <button onClick={async () => {
                  if (pendingSessionId) {
                    const result = await checkAuthSession(pendingSessionId);
                    if (result?.status === 'confirmed' && result.user) {
                      const confirmed = confirmAuthFromSession(result.user, result.usage);
                      if (confirmed) {
                        setTgUser(confirmed.user as Record<string, unknown>);
                        setUsage(confirmed.usage as typeof usage);
                        setIsPolling(false);
                        setPendingSessionId(null);
                        setShowLoginModal(false);
                      }
                    }
                  }
                }}
                  className={`w-full py-2 rounded-xl text-xs font-medium ${isDark ? 'bg-[#212121] hover:bg-[#2A2A2A] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'} transition-colors`}>
                  {settings.language === 'km' ? 'ខ្ញុំបានចុចហើយ' : "I've Clicked It"}
                </button>
              </div>
            )}

            <button onClick={() => {
              setShowLoginModal(false);
              setIsPolling(false);
              setPendingSessionId(null);
            }}
              className={`w-full mt-2 py-2 rounded-xl text-xs ${textSecondary} ${cardHover} transition-colors`}>
              {settings.language === 'km' ? 'បោះបង់' : 'Cancel'}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
