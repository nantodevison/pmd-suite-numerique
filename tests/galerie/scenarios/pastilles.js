// Pastilles modifiables (#205 sur la carte, #206 dans la fiche) : menu selon
// le type de la colonne (Choix, Choix multiple, Référence, Case à cocher,
// Date), colonne calculée en lecture seule, clic qui n'ouvre pas la fiche,
// écriture immédiate sur la carte, au clavier, cellule en erreur corrigée,
// table visée relue à chaque ouverture (et pas au chargement), champ de
// recherche pour une longue liste, puis, dans la fiche : pastilles vides
// « + … », choix gardés jusqu'à « ✓ Sauvegarder », Échap.
//
// Pastilles associées pour ce scénario (faux Grist, cartes 1 à 4) :
//   Priorité (Choix), Avancement (calculée), Projet (Référence),
//   Thèmes (Choix multiple), Urgent (Case à cocher), Échéance (Date).
Banc.lancer(async () => {
  await Banc.demarrer({ colonnes: { Pastilles: ['Priorite', 'Avancement', 'Projet', 'Themes', 'Urgent', 'Echeance'] } });
  const { ok, attendre, $, $$ } = Banc;
  const textes = (sel) => $$(sel).map(e => e.textContent);
  const pastillesCarte = (id) => textes(`.carte[data-id="${id}"] .pastille`);
  // Pastille d'une carte d'après son texte
  const pastille = (id, texte) => $$(`.carte[data-id="${id}"] .pastille`).find(p => p.textContent === texte);
  const menu = () => $('.fiche-menu');
  const items = () => textes('.fiche-menu .fiche-menu-libelle');
  const item = (libelle) => $$('.fiche-menu .fiche-menu-item').find(i => i.textContent.trim() === libelle);
  const ficheOuverte = () => $('#fiche').classList.contains('open');
  const derniere = () => JSON.stringify(FAUX_GRIST.actions.at(-1)?.[0]);
  const echap = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  // ════════ Sur la carte (#205) ════════
  ok('carte 1 : six pastilles', pastillesCarte(1).join('|') === 'Now|67 %|Atelier|Guide|✓ oui|01/01/2026',
    pastillesCarte(1).join('|'));
  ok('Priorité (Choix) : modifiable', pastille(1, 'Now').classList.contains('pastille-modifiable'));
  ok('Avancement (calculée) : lecture seule', !pastille(1, '67 %').classList.contains('pastille-modifiable'));
  ok('bulle : « cliquer pour modifier »', pastille(1, 'Now').title === 'Priorité : Now — cliquer pour modifier', pastille(1, 'Now').title);
  ok('table visée par Projet non lue au chargement', !FAUX_GRIST.lectures.includes('Projets'), FAUX_GRIST.lectures.join());

  // ── Choix ──
  pastille(1, 'Now').click();
  await attendre(50);
  ok('clic sur la pastille : la fiche ne s\'ouvre pas', !ficheOuverte());
  ok('menu : « — aucun — » puis les choix de Grist', items().join('|') === '— aucun —|Now|Later', items().join('|'));
  ok('menu : choix actuel marqué', item('Now')?.classList.contains('choisi'));
  let avant = FAUX_GRIST.actions.length;
  item('Later').click();
  await attendre(150);
  ok('choix : écrit tout de suite (UpdateRecord)', derniere() === '["UpdateRecord","EPICs",1,{"Priorite":"Later"}]', derniere());
  ok('choix : une seule écriture', FAUX_GRIST.actions.length === avant + 1);
  ok('choix : menu fermé', !menu());
  ok('choix : carte redessinée', pastillesCarte(1)[0] === 'Later', pastillesCarte(1).join('|'));
  ok('choix : message', $('#toast').textContent === '✓ Priorité modifié', $('#toast').textContent);

  // ── Pastille en lecture seule : le clic ouvre la fiche, comme le reste de la carte ──
  pastille(1, '67 %').click();
  await attendre(50);
  ok('pastille calculée : pas de menu, la fiche s\'ouvre', !menu() && ficheOuverte());
  fermerFiche(true);

  // ── Référence : table visée lue à l'ouverture du menu ──
  pastille(1, 'Atelier').click();
  await attendre(100);
  ok('référence : table visée lue au clic', FAUX_GRIST.lectures.includes('Projets'));
  ok('référence : « — aucune — » puis les projets de A à Z', items().join('|') === '— aucune —|Atelier|Vitrine', items().join('|'));
  ok('référence : valeur actuelle marquée', item('Atelier')?.classList.contains('choisi'));
  item('Vitrine').click();
  await attendre(150);
  ok('référence : écrite sous son NUMÉRO', derniere() === '["UpdateRecord","EPICs",1,{"Projet":2}]', derniere());
  ok('référence : carte redessinée avec le nom', pastillesCarte(1)[2] === 'Vitrine', pastillesCarte(1).join('|'));

  // ── Choix multiple : cases à cocher, chaque case écrite ──
  pastille(1, 'Guide').click();
  await attendre(50);
  const cases = () => $$('.fiche-menu input[type="checkbox"]');
  ok('choix multiple : une case par choix', items().join('|') === 'Guide|Site|Formation', items().join('|'));
  ok('choix multiple : « Guide » coché', cases()[0]?.checked && !cases()[1]?.checked);
  cases()[1].click();
  await attendre(150);
  ok('choix multiple : liste écrite [\'L\', …]', derniere() === '["UpdateRecord","EPICs",1,{"Themes":["L","Guide","Site"]}]', derniere());
  ok('choix multiple : le menu reste ouvert', Boolean(menu()));
  cases()[0].click();
  cases()[1].click();
  await attendre(150);
  ok('choix multiple : tout décoché → cellule vidée (null)', derniere() === '["UpdateRecord","EPICs",1,{"Themes":null}]', derniere());
  ok('choix multiple : pastille vide retirée de la carte', !pastillesCarte(1).includes('Guide') && !pastillesCarte(1).includes('Site'),
    pastillesCarte(1).join('|'));
  echap();
  await attendre(50);
  ok('Échap : menu fermé, fiche toujours fermée', !menu() && !ficheOuverte());

  // ── Case à cocher ──
  pastille(1, '✓ oui').click();
  await attendre(50);
  ok('case à cocher : oui / non', items().join('|') === '✓ oui|✗ non', items().join('|'));
  item('✗ non').click();
  await attendre(150);
  ok('case à cocher : écrite false', derniere() === '["UpdateRecord","EPICs",1,{"Urgent":false}]', derniere());

  // ── Date ──
  pastille(1, '01/01/2026').click();
  await attendre(50);
  const calendrier = $('.fiche-menu input[type="date"]');
  ok('date : calendrier sur la date actuelle', calendrier?.value === '2026-01-01', calendrier?.value);
  calendrier.value = '2026-03-15';
  calendrier.dispatchEvent(new Event('change'));
  await attendre(150);
  const secondes = Date.parse('2026-03-15') / 1000;
  ok('date : écrite en secondes (minuit UTC)', derniere() === `["UpdateRecord","EPICs",1,{"Echeance":${secondes}}]`, derniere());
  ok('date : carte redessinée', pastillesCarte(1).includes('15/03/2026'), pastillesCarte(1).join('|'));
  pastille(1, '15/03/2026').click();
  await attendre(50);
  item('Effacer la date').click();
  await attendre(150);
  ok('date : « Effacer la date » → null', derniere() === '["UpdateRecord","EPICs",1,{"Echeance":null}]', derniere());

  // ── Au clavier : Tab jusqu'à la pastille, puis Entrée ──
  const later = pastille(2, 'Later');
  ok('pastille atteignable au clavier', later.tabIndex === 0 && later.getAttribute('role') === 'button');
  later.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await attendre(50);
  ok('Entrée : menu ouvert, pas la fiche', Boolean(menu()) && !ficheOuverte());
  echap();
  await attendre(50);

  // ── Cellule en erreur : la référence se corrige d'un clic ──
  const invalide = pastille(4, '⚠️ invalide');
  ok('cellule en erreur : modifiable', invalide?.classList.contains('pastille-modifiable'));
  invalide.click();
  await attendre(100);
  ok('cellule en erreur : aucune valeur marquée', !$('.fiche-menu .choisi'));
  item('Atelier').click();
  await attendre(150);
  ok('cellule en erreur : corrigée', derniere() === '["UpdateRecord","EPICs",4,{"Projet":1}]' && pastillesCarte(4).includes('Atelier'),
    derniere());

  // ── Projet ajouté dans Grist entre-temps : proposé tout de suite ──
  const projets = FAUX_GRIST.donnees.Projets;
  projets.id.push(3); projets.Nom.push('Chantier'); projets.Etat.push('Ouvert');
  pastille(2, 'Atelier').click();
  await attendre(100);
  ok('table visée relue : le nouveau projet est proposé', items().join('|') === '— aucune —|Atelier|Chantier|Vitrine', items().join('|'));
  echap();

  // ── Longue liste (plus de 12 projets) : champ de recherche ──
  for (let n = 4; n <= 14; n++) { projets.id.push(n); projets.Nom.push(`Projet inventé ${n}`); projets.Etat.push('Ouvert'); }
  pastille(2, 'Atelier').click();
  await attendre(100);
  const saisie = $('.fiche-menu input[type="search"]');
  ok('longue liste : champ de recherche', Boolean(saisie));
  ok('longue liste : « — aucune — » en tête', items()[0] === '— aucune —', items().slice(0, 2).join('|'));
  saisie.value = 'chantier';
  saisie.dispatchEvent(new Event('input'));
  ok('recherche : un seul résultat', items().join('|') === 'Chantier', items().join('|'));
  item('Chantier').click();
  await attendre(150);
  ok('recherche : référence écrite', derniere() === '["UpdateRecord","EPICs",2,{"Projet":3}]', derniere());
  pastille(2, 'Chantier').click();
  await attendre(100);
  item('— aucune —').click();
  await attendre(150);
  ok('« — aucune — » : référence vidée (0)', derniere() === '["UpdateRecord","EPICs",2,{"Projet":0}]', derniere());
  ok('référence vide : pastille retirée de la carte', !pastillesCarte(2).includes('Chantier'), pastillesCarte(2).join('|'));

  // ════════ Dans la fiche (#206) ════════
  ouvrirFiche(3);
  await attendre(100);
  const encart = () => textes('.fiche-entete-pastilles .pastille');
  const pastilleFiche = (texte) => $$('.fiche-entete-pastilles .pastille').find(p => p.textContent === texte);
  ok('fiche : colonnes vides modifiables en « + … »', encart().join('|') === '+ Priorité|10 %|Vitrine|+ Thèmes|✓ oui|+ Échéance',
    encart().join('|'));
  ok('fiche : pastille calculée en lecture seule', !pastilleFiche('10 %').classList.contains('pastille-modifiable'));
  ok('fiche : « + Priorité » en pointillés, modifiable',
    pastilleFiche('+ Priorité').classList.contains('pastille-vide') && pastilleFiche('+ Priorité').classList.contains('pastille-modifiable'));

  avant = FAUX_GRIST.actions.length;
  pastilleFiche('+ Priorité').click();
  await attendre(50);
  ok('fiche : colonne vide → « — aucun — » marqué', item('— aucun —')?.classList.contains('choisi'));
  item('Now').click();
  await attendre(50);
  ok('fiche : choix affiché aussitôt', encart()[0] === 'Now', encart().join('|'));
  ok('fiche : rien d\'écrit avant « Sauvegarder »', FAUX_GRIST.actions.length === avant);
  ok('fiche : indicateur « modifié » et « Sauvegarder » actif',
    $('#fiche-modifie').classList.contains('visible') && !$('#fiche-sauver').disabled);

  pastilleFiche('Vitrine').click();
  await attendre(100);
  item('Atelier').click();
  await attendre(50);
  ok('fiche : référence affichée sous son nom', encart()[2] === 'Atelier', encart().join('|'));

  // Échap avec un menu ouvert : ferme le menu, pas la fiche
  pastilleFiche('+ Thèmes').click();
  await attendre(50);
  echap();
  await attendre(50);
  ok('fiche : Échap ferme le menu, la fiche reste ouverte', !menu() && ficheOuverte());

  $('#fiche-sauver').click();
  await attendre(300);
  ok('fiche : « Sauvegarder » écrit les deux pastilles en une fois',
    JSON.stringify(Banc.actionsDepuis(avant)) === '[["UpdateRecord","EPICs",3,{"Priorite":"Now","Projet":1}]]',
    JSON.stringify(Banc.actionsDepuis(avant)));
  ok('fiche : carte mise à jour', pastillesCarte(3).join('|') === 'Now|10 %|Atelier|✓ oui', pastillesCarte(3).join('|'));
  ok('fiche : plus rien de modifié', !$('#fiche-modifie').classList.contains('visible'));

  // Choix non sauvegardé, puis fermeture : confirmation, rien d'écrit
  avant = FAUX_GRIST.actions.length;
  pastilleFiche('✓ oui').click();
  await attendre(50);
  item('✗ non').click();
  Banc.repondre(false);
  fermerFiche();
  ok('fiche : fermer avec un choix non sauvegardé → confirmation', Banc.confirmations.length === 1 && ficheOuverte());
  Banc.repondre(true);
  fermerFiche();
  ok('fiche : fermée sans rien écrire', !ficheOuverte() && FAUX_GRIST.actions.length === avant);
  ouvrirFiche(3);
  await attendre(100);
  ok('fiche rouverte : la valeur de Grist revient', encart().includes('✓ oui'), encart().join('|'));
  fermerFiche(true);
});
