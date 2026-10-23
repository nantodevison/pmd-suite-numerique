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

  /* ── 3. Dispositions « côté » / « centre » ─────────────────── */

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
    panneau.classList.remove('open');
    if (voile) voile.classList.remove('visible');
  }

  // Seul objet rendu visible au reste de la page.
  window.Fiche = {
    markdownVersHtml, markdownVersTexte, champMarkdown,
    estNotepad, notepadVersMarkdown,
    installer, ouvrir, fermer, disposition,
  };
})();
