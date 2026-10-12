// Registre des dessins (textures), chargement des polices et images, aides au dessin sur canevas 2D.
// Chaque dessin est une fonction pure de ses paramètres : même clé, même image.

import { POLICE, MAIN } from './lib.js';

const DESSINS = {};
export function enregistrer(nom, fn) { DESSINS[nom] = fn; }

// Descripteur de texture : nom du dessin, paramètres, taille en pixels
export function T(nom, params = {}, w = 1024, h = 1024) {
  if (!DESSINS[nom]) throw new Error('Dessin inconnu : ' + nom);
  const cle = `${nom}|${w}x${h}|${JSON.stringify(params)}`;
  return { cle, w, h, dessin: (ctx, W, H) => DESSINS[nom](ctx, W, H, params) };
}

export const IMAGES = {};
export async function chargerRessources(base = '') {
  const polices = [
    new FontFace('Geist', `url(${base}fonts/Geist-var.woff2)`, { weight: '100 900' }),
    new FontFace('Caveat', `url(${base}fonts/Caveat-var.woff2)`, { weight: '400 700' }),
  ];
  for (const f of polices) { await f.load(); document.fonts.add(f); }
  const imgs = { logoH: `${base}matiere/logo-H.png` };
  await Promise.all(Object.entries(imgs).map(([k, src]) => new Promise((ok, ko) => {
    const im = new Image(); im.onload = () => { IMAGES[k] = im; ok(); }; im.onerror = () => ko(new Error('Image manquante : ' + src)); im.src = src;
  })));
  // force la préparation des polices pour tous les poids utilisés
  const c = document.createElement('canvas').getContext('2d');
  for (const w of [400, 500, 600, 700, 800]) { c.font = `${w} 20px ${POLICE}`; c.fillText('aÉ', 0, 0); }
  c.font = `600 20px ${MAIN}`; c.fillText('aÉ', 0, 0);
  await document.fonts.ready;
}

// Rectangle arrondi
export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Texte avec police, poids, alignement, espacement des lettres, largeur maximale (réduit si besoin)
export function texte(ctx, s, x, y, o = {}) {
  const { taille = 40, poids = 600, couleur = '#fff', align = 'left', base = 'alphabetic', police = POLICE, espace = 0, max = 0, italique = false } = o;
  let t = taille;
  ctx.font = `${italique ? 'italic ' : ''}${poids} ${t}px ${police}`;
  ctx.letterSpacing = `${espace}px`;
  if (max) { const w = ctx.measureText(s).width; if (w > max) { t = t * max / w; ctx.font = `${italique ? 'italic ' : ''}${poids} ${t}px ${police}`; } }
  ctx.fillStyle = couleur; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
  return t;
}
export function largeur(ctx, s, { taille = 40, poids = 600, police = POLICE, espace = 0 } = {}) {
  ctx.font = `${poids} ${taille}px ${police}`; ctx.letterSpacing = `${espace}px`;
  const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w;
}

// Icônes
export function triangleLecture(ctx, cx, cy, r, couleur) {
  ctx.fillStyle = couleur; ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy - r * 0.62); ctx.lineTo(cx + r * 0.68, cy); ctx.lineTo(cx - r * 0.42, cy + r * 0.62);
  ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = r * 0.18; ctx.strokeStyle = couleur; ctx.stroke(); ctx.fill();
}
export function coche(ctx, cx, cy, r, couleur, ep = 0.22) {
  ctx.strokeStyle = couleur; ctx.lineWidth = r * ep; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.55, cy + r * 0.02); ctx.lineTo(cx - r * 0.15, cy + r * 0.42); ctx.lineTo(cx + r * 0.6, cy - r * 0.45); ctx.stroke();
}
export function chevronHaut(ctx, cx, cy, r, couleur) {
  ctx.strokeStyle = couleur; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r, cy + r * 0.5); ctx.lineTo(cx, cy - r * 0.5); ctx.lineTo(cx + r, cy + r * 0.5); ctx.stroke();
}
export function flecheRetour(ctx, cx, cy, r, couleur) {
  ctx.strokeStyle = couleur; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx + r * 0.4, cy - r); ctx.lineTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.4, cy + r); ctx.stroke();
}
export function cloche(ctx, cx, cy, r, couleur) {
  ctx.strokeStyle = couleur; ctx.lineWidth = r * 0.16; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, cy + r * 0.55);
  ctx.quadraticCurveTo(cx - r * 0.6, cy + r * 0.3, cx - r * 0.6, cy - r * 0.15);
  ctx.bezierCurveTo(cx - r * 0.6, cy - r * 0.95, cx + r * 0.6, cy - r * 0.95, cx + r * 0.6, cy - r * 0.15);
  ctx.quadraticCurveTo(cx + r * 0.6, cy + r * 0.3, cx + r * 0.85, cy + r * 0.55);
  ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.78, r * 0.2, 0, Math.PI); ctx.stroke();
}
export function crayon(ctx, cx, cy, r, couleur) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = couleur;
  ctx.fillRect(-r * 0.2, -r * 0.75, r * 0.4, r * 1.15);
  ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.45); ctx.lineTo(r * 0.2, r * 0.45); ctx.lineTo(0, r * 0.85); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Petit clavier dessiné (vignettes) : touches allumées données par leur indice de touche blanche
export function clavierDessin(ctx, x, y, w, h, { allumees = [], couleurAllumee = '#ff5a1f', blanc = '#d8d6d2', noir = '#111', fond = '#222', nb = 22 } = {}) {
  ctx.fillStyle = fond; ctx.fillRect(x, y, w, h);
  const kw = w / nb;
  for (let i = 0; i < nb; i++) {
    ctx.fillStyle = allumees.includes(i) ? couleurAllumee : blanc;
    ctx.fillRect(x + i * kw + kw * 0.06, y + h * 0.04, kw * 0.88, h * 0.92);
  }
  const noires = [0, 1, 3, 4, 5];
  for (let i = 0; i < nb - 1; i++) {
    if (!noires.includes(i % 7)) continue;
    ctx.fillStyle = noir;
    ctx.fillRect(x + (i + 1) * kw - kw * 0.3, y + h * 0.04, kw * 0.6, h * 0.58);
  }
}
