# widgets/

Tous les **widgets Grist** (HTML/CSS/JS) du dépôt, rangés **à plat** : un dossier
par widget, quel que soit le projet qui l'utilise.

Chaque widget est publié par GitHub Pages à l'adresse :

```
https://nantodevison.github.io/pmd-suite-numerique/widgets/<nom-du-dossier>/
```

> ⚠️ **Le nom du dossier fait partie de l'URL.** Déplacer ou renommer le dossier
> d'un widget publié casse tous les documents Grist qui l'utilisent. Le classement
> (générique ou spécifique, projets concernés…) se fait dans le catalogue
> ci-dessous, jamais par l'arborescence.

## Catalogue

### Format

| Champ | Contenu | Valeurs autorisées |
|---|---|---|
| **Widget** | nom du dossier, avec lien | — |
| **Rôle** | ce que fait le widget, en une phrase | texte libre |
| **Portée** | peut-il servir ailleurs tel quel ? | `générique` · `spécifique` |
| **Projet(s)** | projets qui l'utilisent | noms de dossiers de [`../projets/`](../projets/), ou `—` |
| **Données** | générique : colonnes à associer ; spécifique : tables lues ou écrites | texte court |
| **Accès** | niveau demandé à Grist | `read table` · `full` |
| **Statut** | où en est-il ? | `en développement` · `en test` (publié, en cours de prise en main) · `en service` · `archivé` |

### Widgets

| Widget | Rôle | Portée | Projet(s) | Données | Accès | Statut |
|---|---|---|---|---|---|---|
| [kanban](kanban/) | Suivre des tâches en colonnes par statut : glisser-déposer, création, fiche (côté ou centre) avec pastilles modifiables et description en Markdown, filtres combinables, vues enregistrées, onglet Accueil (mode d'emploi), équipe projet choisie dans ⚙ | générique | observatoire-trafics | lit et écrit la table de la vue (colonnes associées via ⚙) ; lit les tables visées par les colonnes Projet, EPIC et Assigné à | `full` | en service |
| [galerie](galerie/) | Afficher une table en cartes avec pastilles colorées ; fiche (côté ou centre) pour lire et modifier le titre et le texte principal en Markdown ; création de carte avec modèle de texte | générique | gestion-de-projet | colonnes à associer : Titre, Texte principal (Markdown), Pastilles (plusieurs), Objets liés (plusieurs), Contexte (plusieurs) ; lit la structure du document | `full` | en test |

**Widgets retirés.** GitHub Pages publie tout le dépôt : un widget qui n'est plus
utilisé est supprimé, et non simplement marqué « archivé », pour ne pas laisser
en ligne du code que plus personne ne surveille. Son code reste dans
l'historique Git.

| Widget | Rôle | Projet | Retiré le | Code récupérable au tag |
|---|---|---|---|---|
| parcours-doc | Parcourir les chapitres d'un document Docs synchronisé | gt-cbs-bruit | 2026-10-30 (#201) | `archive-widgets-gt-cbs` |
| questions | Poser des questions sur le document et les classer par thème | gt-cbs-bruit | 2026-10-30 (#201) | `archive-widgets-gt-cbs` |
| echanges | Répondre aux questions, voter, lier les réponses aux chapitres | gt-cbs-bruit | 2026-10-30 (#201) | `archive-widgets-gt-cbs` |

Le tag `archive-widgets-gt-cbs` marque le commit `83a05a4`. Pour consulter
l'un de ces widgets : `git show archive-widgets-gt-cbs:widgets/<widget>/widget.js`,
ou en ligne : <https://github.com/nantodevison/pmd-suite-numerique/tree/archive-widgets-gt-cbs/widgets>.
Un tag n'est pas publié par GitHub Pages (seule la branche `master` l'est).

## Conventions

- Chaque widget est composé d'un `index.html` et d'un fichier JavaScript ; `index.html` charge ce dernier par `<script src="…">` (indispensable en mode URL).
- Pas de dépendances npm : seules des CDN publics sont utilisés (chargés via `<script src="...">`).
- La bibliothèque `grist-plugin-api.js` est toujours chargée depuis l'instance de la DINUM : `https://grist.numerique.gouv.fr/grist-plugin-api.js`.
- Toujours appeler `grist.ready()` **avant** tout appel à l'API Grist (évite l'erreur `RPC_UNKNOWN_FORWARD_DEST`).
- Les dossiers dont le nom commence par `_` ne sont pas des widgets : ce sont des ressources partagées. Ils sont publiés grâce au fichier `.nojekyll` à la racine du dépôt.
  - [`_commun/`](_commun/) : la **fiche** partagée par `kanban` et `galerie` (`fiche.js`, `fiche.css`) : disposition côté / centre, Markdown. Un widget qui l'utilise ne fonctionne qu'en mode URL. Modifier ces fichiers touche **tous** ces widgets, y compris ceux en service : tester chacun avant de fusionner.

## Workflow : modifier un widget

1. **Modifier** le fichier dans ce dépôt (ex. `widgets/kanban/kanban.js`).
2. **Committer** et **pousser**, puis fusionner sur `master` (la branche publiée par GitHub Pages).
3. Mettre à jour Grist, selon le mode de déploiement du widget :
   - **par URL (GitHub Pages)** : rien à faire, la nouvelle version est publiée automatiquement 1 à 2 minutes après la fusion sur `master` ; il suffit de recharger la page Grist ;
   - **par copier-coller** : dans Grist, ouvrir le widget → *Modifier* → coller `index.html` dans l'onglet HTML et le fichier JavaScript dans l'onglet JavaScript.

## Brancher un widget par URL (GitHub Pages)

1. Dans Grist : *Ajouter une vue* → *Personnalisée* → **URL personnalisée**, puis coller :
   ```
   https://nantodevison.github.io/pmd-suite-numerique/widgets/<widget>/
   ```
2. Grist affiche l'avertissement « Attention aux vues personnalisées de source inconnue ». Il est normal : cocher la case et confirmer.
3. Dans le panneau de droite, **Niveau d'accès** → **Accès complet au document**. Sinon, le widget affiche « Access not granted ».

Le code servi est public (dépôt GitHub public). Chaque widget charge aussi
`grist-plugin-api.js` (instance Grist de la DINUM) ; `kanban` et `galerie` chargent `marked` et `DOMPurify` (cdnjs, avec contrôle
d'intégrité `integrity`).

## Notes de sécurité

- **Pas de secrets dans le JS** : ne jamais inclure de clé API ou de token dans les widgets frontend.
- **Niveau d'accès** : demander le niveau minimal ; `full` seulement si le widget écrit dans le document ou lit d'autres tables que celle de la vue.
- **Markdown** : nettoyé par DOMPurify en liste blanche (`_commun/fiche.js`) : ni formulaire, ni bouton, ni style ; une image qui ne vient pas du dépôt du projet est remplacée par « 🖼 [image externe masquée] ».
- **Widgets inutilisés** : les supprimer du dépôt (voir « Widgets retirés »), puisque tout ce qui est dans le dépôt est publié.
- **Images** : voir [`../python/README.md`](../python/README.md#gestion-des-images-internes).
