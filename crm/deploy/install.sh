#!/usr/bin/env bash
# Installation du CRM Subul XP sur un VPS Ubuntu/Debian vierge (exécuter en root ou avec sudo).
#   curl -fsSL https://raw.githubusercontent.com/AbdelkhalekBakkari/subulxp/main/crm/deploy/install.sh | sudo bash
# Variables facultatives : CRM_DOMAIN (crm.smartovate.com), ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, APP_DIR (/opt/subulxp)
set -euo pipefail

CRM_DOMAIN="${CRM_DOMAIN:-crm.smartovate.com}"
APP_DIR="${APP_DIR:-/opt/subulxp}"
REPO="${REPO:-https://github.com/AbdelkhalekBakkari/subulxp.git}"

log() { printf '\n\033[1;35m[crm]\033[0m %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then echo "Lancez ce script en root (sudo)." >&2; exit 1; fi

log "Installation de Docker et git"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null 2>&1 || apt-get install -y git
systemctl enable --now docker

log "Récupération du code dans ${APP_DIR}"
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" pull --ff-only
else
  git clone "${REPO}" "${APP_DIR}"
fi
cd "${APP_DIR}/crm"

if [ ! -f .env ]; then
  log "Création du fichier .env"
  ADMIN_EMAIL="${ADMIN_EMAIL:-}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
  if [ -z "${ADMIN_EMAIL}" ] && [ -t 0 ]; then read -rp "Email de l'admin initial : " ADMIN_EMAIL; fi
  if [ -z "${ADMIN_PASSWORD}" ]; then
    ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)a1"
    GENERATED_PASSWORD=1
  fi
  cat > .env <<ENV
PORT=3000
DATABASE_PATH=/data/crm.db
TRUST_PROXY=true
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
SESSION_HOURS=12
INTAKE_ALLOWED_ORIGINS=https://xp.subul.uk
CRM_DOMAIN=${CRM_DOMAIN}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_NAME=${ADMIN_NAME:-Administrateur}
ENV
  chmod 600 .env
fi

log "Ouverture des ports 80/443 (ufw, si présent)"
if command -v ufw >/dev/null 2>&1; then ufw allow 80/tcp >/dev/null || true; ufw allow 443/tcp >/dev/null || true; fi

log "Démarrage (build + Caddy avec certificat Let's Encrypt)"
docker compose up -d --build

log "Terminé. Le CRM sera disponible sur https://${CRM_DOMAIN} dès que le DNS pointe vers ce serveur."
if [ "${GENERATED_PASSWORD:-0}" = "1" ]; then
  echo "Compte admin : ${ADMIN_EMAIL:-<ADMIN_EMAIL non défini, lancez: docker compose exec crm npm run seed -- --email ... --password ...>}"
  echo "Mot de passe généré : ${ADMIN_PASSWORD}   (changez-le dans Mon profil après la première connexion)"
fi
echo "Logs : docker compose -f ${APP_DIR}/crm/docker-compose.yml logs -f"
