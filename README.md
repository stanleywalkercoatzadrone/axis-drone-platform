# Axis by CoatzadroneUSA - Enterprise Drone Inspection Platform

A production-ready, full-stack platform for AI-powered drone inspection analysis with enterprise-grade features.

## 🚀 Features

- **AI-Powered Analysis**: Gemini 2.0 integration for automated defect detection
- **Enterprise RBAC**: Role-based access control with granular permissions
- **Dual-Vault Sync**: Automatic synchronization to user and master archives
- **Real-time Updates**: Socket.io for live collaboration and progress tracking
- **Audit Logging**: Comprehensive system event tracking
- **Multi-Industry Support**: Solar, Utilities, Insurance, Telecom, Construction

## 📋 Prerequisites

### Required
- Node.js 20+
- Redis 7+ (or managed Redis service)

### Database Options

**Option 1: Supabase (Recommended for Production)**
- Free managed PostgreSQL database
- No local setup required
- Built-in backups and monitoring
- **Follow:** [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)

**Option 2: Local PostgreSQL (Development)**
- PostgreSQL 16+
- Docker (for easy setup)

**Storage Options:** Local filesystem, AWS S3, or Supabase Storage

## 🛠️ Installation

### Quick Start with Supabase (Recommended)

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Follow the complete guide: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
   - Or quick setup:
     1. Create account at [supabase.com](https://supabase.com)
     2. Create new project
     3. Copy connection string and API keys
     4. Update `.env.local` (see step 3 below)

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add:
   # - DATABASE_URL (from Supabase)
   # - SUPABASE_URL, SUPABASE_SERVICE_KEY (from Supabase)
   # - API_KEY (Gemini API key)
   # - JWT_SECRET (generate a strong secret)
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Start Redis (local):**
   ```bash
   docker-compose up redis -d
   # Or use a managed Redis service (Redis Cloud, Upstash, etc.)
   ```

6. **Start development servers:**
   ```bash
   # Start both frontend and backend
   npm run dev:all

   # Or separately:
   npm run dev          # Frontend only (port 3000)
   npm run dev:backend  # Backend only (port 8080)
   ```

---

### Alternative: Local Development (PostgreSQL + Redis)

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start PostgreSQL and Redis:**
   ```bash
   # Using Docker
   docker-compose up postgres redis -d
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Start development servers:**
   ```bash
   npm run dev:all
   ```

### Docker Deployment

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:8080/api
   - Health Check: http://localhost:8080/health

## 📁 Project Structure

```
skylens-ai/
├── backend/
│   ├── config/          # Database & Redis configuration
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, error handling
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── sockets/         # WebSocket handlers
│   ├── migrations/      # Database migrations
│   └── server.js        # Express server
├── src/
│   ├── components/      # React components
│   ├── services/        # API client services
│   └── types.ts         # TypeScript definitions
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 🔑 Admin Access

No default production password is provided. Create or reset an admin account with a strong one-time password through the secured admin tooling and rotate it after first login.

## 🌐 API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Reports
- `GET /api/reports` - List reports
- `POST /api/reports` - Create report
- `PUT /api/reports/:id` - Update report
- `POST /api/reports/:id/finalize` - Finalize report

### Images
- `POST /api/images/upload` - Upload image
- `POST /api/images/:id/analyze` - AI analysis
- `PUT /api/images/:id/annotations` - Update annotations

### Sync
- `POST /api/sync/vault` - Sync to dual vaults
- `GET /api/sync/logs/:reportId` - Get sync logs

### Admin
- `GET /api/users` - List users (Admin only)
- `POST /api/users/batch` - Batch import users
- `GET /api/audit` - Audit logs (Admin/Auditor)

## 🔧 Environment Variables

See `.env.example` for all available configuration options.

**Required:**
- `API_KEY` - Gemini API key
- `JWT_SECRET` - JWT signing secret
- `DB_*` - PostgreSQL connection details

**Optional:**
- `USE_S3=true` - Enable AWS S3 storage
- `AWS_*` - AWS credentials for S3
- `PIX4D_CLIENT_ID` / `PIX4D_CLIENT_SECRET` - Enable Pix4D Cloud processing dispatch for completed aerial upload jobs

## 🚢 Production Deployment

### Using Docker

```bash
# Build production image
docker build -t skylens-ai:latest .

# Run with environment variables
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  -e REDIS_URL=your-redis-url \
  skylens-ai:latest
```

### Manual Deployment

```bash
# Build frontend
npm run build

# Start backend
NODE_ENV=production npm run start:backend
```

## 📊 Database Schema

The platform uses PostgreSQL with the following main tables:
- `users` - User accounts and permissions
- `reports` - Inspection reports
- `images` - Uploaded images and annotations
- `sync_logs` - Vault synchronization history
- `audit_logs` - System audit trail

## 🔒 Security

- JWT-based authentication with refresh tokens
- Password hashing with bcrypt
- RBAC with granular permissions
- CORS protection
- Helmet.js security headers
- Rate limiting (recommended for production)

## 📝 License

Proprietary - Axis by CoatzadroneUSA

## 🤝 Support

For issues and questions, contact: support@coatzadroneusa.com
