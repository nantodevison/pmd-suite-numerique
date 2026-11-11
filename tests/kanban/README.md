# Banc d'essai du Kanban

Vérifications automatiques du widget [Kanban](../../widgets/kanban/), à jouer
**avant chaque PR qui le modifie**. Le Kanban étant en service par URL, une
fusion sur `master` vaut mise en production : le banc repère ce qu'un
changement casse, l'ancien comme le nouveau, avant le test manuel.

Il **ne remplace pas** le test dans le Custom Widget Builder sur une copie du
document : il imite Grist, il ne le remplace pas.

## Lancer le banc

Prérequis : Python 3.10 ou plus, et Chrome ou Edge. Rien à installer.

```powershell
py tests/kanban/jouer.py                      # tous les scénarios, à 1200 et 480 px
py tests/kanban/jouer.py attributs-menus      # un seul scénario
py tests/kanban/jouer.py --largeurs 1200 -v   # une largeur, toutes les lignes
```

Le bilan s'affiche par scénario et par largeur (`BILAN 42 OK, 0 KO`), suivi des
lignes en échec. Le code de sortie vaut 0 si tout est OK.

Pour obtenir la page à coller dans le Custom Widget Builder :

```powershell
py tests/kanban/assembler.py    # → tests/kanban/genere/kanban-builder.html
```

## Comment ça marche

| Fichier | Rôle |
|---|---|
| `assembler.py` | Recopie dans `index.html` les styles et scripts locaux (`_commun`, `kanban.js`) : une seule page, comme pour le builder. |
| `faux-grist.js` | Imite l'API Grist (`onRecords`, `fetchTable`…) avec des tables inventées ; note ce que le widget écrit. |
| `scenarios/*.js` | Un scénario par fonction : il manipule le widget comme un utilisateur et écrit un bilan OK / KO. |
| `jouer.py` | Construit une page par scénario, l'ouvre dans le navigateur sans affichage (profil neuf à chaque fois) et lit le bilan. |

Les pages générées vont dans `genere/`, ignoré par Git.

## Ajouter un scénario

Copier un scénario existant dans `scenarios/` et garder sa structure :
`FAUX_GRIST.demarrer()`, puis des appels `ok('ce qui est vérifié', condition)`,
et le bilan final dans `<pre id="resultats">`. Les fonctions du widget
(`ouvrirFenetreVue`, `openEditPanel`…) sont appelables directement.

## Limites connues

- Le navigateur sans affichage ne joue pas `requestAnimationFrame` : le
  placement des menus de `fiche.js` ne s'y vérifie pas (un scénario peut le
  simuler).
- Le faux Grist n'imite que ce dont les scénarios ont besoin. Un défaut qui
  dépend du vrai Grist (droits, colonnes du document réel) ne se verra qu'au
  test dans le builder.

## Sécurité (dépôt public)

- **Données inventées uniquement** : aucun nom réel de personne, d'EPIC ou de
  projet, aucun identifiant de document.
- Aucun secret, aucun chemin propre à un poste.
- Le banc n'écrit jamais dans Grist et ne modifie pas le code des widgets.
