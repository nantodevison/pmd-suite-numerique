# Widget Kanban (`kanban`)

Suivi de tâches en colonnes, une colonne par statut : glisser-déposer des cartes
et des colonnes, création, modification et suppression de cartes, filtres par
EPIC et par personne, tri par priorité.

**Auteur : Rémi** ([@Rmemb](https://github.com/Rmemb)), développé pour le projet
[Observatoire des trafics](../../projets/observatoire-trafics/).

> **Version d'origine** reprise depuis le Custom Widget Builder de Grist (commit
> `4f45af5`), plus un correctif des références (repérable aux commentaires
> « ✅ Correctif » dans `kanban.js`). Elle reste **spécifique** à l'Observatoire
> (voir « Limites connues ») ; sa généralisation à d'autres projets (Écoute
> client, Valorisation) est prévue.

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
Date / Échéance, EPIC, Millésime, Projet. Ce réglage, l'ordre des colonnes et
l'onglet actif sont mémorisés dans les options du widget (`grist.setOption`).

Par défaut, l'association est préremplie pour la table `Taches` de l'espace
[gestion de projets](../../espaces/gestion-projets/).

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

## Carte

Une carte est un **aperçu** : le titre, l'EPIC dessous (petit, en italique),
puis une ligne de badges : priorité, personne(s), échéance, et le millésime
s'il est associé dans ⚙. La description se lit dans la fiche. Le titre et les
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

Le millésime n'est plus dans la fiche (il reste sur les cartes et dans ⚙) :
c'est un champ propre à l'Observatoire, appelé à disparaître du widget.

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
- les personnes assignables sont limitées aux contacts n° 20, 21, 23 et 360 ;
- les onglets Standardiser et Linéariser reposent sur les noms exacts de deux
  EPICs, et sur des listes de statuts propres au projet ;
- les tables `Contacts` et `EPICs` sont encore lues par leur nom (pour la liste
  des contacts autorisés et l'ancienne liste d'EPICs).

Le projet OTV codé en dur (6ᵉ ligne de `Projets2`) a été remplacé le
2026-10-02 par le réglage « Projet du Kanban ».

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
