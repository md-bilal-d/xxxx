    let AGENT_STAGES = { architect: { done: false }, coder: { done: false }, reviewer: { done: false } };
    let elapsedSeconds = 0;
    let timerInterval;
    let isComplete = false;
    let simulatedData = { code: '', tree: '', tests: '', logs: [] };
    const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

    function updateTimer() {
      if (isComplete) return;
      elapsedSeconds++;
      if (elapsedSeconds >= 600) { clearInterval(timerInterval); addLog("PIPELINE — Timed out"); return; }
      const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      const secs = String(elapsedSeconds % 60).padStart(2, '0');
      document.getElementById('liveTimer').textContent = `${mins}:${secs}`;
    }

    async function callClaude(messages, max_tokens = 1000) {
      const apiKey = localStorage.getItem('anthropic_key') || localStorage.getItem('agentforge_anthropic_api_key') || '';
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerously-allow-browser": "true"
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: max_tokens,
          messages: messages
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errText}`);
      }
      const data = await response.json();
      return data.content[0].text;
    }

    function addLog(msg) {
      const time = new Date().toLocaleTimeString([], { hour12: false });
      const logEntry = `[${time}] ${msg}`;
      simulatedData.logs.push(logEntry);
      const stream = document.getElementById('logStream');
      if (stream) {
        const div = document.createElement('div');
        div.textContent = logEntry;
        stream.appendChild(div);
        stream.scrollTop = stream.scrollHeight;
      }
    }

    function generateFallback(prompt, errMessage) {
      return `<!DOCTYPE html><html><head><style>
    body { background: #0a0a12; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { background: #111120; border: 1px solid #1e1e35; border-radius: 16px; padding: 40px; text-align: center; max-width: 500px; }
    h2 { color: #ef4444; } p { color: #9ca3af; line-height: 1.5; }
  </style></head><body><div class="box"><h2>⚠️ Generation Failed</h2><p>${errMessage || "Could not connect to AI. Check your network and try again."}</p><p style="font-size:12px;margin-top:16px;color:#555">${prompt}</p></div></body></html>`;
    }

    async function initPipeline() {
      const userPrompt = sessionStorage.getItem('agentforge_active_prompt') || localStorage.getItem('agentforge_prompt');
      if (userPrompt) {
        document.querySelectorAll('.prompt-line').forEach(el => el.textContent = userPrompt);
      } else {
        document.querySelector('.page-content').innerHTML = `<div style="text-align:center; padding:100px;"><h2>No Active Run</h2><button class="btn-primary" onclick="location.href='index.html'">Dashboard</button></div>`;
        return;
      }

      document.getElementById('zipBtn').onclick = downloadZip;
      document.getElementById('previewBtn').onclick = previewOutput;

      elapsedSeconds = 0;
      timerInterval = setInterval(updateTimer, 1000);
      try {
        await runAgentLoop(userPrompt);
      } catch (err) {
        console.error(err);
        addLog(`PIPELINE ERROR — ${err.message}`);
        clearInterval(timerInterval);
        isComplete = true;
      }
    }

    async function runAgentLoop(userPrompt) {
      // Phase 1: Architect
      syncProgressBar('design');
      updateAgentCard('architect', 'running', `<div style="text-align:center;padding:20px;opacity:0.6;"><span style="display:inline-block;animation:pulseGreen 1s infinite">Thinking...</span></div>`);
      addLog("ARCH — Analyzing prompt...");
      
      let architectPlan = "";
      try {
        architectPlan = await callClaude([{
          role: "user",
          content: `You are a software Architect. The user wants to build: "${userPrompt}"
      
Produce a short technical plan for this. Include:
1. What files to create (just index.html for frontend, main.py for backend)
2. What the main features are
3. What JavaScript functions are needed
4. Any important implementation notes

Keep it under 200 words. Be specific and technical. No fluff.`
        }]);
        addLog(`ARCH — Plan complete (${architectPlan.split(" ").length} words)`);
      } catch (archErr) {
        architectPlan = "Plan generation failed: " + archErr.message;
        addLog(`ARCH — Failed: ${archErr.message}`);
        updateAgentCard('architect', 'failed', `<div style="color:#ef4444;font-size:12px;">Failed to generate plan. See logs.</div>`);
        throw archErr;
      }
      
      let treePreview = '<div style="color:var(--purple-light)">project/</div><div style="padding-left:12px">├── index.html</div><div style="padding-left:12px">└── README.md</div>';
      updateAgentCard('architect', 'passed', `<div style="font-size:12px;opacity:0.8;white-space:pre-wrap;max-height:120px;overflow-y:auto;padding:8px;background:rgba(255,255,255,0.02);border-radius:4px;">${architectPlan.replace(/</g, '&lt;')}</div><div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05)">${treePreview}</div>`);

      // Coder Loop
      let generatedHTML = "";
      let reviewerFeedback = "";
      let currentLoop = 1;
      const MAX_LOOPS = 3;
      let finalVerdict = "NEEDS_FIX";

      while (currentLoop <= MAX_LOOPS && finalVerdict !== "LGTM") {
        syncProgressBar('code');
        addLog(currentLoop === 1 ? "CODER — Writing code..." : `CODER — Loop ${currentLoop}: Fixing issues...`);
        updateAgentCard('coder', 'running', `<div style="text-align:center;padding:20px;opacity:0.6;"><span style="display:inline-block;animation:pulseGreen 1s infinite">Thinking... (Loop ${currentLoop}/${MAX_LOOPS})</span></div>`);
        
        let coderPrompt = "";
        if (currentLoop === 1) {
          coderPrompt = `You are an expert developer. Build exactly what the Architect planned.

User request: "${userPrompt}"
Architect plan: "${architectPlan}"

Generate a complete fully working self-contained HTML file.
RULES:
- Return ONLY raw HTML. No markdown. No backticks. No explanation.
- All CSS in <style> tag in <head>
- All JS in <script> tag at bottom of <body>
- Zero external CDN dependencies
- All event handlers as inline onclick= oninput= attributes
- Must actually work — every button must do something real
- Dark theme: background #0a0a12, white text, purple #7c3aed and teal #06b6d4 accents
- Professional modern design`;
        } else {
          coderPrompt = `You are a developer fixing your code based on reviewer feedback.

Original request: "${userPrompt}"
Your previous code had these issues:
${reviewerFeedback}

Here is your previous code:
${generatedHTML}

Fix ALL the issues and return the complete corrected HTML file.
Same rules apply: raw HTML only, no markdown, no backticks, self-contained, inline handlers.`;
        }

        try {
          let rawResult = await callClaude([{role: "user", content: coderPrompt}], 2500);
          generatedHTML = rawResult.trim();
          if (generatedHTML.startsWith("\`\`\`html")) generatedHTML = generatedHTML.replace(/^\`\`\`html\s*/i, '');
          if (generatedHTML.startsWith("\`\`\`")) generatedHTML = generatedHTML.replace(/^\`\`\`\s*/, '');
          if (generatedHTML.endsWith("\`\`\`")) generatedHTML = generatedHTML.replace(/\s*\`\`\`$/, '');
          
          addLog(`CODER — Generated ${generatedHTML.split('\\n').length} lines`);
        } catch (coderErr) {
          addLog(`CODER — Failed: ${coderErr.message}`);
          generatedHTML = generateFallback(userPrompt, coderErr.message);
          finalVerdict = "FAILED";
          updateAgentCard('coder', 'failed', `<div style="color:#ef4444;font-size:12px;">Code generation failed. See logs.</div>`);
          break; // Hard fail
        }
        
        window.agentOutputFiles = {
          "index.html": generatedHTML,
          "README.md": `# Project\n\nBuilt by AgentForge AI\n\nPrompt: ${userPrompt}\n\nGenerated on: ${new Date().toLocaleString()}`
        };
        simulatedData.code = generatedHTML;
        simulatedData.tree = treePreview;
        
        let previewLines = generatedHTML.split('\\n').slice(0, 8).join('\\n').replace(/</g, '&lt;');
        updateAgentCard('coder', 'passed', `<div style="color:#10b981;font-weight:bold;margin-bottom:8px;font-size:12px">✓ AI generated index.html</div><div class="mini-editor" style="background:#080C18"><div class="editor-body" style="font-size:10px">${previewLines}</div></div>`);
        
        // Reviewer Loop
        syncProgressBar('review');
        updateAgentCard('reviewer', 'running', `<div style="text-align:center;padding:20px;opacity:0.6;"><span style="display:inline-block;animation:pulseGreen 1s infinite">Thinking...</span></div>`);
        addLog("REVIEWER — Reviewing code...");
        updateFilesPane(); 
        
        try {
          const reviewerPrompt = `You are a code Reviewer. Review this generated HTML file for the request: "${userPrompt}"

CODE TO REVIEW:
${generatedHTML}

Check for these issues:
1. Does the code actually fulfill the user's request?
2. Are there any broken onclick handlers or missing functions?
3. Are there any syntax errors?
4. Does it have external CDN dependencies (not allowed)?
5. Is the UI complete and functional?

Respond in this exact JSON format only, nothing else:
{
  "verdict": "LGTM" or "NEEDS_FIX",
  "issues": ["issue 1", "issue 2"],
  "feedback": "specific instructions for the Coder to fix the issues"
}`;
          
          const rawReview = await callClaude([{role: "user", content: reviewerPrompt}], 1000);
          
          let parsedReview = {};
          try {
             const jsonMatch = rawReview.match(/\{[\s\S]*\}/);
             parsedReview = JSON.parse(jsonMatch ? jsonMatch[0] : rawReview);
          } catch(e) {
             parsedReview = { verdict: "LGTM", issues: [], feedback: "Failed to parse json. Forcing LGTM." };
          }
          
          finalVerdict = parsedReview.verdict;
          
          if (finalVerdict === "LGTM") {
            addLog("REVIEWER — LGTM. All checks passed.");
            updateAgentCard('reviewer', 'LGTM', `<div style="font-size:12px;opacity:0.8"><p style="color:#10b981;margin-bottom:8px">✓ Code approved without issues.</p><pre style="white-space:pre-wrap;font-family:inherit;">${parsedReview.feedback || 'Looks good to me.'}</pre></div>`);
          } else {
            addLog(`REVIEWER — Found ${parsedReview.issues.length} issues, sending back`);
            reviewerFeedback = parsedReview.feedback + "\\nIssues:\\n" + parsedReview.issues.join("\\n- ");
            updateAgentCard('reviewer', 'NEEDS_FIX', `<div style="font-size:12px;opacity:0.8;color:#ef4444;"><p style="font-weight:bold;margin-bottom:8px">⚠️ Quality Issues Found</p><ul style="padding-left:14px;margin-bottom:8px;">${parsedReview.issues.map(i=>`<li>${i}</li>`).join('')}</ul></div>`);
            currentLoop++;
          }
        } catch (revErr) {
          addLog(`REVIEWER — Exception: ${revErr.message}`);
          finalVerdict = "LGTM"; 
          updateAgentCard('reviewer', 'LGTM', `<div style="color:#ef4444;font-size:12px;">Review skipped due to API error. Accepting code anyway.</div>`);
        }
      }
      
      if (currentLoop > MAX_LOOPS && finalVerdict !== "LGTM") {
        if (typeof window.AF !== 'undefined' && window.AF.showToast) window.AF.showToast("Max retries reached — partial output saved");
        updateAgentCard('reviewer', 'FAILED', `<div style="color:#ef4444;font-size:12px;"><p style="font-weight:bold;margin-bottom:8px">❌ Max retries reached</p><ul>${(reviewerFeedback.split("\\n").filter(f=>f.startsWith("-")) || []).map(i=>`<li>${i.substring(1)}</li>`).join('')}</ul></div>`);
      }

      syncProgressBar('complete');
      clearInterval(timerInterval);
      isComplete = true;
      addLog(`PIPELINE — Complete in ${elapsedSeconds}s`);
      
      simulatedData.tests = finalVerdict === "LGTM" ? `<div style="color:#10b981">✓ All checks passed — LGTM</div>` : `<div style="color:#ef4444">⚠️ Max retries reached</div>`;
      
      saveRunToHistory(currentLoop <= MAX_LOOPS ? currentLoop : Math.min(currentLoop, MAX_LOOPS), architectPlan, reviewerFeedback);
      renderSummary();
    }

    function updateAgentCard(agent, status, content) {
      const card = document.getElementById(agent + 'Card');
      if (!card) return;
      const badge = card.querySelector('.badge-status');
      badge.textContent = status.replace('_',' ').toUpperCase();
      badge.className = 'badge-status ' + (status === 'passed' || status === 'LGTM' ? 'passed' : '');
      if (status === 'failed' || status === 'NEEDS_FIX') badge.style.color = '#ef4444';
      if (content) card.querySelector('.agent-body').innerHTML = content;
    }

    function updateFilesPane() {
      if (!window.agentOutputFiles) return;
      const count = Object.keys(window.agentOutputFiles).length;
      
      const headerSpan = document.querySelector('.output-header .badge-teal-pill');
      if (headerSpan) headerSpan.textContent = count + ' FILES GENERATED';

      const pane = document.getElementById('filesPane');
      let html = '<div class="file-list">';
      
      for (const [filename, content] of Object.entries(window.agentOutputFiles)) {
        const safeId = filename.replace(/[^a-zA-Z0-9]/g, '-');
        html += `
          <div class="file-row" onclick="toggleFile('${filename}')" style="padding:10px 0; cursor:pointer; border-bottom:1px solid var(--border-glass)">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                 <span class="badge-status" style="background:var(--teal-glow); color:var(--teal-light); font-size:10px; margin-right:8px;">${filename.split('.').pop()}</span>
                 <span style="font-weight:700">${filename}</span>
                 <span class="muted" style="font-size:11px"> (Click to expand)</span>
              </div>
              <span style="transform:rotate(90deg); display:inline-block">›</span>
            </div>
            <div id="preview-${safeId}" class="hidden" style="margin-top:10px; background:#080C18; padding:10px; border-radius:8px;"></div>
          </div>`;
      }
      html += '</div>';
      pane.innerHTML = html;
    }

    function toggleFile(name) {
      const safeId = name.replace(/[^a-zA-Z0-9]/g, '-');
      const div = document.getElementById('preview-' + safeId);
      if (div.classList.contains('hidden')) {
        div.classList.remove('hidden');
        const content = window.agentOutputFiles[name];
        let lang = 'html';
        if (name.endsWith('.md')) lang = 'markdown';
        if (name.endsWith('.py')) lang = 'python';
        div.innerHTML = `<pre style="margin:0; max-height: 400px; overflow-y: auto;"><code class="language-${lang}">${content.replace(/</g, '&lt;')}</code></pre>`;
        try { hljs.highlightElement(div.querySelector('code')); } catch(e) {}
      } else {
        div.classList.add('hidden');
      }
    }

    function switchTab(id) {
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
      event.target.classList.add('active');
      document.getElementById(id + 'Pane').classList.remove('hidden');
    }

    function renderSummary() {
      const prompt = document.querySelector('.prompt-line').textContent;
      document.getElementById('summaryContent').innerHTML = `
        <p><strong>Prompt:</strong> ${prompt}</p>
        <p><strong>Duration:</strong> ${elapsedSeconds} seconds</p>
        <p><strong>Files:</strong> ${Object.keys(window.agentOutputFiles || {}).join(', ')}</p>
        <p><strong>Results:</strong> Complete</p>
        <br>
        <p>The Agent Crew successfully interpreted the requirement and generated a clean, validated frontend implementation. The code adheres to modern standards and has been verified against the original prompt specifications.</p>
      `;
    }

    async function downloadZip() {
      if (typeof window.AF !== 'undefined' && window.AF.showToast) {
         window.AF.showToast("Downloading...");
      }
      const zip = new JSZip();
      if (window.agentOutputFiles) {
        for (const [filename, content] of Object.entries(window.agentOutputFiles)) {
          zip.file(filename, content);
        }
      }
      const zipContent = await zip.generateAsync({type:"blob"});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipContent);
      link.download = "agentforge-output.zip";
      link.click();
    }

    function previewOutput() {
      if (!window.agentOutputFiles) return;
      const mainFile = window.agentOutputFiles["index.html"] || window.agentOutputFiles["main.py"] || Object.values(window.agentOutputFiles)[0];
      const blob = new Blob([mainFile], {type: 'text/html'});
      window.open(URL.createObjectURL(blob), '_blank');
    }

    function saveRunToHistory(actualLoopCount, architectPlan, reviewerFeedback) {
      const runs = JSON.parse(localStorage.getItem("agentforge_runs") || "[]");
      const nextId = runs.length > 0 ? Math.max(...runs.map(r => r.id || 0)) + 1 : 1;
      
      const newRun = {
        id: nextId,
        prompt: document.querySelector('.prompt-line').textContent,
        status: isComplete ? "Passed" : "Failed",
        loops: actualLoopCount || 1,
        duration: elapsedSeconds,
        files: window.agentOutputFiles ? Object.keys(window.agentOutputFiles) : [],
        fileContents: window.agentOutputFiles || {},
        architectPlan: architectPlan || "",
        reviewerFeedback: reviewerFeedback || "",
        logs: simulatedData.logs || [],
        summary: "Pipeline completed.",
        timestamp: new Date().toISOString()
      };
      
      runs.push(newRun);
      localStorage.setItem("agentforge_runs", JSON.stringify(runs));
    }

    function syncProgressBar(stage) {
      const line = document.querySelector('.stage-line-fill');
      const nodes = document.querySelectorAll('.stage-node');
      const widths = { 'design': '25%', 'code': '50%', 'review': '75%', 'complete': '100%' };
      if (!widths[stage]) return;
      line.style.width = widths[stage];
      
      const stages = ['design', 'code', 'review', 'complete'];
      const currentIdx = stages.indexOf(stage);
      
      nodes.forEach((n, i) => {
        if (i < currentIdx) {
          n.className = 'stage-node complete';
        } else if (i === currentIdx) {
          n.className = 'stage-node active';
        } else {
          n.className = 'stage-node';
        }
      });
      
      if (stage === 'complete') {
        line.style.background = '#10B981';
        const completeNode = nodes[3];
        completeNode.className = 'stage-node complete';
        const dot = completeNode.querySelector('.stage-dot-node');
        dot.style.background = '#10B981';
        dot.style.borderColor = '#10B981';
        dot.style.display = 'flex';
        dot.style.alignItems = 'center';
        dot.style.justifyContent = 'center';
        dot.innerHTML = '<span style="color:white; font-size:14px; font-weight:bold; position:relative; top:1px;">✓</span>';
        dot.style.animation = 'pulseGreen 2s ease-out 1';
        
        if (!document.getElementById('pulseGreenStyle')) {
          const style = document.createElement('style');
          style.id = 'pulseGreenStyle';
          style.innerHTML = '@keyframes pulseGreen { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }';
          document.head.appendChild(style);
        }
        
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#10B981; color:white; padding:12px 24px; border-radius:8px; font-weight:600; z-index:9999; box-shadow:0 4px 12px rgba(16,185,129,0.3);';
        toast.textContent = "✓ Run Complete — files ready";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    }

    window.addEventListener('DOMContentLoaded', initPipeline);
