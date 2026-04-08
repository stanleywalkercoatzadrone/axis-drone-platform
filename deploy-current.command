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
