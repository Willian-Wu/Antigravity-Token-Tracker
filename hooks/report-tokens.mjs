import { readFileSync } from 'node:fs';
import { parseTranscript, readSettings } from '../lib/tokens.mjs';

function fmt(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString('en-US');
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

  const convId = payload.conversationId || 'current';
  const transcriptPath = payload.transcriptPath;
  const cur = transcriptPath ? parseTranscript(convId, transcriptPath) : null;
  const lastTurn = cur?.turns?.[cur.turns.length - 1] || null;
  const settings = readSettings();

  const parts = [];
  if (lastTurn) {
    parts.push(`本轮 ${fmt(lastTurn.totalTokens)} (In ${fmt(lastTurn.inputTokens)} / Out ${fmt(lastTurn.outputTokens)} / Cache ${fmt(lastTurn.cacheReadTokens)})`);
  } else if (cur) {
    parts.push(`本会话 ${fmt(cur.totalTokens)}`);
  } else {
    parts.push('Token 统计');
  }

  if (settings.hook.showSessionTotal && cur && lastTurn) {
    parts.push(`会话累计 ${fmt(cur.totalTokens)}`);
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
