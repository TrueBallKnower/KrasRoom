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

## Recréer votre appartement

1. Ouvrez **Structure → Importer un plan PDF / image**. Formats PDF (première page), PNG, JPG et WebP ; limite 30 Mo.
2. Cliquez sur deux points dont vous connaissez la distance, puis saisissez cette distance **en mètres**. Une largeur de 80 cm correspond à `0,80` m dans la boîte de calibration, ou `0.8` dans un champ numérique.
3. Utilisez **Tracer des murs** : cliquez successivement sur les extrémités. Échap termine le tracé. Le magnétisme utilise une grille de 5 cm, les extrémités proches et l’alignement horizontal/vertical.
4. Sélectionnez un mur pour régler sa longueur, son épaisseur, sa hauteur et sa couleur. Ajouter une porte ou une fenêtre se fait en cliquant sur un mur avec l’outil correspondant ; les propriétés règlent largeur, hauteur, décalage et allège.
5. Avec **Définir une pièce**, cliquez sur les sommets de son contour, puis sur le premier point pour fermer. Cela crée le sol et calcule la surface. Les pièces sont définies explicitement, pas détectées automatiquement.
6. Passez en **Vue 3D** pour inspecter le résultat. Les murs transparents permettent de voir à l’intérieur ; plafond, qualité graphique et capture PNG sont disponibles.

Les unités internes sont les mètres. Le plan importé reste un arrière-plan ; aucune reconnaissance approximative n’est présentée comme une mesure exacte. Le calibrage doit précéder le tracé : changer l’échelle du fond ne redimensionne pas les murs déjà créés.

## Aménager et importer vos meubles

- Cliquez sur les meubles intégrés ou glissez-les dans le plan / la scène 3D. Ils sont générés localement à partir de formes simples, sans dépendance à un catalogue externe.
- Glissez un meuble pour le déplacer. Le panneau droit règle ses dimensions, coordonnées, rotation et couleur. Dupliquer, supprimer et placer contre le mur le plus proche sont disponibles.
- Les alertes signalent les intersections entre empreintes rectangulaires orientées, et les murs. Elles sont indicatives : les ouvertures et la forme détaillée d’un modèle ne sont pas prises en compte. La distance affichée est celle du **centre** au segment du mur, pas la distance libre entre leurs surfaces.
- **Ajouter mon propre meuble → Importer un fichier 3D** accepte GLB / glTF 2.0, jusqu’à 50 Mo. Les ressources doivent être intégrées (GLB ou URI `data:`). Les dimensions natives sont interprétées en mètres et restent modifiables.
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
- Mode clair/sombre, plein écran, meubles masqués et captures PNG sont disponibles.

## Tests

```sh
npm test                       # géométrie, commandes, IndexedDB, archive avec ressources
npx playwright install chromium
npm run test:e2e               # serveur Vite lancé automatiquement
npm run build                 # TypeScript et bundle de production
```

Si Chromium est déjà installé : `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`.

Les tests navigateur couvrent les commandes, le rechargement et l’export, le tracé précis, l’import glTF et GLB, un PDF rasterisé et calibré, la restauration ZIP et une vérification mobile. Chromium est vérifié dans l’environnement de développement ; Safari réel n’a pas été testé. La vue visite utilise Pointer Lock, dont la disponibilité varie selon le navigateur et l’appareil.

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
- `src/db.ts` : IndexedDB et sauvegardes portables.
- `src/App.tsx`, `src/AssetImage.tsx`, `src/style.css` : interface et propriétés.

La reconnaissance automatique de plans, OBJ/MTL, Draco/KTX2, favoris, textures de matériaux personnalisées, estimation de circulation et bibliothèque de modèles externes sous licence ne sont pas implémentés. Les pièces ne sont pas déduites automatiquement des murs. Les plafonds sont simplifiés. Le rendu des meubles intégrés est stylisé. Les gros modèles peuvent ralentir l’appareil et les archives importantes nécessitent de la mémoire. L’application fonctionne comme site statique sans backend ; elle n’installe pas encore de service worker pour une utilisation hors réseau après fermeture du serveur.
