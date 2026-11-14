// Regroupement des cartes de la Galerie en zones repliables (#233) :
// bouton « ▤ Regrouper », onglet Regrouper de « Gérer la vue », colonnes
// proposées, zones par Choix (ordre de Grist), Référence (A → Z, cellule en
// erreur à la fin), Liste de références (une carte dans plusieurs zones),
// Case à cocher, tri et filtre dans les zones, repli retenu par le
// navigateur et propre à chaque vue, regroupement enregistré dans une
// nouvelle vue et dans une vue existante (💾), Annuler, colonne disparue,
// valeur mal formée, Échap.
//
// Cartes du faux Grist (ordre envoyé par Grist : 1, 2, 3, 4) :
//   1 « Écrire la documentation »   Now,   Atelier,  Tâches : Rédiger, Relire le guide, Urgent oui
//   2 « Préparer la démonstration » Later, Atelier,  aucune tâche,                     Urgent non
//   3 « Archiver le site »          vide,  Vitrine,  Tâches : Copier les pages,         Urgent oui
//   4 « Carte en erreur »           vide,  Projet en erreur, aucune tâche,              Urgent non
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $, $$ } = Banc;
  const dialogue = () => UI_VUES.fenetre.element;
  // Zones affichées : « valeur:cartes » (« Atelier:1,2|Vitrine:3 »)
  const zones = () => $$('#grille .groupe').map(z =>
    `${z.dataset.valeur}:${[...z.querySelectorAll('.carte')].map(c => c.dataset.id).join(',')}`).join('|');
  const zone = (valeur) => $$('#grille .groupe').find(z => z.dataset.valeur === valeur);
  const choisir = (colId) => {
    const liste = $('#groupe-colonne');
    liste.value = colId;
    liste.dispatchEvent(new Event('change'));
  };

  // ── Sans regroupement ──
  ok('au départ : aucune zone, cartes dans l\'ordre de Grist', $$('#grille .groupe').length === 0 && Banc.cartes().join() === '1,2,3,4');
  ok('bouton « ▤ Regrouper » dans la barre', $('#groupe-bouton')?.textContent === '▤ Regrouper');

  // ── « ▤ Regrouper » ouvre l'onglet Regrouper ──
  $('#groupe-bouton').click();
  await attendre(50);
  ok('« ▤ Regrouper » ouvre « Gérer la vue »', dialogue().open);
  ok('onglet Regrouper affiché', $('#groupe-colonne').offsetParent !== null);
  const options = [...$('#groupe-colonne').options].map(o => o.textContent).join('|');
  ok('colonnes proposées : Choix, Références, Case à cocher, par libellé',
    options === 'Aucun regroupement|Priorité|Projet|Tâches|Thèmes|Urgent|Version', options);
  ok('« Aucun regroupement » choisi au départ', $('#groupe-colonne').value === '');

  // ── Par référence ──
  choisir('Projet');
  ok('Projet : Atelier, Vitrine, puis la cellule en erreur', zones() === 'Atelier:1,2|Vitrine:3|⚠️ invalide:4', zones());
  ok('en-tête : nombre de cartes', zone('Atelier')?.querySelector('.groupe-nombre').textContent === '2');
  ok('en-tête : pastille à la couleur de la valeur', zone('Atelier')?.querySelector('.groupe-nom').style.background !== '');
  ok('en-tête : cellule en erreur en rouge', zone('⚠️ invalide')?.querySelector('.groupe-nom').classList.contains('pastille-erreur'));
  ok('fenêtre marquée modifiée', dialogue().classList.contains('modifiee'));
  ok('bouton : « ▤ Projet »', $('#groupe-bouton').textContent === '▤ Projet', $('#groupe-bouton').textContent);
  ok('compteur inchangé (4 cartes)', $('#compte').textContent === '4', $('#compte').textContent);

  // ── Par choix : ordre de Grist, (vide) à la fin ──
  choisir('Priorite');
  ok('Priorité : Now, Later, puis (vide)', zones() === 'Now:1|Later:2|(vide):3,4', zones());
  ok('choix « Now » coloré comme dans Grist', zone('Now')?.querySelector('.groupe-nom').style.background === 'rgb(254, 202, 202)',
    zone('Now')?.querySelector('.groupe-nom').style.background);

  // ── Par liste de références : une carte dans plusieurs zones ──
  choisir('Taches');
  ok('Tâches : la carte 1 dans deux zones, (vide) à la fin',
    zones() === 'Copier les pages:3|Rédiger le guide:1|Relire le guide:1|(vide):2,4', zones());

  // ── Par case à cocher ──
  choisir('Urgent');
  ok('Urgent : « ✓ oui » puis « ✗ non »', zones() === '✓ oui:1,3|✗ non:2,4', zones());

  // ── Tri dans chaque zone, filtre avant les zones ──
  choisir('Projet');
  ETAT.tri = [{ col: 'Titre', sens: 'desc' }];
  afficherGrille();
  ok('tri Titre Z → A dans chaque zone', zones() === 'Atelier:2,1|Vitrine:3|⚠️ invalide:4', zones());
  ETAT.filtres = [{ col: 'Priorite', op: 'nestpas', valeurs: [Filtres.VIDE] }];
  afficherGrille();
  ok('filtre « Priorité n\'est pas (vide) » : la zone Atelier seule', zones() === 'Atelier:2,1', zones());
  ETAT.filtres = [];
  ETAT.tri = [];

  // ── 💾 depuis « Toutes les cartes » : nouvelle vue regroupée ──
  $('#fv-nom').value = 'Par projet';
  UI_VUES.enregistrerFenetre();
  await attendre(50);
  const vue = VUES.toutes().find(v => v.nom === 'Par projet');
  ok('nouvelle vue : regroupement « Projet » enregistré', vue?.regroupement === 'Projet' && VUES.activeId() === vue.id,
    JSON.stringify(vue));
  ok('vue active regroupée', zones() === 'Atelier:1,2|Vitrine:3|⚠️ invalide:4', zones());

  // ── Replier une zone ──
  const vuesAvant = localStorage.getItem('galerie.vuesPerso.doc-invente.EPICs');
  zone('Atelier').querySelector('.groupe-entete').click();
  ok('clic sur l\'en-tête : zone repliée', zone('Atelier').classList.contains('repliee')
    && zone('Atelier').querySelector('.groupe-cartes').hidden, zones());
  ok('flèche ▸ et aria-expanded', zone('Atelier').querySelector('.groupe-fleche').textContent === '▸'
    && zone('Atelier').querySelector('.groupe-entete').getAttribute('aria-expanded') === 'false');
  ok('zone repliée : en-tête et nombre toujours visibles', zone('Atelier').querySelector('.groupe-nombre').textContent === '2');
  ok('repli retenu par le navigateur, sous la clé de la Galerie',
    (localStorage.getItem('galerie.groupesReplies.doc-invente.EPICs') || '').includes(`${vue.id}|Projet`),
    localStorage.getItem('galerie.groupesReplies.doc-invente.EPICs'));
  ok('replier ne modifie pas la vue (vues perso mémorisées inchangées)',
    localStorage.getItem('galerie.vuesPerso.doc-invente.EPICs') === vuesAvant && vue.regroupement === 'Projet');
  afficherGrille();
  ok('toujours repliée après un nouveau dessin (données reçues de Grist…)', zone('Atelier').classList.contains('repliee'));

  // ── Changer de vue ──
  UI_VUES.afficher(Vues.DEFAUT);
  await attendre(50);
  ok('« Toutes les cartes » : pas de zone', $$('#grille .groupe').length === 0 && ETAT.groupe === null);
  ok('bouton revenu à « ▤ Regrouper »', $('#groupe-bouton').textContent === '▤ Regrouper');
  UI_VUES.afficher(vue.id);
  await attendre(50);
  ok('retour sur la vue : zones et repli retrouvés', zone('Atelier')?.classList.contains('repliee') && !zone('Vitrine').classList.contains('repliee'));
  zone('Atelier').querySelector('.groupe-entete').click();
  ok('second clic : zone dépliée', !zone('Atelier').classList.contains('repliee') && !zone('Atelier').querySelector('.groupe-cartes').hidden);

  // ── 💾 sur une vue existante ──
  UI_VUES.ouvrirFenetre('groupes');
  ok('liste sur la colonne de la vue', $('#groupe-colonne').value === 'Projet');
  choisir('Priorite');
  UI_VUES.enregistrerFenetre();
  await attendre(50);
  ok('💾 : regroupement écrit dans la vue existante', vue.regroupement === 'Priorite', JSON.stringify(vue));
  ok('vue perso retenue avec son regroupement', (localStorage.getItem('galerie.vuesPerso.doc-invente.EPICs') || '').includes('"regroupement":"Priorite"'));

  // ── Annuler rétablit le regroupement ──
  UI_VUES.ouvrirFenetre('groupes');
  choisir('');
  ok('« Aucun regroupement » : plus de zone derrière la fenêtre', $$('#grille .groupe').length === 0);
  ok('fenêtre marquée modifiée', dialogue().classList.contains('modifiee'));
  UI_VUES.fenetre.fermer({ forcer: true });
  await attendre(50);
  ok('Annuler : le regroupement de la vue revient', ETAT.groupe === 'Priorite' && zones() === 'Now:1|Later:2|(vide):3,4', zones());

  // ── Vue venue du document : colonne disparue, valeur mal formée ──
  const disparue = VUES.construire('Disparue', true, { filtres: [], tri: [], regroupement: 'Disparue' });
  VUES.ajouter(disparue);
  UI_VUES.afficher(disparue.id);
  await attendre(50);
  ok('colonne disparue : toutes les cartes sous « (vide) »', zones() === '(vide):1,2,3,4', zones());
  UI_VUES.ouvrirFenetre('groupes');
  const absente = [...$('#groupe-colonne').options].find(o => o.value === 'Disparue');
  ok('colonne disparue signalée « (absente) »', absente?.textContent === 'Disparue (absente)', absente?.textContent);
  UI_VUES.fenetre.fermer({ forcer: true });
  await attendre(50);
  const bizarre = VUES.construire('Bizarre', true, { filtres: [], tri: [], regroupement: 42 });
  VUES.ajouter(bizarre);
  UI_VUES.afficher(bizarre.id);
  await attendre(50);
  ok('regroupement mal formé : ignoré', ETAT.groupe === null && $$('#grille .groupe').length === 0);

  // ── Échap ferme encore la fiche ──
  UI_VUES.afficher(vue.id);
  await attendre(50);
  ouvrirFiche(1);
  await attendre(50);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await attendre(50);
  ok('Échap : fiche fermée', !panneau().classList.contains('open'));
});
