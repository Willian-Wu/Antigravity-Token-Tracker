import { readFileSync } from 'node:fs';
import { parseTranscript, readSettings } from '../lib/tokens.mjs';

function fmt(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString('en-US');
}

function fmtUsdMd(n) {
  const num = Number(n) || 0;
  if (num <= 0) return '\\$0.00';
  if (num < 0.0001) return '<\\$0.0001';
  if (num < 0.01) return `\\$${num.toFixed(4)}`;
  if (num < 0.1) return `\\$${num.toFixed(3)}`;
  return `\\$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function main() {
  let payload = {};
  try {
    const raw = readFileSync(0, 'utf-8');
    if (raw.trim()) payload = JSON.parse(raw);
  } catch {
    process.stdout.write('{}');
    return;
  }

  const settings = readSettings();
  const convId = payload.conversationId || 'current';
  const transcriptPath = payload.transcriptPath;
  const cur = transcriptPath ? parseTranscript(convId, transcriptPath, settings.pricing) : null;
  const lastTurn = cur?.turns?.[cur.turns.length - 1] || null;
  const showCost = settings.hook.showCost !== false;

  const parts = [];
  if (lastTurn) {
    const costTag = showCost && lastTurn.cost > 0 ? ` · ${fmtUsdMd(lastTurn.cost)}` : '';
    const modelTag = lastTurn.models?.length ? ` · ${lastTurn.models.join('/')}` : '';
    parts.push(`本轮 ${fmt(lastTurn.totalTokens)}${costTag} (In ${fmt(lastTurn.inputTokens)} / Out ${fmt(lastTurn.outputTokens)} / Cache ${fmt(lastTurn.cacheReadTokens)}${modelTag})`);
  } else if (cur) {
    const costTag = showCost && cur.cost > 0 ? ` (${fmtUsdMd(cur.cost)})` : '';
    parts.push(`本会话 ${fmt(cur.totalTokens)}${costTag}`);
  } else {
    parts.push('Token 统计');
  }

  if (settings.hook.showSessionTotal && cur && lastTurn) {
    const curCostTag = showCost && cur.cost > 0 ? ` (${fmtUsdMd(cur.cost)})` : '';
    parts.push(`会话累计 ${fmt(cur.totalTokens)}${curCostTag}`);
  }

  const md = `> 📊 **${parts[0]}**${parts.length > 1 ? ` · ${parts.slice(1).join(' · ')}` : ''} · [查看详情](sidecar://token-tracker/token_panel/)`;

  process.stdout.write(
    JSON.stringify({
      injectSteps: [
        {
          systemMessage: {
            systemMessage: '',
            metadata: {
              user_markdown: md,
            },
          },
        },
      ],
      terminationBehavior: '',
    }),
  );
}

main();
