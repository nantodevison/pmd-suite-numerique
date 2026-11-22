// Fenêtre ⚙ « Projet » : ouverte d'office sans projet, projets proposés de
// A à Z, « Appliquer » refusé sans projet, options enregistrées, libellé du
// bouton, options lues une seule fois, Annuler, projet disparu.
Banc.lancer(async () => {
  const { ok, $ } = Banc;
  const fenetreOuverte = () => Boolean($('dialog.fenetre')?.open);
  const boutonFenetre = (texte) => [...document.querySelectorAll('.fenetre-pied button')].find(b => b.textContent.includes(texte));
  const choix = () => $('#reglages-choix-projet');
  const choisir = (libelle) => {
    const o = [...choix().options].find(x => x.textContent === libelle);
    choix().value = o ? o.value : '';
    choix().dispatchEvent(new Event('change', { bubbles: true }));
  };
  // Le widget ne lit ses options qu'une fois (comme dans Grist) : on les oublie
  // avant chaque nouveau départ.
  const relancer = async (options, proposer = true) => {
    ETAT.reglages = null; ETAT.reglagesProposes = !proposer;
    await Banc.demarrer(options);
  };

  // 1. Sans projet : message, bouton, et ⚙ ouverte d'office (une fois)
  ETAT.reglages = null;
  FAUX_GRIST.demarrer({});
  await Banc.attendre(600);
  ok('sans projet : ⚙ ouverte d\'office', fenetreOuverte());
  ok('sans projet : message', ($('#contenu .message')?.textContent || '').includes('Aucun projet choisi'));
  ok('sans projet : bouton « Choisir le projet »', ($('#contenu .message button')?.textContent || '').includes('Choisir le projet'));
  ok('projets proposés de A à Z, après l\'invite', JSON.stringify([...choix().options].map(o => o.textContent))
    === JSON.stringify(['Choisir un projet…', 'Atelier vélo', 'Projet sans rendez-vous', 'Vitrine']),
    [...choix().options].map(o => o.textContent).join(' | '));
  ok('aide : table des projets nommée', $('#reglages-aide').textContent.includes('« Projets »'));
  ok('libellé du bouton par défaut', $('#reglages-libelle').value === 'Rendez-vous');
  ok('onglet ⚠️ sans projet', ($('.fenetre-onglet')?.textContent || '').includes('⚠️'), $('.fenetre-onglet')?.textContent);

  // 2. « Appliquer » sans projet : refusé
  boutonFenetre('Appliquer').click();
  await Banc.attendre(50);
  ok('Appliquer sans projet : refusé, fenêtre ouverte', fenetreOuverte() && !('projet' in FAUX_GRIST.options));
  ok('Appliquer sans projet : message', $('#toast').textContent.includes('Choisissez un projet'));

  // 3. Projet choisi, libellé changé
  choisir('Atelier vélo');
  ok('onglet ✓ avec un projet', ($('.fenetre-onglet')?.textContent || '').includes('✓'), $('.fenetre-onglet')?.textContent);
  $('#reglages-libelle').value = '  Réunion  ';
  boutonFenetre('Appliquer').click();
  await Banc.attendre(100);
  ok('Appliquer : fenêtre fermée', !fenetreOuverte());
  ok('Appliquer : projet enregistré sous son numéro', FAUX_GRIST.options.projet === 1, JSON.stringify(FAUX_GRIST.options));
  ok('Appliquer : libellé enregistré sans espaces', FAUX_GRIST.options.libelleBouton === 'Réunion');
  ok('Appliquer : rappel « Enregistrer »', $('#toast').textContent.includes('Enregistrer'));
  ok('liste affichée : nom du projet', $('#barre-titre .barre-nom')?.textContent === ' · Atelier vélo');
  ok('bouton de création avec le libellé', $('#bouton-creer')?.textContent === '＋ Réunion');

  // 4. Grist rappelle onOptions après setOption : sans effet
  FAUX_GRIST.demarrer({ projet: 2 });
  await Banc.attendre(300);
  ok('options relues : ignorées (copie du widget)', $('#barre-titre .barre-nom')?.textContent === ' · Atelier vélo');

  // 5. Ouvrir ⚙ puis Annuler : rien ne change
  $('#bouton-reglages').click();
  ok('⚙ : projet actuel présélectionné', choix().selectedOptions[0]?.textContent === 'Atelier vélo');
  ok('⚙ : libellé actuel', $('#reglages-libelle').value === 'Réunion');
  choisir('Vitrine');
  Banc.repondre(true);
  boutonFenetre('Annuler').click();
  await Banc.attendre(50);
  ok('Annuler : projet inchangé', $('#barre-titre .barre-nom')?.textContent === ' · Atelier vélo' && FAUX_GRIST.options.projet === 1);

  // 6. Projet enregistré qui n'existe plus
  await relancer({ projet: 99 });
  ok('projet disparu : message', ($('#contenu .message')?.textContent || '').includes('n° 99'), $('#contenu')?.textContent);
  $('#bouton-reglages').click();
  ok('projet disparu : signalé dans ⚙', choix().selectedOptions[0]?.textContent === '⚠️ n° 99 (introuvable)');
  boutonFenetre('Appliquer').click();
  await Banc.attendre(50);
  ok('projet disparu : Appliquer refusé', fenetreOuverte());
  document.querySelectorAll('dialog[open]').forEach(d => d.close());

  // 7. Options mal formées : comme sans projet
  await relancer({ projet: 'Atelier vélo', libelleBouton: 12 }, false);
  ok('options mal formées : aucun projet', ($('#contenu .message')?.textContent || '').includes('Aucun projet choisi'));
  ok('options mal formées : libellé par défaut', ETAT.reglages.libelle === 'Rendez-vous');
});
