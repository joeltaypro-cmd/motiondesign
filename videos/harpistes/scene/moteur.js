// Moteur 3D : lanceur de rayons WebGL2 écrit à la main.
// Sol laqué qui reflète, boîtes arrondies orientées (24 au plus, une texture par grande face),
// verre, écrans lumineux, découpes en relief (logo), sphères lumineuses (6), lumières ponctuelles (4).
// Chaque image cumule N passes décalées dans le temps (flou de mouvement), dans l'objectif
// (flou de profondeur) et dans le pixel (anticrénelage), puis halo, courbe filmique et grain.

import { lin } from './lib.js';

export const MAX_BOITES = 24, MAX_SPHERES = 6, MAX_LUMIERES = 4;
const NB_CHAMPS = 9;
export const TYPES = { mat: 0, ecran: 0, verre: 2, decoupe: 3 };

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

// Source du shader de rayons, déroulé pour une liste donnée de types de boîtes, de sphères et de lumières :
// indices constants et un seul appel à l'éclairage, ce qui garde le code compilé petit et rapide.
function sourceRayons(types, ns, nl, defs) {
  const nb = types.length;
  const O = (i) => i * NB_CHAMPS;
  const intersection = (i, ty) => (ty === 3
    ? `iDecoupe(lo, ld, uB[${O(i) + 1}].xyz, uB[${O(i) + 5}], n, face)`
    : `iBoite(lo, ld, uB[${O(i) + 1}].xyz, uB[${O(i)}].w, n, face)`);
  const repereLocal = (i) => `
        vec3 lo = vec3(dot(uB[${O(i) + 2}].xyz, oc), dot(uB[${O(i) + 3}].xyz, oc), dot(uB[${O(i) + 4}].xyz, oc));
        vec3 ld = sansZero(vec3(dot(uB[${O(i) + 2}].xyz, rd), dot(uB[${O(i) + 3}].xyz, rd), dot(uB[${O(i) + 4}].xyz, rd)));`;
  const blocLancer = (i, ty) => `
  if (ignore != ${i}) {
    vec3 oc = ro - uB[${O(i)}].xyz;
    float b = dot(oc, rd);
    float cc = dot(oc, oc) - uB[${O(i) + 8}].z;
    if (cc <= 0.0 || b <= 0.0) {
      float disc = b * b - cc;
      if (disc >= 0.0 && -b - sqrt(disc) < I.t) {${repereLocal(i)}
        vec3 n; int face;
        float t = ${intersection(i, ty)};
        if (t < I.t) { I.t = t; I.id = ${i}; I.n = n; I.face = face; I.lp = lo + ld * t; }
      }
    }
  }`;
  const blocOmbre = (i, ty) => `
  if (uB[${O(i) + 8}].w < 0.5) {
    vec3 oc = ro - uB[${O(i)}].xyz;
    float b = dot(oc, rd);
    float cc = dot(oc, oc) - uB[${O(i) + 8}].z;
    if (cc <= 0.0 || b <= 0.0) {
      float disc = b * b - cc;
      if (disc >= 0.0 && -b - sqrt(disc) < tMax) {${repereLocal(i)}
        vec3 n; int face;
        float t = ${intersection(i, ty)};
        if (t < tMax) { ${ty === 2 ? 'vis *= 0.6;' : 'return 0.0;'} }
      }
    }
  }`;
  const blocSphere = (i) => `
  {
    vec3 oc = ro - uS[${2 * i}].xyz;
    float r = uS[${2 * i}].w;
    float b = dot(oc, rd);
    float disc = b * b - (dot(oc, oc) - r * r);
    if (disc >= 0.0) {
      float t = -b - sqrt(disc);
      if (t > 1e-4 && t < I.t) { I.t = t; I.id = ${100 + i}; I.n = normalize(oc + rd * t); }
    }
  }`;
  const blocLumiere = (i) => `
  {
    vec3 Lc = uL[${2 * i}].xyz - p;
    float d2 = dot(Lc, Lc);
    float dc = sqrt(d2);
    Lc /= dc;
    float ndl = dot(n, Lc);
    if (ndl > 0.0) {
      float sh = 1.0;
      ${i === 0 ? `#ifndef SANS_OMBRE
      if (ombres && uL[1].w > 0.5) {
        vec3 Lj = uL[0].xyz + (alea3() - 0.5) * 2.0 * uL[0].w - p;
        float dj = length(Lj);
        sh = visibilite(p + n * 2e-3, Lj / dj, dj);
      }
#endif` : ''}
      // lumière étendue : le lobe s'élargit selon sa taille apparente (pas de point brûlé)
      float th = uL[${2 * i}].w / dc;
      float e2 = e / (1.0 + e * th * th * 0.5);
      float s = pow(max(dot(n, normalize(Lc + v)), 0.0), e2) * (e2 + 8.0) / 25.0;
      col += uL[${2 * i + 1}].rgb / d2 * sh * ndl * (alb + spec * s);
    }
  }`;
  return `#version 300 es
${defs}
precision highp float;
precision highp int;
out vec4 sortie;
uniform vec2 uRes;
uniform vec4 uJit;        // xy : décalage dans le pixel ; zw : point dans l'objectif (disque unité)
uniform float uSeed;
uniform vec3 uCamPos, uCamX, uCamY, uCamZ;
uniform vec4 uCam;        // tan(fov/2), rapport, distance de mise au point, rayon d'ouverture
uniform vec4 uB[${Math.max(1, nb * NB_CHAMPS)}];
uniform vec4 uS[${Math.max(1, ns * 2)}];
uniform vec4 uL[${Math.max(1, nl * 2)}];
uniform vec4 uEnv[6];
uniform sampler2D uAtlas;

uvec3 pcg3d(uvec3 v){
  v = v * 1664525u + 1013904223u;
  v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  v ^= v >> 16u;
  v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  return v;
}
uint gEtat = 0u;
float alea1(){
  gEtat = gEtat * 747796405u + 2891336453u;
  uint w = ((gEtat >> ((gEtat >> 28u) + 4u)) ^ gEtat) * 277803737u;
  return float((w >> 22u) ^ w) * (1.0 / 4294967295.0);
}
vec3 alea3(){ return vec3(alea1(), alea1(), alea1()); }
vec3 sansZero(vec3 d){
  return vec3(abs(d.x) < 1e-7 ? 1e-7 : d.x, abs(d.y) < 1e-7 ? 1e-7 : d.y, abs(d.z) < 1e-7 ? 1e-7 : d.z);
}

vec4 texAtlas(vec4 rect, vec2 uv){
  vec4 c = textureLod(uAtlas, rect.xy + clamp(uv, 0.0, 1.0) * rect.zw, 0.0);
  return vec4(c.rgb * c.rgb * (c.rgb * 0.2 + 0.8), c.a);
}

vec3 environnement(vec3 d){
  vec3 c = uEnv[0].rgb;
  float hz = 1.0 - abs(d.y);
  vec2 dh = d.xz; float l = length(dh); dh = l > 1e-5 ? dh / l : vec2(0.0, -1.0);
  float dirw = max(dot(dh, uEnv[5].xz), 0.0);
  float h2 = max(hz, 0.0); h2 *= h2; h2 *= h2;
  float g = h2 * h2 * (0.25 + 0.75 * dirw * dirw);
  c += uEnv[1].rgb * g;
  c += uEnv[4].rgb * smoothstep(0.55, 0.8, d.y);
  return c;
}

// Boîte à coins arrondis (dans le plan xy) extrudée en z, dans son repère local
float iBoite(vec3 ro, vec3 rd, vec3 h, float r, out vec3 n, out int face){
  vec3 m = 1.0 / rd;
  vec3 k = abs(m) * h;
  vec3 c = -m * ro;
  vec3 t1 = c - k, t2 = c + k;
  float tN = max(max(t1.x, t1.y), t1.z);
  float tF = min(min(t2.x, t2.y), t2.z);
  n = vec3(0.0); face = 0;
  if (tN > tF || tN < 1e-4) return 1e9;
  bool faceZ = t1.z >= max(t1.x, t1.y);
  vec3 p = ro + rd * tN;
  vec2 q = abs(p.xy) - (h.xy - r);
  if (q.x <= 0.0 || q.y <= 0.0 || (faceZ && dot(q, q) <= r * r)) {
    if (faceZ) { n = vec3(0.0, 0.0, sign(p.z)); face = p.z > 0.0 ? 1 : 2; }
    else { n = (t1.x > t1.y) ? vec3(sign(p.x), 0.0, 0.0) : vec3(0.0, sign(p.y), 0.0); }
    return tN;
  }
  vec2 cc = sign(p.xy) * (h.xy - r);
  vec2 oc = ro.xy - cc;
  float a = dot(rd.xy, rd.xy);
  if (a < 1e-12) return 1e9;
  float b = dot(oc, rd.xy);
  float cq = dot(oc, oc) - r * r;
  float d = b * b - a * cq;
  if (d < 0.0) return 1e9;
  float t = (-b - sqrt(d)) / a;
  if (t < tN - 1e-5 || t > tF) return 1e9;
  n = vec3((ro.xy + rd.xy * t - cc) / r, 0.0);
  return t;
}

vec2 uvFace(vec3 lp, vec3 h, int face){
  float u = lp.x / h.x * 0.5;
  return vec2(face == 2 ? 0.5 - u : 0.5 + u, 0.5 - lp.y / h.y * 0.5);
}

float alphaDecoupe(vec4 rect, vec2 xy, vec3 h){
  vec2 uv = vec2(0.5 + xy.x / h.x * 0.5, 0.5 - xy.y / h.y * 0.5);
  return textureLod(uAtlas, rect.xy + clamp(uv, 0.0, 1.0) * rect.zw, 0.0).a;
}

// Découpe extrudée : on avance dans l'épaisseur jusqu'à entrer dans la forme
float iDecoupe(vec3 ro, vec3 rd, vec3 h, vec4 rect, out vec3 n, out int face){
  vec3 m = 1.0 / rd;
  vec3 k = abs(m) * h;
  vec3 c = -m * ro;
  vec3 t1 = c - k, t2 = c + k;
  float tN = max(max(t1.x, t1.y), t1.z);
  float tF = min(min(t2.x, t2.y), t2.z);
  n = vec3(0.0); face = 0;
  if (tN > tF || tN < 1e-4) return 1e9;
  bool faceZ = t1.z >= max(t1.x, t1.y);
  const int NS = 8;
  float dt = (tF - tN) / float(NS);
  float tPrec = tN;
  for (int s = 0; s <= NS; s++) {
    float ts = tN + dt * float(s);
    vec3 p = ro + rd * ts;
    if (alphaDecoupe(rect, p.xy, h) > 0.5) {
      if (s == 0 && faceZ) { n = vec3(0.0, 0.0, sign(p.z)); face = p.z > 0.0 ? 1 : 2; return ts; }
      float a = tPrec, b = ts;
      for (int j = 0; j < 4; j++) {
        float mm = 0.5 * (a + b);
        if (alphaDecoupe(rect, (ro + rd * mm).xy, h) > 0.5) b = mm; else a = mm;
      }
      vec3 pb = ro + rd * b;
      float ex = 0.008 * h.x;
      float gx = alphaDecoupe(rect, pb.xy + vec2(ex, 0.0), h) - alphaDecoupe(rect, pb.xy - vec2(ex, 0.0), h);
      float gy = alphaDecoupe(rect, pb.xy + vec2(0.0, ex), h) - alphaDecoupe(rect, pb.xy - vec2(0.0, ex), h);
      vec2 g = vec2(gx, gy);
      n = length(g) > 1e-5 ? vec3(-normalize(g), 0.0) : vec3(0.0, 0.0, sign(pb.z));
      return b;
    }
    tPrec = ts;
  }
  return 1e9;
}

struct Impact { float t; int id; vec3 n; vec3 lp; int face; };

Impact lancer(vec3 ro, vec3 rd, int ignore){
  Impact I; I.t = 1e9; I.id = -1; I.face = 0; I.n = vec3(0.0, 1.0, 0.0); I.lp = vec3(0.0);
  if (rd.y < -1e-5) { float t = -ro.y / rd.y; if (t > 1e-4) { I.t = t; I.id = -2; } }
${types.map((ty, i) => blocLancer(i, ty)).join('')}
${Array.from({ length: ns }, (_, i) => blocSphere(i)).join('')}
  return I;
}

float visibilite(vec3 ro, vec3 rd, float tMax){
  float vis = 1.0;
${types.map((ty, i) => blocOmbre(i, ty)).join('')}
  return vis;
}

vec3 ambiante(vec3 n){
  return uEnv[2].rgb * (0.55 + 0.45 * n.y) + uEnv[1].rgb * 0.25 * (1.0 - abs(n.y));
}

vec3 eclairer(vec3 p, vec3 n, vec3 v, vec3 alb, float brillance, float spec, bool ombres){
  vec3 col = alb * ambiante(n);
  float e = mix(6.0, 900.0, brillance * brillance);
${Array.from({ length: nl }, (_, i) => blocLumiere(i)).join('')}
  return col;
}

vec3 couleurSphere(int id){
  ${Array.from({ length: ns }, (_, i) => `if (id == ${100 + i}) return uS[${2 * i + 1}].rgb;`).join('\n  ')}
  return vec3(0.0);
}

void main(){
  gEtat = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(uSeed))).x;
  vec2 px = gl_FragCoord.xy + uJit.xy;
  vec2 ndc = px / uRes * 2.0 - 1.0;
  vec3 dir = normalize(uCamZ + uCamX * (ndc.x * uCam.x * uCam.y) + uCamY * (ndc.y * uCam.x));
  vec3 pf = uCamPos + dir * (uCam.z / dot(dir, uCamZ));
  float ang = alea1() * 6.2831853;
  vec2 lens = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * uJit.zw * uCam.w;
  vec3 ro = uCamPos + uCamX * lens.x + uCamY * lens.y;
  vec3 rd = normalize(pf - ro);

  vec3 col = vec3(0.0), thr = vec3(1.0);
  int ignore = -1;
#ifdef TRACE
  { Impact I = lancer(ro, rd, -1); sortie = vec4(vec3(I.t * 0.1), 1.0); return; }
#endif
#ifdef VIDE
  { sortie = vec4(environnement(rd), 1.0); return; }
#endif
#ifndef NREB
#define NREB 3
#endif
  for (int rebond = 0; rebond < NREB; rebond++) {
#ifdef SANS_REFLET
    if (rebond > 0) break;
#endif
    Impact I = lancer(ro, rd, ignore);
    if (I.id == -1) { col += thr * environnement(rd); break; }
    if (I.id >= 100) { col += thr * couleurSphere(I.id); break; }
    vec3 p = ro + rd * I.t;
    vec3 v = -rd;
    // description de la surface touchée
    vec3 n = vec3(0.0, 1.0, 0.0), alb = vec3(0.0), emis = vec3(0.0);
    float brillance = 0.5, spec = 0.5, F = 0.0, flou = 0.0;
    bool eclairage = true, suite = false, traverse = false;
    vec3 attenuation = vec3(1.0);
    if (I.id == -2) {
      float brume = smoothstep(uEnv[0].w, uEnv[1].w, length(p - uCamPos));
      float x5 = 1.0 - max(v.y, 0.0); x5 = x5 * x5 * x5 * x5 * x5;
      F = uEnv[2].w + (1.0 - uEnv[2].w) * x5;
      col += thr * brume * environnement(vec3(rd.x, 0.0, rd.z));
      thr *= 1.0 - brume;
      alb = uEnv[3].rgb; brillance = 0.6; spec = 0.12; flou = uEnv[3].w; suite = true;
    } else {
#ifdef PARAM_CONST
      vec4 P1 = uB[1], P2 = uB[2], P3 = uB[3], P4 = uB[4], P5 = uB[5], P6 = uB[6], P7 = uB[7], P8 = uB[8];
#else
      int o = I.id * ${NB_CHAMPS};
      vec4 P1 = uB[o + 1], P2 = uB[o + 2], P3 = uB[o + 3], P4 = uB[o + 4], P5 = uB[o + 5], P6 = uB[o + 6], P7 = uB[o + 7], P8 = uB[o + 8];
#endif
      float type = P1.w;
      vec3 h = P1.xyz;
      n = normalize(P2.xyz * I.n.x + P3.xyz * I.n.y + P4.xyz * I.n.z);
      if (dot(n, rd) > 0.0) n = -n;
      float emit = P2.w;
      brillance = P3.w;
      vec4 rect = I.face == 1 ? P5 : (I.face == 2 && P7.w < 1.5 ? P6 : vec4(-1.0));
      if (type > 2.5 && I.face == 2) rect = P5;
      vec4 tx = vec4(0.0);
#ifdef SANS_TEX2
      rect = vec4(-1.0);
#endif
      if (rect.z > 0.0) {
        vec2 uv = type > 2.5 ? vec2(0.5 + I.lp.x / h.x * 0.5, 0.5 - I.lp.y / h.y * 0.5) : uvFace(I.lp, h, I.face);
        tx = texAtlas(rect, uv);
      }
      vec3 cote = P7.rgb;
      float schlick = 1.0 - max(dot(n, v), 0.0); schlick = schlick * schlick * schlick * schlick * schlick;
      if (type > 1.5 && type < 2.5) {
        if (I.face == 0) { alb = cote; brillance = 0.9; spec = 0.6; }
        else {
          // verre : ce qui est dessiné émet, le reste laisse passer ; reflet selon Fresnel
          eclairage = false;
          float a = tx.a * P8.y;
          float Fv = 0.04 + 0.96 * schlick;
          col += thr * a * tx.rgb * emit * (1.0 - Fv);
          // reflet du verre : l'environnement seulement (déterministe, sans bruit)
          col += thr * Fv * P8.y * environnement(reflect(rd, n));
          traverse = true; attenuation = (1.0 - a) * (1.0 - Fv) * mix(vec3(1.0), cote, 0.35);
        }
      } else {
        alb = cote;
        if (rect.z > 0.0) {
          if (P7.w > 0.5) {
            alb = mix(cote, tx.rgb, tx.a);
            // carte d'émission séparée (par exemple les touches allumées d'un clavier éclairé)
            if (P7.w > 1.5) emis = texAtlas(P6, uvFace(I.lp, h, 1)).rgb * emit;
          }
          else { emis = tx.rgb * emit * tx.a; alb = cote * (1.0 - tx.a); }
        } else if (type > 2.5 && I.face != 0) emis = cote * emit;
        spec = (rect.z > 0.0 && P7.w < 0.5) ? 0.04 : 0.15 + 0.45 * brillance;
        F = P4.w * (0.06 + 0.94 * schlick);
        flou = (1.0 - brillance) * 0.35;
        suite = F > 0.004;
      }
    }
#ifdef SANS_LUM2
    if (eclairage) col += thr * (emis + alb * 0.2) * (1.0 - F);
#else
    if (eclairage) col += thr * (emis + eclairer(p, n, v, alb, brillance, spec, rebond == 0)) * (1.0 - F);
#endif
    if (traverse) {
      thr *= attenuation; ro = p + rd * 1e-3; ignore = I.id;
    } else {
      if (!suite || rebond == 2) break;
      vec3 a = alea3() - 0.5;
      vec3 nr = normalize(n + a * flou);
      rd = reflect(rd, nr);
      ro = p + n * 1e-3;
      thr *= F;
      ignore = -1;
    }
    if (max(thr.r, max(thr.g, thr.b)) < 0.01) break;
  }
  sortie = vec4(col, 1.0);
}`;
}

const FS_SEUIL = `#version 300 es
precision highp float;
out vec4 sortie;
uniform sampler2D uAcc; uniform float uN; uniform vec2 uTaille; uniform float uSeuil;
void main(){
  vec2 uv = gl_FragCoord.xy / uTaille;
  vec3 c = texture(uAcc, uv).rgb / uN;
  float l = max(c.r, max(c.g, c.b));
  sortie = vec4(c * max(l - uSeuil, 0.0) / max(l, 1e-4), 1.0);
}`;

const FS_FLOU = `#version 300 es
precision highp float;
out vec4 sortie;
uniform sampler2D uSrc; uniform vec2 uTaille; uniform vec2 uDir;
void main(){
  vec2 uv = gl_FragCoord.xy / uTaille;
  vec3 s = vec3(0.0); float w = 0.0;
  for (int i = -12; i <= 12; i++) {
    float k = exp(-float(i * i) / 50.0);
    s += texture(uSrc, uv + uDir * float(i) / uTaille).rgb * k; w += k;
  }
  sortie = vec4(s / w, 1.0);
}`;

const FS_FINAL = `#version 300 es
precision highp float;
out vec4 sortie;
uniform sampler2D uAcc; uniform sampler2D uHalo;
uniform float uN; uniform vec2 uRes; uniform vec4 uPost; uniform vec4 uFlash; uniform float uImage;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texelFetch(uAcc, ivec2(gl_FragCoord.xy), 0).rgb / uN;
  c += texture(uHalo, uv).rgb * uPost.y;
  c += uFlash.rgb * uFlash.a;
  c *= uPost.x;
  c = aces(c);
  vec2 q = (uv - 0.5) * vec2(1.0, 0.82);
  c *= 1.0 - uPost.z * pow(length(q) * 1.3, 2.6);
  c = pow(c, vec3(1.0 / 2.2));
  c += (h21(gl_FragCoord.xy + uImage * 17.13) - 0.5) * uPost.w;
  sortie = vec4(c, 1.0);
}`;

function compiler(gl, vs, fs) {
  const sh = (t, s) => {
    const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('Shader : ' + gl.getShaderInfoLog(o));
    return o;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Programme : ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nom = info.name.replace(/\[0\]$/, ''); u[nom] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

// Atlas de textures : chaque dessin (canevas 2D) est rangé par étagères dans une grande texture.
class Atlas {
  constructor(gl, L = 8192, H = 4096) {
    this.gl = gl; this.L = L; this.H = H;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, L, H);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.toile = document.createElement('canvas');
    this.vider();
  }
  vider() { this.places = new Map(); this.etageres = []; this.yLibre = 0; }
  ranger(w, h) {
    const m = 2;
    for (const e of this.etageres) {
      if (h + m <= e.h && e.x + w + m <= this.L) { const r = { x: e.x, y: e.y }; e.x += w + m; return r; }
    }
    if (this.yLibre + h + m > this.H || w + m > this.L) return null;
    const e = { y: this.yLibre, h: h + m, x: w + m };
    this.etageres.push(e); this.yLibre += h + m;
    return { x: 0, y: e.y };
  }
  dessiner(d, pos) {
    const gl = this.gl, t = this.toile;
    if (t.width !== d.w || t.height !== d.h) { t.width = d.w; t.height = d.h; }
    const ctx = t.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, d.w, d.h);
    ctx.save(); d.dessin(ctx, d.w, d.h); ctx.restore();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, pos.x, pos.y, gl.RGBA, gl.UNSIGNED_BYTE, t);
  }
  // Garantit la présence de toutes les textures demandées ; renvoie une table clé -> rectangle (uv)
  assurer(demandes) {
    const manquantes = demandes.filter((d) => !this.places.has(d.cle));
    if (manquantes.length) {
      const pos = manquantes.map((d) => this.ranger(d.w, d.h));
      if (pos.some((p) => !p)) {
        this.vider();
        const tri = [...demandes].sort((a, b) => b.h - a.h);
        for (const d of tri) {
          const p = this.ranger(d.w, d.h);
          if (!p) throw new Error('Atlas plein (' + demandes.length + ' textures)');
          this.dessiner(d, p); this.places.set(d.cle, this.rect(p, d));
        }
      } else {
        manquantes.forEach((d, i) => { this.dessiner(d, pos[i]); this.places.set(d.cle, this.rect(pos[i], d)); });
      }
    }
  }
  rect(p, d) {
    return [(p.x + 0.5) / this.L, (p.y + 0.5) / this.H, (d.w - 1) / this.L, (d.h - 1) / this.H];
  }
}

// Suites à faible écart pour répartir les passes
function radical(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
function disque(u, v) {
  const a = 2 * u - 1, b = 2 * v - 1;
  if (a === 0 && b === 0) return [0, 0];
  let r, phi;
  if (Math.abs(a) > Math.abs(b)) { r = a; phi = (Math.PI / 4) * (b / a); } else { r = b; phi = Math.PI / 2 - (Math.PI / 4) * (a / b); }
  return [r * Math.cos(phi), r * Math.sin(phi)];
}

export class Moteur {
  constructor(canvas, L, H, defs = '') {
    this.L = L; this.H = H;
    canvas.width = L; canvas.height = H;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 indisponible');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float indisponible');
    gl.getExtension('EXT_float_blend');
    this.flottantLineaire = !!gl.getExtension('OES_texture_float_linear');
    this.gl = gl;
    this.defs = defs.split(',').filter(Boolean).map((d) => '#define ' + d).join('\n');
    this.variantes = new Map();
    this.prSeuil = compiler(gl, VS, FS_SEUIL);
    this.prFlou = compiler(gl, VS, FS_FLOU);
    this.prFinal = compiler(gl, VS, FS_FINAL);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.acc = this.cible(L, H, gl.RGBA32F);
    this.hl = Math.max(1, Math.round(L / 4)); this.hh = Math.max(1, Math.round(H / 4));
    this.halo1 = this.cible(this.hl, this.hh, gl.RGBA16F);
    this.halo2 = this.cible(this.hl, this.hh, gl.RGBA16F);
    this.atlas = new Atlas(gl);
    this.tB = new Float32Array(MAX_BOITES * NB_CHAMPS * 4);
    this.tS = new Float32Array(MAX_SPHERES * 2 * 4);
    this.tL = new Float32Array(MAX_LUMIERES * 2 * 4);
    this.tE = new Float32Array(6 * 4);
  }
  cible(w, h, fmt) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    const filtre = fmt === gl.RGBA32F && !this.flottantLineaire ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtre);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtre);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Cible incomplète');
    return { tex, fb, w, h };
  }

  // Charge une scène dans les uniformes du programme de rayons
  programme(sc) {
    const types = (sc.boites || []).map((b) => TYPES[b.type || 'mat']);
    const ns = (sc.spheres || []).length, nl = (sc.lumieres || []).length;
    const cle = types.join('') + '|' + ns + '|' + nl;
    let pr = this.variantes.get(cle);
    if (!pr) { pr = compiler(this.gl, VS, sourceRayons(types, ns, nl, this.defs)); this.variantes.set(cle, pr); }
    return pr;
  }

  charger(sc) {
    const gl = this.gl;
    const boites = sc.boites || [];
    if (boites.length > MAX_BOITES) throw new Error(`Trop de boîtes : ${boites.length} > ${MAX_BOITES}`);
    const pr = this.programme(sc), u = pr.u;
    gl.useProgram(pr.p);
    gl.uniform1i(u.uAtlas, 0);
    gl.uniform2f(u.uRes, this.L, this.H);
    const B = this.tB; B.fill(0);
    boites.forEach((b, i) => {
      const o = i * NB_CHAMPS * 4;
      const h = [b.d[0] / 2, b.d[1] / 2, b.d[2] / 2];
      const r = Math.min(b.r || 0, h[0], h[1]);
      const R = b.rot; // matrice monde <- local (colonnes = axes locaux) ; on stocke sa transposée
      const ligne = (k) => [R[0][k], R[1][k], R[2][k]];
      const type = TYPES[b.type || 'mat'];
      B.set([b.p[0], b.p[1], b.p[2], r], o);
      B.set([h[0], h[1], h[2], type], o + 4);
      B.set([...ligne(0), b.emit ?? 1], o + 8);
      B.set([...ligne(1), b.brillance ?? 0.5], o + 12);
      B.set([...ligne(2), b.vernis ?? 0], o + 16);
      B.set(b.rectAvant || [-1, -1, -1, -1], o + 20);
      B.set(b.rectArriere || [-1, -1, -1, -1], o + 24);
      const cc = lin(b.couleur || [0.1, 0.1, 0.11]);
      B.set([cc[0], cc[1], cc[2], b.eclairee ? (b.emissif ? 2 : 1) : 0], o + 28);
      const R2 = Math.hypot(h[0], h[1], h[2]) * 1.001;
      B.set([R2, b.opacite ?? 1, R2 * R2, b.sansOmbre ? 1 : 0], o + 32);
    });
    if (boites.length) gl.uniform4fv(u.uB, B.subarray(0, boites.length * NB_CHAMPS * 4));
    const S = this.tS; S.fill(0);
    const sph = sc.spheres || [];
    if (sph.length > MAX_SPHERES) throw new Error('Trop de sphères');
    sph.forEach((s, i) => { const c = lin(s.couleur); S.set([...s.p, s.r], i * 8); S.set([c[0] * s.i, c[1] * s.i, c[2] * s.i, 0], i * 8 + 4); });
    if (sph.length) gl.uniform4fv(u.uS, S.subarray(0, sph.length * 8));
    const Lm = this.tL; Lm.fill(0);
    const lum = sc.lumieres || [];
    if (lum.length > MAX_LUMIERES) throw new Error('Trop de lumières');
    lum.forEach((l, i) => { const c = lin(l.couleur); Lm.set([...l.p, l.rayon ?? 0.1], i * 8); Lm.set([c[0] * l.i, c[1] * l.i, c[2] * l.i, l.ombre === false ? 0 : 1], i * 8 + 4); });
    if (lum.length) gl.uniform4fv(u.uL, Lm.subarray(0, lum.length * 8));
    const e = sc.env, E = this.tE;
    const fond = lin(e.fond), halo = lin(e.halo), amb = lin(e.ambiante), sol = lin(e.sol), boite = lin(e.boite || [0, 0, 0]);
    const dh = e.dirHalo || [0, -1];
    const ld = Math.hypot(dh[0], dh[1]) || 1;
    E.set([...fond, e.brume?.[0] ?? 6], 0);
    E.set([halo[0] * e.haloI, halo[1] * e.haloI, halo[2] * e.haloI, e.brume?.[1] ?? 14], 4);
    E.set([amb[0] * e.ambI, amb[1] * e.ambI, amb[2] * e.ambI, e.reflet ?? 0.06], 8);
    E.set([...sol, e.flouSol ?? 0.04], 12);
    E.set([boite[0] * (e.boiteI ?? 0), boite[1] * (e.boiteI ?? 0), boite[2] * (e.boiteI ?? 0), 0], 16);
    E.set([dh[0] / ld, 0, dh[1] / ld, e.haloNet ?? 3], 20);
    gl.uniform4fv(u.uEnv, E);
    const cam = sc.cam;
    const z = norm3(sub3(cam.cible, cam.pos));
    let xx = cross3(z, cam.haut || [0, 1, 0]);
    if (len3(xx) < 1e-6) xx = cross3(z, [0, 0, -1]);
    let x = norm3(xx);
    let y = cross3(x, z);
    if (cam.roulis) {
      const a = cam.roulis * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const x2 = add3(mul3(x, ca), mul3(y, sa)); const y2 = add3(mul3(y, ca), mul3(x, -sa)); x = x2; y = y2;
    }
    gl.uniform3fv(u.uCamPos, cam.pos);
    gl.uniform3fv(u.uCamX, x);
    gl.uniform3fv(u.uCamY, y);
    gl.uniform3fv(u.uCamZ, z);
    const focus = cam.focus ?? len3(sub3(cam.cible, cam.pos));
    gl.uniform4f(u.uCam, Math.tan((cam.fov ?? 35) * Math.PI / 360), this.L / this.H, focus, cam.ouverture ?? 0);
    return u;
  }

  // Ne garde que les boîtes utiles à l'image : vues directement, vues dans le reflet du sol,
  // ou assez proches du champ pour y porter une ombre. Accélère beaucoup les gros plans.
  trier(sc) {
    if (sc.sansTri) return sc;
    const cam = sc.cam;
    const z = norm3(sub3(cam.cible, cam.pos));
    let xx = cross3(z, cam.haut || [0, 1, 0]);
    if (len3(xx) < 1e-6) xx = cross3(z, [0, 0, -1]);
    const x = norm3(xx), y = cross3(x, z);
    const th = Math.tan((cam.fov ?? 35) * Math.PI / 360), a = this.L / this.H;
    const marge = sc.marge ?? 0.25;
    const vu = (c, R) => {
      const v = sub3(c, cam.pos);
      const dz = v[0] * z[0] + v[1] * z[1] + v[2] * z[2];
      if (dz < -R - marge) return false;
      const dx = Math.abs(v[0] * x[0] + v[1] * x[1] + v[2] * x[2]), dy = Math.abs(v[0] * y[0] + v[1] * y[1] + v[2] * y[2]);
      const zz = Math.max(dz, 0);
      return dx <= zz * th * a + (R + marge) * Math.hypot(1, th * a) && dy <= zz * th + (R + marge) * Math.hypot(1, th);
    };
    const boites = (sc.boites || []).filter((b) => {
      const R = Math.hypot(b.d[0], b.d[1], b.d[2]) / 2;
      return vu(b.p, R) || vu([b.p[0], -b.p[1], b.p[2]], R);
    });
    return { ...sc, boites };
  }

  // Assure les textures d'une scène et renseigne les rectangles d'atlas sur les boîtes
  textures(sc, registre) {
    const dem = new Map();
    for (const b of sc.boites || []) for (const k of ['tex', 'dos', 'emissif']) {
      const t = b[k];
      if (t && typeof t === 'object' && !dem.has(t.cle)) dem.set(t.cle, t);
    }
    this.atlas.assurer([...dem.values()]);
    for (const b of sc.boites || []) {
      b.rectAvant = b.tex ? this.atlas.places.get(b.tex.cle) : null;
      const d = b.emissif || (b.dos === 'meme' ? b.tex : b.dos);
      b.rectArriere = d ? this.atlas.places.get(d.cle) : null;
    }
  }

  // Rend l'image de l'instant t : sceneA(ts) donne la scène à un sous-instant ts
  rendre(sceneA, t, { passes = 24, obturation = 1 / 120, tMin = -1e9, tMax = 1e9, image = 0 } = {}) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc.fb);
    gl.viewport(0, 0, this.L, this.H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE);
    let post = null;
    for (let i = 0; i < passes; i++) {
      const decal = passes > 1 ? ((i + 0.5) / passes) : 0.5;
      const ts = Math.min(tMax, Math.max(tMin, t + (decal - 0.5) * obturation));
      const sc = this.trier(sceneA(ts));
      this.textures(sc);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc.fb);
      gl.viewport(0, 0, this.L, this.H);
      gl.enable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atlas.tex);
      const u = this.charger(sc);
      const jx = passes > 1 ? radical(i + 1, 2) - 0.5 : 0, jy = passes > 1 ? radical(i + 1, 3) - 0.5 : 0;
      const [lx, ly] = passes > 1 ? disque(radical(i + 1, 5), radical(i + 1, 7)) : [0, 0];
      gl.uniform4f(u.uJit, jx, jy, lx, ly);
      gl.uniform1f(u.uSeed, image * 64 + i);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (Math.abs(ts - t) < (obturation / passes) || !post) post = sc.post || {};
    }
    gl.disable(gl.BLEND);
    // halo : seuil puis flou séparable, à un quart de la définition
    gl.useProgram(this.prSeuil.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.halo1.fb); gl.viewport(0, 0, this.hl, this.hh);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.acc.tex);
    gl.uniform1i(this.prSeuil.u.uAcc, 0); gl.uniform1f(this.prSeuil.u.uN, passes);
    gl.uniform2f(this.prSeuil.u.uTaille, this.hl, this.hh); gl.uniform1f(this.prSeuil.u.uSeuil, post.seuilHalo ?? 0.95);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(this.prFlou.p);
    gl.uniform2f(this.prFlou.u.uTaille, this.hl, this.hh);
    for (const [src, dst, dir] of [[this.halo1, this.halo2, [1, 0]], [this.halo2, this.halo1, [0, 1]], [this.halo1, this.halo2, [2, 0]], [this.halo2, this.halo1, [0, 2]]]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(this.prFlou.u.uSrc, 0);
      gl.uniform2f(this.prFlou.u.uDir, dir[0] * this.hl / 480, dir[1] * this.hh / 270);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.useProgram(this.prFinal.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.L, this.H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.acc.tex); gl.uniform1i(this.prFinal.u.uAcc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.halo1.tex); gl.uniform1i(this.prFinal.u.uHalo, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(this.prFinal.u.uN, passes);
    gl.uniform2f(this.prFinal.u.uRes, this.L, this.H);
    gl.uniform4f(this.prFinal.u.uPost, post.exposition ?? 1, post.halo ?? 0.35, post.vignette ?? 0.35, post.grain ?? 0.012);
    const fl = post.flash || [0, 0, 0, 0];
    const fc = lin(fl.slice(0, 3));
    gl.uniform4f(this.prFinal.u.uFlash, fc[0], fc[1], fc[2], fl[3] || 0);
    gl.uniform1f(this.prFinal.u.uImage, image % 997);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Pixels RGBA de l'image courante (lignes du bas vers le haut)
  pixels() {
    const gl = this.gl;
    const px = new Uint8Array(this.L * this.H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, this.L, this.H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  }
}

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a) => { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
