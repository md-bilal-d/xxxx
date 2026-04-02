"""
CLI Dashboard — View run history, stats, and export reports.

Usage:
    python dashboard.py            # Show run history table
    python dashboard.py --stats    # Show aggregate statistics
    python dashboard.py --export   # Export markdown report
"""
import json
import os
import sys
from datetime import datetime

from logger import AgentLogger


HISTORY_FILE = "run_history.json"


def load_history() -> list:
    """Load run history from JSON file."""
    if not os.path.exists(HISTORY_FILE):
        print("⚠ No run history found. Run main.py first.")
        return []
    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def print_table(history: list):
    """Print a formatted summary table."""
    if not history:
        print("No runs recorded yet.")
        return

    # Header
    print()
    print(f"{'─' * 90}")
    print(f"  {'ID':>4}  {'Prompt':<40}  {'Status':<10}  {'Loops':>5}  {'Timestamp':<20}")
    print(f"{'─' * 90}")

    for run in history:
        run_id = f"#{run['run_id']}"
        prompt = run["prompt"][:38] + (".." if len(run["prompt"]) > 38 else "")
        status = run["status"].upper()
        loops = str(run.get("total_loops", 0))
        ts = run["timestamp"][:19].replace("T", " ")

        # Color coding via ANSI
        if run["status"] == "passed":
            status_colored = f"\033[92m{status}\033[0m"
        elif run["status"] == "failed":
            status_colored = f"\033[91m{status}\033[0m"
        elif run["status"] == "aborted":
            status_colored = f"\033[93m{status}\033[0m"
        else:
            status_colored = status

        print(f"  {run_id:>4}  {prompt:<40}  {status_colored:<19}  {loops:>5}  {ts:<20}")

    print(f"{'─' * 90}")
    print(f"  Total: {len(history)} runs")
    print()


def print_stats(history: list):
    """Print aggregate statistics."""
    if not history:
        print("No runs to analyze.")
        return

    total = len(history)
    passed = sum(1 for r in history if r["status"] == "passed")
    failed = sum(1 for r in history if r["status"] == "failed")
    aborted = sum(1 for r in history if r["status"] == "aborted")

    pass_rate = (passed / total * 100) if total > 0 else 0
    total_loops = sum(r.get("total_loops", 0) for r in history)
    avg_loops = total_loops / total if total > 0 else 0

    # Most common failure reason
    failure_reasons = {}
    for r in history:
        if r["status"] == "failed" and r.get("error"):
            # Extract first line of error
            reason = r["error"].split("\n")[0][:60]
            failure_reasons[reason] = failure_reasons.get(reason, 0) + 1

    top_failure = max(failure_reasons, key=failure_reasons.get) if failure_reasons else "N/A"

    print()
    print(f"{'═' * 50}")
    print(f"  📊 AGENT PIPELINE STATISTICS")
    print(f"{'═' * 50}")
    print(f"  Total Runs:          {total}")
    print(f"  ✅ Passed:            {passed}")
    print(f"  ❌ Failed:            {failed}")
    print(f"  ⏸  Aborted:           {aborted}")
    print(f"{'─' * 50}")
    print(f"  Pass Rate:           {pass_rate:.1f}%")
    print(f"  Avg Loops/Run:       {avg_loops:.1f}")
    print(f"  Total Loop Cycles:   {total_loops}")
    print(f"{'─' * 50}")
    print(f"  Top Failure Reason:  {top_failure}")
    print(f"{'═' * 50}")
    print()


def main():
    """CLI entry point."""
    history = load_history()

    if "--stats" in sys.argv:
        print_stats(history)
    elif "--export" in sys.argv:
        logger = AgentLogger(HISTORY_FILE)
        logger.export_report()
        print("✅ Report exported to agent_report.md")
    else:
        print_table(history)


if __name__ == "__main__":
    main()
