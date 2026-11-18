# Banc d'essai du widget Page

Vérifications automatiques du widget [Page](../../widgets/page/), à jouer
**avant chaque PR qui le modifie**, ou qui modifie `widgets/_commun/` (code
partagé : jouer alors aussi les bancs de la [Galerie](../galerie/) et du
[Kanban](../kanban/)).

Il **ne remplace pas** le test dans le Custom Widget Builder sur une copie du
document : il imite Grist, il ne le remplace pas.

## Lancer le banc

Prérequis : Python 3.10 ou plus, et Chrome ou Edge. Rien à installer.

```powershell
py tests/page/jouer.py                     # tous les scénarios, à 1200 et 480 px
py tests/page/jouer.py texte               # un seul scénario
py tests/page/jouer.py --largeurs 1200 -v  # une largeur, toutes les lignes
```

Pour obtenir la page à coller dans le Custom Widget Builder :

```powershell
py tests/page/assembler.py    # → tests/page/genere/page-builder.html
```

## Ce qui est vérifié

| Scénario | Fonctions |
|---|---|
| `reglages` | Fenêtre ⚙ : ouverte d'office sans critère, message et bouton ; colonnes proposées (n° de ligne en tête, puis A → Z, sans liste ni colonne interne) ; valeurs proposées (n° de ligne avec le titre, textes sans doublon ni vide, nombres rangés, référence sous son nom, case à cocher oui / non) ; résultat en direct et état de l'onglet ; « Appliquer » refusé sans valeur ou avec deux lignes ; critères enregistrés en valeurs brutes ; rappel « Enregistrer » ; options relues une seule fois ; Annuler ; ligne masquée par la vue Grist ; valeur introuvable signalée |
| `affichage` | Titre, pastilles (couleur du choix, pastel, libellé au survol), Markdown mis en forme et cases à cocher, curseur de Grist placé une fois ; critère sur une référence renommée ; aucune ligne, deux lignes, colonne disparue, options mal formées ; sans Titre, sans pastilles, sans texte ; texte calculé en lecture seule, colonne vide modifiable ; texte piégé (script, `onerror`, lien `javascript:`) neutralisé ; table illisible |
| `texte` | Saisie et barre de sauvegarde ; envoi de Grist qui n'efface pas la saisie ; sauvegarde de la seule colonne du texte ; Annuler (non / oui) ; Ctrl + S ; case cochée dans l'aperçu puis sauvegardée ; changement de ligne avec un texte non sauvegardé (confirmation) |

## Comment ça marche

Le moteur est commun à tous les bancs d'essai : voir
[`../_commun/banc.py`](../_commun/banc.py) et
[`../_commun/outils-scenario.js`](../_commun/outils-scenario.js), décrits dans le
[README du banc du Kanban](../kanban/README.md#comment-ça-marche).

Propre à la Page :

| Fichier | Rôle |
|---|---|
| `faux-grist.js` | Imite l'API Grist avec une table de projets inventée (4 lignes, dont deux au même titre ; choix coloré ou non, référence vers des contacts avec sa colonne cachée de nom affiché, nombre, case à cocher, texte calculé, colonne vide, choix multiple, texte piégé). Comme le vrai Grist, `onRecords` n'envoie que l'id et les colonnes associées, et `fetchTable` toutes les colonnes, références sous leur numéro. `FAUX_GRIST.masquees` imite un filtre de la vue Grist, `FAUX_GRIST.modifier` un changement fait dans Grist, `FAUX_GRIST.associer` une autre association, `FAUX_GRIST.tableIllisible` un refus de lecture ; `FAUX_GRIST.curseurs` garde les positions demandées. |
| `scenarios/*.js` | Un scénario par fonction. Le widget ne lit ses options qu'une fois : avant chaque nouveau départ, les scénarios remettent `ETAT.criteres` à `null`. |
| `assembler.py`, `jouer.py` | Relais vers `../_commun/banc.py`. |

## Sécurité (dépôt public)

- **Données inventées uniquement** : aucun nom réel de personne, de projet ou
  de structure, aucun identifiant de document.
- Aucun secret, aucun chemin propre à un poste.
- Le banc n'écrit jamais dans Grist et ne modifie pas le code des widgets.
