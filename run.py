"""
FairSplit Flow - One-Click Launcher
===================================
Starts the FairSplit Flow server and opens the browser.
"""

import os
import sys
import webbrowser
import threading
import time

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, backend_dir)

from database import init_db
from seed_data import seed_demo_data
from app import app

def open_browser(port):
    if os.environ.get("RENDER") or os.environ.get("CI") or not sys.stdin.isatty():
        return
    time.sleep(1.2)
    url = f"http://localhost:{port}"
    print(f"🌐 Opening FairSplit Flow in browser: {url}")
    try:
        webbrowser.open(url)
    except Exception:
        pass

if __name__ == "__main__":
    init_db()
    seed_demo_data()

    port = int(os.environ.get("PORT", 5000))
    print("=" * 60)
    print("✨ Starting FairSplit Flow Web Application")
    print(f"🚀 Server running at: http://localhost:{port}")
    print("=" * 60)

    # Launch browser only on interactive desktop runs
    if not (os.environ.get("RENDER") or os.environ.get("CI")):
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    app.run(host="0.0.0.0", port=port, debug=False)
