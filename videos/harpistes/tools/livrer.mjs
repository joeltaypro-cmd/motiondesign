#!/usr/bin/env node
// Enchaîne la fin de chaîne à partir des segments rendus : encodage maître (16 Mbit/s), pose du son,
// version web (12 Mbit/s), comparaison, sondes, coupes et contrôles, copie des sons.
//   node tools/livrer.mjs --segments rendu/seg-1080 --nom lancement-ecole-des-harpistes [--dossier livraison]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const SEG = path.resolve(RACINE, arg('segments', 'rendu/seg-1080'));
const NOM = arg('nom', 'lancement-ecole-des-harpistes');
const DOS = path.resolve(RACINE, arg('dossier', 'livraison'));
const DEBIT = arg('debit', '16M');
fs.mkdirSync(DOS, { recursive: true });
const run = (cmd, args) => { console.log('>', cmd, args.join(' ')); execFileSync(cmd, args, { stdio: 'inherit', cwd: RACINE }); };

const muet = path.join(RACINE, 'rendu', `${NOM}-muet.mp4`);
const maitre = path.join(DOS, `${NOM}-1080p60.mp4`);
const web = path.join(DOS, `${NOM}-web-1080p60.mp4`);
run('node', ['tools/bin/encode_flux', '--dossier', SEG, '--sortie', muet, '--debit', DEBIT]);
run('node', ['tools/bin/mux', '--video', muet, '--son', 'rendu/son/mix.wav', '--sortie', maitre]);
run('node', ['tools/encode/encode', 'web', maitre, web]);
run('node', ['tools/bin/comparer', web, maitre]);
run('node', ['tools/encode/encode', 'probe', maitre]);
run('node', ['tools/encode/encode', 'probe', web]);
run('node', ['tools/bin/coupes', maitre, 'rendu/coupes.json']);
run('python3', ['tools/controle.py', 'rendu/coupes.json']);
for (const f of ['musique', 'mix']) fs.copyFileSync(path.join(RACINE, 'rendu/son', f + '.wav'), path.join(DOS, `${NOM}-${f}.wav`));
console.log('livraison prête dans', DOS);
