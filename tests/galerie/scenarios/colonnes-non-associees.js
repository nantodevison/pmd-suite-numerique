// Colonnes non associées (#239) : comme le vrai Grist, le faux n'envoie au
// widget que l'id et les colonnes associées. La Galerie relit la table et
// complète chaque carte, au format d'onRecords : listes décodées, références
// sous leur nom (colonne cachée de Grist, sinon table visée). Valeurs
// fraîches après une écriture ; un envoi lent ne remplace pas un plus récent.
// Filtres, tri et regroupement sur ces colonnes : scénarios filtres-vues
// (attribut Projet › État), tri et groupes (Urgent, Thèmes, Version).
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre } = Banc;
  const carte = (id) => ETAT.lignes.find(l => l.id === id);

  // ── Ce que Grist envoie ──
  const envoyees = Object.keys(FAUX_GRIST.dernierEnvoi[0]).sort().join();
  ok('Grist n\'envoie que l\'id et les colonnes associées',
    envoyees === 'Avancement,Description,Echeance,Objectif,Priorite,Projet,Taches,Titre,id', envoyees);

  // ── Cartes complétées ──
  ok('case à cocher non associée : complétée', carte(1).Urgent === true && carte(2).Urgent === false);
  ok('colonne calculée non associée : complétée', carte(1).Code === 'E1', carte(1).Code);
  ok('colonne rapportée non associée : complétée', carte(1).Projet_Etat === 'Ouvert' && carte(3).Projet_Etat === 'Fermé');
  ok('choix multiple : liste décodée (pas de « L »)', JSON.stringify(carte(1).Themes) === '["Guide"]' && carte(2).Themes === null,
    JSON.stringify(carte(1).Themes));
  ok('référence : son nom, lu dans la colonne cachée de Grist', carte(1).Version === 'Version A' && carte(2).Version === '',
    JSON.stringify(carte(1).Version));
  ok('… sans lire la table visée', !FAUX_GRIST.lectures.includes('Versions'), FAUX_GRIST.lectures.join());
  ok('colonnes associées inchangées (référence et liste sous leur nom)',
    carte(1).Projet === 'Atelier' && carte(1).Taches.join() === 'Rédiger le guide,Relire le guide');
  ok('colonne interne de Grist non ajoutée', !('gristHelper_Display' in carte(1)) && !('manualSort' in carte(1)));

  // ── Tri sur une colonne non associée ──
  ETAT.tri = [{ col: 'Code', sens: 'desc' }];
  afficherGrille();
  ok('tri sur Code (non associée), Z → A', Banc.cartes().join() === '4,3,2,1', Banc.cartes().join());
  ETAT.tri = [];
  afficherGrille();

  // ── Référence sans colonne cachée : la table visée est lue ──
  FAUX_GRIST.associer({ Pastilles: ['Priorite', 'Avancement'] });   // Projet n'est plus associée
  await attendre(100);
  ok('Projet non associée : absente de l\'envoi', !('Projet' in FAUX_GRIST.dernierEnvoi[0]));
  ok('référence sans colonne cachée : nom lu dans la table visée', carte(1).Projet === 'Atelier' && carte(3).Projet === 'Vitrine',
    JSON.stringify(carte(1).Projet));
  ok('… table visée lue', FAUX_GRIST.lectures.includes('Projets'));
  ok('cellule en erreur gardée telle quelle', estErreur(carte(4).Projet), JSON.stringify(carte(4).Projet));

  // ── Après une écriture : valeurs fraîches ──
  await grist.docApi.applyUserActions([['UpdateRecord', 'EPICs', 1, { Version: 2, Urgent: false }]]);
  await attendre(200);
  ok('écriture : nouvelles valeurs des colonnes non associées', carte(1).Version === 'Version B' && carte(1).Urgent === false,
    `${carte(1).Version} / ${carte(1).Urgent}`);

  // ── Deux envois rapprochés : le plus récent l'emporte ──
  // La lecture qui complète le premier envoi est retardée : elle finit après celle du second.
  const lire = grist.docApi.fetchTable;
  let retarder = true;
  grist.docApi.fetchTable = async (t) => {
    if (t === 'EPICs' && retarder) { retarder = false; await attendre(300); }
    return lire(t);
  };
  FAUX_GRIST.associer({});   // 1er envoi (lent), titre d'origine
  await grist.docApi.applyUserActions([['UpdateRecord', 'EPICs', 2, { Titre: 'Titre récent' }]]);   // 2e envoi
  await attendre(500);
  grist.docApi.fetchTable = lire;
  ok('envoi lent arrivé après : le plus récent reste affiché', carte(2).Titre === 'Titre récent'
    && document.querySelector('.carte[data-id="2"]')?.textContent.includes('Titre récent'), carte(2).Titre);
});
