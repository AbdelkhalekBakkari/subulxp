# CRM Subul XP — conception

## Objectif
Suivre les étudiants de la résidence technique Subul XP (niveau, email, WhatsApp, statut, domaines, sujets, présences)
et organiser la collaboration entre l'**admin global**, les **project managers** et les **encadrants industriels**.

## Architecture
- **Backend** : Node 22 + Express 4, base **SQLite** via `node:sqlite` (aucune dépendance native), accès par requêtes paramétrées uniquement.
- **Frontend** : SPA vanilla (HTML/CSS/JS, sans build), servie par le backend. Tout texte dynamique est échappé (`esc()`), CSP stricte.
- **Déploiement** : conteneur Docker + Caddy (HTTPS automatique) sur `crm.smartovate.com`. Base dans un volume.
- **Intégration landing** : `POST /api/public/leads` reçoit la copie JSON du formulaire xp.subul.uk (clé partagée + CORS restreint + rate limit).

## Modèle de données
| Table | Rôle |
|---|---|
| `users` | comptes internes : `admin`, `project_manager`, `supervisor` ; mot de passe scrypt |
| `sessions` | sessions serveur (token aléatoire, cookie HttpOnly/SameSite=Strict signé HMAC) |
| `students` | fiche étudiant : identité, email, WhatsApp, statut, niveau, école, ville, étape pipeline, source, encadrant, PM, notes |
| `student_domains` | domaines (DevOps, AI & Agents, Cybersecurity, Data Analysis, Full Stack, Cloud) |
| `subjects` | sujets de résidence : domaine, encadrant, PM, statut, capacité, dates |
| `student_subjects` | inscriptions étudiant ↔ sujet |
| `lab_sessions` | séances / labs : sujet, encadrant, date, durée, mode, lieu, statut |
| `attendance` | présence par séance et étudiant : `present`, `late`, `absent`, `excused` + note |
| `activities` | timeline par étudiant : note, appel, WhatsApp, email, réunion, changement d'étape, système |
| `audit_log` | journal de sécurité et de modifications |
| `settings` | clé d'intégration du formulaire landing |

Pipeline : `lead → contacted → lab_scheduled → active → completed / dropped`.

## Permissions
| Action | Admin | Project manager | Encadrant |
|---|---|---|---|
| Gérer les utilisateurs, paramètres, journal d'audit | ✔ | ✖ | ✖ |
| Créer / modifier / archiver des étudiants, import & export CSV | ✔ | ✔ | ✖ (modifie niveau, étape, notes, contact de **ses** étudiants) |
| Supprimer définitivement | ✔ | ✖ | ✖ |
| Voir les étudiants | tous | tous | ceux qui lui sont affectés ou inscrits à ses sujets |
| Sujets | tous | tous | les siens (création possible, affectation à lui-même) |
| Séances et présences | toutes | toutes | les siennes |
| Affecter encadrant / PM | ✔ | ✔ | ✖ |

Le périmètre est appliqué **côté serveur** (`src/scope.js`) dans chaque requête SQL, pas seulement dans l'interface.

## Sécurité
- Hachage scrypt, politique de mot de passe (10+ caractères, lettres et chiffres), rate limit sur la connexion (10 / 15 min / IP+email).
- Cookie de session `HttpOnly; SameSite=Strict; Secure` (derrière HTTPS), révocation à la déconnexion, au changement de mot de passe et à la désactivation.
- CSRF : SameSite=Strict + en-tête `X-Requested-With` obligatoire sur toute mutation.
- Validation serveur de chaque champ (schémas dans chaque route, clés inconnues ignorées), réponses sans champs sensibles.
- En-têtes : CSP, HSTS, nosniff, frame-ancestors none ; export CSV protégé contre l'injection de formules.
- Journal d'audit : connexions (réussies/échouées), créations, modifications, exports, pointages.
