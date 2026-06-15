#!/usr/bin/env bash
set -e

# Author: Wyatt McCurdy — runs backend and frontend together for local development
# CollabConnect runner: starts backend and frontend

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$ROOT_DIR/databases"
 BACKEND_DIR="$ROOT_DIR/Backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Activate venv (different paths for Windows vs Unix)
if [[ -f "$VENV_DIR/Scripts/activate" ]]; then
  source "$VENV_DIR/Scripts/activate"  # Windows (Git Bash)
else
  source "$VENV_DIR/bin/activate"      # Linux/Mac
fi

# Use correct python path for OS
if [[ -f "$VENV_DIR/Scripts/python.exe" ]]; then
  PYTHON_BIN="$VENV_DIR/Scripts/python.exe"  # Windows
else
  PYTHON_BIN="$VENV_DIR/bin/python"          # Linux/Mac
fi

echo "==> Starting Flask backend on http://127.0.0.1:5001"
pushd "$BACKEND_DIR" >/dev/null
"$PYTHON_BIN" app.py &
BACKEND_PID=$!
popd >/dev/null

cleanup() {
  echo "\n==> Stopping backend (PID $BACKEND_PID)"
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT

echo "==> Starting React frontend on http://localhost:3000"
export REACT_APP_API_PROXY="http://127.0.0.1:5001"
pushd "$FRONTEND_DIR" >/dev/null
npm start
popd >/dev/null
