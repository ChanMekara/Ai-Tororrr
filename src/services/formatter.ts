const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  'a': 'ₐ', 'e': 'ₑ', 'x': 'ₓ', 'h': 'ₕ', 'k': 'ₖ',
  'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ',
  's': 'ₛ', 't': 'ₜ',
};

/**
 * Clean and format AI response
 * 1. Strip LaTeX escapes FIRST (\{ → {, \mu → μ, etc.)
 * 2. Convert ASCII math to Unicode
 * 3. Strip ugly markdown (^^, **, etc.)
 * 4. Clean up whitespace
 */
export function formatMath(text: string): string {
  let result = text;

  // ═══ STEP 0: Strip LaTeX escapes and delimiters FIRST ═══

  // 0a. Remove $...$ math delimiters
  result = result.replace(/\$([^$]+)\$/g, '$1');

  // 0b. Handle \frac{numerator}{denominator} → (numer)/(denom)
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  result = result.replace(/\\tfrac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  result = result.replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

  // 0c. Handle \lim_{x \to ...} → lim(x→...)
  result = result.replace(/\\lim_\{([^}]+)\}/g, (_m: string, sub: string) => {
    const cleaned = sub.replace(/\\to/g, '→').replace(/\\infty/g, '∞').replace(/\\inft/g, '∞');
    return 'lim(' + cleaned + ')';
  });

  // 0d. Handle \left( and \right)
  result = result.replace(/\\left\(/g, '(');
  result = result.replace(/\\right\)/g, ')');
  result = result.replace(/\\left\{/g, '{');
  result = result.replace(/\\right\}/g, '}');
  result = result.replace(/\\left\[/g, '[');
  result = result.replace(/\\right\]/g, ']');
  result = result.replace(/\\left\|/g, '|');
  result = result.replace(/\\right\|/g, '|');
  result = result.replace(/\\left\./g, '');
  result = result.replace(/\\right\./g, '');
  result = result.replace(/\\left\b/g, '');
  result = result.replace(/\\right\b/g, '');

  // 0e. Remove LaTeX math delimiters
  result = result.replace(/\\\(/g, '');
  result = result.replace(/\\\)/g, '');
  result = result.replace(/\\\[/g, '');
  result = result.replace(/\\\]/g, '');

  // 0f. Remove LaTeX braces escapes
  result = result.replace(/\\\{/g, '{');
  result = result.replace(/\\\}/g, '}');

  // 0g. Handle e^{...} and malformed e{...}
  result = result.replace(/e\^\{([^}]+)\}/g, (_m: string, exp: string) => 'e^(' + exp + ')');
  result = result.replace(/e\{([^}]+)\}/g, (_m: string, exp: string) => 'e^(' + exp + ')');
  result = result.replace(/\(ex\b/g, '(e^x');
  result = result.replace(/([ +\-*/=,\d])ex\b/g, '$1e^x');

  // 0h. Remove stray backslashes before letters
  result = result.replace(/\\([a-zA-Z]+)/g, (_m: string, cmd: string) => {
    const latexMap: Record<string, string> = {
      mu: 'μ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
      epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι',
      kappa: 'κ', lambda: 'λ', nu: 'ν', xi: 'ξ', pi: 'π',
      rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
      chi: 'χ', psi: 'ψ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ',
      Phi: 'Φ', Omega: 'Ω', Lambda: 'Λ', Gamma: 'Γ', Theta: 'Θ',
      sqrt: '√', infty: '∞', inf: '∞', int: '∫', sum: '∑',
      prod: '∏', partial: '∂', pm: '±', cdot: '·', times: '×',
      div: '÷', le: '≤', ge: '≥', ne: '≠', approx: '≈',
      equiv: '≡', deg: '°', angle: '∠', perp: '⊥', parallel: '∥',
      in: '∈', notin: '∉', subset: '⊂', supset: '⊃', subseteq: '⊆',
      supseteq: '⊇', emptyset: '∅', forall: '∀', exists: '∃',
      nabla: '∇', to: '→', rightarrow: '→', leftarrow: '←',
      Rightarrow: '⇒', Leftarrow: '⇐', mapsto: '↦', leftrightarrow: '↔',
      ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
      quad: '  ', qquad: '    ',
      text: '', mbox: '', textrm: '', textsf: '', texttt: '',
      textbf: '', textit: '', underline: '',
      ',': '', ';': '', ':': '', '!': '',
    };
    return latexMap[cmd] !== undefined ? latexMap[cmd] : '';
  });
  // Remove any remaining stray backslashes
  result = result.replace(/\\(?!n)/g, '');

  // ═══ STEP 1: Convert ASCII math to Unicode ═══

  // Superscripts: x^2 → x²
  result = result.replace(/\^(\d+)/g, (_m: string, d: string) =>
    d.split('').map((c: string) => SUPERSCRIPTS[c] || c).join('')
  );
  result = result.replace(/\^\(([^)]+)\)/g, (_m: string, c: string) =>
    c.split('').map((ch: string) => SUPERSCRIPTS[ch] || ch).join('')
  );

  // Subscripts: x_1, H_2O
  result = result.replace(/_([a-zA-Z0-9]+)/g, (_m: string, c: string) =>
    c.split('').map((ch: string) => SUBSCRIPTS[ch] || ch).join('')
  );

  // ═══ STEP 2: Strip ugly markdown formatting ═══
  result = result.replace(/\^([^\^]+)\^/g, '$1');
  result = result.replace(/\^/g, '');
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/(?<!\n)\*([^*]+)\*(?!\n)/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');
  result = result.replace(/`([^`]+)`/g, '$1');
  result = result.replace(/^#+\s*/gm, '');
  result = result.replace(/\n[-*]{3,}\n/g, '\n');
  result = result.replace(/^>\s*/gm, '');
  result = result.replace(/\n{4,}/g, '\n\n\n');

  // Operators
  result = result
    .replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠')
    .replace(/~=/g, '≈').replace(/\+\-/g, '±').replace(/\*\*/g, '^')
    .replace(/->/g, '→').replace(/=>/g, '⇒');

  // Word replacements
  const words: [RegExp, string][] = [
    [/\bsqrt\b/g, '√'], [/\bpi\b/g, 'π'], [/\binf(tiny)?\b/g, '∞'],
    [/\bint\b/g, '∫'], [/\bsum\b/g, '∑'], [/\bprod\b/g, '∏'],
    [/\b(diff|partial)\b/g, '∂'], [/\bDelta\b/g, 'Δ'], [/\bSigma\b/g, 'Σ'],
    [/\bpm\b/g, '±'], [/\bdeg\b/g, '°'], [/\bangle\b/g, '∠'],
    [/\bin\b/g, '∈'], [/\bnotin\b/g, '∉'], [/\bsubset\b/g, '⊂'],
    [/\bsupset\b/g, '⊃'], [/\bforall\b/g, '∀'], [/\bexists\b/g, '∃'],
    [/\bempty\b/g, '∅'], [/\bnabla\b/g, '∇'],
    [/\balpha\b/g, 'α'], [/\bbeta\b/g, 'β'], [/\bgamma\b/g, 'γ'],
    [/\bdelta\b/g, 'δ'], [/\bepsilon\b/g, 'ε'], [/\btheta\b/g, 'θ'],
    [/\blambda\b/g, 'λ'], [/\bmu\b/g, 'μ'], [/\bnu\b/g, 'ν'],
    [/\brho\b/g, 'ρ'], [/\bsigma\b/g, 'σ'],
    [/\btau\b/g, 'τ'], [/\bphi\b/g, 'φ'], [/\bomega\b/g, 'ω'],
    [/\bOmega\b/g, 'Ω'],
  ];
  for (const [p, r] of words) result = result.replace(p, r);

  // Fractions
  result = result.replace(/\b1\/2\b/g, '½').replace(/\b1\/3\b/g, '⅓')
    .replace(/\b2\/3\b/g, '⅔').replace(/\b1\/4\b/g, '¼').replace(/\b3\/4\b/g, '¾');

  // ═══ STEP 3: Clean whitespace ═══
  result = result.replace(/[ \t]+\n/g, '\n');
  result = result.replace(/\n{4,}/g, '\n\n\n');
  result = result.trim();

  return result;
}

/**
 * Split message into pages if exceeds threshold
 */
export function splitMessage(text: string, maxLength: number = 3800): string[] {
  if (text.length <= maxLength) return [text];
  const parts: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';
  for (const para of paragraphs) {
    if ((current + para).length > maxLength && current.length > 0) {
      parts.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current) parts.push(current.trim());
  return parts;
}

/**
 * Convert plain text to formatted HTML with math symbols
 */
export function formatToHtml(text: string): string {
  const formatted = formatMath(text);
  // Escape HTML
  const escaped = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Convert newlines to <br>
  return escaped.replace(/\n/g, '<br>');
}
