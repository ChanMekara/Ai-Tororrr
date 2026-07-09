module.exports = async (req, res) => {
  res.json({
    models: [
      { id: 'Qwen3.6-35B-A3B', name: 'Qwen 3.6', provider: 'Default', category: 'general' },
      { id: 'DeepSeek-V4-Pro', name: 'DeepSeek V4 Pro', provider: 'Default', category: 'math' },
      { id: 'claudeai/nghi/claude-opus-4.8', name: 'Claude Opus 4.8', provider: 'Claude', category: 'claude' },
      { id: 'claudeai/nghi/claude-opus-4.8-thinking', name: 'Claude Opus 4.8 Thinking', provider: 'Claude', category: 'claude' },
      { id: 'claudeai/nghi/claude-opus-4.7', name: 'Claude Opus 4.7', provider: 'Claude', category: 'claude' },
      { id: 'claudeai/nghi/claude-opus-4.7-thinking', name: 'Claude Opus 4.7 Thinking', provider: 'Claude', category: 'claude' },
    ],
    subjects: [
      { key: 'math', name: 'គណិតវិទ្យា', emoji: '📐' },
      { key: 'physics', name: 'រូបវិទ្យា', emoji: '⚡' },
      { key: 'chemistry', name: 'គីមីវិទ្យា', emoji: '🧪' },
      { key: 'biology', name: 'ជីវវិទ្យា', emoji: '🌿' },
      { key: 'general', name: 'ទូទៅ', emoji: '🤖' },
    ],
  });
};
