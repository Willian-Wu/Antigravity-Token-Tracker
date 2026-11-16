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

function renderCards(el, stats) {
  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-label"><span class="dot dot-total"></span>总计 (Total)</div>
      <div class="stat-value" title="${fmtExact(stats.totalTokens)}">${fmt(stats.totalTokens)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><span class="dot dot-input"></span>输入 (Input)</div>
      <div class="stat-value" title="${fmtExact(stats.inputTokens)}">${fmt(stats.inputTokens)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><span class="dot dot-output"></span>输出 (Output)</div>
      <div class="stat-value" title="${fmtExact(stats.outputTokens)}">${fmt(stats.outputTokens)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><span class="dot dot-cache"></span>缓存命中 (Cache)</div>
      <div class="stat-value" title="${fmtExact(stats.cacheReadTokens)}">${fmt(stats.cacheReadTokens)}</div>
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
      countEl.textContent = '';
      turnsEl.innerHTML = `<div class="empty">Orchestrator 规划或首轮模型调用完成后将自动更新 Token 统计</div>`;
      return;
    }
    banner.innerHTML = `<div class="conv-banner-title">暂无当前任务记录</div><div class="conv-banner-meta">发送第一条消息后将自动统计 Token</div>`;
    renderCards(cards, { totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 });
    countEl.textContent = '';
    turnsEl.innerHTML = `<div class="empty">还没有模型调用记录</div>`;
    return;
  }

  const isLive = Boolean(effectiveActiveId && cur.id === effectiveActiveId);
  banner.innerHTML = `
    <div class="conv-banner-title">${esc(cur.title)}</div>
    <div class="conv-banner-meta">
      ${isLive ? '<span class="badge">当前会话</span>' : '<button class="link-btn" id="back-active">回到当前会话</button>'}
      <span>ID: ${esc(cur.id.slice(0, 8))}</span>
      <span>模型调用: ${cur.modelCalls} 次</span>
      ${cur.subagentCount ? `<span>子代理: ${cur.subagentCount}</span>` : ''}
      <span>更新: ${fmtTime(cur.updatedAt)}</span>
    </div>
  `;

  renderCards(cards, cur);
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
          <div class="item-title">#${t.index} ${esc(t.prompt)}</div>
          <div class="item-total" title="${fmtExact(t.totalTokens)}">${fmt(t.totalTokens)}</div>
        </div>
        <div class="item-meta">
          <span>In: ${fmt(t.inputTokens)}</span>
          <span>Out: ${fmt(t.outputTokens)}</span>
          <span>Cache: ${fmt(t.cacheReadTokens)}</span>
          <span>${t.phaseSummary ? esc(t.phaseSummary) : `${t.modelCalls} 次调用`}</span>
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
  renderCards(cards, totals);
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
            <span>Cache: ${fmt(c.cacheReadTokens)}</span>
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
