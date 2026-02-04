#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Deploying Axis Drone Platform to Cloud Run..."
echo "------------------------------------------------"

# Generate a unique version tag
TIMESTAMP=$(date +%s)

# Submit build
# Using absolute path to project root if script is run from elsewhere, 
# but assuming this script sits in the project root.
# The project directory is the directory containing this script
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    echo "Files located at $PROJECT_DIR. Building..."
    gcloud beta builds submit --config cloudbuild.yaml --substitutions=COMMIT_SHA="manual-$TIMESTAMP" .
else
    echo "Error: Project directory not found at $PROJECT_DIR"
    exit 1
fi

echo "------------------------------------------------"
echo "✅ Deployment submitted! Check your Cloud Console for progress."
echo "Press any key to close..."
# read -n 1
