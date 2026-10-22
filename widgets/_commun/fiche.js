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

  /* ── 1. Markdown ───────────────────────────────────────────── */

  /** Markdown → HTML nettoyé, prêt à être inséré avec innerHTML. */
  function markdownVersHtml(texte) {
    if (!texte) return '';
    // breaks : un simple retour à la ligne est conservé, comme dans Grist.
    const html = marked.parse(String(texte), { breaks: true, gfm: true });
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
    let texte = valeur || '';

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

  /* ── 2. Dispositions « côté » / « centre » ─────────────────── */

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
    installer, ouvrir, fermer, disposition,
  };
})();
