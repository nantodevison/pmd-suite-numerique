/* ══════════════════════════════════════════════════════════════
   FAUX GRIST — banc d'essai du widget Interactions
   ══════════════════════════════════════════════════════════════

   Le widget appelle `grist.onRecords`, `grist.docApi.fetchTable`… Ici, ces
   fonctions répondent avec des tables INVENTÉES (dépôt public : aucune
   donnée réelle) :
     - Interactions : la table reliée au widget (6 lignes) ;
     - Contacts     : visée par la liste de références Interactions.Contacts ;
     - Projets      : visée par Interactions.Projets (liste) et
                      Interactions.Projet_principal (référence simple).
   Comme le vrai Grist :
     - onRecords envoie l'id et les colonnes ASSOCIÉES (le widget n'en
       garde que les numéros de lignes) ;
     - fetchTable renvoie TOUTES les colonnes « en colonnes », valeurs
       brutes : références sous leur NUMÉRO, listes ['L', …], dates en
       secondes ;
     - après une écriture (applyUserActions), les lignes sont renvoyées.
   FAUX_GRIST.actions note tout ce que le widget écrit, FAUX_GRIST.options
   les réglages enregistrés (grist.setOption).
   ══════════════════════════════════════════════════════════════ */
(function () {
  const choixType = JSON.stringify({
    choices: ['Réunion', 'Appel', 'Atelier'],
    // « Réunion » a une couleur dans Grist, les autres non (→ pastel)
    choiceOptions: { 'Réunion': { fillColor: '#BFDBFE', textColor: '#1E3A8A' } },
  });
  // Description des colonnes (numéros de table : 1 Interactions, 2 Contacts, 3 Projets)
  //   id, parentId, colId, type, label, formula, isFormula, widgetOptions, visibleCol, displayCol
  const colonnes = [
    [1,  1, 'Date',        'DateTime:Europe/Paris', 'Date',        '', false, '', 0],
    [2,  1, 'Titre',       'Text',                  'Titre',       '', false, '', 0],
    [3,  1, 'Type',        'Choice',                'Type',        '', false, choixType, 0],
    [4,  1, 'Contacts',    'RefList:Contacts',      'Contacts',    '', false, '', 20],
    [5,  1, 'Projets',     'RefList:Projets',       'Projets',     '', false, '', 30],
    [6,  1, 'url',         'Text',                  'url',         '', false, '', 0],
    [7,  1, 'Description', 'Text',                  'Description', '', false, '', 0],
    // Autres colonnes, pour d'autres associations : référence simple, date
    // sans heure, lien calculé par une formule
    [8,  1, 'Projet_principal', 'Ref:Projets',      'Projet principal', '', false, '', 30],
    [9,  1, 'Jour',        'Date',                  'Jour',        '', false, '', 0],
    [10, 1, 'Lien_calcule', 'Text',                 'Lien calculé', '"https://exemple.org/" + str($id)', true, '', 0],
    [11, 1, 'manualSort',  'ManualSortPos',         'manualSort',  '', false, '', 0],
    [20, 2, 'Nom_complet', 'Text',                  'Nom complet', '', false, '', 0],
    [30, 3, 'Titre',       'Text',                  'Titre',       '', false, '', 0],
  ];
  const meta = {
    _grist_Tables: { id: [1, 2, 3], tableId: ['Interactions', 'Contacts', 'Projets'] },
    _grist_Tables_column: ['id', 'parentId', 'colId', 'type', 'label', 'formula', 'isFormula', 'widgetOptions', 'visibleCol', 'displayCol']
      .reduce((o, k, i) => (o[k] = colonnes.map(c => c[i] ?? 0), o), {}),
  };
  const contacts = { id: [1, 2, 3], Nom_complet: ['Personne A', 'Personne B', 'Personne C'] };
  const projets  = { id: [1, 2, 3], Titre: ['Atelier vélo', 'Vitrine', 'Projet sans rendez-vous'] };

  // Secondes depuis 1970 d'une heure de Paris (hiver : UTC+1, été : UTC+2)
  const paris = (iso, decalage) => Date.parse(iso + decalage) / 1000;
  // Minuit universel d'un jour (colonne Date)
  const jour = (iso) => Date.parse(iso + 'T00:00:00Z') / 1000;

  // Titre piégé : ni l'image ni le script ne doivent s'exécuter
  const PIEGE_TITRE = 'Rendez-vous <img src="x" onerror="window.PIEGE=1">';

  // Les lignes, en valeurs brutes (comme fetchTable)
  const LIGNES = [
    { id: 1, Date: paris('2026-03-10T09:30:00', '+01:00'), Titre: 'Réunion de lancement', Type: 'Réunion',
      Contacts: ['L', 1, 2], Projets: ['L', 1], url: 'https://docs.exemple.org/docs/note-1/',
      Description: 'Ancienne **note**', Projet_principal: 1, Jour: jour('2026-03-10'), Lien_calcule: 'https://exemple.org/1' },
    { id: 2, Date: paris('2026-05-02T14:00:00', '+02:00'), Titre: 'Point d\'étape', Type: 'Appel',
      Contacts: ['L', 2], Projets: ['L', 1, 2], url: '', Description: '',
      Projet_principal: 2, Jour: jour('2026-05-02'), Lien_calcule: 'https://exemple.org/2' },
    // Lien piégé : jamais un lien cliquable
    { id: 3, Date: paris('2026-04-01T10:00:00', '+02:00'), Titre: PIEGE_TITRE, Type: '',
      Contacts: null, Projets: ['L', 1], url: 'javascript:window.PIEGE=2', Description: '',
      Projet_principal: 1, Jour: jour('2026-04-01'), Lien_calcule: 'https://exemple.org/3' },
    { id: 4, Date: paris('2026-06-01T10:00:00', '+02:00'), Titre: 'Autre projet', Type: 'Atelier',
      Contacts: ['L', 3], Projets: ['L', 2], url: '', Description: '',
      Projet_principal: 2, Jour: jour('2026-06-01'), Lien_calcule: 'https://exemple.org/4' },
    { id: 5, Date: null, Titre: '', Type: '', Contacts: null, Projets: ['L', 1], url: '', Description: '',
      Projet_principal: 1, Jour: null, Lien_calcule: 'https://exemple.org/5' },
    // Masquée par un filtre de la vue Grist dans certains scénarios
    { id: 6, Date: paris('2026-07-01T10:00:00', '+02:00'), Titre: 'Interaction filtrée', Type: 'Appel',
      Contacts: null, Projets: ['L', 1], url: '', Description: '',
      Projet_principal: 1, Jour: jour('2026-07-01'), Lien_calcule: 'https://exemple.org/6' },
  ];
  let records = LIGNES.map(r => ({ ...r }));
  let prochainId = 7;

  // Association des colonnes faite dans le panneau de droite de Grist
  const ASSOCIATION = { Date: 'Date', Titre: 'Titre', Projet: 'Projets', Type: 'Type',
    Personnes: 'Contacts', Lien: 'url', Description: 'Description' };
  const rappels = {};
  let association = { ...ASSOCIATION };

  /** Envoie les lignes au widget : id et colonnes associées seulement. */
  function envoyer() {
    const associees = new Set(['id', ...Object.values(association).filter(Boolean)]);
    const visibles = records.filter(r => !window.FAUX_GRIST.masquees.includes(r.id));
    const envoi = visibles.map(r => Object.fromEntries(Object.entries(r).filter(([c]) => associees.has(c))));
    rappels.records(envoi.map(r => ({ ...r })), association);
  }

  /** La table « en colonnes », comme fetchTable : TOUTES les colonnes. */
  function tableEnColonnes() {
    const cles = colonnes.filter(c => c[1] === 1 && c[2] !== 'manualSort').map(c => c[2]);
    const t = { id: records.map(r => r.id) };
    cles.forEach(c => { t[c] = records.map(r => r[c] ?? null); });
    return t;
  }

  function appliquer([nom, table, id, champs]) {
    if (table !== 'Interactions') throw new Error('table inattendue : ' + table);
    if (nom === 'UpdateRecord') {
      records = records.map(r => r.id === id ? { ...r, ...champs } : r);
      return null;
    }
    if (nom === 'AddRecord') {
      const nouvelle = { id: prochainId++, ...champs };
      records.push(nouvelle);
      return nouvelle.id;
    }
    throw new Error('action inattendue : ' + nom);
  }

  window.FAUX_GRIST = {
    actions: [], options: {},
    masquees: [],      // numéros de lignes masquées par un filtre de la vue Grist
    tableIllisible: false,
    get records() { return records; },
    contacts, projets, meta,
  };
  window.grist = {
    ready() {},
    onRecords(f) { rappels.records = f; },
    onRecord() {},
    onOptions(f) { rappels.options = f; },
    setOption(cle, valeur) { window.FAUX_GRIST.options[cle] = valeur; return Promise.resolve(); },
    setCursorPos() { return Promise.resolve(); },
    getTable() { return { getTableId: async () => 'Interactions' }; },
    docApi: {
      fetchTable: async (t) => {
        if (t === 'Interactions') {
          if (window.FAUX_GRIST.tableIllisible) throw new Error('accès refusé');
          return tableEnColonnes();
        }
        if (t === 'Contacts') return { id: [...contacts.id], Nom_complet: [...contacts.Nom_complet] };
        if (t === 'Projets') return { id: [...projets.id], Titre: [...projets.Titre] };
        if (meta[t]) return meta[t];
        throw new Error('table ' + t);
      },
      applyUserActions: async (actions) => {
        window.FAUX_GRIST.actions.push(actions);
        const retValues = actions.map(appliquer);
        setTimeout(envoyer, 50);   // comme Grist : les lignes reviennent après l'écriture
        return { retValues };
      },
    },
  };

  /**
   * Appelé par Banc.demarrer : envoie les options du widget, puis les lignes.
   *   reglages.colonnes : association à modifier (null retire un champ) ;
   *   les autres clés sont les options du widget (projet, libelleBouton).
   */
  window.FAUX_GRIST.demarrer = (reglages = {}) => {
    const { colonnes: autre, ...options } = reglages;
    association = Object.fromEntries(Object.entries({ ...ASSOCIATION, ...(autre || {}) }).filter(([, v]) => v !== null));
    rappels.options(options);
    envoyer();
  };
  /** Renvoie les lignes (comme Grist après un changement fait ailleurs). */
  window.FAUX_GRIST.renvoyer = envoyer;
  /** Modifie une ligne « dans Grist » (sans passer par le widget), puis la renvoie. */
  window.FAUX_GRIST.modifier = (id, champs) => {
    records = records.map(r => r.id === id ? { ...r, ...champs } : r);
    envoyer();
  };
  /** Ajoute une personne « dans Grist » (sans renvoyer les lignes). */
  window.FAUX_GRIST.ajouterContact = (nom) => {
    contacts.id.push(contacts.id.length + 1);
    contacts.Nom_complet.push(nom);
  };
})();
