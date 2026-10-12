// Pilote minimal de Chrome sans dépendance : lancement sans fenêtre, protocole DevTools par WebSocket.
// Fonctionne sous Windows, macOS et Linux avec Node 22 (WebSocket intégré).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function trouverChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const c = [];
  if (process.platform === 'win32') {
    for (const base of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      c.push(path.join(base, 'Google/Chrome/Application/chrome.exe'));
      c.push(path.join(base, 'Chromium/Application/chrome.exe'));
      c.push(path.join(base, 'Microsoft/Edge/Application/msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    for (const d of (process.env.PATH || '').split(':')) {
      for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) c.push(path.join(d, n));
    }
    const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    if (fs.existsSync(pw)) {
      for (const d of fs.readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
        c.push(path.join(pw, d, 'chrome-linux/chrome'), path.join(pw, d, 'chrome-linux64/chrome'));
      }
    }
  }
  return c.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

export async function lancer({ largeur = 1920, hauteur = 1080, gpu = process.env.GPU === '1' } = {}) {
  const exe = trouverChrome();
  if (!exe) throw new Error('Chrome introuvable (variable CHROME pour indiquer son chemin).');
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'harp-chrome-'));
  const args = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--window-size=${largeur},${hauteur}`, '--ignore-gpu-blocklist',
    ...(gpu ? ['--enable-gpu', '--use-angle=default'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
    ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ];
  const proc = spawn(exe, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let journal = '';
  const wsNav = await new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('Chrome ne répond pas :\n' + journal)), 30000);
    proc.stderr.on('data', (d) => {
      journal += d;
      const m = journal.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) { clearTimeout(t); ok(m[1]); }
    });
    proc.on('exit', (c) => { clearTimeout(t); ko(new Error('Chrome s\'est arrêté (' + c + ') :\n' + journal)); });
  });
  const port = new URL(wsNav).port;
  let cibles = [];
  for (let i = 0; i < 50 && !cibles.find((c) => c.type === 'page'); i++) {
    cibles = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (!cibles.find((c) => c.type === 'page')) await attendre(100);
  }
  const page = cibles.find((c) => c.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  let id = 0;
  const attente = new Map();
  const ecouteurs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && attente.has(m.id)) {
      const { ok, ko } = attente.get(m.id); attente.delete(m.id);
      m.error ? ko(new Error(m.error.message)) : ok(m.result);
    } else if (m.method) for (const f of ecouteurs) f(m);
  };
  const envoyer = (method, params = {}) => new Promise((ok, ko) => {
    const n = ++id; attente.set(n, { ok, ko }); ws.send(JSON.stringify({ id: n, method, params }));
  });
  await envoyer('Runtime.enable');
  ecouteurs.push((m) => {
    if (m.method === 'Runtime.consoleAPICalled' && process.env.CONSOLE) {
      console.error('[page]', m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      console.error('[page] ERREUR', d.exception?.description || d.text, d.url || '', d.lineNumber ?? '');
    }
  });
  async function evaluer(expression, { attendrePromesse = true } = {}) {
    const r = await envoyer('Runtime.evaluate', { expression, awaitPromise: attendrePromesse, returnByValue: true });
    if (r.exceptionDetails) throw new Error('Erreur dans la page : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async function ouvrir(url, delai = 120000) {
    await envoyer('Page.enable');
    await envoyer('Page.navigate', { url });
    const debut = Date.now();
    while (Date.now() - debut < delai) {
      try { if (await evaluer('window.__ready === true')) return; } catch {}
      const err = await evaluer('window.__erreur || null').catch(() => null);
      if (err) throw new Error('La page signale : ' + err);
      await attendre(100);
    }
    throw new Error('La page n\'est pas prête après ' + delai / 1000 + ' s (erreur de script ?)');
  }
  async function fermer() {
    try { ws.close(); } catch {}
    proc.kill('SIGKILL');
    await attendre(200);
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch {}
  }
  return { envoyer, evaluer, ouvrir, fermer, exe };
}
