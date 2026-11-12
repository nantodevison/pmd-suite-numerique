// Structure du document (#188) : lue par ../_commun/colonnes.js une fois par
// rafraîchissement, références à jour à l'ouverture d'une fiche, couleurs et
// ordre des choix, colonnes rapportées, échec de lecture sans plantage.
Banc.lancer(async () => {
  const { ok, attendre } = Banc;
  const nb = (table) => FAUX_GRIST.lectures.filter(t => t === table).length;

  await Banc.demarrer();

  // ── Lectures à l'ouverture ──
  ok('ouverture : structure lue une seule fois', nb('_grist_Tables_column') === 1, FAUX_GRIST.lectures.join());
  ok('ouverture : table des EPICs lue une seule fois (noms et projet de chaque EPIC)', nb('EPICs') === 1, FAUX_GRIST.lectures.join());
  ok('ouverture : personnes et projets lus une fois', nb('Contacts') === 1 && nb('Projets2') === 1, FAUX_GRIST.lectures.join());

  // ── Références : correspondance numéro ↔ nom ──
  ok('EPIC n° 2 : son nom', nomAffiche('epic', 2) === 'Préparer la démonstration', nomAffiche('epic', 2));
  ok('personne n° 2 : son nom', nomAffiche('assigne', 2) === 'Bruno Lefèvre', nomAffiche('assigne', 2));
  ok('EPIC n° 1 : rattaché au projet n° 15', REFS.epic.options.find(o => o.id === 1)?.projetId === 15);

  // ── Colonnes du tri et des filtres ──
  const libelle = (colId) => STATE.colonnesTriables.find(c => c.colId === colId)?.label;
  ok('libellé Grist de la colonne (« Échéance »)', libelle('date_cible') === 'Échéance', libelle('date_cible'));
  ok('colonne rapportée : « EPIC › Priorite »', libelle('EPIC_Priorite') === 'EPIC › Priorite', libelle('EPIC_Priorite'));
  ok('colonne rapportée d\'une liste : « qui ? › Équipe »',
    /^qui \? › Équipe/.test(libelle('qui__Equipe') || ''), libelle('qui__Equipe'));
  const filtrables = STATE.colonnesFiltrables.map(c => c.colId);
  ok('filtres : choix et références seulement', filtrables.includes('Priorite') && filtrables.includes('EPIC')
    && filtrables.includes('qui_') && !filtrables.includes('Nom') && !filtrables.includes('date_cible'), filtrables.join());
  ok('colonnes internes absentes', !STATE.colonnesTriables.some(c => c.colId === 'manualSort'));

  // ── Choix : ordre et couleurs ──
  ok('choix dans l\'ordre de Grist', (STATE.choix.Priorite || []).join() === 'Haute,Moyenne,Basse', String(STATE.choix.Priorite));
  const haute = styleChoix('Priorite', 'Haute');
  ok('couleur du choix réglée dans Grist', haute && haute.fond === '#FECACA' && haute.texte === '#7F1D1D', JSON.stringify(haute));
  ok('choix sans couleur : aucun style', styleChoix('Priorite', 'Basse') === null);

  // ── Fraîcheur : un EPIC créé dans Grist apparaît à l'ouverture d'une fiche ──
  const e = FAUX_GRIST.donnees.EPICs;
  e.id.push(4); e.Nom.push('Tester le banc'); e.Priorite.push('Then'); e.Phase.push('Cadrage'); e.Projet.push(15);
  FAUX_GRIST.lectures.length = 0;
  await openEditPanel(1);
  await attendre(200);
  ok('fiche : structure relue une fois', nb('_grist_Tables_column') === 1, FAUX_GRIST.lectures.join());
  ok('fiche : table des EPICs relue une fois', nb('EPICs') === 1, FAUX_GRIST.lectures.join());
  ok('fiche : le nouvel EPIC est connu', nomAffiche('epic', 4) === 'Tester le banc', nomAffiche('epic', 4));
  ok('fiche : le nouvel EPIC est rattaché à son projet', REFS.epic.options.find(o => o.id === 4)?.projetId === 15);
  closeEditPanel(true);

  // ── Listes de ⚙ : référence relue à la demande ──
  const projets = await lireReferenceFraiche('Projet');
  ok('⚙ : projets proposés', projets && projets.options.map(o => o.nom).join() === 'Kanban', JSON.stringify(projets?.options));
  ok('⚙ : colonne ordinaire, pas de référence', (await lireReferenceFraiche('Nom')) === null);

  // ── Recherche : plus aucune lecture dans Grist ──
  ok('Recherche.lireStructure retirée', typeof Recherche.lireStructure === 'undefined');
  FAUX_GRIST.lectures.length = 0;
  changerRecherche('démonstration');
  await attendre(100);
  ok('recherche par nom d\'EPIC : la carte #2', Banc.cartes().join() === '2', Banc.cartes().join());
  ok('recherche : aucune lecture dans Grist', FAUX_GRIST.lectures.length === 0, FAUX_GRIST.lectures.join());
  changerRecherche('');

  // ── Structure illisible (droits…) : le Kanban continue sans planter ──
  FAUX_GRIST.structureIllisible = true;
  await assurerReferences();
  await chargerColonnesFiltrables();
  ok('échec : aucune référence', REFS.epic === null && REFS.assigne === null && REFS.projet === null);
  ok('échec : ni tri ni filtres par colonne', STATE.colonnesTriables.length === 0 && STATE.colonnesFiltrables.length === 0);
  renderBoard();
  ok('échec : les cartes restent affichées', Banc.cartes().length === 4, Banc.cartes().join());
  FAUX_GRIST.structureIllisible = false;
  await assurerReferences();
  await chargerColonnesFiltrables();
  ok('lecture rétablie : références et colonnes de retour', nomAffiche('epic', 1) !== '' && STATE.colonnesTriables.length > 0);
});
