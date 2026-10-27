# Feuille de route — pmd-suite-numerique

<!--
Ce fichier liste ce qui reste à faire. Il est lu par la compétence
"etat-des-lieux" en début de séance et mis à jour en fin de séance.
Gardez-le court : quelques lignes par section suffisent.
-->

<!-- début kanban : section régénérée par taches.py, ne pas modifier à la main -->
## Kanban (Grist)
_Projet « Gestion de projet » — toutes les tâches ouvertes — lu le 2026-10-27 16:32_

### 🖐️ À faire
- [ ] #183 Ajouter les ref interne (Haute, EPIC « Améliorer la qualité du code »)
- [ ] #197 Kanban : supprimer VIEWS, les onglets codés en dur et la colonne « Disponible » spéciale (Haute, EPIC « Supprimer les spécifité OTV »)
- [ ] #198 Migrer l'Observatoire : recréer Tâches, Standardiser et Linéariser en vues (Haute, EPIC « Supprimer les spécifité OTV »)
- [ ] #199 Kanban : mettre à jour le README et le catalogue des widgets (Haute, EPIC « Supprimer les spécifité OTV »)
- [ ] #201 Vérifier la sécurité des widgets et du dépôt public (XSS, dépendances CDN, secrets dans l'historique, sync) (Haute, EPIC « Améliorer la qualité du code »)
- [ ] #147 Chercher les autres spécificités OTV dans le code (Moyenne, EPIC « Supprimer les spécifité OTV »)
- [ ] #148 Généraliser la liste des contacts assignables du Kanban (Moyenne, EPIC « Supprimer les spécifité OTV »)
- [ ] #185 Rendre les pastilles modifiables dans la fiche de la Galerie (Moyenne, EPIC « Améliorer l'interface »)
- [ ] #184 Ouvrir un objet lié (tâche, EPIC…) d'un clic depuis la fiche de la Galerie (Basse, EPIC « Améliorer l'interface »)
- [ ] #186 Préremplir une nouvelle carte de la Galerie avec le filtre de la vue (Sélectionner par) (Basse, EPIC « Améliorer l'interface »)
- [ ] #188 Extraire le rendu des cartes et des pastilles dans _commun (carte.js, carte.css), utilisé par la Galerie (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #189 Ajouter à la Galerie un mode tableau : cartes groupées en colonnes selon une colonne Choix associée (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #190 Permettre le glisser-déposer des cartes entre colonnes dans le mode tableau (change la valeur de la colonne de regroupement) (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #191 Reprendre dans le moteur commun les réglages du Kanban : ordre des colonnes, filtres EPIC et personne, projet du widget (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #192 Remplacer le Kanban par le moteur commun : d'abord sur une copie, puis pour l'Observatoire (Basse, EPIC « Unifier Galerie et Kanban dans un moteur de cartes commun »)
- [ ] #200 Kanban : filtrer sur n'importe quelle colonne (texte, nombre, date…) (Basse, EPIC « Améliorer l'interface »)

### ♻️ En cours
- [ ] #146 Supprimer les onglets Standardiser et Linéariser (Haute, EPIC « Supprimer les spécifité OTV »)

<!-- fin kanban -->

## ⚠️ Prochaine séance
- [ ] Vérifier dans l'Observatoire (Ctrl + F5) que les vues enregistrées sont en ligne : trois onglets affichés, bouton « ＋ Vue » présent
- [ ] Puis #198 : recréer Tâches, Standardiser et Linéariser en vues dans l'Observatoire ; ensuite #197 (supprimer les onglets codés en dur)

## En cours
- [x] Fiche dense du Kanban fusionnée sur master (PR #15, feat/fiche-centrale), 2026-10-24 = mise en production du Kanban, vérifiée dans le document de l'Observatoire
- [ ] Refaire le modèle ⚙ de la Galerie dans le document réel
- [x] Filtres combinables du Kanban (#195), PR #17 fusionnée le 2026-10-26, vérifiée sur les données réelles
- [x] Vues enregistrées (#196) : 8 tests validés dans le builder, PR #18 fusionnée le 2026-10-27 = mise en production ; #187 (glisser-déposer des colonnes) réglée du même coup

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
