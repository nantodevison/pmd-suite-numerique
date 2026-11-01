/* ══════════════════════════════════════════════════════════════
   RECHERCHE — règle de recherche commune aux widgets (Kanban, Galerie…)
   ══════════════════════════════════════════════════════════════

   Une seule façon de chercher, partout :
     - majuscules et accents ignorés (« securite » trouve « Sécurité ») ;
     - chaque mot saisi doit figurer quelque part, dans n'importe quel
       ordre (« kanban filtre » trouve « Filtrer le Kanban ») ;
     - un mot de la forme #chiffres est cherché dans le NUMÉRO de la ligne
       (le #id affiché sur les cartes), en début de numéro : #20 trouve
       #20 et #200 à #209, mais pas #120.

   Où chercher ? Dans TOUTES les colonnes que Grist envoie au widget,
   quels que soient leurs noms : le widget reste utilisable sur n'importe
   quelle table. Chaque valeur est prise telle que Grist l'affiche :
     - texte, choix, choix multiple : tels quels ;
     - référence, liste de références : le nom affiché de la ligne visée
       (Grist n'envoie que son numéro, d'où la lecture de la structure) ;
     - nombres, dates, cases à cocher, pièces jointes : ignorés (« 2 »
       trouverait sinon presque toutes les cartes).

   Ce module ne connaît AUCUN nom de table ni de colonne.

   UTILISATION (exemple)
     const structure = await Recherche.lireStructure('Taches');  // facultatif
     const visibles = lignes.filter(l => Recherche.ligneCorrespond(l, saisie, structure));
   Sans structure (pas encore lue, ou illisible), seules les valeurs texte
   sont parcourues : la recherche marche, sans les noms des références.
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. La règle de correspondance ─────────────────────────── */

  /** Texte comparable : sans accents ni majuscules. */
  function simplifier(texte) {
    // NFD sépare chaque lettre de son accent (é → e + ´) ; on retire ensuite
    // les accents, qui occupent la plage Unicode 0300–036F.
    return String(texte).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /**
   * Un texte correspond-il à la saisie ?
   *   saisie : ce que l'utilisateur a tapé (vide = tout correspond)
   *   texte  : texte où chercher, DÉJÀ passé par simplifier()
   *   id     : numéro de la ligne (facultatif). Sans lui, un mot « #20 »
   *            est cherché dans le texte comme les autres.
   */
  function correspond(saisie, texte, id) {
    const mots = simplifier(saisie).split(/\s+/).filter(Boolean);
    return mots.every(mot => {
      if (id !== undefined && /^#\d+$/.test(mot)) return String(id).startsWith(mot.slice(1));
      return texte.includes(mot);
    });
  }

  /* ── 2. Structure de la table : types et noms des références ── */

  /**
   * Lit dans les tables internes de Grist le type de chaque colonne de
   * `tableId`, puis, pour les références, le nom affiché de chaque ligne
   * visée (une seule lecture par table visée).
   * @returns {Promise<{types: Object, noms: Object}>}
   *   types : { colId: 'Text' | 'Ref:EPICs' | … }
   *   noms  : { colId: { numéro de ligne: nom affiché } } (références seulement)
   */
  async function lireStructure(tableId) {
    const tables   = await grist.docApi.fetchTable('_grist_Tables');
    const colonnes = await grist.docApi.fetchTable('_grist_Tables_column');
    const structure = { types: {}, noms: {}, cache: new WeakMap() };
    const numeroTable = tables.id[tables.tableId.indexOf(tableId)];
    if (numeroTable === undefined) return structure;

    // Références à résoudre, regroupées par table visée : { EPICs: [{ colId, colAffichee }] }
    const aLire = {};
    colonnes.id.forEach((_, i) => {
      if (colonnes.parentId[i] !== numeroTable) return;
      const colId = colonnes.colId[i];
      const type  = String(colonnes.type[i]);
      structure.types[colId] = type;
      const ref = /^(Ref|RefList):(.+)$/.exec(type);
      if (!ref) return;
      // visibleCol : numéro de la colonne qu'affiche la référence (0 = aucune :
      // Grist montre alors le numéro, inutile à chercher)
      const iAffichee = colonnes.id.indexOf(colonnes.visibleCol[i]);
      if (iAffichee === -1) return;
      (aLire[ref[2]] = aLire[ref[2]] || []).push({ colId, colAffichee: colonnes.colId[iAffichee] });
    });

    await Promise.all(Object.entries(aLire).map(async ([tableVisee, refs]) => {
      try {
        const lignes = await grist.docApi.fetchTable(tableVisee);
        refs.forEach(({ colId, colAffichee }) => {
          const noms = {};
          const valeurs = lignes[colAffichee] || [];
          lignes.id.forEach((n, i) => {
            const v = valeurs[i];
            // Le nom affiché peut lui-même être une liste (['L', a, b…]) ou un nombre
            noms[n] = Array.isArray(v) ? v.filter(x => x !== 'L').join(' ')
                    : (v === null || v === undefined) ? null : String(v);
          });
          structure.noms[colId] = noms;
        });
      } catch (err) {
        // Table illisible (droits d'accès…) : ces références ne seront pas cherchées
        console.warn(`Recherche – table ${tableVisee} illisible :`, err);
      }
    }));
    return structure;
  }

  /* ── 3. Texte de recherche d'une ligne ─────────────────────── */

  // Colonnes internes de Grist, jamais affichées
  const estInterne = colId => colId === 'id' || colId === 'manualSort' || colId.startsWith('gristHelper_');

  // Une cellule en erreur arrive comme un objet { name, message } ou « encodée » ['E', …]
  const estErreur = v => (Array.isArray(v) && v[0] === 'E')
    || (Boolean(v) && typeof v === 'object' && !Array.isArray(v) && 'message' in v);

  // Textes cherchables d'une cellule (liste, éventuellement vide)
  function textesCellule(colId, valeur, structure) {
    if (valeur === null || valeur === undefined || estErreur(valeur)) return [];
    // Une liste peut arriver « encodée » : ['L', a, b…]
    const elements = Array.isArray(valeur) ? (valeur[0] === 'L' ? valeur.slice(1) : valeur) : [valeur];
    const noms = structure && structure.noms[colId];
    return elements.map(v => {
      if (typeof v === 'string') {
        // Ancien texte Notepad (JSON) : on cherche dans le texte, pas dans son enveloppe
        return window.Fiche ? Fiche.notepadVersMarkdown(v) : v;
      }
      if (typeof v === 'number' && noms && v !== 0) return noms[v];   // référence
      return null;   // nombre, date, booléen… : ignoré
    }).filter(t => t !== null && t !== undefined && t !== '');
  }

  // Textes déjà calculés, par ligne. Grist envoie de nouveaux objets à chaque
  // changement de données : une ligne modifiée est donc toujours recalculée.
  const cacheSansStructure = new WeakMap();

  /** Texte de recherche d'une ligne (déjà simplifié), calculé une seule fois. */
  function texteLigne(ligne, structure) {
    const cache = structure ? structure.cache : cacheSansStructure;
    if (!cache.has(ligne)) {
      const textes = Object.keys(ligne)
        .filter(colId => !estInterne(colId))
        .flatMap(colId => textesCellule(colId, ligne[colId], structure));
      cache.set(ligne, simplifier(textes.join(' \n ')));
    }
    return cache.get(ligne);
  }

  /** Une ligne de Grist correspond-elle à la saisie ? (structure facultative) */
  function ligneCorrespond(ligne, saisie, structure) {
    if (!saisie || !saisie.trim()) return true;
    return correspond(saisie, texteLigne(ligne, structure), ligne.id);
  }

  // Seul objet rendu visible au reste de la page.
  window.Recherche = { simplifier, correspond, lireStructure, ligneCorrespond };
})();
