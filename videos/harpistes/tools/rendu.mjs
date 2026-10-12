#!/usr/bin/env node
// Rendu image par image : Chrome sans fenêtre dessine chaque instant (window.__seek), les pixels partent en flux vers ffmpeg.
// Le rendu est découpé en segments d'une seconde, quasi sans perte : un rendu interrompu reprend où il s'était arrêté.
//   node tools/rendu.mjs --w 1920 --h 1080 --passes 10 --dossier rendu/seg-1080 [--de 0 --a 1200 --seg 60 --chrome 2]
// Puis : node tools/bin/encode_flux --dossier rendu/seg-1080 --sortie rendu/video.mp4 --debit 16M
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancer } from './lib/chrome.mjs';
import { servir } from './lib/serveur.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1920), H = +arg('h', 1080), PASSES = +arg('passes', 10), IPS = 60;
const DE = +arg('de', 0), A = +arg('a', 1200), SEG = +arg('seg', 60), NCHROME = +arg('chrome', process.env.GPU === '1' ? 4 : 2);
const DOSSIER = path.resolve(RACINE, arg('dossier', `rendu/seg-${H}`));
fs.mkdirSync(DOSSIER, { recursive: true });
const journal = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); };

const nomSeg = (i) => path.join(DOSSIER, `seg_${String(i).padStart(4, '0')}.mkv`);
function nbImages(f) {
  try {
    const r = execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f], { encoding: 'utf8' });
    return parseInt(r.trim(), 10) || 0;
  } catch { return 0; }
}
// segments à faire (les segments complets déjà présents sont gardés)
const segments = [];
for (let s = Math.floor(DE / SEG); s * SEG < A; s++) {
  const i0 = Math.max(DE, s * SEG), i1 = Math.min(A, (s + 1) * SEG);
  const f = nomSeg(s);
  if (fs.existsSync(f) && nbImages(f) === i1 - i0 && i0 === s * SEG) continue;
  segments.push({ s, i0, i1, f });
}
if (!segments.length) { journal('rien à rendre : tous les segments sont présents'); process.exit(0); }
journal(`${W}x${H}, ${PASSES} passes, ${segments.length} segment(s) à rendre, ${NCHROME} Chrome`);

const srv = await servir(RACINE);
const chromes = [];
for (let k = 0; k < NCHROME; k++) {
  const c = await lancer({ largeur: W, hauteur: H });
  await c.ouvrir(`${srv.url}/index.html?w=${W}&h=${H}&passes=${PASSES}`);
  chromes.push(c);
}
journal('page prête');

async function rendreSegment(seg) {
  const tmp = seg.f + '.partiel.mkv';
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(IPS), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '3', '-pix_fmt', 'yuv444p', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fini = new Promise((ok, ko) => ff.on('exit', (c) => (c === 0 ? ok() : ko(new Error('ffmpeg ' + c)))));
  const n = seg.i1 - seg.i0;
  const prets = new Map();
  let suivant = 0, distribue = 0;
  const ecrire = async () => {
    while (prets.has(suivant)) {
      const b = prets.get(suivant); prets.delete(suivant);
      if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r));
      suivant++;
    }
  };
  await Promise.all(chromes.map(async (c) => {
    while (distribue < n) {
      const k = distribue++;
      const t = (seg.i0 + k) / IPS;
      await c.evaluer(`__seek(${t})`);
      const b64 = await c.evaluer('__pixels()');
      prets.set(k, Buffer.from(b64, 'base64'));
      await ecrire();
    }
  }));
  await ecrire();
  ff.stdin.end();
  await fini;
  fs.renameSync(tmp, seg.f);
}

const debut = Date.now();
let faits = 0;
try {
  for (const seg of segments) {
    const d = Date.now();
    await rendreSegment(seg);
    faits += seg.i1 - seg.i0;
    const reste = segments.slice(segments.indexOf(seg) + 1).reduce((a, s) => a + s.i1 - s.i0, 0);
    const parImage = (Date.now() - debut) / 1000 / faits;
    journal(`segment ${seg.s} (images ${seg.i0}-${seg.i1 - 1}) en ${((Date.now() - d) / 1000).toFixed(0)} s ; ${parImage.toFixed(2)} s/image ; reste environ ${(reste * parImage / 60).toFixed(0)} min`);
  }
  journal('terminé');
} finally {
  for (const c of chromes) await c.fermer();
  srv.fermer();
}
