# Banc d'essai de la Galerie

Vérifications automatiques du widget [Galerie](../../widgets/galerie/), à jouer
**avant chaque PR qui le modifie**, ou qui modifie `widgets/_commun/` (code
partagé avec le Kanban : jouer alors aussi [son banc](../kanban/)).

Il **ne remplace pas** le test dans le Custom Widget Builder sur une copie du
document : il imite Grist, il ne le remplace pas.

## Lancer le banc

Prérequis : Python 3.10 ou plus, et Chrome ou Edge. Rien à installer.

```powershell
py tests/galerie/jouer.py                     # tous les scénarios, à 1200 et 480 px
py tests/galerie/jouer.py fiche               # un seul scénario
py tests/galerie/jouer.py --largeurs 1200 -v  # une largeur, toutes les lignes
```

Le bilan s'affiche par scénario et par largeur (`BILAN 26 OK, 0 KO`), suivi des
lignes en échec. Le code de sortie vaut 0 si tout est OK.

## Ce qui est vérifié (225 vérifications par largeur)

| Scénario | Fonctions |
|---|---|
| `cartes` | Grille : titres, pastilles (couleur des choix Grist, échelle des pourcentages, pastel des références, cellule en erreur), compteur, message sans colonne « Titre », clic qui ouvre la fiche et place le curseur de Grist ; structure lue une seule fois, tables visées non lues (#188) |
| `recherche` | Recherche 🔍 (règle commune avec le Kanban) : majuscules et accents, tous les mots, `#numéro`, noms des références, contexte, texte Notepad |
| `filtres-vues` | Filtres et vues enregistrées (#204, modules communs avec le Kanban) : toutes les colonnes reçues, colonnes filtrables, ordre et couleur des choix, attributs d'une référence, compteurs, vue perso et vue partagée, changement de vue, cumul avec la recherche, Annuler dans « Gérer la vue », options rappelées par Grist sans relecture, carte créée masquée par les filtres, Échap |
| `tri` | Tri des cartes (#232, panneau commun avec le Kanban) : ordre de Grist sans tri, « ⇅ Trier » et son résumé, onglet Tri de « Gérer la vue », colonnes proposées (« # Numéro » en tête), critère ajouté sur une pastille, sens selon le type, second critère, ✕, vides et cellule en erreur en bas, tri enregistré dans la vue, Annuler, cumul avec un filtre, colonne disparue, tri mal formé nettoyé, limite de 10 critères, Échap |
| `groupes` | Regroupement en zones repliables (#233) : « ▤ Regrouper », onglet Regrouper, colonnes proposées, zones par Choix (ordre de Grist), Référence (cellule en erreur à la fin), Liste de références (une carte dans plusieurs zones) et Case à cocher, tri et filtre dans les zones, repli retenu par le navigateur pour chaque vue sans modifier la vue, 💾 dans une nouvelle vue et dans une vue existante, Annuler, colonne disparue, valeur mal formée, Échap |
| `fiche` | En-tête (objets liés, pastilles, contexte, date au format français), cases à cocher, modification et sauvegarde du titre, confirmation avant de perdre une modification, Échap, titre calculé en lecture seule |
| `nouvelle-carte` | « + Nouvelle carte » : modèle de texte, titre exigé, création, carte masquée par un filtre ; ⚙ : reprendre le texte d'une carte (Notepad compris) et l'enregistrer comme modèle |
| `notepad` | Anciens textes Notepad : bandeau, texte affiché converti, conversion en une seule écriture après confirmation |

Pour obtenir la page à coller dans le Custom Widget Builder :

```powershell
py tests/galerie/assembler.py    # → tests/galerie/genere/galerie-builder.html
```

## Comment ça marche

Le moteur est commun à tous les bancs d'essai : voir
[`../_commun/banc.py`](../_commun/banc.py) et
[`../_commun/outils-scenario.js`](../_commun/outils-scenario.js), décrits dans le
[README du banc du Kanban](../kanban/README.md#comment-ça-marche).

Propre à la Galerie :

| Fichier | Rôle |
|---|---|
| `faux-grist.js` | Imite l'API Grist avec une table d'EPICs inventée (choix colorés, pourcentage, référence, liste de références, case à cocher, titre calculé, texte Notepad, cellule en erreur). Comme le vrai Grist, il renvoie les cartes au widget après chaque écriture. `FAUX_GRIST.associer({...})` change l'association des colonnes ; `FAUX_GRIST.masquerCreees` imite une vue filtrée ; `FAUX_GRIST.lectures` liste les tables lues ; `FAUX_GRIST.optionsRecords` garde les options passées à `onRecords` ; `FAUX_GRIST.renvoyerOptions(...)` rappelle `onOptions`, comme Grist après un `setOption`. |
| `scenarios/*.js` | Un scénario par fonction. |
| `assembler.py`, `jouer.py` | Relais vers `../_commun/banc.py`. |

Pour ajouter un scénario, voir le [banc du Kanban](../kanban/README.md#ajouter-un-scénario) :
même principe (`Banc.lancer`, `Banc.demarrer`, `Banc.ok`). Les fonctions du
widget (`ouvrirFiche`, `fermerFiche`, `ouvrirReglages`…) sont appelables
directement.

## Sécurité (dépôt public)

- **Données inventées uniquement** : aucun nom réel de personne, d'EPIC ou de
  projet, aucun identifiant de document.
- Aucun secret, aucun chemin propre à un poste.
- Le banc n'écrit jamais dans Grist et ne modifie pas le code des widgets.
