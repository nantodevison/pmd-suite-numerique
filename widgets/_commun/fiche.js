/* ══════════════════════════════════════════════════════════════
   FICHE — briques communes aux widgets (Kanban, Galerie…)
   ══════════════════════════════════════════════════════════════

   La « fiche » est le panneau qui affiche et modifie une carte. Ce module
   ne connaît AUCUN nom de table ni de colonne : chaque widget construit le
   contenu de sa fiche, et s'appuie ici sur trois briques :

   1. Deux dispositions pour un même panneau, au choix de l'utilisateur :
        « côté »   : panneau étroit à droite (le tableau reste visible) ;
        « centre » : grande fenêtre au milieu, plus lisible.
      Le dernier choix est mémorisé dans le navigateur (chaque personne
      garde le sien).

   2. Le Markdown : rendu mis en forme (titres, listes, gras, liens…) et
      champ de saisie qui bascule entre « Aperçu » et « Modifier ».

   3. La version « texte brut » d'un Markdown, pour les aperçus courts
      (sur une carte, on ne veut voir ni « ** » ni « # »).

   4. La conversion des textes écrits avec l'ancien widget « Notepad » de
      Grist (format JSON {"ops": […]}) en Markdown. Elle s'applique d'office
      à l'affichage ; un widget peut aussi s'en servir pour réécrire les
      cellules une fois pour toutes (voir la Galerie).

   5. Un petit menu (choix simple ou multiple, ou date) qui s'ouvre au clic
      sur une pastille de la fiche, pour en changer la valeur.

   6. Un champ de titre qui passe à la ligne au lieu de couper le texte.

   DÉPENDANCES (à charger AVANT ce fichier, depuis cdnjs) :
     - marked     : transforme le Markdown en HTML ;
     - DOMPurify  : nettoie ce HTML. Indispensable : le widget a l'accès
                    complet au document, et une description contenant du
                    HTML malveillant pourrait sinon exécuter du code.
   Et la feuille de style ../_commun/fiche.css.

   UTILISATION (exemple)
     Fiche.installer(panneau, { actions, fermer, surBascule });
     Fiche.ouvrir(panneau);  …  Fiche.fermer(panneau);
     corps.appendChild(Fiche.champMarkdown(texte, v => noterModif(v)));
     carte.textContent = Fiche.markdownVersTexte(texte);
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const CLE_DISPOSITION = 'fiche-disposition';   // clé du choix mémorisé
  const DISPOSITIONS = ['cote', 'centre'];

  // Un seul « voile » (fond assombri derrière la fiche centrée) par page.
  let voile = null;

  /* ── 1. Format Notepad → Markdown ──────────────────────────── */

  /*
   * Le widget Notepad enregistre un texte sous la forme
   *   {"ops":[{"insert":"Titre"},{"insert":"\n","attributes":{"header":2}}, …]}
   * Chaque « insert » est un morceau de texte ; ses « attributes » disent
   * comment l'écrire (gras, lien…). La mise en forme d'une LIGNE (titre,
   * liste, citation) est portée par le « \n » qui termine cette ligne.
   */

  /** Renvoie les opérations Notepad d'un texte, ou null s'il n'en est pas un. */
  function operationsNotepad(texte) {
    if (typeof texte !== 'string' || !texte.trimStart().startsWith('{"ops"')) return null;
    try {
      const objet = JSON.parse(texte);
      return Array.isArray(objet.ops) ? objet.ops : null;
    } catch (_) { return null; }
  }

  function estNotepad(texte) { return operationsNotepad(texte) !== null; }

  // Écrit un morceau de texte en Markdown selon ses attributs. Les espaces
  // de début et de fin restent hors des « ** » : « ** gras** » ne serait
  // pas compris comme du gras.
  function morceauMarkdown(texte, attr) {
    if (!texte) return '';
    if (attr.code) return '`' + texte + '`';
    const [, avant, coeur, apres] = /^(\s*)([\s\S]*?)(\s*)$/.exec(texte);
    if (!coeur) return texte;
    // \ * et ` ont un sens en Markdown : on les protège dans le texte simple.
    let md = coeur.replace(/([\\*`])/g, '\\$1');
    if (attr.bold)   md = `**${md}**`;
    if (attr.italic) md = `*${md}*`;
    if (attr.strike) md = `~~${md}~~`;
    if (attr.link)   md = `[${md}](${attr.link})`;
    // Souligné, couleurs, surlignage : pas d'équivalent Markdown, le texte reste.
    return avant + md + apres;
  }

  // Nature d'une ligne : sert à savoir où laisser une ligne vide, sans
  // laquelle un paragraphe placé après une liste serait avalé par la liste.
  function natureLigne(attr) {
    if (attr.header) return 'titre';
    if (attr.list) return 'liste';
    if (attr.blockquote) return 'citation';
    if (attr['code-block']) return 'code';
    return 'texte';
  }

  function prefixeLigne(attr) {
    if (attr.header) return '#'.repeat(Math.min(attr.header, 6)) + ' ';
    if (attr.blockquote) return '> ';
    if (attr.list) {
      const retrait = '    '.repeat(attr.indent || 0);   // listes imbriquées
      const puce = { ordered: '1. ', checked: '- [x] ', unchecked: '- [ ] ' }[attr.list] || '- ';
      return retrait + puce;
    }
    return '';
  }

  /** Texte Notepad → Markdown ; un texte qui n'est pas du Notepad est rendu tel quel. */
  function notepadVersMarkdown(texte) {
    const ops = operationsNotepad(texte);
    if (!ops) return texte;

    // 1. Découpage en lignes. Les morceaux d'une ligne sont gardés bruts
    //    jusqu'à son « \n » : c'est lui qui dit si c'est une ligne de code
    //    (écrite telle quelle) ou de texte (mise en forme Markdown).
    const lignes = [];
    let morceaux = [];   // [{ texte, attr }] de la ligne en cours
    const finirLigne = (attrLigne) => {
      const md = attrLigne['code-block']
        ? morceaux.map(m => m.texte).join('')
        : morceaux.map(m => m.image ? `![](${m.image})` : morceauMarkdown(m.texte, m.attr)).join('');
      lignes.push({ md, attr: attrLigne });
      morceaux = [];
    };
    ops.forEach(op => {
      const attr = op.attributes || {};
      if (typeof op.insert !== 'string') {
        // Objet inséré : seule l'image a un équivalent Markdown.
        if (op.insert && op.insert.image) morceaux.push({ image: op.insert.image });
        return;
      }
      op.insert.split('\n').forEach((texte, i) => {
        if (i > 0) finirLigne(attr);
        if (texte) morceaux.push({ texte, attr });
      });
    });
    if (morceaux.length) finirLigne({});

    // 2. Assemblage, avec une ligne vide quand la nature change
    const sortie = [];
    let precedente = null;
    lignes.forEach(({ md, attr }) => {
      const nature = natureLigne(attr);
      if (precedente === 'code' && nature !== 'code') sortie.push('```');
      if (precedente !== null && nature !== precedente && sortie[sortie.length - 1] !== '') sortie.push('');
      if (nature === 'code' && precedente !== 'code') sortie.push('```');
      sortie.push(nature === 'code' ? md : prefixeLigne(attr) + md);
      precedente = nature;
    });
    if (precedente === 'code') sortie.push('```');
    return sortie.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ── 2. Markdown ───────────────────────────────────────────── */

  /** Markdown → HTML nettoyé, prêt à être inséré avec innerHTML. */
  function markdownVersHtml(texte) {
    if (!texte) return '';
    // Un ancien texte Notepad est d'abord converti en Markdown.
    texte = notepadVersMarkdown(String(texte));
    // breaks : un simple retour à la ligne est conservé, comme dans Grist.
    const html = marked.parse(texte, { breaks: true, gfm: true });
    return DOMPurify.sanitize(html);
  }

  /** Markdown → texte brut sur une ligne (pour les aperçus sur les cartes). */
  function markdownVersTexte(texte) {
    if (!texte) return '';
    // DOMParser crée un document « inerte » : rien n'y est chargé ni exécuté,
    // contrairement à un élément de la page (une image y serait téléchargée).
    const doc = new DOMParser().parseFromString(markdownVersHtml(texte), 'text/html');
    return doc.body.textContent.replace(/\s+/g, ' ').trim();
  }

  /**
   * Champ Markdown modifiable : affiche le texte mis en forme ; le bouton
   * « Modifier » (ou un double-clic sur le texte) passe en saisie brute.
   *   valeur        : texte Markdown de départ
   *   surChangement : fonction appelée à chaque frappe, avec le nouveau texte
   * Renvoie l'élément à insérer dans la fiche.
   */
  function champMarkdown(valeur, surChangement) {
    // Un ancien texte Notepad se modifie directement en Markdown : il sera
    // enregistré dans ce format à la prochaine sauvegarde.
    let texte = notepadVersMarkdown(valeur || '');

    const bloc = document.createElement('div');
    bloc.className = 'fiche-md';

    const barre = document.createElement('div');
    barre.className = 'fiche-md-barre';
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'fiche-md-bouton';
    const aide = document.createElement('span');
    aide.className = 'fiche-md-aide';
    aide.textContent = 'Markdown : **gras**, *italique*, # titre, - liste, [lien](url)';
    barre.append(bouton, aide);

    const rendu = document.createElement('div');
    rendu.className = 'fiche-md-rendu';

    const saisie = document.createElement('textarea');
    saisie.className = 'fiche-md-saisie';
    saisie.placeholder = 'Ajouter une description…';
    saisie.value = texte;
    saisie.addEventListener('input', () => { texte = saisie.value; surChangement(texte); });

    // Bascule entre les deux modes ; le rendu est recalculé à chaque retour
    // en aperçu, pour refléter ce qui vient d'être saisi.
    function afficher(enSaisie) {
      bloc.classList.toggle('en-saisie', enSaisie);
      bouton.textContent = enSaisie ? '👁 Aperçu' : '✏️ Modifier';
      aide.hidden = !enSaisie;
      if (enSaisie) {
        saisie.focus();
      } else if (texte.trim()) {
        rendu.innerHTML = markdownVersHtml(texte);
      } else {
        rendu.innerHTML = '<p class="fiche-md-vide">Aucune description — cliquez sur « Modifier ».</p>';
      }
    }

    bouton.addEventListener('click', () => afficher(!bloc.classList.contains('en-saisie')));
    rendu.addEventListener('dblclick', () => afficher(true));
    // Un lien du texte s'ouvre dans un nouvel onglet, pas dans le widget.
    rendu.addEventListener('click', (e) => {
      const lien = e.target.closest('a');
      if (lien) { e.preventDefault(); window.open(lien.href, '_blank', 'noopener'); }
    });

    bloc.append(barre, rendu, saisie);
    afficher(false);
    return bloc;
  }

  /* ── 3. Titre sur plusieurs lignes ─────────────────────────── */

  /*
   * Un <input> coupe un titre trop long ; une zone de texte (<textarea>)
   * passe à la ligne. On l'agrandit à la hauteur de son contenu, et l'on
   * interdit les sauts de ligne : un titre reste une seule phrase.
   */

  /** Donne à une zone de titre la hauteur de son texte. */
  function ajusterHauteur(zone) {
    zone.style.height = 'auto';                    // repart de zéro (le texte a pu raccourcir)
    zone.style.height = zone.scrollHeight + 'px';  // hauteur réelle du texte
  }

  // Une largeur qui change (fenêtre, passage côté ↔ centre) change le nombre
  // de lignes : on réajuste tous les titres affichés.
  function ajusterTitres(conteneur = document) {
    conteneur.querySelectorAll('textarea.fiche-titre').forEach(ajusterHauteur);
  }
  window.addEventListener('resize', () => ajusterTitres());

  /**
   * Champ de titre.
   *   valeur        : titre de départ
   *   placeholder   : texte affiché quand le champ est vide
   *   lectureSeule  : true pour une colonne calculée par une formule
   *   classe        : classe CSS en plus de « fiche-titre » (style du widget)
   *   surChangement : fonction appelée à chaque frappe, avec le nouveau titre
   */
  function champTitre(valeur, { placeholder = '', lectureSeule = false, classe = '', surChangement } = {}) {
    const zone = document.createElement('textarea');
    zone.className = 'fiche-titre' + (classe ? ' ' + classe : '');
    zone.rows = 1;
    zone.value = valeur || '';
    zone.placeholder = placeholder;
    zone.readOnly = lectureSeule;
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    zone.addEventListener('input', () => {
      // Un texte collé peut contenir des retours à la ligne : on les remplace.
      if (zone.value.includes('\n')) zone.value = zone.value.replace(/\s*\n\s*/g, ' ');
      ajusterHauteur(zone);
      if (surChangement) surChangement(zone.value);
    });
    // La hauteur ne se mesure qu'une fois la zone affichée dans la page.
    requestAnimationFrame(() => ajusterHauteur(zone));
    return zone;
  }

  /* ── 4. Petit menu ouvert au clic sur une pastille ─────────── */

  /*
   * Un seul menu à la fois, flottant sous la pastille cliquée (ou au-dessus
   * s'il manque de place). Il se ferme par un clic ailleurs ou par Échap ;
   * dans ce cas, Échap ne ferme PAS la fiche (l'événement est arrêté).
   */
  let menuOuvert = null;

  function fermerMenu() {
    if (!menuOuvert) return;
    menuOuvert.remove();
    menuOuvert = null;
    document.removeEventListener('mousedown', clicHorsMenu, true);
    document.removeEventListener('keydown', echapMenu, true);
  }

  function clicHorsMenu(e) {
    if (menuOuvert && !menuOuvert.contains(e.target)) fermerMenu();
  }

  function echapMenu(e) {
    if (e.key !== 'Escape') return;
    e.stopImmediatePropagation();   // la fiche reste ouverte
    e.preventDefault();
    fermerMenu();
  }

  // Ouvre un menu vide près de « ancre » et le renvoie, pour le remplir.
  function ouvrirMenu(ancre) {
    fermerMenu();
    const menu = document.createElement('div');
    menu.className = 'fiche-menu';
    document.body.appendChild(menu);
    menuOuvert = menu;
    // « true » : ces écouteurs passent avant ceux du widget (Échap → fiche).
    document.addEventListener('mousedown', clicHorsMenu, true);
    document.addEventListener('keydown', echapMenu, true);
    // Placement après remplissage (taille connue) : voir placerMenu.
    requestAnimationFrame(() => placerMenu(menu, ancre));
    return menu;
  }

  function placerMenu(menu, ancre) {
    const r = ancre.getBoundingClientRect();
    const largeur = menu.offsetWidth, hauteur = menu.offsetHeight;
    const enDessous = r.bottom + 4 + hauteur <= window.innerHeight || r.top < hauteur;
    menu.style.top  = `${Math.max(4, enDessous ? r.bottom + 4 : r.top - hauteur - 4)}px`;
    menu.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - largeur - 8))}px`;
  }

  /**
   * Menu de choix.
   *   options   : [{ valeur, libelle }]
   *   selection : valeurs actuellement choisies (liste)
   *   multiple  : true → cases à cocher, le menu reste ouvert ;
   *               false → un clic choisit et ferme le menu
   *   vide      : libellé d'une option « aucune valeur » (choix simple), ou absent
   *   valeurVide: valeur renvoyée pour cette option ('' par défaut)
   *   surChoix  : appelée avec la valeur (simple) ou la liste (multiple)
   */
  function menuChoix(ancre, { options, selection = [], multiple = false, vide, valeurVide = '', surChoix }) {
    const menu = ouvrirMenu(ancre);
    const choisis = new Set(selection);
    const lignes = (vide && !multiple) ? [{ valeur: valeurVide, libelle: vide, estVide: true }, ...options] : options;
    if (!lignes.length) {
      menu.appendChild(Object.assign(document.createElement('div'), { className: 'fiche-menu-vide', textContent: 'Aucun choix possible' }));
    }
    lignes.forEach(o => {
      const item = document.createElement(multiple ? 'label' : 'button');
      item.className = 'fiche-menu-item' + (o.estVide ? ' fiche-menu-item-vide' : '');
      if (multiple) {
        const caseACocher = document.createElement('input');
        caseACocher.type = 'checkbox';
        caseACocher.checked = choisis.has(o.valeur);
        caseACocher.addEventListener('change', () => {
          if (caseACocher.checked) choisis.add(o.valeur); else choisis.delete(o.valeur);
          // On garde l'ordre des options, plus lisible que l'ordre des clics.
          surChoix(options.map(x => x.valeur).filter(v => choisis.has(v)));
        });
        item.append(caseACocher, document.createTextNode(' ' + o.libelle));
      } else {
        item.type = 'button';
        item.textContent = o.libelle;
        if (choisis.has(o.valeur)) item.classList.add('choisi');
        item.addEventListener('click', () => { fermerMenu(); surChoix(o.valeur); });
      }
      menu.appendChild(item);
    });
    return menu;
  }

  /**
   * Menu de date : un calendrier du navigateur et un bouton « Effacer ».
   *   valeur   : date actuelle au format AAAA-MM-JJ ('' si aucune)
   *   surChoix : appelée avec la nouvelle date (AAAA-MM-JJ, ou '' pour effacer)
   */
  function menuDate(ancre, { valeur = '', surChoix }) {
    const menu = ouvrirMenu(ancre);
    const saisie = document.createElement('input');
    saisie.type = 'date';
    saisie.className = 'fiche-menu-date';
    saisie.value = valeur;
    saisie.addEventListener('change', () => { if (saisie.value) { surChoix(saisie.value); fermerMenu(); } });
    const effacer = document.createElement('button');
    effacer.type = 'button';
    effacer.className = 'fiche-menu-item fiche-menu-item-vide';
    effacer.textContent = 'Effacer la date';
    effacer.addEventListener('click', () => { fermerMenu(); surChoix(''); });
    menu.append(saisie, effacer);
    setTimeout(() => saisie.focus(), 0);
    return menu;
  }

  /* ── 5. Dispositions « côté » / « centre » ─────────────────── */

  function dispositionMemorisee() {
    // try/catch : le stockage du navigateur peut être bloqué (navigation
    // privée, réglages de sécurité). On retombe alors sur « côté ».
    try {
      const d = localStorage.getItem(CLE_DISPOSITION);
      return DISPOSITIONS.includes(d) ? d : 'cote';
    } catch (_) { return 'cote'; }
  }

  function memoriserDisposition(d) {
    try { localStorage.setItem(CLE_DISPOSITION, d); } catch (_) { /* sans gravité */ }
  }

  /** Disposition actuelle d'un panneau : 'cote' ou 'centre'. */
  function disposition(panneau) {
    return panneau.classList.contains('fiche-centre') ? 'centre' : 'cote';
  }

  function estOuvert(panneau) { return panneau.classList.contains('open'); }

  // Applique une disposition : classe CSS du panneau, voile, bouton.
  function appliquer(panneau, d) {
    panneau.classList.toggle('fiche-centre', d === 'centre');
    if (voile) voile.classList.toggle('visible', d === 'centre' && estOuvert(panneau));
    const bouton = panneau.querySelector('.fiche-bascule');
    if (bouton) {
      bouton.textContent = d === 'centre' ? '⇥' : '⤢';
      bouton.title = d === 'centre' ? 'Afficher sur le côté' : 'Agrandir au centre';
    }
    // La largeur du titre a changé : son nombre de lignes aussi.
    requestAnimationFrame(() => ajusterTitres(panneau));
  }

  /**
   * Prépare un panneau à être une fiche (à appeler une fois, au chargement).
   *   panneau : l'élément du panneau (il doit utiliser la classe « open »)
   *   options.actions    : conteneur où placer le bouton de bascule ⤢ / ⇥
   *   options.fermer     : fonction de fermeture (appelée par un clic sur le voile)
   *   options.surBascule : fonction appelée avec 'cote' ou 'centre' après une bascule
   */
  function installer(panneau, options = {}) {
    if (!voile) {
      voile = document.createElement('div');
      voile.className = 'fiche-voile';
      document.body.appendChild(voile);
    }
    voile.addEventListener('click', () => { if (estOuvert(panneau) && options.fermer) options.fermer(); });

    if (options.actions) {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'fiche-bascule';
      bouton.addEventListener('click', () => {
        const nouvelle = disposition(panneau) === 'centre' ? 'cote' : 'centre';
        memoriserDisposition(nouvelle);
        appliquer(panneau, nouvelle);
        if (options.surBascule) options.surBascule(nouvelle);
      });
      options.actions.prepend(bouton);
    }
    appliquer(panneau, dispositionMemorisee());
  }

  /** Ouvre le panneau dans la disposition mémorisée ; la renvoie. */
  function ouvrir(panneau) {
    panneau.classList.add('open');
    const d = dispositionMemorisee();
    appliquer(panneau, d);
    return d;
  }

  function fermer(panneau) {
    fermerMenu();
    panneau.classList.remove('open');
    if (voile) voile.classList.remove('visible');
  }

  // Seul objet rendu visible au reste de la page.
  window.Fiche = {
    markdownVersHtml, markdownVersTexte, champMarkdown,
    estNotepad, notepadVersMarkdown,
    menuChoix, menuDate, fermerMenu, champTitre,
    installer, ouvrir, fermer, disposition,
  };
})();
