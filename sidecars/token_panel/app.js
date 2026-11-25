const ID_RE = /^[0-9a-f-]{8,}$/i;

const state = {
  tab: 'current',
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
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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
  const staleBanner = backendStale
    ? `<div class="stale-banner">Sidecar 后端尚未重启，仍返回旧版接口数据；请在插件管理中关闭再重新启用 <b>token-tracker</b>（或重启 Antigravity）以加载费用统计。</div>`
    : '';

  el.innerHTML = `
    ${staleBanner}
    <div class="stat-card card-cost">
      <div class="stat-label">
        <span class="card-cost-title"><span class="dot dot-cost"></span>估算 API 费用 (USD)</span>
        ${unpricedCalls > 0 ? `<span class="unpriced-tag" title="早期日志中未记录模型的调用未计入费用">含 ${unpricedCalls} 次未识别</span>` : ''}
      </div>
      <div class="stat-mid">
        <div class="stat-value cost-value" title="In ${fmtUsdExact(inCost)} | Out ${fmtUsdExact(outCost)} | Cache ${fmtUsdExact(cacheCost)}">${fmtUsd(cost)}</div>
        ${renderSparkline(sCost, 'var(--cost-c)')}
      </div>
      <div class="cost-sub-row">
        <span>In ${fmtUsd(inCost)} · Out ${fmtUsd(outCost)} · Cache ${fmtUsd(cacheCost)}</span>
        ${cacheSaved >= 0.001 ? `<span class="cost-saved" title="相对无缓存全额 Input 节省的费用">缓存省 ${fmtUsd(cacheSaved)}</span>` : ''}
      </div>
    </div>
    <div class="stat-card card-total">
      <div class="stat-label"><span class="dot dot-total"></span>总计 (Total)</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(total)}">${fmt(total)}</div>
        ${renderSparkline(sTotal, 'var(--accent)')}
      </div>
      <div class="stat-sub">非缓存 ${fmt(billed)}</div>
    </div>
    <div class="stat-card card-input">
      <div class="stat-label"><span class="dot dot-input"></span>输入 (Input)</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(inp)}">${fmt(inp)}</div>
        ${renderSparkline(sInp, 'var(--input-c)')}
      </div>
      <div class="stat-sub">占比 ${inPct}%${inCost > 0 ? ` · ${fmtUsd(inCost)}` : ''}</div>
    </div>
    <div class="stat-card card-output">
      <div class="stat-label"><span class="dot dot-output"></span>输出 (Output)</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(out)}">${fmt(out)}</div>
        ${renderSparkline(sOut, 'var(--output-c)')}
      </div>
      <div class="stat-sub">占比 ${outPct}%${outCost > 0 ? ` · ${fmtUsd(outCost)}` : ''}</div>
    </div>
    <div class="stat-card card-cache">
      <div class="stat-label"><span class="dot dot-cache"></span>缓存命中 (Cache)</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(cache)}">${fmt(cache)}</div>
        ${renderSparkline(sCache, 'var(--cache-c)')}
      </div>
      <div class="stat-sub">命中率 ${hitRate}%${cacheCost > 0 ? ` · ${fmtUsd(cacheCost)}` : ''}</div>
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
                ${esc(m.label)}
                ${!m.priced ? '<span class="unpriced-tag">未定价</span>' : ''}
              </span>
              <span class="model-row-stats">
                <span class="model-row-tokens">${m.calls} 次 · ${fmt(m.totalTokens)}</span>
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
        <span class="muted">${breakdown.length} 个模型</span>
      </span>
      <span class="collapse-right">
        <span class="model-row-cost">${fmtUsd(totalCost)}</span>
        <span class="muted">${expanded ? '收起' : '展开'}</span>
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
        <span>上下文增长</span>
        <span class="muted">当前 ${fmt(latest.context)} · 峰值 ${fmt(peak)}</span>
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
        <span class="ctx-chip"><b>第 ${s.step} 次</b>${s.modelLabel && s.modelKey !== 'unknown' ? ` · ${esc(s.modelLabel)}` : ''}</span>
        ${s.cost > 0 ? `<span class="ctx-chip">费用 <b>${fmtUsd(s.cost)}</b></span>` : ''}
        <span class="ctx-chip">上下文 <b>${fmt(s.context)}</b> (In ${fmt(s.inp)} + Cache ${fmt(s.cache)})</span>
        <span class="ctx-chip">Out <b>${fmt(s.out)}</b>${s.tools ? ` · 工具 <b>${s.tools}</b>` : ''}</span>
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
        <div class="conv-banner-title">当前会话推理中…</div>
        <div class="conv-banner-meta">
          <span class="badge">当前会话</span>
          <span>ID: ${esc(hostConvId.slice(0, 8))}</span>
        </div>
      `;
      renderCards(cards, { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cost: 0 });
      renderModelBreakdown(modelsEl, [], '会话模型拆分', 'current');
      renderContextChart(null);
      countEl.textContent = '';
      turnsEl.innerHTML = `<div class="empty">Orchestrator 规划或首轮模型调用完成后将自动更新 Token 统计</div>`;
      return;
    }
    banner.innerHTML = `<div class="conv-banner-title">暂无当前任务记录</div><div class="conv-banner-meta">发送第一条消息后将自动统计 Token</div>`;
    renderCards(cards, { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cost: 0 });
    renderModelBreakdown(modelsEl, [], '会话模型拆分', 'current');
    renderContextChart(null);
    countEl.textContent = '';
    turnsEl.innerHTML = `<div class="empty">还没有模型调用记录</div>`;
    return;
  }

  const isLive = Boolean(effectiveActiveId && cur.id === effectiveActiveId);
  const modelSummary = formatModelsSummary(cur.models);
  banner.innerHTML = `
    <div class="conv-banner-title">${esc(cur.title)}</div>
    <div class="conv-banner-meta">
      ${isLive ? '<span class="badge">当前会话</span>' : '<button class="link-btn" id="back-active">回到当前会话</button>'}
      ${modelSummary ? `<span class="model-pill">${esc(modelSummary)}</span>` : ''}
      <span class="meta-pill">ID ${esc(cur.id.slice(0, 8))}</span>
      <span class="meta-pill">模型 ${cur.modelCalls} 次</span>
      ${cur.toolCalls ? `<span class="meta-pill">工具 ${cur.toolCalls} 次</span>` : ''}
      ${cur.subagentCount ? `<span class="meta-pill">子代理 ${cur.subagentCount}</span>` : ''}
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
  renderModelBreakdown(modelsEl, showCurrentModels ? cur.modelBreakdown : [], '会话模型拆分', 'current');
  renderContextChart(cur);
  countEl.textContent = `${cur.turns.length} 轮`;

  if (!cur.turns.length) {
    turnsEl.innerHTML = `<div class="empty">暂无轮次记录</div>`;
    return;
  }

  turnsEl.innerHTML = [...cur.turns]
    .reverse()
    .map((t) => {
      const turnModels = formatModelsSummary(t.models);
      const hasCost = Number(t.cost) > 0;
      return `
        <div class="item">
          <div class="item-top">
            <div class="item-title"><span class="turn-num">#${t.index}</span>${esc(t.prompt)}</div>
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
            <span>${t.phaseSummary ? esc(t.phaseSummary) : `${t.modelCalls} 次调用`}</span>
            ${t.toolCalls ? `<span>工具 ${t.toolCalls} 次</span>` : ''}
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
        <span>消耗趋势</span>
        <span class="muted">合计 ${fmtVal(sumVal)} · 峰值 ${fmtVal(maxVal)}</span>
      </div>
      <div class="chart-controls">
        <div class="seg">
          <button class="seg-btn ${state.chartMode === 'daily' ? 'active' : ''}" data-chart-mode="daily">7天</button>
          <button class="seg-btn ${state.chartMode === 'hourly' ? 'active' : ''}" data-chart-mode="hourly">24h</button>
        </div>
        <div class="seg">
          <button class="seg-btn ${state.chartMetric === 'total' ? 'active' : ''}" data-chart-metric="total">总计</button>
          <button class="seg-btn ${state.chartMetric === 'billed' ? 'active' : ''}" data-chart-metric="billed">非缓存</button>
          <button class="seg-btn ${state.chartMetric === 'cost' ? 'active' : ''}" data-chart-metric="cost">费用$</button>
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
  const totals = state.data?.totals || { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cost: 0 };
  const daily = state.data?.series?.daily;
  const dailySpark = Array.isArray(daily) && daily.length >= 2 ? {
    cost: daily.map((d) => d.cost || 0),
    total: daily.map((d) => d.totalTokens),
    inp: daily.map((d) => d.inputTokens),
    out: daily.map((d) => d.outputTokens),
    cache: daily.map((d) => d.cacheReadTokens),
  } : null;
  renderCards(cards, totals, dailySpark);
  renderTrendChart();
  renderModelBreakdown(modelsEl, state.data?.modelBreakdown || [], '模型费用分布', 'global');

  let items = [...(state.data?.conversations || [])];
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
    listEl.innerHTML = `<div class="empty">没有匹配的任务记录</div>`;
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
            <div class="item-title">${isLive ? '<span class="badge">当前</span> ' : ''}${esc(c.title)}</div>
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
            <span>${c.turnCount} 轮 / ${c.modelCalls} 次</span>
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
      const badge = m.isCustom
        ? '<span class="pricing-badge is-custom">自定义</span>'
        : (m.isPromoActive ? `<span class="pricing-badge" title="促销价截至 ${esc(m.promo?.until || '')}">促销</span>` : '');
      return `
        <div class="pricing-row" data-model-key="${esc(m.key)}">
          <div class="pricing-model-name" title="${esc(m.key)}">${esc(m.label)}${badge}</div>
          <input class="pricing-input" data-field="input" type="number" step="0.01" min="0" value="${m.effective.input}">
          <input class="pricing-input" data-field="output" type="number" step="0.01" min="0" value="${m.effective.output}">
          <input class="pricing-input" data-field="cacheRead" type="number" step="0.005" min="0" value="${m.effective.cacheRead}">
        </div>
      `;
    })
    .join('');

  tableEl.innerHTML = `
    <div class="pricing-head">
      <span>模型</span>
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
  if (h) {
    document.getElementById('opt-session-total').checked = Boolean(h.showSessionTotal);
    document.getElementById('opt-hook-cost').checked = h.showCost !== false;
  }
  if (p) {
    document.getElementById('opt-promo-pricing').checked = p.usePromoPricing !== false;
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

async function postSettings(payload, okMessage = '已保存') {
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
        };
        if (updated.pricingCatalog) {
          state.data.pricingCatalog = updated.pricingCatalog;
        }
      }
      state.pricingDirty = false;
      showSettingsStatus(okMessage);
      await fetchTokens();
    } else {
      showSettingsStatus('保存失败');
    }
  } catch {
    showSettingsStatus('保存失败');
  }
}

async function saveToggleSettings() {
  await postSettings({
    hook: {
      showSessionTotal: document.getElementById('opt-session-total').checked,
      showCost: document.getElementById('opt-hook-cost').checked,
    },
    pricing: {
      usePromoPricing: document.getElementById('opt-promo-pricing').checked,
    },
  });
}

async function savePricingOverrides() {
  const catalog = state.data?.pricingCatalog || [];
  const byKey = new Map(catalog.map((m) => [m.key, m]));
  const overrides = {};
  const existingOverrides = state.data?.settings?.pricing?.overrides || {};
  const usePromo = document.getElementById('opt-promo-pricing').checked;

  document.querySelectorAll('#pricing-table .pricing-row').forEach((row) => {
    const key = row.dataset.modelKey;
    const input = Number(row.querySelector('[data-field="input"]')?.value);
    const output = Number(row.querySelector('[data-field="output"]')?.value);
    const cacheRead = Number(row.querySelector('[data-field="cacheRead"]')?.value);
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
    '单价已更新',
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
    '已恢复官方默认',
  );
}

async function fetchTokens() {
  const hostConvId = getHostConvId();
  const targetId = state.userPinned
    ? state.selectedConvId
    : (hostConvId || state.selectedConvId || '');
  const qs = targetId ? `?conversationId=${encodeURIComponent(targetId)}` : '';
  try {
    const res = await apiFetch(`/api/tokens${qs}`);
    if (!res.ok) return;
    let data = await res.json();

    // Standalone/global mode (no conversationId in iframe URL): follow the newest conversation
    // even if backend activeConversationId is null (compatibility with un-restarted sidecar).
    if (!state.userPinned && !hostConvId) {
      const latestId = data.activeConversationId || data.conversations?.[0]?.id || '';
      if (latestId && data.current?.id !== latestId) {
        state.selectedConvId = latestId;
        const retry = await apiFetch(`/api/tokens?conversationId=${encodeURIComponent(latestId)}`);
        if (retry.ok) data = await retry.json();
      } else if (latestId) {
        state.selectedConvId = latestId;
      }
    } else if (!state.userPinned && hostConvId) {
      state.selectedConvId = hostConvId;
    }

    state.data = data;
    state.activeConvId = hostConvId || data.activeConversationId || data.conversations?.[0]?.id || null;
    renderCurrent();
    renderHistory();
    renderSettings();
  } catch {
    // ignore transient poll errors
  }
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
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

fetchTokens();
setInterval(() => {
  if (!document.hidden) fetchTokens();
}, 3000);
