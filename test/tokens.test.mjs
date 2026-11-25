import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  collectConversations,
  computeBudgetStats,
  computeTimeSeries,
  filterConversationsByRange,
  parseConversationWithChildren,
  readSettings,
  writeSettings,
} from '../lib/tokens.mjs';

function makeFixtureBrain() {
  const root = mkdtempSync(join(tmpdir(), 'token-tracker-test-'));
  const parentId = '11111111-1111-4111-8111-111111111111';
  const childId = '22222222-2222-4222-8222-222222222222';
  const oldId = '33333333-3333-4333-8333-333333333333';

  const mkConv = (id, lines) => {
    const logsDir = join(root, id, '.system_generated', 'logs');
    mkdirSync(logsDir, { recursive: true });
    const filePath = join(logsDir, 'transcript.jsonl');
    writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf-8');
    return filePath;
  };

  // Parent conversation with today's steps + linked subagent
  const parentPath = mkConv(parentId, [
    {
      type: 'USER_INPUT',
      created_at: '2026-11-25T10:00:00Z',
      content: '<USER_REQUEST>Refactor auth middleware</USER_REQUEST>',
    },
    {
      type: 'PLANNER_RESPONSE',
      created_at: '2026-11-25T10:00:05Z',
      model: 'gemini-4-neon-high',
      input_tokens: 100_000,
      output_tokens: 10_000,
      cache_read_tokens: 200_000,
      tool_calls: [{ name: 'read_file' }],
    },
  ]);

  // Subagent conversation (uses legacy no-model format, should inherit parent or explicit model)
  mkConv(childId, [
    {
      type: 'USER_INPUT',
      created_at: '2026-11-25T10:01:00Z',
      content: 'Audit middleware call sites',
    },
    {
      type: 'PLANNER_RESPONSE',
      created_at: '2026-11-25T10:01:08Z',
      model: 'gemini-4-hydrogen-medium',
      input_tokens: 50_000,
      output_tokens: 5_000,
      cache_read_tokens: 100_000,
      tool_calls: [{ name: 'grep_search' }, { name: 'read_file' }],
    },
  ]);

  const subDir = join(root, parentId, '.system_generated', 'subagents');
  mkdirSync(subDir, { recursive: true });
  writeFileSync(
    join(subDir, `${childId}.json`),
    JSON.stringify({ conversationId: childId, subagentDescriptor: { role: 'Reviewer', typeName: 'research' } }),
    'utf-8',
  );

  // Older conversation (10 days ago, using Model Selection fallback without step.model)
  mkConv(oldId, [
    {
      type: 'USER_INPUT',
      created_at: '2026-11-15T08:00:00Z',
      content:
        '<USER_REQUEST>Legacy prompt</USER_REQUEST>\n<USER_SETTINGS_CHANGE>\nThe user changed setting `Model Selection` from None to Gemini 4 Carbon (High). No need to comment.\n</USER_SETTINGS_CHANGE>',
    },
    {
      type: 'PLANNER_RESPONSE',
      created_at: '2026-11-15T08:00:10Z',
      input_tokens: 200_000,
      output_tokens: 20_000,
      cache_read_tokens: 0,
      tool_calls: [],
    },
  ]);

  return { root, parentId, childId, oldId, parentPath };
}

test('collectConversations and parseConversationWithChildren roll up subagents identically', () => {
  const { root, parentId, parentPath } = makeFixtureBrain();
  try {
    const pricing = { usePromoPricing: true, overrides: {} };
    const all = collectConversations(pricing, [root]);
    assert.equal(all.length, 2, 'child conversation should be merged into parent');

    const parent = all.find((c) => c.id === parentId);
    assert.ok(parent);
    assert.equal(parent.subagentCount, 1);
    assert.equal(parent.modelCalls, 2);
    assert.equal(parent.toolCalls, 3);
    assert.equal(parent.inputTokens, 150_000);
    assert.equal(parent.outputTokens, 15_000);
    assert.equal(parent.cacheReadTokens, 300_000);

    // Parent step: Neon ($3/$15/$0.15) -> 0.30 + 0.15 + 0.03 = 0.48
    // Child step: Hydrogen ($1.5/$7.5/$0.075) -> 0.075 + 0.0375 + 0.0075 = 0.12
    assert.ok(Math.abs(parent.cost - 0.6) < 1e-6, `expected 0.60, got ${parent.cost}`);

    const direct = parseConversationWithChildren(parentId, parentPath, pricing);
    assert.equal(direct.totalTokens, parent.totalTokens);
    assert.equal(direct.cost, parent.cost);
    assert.equal(direct.subagentCount, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('filterConversationsByRange, budget stats, and legacy Model Selection fallback work accurately', () => {
  const { root, oldId } = makeFixtureBrain();
  try {
    const pricing = { usePromoPricing: true, overrides: {} };
    const nowMs = Date.parse('2026-11-25T15:00:00Z');
    const all = collectConversations(pricing, [root]);

    // Legacy conversation: Carbon promo ($2/$10) -> 0.40 + 0.20 = 0.60
    const oldConv = all.find((c) => c.id === oldId);
    assert.ok(oldConv);
    assert.deepEqual(oldConv.models, ['Gemini 4 Carbon']);
    assert.ok(Math.abs(oldConv.cost - 0.6) < 1e-6);

    const todayOnly = filterConversationsByRange(all, 'today', nowMs);
    assert.equal(todayOnly.conversations.length, 1);
    assert.ok(Math.abs(todayOnly.totals.cost - 0.6) < 1e-6);

    const last7d = filterConversationsByRange(all, '7d', nowMs);
    assert.equal(last7d.conversations.length, 1);

    const last30d = filterConversationsByRange(all, '30d', nowMs);
    assert.equal(last30d.conversations.length, 2);
    assert.ok(Math.abs(last30d.totals.cost - 1.2) < 1e-6);

    const budget = computeBudgetStats(all, { dailyUsd: 0.75, weeklyUsd: 2.0 }, nowMs);
    assert.equal(budget.daily.enabled, true);
    assert.equal(budget.daily.status, 'warn'); // 0.60 / 0.75 = 80%
    assert.equal(budget.weekly.status, 'ok'); // 0.60 / 2.00 = 30%

    const series = computeTimeSeries(all, nowMs);
    assert.equal(series.daily.length, 7);
    assert.equal(series.hourly.length, 24);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readSettings and writeSettings round-trip budget, locale, hook, and pricing overrides', () => {
  const dir = mkdtempSync(join(tmpdir(), 'token-tracker-settings-'));
  const settingsPath = join(dir, 'settings.json');
  try {
    const defaults = readSettings(settingsPath);
    assert.equal(defaults.hook.showCost, true);
    assert.equal(defaults.budget.dailyUsd, 0);
    assert.equal(defaults.ui.locale, 'auto');

    const saved = writeSettings(
      {
        hook: { showSessionTotal: false, showCost: true },
        budget: { dailyUsd: 12.5, weeklyUsd: 60 },
        ui: { locale: 'en' },
        pricing: { usePromoPricing: false, overrides: { 'custom-x': { input: 1, output: 4, cacheRead: 0.1 } } },
      },
      settingsPath,
    );
    assert.equal(saved.hook.showSessionTotal, false);
    assert.equal(saved.budget.dailyUsd, 12.5);
    assert.equal(saved.ui.locale, 'en');
    assert.equal(saved.pricing.usePromoPricing, false);
    assert.deepEqual(saved.pricing.overrides['custom-x'], { input: 1, output: 4, cacheRead: 0.1 });

    const reread = readSettings(settingsPath);
    assert.deepEqual(reread, saved);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
