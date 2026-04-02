// Mobile.js — Production Tracking Logic (Fix 20-22)
let elapsed = 0;
let isComplete = false;
let simulatedCode = "";

document.addEventListener('DOMContentLoaded', () => {
    const prompt = localStorage.getItem('agentforge_prompt') || "Build a FastAPI app";
    document.querySelector('.hero-prompt').textContent = prompt;
    simulatedCode = `<h1>AgentForge Mobile Preview</h1><p>${prompt}</p>`;
    
    initProgressRing();
    startTracking();
    
    document.getElementById('mobilePreviewBtn').onclick = () => {
        const blob = new Blob([simulatedCode], {type:'text/html'});
        window.open(URL.createObjectURL(blob), '_blank');
    };
    
    document.getElementById('mobileDownloadBtn').onclick = async () => {
        AF.showToast("Downloading...");
        const zip = new JSZip();
        zip.file("index.html", simulatedCode);
        const content = await zip.generateAsync({type:"blob"});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = "agentforge_mobile_export.zip";
        a.click();
    };
});

function initProgressRing() {
    const ring = document.getElementById('progressRing');
    if (!ring) return;
    const circ = 2 * Math.PI * 28;
    ring.style.strokeDasharray = circ;
    ring.style.strokeDashoffset = circ;
}

function updateProgress(pct) {
    const ring = document.getElementById('progressRing');
    const text = document.getElementById('progressText');
    if (!ring) return;
    const circ = 2 * Math.PI * 28;
    ring.style.strokeDashoffset = circ - (pct / 100) * circ;
    if (text) text.textContent = Math.round(pct) + '%';
}

function addLog(msg, info = false) {
    const term = document.querySelector('.log-terminal');
    if (!term) return;
    const line = document.createElement('div');
    line.className = 'log-line' + (info ? ' info' : '');
    line.textContent = `[${new Date().toLocaleTimeString([], {hour12:false})}] ${msg}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
}

function startTracking() {
    const steps = document.querySelectorAll('.step-row');
    const timerEl = document.getElementById('mobileElapsed');
    
    const interval = setInterval(() => {
        if (isComplete) { clearInterval(interval); return; }
        
        elapsed++;
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${m}:${s}`;
        
        // Progress Logic (24s total)
        const totalTime = 24;
        const progress = Math.min((elapsed / totalTime) * 100, 100);
        updateProgress(progress);
        
        // State Machine (Fix 20)
        if (elapsed === 1) {
            activateStep(0);
            addLog("ARCH — Analyzing prompt architecture...");
        } else if (elapsed === 8) {
            markStepDone(0);
            activateStep(1);
            addLog("CODER — Writing core logic and templates...", true);
        } else if (elapsed === 18) {
            markStepDone(1);
            activateStep(2);
            addLog("REV — Running automated validation suite...");
        } else if (elapsed === 24) {
            markStepDone(2);
            isComplete = true;
            addLog("RUN COMPLETE — Final artifacts generated.", true);
            showCompletion(); // Fix 21, 22
        }
    }, 1000);
}

function activateStep(idx) {
    const steps = document.querySelectorAll('.step-row');
    if (steps[idx]) steps[idx].className = 'step-row active';
}

function markStepDone(idx) {
    const steps = document.querySelectorAll('.step-row');
    if (steps[idx]) steps[idx].className = 'step-row done';
}

function showCompletion() {
    document.getElementById('completionSheet').classList.add('active');
    document.getElementById('stopFab').style.display = 'none';
    AF.showToast("Pipeline Complete!", "success");
}
