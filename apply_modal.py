import os

HTML_MODAL = """
  <!-- API Key Modal -->
  <style>
    .api-modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 0.3s;
    }
    .api-modal-overlay.active { opacity: 1; pointer-events: auto; }
    .api-modal {
      background: var(--bg-card, #111120); border: 1px solid var(--border-card, #1e1e35);
      border-radius: 16px; padding: 32px; width: 100%; max-width: 400px;
      text-align: center; transform: translateY(20px); transition: transform 0.3s;
    }
    .api-modal-overlay.active .api-modal { transform: translateY(0); }
    .api-modal h2 { margin-bottom: 8px; font-size: 20px; color: white; display:flex; align-items:center; justify-content:center; gap:10px; }
    .api-modal input {
      width: 100%; background: #0d0d1a; border: 1px solid #2a2a45;
      color: white; padding: 12px; border-radius: 8px; margin: 16px 0;
      outline: none; text-align: center; font-family: monospace;
    }
    .api-modal input:focus { border-color: #7c3aed; }
    .api-modal button {
      width: 100%; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white;
      border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer;
    }
    .api-modal a { display: block; margin-top: 16px; color: #6b7280; font-size: 12px; text-decoration: none; }
    .api-modal a:hover { color: #fff; }
    .api-key-btn { position: fixed; top: 20px; right: 20px; background: #111120; border: 1px solid #1e1e35; color: white; padding: 10px; border-radius: 8px; cursor: pointer; z-index: 1000; display:flex; align-items:center; justify-content:center; font-weight:bold; transition: background 0.2s;}
    .api-key-btn:hover { background: #1e1e35; }
  </style>

  <button class="api-key-btn" onclick="openApiModal()" aria-label="API Key">🔑 API Key</button>

  <div id="apiKeyModal" class="api-modal-overlay">
    <div class="api-modal">
      <h2><span style="color:#7c3aed;">⬡</span> AgentForge Auth</h2>
      <p style="color:#6b7280; font-size:14px;">Enter your Anthropic API key to continue</p>
      <input type="password" id="apiKeyValue" placeholder="sk-ant-api03-...">
      <button onclick="saveApiKey()">Save & Continue</button>
      <a href="https://console.anthropic.com/" target="_blank">Get your API key at console.anthropic.com</a>
    </div>
  </div>

  <script>
    function openApiModal() {
      const stored = localStorage.getItem("anthropic_key");
      if(stored) document.getElementById("apiKeyValue").value = stored;
      document.getElementById("apiKeyModal").classList.add("active");
    }
    function closeApiModal() {
      document.getElementById("apiKeyModal").classList.remove("active");
    }
    function saveApiKey() {
      const val = document.getElementById("apiKeyValue").value.trim();
      if(val) {
        localStorage.setItem("anthropic_key", val);
        closeApiModal();
      }
    }
    window.addEventListener("DOMContentLoaded", () => {
      if(!localStorage.getItem("anthropic_key")) {
        openApiModal();
      }
    });
  </script>
"""

JS_TEST_API = """
      if (!localStorage.getItem("anthropic_key")) {
        openApiModal();
        return;
      }
      try {
        const apiKey = localStorage.getItem("anthropic_key");
        const testRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerously-allow-browser": "true"
          },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{role: "user", content: "hi"}] })
        });
        if (testRes.status === 401 || testRes.status === 403) {
          if (typeof window.AF !== "undefined" && window.AF.showToast) window.AF.showToast("Invalid API key \\u2014 please check and re-enter");
          else alert("Invalid API key \\u2014 please check and re-enter");
          localStorage.removeItem("anthropic_key");
          openApiModal();
          return;
        }
      } catch (e) {
          console.error("API test skipped or failed", e);
      }
"""

for fn in ["index.html", "history.html", "pipeline.html", "mobile.html", "config.html"]:
    if not os.path.exists(fn): continue
    with open(fn, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "api-modal-overlay" not in content:
        content = content.replace("</body>", HTML_MODAL + "\\n</body>")
    
    if fn == "pipeline.html":
        if "testRes.status === 401" not in content:
            repl_target = "async function initPipeline() {"
            content = content.replace(repl_target, repl_target + "\\n" + JS_TEST_API)
            
    with open(fn, "w", encoding="utf-8") as f:
        f.write(content)

print("Modal UI and key validation injected.")
