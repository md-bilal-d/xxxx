"""
AgentLogger — Tracks runs, loops, and status in run_history.json.
Supports export to markdown reports.
"""
import json
import os
from datetime import datetime


HISTORY_FILE = "run_history.json"


class AgentLogger:
    """Tracks multi-agent pipeline runs with per-loop logging."""
    
    # Global queue for broadcasting events to external servers (like FastAPI)
    event_queue = None

    def __init__(self, history_file: str = HISTORY_FILE):
        self.history_file = history_file
        self.history = self._load_history()
        self.current_run = None

    def _load_history(self) -> list:
        if os.path.exists(self.history_file):
            with open(self.history_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def _save_history(self):
        with open(self.history_file, "w", encoding="utf-8") as f:
            json.dump(self.history, f, indent=2, default=str)

    def _next_id(self) -> int:
        if not self.history:
            return 1
        return max(r.get("run_id", 0) for r in self.history) + 1

    def start_run(self, prompt: str) -> int:
        """Start tracking a new run."""
        run_id = self._next_id()
        self.current_run = {
            "run_id": run_id,
            "timestamp": datetime.now().isoformat(),
            "prompt": prompt,
            "loops": [],
            "total_loops": 0,
            "status": "running",
            "error": None,
        }
        print(f"📊 Logger: Started run #{run_id}")
        
        if AgentLogger.event_queue:
            AgentLogger.event_queue.put_nowait({
                "type": "run_start",
                "run_id": run_id,
                "prompt": prompt
            })
            
        return run_id

    def log_loop(self, agent_name: str, loop_number: int, status: str, details: str = ""):
        """Log a single loop iteration."""
        if not self.current_run:
            return
        entry = {
            "agent": agent_name,
            "loop": loop_number,
            "status": status,
            "details": details[:500],
            "timestamp": datetime.now().isoformat(),
        }
        self.current_run["loops"].append(entry)
        self.current_run["total_loops"] = loop_number
        print(f"  📊 Loop {loop_number} [{agent_name}]: {status}")
        
        if AgentLogger.event_queue:
            AgentLogger.event_queue.put_nowait({
                "type": "loop_log",
                "agent": agent_name,
                "loop": loop_number,
                "status": status,
                "details": details[:500]
            })

    def end_run(self, final_status: str, error: str = None):
        """Finalize and save the current run."""
        if not self.current_run:
            return
        self.current_run["status"] = final_status
        self.current_run["error"] = error[:1000] if error else None
        self.history.append(self.current_run)
        self._save_history()
        print(f"📊 Logger: Run #{self.current_run['run_id']} completed — {final_status}")
        self.current_run = None

    def export_report(self, output_file: str = "agent_report.md") -> str:
        """Generate a markdown report of all runs."""
        lines = ["# Agent Pipeline Report", ""]
        lines.append(f"Generated: {datetime.now().isoformat()}")
        lines.append(f"Total Runs: {len(self.history)}")
        passed = sum(1 for r in self.history if r["status"] == "passed")
        failed = sum(1 for r in self.history if r["status"] == "failed")
        rate = (passed / len(self.history) * 100) if self.history else 0
        lines.append(f"Pass Rate: {rate:.1f}%")
        lines.append("")

        # Summary Table
        lines.append("## Summary Table")
        lines.append("")
        lines.append("| Run | Prompt | Status | Loops | Timestamp |")
        lines.append("|-----|--------|--------|-------|-----------|")
        for r in self.history:
            prompt_short = r["prompt"][:40] + ("..." if len(r["prompt"]) > 40 else "")
            lines.append(f"| #{r['run_id']} | {prompt_short} | {r['status']} | {r['total_loops']} | {r['timestamp'][:19]} |")
        lines.append("")

        # Failed Runs Details
        failed_runs = [r for r in self.history if r["status"] == "failed"]
        if failed_runs:
            lines.append("## Failed Runs")
            lines.append("")
            for r in failed_runs:
                lines.append(f"### Run #{r['run_id']}: {r['prompt'][:60]}")
                lines.append("")
                if r.get("error"):
                    lines.append("```")
                    lines.append(r["error"])
                    lines.append("```")
                lines.append("")

        # Agent Failure Analysis
        agent_failures = {}
        for r in self.history:
            for loop in r.get("loops", []):
                if loop["status"] == "failed":
                    agent = loop["agent"]
                    agent_failures[agent] = agent_failures.get(agent, 0) + 1
        if agent_failures:
            lines.append("## Agent Failure Analysis")
            lines.append("")
            worst = max(agent_failures, key=agent_failures.get)
            lines.append(f"Most failures caused by: **{worst}** ({agent_failures[worst]} failures)")
            lines.append("")
            for agent, count in sorted(agent_failures.items(), key=lambda x: -x[1]):
                lines.append(f"- {agent}: {count} failure(s)")

        report = "\n".join(lines)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"📄 Report exported to {output_file}")
        return report
