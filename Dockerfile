# ╔══════════════════════════════════════════════════════════════╗
# ║  Access Your Place — All-in-One Railway Dockerfile           ║
# ║  Stage 1: Build Vite/React frontend                          ║
# ║  Stage 2: Express backend (serves frontend + API proxy)      ║
# ╚══════════════════════════════════════════════════════════════╝

# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /frontend

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# VITE_SUPABASE_ANON_KEY is baked into the bundle at build time
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

# VITE_SUPABASE_URL is NOT set here intentionally — the frontend uses
# window.location.origin as the default, so it automatically targets
# whichever domain it's served from (Railway URL or accessyourplace.com).
RUN npm run build

# ── Stage 2: Express backend (serves everything) ──────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/ .

# Copy built frontend into dist/ (backend serves it as static files)
COPY --from=frontend /frontend/dist ./dist

EXPOSE 4000

CMD ["node", "server.js"]
