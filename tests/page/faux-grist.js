/* ══════════════════════════════════════════════════════════════
   FAUX GRIST — banc d'essai du widget Page
   ══════════════════════════════════════════════════════════════

   Le widget appelle `grist.onRecords`, `grist.docApi.fetchTable`… Ici, ces
   fonctions répondent avec des tables INVENTÉES (dépôt public : aucune
   donnée réelle) :
     - Projets  : la table reliée au widget (4 lignes, dont deux qui
                  portent le même titre, pour vérifier qu'un critère seul
                  ne suffit pas toujours) ;
     - Contacts : visée par la référence Projets.Chef.
   Comme le vrai Grist :
     - onRecords n'envoie que l'id et les colonnes ASSOCIÉES (#239),
       références sous leur NOM affiché ;
     - fetchTable renvoie TOUTES les colonnes « en colonnes », références
       sous leur NUMÉRO, listes encodées ['L', …], et la colonne cachée
       gristHelper_Display (nom affiché du chef de projet) ;
     - après une écriture (applyUserActions), les lignes sont renvoyées.
   FAUX_GRIST.actions note tout ce que le widget écrit, FAUX_GRIST.options
   les réglages enregistrés (grist.setOption), FAUX_GRIST.curseurs les
   positions du curseur demandées (setCursorPos).
   ══════════════════════════════════════════════════════════════ */
(function () {
  const choixType = JSON.stringify({
    choices: ['Interne', 'Collectivité'],
    // « Interne » a une couleur dans Grist, « Collectivité » n'en a pas (→ pastel)
    choiceOptions: { Interne: { fillColor: '#FECACA', textColor: '#7F1D1D' } },
  });
  // Description des colonnes (numéros de table : 1 Projets, 2 Contacts)
  //   id, parentId, colId, type, label, formula, isFormula, widgetOptions, visibleCol, displayCol
  const colonnes = [
    [1,  1, 'Titre',        'Text',          'Titre',          '',                        false, '', 0],
    [2,  1, 'Presentation', 'Text',          'Présentation',   '',                        false, '', 0],
    [3,  1, 'Type',         'Choice',        'Type',           '',                        false, choixType, 0],
    // Référence : displayCol 50 = colonne cachée du nom affiché
    [4,  1, 'Chef',         'Ref:Contacts',  'Chef de projet', '',                        false, '', 20, 50],
    [50, 1, 'gristHelper_Display', 'Any',    'gristHelper_Display', '$Chef.Nom',          true,  '', 0],
    [5,  1, 'Annee',        'Int',           'Année',          '',                        false, '', 0],
    [6,  1, 'Archive',      'Bool',          'Archivé',        '',                        false, '', 0],
    // Texte calculé par une formule : sert à vérifier la lecture seule
    [7,  1, 'Resume',       'Text',          'Résumé',         '"Résumé : " + $Titre',    true,  '', 0],
    // Choix multiple : jamais proposé comme critère
    [8,  1, 'Themes',       'ChoiceList',    'Thèmes',         '',                        false, '', 0],
    // Colonne vide (formule vide) : modifiable, comme une colonne de données
    [9,  1, 'Notes',        'Any',           'Notes',          '',                        true,  '', 0],
    [10, 1, 'manualSort',   'ManualSortPos', 'manualSort',     '',                        false, '', 0],
    [20, 2, 'Nom',          'Text',          'Nom',            '',                        false, '', 0],
  ];
  const meta = {
    _grist_Tables: { id: [1, 2], tableId: ['Projets', 'Contacts'] },
    _grist_Tables_column: ['id', 'parentId', 'colId', 'type', 'label', 'formula', 'isFormula', 'widgetOptions', 'visibleCol', 'displayCol']
      .reduce((o, k, i) => (o[k] = colonnes.map(c => c[i] ?? 0), o), {}),
  };
  const contacts = { id: [1, 2], Nom: ['Personne A', 'Personne B'] };

  // Texte piégé : ni l'image ni le script ne doivent s'exécuter
  const PIEGE = 'Texte **gras** <img src="x" onerror="window.PIEGE=1"> <script>window.PIEGE=2<\/script> [lien](javascript:window.PIEGE=3)';

  // Les lignes, telles que Grist les envoie : références sous leur NOM affiché
  const LIGNES = [
    { id: 1, Titre: 'Atelier vélo', Presentation: '# Objectifs\n- [ ] Cartographier\n- [x] Réunir les partenaires',
      Type: 'Interne', Chef: 'Personne A', Annee: 2025, Archive: false, Resume: 'Résumé : Atelier vélo', Themes: ['Vélo'], Notes: null },
    { id: 2, Titre: 'Vitrine', Presentation: '', Type: 'Collectivité', Chef: 'Personne B', Annee: 2026,
      Archive: true, Resume: 'Résumé : Vitrine', Themes: null, Notes: null },
    // Même titre que la ligne 1 : « Titre = Atelier vélo » désigne deux lignes
    { id: 3, Titre: 'Atelier vélo', Presentation: PIEGE, Type: 'Collectivité', Chef: '', Annee: 2026,
      Archive: false, Resume: 'Résumé : Atelier vélo', Themes: null, Notes: null },
    { id: 4, Titre: '', Presentation: 'Sans titre', Type: null, Chef: 'Personne A', Annee: null,
      Archive: false, Resume: 'Résumé : ', Themes: null, Notes: null },
  ];
  let records = LIGNES.map(r => ({ ...r }));

  // Association des colonnes faite dans le panneau de droite de Grist
  const ASSOCIATION = { Titre: 'Titre', Texte: 'Presentation', Pastilles: ['Type', 'Chef'] };
  const rappels = {};
  let association = { ...ASSOCIATION };

  /** Envoie les lignes au widget : id et colonnes associées seulement. */
  function envoyer() {
    const associees = new Set(['id', ...Object.values(association).flat().filter(Boolean)]);
    const visibles = records.filter(r => !window.FAUX_GRIST.masquees.includes(r.id));
    const envoi = visibles.map(r => Object.fromEntries(Object.entries(r).filter(([col]) => associees.has(col))));
    rappels.records(envoi.map(r => ({ ...r })), association);
  }

  /** Valeur d'une ligne (format d'onRecords) → format de fetchTable. */
  function commeFetchTable(col, v) {
    if (col === 'Chef') { const i = contacts.Nom.indexOf(v); return i === -1 ? 0 : contacts.id[i]; }
    return Array.isArray(v) ? ['L', ...v] : (v ?? null);
  }

  /** La table « en colonnes », comme fetchTable : TOUTES les colonnes. */
  function tableEnColonnes() {
    const cles = colonnes.filter(c => c[1] === 1 && !c[2].startsWith('gristHelper_')).map(c => c[2]);
    const t = { id: records.map(r => r.id) };
    cles.forEach(col => { t[col] = records.map(r => commeFetchTable(col, r[col])); });
    t.gristHelper_Display = records.map(r => r.Chef ?? '');
    return t;
  }

  function appliquer([nom, table, id, champs]) {
    if (table !== 'Projets') throw new Error('table inattendue : ' + table);
    if (nom !== 'UpdateRecord') throw new Error('action inattendue : ' + nom);
    records = records.map(r => r.id === id ? { ...r, ...champs } : r);
    return null;
  }

  window.FAUX_GRIST = {
    actions: [], options: {}, curseurs: [],
    masquees: [],      // numéros de lignes masquées par un filtre de la vue Grist
    tableIllisible: false,
    get records() { return records; },
    contacts, meta,
  };
  window.grist = {
    ready() {},
    onRecords(f) { rappels.records = f; },
    onRecord() {},
    onOptions(f) { rappels.options = f; },
    setOption(cle, valeur) { window.FAUX_GRIST.options[cle] = valeur; return Promise.resolve(); },
    setCursorPos(pos) { window.FAUX_GRIST.curseurs.push(pos); return Promise.resolve(); },
    getTable() { return { getTableId: async () => 'Projets' }; },
    docApi: {
      fetchTable: async (t) => {
        if (t === 'Projets') {
          if (window.FAUX_GRIST.tableIllisible) throw new Error('accès refusé');
          return tableEnColonnes();
        }
        return meta[t] || (t === 'Contacts' ? contacts : (() => { throw new Error('table ' + t); })());
      },
      applyUserActions: async (actions) => {
        window.FAUX_GRIST.actions.push(actions);
        actions.forEach(appliquer);
        setTimeout(envoyer, 50);   // comme Grist : les lignes reviennent après l'écriture
        return { retValues: actions.map(() => null) };
      },
    },
  };

  /**
   * Appelé par Banc.demarrer : envoie les options du widget, puis les lignes.
   *   reglages.colonnes : association à modifier ; les autres clés sont les
   *   options du widget (ex. criteres).
   */
  window.FAUX_GRIST.demarrer = (reglages = {}) => {
    const { colonnes: autre, ...options } = reglages;
    association = { ...ASSOCIATION, ...(autre || {}) };
    rappels.options(options);
    envoyer();
  };
  /** Renvoie les lignes (comme Grist après un changement fait ailleurs). */
  window.FAUX_GRIST.renvoyer = envoyer;
  /** Renvoie les lignes avec une autre association (null retire un champ). */
  window.FAUX_GRIST.associer = (autre) => {
    association = Object.fromEntries(Object.entries({ ...ASSOCIATION, ...autre }).filter(([, v]) => v !== null));
    envoyer();
  };
  /** Modifie une ligne « dans Grist » (sans passer par le widget), puis la renvoie. */
  window.FAUX_GRIST.modifier = (id, champs) => {
    records = records.map(r => r.id === id ? { ...r, ...champs } : r);
    envoyer();
  };
})();
