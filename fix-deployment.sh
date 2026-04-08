#!/bin/bash

# Fix Cloud Run Deployment by setting Environment Variables
# This script applies the missing configuration to your Cloud Run service.

SERVICE_NAME="axis-platform"
REGION="us-central1"

# Secrets from .env.local
DATABASE_URL="postgresql://postgres.nkhiiwleyjsmvvdtkcud:%21Qaz1976T%40ylor2008@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
JWT_SECRET="skylens_secret_key_change_in_prod"
FRONTEND_URL="https://axis-platform-xyz.a.run.app" # Placeholder, update if known

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
