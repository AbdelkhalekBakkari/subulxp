# CRM Subul XP

CRM interne de la résidence technique Subul XP : étudiants (niveau, email, WhatsApp, statut, domaines), sujets,
séances et présences, partagé entre l'admin global, les project managers et les encadrants industriels.
Conception détaillée : [docs/DESIGN.md](docs/DESIGN.md).

## Démarrage local

```bash
cd crm
npm install
cp .env.example .env            # puis renseigner SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run seed:demo               # (optionnel) données de démonstration, mot de passe Demo12345!
npm start                       # http://localhost:3000
```

Sans `ADMIN_EMAIL`/`ADMIN_PASSWORD`, créez le premier compte :

```bash
npm run seed -- --email admin@smartovate.com --password 'MotDePasse123' --name "Admin"
```

Tests :

```bash
npm test
```

## Déploiement sur crm.smartovate.com

### Installation en une commande (VPS Ubuntu/Debian vierge)

```bash
curl -fsSL https://raw.githubusercontent.com/AbdelkhalekBakkari/subulxp/main/crm/deploy/install.sh | sudo ADMIN_EMAIL=admin@smartovate.com bash
```

Le script installe Docker, clone le dépôt dans `/opt/subulxp`, génère `.env` (secret de session et mot de passe admin
aléatoires, affichés en fin d'installation) et lance Caddy + le CRM. Mise à jour ultérieure : `sudo /opt/subulxp/crm/deploy/update.sh`.

### Installation manuelle

1. Créer l'enregistrement DNS `A` (ou `AAAA`) `crm.smartovate.com` vers le serveur.
2. Sur le serveur (Docker + Compose installés) :

```bash
git clone https://github.com/AbdelkhalekBakkari/subulxp.git && cd subulxp/crm
cp .env.example .env
```

3. Dans `.env`, définir au minimum `SESSION_SECRET` (32+ caractères aléatoires, `openssl rand -base64 48`),
   `ADMIN_EMAIL`, `ADMIN_PASSWORD` et, si besoin, `CRM_DOMAIN`.
4. Lancer :

```bash
docker compose up -d --build
```

Caddy obtient automatiquement le certificat Let's Encrypt et proxifie vers l'application. La base SQLite est dans le volume `crm-data`
(sauvegarde : `docker compose cp crm:/data/crm.db ./backup-$(date +%F).db`).

Ensuite, l'admin crée les comptes des project managers et des encadrants dans **Utilisateurs** ; un mot de passe est généré
s'il n'est pas fourni, et chacun peut le changer dans **Mon profil**.

## Brancher le formulaire landing (xp.subul.uk)

Dans **Paramètres**, copier l'URL d'intégration et la coller dans la constante `ENDPOINT` du `index.html` de la landing :

```js
const ENDPOINT = "https://crm.smartovate.com/api/public/leads?key=…";
```

Chaque demande crée alors automatiquement un lead (« Nouveau lead », source « Formulaire landing ») avec prénom, nom, email,
WhatsApp, statut, niveau et domaines, tout en continuant à ouvrir WhatsApp pour le candidat.

## Variables d'environnement

| Variable | Description |
|---|---|
| `PORT` | port HTTP (3000) |
| `DATABASE_PATH` | fichier SQLite |
| `SESSION_SECRET` | secret de signature des cookies (obligatoire en production) |
| `SESSION_HOURS` | durée de session (12) |
| `TRUST_PROXY` | `true` derrière Caddy/Nginx (cookies Secure) |
| `INTAKE_ALLOWED_ORIGINS` | origines CORS autorisées pour `/api/public/leads` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | compte admin créé au premier démarrage si la base est vide |

## API (résumé)

Toutes les routes sous `/api` exigent une session (cookie) et l'en-tête `X-Requested-With: XMLHttpRequest` sur les mutations.

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password`
- `GET /dashboard`, `GET /meta`
- `GET|POST /users`, `PATCH /users/:id`, `GET /users/directory` (admin, sauf directory)
- `GET|POST /students`, `GET|PATCH|DELETE /students/:id`, `POST /students/:id/archive`, `POST /students/:id/activities`, `GET /students/export.csv`, `POST /students/import`
- `GET|POST /subjects`, `GET|PATCH|DELETE /subjects/:id`, `POST|DELETE /subjects/:id/students[/:sid]`
- `GET|POST /sessions`, `GET|PATCH|DELETE /sessions/:id`, `PUT /sessions/:id/attendance`, `DELETE /sessions/:id/attendance/:sid`
- `GET /audit`, `GET /settings`, `POST /settings/intake-key/rotate` (admin)
- `POST /public/leads` (clé d'intégration, sans session)
