// « + Nouvelle carte » d'après la vue (#186), règles communes avec le
// Kanban (_commun/filtres.js) : pastilles dans la nouvelle fiche,
// préremplies par les filtres « est » à une valeur (colonnes hors pastilles
// comprises), menus rangés « dans la vue » / « Hors de la vue » (menu de
// recherche compris), avis si la carte sera masquée, valeurs écrites.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, $, $$, attendre } = Banc;
  const filtre = (col, op, valeurs) => ({ col, op, valeurs });

  // Outils
  const pastille = (texte) => $$('#fiche-corps .fiche-entete-pastilles .pastille').find(p => p.textContent === texte);
  const pastilles = () => $$('#fiche-corps .fiche-entete-pastilles .pastille').map(p => p.textContent).join('|');
  const lignesMenu = () => [...($('.fiche-menu')?.querySelectorAll('.fiche-menu-libelle, .fiche-menu-separateur') || [])]
    .map(e => e.textContent).filter(t => !t.startsWith('—'));
  const choisir = (texte) => $$('.fiche-menu button.fiche-menu-item').find(b => b.textContent.startsWith(texte)).click();
  const avis = () => $('#fiche-avis-vue');
  const alerte = () => avis()?.querySelector('.avis-vue-alerte')?.textContent || '';
  const info = () => avis()?.querySelector('.avis-vue-info')?.textContent || '';
  const nouvelle = async (filtres) => {
    ETAT.filtres = filtres;
    afficherGrille();
    $('#btn-nouvelle').click();
    await attendre(150);
  };
  const creer = async (titre) => {
    const t = $('#fiche-corps .fiche-titre');
    t.value = titre;
    t.dispatchEvent(new Event('input'));
    const avant = FAUX_GRIST.actions.length;
    $('#fiche-sauver').click();
    await attendre(600);
    return Banc.actionsDepuis(avant).find(a => a[0] === 'AddRecord')?.[3] || {};
  };

  // ── A. Sans filtre : pastilles vides, pas d'avis ──
  await nouvelle([]);
  ok('sans filtre : pastilles modifiables vides (« + … »), calculée omise',
    pastilles() === '+ Priorité|+ Projet', pastilles());
  ok('sans filtre : avis masqué', avis()?.hidden === true);
  pastille('+ Projet').click();
  await attendre(150);
  ok('sans filtre : menu Projet sans séparateur', !!$('.fiche-menu') && !$('.fiche-menu .fiche-menu-separateur'));
  Fiche.fermerMenu();
  fermerFiche(true);

  // ── B. Projet est Vitrine, Thèmes est Site : préremplis ──
  await nouvelle([filtre('Projet', 'est', ['Vitrine']), filtre('Themes', 'est', ['Site'])]);
  ok('Projet prérempli dans sa pastille', pastilles() === '+ Priorité|Vitrine', pastilles());
  ok('Thèmes (hors pastilles) annoncé : « D\'après la vue : Thèmes = Site »', info().includes('Thèmes = Site'), info());
  ok('pas d\'alerte', alerte() === '', alerte());
  ok('préremplissage : pas une modification (fermer sans confirmation)', !ficheModifiee());
  pastille('Vitrine').click();
  await attendre(150);
  ok('menu Projet : Vitrine, puis « Hors de la vue », puis Atelier',
    lignesMenu().join('|') === 'Vitrine|Hors de la vue|Atelier', lignesMenu().join('|'));
  choisir('Atelier');
  await attendre(100);
  ok('Projet hors de la vue : alerte « masquée par la vue (Projet) »', /masquée par la vue \(Projet\)/.test(alerte()), alerte());
  let champs = await creer('Carte hors de la vue');
  ok('création : Projet = 1 (Atelier, choisi) et Thèmes = [\'L\', \'Site\'] (vue)',
    champs.Projet === 1 && JSON.stringify(champs.Themes) === '["L","Site"]', JSON.stringify(champs));
  ok('création : message « masquée par les filtres de la vue »', $('#toast').textContent.includes('masquée par les filtres'), $('#toast').textContent);
  fermerFiche(true);

  // ── C. Priorité est Now : écrite telle quelle si l'on ne touche à rien ──
  await nouvelle([filtre('Priorite', 'est', ['Now'])]);
  ok('Priorité préremplie', pastilles() === 'Now|+ Projet', pastilles());
  pastille('Now').click();
  await attendre(150);
  ok('menu Priorité : Now, puis « Hors de la vue », puis Later',
    lignesMenu().join('|') === 'Now|Hors de la vue|Later', lignesMenu().join('|'));
  Fiche.fermerMenu();
  champs = await creer('Carte prioritaire');
  ok('création : Priorite = Now', champs.Priorite === 'Now' && !('Projet' in champs), JSON.stringify(champs));
  ok('création : carte visible, message simple', $('#toast').textContent.includes('Carte créée') && !$('#toast').textContent.includes('masquée'), $('#toast').textContent);
  fermerFiche(true);

  // ── D. Version est A ou B (hors pastilles, deux valeurs) : rien de prérempli, alerte ──
  await nouvelle([filtre('Version', 'est', ['Version A', 'Version B'])]);
  ok('deux valeurs : rien d\'annoncé comme prérempli', info() === '', info());
  ok('deux valeurs : alerte (Version) dès l\'ouverture', /\(Version\)/.test(alerte()), alerte());
  fermerFiche(true);

  // ── E. Menu de recherche (plus de 12 projets) : séparateur, et recherche ──
  for (let i = 3; i <= 16; i++) { FAUX_GRIST.donnees.Projets.id.push(i); FAUX_GRIST.donnees.Projets.Nom.push(`Projet ${i}`); FAUX_GRIST.donnees.Projets.Etat.push(''); }
  await nouvelle([filtre('Projet', 'est', ['Projet 7'])]);
  ok('nouveau projet (lu à l\'ouverture) prérempli', pastilles() === '+ Priorité|Projet 7', pastilles());
  pastille('Projet 7').click();
  await attendre(150);
  const saisie = $('.fiche-menu .fiche-menu-saisie');
  ok('menu de recherche : Projet 7 en tête, puis « Hors de la vue »',
    !!saisie && lignesMenu().slice(0, 2).join('|') === 'Projet 7|Hors de la vue', lignesMenu().slice(0, 3).join('|'));
  saisie.value = 'atel';
  saisie.dispatchEvent(new Event('input'));
  ok('recherche hors de la vue seulement : plus de séparateur', lignesMenu().join('|') === 'Atelier', lignesMenu().join('|'));
  saisie.value = 'projet 1';
  saisie.dispatchEvent(new Event('input'));
  ok('recherche : séparateur retiré quand la vue n\'a plus de résultat', !$('.fiche-menu .fiche-menu-separateur'), lignesMenu().join('|'));
  Fiche.fermerMenu();
  fermerFiche(true);

  // ── F. Une carte existante : menus non rangés ──
  ETAT.filtres = [filtre('Projet', 'est', ['Atelier'])];
  afficherGrille();
  ouvrirFiche(1);
  await attendre(100);
  pastille('Atelier').click();
  await attendre(150);
  ok('carte existante : pas de séparateur ni d\'avis', !$('.fiche-menu .fiche-menu-separateur') && !avis());
  Fiche.fermerMenu();
  fermerFiche(true);
  ETAT.filtres = [];
});
