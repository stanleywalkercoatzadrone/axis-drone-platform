#!/bin/bash

# Deploy script for skylens-ai---enterprise-drone-inspection
echo "🚀 Deploying to Production (Current Workspace)"

# Show status
git status --short

# Add all changes
git add .

# Commit
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
git commit -m "Deploy: Asset Grid Implementation - $TIMESTAMP"

# Push
git push origin header:main 2>&1 || git push origin main 2>&1 || git push 2>&1

echo "✅ Deployment push completed."

# Wait a moment so the user can see the success message
sleep 2

# Close the terminal window automatically
osascript -e 'tell application "Terminal" to close front window' &
exit 0
