/* ══════════════════════════════════════════════════════════════
   KANBAN GRIST — kanban.js v4
   • Onglet « Accueil » (mode d'emploi), puis les vues enregistrées (#196, #197)
   • Filtres combinables sur les colonnes Choix et Référence (#195)
   • Tri des cartes par priorité : haute → moyenne → basse
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
  activeView: 'accueil',

  // Filtres combinables (#195) : liste de conditions { col, op, valeurs },
  // voir la section 3. Non mémorisés : ce sera le rôle des vues (#196).
  filters: [],
  // Colonnes proposées dans les filtres : [{ colId, label, type }]
  colonnesFiltrables: [],
  // Filtre en cours de modification dans le panneau, et ordre de ses valeurs
  filtreEdite: null,
  ordreValeurs: [],
  // Choix déclarés des colonnes Choix / Choix multiple : { colId: [choix…] }
  choix: {},

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

/* Palette pastel */
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

/* Onglet fixe « Accueil » : mode d'emploi du widget, sans cartes. C'est aussi
   l'onglet de repli quand aucune vue enregistrée n'est active (#197). */
const ACCUEIL = 'accueil';

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
    // écrit), sinon l'accueil. Une vue supprimée entre-temps, ou un ancien
    // onglet codé en dur (taches, standardiser, lineariser, retirés en #197),
    // est ignorée. La clé de mémoire dépend du document et de la table : on
    // attend de les connaître.
    await Promise.all([_docNamePret, _tableNamePret]);
    // Vues personnelles (#202), retenues par ce navigateur : après les vues partagées
    STATE.vues.push(...lireVuesPerso());
    const candidats = [lireVueMemorisee(), options && options.activeView];
    STATE.activeView = candidats.find(id => vueEnregistree(id)) || ACCUEIL;
    chargerFiltresDeLaVue();
  }
  renderBoard();
  // Les noms des projets et des EPICs sont nécessaires pour filtrer les cartes :
  // on les charge, puis on redessine le tableau.
  // L'identité (« Qui suis-je ? ») se relit ensuite : elle dépend de la table des personnes.
  assurerReferences().then(chargerColonnesFiltrables).then(chargerMoi).then(renderBoard);
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
function openConfig()  {
  populateSelects(); syncSelectsToMapping();
  remplirChoixProjet(REFS.projet); // ✅ liste « Projet du Kanban »
  remplirClasses();                // rubrique « Classes de statut » (#183)
  preparerEquipe(REFS.assigne);    // ✅ rubrique « Équipe projet »
  document.getElementById('config-panel').classList.remove('hidden');
}
function closeConfig() { document.getElementById('config-panel').classList.add('hidden'); }

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
  grist.setOption('mapping', STATE.mapping).catch(() => {});
  grist.setOption('projetKanban', STATE.projetKanban).catch(() => {});
  grist.setOption('equipe', STATE.equipe).catch(() => {});
  grist.setOption('classesStatut', STATE.classesStatut).catch(() => {});
  closeConfig();
  await assurerReferences(); // l'association des colonnes a pu changer
  await chargerMoi();        // … et avec elle la table des personnes
  await chargerLiens();      // … et les colonnes de liens (badges ⛔ / ➡️)
  // Les vues personnelles sont propres au projet : on relit celles du projet choisi
  STATE.vues = STATE.vues.filter(v => !v.perso).concat(lireVuesPerso());
  if (!vueEnregistree(STATE.activeView)) {
    STATE.activeView = ACCUEIL;
    chargerFiltresDeLaVue();
  }
  renderBoard();
  showToast('✓ Configuration sauvegardée');
}

/* ── Classes de statut (#183) ───────────────────────────────────
   Chaque statut est rangé dans une classe (À faire, En cours, Terminé,
   Autre) : c'est ce qui dit au widget qu'une carte bloquante est finie, sans
   écrire aucun statut en dur. La classe proposée par défaut est devinée
   d'après le libellé (voir Liens.devinerClasse). */

/** (Re)dessine la rubrique : une ligne par statut connu, avec sa classe. */
function remplirClasses() {
  const liste = document.getElementById('classes-liste');
  if (!liste) return;
  liste.innerHTML = '';
  const statuts = statutsConnus({});
  if (statuts.length === 0) {
    liste.innerHTML = '<div class="filtre-aucune">Aucun statut connu : associez la colonne Statut.</div>';
    return;
  }
  statuts.forEach(statut => {
    const ligne = document.createElement('label');
    ligne.className = 'classe-ligne';
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
    sel.value = Liens.classeDe(statut, STATE.classesStatut);
    // Classe pas encore enregistrée : on le signale, elle sera retenue à « Appliquer »
    if (!(statut in STATE.classesStatut)) {
      ligne.classList.add('classe-devinee');
      ligne.title = 'Classe proposée d\'après le libellé : vérifiez-la';
    }
    ligne.append(nom, sel);
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
  const texte = pourRecherche(recherche.value.trim());
  const visibles = texte ? ordre.filter(o => pourRecherche(o.nom || '').includes(texte)) : ordre;
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
   Seul onglet fixe : « Accueil » (ACCUEIL), qui n'affiche pas de cartes.
   Règles :
   - changer de vue recharge ses filtres (aucun pour l'accueil) :
     des filtres modifiés et non enregistrés sont abandonnés ;
   - les colonnes et leur ordre sont enregistrés immédiatement ;
   - les filtres, eux, passent par « Enregistrer » (l'onglet affiche • sinon).
   Vues personnelles (#202) : même format, plus `perso: true`. Elles sont
   gardées dans le navigateur (voir lireVuesPerso), pas dans le document :
   chacun a les siennes, enregistrées aussitôt. Toutes les vues sont dans
   STATE.vues ; enregistrerVues(vue) range chaque genre à sa place. */

/** La vue enregistrée d'identifiant `id`, ou undefined. */
function vueEnregistree(id) {
  return STATE.vues.find(v => v.id === id);
}

/** Copie indépendante d'une liste de filtres (pour ne pas modifier la vue par mégarde). */
function copieFiltres(filtres) {
  return (filtres || []).map(f => ({ col: f.col, op: f.op, valeurs: [...f.valeurs] }));
}

/** Filtres de la vue active, ou aucun pour l'accueil. */
function chargerFiltresDeLaVue() {
  const vue = vueEnregistree(STATE.activeView);
  STATE.filters = vue ? copieFiltres(vue.filtres) : [];
}

/**
 * La vue active sous la forme attendue par le rendu : `preferredOrder` est la
 * liste des colonnes de la vue, ou une liste vide pour « tous les statuts
 * présents » (vue sans liste de colonnes, et accueil).
 */
function vueCourante() {
  const vue = vueEnregistree(STATE.activeView);
  return {
    label: vue ? vue.nom : 'Accueil',
    preferredOrder: (vue && vue.colonnes) || [],
  };
}

/** Résumé comparable d'une liste de filtres (ordre des valeurs ignoré). */
function signatureFiltres(filtres) {
  return JSON.stringify(filtres
    .filter(f => f.valeurs.length > 0)
    .map(f => [f.col, f.op, [...f.valeurs].sort()]));
}

/** Les filtres affichés diffèrent-ils de ceux enregistrés dans la vue active ? */
function vueModifiee() {
  const vue = vueEnregistree(STATE.activeView);
  return !!vue && signatureFiltres(STATE.filters) !== signatureFiltres(vue.filtres);
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
   chaque accès est protégé, et le widget retombe alors sur l'accueil. */

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
  btn.textContent = nom ? `👤 ${nom}` : '👤 Qui suis-je ?';
  btn.title = nom
    ? 'Votre nom, retenu par ce navigateur. Cliquer pour changer.'
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
  const texte = pourRecherche(document.getElementById('moi-recherche').value.trim());
  const personnes = optionsProposees('assigne', STATE.moi ? [STATE.moi] : [])
    .filter(o => !texte || pourRecherche(o.nom || '').includes(texte))
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

/**
 * Onglets : état de l'onglet Accueil, puis un onglet par vue enregistrée,
 * les vues partagées d'abord, puis les vues personnelles (🔒).
 */
function renderVueTabs() {
  document.querySelectorAll('.view-tab[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === STATE.activeView);
  });

  const zone = document.getElementById('vues-enregistrees');
  if (!zone) return;
  zone.innerHTML = '';
  const ordre = [...STATE.vues.filter(v => !v.perso), ...STATE.vues.filter(v => v.perso)];
  ordre.forEach(vue => {
    const active = vue.id === STATE.activeView;
    const onglet = document.createElement('button');
    onglet.className = 'view-tab vue-enregistree' + (vue.perso ? ' perso' : '') + (active ? ' active' : '');
    onglet.textContent = (vue.perso ? '🔒 ' : '') + vue.nom;
    onglet.title = vue.perso
      ? 'Vue personnelle : visible dans ce navigateur seulement'
      : 'Vue partagée : la même pour tous';
    onglet.addEventListener('click', () => { if (!active) switchView(vue.id); });
    if (active) {
      if (vueModifiee()) {
        const point = document.createElement('span');
        point.className = 'vue-modifiee';
        point.textContent = '•';
        point.title = 'Filtres modifiés, non enregistrés';
        onglet.appendChild(point);
      }
      // Menu ⋯ (seulement sur l'onglet actif : on agit sur la vue affichée)
      const menu = document.createElement('span');
      menu.className = 'vue-menu-btn';
      menu.textContent = '⋯';
      menu.title = 'Options de la vue';
      menu.addEventListener('click', (e) => { e.stopPropagation(); ouvrirMenuVue(onglet); });
      onglet.appendChild(menu);
    }
    zone.appendChild(onglet);
  });

  const enregistrer = document.getElementById('vue-enregistrer');
  if (enregistrer) enregistrer.classList.toggle('hidden', !vueModifiee());
}

/* ── Création, renommage, suppression ── */

/** Ajoute une vue, la mémorise à sa place (navigateur ou document) et l'affiche. */
function ajouterVue(vue) {
  STATE.vues.push(vue);
  enregistrerVues(vue);
  switchView(vue.id);
}

/**
 * Nouvelle vue à partir de ce qui est affiché : filtres de l'utilisateur et
 * colonnes de la vue active. Depuis l'accueil : aucun filtre, et tous les
 * statuts présents (colonnes null). Sert aussi à « Copier en vue perso » :
 * la copie reprend ce qui est affiché, modifications non enregistrées comprises.
 * @param {string}  nom
 * @param {boolean} perso - vue personnelle (navigateur) ou partagée (document)
 */
function creerVue(nom, perso) {
  const source = vueCourante();
  const filtres = copieFiltres(STATE.filters.filter(f => f.valeurs.length > 0));
  const colonnes = source.preferredOrder.length ? [...source.preferredOrder] : null;
  const vue = { id: 'vue-' + Date.now().toString(36), nom, filtres, colonnes };
  if (perso) vue.perso = true;
  ajouterVue(vue);
  if (perso) showToast(`✓ Vue personnelle « ${nom} » créée`);
  else       showToast(`✓ Vue « ${nom} » créée : cliquez sur « Enregistrer » dans Grist pour la garder`, 4000);
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
 * Bouton de l'Accueil : ouvre la vue « Mes tâches », ou la crée (vue perso,
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
    showToast('✓ Vue « Mes tâches » créée. Masquez les statuts inutiles avec ⋯ › Colonnes…', 4500);
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
  switchView(ACCUEIL);
  showToast(`✓ Vue « ${vue.nom} » supprimée`);
}

/** Enregistre les filtres affichés dans la vue active. */
function enregistrerFiltresVue() {
  const vue = vueEnregistree(STATE.activeView);
  if (!vue) return;
  vue.filtres = copieFiltres(STATE.filters.filter(f => f.valeurs.length > 0));
  enregistrerVues(vue);
  fermerPopovers();
  renderBoard();
  showToast('✓ Filtres enregistrés dans la vue');
}

/** Revient aux filtres enregistrés de la vue active. */
function annulerModificationsVue() {
  fermerPopovers();
  chargerFiltresDeLaVue();
  renderBoard();
}

/* ── Petits panneaux (nom, menu, colonnes) ── */

/** Place un panneau en position fixe sous `ancre`, sans déborder de la fenêtre. */
function placerSous(pop, ancre) {
  pop.classList.remove('hidden');
  const r = ancre.getBoundingClientRect();
  pop.style.top  = `${r.bottom + 6}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
}

/** Ferme tous les panneaux ouverts (filtre, nom, menu, colonnes). */
function fermerPopovers() {
  fermerFiltre();
  ['vue-nom-popover', 'vue-menu-popover', 'colonnes-popover', 'moi-popover'].forEach(id =>
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
    ? 'Copie, rien que pour vous, les filtres et les colonnes affichés.'
    : 'Reprend les filtres et les colonnes affichés.';
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
  const modifiee = vueModifiee();
  document.getElementById('vue-menu-enregistrer').disabled = !modifiee;
  document.getElementById('vue-menu-annuler').disabled = !modifiee;
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
  const liste = [...(STATE.choix[STATE.mapping.statut] || [])];
  const ajouter = s => { if (s && !liste.includes(s)) liste.push(s); };
  recordsDuProjet().map(r => getField(r, 'statut')).filter(Boolean).map(String)
    .sort((a, b) => a.localeCompare(b, 'fr')).forEach(ajouter);
  (vue.colonnes || []).forEach(ajouter);
  return liste;
}

function ouvrirColonnesVue(ancre) {
  fermerPopovers();
  remplirColonnesVue();
  placerSous(document.getElementById('colonnes-popover'), ancre);
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

/** Applique et enregistre aussitôt un changement de colonnes. */
function majColonnesVue(colonnes) {
  const vue = vueEnregistree(STATE.activeView);
  vue.colonnes = colonnes;
  enregistrerVues(vue);
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

/** Lit dans les métadonnées Grist les colonnes de la table qui peuvent servir de filtre. */
async function chargerColonnesFiltrables() {
  STATE.colonnesFiltrables = [];
  STATE.choix = {};
  try {
    await _tableNamePret;
    const tables   = await grist.docApi.fetchTable('_grist_Tables');
    const colonnes = await grist.docApi.fetchTable('_grist_Tables_column');
    const idxTable = tables.tableId.indexOf(getTableName());
    if (idxTable === -1) return;
    const numeroTable = tables.id[idxTable];
    colonnes.id.forEach((_, i) => {
      const colId = colonnes.colId[i];
      const type  = String(colonnes.type[i]);
      if (colonnes.parentId[i] !== numeroTable) return;
      if (colId.startsWith('gristHelper_') || colId === 'manualSort') return; // colonnes internes
      if (!/^(Choice|ChoiceList|Ref:.+|RefList:.+)$/.test(type)) return;
      // Choix déclarés (pour proposer des colonnes de statut encore vides, #196)
      if (type === 'Choice' || type === 'ChoiceList') {
        try { STATE.choix[colId] = JSON.parse(colonnes.widgetOptions[i] || '{}').choices || []; }
        catch (_) { STATE.choix[colId] = []; }
      }
      const rapporte = libelleRapporte(i, numeroTable, tables, colonnes);
      STATE.colonnesFiltrables.push({
        colId, type,
        label: rapporte ? rapporte.label : (colonnes.label[i] || colId),
        via:   rapporte ? rapporte.via : null,
      });
    });
    // Un libellé rapporté qui en double un autre (ex. « Projet ») reçoit sa
    // colonne d'origine entre parenthèses : « Projet (EPIC) »
    const doublons = STATE.colonnesFiltrables.map(c => c.label)
      .filter((l, i, tous) => tous.indexOf(l) !== i);
    STATE.colonnesFiltrables.forEach(c => {
      if (c.via && doublons.includes(c.label)) c.label += ` (${c.via})`;
    });
    // Colonne associée dans ⚙ à un champ du Kanban qui porte un autre nom :
    // on rappelle ce champ, « qui ? (Assigné à) », pour faire le lien avec ⚙
    // et le mode d'emploi (#202)
    STATE.colonnesFiltrables.forEach(c => {
      const champ = Object.keys(PROP_LABELS).find(k => STATE.mapping[k] === c.colId);
      if (champ && pourRecherche(c.label) !== pourRecherche(PROP_LABELS[champ])) {
        c.label += ` (${PROP_LABELS[champ]})`;
      }
    });
    STATE.colonnesFiltrables.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  } catch (err) {
    console.error('Kanban – lecture des colonnes filtrables impossible:', err);
  }
}

/**
 * Colonne « rapportée » d'une autre table, c'est-à-dire dont la formule est
 * exactement « $EPIC.objectif_resultat_cle » : Grist la nomme
 * « EPIC_objectifs résultats clé », on préfère le libellé de la colonne d'origine.
 * @param {number} i - position de la colonne dans `colonnes` (_grist_Tables_column)
 * @returns {{label:string, via:string}|null} libellé d'origine et libellé de la
 *          colonne de référence (ex. 'EPIC') ; null si ce n'est pas une colonne rapportée.
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

/** Texte comparable pour la recherche : sans accents ni majuscules. */
function pourRecherche(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function resetFilters() {
  fermerFiltre();
  STATE.filters = [];
  renderBoard();
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

/** Redessine une étiquette par filtre (« EPIC n'est pas : A, B ✕ »). */
function renderFilterChips() {
  const zone = document.getElementById('filtres-actifs');
  if (!zone) return;
  zone.innerHTML = '';
  STATE.filters.forEach(filtre => {
    const noms = filtre.valeurs.map(v => libelleValeur(v));
    const resume = noms.length === 0 ? '…'
                 : noms.length <= 2  ? noms.join(', ')
                 : `${noms.length} valeurs`;
    const chip = document.createElement('button');
    chip.className = 'filtre-chip' + (filtre === STATE.filtreEdite ? ' actif' : '');
    chip.title = `${libelleColonne(filtre.col)} ${filtre.op === 'est' ? 'est' : "n'est pas"} : ${noms.join(', ') || '—'}`;
    chip.textContent = `${libelleColonne(filtre.col)} ${filtre.op === 'est' ? 'est' : "n'est pas"} : ${resume}`;
    chip.addEventListener('click', () => ouvrirFiltre(filtre, chip));

    const croix = document.createElement('span');
    croix.className = 'filtre-chip-x';
    croix.textContent = '✕';
    croix.title = 'Retirer ce filtre';
    croix.addEventListener('click', (e) => { e.stopPropagation(); supprimerFiltre(filtre); });
    chip.appendChild(croix);
    zone.appendChild(chip);
  });

  // Nombre de filtres actifs sur le bouton : on sait qu'ils existent même
  // quand des étiquettes sont hors de vue (zone qui défile)
  const nbActifs = STATE.filters.filter(f => f.valeurs.length > 0).length;
  const reset = document.getElementById('filter-reset');
  if (reset) reset.textContent = nbActifs ? `✕ Réinitialiser (${nbActifs})` : '✕ Réinitialiser';

  const ajouter = document.getElementById('filtre-ajouter');
  if (ajouter) {
    ajouter.disabled = STATE.colonnesFiltrables.length === 0;
    ajouter.title = ajouter.disabled ? 'Aucune colonne Choix ou Référence dans la table' : 'Ajouter un filtre';
  }
}

/* ── Panneau de modification d'un filtre ── */

/** Crée un filtre sur la première colonne pas encore filtrée, puis ouvre le panneau. */
function ajouterFiltre(ancre) {
  if (STATE.colonnesFiltrables.length === 0) return;
  fermerFiltre();
  const dejaFiltrees = STATE.filters.map(f => f.col);
  const colonne = STATE.colonnesFiltrables.find(c => !dejaFiltrees.includes(c.colId)) || STATE.colonnesFiltrables[0];
  const filtre = { col: colonne.colId, op: 'est', valeurs: [] };
  STATE.filters.push(filtre);
  ouvrirFiltre(filtre, ancre);
}

function supprimerFiltre(filtre) {
  if (STATE.filtreEdite === filtre) fermerFiltre();
  STATE.filters = STATE.filters.filter(f => f !== filtre);
  renderBoard();
}

/** Ouvre le panneau sous l'élément `ancre` (bouton « ＋ Filtre » ou étiquette). */
function ouvrirFiltre(filtre, ancre) {
  if (STATE.filtreEdite && STATE.filtreEdite !== filtre) fermerFiltre();
  ['vue-nom-popover', 'vue-menu-popover', 'colonnes-popover', 'moi-popover'].forEach(id =>
    document.getElementById(id)?.classList.add('hidden'));
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

  // Le panneau est placé en position fixe sous l'ancre : la barre des filtres
  // défile horizontalement et couperait tout ce qui dépasse d'elle.
  placerSous(document.getElementById('filtre-popover'), ancre);
  document.getElementById('filtre-recherche').focus();
  renderFilterChips();
}

/** Ferme le panneau ; un filtre laissé sans valeur cochée est retiré. */
function fermerFiltre() {
  const pop = document.getElementById('filtre-popover');
  if (pop) pop.classList.add('hidden');
  if (!STATE.filtreEdite) return;
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
}

/** Valeurs affichées compte tenu du texte de recherche. */
function valeursVisibles() {
  const texte = pourRecherche(document.getElementById('filtre-recherche').value.trim());
  if (!texte) return STATE.ordreValeurs;
  return STATE.ordreValeurs.filter(p => pourRecherche(libelleValeur(p.valeur, true)).includes(texte));
}

/** (Re)dessine opérateur, cases à cocher et compteur du panneau. */
function remplirPanneauFiltre() {
  const f = STATE.filtreEdite;
  document.querySelectorAll('.filtre-op').forEach(b => b.classList.toggle('actif', b.dataset.op === f.op));

  const liste = document.getElementById('filtre-valeurs');
  liste.innerHTML = '';
  const visibles = valeursVisibles();
  visibles.forEach(({ valeur, nb }) => {
    const ligne = document.createElement('label');
    ligne.className = 'filtre-valeur' + (valeur === VIDE ? ' vide' : valeur === MOI ? ' moi' : '');
    const caseACocher = document.createElement('input');
    caseACocher.type = 'checkbox';
    caseACocher.checked = f.valeurs.includes(valeur);
    caseACocher.addEventListener('change', () => basculerValeur(valeur, caseACocher.checked));
    const nom = document.createElement('span');
    nom.className = 'filtre-valeur-nom';
    nom.textContent = libelleValeur(valeur, true);
    const compte = document.createElement('span');
    compte.className = 'filtre-valeur-nb';
    compte.textContent = nb;
    ligne.append(caseACocher, nom, compte);
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

/* Cartes affichées : celles du projet qui respectent les filtres */
function getFilteredRecords() {
  return STATE.records.filter(r => {
    // ✅ Projet du Kanban : on ne garde que les cartes du projet choisi
    if (!estDuProjet(r)) return false;

    // Filtres de la vue (ou ajoutés par l'utilisateur) : tous doivent être respectés
    return STATE.filters.every(f => carteRespecte(r, f));
  });
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

  // Accueil : mode d'emploi à la place des cartes, et pas de filtres
  const accueil = STATE.activeView === ACCUEIL;
  document.getElementById('filterbar')?.classList.toggle('sur-accueil', accueil);
  if (accueil) {
    renderAccueil(board);
    return;
  }

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
  const filterActive = isAnyUserFilterActive();

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

  // Tri des cartes dans chaque colonne : priorité haute → moyenne → basse
  Object.keys(groups).forEach(s => {
    groups[s].sort((a, b) => {
      const pa = getPrioRank(getField(a, 'priorite'));
      const pb = getPrioRank(getField(b, 'priorite'));
      return pa - pb;
    });
  });

  const statutList = getOrderedStatuts(Object.keys(groups), view);
  board.innerHTML = '';
  STATE.couleursStatut = {};   // reprises par la pastille Statut de la fiche

  const totalFiltered = filteredRecords.length;

  statutList.forEach((statut) => {
    const isEmptyCol = (groups[statut] || []).length === 0;

    // ✨ Colonne "de base" = colonne définie par preferredOrder de la vue active
    const isBaseCol = hasPreferredOrder && view.preferredOrder.includes(statut);

    // Masquer les colonnes vides si filtre actif (sauf colonnes de base, choisies dans la vue)
    if (filterActive && isEmptyCol && !isBaseCol) return;

    const colorIdx = STATE.columnOrder.includes(statut)
      ? STATE.columnOrder.indexOf(statut)
      : statutList.indexOf(statut);
    const palette = PASTEL_PALETTE[colorIdx % PASTEL_PALETTE.length];
    STATE.couleursStatut[statut] = palette;

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
 * Accueil : court mode d'emploi du widget, à la place des cartes.
 * Texte fixe (aucune donnée de Grist), d'où l'usage d'innerHTML.
 */
function renderAccueil(board) {
  const premiere = STATE.vues.length === 0;
  // Bouton « Mes tâches » (#202) : seulement si « Assigné à » est une référence
  const mesTaches = (STATE.mapping.assigne && REFS.assigne)
    ? `<button id="accueil-mes-taches" class="btn-primary">👤 ${vueMesTaches() ? 'Ouvrir' : 'Créer'} ma vue Mes tâches</button>`
    : '';
  board.innerHTML = `
    <div class="accueil">
      <h2>Bienvenue dans le Kanban</h2>
      <p class="accueil-intro">Les cartes s'affichent dans des <strong>vues</strong> : un onglet = une vue,
        avec ses filtres et ses colonnes. ${premiere
          ? 'Ce Kanban n\'a pas encore de vue : créez-en une pour voir les cartes.'
          : 'Cliquez sur un onglet pour retrouver les cartes.'}</p>
      <div class="accueil-boutons">
        ${mesTaches}
        <button id="accueil-creer" class="${mesTaches ? 'btn-ghost' : 'btn-primary'}">＋ ${premiere ? 'Créer ma première vue' : 'Créer une vue'}</button>
      </div>
      <ol class="accueil-etapes">
        <li><strong>⚙ Configurer</strong> : choisissez le projet du Kanban, associez les colonnes de la table et cochez l'équipe projet (personnes proposées dans « Assigné à »). Puis cliquez sur <strong>Enregistrer</strong>, en haut à droite de Grist.</li>
        <li><strong>＋ Vue</strong> : crée une vue à partir de l'affichage actuel, <strong>🔒 pour vous</strong> (par défaut : gardée aussitôt dans votre navigateur) ou <strong>👥 pour tous</strong> (puis cliquez sur <strong>Enregistrer</strong> de Grist pour la garder). Le menu <strong>⋯</strong> de l'onglet actif permet de la renommer, de la supprimer, ou de copier une vue partagée en vue perso pour l'adapter sans gêner les autres.</li>
        <li><strong>👤 Qui suis-je ?</strong> (en haut à droite) : indiquez votre nom, une fois (rien à enregistrer). Le filtre sur la colonne « Assigné à » propose alors <strong>👤 Moi</strong>, qui montre vos propres cartes ; dans une vue partagée, il montre à chacun les siennes.</li>
        <li><strong>＋ Filtre</strong> : ne garde que certaines cartes (« EPIC est … », « Assigné n'est pas … »). Une vue modifiée affiche <strong>•</strong> : cliquez sur <strong>💾 Enregistrer la vue</strong> pour garder les filtres.</li>
        <li><strong>⋯ › Colonnes…</strong> : choisit les statuts affichés et leur ordre. On peut aussi glisser les en-têtes de colonnes.</li>
        <li><strong>Cartes</strong> : glissez une carte dans une autre colonne pour changer son statut ; cliquez dessus pour ouvrir sa fiche. Dans la fiche, la bande <strong>⛔ Bloquée par / ➡️ Bloque</strong> relie la carte à celles qu'elle attend ou qu'elle retient.</li>
        <li><strong>⚠️ Deux « Enregistrer »</strong> : <strong>💾 Enregistrer la vue</strong> garde les filtres dans la vue ; pour une vue 👥 partagée, le bouton <strong>Enregistrer</strong> de Grist, en haut à droite, l'inscrit ensuite dans le document, pour tous. Sans ce dernier clic, elle est perdue au rechargement de la page, comme les réglages de ⚙. Les vues 🔒 personnelles, les cartes, l'onglet actif et votre nom sont gardés aussitôt.</li>
      </ol>
      <p class="accueil-plus"><a href="${URL_AIDE}" target="_blank" rel="noopener">📖 En savoir plus (mode d'emploi complet)</a></p>
    </div>`;
  document.getElementById('accueil-creer')
    ?.addEventListener('click', (e) => ouvrirNomVue('creer', e.currentTarget));
  document.getElementById('accueil-mes-taches')?.addEventListener('click', ouvrirMesTaches);
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

  if (footer.children.length > 0) card.appendChild(footer);

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
  // les cartes liées.
  if (liensAssocies()) {
    body.appendChild(bandeLiens(record.id, getField(record, 'titre') || '',
      (liens) => {
        if (STATE.mapping.bloqueePar) markDirty('bloqueePar', liens.bloqueePar);
        if (STATE.mapping.bloque)     markDirty('bloque', liens.bloque);
      },
      (id) => openEditPanel(id)));
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

/** Couleurs de la colonne d'un statut (relevées au dernier affichage du tableau). */
function couleurStatut(statut) {
  if (STATE.couleursStatut && STATE.couleursStatut[statut]) return STATE.couleursStatut[statut];
  const i = getUniqueFieldValues('statut').indexOf(statut);
  return PASTEL_PALETTE[Math.max(i, 0) % PASTEL_PALETTE.length];
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
 */
function bandeLiens(id, titre, surChangement, surOuvrir) {
  const enregistree = INDEX_LIENS.get(id) || { bloqueePar: [], bloque: [] };
  return Liens.bande({
    index:      INDEX_LIENS,
    carte:      { id, titre },
    bloqueePar: STATE.mapping.bloqueePar ? enregistree.bloqueePar : null,
    bloque:     STATE.mapping.bloque     ? enregistree.bloque     : null,
    candidats:  candidatsLiens(),
    surChangement,
    surOuvrir,
  });
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

  // Config
  document.getElementById('btn-config')       ?.addEventListener('click', openConfig);
  document.getElementById('btn-save-config')  ?.addEventListener('click', saveConfig);
  document.getElementById('btn-close-config') ?.addEventListener('click', closeConfig);
  // ✅ Si l'on change le « Champ Projet », on recharge la liste des projets proposés
  document.getElementById('col-projet')?.addEventListener('change', async (e) => {
    const col = e.target.value;
    let ref = null;
    if (col) {
      try { ref = await chargerReference(getTableName(), col); }
      catch (err) { console.error('Kanban – lecture des projets impossible:', err); }
    }
    remplirChoixProjet(ref);
  });
  // ✅ Équipe projet : recherche, « Tout décocher », et nouvelle liste de
  // personnes si l'on change la colonne « Assigné à »
  document.getElementById('equipe-recherche')?.addEventListener('input', remplirEquipe);
  document.getElementById('equipe-aucun')?.addEventListener('click', () => {
    STATE.equipePanneau.cochees.clear();
    remplirEquipe();
  });
  document.getElementById('col-assigne')?.addEventListener('change', async (e) => {
    const col = e.target.value;
    let ref = null;
    if (col) {
      try { ref = await chargerReference(getTableName(), col); }
      catch (err) { console.error('Kanban – lecture des personnes impossible:', err); }
    }
    preparerEquipe(ref);
  });
  document.getElementById('config-panel')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeConfig(); });

  // Onglets de vue
  document.querySelectorAll('.view-tab[data-view]').forEach(btn => { // onglets codés en dur
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Filtres combinables (#195)
  document.getElementById('filtre-ajouter')  ?.addEventListener('click', (e) => ajouterFiltre(e.currentTarget));
  document.getElementById('filter-reset')    ?.addEventListener('click', resetFilters);
  document.getElementById('filtre-colonne')  ?.addEventListener('change', (e) => {
    // Nouvelle colonne : les valeurs cochées n'ont plus de sens, on repart de zéro
    STATE.filtreEdite.col = e.target.value;
    STATE.filtreEdite.valeurs = [];
    document.getElementById('filtre-recherche').value = '';
    calculerOrdreValeurs();
    remplirPanneauFiltre();
    renderBoard();
  });
  document.querySelectorAll('.filtre-op').forEach(b => b.addEventListener('click', () => {
    STATE.filtreEdite.op = b.dataset.op;
    remplirPanneauFiltre();
    renderBoard();
  }));
  document.getElementById('filtre-recherche')?.addEventListener('input', remplirPanneauFiltre);
  // Molette sur les étiquettes : défilement horizontal (sinon il faut Maj + molette)
  document.getElementById('filtres-actifs')?.addEventListener('wheel', (e) => {
    const zone = e.currentTarget;
    if (zone.scrollWidth <= zone.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    zone.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  document.getElementById('filtre-tout')     ?.addEventListener('click', () => cocherVisibles(true));
  document.getElementById('filtre-aucun')    ?.addEventListener('click', () => cocherVisibles(false));
  document.getElementById('filtre-supprimer')?.addEventListener('click', () => supprimerFiltre(STATE.filtreEdite));
  // Vues enregistrées (#196)
  document.getElementById('vue-ajouter')     ?.addEventListener('click', (e) => ouvrirNomVue('creer', e.currentTarget));
  document.getElementById('vue-enregistrer') ?.addEventListener('click', enregistrerFiltresVue);
  document.getElementById('vue-nom-valider') ?.addEventListener('click', validerNomVue);
  document.getElementById('vue-nom')         ?.addEventListener('keydown', (e) => { if (e.key === 'Enter') validerNomVue(); });
  document.getElementById('vue-menu-enregistrer')?.addEventListener('click', enregistrerFiltresVue);
  document.getElementById('vue-menu-annuler')    ?.addEventListener('click', annulerModificationsVue);
  document.getElementById('vue-menu-renommer')   ?.addEventListener('click', () =>
    ouvrirNomVue('renommer', document.querySelector('.vue-enregistree.active')));
  document.getElementById('vue-menu-colonnes')   ?.addEventListener('click', () =>
    ouvrirColonnesVue(document.querySelector('.vue-enregistree.active')));
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
    if (e.target.closest('.filtre-popover, .filtre-chip, #filtre-ajouter, #vue-ajouter, .vue-menu-btn, #btn-moi')) return;
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
