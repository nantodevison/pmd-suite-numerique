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

   Ce module ne connaît AUCUN nom de table ni de colonne, et ne lit rien
   dans Grist. Les valeurs propres à un widget (« 👤 Moi » du Kanban) se
   branchent par le paramètre `remplacer` de ligneRespecte et `speciales`
   de valeursProposees.

   UTILISATION (exemple)
     const visibles = lignes.filter(l => filtres.every(f => Filtres.ligneRespecte(l, f)));
     const proposees = Filtres.valeursProposees(lignes, 'Priorite', filtre.valeurs);
       → [{ valeur: '', nb: 2 }, { valeur: 'Basse', nb: 5 }, …]
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
   * @returns {Array<{valeur:string, nb:number}>} « (vide) » en tête, puis ordre alphabétique
   */
  function valeursProposees(lignes, colId, dejaCochees = [], speciales = []) {
    const comptes = new Map();
    lignes.forEach(l => {
      const vals = valeursCellule(l[colId]);
      (vals.length ? vals : [VIDE]).forEach(v => comptes.set(v, (comptes.get(v) || 0) + 1));
    });
    dejaCochees.forEach(v => { if (!speciales.includes(v) && !comptes.has(v)) comptes.set(v, 0); });
    return [...comptes.entries()]
      .map(([valeur, nb]) => ({ valeur, nb }))
      .sort((a, b) => a.valeur === VIDE ? -1 : b.valeur === VIDE ? 1 : a.valeur.localeCompare(b.valeur, 'fr'));
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

  // Seul objet rendu visible au reste de la page.
  window.Filtres = {
    VIDE, LIBELLE_VIDE,
    valeursCellule, ligneRespecte, valeursProposees, copier, signature,
    texteAttribut, morceauxParValeur, texteMorceaux, memoireAttributs,
  };
})();
