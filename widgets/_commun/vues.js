/* ══════════════════════════════════════════════════════════════
   VUES — vues enregistrées communes aux widgets (Kanban, Galerie…)
   ══════════════════════════════════════════════════════════════

   Une vue est un réglage nommé de l'affichage :
     { id: 'vue-…', nom: 'À faire', filtres: [...], tri: [...], … }
   Les filtres suivent le format de filtres.js, le tri celui de tri.js. Un
   widget peut y ranger ses propres champs (le Kanban : `colonnes`) : ce
   module les garde tels quels, sans les lire.

   Trois genres de vues :
     - « Toutes les cartes » : fixe, jamais enregistrée, ne se modifie pas
       (identifiant Vues.DEFAUT) ;
     - vues 👥 partagées : la même pour tous, gardées dans les options du
       widget (document Grist). Elles sont écrites dans le widget, mais
       Grist ne les garde qu'après un clic sur son bouton « Enregistrer » ;
     - vues 🔒 personnelles (`perso: true`) : gardées par le navigateur
       (localStorage), propres à chacun, enregistrées aussitôt.

   Contexte (#214) : une vue partagée retient le contexte du widget (le
   projet du Kanban, dans le champ `projet`) et n'apparaît qu'avec lui. Une
   vue sans contexte est visible partout. Le registre garde TOUJOURS toutes
   les vues partagées, même masquées : sinon elles seraient effacées du
   document à la prochaine écriture. Les vues perso, elles, sont déjà
   rangées par contexte, grâce à leur clé de mémoire.

   Le navigateur retient aussi la vue active : chacun retrouve l'onglet qu'il
   regardait. localStorage peut être refusé (navigation privée, Custom
   Widget Builder…) : chaque accès est protégé.

   Ce module ne connaît AUCUN nom de table ni de colonne, ne dessine rien et
   ne touche ni aux filtres ni au tri affichés : c'est le widget qui les
   applique quand la vue active change.

   UTILISATION (exemple)
     const vues = Vues.creer({
       cle: (nom) => `galerie.${nom}.${doc}.${table}`,   // clés de mémoire
       contexte: () => null,                               // pas de contexte
       prevenir: (message) => showToast(message),
     });
     vues.charger(options.vues);          // à l'ouverture
     vues.activer(id);                    // puis appliquer vues.active().filtres…
     vues.ajouter(vues.construire('À faire', true, { filtres, tri }));
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const DEFAUT = 'defaut';

  /**
   * Crée le registre des vues d'un widget.
   * @param {object}   o
   * @param {function} o.cle             - (nom) → clé de mémoire du navigateur pour
   *                                       'vueActive' ou 'vuesPerso', ou null si elle est
   *                                       encore inconnue (document pas encore lu)
   * @param {function} [o.contexte]      - () → contexte actuel (ex. numéro du projet), ou null
   * @param {function} [o.ecrirePartagees] - (liste) → Promise : écrit les vues partagées
   *                                       (par défaut dans l'option « vues » du widget)
   * @param {function} [o.prevenir]      - (message, durée) : signale un échec à l'utilisateur
   * @param {object}   [o.defaut]        - champs de « Toutes les cartes » propres au widget
   *                                       (le Kanban : { colonnes: null })
   */
  function creer(o) {
    const contexte = o.contexte || (() => null);
    const ecrirePartagees = o.ecrirePartagees || ((liste) => grist.setOption('vues', liste));
    const prevenir = o.prevenir || (() => {});
    const VUE_DEFAUT = { id: DEFAUT, nom: 'Toutes les cartes', filtres: [], tri: [], ...(o.defaut || {}), defaut: true };

    let liste = [];          // toutes les vues : partagées (même masquées), puis perso
    let active = DEFAUT;     // identifiant de la vue active

    /* ── Mémoire du navigateur ── */

    function lireMemoire(nom) {
      const cle = o.cle(nom);
      if (!cle) return null;
      try { return localStorage.getItem(cle); }
      catch (err) { return null; }
    }

    /** Vues perso retenues par ce navigateur ([] si aucune ou mémoire indisponible). */
    function lirePerso() {
      try {
        const vues = JSON.parse(lireMemoire('vuesPerso') || '[]');
        return Array.isArray(vues) ? vues.map(v => ({ ...v, perso: true })) : [];
      } catch (err) {
        return [];
      }
    }

    function memoriserPerso() {
      const cle = o.cle('vuesPerso');
      try {
        if (!cle) throw new Error('document inconnu');
        localStorage.setItem(cle, JSON.stringify(liste.filter(v => v.perso)));
      } catch (err) {
        prevenir('⚠️ Ce navigateur ne peut pas retenir vos vues personnelles : elles seront perdues au rechargement.', 3500);
      }
    }

    function memoriserActive() {
      const cle = o.cle('vueActive');
      if (!cle) return;
      try { localStorage.setItem(cle, active); }
      catch (err) { /* mémoire indisponible : l'onglet ne sera pas retenu */ }
    }

    /* ── Lecture ── */

    /** Cette vue s'affiche-t-elle dans le contexte actuel ? */
    function visible(vue) {
      const ctx = contexte();
      return !vue.projet || !ctx || vue.projet === ctx;
    }

    /** La vue visible d'identifiant `id` (« Toutes les cartes » comprise), ou undefined. */
    function trouver(id) {
      return id === DEFAUT ? VUE_DEFAUT : liste.find(v => v.id === id && visible(v));
    }

    /** « Toutes les cartes », puis les partagées et les perso, par ordre alphabétique dans chaque groupe. */
    function rangees() {
      const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr');
      return [VUE_DEFAUT,
              ...liste.filter(v => !v.perso && visible(v)).sort(parNom),
              ...liste.filter(v => v.perso).sort(parNom)];
    }

    /**
     * Ouverture du widget : vues partagées lues dans les options, puis vues
     * perso de ce navigateur. Vue active : la première connue parmi celle
     * retenue par ce navigateur et les `candidats` donnés (anciens réglages),
     * sinon « Toutes les cartes ».
     */
    function charger(partagees, ...candidats) {
      liste = (Array.isArray(partagees) ? partagees : []).concat(lirePerso());
      active = [lireMemoire('vueActive'), ...candidats].find(id => trouver(id)) || DEFAUT;
    }

    /**
     * Le contexte ou les clés de mémoire ont changé (autre projet) : relit les
     * vues perso. Renvoie true si la vue active n'existe plus : on revient
     * alors à « Toutes les cartes », et le widget doit en appliquer les filtres.
     */
    function relirePerso() {
      liste = liste.filter(v => !v.perso).concat(lirePerso());
      if (trouver(active)) return false;
      active = DEFAUT;
      return true;
    }

    /* ── Écriture ── */

    /**
     * Mémorise les vues du même genre que `vue` (créée, modifiée ou supprimée) :
     * les perso dans le navigateur, les partagées dans les options du widget.
     * Ainsi, toucher à une vue perso n'allume pas « Enregistrer » dans Grist.
     */
    function enregistrer(vue) {
      if (vue.perso) { memoriserPerso(); return; }
      Promise.resolve()
        .then(() => ecrirePartagees(liste.filter(v => !v.perso)))
        .catch(() => prevenir('⚠️ Vue non enregistrée : droits de modification du document nécessaires ?', 3500));
    }

    /** Rend `id` active et la fait retenir par le navigateur (le widget applique ensuite ses filtres). */
    function activer(id) {
      active = trouver(id) ? id : DEFAUT;
      memoriserActive();
    }

    /**
     * Nouvelle vue (pas encore ajoutée). `contenu` : filtres, tri et champs
     * propres au widget, déjà copiés par lui. Une vue partagée retient le
     * contexte actuel ; une perso, non (sa clé de mémoire la range déjà).
     */
    function construire(nom, perso, contenu = {}) {
      const vue = { id: 'vue-' + Date.now().toString(36), nom, ...contenu };
      if (perso) vue.perso = true;
      else if (contexte()) vue.projet = contexte();
      return vue;
    }

    /** Ajoute `vue`, la mémorise à sa place et la rend active. */
    function ajouter(vue) {
      liste.push(vue);
      enregistrer(vue);
      activer(vue.id);
    }

    function renommer(vue, nom) {
      vue.nom = nom;
      enregistrer(vue);
    }

    /** Retire `vue` ; si c'était la vue active, « Toutes les cartes » le devient. */
    function supprimer(vue) {
      liste = liste.filter(v => v !== vue);
      enregistrer(vue);
      if (active === vue.id) activer(DEFAUT);
    }

    return {
      DEFAUT, VUE_DEFAUT,
      // lecture
      toutes: () => liste,
      activeId: () => active,
      active: () => trouver(active),
      trouver, visible, rangees,
      // ouverture et changement de contexte
      charger, relirePerso,
      // écriture
      activer, construire, ajouter, renommer, supprimer, enregistrer,
    };
  }

  window.Vues = { DEFAUT, creer };
})();
