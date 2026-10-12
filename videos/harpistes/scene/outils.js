// Poses des objets, caméra, secousses sur les coups de grosse caisse, positions calculées depuis l'image voulue.

import { rotation, mat3mul, mat3vec, add, sub, mul, norm, cross, dot, clamp, mix, hex, C } from './lib.js';
import { FRAPPES, ECLAIRS, K, SCENE_W, SCENE_H } from './cues.js';

// Une boîte : position p, dimensions d [largeur, hauteur, épaisseur], angles (degrés) ou matrice rot
export function boite(o) {
  const rot = o.rot || rotation(o.rx || 0, o.ry || 0, o.rz || 0);
  return { ...o, rot, couleur: o.couleur || hex(C.gris1) };
}

// Pose d'un enfant dans le repère d'un parent (position et angles locaux)
export function dans(parent, o) {
  const Rl = o.rot || rotation(o.rx || 0, o.ry || 0, o.rz || 0);
  const p = add(parent.p, mat3vec(parent.rot, o.p || [0, 0, 0]));
  return boite({ ...o, p, rot: mat3mul(parent.rot, Rl) });
}
// Point local d'un parent en coordonnées du monde
export const point = (parent, lp) => add(parent.p, mat3vec(parent.rot, lp));
// Repère parent simple
export const repere = (p, rx = 0, ry = 0, rz = 0) => ({ p, rot: rotation(rx, ry, rz) });

// Objet posé à plat (face avant vers le haut), tourné de lacet degrés autour de la verticale
export const aPlat = (lacet = 0, extra = 0) => mat3mul(rotation(0, lacet, 0), rotation(-90 + extra, 0, 0));

// Caméra et secousses : chaque coup de grosse caisse pousse la caméra vers l'avant et la secoue
export function secousse(cam, t, gain = 1) {
  let pousse = 0, sx = 0, sy = 0, rl = 0;
  for (const f of FRAPPES) {
    const dt = t - f.t;
    if (dt < 0 || dt > 0.3) continue;
    const a = f.force * gain;
    const env = Math.exp(-dt * 16);
    pousse += a * env * (1 - Math.exp(-dt * 120));
    const vib = Math.exp(-dt * 22) * Math.sin(dt * 75);
    sx += a * vib * 0.6; sy += a * vib; rl += a * vib * 0.5;
  }
  const z = norm(sub(cam.cible, cam.pos));
  const x = norm(cross(z, [0, 1, 0]));
  const y = cross(x, z);
  // l'amplitude suit la distance du sujet (mise au point), plafonnée : un coup ne doit pas dédoubler l'image
  const dist = Math.min(cam.focus ?? Math.hypot(...sub(cam.cible, cam.pos)), 2.5);
  const k = dist * 0.012;
  const dep = add(add(mul(z, pousse * dist * 0.035), mul(x, sx * k)), mul(y, sy * k));
  return { ...cam, pos: add(cam.pos, dep), cible: add(cam.cible, add(mul(x, sx * k * 0.6), mul(y, sy * k * 0.6))), roulis: (cam.roulis || 0) + rl * 0.5 };
}

// Éclair couleur d'accent (après la naissance de la couleur seulement)
export function eclair(t) {
  let a = 0;
  for (const e of ECLAIRS) { const dt = t - e.t; if (dt >= 0 && dt < 0.15) a += e.i * Math.exp(-dt * 28); }
  return t < K.couleur ? 0 : a;
}

// Repère de la caméra
export function repereCam(cam) {
  const z = norm(sub(cam.cible, cam.pos));
  const x = norm(cross(z, cam.haut || [0, 1, 0]));
  const y = cross(x, z);
  return { x, y, z };
}

// Point du monde situé sur le pixel (px, py) de l'image voulue, à la distance d de la caméra (le long de l'axe)
export function versEcran(cam, px, py, d, L = SCENE_W, H = SCENE_H) {
  const { x, y, z } = repereCam(cam);
  const th = Math.tan((cam.fov ?? 35) * Math.PI / 360);
  const nx = (px / L) * 2 - 1, ny = 1 - (py / H) * 2;
  return add(cam.pos, add(mul(z, d), add(mul(x, nx * th * (L / H) * d), mul(y, ny * th * d))));
}
// Taille dans le monde d'une hauteur de h pixels à la distance d
export const tailleMonde = (cam, hPx, d, H = SCENE_H) => (hPx / H) * 2 * Math.tan((cam.fov ?? 35) * Math.PI / 360) * d;

// Rotation qui fait face à la caméra (face avant de la boîte vers la caméra)
export function faceA(cam) {
  const { x, y, z } = repereCam(cam);
  // colonnes : axes locaux x, y, z (z pointe vers la caméra)
  return [[x[0], y[0], -z[0]], [x[1], y[1], -z[1]], [x[2], y[2], -z[2]]];
}

// Projection d'un point du monde vers l'image (pixels), pour les contrôles
export function projeter(cam, p, L = SCENE_W, H = SCENE_H) {
  const { x, y, z } = repereCam(cam);
  const v = sub(p, cam.pos);
  const d = dot(v, z);
  const th = Math.tan((cam.fov ?? 35) * Math.PI / 360);
  return [(dot(v, x) / (d * th * L / H) + 1) * L / 2, (1 - dot(v, y) / (d * th)) * H / 2, d];
}

// Orbite autour d'une cible : angle horizontal (degrés), hauteur, distance
export function orbite(cible, ang, haut, dist) {
  const a = ang * Math.PI / 180;
  return { pos: [cible[0] + Math.sin(a) * dist, cible[1] + haut, cible[2] + Math.cos(a) * dist], cible };
}

export { clamp, mix };
