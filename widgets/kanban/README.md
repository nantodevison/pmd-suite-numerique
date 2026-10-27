# Widget Kanban (`kanban`)

Suivi de tâches en colonnes, une colonne par statut : glisser-déposer des cartes
et des colonnes, création, modification et suppression de cartes, filtres
combinables, vues enregistrées (filtres + colonnes), tri par priorité.

**Auteur : Rémi** ([@Rmemb](https://github.com/Rmemb)), développé pour le projet
[Observatoire des trafics](../../projets/observatoire-trafics/).

> **Version d'origine** reprise depuis le Custom Widget Builder de Grist (commit
> `4f45af5`), plus un correctif des références (repérable aux commentaires
> « ✅ Correctif » dans `kanban.js`). Elle reste **spécifique** à l'Observatoire
> (voir « Limites connues »). Sa généralisation est en cours : les onglets
> propres à l'Observatoire ont été remplacés par des vues enregistrées le
> 2026-10-27 ; il reste les points de « Limites connues ».

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
Date / Échéance, EPIC, Projet. Ce réglage, le projet, l'ordre des
colonnes, les vues et l'onglet actif sont mémorisés dans les options du widget
(`grist.setOption`), donc dans le document. **Ils ne sont écrits dans le
document qu'après un clic sur « Enregistrer », en haut à droite de Grist** :
sinon, ils ne restent visibles que pour vous.

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
> existant) : ouvrir ⚙, choisir le projet, puis « Appliquer ».**

## Accueil

L'onglet **🏠 Accueil**, en haut à côté de « Kanban », est fixe : on ne peut ni
le supprimer ni le renommer. Il affiche un court mode d'emploi, un bouton pour
créer une vue et un lien vers cette page. C'est aussi l'onglet de repli : le
Kanban s'y ouvre au premier lancement, ou quand la vue mémorisée n'existe plus.

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
  les filtres ; si on change d'onglet sans enregistrer, les modifications sont
  abandonnées.
- **Colonnes** : « Colonnes… » permet d'afficher un statut même sans carte, de
  changer l'ordre (↑ ↓) ou de revenir à « Tous les statuts présents ». Glisser
  un en-tête de colonne change aussi l'ordre de la vue. Ces changements sont
  enregistrés aussitôt dans la vue.

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

**Valeurs propres à l'Observatoire, encore codées en dur** (à généraliser) :
- les personnes assignables sont limitées aux contacts n° 20, 21, 23 et 360,
  lus dans la table `Contacts` par son nom (#148).

Le projet OTV codé en dur (6ᵉ ligne de `Projets2`) a été remplacé le
2026-10-02 par le réglage « Projet du Kanban ». Les onglets Standardiser et
Linéariser, qui reposaient sur les noms exacts de deux EPICs, ont été remplacés
le 2026-10-27 par des vues enregistrées dans le document (#196, #197). Le
millésime et la lecture de la table `EPICs` par son nom ont été retirés le
2026-10-28 (#147).

**Vues partagées par tout le document** (amélioration prévue : #202) :
- l'onglet actif est commun à tous : si quelqu'un change d'onglet puis
  enregistre, chacun arrivera sur cet onglet au prochain chargement. Chaque
  changement d'onglet rallume aussi « Enregistrer » dans Grist ;
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
