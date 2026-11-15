/* ══════════════════════════════════════════════════════════════
   CONDITION — « condition de liste déroulante » de Grist (#238)
   ══════════════════════════════════════════════════════════════

   Dans Grist, une colonne Choix ou Référence peut limiter les valeurs
   proposées par une formule, par exemple :
     choice.Projet == $Projet     (n'offrir que les objectifs du projet de la ligne)
   Grist range cette formule déjà ANALYSÉE, sous forme d'arbre :
     ["Eq", ["Attr", ["Name", "choice"], "Projet"], ["Attr", ["Name", "rec"], "Projet"]]
   (colonnes.js la lit dans la description de la colonne : champ `condition`).

   Ce module évalue cet arbre pour une option, sans exécuter de Python :
     - choice : l'option proposée (une ligne de la table visée, au format de
                fetchTable : références sous leur NUMÉRO) ou, pour une
                colonne Choix, le texte du choix ;
     - rec    : la ligne en cours ($Projet), au même format.

   PRUDENCE : il ne connaît qu'un petit vocabulaire (et, ou, non,
   comparaisons, « in »). Devant autre chose (une chaîne $Projet.Statut,
   une fonction…), il répond « je ne sais pas » : l'option reste proposée,
   comme si la condition n'existait pas. Mieux vaut trop proposer que
   cacher à tort.

   UTILISATION
     Condition.garder(arbre, { choice, rec })   → true sauf si la condition est
                                                  certainement fausse
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // « Je ne sais pas » : une expression que ce module ne sait pas évaluer
  const INCONNU = Symbol('inconnu');

  /** Liste « encodée » par Grist ['L', a, b…] → [a, b…] ; autre valeur inchangée. */
  const decoder = (v) => (Array.isArray(v) && v[0] === 'L') ? v.slice(1) : v;

  /** Vrai au sens de Python : liste ou texte vide, 0 et None sont faux. */
  const vrai = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

  /** Égalité de deux valeurs (deux listes : même contenu, dans le même ordre). */
  function egal(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
    return a === b;
  }

  // Comparaisons : [nom dans l'arbre, fonction]
  const COMPARAISONS = {
    Eq:    (a, b) => egal(a, b),
    NotEq: (a, b) => !egal(a, b),
    Lt:    (a, b) => a < b,
    LtE:   (a, b) => a <= b,
    Gt:    (a, b) => a > b,
    GtE:   (a, b) => a >= b,
    Is:    (a, b) => a === b,
    IsNot: (a, b) => a !== b,
    // « x in liste » ; aussi « mot in texte »
    In:    (a, b) => (Array.isArray(b) ? b.some(x => egal(x, a)) : typeof b === 'string' ? b.includes(a) : INCONNU),
    NotIn: (a, b) => (Array.isArray(b) ? !b.some(x => egal(x, a)) : typeof b === 'string' ? !b.includes(a) : INCONNU),
  };

  /** Valeur d'un nœud de l'arbre : un texte, un nombre, une liste… ou INCONNU. */
  function valeur(noeud, contexte) {
    if (!Array.isArray(noeud)) return INCONNU;
    const [type, ...args] = noeud;
    switch (type) {
      case 'Const': return args[0];
      case 'List': {
        const liste = args.map(n => valeur(n, contexte));
        return liste.includes(INCONNU) ? INCONNU : liste;
      }
      case 'Name':
        // choice : l'option ; rec : la ligne en cours ($Projet = rec.Projet)
        if (args[0] === 'choice') return contexte.choice;
        if (args[0] === 'rec') return contexte.rec;
        return INCONNU;
      case 'Attr': {
        // Attribut d'une LIGNE seulement (choice.Projet, $Projet). Sur un
        // numéro de référence ($Projet.Statut), il faudrait lire une autre
        // table : on ne sait pas.
        const objet = valeur(args[0], contexte);
        const estLigne = objet && typeof objet === 'object' && !Array.isArray(objet);
        if (!estLigne || !(args[1] in objet)) return INCONNU;
        return decoder(objet[args[1]]);
      }
      default:
        return evaluer(noeud, contexte);
    }
  }

  /** Résultat d'un nœud logique : true, false ou INCONNU. */
  function evaluer(noeud, contexte) {
    if (!Array.isArray(noeud)) return INCONNU;
    const [type, ...args] = noeud;
    if (type === 'And' || type === 'Or') {
      const resultats = args.map(n => verite(n, contexte));
      // « et » : un seul faux suffit ; « ou » : un seul vrai suffit
      const decisif = type === 'And' ? false : true;
      if (resultats.includes(decisif)) return decisif;
      return resultats.includes(INCONNU) ? INCONNU : !decisif;
    }
    if (type === 'Not') {
      const r = verite(args[0], contexte);
      return r === INCONNU ? INCONNU : !r;
    }
    if (COMPARAISONS[type]) {
      const a = valeur(args[0], contexte);
      const b = valeur(args[1], contexte);
      if (a === INCONNU || b === INCONNU) return INCONNU;
      return COMPARAISONS[type](a, b);
    }
    return INCONNU;   // opération inconnue
  }

  /** Un nœud vu comme vrai ou faux (une valeur seule : au sens de Python). */
  function verite(noeud, contexte) {
    const v = valeur(noeud, contexte);
    return v === INCONNU || typeof v === 'boolean' ? v : vrai(v);
  }

  /**
   * L'option doit-elle être proposée ? true, sauf si la condition est
   * CERTAINEMENT fausse pour elle (une condition inconnue la garde).
   * @param {Array|null} arbre - condition analysée par Grist (null : aucune)
   * @param {{choice, rec}} contexte - l'option et la ligne en cours
   */
  function garder(arbre, contexte) {
    if (!arbre) return true;
    try {
      return verite(arbre, contexte) !== false;
    } catch (_) {
      return true;   // arbre inattendu : on ne cache rien
    }
  }

  // Seul objet rendu visible au reste de la page.
  window.Condition = { garder };
})();
