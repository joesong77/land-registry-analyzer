const fieldLabelReplacements = [
  [/面\s*積/g, '面積'],
  [/住\s*址/g, '住址'],
  [/權\s*利\s*人/g, '權利人'],
  [/違\s*約\s*金/g, '違約金'],
  [/登\s*記\s*次\s*序/g, '登記次序'],
];

export function normalizeRegistryText(value = '') {
  let text = String(value)
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n');

  for (const [pattern, replacement] of fieldLabelReplacements) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeParcelNo(value = '') {
  const normalized = String(value).normalize('NFKC').trim();
  const match = normalized.match(/(\d{1,4})(?:-(\d{1,4}))?/);
  if (!match) return '';
  const main = String(Number(match[1]));
  const sub = match[2] ? Number(match[2]) : 0;
  return sub > 0 ? `${main}-${sub}` : main;
}

export function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .normalize('NFKC')
    .replace(/[*,元正平方公尺%\s]/g, '')
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeBlank(value = '') {
  const cleaned = String(value).trim();
  return /^(?:\(?空白\)?|無|--?)$/i.test(cleaned) ? '' : cleaned;
}

export function parseShare(value = '') {
  const raw = normalizeRegistryText(value).replace(/\*+/g, ' ').trim();
  if (!raw) {
    return {
      shareText: '',
      shareNumerator: null,
      shareDenominator: null,
      shareDecimal: null,
    };
  }

  if (/公同共有/.test(raw)) {
    return {
      shareText: raw,
      shareNumerator: null,
      shareDenominator: null,
      shareDecimal: null,
    };
  }

  const chinese = raw.match(/(\d+)\s*分之\s*(\d+)/);
  const slash = raw.match(/(\d+)\s*[/／]\s*(\d+)/);
  let numerator = null;
  let denominator = null;

  if (chinese) {
    denominator = Number(chinese[1]);
    numerator = Number(chinese[2]);
  } else if (slash) {
    numerator = Number(slash[1]);
    denominator = Number(slash[2]);
  } else if (/全部/.test(raw)) {
    numerator = 1;
    denominator = 1;
  }

  const decimal =
    denominator && numerator !== null ? numerator / denominator : null;

  return {
    shareText: raw,
    shareNumerator: numerator,
    shareDenominator: denominator,
    shareDecimal: Number.isFinite(decimal) ? decimal : null,
  };
}

export function decimalToFraction(value, maxDenominator = 1000) {
  if (!Number.isFinite(value) || value < 0) return null;
  if (value === 0) return { numerator: 0, denominator: 1 };

  let bestNumerator = 1;
  let bestDenominator = 1;
  let bestError = Math.abs(value - 1);

  for (let denominator = 1; denominator <= maxDenominator; denominator += 1) {
    const numerator = Math.round(value * denominator);
    const error = Math.abs(value - numerator / denominator);
    if (error < bestError) {
      bestError = error;
      bestNumerator = numerator;
      bestDenominator = denominator;
      if (error < 1e-10) break;
    }
  }

  return bestError < 0.000001
    ? { numerator: bestNumerator, denominator: bestDenominator }
    : null;
}

export function sqmToPing(value) {
  return Number.isFinite(value) ? value / 3.305785 : null;
}

export function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatMoney(value) {
  if (!Number.isFinite(value)) return '—';
  return `NT$ ${new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}
