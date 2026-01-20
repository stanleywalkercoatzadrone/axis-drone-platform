# Google Cloud Platform Deployment Guide

This guide describes how to deploy the Axis platform to Google Cloud Run.

## Prerequisites
1.  **GCP Project**: A Google Cloud Project with billing enabled.
2.  **Google Cloud SDK**: Installed and authenticated (`gcloud auth login`).
3.  **APIs Enabled**:
    - Cloud Build API
    - Cloud Run API
    - Container Registry API

## Deployment Steps

### 1. Configure the Project
Set your project ID in the terminal:
```bash
gcloud config set project [YOUR_PROJECT_ID]
```

### 2. Prepare Environment Variables
You will need to configure these in the Cloud Run dashboard after deployment:
- `DATABASE_URL`: Your Supabase connection string.
- `JWT_SECRET`: A secure random string for tokens.
- `FRONTEND_URL`: The URL provided by Cloud Run (after deployment).
- `GEMINI_API_KEY`: Your Google AI Studio key.

### 3. Deploy using Cloud Build
Run the following command from the project root:
```bash
gcloud builds submit --config cloudbuild.yaml .
```

This command will:
- Build the Docker image in the cloud.
- Push it to the Google Container Registry.
- Deploy it to Cloud Run as a service called `axis-platform`.

### 4. Finalize Configuration
Once the deployment is complete, Cloud Run will provide a Service URL (e.g., `https://axis-platform-xyz.a.run.app`).
1.  Go to the **Cloud Run Console**.
2.  Select the `axis-platform` service.
3.  Go to **Edit & Deploy New Revision**.
4.  Add the environment variables listed in step 2.
5.  Update `FRONTEND_URL` to match the Cloud Run service URL.

## Automatic Continuous Deployment (CI/CD)

To make updates automatic every time you push code to GitHub:

1.  **Connect Repository**:
    - Go to the [Cloud Build Triggers page](https://console.cloud.google.com/cloud-build/triggers).
    - Click **Manage Repositories** -> **Connect Repository**.
    - Select **GitHub (Cloud Build GitHub App)** and authorize access to this repository.

2.  **Create Trigger**:
    - Click **Create Trigger**.
    - **Name**: `axis-platform-auto-deploy`
    - **Event**: Push to a branch (e.g., `main`).
    - **Source**: Select your connected repository and branch.
    - **Configuration**: Cloud Build configuration file (yaml or json).
    - **Location**: Repository.
    - **Cloud Build configuration file location**: `cloudbuild.yaml`
    - Click **Create**.

### 3. Service Account Permissions (CRITICAL)

For Cloud Build to actually deploy to Cloud Run, its service account needs permission. 

1.  Go to **IAM & Admin** -> **IAM**.
2.  Find the service account that looks like: `[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`.
3.  Click the Pencil icon to edit roles and add:
    - **Cloud Run Admin**
    - **Service Account User**

Now, any code you push to your branch will automatically build and deploy to Cloud Run without running a command manually.

## Architecture Notes
- **Compute**: Google Cloud Run (Serverless Containers).
- **Database**: Supabase (PostgreSQL).
- **Storage**: Local filesystem (Ephemeral for now). For persistent storage, we recommend integrating Google Cloud Storage.
- **CI/CD**: Google Cloud Build (Triggers).
