// Barre du haut commune aux widgets (#249, étape C) : titre « 🤝 Interactions »
// et nom du projet, nombre, « ? » et ⚙ à gauche, bouton de création à droite ;
// sans liste (message), ni projet, ni nombre, ni bouton de création ; nom de
// projet piégé affiché comme du texte ; mode d'emploi derrière « ? ».
Banc.lancer(async () => {
  const { ok, $ } = Banc;
  const relancer = async (options) => {
    ETAT.reglages = null; ETAT.reglagesProposes = true;
    await Banc.demarrer(options);
  };
  const aide = () => $('#aide-contenu')?.closest('dialog');

  // 1. Avec un projet : la barre complète, dans l'ordre de la règle R1
  await relancer({ projet: 1 });
  const ordre = [...document.querySelectorAll('.barre > *')].map(e => e.id).join('|');
  ok('barre : titre, nombre, ?, ⚙ puis création', ordre === 'barre-titre|barre-compte|bouton-aide|bouton-reglages|bouton-creer', ordre);
  ok('barre : « 🤝 Interactions » puis le projet en gris', $('#barre-titre').textContent === '🤝 Interactions · Atelier vélo'
    && $('#barre-titre .barre-nom')?.textContent === ' · Atelier vélo', $('#barre-titre').textContent);
  ok('barre : bouton de création visible', !$('#bouton-creer').hidden && $('#bouton-creer').textContent === '＋ Rendez-vous');
  ok('barre : plus de ⚙ flottant ni d\'en-tête dans la liste', !$('.bouton-reglages') && !$('.journal-entete'));
  ok('barre : en haut de la page', $('.barre').getBoundingClientRect().top === 0
    && getComputedStyle($('.barre')).position === 'sticky');

  // 2. Mode d'emploi : fenêtre commune, un seul panneau, rien de Grist
  ok('aide : fermée au départ', !aide()?.open);
  $('#bouton-aide').click();
  ok('aide : « ? » ouvre la fenêtre « Mode d\'emploi »', aide()?.open
    && aide().querySelector('.fenetre-titre').textContent === '📖 Mode d\'emploi');
  ok('aide : pas de colonne d\'onglets', aide().classList.contains('fenetre-aide')
    && getComputedStyle(aide().querySelector('.fenetre-onglets')).display === 'none');
  ok('aide : texte du widget et lien vers le mode d\'emploi complet', $('#aide-contenu').textContent.includes('journal des interactions')
    && $('#aide-contenu a').href.endsWith('/widgets/interactions/README.md') && $('#aide-contenu a').rel.includes('noopener'));
  const pied = [...aide().querySelectorAll('.fenetre-pied button')].map(b => b.textContent.trim()).join('|');
  ok('aide : un seul bouton « Fermer »', pied === 'Fermer', pied);
  aide().querySelector('.fenetre-pied button').click();
  ok('aide : « Fermer » la ferme', !aide().open);

  // 3. Échap dans le mode d'emploi, une fiche ouverte derrière : seule l'aide se ferme
  $('.interaction').click();
  await Banc.attendre(50);
  $('#bouton-aide').click();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await Banc.attendre(50);
  ok('Échap dans l\'aide : la fiche reste ouverte', $('#fiche').classList.contains('open'));
  aide().close();
  fermerFiche(true);

  // 4. Sans projet : message, barre réduite au titre, « ? » et ⚙
  await relancer({});
  ok('sans projet : titre seul', $('#barre-titre').textContent === '🤝 Interactions', $('#barre-titre').textContent);
  ok('sans projet : ni nombre ni bouton de création', $('#barre-compte').hidden && $('#bouton-creer').hidden);
  ok('sans projet : « ? » et ⚙ toujours là', !$('#bouton-aide').hidden && !$('#bouton-reglages').hidden);

  // 5. Nom de projet piégé : affiché tel quel, jamais comme du HTML
  const nomVrai = ETAT.refProjet.nom;
  ETAT.refProjet.nom = () => '<img src=x onerror="window.PIEGE_BARRE=1">';
  ETAT.reglages = { projet: 1, libelle: 'Rendez-vous' };
  afficher();
  await Banc.attendre(100);
  ok('nom piégé : texte, pas de balise', $('#barre-titre').textContent.includes('<img') && !$('#barre-titre img')
    && window.PIEGE_BARRE === undefined, $('#barre-titre').innerHTML);
  ETAT.refProjet.nom = nomVrai;
});
