#!/usr/bin/env node
// Quelques images d'essai : node tools/essai.mjs --t 0.2,1.5 [--w 960 --h 540 --passes 12 --sortie essais --film film]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancer } from './lib/chrome.mjs';
import { servir } from './lib/serveur.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 960), H = +arg('h', 540), PASSES = +arg('passes', 12);
const sortie = path.resolve(RACINE, arg('sortie', 'essais'));
const film = arg('film', 'film');
const noms = arg('noms', '');
let temps = (arg('t', '0') || '').split(',').filter(Boolean).map(Number);
fs.mkdirSync(sortie, { recursive: true });

export function enPNG(base64, w, h, fichier) {
  return new Promise((ok, ko) => {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-vf', 'vflip', '-frames:v', '1', fichier], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('exit', (c) => (c === 0 ? ok() : ko(new Error('ffmpeg ' + c))));
    ff.stdin.end(Buffer.from(base64, 'base64'));
  });
}

const srv = await servir(RACINE);
const c = await lancer({ largeur: W, hauteur: H });
try {
  await c.ouvrir(`${srv.url}/index.html?w=${W}&h=${H}&passes=${PASSES}&film=${film}`);
  const listeNoms = noms ? noms.split(',') : [];
  for (let i = 0; i < temps.length; i++) {
    const t = temps[i];
    const d = Date.now();
    const plan = await c.evaluer(`__seek(${t})`);
    const b64 = await c.evaluer('__pixels()');
    const nom = listeNoms[i] || `t${t.toFixed(3).replace('.', '_')}_${plan}`;
    await enPNG(b64, W, H, path.join(sortie, nom + '.png'));
    console.log(`${nom}.png  plan ${plan}  ${((Date.now() - d) / 1000).toFixed(1)} s`);
  }
} finally {
  await c.fermer(); srv.fermer();
}
