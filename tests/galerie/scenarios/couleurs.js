// Couleur des cartes (#241) : sans colonne associée, rien ne change ; avec
// une colonne « Couleur », chaque carte prend la couleur écrite (majuscules
// et espaces tolérés) ou, à défaut, une couleur automatique tirée de son
// numéro ; la pastille ● ouvre le menu des couleurs (sans ouvrir la fiche),
// qui écrit le nom choisi, ou vide la cellule (« Automatique ») ; colonne
// calculée : témoin sans menu ; couleur gardée dans les zones et en compacte.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $, $$ } = Banc;
  const carte = (id) => $(`#grille .carte[data-id="${id}"]`);
  const fond = (id) => carte(id)?.style.getPropertyValue('--carte-fond');
  // Fond attendu : la teinte pâle de la palette, à 20 % d'opacité
  const pale = (c) => Palette.transparente(c.fond, 0.2);
  const rond = (id) => carte(id)?.querySelector('.carte-couleur');
  const items = () => $$('.fiche-menu .fiche-menu-item');
  const choisir = async (id, libelle) => {
    rond(id).click();
    await attendre(50);
    items().find(i => i.textContent === libelle).click();
    await attendre(200);
  };
  const C = Object.fromEntries(Palette.COULEURS.map(c => [c.nom, c]));

  // ── La palette ──
  ok('palette : huit couleurs nommées', Palette.COULEURS.map(c => c.nom).join(',')
    === 'bleu,vert,rose,jaune,violet,cyan,orange,gris');
  ok('palette : teinte transparente', Palette.transparente('#fce7f3', 0.4) === 'rgba(252, 231, 243, 0.4)');
  ok('palette : nom reconnu sans majuscules ni espaces', Palette.parNom(' Bleu ')?.nom === 'bleu' && !Palette.parNom('pourpre'));
  const auto = Array.from({ length: 14 }, (_, i) => Palette.automatique(i + 1).nom);
  ok('palette : automatique d\'après le numéro, deux numéros voisins différents, jamais gris',
    auto[0] === 'bleu' && auto[1] === 'vert' && auto[7] === 'bleu'
    && auto.every((n, i) => n !== 'gris' && (i === 0 || n !== auto[i - 1])), auto.join(','));

  // ── Sans colonne associée : rien ne change ──
  ok('sans association : cartes non colorées, sans pastille ●', !$('.carte-coloree') && !$('.carte-couleur'));
  ok('sans association : bandeau habituel de 4 px', getComputedStyle(carte(1)).borderTopWidth === '4px');

  // ── Avec la colonne Couleur ──
  FAUX_GRIST.associer({ Couleur: 'Couleur' });
  await attendre(150);
  ok('association : toutes les cartes colorées', $$('#grille .carte').every(c => c.classList.contains('carte-coloree')));
  ok('couleur écrite « Rose » (majuscule, espaces) : rose', fond(1) === pale(C.rose), fond(1));
  ok('cellule vide : automatique (n° 2 → vert)', fond(2) === pale(C.vert), fond(2));
  ok('cellule sans valeur : automatique (n° 4 → jaune)', fond(4) === pale(C.jaune), fond(4));
  ok('couleur inconnue : automatique, signalée dans l\'infobulle', fond(3) === pale(C.rose)
    && rond(3).title.includes('« pourpre »'), rond(3).title);
  ok('infobulle : couleur choisie / automatique', rond(1).title.startsWith('Couleur : Rose —')
    && rond(2).title.startsWith('Couleur : Vert (automatique)'), rond(1).title + ' | ' + rond(2).title);
  const style1 = getComputedStyle(carte(1));
  ok('rendu : bandeau de 6 px et fond pâle à 20 %', style1.borderTopWidth === '6px'
    && style1.backgroundColor === 'rgba(252, 231, 243, 0.2)', style1.borderTopWidth + ' ' + style1.backgroundColor);
  ok('pastille ● : un bouton', rond(1)?.tagName === 'BUTTON');

  // ── Le menu ──
  rond(1).click();
  await attendre(50);
  ok('clic sur ● : la fiche ne s\'ouvre pas', !$('#fiche').classList.contains('open'));
  ok('menu : « Automatique » puis les huit couleurs', items().map(i => i.textContent).join('|')
    === 'Automatique|Bleu|Vert|Rose|Jaune|Violet|Cyan|Orange|Gris', items().map(i => i.textContent).join('|'));
  ok('menu : un rond de couleur devant chaque choix', $$('.fiche-menu .palette-rond').length === 9);
  ok('menu : couleur actuelle marquée', items()[3].classList.contains('choisi'));
  Fiche.fermerMenu();
  rond(2).click();
  await attendre(50);
  ok('menu d\'une couleur automatique : « Automatique » marqué', items()[0].classList.contains('choisi'));
  Fiche.fermerMenu();

  // Choisir une couleur : écrite tout de suite, sous son nom
  let avant = FAUX_GRIST.actions.length;
  await choisir(2, 'Bleu');
  ok('choix « Bleu » : nom écrit dans la cellule', JSON.stringify(Banc.actionsDepuis(avant))
    === JSON.stringify([['UpdateRecord', 'EPICs', 2, { Couleur: 'bleu' }]]), JSON.stringify(Banc.actionsDepuis(avant)));
  ok('choix « Bleu » : carte redessinée en bleu', fond(2) === pale(C.bleu), fond(2));
  ok('choix « Bleu » : message', $('#toast').textContent.includes('Couleur'));

  // Même couleur : rien n'est écrit
  avant = FAUX_GRIST.actions.length;
  await choisir(1, 'Rose');
  ok('même couleur (« Rose » déjà là) : rien écrit', FAUX_GRIST.actions.length === avant);

  // « Automatique » : cellule vidée, couleur tirée du numéro
  await choisir(1, 'Automatique');
  ok('« Automatique » : cellule vidée', JSON.stringify(Banc.actionsDepuis(avant))
    === JSON.stringify([['UpdateRecord', 'EPICs', 1, { Couleur: '' }]]), JSON.stringify(Banc.actionsDepuis(avant)));
  ok('« Automatique » : n° 1 → bleu', fond(1) === pale(C.bleu), fond(1));

  // Le reste de la carte ouvre toujours la fiche
  carte(2).querySelector('.carte-titre').click();
  await attendre(50);
  ok('clic sur la carte : fiche ouverte', $('#fiche').classList.contains('open'));
  fermerFiche(true);

  // ── Gardée dans les zones de regroupement et en taille compacte ──
  ETAT.groupe = 'Projet';
  afficherGrille();
  ok('regroupement : cartes colorées dans les zones', $$('#grille .groupe .carte').every(c => c.classList.contains('carte-coloree')));
  ETAT.groupe = null;
  localStorage.setItem('galerie.taille.doc-invente.EPICs', 'compacte');
  afficherGrille();
  ok('compacte : couleur et pastille ●', carte(2).classList.contains('carte-coloree') && rond(2));
  localStorage.removeItem('galerie.taille.doc-invente.EPICs');
  _tailleSeance = null;
  afficherGrille();

  // ── Colonne calculée par une formule : témoin, sans menu ──
  FAUX_GRIST.associer({ Couleur: 'Couleur_calc' });
  await attendre(150);
  ok('colonne calculée : couleur de la formule (vert)', fond(1) === pale(C.vert) && fond(3) === pale(C.vert));
  ok('colonne calculée : pastille ● non cliquable', rond(1)?.tagName === 'SPAN' && rond(1).title.includes('formule'));
  avant = FAUX_GRIST.actions.length;
  rond(1).click();
  await attendre(50);
  ok('colonne calculée : pas de menu, rien écrit', !$('.fiche-menu') && FAUX_GRIST.actions.length === avant);
  fermerFiche(true);

  // ── Retrait de l'association : retour à l'aspect habituel ──
  FAUX_GRIST.associer({});
  await attendre(150);
  ok('association retirée : cartes non colorées', !$('.carte-coloree') && !$('.carte-couleur'));
});
