// Pipeline.js — Real Backend Integration
document.addEventListener('DOMContentLoaded', () => {
  const prompt = initPipelineRun();
  initLiveTimer();
  if (prompt) {
    triggerRealRun(prompt);
    connectWebSocket();
  }
});

// --- Run Trigger ---
async function triggerRealRun(prompt) {
  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) throw new Error('Run trigger failed');
  } catch (err) {
    console.error("Failed to trigger run:", err);
  }
}

// --- WebSocket Streaming ---
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws/stream`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    appendLog(data);
    updateUIFromEvent(data);
  };

  ws.onclose = () => {
    appendLog({ agent: 'sys', details: 'WebSocket connection closed.' });
  };
}

function appendLog(data) {
  const stream = document.getElementById('logStream');
  if (!stream) return;

  const logRow = document.createElement('div');
  logRow.className = 'log-row';
  logRow.style.marginBottom = '8px';
  logRow.style.opacity = '0';
  logRow.style.transition = 'opacity 0.4s ease';

  const time = new Date().toLocaleTimeString([], { hour12: false });
  let agent = data.agent || 'SYS';
  let msg = data.details || data.prompt || 'Event received';
  
  let badgeColor = 'var(--text-muted)';
  if (agent === 'architect') badgeColor = 'var(--purple-light)';
  if (agent === 'coder') badgeColor = 'var(--teal-light)';
  if (agent === 'reviewer') badgeColor = '#FCD34D';

  logRow.innerHTML = `
    <span style="color:var(--text-muted); margin-right:12px;">${time}</span>
    <span style="font-weight:800; color:${badgeColor}; margin-right:12px; width:70px; display:inline-block;">[${agent.toUpperCase()}]</span>
    <span>${msg}</span>
  `;

  stream.appendChild(logRow);
  setTimeout(() => logRow.style.opacity = '1', 10);
  stream.scrollTop = stream.scrollHeight;
}

function updateUIFromEvent(data) {
  if (data.type === 'loop_log') {
    const cardId = `#${data.agent}Card`;
    const card = document.querySelector(cardId);
    if (!card) return;

    // Update Badge
    const badge = card.querySelector('.badge-status');
    if (badge) {
      badge.textContent = data.status.toUpperCase();
      badge.className = 'badge-status ' + (data.status === 'passed' || data.status === 'LGTM' ? 'passed' : data.status === 'failed' ? 'failed' : '');
    }

    // Update Body Content
    const body = card.querySelector('.agent-body');
    if (body) {
      if (data.status === 'starting' || data.status === 'running') {
        body.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px; height:100%; justify-content:center;">
            <div style="color:var(--text-primary); font-weight:700;">Processing...</div>
            <div style="font-size:11px; color:var(--text-muted); line-height:1.4;">${data.details || 'Agent is generating output...'}</div>
            <div class="skeleton-line" style="width:80%; height:4px; margin-top:8px;"></div>
          </div>
        `;
      } else if (data.status === 'complete' || data.status === 'passed' || data.status === 'LGTM') {
        body.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px; height:100%; justify-content:center;">
             <div style="color:var(--teal-light); font-weight:700;">✓ TASK COMPLETE</div>
             <div style="font-size:11px; opacity:0.8;">${data.details || 'Wait for next agent...'}</div>
          </div>
        `;
      }
    }
    
    // Trigger file refresh when coder/reviewer finishes
    if (data.status === 'complete' || data.status === 'passed' || data.status === 'LGTM') {
      fetchAndRenderFiles();
    }

    // Update global progress node
    const stageMap = { 'architect': 0, 'coder': 1, 'reviewer': 2 };
    if (stageMap[data.agent] !== undefined) {
       const nodes = document.querySelectorAll('.stage-node');
       nodes.forEach((n, i) => {
         if (i < stageMap[data.agent]) n.className = 'stage-node complete';
         else if (i === stageMap[data.agent]) n.className = 'stage-node active';
       });
       
       // Update Loop Counter in UI
       const loopBadge = document.querySelector('.pill-purple');
       if (loopBadge && data.loop) {
          loopBadge.textContent = `Loop ${data.loop}/3`;
       }
    }
  }
}

async function fetchAndRenderFiles() {
  try {
    const res = await fetch('/api/files');
    const files = await res.json();
    const list = document.querySelector('#filesPane .file-list');
    const badge = document.querySelector('.output-header .badge-teal-pill');
    
    if (badge) badge.textContent = `${files.length} files generated`;
    if (!list) return;

    if (files.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">No files generated yet.</div>`;
      return;
    }

    list.innerHTML = files.map(f => `
      <div class="file-row-main" style="border-bottom: 1px solid var(--border-glass); padding: 12px 0;">
         <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:12px;">
               <span class="badge-status" style="background:var(--purple-glow); color:var(--purple-light); font-size:10px;">${f.path.split('.').pop()}</span>
               <span style="font-weight:700;">${f.path}</span>
               <span class="muted" style="font-size:11px;">${Math.round(f.size/1024)} KB</span>
            </div>
            <button class="btn-ghost" style="padding:4px 8px; font-size:10px;">View Code</button>
         </div>
      </div>
    `).join('');
  } catch (err) {
    console.error("Failed to render files:", err);
  }
}

// --- Initialization ---
function initPipelineRun() {
  // Check sessionStorage first (persists across refreshes in the same tab)
  let prompt = sessionStorage.getItem('agentforge_active_prompt');
  
  // If not in session, check if it was just passed from the dashboard via localStorage
  if (!prompt) {
    prompt = localStorage.getItem('agentforge_prompt');
    if (prompt) {
      sessionStorage.setItem('agentforge_active_prompt', prompt);
      localStorage.removeItem('agentforge_prompt'); // Clear the one-time transition key
    }
  }
  
  if (!prompt) {
    document.querySelector('.page-content').innerHTML = `
      <div style="text-align:center; padding: 100px 20px;">
        <div style="font-size:48px; margin-bottom:24px;">🚫</div>
        <h2 style="margin-bottom:16px;">No Active Run</h2>
        <p style="color:var(--text-muted); margin-bottom: 24px;">There is currently no prompt active. Please start a new project from the dashboard.</p>
        <button class="btn-primary" onclick="window.location.href='index.html'" style="padding: 12px 24px;">Return to Dashboard</button>
      </div>
    `;
    return null;
  }

  const promptLine = document.querySelector('.prompt-line');
  if (promptLine) promptLine.textContent = prompt;
  
  resetAgents();
  return prompt;
}

function resetAgents() {
  const bodies = document.querySelectorAll('.agent-body');
  bodies.forEach(body => {
    body.innerHTML = `
      <div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted); font-family:'JetBrains Mono', monospace; font-size:12px;">
        <span class="pulse" style="margin-right:8px;">●</span> Initializing...
      </div>
    `;
  });
}

// --- Others ---
let seconds = 0;
function initLiveTimer() {
  const timerEl = document.getElementById('liveTimer');
  if (!timerEl) return;
  setInterval(() => {
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }, 1000);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.toLowerCase().includes(tabId)) btn.classList.add('active');
  });
  const panes = ['files', 'logs', 'summary'];
  panes.forEach(p => {
    const el = document.getElementById(p + 'Pane');
    if (el) {
      if (p === tabId) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });
}
