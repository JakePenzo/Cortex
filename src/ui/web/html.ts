export const html = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cortex Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/vis-network@9/standalone/umd/vis-network.min.js"></script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0d1117; --surface: #161b22; --surface2: #1c2128; --border: #30363d;
  --text: #e6edf3; --muted: #7d8590; --accent: #ff6428;
  --green: #3fb950; --yellow: #d29922; --red: #f85149;
  --magenta: #d2a8ff; --blue: #79c0ff; --cyan: #56d364;
  --pref: #d2a8ff; --dec: #ffa657; --fact: #79c0ff; --sess: #56d364; --doc: #7d8590;
}
body { background: var(--bg); color: var(--text); font-family: 'JetBrains Mono','Fira Code','SF Mono',monospace; font-size: 13px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

/* ── Header ── */
header { display: flex; align-items: center; gap: 12px; padding: 10px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
header h1 { color: var(--accent); font-size: 16px; font-weight: 700; letter-spacing: 3px; }
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.header-stat { display: flex; flex-direction: column; align-items: center; padding: 0 14px; border-left: 1px solid var(--border); }
.header-stat .v { color: var(--accent); font-size: 15px; font-weight: 700; }
.header-stat .l { color: var(--muted); font-size: 10px; }
.search-bar { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.search-bar input { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 5px 10px; font-family: inherit; font-size: 12px; width: 220px; outline: none; }
.search-bar input:focus { border-color: var(--accent); }
.btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 5px 12px; font-family: inherit; font-size: 12px; cursor: pointer; transition: border-color .15s, background .15s; }
.btn:hover { border-color: var(--accent); background: rgba(255,100,40,.08); }
.btn.danger { color: var(--red); }
.btn.danger:hover { border-color: var(--red); background: rgba(248,81,73,.08); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.btn.primary:hover { background: #e05520; }

/* ── Layout ── */
.layout { display: flex; flex: 1; min-height: 0; }

/* ── Left panel ── */
.left-panel { width: 220px; flex-shrink: 0; border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.panel-section { padding: 12px 14px; border-bottom: 1px solid var(--border); }
.panel-title { color: var(--muted); font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
.stat-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; }
.stat-row .k { color: var(--muted); font-size: 11px; }
.stat-row .v { color: var(--text); font-size: 12px; font-weight: 600; }

/* Type legend */
.type-legend { display: flex; flex-direction: column; gap: 5px; }
.type-item { display: flex; align-items: center; gap: 7px; cursor: pointer; padding: 3px 6px; border-radius: 4px; transition: background .1s; }
.type-item:hover { background: rgba(255,255,255,.04); }
.type-item.inactive { opacity: .35; }
.type-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.type-label { font-size: 12px; }
.type-count { margin-left: auto; color: var(--muted); font-size: 11px; }

/* Backend status */
.backend-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.b-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.b-dot.on { background: var(--green); }
.b-dot.off { background: var(--muted); }
.b-name { font-size: 12px; color: var(--text); }
.b-count { margin-left: auto; color: var(--muted); font-size: 11px; }

/* ── Center: graph ── */
.center-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.graph-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.graph-toolbar span { color: var(--muted); font-size: 11px; }
#graph-container { flex: 1; background: var(--bg); position: relative; overflow: hidden; }
/* position:absolute takes the canvas out of flow so vis.js's own
   ResizeObserver can resize it without affecting the parent's layout —
   that's what breaks the feedback loop in Safari. */
#graph-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; }
.graph-hint { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); color: var(--muted); font-size: 11px; pointer-events: none; background: rgba(13,17,23,.8); padding: 4px 10px; border-radius: 12px; border: 1px solid var(--border); }

/* ── Right panel: detail / memory list ── */
.right-panel { width: 320px; flex-shrink: 0; border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.right-tabs { display: flex; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.tab { flex: 1; padding: 8px; text-align: center; color: var(--muted); font-size: 11px; cursor: pointer; border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.right-content { flex: 1; overflow-y: auto; padding: 12px; }
.right-content::-webkit-scrollbar { width: 4px; }
.right-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* Memory card */
.mem-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: border-color .15s; }
.mem-card:hover, .mem-card.selected { border-color: var(--accent); }
.mem-card.superseded { opacity: .45; }
.mem-card .mc-type { font-size: 10px; padding: 1px 6px; border-radius: 3px; display: inline-block; margin-bottom: 5px; }
.mem-card .mc-content { font-size: 12px; line-height: 1.4; color: var(--text); }
.mem-card .mc-meta { margin-top: 6px; display: flex; gap: 8px; align-items: center; }
.mem-card .mc-tag { font-size: 10px; color: var(--muted); background: rgba(255,255,255,.05); padding: 1px 5px; border-radius: 3px; }
.mem-card .mc-time { margin-left: auto; font-size: 10px; color: var(--muted); }
.superseded-badge { font-size: 10px; color: var(--muted); background: rgba(125,133,144,.15); padding: 1px 6px; border-radius: 3px; margin-left: 6px; }

/* Detail panel */
.detail-section { margin-bottom: 14px; }
.detail-label { color: var(--muted); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 5px; }
.detail-content { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 10px; font-size: 12px; line-height: 1.5; color: var(--text); }
.detail-edit { width: 100%; background: var(--surface2); border: 1px solid var(--accent); border-radius: 6px; padding: 8px; font-family: inherit; font-size: 12px; color: var(--text); resize: vertical; min-height: 60px; outline: none; }
.detail-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.override-form { display: none; margin-top: 10px; }
.override-form.open { display: block; }
.override-form textarea { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-family: inherit; font-size: 12px; color: var(--text); resize: vertical; min-height: 60px; outline: none; margin-bottom: 6px; }
.override-form textarea:focus { border-color: var(--accent); }
.chain-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.chain-item:last-child { border-bottom: none; }
.chain-icon { color: var(--muted); flex-shrink: 0; margin-top: 2px; }
.chain-text { font-size: 11px; color: var(--muted); flex: 1; line-height: 1.4; }
.chain-text.current { color: var(--text); }
.chain-arrow { color: var(--accent); font-size: 11px; }

/* Type colors */
.t-preference { background: rgba(210,168,255,.15); color: var(--pref); }
.t-decision    { background: rgba(255,166,87,.15);  color: var(--dec); }
.t-fact        { background: rgba(121,192,255,.15); color: var(--fact); }
.t-session     { background: rgba(86,211,100,.15);  color: var(--cyan); }
.t-document    { background: rgba(125,133,144,.1);  color: var(--doc); }
.empty-state { color: var(--muted); font-size: 12px; text-align: center; padding: 24px 0; }

/* Add form */
.add-form { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px; margin-bottom: 12px; }
.add-form textarea { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-family: inherit; font-size: 12px; color: var(--text); resize: none; min-height: 54px; outline: none; display: block; margin-bottom: 8px; }
.add-form textarea:focus { border-color: var(--accent); }
.add-form-row { display: flex; gap: 6px; align-items: center; }
.add-form select { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 5px 8px; font-family: inherit; font-size: 12px; outline: none; flex: 1; }
</style>
</head>
<body>
<header>
  <div class="live-dot"></div>
  <h1>CORTEX</h1>
  <div class="header-stat"><span class="v" id="h-total">—</span><span class="l">memories</span></div>
  <div class="header-stat"><span class="v" id="h-queries">—</span><span class="l">queries today</span></div>
  <div class="header-stat"><span class="v" id="h-latency">—</span><span class="l">avg latency</span></div>
  <div class="search-bar">
    <input type="text" id="search-input" placeholder="Filter memories..." />
  </div>
</header>

<div class="layout">
  <!-- Left panel -->
  <div class="left-panel">
    <div class="panel-section">
      <div class="panel-title">Type filter</div>
      <div class="type-legend" id="type-legend"></div>
    </div>
    <div class="panel-section">
      <div class="panel-title">Backends</div>
      <div id="backend-list"><div class="empty-state">Loading...</div></div>
    </div>
    <div class="panel-section" style="margin-top:auto; border-bottom:none">
      <div style="color:var(--muted);font-size:10px;margin-bottom:4px" id="last-updated"></div>
    </div>
  </div>

  <!-- Center: knowledge graph -->
  <div class="center-panel">
    <div class="graph-toolbar">
      <span id="graph-label">Knowledge graph</span>
      <div style="margin-left:auto;display:flex;gap:6px">
        <button class="btn" id="btn-fit">⊞ Fit</button>
        <button class="btn" id="btn-toggle-superseded">Show superseded</button>
      </div>
    </div>
    <div id="graph-container">
      <div id="graph-canvas"></div>
      <div class="graph-hint">Click a node to inspect · Drag to pan · Scroll to zoom</div>
    </div>
  </div>

  <!-- Right panel -->
  <div class="right-panel">
    <div class="right-tabs">
      <div class="tab active" id="tab-detail" onclick="showTab('detail')">Detail</div>
      <div class="tab" id="tab-list" onclick="showTab('list')">All memories</div>
      <div class="tab" id="tab-add" onclick="showTab('add')">+ Add</div>
    </div>
    <div class="right-content" id="panel-detail">
      <div class="empty-state">Select a memory node<br>to inspect it here.</div>
    </div>
    <div class="right-content" id="panel-list" style="display:none">
      <div id="memory-list"></div>
    </div>
    <div class="right-content" id="panel-add" style="display:none">
      <div class="add-form">
        <textarea id="add-content" placeholder="What do you want to remember?&#10;&#10;e.g. I always use TypeScript"></textarea>
        <div class="add-form-row">
          <select id="add-type">
            <option value="preference">preference</option>
            <option value="decision">decision</option>
            <option value="fact">fact</option>
            <option value="session">session</option>
            <option value="document">document</option>
          </select>
          <button class="btn primary" onclick="addMemory()">Add memory</button>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
// ── State ─────────────────────────────────────────────────────
const TYPE_COLORS = {
  preference: '#d2a8ff',
  decision:   '#ffa657',
  fact:       '#79c0ff',
  session:    '#56d364',
  document:   '#7d8590',
};

let allMemories   = [];
let selectedId    = null;
let activeFilters = new Set(Object.keys(TYPE_COLORS));
let showSuperseded = false;
let network       = null;
let graphData     = { nodes: new vis.DataSet(), edges: new vis.DataSet() };

// ── Vis.js network ────────────────────────────────────────────
function initGraph() {
  const container = document.getElementById('graph-canvas');

  const options = {
    nodes: {
      shape: 'dot',
      size: 12,
      font: { color: '#e6edf3', size: 11, face: 'JetBrains Mono, monospace' },
      borderWidth: 1.5,
      borderWidthSelected: 3,
      chosen: true,
    },
    edges: {
      color: { color: '#30363d', highlight: '#ff6428', hover: '#7d8590' },
      width: 1,
      smooth: { type: 'continuous', roundness: 0.3 },
      font: { color: '#7d8590', size: 10, face: 'monospace' },
      arrows: { to: { enabled: true, scaleFactor: 0.5 } },
      selectionWidth: 2,
    },
    physics: {
      enabled: true,
      forceAtlas2Based: {
        gravitationalConstant: -60,
        centralGravity: 0.008,
        springLength: 100,
        springConstant: 0.08,
      },
      maxVelocity: 50,
      solver: 'forceAtlas2Based',
      stabilization: { iterations: 150, updateInterval: 25 },
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      zoomView: true,
      dragView: true,
    },
    layout: { improvedLayout: true },
  };

  network = new vis.Network(container, graphData, options);

  network.on('click', params => {
    if (params.nodes.length > 0) {
      selectMemory(params.nodes[0]);
      showTab('detail');
    } else {
      selectedId = null;
      renderDetail(null);
    }
  });

  network.on('stabilizationIterationsDone', () => {
    network.setOptions({ physics: { enabled: false } });
  });
}

// Stable hash for a node — used to skip no-op updates
function nodeHash(m) {
  return [m.id, m.status, m.type, (m.title||m.content||'').slice(0,60)].join('|');
}

function buildVisNode(m) {
  const color = TYPE_COLORS[m.type] || '#7d8590';
  const sup   = m.status === 'superseded';
  return {
    id: m.id,
    label: m.label || truncate(m.title || m.content || '', 28),
    title: m.title || m.content,
    color: {
      background: sup ? 'rgba(125,133,144,.12)' : hexAlpha(color, 0.18),
      border:     sup ? '#30363d' : color,
      highlight: { background: hexAlpha(color, 0.35), border: '#ff6428' },
      hover:     { background: hexAlpha(color, 0.28), border: color },
    },
    size:    sup ? 8 : 13,
    opacity: sup ? 0.4 : 1,
    font: { color: sup ? '#555' : '#e6edf3' },
  };
}

function rebuildGraph(memories) {
  const visible    = memories.filter(m =>
    activeFilters.has(m.type) && (showSuperseded || m.status === 'active')
  );
  const visibleIds = new Set(visible.map(m => m.id));

  // ── Diff nodes ──────────────────────────────────────────
  const existingIds  = new Set(graphData.nodes.getIds());
  const toAdd        = [];
  const toUpdate     = [];
  const toRemoveIds  = [...existingIds].filter(id => !visibleIds.has(id));

  for (const m of visible) {
    const vnode = buildVisNode(m);
    const hash  = nodeHash(m);
    if (!existingIds.has(m.id)) {
      toAdd.push(vnode);
      window._nodeHashes = window._nodeHashes || {};
      window._nodeHashes[m.id] = hash;
    } else {
      const prev = window._nodeHashes?.[m.id];
      if (prev !== hash) {
        toUpdate.push(vnode);
        window._nodeHashes[m.id] = hash;
      }
    }
  }

  // ── Diff edges ──────────────────────────────────────────
  const newEdges = (window._graphEdges || [])
    .filter(e => visibleIds.has(e.from) && visibleIds.has(e.to))
    .map((e, i) => ({
      id: 'e' + i,
      from: e.from, to: e.to,
      dashes: e.dashes,
      label: e.label || '',
      color: e.label === 'overrides' ? { color: '#ff6428', highlight: '#ff6428' } : { color: '#30363d' },
    }));
  const edgeHash = newEdges.map(e => e.from + e.to + e.label).join(',');
  const edgesChanged = edgeHash !== window._lastEdgeHash;
  window._lastEdgeHash = edgeHash;

  // Apply only what changed
  if (toRemoveIds.length) graphData.nodes.remove(toRemoveIds);
  if (toAdd.length)       graphData.nodes.add(toAdd);
  if (toUpdate.length)    graphData.nodes.update(toUpdate);
  if (edgesChanged) { graphData.edges.clear(); graphData.edges.add(newEdges); }

  // Only kick physics when nodes were actually added
  if (toAdd.length > 0) {
    network.setOptions({ physics: { enabled: true, stabilization: { iterations: 60 } } });
  }
}

// ── Data loading ──────────────────────────────────────────────
async function loadGraph() {
  const [graphRes, statusRes] = await Promise.all([
    fetch('/api/graph'),
    fetch('/api/status'),
  ]);
  const { nodes, edges } = await graphRes.json();
  const status = await statusRes.json();

  window._graphEdges = edges;
  window._graphNodes = nodes;

  // Merge graph node metadata into allMemories lookup
  allMemories = nodes;
  window._memById = {};
  for (const m of allMemories) window._memById[m.id] = m;

  rebuildGraph(allMemories);
  renderTypeLegend();
  renderBackends(status.backends);

  document.getElementById('h-total').textContent   = status.total_memories ?? nodes.length;
  document.getElementById('h-queries').textContent  = status.today.queries;
  document.getElementById('h-latency').textContent  = status.today.avg_latency_ms > 0 ? status.today.avg_latency_ms + 'ms' : '—';
  document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
}

async function loadMemoryList() {
  const q = document.getElementById('search-input')?.value?.toLowerCase() ?? '';
  const res = await fetch('/api/memories?limit=200');
  const { memories } = await res.json();

  const filtered = memories.filter(m => {
    if (!activeFilters.has(m.type)) return false;
    if (!showSuperseded && m.status === 'superseded') return false;
    if (q && !m.content.toLowerCase().includes(q)) return false;
    return true;
  });

  const el = document.getElementById('memory-list');
  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">No memories match the current filter.</div>';
    return;
  }
  el.innerHTML = filtered.map(m => \`
    <div class="mem-card \${m.status === 'superseded' ? 'superseded' : ''} \${m.id === selectedId ? 'selected' : ''}"
         onclick="selectMemory('\${m.id}');showTab('detail')">
      <span class="mc-type t-\${m.type}">\${m.type}</span>
      \${m.status === 'superseded' ? '<span class="superseded-badge">superseded</span>' : ''}
      <div class="mc-content">\${escHtml(m.content)}</div>
      <div class="mc-meta">
        \${(m.tags || []).slice(0, 3).map(t => \`<span class="mc-tag">\${t}</span>\`).join('')}
        <span class="mc-time">\${relTime(m.created_at)}</span>
      </div>
    </div>
  \`).join('');
}

// ── Detail panel ──────────────────────────────────────────────
function selectMemory(id) {
  selectedId = id;
  const m = window._memById?.[id] || allMemories.find(x => x.id === id);
  renderDetail(m);
  if (network) {
    network.selectNodes([id]);
    network.focus(id, { animation: { duration: 400, easingFunction: 'easeInOutQuad' }, scale: 1.2 });
  }
}

function renderDetail(m) {
  const el = document.getElementById('panel-detail');
  if (!m) {
    el.innerHTML = '<div class="empty-state">Select a memory node<br>to inspect it here.</div>';
    return;
  }

  // Find override chain
  const chain = buildChain(m.id);

  el.innerHTML = \`
    <div class="detail-section">
      <div class="detail-label">Content</div>
      <div class="detail-content" id="dc-content">\${escHtml(m.title || m.content || '')}</div>
      <textarea class="detail-edit" id="dc-edit" style="display:none">\${escHtml(m.title || m.content || '')}</textarea>
    </div>
    <div class="detail-section">
      <div class="detail-label">Type &amp; tags</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="mc-type t-\${m.group || m.type}">\${m.group || m.type || '—'}</span>
        \${(m.tags || []).map(t => \`<span class="mc-tag">\${t}</span>\`).join('')}
        \${m.project ? \`<span class="mc-tag" style="color:var(--accent)">\${m.project}</span>\` : ''}
        \${m.status === 'superseded' ? '<span class="superseded-badge">superseded</span>' : ''}
      </div>
    </div>
    \${chain.length > 1 ? \`
    <div class="detail-section">
      <div class="detail-label">Override chain</div>
      \${chain.map((c, i) => \`
        <div class="chain-item">
          <span class="chain-icon">\${i === 0 ? '▶' : '↑'}</span>
          <span class="chain-text \${i === 0 ? 'current' : ''}">\${escHtml(c.content)}</span>
          \${i < chain.length - 1 ? '<span class="chain-arrow">→</span>' : ''}
        </div>
      \`).join('')}
    </div>
    \` : ''}
    <div class="detail-section">
      <div class="detail-label">Actions</div>
      <div class="detail-actions">
        <button class="btn" onclick="startEdit()">Edit</button>
        <button class="btn" onclick="toggleOverrideForm()">Override</button>
        <button class="btn danger" onclick="deleteMemory('\${m.id}')">Delete</button>
      </div>
      <div class="override-form" id="override-form">
        <div style="color:var(--muted);font-size:11px;margin:8px 0 6px">
          Replacing this belief? Enter the updated version:
        </div>
        <textarea id="override-input" placeholder="Enter the updated memory..."></textarea>
        <div style="display:flex;gap:6px">
          <button class="btn primary" onclick="submitOverride('\${m.id}')">Apply override</button>
          <button class="btn" onclick="toggleOverrideForm()">Cancel</button>
        </div>
      </div>
    </div>
    <div style="color:var(--muted);font-size:10px;margin-top:8px">
      \${relTime(m.created_at)} · \${m.backend || 'local'} · \${m.id.slice(0, 8)}…
    </div>
  \`;
}

function buildChain(id) {
  // Walk up the supersedes chain from current node
  const byId = window._memById || {};
  const chain = [];
  let cur = byId[id];
  while (cur) {
    chain.push({ id: cur.id, content: cur.title || cur.content || '' });
    cur = cur.supersedes_id ? byId[cur.supersedes_id] : null;
    if (chain.length > 10) break;
  }
  return chain;
}

// ── Edit / Override / Delete ──────────────────────────────────
function startEdit() {
  const c = document.getElementById('dc-content');
  const e = document.getElementById('dc-edit');
  if (!c || !e) return;
  c.style.display = 'none';
  e.style.display = 'block';
  e.focus();
  e.onblur = async () => {
    const newText = e.value.trim();
    if (!newText || newText === c.textContent) { c.style.display = ''; e.style.display = 'none'; return; }
    await fetch('/api/memories/' + selectedId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: newText }) });
    await refresh();
  };
}

function toggleOverrideForm() {
  const f = document.getElementById('override-form');
  f.classList.toggle('open');
  if (f.classList.contains('open')) document.getElementById('override-input')?.focus();
}

async function submitOverride(id) {
  const text = document.getElementById('override-input')?.value?.trim();
  if (!text) return;
  await fetch('/api/memories/' + id + '/override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text }),
  });
  await refresh();
}

async function deleteMemory(id) {
  if (!confirm('Delete this memory? This cannot be undone.')) return;
  await fetch('/api/memories/' + id, { method: 'DELETE' });
  selectedId = null;
  await refresh();
}

async function addMemory() {
  const content = document.getElementById('add-content')?.value?.trim();
  const type    = document.getElementById('add-type')?.value || 'fact';
  if (!content) return;
  await fetch('/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, type }),
  });
  document.getElementById('add-content').value = '';
  await refresh();
  showTab('list');
}

// ── Type legend + filter ──────────────────────────────────────
function renderTypeLegend() {
  const counts = {};
  for (const m of allMemories) {
    if (m.status === 'active') counts[m.group || m.type] = (counts[m.group || m.type] || 0) + 1;
  }
  const el = document.getElementById('type-legend');
  el.innerHTML = Object.entries(TYPE_COLORS).map(([type, color]) => \`
    <div class="type-item \${activeFilters.has(type) ? '' : 'inactive'}" onclick="toggleFilter('\${type}')">
      <div class="type-dot" style="background:\${color}"></div>
      <span class="type-label">\${type}</span>
      <span class="type-count">\${counts[type] || 0}</span>
    </div>
  \`).join('');
}

function toggleFilter(type) {
  if (activeFilters.has(type)) activeFilters.delete(type);
  else activeFilters.add(type);
  renderTypeLegend();
  rebuildGraph(allMemories);
  loadMemoryList();
}

// ── Backend list ──────────────────────────────────────────────
function renderBackends(backends) {
  const el = document.getElementById('backend-list');
  if (!backends?.length) { el.innerHTML = '<div class="empty-state">No backends</div>'; return; }
  el.innerHTML = backends.map(b => \`
    <div class="backend-item">
      <div class="b-dot \${b.available ? 'on' : 'off'}"></div>
      <span class="b-name">\${b.name}</span>
      <span class="b-count">\${b.available ? b.total_memories + ' mem' : 'offline'}</span>
    </div>
  \`).join('');
}

// ── Tabs ─────────────────────────────────────────────────────
function showTab(tab) {
  ['detail', 'list', 'add'].forEach(t => {
    document.getElementById('panel-' + t).style.display = t === tab ? '' : 'none';
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'list') loadMemoryList();
}

// ── Controls ──────────────────────────────────────────────────
document.getElementById('btn-fit').onclick = () => network?.fit({ animation: true });
document.getElementById('btn-toggle-superseded').onclick = function() {
  showSuperseded = !showSuperseded;
  this.textContent = showSuperseded ? 'Hide superseded' : 'Show superseded';
  rebuildGraph(allMemories);
};
document.getElementById('search-input').oninput = () => {
  if (document.getElementById('panel-list').style.display !== 'none') loadMemoryList();
};

// ── Refresh ───────────────────────────────────────────────────
async function refresh() {
  await loadGraph();
  if (document.getElementById('panel-list').style.display !== 'none') await loadMemoryList();
  if (selectedId) {
    const m = window._memById?.[selectedId];
    if (m) renderDetail(m);
  }
}

// ── Helpers ───────────────────────────────────────────────────
function relTime(v) {
  const d = new Date(v), diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return Math.floor(diff/86400000) + 'd ago';
}
function truncate(s, n) { return s.length > n ? s.slice(0, n-1) + '…' : s; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return \`rgba(\${r},\${g},\${b},\${a})\`;
}

// ── Boot ──────────────────────────────────────────────────────
initGraph();
refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
