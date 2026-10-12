// Le conducteur : tous les instants de la vidéo, écrits en temps de la musique et nulle part ailleurs.
// L'image (film.js) et le son (tools/musique.mjs) lisent cette même grille.

export const BPM = 120;
export const TEMPS = 60 / BPM;          // 0,5 s
export const MESURE = 4 * TEMPS;        // 2 s
export const IPS = 60;
export const IMG = 1 / IPS;
export const DUREE = 20;
export const SCENE_W = 1920, SCENE_H = 1080;

// Instant d'un temps : mesure m (1 à 10), temps b (1 à 4), fraction de temps f
export const T = (m, b = 1, f = 0) => +(((m - 1) * 4 + (b - 1) + f) * TEMPS).toFixed(6);
// L'action tombe sur le temps ; la coupe la précède de deux images
export const AVANCE_COUPE = 2;
export const coupe = (tAction) => (tAction <= 0 ? 0 : tAction - AVANCE_COUPE * IMG);

// Les plans, dans l'ordre. action = instant où l'action du plan tombe.
export const PLANS = [
  // 1. Le problème (mesures 1 et 2) : gris, lumière froide, musique étouffée
  { id: 'P01', moment: 1, action: T(1, 1), quoi: 'Michaël, alternant : son badge, son clavier, un tuto qui défile' },
  { id: 'P02', moment: 1, action: T(1, 2), quoi: 'Le tuto : un accord de huit notes tombe d\'un coup' },
  { id: 'P03', moment: 1, action: T(1, 3), quoi: 'Ses notes « Do Mi Sol ? » raturées' },
  { id: 'P04', moment: 1, action: T(1, 4), quoi: 'Un tuto « Accords avancés » jaillit du téléphone' },
  { id: 'P05', moment: 1, action: T(2, 1), quoi: 'Un tuto « Niveau expert » jaillit, vu de haut' },
  { id: 'P06', moment: 1, action: T(2, 2), quoi: 'Le téléphone vibre et glisse' },
  { id: 'P07', moment: 1, action: T(2, 2, 0.5), quoi: 'Rafale de tutos sans texte' },
  { id: 'P08', moment: 1, action: T(2, 3), quoi: 'Un tuto s\'abat sur le carnet « Chants de louange »' },
  { id: 'P09', moment: 1, action: T(2, 3, 1 / 3), quoi: 'Les tutos pleuvent sur le clavier' },
  { id: 'P10', moment: 1, action: T(2, 3, 2 / 3), quoi: 'L\'écran passe en « ×2 »' },
  { id: 'P11', moment: 1, action: T(2, 4), quoi: 'Tout se fige : le téléphone seul, les tutos arrêtés en vol' },
  // 2. Le basculement (mesure 3) : la musique tombe, la lumière se réchauffe, la couleur naît
  { id: 'P12', moment: 2, action: T(3, 1), quoi: 'Aspiration : les tutos s\'aplatissent et se rangent' },
  { id: 'P13', moment: 2, action: T(3, 2), quoi: 'L\'interface de l\'École se dresse' },
  { id: 'P14', moment: 2, action: T(3, 3), quoi: 'La leçon « Do & Octaves » s\'allume : première couleur' },
  { id: 'P15', moment: 2, action: T(3, 4), quoi: 'Le résultat, tenu' },
  // 3. Les trois gestes (mesures 4, 5, 6)
  { id: 'P16', moment: 3, action: T(4, 1), quoi: 'Le bouton lecture part' },
  { id: 'P17', moment: 3, action: T(4, 2), quoi: 'Il frappe la vignette de la leçon' },
  { id: 'P18', moment: 3, action: T(4, 3), quoi: 'La vidéo défile, la barre se remplit' },
  { id: 'P19', moment: 3, action: T(4, 4), quoi: '« Vue » inscrit, tenu' },
  { id: 'P20', moment: 3, action: T(5, 1), quoi: 'L\'annexe manuscrite s\'envole' },
  { id: 'P21', moment: 3, action: T(5, 2), quoi: 'Elle claque sur la leçon' },
  { id: 'P22', moment: 3, action: T(5, 3), quoi: 'Elle se range dans la leçon' },
  { id: 'P23', moment: 3, action: T(5, 4), quoi: '« Annexe » inscrit, tenu' },
  { id: 'P24', moment: 3, action: T(6, 1), quoi: 'L\'exercice : Do, Mi, Sol joués sur le clavier' },
  { id: 'P25', moment: 3, action: T(6, 2), quoi: 'La coche revient et frappe la leçon' },
  { id: 'P26', moment: 3, action: T(6, 3), quoi: 'Le compteur passe à 1/5' },
  { id: 'P27', moment: 3, action: T(6, 4), quoi: '« Exercice » inscrit : la leçon est complète, tenu' },
  // 4. Le résultat à l'échelle (mesures 7 et 8) : un plan par demi-temps
  { id: 'P28', moment: 4, action: T(7, 1), quoi: 'Le fil se copie : la cascade part' },
  { id: 'P29', moment: 4, action: T(7, 1, 0.5), quoi: '« Nom des touches blanches » s\'allume, 2/5' },
  { id: 'P30', moment: 4, action: T(7, 2), quoi: '« Ton & Demi-ton » s\'allume, 3/5' },
  { id: 'P31', moment: 4, action: T(7, 2, 0.5), quoi: '« Dièse & Bémol » s\'allume, 4/5' },
  { id: 'P32', moment: 4, action: T(7, 3), quoi: 'Le compteur se bloque sur 5/5' },
  { id: 'P33', moment: 4, action: T(7, 3, 0.5), quoi: 'Le module 3 se dresse et s\'allume en cascade' },
  { id: 'P34', moment: 4, action: T(7, 4), quoi: '« Les Mélodies de Prières » s\'allume' },
  { id: 'P35', moment: 4, action: T(7, 4, 0.5), quoi: 'Le téléphone, éteint, immobile' },
  { id: 'P36', moment: 4, action: T(8, 1), quoi: '« Exercices & Échauffements » s\'allume' },
  { id: 'P37', moment: 4, action: T(8, 1, 0.5), quoi: 'L\'accent gagne les en-têtes de section' },
  { id: 'P38', moment: 4, action: T(8, 2), quoi: 'Le clavier joue : les touches s\'allument en cascade' },
  { id: 'P39', moment: 4, action: T(8, 2, 0.5), quoi: 'Le carnet « Chants de louange » s\'ouvre' },
  { id: 'P40', moment: 4, action: T(8, 3), quoi: 'Les trois modules, tout en orange' },
  { id: 'P41', moment: 4, action: T(8, 3, 0.5), quoi: 'Travelling le long des leçons terminées' },
  { id: 'P42', moment: 4, action: T(8, 4), quoi: 'L\'ensemble, tenu (miniature)' },
  // 5. La signature (mesures 9 et 10)
  { id: 'P43', moment: 5, action: T(9, 1), quoi: 'Recul lent : la leçon se détache' },
  { id: 'P44', moment: 5, action: T(9, 3), quoi: 'Recul d\'un trait : la leçon vole au centre' },
  { id: 'P45', moment: 5, action: T(10, 1), quoi: 'Elle devient le logo ; le nom sort de derrière ; le bouton arrive' },
].map((p, i, a) => ({ ...p, debut: coupe(p.action), fin: i + 1 < a.length ? coupe(a[i + 1].action) : DUREE }));

export const MOMENTS = {
  1: 'Le problème', 2: 'Le basculement', 3: 'Les trois gestes', 4: 'Le résultat à l\'échelle', 5: 'La signature',
};

// Instants clés de l'histoire
export const K = {
  fige: T(2, 4),            // tout se fige, silence
  chute: T(3, 1),           // la musique tombe
  couleur: T(3, 3),         // première couleur : le fil s'allume
  chaud: [T(3, 1), T(3, 3)],// passage du froid au chaud
  playDepart: T(4, 1), playImpact: T(4, 2), vue: T(4, 4), barre: [T(4, 3), T(4, 3, 0.8)],
  annexeDepart: T(5, 1), annexeImpact: T(5, 2), annexeRangee: T(5, 3), annexe: T(5, 4),
  notes: [T(6, 1), T(6, 1, 0.25), T(6, 1, 0.5)], // Do, Mi, Sol
  cocheImpact: T(6, 2), compteur1: T(6, 3), exercice: T(6, 4),
  // le compteur de la section monte : une ligne par demi-temps, 5/5 sur un temps
  lignes: [T(6, 3), T(7, 1, 0.5), T(7, 2), T(7, 2, 0.5), T(7, 3)],
  module3: T(7, 3, 0.5), prieres: T(7, 4), module4: T(8, 1), entetes: T(8, 1, 0.5),
  clavierJoue: T(8, 2), carnetOuvert: T(8, 2, 0.5), tenu: T(8, 4),
  detache: T(9, 1), vol: T(9, 3), logo: T(10, 1),
  nom: [T(10, 1, 0.35), T(10, 2, 0.1)], bouton: [T(10, 2), T(10, 2, 0.75)], lisible: T(10, 3),
};

// Les coups de grosse caisse : la caméra marque chacun d'une poussée et d'une secousse.
// La musique joue exactement cette liste (vérifiée par tools/frappes.mjs).
export const FRAPPES = (() => {
  const f = [];
  for (let b = 0; b < 7; b++) f.push({ t: b * TEMPS, force: 0.25 });                    // montée étouffée, arrêt sur le 8e temps
  for (let b = 8; b < 24; b++) f.push({ t: b * TEMPS, force: b === 8 ? 1.4 : 0.8 });       // la chute, quatre mesures
  for (let h = 48; h < 64; h++) f.push({ t: h * TEMPS / 2, force: 0.7 });                  // le résultat : un coup par demi-temps
  f.push({ t: T(9, 1), force: 0.6 }, { t: T(9, 2), force: 0.45 });                         // sortie
  f.push({ t: T(10, 1), force: 1.5 });                                                     // le logo
  return f.map((x) => ({ t: +x.t.toFixed(6), force: x.force }));
})();
K.frappes = FRAPPES;

// Éclairs couleur d'accent : courts, jamais avant la naissance de la couleur
export const ECLAIRS = [
  { t: K.couleur, i: 0.03 }, { t: K.playImpact, i: 0.02 }, { t: K.cocheImpact, i: 0.02 },
  { t: T(7, 3), i: 0.02 }, { t: K.logo, i: 0.035 },
];

// Les bruitages, sur les mêmes instants que les actions
export const SONS = [
  { t: T(1, 1), son: 'vibreur' },
  { t: T(1, 2), son: 'notesRapides' },
  { t: T(1, 3), son: 'papier' },
  { t: T(1, 4), son: 'bulle' }, { t: T(2, 1), son: 'bulle' },
  { t: T(2, 2), son: 'vibreur' },
  { t: T(2, 2, 0.5), son: 'bulles' },
  { t: T(2, 3), son: 'tape' }, { t: T(2, 3, 1 / 3), son: 'tape' }, { t: T(2, 3, 2 / 3), son: 'bulle' },
  { t: T(2, 4) - 0.25, son: 'inspiration' },
  { t: T(3, 1), son: 'aspiration' },
  { t: T(3, 2), son: 'clic' },
  { t: T(3, 3), son: 'allumage' },
  { t: K.playDepart, son: 'depart' }, { t: K.playImpact, son: 'arrivee' },
  { t: K.barre[0], son: 'glisse' }, { t: K.vue, son: 'puce' },
  { t: K.annexeDepart, son: 'papierVol' }, { t: K.annexeImpact, son: 'papierClaque' },
  { t: K.annexeRangee, son: 'clic' }, { t: K.annexe, son: 'puce' },
  { t: K.notes[0], son: 'piano', note: 60 }, { t: K.notes[1], son: 'piano', note: 64 }, { t: K.notes[2], son: 'piano', note: 67 },
  { t: K.cocheImpact, son: 'tampon' }, { t: K.compteur1, son: 'coche' }, { t: K.exercice, son: 'puce' },
  ...K.lignes.slice(1).map((t, i) => ({ t, son: 'cascade', n: i })),
  { t: K.module3, son: 'cascadeLongue' }, { t: K.module4, son: 'cascadeLongue' },
  { t: K.clavierJoue, son: 'arpege' },
  { t: K.carnetOuvert, son: 'page' },
  { t: K.detache, son: 'clic' }, { t: K.vol, son: 'souffle' },
  { t: K.logo, son: 'accordFinal' },
  { t: K.bouton[0], son: 'bouton' },
];
