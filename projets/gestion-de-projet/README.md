# Gestion de projet

**État : en cours** — outillage du suivi de projet du groupe PMD dans Grist.

Projet suivi dans l'espace Grist [gestion de projets](../../espaces/gestion-projets/)
(ligne n° 15 de `Projets2`, anciennement « Kanban »). Ses tâches pilotent aussi
la feuille de route de ce dépôt (voir [`../../FEUILLE_DE_ROUTE.md`](../../FEUILLE_DE_ROUTE.md)).

## Le besoin

Gérer les projets dans Grist avec des vues adaptées à chaque niveau :

| Niveau | Table | Vue |
|---|---|---|
| Objectifs et résultats clés | `Objectifs_resultats_cles` | [galerie](../../widgets/galerie/) |
| EPICs | `EPICs` | [galerie](../../widgets/galerie/) |
| Tâches | `Taches` | [kanban](../../widgets/kanban/) |

Dans les deux widgets, une carte s'ouvre en **fiche** (sur le côté ou au
centre) dont le texte principal, la colonne `Description` de chaque table, est
écrit en **Markdown**.

## Widgets utilisés

- [kanban](../../widgets/kanban/) : les tâches, en colonnes par statut ;
- [galerie](../../widgets/galerie/) : les EPICs et les objectifs, en cartes.

## Points d'attention

- Le Kanban est **en service** (Observatoire des trafics) : toute modification
  se teste dans le Custom Widget Builder, sur une copie du document, avant
  fusion sur `master`.
- La colonne `Description` des EPICs s'appelait `Notes` avant le 2026-10-22 ;
  l'outil de feuille de route lit les deux noms.
