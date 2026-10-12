#!/usr/bin/env python3
"""Storyboard : une image réellement rendue par plan, rangée par moment, légendée.
python3 tools/storyboard.py [--w 960 --h 540 --passes 8 --sortie storyboard.png --images dossier]"""
import json, os, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
sys.path.insert(0, ICI)
from sheet import planche  # noqa: E402

def arg(nom, defaut):
    a = sys.argv
    return a[a.index("--" + nom) + 1] if "--" + nom in a else defaut

W, H, PASSES = int(arg("w", 960)), int(arg("h", 540)), int(arg("passes", 8))
SORTIE = os.path.join(RACINE, arg("sortie", "storyboard.png"))
IMAGES = os.path.join(RACINE, arg("images", "rendu/storyboard"))

plans = json.loads(subprocess.check_output(["node", "-e", """
import('./scene/cues.js').then(c => console.log(JSON.stringify({ plans: c.PLANS, moments: c.MOMENTS })));
"""], cwd=RACINE))
moments, plans = plans["moments"], plans["plans"]
temps, noms = [], []
for p in plans:
    d = p["fin"] - p["debut"]
    t = p["action"] + min(0.12, 0.45 * d) if p["action"] > 0 else 0.12
    temps.append(round(t, 4)); noms.append(p["id"])
if "--sans-rendu" not in sys.argv:
    subprocess.run(["node", os.path.join(ICI, "essai.mjs"), "--t", ",".join(map(str, temps)), "--noms", ",".join(noms),
                    "--w", str(W), "--h", str(H), "--passes", str(PASSES), "--sortie", IMAGES], cwd=RACINE, check=True,
                   stdin=subprocess.DEVNULL)
items, courant = [], None
for p, t in zip(plans, temps):
    if p["moment"] != courant:
        courant = p["moment"]
        items.append(("titre", f"{courant}. {moments[str(courant)]}"))
    items.append(("image", os.path.join(IMAGES, p["id"] + ".png"), f"{p['id']} · {t:.2f} s · {p['quoi']}"))
print(planche(SORTIE, items, cols=5, largeur=372))
