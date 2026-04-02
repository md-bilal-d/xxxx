import os
import json
import asyncio
import sys
from fastapi import FastAPI, WebSocket, Request, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

# Ensure we can import from the directory api.py is in
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import run_pipeline
from logger import AgentLogger

app = FastAPI(title="AgentForge API")

# Global queue for WebSocket broadcasting
broadcast_queue = asyncio.Queue()
AgentLogger.event_queue = broadcast_queue

# --- Utilities ---
HISTORY_FILE = os.path.join(os.path.dirname(__file__), "run_history.json")

def get_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

# --- Endpoints ---
@app.get("/api/history")
async def fetch_history():
    return JSONResponse(content=get_history())

@app.get("/api/files")
async def list_output_files():
    output_dir = os.path.join(ROOT_DIR, "agents", "output")
    files_data = []
    if os.path.exists(output_dir):
        for root, dirs, files in os.walk(output_dir):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), output_dir)
                size = os.path.getsize(os.path.join(root, file))
                files_data.append({"path": rel_path, "size": size})
    return JSONResponse(content=files_data)

@app.post("/api/run")
async def trigger_run(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    prompt = data.get("prompt")
    if not prompt:
        return JSONResponse(status_code=400, content={"error": "Prompt missing"})
    
    # Run pipeline in background thread to avoid blocking event loop
    background_tasks.add_task(run_pipeline, prompt)
    return {"status": "started", "prompt": prompt}

@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Wait for data from the global logger queue
            event = await broadcast_queue.get()
            await websocket.send_json(event)
    except Exception as e:
        print(f"WebSocket disconnect: {e}")
    finally:
        await websocket.close()

# --- Static File Serving ---
# Mount the root directory to serve HTML/JS/CSS
# This assumes api.py is inside agents/ folder
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.mount("/", StaticFiles(directory=ROOT_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
