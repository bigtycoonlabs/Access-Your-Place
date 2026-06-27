FROM postgrest/postgrest:v12.2.0 AS builder

FROM debian:bookworm-slim

COPY --from=builder /bin/postgrest /bin/postgrest

RUN echo "postgrest:x:1000:1000:postgrest:/home/postgrest:/bin/sh" >> /etc/passwd \
    && mkdir -p /home/postgrest && chown 1000:1000 /home/postgrest

USER 1000

ENTRYPOINT ["sh", "-c", "PGRST_SERVER_PORT=${PORT:-3000} exec /bin/postgrest"]
