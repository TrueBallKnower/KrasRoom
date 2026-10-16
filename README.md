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
- Un clic sélectionne ; un glissement gauche d’au moins 5 pixels déplace le meuble. Les clics simples ne créent pas de commande Annuler. L’aimantation rapproche les bords/centres des autres meubles et les murs, avec des guides visuels.
- **Conserver les proportions** redimensionne les trois axes ensemble. Le panneau accepte m, cm, mm et pouces ; le correcteur d’unité d’import redimensionne les modèles aux unités natives incorrectes.
- **Atelier 3D · retirer le décor** ouvre un aperçu interactif. Cliquez sur un élément pour le repérer, décochez les sols, murs ou accessoires à retirer et appliquez. « Ouvrir le groupe » permet de descendre dans les sous-groupes. Le fichier original reste intact. L’atelier sépare les éléments conservés (2 à 64 sous-groupes par niveau), conserve leur position et élévation, et partage les ressources. La fusion en un seul maillage ne permet pas de retrouver automatiquement les meubles. Annuler reconstitue le groupe ; l’export inclut le fichier commun une seule fois.
- Glissez un meuble pour le déplacer. Le panneau droit règle ses dimensions, coordonnées, rotation et couleur. Dupliquer, supprimer et placer contre le mur le plus proche sont disponibles.
- Les alertes utilisent des rectangles orientés pour les meubles intégrés et une grille d’occupation simplifiée pour les imports. Les espaces vides, les tapis et les différences d’élévation réduisent les faux chevauchements. Ces contrôles restent indicatifs et ne tiennent pas compte des ouvertures. La distance affichée estime le dégagement entre le **bord** de l’empreinte du meuble et la face du mur.
- **Ajouter mon propre meuble → Importer un fichier 3D ou un ZIP** accepte GLB / glTF 2.0, jusqu’à 50 Mo. Les ZIP contenant un modèle glTF et ses textures sont intégrés automatiquement, sans extraction manuelle. Le bouton « Mon ZIP est déjà décompressé » accepte aussi le dossier complet. Les données sont enregistrées localement puis incluses dans les exports. Les décodeurs Draco et Meshopt sont fournis avec l’application. Les dimensions natives sont interprétées en mètres et restent modifiables.
- L’import par URL accepte une adresse HTTPS directe `.glb` / `.gltf`. Le serveur doit autoriser CORS. Une page marchande n’est pas un modèle 3D ; en cas de refus CORS, téléchargez légalement le fichier et importez-le localement.
- **Créer un meuble de référence** conserve photo, nom, prix et lien produit et génère une forme simplifiée aux dimensions indiquées. La photo n’est pas convertie en modèle fidèle.
- **Mes meubles** conserve les modèles et références entre projets ; recherche, renommage et suppression sont disponibles. Les meubles existants peuvent aussi être ajoutés à cette collection depuis leurs propriétés.

Les ZIP/dossiers sont préparés dans un worker ; l’import affiche les étapes réelles et le téléchargement par URL indique les octets reçus. Les instances d’un même fichier partagent leur décodage et leurs textures. La vue 3D extérieure ne recalcule des images que pendant une interaction ou une modification ; la visite garde un rendu continu.

Le menu des projets affiche le poids des ressources, l’usage et le quota annoncés par le navigateur. La demande de stockage persistant dépend de son accord. Les limites restent de 50 Mo par modèle et 200/300 Mo par archive de projet ; les quotas ne garantissent pas la capacité de la mémoire graphique.

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
- 3D : gauche sur le fond pour tourner ; **clic droit ou Espace + glisser** pour déplacer la caméra, y compris au-dessus d’un meuble ; molette pour zoomer vers le curseur. Le mode **Déplacer la vue** permet aussi de naviguer avec le bouton gauche.
- **F** centre la sélection ; **Tout voir** cadre l’appartement. Les boutons Dessus / Face / Côté / vue isométrique changent l’orientation. La caméra est mémorisée par projet dans ce navigateur, y compris lors du passage 2D → 3D et après rechargement.
- Visite : cliquer dans la scène, ZQSD ou WASD et flèches pour avancer, Échap pour libérer la souris. Ce mode est prévu pour souris/clavier, sans collision physique.
- **Rendu → Réaliste** active les reflets d’environnement calculés localement, les arêtes adoucies, les textiles et des cartes de relief et rugosité séparées pour les revêtements. Les ombres de contact suivent le cadrage de l’appartement. Choisissez **Jour naturel**, **Fin de journée** ou **Studio doux**, puis ajustez l’exposition. Ces préférences de rendu restent dans ce navigateur. Aucun HDRI externe ni clé API.
- Sélectionnez un mur en 2D ou 3D : **12 finitions murales** (peinture mate/satinée, chaux, béton, briques, lambris, faïence, marbre, lin), teinte personnalisée, échelle et orientation du motif. « Appliquer à tous les murs » copie ces réglages en une seule commande annulable.
- Sélectionnez une pièce en 2D ou son sol en 3D : **22 revêtements** (parquets dont chevrons, grès, terre cuite, ardoise, travertin, marbres, terrazzo, bétons, moquettes), teinte, échelle et orientation. La couleur du plafond est aussi personnalisable.
- La **palette de 24 couleurs**, la **roue chromatique**, la luminosité et le code **HEX** servent à choisir la teinte. Sur un revêtement texturé, le blanc conserve sa couleur naturelle ; une autre couleur le teinte. Les textures sont générées localement et partagées entre surfaces identiques pour limiter la mémoire graphique. Les finitions et leurs réglages sont inclus dans IndexedDB et les sauvegardes ZIP. Le relief est visuel (bump mapping), sans changement des dimensions ou de la géométrie.
- **E** masque ou réaffiche les alertes de chevauchement (rouge en 2D/3D et avertissement du panneau). Le bouton triangle dans la barre de vue fait la même chose. Les erreurs d’importation et de sauvegarde restent visibles.
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
- `src/Scene.tsx`, `src/NavigationCamera.tsx`, `src/CameraToolbar.tsx`, `src/navigation.ts` : géométrie, éclairage, navigation et caméra persistante.
- `src/placement.ts`, `src/DimensionsEditor.tsx` : alignement, dégagements et échelle.
- `src/modelAssets.ts`, `src/SplitModel.tsx` : cache partagé, empreintes et dissociation.
- `src/bundle.worker.ts`, `src/StorageStatus.tsx` : préparation hors du fil principal et stockage.
- `src/imports.ts` : validation des modèles, URL et rasterisation PDF.
- `src/AutoPlanImport.tsx`, `src/detection/` : import automatique, analyse locale en worker, segmentation et reconstruction.
- `src/db.ts` : IndexedDB et sauvegardes portables.
- `src/App.tsx`, `src/AssetImage.tsx`, `src/style.css` : interface et propriétés.

La reconnaissance automatique est limitée aux plans orthogonaux suffisamment contrastés ; elle ne lit pas les cotes ou les noms des pièces et ne garantit pas les types d’ouvertures. OBJ/MTL, textures KTX2, favoris, textures de matériaux personnalisées, estimation de circulation et bibliothèque de modèles externes sous licence ne sont pas implémentés. Les plafonds sont simplifiés. Le mode réaliste améliore les matières, les arêtes et l’éclairage local ; les meubles intégrés restent des formes simplifiées. Un modèle importé détaillé conserve ses matériaux PBR et ses textures, sans que Roomora puisse inventer les détails manquants. Les gros modèles peuvent ralentir l’appareil et les archives importantes nécessitent de la mémoire. L’application fonctionne comme site statique sans backend ; elle n’installe pas encore de service worker pour une utilisation hors réseau après fermeture du serveur.

### Placer un écran ou une étagère au mur
Sélectionnez l’objet en vue 3D, puis activez **Fixer au mur · M** et glissez-le vers la face visible d’un mur. Il suit la souris horizontalement et verticalement, se tourne parallèlement au mur et reste devant sa surface. L’objet doit être moins large et moins haut que le mur. Les ouvertures ne sont pas exclues automatiquement.
**Hauteur · H** conserve la position au sol et permet de monter ou descendre à la souris ; les flèches haut/bas ajustent de 5 cm (Maj : 1 cm). Les dimensions restent en mètres dans les propriétés. Réappuyez sur M ou H pour revenir au mode au sol, ou cliquez sur **Au sol** (cela conserve l’élévation actuelle). Échap annule un glissement ; Annuler restaure la position précédente. Pour un écran, utilisez un modèle sans pied et orientez si nécessaire son avant avec Rotation.

### Visite sans interface
En mode **Visite**, appuyez sur **L** (ou cliquez sur « Visite sans interface · L ») pour masquer les panneaux, barres d’outils et réglages. La vue occupe tout l’écran ; si le navigateur refuse le plein écran natif, elle occupe toute la fenêtre. Réappuyez sur **L** pour retrouver l’interface, sans changer la caméra ni les réglages. Le raccourci fonctionne pendant la capture de la souris et ne s’active pas pendant la saisie dans un champ. Échap libère la souris ; le bouton « Afficher l’interface · L » devient alors accessible. Si Échap quitte aussi le plein écran natif, l’interface revient.
