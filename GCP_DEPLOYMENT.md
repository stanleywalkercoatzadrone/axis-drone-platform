# Google Cloud Platform Deployment Guide

This guide describes how to deploy the Axis Drone Platform to Google Cloud Run using Cloud Build.

## Prerequisites

### 1. GCP Project Setup
- **GCP Account**: Sign up at [cloud.google.com](https://cloud.google.com)
- **GCP Project**: Create a new project or use an existing one
- **Billing**: Enable billing on your project (required for Cloud Run and Cloud Build)

### 2. Install Google Cloud SDK
```bash
# macOS (using Homebrew)
brew install --cask google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### 3. Authenticate and Configure
```bash
# Login to your Google account
gcloud auth login

# Set your project ID (replace with your actual project ID)
gcloud config set project YOUR_PROJECT_ID

# Verify configuration
gcloud config list
```

### 4. Enable Required APIs
```bash
# Enable all required APIs at once
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com
```

### 5. Prepare Environment Variables

You'll need these values ready:
- `DATABASE_URL`: Your Supabase PostgreSQL connection string
- `JWT_SECRET`: A secure random string (generate with: `openssl rand -base64 32`)
- `GEMINI_API_KEY`: Your Google AI Studio API key
- `FRONTEND_URL`: Will be provided after first deployment (e.g., `https://axis-platform-xyz.a.run.app`)

## Manual Deployment

### Step 1: Build and Deploy
From your project root directory:

```bash
cd /Users/Huvrs/Projects/axis-drone-platform

# Submit build to Cloud Build (this will build and deploy)
gcloud builds submit --config cloudbuild.yaml .
```

This command will:
1. Upload your source code to Cloud Build
2. Build the Docker image
3. Push the image to Google Container Registry
4. Deploy the image to Cloud Run as `axis-platform`

**Expected time**: 5-10 minutes for first build

### Step 2: Configure Environment Variables

After the first deployment, you need to set environment variables:

```bash
# Get your Cloud Run service URL first
gcloud run services describe axis-platform --region us-central1 --format 'value(status.url)'

# Set environment variables (replace with your actual values)
gcloud run services update axis-platform \
  --region us-central1 \
  --set-env-vars "DATABASE_URL=postgresql://user:pass@host:5432/db" \
  --set-env-vars "JWT_SECRET=your-secret-here" \
  --set-env-vars "GEMINI_API_KEY=your-api-key" \
  --set-env-vars "FRONTEND_URL=https://axis-platform-xyz.a.run.app"
```

**Alternative**: Set environment variables via Cloud Console:
1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on `axis-platform` service
3. Click **Edit & Deploy New Revision**
4. Scroll to **Variables & Secrets**
5. Add each environment variable
6. Click **Deploy**

### Step 3: Verify Deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe axis-platform --region us-central1 --format 'value(status.url)')

# Test health endpoint
curl $SERVICE_URL/health

# Expected response:
# {"status":"ok","timestamp":"...","service":"Axis Backend","version":"1.0.0"}
```

Open the URL in your browser to access the application.

## Automatic Continuous Deployment (CI/CD)

Set up automatic deployments when you push code to GitHub.

### Step 1: Connect GitHub Repository

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click **Connect Repository**
3. Select **GitHub (Cloud Build GitHub App)**
4. Authenticate with GitHub
5. Select your repository: `axis-drone-platform`
6. Click **Connect**

### Step 2: Create Build Trigger

1. Click **Create Trigger**
2. Configure the trigger:
   - **Name**: `axis-platform-auto-deploy`
   - **Description**: `Auto-deploy on push to main`
   - **Event**: Push to a branch
   - **Source**: 
     - Repository: `your-github-username/axis-drone-platform`
     - Branch: `^main$` (or your preferred branch)
   - **Configuration**:
     - Type: Cloud Build configuration file (yaml or json)
     - Location: Repository
     - Cloud Build configuration file location: `cloudbuild.yaml`
   - **Substitution variables** (optional):
     - `_REGION`: `us-central1` (or your preferred region)
     - `_MEMORY`: `2Gi`
     - `_CPU`: `2`
3. Click **Create**

### Step 3: Grant Service Account Permissions

**CRITICAL**: Cloud Build needs permission to deploy to Cloud Run.

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Grant Service Account User role
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

**Alternative**: Via Cloud Console:
1. Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam)
2. Find service account: `[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`
3. Click the pencil icon to edit
4. Add roles:
   - **Cloud Run Admin**
   - **Service Account User**
5. Click **Save**

### Step 4: Test Automatic Deployment

```bash
# Make a small change
echo "# Test deployment" >> README.md

# Commit and push
git add README.md
git commit -m "Test automatic deployment"
git push origin main
```

Watch the build progress:
- Go to [Cloud Build History](https://console.cloud.google.com/cloud-build/builds)
- You should see a new build triggered automatically
- After completion, a new revision will be deployed to Cloud Run

## Configuration Options

### Customizing Build Settings

You can override default settings in `cloudbuild.yaml`:

```bash
# Deploy to a different region
gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=us-east1 .

# Use more memory and CPU
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_MEMORY=4Gi,_CPU=4 .

# Set min instances (keeps service warm, costs more)
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_MIN_INSTANCES=1 .
```

### Scaling Configuration

```bash
# Update Cloud Run service scaling
gcloud run services update axis-platform \
  --region us-central1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80
```

## Monitoring and Logs

### View Application Logs
```bash
# Stream logs in real-time
gcloud run services logs tail axis-platform --region us-central1

# View recent logs
gcloud run services logs read axis-platform --region us-central1 --limit 50
```

**Via Console**:
1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on `axis-platform`
3. Click **Logs** tab

### View Build Logs
```bash
# List recent builds
gcloud builds list --limit 10

# View specific build log
gcloud builds log BUILD_ID
```

**Via Console**:
- Go to [Cloud Build History](https://console.cloud.google.com/cloud-build/builds)

### Monitoring Dashboard
- Go to [Cloud Run Metrics](https://console.cloud.google.com/run/detail/us-central1/axis-platform/metrics)
- View request count, latency, error rate, CPU/memory usage

## Troubleshooting

### Build Fails with "Permission Denied"
**Solution**: Ensure Cloud Build service account has proper permissions (see CI/CD Step 3)

### Build Timeout
**Solution**: Increase timeout in `cloudbuild.yaml`:
```yaml
options:
  timeout: '2400s'  # 40 minutes
```

### Container Fails to Start
**Check logs**:
```bash
gcloud run services logs read axis-platform --region us-central1 --limit 100
```

**Common issues**:
- Missing environment variables (DATABASE_URL, JWT_SECRET, etc.)
- Database connection failure
- Port binding issue (ensure app listens on `process.env.PORT`)

### "Service Unavailable" Error
**Possible causes**:
- Container startup taking too long (increase startup timeout)
- Health check failing
- Out of memory (increase memory allocation)

**Check container health**:
```bash
gcloud run services describe axis-platform --region us-central1
```

### High Costs
See "Cost Optimization" section below.

## Cost Optimization

### Estimated Costs
- **Cloud Run**: Pay only when handling requests (~$0.00002400 per request)
- **Cloud Build**: First 120 build-minutes/day are free
- **Container Registry**: Storage costs (~$0.026/GB/month)

### Tips to Reduce Costs

1. **Keep min-instances at 0** (default in our config)
   - Service scales to zero when not in use
   - May have cold start delay (~2-5 seconds)

2. **Use appropriate memory/CPU**
   - Start with 2Gi/2 CPU (default)
   - Monitor usage and adjust down if possible

3. **Clean up old images**
   ```bash
   # List images
   gcloud container images list-tags gcr.io/YOUR_PROJECT_ID/axis-platform
   
   # Delete old images (keep latest 5)
   gcloud container images list-tags gcr.io/YOUR_PROJECT_ID/axis-platform \
     --limit=999999 --sort-by=TIMESTAMP \
     --format='get(digest)' | tail -n +6 | \
     xargs -I {} gcloud container images delete gcr.io/YOUR_PROJECT_ID/axis-platform@{} --quiet
   ```

4. **Set max-instances limit**
   - Prevents runaway costs from traffic spikes
   - Default: 10 instances (in our config)

5. **Use build cache** (remove `--no-cache` from cloudbuild.yaml for faster, cheaper builds)

## Architecture Overview

- **Compute**: Google Cloud Run (Serverless Containers)
  - Auto-scaling from 0 to 10 instances
  - 2Gi memory, 2 vCPU per instance
  - 300-second request timeout
  
- **Database**: Supabase (PostgreSQL)
  - Hosted externally
  - Connected via DATABASE_URL

- **Storage**: 
  - Container images: Google Container Registry
  - User uploads: Ephemeral (local filesystem in container)
  - **Recommendation**: Migrate to Google Cloud Storage for persistent uploads

- **CI/CD**: Google Cloud Build
  - Automated builds on git push
  - Multi-stage Docker builds
  - Automatic deployment to Cloud Run

## Next Steps

1. **Set up custom domain** (optional)
   ```bash
   gcloud run domain-mappings create --service axis-platform --domain your-domain.com --region us-central1
   ```

2. **Enable Cloud CDN** for static assets (optional)

3. **Set up Cloud Monitoring alerts** for errors and high latency

4. **Implement Cloud Storage** for persistent file uploads

5. **Configure Cloud SQL** if you want to migrate from Supabase to GCP-native database

## Support

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [GCP Support](https://cloud.google.com/support)

