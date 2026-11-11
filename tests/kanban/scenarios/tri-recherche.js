// Tri des cartes (#211) et recherche 🔍 (#209).
// Colonne « À faire » du faux Grist : #1 « Rédiger le guide » (Haute) et #4 « Sans EPIC » (Basse).
Banc.lancer(async () => {
  const { ok, attendre } = Banc;
  const aFaire = '🖐️ À faire';
  // Cartes trouvées, en ordre croissant (l'ordre des colonnes n'importe pas ici)
  const chercher = async (texte) => {
    changerRecherche(texte);
    await attendre(150);
    return Banc.cartes().sort((a, b) => a - b).join(',');
  };

  await Banc.demarrer();

  // ── Tri ──
  ok('sans tri : rangées par priorité (Haute avant Basse)', Banc.cartes(aFaire).join(',') === '1,4', Banc.cartes(aFaire).join(','));
  STATE.tri = [{ col: 'Nom', sens: 'desc' }];
  changerTri();
  ok('tri par Nom décroissant : « Sans EPIC » d\'abord', Banc.cartes(aFaire).join(',') === '4,1', Banc.cartes(aFaire).join(','));
  STATE.tri = [{ col: 'Nom', sens: 'asc' }];
  changerTri();
  ok('tri par Nom croissant', Banc.cartes(aFaire).join(',') === '1,4', Banc.cartes(aFaire).join(','));
  STATE.tri = [{ col: 'Priorite', sens: 'desc' }];
  changerTri();
  ok('tri sur une colonne Choix : ordre des choix inversé (Basse avant Haute)', Banc.cartes(aFaire).join(',') === '4,1', Banc.cartes(aFaire).join(','));
  STATE.tri = [];
  changerTri();
  ok('tri retiré : retour au rangement par priorité', Banc.cartes(aFaire).join(',') === '1,4');

  // Le tri s'enregistre dans une vue
  ouvrirFenetreVue('tri');
  STATE.tri = [{ col: 'Nom', sens: 'desc' }];
  document.getElementById('fv-nom').value = 'Triée';
  enregistrerFenetreVue();
  await attendre(100);
  const triee = STATE.vues.find(v => v.nom === 'Triée');
  ok('tri enregistré dans la vue', triee && JSON.stringify(triee.tri) === '[{"col":"Nom","sens":"desc"}]', JSON.stringify(triee?.tri));
  switchView(DEFAUT);
  ok('« Toutes les cartes » : pas de tri', STATE.tri.length === 0 && Banc.cartes(aFaire).join(',') === '1,4');

  // ── Recherche ──
  ok('« fichiers » : la carte #3', await chercher('fichiers') === '3');
  ok('accents et majuscules ignorés : « DEMONSTRATION » (EPIC de #2)', await chercher('DEMONSTRATION') === '2');
  ok('tous les mots requis : « fichiers statique » ne trouve rien', await chercher('fichiers statique') === '');
  const guide = await chercher('guide');
  ok('noms des cartes liées compris : « guide » trouve #1 et #2 (bloquée par lui)', guide === '1,2', guide);
  ok('« #3 » : la carte numéro 3', await chercher('#3') === '3');
  ok('nom d\'une personne assignée : « durand »', await chercher('durand') === '1');
  ok('nom d\'un EPIC : « démonstration »', await chercher('démonstration') === '2');
  ok('colonne masquée dans le widget (qui__Equipe) : « terrain »', await chercher('terrain') === '1');
  ok('recherche vidée : les 4 cartes', (await chercher('')).split(',').length === 4);
});
