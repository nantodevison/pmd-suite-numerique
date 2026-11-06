/* ══════════════════════════════════════════════════════════════
   FENÊTRE À ONGLETS — brique commune aux widgets (Kanban…)
   ══════════════════════════════════════════════════════════════

   Une grande fenêtre de réglages, sur le modèle des « Paramètres » de
   Notion, GitHub ou VS Code :

     ┌───────────────────────────────────────────────┐
     │ Titre                                      ✕  │
     ├──────────────┬────────────────────────────────┤
     │ ① Projet   ✓ │  contenu de l'onglet affiché   │
     │▶② Colonnes ⚠️ │                                │
     │ ③ …          │                                │
     ├──────────────┴────────────────────────────────┤
     │ • Modifications non appliquées  [Annuler] [OK]│
     └───────────────────────────────────────────────┘

   - une seule partie affichée à la fois : la fenêtre reste lisible ;
   - un état par onglet (✓ fait, ⚠️ à faire, ℹ️ à savoir) : les priorités
     se voient d'un coup d'œil ;
   - une barre du bas toujours visible : on ne rate pas le bouton d'action ;
   - « Modifications non appliquées » dès qu'un champ change, et une
     confirmation si l'on ferme sans appliquer ;
   - on la déplace par son en-tête, on la redimensionne par son coin bas
     droit : elle garde sa place et sa taille jusqu'au rechargement de la page.
   Sous 600 px de large, les onglets passent en haut, sur une ligne.

   Ce module ne connaît rien du widget : le contenu de chaque onglet est un
   élément de la page, que la fenêtre déplace chez elle.

   DÉPENDANCES : la feuille de style ../_commun/fenetre.css.

   UTILISATION (exemple)
     const fenetre = Fenetre.creer({
       titre: '⚙️ Configuration',
       onglets: [
         { id: 'projet', libelle: '① Projet', contenu: section1,
           etat: () => ({ etat: 'alerte', aide: 'Choisissez le projet' }) },
         …
       ],
       actions: [
         { libelle: 'Annuler', classe: 'btn-ghost', fermer: true },
         { libelle: '✓ Appliquer', classe: 'btn-primary', surClic: appliquer },
       ],
     });
     fenetre.ouvrir();          // sur le premier onglet ⚠️, sinon le premier
     fenetre.fermer({ forcer: true });   // après « Appliquer »

   Un champ dont le changement n'est pas une modification (une recherche,
   par exemple) porte l'attribut data-neutre.
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Partie de la fenêtre (en px) qui reste toujours visible quand on la déplace
  const GARDE_VISIBLE = 80;

  // Symbole affiché pour chaque état d'onglet
  const SYMBOLES = { ok: '✓', alerte: '⚠️', info: 'ℹ️' };

  /**
   * Crée la fenêtre (cachée) et la renvoie, avec ses commandes.
   *   titre   : texte de l'en-tête
   *   onglets : [{ id, libelle, contenu, etat }]
   *             contenu : élément de la page, déplacé dans la fenêtre
   *             etat    : facultatif, fonction qui renvoie
   *                       { etat: 'ok' | 'alerte' | 'info' | '', aide }
   *                       (aide : texte affiché au survol de l'onglet)
   *   actions : boutons de la barre du bas, de gauche à droite :
   *             [{ libelle, classe, surClic, fermer }]
   *             fermer: true → le bouton ferme la fenêtre (avec confirmation
   *             s'il y a des modifications), comme ✕ et Échap
   *   messageModif : texte de la confirmation de fermeture
   *   textePied : texte de la marque « modifié » de la barre du bas
   *   infoPied  : facultatif, élément affiché à gauche de la barre du bas
   *   surFermeture : facultatif, appelée juste après chaque fermeture. Plus
   *                  sûr que l'événement « close » du navigateur, qui n'arrive
   *                  qu'au dessin suivant de la page.
   */
  function creer({ titre, onglets, actions = [],
                   messageModif = 'Des modifications non appliquées seront perdues. Continuer ?',
                   textePied = '• Modifications non appliquées', infoPied = null,
                   surFermeture = null }) {
    let modifiee = false;
    let ongletActif = onglets[0].id;

    // ── Squelette ──
    const dialog = document.createElement('dialog');
    dialog.className = 'fenetre';

    const entete = document.createElement('div');
    entete.className = 'fenetre-entete';
    const h = document.createElement('h2');
    h.className = 'fenetre-titre';
    h.textContent = titre;
    const croix = document.createElement('button');
    croix.type = 'button';
    croix.className = 'fenetre-croix';
    croix.textContent = '✕';
    croix.title = 'Fermer';
    croix.addEventListener('click', () => fermer());
    entete.append(h, croix);

    const nav = document.createElement('nav');
    nav.className = 'fenetre-onglets';
    nav.setAttribute('role', 'tablist');
    const corps = document.createElement('div');
    corps.className = 'fenetre-corps';

    const boutonsOnglets = {};
    onglets.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fenetre-onglet';
      b.setAttribute('role', 'tab');
      const libelle = document.createElement('span');
      libelle.className = 'fenetre-onglet-libelle';
      libelle.textContent = o.libelle;
      const etat = document.createElement('span');
      etat.className = 'fenetre-onglet-etat';
      b.append(libelle, etat);
      b.addEventListener('click', () => afficherOnglet(o.id));
      nav.appendChild(b);
      boutonsOnglets[o.id] = b;

      o.contenu.classList.add('fenetre-panneau');
      o.contenu.setAttribute('role', 'tabpanel');
      o.contenu.hidden = false;
      corps.appendChild(o.contenu);
    });

    const pied = document.createElement('div');
    pied.className = 'fenetre-pied';
    const marque = document.createElement('span');
    marque.className = 'fenetre-modifiee';
    marque.textContent = textePied;
    if (infoPied) pied.appendChild(infoPied);
    pied.appendChild(marque);
    actions.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = a.classe || '';
      b.textContent = a.libelle;
      b.addEventListener('click', () => {
        if (a.fermer) fermer();
        else if (a.surClic) a.surClic();
      });
      pied.appendChild(b);
    });

    const milieu = document.createElement('div');
    milieu.className = 'fenetre-milieu';
    milieu.append(nav, corps);
    dialog.append(entete, milieu, pied);
    document.body.appendChild(dialog);

    // ── Déplacement par l'en-tête ──
    // Pendant le geste, les événements restent adressés à l'en-tête, même si
    // le pointeur sort du widget (setPointerCapture).
    let depart = null;
    entete.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      const r = dialog.getBoundingClientRect();
      depart = { x: e.clientX - r.left, y: e.clientY - r.top };
      entete.setPointerCapture(e.pointerId);
    });
    entete.addEventListener('pointermove', (e) => {
      if (depart) placer(e.clientX - depart.x, e.clientY - depart.y);
    });
    const finDeplacement = () => { depart = null; };
    entete.addEventListener('pointerup', finDeplacement);
    entete.addEventListener('pointercancel', finDeplacement);

    /** Place la fenêtre, en gardant l'en-tête à portée de souris. */
    function placer(gauche, haut) {
      const largeur = dialog.offsetWidth;
      const gardee = Math.min(GARDE_VISIBLE, largeur);
      dialog.style.left = `${Math.max(gardee - largeur, Math.min(gauche, window.innerWidth - gardee))}px`;
      dialog.style.top  = `${Math.max(0, Math.min(haut, window.innerHeight - GARDE_VISIBLE))}px`;
    }

    /**
     * Passe du centrage automatique à une position chiffrée, à la première
     * ouverture. Sinon, la fenêtre recentrée grandirait des deux côtés à la
     * fois, et son coin ne suivrait pas la souris.
     */
    function figerPosition() {
      const r = dialog.getBoundingClientRect();
      Object.assign(dialog.style, { margin: '0', right: 'auto', bottom: 'auto' });
      placer(r.left, r.top);
    }

    // ── Modifications : tout changement de champ, sauf ceux marqués data-neutre ──
    const surChangement = (e) => {
      if (e.target.closest('[data-neutre]')) return;
      marquerModifiee(true);
    };
    corps.addEventListener('input', surChangement);
    corps.addEventListener('change', surChangement);

    // ── Fermeture : Échap (événement « cancel » du navigateur) et clic sur le fond ──
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); fermer(); });
    dialog.addEventListener('mousedown', (e) => {
      // Le fond assombri fait partie de <dialog> : un clic « sur la fenêtre »
      // mais hors de son cadre est un clic sur le fond.
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const dedans = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!dedans) fermer();
    });

    // ── Commandes ──
    function afficherOnglet(id) {
      ongletActif = id;
      onglets.forEach(o => {
        const actif = o.id === id;
        o.contenu.classList.toggle('actif', actif);
        boutonsOnglets[o.id].setAttribute('aria-selected', String(actif));
      });
      corps.scrollTop = 0;
    }

    /** Recalcule le symbole ✓ / ⚠️ / ℹ️ de chaque onglet. */
    function majEtats() {
      onglets.forEach(o => {
        const { etat = '', aide = '' } = (o.etat && o.etat()) || {};
        const b = boutonsOnglets[o.id];
        b.querySelector('.fenetre-onglet-etat').textContent = SYMBOLES[etat] || '';
        b.dataset.etat = etat;
        b.title = aide;
      });
    }
    // Après chaque changement, une fois que le widget a pu redessiner
    // ce qui en dépend (d'où le délai d'un tour).
    corps.addEventListener('change', () => setTimeout(majEtats, 0));
    corps.addEventListener('input',  () => setTimeout(majEtats, 0));

    function marquerModifiee(oui) {
      modifiee = oui;
      dialog.classList.toggle('modifiee', oui);
    }

    /** Ouvre sur l'onglet demandé, sinon sur le premier ⚠️, sinon le premier. */
    function ouvrir(id) {
      marquerModifiee(false);
      majEtats();
      const premierAlerte = onglets.find(o => boutonsOnglets[o.id].dataset.etat === 'alerte');
      afficherOnglet(id || (premierAlerte ? premierAlerte.id : onglets[0].id));
      dialog.showModal();
      // Déjà placée : le widget a pu rétrécir depuis, on la ramène à portée
      if (dialog.style.left) placer(parseFloat(dialog.style.left), parseFloat(dialog.style.top));
      else figerPosition();
    }

    /** Ferme ; demande confirmation s'il y a des modifications, sauf { forcer: true }. */
    function fermer({ forcer = false } = {}) {
      if (modifiee && !forcer && !confirm(messageModif)) return false;
      marquerModifiee(false);
      dialog.close();
      if (surFermeture) surFermeture();
      return true;
    }

    return {
      ouvrir, fermer, afficherOnglet, majEtats, marquerModifiee,
      estOuverte: () => dialog.open,
      ongletActif: () => ongletActif,
      element: dialog,
    };
  }

  // Seul objet rendu visible au reste de la page.
  window.Fenetre = { creer };
})();
