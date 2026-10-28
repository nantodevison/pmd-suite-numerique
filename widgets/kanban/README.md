# Widget Kanban (`kanban`)

Suivi de tâches en colonnes, une colonne par statut : glisser-déposer des cartes
et des colonnes, création, modification et suppression de cartes, filtres
combinables, vues enregistrées (filtres + colonnes), tri par priorité.

**Auteur : Rémi** ([@Rmemb](https://github.com/Rmemb)), développé pour le projet
[Observatoire des trafics](../../projets/observatoire-trafics/).

> **Version d'origine** reprise depuis le Custom Widget Builder de Grist (commit
> `4f45af5`), plus un correctif des références (repérable aux commentaires
> « ✅ Correctif » dans `kanban.js`). Elle était **spécifique** à
> l'Observatoire ; depuis le 2026-10-28, le widget est **générique** : plus
> aucune valeur propre à un projet n'est codée en dur (voir « Limites connues »).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure HTML et styles ; charge `kanban.js` |
| `kanban.js` | Logique Grist : réception des données, rendu, glisser-déposer, écriture |
| [`../_commun/fiche.js`](../_commun/fiche.js), [`fiche.css`](../_commun/fiche.css) | Fiche partagée avec la Galerie : disposition côté / centre, Markdown |

Le Kanban dépend du dossier `_commun/` : il ne fonctionne donc qu'**en mode
URL** (en copier-coller, il faudrait aussi coller `fiche.js` et `fiche.css`).

## Déploiement

Par URL (GitHub Pages) :

```
https://nantodevison.github.io/pmd-suite-numerique/widgets/kanban/
```

Voir [../README.md](../README.md#brancher-un-widget-par-url-github-pages) pour
l'avertissement et le niveau d'accès (**accès complet** requis).

> ⚠️ Le widget **écrit** dans la table (création, déplacement, modification,
> suppression de cartes). Pour un premier test, utiliser une copie du document.

## Configuration

Le bouton ⚙ ouvre un panneau qui associe les colonnes de la table aux champs du
Kanban : Titre et Statut (obligatoires), Description, Priorité, Assigné à,
Date / Échéance, EPIC, Projet. Ce réglage, comme le projet et l'équipe projet,
est gardé dans le document : voir [« Ce qui est enregistré, et
quand »](#ce-qui-est-enregistré-et-quand).

Par défaut, l'association est préremplie pour la table `Taches` de l'espace
[gestion de projets](../../espaces/gestion-projets/). Une colonne associée qui
n'existe pas dans la table (préréglage d'un autre document, colonne renommée)
est ignorée : le champ reste vide dans ⚙.

### Projet du Kanban : un Kanban = un projet

Le panneau ⚙ comporte aussi le réglage **« Projet du Kanban »**, à choisir une
fois à l'installation du widget (la liste des projets est celle que vise la
colonne « Champ Projet »). Ce choix est mémorisé dans le widget ; pour suivre
un autre projet, on ajoute un **autre** widget Kanban avec son propre réglage.

Une fois le projet choisi, le Kanban :
- n'affiche que les tâches de ce projet (barre du haut : « Projet : … ») ;
- ne propose que les EPICs de ce projet, dans la fiche (pour une carte sans
  EPIC) et à la création d'une carte (l'EPIC actuel d'une carte reste
  visible s'il appartient à un autre projet) ;
- attribue ce projet aux nouvelles cartes.

Tant qu'aucun projet n'est choisi, le Kanban affiche toutes les tâches, signale
« ⚠️ Choisissez le projet du Kanban dans ⚙ » et **bloque la création de cartes**.

> **À l'installation (ou après la mise à jour du 2026-10-02 pour un Kanban
> existant) : ouvrir ⚙, choisir le projet, « Appliquer », puis « Enregistrer »
> dans Grist.**

### Équipe projet

La rubrique **« 👥 Équipe projet »** du panneau ⚙ liste les personnes de la
table visée par « Assigné à » (par exemple `Contacts`), avec une recherche
(sans accents ni majuscules). Les personnes cochées sont les seules proposées
dans « Assigné à », dans la fiche comme à la création d'une carte ; elles
apparaissent en tête de liste à l'ouverture de ⚙.

- Une personne déjà assignée à une carte reste proposée pour cette carte, même
  si elle ne fait plus partie de l'équipe : un enregistrement ne la retire pas
  sans prévenir.
- **Si personne n'est coché, toute la table est proposée** (la liste peut être
  longue avec une table de CRM).
- L'équipe est gardée avec le nom de la table visée : si « Assigné à » est
  associé à une colonne qui vise une autre table, elle est ignorée.
- La rubrique est grisée si « Assigné à » n'est pas une colonne Référence ou
  Liste de références.

> **À l'installation (ou après la mise à jour du 2026-10-28 pour un Kanban
> existant) : ouvrir ⚙, cocher l'équipe, « Appliquer », puis « Enregistrer »
> dans Grist.**

## Ce qui est enregistré, et quand

| Quoi | Où | Comment c'est gardé |
|---|---|---|
| Les **cartes** : création, déplacement, champs, suppression | la table Grist | aussitôt, comme toute saisie dans Grist |
| Les **réglages** de ⚙ : colonnes associées, projet, équipe | le document (options du widget), pour tous | « Appliquer », puis **Enregistrer** de Grist |
| Les **vues** : création, nom, colonnes et leur ordre, suppression | le document, pour tous | aussitôt dans le widget, puis **Enregistrer** de Grist |
| Les **filtres** d'une vue | le document, pour tous | **💾 Enregistrer la vue**, puis **Enregistrer** de Grist |
| L'**onglet actif** et la disposition de la fiche (côté / centre) | votre navigateur, pour vous seul | automatiquement |

**Le bouton « Enregistrer » de Grist**, en haut à droite, apparaît dès qu'un
réglage ou une vue change. Tant qu'on n'a pas cliqué dessus, le changement
n'existe que dans votre page : il est **perdu au rechargement** ou à la
fermeture de l'onglet. Enregistrer demande des droits de modification sur le
document. Changer d'onglet ne fait plus apparaître ce bouton (#202).

**Onglet actif.** Votre navigateur le retient (`localStorage`), séparément pour
chaque document, table et projet : chacun retrouve le dernier onglet qu'il a
regardé. Sur un autre poste, un autre navigateur ou en navigation privée, le
Kanban s'ouvre sur l'Accueil, ou sur l'onglet enregistré dans le document par
une version du widget antérieure au 2026-10-28.

## Accueil

L'onglet **🏠 Accueil**, en haut à côté de « Kanban », est fixe : on ne peut ni
le supprimer ni le renommer. Il affiche un court mode d'emploi, un bouton pour
créer une vue et un lien vers cette page. C'est aussi l'onglet de repli : le
Kanban s'y ouvre au premier lancement, ou quand la vue retenue par votre
navigateur n'existe plus.

## Vues

Une vue est un onglet de la deuxième ligne. Elle a un nom, des filtres et une
liste de colonnes (statuts affichés et leur ordre). Les vues sont propres à
chaque widget Kanban.

- **＋ Vue** crée une vue à partir de l'affichage actuel (filtres et colonnes).
  Depuis l'Accueil, la vue n'a aucun filtre et affiche tous les statuts présents.
- **Menu ⋯** de l'onglet actif : enregistrer ou annuler les modifications des
  filtres, renommer, choisir les colonnes (**Colonnes…**), supprimer (deux clics
  pour confirmer).
- **Filtres** : une vue modifiée affiche **•**. **💾 Enregistrer la vue** garde
  les filtres dans la vue, puis « Enregistrer » de Grist les garde dans le
  document ; si on change d'onglet sans enregistrer la vue, les modifications
  sont abandonnées.
- **Colonnes** : « Colonnes… » permet d'afficher un statut même sans carte, de
  changer l'ordre (↑ ↓) ou de revenir à « Tous les statuts présents ». Glisser
  un en-tête de colonne change aussi l'ordre de la vue. Ces changements sont
  enregistrés aussitôt dans la vue ; reste à cliquer sur « Enregistrer » dans
  Grist pour les garder dans le document.

## Filtres

**＋ Filtre** ajoute une condition « colonne **est** / **n'est pas** valeurs » sur
une colonne Choix, Choix multiple, Référence ou Liste de références. Entre les
valeurs d'un même filtre, c'est un « ou » ; entre filtres, c'est un « et ». Les
valeurs vides (cellule vide, liste vide…) sont regroupées sous « (vide) ». Le
panneau propose une recherche (sans accents ni majuscules) et « Tout cocher » /
« Aucun ». Une nouvelle carte reprend l'EPIC d'un filtre « EPIC est X » à une
seule valeur.

## Carte

Une carte est un **aperçu** : le titre, l'EPIC dessous (petit, en italique),
puis une ligne de badges : priorité, personne(s), échéance. La description se lit dans la fiche. Le titre et les
badges suivent les mêmes règles visuelles que les cartes de la Galerie.

## Fiche d'une carte

Un **clic sur une carte** ouvre sa fiche (le bouton ✏️ fait de même) ; un
glissement, lui, déplace la carte sans ouvrir la fiche. Son contenu est dense :
- le **titre** (sur plusieurs lignes si besoin), et dessous l'**EPIC** en petit
  et en italique : non modifiable,
  sauf s'il manque (« 🏷️ + Choisir un EPIC ») ;
- des **pastilles** Statut, Priorité, 👤 Assigné(s) et 📅 Échéance : un clic
  ouvre un petit menu pour changer la valeur (cases à cocher pour plusieurs
  personnes, calendrier et « Effacer » pour la date) ; une valeur absente
  apparaît en pointillés (« + Priorité »…) ;
- la **description**, en grand.

La fiche s'affiche, avec le même contenu :
- **sur le côté** : panneau étroit, le tableau reste visible ; les pastilles
  sont sous le titre ;
- **au centre** : grande fenêtre ; les pastilles sont à droite du titre, côte
  à côte, la description en grand dessous.

Le bouton ⤢ / ⇥ de l'en-tête passe d'une disposition à l'autre ; le dernier
choix est mémorisé dans le navigateur (chacun garde le sien). Échap, ✕ ou un
clic sur le fond assombri ferment la fiche ; une confirmation est demandée si
des modifications n'ont pas été sauvegardées.

La **description est en Markdown** (`**gras**`, `*italique*`, `# titre`,
`- liste`, `[lien](url)`…) : affichée mise en forme, modifiable en brut avec
« ✏️ Modifier ». Le HTML produit
est nettoyé par DOMPurify avant affichage.

## Limites connues

Relevées à la lecture du code, puis en partie vérifiées lors du test par URL
du 2026-09-24 (sur une copie du document de gestion de projets).

**Plus aucune valeur propre à l'Observatoire n'est codée en dur.** Le projet OTV codé en dur (6ᵉ ligne de `Projets2`) a été remplacé le
2026-10-02 par le réglage « Projet du Kanban ». Les onglets Standardiser et
Linéariser, qui reposaient sur les noms exacts de deux EPICs, ont été remplacés
le 2026-10-27 par des vues enregistrées dans le document (#196, #197). Le
millésime et la lecture de la table `EPICs` par son nom ont été retirés le
2026-10-28 (#147), de même que les contacts assignables n° 20, 21, 23 et 360,
lus dans la table `Contacts` par son nom, remplacés par l'équipe projet (#148).
Seul reste le préréglage des colonnes, pensé pour la table `Taches` de l'espace
gestion de projets (ignoré pour les colonnes absentes).

**Vues partagées par tout le document** (amélioration prévue : #202, vues par
utilisateur ; l'onglet actif est propre à chaque navigateur depuis le
2026-10-28) :
- les vues sont lues à l'ouverture du widget, puis réécrites en bloc à chaque
  modification. Si deux personnes modifient les vues en même temps, la dernière
  enregistrée écrase l'autre.

**Corrigé et validé en test le 2026-09-24 :**
- les champs de type référence (EPIC, Assigné à) étaient enregistrés comme du
  **texte** : la cellule devenait invalide dans Grist, et le badge affichait
  `#Invalid Ref` (EPIC) ou `#Invalid RefList` (`qui_`). Le widget lit
  désormais la description des colonnes dans Grist (section « 8 bis.
  Références » de `kanban.js`) et enregistre des numéros de ligne ;
- les écritures partaient toujours dans la table `Taches`, même quand le widget
  affichait une autre table : le widget demande désormais à Grist le nom réel
  de sa table.

**La version collée dans le Custom Widget Builder du document réel de
l'Observatoire contient encore ces deux bugs : préférer la version par URL.**
Les cellules abîmées par la version d'origine se réparent dans Grist en
resélectionnant la valeur (ou via le panneau corrigé, si le texte correspond à
un nom connu).

**Corrigé le 2026-10-22** (#153, #154, #155) : `grist.ready()` appelé deux
fois ; un `fetchTable('EPICs')` hors du bloc de gestion d'erreur ; préréglage
`Millésime` au lieu de `Millesime`.

**Autre défaut relevé à la lecture du code :**
- si la table est vide, le panneau ⚙ ne propose aucune colonne.
