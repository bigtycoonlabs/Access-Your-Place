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

# Patch full legacy server.js for Railway PostgREST root URLs and current frontend payloads.
RUN node -e 'const fs=require("fs");const f="server.js";let s=fs.readFileSync(f,"utf8");const old="async function db(path, opts = {}) {\n  const url = `${SUPABASE_URL}/rest/v1${path}`;";const helper="function buildDbUrl(path) {\n  const base = (process.env.POSTGREST_URL || SUPABASE_URL || \"\").replace(/\\/+$/, \"\");\n  if (!base) throw new Error(\"POSTGREST_URL or SUPABASE_URL is not configured\");\n  const cleanPath = path.startsWith(\"/\") ? path : \"/\" + path;\n  const restPrefix = /supabase\\.co/i.test(base) && !/\\/rest\\/v1$/i.test(base) ? \"/rest/v1\" : \"\";\n  return base + restPrefix + cleanPath;\n}\n\nasync function db(path, opts = {}) {\n  const url = buildDbUrl(path);";if(s.includes(old)){s=s.replace(old,helper);console.log("Patched DB URL handling");}else{console.log("DB URL patch skipped");}const oldRegister="if (action === 'register') {";const newRegister="if (action === 'register' || fn === 'investor-register') {";if(s.includes(oldRegister)){s=s.replace(oldRegister,newRegister);console.log("Patched investor-register action handling");}fs.writeFileSync(f,s,"utf8");'
RUN node -c server.js

# Copy built frontend into dist/ (backend serves it as static files)
COPY --from=frontend /frontend/dist ./dist

EXPOSE 4000

CMD ["node", "server.js"]
