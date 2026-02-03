#!/bin/bash
cd "$(dirname "$0")"
echo "🔐 Starting Google Cloud Re-authentication..."
echo "------------------------------------------------"
echo "This window will guide you through logging in to Google Cloud."
echo "A browser window should open shortly. If not, copy the link provided."
echo ""

# Run the login command
gcloud auth login

echo ""
echo "------------------------------------------------"
echo "✅ Authentication finished!"
echo "You can now run 'deploy.command' to push the updates."
echo ""
read -n 1 -s -r -p "Press any key to close this window..."
exit
