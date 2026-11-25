import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';
import {
  collectConversations,
  computeBudgetStats,
  computeGlobalModelBreakdown,
  computeTimeSeries,
  filterConversationsByRange,
  findConversation,
  getPricingCatalog,
  ID_RE,
  readSettings,
  VALID_RANGES,
  writeSettings,
} from '../../lib/tokens.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STATIC = {
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
};

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function buildCsvExport(scoped) {
  const header = [
    'Conversation ID',
    'Title',
    'Updated At',
    'Models',
    'Model Calls',
    'Input Tokens',
    'Output Tokens',
    'Cache Read Tokens',
    'Total Tokens',
    'Input Cost (USD)',
    'Output Cost (USD)',
    'Cache Cost (USD)',
    'Total Cost (USD)',
    'Cache Saved (USD)',
  ];
  const rows = [header.join(',')];
  for (const c of scoped.conversations) {
    rows.push([
      csvEscape(c.id),
      csvEscape(c.title),
      csvEscape(c.updatedAt),
      csvEscape((c.models || []).join(' / ')),
      c.modelCalls,
      c.inputTokens,
      c.outputTokens,
      c.cacheReadTokens,
      c.totalTokens,
      c.inputCost,
      c.outputCost,
      c.cacheCost,
      c.cost,
      c.cacheSaved,
    ].join(','));
  }
  return '\uFEFF' + rows.join('\n') + '\n';
}

function buildMarkdownExport(scoped) {
  const t = scoped.totals;
  const lines = [
    `# Antigravity Token & API Cost Report (${scoped.range})`,
    '',
    `- **Conversations**: ${scoped.conversations.length}`,
    `- **Estimated API Cost**: $${t.cost.toFixed(4)} (Input $${t.inputCost.toFixed(4)} / Output $${t.outputCost.toFixed(4)} / Cache $${t.cacheCost.toFixed(4)})`,
    `- **Cache Savings**: $${t.cacheSaved.toFixed(4)}`,
    `- **Tokens**: ${t.totalTokens.toLocaleString('en-US')} total (${t.inputTokens.toLocaleString('en-US')} in / ${t.outputTokens.toLocaleString('en-US')} out / ${t.cacheReadTokens.toLocaleString('en-US')} cache)`,
    '',
    '## Model Breakdown',
    '',
    '| Model | Calls | Total Tokens | Cost (USD) |',
    '| :--- | ---: | ---: | ---: |',
  ];
  for (const m of scoped.modelBreakdown) {
    lines.push(`| ${m.label} | ${m.calls} | ${m.totalTokens.toLocaleString('en-US')} | ${m.priced ? `$${m.cost.toFixed(4)}` : 'Unpriced'} |`);
  }
  lines.push(
    '',
    '## Tasks',
    '',
    '| Updated | Task | Models | Tokens | Cost (USD) |',
    '| :--- | :--- | :--- | ---: | ---: |',
  );
  for (const c of scoped.conversations.slice(0, 100)) {
    const safeTitle = String(c.title || '').replaceAll('|', '\\|').slice(0, 80);
    const safeModels = (c.models || []).join(', ').replaceAll('|', '\\|');
    const dateStr = String(c.updatedAt || '').slice(0, 16).replace('T', ' ');
    lines.push(`| ${dateStr} | ${safeTitle} | ${safeModels} | ${c.totalTokens.toLocaleString('en-US')} | $${(c.cost || 0).toFixed(4)} |`);
  }
  return lines.join('\n') + '\n';
}

const app = new SidecarApp();

app.page('/', () => new Response(readFileSync(join(__dirname, 'index.html'), 'utf-8'), {
  contentType: 'text/html; charset=utf-8',
  headers: { 'Cache-Control': 'no-store' },
}));

for (const [route, [file, contentType]] of Object.entries(STATIC)) {
  app.api(route, () => new Response(readFileSync(join(__dirname, file), 'utf-8'), {
    contentType,
    headers: { 'Cache-Control': 'no-store' },
  }), 'GET');
}

app.api('/api/tokens', (data) => {
  const settings = readSettings();
  const all = collectConversations(settings.pricing);
  const explicitConvId = (typeof data.conversationId === 'string' && ID_RE.test(data.conversationId))
    ? data.conversationId
    : '';
  const activeConvId = app.config.conversationId || all[0]?.id || '';
  const selectedConvId = explicitConvId || activeConvId;

  const found = explicitConvId
    ? findConversation(explicitConvId, all, settings.pricing)
    : (findConversation(selectedConvId, all, settings.pricing) || all[0] || null);
  const current = found ? (({ stepMetrics, ...rest }) => rest)(found) : null;

  const range = (typeof data.range === 'string' && VALID_RANGES.has(data.range)) ? data.range : 'all';
  const scoped = filterConversationsByRange(all, range);
  const conversations = scoped.conversations.map(({ turns, stepMetrics, contextSteps, modelBreakdown, ...summary }) => summary);
  const series = computeTimeSeries(all);
  const budgetStats = computeBudgetStats(all, settings.budget);
  const discoveredModels = computeGlobalModelBreakdown(all);
  const pricingCatalog = getPricingCatalog(settings.pricing, Date.now(), discoveredModels);

  return {
    range: scoped.range,
    activeConversationId: activeConvId || null,
    selectedConversationId: selectedConvId || null,
    current,
    conversations,
    totals: scoped.totals,
    series,
    modelBreakdown: scoped.modelBreakdown,
    budgetStats,
    pricingCatalog,
    settings,
  };
}, 'GET');

app.api('/api/export', (data) => {
  const settings = readSettings();
  const all = collectConversations(settings.pricing);
  const range = (typeof data.range === 'string' && VALID_RANGES.has(data.range)) ? data.range : 'all';
  const format = data.format === 'md' ? 'md' : 'csv';
  const scoped = filterConversationsByRange(all, range);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'md') {
    return new Response(buildMarkdownExport(scoped), {
      contentType: 'text/markdown; charset=utf-8',
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="token-tracker-${range}-${stamp}.md"`,
      },
    });
  }

  return new Response(buildCsvExport(scoped), {
    contentType: 'text/csv; charset=utf-8',
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="token-tracker-${range}-${stamp}.csv"`,
    },
  });
}, 'GET');

app.api('/api/settings', (data) => {
  const updated = writeSettings(data);
  const all = collectConversations(updated.pricing);
  const discoveredModels = computeGlobalModelBreakdown(all);
  return {
    ...updated,
    pricingCatalog: getPricingCatalog(updated.pricing, Date.now(), discoveredModels),
  };
}, 'POST');

app.run();
