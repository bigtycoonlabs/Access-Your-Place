FROM postgrest/postgrest:latest

# Ensure UID 1000 has a passwd entry so libpq can resolve the local user ID.
# Without this, PostgREST fails with "could not look up local user ID 1000: Permission denied".
RUN echo "postgrest:x:1000:1000:postgrest:/home/postgrest:/bin/sh" >> /etc/passwd

# PostgREST is configured entirely via environment variables — no extra build steps needed.
# Set these in Railway:
#   PGRST_DB_URI         = postgres://user:pass@host:5432/dbname (Railway Postgres URL)
#   PGRST_DB_SCHEMA      = public
#   PGRST_DB_ANON_ROLE   = anon
#   PGRST_JWT_SECRET     = (from generate-jwt-secrets.js)
#   PGRST_SERVER_PORT    = 3000
