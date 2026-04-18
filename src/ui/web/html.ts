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
.btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 5px 12px; font-family: inherit; font-size: 12px; cursor: pointer; transition: border-color .15s, background .15s; white-space: nowrap; }
.btn:hover { border-color: var(--accent); background: rgba(255,100,40,.08); }
.btn.danger { color: var(--red); }
.btn.danger:hover { border-color: var(--red); background: rgba(248,81,73,.08); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.btn.primary:hover { background: #e05520; }
.btn.active-view { background: rgba(255,100,40,.15); border-color: var(--accent); color: var(--accent); }

/* ── Layout ── */
.layout { display: flex; flex: 1; min-height: 0; }

/* ── Left panel ── */
.left-panel { width: 210px; flex-shrink: 0; border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
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
/* position:absolute takes the canvas out of flow so vis.js's own ResizeObserver
   can resize it without triggering a feedback loop (Safari fix). */
#graph-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; }
#graph-3d    { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; }
.graph-hint  { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); color: var(--muted); font-size: 11px; pointer-events: none; background: rgba(13,17,23,.85); padding: 4px 10px; border-radius: 12px; border: 1px solid var(--border); white-space: nowrap; }

/* ── Right panel ── */
.right-panel { width: 400px; flex-shrink: 0; border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.right-tabs { display: flex; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.tab { flex: 1; padding: 8px; text-align: center; color: var(--muted); font-size: 11px; cursor: pointer; border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.right-content { flex: 1; overflow-y: auto; padding: 14px; }
.right-content::-webkit-scrollbar { width: 4px; }
.right-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* Memory card */
.mem-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: border-color .15s; }
.mem-card:hover, .mem-card.selected { border-color: var(--accent); }
.mem-card.superseded { opacity: .45; }
.mem-card .mc-type { font-size: 10px; padding: 1px 6px; border-radius: 3px; display: inline-block; margin-bottom: 5px; }
.mem-card .mc-content { font-size: 12px; line-height: 1.4; color: var(--text); }
.mem-card .mc-meta { margin-top: 6px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.mem-card .mc-tag { font-size: 10px; color: var(--muted); background: rgba(255,255,255,.05); padding: 1px 5px; border-radius: 3px; }
.mem-card .mc-time { margin-left: auto; font-size: 10px; color: var(--muted); }
.superseded-badge { font-size: 10px; color: var(--muted); background: rgba(125,133,144,.15); padding: 1px 6px; border-radius: 3px; margin-left: 4px; }

/* ── Detail panel ── */
.detail-section { margin-bottom: 16px; }
.detail-label { color: var(--muted); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.detail-content { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; font-size: 12px; line-height: 1.6; color: var(--text); }
.detail-edit { width: 100%; background: var(--surface2); border: 1px solid var(--accent); border-radius: 6px; padding: 8px 10px; font-family: inherit; font-size: 12px; color: var(--text); resize: vertical; min-height: 70px; outline: none; }
.detail-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.override-form { display: none; margin-top: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.override-form.open { display: block; }
.override-form .of-hint { color: var(--muted); font-size: 11px; line-height: 1.5; margin-bottom: 8px; padding: 8px; background: rgba(255,100,40,.06); border-radius: 4px; border-left: 2px solid var(--accent); }
.override-form textarea { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-family: inherit; font-size: 12px; color: var(--text); resize: vertical; min-height: 60px; outline: none; margin-bottom: 8px; }
.override-form textarea:focus { border-color: var(--accent); }

/* ── Chain timeline ── */
.chain-timeline { display: flex; flex-direction: column; padding-left: 2px; }
.chain-step { display: flex; gap: 10px; position: relative; padding-bottom: 14px; }
.chain-step:last-child { padding-bottom: 0; }
.chain-step__dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; border: 2px solid var(--border); background: var(--bg); z-index: 1; }
.chain-step--current .chain-step__dot { border-color: var(--accent); background: var(--accent); }
.chain-step__line { position: absolute; left: 4px; top: 14px; width: 2px; bottom: 0; background: var(--border); }
.chain-step:last-child .chain-step__line { display: none; }
.chain-step__content { flex: 1; min-width: 0; }
.chain-step__text { font-size: 11px; line-height: 1.5; color: var(--muted); word-break: break-word; }
.chain-step--current .chain-step__text { color: var(--text); }
.chain-step__label { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
.chain-step--current .chain-step__label { color: var(--green); }

/* Type colors */
.t-preference { background: rgba(210,168,255,.15); color: var(--pref); }
.t-decision    { background: rgba(255,166,87,.15);  color: var(--dec); }
.t-fact        { background: rgba(121,192,255,.15); color: var(--fact); }
.t-session     { background: rgba(86,211,100,.15);  color: var(--sess); }
.t-document    { background: rgba(125,133,144,.1);  color: var(--doc); }
.empty-state { color: var(--muted); font-size: 12px; text-align: center; padding: 24px 0; line-height: 1.6; }

/* Add form */
.add-form { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px; margin-bottom: 12px; }
.add-form textarea { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-family: inherit; font-size: 12px; color: var(--text); resize: none; min-height: 60px; outline: none; display: block; margin-bottom: 8px; }
.add-form textarea:focus { border-color: var(--accent); }
.add-form-row { display: flex; gap: 6px; align-items: center; }
.add-form select { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 5px 8px; font-family: inherit; font-size: 12px; outline: none; flex: 1; }

/* ── Onboarding overlay ── */
#onboarding { position: fixed; inset: 0; background: rgba(13,17,23,.9); backdrop-filter: blur(6px); z-index: 200; display: flex; align-items: center; justify-content: center; }
.ob-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 32px; max-width: 560px; width: calc(100% - 40px); }
.ob-title { color: var(--accent); font-size: 20px; font-weight: 700; letter-spacing: 3px; margin-bottom: 6px; }
.ob-sub { color: var(--muted); font-size: 12px; line-height: 1.6; margin-bottom: 24px; }
.ob-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
.ob-feat { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.ob-feat-icon { font-size: 16px; margin-bottom: 6px; }
.ob-feat-title { color: var(--text); font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.ob-feat-desc { color: var(--muted); font-size: 11px; line-height: 1.5; }

/* AI badge */
.ai-badge { font-size: 9px; color: #56d364; background: rgba(86,211,100,.1); border: 1px solid rgba(86,211,100,.2); padding: 1px 5px; border-radius: 3px; letter-spacing: 0.5px; }

/* Override vis.js tooltip wrapper — remove the default white box */
div.vis-tooltip {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
  color: inherit !important;
  font-family: inherit !important;
  font-size: inherit !important;
  pointer-events: none !important;
}
</style>
</head>
<body>

<!-- Onboarding overlay (shown once on first visit) -->
<div id="onboarding" style="display:none">
  <div class="ob-card">
    <div class="ob-title">CORTEX</div>
    <div class="ob-sub">Your local AI memory router. Every decision, preference, and fact your AI tools learn — stored, linked, and evolving over time.</div>
    <div class="ob-grid">
      <div class="ob-feat">
        <div class="ob-feat-icon">◉</div>
        <div class="ob-feat-title">Knowledge graph</div>
        <div class="ob-feat-desc">Nodes are memories. Click any node to inspect and edit it. Drag to pan, scroll to zoom. Colored halos group by type.</div>
      </div>
      <div class="ob-feat">
        <div class="ob-feat-icon">↑</div>
        <div class="ob-feat-title">Override history</div>
        <div class="ob-feat-desc">When a belief changes, create an Override. The old memory becomes superseded — history is never lost, always inspectable.</div>
      </div>
      <div class="ob-feat">
        <div class="ob-feat-icon">⬡</div>
        <div class="ob-feat-title">Type filter</div>
        <div class="ob-feat-desc">Preferences, decisions, facts, sessions. Click any type in the left panel to show or hide those nodes in the graph.</div>
      </div>
      <div class="ob-feat">
        <div class="ob-feat-icon">＋</div>
        <div class="ob-feat-title">Add memories</div>
        <div class="ob-feat-desc">Use the + Add tab to write a memory manually. Your AI tools (Claude, Cursor) write memories automatically via MCP.</div>
      </div>
    </div>
    <button class="btn primary ob-dismiss" onclick="dismissOnboarding()">Got it — start exploring</button>
  </div>
</div>

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
    <div class="panel-section" style="margin-top:auto;border-bottom:none">
      <div style="color:var(--muted);font-size:10px" id="last-updated"></div>
    </div>
  </div>

  <!-- Center: knowledge graph -->
  <div class="center-panel">
    <div class="graph-toolbar">
      <span id="graph-label">Knowledge graph</span>
      <div style="margin-left:auto;display:flex;gap:6px">
        <button class="btn" id="btn-fit" title="Fit all nodes in view">⊞ Fit</button>
        <button class="btn" id="btn-3d" title="Switch to 3D force graph">3D</button>
        <button class="btn" id="btn-toggle-superseded">Show superseded</button>
      </div>
    </div>
    <div id="graph-container">
      <div id="graph-canvas"></div>
      <div id="graph-3d"></div>
      <div class="graph-hint" id="graph-hint">Hover a node to preview · Click to inspect · Drag to pan · Scroll to zoom</div>
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
      <div id="detail-empty-state">
        <div style="padding:16px 0">
          <div style="color:var(--muted);font-size:12px;text-align:center;margin-bottom:20px;line-height:1.6">
            Click any node in the graph<br>to inspect and edit it here.
          </div>
          <div style="border:1px solid var(--border);border-radius:8px;padding:14px;font-size:11px;color:var(--muted);line-height:1.7">
            <div style="color:var(--text);font-weight:600;margin-bottom:8px;font-size:12px">How memories work</div>
            Each node is a <b style="color:var(--text)">memory</b> — a preference, decision, or fact your AI tools have learned about your projects.<br><br>
            <span style="color:var(--accent)">Override</span> → creates a new version while preserving the old one as history. The superseded node stays in the graph, faded.<br><br>
            <span style="color:var(--accent)">Edit</span> → updates content in-place (no history).<br><br>
            Connected nodes share tags or have override relationships. Orange edges = overrides.
          </div>
        </div>
      </div>
    </div>
    <div class="right-content" id="panel-list" style="display:none">
      <div id="memory-list"></div>
    </div>
    <div class="right-content" id="panel-add" style="display:none">
      <div class="add-form">
        <textarea id="add-content" placeholder="What do you want to remember?&#10;&#10;e.g. Always prefer named exports over defaults"></textarea>
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
      <div style="color:var(--muted);font-size:11px;line-height:1.6;padding:0 2px">
        <b style="color:var(--text)">Types:</b><br>
        <b style="color:var(--pref)">preference</b> — coding style, tool choices, how you like things done<br>
        <b style="color:var(--dec)">decision</b> — architectural or product decisions with rationale<br>
        <b style="color:var(--fact)">fact</b> — project facts: stack, config, constraints<br>
        <b style="color:var(--sess)">session</b> — context from a specific work session
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

let allMemories    = [];
let selectedId     = null;
let activeFilters  = new Set(Object.keys(TYPE_COLORS));
let showSuperseded = false;
let network        = null;
let graphData      = { nodes: new vis.DataSet(), edges: new vis.DataSet() };
let is3D           = false;
let graph3d        = null;

// ── Convex hull (Graham scan) ─────────────────────────────────
function convexHull(pts) {
  if (pts.length < 2) return [...pts];
  const sorted = [...pts].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  const lower = [], upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return [...lower, ...upper];
}

// Draw a smooth inflated halo around a set of positions
function drawHalo(ctx, positions, color, scale) {
  if (!positions.length) return;
  const pad  = 42 / scale; // fixed screen-space padding converted to graph coords
  const cx   = positions.reduce((s, p) => s + p.x, 0) / positions.length;
  const cy   = positions.reduce((s, p) => s + p.y, 0) / positions.length;

  let hull = positions.length >= 3 ? convexHull(positions) : [...positions];
  if (hull.length < 2) hull = positions;

  // Inflate outward from centroid
  const expanded = hull.map(p => {
    const dx = p.x - cx, dy = p.y - cy;
    const d  = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / d) * pad, y: p.y + (dy / d) * pad };
  });

  ctx.beginPath();
  if (expanded.length === 1) {
    ctx.arc(expanded[0].x, expanded[0].y, pad, 0, Math.PI * 2);
  } else if (expanded.length === 2) {
    // Capsule
    const [a, b] = expanded;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.arc(a.x, a.y, pad * 0.6, ang + Math.PI/2, ang - Math.PI/2);
    ctx.arc(b.x, b.y, pad * 0.6, ang - Math.PI/2, ang + Math.PI/2);
    ctx.closePath();
  } else {
    // Smooth closed blob: start at midpoint of last→first so every segment
    // is a quadratic bezier from mid(prev,cur) to mid(cur,nxt) with cur as control point.
    const n = expanded.length;
    ctx.moveTo(
      (expanded[n-1].x + expanded[0].x) / 2,
      (expanded[n-1].y + expanded[0].y) / 2
    );
    for (let i = 0; i < n; i++) {
      const cur = expanded[i];
      const nxt = expanded[(i + 1) % n];
      ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + nxt.x) / 2, (cur.y + nxt.y) / 2);
    }
    ctx.closePath();
  }

  ctx.fillStyle   = hexAlpha(color, 0.055);
  ctx.strokeStyle = hexAlpha(color, 0.22);
  ctx.lineWidth   = 1.5 / scale;
  ctx.fill();
  ctx.stroke();
}

// ── Vis.js network ────────────────────────────────────────────
function initGraph() {
  const container = document.getElementById('graph-canvas');

  const options = {
    nodes: {
      shape: 'dot',
      size: 14,
      font: { color: '#e6edf3', size: 0, face: 'JetBrains Mono, monospace' }, // size:0 hides labels
      borderWidth: 2,
      borderWidthSelected: 3,
      chosen: true,
    },
    edges: {
      color: { color: '#2a3040', highlight: '#ff6428', hover: '#555e6e' },
      width: 1,
      smooth: { type: 'continuous', roundness: 0.35 },
      font: { color: '#7d8590', size: 10, face: 'monospace' },
      arrows: { to: { enabled: true, scaleFactor: 0.45 } },
      selectionWidth: 2.5,
    },
    physics: {
      enabled: true,
      forceAtlas2Based: {
        gravitationalConstant: -130,
        centralGravity: 0.004,
        springLength: 200,
        springConstant: 0.05,
        damping: 0.85,
      },
      maxVelocity: 60,
      solver: 'forceAtlas2Based',
      stabilization: { iterations: 200, updateInterval: 20 },
    },
    interaction: {
      hover: true,
      tooltipDelay: 150,
      zoomView: true,
      dragView: true,
      hideEdgesOnDrag: true,
    },
    layout: { improvedLayout: true },
  };

  network = new vis.Network(container, graphData, options);

  // Draw type-cluster halos after each render frame
  network.on('afterDrawing', ctx => {
    const scale    = network.getScale();
    const byType   = {};
    graphData.nodes.forEach(n => {
      const m = window._memById?.[n.id];
      if (!m || m.status === 'superseded') return;
      const pos = network.getPosition(n.id);
      (byType[m.type] = byType[m.type] || []).push(pos);
    });
    for (const [type, positions] of Object.entries(byType)) {
      const color = TYPE_COLORS[type];
      if (color) drawHalo(ctx, positions, color, scale);
    }
  });

  network.on('click', params => {
    if (params.nodes.length > 0) {
      selectMemory(params.nodes[0]);
      showTab('detail');
    } else {
      selectedId = null;
      renderDetailEmpty();
    }
  });

  network.on('stabilizationIterationsDone', () => {
    network.setOptions({ physics: { enabled: false } });
  });
}

// Stable hash for a node — used to skip no-op updates
function nodeHash(m) {
  return [m.id, m.status, m.type, (m.title || m.content || '').slice(0, 60)].join('|');
}

function buildVisNode(m) {
  const color = TYPE_COLORS[m.type] || '#7d8590';
  const sup   = m.status === 'superseded';
  const short = truncate(m.title || m.content || '', 55);
  // vis.js renders string titles as plain text — must pass a DOM element for HTML tooltips
  const tip = document.createElement('div');
  tip.style.cssText = 'max-width:240px;font-family:monospace;font-size:12px;line-height:1.5;padding:8px 10px;background:#161b22;border:1px solid #30363d;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.6);color:#e6edf3';
  tip.innerHTML = \`<span style="color:\${color};font-size:10px;text-transform:uppercase;letter-spacing:1px">\${m.type || ''}</span>\${sup ? \` <span style="color:#7d8590;font-size:10px">· superseded</span>\` : ''}
<div style="color:#e6edf3;margin-top:6px;font-size:12px">\${escHtml(short)}</div>\${(m.tags||[]).length ? \`<div style="color:#7d8590;margin-top:5px;font-size:10px">\${(m.tags||[]).slice(0,4).join(' · ')}</div>\` : ''}
<div style="color:#404858;margin-top:5px;font-size:10px">click to inspect</div>\`;
  return {
    id: m.id,
    label: '',   // No permanent labels — keeps the graph clean
    title: tip,  // DOM element renders as styled HTML
    color: {
      background: sup ? 'rgba(125,133,144,.10)' : hexAlpha(color, 0.16),
      border:     sup ? '#2a3040' : color,
      highlight: { background: hexAlpha(color, 0.35), border: '#ff6428' },
      hover:     { background: hexAlpha(color, 0.28), border: color },
    },
    size:    sup ? 7 : 14,
    opacity: sup ? 0.35 : 1,
    font:    { size: 0 },  // Always hidden
  };
}

function rebuildGraph(memories) {
  if (!network) return;
  const visible    = memories.filter(m =>
    activeFilters.has(m.type) && (showSuperseded || m.status === 'active')
  );
  const visibleIds = new Set(visible.map(m => m.id));

  // ── Diff nodes ──────────────────────────────────────────
  const existingIds = new Set(graphData.nodes.getIds());
  const toAdd       = [];
  const toUpdate    = [];
  const toRemoveIds = [...existingIds].filter(id => !visibleIds.has(id));

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
      color: e.label === 'overrides'
        ? { color: '#ff6428', highlight: '#ff6428', hover: '#ff6428' }
        : { color: '#2a3040', hover: '#404858' },
      width: e.label === 'overrides' ? 2 : 1,
    }));
  const edgeHash     = newEdges.map(e => e.from + e.to + e.label).join(',');
  const edgesChanged = edgeHash !== window._lastEdgeHash;
  window._lastEdgeHash = edgeHash;

  if (toRemoveIds.length) graphData.nodes.remove(toRemoveIds);
  if (toAdd.length)       graphData.nodes.add(toAdd);
  if (toUpdate.length)    graphData.nodes.update(toUpdate);
  if (edgesChanged) { graphData.edges.clear(); graphData.edges.add(newEdges); }

  if (toAdd.length > 0) {
    network.setOptions({ physics: { enabled: true, stabilization: { iterations: 80 } } });
  }

  // Sync 3D if active
  if (is3D && graph3d) sync3DData();
}

// ── Data loading ──────────────────────────────────────────────
async function loadGraph() {
  const [graphRes, statusRes] = await Promise.all([
    fetch('/api/graph'),
    fetch('/api/status'),
  ]);
  const { nodes, edges } = await graphRes.json();
  const status           = await statusRes.json();

  window._graphEdges = edges;
  window._graphNodes = nodes;

  // API sends { group } for vis.js — normalise to { type } for our filter logic
  for (const n of nodes) { n.type = n.type ?? n.group; }

  allMemories = nodes;
  window._memById = {};
  for (const m of allMemories) window._memById[m.id] = m;

  rebuildGraph(allMemories);
  renderTypeLegend();
  renderBackends(status.backends);

  document.getElementById('h-total').textContent    = status.total_memories ?? nodes.length;
  document.getElementById('h-queries').textContent  = status.today.queries;
  document.getElementById('h-latency').textContent  = status.today.avg_latency_ms > 0 ? status.today.avg_latency_ms + 'ms' : '—';
  document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
}

async function loadMemoryList() {
  const q   = document.getElementById('search-input')?.value?.toLowerCase() ?? '';
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
  if (network && !is3D) {
    network.selectNodes([id]);
    network.focus(id, { animation: { duration: 350, easingFunction: 'easeInOutQuad' }, scale: 1.15 });
  }
}

function renderDetailEmpty() {
  const d = document.getElementById('detail-empty-state');
  if (d) d.style.display = '';
}

function renderDetail(m) {
  const container = document.getElementById('panel-detail');
  const emptyState = document.getElementById('detail-empty-state');
  if (!m) { if (emptyState) emptyState.style.display = ''; return; }
  if (emptyState) emptyState.style.display = 'none';

  const color  = TYPE_COLORS[m.type] || '#7d8590';
  const chain  = buildChain(m.id);
  const isSuperseded = m.status === 'superseded';

  // Find memory that superseded this one (child in override chain)
  const supersededBy = allMemories.find(x => x.supersedes_id === m.id);

  // Remove any previously rendered detail
  let detailEl = document.getElementById('memory-detail');
  if (detailEl) detailEl.remove();

  detailEl = document.createElement('div');
  detailEl.id = 'memory-detail';
  detailEl.innerHTML = \`
    <!-- Header row: type + status + age -->
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:16px;flex-wrap:wrap">
      <span class="mc-type t-\${m.type}" style="font-size:11px;padding:2px 9px">\${m.type}</span>
      \${isSuperseded
        ? \`<span class="superseded-badge" style="font-size:10px">superseded</span>\`
        : \`<span style="font-size:10px;color:var(--green)">● active</span>\`
      }
      \${supersededBy ? \`<span style="font-size:10px;color:var(--muted)">overridden later</span>\` : ''}
      <span style="font-size:10px;color:var(--muted);margin-left:auto">\${relTime(m.created_at)}</span>
    </div>

    <!-- Content -->
    <div class="detail-section">
      <div class="detail-label">Memory content</div>
      <div class="detail-content" id="dc-content">\${escHtml(m.title || m.content || '')}</div>
      <textarea class="detail-edit" id="dc-edit" style="display:none">\${escHtml(m.title || m.content || '')}</textarea>
    </div>

    <!-- Tags -->
    \${(m.tags?.length || m.project || m.cluster) ? \`
    <div class="detail-section">
      <div class="detail-label">
        Tags &amp; cluster
        \${m.cluster ? \`<span class="ai-badge">AI</span>\` : ''}
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
        \${m.cluster ? \`<span class="mc-tag" style="color:var(--fact);border:1px solid rgba(121,192,255,.2)">\${escHtml(m.cluster)}</span>\` : ''}
        \${(m.tags||[]).map(t => \`<span class="mc-tag">\${escHtml(t)}</span>\`).join('')}
        \${m.project ? \`<span class="mc-tag" style="color:var(--accent)">\${escHtml(m.project)}</span>\` : ''}
      </div>
    </div>\` : ''}

    <!-- Override lineage timeline -->
    \${chain.length > 1 ? \`
    <div class="detail-section">
      <div class="detail-label">
        Memory lineage
        <span style="color:var(--muted);font-size:9px;font-weight:normal;letter-spacing:0">newest → oldest</span>
      </div>
      <div class="chain-timeline">
        \${chain.map((c, i) => \`
          <div class="chain-step \${i === 0 ? 'chain-step--current' : ''}">
            <div class="chain-step__dot"></div>
            \${i < chain.length - 1 ? '<div class="chain-step__line"></div>' : ''}
            <div class="chain-step__content">
              <div class="chain-step__text">\${escHtml(c.content)}</div>
              <div class="chain-step__label">\${i === 0 ? 'current' : 'overridden'}</div>
            </div>
          </div>
        \`).join('')}
      </div>
    </div>\` : ''}

    <!-- Actions -->
    <div class="detail-section">
      <div class="detail-label">Actions</div>
      <div class="detail-actions">
        <button class="btn" onclick="startEdit()" title="Edit the content of this memory (no history)">Edit</button>
        <button class="btn" onclick="toggleOverrideForm()" title="Create a new version — old memory becomes superseded (history preserved)">Override</button>
        <button class="btn danger" onclick="deleteMemory('\${m.id}')" title="Permanently delete this memory">Delete</button>
      </div>
      <div class="override-form" id="override-form">
        <div class="of-hint">
          <b>Override</b> preserves history. The current memory becomes <i>superseded</i> — still visible in the graph (faded) and in the lineage timeline above.
        </div>
        <textarea id="override-input" placeholder="Enter the updated version of this memory..."></textarea>
        <div style="display:flex;gap:6px">
          <button class="btn primary" onclick="submitOverride('\${m.id}')">Apply override</button>
          <button class="btn" onclick="toggleOverrideForm()">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Footer meta -->
    <div style="color:var(--muted);font-size:10px;border-top:1px solid var(--border);padding-top:10px;line-height:1.8">
      <span style="font-family:monospace;color:var(--surface2-inv,#555)">\${m.id.slice(0,12)}…</span>
      · \${m.backend || 'local'}
      · \${new Date(m.created_at).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })}
    </div>
  \`;
  container.appendChild(detailEl);
}

function buildChain(id) {
  const byId  = window._memById || {};
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
  if (!f) return;
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
  const d = document.getElementById('memory-detail');
  if (d) d.remove();
  renderDetailEmpty();
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
    if (m.status === 'active') counts[m.type] = (counts[m.type] || 0) + 1;
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

// ── 3D graph ─────────────────────────────────────────────────
function load3DLib() {
  return new Promise((resolve, reject) => {
    if (typeof ForceGraph3D !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    // jsdelivr is more reliable than unpkg for production traffic
    s.src = 'https://cdn.jsdelivr.net/npm/3d-force-graph@1.80.0/dist/3d-force-graph.min.js';
    s.onload = () => {
      if (typeof ForceGraph3D === 'undefined') {
        reject(new Error('3d-force-graph loaded but ForceGraph3D global not found'));
      } else {
        resolve();
      }
    };
    s.onerror = () => reject(new Error('Script failed to load from CDN'));
    document.head.appendChild(s);
  });
}

async function toggle3D() {
  const btn       = document.getElementById('btn-3d');
  const canvas2d  = document.getElementById('graph-canvas');
  const canvas3d  = document.getElementById('graph-3d');
  const hint      = document.getElementById('graph-hint');

  is3D = !is3D;
  btn.textContent = is3D ? '2D' : '3D';
  btn.classList.toggle('active-view', is3D);

  if (is3D) {
    canvas2d.style.display = 'none';
    canvas3d.style.display = '';
    canvas3d.innerHTML = \`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12px;gap:8px">
      <span style="animation:pulse 1s infinite">◉</span> Loading 3D renderer…
    </div>\`;
    hint.textContent = 'Click node to inspect · Drag to rotate · Scroll to zoom · Right-drag to pan';
    try {
      await load3DLib();
      // Two rAF cycles — let the browser compute layout so offsetWidth/Height are real
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      init3DGraph();
    } catch (e) {
      console.error('[Cortex 3D]', e);
      canvas3d.innerHTML = \`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px">
        <div style="color:var(--red);font-size:13px">3D renderer failed to load</div>
        <div style="color:var(--muted);font-size:11px;max-width:320px;text-align:center">\${escHtml(String(e?.message || e))}</div>
        <div style="color:var(--muted);font-size:11px">Requires an internet connection to load the WebGL library.</div>
        <button class="btn" onclick="toggle3D()" style="margin-top:4px">Back to 2D</button>
      </div>\`;
    }
  } else {
    canvas3d.style.display = 'none';
    canvas2d.style.display = '';
    hint.textContent = 'Hover a node to preview · Click to inspect · Drag to pan · Scroll to zoom';
    if (graph3d) { graph3d._destructor?.(); graph3d = null; }
    canvas3d.innerHTML = '';
  }
}

function init3DGraph() {
  const container = document.getElementById('graph-3d');
  container.innerHTML = '';

  // Use parent dimensions (graph-container) as the 3D canvas size
  const parent = document.getElementById('graph-container');
  const w = parent.offsetWidth  || window.innerWidth  - 210 - 400;
  const h = parent.offsetHeight || window.innerHeight - 44;

  const nodes3d = allMemories
    .filter(m => activeFilters.has(m.type) && (showSuperseded || m.status === 'active'))
    .map(m => ({
      id:     m.id,
      name:   truncate(m.title || m.content || '', 50),
      type:   m.type,
      status: m.status,
      color:  m.status === 'superseded' ? '#2a3040' : (TYPE_COLORS[m.type] || '#7d8590'),
    }));
  const nodeIds3d = new Set(nodes3d.map(n => n.id));
  const links3d = (window._graphEdges || [])
    .filter(e => nodeIds3d.has(e.from) && nodeIds3d.has(e.to))
    .map(e => ({ source: e.from, target: e.to, label: e.label || '' }));

  graph3d = ForceGraph3D()(container)
    .graphData({ nodes: nodes3d, links: links3d })
    .nodeLabel('name')
    .nodeColor('color')
    .nodeOpacity(0.9)
    .nodeRelSize(5)
    .linkColor(l => l.label === 'overrides' ? '#ff6428' : '#30363d')
    .linkOpacity(0.6)
    .linkWidth(l => l.label === 'overrides' ? 2 : 1)
    .backgroundColor('#0d1117')
    .warmupTicks(120)          // pre-run physics so nodes are spread on first frame
    .cooldownTicks(400)
    .onEngineStop(() => { if (graph3d) graph3d.zoomToFit(600, 80); })
    .onNodeClick(n => { selectMemory(n.id); showTab('detail'); })
    .onNodeHover(n => { document.body.style.cursor = n ? 'pointer' : 'default'; })
    .width(w)
    .height(h);
}

function sync3DData() {
  if (!graph3d) return;
  const nodes3d = allMemories
    .filter(m => activeFilters.has(m.type) && (showSuperseded || m.status === 'active'))
    .map(m => ({
      id:    m.id,
      name:  truncate(m.title || m.content || '', 50),
      type:  m.type,
      status: m.status,
      color: m.status === 'superseded' ? '#2a3040' : (TYPE_COLORS[m.type] || '#7d8590'),
    }));
  const nodeIds3d = new Set(nodes3d.map(n => n.id));
  const links3d = (window._graphEdges || [])
    .filter(e => nodeIds3d.has(e.from) && nodeIds3d.has(e.to))
    .map(e => ({ source: e.from, target: e.to, label: e.label || '' }));
  graph3d.graphData({ nodes: nodes3d, links: links3d });
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
document.getElementById('btn-3d').onclick  = toggle3D;
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
  const diff = Date.now() - new Date(v).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}
function truncate(s, n) { return s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''); }
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return \`rgba(\${r},\${g},\${b},\${a})\`;
}

// ── Onboarding ────────────────────────────────────────────────
function dismissOnboarding() {
  document.getElementById('onboarding').style.display = 'none';
  try { localStorage.setItem('cortex-onboarded', '1'); } catch {}
}
function maybeShowOnboarding() {
  try {
    if (!localStorage.getItem('cortex-onboarded')) {
      document.getElementById('onboarding').style.display = 'flex';
    }
  } catch { /* localStorage blocked (e.g. private browsing) — skip */ }
}

// ── Boot ──────────────────────────────────────────────────────
initGraph();
refresh();
maybeShowOnboarding();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
