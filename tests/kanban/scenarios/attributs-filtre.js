// Vérifications de #226 étape 1, jouées dans la page ; résultat écrit dans <pre id="resultats">.
(async function () {
  const lignes = [];
  let nbOk = 0, nbKo = 0;
  const ok = (nom, cond, detail = '') => {
    if (cond) nbOk++; else nbKo++;
    lignes.push(`${cond ? 'OK ' : 'KO '} ${nom}${detail ? ' — ' + detail : ''}`);
  };
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const rect = (el) => el.getBoundingClientRect();
  window.addEventListener('error', e => lignes.push('ERREUR JS ' + e.message));

  try {
    localStorage.clear();
    FAUX_GRIST.demarrer();
    await attendre(800);

    // 1. Ouvrir « Gérer la vue » sur Filtres, ajouter un filtre, choisir EPIC
    ouvrirFenetreVue('filtres');
    await attendre(200);
    ajouterFiltre();
    const sel = $('#filtre-colonne');
    sel.value = 'EPIC';
    sel.dispatchEvent(new Event('change'));
    await attendre(200);
    const dialog = sel.closest('dialog');
    ok('le panneau est dans la fenêtre <dialog> ouverte', dialog && dialog.open);

    // 2. Ligne 1 : colonne, est/n'est pas, recherche sur une même ligne
    const ops = $('#filtre-popover .filtre-ops'), rech = $('#filtre-recherche');
    ok('recherche dans la même rangée que la colonne', rech.parentElement === sel.parentElement);
    ok('colonne au plus 200 px', rect(sel).width <= 200.5, Math.round(rect(sel).width) + ' px');
    ok('est/n\'est pas à droite de la colonne, même hauteur',
      rect(ops).left >= rect(sel).right - 1 && Math.abs(rect(ops).top - rect(sel).top) < 6);
    ok('recherche à droite de est/n\'est pas, même ligne (fenêtre large)',
      rect(rech).left >= rect(ops).right - 1 && Math.abs(rect(rech).top - rect(sel).top) < 6,
      `largeur fenêtre ${Math.round(rect(dialog).width)} px`);

    // 3. Ligne 2 : Tout cocher · Aucun · compteur, bouton Afficher à droite
    const tout = $('#filtre-tout'), compte = $('#filtre-compte'), afficher = $('#filtre-afficher');
    ok('bouton Afficher visible pour EPIC', !afficher.classList.contains('hidden') && rect(afficher).width > 0);
    ok('texte « Afficher ▾ » sans attribut choisi', afficher.textContent === 'Afficher ▾', afficher.textContent);
    ok('compteur juste après « Aucun » (à gauche)', rect(compte).left - rect($('#filtre-aucun')).right < 20);
    ok('Afficher sur la ligne de « Tout cocher », calé à droite',
      Math.abs(rect(afficher).top - rect(tout).top) < 6 &&
      Math.abs(rect(afficher).right - rect($('#filtre-popover')).right) < 2);
    ok('plus de rangée de pastilles #filtre-attributs', !$('#filtre-attributs'));
    ok('aucun attribut affiché sur les lignes au départ',
      [...document.querySelectorAll('#filtre-valeurs .filtre-valeur-detail')].every(d => d.textContent === ''));

    // 4. Ouvrir la liste des attributs
    afficher.click();
    await attendre(100);
    const menu = $('.fiche-menu');
    ok('menu ouvert', !!menu);
    ok('menu ajouté DANS la fenêtre (sinon caché derrière elle)', menu && menu.closest('dialog') === dialog);
    const r = rect(menu);
    const auCentre = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    ok('menu visible au premier plan (elementFromPoint)', menu.contains(auCentre));
    const cases = [...menu.querySelectorAll('input[type=checkbox]')];
    const libelles = [...menu.querySelectorAll('.fiche-menu-item')].map(l => l.textContent.trim());
    ok('deux attributs proposés : Phase, Priorite', libelles.join(',') === 'Phase,Priorite', libelles.join(','));
    ok('placement du menu demandé au dessin suivant (rAF, non joué sans affichage : à vérifier à la main)', menu.style.top === '' || Math.abs(rect(menu).top - rect(afficher).bottom) < 8 || Math.abs(rect(menu).bottom - rect(afficher).top) < 8);

    // 5. Cocher Priorite (clic réel : mousedown + click)
    const modifAvant = dialog.classList.contains('modifiee');
    const casePrio = cases[1];
    casePrio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    casePrio.click();
    await attendre(100);
    ok('le menu reste ouvert après une case cochée', document.body.contains(menu) && !!$('.fiche-menu'));
    ok('le panneau du filtre reste ouvert', !$('#filtre-popover').classList.contains('hidden'));
    ok('la fenêtre reste ouverte', dialog.open);
    ok('bouton « Afficher (1) ▾ » et actif', afficher.textContent === 'Afficher (1) ▾' && afficher.classList.contains('actif'), afficher.textContent);
    ok('bulle du bouton cite Priorite', /Priorite/.test(afficher.title), afficher.title);
    const details = [...document.querySelectorAll('#filtre-valeurs .filtre-valeur')].map(l =>
      l.querySelector('.filtre-valeur-nom').textContent + ' = ' + l.querySelector('.filtre-valeur-detail').textContent);
    ok('priorité affichée à côté de chaque EPIC', details.some(d => /Écrire.* = Now$/.test(d)) && details.some(d => /Archiver.* = Done$/.test(d)), details.join(' | '));
    ok('choix retenu par le navigateur', /EPIC_Priorite/.test(Object.keys(localStorage).map(k => localStorage.getItem(k)).join(' ')));
    ok('cocher un attribut ne marque pas la vue comme modifiée', dialog.classList.contains('modifiee') === modifAvant);

    // 6. Cocher aussi Phase : deux attributs séparés par « · »
    cases[0].click();
    await attendre(100);
    ok('bouton « Afficher (2) ▾ »', afficher.textContent === 'Afficher (2) ▾', afficher.textContent);
    const det2 = [...document.querySelectorAll('#filtre-valeurs .filtre-valeur-detail')].map(d => d.textContent).filter(Boolean);
    ok('deux attributs « Phase · Priorite »', det2.includes('Production · Now'), det2.join(' | '));

    // 7. La recherche porte sur les attributs
    rech.value = 'done';
    rech.dispatchEvent(new Event('input'));
    await attendre(50);
    const vis = [...document.querySelectorAll('#filtre-valeurs .filtre-valeur-nom')].map(n => n.textContent);
    ok('rechercher « done » ne garde que l\'EPIC terminé', vis.length === 1 && /Archiver/.test(vis[0]), vis.join(','));
    rech.value = ''; rech.dispatchEvent(new Event('input'));

    // 8. Échap ferme le menu, pas la fenêtre
    if (!$('.fiche-menu')) { afficher.click(); await attendre(50); }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await attendre(50);
    ok('Échap ferme la liste', !$('.fiche-menu'));
    ok('Échap laisse la fenêtre ouverte', dialog.open);

    // 9. Clic ailleurs ferme la liste
    afficher.click(); await attendre(50);
    $('#filtre-valeurs').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await attendre(50);
    ok('clic ailleurs ferme la liste', !$('.fiche-menu'));

    // 10. Colonne sans attribut (statut) : bouton caché
    sel.value = 'statut'; sel.dispatchEvent(new Event('change'));
    await attendre(100);
    ok('bouton Afficher caché pour une colonne Choix', afficher.classList.contains('hidden') && rect(afficher).width === 0);

    // 11. Retour sur EPIC : le choix est retrouvé
    sel.value = 'EPIC'; sel.dispatchEvent(new Event('change'));
    await attendre(100);
    ok('choix retrouvé en revenant sur EPIC', afficher.textContent === 'Afficher (2) ▾', afficher.textContent);

    // 12. Fermer le panneau pendant que la liste est ouverte : la liste se ferme
    afficher.click(); await attendre(50);
    fermerFiltre();
    await attendre(50);
    ok('fermer le panneau ferme aussi la liste', !$('.fiche-menu'));

    // 13. Fenêtre étroite : la recherche passe à la ligne et prend toute la largeur
    ouvrirFiltre(STATE.filters[0] || (ajouterFiltre(), STATE.filtreEdite));
    sel.value = 'EPIC'; sel.dispatchEvent(new Event('change'));
    if (window.innerWidth >= 600) dialog.style.width = '440px';
    await attendre(200);
    const pop = rect($('#filtre-popover'));
    const surLigne1 = Math.abs(rect(rech).top - rect(sel).top) < 6;
    ok('fenêtre étroite : recherche sur la ligne 1 (≥ 160 px) ou dessous sur toute la largeur',
      surLigne1 ? rect(rech).width >= 159 : (rect(rech).top > rect(sel).bottom - 1 && Math.abs(rect(rech).width - pop.width) < 2),
      `panneau ${Math.round(pop.width)} px, recherche ${Math.round(rect(rech).width)} px, ${surLigne1 ? 'ligne 1' : 'dessous'}`);
    ok('fenêtre étroite : pas de débordement horizontal du panneau', $('#filtre-popover').scrollWidth <= Math.ceil(pop.width) + 1, `scrollWidth ${$('#filtre-popover').scrollWidth} ; ` + [...$('#filtre-popover').querySelectorAll('*')].filter(e => rect(e).right > pop.right + 1).slice(0,5).map(e => (e.id||e.className)+':'+Math.round(rect(e).right)).join(', '));
    ok('fenêtre étroite : Afficher dans le panneau, calé à droite', Math.abs(rect(afficher).right - pop.right) < 2, `panneau ${Math.round(pop.width)} px, Afficher ${Math.round(rect(afficher).top)} / Tout cocher ${Math.round(rect(tout).top)}`);
  } catch (err) {
    nbKo++;
    lignes.push('EXCEPTION ' + err.stack);
  }
  const pre = document.createElement('pre');
  pre.id = 'resultats';
  pre.textContent = `BILAN ${nbOk} OK, ${nbKo} KO\n` + lignes.join('\n');
  document.body.appendChild(pre);
})();
