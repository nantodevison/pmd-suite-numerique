/* ══════════════════════════════════════════════════════════════
   COLONNES — structure des tables d'un document Grist, commune aux
   widgets (Kanban, Galerie…)
   ══════════════════════════════════════════════════════════════

   Grist décrit chaque table et chaque colonne du document dans deux tables
   internes : _grist_Tables et _grist_Tables_column. On y lit, pour chaque
   colonne : son libellé, son type, si elle est calculée par une formule,
   ses choix et leurs couleurs, la table que vise une référence…

   Ce module les lit UNE fois pour tout le document, puis répond aux
   questions des widgets sans nouvel appel à Grist. Il ne connaît AUCUN nom
   de table ni de colonne.

   UTILISATION (exemple)
     const doc = await Colonnes.lireDocument();
     doc.colonne('Taches', 'Priorite')
       → { colId: 'Priorite', libelle: 'Priorité', type: 'Choice', typeBase: 'Choice',
           formule: false, choix: ['Haute', …], couleurs: { Haute: { fond, texte } }, … }
     doc.colonnes('Taches')                   → toutes les colonnes de la table
     doc.colonneQuiVise('EPICs', 'Projets2')  → 'Projet'
     const ref = await Colonnes.lireReference(doc, 'Taches', 'qui_');
       → { estListe: true, tableVisee: 'Contacts', options: [{ id, nom }…], nom(id), id(nom) }

   BON À SAVOIR : Grist envoie aux widgets (onRecords) les références sous
   leur NOM affiché, mais attend leur NUMÉRO de ligne pour les écrire ;
   lireReference donne la correspondance entre les deux.
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Colonnes internes de Grist, jamais montrées à l'utilisateur
  const estInterne = colId => colId === 'manualSort' || colId.startsWith('gristHelper_');

  /**
   * Réglages d'affichage d'une colonne, rangés par Grist dans ses
   * « widgetOptions » (texte JSON) :
   *   choix       : liste ordonnée des choix (colonnes Choix, Choix multiple) ;
   *   couleurs    : { choix: { fond, texte } }, '' quand Grist n'en a pas ;
   *   pourcentage : true pour un nombre affiché en % dans Grist.
   */
  function lireOptions(widgetOptions) {
    try {
      const options = JSON.parse(widgetOptions || '{}');
      const couleurs = {};
      Object.entries(options.choiceOptions || {}).forEach(([choix, o]) => {
        if (o.fillColor || o.textColor) couleurs[choix] = { fond: o.fillColor || '', texte: o.textColor || '' };
      });
      return {
        choix:       Array.isArray(options.choices) ? options.choices : [],
        couleurs,
        pourcentage: options.numMode === 'percent',
      };
    } catch (_) {
      return { choix: [], couleurs: {}, pourcentage: false };
    }
  }

  /**
   * Lit la structure de tout le document (deux appels à Grist).
   * @returns {Promise<Document>} voir la classe Document ci-dessous
   */
  async function lireDocument() {
    const [tables, cols] = await Promise.all([
      grist.docApi.fetchTable('_grist_Tables'),
      grist.docApi.fetchTable('_grist_Tables_column'),
    ]);

    // Numéro interne d'une table → son identifiant (ex. 3 → 'EPICs')
    const nomTable = {};
    tables.id.forEach((n, i) => { nomTable[n] = tables.tableId[i]; });

    // 1. Une fiche par colonne, rangée par table
    const parTable = {};
    cols.id.forEach((_, i) => {
      const table = nomTable[cols.parentId[i]];
      const colId = cols.colId[i];
      if (!table || estInterne(colId)) return;
      const type = String(cols.type[i]);
      const ref  = /^(Ref|RefList):(.+)$/.exec(type);
      // visibleCol : numéro (dans _grist_Tables_column) de la colonne qu'une
      // référence affiche, par exemple « Nom » pour une référence vers EPICs ;
      // 0 = aucune, Grist montre alors le numéro de la ligne.
      const iAffichee = cols.id.indexOf(cols.visibleCol[i]);
      (parTable[table] = parTable[table] || []).push({
        colId,
        table,
        libelle:     cols.label[i] || colId,
        type,                                         // 'Text', 'Ref:EPICs', 'DateTime:Europe/Paris'…
        typeBase:    type.split(':')[0],              // 'Text', 'Ref', 'DateTime'…
        tableVisee:  ref ? ref[2] : null,             // références seulement
        estListe:    Boolean(ref) && ref[1] === 'RefList',
        colAffichee: iAffichee !== -1 ? cols.colId[iAffichee] : null,
        // isFormula avec une formule vide = colonne vide, encore modifiable
        formule:     Boolean(cols.isFormula[i]) && Boolean(cols.formula[i]),
        texteFormule: String(cols.formula[i] || ''),
        ...lireOptions(cols.widgetOptions[i]),
        rapportee:   null,                            // complété ci-dessous
      });
    });

    // 2. Colonnes « rapportées » d'une autre table : formule exactement
    //    « $EPIC.Priorite » (menu de Grist « ajouter une colonne depuis la
    //    référence »). Grist les nomme « EPIC_Priorite » ; on retient le
    //    libellé de la référence (via) et celui de la colonne d'origine (attribut).
    const doc = new Document(parTable);
    Object.values(parTable).flat().forEach(c => {
      const m = /^\$(\w+)\.(\w+)$/.exec(c.texteFormule.trim());
      if (!c.formule || !m) return;
      const [, colRef, colSource] = m;
      const reference = doc.colonne(c.table, colRef);
      const source = reference && reference.tableVisee && doc.colonne(reference.tableVisee, colSource);
      if (source) c.rapportee = { colRef, via: reference.libelle, attribut: source.libelle };
    });
    return doc;
  }

  /** Structure du document lue par lireDocument : on l'interroge sans appel à Grist. */
  class Document {
    constructor(parTable) {
      this._parTable = parTable;
      this._lignes = {};   // tables visées déjà lues par lireReference : { table: promesse }
    }

    /** Colonnes de la table (sans les colonnes internes), dans l'ordre de Grist ; [] si inconnue. */
    colonnes(tableId) { return [...(this._parTable[tableId] || [])]; }

    /** Description d'une colonne, ou null si elle n'existe pas. */
    colonne(tableId, colId) {
      return (this._parTable[tableId] || []).find(c => c.colId === colId) || null;
    }

    /** Première colonne de `tableId` qui est une référence simple vers `tableCible`, ou null. */
    colonneQuiVise(tableId, tableCible) {
      const c = (this._parTable[tableId] || []).find(c => c.type === `Ref:${tableCible}`);
      return c ? c.colId : null;
    }
  }

  /**
   * Lignes visées par une colonne de référence, avec leur nom affiché.
   * La table visée n'est lue qu'une fois par document (lectures suivantes
   * mémorisées), même si plusieurs colonnes la visent.
   * @returns {Promise<{estListe, tableVisee, options: Array<{id, nom}>, nom, id}|null>}
   *   null si la colonne n'existe pas ou n'est pas une référence.
   *   nom(id) : nom affiché de la ligne n° id ('' si inconnue) ;
   *   id(nom) : numéro de la ligne qui porte ce nom (undefined si aucune).
   */
  async function lireReference(doc, tableId, colId) {
    const c = doc.colonne(tableId, colId);
    if (!c || !c.tableVisee) return null;
    if (!doc._lignes[c.tableVisee]) doc._lignes[c.tableVisee] = grist.docApi.fetchTable(c.tableVisee);
    let lignes;
    try {
      lignes = await doc._lignes[c.tableVisee];
    } catch (err) {
      delete doc._lignes[c.tableVisee];   // échec (droits…) : un prochain appel réessaiera
      throw err;
    }
    const options = lignes.id.map((id, i) => ({
      id,
      nom: c.colAffichee ? String(lignes[c.colAffichee][i] ?? '') : String(id),
    }));
    return {
      estListe:   c.estListe,
      tableVisee: c.tableVisee,
      options,
      nom: (id) => (options.find(o => o.id === id) || { nom: '' }).nom,
      id:  (nom) => (options.find(o => o.nom === String(nom)) || {}).id,
    };
  }

  // Seul objet rendu visible au reste de la page.
  window.Colonnes = { lireDocument, lireReference };
})();
