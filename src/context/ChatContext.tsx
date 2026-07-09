import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  theme: 'light' | 'dark';
  language: 'km' | 'en';
  systemPrompt: string;
  streamEnabled: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  category: string;
}

interface ChatContextType {
  sessions: ChatSession[];
  activeSessionId: string | null;
  settings: ChatSettings;
  models: ModelInfo[];
  createSession: () => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  updateSettings: (partial: Partial<ChatSettings>) => void;
  clearAllSessions: () => void;
  exportChat: (sessionId: string) => string;
  exportAllChats: () => string;
}

const DEFAULT_SETTINGS: ChatSettings = {
  model: 'Qwen3.6-35B-A3B',
  temperature: 0.7,
  maxTokens: 2048,
  theme: 'dark',
  language: 'km',
  systemPrompt: '',
  streamEnabled: true,
};

const STORAGE_KEY_SESSIONS = 'imkhmer_sessions';
const STORAGE_KEY_SETTINGS = 'imkhmer_settings';
const STORAGE_KEY_ACTIVE = 'imkhmer_active_session';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function generateTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (firstUser) {
    const text = firstUser.content.substring(0, 40);
    return text + (firstUser.content.length > 40 ? '...' : '');
  }
  return 'New Chat';
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function loadSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE) || null;
  });
  const [settings, setSettings] = useState<ChatSettings>(loadSettings);
  const [models, setModels] = useState<ModelInfo[]>([]);

  // Fetch models on mount
  useEffect(() => {
    fetch('/api/models')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.models) setModels(data.models);
      })
      .catch(() => {
        // Fallback models
        setModels([
          { id: 'Qwen3.6-35B-A3B', name: 'Qwen 3.6', provider: 'Default', category: 'general' },
          { id: 'DeepSeek-V4-Pro', name: 'DeepSeek V4 Pro', provider: 'Default', category: 'math' },
          { id: 'claudeai/nghi/claude-opus-4.8', name: 'Claude Opus 4.8', provider: 'Claude', category: 'claude' },
          { id: 'claudeai/nghi/claude-opus-4.8-thinking', name: 'Claude Opus 4.8 Thinking', provider: 'Claude', category: 'claude' },
          { id: 'claudeai/nghi/claude-opus-4.7', name: 'Claude Opus 4.7', provider: 'Claude', category: 'claude' },
          { id: 'claudeai/nghi/claude-opus-4.7-thinking', name: 'Claude Opus 4.7 Thinking', provider: 'Claude', category: 'claude' },
        ]);
      });
  }, []);

  // Persist sessions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  }, [sessions]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Persist active session
  useEffect(() => {
    if (activeSessionId) localStorage.setItem(STORAGE_KEY_ACTIVE, activeSessionId);
  }, [activeSessionId]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const createSession = useCallback(() => {
    const id = generateId();
    const newSession: ChatSession = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(id);
    return id;
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setActiveSessionId(prev => (prev === id ? null : prev));
  }, []);

  const setActiveSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const addMessage = useCallback((sessionId: string, message: ChatMessage) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const updatedMessages = [...s.messages, message];
      return {
        ...s,
        messages: updatedMessages,
        title: s.title === 'New Chat' ? generateTitle(updatedMessages) : s.title,
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const updateMessage = useCallback((sessionId: string, messageId: string, updates: Partial<ChatMessage>) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        messages: s.messages.map(m => m.id === messageId ? { ...m, ...updates } : m),
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const updateSettings = useCallback((partial: Partial<ChatSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  }, []);

  const clearAllSessions = useCallback(() => {
    setSessions([]);
    setActiveSessionId(null);
    localStorage.removeItem(STORAGE_KEY_SESSIONS);
    localStorage.removeItem(STORAGE_KEY_ACTIVE);
  }, []);

  const exportChat = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return '';
    const date = new Date(session.createdAt).toLocaleDateString();
    let md = `# ${session.title}\n\n`;
    md += `*Date: ${date}*\n\n---\n\n`;
    for (const m of session.messages) {
      const role = m.role === 'user' ? '**Student**' : m.role === 'assistant' ? '**IMKHMER TUTOR**' : '**System**';
      md += `## ${role}${m.model ? ` (${m.model})` : ''}\n\n${m.content}\n\n---\n\n`;
    }
    return md;
  }, [sessions]);

  const exportAllChats = useCallback(() => {
    const data = {
      exportDate: new Date().toISOString(),
      sessions: sessions,
    };
    return JSON.stringify(data, null, 2);
  }, [sessions]);

  return (
    <ChatContext.Provider value={{
      sessions,
      activeSessionId,
      settings,
      models,
      createSession,
      deleteSession,
      setActiveSession,
      addMessage,
      updateMessage,
      updateSettings,
      clearAllSessions,
      exportChat,
      exportAllChats,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextType {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
