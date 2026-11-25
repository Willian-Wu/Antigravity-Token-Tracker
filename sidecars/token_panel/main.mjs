import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';
import { roundUsd } from '../../lib/pricing.mjs';
import {
  collectConversations,
  computeGlobalModelBreakdown,
  computeTimeSeries,
  findConversation,
  getPricingCatalog,
  ID_RE,
  readSettings,
  writeSettings,
} from '../../lib/tokens.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STATIC = {
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
};

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

  const rawTotals = all.reduce(
    (acc, c) => {
      acc.inputTokens += c.inputTokens;
      acc.outputTokens += c.outputTokens;
      acc.cacheReadTokens += c.cacheReadTokens;
      acc.billedTokens += c.billedTokens;
      acc.totalTokens += c.totalTokens;
      acc.inputCost += c.inputCost || 0;
      acc.outputCost += c.outputCost || 0;
      acc.cacheCost += c.cacheCost || 0;
      acc.cacheSaved += c.cacheSaved || 0;
      acc.cost += c.cost || 0;
      acc.unpricedCalls += c.unpricedCalls || 0;
      return acc;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      billedTokens: 0,
      totalTokens: 0,
      inputCost: 0,
      outputCost: 0,
      cacheCost: 0,
      cacheSaved: 0,
      cost: 0,
      unpricedCalls: 0,
    },
  );

  const totals = {
    ...rawTotals,
    inputCost: roundUsd(rawTotals.inputCost),
    outputCost: roundUsd(rawTotals.outputCost),
    cacheCost: roundUsd(rawTotals.cacheCost),
    cacheSaved: roundUsd(rawTotals.cacheSaved),
    cost: roundUsd(rawTotals.cost),
  };

  const conversations = all.map(({ turns, stepMetrics, contextSteps, modelBreakdown, ...summary }) => summary);
  const series = computeTimeSeries(all);
  const modelBreakdown = computeGlobalModelBreakdown(all);
  const pricingCatalog = getPricingCatalog(settings.pricing);

  return {
    activeConversationId: activeConvId || null,
    selectedConversationId: selectedConvId || null,
    current,
    conversations,
    totals,
    series,
    modelBreakdown,
    pricingCatalog,
    settings,
  };
}, 'GET');

app.api('/api/settings', (data) => {
  const updated = writeSettings(data);
  return {
    ...updated,
    pricingCatalog: getPricingCatalog(updated.pricing),
  };
}, 'POST');

app.run();
