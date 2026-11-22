// Modification du texte : saisie, barre de sauvegarde, envoi de Grist qui
// n'efface pas la saisie, sauvegarde (UpdateRecord), Annuler, Ctrl + S,
// case cochée dans l'aperçu, changement de ligne avec un texte non sauvegardé.
Banc.lancer(async () => {
  const { ok, $ } = Banc;
  // Le widget ne lit ses options qu'une fois (comme dans Grist) : on les oublie
  // avant chaque nouveau départ, sans rouvrir la fenêtre ⚙ d'office.
  const relancer = async (options) => { ETAT.criteres = null; ETAT.reglagesProposes = true; await Banc.demarrer(options); };
  const barreVisible = () => !$('#barre-sauver').hidden;
  /** Passe en saisie et remplace le texte. */
  const saisir = (texte) => {
    const zone = $('.page .fiche-md-saisie');
    if (!$('.page .fiche-md').classList.contains('en-saisie')) $('.page .fiche-md-bouton').click();
    zone.value = texte;
    zone.dispatchEvent(new Event('input'));
  };

  await relancer({ criteres: [{ col: 'id', valeur: 2 }] });
  ok('texte vide : invitation', ($('.page .fiche-md-rendu')?.textContent || '').includes('Aucune description'));
  saisir('Nouveau **texte**');
  ok('saisie : barre de sauvegarde visible', barreVisible());

  // Un envoi de Grist pendant la saisie ne l'efface pas
  FAUX_GRIST.renvoyer();
  await Banc.attendre(100);
  ok('envoi de Grist pendant la saisie : texte gardé', $('.page .fiche-md-saisie')?.value === 'Nouveau **texte**');

  // Sauvegarde
  let avant = FAUX_GRIST.actions.length;
  $('#bouton-sauver').click();
  await Banc.attendre(200);
  ok('sauvegarde : UpdateRecord de la seule colonne du texte', JSON.stringify(Banc.actionsDepuis(avant)) === JSON.stringify(
    [['UpdateRecord', 'Projets', 2, { Presentation: 'Nouveau **texte**' }]]), JSON.stringify(Banc.actionsDepuis(avant)));
  ok('sauvegarde : barre cachée', !barreVisible());
  ok('sauvegarde : aperçu mis à jour', $('.page .fiche-md-rendu strong')?.textContent === 'texte');
  ok('sauvegarde : message', $('#toast').textContent.includes('sauvegardé'), $('#toast').textContent);

  // Annuler : confirmation ; « non » garde la saisie, « oui » revient au texte de Grist
  saisir('Brouillon à jeter');
  Banc.repondre(false);
  $('#bouton-annuler').click();
  ok('Annuler, puis « non » : saisie gardée', barreVisible() && $('.page .fiche-md-saisie')?.value === 'Brouillon à jeter');
  Banc.repondre(true);
  $('#bouton-annuler').click();
  ok('Annuler, puis « oui » : texte de Grist', !barreVisible() && $('.page .fiche-md-rendu strong')?.textContent === 'texte');

  // Ctrl + S
  saisir('Texte par raccourci');
  avant = FAUX_GRIST.actions.length;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true }));
  await Banc.attendre(200);
  ok('Ctrl + S : sauvegardé', JSON.stringify(Banc.actionsDepuis(avant)[0]?.[3]) === '{"Presentation":"Texte par raccourci"}',
    JSON.stringify(Banc.actionsDepuis(avant)));
  avant = FAUX_GRIST.actions.length;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true }));
  await Banc.attendre(100);
  ok('Ctrl + S sans modification : rien d\'écrit', FAUX_GRIST.actions.length === avant);

  // Case cochée dans l'aperçu, puis sauvegardée
  await relancer({ criteres: [{ col: 'id', valeur: 1 }] });
  const premiere = $('.page .fiche-md-rendu input[type="checkbox"]');
  premiere.click();
  ok('case cochée : barre visible', barreVisible());
  avant = FAUX_GRIST.actions.length;
  $('#bouton-sauver').click();
  await Banc.attendre(200);
  ok('case cochée : « [x] » écrit', (Banc.actionsDepuis(avant)[0]?.[3]?.Presentation || '').includes('- [x] Cartographier'),
    JSON.stringify(Banc.actionsDepuis(avant)));

  // Changer de ligne (⚙) avec un texte non sauvegardé : confirmation
  saisir('Texte pas encore sauvegardé');
  $('#bouton-reglages').click();
  const valeur = $('#criteres .critere select:nth-of-type(2)');
  const o = [...valeur.options].find(x => x.textContent === '#2 — Vitrine');
  valeur.value = o.value;
  valeur.dispatchEvent(new Event('change', { bubbles: true }));
  const appliquer = [...document.querySelectorAll('.fenetre-pied button')].find(b => b.textContent.includes('Appliquer'));
  const nb = Banc.confirmations.length;
  Banc.repondre(false);
  appliquer.click();
  await Banc.attendre(50);
  ok('changer de ligne, « non » : confirmation, fenêtre ouverte', Banc.confirmations.length === nb + 1 && $('dialog.fenetre').open);
  // Question commune (../_commun/messages.js, #249)
  ok('question : « Le texte modifié n\'est pas sauvegardé. L\'abandonner ? »',
    Banc.confirmations.at(-1) === 'Le texte modifié n\'est pas sauvegardé. L\'abandonner ?', Banc.confirmations.at(-1));
  Banc.repondre(true);
  appliquer.click();
  await Banc.attendre(100);
  ok('changer de ligne, « oui » : page de la ligne 2', $('.page')?.dataset.id === '2' && !barreVisible());
  ok('changer de ligne : texte abandonné non écrit', !FAUX_GRIST.actions.flat().some(a => a[3]?.Presentation === 'Texte pas encore sauvegardé'));
});
