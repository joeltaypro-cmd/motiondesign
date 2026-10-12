// La chorégraphie : le monde, les chronologies (écrites une fois) et les plans, chacun sous son axe.
import { T as TX } from './base.js';
import { LOGO } from './tex.js';
import { PLANS, K, T as TM, IMG } from './cues.js';
import { boite, dans, point, aPlat, secousse, eclair, versEcran, tailleMonde, faceA, repereCam, projeter } from './outils.js';
import {
  clamp, mix, prog, anim, anim3, E, hash, lerp3, hex, C, rotation, mat3mul, mat3vec, add, sub, mul, norm, len,
  rotEntre, bezier,
} from './lib.js';
import { MODULES, PLAQUE, disposition } from './donnees.js';

const U = 0.62 / PLAQUE.L;                 // mètres par unité des captures
const PL_L = 0.62, PL_H = PLAQUE.H * U, PL_E = 0.012;
const HAUT = 0.085;                        // dessus du clavier
const DEG = Math.PI / 180;
const img = (t) => Math.round(t * 60) / 60;

// ---------------------------------------------------------------- ambiance (froid -> chaud)
const chaleur = (t) => E.inout2(prog(K.chaud[0], K.chaud[1] + 0.3, t));
function ambiance(t, o = {}) {
  const k = chaleur(t);
  const env = {
    fond: lerp3(hex('#0a0b0e'), hex('#0d0a10'), k),
    halo: lerp3(hex('#3c4556'), hex('#5b2f92'), k), haloI: mix(0.45, 0.85, k),
    ambiante: lerp3(hex('#a7b6d0'), hex('#c8a0d4'), k), ambI: mix(0.07, 0.085, k),
    sol: hex('#060607'), reflet: o.reflet ?? 0.1, flouSol: 0.03,
    brume: o.brume || [2.6, 7.5], dirHalo: o.dirHalo || [0, -1], haloNet: 4,
  };
  const lumieres = [
    { p: o.cle || [-0.9, 1.7, 1.2], couleur: lerp3(hex('#d5e0ff'), hex('#ffcf9f'), k), i: (o.cleI ?? 3.2) * mix(1, 1.1, k), rayon: 0.3 },
    { p: o.contre || [1.0, 0.9, -1.2], couleur: lerp3(hex('#8ea4d6'), hex('#9a6cff'), k), i: o.contreI ?? 1.5, rayon: 0.2, ombre: false },
  ];
  if (o.ecranTel) lumieres.push(o.ecranTel);
  if (o.extra) lumieres.push(...o.extra);
  return { env, lumieres };
}

// ---------------------------------------------------------------- le clavier, le pupitre
const CLAVIER = { p: [0, HAUT / 2, 0], rot: aPlat(0), d: [1.0, 0.30, HAUT] };
const xTouche = (i) => -0.5 + (i + 0.5) / 36;
const NOIRES = (i) => [0, 1, 3, 4, 5].includes(i % 7);
function clavier(tf, allumees = []) {
  return boite({
    ...CLAVIER, r: 0.014, tex: TX('clavier', { allumees, gris: tf < K.couleur }, 2400, 720), eclairee: true,
    emissif: allumees.length ? TX('clavierLum', { allumees }, 1200, 360) : undefined, emit: 1.8,
    couleur: hex('#18181b'), brillance: 0.55, vernis: 0.18,
  });
}
// touches en relief pour les gros plans : i0..i1 (touches blanches), allumées et enfoncées
function touches(i0, i1, allumees = [], enfoncees = {}) {
  const out = [];
  for (let i = i0; i <= i1; i++) {
    const on = allumees.includes(i), dz = enfoncees[i] || 0;
    out.push(boite({
      p: [xTouche(i), HAUT + 0.006 - dz, 0.077], rot: aPlat(0), d: [1 / 36 - 0.0012, 0.134, 0.012], r: 0.0015,
      tex: on ? TX('uni', { c: C.accent }, 8, 8) : undefined, emit: 2.2, couleur: hex('#d9d5cd'), brillance: 0.6, vernis: 0.15,
    }));
    if (i < i1 && NOIRES(i)) {
      out.push(boite({ p: [xTouche(i) + 1 / 72, HAUT + 0.014, 0.047], rot: aPlat(0), d: [0.0145, 0.078, 0.02], r: 0.002, couleur: hex('#0e0e10'), brillance: 0.75, vernis: 0.3 }));
    }
  }
  return out;
}
const PUPITRE = { p: [0.03, HAUT + 0.08 * Math.cos(12 * DEG), -0.07 - 0.08 * Math.sin(12 * DEG)], rot: rotation(-12, 0, 0) };
function pupitre() {
  return [
    boite({ ...PUPITRE, d: [0.56, 0.16, 0.008], r: 0.006, couleur: hex('#141416'), brillance: 0.6, vernis: 0.2 }),
    dans(PUPITRE, { p: [0, -0.075, 0.012], d: [0.56, 0.01, 0.022], r: 0.003, couleur: hex('#141416'), brillance: 0.5 }),
  ];
}
function badge() {
  return [
    dans(PUPITRE, { p: [-0.155, -0.012, 0.0062], rz: 3, d: [0.1, 0.135, 0.0028], r: 0.008, tex: TX('badge', {}, 600, 810), eclairee: true, couleur: hex('#4a4a50'), brillance: 0.8, vernis: 0.25 }),
    dans(PUPITRE, { p: [-0.158, 0.07, 0.0052], d: [0.013, 0.035, 0.0015], couleur: hex('#3a3a40'), brillance: 0.3 }),
  ];
}

// ---------------------------------------------------------------- le téléphone
const TEL_D = [0.165, 0.08, 0.009];
const TITRE_TUTO = 'Apprendre le piano en 10 min';
// temps effectif : tout se fige à partir de K.fige (ralenti extrême)
const tEff = (t) => (t < K.fige ? t : K.fige + (Math.min(t, K.chute) - K.fige) * 0.04);
function vibre(te) {
  const on = (te >= 0 && te < 0.3) || (te >= 2.5 && te < 2.78);
  return on ? Math.sin(te * 2 * Math.PI * 38) * 0.0012 : 0;
}
function telSurPupitre(te) {
  const glisse = 0.035 * E.out3(prog(2.5, 2.74, te));
  const v = vibre(te);
  return dans(PUPITRE, { p: [0.035 + glisse + v, -0.03, 0.0085], rz: v * 300, d: TEL_D });
}
const TEL_SOL = { p: [-0.66, 0.0046, 0.24], rx: -90, ry: 28 };
function poseTel(t) {
  const te = tEff(t);
  if (t < K.chute) return telSurPupitre(te);
  // il quitte le pupitre et retombe à plat, éteint, à gauche du clavier
  const a = telSurPupitre(tEff(K.chute));
  const k = prog(K.chute, K.chute + 0.36, t);
  const p = bezier(a.p, [-0.45, 0.42, 0.05], TEL_SOL.p, E.in2(k));
  const rot = rotEntre(a.rot, rotation(TEL_SOL.rx, TEL_SOL.ry, 0), E.inout2(k));
  const reb = t > K.chute + 0.36 ? Math.abs(Math.sin((t - K.chute - 0.36) * 22)) * 0.012 * Math.exp(-(t - K.chute - 0.36) * 14) : 0;
  return boite({ p: [p[0], p[1] + reb, p[2]], rot, d: TEL_D });
}
function ecranTuto(tf) {
  const te = tEff(tf);
  const amas = te < 0.3 ? 0 : te < 0.95 ? clamp((te - 0.3) / 0.2) : 0;
  return { k: img(te), titre: TITRE_TUTO, vitesse: te >= TM(2, 3, 2 / 3) ? 2 : 1, amas: +amas.toFixed(3), pause: te >= K.fige, eteint: tf >= K.chute };
}
function telephone(t, tf) {
  const b = poseTel(t);
  return boite({ ...b, r: 0.011, tex: TX('tuto', ecranTuto(tf), 1280, 620), emit: 1.05, couleur: hex('#0b0b0d'), brillance: 0.92, vernis: 0.55 });
}
// lumière de l'écran sur le clavier et le badge
function lumiereEcran(t, tf) {
  if (tf >= K.chute) return null;
  const b = poseTel(t);
  return { p: point(b, [0, 0, 0.12]), couleur: hex('#c9d4ec'), i: ecranTuto(tf).pause ? 0.05 : 0.09, rayon: 0.05, ombre: false };
}

// ---------------------------------------------------------------- le carnet
const CARNET_D = [0.16, 0.22, 0.015];
const CARNET_SOL = { p: [0.63, 0.0075, 0.13], rot: aPlat(18) };
const carnetSurPupitre = () => dans(PUPITRE, { p: [0.06, 0.042, 0.004 + 0.0075 + 0.002], d: CARNET_D });
function poseCarnet(t) {
  if (t < K.chute + 0.05) return boite({ ...CARNET_SOL, d: CARNET_D });
  const a = CARNET_SOL, b = carnetSurPupitre();
  const k = E.inout3(prog(K.chute + 0.05, K.chute + 0.42, t));
  return boite({ p: bezier(a.p, [0.45, 0.45, 0.1], b.p, k), rot: rotEntre(a.rot, b.rot, k), d: CARNET_D });
}
function carnet(t, tf) {
  const b = poseCarnet(t);
  // ouverture sur le pupitre : la couverture pivote autour de son bord gauche
  const ouv = E.out3(prog(K.carnetOuvert - 0.05, K.carnetOuvert + 0.14, t));
  if (ouv <= 0) return [boite({ ...b, r: 0.004, tex: TX('carnet', {}, 640, 880), eclairee: true, couleur: hex('#2e2e33'), brillance: 0.35 })];
  const bloc = boite({ ...b, d: [0.16, 0.22, 0.011], r: 0.003, tex: TX('carnetPage', { cote: 'd', accent: true }, 640, 880), eclairee: true, couleur: hex('#8f897e'), brillance: 0.3 });
  const charn = { p: point(b, [-0.08, 0, 0.0065]), rot: mat3mul(b.rot, rotation(0, -178 * ouv, 0)) };
  const couv = dans(charn, { p: [0.08, 0, 0.002], d: [0.16, 0.22, 0.004], r: 0.003, tex: TX('carnet', {}, 640, 880), dos: TX('carnetPage', { cote: 'g', accent: true }, 640, 880), eclairee: true, couleur: hex('#2e2e33'), brillance: 0.35 });
  return [bloc, couv];
}

// ---------------------------------------------------------------- les notes de Michaël
const NOTES = { p: [-0.12, HAUT + 0.0012, 0.075], rot: aPlat(-8), d: [0.15, 0.2, 0.0015] };
const rature = (tf) => 0.5 * prog(0.9, 1.0, tf) + 0.5 * prog(1.06, 1.16, tf);
const texNotes = (tf) => TX('notes', { r: +rature(tf).toFixed(3) }, 600, 800);

// ---------------------------------------------------------------- les tutos qui jaillissent
const CARTE_D = [0.16, 0.115, 0.003];
const CARTES = [
  { titre: 'Accords avancés', v: 0, t0: TM(1, 4), t1: 2.2, fin: [-0.33, HAUT + 0.002, 0.07], lacet: 14, fl: 0.24, spin: 360 },
  { titre: 'Niveau expert : impro', v: 1, t0: TM(2, 1), t1: 2.78, fin: [-0.5, 0.002, 0.36], lacet: -22, fl: 0.3, spin: -360 },
  { titre: null, v: 2, t0: TM(2, 2, 0.5), t1: 3.9, fin: [0.48, 0.002, 0.42], lacet: 35, fl: 0.32, spin: 300 },
  { titre: null, v: 3, t0: TM(2, 2, 0.5), t1: TM(2, 3), surCarnet: true, lacet: 8, fl: 0.2, spin: 360 },
  { titre: null, v: 4, t0: TM(2, 2, 0.5), t1: TM(2, 3, 1 / 3), fin: [0.25, HAUT + 0.002, 0.075], lacet: -12, fl: 0.26, spin: -360 },
  { titre: null, v: 5, t0: 2.8, t1: TM(2, 3, 1 / 3) + 0.035, fin: [0.03, HAUT + 0.0025, 0.1], lacet: 28, fl: 0.24, spin: 360 },
  { titre: null, v: 6, t0: TM(2, 3, 2 / 3), t1: 4.4, fin: [-0.62, 0.002, 0.1], lacet: 10, fl: 0.2, spin: -330 },
  { titre: null, v: 7, t0: TM(2, 3, 2 / 3), t1: 4.4, fin: [0.66, 0.002, 0.12], lacet: -15, fl: 0.22, spin: 330 },
  { titre: null, v: 8, t0: 3.38, t1: 3.75, fin: [0.45, 0.002, 0.42], lacet: 5, fl: 0.15, spin: 300 },
];
const texCarte = (c) => TX('carteTuto', { titre: c.titre, var: c.v, duree: ['48:12', '1:12:30', '36:05', '52:40'][c.v % 4] }, 640, 460);
function poseCarte(c, te) {
  if (te < c.t0) return null;
  const tel = telSurPupitre(c.t0);
  const p0 = point(tel, [0, 0, 0.012]);
  const fin = c.surCarnet ? point(boite({ ...CARNET_SOL, d: CARNET_D }), [0.0, -0.05, 0.0075 + 0.0018]) : c.fin;
  const rotFin = mat3mul(c.surCarnet ? CARNET_SOL.rot : rotation(0, 0, 0), c.surCarnet ? rotation(0, 0, c.lacet) : aPlat(c.lacet));
  const k = clamp((te - c.t0) / (c.t1 - c.t0));
  // départ vif sur le temps, arc, arrivée avec de la vitesse puis petit rebond
  const kh = E.out2(k);
  const p = [mix(p0[0], fin[0], kh), mix(p0[1], fin[1], k) + c.fl * 4 * k * (1 - k), mix(p0[2], fin[2], kh)];
  let rot = rotEntre(tel.rot, rotFin, E.inout2(k));
  rot = mat3mul(rot, rotation(0, 0, c.spin * (1 - E.out2(k))));
  if (te > c.t1) {
    const dt = te - c.t1;
    p[1] += Math.abs(Math.sin(dt * 26)) * 0.01 * Math.exp(-dt * 16);
  }
  return { p, rot };
}

// ---------------------------------------------------------------- la plaque A (pivote), B et C (montent du sol)
const PLAQUES = {
  A: { base: [0, 0, -0.42], ry: 0 },
  B: { base: [-0.8, 0, -0.66], ry: 24 },
  C: { base: [0.8, 0, -0.66], ry: -24 },
};
function angleA(t) {
  if (t < 4.28) return 90;
  if (t < 4.5) return 90 * (1 - E.in2(prog(4.28, 4.5, t)));
  const dt = t - 4.5;
  return -2.2 * Math.sin(dt * 30) * Math.exp(-dt * 10);
}
function montee(t, tLock) {
  if (t < tLock - 0.2) return -PL_H - 0.05;
  if (t < tLock) return mix(-PL_H - 0.05, 0, E.in2(prog(tLock - 0.2, tLock, t)));
  const dt = t - tLock;
  return 0.03 * Math.sin(dt * 28) * Math.exp(-dt * 11);
}
function posePlaque(m, t) {
  const P = PLAQUES[m];
  if (m === 'A') {
    const th = angleA(t);
    const rot = rotation(-th, P.ry, 0);
    return { p: add(add(P.base, [0, 0.002, 0]), mat3vec(rot, [0, PL_H / 2, 0])), rot };
  }
  const y = montee(t, m === 'B' ? K.module3 : K.module4);
  const rot = rotation(0, P.ry, 0);
  return { p: add(P.base, [0, PL_H / 2 + 0.002 + y, 0]), rot };
}
const yLocal = (yCapture) => (PLAQUE.H / 2 - yCapture) * U;

// États de l'interface au temps (image) tf
const allumage = (t0, tf) => clamp((tf - t0) / 0.07 + (tf >= t0 ? 0.25 : 0));
const LIGNES_B = { '0-0': 13.25, '0-1': 13.31, '1-0': 13.38, '1-1': K.prieres, '2-0': 13.56, '3-0': 13.62 };
const LIGNES_C = { '0-0': K.module4, '0-1': K.module4 + 0.08 };
function etatPlaque(m, tf, o = {}) {
  const gris = tf < K.couleur;
  const etats = {}, compteurs = {};
  if (m === 'A') {
    let n = 0;
    K.lignes.forEach((tl, i) => { if (tf >= tl) n++; if (i > 0) { const a = allumage(tl, tf); if (a > 0) etats[`0-${i}`] = { allume: a, fait: a }; } });
    compteurs[0] = n;
    if (tf >= K.entetes) { etats['1-0'] = { allume: allumage(K.entetes, tf), fait: 1 }; compteurs[1] = Math.min(3, 1 + Math.floor((tf - K.entetes) / 0.06)); }
  } else {
    const tab = m === 'B' ? LIGNES_B : LIGNES_C;
    const mod = MODULES[m];
    mod.sections.forEach((s, si) => { compteurs[si] = 0; });
    for (const [cle, tl] of Object.entries(tab)) {
      if (tf >= tl) { etats[cle] = { allume: allumage(tl, tf), fait: 1 }; compteurs[+cle.split('-')[0]]++; }
    }
  }
  return { m, gris, etats, compteurs, sansFil: m === 'A', fort: tf >= K.entetes, vide: !!o.vide };
}
function plaque(m, t, tf, o = {}) {
  const pose = o.pose || posePlaque(m, t);
  return boite({
    ...pose, d: [PL_L, PL_H, PL_E], r: 0.03, type: 'verre',
    tex: TX('plaque', etatPlaque(m, tf, o), 1000, Math.round(1000 * PLAQUE.H / PLAQUE.L)), emit: mix(0.9, 1.15, chaleur(t)),
    couleur: hex('#a9b3c6'), opacite: 1,
  });
}

// ---------------------------------------------------------------- le fil : la leçon « Do & Octaves »
const Y_FIL = yLocal(310 + 114.5);
const FIL_D = [880 * U, 229 * U, 0.004];
function etatFil(tf) {
  const pop = (t0) => (tf < t0 ? 0 : clamp((tf - t0) / 0.1 + 0.15));
  return {
    gris: tf < K.couleur - 0.001, allume: +clamp((tf - K.couleur) / 0.06 + (tf >= K.couleur ? 0.2 : 0)).toFixed(3),
    lecture: +prog(K.barre[0], K.barre[1], tf).toFixed(3), annexe: tf >= K.annexeRangee + 0.2,
    puces: [pop(K.vue), pop(K.annexe), pop(K.exercice)].map((v) => +v.toFixed(3)),
  };
}
const texFil = (tf) => TX('ligne', { titre: 'Do & Octaves', duree: '6m', e: etatFil(tf) }, 3520, 916);
// rebond du fil quand quelque chose le frappe
function rebondFil(t) {
  let z = 0;
  for (const ti of [K.playImpact, K.annexeImpact, K.cocheImpact]) {
    const dt = t - ti;
    if (dt >= 0 && dt < 0.4) z += -0.012 * Math.sin(dt * 34) * Math.exp(-dt * 12);
  }
  return z;
}
// repère du fil sur la plaque A (avant qu'il ne se détache)
function repereFilPlaque(t) {
  const pa = posePlaque('A', t);
  return dans(pa, { p: [0, Y_FIL, PL_E / 2 + 0.0024 + rebondFil(t)] });
}

// La caméra finale et la place du logo
const CAM_F = (() => {
  let best = null;
  for (let D = 6; D <= 16; D += 0.05) for (let a = -14; a <= 8; a += 0.05) {
    const pos = [0, 1.25, -0.42 + D];
    const cam = { pos, cible: [0, 1.25 - Math.tan(a * DEG) * D, -0.42], fov: 30 };
    const haut = projeter(cam, [0, PL_H, -0.42])[1], bas = projeter(cam, [0, 0, -0.42])[1];
    const err = (haut - 785) ** 2 + (bas - 1030) ** 2;
    if (!best || err < best.err) best = { cam, err };
  }
  return best.cam;
})();
const D_LOGO = 1.7;
const LOGO_POS = versEcran(CAM_F, 960, 275, D_LOGO);
const LOGO_ROT = faceA(CAM_F);
const morph = (t) => E.inout2(prog(17.8, K.logo, t));

function poseFil(t) {
  if (t < K.detache) return repereFilPlaque(t);
  const base = repereFilPlaque(K.detache);
  // il se détache (en avant) puis dérive doucement
  const avance = 0.07 * E.out3(prog(K.detache, K.detache + 0.25, t)) + 0.12 * prog(K.detache + 0.25, K.vol, t);
  const pDet = point(base, [0, 0.01 * prog(K.detache, K.vol, t), avance]);
  if (t < K.vol) return { p: pDet, rot: base.rot };
  const pV = point(base, [0, 0.01, 0.07 + 0.12]);
  const k = prog(K.vol, K.logo, t);
  const kk = E.inout3(k);
  const ctrl = add(pV, [0.0, 0.9, 3.2]);
  return { p: bezier(pV, ctrl, LOGO_POS, kk), rot: rotEntre(base.rot, LOGO_ROT, E.inout2(prog(K.vol, K.logo - 0.1, t))) };
}
function fil(t, tf) {
  const pose = poseFil(t);
  if (t < K.detache) {
    return boite({ ...pose, d: FIL_D, r: 0.012, tex: texFil(tf), emit: 1.05, couleur: hex('#26180f'), brillance: 0.85, vernis: 0.3, sansOmbre: true });
  }
  // détaché : une découpe en relief qui devient le H
  const u = +morph(tf).toFixed(3);
  return boite({ ...pose, d: [LOGO.S, LOGO.S, 0.016], type: 'decoupe', tex: TX('filLogo', { u, e: etatFil(tf) }, 1536, 1536), emit: 1.15, couleur: hex('#a03a12'), brillance: 0.8 });
}

// ---------------------------------------------------------------- gros plans haute définition posés sur les plaques
function ligneHD(m, si, li, t, tf) {
  const d = disposition(MODULES[m]).lignes.find((l) => l.si === si && l.li === li);
  const [titre, duree] = MODULES[m].sections[si].lecons[li];
  const e = { gris: tf < K.couleur, ...(etatPlaque(m, tf).etats[`${si}-${li}`] || {}) };
  const pose = dans(posePlaque(m, t), { p: [0, yLocal(d.y + 114.5), PL_E / 2 + 0.0016] });
  return boite({ ...pose, d: [880 * U, 229 * U, 0.002], r: 0.01, tex: TX('ligne', { titre, duree, e }, 2640, 687), emit: 1.05, couleur: hex('#000000'), sansOmbre: true });
}
function bandeauHD(m, si, t, tf) {
  const d = disposition(MODULES[m]).sections.find((s) => s.si === si);
  const s = MODULES[m].sections[si];
  const et = etatPlaque(m, tf);
  const n = et.compteurs[si] || 0;
  // le remplissage suit le compteur, en glissant
  let remplissage = n / s.total;
  if (m === 'A' && si === 0) {
    const dernier = [...K.lignes].reverse().find((tl) => tf >= tl);
    if (dernier !== undefined) remplissage = mix((n - 1) / s.total, n / s.total, E.out3(prog(dernier, dernier + 0.12, tf)));
  }
  const pose = dans(posePlaque(m, t), { p: [0, yLocal(d.y + 51), PL_E / 2 + 0.0016] });
  return boite({ ...pose, d: [920 * U, 102 * U, 0.002], tex: TX('bandeau', { titre: s.titre, n, total: s.total, gris: et.gris, fort: et.fort, remplissage: +remplissage.toFixed(3) }, 2760, 306), emit: 1.05, couleur: hex('#000000'), sansOmbre: true });
}

// ---------------------------------------------------------------- les gestes
// le bouton lecture : part du sol à gauche, frappe la vignette
const VIGNETTE_L = [(17 + 138 - 440) * U, 0, 0];
function poseLecture(t) {
  const cible = point(repereFilPlaque(K.playImpact), add(VIGNETTE_L, [0, 0, 0.012]));
  const depart = [-0.36, 0.045, 0.3];
  const rotF = posePlaque('A', K.playImpact).rot;
  if (t < K.playDepart) return { p: depart, rot: mat3mul(rotation(-60, 25, 0), rotation(0, 0, 0)) };
  if (t < K.playImpact) {
    const k = prog(K.playDepart, K.playImpact, t);
    const p = bezier(depart, [-0.42, 1.35, 0.1], cible, E.in2(k * 0.85 + k * k * 0.15));
    return { p, rot: mat3mul(rotEntre(rotation(-60, 25, 0), rotF, E.out2(k)), rotation(0, 0, -540 * (1 - k))) };
  }
  // collé sur la vignette, il suit le rebond du fil
  return { p: point(repereFilPlaque(t), add(VIGNETTE_L, [0, 0, 0.0085 - 0.003 * Math.exp(-(t - K.playImpact) * 20)])), rot: repereFilPlaque(t).rot };
}
function disqueLecture(t) {
  const p = poseLecture(t);
  const ecrase = t >= K.playImpact ? 1 - 0.35 * Math.exp(-(t - K.playImpact) * 25) : 1;
  return boite({ ...p, d: [0.075, 0.075, 0.012 * ecrase], type: 'decoupe', tex: TX('disqueLecture', {}, 512, 512), emit: 1.35, couleur: hex('#b0441a'), brillance: 0.85 });
}
// l'annexe : se lève du sol à droite, claque sur la leçon, se range dans la vignette
const ANNEXE_D = [0.13, 0.18, 0.0015];
function poseAnnexe(t) {
  const depart = { p: [0.42, 0.0012, 0.36], rot: aPlat(-20) };
  const surFil = (tt) => dans(repereFilPlaque(tt), { p: [VIGNETTE_L[0] + 0.02, 0, 0.0035] });
  if (t < K.annexeDepart) return { ...depart, s: 1 };
  if (t < K.annexeImpact) {
    const k = prog(K.annexeDepart, K.annexeImpact, t);
    const c = surFil(K.annexeImpact);
    const p = bezier(depart.p, [0.3, 1.25, 0.35], c.p, E.in2(k * 0.7 + 0.3 * k * k));
    const rot = mat3mul(rotEntre(depart.rot, c.rot, E.inout2(k)), rotation(0, 0, 200 * (1 - k)));
    return { p, rot, s: 1 };
  }
  const c = surFil(t);
  // se range : rétrécit vers le coin de la vignette
  const k = E.inout3(prog(K.annexeRangee, K.annexeRangee + 0.2, t));
  const coin = [VIGNETTE_L[0] - 0.08, 0.025, 0.0035];
  const pl = mix(0, 1, k);
  const p = point(repereFilPlaque(t), [mix(VIGNETTE_L[0] + 0.02, coin[0], pl), mix(0, coin[1], pl), 0.0035 + 0.002 * Math.exp(-(t - K.annexeImpact) * 18) * Math.sin((t - K.annexeImpact) * 40)]);
  return { p, rot: c.rot, s: mix(1, 0.16, k) };
}
function annexe(t) {
  const a = poseAnnexe(t);
  if (a.s < 0.18) return null;
  return boite({ p: a.p, rot: a.rot, d: [ANNEXE_D[0] * a.s, ANNEXE_D[1] * a.s, ANNEXE_D[2]], tex: TX('annexe', {}, 520, 720), dos: 'meme', eclairee: true, couleur: hex('#a49c8e'), brillance: 0.3 });
}
// la coche : part du clavier, frappe la leçon
const PUCE3_L = [(331 + 64 + 12 + 150 + 12 + 210 - 440) * U, 0, 0];
function poseCoche(t) {
  const cible = point(repereFilPlaque(K.cocheImpact), add(PUCE3_L, [0, 0, 0.012]));
  const depart = [xTouche(16), HAUT + 0.02, 0.06];
  const rotF = posePlaque('A', K.cocheImpact).rot;
  if (t < K.cocheImpact) {
    const k = prog(K.notes[2] + 0.1, K.cocheImpact, t);
    return { p: bezier(depart, [0.2, 0.9, 0.2], cible, E.in2(k)), rot: mat3mul(rotF, rotation(-25 * (1 - k), 0, 25 * (1 - k))) };
  }
  return { p: point(repereFilPlaque(t), add(PUCE3_L, [0, 0, 0.012])), rot: repereFilPlaque(t).rot };
}
function cocheBoite(t) {
  const p = poseCoche(t);
  const ecrase = t >= K.cocheImpact ? 1 - 0.4 * Math.exp(-(t - K.cocheImpact) * 22) : 1;
  return boite({ ...p, d: [0.085, 0.085, 0.018 * ecrase], type: 'decoupe', tex: TX('coche', {}, 512, 512), emit: 1.4, couleur: hex('#b0441a'), brillance: 0.85 });
}
// la copie du fil qui descend sur la ligne 2 (début de la cascade)
function copieFil(t, tf) {
  const k = E.in2(prog(K.lignes[0] + 1.0, K.lignes[1], t));
  const pa = posePlaque('A', t);
  const pose = dans(pa, { p: [0, mix(Y_FIL, Y_FIL - 229 * U, k), PL_E / 2 + 0.006 + 0.01 * Math.sin(k * Math.PI)] });
  return boite({ ...pose, d: FIL_D, r: 0.012, tex: TX('ligne', { titre: 'Nom des touches blanches', duree: '6m', e: { allume: 1, fait: 1 } }, 2640, 687), emit: 1.05, couleur: hex('#26180f'), sansOmbre: true });
}

// ---------------------------------------------------------------- l'aspiration (une seule chronologie)
// chaque objet du problème vole vers une ligne de la plaque couchée, s'aplatit et s'y range
const FENTES = [310, 539, 768, 997, 1226, 1583].map((y) => yLocal(y + 114.5));
const ASPIRES = [
  ...CARTES.map((c, i) => ({ type: 'carte', c, fente: 1 + (i % 5), retard: 0.012 * i })),
  { type: 'notes', fente: 5, retard: 0.05 },
  { type: 'ecran', fente: 0, retard: 0.0 },
];
function departAspire(a) {
  const te = tEff(K.chute - 1e-4);
  if (a.type === 'carte') return poseCarte(a.c, te) || { ...telSurPupitre(te) };
  if (a.type === 'notes') return { p: NOTES.p, rot: NOTES.rot };
  const tel = telSurPupitre(te);
  return { p: point(tel, [0, 0, 0.006]), rot: tel.rot };
}
function aspire(a, t, tf) {
  const dep = departAspire(a);
  const k = E.in2(prog(K.chute + a.retard, K.chute + 0.26 + a.retard * 0.5, t));
  const pa = posePlaque('A', t);
  const fente = dans(pa, { p: [0, FENTES[a.fente], PL_E / 2 + 0.0012 + 0.0004 * (a.retard * 80 % 6)] });
  const ctrl = add(lerp3(dep.p, fente.p, 0.4), [0, 0.35, 0.1]);
  const p = bezier(dep.p, ctrl, fente.p, k);
  const rot = rotEntre(dep.rot, fente.rot, E.inout2(clamp(k * 1.2)));
  const dimFin = a.fente === 0 ? FIL_D : [880 * U, 229 * U, 0.002];
  let d0 = a.type === 'notes' ? NOTES.d : a.type === 'ecran' ? [0.15, 0.068, 0.002] : CARTE_D;
  const d = lerp3(d0, dimFin, E.in3(k));
  const tex = a.type === 'carte' ? texCarte(a.c) : a.type === 'notes' ? texNotes(tf) : TX('tuto', { ...ecranTuto(K.fige), eteint: false }, 1280, 620);
  return boite({ p, rot, d, tex, dos: a.type === 'carte' ? 'meme' : undefined, eclairee: a.type === 'notes', emit: 0.85, couleur: hex('#1c1c1f'), brillance: 0.6, sansOmbre: k > 0.6 });
}

// ---------------------------------------------------------------- la signature
function signature(t, tf) {
  const out = [];
  const cam = CAM_F;
  // anneau de texte : sort du H sur le coup
  const ka = E.outBack(prog(K.logo, K.logo + 0.3, t), 1.4);
  if (ka > 0.02) {
    const dA = tailleMonde(cam, 420, D_LOGO + 0.01);
    const p = versEcran(cam, 960, 275, D_LOGO + 0.01);
    out.push(boite({ p, rot: mat3mul(LOGO_ROT, rotation(0, 0, -(t - K.logo) * 14)), d: [dA * ka / 0.84, dA * ka / 0.84, 0.004], type: 'decoupe', tex: TX('anneau', {}, 1536, 1536), emit: 1.1, couleur: hex('#7c7a76'), brillance: 0.7, sansOmbre: true }));
  }
  // le nom sort de derrière le logo
  const kn = E.out3(prog(K.nom[0], K.nom[1], t));
  if (kn > 0) {
    const dist = mix(D_LOGO + 0.08, D_LOGO + 0.03, kn);
    const y = mix(275, 570, kn);
    const w = tailleMonde(cam, 1100, dist), h = tailleMonde(cam, 115, dist);
    out.push(boite({ p: versEcran(cam, 960, y, dist), rot: LOGO_ROT, d: [w, h, 0.006], type: 'decoupe', tex: TX('nom', { revele: +E.out2(clamp(kn * 1.15)).toFixed(3) }, 2200, 230), emit: 1.15, couleur: hex('#8a8784'), brillance: 0.6, sansOmbre: true }));
  }
  // le bouton arrive par le bas
  const kb = prog(K.bouton[0], K.bouton[1], t);
  if (kb > 0) {
    const dist = D_LOGO + 0.03;
    const y = mix(1180, 692, E.outBack(kb, 1.3));
    const w = tailleMonde(cam, 340, dist), h = tailleMonde(cam, 88, dist);
    out.push(boite({ p: versEcran(cam, 960, y, dist), rot: LOGO_ROT, d: [w, h, 0.02], r: h / 2, tex: TX('bouton', {}, 1360, 352), emit: 1.25, couleur: hex('#c84816'), brillance: 0.8, vernis: 0.2, sansOmbre: true }));
  }
  return out;
}

// ---------------------------------------------------------------- assemblage des objets par moment
function bureau(t, tf, o = {}) {
  const b = [clavier(tf, o.allumees || []), ...pupitre()];
  if (o.badge !== false) b.push(...badge());
  if (o.tel !== false) b.push(telephone(t, tf));
  if (o.carnet !== false) b.push(...carnet(t, tf));
  if (o.notes && t < K.chute) b.push(boite({ ...NOTES, tex: texNotes(tf), eclairee: true, couleur: hex(C.papier), brillance: 0.25 }));
  return b;
}
function cartesEnVol(t, filtre = () => true) {
  const te = tEff(t);
  const out = [];
  for (const c of CARTES) {
    if (!filtre(c)) continue;
    const p = poseCarte(c, te);
    if (p) out.push(boite({ ...p, d: CARTE_D, r: 0.004, tex: texCarte(c), dos: 'meme', emit: 0.8, couleur: hex('#1c1c1f'), brillance: 0.6 }));
  }
  return out;
}
// le monde après le basculement : clavier, pupitre et carnet, plaques, fil
function monde(t, tf, o = {}) {
  const b = [clavier(tf, o.allumees || []), ...pupitre()];
  if (o.badge !== false) b.push(...badge());
  if (o.carnet !== false) b.push(...carnet(t, tf));
  if (o.tel !== false) b.push(telephone(t, tf));
  for (const m of o.plaques || ['A']) {
    if (m !== 'A' && montee(t, m === 'B' ? K.module3 : K.module4) < -PL_H) continue;
    b.push(plaque(m, t, tf));
  }
  if (o.fil !== false) b.push(fil(t, tf));
  return b;
}

// ---------------------------------------------------------------- caméras
const cam = (pos, cible, fov = 32, o = {}) => ({ pos, cible, fov, ...o });
// interpolation entre deux caméras sur la durée du plan
function travelling(pl, t, A, B, courbe = E.inout2) {
  const k = courbe(prog(pl.debut, pl.fin, t));
  return { pos: lerp3(A.pos, B.pos, k), cible: lerp3(A.cible, B.cible, k), fov: mix(A.fov, B.fov, k), ouverture: mix(A.ouverture ?? 0.004, B.ouverture ?? 0.004, k), roulis: mix(A.roulis || 0, B.roulis || 0, k), haut: A.haut, focus: A.focus !== undefined ? mix(A.focus, B.focus ?? A.focus, k) : undefined };
}
// caméra exprimée dans le repère d'un objet (le fil, une ligne, un bandeau)
function camDans(rep, posL, cibleL, fov, o = {}) {
  return { pos: point(rep, posL), cible: point(rep, cibleL), fov, ...o };
}

// ---------------------------------------------------------------- les plans
const P = {};

// 1. LE PROBLÈME --------------------------------------------------------------------------------
P.P01 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.07, 0.232, 0.3], [-0.02, 0.142, -0.08], 30, { ouverture: 0.002 }), cam([0.05, 0.226, 0.278], [-0.024, 0.142, -0.08], 30, { ouverture: 0.002 }), E.lin),
  boites: bureau(t, tf, { notes: true }),
});
P.P02 = (t, tf, pl) => {
  const tel = poseTel(t);
  return {
    cam: travelling(pl, t, camDans(tel, [0.05, -0.02, 0.15], [0.0, 0.0, 0], 30, { ouverture: 0.002 }), camDans(tel, [0.035, -0.015, 0.135], [0.0, 0.0, 0], 30, { ouverture: 0.002 })),
    boites: bureau(t, tf, { notes: true }),
  };
};
P.P03 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([-0.1, 0.42, 0.13], [-0.12, HAUT, 0.075], 36, { haut: [0.2, 0, -1], ouverture: 0.002 }), cam([-0.11, 0.39, 0.12], [-0.12, HAUT, 0.075], 36, { haut: [0.2, 0, -1], ouverture: 0.002 })),
  boites: bureau(t, tf, { notes: true, tel: true }),
});
P.P04 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.24, 0.1, 0.36], [0.0, 0.24, -0.08], 38, { ouverture: 0.003 }), cam([0.22, 0.1, 0.33], [-0.03, 0.26, -0.08], 38, { ouverture: 0.003 })),
  boites: [...bureau(t, tf, { notes: true }), ...cartesEnVol(t, (c) => c.v === 0)],
});
P.P05 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.25, 1.25, 0.95], [0.0, 0.05, 0.08], 38, { ouverture: 0.004 }), cam([0.22, 1.18, 0.88], [0.0, 0.06, 0.06], 38, { ouverture: 0.004 })),
  boites: [...bureau(t, tf, { notes: true }), ...cartesEnVol(t)],
});
P.P06 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.36, 0.125, 0.03], [0.1, 0.13, -0.09], 30, { ouverture: 0.0025 }), cam([0.34, 0.12, 0.02], [0.12, 0.13, -0.09], 30, { ouverture: 0.0025 })),
  boites: [...bureau(t, tf, { notes: true }), ...cartesEnVol(t)],
});
P.P07 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([-0.1, 0.27, -0.36], [0.14, 0.2, 0.12], 42, { ouverture: 0.003 }), cam([-0.12, 0.27, -0.35], [0.14, 0.21, 0.13], 42, { ouverture: 0.003 })),
  boites: [...bureau(t, tf, { notes: true }), ...cartesEnVol(t)],
});
P.P08 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.63, 0.36, 0.13], CARNET_SOL.p, 34, { haut: [0.3, 0, -1], ouverture: 0.002 }), cam([0.63, 0.34, 0.13], CARNET_SOL.p, 34, { haut: [0.3, 0, -1], ouverture: 0.002 })),
  boites: [...bureau(t, tf, { notes: true }), ...cartesEnVol(t)],
});
P.P09 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([-0.5, 0.13, 0.36], [0.12, 0.09, 0.06], 36, { ouverture: 0.004 }), cam([-0.48, 0.13, 0.35], [0.12, 0.09, 0.06], 36, { ouverture: 0.004 })),
  boites: [...bureau(t, tf, { notes: true }), ...cartesEnVol(t)],
});
P.P10 = (t, tf, pl) => {
  const tel = poseTel(t);
  return {
    cam: travelling(pl, t, camDans(tel, [0.05, 0.016, 0.075], [0.05, 0.016, 0], 30, { ouverture: 0.001 }), camDans(tel, [0.05, 0.016, 0.068], [0.05, 0.016, 0], 30, { ouverture: 0.001 })),
    boites: [...bureau(t, tf, { notes: true }), ...cartesEnVol(t)],
  };
};
P.P11 = (t, tf, pl) => {
  const tel = poseTel(t);
  const c = point(tel, [0, 0, 0]);
  const a = mix(-28, 18, E.inout2(prog(pl.debut, pl.fin, t)));
  return {
    cam: { pos: add(c, [Math.sin(a * DEG) * 0.36, -0.01, Math.cos(a * DEG) * 0.36]), cible: add(c, [0, 0.05, 0]), fov: 44, ouverture: 0.004, focus: 0.36 },
    boites: [...bureau(t, tf, { notes: true }), ...cartesEnVol(t)],
    sombre: true,
  };
};

// 2. LE BASCULEMENT -----------------------------------------------------------------------------
P.P12 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([-0.95, 0.5, 1.05], [0.0, 0.18, -0.5], 40, { ouverture: 0.005 }), cam([-0.85, 0.44, 0.95], [0.0, 0.22, -0.5], 40, { ouverture: 0.005 })),
  boites: [
    clavier(tf), ...pupitre(), ...badge(), telephone(t, tf), ...carnet(t, tf),
    plaque('A', t, tf, { vide: true }), ...ASPIRES.map((a) => aspire(a, t, tf)),
  ],
});
P.P13 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.42, 0.035, 0.85], [0.0, 0.75, -0.42], 44, { ouverture: 0.006, focus: 1.35 }), cam([0.38, 0.035, 0.8], [0.0, 0.8, -0.42], 44, { ouverture: 0.006, focus: 1.3 })),
  boites: monde(t, tf),
});
P.P14 = (t, tf, pl) => {
  const r = repereFilPlaque(t);
  return {
    cam: travelling(pl, t, camDans(r, [0.3, -0.05, 0.3], [0.02, 0.0, 0], 30, { ouverture: 0.003 }), camDans(r, [0.26, -0.045, 0.27], [0.0, 0.0, 0], 30, { ouverture: 0.003 })),
    boites: monde(t, tf),
  };
};
P.P15 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.75, 0.75, 1.25], [0.0, 0.85, -0.42], 32, { ouverture: 0.004 }), cam([0.68, 0.76, 1.15], [0.0, 0.86, -0.42], 32, { ouverture: 0.004 })),
  boites: monde(t, tf),
});

// 3. LES TROIS GESTES ---------------------------------------------------------------------------
P.P16 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([-0.78, 0.12, 0.82], [-0.3, 0.3, 0.05], 40, { ouverture: 0.004 }), cam([-0.74, 0.13, 0.78], [-0.27, 0.55, -0.1], 40, { ouverture: 0.004 })),
  boites: [...monde(t, tf), disqueLecture(t)],
});
P.P17 = (t, tf, pl) => {
  const r = repereFilPlaque(K.playImpact);
  return {
    cam: travelling(pl, t, camDans(r, [-0.33, 0.13, 0.3], [-0.19, 0.0, 0], 30, { ouverture: 0.003 }), camDans(r, [-0.31, 0.12, 0.28], [-0.19, 0.0, 0], 30, { ouverture: 0.003 })),
    boites: [...monde(t, tf), disqueLecture(t)],
  };
};
P.P18 = (t, tf, pl) => {
  const r = repereFilPlaque(K.barre[0]);
  return {
    cam: travelling(pl, t, camDans(r, [-0.4, -0.11, 0.17], [-0.17, -0.045, 0], 30, { ouverture: 0.002 }), camDans(r, [-0.38, -0.105, 0.16], [-0.16, -0.045, 0], 30, { ouverture: 0.002 })),
    boites: monde(t, tf),
  };
};
P.P19 = (t, tf, pl) => {
  const r = repereFilPlaque(K.vue);
  return {
    cam: travelling(pl, t, camDans(r, [0.06, -0.01, 0.27], [0.0, 0.012, 0], 26, { ouverture: 0.002 }), camDans(r, [0.05, -0.01, 0.255], [0.0, 0.012, 0], 26, { ouverture: 0.002 })),
    boites: monde(t, tf),
  };
};
P.P20 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.62, 0.62, 0.82], [0.4, 0.12, 0.3], 38, { ouverture: 0.004 }), cam([0.6, 0.66, 0.78], [0.36, 0.3, 0.18], 38, { ouverture: 0.004 })),
  boites: [...monde(t, tf), annexe(t)].filter(Boolean),
});
P.P21 = (t, tf, pl) => {
  const r = repereFilPlaque(K.annexeImpact);
  return {
    cam: travelling(pl, t, camDans(r, [0.3, 0.09, 0.22], [-0.13, 0.0, 0], 32, { ouverture: 0.003 }), camDans(r, [0.29, 0.085, 0.21], [-0.13, 0.0, 0], 32, { ouverture: 0.003 })),
    boites: [...monde(t, tf), annexe(t)].filter(Boolean),
  };
};
P.P22 = (t, tf, pl) => {
  const r = repereFilPlaque(K.annexeRangee);
  return {
    cam: travelling(pl, t, camDans(r, [-0.2, 0.005, 0.2], [-0.2, 0.005, 0], 30, { ouverture: 0.002 }), camDans(r, [-0.205, 0.005, 0.185], [-0.205, 0.005, 0], 30, { ouverture: 0.002 })),
    boites: [...monde(t, tf), annexe(t)].filter(Boolean),
  };
};
P.P23 = (t, tf, pl) => {
  const r = repereFilPlaque(K.annexe);
  return {
    cam: travelling(pl, t, camDans(r, [-0.1, -0.12, 0.3], [0.04, 0.008, 0], 28, { ouverture: 0.002 }), camDans(r, [-0.09, -0.11, 0.285], [0.04, 0.008, 0], 28, { ouverture: 0.002 })),
    boites: monde(t, tf),
  };
};
const doMiSol = (t) => [14, 16, 18].filter((_, i) => t >= K.notes[i] && t < K.cocheImpact + 0.4);
const enfonce = (t) => Object.fromEntries([14, 16, 18].map((k, i) => [k, t >= K.notes[i] && t < K.cocheImpact + 0.4 ? 0.0045 * Math.min(1, (t - K.notes[i]) / 0.03) : 0]));
P.P24 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.1, 0.3, 0.32], [-0.05, HAUT, 0.06], 32, { ouverture: 0.003 }), cam([0.09, 0.29, 0.3], [-0.05, HAUT, 0.06], 32, { ouverture: 0.003 })),
  boites: [...monde(t, tf, { allumees: doMiSol(tf), tel: false }), ...touches(12, 20, doMiSol(tf), enfonce(t))],
});
P.P25 = (t, tf, pl) => {
  const r = repereFilPlaque(K.cocheImpact);
  return {
    cam: travelling(pl, t, camDans(r, [0.33, -0.09, 0.3], [0.24, 0.0, 0], 30, { ouverture: 0.003 }), camDans(r, [0.31, -0.085, 0.28], [0.24, 0.0, 0], 30, { ouverture: 0.003 })),
    boites: [...monde(t, tf), cocheBoite(t)],
  };
};
P.P26 = (t, tf, pl) => {
  const pa = posePlaque('A', t);
  const r = dans(pa, { p: [0, yLocal(186 + 51), 0] });
  return {
    cam: travelling(pl, t, camDans(r, [0.12, 0.2, 0.24], [0.17, 0.0, 0], 30, { ouverture: 0.002 }), camDans(r, [0.12, 0.19, 0.23], [0.18, 0.0, 0], 30, { ouverture: 0.002 })),
    boites: [...monde(t, tf), bandeauHD('A', 0, t, tf), cocheBoite(t)],
  };
};
P.P27 = (t, tf, pl) => {
  const r = repereFilPlaque(K.exercice);
  return {
    cam: travelling(pl, t, camDans(r, [0.1, 0.07, 0.46], [0.07, 0.045, 0], 33, { ouverture: 0.003 }), camDans(r, [0.09, 0.07, 0.44], [0.07, 0.045, 0], 33, { ouverture: 0.003 })),
    boites: [...monde(t, tf), bandeauHD('A', 0, t, tf)],
  };
};

// 4. LE RÉSULTAT À L'ÉCHELLE --------------------------------------------------------------------
P.P28 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.1, 1.85, 0.05], [0.0, 0.95, -0.41], 34, { ouverture: 0.004 }), cam([0.08, 1.82, 0.02], [0.0, 0.93, -0.41], 34, { ouverture: 0.004 })),
  boites: [...monde(t, tf), copieFil(t, tf)],
});
P.P29 = (t, tf, pl) => {
  const pa = posePlaque('A', t);
  return {
    cam: travelling(pl, t, camDans(pa, [0.24, Y_FIL - 0.42, 0.26], [0.0, Y_FIL - 0.14, 0], 36, { ouverture: 0.003 }), camDans(pa, [0.23, Y_FIL - 0.41, 0.25], [0.0, Y_FIL - 0.13, 0], 36, { ouverture: 0.003 })),
    boites: monde(t, tf),
  };
};
P.P30 = (t, tf, pl) => {
  const l = ligneHD('A', 0, 2, t, tf);
  return {
    cam: travelling(pl, t, camDans(l, [-0.2, 0.06, 0.24], [0.06, 0.0, 0], 30, { ouverture: 0.002 }), camDans(l, [-0.19, 0.06, 0.23], [0.07, 0.0, 0], 30, { ouverture: 0.002 })),
    boites: [...monde(t, tf), l],
  };
};
P.P31 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([-1.35, 0.95, 0.55], [0.0, 0.7, -0.42], 36, { ouverture: 0.004 }), cam([-1.3, 0.93, 0.52], [0.0, 0.7, -0.42], 36, { ouverture: 0.004 })),
  boites: monde(t, tf, { plaques: ['A', 'B'] }),
});
P.P32 = (t, tf, pl) => {
  const b = bandeauHD('A', 0, t, tf);
  return {
    cam: travelling(pl, t, camDans(b, [0.08, -0.07, 0.2], [0.2, 0.0, 0], 30, { ouverture: 0.002, roulis: 6 }), camDans(b, [0.085, -0.065, 0.19], [0.2, 0.0, 0], 30, { ouverture: 0.002, roulis: 6 })),
    boites: [...monde(t, tf), b],
  };
};
P.P33 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([-0.55, 0.12, 1.1], [-0.72, 0.8, -0.66], 42, { ouverture: 0.004 }), cam([-0.55, 0.13, 1.06], [-0.72, 0.82, -0.66], 42, { ouverture: 0.004 })),
  boites: monde(t, tf, { plaques: ['A', 'B'] }),
});
P.P34 = (t, tf, pl) => {
  const l = ligneHD('B', 1, 1, t, tf);
  return {
    cam: travelling(pl, t, camDans(l, [0.12, -0.05, 0.32], [0.07, 0.0, 0], 28, { ouverture: 0.002 }), camDans(l, [0.11, -0.05, 0.31], [0.07, 0.0, 0], 28, { ouverture: 0.002 })),
    boites: [...monde(t, tf, { plaques: ['A', 'B'] }), l],
  };
};
P.P35 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([-0.61, 0.27, 0.59], [-0.66, 0.006, 0.24], 30, { ouverture: 0.003 }), cam([-0.61, 0.27, 0.59], [-0.66, 0.006, 0.24], 30, { ouverture: 0.003 })),
  boites: monde(t, tf, { plaques: ['A', 'B'] }),
  calme: true,
});
P.P36 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([1.65, 2.0, 0.65], [0.75, 0.6, -0.62], 36, { ouverture: 0.004 }), cam([1.6, 1.95, 0.6], [0.75, 0.62, -0.62], 36, { ouverture: 0.004 })),
  boites: monde(t, tf, { plaques: ['A', 'B', 'C'] }),
});
P.P37 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.5, 0.3, 0.42], [0.0, 0.42, -0.42], 30, { ouverture: 0.003 }), cam([0.48, 0.31, 0.4], [0.0, 0.44, -0.42], 30, { ouverture: 0.003 })),
  boites: monde(t, tf, { plaques: ['A', 'B', 'C'] }),
});
const cascadeTouches = (tf) => { const out = []; for (let i = 0; i < 36; i++) { const ti = K.clavierJoue + (35 - i) * 0.007; if (tf >= ti && tf < ti + 0.5) out.push(i); } return out; };
const ACCORD = [7, 14, 16, 18];
P.P38 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.78, 0.15, 0.3], [-0.2, 0.09, 0.0], 34, { ouverture: 0.005 }), cam([0.75, 0.15, 0.28], [-0.22, 0.09, 0.0], 34, { ouverture: 0.005 })),
  boites: monde(t, tf, { plaques: ['A', 'B', 'C'], allumees: cascadeTouches(tf) }),
});
P.P39 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.16, 0.26, 0.24], [0.08, 0.18, -0.08], 32, { ouverture: 0.003 }), cam([0.15, 0.25, 0.23], [0.08, 0.18, -0.08], 32, { ouverture: 0.003 })),
  boites: monde(t, tf, { plaques: ['A', 'B', 'C'], allumees: ACCORD }),
});
P.P40 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.0, 0.1, 2.2], [0.0, 0.85, -0.6], 40, { ouverture: 0.004 }), cam([0.0, 0.11, 2.12], [0.0, 0.86, -0.6], 40, { ouverture: 0.004 })),
  boites: monde(t, tf, { plaques: ['A', 'B', 'C'], allumees: ACCORD }),
});
P.P41 = (t, tf, pl) => {
  const pb = posePlaque('B', t);
  const k = E.inout2(prog(pl.debut, pl.fin, t));
  const y = mix(yLocal(310 + 114), yLocal(1125 + 114), k);
  return {
    cam: { pos: point(pb, [0.12, y + 0.04, 0.26]), cible: point(pb, [0.02, y - 0.01, 0]), fov: 30, ouverture: 0.003 },
    boites: monde(t, tf, { plaques: ['A', 'B', 'C'], allumees: ACCORD }),
  };
};
P.P42 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.72, 0.34, 1.02], [-0.06, 0.47, -0.4], 40, { ouverture: 0.003, focus: 1.2 }), cam([0.7, 0.34, 0.98], [-0.06, 0.47, -0.4], 40, { ouverture: 0.003, focus: 1.17 }), E.lin),
  boites: monde(t, tf, { plaques: ['A', 'B', 'C'], allumees: ACCORD }),
});

// 5. LA SIGNATURE ------------------------------------------------------------------------------
P.P43 = (t, tf, pl) => ({
  cam: travelling(pl, t, cam([0.05, 1.12, 0.62], [0.0, 1.0, -0.42], 34, { ouverture: 0.004 }), cam([0.08, 1.15, 1.05], [0.0, 0.98, -0.42], 34, { ouverture: 0.004 }), E.inout2),
  boites: monde(t, tf, { plaques: ['A', 'B', 'C'], allumees: ACCORD }),
});
P.P44 = (t, tf, pl) => {
  const k = E.inout3(prog(pl.debut, pl.debut + 0.7, t));
  const pos = lerp3([0.08, 1.15, 1.05], [1.3, 2.4, 13.2], k);
  const f = poseFil(t).p;
  return {
    cam: { pos, cible: lerp3([0, 0.98, -0.42], f, clamp(k * 1.3)), fov: 36, ouverture: 0.003, focus: len(sub(f, pos)), roulis: -6 * k },
    boites: monde(t, tf, { plaques: ['A', 'B', 'C'], allumees: ACCORD }),
  };
};
P.P45 = (t, tf, pl) => {
  const k = E.out2(prog(pl.debut, 20, t));
  const pos = add(CAM_F.pos, mul(norm(sub(CAM_F.cible, CAM_F.pos)), 0.12 * k));
  return {
    cam: { pos, cible: CAM_F.cible, fov: 30, ouverture: 0.0035, focus: D_LOGO - 0.12 * k },
    boites: [...monde(t, tf, { plaques: ['A', 'B', 'C'], allumees: ACCORD }), ...signature(t, tf)],
    final: true,
  };
};

// passes supplémentaires pour les plans aux mouvements très rapides
const PASSES = {
  P07: 1.25, P09: 1.25, P12: 1.4, P16: 1.25, P20: 1.25, P28: 1.25, P33: 1.25, P36: 1.25, P41: 1.4, P44: 1.6,
  P15: 0.8, P19: 0.8, P23: 0.8, P27: 0.8, P42: 0.9,
};

// ---------------------------------------------------------------- la scène d'un instant
function plan(t) {
  let pl = PLANS[0];
  for (const p of PLANS) if (t >= p.debut - 1e-6) pl = p;
  return { ...pl, passes: PASSES[pl.id] || 1 };
}
function scene(t, pl, tf = t) {
  const fn = P[pl.id];
  if (!fn) throw new Error('Plan manquant : ' + pl.id);
  const s = fn(t, tf, pl);
  const amb = ambiance(t, { cle: s.final ? [2.2, 3.4, 13] : undefined, cleI: s.final ? 22 : undefined });
  const gainSecousse = s.calme ? 0.3 : 1;
  let c = secousse(s.cam, t, gainSecousse);
  const fl = eclair(t);
  return {
    cam: c,
    boites: s.boites,
    spheres: s.spheres || [],
    lumieres: amb.lumieres,
    env: amb.env,
    post: { exposition: s.sombre ? 0.95 : 1.0, halo: 0.32, vignette: 0.38, grain: 0.012, flash: [...hex(C.accent), fl] },
  };
}

export const film = { plan, scene, P, CAM_F, LOGO_POS };
