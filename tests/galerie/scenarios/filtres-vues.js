// Filtres et vues enregistrées de la Galerie (#204), par les modules communs
// avec le Kanban (../_commun/filtres.js, ../_commun/vues.js) : colonnes
// filtrables, panneau d'un filtre (ordre et couleurs des choix, attributs
// d'une référence), cumul avec la recherche, vue perso et vue partagée,
// changement de vue, Annuler dans « Gérer la vue », options relues par Grist,
// carte créée puis masquée par les filtres, Échap.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $, $$ } = Banc;
  const cartes = () => Banc.cartes().join();
  const onglets = () => $$('#view-tabs .vue-enregistree').map(o => o.textContent.replace('⋯', '').trim());
  const dialogue = () => UI_VUES.fenetre.element;

  // ── Mise en place ──
  ok('toutes les colonnes demandées à Grist (includeColumns)', FAUX_GRIST.optionsRecords?.includeColumns === 'normal',
    JSON.stringify(FAUX_GRIST.optionsRecords));
  ok('barre : « Toutes les cartes », « ＋ Vue », « 🔽 Filtres »', onglets().join('|') === 'Toutes les cartes'
    && $('#view-tabs #vue-ajouter') && $('#resumes-vue').firstElementChild?.textContent === '🔽 Filtres', onglets().join('|'));
  const filtrables = ETAT.colonnesFiltrables.map(c => c.label).join('|');
  ok('colonnes filtrables : Choix et Références de la table, par libellé', filtrables === 'Priorité|Projet|Tâches', filtrables);
  ok('quatre cartes, sans filtre', cartes() === '1,2,3,4');

  // ── Un filtre, depuis « 🔽 Filtres » ──
  $('#filtres-bouton').click();
  ok('« 🔽 Filtres » ouvre « Gérer la vue »', dialogue().open);
  $('#filtre-ajouter').click();
  ok('nouveau filtre sur la première colonne (Priorité)', ETAT.filtres[0]?.col === 'Priorite', JSON.stringify(ETAT.filtres));
  const noms = () => $$('#filtre-valeurs .filtre-valeur-nom').map(n => n.textContent);
  ok('valeurs : (vide), puis les choix dans l\'ordre de Grist', noms().join('|') === '(vide)|Now|Later', noms().join('|'));
  ok('choix « Now » coloré comme dans Grist', $('#filtre-valeurs .filtre-valeur-pastille')?.style.background !== '');
  ok('pas d\'attribut pour une colonne Choix', $('#filtre-afficher').classList.contains('hidden'));

  // Changer la colonne du filtre : Projet (référence)
  const colonne = $('#filtre-colonne');
  colonne.value = 'Projet';
  colonne.dispatchEvent(new Event('change'));
  ok('Projet : « Afficher ▾ » proposé (colonne rapportée Projet › État)', !$('#filtre-afficher').classList.contains('hidden'));
  ok('Projet : « Vitrine » proposée avec 1 carte', $$('#filtre-valeurs .filtre-valeur')
    .some(v => v.textContent.includes('Vitrine') && v.querySelector('.filtre-valeur-nb').textContent === '1'));
  // Attribut « État » affiché : lu dans la colonne Projet_Etat, non associée au widget
  PANNEAU_FILTRES.definirAttributs('Projet', ['Projet_Etat']);
  const vitrine = $$('#filtre-valeurs .filtre-valeur').find(v => v.textContent.includes('Vitrine'));
  ok('attribut affiché à côté de la valeur (« Fermé »)', vitrine?.querySelector('.filtre-valeur-detail').textContent.includes('Fermé'),
    vitrine?.querySelector('.filtre-valeur-detail').textContent);
  ok('attribut retenu par le navigateur, sous la clé de la Galerie',
    (localStorage.getItem('galerie.attributs.doc-invente.EPICs') || '').includes('Projet_Etat'));
  vitrine.querySelector('input').click();
  await attendre(50);
  ok('Projet est Vitrine : la carte 3 seule', cartes() === '3', cartes());
  ok('compteur de la barre « 1 / 4 »', $('#compte').textContent === '1 / 4', $('#compte').textContent);
  ok('compteur de la fenêtre « 1 carte sur 4 »', $('#fv-compteur').textContent === '1 carte sur 4', $('#fv-compteur').textContent);
  ok('fenêtre marquée modifiée', dialogue().classList.contains('modifiee'));

  // ── 💾 depuis « Toutes les cartes » : nouvelle vue perso ──
  $('#fv-nom').value = 'Vitrine';
  UI_VUES.enregistrerFenetre();
  await attendre(50);
  const vueVitrine = VUES.toutes().find(v => v.nom === 'Vitrine');
  ok('vue perso créée et active', vueVitrine?.perso && VUES.activeId() === vueVitrine.id);
  ok('vue : son filtre et un tri vide', vueVitrine?.filtres[0]?.valeurs.join() === 'Vitrine' && vueVitrine.tri.length === 0,
    JSON.stringify(vueVitrine));
  ok('vue perso retenue par le navigateur', (localStorage.getItem('galerie.vuesPerso.doc-invente.EPICs') || '').includes('Vitrine'));
  ok('vue perso : rien d\'écrit dans le document', !FAUX_GRIST.options.vues);
  ok('onglets : « Toutes les cartes », « 🔒 Vitrine »', onglets().join('|') === 'Toutes les cartes|🔒 Vitrine', onglets().join('|'));
  ok('« 🔽 1 filtre »', $('#filtres-bouton').textContent === '🔽 1 filtre', $('#filtres-bouton').textContent);

  // ── Changer de vue ──
  $$('#view-tabs .vue-enregistree')[0].click();
  await attendre(50);
  ok('« Toutes les cartes » : quatre cartes, aucun filtre', cartes() === '1,2,3,4' && ETAT.filtres.length === 0);
  $$('#view-tabs .vue-enregistree')[1].click();
  await attendre(50);
  ok('retour sur « Vitrine » : ses filtres rechargés', cartes() === '3', cartes());
  ok('vue active retenue par le navigateur', localStorage.getItem('galerie.vueActive.doc-invente.EPICs') === vueVitrine.id);

  // ── « ＋ Vue » partagée, à partir de filtres réglés ──
  UI_VUES.afficher(Vues.DEFAUT);
  ETAT.filtres = [{ col: 'Priorite', op: 'nestpas', valeurs: [Filtres.VIDE] }];
  afficherGrille();
  ok('Priorité n\'est pas (vide) : cartes 1 et 2', cartes() === '1,2', cartes());
  $('#vue-ajouter').click();
  ok('panneau du nom : « Reprend les filtres affichés. »', $('#vue-nom-aide').textContent === 'Reprend les filtres affichés.',
    $('#vue-nom-aide').textContent);
  $('#vue-nom').value = 'Priorisées';
  $('#vue-nom-popover input[name="vue-portee"][value="partagee"]').checked = true;
  $('#vue-nom-valider').click();
  await attendre(50);
  const partagees = FAUX_GRIST.options.vues || [];
  ok('vue partagée écrite dans les options du widget', partagees.length === 1 && partagees[0].nom === 'Priorisées' && !partagees[0].perso,
    JSON.stringify(partagees));
  ok('vue partagée sans contexte (pas de projet)', partagees[0] && !('projet' in partagees[0]));
  ok('vue partagée active, ses cartes', VUES.active()?.nom === 'Priorisées' && cartes() === '1,2', cartes());
  ok('message : « Enregistrer » dans Grist', $('#toast').textContent.includes('Enregistrer'), $('#toast').textContent);

  // ── Filtres et recherche se cumulent ──
  const recherche = $('#recherche');
  recherche.value = 'documentation';
  recherche.dispatchEvent(new Event('input'));
  ok('filtre + recherche : la carte 1', cartes() === '1' && $('#compte').textContent === '1 / 4', cartes());
  recherche.value = 'archiver';
  recherche.dispatchEvent(new Event('input'));
  ok('aucune carte : message « filtres ou recherche »', ($('#grille .message')?.textContent || '').includes('aux filtres ou à la recherche'));
  recherche.value = '';
  recherche.dispatchEvent(new Event('input'));

  // ── Gérer la vue : retirer le filtre puis Annuler ──
  UI_VUES.ouvrirFenetre('filtres');
  $('#filtres-actifs .filtre-chip-x').click();
  await attendre(50);
  ok('filtre retiré : quatre cartes derrière la fenêtre', cartes() === '1,2,3,4', cartes());
  UI_VUES.fenetre.fermer({ forcer: true });
  await attendre(50);
  ok('Annuler : le filtre de la vue revient', ETAT.filtres.length === 1 && cartes() === '1,2', cartes());

  // ── Grist rappelle onOptions (après un setOption) : rien n'est relu ──
  FAUX_GRIST.renvoyerOptions({ modele: 'nouveau modèle' });
  await attendre(50);
  ok('onOptions rappelé : même vue, mêmes filtres', VUES.active()?.nom === 'Priorisées' && cartes() === '1,2', cartes());
  ok('… mais le modèle est bien relu', ETAT.modele === 'nouveau modèle');

  // ── Nouvelle carte masquée par les filtres de la vue ──
  $('#btn-nouvelle').click();
  await attendre(100);
  const titre = $('#fiche-corps .fiche-titre');
  titre.value = 'Carte sans priorité';
  titre.dispatchEvent(new Event('input'));
  $('#fiche-sauver').click();
  await attendre(600);
  ok('carte créée, masquée par le filtre : message', $('#toast').textContent.includes('masquée par les filtres de la vue'),
    $('#toast').textContent);
  ok('… la fiche reste ouverte sur elle', $('#fiche').classList.contains('open') && $('#fiche-corps .fiche-titre').value === 'Carte sans priorité');
  ok('… et la grille ne la montre pas', !Banc.cartes().includes(100), cartes());

  // ── Échap : ferme d'abord un panneau, puis la fiche ──
  $('#vue-ajouter').click();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  ok('Échap : panneau du nom fermé, fiche toujours ouverte',
    $('#vue-nom-popover').classList.contains('hidden') && $('#fiche').classList.contains('open'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  ok('Échap encore : fiche fermée', !$('#fiche').classList.contains('open'));
});
