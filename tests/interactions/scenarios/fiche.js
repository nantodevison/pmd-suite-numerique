// La fiche : ouverture au clic, valeurs affichées, modification du titre, de
// la date, du type et des personnes (seules les colonnes modifiées sont
// écrites), fermeture avec confirmation, création (titre exigé, date et
// projet remplis d'office), référence simple, date sans heure, lien calculé
// en lecture seule, personne ajoutée dans Grist, Ctrl + S et Échap.
Banc.lancer(async () => {
  const { ok, $, $$ } = Banc;
  const relancer = async (options) => {
    if (ETAT.fiche) fermerFiche(true);
    ETAT.reglages = null; ETAT.reglagesProposes = true;
    await Banc.demarrer(options);
  };
  const ficheOuverte = () => $('#fiche').classList.contains('open');
  const ouvrir = async (id) => { $(`.interaction[data-id="${id}"]`).click(); await Banc.attendre(50); };
  const sauver = async () => { $('#fiche-sauver').click(); await Banc.attendre(200); };
  const saisirTitre = (texte) => {
    const t = $('#fiche-corps .fiche-titre');
    t.value = texte;
    t.dispatchEvent(new Event('input'));
  };
  const itemMenu = (texte) => $$('.fiche-menu .fiche-menu-item').find(b => b.textContent.includes(texte));
  const personnes = () => $$('#fiche-corps .personne').map(p => Number(p.dataset.id));
  const paris = (iso, decalage) => Date.parse(iso + decalage) / 1000;
  FAUX_GRIST.masquees = [6];

  // 1. Ouverture et valeurs affichées
  await relancer({ projet: 1 });
  await ouvrir(1);
  ok('clic sur une ligne : fiche ouverte', ficheOuverte() && ETAT.fiche?.id === 1);
  ok('titre', $('#fiche-corps .fiche-titre').value === 'Réunion de lancement');
  ok('date et heure de Paris', $('#fiche-date').type === 'datetime-local' && $('#fiche-date').value === '2026-03-10T09:30',
    $('#fiche-date').value);
  ok('type', $('#fiche-type').textContent === 'Réunion');
  ok('personnes', JSON.stringify(personnes()) === '[1,2]' && $('#fiche-corps .personne').textContent.includes('Personne A'));
  ok('lien et « Ouvrir la note »', $('#fiche-lien').value === 'https://docs.exemple.org/docs/note-1/'
    && ($('#fiche-corps .champ-aide a')?.getAttribute('href') || '') === 'https://docs.exemple.org/docs/note-1/');
  ok('projet rappelé', ($('#fiche-corps .fiche-rappel')?.textContent || '') === '📁 Atelier vélo');
  ok('ancienne description, mise en forme', $('#fiche-corps .description-ancienne strong')?.textContent === 'note');
  ok('sans modification : Sauvegarder grisé', $('#fiche-sauver').disabled && !$('#fiche-modifie').classList.contains('visible'));

  // 2. Titre modifié : seule cette colonne est écrite
  saisirTitre('Réunion de lancement (v2)');
  ok('titre modifié : indicateur, Sauvegarder actif', !$('#fiche-sauver').disabled && $('#fiche-modifie').classList.contains('visible'));
  let avant = FAUX_GRIST.actions.length;
  await sauver();
  ok('sauvegarde : UpdateRecord du seul titre', JSON.stringify(Banc.actionsDepuis(avant))
    === JSON.stringify([['UpdateRecord', 'Interactions', 1, { Titre: 'Réunion de lancement (v2)' }]]),
    JSON.stringify(Banc.actionsDepuis(avant)));
  ok('sauvegarde : fiche fermée, message', !ficheOuverte() && $('#toast').textContent.includes('sauvegardées'));
  ok('sauvegarde : liste à jour', $('.interaction[data-id="1"] .interaction-titre')?.textContent === 'Réunion de lancement (v2)');

  // 3. Date, type et personnes
  await ouvrir(1);
  const date = $('#fiche-date');
  date.value = '2026-03-11T08:15';
  date.dispatchEvent(new Event('change'));
  $('#fiche-type').click();
  itemMenu('Atelier').click();
  ok('type choisi : pastille à jour', $('#fiche-type').textContent === 'Atelier');
  $('#fiche-corps .personne[data-id="2"] .personne-retirer').click();
  ok('personne retirée', JSON.stringify(personnes()) === '[1]');
  $('#fiche-ajouter-personne').click();
  await Banc.attendre(100);
  ok('menu des personnes : sans celles déjà là', !itemMenu('Personne A') && Boolean(itemMenu('Personne C')));
  itemMenu('Personne C').click();
  ok('personne ajoutée', JSON.stringify(personnes()) === '[1,3]');
  ok('date gardée après redessin', $('#fiche-date').value === '2026-03-11T08:15');
  avant = FAUX_GRIST.actions.length;
  await sauver();
  const ecrit = Banc.actionsDepuis(avant)[0]?.[3] || {};
  ok('sauvegarde : date de Paris en secondes', ecrit.Date === paris('2026-03-11T08:15:00', '+01:00'), JSON.stringify(ecrit));
  ok('sauvegarde : type', ecrit.Type === 'Atelier');
  ok('sauvegarde : personnes en liste', JSON.stringify(ecrit.Contacts) === '["L",1,3]');
  ok('sauvegarde : rien d\'autre', JSON.stringify(Object.keys(ecrit).sort()) === '["Contacts","Date","Type"]');

  // 4. Retirer toutes les personnes : cellule vide ; lien effacé
  await ouvrir(2);
  $('#fiche-corps .personne-retirer').click();
  avant = FAUX_GRIST.actions.length;
  await sauver();
  ok('plus personne : null écrit', (Banc.actionsDepuis(avant)[0]?.[3] || {}).Contacts === null,
    JSON.stringify(Banc.actionsDepuis(avant)));

  // 5. Lien non reconnu : averti
  await ouvrir(2);
  const lien = $('#fiche-lien');
  lien.value = 'javascript:alert(1)';
  lien.dispatchEvent(new Event('input'));
  ok('lien non reconnu : averti, pas de lien', ($('#fiche-corps .champ-aide')?.textContent || '').includes('https://')
    && !$('#fiche-corps .champ-aide a'));

  // 6. Fermer avec des modifications : confirmation
  Banc.repondre(false);
  $('#fiche-fermer').click();
  ok('fermer, « non » : fiche gardée', ficheOuverte());
  Banc.repondre(true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok('Échap, « oui » : fiche fermée, rien écrit', !ficheOuverte()
    && !FAUX_GRIST.actions.flat().some(a => a[3]?.url === 'javascript:alert(1)'));

  // 7. Création
  $('#bouton-creer').click();
  await Banc.attendre(50);
  ok('création : fiche vide', ficheOuverte() && ETAT.fiche.id === null && $('#fiche-corps .fiche-titre').value === '');
  ok('création : libellé de la fiche', $('#fiche-libelle').textContent === 'Nouveau : Rendez-vous');
  ok('création : date du jour proposée', $('#fiche-date').value.slice(0, 4) === String(new Date().getFullYear()));
  ok('création : projet rappelé', $('#fiche-corps .fiche-rappel').textContent === '📁 Atelier vélo');
  ok('création : Sauvegarder actif', !$('#fiche-sauver').disabled);
  avant = FAUX_GRIST.actions.length;
  await sauver();
  ok('création sans titre : refusée', FAUX_GRIST.actions.length === avant && ficheOuverte()
    && $('#toast').textContent.includes('titre'));
  saisirTitre('Nouveau rendez-vous');
  $('#fiche-ajouter-personne').click();
  await Banc.attendre(100);
  itemMenu('Personne B').click();
  lien.value = '';
  $('#fiche-lien').value = 'https://docs.exemple.org/docs/note-7/';
  $('#fiche-lien').dispatchEvent(new Event('input'));
  await sauver();
  const ajout = Banc.actionsDepuis(avant)[0] || [];
  ok('création : AddRecord', ajout[0] === 'AddRecord' && ajout[1] === 'Interactions', JSON.stringify(ajout));
  ok('création : titre, personnes, lien', ajout[3]?.Titre === 'Nouveau rendez-vous'
    && JSON.stringify(ajout[3]?.Contacts) === '["L",2]' && ajout[3]?.url === 'https://docs.exemple.org/docs/note-7/');
  ok('création : projet en liste', JSON.stringify(ajout[3]?.Projets) === '["L",1]');
  ok('création : date (maintenant)', Math.abs((ajout[3]?.Date || 0) - Date.now() / 1000) < 120, ajout[3]?.Date);
  ok('création : liste à jour, en tête', Number($('.interaction')?.dataset.id) === 7, $('.interaction')?.dataset.id);

  // 8. Référence simple et date sans heure
  await relancer({ projet: 2, colonnes: { Projet: 'Projet_principal', Date: 'Jour' } });
  $('#bouton-creer').click();
  await Banc.attendre(50);
  ok('date sans heure : champ date', $('#fiche-date').type === 'date');
  saisirTitre('Atelier du jour');
  $('#fiche-date').value = '2026-09-15';
  $('#fiche-date').dispatchEvent(new Event('change'));
  avant = FAUX_GRIST.actions.length;
  await sauver();
  const ajout2 = Banc.actionsDepuis(avant)[0]?.[3] || {};
  ok('référence simple : numéro du projet', ajout2.Projet_principal === 2 && !('Projets' in ajout2), JSON.stringify(ajout2));
  ok('date sans heure : minuit universel', ajout2.Jour === Date.parse('2026-09-15T00:00:00Z') / 1000, ajout2.Jour);

  // 9. Lien calculé par une formule : lecture seule, jamais écrit
  await relancer({ projet: 1, colonnes: { Lien: 'Lien_calcule' } });
  await ouvrir(1);
  ok('lien calculé : champ grisé, 🔒', $('#fiche-lien').disabled && $('#fiche-corps').textContent.includes('🔒'));
  saisirTitre('Titre modifié');
  avant = FAUX_GRIST.actions.length;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
  await Banc.attendre(200);
  ok('Ctrl + S : sauvegardé, sans le lien calculé', JSON.stringify(Banc.actionsDepuis(avant))
    === JSON.stringify([['UpdateRecord', 'Interactions', 1, { Titre: 'Titre modifié' }]]),
    JSON.stringify(Banc.actionsDepuis(avant)));

  // 10. Personne ajoutée dans Grist : proposée sans recharger
  FAUX_GRIST.ajouterContact('Personne D');
  await ouvrir(3);
  $('#fiche-ajouter-personne').click();
  await Banc.attendre(100);
  ok('personne ajoutée dans Grist : proposée', Boolean(itemMenu('Personne D')));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok('Échap : ferme d\'abord le menu', !$('.fiche-menu') && ficheOuverte());

  // 11. Envoi de Grist pendant une modification : la saisie reste
  saisirTitre('Saisie en cours');
  FAUX_GRIST.renvoyer();
  await Banc.attendre(200);
  ok('envoi de Grist : saisie gardée', $('#fiche-corps .fiche-titre').value === 'Saisie en cours');
  fermerFiche(true);

  // 12. Longue description, titre vide : le titre garde sa hauteur (constaté
  // le 2026-11-18 : la fiche qui déborde écrasait la zone du titre)
  FAUX_GRIST.modifier(5, { Description: Array(80).fill('Ligne de l\'ancienne description.').join('\n\n') });
  await Banc.attendre(100);
  await ouvrir(5);
  saisirTitre('Nouveau titre');
  await Banc.attendre(50);
  const zoneTitre = $('#fiche-corps .fiche-titre');
  ok('longue description : titre non écrasé', zoneTitre.getBoundingClientRect().height >= zoneTitre.scrollHeight - 1
    && zoneTitre.getBoundingClientRect().height > 20,
    `${zoneTitre.getBoundingClientRect().height} px pour ${zoneTitre.scrollHeight}`);
  fermerFiche(true);
});
