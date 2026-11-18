// Fenêtre ⚙ « Ligne affichée » : ouverte d'office sans critère, colonnes et
// valeurs proposées, résultat en direct, « Appliquer » refusé tant que les
// critères ne désignent pas une seule ligne, enregistrement des critères.
Banc.lancer(async () => {
  const { ok, $, $$ } = Banc;
  const fenetre = () => $('dialog.fenetre');
  const lignesCriteres = () => $$('#criteres .critere');
  const resultat = () => $('#criteres-resultat').textContent;
  const bouton = (texte) => $$('.fenetre-pied button').find(b => b.textContent.includes(texte));
  /** Choisit l'option de libellé `libelle` dans une liste déroulante. */
  const choisir = (select, libelle) => {
    const o = [...select.options].find(x => x.textContent === libelle);
    if (!o) return false;
    select.value = o.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  const colonne = (n) => lignesCriteres()[n].querySelectorAll('select')[0];
  const valeur = (n) => lignesCriteres()[n].querySelectorAll('select')[1];
  const libelles = (select) => [...select.options].map(o => o.textContent);

  // Premier chargement, sans critère : on n'appelle pas Banc.demarrer, qui
  // fermerait la fenêtre ouverte d'office.
  localStorage.clear();
  FAUX_GRIST.demarrer({});
  await Banc.attendre(500);
  ok('sans critère : message', ($('.page-message')?.textContent || '').includes('Aucune ligne choisie'));
  ok('sans critère : bouton « ⚙ Choisir la ligne »', Boolean($('.page-message .btn-primary')));
  ok('sans critère : fenêtre ouverte d\'office', fenetre()?.open === true);
  ok('un critère vide proposé', lignesCriteres().length === 1);
  ok('critère vide : N° de ligne', colonne(0).selectedOptions[0]?.textContent === 'N° de ligne');
  ok('critère vide : résultat', resultat() === 'Choisissez au moins un critère.', resultat());
  ok('aide : nom de la table', $('#reglages-aide').textContent.includes('« Projets »'));

  // Colonnes proposées : numéro d'abord, puis A → Z ; ni liste, ni colonne interne
  const cols = libelles(colonne(0));
  ok('colonnes proposées', cols.join('|') === 'N° de ligne|Année|Archivé|Chef de projet|Présentation|Résumé|Titre|Type', cols.join('|'));

  // Valeurs du numéro de ligne : « #1 — titre », dans l'ordre des numéros
  const nums = libelles(valeur(0)).slice(1);   // la 1re est l'invite
  ok('valeurs du n° de ligne', nums.join('|') === '#1 — Atelier vélo|#2 — Vitrine|#3 — Atelier vélo|#4', nums.join('|'));

  // « Appliquer » sans valeur : refusé
  bouton('Appliquer').click();
  await Banc.attendre(50);
  ok('Appliquer sans valeur : fenêtre toujours ouverte', fenetre().open);
  ok('Appliquer sans valeur : rien d\'enregistré', !('criteres' in FAUX_GRIST.options));

  // Titre = Atelier vélo → deux lignes
  choisir(colonne(0), 'Titre');
  ok('changer de colonne : valeur remise à zéro', valeur(0).value === '');
  ok('valeurs du titre, sans doublon ni vide', libelles(valeur(0)).slice(1).join('|') === 'Atelier vélo|Vitrine',
    libelles(valeur(0)).join('|'));
  choisir(valeur(0), 'Atelier vélo');
  ok('deux lignes : alerte', resultat().includes('2 lignes correspondent'), resultat());
  ok('deux lignes : onglet ⚠️', $('.fenetre-onglet')?.dataset.etat === 'alerte');
  bouton('Appliquer').click();
  await Banc.attendre(50);
  ok('Appliquer avec deux lignes : refusé', fenetre().open && !('criteres' in FAUX_GRIST.options));

  // + Année = 2025 → une seule ligne
  $('#critere-ajouter').click();
  ok('deuxième critère ajouté, précédé de « et »', lignesCriteres().length === 2
    && lignesCriteres()[1].querySelector('.critere-et').textContent === 'et');
  choisir(colonne(1), 'Année');
  ok('valeurs de l\'année, rangées', libelles(valeur(1)).slice(1).join('|') === '2025|2026', libelles(valeur(1)).join('|'));
  choisir(valeur(1), '2025');
  ok('une ligne : résultat', resultat() === '✓ Une ligne : #1 — Atelier vélo', resultat());
  ok('une ligne : onglet ✓', $('.fenetre-onglet')?.dataset.etat === 'ok');

  // Référence : valeurs sous leur nom ; case à cocher : oui / non
  $('#critere-ajouter').click();
  choisir(colonne(2), 'Chef de projet');
  ok('référence : valeurs sous leur nom', libelles(valeur(2)).slice(1).join('|') === 'Personne A|Personne B',
    libelles(valeur(2)).join('|'));
  choisir(colonne(2), 'Archivé');
  ok('case à cocher : oui / non', libelles(valeur(2)).slice(1).join('|') === '✓ oui|✗ non', libelles(valeur(2)).join('|'));
  // ✕ retire le critère
  lignesCriteres()[2].querySelector('.critere-retirer').click();
  ok('✕ : critère retiré', lignesCriteres().length === 2);

  // Appliquer : enregistré, fenêtre fermée, page affichée
  bouton('Appliquer').click();
  await Banc.attendre(100);
  ok('Appliquer : fenêtre fermée', !fenetre().open);
  ok('Appliquer : critères enregistrés (valeurs brutes)',
    JSON.stringify(FAUX_GRIST.options.criteres) === JSON.stringify([{ col: 'Titre', valeur: 'Atelier vélo' }, { col: 'Annee', valeur: 2025 }]),
    JSON.stringify(FAUX_GRIST.options.criteres));
  ok('Appliquer : page de la ligne 1', $('.page')?.dataset.id === '1');
  ok('Appliquer : rappel « Enregistrer »', $('#toast').textContent.includes('Enregistrer'), $('#toast').textContent);

  // Grist rappelle onOptions après setOption, éventuellement avec une ancienne
  // valeur : le widget garde sa propre copie
  FAUX_GRIST.renvoyer();
  await Banc.attendre(100);
  ok('nouvel envoi de Grist : toujours la ligne 1', $('.page')?.dataset.id === '1');

  // Rouvrir : les critères enregistrés sont repris ; Annuler ne change rien
  $('#bouton-reglages').click();
  ok('rouvrir : deux critères repris', lignesCriteres().length === 2
    && valeur(0).selectedOptions[0]?.textContent === 'Atelier vélo'
    && valeur(1).selectedOptions[0]?.textContent === '2025');
  choisir(valeur(1), '2026');
  ok('modifié : résultat recalculé', resultat() === '✓ Une ligne : #3 — Atelier vélo', resultat());
  Banc.repondre(true);
  bouton('Annuler').click();
  await Banc.attendre(50);
  ok('Annuler : confirmation demandée', Banc.confirmations.length === 1);
  ok('Annuler : fenêtre fermée, critères inchangés', !fenetre().open
    && FAUX_GRIST.options.criteres[1].valeur === 2025 && $('.page')?.dataset.id === '1');

  // Critère sur une valeur qui n'existe plus : affichée, signalée
  $('#bouton-reglages').click();
  choisir(colonne(0), 'N° de ligne');
  choisir(valeur(0), '#4');
  lignesCriteres()[1].querySelector('.critere-retirer').click();
  bouton('Appliquer').click();
  await Banc.attendre(100);
  ok('n° de ligne : ligne 4 affichée', $('.page')?.dataset.id === '4');
  ok('ligne sans titre : « Sans titre »', $('.page-titre')?.textContent === 'Sans titre'
    && $('.page-titre').classList.contains('page-sans-titre'));
  FAUX_GRIST.masquees = [4];
  FAUX_GRIST.renvoyer();
  await Banc.attendre(100);
  ok('ligne masquée par la vue Grist : message', ($('.page-message')?.textContent || '').includes('Aucune ligne ne correspond'),
    $('.page-message')?.textContent);
  $('#bouton-reglages').click();
  ok('valeur introuvable : affichée et signalée', valeur(0).selectedOptions[0]?.textContent === '⚠️ #4 (introuvable)',
    valeur(0).selectedOptions[0]?.textContent);
  FENETRE.fermer({ forcer: true });
  FAUX_GRIST.masquees = [];
});
