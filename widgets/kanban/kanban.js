/* ══════════════════════════════════════════════════════════════
   KANBAN GRIST — kanban.js v4
   • Vue « Toutes les cartes », puis les vues enregistrées (#196, #214)
   • Mode d'emploi derrière le bouton « ? », ouvert à la première visite (#214)
   • Filtres combinables sur les colonnes Choix et Référence (#195), avec
     les attributs de la référence affichables dans le panneau (#223)
   • Recherche passagère dans toutes les colonnes, et par #numéro (#209)
   • Tri des cartes sur n'importe quelle colonne, enregistré dans la vue (#211)
   • Sans tri choisi, cartes rangées par priorité : haute → moyenne → basse
   • Hauteur cartes fixe (flex-shrink:0)
   • Curseur horizontal natif
   • Un Kanban = un projet, choisi dans ⚙
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ── État global ─────────────────────────────────────────────── */
const STATE = {
  records:    [],
  columns:    [],
  selectedId: null,

  mapping: {
    titre:       '',
    statut:      '',
    description: '',
    priorite:    '',
    assigne:     '',
    date:        '',
    epic:        '',
    projet:      '',
    bloqueePar:  '',   // liens entre cartes (#183), voir la section 8 bis
    bloque:      '',
  },

  columnOrder: [],
  activeView: 'defaut',   // voir VUE_DEFAUT

  // Filtres combinables (#195) : liste de conditions { col, op, valeurs },
  // voir la section 3. Non mémorisés : ce sera le rôle des vues (#196).
  filters: [],
  // Colonnes proposées dans les filtres : [{ colId, label, type }]
  colonnesFiltrables: [],
  // Tri des cartes (#211) : critères [{ col, sens: 'asc' | 'desc' }], du plus
  // important au moins important ; [] = tri par défaut (priorité). Enregistré
  // dans la vue, comme les filtres (voir la section 3 bis).
  tri: [],
  // Colonnes proposées dans le tri : toutes celles de la table [{ colId, label, type }]
  colonnesTriables: [],
  // Type et choix déclarés de chaque colonne, pour comparer : { colId: { type, choix } }
  infosColonnes: {},
  // Filtre en cours de modification dans le panneau, et ordre de ses valeurs
  filtreEdite: null,
  ordreValeurs: [],
  // Attributs affichés dans le panneau d'un filtre (#223) : { colId: [colId d'attribut…] }.
  // Copie en mémoire de ce que retient le navigateur ; null = pas encore relu.
  attributsAffiches: null,
  attributsCle: null, // clé de mémoire sous laquelle ils ont été lus
  // Choix déclarés des colonnes Choix / Choix multiple : { colId: [choix…] }
  choix: {},

  // Recherche (#209) : texte saisi dans 🔍. Passagère : elle s'ajoute aux
  // filtres mais n'est enregistrée nulle part (ni vue, ni document, ni
  // navigateur). Règle commune dans ../_commun/recherche.js.
  recherche: '',

  // Vues enregistrées (#196), mémorisées dans les options du widget :
  // [{ id, nom, filtres: [{col, op, valeurs}], colonnes: [statuts…] | null }]
  vues: [],
  optionsChargees: false,

  drag: { cardId: null, fromStatut: null, placeholder: null },
  colDrag: { statut: null },

  editPanel: { recordId: null, dirty: false, fields: {} },
  addModal:  { statut: null },

  // ✅ Projet du Kanban : numéro de la ligne du projet choisi dans ⚙
  // (un Kanban = un projet). null tant qu'aucun projet n'est choisi.
  projetKanban: null,

  // Équipe projet (#148) : personnes proposées dans « Assigné à », choisies
  // dans ⚙. { table: table visée par « Assigné à », ids: [numéros de ligne] },
  // ou null tant qu'aucune équipe n'est choisie.
  equipe: null,
  // Rubrique « Équipe projet » de ⚙ en cours de modification :
  // référence affichée, numéros cochés, ordre des lignes (figé à l'ouverture)
  equipePanneau: { ref: null, cochees: new Set(), ordre: [] },

  // « Qui suis-je ? » (#202) : numéro de la ligne de la personne déclarée dans
  // la table visée par « Assigné à », retenu par le navigateur ; null sinon.
  moi: null,

  // Classes de statut (#183), réglées dans ⚙ : { statut: 'afaire' | 'encours'
  // | 'termine' | 'autre' }. Un statut absent reçoit la classe devinée par
  // Liens.devinerClasse. Servent aux badges ⛔ / ➡️ des cartes.
  classesStatut: {},

  // Couleurs des statuts (#212), réglées dans ⚙ : { statut: rang dans
  // PASTEL_PALETTE }. Un statut absent reçoit la couleur de sa position
  // (voir rangCouleur).
  couleursStatut: {},
};

/* ── Constantes ─────────────────────────────────────────────── */
const SELECT_IDS = {
  titre:       'col-titre',
  statut:      'col-statut',
  description: 'col-description',
  priorite:    'col-priorite',
  assigne:     'col-assigne',
  date:        'col-date',
  epic:        'col-epic',
  projet:      'col-projet',
  bloqueePar:  'col-bloquee-par',
  bloque:      'col-bloque',
};

/* Association proposée par défaut : colonnes de la table Taches de l'espace
   gestion de projets. Une colonne absente de la table est ignorée (voir
   oublierColonnesAbsentes). */
const PREREGLAGE_MAPPING = {
  titre:'Nom', statut:'statut', description:'Description',
  priorite:'Priorite', assigne:'qui_', date:'date_cible',
  epic:'EPIC', projet:'Projet',
  bloqueePar:'Bloquee_par', bloque:'Bloque',
};

const PROP_ICONS  = { statut:'📋', description:'📝', priorite:'🚦', assigne:'👤', date:'📅', epic:'🏷️' };
const PROP_LABELS = { statut:'Statut', description:'Description', priorite:'Priorité', assigne:'Assigné à', date:'Échéance', epic:'EPIC' };

/* Palette pastel : fond de colonne, accent (bordure, progression), titre.
   Une couleur de statut réglée dans ⚙ est enregistrée par son rang dans
   cette liste (#212) : ne pas changer l'ordre, seulement ajouter à la fin. */
const PASTEL_PALETTE = [
  { bg:'#dbeafe', accent:'#60a5fa', text:'#1d4ed8' },
  { bg:'#dcfce7', accent:'#4ade80', text:'#15803d' },
  { bg:'#fce7f3', accent:'#f472b6', text:'#be185d' },
  { bg:'#fef9c3', accent:'#facc15', text:'#a16207' },
  { bg:'#ede9fe', accent:'#a78bfa', text:'#6d28d9' },
  { bg:'#cffafe', accent:'#22d3ee', text:'#0e7490' },
  { bg:'#ffedd5', accent:'#fb923c', text:'#c2410c' },
  { bg:'#f1f5f9', accent:'#94a3b8', text:'#475569' },
];

/* Ordre de priorité pour le tri */
const PRIO_ORDER = { haute:0, high:0, urgent:0, critique:0, moyen:1, medium:1, normal:1, bas:2, low:2, faible:2 };

function getPrioRank(val) {
  if (!val) return 9;
  const v = String(val).toLowerCase().trim();
  for (const [k, rank] of Object.entries(PRIO_ORDER)) {
    if (v.includes(k)) return rank;
  }
  return 9;
}

/* Vue « Toutes les cartes » (#214) : sans filtre ni tri, toujours là, et vue de
   repli quand aucune autre n'est active. Elle est fabriquée ici et n'est jamais
   enregistrée : elle n'est donc pas dans STATE.vues, et ne se modifie pas. */
const DEFAUT = 'defaut';
const VUE_DEFAUT = { id: DEFAUT, nom: 'Toutes les cartes', filtres: [], colonnes: null, tri: [], defaut: true };

/* Adresse du mode d'emploi complet (README du widget sur GitHub) */
const URL_AIDE = 'https://github.com/nantodevison/pmd-suite-numerique/blob/master/widgets/kanban/README.md';

let _tableName = null;

/* ── Correctif références ──────────────────────────────────────
   Grist envoie au widget les colonnes de référence (EPIC, qui_) sous leur
   forme AFFICHÉE (des noms), mais attend en écriture leur forme STOCKÉE
   (des numéros de ligne). REFS mémorise, pour chaque champ de référence
   associé, la correspondance numéro ↔ nom :
     REFS.epic    = { estListe: false, tableVisee: 'EPICs',    options: [{id, nom}, …] }
     REFS.assigne = { estListe: true,  tableVisee: 'Contacts', options: [{id, nom}, …] }
     REFS.projet  = { estListe: false, tableVisee: 'Projets2', options: [{id, nom}, …] }
   Pour les EPICs, chaque option porte en plus le numéro de son projet
   (projetId), afin de ne proposer que les EPICs du projet du Kanban.
   Il vaut null si le champ n'est pas associé ou n'est pas une référence. */
const REFS = { epic: null, assigne: null, projet: null };

/* ══════════════════════════════════════════════════════════════
   1. INITIALISATION GRIST
   ══════════════════════════════════════════════════════════════ */

grist.ready({ requiredAccess: 'full' });

// ✅ Correctif : récupérer le nom réel de la table liée au widget.
// Sans cela, getTableName() retombe sur 'Taches' et les écritures partent
// dans la table Taches même quand le widget affiche une autre table.
// On garde la « promesse » pour pouvoir attendre ce nom avant de lire les références.
const _tableNamePret = (async () => {
  try {
    _tableName = await grist.getTable().getTableId();
  } catch (err) {
    console.warn('Kanban – nom de table introuvable, repli sur « Taches »:', err);
  }
})();

// Identifiant du document Grist : sert à distinguer, dans la mémoire du
// navigateur, les Kanban de documents différents (voir memoireVueActive).
let _docName = null;
const _docNamePret = (async () => {
  try {
    _docName = await grist.docApi.getDocName();
  } catch (err) {
    console.warn('Kanban – identifiant du document introuvable :', err);
  }
})();

grist.onRecords((records, _mappings, tableId) => {
  if (tableId) _tableName = tableId;
  STATE.records = records;

  if (records.length > 0 && STATE.columns.length === 0) {
    STATE.columns = Object.keys(records[0]).filter(k => k !== 'id');
    oublierColonnesAbsentes();
    populateSelects();
    loadSavedMapping();
  }

  renderBoard();

  // Recherche (#209) : un nom de référence (EPIC, personne…) a pu changer
  marquerStructureRecherchePerimee();

  // Les liens (#183) sont relus à chaque changement : ceux des cartes liées,
  // et leurs statuts, ont pu changer. Puis on redessine les badges ⛔ / ➡️ du
  // tableau et, si elle est ouverte et non modifiée, la fiche.
  // (Sans colonnes de liens, chargerLiens ne fait rien et le tableau est déjà à jour.)
  chargerLiens().then(() => {
    if (liensAssocies()) renderBoard();
    if (STATE.editPanel.recordId === null || STATE.editPanel.dirty) return;
    const rec = STATE.records.find(r => r.id === STATE.editPanel.recordId);
    if (rec) populateEditPanel(rec);
  });
});

grist.onRecord((record) => {
  STATE.selectedId = record ? record.id : null;
  document.querySelectorAll('.card').forEach(el => {
    el.classList.toggle('selected', Number(el.dataset.id) === STATE.selectedId);
  });
});

grist.onOptions(async (options) => {
  Object.assign(STATE.mapping, PREREGLAGE_MAPPING);
  if (options && options.mapping) Object.assign(STATE.mapping, options.mapping);
  // Le millésime, propre à l'Observatoire, a été retiré (#147) : on oublie
  // l'association qu'un ancien réglage aurait gardée.
  delete STATE.mapping.millesime;
  oublierColonnesAbsentes();
  syncSelectsToMapping();
  if (options && options.columnOrder)  STATE.columnOrder = options.columnOrder;
  // ✅ Projet du Kanban mémorisé dans les options du widget
  STATE.projetKanban = (options && options.projetKanban) ? Number(options.projetKanban) : null;
  // ✅ Équipe projet (#148), mémorisée elle aussi dans les options du widget
  STATE.equipe = (options && options.equipe) || null;
  // Classes de statut (#183), elles aussi dans les options du widget
  STATE.classesStatut = (options && options.classesStatut) || {};
  // Couleurs des statuts (#212), de même
  STATE.couleursStatut = (options && options.couleursStatut) || {};
  // Vue active et vues enregistrées (#196) : lues à l'ouverture seulement.
  // Grist rappelle onOptions après chaque setOption, parfois dans le désordre :
  // relire ces options ramènerait un état périmé (vue tout juste créée absente,
  // filtres en cours de modification perdus). Le widget étant seul à les
  // écrire, sa copie en mémoire fait foi.
  if (!STATE.optionsChargees) {
    // Marqué tout de suite : onOptions peut être rappelé pendant l'attente ci-dessous
    STATE.optionsChargees = true;
    STATE.vues = (options && Array.isArray(options.vues)) ? options.vues : [];
    // Onglet d'ouverture (#202) : celui mémorisé par ce navigateur, sinon
    // l'ancien réglage commun du document (options.activeView, qui n'est plus
    // écrit), sinon « Toutes les cartes ». Une vue supprimée entre-temps, ou un ancien
    // onglet codé en dur (taches, standardiser, lineariser, retirés en #197),
    // est ignorée. La clé de mémoire dépend du document et de la table : on
    // attend de les connaître.
    await Promise.all([_docNamePret, _tableNamePret]);
    // Vues personnelles (#202), retenues par ce navigateur : après les vues partagées
    STATE.vues.push(...lireVuesPerso());
    const candidats = [lireVueMemorisee(), options && options.activeView];
    STATE.activeView = candidats.find(id => vueEnregistree(id)) || DEFAUT;
    chargerFiltresDeLaVue();
  }
  renderBoard();
  // Les noms des projets et des EPICs sont nécessaires pour filtrer les cartes :
  // on les charge, puis on redessine le tableau.
  // L'identité (« Qui suis-je ? ») se relit ensuite : elle dépend de la table des personnes.
  assurerReferences().then(chargerColonnesFiltrables).then(chargerMoi).then(renderBoard)
    .then(ouvrirAideSiPremiereVisite);
});

/* ══════════════════════════════════════════════════════════════
   2. CONFIG
   ══════════════════════════════════════════════════════════════ */

function populateSelects() {
  Object.entries(SELECT_IDS).forEach(([key, selectId]) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    STATE.columns.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col; opt.textContent = col;
      sel.appendChild(opt);
    });
  });
}

function syncSelectsToMapping() {
  Object.entries(SELECT_IDS).forEach(([key, selectId]) => {
    const sel = document.getElementById(selectId);
    if (sel && STATE.mapping[key]) sel.value = STATE.mapping[key];
  });
}

function loadSavedMapping() { syncSelectsToMapping(); }

/**
 * Oublie les colonnes associées qui n'existent pas dans la table : préréglage
 * pensé pour un autre document, ou colonne renommée depuis. Sans cela, le
 * widget proposerait ces champs à la création d'une carte et Grist refuserait
 * l'écriture. Rien n'est fait tant que les colonnes ne sont pas connues
 * (table vide, ou données pas encore reçues).
 */
function oublierColonnesAbsentes() {
  if (STATE.columns.length === 0) return;
  Object.keys(STATE.mapping).forEach(key => {
    if (STATE.mapping[key] && !STATE.columns.includes(STATE.mapping[key])) STATE.mapping[key] = '';
  });
}
/* ── Fenêtre ⚙ (#210) ───────────────────────────────────────────
   Quatre étapes en onglets (../_commun/fenetre.js) : ① Projet, ② Colonnes,
   ③ Statuts, ④ Équipe. Chaque onglet affiche son état : ✓ réglé, ⚠️ à
   faire, ℹ️ à savoir. Les états sont calculés d'après ce qui est affiché
   dans la fenêtre, avant même « Appliquer ». */
let fenetreConfig = null;

const valeurConfig = (id) => document.getElementById(id)?.value || '';

function etatProjet() {
  if (!valeurConfig('col-projet')) return { etat: 'info', aide: 'Pas de Champ Projet : toutes les cartes de la table sont affichées' };
  if (!valeurConfig('col-projet-kanban')) return { etat: 'alerte', aide: 'Choisissez le projet du Kanban' };
  return { etat: 'ok', aide: 'Projet choisi' };
}

function etatColonnes() {
  if (!valeurConfig('col-titre') || !valeurConfig('col-statut')) return { etat: 'alerte', aide: 'Titre et Statut sont obligatoires' };
  return { etat: 'ok', aide: 'Colonnes obligatoires associées' };
}

function etatStatuts() {
  const lignes = document.querySelectorAll('#classes-liste .classe-ligne');
  if (!lignes.length) return { etat: 'alerte', aide: 'Aucun statut : associez la colonne Statut (②)' };
  if (document.querySelector('#classes-liste .classe-devinee')) {
    return { etat: 'alerte', aide: 'Classes proposées d\'après le libellé (en italique) : vérifiez-les puis appliquez' };
  }
  return { etat: 'ok', aide: 'Statuts réglés' };
}

function etatEquipe() {
  if (!STATE.equipePanneau || !STATE.equipePanneau.ref) return { etat: 'info', aide: '« Assigné à » n\'est pas une colonne Référence : pas d\'équipe à choisir' };
  if (!STATE.equipePanneau.cochees.size) return { etat: 'info', aide: 'Personne de coché : toute la table est proposée' };
  return { etat: 'ok', aide: 'Équipe choisie' };
}

/** Crée la fenêtre ⚙ à partir des quatre sections de index.html (une fois, au chargement). */
function creerFenetreConfig() {
  const section = (id) => document.getElementById(id);
  fenetreConfig = Fenetre.creer({
    titre: '⚙️ Configuration du Kanban',
    onglets: [
      { id: 'projet',   libelle: '① Projet',      contenu: section('config-projet'),   etat: etatProjet },
      { id: 'colonnes', libelle: '② Colonnes',    contenu: section('config-colonnes'), etat: etatColonnes },
      { id: 'statuts',  libelle: '③ Statuts',     contenu: section('config-statuts'),  etat: etatStatuts },
      { id: 'equipe',   libelle: '④ Équipe projet', contenu: section('config-equipe'), etat: etatEquipe },
    ],
    actions: [
      { libelle: 'Annuler', classe: 'btn-ghost', fermer: true },
      { libelle: '✓ Appliquer', classe: 'btn-primary', surClic: saveConfig },
    ],
  });
}

function openConfig()  {
  populateSelects(); syncSelectsToMapping();
  STATE.configRefProjet = REFS.projet; // projets visés par le Champ Projet affiché (#210)
  remplirChoixProjet(REFS.projet); // ✅ liste « Projet du Kanban »
  remplirClasses();                // rubrique « Statuts » (#183, #212)
  preparerEquipe(REFS.assigne);    // ✅ rubrique « Équipe projet »
  fenetreConfig.ouvrir();          // sur la première étape ⚠️, sinon la première
}

/* ✅ Remplit la liste « Projet du Kanban » du panneau ⚙ à partir des projets
   visés par la colonne « Champ Projet » (ref = REFS.projet, ou null). */
function remplirChoixProjet(ref) {
  const sel = document.getElementById('col-projet-kanban');
  if (!sel) return;
  sel.innerHTML = '<option value="">— choisir —</option>';
  sel.disabled = !ref;
  if (!ref) return;
  [...ref.options]
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .forEach(o => {
      const opt = document.createElement('option');
      opt.value = String(o.id); opt.textContent = o.nom || `(ligne ${o.id})`;
      sel.appendChild(opt);
    });
  sel.value = STATE.projetKanban ? String(STATE.projetKanban) : '';
}

async function saveConfig() {
  Object.entries(SELECT_IDS).forEach(([key, selectId]) => {
    const sel = document.getElementById(selectId);
    STATE.mapping[key] = sel ? sel.value : '';
  });
  if (!STATE.mapping.titre || !STATE.mapping.statut) {
    fenetreConfig.afficherOnglet('colonnes');
    showToast('⚠️ Titre et Statut sont obligatoires.', 3000); return;
  }
  // ✅ Projet du Kanban : mémorisé dans les options du widget
  const selProjet = document.getElementById('col-projet-kanban');
  STATE.projetKanban = (selProjet && selProjet.value) ? Number(selProjet.value) : null;
  // ✅ Équipe projet : gardée avec le nom de la table visée. Si « Assigné à »
  // n'est pas une référence, on ne touche pas à l'équipe déjà enregistrée.
  const { ref, cochees } = STATE.equipePanneau;
  if (ref) STATE.equipe = { table: ref.tableVisee, ids: [...cochees] };
  // Classes de statut (#183) : toutes celles affichées, devinées comprises,
  // pour qu'un réglage vu dans ⚙ ne change plus ensuite
  document.querySelectorAll('#classes-liste select').forEach(sel => {
    STATE.classesStatut[sel.dataset.statut] = sel.value;
  });
  // Couleurs des statuts (#212) : de même, toutes celles affichées
  document.querySelectorAll('#classes-liste .classe-ligne').forEach(ligne => {
    STATE.couleursStatut[ligne.dataset.statut] = Number(ligne.dataset.couleur);
  });
  grist.setOption('mapping', STATE.mapping).catch(() => {});
  grist.setOption('projetKanban', STATE.projetKanban).catch(() => {});
  grist.setOption('equipe', STATE.equipe).catch(() => {});
  grist.setOption('classesStatut', STATE.classesStatut).catch(() => {});
  grist.setOption('couleursStatut', STATE.couleursStatut).catch(() => {});
  fenetreConfig.fermer({ forcer: true });   // appliqué : rien à confirmer
  await assurerReferences(); // l'association des colonnes a pu changer
  await chargerMoi();        // … et avec elle la table des personnes
  await chargerLiens();      // … et les colonnes de liens (badges ⛔ / ➡️)
  // Les vues personnelles sont propres au projet : on relit celles du projet choisi
  STATE.vues = STATE.vues.filter(v => !v.perso).concat(lireVuesPerso());
  if (!vueEnregistree(STATE.activeView)) {
    STATE.activeView = DEFAUT;
    chargerFiltresDeLaVue();
  }
  renderBoard();
  showToast('✓ Configuration sauvegardée');
}

/* ── Classes et couleurs de statut (#183, #212) ─────────────────
   Chaque statut est rangé dans une classe (À faire, En cours, Terminé,
   Autre) : c'est ce qui dit au widget qu'une carte bloquante est finie, sans
   écrire aucun statut en dur. La classe proposée par défaut est devinée
   d'après le libellé (voir Liens.devinerClasse).
   Chaque statut a aussi sa couleur, choisie parmi les pastels du Kanban ;
   par défaut, celle de sa position (voir rangCouleur). Classe et couleur
   affichées sont retenues ensemble à « Appliquer ». */

/** Pastilles de couleur d'une ligne de statut ; le choix est noté sur la ligne. */
function choixCouleur(ligne, rang) {
  const groupe = document.createElement('span');
  groupe.className = 'couleurs-statut';
  PASTEL_PALETTE.forEach((palette, i) => {
    const pastille = document.createElement('button');
    pastille.type = 'button';
    pastille.className = 'couleur-pastille';
    pastille.style.background = palette.bg;
    pastille.style.borderColor = palette.accent;
    pastille.title = 'Couleur de la colonne';
    pastille.addEventListener('click', () => {
      marquer(i);
      // Un bouton ne déclenche pas « change » : on le signale à la fenêtre ⚙
      ligne.dispatchEvent(new Event('change', { bubbles: true }));
    });
    groupe.appendChild(pastille);
  });
  function marquer(i) {
    ligne.dataset.couleur = String(i);
    [...groupe.children].forEach((p, j) => p.setAttribute('aria-pressed', String(j === i)));
  }
  marquer(rang);
  return groupe;
}

/**
 * Cartes du projet choisi dans ⚙, avant même « Appliquer » (#210) : d'après
 * le Champ Projet et le Projet du Kanban affichés. Toutes, si aucun projet.
 */
function cartesDuProjetAffiche() {
  const colProjet = document.getElementById('col-projet')?.value;
  const id = Number(document.getElementById('col-projet-kanban')?.value);
  const ref = STATE.configRefProjet;
  if (!colProjet || !id || !ref) return STATE.records;
  const option = ref.options.find(o => o.id === id);
  const nom = option ? option.nom : '';
  return STATE.records.filter(r => String(r[colProjet] ?? '') === nom);
}

/**
 * (Re)dessine la rubrique : une ligne par statut, avec sa couleur et sa classe.
 * Les statuts sont ceux de la colonne Statut et du projet affichés dans ⚙
 * (#210) : changer l'un ou l'autre redessine aussitôt la liste.
 *   garderSaisie : true pour reprendre les couleurs et classes déjà changées
 *                  dans ⚙ (pas encore appliquées) des statuts toujours présents
 */
function remplirClasses(garderSaisie = false) {
  const liste = document.getElementById('classes-liste');
  if (!liste) return;
  const saisie = {};   // { statut: { couleur, classe, devinee } } en cours dans ⚙
  if (garderSaisie) {
    liste.querySelectorAll('.classe-ligne').forEach(l => {
      saisie[l.dataset.statut] = {
        couleur: Number(l.dataset.couleur),
        classe: l.querySelector('select').value,
        devinee: l.classList.contains('classe-devinee'),
      };
    });
  }
  liste.innerHTML = '';
  const colStatut = document.getElementById('col-statut')?.value || STATE.mapping.statut;
  const statuts = statutsDeColonne(colStatut, cartesDuProjetAffiche());
  if (statuts.length === 0) {
    liste.innerHTML = '<div class="filtre-aucune">Aucun statut connu : associez la colonne Statut.</div>';
    return;
  }
  statuts.forEach(statut => {
    const enCours = saisie[statut];
    // Une <div> et non un <label> : un clic sur le nom activerait sinon la
    // première pastille de couleur (premier élément cliquable de la ligne).
    const ligne = document.createElement('div');
    ligne.className = 'classe-ligne';
    ligne.dataset.statut = statut;
    const nom = document.createElement('span');
    nom.className = 'classe-nom';
    nom.textContent = statut;
    const sel = document.createElement('select');
    sel.dataset.statut = statut;
    Object.entries(Liens.CLASSES).forEach(([valeur, libelle]) => {
      const opt = document.createElement('option');
      opt.value = valeur; opt.textContent = libelle;
      sel.appendChild(opt);
    });
    sel.value = enCours ? enCours.classe : Liens.classeDe(statut, STATE.classesStatut);
    // Classe pas encore enregistrée : on le signale, elle sera retenue à « Appliquer »
    if (enCours ? enCours.devinee : !(statut in STATE.classesStatut)) {
      ligne.classList.add('classe-devinee');
      ligne.title = 'Classe proposée d\'après le libellé : vérifiez-la';
    }
    const rang = enCours ? enCours.couleur : rangCouleur(statut, statuts);
    ligne.append(nom, choixCouleur(ligne, rang), sel);
    liste.appendChild(ligne);
  });
}

/* ── Équipe projet (#148) ───────────────────────────────────────
   Personnes proposées dans « Assigné à » (fiche et création de carte) :
   une liste cochée dans ⚙. Des numéros de ligne n'ont de sens que pour une
   table : la liste est gardée avec le nom de la table visée, et ignorée si
   « Assigné à » vise une autre table. Sans liste valable, toutes les lignes
   de la table sont proposées. */

/** Numéros de l'équipe projet, ou null si aucune liste valable. */
function idsEquipe() {
  const eq = STATE.equipe, ref = REFS.assigne;
  if (!eq || !ref || eq.table !== ref.tableVisee || !eq.ids || !eq.ids.length) return null;
  return eq.ids;
}

/** Prépare la rubrique « Équipe projet » de ⚙ pour la référence `ref` (ou null). */
function preparerEquipe(ref) {
  const eq = STATE.equipe;
  const ids = (ref && eq && eq.table === ref.tableVisee && eq.ids) ? eq.ids : [];
  // Ordre figé à l'ouverture (les lignes ne sautent pas quand on coche) :
  // l'équipe actuelle d'abord, puis les autres, chaque groupe par nom
  const parNom = (a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr');
  const options = ref ? [...ref.options] : [];
  STATE.equipePanneau = {
    ref,
    cochees: new Set(ids),
    ordre: [...options.filter(o => ids.includes(o.id)).sort(parNom),
            ...options.filter(o => !ids.includes(o.id)).sort(parNom)],
  };
  document.getElementById('equipe-recherche').value = '';
  remplirEquipe();
}

/** (Re)dessine la liste des personnes, selon le texte de recherche. */
function remplirEquipe() {
  const { ref, cochees, ordre } = STATE.equipePanneau;
  const recherche = document.getElementById('equipe-recherche');
  const liste = document.getElementById('equipe-liste');
  recherche.disabled = !ref;
  document.getElementById('equipe-aucun').disabled = !ref;
  liste.innerHTML = '';
  if (!ref) {
    liste.innerHTML = '<div class="filtre-aucune">Associez « Assigné à » à une colonne Référence ou Liste de références pour choisir l\'équipe.</div>';
    document.getElementById('equipe-compte').textContent = '';
    return;
  }
  const visibles = ordre.filter(o => Recherche.correspond(recherche.value, pourRecherche(o.nom || '')));
  visibles.forEach(o => {
    const ligne = document.createElement('label');
    ligne.className = 'filtre-valeur';
    const caseACocher = document.createElement('input');
    caseACocher.type = 'checkbox';
    caseACocher.checked = cochees.has(o.id);
    caseACocher.addEventListener('change', () => {
      if (caseACocher.checked) cochees.add(o.id); else cochees.delete(o.id);
      majCompteEquipe();
    });
    const nom = document.createElement('span');
    nom.className = 'filtre-valeur-nom';
    nom.textContent = o.nom || `(ligne ${o.id})`;
    ligne.append(caseACocher, nom);
    liste.appendChild(ligne);
  });
  if (visibles.length === 0) {
    liste.innerHTML = '<div class="filtre-aucune">Aucune personne ne correspond.</div>';
  }
  majCompteEquipe();
}

/** Compteur de la rubrique « Équipe projet ». */
function majCompteEquipe() {
  const n = STATE.equipePanneau.cochees.size;
  document.getElementById('equipe-compte').textContent = n
    ? `${n} sélectionnée${n > 1 ? 's' : ''}`
    : 'aucune : toute la table est proposée';
}

/* ══════════════════════════════════════════════════════════════
   3. VUES & FILTRES
   ══════════════════════════════════════════════════════════════ */

/* ── Vues enregistrées (#196) ───────────────────────────────────
   Une vue enregistrée = un nom, des filtres (même format qu'en #195) et
   des colonnes : liste ordonnée des statuts affichés (même vides), ou null
   pour afficher tous les statuts présents. Elles sont gardées dans les
   options du widget (document Grist), jamais dans le code.
   Seule vue fixe : « Toutes les cartes » (VUE_DEFAUT).
   Règles :
   - changer de vue recharge ses filtres :
   - les colonnes et leur ordre sont enregistrés immédiatement ;
   - nom, filtres et tri (#211) se règlent dans « Gérer la vue » (#214) : dans
     la fenêtre, les colonnes aussi attendent 💾.
   Vues personnelles (#202) : même format, plus `perso: true`. Elles sont
   gardées dans le navigateur (voir lireVuesPerso), pas dans le document :
   chacun a les siennes, enregistrées aussitôt. Toutes les vues sont dans
   STATE.vues ; enregistrerVues(vue) range chaque genre à sa place.
   Projet (#214) : une vue partagée retient le projet du Kanban (`projet`) et
   n'apparaît qu'avec lui. Celles créées avant n'en ont pas : elles restent
   visibles partout. STATE.vues garde toujours toutes les vues : les masquer
   ne doit pas les effacer du document à la prochaine écriture. */

/** Cette vue s'affiche-t-elle avec le projet du Kanban ? */
function vueDuProjet(vue) {
  return !vue.projet || !STATE.projetKanban || vue.projet === STATE.projetKanban;
}

/** La vue visible d'identifiant `id` (« Toutes les cartes » comprise), ou undefined. */
function vueEnregistree(id) {
  return id === DEFAUT ? VUE_DEFAUT : STATE.vues.find(v => v.id === id && vueDuProjet(v));
}

/** Copie indépendante d'une liste de filtres (pour ne pas modifier la vue par mégarde). */
function copieFiltres(filtres) {
  return (filtres || []).map(f => ({ col: f.col, op: f.op, valeurs: [...f.valeurs] }));
}

/** Filtres et tri (#211) de la vue active. */
function chargerFiltresDeLaVue() {
  const vue = vueEnregistree(STATE.activeView);
  STATE.filters = vue ? copieFiltres(vue.filtres) : [];
  // Tri.nettoyer renvoie une copie bien formée (la vue vient du document ou du navigateur)
  STATE.tri = vue ? Tri.nettoyer(vue.tri) : [];
}

/**
 * La vue active sous la forme attendue par le rendu : `preferredOrder` est la
 * liste des colonnes de la vue, ou une liste vide pour « tous les statuts
 * présents » (vue sans liste de colonnes).
 */
function vueCourante() {
  const vue = vueEnregistree(STATE.activeView);
  return {
    label: vue ? vue.nom : VUE_DEFAUT.nom,
    preferredOrder: (vue && vue.colonnes) || [],
  };
}

/** Résumé comparable d'une liste de filtres (ordre des valeurs ignoré). */
function signatureFiltres(filtres) {
  return JSON.stringify(filtres
    .filter(f => f.valeurs.length > 0)
    .map(f => [f.col, f.op, [...f.valeurs].sort()]));
}

/**
 * Mémorise les vues du même genre que `vue`, qui vient d'être créée, modifiée
 * ou supprimée : les vues personnelles dans le navigateur, les vues
 * partagées dans les options du widget. Ainsi, toucher à une vue perso
 * n'allume pas le bouton « Enregistrer » de Grist.
 */
function enregistrerVues(vue) {
  if (vue.perso) { memoriserVuesPerso(); return; }
  grist.setOption('vues', STATE.vues.filter(v => !v.perso)).catch(() =>
    showToast('⚠️ Vue non enregistrée : droits de modification du document nécessaires ?', 3500));
}

function switchView(viewId) {
  fermerPopovers();
  STATE.activeView = viewId;
  chargerFiltresDeLaVue();
  memoriserVueActive(viewId);
  renderBoard();
}

/* ── Onglet actif mémorisé par le navigateur (#202) ─────────────
   Chacun retrouve l'onglet qu'il regardait en dernier, sans toucher au
   document : rien n'est écrit dans les options du widget, donc le bouton
   « Enregistrer » de Grist ne se rallume plus à chaque changement d'onglet.
   La mémoire (localStorage) est propre au navigateur et au poste. Tous les
   widgets publiés sur nantodevison.github.io la partagent : la clé contient
   donc le document, la table et le projet du Kanban.
   localStorage peut être refusé (navigation privée, Custom Widget Builder…) :
   chaque accès est protégé, et le widget retombe alors sur « Toutes les cartes ». */

/**
 * Clé de mémoire de ce Kanban pour la donnée `nom` (ex. 'vueActive'), ou
 * null si le document est inconnu.
 */
function cleMemoire(nom) {
  if (!_docName) return null;
  return `kanban.${nom}.${_docName}.${getTableName()}.${STATE.projetKanban || 'sans-projet'}`;
}

function memoireVueActive() { return cleMemoire('vueActive'); }

/** Identifiant de l'onglet mémorisé par ce navigateur, ou null. */
function lireVueMemorisee() {
  const cle = memoireVueActive();
  if (!cle) return null;
  try { return localStorage.getItem(cle); }
  catch (err) { return null; }
}

/** Mémorise l'onglet actif dans ce navigateur (sans effet si refusé). */
function memoriserVueActive(viewId) {
  const cle = memoireVueActive();
  if (!cle) return;
  try { localStorage.setItem(cle, viewId); }
  catch (err) { /* mémoire indisponible : l'onglet ne sera pas retenu */ }
}

/* ── Vues personnelles retenues par le navigateur (#202, étape 2) ──
   Même clé que l'onglet actif (document, table, projet) : un Kanban d'un
   autre projet a ses propres vues perso. */

/** Vues personnelles de ce Kanban retenues par ce navigateur ([] si aucune ou mémoire indisponible). */
function lireVuesPerso() {
  const cle = cleMemoire('vuesPerso');
  if (!cle) return [];
  try {
    const vues = JSON.parse(localStorage.getItem(cle) || '[]');
    return Array.isArray(vues) ? vues.map(v => ({ ...v, perso: true })) : [];
  } catch (err) {
    return [];
  }
}

/** Mémorise toutes les vues personnelles dans ce navigateur. */
function memoriserVuesPerso() {
  const cle = cleMemoire('vuesPerso');
  try {
    if (!cle) throw new Error('document inconnu');
    localStorage.setItem(cle, JSON.stringify(STATE.vues.filter(v => v.perso)));
  } catch (err) {
    showToast('⚠️ Ce navigateur ne peut pas retenir vos vues personnelles : elles seront perdues au rechargement.', 3500);
  }
}

/* ── « Qui suis-je ? » (#202, étape 1) ──────────────────────────
   Chacun se déclare une fois parmi les personnes de « Assigné à » (l'équipe
   projet, ou toute la table). Son navigateur retient le numéro de la ligne,
   sous une clé propre au document et à la table des personnes : la même
   déclaration sert donc à tous les Kanban du document qui visent cette table.
   Elle donne son sens au filtre « 👤 Moi » (voir MOI) : une vue partagée
   « Assigné à est Moi » montre à chacun ses propres cartes.
   Rien n'est écrit dans le document. */

/** Clé de mémoire de l'identité, ou null si le document ou la table des personnes est inconnu. */
function memoireMoi() {
  if (!_docName || !REFS.assigne) return null;
  return `kanban.moi.${_docName}.${REFS.assigne.tableVisee}`;
}

/**
 * Relit l'identité retenue par le navigateur. Elle est oubliée si la personne
 * n'existe plus dans la table. Si la mémoire est indisponible, on garde le
 * choix fait pendant la séance.
 */
async function chargerMoi() {
  await _docNamePret;
  const cle = memoireMoi();
  if (!cle) { STATE.moi = null; return; }
  let id;
  try { id = Number(localStorage.getItem(cle)); }
  catch (err) { return; }
  STATE.moi = REFS.assigne.options.some(o => o.id === id) ? id : null;
}

/** Retient l'identité (numéro de ligne, ou null pour l'oublier), puis redessine. */
function choisirMoi(id) {
  STATE.moi = id;
  const cle = memoireMoi();
  try {
    if (!cle)    throw new Error('document inconnu');
    if (id)      localStorage.setItem(cle, String(id));
    else         localStorage.removeItem(cle);
  } catch (err) {
    showToast('⚠️ Ce navigateur ne peut pas retenir votre nom : il sera oublié au rechargement.', 3500);
  }
  fermerPopovers();
  renderBoard();
  showToast(id ? `✓ Vous êtes ${nomAffiche('assigne', id)}` : '✓ Nom oublié');
}

/** Nom de la personne déclarée, nettoyé comme les valeurs des cellules ('' si personne). */
function nomMoi() {
  return STATE.moi ? (valeursCellule(nomAffiche('assigne', STATE.moi))[0] || '') : '';
}

/** Un filtre affiché utilise-t-il la valeur « 👤 Moi » ? */
function filtreMoiActif() {
  return STATE.filters.some(f => f.valeurs.includes(MOI));
}

/** Bouton 👤 de la barre du haut : nom déclaré, ou invitation à se déclarer. */
function majBoutonMoi() {
  const btn = document.getElementById('btn-moi');
  if (!btn) return;
  // Sans colonne Référence pour « Assigné à », il n'y a personne à choisir
  btn.classList.toggle('hidden', !REFS.assigne);
  const nom = STATE.moi ? nomAffiche('assigne', STATE.moi) : '';
  // Une fois déclaré, le bouton se réduit pour laisser la place à la barre (#214)
  btn.textContent = nom ? '👤' : '👤 Qui suis-je ?';
  btn.title = nom
    ? `Utilisateur déclaré : ${nom}. Retenu par ce navigateur, cliquer pour changer.`
    : 'Indiquez qui vous êtes pour utiliser le filtre « 👤 Moi »';
  // Un filtre « Moi » est actif mais personne n'est déclaré : on attire l'œil
  btn.classList.toggle('a-declarer', !STATE.moi && filtreMoiActif());
}

/** Ouvre le panneau « Qui suis-je ? » sous le bouton 👤. */
function ouvrirMoi(ancre) {
  fermerPopovers();
  document.getElementById('moi-recherche').value = '';
  remplirMoi();
  placerSous(document.getElementById('moi-popover'), ancre);
  document.getElementById('moi-recherche').focus();
}

/** Liste des personnes (équipe projet, ou toute la table), par nom, selon la recherche. */
function remplirMoi() {
  const liste = document.getElementById('moi-liste');
  const saisie = document.getElementById('moi-recherche').value;
  const personnes = optionsProposees('assigne', STATE.moi ? [STATE.moi] : [])
    .filter(o => Recherche.correspond(saisie, pourRecherche(o.nom || '')))
    .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
  liste.innerHTML = '';
  personnes.forEach(o => {
    const ligne = document.createElement('label');
    ligne.className = 'filtre-valeur';
    const choix = document.createElement('input');
    choix.type = 'radio';
    choix.name = 'moi';
    choix.checked = o.id === STATE.moi;
    choix.addEventListener('change', () => choisirMoi(o.id));
    const nom = document.createElement('span');
    nom.className = 'filtre-valeur-nom';
    nom.textContent = o.nom || `(ligne ${o.id})`;
    ligne.append(choix, nom);
    liste.appendChild(ligne);
  });
  if (personnes.length === 0) {
    liste.innerHTML = '<div class="filtre-aucune">Aucune personne ne correspond.</div>';
  }
  document.getElementById('moi-oublier').disabled = !STATE.moi;
}

/** « Toutes les cartes », puis les vues partagées et les personnelles, par ordre alphabétique dans chaque groupe. */
function vuesRangees() {
  const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr');
  return [VUE_DEFAUT,
          ...STATE.vues.filter(v => !v.perso && vueDuProjet(v)).sort(parNom),
          ...STATE.vues.filter(v => v.perso).sort(parNom)];
}

/** Petit ⋯ de la vue active : ouvre son menu sous `onglet`. */
function boutonMenuVue(onglet) {
  const menu = document.createElement('span');
  menu.className = 'vue-menu-btn';
  menu.textContent = '⋯';
  menu.title = 'Options de la vue';
  menu.addEventListener('click', (e) => { e.stopPropagation(); ouvrirMenuVue(onglet); });
  return menu;
}

/** Un onglet par vue enregistrée. */
function dessinerOnglets(zone) {
  zone.innerHTML = '';
  vuesRangees().forEach(vue => {
    const active = vue.id === STATE.activeView;
    const onglet = document.createElement('button');
    onglet.className = 'view-tab vue-enregistree' + (vue.perso ? ' perso' : '') + (active ? ' active' : '');
    onglet.textContent = (vue.perso ? '🔒 ' : '') + vue.nom;
    onglet.title = vue.defaut ? 'Toutes les cartes du projet'
      : vue.perso ? 'Vue personnelle : visible dans ce navigateur seulement'
      : 'Vue partagée : la même pour tous';
    onglet.addEventListener('click', () => { if (!active) switchView(vue.id); });
    // ⋯ seulement sur l'onglet actif : on agit sur la vue affichée.
    // Pas sur « Toutes les cartes » : elle ne se renomme ni ne se supprime.
    if (active && !vue.defaut) onglet.appendChild(boutonMenuVue(onglet));
    zone.appendChild(onglet);
  });
}

/** Un seul bouton à la place des onglets : le nom de la vue active, ▾ pour en changer. */
function dessinerSelecteur(zone) {
  zone.innerHTML = '';
  const vue = vueEnregistree(STATE.activeView);
  const bouton = document.createElement('button');
  bouton.className = 'view-tab vue-enregistree vue-selecteur active';
  const nom = document.createElement('span');
  nom.className = 'vue-selecteur-nom';
  nom.textContent = (vue.perso ? '🔒 ' : '') + vue.nom;
  bouton.title = `Vue active : ${vue.nom}. Cliquer pour en changer.`;
  bouton.append(nom, ' ▾');
  if (!vue.defaut) bouton.appendChild(boutonMenuVue(bouton));
  bouton.addEventListener('click', () => ouvrirListeVues(bouton));
  zone.appendChild(bouton);
}

/**
 * Vues de la barre (#214) : des onglets tant qu'ils tiennent, sinon le
 * sélecteur. On dessine d'abord les onglets pour mesurer la place qu'ils
 * prennent : ainsi, ils reviennent dès que le widget s'élargit.
 */
function renderVueTabs() {
  const zone = document.getElementById('vues-enregistrees');
  const barre = document.getElementById('filterbar');
  if (!zone) return;
  dessinerOnglets(zone);
  if (barre.clientWidth > 0 && barre.scrollWidth > barre.clientWidth) dessinerSelecteur(zone);
}

/** Ouvre (ou referme) la liste des vues sous le sélecteur. */
function ouvrirListeVues(ancre) {
  const pop = document.getElementById('vue-liste-popover');
  if (!pop.classList.contains('hidden')) { pop.classList.add('hidden'); return; }
  fermerPopovers();
  pop.innerHTML = '';
  const vues = vuesRangees();
  const deuxGroupes = vues.some(v => v.perso) && vues.some(v => !v.perso);
  let groupe = null;
  vues.forEach(vue => {
    if (deuxGroupes && groupe !== !!vue.perso) {
      groupe = !!vue.perso;
      const titre = document.createElement('div');
      titre.className = 'vue-liste-titre';
      titre.textContent = groupe ? '🔒 Personnelles' : '👥 Partagées';
      pop.appendChild(titre);
    }
    const item = document.createElement('button');
    item.className = 'vue-menu-item' + (vue.id === STATE.activeView ? ' active' : '');
    item.textContent = vue.nom;
    item.addEventListener('click', () => switchView(vue.id));
    pop.appendChild(item);
  });
  placerSous(pop, ancre);
}

/* ── Création, renommage, suppression ── */

/** Ajoute une vue, la mémorise à sa place (navigateur ou document) et l'affiche. */
function ajouterVue(vue) {
  STATE.vues.push(vue);
  enregistrerVues(vue);
  switchView(vue.id);
}

/**
 * Nouvelle vue à partir de ce qui est affiché : filtres, tri et colonnes de
 * la vue active. Sert aussi à « Copier en vue perso ».
 * @param {string}  nom
 * @param {boolean} perso - vue personnelle (navigateur) ou partagée (document)
 */
function construireVue(nom, perso) {
  const source = vueCourante();
  const filtres = copieFiltres(STATE.filters.filter(f => f.valeurs.length > 0));
  const colonnes = source.preferredOrder.length ? [...source.preferredOrder] : null;
  const vue = { id: 'vue-' + Date.now().toString(36), nom, filtres, colonnes, tri: Tri.nettoyer(STATE.tri) };
  if (perso) vue.perso = true;                                   // déjà rangée par projet
  else if (STATE.projetKanban) vue.projet = STATE.projetKanban;
  return vue;
}

/** Ajoute et affiche `vue`, puis dit ce qu'il reste à faire pour la garder. */
function ajouterEtAnnoncerVue(vue) {
  ajouterVue(vue);
  if (vue.perso) showToast(`✓ Vue personnelle « ${vue.nom} » créée`);
  else           showToast(`✓ Vue « ${vue.nom} » créée : cliquez sur « Enregistrer » dans Grist pour la garder`, 4000);
}

function creerVue(nom, perso) {
  ajouterEtAnnoncerVue(construireVue(nom, perso));
}

/**
 * Vue personnelle « Mes tâches » déjà créée : une vue perso dont un filtre
 * dit « Assigné à est … 👤 Moi ». undefined s'il n'y en a pas.
 */
function vueMesTaches() {
  return STATE.vues.find(v => v.perso && (v.filtres || []).some(f =>
    f.col === STATE.mapping.assigne && f.op === 'est' && f.valeurs.includes(MOI)));
}

/**
 * Bouton du mode d'emploi : ouvre la vue « Mes tâches », ou la crée (vue perso,
 * « Assigné à est 👤 Moi », tous les statuts présents). Si personne n'est
 * déclaré, le panneau « Qui suis-je ? » s'ouvre ensuite.
 */
function ouvrirMesTaches() {
  const existante = vueMesTaches();
  if (existante) { switchView(existante.id); return; }
  ajouterVue({
    id: 'vue-' + Date.now().toString(36),
    nom: 'Mes tâches',
    filtres: [{ col: STATE.mapping.assigne, op: 'est', valeurs: [MOI] }],
    colonnes: null,
    perso: true,
  });
  if (STATE.moi) {
    showToast('✓ Vue « Mes tâches » créée. Masquez les statuts inutiles avec ▦ Colonnes', 4500);
  } else {
    ouvrirMoi(document.getElementById('btn-moi'));
    showToast('✓ Vue « Mes tâches » créée : indiquez qui vous êtes pour y voir vos cartes', 4500);
  }
}

function renommerVue(nom) {
  const vue = vueEnregistree(STATE.activeView);
  if (!vue) return;
  vue.nom = nom;
  enregistrerVues(vue);
  renderVueTabs();
}

function supprimerVue() {
  const vue = vueEnregistree(STATE.activeView);
  if (!vue) return;
  STATE.vues = STATE.vues.filter(v => v !== vue);
  enregistrerVues(vue);
  switchView(DEFAUT);
  showToast(`✓ Vue « ${vue.nom} » supprimée`);
}

/* ── Fenêtre « Gérer la vue » (#214) ────────────────────────────
   Nom, filtres, tri et colonnes de la vue active, réunis dans une fenêtre
   (../_commun/fenetre.js) pour rester lisibles sur un widget étroit.
   Principe : on photographie la vue à l'ouverture, on règle sur l'état
   courant (le tableau suit, derrière la fenêtre, d'où le compteur), puis :
     - 💾 Enregistrer écrit tout dans la vue ;
     - Annuler, ✕ ou Échap restaure la photographie.
   « Toutes les cartes » ne se modifie pas : 💾 y crée une nouvelle vue.
   Il n'y a donc qu'un bouton pour enregistrer, et aucun état intermédiaire :
   hors de la fenêtre, ce qui est affiché est toujours ce qui est enregistré.
   Les boutons-résumés de la barre ouvrent la fenêtre sur le bon onglet. */

let fenetreVue = null;     // la fenêtre (créée une fois, au chargement)
let _instantVue = null;    // photographie de la vue ; non nulle = fenêtre en cours d'usage

function creerFenetreVue() {
  const section = (id) => document.getElementById(id);
  const info = section('fv-info');
  info.hidden = false;
  fenetreVue = Fenetre.creer({
    titre: '🎛 Gérer la vue',
    onglets: [
      { id: 'vue',      libelle: 'Vue',      contenu: section('fv-vue') },
      { id: 'filtres',  libelle: 'Filtres',  contenu: section('fv-filtres') },
      { id: 'tri',      libelle: 'Tri',      contenu: section('fv-tri') },
      { id: 'colonnes', libelle: 'Colonnes', contenu: section('fv-colonnes') },
    ],
    actions: [
      { libelle: 'Annuler', classe: 'btn-ghost', fermer: true },
      { libelle: '💾 Enregistrer', classe: 'btn-primary', surClic: enregistrerFenetreVue },
    ],
    textePied: '• Non enregistré',
    messageModif: 'Les modifications de cette vue seront perdues. Continuer ?',
    infoPied: info,
    surFermeture: quitterFenetreVue,   // Annuler, ✕, Échap, clic sur le fond, 💾
  });

  section('fv-nom').addEventListener('input', majFenetreVue);
  section('fv-filtre-ajouter').addEventListener('click', ajouterFiltre);
  section('fv-supprimer').addEventListener('click', supprimerDepuisFenetreVue);
}

/** Ouvre la fenêtre sur la vue active, à l'onglet `onglet` (le premier par défaut). */
function ouvrirFenetreVue(onglet) {
  const vue = vueEnregistree(STATE.activeView);
  if (!vue) return;
  fermerPopovers();
  const defaut = !!vue.defaut;
  _instantVue = {
    nom: defaut ? '' : vue.nom,
    filtres: copieFiltres(STATE.filters),
    tri: STATE.tri.map(c => ({ ...c })),
    colonnes: vue.colonnes ? [...vue.colonnes] : null,
  };
  renderFilterChips();
  remplirTri();
  remplirColonnesVue();

  document.getElementById('fv-nom').value = _instantVue.nom;
  document.getElementById('fv-nom-libelle').textContent = defaut ? 'Nom de la nouvelle vue' : 'Nom de la vue';
  document.getElementById('fv-portee').textContent = defaut
    ? 'Cette vue montre toutes les cartes et ne se modifie pas : vos réglages créeront une nouvelle vue.'
    : vue.perso ? '🔒 Vue personnelle : visible dans ce navigateur seulement.'
    : '👥 Vue partagée : la même pour tous. Après 💾, le bouton « Enregistrer » de Grist la garde dans le document.';
  document.getElementById('fv-partagee').hidden = !!vue.perso || defaut;
  document.getElementById('fv-nouvelle-portee').classList.toggle('hidden', !defaut);
  document.querySelector('input[name="fv-portee-choix"][value="perso"]').checked = true;
  fenetreVue.element.querySelector('.fenetre-pied .btn-primary').textContent =
    defaut ? '💾 Enregistrer comme nouvelle vue' : '💾 Enregistrer';
  const supprimer = document.getElementById('fv-supprimer');
  supprimer.hidden = defaut;
  supprimer.textContent = '🗑 Supprimer la vue';
  supprimer.dataset.confirmer = '';

  fenetreVue.ouvrir(onglet);
  majFenetreVue();
}

/** Nombre de cartes à l'écran, et sur l'ensemble du projet, dans les colonnes de la vue. */
function compterCartes() {
  const colonnes = vueCourante().preferredOrder;
  const dansLaVue = (r) => !colonnes.length
    || colonnes.includes(String(getField(r, 'statut') ?? 'Sans statut'));
  return {
    affichees: getFilteredRecords().filter(dansLaVue).length,
    total: recordsDuProjet().filter(dansLaVue).length,
  };
}

/** La vue réglée dans la fenêtre diffère-t-elle de la photographie ? */
function fenetreVueModifiee() {
  const vue = vueEnregistree(STATE.activeView);
  return document.getElementById('fv-nom').value.trim() !== _instantVue.nom
    || signatureFiltres(STATE.filters) !== signatureFiltres(_instantVue.filtres)
    || JSON.stringify(STATE.tri) !== JSON.stringify(_instantVue.tri)
    || JSON.stringify(vue?.colonnes ?? null) !== JSON.stringify(_instantVue.colonnes);
}

/** Met à jour le bas de la fenêtre (appelé à chaque nouveau dessin du tableau). */
function majFenetreVue() {
  if (!_instantVue) return;
  const { affichees, total } = compterCartes();
  document.getElementById('fv-compteur').textContent =
    `${affichees} carte${affichees > 1 ? 's' : ''} sur ${total}`;
  fenetreVue.marquerModifiee(fenetreVueModifiee());
}

/** 💾 : écrit nom, filtres, tri et colonnes dans la vue (ou dans une nouvelle vue), puis ferme. */
function enregistrerFenetreVue() {
  const vue = vueEnregistree(STATE.activeView);
  const champ = document.getElementById('fv-nom');
  if (!vue) return;
  if (!champ.value.trim()) {
    fenetreVue.afficherOnglet('vue');
    champ.reportValidity();
    return;
  }
  fermerFiltre(); // retire un filtre commencé mais laissé sans valeur
  if (vue.defaut) {
    const perso = document.querySelector('input[name="fv-portee-choix"]:checked').value !== 'partagee';
    const nouvelle = construireVue(champ.value.trim(), perso);
    fenetreVue.fermer({ forcer: true });   // « Toutes les cartes » retrouve son état
    ajouterEtAnnoncerVue(nouvelle);
    return;
  }
  vue.nom = champ.value.trim();
  vue.filtres = copieFiltres(STATE.filters.filter(f => f.valeurs.length > 0));
  vue.tri = Tri.nettoyer(STATE.tri);
  _instantVue = null;              // rien à restaurer
  fenetreVue.fermer({ forcer: true });
  enregistrerVues(vue);
  renderBoard();
  if (vue.perso) showToast('✓ Vue enregistrée');
  else showToast('✓ Vue enregistrée : cliquez sur « Enregistrer » dans Grist pour la garder pour tous', 4500);
}

/** Suppression en deux clics, comme dans le menu ⋯. */
function supprimerDepuisFenetreVue(e) {
  const b = e.currentTarget;
  if (!b.dataset.confirmer) {
    b.dataset.confirmer = 'oui';
    b.textContent = '🗑 Cliquer encore pour confirmer';
    return;
  }
  _instantVue = null;
  fenetreVue.fermer({ forcer: true });
  supprimerVue();
}

/** Sortie de la fenêtre : s'il reste une photographie (on n'a pas enregistré), on la restaure. */
function quitterFenetreVue() {
  fermerFiltre();
  if (!_instantVue) return;
  const instant = _instantVue;
  _instantVue = null;
  STATE.filters = instant.filtres;
  STATE.tri = instant.tri;
  const vue = vueEnregistree(STATE.activeView);
  if (vue) vue.colonnes = instant.colonnes;
  renderBoard();
}

/* ── Mode d'emploi (#214) ───────────────────────────────────────
   Derrière le bouton « ? », et ouvert de lui-même à la première visite. */

let fenetreAide = null;

/* Une seule fois par navigateur, tous documents confondus */
const CLE_AIDE_VUE = 'kanban.aideVue';

function creerFenetreAide() {
  fenetreAide = Fenetre.creer({
    titre: '📖 Mode d\'emploi',
    onglets: [{ id: 'aide', libelle: 'Mode d\'emploi', contenu: document.getElementById('aide-contenu') }],
    actions: [{ libelle: 'Fermer', classe: 'btn-primary', fermer: true }],
  });
  fenetreAide.element.classList.add('fenetre-aide');
}

function ouvrirAide() {
  remplirAide();
  fenetreAide.ouvrir();
}

/**
 * Ouvre le mode d'emploi si ce navigateur ne l'a jamais montré. Si sa mémoire
 * est refusée, on n'ouvre rien : sinon il s'ouvrirait à chaque chargement.
 */
function ouvrirAideSiPremiereVisite() {
  try {
    if (localStorage.getItem(CLE_AIDE_VUE)) return;
    localStorage.setItem(CLE_AIDE_VUE, 'oui');
  } catch (err) {
    return;
  }
  ouvrirAide();
}

/* ── Petits panneaux (nom, menu, colonnes) ── */

/** Place un panneau en position fixe sous `ancre`, sans déborder de la fenêtre. */
function placerSous(pop, ancre) {
  pop.classList.remove('hidden');
  const r = ancre.getBoundingClientRect();
  pop.style.top  = `${r.bottom + 6}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
}

/** Ferme tous les panneaux ouverts (filtre, nom, menu, liste des vues, personne). */
function fermerPopovers() {
  fermerFiltre();
  ['vue-nom-popover', 'vue-menu-popover', 'vue-liste-popover', 'moi-popover'].forEach(id =>
    document.getElementById(id)?.classList.add('hidden'));
}

/**
 * Panneau de saisie du nom, selon le mode :
 *   'creer'    : nouvelle vue, personnelle (par défaut) ou partagée ;
 *   'renommer' : vue active ;
 *   'copier'   : copie personnelle de la vue partagée active (#202).
 */
function ouvrirNomVue(mode, ancre) {
  fermerPopovers();
  const pop = document.getElementById('vue-nom-popover');
  const champ = document.getElementById('vue-nom');
  const aide = document.getElementById('vue-nom-aide');
  pop.dataset.mode = mode;
  champ.value = mode === 'creer' ? '' : (vueEnregistree(STATE.activeView)?.nom || '');
  document.getElementById('vue-nom-valider').textContent =
    { creer: 'Créer la vue', renommer: 'Renommer', copier: 'Copier' }[mode];
  aide.textContent = mode === 'copier'
    ? 'Copie, rien que pour vous, les filtres, le tri et les colonnes affichés.'
    : 'Reprend les filtres, le tri et les colonnes affichés.';
  aide.classList.toggle('hidden', mode === 'renommer');
  // Choix 🔒 Pour moi / 👥 Pour tous : à la création seulement, « Pour moi » par défaut
  document.getElementById('vue-portee').classList.toggle('hidden', mode !== 'creer');
  document.querySelector('input[name="vue-portee"][value="perso"]').checked = true;
  placerSous(pop, ancre);
  champ.focus();
  champ.select();
}

function validerNomVue() {
  const pop = document.getElementById('vue-nom-popover');
  const nom = document.getElementById('vue-nom').value.trim();
  if (!nom) return;
  pop.classList.add('hidden');
  const mode = pop.dataset.mode;
  if (mode === 'renommer')    renommerVue(nom);
  else if (mode === 'copier') creerVue(nom, true);
  else creerVue(nom, document.querySelector('input[name="vue-portee"]:checked')?.value !== 'partagee');
}

function ouvrirMenuVue(ancre) {
  fermerPopovers();
  // « Copier en vue perso » : seulement depuis une vue partagée
  document.getElementById('vue-menu-copier').hidden = !!vueEnregistree(STATE.activeView)?.perso;
  const suppr = document.getElementById('vue-menu-supprimer');
  suppr.textContent = '🗑 Supprimer la vue';
  suppr.dataset.confirmer = '';
  placerSous(document.getElementById('vue-menu-popover'), ancre);
}

/* ── Éditeur de colonnes ── */

/**
 * Statuts proposés dans l'éditeur : choix déclarés de la colonne Statut
 * (dans l'ordre de Grist), puis statuts présents dans les cartes du projet,
 * puis ceux déjà retenus par la vue.
 */
function statutsConnus(vue) {
  const liste = statutsDeColonne(STATE.mapping.statut, recordsDuProjet());
  (vue.colonnes || []).forEach(s => { if (s && !liste.includes(s)) liste.push(s); });
  return liste;
}

/**
 * Statuts d'une colonne : ses choix déclarés dans Grist, dans leur ordre,
 * puis les autres valeurs présentes dans les cartes données. La colonne est
 * passée en paramètre : ⚙ s'en sert avant que l'association soit appliquée.
 */
function statutsDeColonne(col, cartes) {
  if (!col) return [];
  const liste = [...(STATE.choix[col] || [])];
  cartes.map(r => r[col]).filter(Boolean).map(String)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .forEach(s => { if (!liste.includes(s)) liste.push(s); });
  return liste;
}

/** (Re)dessine l'éditeur : statuts affichés (ordre, ↑ ↓) puis statuts masqués. */
function remplirColonnesVue() {
  const vue = vueEnregistree(STATE.activeView);
  if (!vue) return;
  const toutes = !vue.colonnes;
  document.getElementById('colonnes-toutes').checked = toutes;

  const liste = document.getElementById('colonnes-liste');
  liste.innerHTML = '';
  liste.classList.toggle('desactivee', toutes);
  const affichees = vue.colonnes || [];
  const masquees  = statutsConnus(vue).filter(s => !affichees.includes(s));

  const ligne = (statut, cochee, index) => {
    const el = document.createElement('div');
    el.className = 'filtre-valeur colonne-ligne';
    const caseACocher = document.createElement('input');
    caseACocher.type = 'checkbox';
    caseACocher.checked = cochee;
    caseACocher.disabled = toutes || (cochee && affichees.length === 1); // au moins une colonne
    caseACocher.addEventListener('change', () => basculerColonne(statut, caseACocher.checked));
    const nom = document.createElement('span');
    nom.className = 'filtre-valeur-nom';
    nom.textContent = statut;
    el.append(caseACocher, nom);
    if (cochee && !toutes) {
      [['↑', -1], ['↓', 1]].forEach(([fleche, sens]) => {
        const b = document.createElement('button');
        b.className = 'colonne-fleche';
        b.textContent = fleche;
        b.disabled = (sens === -1 && index === 0) || (sens === 1 && index === affichees.length - 1);
        b.addEventListener('click', () => deplacerColonne(index, sens));
        el.appendChild(b);
      });
    }
    liste.appendChild(el);
  };
  affichees.forEach((s, i) => ligne(s, true, i));
  masquees.forEach(s => ligne(s, false));
}

/**
 * Applique un changement de colonnes, et l'enregistre aussitôt. Sauf dans la
 * fenêtre « Gérer la vue » (#214) : c'est alors 💾 qui enregistre, ou Annuler
 * qui revient en arrière.
 */
function majColonnesVue(colonnes) {
  const vue = vueEnregistree(STATE.activeView);
  vue.colonnes = colonnes;
  if (!_instantVue) enregistrerVues(vue);
  remplirColonnesVue();
  renderBoard();
}

/**
 * Case « Tous les statuts présents ». En la décochant, on part des colonnes
 * affichées à l'écran, dans leur ordre actuel.
 */
function basculerToutesColonnes(toutes) {
  if (toutes) { majColonnesVue(null); return; }
  const aLEcran = [...document.querySelectorAll('#board .column')].map(c => c.dataset.statut);
  majColonnesVue(aLEcran.length ? aLEcran : statutsConnus(vueEnregistree(STATE.activeView)));
}

function basculerColonne(statut, cochee) {
  const actuelles = vueEnregistree(STATE.activeView).colonnes || [];
  majColonnesVue(cochee ? [...actuelles, statut] : actuelles.filter(s => s !== statut));
}

function deplacerColonne(index, sens) {
  const colonnes = [...vueEnregistree(STATE.activeView).colonnes];
  [colonnes[index], colonnes[index + sens]] = [colonnes[index + sens], colonnes[index]];
  majColonnesVue(colonnes);
}

/* ✅ Projet du Kanban : une carte appartient-elle au projet choisi ?
   Grist envoie le NOM affiché du projet de la carte : on le compare au nom
   du projet choisi. Si aucun projet n'est choisi (ou pas de colonne Projet),
   toutes les cartes sont gardées. */
function estDuProjet(record) {
  if (!STATE.projetKanban || !STATE.mapping.projet || !REFS.projet) return true;
  return String(getField(record, 'projet') ?? '') === nomAffiche('projet', STATE.projetKanban);
}

/** Les cartes du projet du Kanban (toutes, si aucun projet n'est choisi). */
function recordsDuProjet() {
  return STATE.records.filter(estDuProjet);
}

/* ── Filtres combinables (#195) ─────────────────────────────────
   Un filtre est une condition { col, op, valeurs } :
     col     : identifiant Grist de la colonne (ex. 'EPIC', 'qui_')
     op      : 'est' ou 'nestpas'
     valeurs : valeurs cochées ; VIDE désigne les cellules vides.
   Une carte respecte une condition si l'UNE de ses valeurs est cochée
   (« ou » entre les valeurs) ; elle doit respecter TOUTES les conditions
   (« et » entre les filtres). Une condition sans valeur cochée est ignorée.
   Seules les colonnes Choix, Choix multiple, Référence et Liste de
   références sont proposées (les autres types viendront avec #200). */

/** Valeur qui représente une cellule vide (jamais produite par une vraie valeur). */
const VIDE = '';
const LIBELLE_VIDE = '(vide)';

/** Valeur « 👤 Moi » du filtre « Assigné à » (#202) : remplacée, au moment de
    filtrer, par le nom de la personne déclarée (« Qui suis-je ? »). Elle
    commence par un caractère invisible, qu'aucune vraie valeur ne contient. */
const MOI = '\u0000moi';
const LIBELLE_MOI = '👤 Moi';

/**
 * Texte affiché pour une valeur de filtre. `detaille` ajoute, pour « Moi »,
 * le nom de la personne déclarée (dans le panneau du filtre).
 */
function libelleValeur(valeur, detaille = false) {
  if (valeur === VIDE) return LIBELLE_VIDE;
  if (valeur !== MOI) return valeur;
  if (!detaille) return LIBELLE_MOI;
  const nom = nomMoi();
  return nom ? `${LIBELLE_MOI} (${nom})` : `${LIBELLE_MOI} (à déclarer avec 👤)`;
}

/**
 * Lit dans les métadonnées Grist les colonnes de la table : toutes servent
 * au tri (#211) ; les colonnes Choix et Référence servent aussi aux filtres.
 */
async function chargerColonnesFiltrables() {
  STATE.colonnesFiltrables = [];
  STATE.colonnesTriables = [];
  STATE.infosColonnes = {};
  STATE.choix = {};
  try {
    await _tableNamePret;
    const tables   = await grist.docApi.fetchTable('_grist_Tables');
    const colonnes = await grist.docApi.fetchTable('_grist_Tables_column');
    const idxTable = tables.tableId.indexOf(getTableName());
    if (idxTable === -1) return;
    const numeroTable = tables.id[idxTable];
    const toutes = [];
    colonnes.id.forEach((_, i) => {
      const colId = colonnes.colId[i];
      const type  = String(colonnes.type[i]);
      if (colonnes.parentId[i] !== numeroTable) return;
      if (colId.startsWith('gristHelper_') || colId === 'manualSort') return; // colonnes internes
      // Choix déclarés (pour proposer des colonnes de statut encore vides, #196,
      // et pour trier dans l'ordre des choix, #211)
      // Styles des choix dans Grist (couleur de fond et de texte), repris par
      // les attributs affichés dans le panneau d'un filtre (#223)
      let styles = {};
      if (type === 'Choice' || type === 'ChoiceList') {
        try {
          const options = JSON.parse(colonnes.widgetOptions[i] || '{}');
          STATE.choix[colId] = options.choices || [];
          styles = options.choiceOptions || {};
        } catch (_) { STATE.choix[colId] = []; }
      }
      STATE.infosColonnes[colId] = { type, choix: STATE.choix[colId], styles };
      const rapporte = libelleRapporte(i, numeroTable, tables, colonnes);
      toutes.push({
        colId, type,
        // Colonne rapportée : toujours précédée de sa référence, « EPIC › Priorite »,
        // pour ne pas la confondre avec une colonne de même nom de la table (#223)
        label: rapporte ? `${rapporte.via} › ${rapporte.label}` : (colonnes.label[i] || colId),
        via:   rapporte ? rapporte.via : null,
        // Colonne rapportée (#223) : référence dont elle est un attribut
        // (ex. 'EPIC' pour $EPIC.Priorite) et libellé court de l'attribut
        ref:      rapporte ? rapporte.colRef : null,
        attribut: rapporte ? rapporte.label  : null,
      });
    });
    // Colonne associée dans ⚙ à un champ du Kanban qui porte un autre nom :
    // on rappelle ce champ, « qui ? (Assigné à) », pour faire le lien avec ⚙
    // et le mode d'emploi (#202)
    toutes.forEach(c => {
      const champ = Object.keys(PROP_LABELS).find(k => STATE.mapping[k] === c.colId);
      if (champ && pourRecherche(c.label) !== pourRecherche(PROP_LABELS[champ])) {
        c.label += ` (${PROP_LABELS[champ]})`;
      }
    });
    toutes.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    STATE.colonnesTriables   = toutes;
    STATE.colonnesFiltrables = toutes.filter(c => /^(Choice|ChoiceList|Ref:.+|RefList:.+)$/.test(c.type));
  } catch (err) {
    console.error('Kanban – lecture des colonnes filtrables impossible:', err);
  }
}

/**
 * Colonne « rapportée » d'une autre table, c'est-à-dire dont la formule est
 * exactement « $EPIC.objectif_resultat_cle » : Grist la nomme
 * « EPIC_objectifs résultats clé », on préfère le libellé de la colonne d'origine.
 * @param {number} i - position de la colonne dans `colonnes` (_grist_Tables_column)
 * @returns {{label:string, via:string, colRef:string}|null} libellé d'origine,
 *          libellé de la colonne de référence (ex. 'EPIC') et son identifiant
 *          Grist ; null si ce n'est pas une colonne rapportée.
 */
function libelleRapporte(i, numeroTable, tables, colonnes) {
  const m = /^\$(\w+)\.(\w+)$/.exec(String(colonnes.formula[i] || '').trim());
  if (!colonnes.isFormula[i] || !m) return null;
  const [, colRef, colSource] = m;

  // La colonne de référence (EPIC) et la table qu'elle vise (EPICs)
  const idxRef = colonnes.id.findIndex((_, j) =>
    colonnes.parentId[j] === numeroTable && colonnes.colId[j] === colRef);
  if (idxRef === -1) return null;
  const cible = /^Ref:(.+)$/.exec(String(colonnes.type[idxRef]));
  const idxTableCible = cible ? tables.tableId.indexOf(cible[1]) : -1;
  if (idxTableCible === -1) return null;

  // La colonne d'origine dans la table visée, et son libellé
  const idxSource = colonnes.id.findIndex((_, j) =>
    colonnes.parentId[j] === tables.id[idxTableCible] && colonnes.colId[j] === colSource);
  if (idxSource === -1) return null;
  return {
    label: colonnes.label[idxSource] || colSource,
    via:   colonnes.label[idxRef] || colRef,
    colRef,
  };
}

function libelleColonne(colId) {
  const c = STATE.colonnesFiltrables.find(c => c.colId === colId);
  return c ? c.label : colId;
}

/**
 * Valeurs d'une cellule, nettoyées, sous forme de liste ([] = cellule vide).
 * Rend équivalentes les valeurs dont le sens est le même :
 *   null, '', '   ', [] et 0 (référence vide) → [] ;
 *   ' Martin  Schoreisz ' → 'Martin Schoreisz' (espaces en trop retirés).
 * Les majuscules sont conservées : deux choix « Fait » et « fait » restent distincts.
 */
function valeursCellule(valeur) {
  const brutes = Array.isArray(valeur) ? valeur : [valeur];
  const propres = brutes
    .filter(v => v !== null && v !== undefined && v !== 0)
    .map(v => String(v).replace(/\s+/g, ' ').trim())
    .filter(v => v !== '');
  return [...new Set(propres)];
}

/** Une carte respecte-t-elle un filtre ? */
function carteRespecte(record, filtre) {
  if (filtre.valeurs.length === 0) return true; // condition incomplète : ignorée
  // « Moi » devient le nom de la personne déclarée ; si personne n'est
  // déclaré, il ne correspond à aucune carte
  const valeurs = filtre.valeurs.includes(MOI)
    ? filtre.valeurs.filter(v => v !== MOI).concat(nomMoi() || [])
    : filtre.valeurs;
  const vals = valeursCellule(record[filtre.col]);
  const cochee = vals.length === 0
    ? valeurs.includes(VIDE)
    : vals.some(v => valeurs.includes(v));
  return filtre.op === 'nestpas' ? !cochee : cochee;
}

/**
 * Valeurs proposées pour une colonne : celles présentes dans les cartes du
 * projet, avec leur nombre de cartes, plus les valeurs déjà cochées (pour
 * pouvoir les décocher même si plus aucune carte ne les porte).
 * @returns {Array<{valeur:string, nb:number}>} « (vide) » en tête, puis ordre alphabétique
 */
function valeursProposees(colId, dejaCochees) {
  const comptes = new Map();
  recordsDuProjet().forEach(r => {
    const vals = valeursCellule(r[colId]);
    (vals.length ? vals : [VIDE]).forEach(v => comptes.set(v, (comptes.get(v) || 0) + 1));
  });
  dejaCochees.forEach(v => { if (v !== MOI && !comptes.has(v)) comptes.set(v, 0); });
  const proposees = [...comptes.entries()]
    .map(([valeur, nb]) => ({ valeur, nb }))
    .sort((a, b) => a.valeur === VIDE ? -1 : b.valeur === VIDE ? 1 : a.valeur.localeCompare(b.valeur, 'fr'));
  // « 👤 Moi » tout en tête pour la colonne « Assigné à » (#202), avec le
  // nombre de cartes de la personne déclarée
  if ((colId === STATE.mapping.assigne && REFS.assigne) || dejaCochees.includes(MOI)) {
    const nom = nomMoi();
    proposees.unshift({ valeur: MOI, nb: nom ? (comptes.get(nom) || 0) : 0 });
  }
  return proposees;
}

/* ── Attributs d'une référence dans le panneau d'un filtre (#223) ──
   Quand on filtre sur une référence (ex. EPIC), on peut afficher, en gris à
   côté de chaque valeur, des attributs de l'objet visé (ex. sa priorité).
   Sont proposées les colonnes « rapportées » de la table, c'est-à-dire dont
   la formule est exactement $EPIC.X (menu de Grist « ajouter une colonne
   depuis la référence ») : aucun réglage, il suffit d'ajouter la colonne.
   La valeur de l'attribut est lue dans les cartes qui portent cette valeur.
   Le choix des attributs est retenu par le navigateur, pour chaque colonne
   filtrée : chacun le sien, rien n'est écrit dans le document. */

/** Colonnes rapportées de la référence `colId` (ex. pour 'EPIC' : EPIC_Priorite…). */
function attributsDe(colId) {
  return STATE.colonnesTriables.filter(c => c.ref === colId);
}

/** Attributs affichés pour la colonne `colId`, limités à ceux qui existent encore. */
function attributsAffiches(colId) {
  // Relu si la clé change (document ou projet du Kanban connus plus tard)
  const cle = cleMemoire('attributs');
  if (!STATE.attributsAffiches || STATE.attributsCle !== cle) {
    STATE.attributsAffiches = {};
    STATE.attributsCle = cle;
    try {
      const lus = cle && JSON.parse(localStorage.getItem(cle) || '{}');
      if (lus && typeof lus === 'object') STATE.attributsAffiches = lus;
    } catch (err) { /* mémoire indisponible : rien d'affiché par défaut */ }
  }
  const possibles = attributsDe(colId).map(c => c.colId);
  return (STATE.attributsAffiches[colId] || []).filter(a => possibles.includes(a));
}

/** Retient dans ce navigateur les attributs affichés pour la colonne `colId`. */
function definirAttributs(colId, choisis) {
  // Ordre de la liste (alphabétique), plutôt que l'ordre des clics
  STATE.attributsAffiches[colId] = attributsDe(colId).map(c => c.colId).filter(a => choisis.includes(a));
  try {
    if (!STATE.attributsCle) throw new Error('document inconnu');
    localStorage.setItem(STATE.attributsCle, JSON.stringify(STATE.attributsAffiches));
  } catch (err) { /* le choix vaut pour la séance seulement */ }
  calculerDetails();
  remplirPanneauFiltre();
}

/**
 * Texte lisible d'une cellule d'attribut : dates en jj/mm/aaaa (Grist les
 * envoie en secondes depuis 1970), case cochée en ✓, listes séparées par
 * des virgules. '' si la cellule est vide.
 */
function texteAttribut(valeur, type) {
  if (valeur === null || valeur === undefined || valeur === '') return '';
  if (Array.isArray(valeur)) return valeur.map(v => texteAttribut(v, type)).filter(Boolean).join(', ');
  if (/^Date/.test(type) && typeof valeur === 'number') {
    return new Date(valeur * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  }
  if (type === 'Bool') return valeur ? '✓' : '';
  return String(valeur).replace(/\s+/g, ' ').trim();
}

/**
 * Style Grist d'un choix (couleur de fond et de texte réglées dans la
 * colonne), ou null s'il n'en a pas. Seules les colonnes Choix en ont.
 */
function styleChoix(colId, texte) {
  const style = STATE.infosColonnes[colId]?.styles?.[texte];
  return style && (style.fillColor || style.textColor)
    ? { fond: style.fillColor || '', texte: style.textColor || '' }
    : null;
}

/**
 * Pour chaque valeur du panneau, ses attributs affichés (ex. « Then · Cerema ») :
 *   p.detail  : le texte entier, pour la recherche et la bulle ;
 *   p.morceaux: [[{ texte, style }…] par attribut], pour l'affichage.
 * Lus dans les cartes du projet qui portent cette valeur ; si elles ne sont
 * pas d'accord (cas d'une liste de références), toutes les valeurs sont données.
 */
function calculerDetails() {
  const f = STATE.filtreEdite;
  const attributs = attributsAffiches(f.col)
    .map(a => STATE.colonnesTriables.find(c => c.colId === a))
    .filter(Boolean);
  // Valeur filtrée → pour chaque attribut, l'ensemble des textes rencontrés
  const textes = new Map();
  if (attributs.length) {
    recordsDuProjet().forEach(r => {
      valeursCellule(r[f.col]).forEach(v => {
        if (!textes.has(v)) textes.set(v, attributs.map(() => new Set()));
        attributs.forEach((a, i) => {
          const t = texteAttribut(r[a.colId], a.type);
          if (t) textes.get(v)[i].add(t);
        });
      });
    });
  }
  STATE.ordreValeurs.forEach(p => {
    const ensembles = textes.get(p.valeur);
    p.morceaux = ensembles
      ? ensembles.map((e, i) => [...e].map(t => ({ texte: t, style: styleChoix(attributs[i].colId, t) })))
                 .filter(m => m.length)
      : [];
    p.detail = p.morceaux.map(m => m.map(x => x.texte).join(', ')).join(' · ');
  });
}

/**
 * Dessine les attributs d'une valeur dans `zone` : texte gris, ou pastille
 * aux couleurs de Grist si le choix en a ; « · » entre deux attributs.
 */
function dessinerMorceaux(zone, morceaux) {
  morceaux.forEach((attribut, i) => {
    if (i) zone.append(' · ');
    attribut.forEach((m, j) => {
      if (j) zone.append(', ');
      if (!m.style) { zone.append(m.texte); return; }
      const pastille = document.createElement('span');
      pastille.className = 'filtre-valeur-pastille';
      pastille.textContent = m.texte;
      if (m.style.fond)  pastille.style.background = m.style.fond;
      if (m.style.texte) pastille.style.color = m.style.texte;
      zone.appendChild(pastille);
    });
  });
}

/**
 * Bouton « Afficher (n) ▾ » du panneau (#226) : caché si la colonne n'a pas
 * d'attribut ; (n) = nombre d'attributs affichés, pour que le réglage se voie.
 */
function majBoutonAfficher() {
  const bouton = document.getElementById('filtre-afficher');
  if (!bouton) return;
  const f = STATE.filtreEdite;
  const possibles = attributsDe(f.col);
  bouton.classList.toggle('hidden', possibles.length === 0);
  const choisis = attributsAffiches(f.col);
  bouton.classList.toggle('actif', choisis.length > 0);
  bouton.textContent = choisis.length ? `Afficher (${choisis.length}) ▾` : 'Afficher ▾';
  bouton.title = choisis.length
    ? 'Attributs affichés à côté de chaque valeur : '
      + possibles.filter(c => choisis.includes(c.colId)).map(c => c.attribut).join(', ')
      + ' (retenu par ce navigateur)'
    : 'Afficher des attributs à côté de chaque valeur (retenu par ce navigateur)';
}

/**
 * Liste à cocher des attributs, ouverte sous le bouton « Afficher ». Elle
 * reste ouverte tant qu'on coche (menu « multiple » de fiche.js) et se ferme
 * par un clic ailleurs ou par Échap.
 */
function ouvrirMenuAfficher() {
  const f = STATE.filtreEdite;
  if (!f) return;
  const col = f.col;
  Fiche.menuChoix(document.getElementById('filtre-afficher'), {
    options: attributsDe(col).map(c => ({ valeur: c.colId, libelle: c.attribut })),
    selection: attributsAffiches(col),
    multiple: true,
    surChoix: (choisis) => definirAttributs(col, choisis),
  });
}

/** Texte comparable pour la recherche : sans accents ni majuscules. */
function pourRecherche(texte) {
  return Recherche.simplifier(texte);
}

function isAnyUserFilterActive() {
  return STATE.filters.some(f => f.valeurs.length > 0);
}

/** EPIC à préremplir dans une nouvelle carte : seulement si un filtre dit « EPIC est X » (une seule valeur). */
function epicDuFiltre() {
  const f = STATE.filters.find(f =>
    f.col === STATE.mapping.epic && f.op === 'est' && f.valeurs.length === 1 && f.valeurs[0] !== VIDE);
  return f ? f.valeurs[0] : '';
}

/**
 * Personne à préremplir dans « Assigné à » d'une nouvelle carte (#202) : la
 * personne déclarée, si un filtre dit « Assigné à est … 👤 Moi ». Sans cela,
 * une carte créée depuis « Mes tâches » disparaîtrait aussitôt de la vue.
 * @returns {number|null} numéro de ligne de la personne, ou null
 */
function moiDuFiltre() {
  const f = STATE.filters.find(f =>
    f.col === STATE.mapping.assigne && f.op === 'est' && f.valeurs.includes(MOI));
  return f ? STATE.moi : null;
}

/* ── Étiquettes des filtres dans la barre ── */

/** Redessine les étiquettes de la fenêtre (« EPIC n'est pas : A, B ✕ ») et les résumés de la barre. */
function renderFilterChips() {
  const zone = document.getElementById('filtres-actifs');
  if (!zone) return;
  zone.innerHTML = '';
  STATE.filters.forEach(filtre => {
    const noms = filtre.valeurs.map(v => libelleValeur(v));
    const resume = noms.join(', ') || '…';
    const chip = document.createElement('button');
    chip.className = 'filtre-chip' + (filtre === STATE.filtreEdite ? ' actif' : '');
    chip.title = `${libelleColonne(filtre.col)} ${filtre.op === 'est' ? 'est' : "n'est pas"} : ${noms.join(', ') || '—'}`;
    chip.textContent = `${libelleColonne(filtre.col)} ${filtre.op === 'est' ? 'est' : "n'est pas"} : ${resume}`;
    chip.addEventListener('click', () => ouvrirFiltre(filtre));

    const croix = document.createElement('span');
    croix.className = 'filtre-chip-x';
    croix.textContent = '✕';
    croix.title = 'Retirer ce filtre';
    croix.addEventListener('click', (e) => { e.stopPropagation(); supprimerFiltre(filtre); });
    chip.appendChild(croix);
    zone.appendChild(chip);
  });

  majBoutonFiltres();
  majBoutonTri();
  majBoutonColonnes();

  const ajouter = document.getElementById('fv-filtre-ajouter');
  if (ajouter) {
    ajouter.disabled = STATE.colonnesFiltrables.length === 0;
    ajouter.title = ajouter.disabled ? 'Aucune colonne Choix ou Référence dans la table' : 'Ajouter un filtre';
  }
}

/** Bouton « 🔽 Filtres » de la barre : leur nombre, et le détail au survol. */
function majBoutonFiltres() {
  const bouton = document.getElementById('filtres-bouton');
  if (!bouton) return;
  const filtres = STATE.filters.filter(f => f.valeurs.length > 0);
  const nb = filtres.length;
  bouton.classList.toggle('actif', nb > 0);
  bouton.textContent = nb ? `🔽 ${nb} filtre${nb > 1 ? 's' : ''}` : '🔽 Filtres';
  bouton.title = nb
    ? filtres.map(f => `${libelleColonne(f.col)} ${f.op === 'est' ? 'est' : "n'est pas"} : ${f.valeurs.map(v => libelleValeur(v)).join(', ')}`).join('\n')
    : 'Filtrer les cartes de la vue';
}

/** Bouton « ▦ Colonnes » de la barre : nombre de statuts retenus par la vue, et leur liste au survol. */
function majBoutonColonnes() {
  const bouton = document.getElementById('colonnes-bouton');
  if (!bouton) return;
  const colonnes = vueEnregistree(STATE.activeView)?.colonnes || [];
  const nb = colonnes.length;
  bouton.classList.toggle('actif', nb > 0);
  bouton.textContent = nb ? `▦ ${nb} colonne${nb > 1 ? 's' : ''}` : '▦ Colonnes';
  bouton.title = nb ? colonnes.join(', ') : 'Tous les statuts présents';
}

/* ── Panneau de modification d'un filtre ── */

/** Crée un filtre sur la première colonne pas encore filtrée, puis ouvre le panneau. */
function ajouterFiltre() {
  if (STATE.colonnesFiltrables.length === 0) return;
  fermerFiltre();
  const dejaFiltrees = STATE.filters.map(f => f.col);
  const colonne = STATE.colonnesFiltrables.find(c => !dejaFiltrees.includes(c.colId)) || STATE.colonnesFiltrables[0];
  const filtre = { col: colonne.colId, op: 'est', valeurs: [] };
  STATE.filters.push(filtre);
  ouvrirFiltre(filtre);
}

function supprimerFiltre(filtre) {
  if (STATE.filtreEdite === filtre) fermerFiltre();
  STATE.filters = STATE.filters.filter(f => f !== filtre);
  renderBoard();
}

/** Affiche le panneau d'un filtre, sous les étiquettes de la fenêtre. */
function ouvrirFiltre(filtre) {
  if (STATE.filtreEdite && STATE.filtreEdite !== filtre) fermerFiltre();
  STATE.filtreEdite = filtre;

  // Liste des colonnes
  const sel = document.getElementById('filtre-colonne');
  sel.innerHTML = '';
  STATE.colonnesFiltrables.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.colId; opt.textContent = c.label;
    sel.appendChild(opt);
  });
  sel.value = filtre.col;

  document.getElementById('filtre-recherche').value = '';
  calculerOrdreValeurs();
  remplirPanneauFiltre();

  document.getElementById('filtre-popover').classList.remove('hidden');
  document.getElementById('filtre-recherche').focus();
  renderFilterChips();
}

/** Ferme le panneau ; un filtre laissé sans valeur cochée est retiré. */
function fermerFiltre() {
  const pop = document.getElementById('filtre-popover');
  if (pop) pop.classList.add('hidden');
  if (!STATE.filtreEdite) return;
  Fiche.fermerMenu(); // la liste « Afficher » (#226), si elle est ouverte
  STATE.filtreEdite = null;
  STATE.filters = STATE.filters.filter(f => f.valeurs.length > 0);
  renderFilterChips();
}

/**
 * Fige l'ordre d'affichage des valeurs : les valeurs cochées d'abord, puis
 * les autres. Calculé à l'ouverture seulement, pour que la liste ne saute
 * pas sous la souris à chaque case cochée.
 */
function calculerOrdreValeurs() {
  const f = STATE.filtreEdite;
  const proposees = valeursProposees(f.col, f.valeurs);
  STATE.ordreValeurs = [
    ...proposees.filter(p => f.valeurs.includes(p.valeur)),
    ...proposees.filter(p => !f.valeurs.includes(p.valeur)),
  ];
  calculerDetails();
}

/** Valeurs affichées compte tenu du texte de recherche (qui porte aussi sur les attributs affichés, #223). */
function valeursVisibles() {
  const saisie = document.getElementById('filtre-recherche').value;
  return STATE.ordreValeurs.filter(p =>
    Recherche.correspond(saisie, pourRecherche(`${libelleValeur(p.valeur, true)} ${p.detail || ''}`)));
}

/** (Re)dessine opérateur, cases à cocher et compteur du panneau. */
function remplirPanneauFiltre() {
  const f = STATE.filtreEdite;
  document.querySelectorAll('#filtre-popover .filtre-op').forEach(b => b.classList.toggle('actif', b.dataset.op === f.op));
  majBoutonAfficher();

  const liste = document.getElementById('filtre-valeurs');
  liste.innerHTML = '';
  const visibles = valeursVisibles();
  visibles.forEach(({ valeur, nb, detail, morceaux }) => {
    const ligne = document.createElement('label');
    ligne.className = 'filtre-valeur' + (valeur === VIDE ? ' vide' : valeur === MOI ? ' moi' : '');
    const caseACocher = document.createElement('input');
    caseACocher.type = 'checkbox';
    caseACocher.checked = f.valeurs.includes(valeur);
    caseACocher.addEventListener('change', () => basculerValeur(valeur, caseACocher.checked));
    const nom = document.createElement('span');
    nom.className = 'filtre-valeur-nom';
    nom.textContent = libelleValeur(valeur, true);
    nom.title = nom.textContent;
    // Attributs affichés (#223), en gris ou aux couleurs de Grist ; le texte entier au survol
    const attributs = document.createElement('span');
    attributs.className = 'filtre-valeur-detail';
    dessinerMorceaux(attributs, morceaux || []);
    attributs.title = detail || '';
    const compte = document.createElement('span');
    compte.className = 'filtre-valeur-nb';
    compte.textContent = nb;
    ligne.append(caseACocher, nom, attributs, compte);
    liste.appendChild(ligne);
  });
  if (visibles.length === 0) {
    liste.innerHTML = '<div class="filtre-aucune">Aucune valeur ne correspond.</div>';
  }
  majCompteFiltre();
}

/** Compteur « n cochées sur m » du panneau. */
function majCompteFiltre() {
  const n = STATE.filtreEdite.valeurs.length;
  document.getElementById('filtre-compte').textContent =
    `${n} cochée${n > 1 ? 's' : ''} sur ${STATE.ordreValeurs.length}`;
}

function basculerValeur(valeur, cochee) {
  const f = STATE.filtreEdite;
  f.valeurs = f.valeurs.filter(v => v !== valeur);
  if (cochee) f.valeurs.push(valeur);
  majCompteFiltre();
  renderBoard();
}

/** « Tout cocher » / « Aucun » : n'agit que sur les valeurs visibles (après recherche). */
function cocherVisibles(cochee) {
  const f = STATE.filtreEdite;
  const visibles = valeursVisibles().map(p => p.valeur);
  f.valeurs = f.valeurs.filter(v => !visibles.includes(v));
  if (cochee) f.valeurs.push(...visibles);
  remplirPanneauFiltre();
  renderBoard();
}

/* ── 3 bis. Tri des cartes (#211) ──────────────────────────────
   Le tri range les cartes à l'intérieur de chaque colonne de statut. C'est
   une liste de critères { col, sens } : la carte est d'abord rangée selon le
   premier critère, puis, à égalité, selon le suivant. Toutes les colonnes de
   la table sont proposées, plus le numéro de la carte (# Numéro). Comment
   chaque type se compare (ordre des choix de Grist, dates, A → Z…) : voir
   ../_commun/tri.js. Les cartes sans valeur restent en bas.
   Sans critère, ou à égalité sur tous, les cartes sont rangées par priorité
   (haute → moyenne → basse), comme avant #211.
   Le tri fait partie de la vue, comme les filtres : il se règle dans
   « Gérer la vue » (#214) et 💾 le garde. */

/** Colonne proposée pour trier sur le numéro de la carte (#id). */
const COLONNE_NUMERO = { colId: 'id', label: '# Numéro', type: 'Int' };

/** Colonnes proposées dans le tri : le numéro de la carte, puis toutes les colonnes. */
function colonnesProposeesTri() {
  return [COLONNE_NUMERO, ...STATE.colonnesTriables];
}

function libelleColonneTri(colId) {
  const c = colonnesProposeesTri().find(c => c.colId === colId);
  return c ? c.label : colId;
}

/** Ordre de deux cartes d'une même colonne : critères du tri, puis priorité. */
function comparerCartes(a, b) {
  return Tri.comparerLignes(a, b, STATE.tri, STATE.infosColonnes)
    || getPrioRank(getField(a, 'priorite')) - getPrioRank(getField(b, 'priorite'));
}

/** Libellés des deux sens [croissant, décroissant], adaptés au type de la colonne. */
function libellesSens(colId) {
  const type = colId === 'id' ? 'Int' : String((STATE.infosColonnes[colId] || {}).type || '');
  if (/^Date/.test(type))            return ['↑ Ancienne', '↓ Récente'];
  if (/^(Int|Numeric)$/.test(type))  return ['↑ 1 → 9', '↓ 9 → 1'];
  if (/^Choice/.test(type))          return ['↑ Ordre Grist', '↓ Inverse'];
  if (type === 'Bool')               return ['↑ Non', '↓ Oui'];
  return ['↑ A → Z', '↓ Z → A'];
}

/** Bouton « ⇅ Trier » de la barre : résume le tri en cours (« ⇅ Échéance ↑ +1 »). */
function majBoutonTri() {
  const bouton = document.getElementById('tri-bouton');
  if (!bouton) return;
  const fleche = c => (c.sens === 'desc' ? '↓' : '↑');
  const [premier, ...autres] = STATE.tri;
  bouton.classList.toggle('actif', !!premier);
  bouton.textContent = premier
    ? `⇅ ${libelleColonneTri(premier.col)} ${fleche(premier)}${autres.length ? ` +${autres.length}` : ''}`
    : '⇅ Trier';
  bouton.title = premier
    ? 'Tri : ' + STATE.tri.map(c => `${libelleColonneTri(c.col)} ${fleche(c)}`).join(', puis ')
    : 'Trier les cartes de chaque colonne (par défaut : par priorité)';
}

/** (Re)dessine les critères du panneau : colonne, sens, ✕. */
function remplirTri() {
  const zone = document.getElementById('tri-criteres');
  zone.innerHTML = '';
  if (!STATE.tri.length) {
    zone.innerHTML = '<div class="filtre-aucune">Aucun tri choisi : les cartes sont rangées par priorité.</div>';
  }
  const proposees = colonnesProposeesTri();
  STATE.tri.forEach((critere, i) => {
    const ligne = document.createElement('div');
    ligne.className = 'tri-critere';

    const rang = document.createElement('span');
    rang.className = 'tri-rang';
    rang.textContent = i === 0 ? 'Par' : 'puis';

    const choix = document.createElement('select');
    choix.className = 'filter-select';
    choix.title = 'Colonne';
    proposees.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.colId; opt.textContent = c.label;
      choix.appendChild(opt);
    });
    // Colonne enregistrée dans la vue mais absente de la table (renommée, supprimée)
    if (!proposees.some(c => c.colId === critere.col)) {
      const opt = document.createElement('option');
      opt.value = critere.col; opt.textContent = `${critere.col} (absente)`;
      choix.appendChild(opt);
    }
    choix.value = critere.col;
    choix.addEventListener('change', () => { critere.col = choix.value; changerTri(); });

    const sens = document.createElement('div');
    sens.className = 'filtre-ops';
    libellesSens(critere.col).forEach((libelle, j) => {
      const valeur = j === 0 ? 'asc' : 'desc';
      const bouton = document.createElement('button');
      bouton.className = 'filtre-op' + (critere.sens === valeur ? ' actif' : '');
      bouton.textContent = libelle;
      bouton.addEventListener('click', () => { critere.sens = valeur; changerTri(); });
      sens.appendChild(bouton);
    });

    const retirer = document.createElement('button');
    retirer.className = 'filtre-chip-x tri-retirer';
    retirer.textContent = '✕';
    retirer.title = 'Retirer ce critère';
    retirer.addEventListener('click', () => { STATE.tri.splice(i, 1); changerTri(); });

    ligne.append(rang, choix, sens, retirer);
    zone.appendChild(ligne);
  });
  document.getElementById('tri-retirer-tout').disabled = STATE.tri.length === 0;
  // Au-delà de Tri.CRITERES_MAX, un critère ne serait pas enregistré dans la vue
  document.getElementById('tri-ajouter').disabled = STATE.tri.length >= Tri.CRITERES_MAX;
}

/**
 * Ajoute un critère : l'Échéance, puis la Priorité (« par échéance, puis par
 * priorité » est le tri le plus courant), sinon la première colonne pas
 * encore utilisée. On peut ensuite choisir une autre colonne.
 */
function ajouterCritereTri() {
  const utilisees = STATE.tri.map(c => c.col);
  const libres = colonnesProposeesTri().filter(c => !utilisees.includes(c.colId)).map(c => c.colId);
  const col = [STATE.mapping.date, STATE.mapping.priorite].find(c => c && libres.includes(c))
    || libres[0] || 'id';
  STATE.tri.push({ col, sens: 'asc' });
  changerTri();
}

/** Le tri a changé : on redessine le panneau et le tableau. */
function changerTri() {
  remplirTri();
  renderBoard();
}

/* Cartes affichées : celles du projet qui respectent les filtres et la recherche */
function getFilteredRecords() {
  return STATE.records.filter(r => {
    // ✅ Projet du Kanban : on ne garde que les cartes du projet choisi
    if (!estDuProjet(r)) return false;

    // Filtres de la vue (ou ajoutés par l'utilisateur) : tous doivent être respectés
    if (!STATE.filters.every(f => carteRespecte(r, f))) return false;

    // Recherche (#209) : dans toutes les colonnes de la carte, et #numéro
    return Recherche.ligneCorrespond(r, STATE.recherche, STRUCTURE_RECHERCHE);
  });
}

/* ── Recherche (#209) ──
   La règle (accents ignorés, chaque mot, #numéro) et la lecture des
   colonnes sont dans ../_commun/recherche.js, communes avec la Galerie.
   Ici : le champ 🔍 et la « structure » de la table (types des colonnes,
   noms affichés des références), lue à la première recherche puis relue
   quand les données changent pendant une recherche. */

let STRUCTURE_RECHERCHE = null;    // dernière structure lue (null : pas encore)
let _structureAJour = false;       // false : à relire avant la prochaine recherche
let _structureEnCours = null;      // lecture en cours (une seule à la fois)

function rechercheActive() {
  return STATE.recherche.trim() !== '';
}

/** Lit la structure si elle manque ou a vieilli, puis redessine le tableau. */
function assurerStructureRecherche() {
  if (_structureAJour || _structureEnCours) return;
  _structureEnCours = (async () => {
    try {
      await _tableNamePret;
      STRUCTURE_RECHERCHE = await Recherche.lireStructure(getTableName());
    } catch (err) {
      // Sans structure, la recherche parcourt quand même les textes
      console.error('Kanban – structure de la table illisible pour la recherche :', err);
    }
    _structureAJour = true;   // même en cas d'échec : pas de nouvel essai à chaque touche
    _structureEnCours = null;
    if (rechercheActive()) renderBoard();
  })();
}

/** Les données ont changé : la structure sera relue (tout de suite si une recherche est en cours). */
function marquerStructureRecherchePerimee() {
  _structureAJour = false;
  if (rechercheActive()) assurerStructureRecherche();
}

/** Change le texte recherché (champ 🔍, Échap), puis redessine. */
function changerRecherche(texte) {
  STATE.recherche = texte;
  const champ = document.getElementById('recherche');
  if (champ && champ.value !== texte) champ.value = texte;
  if (rechercheActive()) assurerStructureRecherche();
  renderBoard();
}

/* ══════════════════════════════════════════════════════════════
   4. RENDU DU BOARD
   ══════════════════════════════════════════════════════════════ */

function renderBoard() {
  const board = document.getElementById('board');
  renderFilterChips();
  renderVueTabs();
  majBarreProjet();
  majBoutonMoi();
  majFenetreVue();

  if (!STATE.mapping.titre || !STATE.mapping.statut) {
    board.innerHTML = `<div class="empty-state"><div class="empty-icon">⚙️</div><p>Configuration requise</p><p class="empty-hint">Cliquez sur ⚙ pour associer les colonnes.</p></div>`;
    return;
  }
  if (STATE.records.length === 0) {
    board.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Aucune donnée</p></div>`;
    return;
  }

  const view = vueCourante();
  const filteredRecords = getFilteredRecords();
  const filterActive = isAnyUserFilterActive() || rechercheActive();

  // ✨ Une vue "restreinte" est une vue dont preferredOrder n'est pas vide
  const hasPreferredOrder = view.preferredOrder && view.preferredOrder.length > 0;

  const allStatuts = new Set();

  if (hasPreferredOrder) {
    // ✨ Vue restreinte : uniquement les colonnes de preferredOrder
    view.preferredOrder.forEach(s => allStatuts.add(s));
  } else {
    // Vue sans liste de colonnes : on collecte tous les statuts présents
    STATE.records.forEach(r => {
      const s = getField(r, 'statut') ?? 'Sans statut';
      allStatuts.add(String(s));
    });
  }

  // Grouper
  const groups = {};
  allStatuts.forEach(s => { groups[s] = []; });
  filteredRecords.forEach(r => {
    const s = String(getField(r, 'statut') ?? 'Sans statut');
    if (!groups[s]) {
      // Statut hors de la liste autorisée pour une vue restreinte → on l'ignore
      if (hasPreferredOrder) return;
      groups[s] = [];
    }
    groups[s].push(r);
  });

  // Tri des cartes dans chaque colonne : critères du tri (#211), puis priorité
  Object.keys(groups).forEach(s => groups[s].sort(comparerCartes));

  const statutList = getOrderedStatuts(Object.keys(groups), view);
  board.innerHTML = '';

  const totalFiltered = filteredRecords.length;

  statutList.forEach((statut) => {
    const isEmptyCol = (groups[statut] || []).length === 0;

    // ✨ Colonne "de base" = colonne définie par preferredOrder de la vue active
    const isBaseCol = hasPreferredOrder && view.preferredOrder.includes(statut);

    // Masquer les colonnes vides si filtre actif (sauf colonnes de base, choisies dans la vue)
    if (filterActive && isEmptyCol && !isBaseCol) return;

    const palette = couleurStatut(statut);
    const col = buildColumn(statut, groups[statut] || [], palette, totalFiltered, view);
    board.appendChild(col);
  });

  if (board.children.length === 0) {
    const aide = (filtreMoiActif() && !STATE.moi)
      ? 'Le filtre « 👤 Moi » ne retient aucune carte tant que vous n\'avez pas indiqué qui vous êtes : cliquez sur « 👤 Qui suis-je ? », en haut à droite.'
      : 'Aucune carte ne correspond aux filtres actifs.';
    board.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Aucun résultat</p><p class="empty-hint">${aide}</p></div>`;
  }
}

/** Barre du haut : nom du projet du Kanban, ou alerte si aucun projet n'est choisi. */
function majBarreProjet() {
  const tn = document.getElementById('toolbar-table-name');
  // ✅ Barre du haut : projet du Kanban (ou alerte si aucun projet choisi).
  // La vue active n'y figure plus : l'onglet sélectionné l'indique déjà.
  if (tn) {
    if (STATE.mapping.projet && !STATE.projetKanban) {
      tn.textContent = '⚠️ Choisissez le projet du Kanban dans ⚙';
      tn.style.color = 'var(--danger)';
    } else {
      const nomProjet = STATE.projetKanban ? nomAffiche('projet', STATE.projetKanban) : '';
      tn.textContent = nomProjet ? `Projet : ${nomProjet}` : '';
      tn.style.color = '';
    }
    // Pastille grise masquée quand il n'y a rien à afficher
    tn.style.display = tn.textContent ? '' : 'none';
  }
}

/**
 * Court mode d'emploi du widget.
 * Texte fixe (aucune donnée de Grist), d'où l'usage d'innerHTML.
 */
function remplirAide() {
  const premiere = vuesRangees().length === 1;   // seulement « Toutes les cartes »
  // Bouton « Mes tâches » (#202) : seulement si « Assigné à » est une référence
  const mesTaches = (STATE.mapping.assigne && REFS.assigne)
    ? `<button id="aide-mes-taches" class="btn-primary">👤 ${vueMesTaches() ? 'Ouvrir' : 'Créer'} ma vue Mes tâches</button>`
    : '';
  document.getElementById('aide-contenu').innerHTML = `
    <div class="aide">
      <h2>Bienvenue dans le Kanban</h2>
      <p class="aide-intro">Les cartes s'affichent dans des <strong>vues</strong>, chacune avec ses filtres,
        son tri et ses colonnes. <strong>Toutes les cartes</strong> montre tout le projet ; créez vos vues
        pour retrouver d'un clic ce qui vous intéresse.</p>
      <div class="aide-boutons">
        ${mesTaches}
        <button id="aide-creer" class="${mesTaches ? 'btn-ghost' : 'btn-primary'}">＋ ${premiere ? 'Créer ma première vue' : 'Créer une vue'}</button>
      </div>
      <ol class="aide-etapes">
        <li><strong>⚙ Configurer</strong> : quatre étapes, une par onglet : ① le projet du Kanban, ② les colonnes de la table, ③ la couleur et la classe des statuts, ④ l'équipe projet (personnes proposées dans « Assigné à »). Un ⚠️ signale une étape à faire. Cliquez sur <strong>Appliquer</strong>, puis sur <strong>Enregistrer</strong>, en haut à droite de Grist.</li>
        <li><strong>＋ Vue</strong> : crée une vue à partir de l'affichage actuel, <strong>🔒 pour vous</strong> (par défaut : gardée aussitôt dans votre navigateur) ou <strong>👥 pour tous</strong> (puis cliquez sur <strong>Enregistrer</strong> de Grist pour la garder). Le menu <strong>⋯</strong> de l'onglet actif permet de la renommer, de la supprimer, ou de copier une vue partagée en vue perso pour l'adapter sans gêner les autres.</li>
        <li><strong>👤 Qui suis-je ?</strong> (en haut à droite) : indiquez votre nom, une fois (rien à enregistrer). Le filtre sur la colonne « Assigné à » propose alors <strong>👤 Moi</strong>, qui montre vos propres cartes ; dans une vue partagée, il montre à chacun les siennes.</li>
        <li><strong>🔽 Filtres</strong>, <strong>⇅ Trier</strong> et <strong>▦ Colonnes</strong> : ces boutons résument la vue et ouvrent <strong>Gérer la vue</strong>, qui règle son nom, ses filtres (« EPIC est … », « Assigné n'est pas … »), son tri et ses colonnes. <strong>💾 Enregistrer</strong> garde tout, <strong>Annuler</strong> ne change rien. Sur <strong>Toutes les cartes</strong>, 💾 crée une nouvelle vue. Dans le filtre d'une référence, le bouton <strong>Afficher ▾</strong> montre des attributs de chaque valeur (la priorité d'un EPIC…), si la table a une colonne ajoutée « depuis la référence ».</li>
        <li><strong>Tri</strong> : range les cartes de chaque colonne selon n'importe quelle colonne (échéance, priorité, titre, # numéro…), puis selon une deuxième à égalité. Les cartes sans valeur restent en bas.</li>
        <li><strong>🔍 Rechercher</strong> (en haut) : garde les cartes qui contiennent tous les mots tapés, dans n'importe quelle colonne, sans tenir compte des accents ni des majuscules ; <strong>#203</strong> retrouve une carte par son numéro. La recherche s'ajoute aux filtres et ne s'enregistre nulle part : Échap l'efface.</li>
        <li><strong>Cartes</strong> : glissez une carte dans une autre colonne pour changer son statut ; cliquez dessus pour ouvrir sa fiche. Dans la fiche, la bande <strong>⛔ Bloquée par / ➡️ Bloque</strong> relie la carte à celles qu'elle attend ou qu'elle retient.</li>
        <li><strong>⚠️ Deux « Enregistrer »</strong> : <strong>💾 Enregistrer</strong> garde les réglages dans la vue ; pour une vue 👥 partagée, le bouton <strong>Enregistrer</strong> de Grist, en haut à droite, l'inscrit ensuite dans le document, pour tous. Sans ce dernier clic, elle est perdue au rechargement de la page, comme les réglages de ⚙. Les vues 🔒 personnelles, les cartes, l'onglet actif et votre nom sont gardés aussitôt.</li>
      </ol>
      <p class="aide-plus"><a href="${URL_AIDE}" target="_blank" rel="noopener">📖 En savoir plus (mode d'emploi complet)</a></p>
    </div>`;
  // La fenêtre passe au-dessus de tout : on la ferme d'abord
  document.getElementById('aide-creer')?.addEventListener('click', () => {
    fenetreAide.fermer();
    ouvrirNomVue('creer', document.getElementById('vue-ajouter'));
  });
  document.getElementById('aide-mes-taches')?.addEventListener('click', () => {
    fenetreAide.fermer();
    ouvrirMesTaches();
  });
}

function getOrderedStatuts(statutList, view) {
  // ✨ preferredOrder s'applique désormais à toutes les vues qui le définissent
  const preferred = (view.preferredOrder && view.preferredOrder.length > 0) ? view.preferredOrder : [];
  const inPreferred = preferred.filter(s => statutList.includes(s));
  const inSaved     = STATE.columnOrder.filter(s => statutList.includes(s) && !inPreferred.includes(s));
  const rest        = statutList.filter(s => !inPreferred.includes(s) && !STATE.columnOrder.includes(s)).sort((a, b) => a.localeCompare(b, 'fr'));
  return [...inPreferred, ...inSaved, ...rest];
}

/* ── Colonne DOM ─────────────────────────────────────────────── */
function buildColumn(statut, cards, palette, totalFiltered, view) {
  const col = document.createElement('div');
  col.className      = 'column';
  col.dataset.statut = statut;
  col.style.background   = palette.bg;
  col.style.borderColor  = palette.accent + '60';

  // Header
  const header = document.createElement('div');
  header.className = 'column-header';
  header.draggable = true;

  const pct = totalFiltered > 0 ? Math.round((cards.length / totalFiltered) * 100) : 0;

  header.innerHTML = `
    <div class="column-title-wrap">
      ${'<span class="column-drag-handle">⠿</span>'}
      <span class="column-title" style="color:${palette.text}">${escHtml(statut)}</span>
    </div>
    <span class="column-count">${cards.length}</span>
  `;

  if (cards.length > 0 && totalFiltered > 0) {
    const progWrap = document.createElement('div');
    progWrap.className = 'column-progress-bar';
    const progFill = document.createElement('div');
    progFill.className = 'column-progress-fill';
    progFill.style.width = pct + '%';
    progFill.style.background = palette.accent;
    progWrap.appendChild(progFill);
    header.appendChild(progWrap);
  }

  col.appendChild(header);

  // Liste de cartes
  const list = document.createElement('div');
  list.className      = 'cards-list';
  list.dataset.statut = statut;
  cards.forEach(r => list.appendChild(buildCard(r, palette)));
  col.appendChild(list);

  // Bouton ajout
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-card';
  addBtn.dataset.statut = statut;
  addBtn.innerHTML = `<span class="add-icon">＋</span> Ajouter une carte`;
  addBtn.addEventListener('click', () => openAddCardModal(statut));
  col.appendChild(addBtn);

  // Drag cartes
  list.addEventListener('dragover',  onDragOver);
  list.addEventListener('dragenter', onDragEnter);
  list.addEventListener('dragleave', onDragLeave);
  list.addEventListener('drop',      onDrop);

  // Drag colonnes

  header.addEventListener('dragstart', onColumnHeaderDragStart);
  header.addEventListener('dragend',   onColumnHeaderDragEnd);
  col.addEventListener('dragover',  onColumnDragOver);
  col.addEventListener('dragleave', onColumnDragLeave);
  col.addEventListener('drop',      onColumnDrop);
  return col;
}

/* ── Carte DOM ───────────────────────────────────────────────── */
function buildCard(record, palette) {
  const card = document.createElement('div');
  card.className  = 'card' + (record.id === STATE.selectedId ? ' selected' : '');
  card.dataset.id = record.id;
  card.draggable  = true;
  card.style.borderLeftColor = palette.accent;

  //Bouton de modification
  const editBtn = document.createElement('button');
  editBtn.className   = 'card-edit-btn';
  editBtn.title       = 'Modifier';
  editBtn.textContent = '✏️';
  editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditPanel(record.id); });
  card.appendChild(editBtn);

  //Bouton de suppression
  const deleteBtn = document.createElement('button');
  deleteBtn.className   = 'card-delete-btn';
  deleteBtn.title       = 'Supprimer';
  deleteBtn.textContent = '🗑️';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCard(record.id, getField(record, 'titre') || '(sans titre)');
  });
  card.appendChild(deleteBtn);

  const titre = getField(record, 'titre') || '(sans titre)';
  const titleEl = document.createElement('div');
  titleEl.className   = 'card-title';
  titleEl.textContent = titre;
  card.appendChild(titleEl);

  // La carte est un aperçu : titre, EPIC, puis priorité, personne(s) et
  // échéance. Le détail (dont la description) se lit dans la fiche.

  // EPIC : sous le titre, en petit et en italique, comme dans la fiche
  const epic = getField(record, 'epic');
  if (epic) {
    const epicEl = document.createElement('div');
    epicEl.className   = 'card-epic';
    epicEl.textContent = '🏷️ ' + (typeof epic === 'number' ? getReferenceName('epic', epic) : epic);
    card.appendChild(epicEl);
  }

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const priorite = getField(record, 'priorite');
  if (priorite) footer.appendChild(buildPrioBadge(priorite));

  // Assigné : afficher le nom si c'est une référence
  const assigne = getField(record, 'assigne');
  if (assigne) {
    const assigneDisplay = typeof assigne === 'number' ? (nomAffiche('assigne', assigne) || String(assigne)) : assigne;
    footer.appendChild(buildBadge('👤 ' + assigneDisplay, 'badge-assigne'));
  }

  const date = getField(record, 'date');
  if (date) footer.appendChild(buildBadge('📅 ' + formatDate(date), 'badge-date'));

  // Enchaînement (#183) : « ⛔ n » cartes à terminer avant, « ➡️ n » cartes
  // qui attendent ; liste au survol. Rien si la carte est terminée ou « autre ».
  Liens.badges(INDEX_LIENS, record.id, STATE.classesStatut).forEach(b => footer.appendChild(b));

  // Numéro de la carte (#203), en petit gris, poussé à droite du pied : c'est
  // le numéro de ligne Grist, celui qu'on cite (« #183 ») dans les échanges.
  const numero = document.createElement('span');
  numero.className   = 'card-id';
  numero.textContent = '#' + record.id;
  footer.appendChild(numero);

  card.appendChild(footer);

  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragend',   onDragEnd);
  // Un clic ouvre la fiche de la carte (et sélectionne la ligne dans Grist,
  // ce que fait openEditPanel). Pas de conflit avec le glisser-déposer : le
  // navigateur n'émet pas de « click » quand la carte a été déplacée.
  card.addEventListener('click', () => openEditPanel(record.id));

  return card;
}

function buildBadge(text, cssClass) {
  const b = document.createElement('span');
  b.className = 'badge ' + cssClass;
  b.textContent = text;
  return b;
}

function buildPrioBadge(val) {
  return buildBadge('● ' + val, 'badge ' + classePriorite(val));
}

/** Classe CSS (couleur) d'une priorité : haute, moyenne, basse ou neutre. */
function classePriorite(val) {
  const v = String(val).toLowerCase();
  if (/haute|high|urgent|critique/i.test(v)) return 'badge-prio-haute';
  if (/moyen|medium|normal/i.test(v))        return 'badge-prio-moyenne';
  if (/bas|low|faible/i.test(v))             return 'badge-prio-basse';
  return 'badge-prio-default';
}

/* ══════════════════════════════════════════════════════════════
   5. MODAL D'AJOUT DE CARTE
   ══════════════════════════════════════════════════════════════ */

async function openAddCardModal(statut) {
  // ✅ Projet du Kanban : pas de création de carte tant que le projet n'est pas
  // choisi (sinon la tâche serait créée sans projet, donc « orpheline »).
  if (STATE.mapping.projet && !STATE.projetKanban) {
    showToast('⚠️ Choisissez d\'abord le projet du Kanban dans ⚙', 3500);
    return;
  }
  STATE.addModal.statut = statut;
  document.getElementById('modal-statut-badge').textContent = statut;
  // ✅ Correctif #182 : le bouton « Créer la carte » est désactivé pendant l'envoi
  // et ne fait pas partie du formulaire reconstruit ; on le réactive à chaque
  // ouverture, sinon la création suivante reste bloquée jusqu'au rechargement.
  const confirmBtn = document.getElementById('modal-confirm');
  if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Créer la carte'; }
  await assurerReferences(); // ✅ Correctif : correspondances numéro ↔ nom à jour
  await chargerLiens();      // cartes proposées dans l'enchaînement (#183)
  buildModalForm(statut);
  document.getElementById('add-card-modal').classList.remove('hidden');
}

function closeAddCardModal() {
  document.getElementById('add-card-modal').classList.add('hidden');
  STATE.addModal.statut = null;
}

function buildModalForm(statut) {
  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  // Titre (obligatoire)
  const fTitre = makeModalField('titre', 'Titre','', true);
  const iTitre = makeInput('text', 'modal-titre', 'Ex. : Mettre à jour la nomenclature…');
  fTitre.appendChild(iTitre);
  body.appendChild(fTitre);

  // Description
  if (STATE.mapping.description) {
    const f = makeModalField('description', 'Description', '📝', false);
    const ta = document.createElement('textarea');
    ta.className = 'modal-input'; ta.id = 'modal-description';
    ta.placeholder = 'Description de la tâche…'; ta.rows = 3;
    f.appendChild(ta); body.appendChild(f);
  }

  // Ligne 1 : Priorité + Statut
  const row1 = document.createElement('div'); row1.className = 'modal-row';
  if (STATE.mapping.priorite) {
    const f = makeModalField('priorite', 'Priorité', '🚦', false);
    const existing = getUniqueFieldValues('priorite');
    f.appendChild(existing.length ? makeSelect(['', ...existing], ['— aucune —', ...existing], 'modal-priorite') : makeInput('text', 'modal-priorite', 'Haute / Moyenne / Basse…'));
    row1.appendChild(f);
  }
  if (STATE.mapping.statut) {
    const f = makeModalField('statut', 'Statut', '📋', false);
    const statuts = getUniqueFieldValues('statut');
    const all = statuts.includes(statut) ? statuts : [statut, ...statuts];
    const sel = makeSelect(all, all, 'modal-statut'); sel.value = statut;
    f.appendChild(sel); row1.appendChild(f);
  }
  if (row1.children.length) body.appendChild(row1);

  // Ligne 2 : EPIC + Assigné
  const row2 = document.createElement('div'); row2.className = 'modal-row';

  //EPIC avec gestion référence/texte
  if (STATE.mapping.epic) {
    const f = makeModalField('epic', 'EPIC', '🏷️', false);
    const epicOptions = getReferenceOptions('epic');

    if (epicOptions.length > 0) {
      const values = ['', ...epicOptions.map(e => e.id)];
      const labels = ['— aucun —', ...epicOptions.map(e => e.nom)];
      const sel = makeSelect(values, labels, 'modal-epic');

      // Pré-remplir si un filtre « EPIC est X » est actif
      const epicFiltre = epicDuFiltre();
      if (epicFiltre) {
        const matchedOption = epicOptions.find(e => e.nom === epicFiltre || e.id === epicFiltre);
        if (matchedOption) sel.value = matchedOption.id;
      }

      f.appendChild(sel);
    } else {
      // Fallback : champ texte
      const inp = makeInput('text', 'modal-epic', 'EPIC…');
      inp.value = epicDuFiltre();
      f.appendChild(inp);
    }
    row2.appendChild(f);
  }

  //Assigné avec référence Contacts
  if (STATE.mapping.assigne) {
    const f = makeModalField('assigne', 'Assigné à', '👤', false);
    const contactOptions = getReferenceOptions('assigne');

    if (contactOptions.length > 0) {
      const values = ['', ...contactOptions.map(c => c.id)];
      // ✅ Correctif : libellé tel que Grist l'affiche (ex. « Prénom Nom »), à défaut Contacts.Nom
      const labels = ['— aucun —', ...contactOptions.map(c => nomAffiche('assigne', c.id) || c.nom)];
      const sel = makeSelect(values, labels, 'modal-assigne');
      // Pré-remplir avec la personne déclarée si un filtre « Assigné à est 👤 Moi » est actif
      const moi = moiDuFiltre();
      if (moi && contactOptions.some(c => c.id === moi)) sel.value = moi;
      f.appendChild(sel);
    } else {
      // Fallback : champ texte
      f.appendChild(makeInput('text', 'modal-assigne', 'Nom…'));
    }
    row2.appendChild(f);
  }

  if (row2.children.length) body.appendChild(row2);

  // Enchaînement (#183) : liens choisis ici, écrits avec la carte
  STATE.addModal.liens = { bloqueePar: [], bloque: [] };
  if (liensAssocies()) {
    const f = makeModalField('liens', 'Enchaînement', '🔗', false);
    f.appendChild(bandeLiens(0, '', (liens) => { STATE.addModal.liens = liens; }));
    body.appendChild(f);
  }

  // Ligne 3 : Date
  const row3 = document.createElement('div'); row3.className = 'modal-row';
  if (STATE.mapping.date) {
    const f = makeModalField('date', 'Échéance', '📅', false);
    f.appendChild(makeInput('date', 'modal-date', ''));
    row3.appendChild(f);
  }
  if (row3.children.length) body.appendChild(row3);

  setTimeout(() => { const t = document.getElementById('modal-titre'); if (t) t.focus(); }, 80);
}

function makeModalField(key, label, icon, required) {
  const f = document.createElement('div'); f.className = 'modal-field';
  const lbl = document.createElement('label');
  lbl.htmlFor   = 'modal-' + key;
  lbl.innerHTML = `${icon} ${label}${required ? ' <span class="required-star">*</span>' : ''}`;
  f.appendChild(lbl);
  return f;
}

function makeInput(type, id, placeholder) {
  const el = document.createElement('input');
  el.type = type; el.className = 'modal-input'; el.id = id;
  if (placeholder) el.placeholder = placeholder;
  return el;
}

function makeSelect(values, labels, id) {
  const sel = document.createElement('select');
  sel.className = 'modal-input'; sel.id = id;
  values.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = labels[i] ?? v;
    sel.appendChild(opt);
  });
  return sel;
}

async function submitAddCardModal() {
  const titreEl = document.getElementById('modal-titre');
  const titre   = titreEl ? titreEl.value.trim() : '';
  if (!titre) {
    if (titreEl) { titreEl.classList.add('error'); titreEl.focus(); titreEl.addEventListener('input', () => titreEl.classList.remove('error'), { once:true }); }
    return;
  }

  const statutSel = document.getElementById('modal-statut');
  const statut    = statutSel ? statutSel.value : STATE.addModal.statut;

  const newRecord = {};
  if (STATE.mapping.statut) newRecord[STATE.mapping.statut] = statut;
  if (STATE.mapping.titre)  newRecord[STATE.mapping.titre]  = titre;

  // ✅ Champ Projet : référence vers le projet du Kanban (choisi dans ⚙)
  if (STATE.mapping.projet && STATE.projetKanban) {
    newRecord[STATE.mapping.projet] = STATE.projetKanban;
  }

  // ✨ Champs simples (texte, non-référence)
  const simpleTextFields = [
    ['description', 'modal-description'],
    ['priorite',    'modal-priorite'],
  ];
  simpleTextFields.forEach(([key, inputId]) => {
    if (!STATE.mapping[key]) return;
    const el = document.getElementById(inputId);
    if (el && el.value !== '') newRecord[STATE.mapping[key]] = el.value;
  });

  // ✨ Champs de référence (assigné, epic)
  const referenceFields = ['assigne', 'epic'];
  referenceFields.forEach(key => {
    if (!STATE.mapping[key]) return;
    const el = document.getElementById(`modal-${key}`);
    if (el && el.value !== '') {
      // Si c'est un nombre, c'est une référence, sinon c'est du texte
      const val = el.value;
      let valeur = isNaN(val) ? val : Number(val);
      // ✅ Correctif : une liste de références (ex. qui_) s'écrit ['L', numéro]
      if (REFS[key] && REFS[key].estListe && typeof valeur === 'number') valeur = ['L', valeur];
      newRecord[STATE.mapping[key]] = valeur;
    }
  });

  // Liens (#183) : Grist complète de lui-même les cartes liées
  const liens = STATE.addModal.liens || {};
  ['bloqueePar', 'bloque'].forEach(key => {
    const ids = liens[key];
    if (STATE.mapping[key] && ids && ids.length) newRecord[STATE.mapping[key]] = ['L', ...ids];
  });

  // Date
  if (STATE.mapping.date) {
    const el = document.getElementById('modal-date');
    if (el && el.value) {
      const d = new Date(el.value);
      if (!isNaN(d)) newRecord[STATE.mapping.date] = Math.floor(d.getTime() / 1000);
    }
  }

  // Enchaînement (#183) : sur « Annuler », la fenêtre de création reste ouverte
  const info = avertirEnchainement(0, { titre, statut, bloqueePar: liens.bloqueePar, bloque: liens.bloque });
  if (info === null) return;

  const confirmBtn = document.getElementById('modal-confirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '…'; }

  try {
    await grist.docApi.applyUserActions([['AddRecord', getTableName(), null, newRecord]]);
    if (info) showToast(info, 6000);
    else showToast(`✓ Carte « ${titre} » créée dans « ${statut} »`);
    closeAddCardModal();
  } catch (err) {
    showToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Kanban – erreur ajout:', err);
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Créer la carte'; }
  }
}

async function deleteCard(recordId, titre) {
  // Enchaînement (#183) : les liens de la carte disparaissent avec elle
  if (liensAssocies()) await chargerLiens();
  const liens = Liens.messageSuppression(INDEX_LIENS, recordId);
  const confirmed = window.confirm(`Supprimer définitivement la carte « ${titre} » ?${liens}`);
  if (!confirmed) return;

  try {
    await grist.docApi.applyUserActions([['RemoveRecord', getTableName(), recordId]]);
    showToast(`✓ Carte « ${titre} » supprimée`);

    if (STATE.selectedId === recordId) STATE.selectedId = null;
    if (STATE.editPanel.recordId === recordId) closeEditPanel();

  } catch (err) {
    showToast(`⚠️ Erreur suppression : ${err.message || err}`, 4000);
    console.error('Kanban – erreur suppression:', err);
  }
}

/* ══════════════════════════════════════════════════════════════
   6. PANNEAU D'ÉDITION
   ══════════════════════════════════════════════════════════════ */

async function openEditPanel(recordId) {
  const record = STATE.records.find(r => r.id === recordId);
  if (!record) return;
  // Un clic sur une autre carte remplace le contenu de la fiche : on prévient
  // si des modifications de la carte affichée n'ont pas été sauvegardées.
  if (STATE.editPanel.dirty && STATE.editPanel.recordId !== recordId) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  STATE.editPanel.recordId = recordId;
  STATE.editPanel.dirty    = false;
  STATE.editPanel.fields   = {};
  await assurerReferences(); // ✅ Correctif : correspondances numéro ↔ nom à jour
  await chargerLiens();      // liens « Bloque / Bloquée par » à jour (#183)
  populateEditPanel(record);
  // Fiche « côté » ou « centre » selon le dernier choix (voir _commun/fiche.js).
  // Sur le côté, on réserve sa place au tableau ; au centre, elle le recouvre.
  const disposition = Fiche.ouvrir(document.getElementById('edit-panel'));
  document.getElementById('board').classList.toggle('panel-open', disposition === 'cote');
  grist.setSelectedRows([recordId]);
}

/*
 * Fiche d'une carte, en forme « dense » (styles dans ../_commun/fiche.css) :
 *   - à gauche, le titre, et dessous l'EPIC en petit et en italique
 *     (non modifiable, sauf s'il manque : on peut alors le choisir) ;
 *   - à droite (au centre) ou sous le titre (sur le côté), les pastilles
 *     Statut, Priorité, Assigné(s) et Échéance ; un clic sur l'une d'elles
 *     ouvre un petit menu pour la changer ;
 *   - dessous, la description en Markdown.
 * Le contenu et le comportement sont les mêmes dans les deux dispositions ;
 * seule la mise en page change.
 * Chaque changement est noté (markDirty) et enregistré par « Sauvegarder ».
 */
function populateEditPanel(record) {
  Fiche.fermerMenu();   // un menu resté ouvert viserait l'ancienne fiche
  STATE.editPanel.record = record;
  // Numéro de la carte (#203), dans la barre de la fiche, au-dessus du titre
  document.getElementById('edit-panel-numero').textContent = '· #' + record.id;
  const body = document.getElementById('edit-panel-body');
  body.innerHTML = '';

  const entete = document.createElement('div');
  entete.className = 'fiche-entete';
  const principal = document.createElement('div');
  principal.className = 'fiche-entete-principal';
  const encart = document.createElement('div');
  encart.className = 'fiche-entete-pastilles';
  entete.append(principal, encart);
  body.appendChild(entete);

  // Titre sur plusieurs lignes si besoin (voir champTitre dans _commun/fiche.js)
  const titleInput = Fiche.champTitre(getField(record, 'titre') || '', {
    placeholder:   'Titre de la carte…',
    classe:        'edit-title-field',
    surChangement: (texte) => markDirty('titre', texte),
  });
  const ligneEpic = document.createElement('div');
  principal.append(titleInput, ligneEpic);
  STATE.editPanel.zones = { encart, ligneEpic };

  // Enchaînement (#183) : cartes qui bloquent celle-ci, et cartes qu'elle
  // bloque. Écrit à « Sauvegarder », comme le reste ; Grist met alors à jour
  // les cartes liées. Exception (#222) : une carte créée depuis la bande est
  // enregistrée aussitôt, avec son lien (voir creerCarteLiee).
  if (liensAssocies()) {
    body.appendChild(bandeLiens(record.id, getField(record, 'titre') || '',
      (liens, { dejaEnregistre } = {}) => {
        ['bloqueePar', 'bloque'].forEach(key => {
          if (!STATE.mapping[key]) return;
          // Lien déjà écrit dans Grist : rien à sauvegarder de ce côté, sauf
          // s'il a déjà des modifications en attente (la liste notée doit
          // alors inclure la nouvelle carte, sinon « Sauvegarder » l'effacerait).
          if (dejaEnregistre && !(key in STATE.editPanel.fields)) return;
          markDirty(key, liens[key]);
        });
      },
      (id) => openEditPanel(id),
      creerCarteLiee));
  }

  if (STATE.mapping.description) {
    // Description en Markdown : affichée mise en forme, modifiable en brut.
    const row = document.createElement('div'); row.className = 'edit-prop edit-prop-description';
    const label = document.createElement('div'); label.className = 'edit-prop-label';
    label.innerHTML = `<span class="prop-icon">${PROP_ICONS.description}</span>${PROP_LABELS.description}`;
    const wrap = document.createElement('div');
    wrap.appendChild(Fiche.champMarkdown(getField(record, 'description'),
      (texte) => markDirty('description', texte)));
    row.append(label, wrap);
    body.appendChild(row);
  }

  STATE.editPanel.dirty = false; STATE.editPanel.fields = {};
  majPastillesFiche();
  updateDirtyIndicator();
}

/* ── Pastilles de la fiche ───────────────────────────────────── */

/** Valeur d'un champ dans la fiche : la valeur modifiée si elle existe, sinon celle de Grist. */
function valeurFiche(key) {
  const f = STATE.editPanel.fields;
  return key in f ? f[key] : getField(STATE.editPanel.record, key);
}

/** Pour un champ de référence : numéros de ligne actuels dans la fiche (liste). */
function idsFiche(key) {
  const f = STATE.editPanel.fields;
  if (key in f) return Array.isArray(f[key]) ? f[key] : (f[key] ? [f[key]] : []);
  return nomsVersIds(key, getField(STATE.editPanel.record, key));
}

/** (Re)construit les pastilles et la ligne de l'EPIC, d'après les valeurs actuelles. */
function majPastillesFiche() {
  const { encart, ligneEpic } = STATE.editPanel.zones;
  encart.innerHTML = '';
  if (STATE.mapping.statut)   encart.appendChild(pastilleStatut());
  if (STATE.mapping.priorite) encart.appendChild(pastillePriorite());
  if (STATE.mapping.assigne)  encart.append(...pastillesAssigne());
  if (STATE.mapping.date)     encart.appendChild(pastilleDate());
  ligneEpic.innerHTML = '';
  if (STATE.mapping.epic) ligneEpic.appendChild(rappelEpic());
}

/** Note un changement fait depuis un menu, puis redessine les pastilles. */
function changerDepuisMenu(key, valeur) {
  markDirty(key, valeur);
  majPastillesFiche();
}

/** Pastille cliquable ; « vide » = valeur absente (pointillés « + … »). */
function boutonPastille(texte, { vide = false, classe = '', titre = '', surClic }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fiche-pastille' + (vide ? ' fiche-pastille-vide' : '') + (classe ? ' ' + classe : '');
  b.textContent = texte;
  b.title = titre;
  b.addEventListener('click', (e) => { e.stopPropagation(); surClic(b); });
  return b;
}

/** Options d'un menu pour un champ de référence, ou, à défaut, pour un champ texte. */
function optionsMenu(key, idsActuels) {
  if (REFS[key]) {
    return optionsProposees(key, idsActuels).map(o => ({ valeur: o.id, libelle: o.nom || `(ligne ${o.id})` }));
  }
  return getUniqueFieldValues(key).map(v => ({ valeur: v, libelle: v }));
}

function pastilleStatut() {
  const statut = String(valeurFiche('statut') || '');
  const b = boutonPastille(statut || '+ Statut', {
    vide: !statut, titre: 'Statut — cliquer pour changer',
    surClic: (ancre) => Fiche.menuChoix(ancre, {
      options: getUniqueFieldValues('statut').map(s => ({ valeur: s, libelle: s })),
      selection: [statut],
      surChoix: (v) => changerDepuisMenu('statut', v),
    }),
  });
  // Même couleur que la colonne du tableau
  const palette = statut && couleurStatut(statut);
  if (palette) { b.style.background = palette.bg; b.style.color = palette.text; }
  return b;
}

/**
 * Rang dans PASTEL_PALETTE de la couleur d'un statut (#212) : celle choisie
 * dans ⚙, sinon celle de sa position (ordre des colonnes enregistré, puis
 * statuts connus), comme avant #212. Une fois retenue à « Appliquer », la
 * couleur suit le statut : déplacer une colonne ne la change plus.
 */
function rangCouleur(statut, statuts = statutsConnus({})) {
  const choisie = STATE.couleursStatut[statut];
  if (Number.isInteger(choisie) && choisie >= 0) return choisie % PASTEL_PALETTE.length;
  const i = STATE.columnOrder.indexOf(statut);
  const rang = i >= 0 ? i : Math.max(statuts.indexOf(statut), 0);
  return rang % PASTEL_PALETTE.length;
}

/** Couleurs (fond, accent, titre) de la colonne d'un statut, reprises par la fiche. */
function couleurStatut(statut) {
  return PASTEL_PALETTE[rangCouleur(statut)];
}

function pastillePriorite() {
  const prio = String(valeurFiche('priorite') || '');
  return boutonPastille(prio ? '● ' + prio : '+ Priorité', {
    vide: !prio, classe: prio ? classePriorite(prio) : '', titre: 'Priorité — cliquer pour changer',
    surClic: (ancre) => Fiche.menuChoix(ancre, {
      options: getUniqueFieldValues('priorite').map(p => ({ valeur: p, libelle: p })),
      selection: [prio], vide: '— aucune —',
      surChoix: (v) => changerDepuisMenu('priorite', v),
    }),
  });
}

/** Une pastille « 👤 Nom » par personne assignée ; un clic sur l'une ouvre le choix. */
function pastillesAssigne() {
  const ref = REFS.assigne;
  const ids = ref ? idsFiche('assigne') : [];
  const ouvrir = (ancre) => Fiche.menuChoix(ancre, {
    options: optionsMenu('assigne', ids),
    selection: ref ? ids : [valeurFiche('assigne')],
    multiple: Boolean(ref && ref.estListe),
    vide: '— personne —', valeurVide: ref ? 0 : '',
    surChoix: (v) => changerDepuisMenu('assigne', v),
  });
  const noms = ref
    ? ids.map(id => nomAffiche('assigne', id) || `(ligne ${id})`)
    : (valeurFiche('assigne') ? [String(valeurFiche('assigne'))] : []);
  if (!noms.length) return [boutonPastille('👤 + Assigner', { vide: true, titre: 'Assigné à', surClic: ouvrir })];
  return noms.map(nom => boutonPastille('👤 ' + nom, {
    classe: 'badge-assigne', titre: 'Assigné à — cliquer pour changer', surClic: ouvrir,
  }));
}

function pastilleDate() {
  const iso = dateVersIso(valeurFiche('date'));
  // « T00:00:00 » : date lue comme une date locale (sans décalage horaire)
  const texte = iso ? '📅 ' + new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR') : '📅 + Échéance';
  return boutonPastille(texte, {
    vide: !iso, classe: iso ? 'badge-date' : '', titre: 'Échéance — cliquer pour changer',
    surClic: (ancre) => Fiche.menuDate(ancre, { valeur: iso, surChoix: (d) => changerDepuisMenu('date', d) }),
  });
}

/** Date de Grist (secondes depuis 1970) ou texte → « AAAA-MM-JJ » ('' si aucune). */
function dateVersIso(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  try {
    return (typeof v === 'number' ? new Date(v * 1000) : new Date(v)).toISOString().slice(0, 10);
  } catch (_) { return ''; }
}

/**
 * EPIC de la carte, en petit et en italique. Non modifiable s'il est déjà
 * enregistré dans Grist ; s'il manque, une pastille permet de le choisir
 * (parmi les EPICs du projet du Kanban).
 */
function rappelEpic() {
  const ref = REFS.epic;
  const enregistre = getField(STATE.editPanel.record, 'epic');
  const aUnEpic = ref ? nomsVersIds('epic', enregistre).length > 0 : Boolean(enregistre);
  const ids = ref ? idsFiche('epic') : [];
  const nom = ref ? (ids.length ? nomAffiche('epic', ids[0]) : '') : String(valeurFiche('epic') || '');

  if (aUnEpic) {
    const rappel = document.createElement('span');
    rappel.className = 'fiche-rappel';
    rappel.textContent = '🏷️ ' + nom;
    rappel.title = 'EPIC';
    return rappel;
  }
  return boutonPastille(nom ? '🏷️ ' + nom : '🏷️ + Choisir un EPIC', {
    vide: !nom, classe: 'fiche-rappel', titre: 'EPIC — cliquer pour choisir',
    surClic: (ancre) => Fiche.menuChoix(ancre, {
      options: optionsMenu('epic', ids),
      selection: ref ? ids : [valeurFiche('epic')],
      vide: '— aucun —', valeurVide: ref ? 0 : '',
      surChoix: (v) => changerDepuisMenu('epic', v),
    }),
  });
}

function markDirty(key, value) {
  STATE.editPanel.fields[key] = value;
  STATE.editPanel.dirty = Object.keys(STATE.editPanel.fields).length > 0;
  updateDirtyIndicator();
}

function updateDirtyIndicator() {
  const dot     = document.getElementById('edit-dirty-dot');
  const saveBtn = document.getElementById('edit-save-btn');
  if (dot)     dot.classList.toggle('visible', STATE.editPanel.dirty);
  if (saveBtn) saveBtn.disabled = !STATE.editPanel.dirty;
}

function closeEditPanel(force = false) {
  if (STATE.editPanel.dirty && !force) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  Fiche.fermer(document.getElementById('edit-panel'));
  document.getElementById('board').classList.remove('panel-open');
  STATE.editPanel.recordId = null; STATE.editPanel.dirty = false; STATE.editPanel.fields = {};
}

async function saveEditPanel() {
  if (!STATE.editPanel.dirty || STATE.editPanel.recordId === null) return;
  const updates = {};
  Object.entries(STATE.editPanel.fields).forEach(([key, value]) => {
    const col = STATE.mapping[key]; if (!col) return;
    if (key === 'date') {
      // Date effacée (menu « Effacer la date ») : cellule vidée
      const d = new Date(value);
      updates[col] = !value ? null : (isNaN(d) ? value : Math.floor(d.getTime() / 1000));
    } else if (key === 'bloqueePar' || key === 'bloque') {
      // Liens (#183) : liste de références, ['L', n1, n2, …] (null si vide)
      updates[col] = value.length ? ['L', ...value] : null;
    } else if (REFS[key] && REFS[key].estListe) {
      // ✅ Correctif : une liste de références s'écrit ['L', n1, n2, …] (null si vide)
      updates[col] = value.length ? ['L', ...value] : null;
    } else {
      // Référence simple : value est déjà un numéro de ligne (0 = vide)
      updates[col] = value;
    }
  });
  if (!Object.keys(updates).length) return;

  // Enchaînement (#183) : nouveau statut et nouveaux liens, pris ensemble.
  // Sur « Annuler », la fiche reste ouverte avec ses modifications.
  const champs = STATE.editPanel.fields;
  const info = avertirEnchainement(STATE.editPanel.recordId, {
    titre:      champs.titre,
    statut:     champs.statut,
    bloqueePar: champs.bloqueePar,
    bloque:     champs.bloque,
  });
  if (info === null) return;

  const saveBtn = document.getElementById('edit-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '…'; }

  try {
    await grist.docApi.applyUserActions([['UpdateRecord', getTableName(), STATE.editPanel.recordId, updates]]);
    STATE.editPanel.dirty = false; STATE.editPanel.fields = {};
    updateDirtyIndicator();
    if (saveBtn) saveBtn.textContent = '✓ Sauvegarder';
    if (info) showToast(info, 6000);
    else showToast('✓ Modifications sauvegardées');
  } catch (err) {
    showToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '✓ Sauvegarder'; }
    console.error('Kanban – erreur sauvegarde:', err);
  }
}

/* ══════════════════════════════════════════════════════════════
   7. DRAG & DROP — CARTES
   ══════════════════════════════════════════════════════════════ */

function onDragStart(e) {
  const card = e.currentTarget;
  STATE.drag.cardId     = Number(card.dataset.id);
  STATE.drag.fromStatut = card.closest('[data-statut]').dataset.statut;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  removePlaceholder();
  STATE.drag = { cardId: null, fromStatut: null, placeholder: null };
}

function onDragEnter(e) {
  if (STATE.drag.cardId === null) return;
  e.preventDefault();
  e.currentTarget.closest('.column').classList.add('drag-over');
  insertPlaceholder(e.currentTarget, e.clientY);
}

function onDragLeave(e) {
  if (STATE.drag.cardId === null) return;
  if (e.currentTarget.contains(e.relatedTarget)) return;
  e.currentTarget.closest('.column').classList.remove('drag-over');
}

function onDragOver(e) {
  if (STATE.drag.cardId === null) return;
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  insertPlaceholder(e.currentTarget, e.clientY);
}

async function onDrop(e) {
  if (STATE.drag.cardId === null) return;
  e.preventDefault(); e.stopPropagation();
  const list     = e.currentTarget;
  const toStatut = list.dataset.statut;
  list.closest('.column').classList.remove('drag-over');
  removePlaceholder();
  if (toStatut === STATE.drag.fromStatut) return;

  // Enchaînement (#183) : sur « Annuler », la carte reste dans sa colonne
  const cardId = STATE.drag.cardId;
  const info = avertirEnchainement(cardId, { statut: toStatut });
  if (info === null) return;

  try {
    await grist.docApi.applyUserActions([['UpdateRecord', getTableName(), cardId, { [STATE.mapping.statut]: toStatut }]]);
    if (info) showToast(info, 6000);
    else showToast(`✓ Déplacé vers « ${toStatut} »`);
  } catch (err) {
    showToast(`⚠️ Erreur : ${err.message || err}`, 4000);
  }
}

function insertPlaceholder(list, mouseY) {
  if (!STATE.drag.placeholder) {
    STATE.drag.placeholder = document.createElement('div');
    STATE.drag.placeholder.className = 'drop-placeholder';
  }
  const ph    = STATE.drag.placeholder;
  const cards = [...list.querySelectorAll('.card:not(.dragging)')];
  let insertBefore = null;
  for (const c of cards) {
    const rect = c.getBoundingClientRect();
    if (mouseY < rect.top + rect.height / 2) { insertBefore = c; break; }
  }
  if (insertBefore) list.insertBefore(ph, insertBefore);
  else list.appendChild(ph);
}

function removePlaceholder() {
  if (STATE.drag.placeholder) { STATE.drag.placeholder.remove(); STATE.drag.placeholder = null; }
  document.querySelectorAll('.column.drag-over').forEach(el => el.classList.remove('drag-over'));
}

/* ══════════════════════════════════════════════════════════════
   8. DRAG & DROP — COLONNES
   ══════════════════════════════════════════════════════════════ */

function onColumnHeaderDragStart(e) {
  const col = e.currentTarget.closest('.column');
  STATE.colDrag.statut = col.dataset.statut;
  col.classList.add('column-dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', 'col'); } catch (_) {}
}

function onColumnHeaderDragEnd(e) {
  e.currentTarget.closest('.column').classList.remove('column-dragging');
  document.querySelectorAll('.column.column-drag-over').forEach(c => c.classList.remove('column-drag-over'));
  STATE.colDrag.statut = null;
}

function onColumnDragOver(e) {
  if (!STATE.colDrag.statut) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.currentTarget;
  if (col.dataset.statut !== STATE.colDrag.statut) col.classList.add('column-drag-over');
}

function onColumnDragLeave(e) {
  if (!STATE.colDrag.statut) return;
  if (e.currentTarget.contains(e.relatedTarget)) return;
  e.currentTarget.classList.remove('column-drag-over');
}

function onColumnDrop(e) {
  if (!STATE.colDrag.statut) return;
  e.preventDefault();
  const target = e.currentTarget.dataset.statut;
  e.currentTarget.classList.remove('column-drag-over');
  const source = STATE.colDrag.statut;
  STATE.colDrag.statut = null;
  if (source === target) return;

  const order = [...document.querySelectorAll('.column')].map(c => c.dataset.statut);
  const from  = order.indexOf(source);
  const to    = order.indexOf(target);
  if (from === -1 || to === -1) return;
  order.splice(from, 1); order.splice(to, 0, source);

  // Vue enregistrée avec une liste de colonnes : c'est son ordre qui change
  // (#196, #187). Sinon, ordre commun à tout le widget, comme avant.
  const vue = vueEnregistree(STATE.activeView);
  if (vue && vue.colonnes) {
    vue.colonnes = [...order.filter(s => vue.colonnes.includes(s)),
                    ...vue.colonnes.filter(s => !order.includes(s))];
    enregistrerVues(vue);
  } else {
    STATE.columnOrder = order;
    grist.setOption('columnOrder', STATE.columnOrder).catch(() => {});
  }
  renderBoard();
  showToast('✓ Ordre des colonnes mis à jour');
}

/* ══════════════════════════════════════════════════════════════
   8 bis. RÉFÉRENCES (correctif)
   ══════════════════════════════════════════════════════════════
   Pourquoi : Grist envoie au widget le NOM affiché d'une référence
   (ex. « Martin Schoreisz »), mais une écriture doit fournir le NUMÉRO
   de la ligne visée (ex. 20). On lit donc la description des colonnes
   dans les tables internes de Grist (_grist_Tables, _grist_Tables_column)
   pour savoir, pour chaque colonne de référence :
     - quelle table elle vise (ex. Contacts),
     - quelle colonne sert à l'afficher (ex. Nom_complet),
   puis on construit la liste {id, nom} de toutes les lignes visées. */

/**
 * Décrit une colonne de référence de la table du widget.
 * @param {string} tableId - table du widget (ex. 'Taches')
 * @param {string} colId   - colonne à décrire (ex. 'qui_')
 * @returns {Promise<{estListe:boolean, tableVisee:string, options:Array<{id:number, nom:string}>}|null>}
 *          null si la colonne n'existe pas ou n'est pas une référence.
 */
async function chargerReference(tableId, colId) {
  const tables   = await grist.docApi.fetchTable('_grist_Tables');
  const colonnes = await grist.docApi.fetchTable('_grist_Tables_column');

  // 1. Retrouver la ligne qui décrit la colonne (table + nom de colonne)
  const idxTable = tables.tableId.indexOf(tableId);
  if (idxTable === -1) return null;
  const numeroTable = tables.id[idxTable];
  const idxCol = colonnes.id.findIndex((_, i) =>
    colonnes.parentId[i] === numeroTable && colonnes.colId[i] === colId);
  if (idxCol === -1) return null;

  // 2. Son type dit si c'est une référence : 'Ref:EPICs' ou 'RefList:Contacts'
  const type = String(colonnes.type[idxCol]);
  const correspondance = /^(Ref|RefList):(.+)$/.exec(type);
  if (!correspondance) return null; // colonne ordinaire (texte, choix…)
  const estListe   = correspondance[1] === 'RefList';
  const tableVisee = correspondance[2];

  // 3. La colonne affichée (visibleCol) est désignée par son numéro de ligne
  //    dans _grist_Tables_column ; 0 = aucune, Grist affiche alors le numéro
  const idxAffichee  = colonnes.id.indexOf(colonnes.visibleCol[idxCol]);
  const colAffichee  = idxAffichee !== -1 ? colonnes.colId[idxAffichee] : null;

  // 4. Liste de toutes les lignes visées, avec leur nom tel qu'affiché
  const lignes = await grist.docApi.fetchTable(tableVisee);
  const options = lignes.id.map((id, i) => ({
    id,
    nom: colAffichee ? String(lignes[colAffichee][i] ?? '') : String(id),
  }));

  return { estListe, tableVisee, options };
}

/**
 * ✅ Projet du Kanban : nom de la première colonne de `tableId` qui est une
 * référence vers `tableCible` (ex. dans EPICs, la colonne qui vise Projets2).
 * null s'il n'y en a pas.
 */
async function colonneQuiVise(tableId, tableCible) {
  const tables   = await grist.docApi.fetchTable('_grist_Tables');
  const colonnes = await grist.docApi.fetchTable('_grist_Tables_column');
  const idxTable = tables.tableId.indexOf(tableId);
  if (idxTable === -1) return null;
  const numeroTable = tables.id[idxTable];
  const idx = colonnes.id.findIndex((_, i) =>
    colonnes.parentId[i] === numeroTable && colonnes.type[i] === `Ref:${tableCible}`);
  return idx === -1 ? null : colonnes.colId[idx];
}

/** (Re)charge REFS pour les champs EPIC, Assigné à et Projet, selon l'association courante. */
async function assurerReferences() {
  await _tableNamePret; // le nom réel de la table doit être connu
  for (const key of ['epic', 'assigne', 'projet']) {
    REFS[key] = null;
    const col = STATE.mapping[key];
    if (!col) continue;
    try {
      REFS[key] = await chargerReference(getTableName(), col);
    } catch (err) {
      // En cas d'échec, le widget garde le comportement de la version d'origine
      console.error(`Kanban – lecture de la référence « ${col} » impossible:`, err);
    }
  }

  // ✅ Projet du Kanban : pour chaque EPIC, retenir le numéro de son projet,
  // en cherchant dans la table des EPICs la colonne qui vise la table des projets.
  if (REFS.epic && REFS.projet) {
    try {
      const colProjet = await colonneQuiVise(REFS.epic.tableVisee, REFS.projet.tableVisee);
      if (colProjet) {
        const lignes = await grist.docApi.fetchTable(REFS.epic.tableVisee);
        REFS.epic.options.forEach(o => {
          const i = lignes.id.indexOf(o.id);
          o.projetId = i !== -1 ? lignes[colProjet][i] : 0;
        });
      }
    } catch (err) {
      console.error('Kanban – lien EPIC → projet introuvable:', err);
    }
  }
}

/** Nom affiché d'une ligne visée par un champ de référence ('' si inconnu). */
function nomAffiche(key, id) {
  const ref = REFS[key];
  const option = ref && ref.options.find(o => o.id === id);
  return option ? option.nom : '';
}

/**
 * Convertit la valeur reçue de Grist (nom, ou liste de noms) en numéros de ligne.
 * Accepte aussi une cellule invalide (texte seul) : si le texte correspond à un
 * nom connu, on retrouve le bon numéro, ce qui répare la cellule à l'enregistrement.
 */
function nomsVersIds(key, valeur) {
  const ref = REFS[key];
  if (!ref || valeur === null || valeur === undefined || valeur === '') return [];
  const noms = Array.isArray(valeur) ? valeur : [valeur];
  return noms
    .map(n => typeof n === 'number' ? n : (ref.options.find(o => o.nom === String(n)) || {}).id)
    .filter(id => id > 0);
}

/**
 * Lignes proposées dans la liste de choix d'un champ de référence.
 * Pour « Assigné à », on se limite à l'équipe projet choisie dans ⚙ (#148),
 * en gardant toujours les personnes déjà assignées : sinon, un simple
 * enregistrement les retirerait sans prévenir.
 */
function optionsProposees(key, idsActuels) {
  const ref = REFS[key];
  const equipe = key === 'assigne' ? idsEquipe() : null;
  if (equipe) {
    return ref.options.filter(o => equipe.includes(o.id) || idsActuels.includes(o.id));
  }
  // ✅ Projet du Kanban : seuls les EPICs du projet choisi (#144), en gardant
  // l'EPIC actuel de la carte même s'il appartient à un autre projet.
  if (key === 'epic' && STATE.projetKanban && ref.options.some(o => 'projetId' in o)) {
    return ref.options.filter(o => o.projetId === STATE.projetKanban || idsActuels.includes(o.id));
  }
  return ref.options;
}

/* ══════════════════════════════════════════════════════════════
   8 bis. LIENS « BLOQUE / BLOQUÉE PAR » (#183)
   ══════════════════════════════════════════════════════════════
   Le dessin et la recherche sont dans ../_commun/liens.js (commun avec la
   Galerie). Ici : la lecture des cartes et de leurs liens. La table est
   relue avec fetchTable, qui donne les numéros des cartes liées ; onRecords
   ne donne que leurs titres, ambigus si deux cartes portent le même. */

/** Cartes du document et leurs liens (voir Liens.indexer), relues à chaque ouverture de fiche. */
let INDEX_LIENS = new Map();

/** Vrai si au moins une des deux colonnes de liens est associée dans ⚙. */
function liensAssocies() {
  return Boolean(STATE.mapping.bloque || STATE.mapping.bloqueePar);
}

async function chargerLiens() {
  if (!liensAssocies()) { INDEX_LIENS = new Map(); return; }
  await _tableNamePret;
  try {
    const table = await grist.docApi.fetchTable(getTableName());
    INDEX_LIENS = Liens.indexer(table, {
      titre:      STATE.mapping.titre,
      statut:     STATE.mapping.statut,
      projet:     STATE.mapping.projet,
      bloque:     STATE.mapping.bloque,
      bloqueePar: STATE.mapping.bloqueePar,
    });
  } catch (err) {
    console.error('Kanban – lecture des liens impossible:', err);
  }
}

/** Cartes que l'on peut lier : celles du projet du Kanban (toutes, si aucun projet n'est choisi). */
function candidatsLiens() {
  const memeProjet = STATE.projetKanban && STATE.mapping.projet;
  return [...INDEX_LIENS.values()]
    .filter(c => !memeProjet || c.projet === STATE.projetKanban)
    .map(c => c.id);
}

/**
 * Bande « enchaînement » d'une carte (id 0 : carte en cours de création).
 * Un côté dont la colonne n'est pas associée est masqué (valeur null).
 * surCreer (facultatif) : voir creerCarteLiee.
 */
function bandeLiens(id, titre, surChangement, surOuvrir, surCreer) {
  const enregistree = INDEX_LIENS.get(id) || { bloqueePar: [], bloque: [] };
  return Liens.bande({
    index:      INDEX_LIENS,
    carte:      { id, titre },
    bloqueePar: STATE.mapping.bloqueePar ? enregistree.bloqueePar : null,
    bloque:     STATE.mapping.bloque     ? enregistree.bloque     : null,
    candidats:  candidatsLiens(),
    surChangement,
    surOuvrir,
    surCreer,
  });
}

/**
 * Statut d'une carte créée depuis la bande (#222) : le premier statut rangé
 * en « À faire », dans l'ordre de ⚙ ③ Statuts (choix déclarés dans Grist,
 * puis autres valeurs) ; à défaut, le premier statut de cette liste.
 * Aucun statut n'est écrit en dur. (L'ordre des colonnes du tableau ne
 * convient pas : il dépend de la vue et range les statuts non classés par
 * ordre alphabétique.)
 */
function statutNouvelleCarteLiee() {
  const statuts = statutsDeColonne(STATE.mapping.statut, STATE.records);
  return statuts.find(s => Liens.classeDe(s, STATE.classesStatut) === 'afaire') || statuts[0] || '';
}

/**
 * Crée une carte depuis la bande de la fiche ouverte (#222), sans quitter
 * cette fiche. La nouvelle carte reçoit :
 *   - le titre tapé dans le menu ;
 *   - le projet du Kanban (choisi dans ⚙) ;
 *   - le statut donné par statutNouvelleCarteLiee ;
 *   - l'EPIC de la carte ouverte (une chaîne reste en général dans le même EPIC) ;
 *   - son lien vers la carte ouverte : si celle-ci « Bloque » la nouvelle,
 *     la nouvelle est « Bloquée par » elle, et inversement. Grist complète
 *     alors de lui-même la carte ouverte (référence à double sens).
 * Le lien est écrit avec la nouvelle carte, et non à « Sauvegarder » : fermer
 * la fiche sans sauvegarder ne laisse pas de carte orpheline. Si la colonne
 * du sens inverse n'est pas associée dans ⚙, le lien attend « Sauvegarder ».
 *   cote : 'bloque' ou 'bloqueePar', côté de la bande où la carte est ajoutée
 * Renvoie { id, statut, enregistre }, ou null en cas d'échec.
 */
async function creerCarteLiee(titre, cote) {
  const carteOuverte = STATE.editPanel.recordId;
  if (!carteOuverte) return null;
  const statut = statutNouvelleCarteLiee();

  const nouvelle = {};
  if (STATE.mapping.titre)  nouvelle[STATE.mapping.titre]  = titre;
  if (STATE.mapping.statut && statut) nouvelle[STATE.mapping.statut] = statut;
  if (STATE.mapping.projet && STATE.projetKanban) nouvelle[STATE.mapping.projet] = STATE.projetKanban;

  // EPIC de la carte ouverte (valeur affichée dans la fiche, modifiée ou non)
  if (STATE.mapping.epic) {
    if (REFS.epic) {
      const ids = idsFiche('epic');
      if (ids.length) nouvelle[STATE.mapping.epic] = REFS.epic.estListe ? ['L', ...ids] : ids[0];
    } else {
      const texte = valeurFiche('epic');
      if (texte) nouvelle[STATE.mapping.epic] = texte;
    }
  }

  // Lien, écrit dans la colonne du sens inverse de la nouvelle carte
  const inverse = cote === 'bloque' ? 'bloqueePar' : 'bloque';
  const enregistre = Boolean(STATE.mapping[inverse]);
  if (enregistre) nouvelle[STATE.mapping[inverse]] = ['L', carteOuverte];

  try {
    const resultat = await grist.docApi.applyUserActions([['AddRecord', getTableName(), null, nouvelle]]);
    const id = resultat && resultat.retValues && resultat.retValues[0];
    if (!id) throw new Error('numéro de la nouvelle carte inconnu');
    showToast(`✓ Carte #${id} « ${titre} » créée` + (statut ? ` dans « ${statut} »` : ''));
    return { id, statut, enregistre };
  } catch (err) {
    showToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Kanban – erreur création carte liée:', err);
    return null;
  }
}

/**
 * Avant d'enregistrer un changement de carte (statut, liens) : avertit s'il
 * contredit l'enchaînement (voir Liens.avertissements). Le widget prévient,
 * l'utilisateur décide.
 *   id    : carte modifiée (0 : carte en cours de création)
 *   apres : { titre, statut, bloqueePar, bloque } : la carte après le
 *           changement ; une valeur absente reprend l'état enregistré
 * Renvoie null si l'utilisateur annule, sinon le texte à afficher une fois
 * le changement enregistré (vide s'il n'y a rien à signaler).
 */
function avertirEnchainement(id, apres) {
  if (!liensAssocies()) return '';
  const enregistree = INDEX_LIENS.get(id) || { titre: '', statut: '' };
  const { aConfirmer, aSignaler } = Liens.avertissements(INDEX_LIENS, STATE.classesStatut, {
    id,
    titre:      apres.titre  ?? enregistree.titre,
    statut:     apres.statut ?? enregistree.statut,
    bloqueePar: apres.bloqueePar || null,
    bloque:     apres.bloque     || null,
  });
  if (aConfirmer && !confirm(aConfirmer)) return null;
  return aSignaler;
}

/* ══════════════════════════════════════════════════════════════
   9. UTILITAIRES
   ══════════════════════════════════════════════════════════════ */

/**
 * Obtenir les options pour un champ de référence
 * @param {string} fieldKey - 'assigne', 'epic', etc.
 * @returns {Array} - [{id: number, nom: string}, ...]
 */
function getReferenceOptions(fieldKey) {
  switch (fieldKey) {
    case 'assigne':
      // Équipe projet, ou toute la table visée ; [] si ce n'est pas une référence
      return REFS.assigne ? optionsProposees('assigne', []) : [];
    case 'epic':
      // ✅ Projet du Kanban : si la référence est connue, seuls les EPICs du projet (#144)
      if (REFS.epic) return optionsProposees('epic', []);
      // Sinon (colonne texte, ou références pas encore chargées) : valeurs présentes
      return getUniqueFieldValues('epic').map(v => ({ id: v, nom: v }));
    default:
      return [];
  }
}

/**
 * Obtenir le nom d'affichage d'une référence
 * @param {string} fieldKey
 * @param {number|string} refId
 * @returns {string}
 */
function getReferenceName(fieldKey, refId) {
  const options = getReferenceOptions(fieldKey);
  const found = options.find(opt => opt.id === refId);
  return found ? found.nom : String(refId);
}

function getField(record, key) {
  const col = STATE.mapping[key]; if (!col) return null;
  const val = record[col];
  return (val === null || val === undefined) ? null : val;
}

function getTableName() { return _tableName || 'Taches'; }

function getUniqueFieldValues(key) {
  const set = new Set();
  STATE.records.forEach(r => {
    const v = getField(r, key);
    if (v !== null && v !== undefined && String(v).trim()) set.add(String(v));
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
}

function formatDate(val) {
  if (!val) return '';
  try {
    const d = typeof val === 'number' ? new Date(val * 1000) : new Date(val);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch (_) { return String(val); }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, duration = 2200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden', 'fade');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.add('fade');
    setTimeout(() => t.classList.add('hidden'), 320);
  }, duration);
}

/* ══════════════════════════════════════════════════════════════
   10. ÉVÉNEMENTS UI
   ══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // Config : fenêtre à onglets (#210)
  creerFenetreConfig();
  creerFenetreVue();
  creerFenetreAide();
  document.getElementById('btn-config')       ?.addEventListener('click', openConfig);
  // ✅ Si l'on change le « Champ Projet », on recharge la liste des projets proposés
  document.getElementById('col-projet')?.addEventListener('change', async (e) => {
    const col = e.target.value;
    let ref = null;
    if (col) {
      try { ref = await chargerReference(getTableName(), col); }
      catch (err) { console.error('Kanban – lecture des projets impossible:', err); }
    }
    // Une réponse arrivée après un autre changement de colonne est périmée
    if (e.target.value !== col) return;
    STATE.configRefProjet = ref;
    remplirChoixProjet(ref);
    remplirClasses(true);   // le projet a pu changer : ses statuts aussi (#210)
    fenetreConfig.majEtats();   // la liste est arrivée après le changement
  });
  // Statuts de ⚙ redessinés aussitôt si la colonne Statut ou le projet change (#210)
  document.getElementById('col-statut')        ?.addEventListener('change', () => remplirClasses(true));
  document.getElementById('col-projet-kanban') ?.addEventListener('change', () => remplirClasses(true));
  // ✅ Équipe projet : recherche, « Tout décocher », et nouvelle liste de
  // personnes si l'on change la colonne « Assigné à »
  document.getElementById('equipe-recherche')?.addEventListener('input', remplirEquipe);
  document.getElementById('equipe-aucun')?.addEventListener('click', () => {
    STATE.equipePanneau.cochees.clear();
    remplirEquipe();
    // Un bouton ne déclenche pas « change » : on signale la modification à la fenêtre
    document.getElementById('equipe-liste').dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.getElementById('col-assigne')?.addEventListener('change', async (e) => {
    const col = e.target.value;
    let ref = null;
    if (col) {
      try { ref = await chargerReference(getTableName(), col); }
      catch (err) { console.error('Kanban – lecture des personnes impossible:', err); }
    }
    if (e.target.value !== col) return;   // réponse périmée (voir col-projet)
    preparerEquipe(ref);
    fenetreConfig.majEtats();
  });

  // Résumés de la barre (#214) : ouvrent « Gérer la vue » sur le bon onglet
  document.getElementById('btn-aide')        ?.addEventListener('click', ouvrirAide);
  document.getElementById('filtres-bouton')  ?.addEventListener('click', () => ouvrirFenetreVue('filtres'));
  document.getElementById('tri-bouton')      ?.addEventListener('click', () => ouvrirFenetreVue('tri'));
  document.getElementById('colonnes-bouton') ?.addEventListener('click', () => ouvrirFenetreVue('colonnes'));
  // Onglets ou sélecteur : à revoir quand la largeur du widget change
  let largeurBarre = 0;
  new ResizeObserver(([{ contentRect }]) => {
    if (contentRect.width === largeurBarre) return;
    largeurBarre = contentRect.width;
    renderVueTabs();
  }).observe(document.getElementById('filterbar'));
  document.getElementById('tri-ajouter')     ?.addEventListener('click', ajouterCritereTri);
  document.getElementById('tri-retirer-tout')?.addEventListener('click', () => { STATE.tri = []; changerTri(); });
  // 🔍 Recherche (#209). Échap vide le champ, sans fermer la fiche ouverte.
  const champRecherche = document.getElementById('recherche');
  champRecherche?.addEventListener('input', (e) => changerRecherche(e.target.value));
  champRecherche?.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    changerRecherche('');
  });
  document.getElementById('filtre-colonne')  ?.addEventListener('change', (e) => {
    // Nouvelle colonne : les valeurs cochées n'ont plus de sens, on repart de zéro
    STATE.filtreEdite.col = e.target.value;
    STATE.filtreEdite.valeurs = [];
    document.getElementById('filtre-recherche').value = '';
    calculerOrdreValeurs();
    remplirPanneauFiltre();
    renderBoard();
  });
  document.querySelectorAll('#filtre-popover .filtre-op').forEach(b => b.addEventListener('click', () => {
    STATE.filtreEdite.op = b.dataset.op;
    remplirPanneauFiltre();
    renderBoard();
  }));
  document.getElementById('filtre-recherche')?.addEventListener('input', remplirPanneauFiltre);
  document.getElementById('filtre-tout')     ?.addEventListener('click', () => cocherVisibles(true));
  document.getElementById('filtre-aucun')    ?.addEventListener('click', () => cocherVisibles(false));
  document.getElementById('filtre-supprimer')?.addEventListener('click', () => supprimerFiltre(STATE.filtreEdite));
  document.getElementById('filtre-afficher') ?.addEventListener('click', ouvrirMenuAfficher);
  // Vues enregistrées (#196)
  document.getElementById('vue-ajouter')     ?.addEventListener('click', (e) => ouvrirNomVue('creer', e.currentTarget));
  document.getElementById('vue-nom-valider') ?.addEventListener('click', validerNomVue);
  document.getElementById('vue-nom')         ?.addEventListener('keydown', (e) => { if (e.key === 'Enter') validerNomVue(); });
  document.getElementById('vue-menu-gerer')      ?.addEventListener('click', () => ouvrirFenetreVue());
  document.getElementById('vue-menu-renommer')   ?.addEventListener('click', () =>
    ouvrirNomVue('renommer', document.querySelector('.vue-enregistree.active')));
  document.getElementById('vue-menu-copier')     ?.addEventListener('click', () =>
    ouvrirNomVue('copier', document.querySelector('.vue-enregistree.active')));
  // Suppression en deux clics : le premier demande confirmation
  document.getElementById('vue-menu-supprimer')  ?.addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (b.dataset.confirmer) { fermerPopovers(); supprimerVue(); return; }
    b.dataset.confirmer = 'oui';
    b.textContent = '🗑 Cliquer encore pour confirmer';
  });
  document.getElementById('colonnes-toutes')?.addEventListener('change', (e) => basculerToutesColonnes(e.target.checked));

  // « Qui suis-je ? » (#202)
  document.getElementById('btn-moi')     ?.addEventListener('click', (e) => ouvrirMoi(e.currentTarget));
  document.getElementById('moi-recherche')?.addEventListener('input', remplirMoi);
  document.getElementById('moi-oublier') ?.addEventListener('click', () => choisirMoi(null));

  // Un clic ailleurs ferme les panneaux (sauf sur ce qui en ouvre un)
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.fenetre, .filtre-popover, #vue-ajouter, .vue-menu-btn, .vue-selecteur, #btn-moi')) return;
    fermerPopovers();
  });

  // Modal ajout
  document.getElementById('modal-close')  ?.addEventListener('click', closeAddCardModal);
  document.getElementById('modal-cancel') ?.addEventListener('click', closeAddCardModal);
  document.getElementById('modal-confirm')?.addEventListener('click', submitAddCardModal);
  document.getElementById('add-card-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeAddCardModal(); });
  document.getElementById('add-card-modal')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitAddCardModal(); }
    if (e.key === 'Escape') closeAddCardModal();
  });

  // Panneau édition = « fiche » : bouton ⤢ / ⇥ pour passer du côté au centre,
  // clic sur le fond assombri pour fermer (voir _commun/fiche.js).
  const panneau = document.getElementById('edit-panel');
  Fiche.installer(panneau, {
    actions:    panneau.querySelector('.edit-panel-header-actions'),
    fermer:     () => closeEditPanel(),
    surBascule: (d) => document.getElementById('board')
                        .classList.toggle('panel-open', d === 'cote' && panneau.classList.contains('open')),
  });
  document.getElementById('edit-panel-close')?.addEventListener('click', () => closeEditPanel());
  document.getElementById('edit-save-btn')   ?.addEventListener('click', saveEditPanel);
  document.getElementById('edit-cancel-btn') ?.addEventListener('click', () => closeEditPanel());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // ⚙ ouverte : Échap ne concerne qu'elle (la fenêtre le gère elle-même)
      if (fenetreConfig && fenetreConfig.estOuverte()) return;
      const panneauOuvert = [...document.querySelectorAll('.filtre-popover')].some(p => !p.classList.contains('hidden'));
      if (panneauOuvert) { fermerPopovers(); return; }
      const panel = document.getElementById('edit-panel');
      if (panel?.classList.contains('open')) { closeEditPanel(); return; }
      const modal = document.getElementById('add-card-modal');
      if (modal && !modal.classList.contains('hidden')) closeAddCardModal();
    }
  });

  const saveBtn = document.getElementById('edit-save-btn');
  if (saveBtn) saveBtn.disabled = true;
});
