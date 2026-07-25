#!/bin/sh
# nginx-entrypoint.sh
# If no custom certs are mounted (empty volume), copy the built-in
# placeholder certs so nginx can start with HTTPS enabled.
if [ ! -f /etc/nginx/certs/cert.pem ] || [ ! -f /etc/nginx/certs/cert-key.pem ]; then
    mkdir -p /etc/nginx/certs
    cp /etc/nginx/certs-placeholder/cert.pem /etc/nginx/certs/cert.pem
    cp /etc/nginx/certs-placeholder/cert-key.pem /etc/nginx/certs/cert-key.pem
fi
