#!/bin/bash
echo "Deploying to Cloud Run..."
gcloud builds submit --config cloudbuild.yaml .
