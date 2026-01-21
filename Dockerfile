# Multi-stage Dockerfile for SkyLens AI Platform

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend code (JavaScript only)
COPY backend ./backend

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 8080

# Set environment variable for Cloud Run
ENV PORT=8080
ENV NODE_ENV=production

# BUILD-TIME VERIFICATION GATE (MANDATORY)
# Verify runtime entrypoint exists before image creation
RUN test -f backend/server.js || (echo "ERROR: Runtime entrypoint backend/server.js not found" && exit 1)
RUN node -c backend/server.js || (echo "ERROR: Runtime entrypoint has syntax errors" && exit 1)

# Health check using wget (simpler and more reliable)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start backend server (verified entrypoint)
CMD ["node", "backend/server.js"]
