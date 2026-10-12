#!/usr/bin/env node
// Mesures du son (je ne peux pas écouter) : sonie intégrée, crête vraie, niveau par mesure,
// silence de l'arrêt et de la dernière image, et comparaison des coups de grosse caisse avec le conducteur.
//   node tools/mesures-son.mjs [rendu/son]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAPPES, K, DUREE, IMG, MESURE } from '../scene/cues.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOS = path.resolve(RACINE, process.argv[2] || 'rendu/son');

function ebur(fichier, debut = 0, duree = DUREE) {
  const r = execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(debut), '-t', String(duree), '-i', fichier, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  return r;
}
function ebur2(fichier, debut, duree) {
  try { execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(debut), '-t', String(duree), '-i', fichier, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return String(e.stderr); }
  return '';
}
function resume(fichier, debut = 0, duree = DUREE) {
  let txt = '';
  try { txt = execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(debut), '-t', String(duree), '-i', fichier, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }); } catch (e) { txt = String(e.stderr || ''); }
  return txt;
}
function lireStderr(fichier, debut, duree) {
  const { spawnSync } = awaitImport;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(debut), '-t', String(duree), '-i', fichier, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr;
  const I = s.match(/I:\s+(-?[\d.]+|-inf) LUFS/g);
  const P = s.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/g);
  return { I: I ? I.at(-1).match(/(-?[\d.]+|-inf)/)[1] : '?', crete: P ? P.at(-1).match(/(-?[\d.]+|-inf)/)[1] : '?' };
}
const awaitImport = await import('node:child_process');

// amplitude maximale d'un intervalle (lecture directe du WAV 24 bits)
function maxIntervalle(fichier, t0, t1) {
  const b = fs.readFileSync(fichier);
  const sr = b.readUInt32LE(24), ch = b.readUInt16LE(22), bps = b.readUInt16LE(34) / 8;
  let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const d = o + 8, n = b.readUInt32LE(o + 4) / (ch * bps);
  let m = 0;
  for (let i = Math.round(t0 * sr); i < Math.min(n, Math.round(t1 * sr)); i++) for (let c = 0; c < ch; c++) {
    const k = d + (i * ch + c) * bps;
    let v = b[k] | (b[k + 1] << 8) | (b[k + 2] << 16); if (v & 0x800000) v -= 0x1000000;
    m = Math.max(m, Math.abs(v) / 8388608);
  }
  return m === 0 ? '-inf' : (20 * Math.log10(m)).toFixed(1);
}

for (const nom of ['musique', 'mix']) {
  const f = path.join(DOS, nom + '.wav');
  if (!fs.existsSync(f)) continue;
  const g = lireStderr(f, 0, DUREE);
  console.log(`\n${nom}.wav : sonie intégrée ${g.I} LUFS, crête vraie ${g.crete} dBFS`);
  const lignes = [];
  for (let m = 1; m <= 10; m++) {
    const r = lireStderr(f, (m - 1) * MESURE, MESURE);
    lignes.push(`  mesure ${String(m).padStart(2)} : ${String(r.I).padStart(6)} LUFS   crête ${String(r.crete).padStart(6)} dBFS`);
  }
  console.log(lignes.join('\n'));
  console.log(`  arrêt ${K.fige}–${K.chute} s : max ${maxIntervalle(f, K.fige, K.chute)} dBFS ; dernière image : max ${maxIntervalle(f, DUREE - IMG, DUREE)} dBFS`);
}
const jouees = JSON.parse(fs.readFileSync(path.join(DOS, 'frappes-jouees.json'), 'utf8'));
const attendues = FRAPPES.map((f) => +f.t.toFixed(6));
const ok = jouees.length === attendues.length && jouees.every((t, i) => Math.abs(t - attendues[i]) < 1e-6);
console.log(`\nGrosse caisse : ${jouees.length} coups joués, ${attendues.length} dans le conducteur (K.frappes) : ${ok ? 'listes identiques' : 'ÉCART'}`);
if (!ok) console.log('joués', jouees.join(' '), '\nconducteur', attendues.join(' '));
