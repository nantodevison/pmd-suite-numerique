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
   quelle table. Chaque valeur est prise telle que Grist l'envoie :
     - texte, choix, choix multiple : tels quels ;
     - référence, liste de références : Grist envoie déjà le nom affiché
       de la ligne visée, cherché comme un texte ;
     - nombres, dates, cases à cocher, pièces jointes : ignorés (« 2 »
       trouverait sinon presque toutes les cartes).

   Ce module ne connaît AUCUN nom de table ni de colonne, et ne lit rien
   dans Grist.

   UTILISATION (exemple)
     const visibles = lignes.filter(l => Recherche.ligneCorrespond(l, saisie));
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

  /**
   * ANCIENNE FONCTION, gardée tant que le Kanban l'appelle (à retirer avec
   * son passage à ../_commun/colonnes.js, #188). Elle lisait les noms des
   * références, inutiles puisque Grist les envoie déjà : elle ne lit plus
   * rien et renvoie null (« pas de structure »).
   */
  async function lireStructure() { return null; }

  /* ── 2. Texte de recherche d'une ligne ─────────────────────── */

  // Colonnes internes de Grist, jamais affichées
  const estInterne = colId => colId === 'id' || colId === 'manualSort' || colId.startsWith('gristHelper_');

  // Une cellule en erreur arrive comme un objet { name, message } ou « encodée » ['E', …]
  const estErreur = v => (Array.isArray(v) && v[0] === 'E')
    || (Boolean(v) && typeof v === 'object' && !Array.isArray(v) && 'message' in v);

  // Textes cherchables d'une cellule (liste, éventuellement vide)
  function textesCellule(valeur) {
    if (valeur === null || valeur === undefined || estErreur(valeur)) return [];
    // Une liste peut arriver « encodée » : ['L', a, b…]
    const elements = Array.isArray(valeur) ? (valeur[0] === 'L' ? valeur.slice(1) : valeur) : [valeur];
    return elements
      // Seuls les textes sont cherchés (références comprises, reçues sous leur
      // nom) ; nombres, dates, booléens… sont ignorés.
      .filter(v => typeof v === 'string' && v !== '')
      // Ancien texte Notepad (JSON) : on cherche dans le texte, pas dans son enveloppe
      .map(v => window.Fiche ? Fiche.notepadVersMarkdown(v) : v);
  }

  // Textes déjà calculés, par ligne. Grist envoie de nouveaux objets à chaque
  // changement de données : une ligne modifiée est donc toujours recalculée.
  const cache = new WeakMap();

  /** Texte de recherche d'une ligne (déjà simplifié), calculé une seule fois. */
  function texteLigne(ligne) {
    if (!cache.has(ligne)) {
      const textes = Object.keys(ligne)
        .filter(colId => !estInterne(colId))
        .flatMap(colId => textesCellule(ligne[colId]));
      cache.set(ligne, simplifier(textes.join(' \n ')));
    }
    return cache.get(ligne);
  }

  /**
   * Une ligne de Grist correspond-elle à la saisie ?
   * (Un 3e argument, ancienne « structure », est accepté et ignoré.)
   */
  function ligneCorrespond(ligne, saisie) {
    if (!saisie || !saisie.trim()) return true;
    return correspond(saisie, texteLigne(ligne), ligne.id);
  }

  // Seul objet rendu visible au reste de la page.
  window.Recherche = { simplifier, correspond, lireStructure, ligneCorrespond };
})();
