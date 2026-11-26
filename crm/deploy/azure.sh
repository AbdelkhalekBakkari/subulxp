#!/usr/bin/env bash
# Déploiement du CRM Subul XP sur Azure Container Apps, dans un NOUVEAU resource group.
# À lancer dans Azure Cloud Shell (bash) : https://shell.azure.com
#
#   SCRIPT=https://raw.githubusercontent.com/AbdelkhalekBakkari/subulxp/main/crm/deploy/azure.sh
#   bash <(curl -fsSL $SCRIPT) deploy          # 1) crée tout et affiche les enregistrements DNS à créer
#   bash <(curl -fsSL $SCRIPT) bind-domain     # 2) après propagation DNS : certificat HTTPS géré par Azure
#   bash <(curl -fsSL $SCRIPT) status          # URL, réplicas, logs récents
#   bash <(curl -fsSL $SCRIPT) backup          # télécharge la base SQLite (crm-AAAA-MM-JJ.db)
#   bash <(curl -fsSL $SCRIPT) update          # redéploie la dernière image ghcr.io
#
# Variables facultatives : RG, LOCATION, ENV_NAME, APP, CRM_DOMAIN, IMAGE, ADMIN_EMAIL, ADMIN_PASSWORD,
#                          GHCR_USER + GHCR_TOKEN (seulement si l'image ghcr.io est privée).
set -euo pipefail

RG="${RG:-rg-subulxp-crm}"
LOCATION="${LOCATION:-francecentral}"
ENV_NAME="${ENV_NAME:-cae-subulxp-crm}"
APP="${APP:-subulxp-crm}"
DOMAIN="${CRM_DOMAIN:-crm.smartovate.com}"
IMAGE="${IMAGE:-ghcr.io/abdelkhalekbakkari/subulxp-crm:latest}"
SHARE="crmdata"
STORAGE_NAME="crmdata"

log() { printf '\n\033[1;35m[crm]\033[0m %s\n' "$*"; }
die() { echo "Erreur : $*" >&2; exit 1; }

command -v az >/dev/null 2>&1 || die "Azure CLI introuvable. Utilisez Azure Cloud Shell : https://shell.azure.com"
az account show >/dev/null 2>&1 || die "Connectez-vous d'abord : az login"
SUB_ID="$(az account show --query id -o tsv)"
# Nom de compte de stockage déterministe (3-24 caractères, minuscules et chiffres)
STORAGE="st$(printf '%s' "${SUB_ID}${RG}" | sha1sum | cut -c1-18)"

cmd_deploy() {
  log "Abonnement : $(az account show --query name -o tsv) · resource group : ${RG} (${LOCATION})"
  az extension add --name containerapp --upgrade --only-show-errors >/dev/null
  log "Enregistrement des fournisseurs de ressources (nécessaire sur un abonnement neuf)"
  for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.Storage; do
    az provider register --namespace "$ns" --wait >/dev/null
  done

  ADMIN_EMAIL="${ADMIN_EMAIL:-}"
  while [ -z "${ADMIN_EMAIL}" ]; do read -rp "Email de l'admin initial du CRM : " ADMIN_EMAIL; done
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
  GENERATED=0
  if [ -z "${ADMIN_PASSWORD}" ]; then ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)a1"; GENERATED=1; fi
  SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n')"

  log "Resource group"
  az group create -n "${RG}" -l "${LOCATION}" -o none

  log "Environnement Container Apps (consommation, échelle à zéro)"
  az containerapp env show -n "${ENV_NAME}" -g "${RG}" -o none 2>/dev/null \
    || az containerapp env create -n "${ENV_NAME}" -g "${RG}" -l "${LOCATION}" -o none

  log "Compte de stockage et partage Azure Files pour la base SQLite"
  az storage account show -n "${STORAGE}" -g "${RG}" -o none 2>/dev/null \
    || az storage account create -n "${STORAGE}" -g "${RG}" -l "${LOCATION}" --sku Standard_LRS --kind StorageV2 \
         --min-tls-version TLS1_2 --allow-blob-public-access false -o none
  az storage share-rm create --storage-account "${STORAGE}" -g "${RG}" -n "${SHARE}" --quota 5 -o none
  KEY="$(az storage account keys list -n "${STORAGE}" -g "${RG}" --query '[0].value' -o tsv)"
  az containerapp env storage set -n "${ENV_NAME}" -g "${RG}" --storage-name "${STORAGE_NAME}" \
    --azure-file-account-name "${STORAGE}" --azure-file-account-key "${KEY}" \
    --azure-file-share-name "${SHARE}" --access-mode ReadWrite -o none

  ENV_ID="$(az containerapp env show -n "${ENV_NAME}" -g "${RG}" --query id -o tsv)"
  REGISTRIES="[]"
  EXTRA_SECRETS=""
  if [ -n "${GHCR_TOKEN:-}" ]; then
    EXTRA_SECRETS="      - name: ghcr-token
        value: \"${GHCR_TOKEN}\""
    REGISTRIES="
      - server: ghcr.io
        username: \"${GHCR_USER:-AbdelkhalekBakkari}\"
        passwordSecretRef: ghcr-token"
  fi

  TMP="$(mktemp)"
  cat > "${TMP}" <<YAML
location: ${LOCATION}
name: ${APP}
resourceGroup: ${RG}
type: Microsoft.App/containerApps
properties:
  managedEnvironmentId: ${ENV_ID}
  configuration:
    activeRevisionsMode: Single
    ingress:
      external: true
      targetPort: 3000
      transport: auto
      allowInsecure: false
    secrets:
      - name: session-secret
        value: "${SESSION_SECRET}"
      - name: admin-password
        value: "${ADMIN_PASSWORD}"
${EXTRA_SECRETS}
    registries: ${REGISTRIES}
  template:
    containers:
      - name: crm
        image: ${IMAGE}
        resources:
          cpu: 0.25
          memory: 0.5Gi
        env:
          - name: PORT
            value: "3000"
          - name: NODE_ENV
            value: production
          - name: DATABASE_PATH
            value: /data/crm.db
          - name: SQLITE_JOURNAL_MODE
            value: DELETE
          - name: TRUST_PROXY
            value: "true"
          - name: INTAKE_ALLOWED_ORIGINS
            value: https://xp.subul.uk
          - name: ADMIN_EMAIL
            value: "${ADMIN_EMAIL}"
          - name: ADMIN_NAME
            value: Administrateur
          - name: SESSION_SECRET
            secretRef: session-secret
          - name: ADMIN_PASSWORD
            secretRef: admin-password
        volumeMounts:
          - volumeName: data
            mountPath: /data
    scale:
      minReplicas: 0
      maxReplicas: 1
    volumes:
      - name: data
        storageType: AzureFile
        storageName: ${STORAGE_NAME}
        mountOptions: "dir_mode=0777,file_mode=0777,uid=1000,gid=1000,nobrl,cache=none"
YAML

  log "Container App ${APP} (image ${IMAGE})"
  if az containerapp show -n "${APP}" -g "${RG}" -o none 2>/dev/null; then
    az containerapp update -n "${APP}" -g "${RG}" --yaml "${TMP}" -o none
  else
    az containerapp create -n "${APP}" -g "${RG}" --yaml "${TMP}" -o none
  fi
  rm -f "${TMP}"

  FQDN="$(az containerapp show -n "${APP}" -g "${RG}" --query properties.configuration.ingress.fqdn -o tsv)"
  VERIFY="$(az containerapp env show -n "${ENV_NAME}" -g "${RG}" --query properties.customDomainConfiguration.customDomainVerificationId -o tsv)"

  log "Déployé. URL provisoire : https://${FQDN}"
  if [ "${GENERATED}" = "1" ]; then
    echo "Compte admin : ${ADMIN_EMAIL}"
    echo "Mot de passe généré : ${ADMIN_PASSWORD}   (à changer dans Mon profil après la première connexion)"
  fi
  cat <<DNS

Enregistrements DNS à créer pour ${DOMAIN} :
  CNAME   crm          ->  ${FQDN}
  TXT     asuid.crm    ->  ${VERIFY}

Puis, une fois propagés (dig +short ${DOMAIN}) :
  bash <(curl -fsSL https://raw.githubusercontent.com/AbdelkhalekBakkari/subulxp/main/crm/deploy/azure.sh) bind-domain
DNS
}

cmd_bind_domain() {
  log "Ajout du domaine ${DOMAIN} et certificat géré"
  az containerapp hostname add -n "${APP}" -g "${RG}" --hostname "${DOMAIN}" -o none 2>/dev/null || true
  az containerapp hostname bind -n "${APP}" -g "${RG}" --hostname "${DOMAIN}" --environment "${ENV_NAME}" --validation-method CNAME -o none
  log "Certificat en cours d'émission (quelques minutes). Ensuite : https://${DOMAIN}"
}

cmd_status() {
  az containerapp show -n "${APP}" -g "${RG}" --query "{url:properties.configuration.ingress.fqdn, status:properties.runningStatus, image:properties.template.containers[0].image, domaines:properties.configuration.ingress.customDomains[].name}" -o table
  az containerapp logs show -n "${APP}" -g "${RG}" --tail 30 2>/dev/null || true
}

cmd_backup() {
  OUT="crm-$(date +%F).db"
  KEY="$(az storage account keys list -n "${STORAGE}" -g "${RG}" --query '[0].value' -o tsv)"
  az storage file download --account-name "${STORAGE}" --account-key "${KEY}" --share-name "${SHARE}" -p crm.db --dest "${OUT}" -o none
  echo "Sauvegarde : ${OUT}"
}

cmd_update() {
  az containerapp update -n "${APP}" -g "${RG}" --image "${IMAGE}" -o none
  az containerapp revision restart -n "${APP}" -g "${RG}" --revision "$(az containerapp revision list -n "${APP}" -g "${RG}" --query '[0].name' -o tsv)" -o none 2>/dev/null || true
  log "Image mise à jour."
}

case "${1:-}" in
  deploy) cmd_deploy ;;
  bind-domain) cmd_bind_domain ;;
  status) cmd_status ;;
  backup) cmd_backup ;;
  update) cmd_update ;;
  *) echo "Usage : $0 deploy | bind-domain | status | backup | update"; exit 1 ;;
esac
