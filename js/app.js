// ============================================
// App.js — Core Infrastructure (Fix 1, 16-19, 23)
// ============================================

const AFStore = {
  get: (key, def = []) => JSON.parse(localStorage.getItem(`agentforge_${key}`)) || def,
  save: (key, val) => localStorage.setItem(`agentforge_${key}`, JSON.stringify(val)),
  addRun: (run) => {
    const runs = AFStore.get('runs');
    runs.unshift(run);
    AFStore.save('runs', runs);
  }
};

const AF = {
  showToast: (msg, type = 'info') => {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};

// --- Active Nav Highlighting & Tooltips ---
function initNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-btn').forEach(item => {
    const href = item.getAttribute('href');
    if (href && (href === currentPage || (currentPage === '' && href === 'index.html'))) {
      item.classList.add('active');
    }
    // Tooltip Fix
    const tooltips = { 'index.html': 'Dashboard', 'pipeline.html': 'Pipeline', 'history.html': 'History', 'config.html': 'Settings', 'mobile.html': 'Mobile' };
    if (href && tooltips[href]) item.setAttribute('data-tooltip', tooltips[href]);
  });
}

// --- Utility Functions ---
function truncateText(text, max) {
  return text.length > max ? text.substring(0, max) + '...' : text;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getStatusBadge(status) {
  const map = {
    passed: '<span class="badge-status passed">Passed</span>',
    failed: '<span class="badge-status failed">Failed</span>',
    LGTM: '<span class="badge-status passed">LGTM</span>',
    running: '<span class="badge-status" style="background:var(--purple-glow); color:var(--purple-light)">Running</span>'
  };
  return map[status.toLowerCase()] || map[status] || `<span class="badge-status">${status}</span>`;
}

// --- Sparkline Renderer ---
function drawSparkline(canvas, data, color, fillColor) {
  if (!canvas || !data || data.length < 2) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  const max = Math.max(...data) * 1.1; const min = Math.min(...data) * 0.9;
  const range = max - min || 1; const step = w / (data.length - 1);
  const points = data.map((v, i) => ({ x: i * step, y: h - ((v - min) / range) * h * 0.82 - h * 0.05 }));

  ctx.beginPath(); ctx.moveTo(points[0].x, h);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length-1].x, h); ctx.closePath();
  const grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0, fillColor || 'rgba(124,58,237,0.15)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = color || '#7C3AED'; ctx.lineWidth = 2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}

document.addEventListener('DOMContentLoaded', initNav);
