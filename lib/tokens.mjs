import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateStepCost,
  DEFAULT_PRICING_SETTINGS,
  getPricingCatalog,
  roundUsd,
  sanitizePricingSettings,
} from './pricing.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(__dirname);
const QUOTA_PATH = join(PLUGIN_ROOT, 'quota.json');
const SETTINGS_PATH = join(PLUGIN_ROOT, 'settings.json');

export const ID_RE = /^[0-9a-f-]{8,}$/i;
const MODEL_SETTING_RE = /The user changed setting `Model Selection` from .*? to ([^<\n]+?)\.(?:\s|$)/g;

export const DEFAULT_QUOTA = {
  limit5h: 5_000_000,
  limitWeekly: 50_000_000,
  countMode: 'billed', // 'billed' (input + output) | 'total' (input + output + cache_read)
};

export const DEFAULT_SETTINGS = {
  hook: {
    showSessionTotal: true,
    showCost: true,
  },
  pricing: {
    ...DEFAULT_PRICING_SETTINGS,
  },
};

const rawCache = new Map(); // filePath -> { mtimeMs, size, raw }

export { getPricingCatalog };

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
        showCost: typeof h.showCost === 'boolean' ? h.showCost : DEFAULT_SETTINGS.hook.showCost,
      },
      pricing: sanitizePricingSettings(raw?.pricing),
    };
  } catch {
    return {
      hook: { ...DEFAULT_SETTINGS.hook },
      pricing: sanitizePricingSettings(DEFAULT_SETTINGS.pricing),
    };
  }
}

export function writeSettings(next) {
  const cur = readSettings();
  const h = next?.hook || {};
  const nextPricingInput = next?.pricing !== undefined
    ? {
        usePromoPricing: typeof next.pricing?.usePromoPricing === 'boolean'
          ? next.pricing.usePromoPricing
          : cur.pricing.usePromoPricing,
        overrides: next.pricing?.overrides !== undefined
          ? next.pricing.overrides
          : cur.pricing.overrides,
      }
    : cur.pricing;

  const merged = {
    hook: {
      showSessionTotal: typeof h.showSessionTotal === 'boolean' ? h.showSessionTotal : cur.hook.showSessionTotal,
      showCost: typeof h.showCost === 'boolean' ? h.showCost : cur.hook.showCost,
    },
    pricing: sanitizePricingSettings(nextPricingInput),
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

function extractModelSelectionFromText(content) {
  if (typeof content !== 'string' || !content.includes('Model Selection')) return null;
  MODEL_SETTING_RE.lastIndex = 0;
  let last = null;
  let m;
  while ((m = MODEL_SETTING_RE.exec(content)) !== null) {
    last = m[1].trim();
  }
  return last;
}

function parseTranscriptRaw(convId, filePath) {
  let st;
  try {
    st = statSync(filePath);
  } catch {
    return null;
  }

  const cached = rawCache.get(filePath);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
    return cached.raw;
  }

  let text;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const turns = [];
  const rawSteps = [];
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
  let activeSettingModel = null;

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
      const selectedModel = extractModelSelectionFromText(step.content);
      if (selectedModel) {
        activeSettingModel = selectedModel;
      }
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
        const selectedModel = extractModelSelectionFromText(step.content);
        if (selectedModel) {
          activeSettingModel = selectedModel;
        }
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

      const rawModel = (typeof step.model === 'string' && step.model.trim())
        ? step.model.trim()
        : activeSettingModel;

      totalInput += inp;
      totalOutput += out;
      totalCacheRead += cacheRead;
      totalCalls += 1;
      totalToolCalls += toolCalls.length;

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

      const turnIdx = currentTurn.index - 1;
      rawSteps.push({
        ts: Number.isFinite(ts) ? ts : st.mtimeMs,
        inp,
        out,
        cache: cacheRead,
        tools: toolCalls.length,
        model: rawModel || null,
        turnIdx,
      });

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

  const raw = {
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
    rawSteps,
  };

  rawCache.set(filePath, { mtimeMs: st.mtimeMs, size: st.size, raw });
  return raw;
}

function addModelBucket(map, step, costInfo) {
  const key = costInfo.modelKey;
  let bucket = map.get(key);
  if (!bucket) {
    bucket = {
      modelKey: key,
      label: costInfo.modelLabel,
      priced: costInfo.priced,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
      inputCost: 0,
      outputCost: 0,
      cacheCost: 0,
      cacheSaved: 0,
      cost: 0,
    };
    map.set(key, bucket);
  }
  bucket.calls += 1;
  bucket.inputTokens += step.inp;
  bucket.outputTokens += step.out;
  bucket.cacheReadTokens += step.cache;
  bucket.totalTokens += step.inp + step.out + step.cache;
  bucket.inputCost += costInfo.inputCost;
  bucket.outputCost += costInfo.outputCost;
  bucket.cacheCost += costInfo.cacheCost;
  bucket.cacheSaved += costInfo.cacheSaved;
  bucket.cost += costInfo.cost;
}

function finalizeModelBreakdown(map) {
  return [...map.values()]
    .map((b) => ({
      ...b,
      inputCost: roundUsd(b.inputCost),
      outputCost: roundUsd(b.outputCost),
      cacheCost: roundUsd(b.cacheCost),
      cacheSaved: roundUsd(b.cacheSaved),
      cost: roundUsd(b.cost),
    }))
    .sort((a, b) => (b.cost - a.cost) || (b.totalTokens - a.totalTokens));
}

function findActiveModelAt(rawConv, targetMs) {
  const steps = rawConv?.rawSteps || [];
  let before = null;
  let any = null;
  for (const s of steps) {
    if (!s.model) continue;
    if (!any) any = s.model;
    if (Number.isFinite(targetMs) && s.ts <= targetMs) {
      before = s.model;
    }
  }
  return before || any;
}

function enrichRawConversation(raw, pricingSettings, fallbackModel = null) {
  const turnStats = raw.turns.map(() => ({
    inputCost: 0,
    outputCost: 0,
    cacheCost: 0,
    cacheSaved: 0,
    cost: 0,
    unpricedCalls: 0,
    modelLabels: new Set(),
  }));

  let totalInputCost = 0;
  let totalOutputCost = 0;
  let totalCacheCost = 0;
  let totalCacheSaved = 0;
  let totalCost = 0;
  let unpricedCalls = 0;
  const modelMap = new Map();
  const stepMetrics = [];
  const contextSteps = [];

  for (let i = 0; i < raw.rawSteps.length; i++) {
    const s = raw.rawSteps[i];
    const effectiveModel = s.model || fallbackModel;
    const costInfo = calculateStepCost(
      { inp: s.inp, out: s.out, cache: s.cache, model: effectiveModel, ts: s.ts },
      pricingSettings,
    );

    totalInputCost += costInfo.inputCost;
    totalOutputCost += costInfo.outputCost;
    totalCacheCost += costInfo.cacheCost;
    totalCacheSaved += costInfo.cacheSaved;
    totalCost += costInfo.cost;
    if (!costInfo.priced) unpricedCalls += 1;

    addModelBucket(modelMap, s, costInfo);

    const tStat = turnStats[s.turnIdx];
    if (tStat) {
      tStat.inputCost += costInfo.inputCost;
      tStat.outputCost += costInfo.outputCost;
      tStat.cacheCost += costInfo.cacheCost;
      tStat.cacheSaved += costInfo.cacheSaved;
      tStat.cost += costInfo.cost;
      if (!costInfo.priced) tStat.unpricedCalls += 1;
      if (costInfo.modelKey !== 'unknown') tStat.modelLabels.add(costInfo.modelLabel);
    }

    stepMetrics.push({
      ts: s.ts,
      inp: s.inp,
      out: s.out,
      cache: s.cache,
      tools: s.tools,
      modelKey: costInfo.modelKey,
      modelLabel: costInfo.modelLabel,
      priced: costInfo.priced,
      inputCost: costInfo.inputCost,
      outputCost: costInfo.outputCost,
      cacheCost: costInfo.cacheCost,
      cacheSaved: costInfo.cacheSaved,
      cost: costInfo.cost,
    });

    contextSteps.push({
      step: i + 1,
      ts: s.ts,
      context: s.inp + s.cache,
      inp: s.inp,
      out: s.out,
      cache: s.cache,
      tools: s.tools,
      modelKey: costInfo.modelKey,
      modelLabel: costInfo.modelLabel,
      cost: roundUsd(costInfo.cost),
    });
  }

  const turns = raw.turns.map((turn, idx) => {
    const ts = turnStats[idx];
    return {
      ...turn,
      inputCost: roundUsd(ts.inputCost),
      outputCost: roundUsd(ts.outputCost),
      cacheCost: roundUsd(ts.cacheCost),
      cacheSaved: roundUsd(ts.cacheSaved),
      cost: roundUsd(ts.cost),
      unpricedCalls: ts.unpricedCalls,
      models: [...ts.modelLabels],
    };
  });

  const modelBreakdown = finalizeModelBreakdown(modelMap);
  const models = modelBreakdown.filter((m) => m.modelKey !== 'unknown').map((m) => m.label);

  return {
    id: raw.id,
    title: raw.title,
    startedAt: raw.startedAt,
    updatedAt: raw.updatedAt,
    turnCount: raw.turnCount,
    modelCalls: raw.modelCalls,
    toolCalls: raw.toolCalls,
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
    cacheReadTokens: raw.cacheReadTokens,
    cacheHitRate: raw.cacheHitRate,
    billedTokens: raw.billedTokens,
    totalTokens: raw.totalTokens,
    inputCost: roundUsd(totalInputCost),
    outputCost: roundUsd(totalOutputCost),
    cacheCost: roundUsd(totalCacheCost),
    cacheSaved: roundUsd(totalCacheSaved),
    cost: roundUsd(totalCost),
    unpricedCalls,
    models,
    modelBreakdown,
    turns,
    stepMetrics,
    contextSteps,
  };
}

export function parseTranscript(convId, filePath, pricingSettings = null) {
  const raw = parseTranscriptRaw(convId, filePath);
  if (!raw) return null;
  const pricing = pricingSettings ? sanitizePricingSettings(pricingSettings) : readSettings().pricing;
  return enrichRawConversation(raw, pricing);
}

function readChildLinks(brainDir, parentId) {
  const links = [];
  const seen = new Set();
  const addLink = (childId, label, hintModel = null) => {
    if (typeof childId !== 'string' || !ID_RE.test(childId)) return;
    if (childId === parentId || seen.has(childId)) return;
    seen.add(childId);
    links.push({ childId, label, hintModel: hintModel || null });
  };

  const subagentsDir = join(brainDir, parentId, '.system_generated', 'subagents');
  if (existsSync(subagentsDir)) {
    try {
      for (const entry of readdirSync(subagentsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        try {
          const raw = JSON.parse(readFileSync(join(subagentsDir, entry.name), 'utf-8'));
          const desc = raw?.subagentDescriptor || {};
          const label = desc.role || desc.typeName || 'subagent';
          let hintModel = desc.model || raw?.model || null;
          if (!hintModel && desc.typeName === 'browser') {
            hintModel = 'gemini-3.8-flash';
          }
          addLink(raw?.conversationId, label, hintModel);
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
        const hintModel = member?.applied_model || member?.model || member?.desired_model || null;
        addLink(member?.conversation_id, `swarm:${name}`, hintModel);
      }
    } catch {
      // ignore malformed swarm members.json
    }
  }

  return links;
}

function mergeModelBreakdowns(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const b of list || []) {
      let acc = map.get(b.modelKey);
      if (!acc) {
        acc = {
          modelKey: b.modelKey,
          label: b.label,
          priced: b.priced,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
          inputCost: 0,
          outputCost: 0,
          cacheCost: 0,
          cacheSaved: 0,
          cost: 0,
        };
        map.set(b.modelKey, acc);
      }
      acc.calls += b.calls;
      acc.inputTokens += b.inputTokens;
      acc.outputTokens += b.outputTokens;
      acc.cacheReadTokens += b.cacheReadTokens;
      acc.totalTokens += b.totalTokens;
      acc.inputCost += b.inputCost;
      acc.outputCost += b.outputCost;
      acc.cacheCost += b.cacheCost;
      acc.cacheSaved += b.cacheSaved;
      acc.cost += b.cost;
    }
  }
  return finalizeModelBreakdown(map);
}

export function collectConversations(pricingSettings = null) {
  const pricing = pricingSettings ? sanitizePricingSettings(pricingSettings) : readSettings().pricing;
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
      const raw = parseTranscriptRaw(entry.name, transcriptPath);
      if (raw) {
        rawById.set(entry.name, { raw, brainDir });
      }
    }
  }

  const parentOf = new Map(); // childId -> { parentId, label, hintModel }
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
    for (const { childId, label, hintModel } of readChildLinks(brainDir, parentId)) {
      const childEntry = rawById.get(childId);
      if (!childEntry || childEntry.raw.modelCalls <= 0) continue;
      if (parentOf.has(childId) || createsCycle(parentId, childId)) continue;
      parentOf.set(childId, { parentId, label, hintModel });
    }
  }

  const childrenByParent = new Map();
  for (const [childId, info] of parentOf) {
    if (!childrenByParent.has(info.parentId)) childrenByParent.set(info.parentId, []);
    childrenByParent.get(info.parentId).push({ childId, label: info.label, hintModel: info.hintModel });
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
  for (const [id, { raw }] of rawById) {
    if (parentOf.has(id)) continue;
    const descendants = gatherDescendants(id);
    if (raw.modelCalls === 0 && descendants.length === 0) continue;

    const parsed = enrichRawConversation(raw, pricing);
    if (descendants.length === 0) {
      result.push(parsed);
      continue;
    }

    let inputTokens = parsed.inputTokens;
    let outputTokens = parsed.outputTokens;
    let cacheReadTokens = parsed.cacheReadTokens;
    let billedTokens = parsed.billedTokens;
    let totalTokens = parsed.totalTokens;
    let inputCost = parsed.inputCost;
    let outputCost = parsed.outputCost;
    let cacheCost = parsed.cacheCost;
    let cacheSaved = parsed.cacheSaved;
    let cost = parsed.cost;
    let unpricedCalls = parsed.unpricedCalls;
    let modelCalls = parsed.modelCalls;
    let toolCalls = parsed.toolCalls || 0;
    let updatedAt = parsed.updatedAt;
    const stepMetrics = [...parsed.stepMetrics];
    const mergedTurns = [...parsed.turns];
    const breakdownLists = [parsed.modelBreakdown];

    for (const { childId, label, hintModel } of descendants) {
      const childRaw = rawById.get(childId)?.raw;
      if (!childRaw) continue;
      const childStartMs = Date.parse(childRaw.startedAt);
      const fallbackModel = hintModel || findActiveModelAt(raw, childStartMs);
      const child = enrichRawConversation(childRaw, pricing, fallbackModel);

      inputTokens += child.inputTokens;
      outputTokens += child.outputTokens;
      cacheReadTokens += child.cacheReadTokens;
      billedTokens += child.billedTokens;
      totalTokens += child.totalTokens;
      inputCost += child.inputCost;
      outputCost += child.outputCost;
      cacheCost += child.cacheCost;
      cacheSaved += child.cacheSaved;
      cost += child.cost;
      unpricedCalls += child.unpricedCalls;
      modelCalls += child.modelCalls;
      toolCalls += child.toolCalls || 0;
      if (String(child.updatedAt).localeCompare(String(updatedAt)) > 0) {
        updatedAt = child.updatedAt;
      }
      stepMetrics.push(...child.stepMetrics);
      breakdownLists.push(child.modelBreakdown);
      mergedTurns.push({
        index: mergedTurns.length + 1,
        prompt: `[子代理 · ${label}] ${child.turns[0]?.prompt || child.id.slice(0, 8)}`,
        createdAt: child.startedAt,
        inputTokens: child.inputTokens,
        outputTokens: child.outputTokens,
        cacheReadTokens: child.cacheReadTokens,
        billedTokens: child.billedTokens,
        totalTokens: child.totalTokens,
        inputCost: child.inputCost,
        outputCost: child.outputCost,
        cacheCost: child.cacheCost,
        cacheSaved: child.cacheSaved,
        cost: child.cost,
        unpricedCalls: child.unpricedCalls,
        models: child.models,
        modelCalls: child.modelCalls,
        toolCalls: child.toolCalls || 0,
      });
    }

    const mergedCacheDenom = inputTokens + cacheReadTokens;
    const cacheHitRate = mergedCacheDenom > 0
      ? Number(((cacheReadTokens / mergedCacheDenom) * 100).toFixed(1))
      : 0;
    const modelBreakdown = mergeModelBreakdowns(breakdownLists);
    const models = modelBreakdown.filter((m) => m.modelKey !== 'unknown').map((m) => m.label);

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
      inputCost: roundUsd(inputCost),
      outputCost: roundUsd(outputCost),
      cacheCost: roundUsd(cacheCost),
      cacheSaved: roundUsd(cacheSaved),
      cost: roundUsd(cost),
      unpricedCalls,
      models,
      modelBreakdown,
      subagentCount: descendants.length,
      turns: mergedTurns,
      stepMetrics,
    });
  }

  return result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function findConversation(convId, conversations, pricingSettings = null) {
  if (typeof convId !== 'string' || !ID_RE.test(convId)) return null;
  const hit = Array.isArray(conversations) ? conversations.find((c) => c.id === convId) : null;
  if (hit) return hit;

  for (const brainDir of getBrainDirs()) {
    const transcriptPath = join(brainDir, convId, '.system_generated', 'logs', 'transcript.jsonl');
    if (existsSync(transcriptPath)) {
      return parseTranscript(convId, transcriptPath, pricingSettings);
    }
  }
  return null;
}

export function computeGlobalModelBreakdown(conversations) {
  return mergeModelBreakdowns(conversations.map((c) => c.modelBreakdown));
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

  const makeBucket = (key, label) => ({
    key,
    label,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    billedTokens: 0,
    totalTokens: 0,
    inputCost: 0,
    outputCost: 0,
    cacheCost: 0,
    cost: 0,
  });

  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = localDayKey(d);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const bucket = makeBucket(key, label);
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
    const bucket = makeBucket(key, label);
    hourlyMap.set(key, bucket);
    hourly.push(bucket);
  }

  const minHourMs = curHour.getTime() - 23 * 3600_000;
  const minDayMs = daily.length ? new Date(todayStart.getTime() - 6 * 86_400_000).getTime() : nowMs;

  const addToBucket = (bucket, s) => {
    bucket.inputTokens += s.inp;
    bucket.outputTokens += s.out;
    bucket.cacheReadTokens += s.cache;
    bucket.billedTokens += s.inp + s.out;
    bucket.totalTokens += s.inp + s.out + s.cache;
    bucket.inputCost += s.inputCost || 0;
    bucket.outputCost += s.outputCost || 0;
    bucket.cacheCost += s.cacheCost || 0;
    bucket.cost += s.cost || 0;
  };

  for (const conv of conversations) {
    for (const s of conv.stepMetrics || []) {
      if (s.ts < minDayMs && s.ts < minHourMs) continue;
      const d = new Date(s.ts);
      const dayBucket = dailyMap.get(localDayKey(d));
      if (dayBucket) addToBucket(dayBucket, s);
      if (s.ts >= minHourMs) {
        const hourBucket = hourlyMap.get(localHourKey(d));
        if (hourBucket) addToBucket(hourBucket, s);
      }
    }
  }

  const roundBucket = (b) => ({
    ...b,
    inputCost: roundUsd(b.inputCost),
    outputCost: roundUsd(b.outputCost),
    cacheCost: roundUsd(b.cacheCost),
    cost: roundUsd(b.cost),
  });

  return {
    daily: daily.map(roundBucket),
    hourly: hourly.map(roundBucket),
  };
}
