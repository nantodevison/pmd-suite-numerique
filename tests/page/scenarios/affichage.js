// Affichage de la page : titre, pastilles, texte Markdown ; curseur de Grist ;
// critère sur une référence renommée ; aucune ou plusieurs lignes ;
// association incomplète ; texte calculé en lecture seule ; texte piégé.
Banc.lancer(async () => {
  const { ok, $, $$ } = Banc;
  // Le widget ne lit ses options qu'une fois (comme dans Grist) : on les oublie
  // avant chaque nouveau départ, sans rouvrir la fenêtre ⚙ d'office.
  const relancer = async (options) => { ETAT.criteres = null; ETAT.reglagesProposes = true; await Banc.demarrer(options); };
  const textes = (sel) => $$(sel).map(e => e.textContent);
  const message = () => $('.page-message')?.textContent || '';

  await relancer({ criteres: [{ col: 'id', valeur: 1 }] });
  ok('page de la ligne 1', $('.page')?.dataset.id === '1');
  ok('titre', $('.page-titre')?.textContent === 'Atelier vélo');
  ok('pastilles : type puis chef de projet', textes('.page-pastilles .pastille').join('|') === 'Interne|Personne A',
    textes('.page-pastilles .pastille').join('|'));
  const interne = $('.page-pastilles .pastille');
  ok('pastille : couleur du choix dans Grist', interne?.style.background.includes('254, 202, 202'), interne?.style.background);
  ok('pastille : libellé au survol', interne?.title === 'Type : Interne', interne?.title);
  ok('texte : titre Markdown mis en forme', $('.page .fiche-md-rendu h1')?.textContent === 'Objectifs');
  ok('texte : cases à cocher cliquables', $$('.page .fiche-md-rendu input[type="checkbox"]').filter(c => !c.disabled).length === 2);
  ok('texte : bouton « Modifier »', ($('.page .fiche-md-bouton')?.textContent || '').includes('Modifier'));
  ok('barre de sauvegarde cachée', $('#barre-sauver').hidden);
  ok('curseur de Grist placé sur la ligne 1', JSON.stringify(FAUX_GRIST.curseurs) === '[{"rowId":1}]',
    JSON.stringify(FAUX_GRIST.curseurs));
  FAUX_GRIST.renvoyer();
  await Banc.attendre(100);
  ok('nouvel envoi : curseur non replacé', FAUX_GRIST.curseurs.length === 1);

  // Liste de références en pastilles : une pastille par personne, colorée
  await relancer({ criteres: [{ col: 'id', valeur: 1 }], colonnes: { Pastilles: ['Equipe'] } });
  ok('liste de références : une pastille par personne',
    textes('.page-pastilles .pastille').join('|') === 'Personne A|Personne B', textes('.page-pastilles .pastille').join('|'));
  ok('liste de références : libellé au survol',
    $('.page-pastilles .pastille')?.title === 'Équipe projet : Personne A', $('.page-pastilles .pastille')?.title);
  ok('liste de références : pastel', Boolean($('.page-pastilles .pastille')?.style.background));
  await relancer({ criteres: [{ col: 'id', valeur: 2 }], colonnes: { Pastilles: ['Equipe'] } });
  ok('liste de références vide : pas de pastille', !$('.page-pastilles'));

  // Critère sur une référence : retenu sous son numéro, il survit au renommage
  await relancer({ criteres: [{ col: 'Chef', valeur: 2 }] });
  ok('référence : ligne 2', $('.page')?.dataset.id === '2' && $('.page-titre')?.textContent === 'Vitrine');
  // Le navigateur traduit hsl() en rgb() : on compare à un élément témoin
  const temoin = document.createElement('span');
  temoin.style.background = Pastilles.couleurPastel('Collectivité').fond;
  ok('choix sans couleur Grist → pastel propre à la valeur',
    $('.page-pastilles .pastille')?.style.background === temoin.style.background,
    `${$('.page-pastilles .pastille')?.style.background} / ${temoin.style.background}`);
  FAUX_GRIST.contacts.Nom[1] = 'Personne B renommée';
  FAUX_GRIST.modifier(2, { Chef: 'Personne B renommée' });
  await Banc.attendre(100);
  ok('référence renommée : toujours la ligne 2', $('.page')?.dataset.id === '2');
  ok('référence renommée : nouveau nom affiché', textes('.page-pastilles .pastille').includes('Personne B renommée'),
    textes('.page-pastilles .pastille').join('|'));
  FAUX_GRIST.contacts.Nom[1] = 'Personne B';
  FAUX_GRIST.modifier(2, { Chef: 'Personne B' });
  await Banc.attendre(100);

  // Aucune ligne, plusieurs lignes : message clair et bouton ⚙
  await relancer({ criteres: [{ col: 'id', valeur: 99 }] });
  ok('aucune ligne : message', message().includes('Aucune ligne ne correspond') && message().includes('N° de ligne = #99'), message());
  ok('aucune ligne : bouton ⚙', Boolean($('.page-message .btn-primary')));
  ok('aucune ligne : fenêtre pas ouverte d\'office', !$('dialog.fenetre').open);
  await relancer({ criteres: [{ col: 'Titre', valeur: 'Atelier vélo' }] });
  ok('deux lignes : message', message().includes('2 lignes correspondent'), message());
  await relancer({ criteres: [{ col: 'Colonne_supprimee', valeur: 'x' }] });
  ok('colonne disparue : aucune ligne', message().includes('Aucune ligne ne correspond'), message());
  await relancer({ criteres: 'mal formé' });
  ok('options mal formées : comme sans critère', message().includes('Aucune ligne choisie'), message());

  // Association : sans titre, message ; sans pastilles, pas de zone
  await relancer({ criteres: [{ col: 'id', valeur: 1 }], colonnes: { Titre: null } });
  ok('sans colonne Titre : message', message().includes('Titre'), message());
  await relancer({ criteres: [{ col: 'id', valeur: 1 }], colonnes: { Pastilles: null } });
  ok('sans pastilles : pas de zone de pastilles', $('.page') && !$('.page-pastilles'));
  await relancer({ criteres: [{ col: 'id', valeur: 1 }], colonnes: { Texte: null } });
  ok('sans texte : titre seul', $('.page-titre') && !$('.page .fiche-md'));

  // Texte calculé par une formule : lecture seule, signalée
  await relancer({ criteres: [{ col: 'id', valeur: 1 }], colonnes: { Texte: 'Resume' } });
  ok('texte calculé : affiché', ($('.page .fiche-md-rendu')?.textContent || '').includes('Résumé : Atelier vélo'));
  ok('texte calculé : pas de « Modifier »', !$('.page .fiche-md-bouton'));
  ok('texte calculé : note 🔒', ($('.page-note')?.textContent || '').includes('🔒'));
  // Colonne vide (formule vide) : modifiable
  await relancer({ criteres: [{ col: 'id', valeur: 1 }], colonnes: { Texte: 'Notes' } });
  ok('colonne vide : modifiable', Boolean($('.page .fiche-md-bouton')));

  // Texte piégé : ni script, ni gestionnaire d'événement, ni lien javascript:
  await relancer({ criteres: [{ col: 'id', valeur: 3 }] });
  await Banc.attendre(200);
  const rendu = $('.page .fiche-md-rendu');
  ok('texte piégé : le Markdown reste affiché', rendu?.querySelector('strong')?.textContent === 'gras');
  ok('texte piégé : aucun script exécuté', window.PIEGE === undefined, String(window.PIEGE));
  ok('texte piégé : aucun script ni onerror dans la page', !rendu.querySelector('script, [onerror]'));
  ok('texte piégé : pas de lien javascript:', ![...rendu.querySelectorAll('a')].some(a => /^javascript:/i.test(a.getAttribute('href') || '')));

  // Table illisible (droits) : message
  FAUX_GRIST.tableIllisible = true;
  await relancer({ criteres: [{ col: 'id', valeur: 1 }] });
  ok('table illisible : message « accès complet »', message().includes('accès complet'), message());
  FAUX_GRIST.tableIllisible = false;
});
