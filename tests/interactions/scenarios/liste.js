// La liste : filtre sur le projet (liste ou référence simple), ordre du plus
// récent au plus ancien, filtre de la vue Grist respecté, date et heure de
// Paris, pastille du type, personnes, lien sûr seulement, titre piégé,
// associations manquantes, table illisible, projet sans interaction.
Banc.lancer(async () => {
  const { ok, $, $$ } = Banc;
  const relancer = async (options) => {
    ETAT.reglages = null; ETAT.reglagesProposes = true;
    await Banc.demarrer(options);
  };
  const ids = () => $$('.interaction').map(l => Number(l.dataset.id));
  const ligne = (id) => $(`.interaction[data-id="${id}"]`);

  // 1. Projet 1 (liste de références), ligne 6 masquée par la vue Grist
  FAUX_GRIST.masquees = [6];
  await relancer({ projet: 1 });
  ok('projet 1 : du plus récent au plus ancien, sans date à la fin', JSON.stringify(ids()) === '[2,3,1,5]', JSON.stringify(ids()));
  ok('compte', $('.journal-compte')?.textContent === '4 interactions', $('.journal-compte')?.textContent);
  ok('date et heure de Paris (heure d\'été)', ligne(2).querySelector('.interaction-date').textContent === '2 mai 2026 · 14:00',
    ligne(2).querySelector('.interaction-date').textContent);
  ok('date et heure de Paris (heure d\'hiver)', ligne(1).querySelector('.interaction-date').textContent === '10 mars 2026 · 09:30',
    ligne(1).querySelector('.interaction-date').textContent);
  ok('sans date', ligne(5).querySelector('.interaction-date').textContent === 'Sans date');
  ok('sans titre', ligne(5).querySelector('.interaction-titre').textContent === 'Sans titre'
    && ligne(5).querySelector('.interaction-sans-titre') !== null);

  // Type : couleur du choix dans Grist, ou pastel
  const temoin = document.createElement('span');
  temoin.style.background = '#BFDBFE';
  document.body.appendChild(temoin);
  const fondReunion = getComputedStyle(temoin).backgroundColor;
  ok('type : couleur du choix de Grist', getComputedStyle(ligne(1).querySelector('.pastille')).backgroundColor === fondReunion);
  temoin.style.background = Pastilles.couleurPastel('Appel').fond;
  ok('type sans couleur : pastel', getComputedStyle(ligne(2).querySelector('.pastille')).backgroundColor
    === getComputedStyle(temoin).backgroundColor);
  temoin.remove();
  ok('type vide : pas de pastille', ligne(3).querySelector('.pastille') === null);

  ok('personnes : noms', ligne(1).querySelector('.interaction-personnes')?.textContent === '👤 Personne A, Personne B');
  ok('personne vide : rien', ligne(3).querySelector('.interaction-personnes') === null);

  // Lien : seulement https, nouvel onglet, sans ouvrir la fiche
  const lien = ligne(1).querySelector('a.interaction-lien');
  ok('lien https : 🔗 nouvel onglet', lien && lien.getAttribute('href') === 'https://docs.exemple.org/docs/note-1/'
    && lien.target === '_blank' && lien.rel.includes('noopener'));
  ok('lien vide : pas de 🔗', ligne(2).querySelector('a') === null);
  ok('lien javascript: : pas de 🔗', ligne(3).querySelector('a') === null && !$('#contenu').innerHTML.includes('javascript:'));
  const ouvrir = window.open;
  window.open = () => null;   // le navigateur n'ouvre rien pendant le banc
  lien.addEventListener('click', (e) => e.preventDefault(), { once: true });
  lien.click();
  window.open = ouvrir;
  await Banc.attendre(50);
  ok('clic sur 🔗 : la fiche ne s\'ouvre pas', !$('#fiche').classList.contains('open'));

  // Titre piégé : affiché comme du texte
  ok('titre piégé : texte, pas de HTML', ligne(3).querySelector('.interaction-titre').textContent.includes('<img')
    && ligne(3).querySelector('img') === null);
  await Banc.attendre(100);
  ok('titre piégé : rien exécuté', window.PIEGE === undefined);

  // 2. Ligne 6 visible : elle arrive en tête
  FAUX_GRIST.masquees = [];
  FAUX_GRIST.renvoyer();
  await Banc.attendre(300);
  ok('filtre de la vue retiré : ligne 6 en tête', JSON.stringify(ids()) === '[6,2,3,1,5]', JSON.stringify(ids()));

  // 3. Une interaction peut servir plusieurs projets
  await relancer({ projet: 2 });
  ok('projet 2 : interactions qui le contiennent', JSON.stringify(ids()) === '[4,2]', JSON.stringify(ids()));
  ok('compte au singulier/pluriel', $('.journal-compte')?.textContent === '2 interactions');

  // 4. Projet sans interaction
  await relancer({ projet: 3 });
  ok('projet sans interaction : message', ($('.journal')?.textContent || '').includes('Aucune interaction pour ce projet'));
  ok('projet sans interaction : bouton de création', $('#bouton-creer')?.textContent === '＋ Rendez-vous');
  ok('compte 0', $('.journal-compte')?.textContent === '0 interaction');

  // 5. Projet en référence simple, date sans heure
  await relancer({ projet: 1, colonnes: { Projet: 'Projet_principal', Date: 'Jour' } });
  ok('référence simple : interactions du projet', JSON.stringify(ids()) === '[6,3,1,5]', JSON.stringify(ids()));
  ok('date sans heure', ligne(1).querySelector('.interaction-date').textContent === '10 mars 2026',
    ligne(1).querySelector('.interaction-date').textContent);

  // 6. Colonnes facultatives non associées
  await relancer({ projet: 1, colonnes: { Type: null, Personnes: null, Lien: null, Description: null } });
  ok('sans colonnes facultatives : liste', ids().length === 5 && $('.interaction .pastille') === null
    && $('.interaction a') === null && $('.interaction-personnes') === null);

  // 7. Colonnes obligatoires manquantes
  await relancer({ projet: 1, colonnes: { Titre: null, Projet: null } });
  ok('colonnes manquantes : message', ($('#contenu .message')?.textContent || '').includes('Titre, Projet'),
    $('#contenu')?.textContent);

  // 8. Table illisible
  FAUX_GRIST.tableIllisible = true;
  await relancer({ projet: 1 });
  ok('table illisible : accès complet demandé', ($('#contenu .message')?.textContent || '').includes('accès complet'));
  FAUX_GRIST.tableIllisible = false;

  // 9. Changement fait dans Grist : la liste suit
  await relancer({ projet: 1 });
  FAUX_GRIST.modifier(5, { Titre: 'Titre ajouté dans Grist', Date: Date.parse('2026-08-01T10:00:00+02:00') / 1000 });
  await Banc.attendre(300);
  ok('changement dans Grist : liste à jour', ids()[0] === 5 && ligne(5).querySelector('.interaction-titre').textContent === 'Titre ajouté dans Grist',
    JSON.stringify(ids()));

  // 10. Clavier : Entrée sur une ligne ouvre la fiche
  ligne(2).focus();
  ligne(2).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await Banc.attendre(50);
  ok('Entrée sur une ligne : fiche ouverte', $('#fiche').classList.contains('open') && ETAT.fiche?.id === 2);
});
