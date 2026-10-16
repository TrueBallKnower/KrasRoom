# Activer les comptes KrasRoom et la sauvegarde entre ordinateurs

L'application locale fonctionne sans compte. Les comptes en ligne nécessitent un projet Supabase : GitHub Pages ne peut pas stocker les appartements des utilisateurs.

## Activation unique par le propriétaire du site

1. Ouvrir <https://supabase.com/dashboard>, se connecter et choisir **New project**, avec le plan **Free**. Choisir une région proche des utilisateurs et conserver le mot de passe de la base dans un gestionnaire de mots de passe (il ne sera pas utilisé dans KrasRoom).
2. Dans **SQL Editor → New query**, coller le contenu de [setup.sql](./setup.sql), puis cliquer **Run**. Cela crée la table privée et le stockage privé, avec des règles empêchant un utilisateur de consulter les appartements d'un autre.
3. Dans **Authentication → URL Configuration**, mettre **Site URL** à `https://trueballknower.github.io/KrasRoom/`. Ajouter cette même URL aux **Redirect URLs** (conserver aussi `https://trueballknower.github.io/Roomora/` pour les anciens liens), ainsi que `http://localhost:5173/` pour les essais locaux.
4. Dans **Authentication → Providers → Email**, garder les connexions par e-mail et la confirmation d'adresse activées. L'envoi d'e-mails fourni par défaut a un quota limité : consulter les limites affichées dans le tableau de bord avant d'ouvrir les inscriptions à beaucoup d'utilisateurs. Aucune carte bancaire n'est nécessaire pour l'offre gratuite.
5. Copier l'URL publique du projet et sa clé **Publishable** (`sb_publishable_...`) ou **anon** depuis **Project Settings → API / API Keys** (ou le bouton **Connect**).
6. Dans <https://github.com/TrueBallKnower/KrasRoom/settings/variables/actions>, choisir **New repository variable** et créer :
   - `VITE_SUPABASE_URL` : l'URL publique du projet.
   - `VITE_SUPABASE_ANON_KEY` : sa clé publique Publishable ou anon.
7. Dans <https://github.com/TrueBallKnower/KrasRoom/actions>, ouvrir **Build, test and deploy KrasRoom**, puis **Run workflow → main → Run workflow**. Attendre la réussite du déploiement, puis recharger KrasRoom.

Alternative à l’étape 6 : le propriétaire peut demander à Codex de renseigner ces deux valeurs publiques dans `src/cloudDeployment.json` et de pousser le fichier. Cela déclenche automatiquement le déploiement, sans intervention dans les réglages GitHub. Ne pas utiliser simultanément d’anciennes variables Actions, car elles ont priorité sur ce fichier.

Ces deux valeurs sont publiques et seront intégrées au JavaScript. **Ne jamais utiliser de clé Secret, service_role, de mot de passe de base ou de jeton d'administration.** L'application refuse les formats usuels de clés privées. La confidentialité dépend des politiques SQL, pas du caractère secret de la clé publique.

Pour le développement local, copier `.env.example` vers `.env.local`, renseigner ces deux valeurs publiques puis relancer Vite.

## Utilisation

- **Mon compte → Créer mon compte gratuit**, puis confirmer l'adresse avec l'e-mail reçu.
- Se connecter et cliquer **Sauvegarder cet appartement en ligne** une première fois. Les modifications suivantes sont envoyées après quatre secondes sans modification, lorsque la connexion est disponible.
- Sur l'autre ordinateur : ouvrir le même site, se connecter, puis **Mon compte → Mes appartements en ligne → Ouvrir**.
- Les plans, photos et modèles 3D sont inclus. Les fichiers sont découpés en fragments privés de 20 Mio, vérifiés par SHA-256 et réutilisés s'ils n'ont pas changé. Un modèle de 100 Mio n'est pas renvoyé à chaque déplacement de meuble.
- Si deux ordinateurs modifient le même appartement, l'application refuse d'écraser une version plus récente. Utiliser **Enregistrer une copie en ligne**, ou ouvrir la version distante. Les modifications locales non synchronisées sont conservées dans un projet « copie locale » avant le chargement distant.
- La déconnexion conserve les copies locales : sur un ordinateur partagé, exporter les projets nécessaires puis effacer les données du navigateur avant de le laisser à quelqu'un d'autre.

## Limites et vérification réelle

Le stockage gratuit a un quota partagé entre utilisateurs (consulter les limites actuelles du projet Supabase). Les fragments de 20 Mio permettent de rester sous la limite d'envoi unitaire du plan gratuit. Le stockage gratuit n'est pas illimité et peut être mis en pause par le fournisseur selon ses conditions. Ne pas activer de plan payant ou de dépassement payant par défaut.

Les ressources retirées d'un appartement restent dans le bucket, car elles peuvent être réutilisées par d'autres appartements. Surveiller le quota dans le tableau de bord. Il n'y a pas encore de purge automatique des fragments orphelins, de partage entre utilisateurs ni de fusion collaborative des modifications. Conserver des exports ZIP locaux.

Avant de considérer le service actif, vérifier avec un vrai projet Supabase : inscription et confirmation d'adresse ; connexion depuis deux navigateurs indépendants ; sauvegarde avec un GLB ; récupération des mêmes dimensions et octets ; conflit entre deux versions ; impossibilité pour un second compte de lire les lignes et les fichiers du premier. Les tests locaux avec réponses simulées ne remplacent pas cette vérification du service et des politiques RLS.

### Reprise automatique entre ordinateurs

Après le premier envoi explicite, les modifications sont envoyées automatiquement après quatre secondes sans changement. À la connexion, un appareil sans appartement lié reprend le dernier appartement en ligne en conservant son projet local. Un appartement déjà lié se met à jour au lancement et au retour dans l’onglet. Si les deux appareils ont des modifications non synchronisées, la mise à jour est suspendue et « Mon compte » permet de choisir une version ou de créer une copie. Garder l’onglet ouvert jusqu’à la fin de l’envoi ; ce mécanisme utilise l’offre gratuite existante et ses quotas, sans abonnement supplémentaire.
