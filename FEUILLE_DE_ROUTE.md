# Feuille de route — pmd-suite-numerique

<!--
Ce fichier liste ce qui reste à faire. Il est lu par la compétence
"etat-des-lieux" en début de séance et mis à jour en fin de séance.
Gardez-le court : quelques lignes par section suffisent.
-->

<!-- début grist : section régénérée depuis Grist, ne pas modifier à la main -->
## Kanban (Grist)
_Projet « Kanban » — toutes les tâches ouvertes — lu le 2026-10-06 23:10_

### 🖐️ À faire
- [ ] #146 Supprimer les onglets Standardiser et Linéariser (Haute, EPIC « Supprimer les spécifité OTV »)
- [ ] #150 Ouvrir la carte au centre, en plus grand (Haute, EPIC « Améliorer l'interface »)
- [ ] #147 Chercher les autres spécificités OTV dans le code (Moyenne, EPIC « Supprimer les spécifité OTV »)
- [ ] #148 Généraliser la liste des contacts assignables du Kanban (Moyenne, EPIC « Supprimer les spécifité OTV »)
- [ ] #149 Ouvrir la carte au clic (Moyenne, EPIC « Améliorer l'interface »)
- [ ] #153 Supprimer l'appel en double à grist.ready() dans le Kanban (Basse, EPIC « Améliorer la qualité du code »)
- [ ] #154 Placer le fetchTable('EPICs') du Kanban dans le bloc de gestion d'erreur (Basse, EPIC « Améliorer la qualité du code »)
- [ ] #155 Corriger le préréglage « Millésime » en « Millesime » dans le Kanban (Basse, EPIC « Améliorer la qualité du code »)

<!-- fin grist -->

## ⚠️ Urgent
(rien)

## En cours
- [x] Fusionner la branche feat/restructuration (nouvelle structure widgets/ python/ espaces/ projets/) — PR #10, 2026-09-23

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
- 2026-10-06 — clôture : git pull (fusion classique, jamais --rebase) avant d'écrire la feuille de route, repère CONFLIT_PROBABLE dans les deux collectes — le serveur peut avancer pendant la séance (PR fusionnées sur GitHub, images de la sync, autre poste)
