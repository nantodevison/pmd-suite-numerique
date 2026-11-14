/* ══════════════════════════════════════════════════════════════
   FAUX GRIST — banc d'essai de la Galerie
   ══════════════════════════════════════════════════════════════

   Le widget appelle `grist.onRecords`, `grist.docApi.fetchTable`… Ici, ces
   fonctions répondent avec des tables INVENTÉES (dépôt public : aucune
   donnée réelle) :
     - EPICs    : la table affichée par la Galerie (4 cartes) ;
     - Projets  : visée par la référence EPICs.Projet ;
     - Taches   : visée par la liste de références EPICs.Taches.
   Comme le vrai Grist :
     - onRecords envoie les références sous leur NOM affiché (et non leur
       numéro), avec l'association des colonnes en second argument ;
     - fetchTable renvoie une table « en colonnes » : { colId: [valeurs…] } ;
     - après une écriture (applyUserActions), les cartes sont renvoyées au
       widget ; une carte créée reçoit un numéro à partir de 100.
   FAUX_GRIST.actions note tout ce que le widget écrit, FAUX_GRIST.options
   les réglages enregistrés (grist.setOption).
   ══════════════════════════════════════════════════════════════ */
(function () {
  // Description des colonnes, une ligne par colonne (numéros de table :
  // 1 EPICs, 2 Projets, 3 Taches). visibleCol = numéro de la colonne
  // qu'affiche une référence (0 = aucune).
  //   id, parentId, colId, type, label, formula, isFormula, widgetOptions, visibleCol
  const choixPriorite = JSON.stringify({
    choices: ['Now', 'Later'],
    // « Now » a une couleur dans Grist, « Later » n'en a pas (→ pastel)
    choiceOptions: { Now: { fillColor: '#FECACA', textColor: '#7F1D1D' } },
  });
  const choixThemes = JSON.stringify({ choices: ['Guide', 'Site', 'Formation'] });
  const colonnes = [
    [1,  1, 'Titre',       'Text',           'Titre',       '',                 false, '', 0],
    [2,  1, 'Description', 'Text',           'Description', '',                 false, '', 0],
    [3,  1, 'Priorite',    'Choice',         'Priorité',    '',                 false, choixPriorite, 0],
    // Colonne calculée sans type déclaré, affichée en pourcentage dans Grist
    [4,  1, 'Avancement',  'Any',            'Avancement',  '$Fait / $Total',   true,  '{"numMode":"percent"}', 0],
    [5,  1, 'Projet',      'Ref:Projets',    'Projet',      '',                 false, '', 20],
    [6,  1, 'Taches',      'RefList:Taches', 'Tâches',      '',                 false, '', 30],
    [7,  1, 'Objectif',    'Text',           'Objectif',    '',                 false, '', 0],
    [8,  1, 'Echeance',    'Date',           'Échéance',    '',                 false, '', 0],
    // Titre calculé par une formule : sert à vérifier la lecture seule
    [9,  1, 'Code',        'Any',            'Code',        '"E" + str($id)',   true,  '', 0],
    [10, 1, 'manualSort',  'ManualSortPos',  'manualSort',  '',                 false, '', 0],
    // Colonne « rapportée » du projet ($Projet.Etat) : attribut de la référence Projet (#204)
    [11, 1, 'Projet_Etat', 'Any',            'Projet_Etat', '$Projet.Etat',     true,  '', 0],
    // Case à cocher : sert au regroupement « ✓ oui » / « ✗ non » (#233)
    [12, 1, 'Urgent',      'Bool',           'Urgent',      '',                 false, '', 0],
    // Choix multiple : sert aux pastilles à cases à cocher (#205, #206)
    [13, 1, 'Themes',      'ChoiceList',     'Thèmes',      '',                 false, choixThemes, 0],
    // Version : chaque version relève d'un projet → cohérence Projet / Version (#205)
    [14, 1, 'Version',       'Ref:Versions',     'Version',       '',                 false, '', 40],
    [20, 2, 'Nom',         'Text',           'Nom',         '',                 false, '', 0],
    [21, 2, 'Etat',        'Text',           'État',        '',                 false, '', 0],
    [30, 3, 'Nom',         'Text',           'Nom',         '',                 false, '', 0],
    [40, 4, 'Nom',         'Text',           'Nom',         '',                 false, '', 0],
    [41, 4, 'Projet',      'Ref:Projets',    'Projet',      '',                 false, '', 20],
  ];
  const meta = {
    _grist_Tables: { id: [1, 2, 3, 4], tableId: ['EPICs', 'Projets', 'Taches', 'Versions'] },
    _grist_Tables_column: ['id', 'parentId', 'colId', 'type', 'label', 'formula', 'isFormula', 'widgetOptions', 'visibleCol']
      .reduce((o, k, i) => (o[k] = colonnes.map(c => c[i]), o), {}),
  };
  // Tables visées par les références
  const donnees = {
    Projets: { id: [1, 2], Nom: ['Atelier', 'Vitrine'], Etat: ['Ouvert', 'Fermé'] },
    Taches:  { id: [1, 2, 3], Nom: ['Rédiger le guide', 'Relire le guide', 'Copier les pages'] },
    // Comme fetchTable : une référence sous son NUMÉRO (Version A → Atelier, Version B → Vitrine)
    Versions:  { id: [1, 2], Nom: ['Version A', 'Version B'], Projet: [1, 2] },
  };

  // Ancien texte du widget Notepad (JSON), à convertir en Markdown
  const NOTEPAD = '{"ops":[{"insert":"Ancien texte"},{"insert":"\\n"}]}';
  // 1er janvier 2026, en secondes depuis 1970 (format des dates Grist)
  const JANVIER_2026 = 1767225600;

  // Les cartes, telles que Grist les envoie : références sous leur NOM affiché
  let records = [
    { id: 1, Titre: 'Écrire la documentation', Description: '- [ ] Plan\n- [x] Sommaire', Priorite: 'Now',
      Avancement: 0.67, Projet: 'Atelier', Taches: ['Rédiger le guide', 'Relire le guide'],
      Objectif: 'Guide publié', Echeance: JANVIER_2026, Code: 'E1', Projet_Etat: 'Ouvert', Urgent: true,
      Themes: ['Guide'], Version: 'Version A' },
    { id: 2, Titre: 'Préparer la démonstration', Description: NOTEPAD, Priorite: 'Later',
      Avancement: 1, Projet: 'Atelier', Taches: [], Objectif: 'Démonstration jouée', Echeance: null, Code: 'E2',
      Projet_Etat: 'Ouvert', Urgent: false, Themes: null, Version: '' },
    { id: 3, Titre: 'Archiver le site', Description: 'Texte simple', Priorite: null,
      Avancement: 0.1, Projet: 'Vitrine', Taches: ['Copier les pages'], Objectif: '', Echeance: null, Code: 'E3',
      Projet_Etat: 'Fermé', Urgent: true, Themes: null, Version: 'Version B' },
    // Référence vers une ligne qui n'existe pas : cellule en erreur
    { id: 4, Titre: 'Carte en erreur', Description: '', Priorite: null, Avancement: 0,
      Projet: ['E', 'InvalidTypedValue', 'Ref:Projets', 99], Taches: [], Objectif: '', Echeance: null, Code: 'E4',
      Projet_Etat: null, Urgent: false, Themes: null, Version: '' },
  ];

  // Association des colonnes faite dans le panneau de droite de Grist
  const ASSOCIATION = {
    Titre: 'Titre', Description: 'Description',
    Pastilles: ['Priorite', 'Avancement', 'Projet'],
    ObjetsLies: ['Taches'],
    Contexte: ['Objectif', 'Echeance'],
  };

  const rappels = {};
  let association = { ...ASSOCIATION };
  let prochainNumero = 100;

  /** Envoie les cartes au widget (de nouveaux objets, comme Grist à chaque changement). */
  function envoyer() {
    // Une carte créée alors que la vue est filtrée n'est pas renvoyée
    const visibles = records.filter(r => !(window.FAUX_GRIST.masquerCreees && r.id >= 100));
    rappels.records(visibles.map(r => ({ ...r })), association);
  }

  /**
   * Valeurs écrites par le widget → valeurs que Grist lui renverra :
   * une liste « encodée » ['L', a, b] revient [a, b] ; une référence écrite
   * sous son NUMÉRO revient sous son NOM ('' pour 0, la référence vide).
   */
  function commeGristLesRenvoie(champs) {
    return Object.fromEntries(Object.entries(champs).map(([col, v]) => {
      const c = colonnes.find(x => x[1] === 1 && x[2] === col);
      const ref = c && /^Ref(?:List)?:(.+)$/.exec(c[3]);
      if (Array.isArray(v) && v[0] === 'L') v = v.slice(1);
      if (ref) {
        const t = donnees[ref[1]];
        const nom = (n) => { const i = t.id.indexOf(n); return i === -1 ? n : t.Nom[i]; };
        v = Array.isArray(v) ? v.map(nom) : (v ? nom(v) : '');
      }
      return [col, v];
    }));
  }

  /** Applique une action Grist aux cartes ; renvoie sa valeur de retour. */
  function appliquer([nom, table, id, champs]) {
    if (table !== 'EPICs') throw new Error('table inattendue : ' + table);
    if (champs && !Array.isArray(id)) champs = commeGristLesRenvoie(champs);
    if (nom === 'AddRecord') {
      const nouveau = { id: prochainNumero++, ...champs };
      records.push(nouveau);
      return nouveau.id;
    }
    if (nom === 'UpdateRecord') {
      records = records.map(r => r.id === id ? { ...r, ...champs } : r);
      return null;
    }
    if (nom === 'BulkUpdateRecord') {
      // id est ici une liste de numéros, champs { colId: [valeurs…] }
      id.forEach((n, i) => {
        const modifs = Object.fromEntries(Object.entries(champs).map(([c, vals]) => [c, vals[i]]));
        records = records.map(r => r.id === n ? { ...r, ...modifs } : r);
      });
      return null;
    }
    throw new Error('action inattendue : ' + nom);
  }

  /** La table des cartes « en colonnes », comme la renvoie fetchTable. */
  function tableEnColonnes() {
    const cles = Object.keys(records[0]);
    return Object.fromEntries(cles.map(c => [c, records.map(r => r[c] ?? null)]));
  }

  window.FAUX_GRIST = {
    actions: [], options: {}, curseur: null,
    masquerCreees: false,   // true : une carte créée n'est pas renvoyée (vue filtrée)
    get records() { return records; },
    // Tables visées par les références : un scénario peut y ajouter des lignes
    donnees,
    // Tables lues par le widget (fetchTable), dans l'ordre
    lectures: [],
    // Options passées à onRecords (ex. { includeColumns: 'normal' })
    optionsRecords: null,
  };
  window.grist = {
    ready() {},
    onRecords(f, options) { rappels.records = f; window.FAUX_GRIST.optionsRecords = options || null; },
    onRecord(f) { rappels.record = f; },
    onOptions(f) { rappels.options = f; },
    setOption(cle, valeur) { window.FAUX_GRIST.options[cle] = valeur; return Promise.resolve(); },
    setCursorPos(pos) { window.FAUX_GRIST.curseur = pos; return Promise.resolve(); },
    getTable() { return { getTableId: async () => 'EPICs' }; },
    docApi: {
      getDocName: async () => 'doc-invente',
      fetchTable: async (t) => {
        window.FAUX_GRIST.lectures.push(t);
        if (t === 'EPICs') return tableEnColonnes();
        return meta[t] || donnees[t] || (() => { throw new Error('table ' + t); })();
      },
      applyUserActions: async (actions) => {
        window.FAUX_GRIST.actions.push(actions);
        const retValues = actions.map(appliquer);
        // Comme Grist : les cartes reviennent au widget juste après l'écriture
        setTimeout(envoyer, 50);
        return { retValues };
      },
    },
  };

  /**
   * Appelé par Banc.demarrer : envoie les réglages du widget, puis les cartes.
   *   reglages.colonnes : association à modifier (ex. { Titre: 'Code' }) ;
   *   les autres clés sont les options du widget (ex. modele).
   */
  window.FAUX_GRIST.demarrer = (reglages = {}) => {
    const { colonnes: autre, ...options } = reglages;
    association = { ...ASSOCIATION, ...(autre || {}) };
    rappels.options(options);
    envoyer();
  };
  /** Rappelle onOptions, comme Grist après chaque setOption (le widget ne doit pas relire ses vues). */
  window.FAUX_GRIST.renvoyerOptions = (options) => rappels.options(options);
  /** Renvoie les cartes avec une autre association (null retire un champ). */
  window.FAUX_GRIST.associer = (autre) => {
    association = Object.fromEntries(Object.entries({ ...ASSOCIATION, ...autre }).filter(([, v]) => v !== null));
    envoyer();
  };
})();
