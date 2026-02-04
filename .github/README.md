# GitHub Automation Setup Guide

This document explains the GitHub automation configurations that have been set up for the Axis by CoatzadroneUSA platform.

## 🤖 Automated Systems

### 1. Dependabot (Automated Dependency Updates)

**File**: `.github/dependabot.yml`

Dependabot automatically creates pull requests to update dependencies on a weekly schedule (Mondays at 9:00 AM).

**What it monitors**:
- npm packages (production and development)
- GitHub Actions versions
- Docker base images

**Features**:
- Groups minor and patch updates together to reduce PR noise
- Automatically assigns PRs to `stanleywalkercoatzadrone`
- Labels PRs with `dependencies` and `automated`
- Ignores major React updates (requires manual review)

**Configuration**: Up to 10 open PRs at a time

---

### 2. CI/CD Pipeline

**File**: `.github/workflows/ci.yml`

Runs automatically on every push and pull request to `main` and `develop` branches.

**Pipeline Jobs**:

1. **Lint & Type Check**
   - Runs TypeScript type checking
   - Runs ESLint (if configured)
   - Ensures code quality standards

2. **Build Frontend**
   - Builds the Vite/React frontend
   - Uploads build artifacts for 7 days
   - Validates production build succeeds

3. **Test Backend**
   - Spins up PostgreSQL 16 and Redis 7 services
   - Runs database migrations
   - Executes backend tests (if available)
   - Validates backend functionality

4. **Security Audit**
   - Runs `npm audit` to check for vulnerabilities
   - Reports security issues (moderate level and above)
   - Continues even if vulnerabilities found (for visibility)

5. **Docker Build Test**
   - Validates Dockerfile builds successfully
   - Uses build cache for faster builds
   - Ensures Docker deployment readiness

6. **Deployment Ready**
   - Final check that all jobs passed
   - Only runs on `main` branch pushes
   - Indicates the code is ready for production

---

### 3. CodeQL Security Scanning

**File**: `.github/workflows/codeql.yml`

Automated security vulnerability scanning using GitHub's CodeQL engine.

**When it runs**:
- Every push to `main` or `develop`
- Every pull request
- Weekly on Mondays at 6:00 AM UTC
- Can be triggered manually

**What it scans**:
- JavaScript code
- TypeScript code
- Security vulnerabilities
- Code quality issues

**Results**: Visible in the "Security" tab of your GitHub repository

---

### 4. Deployment Workflows

#### Vercel Deployment
**File**: `.github/workflows/deploy-vercel.yml`

Automatically deploys the frontend to Vercel when code is pushed to `main`.

**Required Secrets** (set in GitHub Settings → Secrets):
- `VERCEL_TOKEN` - Your Vercel authentication token
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

#### Railway Deployment
**File**: `.github/workflows/deploy-railway.yml`

Automatically deploys the backend to Railway when code is pushed to `main`.

**Required Secrets**:
- `RAILWAY_TOKEN` - Your Railway authentication token

---

### 5. Auto-Merge Dependabot PRs

**File**: `.github/workflows/auto-merge-dependabot.yml`

Automatically approves and merges Dependabot PRs for patch and minor updates.

**Behavior**:
- ✅ **Auto-approves and merges**: Patch updates (1.0.x)
- ✅ **Auto-approves and merges**: Minor updates (1.x.0)
- ⚠️ **Flags for review**: Major updates (x.0.0)

**Requirements**:
- All CI checks must pass before auto-merge
- Branch protection rules must allow auto-merge

---

### 6. Pull Request Template

**File**: `.github/PULL_REQUEST_TEMPLATE.md`

Standardizes PR descriptions with:
- Description of changes
- Type of change (bug fix, feature, etc.)
- Related issues
- Testing checklist
- Code review checklist

---

### 7. Security Policy

**File**: `.github/SECURITY.md`

Documents:
- How to report security vulnerabilities
- Supported versions
- Security best practices
- Automated security tools in use

---

## 🔧 Setup Instructions

### Step 1: Enable GitHub Features

1. **Go to your repository on GitHub**
2. **Enable Dependabot**:
   - Settings → Security → Dependabot
   - Enable "Dependabot alerts"
   - Enable "Dependabot security updates"
   - Enable "Dependabot version updates"

3. **Enable CodeQL**:
   - Settings → Security → Code scanning
   - Click "Set up" for CodeQL analysis
   - It will use the workflow we created

4. **Enable Branch Protection** (Recommended):
   - Settings → Branches → Add rule for `main`
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select required status checks: `Lint & Type Check`, `Build Frontend`, `Test Backend`

### Step 2: Add Deployment Secrets

#### For Vercel Deployment:

1. Get your Vercel token:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login and get token
   vercel login
   vercel whoami
   ```

2. Get your Vercel project IDs:
   ```bash
   # In your project directory
   vercel link
   # This creates .vercel/project.json with your IDs
   ```

3. Add secrets to GitHub:
   - Go to: Settings → Secrets and variables → Actions
   - Add `VERCEL_TOKEN`
   - Add `VERCEL_ORG_ID`
   - Add `VERCEL_PROJECT_ID`

#### For Railway Deployment:

1. Get your Railway token:
   - Go to Railway dashboard
   - Account Settings → Tokens
   - Create new token

2. Add secret to GitHub:
   - Settings → Secrets and variables → Actions
   - Add `RAILWAY_TOKEN`

### Step 3: Push to GitHub

```bash
# Add all new files
git add .github/

# Commit the changes
git commit -m "ci: add GitHub automation workflows and configurations"

# Push to GitHub
git push origin main
```

### Step 4: Verify Setup

1. **Check Actions tab**: You should see workflows running
2. **Check Security tab**: CodeQL should be scanning
3. **Check Dependabot tab**: Should show dependency monitoring
4. **Create a test PR**: Verify CI pipeline runs

---

## 📊 Monitoring

### GitHub Actions Dashboard
- Go to the "Actions" tab to see all workflow runs
- Click on any workflow to see detailed logs
- Failed workflows will send email notifications

### Security Alerts
- Go to the "Security" tab
- Check "Dependabot alerts" for dependency vulnerabilities
- Check "Code scanning" for CodeQL findings

### Dependabot PRs
- Dependabot will create PRs every Monday
- Review the "Pull requests" tab
- Minor/patch updates will auto-merge if CI passes
- Major updates require manual review

---

## 🎯 Best Practices

### For Developers

1. **Always create PRs**: Don't push directly to `main`
2. **Wait for CI**: Let all checks pass before merging
3. **Review Dependabot PRs**: Even auto-merged ones should be monitored
4. **Keep secrets secure**: Never commit secrets to the repository
5. **Update workflows**: As the project evolves, update CI/CD accordingly

### For Reviewers

1. **Check CI status**: Ensure all checks pass
2. **Review security alerts**: Address any CodeQL findings
3. **Test locally**: For significant changes, test locally before merging
4. **Review dependencies**: Understand what Dependabot is updating

---

## 🔍 Troubleshooting

### CI Pipeline Fails

**Type Check Errors**:
```bash
# Run locally to debug
npx tsc --noEmit
```

**Build Errors**:
```bash
# Run locally
npm run build
```

**Test Errors**:
```bash
# Ensure database is running
docker-compose up postgres redis -d

# Run migrations
npm run db:migrate

# Run tests
npm test
```

### Dependabot Issues

**Too many PRs**:
- Adjust `open-pull-requests-limit` in `dependabot.yml`
- Add more packages to the `ignore` list

**Auto-merge not working**:
- Check branch protection rules
- Ensure CI checks are passing
- Verify GitHub token permissions

### Deployment Failures

**Vercel**:
- Verify secrets are set correctly
- Check Vercel dashboard for errors
- Ensure build command matches `package.json`

**Railway**:
- Verify `RAILWAY_TOKEN` is valid
- Check Railway dashboard for deployment logs
- Ensure service name matches in workflow

---

## 📝 Customization

### Adjust CI Frequency

Edit `.github/workflows/ci.yml`:
```yaml
on:
  push:
    branches: [main, develop, feature/*]  # Add more branches
  pull_request:
    branches: [main]  # Only main
```

### Change Dependabot Schedule

Edit `.github/dependabot.yml`:
```yaml
schedule:
  interval: "daily"  # Options: daily, weekly, monthly
  day: "monday"      # For weekly
  time: "09:00"      # UTC time
```

### Add More Security Checks

Create `.github/workflows/security-extra.yml`:
```yaml
name: Additional Security Checks
on: [push, pull_request]
jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

## 🆘 Support

For issues with GitHub automation:
1. Check the Actions tab for error logs
2. Review this documentation
3. Contact: support@coatzadroneusa.com

---

**Last Updated**: January 19, 2026
**Maintained By**: CoatzadroneUSA Development Team
