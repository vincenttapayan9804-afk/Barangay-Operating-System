# Coraza WAF (Security Phase 4) — a custom Caddy build with the
# coraza-caddy module (OWASP Coraza engine + Core Rule Set), sitting in
# front of the `frontend` container. This image is now the stack's actual
# public entry point (ports 8080/8443, moved here from `frontend` — see
# ../supabase/docker-compose.yml): it terminates TLS and screens every
# request against the CRS before proxying whatever passes to
# `frontend`:80, which still reverse-proxies /auth|rest|realtime|
# functions/v1/* to Kong exactly as it did before this phase.
#
# Builder and final stage both use the Debian-based (non-alpine) Caddy
# image so the xcaddy-built binary's libc matches the runtime image.
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/corazawaf/coraza-caddy/v2

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY entrypoint.sh /entrypoint.sh

# Self-signed placeholder TLS cert — same pattern as frontend/Dockerfile —
# so this container can start with HTTPS enabled even before real certs
# are mounted. Overridden at runtime by the same backend/certs/ volume the
# frontend container already uses (see docs/DEPLOYMENT.md's mkcert steps).
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl wget && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /etc/caddy/certs-placeholder && \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/caddy/certs-placeholder/cert-key.pem \
      -out /etc/caddy/certs-placeholder/cert.pem \
      -subj "/C=PH/O=BarangayOS/CN=localhost" && \
    chmod +x /entrypoint.sh

EXPOSE 80 443
ENTRYPOINT ["/entrypoint.sh"]
