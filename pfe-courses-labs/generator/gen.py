# -*- coding: utf-8 -*-
"""Genere 200 parcours (1 h = 4 modules de 15 min) et 800 labs (15 min) a partir
du catalogue sujetpfe. Sortie conforme aux deux gabarits Subul fournis."""
import json, re, sys, unicodedata, random, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kb import K
from domains import DOM

HERE = os.path.dirname(os.path.abspath(__file__))       # generator/
BASE = os.path.dirname(HERE)                            # pfe-courses-labs/
SUJETS = json.load(open(os.path.join(HERE, "sujets.json"), encoding="utf-8"))
TODAY = "2026-09-22"

LVL_COURSE = {"Débutant": "debutant", "Intermédiaire": "intermediaire", "Avancé": "avance"}
LVL_LAB    = {"Débutant": "beginner", "Intermédiaire": "intermediate", "Avancé": "advanced"}

# Echafaudage de lab par categorie d'outil : (preparation, titre mesure, instruction mesure, indice, prerequis)
CAT = {
 "llm":      ("Installer le moteur d'inférence et récupérer un modèle quantifié.", "Mesurer le coût d'inférence", "Relever la latence de première réponse et le débit en tokens par seconde.", "Un modèle plus petit suffit souvent : commencer par le plus léger.", "Poste avec 8 Go de RAM disponibles"),
 "ml":       ("Créer un environnement Python isolé et installer la bibliothèque avec une version figée.", "Consigner la métrique", "Relever la métrique retenue sur le jeu de validation et la comparer à la solution de base.", "Figer la seed avant toute comparaison entre deux essais.", "Python 3.11 et un jeu de données d'exemple"),
 "nlp":      ("Installer la bibliothèque et télécharger le modèle de langue nécessaire.", "Évaluer sur un échantillon", "Analyser dix sorties à la main et classer les erreurs par type.", "Les erreurs se regroupent souvent en deux ou trois familles.", "Un corpus texte de quelques centaines de documents"),
 "cv":       ("Installer la bibliothèque de vision et préparer un échantillon d'images.", "Contrôler visuellement", "Afficher les résultats sur cinq images et repérer les cas d'échec.", "Toujours regarder les images, pas seulement les chiffres.", "Un échantillon d'images représentatif"),
 "audio":    ("Installer la bibliothèque audio et préparer un extrait sonore de test.", "Mesurer la qualité", "Écouter la sortie et relever la métrique objective correspondante.", "Un extrait bruité révèle mieux les limites qu'un extrait propre.", "Un extrait audio de trente secondes"),
 "mlops":    ("Démarrer le service de suivi et le connecter au projet.", "Comparer les exécutions", "Comparer au moins deux exécutions et identifier ce qui explique l'écart.", "Une exécution non tracée est une exécution perdue.", "Un projet d'entraînement déjà fonctionnel"),
 "agent":    ("Installer le cadriciel d'agents et configurer l'accès au modèle local.", "Lire les traces", "Relire la trace complète : outils appelés, nombre d'itérations, coût total.", "Borner le nombre d'itérations avant le premier essai.", "Un modèle accessible en local"),
 "vectordb": ("Démarrer la base vectorielle en conteneur et créer une collection.", "Mesurer la pertinence", "Poser cinq requêtes et vérifier manuellement la pertinence des résultats.", "Le découpage des documents pèse plus que le choix de la base.", "Un corpus de documents et un modèle d'embeddings"),
 "db":       ("Démarrer la base en conteneur et charger un jeu de données de test.", "Lire le plan d'exécution", "Comparer le plan d'exécution avant et après l'ajout d'un index.", "Mesurer sur un volume réaliste, pas sur dix lignes.", "Docker et un jeu de données de test"),
 "data":     ("Installer l'outil et le brancher sur la source de données du projet.", "Contrôler la qualité", "Vérifier le volume, les valeurs manquantes et la cohérence des types en sortie.", "Un traitement qui ne vérifie rien propage les erreurs en silence.", "Une source de données accessible"),
 "bi":       ("Démarrer l'outil de visualisation et le connecter à la base du projet.", "Faire relire le tableau", "Faire interpréter le tableau de bord par quelqu'un qui n'a pas participé à sa construction.", "Si un chiffre demande une explication orale, le tableau est incomplet.", "Une base contenant des données propres"),
 "obs":      ("Déployer le collecteur et le brancher sur le service à observer.", "Provoquer un signal", "Générer volontairement une anomalie et vérifier qu'elle apparaît bien.", "Une alerte jamais déclenchée n'a jamais été testée.", "Un service en fonctionnement à instrumenter"),
 "devops":   ("Préparer l'outil et le brancher sur le dépôt du projet.", "Mesurer le gain", "Comparer la durée et le taux d'échec avant et après l'automatisation.", "Noter la mesure initiale avant de changer quoi que ce soit.", "Un dépôt Git avec le projet"),
 "k8s":      ("Démarrer un cluster léger local et configurer l'accès en ligne de commande.", "Vérifier le comportement", "Supprimer un pod et vérifier que le service reste disponible.", "Décrire la ressource est le premier réflexe en cas d'échec.", "Un cluster local de type k3s ou kind"),
 "iac":      ("Installer l'outil et initialiser la configuration dans le dépôt.", "Vérifier la reproductibilité", "Détruire puis recréer la ressource et vérifier que l'état final est identique.", "Relire le plan avant d'appliquer, toujours.", "Un environnement cible accessible"),
 "security": ("Préparer un environnement de laboratoire isolé du réseau de production.", "Prouver la détection", "Rejouer le scénario et vérifier que l'événement est bien détecté et journalisé.", "Travailler uniquement sur un périmètre que l'on possède.", "Un laboratoire isolé et une autorisation écrite"),
 "forensics":("Préparer une copie de travail de la preuve et en vérifier l'empreinte.", "Documenter la chaîne", "Consigner chaque action avec son horodatage dans le journal d'investigation.", "Ne jamais travailler sur la preuve originale.", "Une image disque ou mémoire de test"),
 "web":      ("Installer les dépendances et démarrer le service en local.", "Vérifier le contrat", "Appeler le service avec une entrée invalide et vérifier le code d'erreur renvoyé.", "Tester le cas d'erreur avant le cas nominal.", "Un environnement de développement fonctionnel"),
 "misc":     ("Installer l'outil et le configurer pour le projet.", "Vérifier le résultat", "Contrôler la sortie produite et la consigner dans le dépôt.", "Automatiser dès que l'opération est faite deux fois.", "Un environnement de développement fonctionnel"),
}

DOCS = {
 "PyTorch":"https://pytorch.org/docs/","scikit-learn":"https://scikit-learn.org/stable/","Kubernetes":"https://kubernetes.io/docs/",
 "Docker":"https://docs.docker.com/","Prometheus":"https://prometheus.io/docs/","Grafana":"https://grafana.com/docs/",
 "dbt":"https://docs.getdbt.com/","DuckDB":"https://duckdb.org/docs/","PostgreSQL":"https://www.postgresql.org/docs/",
 "Kafka":"https://kafka.apache.org/documentation/","Airflow":"https://airflow.apache.org/docs/","Apache Airflow":"https://airflow.apache.org/docs/",
 "spaCy":"https://spacy.io/usage","FastAPI":"https://fastapi.tiangolo.com/","Streamlit":"https://docs.streamlit.io/",
 "Ollama":"https://ollama.com/","LangChain":"https://python.langchain.com/docs/","Qdrant":"https://qdrant.tech/documentation/",
 "MinIO":"https://min.io/docs/","Keycloak":"https://www.keycloak.org/documentation","Wazuh":"https://documentation.wazuh.com/",
 "Zeek":"https://docs.zeek.org/","Suricata":"https://docs.suricata.io/","Nmap":"https://nmap.org/docs.html",
 "Terraform":"https://developer.hashicorp.com/terraform/docs","Ansible":"https://docs.ansible.com/","Helm":"https://helm.sh/docs/",
 "ArgoCD":"https://argo-cd.readthedocs.io/","OpenSearch":"https://opensearch.org/docs/","Trino":"https://trino.io/docs/current/",
 "ClickHouse":"https://clickhouse.com/docs","Apache Superset":"https://superset.apache.org/docs/intro","Metabase":"https://www.metabase.com/docs/latest/",
 "MLflow":"https://mlflow.org/docs/latest/","Elasticsearch":"https://www.elastic.co/guide/","OpenCV":"https://docs.opencv.org/",
 "Trivy":"https://trivy.dev/latest/docs/","k6":"https://grafana.com/docs/k6/latest/","OWASP ZAP":"https://www.zaproxy.org/docs/",
 "Vault":"https://developer.hashicorp.com/vault/docs","HashiCorp Vault":"https://developer.hashicorp.com/vault/docs",
 "pandas":"https://pandas.pydata.org/docs/","TensorFlow":"https://www.tensorflow.org/api_docs","Redis":"https://redis.io/docs/latest/",
 "Apache Spark":"https://spark.apache.org/docs/latest/","Nginx":"https://nginx.org/en/docs/","Whisper":"https://github.com/openai/whisper",
}

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")

def de(tool):
    """Elision francaise : « de PyTorch » mais « d'OpenCV »."""
    return ("d'" + tool) if tool[0] in "AEIOUÀÉÈÊÎÔÛ" else ("de " + tool)

def cap(s):
    return s[0].upper() + s[1:] if s else s

def short_role(tool):
    r = K[tool][1]
    return r[0].upper() + r[1:]

# ---- banque de distracteurs, indexee par categorie ----
# Outils dont les points cles sont trop generiques pour servir de distracteur
GENERIC = {"Python", "Git", "Jupyter", "Pandoc", "OpenAPI"}
ROLES = [(t, K[t][0], K[t][1]) for t in K if t not in GENERIC]
KPS   = [(t, K[t][0], kp) for t in K for kp in K[t][2]
         if t not in GENERIC and K[t][0] != "misc"]

def distract(pool, cat, correct, rng, n=3):
    cands = [x[2] for x in pool if x[1] != cat and x[2] != correct]
    picked, seen = [], set()
    rng.shuffle(cands)
    for c in cands:
        if c.lower() in seen: continue
        seen.add(c.lower()); picked.append(c)
        if len(picked) == n: break
    return picked

def mcq(qid, question, correct, wrong, explanation, rng):
    correct = cap(correct)
    opts = [correct] + [cap(w) for w in wrong]
    rng.shuffle(opts)
    return {"id": qid, "question": question, "options": opts, "correct": correct, "explanation": explanation}

def tool_quiz(mid, tool, rng):
    cat = K[tool][0]
    q1 = mcq(f"{mid}-q1", f"Dans ce projet, quel est le rôle principal {de(tool)} ?",
             K[tool][1], distract(ROLES, cat, K[tool][1], rng),
             f"Rôle {de(tool)} : {K[tool][1]}.", rng)
    kp = K[tool][2][0]
    q2 = mcq(f"{mid}-q2", f"Laquelle de ces affirmations décrit correctement {tool} ?",
             kp, distract(KPS, cat, kp, rng),
             f"À retenir sur {tool} : {kp}.", rng)
    return [q1, q2]

def lab_for_tool(sid, mi, tool, mtitle, dom, lvl, sujet_title, integration=False):
    cat, role, kps, action = K[tool]
    c = CAT[cat]
    act = action[0].upper() + action[1:]
    steps = [
        {"title": "Préparer l'environnement",
         "instruction": c[0],
         "hint": "Figer les versions dès maintenant évite des heures de débogage plus tard.",
         "validationNote": f"{tool} répond et sa version est consignée dans le dépôt."},
        {"title": act,
         "instruction": f"{act}, dans le contexte du sujet « {sujet_title} ».",
         "hint": c[3],
         "validationNote": "L'opération aboutit et sa sortie est reproductible."},
        {"title": c[1],
         "instruction": c[2],
         "hint": "Une mesure sans point de comparaison ne prouve rien.",
         "validationNote": "La mesure est relevée et comparée à l'état précédent."},
    ]
    if integration:
        steps.append({
            "title": "Relier les briques du projet",
            "instruction": f"Connecter cette étape aux composants déjà construits pour obtenir une chaîne exécutable de bout en bout.",
            "hint": "Une chaîne qui tourne en une commande vaut mieux que trois scripts isolés.",
            "validationNote": "La chaîne complète s'exécute d'un seul tenant."})
    steps.append({
        "title": "Consigner dans le mémoire",
        "instruction": "Commiter le code, la mesure obtenue et une courte note expliquant le choix technique retenu.",
        "hint": "Ces notes deviennent directement des paragraphes du mémoire.",
        "validationNote": "Le dépôt contient le code, le résultat et sa justification."})
    return {
        "slug": f"{sid}-m{mi}",
        "title": f"{tool} — {act.rstrip('.')}",
        "description": f"{act}, puis mesurer et consigner le résultat dans le dépôt du PFE « {sujet_title} ».",
        "provider": "local",
        "difficulty": LVL_LAB[lvl],
        "estimatedTime": "15 min",
        "estimatedDurationMinutes": 15,
        "moduleTitle": mtitle,
        "status": "draft",
        "tasks": [c[0].rstrip("."), act.rstrip("."), c[2].rstrip("."), "Consigner le résultat dans le dépôt"],
        "steps": steps,
        "metadata": {
            "providerLoginUrl": "",
            "tags": [dom["key"], cat, slug(tool)],
            "learningObjectives": [f"Savoir {action} avec {tool}", f"Retenir que {kps[0]}"],
            "prerequisites": [c[4]] + ([f"Avoir terminé le lab {sid}-m{mi-1}"] if mi > 1 else []),
            "level": LVL_LAB[lvl],
            "prevSlug": f"{sid}-m{mi-1}" if mi > 1 else "",
            "nextSlug": f"{sid}-m{mi+1}" if mi < 4 else "",
        },
    }

def lab_cadrage(sid, dom, lvl, sujet_title, stack):
    return {
        "slug": f"{sid}-m1",
        "title": "Cadrer le sujet et préparer le dépôt",
        "description": f"Poser le périmètre, la question traitée et la métrique de réussite du PFE « {sujet_title} », puis initialiser un dépôt reproductible.",
        "provider": "local",
        "difficulty": LVL_LAB[lvl],
        "estimatedTime": "15 min",
        "estimatedDurationMinutes": 15,
        "moduleTitle": "Module 1 — Cadrage du sujet et état de l'art",
        "status": "draft",
        "tasks": ["Formuler la question traitée en une phrase",
                  "Choisir la métrique de réussite",
                  "Initialiser le dépôt et l'environnement",
                  "Lister les trois références de départ"],
        "steps": [
            {"title": "Écrire la question en une phrase",
             "instruction": f"Rédiger dans le README la question exacte que le PFE « {sujet_title} » doit trancher, en une seule phrase.",
             "hint": "Si la phrase tient mal en une ligne, le périmètre est encore trop large.",
             "validationNote": "Le README contient une question unique et vérifiable."},
            {"title": "Choisir la métrique de réussite",
             "instruction": "Définir la métrique qui permettra de dire que le projet a réussi, et la valeur cible visée.",
             "hint": "La métrique doit venir de l'usage réel, pas de sa facilité de calcul.",
             "validationNote": "Une métrique et un seuil cible sont écrits noir sur blanc."},
            {"title": "Initialiser le dépôt et l'environnement",
             "instruction": f"Créer le dépôt Git, l'arborescence du projet et un environnement reproductible incluant : {', '.join(stack)}.",
             "hint": "Versions figées dès le premier commit.",
             "validationNote": "Le projet se réinstalle depuis zéro sur une machine vierge."},
            {"title": "Réunir l'état de l'art minimal",
             "instruction": "Identifier trois travaux ou outils existants qui traitent un problème voisin et noter en quoi le sujet s'en distingue.",
             "hint": "Trois références lues valent mieux que vingt citées.",
             "validationNote": "Trois références sont résumées en deux lignes chacune."},
        ],
        "metadata": {
            "providerLoginUrl": "",
            "tags": [dom["key"], "cadrage", "methode"],
            "learningObjectives": ["Délimiter le périmètre d'un PFE et sa métrique de réussite",
                                   "Mettre en place un dépôt et un environnement reproductibles"],
            "prerequisites": ["Un poste avec Git et Python installés"],
            "level": LVL_LAB[lvl],
            "prevSlug": "", "nextSlug": f"{sid}-m2",
        },
    }

def build(sujet, idx):
    dom = DOM[sujet["dom"]]
    sid = "pfe-%03d" % idx
    ref = "PFE-%03d" % idx
    title, stack, lvl = sujet["t"], sujet["stack"], sujet["lvl"]
    rng = random.Random(f"{ref}|{title}")
    t0, t1, t2 = stack[0], stack[1], stack[2]
    extra = stack[3] if len(stack) > 3 else None

    # ---- Module 1 : cadrage ----
    m1id = f"{sid}-m1"
    qb = dom["qbank"]
    qa, qbq = qb[idx % len(qb)], qb[(idx + 1) % len(qb)]
    m1 = {
        "id": m1id, "order": 1, "title": "Module 1 — Cadrage du sujet et état de l'art", "duration_min": 15,
        "objectives": [f"Formuler la question traitée par « {title} » et sa métrique de réussite",
                       "Situer le sujet par rapport à l'existant",
                       "Organiser un projet reproductible du premier au dernier commit"],
        "lessons": [
            {"id": f"{m1id}-l1", "title": "Comprendre le problème avant de choisir la technique",
             "content": f"{dom['intro']} Pour le sujet « {title} », la première tâche n'est donc pas de manipuler {t0} mais de décrire précisément ce qui doit être produit, à partir de quelles données ou de quel périmètre, et selon quel critère le résultat sera jugé acceptable. La pile retenue — {', '.join(stack)} — n'est qu'un moyen : elle doit être justifiée par la question, jamais l'inverse.",
             "key_points": ["La question précède l'outil",
                            "Le critère de réussite se fixe avant les premiers résultats",
                            f"La pile {', '.join(stack[:3])} doit être justifiée par le besoin"]},
            {"id": f"{m1id}-l2", "title": "Méthode de travail et livrables attendus",
             "content": f"{dom['method']} {dom['pitfalls']} Concrètement, le dépôt du PFE doit permettre à un tiers de reproduire les résultats sans vous : environnement figé, données ou jeu d'exemple accessibles, commandes documentées. Le mémoire se construit au fil de l'eau à partir des notes de chaque étape, pas dans les deux dernières semaines.",
             "key_points": ["Un résultat non reproductible n'est pas un résultat",
                            "Chaque étape produit une note qui alimentera le mémoire",
                            "Les écueils connus se traitent en amont, pas à la soutenance"]},
        ],
        "quiz": [mcq(f"{m1id}-q1", qa[0], qa[1], list(qa[2]), qa[3], rng),
                 mcq(f"{m1id}-q2", qbq[0], qbq[1], list(qbq[2]), qbq[3], rng)],
        "labs": [{"id": f"{m1id}-lab1", "order": 1, "title": "Cadrer le sujet et préparer le dépôt",
                  "description": "Poser périmètre, métrique et dépôt reproductible.",
                  "duration_min": 15, "difficulty": LVL_LAB[lvl], "slug": f"{sid}-m1"}],
    }

    mods = [m1]
    plan = [(2, t0, False), (3, t1, False), (4, t2, True)]
    for mi, tool, integ in plan:
        mid = f"{sid}-m{mi}"
        cat, role, kps, action = K[tool]
        if integ:
            mtitle = f"Module {mi} — {tool}, intégration et livrable"
            extra_txt = (f" Le sujet mobilise aussi {extra} : prévoir explicitement où il s'insère dans la chaîne." if extra else "")
            l2 = {"id": f"{mid}-l2", "title": "Évaluation, reproductibilité et soutenance",
                  "content": f"À ce stade, les briques existent séparément : il faut les relier en une chaîne exécutable et démontrable.{extra_txt} Trois exigences ferment le projet. D'abord la reproductibilité : un tiers doit rejouer la chaîne depuis le dépôt. Ensuite la mesure : le résultat final se compare à l'état initial ou à la solution de base définie au module 1. Enfin la démonstration : préparer un scénario court qui fonctionne hors ligne, car une démonstration qui dépend du réseau de la salle échoue une fois sur deux.",
                  "key_points": ["La chaîne complète doit s'exécuter d'un seul tenant",
                                 "Le résultat final se compare au point de départ",
                                 "La démonstration se prépare et se répète avant la soutenance"]}
        else:
            mtitle = f"Module {mi} — {tool} : {role}"
            l2 = {"id": f"{mid}-l2", "title": f"Mise en œuvre et pièges courants avec {tool}",
                  "content": f"La mise en œuvre {de(tool)} dans ce projet suit trois temps : une installation figée en version, un premier usage minimal qui prouve que l'outil répond, puis l'intégration au reste de la chaîne. Deux points méritent une attention particulière : {kps[0]}, et {kps[1] if len(kps) > 1 else 'la nécessité de mesurer avant et après chaque changement'}. Le réflexe utile est de garder une trace écrite de chaque réglage testé : sans cela, il devient impossible d'expliquer à la soutenance pourquoi telle configuration a été retenue.",
                  "key_points": [kps[0]] + ([kps[1]] if len(kps) > 1 else []) + ["Chaque réglage testé doit être tracé"]}
        mods.append({
            "id": mid, "order": mi, "title": mtitle, "duration_min": 15,
            "objectives": [f"Savoir {action} avec {tool}",
                           f"Expliquer pourquoi {tool} est pertinent pour « {title} »"] +
                          (["Assembler et démontrer la chaîne complète"] if integ else []),
            "lessons": [
                {"id": f"{mid}-l1", "title": f"{tool} dans ce projet",
                 "content": f"Rôle {de(tool)} dans ce projet : {role}. Concrètement, il intervient pour {action}. Ce n'est pas le seul outil possible, et le mémoire gagne à expliquer en deux phrases pourquoi celui-ci a été préféré à une alternative : maturité, empreinte, intégration avec le reste de la pile ({', '.join(t for t in stack if t != tool)}), ou simple disponibilité en open source.",
                 "key_points": [f"{tool} : {role}", kps[0], "Le choix d'outil se justifie dans le mémoire"]},
                l2,
            ],
            "quiz": tool_quiz(mid, tool, rng),
            "labs": [{"id": f"{mid}-lab1", "order": 1,
                      "title": (action[0].upper() + action[1:]).rstrip("."),
                      "description": f"Lab pratique de 15 minutes sur {tool}.",
                      "duration_min": 15, "difficulty": LVL_LAB[lvl], "slug": f"{sid}-m{mi}"}],
        })

    docs = next((DOCS[t] for t in stack if t in DOCS), None)
    res = {"official": "https://sujetpfe.subul.uk", "stack": ", ".join(stack)}
    if docs: res["documentation"] = docs

    course = {
        "id": sid, "provider": "Subul XP", "exam_code": ref, "title": title,
        "domain": dom["key"], "level": LVL_COURSE[lvl], "badge_color": dom["tint"],
        "description": f"Parcours d'une heure préparant au sujet de PFE « {title} » ({dom['label']}, {sujet['mois']} mois). Quatre modules de 15 minutes : cadrage du sujet, puis {t0}, {t1} et {t2} jusqu'à la chaîne complète.",
        "estimated_hours": 1,
        "modules": mods,
        "final_exam_tips": dom["tips"] + [f"Être capable d'expliquer en une minute le rôle de {t0}, {t1} et {t2} dans la chaîne."],
        "resources": res,
    }

    labs = [lab_cadrage(sid, dom, lvl, title, stack)]
    for mi, tool, integ in plan:
        mt = mods[mi - 1]["title"]
        labs.append(lab_for_tool(sid, mi, tool, mt, dom, lvl, title, integration=integ))
    return course, labs

courses, labs = [], []
for i, s in enumerate(SUJETS, start=1):
    c, l = build(s, i)
    courses.append(c); labs.extend(l)

out = BASE
json.dump({"platform": "Subul", "version": "1.0", "last_updated": TODAY, "certifications": courses},
          open(os.path.join(out, "subul-courses-pfe.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
json.dump(labs, open(os.path.join(out, "subul-labs-pfe.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("courses:", len(courses), "| labs:", len(labs))
