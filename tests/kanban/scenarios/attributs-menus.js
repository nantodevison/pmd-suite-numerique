// Vérifications de #226 étape 2 : menus de la fiche et de « Nouvelle carte ».
(async function () {
  const lignes = [];
  let nbOk = 0, nbKo = 0;
  const ok = (nom, cond, detail = '') => {
    if (cond) nbOk++; else nbKo++;
    lignes.push(`${cond ? 'OK ' : 'KO '} ${nom}${detail ? ' — ' + detail : ''}`);
  };
  const attendre = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const rect = (el) => el.getBoundingClientRect();
  const boutonTexte = (txt) => $$('button').find(b => b.textContent.trim().startsWith(txt));
  const detailDe = (menu, nom) => {
    const item = [...menu.querySelectorAll('.fiche-menu-item')].find(i => i.querySelector('.fiche-menu-libelle')?.textContent === nom);
    return item ? (item.querySelector('.fiche-menu-attributs-valeur')?.textContent ?? '(pas de zone)') : '(option absente)';
  };
  // Le placement du menu se fait au dessin suivant (requestAnimationFrame), que
  // Chrome sans affichage ne joue pas : s'il n'a pas eu lieu, on le simule (sous l'ancre).
  let dernierAncre = null;
  const visibleAuPremierPlan = (el) => {
    if (el.style.top === '' && dernierAncre) {
      const a = rect(dernierAncre);
      // Comme placerMenu de fiche.js : sous l'ancre, sans sortir de l'écran à droite
      el.style.top = `${a.bottom + 4}px`;
      el.style.left = `${Math.max(4, Math.min(a.left, window.innerWidth - el.offsetWidth - 8))}px`;
    }
    const r = rect(el);
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
    if (!el.contains(dessus)) lignes.push(`   (au point du menu : ${dessus?.tagName}.${dessus?.className} ; menu ${Math.round(r.left)},${Math.round(r.top)})`);
    return el.contains(dessus);
  };
  const echap = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  window.addEventListener('error', e => lignes.push('ERREUR JS ' + e.message));

  try {
    localStorage.clear();
    FAUX_GRIST.demarrer();
    await attendre(800);
    // Mode d'emploi ouvert à la première visite (mémoire vidée) : on le ferme
    const ouvertes = $$('dialog[open]');
    ouvertes.forEach(d => d.close());
    ok('mode d\'emploi de première visite fermé', $$('dialog[open]').length === 0, `${ouvertes.length} fenêtre(s) fermée(s)`);

    ok('onRecords demande toutes les colonnes (includeColumns normal)', FAUX_GRIST.optionsRecords?.includeColumns === 'normal', JSON.stringify(FAUX_GRIST.optionsRecords));
    ok('colonne masquée dans le widget reçue (qui__Equipe)', STATE.records.some(r => 'qui__Equipe' in r));

    // ── A. Fiche : menu EPIC d'une carte sans EPIC ──
    await openEditPanel(4);
    await attendre(300);
    const choisirEpic = boutonTexte('🏷️ + Choisir un EPIC');
    ok('fiche : pastille « + Choisir un EPIC »', !!choisirEpic);
    dernierAncre = choisirEpic;
    choisirEpic.click();
    await attendre(100);
    let menu = $('.fiche-menu');
    ok('fiche : menu EPIC ouvert, au premier plan', !!menu && visibleAuPremierPlan(menu));
    const afficher = menu.querySelector('.fiche-menu-afficher');
    ok('fiche : bouton « Afficher ▾ » en tête du menu', afficher && afficher.textContent === 'Afficher ▾', afficher?.textContent);
    ok('fiche : liste des attributs repliée au départ', menu.querySelector('.fiche-menu-attributs').hidden);
    const libelles = [...menu.querySelectorAll('.fiche-menu-libelle')].map(l => l.textContent);
    ok('fiche : options « — aucun — » + 3 EPICs', libelles.length === 4, libelles.join(' | '));
    ok('fiche : aucun attribut affiché au départ', detailDe(menu, "Écrire la documentation") === '');

    afficher.click();
    await attendre(50);
    ok('fiche : « Afficher » déplie la liste, le menu reste ouvert',
      !menu.querySelector('.fiche-menu-attributs').hidden && document.body.contains(menu));
    const casesAttr = [...menu.querySelectorAll('.fiche-menu-attributs input')];
    ok('fiche : attributs proposés Phase, Priorite',
      [...menu.querySelectorAll('.fiche-menu-attributs label')].map(l => l.textContent.trim()).join(',') === 'Phase,Priorite');
    casesAttr[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    casesAttr[1].click();
    await attendre(50);
    ok('fiche : cocher Priorite garde le menu ouvert', document.body.contains(menu));
    ok('fiche : bouton « Afficher (1) ▾ »', afficher.textContent === 'Afficher (1) ▾', afficher.textContent);
    ok('fiche : priorité à côté de chaque EPIC',
      detailDe(menu, "Écrire la documentation") === 'Now' && detailDe(menu, 'Archiver le site') === 'Done',
      `${detailDe(menu, "Écrire la documentation")} / ${detailDe(menu, 'Archiver le site')}`);
    // Cocher aussi Phase (texte long pour « Préparer… ») : Priorite doit rester visible
    casesAttr[0].click();
    await attendre(50);
    const itemFac = [...menu.querySelectorAll('.fiche-menu-item')].find(i => i.textContent.startsWith('Préparer'));
    const blocs = [...itemFac.querySelectorAll('.fiche-attribut')];
    const zoneFac = itemFac.querySelector('.fiche-menu-attributs-valeur');
    ok('texte long : deux attributs, chacun dans son bloc', blocs.length === 2, blocs.map(b => b.textContent).join(' | '));
    ok('texte long : le 1er attribut est coupé (≤ 12em)', blocs[0] && rect(blocs[0]).width < 200, Math.round(rect(blocs[0]).width) + ' px');
    ok('texte long : Priorite « Then » entièrement visible dans la ligne',
      blocs[1] && rect(blocs[1]).right <= rect(zoneFac).right + 1 && rect(blocs[1]).right <= rect(menu).right,
      `bloc ${Math.round(rect(blocs[1]).right)} / zone ${Math.round(rect(zoneFac).right)} / menu ${Math.round(rect(menu).right)}`);
    ok('menu élargi avec des attributs (> 320 px)', rect(menu).width > 320, Math.round(rect(menu).width) + ' px');
    ok('bulle : texte entier du 1er attribut', blocs[0]?.title.startsWith('Cadrage des objectifs'));
    casesAttr[0].click(); // on revient à Priorite seule pour la suite
    await attendre(50);
    ok('fiche : « — aucun — » sans attribut', !menu.querySelector('.fiche-menu-item-vide .fiche-menu-attributs-valeur'));
    ok('choix partagé avec le filtre (même mémoire)', attributsAffiches('EPIC').join(',') === 'EPIC_Priorite', attributsAffiches('EPIC').join(','));

    // Choisir un EPIC : le menu se ferme et la fiche le montre
    [...menu.querySelectorAll('button.fiche-menu-item')].find(b => b.textContent.startsWith('Préparer')).click();
    await attendre(100);
    ok('fiche : choisir un EPIC ferme le menu', !$('.fiche-menu'));
    ok('fiche : l\'EPIC choisi est affiché', !!boutonTexte('🏷️ Préparer'), boutonTexte('🏷️')?.textContent);
    ok('fiche : la fiche est marquée modifiée', STATE.editPanel.dirty);

    // ── B. Fiche : Assigné à (liste de références), attributs appariés un à un ──
    boutonTexte('👤 + Assigner').click();
    await attendre(100);
    menu = $('.fiche-menu');
    ok('fiche : menu Assigné à, 2 personnes, avec « Afficher ▾ »',
      menu.querySelectorAll('.fiche-menu-libelle').length === 2 && !!menu.querySelector('.fiche-menu-afficher'),
      [...menu.querySelectorAll('.fiche-menu-libelle')].map(l => l.textContent).join(' | '));
    menu.querySelector('.fiche-menu-afficher').click();
    menu.querySelector('.fiche-menu-attributs input').click();
    await attendre(50);
    ok('liste de références : Alice = Études, Bruno = Terrain (appariés un à un)',
      detailDe(menu, 'Alice Durand') === 'Études' && detailDe(menu, 'Bruno Lefèvre') === 'Terrain',
      `${detailDe(menu, 'Alice Durand')} / ${detailDe(menu, 'Bruno Lefèvre')}`);
    echap();
    await attendre(50);
    ok('fiche : Échap ferme le menu sans fermer la fiche', !$('.fiche-menu') && STATE.editPanel.recordId === 4);

    // Statut : menu sans attributs, inchangé
    $$('.fiche-pastille').find(b => /À faire/.test(b.textContent))?.click();
    await attendre(50);
    ok('fiche : menu Statut sans en-tête « Afficher »', !!$('.fiche-menu') && !$('.fiche-menu .fiche-menu-entete'));
    echap();
    closeEditPanel(true);
    await attendre(100);

    // ── C. Nouvelle carte ──
    await openAddCardModal('🖐️ À faire');
    await attendre(200);
    const modal = $('#add-card-modal');
    const champEpic = $('#modal-epic'), champQui = $('#modal-assigne');
    ok('création : EPIC est une pastille, plus une liste déroulante', champEpic?.tagName === 'BUTTON' && champEpic.classList.contains('modal-ref'));
    ok('création : Assigné à est une pastille', champQui?.tagName === 'BUTTON');
    ok('création : textes vides « — aucun — » / « — personne — »',
      champEpic.textContent === '— aucun —' && champQui.textContent === '— personne —', `${champEpic.textContent} / ${champQui.textContent}`);
    dernierAncre = champEpic;
    champEpic.click();
    await attendre(100);
    menu = $('.fiche-menu');
    ok('création : menu au premier plan, au-dessus de la fenêtre', !!menu && visibleAuPremierPlan(menu));
    ok('création : même réglage « Afficher (1) ▾ »', menu.querySelector('.fiche-menu-afficher')?.textContent === 'Afficher (1) ▾');
    ok('création : priorité affichée', detailDe(menu, 'Préparer la démonstration') === 'Then');
    [...menu.querySelectorAll('button.fiche-menu-item')].find(b => b.textContent.startsWith('Archiver')).click();
    await attendre(50);
    ok('création : EPIC choisi affiché dans la pastille', champEpic.textContent === 'Archiver le site', champEpic.textContent);
    ok('création : la fenêtre reste ouverte', !modal.classList.contains('hidden'));

    champQui.click();
    await attendre(100);
    menu = $('.fiche-menu');
    [...menu.querySelectorAll('label.fiche-menu-item input')].filter(c => !c.closest('.fiche-menu-attributs')).forEach(c => c.click());
    await attendre(50);
    ok('création : deux personnes cochées', champQui.textContent === 'Alice Durand, Bruno Lefèvre', champQui.textContent);
    echap();
    await attendre(50);
    ok('création : Échap ferme le menu, pas la fenêtre', !$('.fiche-menu') && !modal.classList.contains('hidden'));

    // Enregistrement
    $('#modal-titre').value = 'Carte de test';
    const avant = FAUX_GRIST.actions.length;
    await submitAddCardModal();
    await attendre(100);
    const champs = FAUX_GRIST.actions.slice(avant).flat().find(a => a[0] === 'AddRecord')?.[3] || {};
    ok('création : AddRecord avec EPIC = 3 (numéro)', champs.EPIC === 3, JSON.stringify(champs));
    ok('création : qui_ = [\'L\', 1, 2]', JSON.stringify(champs.qui_) === '["L",1,2]', JSON.stringify(champs.qui_));

    // Nouvelle ouverture : formulaire vide, et création sans EPIC ni personne
    await openAddCardModal('🖐️ À faire');
    await attendre(100);
    ok('création : nouvelle ouverture repartie à vide',
      $('#modal-epic').textContent === '— aucun —' && $('#modal-assigne').textContent === '— personne —');
    $('#modal-titre').value = 'Sans EPIC';
    const avant2 = FAUX_GRIST.actions.length;
    await submitAddCardModal();
    await attendre(100);
    const champs2 = FAUX_GRIST.actions.slice(avant2).flat().find(a => a[0] === 'AddRecord')?.[3] || {};
    ok('création sans EPIC ni personne : champs non envoyés', champs2.Nom === 'Sans EPIC' && !('EPIC' in champs2) && !('qui_' in champs2), JSON.stringify(champs2));
  } catch (err) {
    nbKo++;
    lignes.push('EXCEPTION ' + err.stack);
  }
  const pre = document.createElement('pre');
  pre.id = 'resultats';
  pre.textContent = `BILAN ${nbOk} OK, ${nbKo} KO\n` + lignes.join('\n');
  document.body.appendChild(pre);
})();
