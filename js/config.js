// Config.js — Real-Time Settings & Persistence (Fix 16-19)
const MODELS = ['llama3.1', 'llama3.1:8b', 'qwen2.5-coder', 'nemotron-mini', 'phi-3-mini'];

document.addEventListener('DOMContentLoaded', () => {
    initModelSelects();
    loadSettings();
    initSliders();
});

function initModelSelects() {
    const selects = ['modelArch', 'modelCode', 'modelRev'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = MODELS.map(m => `<option value="${m}">${m}</option>`).join('');
    });
}

function initSliders() {
    const range = document.getElementById('maxLoopsRange');
    const val = document.getElementById('maxLoopsVal');
    if (range && val) {
        range.oninput = () => val.textContent = range.value;
    }
}

function loadSettings() {
    // Load Models
    const models = AFStore.get('models', { arch: 'llama3.1', code: 'qwen2.5-coder', rev: 'llama3.1:8b' });
    document.getElementById('modelArch').value = models.arch;
    document.getElementById('modelCode').value = models.code;
    document.getElementById('modelRev').value = models.rev;

    // Load Loop Config
    const config = AFStore.get('config', { maxLoops: 3, autoRetry: false });
    document.getElementById('maxLoopsRange').value = config.maxLoops;
    document.getElementById('maxLoopsVal').textContent = config.maxLoops;
    document.getElementById('autoRetry').checked = config.autoRetry;

    // Load General
    const general = AFStore.get('general', { notifications: true });
    document.getElementById('showNotifications').checked = general.notifications;
}

function saveSettings() {
    const models = {
        arch: document.getElementById('modelArch').value,
        code: document.getElementById('modelCode').value,
        rev: document.getElementById('modelRev').value
    };
    const config = {
        maxLoops: parseInt(document.getElementById('maxLoopsRange').value),
        autoRetry: document.getElementById('autoRetry').checked
    };
    const general = {
        notifications: document.getElementById('showNotifications').checked
    };

    AFStore.save('models', models);
    AFStore.save('config', config);
    AFStore.save('general', general);

    AF.showToast("Settings saved successfully", "success");
}

function switchConfigTab(id) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    
    event.target.classList.add('active');
    document.getElementById(id + 'Pane').classList.remove('hidden');
}

function clearHistory() {
    if (confirm("Are you sure you want to purge all run history? This cannot be undone.")) {
        AFStore.save('runs', []);
        AF.showToast("History purged", "info");
    }
}

function resetConfig() {
    if (confirm("Reset all settings to factory defaults?")) {
        localStorage.removeItem('agentforge_models');
        localStorage.removeItem('agentforge_config');
        localStorage.removeItem('agentforge_general');
        AF.showToast("Settings reset", "info");
        location.reload();
    }
}
