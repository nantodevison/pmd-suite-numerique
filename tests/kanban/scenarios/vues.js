// Vues enregistrées (#196, #202, #214) : créer, changer, annuler, vue perso, colonnes, supprimer.
Banc.lancer(async () => {
  const { ok, attendre, $ } = Banc;
  const choisirPortee = (valeur) => { $(`input[name="fv-portee-choix"][value="${valeur}"]`).checked = true; };
  const aFaire = '🖐️ À faire', enCours = '♻️ En cours';

  await Banc.demarrer();

  // ── Vue par défaut ──
  ok('vue active au départ : « Toutes les cartes »', STATE.activeView === DEFAUT);
  ok('les 4 cartes du projet sont affichées', Banc.cartes().length === 4, Banc.cartes().join(','));

  // ── Créer une vue partagée depuis « Toutes les cartes » ──
  ouvrirFenetreVue('filtres');
  STATE.filters.push({ col: 'statut', op: 'est', valeurs: [aFaire] });
  renderBoard();
  await attendre(50);
  ok('le tableau suit le filtre, fenêtre ouverte', Banc.cartes().join(',') === '1,4', Banc.cartes().join(','));
  ok('compteur de la fenêtre « 2 cartes sur 4 »', $('#fv-compteur').textContent === '2 cartes sur 4', $('#fv-compteur').textContent);
  $('#fv-nom').value = 'À faire';
  choisirPortee('partagee');
  enregistrerFenetreVue();
  await attendre(100);
  const partagee = STATE.vues.find(v => v.nom === 'À faire');
  ok('vue partagée créée et active', partagee && STATE.activeView === partagee.id);
  ok('fenêtre fermée après 💾', !$('dialog[open]'));
  ok('vue partagée écrite dans les options du widget (avec son projet)',
    (FAUX_GRIST.options.vues || []).some(v => v.nom === 'À faire' && v.projet === 15 && v.filtres[0].valeurs[0] === aFaire),
    JSON.stringify(FAUX_GRIST.options.vues));
  ok('onglet de la vue affiché', [...document.querySelectorAll('.vue-enregistree')].some(o => o.textContent.includes('À faire')));

  // ── Changer de vue ──
  switchView(DEFAUT);
  ok('retour à « Toutes les cartes » : 4 cartes, aucun filtre', Banc.cartes().length === 4 && STATE.filters.length === 0);
  switchView(partagee.id);
  ok('retour à la vue : ses filtres reviennent', Banc.cartes().join(',') === '1,4', Banc.cartes().join(','));

  // ── Annuler ne change rien ──
  ouvrirFenetreVue('filtres');
  STATE.filters = [];
  renderBoard();
  ok('filtre retiré dans la fenêtre : 4 cartes derrière', Banc.cartes().length === 4);
  ok('fenêtre marquée « Non enregistré »', $('dialog[open]').classList.contains('modifiee'));
  fenetreVue.fermer({ forcer: true }); // comme « Annuler » confirmé
  await attendre(50);
  ok('Annuler restaure les filtres de la vue', Banc.cartes().join(',') === '1,4' && partagee.filtres.length === 1);

  // ── Vue personnelle ──
  switchView(DEFAUT);
  const vuesAvant = JSON.stringify(FAUX_GRIST.options.vues);
  ouvrirFenetreVue('filtres');
  STATE.filters.push({ col: 'statut', op: 'est', valeurs: [enCours] });
  $('#fv-nom').value = 'Perso';
  choisirPortee('perso');
  enregistrerFenetreVue();
  await attendre(100);
  const perso = STATE.vues.find(v => v.nom === 'Perso');
  ok('vue perso créée et active', perso && perso.perso && STATE.activeView === perso.id);
  ok('vue perso NON écrite dans le document', JSON.stringify(FAUX_GRIST.options.vues) === vuesAvant);
  const memoire = Object.keys(localStorage).filter(k => k.startsWith('kanban.vuesPerso.')).map(k => localStorage.getItem(k)).join('');
  ok('vue perso retenue par le navigateur', memoire.includes('"Perso"'), memoire.slice(0, 80));
  const active = Object.keys(localStorage).filter(k => k.startsWith('kanban.vueActive.')).map(k => localStorage.getItem(k));
  ok('onglet actif retenu par le navigateur', active.includes(perso.id), active.join(','));
  ok('vue perso : seule la carte En cours', Banc.cartes().join(',') === '2', Banc.cartes().join(','));

  // ── Colonnes de la vue ──
  perso.colonnes = [enCours];
  renderBoard();
  const colonnes = [...document.querySelectorAll('.column')].map(c => c.dataset.statut);
  ok('colonnes de la vue : seule « En cours » est affichée', colonnes.join(',') === enCours, colonnes.join(' | '));
  perso.colonnes = null;
  renderBoard();
  const statutsAffiches = [...document.querySelectorAll('.column')].map(c => c.dataset.statut).join(',');
  ok('sans liste de colonnes : les statuts des cartes affichées', statutsAffiches === enCours && vueCourante().preferredOrder.length === 0, statutsAffiches);

  // ── Supprimer la vue perso ──
  supprimerVue();
  ok('vue perso supprimée, retour à « Toutes les cartes »', !STATE.vues.includes(perso) && STATE.activeView === DEFAUT);
  const memoireApres = Object.keys(localStorage).filter(k => k.startsWith('kanban.vuesPerso.')).map(k => localStorage.getItem(k)).join('');
  ok('vue perso retirée de la mémoire du navigateur', !memoireApres.includes('"Perso"'));
  ok('vue partagée toujours là', STATE.vues.includes(partagee));
});
