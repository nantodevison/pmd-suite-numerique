# Widget Page (`page`)

Affiche **une ligne** d'une table comme une page, à la manière de Notion : un
grand titre, quelques pastilles, puis un texte en **Markdown** qu'on lit et
qu'on modifie sur place.

Exemple d'usage : la page d'accueil d'un projet, c'est-à-dire une ligne de la
table des projets, avec un texte de présentation. Les autres widgets de la page
Grist (tâches, rendez-vous…) peuvent ensuite « Sélectionner par » ce widget.

Statut : **en développement** (version 0, #235).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure HTML et styles ; charge `page.js` |
| `page.js` | Logique Grist : choix de la ligne (⚙), affichage, sauvegarde du texte |
| [`../_commun/fiche.js`](../_commun/fiche.js), [`fiche.css`](../_commun/fiche.css) | Champ Markdown (Aperçu / Modifier, cases à cocher), commun avec le Kanban et la Galerie |
| [`../_commun/pastilles.js`](../_commun/pastilles.js), [`pastilles.css`](../_commun/pastilles.css) | Dessin des pastilles, commun avec la Galerie |
| [`../_commun/colonnes.js`](../_commun/colonnes.js) | Structure du document (libellés, types, couleurs des choix) |
| [`../_commun/fenetre.js`](../_commun/fenetre.js), [`fenetre.css`](../_commun/fenetre.css) | Fenêtre des réglages ⚙ |
| [`../_commun/recherche.js`](../_commun/recherche.js) | Chargé pour `fiche.js` |

La Page dépend du dossier `_commun/` : elle ne fonctionne qu'**en mode URL**.

## Déploiement

Par URL (GitHub Pages) :

```
https://nantodevison.github.io/pmd-suite-numerique/widgets/page/
```

Voir [../README.md](../README.md#brancher-un-widget-par-url-github-pages) pour
l'avertissement et le niveau d'accès. L'**accès complet** est requis : le widget
écrit le texte, relit toute la table (pour appliquer les critères) et lit la
structure du document (libellés, couleurs des choix).

Banc d'essai, à jouer avant toute PR qui touche la Page ou `_commun/` :
[`tests/page/`](../../tests/page/).

## Configuration

### 1. La table

C'est celle que Grist relie au widget, choisie à son ajout (« Sélectionner les
données »). Le widget ne la redemande pas.

### 2. Les colonnes

Elles s'associent dans le panneau de droite de Grist, section **Colonnes** du
widget :

| Champ | Obligatoire | Rôle | Exemple (projets) |
|---|---|---|---|
| **Titre** | oui | grand titre de la page, en lecture seule | `Titre` |
| **Texte de la page (Markdown)** | non | corps de la page, modifiable | `Presentation` |
| **Pastilles (sous le titre)** | non, plusieurs colonnes possibles | pastilles colorées, en lecture seule, libellé au survol ; une liste de références donne une pastille par élément | `Type`, `Chef_de_projet` |

Couleurs des pastilles : les mêmes que dans la Galerie (couleur du choix dans
Grist, échelle du rouge au vert pour un pourcentage, pastel propre à chaque
valeur pour une référence).

### 3. La ligne affichée (⚙)

Le bouton ⚙, discret en haut à droite, ouvre la fenêtre **Ligne affichée**.
Elle s'ouvre d'office tant qu'aucune ligne n'est choisie.

- On compose un ou plusieurs **critères** « colonne = valeur », combinés par
  « et ». La valeur se choisit dans la liste de celles qui existent dans la
  table, ce qui évite toute faute de frappe.
- Colonnes proposées : le **N° de ligne** (en tête), puis les colonnes Texte,
  Choix, Référence, Nombre et Case à cocher de la table, associées ou non. Les
  listes (choix multiples, listes de références) ne sont pas proposées.
- Le résultat s'affiche en direct : « ✓ Une ligne : #12 — … », « ⚠️ Aucune
  ligne… » ou « ⚠️ 3 lignes… : ajoutez un critère ». **Appliquer** n'est
  possible que si les critères désignent exactement une ligne.
- Une **référence** est retenue sous le numéro de la ligne visée : renommer un
  contact ne casse pas le critère. Un critère sur un **texte** (le titre, par
  exemple) casse au contraire si l'on renomme la ligne ; le **n° de ligne**
  est le plus sûr, il ne change jamais.
- Les critères sont gardés dans les **options du widget**, donc dans le
  document. Comme toutes les options d'un widget, il faut ensuite cliquer sur
  **Enregistrer** dans Grist (en haut du widget). Ils suivent la page quand on
  la duplique (vérifié le 2026-11-18) : il suffit alors de changer la ligne
  dans ⚙.

Seules les lignes que Grist envoie au widget comptent : un filtre de la vue
Grist qui masque la ligne choisie fait afficher « Aucune ligne ne correspond ».

Si, plus tard, les critères ne désignent plus une seule ligne (ligne supprimée,
deuxième ligne au même titre…), la page l'écrit clairement, rappelle les
critères et propose ⚙. Une valeur ou une colonne disparue reste visible dans ⚙,
marquée ⚠️.

## Lire et modifier

- **Titre** : en lecture seule dans cette version. Dans la table des projets,
  une règle de Grist remplace un titre de plus de 30 caractères par un message
  d'erreur : le modifier depuis le widget pourrait l'écraser.
- **Texte** : le même champ que dans la fiche du Kanban et de la Galerie.
  « ✏️ Modifier » (ou un double-clic) passe en saisie Markdown, « 👁 Aperçu »
  revient au texte mis en forme ; les cases à cocher (`- [ ] …`) se cochent
  d'un clic dans l'aperçu. Les liens s'ouvrent dans un nouvel onglet.
- Dès que le texte change, une **barre** apparaît en bas : « Annuler »
  (avec confirmation) ou **« ✓ Sauvegarder »** (ou Ctrl + S). Seule la colonne
  du texte est écrite. Tant que le texte n'est ni sauvegardé ni annulé, un
  changement venu de Grist ne l'efface pas.
- Une colonne de texte **calculée par une formule** reste en lecture seule,
  avec la mention 🔒.
- Le Markdown est nettoyé par DOMPurify en liste blanche avant affichage (voir
  les [notes de sécurité](../README.md#notes-de-sécurité)).

Le widget place le **curseur de Grist** sur la ligne affichée et se déclare
source de liaison (`allowSelectBy`). Pour que les tâches suivent la page, le
réglage se fait **sur la vue des tâches** (et non sur la Page) : panneau de
droite → Données → « Sélectionner par » → choisir le widget Page.

## Limites connues (version 0)

- Titre et pastilles en lecture seule.
- La structure du document (libellés, couleurs des choix) est lue au premier
  affichage : un changement dans Grist n'apparaît qu'après rechargement (#234).
- Pas de « zone blanche » où insérer des blocs d'autres tables (piste notée
  dans #235, à étudier après les versions 0 de la page et des interactions).
