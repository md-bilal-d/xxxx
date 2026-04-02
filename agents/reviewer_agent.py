"""
Reviewer Agent — Uses Llama 3.1:8b via Ollama to run tests and validate code.
Runs pytest on generated files and returns structured error reports.
"""
import os
import subprocess
from ollama import Client


REVIEWER_MODEL = os.getenv("MODEL_REVIEWER", "llama3.1")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

SYSTEM_PROMPT = """You are an expert code reviewer and QA engineer. You will receive:
1. Test output (pytest results)
2. The code files that were tested

Your job is to analyze the results and provide:
- If ALL tests pass: respond with exactly "LGTM"
- If tests fail: provide a structured error report with:
  - Which test(s) failed
  - The error type and message
  - Your analysis of the root cause
  - Specific fix suggestions for the Coder agent

Be concise and actionable. The Coder agent will use your feedback to fix the code."""


def run_tests(project_dir: str) -> dict:
    """
    Run pytest on the project directory and capture output.

    Args:
        project_dir: Path to the project directory

    Returns:
        Dict with 'returncode', 'stdout', 'stderr'
    """
    try:
        result = subprocess.run(
            ["python", "-m", "pytest", project_dir, "-v", "--tb=long"],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=project_dir,
        )
        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except subprocess.TimeoutExpired:
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": "TIMEOUT: Tests exceeded 60 second limit",
        }
    except FileNotFoundError:
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": "pytest not found. Install with: pip install pytest",
        }


def run_reviewer(project_dir: str = ".", code_files: list[str] = None) -> str:
    """
    Review generated code by running tests and analyzing results.

    Args:
        project_dir: Directory containing the project files
        code_files: Optional list of code file paths to include in context

    Returns:
        "LGTM" if all tests pass, or a structured error report
    """
    client = Client(host=OLLAMA_BASE_URL)

    print(f"🔍 Reviewer Agent starting (model: {REVIEWER_MODEL})")

    # Run tests
    print("  🧪 Running pytest...")
    test_results = run_tests(project_dir)

    # If tests pass with no errors
    if test_results["returncode"] == 0:
        print("  ✅ All tests passed!")
        return "LGTM"

    # Gather code context
    code_context = ""
    if code_files:
        for fpath in code_files:
            if os.path.exists(fpath):
                with open(fpath, "r", encoding="utf-8") as f:
                    code_context += f"\n\n--- {fpath} ---\n{f.read()}"

    # Ask LLM to analyze failures
    print("  🔎 Analyzing test failures...")
    analysis_prompt = f"""Test Results (return code: {test_results['returncode']}):

STDOUT:
{test_results['stdout']}

STDERR:
{test_results['stderr']}

{f'CODE FILES:{code_context}' if code_context else ''}

Analyze the test failures and provide a structured error report for the Coder agent to fix."""

    response = client.chat(
        model=REVIEWER_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": analysis_prompt},
        ],
    )

    error_report = response["message"]["content"]

    # Build structured output
    full_report = f"""## Test Failure Report

**Return Code:** {test_results['returncode']}

### Raw Output
```
{test_results['stdout'][-1000:] if test_results['stdout'] else 'No stdout'}
```

### Errors
```
{test_results['stderr'][-1000:] if test_results['stderr'] else 'No stderr'}
```

### Analysis
{error_report}
"""

    print(f"  ❌ Reviewer found errors")
    return full_report


if __name__ == "__main__":
    import sys
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    result = run_reviewer(target_dir)
    print("\n" + "=" * 60)
    print(result)
