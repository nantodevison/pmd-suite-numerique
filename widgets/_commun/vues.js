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

   Ce module ne connaît AUCUN nom de table ni de colonne. Le registre
   (Vues.creer) ne dessine rien et ne touche ni aux filtres ni au tri
   affichés : c'est le widget qui les applique quand la vue active change.
   L'interface (Vues.creerInterface, étape 2 de #231) construit la barre des
   vues, ses panneaux et la fenêtre « Gérer la vue » : voir la partie
   INTERFACE, plus bas. Une seule interface par page : ses éléments ont des
   identifiants fixes (#vue-nom, #fv-nom…), comme ceux du panneau des filtres.

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

  /* ══════════════════════════════════════════════════════════════
     INTERFACE (#231, étape 2) : barre des vues, petits panneaux et
     fenêtre « Gérer la vue »
     ══════════════════════════════════════════════════════════════

     Barre : un onglet par vue tant qu'ils tiennent, sinon un sélecteur ▾
     (la liste des vues s'ouvre dessous) ; ⋯ sur la vue active (Gérer,
     Renommer, Copier en vue perso, Supprimer en deux clics) ; « ＋ Vue » ;
     bouton-résumé « 🔽 Filtres ».

     Fenêtre « Gérer la vue » (#214) : onglets Vue et Filtres, puis ceux du
     widget (le Kanban : Tri, Colonnes). On photographie la vue à
     l'ouverture ; on règle sur l'état affiché (le widget suit, derrière la
     fenêtre, d'où le compteur) ; 💾 écrit tout dans la vue, Annuler, ✕ ou
     Échap restaure la photographie. « Toutes les cartes » ne se modifie
     pas : 💾 y crée une nouvelle vue.

     Le widget garde l'état affiché (filtres, tri) : il le prête par des
     fonctions. Il garde aussi ses propres boutons de la barre, et branche
     lui-même la fermeture des panneaux (clic ailleurs, Échap) sur
     fermerMenus().

     DÉPENDANCES : ../_commun/filtres.js, ../_commun/fenetre.js et leurs
     feuilles de style, puis vues.css. */

  /** Place un panneau en position fixe sous `ancre`, sans déborder de la fenêtre. */
  function placerSous(pop, ancre) {
    pop.classList.remove('hidden');
    const r = ancre.getBoundingClientRect();
    pop.style.top  = `${r.bottom + 6}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
  }

  // Squelettes HTML : textes fixes seulement (les noms des vues passent par textContent)
  const HTML_NOM = `
    <input id="vue-nom" class="filtre-recherche" type="text" placeholder="Nom de la vue" autocomplete="off" />
    <p id="vue-nom-aide" class="vue-aide"></p>
    <div id="vue-portee" class="vue-portee">
      <label class="filtre-valeur">
        <input type="radio" name="vue-portee" value="perso" checked />
        <span>🔒 <strong>Pour moi</strong> <span class="vue-aide">— ce navigateur, gardée aussitôt</span></span>
      </label>
      <label class="filtre-valeur">
        <input type="radio" name="vue-portee" value="partagee" />
        <span>👥 <strong>Pour tous</strong> <span class="vue-aide">— le document, puis « Enregistrer » de Grist</span></span>
      </label>
    </div>
    <button id="vue-nom-valider" class="btn-primary vue-valider">Créer la vue</button>`;
  const HTML_MENU = `
    <button id="vue-menu-gerer" class="vue-menu-item">🎛 Gérer la vue…</button>
    <button id="vue-menu-renommer" class="vue-menu-item">✏️ Renommer</button>
    <button id="vue-menu-copier" class="vue-menu-item">🔒 Copier en vue perso</button>
    <button id="vue-menu-supprimer" class="vue-menu-item danger">🗑 Supprimer la vue</button>`;
  const HTML_ONGLET_VUE = `
    <h3 class="config-etape">Vue</h3>
    <p class="config-aide" id="fv-portee"></p>
    <label class="fv-champ"><span id="fv-nom-libelle">Nom de la vue</span>
      <input id="fv-nom" class="filtre-recherche" type="text" autocomplete="off" required />
    </label>
    <div id="fv-nouvelle-portee" class="vue-portee hidden">
      <label class="filtre-valeur"><input type="radio" name="fv-portee-choix" value="perso" checked />
        <span>🔒 <strong>Pour moi</strong> <span class="vue-aide">— ce navigateur seulement</span></span></label>
      <label class="filtre-valeur"><input type="radio" name="fv-portee-choix" value="partagee" />
        <span>👥 <strong>Pour tous</strong> <span class="vue-aide">— le document, puis « Enregistrer » de Grist</span></span></label>
    </div>
    <button id="fv-supprimer" class="filtre-lien danger fv-supprimer">🗑 Supprimer la vue</button>`;
  const HTML_ONGLET_FILTRES = `
    <h3 class="config-etape">Filtres</h3>
    <p class="config-aide">Une carte doit respecter tous les filtres. Cliquez sur une étiquette pour la modifier.</p>`;

  /**
   * Construit l'interface des vues d'un widget, branchée sur le registre `R`.
   * @param {object} R - registre créé par Vues.creer
   * @param {object} o
   *   Où :
   *   - barre         : élément dont on surveille la largeur (onglets ou sélecteur)
   *   - zoneVues      : élément vide qui reçoit les onglets et « ＋ Vue »
   *   - zoneResumes   : élément qui reçoit, en tête, le bouton « 🔽 Filtres »
   *   État affiché (gardé par le widget) :
   *   - filtres(), remplacerFiltres(liste), tri(), remplacerTri(liste)
   *   - nettoyerTri(tri)  : copie bien formée d'un tri (par défaut : simple copie)
   *   - appliquerVue()    : applique les filtres et le tri de la vue active
   *   - redessiner()      : redessine le widget (qui rappelle majFenetre et dessinerBarre)
   *   - compter()         : { affichees, total } pour le compteur de la fenêtre
   *   - panneauFiltres(zone) : construit dans `zone` le panneau des filtres
   *                         (Filtres.creerPanneau) et le renvoie
   *   Ce qui est propre au widget (tout est facultatif) :
   *   - contenu()         : champs propres d'une nouvelle vue (le Kanban : { colonnes })
   *   - decrireContenu    : ce que reprend une nouvelle vue, en mots
   *                         (par défaut « les filtres et le tri »)
   *   - aideDefaut        : bulle d'aide de l'onglet « Toutes les cartes »
   *   - onglets           : onglets en plus dans la fenêtre [{ id, libelle, contenu }]
   *   - surOuverture()    : la fenêtre s'ouvre (remplir ses onglets en plus)
   *   - photographier(vue), restaurer(photo, vue), modifiee(photo, vue) :
   *                         champs propres, dans la photographie de la fenêtre
   *   - prevenir(message, durée), fermerPanneaux() (par défaut : fermerMenus)
   */
  function creerInterface(R, o) {
    const copierTri = o.nettoyerTri || (tri => (tri || []).map(c => ({ ...c })));
    const decrire = o.decrireContenu || 'les filtres et le tri';
    const prevenir = o.prevenir || (() => {});
    const fermerTout = () => (o.fermerPanneaux || fermerMenus)();
    // Élément `id` cherché parmi ceux de CETTE interface seulement (voir racines, plus bas)
    const $ = (id) => {
      for (const r of racines) {
        const e = r.id === id ? r : r.querySelector('#' + id);
        if (e) return e;
      }
      return null;
    };
    const element =(tag, proprietes = {}, squelette = '') => {
      const e = document.createElement(tag);
      Object.assign(e, proprietes);
      if (squelette) e.innerHTML = squelette;   // squelettes fixes ci-dessus, jamais de texte venu de Grist
      return e;
    };

    /* ── Construction ── */

    const zoneOnglets = element('div', { id: 'vues-enregistrees', className: 'vues-enregistrees' });
    const boutonAjouter = element('button', { id: 'vue-ajouter', className: 'filtre-ajouter',
      title: "Créer une vue à partir de l'affichage actuel", textContent: '＋ Vue' });
    o.zoneVues.append(zoneOnglets, boutonAjouter);
    const boutonFiltres = element('button', { id: 'filtres-bouton', className: 'filtre-ajouter resume-vue', textContent: '🔽 Filtres' });
    o.zoneResumes.prepend(boutonFiltres);

    const popNom   = element('div', { id: 'vue-nom-popover', className: 'filtre-popover hidden' }, HTML_NOM);
    const popMenu  = element('div', { id: 'vue-menu-popover', className: 'filtre-popover vue-menu hidden' }, HTML_MENU);
    const popListe = element('div', { id: 'vue-liste-popover', className: 'filtre-popover vue-menu vue-liste hidden' });
    document.body.append(popNom, popMenu, popListe);

    const ongletVue     = element('section', { id: 'fv-vue' }, HTML_ONGLET_VUE);
    const ongletFiltres = element('section', { id: 'fv-filtres' }, HTML_ONGLET_FILTRES);
    // data-neutre : la fenêtre ne juge pas seule des modifications, le module les calcule
    ongletVue.dataset.neutre = '';
    ongletFiltres.dataset.neutre = '';
    const info = element('div', { id: 'fv-info' });
    info.append(element('span', { id: 'fv-compteur' }), element('span', { id: 'fv-partagee', textContent: '👥 Partagée' }));
    const racines = [popNom, popMenu, popListe, ongletVue, info];

    let photo = null;   // photographie de la vue ; non nulle = fenêtre en cours d'usage
    const fenetre = Fenetre.creer({
      titre: '🎛 Gérer la vue',
      onglets: [
        { id: 'vue',     libelle: 'Vue',     contenu: ongletVue },
        { id: 'filtres', libelle: 'Filtres', contenu: ongletFiltres },
        ...(o.onglets || []),
      ],
      actions: [
        { libelle: 'Annuler', classe: 'btn-ghost', fermer: true },
        { libelle: '💾 Enregistrer', classe: 'btn-primary', surClic: enregistrerFenetre },
      ],
      textePied: '• Non enregistré',
      messageModif: 'Les modifications de cette vue seront perdues. Continuer ?',
      infoPied: info,
      surFermeture: quitterFenetre,   // Annuler, ✕, Échap, clic sur le fond, 💾
    });
    const panneau = o.panneauFiltres(ongletFiltres);

    /* ── Barre ── */

    /** Petit ⋯ de la vue active : ouvre son menu sous `onglet`. */
    function boutonMenu(onglet) {
      const menu = element('span', { className: 'vue-menu-btn', textContent: '⋯', title: 'Options de la vue' });
      menu.addEventListener('click', (e) => { e.stopPropagation(); ouvrirMenu(onglet); });
      return menu;
    }

    /** Un onglet par vue enregistrée. */
    function dessinerOnglets() {
      zoneOnglets.innerHTML = '';
      R.rangees().forEach(vue => {
        const active = vue.id === R.activeId();
        const onglet = element('button', {
          className: 'view-tab vue-enregistree' + (vue.perso ? ' perso' : '') + (active ? ' active' : ''),
          textContent: (vue.perso ? '🔒 ' : '') + vue.nom,
          title: vue.defaut ? (o.aideDefaut || 'Toutes les cartes')
            : vue.perso ? 'Vue personnelle : visible dans ce navigateur seulement'
            : 'Vue partagée : la même pour tous',
        });
        onglet.addEventListener('click', () => { if (!active) afficher(vue.id); });
        // ⋯ seulement sur l'onglet actif : on agit sur la vue affichée.
        // Pas sur « Toutes les cartes » : elle ne se renomme ni ne se supprime.
        if (active && !vue.defaut) onglet.appendChild(boutonMenu(onglet));
        zoneOnglets.appendChild(onglet);
      });
    }

    /** Un seul bouton à la place des onglets : le nom de la vue active, ▾ pour en changer. */
    function dessinerSelecteur() {
      zoneOnglets.innerHTML = '';
      const vue = R.active();
      const bouton = element('button', { className: 'view-tab vue-enregistree vue-selecteur active',
        title: `Vue active : ${vue.nom}. Cliquer pour en changer.` });
      bouton.append(element('span', { className: 'vue-selecteur-nom', textContent: (vue.perso ? '🔒 ' : '') + vue.nom }), ' ▾');
      if (!vue.defaut) bouton.appendChild(boutonMenu(bouton));
      bouton.addEventListener('click', () => ouvrirListe(bouton));
      zoneOnglets.appendChild(bouton);
    }

    /**
     * Des onglets tant qu'ils tiennent, sinon le sélecteur. On dessine d'abord
     * les onglets pour mesurer leur place : ils reviennent dès que le widget s'élargit.
     */
    function dessinerBarre() {
      dessinerOnglets();
      if (o.barre.clientWidth > 0 && o.barre.scrollWidth > o.barre.clientWidth) dessinerSelecteur();
    }
    let largeurBarre = 0;
    new ResizeObserver(([{ contentRect }]) => {
      if (contentRect.width === largeurBarre) return;
      largeurBarre = contentRect.width;
      dessinerBarre();
    }).observe(o.barre);

    /** Bouton « 🔽 Filtres » : leur nombre, et le détail au survol. */
    function majBoutonFiltres() {
      const filtres = o.filtres().filter(f => f.valeurs.length > 0);
      const nb = filtres.length;
      boutonFiltres.classList.toggle('actif', nb > 0);
      boutonFiltres.textContent = nb ? `🔽 ${nb} filtre${nb > 1 ? 's' : ''}` : '🔽 Filtres';
      boutonFiltres.title = nb ? filtres.map(f => panneau.resume(f)).join('\n') : 'Filtrer les cartes de la vue';
    }

    /* ── Petits panneaux : liste, nom, menu ⋯ ── */

    /** Ferme les panneaux des vues et l'éditeur de filtre. */
    function fermerMenus() {
      panneau.fermer();
      [popNom, popMenu, popListe].forEach(p => p.classList.add('hidden'));
    }

    /** Ouvre (ou referme) la liste des vues sous le sélecteur. */
    function ouvrirListe(ancre) {
      if (!popListe.classList.contains('hidden')) { popListe.classList.add('hidden'); return; }
      fermerTout();
      popListe.innerHTML = '';
      const vues = R.rangees();
      const deuxGroupes = vues.some(v => v.perso) && vues.some(v => !v.perso);
      let groupe = null;
      vues.forEach(vue => {
        if (deuxGroupes && groupe !== !!vue.perso) {
          groupe = !!vue.perso;
          popListe.appendChild(element('div', { className: 'vue-liste-titre', textContent: groupe ? '🔒 Personnelles' : '👥 Partagées' }));
        }
        const item = element('button', { className: 'vue-menu-item' + (vue.id === R.activeId() ? ' active' : ''), textContent: vue.nom });
        item.addEventListener('click', () => afficher(vue.id));
        popListe.appendChild(item);
      });
      placerSous(popListe, ancre);
    }

    /**
     * Saisie du nom, selon le mode : 'creer' (perso ou partagée), 'renommer'
     * (vue active) ou 'copier' (copie perso de la vue partagée active, #202).
     */
    function ouvrirNom(mode, ancre) {
      fermerTout();
      const champ = $('vue-nom');
      popNom.dataset.mode = mode;
      champ.value = mode === 'creer' ? '' : (R.active()?.nom || '');
      $('vue-nom-valider').textContent = { creer: 'Créer la vue', renommer: 'Renommer', copier: 'Copier' }[mode];
      const aide = $('vue-nom-aide');
      aide.textContent = mode === 'copier'
        ? `Copie, rien que pour vous, ${decrire} affichés.`
        : `Reprend ${decrire} affichés.`;
      aide.classList.toggle('hidden', mode === 'renommer');
      // Choix 🔒 Pour moi / 👥 Pour tous : à la création seulement, « Pour moi » par défaut
      $('vue-portee').classList.toggle('hidden', mode !== 'creer');
      popNom.querySelector('input[name="vue-portee"][value="perso"]').checked = true;
      placerSous(popNom, ancre);
      champ.focus();
      champ.select();
    }

    function validerNom() {
      const nom = $('vue-nom').value.trim();
      if (!nom) return;
      popNom.classList.add('hidden');
      const mode = popNom.dataset.mode;
      if (mode === 'renommer')    renommer(nom);
      else if (mode === 'copier') creer(nom, true);
      else creer(nom, popNom.querySelector('input[name="vue-portee"]:checked')?.value !== 'partagee');
    }

    function ouvrirMenu(ancre) {
      fermerTout();
      // « Copier en vue perso » : seulement depuis une vue partagée
      $('vue-menu-copier').hidden = !!R.active()?.perso;
      const suppr = $('vue-menu-supprimer');
      suppr.textContent = '🗑 Supprimer la vue';
      suppr.dataset.confirmer = '';
      placerSous(popMenu, ancre);
    }

    /* ── Actions sur les vues ── */

    /** Rend `id` active, applique ses filtres et son tri, puis redessine. */
    function afficher(id) {
      fermerTout();
      R.activer(id);
      o.appliquerVue();
      o.redessiner();
    }

    /** Ajoute `vue` (déjà construite), la mémorise à sa place et l'affiche. */
    function ajouter(vue) {
      R.ajouter(vue);
      afficher(vue.id);
    }

    /** Nouvelle vue à partir de ce qui est affiché. Sert aussi à « Copier en vue perso ». */
    function construire(nom, perso) {
      const filtres = Filtres.copier(o.filtres().filter(f => f.valeurs.length > 0));
      return R.construire(nom, perso, { filtres, ...(o.contenu ? o.contenu() : {}), tri: copierTri(o.tri()) });
    }

    /** Ajoute et affiche `vue`, puis dit ce qu'il reste à faire pour la garder. */
    function ajouterEtAnnoncer(vue) {
      ajouter(vue);
      if (vue.perso) prevenir(`✓ Vue personnelle « ${vue.nom} » créée`);
      else           prevenir(`✓ Vue « ${vue.nom} » créée : cliquez sur « Enregistrer » dans Grist pour la garder`, 4000);
    }

    function creer(nom, perso) { ajouterEtAnnoncer(construire(nom, perso)); }

    function renommer(nom) {
      const vue = R.active();
      if (!vue || vue.defaut) return;
      R.renommer(vue, nom);
      dessinerBarre();
    }

    function supprimer() {
      const vue = R.active();
      if (!vue || vue.defaut) return;
      R.supprimer(vue);
      afficher(DEFAUT);
      prevenir(`✓ Vue « ${vue.nom} » supprimée`);
    }

    /* ── Fenêtre « Gérer la vue » ── */

    /** Ouvre la fenêtre sur la vue active, à l'onglet `onglet` (le premier par défaut). */
    function ouvrirFenetre(onglet) {
      const vue = R.active();
      if (!vue) return;
      fermerTout();
      const defaut = !!vue.defaut;
      photo = {
        nom: defaut ? '' : vue.nom,
        filtres: Filtres.copier(o.filtres()),
        tri: (o.tri() || []).map(c => ({ ...c })),
        propre: o.photographier ? o.photographier(vue) : null,
      };
      panneau.dessinerEtiquettes();
      if (o.surOuverture) o.surOuverture();

      $('fv-nom').value = photo.nom;
      $('fv-nom-libelle').textContent = defaut ? 'Nom de la nouvelle vue' : 'Nom de la vue';
      $('fv-portee').textContent = defaut
        ? 'Cette vue montre toutes les cartes et ne se modifie pas : vos réglages créeront une nouvelle vue.'
        : vue.perso ? '🔒 Vue personnelle : visible dans ce navigateur seulement.'
        : '👥 Vue partagée : la même pour tous. Après 💾, le bouton « Enregistrer » de Grist la garde dans le document.';
      $('fv-partagee').hidden = !!vue.perso || defaut;
      $('fv-nouvelle-portee').classList.toggle('hidden', !defaut);
      ongletVue.querySelector('input[name="fv-portee-choix"][value="perso"]').checked = true;
      fenetre.element.querySelector('.fenetre-pied .btn-primary').textContent =
        defaut ? '💾 Enregistrer comme nouvelle vue' : '💾 Enregistrer';
      const suppr = $('fv-supprimer');
      suppr.hidden = defaut;
      suppr.textContent = '🗑 Supprimer la vue';
      suppr.dataset.confirmer = '';

      fenetre.ouvrir(onglet);
      majFenetre();
    }

    /** La vue réglée dans la fenêtre diffère-t-elle de la photographie ? */
    function fenetreModifiee() {
      return $('fv-nom').value.trim() !== photo.nom
        || Filtres.signature(o.filtres()) !== Filtres.signature(photo.filtres)
        || JSON.stringify(o.tri()) !== JSON.stringify(photo.tri)
        || (o.modifiee ? o.modifiee(photo.propre, R.active()) : false);
    }

    /** Met à jour le bas de la fenêtre (à appeler à chaque nouveau dessin du widget). */
    function majFenetre() {
      if (!photo) return;
      const { affichees, total } = o.compter();
      $('fv-compteur').textContent = `${affichees} carte${affichees > 1 ? 's' : ''} sur ${total}`;
      fenetre.marquerModifiee(fenetreModifiee());
    }

    /** 💾 : écrit nom, filtres et tri dans la vue (ou dans une nouvelle vue), puis ferme. */
    function enregistrerFenetre() {
      const vue = R.active();
      const champ = $('fv-nom');
      if (!vue) return;
      if (!champ.value.trim()) {
        fenetre.afficherOnglet('vue');
        champ.reportValidity();
        return;
      }
      panneau.fermer();   // retire un filtre commencé mais laissé sans valeur
      if (vue.defaut) {
        const perso = ongletVue.querySelector('input[name="fv-portee-choix"]:checked').value !== 'partagee';
        const nouvelle = construire(champ.value.trim(), perso);
        fenetre.fermer({ forcer: true });   // « Toutes les cartes » retrouve son état
        ajouterEtAnnoncer(nouvelle);
        return;
      }
      vue.nom = champ.value.trim();
      vue.filtres = Filtres.copier(o.filtres().filter(f => f.valeurs.length > 0));
      vue.tri = copierTri(o.tri());
      photo = null;                   // rien à restaurer (les champs propres sont déjà dans la vue)
      fenetre.fermer({ forcer: true });
      R.enregistrer(vue);
      o.redessiner();
      if (vue.perso) prevenir('✓ Vue enregistrée');
      else prevenir('✓ Vue enregistrée : cliquez sur « Enregistrer » dans Grist pour la garder pour tous', 4500);
    }

    /** Sortie de la fenêtre : s'il reste une photographie (on n'a pas enregistré), on la restaure. */
    function quitterFenetre() {
      panneau.fermer();
      if (!photo) return;
      const p = photo;
      photo = null;
      o.remplacerFiltres(p.filtres);
      o.remplacerTri(p.tri);
      if (o.restaurer) o.restaurer(p.propre, R.active());
      o.redessiner();
    }

    /* ── Boutons ── */

    boutonAjouter.addEventListener('click', (e) => ouvrirNom('creer', e.currentTarget));
    boutonFiltres.addEventListener('click', () => ouvrirFenetre('filtres'));
    $('vue-nom-valider').addEventListener('click', validerNom);
    $('vue-nom').addEventListener('keydown', (e) => { if (e.key === 'Enter') validerNom(); });
    const ongletActif = () => zoneOnglets.querySelector('.vue-enregistree.active');
    $('vue-menu-gerer').addEventListener('click', () => ouvrirFenetre());
    $('vue-menu-renommer').addEventListener('click', () => ouvrirNom('renommer', ongletActif()));
    $('vue-menu-copier').addEventListener('click', () => ouvrirNom('copier', ongletActif()));
    // Suppression en deux clics : le premier demande confirmation
    const deuxClics = (surConfirme) => (e) => {
      const b = e.currentTarget;
      if (b.dataset.confirmer) { surConfirme(); return; }
      b.dataset.confirmer = 'oui';
      b.textContent = '🗑 Cliquer encore pour confirmer';
    };
    $('vue-menu-supprimer').addEventListener('click', deuxClics(() => { fermerTout(); supprimer(); }));
    $('fv-supprimer').addEventListener('click', deuxClics(() => {
      photo = null;
      fenetre.fermer({ forcer: true });
      supprimer();
    }));
    $('fv-nom').addEventListener('input', majFenetre);

    return {
      fenetre, panneau,
      dessinerBarre, majBoutonFiltres, majFenetre, fermerMenus,
      fenetreEnCours: () => photo !== null,
      afficher, ajouter, construire, creer, renommer, supprimer,
      ouvrirNom, ouvrirMenu, ouvrirListe, ouvrirFenetre, enregistrerFenetre,
    };
  }

  window.Vues = { DEFAUT, creer, creerInterface, placerSous };
})();
