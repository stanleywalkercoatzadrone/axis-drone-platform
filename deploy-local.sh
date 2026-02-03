#!/bin/bash
echo "🚀 Deploying from Current Directory (Downloads)..."
echo "------------------------------------------------"

# Current Directory
PWD=$(pwd)
echo "Deploying context: $PWD"

# Submit build
gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION="us-central1" .
