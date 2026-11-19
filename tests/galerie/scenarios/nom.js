// Nom de la Galerie (#264) : sans nom, clés de mémoire d'avant ; un nom
// réglé dans ⚙ entre dans les clés, s'affiche dans la barre, et deux
// Galeries de même table mais de noms différents ne partagent plus vue
// active, vues perso, taille ni zones repliées ; changer de nom repart de
// zéro, sans toucher aux vues partagées ni au modèle.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $ } = Banc;
  const ANCIENNE = (nom) => `galerie.${nom}.doc-invente.EPICs`;
  const NOUVELLE = (nom, galerie) => `galerie.${nom}.doc-invente.EPICs.${galerie}`;
  const nomsVues = () => VUES.toutes().map(v => v.nom).join('|');

  // ── Sans nom : comme avant #264 ──
  ok('sans nom : titre de la barre sans nom de Galerie', $('#titre-table').textContent === '🖼️ EPICs'
    && !$('#titre-table .barre-nom'), $('#titre-table').textContent);
  ok('sans nom : clé de mémoire inchangée', cleMemoire('taille') === ANCIENNE('taille'), cleMemoire('taille'));

  // Une vue partagée, dans le document
  VUES.ajouter(VUES.construire('Équipe', false));
  await attendre(50);
  ok('vue partagée écrite dans les options', (FAUX_GRIST.options.vues || []).some(v => v.nom === 'Équipe'));
  // Une vue perso (la dernière créée devient active) et une taille retenues sans nom
  VUES.ajouter(VUES.construire('Vitrine', true));
  changerTaille('compacte');
  ok('sans nom : vue perso et vue active sous l\'ancienne clé',
    (localStorage.getItem(ANCIENNE('vuesPerso')) || '').includes('Vitrine')
    && localStorage.getItem(ANCIENNE('vueActive')) === VUES.activeId());

  // ── ⚙ : le champ et son aide ──
  ouvrirReglages();
  ok('⚙ : champ « Nom de cette Galerie » vide, avec un exemple', $('#reglages-nom').value === ''
    && $('#reglages-nom').placeholder === 'ex. EPICs Observatoire');
  const aide = [...document.querySelectorAll('#reglages .reglages-aide')].map(p => p.textContent).join(' ');
  ok('⚙ : aide (même table, même nom → réglages partagés ; nom spécifique ; exemples)',
    aide.includes('même table') && aide.includes('Choisissez un nom spécifique') && aide.includes('évitez « EPICs »'), aide);

  // ── Donner un nom (espaces autour retirés) ──
  $('#reglages-nom').value = '  EPICs Vitrine  ';
  $('#reglages-enregistrer').click();
  await attendre(100);
  ok('nom enregistré dans les options, sans espaces autour', FAUX_GRIST.options.nom === 'EPICs Vitrine',
    JSON.stringify(FAUX_GRIST.options.nom));
  ok('⚙ fermée, message qui rappelle « Enregistrer » de Grist', !$('#reglages').open
    && $('#toast').textContent.includes('Enregistrer'), $('#toast').textContent);
  ok('titre : nom de la Galerie en gris après la table', $('#titre-table').textContent === '🖼️ EPICs · EPICs Vitrine'
    && $('#titre-table .barre-nom')?.textContent === ' · EPICs Vitrine', $('#titre-table').textContent);
  ok('clés de mémoire : le nom s\'ajoute', cleMemoire('vueActive') === NOUVELLE('vueActive', 'EPICs Vitrine'), cleMemoire('vueActive'));

  // ── On repart de zéro sous le nouveau nom ──
  ok('vue perso de l\'ancien nom absente, vue partagée gardée', nomsVues() === 'Équipe', nomsVues());
  ok('vue active : « Toutes les cartes »', VUES.activeId() === Vues.DEFAUT, VUES.activeId());
  ok('taille : moyenne par défaut', $('#grille').dataset.taille === 'moyenne', $('#grille').dataset.taille);
  ok('modèle inchangé (rien écrit d\'autre que le nom et le modèle)', FAUX_GRIST.options.modele === '');
  ok('l\'ancienne mémoire n\'est pas effacée', (localStorage.getItem(ANCIENNE('vuesPerso')) || '').includes('Vitrine')
    && localStorage.getItem(ANCIENNE('taille')) === 'compacte');

  // ── Des réglages propres à ce nom ──
  VUES.ajouter(VUES.construire('Prioritaires', true));
  changerTaille('grande');
  ok('nouvelle vue perso sous la clé du nom', (localStorage.getItem(NOUVELLE('vuesPerso', 'EPICs Vitrine')) || '').includes('Prioritaires')
    && !(localStorage.getItem(ANCIENNE('vuesPerso')) || '').includes('Prioritaires'));
  ok('taille sous la clé du nom, l\'ancienne intacte', localStorage.getItem(NOUVELLE('taille', 'EPICs Vitrine')) === 'grande'
    && localStorage.getItem(ANCIENNE('taille')) === 'compacte');
  // Zones repliées (#233) : sous la clé du nom
  retenirRepliee('Now', true);
  ok('zones repliées sous la clé du nom', (localStorage.getItem(NOUVELLE('groupesReplies', 'EPICs Vitrine')) || '').includes('Now')
    && !localStorage.getItem(ANCIENNE('groupesReplies')));

  // ── Rappel tardif de Grist : le nom n'est pas relu ──
  FAUX_GRIST.renvoyerOptions({ nom: 'Autre chose', modele: '', vues: FAUX_GRIST.options.vues });
  await attendre(50);
  ok('options rappelées par Grist : nom inchangé', ETAT.nomGalerie === 'EPICs Vitrine', ETAT.nomGalerie);

  // ── Revenir sans nom : on retrouve les réglages d'avant ──
  ouvrirReglages();
  ok('⚙ : nom actuel affiché', $('#reglages-nom').value === 'EPICs Vitrine');
  $('#reglages-nom').value = '   ';
  $('#reglages-enregistrer').click();
  await attendre(100);
  ok('nom effacé (espaces seuls = aucun nom)', FAUX_GRIST.options.nom === '' && ETAT.nomGalerie === '');
  ok('sans nom : vues et taille de l\'ancienne clé retrouvées', nomsVues() === 'Équipe|Vitrine'
    && VUES.active()?.nom === 'Vitrine' && $('#grille').dataset.taille === 'compacte',
    `${nomsVues()} / ${VUES.active()?.nom} / ${$('#grille').dataset.taille}`);
  ok('titre sans nom', $('#titre-table').textContent === '🖼️ EPICs');

  // ── « Annuler » ne change rien ──
  ouvrirReglages();
  $('#reglages-nom').value = 'Brouillon';
  $('#reglages-annuler').click();
  await attendre(50);
  ok('⚙ : « Annuler » ne change pas le nom', ETAT.nomGalerie === '' && FAUX_GRIST.options.nom === '');

  // ── Modèle seul modifié : le nom n'est pas réécrit ──
  FAUX_GRIST.options = {};
  ouvrirReglages();
  $('#reglages-modele').value = '## Objectif';
  $('#reglages-enregistrer').click();
  await attendre(100);
  ok('modèle seul modifié : nom non écrit', FAUX_GRIST.options.modele === '## Objectif' && !('nom' in FAUX_GRIST.options),
    JSON.stringify(FAUX_GRIST.options));

  // ── Nom piégé : affiché comme du texte, jamais comme du HTML ──
  ouvrirReglages();
  $('#reglages-nom').value = '<img src=x onerror="window.PIEGE=1">';
  $('#reglages-enregistrer').click();
  await attendre(100);
  ok('nom piégé : affiché tel quel, sans balise créée', !$('#titre-table img') && !window.PIEGE
    && $('#titre-table').textContent.includes('<img'), $('#titre-table').innerHTML);

  // ── Ouverture d'une Galerie déjà nommée ──
  // (le widget ne lit ses options qu'à l'ouverture : on l'imite)
  ETAT.optionsChargees = false;
  await Banc.demarrer({ nom: 'EPICs Vitrine' });
  ok('ouverture avec un nom : lu dans les options, affiché', ETAT.nomGalerie === 'EPICs Vitrine'
    && $('#titre-table').textContent === '🖼️ EPICs · EPICs Vitrine', $('#titre-table').textContent);
  ok('ouverture avec un nom : clés du nom', cleMemoire('vuesPerso') === NOUVELLE('vuesPerso', 'EPICs Vitrine'));
});
