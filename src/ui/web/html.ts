export const html = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cortex Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --muted: #7d8590; --cyan: #79c0ff;
    --green: #3fb950; --yellow: #d29922; --red: #f85149;
    --magenta: #d2a8ff; --blue: #58a6ff;
  }
  body { background: var(--bg); color: var(--text); font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; }
  header { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-bottom: 1px solid var(--border); }
  header h1 { color: var(--cyan); font-size: 18px; font-weight: 700; letter-spacing: 2px; }
  header .version { color: var(--muted); font-size: 11px; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  main { padding: 20px 24px; display: grid; gap: 16px; grid-template-columns: 1fr 1fr; grid-template-rows: auto; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
  .card.full { grid-column: 1 / -1; }
  .card h2 { color: var(--cyan); font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .stat { display: flex; flex-direction: column; gap: 2px; }
  .stat .label { color: var(--muted); font-size: 11px; }
  .stat .value { color: var(--cyan); font-size: 22px; font-weight: 700; }
  .backend-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); }
  .backend-row:last-child { border-bottom: none; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .dot.online { background: var(--green); }
  .dot.offline { background: var(--muted); }
  .backend-name { font-weight: 600; width: 110px; }
  .backend-name.qmd { color: var(--blue); }
  .backend-name.openmemory { color: var(--magenta); }
  .backend-name.byterover { color: var(--green); }
  .badge { padding: 1px 7px; border-radius: 4px; font-size: 11px; }
  .badge.online { background: rgba(63,185,80,.15); color: var(--green); }
  .badge.offline { background: rgba(125,133,144,.1); color: var(--muted); }
  .mem-count { margin-left: auto; color: var(--muted); font-size: 11px; }
  .memory-table { width: 100%; border-collapse: collapse; }
  .memory-table th { color: var(--muted); font-size: 11px; text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--border); }
  .memory-table td { padding: 6px 8px; border-bottom: 1px solid rgba(48,54,61,.5); vertical-align: middle; }
  .memory-table tr:hover td { background: rgba(255,255,255,.02); }
  .type-badge { padding: 1px 6px; border-radius: 4px; font-size: 11px; }
  .type-preference { background: rgba(210,168,255,.15); color: var(--magenta); }
  .type-decision { background: rgba(210,153,34,.15); color: var(--yellow); }
  .type-fact { background: rgba(88,166,255,.15); color: var(--blue); }
  .type-session { background: rgba(121,192,255,.15); color: var(--cyan); }
  .type-document { background: rgba(125,133,144,.1); color: var(--muted); }
  .content-cell { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chart-wrap { position: relative; height: 160px; }
  .cache-bar-outer { background: rgba(125,133,144,.15); border-radius: 4px; height: 8px; overflow: hidden; margin-top: 6px; }
  .cache-bar-inner { height: 100%; border-radius: 4px; transition: width .6s ease; }
  footer { text-align: center; color: var(--muted); font-size: 11px; padding: 16px; border-top: 1px solid var(--border); }
</style>
</head>
<body>
<header>
  <div class="live-dot"></div>
  <h1>CORTEX</h1>
  <span class="version" id="version">v0.1.0</span>
  <span class="version" style="margin-left:auto" id="last-updated"></span>
</header>
<main>
  <!-- Stats -->
  <div class="card">
    <h2>Today</h2>
    <div class="stat-grid">
      <div class="stat"><span class="label">Queries</span><span class="value" id="stat-queries">—</span></div>
      <div class="stat"><span class="label">Writes</span><span class="value" id="stat-writes">—</span></div>
      <div class="stat"><span class="label">Cache hits</span><span class="value" id="stat-cache">—</span></div>
      <div class="stat"><span class="label">Avg latency</span><span class="value" id="stat-latency">—</span></div>
    </div>
    <div style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:11px">
        <span>Cache efficiency</span><span id="cache-pct">—</span>
      </div>
      <div class="cache-bar-outer"><div class="cache-bar-inner" id="cache-bar" style="width:0%;background:var(--green)"></div></div>
    </div>
  </div>

  <!-- Backends -->
  <div class="card">
    <h2>Backends</h2>
    <div id="backends-list"><div style="color:var(--muted)">Loading...</div></div>
  </div>

  <!-- Query activity chart -->
  <div class="card full">
    <h2>Query activity (last 10 refreshes)</h2>
    <div class="chart-wrap"><canvas id="activity-chart"></canvas></div>
  </div>

  <!-- Memory browser -->
  <div class="card full">
    <h2>Recent memories</h2>
    <table class="memory-table">
      <thead><tr><th>Type</th><th>Content</th><th>Backend</th><th>When</th></tr></thead>
      <tbody id="memory-tbody"><tr><td colspan="4" style="color:var(--muted);padding:12px 8px">Loading...</td></tr></tbody>
    </table>
  </div>
</main>
<footer>cortex · local-first memory router · <span id="footer-time"></span></footer>

<script>
const BACKEND_COLORS = { qmd: '#58a6ff', openmemory: '#d2a8ff', byterover: '#3fb950' };

// Activity chart
const actCtx = document.getElementById('activity-chart').getContext('2d');
const actLabels = [];
const actData = [];
const actChart = new Chart(actCtx, {
  type: 'bar',
  data: {
    labels: actLabels,
    datasets: [{
      label: 'Queries',
      data: actData,
      backgroundColor: 'rgba(121,192,255,0.35)',
      borderColor: 'rgba(121,192,255,0.8)',
      borderWidth: 1,
      borderRadius: 3,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(48,54,61,.6)' }, ticks: { color: '#7d8590', font: { size: 11 } } },
      y: { grid: { color: 'rgba(48,54,61,.6)' }, ticks: { color: '#7d8590', font: { size: 11 }, stepSize: 1 }, beginAtZero: true }
    }
  }
});

let prevQueries = 0;

function relTime(isoOrMs) {
  const d = new Date(isoOrMs);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return Math.floor(diff/86400000) + 'd ago';
}

function truncate(s, n) { return s.length > n ? s.slice(0, n-1) + '…' : s; }

async function refresh() {
  try {
    const [statusRes, memoriesRes] = await Promise.all([
      fetch('/api/status'),
      fetch('/api/memories?limit=20')
    ]);
    const status = await statusRes.json();
    const { memories } = await memoriesRes.json();

    // Stats
    const t = status.today;
    const rate = t.queries > 0 ? Math.round(t.cache_hits / t.queries * 100) : 0;
    document.getElementById('stat-queries').textContent = t.queries;
    document.getElementById('stat-writes').textContent = t.writes;
    document.getElementById('stat-cache').textContent = t.cache_hits;
    document.getElementById('stat-latency').textContent = t.avg_latency_ms + 'ms';
    document.getElementById('cache-pct').textContent = rate + '%';
    const bar = document.getElementById('cache-bar');
    bar.style.width = rate + '%';
    bar.style.background = rate > 66 ? 'var(--green)' : rate > 33 ? 'var(--yellow)' : 'var(--red)';

    // Activity chart — push delta
    const now = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const delta = Math.max(0, t.queries - prevQueries);
    prevQueries = t.queries;
    if (actLabels.length >= 10) { actLabels.shift(); actData.shift(); }
    actLabels.push(now);
    actData.push(delta);
    actChart.update('none');

    // Backends
    const bl = document.getElementById('backends-list');
    bl.innerHTML = status.backends.map(b => \`
      <div class="backend-row">
        <div class="dot \${b.available ? 'online' : 'offline'}"></div>
        <span class="backend-name \${b.name}">\${b.name}</span>
        <span class="badge \${b.available ? 'online' : 'offline'}">\${b.available ? '✓ running' : '✗ offline'}</span>
        \${b.version ? \`<span style="color:var(--muted);font-size:11px">(\${b.version})</span>\` : ''}
        <span class="mem-count">\${b.available ? b.total_memories.toLocaleString() + ' memories' : '—'}</span>
      </div>
    \`).join('');

    // Memories
    const tbody = document.getElementById('memory-tbody');
    if (memories.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted);padding:12px 8px">No memories yet</td></tr>';
    } else {
      tbody.innerHTML = memories.map(m => \`
        <tr>
          <td><span class="type-badge type-\${m.type}">\${m.type}</span></td>
          <td class="content-cell" title="\${m.content.replace(/"/g,'&quot;')}">\${truncate(m.content, 80)}</td>
          <td style="color:\${BACKEND_COLORS[m.backend] ?? '#7d8590'}">\${m.backend}</td>
          <td style="color:var(--muted)">\${relTime(m.created_at)}</td>
        </tr>
      \`).join('');
    }

    document.getElementById('last-updated').textContent = 'Updated ' + relTime(new Date());
    document.getElementById('footer-time').textContent = new Date().toLocaleTimeString();
  } catch(e) {
    console.error('refresh failed', e);
  }
}

refresh();
setInterval(refresh, 3000);
</script>
</body>
</html>`;
