# Widget Galerie (`galerie`)

Affiche les lignes d'une table sous forme de **cartes**, en grille. Un clic sur
une carte ouvre sa **fiche** pour lire et modifier son titre et son texte
principal, écrit en **Markdown**. Les **pastilles** (priorité, projet…) se
modifient d'un clic, sur la carte comme dans la fiche.

Pensé pour les tables qui se lisent mieux en fiches qu'en colonnes de statut :
EPICs, objectifs et résultats clés, projets… Les tâches restent gérées par le
[Kanban](../kanban/), qui partage la même fiche.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure HTML et styles ; charge `galerie.js` |
| `galerie.js` | Logique Grist : réception des données, grille, fiche, écriture |
| [`../_commun/fiche.js`](../_commun/fiche.js), [`fiche.css`](../_commun/fiche.css) | Fiche partagée avec le Kanban : disposition côté / centre, Markdown |
| [`../_commun/pastilles.js`](../_commun/pastilles.js), [`pastilles.css`](../_commun/pastilles.css) | Dessin des pastilles en lecture seule (texte affiché, couleur), commun avec le widget [Page](../page/) ; la modification d'un clic reste dans `galerie.js` |
| [`../_commun/recherche.js`](../_commun/recherche.js) | Règle de recherche commune avec le Kanban |
| [`../_commun/colonnes.js`](../_commun/colonnes.js) | Structure du document (libellés, types, formules, couleurs des choix), commune aux widgets |
| [`../_commun/condition.js`](../_commun/condition.js) | Évaluation des conditions de liste déroulante de Grist (#238) |
| [`../_commun/palette.js`](../_commun/palette.js) | Palette des huit couleurs nommées des cartes (#241) |
| [`../_commun/filtres.js`](../_commun/filtres.js), [`filtres.css`](../_commun/filtres.css) | Règle et panneau des filtres, communs avec le Kanban |
| [`../_commun/tri.js`](../_commun/tri.js), [`tri.css`](../_commun/tri.css) | Comparaison des valeurs selon le type de leur colonne, et panneau du tri ⇅, communs avec le Kanban |
| [`../_commun/vues.js`](../_commun/vues.js), [`vues.css`](../_commun/vues.css) | Vues enregistrées : barre des vues et fenêtre « Gérer la vue », communes avec le Kanban |
| [`../_commun/fenetre.js`](../_commun/fenetre.js), [`fenetre.css`](../_commun/fenetre.css) | Fenêtre à onglets (« Gérer la vue », ⚙ et mode d'emploi « ? ») |
| [`../_commun/messages.js`](../_commun/messages.js), [`messages.css`](../_commun/messages.css) | Petit message (toast) et questions d'abandon « … Les abandonner ? », communs aux widgets (#249) |

## La barre du haut

Même disposition que le Kanban et Interactions (#249) : à gauche, **🖼️ Galerie**
(le type de widget, comme « 📌 Kanban »), suivi en gris du nom de la Galerie
s'il est réglé, sinon du nom de la table (visible aussi au survol), le nombre de
cartes affichées, **?** et **⚙** ; à droite, **🔍 Rechercher** et
**+ Nouvelle carte**.

Le bouton **?** ouvre un court mode d'emploi (cartes, nouvelle carte, vues,
filtres, recherche, ⚙, les deux « Enregistrer »), avec un lien vers ce README.
Contrairement au Kanban, il ne s'ouvre pas de lui-même à la première visite.

La Galerie dépend du dossier `_commun/` : elle ne fonctionne qu'**en mode URL**.

## Déploiement

Par URL (GitHub Pages) :

```
https://nantodevison.github.io/pmd-suite-numerique/widgets/galerie/
```

Voir [../README.md](../README.md#brancher-un-widget-par-url-github-pages) pour
l'avertissement et le niveau d'accès (**accès complet** requis : le widget
écrit le titre, le texte principal et les colonnes de pastilles, et lit la
structure du document pour afficher les libellés et les couleurs des choix,
ainsi que la table visée par une référence quand on ouvre son menu).

Banc d'essai (à jouer avant toute PR qui touche la Galerie ou `_commun/`) :
[`tests/galerie/`](../../tests/galerie/).

## Configuration

Aucune table ni colonne n'est codée en dur. Dans le panneau de droite de Grist,
section **Colonnes** du widget, associer :

| Champ | Obligatoire | Rôle | Exemple (EPICs) |
|---|---|---|---|
| **Titre** | oui | titre de la carte et de la fiche | `Titre` |
| **Texte principal (Markdown)** | non | texte de la fiche (pas sur la carte, mais pris en compte par la recherche) | `Description` |
| **Pastilles (carte et fiche)** | non, plusieurs colonnes possibles | pastilles colorées sur la carte ; dans la fiche, sans libellé, à droite du titre (au centre) ou dessous (sur le côté) ; une liste de références donne une pastille par élément | `Avancement`, `Priorite`, `Projet`, `Chef_de_projet` |
| **Objets liés (sous le titre de la fiche)** | non, plusieurs colonnes possibles (listes de références seulement) | une ligne par colonne sous le titre de la fiche, un élément par pastille blanche | `Taches`, `Retour_U` |
| **Contexte (fiche seulement)** | non, plusieurs colonnes possibles | encart « libellé : valeur » sous l'en-tête de la fiche | `objectifs_resultats_cle` |
| **Couleur des cartes (bleu, vert…)** | non (texte ou choix) | couleur de chaque carte, voir « Couleur des cartes » | `Couleur` |
| **Image (pièce jointe, en haut de la carte)** | non (pièce jointe) | première image de la cellule, en haut des cartes moyennes et grandes, voir « Image des cartes » | `Image` |

Grist ne propose dans chaque champ que les colonnes de type compatible ; une
colonne calculée sans type déclaré (comme `Avancement`) est proposée partout.
La colonne du texte principal est ignorée si elle est aussi choisie ailleurs,
de même qu'une colonne de contexte déjà affichée en pastille ou en objet lié.

**Colonnes non associées** (#239) : inutile d'associer une colonne pour la
filtrer, trier les cartes, les regrouper ou l'afficher en attribut
(« Afficher ▾ »). Grist n'envoie au widget que les colonnes associées ; la
Galerie relit donc la table à chaque changement et complète les cartes avec
les autres colonnes (références sous leur nom affiché, lu dans la colonne
cachée que Grist tient à jour). Seules les cartes envoyées par Grist sont
complétées : « Sélectionner par » reste respecté.

La carte ne montre que le titre et les pastilles : elle doit rester concise.

**Couleur des pastilles** :
- colonne Choix : la couleur du choix réglée dans Grist ; à défaut, un pastel ;
- pourcentage (« 67 % », ou nombre affiché en % dans Grist) : rouge jusqu'à
  33 %, orange jusqu'à 66 %, jaune-vert jusqu'à 99 %, vert à 100 % ;
- référence : un pastel propre à chaque valeur (toujours le même) ;
- autres colonnes : gris neutre ; cellule en erreur : « ⚠️ invalide » en rouge.

## Modifier une pastille (#205, #206)

Un clic sur une pastille (ou Tab puis Entrée) ouvre un petit menu, selon le
type de la colonne :

| Type | Menu |
|---|---|
| Choix | les choix de Grist, dans leur ordre, plus « — aucun — » |
| Choix multiple | les mêmes, en cases à cocher (le menu reste ouvert) |
| Référence | les lignes de la table visée, de A à Z, plus « — aucune — » ; un champ de recherche au-delà de 12 lignes |
| Liste de références | les mêmes lignes, en cases à cocher (le menu reste ouvert) ; au-delà de 12 lignes, un champ de recherche au-dessus des cases (Entrée coche le premier résultat et vide le champ) |
| Case à cocher | « ✓ oui » / « ✗ non » |
| Date | un calendrier, et « Effacer la date » |

- **Sur la carte** : le clic n'ouvre pas la fiche, et le choix est **écrit
  tout de suite** dans Grist, comme une cellule modifiée (Ctrl + Z dans Grist
  pour annuler). Pour une liste (choix multiple, liste de références),
  chaque case cochée est écrite. Les
  pastilles vides ne s'affichent pas : la carte reste concise ; une colonne
  vide se remplit depuis la fiche.
- **Dans la fiche** : chaque colonne modifiable a sa pastille, « + Priorité »
  quand elle est vide. Le choix s'affiche aussitôt mais n'est écrit qu'avec
  « ✓ Sauvegarder », en même temps que le titre et le texte.
- Restent en **lecture seule** : les colonnes calculées par une formule (comme
  `Avancement`), les textes et les nombres.
- La table visée par une référence est **relue à chaque ouverture** du menu :
  un projet ajouté dans Grist est proposé tout de suite. Elle n'est jamais lue
  au chargement du widget.
- **Homonymes** (liste de références) : Grist envoie au widget les noms
  affichés, où deux personnes du même nom se confondent. À l'ouverture du
  menu, le widget relit donc la cellule dans la table, qui donne les numéros
  des lignes : la bonne personne est cochée, et la bonne est écrite.
- **Condition de liste déroulante** (#238) : si la colonne en a une dans
  Grist (par exemple `choice.Projet == $Projet` sur les objectifs), le menu
  ne propose que les options qui la respectent, pour une Référence comme
  pour un Choix. Dans la fiche, les choix pas encore sauvegardés comptent :
  changer le projet, puis ouvrir les objectifs, propose ceux du nouveau
  projet. La valeur actuelle reste toujours proposée, même si elle ne
  respecte plus la condition. Le widget comprend « et », « ou », « non »,
  les comparaisons et « in » ; pour une condition plus complexe (une chaîne
  comme `$Projet.Statut`, une fonction…), il propose tout, comme avant.
  La condition est lue avec la structure du document : une condition
  ajoutée dans Grist compte après un rechargement du widget.
- **Cohérence entre références** : si la carte a deux références dont l'une
  dépend de l'autre (un objectif appartient à un projet), changer l'une
  vérifie l'autre. Changer le projet sans changer l'objectif, ou choisir
  l'objectif d'un autre projet, affiche une alerte « ⚠️ « … » (Objectif)
  relève d'un autre projet que « … » : pensez à le changer ». La
  modification est faite quand même. La règle est lue dans la structure du
  document (la table des objectifs a une colonne qui vise les projets) :
  rien n'est codé en dur. Dans la fiche, les choix pas encore sauvegardés
  comptent.

L'ordre des cartes est celui du tri de la vue Grist, sauf si la vue de la
Galerie a son propre tri (voir plus bas).

Ouvrir une carte déplace le curseur de Grist sur sa ligne : une autre vue peut
donc « Sélectionner par » la Galerie (par exemple, les tâches de l'EPIC ouvert).

## Filtres, tri et vues enregistrées

Mêmes outils que le [Kanban](../kanban/README.md), par les modules communs
`_commun/filtres.js`, `_commun/tri.js` et `_commun/vues.js` (#204, #232). La
barre sous l'en-tête montre les vues (en onglets, ou dans un sélecteur ▾ si
la place manque), « ＋ Vue », « 🔽 Filtres », « ⇅ Trier » et « ▤ Regrouper ».

- **Filtres** : sur toute colonne Choix, Choix multiple, Référence ou Liste de
  références de la table, associée au widget ou non (Projet, Assigné à,
  Priorité…). « est » / « n'est pas », plusieurs valeurs cochées (« ou »),
  plusieurs filtres (« et »). Les choix suivent l'ordre et les couleurs de
  Grist. Pour une référence, « Afficher ▾ » montre des attributs de l'objet
  visé, lus dans les colonnes rapportées de la table (`$Projet.Etat`).
- **Tri** (#232) : sur n'importe quelle colonne de la table, ou le numéro de
  la ligne, jusqu'à 10 critères (« Par…, puis… »). Chaque type est rangé à sa
  façon : choix dans l'ordre de Grist, nombres et dates, textes de A à Z
  (accents ignorés), références sur leur nom. Les cartes sans valeur (ou en
  erreur) restent en bas, quel que soit le sens. Sans tri, ou à égalité,
  l'ordre de la vue Grist départage. « ＋ Ajouter un critère » propose
  d'abord les colonnes de pastilles, puis le titre.
- **Regroupement** (#233) : les cartes sont réparties en zones, une par
  valeur d'une colonne Choix, Choix multiple, Référence, Liste de références
  ou Case à cocher. Zones dans l'ordre des choix de Grist (de A à Z pour une
  référence ; « ✓ oui » puis « ✗ non » pour une case), « ⚠️ invalide » et
  « (vide) » à la fin ; seules les zones non vides s'affichent. Une carte à
  plusieurs valeurs figure dans chacune de ses zones. Dans une zone, les
  cartes suivent le tri de la vue ; filtres et recherche s'appliquent avant.
  Un clic sur l'en-tête d'une zone (▾ / ▸, valeur, nombre de cartes) la
  replie : ce choix est retenu par le navigateur, pour chaque vue, et ne
  modifie pas la vue.
- **Vues** : « Toutes les cartes » (fixe), vues 👥 **partagées** (gardées dans
  le document, puis bouton « Enregistrer » de Grist ; chaque Galerie a les
  siennes) et 🔒 **personnelles** (gardées par le navigateur). ⋯ sur la vue
  active : gérer, renommer, copier en vue perso, supprimer.
- **« Gérer la vue »** (⋯ › Gérer, « 🔽 Filtres », « ⇅ Trier » ou
  « ▤ Regrouper ») : nom, filtres, tri et regroupement ; 💾 enregistre,
  Annuler rétablit la vue telle qu'elle était.
- La recherche 🔍 s'ajoute aux filtres de la vue ; elle n'est jamais enregistrée.
- Le navigateur retient la vue active, les vues perso, les attributs
  affichés, les zones repliées et la taille des cartes, par document, par
  table et par **nom de Galerie** (voir ci-dessous). Deux Galeries sur la
  même table et sans nom (ou de même nom) partagent donc ces réglages-là ;
  leurs vues partagées restent distinctes.

Le filtrage natif de Grist (« Sélectionner par », filtres de la vue Grist)
reste possible : il choisit les lignes envoyées au widget, et nos filtres
s'appliquent ensuite.

### Nom de la Galerie (#264)

Plusieurs Galeries sur la **même table** (par exemple une page par projet,
dupliquée depuis un modèle) partageraient, dans le navigateur de chacun, vue
active, vues 🔒, taille des cartes… Pour les séparer, donner à chacune un
**nom spécifique** dans ⚙ (« EPICs Observatoire » plutôt que « EPICs »),
« Appliquer », puis « Enregistrer » dans Grist. Le nom s'affiche en gris après « 🖼️ Galerie », à la place du nom de la table.

- **Page dupliquée** : la copie hérite du nom ; le changer.
- **Changer de nom** repart de zéro : vues 🔒, vue active, taille et zones
  repliées de l'ancien nom ne sont pas reprises (elles restent retrouvables
  en revenant à l'ancien nom). Les vues 👥 partagées ne changent pas.
- **Sans nom**, rien ne change par rapport aux versions précédentes.
- Pourquoi un nom à saisir ? Le widget ne peut pas lire le numéro de sa
  page (il tourne dans un cadre d'un autre site, et l'API Grist ne le donne
  pas), et un identifiant tiré au hasard serait copié avec la page dupliquée.

## Taille des cartes (#237)

Bouton **« ▦ Moyenne ▾ »** de la barre, trois tailles :

| Taille | La carte montre |
|---|---|
| Compacte | le titre seul ; cartes plus étroites, donc plus nombreuses par ligne |
| Moyenne (par défaut) | le titre, les pastilles et le numéro de la carte (et l'image, si une colonne Image est associée) |
| Grande | en plus, une image plus haute, le début du texte principal (texte simple, 4 lignes au plus) et le nombre d'objets liés (« Tâches 38 ») |

C'est une **préférence personnelle** : retenue par le navigateur pour cette
Galerie (document, table et nom de la Galerie), elle ne change ni les vues ni le document.

## Couleur des cartes (#241)

Pour distinguer les cartes d'un coup d'œil. Il faut une colonne **Texte**
(ou Choix) dans la table, par exemple `Couleur`, associée au champ
**« Couleur des cartes »**. Sans elle, les cartes gardent leur bandeau
violet habituel.

- Chaque carte prend un **bandeau** plus épais à sa couleur et un **fond
  pâle** (la même couleur à 20 % d'opacité, réglable dans `galerie.js` :
  `OPACITE_FOND_CARTE`), parmi huit : bleu, vert, rose, jaune, violet, cyan, orange, gris
  (palette commune, [`../_commun/palette.js`](../_commun/palette.js), celle
  des statuts du Kanban).
- **Couleur automatique** : une carte dont la cellule est vide reçoit une
  couleur tirée de son numéro de ligne (n° 1 bleu, n° 2 vert…). Rien n'est
  écrit dans Grist ; deux cartes qui se suivent n'ont jamais la même
  couleur ; le gris n'est jamais tiré au hasard.
- **Changer la couleur** : la pastille ● en haut à droite de la carte ouvre
  le menu des couleurs. Le choix est écrit tout de suite dans la cellule,
  sous son nom (« bleu »), lisible dans Grist ; « Automatique » vide la
  cellule. On peut aussi taper le nom dans Grist (majuscules acceptées).
- Une valeur qui n'est pas une couleur connue est ignorée (couleur
  automatique), et signalée dans l'infobulle de la pastille ●.
- Colonne calculée par une formule : les cartes prennent la couleur de la
  formule, la pastille ● n'ouvre pas de menu.
- La couleur appartient à la ligne : deux Galeries de la même table
  montrent la même couleur.

## Image des cartes (#241, étape B)

Associer une colonne **pièce jointe** (par exemple `Image`) au champ
**« Image »**. Sans elle, rien ne change.

- La **première image** de la cellule s'affiche en haut de la carte, sur
  toute sa largeur, recadrée pour remplir la bande : 80 px de haut en taille
  moyenne, 140 px en grande, **jamais en compacte**. Les autres fichiers
  (un PDF joint, une seconde image) sont ignorés sur la carte.
- Une carte sans image n'a pas de bande vide : les cartes d'une même rangée
  peuvent donc avoir des hauteurs différentes (comme dans Notion).
- La fiche ne montre pas l'image.
- **Comment c'est lu** : une cellule pièce jointe ne contient que des
  numéros de fichiers. Le widget demande à Grist un **jeton d'accès
  temporaire, en lecture seule** (`getAccessToken`), et télécharge l'image
  sur le serveur Grist du document. Le jeton est renouvelé avant d'expirer ;
  il reste dans le navigateur (jamais écrit dans le document). L'extension
  de chaque fichier est lue dans la table système `_grist_Attachments`, une
  fois, puis seulement quand une pièce jointe nouvelle apparaît.
- Une image illisible (fichier supprimé…) est retirée de la carte, sans
  icône cassée, après un essai avec un jeton neuf ; elle n'est plus
  retentée tant que la liste des pièces jointes n'est pas relue.
- Sécurité : l'image passe par une balise `<img>` (un fichier piégé ne peut
  pas y exécuter de code), et ne vient que du serveur Grist du document.

## Fiche

- **Numéro** (#244) : « Fiche · #12 » dans la barre de la fiche, et « #12 »
  en petit gris en bas à droite des cartes (sauf en taille compacte), comme
  dans le Kanban. C'est le numéro de ligne Grist ; la recherche « #12 » le
  retrouve.
- Disposition **côté** ou **centre**, au choix (bouton ⤢ / ⇥), mémorisée dans
  le navigateur ; Échap, ✕ ou un clic sur le fond assombri la ferment. Au
  centre, la fiche occupe presque tout le cadre du widget (#184) ; les lignes
  de la description restent d'une longueur lisible (~110 caractères).
- Le **titre** et le **texte principal** sont modifiables, puis enregistrés avec
  « ✓ Sauvegarder ». Une colonne calculée par une formule reste en lecture seule.
- En-tête : le titre ; les **pastilles** dans un encart à droite (au centre)
  ou sous le titre (sur le côté), libellé au survol, modifiables (voir plus
  haut) ; dessous, sur toute la largeur, les **objets liés** (« — » si
  aucun) ; puis le **contexte**, même vide (« — »). Références par leur nom affiché, dates au
  format français. Objets liés et contexte sont en lecture seule.
- **Contexte** (#184) : chaque paire « libellé : valeur » prend sa largeur
  naturelle ; une valeur vide ou courte prend peu de place.
- **Objets liés** (#184), par exemple les tâches d'un EPIC, sous une ligne de
  titre « TÂCHES 38 » (libellé et nombre total) :
  - **« Afficher ▾ »**, à droite de cette ligne : cocher des attributs de l'objet
    (son statut, sa priorité…) pour les voir à côté de son nom. Ce sont les
    colonnes « rapportées » de la table, de formule `$Taches.statut` (menu
    de Grist « ajouter une colonne depuis la référence ») ; inutile de les
    associer au widget. Le choix est **personnel**, retenu par le
    navigateur, et commun avec « Afficher ▾ » des filtres ;
  - les objets sont **triés** selon ces attributs, dans l'ordre de leurs
    choix dans Grist (« À faire », « En cours », « Fait »…) : avec
    Priorité et Statut cochés, d'abord par priorité. Couleurs des choix de
    la colonne d'origine ;
  - **au survol**, une bulle donne tous les attributs de l'objet, cochés
    ou non ;
  - **2 lignes au plus** : au-delà, le bouton coloré « + 9 autres ▾ » ouvre
    la liste complète, avec recherche ; un nom est coupé à ~40 caractères
    (en entier dans la bulle) ;
  - un objet de la **même table** que la Galerie (une carte qui renvoie à
    une autre) s'ouvre d'un clic dans sa fiche.
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
- **⚙** : fenêtre commune aux widgets (`fenetre.js`, #249), en deux onglets,
  « Nom de la Galerie » (voir plus haut ; ℹ️ tant qu'il est vide) et
  « Modèle de texte » des nouvelles cartes, en Markdown, enregistré dans
  le document Grist (chaque Galerie a le sien ; rien dans le dépôt).
  « Reprendre le texte de … » copie le texte de la carte ouverte ou
  sélectionnée, pour en faire un squelette. « ✓ Appliquer », puis
  « Enregistrer » dans Grist ; fermer sans appliquer demande confirmation.
- **Pastilles** : elles se choisissent dès la nouvelle fiche (« + Priorité »…)
  et sont écrites avec la carte. Objets liés et contexte se remplissent une
  fois la carte créée (la fiche reste ouverte) ou dans Grist.
- **D'après la vue** (#186, règle commune avec le Kanban) :
  - un filtre « **est** » qui ne coche qu'**une** valeur préremplit la
    colonne, qu'elle soit en pastille ou non ; une colonne préremplie sans
    pastille est annoncée sous l'en-tête (« ℹ️ D'après la vue : Thèmes = Site ») ;
  - dans les menus des pastilles, les valeurs de la vue viennent d'abord,
    puis les autres sous « **Hors de la vue** » (menu de recherche compris) ;
  - un avis prévient, avant « ✓ Sauvegarder », si avec les valeurs choisies
    la carte sera masquée par les filtres de la vue (« ⚠️ … masquée par la
    vue (Projet) ») : filtre à plusieurs valeurs sur une colonne qui n'est pas
    une pastille, valeur choisie hors de la vue…
  - non couvert : les colonnes calculées (inconnues avant la création) et
    « Sélectionner par » de Grist (#243) ; un message signale après coup une
    carte créée mais masquée.

## Limites connues (v1)

- La structure du document (libellés des colonnes, couleurs des choix) est
  lue au premier affichage : un changement dans Grist n'apparaît qu'après
  rechargement du widget (#234). Les noms des références, eux, arrivent avec
  les données et sont toujours à jour.
- Le contexte n'est pas modifiable depuis la fiche (prévu en amélioration).
- La recherche (règle commune avec le Kanban : tous les mots, accents
  ignorés, `#12` pour la ligne n° 12) porte sur toutes les colonnes de la
  table, même masquées dans le widget (#204, comme le Kanban), références
  comprises (sous leur nom affiché) ;
  les nombres, dates et cases à cocher sont ignorés.
