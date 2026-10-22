# Widget Galerie (`galerie`)

Affiche les lignes d'une table sous forme de **cartes**, en grille. Un clic sur
une carte ouvre sa **fiche** pour lire et modifier son titre et son texte
principal, écrit en **Markdown**.

Pensé pour les tables qui se lisent mieux en fiches qu'en colonnes de statut :
EPICs, objectifs et résultats clés, projets… Les tâches restent gérées par le
[Kanban](../kanban/), qui partage la même fiche.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure HTML et styles ; charge `galerie.js` |
| `galerie.js` | Logique Grist : réception des données, grille, fiche, écriture |
| [`../_commun/fiche.js`](../_commun/fiche.js), [`fiche.css`](../_commun/fiche.css) | Fiche partagée avec le Kanban : disposition côté / centre, Markdown |

La Galerie dépend du dossier `_commun/` : elle ne fonctionne qu'**en mode URL**.

## Déploiement

Par URL (GitHub Pages) :

```
https://nantodevison.github.io/pmd-suite-numerique/widgets/galerie/
```

Voir [../README.md](../README.md#brancher-un-widget-par-url-github-pages) pour
l'avertissement et le niveau d'accès (**accès complet** requis : le widget
écrit le titre et le texte principal, et lit la structure du document pour
afficher les libellés et les références).

## Configuration

Aucune table ni colonne n'est codée en dur. Dans le panneau de droite de Grist,
section **Colonnes** du widget, associer :

| Champ | Obligatoire | Rôle | Exemple (EPICs) |
|---|---|---|---|
| **Titre** | oui | titre de la carte et de la fiche | `Titre` |
| **Texte principal (Markdown)** | non | texte de la fiche ; aperçu sur la carte | `Description` |
| **Contexte (en-tête de la fiche)** | non, plusieurs colonnes possibles | rappelé en en-tête de la fiche ; les 3 premières aussi sur la carte | `Projet`, `Priorite`, `Avancement` |

Pour n'afficher qu'une partie des lignes (par exemple les EPICs d'un projet),
utiliser le filtrage natif de Grist : **« Sélectionner par »** une autre vue,
ou les filtres de la vue. L'ordre des cartes est celui du tri de la vue.

À l'inverse, ouvrir une carte déplace le curseur de Grist sur sa ligne : une
autre vue peut donc « Sélectionner par » la Galerie (par exemple, les tâches de
l'EPIC ouvert).

## Fiche

- Disposition **côté** ou **centre**, au choix (bouton ⤢ / ⇥), mémorisée dans
  le navigateur ; Échap, ✕ ou un clic sur le fond assombri la ferment.
- Le **titre** et le **texte principal** sont modifiables, puis enregistrés avec
  « ✓ Sauvegarder ». Une colonne calculée par une formule reste en lecture seule.
- Le **contexte** est affiché en lecture seule (v1) : références par leur nom
  affiché, dates au format français, listes séparées par des virgules.
- Le Markdown est nettoyé par DOMPurify avant affichage.

## Limites connues (v1)

- Les noms affichés des références sont lus au premier affichage : un
  renommage dans la table visée n'apparaît qu'après rechargement du widget.
- Le contexte n'est pas modifiable depuis la fiche (prévu en amélioration).
- La recherche porte sur le titre et le texte principal seulement.
