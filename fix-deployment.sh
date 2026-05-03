#!/bin/bash

# Fix Cloud Run Deployment by setting Environment Variables
# This script applies the missing configuration to your Cloud Run service.

SERVICE_NAME="axis-platform"
REGION="us-central1"

: "${DATABASE_URL:?DATABASE_URL must be set in the environment}"
: "${JWT_SECRET:?JWT_SECRET must be set in the environment}"
FRONTEND_URL="${FRONTEND_URL:-https://axis-platform-xyz.a.run.app}"

echo "🔧 Configuring Cloud Run service: $SERVICE_NAME in $REGION"
echo "   Setting DATABASE_URL..."
echo "   Setting JWT_SECRET..."

# Try to update the service
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --set-env-vars "DATABASE_URL=$DATABASE_URL" \
  --set-env-vars "JWT_SECRET=$JWT_SECRET" \
  --set-env-vars "NODE_ENV=production"

echo ""
echo "✅ Configuration updated!"
echo "   The service should now redeploy automatically with the new settings."
echo "   If it fails, check the logs in Google Cloud Console."
