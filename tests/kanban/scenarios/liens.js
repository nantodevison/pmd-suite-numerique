// Liens « Bloque / Bloquée par » (#183, #222) : badges, bande de la fiche,
// avertissements, création d'une carte liée, suppression.
// Faux Grist : #1 « Rédiger le guide » (À faire) bloque #2 « Carte statique » (En cours).
Banc.lancer(async () => {
  const { ok, attendre, $$ } = Banc;
  const carte = (id) => document.querySelector(`.card[data-id="${id}"]`);
  const fait = '✅ Fait';

  await Banc.demarrer();
  await attendre(300); // les liens sont relus après les cartes

  // ── Badges du tableau ──
  ok('#2 porte « ⛔ 1 » (bloquée par #1)', carte(2)?.querySelector('.liens-badge.liens-bloqueur')?.textContent === '⛔ 1',
    carte(2)?.querySelector('.liens-badge')?.textContent);
  ok('#1 porte « ➡️ 1 » (bloque #2)', carte(1)?.querySelector('.liens-badge.liens-bloquee')?.textContent === '➡️ 1');
  ok('#3 et #4 sans badge', !carte(3)?.querySelector('.liens-badge') && !carte(4)?.querySelector('.liens-badge'));
  ok('bulle du badge : nom de la carte bloquante', /#1 Rédiger le guide/.test(carte(2).querySelector('.liens-badge').title));

  // ── Bande de la fiche ──
  await openEditPanel(2);
  await attendre(200);
  const fiche = document.getElementById('edit-panel');
  ok('fiche #2 : la bande montre #1 « Rédiger le guide »', /#1/.test(fiche.textContent) && /Rédiger le guide/.test(fiche.textContent));

  // ── Avertissement : terminer une carte encore bloquée ──
  changerDepuisMenu('statut', fait);
  Banc.repondre(false);
  let avant = FAUX_GRIST.actions.length;
  await saveEditPanel();
  const message = Banc.confirmations.at(-1) || '';
  ok('passer #2 en Fait demande confirmation', /bloquée par/.test(message) && /#1/.test(message), message.replace(/\n/g, ' ').slice(0, 120));
  ok('« Annuler » : rien n\'est écrit', !Banc.actionsDepuis(avant).length);
  ok('« Annuler » : la fiche garde la modification', STATE.editPanel.dirty);
  Banc.repondre(true);
  avant = FAUX_GRIST.actions.length;
  await saveEditPanel();
  const maj = Banc.actionsDepuis(avant).find(a => a[0] === 'UpdateRecord');
  ok('« OK » : statut écrit', maj && maj[2] === 2 && maj[3].statut === fait, JSON.stringify(maj));
  closeEditPanel(true);

  // ── Sans lien : aucun avertissement ──
  const nbConfirmations = Banc.confirmations.length;
  ok('déplacer #4 (sans lien) : aucun avertissement', avertirEnchainement(4, { statut: fait }) === '' && Banc.confirmations.length === nbConfirmations);

  // ── Créer une carte liée depuis la fiche de #1 (#222) ──
  await openEditPanel(1);
  await attendre(200);
  avant = FAUX_GRIST.actions.length;
  const creee = await creerCarteLiee('Préparer les supports', 'bloque');
  const ajout = Banc.actionsDepuis(avant).find(a => a[0] === 'AddRecord');
  const champs = ajout ? ajout[3] : {};
  ok('carte liée : créée avec un numéro', creee && creee.id >= 100, JSON.stringify(creee));
  ok('carte liée : « Bloquée par » #1', JSON.stringify(champs.Bloquee_par) === '["L",1]', JSON.stringify(champs));
  ok('carte liée : statut « À faire », projet et EPIC de #1',
    champs.statut === '🖐️ À faire' && champs.Projet === 15 && champs.EPIC === 1, JSON.stringify(champs));
  closeEditPanel(true);

  // ── Suppression d'une carte liée : ses liens sont annoncés ──
  Banc.repondre(false);
  avant = FAUX_GRIST.actions.length;
  await deleteCard(1, 'Rédiger le guide');
  const question = Banc.confirmations.at(-1) || '';
  ok('supprimer #1 : la confirmation cite le lien vers #2', /#2/.test(question) && /liens seront retirés/.test(question), question.replace(/\n/g, ' '));
  ok('supprimer refusé : rien n\'est écrit', !Banc.actionsDepuis(avant).length);
});
