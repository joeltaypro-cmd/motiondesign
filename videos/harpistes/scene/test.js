// Scène d'essai du moteur (vitesse, matières). Non utilisée par la vidéo.
import { enregistrer, T, rr, texte, IMAGES, clavierDessin } from './base.js';
import { boite, aPlat } from './outils.js';
import { hex, C } from './lib.js';

enregistrer('essaiPlaque', (ctx, w, h) => {
  ctx.fillStyle = 'rgba(10,10,12,0.85)'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i === 1 ? '#ff5a1f' : '#26262a'; rr(ctx, 30, 120 + i * 150, w - 60, 130, 18); ctx.fill();
    texte(ctx, 'Do & Octaves', 300, 190 + i * 150, { taille: 40, couleur: '#fff' });
  }
});
enregistrer('essaiClavier', (ctx, w, h) => clavierDessin(ctx, 0, 0, w, h, { nb: 36, allumees: [7, 9, 11] }));
enregistrer('essaiH', (ctx, w, h) => { const im = IMAGES.logoH; const s = Math.min(w / im.width, h / im.height) * 0.9; ctx.drawImage(im, (w - im.width * s) / 2, (h - im.height * s) / 2, im.width * s, im.height * s); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#ff5a1f'; ctx.fillRect(0, 0, w, h); });
enregistrer('essaiEcran', (ctx, w, h) => { ctx.fillStyle = '#333'; ctx.fillRect(0, 0, w, h); texte(ctx, 'Tuto piano', 40, 120, { taille: 90, couleur: '#ddd' }); });

export const film = {
  plan: () => ({ id: 'TEST', debut: 0, fin: 20 }),
  scene: (t) => ({
    cam: { pos: [0.9, 0.75, 1.6], cible: [0, 0.35, -0.2], fov: 35, ouverture: 0.01 },
    env: { fond: hex(C.noir), halo: hex(C.violet), haloI: 1.5, ambiante: [0.5, 0.45, 0.6], ambI: 0.06, sol: [0.02, 0.02, 0.025], reflet: 0.2, flouSol: 0.05, brume: [3, 8], dirHalo: [0, -1], haloNet: 4 },
    lumieres: [{ p: [1.5, 2.5, 1.5], couleur: [1, 0.85, 0.7], i: 12, rayon: 0.4 }, { p: [-2, 1.2, -1.5], couleur: [0.6, 0.4, 1], i: 6, rayon: 0.3, ombre: false }],
    boites: [
      boite({ p: [0, 0.045, 0.2], d: [1.0, 0.3, 0.09], rot: aPlat(0), r: 0.01, tex: T('essaiClavier', {}, 2048, 512), eclairee: true, couleur: hex('#18181a'), brillance: 0.6 }),
      boite({ p: [0, 0.68, -0.45], d: [0.62, 1.35, 0.012], r: 0.04, type: 'verre', tex: T('essaiPlaque', {}, 512, 1110), emit: 1.3, couleur: hex('#8899aa') }),
      boite({ p: [0.25, 0.2, 0.2], d: [0.16, 0.08, 0.009], rx: -15, r: 0.01, tex: T('essaiEcran', {}, 640, 320), emit: 1, couleur: hex('#111'), vernis: 0.5, brillance: 0.95 }),
      ...(new URLSearchParams(location.search).get('sansH') ? [] : [boite({ p: [-0.45, 0.25, 0.3], d: [0.3, 0.3, 0.03], ry: 30 + t * 20, type: 'decoupe', tex: T('essaiH', {}, 1024, 1024), emit: 1.6, couleur: hex('#a8401a'), brillance: 0.8 })]),
    ],
    spheres: [{ p: [-1.2, 0.9, -2.5], r: 0.06, couleur: [1, 0.6, 0.3], i: 8 }],
    post: { exposition: 1.1, halo: 0.4 },
  }),
};
