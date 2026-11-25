import { readFileSync } from 'node:fs';
import { parseConversationWithChildren, readSettings } from '../lib/tokens.mjs';

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
  const isEn = settings.ui?.locale === 'en';
  const convId = payload.conversationId || 'current';
  const transcriptPath = payload.transcriptPath;
  const cur = transcriptPath ? parseConversationWithChildren(convId, transcriptPath, settings.pricing) : null;
  const lastMainTurn = cur?.turns
    ? ([...cur.turns].reverse().find((t) => !t.isSubagent) || cur.turns[cur.turns.length - 1] || null)
    : null;
  const showCost = settings.hook.showCost !== false;

  const parts = [];
  if (lastMainTurn) {
    const costTag = showCost && lastMainTurn.cost > 0 ? ` · ${fmtUsdMd(lastMainTurn.cost)}` : '';
    const modelTag = lastMainTurn.models?.length ? ` · ${lastMainTurn.models.join('/')}` : '';
    const turnLabel = isEn ? 'Turn' : '本轮';
    parts.push(`${turnLabel} ${fmt(lastMainTurn.totalTokens)}${costTag} (In ${fmt(lastMainTurn.inputTokens)} / Out ${fmt(lastMainTurn.outputTokens)} / Cache ${fmt(lastMainTurn.cacheReadTokens)}${modelTag})`);
  } else if (cur) {
    const costTag = showCost && cur.cost > 0 ? ` (${fmtUsdMd(cur.cost)})` : '';
    const sessLabel = isEn ? 'Session' : '本会话';
    parts.push(`${sessLabel} ${fmt(cur.totalTokens)}${costTag}`);
  } else {
    parts.push(isEn ? 'Token Stats' : 'Token 统计');
  }

  if (settings.hook.showSessionTotal && cur && lastMainTurn) {
    const curCostTag = showCost && cur.cost > 0 ? ` (${fmtUsdMd(cur.cost)})` : '';
    const subTag = cur.subagentCount > 0
      ? (isEn ? ` incl. ${cur.subagentCount} subagent${cur.subagentCount > 1 ? 's' : ''}` : ` · 含 ${cur.subagentCount} 子代理`)
      : '';
    const totalLabel = isEn ? 'Session total' : '会话累计';
    parts.push(`${totalLabel} ${fmt(cur.totalTokens)}${curCostTag}${subTag}`);
  }

  const linkLabel = isEn ? 'Details' : '查看详情';
  const md = `> 📊 **${parts[0]}**${parts.length > 1 ? ` · ${parts.slice(1).join(' · ')}` : ''} · [${linkLabel}](sidecar://token-tracker/token_panel/)`;

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
