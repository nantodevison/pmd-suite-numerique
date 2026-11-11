// Fiche et cartes : numéro #id (#203), couleurs des statuts (#212),
// cases à cocher de l'aperçu (#208), enregistrement de la fiche.
Banc.lancer(async () => {
  const { ok, attendre } = Banc;
  const enCours = '♻️ En cours';
  const rose = 'rgb(252, 231, 243)'; // PASTEL_PALETTE[2].bg (#fce7f3)

  // Couleur n° 2 de la palette choisie dans ⚙ pour « En cours »
  await Banc.demarrer({ couleursStatut: { [enCours]: 2 } });

  // ── Numéro et couleurs ──
  const carte2 = document.querySelector('.card[data-id="2"]');
  ok('numéro « #2 » affiché sur la carte', /#2\b/.test(carte2?.textContent || ''));
  const colonne = document.querySelector(`.column[data-statut="${enCours}"]`);
  ok('couleur choisie dans ⚙ appliquée à la colonne', getComputedStyle(colonne).backgroundColor === rose, getComputedStyle(colonne).backgroundColor);

  // ── Cases à cocher de l'aperçu (#1 : « - [ ] Plan / - [x] Sommaire ») ──
  await openEditPanel(1);
  await attendre(200);
  const cases = [...document.querySelectorAll('#edit-panel .fiche-md-rendu input[type="checkbox"]')];
  ok('deux cases dans l\'aperçu, cliquables', cases.length === 2 && cases.every(c => !c.disabled), `${cases.length} case(s)`);
  ok('état lu dans le texte : vide puis cochée', cases[0] && !cases[0].checked && cases[1].checked);
  cases[0].click();
  await attendre(50);
  ok('cocher la 1re case modifie le texte', STATE.editPanel.fields.description === '- [x] Plan\n- [x] Sommaire',
    JSON.stringify(STATE.editPanel.fields.description));
  ok('la fiche est marquée modifiée', STATE.editPanel.dirty);
  const avant = FAUX_GRIST.actions.length;
  await saveEditPanel();
  const maj = Banc.actionsDepuis(avant).find(a => a[0] === 'UpdateRecord');
  ok('« Sauvegarder » écrit la description', maj && maj[2] === 1 && maj[3].Description === '- [x] Plan\n- [x] Sommaire', JSON.stringify(maj));
  ok('après sauvegarde : plus de modification en attente', !STATE.editPanel.dirty);

  // ── Fermer sans sauvegarder demande confirmation ──
  changerDepuisMenu('priorite', 'Basse');
  Banc.repondre(false);
  closeEditPanel();
  ok('fermer une fiche modifiée demande confirmation', /non sauvegardées/.test(Banc.confirmations.at(-1) || ''));
  ok('« Annuler » : la fiche reste ouverte', STATE.editPanel.recordId === 1);
  closeEditPanel(true);
  ok('fermeture forcée', STATE.editPanel.recordId === null);
});
