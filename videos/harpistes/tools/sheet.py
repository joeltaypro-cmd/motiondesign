#!/usr/bin/env python3
"""Planche d'images légendées.
python3 tools/sheet.py sortie.png --cols 5 --largeur 384 img1.png "légende 1" img2.png "légende 2" ...
Les légendes commençant par '#' ouvrent une nouvelle rangée titrée (moment)."""
import sys
from PIL import Image, ImageDraw, ImageFont

def police(taille, gras=False):
    for f in (["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] if gras else []) + [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/Library/Fonts/Arial.ttf", "C:/Windows/Fonts/arial.ttf"]:
        try:
            return ImageFont.truetype(f, taille)
        except OSError:
            pass
    return ImageFont.load_default()

def planche(sortie, items, cols=5, largeur=384, fond=(18, 18, 20)):
    # items : liste de ('titre', texte) ou ('image', chemin, légende)
    rangs, courant = [], {"titre": None, "images": []}
    for it in items:
        if it[0] == "titre":
            if courant["images"] or courant["titre"]:
                rangs.append(courant)
            courant = {"titre": it[1], "images": []}
        else:
            courant["images"].append(it[1:])
    rangs.append(courant)
    ims = [Image.open(r[0]).convert("RGB") for rg in rangs for r in rg["images"]]
    ratio = ims[0].height / ims[0].width if ims else 9 / 16
    h_img = int(largeur * ratio)
    h_leg, h_tit, marge = 44, 40, 10
    hauteur = marge
    for rg in rangs:
        n = len(rg["images"])
        hauteur += (h_tit if rg["titre"] else 0) + ((n + cols - 1) // cols) * (h_img + h_leg + marge)
    L = marge + cols * (largeur + marge)
    out = Image.new("RGB", (L, hauteur), fond)
    d = ImageDraw.Draw(out)
    f, ft = police(15), police(20, True)
    y = marge
    for rg in rangs:
        if rg["titre"]:
            d.text((marge, y + 8), rg["titre"], fill=(255, 140, 90), font=ft)
            y += h_tit
        for i, (chemin, leg) in enumerate(rg["images"]):
            c, r = i % cols, i // cols
            x, yy = marge + c * (largeur + marge), y + r * (h_img + h_leg + marge)
            im = Image.open(chemin).convert("RGB").resize((largeur, h_img), Image.LANCZOS)
            out.paste(im, (x, yy))
            lignes, ligne = [], ""
            for mot in leg.split():
                essai = (ligne + " " + mot).strip()
                if d.textlength(essai, font=f) > largeur:
                    lignes.append(ligne); ligne = mot
                else:
                    ligne = essai
            lignes.append(ligne)
            for k, l in enumerate(lignes[:2]):
                d.text((x, yy + h_img + 4 + k * 19), l, fill=(225, 225, 228), font=f)
        n = len(rg["images"])
        y += ((n + cols - 1) // cols) * (h_img + h_leg + marge)
    out.save(sortie)
    return sortie

if __name__ == "__main__":
    a = sys.argv[1:]
    sortie = a.pop(0)
    cols, largeur = 5, 384
    if "--cols" in a:
        i = a.index("--cols"); cols = int(a[i + 1]); del a[i:i + 2]
    if "--largeur" in a:
        i = a.index("--largeur"); largeur = int(a[i + 1]); del a[i:i + 2]
    items, i = [], 0
    while i < len(a):
        if a[i].startswith("#"):
            items.append(("titre", a[i][1:].strip())); i += 1
        else:
            items.append(("image", a[i], a[i + 1] if i + 1 < len(a) else "")); i += 2
    print(planche(sortie, items, cols, largeur))
