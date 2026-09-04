# -----------------------------------------------------------
# Stage 1: Build Frontend (React + Vite)
# -----------------------------------------------------------
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# -----------------------------------------------------------
# Stage 2: Production Runner (Node.js + Python + yt-dlp + FFmpeg)
# -----------------------------------------------------------
FROM node:20-bookworm-slim AS runner

# Install system packages (Python, FFmpeg, Curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install standalone yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install server production dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy server code
COPY server/ ./server/

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

WORKDIR /app/server
CMD ["node", "index.js"]
