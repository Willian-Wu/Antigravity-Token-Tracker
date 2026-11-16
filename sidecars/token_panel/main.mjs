import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';
import {
  collectConversations,
  computeTimeSeries,
  findConversation,
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
  const all = collectConversations();
  const explicitConvId = (typeof data.conversationId === 'string' && ID_RE.test(data.conversationId))
    ? data.conversationId
    : '';
  const activeConvId = app.config.conversationId || all[0]?.id || '';
  const selectedConvId = explicitConvId || activeConvId;

  const found = explicitConvId
    ? findConversation(explicitConvId, all)
    : (findConversation(selectedConvId, all) || all[0] || null);
  const current = found ? (({ stepMetrics, ...rest }) => rest)(found) : null;

  const totals = all.reduce(
    (acc, c) => {
      acc.inputTokens += c.inputTokens;
      acc.outputTokens += c.outputTokens;
      acc.cacheReadTokens += c.cacheReadTokens;
      acc.billedTokens += c.billedTokens;
      acc.totalTokens += c.totalTokens;
      return acc;
    },
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, billedTokens: 0, totalTokens: 0 },
  );

  const conversations = all.map(({ turns, stepMetrics, ...summary }) => summary);
  const series = computeTimeSeries(all);
  const settings = readSettings();

  return {
    activeConversationId: activeConvId || null,
    selectedConversationId: selectedConvId || null,
    current,
    conversations,
    totals,
    series,
    settings,
  };
}, 'GET');

app.api('/api/settings', (data) => {
  return writeSettings(data);
}, 'POST');

app.run();
