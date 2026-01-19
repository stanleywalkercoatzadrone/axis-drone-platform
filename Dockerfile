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

# Copy backend code
COPY backend ./backend
COPY geminiService.ts ./
COPY types.ts ./

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads

# Expose ports
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start backend server
CMD ["node", "backend/server.js"]
