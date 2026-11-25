/**
 * Official API pricing catalog & cost calculator (USD per 1M tokens, Standard Paid Tier).
 *
 * Sources:
 * - Gemini Developer API Pricing (2026): Carbon, Argon, Neon, Hydrogen, 3.8 Flash, 3.6 Flash, 3.5 Flash-Lite
 * - Anthropic Claude API Pricing (2026): Opus 5.5, Sonnet 5.5, Opus 4.6, Sonnet 4.6, Haiku 4.5
 */

export const MODEL_PRICING = {
  'gemini-4-carbon': {
    label: 'Gemini 4 Carbon',
    provider: 'google',
    contextWindow: 1_000_000,
    standard: { input: 4.0, output: 20.0, cacheRead: 0.2 },
    promo: {
      until: '2026-11-30',
      untilExclusiveMs: Date.parse('2026-12-01T00:00:00Z'),
      input: 2.0,
      output: 10.0,
      cacheRead: 0.1,
    },
  },
  'gemini-4-argon': {
    label: 'Gemini 4 Argon',
    provider: 'google',
    contextWindow: 1_000_000,
    standard: { input: 4.0, output: 20.0, cacheRead: 0.2 },
    promo: {
      until: '2026-11-30',
      untilExclusiveMs: Date.parse('2026-12-01T00:00:00Z'),
      input: 2.0,
      output: 10.0,
      cacheRead: 0.1,
    },
  },
  'gemini-4-neon': {
    label: 'Gemini 4 Neon',
    provider: 'google',
    contextWindow: 1_000_000,
    standard: { input: 3.0, output: 15.0, cacheRead: 0.15 },
  },
  'gemini-4-hydrogen': {
    label: 'Gemini 4 Hydrogen',
    provider: 'google',
    contextWindow: 1_000_000,
    standard: { input: 1.5, output: 7.5, cacheRead: 0.075 },
  },
  'gemini-3.8-flash': {
    label: 'Gemini 3.8 Flash',
    provider: 'google',
    contextWindow: 1_000_000,
    standard: { input: 1.5, output: 7.5, cacheRead: 0.15 },
    promo: {
      until: '2026-12-31',
      untilExclusiveMs: Date.parse('2027-01-01T00:00:00Z'),
      input: 0.75,
      output: 3.75,
      cacheRead: 0.075,
    },
  },
  'gemini-3.6-flash': {
    label: 'Gemini 3.6 Flash',
    provider: 'google',
    contextWindow: 1_000_000,
    standard: { input: 1.5, output: 7.5, cacheRead: 0.15 },
  },
  'gemini-3.5-flash-lite': {
    label: 'Gemini 3.5 Flash-Lite',
    provider: 'google',
    contextWindow: 1_000_000,
    standard: { input: 0.3, output: 2.5, cacheRead: 0.03 },
  },
  'gemini-3.1-pro': {
    label: 'Gemini 3.1 Pro',
    provider: 'google',
    contextWindow: 1_000_000,
    standard: { input: 2.0, output: 12.0, cacheRead: 0.2 },
  },
  'claude-opus-5-5': {
    label: 'Claude Opus 5.5',
    provider: 'anthropic',
    contextWindow: 1_000_000,
    standard: { input: 4.0, output: 20.0, cacheRead: 0.2 },
  },
  'claude-sonnet-5-5': {
    label: 'Claude Sonnet 5.5',
    provider: 'anthropic',
    contextWindow: 1_000_000,
    standard: { input: 2.0, output: 10.0, cacheRead: 0.1 },
  },
  'claude-opus-4-6': {
    label: 'Claude Opus 4.6',
    provider: 'anthropic',
    contextWindow: 1_000_000,
    standard: { input: 5.0, output: 25.0, cacheRead: 0.5 },
  },
  'claude-sonnet-4-6': {
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    contextWindow: 1_000_000,
    standard: { input: 3.0, output: 15.0, cacheRead: 0.3 },
  },
  'claude-haiku-4-5': {
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
    contextWindow: 200_000,
    standard: { input: 1.0, output: 5.0, cacheRead: 0.1 },
  },
};

export const DEFAULT_PRICING_SETTINGS = {
  usePromoPricing: true,
  overrides: {},
};

const MODEL_MATCHERS = [
  { key: 'gemini-4-carbon', test: (s) => /gemini[-_\s]?4[-_\s]?carbon|orchestrator[\s(_-]*carbon/i.test(s) },
  { key: 'gemini-4-argon', test: (s) => /gemini[-_\s]?4[-_\s]?argon|orchestrator[\s(_-]*argon/i.test(s) },
  { key: 'gemini-4-neon', test: (s) => /gemini[-_\s]?4[-_\s]?neon|orchestrator[-_\s(]*neon/i.test(s) },
  { key: 'gemini-4-hydrogen', test: (s) => /gemini[-_\s]?4[-_\s]?hydrogen|orchestrator[\s(_-]*hydrogen/i.test(s) },
  { key: 'gemini-3.8-flash', test: (s) => /gemini[-_\s]?3[._-]8[-_\s]?flash|gemini[-_\s]?flash[-_\s]?worker/i.test(s) },
  { key: 'gemini-3.6-flash', test: (s) => /gemini[-_\s]?3[._-]6[-_\s]?flash/i.test(s) },
  { key: 'gemini-3.5-flash-lite', test: (s) => /gemini[-_\s]?3[._-]?[51][-_\s]?flash[-_\s]?lite/i.test(s) },
  { key: 'gemini-3.1-pro', test: (s) => /gemini[-_\s]?3(?:[._-]1)?[-_\s]?pro/i.test(s) },
  { key: 'claude-opus-5-5', test: (s) => /claude[-_\s]?opus[-_\s]?5[._-]5/i.test(s) },
  { key: 'claude-sonnet-5-5', test: (s) => /claude[-_\s]?sonnet[-_\s]?5[._-]5/i.test(s) },
  { key: 'claude-opus-4-6', test: (s) => /claude[-_\s]?opus[-_\s]?4[._-]6/i.test(s) },
  { key: 'claude-sonnet-4-6', test: (s) => /claude[-_\s]?sonnet[-_\s]?4[._-]6/i.test(s) },
  { key: 'claude-haiku-4-5', test: (s) => /claude[-_\s]?haiku[-_\s]?4[._-]5/i.test(s) },
];

export function roundUsd(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num * 1_000_000) / 1_000_000;
}

export function sanitizeRateEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const input = Number(raw.input);
  const output = Number(raw.output);
  const cacheRead = Number(raw.cacheRead);
  if (!Number.isFinite(input) || input < 0) return null;
  if (!Number.isFinite(output) || output < 0) return null;
  if (!Number.isFinite(cacheRead) || cacheRead < 0) return null;
  return { input, output, cacheRead };
}

export function sanitizePricingSettings(raw) {
  const usePromoPricing = typeof raw?.usePromoPricing === 'boolean'
    ? raw.usePromoPricing
    : DEFAULT_PRICING_SETTINGS.usePromoPricing;
  const overrides = {};
  if (raw?.overrides && typeof raw.overrides === 'object') {
    for (const [key, val] of Object.entries(raw.overrides)) {
      const k = String(key || '').trim();
      if (!k) continue;
      const clean = sanitizeRateEntry(val);
      if (clean) overrides[k] = clean;
    }
  }
  return { usePromoPricing, overrides };
}

export function normalizeModelId(raw, overrides = null) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  if (overrides && overrides[trimmed]) return trimmed;
  if (overrides && overrides[lower]) return lower;
  if (MODEL_PRICING[lower]) return lower;

  for (const matcher of MODEL_MATCHERS) {
    if (matcher.test(trimmed)) return matcher.key;
  }

  return lower;
}

export function getModelLabel(modelKey, rawModel = null) {
  if (!modelKey || modelKey === 'unknown') return 'Unknown Model';
  if (MODEL_PRICING[modelKey]) return MODEL_PRICING[modelKey].label;
  return rawModel || modelKey;
}

export function getModelContextWindow(modelKey) {
  if (!modelKey || modelKey === 'unknown') return 1_000_000;
  return MODEL_PRICING[modelKey]?.contextWindow || 1_000_000;
}

export function getEffectiveRates(modelKey, tsMs, pricingSettings = DEFAULT_PRICING_SETTINGS) {
  if (!modelKey || modelKey === 'unknown') return null;
  const settings = pricingSettings || DEFAULT_PRICING_SETTINGS;
  const custom = settings.overrides?.[modelKey];
  const entry = MODEL_PRICING[modelKey] || null;

  if (custom) {
    const clean = sanitizeRateEntry(custom);
    if (clean) {
      return {
        ...clean,
        label: entry?.label || modelKey,
        isPromo: false,
        isCustom: true,
      };
    }
  }

  if (!entry) return null;

  const usePromo = settings.usePromoPricing !== false;
  if (usePromo && entry.promo) {
    const t = Number.isFinite(tsMs) ? tsMs : Date.now();
    if (t < entry.promo.untilExclusiveMs) {
      return {
        input: entry.promo.input,
        output: entry.promo.output,
        cacheRead: entry.promo.cacheRead,
        label: entry.label,
        isPromo: true,
        isCustom: false,
      };
    }
  }

  return {
    input: entry.standard.input,
    output: entry.standard.output,
    cacheRead: entry.standard.cacheRead,
    label: entry.label,
    isPromo: false,
    isCustom: false,
  };
}

export function calculateStepCost({ inp = 0, out = 0, cache = 0, model = null, ts = Date.now() }, pricingSettings = DEFAULT_PRICING_SETTINGS) {
  const overrides = pricingSettings?.overrides || null;
  const normalized = normalizeModelId(model, overrides);
  const modelKey = normalized || 'unknown';
  const rates = getEffectiveRates(modelKey, ts, pricingSettings);
  const modelLabel = rates?.label || getModelLabel(modelKey, model);

  if (!rates) {
    return {
      modelKey,
      modelLabel,
      priced: false,
      isPromo: false,
      isCustom: false,
      inputCost: 0,
      outputCost: 0,
      cacheCost: 0,
      cacheSaved: 0,
      cost: 0,
    };
  }

  const inputCost = (inp * rates.input) / 1_000_000;
  const outputCost = (out * rates.output) / 1_000_000;
  const cacheCost = (cache * rates.cacheRead) / 1_000_000;
  const cacheSaved = Math.max(0, (cache * (rates.input - rates.cacheRead)) / 1_000_000);

  return {
    modelKey,
    modelLabel,
    priced: true,
    isPromo: rates.isPromo,
    isCustom: rates.isCustom,
    inputCost,
    outputCost,
    cacheCost,
    cacheSaved,
    cost: inputCost + outputCost + cacheCost,
  };
}

export function getPricingCatalog(pricingSettings = DEFAULT_PRICING_SETTINGS, nowMs = Date.now(), discoveredModels = []) {
  const settings = sanitizePricingSettings(pricingSettings);
  const seen = new Set();
  const catalog = [];

  for (const [key, entry] of Object.entries(MODEL_PRICING)) {
    seen.add(key);
    const effective = getEffectiveRates(key, nowMs, settings);
    catalog.push({
      key,
      label: entry.label,
      provider: entry.provider,
      contextWindow: entry.contextWindow,
      isBuiltIn: true,
      isDiscovered: false,
      isUnpriced: false,
      standard: { ...entry.standard },
      promo: entry.promo
        ? {
            until: entry.promo.until,
            input: entry.promo.input,
            output: entry.promo.output,
            cacheRead: entry.promo.cacheRead,
          }
        : null,
      effective: {
        input: effective.input,
        output: effective.output,
        cacheRead: effective.cacheRead,
      },
      isPromoActive: Boolean(effective.isPromo),
      isCustom: Boolean(effective.isCustom),
    });
  }

  const extras = new Map();
  for (const key of Object.keys(settings.overrides || {})) {
    if (!seen.has(key) && key !== 'unknown') {
      extras.set(key, key);
    }
  }
  for (const item of discoveredModels || []) {
    const key = typeof item === 'string' ? item : item?.modelKey;
    const label = typeof item === 'string' ? item : (item?.label || item?.modelKey);
    if (key && key !== 'unknown' && !seen.has(key)) {
      extras.set(key, label || key);
    }
  }

  for (const [key, label] of extras) {
    const effective = getEffectiveRates(key, nowMs, settings);
    catalog.push({
      key,
      label,
      provider: 'custom',
      contextWindow: 1_000_000,
      isBuiltIn: false,
      isDiscovered: true,
      isUnpriced: !effective,
      standard: null,
      promo: null,
      effective: effective
        ? { input: effective.input, output: effective.output, cacheRead: effective.cacheRead }
        : { input: null, output: null, cacheRead: null },
      isPromoActive: false,
      isCustom: Boolean(effective?.isCustom),
    });
  }

  return catalog;
}
