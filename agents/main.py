"""
Main Orchestrator — LangGraph pipeline connecting Architect, Coder, and Reviewer.
Includes human-in-the-loop checkpoint and retry loop (max 3).
"""
import sys
import os
from typing import TypedDict, Annotated

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command, interrupt

from architect_agent import run_architect
from coder_agent import run_coder
from reviewer_agent import run_reviewer
from logger import AgentLogger


# --- State Schema ---
class PipelineState(TypedDict):
    prompt: str
    design: str
    code_files: list[str]
    review_result: str
    error_feedback: str
    loop_count: int
    max_loops: int
    final_status: str
    output_dir: str


# --- Node Functions ---
def architect_node(state: PipelineState) -> dict:
    """Run the Architect agent to generate system design."""
    output_dir = state.get("output_dir", "./output")
    os.makedirs(output_dir, exist_ok=True)
    design = run_architect(state["prompt"], output_dir)
    return {"design": design}


def human_review_node(state: PipelineState) -> dict:
    """Human-in-the-loop checkpoint: show plan and ask for approval."""
    print("\n" + "=" * 60)
    print("📋 ARCHITECT'S PLAN:")
    print("=" * 60)
    print(state["design"][:2000])
    if len(state["design"]) > 2000:
        print(f"\n... ({len(state['design']) - 2000} more characters)")
    print("=" * 60)

    # Use LangGraph interrupt for human-in-the-loop
    response = interrupt(
        "Review the plan above. Type 'yes' to proceed or 'no' to abort: "
    )

    if response and str(response).lower().strip() not in ("yes", "y", "approve"):
        return {"final_status": "aborted"}

    return {}


def coder_node(state: PipelineState) -> dict:
    """Run the Coder agent to generate implementation files."""
    output_dir = state.get("output_dir", "./output")
    error_feedback = state.get("error_feedback")
    code_files = run_coder(state["design"], output_dir, error_feedback)
    return {"code_files": code_files}


def reviewer_node(state: PipelineState) -> dict:
    """Run the Reviewer agent to test the generated code."""
    output_dir = state.get("output_dir", "./output")
    code_files = state.get("code_files", [])
    loop_count = state.get("loop_count", 0) + 1

    result = run_reviewer(output_dir, code_files)

    if result == "LGTM":
        return {
            "review_result": result,
            "loop_count": loop_count,
            "final_status": "passed",
        }
    else:
        return {
            "review_result": result,
            "error_feedback": result,
            "loop_count": loop_count,
        }


# --- Routing Logic ---
def should_retry(state: PipelineState) -> str:
    """Decide whether to retry or finish."""
    if state.get("final_status") == "passed":
        return "done"
    if state.get("final_status") == "aborted":
        return "done"

    loop_count = state.get("loop_count", 0)
    max_loops = state.get("max_loops", 3)

    if loop_count >= max_loops:
        print(f"\n❌ Max retries ({max_loops}) reached. Last error:")
        print(state.get("error_feedback", "Unknown error")[:500])
        return "done"

    print(f"\n🔄 Retry loop {loop_count}/{max_loops} — sending errors back to Coder")
    return "retry"


def finalize_node(state: PipelineState) -> dict:
    """Set final status if not already set."""
    if not state.get("final_status"):
        return {"final_status": "failed"}
    return {}


# --- Build Graph ---
def build_pipeline() -> StateGraph:
    """Construct the LangGraph pipeline."""
    builder = StateGraph(PipelineState)

    # Add nodes
    builder.add_node("architect", architect_node)
    builder.add_node("human_review", human_review_node)
    builder.add_node("coder", coder_node)
    builder.add_node("reviewer", reviewer_node)
    builder.add_node("finalize", finalize_node)

    # Define edges
    builder.add_edge(START, "architect")
    builder.add_edge("architect", "human_review")

    # After human review, check if aborted
    builder.add_conditional_edges(
        "human_review",
        lambda s: "done" if s.get("final_status") == "aborted" else "proceed",
        {"done": "finalize", "proceed": "coder"},
    )

    builder.add_edge("coder", "reviewer")

    # After reviewer, decide: retry or finish
    builder.add_conditional_edges(
        "reviewer",
        should_retry,
        {"retry": "coder", "done": "finalize"},
    )

    builder.add_edge("finalize", END)

    return builder


def run_pipeline(prompt: str, max_loops: int = 3, output_dir: str = "./output"):
    """
    Execute the full multi-agent pipeline.

    Args:
        prompt: User's project description
        max_loops: Maximum retry cycles
        output_dir: Directory for generated files
    """
    # Initialize logger
    logger = AgentLogger()
    run_id = logger.start_run(prompt)

    # Build and compile graph
    builder = build_pipeline()
    checkpointer = MemorySaver()
    graph = builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_review"],
    )

    # Initial state
    initial_state = {
        "prompt": prompt,
        "design": "",
        "code_files": [],
        "review_result": "",
        "error_feedback": "",
        "loop_count": 0,
        "max_loops": max_loops,
        "final_status": "",
        "output_dir": output_dir,
    }

    config = {"configurable": {"thread_id": f"run-{run_id}"}}

    print("\n🚀 Starting Agent Pipeline")
    print(f"📝 Prompt: {prompt}")
    print(f"🔄 Max loops: {max_loops}")
    print(f"📁 Output: {output_dir}")
    print("=" * 60)

    # First run (will pause at human_review)
    result = graph.invoke(initial_state, config=config)

    # Check if we hit the interrupt
    state = graph.get_state(config)
    if state.next and "human_review" in state.next:
        # Human-in-the-loop checkpoint
        print("\n" + "=" * 60)
        print("📋 ARCHITECT'S PLAN (from state):")
        print("=" * 60)
        current = state.values
        if current.get("design"):
            print(current["design"][:2000])
        print("=" * 60)

        if os.getenv("AUTO_APPROVE") == "true":
            print("\n🤖 AUTO_APPROVE enabled. Proceeding...")
            result = graph.invoke(Command(resume="yes"), config=config)
        else:
            approval = input("\n✋ Approve this plan? (yes/no): ").strip().lower()

            if approval in ("yes", "y"):
                # Resume the graph
                result = graph.invoke(Command(resume="yes"), config=config)
            else:
                print("❌ Plan rejected. Aborting.")
                logger.log_loop("architect", 0, "aborted", "User rejected plan")
                logger.end_run("aborted")
                return

    # Log final result
    final = graph.get_state(config).values
    final_status = final.get("final_status", "unknown")
    loop_count = final.get("loop_count", 0)

    logger.log_loop("reviewer", loop_count, final_status,
                    final.get("error_feedback", "")[:500])
    logger.end_run(
        final_status,
        error=final.get("error_feedback") if final_status == "failed" else None,
    )

    # Summary
    print("\n" + "=" * 60)
    if final_status == "passed":
        print("🎉 SUCCESS! All tests passed.")
        print(f"📁 Files saved to: {output_dir}")
    elif final_status == "failed":
        print(f"❌ FAILED after {loop_count} loop(s).")
        print("Last error:")
        print(final.get("error_feedback", "Unknown")[:300])
    else:
        print(f"Pipeline ended with status: {final_status}")
    print("=" * 60)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py \"<your prompt>\"")
        print('Example: python main.py "Build a FastAPI health check route"')
        sys.exit(1)

    user_prompt = " ".join(sys.argv[1:])
    run_pipeline(user_prompt)
