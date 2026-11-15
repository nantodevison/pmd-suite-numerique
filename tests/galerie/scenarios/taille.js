// Taille des cartes (#237) : bouton « ▦ Moyenne ▾ », menu des trois tailles,
// compacte (titre seul, cartes plus étroites), grande (début du texte en
// texte simple, Notepad compris, et nombre d'objets liés), choix retenu par
// le navigateur pour cette Galerie, gardé après un nouveau dessin et dans
// les zones de regroupement, sans toucher aux vues.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $, $$ } = Banc;
  const carte = (id) => $(`#grille .carte[data-id="${id}"]`);
  const colonnes = () => getComputedStyle($('#grille')).gridTemplateColumns.split(' ').length;
  const choisir = async (libelleDebut) => {
    $('#taille-bouton').click();
    await attendre(50);
    [...document.querySelectorAll('.fiche-menu .fiche-menu-item')].find(i => i.textContent.startsWith(libelleDebut)).click();
    await attendre(50);
  };
  const vuesAvant = localStorage.getItem('galerie.vuesPerso.doc-invente.EPICs');

  // ── Par défaut : moyenne ──
  ok('bouton « ▦ Moyenne ▾ » dans la barre', $('#taille-bouton')?.textContent === '▦ Moyenne ▾', $('#taille-bouton')?.textContent);
  ok('taille moyenne : titre et pastilles, sans résumé', $('#grille').dataset.taille === 'moyenne'
    && carte(1).querySelector('.carte-contexte') && !carte(1).querySelector('.carte-resume'));
  const colonnesMoyenne = colonnes();

  // ── Le menu ──
  $('#taille-bouton').click();
  await attendre(50);
  const items = [...document.querySelectorAll('.fiche-menu .fiche-menu-item')];
  ok('menu : les trois tailles, expliquées', items.map(i => i.textContent).join('|')
    === 'Compacte : le titre seul|Moyenne : titre et pastilles|Grande : avec le début du texte et les objets liés',
    items.map(i => i.textContent).join('|'));
  ok('taille actuelle marquée', items[1].classList.contains('choisi'));
  Fiche.fermerMenu();

  // ── Compacte ──
  await choisir('Compacte');
  ok('compacte : titre seul, sans pastilles', $('#grille').dataset.taille === 'compacte'
    && !carte(1).querySelector('.carte-contexte') && carte(1).querySelector('.carte-titre'));
  ok('compacte : plus de cartes par ligne', colonnes() > colonnesMoyenne, `${colonnes()} / ${colonnesMoyenne}`);
  ok('bouton « ▦ Compacte ▾ »', $('#taille-bouton').textContent === '▦ Compacte ▾');
  ok('choix retenu par le navigateur, sous la clé de cette Galerie',
    localStorage.getItem('galerie.taille.doc-invente.EPICs') === 'compacte');
  carte(1).click();
  await attendre(50);
  ok('compacte : un clic ouvre toujours la fiche', $('#fiche').classList.contains('open'));
  fermerFiche(true);

  // ── Grande ──
  await choisir('Grande');
  ok('grande : pastilles toujours là', carte(1).querySelector('.carte-contexte'));
  const resume1 = carte(1).querySelector('.carte-resume')?.textContent || '';
  ok('grande : début du texte, sans les symboles du Markdown', resume1.includes('Plan') && resume1.includes('Sommaire')
    && !resume1.includes('[ ]') && !resume1.includes('- '), resume1);
  ok('grande : ancien texte Notepad lisible', carte(2).querySelector('.carte-resume')?.textContent === 'Ancien texte',
    carte(2).querySelector('.carte-resume')?.textContent);
  ok('grande : pas de résumé sans texte', !carte(4).querySelector('.carte-resume'));
  ok('grande : nombre d\'objets liés (« Tâches 2 »)', carte(1).querySelector('.carte-lies-compte')?.textContent === 'Tâches 2',
    carte(1).querySelector('.carte-lies-compte')?.textContent);
  ok('grande : rien pour une liste vide', !carte(2).querySelector('.carte-lies'));
  // Hauteur réellement affichée (le résumé ne doit pas être écrasé par la carte)
  await grist.docApi.applyUserActions([['UpdateRecord', 'EPICs', 3, {
    Description: Array(12).fill('Une phrase inventée assez longue pour remplir plusieurs lignes de la carte.').join(' '),
  }]]);
  await attendre(200);
  // Comme dans une vraie Galerie de 20 cartes : la grille déborde et défile.
  // (Une grille qui manque de place réduit ses rangées à leur hauteur minimale.)
  const grille = $('#grille');
  grille.style.flex = 'none';
  grille.style.height = '200px';
  await attendre(50);
  const resume3 = carte(3).querySelector('.carte-resume');
  const ligneHaut = parseFloat(getComputedStyle(resume3).lineHeight);
  ok('grande : long texte affiché sur 4 lignes, pas écrasé', Math.round(resume3.offsetHeight / ligneHaut) === 4,
    `${resume3.offsetHeight} px pour des lignes de ${ligneHaut} px`);
  ok('grande : la carte s\'agrandit (plus haute qu\'une carte moyenne)', carte(3).offsetHeight > 150, `${carte(3).offsetHeight} px`);
  grille.style.flex = '';
  grille.style.height = '';
  ok('grande : cartes plus larges', colonnes() < colonnesMoyenne || colonnesMoyenne === 1, `${colonnes()} / ${colonnesMoyenne}`);

  // ── Gardée : nouveau dessin, données de Grist, zones de regroupement ──
  // Comme au rechargement du widget : ni état, ni choix de la séance
  ETAT.taille = null;
  _tailleSeance = null;
  afficherGrille();
  ok('nouveau dessin : relue dans la mémoire du navigateur', $('#grille').dataset.taille === 'grande');
  FAUX_GRIST.associer({});
  await attendre(100);
  ok('données renvoyées par Grist : toujours grande', carte(1)?.querySelector('.carte-resume'));
  ETAT.groupe = 'Projet';
  afficherGrille();
  ok('regroupement : grandes cartes dans les zones', $('#grille .groupe .carte .carte-resume') !== null);
  ETAT.groupe = null;
  afficherGrille();
  ok('vues inchangées (préférence personnelle, hors des vues)',
    localStorage.getItem('galerie.vuesPerso.doc-invente.EPICs') === vuesAvant && !FAUX_GRIST.options.vues);

  // Retour à la taille par défaut
  await choisir('Moyenne');
  ok('retour à moyenne', $('#grille').dataset.taille === 'moyenne' && !carte(1).querySelector('.carte-resume'));
});
