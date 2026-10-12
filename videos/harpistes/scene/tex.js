// Les dessins de la vidéo : chaque surface est une fonction pure de ses paramètres.
import { enregistrer, rr, texte, largeur, triangleLecture, coche, chevronHaut, flecheRetour, cloche, crayon, clavierDessin, IMAGES } from './base.js';
import { C, POLICE, MAIN, hash, clamp, mix } from './lib.js';
import { MODULES, PLAQUE, disposition } from './donnees.js';

const ACC = C.accent;
const acc = (a) => `rgba(255,90,31,${a})`;

// ---------- Le problème ----------

// Badge d'alternant de Michaël (papier plastifié, éclairé par la scène)
enregistrer('badge', (ctx, W, H) => {
  ctx.fillStyle = '#5a5a60'; rr(ctx, 0, 0, W, H, W * 0.06); ctx.fill();
  ctx.fillStyle = '#4a4a50'; rr(ctx, W * 0.03, W * 0.03, W * 0.94, H - W * 0.06, W * 0.045); ctx.fill();
  // fente de l'attache
  ctx.fillStyle = '#1a1a1d'; rr(ctx, W * 0.38, H * 0.035, W * 0.24, H * 0.03, H * 0.015); ctx.fill();
  // bandeau supérieur
  ctx.fillStyle = '#6e6e75'; ctx.fillRect(W * 0.03, H * 0.09, W * 0.94, H * 0.07);
  texte(ctx, 'ALTERNANCE', W / 2, H * 0.143, { taille: W * 0.06, poids: 700, couleur: '#2c2c31', align: 'center', espace: W * 0.012 });
  // avatar générique
  ctx.fillStyle = '#3a3a3f'; ctx.beginPath(); ctx.arc(W / 2, H * 0.33, W * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b6b72';
  ctx.beginPath(); ctx.arc(W / 2, H * 0.305, W * 0.055, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W / 2, H * 0.395, W * 0.095, W * 0.06, 0, Math.PI, 0); ctx.fill();
  texte(ctx, 'MICHAËL', W / 2, H * 0.635, { taille: W * 0.24, poids: 800, couleur: '#eceae6', align: 'center', max: W * 0.94 });
  texte(ctx, 'Alternant', W / 2, H * 0.72, { taille: W * 0.1, poids: 500, couleur: '#b9b9bf', align: 'center' });
  // code-barres
  for (let i = 0; i < 46; i++) {
    const w = 1 + Math.floor(hash(i + 7) * 3);
    ctx.fillStyle = '#1d1d20';
    if (hash(i * 3 + 1) > 0.35) ctx.fillRect(W * 0.18 + i * W * 0.0139, H * 0.8, w * W * 0.0035, H * 0.1);
  }
});

// Écran du téléphone : un tuto vidéo générique, en gris (aucune marque)
// p : { k (instant d'animation), titre, vitesse, amas (0..1), pause, eteint }
enregistrer('tuto', (ctx, W, H, p) => {
  ctx.fillStyle = '#050506'; rr(ctx, 0, 0, W, H, H * 0.12); ctx.fill();
  if (p.eteint) {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0b0b0d'); g.addColorStop(0.5, '#141418'); g.addColorStop(1, '#09090a');
    ctx.fillStyle = g; rr(ctx, W * 0.02, H * 0.04, W * 0.96, H * 0.92, H * 0.08); ctx.fill();
    return;
  }
  const x0 = W * 0.025, y0 = H * 0.05, w = W * 0.95, h = H * 0.9;
  ctx.save(); rr(ctx, x0, y0, w, h, H * 0.07); ctx.clip();
  ctx.fillStyle = '#26262a'; ctx.fillRect(x0, y0, w, h);
  // notes qui tombent
  const kb = y0 + h * 0.72, nb = 28, kw = w / nb;
  const k = p.k || 0, v = (p.vitesse || 1) * 1.6;
  for (let i = 0; i < 70; i++) {
    const col = Math.floor(hash(i * 11 + 3) * nb);
    const len = h * (0.05 + hash(i * 5 + 1) * 0.14);
    const yy = ((hash(i * 17 + 2) * 1.6 + k * v) % 1.6) * h * 0.9 - h * 0.2 + y0;
    if (yy > kb) continue;
    ctx.fillStyle = hash(i) > 0.5 ? '#d6d6da' : '#9a9aa1';
    rr(ctx, x0 + col * kw + kw * 0.12, yy, kw * 0.76, Math.min(len, kb - yy), kw * 0.2); ctx.fill();
  }
  // l'amas : huit notes qui tombent ensemble sur le clavier
  if (p.amas > 0) {
    const cols = [6, 8, 9, 11, 13, 14, 16, 18];
    const yy = p.amas <= 1 ? mix(y0 - h * 0.3, kb - h * 0.22, p.amas) : kb - h * 0.22 + (p.amas - 1) * h * 0.24;
    const hh = Math.max(0, Math.min(h * 0.22, kb - yy));
    if (hh > 0) for (const c of cols) { ctx.fillStyle = '#f2f2f4'; rr(ctx, x0 + c * kw + kw * 0.1, yy, kw * 0.8, hh, Math.min(kw * 0.2, hh / 2)); ctx.fill(); }
  }
  // clavier du tuto
  const allumees = p.amas >= 1 && p.amas < 1.85 ? [6, 8, 9, 11, 13, 14, 16, 18] : [Math.floor(k * 9) % nb, Math.floor(k * 13 + 5) % nb];
  clavierDessin(ctx, x0, kb, w, h * 0.28, { nb, allumees, couleurAllumee: '#ffffff', blanc: '#b4b4ba', noir: '#141416', fond: '#18181b' });
  // dégradé de lecture et titre
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.3); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h * 0.3);
  if (p.titre) texte(ctx, p.titre, x0 + w * 0.04, y0 + h * 0.13, { taille: h * 0.095, poids: 700, couleur: '#ededf0', max: w * 0.7 });
  // barre de progression et temps
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x0 + w * 0.04, y0 + h * 0.955, w * 0.92, h * 0.012);
  ctx.fillStyle = '#e8e8ea'; ctx.fillRect(x0 + w * 0.04, y0 + h * 0.955, w * 0.92 * (0.07 + k * 0.01), h * 0.012);
  if (p.vitesse > 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(ctx, x0 + w * 0.76, y0 + h * 0.06, w * 0.2, h * 0.2, h * 0.04); ctx.fill();
    texte(ctx, '×' + p.vitesse, x0 + w * 0.86, y0 + h * 0.215, { taille: h * 0.17, poids: 800, couleur: '#ffffff', align: 'center' });
  }
  if (p.pause) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = 'rgba(240,240,242,0.92)';
    ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + h * 0.45, h * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#202024';
    ctx.fillRect(x0 + w / 2 - h * 0.065, y0 + h * 0.37, h * 0.04, h * 0.16);
    ctx.fillRect(x0 + w / 2 + h * 0.025, y0 + h * 0.37, h * 0.04, h * 0.16);
  }
  ctx.restore();
});

// Vignette de tuto qui jaillit du téléphone (même dessin des deux côtés)
// p : { titre (ou null : sans texte), duree, var }
enregistrer('carteTuto', (ctx, W, H, p) => {
  ctx.fillStyle = '#1c1c1f'; rr(ctx, 0, 0, W, H, W * 0.04); ctx.fill();
  const vx = W * 0.04, vy = W * 0.04, vw = W * 0.92, vh = vw * 9 / 16;
  ctx.save(); rr(ctx, vx, vy, vw, vh, W * 0.025); ctx.clip();
  ctx.fillStyle = ['#2f2f34', '#38383d', '#2a2a2e'][p.var % 3]; ctx.fillRect(vx, vy, vw, vh);
  const nb = 20, kw = vw / nb;
  for (let i = 0; i < 26; i++) {
    const c = Math.floor(hash(i * 13 + p.var * 31) * nb);
    const yy = vy + hash(i * 7 + p.var) * vh * 0.6;
    ctx.fillStyle = hash(i + p.var) > 0.5 ? '#c9c9ce' : '#85858c';
    rr(ctx, vx + c * kw + kw * 0.1, yy, kw * 0.8, vh * (0.06 + hash(i * 3) * 0.12), kw * 0.2); ctx.fill();
  }
  clavierDessin(ctx, vx, vy + vh * 0.72, vw, vh * 0.28, { nb, allumees: [3, 5, 7, 8, 10, 12, 14].map((x) => (x + p.var) % nb), couleurAllumee: '#ffffff', blanc: '#a8a8ae', noir: '#121214', fond: '#151517' });
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; rr(ctx, vx + vw * 0.77, vy + vh * 0.82, vw * 0.2, vh * 0.13, W * 0.01); ctx.fill();
  texte(ctx, p.duree || '48:12', vx + vw * 0.87, vy + vh * 0.925, { taille: vh * 0.1, poids: 600, couleur: '#f0f0f0', align: 'center' });
  const ty = vy + vh + (H - vy - vh) * 0.62;
  if (p.titre) texte(ctx, p.titre, W * 0.05, ty, { taille: (H - vh) * 0.42, poids: 700, couleur: '#ececee', max: W * 0.9 });
  else { ctx.fillStyle = '#4a4a50'; rr(ctx, W * 0.05, ty - (H - vh) * 0.3, W * (0.5 + hash(p.var) * 0.3), (H - vh) * 0.22, 6); ctx.fill(); }
});

// Notes de Michaël sur une feuille (papier sombre), raturées selon r (0..1)
enregistrer('notes', (ctx, W, H, p) => {
  ctx.fillStyle = C.papier; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(60,70,90,0.35)'; ctx.lineWidth = H * 0.003;
  for (let y = H * 0.12; y < H; y += H * 0.065) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const encre = '#26252d';
  texte(ctx, 'Do  Mi  Sol ?', W * 0.1, H * 0.2, { taille: H * 0.1, poids: 700, police: MAIN, couleur: encre });
  texte(ctx, 'main droite ??', W * 0.1, H * 0.33, { taille: H * 0.075, poids: 600, police: MAIN, couleur: encre });
  // croquis de clavier maladroit
  ctx.strokeStyle = encre; ctx.lineWidth = H * 0.006;
  const kx = W * 0.1, ky = H * 0.45, kw = W * 0.8, kh = H * 0.2;
  ctx.strokeRect(kx, ky, kw, kh);
  for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(kx + kw * i / 10, ky); ctx.lineTo(kx + kw * i / 10 + (hash(i) - 0.5) * 6, ky + kh); ctx.stroke(); }
  ctx.fillStyle = encre;
  for (const i of [1, 2, 4, 5, 6, 8, 9]) ctx.fillRect(kx + kw * i / 10 - kw * 0.025, ky, kw * 0.05, kh * 0.6);
  texte(ctx, '?', kx + kw * 0.3, ky + kh + H * 0.08, { taille: H * 0.09, poids: 700, police: MAIN, couleur: encre });
  texte(ctx, '?', kx + kw * 0.62, ky + kh + H * 0.09, { taille: H * 0.09, poids: 700, police: MAIN, couleur: encre });
  // la rature
  const r = clamp(p.r || 0);
  if (r > 0) {
    ctx.strokeStyle = '#1b1a21'; ctx.lineWidth = H * 0.02; ctx.lineCap = 'round';
    const tracer = (a, b, k) => { if (k <= 0) return; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(mix(a[0], b[0], k), mix(a[1], b[1], k)); ctx.stroke(); };
    tracer([W * 0.06, H * 0.08], [W * 0.95, H * 0.8], clamp(r * 2));
    tracer([W * 0.92, H * 0.1], [W * 0.08, H * 0.75], clamp(r * 2 - 1));
  }
});

// Le carnet de chants de Michaël, fermé
enregistrer('carnet', (ctx, W, H) => {
  ctx.fillStyle = '#34343a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2a2a2f'; ctx.fillRect(0, 0, W * 0.07, H);
  ctx.strokeStyle = '#4a4a51'; ctx.lineWidth = W * 0.008; ctx.strokeRect(W * 0.12, H * 0.06, W * 0.82, H * 0.88);
  texte(ctx, 'Chants', W * 0.53, H * 0.3, { taille: W * 0.15, poids: 700, couleur: '#cfcdc8', align: 'center' });
  texte(ctx, 'de louange', W * 0.53, H * 0.4, { taille: W * 0.115, poids: 500, couleur: '#a9a7a2', align: 'center' });
  // étiquette manuscrite
  ctx.fillStyle = '#8a857c'; rr(ctx, W * 0.24, H * 0.62, W * 0.58, H * 0.14, W * 0.02); ctx.fill();
  texte(ctx, 'Michaël', W * 0.53, H * 0.715, { taille: W * 0.13, poids: 700, police: MAIN, couleur: '#24232a', align: 'center' });
});

// Le carnet ouvert : p.cote = 'g' (page de gauche) ou 'd' (page de droite), chacune W x H
enregistrer('carnetPage', (ctx, W, H, p) => {
  ctx.save();
  if (p.cote === 'd') ctx.translate(-W, 0);
  DESSIN_CARNET_OUVERT(ctx, W * 2, H, p);
  ctx.restore();
});
function DESSIN_CARNET_OUVERT(ctx, W, H, p) {
  ctx.fillStyle = '#7b766d'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(W * 0.49, 0, W * 0.02, H);
  const encre = '#23222a';
  texte(ctx, 'Chant de louange', W * 0.05, H * 0.15, { taille: H * 0.085, poids: 700, police: MAIN, couleur: encre });
  const grilles = [['Do', 'Fa', 'Sol', 'Do'], ['Lam', 'Fa', 'Do', 'Sol'], ['Fa', 'Sol', 'Do', 'Do']];
  grilles.forEach((g, i) => {
    const y = H * (0.32 + i * 0.2);
    ctx.strokeStyle = encre; ctx.lineWidth = H * 0.006;
    for (let k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(W * 0.05 + k * W * 0.105, y - H * 0.08); ctx.lineTo(W * 0.05 + k * W * 0.105, y + H * 0.04); ctx.stroke(); }
    g.forEach((a, k) => texte(ctx, a, W * 0.072 + k * W * 0.105, y, { taille: H * 0.075, poids: 700, police: MAIN, couleur: encre }));
  });
  // page de droite : le clavier et les doigts
  clavierDessin(ctx, W * 0.56, H * 0.25, W * 0.38, H * 0.22, { nb: 10, allumees: p.accent ? [0, 2, 4] : [], couleurAllumee: ACC, blanc: '#c8c3b8', noir: encre, fond: encre });
  texte(ctx, '1   3   5', W * 0.565, H * 0.56, { taille: H * 0.07, poids: 700, police: MAIN, couleur: encre });
  if (p.accent) { ctx.fillStyle = ACC; ctx.fillRect(W * 0.86, 0, W * 0.035, H * 0.28); }
}

// Dessus du clavier de Michaël : panneau et touches (61 touches, 36 blanches)
// p : { allumees: indices de touches blanches allumées, gris }
enregistrer('clavier', (ctx, W, H, p) => {
  ctx.fillStyle = '#141416'; ctx.fillRect(0, 0, W, H);
  // panneau arrière
  ctx.fillStyle = '#1c1c1f'; ctx.fillRect(0, 0, W, H * 0.5);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = '#2c2c30'; ctx.beginPath(); ctx.arc(W * (0.06 + i * 0.035), H * 0.22, H * 0.05, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#0c0c0d'; rr(ctx, W * 0.4, H * 0.12, W * 0.2, H * 0.18, H * 0.02); ctx.fill();
  for (let i = 0; i < 10; i++) { ctx.fillStyle = '#252528'; rr(ctx, W * (0.68 + i * 0.026), H * 0.18, W * 0.018, H * 0.08, H * 0.01); ctx.fill(); }
  // touches
  const y0 = H * 0.53, kh = H * 0.45, nb = 36, kw = W / nb;
  const allumees = p.allumees || [];
  for (let i = 0; i < nb; i++) {
    const on = allumees.includes(i);
    ctx.fillStyle = on ? ACC : (p.gris ? '#8e8e93' : '#9a968f');
    ctx.fillRect(i * kw + kw * 0.04, y0, kw * 0.92, kh);
    if (on) { ctx.fillStyle = 'rgba(255,220,190,0.5)'; ctx.fillRect(i * kw + kw * 0.04, y0 + kh * 0.75, kw * 0.92, kh * 0.25); }
  }
  for (let i = 0; i < nb - 1; i++) {
    if (![0, 1, 3, 4, 5].includes(i % 7)) continue;
    ctx.fillStyle = '#0b0b0c';
    ctx.fillRect((i + 1) * kw - kw * 0.29, y0, kw * 0.58, kh * 0.6);
  }
});

// Carte d'émission du clavier : seules les touches allumées brillent
enregistrer('clavierLum', (ctx, W, H, p) => {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const y0 = H * 0.53, kh = H * 0.45, nb = 36, kw = W / nb;
  for (const i of p.allumees || []) { ctx.fillStyle = ACC; ctx.fillRect(i * kw + kw * 0.04, y0, kw * 0.92, kh); }
  for (let i = 0; i < nb - 1; i++) {
    if (![0, 1, 3, 4, 5].includes(i % 7)) continue;
    ctx.fillStyle = '#000'; ctx.fillRect((i + 1) * kw - kw * 0.29, y0, kw * 0.58, kh * 0.6);
  }
});

// Aplat de couleur
enregistrer('uni', (ctx, W, H, p) => { ctx.fillStyle = p.c; ctx.fillRect(0, 0, W, H); });

// ---------- L'interface de l'École des harpistes ----------

// Vignette d'une leçon : la vraie montre le professeur ; ici, un clavier sans personne
function vignette(ctx, x, y, w, h, { gris = false, lecture = 0, annexe = false, accent = false, var: v = 0 }) {
  ctx.save(); rr(ctx, x, y, w, h, h * 0.08); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (gris) { g.addColorStop(0, '#3a3a3e'); g.addColorStop(1, '#202023'); }
  else { g.addColorStop(0, '#4a3b30'); g.addColorStop(1, '#1c1714'); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // petite lampe chaude du décor
  ctx.fillStyle = gris ? 'rgba(200,200,205,0.35)' : 'rgba(255,190,120,0.55)';
  ctx.beginPath(); ctx.arc(x + w * 0.74, y + h * 0.42, h * 0.05, 0, Math.PI * 2); ctx.fill();
  const allumees = lecture > 0 ? [7] : (v % 2 ? [5, 9] : [7]);
  clavierDessin(ctx, x + w * 0.16, y + h * 0.6, w * 0.68, h * 0.18, { nb: 22, allumees, couleurAllumee: accent ? ACC : (gris ? '#9c9ca2' : '#cfc9bf'), blanc: gris ? '#bdbdc2' : '#d9d3c8', noir: '#121212', fond: '#111' });
  ctx.fillStyle = gris ? '#26262a' : '#1d1915'; ctx.fillRect(x, y + h * 0.84, w, h * 0.16);
  // logo de l'école en filigrane
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = h * 0.012;
  ctx.beginPath(); ctx.arc(x + w * 0.9, y + h * 0.17, h * 0.08, 0, Math.PI * 2); ctx.stroke();
  if (IMAGES.logoH) { const s = h * 0.09; ctx.globalAlpha = 0.8; ctx.drawImage(IMAGES.logoH, x + w * 0.9 - s * 0.42, y + h * 0.17 - s * 0.5, s * 0.84, s); ctx.globalAlpha = 1; }
  if (annexe) {
    ctx.save(); ctx.translate(x + w * 0.16, y + h * 0.3); ctx.rotate(-0.12);
    ctx.fillStyle = '#c9c0b0'; ctx.fillRect(-h * 0.13, -h * 0.17, h * 0.26, h * 0.34);
    ctx.fillStyle = ACC; ctx.fillRect(-h * 0.13, -h * 0.17, h * 0.26, h * 0.05);
    texte(ctx, 'Do', 0, h * 0.08, { taille: h * 0.14, poids: 700, police: MAIN, couleur: '#2a2a30', align: 'center' });
    ctx.restore();
  }
  ctx.restore();
  // barre de progression sous la vignette
  if (lecture > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, x, y + h - h * 0.075, w, h * 0.075, h * 0.03); ctx.fill();
    ctx.fillStyle = ACC; rr(ctx, x, y + h - h * 0.075, w * clamp(lecture), h * 0.075, h * 0.03); ctx.fill();
  }
}

const PUCES = [['lecture', 'Vue'], ['crayon', 'Annexe'], ['coche', 'Exercice']];

// Une leçon (repère : 880 x 229), utilisée par la plaque, par la leçon suivie et par les gros plans
// e : { gris, allume (0..1), lecture (0..1), puces [0..1 x3], annexe, fait (0..1), fond }
export function ligne(ctx, x, y, titre, duree, e = {}) {
  const W = 880, H = 229;
  if (e.fond !== false) { ctx.fillStyle = '#000'; ctx.fillRect(x, y, W, H); }
  const al = clamp(e.allume || 0);
  if (al > 0) {
    ctx.fillStyle = acc(0.10 * al); rr(ctx, x + 2, y + 6, W - 4, H - 12, 18); ctx.fill();
    ctx.strokeStyle = acc(al); ctx.lineWidth = 5; rr(ctx, x + 4, y + 8, W - 8, H - 16, 18); ctx.stroke();
  }
  vignette(ctx, x + 17, y + 37, 276, 155, { gris: e.gris, lecture: e.lecture || 0, annexe: e.annexe, accent: !e.gris && (e.lecture > 0 || al > 0) });
  const fait = clamp(e.fait || 0);
  const coulTitre = e.gris ? '#c9c9cd' : '#f4f2ee';
  texte(ctx, titre, x + 331, y + 64, { taille: 36, poids: 700, couleur: coulTitre, max: 530 });
  texte(ctx, `Video • ${duree}`, x + 331, y + 178, { taille: 30, poids: 500, couleur: e.gris ? '#7c7c82' : '#8e8e93' });
  if (fait > 0 && !e.puces) {
    // leçon terminée : la coche orange à droite
    ctx.globalAlpha = fait;
    ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(x + 830, y + 166, 24, 0, Math.PI * 2); ctx.fill();
    coche(ctx, x + 830, y + 166, 22, '#fff', 0.24);
    ctx.globalAlpha = 1;
  }
  // les trois traces du fil
  if (e.puces) {
    let px = x + 331;
    e.puces.forEach((k, i) => {
      const [ic, mot] = PUCES[i];
      const w = 64 + largeur(ctx, mot, { taille: 34, poids: 700 });
      if (k > 0) {
        const s = 0.6 + 0.4 * Math.min(1, k) + 0.12 * Math.sin(Math.min(1, k) * Math.PI);
        ctx.save(); ctx.translate(px + w / 2, y + 116); ctx.scale(s, s);
        ctx.globalAlpha = clamp(k * 2);
        ctx.fillStyle = ACC; rr(ctx, -w / 2, -26, w, 52, 26); ctx.fill();
        const cx = -w / 2 + 30;
        if (ic === 'lecture') triangleLecture(ctx, cx, 0, 16, '#fff');
        if (ic === 'crayon') crayon(ctx, cx, 0, 18, '#fff');
        if (ic === 'coche') coche(ctx, cx, 0, 18, '#fff', 0.26);
        texte(ctx, mot, cx + 22, 12, { taille: 34, poids: 700, couleur: '#fff' });
        ctx.restore();
      }
      px += w + 12;
    });
  }
}

// Bandeau de section : titre, compteur n/total, remplissage orange proportionnel (repère 920 x 102)
export function bandeau(ctx, x, y, titre, n, total, { gris = false, accent = 1, remplissage } = {}) {
  const W = 920, H = 102;
  ctx.fillStyle = '#1c1c1e'; ctx.fillRect(x, y, W, H);
  const f = remplissage ?? n / total;
  if (f > 0 && !gris) { ctx.fillStyle = acc(Math.min(0.6, 0.38 * accent)); ctx.fillRect(x, y, W * f, H); }
  ctx.fillStyle = '#2c2c2e'; ctx.fillRect(x, y, W, 2); ctx.fillRect(x, y + H - 2, W, 2);
  chevronHaut(ctx, x + 66, y + H / 2, 15, '#d8d8dc');
  texte(ctx, titre, x + 113, y + 66, { taille: 46, poids: 700, couleur: '#f4f2ee', max: 640 });
  texte(ctx, `${n}/${total}`, x + 880, y + 66, { taille: 38, poids: 400, couleur: n === total && !gris ? '#ffffff' : '#8e8e93', align: 'right', italique: true });
}

// En-tête du module : retour, icône de l'application, titre, cloche
function enTete(ctx, mod, y) {
  flecheRetour(ctx, 48, y + 75, 16, '#f2f2f4');
  ctx.save(); rr(ctx, 104, y + 38, 74, 74, 16); ctx.clip();
  const g = ctx.createLinearGradient(104, y + 38, 178, y + 112); g.addColorStop(0, '#1d2a33'); g.addColorStop(1, '#0d1013');
  ctx.fillStyle = g; ctx.fillRect(104, y + 38, 74, 74);
  clavierDessin(ctx, 104, y + 92, 74, 20, { nb: 8, blanc: '#cfd4d8', noir: '#0d0d0d', fond: '#0d0d0d' });
  if (IMAGES.logoH) ctx.drawImage(IMAGES.logoH, 126, y + 46, 32, 38);
  ctx.restore();
  texte(ctx, mod.titre, 198, y + 70, { taille: 36, poids: 700, couleur: '#f4f2ee', max: 600 });
  texte(ctx, 'Course Module', 198, y + 108, { taille: 27, poids: 400, couleur: '#8e8e93' });
  cloche(ctx, 858, y + 72, 26, '#f2f2f4');
  ctx.fillStyle = '#2c2c2e'; ctx.fillRect(0, y + 148, 920, 2);
}

// La plaque d'interface d'un module. p : { m (A, B, C), gris, etats: {"si-li": e}, compteurs: {si: n}, sansFil }
enregistrer('plaque', (ctx, W, H, p) => {
  ctx.scale(W / PLAQUE.L, H / PLAQUE.H);
  ctx.fillStyle = p.gris ? 'rgba(6,6,7,0.9)' : 'rgba(4,4,5,0.9)'; ctx.fillRect(0, 0, PLAQUE.L, PLAQUE.H);
  const mod = MODULES[p.m];
  enTete(ctx, mod, PLAQUE.margeHaut);
  if (p.vide) return;
  const d = disposition(mod);
  d.sections.forEach(({ si, y }) => {
    const s = mod.sections[si];
    bandeau(ctx, 0, y, s.titre, (p.compteurs || {})[si] || 0, s.total, { gris: p.gris, accent: p.fort ? 1.7 : 1 });
  });
  d.lignes.forEach(({ si, li, y }) => {
    const [titre, duree] = mod.sections[si].lecons[li];
    const e = (p.etats || {})[`${si}-${li}`] || {};
    if (p.sansFil && si === 0 && li === 0) { ctx.fillStyle = '#000'; ctx.fillRect(20, y, 880, 229); return; }
    ligne(ctx, 20, y, titre, duree, { gris: p.gris, ...e });
  });
});

// Gros plan d'une leçon (haute définition) : 880 x 229 dans le repère des captures
enregistrer('ligne', (ctx, W, H, p) => {
  ctx.scale(W / 880, H / 229);
  ligne(ctx, 0, 0, p.titre, p.duree, p.e || {});
});

// Gros plan d'un bandeau de section
enregistrer('bandeau', (ctx, W, H, p) => {
  ctx.scale(W / 920, H / 102);
  bandeau(ctx, 0, 0, p.titre, p.n, p.total, { gris: p.gris, accent: p.fort ? 1.7 : 1, remplissage: p.remplissage });
});

// ---------- Les gestes ----------

// Bouton lecture : disque orange et triangle blanc (découpe en relief)
enregistrer('disqueLecture', (ctx, W, H) => {
  ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.48, 0, Math.PI * 2); ctx.fill();
  triangleLecture(ctx, W * 0.53, H / 2, W * 0.26, '#ffffff');
});

// L'annexe manuscrite (même dessin des deux côtés)
enregistrer('annexe', (ctx, W, H) => {
  ctx.fillStyle = '#857e72'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ACC; ctx.fillRect(0, 0, W, H * 0.035);
  const encre = '#24232b';
  texte(ctx, 'Annexe', W * 0.08, H * 0.12, { taille: H * 0.055, poids: 700, couleur: '#5a5148' });
  texte(ctx, 'Do & Octaves', W * 0.08, H * 0.23, { taille: H * 0.085, poids: 700, police: MAIN, couleur: encre });
  // croquis net : 8 touches, Do entouré deux fois, arc d'octave
  const kx = W * 0.08, ky = H * 0.33, kw = W * 0.84, kh = H * 0.22;
  ctx.strokeStyle = encre; ctx.lineWidth = H * 0.005; ctx.strokeRect(kx, ky, kw, kh);
  for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(kx + kw * i / 8, ky); ctx.lineTo(kx + kw * i / 8, ky + kh); ctx.stroke(); }
  ctx.fillStyle = encre;
  for (const i of [1, 2, 4, 5, 6]) ctx.fillRect(kx + kw * i / 8 - kw * 0.03, ky, kw * 0.06, kh * 0.6);
  ctx.strokeStyle = ACC; ctx.lineWidth = H * 0.008;
  for (const i of [0, 7]) { ctx.beginPath(); ctx.ellipse(kx + kw * (i + 0.5) / 8, ky + kh * 0.8, kw * 0.05, kh * 0.17, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = encre; ctx.lineWidth = H * 0.005;
  ctx.beginPath(); ctx.moveTo(kx + kw * 0.5 / 8, ky + kh + H * 0.03); ctx.quadraticCurveTo(kx + kw / 2, ky + kh + H * 0.12, kx + kw * 7.5 / 8, ky + kh + H * 0.03); ctx.stroke();
  texte(ctx, 'Do', kx + kw * 0.5 / 8, ky + kh + H * 0.17, { taille: H * 0.07, poids: 700, police: MAIN, couleur: encre, align: 'center' });
  texte(ctx, 'Do', kx + kw * 7.5 / 8, ky + kh + H * 0.17, { taille: H * 0.07, poids: 700, police: MAIN, couleur: encre, align: 'center' });
  texte(ctx, '1 octave', W / 2, ky + kh + H * 0.13, { taille: H * 0.055, poids: 600, police: MAIN, couleur: encre, align: 'center' });
  texte(ctx, 'Pouce = 1', W * 0.08, H * 0.88, { taille: H * 0.075, poids: 700, police: MAIN, couleur: encre });
});

// La coche (découpe en relief)
enregistrer('coche', (ctx, W, H) => { coche(ctx, W / 2, H / 2, W * 0.42, ACC, 0.3); });

// ---------- La signature ----------

// La leçon qui devient le logo : u = 0 la carte, u = 1 le H. Carré de S mètres de côté.
export const LOGO = { S: 0.62, carte: [0.593, 0.1543], hH: 0.16 };
enregistrer('filLogo', (ctx, W, H, p) => {
  const u = clamp(p.u || 0), k = W / LOGO.S;
  const cx = W / 2, cy = H / 2;
  const [cw, ch] = LOGO.carte.map((v) => v * k);
  const hH = LOGO.hH * k, wH = hH * 1710 / 2048;
  if (u <= 0) {
    // la carte : la leçon complète, telle qu'à l'écran
    ctx.save(); ctx.translate(cx - cw / 2, cy - ch / 2); ctx.scale(cw / 880, ch / 229);
    ctx.fillStyle = '#0b0b0c'; rr(ctx, 0, 0, 880, 229, 18); ctx.fill();
    ligne(ctx, 0, 0, 'Do & Octaves', '6m', { allume: 1, lecture: 1, annexe: true, puces: [1, 1, 1], fond: false });
    ctx.restore();
    return;
  }
  const a = clamp(u / 0.3);            // la carte devient orange plein
  const b = clamp((u - 0.25) / 0.45);  // elle se fend en deux jambes
  const c = clamp((u - 0.62) / 0.38);  // les jambes deviennent le H
  const eb = b * b * (3 - 2 * b);
  ctx.fillStyle = ACC;
  if (c < 1) {
    ctx.globalAlpha = 1;
    for (const s of [-1, 1]) {
      const w = mix(cw / 2 - 4, wH * 0.36, eb), h = mix(ch, hH * 0.92, eb);
      const x = cx + s * mix(cw / 4 + 2, wH * 0.31, eb);
      ctx.save(); ctx.translate(x, cy); ctx.transform(1, mix(0, -0.27 * s * -1, eb) * 0, 0, 1, 0, 0);
      rr(ctx, -w / 2, -h / 2, w, h, mix(18 * cw / 880, w * 0.12, eb)); ctx.fill();
      ctx.restore();
    }
    if (a < 1) {
      // le contenu de la leçon s'efface en orange
      ctx.save(); ctx.globalAlpha = 1 - a; ctx.translate(cx - cw / 2, cy - ch / 2); ctx.scale(cw / 880, ch / 229);
      ctx.fillStyle = '#0b0b0c'; rr(ctx, 0, 0, 880, 229, 18); ctx.fill();
      ligne(ctx, 0, 0, 'Do & Octaves', '6m', { allume: 1, lecture: 1, annexe: true, puces: [1, 1, 1], fond: false });
      ctx.restore();
    }
  }
  if (c > 0) {
    // le H exact, fondu par seuil (le moteur découpe à 50 %) : on mélange les alphas
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const t2 = tmp.getContext('2d');
    t2.drawImage(IMAGES.logoH, cx - wH / 2, cy - hH / 2, wH, hH);
    t2.globalCompositeOperation = 'source-in'; t2.fillStyle = ACC; t2.fillRect(0, 0, W, H);
    ctx.globalAlpha = c; ctx.drawImage(tmp, 0, 0); ctx.globalAlpha = 1;
    if (c >= 1) { ctx.clearRect(0, 0, W, H); ctx.drawImage(tmp, 0, 0); }
  }
});

// L'anneau de texte du logo : « ECOLE DES HARPISTES. » deux fois (blanc)
enregistrer('anneau', (ctx, W, H) => {
  const cx = W / 2, cy = H / 2, r = W * 0.42;
  const txt = 'ECOLE DES HARPISTES. ECOLE DES HARPISTES. ';
  ctx.font = `400 ${W * 0.055}px ${POLICE}`;
  ctx.fillStyle = '#f4f1ec'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const n = txt.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.rotate(a + Math.PI / 2);
    ctx.fillText(txt[i], 0, 0); ctx.restore();
  }
});

// Le nom (découpe en relief, blanc)
enregistrer('nom', (ctx, W, H, p) => {
  const r = clamp(p.revele ?? 1);
  ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - W * r / 2, 0, W * r, H); ctx.clip();
  texte(ctx, 'L\'École des harpistes', W / 2, H * 0.72, { taille: H * 0.78, poids: 700, couleur: '#f4f1ec', align: 'center', max: W * 0.98 });
  ctx.restore();
});

// Le bouton
enregistrer('bouton', (ctx, W, H) => {
  ctx.fillStyle = ACC; rr(ctx, 0, 0, W, H, H / 2); ctx.fill();
  texte(ctx, 'Inscris-toi', W / 2, H * 0.66, { taille: H * 0.46, poids: 700, couleur: '#ffffff', align: 'center' });
});
