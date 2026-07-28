#!/bin/sh
# Mirrors frontend/nginx-entrypoint.sh: if no custom certs are mounted
# (empty ../certs volume), fall back to the built-in self-signed
# placeholder so Caddy can still start with HTTPS enabled.
set -e
if [ ! -f /etc/caddy/certs/cert.pem ] || [ ! -f /etc/caddy/certs/cert-key.pem ]; then
    mkdir -p /etc/caddy/certs
    cp /etc/caddy/certs-placeholder/cert.pem /etc/caddy/certs/cert.pem
    cp /etc/caddy/certs-placeholder/cert-key.pem /etc/caddy/certs/cert-key.pem
fi
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
