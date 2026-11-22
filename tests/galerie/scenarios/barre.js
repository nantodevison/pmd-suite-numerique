// Barre du haut commune aux widgets (#249, étape C) : à gauche le titre, le
// nombre, « ? » et ⚙ ; à droite la recherche et « + Nouvelle carte » ; rien
// ne déborde, même en widget étroit ; mode d'emploi derrière « ? ».
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $ } = Banc;
  const aide = () => $('#aide-contenu')?.closest('dialog');

  // 1. Ordre de la règle R1, et rien qui déborde
  const ordre = [...document.querySelectorAll('.barre > *')].map(e => e.id).join('|');
  ok('barre : titre, nombre, ?, ⚙, recherche puis « + Nouvelle carte »',
    ordre === 'titre-table|compte|btn-aide|btn-reglages|recherche|btn-nouvelle', ordre);
  const barre = $('.barre');
  ok('barre : rien ne déborde', barre.scrollWidth <= barre.clientWidth, `${barre.scrollWidth} > ${barre.clientWidth}`);
  const droite = (id) => $(id).getBoundingClientRect().right;
  ok('barre : « + Nouvelle carte » collé à droite', Math.abs(barre.getBoundingClientRect().right - 16 - droite('#btn-nouvelle')) < 2,
    `${droite('#btn-nouvelle')} / ${barre.getBoundingClientRect().right}`);
  ok('barre : « ? » et ⚙ à gauche de la recherche', droite('#btn-reglages') < $('#recherche').getBoundingClientRect().left);

  // 2. Mode d'emploi : fenêtre commune, un seul panneau, rien de Grist
  ok('aide : pas encore ouverte', !aide()?.open);
  $('#btn-aide').click();
  ok('aide : « ? » ouvre la fenêtre « Mode d\'emploi »', aide()?.open
    && aide().querySelector('.fenetre-titre').textContent === '📖 Mode d\'emploi');
  ok('aide : pas de colonne d\'onglets', aide().classList.contains('fenetre-aide')
    && getComputedStyle(aide().querySelector('.fenetre-onglets')).display === 'none');
  const texte = $('#aide-contenu').textContent;
  ok('aide : texte de la Galerie (cartes, vues, ⚙, deux « Enregistrer »)', texte.includes('Bienvenue dans la Galerie')
    && texte.includes('＋ Vue') && texte.includes('nom de la Galerie') && texte.includes('Deux « Enregistrer »'));
  ok('aide : lien vers le mode d\'emploi complet, nouvel onglet', $('#aide-contenu a').href.endsWith('/widgets/galerie/README.md')
    && $('#aide-contenu a').target === '_blank' && $('#aide-contenu a').rel.includes('noopener'));
  const pied = [...aide().querySelectorAll('.fenetre-pied button')].map(b => b.textContent.trim()).join('|');
  ok('aide : un seul bouton « Fermer »', pied === 'Fermer', pied);
  aide().querySelector('.fenetre-pied button').click();
  ok('aide : « Fermer » la ferme', !aide().open);

  // 3. Échap dans le mode d'emploi, une fiche ouverte derrière : seule l'aide se ferme
  ouvrirFiche(1);
  await attendre(100);
  $('#btn-aide').click();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await attendre(50);
  ok('Échap dans l\'aide : la fiche reste ouverte', $('#fiche').classList.contains('open'));
  aide().close();
  fermerFiche();
});
