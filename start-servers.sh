#!/bin/bash

# Script to start the Axis Drone Platform servers from the correct location

echo "🚀 Starting Axis Drone Platform..."
echo ""

# Kill any existing processes on ports 8080 and 3000
echo "📋 Stopping any existing servers..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || echo "   No process on port 8080"
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "   No process on port 3000"
lsof -ti:5173 | xargs kill -9 2>/dev/null || echo "   No process on port 5173"

echo ""
echo "✅ Ports cleared"
echo ""

# Navigate to the correct project directory
cd /Users/Huvrs/Projects/axis-drone-platform

# Start backend in the background
echo "🔧 Starting backend server on port 8080..."
# We are already in project root
npm run start:backend > backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait a moment for backend to start
sleep 3

# Start frontend
echo ""
echo "🎨 Starting frontend server..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Servers started!"
echo ""
echo "📍 Backend:  http://localhost:8080"
echo "📍 Frontend: http://localhost:3000 (or check frontend.log for actual port)"
echo ""
echo "📝 Logs:"
echo "   Backend:  /Users/Huvrs/Projects/axis-drone-platform/backend.log"
echo "   Frontend: /Users/Huvrs/Projects/axis-drone-platform/frontend.log"
echo ""
echo "To stop servers, run: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Waiting 5 seconds for servers to fully start..."
sleep 5

# Check if servers are running
echo ""
echo "🔍 Checking server status..."
if lsof -ti:8080 > /dev/null 2>&1; then
    echo "   ✅ Backend is running on port 8080"
else
    echo "   ❌ Backend failed to start - check backend.log"
fi

if lsof -ti:3000 > /dev/null 2>&1 || lsof -ti:5173 > /dev/null 2>&1; then
    echo "   ✅ Frontend is running"
else
    echo "   ❌ Frontend failed to start - check frontend.log"
fi

echo ""
echo "🌐 Opening application in browser..."
sleep 2

# Try to open the app (check common ports)
if lsof -ti:3000 > /dev/null 2>&1; then
    open http://localhost:3000
elif lsof -ti:5173 > /dev/null 2>&1; then
    open http://localhost:5173
else
    echo "   ⚠️  Could not detect frontend port - check frontend.log"
fi
