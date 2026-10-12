#!/usr/bin/env python3
"""Contrôle des coupes et de la lumière, à partir de tools/bin/coupes.
python3 tools/controle.py rendu/coupes.json
- aucune image identique à la précédente ;
- chaque coupe du conducteur tombe deux images avant son temps, et il n'en manque aucune ;
- luminosité moyenne plan par plan (un plan beaucoup plus clair que ses voisins se lit comme un éclair)."""
import json, statistics, subprocess, sys, os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
images = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RACINE, "rendu/coupes.json")))
c = json.loads(subprocess.check_output(["node", "-e", "import('./scene/cues.js').then(c=>console.log(JSON.stringify({p:c.PLANS,ips:c.IPS})))"], cwd=RACINE))
plans, ips = c["p"], c["ips"]
attendues = {round(p["debut"] * ips): p["id"] for p in plans if p["debut"] > 0}
ident = [im["i"] for im in images if im["identique"]]
print(f"{len(images)} images ; images identiques à la précédente : {ident if ident else 'aucune'}")

diffs = [im["diff"] or 0 for im in images]
def est_coupe(i):
    d = diffs[i]
    voisins = [diffs[j] for j in range(max(1, i - 4), min(len(diffs), i + 5)) if j != i]
    ref = statistics.median(voisins) if voisins else 0
    return d > 2.5 and d > 2.2 * ref
mesurees = [i for i in range(1, len(diffs)) if est_coupe(i)]
manquantes = [(f, p) for f, p in attendues.items() if f not in mesurees and f - 1 not in mesurees and f + 1 not in mesurees]
decalees = [(f, p, m) for f, p in attendues.items() for m in mesurees if abs(m - f) == 1]
en_trop = [m for m in mesurees if all(abs(m - f) > 1 for f in attendues)]
print(f"coupes du conducteur : {len(attendues)} ; coupes mesurées : {len(mesurees)}")
print("  coupes exactes (deux images avant le temps) :", sum(1 for f in attendues if f in mesurees))
if decalees: print("  DÉCALÉES d'une image :", decalees)
if manquantes: print("  NON DÉTECTÉES (changement trop faible ou absent) :", manquantes)
if en_trop: print("  sauts hors coupe (à expliquer) :", en_trop, [round(diffs[m], 1) for m in en_trop])

print("\nluminosité moyenne par plan (0-255) :")
lums = []
for k, p in enumerate(plans):
    a = round(p["debut"] * ips); b = round(p["fin"] * ips)
    v = [im["lum"] for im in images[a:b]]
    lums.append(statistics.mean(v) if v else 0)
for k, p in enumerate(plans):
    vois = [lums[j] for j in (k - 1, k + 1) if 0 <= j < len(plans)]
    alerte = " <- beaucoup plus clair que ses voisins" if vois and lums[k] > 1.6 * max(vois) and lums[k] > 40 else ""
    print(f"  {p['id']} {lums[k]:6.1f}{alerte}")
