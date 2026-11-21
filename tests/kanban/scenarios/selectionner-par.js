// « Sélectionner par » et projet de ⚙ (#248) : c'est le projet de ⚙ qui
// commande. Avis au-dessus du tableau quand Grist n'envoie AUCUNE carte de ce
// projet (liaison sur un autre projet), jamais dans le cas normal où Grist
// envoie aussi les cartes d'autres projets. Ligne du mode d'emploi.
Banc.lancer(async () => {
  const { ok, attendre } = Banc;
  const avis = () => document.getElementById('avis-projet');
  // Change le projet des cartes envoyées, puis les renvoie comme le ferait
  // Grist après un changement de sélection. `projets` : un nom par carte.
  const envoyer = async (projets) => {
    FAUX_GRIST.records.forEach((r, i) => { r.Projet = projets[i]; });
    FAUX_GRIST.demarrer();
    await attendre(400);
  };
  const tousKanban = FAUX_GRIST.records.map(() => 'Kanban');

  await Banc.demarrer();

  // ── Cas normal : cartes du projet de ⚙ ──
  ok('cartes du projet : pas d\'avis', avis() && avis().hidden === true);
  ok('cartes du projet : les 4 cartes affichées', Banc.cartes().length === 4, Banc.cartes().join());

  // ── Cas normal sans liaison : Grist envoie aussi d'autres projets ──
  await envoyer(['Kanban', 'Projet inventé B', 'Kanban', 'Projet inventé B']);
  ok('projets mêlés : pas d\'avis', avis().hidden === true, avis().textContent);
  ok('projets mêlés : seules les cartes du projet de ⚙', Banc.cartes().slice().sort().join() === '1,3', Banc.cartes().join());

  // ── Liaison sur un autre projet : aucune carte du projet de ⚙ ──
  await envoyer(FAUX_GRIST.records.map(() => 'Projet inventé B'));
  ok('autre projet : avis affiché', avis().hidden === false);
  ok('autre projet : avis nomme le projet de ⚙', avis().textContent.includes('« Kanban »'), avis().textContent);
  ok('autre projet : avis compte les cartes reçues', avis().textContent.includes('Grist a envoyé 4 cartes,'), avis().textContent);
  ok('autre projet : avis cite « Sélectionner par »', avis().textContent.includes('Sélectionner par'));
  ok('autre projet : avis en texte seul (aucune balise)', avis().children.length === 0);
  ok('autre projet : aucune carte affichée', Banc.cartes().length === 0, Banc.cartes().join());
  ok('autre projet : colonnes toujours affichées', document.querySelectorAll('#board .column').length > 0);

  // ── Une seule carte reçue : accord au singulier ──
  const garde = FAUX_GRIST.records.splice(1);
  await envoyer(['Projet inventé B']);
  ok('une carte : « 1 carte, » au singulier', avis().textContent.includes('Grist a envoyé 1 carte,'), avis().textContent);
  FAUX_GRIST.records.push(...garde);

  // ── Retour sur le bon projet : l'avis disparaît ──
  await envoyer(tousKanban);
  ok('retour au projet : avis masqué et vidé', avis().hidden === true && avis().textContent === '');
  ok('retour au projet : les 4 cartes de retour', Banc.cartes().length === 4, Banc.cartes().join());

  // ── Aucun projet choisi dans ⚙ : jamais d'avis ──
  // (envoyer() renvoie aussi les options, donc le projet n° 15 : on retire
  // le projet APRÈS l'envoi, puis on redessine)
  await envoyer(FAUX_GRIST.records.map(() => 'Projet inventé B'));
  ok('sans projet dans ⚙ (préalable) : avis affiché', avis().hidden === false);
  const projet = STATE.projetKanban;
  STATE.projetKanban = null;
  renderBoard();
  ok('sans projet dans ⚙ : pas d\'avis', avis().hidden === true);
  STATE.projetKanban = projet;
  await envoyer(tousKanban);

  // ── Mode d'emploi « ? » ──
  remplirAide();
  const aide = document.getElementById('aide-contenu').textContent;
  ok('mode d\'emploi : ligne « Lier le Kanban à une Page »', aide.includes('Lier le Kanban à une Page')
    && aide.includes('c\'est toujours le projet choisi dans ⚙ qui commande'));
});
