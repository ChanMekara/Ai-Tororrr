import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Sun, Moon, Sparkles, FileText, Download,
  Trash2, BookOpen, Globe, MessageSquare, Sliders
} from 'lucide-react';

interface Settings {
  theme: 'light' | 'dark';
  language: 'km' | 'en';
  systemPrompt: string;
  bayonEnabled: boolean;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings>({
    theme: (localStorage.getItem('bayon_theme') || 'dark') as 'light' | 'dark',
    language: (localStorage.getItem('bayon_lang') || 'km') as 'km' | 'en',
    systemPrompt: localStorage.getItem('bayon_prompt') || '',
    bayonEnabled: localStorage.getItem('bayon_enabled') !== 'false',
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const km = settings.language === 'km';
  const isDark = settings.theme === 'dark';
  const bg = isDark ? 'bg-[#0D0D0D]' : 'bg-[#F5F5F5]';
  const cardBg = isDark ? 'bg-[#171717]' : 'bg-white';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-800' : 'border-gray-200';
  const inputBg = isDark ? 'bg-[#212121]' : 'bg-gray-50';
  const hoverBg = isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-100';

  const update = (key: keyof Settings, value: any) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'theme') localStorage.setItem('bayon_theme', value);
      if (key === 'language') localStorage.setItem('bayon_lang', value);
      if (key === 'systemPrompt') localStorage.setItem('bayon_prompt', value);
      if (key === 'bayonEnabled') localStorage.setItem('bayon_enabled', String(value));
      return next;
    });
  };

  const clearAllChats = () => {
    localStorage.removeItem('bayon_sessions');
    setShowClearConfirm(false);
  };

  const exportAll = () => {
    const sessions = JSON.parse(localStorage.getItem('bayon_sessions') || '[]');
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bayon-chats.json';
    a.click();
  };

  return (
    <div className={`min-h-screen ${bg} ${textPrimary}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 ${cardBg} border-b ${borderColor}`}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/')}
            className={`p-2 rounded-xl ${hoverBg} ${textSecondary} transition-colors`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{km ? 'ការកំណត់' : 'Settings'}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Appearance */}
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0 }}>
          <h2 className={`text-xs font-medium uppercase tracking-wider ${textSecondary} mb-3 px-1`}>
            {km ? 'រូបរាង' : 'Appearance'}
          </h2>
          <div className={`${cardBg} rounded-2xl ${borderColor} border overflow-hidden`}>
            {/* Theme */}
            <div className={`flex items-center justify-between px-4 py-3.5 border-b ${borderColor}`}>
              <div className="flex items-center gap-3">
                {isDark ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                <span className="text-sm">{km ? 'រចនាសម្ព័ន្ធ' : 'Theme'}</span>
              </div>
              <div className={`flex rounded-lg p-0.5 ${isDark ? 'bg-[#212121]' : 'bg-gray-100'}`}>
                {(['light', 'dark'] as const).map(t => (
                  <button key={t} onClick={() => update('theme', t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      settings.theme === t
                        ? (isDark ? 'bg-[#333] text-white' : 'bg-white text-gray-900 shadow-sm')
                        : textSecondary
                    }`}>
                    {t === 'light' ? 'Light' : 'Dark'}
                  </button>
                ))}
              </div>
            </div>
            {/* Language */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Globe className={`w-5 h-5 ${textSecondary}`} />
                <span className="text-sm">{km ? 'ភាសា' : 'Language'}</span>
              </div>
              <div className={`flex rounded-lg p-0.5 ${isDark ? 'bg-[#212121]' : 'bg-gray-100'}`}>
                {(['km', 'en'] as const).map(l => (
                  <button key={l} onClick={() => update('language', l)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      settings.language === l
                        ? (isDark ? 'bg-[#333] text-white' : 'bg-white text-gray-900 shadow-sm')
                        : textSecondary
                    }`}>
                    {l === 'km' ? 'ខ្មែរ' : 'English'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* AI Settings */}
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <h2 className={`text-xs font-medium uppercase tracking-wider ${textSecondary} mb-3 px-1`}>
            AI
          </h2>
          <div className={`${cardBg} rounded-2xl ${borderColor} border overflow-hidden`}>
            {/* Bayon Mode */}
            <div className={`flex items-center justify-between px-4 py-3.5 border-b ${borderColor}`}>
              <div className="flex items-center gap-3">
                <Sparkles className={`w-5 h-5 ${settings.bayonEnabled ? 'text-amber-400' : textSecondary}`} />
                <div>
                  <p className="text-sm font-medium">{km ? 'បាយ័ន' : 'Bayon'}</p>
                  <p className={`text-xs ${textSecondary}`}>{km ? 'AI ឆ្លាតជ្រើសរើស model' : 'Smart model routing'}</p>
                </div>
              </div>
              <button onClick={() => update('bayonEnabled', !settings.bayonEnabled)}
                className={`w-12 h-7 rounded-full transition-colors relative ${settings.bayonEnabled ? 'bg-[#F59E0B]' : 'bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${settings.bayonEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {/* Instructions */}
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-3 mb-2">
                <Sliders className={`w-5 h-5 ${textSecondary}`} />
                <span className="text-sm">{km ? 'ការណែនាំ' : 'Custom Instructions'}</span>
              </div>
              <textarea
                value={settings.systemPrompt}
                onChange={e => update('systemPrompt', e.target.value)}
                rows={4}
                placeholder={km ? 'បញ្ចូលការណែនាំផ្ទាល់ខ្លួនសម្រាប់ AI...' : 'Enter your custom instructions for the AI...'}
                className={`w-full text-sm rounded-xl px-3 py-2.5 resize-none outline-none focus:ring-1 focus:ring-[#F59E0B]/50 ${inputBg} ${textPrimary} placeholder:text-gray-600`}
              />
              {settings.systemPrompt === '' && (
                <p className={`text-xs ${textSecondary} mt-1.5`}>
                  {km ? 'បើទុកទវេ បាយ័ននឹងប្រើការណែនាំលំនាំដើម' : 'Leave empty to use default instructions'}
                </p>
              )}
            </div>
          </div>
        </motion.section>

        {/* Data */}
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <h2 className={`text-xs font-medium uppercase tracking-wider ${textSecondary} mb-3 px-1`}>
            {km ? 'ទិន្នន័យ' : 'Data'}
          </h2>
          <div className={`${cardBg} rounded-2xl ${borderColor} border overflow-hidden`}>
            <button onClick={exportAll}
              className={`flex items-center gap-3 w-full px-4 py-3.5 text-left border-b ${borderColor} ${hoverBg} transition-colors`}>
              <Download className={`w-5 h-5 ${textSecondary}`} />
              <span className="text-sm">{km ? 'នាំចេញសន្ទនាទាំងអស់' : 'Export All Chats'}</span>
            </button>
            <button onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-5 h-5 text-red-400" />
              <span className="text-sm text-red-400">{km ? 'លុបសន្ទនាទាំងអស់' : 'Delete All Chats'}</span>
            </button>
          </div>
        </motion.section>

        {/* About */}
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-center pb-8">
          <img src="/logo.png" alt="Bayon" className="w-16 h-16 mx-auto mb-3 rounded-2xl" />
          <p className={`text-sm font-medium ${textPrimary}`}>Bayon AI Tutor</p>
          <p className={`text-xs ${textSecondary} mt-0.5`}>v3.0 — {km ? 'សម្រាប់សិស្សកម្ពុជា' : 'For Cambodian Students'}</p>
        </motion.section>
      </div>

      {/* Clear Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`${cardBg} rounded-2xl p-6 max-w-sm w-full ${borderColor} border`}>
            <h3 className="text-lg font-semibold mb-2">{km ? 'លុបសន្ទនាទាំងអស់?' : 'Delete all chats?'}</h3>
            <p className={`text-sm ${textSecondary} mb-4`}>{km ? 'សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ' : 'This action cannot be undone'}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowClearConfirm(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${isDark ? 'bg-[#212121] hover:bg-[#2A2A2A]' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}>
                {km ? 'បោះបង់' : 'Cancel'}
              </button>
              <button onClick={clearAllChats}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors">
                {km ? 'លុប' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
