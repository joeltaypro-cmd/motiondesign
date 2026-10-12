// Données de l'interface, relevées sur les captures de l'application fournies (dossier matiere/).
// Corrections d'orthographe signalées dans la notice : « Connaître », « Dièse », « Musicale », « Tierce ».

export const MODULES = {
  A: {
    titre: '2# Connaître son Instrument',
    sections: [
      { titre: 'Les fondamentaux', total: 5, lecons: [
        ['Do & Octaves', '6m'], ['Nom des touches blanches', '6m'], ['Ton & Demi-ton', '7m'],
        ['Dièse & Bémol', '8m'], ['Placement des doigts', '2m'],
      ] },
      // la troisième leçon de cette section n'est pas visible sur les captures : la plaque s'arrête avant
      { titre: 'Gamme Majeur', total: 3, lecons: [['La Gamme Majeur', '12m']] },
    ],
  },
  B: {
    titre: '3# Développer son Jeu',
    sections: [
      { titre: 'Développer son Jeu', total: 2, lecons: [['Les Arpèges', '3m'], ['Les Accords Renversés', '8m']] },
      { titre: 'Les Mélodies', total: 2, lecons: [['Les Mélodies', '11m'], ['Les Mélodies de Prières', '3m']] },
      { titre: 'Développer son Oreille', total: 1, lecons: [['L\'Oreille Musicale & l\'Oreille Absolue', '7m']] },
      { titre: 'Enrichir ses mélodies', total: 1, lecons: [['Jouer en Tierce & en Quinte', '5m']] },
    ],
  },
  C: {
    titre: 'Exercices & Échauffements',
    sections: [
      { titre: 'Exercices & Échauffements', total: 2, lecons: [['Délier ses doigts', '1m'], ['Indépendance des mains', '2m']] },
    ],
  },
};

// Géométrie de la plaque, dans le repère des captures (920 de large)
export const PLAQUE = {
  L: 920, H: 2100,
  enTete: 150,          // barre du haut (retour, icône, titre du module, cloche)
  section: 102,         // bandeau de section
  ligne: 229,           // une leçon
  margeHaut: 30,
};

// Position verticale (repère des captures) de chaque bandeau et de chaque leçon
export function disposition(mod) {
  const out = { sections: [], lignes: [] };
  let y = PLAQUE.margeHaut + PLAQUE.enTete + 6;
  mod.sections.forEach((s, si) => {
    out.sections.push({ si, y, h: PLAQUE.section });
    y += PLAQUE.section + 22;
    s.lecons.forEach((l, li) => { out.lignes.push({ si, li, y, h: PLAQUE.ligne }); y += PLAQUE.ligne; });
    y += 4;
  });
  out.fin = y;
  return out;
}

// La leçon suivie (le fil)
export const FIL = { module: 'A', section: 0, lecon: 0 };
