/* ══════════════════════════════════════════════════════════════
   TRI — comparer deux valeurs de Grist selon le type de leur colonne
   ══════════════════════════════════════════════════════════════

   Un tri est une liste de critères, du plus important au moins important :
     [{ col: 'date_cible', sens: 'asc' }, { col: 'Priorite', sens: 'desc' }]
   Deux cartes sont comparées sur le premier critère ; en cas d'égalité, sur
   le suivant, etc.

   Comment chaque type est rangé (sens « croissant ») :
     - Choix, Choix multiple : dans l'ordre des choix déclarés dans Grist
       (ex. Haute, Moyenne, Basse), puis les valeurs inconnues de A à Z ;
       pour un choix multiple, c'est la première valeur qui compte ;
     - Nombre, Entier, Date, Date et heure, numéro de ligne : du plus petit
       au plus grand (de la date la plus ancienne à la plus récente) ;
     - Case à cocher : non, puis oui ;
     - Texte, Référence (nom affiché) et le reste : de A à Z, sans tenir
       compte des majuscules ni des accents, et « 2 » avant « 10 ».
   Les valeurs VIDES vont toujours à la fin, quel que soit le sens : on veut
   voir d'abord les cartes qui ont une échéance, une priorité…

   Ce module ne connaît AUCUN nom de table ni de colonne.

   UTILISATION (exemple)
     const infos = { date_cible: { type: 'Date' }, Priorite: { type: 'Choice', choix: ['Haute', 'Basse'] } };
     cartes.sort((a, b) => Tri.comparerLignes(a, b, criteres, infos));
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Comparaison de textes « à la française » : majuscules et accents
  // ignorés, nombres lus comme des nombres (« tâche 2 » avant « tâche 10 »)
  const COLLATEUR = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

  // Une cellule en erreur arrive comme un objet { name, message } ou « encodée » ['E', …]
  const estErreur = v => (Array.isArray(v) && v[0] === 'E')
    || (Boolean(v) && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && 'message' in v);

  /**
   * Clé de tri d'une valeur : null si elle est vide, sinon
   * { n: nombre } ou { t: texte }, ou les deux (choix inconnu : rang, puis texte).
   *   info : { type: 'Choice' | 'Date' | …, choix: [choix déclarés] } (facultatif)
   */
  function cle(valeur, info = {}) {
    const type = String(info.type || '');
    if (valeur === null || valeur === undefined || estErreur(valeur)) return null;

    // Liste (choix multiple, liste de références) : la première valeur compte.
    // Elle peut arriver « encodée » : ['L', a, b…]
    if (Array.isArray(valeur)) {
      const elements = valeur[0] === 'L' ? valeur.slice(1) : valeur;
      return elements.length ? cle(elements[0], { ...info, type: type.replace(/^ChoiceList$/, 'Choice') }) : null;
    }

    if (typeof valeur === 'string' && valeur.trim() === '') return null;

    if (type === 'Choice' || type === 'ChoiceList') {
      const rang = (info.choix || []).indexOf(valeur);
      return rang !== -1 ? { n: rang } : { n: (info.choix || []).length, t: String(valeur) };
    }
    if (type === 'Bool' || typeof valeur === 'boolean') return { n: valeur ? 1 : 0 };
    // Une référence vide vaut 0
    if (/^Ref(List)?:/.test(type) && valeur === 0) return null;
    if (valeur instanceof Date) return { n: valeur.getTime() / 1000 };
    if (typeof valeur === 'number') return Number.isFinite(valeur) ? { n: valeur } : null;
    // Date reçue en texte (« 2026-11-01 ») : convertie en secondes, comme Grist
    if (/^Date/.test(type)) {
      const ms = Date.parse(valeur);
      if (!Number.isNaN(ms)) return { n: ms / 1000 };
    }
    return { t: String(valeur).trim() };
  }

  /** Compare deux clés non vides (sens croissant). */
  function comparerCles(a, b) {
    const aNombre = a.n !== undefined, bNombre = b.n !== undefined;
    if (aNombre && bNombre && a.n !== b.n) return a.n - b.n;
    if (aNombre !== bNombre) return aNombre ? -1 : 1;   // nombres avant textes
    return COLLATEUR.compare(a.t || '', b.t || '');
  }

  /**
   * Compare deux valeurs d'une même colonne.
   *   sens : 'asc' (croissant, par défaut) ou 'desc' ; les vides restent à la fin
   * @returns {number} négatif si `a` passe avant `b`, positif après, 0 si égalité
   */
  function comparer(a, b, info = {}, sens = 'asc') {
    const ca = cle(a, info), cb = cle(b, info);
    if (ca === null || cb === null) return (ca === null) - (cb === null);
    const resultat = comparerCles(ca, cb);
    return sens === 'desc' ? -resultat : resultat;
  }

  /**
   * Compare deux lignes de Grist selon une liste de critères.
   *   criteres : [{ col, sens }] ; la colonne 'id' est le numéro de la ligne
   *   infos    : { colId: { type, choix } }
   */
  function comparerLignes(a, b, criteres, infos = {}) {
    for (const { col, sens } of criteres) {
      const r = comparer(a[col], b[col], col === 'id' ? { type: 'Int' } : infos[col], sens);
      if (r !== 0) return r;
    }
    return 0;
  }

  // Au-delà, un critère de plus ne départage plus rien ; la limite évite
  // qu'une vue modifiée à la main (options du document) ne ralentisse le widget.
  const CRITERES_MAX = 10;

  /**
   * Remet en forme une liste de critères venue d'ailleurs (options du
   * document, navigateur) : on ne garde que des critères bien formés, et
   * au plus CRITERES_MAX. Renvoie toujours une copie.
   */
  function nettoyer(criteres) {
    if (!Array.isArray(criteres)) return [];
    return criteres
      .filter(c => c && typeof c.col === 'string' && c.col !== '')
      .slice(0, CRITERES_MAX)
      .map(c => ({ col: c.col, sens: c.sens === 'desc' ? 'desc' : 'asc' }));
  }

  // Seul objet rendu visible au reste de la page.
  window.Tri = { comparer, comparerLignes, nettoyer, CRITERES_MAX };
})();
