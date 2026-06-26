FROM postgrest/postgrest:v12.2.0

# PostgREST v12 runs fine as root in Railway containers.
# All configuration via environment variables:
#   PGRST_DB_URI         - full postgres connection string
#   PGRST_DB_SCHEMA      - public
#   PGRST_DB_ANON_ROLE   - anon
#   PGRST_SERVER_PORT    - 3000
#   PGRST_JWT_SECRET     - your JWT secret

ENTRYPOINT ["/bin/postgrest"]
