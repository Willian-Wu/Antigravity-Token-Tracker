import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateStepCost,
  getEffectiveRates,
  getModelContextWindow,
  getPricingCatalog,
  normalizeModelId,
} from '../lib/pricing.mjs';

test('normalizeModelId maps official IDs, thinking variants, orchestrator, and human labels', () => {
  const cases = [
    ['gemini-4-neon-high', 'gemini-4-neon'],
    ['gemini-4-neon-xhigh', 'gemini-4-neon'],
    ['gemini-4-neon-medium', 'gemini-4-neon'],
    ['gemini-pro-orchestrator-neon', 'gemini-4-neon'],
    ['Orchestrator (Neon)', 'gemini-4-neon'],
    ['Gemini 4 Neon (XHigh)', 'gemini-4-neon'],
    ['gemini-4-hydrogen-tiered-high', 'gemini-4-hydrogen'],
    ['Gemini 4 Hydrogen (Medium)', 'gemini-4-hydrogen'],
    ['gemini-4-carbon-high', 'gemini-4-carbon'],
    ['Orchestrator (Carbon)', 'gemini-4-carbon'],
    ['Gemini 4 Argon (High)', 'gemini-4-argon'],
    ['Gemini 3.8 Flash (Medium)', 'gemini-3.8-flash'],
    ['gemini-flash-worker-agy', 'gemini-3.8-flash'],
    ['claude-opus-5-5-medium', 'claude-opus-5-5'],
    ['Claude Opus 5.5 (Medium)', 'claude-opus-5-5'],
    ['claude-sonnet-5-5-low', 'claude-sonnet-5-5'],
    ['Claude Opus 4.6 (Thinking)', 'claude-opus-4-6'],
    ['future-custom-model-v9', 'future-custom-model-v9'],
  ];
  for (const [raw, expected] of cases) {
    assert.equal(normalizeModelId(raw), expected, `normalize(${raw})`);
  }
  assert.equal(normalizeModelId(null), null);
  assert.equal(normalizeModelId('   '), null);
});

test('getEffectiveRates switches automatically at promo cutoff dates', () => {
  const beforeDec1 = Date.parse('2026-11-30T23:59:59Z');
  const onDec1 = Date.parse('2026-12-01T00:00:00Z');
  assert.equal(getEffectiveRates('gemini-4-carbon', beforeDec1, { usePromoPricing: true }).input, 2.0);
  assert.equal(getEffectiveRates('gemini-4-carbon', beforeDec1, { usePromoPricing: true }).isPromo, true);
  assert.equal(getEffectiveRates('gemini-4-carbon', onDec1, { usePromoPricing: true }).input, 4.0);
  assert.equal(getEffectiveRates('gemini-4-carbon', onDec1, { usePromoPricing: true }).isPromo, false);
  assert.equal(getEffectiveRates('gemini-4-carbon', beforeDec1, { usePromoPricing: false }).input, 4.0);

  const beforeJan1 = Date.parse('2026-12-31T23:59:59Z');
  const onJan1 = Date.parse('2027-01-01T00:00:00Z');
  assert.equal(getEffectiveRates('gemini-3.8-flash', beforeJan1, { usePromoPricing: true }).input, 0.75);
  assert.equal(getEffectiveRates('gemini-3.8-flash', onJan1, { usePromoPricing: true }).input, 1.5);
});

test('calculateStepCost computes exact USD cost, cache savings, and custom overrides', () => {
  const res = calculateStepCost({
    inp: 100_000,
    out: 10_000,
    cache: 1_000_000,
    model: 'gemini-4-neon-xhigh',
    ts: Date.parse('2026-11-25T00:00:00Z'),
  });
  assert.equal(res.priced, true);
  assert.ok(Math.abs(res.inputCost - 0.3) < 1e-9);
  assert.ok(Math.abs(res.outputCost - 0.15) < 1e-9);
  assert.ok(Math.abs(res.cacheCost - 0.15) < 1e-9);
  assert.ok(Math.abs(res.cost - 0.6) < 1e-9);
  assert.ok(Math.abs(res.cacheSaved - 2.85) < 1e-9);

  const custom = calculateStepCost(
    { inp: 1_000_000, out: 1_000_000, cache: 1_000_000, model: 'brand-new-model-x' },
    { usePromoPricing: true, overrides: { 'brand-new-model-x': { input: 2, output: 8, cacheRead: 0.2 } } },
  );
  assert.equal(custom.priced, true);
  assert.equal(custom.isCustom, true);
  assert.ok(Math.abs(custom.cost - 10.2) < 1e-9);

  const unpriced = calculateStepCost({ inp: 50_000, out: 5_000, cache: 0, model: 'brand-new-model-x' });
  assert.equal(unpriced.priced, false);
  assert.equal(unpriced.cost, 0);
});

test('getPricingCatalog dynamically appends newly discovered models from logs', () => {
  const catalog = getPricingCatalog(
    { usePromoPricing: true, overrides: {} },
    Date.parse('2026-11-25T00:00:00Z'),
    [{ modelKey: 'gemini-5-alpha', label: 'gemini-5-alpha' }],
  );
  const discovered = catalog.find((m) => m.key === 'gemini-5-alpha');
  assert.ok(discovered, 'discovered model should be appended to catalog');
  assert.equal(discovered.isBuiltIn, false);
  assert.equal(discovered.isDiscovered, true);
  assert.equal(discovered.isUnpriced, true);
  assert.equal(getModelContextWindow('gemini-4-neon'), 1_000_000);
  assert.equal(getModelContextWindow('claude-haiku-4-5'), 200_000);
});
