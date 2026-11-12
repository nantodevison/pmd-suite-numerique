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

## Ce qui est vérifié (212 vérifications par largeur)

| Scénario | Fonctions |
|---|---|
| `vues` | Vues enregistrées (#196, #214) : créer une vue partagée ou perso, changer de vue, Annuler, colonnes de la vue, supprimer ; onglet actif et vues perso retenus par le navigateur (#202) |
| `liens` | Bloque / Bloquée par (#183, #222) : badges ⛔ / ➡️, bande de la fiche, confirmation avant de terminer une carte bloquée, carte liée créée depuis la fiche, suppression d'une carte liée |
| `tri-recherche` | Tri sur toute colonne et enregistré dans la vue (#211) ; recherche 🔍 (#209) : accents, tous les mots, #numéro, références, colonnes masquées |
| `fiche` | Numéro #id (#203), couleur de statut choisie dans ⚙ (#212), cases à cocher de l'aperçu (#208), sauvegarde et fermeture de la fiche |
| `attributs-filtre` | Panneau des filtres compacté et bouton « Afficher ▾ » (#226, étape 1) |
| `attributs-menus` | Attributs dans les menus de la fiche et de « Nouvelle carte », colonnes masquées reçues (#226, étape 2) |
| `filtres` | Règle des filtres de `_commun/filtres.js` (#191), vérifiée directement sur le module : est / n'est pas, `(vide)`, listes, valeurs proposées et leur ordre, copie et signature des vues, attributs (listes de références, désaccords, couleurs), mémoire des attributs ; dans le Kanban, « 👤 Moi » (#202) ; panneau commun dans « Gérer la vue » : choix dans l'ordre de Grist et à leur couleur (#236), cocher, est / n'est pas, étiquette, supprimer |
| `vues-registre` | Registre des vues de `_commun/vues.js` (#231), vérifié directement sur le module : ouverture (partagées puis perso, vue active retenue ou ancien réglage), rangement par projet (vues d'un autre projet masquées mais toujours réécrites), création partagée ou perso, renommage, suppression, autre projet, mémoire indisponible, écriture refusée ; dans le Kanban, vues enregistrées par la version précédente relues telles quelles (mêmes clés du navigateur) |
| `structure` | Structure du document lue par `_commun/colonnes.js` (#188) : une lecture par rafraîchissement, table des EPICs lue une fois, EPIC créé entre-temps connu à l'ouverture d'une fiche, libellés, colonnes rapportées, ordre et couleurs des choix, listes de ⚙, recherche sans lecture dans Grist, structure illisible sans plantage |

Pour obtenir la page à coller dans le Custom Widget Builder :

```powershell
py tests/kanban/assembler.py    # → tests/kanban/genere/kanban-builder.html
```

## Comment ça marche

Le moteur est commun à tous les bancs d'essai, dans [`../_commun/`](../_commun/) :

| Fichier | Rôle |
|---|---|
| `../_commun/banc.py` | Recopie dans `index.html` les styles et scripts locaux (`_commun`, `kanban.js`) : une seule page, comme pour le builder ; construit une page par scénario, l'ouvre dans le navigateur sans affichage (profil neuf à chaque fois) et lit le bilan. |
| `../_commun/outils-scenario.js` | Outils communs des scénarios : `Banc.ok`, `Banc.demarrer`, `Banc.cartes`… ; remplace `window.confirm` (aucune fenêtre, réponse choisie par le scénario). Une erreur JavaScript du widget compte comme un KO. |
| `assembler.py`, `jouer.py` | Relais vers `banc.py`, pour le Kanban. |
| `faux-grist.js` | Imite l'API Grist (`onRecords`, `fetchTable`…) avec des tables inventées ; note ce que le widget écrit (`FAUX_GRIST.actions`, `FAUX_GRIST.options`) et les tables qu'il lit (`FAUX_GRIST.lectures`) ; `FAUX_GRIST.donnees` permet d'ajouter une ligne en cours de scénario, `FAUX_GRIST.structureIllisible` de simuler un refus de lecture. |
| `scenarios/*.js` | Un scénario par fonction : il manipule le widget comme un utilisateur et écrit un bilan OK / KO. |

Les pages générées vont dans `genere/`, ignoré par Git.

## Ajouter un scénario

Créer `scenarios/<fonction>.js` sur le modèle de `fiche.js` :

```js
Banc.lancer(async () => {
  await Banc.demarrer();                    // options possibles : { couleursStatut: … }
  Banc.ok('quatre cartes affichées', Banc.cartes().length === 4);
  Banc.repondre(false);                     // le prochain confirm() répondra « Annuler »
});
```

Les fonctions du widget (`ouvrirFenetreVue`, `openEditPanel`, `saveEditPanel`…)
sont appelables directement. Si une donnée manque, l'ajouter au faux Grist
(données inventées), puis rejouer **tous** les scénarios.

Pour s'assurer qu'une vérification sert à quelque chose, la faire échouer
une fois : casser la fonction dans une copie du widget, hors du dépôt, et
constater le KO.

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
