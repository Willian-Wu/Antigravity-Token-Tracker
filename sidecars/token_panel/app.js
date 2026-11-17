const ID_RE = /^[0-9a-f-]{8,}$/i;

const state = {
  tab: 'current',
  selectedConvId: null,
  activeConvId: null,
  userPinned: false,
  search: '',
  sort: 'recent',
  chartMode: 'daily', // 'daily' | 'hourly'
  chartMetric: 'total', // 'total' | 'billed'
  contextConvId: null,
  contextStepIdx: null,
  contextPinned: false,
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
  const billed = inp + out;
  const hitDenom = inp + cache;
  const hitRate = hitDenom > 0 ? ((cache / hitDenom) * 100).toFixed(1) : '0.0';
  const inPct = total > 0 ? ((inp / total) * 100).toFixed(1) : '0.0';
  const outPct = total > 0 ? ((out / total) * 100).toFixed(1) : '0.0';

  const sTotal = sparkSeries?.total || null;
  const sInp = sparkSeries?.inp || null;
  const sOut = sparkSeries?.out || null;
  const sCache = sparkSeries?.cache || null;

  el.innerHTML = `
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
      <div class="stat-sub">占比 ${inPct}%</div>
    </div>
    <div class="stat-card card-output">
      <div class="stat-label"><span class="dot dot-output"></span>输出 (Output)</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(out)}">${fmt(out)}</div>
        ${renderSparkline(sOut, 'var(--output-c)')}
      </div>
      <div class="stat-sub">占比 ${outPct}%</div>
    </div>
    <div class="stat-card card-cache">
      <div class="stat-label"><span class="dot dot-cache"></span>缓存命中 (Cache)</div>
      <div class="stat-mid">
        <div class="stat-value" title="${fmtExact(cache)}">${fmt(cache)}</div>
        ${renderSparkline(sCache, 'var(--cache-c)')}
      </div>
      <div class="stat-sub">命中率 ${hitRate}%</div>
    </div>
  `;
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
        <span class="ctx-chip"><b>第 ${s.step} 次</b></span>
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

function renderCurrent() {
  const banner = document.getElementById('current-header');
  const cards = document.getElementById('current-cards');
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
      renderCards(cards, { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 });
      renderContextChart(null);
      countEl.textContent = '';
      turnsEl.innerHTML = `<div class="empty">Orchestrator 规划或首轮模型调用完成后将自动更新 Token 统计</div>`;
      return;
    }
    banner.innerHTML = `<div class="conv-banner-title">暂无当前任务记录</div><div class="conv-banner-meta">发送第一条消息后将自动统计 Token</div>`;
    renderCards(cards, { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 });
    renderContextChart(null);
    countEl.textContent = '';
    turnsEl.innerHTML = `<div class="empty">还没有模型调用记录</div>`;
    return;
  }

  const isLive = Boolean(effectiveActiveId && cur.id === effectiveActiveId);
  banner.innerHTML = `
    <div class="conv-banner-title">${esc(cur.title)}</div>
    <div class="conv-banner-meta">
      ${isLive ? '<span class="badge">当前会话</span>' : '<button class="link-btn" id="back-active">回到当前会话</button>'}
      <span class="meta-pill">ID ${esc(cur.id.slice(0, 8))}</span>
      <span class="meta-pill">模型 ${cur.modelCalls} 次</span>
      ${cur.toolCalls ? `<span class="meta-pill">工具 ${cur.toolCalls} 次</span>` : ''}
      ${cur.subagentCount ? `<span class="meta-pill">子代理 ${cur.subagentCount}</span>` : ''}
      <span class="meta-pill">${fmtTime(cur.updatedAt)}</span>
    </div>
  `;

  const stepSpark = cur.contextSteps?.length >= 2 ? {
    total: cur.contextSteps.map((s) => s.inp + s.out + s.cache),
    inp: cur.contextSteps.map((s) => s.inp),
    out: cur.contextSteps.map((s) => s.out),
    cache: cur.contextSteps.map((s) => s.cache),
  } : null;

  renderCards(cards, cur, stepSpark);
  renderContextChart(cur);
  countEl.textContent = `${cur.turns.length} 轮`;

  if (!cur.turns.length) {
    turnsEl.innerHTML = `<div class="empty">暂无轮次记录</div>`;
    return;
  }

  turnsEl.innerHTML = [...cur.turns]
    .reverse()
    .map((t) => `
      <div class="item">
        <div class="item-top">
          <div class="item-title"><span class="turn-num">#${t.index}</span>${esc(t.prompt)}</div>
          <div class="item-total" title="${fmtExact(t.totalTokens)}">${fmt(t.totalTokens)}</div>
        </div>
        <div class="item-meta">
          <span>In: ${fmt(t.inputTokens)}</span>
          <span>Out: ${fmt(t.outputTokens)}</span>
          <span>Cache: ${fmt(t.cacheReadTokens)}</span>
          <span>${t.phaseSummary ? esc(t.phaseSummary) : `${t.modelCalls} 次调用`}</span>
          ${t.toolCalls ? `<span>工具 ${t.toolCalls} 次</span>` : ''}
          <span>${fmtTime(t.createdAt)}</span>
        </div>
        ${renderBar(t.inputTokens, t.outputTokens, t.cacheReadTokens)}
      </div>
    `)
    .join('');
}

function renderTrendChart() {
  const el = document.getElementById('trend-chart');
  if (!el) return;
  const buckets = state.data?.series?.[state.chartMode] || [];
  const isBilled = state.chartMetric === 'billed';
  const values = buckets.map((b) => (isBilled ? b.billedTokens : b.totalTokens));
  const maxVal = Math.max(0, ...values);
  const sumVal = values.reduce((a, b) => a + b, 0);
  const n = buckets.length;

  const colsHtml = buckets
    .map((b, i) => {
      const val = isBilled ? b.billedTokens : b.totalTokens;
      const hPct = maxVal > 0 ? Math.max(val > 0 ? 4 : 0, (val / maxVal) * 100) : 0;
      const pIn = val > 0 ? (b.inputTokens / val) * 100 : 0;
      const pOut = val > 0 ? (b.outputTokens / val) * 100 : 0;
      const pCache = !isBilled && val > 0 ? (b.cacheReadTokens / val) * 100 : 0;
      const tip = `${b.label} · ${fmtExact(val)} (In ${fmt(b.inputTokens)} / Out ${fmt(b.outputTokens)}${isBilled ? '' : ` / Cache ${fmt(b.cacheReadTokens)}`})`;
      const showLabel = state.chartMode === 'daily' || i % 6 === 0 || i === n - 1;

      const isLast = i === n - 1;
      return `
        <div class="chart-col ${isLast ? 'is-today' : ''}" data-tip="${esc(tip)}">
          <div class="chart-bar-wrap">
            ${val > 0 ? `
              <div class="chart-bar" style="height:${hPct.toFixed(1)}%">
                ${val > 0 ? `<span class="chart-val">${fmt(val)}</span>` : ''}
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
      <span><i class="dot dot-input"></i>Input</span>
      <span><i class="dot dot-output"></i>Output</span>
      ${isBilled ? '' : '<span><i class="dot dot-cache"></i>Cache</span>'}
    </span>
  `;

  el.innerHTML = `
    <div class="chart-head">
      <div class="chart-title">
        <span>消耗趋势</span>
        <span class="muted">合计 ${fmt(sumVal)} · 峰值 ${fmt(maxVal)}</span>
      </div>
      <div class="chart-controls">
        <div class="seg">
          <button class="seg-btn ${state.chartMode === 'daily' ? 'active' : ''}" data-chart-mode="daily">7天</button>
          <button class="seg-btn ${state.chartMode === 'hourly' ? 'active' : ''}" data-chart-mode="hourly">24h</button>
        </div>
        <div class="seg">
          <button class="seg-btn ${state.chartMetric === 'total' ? 'active' : ''}" data-chart-metric="total">总计</button>
          <button class="seg-btn ${state.chartMetric === 'billed' ? 'active' : ''}" data-chart-metric="billed">非缓存</button>
        </div>
      </div>
    </div>
    <div class="chart-body">
      <div class="chart-grid">
        <div class="chart-grid-line"><span>${maxVal > 0 ? fmt(maxVal) : ''}</span></div>
        <div class="chart-grid-line"><span>${maxVal > 0 ? fmt(Math.round(maxVal / 2)) : ''}</span></div>
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
  const listEl = document.getElementById('history-list');
  const totals = state.data?.totals || { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  const daily = state.data?.series?.daily;
  const dailySpark = Array.isArray(daily) && daily.length >= 2 ? {
    total: daily.map((d) => d.totalTokens),
    inp: daily.map((d) => d.inputTokens),
    out: daily.map((d) => d.outputTokens),
    cache: daily.map((d) => d.cacheReadTokens),
  } : null;
  renderCards(cards, totals, dailySpark);
  renderTrendChart();

  let items = [...(state.data?.conversations || [])];
  const q = state.search.trim().toLowerCase();
  if (q) {
    items = items.filter((c) => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }

  if (state.sort === 'total') {
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
      return `
        <div class="item clickable ${isSelected ? 'is-active' : ''}" data-conv-id="${esc(c.id)}">
          <div class="item-top">
            <div class="item-title">${isLive ? '<span class="badge">当前</span> ' : ''}${esc(c.title)}</div>
            <div class="item-total" title="${fmtExact(c.totalTokens)}">${fmt(c.totalTokens)}</div>
          </div>
          <div class="item-meta">
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

function renderSettings() {
  const h = state.data?.settings?.hook;
  if (!h) return;
  document.getElementById('opt-session-total').checked = Boolean(h.showSessionTotal);
}

async function saveSettings() {
  const statusEl = document.getElementById('settings-status');
  const payload = {
    hook: {
      showSessionTotal: document.getElementById('opt-session-total').checked,
    },
  };
  try {
    const res = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok && state.data) {
      state.data.settings = await res.json();
      statusEl.textContent = '已保存';
      setTimeout(() => {
        if (statusEl.textContent === '已保存') statusEl.textContent = '';
      }, 1500);
    }
  } catch {
    statusEl.textContent = '保存失败';
  }
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
document.getElementById('opt-session-total').addEventListener('change', saveSettings);
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
