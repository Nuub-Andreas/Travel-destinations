#!/bin/bash
# ─── Travel destinations — Backend Startup ─────────────────────────────────────────────
set -e

cd "$(dirname "$0")/backend"

echo ""
echo "  ✈  Travel Destinations API"
echo "  ─────────────────────────────────────────"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "  ✗  python3 not found. Please install Python 3.8+"
  exit 1
fi

# Check Flask
if ! python3 -c "import flask" 2>/dev/null; then
  echo "  ✗  Flask not found. Installing..."
  pip3 install flask
fi

# Check PyJWT
if ! python3 -c "import jwt" 2>/dev/null; then
  echo "  ✗  PyJWT not found. Installing..."
  pip3 install PyJWT
fi

echo "  ✓  Dependencies OK"
echo "  ✓  Starting API on http://localhost:5001"
echo ""
echo "  Open frontend/index.html in your browser to use the app."
echo "  Press Ctrl+C to stop."
echo ""

python3 app.py
