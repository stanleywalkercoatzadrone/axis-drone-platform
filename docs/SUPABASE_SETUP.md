# 🚀 Supabase Setup & Migration Guide

Complete guide for migrating SkyLens AI from local PostgreSQL to Supabase managed database.

---

## Overview

This guide will help you:
1. Create a Supabase account and project
2. Configure your application to use Supabase
3. Migrate your database schema
4. (Optional) Set up Supabase Storage for drone images
5. Deploy your application

**Time to complete:** ~30 minutes

---

## Part 1: Create Supabase Account

### Step 1: Sign Up

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"**
3. Sign up with:
   - **GitHub** (recommended - fastest)
   - **Email** (requires verification)

### Step 2: Create New Project

1. After signing in, click **"New Project"**
2. Select your organization (or create one)
3. Fill in project details:

```
Project Name: skylens-ai-production
Database Password: [Generate strong password - SAVE THIS!]
Region: US East (Ohio) - or closest to your users
Pricing Plan: Free (includes 500MB database, unlimited API requests)
```

> [!CAUTION]
> **Save your database password immediately!** You cannot retrieve it later. You'll need it for the connection string.

4. Click **"Create new project"**
5. Wait 2-3 minutes while Supabase provisions your database

---

## Part 2: Get Your Credentials

### Step 1: Database Connection String

1. In your Supabase dashboard, click **"Project Settings"** (⚙️ gear icon in sidebar)
2. Navigate to **"Database"** section
3. Scroll to **"Connection String"** section
4. Select **"URI"** tab
5. Copy the connection string - it looks like:

```
postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres
```

6. **Replace `[YOUR-PASSWORD]`** with the database password you created in Part 1

### Step 2: API Keys

1. In Project Settings, click **"API"** in the left sidebar
2. You'll see your credentials:

```
Project URL: https://abcdefghijklmnop.supabase.co
anon/public key: eyJhbGc...
service_role key: eyJhbGc...
```

3. **Copy all three values** - you'll need them in the next step

---

## Part 3: Configure Your Application

### Step 1: Update Environment Variables

1. Open your project directory
2. Edit `.env.local` file:

```bash
# Remove or comment out local PostgreSQL settings
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=skylens_db
# DB_USER=postgres
# DB_PASSWORD=postgres

# Add Supabase Database URL
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Add Supabase API credentials (for storage)
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=eyJhbGc[...your anon key...]
SUPABASE_SERVICE_KEY=eyJhbGc[...your service role key...]
SUPABASE_STORAGE_BUCKET=drone-images

# Update Node environment
NODE_ENV=production

# Keep other settings (Gemini API, JWT, Redis, etc.)
API_KEY=your_actual_gemini_api_key
JWT_SECRET=your-super-secret-jwt-key-change-in-production
REDIS_URL=redis://localhost:6379
```

### Step 2: Test Database Connection

```bash
# Test that Node can connect to Supabase
node -e "import('./backend/config/database.js').then(m => m.query('SELECT NOW()')).then(r => console.log('✅ Connected:', r.rows[0]))"
```

You should see:
```
✅ PostgreSQL connected
✅ Connected: { now: '2026-01-16T19:15:00.000Z' }
```

---

## Part 4: Migrate Database Schema

### Step 1: Run Migrations

```bash
npm run db:migrate
```

This will create all tables in your Supabase database:
- ✅ users
- ✅ reports
- ✅ images
- ✅ sync_logs
- ✅ audit_logs
- ✅ report_history

### Step 2: Verify Tables in Supabase

1. Go to Supabase Dashboard
2. Click **"Database"** in sidebar, then **"Tables"**
3. You should see all 6 tables listed
4. Click on **"users"** table - you should see the default admin user

### Step 3: Enable Required Extensions

1. In Supabase dashboard, click **"Database"** → **"Extensions"**
2. Verify these extensions are enabled:
   - ✅ `uuid-ossp` (UUID generation)
   - ✅ `pg_stat_statements` (performance monitoring)

---

## Part 5: (Optional) Set Up Supabase Storage

If you want to store drone images in Supabase instead of locally:

### Step 1: Create Storage Bucket

1. In Supabase dashboard, click **"Storage"** in sidebar
2. Click **"Create a new bucket"**
3. Configure:

```
Bucket Name: drone-images
Public bucket: ✅ Yes
File size limit: 50MB
Allowed MIME types: image/*
```

4. Click **"Create bucket"**

### Step 2: Set Bucket Policies

1. Click on the `drone-images` bucket
2. Go to **"Policies"** tab
3. For now, click **"New Policy"** → **"For full customization"**
4. Create a policy named "Allow authenticated uploads":

```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'drone-images');
```

5. Create another policy "Allow public reads":

```sql
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'drone-images');
```

### Step 3: Update Storage Provider

In your `.env.local`, change:

```bash
# Change from local to supabase
STORAGE_PROVIDER=supabase
```

---

## Part 6: Test Your Application

### Step 1: Start the Backend

```bash
npm run dev:backend
```

You should see:
```
✅ Supabase client initialized
📦 Storage provider: supabase
   Supabase bucket: drone-images
✅ PostgreSQL connected
🚀 SkyLens AI Backend running on port 8080
```

### Step 2: Test API Endpoints

```bash
# Health check
curl http://localhost:8080/health

# Should return:
# {"status":"ok","timestamp":"...","service":"SkyLens AI Backend","version":"1.0.0"}
```

### Step 3: Test Authentication

1. Start the frontend: `npm run dev`
2. Open http://localhost:3000
3. Try logging in with default admin:
   - Email: `admin@skylens.ai`
   - Password: `admin123`
4. Create a test report
5. Upload a drone image
6. Verify in Supabase:
   - Dashboard → Database → Tables → reports (should show your report)
   - Dashboard → Storage → drone-images (should show uploaded image)

---

## Part 7: Production Deployment

Now that your database is in Supabase, deployment is much simpler!

### Option A: Deploy to Vercel (Recommended for Frontend + API)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts and add environment variables
```

### Option B: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables from `.env.local`
5. Deploy!

### Option C: Deploy to Render

1. Go to [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Set build command: `npm run build`
5. Set start command: `npm run start:backend`
6. Add environment variables
7. Deploy!

---

## Troubleshooting

### Connection Issues

**Problem:** `Error: SSL connection required`

**Solution:** Make sure `NODE_ENV=production` in your `.env.local` (enables SSL)

---

**Problem:** `Error: password authentication failed`

**Solution:** 
- Verify you replaced `[YOUR-PASSWORD]` in DATABASE_URL with your actual password
- Password must be URL-encoded if it contains special characters

---

**Problem:** `Error: relation "users" does not exist`

**Solution:** Run migrations: `npm run db:migrate`

---

### Storage Issues

**Problem:** `Supabase client not initialized`

**Solution:** 
- Verify SUPABASE_URL and SUPABASE_SERVICE_KEY are set in `.env.local`
- Restart your backend server

---

**Problem:** `Error: new row violates row-level security policy`

**Solution:** 
- Check bucket policies in Supabase dashboard
- Make sure bucket is set to "Public" or add proper RLS policies

---

### Performance Issues

**Problem:** Slow queries

**Solution:**
- Check **Database** → **Query Performance** in Supabase dashboard
- Verify indexes exist (they should from migrations)
- Consider upgrading Supabase plan if needed

---

## Migration Checklist

- [ ] ✅ Created Supabase account
- [ ] ✅ Created new project
- [ ] ✅ Copied database connection string
- [ ] ✅ Copied API keys
- [ ] ✅ Updated `.env.local`
- [ ] ✅ Tested database connection
- [ ] ✅ Ran migrations
- [ ] ✅ Verified tables in Supabase
- [ ] ✅ (Optional) Created storage bucket
- [ ] ✅ (Optional) Set storage policies
- [ ] ✅ Tested local development
- [ ] ✅ Tested API endpoints
- [ ] ✅ Changed default admin password
- [ ] ✅ Ready for production deployment!

---

## Rollback Plan

If you need to switch back to local PostgreSQL:

1. **Comment out Supabase config in `.env.local`:**
```bash
# DATABASE_URL=postgresql://...
# SUPABASE_URL=...
# SUPABASE_SERVICE_KEY=...
```

2. **Uncomment local PostgreSQL config:**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=skylens_db
DB_USER=postgres
DB_PASSWORD=postgres
```

3. **Change storage back to local:**
```bash
STORAGE_PROVIDER=local
```

4. **Restart local services:**
```bash
docker-compose up -d
npm run dev:backend
```

---

## Next Steps

✅ **Your database is now production-ready!**

Recommended actions:
1. **Change default admin password** (in the app or Supabase dashboard)
2. **Set up backups** (automatic on Supabase)
3. **Monitor usage** in Supabase dashboard
4. **Set up custom domain** (if deploying)
5. **Review security** in deployment readiness report

---

## Supabase Features You Can Use

Now that you're on Supabase, you have access to:

- ✅ **Database** - Managed PostgreSQL (done!)
- ✅ **Storage** - File storage (images, PDFs)
- 🔄 **Realtime** - Database subscriptions (can replace Socket.io)
- 🔒 **Auth** - Built-in authentication (optional upgrade from JWT)
- ⚡ **Edge Functions** - Serverless functions
- 📊 **Dashboard** - Visual database management
- 🔍 **Logs** - Real-time logging
- 📈 **Analytics** - Usage metrics

---

## Support

- **Supabase Docs:** [https://supabase.com/docs](https://supabase.com/docs)
- **Supabase Discord:** [https://discord.supabase.com](https://discord.supabase.com)
- **SkyLens Issues:** Check deployment_readiness_report.md

---

**Congratulations! 🎉** Your SkyLens AI platform is now using Supabase managed database!
