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
| [`../_commun/recherche.js`](../_commun/recherche.js) | Règle de recherche commune avec le Kanban |
| [`../_commun/colonnes.js`](../_commun/colonnes.js) | Structure du document (libellés, types, formules, couleurs des choix), commune aux widgets |
| [`../_commun/filtres.js`](../_commun/filtres.js), [`filtres.css`](../_commun/filtres.css) | Règle et panneau des filtres, communs avec le Kanban |
| [`../_commun/vues.js`](../_commun/vues.js), [`vues.css`](../_commun/vues.css) | Vues enregistrées : barre des vues et fenêtre « Gérer la vue », communes avec le Kanban |
| [`../_commun/fenetre.js`](../_commun/fenetre.js), [`fenetre.css`](../_commun/fenetre.css) | Fenêtre à onglets (« Gérer la vue ») |

La Galerie dépend du dossier `_commun/` : elle ne fonctionne qu'**en mode URL**.

## Déploiement

Par URL (GitHub Pages) :

```
https://nantodevison.github.io/pmd-suite-numerique/widgets/galerie/
```

Voir [../README.md](../README.md#brancher-un-widget-par-url-github-pages) pour
l'avertissement et le niveau d'accès (**accès complet** requis : le widget
écrit le titre et le texte principal, et lit la structure du document pour
afficher les libellés et les couleurs des choix).

Banc d'essai (à jouer avant toute PR qui touche la Galerie ou `_commun/`) :
[`tests/galerie/`](../../tests/galerie/).

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

L'ordre des cartes est celui du tri de la vue Grist.

Ouvrir une carte déplace le curseur de Grist sur sa ligne : une autre vue peut
donc « Sélectionner par » la Galerie (par exemple, les tâches de l'EPIC ouvert).

## Filtres et vues enregistrées

Mêmes outils que le [Kanban](../kanban/README.md), par les modules communs
`_commun/filtres.js` et `_commun/vues.js` (#204). La barre sous l'en-tête
montre les vues (en onglets, ou dans un sélecteur ▾ si la place manque),
« ＋ Vue » et « 🔽 Filtres ».

- **Filtres** : sur toute colonne Choix, Choix multiple, Référence ou Liste de
  références de la table, associée au widget ou non (Projet, Assigné à,
  Priorité…). « est » / « n'est pas », plusieurs valeurs cochées (« ou »),
  plusieurs filtres (« et »). Les choix suivent l'ordre et les couleurs de
  Grist. Pour une référence, « Afficher ▾ » montre des attributs de l'objet
  visé, lus dans les colonnes rapportées de la table (`$Projet.Etat`).
- **Vues** : « Toutes les cartes » (fixe), vues 👥 **partagées** (gardées dans
  le document, puis bouton « Enregistrer » de Grist ; chaque Galerie a les
  siennes) et 🔒 **personnelles** (gardées par le navigateur). ⋯ sur la vue
  active : gérer, renommer, copier en vue perso, supprimer.
- **« Gérer la vue »** (⋯ › Gérer, ou « 🔽 Filtres ») : nom et filtres ; 💾
  enregistre, Annuler rétablit la vue telle qu'elle était.
- La recherche 🔍 s'ajoute aux filtres de la vue ; elle n'est jamais enregistrée.
- Le navigateur retient la vue active, les vues perso et les attributs
  affichés, par document et par table : deux Galeries sur la **même table**
  partagent donc ces réglages-là (leurs vues partagées restent distinctes).

Le filtrage natif de Grist (« Sélectionner par », filtres de la vue Grist)
reste possible : il choisit les lignes envoyées au widget, et nos filtres
s'appliquent ensuite.

## Fiche

- Disposition **côté** ou **centre**, au choix (bouton ⤢ / ⇥), mémorisée dans
  le navigateur ; Échap, ✕ ou un clic sur le fond assombri la ferment.
- Le **titre** et le **texte principal** sont modifiables, puis enregistrés avec
  « ✓ Sauvegarder ». Une colonne calculée par une formule reste en lecture seule.
- En-tête en lecture seule (v1) : le titre, avec dessous les **objets liés**
  (« — » si aucun) ; les **pastilles** dans un encart à droite (au centre) ou
  sous le titre (sur le côté), libellé au survol ; puis le **contexte**, même
  vide (« — »). Références par leur nom affiché, dates au format français.
- Les **cases à cocher** du texte principal (`- [ ] à faire`) se cochent d'un
  clic dans l'aperçu, puis s'enregistrent avec « ✓ Sauvegarder » ; elles
  restent grisées si la colonne est calculée par une formule.
- Le Markdown est nettoyé par DOMPurify avant affichage.
- Les textes de l'ancien widget **Notepad** de Grist (format JSON) sont
  affichés convertis en Markdown ; un bandeau propose de les réécrire en
  Markdown dans Grist, une fois pour toutes.

## Nouvelle carte et modèle de texte

- **« + Nouvelle carte »** ouvre une fiche vide : titre à saisir, texte
  principal prérempli avec le modèle. Rien n'est créé dans Grist avant
  « ✓ Sauvegarder » (un titre est alors exigé) ; fermer la fiche ne laisse
  aucune ligne vide. La fiche reste ensuite ouverte sur la carte créée.
- **⚙** : modèle de texte des nouvelles cartes, en Markdown, enregistré dans
  le document Grist (chaque Galerie a le sien ; rien dans le dépôt).
  « Reprendre le texte de … » copie le texte de la carte ouverte ou
  sélectionnée, pour en faire un squelette.
- Les pastilles, objets liés et contexte ne se remplissent pas à la création :
  à saisir dans Grist. La carte créée peut donc être aussitôt masquée, par
  les filtres de la vue active ou par un filtre de Grist (« Sélectionner
  par »…) ; un message le signale. Préremplir la carte d'après les filtres :
  #186.

## Limites connues (v1)

- La structure du document (libellés des colonnes, couleurs des choix) est
  lue au premier affichage : un changement dans Grist n'apparaît qu'après
  rechargement du widget (#234). Les noms des références, eux, arrivent avec
  les données et sont toujours à jour.
- Le contexte n'est pas modifiable depuis la fiche (prévu en amélioration).
- Pas encore de tri des cartes dans les vues (#232) : une vue enregistre un
  tri vide, qui sera repris tel quel.
- La recherche (règle commune avec le Kanban : tous les mots, accents
  ignorés, `#12` pour la ligne n° 12) porte sur toutes les colonnes de la
  table, même masquées dans le widget (#204, comme le Kanban), références
  comprises (sous leur nom affiché) ;
  les nombres, dates et cases à cocher sont ignorés.
