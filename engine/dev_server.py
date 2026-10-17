"""Local integration runner: reload engine code, keep the key only in process memory."""
from __future__ import annotations

import argparse
import os
import signal
from pathlib import Path
import subprocess
import sys
import time


def source_snapshot(root):
    return {str(path): (path.stat().st_mtime_ns, path.stat().st_size) for path in root.glob("*.py")}


def stop_child(child):
    if child.poll() is None:
        child.terminate()
    try:
        child.wait(timeout=5)
    except subprocess.TimeoutExpired:
        child.kill()
        child.wait()


def interrupt(_signal, _frame):
    raise KeyboardInterrupt


def main():
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, interrupt)
    parser = argparse.ArgumentParser(description="Local engine with code reload for integration")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", default="var/kimi-live.db")
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[1]
    command = [sys.executable, "-X", "utf8", "-m", "engine.server", "--port", str(args.port), "--db", args.db]
    snapshot = source_snapshot(project / "engine")
    child = None
    pending_since = None
    try:
        while True:
            if child is None:
                # No key appears in the command, filesystem, or browser. The child inherits its environment.
                options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {}
                child = subprocess.Popen(command, cwd=project, **options)
            code = child.poll()
            if code is not None:
                return code
            current = source_snapshot(project / "engine")
            if current != snapshot:
                snapshot = current
                pending_since = time.monotonic()
            if pending_since is not None and time.monotonic() - pending_since >= 1.5:
                print("Engine code changed; restarting local service. No API key entry needed.", flush=True)
                stop_child(child)
                child = None
                pending_since = None
            time.sleep(0.5)
    except KeyboardInterrupt:
        return 0
    finally:
        if child is not None:
            stop_child(child)


if __name__ == "__main__":
    sys.exit(main())
