#!/usr/bin/env node
// Musique et bruitages, entièrement synthétisés. Composition originale pour cette vidéo :
// sol mineur, 120 battements par minute, progression Solm – Mib – Sib – Fa, cloche en boucle,
// basse 808 saturée entre les coups, claps, charleston, roulement avant le coup final (Sol majeur).
// Lit la même grille que l'image (scene/cues.js). Écrit musique.wav, bruitages.wav et mix.wav.
//   node tools/musique.mjs [--sortie rendu/son] [--gain-musique dB] [--gain-bruitages dB]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAPPES, SONS, K, T, TEMPS, DUREE, IMG } from '../scene/cues.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const SORTIE = path.resolve(RACINE, arg('sortie', 'rendu/son'));
fs.mkdirSync(SORTIE, { recursive: true });

const SR = 48000;
const N = Math.round(DUREE * SR);
const piste = () => [new Float32Array(N), new Float32Array(N)];
const PI2 = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// hasard reproductible
function graine(s) { return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const bruitG = graine(1234);

// ---------------------------------------------------------------- outils de signal
function poser(p, t0, sig, { gain = 1, pan = 0, sigR = null } = {}) {
  const i0 = Math.round(t0 * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < sig.length; i++) {
    const j = i0 + i; if (j < 0 || j >= N) continue;
    p[0][j] += sig[i] * gl * Math.SQRT2; p[1][j] += (sigR ? sigR[i] : sig[i]) * gr * Math.SQRT2;
  }
}
const duree = (s) => new Float32Array(Math.max(1, Math.round(s * SR)));
function passeBas(x, fc, q = 0.707) { return biquad(x, 'pb', fc, q); }
function passeHaut(x, fc, q = 0.707) { return biquad(x, 'ph', fc, q); }
function passeBande(x, fc, q = 1) { return biquad(x, 'pbd', fc, q); }
function biquad(x, type, fc, q) {
  const fcF = typeof fc === 'function' ? fc : () => fc;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0, b1, b2, a1, a2, fPrec = -1;
  for (let i = 0; i < x.length; i++) {
    const f = Math.min(SR * 0.45, Math.max(10, fcF(i / SR)));
    if (Math.abs(f - fPrec) > 0.5) {
      fPrec = f;
      const w = PI2 * f / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
      let c0, c1, c2;
      if (type === 'pb') { c0 = (1 - cs) / 2; c1 = 1 - cs; c2 = (1 - cs) / 2; }
      else if (type === 'ph') { c0 = (1 + cs) / 2; c1 = -(1 + cs); c2 = (1 + cs) / 2; }
      else { c0 = al; c1 = 0; c2 = -al; }
      const a0 = 1 + al; b0 = c0 / a0; b1 = c1 / a0; b2 = c2 / a0; a1 = -2 * cs / a0; a2 = (1 - al) / a0;
    }
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const sature = (x, k) => { for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k) / Math.tanh(k); return x; };

// réverbération (peignes et passe-tout, à la Schroeder) et écho ping-pong
function reverb(p, { taille = 1, amort = 0.35, retour = 0.82 } = {}) {
  const out = piste();
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => Math.round(d * taille * SR / 44100));
  const aps = [556, 441, 341].map((d) => Math.round(d * SR / 44100));
  for (let c = 0; c < 2; c++) {
    const x = p[c], y = out[c], dec = c * 23;
    for (const dl0 of combs) {
      const dl = dl0 + dec, buf = new Float32Array(dl); let k = 0, f = 0;
      for (let i = 0; i < N; i++) { const o = buf[k]; f = o * (1 - amort) + f * amort; buf[k] = x[i] + f * retour; y[i] += o / combs.length; k = (k + 1) % dl; }
    }
    for (const dl0 of aps) {
      const dl = dl0 + dec, buf = new Float32Array(dl); let k = 0;
      for (let i = 0; i < N; i++) { const b = buf[k]; const v = -y[i] + b; buf[k] = y[i] + b * 0.5; y[i] = v; k = (k + 1) % dl; }
    }
  }
  return out;
}
function echo(p, temps, retour = 0.35, mixage = 0.4) {
  const d = Math.round(temps * SR);
  const out = piste();
  const bl = new Float32Array(N), br = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const il = i - d;
    bl[i] = (il >= 0 ? (p[0][il] + br[il] * retour) : 0);
    br[i] = (il >= 0 ? (p[1][il] * 0.6 + bl[il] * retour) : 0);
    out[0][i] = p[0][i] + bl[i] * mixage; out[1][i] = p[1][i] + br[i] * mixage;
  }
  return out;
}
function ajouterPiste(dst, src, g = 1) { for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) dst[c][i] += src[c][i] * g; }
function couper(p, t0, t1) { for (let c = 0; c < 2; c++) p[c].fill(0, Math.max(0, Math.round(t0 * SR)), Math.min(N, Math.round(t1 * SR))); }
function fondu(p, t0, t1) {
  for (let i = Math.round(t0 * SR); i < N; i++) {
    const k = i >= t1 * SR ? 0 : 1 - (i - t0 * SR) / ((t1 - t0) * SR);
    p[0][i] *= k * k; p[1][i] *= k * k;
  }
}

// ---------------------------------------------------------------- instruments
function grosseCaisse({ sourde = false, longue = false } = {}) {
  const x = duree(longue ? 1.2 : 0.45);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = 44 + 150 * Math.exp(-t * 38) + 30 * Math.exp(-t * 8);
    ph += PI2 * f / SR;
    const env = Math.exp(-t * (longue ? 2.6 : 6.5)) * Math.min(1, t * 900);
    x[i] = Math.sin(ph) * env + (t < 0.004 ? (bruitG() * 2 - 1) * (1 - t / 0.004) * 0.5 : 0);
  }
  sature(x, sourde ? 1.4 : 2.6);
  return sourde ? passeBas(x, 170, 0.8) : x;
}
function basse808(note, dureeNote, drive = 3.2) {
  const x = duree(dureeNote + 0.03);
  const f = mtof(note);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += PI2 * f * (1 + 0.06 * Math.exp(-t * 40)) / SR;
    const env = Math.min(1, t * 400) * Math.exp(-t * 3.2) * (t > dureeNote ? Math.max(0, 1 - (t - dureeNote) / 0.03) : 1);
    x[i] = (Math.sin(ph) + 0.35 * Math.sin(2 * ph)) * env;
  }
  return passeBas(sature(x, drive), 1400, 0.7);
}
// cloche : synthèse par modulation de fréquence (rapport 3,5 : timbre de cloche)
function cloche(note, { dec = 2.2, brillance = 1 } = {}) {
  const x = duree(1.6);
  const f = mtof(note);
  let pc = 0, pm = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    pm += PI2 * f * 3.5 / SR;
    const idx = (2.4 * Math.exp(-t * 6) + 0.25) * brillance;
    pc += PI2 * f / SR;
    const env = Math.min(1, t * 1500) * Math.exp(-t * dec);
    x[i] = (Math.sin(pc + idx * Math.sin(pm)) + 0.25 * Math.sin(2 * pc) * Math.exp(-t * 5)) * env;
  }
  return x;
}
function piano(note, dec = 3) {
  const x = duree(1.4);
  const f = mtof(note);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let v = 0;
    for (let h = 1; h <= 6; h++) v += Math.sin(PI2 * f * h * (1 + 0.0004 * h * h) * t) * Math.exp(-t * (dec + h * 1.2)) / h;
    x[i] = v * Math.min(1, t * 2000) * 0.6;
  }
  return passeBas(x, 4200);
}
function bruit(s) { const x = duree(s); for (let i = 0; i < x.length; i++) x[i] = bruitG() * 2 - 1; return x; }
function enveloppe(x, att, dec) { for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= Math.min(1, t / Math.max(att, 1e-4)) * Math.exp(-t * dec); } return x; }
function clap() {
  const x = bruit(0.25);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let e = Math.exp(-Math.max(0, t - 0.022) * 22);
    for (const o of [0, 0.009, 0.018]) if (t >= o && t < o + 0.008) e = Math.max(e, 1 - (t - o) / 0.008);
    x[i] *= e;
  }
  return passeBande(x, 1250, 0.9);
}
function charley(ouvert = false) { return enveloppe(passeHaut(bruit(ouvert ? 0.25 : 0.06), 7500), 0.0005, ouvert ? 14 : 70); }
function caisseClaire() {
  const n = enveloppe(passeBande(bruit(0.2), 2100, 0.7), 0.0005, 22);
  const x = duree(0.2);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = n[i] * 0.8 + Math.sin(PI2 * 190 * t) * Math.exp(-t * 30) * 0.5; }
  return x;
}
function cymbale(s = 1.8) { return enveloppe(passeHaut(bruit(s), 4800), 0.001, 2.2); }
function montee(t0, t1, f0, f1) {
  const x = bruit(t1 - t0);
  const y = passeBande(x, (t) => f0 * Math.pow(f1 / f0, t / (t1 - t0)), 2.5);
  for (let i = 0; i < y.length; i++) { const k = i / y.length; y[i] *= k * k; }
  return y;
}

// ---------------------------------------------------------------- la composition
const ACCORDS = { Gm: { b: 43, n: [55, 58, 62] }, Eb: { b: 51, n: [55, 58, 63] }, Bb: { b: 46, n: [53, 58, 62] }, F: { b: 41, n: [53, 57, 60] } };
const GRILLE = ['Gm', 'Eb', 'Gm', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'Bb', null];  // mesure 9 : Sib puis Fa ; mesure 10 : Sol majeur
const accordA = (t) => { const m = Math.floor(t / (4 * TEMPS)); if (m === 8) return t - 16 < 1 ? 'Bb' : 'F'; return GRILLE[m] || 'F'; };
const MELODIE = {
  Gm: [74, null, 70, null, 67, null, 70, 74],
  Eb: [75, null, 74, null, 70, null, 67, null],
  Bb: [77, null, 74, null, 70, null, 74, 77],
  F: [77, null, 75, null, 72, null, 69, null],
};

const kick = piste(), basse = piste(), clocheP = piste(), perc = piste(), fx = piste(), accord = piste();
const lointain = piste();
const frappesJouees = [];

// la montée étouffée : grosse caisse sourde, mélodie loin dans l'écho
for (const f of FRAPPES.filter((x) => x.t < K.fige)) { poser(kick, f.t, grosseCaisse({ sourde: true }), { gain: 0.11 + 0.08 * f.t / K.fige }); frappesJouees.push(f.t); }
for (let m = 0; m < 2; m++) {
  const mel = MELODIE[GRILLE[m]];
  mel.forEach((n, i) => { if (n) poser(lointain, m * 2 + i * TEMPS / 2, passeBas(cloche(n, { dec: 1.6, brillance: 0.6 }), 1600), { gain: 0.1 + 0.05 * m, pan: i % 2 ? 0.3 : -0.3 }); });
}
poser(fx, 2.0, passeBas(montee(2.0, K.fige, 300, 2400), 3000), { gain: 0.05 });

// la chute et les quatre mesures pleines, puis le resserrement (un coup par demi-temps)
for (const f of FRAPPES.filter((x) => x.t >= K.chute)) {
  const final = Math.abs(f.t - K.logo) < 1e-6;
  poser(kick, f.t, grosseCaisse({ longue: final || Math.abs(f.t - K.chute) < 1e-6 }), { gain: final ? 1.0 : 0.85 });
  frappesJouees.push(f.t);
}
// basse saturée entre les coups
for (let t = K.chute; t < T(9, 3) - 1e-6; t += TEMPS / (t >= T(7, 1) ? 4 : 2)) {
  const dense = t >= T(7, 1);
  const pos = ((t - K.chute) / (TEMPS / (dense ? 4 : 2))) % (dense ? 4 : 2);
  const entre = dense ? (Math.round(pos) % 2 === 1) : (Math.round(pos) === 1);
  if (!entre) continue;
  const a = ACCORDS[accordA(t)];
  poser(basse, t, basse808(a.b, dense ? 0.1 : 0.2), { gain: 0.5 });
}
// la cloche qui tourne en boucle
for (let m = 2; m < 9; m++) {
  const t0 = m * 2;
  for (let i = 0; i < 8; i++) {
    const t = t0 + i * TEMPS / 2;
    const nom = accordA(t);
    const n = MELODIE[nom][i];
    if (!n) continue;
    const filtre = m === 8 ? 1200 + 3000 * (1 - (t - 16) / 2) : 9000;
    poser(clocheP, t, passeBas(cloche(n), filtre), { gain: 0.3, pan: i % 2 ? 0.25 : -0.25 });
  }
}
// claps sur 2 et 4, charleston
for (let m = 2; m < 9; m++) for (const b of [1, 3]) { const t = m * 2 + b * TEMPS; if (t < T(9, 3)) poser(perc, t, clap(), { gain: 0.42, pan: 0.05 }); }
for (let t = K.chute; t < T(9, 3) - 1e-6; t += TEMPS / 4) {
  const k = Math.round((t - K.chute) / (TEMPS / 4));
  const accent = k % 4 === 2 ? 1 : 0.45;
  poser(perc, t, charley(k % 8 === 6), { gain: 0.12 * accent, pan: 0.35 });
}
// la chute : cymbale et grondement
poser(fx, K.chute, cymbale(1.6), { gain: 0.32 });
// la sortie : roulement qui accélère et montée, puis le coup final
{
  const debut = T(9, 3), fin = K.logo;
  let t = debut, pas = TEMPS / 2;
  while (t < fin - 0.02) {
    const k = (t - debut) / (fin - debut);
    poser(perc, t, caisseClaire(), { gain: 0.12 + 0.35 * k * k, pan: 0.0 });
    t += pas; pas = Math.max(TEMPS / 8, pas * 0.86);
  }
  poser(fx, debut, montee(debut, fin, 400, 7000), { gain: 0.32 });
}
poser(fx, K.logo, cymbale(2.0), { gain: 0.36 });
// accord final : Sol majeur avec neuvième, cloches et piano
for (const [n, g] of [[43, 0.0], [55, 0.32], [59, 0.26], [62, 0.26], [67, 0.24], [69, 0.18], [74, 0.14]]) {
  if (g > 0) poser(accord, K.logo, cloche(n, { dec: 1.5, brillance: 0.8 }), { gain: g * 0.6, pan: (n % 5 - 2) * 0.12 });
  poser(accord, K.logo, piano(n, 1.6), { gain: 0.35 });
}
poser(accord, K.logo, basse808(43, 1.2, 2.2), { gain: 0.45 });

// mélange de la musique
const musique = piste();
ajouterPiste(musique, kick, 1);
ajouterPiste(musique, basse, 1);
const clocheEcho = echo(clocheP, TEMPS * 0.75, 0.32, 0.35);
ajouterPiste(musique, clocheEcho, 1);
ajouterPiste(musique, reverb(clocheEcho, { taille: 1.1 }), 0.12);
const loin = echo(lointain, TEMPS * 0.75, 0.5, 0.6);
ajouterPiste(musique, loin, 0.5);
ajouterPiste(musique, reverb(loin, { taille: 1.4, retour: 0.86 }), 0.5);
ajouterPiste(musique, perc, 1);
ajouterPiste(musique, reverb(perc, { taille: 0.7, retour: 0.7 }), 0.08);
ajouterPiste(musique, fx, 1);
ajouterPiste(musique, accord, 1);
ajouterPiste(musique, reverb(accord, { taille: 1.3, retour: 0.8 }), 0.25);
// arrêt net sur le dernier temps de la mesure 2, silence jusqu'à la chute
couper(musique, K.fige, K.chute);
// sortie : tout s'éteint avant la dernière image
fondu(musique, 19.0, 19.92);

// ---------------------------------------------------------------- les bruitages (sous la musique)
const sfx = piste();
const B = {
  vibreur: () => { const x = duree(0.28); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(PI2 * 165 * t) * (0.6 + 0.4 * Math.sin(PI2 * 33 * t)) * Math.min(1, t * 200) * (t > 0.24 ? (0.28 - t) / 0.04 : 1); } return passeBas(sature(x, 2), 1200); },
  notesRapides: () => { const x = duree(0.5); [0, 0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.21].forEach((o, k) => { const p = piano(72 + [0, 4, 7, 11, 14, 7, 4, 12][k], 9); for (let i = 0; i < p.length && i + o * SR < x.length; i++) x[i + Math.round(o * SR)] += p[i] * 0.5; }); return passeBas(x, 2500); },
  papier: () => enveloppe(passeBande(bruit(0.22), 3200, 0.8), 0.01, 9),
  bulle: () => { const x = duree(0.12); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += PI2 * (900 - 2400 * t) / SR; x[i] = Math.sin(ph) * Math.exp(-t * 35); } return x; },
  bulles: () => { const x = duree(0.3); for (const o of [0, 0.04, 0.085, 0.12]) { const b = B.bulle(); for (let i = 0; i < b.length; i++) x[i + Math.round(o * SR)] += b[i] * 0.7; } return x; },
  tape: () => { const x = enveloppe(passeBas(bruit(0.08), 900), 0.0005, 45); for (let i = 0; i < x.length; i++) x[i] += Math.sin(PI2 * 120 * i / SR) * Math.exp(-i / SR * 40) * 0.6; return x; },
  inspiration: () => { const x = montee(0, 0.25, 600, 3000); return x; },
  aspiration: () => { const x = passeBande(bruit(0.5), (t) => 3000 * Math.exp(-t * 5) + 200, 1.5); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= Math.min(1, t * 30) * Math.exp(-t * 3); } return x; },
  clic: () => { const x = enveloppe(passeHaut(bruit(0.03), 2000), 0.0002, 200); for (let i = 0; i < 400; i++) x[i] += Math.sin(PI2 * 1800 * i / SR) * Math.exp(-i / 60); return x; },
  allumage: () => { const x = cloche(79, { dec: 3, brillance: 0.5 }); const y = enveloppe(passeHaut(bruit(0.6), 6000), 0.05, 5); for (let i = 0; i < y.length; i++) x[i] += y[i] * 0.4; return x; },
  depart: () => { const x = passeBande(bruit(0.45), (t) => 500 + 4000 * t / 0.45, 2); for (let i = 0; i < x.length; i++) { const k = i / x.length; x[i] *= Math.sin(Math.PI * k); } return x; },
  arrivee: () => { const x = duree(0.3); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(PI2 * (220 - 120 * t) * t) * Math.exp(-t * 18) + (bruitG() * 2 - 1) * Math.exp(-t * 60) * 0.4; } return x; },
  glisse: () => { const x = passeBande(bruit(0.4), (t) => 800 + 3000 * t, 3); for (let i = 0; i < x.length; i++) x[i] *= Math.sin(Math.PI * i / x.length) * 0.6; return x; },
  puce: () => { const x = cloche(86, { dec: 9, brillance: 0.4 }); return x.subarray(0, Math.round(0.35 * SR)); },
  papierVol: () => { const x = passeBande(bruit(0.45), (t) => 1500 + 1000 * Math.sin(t * 40), 1.2); for (let i = 0; i < x.length; i++) x[i] *= Math.sin(Math.PI * i / x.length) * 0.7; return x; },
  papierClaque: () => enveloppe(passeBande(bruit(0.15), 1800, 0.6), 0.0005, 30),
  piano: (s) => piano(s.note, 2.5),
  tampon: () => { const x = duree(0.35); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(PI2 * (90 - 40 * t) * t) * Math.exp(-t * 16) * 1.2 + (bruitG() * 2 - 1) * Math.exp(-t * 80) * 0.6; } return passeBas(x, 3000); },
  coche: () => { const x = cloche(91, { dec: 12, brillance: 0.3 }); return x.subarray(0, Math.round(0.25 * SR)); },
  cascade: (s) => { const x = cloche(79 + [0, 2, 3, 5][s.n % 4], { dec: 10, brillance: 0.3 }); return x.subarray(0, Math.round(0.3 * SR)); },
  cascadeLongue: () => { const x = duree(0.6); [79, 82, 86, 89, 91, 94].forEach((n, k) => { const c = cloche(n, { dec: 12, brillance: 0.3 }); const o = Math.round(k * 0.05 * SR); for (let i = 0; i < c.length && i + o < x.length; i++) x[i + o] += c[i] * 0.5; }); return x; },
  arpege: () => { const x = duree(1.0); [51, 55, 58, 63, 67, 70, 75, 79].forEach((n, k) => { const p = piano(n, 4); const o = Math.round(k * 0.035 * SR); for (let i = 0; i < p.length && i + o < x.length; i++) x[i + o] += p[i] * 0.6; }); return x; },
  page: () => { const x = passeBande(bruit(0.25), (t) => 2500 - 6000 * t, 0.9); for (let i = 0; i < x.length; i++) x[i] *= Math.sin(Math.PI * i / x.length); return x; },
  souffle: () => { const x = passeBande(bruit(0.9), (t) => 300 + 2200 * t, 1.2); for (let i = 0; i < x.length; i++) x[i] *= Math.sin(Math.PI * i / x.length); return x; },
  accordFinal: () => { const x = duree(1.6); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (bruitG() * 2 - 1) * Math.exp(-t * 3) * 0.2; } return passeHaut(x, 7000); },
  bouton: () => { const x = cloche(84, { dec: 14, brillance: 0.5 }); return x.subarray(0, Math.round(0.3 * SR)); },
};
const GAINS = { vibreur: 0.35, notesRapides: 0.16, papier: 0.3, bulle: 0.18, bulles: 0.16, tape: 0.3, inspiration: 0.12, aspiration: 0.28, clic: 0.22, allumage: 0.16, depart: 0.2, arrivee: 0.3, glisse: 0.12, puce: 0.14, papierVol: 0.18, papierClaque: 0.34, piano: 0.3, tampon: 0.42, coche: 0.14, cascade: 0.12, cascadeLongue: 0.12, arpege: 0.18, page: 0.2, souffle: 0.2, accordFinal: 0.3, bouton: 0.14 };
for (const s of SONS) {
  const sig = B[s.son](s);
  poser(sfx, s.t, sig, { gain: GAINS[s.son] ?? 0.2, pan: ((s.t * 7) % 1 - 0.5) * 0.4 });
}
couper(sfx, K.fige, K.chute);
fondu(sfx, 19.0, 19.92);

// ---------------------------------------------------------------- niveau, limiteur, écriture
function crete(p) { let m = 0; for (const c of p) for (const v of c) m = Math.max(m, Math.abs(v)); return m; }
function limiteur(p, plafond) {
  // limiteur à anticipation de 3 ms, relâche 80 ms
  const la = Math.round(0.003 * SR), rel = Math.exp(-1 / (0.08 * SR));
  const g = new Float32Array(N).fill(1);
  for (let i = 0; i < N; i++) { const a = Math.max(Math.abs(p[0][i]), Math.abs(p[1][i])); if (a > plafond) g[i] = plafond / a; }
  const gm = new Float32Array(N);
  let m = 1;
  for (let i = N - 1; i >= 0; i--) { m = Math.min(g[i], m + (1 - m) * 0.0); gm[i] = m; m = Math.min(1, m / rel); }
  let env = 1;
  for (let i = 0; i < N; i++) {
    let mn = 1; for (let k = 0; k <= la && i + k < N; k += 8) mn = Math.min(mn, gm[i + k]);
    env = mn < env ? mn : env + (mn - env) * (1 - rel);
    p[0][i] *= env; p[1][i] *= env;
  }
  return p;
}
// sonie intégrée (UIT-R BS.1770 : pondération K, blocs de 400 ms, double seuil)
function sonie(p) {
  const kw = (x) => {
    const etage = (x, b, a) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
    return etage(etage(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]), [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  };
  const a = kw(p[0]), b = kw(p[1]);
  const bloc = Math.round(0.4 * SR), pas = Math.round(0.1 * SR), z = [];
  for (let i = 0; i + bloc <= N; i += pas) { let s = 0; for (let k = i; k < i + bloc; k++) s += a[k] * a[k] + b[k] * b[k]; z.push(s / bloc); }
  const L = (m) => -0.691 + 10 * Math.log10(m);
  let g = z.filter((m) => L(m) > -70);
  const moy = (v) => v.reduce((x, y) => x + y, 0) / v.length;
  const rel = L(moy(g)) - 10;
  g = g.filter((m) => L(m) > rel);
  return L(moy(g));
}
function gainP(p, g) { for (const c of p) for (let i = 0; i < N; i++) c[i] *= g; return p; }
function ecrireWav(fichier, p) {
  const n = N, buf = Buffer.alloc(44 + n * 2 * 3);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 6, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 6, 28); buf.writeUInt16LE(6, 32); buf.writeUInt16LE(24, 34); buf.write('data', 36); buf.writeUInt32LE(n * 6, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    let v = Math.round(Math.max(-1, Math.min(1, p[c][i])) * 8388607);
    if (v < 0) v += 16777216;
    buf[o++] = v & 255; buf[o++] = (v >> 8) & 255; buf[o++] = (v >> 16) & 255;
  }
  fs.writeFileSync(fichier, buf);
}
const gm = Math.pow(10, +arg('gain-musique', 0) / 20), gs = Math.pow(10, +arg('gain-bruitages', 0) / 20);
gainP(musique, gm); gainP(sfx, gs);
const mix = piste(); ajouterPiste(mix, musique, 1); ajouterPiste(mix, sfx, 1);
// normalisation à -14 LUFS puis limiteur (crête d'échantillon -2 dBFS pour garder la crête vraie sous -1)
const CIBLE = -14, PLAF = Math.pow(10, -2.0 / 20);
for (const p of [musique, mix]) {
  for (let essai = 0; essai < 3; essai++) { const l = sonie(p); gainP(p, Math.pow(10, (CIBLE - l) / 20)); limiteur(p, PLAF); }
}
gainP(sfx, Math.pow(10, (CIBLE - sonie(mix)) / 20));
// silence absolu sur la dernière image
for (const p of [musique, sfx, mix]) couper(p, DUREE - IMG * 2, DUREE);
ecrireWav(path.join(SORTIE, 'musique.wav'), musique);
ecrireWav(path.join(SORTIE, 'bruitages.wav'), sfx);
ecrireWav(path.join(SORTIE, 'mix.wav'), mix);
fs.writeFileSync(path.join(SORTIE, 'frappes-jouees.json'), JSON.stringify(frappesJouees.map((t) => +t.toFixed(6))));
console.log('écrit :', SORTIE, '| crête mix', (20 * Math.log10(crete(mix))).toFixed(2), 'dBFS');
