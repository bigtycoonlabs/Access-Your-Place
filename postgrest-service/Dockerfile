FROM postgrest/postgrest:latest AS postgrest

FROM debian:bookworm-slim
COPY --from=postgrest /bin/postgrest /bin/postgrest

# Now we have a real shell — add the user entry libpq needs
RUN echo "postgrest:x:1000:1000:postgrest:/home/postgrest:/bin/sh" >> /etc/passwd && \
    mkdir -p /home/postgrest && \
    chown 1000:1000 /home/postgrest

USER 1000
ENTRYPOINT ["/bin/postgrest"]
