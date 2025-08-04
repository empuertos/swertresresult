#!/usr/bin/env bash
set -e

echo "Bootstrapping Swertres live widget (backend + frontend)..."

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js not found. Please install Node.js (v18+ recommended) and re-run."
  exit 1
fi

cd backend
echo "Installing backend dependencies..."
npm install

echo "Bootstrap complete."
echo "To start backend: cd backend && npm start"
echo "Then edit frontend/index.html to point API_URL to the running backend (default http://localhost:4000/api/swertres)"
