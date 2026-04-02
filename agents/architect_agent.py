"""
Architect Agent — Uses Llama 3.1 via Ollama to generate system design plans.
Takes a user prompt and outputs a system_design.md file.
"""
import os
from ollama import Client


ARCHITECT_MODEL = os.getenv("MODEL_ARCHITECT", "llama3.1")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

SYSTEM_PROMPT = """You are a world-class software architect. Given a user's project description,
create a detailed system_design.md with:

1. **Project Structure**: A tree diagram of the folder/file structure
2. **File List**: Each file that needs to be created
3. **File Descriptions**: A brief description of each file's purpose and key contents
4. **Dependencies**: Any pip packages needed (list for requirements.txt)
5. **Architecture Notes**: Key design decisions

Output ONLY valid markdown. Be specific about file contents — the Coder agent
will use this as their sole reference to write the actual code."""


def run_architect(prompt: str, output_dir: str = ".") -> str:
    """
    Generate a system design plan from a user prompt.

    Args:
        prompt: The user's project description
        output_dir: Directory to save system_design.md

    Returns:
        The generated design document as a string
    """
    client = Client(host=OLLAMA_BASE_URL)

    print(f"🏗  Architect Agent starting (model: {ARCHITECT_MODEL})")
    print(f"📝 Prompt: {prompt[:80]}...")

    response = client.chat(
        model=ARCHITECT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Create a system design for:\n\n{prompt}"},
        ],
    )

    design = response["message"]["content"]

    # Save to file
    design_path = os.path.join(output_dir, "system_design.md")
    with open(design_path, "w", encoding="utf-8") as f:
        f.write(design)

    print(f"✅ Architect Agent complete — saved to {design_path}")
    return design


if __name__ == "__main__":
    import sys
    user_prompt = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Build a FastAPI health check route"
    result = run_architect(user_prompt)
    print("\n" + "=" * 60)
    print(result)
