// Dashboard.js — Real Data Integration (Fix 3, 4)
function initDashboard() {
  const runs = AFStore.get('runs');
  calculateMetrics(runs);
  renderRecentTable(runs.slice(0, 5));
}

function calculateMetrics(runs) {
  const total = runs.length;
  const passed = runs.filter(r => r.status === 'passed' || r.status === 'LGTM').length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const avgLoops = total > 0 ? (runs.reduce((acc, r) => acc + (r.loops || 0), 0) / total).toFixed(1) : "0.0";

  document.getElementById('statTotal').textContent = total || "—";
  document.getElementById('statPass').textContent = total > 0 ? `${passRate}%` : "—";
  document.getElementById('statLoops').textContent = total > 0 ? avgLoops : "—";

  // Generate Sparklines (Fix 3)
  if (total > 1) {
    const runCounts = runs.map((_, i) => i + 1).reverse();
    const rates = runs.map((r, i) => {
        const slice = runs.slice(i);
        const p = slice.filter(x => x.status === 'passed' || x.status === 'LGTM').length;
        return Math.round((p / slice.length) * 100);
    }).reverse();
    const loops = runs.map(r => r.loops || 0).reverse();

    drawSparkline(document.getElementById('chartRuns'), runCounts, '#7C3AED', 'rgba(124,58,237,0.1)');
    drawSparkline(document.getElementById('chartPass'), rates, '#10B981', 'rgba(16,185,129,0.1)');
    drawSparkline(document.getElementById('chartLoops'), loops, '#F59E0B', 'rgba(245,158,11,0.1)');
  }
}

function renderRecentTable(runs) {
  const tbody = document.getElementById('recentRunsTable');
  if (!tbody) return;

  if (runs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">No runs yet — submit your first prompt above</td></tr>`;
    return;
  }

  tbody.innerHTML = runs.map(r => `
    <tr>
      <td class="mono" style="color:var(--purple-light)">#${r.id.toString().slice(-3)}</td>
      <td title="${r.prompt}">${truncateText(r.prompt, 60)}</td>
      <td>${getStatusBadge(r.status)}</td>
      <td class="mono">${r.loops || 1}/3</td>
      <td class="mono">${r.duration || '--'}</td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="nav-btn" data-tooltip="Output" onclick="viewOutput('${r.id}')">📄</button>
          <button class="nav-btn" data-tooltip="Logs" onclick="viewLogs('${r.id}')">📋</button>
          <button class="nav-btn" data-tooltip="Summary" onclick="viewSummary('${r.id}')">📝</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function viewOutput(id) { location.href = `pipeline.html?id=${id}`; }
function viewLogs(id) { location.href = `pipeline.html?id=${id}&tab=logs`; }
function viewSummary(id) { location.href = `pipeline.html?id=${id}&tab=summary`; }

document.addEventListener('DOMContentLoaded', initDashboard);
