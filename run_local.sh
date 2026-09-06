#!/usr/bin/env bash

echo "=================================================="
echo "🚀 Starting InvestTracker Local Development Server"
echo "=================================================="

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r backend/requirements.txt
fi

echo "Starting Backend API on http://localhost:3011 ..."
./venv/bin/uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 3011 --reload &
BACKEND_PID=$!

echo "Starting Frontend SPA Server on http://localhost:3010 ..."
python3 dev_server.py &
FRONTEND_PID=$!

echo ""
echo "✅ App is running at: http://localhost:3010"
echo "✅ API Docs at:       http://localhost:3011/api/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

wait
