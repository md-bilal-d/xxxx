/**
 * AgentForge — Live Dashboard Interactivity
 */

document.addEventListener('DOMContentLoaded', () => {
    initTimer();
    initTabs();
    initLogs();
});

// --- Stopwatch Timer ---
function initTimer() {
    const timerEl = document.getElementById('stopwatch');
    let seconds = 12; // Start from 00:12 as per request

    setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

// --- Tab Switching ---
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = {
        files: document.getElementById('filesTab'),
        logs: document.getElementById('logsTab'),
        summary: document.getElementById('summaryTab')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all
            tabs.forEach(t => t.classList.remove('active'));
            Object.values(contents).forEach(c => c.classList.add('hidden'));

            // Activate current
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            contents[target].classList.remove('hidden');
        });
    });
}

// --- File Toggle ---
function toggleFile(row) {
    const codeBlock = row.nextElementSibling;
    const arrow = row.querySelector('.f-arrow');
    
    if (codeBlock.classList.contains('hidden')) {
        codeBlock.classList.remove('hidden');
        row.classList.add('expanded');
        arrow.style.transform = 'rotate(90deg)';
    } else {
        codeBlock.classList.add('hidden');
        row.classList.remove('expanded');
        arrow.style.transform = 'rotate(0deg)';
    }
}

// --- Simulated Logs ---
function initLogs() {
    const logContainer = document.getElementById('logContainer');
    const rawLogs = [
        { time: '12:35:01', tag: 'ARCH', type: 'tag-arch', msg: 'System design generated: health_api structure' },
        { time: '12:35:04', tag: 'ARCH', type: 'tag-arch', msg: 'File tree mapping complete: 3 files identified' },
        { time: '12:35:07', tag: 'CODER', type: 'tag-coder', msg: 'Writing main.py: FastAPI initialization' },
        { time: '12:35:12', tag: 'CODER', type: 'tag-coder', msg: 'Implementing /health route decorator' },
        { time: '12:35:15', tag: 'CODER', type: 'tag-coder', msg: 'Complexity check: O(1) performance confirmed' },
        { time: '12:35:20', tag: 'REV', type: 'tag-rev', msg: 'Running pytest suite on health_api' },
        { time: '12:35:24', tag: 'REV', type: 'tag-rev', msg: 'Test 1 Passed: test_main.py' },
        { time: '12:35:25', tag: 'REV', type: 'tag-rev', msg: 'Test 2 Passed: test_health.py' },
        { time: '12:35:26', tag: 'REV', type: 'tag-rev', msg: 'Verification complete: Status LGTM' }
    ];

    rawLogs.forEach((log, index) => {
        setTimeout(() => {
            const row = document.createElement('div');
            row.className = 'log-row';
            row.style.animationDelay = `${index * 0.1}s`;
            row.innerHTML = `
                <span class="log-time mono">${log.time}</span>
                <span class="log-tag mono ${log.type}">${log.tag}</span>
                <span class="log-msg">${log.msg}</span>
            `;
            logContainer.appendChild(row);
        }, index * 200);
    });
}
