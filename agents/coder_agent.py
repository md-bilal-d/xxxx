"""
Coder Agent — Uses Qwen 2.5-Coder via Ollama to write implementation files.
Reads system_design.md and generates all specified .py files.
"""
import os
import re
from ollama import Client


CODER_MODEL = os.getenv("MODEL_CODER", "qwen2.5-coder")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

SYSTEM_PROMPT = """You are an expert Python developer. You will receive a system design document.
Your job is to implement EVERY file described in the design.

For EACH file, output it in this exact format:

**File: path/to/filename.py**
```python
<complete file contents>
```

Rules:
- Write complete, production-quality Python code
- Include all imports, type hints, and docstrings
- Follow PEP 8 conventions
- Make sure all files work together as a cohesive project
- Include proper error handling
- Use the exact filenames from the design document"""


def file_write(filepath: str, content: str, output_dir: str = ".") -> str:
    """
    Tool function: Save content to a file, creating directories as needed.

    Args:
        filepath: Relative path for the file
        content: File content string
        output_dir: Base directory for output

    Returns:
        Absolute path of the created file
    """
    full_path = os.path.join(output_dir, filepath)
    os.makedirs(os.path.dirname(full_path) if os.path.dirname(full_path) else ".", exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  📄 Created: {full_path}")
    return full_path


def parse_files(response_text: str) -> list[dict]:
    """Parse the LLM response into individual files using markdown code fences."""
    files = []
    # Match **File: path** followed by ```lang ... ```
    pattern = r"\*\*File:\s*(.+?)\*\*\s*\n+```(?:[a-zA-Z0-9]+)?\n(.*?)\n```"
    matches = re.finditer(pattern, response_text, re.DOTALL)

    for match in matches:
        filepath = match.group(1).strip()
        content = match.group(2).strip()
        files.append({"path": filepath, "content": content})

    return files


def run_coder(design: str, output_dir: str = ".", error_feedback: str = None) -> list[str]:
    """
    Generate implementation files from a system design.

    Args:
        design: The system_design.md content
        output_dir: Directory to save generated files
        error_feedback: Optional error traceback from reviewer for fixing

    Returns:
        List of created file paths
    """
    client = Client(host=OLLAMA_BASE_URL)

    print(f"⌨  Coder Agent starting (model: {CODER_MODEL})")

    user_message = f"Implement all files from this system design:\n\n{design}"
    if error_feedback:
        user_message += f"\n\n--- ERROR FROM REVIEWER ---\nThe following errors were found. Fix them:\n{error_feedback}"

    response = client.chat(
        model=CODER_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )

    response_text = response["message"]["content"]
    files = parse_files(response_text)

    if not files:
        # Fallback: try to save the entire response as a single file
        print("  ⚠ Could not parse individual files, saving raw output")
        file_write("output.py", response_text, output_dir)
        return [os.path.join(output_dir, "output.py")]

    created_files = []
    for f in files:
        path = file_write(f["path"], f["content"], output_dir)
        created_files.append(path)

    print(f"✅ Coder Agent complete — created {len(created_files)} files")
    return created_files


if __name__ == "__main__":
    # Read system_design.md from current directory
    design_path = "system_design.md"
    if not os.path.exists(design_path):
        print(f"❌ {design_path} not found. Run architect_agent.py first.")
        exit(1)

    with open(design_path, "r", encoding="utf-8") as f:
        design = f.read()

    run_coder(design, output_dir="./output")
