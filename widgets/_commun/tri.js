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

   Il contient deux parties :
     1. la comparaison des valeurs (sans affichage) ;
     2. le panneau du tri (« Par… puis… », sens, ✕), commun au Kanban et à
        la Galerie (#232) : il se place dans l'onglet « Tri » de la fenêtre
        « Gérer la vue » (../_commun/vues.js). Styles : tri.css.

   UTILISATION (exemple)
     const infos = { date_cible: { type: 'Date' }, Priorite: { type: 'Choice', choix: ['Haute', 'Basse'] } };
     cartes.sort((a, b) => Tri.comparerLignes(a, b, criteres, infos));
     const panneau = Tri.creerPanneau({ zone, colonnes, typeDe, tri, remplacerTri, … });
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

  /* ── 2. Le panneau du tri (interface) ─────────────────────── */

  /** Colonne proposée pour trier sur le numéro de la ligne (#id), toujours en tête de liste. */
  const COLONNE_NUMERO = { colId: 'id', label: '# Numéro', type: 'Int' };

  /** Petit raccourci : crée un élément HTML avec ses propriétés (jamais de innerHTML). */
  function el(balise, proprietes = {}, ...enfants) {
    const e = document.createElement(balise);
    Object.assign(e, proprietes);
    e.append(...enfants);
    return e;
  }

  /**
   * Libellés des deux sens [croissant, décroissant], adaptés au type de la
   * colonne : « ↑ Ancienne / ↓ Récente » pour une date, etc.
   */
  function libellesSens(type) {
    if (/^Date/.test(type))            return ['↑ Ancienne', '↓ Récente'];
    if (/^(Int|Numeric)$/.test(type))  return ['↑ 1 → 9', '↓ 9 → 1'];
    if (/^Choice/.test(type))          return ['↑ Ordre Grist', '↓ Inverse'];
    if (type === 'Bool')               return ['↑ Non', '↓ Oui'];
    return ['↑ A → Z', '↓ Z → A'];
  }

  /**
   * Crée le panneau du tri dans `zone` : une ligne par critère (« Par »,
   * puis « puis »), avec la colonne, le sens et ✕ ; « ＋ Ajouter un
   * critère » et « Retirer le tri ». Un seul panneau par page (ses éléments
   * portent des identifiants fixes, #tri-criteres…). Styles : tri.css.
   *
   * Le panneau ne garde rien : le tri affiché appartient au widget, qui le
   * prête par o.tri() et le remplace par o.remplacerTri(). Chaque
   * changement donne une NOUVELLE liste (jamais modifiée sur place) : la
   * photographie prise par « Gérer la vue » reste intacte pour Annuler.
   *
   * @param {object} o
   * @param {HTMLElement} o.zone - où construire le panneau (l'onglet « Tri »)
   * @param {() => Array<{colId, label}>} o.colonnes - colonnes proposées
   *   (« # Numéro » est ajouté en tête par le module)
   * @param {(colId) => string} o.typeDe - type Grist d'une colonne (pour le libellé des sens)
   * @param {() => Array<{col, sens}>} o.tri - tri affiché du widget (lu à chaque fois)
   * @param {(liste) => void} o.remplacerTri - remplace ce tri
   * @param {() => string[]} [o.preferees] - colonnes proposées en premier par
   *   « ＋ Ajouter un critère » (le Kanban : échéance, puis priorité)
   * @param {HTMLElement} [o.bouton] - bouton-résumé de la barre (« ⇅ Échéance ↑ +1 »)
   * @param {string} [o.texteVide] - message quand aucun tri n'est choisi
   * @param {string} [o.aide] - phrase d'aide sous les critères (ordre par défaut, égalités)
   * @param {string} [o.bulleVide] - bulle du bouton-résumé quand aucun tri n'est choisi
   * @param {() => void} [o.surChangement] - le tri a changé : redessiner les cartes
   * @returns {{ remplir, majBouton, libelleColonne }}
   */
  function creerPanneau(o) {
    const preferees = o.preferees || (() => []);
    const surChangement = o.surChangement || (() => {});

    // ── Construction (mêmes identifiants que l'ancien HTML du Kanban)
    const criteres = el('div', { id: 'tri-criteres', className: 'tri-criteres' });
    const ajouter = el('button', { id: 'tri-ajouter', className: 'filtre-lien tri-ajouter', type: 'button',
      textContent: '＋ Ajouter un critère' });
    const aide = el('p', { className: 'vue-aide', textContent: o.aide || '' });
    const retirerTout = el('button', { id: 'tri-retirer-tout', className: 'filtre-lien danger', type: 'button',
      textContent: 'Retirer le tri' });
    o.zone.append(el('div', { id: 'tri-popover', className: 'filtre-popover tri-popover' },
      criteres, ajouter, aide, el('div', { className: 'filtre-pied' }, retirerTout)));

    /** Colonnes proposées : le numéro de la ligne, puis celles du widget. */
    const proposees = () => [COLONNE_NUMERO, ...o.colonnes()];

    function libelleColonne(colId) {
      const c = proposees().find(c => c.colId === colId);
      return c ? c.label : colId;
    }

    const typeDe = (colId) => (colId === 'id' ? 'Int' : String(o.typeDe(colId) || ''));

    /** Remplace le tri par `liste`, puis redessine le panneau, le bouton et les cartes. */
    function changer(liste) {
      o.remplacerTri(liste);
      remplir();
      surChangement();
    }

    /** Le critère n° i, modifié (copie) : { col } ou { sens }. */
    function modifier(i, modif) {
      changer(o.tri().map((c, j) => (j === i ? { ...c, ...modif } : c)));
    }

    /** Une ligne du panneau : « Par » / « puis », colonne, sens, ✕. */
    function ligneCritere(critere, i) {
      const choix = el('select', { className: 'filter-select', title: 'Colonne' });
      proposees().forEach(c => choix.append(el('option', { value: c.colId, textContent: c.label })));
      // Colonne enregistrée dans la vue mais absente de la table (renommée, supprimée)
      if (!proposees().some(c => c.colId === critere.col)) {
        choix.append(el('option', { value: critere.col, textContent: `${critere.col} (absente)` }));
      }
      choix.value = critere.col;
      choix.addEventListener('change', () => modifier(i, { col: choix.value }));

      const sens = el('div', { className: 'filtre-ops' });
      libellesSens(typeDe(critere.col)).forEach((libelle, j) => {
        const valeur = j === 0 ? 'asc' : 'desc';
        const bouton = el('button', { className: 'filtre-op' + (critere.sens === valeur ? ' actif' : ''),
          type: 'button', textContent: libelle });
        bouton.addEventListener('click', () => modifier(i, { sens: valeur }));
        sens.append(bouton);
      });

      const retirer = el('button', { className: 'filtre-chip-x tri-retirer', type: 'button',
        textContent: '✕', title: 'Retirer ce critère' });
      retirer.addEventListener('click', () => changer(o.tri().filter((_, j) => j !== i)));

      return el('div', { className: 'tri-critere' },
        el('span', { className: 'tri-rang', textContent: i === 0 ? 'Par' : 'puis' }), choix, sens, retirer);
    }

    /** (Re)dessine les critères et met à jour le bouton-résumé. */
    function remplir() {
      const tri = o.tri();
      criteres.innerHTML = '';
      if (!tri.length) {
        criteres.append(el('div', { className: 'filtre-aucune', textContent: o.texteVide || 'Aucun tri choisi.' }));
      }
      tri.forEach((critere, i) => criteres.append(ligneCritere(critere, i)));
      retirerTout.disabled = tri.length === 0;
      // Au-delà de CRITERES_MAX, un critère ne serait pas enregistré dans la vue
      ajouter.disabled = tri.length >= CRITERES_MAX;
      majBouton();
    }

    /**
     * Ajoute un critère : la première colonne « préférée » pas encore
     * utilisée, sinon la première colonne libre. On peut ensuite en
     * choisir une autre dans la liste.
     */
    function ajouterCritere() {
      const utilisees = o.tri().map(c => c.col);
      const libres = proposees().map(c => c.colId).filter(c => !utilisees.includes(c));
      const col = preferees().find(c => c && libres.includes(c)) || libres[0] || 'id';
      changer([...o.tri(), { col, sens: 'asc' }]);
    }

    /** Bouton-résumé de la barre : « ⇅ Trier », ou « ⇅ Échéance ↑ +1 ». */
    function majBouton() {
      if (!o.bouton) return;
      const tri = o.tri();
      const fleche = c => (c.sens === 'desc' ? '↓' : '↑');
      const [premier, ...autres] = tri;
      o.bouton.classList.toggle('actif', !!premier);
      o.bouton.textContent = premier
        ? `⇅ ${libelleColonne(premier.col)} ${fleche(premier)}${autres.length ? ` +${autres.length}` : ''}`
        : '⇅ Trier';
      o.bouton.title = premier
        ? 'Tri : ' + tri.map(c => `${libelleColonne(c.col)} ${fleche(c)}`).join(', puis ')
        : (o.bulleVide || 'Trier les cartes');
    }

    ajouter.addEventListener('click', ajouterCritere);
    retirerTout.addEventListener('click', () => changer([]));

    return { remplir, majBouton, libelleColonne };
  }

  // Seul objet rendu visible au reste de la page.
  window.Tri = { comparer, comparerLignes, nettoyer, CRITERES_MAX, COLONNE_NUMERO, creerPanneau };
})();
