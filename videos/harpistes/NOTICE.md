# École des harpistes : vidéo de lancement (20 s)

Vidéo de 20 secondes, sans voix off ni sous-titres, fabriquée entièrement par code : 1920 × 1080, 60 images par
seconde. Elle suit **Michaël, alternant**, de ses tutos vidéo en désordre jusqu'à la leçon « Do & Octaves » de
l'École des harpistes. Cette leçon est le fil : elle reçoit trois gestes (Vue, Annexe, Exercice), se multiplie dans
les modules, puis devient le H du logo.

## Où sont les choses

| Chemin | Contenu |
|---|---|
| `livraison/` | Les fichiers livrés : vidéo maître, version web, miniature, musique, mix, storyboard |
| `index.html` | La page : une fonction pure du temps (`window.__seek(t)`, `window.__ready`, `SCENE_W`, `SCENE_H`, `DUREE`) |
| `scene/cues.js` | **Le conducteur** : tous les instants, en temps de musique (120 bpm), les 45 plans, les coups de grosse caisse, les éclairs, les bruitages |
| `scene/film.js` | Les plans (caméras, objets, chronologies : téléphone, tutos, aspiration, plaques, gestes, cascade, logo) |
| `scene/tex.js` | Tous les dessins (badge, tuto, notes, carnet, clavier, interface, leçon, annexe, coche, logo, nom, bouton) |
| `scene/donnees.js` | Les données de l'interface, relevées sur les captures fournies |
| `scene/moteur.js` | Le moteur 3D : lanceur de rayons WebGL2 (sol laqué, boîtes arrondies, verre, découpes en relief, flou de mouvement et de profondeur, halo) |
| `scene/lib.js`, `scene/base.js`, `scene/outils.js` | Courbes, charte, polices, registre et atlas des textures, poses, caméra, secousses |
| `fonts/` | Geist et Caveat (licence libre OFL, Google Fonts) |
| `matiere/` | Le logo fourni, le H redessiné en haute définition (`logo-H.png`), les captures de l'application |
| `tools/` | Rendu, musique, contrôles (voir plus bas) |

## Relancer

Depuis ce dossier :

```
node tools/verifier.mjs                                  # ce qui est présent, ce qui manque (n'installe rien)
node tools/musique.mjs                                   # musique.wav, bruitages.wav, mix.wav dans rendu/son
node tools/mesures-son.mjs                               # sonie, crête, niveau par mesure, silences, grosse caisse = conducteur
python3 tools/storyboard.py --w 960 --h 540 --passes 8   # une image par plan -> storyboard.png
node tools/essai.mjs --t 0.12,19 --w 1920 --h 1080       # quelques images d'essai -> essais/
node tools/rendu.mjs --w 1920 --h 1080 --passes 10 --dossier rendu/seg-1080
node tools/bin/encode_flux --dossier rendu/seg-1080 --sortie rendu/video-1080.mp4 --debit 16M
node tools/bin/mux --video rendu/video-1080.mp4 --son rendu/son/mix.wav --sortie livraison/x.mp4
node tools/encode/encode web livraison/x.mp4 livraison/x-web.mp4
node tools/bin/comparer livraison/x-web.mp4 livraison/x.mp4
node tools/encode/encode probe livraison/x.mp4
node tools/bin/coupes livraison/x.mp4 rendu/coupes.json && python3 tools/controle.py rendu/coupes.json
```

- **Le rendu reprend où il s'était arrêté.** Il est découpé en segments d'une seconde (`rendu/seg-1080/seg_XXXX.mkv`) ;
  un segment complet n'est pas refait. Pour refaire un passage, supprimer ses segments (segment n = images 60n à 60n+59).
- **Avec une carte graphique**, préfixer les commandes de rendu par `GPU=1` (sous Windows : `set GPU=1`) ; le rendu de
  cette version a été fait en logiciel (SwiftShader, 4 cœurs), environ 10 à 20 s par image en 1080p.
- Ne pas modifier la scène pendant qu'un rendu tourne. Lancer les rendus avec la sortie dans un journal.

## Changer un texte

| Texte | Fichier, endroit |
|---|---|
| Nom et métier du badge (« MICHAËL », « Alternant ») | `scene/tex.js`, dessin `badge` |
| Titre du tuto (« Apprendre le piano en 10 min ») | `scene/film.js`, constante `TITRE_TUTO` |
| Titres des tutos qui jaillissent | `scene/film.js`, tableau `CARTES` |
| Notes de Michaël, carnet, annexe | `scene/tex.js`, dessins `notes`, `carnet`, `carnetPage`, `annexe` |
| Modules, sections, leçons, durées | `scene/donnees.js` |
| Les trois traces (« Vue », « Annexe », « Exercice ») | `scene/tex.js`, constante `PUCES` |
| Nom de l'école, bouton (« Inscris-toi ») | `scene/tex.js`, dessins `nom` et `bouton` |

Un instant se change dans `scene/cues.js` seulement (image et son le lisent tous deux) ; relancer ensuite
`node tools/musique.mjs` puis `node tools/mesures-son.mjs` (la liste des coups de grosse caisse doit rester identique).

## Ce qui a été inventé ou corrigé

- **Michaël** est un personnage d'exemple : badge « ALTERNANCE / MICHAËL / Alternant » sans nom d'entreprise, avatar
  générique, sans nom de famille.
- **Le problème** : un lecteur vidéo générique en gris (aucune marque, rien de YouTube), titres inventés
  (« Apprendre le piano en 10 min », « Accords avancés », « Niveau expert : impro »), durées de vidéos inventées.
- **L'interface** est reconstruite d'après les captures (modules, sections, compteurs « n/total », leçons
  « Video • 6m »). Écarts : le vert et le bleu de l'application sont passés à l'orange de la charte ; les vignettes
  montrent un clavier sans personne (les vraies montrent le professeur) ; orthographe corrigée (« Connaître »,
  « Dièse », « Musicale », « Tierce ») ; la 3e leçon de « Gamme Majeur » n'apparaît pas (absente des captures).
- **Les trois traces** « Vue », « Annexe », « Exercice » sont des pastilles ajoutées à la leçon pour montrer les trois
  gestes (vidéo, annexe manuscrite, exercice) ; elles n'existent pas dans l'application.
- **L'annexe manuscrite** (Do, octave, « Pouce = 1 ») et le carnet « Chants de louange » (grille Do–Fa–Sol) sont dessinés
  pour l'exemple, sans paroles ni titre de chant existant.
- **« En 3 mois »** n'apparaît pas : c'est une promesse de résultat, non affichée sans confirmation.
- **Le logo** fourni était une image (pas un tracé) : le H a été agrandi proprement en haute définition et mis en
  orange (accent) ; l'anneau « ECOLE DES HARPISTES. » est recomposé en Geist.
- **La musique** est une composition originale (sol mineur, 120 bpm) synthétisée par `tools/musique.mjs`.
