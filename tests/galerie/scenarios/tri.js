// Tri des cartes de la Galerie (#232), par le panneau commun avec le Kanban
// (../_commun/tri.js) : ordre de Grist sans tri, bouton « ⇅ Trier », onglet
// Tri de « Gérer la vue », colonnes proposées, critère ajouté, sens, second
// critère, changement de colonne, ✕, vides et cellule en erreur en bas, tri
// enregistré dans la vue, Annuler, cumul avec un filtre, colonne absente,
// tri mal formé nettoyé, limite de critères, « Retirer le tri ».
//
// Cartes du faux Grist (ordre envoyé par Grist : 1, 2, 3, 4) :
//   1 « Écrire la documentation »   Priorité Now,   Avancement 0,67, Projet Atelier
//   2 « Préparer la démonstration » Priorité Later, Avancement 1,    Projet Atelier
//   3 « Archiver le site »          Priorité vide,  Avancement 0,1,  Projet Vitrine
//   4 « Carte en erreur »           Priorité vide,  Avancement 0,    Projet en erreur
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $, $$ } = Banc;
  const cartes = () => Banc.cartes().join();
  const dialogue = () => UI_VUES.fenetre.element;
  const lignes = () => $$('#tri-criteres .tri-critere');
  // Bouton de sens n° j (0 : croissant, 1 : décroissant) du critère n° i
  const sens = (i, j) => lignes()[i].querySelectorAll('.filtre-op')[j];
  const choisirColonne = (i, colId) => {
    const choix = lignes()[i].querySelector('select');
    choix.value = colId;
    choix.dispatchEvent(new Event('change'));
  };

  // ── Sans tri : l'ordre de Grist ──
  ok('sans tri : ordre envoyé par Grist', cartes() === '1,2,3,4', cartes());
  ok('barre : « ⇅ Trier » après « 🔽 Filtres »',
    [...$('#resumes-vue').children].map(b => b.textContent).join('|') === '🔽 Filtres|⇅ Trier|▤ Regrouper');
  ok('bulle : ordre de Grist par défaut', $('#tri-bouton').title === 'Trier les cartes (par défaut : ordre de Grist)', $('#tri-bouton').title);

  // ── « ⇅ Trier » ouvre « Gérer la vue » sur l'onglet Tri ──
  $('#tri-bouton').click();
  await attendre(50);
  ok('« ⇅ Trier » ouvre « Gérer la vue »', dialogue().open);
  const libelles = $$('.fenetre-onglet-libelle').map(l => l.textContent);
  ok('onglets Vue, Filtres, Tri, Regrouper', libelles.join('|') === 'Vue|Filtres|Tri|Regrouper', libelles.join('|'));
  ok('onglet Tri affiché', $('#tri-criteres').offsetParent !== null);
  ok('message : aucun tri, ordre de Grist', ($('#tri-criteres .filtre-aucune')?.textContent || '').includes('ordre de Grist'));
  ok('« Retirer le tri » grisé sans tri', $('#tri-retirer-tout').disabled);

  // ── Un critère : la première colonne de pastilles (Priorité) ──
  $('#tri-ajouter').click();
  ok('critère ajouté sur Priorité (1re pastille), croissant',
    JSON.stringify(ETAT.tri) === '[{"col":"Priorite","sens":"asc"}]', JSON.stringify(ETAT.tri));
  const options = [...lignes()[0].querySelectorAll('option')].map(o => o.textContent);
  ok('colonnes proposées : « # Numéro » en tête', options[0] === '# Numéro', options.join('|'));
  ok('toutes les colonnes de la table, par libellé', ['Titre', 'Échéance', 'Avancement', 'Projet'].every(l => options.includes(l)),
    options.join('|'));
  ok('colonne interne absente (manualSort)', !options.includes('manualSort'));
  ok('« Par » devant le premier critère', lignes()[0].querySelector('.tri-rang').textContent === 'Par');
  ok('sens d\'une colonne Choix : ordre de Grist / inverse',
    sens(0, 0).textContent === '↑ Ordre Grist' && sens(0, 1).textContent === '↓ Inverse');
  ok('Priorité croissante : Now, Later, puis les vides dans l\'ordre de Grist', cartes() === '1,2,3,4', cartes());
  ok('fenêtre marquée modifiée', dialogue().classList.contains('modifiee'));

  sens(0, 1).click();
  ok('Priorité décroissante : Later, Now, vides toujours en bas', cartes() === '2,1,3,4', cartes());
  ok('bouton : « ⇅ Priorité ↓ »', $('#tri-bouton').textContent === '⇅ Priorité ↓', $('#tri-bouton').textContent);

  // ── Un second critère départage les égalités ──
  $('#tri-ajouter').click();
  ok('2e critère : la pastille suivante (Avancement)', ETAT.tri[1]?.col === 'Avancement', JSON.stringify(ETAT.tri));
  ok('« puis » devant le second critère', lignes()[1].querySelector('.tri-rang').textContent === 'puis');
  ok('à égalité de priorité (vides), Avancement croissant : 4 (0 %) avant 3 (10 %)', cartes() === '2,1,4,3', cartes());
  ok('bouton : « ⇅ Priorité ↓ +1 »', $('#tri-bouton').textContent === '⇅ Priorité ↓ +1', $('#tri-bouton').textContent);

  // ── Changer la colonne du premier critère ──
  choisirColonne(0, 'Titre');
  ok('premier critère sur Titre, sens gardé', ETAT.tri[0].col === 'Titre' && ETAT.tri[0].sens === 'desc', JSON.stringify(ETAT.tri));
  ok('sens d\'une colonne Texte : A → Z / Z → A', sens(0, 0).textContent === '↑ A → Z');
  sens(0, 0).click();
  ok('Titre de A à Z, accents ignorés (« Écrire » après « Carte »)', cartes() === '3,4,1,2', cartes());

  // ── ✕ retire un critère ──
  lignes()[0].querySelector('.tri-retirer').click();
  ok('✕ : reste Avancement', JSON.stringify(ETAT.tri) === '[{"col":"Avancement","sens":"asc"}]', JSON.stringify(ETAT.tri));
  ok('Avancement croissant (colonne calculée sans type)', cartes() === '4,3,1,2', cartes());

  // ── Référence : de A à Z sur le nom, cellule en erreur en bas ──
  choisirColonne(0, 'Projet');
  sens(0, 1).click();
  ok('Projet décroissant : Vitrine, Atelier, la cellule en erreur en bas', cartes() === '3,1,2,4', cartes());

  // ── 💾 : le tri est enregistré dans la vue ──
  $('#fv-nom').value = 'Par projet';
  UI_VUES.enregistrerFenetre();
  await attendre(50);
  const vue = VUES.toutes().find(v => v.nom === 'Par projet');
  ok('tri enregistré dans la vue', vue && JSON.stringify(vue.tri) === '[{"col":"Projet","sens":"desc"}]', JSON.stringify(vue?.tri));
  UI_VUES.afficher(Vues.DEFAUT);
  await attendre(50);
  ok('« Toutes les cartes » : pas de tri, ordre de Grist', ETAT.tri.length === 0 && cartes() === '1,2,3,4', cartes());
  ok('bouton revenu à « ⇅ Trier »', $('#tri-bouton').textContent === '⇅ Trier', $('#tri-bouton').textContent);
  UI_VUES.afficher(vue.id);
  await attendre(50);
  ok('retour sur la vue : son tri rechargé', cartes() === '3,1,2,4', cartes());

  // ── Annuler restaure le tri de la vue ──
  UI_VUES.ouvrirFenetre('tri');
  $('#tri-retirer-tout').click();
  ok('« Retirer le tri » : ordre de Grist derrière la fenêtre', ETAT.tri.length === 0 && cartes() === '1,2,3,4', cartes());
  ok('« Retirer le tri » grisé une fois le tri retiré', $('#tri-retirer-tout').disabled);
  UI_VUES.fenetre.fermer({ forcer: true });
  await attendre(50);
  ok('Annuler : le tri de la vue revient', JSON.stringify(ETAT.tri) === '[{"col":"Projet","sens":"desc"}]' && cartes() === '3,1,2,4',
    cartes());
  ok('la vue elle-même est intacte', JSON.stringify(vue.tri) === '[{"col":"Projet","sens":"desc"}]', JSON.stringify(vue.tri));

  // ── Tri et filtre se cumulent ──
  ETAT.filtres = [{ col: 'Projet', op: 'est', valeurs: ['Atelier'] }];
  ETAT.tri = [{ col: 'Titre', sens: 'desc' }];
  afficherGrille();
  ok('Projet est Atelier, Titre de Z à A : 2 puis 1', cartes() === '2,1', cartes());

  // ── Vue venue du document : colonne disparue, tri mal formé ──
  const ancienne = VUES.construire('Ancienne', true, { filtres: [],
    tri: [{ col: 'Disparue', sens: 'desc' }, { sens: 'asc' }, { col: 'Titre', sens: 'bizarre' }] });
  VUES.ajouter(ancienne);
  UI_VUES.afficher(ancienne.id);
  await attendre(50);
  ok('tri nettoyé : critère sans colonne écarté, sens inconnu → croissant',
    JSON.stringify(ETAT.tri) === '[{"col":"Disparue","sens":"desc"},{"col":"Titre","sens":"asc"}]', JSON.stringify(ETAT.tri));
  ok('colonne disparue : sans effet, Titre départage', cartes() === '3,4,1,2', cartes());
  UI_VUES.ouvrirFenetre('tri');
  const absente = [...lignes()[0].querySelectorAll('option')].find(o => o.value === 'Disparue');
  ok('colonne disparue signalée « (absente) »', absente?.textContent === 'Disparue (absente)', absente?.textContent);

  // ── Limite de critères ──
  ETAT.tri = Array.from({ length: Tri.CRITERES_MAX }, () => ({ col: 'Titre', sens: 'asc' }));
  PANNEAU_TRI.remplir();
  ok(`« ＋ Ajouter un critère » grisé à ${Tri.CRITERES_MAX} critères`, $('#tri-ajouter').disabled);
  UI_VUES.fenetre.fermer({ forcer: true });
  await attendre(50);

  // ── Échap ferme encore la fiche (le panneau du tri, posé dans la fenêtre, ne compte pas) ──
  ouvrirFiche(1);
  await attendre(50);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await attendre(50);
  ok('Échap : fiche fermée', !panneau().classList.contains('open'));
});
