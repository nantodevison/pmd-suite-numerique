// « Nouvelle carte » d'après la vue (#186) : règles communes de
// _commun/filtres.js vérifiées sur le module, puis dans le Kanban :
// préremplissage (champs du formulaire et colonne cachée), menus et listes
// rangés « dans la vue » / « Hors de la vue », avis si la carte sera masquée.
Banc.lancer(async () => {
  const { ok, $, $$, attendre } = Banc;

  // Colonne « Type » (Choix), absente du formulaire : ajoutée avant le démarrage
  const cols = FAUX_GRIST.meta._grist_Tables_column;
  [[14, 1, 'Type', 'Choice', 'Type', '', false, JSON.stringify({ choices: ['Atelier', 'Note'] }), 0]]
    .forEach(c => ['id', 'parentId', 'colId', 'type', 'label', 'formula', 'isFormula', 'widgetOptions', 'visibleCol']
      .forEach((k, i) => cols[k].push(c[i])));
  FAUX_GRIST.records.forEach((r, i) => { r.Type = i % 2 ? 'Note' : 'Atelier'; });
  await Banc.demarrer();
  const F = Filtres;
  const filtre = (col, op, valeurs) => ({ col, op, valeurs });

  // ── A. Règles communes (module) ──
  const pre = F.valeursAPreremplir([filtre('A', 'est', ['x']), filtre('B', 'est', ['y', 'z']),
    filtre('C', 'nestpas', ['w']), filtre('D', 'est', [F.VIDE]), filtre('E', 'est', ['@moi'])],
    v => v.map(x => x === '@moi' ? 'Alice' : x));
  ok('préremplir : seuls les filtres « est » à une valeur (hors vide), valeurs spéciales traduites',
    JSON.stringify(pre) === '{"A":"x","E":"Alice"}', JSON.stringify(pre));
  const filtres = [filtre('P', 'nestpas', ['Basse']), filtre('Q', 'est', ['a'])];
  ok('dans la vue : « n\'est pas » exclut la valeur cochée', !F.valeurDansLaVue(filtres, 'P', 'Basse') && F.valeurDansLaVue(filtres, 'P', 'Haute'));
  ok('dans la vue : les filtres des autres colonnes ne comptent pas', F.valeurDansLaVue(filtres, 'R', 'n\'importe'));
  ok('non respectés : colonne absente de la carte non jugée',
    F.filtresNonRespectes({ P: 'Basse' }, filtres).map(f => f.col).join() === 'P');
  ok('non respectés : colonne qui restera vide (\'\') jugée',
    F.filtresNonRespectes({ P: 'Haute', Q: '' }, filtres).map(f => f.col).join() === 'Q');
  const opts = ['a', 'b', 'c'].map(v => ({ valeur: v, libelle: v }));
  const rangees = F.rangerSelonVue(opts, o => o.valeur === 'b');
  ok('ranger : vue d\'abord, séparateur, puis les autres dans leur ordre',
    rangees.map(o => o.separateur || o.valeur).join('|') === `b|${F.HORS_VUE}|a|c`, rangees.map(o => o.separateur || o.valeur).join('|'));
  ok('ranger : sans séparateur si tout est du même côté', F.rangerSelonVue(opts, () => true) === opts);
  const doc = await Colonnes.lireDocument();
  ok('valeur à écrire : Choix, Référence, Liste de références',
    await Colonnes.valeurAEcrire(doc, 'Taches', 'Type', 'Note') === 'Note'
    && await Colonnes.valeurAEcrire(doc, 'Taches', 'EPIC', 'Archiver le site') === 3
    && JSON.stringify(await Colonnes.valeurAEcrire(doc, 'Taches', 'qui_', 'Bruno Lefèvre')) === '["L",2]');
  ok('valeur à écrire : formule ou nom introuvable → rien',
    await Colonnes.valeurAEcrire(doc, 'Taches', 'EPIC_Priorite', 'Now') === undefined
    && await Colonnes.valeurAEcrire(doc, 'Taches', 'EPIC', 'Inconnu') === undefined);

  // Outils : menu ouvert, ordre des lignes, avis
  const lignesMenu = () => [...($('.fiche-menu')?.querySelectorAll('.fiche-menu-libelle, .fiche-menu-separateur') || [])]
    .map(e => e.textContent).filter(t => !t.startsWith('—'));
  const choisirDansMenu = (texte) => [...$$('.fiche-menu button.fiche-menu-item')].find(b => b.textContent.startsWith(texte)).click();
  const avis = () => $('#modal-avis-vue');
  const alerte = () => avis()?.querySelector('.avis-vue-alerte')?.textContent || '';
  const info = () => avis()?.querySelector('.avis-vue-info')?.textContent || '';
  const creer = async (titre) => {
    $('#modal-titre').value = titre;
    const avant = FAUX_GRIST.actions.length;
    await submitAddCardModal();
    await attendre(100);
    return Banc.actionsDepuis(avant).find(a => a[0] === 'AddRecord')?.[3] || {};
  };

  // ── B. Sans filtre : rien ne change ──
  STATE.filters = [];
  await openAddCardModal('🖐️ À faire');
  await attendre(100);
  ok('sans filtre : avis masqué', avis()?.hidden === true);
  $('#modal-epic').click();
  await attendre(100);
  ok('sans filtre : menu EPIC sans séparateur', !$('.fiche-menu .fiche-menu-separateur'));
  Fiche.fermerMenu();
  ok('sans filtre : listes déroulantes sans groupe', !$('#modal-priorite optgroup') && !$('#modal-statut optgroup'));
  closeAddCardModal();

  // ── C. EPIC est X, Type est Atelier : préremplis ──
  STATE.filters = [filtre('EPIC', 'est', ['Préparer la démonstration']), filtre('Type', 'est', ['Atelier'])];
  await openAddCardModal('🖐️ À faire');
  await attendre(100);
  ok('EPIC prérempli', $('#modal-epic').textContent === 'Préparer la démonstration', $('#modal-epic').textContent);
  ok('colonne hors formulaire annoncée : « D\'après la vue : Type = Atelier »', info().includes('Type = Atelier'), info());
  ok('pas d\'alerte : la carte restera visible', alerte() === '' && !avis().hidden, alerte());
  $('#modal-epic').click();
  await attendre(100);
  ok('menu EPIC : EPIC de la vue, puis « Hors de la vue », puis les autres',
    lignesMenu().join('|') === 'Préparer la démonstration|Hors de la vue|Écrire la documentation|Archiver le site', lignesMenu().join('|'));
  choisirDansMenu('Archiver');
  await attendre(50);
  ok('EPIC hors de la vue : alerte « masquée par la vue (EPIC) »', /masquée par la vue \(EPIC\)/.test(alerte()), alerte());
  $('#modal-epic').click();
  await attendre(100);
  choisirDansMenu('Préparer');
  await attendre(50);
  ok('retour dans la vue : alerte retirée', alerte() === '', alerte());
  let champs = await creer('Carte de la vue');
  ok('création : EPIC = 2 et Type = Atelier écrits', champs.EPIC === 2 && champs.Type === 'Atelier', JSON.stringify(champs));

  // ── D. Plusieurs valeurs : rien de prérempli, mais rangées en tête ──
  STATE.filters = [filtre('EPIC', 'est', ['Écrire la documentation', 'Archiver le site']), filtre('Type', 'est', ['Atelier', 'Note'])];
  await openAddCardModal('🖐️ À faire');
  await attendre(100);
  ok('plusieurs valeurs : EPIC non prérempli', $('#modal-epic').textContent === '— aucun —');
  ok('plusieurs valeurs : alerte dès l\'ouverture (EPIC vide, Type vide)',
    /\(EPIC, Type\)/.test(alerte()), alerte());
  $('#modal-epic').click();
  await attendre(100);
  ok('plusieurs valeurs : les deux EPICs cochés en tête',
    lignesMenu().join('|') === 'Écrire la documentation|Archiver le site|Hors de la vue|Préparer la démonstration', lignesMenu().join('|'));
  choisirDansMenu('Écrire');
  await attendre(50);
  ok('EPIC choisi dans la vue : reste Type dans l\'alerte', /\(Type\)$/.test(alerte()), alerte());
  closeAddCardModal();

  // ── E. Priorité « n'est pas Basse » : liste déroulante en deux groupes ──
  STATE.filters = [filtre('Priorite', 'nestpas', ['Basse'])];
  await openAddCardModal('🖐️ À faire');
  await attendre(100);
  const groupes = [...$$('#modal-priorite optgroup')].map(g => `${g.label}: ${[...g.children].map(o => o.value).join(',')}`);
  ok('priorité : groupes « Dans la vue » / « Hors de la vue »',
    groupes.join(' / ') === 'Dans la vue: Haute,Moyenne / Hors de la vue: Basse', groupes.join(' / '));
  ok('priorité : option « — aucune — » gardée en tête', $('#modal-priorite').options[0].value === '');
  ok('priorité vide : pas d\'alerte (« n\'est pas Basse »)', alerte() === '', alerte());
  $('#modal-priorite').value = 'Basse';
  $('#modal-priorite').dispatchEvent(new Event('change'));
  ok('priorité Basse : alerte', /masquée par la vue \(Priorite/.test(alerte()), alerte());
  closeAddCardModal();

  // ── F. Priorité est Haute : liste préremplie et écrite ──
  STATE.filters = [filtre('Priorite', 'est', ['Haute'])];
  await openAddCardModal('🖐️ À faire');
  await attendre(100);
  ok('priorité préremplie', $('#modal-priorite').value === 'Haute', $('#modal-priorite').value);
  champs = await creer('Carte haute');
  ok('création : Priorite = Haute', champs.Priorite === 'Haute', JSON.stringify(champs));
  STATE.filters = [];
});
