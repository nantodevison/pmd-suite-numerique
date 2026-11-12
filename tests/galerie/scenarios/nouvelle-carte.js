// « + Nouvelle carte » et modèle de texte (réglage ⚙) : titre exigé,
// création avec le modèle, carte masquée par un filtre, reprise du texte
// d'une carte comme modèle.
Banc.lancer(async () => {
  const MODELE = '## Objectif\n- [ ] première étape';
  await Banc.demarrer({ modele: MODELE });
  const { ok, $ } = Banc;

  $('#btn-nouvelle').click();
  await Banc.attendre(100);
  ok('fiche ouverte : « Nouvelle carte »', $('#fiche-libelle').textContent === 'Nouvelle carte');
  ok('titre vide', $('#fiche-corps .fiche-titre').value === '');
  // (la fenêtre ⚙ a aussi une zone .fiche-md-saisie : on vise celle de la fiche)
  const saisie = $('#fiche-corps .fiche-md-saisie');
  ok('texte prérempli avec le modèle', saisie?.value === MODELE, JSON.stringify(saisie?.value));
  ok('ni objets liés ni contexte', !$('.fiche-lies') && !$('.fiche-contexte'));
  ok('« Sauvegarder » actif (création possible telle quelle)', !$('#fiche-sauver').disabled);

  // Sans titre : rien n'est créé
  let avant = FAUX_GRIST.actions.length;
  $('#fiche-sauver').click();
  await Banc.attendre(100);
  ok('sans titre : rien de créé', FAUX_GRIST.actions.length === avant);
  ok('sans titre : message', $('#toast').textContent.includes('Saisissez un titre'), $('#toast').textContent);

  // Avec un titre : AddRecord avec le modèle, la fiche reste ouverte sur la carte créée
  const titre = $('#fiche-corps .fiche-titre');
  titre.value = 'Carte inventée';
  titre.dispatchEvent(new Event('input'));
  avant = FAUX_GRIST.actions.length;
  $('#fiche-sauver').click();
  await Banc.attendre(600);
  const action = Banc.actionsDepuis(avant)[0];
  ok('création : AddRecord avec le titre et le modèle', JSON.stringify(action) === JSON.stringify(
    ['AddRecord', 'EPICs', null, { Description: MODELE, Titre: 'Carte inventée' }]), JSON.stringify(action));
  ok('création : carte n° 100 affichée', Banc.cartes().includes(100), Banc.cartes().join());
  ok('création : la fiche montre la carte créée', $('#fiche-libelle').textContent === 'Fiche'
    && $('#fiche-corps .fiche-titre').value === 'Carte inventée');
  ok('création : curseur de Grist sur la carte', FAUX_GRIST.curseur?.rowId === 100);
  ok('création : message', $('#toast').textContent.includes('Carte créée'), $('#toast').textContent);
  fermerFiche();

  // Vue filtrée : la carte créée n'est pas renvoyée par Grist
  FAUX_GRIST.masquerCreees = true;
  $('#btn-nouvelle').click();
  await Banc.attendre(100);
  const titre2 = $('#fiche-corps .fiche-titre');
  titre2.value = 'Carte masquée';
  titre2.dispatchEvent(new Event('input'));
  $('#fiche-sauver').click();
  await Banc.attendre(2600);   // le widget attend la carte jusqu'à 2 s
  ok('carte masquée : fiche fermée', !$('#fiche').classList.contains('open'));
  ok('carte masquée : message', $('#toast').textContent.includes('masquée par un filtre'), $('#toast').textContent);
  FAUX_GRIST.masquerCreees = false;

  // ⚙ : reprendre le texte d'une carte comme modèle, puis l'enregistrer
  ouvrirFiche(1);
  await Banc.attendre(100);
  ouvrirReglages();
  ok('⚙ : modèle actuel affiché', $('#reglages-modele').value === MODELE);
  ok('⚙ : propose de reprendre la carte ouverte',
    $('#reglages-reprendre').textContent.includes('Écrire la documentation') && !$('#reglages-reprendre').disabled);
  $('#reglages-reprendre').click();
  ok('⚙ : texte de la carte repris', $('#reglages-modele').value === '- [ ] Plan\n- [x] Sommaire');
  $('#reglages-enregistrer').click();
  await Banc.attendre(100);
  ok('⚙ : modèle enregistré dans les options du widget', FAUX_GRIST.options.modele === '- [ ] Plan\n- [x] Sommaire');
  ok('⚙ : fenêtre fermée', !$('#reglages').open);
  fermerFiche();

  // Une carte au format Notepad est reprise convertie en Markdown
  ouvrirFiche(2);
  await Banc.attendre(100);
  ouvrirReglages();
  $('#reglages-reprendre').click();
  ok('⚙ : texte Notepad repris en Markdown', $('#reglages-modele').value.trim() === 'Ancien texte',
    JSON.stringify($('#reglages-modele').value));
  $('#reglages-annuler').click();
  ok('⚙ : « Annuler » ne change pas le modèle', FAUX_GRIST.options.modele === '- [ ] Plan\n- [x] Sommaire');
});
