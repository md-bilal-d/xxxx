// History.js — Real Data & Logic (Fix 10-15)
let allRuns = [];
let filteredRuns = [];
let currentPage = 1;
const perPage = 10;
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    allRuns = AFStore.get('runs');
    initSearch();
    filterHistory('all');
});

function filterHistory(type) {
    currentFilter = type;
    document.querySelectorAll('.filter-group .btn-ghost').forEach(b => {
        b.classList.toggle('active', b.textContent.toLowerCase().includes(type));
    });
    
    applyFilters();
}

function initSearch() {
    const s = document.getElementById('historySearch');
    if (s) s.addEventListener('input', applyFilters);
}

function applyFilters() {
    const q = document.getElementById('historySearch').value.toLowerCase();
    filteredRuns = allRuns.filter(r => {
        const matchesFilter = currentFilter === 'all' || r.status === currentFilter;
        const matchesSearch = r.prompt.toLowerCase().includes(q) || r.id.toString().includes(q);
        return matchesFilter && matchesSearch;
    });
    
    currentPage = 1;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const page = filteredRuns.slice(start, end);

    if (page.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">No matching history found</td></tr>`;
        updatePaginationInfo(0, 0, 0);
        return;
    }

    tbody.innerHTML = page.map(r => `
        <tr>
            <td class="mono" style="color:var(--purple-light)">#${r.id.toString().slice(-3)}</td>
            <td title="${r.prompt}">${truncateText(r.prompt, 80)}</td>
            <td>${getStatusBadge(r.status)}</td>
            <td class="mono">${r.loops || 1}/3</td>
            <td class="mono">${r.duration || '--'}</td>
            <td><button class="nav-btn" onclick="showDetails('${r.id}')">👁 View</button></td>
        </tr>
    `).join('');

    updatePaginationInfo(start + 1, Math.min(end, filteredRuns.length), filteredRuns.length);
}

function updatePaginationInfo(start, end, total) {
    const info = document.getElementById('paginationInfo');
    if (info) info.textContent = total > 0 ? `Showing ${start}-${end} of ${total}` : 'Showing 0 of 0';
}

function changePage(delta) {
    const max = Math.ceil(filteredRuns.length / perPage);
    currentPage = Math.max(1, Math.min(max, currentPage + delta));
    renderTable();
}

function showDetails(id) {
    const run = allRuns.find(r => r.id.toString() === id.toString());
    if (!run) return;

    const modal = document.getElementById('detailsModal');
    const content = document.getElementById('modalContent');
    modal.classList.remove('hidden');

    content.innerHTML = `
        <div style="margin-top:20px;">
            <p><strong>ID:</strong> ${run.id}</p>
            <p><strong>Timestamp:</strong> ${run.timestamp}</p>
            <p><strong>Status:</strong> ${getStatusBadge(run.status)}</p>
            <p><strong>Loops:</strong> ${run.loops || 1}/3</p>
            <p><strong>Duration:</strong> ${run.duration || '--'}</p>
            <div style="margin-top:20px;">
                <strong>Prompt:</strong>
                <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; margin-top:8px; border:1px solid var(--border-glass);">
                    ${run.prompt}
                </div>
            </div>
            <div style="margin-top:20px; display:flex; gap:12px;">
                <button class="btn-primary" onclick="reRun('${run.id}')">Re-Run Agent</button>
                <button class="btn-ghost" onclick="location.href='pipeline.html?id=${run.id}'">View Output</button>
            </div>
        </div>
    `;
}

function closeModal() {
    document.getElementById('detailsModal').classList.add('hidden');
}

function reRun(id) {
    const run = allRuns.find(r => r.id.toString() === id.toString());
    if (run) {
        localStorage.setItem('agentforge_prompt', run.prompt);
        location.href = 'pipeline.html';
    }
}

function exportHistory() {
    const data = JSON.stringify(allRuns, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentforge_history_${Date.now()}.json`;
    a.click();
    AF.showToast("History exported successfully");
}
