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

ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN npm run build

# ── Stage 2: Express backend (serves everything) ──────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

ARG CACHE_BUST=1783443078
COPY backend/ .

# Patch full legacy server.js for Railway PostgREST root URLs and current frontend payloads.
COPY <<'PATCH' /tmp/patch-server.cjs
const fs = require('fs');
const file = 'server.js';
let source = fs.readFileSync(file, 'utf8');

const dbOld = "async function db(path, opts = {}) {\n  const url = `${SUPABASE_URL}/rest/v1${path}`;";
const dbNew = "function buildDbUrl(path) {\n  const base = (process.env.POSTGREST_URL || SUPABASE_URL || '').replace(/\\/+$/, '');\n  if (!base) throw new Error('POSTGREST_URL or SUPABASE_URL is not configured');\n  const cleanPath = path.startsWith('/') ? path : '/' + path;\n  const restPrefix = /supabase\\.co/i.test(base) && !/\\/rest\\/v1$/i.test(base) ? '/rest/v1' : '';\n  return base + restPrefix + cleanPath;\n}\n\nasync function db(path, opts = {}) {\n  const url = buildDbUrl(path);";

if (source.includes(dbOld)) {
  source = source.replace(dbOld, dbNew);
  console.log('Patched DB URL handling');
} else {
  console.log('DB URL patch skipped');
}

const registerOld = "if (action === 'register') {";
const registerNew = "if (action === 'register' || fn === 'investor-register') {";
if (source.includes(registerOld)) {
  source = source.replace(registerOld, registerNew);
  console.log('Patched investor-register action handling');
} else {
  console.log('investor-register patch skipped');
}

fs.writeFileSync(file, source, 'utf8');
PATCH
RUN node /tmp/patch-server.cjs
RUN node -c server.js

COPY --from=frontend /frontend/dist ./dist

EXPOSE 4000

CMD ["node", "server.js"]
