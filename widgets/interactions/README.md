# Widget Interactions (`interactions`)

Journal des **interactions d'un projet** (rendez-vous, appels, réunions…),
ligne à ligne, de la plus récente à la plus ancienne : date, titre, type,
personnes, et un lien 🔗 vers la note de la réunion (un document Docs, par
exemple).

Un bouton **« ＋ Rendez-vous »** en crée une ; un clic sur une ligne ouvre sa
fiche pour la modifier.

Statut : **en développement** (version 0, #246).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure HTML et styles ; charge `interactions.js` |
| `interactions.js` | Logique Grist : choix du projet (⚙), liste, fiche (création et modification) |
| [`../_commun/fiche.js`](../_commun/fiche.js), [`fiche.css`](../_commun/fiche.css) | Panneau de la fiche (côté / centre), champ de titre, menus de choix et de recherche |
| [`../_commun/pastilles.js`](../_commun/pastilles.js), [`pastilles.css`](../_commun/pastilles.css) | Pastille colorée du type |
| [`../_commun/colonnes.js`](../_commun/colonnes.js) | Structure du document et noms des projets et des personnes |
| [`../_commun/fenetre.js`](../_commun/fenetre.js), [`fenetre.css`](../_commun/fenetre.css) | Fenêtre des réglages ⚙ et du mode d'emploi « ? » |
| [`../_commun/recherche.js`](../_commun/recherche.js) | Règle de recherche du menu des personnes |

Le widget dépend du dossier `_commun/` : il ne fonctionne qu'**en mode URL**.

## Déploiement

Par URL (GitHub Pages) :

```
https://nantodevison.github.io/pmd-suite-numerique/widgets/interactions/
```

Voir [../README.md](../README.md#brancher-un-widget-par-url-github-pages) pour
l'avertissement et le niveau d'accès. L'**accès complet** est requis : le widget
écrit dans la table, la relit entière, et lit la structure du document ainsi
que les tables des projets et des personnes.

Banc d'essai, à jouer avant toute PR qui touche ce widget ou `_commun/` :
[`tests/interactions/`](../../tests/interactions/).

## Configuration

### 1. La table

C'est celle que Grist relie au widget, choisie à son ajout (« Sélectionner les
données ») : `Interactions` dans l'espace gestion-projets.

### 2. Les colonnes

Elles s'associent dans le panneau de droite de Grist, section **Colonnes** du
widget :

| Champ | Obligatoire | Types | Rôle | Exemple |
|---|---|---|---|---|
| **Date** | oui | Date, Date et heure | tri de la liste ; maintenant pour une création | `Date` |
| **Titre** | oui | Texte | titre de la ligne | `Titre` |
| **Projet** | oui | Référence, Liste de références | filtre sur le projet choisi dans ⚙ ; rempli d'office à la création | `Projets` |
| **Type** | non | Choix | pastille colorée (couleurs des choix de Grist) | `Type` |
| **Personnes** | non | Liste de références | personnes présentes | `Contacts` |
| **Lien** | non | Texte | adresse de la note (Docs…) | `url` |
| **Description** | non | Texte | ancienne description, en lecture seule, montrée dans la fiche si elle est remplie | `Description` |

### 3. Le projet (⚙)

Le bouton ⚙ de la barre du haut ouvre la fenêtre **Projet**. Elle s'ouvre
d'office tant qu'aucun projet n'est choisi.

- On choisit le projet dans la liste des lignes de la table visée par la
  colonne Projet (de A à Z). Il est retenu sous son **numéro** : le renommer
  ne casse rien.
- On peut changer le **libellé du bouton** de création (« Rendez-vous » par
  défaut, affiché « ＋ Rendez-vous »).
- Comme toutes les options d'un widget, il faut ensuite cliquer sur
  **Enregistrer** dans Grist (en haut du widget). Le choix suit la page quand
  on la duplique : il suffit alors de changer le projet dans ⚙.

Pourquoi ⚙ plutôt que « Sélectionner par » de Grist ? Une ligne créée par le
widget ne serait pas reliée d'office au projet affiché. Choisi une fois dans
⚙, le projet sert à la fois à filtrer la liste et à remplir les nouvelles
lignes. C'est aussi la même habitude que pour la [Page](../page/) : « je vois
⚙, je le règle une fois ».

Seules les lignes que Grist envoie au widget comptent : un filtre de la vue
Grist s'ajoute à celui du projet.

## La barre du haut

Même disposition que le Kanban et la Galerie (#249) : à gauche,
**🤝 Interactions** suivi en gris du nom du projet, le nombre d'interactions,
**?** et **⚙** ; à droite, le bouton de création (« ＋ Rendez-vous »). Elle
reste visible quand la liste défile. Tant qu'un message remplace la liste
(aucun projet, colonnes à associer…), elle ne montre que le titre, ? et ⚙.

Le bouton **?** ouvre un court mode d'emploi (⚙, création, fiche, lien,
colonnes), avec un lien vers ce README. Il ne s'ouvre pas de lui-même : à la
première visite, c'est ⚙ qui s'ouvre, tant qu'aucun projet n'est choisi.

## La liste

- Une ligne par interaction du projet, de la plus récente à la plus ancienne
  (celles sans date à la fin) : date (avec l'heure pour une colonne Date et
  heure, dans le fuseau de la colonne), titre, pastille du type, personnes,
  et 🔗 quand un lien est renseigné.
- Le 🔗 ouvre la note dans un nouvel onglet. Par sécurité, il n'apparaît que
  pour une adresse qui commence par `https://` ou `http://`.
- Clic (ou Entrée au clavier) sur une ligne : sa fiche s'ouvre.

## La fiche

- Même panneau que la fiche de la Galerie, sur le côté ou au centre (⤢).
- **Titre**, **date**, **type** (menu des choix de la colonne), **personnes**
  (« ＋ Ajouter » avec une recherche, ✕ pour retirer) et **lien**. Le projet
  est rappelé, non modifiable.
- **Lien** : créez d'abord la note dans Docs, puis collez son adresse. La
  fiche ne crée pas de document Docs.
- « ✓ Sauvegarder » (ou Ctrl + S) n'écrit que les colonnes modifiées. Une
  création exige un titre ; elle reçoit la date du moment (modifiable) et le
  projet de ⚙. Fermer une fiche modifiée (✕, Annuler, Échap) demande
  confirmation.
- Une colonne calculée par une formule reste en lecture seule, avec la
  mention 🔒.
- La liste des personnes est relue à chaque ouverture du menu : une personne
  ajoutée dans Grist est proposée tout de suite.

## Limites connues (version 0)

- Pas de création de document Docs depuis Grist.
- Le projet ne se change pas depuis la fiche (une interaction commune à deux
  projets se règle dans Grist).
- Pas de recherche ni de filtre dans la liste.
