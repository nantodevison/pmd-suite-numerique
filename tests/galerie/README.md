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

## Ce qui est vérifié (508 vérifications par largeur)

| Scénario | Fonctions |
|---|---|
| `cartes` | Grille : titres, pastilles (couleur des choix Grist, échelle des pourcentages, pastel des références, cellule en erreur), compteur, message sans colonne « Titre », clic qui ouvre la fiche et place le curseur de Grist ; structure lue une seule fois, tables visées non lues (#188) |
| `recherche` | Recherche 🔍 (règle commune avec le Kanban) : majuscules et accents, tous les mots, `#numéro`, noms des références, contexte, texte Notepad |
| `filtres-vues` | Filtres et vues enregistrées (#204, modules communs avec le Kanban) : toutes les colonnes reçues, colonnes filtrables, ordre et couleur des choix, attributs d'une référence, compteurs, vue perso et vue partagée, changement de vue, cumul avec la recherche, Annuler dans « Gérer la vue », options rappelées par Grist sans relecture, carte créée masquée par les filtres, Échap |
| `taille` | Taille des cartes (#237) : bouton « ▦ Moyenne ▾ » et menu des trois tailles, compacte (titre seul, plus de cartes par ligne, clic qui ouvre la fiche), grande (début du texte sans les symboles du Markdown, ancien texte Notepad, long texte bien affiché sur 4 lignes même quand la grille déborde, nombre d'objets liés, cartes plus larges), choix retenu par le navigateur sous la clé de la Galerie, gardé après un nouveau dessin, un envoi de Grist et dans les zones de regroupement, vues inchangées |
| `couleurs` | Couleur des cartes (#241) : palette (huit noms, nom reconnu sans majuscules ni espaces, couleur automatique d'après le numéro, deux voisins différents, jamais gris), rien ne change sans colonne associée, couleur écrite, cellule vide, valeur inconnue (signalée dans l'infobulle), bandeau de 6 px et fond pâle, pastille ● qui n'ouvre pas la fiche, menu « Automatique » et huit couleurs avec leur rond et le choix actuel marqué, nom écrit dans la cellule, même couleur sans écriture, « Automatique » qui vide la cellule, zones de regroupement et taille compacte, colonne calculée sans menu, association retirée |
| `images` | Image des cartes (#241, étape B) : rien sans colonne associée (ni jeton, ni lecture de `_grist_Attachments`), jeton toujours en lecture seule, première image de la cellule (PDF ignoré), image réellement chargée, en tête de carte et collée aux bords, 80 px en moyenne et 140 px en grande, aucune en compacte ni dans la fiche, clic qui ouvre la fiche, fichier introuvable (un jeton neuf, un essai, image retirée, plus retentée aux redessins), jeton gardé tant qu'il est valide et renouvelé avant d'expirer, liste des pièces jointes relue seulement pour un numéro inconnu, association retirée |
| `tri` | Tri des cartes (#232, panneau commun avec le Kanban) : ordre de Grist sans tri, « ⇅ Trier » et son résumé, onglet Tri de « Gérer la vue », colonnes proposées (« # Numéro » en tête), critère ajouté sur une pastille, sens selon le type, second critère, ✕, vides et cellule en erreur en bas, tri enregistré dans la vue, Annuler, cumul avec un filtre, colonne disparue, tri mal formé nettoyé, limite de 10 critères, Échap |
| `groupes` | Regroupement en zones repliables (#233) : « ▤ Regrouper », onglet Regrouper, colonnes proposées, zones par Choix (ordre de Grist), Référence (cellule en erreur à la fin), Liste de références (une carte dans plusieurs zones) et Case à cocher, tri et filtre dans les zones, repli retenu par le navigateur pour chaque vue sans modifier la vue, 💾 dans une nouvelle vue et dans une vue existante, Annuler, colonne disparue, valeur mal formée, Échap |
| `pastilles` | Pastilles modifiables (#205, #206). Sur la carte : menu selon le type (Choix, Choix multiple à cases, Référence, Case à cocher, Date et « Effacer la date »), colonne calculée en lecture seule, clic qui n'ouvre pas la fiche, écriture immédiate dans le format de Grist (référence sous son numéro, liste `['L', …]`, vide → `null` ou 0), clavier (Entrée), Échap, cellule en erreur corrigée, table visée lue au clic et relue à chaque ouverture, champ de recherche au-delà de 12 lignes. Dans la fiche : colonnes vides en « + … », choix affichés aussitôt mais écrits par « ✓ Sauvegarder » en une seule action, Échap qui ferme le menu et non la fiche, confirmation avant de perdre un choix |
| `coherence` | Alerte de cohérence entre deux références (chaque version relève d'un projet) : projet changé sans la version, retour au bon projet, carte sans version, version d'un autre projet choisie (l'autre sens), aucune lecture pour un choix simple, choix en attente de la fiche pris en compte ; l'écriture a toujours lieu |
| `colonnes-non-associees` | Colonnes non associées (#239) : Grist n'envoie que l'id et les colonnes associées ; cartes complétées par relecture de la table (case à cocher, formule, colonne rapportée, choix multiple décodé, référence sous son nom par la colonne cachée de Grist sans lire la table visée, ou par la table visée à défaut), cellule en erreur gardée, colonnes internes non ajoutées, tri sur une colonne non associée, valeurs fraîches après une écriture, envoi lent qui ne remplace pas un plus récent |
| `condition` | Condition de liste déroulante de Grist (#238) : évaluateur commun (égalité, « et » avec « != », « ou », « non », « in » une liste ou une liste de références, « < », valeur seule au sens de Python, opération ou chaîne inconnue gardée, un faux l'emporte sur un inconnu), condition lue dans la structure, menus des pastilles sur la carte (versions du projet de la carte, carte relue sous ses numéros, valeur actuelle hors condition gardée), dans la fiche (projet changé non sauvegardé pris en compte), expression inconnue (tout proposé), choix simple et condition retirée |
| `fiche` | En-tête (objets liés, pastilles, contexte, date au format français), cases à cocher, modification et sauvegarde du titre, confirmation avant de perdre une modification, Échap, titre calculé en lecture seule |
| `objets-lies` | En-tête de la fiche (#184) : fiche au centre sur presque tout le cadre, objets liés sous l'en-tête sur toute la largeur (libellé, nombre, « Afficher ▾ » à la fin), encart Contexte souple (une enveloppe par paire), objets liés dans l'ordre de Grist, « Afficher ▾ » (colonne rapportée non associée), bulle avec tous les attributs, statut à côté du nom aux couleurs de la colonne d'origine, tri selon l'ordre des choix, mémoire commune avec les filtres, aucune table lue pour les attributs, longue liste limitée à 2 lignes avec « + n autres ▾ » (liste complète et recherche), objet de la même table ouvert dans sa fiche (confirmation si la carte est modifiée, message si Grist ne l'envoie pas). Non vérifiable ici : le nouveau repli quand la fiche change de largeur (Chrome du banc ne dessine pas d'images) |
| `nom` | Nom de la Galerie (#264) : sans nom, titre et clés de mémoire d'avant ; champ de ⚙ (exemple, aide) ; nom enregistré dans les options sans espaces autour, affiché en gris dans la barre, ajouté aux clés ; on repart de zéro (vue perso de l'ancien nom absente, « Toutes les cartes », taille moyenne), vue partagée et modèle gardés, ancienne mémoire intacte ; vues perso, taille et zones repliées sous la clé du nom ; rappel tardif de Grist sans effet ; retour sans nom (anciens réglages retrouvés) ; Annuler ; modèle seul modifié sans réécrire le nom ; nom piégé affiché comme du texte ; ouverture d'une Galerie déjà nommée |
| `numero` | Numéro des cartes (#244) : « #1 » en petit, collé en bas à droite, dans un pied à lui (ou à droite des objets liés en grande taille), même sur une carte étirée (pastilles restées sous le titre), carte sans pastilles, aucun en taille compacte ; clic qui ouvre la fiche ; « Fiche · #3 » dans la barre de la fiche, rien pour une nouvelle carte ; recherche « #3 » |
| `nouvelle-carte` | « + Nouvelle carte » : modèle de texte, titre exigé, création, carte masquée par un filtre ; ⚙ : reprendre le texte d'une carte (Notepad compris) et l'enregistrer comme modèle |
| `nouvelle-carte-vue` | Nouvelle carte d'après la vue (#186) : pastilles dans la nouvelle fiche (vides, calculée omise), préremplies par un filtre « est » à une valeur, colonne hors pastilles préremplie et annoncée, préremplissage qui n'est pas une modification, menus Choix et Référence rangés avec « Hors de la vue », alerte si la carte sera masquée, valeurs écrites (référence sous son numéro, choix multiple `['L', …]`), filtre à plusieurs valeurs, menu de recherche (séparateur, et retiré par la recherche), carte existante inchangée |
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
| `faux-grist.js` | Imite l'API Grist avec une table d'EPICs inventée (choix colorés, choix multiple, pourcentage, références (dont une vers des versions qui relèvent chacune d'un projet), liste de références (tâches avec un statut, rapporté dans `Taches_statut` ; « Voir aussi » vers d'autres cartes de la même table), case à cocher, titre calculé, texte Notepad, cellule en erreur, couleur des cartes écrite ou calculée, pièces jointes dont un PDF et un fichier manquant). Comme le vrai Grist, il renvoie les cartes au widget après chaque écriture, références sous leur nom et listes décodées, en n'envoyant que l'id et les colonnes associées (#239 ; `FAUX_GRIST.dernierEnvoi` garde le dernier envoi) ; `fetchTable` donne au contraire toutes les colonnes, références sous leur numéro, listes encodées `['L', …]` et la colonne cachée du nom de la version. `FAUX_GRIST.donnees` donne les tables visées (un scénario peut y ajouter des lignes). `FAUX_GRIST.meta` donne la structure du document : un scénario peut y poser une condition de liste déroulante (#238). `FAUX_GRIST.associer({...})` change l'association des colonnes ; `FAUX_GRIST.masquerCreees` imite une vue filtrée ; `FAUX_GRIST.lectures` liste les tables lues ; `FAUX_GRIST.optionsRecords` garde les options passées à `onRecords` ; `FAUX_GRIST.renvoyerOptions(...)` rappelle `onOptions`, comme Grist après un `setOption`. `getAccessToken` rend un jeton inventé (`FAUX_GRIST.jetons` note chaque demande, `FAUX_GRIST.dureeJeton` règle sa durée) et l'adresse du dossier `pieces-jointes`. |
| `pieces-jointes/attachments/<n>/download` | Deux petites images PNG inventées (dégradés de couleur), servies comme par le serveur Grist (même chemin) au scénario `images`. |
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
