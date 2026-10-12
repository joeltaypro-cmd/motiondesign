#!/usr/bin/env node
// Dit ce qui est présent et ce qui manque, avec la commande d'installation pour chaque système. N'installe rien.
import { execFileSync } from 'node:child_process';
import { trouverChrome } from './lib/chrome.mjs';
const essai = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n')[0].trim(); } catch { return null; } };
const py = ['python3', 'python', 'py'].find((p) => essai(p, ['-c', 'import PIL; print(PIL.__version__)']));
const lignes = [
  ['Node 22 ou plus', process.versions.node, +process.versions.node.split('.')[0] >= 22, 'https://nodejs.org (ou : winget install OpenJS.NodeJS / brew install node / apt install nodejs)'],
  ['Chrome, Chromium ou Edge', trouverChrome(), !!trouverChrome(), 'https://www.google.com/chrome (ou : brew install --cask google-chrome / apt install chromium) ; variable CHROME pour un chemin précis'],
  ['ffmpeg et ffprobe', essai('ffmpeg', ['-version']), !!essai('ffmpeg', ['-version']) && !!essai('ffprobe', ['-version']), 'winget install Gyan.FFmpeg / brew install ffmpeg / apt install ffmpeg'],
  ['Python avec Pillow', py ? `${py} (Pillow ${essai(py, ['-c', 'import PIL; print(PIL.__version__)'])})` : null, !!py, 'pip install pillow (Python : https://www.python.org)'],
];
for (const [nom, val, ok, aide] of lignes) console.log(`${ok ? 'présent ' : 'MANQUANT'}  ${nom.padEnd(26)} ${ok ? val : '-> ' + aide}`);
if (py) console.log(`\nCommande Python à utiliser : ${py}`);
console.log(process.env.GPU === '1' ? 'Rendu sur carte graphique (GPU=1).' : 'Rendu en logiciel (SwiftShader). Avec une carte graphique, lancer les rendus avec GPU=1 : beaucoup plus rapide.');
