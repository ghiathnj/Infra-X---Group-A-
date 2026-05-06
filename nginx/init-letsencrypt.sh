#!/usr/bin/env bash
# One-time bootstrap that obtains the first Let's Encrypt certificate.
#
# Why this is needed: nginx fails to start without a certificate file at
# /etc/letsencrypt/live/<domain>/{fullchain,privkey}.pem. Certbot can only
# obtain that certificate once nginx is running and serving the ACME
# HTTP-01 challenge. Chicken and egg.
#
# This script breaks the cycle:
#   1. Place a self-signed dummy certificate so nginx can start.
#   2. Start nginx.
#   3. Delete the dummy and request a real certificate via certbot.
#   4. Reload nginx so it picks up the real cert.
#
# Run this ONCE on the production server, in the directory where
# docker-compose.prod.yml lives. After it completes successfully, the
# certbot sidecar in the compose file keeps the cert renewed automatically;
# you should never need to run this script again unless certs are wiped.
#
# Adapted from the well-known nginx-certbot recipe by @wmnnd.

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────
DOMAIN="dev.praxis-form.de"
EMAIL=""           # leave empty for --register-unsafely-without-email
STAGING=0          # set to 1 to use Let's Encrypt staging (untrusted certs,
                   # but no rate limit hits) while iterating on the setup
RSA_KEY_SIZE=4096
DATA_DIR="./certbot"
COMPOSE_FILE="docker-compose.prod.yml"
COMPOSE="docker compose -f ${COMPOSE_FILE}"

# ─── Sanity checks ────────────────────────────────────────────────────────
if ! command -v docker >/dev/null; then
    echo "ERROR: docker not on PATH." >&2
    exit 1
fi
if ! [[ -f "$COMPOSE_FILE" ]]; then
    echo "ERROR: ${COMPOSE_FILE} not in current directory." >&2
    echo "       cd into ~/team-a (or wherever you keep the prod compose) and re-run." >&2
    exit 1
fi

mkdir -p "$DATA_DIR/conf/live/$DOMAIN" "$DATA_DIR/www"

# ─── 1. Recommended TLS parameters ────────────────────────────────────────
if [[ ! -f "$DATA_DIR/conf/options-ssl-nginx.conf" ]] || \
   [[ ! -f "$DATA_DIR/conf/ssl-dhparams.pem"     ]]; then
    echo "[1/5] Downloading recommended TLS parameters …"
    curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
         -o "$DATA_DIR/conf/options-ssl-nginx.conf"
    curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
         -o "$DATA_DIR/conf/ssl-dhparams.pem"
else
    echo "[1/5] Recommended TLS parameters already present — skipping."
fi

# ─── 2. Dummy self-signed certificate so nginx can boot ───────────────────
echo "[2/5] Creating dummy self-signed certificate for ${DOMAIN} …"
$COMPOSE run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '/etc/letsencrypt/live/$DOMAIN/privkey.pem' \
    -out    '/etc/letsencrypt/live/$DOMAIN/fullchain.pem' \
    -subj   '/CN=$DOMAIN'" certbot

# ─── 3. Bring nginx up so it can serve the ACME challenge ─────────────────
echo "[3/5] Starting nginx with the dummy certificate …"
$COMPOSE up --force-recreate -d nginx

# ─── 4. Replace dummy with a real Let's Encrypt cert ──────────────────────
echo "[4/5] Removing dummy certificate, requesting real one …"
$COMPOSE run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$DOMAIN \
         /etc/letsencrypt/archive/$DOMAIN \
         /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

EMAIL_ARG=$([[ -z "$EMAIL" ]] && echo "--register-unsafely-without-email" || echo "--email $EMAIL")
STAGING_ARG=$([[ "$STAGING" == "1" ]] && echo "--staging" || echo "")

$COMPOSE run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    $EMAIL_ARG \
    -d $DOMAIN \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --force-renewal" certbot

# ─── 5. Reload nginx so it picks up the real cert ─────────────────────────
echo "[5/5] Reloading nginx with the real certificate …"
$COMPOSE exec nginx nginx -s reload

echo ""
echo "✓ Done. https://${DOMAIN} should now serve a valid Let's Encrypt cert."
echo "  The certbot sidecar will auto-renew; no further action required."
