#!/usr/bin/env python3

import sys
import os
import subprocess
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set up the virtual environment
venv_python = project_root / ".venv" / "bin" / "python"


def run_server():
    """Run the FastAPI server using the virtual environment"""
    if not venv_python.exists():
        print("Virtual environment not found. Please run: python3 -m venv venv")
        return

    print("Starting Expense Toolkit server...")
    print("Server will be available at: http://localhost:8000")
    print("Press Ctrl+C to stop")

    cmd = [
        str(venv_python),
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--reload",
    ]

    try:
        subprocess.run(cmd, cwd=str(project_root))
    except KeyboardInterrupt:
        print("\nShutting down server...")


if __name__ == "__main__":
    run_server()

