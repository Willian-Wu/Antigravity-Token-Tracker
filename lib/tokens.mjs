import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(__dirname);
const QUOTA_PATH = join(PLUGIN_ROOT, 'quota.json');
const SETTINGS_PATH = join(PLUGIN_ROOT, 'settings.json');

export const ID_RE = /^[0-9a-f-]{8,}$/i;

export const DEFAULT_QUOTA = {
  limit5h: 5_000_000,
  limitWeekly: 50_000_000,
  countMode: 'billed', // 'billed' (input + output) | 'total' (input + output + cache_read)
};

export const DEFAULT_SETTINGS = {
  hook: {
    showSessionTotal: true,
  },
};

const cache = new Map(); // filePath -> { mtimeMs, size, parsed }

export function readQuota() {
  try {
    const raw = JSON.parse(readFileSync(QUOTA_PATH, 'utf-8'));
    const limit5h = Number(raw?.limit5h);
    const limitWeekly = Number(raw?.limitWeekly);
    const countMode = raw?.countMode === 'total' ? 'total' : 'billed';
    return {
      limit5h: Number.isFinite(limit5h) && limit5h > 0 ? limit5h : DEFAULT_QUOTA.limit5h,
      limitWeekly: Number.isFinite(limitWeekly) && limitWeekly > 0 ? limitWeekly : DEFAULT_QUOTA.limitWeekly,
      countMode,
    };
  } catch {
    return { ...DEFAULT_QUOTA };
  }
}

export function writeQuota(next) {
  const cur = readQuota();
  const limit5h = Number(next?.limit5h);
  const limitWeekly = Number(next?.limitWeekly);
  const merged = {
    limit5h: Number.isFinite(limit5h) && limit5h > 0 ? Math.round(limit5h) : cur.limit5h,
    limitWeekly: Number.isFinite(limitWeekly) && limitWeekly > 0 ? Math.round(limitWeekly) : cur.limitWeekly,
    countMode: next?.countMode === 'total' ? 'total' : (next?.countMode === 'billed' ? 'billed' : cur.countMode),
  };
  mkdirSync(dirname(QUOTA_PATH), { recursive: true });
  writeFileSync(QUOTA_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  return merged;
}

export function readSettings() {
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
    const h = raw?.hook || {};
    return {
      hook: {
        showSessionTotal: typeof h.showSessionTotal === 'boolean' ? h.showSessionTotal : DEFAULT_SETTINGS.hook.showSessionTotal,
      },
    };
  } catch {
    return { hook: { ...DEFAULT_SETTINGS.hook } };
  }
}

export function writeSettings(next) {
  const cur = readSettings();
  const h = next?.hook || {};
  const merged = {
    hook: {
      showSessionTotal: typeof h.showSessionTotal === 'boolean' ? h.showSessionTotal : cur.hook.showSessionTotal,
    },
  };
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  return merged;
}

export function getBrainDirs() {
  const candidates = [
    process.env.ANTIGRAVITY_APP_DATA && join(process.env.ANTIGRAVITY_APP_DATA, 'brain'),
    join(homedir(), '.gemini', 'antigravity', 'brain'),
    join(homedir(), '.gemini', 'antigravity-ide', 'brain'),
    join(homedir(), '.gemini', 'antigravity-cli', 'brain'),
  ].filter(Boolean);

  const seen = new Set();
  const existing = [];
  for (const dir of candidates) {
    if (!seen.has(dir) && existsSync(dir)) {
      seen.add(dir);
      existing.push(dir);
    }
  }
  return existing;
}

function cleanUserText(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw.trim();
  const reqMatch = text.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i);
  if (reqMatch) text = reqMatch[1].trim();
  return text.replace(/\s+/g, ' ');
}

export function parseTranscript(convId, filePath) {
  let st;
  try {
    st = statSync(filePath);
  } catch {
    return null;
  }

  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
    return cached.parsed;
  }

  let text;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const turns = [];
  const stepMetrics = [];
  let currentTurn = null;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCalls = 0;
  let totalToolCalls = 0;
  let startedAt = null;
  let updatedAt = null;
  let hasOrchestrator = false;
  let inExecPhase = false;

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let step;
    try {
      step = JSON.parse(line);
    } catch {
      continue;
    }

    if (step.created_at) {
      if (!startedAt) startedAt = step.created_at;
      updatedAt = step.created_at;
    }

    if (step.type === 'USER_INPUT') {
      inExecPhase = false;
      if (typeof step.content === 'string' && /to Orchestrator/i.test(step.content)) {
        hasOrchestrator = true;
      }
      const prompt = cleanUserText(step.content);
      currentTurn = {
        index: turns.length + 1,
        prompt: prompt || '(empty prompt)',
        createdAt: step.created_at || null,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        billedTokens: 0,
        totalTokens: 0,
        modelCalls: 0,
        toolCalls: 0,
        _planCalls: 0,
        _execCalls: 0,
      };
      turns.push(currentTurn);
    } else if (step.type === 'SYSTEM_MESSAGE') {
      if (typeof step.content === 'string') {
        if (step.content.includes('Plan mode is off')) {
          hasOrchestrator = true;
          inExecPhase = true;
        } else if (step.content.includes('[plan review]')) {
          hasOrchestrator = true;
          inExecPhase = false;
        }
      }
    } else if (step.type === 'PLANNER_RESPONSE') {
      const inp = Number(step.input_tokens) || 0;
      const out = Number(step.output_tokens) || 0;
      const cacheRead = Number(step.cache_read_tokens) || 0;
      const ts = step.created_at ? Date.parse(step.created_at) : st.mtimeMs;
      const toolCalls = Array.isArray(step.tool_calls) ? step.tool_calls : [];
      const hasExitPlanMode = toolCalls.some((tc) => tc?.name === 'exit_plan_mode');
      const hasEnterPlanMode = toolCalls.some((tc) => tc?.name === 'enter_plan_mode');
      if (hasExitPlanMode || hasEnterPlanMode) {
        hasOrchestrator = true;
      }

      totalInput += inp;
      totalOutput += out;
      totalCacheRead += cacheRead;
      totalCalls += 1;
      totalToolCalls += toolCalls.length;

      if (Number.isFinite(ts)) {
        stepMetrics.push({ ts, inp, out, cache: cacheRead, tools: toolCalls.length });
      }

      if (!currentTurn) {
        currentTurn = {
          index: turns.length + 1,
          prompt: '(system / subagent)',
          createdAt: step.created_at || null,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          billedTokens: 0,
          totalTokens: 0,
          modelCalls: 0,
          toolCalls: 0,
          _planCalls: 0,
          _execCalls: 0,
        };
        turns.push(currentTurn);
      }

      currentTurn.inputTokens += inp;
      currentTurn.outputTokens += out;
      currentTurn.cacheReadTokens += cacheRead;
      currentTurn.billedTokens += inp + out;
      currentTurn.totalTokens += inp + out + cacheRead;
      currentTurn.modelCalls += 1;
      currentTurn.toolCalls += toolCalls.length;
      if (inExecPhase) {
        currentTurn._execCalls += 1;
      } else {
        currentTurn._planCalls += 1;
      }

      if (hasExitPlanMode) {
        inExecPhase = true;
      } else if (hasEnterPlanMode) {
        inExecPhase = false;
      }
    }
  }

  const finalTurns = turns.map(({ _planCalls, _execCalls, ...turn }) => {
    if (hasOrchestrator && turn.modelCalls > 0) {
      let phaseSummary;
      if (_planCalls > 0 && _execCalls > 0) {
        phaseSummary = `规划 ${_planCalls} + 执行 ${_execCalls} 次`;
      } else if (_planCalls > 0) {
        phaseSummary = `规划 ${_planCalls} 次`;
      } else {
        phaseSummary = `执行 ${_execCalls} 次`;
      }
      return { ...turn, phaseSummary };
    }
    return turn;
  });

  const title = finalTurns.length > 0 ? finalTurns[0].prompt.slice(0, 100) : convId;
  const cacheDenom = totalInput + totalCacheRead;
  const cacheHitRate = cacheDenom > 0 ? Number(((totalCacheRead / cacheDenom) * 100).toFixed(1)) : 0;
  const contextSteps = stepMetrics.map((s, idx) => ({
    step: idx + 1,
    ts: s.ts,
    context: s.inp + s.cache,
    inp: s.inp,
    out: s.out,
    cache: s.cache,
    tools: s.tools,
  }));
  const parsed = {
    id: convId,
    title,
    startedAt: startedAt || st.birthtime?.toISOString() || st.mtime.toISOString(),
    updatedAt: updatedAt || st.mtime.toISOString(),
    turnCount: finalTurns.length,
    modelCalls: totalCalls,
    toolCalls: totalToolCalls,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheReadTokens: totalCacheRead,
    cacheHitRate,
    billedTokens: totalInput + totalOutput,
    totalTokens: totalInput + totalOutput + totalCacheRead,
    turns: finalTurns,
    stepMetrics,
    contextSteps,
  };

  cache.set(filePath, { mtimeMs: st.mtimeMs, size: st.size, parsed });
  return parsed;
}

function readChildLinks(brainDir, parentId) {
  const links = [];
  const seen = new Set();
  const addLink = (childId, label) => {
    if (typeof childId !== 'string' || !ID_RE.test(childId)) return;
    if (childId === parentId || seen.has(childId)) return;
    seen.add(childId);
    links.push({ childId, label });
  };

  const subagentsDir = join(brainDir, parentId, '.system_generated', 'subagents');
  if (existsSync(subagentsDir)) {
    try {
      for (const entry of readdirSync(subagentsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        try {
          const raw = JSON.parse(readFileSync(join(subagentsDir, entry.name), 'utf-8'));
          const label = raw?.subagentDescriptor?.role || raw?.subagentDescriptor?.typeName || 'subagent';
          addLink(raw?.conversationId, label);
        } catch {
          // ignore malformed subagent descriptor
        }
      }
    } catch {
      // ignore unreadable subagents dir
    }
  }

  const swarmMembersPath = join(brainDir, parentId, '.system_generated', 'swarm', 'members.json');
  if (existsSync(swarmMembersPath)) {
    try {
      const raw = JSON.parse(readFileSync(swarmMembersPath, 'utf-8'));
      const members = raw?.members && typeof raw.members === 'object' ? raw.members : {};
      for (const [name, member] of Object.entries(members)) {
        addLink(member?.conversation_id, `swarm:${name}`);
      }
    } catch {
      // ignore malformed swarm members.json
    }
  }

  return links;
}

export function collectConversations() {
  const rawById = new Map();
  for (const brainDir of getBrainDirs()) {
    let entries;
    try {
      entries = readdirSync(brainDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !ID_RE.test(entry.name)) continue;
      if (rawById.has(entry.name)) continue;
      const transcriptPath = join(brainDir, entry.name, '.system_generated', 'logs', 'transcript.jsonl');
      if (!existsSync(transcriptPath)) continue;
      const parsed = parseTranscript(entry.name, transcriptPath);
      if (parsed) {
        rawById.set(entry.name, { parsed, brainDir });
      }
    }
  }

  const parentOf = new Map(); // childId -> { parentId, label }
  const createsCycle = (parentId, childId) => {
    let cur = parentId;
    const visited = new Set();
    while (cur) {
      if (cur === childId) return true;
      if (visited.has(cur)) return true;
      visited.add(cur);
      cur = parentOf.get(cur)?.parentId;
    }
    return false;
  };

  for (const [parentId, { brainDir }] of rawById) {
    for (const { childId, label } of readChildLinks(brainDir, parentId)) {
      const childEntry = rawById.get(childId);
      if (!childEntry || childEntry.parsed.modelCalls <= 0) continue;
      if (parentOf.has(childId) || createsCycle(parentId, childId)) continue;
      parentOf.set(childId, { parentId, label });
    }
  }

  const childrenByParent = new Map();
  for (const [childId, info] of parentOf) {
    if (!childrenByParent.has(info.parentId)) childrenByParent.set(info.parentId, []);
    childrenByParent.get(info.parentId).push({ childId, label: info.label });
  }

  const gatherDescendants = (rootId) => {
    const out = [];
    const queue = [...(childrenByParent.get(rootId) || [])];
    const visited = new Set([rootId]);
    while (queue.length > 0) {
      const next = queue.shift();
      if (visited.has(next.childId)) continue;
      visited.add(next.childId);
      out.push(next);
      for (const grand of childrenByParent.get(next.childId) || []) {
        queue.push(grand);
      }
    }
    return out;
  };

  const result = [];
  for (const [id, { parsed }] of rawById) {
    if (parentOf.has(id)) continue;
    const descendants = gatherDescendants(id);
    if (parsed.modelCalls === 0 && descendants.length === 0) continue;
    if (descendants.length === 0) {
      result.push(parsed);
      continue;
    }

    let inputTokens = parsed.inputTokens;
    let outputTokens = parsed.outputTokens;
    let cacheReadTokens = parsed.cacheReadTokens;
    let billedTokens = parsed.billedTokens;
    let totalTokens = parsed.totalTokens;
    let modelCalls = parsed.modelCalls;
    let toolCalls = parsed.toolCalls || 0;
    let updatedAt = parsed.updatedAt;
    const stepMetrics = [...parsed.stepMetrics];
    const mergedTurns = [...parsed.turns];

    for (const { childId, label } of descendants) {
      const child = rawById.get(childId)?.parsed;
      if (!child) continue;
      inputTokens += child.inputTokens;
      outputTokens += child.outputTokens;
      cacheReadTokens += child.cacheReadTokens;
      billedTokens += child.billedTokens;
      totalTokens += child.totalTokens;
      modelCalls += child.modelCalls;
      toolCalls += child.toolCalls || 0;
      if (String(child.updatedAt).localeCompare(String(updatedAt)) > 0) {
        updatedAt = child.updatedAt;
      }
      stepMetrics.push(...child.stepMetrics);
      mergedTurns.push({
        index: mergedTurns.length + 1,
        prompt: `[子代理 · ${label}] ${child.turns[0]?.prompt || child.id.slice(0, 8)}`,
        createdAt: child.startedAt,
        inputTokens: child.inputTokens,
        outputTokens: child.outputTokens,
        cacheReadTokens: child.cacheReadTokens,
        billedTokens: child.billedTokens,
        totalTokens: child.totalTokens,
        modelCalls: child.modelCalls,
        toolCalls: child.toolCalls || 0,
      });
    }

    const mergedCacheDenom = inputTokens + cacheReadTokens;
    const cacheHitRate = mergedCacheDenom > 0
      ? Number(((cacheReadTokens / mergedCacheDenom) * 100).toFixed(1))
      : 0;

    result.push({
      ...parsed,
      updatedAt,
      turnCount: mergedTurns.length,
      modelCalls,
      toolCalls,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheHitRate,
      billedTokens,
      totalTokens,
      subagentCount: descendants.length,
      turns: mergedTurns,
      stepMetrics,
    });
  }

  return result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function findConversation(convId, conversations) {
  if (typeof convId !== 'string' || !ID_RE.test(convId)) return null;
  const hit = Array.isArray(conversations) ? conversations.find((c) => c.id === convId) : null;
  if (hit) return hit;

  for (const brainDir of getBrainDirs()) {
    const transcriptPath = join(brainDir, convId, '.system_generated', 'logs', 'transcript.jsonl');
    if (existsSync(transcriptPath)) {
      return parseTranscript(convId, transcriptPath);
    }
  }
  return null;
}

function startOfLocalWeekMs(nowMs) {
  const d = new Date(nowMs);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMon = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMon);
  return d.getTime();
}

function buildWindowQuota(used, limit) {
  const remaining = Math.max(0, limit - used);
  const remainingPct = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;
  const usedPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
  return {
    used,
    limit,
    remaining,
    remainingPct: Number(remainingPct.toFixed(1)),
    usedPct: Number(usedPct.toFixed(1)),
  };
}

export function computeQuotaStats(conversations, quota, nowMs = Date.now()) {
  const fiveHoursAgo = nowMs - 5 * 60 * 60 * 1000;
  const weekStart = startOfLocalWeekMs(nowMs);
  const includeCache = quota.countMode === 'total';

  let used5h = 0;
  let usedWeekly = 0;

  for (const conv of conversations) {
    for (const s of conv.stepMetrics || []) {
      const val = includeCache ? s.inp + s.out + s.cache : s.inp + s.out;
      if (s.ts >= fiveHoursAgo) used5h += val;
      if (s.ts >= weekStart) usedWeekly += val;
    }
  }

  return {
    config: quota,
    weekStartAt: new Date(weekStart).toISOString(),
    window5h: buildWindowQuota(used5h, quota.limit5h),
    windowWeekly: buildWindowQuota(usedWeekly, quota.limitWeekly),
  };
}

function localDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localHourKey(d) {
  return `${localDayKey(d)}-${String(d.getHours()).padStart(2, '0')}`;
}

/**
 * Aggregate stepMetrics into 7-day daily and 24-hour hourly buckets in local time.
 */
export function computeTimeSeries(conversations, nowMs = Date.now()) {
  const dailyMap = new Map();
  const daily = [];
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = localDayKey(d);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const bucket = {
      key,
      label,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      billedTokens: 0,
      totalTokens: 0,
    };
    dailyMap.set(key, bucket);
    daily.push(bucket);
  }

  const hourlyMap = new Map();
  const hourly = [];
  const curHour = new Date(nowMs);
  curHour.setMinutes(0, 0, 0);

  for (let i = 23; i >= 0; i--) {
    const d = new Date(curHour.getTime() - i * 3600_000);
    const key = localHourKey(d);
    const label = `${String(d.getHours()).padStart(2, '0')}:00`;
    const bucket = {
      key,
      label,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      billedTokens: 0,
      totalTokens: 0,
    };
    hourlyMap.set(key, bucket);
    hourly.push(bucket);
  }

  const minHourMs = curHour.getTime() - 23 * 3600_000;
  const minDayMs = daily.length ? new Date(todayStart.getTime() - 6 * 86_400_000).getTime() : nowMs;

  for (const conv of conversations) {
    for (const s of conv.stepMetrics || []) {
      if (s.ts < minDayMs && s.ts < minHourMs) continue;
      const d = new Date(s.ts);
      const dayBucket = dailyMap.get(localDayKey(d));
      if (dayBucket) {
        dayBucket.inputTokens += s.inp;
        dayBucket.outputTokens += s.out;
        dayBucket.cacheReadTokens += s.cache;
        dayBucket.billedTokens += s.inp + s.out;
        dayBucket.totalTokens += s.inp + s.out + s.cache;
      }
      if (s.ts >= minHourMs) {
        const hourBucket = hourlyMap.get(localHourKey(d));
        if (hourBucket) {
          hourBucket.inputTokens += s.inp;
          hourBucket.outputTokens += s.out;
          hourBucket.cacheReadTokens += s.cache;
          hourBucket.billedTokens += s.inp + s.out;
          hourBucket.totalTokens += s.inp + s.out + s.cache;
        }
      }
    }
  }

  return { daily, hourly };
}
