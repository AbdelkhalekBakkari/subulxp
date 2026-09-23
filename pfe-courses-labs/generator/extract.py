# -*- coding: utf-8 -*-
"""Extrait les 200 sujets depuis le data.js du catalogue sujetpfe vers sujets.json.

Usage : python extract.py /chemin/vers/sujetpfe/data.js
"""
import json, re, sys, os

SRC = sys.argv[1] if len(sys.argv) > 1 else "data.js"
ORDER = ["AI", "AGENTS", "DEVOPS", "CYBER", "DATA"]

src = open(SRC, encoding="utf-8").read()
rows = []
for dom in ORDER:
    m = re.search(r"const %s = \[(.*?)\n\];" % dom, src, re.S)
    if not m:
        raise SystemExit("bloc %s introuvable dans %s" % (dom, SRC))
    for r in re.finditer(r'\["(.*?)", "(.*?)", "(.*?)", (\d+)\]', m.group(1)):
        rows.append({"dom": dom,
                     "t": r.group(1),
                     "stack": [x.strip() for x in r.group(2).split(",")],
                     "lvl": r.group(3),
                     "mois": int(r.group(4))})

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sujets.json")
json.dump(rows, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("%d sujets extraits vers %s" % (len(rows), out))
