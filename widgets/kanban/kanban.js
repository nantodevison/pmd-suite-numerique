/* ══════════════════════════════════════════════════════════════
   KANBAN GRIST — kanban.js v3
   • 3 vues : Tâches / Standardiser / Linéariser
   • Filtre EPIC (remplace millésime dans la barre)
   • Colonne Dispo uniquement en vue Linéariser
   • Tri des cartes par priorité : haute → moyenne → basse
   • Hauteur cartes fixe (flex-shrink:0)
   • Curseur horizontal natif
   • Projet = OTV par défaut (silencieux)
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
    millesime:   '',
    projet:      '',
  },

  columnOrder: [],
  activeView: 'taches',

  filters: {
    epic:    '',
    assigne: '',
  },

  drag: { cardId: null, fromStatut: null, placeholder: null },
  colDrag: { statut: null },

  editPanel: { recordId: null, dirty: false, fields: {} },
  addModal:  { statut: null },

  // ✅ Projet du Kanban : numéro de la ligne du projet choisi dans ⚙
  // (un Kanban = un projet). null tant qu'aucun projet n'est choisi.
  // Remplace l'ancien projet OTV codé en dur (6ᵉ ligne de Projets2).
  projetKanban: null,

  //cache des tables de référence
  referenceData: {
    contacts: [],    // Liste des contacts avec id et nom
    epics: [],       // Liste des EPICs avec id et nom
    // Ajoutez d'autres tables de référence si nécessaire
    },
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
  millesime:   'col-millesime',
  projet:      'col-projet',
};

const PROP_ICONS  = { statut:'📋', description:'📝', priorite:'🚦', assigne:'👤', date:'📅', epic:'🏷️', millesime:'🗓️' };
const PROP_LABELS = { statut:'Statut', description:'Description', priorite:'Priorité', assigne:'Assigné à', date:'Échéance', epic:'EPIC', millesime:'Millésime' };

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

/* Définition des vues */
const VIEWS = {
  taches: {
    label: 'Tâches',
    epicFilter: null,
    epicExclude: ['Standardiser les données gestionnaires', 'Linéariser les départements'],
    extraStatuts: [],
    showDispo: false,
    preferredOrder: ['🖐️ À faire', '♻️ En cours', '✅ Fait'],
  },
  standardiser: {
    label: 'Standardiser',
    epicFilter: 'Standardiser les données gestionnaires',
    epicExclude: [],
    extraStatuts: [],
    showDispo: false,
    preferredOrder: ['📧Demande envoyée','💾Data non transmises','💽Data transmises','🔎Data vérifées','✅ Fait'],
  },
  lineariser: {
    label: 'Linéariser',
    epicFilter: 'Linéariser les départements',
    epicExclude: [],
    extraStatuts: ['🆙Disponible'],
    showDispo: true,
    preferredOrder: ['🖐️ À faire', '🆙Disponible', '✅ Fait'],
  },
};

const DISPO_STATUT = '🆙Disponible';

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

// ✨ Récupérer les données de référence après l'initialisation
(async () => {
  try {
    // (Le projet OTV n'est plus lu ici : il est remplacé par le réglage
    //  « Projet du Kanban » du panneau ⚙, voir STATE.projetKanban.)

    const CONTACTS_AUTORISES_IDS = [20, 21 ,23 ,360]; //

    //Récupérer la table Contacts
    const tableContacts = await grist.docApi.fetchTable('Contacts');
    STATE.referenceData.contacts = tableContacts.id
    .map((id, idx) => ({
      id: id,
      nom: tableContacts.Nom?.[idx] || tableContacts.Name?.[idx] || `Contact ${id}`
    }))
    .filter(contact => CONTACTS_AUTORISES_IDS.includes(contact.id));

    console.log('✓ Contacts chargés:', STATE.referenceData.contacts.length);
    console.log('Tous les contacts:', tableContacts.id.map((id, idx) =>
    `${id} → ${tableContacts.Nom?.[idx] || tableContacts.Name?.[idx]}`
    ));

    // Récupérer la table EPICs (si c'est une table séparée)
    try {
      const tableEpics = await grist.docApi.fetchTable('EPICs');
      STATE.referenceData.epics = tableEpics.id.map((id, idx) => ({
        id: id,
        nom: tableEpics.Titre?.[idx] || `EPIC ${id}`
      }));
      console.log('✓ EPICs chargés:', STATE.referenceData.epics.length);
      // Messages de diagnostic, désormais dans le bloc de gestion d'erreur :
      // sans table EPICs, ils ne provoquent plus d'erreur non rattrapée.
      console.log('Colonnes disponibles dans EPICs:', Object.keys(tableEpics));
    } catch (err) {
      console.log('ℹ️ Pas de table EPICs séparée (champ texte)');
    }

  } catch (err) {
    console.error('⚠️ Erreur récupération données référence:', err);
  }
})();

grist.onRecords((records, _mappings, tableId) => {
  if (tableId) _tableName = tableId;
  STATE.records = records;

  if (records.length > 0 && STATE.columns.length === 0) {
    STATE.columns = Object.keys(records[0]).filter(k => k !== 'id');
    populateSelects();
    loadSavedMapping();
  }

  renderBoard();

  if (STATE.editPanel.recordId !== null && !STATE.editPanel.dirty) {
    const rec = STATE.records.find(r => r.id === STATE.editPanel.recordId);
    if (rec) populateEditPanel(rec);
  }
});

grist.onRecord((record) => {
  STATE.selectedId = record ? record.id : null;
  document.querySelectorAll('.card').forEach(el => {
    el.classList.toggle('selected', Number(el.dataset.id) === STATE.selectedId);
  });
});

grist.onOptions((options) => {
  Object.assign(STATE.mapping, {
    titre:'Nom', statut:'statut', description:'Description',
    priorite:'Priorite', assigne:'qui_', date:'date_cible',
    epic:'EPIC', millesime:'Millesime', projet:'Projet',
  });
  if (options && options.mapping)      { Object.assign(STATE.mapping, options.mapping); syncSelectsToMapping(); }
  if (options && options.columnOrder)  STATE.columnOrder = options.columnOrder;
  if (options && options.activeView)   STATE.activeView  = options.activeView;
  // ✅ Projet du Kanban mémorisé dans les options du widget
  STATE.projetKanban = (options && options.projetKanban) ? Number(options.projetKanban) : null;
  syncViewTabs();
  renderBoard();
  // Les noms des projets et des EPICs sont nécessaires pour filtrer les cartes :
  // on les charge, puis on redessine le tableau.
  assurerReferences().then(renderBoard);
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
function openConfig()  {
  populateSelects(); syncSelectsToMapping();
  remplirChoixProjet(REFS.projet); // ✅ liste « Projet du Kanban »
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
  grist.setOption('mapping', STATE.mapping).catch(() => {});
  grist.setOption('projetKanban', STATE.projetKanban).catch(() => {});
  closeConfig();
  await assurerReferences(); // l'association des colonnes a pu changer
  renderBoard();
  showToast('✓ Configuration sauvegardée');
}

/* ══════════════════════════════════════════════════════════════
   3. VUES & FILTRES
   ══════════════════════════════════════════════════════════════ */

function syncViewTabs() {
  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === STATE.activeView);
  });
}

function switchView(viewId) {
  STATE.activeView = viewId;
  syncViewTabs();
  grist.setOption('activeView', viewId).catch(() => {});
  renderBoard();
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

function updateEpicFilterOptions() {
  const sel = document.getElementById('filter-epic');
  if (!sel) return;
  if (!STATE.mapping.epic) { sel.innerHTML = '<option value="">Tous les EPICs</option>'; sel.disabled = true; return; }
  sel.disabled = false;

  const current = sel.value;
  const epics = new Set();
  recordsDuProjet().forEach(r => { // ✅ seulement les EPICs des cartes du projet
    const v = getField(r, 'epic');
    if (v && String(v).trim()) epics.add(String(v));
  });
  const sorted = [...epics].sort((a, b) => a.localeCompare(b, 'fr'));

  sel.innerHTML = '<option value="">Tous les EPICs</option>' +
    sorted.map(e => `<option value="${escHtml(e)}">${escHtml(e)}</option>`).join('');

  if (sorted.includes(current)) sel.value = current;
  else if (current) { sel.value = ''; STATE.filters.epic = ''; }
}

function updatePersonFilterOptions() {
  const sel = document.getElementById('filter-personne');
  if (!sel) return;
  if (!STATE.mapping.assigne) { sel.innerHTML = '<option value="">Toutes</option>'; sel.disabled = true; return; }
  sel.disabled = false;

  const current = sel.value;
  const names = new Set();
  recordsDuProjet().forEach(r => { // ✅ seulement les personnes des cartes du projet
    const v = getField(r, 'assigne');
    if (v && String(v).trim()) names.add(String(v));
  });
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'fr'));

  sel.innerHTML = '<option value="">Toutes</option>' +
    sorted.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('');

  if (sorted.includes(current)) sel.value = current;
  else if (current) { sel.value = ''; STATE.filters.assigne = ''; }
}

function resetFilters() {
  STATE.filters = { epic: '', assigne: '' };
  const selE = document.getElementById('filter-epic');    if (selE) selE.value = '';
  const selP = document.getElementById('filter-personne'); if (selP) selP.value = '';
  renderBoard();
}

function isAnyUserFilterActive() {
  return !!(STATE.filters.epic || STATE.filters.assigne);
}

/* Filtre combiné : vue + filtres utilisateur */
function getFilteredRecords() {
  const view = VIEWS[STATE.activeView] || VIEWS.taches;

  return STATE.records.filter(r => {
    // ✅ Projet du Kanban : on ne garde que les cartes du projet choisi
    if (!estDuProjet(r)) return false;

    // Filtre EPIC de la vue (automatique, inclusion)
    if (view.epicFilter && STATE.mapping.epic) {
      const val = getField(r, 'epic');
      if (!val || String(val).trim().toLowerCase() !== view.epicFilter.toLowerCase()) return false;
    }

    // ✨ Filtre EPIC de la vue (automatique, exclusion)
    if (view.epicExclude && view.epicExclude.length > 0 && STATE.mapping.epic) {
      const val = getField(r, 'epic');
      const valNorm = val ? String(val).trim().toLowerCase() : '';
      const isExcluded = view.epicExclude.some(excluded => valNorm === excluded.toLowerCase());
      if (isExcluded) return false;
    }

    // Filtre EPIC manuel
    if (STATE.filters.epic && STATE.mapping.epic) {
      const val = getField(r, 'epic');
      if (!val || String(val) !== STATE.filters.epic) return false;
    }

    // Filtre personne
    if (STATE.filters.assigne) {
      const val = getField(r, 'assigne');
      if (!val || String(val) !== STATE.filters.assigne) return false;
    }

    return true;
  });
}

/* ══════════════════════════════════════════════════════════════
   4. RENDU DU BOARD
   ══════════════════════════════════════════════════════════════ */

function renderBoard() {
  const board = document.getElementById('board');
  updateEpicFilterOptions();
  updatePersonFilterOptions();

  if (!STATE.mapping.titre || !STATE.mapping.statut) {
    board.innerHTML = `<div class="empty-state"><div class="empty-icon">⚙️</div><p>Configuration requise</p><p class="empty-hint">Cliquez sur ⚙ pour associer les colonnes.</p></div>`;
    return;
  }
  if (STATE.records.length === 0) {
    board.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Aucune donnée</p></div>`;
    return;
  }

  const view = VIEWS[STATE.activeView] || VIEWS.taches;
  const filteredRecords = getFilteredRecords();
  const filterActive = isAnyUserFilterActive() || !!view.epicFilter;

  // ✨ Une vue "restreinte" est une vue dont preferredOrder n'est pas vide
  const hasPreferredOrder = view.preferredOrder && view.preferredOrder.length > 0;

  const allStatuts = new Set();

  if (hasPreferredOrder) {
    // ✨ Vue restreinte : uniquement les colonnes de preferredOrder
    view.preferredOrder.forEach(s => allStatuts.add(s));
  } else {
    // Vue libre (ex: Standardiser) : on collecte tous les statuts présents
    STATE.records.forEach(r => {
      const s = getField(r, 'statut') ?? 'Sans statut';
      allStatuts.add(String(s));
    });
  }

  // Colonnes extra de la vue (ex: Dispo pour Linéariser)
  view.extraStatuts.forEach(s => allStatuts.add(s));

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

    // Masquer Dispo si pas en vue Linéariser
    if (statut === DISPO_STATUT && !view.showDispo) return;

    // ✨ Colonne "de base" = colonne définie par preferredOrder de la vue active
    const isBaseCol = hasPreferredOrder && view.preferredOrder.includes(statut);

    // Masquer les colonnes vides si filtre actif (sauf colonnes de base et Dispo)
    if (filterActive && isEmptyCol && !isBaseCol && statut !== DISPO_STATUT) return;

    // Masquer les colonnes vides si vue avec EPIC forcé (réduire le bruit)
    if (view.epicFilter && isEmptyCol && !isBaseCol && statut !== DISPO_STATUT) return;

    const colorIdx = STATE.columnOrder.includes(statut)
      ? STATE.columnOrder.indexOf(statut)
      : statutList.indexOf(statut);
    const palette = PASTEL_PALETTE[colorIdx % PASTEL_PALETTE.length];
    STATE.couleursStatut[statut] = palette;

    const col = buildColumn(statut, groups[statut] || [], palette, totalFiltered, view);
    board.appendChild(col);
  });

  if (board.children.length === 0) {
    board.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Aucun résultat</p><p class="empty-hint">Aucune carte ne correspond aux filtres actifs.</p></div>`;
  }

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
    const assigneDisplay = typeof assigne === 'number' ? getReferenceName('assigne', assigne) : assigne;
    footer.appendChild(buildBadge('👤 ' + assigneDisplay, 'badge-assigne'));
  }

  const date = getField(record, 'date');
  if (date) footer.appendChild(buildBadge('📅 ' + formatDate(date), 'badge-date'));

  // Millésime : seulement s'il est associé dans ⚙ (propre à l'Observatoire,
  // appelé à disparaître avec les onglets Standardiser et Linéariser)
  const millesime = getField(record, 'millesime');
  if (millesime) footer.appendChild(buildBadge('🗓️ ' + millesime, 'badge-millesime'));

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
  await assurerReferences(); // ✅ Correctif : correspondances numéro ↔ nom à jour
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

      // Pré-remplir si filtre actif
      if (STATE.filters.epic) {
        const matchedOption = epicOptions.find(e => e.nom === STATE.filters.epic || e.id === STATE.filters.epic);
        if (matchedOption) sel.value = matchedOption.id;
      }

      f.appendChild(sel);
    } else {
      // Fallback : champ texte
      const inp = makeInput('text', 'modal-epic', 'EPIC…');
      if (STATE.filters.epic) inp.value = STATE.filters.epic;
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
      f.appendChild(makeSelect(values, labels, 'modal-assigne'));
    } else {
      // Fallback : champ texte
      f.appendChild(makeInput('text', 'modal-assigne', 'Nom…'));
    }
    row2.appendChild(f);
  }

  if (row2.children.length) body.appendChild(row2);

  // Ligne 3 : Date + Millésime (inchangé)
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
    ['millesime',   'modal-millesime'],
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

  // Date
  if (STATE.mapping.date) {
    const el = document.getElementById('modal-date');
    if (el && el.value) {
      const d = new Date(el.value);
      if (!isNaN(d)) newRecord[STATE.mapping.date] = Math.floor(d.getTime() / 1000);
    }
  }

  const confirmBtn = document.getElementById('modal-confirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '…'; }

  try {
    await grist.docApi.applyUserActions([['AddRecord', getTableName(), null, newRecord]]);
    showToast(`✓ Carte « ${titre} » créée dans « ${statut} »`);
    closeAddCardModal();
  } catch (err) {
    showToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Kanban – erreur ajout:', err);
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Créer la carte'; }
  }
}

async function deleteCard(recordId, titre) {
  const confirmed = window.confirm(`Supprimer définitivement la carte « ${titre} » ?`);
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
 * seule la mise en page change. Le millésime, propre à l'Observatoire,
 * n'apparaît plus dans la fiche (il reste sur les cartes).
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
    } else if (REFS[key] && REFS[key].estListe) {
      // ✅ Correctif : une liste de références s'écrit ['L', n1, n2, …] (null si vide)
      updates[col] = value.length ? ['L', ...value] : null;
    } else {
      // Référence simple : value est déjà un numéro de ligne (0 = vide)
      updates[col] = value;
    }
  });
  if (!Object.keys(updates).length) return;

  const saveBtn = document.getElementById('edit-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '…'; }

  try {
    await grist.docApi.applyUserActions([['UpdateRecord', getTableName(), STATE.editPanel.recordId, updates]]);
    STATE.editPanel.dirty = false; STATE.editPanel.fields = {};
    updateDirtyIndicator();
    if (saveBtn) saveBtn.textContent = '✓ Sauvegarder';
    showToast('✓ Modifications sauvegardées');
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

  try {
    await grist.docApi.applyUserActions([['UpdateRecord', getTableName(), STATE.drag.cardId, { [STATE.mapping.statut]: toStatut }]]);
    showToast(`✓ Déplacé vers « ${toStatut} »`);
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
  STATE.columnOrder = order;
  grist.setOption('columnOrder', STATE.columnOrder).catch(() => {});
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
 * Pour « Assigné à », on respecte la liste restreinte de contacts de la
 * version d'origine (STATE.referenceData.contacts) quand elle existe, en
 * gardant toujours les personnes déjà assignées : sinon, un simple
 * enregistrement les retirerait sans prévenir.
 */
function optionsProposees(key, idsActuels) {
  const ref = REFS[key];
  if (key === 'assigne' && STATE.referenceData.contacts.length > 0) {
    const autorises = STATE.referenceData.contacts.map(c => c.id);
    return ref.options.filter(o => autorises.includes(o.id) || idsActuels.includes(o.id));
  }
  // ✅ Projet du Kanban : seuls les EPICs du projet choisi (#144), en gardant
  // l'EPIC actuel de la carte même s'il appartient à un autre projet.
  if (key === 'epic' && STATE.projetKanban && ref.options.some(o => 'projetId' in o)) {
    return ref.options.filter(o => o.projetId === STATE.projetKanban || idsActuels.includes(o.id));
  }
  return ref.options;
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
      return STATE.referenceData.contacts || [];
    case 'epic':
      // ✅ Projet du Kanban : si la référence est connue, seuls les EPICs du projet (#144)
      if (REFS.epic) return optionsProposees('epic', []);
      // Si EPIC est une table de référence
      if (STATE.referenceData.epics.length > 0) {
        return STATE.referenceData.epics;
      }
      // Sinon, retourner les valeurs uniques existantes (mode texte)
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
  document.getElementById('config-panel')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeConfig(); });

  // Onglets de vue
  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Filtres
  document.getElementById('filter-epic')    ?.addEventListener('change', (e) => { STATE.filters.epic    = e.target.value; renderBoard(); });
  document.getElementById('filter-personne')?.addEventListener('change', (e) => { STATE.filters.assigne = e.target.value; renderBoard(); });
  document.getElementById('filter-reset')   ?.addEventListener('click', resetFilters);

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
      const panel = document.getElementById('edit-panel');
      if (panel?.classList.contains('open')) { closeEditPanel(); return; }
      const modal = document.getElementById('add-card-modal');
      if (modal && !modal.classList.contains('hidden')) closeAddCardModal();
    }
  });

  const saveBtn = document.getElementById('edit-save-btn');
  if (saveBtn) saveBtn.disabled = true;
});
