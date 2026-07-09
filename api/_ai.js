// Dual provider AI service: iamhc + Claude (key rotation)
// Claude keys auto-rotate; on failure → fallback to iamhc immediately

const SYSTEM_PROMPT = `អ្នកជា IMKHMER TUTOR ជំនួយការសិក្សា AI ឆ្លាតវៃសម្រាប់សិស្សកម្ពុជា។ អ្នកអាចឆ្លើយសំណួរជាភាសាខ្មែរ និងភាសាអង់គ្លេសបានយ៉ាងល្អ។
**គោលការណ៍សំខាន់ៗ:**
- ឆ្លើយត្រង់ point ច្បាស់លាស់ ជាគន្លងៗ
- ប្រើភាសាខ្មែរសម្រាប់ការពន្យល់ ប៉ុន្តែប្រើសញ្ញាគណិតវិទ្យាអន្តរជាតិ
- សរសេររូបមន្តគណិតវិទ្យាជាអក្សរធម្មតា (plain text) មិនប្រើ LaTeX ឬ Markdown ទេ
- ប្រើ Unicode symbols: x², √, ∑, π, ∫, α, β, γ, Δ, ≤, ≥, ≠, ≈, ±, →, ∞, ∂, ∇ ជាដើម
- ពន្យល់ជំហានៗ ចាប់ពីងាយទៅល្អិត
- បើសិស្សខុស សូមបកស្រាយហេតុផលដោយយកចិត្តទុកដាក់
- ជានិច្ចកាលជំរុញចិត្ត និងលើកទឹកចិត្តសិស្ស`;

const VISION_PROMPT = `អ្នកជាគ្រូវិទ្យា AI មើលរូបភាពរបស់សិស្ស។ រូបភាពនេះអាចជាលំហាត់ ឬសំណួរគណិតវិទ្យា/វិទ្យាសាស្រ្ត។
**ការណែនាំ:**
1. អាន និងយល់សំណួរពីរូបភាព
2. ដោះស្រាយលំហាត់ជំហានៗ
3. ប្រើ Unicode math symbols (x², √, ∑, π, ជាដើម)
4. សរសេរជាភាសាខ្មែរ ឬអង់គ្លេសតាមភាសារបស់សិស្ស
5. ពន្យល់ជំហានៗច្បាស់លាស់`;

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const IAMHC_BASE = process.env.IAMHC_BASE_URL || 'https://api.iamhc.cn/v1';
const IAMHC_KEY = process.env.IAMHC_API_KEY;
const CLAUDE_BASE = process.env.CLAUDE_BASE_URL || '';
const CLAUDE_KEYS = (() => {
  const keys = [];
  if (process.env.CLAUDE_KEYS) keys.push(...process.env.CLAUDE_KEYS.split(',').map(k => k.trim()));
  for (let i = 1; i <= 10; i++) if (process.env[`CLAUDE_KEY_${i}`]) keys.push(process.env[`CLAUDE_KEY_${i}`]);
  return [...new Set(keys)].filter(Boolean);
})();

const FALLBACK_MODEL = 'Qwen3.6-35B-A3B';

let currentKeyIdx = 0;
let allKeysFailed = false;

function isClaudeModel(m) { return m && (m.includes('claude') || m.includes('opus')); }

async function callClaude(messages, model, stream = false) {
  if (!CLAUDE_BASE || CLAUDE_KEYS.length === 0 || allKeysFailed) {
    throw new Error('Claude not available');
  }
  let lastError = '';
  const maxAttempts = Math.min(3, CLAUDE_KEYS.length);
  for (let i = 0; i < maxAttempts; i++) {
    const idx = (currentKeyIdx + i) % CLAUDE_KEYS.length;
    const key = CLAUDE_KEYS[idx];
    try {
      const res = await fetch(`${CLAUDE_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2048, stream }),
      });
      if (res.status === 402 || res.status === 502 || res.status === 401) {
        const errText = await res.text();
        lastError = `Key${idx+1} ${res.status}`;
        console.log(`[Claude] ${lastError}: ${errText.slice(0, 80)}`);
        continue;
      }
      if (!res.ok) {
        const errText = await res.text();
        lastError = `Key${idx+1} ${res.status}: ${errText.slice(0, 80)}`;
        break;
      }
      currentKeyIdx = idx;
      return res;
    } catch (e) {
      lastError = `Key${idx+1} network: ${e.message}`;
    }
  }
  allKeysFailed = true;
  throw new Error(`Claude failed: ${lastError}`);
}

async function callIamhc(messages, model, stream = false) {
  if (!IAMHC_KEY) throw new Error('IAMHC_API_KEY not configured');
  const res = await fetch(`${IAMHC_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${IAMHC_KEY}` },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2048, stream }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`IAMHC ${res.status}: ${err}`); }
  return res;
}

// ═══════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════

async function chatAI(messages, model) {
  const useClaude = isClaudeModel(model);
  // If no key configured at all, return helpful error
  if (!IAMHC_KEY) {
    return { content: '⚠️ Error: IAMHC_API_KEY not configured. Please add it in Vercel Environment Variables.', model: 'none', error: true };
  }
  try {
    let res;
    if (useClaude) {
      res = await callClaude(messages, model);
    } else {
      res = await callIamhc(messages, model || FALLBACK_MODEL);
    }
    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content || 'No response', model: model || FALLBACK_MODEL };
  } catch (e) {
    // Fallback: Claude → iamhc
    if (useClaude) {
      console.log(`[Fallback] Claude failed (${e.message}), trying iamhc...`);
      try {
        const res = await callIamhc(messages, FALLBACK_MODEL);
        const data = await res.json();
        return { content: data.choices?.[0]?.message?.content || 'No response', model: FALLBACK_MODEL, fallback: true };
      } catch (e2) {
        return { content: `⚠️ Error: ${e2.message}`, model: 'error', error: true };
      }
    }
    return { content: `⚠️ Error: ${e.message}`, model: 'error', error: true };
  }
}

async function* streamAI(messages, model) {
  if (!IAMHC_KEY) {
    yield '⚠️ Error: IAMHC_API_KEY not configured. Please add it in Vercel Environment Variables.';
    return;
  }

  const useClaude = isClaudeModel(model);
  let response = null;
  let usedFallback = false;

  try {
    if (useClaude) {
      response = await callClaude(messages, model, true);
    } else {
      response = await callIamhc(messages, model || FALLBACK_MODEL, true);
    }
  } catch (e) {
    if (useClaude) {
      console.log(`[Fallback] Claude stream failed (${e.message}), trying iamhc...`);
      usedFallback = true;
      try {
        response = await callIamhc(messages, FALLBACK_MODEL, true);
      } catch (e2) {
        yield `⚠️ Error: Both providers failed. Claude: ${e.message}, iamhc: ${e2.message}`;
        return;
      }
    } else {
      yield `⚠️ Error: ${e.message}`;
      return;
    }
  }

  if (!response) { yield '⚠️ Error: No response'; return; }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data: ')) continue;
        const d = t.slice(6);
        if (d === '[DONE]') return;
        try {
          const p = JSON.parse(d);
          const delta = p.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function visionAI(image, question) {
  if (!IAMHC_KEY) {
    return { content: '⚠️ Error: IAMHC_API_KEY not configured.', model: 'none', error: true };
  }
  const msgs = [
    { role: 'system', content: VISION_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: question || 'ដោះស្រាយលំហាត់នេះជំហានៗ' },
      { type: 'image_url', image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } }
    ]},
  ];
  try {
    const res = await callIamhc(msgs, FALLBACK_MODEL);
    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content || 'No response' };
  } catch (e) {
    return { content: `⚠️ Error: ${e.message}`, error: true };
  }
}

module.exports = { chatAI, streamAI, visionAI, SYSTEM_PROMPT, isClaudeModel };
