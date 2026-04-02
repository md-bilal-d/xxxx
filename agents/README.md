# 🤖 AgentForge — Multi-Agent Autonomous Coding System

A CLI tool that orchestrates three AI agents (Architect, Coder, Reviewer) to autonomously build Python projects from natural language prompts.

## Architecture

```
User Prompt → Architect (llama3.1) → Human Approval → Coder (qwen2.5-coder) → Reviewer (llama3.1:8b)
                                                              ↑                        ↓
                                                              └──── Error Feedback ─────┘
                                                                   (max 3 retries)
```

## Prerequisites

### 1. Install Ollama

Download and install from [ollama.com](https://ollama.com):

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download installer from https://ollama.com/download
```

### 2. Pull Required Models

```bash
ollama pull llama3.1       # Architect + Reviewer
ollama pull qwen2.5-coder  # Coder
```

### 3. Install Python Dependencies

```bash
cd agents
pip install -r requirements.txt
```

## Usage

### Run the Agent Pipeline

```bash
cd agents
python main.py "Build a FastAPI health check route"
```

The pipeline will:
1. **Architect** generates `system_design.md`
2. **You** review and approve the plan (human-in-the-loop)
3. **Coder** writes all implementation files
4. **Reviewer** runs pytest and validates
5. If tests fail → Coder fixes → Reviewer retests (up to 3 loops)

### View Run History

```bash
python dashboard.py            # Show table of all runs
python dashboard.py --stats    # Show aggregate statistics
python dashboard.py --export   # Export markdown report
```

### Test Prompts

Start with these to verify your setup:

```bash
# Smoke test (simplest)
python main.py "Build a FastAPI app with a single GET route at /health that returns {status: ok}"

# CRUD API (medium complexity)
python main.py "Build a FastAPI REST API for a todo app with CRUD routes"

# Full project (complex)
python main.py "Build a blog platform backend with JWT auth and SQLAlchemy"
```

## Configuration

Set environment variables to customize:

```bash
export OLLAMA_BASE_URL=http://localhost:11434
export MODEL_ARCHITECT=llama3.1
export MODEL_CODER=qwen2.5-coder
export MODEL_REVIEWER=llama3.1:8b
```

## Web Dashboard

Open `index.html` in a browser to access the premium monitoring dashboard with:
- Real-time pipeline visualization
- Run history with filters
- Agent configuration panel
- Mobile monitoring view

## File Structure

```
agents/
├── main.py              # LangGraph orchestrator
├── architect_agent.py   # System design generator
├── coder_agent.py       # Code file writer
├── reviewer_agent.py    # Test runner & validator
├── logger.py            # Run tracking & reporting
├── dashboard.py         # CLI dashboard tool
├── requirements.txt     # Python dependencies
└── README.md            # This file
```
