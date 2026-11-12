/* ══════════════════════════════════════════════════════════════
   FILTRES — règle de filtrage commune aux widgets (Kanban, Galerie…)
   ══════════════════════════════════════════════════════════════

   Un filtre est une condition { col, op, valeurs } :
     col     : identifiant Grist de la colonne (ex. 'EPIC', 'qui_') ;
     op      : 'est' ou 'nestpas' ;
     valeurs : valeurs cochées ; Filtres.VIDE désigne les cellules vides.
   Une ligne respecte une condition si l'UNE de ses valeurs est cochée
   (« ou » entre les valeurs) ; elle doit respecter TOUTES les conditions
   (« et » entre les filtres). Une condition sans valeur cochée est ignorée.

   Attributs d'une référence (#223, #226) : à côté de chaque valeur d'une
   référence (ex. un EPIC), on peut afficher des attributs de l'objet visé
   (ex. sa priorité), lus dans les colonnes « rapportées » de la table
   ($EPIC.Priorite). Le choix des attributs est retenu par le navigateur.

   Panneau (#191, étape 2) : Filtres.creerPanneau construit les étiquettes
   des filtres, « ＋ Filtre » et l'éditeur d'un filtre ; styles dans
   filtres.css. Un choix coloré dans Grist s'y affiche en pastille, et les
   valeurs d'une colonne Choix suivent l'ordre des choix (#236).

   Ce module ne connaît AUCUN nom de table ni de colonne, et ne lit rien
   dans Grist. Les valeurs propres à un widget (« 👤 Moi » du Kanban) se
   branchent par le paramètre `remplacer` de ligneRespecte, et par les
   options valeursProposees, libelleValeur et classeValeur du panneau.

   UTILISATION (exemple)
     const visibles = lignes.filter(l => filtres.every(f => Filtres.ligneRespecte(l, f)));
     const proposees = Filtres.valeursProposees(lignes, 'Priorite', filtre.valeurs);
       → [{ valeur: '', nb: 2 }, { valeur: 'Basse', nb: 5 }, …]
     const panneau = Filtres.creerPanneau({ zone, colonnes, filtres, remplacerFiltres, lignes, … });
     panneau.ajouter();   // nouveau filtre, éditeur ouvert
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. La règle ───────────────────────────────────────────── */

  /** Valeur qui représente une cellule vide (jamais produite par une vraie valeur). */
  const VIDE = '';
  const LIBELLE_VIDE = '(vide)';

  /**
   * Valeurs d'une cellule, nettoyées, sous forme de liste ([] = cellule vide).
   * Rend équivalentes les valeurs dont le sens est le même :
   *   null, '', '   ', [] et 0 (référence vide) → [] ;
   *   ' Alice  Durand ' → 'Alice Durand' (espaces en trop retirés).
   * Les majuscules sont conservées : deux choix « Fait » et « fait » restent distincts.
   */
  function valeursCellule(valeur) {
    const brutes = Array.isArray(valeur) ? valeur : [valeur];
    const propres = brutes
      .filter(v => v !== null && v !== undefined && v !== 0)
      .map(v => String(v).replace(/\s+/g, ' ').trim())
      .filter(v => v !== '');
    return [...new Set(propres)];
  }

  /**
   * Une ligne respecte-t-elle un filtre ?
   * @param {(valeurs: string[]) => string[]} [remplacer] - transforme les
   *   valeurs cochées avant la comparaison : c'est là qu'un widget remplace
   *   une valeur spéciale (« 👤 Moi » → nom de la personne déclarée).
   */
  function ligneRespecte(ligne, filtre, remplacer = (v) => v) {
    if (filtre.valeurs.length === 0) return true; // condition incomplète : ignorée
    const valeurs = remplacer(filtre.valeurs);
    const vals = valeursCellule(ligne[filtre.col]);
    const cochee = vals.length === 0
      ? valeurs.includes(VIDE)
      : vals.some(v => valeurs.includes(v));
    return filtre.op === 'nestpas' ? !cochee : cochee;
  }

  /**
   * Valeurs proposées pour une colonne : celles présentes dans `lignes`, avec
   * leur nombre de lignes, plus les valeurs déjà cochées (pour pouvoir les
   * décocher même si plus aucune ligne ne les porte), sauf les `speciales`,
   * que le widget ajoute lui-même.
   * @param {string[]} [choix] - choix déclarés dans Grist (colonne Choix) :
   *   ils passent dans leur ordre, avant les autres valeurs (#236)
   * @returns {Array<{valeur:string, nb:number}>} « (vide) » en tête, puis les
   *   choix dans l'ordre de Grist, puis les autres valeurs de A à Z
   */
  function valeursProposees(lignes, colId, dejaCochees = [], speciales = [], choix = []) {
    const comptes = new Map();
    lignes.forEach(l => {
      const vals = valeursCellule(l[colId]);
      (vals.length ? vals : [VIDE]).forEach(v => comptes.set(v, (comptes.get(v) || 0) + 1));
    });
    dejaCochees.forEach(v => { if (!speciales.includes(v) && !comptes.has(v)) comptes.set(v, 0); });
    // Rang d'une valeur : (vide) d'abord, puis l'ordre des choix, puis les autres
    const rang = (v) => {
      if (v === VIDE) return -1;
      const i = (choix || []).indexOf(v);
      return i === -1 ? Infinity : i;
    };
    return [...comptes.entries()]
      .map(([valeur, nb]) => ({ valeur, nb }))
      .sort((a, b) => (rang(a.valeur) - rang(b.valeur)) || a.valeur.localeCompare(b.valeur, 'fr'));
  }

  /** Copie indépendante d'une liste de filtres (pour une vue, une annulation…). */
  function copier(filtres) {
    return (filtres || []).map(f => ({ col: f.col, op: f.op, valeurs: [...f.valeurs] }));
  }

  /** Résumé comparable d'une liste de filtres (filtres vides et ordre des valeurs ignorés). */
  function signature(filtres) {
    return JSON.stringify((filtres || [])
      .filter(f => f.valeurs.length > 0)
      .map(f => [f.col, f.op, [...f.valeurs].sort()]));
  }

  /* ── 2. Attributs d'une référence (#223, #226) ─────────────── */

  /**
   * Texte lisible d'une cellule d'attribut : dates en jj/mm/aaaa (Grist les
   * envoie en secondes depuis 1970), case cochée en ✓, listes séparées par
   * des virgules. '' si la cellule est vide.
   */
  function texteAttribut(valeur, type) {
    if (valeur === null || valeur === undefined || valeur === '') return '';
    if (Array.isArray(valeur)) return valeur.map(v => texteAttribut(v, type)).filter(Boolean).join(', ');
    if (/^Date/.test(type) && typeof valeur === 'number') {
      return new Date(valeur * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
    }
    if (type === 'Bool') return valeur ? '✓' : '';
    return String(valeur).replace(/\s+/g, ' ').trim();
  }

  /**
   * Attributs de chaque valeur de la référence `colId` :
   * Map « nom de la valeur » → morceaux [[{ texte, style }…] par attribut].
   * Lus dans les `lignes` qui portent cette valeur ; si elles ne sont pas
   * d'accord, toutes les valeurs rencontrées sont données.
   * Liste de références (ex. qui_) : la colonne rapportée ($qui_.Equipe) donne
   * une liste dans le même ordre que les personnes ; on les apparie une à une.
   * @param {Array<{colId, type}>} attributs - colonnes rapportées à afficher
   * @param {(colId, texte) => ({fond, texte}|null)} [styleChoix] - couleur Grist d'un choix
   */
  function morceauxParValeur(lignes, colId, attributs, styleChoix = () => null) {
    const textes = new Map(); // valeur → [Set de textes, par attribut]
    if (attributs.length) {
      // Une liste peut arriver « encodée » par Grist : ['L', a, b…] → [a, b…]
      const decoder = (v) => (Array.isArray(v) && v[0] === 'L') ? v.slice(1) : v;
      lignes.forEach(l => {
        const brute = decoder(l[colId]);
        const liste = Array.isArray(brute);
        const noms = liste ? brute : [brute];
        noms.forEach((nom, k) => {
          const v = valeursCellule(nom)[0];
          if (v === undefined) return;
          if (!textes.has(v)) textes.set(v, attributs.map(() => new Set()));
          attributs.forEach((a, i) => {
            const cellule = decoder(l[a.colId]);
            // Même longueur que la liste des références : la k-ième va avec la k-ième
            const propre = liste && Array.isArray(cellule) && cellule.length === brute.length ? cellule[k] : cellule;
            const t = texteAttribut(propre, a.type);
            if (t) textes.get(v)[i].add(t);
          });
        });
      });
    }
    const resultat = new Map();
    textes.forEach((ensembles, v) => {
      resultat.set(v, ensembles
        .map((e, i) => [...e].map(t => ({ texte: t, style: styleChoix(attributs[i].colId, t) })))
        .filter(m => m.length));
    });
    return resultat;
  }

  /** Texte entier des morceaux (« Then · Cerema »), pour la recherche et la bulle. */
  function texteMorceaux(morceaux) {
    return morceaux.map(m => m.map(x => x.texte).join(', ')).join(' · ');
  }

  /**
   * Mémoire des attributs affichés, colonne par colonne, retenue par le
   * navigateur (localStorage) : chacun la sienne, rien dans le document.
   * @param {() => string|null} cleMemoire - clé de stockage du moment ; elle
   *   peut changer (document ou projet connus plus tard) : la mémoire est
   *   alors relue. null = inconnue, le choix ne vaut que pour la séance.
   */
  function memoireAttributs(cleMemoire) {
    let lus = null;   // { colId: [colId d'attribut…] } ; null = pas encore relu
    let cleLue = null;

    function assurer() {
      const cle = cleMemoire();
      if (lus && cleLue === cle) return;
      lus = {};
      cleLue = cle;
      try {
        const memoire = cle && JSON.parse(localStorage.getItem(cle) || '{}');
        if (memoire && typeof memoire === 'object') lus = memoire;
      } catch (err) { /* mémoire indisponible : rien d'affiché par défaut */ }
    }

    return {
      /** Attributs affichés pour `colId`, limités aux `possibles` (ceux qui existent encore). */
      affiches(colId, possibles) {
        assurer();
        return (lus[colId] || []).filter(a => possibles.includes(a));
      },
      /** Retient les attributs `choisis`, dans l'ordre des `possibles` plutôt que des clics. */
      definir(colId, choisis, possibles) {
        assurer();
        lus[colId] = possibles.filter(a => choisis.includes(a));
        try {
          if (!cleLue) throw new Error('document inconnu');
          localStorage.setItem(cleLue, JSON.stringify(lus));
        } catch (err) { /* le choix vaut pour la séance seulement */ }
      },
    };
  }

  /* ── 3. Le panneau des filtres (interface) ─────────────────── */

  /** Petit raccourci : crée un élément HTML avec ses propriétés (jamais de innerHTML). */
  function el(balise, proprietes = {}, ...enfants) {
    const e = document.createElement(balise);
    Object.assign(e, proprietes);
    e.append(...enfants);
    return e;
  }

  /**
   * Crée le panneau des filtres dans `zone` : étiquettes des filtres
   * (« EPIC est : A, B ✕ »), bouton « ＋ Filtre », et éditeur d'un filtre
   * (colonne, est / n'est pas, recherche, valeurs à cocher, attributs).
   * Un seul panneau par page (ses éléments portent des identifiants fixes,
   * #filtre-popover…). Styles : filtres.css.
   *
   * @param {object} o
   * @param {HTMLElement} o.zone - où construire le panneau
   * @param {() => Array<{colId, label}>} o.colonnes - colonnes filtrables
   * @param {() => object[]} o.filtres - liste des filtres du widget (lue à chaque fois)
   * @param {(liste) => void} o.remplacerFiltres - remplace cette liste
   * @param {() => object[]} o.lignes - lignes comptées et lues pour les attributs
   * @param {(colId, cochees) => Array<{valeur, nb}>} [o.valeursProposees] - à
   *   fournir pour ajouter des valeurs spéciales (« 👤 Moi ») ; par défaut,
   *   Filtres.valeursProposees sur o.lignes() et o.choixDe(colId)
   * @param {(colId) => string[]|undefined} [o.choixDe] - choix déclarés (ordre, #236)
   * @param {(colId, texte) => ({fond, texte}|null)} [o.styleChoix] - couleur Grist d'un choix
   * @param {(valeur, detaille) => string} [o.libelleValeur] - texte d'une valeur
   * @param {(valeur) => string} [o.classeValeur] - classe CSS en plus pour une valeur ('moi'…)
   * @param {(colId) => Array<{colId, attribut, type}>} [o.attributsDe] - colonnes rapportées d'une référence
   * @param {object} [o.memoire] - mémoire des attributs (Filtres.memoireAttributs)
   * @param {() => void} [o.surChangement] - les filtres ont changé : redessiner les lignes
   * @param {() => void} [o.surEtiquettes] - les étiquettes viennent d'être redessinées
   */
  function creerPanneau(o) {
    const libelleValeur = o.libelleValeur || ((v) => v === VIDE ? LIBELLE_VIDE : v);
    const classeValeur  = o.classeValeur  || (() => '');
    const choixDe       = o.choixDe       || (() => undefined);
    const styleChoix    = o.styleChoix    || (() => null);
    const attributsDe   = o.attributsDe   || (() => []);
    const surChangement = o.surChangement || (() => {});
    const surEtiquettes = o.surEtiquettes || (() => {});
    const proposer = o.valeursProposees
      || ((colId, cochees) => valeursProposees(o.lignes(), colId, cochees, [], choixDe(colId)));

    let edite = null;   // filtre en cours de modification (null : panneau fermé)
    let ordre = [];     // valeurs du panneau : [{ valeur, nb, morceaux, detail }]

    // ── Construction (mêmes identifiants et classes que l'ancien HTML du Kanban)
    const etiquettes = el('div', { id: 'filtres-actifs', className: 'filtres-actifs' });
    const ajouter = el('button', { id: 'filtre-ajouter', className: 'filtre-ajouter', type: 'button', textContent: '＋ Filtre' });
    const colonne = el('select', { id: 'filtre-colonne', className: 'filter-select', title: 'Colonne' });
    const ops = el('div', { className: 'filtre-ops' });
    [['est', 'est'], ['nestpas', "n'est pas"]].forEach(([op, texte]) => {
      const b = el('button', { className: 'filtre-op', type: 'button', textContent: texte });
      b.dataset.op = op;
      ops.append(b);
    });
    const recherche = el('input', { id: 'filtre-recherche', className: 'filtre-recherche', type: 'search',
      placeholder: 'Rechercher…', autocomplete: 'off' });
    const tout   = el('button', { id: 'filtre-tout',  className: 'filtre-lien', type: 'button', textContent: 'Tout cocher' });
    const aucun  = el('button', { id: 'filtre-aucun', className: 'filtre-lien', type: 'button', textContent: 'Aucun' });
    const compte = el('span',   { id: 'filtre-compte', className: 'filtre-compte' });
    // « Afficher ▾ » : attributs d'une référence (#223, #226)
    const afficher = el('button', { id: 'filtre-afficher', className: 'filtre-afficher hidden', type: 'button' });
    const valeurs = el('div', { id: 'filtre-valeurs', className: 'filtre-valeurs' });
    const supprimerBouton = el('button', { id: 'filtre-supprimer', className: 'filtre-lien danger', type: 'button',
      textContent: 'Supprimer le filtre' });
    const pop = el('div', { id: 'filtre-popover', className: 'filtre-popover hidden' },
      // Ligne 1 (#226) : colonne, opérateur, recherche (qui passe à la ligne si la place manque)
      el('div', { className: 'filtre-entete' }, colonne, ops, recherche),
      // Ligne 2 (#226) : outils et compteur à gauche, « Afficher » à droite
      el('div', { className: 'filtre-outils' }, tout, aucun, compte, afficher),
      valeurs,
      el('div', { className: 'filtre-pied' }, supprimerBouton));
    o.zone.append(el('div', { className: 'filtres-tete' }, etiquettes, ajouter), pop);

    const libelleColonne = (colId) => (o.colonnes().find(c => c.colId === colId) || {}).label || colId;
    const texteOp = (op) => op === 'est' ? 'est' : "n'est pas";

    /** Résumé d'un filtre : « EPIC est : A, B » (… si aucune valeur cochée). */
    function resume(filtre, vide = '…') {
      const noms = filtre.valeurs.map(v => libelleValeur(v));
      return `${libelleColonne(filtre.col)} ${texteOp(filtre.op)} : ${noms.join(', ') || vide}`;
    }

    // ── Attributs (#223, #226)
    const possibles = (colId) => attributsDe(colId).map(c => c.colId);
    const attributsAffiches = (colId) => o.memoire ? o.memoire.affiches(colId, possibles(colId)) : [];

    /** Attributs de chaque valeur du panneau : p.morceaux (affichage), p.detail (recherche, bulle). */
    function calculerDetails() {
      const attributs = attributsAffiches(edite.col)
        .map(a => attributsDe(edite.col).find(c => c.colId === a)).filter(Boolean);
      const parValeur = morceauxParValeur(o.lignes(), edite.col, attributs, styleChoix);
      ordre.forEach(p => {
        p.morceaux = parValeur.get(p.valeur) || [];
        p.detail = texteMorceaux(p.morceaux);
      });
    }

    /** Retient les attributs choisis ; le panneau, s'il montre cette colonne, suit. */
    function definirAttributs(colId, choisis) {
      if (o.memoire) o.memoire.definir(colId, choisis, possibles(colId));
      if (edite && edite.col === colId) { calculerDetails(); remplir(); }
    }

    /** Bouton « Afficher (n) ▾ » : caché sans attribut possible ; (n) = attributs affichés. */
    function majAfficher() {
      const tous = attributsDe(edite.col);
      const choisis = attributsAffiches(edite.col);
      afficher.classList.toggle('hidden', tous.length === 0);
      afficher.classList.toggle('actif', choisis.length > 0);
      afficher.textContent = choisis.length ? `Afficher (${choisis.length}) ▾` : 'Afficher ▾';
      afficher.title = choisis.length
        ? 'Attributs affichés à côté de chaque valeur : '
          + tous.filter(c => choisis.includes(c.colId)).map(c => c.attribut).join(', ')
          + ' (retenu par ce navigateur)'
        : 'Afficher des attributs à côté de chaque valeur (retenu par ce navigateur)';
    }

    // ── Étiquettes

    /** Redessine les étiquettes (« EPIC n'est pas : A, B ✕ ») et l'état de « ＋ Filtre ». */
    function dessinerEtiquettes() {
      etiquettes.replaceChildren();
      o.filtres().forEach(filtre => {
        const chip = el('button', {
          className: 'filtre-chip' + (filtre === edite ? ' actif' : ''),
          type: 'button',
          title: resume(filtre, '—'),
          textContent: resume(filtre),
        });
        chip.addEventListener('click', () => ouvrir(filtre));
        const croix = el('span', { className: 'filtre-chip-x', textContent: '✕', title: 'Retirer ce filtre' });
        croix.addEventListener('click', (e) => { e.stopPropagation(); supprimer(filtre); });
        chip.append(croix);
        etiquettes.append(chip);
      });
      ajouter.disabled = o.colonnes().length === 0;
      ajouter.title = ajouter.disabled ? 'Aucune colonne Choix ou Référence dans la table' : 'Ajouter un filtre';
      surEtiquettes();
    }

    // ── Ouvrir, fermer, ajouter, supprimer

    /** Crée un filtre sur la première colonne pas encore filtrée, puis l'ouvre. */
    function ajouterFiltre() {
      const colonnes = o.colonnes();
      if (colonnes.length === 0) return;
      fermer();
      const dejaFiltrees = o.filtres().map(f => f.col);
      const c = colonnes.find(c => !dejaFiltrees.includes(c.colId)) || colonnes[0];
      const filtre = { col: c.colId, op: 'est', valeurs: [] };
      o.filtres().push(filtre);
      ouvrir(filtre);
    }

    function supprimer(filtre) {
      if (edite === filtre) fermer();
      o.remplacerFiltres(o.filtres().filter(f => f !== filtre));
      surChangement();
    }

    /** Affiche l'éditeur d'un filtre, sous les étiquettes. */
    function ouvrir(filtre) {
      if (edite && edite !== filtre) fermer();
      edite = filtre;
      colonne.replaceChildren(...o.colonnes().map(c => el('option', { value: c.colId, textContent: c.label })));
      colonne.value = filtre.col;
      recherche.value = '';
      calculerOrdre();
      remplir();
      pop.classList.remove('hidden');
      recherche.focus();
      dessinerEtiquettes();
    }

    /** Ferme l'éditeur ; un filtre laissé sans valeur cochée est retiré. */
    function fermer() {
      pop.classList.add('hidden');
      if (!edite) return;
      if (window.Fiche) Fiche.fermerMenu();   // la liste « Afficher » (#226), si elle est ouverte
      edite = null;
      o.remplacerFiltres(o.filtres().filter(f => f.valeurs.length > 0));
      dessinerEtiquettes();
    }

    // ── Valeurs

    /**
     * Fige l'ordre d'affichage des valeurs : les cochées d'abord, puis les
     * autres. Calculé à l'ouverture seulement, pour que la liste ne saute pas
     * sous la souris à chaque case cochée.
     */
    function calculerOrdre() {
      const proposees = proposer(edite.col, edite.valeurs);
      ordre = [
        ...proposees.filter(p => edite.valeurs.includes(p.valeur)),
        ...proposees.filter(p => !edite.valeurs.includes(p.valeur)),
      ];
      calculerDetails();
    }

    /** Valeurs affichées compte tenu de la recherche (qui porte aussi sur les attributs, #223). */
    function visibles() {
      return ordre.filter(p => window.Recherche
        ? Recherche.correspond(recherche.value, Recherche.simplifier(`${libelleValeur(p.valeur, true)} ${p.detail || ''}`))
        : true);
    }

    /** (Re)dessine opérateur, cases à cocher et compteur. */
    function remplir() {
      ops.querySelectorAll('.filtre-op').forEach(b => b.classList.toggle('actif', b.dataset.op === edite.op));
      majAfficher();
      valeurs.replaceChildren();
      const liste = visibles();
      liste.forEach(({ valeur, nb, detail, morceaux }) => {
        const special = classeValeur(valeur);
        const caseACocher = el('input', { type: 'checkbox', checked: edite.valeurs.includes(valeur) });
        caseACocher.addEventListener('change', () => basculer(valeur, caseACocher.checked));
        const texte = libelleValeur(valeur, true);
        const nom = el('span', { className: 'filtre-valeur-nom', title: texte });
        // Choix coloré dans Grist (#236) : en pastille, comme dans Grist
        const style = valeur === VIDE || special ? null : styleChoix(edite.col, valeur);
        if (style) {
          const pastille = el('span', { className: 'filtre-valeur-pastille', textContent: texte });
          pastille.style.background = style.fond || '';
          pastille.style.color = style.texte || '';
          nom.append(pastille);
        } else {
          nom.textContent = texte;
        }
        // Attributs affichés (#223), en gris ou aux couleurs de Grist ; le texte entier au survol
        const attributs = el('span', { className: 'filtre-valeur-detail', title: detail || '' });
        if (window.Fiche) Fiche.dessinerAttributs(attributs, morceaux || []);
        const nombre = el('span', { className: 'filtre-valeur-nb', textContent: nb });
        valeurs.append(el('label', {
          className: 'filtre-valeur' + (valeur === VIDE ? ' vide' : special ? ' ' + special : ''),
        }, caseACocher, nom, attributs, nombre));
      });
      if (liste.length === 0) {
        valeurs.append(el('div', { className: 'filtre-aucune', textContent: 'Aucune valeur ne correspond.' }));
      }
      majCompte();
    }

    /** Compteur « n cochées sur m ». */
    function majCompte() {
      const n = edite.valeurs.length;
      compte.textContent = `${n} cochée${n > 1 ? 's' : ''} sur ${ordre.length}`;
    }

    function basculer(valeur, cochee) {
      edite.valeurs = edite.valeurs.filter(v => v !== valeur);
      if (cochee) edite.valeurs.push(valeur);
      majCompte();
      surChangement();
    }

    /** « Tout cocher » / « Aucun » : n'agit que sur les valeurs visibles (après recherche). */
    function cocherVisibles(cochee) {
      const vues = visibles().map(p => p.valeur);
      edite.valeurs = edite.valeurs.filter(v => !vues.includes(v));
      if (cochee) edite.valeurs.push(...vues);
      remplir();
      surChangement();
    }

    // ── Événements
    ajouter.addEventListener('click', ajouterFiltre);
    colonne.addEventListener('change', () => {
      // Nouvelle colonne : les valeurs cochées n'ont plus de sens, on repart de zéro
      edite.col = colonne.value;
      edite.valeurs = [];
      recherche.value = '';
      calculerOrdre();
      remplir();
      surChangement();
    });
    ops.querySelectorAll('.filtre-op').forEach(b => b.addEventListener('click', () => {
      edite.op = b.dataset.op;
      remplir();
      surChangement();
    }));
    recherche.addEventListener('input', remplir);
    tout.addEventListener('click', () => cocherVisibles(true));
    aucun.addEventListener('click', () => cocherVisibles(false));
    supprimerBouton.addEventListener('click', () => supprimer(edite));
    // Liste à cocher des attributs, sous « Afficher » : reste ouverte tant
    // qu'on coche (menu « multiple » de fiche.js), se ferme par un clic ailleurs ou Échap
    afficher.addEventListener('click', () => {
      if (!edite || !window.Fiche) return;
      const col = edite.col;
      Fiche.menuChoix(afficher, {
        options: attributsDe(col).map(c => ({ valeur: c.colId, libelle: c.attribut })),
        selection: attributsAffiches(col),
        multiple: true,
        surChoix: (choisis) => definirAttributs(col, choisis),
      });
    });

    return {
      ouvrir, fermer, supprimer, resume, dessinerEtiquettes, definirAttributs, attributsAffiches,
      ajouter: ajouterFiltre,
      /** Filtre en cours de modification, ou null. */
      edite: () => edite,
    };
  }

  // Seul objet rendu visible au reste de la page.
  window.Filtres = {
    VIDE, LIBELLE_VIDE,
    valeursCellule, ligneRespecte, valeursProposees, copier, signature,
    texteAttribut, morceauxParValeur, texteMorceaux, memoireAttributs,
    creerPanneau,
  };
})();
