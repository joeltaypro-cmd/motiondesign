// Outils mathématiques, courbes de vitesse et charte. Aucune horloge, aucun hasard non reproductible.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a, b, k) => a + (b - a) * k;
export const lerp3 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
export const lisse = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const prog = (a, b, x) => clamp((x - a) / (b - a));

// Courbes (k entre 0 et 1)
export const E = {
  lin: (k) => k,
  in2: (k) => k * k,
  out2: (k) => 1 - (1 - k) * (1 - k),
  out3: (k) => 1 - Math.pow(1 - k, 3),
  out4: (k) => 1 - Math.pow(1 - k, 4),
  out5: (k) => 1 - Math.pow(1 - k, 5),
  in3: (k) => k * k * k,
  inout2: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  inout3: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inExpo: (k) => (k <= 0 ? 0 : Math.pow(2, 10 * k - 10)),
  // dépassement puis retour (ressort)
  outBack: (k, s = 1.7) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
  ressort: (k, f = 3.2, amort = 6) => 1 - Math.exp(-amort * k) * Math.cos(f * Math.PI * k),
};

// Valeur interpolée entre a et b de t0 à t1 avec une courbe
export function anim(t, t0, t1, a, b, courbe = E.inout2) {
  return mix(a, b, courbe(prog(t0, t1, t)));
}
export function anim3(t, t0, t1, a, b, courbe = E.inout2) {
  return lerp3(a, b, courbe(prog(t0, t1, t)));
}

// Chute avec rebonds : position verticale (0 = posé) d'un objet lâché de h, impact à tImpact.
// Avant tImpact : chute accélérée ; après : rebonds amortis.
export function chute(t, tImpact, h, duree = 0.18, rebond = 0.22, nRebonds = 2) {
  if (t < tImpact) {
    const k = clamp(1 - (tImpact - t) / duree);
    return h * (1 - k * k);
  }
  let dt = t - tImpact, a = h * rebond, d = duree * 0.9;
  for (let i = 0; i < nRebonds; i++) {
    if (dt < d) { const k = dt / d; return a * 4 * k * (1 - k); }
    dt -= d; a *= rebond; d *= 0.6;
  }
  return 0;
}

// Arc balistique de p0 à p1 (positions 3D) entre t0 et t1, avec une hauteur de flèche
export function arc(t, t0, t1, p0, p1, fleche = 0.2, courbe = E.lin) {
  const k = courbe(prog(t0, t1, t));
  const p = lerp3(p0, p1, k);
  p[1] += fleche * 4 * k * (1 - k);
  return p;
}

// Hasard reproductible
export function hash(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
export const alea = (i, a = 0, b = 1) => mix(a, b, hash(i * 7919 + 13));

// Vecteurs
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Rotation : matrice 3x3 (lignes) depuis des angles en degrés, ordre Y (lacet) * X (tangage) * Z (roulis)
export function rotation(rx = 0, ry = 0, rz = 0) {
  const d = Math.PI / 180;
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx * d), Math.sin(rx * d), Math.cos(ry * d), Math.sin(ry * d), Math.cos(rz * d), Math.sin(rz * d)];
  const X = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
  const Y = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const Z = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  return mat3mul(Y, mat3mul(X, Z));
}
export function mat3mul(A, B) {
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) R[i][j] += A[i][k] * B[k][j];
  return R;
}
export const mat3vec = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];

// Couleurs : hexadécimal sRGB vers [r,g,b] entre 0 et 1 (sRGB) ; le moteur passe en linéaire
export function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const lin = (c) => c.map((v) => Math.pow(v, 2.2));

// Charte
export const C = {
  noir: '#0d0d0f',
  accent: '#ff5a1f',
  violet: '#2a1745',
  violetClair: '#5b3a8c',
  blanc: '#f4f1ec',
  gris1: '#1c1c1f',
  gris2: '#2a2a2e',
  gris3: '#3a3a3f',
  gris4: '#5c5c63',
  gris5: '#8d8d94',
  gris6: '#b9b9bf',
  papier: '#6f6a62', // papier réglé sombre
  encre: '#2b2a33',
};
export const POLICE = 'Geist, system-ui, sans-serif';
export const MAIN = 'Caveat, cursive';

// Quaternions : interpolation d'orientations sans à-coup
export function quatDeMat(m) {
  const tr = m[0][0] + m[1][1] + m[2][2];
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, s / 4]; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = [s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s]; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = [(m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s]; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = [(m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4, (m[1][0] - m[0][1]) / s]; }
  return q;
}
export function matDeQuat([x, y, z, w]) {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}
export function slerp(a, b, k) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map((v) => -v); d = -d; }
  if (d > 0.9995) { const r = a.map((v, i) => v + (b[i] - v) * k); const l = Math.hypot(...r); return r.map((v) => v / l); }
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - k) * th) / s, wb = Math.sin(k * th) / s;
  return a.map((v, i) => v * wa + b[i] * wb);
}
export const rotEntre = (A, B, k) => matDeQuat(slerp(quatDeMat(A), quatDeMat(B), clamp(k)));

// Courbe de Bézier quadratique entre trois points
export function bezier(a, c, b, k) {
  const u = 1 - k;
  return [0, 1, 2].map((i) => u * u * a[i] + 2 * u * k * c[i] + k * k * b[i]);
}
