#!/usr/bin/env bash
# Mise à jour du CRM déjà installé : récupère main, reconstruit et redémarre sans perdre la base.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/subulxp}"
git -C "${APP_DIR}" pull --ff-only
cd "${APP_DIR}/crm"
docker compose up -d --build
docker image prune -f >/dev/null
echo "CRM mis à jour."
