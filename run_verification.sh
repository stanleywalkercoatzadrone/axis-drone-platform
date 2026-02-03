#!/bin/bash
cd /Users/Huvrs/Projects/axis-drone-platform || exit 1

echo "📂 Changed directory to $(pwd)"

# 1. Kill stale processes
echo "🔪 Killing stale server..."
lsof -t -i:8080 | xargs kill -9 2>/dev/null

# 2. Run Migration Explicitly (Offline)
echo "🛠️  Running Migration (Offline)..."
node backend/migrations/run_enterprise.js

# 3. Start Server
echo "🚀 Starting Server..."
node backend/server.js > /tmp/server.log 2>&1 &
SERVER_PID=$!

echo "⏳ Waiting 5s for boot..."
sleep 5

# Check if it died
if ! ps -p $SERVER_PID > /dev/null; then
    echo "❌ Server died immediately. Log tail:"
    tail -n 10 /tmp/server.log
    exit 1
fi

echo "✅ Server running (PID $SERVER_PID)"

# 4. Run Tests (Migration inside will still run but should be no-op/fast)
echo "🧪 Running Verified Security Check..."
node tests/security_check.js

# 4. Cleanup (Keep server running for user? Or kill?)
# The user wants to use it, so let's leave it running? 
# Or maybe clean up to be polite? 
# Usually verification scripts should cleanup.
# But the user asked to "fix everything", implying they want a working state.
# Let's leave it running if successful.
