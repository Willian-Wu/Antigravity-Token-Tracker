const ID_RE = /^[0-9a-f-]{8,}$/i;

const I18N = {
  zh: {
    tabCurrent: '当前任务',
    tabHistory: '全部任务',
    settingsTitle: 'Hook、预算与计价配置',
    optSessionTotal: 'Hook 显示本会话累计',
    optHookCost: 'Hook 摘要显示估算费用 ($)',
    optPromoPricing: '促销期内按官方促销价计费',
    budgetDailyLabel: '日预算 (USD, 0=关)',
    budgetWeeklyLabel: '周预算 (USD, 0=关)',
    customPricingSummary: '自定义模型单价 (USD / 1M tokens)',
    customPricingHint: '修改 Input / Output / Cache Read 单价；日志中出现的新模型也会自动列在下方。',
    resetPricing: '恢复官方默认',
    savePricing: '保存单价',
    turnsTitle: '轮次明细 (Turns)',
    rangeToday: '今日',
    range7d: '7天',
    range30d: '30天',
    rangeAll: '全部',
    sortRecent: '最近更新',
    sortCost: '花费最高',
    sortTotal: '总 Token 最多',
    sortBilled: '非缓存最多',
    searchPlaceholder: '搜索任务提示词、模型或 ID…',
    exportCsv: '导出 CSV',
    exportMd: '导出 Markdown',
    copyMd: '复制 Markdown',
    exportTitle: '导出账单报表',
    settingsBtnTitle: '设置、预算与模型单价',
    refreshBtnTitle: '刷新',
    langBtnTitle: '切换为英文',
    costCardTitle: '估算 API 费用 (USD)',
    unpricedBadge: (n) => `含 ${n} 次未识别`,
    unpricedTooltip: '早期日志中未记录模型的调用未计入费用',
    cacheSaved: (v) => `缓存省 ${v}`,
    cacheSavedTooltip: '相对无缓存全额 Input 节省的费用',
    totalCard: '总计 (Total)',
    nonCached: (v) => `非缓存 ${v}`,
    inputCard: '输入 (Input)',
    outputCard: '输出 (Output)',
    cacheCard: '缓存命中 (Cache)',
    sharePct: (p) => `占比 ${p}%`,
    hitRate: (p) => `命中率 ${p}%`,
    staleBanner: 'Sidecar 后端尚未重启，仍返回旧版接口数据；请在插件管理中关闭再重新启用 <b>token-tracker</b>（或重启 Antigravity）以加载新版统计。',
    sessionModelsTitle: '会话模型拆分',
    globalModelsTitle: '模型费用分布',
    modelCount: (n) => `${n} 个模型`,
    callsSuffix: (n) => `${n} 次`,
    unpricedTag: '未定价',
    expand: '展开',
    collapse: '收起',
    ctxTitle: '上下文增长',
    ctxSummary: (cur, win, pct, peak) => `当前 ${cur} / ${win} (${pct}%) · 峰值 ${peak}`,
    ctxStep: (s) => `第 ${s} 次`,
    ctxCost: '费用',
    ctxContext: '上下文',
    ctxTools: '工具',
    ctxWarnHigh: (pct) => `上下文已占窗口 ${pct}%，单步推理与缓存开销显著升高，建议 /compact 或开启新会话。`,
    ctxWarnMed: (pct) => `上下文已达 ${pct}%（250k+），单步开销偏高，可考虑适时 /compact 压缩上下文。`,
    inferringTitle: '当前会话推理中…',
    liveBadge: '当前会话',
    liveShort: '当前',
    backActive: '回到当前会话',
    inferringEmpty: 'Orchestrator 规划或首轮模型调用完成后将自动更新 Token 统计',
    noCurrentTitle: '暂无当前任务记录',
    noCurrentSub: '发送第一条消息后将自动统计 Token',
    noCallsEmpty: '还没有模型调用记录',
    noTurnsEmpty: '暂无轮次记录',
    noMatchesEmpty: '没有匹配的任务记录',
    modelCallsPill: (n) => `模型 ${n} 次`,
    toolCallsPill: (n) => `工具 ${n} 次`,
    subagentPill: (n) => `子代理 ${n}`,
    turnsCount: (n) => `${n} 轮`,
    subagentPrefix: (label) => `[子代理 · ${label}]`,
    phasePlanExec: (p, e) => `规划 ${p} + 执行 ${e} 次`,
    phasePlan: (p) => `规划 ${p} 次`,
    phaseExec: (e) => `执行 ${e} 次`,
    callsLabel: (n) => `${n} 次调用`,
    toolsLabel: (n) => `工具 ${n} 次`,
    trendTitle: '消耗趋势',
    trendSummary: (sum, peak) => `合计 ${sum} · 峰值 ${peak}`,
    trend7d: '7天',
    trend24h: '24h',
    trendTotal: '总计',
    trendBilled: '非缓存',
    trendCost: '费用$',
    tasksCount: (n) => `${n} 个任务`,
    budgetDaily: '今日预算',
    budgetWeekly: '本周预算',
    budgetSub: (used, limit, rem) => `已用 ${used} / ${limit} · 剩 ${rem}`,
    budgetOver: (used, limit) => `已用 ${used} / ${limit} · 已超支`,
    pricingColModel: '模型',
    badgeCustom: '自定义',
    badgePromo: '促销',
    badgeNew: '新发现',
    promoTip: (u) => `促销价截至 ${u}`,
    saved: '已保存',
    saveFailed: '保存失败',
    pricingUpdated: '单价已更新',
    pricingReset: '已恢复官方默认',
    exported: (fmt) => `已导出 ${fmt}`,
    copiedMd: '已复制 Markdown 报表',
    copyFailed: '复制失败',
    unknownModel: '未识别模型',
  },
  en: {
    tabCurrent: 'Current',
    tabHistory: 'All Tasks',
    settingsTitle: 'Hook, Budget & Pricing',
    optSessionTotal: 'Show session total in Hook',
    optHookCost: 'Show estimated USD cost in Hook',
    optPromoPricing: 'Auto-apply promo pricing during promo window',
    budgetDailyLabel: 'Daily budget (USD, 0=off)',
    budgetWeeklyLabel: 'Weekly budget (USD, 0=off)',
    customPricingSummary: 'Model pricing overrides (USD / 1M tokens)',
    customPricingHint: 'Edit Input / Output / Cache Read rates. Newly detected models from logs appear automatically below.',
    resetPricing: 'Reset defaults',
    savePricing: 'Save rates',
    turnsTitle: 'Turns',
    rangeToday: 'Today',
    range7d: '7D',
    range30d: '30D',
    rangeAll: 'All',
    sortRecent: 'Recent',
    sortCost: 'Highest Cost',
    sortTotal: 'Most Tokens',
    sortBilled: 'Most Non-cached',
    searchPlaceholder: 'Search prompt, model, or ID…',
    exportCsv: 'Download CSV',
    exportMd: 'Download Markdown',
    copyMd: 'Copy Markdown',
    exportTitle: 'Export usage report',
    settingsBtnTitle: 'Settings, budget & model pricing',
    refreshBtnTitle: 'Refresh',
    langBtnTitle: 'Switch to Chinese',
    costCardTitle: 'Estimated API Cost (USD)',
    unpricedBadge: (n) => `${n} unpriced`,
    unpricedTooltip: 'Legacy calls without model metadata are excluded from USD cost',
    cacheSaved: (v) => `Cache saved ${v}`,
    cacheSavedTooltip: 'Estimated savings vs uncached input pricing',
    totalCard: 'Total',
    nonCached: (v) => `Non-cached ${v}`,
    inputCard: 'Input',
    outputCard: 'Output',
    cacheCard: 'Cache Read',
    sharePct: (p) => `${p}% share`,
    hitRate: (p) => `${p}% hit rate`,
    staleBanner: 'Sidecar backend has not restarted yet. Toggle <b>token-tracker</b> off and on in Plugins (or restart Antigravity) to load updated stats.',
    sessionModelsTitle: 'Session Models',
    globalModelsTitle: 'Cost by Model',
    modelCount: (n) => `${n} model${n > 1 ? 's' : ''}`,
    callsSuffix: (n) => `${n} call${n > 1 ? 's' : ''}`,
    unpricedTag: 'Unpriced',
    expand: 'Expand',
    collapse: 'Hide',
    ctxTitle: 'Context Growth',
    ctxSummary: (cur, win, pct, peak) => `Now ${cur} / ${win} (${pct}%) · Peak ${peak}`,
    ctxStep: (s) => `Step ${s}`,
    ctxCost: 'Cost',
    ctxContext: 'Context',
    ctxTools: 'Tools',
    ctxWarnHigh: (pct) => `Context at ${pct}% of window — consider /compact or a new chat to reduce per-step spend.`,
    ctxWarnMed: (pct) => `Context at ${pct}% (250k+) — per-step cache & input spend is elevated; consider /compact.`,
    inferringTitle: 'Current session running…',
    liveBadge: 'Active',
    liveShort: 'Live',
    backActive: 'Back to active',
    inferringEmpty: 'Token stats will appear after the first model step finishes',
    noCurrentTitle: 'No active conversation',
    noCurrentSub: 'Send a message to start tracking tokens & cost',
    noCallsEmpty: 'No model calls recorded yet',
    noTurnsEmpty: 'No turns recorded yet',
    noMatchesEmpty: 'No matching tasks found',
    modelCallsPill: (n) => `${n} calls`,
    toolCallsPill: (n) => `${n} tools`,
    subagentPill: (n) => `${n} subagent${n > 1 ? 's' : ''}`,
    turnsCount: (n) => `${n} turn${n > 1 ? 's' : ''}`,
    subagentPrefix: (label) => `[Subagent · ${label}]`,
    phasePlanExec: (p, e) => `Plan ${p} + Exec ${e}`,
    phasePlan: (p) => `Plan ${p}`,
    phaseExec: (e) => `Exec ${e}`,
    callsLabel: (n) => `${n} call${n > 1 ? 's' : ''}`,
    toolsLabel: (n) => `${n} tool${n > 1 ? 's' : ''}`,
    trendTitle: 'Usage Trend',
    trendSummary: (sum, peak) => `Sum ${sum} · Peak ${peak}`,
    trend7d: '7D',
    trend24h: '24h',
    trendTotal: 'Total',
    trendBilled: 'Non-cached',
    trendCost: 'Cost $',
    tasksCount: (n) => `${n} task${n === 1 ? '' : 's'}`,
    budgetDaily: 'Daily Budget',
    budgetWeekly: 'Weekly Budget',
    budgetSub: (used, limit, rem) => `${used} / ${limit} · ${rem} left`,
    budgetOver: (used, limit) => `${used} / ${limit} · Over budget`,
    pricingColModel: 'Model',
    badgeCustom: 'Custom',
    badgePromo: 'Promo',
    badgeNew: 'New',
    promoTip: (u) => `Promo rate through ${u}`,
    saved: 'Saved',
    saveFailed: 'Save failed',
    pricingUpdated: 'Rates saved',
    pricingReset: 'Defaults restored',
    exported: (fmt) => `Exported ${fmt}`,
    copiedMd: 'Markdown copied',
    copyFailed: 'Copy failed',
    unknownModel: 'Unknown Model',
  },
};

const state = {
  tab: 'current',
  range: 'all', // 'today' | '7d' | '30d' | 'all'
  localePref: 'auto', // 'auto' | 'zh' | 'en'
  selectedConvId: null,
  activeConvId: null,
  userPinned: false,
  search: '',
  sort: 'recent',
  chartMode: 'daily', // 'daily' | 'hourly'
  chartMetric: 'total', // 'total' | 'billed' | 'cost'
  contextConvId: null,
  contextStepIdx: null,
  contextPinned: false,
  modelsExpanded: {
    current: false,
    global: false,
  },
  pricingDirty: false,
  data: null,
};

function getLocale() {
  if (state.localePref === 'zh' || state.localePref === 'en') return state.localePref;
  const nav = String(navigator.language || 'zh').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

function tr(key, ...args) {
  const dict = I18N[getLocale()] || I18N.zh;
  const val = dict[key];
  return typeof val === 'function' ? val(...args) : (val ?? key);
}

function applyStaticI18n() {
  const loc = getLocale();
  document.documentElement.lang = loc === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = tr(key);
  });
  const searchEl = document.getElementById('search-input');
  if (searchEl) searchEl.placeholder = tr('searchPlaceholder');

  const langBtn = document.getElementById('lang-btn');
  if (langBtn) {
    langBtn.textContent = loc === 'en' ? '中' : 'EN';
    langBtn.title = tr('langBtnTitle');
  }
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) exportBtn.title = tr('exportTitle');
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.title = tr('settingsBtnTitle');
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.title = tr('refreshBtnTitle');
}

function showToast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.hidden = true;
  }, 1800);
}

function getHostConvId() {
  const fromSdk = window.sidecar?.conversationId;
  if (typeof fromSdk === 'string' && ID_RE.test(fromSdk)) return fromSdk;
  const fromUrl = new URLSearchParams(window.location.search).get('conversationId');
  if (typeof fromUrl === 'string' && ID_RE.test(fromUrl)) return fromUrl;
  return '';
}

function getEffectiveActiveId() {
  return getHostConvId() || state.activeConvId || state.data?.conversations?.[0]?.id || '';
}

function apiFetch(url, options) {
  if (window.sidecar?.fetch) return window.sidecar.fetch(url, options);
  return fetch(url, options);
}

function fmt(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString('en-US');
}

function fmtWindow(n) {
  const num = Number(n) || 1_000_000;
  if (num >= 1_000_000) return `${Math.round(num / 1_000_000)}M`;
  return `${Math.round(num / 1_000)}k`;
}

function fmtExact(n) {
  return (Number(n) || 0).toLocaleString('en-US');
}

function fmtUsd(n) {
  const num = Number(n) || 0;
  if (num <= 0) return '$0.00';
  if (num < 0.0001) return '<$0.0001';
  if (num < 0.01) return `$${num.toFixed(4)}`;
  if (num < 0.1) return `$${num.toFixed(3)}`;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtUsdExact(n) {
  const num = Number(n) || 0;
  if (num <= 0) return '$0.00';
  if (num < 0.001) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(4)}`;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(getLocale() === 'en' ? 'en-US' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function displayModelLabel(label, key) {
  if (key === 'unknown' || label === 'Unknown Model' || label === '未识别模型') {
    return tr('unknownModel');
  }
  return label || key || tr('unknownModel');
}

function renderSparkline(values, color) {
  if (!Array.isArray(values) || values.length < 2) return '';
  const nums = values.map((v) => Math.max(0, Number(v) || 0));
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const span = max - min || 1;
  const w = 54;
  const h = 22;
  const pad = 2;
  const pts = nums.map((v, i) => {
    const x = (i / (nums.length - 1)) * (w - pad * 2) + pad;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `
    <svg class="sparkline" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" points="${pts.join(' ')}" />
    </svg>
  `;
}

function renderBudgetBar() {
  const el = document.getElementById('budget-bar');
  if (!el) return;
  const stats = state.data?.budgetStats;
  const cards = [];
  if (stats?.daily?.enabled) {
    cards.push({ label: tr('budgetDaily'), ...stats.daily });
  }
  if (stats?.weekly?.enabled) {
    cards.push({ label: tr('budgetWeekly'), ...stats.weekly });
  }
  if (!cards.length) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = cards
    .map((b) => {
      const cls = b.status === 'danger' ? 'danger' : (b.status === 'warn' ? 'warn' : '');
      const fillW = Math.min(100, Math.max(0, b.usedPct));
      const sub = b.used > b.limit
        ? tr('budgetOver', fmtUsd(b.used), fmtUsd(b.limit))
        : tr('budgetSub', fmtUsd(b.used), fmtUsd(b.limit), fmtUsd(b.remaining));
      return `
        <div class="budget-card">
          <div class="budget-head">
            <span>${esc(b.label)}</span>
            <span class="budget-pct ${cls}">${b.usedPct.toFixed(0)}%</span>
          </div>
          <div class="budget-track">
            <div class="budget-fill ${cls}" style="width:${fillW.toFixed(1)}%"></div>
          </div>
          <div class="budget-sub">${esc(sub)}</div>
        </div>
      `;
    })
    .join('');
}

function renderCards(el, stats, sparkSeries = null) {
  const total = Number(stats.totalTokens) || 0;
  const inp = Number(stats.inputTokens) || 0;
  const out = Number(stats.outputTokens) || 0;
  const cache = Number(stats.cacheReadTokens) || 0;
  const cost = Number(stats.cost) || 0;
  const inCost = Number(stats.inputCost) || 0;
  const outCost = Number(stats.outputCost) || 0;
  const cacheCost = Number(stats.cacheCost) || 0;
  const cacheSaved = Number(stats.cacheSaved) || 0;
  const unpricedCalls = Number(stats.unpricedCalls) || 0;
  const billed = inp + out;
  const hitDenom = inp + cache;
  const hitRate = hitDenom > 0 ? ((cache / hitDenom) * 100).toFixed(1) : '0.0';
  const inPct = total > 0 ? ((inp / total) * 100).toFixed(1) : '0.0';
  const outPct = total > 0 ? ((out / total) * 100).toFixed(1) : '0.0';

  const sCost = sparkSeries?.cost || null;
  const sTotal = sparkSeries?.total || null;
  const sInp = sparkSeries?.inp || null;
  const sOut = sparkSeries?.out || null;
  const sCache = sparkSeries?.cache || null;

  const backendStale = state.data && state.data.totals && typeof state.data.totals.cost !== 'number';
  const staleBanner = backendStale ? `<div class="stale-banner">${tr('staleBanner')}</div>` : '';

  el.innerHTML = `
    ${staleBanner}
    <div class="stat-card card-cost">
      <div class="stat-label">
        <span class="card-cost-title"><span class="dot dot-cost"></span>${esc(tr('costCardTitle'))}</span>
        ${unpricedCalls > 0 ? `<span class="unpriced-tag" title="${esc(tr('unpricedTooltip'))}">${esc(tr('unpricedBadge', unpricedCalls))}</span>` : ''}
      </div>
      <div class="stat-mid">
        <div class="stat-value cost-value" title="In ${fmtUsdExact(inCost)} | Out ${fmtUsdExact(outCost)} | Cache ${fmtUsdExact(cacheCost)}">${fmtUsd(cost)}</div>
        ${renderSparkline(sCost, 'var(--cost-c)')}
      </div>
      <div class="cost-sub-row">
        <span>In ${fmtUsd(inCost)} · Out ${fmtUsd(outCost)} · Cache ${fmtUsd(cacheCost)}</span>
        ${cacheSaved >= 0.001 ? `<span class="cost-saved" title="${esc(tr('cacheSavedTooltip'))}">${esc(tr('cacheSaved', fmtUsd(cacheSaved)))}</span>` : ''}
      </div>
    </div>
    <div class="stat-card card-total">
      <div class="stat-label"><span class="dot dot-total"></span>${esc(tr('totalCard'))}</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(total)}">${fmt(total)}</div>
        ${renderSparkline(sTotal, 'var(--accent)')}
      </div>
      <div class="stat-sub">${esc(tr('nonCached', fmt(billed)))}</div>
    </div>
    <div class="stat-card card-input">
      <div class="stat-label"><span class="dot dot-input"></span>${esc(tr('inputCard'))}</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(inp)}">${fmt(inp)}</div>
        ${renderSparkline(sInp, 'var(--input-c)')}
      </div>
      <div class="stat-sub">${esc(tr('sharePct', inPct))}${inCost > 0 ? ` · ${fmtUsd(inCost)}` : ''}</div>
    </div>
    <div class="stat-card card-output">
      <div class="stat-label"><span class="dot dot-output"></span>${esc(tr('outputCard'))}</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(out)}">${fmt(out)}</div>
        ${renderSparkline(sOut, 'var(--output-c)')}
      </div>
      <div class="stat-sub">${esc(tr('sharePct', outPct))}${outCost > 0 ? ` · ${fmtUsd(outCost)}` : ''}</div>
    </div>
    <div class="stat-card card-cache">
      <div class="stat-label"><span class="dot dot-cache"></span>${esc(tr('cacheCard'))}</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(cache)}">${fmt(cache)}</div>
        ${renderSparkline(sCache, 'var(--cache-c)')}
      </div>
      <div class="stat-sub">${esc(tr('hitRate', hitRate))}${cacheCost > 0 ? ` · ${fmtUsd(cacheCost)}` : ''}</div>
    </div>
  `;
}

function renderModelBreakdown(el, breakdown, title, sectionKey) {
  if (!el) return;
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }

  el.hidden = false;
  const expanded = Boolean(state.modelsExpanded[sectionKey]);
  el.classList.toggle('is-collapsed', !expanded);
  const totalCost = breakdown.reduce((sum, m) => sum + (Number(m.cost) || 0), 0);
  const totalToks = breakdown.reduce((sum, m) => sum + (Number(m.totalTokens) || 0), 0);

  const rowsHtml = expanded
    ? breakdown
      .map((m) => {
        const sharePct = totalCost > 0
          ? ((m.cost / totalCost) * 100)
          : (totalToks > 0 ? ((m.totalTokens / totalToks) * 100) : 0);
        const widthPct = Math.max(sharePct > 0 ? 3 : 0, Math.min(100, sharePct));
        const tip = `In ${fmt(m.inputTokens)} (${fmtUsdExact(m.inputCost)}) | Out ${fmt(m.outputTokens)} (${fmtUsdExact(m.outputCost)}) | Cache ${fmt(m.cacheReadTokens)} (${fmtUsdExact(m.cacheCost)})`;
        return `
          <div class="model-row" title="${esc(tip)}">
            <div class="model-row-top">
              <span class="model-row-name">
                ${esc(displayModelLabel(m.label, m.modelKey))}
                ${!m.priced ? `<span class="unpriced-tag">${esc(tr('unpricedTag'))}</span>` : ''}
              </span>
              <span class="model-row-stats">
                <span class="model-row-tokens">${esc(tr('callsSuffix', m.calls))} · ${fmt(m.totalTokens)}</span>
                <span class="model-row-cost">${m.priced ? fmtUsd(m.cost) : '—'}</span>
              </span>
            </div>
            <div class="model-bar-track">
              <div class="model-bar-fill" style="width:${widthPct.toFixed(1)}%"></div>
            </div>
          </div>
        `;
      })
      .join('')
    : '';

  el.innerHTML = `
    <button type="button" class="collapse-head" aria-expanded="${expanded}">
      <span class="chart-title">
        <svg class="collapse-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        <span>${esc(title)}</span>
        <span class="muted">${esc(tr('modelCount', breakdown.length))}</span>
      </span>
      <span class="collapse-right">
        <span class="model-row-cost">${fmtUsd(totalCost)}</span>
        <span class="muted">${esc(expanded ? tr('collapse') : tr('expand'))}</span>
      </span>
    </button>
    ${expanded ? `<div class="model-list">${rowsHtml}</div>` : ''}
  `;

  el.querySelector('.collapse-head')?.addEventListener('click', () => {
    state.modelsExpanded[sectionKey] = !state.modelsExpanded[sectionKey];
    renderModelBreakdown(el, breakdown, title, sectionKey);
  });
}

function renderBar(inp, out, cache) {
  const total = inp + out + cache;
  if (!total) return '';
  const pIn = ((inp / total) * 100).toFixed(2);
  const pOut = ((out / total) * 100).toFixed(2);
  const pCache = ((cache / total) * 100).toFixed(2);
  return `
    <div class="bar" title="Input ${fmtExact(inp)} | Output ${fmtExact(out)} | Cache ${fmtExact(cache)}">
      <div class="bar-input" style="width:${pIn}%"></div>
      <div class="bar-output" style="width:${pOut}%"></div>
      <div class="bar-cache" style="width:${pCache}%"></div>
    </div>
  `;
}

function renderContextChart(cur) {
  const el = document.getElementById('context-chart');
  if (!el) return;
  const steps = cur?.contextSteps;
  if (!Array.isArray(steps) || steps.length < 2) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }

  el.hidden = false;
  if (state.contextConvId !== cur.id) {
    state.contextConvId = cur.id;
    state.contextStepIdx = steps.length - 1;
    state.contextPinned = false;
  } else if (!state.contextPinned || state.contextStepIdx == null || state.contextStepIdx >= steps.length) {
    state.contextStepIdx = steps.length - 1;
  }

  const n = steps.length;
  const activeIdx = Math.max(0, Math.min(n - 1, state.contextStepIdx));
  const peak = Math.max(...steps.map((s) => s.context), 1);
  const maxVal = peak * 1.12;
  const latest = steps[n - 1];
  const ctxWindow = Number(cur.contextWindow) || 1_000_000;
  const windowPct = Math.min(100, (latest.context / ctxWindow) * 100);
  const windowPctStr = windowPct >= 10 ? windowPct.toFixed(1) : windowPct.toFixed(1);

  let warnHtml = '';
  if (windowPct >= 75) {
    warnHtml = `<div class="ctx-warn is-danger">${esc(tr('ctxWarnHigh', windowPctStr))}</div>`;
  } else if (windowPct >= 50 || latest.context >= 250_000) {
    warnHtml = `<div class="ctx-warn">${esc(tr('ctxWarnMed', windowPctStr))}</div>`;
  }

  const W = 320;
  const H = 92;
  const padL = 4;
  const padR = 36;
  const padT = 8;
  const padB = 6;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const coords = steps.map((s, i) => {
    const x = padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
    const y = padT + plotH - (s.context / maxVal) * plotH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const lineD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${lineD} L ${coords[n - 1].x} ${padT + plotH} L ${coords[0].x} ${padT + plotH} Z`;
  const midY = (padT + plotH / 2).toFixed(1);
  const baseY = (padT + plotH).toFixed(1);

  el.innerHTML = `
    <div class="chart-head">
      <div class="chart-title">
        <span>${esc(tr('ctxTitle'))}</span>
        <span class="muted">${esc(tr('ctxSummary', fmt(latest.context), fmtWindow(ctxWindow), windowPctStr, fmt(peak)))}</span>
      </div>
      <span class="ctx-step-badge" id="ctx-step-badge">${activeIdx + 1}/${n}</span>
    </div>
    <div class="ctx-svg-wrap">
      <svg class="ctx-svg" id="ctx-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ctxGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#059669" stop-opacity="0.32" />
            <stop offset="100%" stop-color="#059669" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <line x1="${padL}" y1="${padT}" x2="${padL + plotW}" y2="${padT}" stroke="currentColor" stroke-opacity="0.14" stroke-dasharray="2 2" />
        <line x1="${padL}" y1="${midY}" x2="${padL + plotW}" y2="${midY}" stroke="currentColor" stroke-opacity="0.14" stroke-dasharray="2 2" />
        <line x1="${padL}" y1="${baseY}" x2="${padL + plotW}" y2="${baseY}" stroke="currentColor" stroke-opacity="0.2" />
        <text x="${W - 2}" y="${padT + 4}" text-anchor="end" fill="currentColor" fill-opacity="0.55" font-size="9">${fmt(peak)}</text>
        <text x="${W - 2}" y="${Number(midY) + 3}" text-anchor="end" fill="currentColor" fill-opacity="0.55" font-size="9">${fmt(Math.round(peak / 2))}</text>
        <path d="${areaD}" fill="url(#ctxGrad)" />
        <path d="${lineD}" fill="none" stroke="#059669" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />
        <line id="ctx-guide" x1="${coords[activeIdx].x}" y1="${padT}" x2="${coords[activeIdx].x}" y2="${baseY}" stroke="#2563eb" stroke-width="1" stroke-dasharray="2 2" />
        <circle id="ctx-dot" cx="${coords[activeIdx].x}" cy="${coords[activeIdx].y}" r="3.2" fill="#059669" stroke="#fff" stroke-width="1.2" />
      </svg>
    </div>
    <div class="ctx-scrubber-row">
      <input id="ctx-scrubber" class="ctx-scrubber" type="range" min="0" max="${n - 1}" value="${activeIdx}">
    </div>
    <div class="ctx-detail" id="ctx-detail"></div>
    ${warnHtml}
  `;

  const updateActive = (idx, pin) => {
    const clamped = Math.max(0, Math.min(n - 1, idx));
    state.contextStepIdx = clamped;
    if (pin) state.contextPinned = clamped < n - 1;
    const s = steps[clamped];
    const p = coords[clamped];
    const guide = el.querySelector('#ctx-guide');
    const dot = el.querySelector('#ctx-dot');
    const badge = el.querySelector('#ctx-step-badge');
    const detail = el.querySelector('#ctx-detail');
    const scrubber = el.querySelector('#ctx-scrubber');
    if (guide) {
      guide.setAttribute('x1', p.x);
      guide.setAttribute('x2', p.x);
    }
    if (dot) {
      dot.setAttribute('cx', p.x);
      dot.setAttribute('cy', p.y);
    }
    if (badge) badge.textContent = `${clamped + 1}/${n}`;
    if (scrubber) scrubber.value = String(clamped);
    if (detail) {
      detail.innerHTML = `
        <span class="ctx-chip"><b>${esc(tr('ctxStep', s.step))}</b>${s.modelLabel && s.modelKey !== 'unknown' ? ` · ${esc(s.modelLabel)}` : ''}</span>
        ${s.cost > 0 ? `<span class="ctx-chip">${esc(tr('ctxCost'))} <b>${fmtUsd(s.cost)}</b></span>` : ''}
        <span class="ctx-chip">${esc(tr('ctxContext'))} <b>${fmt(s.context)}</b> (In ${fmt(s.inp)} + Cache ${fmt(s.cache)})</span>
        <span class="ctx-chip">Out <b>${fmt(s.out)}</b>${s.tools ? ` · ${esc(tr('ctxTools'))} <b>${s.tools}</b>` : ''}</span>
      `;
    }
  };

  updateActive(activeIdx, false);

  const scrubberEl = el.querySelector('#ctx-scrubber');
  scrubberEl?.addEventListener('input', (e) => {
    updateActive(Number(e.target.value), true);
  });

  const svgEl = el.querySelector('#ctx-svg');
  svgEl?.addEventListener('click', (e) => {
    const rect = svgEl.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = Math.max(0, Math.min(1, (relX - padL) / plotW));
    updateActive(Math.round(ratio * (n - 1)), true);
  });
}

function formatModelsSummary(models) {
  if (!Array.isArray(models) || !models.length) return '';
  if (models.length <= 2) return models.join(' / ');
  return `${models.slice(0, 2).join(' / ')} +${models.length - 2}`;
}

function formatTurnPhase(t) {
  if (t.planCalls > 0 && t.execCalls > 0) return tr('phasePlanExec', t.planCalls, t.execCalls);
  if (t.planCalls > 0) return tr('phasePlan', t.planCalls);
  if (t.execCalls > 0) return tr('phaseExec', t.execCalls);
  if (t.phaseSummary) return t.phaseSummary;
  return tr('callsLabel', t.modelCalls);
}

function renderCurrent() {
  const banner = document.getElementById('current-header');
  const cards = document.getElementById('current-cards');
  const modelsEl = document.getElementById('current-models');
  const turnsEl = document.getElementById('turns-list');
  const countEl = document.getElementById('turn-count');

  const hostConvId = getHostConvId();
  const effectiveActiveId = getEffectiveActiveId();
  const cur = state.data?.current;
  if (!cur) {
    if (!state.userPinned && hostConvId) {
      banner.innerHTML = `
        <div class="conv-banner-title">${esc(tr('inferringTitle'))}</div>
        <div class="conv-banner-meta">
          <span class="badge">${esc(tr('liveBadge'))}</span>
          <span>ID: ${esc(hostConvId.slice(0, 8))}</span>
        </div>
      `;
      renderCards(cards, { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cost: 0 });
      renderModelBreakdown(modelsEl, [], tr('sessionModelsTitle'), 'current');
      renderContextChart(null);
      countEl.textContent = '';
      turnsEl.innerHTML = `<div class="empty">${esc(tr('inferringEmpty'))}</div>`;
      return;
    }
    banner.innerHTML = `<div class="conv-banner-title">${esc(tr('noCurrentTitle'))}</div><div class="conv-banner-meta">${esc(tr('noCurrentSub'))}</div>`;
    renderCards(cards, { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cost: 0 });
    renderModelBreakdown(modelsEl, [], tr('sessionModelsTitle'), 'current');
    renderContextChart(null);
    countEl.textContent = '';
    turnsEl.innerHTML = `<div class="empty">${esc(tr('noCallsEmpty'))}</div>`;
    return;
  }

  const isLive = Boolean(effectiveActiveId && cur.id === effectiveActiveId);
  const modelSummary = formatModelsSummary(cur.models);
  banner.innerHTML = `
    <div class="conv-banner-title">${esc(cur.title)}</div>
    <div class="conv-banner-meta">
      ${isLive ? `<span class="badge">${esc(tr('liveBadge'))}</span>` : `<button class="link-btn" id="back-active">${esc(tr('backActive'))}</button>`}
      ${modelSummary ? `<span class="model-pill">${esc(modelSummary)}</span>` : ''}
      <span class="meta-pill">ID ${esc(cur.id.slice(0, 8))}</span>
      <span class="meta-pill">${esc(tr('modelCallsPill', cur.modelCalls))}</span>
      ${cur.toolCalls ? `<span class="meta-pill">${esc(tr('toolCallsPill', cur.toolCalls))}</span>` : ''}
      ${cur.subagentCount ? `<span class="meta-pill">${esc(tr('subagentPill', cur.subagentCount))}</span>` : ''}
      <span class="meta-pill">${fmtTime(cur.updatedAt)}</span>
    </div>
  `;

  const stepSpark = cur.contextSteps?.length >= 2 ? {
    cost: cur.contextSteps.map((s) => s.cost || 0),
    total: cur.contextSteps.map((s) => s.inp + s.out + s.cache),
    inp: cur.contextSteps.map((s) => s.inp),
    out: cur.contextSteps.map((s) => s.out),
    cache: cur.contextSteps.map((s) => s.cache),
  } : null;

  renderCards(cards, cur, stepSpark);
  const showCurrentModels = Array.isArray(cur.modelBreakdown) && (cur.modelBreakdown.length > 1 || (cur.modelBreakdown.length === 1 && cur.subagentCount > 0));
  renderModelBreakdown(modelsEl, showCurrentModels ? cur.modelBreakdown : [], tr('sessionModelsTitle'), 'current');
  renderContextChart(cur);
  countEl.textContent = tr('turnsCount', cur.turns.length);

  if (!cur.turns.length) {
    turnsEl.innerHTML = `<div class="empty">${esc(tr('noTurnsEmpty'))}</div>`;
    return;
  }

  turnsEl.innerHTML = [...cur.turns]
    .reverse()
    .map((t) => {
      const turnModels = formatModelsSummary(t.models);
      const hasCost = Number(t.cost) > 0;
      const promptText = t.isSubagent
        ? `${tr('subagentPrefix', t.subagentLabel || 'subagent')} ${t.prompt}`
        : t.prompt;
      return `
        <div class="item">
          <div class="item-top">
            <div class="item-title"><span class="turn-num">#${t.index}</span>${esc(promptText)}</div>
            <div class="item-right">
              ${hasCost ? `<div class="item-cost" title="In ${fmtUsdExact(t.inputCost)} | Out ${fmtUsdExact(t.outputCost)} | Cache ${fmtUsdExact(t.cacheCost)}">${fmtUsd(t.cost)}</div>` : ''}
              <div class="item-total" title="${fmtExact(t.totalTokens)}">${fmt(t.totalTokens)}</div>
            </div>
          </div>
          <div class="item-meta">
            ${turnModels ? `<span class="model-tag">${esc(turnModels)}</span>` : ''}
            <span>In: ${fmt(t.inputTokens)}</span>
            <span>Out: ${fmt(t.outputTokens)}</span>
            <span>Cache: ${fmt(t.cacheReadTokens)}</span>
            <span>${esc(formatTurnPhase(t))}</span>
            ${t.toolCalls ? `<span>${esc(tr('toolsLabel', t.toolCalls))}</span>` : ''}
            <span>${fmtTime(t.createdAt)}</span>
          </div>
          ${renderBar(t.inputTokens, t.outputTokens, t.cacheReadTokens)}
        </div>
      `;
    })
    .join('');
}

function renderTrendChart() {
  const el = document.getElementById('trend-chart');
  if (!el) return;
  const buckets = state.data?.series?.[state.chartMode] || [];
  const isCost = state.chartMetric === 'cost';
  const isBilled = state.chartMetric === 'billed';
  const fmtVal = isCost ? fmtUsd : fmt;

  const getBucketVal = (b) => {
    if (isCost) return Number(b.cost) || 0;
    if (isBilled) return Number(b.billedTokens) || 0;
    return Number(b.totalTokens) || 0;
  };

  const values = buckets.map(getBucketVal);
  const maxVal = Math.max(0, ...values);
  const sumVal = values.reduce((a, b) => a + b, 0);
  const n = buckets.length;

  const colsHtml = buckets
    .map((b, i) => {
      const val = getBucketVal(b);
      const hPct = maxVal > 0 ? Math.max(val > 0 ? 4 : 0, (val / maxVal) * 100) : 0;
      const pIn = val > 0 ? ((isCost ? b.inputCost : b.inputTokens) / val) * 100 : 0;
      const pOut = val > 0 ? ((isCost ? b.outputCost : b.outputTokens) / val) * 100 : 0;
      const pCache = !isBilled && val > 0 ? ((isCost ? b.cacheCost : b.cacheReadTokens) / val) * 100 : 0;
      const tip = isCost
        ? `${b.label} · ${fmtUsdExact(b.cost)} (In ${fmtUsd(b.inputCost)} / Out ${fmtUsd(b.outputCost)} / Cache ${fmtUsd(b.cacheCost)})`
        : `${b.label} · ${fmtExact(val)} (In ${fmt(b.inputTokens)} / Out ${fmt(b.outputTokens)}${isBilled ? '' : ` / Cache ${fmt(b.cacheReadTokens)}`})`;
      const showLabel = state.chartMode === 'daily' || i % 6 === 0 || i === n - 1;

      const isLast = i === n - 1;
      return `
        <div class="chart-col ${isLast ? 'is-today' : ''}" data-tip="${esc(tip)}">
          <div class="chart-bar-wrap">
            ${val > 0 ? `
              <div class="chart-bar" style="height:${hPct.toFixed(1)}%">
                <span class="chart-val">${fmtVal(val)}</span>
                ${pIn > 0 ? `<div class="chart-seg chart-seg-in" style="flex:${pIn.toFixed(2)}"></div>` : ''}
                ${pOut > 0 ? `<div class="chart-seg chart-seg-out" style="flex:${pOut.toFixed(2)}"></div>` : ''}
                ${pCache > 0 ? `<div class="chart-seg chart-seg-cache" style="flex:${pCache.toFixed(2)}"></div>` : ''}
              </div>
            ` : `<div class="chart-bar-empty"></div>`}
          </div>
          <div class="chart-label">${showLabel ? esc(b.label) : ''}</div>
        </div>
      `;
    })
    .join('');

  const defaultLegend = `
    <span class="chart-legend-items">
      <span><i class="dot dot-input"></i>Input${isCost ? ' $' : ''}</span>
      <span><i class="dot dot-output"></i>Output${isCost ? ' $' : ''}</span>
      ${isBilled ? '' : `<span><i class="dot dot-cache"></i>Cache${isCost ? ' $' : ''}</span>`}
    </span>
  `;

  el.innerHTML = `
    <div class="chart-head">
      <div class="chart-title">
        <span>${esc(tr('trendTitle'))}</span>
        <span class="muted">${esc(tr('trendSummary', fmtVal(sumVal), fmtVal(maxVal)))}</span>
      </div>
      <div class="chart-controls">
        <div class="seg">
          <button class="seg-btn ${state.chartMode === 'daily' ? 'active' : ''}" data-chart-mode="daily">${esc(tr('trend7d'))}</button>
          <button class="seg-btn ${state.chartMode === 'hourly' ? 'active' : ''}" data-chart-mode="hourly">${esc(tr('trend24h'))}</button>
        </div>
        <div class="seg">
          <button class="seg-btn ${state.chartMetric === 'total' ? 'active' : ''}" data-chart-metric="total">${esc(tr('trendTotal'))}</button>
          <button class="seg-btn ${state.chartMetric === 'billed' ? 'active' : ''}" data-chart-metric="billed">${esc(tr('trendBilled'))}</button>
          <button class="seg-btn ${state.chartMetric === 'cost' ? 'active' : ''}" data-chart-metric="cost">${esc(tr('trendCost'))}</button>
        </div>
      </div>
    </div>
    <div class="chart-body">
      <div class="chart-grid">
        <div class="chart-grid-line"><span>${maxVal > 0 ? fmtVal(maxVal) : ''}</span></div>
        <div class="chart-grid-line"><span>${maxVal > 0 ? fmtVal(isCost ? maxVal / 2 : Math.round(maxVal / 2)) : ''}</span></div>
        <div class="chart-grid-line"></div>
      </div>
      <div class="chart-cols ${state.chartMode === 'hourly' ? 'is-hourly' : ''}">${colsHtml}</div>
    </div>
    <div class="chart-footer" id="chart-footer">${defaultLegend}</div>
  `;

  const footerEl = el.querySelector('#chart-footer');
  el.querySelectorAll('.chart-col').forEach((col) => {
    col.addEventListener('mouseenter', () => {
      if (footerEl) footerEl.textContent = col.dataset.tip || '';
    });
    col.addEventListener('mouseleave', () => {
      if (footerEl) footerEl.innerHTML = defaultLegend;
    });
  });

  el.querySelectorAll('[data-chart-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.chartMode = btn.dataset.chartMode;
      renderTrendChart();
    });
  });
  el.querySelectorAll('[data-chart-metric]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.chartMetric = btn.dataset.chartMetric;
      renderTrendChart();
    });
  });
}

function renderHistory() {
  const cards = document.getElementById('global-cards');
  const modelsEl = document.getElementById('global-models');
  const listEl = document.getElementById('history-list');
  const rangeSummaryEl = document.getElementById('range-summary');
  const totals = state.data?.totals || { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cost: 0 };

  document.querySelectorAll('#range-bar [data-range]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.range === state.range);
  });

  renderBudgetBar();

  const sparkBuckets = state.range === 'today' ? state.data?.series?.hourly : state.data?.series?.daily;
  const spark = Array.isArray(sparkBuckets) && sparkBuckets.length >= 2 ? {
    cost: sparkBuckets.map((d) => d.cost || 0),
    total: sparkBuckets.map((d) => d.totalTokens),
    inp: sparkBuckets.map((d) => d.inputTokens),
    out: sparkBuckets.map((d) => d.outputTokens),
    cache: sparkBuckets.map((d) => d.cacheReadTokens),
  } : null;

  renderCards(cards, totals, spark);
  renderTrendChart();
  renderModelBreakdown(modelsEl, state.data?.modelBreakdown || [], tr('globalModelsTitle'), 'global');

  let items = [...(state.data?.conversations || [])];
  if (rangeSummaryEl) rangeSummaryEl.textContent = tr('tasksCount', items.length);

  const q = state.search.trim().toLowerCase();
  if (q) {
    items = items.filter((c) => {
      const modelsText = Array.isArray(c.models) ? c.models.join(' ').toLowerCase() : '';
      return c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || modelsText.includes(q);
    });
  }

  if (state.sort === 'cost') {
    items.sort((a, b) => (b.cost || 0) - (a.cost || 0) || b.totalTokens - a.totalTokens);
  } else if (state.sort === 'total') {
    items.sort((a, b) => b.totalTokens - a.totalTokens);
  } else if (state.sort === 'billed') {
    items.sort((a, b) => b.billedTokens - a.billedTokens);
  } else {
    items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  if (!items.length) {
    listEl.innerHTML = `<div class="empty">${esc(tr('noMatchesEmpty'))}</div>`;
    return;
  }

  const effectiveActiveId = getEffectiveActiveId();
  const currentShownId = state.data?.current?.id || state.selectedConvId || effectiveActiveId;

  listEl.innerHTML = items
    .map((c) => {
      const isSelected = c.id === currentShownId;
      const isLive = Boolean(effectiveActiveId && c.id === effectiveActiveId);
      const modelSummary = formatModelsSummary(c.models);
      const hasCost = Number(c.cost) > 0;
      return `
        <div class="item clickable ${isSelected ? 'is-active' : ''}" data-conv-id="${esc(c.id)}">
          <div class="item-top">
            <div class="item-title">${isLive ? `<span class="badge">${esc(tr('liveShort'))}</span> ` : ''}${esc(c.title)}</div>
            <div class="item-right">
              ${hasCost ? `<div class="item-cost" title="In ${fmtUsdExact(c.inputCost)} | Out ${fmtUsdExact(c.outputCost)} | Cache ${fmtUsdExact(c.cacheCost)}">${fmtUsd(c.cost)}</div>` : ''}
              <div class="item-total" title="${fmtExact(c.totalTokens)}">${fmt(c.totalTokens)}</div>
            </div>
          </div>
          <div class="item-meta">
            ${modelSummary ? `<span class="model-tag">${esc(modelSummary)}</span>` : ''}
            <span>In: ${fmt(c.inputTokens)}</span>
            <span>Out: ${fmt(c.outputTokens)}</span>
            <span>Cache: ${fmt(c.cacheReadTokens)}${typeof c.cacheHitRate === 'number' ? ` (${c.cacheHitRate}%)` : ''}</span>
            <span>${esc(tr('turnsCount', c.turnCount))} / ${esc(tr('callsSuffix', c.modelCalls))}</span>
            <span>${fmtTime(c.updatedAt)}</span>
          </div>
          ${renderBar(c.inputTokens, c.outputTokens, c.cacheReadTokens)}
        </div>
      `;
    })
    .join('');

  for (const el of listEl.querySelectorAll('[data-conv-id]')) {
    el.addEventListener('click', () => {
      const clickedId = el.getAttribute('data-conv-id');
      state.selectedConvId = clickedId;
      state.userPinned = Boolean(clickedId && clickedId !== getEffectiveActiveId());
      switchTab('current');
      fetchTokens();
    });
  }
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.getElementById('view-current').classList.toggle('active', tab === 'current');
  document.getElementById('view-history').classList.toggle('active', tab === 'history');
}

function renderPricingTable() {
  const tableEl = document.getElementById('pricing-table');
  const catalog = state.data?.pricingCatalog;
  if (!tableEl || !Array.isArray(catalog)) return;
  if (state.pricingDirty || document.activeElement?.closest('#pricing-table')) return;

  const rowsHtml = catalog
    .map((m) => {
      let badge = '';
      if (m.isCustom) {
        badge = `<span class="pricing-badge is-custom">${esc(tr('badgeCustom'))}</span>`;
      } else if (m.isUnpriced) {
        badge = `<span class="pricing-badge is-new">${esc(tr('badgeNew'))}</span>`;
      } else if (m.isPromoActive) {
        badge = `<span class="pricing-badge" title="${esc(tr('promoTip', m.promo?.until || ''))}">${esc(tr('badgePromo'))}</span>`;
      }
      const inVal = m.effective?.input ?? '';
      const outVal = m.effective?.output ?? '';
      const cacheVal = m.effective?.cacheRead ?? '';
      return `
        <div class="pricing-row" data-model-key="${esc(m.key)}">
          <div class="pricing-model-name" title="${esc(m.key)}">${esc(m.label)}${badge}</div>
          <input class="pricing-input" data-field="input" type="number" step="0.01" min="0" placeholder="—" value="${inVal}">
          <input class="pricing-input" data-field="output" type="number" step="0.01" min="0" placeholder="—" value="${outVal}">
          <input class="pricing-input" data-field="cacheRead" type="number" step="0.005" min="0" placeholder="—" value="${cacheVal}">
        </div>
      `;
    })
    .join('');

  tableEl.innerHTML = `
    <div class="pricing-head">
      <span>${esc(tr('pricingColModel'))}</span>
      <span>Input</span>
      <span>Output</span>
      <span>Cache</span>
    </div>
    ${rowsHtml}
  `;

  tableEl.querySelectorAll('.pricing-input').forEach((input) => {
    input.addEventListener('input', () => {
      state.pricingDirty = true;
    });
  });
}

function renderSettings() {
  const h = state.data?.settings?.hook;
  const p = state.data?.settings?.pricing;
  const b = state.data?.settings?.budget;
  if (h) {
    document.getElementById('opt-session-total').checked = Boolean(h.showSessionTotal);
    document.getElementById('opt-hook-cost').checked = h.showCost !== false;
  }
  if (p) {
    document.getElementById('opt-promo-pricing').checked = p.usePromoPricing !== false;
  }
  if (b) {
    const dailyEl = document.getElementById('opt-budget-daily');
    const weeklyEl = document.getElementById('opt-budget-weekly');
    if (dailyEl && document.activeElement !== dailyEl) dailyEl.value = b.dailyUsd > 0 ? String(b.dailyUsd) : '';
    if (weeklyEl && document.activeElement !== weeklyEl) weeklyEl.value = b.weeklyUsd > 0 ? String(b.weeklyUsd) : '';
  }
  renderPricingTable();
}

function showSettingsStatus(text) {
  const statusEl = document.getElementById('settings-status');
  if (!statusEl) return;
  statusEl.textContent = text;
  setTimeout(() => {
    if (statusEl.textContent === text) statusEl.textContent = '';
  }, 1800);
}

async function postSettings(payload, okMessage = tr('saved')) {
  try {
    const res = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const updated = await res.json();
      if (state.data) {
        state.data.settings = {
          hook: updated.hook,
          pricing: updated.pricing,
          budget: updated.budget,
          ui: updated.ui,
        };
        if (updated.pricingCatalog) {
          state.data.pricingCatalog = updated.pricingCatalog;
        }
      }
      state.pricingDirty = false;
      showSettingsStatus(okMessage);
      await fetchTokens();
    } else {
      showSettingsStatus(tr('saveFailed'));
    }
  } catch {
    showSettingsStatus(tr('saveFailed'));
  }
}

async function saveToggleSettings() {
  const dailyVal = Number(document.getElementById('opt-budget-daily')?.value || 0);
  const weeklyVal = Number(document.getElementById('opt-budget-weekly')?.value || 0);
  await postSettings({
    hook: {
      showSessionTotal: document.getElementById('opt-session-total').checked,
      showCost: document.getElementById('opt-hook-cost').checked,
    },
    pricing: {
      usePromoPricing: document.getElementById('opt-promo-pricing').checked,
    },
    budget: {
      dailyUsd: Number.isFinite(dailyVal) && dailyVal >= 0 ? dailyVal : 0,
      weeklyUsd: Number.isFinite(weeklyVal) && weeklyVal >= 0 ? weeklyVal : 0,
    },
  });
}

async function savePricingOverrides() {
  const catalog = state.data?.pricingCatalog || [];
  const byKey = new Map(catalog.map((m) => [m.key, m]));
  const overrides = {};
  const usePromo = document.getElementById('opt-promo-pricing').checked;

  document.querySelectorAll('#pricing-table .pricing-row').forEach((row) => {
    const key = row.dataset.modelKey;
    const rawIn = row.querySelector('[data-field="input"]')?.value ?? '';
    const rawOut = row.querySelector('[data-field="output"]')?.value ?? '';
    const rawCache = row.querySelector('[data-field="cacheRead"]')?.value ?? '';
    if (rawIn === '' && rawOut === '' && rawCache === '') return;

    const input = Number(rawIn);
    const output = Number(rawOut);
    const cacheRead = rawCache === '' ? 0 : Number(rawCache);
    if (!Number.isFinite(input) || !Number.isFinite(output) || !Number.isFinite(cacheRead)) return;
    if (input < 0 || output < 0 || cacheRead < 0) return;

    const meta = byKey.get(key);
    const promoValid = Boolean(meta?.promo && Date.now() < Date.parse(`${meta.promo.until}T23:59:59.999Z`));
    const baseline = (usePromo && promoValid) ? meta.promo : meta?.standard;
    const isModified = !baseline
      || Math.abs(input - baseline.input) > 1e-6
      || Math.abs(output - baseline.output) > 1e-6
      || Math.abs(cacheRead - baseline.cacheRead) > 1e-6;

    if (isModified) {
      overrides[key] = { input, output, cacheRead };
    }
  });

  await postSettings(
    {
      pricing: {
        usePromoPricing: usePromo,
        overrides,
      },
    },
    tr('pricingUpdated'),
  );
}

async function resetPricingOverrides() {
  state.pricingDirty = false;
  await postSettings(
    {
      pricing: {
        usePromoPricing: true,
        overrides: {},
      },
    },
    tr('pricingReset'),
  );
}

async function handleExport(mode) {
  const menu = document.getElementById('export-menu');
  const btn = document.getElementById('export-btn');
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');

  const format = mode === 'csv' ? 'csv' : 'md';
  try {
    const res = await apiFetch(`/api/export?format=${format}&range=${encodeURIComponent(state.range)}`);
    if (!res.ok) throw new Error('export failed');
    const text = await res.text();

    if (mode === 'copy') {
      try {
        await navigator.clipboard.writeText(text);
        showToast(tr('copiedMd'));
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast(tr('copiedMd'));
      }
      return;
    }

    const mime = format === 'csv' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8';
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `token-tracker-${state.range}-${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(tr('exported', format.toUpperCase()));
  } catch {
    showToast(tr('copyFailed'));
  }
}

function renderAll() {
  applyStaticI18n();
  renderCurrent();
  renderHistory();
  renderSettings();
}

async function fetchTokens() {
  const hostConvId = getHostConvId();
  const targetId = state.userPinned
    ? state.selectedConvId
    : (hostConvId || state.selectedConvId || '');
  const params = new URLSearchParams();
  if (targetId) params.set('conversationId', targetId);
  params.set('range', state.range);

  try {
    const res = await apiFetch(`/api/tokens?${params.toString()}`);
    if (!res.ok) return;
    let data = await res.json();

    if (!state.userPinned && !hostConvId) {
      const latestId = data.activeConversationId || data.conversations?.[0]?.id || '';
      if (latestId && data.current?.id !== latestId) {
        state.selectedConvId = latestId;
        params.set('conversationId', latestId);
        const retry = await apiFetch(`/api/tokens?${params.toString()}`);
        if (retry.ok) data = await retry.json();
      } else if (latestId) {
        state.selectedConvId = latestId;
      }
    } else if (!state.userPinned && hostConvId) {
      state.selectedConvId = hostConvId;
    }

    state.data = data;
    if (data.settings?.ui?.locale) {
      state.localePref = data.settings.ui.locale;
    }
    state.activeConvId = hostConvId || data.activeConversationId || data.conversations?.[0]?.id || null;
    renderAll();
  } catch {
    // ignore transient poll errors
  }
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.querySelectorAll('#range-bar [data-range]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const nextRange = btn.dataset.range;
    if (!nextRange || nextRange === state.range) return;
    state.range = nextRange;
    fetchTokens();
  });
});

document.getElementById('lang-btn').addEventListener('click', async () => {
  const nextLocale = getLocale() === 'en' ? 'zh' : 'en';
  state.localePref = nextLocale;
  renderAll();
  await postSettings({ ui: { locale: nextLocale } });
});

document.getElementById('export-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('export-menu');
  const btn = document.getElementById('export-btn');
  const nextHidden = !menu.hidden;
  menu.hidden = nextHidden;
  btn.setAttribute('aria-expanded', String(!nextHidden));
});

document.querySelectorAll('#export-menu [data-export]').forEach((btn) => {
  btn.addEventListener('click', () => handleExport(btn.dataset.export));
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.export-wrap')) {
    const menu = document.getElementById('export-menu');
    const btn = document.getElementById('export-btn');
    if (menu && !menu.hidden) {
      menu.hidden = true;
      btn?.setAttribute('aria-expanded', 'false');
    }
  }
});

document.getElementById('refresh-btn').addEventListener('click', fetchTokens);
document.getElementById('current-header').addEventListener('click', (e) => {
  if (e.target.closest('#back-active')) {
    state.userPinned = false;
    state.selectedConvId = getHostConvId() || state.data?.conversations?.[0]?.id || null;
    fetchTokens();
  }
});
document.getElementById('settings-btn').addEventListener('click', () => {
  const panel = document.getElementById('settings-panel');
  const btn = document.getElementById('settings-btn');
  const nextHidden = !panel.hidden;
  panel.hidden = nextHidden;
  btn.setAttribute('aria-expanded', String(!nextHidden));
});
document.getElementById('opt-session-total').addEventListener('change', saveToggleSettings);
document.getElementById('opt-hook-cost').addEventListener('change', saveToggleSettings);
document.getElementById('opt-promo-pricing').addEventListener('change', saveToggleSettings);
document.getElementById('opt-budget-daily').addEventListener('change', saveToggleSettings);
document.getElementById('opt-budget-weekly').addEventListener('change', saveToggleSettings);
document.getElementById('save-pricing-btn').addEventListener('click', savePricingOverrides);
document.getElementById('reset-pricing-btn').addEventListener('click', resetPricingOverrides);
document.getElementById('search-input').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderHistory();
});
document.getElementById('sort-select').addEventListener('change', (e) => {
  state.sort = e.target.value;
  renderHistory();
});

applyStaticI18n();
fetchTokens();
setInterval(() => {
  if (!document.hidden) fetchTokens();
}, 3000);
