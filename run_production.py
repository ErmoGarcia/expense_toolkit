#!/usr/bin/env python3
"""
Production server runner for Expense Toolkit.

Uses Gunicorn with Uvicorn workers for production deployment.
This script is designed to be called by systemd or run manually for production.

For development, use run.py instead (includes --reload for hot reloading).
"""
import sys
import os
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set up the virtual environment
venv_python = project_root / ".venv" / "bin" / "python"
gunicorn_bin = project_root / ".venv" / "bin" / "gunicorn"


def run_server():
    """Run the production server using Gunicorn"""
    if not venv_python.exists():
        print("Virtual environment not found. Please run: python3 -m venv .venv")
        return 1

    if not gunicorn_bin.exists():
        print("Gunicorn not found. Please install: pip install -r requirements.txt")
        return 1

    print("Starting Expense Toolkit (Production Mode)")
    print("=" * 50)
    print(f"Workers: 2 (Uvicorn workers)")
    print(f"Port: 8000")
    print(f"Environment: {os.getenv('ENVIRONMENT', 'production')}")
    print(f"Config: gunicorn_conf.py")
    print("=" * 50)
    print("Server will be available at: http://localhost:8000")
    print("Press Ctrl+C to stop")
    print()

    # Use execv to replace the current process
    # This is cleaner for systemd management
    os.execv(str(gunicorn_bin), [
        str(gunicorn_bin),
        "-c", "gunicorn_conf.py",
        "app.main:app"
    ])


if __name__ == "__main__":
    sys.exit(run_server() or 0)
