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
| **Texte principal (Markdown)** | non | texte de la fiche (pas sur la carte, mais pris en compte par la recherche) | `Description` |
| **Pastilles (carte et fiche)** | non, plusieurs colonnes possibles (pas de liste de références) | pastilles colorées sur la carte ; dans la fiche, sans libellé, à droite du titre (au centre) ou dessous (sur le côté) | `Avancement`, `Priorite`, `Projet` |
| **Objets liés (sous le titre de la fiche)** | non, plusieurs colonnes possibles (listes de références seulement) | une ligne par colonne sous le titre de la fiche, un élément par pastille blanche | `Taches`, `Retour_U` |
| **Contexte (fiche seulement)** | non, plusieurs colonnes possibles | encart « libellé : valeur » sous l'en-tête de la fiche | `objectifs_resultats_cle` |

Grist ne propose dans chaque champ que les colonnes de type compatible ; une
colonne calculée sans type déclaré (comme `Avancement`) est proposée partout.
La colonne du texte principal est ignorée si elle est aussi choisie ailleurs,
de même qu'une colonne de contexte déjà affichée en pastille ou en objet lié.

La carte ne montre que le titre et les pastilles : elle doit rester concise.

**Couleur des pastilles** :
- colonne Choix : la couleur du choix réglée dans Grist ; à défaut, un pastel ;
- pourcentage (« 67 % », ou nombre affiché en % dans Grist) : rouge jusqu'à
  33 %, orange jusqu'à 66 %, jaune-vert jusqu'à 99 %, vert à 100 % ;
- référence : un pastel propre à chaque valeur (toujours le même) ;
- autres colonnes : gris neutre ; cellule en erreur : « ⚠️ invalide » en rouge.

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
- En-tête en lecture seule (v1) : le titre, avec dessous les **objets liés**
  (« — » si aucun) ; les **pastilles** dans un encart à droite (au centre) ou
  sous le titre (sur le côté), libellé au survol ; puis le **contexte**, même
  vide (« — »). Références par leur nom affiché, dates au format français.
- Le Markdown est nettoyé par DOMPurify avant affichage.
- Les textes de l'ancien widget **Notepad** de Grist (format JSON) sont
  affichés convertis en Markdown ; un bandeau propose de les réécrire en
  Markdown dans Grist, une fois pour toutes.

## Limites connues (v1)

- Les noms affichés des références sont lus au premier affichage : un
  renommage dans la table visée n'apparaît qu'après rechargement du widget.
- Le contexte n'est pas modifiable depuis la fiche (prévu en amélioration).
- La recherche porte sur le titre et le texte principal seulement.
