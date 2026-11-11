/* ══════════════════════════════════════════════════════════════
   FAUX GRIST — imitation de l'API Grist pour le banc d'essai du Kanban
   ══════════════════════════════════════════════════════════════

   Le widget appelle `grist.onRecords`, `grist.docApi.fetchTable`… Ici, ces
   appels reçoivent des réponses préparées à l'avance, sans aucun serveur :
   le banc peut ainsi faire tourner le vrai code du Kanban dans Chrome.

   Ce qui est imité :
     - quatre tables : Taches (les cartes), EPICs, Contacts, Projets2 ;
     - leur description (_grist_Tables, _grist_Tables_column), dont trois
       colonnes « rapportées » ($EPIC.Priorite, $EPIC.Phase, $qui_.Equipe) ;
     - comme le vrai Grist, onRecords n'envoie pas les colonnes masquées dans
       le widget (ici qui__Equipe) sauf si l'on demande includeColumns 'normal'.
   Ce qui est noté : chaque écriture (applyUserActions) dans FAUX_GRIST.actions,
   pour que les scénarios vérifient ce que le widget aurait écrit.

   ⚠️ Dépôt public : uniquement des données INVENTÉES (personnes, EPICs…).
   ══════════════════════════════════════════════════════════════ */
(function () {
  // Description des colonnes, une ligne par colonne (numéros de table :
  // 1 Taches, 2 EPICs, 3 Contacts, 4 Projets2). visibleCol = numéro de la
  // colonne affichée par une référence (ex. 20 = EPICs.Nom).
  const colonnes = [
    // id, parentId, colId, type, label, formula, isFormula, widgetOptions, visibleCol
    [1, 1, 'Nom', 'Text', 'Nom', '', false, '', 0],
    [2, 1, 'statut', 'Choice', 'statut', '', false, JSON.stringify({ choices: ['🖐️ À faire', '♻️ En cours', '✅ Fait'] }), 0],
    [3, 1, 'Description', 'Text', 'Description', '', false, '', 0],
    [4, 1, 'Priorite', 'Choice', 'Priorite', '', false, JSON.stringify({ choices: ['Haute', 'Moyenne', 'Basse'] }), 0],
    [5, 1, 'qui_', 'RefList:Contacts', 'qui ?', '', false, '', 30],
    [6, 1, 'date_cible', 'Date', 'Échéance', '', false, '', 0],
    [7, 1, 'EPIC', 'Ref:EPICs', 'EPIC', '', false, '', 20],
    [8, 1, 'Projet', 'Ref:Projets2', 'Projet', '', false, '', 40],
    [9, 1, 'EPIC_Priorite', 'Any', 'EPIC_Priorite', '$EPIC.Priorite', true, '', 0],
    [10, 1, 'EPIC_Phase', 'Any', 'EPIC_Phase', '$EPIC.Phase', true, '', 0],
    [11, 1, 'qui__Equipe', 'Any', 'qui__Equipe', '$qui_.Equipe', true, '', 0],
    [20, 2, 'Nom', 'Text', 'Nom', '', false, '', 0],
    [21, 2, 'Priorite', 'Choice', 'Priorite', '', false, JSON.stringify({ choices: ['Now', 'Then', 'Done'] }), 0],
    [22, 2, 'Phase', 'Choice', 'Phase', '', false, JSON.stringify({ choices: ['Cadrage', 'Production'] }), 0],
    [23, 2, 'Projet', 'Ref:Projets2', 'Projet', '', false, '', 40],
    [30, 3, 'Nom', 'Text', 'Nom', '', false, '', 0],
    [31, 3, 'Equipe', 'Text', 'Équipe', '', false, '', 0],
    [40, 4, 'Nom', 'Text', 'Nom', '', false, '', 0],
  ];
  const meta = {
    _grist_Tables: { id: [1, 2, 3, 4], tableId: ['Taches', 'EPICs', 'Contacts', 'Projets2'] },
    // Grist renvoie une table « en colonnes » : { colId: [valeurs…], … }
    _grist_Tables_column: ['id', 'parentId', 'colId', 'type', 'label', 'formula', 'isFormula', 'widgetOptions', 'visibleCol']
      .reduce((o, k, i) => (o[k] = colonnes.map(c => c[i]), o), {}),
  };
  // Contenu des tables visées par les références (lu par fetchTable)
  const donnees = {
    EPICs: {
      id: [1, 2, 3],
      Nom: ['Écrire la documentation', 'Préparer la démonstration', 'Archiver le site'],
      Priorite: ['Now', 'Then', 'Done'],
      // Texte volontairement long : vérifie qu'il ne cache pas les attributs suivants
      Phase: ['Production', 'Cadrage des objectifs et des résultats clés avec les partenaires', 'Production'],
      Projet: [15, 15, 15],
    },
    Contacts: { id: [1, 2], Nom: ['Alice Durand', 'Bruno Lefèvre'], Equipe: ['Études', 'Terrain'] },
    Projets2: { id: [15], Nom: ['Kanban'] },
  };
  // Les cartes, telles que Grist les envoie : références sous leur NOM affiché
  const epic = (i) => ({ EPIC: donnees.EPICs.Nom[i], EPIC_Priorite: donnees.EPICs.Priorite[i], EPIC_Phase: donnees.EPICs.Phase[i] });
  const records = [
    { id: 1, Nom: 'Rédiger le guide', statut: '🖐️ À faire', Description: '', Priorite: 'Haute',
      qui_: ['Alice Durand', 'Bruno Lefèvre'], qui__Equipe: ['Études', 'Terrain'], date_cible: null, Projet: 'Kanban', ...epic(0) },
    { id: 2, Nom: 'Carte statique', statut: '♻️ En cours', Description: '', Priorite: 'Basse',
      qui_: [], date_cible: null, Projet: 'Kanban', ...epic(1) },
    { id: 3, Nom: 'Ranger les fichiers', statut: '✅ Fait', Description: '', Priorite: 'Moyenne',
      qui_: ['Bruno Lefèvre'], date_cible: null, Projet: 'Kanban', ...epic(2) },
    { id: 4, Nom: 'Sans EPIC', statut: '🖐️ À faire', Description: '', Priorite: 'Basse',
      qui_: [], date_cible: null, Projet: 'Kanban', EPIC: null, EPIC_Priorite: null, EPIC_Phase: null },
  ];
  // Table des cartes lue par fetchTable (pour les liens Bloque / Bloquée par)
  const tableBrute = {
    Taches: { id: records.map(r => r.id),
      ...['Nom', 'statut', 'EPIC', 'Bloque', 'Bloquee_par'].reduce((o, k) => (o[k] = records.map(r => r[k] ?? null), o), {}) },
  };

  const rappels = {};
  window.FAUX_GRIST = { records, actions: [] };
  window.grist = {
    ready() {},
    onRecords(f, options = {}) {
      window.FAUX_GRIST.optionsRecords = options;
      const toutes = ['normal', 'all'].includes(options.includeColumns);
      rappels.records = (recs, ...reste) => f(toutes ? recs : recs.map(({ qui__Equipe, ...r }) => r), ...reste);
    },
    onRecord(f) { rappels.record = f; },
    onOptions(f) { rappels.options = f; },
    setOption() { return Promise.resolve(); },
    setSelectedRows() {},
    getTable() { return { getTableId: async () => 'Taches' }; },
    docApi: {
      getDocName: async () => 'docTest',
      fetchTable: async (t) => meta[t] || donnees[t] || tableBrute[t] || (() => { throw new Error('table ' + t); })(),
      applyUserActions: async (a) => { window.FAUX_GRIST.actions.push(a); return {}; },
    },
  };
  // Appelé par chaque scénario : envoie les cartes puis les options du widget
  window.FAUX_GRIST.demarrer = () => {
    rappels.records(records, null, 'Taches');
    rappels.options({ projetKanban: 15 });
  };
})();
