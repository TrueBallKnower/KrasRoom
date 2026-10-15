# Roomora

Application d’aménagement intérieur en français, entièrement exécutée dans le navigateur. React, TypeScript, Vite, Three.js / React Three Fiber, Zustand et IndexedDB. Aucun compte, serveur applicatif, abonnement ou clé API n’est nécessaire.

## Démarrer sur Mac, Windows ou Linux

Installez Node.js 24 LTS, puis depuis le dépôt :

```sh
npm ci
npm run dev
```

Ouvrez l’adresse indiquée par Vite. Pour vérifier la production :

```sh
npm test
npm run build
npm run preview
```

Un appartement de 48 m² est disponible au premier lancement. Le menu du nom de projet permet de créer, renommer, ouvrir ou supprimer des appartements et restaurer une sauvegarde.

## Recréer automatiquement votre appartement

1. **Déposez votre image/PDF dans l’espace central**, ou cliquez sur **Mon plan → 3D** dans la barre du haut.
2. Indiquez la **surface intérieure totale en m²**, hors balcon/terrasse.
3. Cliquez sur **Créer mon appartement en 3D**. Roomora analyse localement l’image dans un Web Worker, extrait les murs, recherche les contours fermés des pièces, propose les portes/fenêtres, estime l’échelle et ouvre la vue 3D. Aucun segment à tracer pour commencer. Un nouveau projet est créé ; l’ancien est sauvegardé et conservé.
4. La bannière indique les ouvertures à vérifier. **Vérifier les ouvertures** ouvre leurs propriétés : confirmez une proposition, changez son type, ses dimensions ou supprimez-la si nécessaire.

Formats PDF (première page), PNG, JPG et WebP ; limite 30 Mo. Le traitement utilise une copie réduite à 960 pixels sur le plus grand côté, sans envoyer le plan à un serveur et sans clé/API payante.

### Ce qui est reconnu et ce qui reste estimé

Le détecteur recherche les bandes de murs sombres, horizontales et verticales. Il écarte les traits fins de cotation et les petits caractères, raccorde les segments proches, puis retrouve les régions intérieures fermées. Les lignes fines à l’intérieur d’une rupture de mur suggèrent une fenêtre ; une rupture sans vitrage suggère une porte. Ces catégories sont des **propositions heuristiques**, pas une classification garantie : certaines ruptures de dessin peuvent être interprétées comme des ouvertures.

La surface saisie est répartie sur les contours des pièces détectées, avec une échelle uniforme `sqrt(surface / surface_en_pixels)`. Cela fournit des dimensions **estimées**, pas une lecture des cotes exactes. Une pièce oubliée, un balcon inclus ou une mauvaise segmentation fausse l’échelle. Les pièces sont nommées « Pièce 1 », etc. ; leurs noms ne sont pas lus automatiquement. Hauteur sous plafond et hauteur/allège des ouvertures utilisent des valeurs par défaut modifiables.

Le détecteur est prévu pour des plans nets avec murs épais et orthogonaux. Les murs obliques, photos prises en perspective, traits très fins, hachures, dessins très chargés ou symboles inhabituels peuvent être mal reconnus. Les réglages avancés adaptent le contraste et l’épaisseur minimale. Si aucun contour exploitable n’est trouvé, une erreur est affichée et **aucun appartement fictif n’est généré**. L’image réelle de votre appartement doit être testée avant de considérer la reconstruction fiable.

### Corrections et calibrage facultatif

Les outils de **Structure** restent disponibles pour corriger un mur, ajouter une ouverture manquante ou ajuster une pièce. **Calibrer le plan** permet de choisir deux points avec une distance connue : sur un projet automatique, le bâti, les pièces et les positions sont recalibrés ensemble ; les dimensions réelles des meubles restent inchangées.

Le mode manuel reste accessible sous **Je préfère utiliser le tracé manuel → Utiliser comme fond de plan**. Dans ce mode, calibrez avant de tracer ; les murs manuels déjà créés ne sont pas redimensionnés par un simple changement de l’échelle du fond.

## Aménager et importer vos meubles

- Cliquez sur les meubles intégrés ou glissez-les dans le plan / la scène 3D. Ils sont générés localement à partir de formes simples, sans dépendance à un catalogue externe.
- Glissez un meuble pour le déplacer. Le panneau droit règle ses dimensions, coordonnées, rotation et couleur. Dupliquer, supprimer et placer contre le mur le plus proche sont disponibles.
- Les alertes signalent les intersections entre empreintes rectangulaires orientées, et les murs. Elles sont indicatives : les ouvertures et la forme détaillée d’un modèle ne sont pas prises en compte. La distance affichée est celle du **centre** au segment du mur, pas la distance libre entre leurs surfaces.
- **Ajouter mon propre meuble → Importer un fichier 3D ou un ZIP** accepte GLB / glTF 2.0, jusqu’à 50 Mo. Les ZIP contenant un modèle glTF et ses textures sont intégrés automatiquement, sans extraction manuelle. Le bouton « Mon ZIP est déjà décompressé » accepte aussi le dossier complet. Les données sont enregistrées localement puis incluses dans les exports. Les décodeurs Draco et Meshopt sont fournis avec l’application. Les dimensions natives sont interprétées en mètres et restent modifiables.
- L’import par URL accepte une adresse HTTPS directe `.glb` / `.gltf`. Le serveur doit autoriser CORS. Une page marchande n’est pas un modèle 3D ; en cas de refus CORS, téléchargez légalement le fichier et importez-le localement.
- **Créer un meuble de référence** conserve photo, nom, prix et lien produit et génère une forme simplifiée aux dimensions indiquées. La photo n’est pas convertie en modèle fidèle.
- **Mes meubles** conserve les modèles et références entre projets ; recherche, renommage et suppression sont disponibles. Les meubles existants peuvent aussi être ajoutés à cette collection depuis leurs propriétés.

Respectez les licences des modèles téléchargés. Les meubles intégrés sont créés par le code de Roomora ; ils ne nécessitent pas de modèles payants.

## Sauvegarder et transférer

Les projets et fichiers binaires sont enregistrés automatiquement dans IndexedDB après une courte pause d’édition. Attendez **Enregistré** avant de fermer l’onglet. ⌘/Ctrl S déclenche aussi une sauvegarde.

**Exporter** produit un fichier `.roomora.zip` contenant `project.json`, le plan rasterisé, les modèles 3D et les photos réellement utilisés. **Menu projet → Restaurer une sauvegarde ZIP** crée une copie avec de nouveaux identifiants de ressources, pour ne pas écraser d’autres projets. Limites d’import : 200 Mo compressés / 300 Mo décompressés.

Les données appartiennent à ce navigateur, cet appareil et cette origine web. Elles ne sont pas synchronisées par GitHub Pages. Les domaines et ports différents ont des stockages séparés. Effacer les données du navigateur peut supprimer les projets. Exportez régulièrement une copie ; pour changer d’ordinateur, importez cette archive. La collection complète « Mes meubles » n’est pas incluse : seuls les meubles utilisés dans le projet sont exportés.

## Commandes et modes

- ⌘/Ctrl Z : annuler ; ⇧⌘/Ctrl Z : rétablir.
- ⌘/Ctrl D : dupliquer ; R : rotation de 15° ; Suppr : supprimer.
- Échap : terminer le tracé / revenir à la sélection.
- Plan : boutons +/− pour zoomer ; déplacement avec le bouton central de la souris.
- 3D : glisser pour tourner, molette pour zoomer ; glisser un meuble pour le déplacer.
- Visite : cliquer dans la scène, ZQSD ou WASD et flèches pour avancer, Échap pour libérer la souris. Ce mode est prévu pour souris/clavier, sans collision physique.
- **Rendu → Réaliste** active un éclairage ambiant calculé localement, des arêtes adoucies et des matières textiles. Aucun HDRI externe ni clé API.
- Cliquez sur une pièce en 2D ou sur son sol en 3D pour choisir chêne, noyer, parquet clair, carrelage, béton ou couleur unie. Les textures sont procédurales, les dimensions restent inchangées et les choix sont inclus dans les sauvegardes.
- Mode clair/sombre, plein écran, meubles masqués et captures PNG sont disponibles.

## Tests

```sh
npm test                       # géométrie, commandes, IndexedDB, archive avec ressources
npx playwright install chromium
npm run test:e2e               # serveur Vite lancé automatiquement
npm run build                 # TypeScript et bundle de production
```

Si Chromium est déjà installé : `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`.

Les tests couvrent la détection et les surfaces sur des plans synthétiques, les pièces concaves, le rejet des images non reconnues, le calibrage, les commandes, la persistance et les archives. Les essais navigateur couvrent aussi le parcours image + m² et PDF + m² vers la 3D, la vérification des ouvertures, l’import glTF/GLB, la restauration ZIP et l’interface mobile. Chromium est vérifié dans l’environnement de développement ; Safari réel n’a pas été testé. La vue visite utilise Pointer Lock, dont la disponibilité varie selon le navigateur et l’appareil.

## GitHub Pages et déploiement automatique

Le dépôt connecté est [TrueBallKnower/Roomora](https://github.com/TrueBallKnower/Roomora). Le workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) est prêt pour les pushes sur `main` et les lancements manuels. Il installe les dépendances avec `npm ci`, lance les tests unitaires et navigateur, compile et publie `dist` avec les actions officielles GitHub Pages. Les permissions de publication sont limitées au job de déploiement.

Si les autorisations API ne permettent pas l’activation automatique :

1. Dans le dépôt, ouvrez **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Pour l’hébergement gratuit standard, utilisez un dépôt public. Le caractère public du dépôt n’est pas modifié automatiquement.
3. Ouvrez **Actions → Build, test and deploy Roomora → Run workflow → main** si aucun push récent n’a déclenché le workflow.
4. Attendez la réussite du job **deploy**. L’URL réellement publiée figure dans son environnement `github-pages`.

L’adresse attendue est `https://trueballknower.github.io/Roomora/` ; sa présence ici ne constitue pas une confirmation de déploiement. `base: './'` garantit les chemins relatifs du JavaScript, du worker PDF et des ressources, y compris sous le chemin du dépôt. Aucun secret n’est nécessaire dans Actions.

## Architecture et limites actuelles

- `src/model.ts` : données, géométrie, dimensions, collisions et appartement initial.
- `src/store.ts` : état d’édition et historique (80 commandes).
- `src/Plan.tsx` : fond de plan, calibrage, outils 2D et déplacement.
- `src/Scene.tsx` : géométrie 3D, éclairage, caméras et interactions.
- `src/imports.ts` : validation des modèles, URL et rasterisation PDF.
- `src/AutoPlanImport.tsx`, `src/detection/` : import automatique, analyse locale en worker, segmentation et reconstruction.
- `src/db.ts` : IndexedDB et sauvegardes portables.
- `src/App.tsx`, `src/AssetImage.tsx`, `src/style.css` : interface et propriétés.

La reconnaissance automatique est limitée aux plans orthogonaux suffisamment contrastés ; elle ne lit pas les cotes ou les noms des pièces et ne garantit pas les types d’ouvertures. OBJ/MTL, textures KTX2, favoris, textures de matériaux personnalisées, estimation de circulation et bibliothèque de modèles externes sous licence ne sont pas implémentés. Les plafonds sont simplifiés. Le mode réaliste améliore les matières, les arêtes et l’éclairage local ; les meubles intégrés restent des formes simplifiées. Un modèle importé détaillé conserve ses matériaux PBR et ses textures, sans que Roomora puisse inventer les détails manquants. Les gros modèles peuvent ralentir l’appareil et les archives importantes nécessitent de la mémoire. L’application fonctionne comme site statique sans backend ; elle n’installe pas encore de service worker pour une utilisation hors réseau après fermeture du serveur.
