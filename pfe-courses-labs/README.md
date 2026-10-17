# Parcours et labs pour les 200 sujets de PFE

Contenu pédagogique généré pour le catalogue [sujetpfe.subul.uk](https://sujetpfe.subul.uk) :
un parcours d'une heure et quatre labs de 15 minutes par sujet, destinés à l'étudiant
qui démarre son PFE.

| Fichier | Contenu | Gabarit suivi |
|---|---|---|
| `subul-courses-pfe.json` | 200 parcours × 4 modules de 15 min | `subul-courses-template.json` |
| `subul-labs-pfe.json` | 800 labs de 15 min | `subul-labs-template.json` |

Totaux : **200 h de cours** et **200 h de labs**, 5 000 identifiants uniques, 800 slugs uniques.

## Structure d'un parcours (1 h)

| Module | Durée | Contenu |
|---|---|---|
| 1 — Cadrage du sujet et état de l'art | 15 min | Question traitée, métrique de réussite, méthode, écueils du domaine |
| 2 — 1er outil de la pile | 15 min | Rôle dans le projet, mise en œuvre, pièges |
| 3 — 2e outil de la pile | 15 min | Idem |
| 4 — 3e outil + intégration et livrable | 15 min | Assemblage de la chaîne, reproductibilité, soutenance |

Chaque module contient 2 leçons, 2 questions à choix multiple et 1 lab de 15 minutes.
Le module 1 est cadré par domaine (IA, AI Agents, DevOps, Cybersécurité, Data Analysis) ;
les modules 2 à 4 sont dérivés de la pile technique propre au sujet.

## Labs

Un lab par module, soit quatre par sujet, chaînés par `prevSlug` / `nextSlug` :

    pfe-001-m1 → pfe-001-m2 → pfe-001-m3 → pfe-001-m4

Le lab du module 1 prépare le dépôt et le périmètre ; les trois suivants font manipuler
l'outil du module puis mesurer et consigner le résultat. Chaque lab contient 4 ou 5 étapes
avec `instruction`, `hint` et `validationNote`.

## Conventions et hypothèses

Ces choix ont été faits lors de la génération ; ils se changent dans le générateur.

- **Découpage horaire** — « 1 h, 4 modules » est lu comme 4 × 15 min de cours, et les labs
  de 15 min sont comptés **en plus** du temps de cours (1 h de cours + 1 h de labs par sujet).
- **`provider: "local"`** et `providerLoginUrl: ""` — les 282 outils du catalogue sont tous
  auto-hébergés et open source, sans portail de connexion. À remapper si les labs doivent
  tourner dans le sandbox AWS/Azure.
- **`status: "draft"`** sur tous les labs, comme dans le gabarit.
- **Niveaux** — le champ `level` reprend les trois niveaux réellement saisis dans `data.js`
  (`debutant` 13, `intermediaire` 97, `avance` 90) et non les deux types affichés
  aujourd'hui par le site.
- **Langue** — français, comme le catalogue.
- **Questions à choix multiple** — les mauvaises réponses sont des affirmations exactes
  portant sur des outils d'une **autre** catégorie, ce qui garantit qu'aucun distracteur
  n'est accidentellement vrai pour l'outil interrogé.
- **`resources.documentation`** n'est renseigné que pour les outils dont l'URL officielle
  est certaine ; il est omis ailleurs plutôt que deviné.

## Identifiants

| Objet | Forme | Exemple |
|---|---|---|
| Parcours | `pfe-NNN` | `pfe-042` |
| Référence (`exam_code`) | `PFE-NNN` | `PFE-042` |
| Module | `pfe-NNN-mM` | `pfe-042-m3` |
| Leçon / question | `pfe-NNN-mM-lN` / `-qN` | `pfe-042-m3-q2` |
| Lab (slug) | `pfe-NNN-mM` | `pfe-042-m3` |

`NNN` suit la numérotation du catalogue : 001-040 IA, 041-080 AI Agents, 081-120 DevOps,
121-160 Cybersécurité, 161-200 Data Analysis.

## Régénérer

Le générateur est déterministe : à catalogue identique, la sortie est identique au bit près.

    cd generator
    python3 extract.py /chemin/vers/sujetpfe/data.js   # rafraîchit sujets.json
    python3 gen.py                                     # réécrit les deux JSON

| Fichier | Rôle |
|---|---|
| `generator/extract.py` | Extrait les 200 sujets depuis le `data.js` du catalogue |
| `generator/kb.py` | Base de connaissances des 282 outils (rôle, points clés, action de lab) |
| `generator/domains.py` | Cadrage, banque de questions et conseils par domaine |
| `generator/gen.py` | Assemble parcours et labs |
| `generator/sujets.json` | Instantané des 200 sujets extraits |

Ajouter un outil au catalogue impose d'ajouter son entrée dans `kb.py` : `gen.py`
s'arrête sur une `KeyError` explicite plutôt que de produire du contenu générique.
