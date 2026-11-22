# Banc d'essai du widget Interactions

Vérifications automatiques du widget [Interactions](../../widgets/interactions/),
à jouer **avant chaque PR qui le modifie**, ou qui modifie `widgets/_commun/`
(code partagé : jouer alors aussi les bancs des autres widgets).

Il **ne remplace pas** le test dans le Custom Widget Builder sur une copie du
document : il imite Grist, il ne le remplace pas.

## Lancer le banc

Prérequis : Python 3.10 ou plus, et Chrome ou Edge. Rien à installer.

```powershell
py tests/interactions/jouer.py                     # tous les scénarios, à 1200 et 480 px
py tests/interactions/jouer.py fiche               # un seul scénario
py tests/interactions/jouer.py --largeurs 1200 -v  # une largeur, toutes les lignes
```

Pour obtenir la page à coller dans le Custom Widget Builder :

```powershell
py tests/interactions/assembler.py    # → tests/interactions/genere/interactions-builder.html
```

## Ce qui est vérifié (123 vérifications par largeur)

| Scénario | Fonctions |
|---|---|
| `barre` | Barre du haut commune (#249) : ordre (titre, nombre, ?, ⚙, création), « 🤝 Interactions » et le projet en gris, barre collée en haut, plus de ⚙ flottant ; sans projet, ni nombre ni bouton de création ; nom de projet piégé affiché comme du texte ; mode d'emploi « ? » (fenêtre commune sans colonne d'onglets, texte, lien vers le README, « Fermer »), Échap qui ne ferme que l'aide, fiche ouverte derrière |
| `reglages` | Fenêtre ⚙ : ouverte d'office sans projet, message et bouton ; projets proposés de A à Z ; état de l'onglet ; « Appliquer » refusé sans projet ; projet enregistré sous son numéro, libellé du bouton ; rappel « Enregistrer » ; options lues une seule fois ; Annuler ; projet disparu signalé ; options mal formées |
| `liste` | Filtre sur le projet (liste de références, référence simple, interaction de deux projets) ; ordre du plus récent au plus ancien, sans date à la fin ; filtre de la vue Grist ; date et heure de Paris (hiver, été), date sans heure ; pastille du type (couleur de Grist, pastel) ; personnes ; lien `https` seulement, sans ouvrir la fiche ; titre piégé affiché comme du texte ; projet sans interaction ; colonnes facultatives absentes, obligatoires manquantes ; table illisible ; changement fait dans Grist ; Entrée au clavier |
| `fiche` | Valeurs affichées ; titre, date, type, personnes modifiés (seules ces colonnes écrites, date en secondes du fuseau de Paris, liste `['L', …]`, `null` sans personne) ; lien non reconnu averti ; fiche restée ouverte après la sauvegarde et redessinée à jour ; fermeture avec confirmation (✕, Échap) ; création (titre exigé, date du moment, projet en liste ou en référence simple, AddRecord, fiche restée ouverte sur la ligne créée, modification enchaînée) ; date sans heure (minuit universel) ; lien calculé en lecture seule ; Ctrl + S ; personne ajoutée dans Grist proposée ; Échap ferme d'abord le menu ; envoi de Grist pendant une saisie |

## Comment ça marche

Le moteur est commun à tous les bancs d'essai : voir
[`../_commun/banc.py`](../_commun/banc.py) et
[`../_commun/outils-scenario.js`](../_commun/outils-scenario.js), décrits dans le
[README du banc du Kanban](../kanban/README.md#comment-ça-marche).

Propre aux Interactions :

| Fichier | Rôle |
|---|---|
| `faux-grist.js` | Imite l'API Grist avec trois tables inventées : Interactions (6 lignes : deux projets, une interaction commune aux deux, une sans titre ni date, un titre et un lien piégés), Contacts et Projets. `onRecords` envoie l'id et les colonnes associées, `fetchTable` toutes les colonnes en valeurs brutes (références sous leur numéro, dates en secondes). Colonnes en plus pour d'autres associations : référence simple, date sans heure, lien calculé. `FAUX_GRIST.masquees` imite un filtre de la vue Grist, `FAUX_GRIST.modifier` un changement fait dans Grist, `FAUX_GRIST.ajouterContact` une personne ajoutée dans Grist, `FAUX_GRIST.tableIllisible` un refus de lecture. |
| `scenarios/*.js` | Un scénario par fonction. Le widget ne lit ses options qu'une fois : avant chaque nouveau départ, les scénarios remettent `ETAT.reglages` à `null`. |
| `assembler.py`, `jouer.py` | Relais vers `../_commun/banc.py`. |

## Sécurité (dépôt public)

- **Données inventées uniquement** : aucun nom réel de personne, de projet ou
  de structure, aucun identifiant de document (les liens pointent vers
  `exemple.org`).
- Aucun secret, aucun chemin propre à un poste.
- Le banc n'écrit jamais dans Grist et ne modifie pas le code des widgets.
