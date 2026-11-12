// Registre des vues (../_commun/vues.js, #231) : vérifié directement sur le
// module (données inventées), puis dans le Kanban : vues enregistrées par la
// version précédente relues telles quelles (mêmes clés, même champ `projet`).
Banc.lancer(async () => {
  const { ok, attendre } = Banc;

  // ── Un registre de test : mémoire et écritures observées ──
  let cle = (nom) => `banc.${nom}`;
  let ctx = 15;
  const ecrites = [];          // vues partagées reçues par ecrirePartagees
  const alertes = [];          // messages de prevenir
  let refuser = false;         // ecrirePartagees échoue (droits)
  localStorage.clear();
  const R = Vues.creer({
    cle: (nom) => cle(nom),
    contexte: () => ctx,
    ecrirePartagees: (liste) => { if (refuser) return Promise.reject(new Error('refus')); ecrites.push(liste); return Promise.resolve(); },
    prevenir: (m) => alertes.push(m),
    defaut: { colonnes: null },
  });

  // ── Ouverture ──
  const partagees = [
    { id: 'p1', nom: 'Zèbre',  filtres: [], tri: [], projet: 15 },
    { id: 'p2', nom: 'autre projet', filtres: [], tri: [], projet: 7 },
    { id: 'p3', nom: 'ancienne', filtres: [], tri: [] },               // sans projet : visible partout
  ];
  localStorage.setItem('banc.vuesPerso', JSON.stringify([{ id: 'm1', nom: 'Mienne', filtres: [], tri: [] }]));
  R.charger(partagees, 'inconnue', 'p3');
  ok('ouverture : partagées puis perso', R.toutes().map(v => v.id).join() === 'p1,p2,p3,m1', R.toutes().map(v => v.id).join());
  ok('vue perso marquée perso', R.trouver('m1')?.perso === true);
  ok('vue active : premier candidat connu (ancien réglage)', R.activeId() === 'p3', R.activeId());
  localStorage.setItem('banc.vueActive', 'm1');
  R.charger(partagees, 'p3');
  ok('vue active : celle retenue par le navigateur passe avant', R.activeId() === 'm1', R.activeId());
  localStorage.setItem('banc.vueActive', 'p2');
  R.charger(partagees);
  ok('vue d\'un autre projet retenue : « Toutes les cartes »', R.activeId() === Vues.DEFAUT, R.activeId());
  R.charger('pas une liste');
  ok('options illisibles : aucune vue partagée, sans planter', R.toutes().map(v => v.id).join() === 'm1');
  R.charger(partagees);

  // ── Contexte ──
  ok('vue d\'un autre projet : introuvable', R.trouver('p2') === undefined);
  ok('… mais gardée dans le registre', R.toutes().some(v => v.id === 'p2'));
  ok('« Toutes les cartes » : fixe, avec les champs du widget',
    R.trouver(Vues.DEFAUT)?.defaut === true && R.trouver(Vues.DEFAUT).colonnes === null && R.trouver(Vues.DEFAUT).nom === 'Toutes les cartes');
  ok('rangées : défaut, partagées de A à Z, puis perso',
    R.rangees().map(v => v.id).join() === 'defaut,p3,p1,m1', R.rangees().map(v => v.id).join());
  ctx = null;
  ok('sans contexte : toutes les partagées visibles', R.rangees().map(v => v.id).join() === 'defaut,p3,p2,p1,m1', R.rangees().map(v => v.id).join());
  ctx = 15;

  // ── Construire et ajouter ──
  const nouvelle = R.construire('Nouvelle', false, { filtres: [{ col: 'P', op: 'est', valeurs: ['a'] }], tri: [], colonnes: ['x'] });
  ok('vue partagée : retient le projet', nouvelle.projet === 15 && !nouvelle.perso);
  ok('champs du widget gardés tels quels', nouvelle.colonnes.join() === 'x' && /^vue-/.test(nouvelle.id));
  R.ajouter(nouvelle);
  await attendre(20);
  ok('ajout partagée : active, retenue par le navigateur', R.activeId() === nouvelle.id && localStorage.getItem('banc.vueActive') === nouvelle.id);
  const derniere = ecrites[ecrites.length - 1] || [];
  ok('écriture des partagées : vue d\'un autre projet comprise, aucune perso',
    derniere.map(v => v.id).join() === `p1,p2,p3,${nouvelle.id}`, derniere.map(v => v.id).join());
  const nbEcrites = ecrites.length;
  const perso = R.construire('À moi', true, { filtres: [], tri: [] });
  ok('vue perso : pas de projet', perso.perso === true && !('projet' in perso));
  R.ajouter(perso);
  await attendre(20);
  ok('ajout perso : rien d\'écrit dans le document', ecrites.length === nbEcrites);
  ok('ajout perso : retenue par le navigateur',
    JSON.parse(localStorage.getItem('banc.vuesPerso')).map(v => v.nom).join() === 'Mienne,À moi');

  // ── Renommer, supprimer ──
  R.renommer(perso, 'À moi seul');
  ok('renommer : mémorisé', localStorage.getItem('banc.vuesPerso').includes('À moi seul'));
  R.supprimer(perso);
  ok('supprimer la vue active : « Toutes les cartes »', R.activeId() === Vues.DEFAUT && !R.toutes().includes(perso));
  ok('supprimer : retirée de la mémoire', !localStorage.getItem('banc.vuesPerso').includes('À moi'));
  R.activer('p1');
  R.supprimer(nouvelle);
  ok('supprimer une autre vue : la vue active ne change pas', R.activeId() === 'p1');
  R.activer('p2');
  ok('activer une vue invisible : « Toutes les cartes »', R.activeId() === Vues.DEFAUT);

  // ── Autre contexte : vues perso relues ──
  localStorage.setItem('banc2.vuesPerso', JSON.stringify([{ id: 'm9', nom: 'Ailleurs', filtres: [], tri: [] }]));
  R.activer('m1');
  cle = (nom) => `banc2.${nom}`;
  ok('relire : la vue active a disparu, on le signale', R.relirePerso() === true && R.activeId() === Vues.DEFAUT);
  ok('relire : perso de l\'autre clé, partagées gardées', R.toutes().map(v => v.id).join() === 'p1,p2,p3,m9', R.toutes().map(v => v.id).join());
  R.activer('p1');
  ok('relire : vue active toujours là, rien à signaler', R.relirePerso() === false && R.activeId() === 'p1');

  // ── Échecs ──
  cle = () => null;   // document encore inconnu
  R.ajouter(R.construire('Sans mémoire', true));
  ok('mémoire indisponible : l\'utilisateur est prévenu', alertes.some(m => m.includes('vues personnelles')), alertes.join(' / '));
  refuser = true;
  R.ajouter(R.construire('Refusée', false));
  await attendre(20);
  ok('écriture refusée par Grist : l\'utilisateur est prévenu', alertes.some(m => m.includes('droits')), alertes.join(' / '));

  // ── Dans le Kanban : vues de la version précédente relues telles quelles ──
  localStorage.clear();
  const cleKanban = (nom) => `kanban.${nom}.docTest.Taches.15`;
  localStorage.setItem(cleKanban('vuesPerso'),
    JSON.stringify([{ id: 'vue-perso1', nom: 'Ma vue', filtres: [{ col: 'statut', op: 'est', valeurs: ['🖐️ À faire'] }], colonnes: null, tri: [] }]));
  localStorage.setItem(cleKanban('vueActive'), 'vue-perso1');
  FAUX_GRIST.demarrer({ vues: [
    { id: 'vue-part1', nom: 'Partagée', filtres: [], colonnes: null, tri: [], projet: 15 },
    { id: 'vue-part2', nom: 'Projet 7', filtres: [], colonnes: null, tri: [], projet: 7 },
  ] });
  await attendre(800);
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  ok('clé de mémoire inchangée', cleMemoire('vuesPerso') === cleKanban('vuesPerso'), cleMemoire('vuesPerso'));
  ok('vue perso d\'avant #231 : retrouvée et active', STATE.activeView === 'vue-perso1', STATE.activeView);
  ok('… avec ses filtres appliqués', Banc.cartes().join() === '1,4', Banc.cartes().join());
  // Vues proposées (onglets ou liste ▾, selon la largeur)
  const onglets = vuesRangees().map(v => (v.perso ? '🔒 ' : '') + v.nom);
  ok('vues proposées : partagée du projet et perso, pas celle du projet 7',
    onglets.join('|') === 'Toutes les cartes|Partagée|🔒 Ma vue', onglets.join('|'));
  switchView('vue-part1');
  ok('changer de vue : retenu sous la même clé', localStorage.getItem(cleKanban('vueActive')) === 'vue-part1');
  renommerVue('Partagée bis');
  await attendre(50);
  ok('renommer une partagée : vue du projet 7 toujours écrite',
    (FAUX_GRIST.options.vues || []).map(v => v.nom).join() === 'Partagée bis,Projet 7', JSON.stringify(FAUX_GRIST.options.vues));
});
