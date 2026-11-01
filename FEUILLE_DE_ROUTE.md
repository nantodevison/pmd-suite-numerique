# Feuille de route — pmd-suite-numerique

<!--
Ce fichier liste ce qui reste à faire. Il est lu par la compétence
"etat-des-lieux" en début de séance et mis à jour en fin de séance.
Gardez-le court : quelques lignes par section suffisent.
-->

<!-- début kanban : section régénérée par taches.py, ne pas modifier à la main -->
## Kanban (Grist)
_Projet « Gestion de projet » — toutes les tâches ouvertes — lu le 2026-11-01 21:19_

### 🖐️ À faire
- [ ] #185 Rendre les pastilles modifiables dans la fiche de la Galerie (Moyenne, EPIC « Améliorer l'interface du kanban »)
- [ ] #204 Réutiliser les filtres kanban (Moyenne, EPIC « Filtrer la galerie »)
- [ ] #205 Modifier des pastilles sans ouvrir la carte (Moyenne, EPIC « Rendre les cartes de galerie modifiable »)
- [ ] #206 Modifier des pastilles dans la carte (Moyenne, EPIC « Rendre les cartes de galerie modifiable »)
- [ ] #210 Configuration ⚙ en 4 étapes visibles : projet, colonnes, classes de statut, membres du projet (Moyenne, EPIC « Améliorer l'interface du kanban »)
- [ ] #184 Ouvrir un objet lié (tâche, EPIC…) d'un clic depuis la fiche de la Galerie (Basse, EPIC « Améliorer l'interface du kanban »)
- [ ] #186 Préremplir une nouvelle carte de la Galerie avec le filtre de la vue (Sélectionner par) (Basse, EPIC « Améliorer l'interface du kanban »)
- [ ] #188 Extraire le rendu des cartes et des pastilles dans _commun (carte.js, carte.css), utilisé par la Galerie (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #189 Ajouter à la Galerie un mode tableau : cartes groupées en colonnes selon une colonne Choix associée (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #190 Permettre le glisser-déposer des cartes entre colonnes dans le mode tableau (change la valeur de la colonne de regroupement) (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #191 Reprendre dans le moteur commun les réglages du Kanban : ordre des colonnes, filtres EPIC et personne, projet du widget (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #192 Remplacer le Kanban par le moteur commun : d'abord sur une copie, puis pour l'Observatoire (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #200 Kanban : filtrer sur n'importe quelle colonne (texte, nombre, date…) (Basse, EPIC « Améliorer l'interface du kanban »)
- [ ] #207 Galerie : relations « Bloque » / « Bloquée par » entre les cartes, à reprendre après le moteur de cartes commun (Basse, EPIC « Améliorer l'Ux/Ui de la galerie »)
- [ ] #208 Rendre cliquables les cases à cocher des descriptions Markdown (Kanban et Galerie) (Basse, EPIC « Améliorer l'interface du kanban »)
- [ ] #212 Choisir les couleurs des colonnes de statut (Basse, EPIC « Améliorer l'interface du kanban »)

### ♻️ En cours
- [ ] #201 Vérifier la sécurité des widgets et du dépôt public (XSS, dépendances CDN, secrets dans l'historique, sync) (Haute, EPIC « Améliorer la qualité du code du kanban »)
- [ ] #202 Kanban : profils de vue par utilisateur (Haute, EPIC « Améliorer l'interface du kanban »)

<!-- fin kanban -->

## ⚠️ Prochaine séance
- [ ] #201 : sur l'autre poste, supprimer la ligne GITHUB_TOKEN= du .env, puis passer #201 en ✅ Fait
- [ ] #202 : test avec Vincent et Elisa (👤 Qui suis-je ?, « Créer ma vue Mes tâches », ⋯ › Colonnes…) avant l'étape 3 (Mes onglets)

## En cours
- [x] Fiche dense du Kanban fusionnée sur master (PR #15, feat/fiche-centrale), 2026-10-24 = mise en production du Kanban, vérifiée dans le document de l'Observatoire
- [ ] Refaire le modèle ⚙ de la Galerie dans le document réel
- [x] Filtres combinables du Kanban (#195), PR #17 fusionnée le 2026-10-26, vérifiée sur les données réelles
- [x] Vues enregistrées (#196) : 8 tests validés dans le builder, PR #18 fusionnée le 2026-10-27 = mise en production ; #187 (glisser-déposer des colonnes) réglée du même coup
- [x] Onglets codés en dur remplacés par un onglet Accueil (#197, PR #19), vues recréées dans l'Observatoire (#198), README et catalogue (#199), 2026-10-27
- [x] Kanban générique : millésime et lecture de EPICs retirés (#147, PR #20), équipe projet dans ⚙ (#148, PR #21), 2026-10-28 ; équipe cochée et Accueil vérifié dans l'Observatoire le même jour
- [x] #202 : onglet actif dans le navigateur (PR #22, 2026-10-28), « Qui suis-je ? » + filtre 👤 Moi (PR #23), vues personnelles 🔒 + « Mes tâches » (PR #24), 2026-10-29 ; reste l'étape 3 après test
- [x] #201 étape 1 : clé API Grist trouvée dans une sortie de notebook (commit 3cae070) → régénérée ; clé Brevo supprimée ; historique et 32 images sains ; étape 2 : revue de code sans faille
- [x] #201 : double authentification GitHub, jeton de la sync révoqué (ce poste), widgets archivés retirés (PR #25, tag archive-widgets-gt-cbs), API Grist servie par la DINUM et Markdown en liste blanche (PR #26), 2026-10-30 ; reste l'autre poste
- [x] #183 étape 1 : liens Bloque / Bloquée par dans la fiche et à la création, module _commun/liens.js (PR #27), 2026-10-31
- [x] #183 étape 2 : classes de statut dans ⚙ et badges ⛔ / ➡️ (PR #28), 2026-10-31 ; étape 3 : avertissements (PR #29), 2026-11-01 ; #183 close, étape 4 (Galerie) reportée dans #207, bloquée par #188
- [x] #203 : numéro #id sur les cartes et dans la barre de la fiche (PR #30), 2026-11-01
- [x] #209 : recherche dans le Kanban et la Galerie, règle commune _commun/recherche.js (PR #31), 2026-11-01
- [x] #211 : tri des cartes du Kanban sur n'importe quelle colonne, module _commun/tri.js (PR #32), 2026-11-01

## Prochaines étapes
(Les étapes du projet sont désormais suivies dans Grist : voir « Kanban (Grist) » ci-dessus.)
- [x] Publier le Kanban de Rémi (PR #11) et corriger l'écriture des références et du nom de table (PR #12), testé par URL le 2026-09-24
- [x] Choix du projet au démarrage : un Kanban = un projet (PR #13), sans « Vue : … » dans la barre (PR #14), 2026-10-02 ; suite de la généralisation suivie dans Grist (EPICs 21 à 23)
- [x] Basculer le Kanban de l'Observatoire du builder vers la version par URL — fait par Martin, avant le 2026-10-02
- [ ] Réparer les cellules EPIC / `qui_` invalides du document réel (en cours, par Martin)
- [ ] Valider la fiche type d'écoute client (Docs) avec May-Jeanne — à suivre dans le projet Grist « Fiche écoute client »

## Plus tard / idées
(suggestions de Claude, à valider)
- Écoute client : modèle Docs, puis synchronisation vers Grist (en base64 pour les images : dépôt public)
- Nettoyer le schéma de l'espace gestion de projets (voir `espaces/gestion-projets/README.md`)
- Vérifier que la sync fonctionne encore (cookies Docs probablement expirés depuis avril)
- Éviter les doublons dans Chapitres quand on relance la sync
- Dépôt .claude : ajouter à taches.py des options --bloque / --bloquee-par (colonnes Bloque / Bloquee_par de Grist), pour lier les tâches sans passer par Grist à la main — demandé le 2026-10-26
- Sécurité : vider les sorties des notebooks avant chaque commit (contrôle automatique type nbstripout ?) — à formaliser à l'étape 6 de #201
- Sécurité : CSP dans index.html, reportée (#201) — protège contre un texte piégé, pas contre un code modifié sur GitHub

## Décisions récentes
<!-- Une ligne par décision : date — décision — raison en quelques mots -->
- 2026-09-23 — .vscode/settings.json n'est plus suivi par Git (tasks, launch et extensions le restent) — réglages propres au poste
- 2026-09-23 — les widgets peuvent être servis par GitHub Pages — test concluant avec parcours-doc sur l'instance Grist de la DINUM
- 2026-09-23 — les widgets du GT cartes de bruit ne sont plus en service — on prépare les futurs widgets plutôt que de migrer l'existant
- 2026-09-23 — dépôt renommé pmd-suite-numerique, gardé sur le compte nantodevison — outils destinés au groupe PMD
- 2026-09-23 — structure widgets/ (à plat, URL fixes) · python/ · espaces/ · projets/, avec catalogue des widgets — le classement évolue, les URL ne doivent pas bouger
- 2026-09-23 — règles GitHub limitées à master (pas de suppression, pas de réécriture), ni signature des commits ni PR exigées — trop contraignant pour un dépôt maintenu à une ou deux personnes
- 2026-09-23 — GitHub CLI (gh) installé en version portable dans %LOCALAPPDATA%\Programs\gh — pour que Claude puisse créer les PR
- 2026-09-24 — Rémi crédité comme co-auteur du Kanban (adresse noreply GitHub) — reconnaissance de son travail sans publier d'adresse personnelle
- 2026-10-02 — feuille de route branchée sur Grist (projet Kanban n° 15), identifiant du document lu dans le .env (env:GRIST_KANBAN_DOC_ID) — ne pas le publier dans le dépôt public
- 2026-10-02 — un Kanban = un projet, choisi une fois dans ⚙ et mémorisé dans le widget — remplace le projet OTV codé en dur
- 2026-10-02 — widget en service par URL : tester dans le Custom Widget Builder avant de fusionner — une fusion sur master vaut mise en production
- 2026-10-02 — une ligne des Notes d'un EPIC = une tâche — convention pour alimenter le kanban Grist
- 2026-10-03 — GRIST_DOC_ID renommé GRIST_SYNC_DOC_ID, variables de la sync sans suffixe de projet — depuis le regroupement des projets, seul le document cible est propre à un projet ; cookies Docs, instance et dépôt sont communs
- 2026-10-05 — outils et compétences Claude versionnés dans le dépôt privé nantodevison/claude-config, .gitignore en liste blanche — sauvegarde et synchronisation entre le fixe et le portable
- 2026-10-05 — grist_taches.py reste dans .claude avec les compétences — couple indissociable, utilisé sur tous les projets ; objectif : sauvegarde personnelle, pas diffusion
- 2026-10-05 — mémoires de projet non versionnées, propres à chaque poste — chemins de projet différents d'un poste à l'autre et contenus divergents ; les règles importantes vont dans le CLAUDE.md du projet
- 2026-10-05 — etat-des-lieux et cloture-session suivent aussi le dépôt .claude (pull proposé en début de séance, commit et push séparés en fin de séance) — éviter que les deux postes divergent
- 2026-10-06 — état des lieux : la feuille de route n'est plus écrite tant que des commits du serveur restent à récupérer, ni réécrite si seule la date « lu le … » change ; la copie du kanban reste versionnée (repli hors ligne) — l'état des lieux faisait échouer le git pull qu'il recommandait
- 2026-10-24 — les textes de l'ancien widget Notepad (JSON) sont convertis en Markdown, à l'affichage et dans Grist (bandeau de la Galerie) — Notepad n'est plus utilisé
- 2026-10-24 — Galerie : champs Pastilles (carte et fiche), Objets liés (listes de références) et Contexte (fiche seulement) ; la carte ne montre plus le texte principal — cartes concises, la recherche porte toujours sur le texte
- 2026-10-24 — le modèle de texte des nouvelles cartes est rangé dans les options du widget (document Grist) — propre à chaque Galerie, hors dépôt public ; à refaire dans le document réel
- 2026-10-24 — fiche du Kanban dense : mêmes propriétés côté et centre (Statut, Priorité, Assigné, Échéance en pastilles cliquables), millésime retiré de la fiche, EPIC modifiable seulement s'il manque — priorité au contenu, généricité
- 2026-10-06 — clôture : git pull (fusion classique, jamais --rebase) avant d'écrire la feuille de route, repère CONFLIT_PROBABLE dans les deux collectes — le serveur peut avancer pendant la séance (PR fusionnées sur GitHub, images de la sync, autre poste)
- 2026-10-26 — les onglets Standardiser / Linéariser seront remplacés par des vues enregistrées (filtres combinables est / n'est pas + colonnes et leur ordre), stockées dans les options du widget — généricité, et les noms d'EPIC de l'Observatoire quittent le dépôt public
- 2026-10-26 — filtres proposés d'abord sur les colonnes Choix, Choix multiple, Référence et Liste de références, puis sur toutes les colonnes (#200) — couvrir l'essentiel d'abord
- 2026-10-26 — dépendances entre tâches dans les colonnes Grist Bloque / Bloquee_par plutôt qu'un préfixe « #146 · » dans le nom — remplies à la main tant que taches.py ne les gère pas
- 2026-10-26 — branche fix/kanban-barre supprimée — son contenu avait été repris par la PR #14
- 2026-10-26 — filtres : valeurs vides ou équivalentes (null, "", espaces, liste vide, référence 0) regroupées sous « (vide) », majuscules conservées ; recherche + cases à cocher pour les longues listes — éviter les doublons de sens
- 2026-10-26 — barre des filtres : seules les étiquettes défilent, « ＋ Filtre » et « Réinitialiser (n) » restent visibles — plus simple qu'un regroupement des filtres
- 2026-10-27 — ordre 196 → 198 → 197 (dépendance changée dans Grist) : les vues cohabitent avec les onglets codés en dur jusqu'à leur recréation — ne pas perdre Standardiser / Linéariser en production
- 2026-10-27 — vues : changer de vue abandonne les filtres non enregistrés (• modifiée comme garde-fou) ; colonnes et ordre enregistrés aussitôt ; le glisser-déposer des colonnes modifie la vue active — fonctionnement de Notion
- 2026-10-27 — vue active et vues lues dans les options à l'ouverture seulement — Grist rappelle onOptions après chaque setOption, parfois dans le désordre
- 2026-10-27 — #187 close sans correctif dédié — le glisser-déposer des en-têtes fonctionne avec les vues enregistrées (test 5 de #196)
- 2026-10-26 — test dans le Custom Widget Builder : Claude assemble un fichier unique (index.html + _commun + JS) dans son scratchpad, à coller dans l'onglet HTML — les chemins relatifs ne fonctionnent pas dans le builder
- 2026-10-27 — onglet fixe « Accueil » (mode d'emploi) comme repli, à la place d'une vue par défaut — aucun statut codé en dur ; dans la barre du haut, à part des vues du projet
- 2026-10-27 — les options du widget (vues, onglet actif, colonnes) ne sont écrites dans le document qu'après « Enregistrer » dans Grist — constaté (rubrique « Options personnalisées ») ; rappelé dans l'Accueil et le README
- 2026-10-28 — millésime retiré du Kanban — l'Observatoire n'a plus à gérer deux millésimes la même année
- 2026-10-28 — équipe projet cochée dans ⚙ plutôt que Contacts.Projets — Contacts.Projets désigne les contacts CRM liés au projet, pas l'équipe ; repli sur toute la table si aucune équipe
- 2026-10-28 — Kanban en portée « générique » dans le catalogue — plus aucune valeur propre à un projet codée en dur
- 2026-10-28 — scan claude-security impossible (outil Workflow indisponible) — plugin retiré ; vérification de sécurité suivie dans #201, à faire en séance
- 2026-10-28 — onglet actif retenu par le navigateur (localStorage), activeView n'est plus écrit dans le document — « Enregistrer » ne s'allume plus à chaque changement d'onglet, chacun retrouve le sien
- 2026-10-29 — couche perso dans le navigateur (nom, vues perso), plutôt que dans les options du document ou une table dédiée — ni « Enregistrer » ni écrasement entre utilisateurs ; perte sur un autre poste acceptée (export/import en option)
- 2026-10-29 — « 👤 Moi » stocké sous un code dans la vue et remplacé au filtrage par le nom déclaré — une vue partagée montre à chacun ses cartes
- 2026-10-29 — vue personnelle par défaut à la création ; « Mes tâches » affiche tous les statuts, à masquer avec ⋯ › Colonnes… — amener les collègues à utiliser l'éditeur de colonnes
- 2026-10-29 — après accord sur le commit, Claude enchaîne push, PR, fusion, retour sur master et suppression des branches — étapes mécaniques
- 2026-10-29 — gitleaks 8.30.1 installé en portable (%LOCALAPPDATA%\Programs\gitleaks, empreinte vérifiée) ; les textes de test XSS restent hors de Grist, dont le pare-feu les refuse (403) — outil d'analyse des secrets du dépôt public
- 2026-10-30 — #201 recentré sur le risque principal : un code de widget modifié sur GitHub, exécuté avec l'accès complet (copie des données, fausse page ProConnect) — la faille XSS était déjà traitée par le code
- 2026-10-30 — un widget inutilisé est supprimé du dépôt, pas seulement archivé ; code gardé au tag archive-widgets-gt-cbs — GitHub Pages publie tout le dépôt
- 2026-10-30 — pas de règle « PR obligatoire » sur master — un compte volé est administrateur et peut la retirer ; elle bloquerait les commits de fin de séance
- 2026-10-30 — grist-plugin-api.js chargé depuis grist.numerique.gouv.fr — même version que notre instance ; celle de getgrist.com est une version de développement (eval)
- 2026-10-30 — Markdown en liste blanche (DOMPurify) ; images limitées au dépôt et aux data:image/ — ni faux formulaire, ni pistage par image
- 2026-10-30 — test XSS pratique abandonné (pare-feu de Grist), remplacé par la revue de code et la liste blanche ; CSP reportée
- 2026-10-31 — liens entre cartes : module commun _commun/liens.js ; 4 classes de statut dans ⚙ ; avertir sans jamais refuser ; liens limités au projet ; carte elle-même et cartes déjà liées non proposées (boucle directe impossible), boucle indirecte → confirmation — réutilisable par la Galerie (#207)
- 2026-10-31 — liens lus avec fetchTable (numéros de ligne) — onRecords ne donne que les titres, ambigus si deux cartes portent le même
- 2026-10-31 — classe Autre ni bloquante, ni signalée bloquée ; statut inconnu deviné en À faire ; un statut d'attente se range en En cours — Autre = idéation, pas production ; prudence pour les statuts nouveaux
- 2026-10-31 — badges ⛔ / ➡️ avec la bulle du navigateur seulement, sans surlignage des cartes liées — UX constante, rien d'autre n'est surligné
- 2026-10-31 — liens relus (fetchTable) à chaque changement de données — badges à jour ; coût négligeable pour quelques centaines de tâches
- 2026-11-01 — avertissements : confirmation si une carte bloquée passe En cours ou Terminé, message si un bloqueur est rouvert, liens rappelés à la suppression ; seul le nouveau est signalé — prévenir sans refuser, sans alertes répétées
- 2026-11-01 — « parents / fille » écarté de #183, sans carte — pas à l'ordre du jour
- 2026-11-01 — #207 (liens dans la Galerie) en attente, bloquée par #188 — la Galerie sert aux EPICs, besoin non prouvé ; le moteur commun évitera un double câblage
- 2026-11-01 — numéro #id en bas à droite des cartes et dans la barre de la fiche, simple texte — le titre reste lu en premier, et le titre de la fiche reste un champ libre
- 2026-11-01 — recherche : parcourt tous les champs texte et les noms des références, quelle que soit la table ; « #N » cherche dans les numéros (début du numéro) ; passagère (jamais enregistrée), vidée par Réinitialiser ; règle commune Kanban, Galerie et menu des liens — robuste quelle que soit la table interrogée
- 2026-11-01 — tri : rangé selon le type Grist (ordre des choix, nombres, dates, textes à la française), vides toujours en bas, enregistré dans la vue comme les filtres, retiré par Réinitialiser, au plus 10 critères ; sans tri, rangement par priorité inchangé — générique, et rien ne change pour les vues existantes
