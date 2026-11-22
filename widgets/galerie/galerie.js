/* ══════════════════════════════════════════════════════════════
   GALERIE GRIST — galerie.js

   Affiche les lignes d'une table sous forme de cartes. Un clic sur une
   carte ouvre sa « fiche » (sur le côté ou au centre, voir
   ../_commun/fiche.js) pour lire et modifier son titre et son texte
   principal, écrit en Markdown.

   GÉNÉRIQUE : aucune table ni colonne n'est codée en dur. Les colonnes
   s'associent dans le panneau de droite de Grist (section « Colonnes » du
   widget) :
     - Titre        (obligatoire)
     - Description  (facultatif) : texte principal, en Markdown ;
     - Pastilles    (facultatif, plusieurs colonnes possibles) : pastilles
                    colorées, sur la carte ET en tête de la fiche ;
     - ObjetsLies   (facultatif, listes de références) : les tâches d'un
                    EPIC, les EPICs d'un projet… sous le titre de la fiche ;
     - Contexte     (facultatif, plusieurs colonnes possibles) : rappelé en
                    en-tête de la fiche seulement, avec son libellé.
   La carte ne montre que le titre et les pastilles ; le texte principal
   se lit dans la fiche. La recherche porte sur toutes les colonnes,
   comme dans le Kanban (règle commune : ../_commun/recherche.js).
   Couleur d'une pastille : celle du choix dans Grist pour une colonne
   Choix ; une échelle du rouge au vert pour un pourcentage ; sinon un
   pastel fixe propre à chaque valeur.
   Filtres et vues enregistrées (#204), communs avec le Kanban
   (../_commun/filtres.js et ../_commun/vues.js) : on filtre sur n'importe
   quelle colonne Choix ou Référence de la table, et on garde ses réglages
   dans des vues 👥 partagées ou 🔒 personnelles. Le filtrage natif de Grist
   (« Sélectionner par », filtres de la vue Grist) reste possible : il
   choisit les lignes envoyées au widget, nos filtres s'appliquent ensuite.
   Tri (#232), commun avec le Kanban (../_commun/tri.js) : sur n'importe
   quelle colonne de la table, enregistré dans la vue. Sans tri, ou à
   égalité, les cartes gardent l'ordre envoyé par Grist (tri de la vue Grist).
   Regroupement (#233) : les cartes sont réparties en zones repliables, une
   par valeur d'une colonne Choix, Référence ou Case à cocher ; la colonne
   est enregistrée dans la vue, les zones repliées par le navigateur.
   Taille des cartes (#237) : compacte, moyenne ou grande (avec le début du
   texte et le nombre d'objets liés), au choix de chacun (navigateur).
   Couleur des cartes (#241) : si une colonne « Couleur » (texte) est
   associée, chaque carte prend une couleur de la palette commune
   (../_commun/palette.js) : celle écrite dans la cellule (« bleu »…), ou à
   défaut une couleur automatique tirée de son numéro. La pastille ● de la
   carte ouvre le menu des couleurs, qui écrit le nom choisi dans la cellule.
   Image des cartes (#241, étape B) : si une colonne « pièce jointe » est
   associée, la première image qu'elle contient s'affiche en haut des cartes
   moyennes et grandes (pas en compacte, ni dans la fiche).
   ══════════════════════════════════════════════════════════════ */

'use strict';

const ETAT = {
  lignes:     [],     // lignes reçues de Grist, complétées des colonnes non associées (#239)
  colonnes:   null,   // association : { Titre: 'colId', Description: 'colId', Pastilles: [...], Contexte: [...] }
  table:      null,   // identifiant de la table affichée
  docNom:     null,   // identifiant du document (clés de mémoire du navigateur)
  // Filtres affichés (format de ../_commun/filtres.js) et tri affiché
  // (format de ../_commun/tri.js : [{ col, sens }], #232)
  filtres:    [],
  tri:        [],
  // Colonne de regroupement affichée (#233), ou null : cartes non regroupées
  groupe:     null,
  // Taille des cartes affichée (#237) : 'compacte', 'moyenne' ou 'grande'
  taille:     null,
  // Colonnes de la table, d'après la structure du document (#204) :
  // toutes (pour le tri et les attributs d'une référence), celles qu'on
  // peut filtrer, et celles qui peuvent regrouper les cartes (#233)
  colonnesTable:      [],
  colonnesFiltrables: [],
  colonnesGroupables: [],
  optionsChargees: false,   // vues lues à l'ouverture seulement (voir onOptions)
  // Structure du document (libellés, types, couleurs des choix…), lue une
  // fois par table affichée : voir ../_commun/colonnes.js
  doc:        null,
  recherche:  '',     // texte saisi dans la recherche (règle : ../_commun/recherche.js)
  selection:  null,   // numéro de la ligne sélectionnée dans Grist
  // Carte affichée dans la fiche : numéro de ligne (null pour une nouvelle
  // carte, pas encore créée dans Grist) et colonnes modifiées : modifs dans
  // le format qu'attend Grist (écrit par « ✓ Sauvegarder »), apercu dans
  // celui qu'il renvoie, pour afficher les pastilles choisies (#206).
  // vue : pour une nouvelle carte, ce que la vue active lui impose (#186),
  // voir preparerVueNouvelleCarte ; null pour une carte existante.
  fiche:      { id: null, nouvelle: false, modifs: {}, apercu: {}, vue: null },
  modele:     '',     // texte de départ des nouvelles cartes (réglage ⚙)
  // Nom de cette Galerie (réglage ⚙, #264), '' si aucun : il entre dans les
  // clés de mémoire du navigateur (voir cleMemoire)
  nomGalerie: '',
};

/* Registre des vues enregistrées (#204), commun avec le Kanban : voir
   ../_commun/vues.js. Vues 👥 partagées dans les options du widget (chaque
   Galerie a les siennes), vues 🔒 perso et vue active dans le navigateur.
   Pas de contexte (la Galerie n'a pas de projet) : toutes les vues
   s'affichent. Créé ici, avant que Grist n'appelle onOptions. */
const VUES = Vues.creer({
  cle: (nom) => cleMemoire(nom),
  prevenir: (message, duree) => afficherToast(message, duree),
});

/* Attributs affichés à côté des valeurs d'une référence (ex. le statut de
   chaque tâche), retenus par le navigateur : la même mémoire sert au panneau
   des filtres (#223) et aux objets liés de la fiche (#184). */
const MEMOIRE_ATTRIBUTS = Filtres.memoireAttributs(() => cleMemoire('attributs'));

/**
 * Clé de mémoire du navigateur pour la donnée `nom` ('vueActive',
 * 'vuesPerso', 'attributs', 'groupesReplies'), ou null si le document est encore inconnu.
 * Tous les widgets publiés sur nantodevison.github.io partagent cette
 * mémoire : la clé contient donc le document et la table, et le nom de
 * cette Galerie s'il est réglé dans ⚙ (#264).
 *
 * Pourquoi un nom saisi par l'utilisateur ? Sans lui, deux Galeries sur la
 * même table (une page par projet, par exemple) partagent vue active, vues
 * perso, taille des cartes… Le widget ne peut pas se distinguer seul : il ne
 * voit pas l'adresse de sa page (cadre d'un autre site) et l'API Grist ne la
 * donne pas ; un identifiant tiré au hasard serait copié avec la page
 * dupliquée. Sans nom, la clé reste celle d'avant #264.
 * NE PAS CHANGER le format de ces clés : chacun perdrait ses vues perso.
 */
function cleMemoire(nom) {
  if (!ETAT.docNom || !ETAT.table) return null;
  const cle = `galerie.${nom}.${ETAT.docNom}.${ETAT.table}`;
  return ETAT.nomGalerie ? `${cle}.${ETAT.nomGalerie}` : cle;
}

/* ══════════════════════════════════════════════════════════════
   1. LIEN AVEC GRIST
   ══════════════════════════════════════════════════════════════ */

// grist.ready() doit précéder tout autre appel à l'API Grist.
grist.ready({
  requiredAccess: 'full',   // le widget écrit le titre, la description et les pastilles
  columns: [
    { name: 'Titre',       title: 'Titre', type: 'Text' },
    { name: 'Description', title: 'Texte principal (Markdown)', type: 'Text', optional: true },
    // « type » limite les colonnes proposées par Grist. Une liste de
    // références (RefList) peut aller en pastilles (une par élément, ex.
    // les chefs d'un projet) ou dans « Objets liés » (ex. les tâches d'un
    // EPIC, avec leurs attributs). Une colonne calculée sans type déclaré
    // (« Any », comme Avancement) reste proposée partout.
    { name: 'Pastilles',   title: 'Pastilles (carte et fiche)', allowMultiple: true, optional: true,
      type: 'Text,Numeric,Int,Bool,Date,DateTime,Choice,ChoiceList,Ref,RefList' },
    { name: 'ObjetsLies',  title: 'Objets liés (sous le titre de la fiche)', allowMultiple: true, optional: true,
      type: 'RefList' },
    { name: 'Contexte',    title: 'Contexte (fiche seulement)', allowMultiple: true, optional: true },
    // Couleur des cartes (#241) : la cellule contient le nom d'une couleur
    // (« bleu », « vert »…) ; vide = couleur automatique.
    { name: 'Couleur',     title: 'Couleur des cartes (bleu, vert…)', optional: true, type: 'Text,Choice' },
    // Image des cartes (#241, étape B) : colonne « pièce jointe » ; la
    // première image s'affiche en haut des cartes moyennes et grandes.
    { name: 'Image',       title: 'Image (pièce jointe, en haut de la carte)', optional: true, type: 'Attachments' },
  ],
});

// Identifiants du document et de la table, lus une fois au chargement : ils
// composent les clés de mémoire du navigateur (vues perso, vue active). On
// garde la « promesse » pour pouvoir les attendre avant de lire les vues.
const _identitePrete = (async () => {
  try { ETAT.docNom = await grist.docApi.getDocName(); }
  catch (err) { console.warn('Galerie – nom du document introuvable :', err); }
  try { ETAT.table = ETAT.table || await grist.getTable().getTableId(); }
  catch (err) { console.warn('Galerie – nom de la table introuvable :', err); }
})();

// Numéro du dernier envoi de Grist : si un envoi arrive pendant qu'on
// complète le précédent, seul le plus récent est affiché.
let _dernierEnvoi = 0;

// Grist n'envoie au widget que les colonnes ASSOCIÉES (Titre, Pastilles…) :
// includeColumns 'normal' est sans effet dès qu'un widget déclare des
// associations (constaté en production, #239). completerLignes ajoute les
// autres, dont les filtres, le tri, le regroupement et les attributs ont
// besoin. L'option reste demandée : elle ne coûte rien.
grist.onRecords(async (lignes, colonnes) => {
  const envoi = ++_dernierEnvoi;
  ETAT.colonnes = colonnes;
  try {
    await chargerInfosColonnes();
  } catch (err) {
    // Sans ces informations, le widget fonctionne quand même : libellés =
    // identifiants des colonnes, pastilles sans les couleurs de Grist, et
    // pas de filtre (on ne sait pas quelles colonnes sont des choix).
    console.error('Galerie – lecture de la structure impossible :', err);
  }
  const completes = await completerLignes(lignes);
  await preparerImages(completes);       // jeton d'accès et types des pièces jointes (#241)
  if (envoi !== _dernierEnvoi) return;   // un envoi plus récent est arrivé entre-temps
  ETAT.lignes = completes;
  afficherGrille();
  // Fiche ouverte sans modification en cours : on la rafraîchit avec les
  // nouvelles valeurs (par exemple juste après une sauvegarde).
  if (ETAT.fiche.id !== null && !ficheModifiee()) remplirFiche(ETAT.fiche.id);
}, { includeColumns: 'normal' });

// Réglages du widget, enregistrés dans le document Grist (grist.setOption) :
// chaque Galerie (EPICs, OKR…) garde les siens.
grist.onOptions(async (options) => {
  ETAT.modele = (options && options.modele) || '';
  // Vues enregistrées (#204) : lues à l'ouverture seulement. Grist rappelle
  // onOptions après chaque setOption (une vue partagée créée, le modèle…),
  // parfois dans le désordre : relire ramènerait un état périmé. Le widget
  // étant seul à les écrire, sa copie en mémoire fait foi.
  if (ETAT.optionsChargees) return;
  ETAT.optionsChargees = true;   // tout de suite : onOptions peut revenir pendant l'attente
  // Nom de la Galerie (#264), lu lui aussi à l'ouverture seulement : il
  // change les clés de mémoire, un rappel tardif ne doit pas les déplacer.
  ETAT.nomGalerie = nettoyerNomGalerie(options && options.nom);
  await _identitePrete;           // les clés de mémoire en dépendent
  VUES.charger(options && options.vues);
  appliquerVue();
  afficherGrille();
});

grist.onRecord((ligne) => {
  ETAT.selection = ligne ? ligne.id : null;
  document.querySelectorAll('.carte').forEach(c =>
    c.classList.toggle('selectionnee', Number(c.dataset.id) === ETAT.selection));
});

/**
 * Lit la structure du document (libellés, types, formules, couleurs des
 * choix : ../_commun/colonnes.js), une fois par table affichée.
 * Les noms des références n'ont pas à être lus : Grist les envoie déjà.
 */
async function chargerInfosColonnes() {
  const table = await grist.getTable().getTableId();
  if (table !== ETAT.table) { ETAT.table = table; ETAT.doc = null; }
  if (!ETAT.doc) {
    ETAT.doc = await Colonnes.lireDocument();
    preparerColonnesFiltrables();
  }
}

/**
 * Complète les cartes reçues de Grist avec les colonnes NON associées (#239).
 * On relit la table (fetchTable donne toutes ses colonnes), puis chaque carte
 * reçoit, par son numéro, les valeurs qui lui manquent, au format d'onRecords
 * pour que le reste du widget ne voie aucune différence :
 *   - liste « encodée » ['L', a, b] → [a, b] ;
 *   - référence : son NOM affiché, lu dans la colonne cachée de Grist
 *     (colAffichage), sinon dans la table visée.
 * Seules les cartes envoyées par Grist sont complétées : « Sélectionner
 * par » et les filtres de la vue Grist restent respectés.
 * En cas d'échec, les cartes sont gardées telles quelles.
 */
async function completerLignes(lignes) {
  if (!ETAT.doc || !lignes.length) return lignes;
  const recues = new Set(Object.keys(lignes[0]));
  const manquantes = ETAT.doc.colonnes(ETAT.table).filter(c => !recues.has(c.colId));
  if (!manquantes.length) return lignes;
  try {
    const table = await grist.docApi.fetchTable(ETAT.table);
    const rang = new Map(table.id.map((id, i) => [id, i]));   // numéro de carte → rang dans la table
    const convertir = {};
    for (const c of manquantes) {
      if (c.colId in table) convertir[c.colId] = await convertisseur(c, table);
    }
    return lignes.map(ligne => {
      const i = rang.get(ligne.id);
      if (i === undefined) return ligne;
      const complete = { ...ligne };
      Object.entries(convertir).forEach(([colId, f]) => { complete[colId] = f(table[colId][i], i); });
      return complete;
    });
  } catch (err) {
    console.warn('Galerie – colonnes non associées illisibles :', err);
    return lignes;
  }
}

/** Liste « encodée » par Grist ['L', a, b…] → [a, b…] ; autre valeur inchangée. */
function decoderListe(v) {
  return Array.isArray(v) && v[0] === 'L' ? v.slice(1) : v;
}

/**
 * Fonction (valeur, rang) → valeur au format d'onRecords, pour la colonne `c`
 * lue par fetchTable dans `table`.
 */
async function convertisseur(c, table) {
  const estRef = c.typeBase === 'Ref' || c.typeBase === 'RefList';
  // Une référence qui n'affiche aucune colonne montre son numéro : rien à traduire.
  if (!estRef || !c.colAffichee) return (v) => decoderListe(v);
  // 1. Le nom affiché, déjà calculé par Grist dans sa colonne cachée
  const noms = c.colAffichage && table[c.colAffichage];
  if (noms) return (v, i) => (estErreur(v) ? v : decoderListe(noms[i]));
  // 2. À défaut, on lit la table visée. Lecture mémorisée avec la structure :
  //    un nom changé dans Grist n'apparaît qu'au rechargement du widget.
  const ref = await Colonnes.lireReference(ETAT.doc, ETAT.table, c.colId);
  const nom = (id) => (id ? ref.nom(id) || String(id) : '');
  return (v) => {
    if (estErreur(v)) return v;
    const brute = decoderListe(v);
    return Array.isArray(brute) ? brute.map(nom) : nom(brute);
  };
}

/**
 * Colonnes de la table pour les filtres (#204), d'après la structure du
 * document. Seules les colonnes Choix, Choix multiple, Référence et Liste
 * de références sont filtrables (même règle que le Kanban). Une colonne
 * « rapportée » d'une autre table ($Projet.Statut) est nommée
 * « Projet › Statut » : elle sert d'attribut à sa référence (#223).
 */
function preparerColonnesFiltrables() {
  ETAT.colonnesTable = ETAT.doc.colonnes(ETAT.table).map(c => {
    const r = c.rapportee;
    const reference = r && ETAT.doc.colonne(ETAT.table, r.colRef);
    return {
      colId:    c.colId,
      type:     c.type,
      label:    r ? `${r.via} › ${r.attribut}` : c.libelle,
      ref:      r ? r.colRef : null,     // référence dont elle est un attribut
      attribut: r ? r.attribut : null,   // libellé court de l'attribut
      // Colonne d'origine ($Taches.statut → Taches.statut) : ses choix
      // ordonnent les objets liés, ses couleurs colorent l'attribut (#184)
      source:   reference ? ETAT.doc.colonne(reference.tableVisee, r.colSource) : null,
    };
  }).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  ETAT.colonnesFiltrables = ETAT.colonnesTable
    .filter(c => /^(Choice|ChoiceList|Ref:.+|RefList:.+)$/.test(c.type));
  // Regroupement (#233) : les mêmes, plus les cases à cocher (oui / non)
  ETAT.colonnesGroupables = ETAT.colonnesTable
    .filter(c => /^(Choice|ChoiceList|Ref:.+|RefList:.+|Bool)$/.test(c.type));
}

/* ══════════════════════════════════════════════════════════════
   2. LECTURE DES VALEURS
   ══════════════════════════════════════════════════════════════ */

/**
 * Description d'une colonne de la table affichée (voir ../_commun/colonnes.js),
 * ou une description minimale si la structure n'a pas pu être lue.
 */
function info(colId) {
  return (ETAT.doc && ETAT.doc.colonne(ETAT.table, colId))
    || { libelle: colId, type: '', formule: false, couleurs: {}, pourcentage: false };
}

/**
 * Colonnes associées sous un nom (« Pastilles », « ObjetsLies »,
 * « Contexte »), toujours en liste, sans la colonne du texte principal
 * (déjà affichée en grand).
 */
function colonnesAssociees(nom) {
  const c = ETAT.colonnes && ETAT.colonnes[nom];
  const liste = Array.isArray(c) ? c : (c ? [c] : []);
  return liste.filter(colId => colId !== ETAT.colonnes.Description);
}
function colonnesPastilles()  { return colonnesAssociees('Pastilles'); }
function colonnesObjetsLies() { return colonnesAssociees('ObjetsLies'); }
/** Contexte, sans les colonnes déjà affichées en pastilles ou en objets liés. */
function colonnesContexte() {
  const dejaAffichees = [...colonnesPastilles(), ...colonnesObjetsLies()];
  return colonnesAssociees('Contexte').filter(colId => !dejaAffichees.includes(colId));
}

function libelle(colId) { return info(colId).libelle; }

function estFormule(colId) { return info(colId).formule; }

/* ══════════════════════════════════════════════════════════════
   3. PASTILLES ET COULEURS
   Le dessin des pastilles (texte affiché, couleur) est commun avec le
   widget Page : voir ../_commun/pastilles.js. Ces relais lui passent la
   description de la colonne, pour que le reste de la Galerie continue de
   ne manipuler que des identifiants de colonnes (colId).
   ══════════════════════════════════════════════════════════════ */

/** Cellule en erreur (['E', …] ou objet d'erreur) ? */
const estErreur = (v) => Pastilles.estErreur(v);

/** Texte affiché d'une valeur simple, selon la description de sa colonne. */
const valeurSimple = (colonne, v) => Pastilles.valeurSimple(colonne, v);

/** Valeur d'une cellule en liste de textes (plusieurs pour une liste). */
function elementsAffiches(colId, valeur) { return Pastilles.elements(info(colId), valeur); }

/** Couleur { fond, texte } d'une pastille d'après son texte, ou null (gris). */
function couleurPastille(colId, texte) { return Pastilles.couleur(info(colId), texte); }

/** Pastilles <span> d'une cellule, vide si la cellule l'est. */
function creerPastilles(colId, valeur) { return Pastilles.creer(info(colId), valeur); }

/* ══════════════════════════════════════════════════════════════
   3 bis. MODIFIER UNE PASTILLE (#205 sur la carte, #206 dans la fiche)
   Un clic sur une pastille ouvre un petit menu (../_commun/fiche.js),
   choisi d'après le TYPE de la colonne :
     - Choix            → la liste des choix de Grist, plus « — aucun — » ;
     - Choix multiple   → la même liste, en cases à cocher ;
     - Référence        → les lignes de la table visée, plus « — aucune — »
                          (champ de recherche au-delà de SEUIL_RECHERCHE) ;
     - Liste de références → les mêmes lignes, en cases à cocher (recherche
                          à cases au-delà de SEUIL_RECHERCHE) ;
     - Case à cocher    → oui / non ;
     - Date             → un calendrier, avec « Effacer la date ».
   Les autres colonnes (texte, nombre, colonne calculée par une formule)
   restent en lecture seule.
   Le menu ne fait que CHOISIR : c'est l'appelant qui décide quoi faire de
   la valeur (l'écrire tout de suite sur la carte, la garder jusqu'à
   « ✓ Sauvegarder » dans la fiche).
   ══════════════════════════════════════════════════════════════ */

// Types de colonnes (sans le nom de table : « Ref » pour « Ref:Projets »)
// dont la pastille se modifie d'un clic.
const TYPES_MODIFIABLES = ['Choice', 'ChoiceList', 'Ref', 'RefList', 'Bool', 'Date'];
// Au-delà de ce nombre de lignes visées, le menu d'une référence devient un
// champ de recherche : une longue liste se parcourt mal.
const SEUIL_RECHERCHE = 12;

/** La pastille de cette colonne peut-elle être modifiée depuis le widget ? */
function pastilleModifiable(colId) {
  const colonne = info(colId);
  return !colonne.formule && TYPES_MODIFIABLES.includes(colonne.typeBase);
}

/**
 * Rend une pastille cliquable (et utilisable au clavier : Tab, puis Entrée).
 * Le clic ne « remonte » pas jusqu'à la carte : il n'ouvre pas sa fiche.
 *   ouvrir : fonction appelée avec la pastille, qui ouvre le menu
 */
function rendreModifiable(pastille, colId, ouvrir) {
  pastille.classList.add('pastille-modifiable');
  pastille.tabIndex = 0;
  pastille.setAttribute('role', 'button');
  pastille.title += ' — cliquer pour modifier';
  pastille.addEventListener('click', (e) => { e.stopPropagation(); ouvrir(pastille); });
  pastille.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    ouvrir(pastille);
  });
}

/** Pastille « + Priorité » d'une colonne vide, dans la fiche (#206). */
function pastilleVide(colId) {
  const p = document.createElement('span');
  p.className = 'pastille pastille-vide';
  p.textContent = '+ ' + libelle(colId);
  p.title = `${libelle(colId)} : vide`;
  return p;
}

/**
 * Ouvre près de `ancre` le menu qui convient au type de la colonne.
 *   valeur   : valeur actuelle, telle que Grist l'envoie au widget
 *   surChoix : appelée avec deux formes de la valeur choisie :
 *     ecrite   → ce qu'attend Grist pour l'écrire (numéro de ligne pour une
 *                référence, ['L', …] pour une liste, secondes pour une date) ;
 *     affichee → ce qu'il renverra ensuite au widget (nom de la référence…),
 *                pour afficher la pastille avant même la sauvegarde.
 *   ligne    : { idLigne, enAttente, selonVue } — la carte, et dans la fiche
 *              ses choix pas encore sauvegardés (format d'écriture de
 *              Grist) : la condition de liste déroulante en dépend (#238).
 *              selonVue (nouvelle carte, #186) : les valeurs de la vue
 *              d'abord, puis un séparateur « Hors de la vue ».
 */
async function ouvrirMenuPastille(ancre, colId, valeur, surChoix, ligne = {}) {
  const colonne = info(colId);
  const erreur = estErreur(valeur);
  // Condition de liste déroulante (#238) : options à proposer, ou toutes
  const garder = await filtreCondition(colonne, ligne);
  if (!ancre.isConnected) return;   // grille redessinée pendant la lecture
  // Options rangées selon la vue (#186), ou laissées telles quelles
  const ranger = (options) => ligne.selonVue
    ? Filtres.rangerSelonVue(options, o => dansLaVue(colId, o.libelle))
    : options;

  if (colonne.typeBase === 'Choice') {
    // Une valeur absente de la liste des choix (choix retiré dans Grist,
    // ou exclu par la condition) reste proposée : c'est la valeur actuelle.
    const choix = colonne.choix.filter(v => garder(v));
    if (!erreur && valeur && !choix.includes(valeur)) choix.push(valeur);
    Fiche.menuChoix(ancre, {
      options: ranger(choix.map(v => ({ valeur: v, libelle: v }))),
      selection: [valeur || ''], vide: '— aucun —', valeurVide: '',
      surChoix: (v) => surChoix(v, v),
    });

  } else if (colonne.typeBase === 'ChoiceList') {
    // Grist peut envoyer la liste « encodée » : ['L', a, b…]
    const liste = Array.isArray(valeur) && !erreur ? (valeur[0] === 'L' ? valeur.slice(1) : valeur) : [];
    const permis = colonne.choix.filter(v => garder(v));
    const choix = [...permis, ...liste.filter(v => !permis.includes(v))];
    // Menu à cases : il reste ouvert, chaque case cochée ou décochée compte.
    Fiche.menuChoix(ancre, {
      options: ranger(choix.map(v => ({ valeur: v, libelle: v }))),
      selection: liste, multiple: true,
      surChoix: (choisis) => surChoix(choisis.length ? ['L', ...choisis] : null, choisis),
    });

  } else if (colonne.typeBase === 'Bool') {
    Fiche.menuChoix(ancre, {
      options: [{ valeur: true, libelle: '✓ oui' }, { valeur: false, libelle: '✗ non' }],
      selection: [valeur === true],
      surChoix: (v) => surChoix(v, v),
    });

  } else if (colonne.typeBase === 'Date') {
    Fiche.menuDate(ancre, {
      valeur: erreur ? '' : dateVersIso(valeur),
      // Grist range une date en secondes depuis le 1er janvier 1970 (minuit UTC)
      surChoix: (iso) => {
        const secondes = iso ? Date.parse(iso) / 1000 : null;
        surChoix(secondes, secondes);
      },
    });

  } else if (colonne.typeBase === 'Ref') {
    await ouvrirMenuReference(ancre, colId, valeur, surChoix, garder, ranger);

  } else if (colonne.typeBase === 'RefList') {
    await ouvrirMenuListeReferences(ancre, colId, valeur, surChoix, ligne, garder, ranger);
  }
}

/**
 * Condition de liste déroulante de la colonne (#238) : renvoie une fonction
 * (option) → faut-il la proposer ? Pour une référence, l'option est une
 * ligne de la table visée ; pour un choix, son texte.
 * La carte ($Projet) est relue telle que Grist la range (références sous
 * leur numéro, comme l'option), complétée des choix en attente de la fiche.
 * Sans condition, ou si la carte ne peut pas être relue : tout est proposé.
 */
async function filtreCondition(colonne, { idLigne, enAttente } = {}) {
  const tout = () => true;
  if (!colonne.condition || !idLigne) return tout;
  try {
    const table = await grist.docApi.fetchTable(ETAT.table);
    const i = table.id.indexOf(idLigne);
    if (i === -1) return tout;
    const rec = {};
    Object.keys(table).forEach(c => { rec[c] = table[c][i]; });
    Object.assign(rec, enAttente || {});
    return (choice) => Condition.garder(colonne.condition, { choice, rec });
  } catch (err) {
    console.warn('Galerie – condition de liste déroulante ignorée :', err);
    return tout;
  }
}

/**
 * Menu d'une référence. La table visée est relue à CHAQUE ouverture : une
 * ligne ajoutée entre-temps dans Grist (un nouveau projet…) est proposée
 * tout de suite. Elle n'est jamais lue au chargement du widget (#188).
 * ranger : range les options (selon la vue pour une nouvelle carte, #186).
 */
async function ouvrirMenuReference(ancre, colId, valeur, surChoix, garder = () => true, ranger = (o) => o) {
  let ref = null, lignes = null;
  try {
    // Structure relue elle aussi : elle dit quelle colonne la référence affiche.
    const doc = await Colonnes.lireDocument();
    ref = await Colonnes.lireReference(doc, ETAT.table, colId);
    // Lignes de la table visée (déjà lues par lireReference) : la condition
    // de liste déroulante porte sur elles (choice.Projet…, #238)
    if (ref) lignes = await Colonnes.lireLignes(doc, ref.tableVisee);
  } catch (err) {
    console.error('Galerie – lecture de la table visée impossible :', err);
  }
  if (!ref) { afficherToast('⚠️ Impossible de lire les valeurs possibles', 3000); return; }
  // Pendant la lecture, la grille a pu être redessinée : la pastille cliquée
  // n'est plus à l'écran, et le menu n'aurait plus où s'accrocher.
  if (!ancre.isConnected) return;

  // Grist envoie la référence sous son nom : on retrouve son numéro.
  const actuel = estErreur(valeur) ? undefined : (valeur ? ref.id(valeur) : 0);
  // Une ligne de la table visée, colonne par colonne (l'option « choice »)
  const ligneVisee = (i) => Object.fromEntries(Object.keys(lignes).map(c => [c, lignes[c][i]]));
  const options = ranger(ref.options
    // Condition de liste déroulante ; la valeur actuelle reste toujours proposée
    .filter((o, i) => o.id === actuel || garder(ligneVisee(i)))
    .map(o => ({ valeur: o.id, libelle: o.nom || `n° ${o.id}` }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')));
  // Le nom renvoyé ensuite par Grist ('' pour une référence vide, numéro 0)
  const choisir = (id) => surChoix(id, id ? ref.nom(id) : '');

  if (options.length > SEUIL_RECHERCHE) {
    Fiche.menuRecherche(ancre, {
      options: [{ valeur: 0, libelle: '— aucune —' }, ...options],
      placeholder: `Rechercher : ${libelle(colId)}`,
      surChoix: choisir,
    });
  } else {
    Fiche.menuChoix(ancre, {
      options, selection: [actuel], vide: '— aucune —', valeurVide: 0,
      surChoix: choisir,
    });
  }
}

/**
 * Menu d'une liste de références (ex. les chefs d'un projet) : des cases à
 * cocher, ou une recherche à cases au-delà de SEUIL_RECHERCHE lignes visées.
 * Le menu reste ouvert ; chaque case cochée ou décochée appelle surChoix
 * avec la liste complète : ['L', 3, 7] pour Grist (null si vide), et les
 * noms pour l'affichage.
 * Comme pour une référence simple, la table visée est relue à chaque
 * ouverture, et la condition de liste déroulante (#238) s'applique.
 *   ligne : { idLigne, enAttente, selonVue } (voir ouvrirMenuPastille)
 */
async function ouvrirMenuListeReferences(ancre, colId, valeur, surChoix, ligne = {},
  garder = () => true, ranger = (o) => o) {
  let ref = null, lignes = null, actuels = [];
  try {
    const doc = await Colonnes.lireDocument();
    ref = await Colonnes.lireReference(doc, ETAT.table, colId);
    if (ref) {
      lignes = await Colonnes.lireLignes(doc, ref.tableVisee);
      actuels = await numerosActuels(colId, valeur, ligne, ref);
    }
  } catch (err) {
    console.error('Galerie – lecture de la table visée impossible :', err);
  }
  if (!ref) { afficherToast('⚠️ Impossible de lire les valeurs possibles', 3000); return; }
  if (!ancre.isConnected) return;   // grille redessinée pendant la lecture

  const ligneVisee = (i) => Object.fromEntries(Object.keys(lignes).map(c => [c, lignes[c][i]]));
  const options = ref.options
    // Condition de liste déroulante ; les valeurs actuelles restent proposées
    .filter((o, i) => actuels.includes(o.id) || garder(ligneVisee(i)))
    .map(o => ({ valeur: o.id, libelle: o.nom || `n° ${o.id}` }));
  // Un numéro qui ne correspond à aucune ligne (ligne supprimée) reste
  // proposé, coché : sinon la première case cochée l'effacerait en silence.
  actuels.filter(id => !options.some(o => o.valeur === id))
    .forEach(id => options.push({ valeur: id, libelle: `n° ${id}` }));
  options.sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
  const rangees = ranger(options);

  // Grist renverra ensuite les noms affichés : on les donne pour l'aperçu.
  const choisir = (ids) => surChoix(ids.length ? ['L', ...ids] : null,
    ids.map(id => ref.nom(id) || `n° ${id}`));

  if (options.length > SEUIL_RECHERCHE) {
    Fiche.menuRecherche(ancre, {
      options: rangees, multiple: true, selection: actuels,
      placeholder: `Rechercher : ${libelle(colId)}`,
      surChoix: choisir,
    });
  } else {
    Fiche.menuChoix(ancre, { options: rangees, selection: actuels, multiple: true, surChoix: choisir });
  }
}

/**
 * Numéros des lignes visées par la liste de références `colId` d'une carte.
 * Grist envoie au widget les NOMS affichés : deux contacts homonymes y sont
 * indiscernables. On prend donc, dans l'ordre :
 *   1. le choix en attente de la fiche (déjà au format ['L', numéros…]) ;
 *   2. la cellule relue dans la table (fetchTable donne les numéros) ;
 *   3. à défaut (nouvelle carte, lecture impossible), les noms traduits en
 *      numéros, le premier homonyme l'emportant.
 */
async function numerosActuels(colId, valeur, { idLigne, enAttente } = {}, ref) {
  const numeros = (v) => {
    const liste = decoderListe(v);
    return Array.isArray(liste) ? liste.filter(n => typeof n === 'number' && n > 0) : [];
  };
  if (enAttente && colId in enAttente) return numeros(enAttente[colId]);
  if (idLigne) {
    try {
      const table = await grist.docApi.fetchTable(ETAT.table);
      const i = table.id.indexOf(idLigne);
      if (i !== -1 && colId in table) return numeros(table[colId][i]);
    } catch (err) {
      console.warn('Galerie – cellule non relue, les noms servent :', err);
    }
  }
  if (estErreur(valeur)) return [];
  const noms = decoderListe(valeur);
  return (Array.isArray(noms) ? noms : []).map(nom => ref.id(nom)).filter(Boolean);
}

/**
 * Cohérence entre deux références d'une carte. Exemple : un EPIC a un
 * Projet et un Objectif ; or chaque objectif appartient lui-même à un
 * projet. Changer le projet de l'EPIC sans changer son objectif (ou
 * choisir l'objectif d'un autre projet) rend la carte incohérente.
 *
 * Règle générique, lue dans la structure du document : pour deux colonnes
 * de référence A et B de la table (non calculées), si la table visée par B
 * a une colonne qui vise la même table que A, alors la ligne visée par B
 * doit avoir, dans cette colonne, la même valeur que la carte dans A.
 * On ne vérifie que les paires qui contiennent la colonne modifiée, et
 * seulement si les deux références sont remplies.
 *
 *   ligne      : la carte, telle que Grist l'a envoyée (références par nom)
 *   colId      : la colonne qui vient d'être modifiée
 *   idsConnus  : { colId: numéro } des références déjà connues par leur
 *                numéro (la valeur choisie, les choix en attente de la fiche)
 * Renvoie le texte de l'alerte, ou '' si tout concorde. Une erreur de
 * lecture ne bloque rien : pas d'alerte.
 */
async function alerteCoherence(ligne, colId, idsConnus = {}) {
  if (info(colId).typeBase !== 'Ref') return '';
  try {
    const doc = await Colonnes.lireDocument();   // relu : données fraîches
    const refs = doc.colonnes(ETAT.table).filter(c => c.typeBase === 'Ref' && c.tableVisee && !c.formule);
    const refsLues = {};
    const reference = async (c) => (refsLues[c.colId] ??= await Colonnes.lireReference(doc, ETAT.table, c.colId));
    // Numéro de la ligne visée par la colonne c de la carte (0 si vide)
    const numero = async (c) => {
      if (c.colId in idsConnus) return Number(idsConnus[c.colId]) || 0;
      const v = ligne[c.colId];
      if (!v || estErreur(v)) return 0;
      const ref = await reference(c);
      return (ref && ref.id(v)) || 0;
    };

    const alertes = [];
    for (const a of refs) {
      for (const b of refs) {
        if (a === b || (a.colId !== colId && b.colId !== colId)) continue;
        // Colonnes de la table visée par B qui visent la table de A (objectif → projet)
        const liens = doc.colonnes(b.tableVisee).filter(d => d.tableVisee === a.tableVisee);
        if (!liens.length) continue;
        const idA = await numero(a), idB = await numero(b);
        if (!idA || !idB) continue;
        const lignesB = await Colonnes.lireLignes(doc, b.tableVisee);
        const i = lignesB.id.indexOf(idB);
        if (i === -1) continue;
        // fetchTable donne les références par numéro ; une liste arrive ['L', …]
        const concorde = liens.every(d => {
          const v = lignesB[d.colId][i];
          const valeurs = Array.isArray(v) ? (v[0] === 'L' ? v.slice(1) : v) : (v ? [v] : []);
          return !valeurs.length || valeurs.includes(idA);   // non rattaché : rien à dire
        });
        if (!concorde) {
          const nomA = (await reference(a)).nom(idA), nomB = (await reference(b)).nom(idB);
          alertes.push(`⚠️ « ${nomB} » (${b.libelle}) relève d'un autre ${a.libelle.toLowerCase()} `
            + `que « ${nomA} » : pensez à le changer`);
        }
      }
    }
    return alertes.join(' ; ');
  } catch (err) {
    console.warn('Galerie – vérification de cohérence impossible :', err);
    return '';
  }
}

/** Date reçue de Grist (Date, secondes ou texte) → « AAAA-MM-JJ » ('' si aucune). Même règle que le Kanban. */
function dateVersIso(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  try {
    return (typeof v === 'number' ? new Date(v * 1000) : new Date(v)).toISOString().slice(0, 10);
  } catch (_) { return ''; }
}

/**
 * Écrit tout de suite une cellule dans Grist (pastille modifiée sur une
 * carte, #205), comme une cellule modifiée dans la grille de Grist : la
 * grille n'a pas de bouton « Sauvegarder ». Ctrl + Z dans Grist annule.
 * Grist renvoie ensuite les cartes au widget (onRecords), qui les redessine.
 */
async function ecrireCellule(ligne, colId, valeur) {
  try {
    await grist.docApi.applyUserActions([['UpdateRecord', ETAT.table, ligne.id, { [colId]: valeur }]]);
    const alerte = await alerteCoherence(ligne, colId, { [colId]: valeur });
    afficherToast(`✓ ${libelle(colId)} modifié` + (alerte ? ' — ' + alerte : ''), alerte ? 8000 : 2200);
  } catch (err) {
    afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Galerie – erreur d\'écriture :', err);
  }
}

/* ══════════════════════════════════════════════════════════════
   4. GRILLE DE CARTES
   ══════════════════════════════════════════════════════════════ */

/**
 * Titre de la barre : nom de la table, suivi en gris du nom de la Galerie
 * s'il est réglé (#264). Une page dupliquée qui porte encore le nom du
 * modèle se repère ainsi d'un coup d'œil. textContent : le nom est saisi
 * par l'utilisateur, il ne doit jamais être lu comme du HTML.
 */
function majTitre() {
  const titre = document.getElementById('titre-table');
  titre.textContent = '🖼️ ' + (ETAT.table || 'Galerie');
  if (ETAT.nomGalerie) {
    const nom = document.createElement('span');
    nom.className = 'barre-nom';
    nom.textContent = ' · ' + ETAT.nomGalerie;
    titre.appendChild(nom);
  }
}

function afficherGrille() {
  // Barre des vues (onglets, « 🔽 Filtres ») et bas de « Gérer la vue »
  majBarreVues();
  const grille = document.getElementById('grille');
  grille.innerHTML = '';
  majTitre();
  // Taille des cartes (#237) : la grille la porte, le CSS règle la largeur
  grille.dataset.taille = ETAT.taille = tailleCartes();
  majBoutonTaille();

  if (!ETAT.colonnes || !ETAT.colonnes.Titre) {
    grille.appendChild(message('Associez au moins la colonne « Titre » dans le panneau de droite de Grist '
      + '(section « Colonnes » du widget), puis, si vous le souhaitez, le texte principal et le contexte.'));
    document.getElementById('compte').textContent = '0';
    document.getElementById('bandeau-notepad').hidden = true;
    document.getElementById('btn-nouvelle').disabled = true;
    return;
  }
  document.getElementById('btn-nouvelle').disabled = false;

  majBandeauNotepad();

  const visibles = lignesVisibles();
  document.getElementById('compte').textContent = visibles.length === ETAT.lignes.length
    ? String(ETAT.lignes.length) : `${visibles.length} / ${ETAT.lignes.length}`;

  if (!visibles.length) {
    grille.appendChild(message(ETAT.lignes.length
      ? 'Aucune carte ne correspond aux filtres ou à la recherche.'
      : 'Aucune ligne à afficher.'));
    return;
  }
  if (ETAT.groupe) dessinerGroupes(grille, visibles);
  else visibles.forEach(ligne => grille.appendChild(construireCarte(ligne)));
}

/**
 * Lignes affichées : celles qui respectent les filtres de la vue ET la
 * recherche, rangées selon le tri de la vue (#232).
 */
function lignesVisibles() {
  const lignes = ETAT.lignes.filter(l => respecteFiltres(l) && correspondRecherche(l));
  if (ETAT.tri.length) {
    // Type et choix déclarés de chaque colonne du tri (ordre des choix de Grist…)
    const infos = Object.fromEntries(ETAT.tri.map(c => [c.col, info(c.col)]));
    // Le tri du navigateur est « stable » : à égalité, deux cartes gardent
    // leur ordre de départ, celui envoyé par Grist.
    lignes.sort((a, b) => Tri.comparerLignes(a, b, ETAT.tri, infos));
  }
  return lignes;
}

/**
 * Règle commune avec le Kanban (../_commun/filtres.js) : une carte doit
 * respecter tous les filtres (« et ») ; dans un filtre, une seule des
 * valeurs cochées suffit (« ou »).
 */
function respecteFiltres(ligne) {
  return ETAT.filtres.every(f => Filtres.ligneRespecte(ligne, f));
}

/**
 * Règle commune avec le Kanban (../_commun/recherche.js) : tous les mots,
 * dans toutes les colonnes reçues de Grist, accents ignorés ; #12 cherche
 * la ligne n° 12.
 */
function correspondRecherche(ligne) {
  return Recherche.ligneCorrespond(ligne, ETAT.recherche);
}

function construireCarte(ligne) {
  const taille = ETAT.taille || 'moyenne';   // #237, lue par afficherGrille
  const carte = document.createElement('article');
  carte.className = 'carte' + (ligne.id === ETAT.selection ? ' selectionnee' : '');
  carte.dataset.id = ligne.id;

  const titre = document.createElement('div');
  titre.className = 'carte-titre';
  titre.textContent = ligne[ETAT.colonnes.Titre] || '(sans titre)';
  carte.appendChild(titre);

  // Pastilles : toutes les colonnes associées comme « Pastilles », non vides.
  // Une pastille modifiable s'écrit tout de suite dans Grist (#205).
  const pastilles = document.createElement('div');
  pastilles.className = 'carte-contexte';
  colonnesPastilles().forEach(colId => {
    const elements = creerPastilles(colId, ligne[colId]);
    if (pastilleModifiable(colId)) {
      elements.forEach(p => rendreModifiable(p, colId, (ancre) =>
        ouvrirMenuPastille(ancre, colId, ligne[colId], (ecrite) => ecrireCellule(ligne, colId, ecrite),
          { idLigne: ligne.id })));
    }
    pastilles.append(...elements);
  });
  if (pastilles.children.length && taille !== 'compacte') carte.appendChild(pastilles);
  // Grande carte (#237) : le début du texte principal et le nombre d'objets liés
  if (taille === 'grande') ajouterApercu(carte, ligne);
  if (taille !== 'compacte') ajouterNumero(carte, ligne);
  colorerCarte(carte, ligne);
  if (taille !== 'compacte') ajouterImage(carte, ligne);

  carte.addEventListener('click', () => ouvrirFiche(ligne.id));
  return carte;
}

/**
 * Numéro de la carte (#244), comme dans le Kanban (#203) : « #12 » en petit
 * gris, toujours en bas à droite de la carte. C'est le numéro de ligne Grist,
 * celui qu'on cite dans les échanges et que la recherche « #12 » retrouve.
 * - Grande carte avec objets liés : à droite de leur rangée, déjà collée en
 *   bas de la carte (pas de ligne en plus) ;
 * - sinon : dans un pied de carte à lui, poussé en bas (CSS .carte-pied).
 *   Le mettre à droite des pastilles ne suffit pas : une carte étirée à la
 *   hauteur de sa voisine le laisserait au milieu (constaté au test).
 * Pas en taille compacte : elle promet « le titre seul ».
 */
function ajouterNumero(carte, ligne) {
  let rangee = carte.querySelector('.carte-lies');
  if (!rangee) {
    rangee = document.createElement('div');
    rangee.className = 'carte-pied';
    carte.appendChild(rangee);
  }
  const numero = document.createElement('span');
  numero.className = 'carte-id';
  numero.textContent = '#' + ligne.id;
  rangee.appendChild(numero);
}

/* ── Couleur des cartes (#241) ───────────────────────────────────
   Seulement si une colonne « Couleur » est associée : sans elle, les cartes
   gardent leur bandeau violet habituel. Les teintes et la couleur
   automatique viennent de ../_commun/palette.js. */

// Opacité du fond coloré d'une carte (1 = teinte pleine) : le bandeau et la
// pastille ● gardent leur couleur pleine, le fond reste discret.
const OPACITE_FOND_CARTE = 0.2;

/** Colonne associée à « Couleur », ou null. */
function colonneCouleur() {
  return (ETAT.colonnes && ETAT.colonnes.Couleur) || null;
}

/**
 * Colore une carte (bandeau et fond) et lui ajoute la pastille ● : un bouton
 * qui ouvre le menu des couleurs, ou un simple témoin si la colonne est
 * calculée par une formule (on ne peut pas y écrire).
 */
function colorerCarte(carte, ligne) {
  const colId = colonneCouleur();
  if (!colId) return;
  const couleur = Palette.pourLigne(ligne.id, ligne[colId]);
  carte.classList.add('carte-coloree');
  // Fond adouci : 20 % d'opacité (80 % de transparence) sur le blanc de la carte
  carte.style.setProperty('--carte-fond', Palette.transparente(couleur.fond, OPACITE_FOND_CARTE));
  carte.style.setProperty('--carte-trait', couleur.trait);

  const modifiable = !estFormule(colId);
  const rond = document.createElement(modifiable ? 'button' : 'span');
  rond.className = 'carte-couleur';
  // Infobulle : la couleur, et comment elle a été obtenue
  let aide = `Couleur : ${Palette.libelle(couleur)}`;
  if (couleur.inconnue) aide += ` (automatique : « ${couleur.inconnue} » n'est pas une couleur connue)`;
  else if (!couleur.choisie) aide += ' (automatique)';
  rond.title = aide + (modifiable ? ' — cliquer pour changer' : ' — calculée par une formule');
  if (modifiable) {
    rond.type = 'button';
    rond.setAttribute('aria-label', rond.title);
    // Le clic ne « remonte » pas jusqu'à la carte : il n'ouvre pas sa fiche
    rond.addEventListener('click', (e) => { e.stopPropagation(); ouvrirMenuCouleur(rond, ligne, colId, couleur); });
    rond.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
  }
  carte.appendChild(rond);
}

/* ── Image des cartes (#241, étape B) ────────────────────────────
   Une cellule « pièce jointe » ne contient pas l'image, seulement des
   numéros de fichiers : ['L', 12, 15] (ou [12, 15] tel qu'onRecords
   l'envoie). Pour afficher le fichier n° 12, le navigateur doit le
   télécharger sur le serveur Grist avec un JETON d'accès temporaire :
       <baseUrl>/attachments/12/download?auth=<jeton>
   - le jeton est demandé à Grist (getAccessToken, en LECTURE SEULE) et
     renouvelé avant qu'il n'expire ; il ne quitte jamais le navigateur :
     ni journalisé, ni écrit dans le document ;
   - la table système _grist_Attachments donne l'extension de chaque fichier :
     un PDF joint est ignoré, on montre la première IMAGE de la cellule ;
   - l'image est posée par img.src (jamais par innerHTML) : un fichier
     piégé ne peut pas exécuter de code dans une balise <img>.
   Si l'image ne se charge pas (jeton expiré entre deux envois de Grist), on
   redemande un jeton et on réessaie une fois ; sinon l'image est retirée,
   plutôt que d'afficher une icône d'image cassée. */

// Extensions affichées comme images (en minuscules, sans le point)
const EXTENSIONS_IMAGES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']);
// On renouvelle le jeton s'il lui reste moins d'une minute
const MARGE_JETON_MS = 60 * 1000;

const PIECES = {
  jeton:    null,       // jeton d'accès en cours
  baseUrl:  null,       // adresse du document sur le serveur Grist
  expire:   0,          // date d'expiration du jeton (millisecondes)
  demande:  null,       // demande de jeton en cours (pour ne pas en lancer deux)
  fichiers: new Map(),  // numéro de pièce jointe → extension ('png', 'pdf'…)
  // Pièces jointes illisibles même avec un jeton neuf : plus tentées (sinon
  // chaque redessin, à chaque lettre de la recherche, redemanderait un jeton),
  // jusqu'à la prochaine relecture de la liste des pièces jointes
  echecs:   new Set(),
};

/** Colonne associée à « Image », ou null. */
function colonneImage() {
  return (ETAT.colonnes && ETAT.colonnes.Image) || null;
}

/** Numéros des pièces jointes d'une cellule ([] si vide ou mal formée). */
function numerosPieces(valeur) {
  const liste = decoderListe(valeur);
  return Array.isArray(liste) ? liste.filter(n => Number.isInteger(n) && n > 0) : [];
}

/**
 * Appelée à chaque envoi de Grist, avant le dessin : relit la liste des
 * pièces jointes si une carte en contient une inconnue, et s'assure que le
 * jeton est valide. Ne fait rien sans colonne Image ou sans pièce jointe.
 * En cas d'échec, les cartes s'affichent simplement sans image.
 */
async function preparerImages(lignes) {
  const colId = colonneImage();
  if (!colId) return;
  const numeros = lignes.flatMap(l => numerosPieces(l[colId]));
  if (!numeros.length) return;
  if (numeros.some(n => !PIECES.fichiers.has(n))) {
    try { await lireFichiers(); }
    catch (err) { console.warn('Galerie – liste des pièces jointes illisible :', err); }
  }
  try { await obtenirJeton(false); }
  catch (err) { console.warn('Galerie – accès aux pièces jointes refusé :', err); }
}

/** Lit l'extension de chaque pièce jointe du document (_grist_Attachments). */
async function lireFichiers() {
  const t = await grist.docApi.fetchTable('_grist_Attachments');
  PIECES.fichiers = new Map(t.id.map((id, i) => {
    // fileExt vaut « .png » ; à défaut, on prend la fin du nom du fichier
    const ext = (t.fileExt && t.fileExt[i]) || String((t.fileName && t.fileName[i]) || '').split('.').pop();
    return [id, String(ext || '').replace(/^\./, '').toLowerCase()];
  }));
  PIECES.echecs.clear();   // liste à jour : on retente les fichiers en échec
}

/**
 * Demande un jeton à Grist s'il n'y en a pas, s'il expire bientôt, ou si
 * `forcer` est vrai (le précédent a été refusé). Deux appels simultanés
 * partagent la même demande.
 */
function obtenirJeton(forcer) {
  if (!forcer && PIECES.jeton && Date.now() < PIECES.expire - MARGE_JETON_MS) return Promise.resolve();
  if (!PIECES.demande) {
    PIECES.demande = grist.docApi.getAccessToken({ readOnly: true })
      .then((r) => {
        PIECES.jeton = r.token;
        PIECES.baseUrl = String(r.baseUrl).replace(/\/+$/, '');
        PIECES.expire = Date.now() + (r.ttlMsecs || 0);
      })
      .finally(() => { PIECES.demande = null; });
  }
  return PIECES.demande;
}

/**
 * Première image d'une cellule, ou null. Un fichier d'extension inconnue
 * (liste des pièces jointes illisible) est tenté quand même : s'il ne
 * s'affiche pas, l'image est retirée.
 */
function premiereImage(valeur) {
  return numerosPieces(valeur).find((n) => {
    if (PIECES.echecs.has(n)) return false;
    const ext = PIECES.fichiers.get(n);
    return ext === undefined || EXTENSIONS_IMAGES.has(ext);
  }) || null;
}

/** Adresse de téléchargement de la pièce jointe n° `n`, avec le jeton actuel. */
function adressePiece(n) {
  return `${PIECES.baseUrl}/attachments/${n}/download?auth=${encodeURIComponent(PIECES.jeton)}`;
}

/** Ajoute en haut de la carte la première image de la colonne Image, s'il y en a une. */
function ajouterImage(carte, ligne) {
  const colId = colonneImage();
  if (!colId || !PIECES.jeton) return;
  const n = premiereImage(ligne[colId]);
  if (!n) return;
  const img = document.createElement('img');
  img.className = 'carte-image';
  img.alt = '';               // image décorative : le titre de la carte suit
  img.loading = 'lazy';       // téléchargée seulement quand la carte devient visible
  img.draggable = false;
  let jetonEssaye = PIECES.jeton;
  let reessayee = false;
  img.addEventListener('error', async () => {
    if (reessayee) { PIECES.echecs.add(n); img.remove(); return; }
    reessayee = true;
    try {
      // Nouveau jeton, sauf si une autre image vient déjà d'en obtenir un
      if (PIECES.jeton === jetonEssaye) await obtenirJeton(true);
      jetonEssaye = PIECES.jeton;
      img.src = adressePiece(n);
    } catch (err) {
      img.remove();
    }
  });
  img.src = adressePiece(n);
  carte.prepend(img);
}

/**
 * Menu des couleurs, sous la pastille ● : « Automatique » (vide la cellule),
 * puis les huit couleurs, chacune précédée de son rond. Le choix s'écrit tout
 * de suite dans Grist, comme une pastille modifiée sur la carte (#205).
 */
function ouvrirMenuCouleur(ancre, ligne, colId, couleur) {
  const menu = Fiche.menuChoix(ancre, {
    options: Palette.COULEURS.map(c => ({ valeur: c.nom, libelle: Palette.libelle(c) })),
    selection: [couleur.choisie ? couleur.nom : ''],
    vide: 'Automatique',
    valeurVide: '',
    surChoix: (nom) => {
      if ((nom || '') === String(ligne[colId] ?? '').trim().toLowerCase()) return;   // rien ne change
      ecrireCellule(ligne, colId, nom || '');
    },
  });
  // Rond de couleur devant chaque choix (le menu commun n'affiche que du texte)
  const items = menu.querySelectorAll('.fiche-menu-item');
  items.forEach((item, i) => {
    // Le premier choix est « Automatique » : son rond montre la couleur tirée du numéro
    const c = i === 0 ? Palette.automatique(ligne.id) : Palette.COULEURS[i - 1];
    const rond = document.createElement('span');
    rond.className = 'palette-rond';
    rond.style.background = c.trait;
    item.prepend(rond);
  });
}

/* ── Taille des cartes (#237) ────────────────────────────────────
   compacte : le titre seul, cartes plus étroites ;
   moyenne  : titre et pastilles (par défaut) ;
   grande   : en plus, le début du texte principal et le nombre d'objets liés.
   Préférence de chacun, retenue par le navigateur pour chaque Galerie
   (document et table), comme la disposition de la fiche. */
const TAILLES = {
  compacte: { nom: 'Compacte', aide: 'le titre seul' },
  moyenne:  { nom: 'Moyenne',  aide: 'titre et pastilles' },
  grande:   { nom: 'Grande',   aide: 'avec le début du texte et les objets liés' },
};

let _tailleSeance = null;   // choix de la séance, si le navigateur ne peut pas le retenir

/** Taille choisie ('compacte', 'moyenne' ou 'grande'), « moyenne » à défaut. */
function tailleCartes() {
  try {
    const cle = cleMemoire('taille');
    const t = cle && localStorage.getItem(cle);
    if (TAILLES[t]) return t;
  } catch (_) { /* stockage bloqué (navigation privée…) */ }
  return _tailleSeance || 'moyenne';
}

function changerTaille(t) {
  _tailleSeance = t;
  try {
    const cle = cleMemoire('taille');
    if (cle) localStorage.setItem(cle, t);
  } catch (_) { /* vaut pour cette séance seulement */ }
  afficherGrille();
}

/** Bouton « ▦ Moyenne ▾ » de la barre. */
function majBoutonTaille() {
  const bouton = document.getElementById('taille-bouton');
  if (bouton) bouton.textContent = `▦ ${TAILLES[ETAT.taille || 'moyenne'].nom} ▾`;
}

/** Menu des trois tailles, sous le bouton. */
function ouvrirMenuTaille() {
  const actuelle = ETAT.taille || tailleCartes();
  Fiche.menuChoix(document.getElementById('taille-bouton'), {
    options: Object.entries(TAILLES).map(([valeur, t]) => ({ valeur, libelle: `${t.nom} : ${t.aide}` })),
    selection: [actuelle],
    surChoix: changerTaille,
  });
}

/**
 * Grande carte : le début du texte principal, en texte simple (sans les
 * symboles du Markdown), coupé à 4 lignes ; puis « Tâches 38 » pour chaque
 * colonne d'objets liés non vide.
 */
function ajouterApercu(carte, ligne) {
  const colTexte = ETAT.colonnes.Description;
  const brut = colTexte ? String(ligne[colTexte] || '') : '';
  // Début du texte seulement : convertir un très long texte coûterait pour rien
  const texte = brut ? Fiche.markdownVersTexte(Fiche.notepadVersMarkdown(brut).slice(0, 1500)) : '';
  if (texte) {
    const resume = document.createElement('div');
    resume.className = 'carte-resume';
    resume.textContent = texte;
    carte.appendChild(resume);
  }
  const nombres = colonnesObjetsLies()
    .map(colId => ({ colId, n: elementsAffiches(colId, ligne[colId]).length }))
    .filter(o => o.n);
  if (nombres.length) {
    const zone = document.createElement('div');
    zone.className = 'carte-lies';
    nombres.forEach(({ colId, n }) => {
      const compte = document.createElement('span');
      compte.className = 'carte-lies-compte';
      compte.textContent = `${libelle(colId)} ${n}`;
      zone.appendChild(compte);
    });
    carte.appendChild(zone);
  }
}

function message(texte) {
  const div = document.createElement('div');
  div.className = 'message';
  div.textContent = texte;
  return div;
}

/* ══════════════════════════════════════════════════════════════
   4 ter. REGROUPEMENT EN ZONES REPLIABLES (#233)
   Les cartes affichées (après filtres et recherche, dans l'ordre du tri)
   sont réparties en zones, une par valeur de la colonne ETAT.groupe :
     - Choix, Choix multiple : dans l'ordre des choix de Grist ;
     - Référence, Liste de références : de A à Z sur le nom affiché ;
     - Case à cocher : « ✓ oui », puis « ✗ non » ;
     - « ⚠️ invalide » (cellule en erreur), puis « (vide) », toujours à la fin.
   Une carte à plusieurs valeurs (choix multiple, liste de références)
   figure dans chacune de ses zones. Seules les zones non vides s'affichent.
   La colonne est enregistrée dans la vue (champ « regroupement ») ; les
   zones repliées sont retenues par le navigateur, pour chaque vue et
   chaque colonne : replier une zone ne modifie pas la vue.
   ══════════════════════════════════════════════════════════════ */

const GROUPE_VIDE = '(vide)';
const GROUPE_INVALIDE = '⚠️ invalide';   // texte donné par elementsAffiches()

/**
 * Valeurs de la carte `ligne` pour la colonne `colId` : ses zones. Une
 * seule en général, plusieurs pour une liste, « (vide) » s'il n'y en a pas.
 */
function zonesDe(ligne, colId) {
  const valeurs = [...new Set(elementsAffiches(colId, ligne[colId]))];
  return valeurs.length ? valeurs : [GROUPE_VIDE];
}

/** Ordre des zones : voir l'en-tête de cette partie. */
function comparerZones(colId, a, b) {
  const rangFin = (v) => (v === GROUPE_VIDE ? 2 : v === GROUPE_INVALIDE ? 1 : 0);
  if (rangFin(a) || rangFin(b)) return rangFin(a) - rangFin(b);
  const colonne = info(colId);
  if (colonne.type === 'Bool') return (a === '✓ oui' ? 0 : 1) - (b === '✓ oui' ? 0 : 1);
  const choix = colonne.choix || [];
  if (/^Choice/.test(colonne.type)) {
    // Un choix inconnu de Grist (ancienne valeur) passe après les choix déclarés
    const rang = (v) => (choix.includes(v) ? choix.indexOf(v) : choix.length);
    if (rang(a) !== rang(b)) return rang(a) - rang(b);
  }
  return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
}

/**
 * Zones de la colonne `colId` pour les cartes `lignes` (déjà triées) :
 * [{ valeur, lignes }], dans l'ordre d'affichage.
 */
function calculerZones(lignes, colId) {
  const zones = new Map();
  lignes.forEach(ligne => zonesDe(ligne, colId).forEach(valeur => {
    if (!zones.has(valeur)) zones.set(valeur, []);
    zones.get(valeur).push(ligne);
  }));
  return [...zones.keys()]
    .sort((a, b) => comparerZones(colId, a, b))
    .map(valeur => ({ valeur, lignes: zones.get(valeur) }));
}

/* ── Zones repliées, retenues par le navigateur ──
   Une seule entrée de mémoire par Galerie : { 'vue|colonne': [valeurs] }.
   Si la mémoire est indisponible (navigation privée…), le choix vaut pour
   la séance seulement. */

let _repliees = null;   // copie en mémoire vive, lue au premier besoin

function lireRepliees() {
  if (_repliees) return _repliees;
  const cle = cleMemoire('groupesReplies');
  if (!cle) return {};   // document pas encore connu : on relira plus tard
  _repliees = {};
  try {
    const lu = JSON.parse(localStorage.getItem(cle) || '{}');
    if (lu && typeof lu === 'object' && !Array.isArray(lu)) _repliees = lu;
  } catch (err) { /* mémoire illisible : rien de replié */ }
  return _repliees;
}

/** Clé de la vue active et de la colonne de regroupement, dans la mémoire des zones repliées. */
function cleRepliees() { return `${VUES.activeId()}|${ETAT.groupe}`; }

function estRepliee(valeur) {
  return (lireRepliees()[cleRepliees()] || []).includes(valeur);
}

/** Replie (`repliee` vrai) ou déplie la zone `valeur`, et le retient. */
function retenirRepliee(valeur, repliee) {
  const toutes = lireRepliees();
  const liste = (toutes[cleRepliees()] || []).filter(v => v !== valeur);
  if (repliee) liste.push(valeur);
  if (liste.length) toutes[cleRepliees()] = liste; else delete toutes[cleRepliees()];
  try {
    const cle = cleMemoire('groupesReplies');
    if (cle) localStorage.setItem(cle, JSON.stringify(toutes));
  } catch (err) { /* le choix vaut pour la séance seulement */ }
}

/** Dessine les zones dans la grille : un en-tête cliquable, puis ses cartes. */
function dessinerGroupes(grille, lignes) {
  const colId = ETAT.groupe;
  calculerZones(lignes, colId).forEach(({ valeur, lignes: cartes }) => {
    const zone = document.createElement('section');
    zone.className = 'groupe';
    zone.dataset.valeur = valeur;

    const entete = document.createElement('button');
    entete.type = 'button';
    entete.className = 'groupe-entete';
    const fleche = document.createElement('span');
    fleche.className = 'groupe-fleche';
    const nom = document.createElement('span');
    nom.className = 'pastille groupe-nom' + (valeur === GROUPE_INVALIDE ? ' pastille-erreur' : '');
    nom.textContent = valeur;
    const couleur = valeur === GROUPE_VIDE || valeur === GROUPE_INVALIDE ? null : couleurPastille(colId, valeur);
    if (couleur) { nom.style.background = couleur.fond; nom.style.color = couleur.texte; }
    const nombre = document.createElement('span');
    nombre.className = 'groupe-nombre';
    nombre.textContent = String(cartes.length);
    entete.append(fleche, nom, nombre);

    const contenu = document.createElement('div');
    contenu.className = 'groupe-cartes';
    cartes.forEach(ligne => contenu.appendChild(construireCarte(ligne)));

    /** Affiche la zone repliée ou dépliée (sans redessiner la grille). */
    const montrer = (repliee) => {
      zone.classList.toggle('repliee', repliee);
      contenu.hidden = repliee;
      fleche.textContent = repliee ? '▸' : '▾';
      entete.setAttribute('aria-expanded', String(!repliee));
      entete.title = `${libelle(colId)} : ${valeur} — cliquer pour ${repliee ? 'déplier' : 'replier'}`;
    };
    montrer(estRepliee(valeur));
    entete.addEventListener('click', () => {
      const repliee = !zone.classList.contains('repliee');
      retenirRepliee(valeur, repliee);
      montrer(repliee);
    });

    zone.append(entete, contenu);
    grille.appendChild(zone);
  });
}

/* ── Onglet « Regrouper » de « Gérer la vue » et bouton de la barre ── */

/** Libellé d'une colonne de regroupement (« Projet »), même absente de la table. */
function libelleGroupe(colId) {
  const c = ETAT.colonnesTable.find(c => c.colId === colId);
  return c ? c.label : colId;
}

/** Liste « Aucun » + colonnes groupables, sur la colonne affichée. */
function remplirGroupes() {
  const choix = document.getElementById('groupe-colonne');
  choix.innerHTML = '';
  const option = (valeur, texte) => {
    const o = document.createElement('option');
    o.value = valeur;
    o.textContent = texte;
    choix.appendChild(o);
  };
  option('', 'Aucun regroupement');
  ETAT.colonnesGroupables.forEach(c => option(c.colId, c.label));
  // Colonne enregistrée dans la vue mais absente de la table (renommée, supprimée)
  if (ETAT.groupe && !ETAT.colonnesGroupables.some(c => c.colId === ETAT.groupe)) {
    option(ETAT.groupe, `${ETAT.groupe} (absente)`);
  }
  choix.value = ETAT.groupe || '';
}

/** Bouton-résumé de la barre : « ▤ Regrouper », ou « ▤ Projet ». */
function majBoutonGroupes() {
  const bouton = document.getElementById('groupe-bouton');
  bouton.classList.toggle('actif', !!ETAT.groupe);
  bouton.textContent = ETAT.groupe ? `▤ ${libelleGroupe(ETAT.groupe)}` : '▤ Regrouper';
  bouton.title = ETAT.groupe
    ? `Cartes regroupées par « ${libelleGroupe(ETAT.groupe)} »`
    : 'Regrouper les cartes selon une colonne, en zones repliables';
}

/** Une autre colonne (ou aucune) choisie dans l'onglet Regrouper. */
function changerGroupe(colId) {
  ETAT.groupe = colId || null;
  afficherGrille();
}

/* ══════════════════════════════════════════════════════════════
   4 bis. FILTRES ET VUES ENREGISTRÉES (#204)
   La barre des vues, ses petits panneaux, la fenêtre « Gérer la vue » et
   les panneaux des filtres et du tri (#232) sont construits par les
   modules communs avec le Kanban (../_commun/vues.js, filtres.js et
   tri.js). La Galerie leur prête son état affiché (ETAT.filtres, ETAT.tri)
   et ses cartes, et redessine la grille quand ils changent quelque chose.
   ══════════════════════════════════════════════════════════════ */

let UI_VUES = null;          // interface des vues, créée au chargement de la page
let PANNEAU_FILTRES = null;  // panneau des filtres, dans l'onglet Filtres de « Gérer la vue »
let PANNEAU_TRI = null;      // panneau du tri, dans l'onglet Tri de « Gérer la vue » (#232)

/** Filtres et tri de la vue active, copiés : les modifier ne touche pas la vue. */
function appliquerVue() {
  const vue = VUES.active();
  ETAT.filtres = vue ? Filtres.copier(vue.filtres) : [];
  // Tri.nettoyer renvoie une copie bien formée (la vue vient du document ou du navigateur)
  ETAT.tri = vue ? Tri.nettoyer(vue.tri) : [];
  // Regroupement (#233) : un identifiant de colonne, sinon aucun
  ETAT.groupe = vue && typeof vue.regroupement === 'string' && vue.regroupement ? vue.regroupement : null;
}

/** Onglets des vues, étiquettes des filtres et bas de « Gérer la vue », à jour. */
function majBarreVues() {
  if (!UI_VUES) return;
  PANNEAU_FILTRES.dessinerEtiquettes();   // qui met aussi à jour « 🔽 Filtres »
  UI_VUES.dessinerBarre();
  UI_VUES.majFenetre();
}

/** Colonnes rapportées de la référence `colId` (ex. pour 'Projet' : Projet › Statut). */
function attributsDe(colId) {
  return ETAT.colonnesTable.filter(c => c.ref === colId);
}

/**
 * Couleur Grist d'un choix ({ fond, texte }), ou null s'il n'en a pas.
 * Une colonne rapportée ($Taches.statut) n'a pas de couleurs à elle : on
 * prend celles de sa colonne d'origine (#184).
 */
function styleChoix(colId, texte) {
  const source = (ETAT.colonnesTable.find(c => c.colId === colId) || {}).source;
  return info(colId).couleurs[texte] || (source && source.couleurs[texte]) || null;
}

function creerPanneauFiltres(zone) {
  PANNEAU_FILTRES = Filtres.creerPanneau({
    zone,
    colonnes:         () => ETAT.colonnesFiltrables,
    filtres:          () => ETAT.filtres,
    remplacerFiltres: (liste) => { ETAT.filtres = liste; },
    lignes:           () => ETAT.lignes,
    choixDe:          (colId) => info(colId).choix,   // ordre des choix de Grist (#236)
    styleChoix,
    attributsDe,
    // Attributs affichés (#223) : retenus par le navigateur, comme les vues perso
    memoire:          MEMOIRE_ATTRIBUTS,
    surChangement:    afficherGrille,
    // Résumés de la barre, à jour après chaque dessin des étiquettes
    surEtiquettes:    () => {
      if (UI_VUES) UI_VUES.majBoutonFiltres();
      if (PANNEAU_TRI) PANNEAU_TRI.majBouton();
      majBoutonGroupes();
    },
  });
  return PANNEAU_FILTRES;
}

/**
 * Panneau du tri (#232), commun avec le Kanban : toutes les colonnes de la
 * table sont proposées (plus « # Numéro », ajouté par le module).
 * « ＋ Ajouter un critère » propose d'abord une colonne de pastilles, puis
 * le titre : ce que l'on voit sur la carte.
 */
function creerPanneauTri(zone) {
  PANNEAU_TRI = Tri.creerPanneau({
    zone,
    bouton:        document.getElementById('tri-bouton'),
    colonnes:      () => ETAT.colonnesTable,
    typeDe:        (colId) => info(colId).type,
    tri:           () => ETAT.tri,
    remplacerTri:  (tri) => { ETAT.tri = tri; },
    preferees:     () => [...colonnesPastilles(), ETAT.colonnes && ETAT.colonnes.Titre],
    texteVide:     'Aucun tri choisi : les cartes suivent l\'ordre de Grist.',
    aide:          'Les cartes sans valeur restent en bas ; à égalité, l\'ordre de Grist départage.',
    bulleVide:     'Trier les cartes (par défaut : ordre de Grist)',
    surChangement: afficherGrille,
  });
}

function creerInterfaceVues() {
  creerPanneauTri(document.getElementById('fv-tri'));   // avant l'interface, qui reçoit son onglet
  UI_VUES = Vues.creerInterface(VUES, {
    barre:            document.getElementById('barre-vues'),
    zoneVues:         document.getElementById('view-tabs'),
    zoneResumes:      document.getElementById('resumes-vue'),
    filtres:          () => ETAT.filtres,
    remplacerFiltres: (liste) => { ETAT.filtres = liste; },
    tri:              () => ETAT.tri,
    remplacerTri:     (tri) => { ETAT.tri = tri; },
    nettoyerTri:      Tri.nettoyer,
    appliquerVue,
    redessiner:       afficherGrille,
    compter:          () => ({ affichees: lignesVisibles().length, total: ETAT.lignes.length }),
    panneauFiltres:   creerPanneauFiltres,
    // Onglets Tri (#232) et Regrouper (#233), remplis à chaque ouverture de la fenêtre
    onglets: [
      { id: 'tri',     libelle: 'Tri',       contenu: document.getElementById('fv-tri') },
      { id: 'groupes', libelle: 'Regrouper', contenu: document.getElementById('fv-groupes') },
    ],
    surOuverture:     () => { PANNEAU_TRI.remplir(); remplirGroupes(); },
    // Regroupement (#233) : repris par une nouvelle vue, écrit par 💾,
    // photographié à l'ouverture de la fenêtre pour qu'Annuler le rétablisse
    contenu:          () => ({ regroupement: ETAT.groupe }),
    garderContenu:    (vue) => { vue.regroupement = ETAT.groupe; },
    photographier:    () => ETAT.groupe,
    restaurer:        (groupe) => { ETAT.groupe = groupe; },
    modifiee:         (groupe) => ETAT.groupe !== groupe,
    decrireContenu:   'les filtres, le tri et le regroupement',
    aideDefaut:       'Toutes les lignes que Grist envoie à la Galerie',
    prevenir:         afficherToast,
  });
}

/**
 * Un petit panneau flottant (vues, filtres) est-il ouvert ? Ceux posés dans
 * la fenêtre « Gérer la vue » (le panneau du tri, #232) ne comptent pas :
 * ils ne sont jamais masqués, ils suivent la fenêtre.
 */
function panneauOuvert() {
  return [...document.querySelectorAll('.filtre-popover')]
    .some(p => !p.classList.contains('hidden') && !p.closest('.fenetre'));
}

/* ══════════════════════════════════════════════════════════════
   5. FICHE
   ══════════════════════════════════════════════════════════════ */

const panneau = () => document.getElementById('fiche');

function ficheModifiee() { return Object.keys(ETAT.fiche.modifs).length > 0; }

function ouvrirFiche(id) {
  if (ficheModifiee() && ETAT.fiche.id !== id) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  ETAT.fiche = { id, nouvelle: false, modifs: {} };
  remplirFiche(id);
  Fiche.ouvrir(panneau());
  // Déplace le curseur de Grist sur la ligne : les vues liées à ce widget
  // (« Sélectionner par ») suivent la carte ouverte.
  grist.setCursorPos({ rowId: id }).catch(() => {});
}

/**
 * Ouvre une fiche vide pour une nouvelle carte, avec le modèle de texte et
 * les valeurs imposées par la vue (#186).
 * Rien n'est créé dans Grist avant « Sauvegarder » : fermer la fiche ne
 * laisse donc aucune ligne vide.
 */
async function ouvrirNouvelleFiche() {
  if (ficheModifiee()) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  const vue = await preparerVueNouvelleCarte();
  ETAT.fiche = { id: null, nouvelle: true, modifs: {}, vue };
  remplirFiche(null);
  Fiche.ouvrir(panneau());
  const titre = document.querySelector('#fiche-corps .fiche-titre');
  if (titre && !titre.readOnly) titre.focus();
}

/* ── Nouvelle carte d'après la vue (#186) ───────────────────────
   Règles communes avec le Kanban dans ../_commun/filtres.js (section
   2 bis) : la nouvelle carte reçoit les valeurs que les filtres « est » de
   la vue imposent (une seule valeur cochée), y compris dans des colonnes
   qui ne sont pas des pastilles ; les menus des pastilles montrent d'abord
   les valeurs de la vue ; un avis prévient si la carte sera masquée. */

/**
 * Ce que la vue active impose à une nouvelle carte :
 *   ecrites   : { colId: valeur au format d'écriture de Grist } ;
 *   affichees : { colId: valeur au format d'onRecords } (nom d'une référence,
 *               liste pour un choix multiple), pour les pastilles et l'avis ;
 *   vides     : colonnes modifiables qui resteront vides (pour l'avis).
 * Titre, texte principal et colonnes calculées ne sont pas concernés.
 */
async function preparerVueNouvelleCarte() {
  const vue = { ecrites: {}, affichees: {}, vides: [] };
  if (!ETAT.doc || !ETAT.colonnes) return vue;
  const valeurs = Filtres.valeursAPreremplir(ETAT.filtres);
  // Structure relue s'il faut retrouver des numéros de références : une
  // ligne ajoutée entre-temps dans la table visée doit être trouvée.
  let doc = ETAT.doc;
  try {
    if (Object.keys(valeurs).length) doc = await Colonnes.lireDocument();
  } catch (err) {
    console.warn('Galerie – structure non relue, celle du chargement sert :', err);
  }
  const exclues = [ETAT.colonnes.Titre, ETAT.colonnes.Description];
  for (const c of doc.colonnes(ETAT.table)) {
    if (c.formule || exclues.includes(c.colId)) continue;
    let ecrite;
    if (c.colId in valeurs) {
      try {
        ecrite = await Colonnes.valeurAEcrire(doc, ETAT.table, c.colId, valeurs[c.colId]);
      } catch (err) {
        console.warn(`Galerie – préremplissage de « ${c.colId} » impossible :`, err);
      }
    }
    if (ecrite === undefined) { vue.vides.push(c.colId); continue; }
    vue.ecrites[c.colId] = ecrite;
    const estListe = c.typeBase === 'ChoiceList' || c.typeBase === 'RefList';
    vue.affichees[c.colId] = estListe ? [valeurs[c.colId]] : valeurs[c.colId];
  }
  return vue;
}

/** Libellé d'une colonne, tel que l'affichent les filtres (« Projet › Statut »…). */
function libelleFiltre(colId) {
  return (ETAT.colonnesTable.find(c => c.colId === colId) || {}).label || libelle(colId);
}

/** La valeur affichée `valeur` de la colonne `colId` garde-t-elle la carte dans la vue ? */
function dansLaVue(colId, valeur) {
  return Filtres.valeurDansLaVue(ETAT.filtres, colId, valeur);
}

/**
 * Avis de la nouvelle fiche (#186) : colonnes préremplies qu'on ne voit pas
 * (pas en pastille), et alerte si, avec les valeurs choisies, la carte sera
 * masquée par la vue. `ligne` : la ligne « vierge » de la fiche.
 */
function majAvisVue(ligne) {
  const zone = document.getElementById('fiche-avis-vue');
  const vue = ETAT.fiche.vue;
  if (!zone || !vue) return;
  // La carte telle qu'elle sera créée, en valeurs affichées
  const carte = {};
  vue.vides.forEach(colId => { carte[colId] = ''; });
  Object.assign(carte, vue.affichees, ETAT.fiche.apercu);
  const masquee = Filtres.filtresNonRespectes(carte, ETAT.filtres);
  const pastilles = colonnesPastilles();
  Filtres.dessinerAvisVue(zone, {
    preremplies: Object.keys(vue.affichees)
      .filter(colId => !pastilles.includes(colId))
      .map(colId => ({ libelle: libelleFiltre(colId), valeur: elementsAffiches(colId, ligne[colId]).join(', ') })),
    masqueePar: [...new Set(masquee.map(f => libelleFiltre(f.col)))],
  });
}

function remplirFiche(id) {
  const nouvelle = ETAT.fiche.nouvelle;
  // Nouvelle carte : une ligne « vierge », avec le modèle comme texte et les
  // valeurs imposées par la vue (#186).
  const ligne = nouvelle
    ? { id: null, [ETAT.colonnes.Description]: ETAT.modele, ...(ETAT.fiche.vue ? ETAT.fiche.vue.affichees : {}) }
    : ETAT.lignes.find(l => l.id === id);
  if (!ligne) { fermerFiche(true); return; }   // ligne supprimée ou filtrée entre-temps
  // Pastilles choisies mais pas encore sauvegardées (#206) : on repart de Grist
  ETAT.fiche.apercu = {};

  // (« enteteFiche » et non « libelle » : ce nom désigne déjà une fonction)
  const enteteFiche = document.getElementById('fiche-libelle');
  enteteFiche.textContent = nouvelle ? 'Nouvelle carte' : 'Fiche';
  // Numéro de la carte (#244), comme dans la barre de la fiche du Kanban
  if (!nouvelle) {
    const numero = document.createElement('span');
    numero.className = 'fiche-numero';
    numero.textContent = '· #' + ligne.id;
    enteteFiche.appendChild(numero);
  }
  const corps = document.getElementById('fiche-corps');
  corps.innerHTML = '';

  // Titre (en lecture seule si la colonne est calculée par une formule)
  const colTitre = ETAT.colonnes.Titre;
  const titre = Fiche.champTitre(ligne[colTitre] ?? '', {
    placeholder:   nouvelle ? 'Titre de la nouvelle carte' : '',
    lectureSeule:  estFormule(colTitre),
    surChangement: (texte) => noterModif(colTitre, texte),
  });
  // En-tête (styles dans ../_commun/fiche.css) :
  //   à gauche, le titre puis les objets liés ;
  //   à droite (au centre) ou dessous (sur le côté), les pastilles.
  const entete = document.createElement('div');
  entete.className = 'fiche-entete';
  const principal = document.createElement('div');
  principal.className = 'fiche-entete-principal';
  const encart = document.createElement('div');
  encart.className = 'fiche-entete-pastilles';
  entete.append(principal, encart);
  corps.appendChild(entete);

  principal.appendChild(titre);
  if (estFormule(colTitre)) {
    // Une infobulle ne se découvre qu'en survolant : on l'écrit en clair.
    const note = document.createElement('div');
    note.className = 'fiche-titre-note';
    note.textContent = '🔒 Calculé par une formule : non modifiable ici';
    principal.appendChild(note);
  }

  if (nouvelle) {
    // Une nouvelle carte n'a encore ni objets liés ni contexte (à remplir une
    // fois la carte créée), mais ses pastilles se choisissent déjà, préremplies
    // d'après la vue, et un avis dit si la carte sera masquée (#186).
    dessinerPastillesFiche(encart, ligne);
    const avis = document.createElement('div');
    avis.id = 'fiche-avis-vue';
    corps.appendChild(avis);
    majAvisVue(ligne);
  } else {
    remplirEntete(ligne, principal, encart, corps);
  }

  // Texte principal en Markdown
  const colTexte = ETAT.colonnes.Description;
  if (colTexte) {
    const lib = document.createElement('div');
    lib.className = 'fiche-libelle-texte';
    lib.textContent = libelle(colTexte);
    corps.appendChild(lib);
    if (estFormule(colTexte)) {
      const rendu = document.createElement('div');
      rendu.className = 'fiche-md-rendu';
      rendu.innerHTML = Fiche.markdownVersHtml(ligne[colTexte]);   // HTML déjà nettoyé
      corps.appendChild(rendu);
    } else {
      corps.appendChild(Fiche.champMarkdown(ligne[colTexte], (texte) => noterModif(colTexte, texte)));
    }
  }

  ETAT.fiche.modifs = {};
  majIndicateur();
}

/** En-tête d'une carte existante : objets liés, pastilles et contexte. */
function remplirEntete(ligne, principal, encart, corps) {
  // Objets liés (#184) : sous l'en-tête, sur toute la largeur de la fiche
  // (plus dans la colonne du titre, que les pastilles rétrécissent) ; un
  // bloc par colonne, voir ligneObjetsLies.
  const objetsLiesColonnes = colonnesObjetsLies();
  if (objetsLiesColonnes.length) {
    const zone = document.createElement('div');
    zone.className = 'fiche-lies-zone';
    objetsLiesColonnes.forEach(colId => zone.appendChild(ligneObjetsLies(colId, ligne)));
    corps.appendChild(zone);
  }

  // Pastilles colorées, sans libellé (rappelé au survol), modifiables (#206)
  dessinerPastillesFiche(encart, ligne);

  // Contexte : paires « libellé : valeur », même vides (« — »)
  const contexte = colonnesContexte();
  if (contexte.length) {
    const liste = document.createElement('dl');
    liste.className = 'fiche-contexte';
    contexte.forEach(colId => liste.append(...ligneEntete(colId, valeurContexte(colId, ligne[colId]))));
    corps.appendChild(liste);
  }
}

/**
 * Pastilles de la fiche (#206). Une pastille modifiée affiche son nouveau
 * choix (ETAT.fiche.apercu) en attendant « ✓ Sauvegarder », qui l'écrit
 * avec le titre et le texte (ETAT.fiche.modifs). Une colonne modifiable
 * mais vide s'affiche « + Priorité », pour pouvoir la remplir ; une colonne
 * en lecture seule et vide reste omise, comme sur la carte.
 */
function dessinerPastillesFiche(encart, ligne) {
  encart.innerHTML = '';
  colonnesPastilles().forEach(colId => {
    const valeur = colId in ETAT.fiche.apercu ? ETAT.fiche.apercu[colId] : ligne[colId];
    let elements = creerPastilles(colId, valeur);
    if (pastilleModifiable(colId)) {
      if (!elements.length) elements = [pastilleVide(colId)];
      elements.forEach(p => rendreModifiable(p, colId, (ancre) =>
        ouvrirMenuPastille(ancre, colId, valeur, (ecrite, affichee) => {
          ETAT.fiche.apercu[colId] = affichee;
          noterModif(colId, ecrite);
          dessinerPastillesFiche(encart, ligne);
          majAvisVue(ligne);   // nouvelle carte : sera-t-elle masquée ? (#186)
          // Choix en attente compris (les références y sont des numéros)
          alerteCoherence(ligne, colId, choixEnAttente())
            .then(alerte => { if (alerte) afficherToast(alerte, 8000); });
        }, {
          idLigne: ligne.id,
          enAttente: choixEnAttente(),         // condition : choix en attente compris (#238)
          selonVue: ETAT.fiche.nouvelle,       // valeurs de la vue d'abord (#186)
        })));
    }
    encart.append(...elements);
  });
}

/**
 * Choix de la fiche pas encore écrits dans Grist, au format d'écriture : les
 * valeurs préremplies d'une nouvelle carte (#186), puis les modifications,
 * qui l'emportent.
 */
function choixEnAttente() {
  return { ...(ETAT.fiche.vue ? ETAT.fiche.vue.ecrites : {}), ...ETAT.fiche.modifs };
}

/**
 * Une paire de l'encart Contexte : libellé, puis les éléments donnés (ou
 * « — »). La paire est enveloppée pour prendre sa largeur naturelle (#184) :
 * une valeur courte ou vide prend peu de place, une longue liste le reste.
 */
function ligneEntete(colId, elements) {
  const paire = document.createElement('div');
  paire.className = 'fiche-contexte-paire';
  const dt = document.createElement('dt');
  dt.textContent = libelle(colId);
  const dd = document.createElement('dd');
  if (elements.length) dd.append(...elements); else dd.textContent = '—';
  paire.append(dt, dd);
  return [paire];
}

/* ── Objets liés de la fiche (#184) ──────────────────────────────
   « TÂCHES  12                                      Afficher ▾ »
   « [Relire le guide · En cours] [Rédiger… · Fait] [+ 9 autres ▾] »
   Les objets d'abord (le nombre total, puis la liste), le réglage ensuite,
   discret, à droite.
   - à côté du nom : les attributs cochés dans « Afficher ▾ » (colonnes
     rapportées, ex. $Taches.statut), même mémoire que les filtres ;
   - objets triés selon ces attributs, dans l'ordre des choix de Grist ;
   - au survol : tous les attributs de l'objet, avec leur libellé ;
   - au-delà de 2 lignes : « + n autres ▾ » ouvre la liste complète ;
   - objet de la même table que la Galerie : un clic ouvre sa fiche. */

/** Ligne d'objets liés de la colonne `colId` pour la carte `ligne`. */
function ligneObjetsLies(colId, ligne) {
  const ligneLies = document.createElement('div');
  ligneLies.className = 'fiche-lies';
  // Ligne de titre : libellé, nombre d'objets, puis « Afficher ▾ » à droite
  const tete = document.createElement('div');
  tete.className = 'fiche-lies-tete';
  const lib = document.createElement('span');
  lib.className = 'fiche-lies-libelle';
  lib.textContent = libelle(colId);
  tete.appendChild(lib);
  const nombre = objetsLies(colId, ligne).length;
  if (nombre) {
    const compte = document.createElement('span');
    compte.className = 'fiche-lies-nombre';
    compte.textContent = String(nombre);
    tete.appendChild(compte);
  }
  ligneLies.appendChild(tete);

  const bloc = document.createElement('div');
  bloc.className = 'fiche-liste fiche-lies-liste';
  const dessiner = () => dessinerObjetsLies(bloc, colId, ligne);

  const possibles = attributsDe(colId);
  if (possibles.length && nombre) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'fiche-lies-afficher';
    const majBouton = () => {
      const n = MEMOIRE_ATTRIBUTS.affiches(colId, possibles.map(c => c.colId)).length;
      bouton.textContent = n ? `Afficher (${n}) ▾` : 'Afficher ▾';
      bouton.classList.toggle('actif', n > 0);
    };
    bouton.title = 'Attributs affichés à côté de chaque élément (retenu par ce navigateur, comme dans les filtres)';
    bouton.addEventListener('click', () => Fiche.menuChoix(bouton, {
      options:   possibles.map(c => ({ valeur: c.colId, libelle: c.attribut })),
      selection: MEMOIRE_ATTRIBUTS.affiches(colId, possibles.map(c => c.colId)),
      multiple:  true,
      surChoix:  (choisis) => {
        MEMOIRE_ATTRIBUTS.definir(colId, choisis, possibles.map(c => c.colId));
        majBouton();
        dessiner();
      },
    }));
    majBouton();
    tete.appendChild(bouton);
  }
  ligneLies.appendChild(bloc);
  dessiner();
  return ligneLies;
}

/**
 * Objets de la colonne `colId` pour la carte `ligne`, triés :
 * [{ nom, rang, morceaux, bulle }]. rang = place dans la cellule (avant le
 * tri) ; morceaux = attributs cochés (format de Fiche.dessinerAttributs) ;
 * bulle = tous les attributs, « Libellé : valeur », un par ligne.
 */
function objetsLies(colId, ligne) {
  const valeur = ligne[colId];
  if (estErreur(valeur)) return [{ nom: '⚠️ invalide', rang: 0, morceaux: [], bulle: '', textes: [] }];
  const brute = decoderListe(valeur);
  const noms = Array.isArray(brute) ? brute : (brute ? [brute] : []);
  const tous = attributsDe(colId);
  const affiches = MEMOIRE_ATTRIBUTS.affiches(colId, tous.map(c => c.colId))
    .map(a => tous.find(c => c.colId === a));
  // Attribut de l'objet n° k : la colonne rapportée donne une liste dans le
  // même ordre que les objets. Longueurs différentes : on ne sait pas, on se tait.
  const texte = (a, k) => {
    const cellule = decoderListe(ligne[a.colId]);
    if (!Array.isArray(cellule) || cellule.length !== noms.length) return '';
    return Filtres.texteAttribut(cellule[k], a.type);
  };
  const objets = noms.map((nom, k) => {
    const textes = affiches.map(a => texte(a, k));
    return {
      nom: valeurSimple(info(colId), nom),
      rang: k,
      textes,
      morceaux: affiches.map((a, i) => textes[i] ? [{ texte: textes[i], style: styleChoix(a.colId, textes[i]) }] : null)
        .filter(Boolean),
      bulle: tous.map(a => `${a.attribut} : ${texte(a, k) || '—'}`).join('\n'),
    };
  }).filter(o => o.nom);
  // Tri selon les attributs affichés, dans l'ordre de leurs choix dans Grist
  // (« À faire », « En cours », « Fait »…) ; inconnus et vides à la fin ;
  // à égalité, l'ordre de Grist.
  const ordres = affiches.map(a => {
    const source = (ETAT.colonnesTable.find(c => c.colId === a.colId) || {}).source;
    return source ? source.choix : [];
  });
  const place = (i, t) => { const p = ordres[i].indexOf(t); return p === -1 ? Infinity : p; };
  return objets.sort((x, y) => {
    for (let i = 0; i < ordres.length; i++) {
      if (!ordres[i].length) continue;
      const d = place(i, x.textes[i]) - place(i, y.textes[i]);
      if (d && !Number.isNaN(d)) return d;
    }
    return x.rang - y.rang;
  });
}

/** (Re)dessine les objets liés dans `bloc`, limités à 2 lignes. */
function dessinerObjetsLies(bloc, colId, ligne) {
  const objets = objetsLies(colId, ligne);
  bloc.replaceChildren();
  if (!objets.length) {
    const vide = document.createElement('span');
    vide.className = 'fiche-lies-vide';
    vide.textContent = '—';
    bloc.appendChild(vide);
    return;
  }
  const ouvrable = info(colId).tableVisee === ETAT.table;
  const puces = objets.map(o => {
    const puce = document.createElement(ouvrable ? 'button' : 'span');
    puce.className = 'fiche-liste-element fiche-lie' + (ouvrable ? ' fiche-lie-ouvrable' : '');
    if (ouvrable) {
      puce.type = 'button';
      puce.addEventListener('click', () => ouvrirObjetLie(ligne.id, colId, o.rang));
    }
    const nom = document.createElement('span');
    nom.className = 'fiche-lie-nom';
    nom.textContent = o.nom;
    puce.appendChild(nom);
    if (o.morceaux.length) {
      const zone = document.createElement('span');
      zone.className = 'fiche-lie-attributs';
      Fiche.dessinerAttributs(zone, o.morceaux);
      puce.appendChild(zone);
    }
    // Bulle : tous les attributs (le navigateur l'affiche au survol)
    puce.title = o.bulle ? `${o.nom}\n${o.bulle}` : o.nom;
    return puce;
  });
  bloc.append(...puces);

  // « + n autres ▾ » : la liste complète, avec recherche
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'fiche-lies-plus';
  plus.hidden = true;
  plus.addEventListener('click', () => Fiche.menuRecherche(plus, {
    options: objets.map(o => ({ valeur: o.rang, libelle: o.nom, detail: Filtres.texteMorceaux(o.morceaux) })),
    placeholder: `Rechercher dans ${libelle(colId)}…`,
    surChoix: (rang) => { if (ouvrable) ouvrirObjetLie(ligne.id, colId, rang); },
  }));
  bloc.appendChild(plus);
  limiterADeuxLignes(bloc, puces, plus);
}

/**
 * Ne garde visibles que les puces qui tiennent sur 2 lignes, le bouton
 * « + n autres ▾ » compris. Mesuré après l'affichage, puis à chaque
 * changement de largeur de la fiche (côté / centre, fenêtre redimensionnée).
 */
function limiterADeuxLignes(bloc, puces, plus) {
  const ajuster = () => {
    if (!bloc.isConnected || !bloc.offsetWidth) return;
    puces.forEach(p => { p.hidden = false; });
    plus.hidden = true;
    const hauts = [...new Set(puces.map(p => p.offsetTop))].sort((a, b) => a - b);
    if (hauts.length <= 2) return;
    // Trop long : on masque depuis la fin jusqu'à ce que le bouton tienne en 2e ligne
    plus.hidden = false;
    let visibles = puces.length;
    do {
      puces[--visibles].hidden = true;
      const n = puces.length - visibles;
      plus.textContent = `+ ${n} autre${n > 1 ? 's' : ''} ▾`;
    } while (visibles > 1 && plus.offsetTop > hauts[1]);
  };
  let largeur = null;
  // Un seul observateur par bloc : celui d'un dessin précédent est arrêté
  if (bloc._observateur) bloc._observateur.disconnect();
  bloc._observateur = new ResizeObserver(() => {
    if (bloc.offsetWidth === largeur) return;   // seule la largeur compte (masquer change la hauteur)
    largeur = bloc.offsetWidth;
    // Juste après : masquer des puces pendant que le navigateur mesure
    // provoquerait l'erreur « ResizeObserver loop… »
    setTimeout(ajuster, 0);
  });
  bloc._observateur.observe(bloc);
  // Premier repli juste après l'affichage de la fiche (le bloc est alors dans
  // la page). Pas requestAnimationFrame : il attend que le navigateur dessine
  // une image, ce qui peut tarder ; lire les positions suffit à faire calculer
  // la mise en page.
  setTimeout(ajuster, 0);
}

/**
 * Ouvre la fiche d'un objet lié de la même table que la Galerie (#184).
 * Grist envoie les objets sous leur nom ; on relit la carte pour avoir leur
 * NUMÉRO, au même rang : deux objets homonymes ne se confondent pas.
 */
async function ouvrirObjetLie(idCarte, colId, rang) {
  try {
    const table = await grist.docApi.fetchTable(ETAT.table);
    const ids = decoderListe(table[colId][table.id.indexOf(idCarte)]);
    const id = Array.isArray(ids) ? ids[rang] : null;
    if (!id) return;
    if (!ETAT.lignes.some(l => l.id === id)) {
      afficherToast('Cette carte n\'est pas envoyée à la Galerie (« Sélectionner par » ou filtre de la vue Grist)', 4000);
      return;
    }
    ouvrirFiche(id);
  } catch (err) {
    console.warn('Galerie – objet lié introuvable :', err);
    afficherToast('⚠️ Impossible d\'ouvrir cet élément', 3000);
  }
}

/**
 * Valeur d'une colonne de contexte : un texte simple, ou, pour une liste
 * (les tâches d'un EPIC…), une pastille blanche par élément, plus lisible
 * qu'une énumération séparée par des virgules.
 */
function valeurContexte(colId, valeur) {
  const elements = elementsAffiches(colId, valeur);
  const estListe = Array.isArray(valeur) && !estErreur(valeur);
  if (!estListe) return elements.length ? [document.createTextNode(elements.join(', '))] : [];
  const bloc = document.createElement('div');
  bloc.className = 'fiche-liste';
  elements.forEach(texte => {
    const puce = document.createElement('span');
    puce.className = 'fiche-liste-element';
    puce.textContent = texte;
    bloc.appendChild(puce);
  });
  return elements.length ? [bloc] : [];
}

function noterModif(colId, valeur) {
  ETAT.fiche.modifs[colId] = valeur;
  majIndicateur();
}

function majIndicateur() {
  document.getElementById('fiche-modifie').classList.toggle('visible', ficheModifiee());
  // Une nouvelle carte peut être créée telle quelle (avec le modèle) ;
  // une carte existante seulement s'il y a quelque chose à enregistrer.
  document.getElementById('fiche-sauver').disabled = !(ficheModifiee() || ETAT.fiche.nouvelle);
}

async function sauverFiche() {
  if (ETAT.fiche.nouvelle) { await creerCarte(); return; }
  if (!ficheModifiee() || ETAT.fiche.id === null) return;
  const bouton = document.getElementById('fiche-sauver');
  bouton.disabled = true;
  bouton.textContent = '…';
  try {
    await grist.docApi.applyUserActions([['UpdateRecord', ETAT.table, ETAT.fiche.id, ETAT.fiche.modifs]]);
    ETAT.fiche.modifs = {};
    afficherToast('✓ Modifications sauvegardées');
  } catch (err) {
    afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Galerie – erreur de sauvegarde :', err);
  } finally {
    bouton.textContent = '✓ Sauvegarder';
    majIndicateur();
  }
}

/**
 * Crée dans Grist la carte de la fiche « nouvelle carte » : titre saisi,
 * texte principal (le modèle, éventuellement modifié), pastilles choisies
 * et valeurs imposées par la vue (#186). La fiche reste ouverte sur la
 * carte créée.
 */
async function creerCarte() {
  const colTitre = ETAT.colonnes.Titre;
  const colTexte = ETAT.colonnes.Description;
  if (!estFormule(colTitre) && !String(ETAT.fiche.modifs[colTitre] || '').trim()) {
    afficherToast('⚠️ Saisissez un titre avant de sauvegarder', 3000);
    const titre = document.querySelector('#fiche-corps .fiche-titre');
    if (titre) titre.focus();
    return;
  }
  // Le modèle d'abord, puis les valeurs imposées par la vue (#186), puis ce
  // qui a été saisi ou choisi (qui l'emporte).
  const champs = {};
  if (colTexte && !estFormule(colTexte) && ETAT.modele) champs[colTexte] = ETAT.modele;
  Object.assign(champs, choixEnAttente());

  const bouton = document.getElementById('fiche-sauver');
  bouton.disabled = true;
  bouton.textContent = '…';
  try {
    const resultat = await grist.docApi.applyUserActions([['AddRecord', ETAT.table, null, champs]]);
    const id = resultat.retValues[0];   // numéro de la ligne créée
    ETAT.fiche = { id, nouvelle: false, modifs: {} };
    grist.setCursorPos({ rowId: id }).catch(() => {});
    if (await attendreLigne(id)) {
      remplirFiche(id);
      // La fiche reste ouverte, mais la carte peut ne pas figurer dans la
      // grille : les filtres de la vue active la masquent (#204).
      const ligne = ETAT.lignes.find(l => l.id === id);
      afficherToast(respecteFiltres(ligne)
        ? '✓ Carte créée'
        : '✓ Carte créée ; elle est masquée par les filtres de la vue', 4000);
    } else {
      // Grist ne l'a pas renvoyée : un filtre de la vue la masque.
      fermerFiche(true);
      afficherToast(`✓ Carte créée (ligne n° ${id}) ; elle est peut-être masquée par un filtre de Grist `
        + '(« Sélectionner par », filtres de la vue Grist)', 6000);
    }
  } catch (err) {
    afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Galerie – erreur de création :', err);
  } finally {
    bouton.textContent = '✓ Sauvegarder';
    majIndicateur();
  }
}

/**
 * Attend que Grist renvoie (par onRecords) une ligne qui vient d'être
 * créée. Renvoie false si elle n'arrive pas : elle est alors filtrée.
 */
async function attendreLigne(id, delaiMax = 2000) {
  for (let attente = 0; attente < delaiMax; attente += 100) {
    if (ETAT.lignes.some(l => l.id === id)) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return ETAT.lignes.some(l => l.id === id);
}

function fermerFiche(force = false) {
  if (ficheModifiee() && !force) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  Fiche.fermer(panneau());
  ETAT.fiche = { id: null, nouvelle: false, modifs: {} };
  majIndicateur();
}

function afficherToast(texte, duree = 2200) {
  const toast = document.getElementById('toast');
  toast.textContent = texte;
  toast.classList.add('visible');
  clearTimeout(afficherToast.minuteur);
  afficherToast.minuteur = setTimeout(() => toast.classList.remove('visible'), duree);
}

/* ══════════════════════════════════════════════════════════════
   6. RÉGLAGES (bouton ⚙) : NOM DE LA GALERIE, MODÈLE DES NOUVELLES CARTES
   ══════════════════════════════════════════════════════════════ */

const LONGUEUR_NOM_GALERIE = 60;   // assez pour « EPICs Observatoire des trafics »

/** Nom de Galerie tel qu'on le range : texte, sans espaces autour, 60 caractères au plus. */
function nettoyerNomGalerie(nom) {
  return typeof nom === 'string' ? nom.trim().slice(0, LONGUEUR_NOM_GALERIE) : '';
}

/**
 * Le nom de la Galerie a changé (#264) : les clés de mémoire du navigateur
 * aussi. On relit tout sous les nouvelles clés, comme à l'ouverture : vues
 * perso et vue active (à défaut, « Toutes les cartes »), zones repliées,
 * taille des cartes ; les attributs affichés se relisent d'eux-mêmes
 * (Filtres.memoireAttributs suit la clé). Rien n'est repris de l'ancien
 * nom : on repart de zéro (choix du 2026-11-19). Les vues 👥 partagées,
 * rangées dans le document, ne changent pas.
 */
function changerNomGalerie(nom) {
  ETAT.nomGalerie = nom;
  _repliees = null;
  _tailleSeance = null;
  VUES.charger(VUES.toutes().filter(v => !v.perso));
  appliquerVue();
  afficherGrille();
}

/* Mode d'emploi, derrière le bouton « ? » (#249, règle R4), comme le Kanban.
   Le texte est écrit dans index.html (#aide-contenu) : rien de Grist n'y
   entre. Fenêtre commune à un seul onglet, sans colonne d'onglets (classe
   « fenetre-aide », style dans ../_commun/fenetre.css). */
let _fenetreAide = null;
function fenetreAide() {
  if (_fenetreAide) return _fenetreAide;
  _fenetreAide = Fenetre.creer({
    titre: '📖 Mode d\'emploi',
    onglets: [{ id: 'aide', libelle: 'Mode d\'emploi', contenu: document.getElementById('aide-contenu') }],
    actions: [{ libelle: 'Fermer', classe: 'btn-primary', fermer: true }],
  });
  _fenetreAide.element.classList.add('fenetre-aide');
  return _fenetreAide;
}

/* Fenêtre ⚙ : la brique commune ../_commun/fenetre.js, comme le Kanban, la
   Page et Interactions (#249, étape B). Elle apporte la barre du bas
   « Annuler / ✓ Appliquer » toujours visible, la marque « modifications non
   appliquées » et la confirmation si l'on ferme sans appliquer, Échap, le
   déplacement et le redimensionnement. Créée au premier usage : elle déplace
   chez elle les deux onglets écrits dans index.html. */
let _fenetreReglages = null;
function fenetreReglages() {
  if (_fenetreReglages) return _fenetreReglages;
  _fenetreReglages = Fenetre.creer({
    titre: '⚙️ Réglages de la Galerie',
    onglets: [
      { id: 'nom', libelle: 'Nom de la Galerie', contenu: document.getElementById('reglages-onglet-nom'),
        // Sans nom, la mémoire du navigateur est partagée avec les autres
        // Galeries sans nom de la même table (#264) : à savoir, pas une erreur
        etat: () => (nettoyerNomGalerie(document.getElementById('reglages-nom').value)
          ? { etat: 'ok', aide: 'Nom donné' }
          : { etat: 'info', aide: 'Sans nom : réglages du navigateur partagés avec les autres Galeries sans nom de cette table' }) },
      { id: 'modele', libelle: 'Modèle de texte', contenu: document.getElementById('reglages-onglet-modele'),
        etat: () => (document.getElementById('reglages-modele').value.trim()
          ? { etat: 'ok', aide: 'Modèle rempli' }
          : { etat: '', aide: 'Facultatif : texte proposé dans les nouvelles cartes' }) },
    ],
    actions: [
      { libelle: 'Annuler', classe: 'btn-ghost', fermer: true },
      // « Appliquer » et non « Enregistrer » : le bouton de Grist reste à cliquer ensuite (#249, étape A)
      { libelle: '✓ Appliquer', classe: 'btn-primary', surClic: enregistrerReglages },
    ],
  });
  // Identifiant d'avant (élément <dialog> propre à la Galerie) : gardé pour les bancs d'essai
  _fenetreReglages.element.id = 'reglages';
  return _fenetreReglages;
}

/** Carte dont on peut reprendre le texte : celle ouverte, sinon celle sélectionnée. */
function carteSource() {
  const id = ETAT.fiche.id ?? ETAT.selection;
  return ETAT.lignes.find(l => l.id === id) || null;
}

function ouvrirReglages() {
  document.getElementById('reglages-nom').value = ETAT.nomGalerie;
  document.getElementById('reglages-modele').value = ETAT.modele;
  const bouton = document.getElementById('reglages-reprendre');
  const source = carteSource();
  const colTexte = ETAT.colonnes && ETAT.colonnes.Description;
  bouton.disabled = !(source && colTexte);
  bouton.textContent = bouton.disabled
    ? 'Reprendre le texte d\'une carte : ouvrez ou sélectionnez-la d\'abord'
    : `↧ Reprendre le texte de « ${source[ETAT.colonnes.Titre] || '(sans titre)'} »`;
  fenetreReglages().ouvrir('nom');
}

function reprendreTexteCarte() {
  const source = carteSource();
  const colTexte = ETAT.colonnes && ETAT.colonnes.Description;
  if (!source || !colTexte) return;
  // Un ancien texte Notepad est repris directement en Markdown.
  document.getElementById('reglages-modele').value = Fiche.notepadVersMarkdown(String(source[colTexte] || ''));
  // Texte changé par le code, pas par la frappe : la fenêtre ne l'a pas vu
  fenetreReglages().marquerModifiee(true);
  fenetreReglages().majEtats();
}

async function enregistrerReglages() {
  const modele = document.getElementById('reglages-modele').value;
  const nom = nettoyerNomGalerie(document.getElementById('reglages-nom').value);
  try {
    await grist.setOption('modele', modele);
    ETAT.modele = modele;
    if (nom !== ETAT.nomGalerie) {
      await grist.setOption('nom', nom);
      changerNomGalerie(nom);
    }
    fenetreReglages().fermer({ forcer: true });
    afficherToast('✓ Réglages appliqués — cliquez sur « Enregistrer » dans Grist pour les garder', 5000);
  } catch (err) {
    afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Galerie – enregistrement des réglages impossible :', err);
  }
}

/* ══════════════════════════════════════════════════════════════
   7. CONVERSION DES ANCIENS TEXTES « NOTEPAD »
   Le widget Notepad de Grist enregistrait ses textes en JSON. Ils sont
   déjà affichés convertis ; ce bandeau propose de les réécrire en
   Markdown dans Grist, une fois pour toutes. Il disparaît de lui-même
   quand il n'y a plus rien à convertir.
   ══════════════════════════════════════════════════════════════ */

/** Colonne du texte principal, si elle peut être réécrite (sinon null). */
function colonneTexteModifiable() {
  const col = ETAT.colonnes && ETAT.colonnes.Description;
  return col && !estFormule(col) ? col : null;
}

function majBandeauNotepad() {
  const bandeau = document.getElementById('bandeau-notepad');
  const col = colonneTexteModifiable();
  const nb = col ? ETAT.lignes.filter(l => Fiche.estNotepad(l[col])).length : 0;
  bandeau.hidden = nb === 0;
  if (nb) {
    document.getElementById('bandeau-notepad-texte').textContent =
      `${nb} texte${nb > 1 ? 's' : ''} au format de l'ancien widget Notepad `
      + '(affichés ici convertis, mais enregistrés tels quels dans Grist).';
  }
}

async function convertirNotepad() {
  const col = colonneTexteModifiable();
  if (!col) return;
  // On lit la table entière : les lignes masquées par un filtre ou par
  // « Sélectionner par » sont converties aussi.
  const table = await grist.docApi.fetchTable(ETAT.table);
  const ids = [], textes = [];
  table.id.forEach((id, i) => {
    if (Fiche.estNotepad(table[col][i])) {
      ids.push(id);
      textes.push(Fiche.notepadVersMarkdown(table[col][i]));
    }
  });
  if (!ids.length) { afficherToast('Rien à convertir'); return; }

  const ok = confirm(`${ids.length} texte(s) de la colonne « ${libelle(col)} » (table ${ETAT.table}) `
    + 'vont être réécrits en Markdown, y compris dans les lignes masquées par un filtre.\n\n'
    + 'Le souligné, les couleurs et le surlignage seront perdus (le texte reste).\n'
    + 'Le widget Notepad ne saura plus les afficher.\n\nContinuer ?');
  if (!ok) return;

  const bouton = document.getElementById('bandeau-notepad-bouton');
  bouton.disabled = true;
  try {
    // Une seule action : un Ctrl+Z dans Grist annule toute la conversion.
    await grist.docApi.applyUserActions([['BulkUpdateRecord', ETAT.table, ids, { [col]: textes }]]);
    afficherToast(`✓ ${ids.length} texte(s) converti(s) en Markdown`, 3000);
  } catch (err) {
    // Le pare-feu devant Grist peut refuser un envoi contenant du SQL : on
    // repasse ligne par ligne, pour convertir tout ce qui peut l'être.
    console.warn('Galerie – conversion groupée refusée, essai ligne par ligne :', err);
    const echecs = [];
    for (let i = 0; i < ids.length; i++) {
      try {
        await grist.docApi.applyUserActions([['UpdateRecord', ETAT.table, ids[i], { [col]: textes[i] }]]);
      } catch (e) {
        echecs.push(ids[i]);
        console.error(`Galerie – ligne ${ids[i]} non convertie :`, e);
      }
    }
    afficherToast(echecs.length
      ? `⚠️ ${ids.length - echecs.length} converti(s), ${echecs.length} refusé(s) : lignes ${echecs.join(', ')}`
      : `✓ ${ids.length} texte(s) converti(s) en Markdown`, 6000);
  } finally {
    bouton.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════════
   8. ÉVÉNEMENTS DE LA PAGE
   ══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Barre des vues et « Gérer la vue » (#204) ; Grist a pu envoyer ses
  // données avant : on dessine la barre tout de suite.
  creerInterfaceVues();
  majBarreVues();
  // « ⇅ Trier » (#232) : ouvre « Gérer la vue » sur l'onglet Tri
  document.getElementById('tri-bouton').addEventListener('click', () => UI_VUES.ouvrirFenetre('tri'));
  // « ▤ Regrouper » (#233) : ouvre « Gérer la vue » sur l'onglet Regrouper
  document.getElementById('groupe-bouton').addEventListener('click', () => UI_VUES.ouvrirFenetre('groupes'));
  document.getElementById('groupe-colonne').addEventListener('change', (e) => changerGroupe(e.target.value));
  // « ▦ Moyenne ▾ » (#237) : taille des cartes
  document.getElementById('taille-bouton').addEventListener('click', ouvrirMenuTaille);
  // Un clic ailleurs ferme les panneaux des vues et des filtres (sauf sur ce qui en ouvre un)
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.fenetre, .filtre-popover, #vue-ajouter, .vue-menu-btn, .vue-selecteur, .fiche-menu')) return;
    UI_VUES.fermerMenus();
  });

  Fiche.installer(panneau(), {
    actions: document.getElementById('fiche-actions'),
    fermer:  () => fermerFiche(),
  });
  document.getElementById('fiche-fermer').addEventListener('click', () => fermerFiche());
  document.getElementById('fiche-annuler').addEventListener('click', () => fermerFiche());
  document.getElementById('fiche-sauver').addEventListener('click', sauverFiche);
  document.getElementById('btn-nouvelle').addEventListener('click', ouvrirNouvelleFiche);
  document.getElementById('btn-reglages').addEventListener('click', ouvrirReglages);
  document.getElementById('btn-aide').addEventListener('click', () => fenetreAide().ouvrir());
  document.getElementById('reglages-reprendre').addEventListener('click', reprendreTexteCarte);
  document.getElementById('bandeau-notepad-bouton').addEventListener('click', () =>
    convertirNotepad().catch(err => afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000)));
  document.getElementById('recherche').addEventListener('input', (e) => {
    ETAT.recherche = e.target.value;
    afficherGrille();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Réglages, mode d'emploi ou « Gérer la vue » ouverts : Échap ne concerne
    // qu'eux (fenetre.js les ferme elle-même, avec confirmation si besoin).
    if (fenetreReglages().estOuverte() || fenetreAide().estOuverte() || UI_VUES.fenetre.estOuverte()) return;
    // Un panneau des vues ou un filtre ouvert : on le ferme, lui seul
    if (panneauOuvert()) { UI_VUES.fermerMenus(); return; }
    if (panneau().classList.contains('open')) fermerFiche();
  });
});
