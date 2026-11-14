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
   ══════════════════════════════════════════════════════════════ */

'use strict';

const ETAT = {
  lignes:     [],     // lignes reçues de Grist
  colonnes:   null,   // association : { Titre: 'colId', Description: 'colId', Pastilles: [...], Contexte: [...] }
  table:      null,   // identifiant de la table affichée
  docNom:     null,   // identifiant du document (clés de mémoire du navigateur)
  // Filtres affichés (format de ../_commun/filtres.js) et tri affiché
  // (format de ../_commun/tri.js : [{ col, sens }], #232)
  filtres:    [],
  tri:        [],
  // Colonne de regroupement affichée (#233), ou null : cartes non regroupées
  groupe:     null,
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
  fiche:      { id: null, nouvelle: false, modifs: {}, apercu: {} },
  modele:     '',     // texte de départ des nouvelles cartes (réglage ⚙)
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

/**
 * Clé de mémoire du navigateur pour la donnée `nom` ('vueActive',
 * 'vuesPerso', 'attributs', 'groupesReplies'), ou null si le document est encore inconnu.
 * Tous les widgets publiés sur nantodevison.github.io partagent cette
 * mémoire : la clé contient donc le document et la table. Deux Galeries
 * sur la même table partagent ainsi leurs vues perso (accepté, #204).
 * NE PAS CHANGER le format de ces clés : chacun perdrait ses vues perso.
 */
function cleMemoire(nom) {
  if (!ETAT.docNom || !ETAT.table) return null;
  return `galerie.${nom}.${ETAT.docNom}.${ETAT.table}`;
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
    // « type » limite les colonnes proposées par Grist. Les listes de
    // références (RefList) sont exclues des pastilles : elles vont dans
    // « Objets liés ». Une colonne calculée sans type déclaré (« Any »,
    // comme Avancement) reste proposée partout.
    { name: 'Pastilles',   title: 'Pastilles (carte et fiche)', allowMultiple: true, optional: true,
      type: 'Text,Numeric,Int,Bool,Date,DateTime,Choice,ChoiceList,Ref' },
    { name: 'ObjetsLies',  title: 'Objets liés (sous le titre de la fiche)', allowMultiple: true, optional: true,
      type: 'RefList' },
    { name: 'Contexte',    title: 'Contexte (fiche seulement)', allowMultiple: true, optional: true },
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

// includeColumns 'normal' : toutes les colonnes de la table, même masquées
// dans le widget. Sinon une colonne masquée serait proposée dans les filtres
// sans aucune valeur (même choix que le Kanban).
grist.onRecords(async (lignes, colonnes) => {
  ETAT.lignes   = lignes;
  ETAT.colonnes = colonnes;
  try {
    await chargerInfosColonnes();
  } catch (err) {
    // Sans ces informations, le widget fonctionne quand même : libellés =
    // identifiants des colonnes, pastilles sans les couleurs de Grist, et
    // pas de filtre (on ne sait pas quelles colonnes sont des choix).
    console.error('Galerie – lecture de la structure impossible :', err);
  }
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
 * Colonnes de la table pour les filtres (#204), d'après la structure du
 * document. Seules les colonnes Choix, Choix multiple, Référence et Liste
 * de références sont filtrables (même règle que le Kanban). Une colonne
 * « rapportée » d'une autre table ($Projet.Statut) est nommée
 * « Projet › Statut » : elle sert d'attribut à sa référence (#223).
 */
function preparerColonnesFiltrables() {
  ETAT.colonnesTable = ETAT.doc.colonnes(ETAT.table).map(c => {
    const r = c.rapportee;
    return {
      colId:    c.colId,
      type:     c.type,
      label:    r ? `${r.via} › ${r.attribut}` : c.libelle,
      ref:      r ? r.colRef : null,     // référence dont elle est un attribut
      attribut: r ? r.attribut : null,   // libellé court de l'attribut
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

/**
 * Valeur d'une cellule sous forme d'une liste de textes : un seul élément
 * en général, plusieurs pour une liste (références multiples, choix
 * multiples). Les éléments vides sont retirés.
 */
function elementsAffiches(colId, valeur) {
  const colonne = info(colId);
  if (estErreur(valeur)) return ['⚠️ invalide'];
  if (Array.isArray(valeur)) {
    // Une liste peut arriver « encodée » : ['L', a, b…]
    const liste = valeur[0] === 'L' ? valeur.slice(1) : valeur;
    return liste.map(v => valeurSimple(colonne, v)).filter(Boolean);
  }
  const texte = valeurSimple(colonne, valeur);
  return texte ? [texte] : [];
}

/**
 * Une cellule en erreur (par exemple une référence vers une ligne qui
 * n'existe pas : « InvalidTypedValue ») arrive soit comme un objet
 * { name, message, details }, soit « encodée » : ['E', nom, …].
 */
function estErreur(v) {
  if (Array.isArray(v)) return v[0] === 'E';
  return Boolean(v) && typeof v === 'object' && !(v instanceof Date)
    && typeof v.name === 'string' && 'message' in v;
}

/**
 * Texte affiché d'une valeur simple, selon la description de sa colonne
 * (`colonne`, donnée par info()).
 */
function valeurSimple(colonne, v) {
  if (estErreur(v)) return '⚠️ invalide';
  if (v === null || v === undefined || v === '') return '';
  // Grist envoie une référence sous son nom affiché ; un numéro n'arrive que
  // si la référence n'affiche aucune colonne : on montre alors ce numéro.
  if (/^(Ref|RefList):/.test(colonne.type) && typeof v === 'number') {
    return v === 0 ? '' : String(v);   // 0 = référence vide
  }
  if (v instanceof Date) return v.toLocaleDateString('fr-FR');
  // Grist stocke les dates en secondes depuis le 1er janvier 1970
  if (colonne.type === 'Date' && typeof v === 'number') {
    return new Date(v * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  }
  if (colonne.type.startsWith('DateTime') && typeof v === 'number') {
    return new Date(v * 1000).toLocaleString('fr-FR');
  }
  if (typeof v === 'boolean') return v ? '✓ oui' : '✗ non';
  // Nombre affiché en pourcentage dans Grist : 0.67 → « 67 % »
  if (colonne.pourcentage && typeof v === 'number') return `${Math.round(v * 100)} %`;
  if (typeof v === 'object') return JSON.stringify(v);   // cas rares (pièces jointes…)
  // Un texte peut contenir du Markdown : on en retire les symboles.
  return colonne.type === 'Text' ? Fiche.markdownVersTexte(String(v)) : String(v);
}

/* ══════════════════════════════════════════════════════════════
   3. PASTILLES ET COULEURS
   ══════════════════════════════════════════════════════════════ */

// Pourcentages : du rouge (peu avancé) au vert (terminé)
const COULEURS_POURCENTAGE = [
  { jusqua: 33,  fond: '#fed7d7', texte: '#9b2c2c' },   // rouge
  { jusqua: 66,  fond: '#feebc8', texte: '#9c4221' },   // orange
  { jusqua: 99,  fond: '#ecf5c6', texte: '#4a6115' },   // jaune-vert
  { jusqua: 100, fond: '#c6f6d5', texte: '#22543d' },   // vert
];

/**
 * Couleur d'une pastille d'après son texte affiché, ou null (gris neutre).
 *   - choix coloré dans Grist → cette couleur ;
 *   - « 67 % »                → échelle COULEURS_POURCENTAGE ;
 *   - choix sans couleur, ou référence → pastel fixe propre à la valeur.
 */
function couleurPastille(colId, texte) {
  const colonne = info(colId);
  // Couleur de fond réglée dans Grist (texte noir si Grist n'en précise pas)
  const choix = colonne.couleurs[texte];
  if (choix && choix.fond) return { fond: choix.fond, texte: choix.texte || '#000000' };

  const pourcent = /^\s*(-?\d+(?:[.,]\d+)?)\s*%\s*$/.exec(texte);
  if (pourcent) {
    const n = parseFloat(pourcent[1].replace(',', '.'));
    return COULEURS_POURCENTAGE.find(c => n <= c.jusqua) || COULEURS_POURCENTAGE[COULEURS_POURCENTAGE.length - 1];
  }

  if (/^(Choice|ChoiceList|Ref|RefList)\b/.test(colonne.type)) return couleurPastel(texte);
  return null;
}

/**
 * Pastel calculé à partir du texte : la même valeur a toujours la même
 * couleur (d'une carte à l'autre, d'une séance à l'autre).
 */
function couleurPastel(texte) {
  let somme = 0;
  for (const caractere of texte) somme = (somme * 31 + caractere.codePointAt(0)) % 360;
  return { fond: `hsl(${somme}, 70%, 91%)`, texte: `hsl(${somme}, 45%, 28%)` };
}

/**
 * Pastilles d'une cellule : une par élément (une liste de choix en donne
 * plusieurs). Renvoie un tableau d'éléments <span>, vide si la cellule l'est.
 */
function creerPastilles(colId, valeur) {
  const erreur = estErreur(valeur);
  return elementsAffiches(colId, valeur).map(texte => {
    const p = document.createElement('span');
    p.className = 'pastille' + (erreur ? ' pastille-erreur' : '');
    p.textContent = texte;
    p.title = `${libelle(colId)} : ${texte}`;
    const couleur = erreur ? null : couleurPastille(colId, texte);
    if (couleur) { p.style.background = couleur.fond; p.style.color = couleur.texte; }
    return p;
  });
}

/* ══════════════════════════════════════════════════════════════
   3 bis. MODIFIER UNE PASTILLE (#205 sur la carte, #206 dans la fiche)
   Un clic sur une pastille ouvre un petit menu (../_commun/fiche.js),
   choisi d'après le TYPE de la colonne :
     - Choix            → la liste des choix de Grist, plus « — aucun — » ;
     - Choix multiple   → la même liste, en cases à cocher ;
     - Référence        → les lignes de la table visée, plus « — aucune — »
                          (champ de recherche au-delà de SEUIL_RECHERCHE) ;
     - Case à cocher    → oui / non ;
     - Date             → un calendrier, avec « Effacer la date ».
   Les autres colonnes (texte, nombre, colonne calculée par une formule)
   restent en lecture seule.
   Le menu ne fait que CHOISIR : c'est l'appelant qui décide quoi faire de
   la valeur (l'écrire tout de suite sur la carte, la garder jusqu'à
   « ✓ Sauvegarder » dans la fiche).
   ══════════════════════════════════════════════════════════════ */

// Types de colonnes (sans le nom de table : « Ref » pour « Ref:Projets »)
// dont la pastille se modifie d'un clic. Les listes de références n'en font
// pas partie : Grist ne les propose pas en pastilles.
const TYPES_MODIFIABLES = ['Choice', 'ChoiceList', 'Ref', 'Bool', 'Date'];
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
 */
async function ouvrirMenuPastille(ancre, colId, valeur, surChoix) {
  const colonne = info(colId);
  const erreur = estErreur(valeur);

  if (colonne.typeBase === 'Choice') {
    // Une valeur absente de la liste des choix (choix retiré dans Grist) reste proposée
    const choix = [...colonne.choix];
    if (!erreur && valeur && !choix.includes(valeur)) choix.push(valeur);
    Fiche.menuChoix(ancre, {
      options: choix.map(v => ({ valeur: v, libelle: v })),
      selection: [valeur || ''], vide: '— aucun —', valeurVide: '',
      surChoix: (v) => surChoix(v, v),
    });

  } else if (colonne.typeBase === 'ChoiceList') {
    // Grist peut envoyer la liste « encodée » : ['L', a, b…]
    const liste = Array.isArray(valeur) && !erreur ? (valeur[0] === 'L' ? valeur.slice(1) : valeur) : [];
    const choix = [...colonne.choix, ...liste.filter(v => !colonne.choix.includes(v))];
    // Menu à cases : il reste ouvert, chaque case cochée ou décochée compte.
    Fiche.menuChoix(ancre, {
      options: choix.map(v => ({ valeur: v, libelle: v })),
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
    await ouvrirMenuReference(ancre, colId, valeur, surChoix);
  }
}

/**
 * Menu d'une référence. La table visée est relue à CHAQUE ouverture : une
 * ligne ajoutée entre-temps dans Grist (un nouveau projet…) est proposée
 * tout de suite. Elle n'est jamais lue au chargement du widget (#188).
 */
async function ouvrirMenuReference(ancre, colId, valeur, surChoix) {
  let ref = null;
  try {
    // Structure relue elle aussi : elle dit quelle colonne la référence affiche.
    ref = await Colonnes.lireReference(await Colonnes.lireDocument(), ETAT.table, colId);
  } catch (err) {
    console.error('Galerie – lecture de la table visée impossible :', err);
  }
  if (!ref) { afficherToast('⚠️ Impossible de lire les valeurs possibles', 3000); return; }
  // Pendant la lecture, la grille a pu être redessinée : la pastille cliquée
  // n'est plus à l'écran, et le menu n'aurait plus où s'accrocher.
  if (!ancre.isConnected) return;

  const options = ref.options
    .map(o => ({ valeur: o.id, libelle: o.nom || `n° ${o.id}` }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
  // Grist envoie la référence sous son nom : on retrouve son numéro.
  const actuel = estErreur(valeur) ? undefined : (valeur ? ref.id(valeur) : 0);
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

function afficherGrille() {
  // Barre des vues (onglets, « 🔽 Filtres ») et bas de « Gérer la vue »
  majBarreVues();
  const grille = document.getElementById('grille');
  grille.innerHTML = '';
  document.getElementById('titre-table').textContent = '🖼️ ' + (ETAT.table || 'Galerie');

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
        ouvrirMenuPastille(ancre, colId, ligne[colId], (ecrite) => ecrireCellule(ligne, colId, ecrite))));
    }
    pastilles.append(...elements);
  });
  if (pastilles.children.length) carte.appendChild(pastilles);
  // Pas d'aperçu du texte principal : la carte reste concise (titre et
  // pastilles) ; le texte se lit dans la fiche. La place libre en bas de
  // carte pourra accueillir une image plus tard.

  carte.addEventListener('click', () => ouvrirFiche(ligne.id));
  return carte;
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

/** Couleur Grist d'un choix ({ fond, texte }), ou null s'il n'en a pas. */
function styleChoix(colId, texte) {
  return info(colId).couleurs[texte] || null;
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
    memoire:          Filtres.memoireAttributs(() => cleMemoire('attributs')),
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
 * Ouvre une fiche vide pour une nouvelle carte, avec le modèle de texte.
 * Rien n'est créé dans Grist avant « Sauvegarder » : fermer la fiche ne
 * laisse donc aucune ligne vide.
 */
function ouvrirNouvelleFiche() {
  if (ficheModifiee()) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  ETAT.fiche = { id: null, nouvelle: true, modifs: {} };
  remplirFiche(null);
  Fiche.ouvrir(panneau());
  const titre = document.querySelector('#fiche-corps .fiche-titre');
  if (titre && !titre.readOnly) titre.focus();
}

function remplirFiche(id) {
  const nouvelle = ETAT.fiche.nouvelle;
  // Nouvelle carte : une ligne « vierge », avec le modèle comme texte.
  const ligne = nouvelle
    ? { id: null, [ETAT.colonnes.Description]: ETAT.modele }
    : ETAT.lignes.find(l => l.id === id);
  if (!ligne) { fermerFiche(true); return; }   // ligne supprimée ou filtrée entre-temps
  // Pastilles choisies mais pas encore sauvegardées (#206) : on repart de Grist
  ETAT.fiche.apercu = {};

  document.getElementById('fiche-libelle').textContent = nouvelle ? 'Nouvelle carte' : 'Fiche';
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

  // Une nouvelle carte n'a encore ni objets liés, ni pastilles, ni contexte
  // (à remplir une fois la carte créée ; préremplissage : #186) : on passe au texte.
  if (!nouvelle) remplirEntete(ligne, principal, encart, corps);

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
  // Objets liés : une ligne par colonne, « LIBELLÉ  [élément] [élément]… »
  colonnesObjetsLies().forEach(colId => {
    const ligneLies = document.createElement('div');
    ligneLies.className = 'fiche-lies';
    const lib = document.createElement('span');
    lib.className = 'fiche-lies-libelle';
    lib.textContent = libelle(colId);
    const elements = valeurContexte(colId, ligne[colId]);
    if (!elements.length) {
      const vide = document.createElement('span');
      vide.className = 'fiche-lies-vide';
      vide.textContent = '—';
      elements.push(vide);
    }
    ligneLies.append(lib, ...elements);
    principal.appendChild(ligneLies);
  });

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
          // Choix en attente compris (les références y sont des numéros)
          alerteCoherence(ligne, colId, ETAT.fiche.modifs)
            .then(alerte => { if (alerte) afficherToast(alerte, 8000); });
        })));
    }
    encart.append(...elements);
  });
}

/** Une ligne de l'en-tête de la fiche : libellé, puis les éléments donnés (ou « — »). */
function ligneEntete(colId, elements) {
  const dt = document.createElement('dt');
  dt.textContent = libelle(colId);
  const dd = document.createElement('dd');
  if (elements.length) dd.append(...elements); else dd.textContent = '—';
  return [dt, dd];
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
 * texte principal (le modèle, éventuellement modifié). La fiche reste
 * ouverte sur la carte créée.
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
  // Le modèle d'abord, puis ce qui a été saisi (qui l'emporte).
  const champs = {};
  if (colTexte && !estFormule(colTexte) && ETAT.modele) champs[colTexte] = ETAT.modele;
  Object.assign(champs, ETAT.fiche.modifs);

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
   6. RÉGLAGES (bouton ⚙) : MODÈLE DES NOUVELLES CARTES
   ══════════════════════════════════════════════════════════════ */

const fenetreReglages = () => document.getElementById('reglages');

/** Carte dont on peut reprendre le texte : celle ouverte, sinon celle sélectionnée. */
function carteSource() {
  const id = ETAT.fiche.id ?? ETAT.selection;
  return ETAT.lignes.find(l => l.id === id) || null;
}

function ouvrirReglages() {
  document.getElementById('reglages-modele').value = ETAT.modele;
  const bouton = document.getElementById('reglages-reprendre');
  const source = carteSource();
  const colTexte = ETAT.colonnes && ETAT.colonnes.Description;
  bouton.disabled = !(source && colTexte);
  bouton.textContent = bouton.disabled
    ? 'Reprendre le texte d\'une carte : ouvrez ou sélectionnez-la d\'abord'
    : `↧ Reprendre le texte de « ${source[ETAT.colonnes.Titre] || '(sans titre)'} »`;
  fenetreReglages().showModal();
}

function reprendreTexteCarte() {
  const source = carteSource();
  const colTexte = ETAT.colonnes && ETAT.colonnes.Description;
  if (!source || !colTexte) return;
  // Un ancien texte Notepad est repris directement en Markdown.
  document.getElementById('reglages-modele').value = Fiche.notepadVersMarkdown(String(source[colTexte] || ''));
}

async function enregistrerReglages() {
  const modele = document.getElementById('reglages-modele').value;
  try {
    await grist.setOption('modele', modele);
    ETAT.modele = modele;
    fenetreReglages().close();
    afficherToast('✓ Modèle enregistré');
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
  document.getElementById('reglages-reprendre').addEventListener('click', reprendreTexteCarte);
  document.getElementById('reglages-enregistrer').addEventListener('click', enregistrerReglages);
  document.getElementById('reglages-annuler').addEventListener('click', () => fenetreReglages().close());
  document.getElementById('bandeau-notepad-bouton').addEventListener('click', () =>
    convertirNotepad().catch(err => afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000)));
  document.getElementById('recherche').addEventListener('input', (e) => {
    ETAT.recherche = e.target.value;
    afficherGrille();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Réglages ou « Gérer la vue » ouverts : Échap ne concerne qu'eux
    // (le navigateur ferme lui-même ces fenêtres <dialog>).
    if (fenetreReglages().open || UI_VUES.fenetre.estOuverte()) return;
    // Un panneau des vues ou un filtre ouvert : on le ferme, lui seul
    if (panneauOuvert()) { UI_VUES.fermerMenus(); return; }
    if (panneau().classList.contains('open')) fermerFiche();
  });
});
