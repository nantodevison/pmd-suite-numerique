// Listes de références en pastilles (EPICs.Redacteurs → Personnes) :
// une pastille par élément ; recherche à cases au-delà de 12 lignes visées,
// menu à cases en deçà ; écriture immédiate ['L', numéros…] sur la carte,
// null si tout est décoché ; Entrée qui coche le premier résultat ;
// homonymes distingués par leur numéro ; numéro inconnu gardé ; dans la
// fiche, choix gardés jusqu'à « ✓ Sauvegarder » et recochés à la réouverture.
//
// Personnes inventées : Personne 01 … Personne 13, puis un homonyme
// « Personne 02 » (numéro 14). Rédacteurs des cartes : 1 → [14] (le SECOND
// « Personne 02 »), 2 → aucun, 3 → [1, 3].
Banc.lancer(async () => {
  await Banc.demarrer({ colonnes: { Pastilles: ['Priorite', 'Redacteurs'] } });
  const { ok, attendre, $, $$ } = Banc;
  const textes = (sel) => $$(sel).map(e => e.textContent);
  const pastillesCarte = (id) => textes(`.carte[data-id="${id}"] .pastille`);
  const pastille = (id, texte) => $$(`.carte[data-id="${id}"] .pastille`).find(p => p.textContent === texte);
  const menu = () => $('.fiche-menu');
  const recherche = () => $('.fiche-menu input[type="search"]');
  const libelles = () => textes('.fiche-menu .fiche-menu-libelle');
  const lignesMenu = () => $$('.fiche-menu .fiche-menu-item');
  // Cases du menu dont le libellé vaut `libelle` (deux pour des homonymes)
  const cases = (libelle) => lignesMenu()
    .filter(l => l.querySelector('.fiche-menu-libelle')?.textContent === libelle)
    .map(l => l.querySelector('input[type="checkbox"]'));
  const cochees = () => lignesMenu().filter(l => l.querySelector('input')?.checked)
    .map(l => l.querySelector('.fiche-menu-libelle').textContent);
  const derniere = () => JSON.stringify(FAUX_GRIST.actions.at(-1)?.[0]);
  const echap = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const taper = (texte) => { recherche().value = texte; recherche().dispatchEvent(new Event('input')); };
  const entree = () => recherche().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const ficheOuverte = () => $('#fiche').classList.contains('open');

  // ════════ Affichage ════════
  ok('carte 3 : une pastille par rédacteur', pastillesCarte(3).join('|') === 'Personne 01|Personne 03', pastillesCarte(3).join('|'));
  ok('pastille d\'une liste de références : modifiable', pastille(3, 'Personne 01')?.classList.contains('pastille-modifiable'));
  ok('carte 2 : liste vide, aucune pastille de rédacteur', pastillesCarte(2).join('|') === 'Later', pastillesCarte(2).join('|'));
  ok('table Personnes non lue au chargement', !FAUX_GRIST.lectures.includes('Personnes'), FAUX_GRIST.lectures.join());

  // ════════ Recherche à cases : 14 personnes, plus que le seuil ════════
  pastille(3, 'Personne 01').click();
  await attendre(100);
  ok('clic : la fiche ne s\'ouvre pas', !ficheOuverte());
  ok('table visée lue au clic', FAUX_GRIST.lectures.includes('Personnes'));
  ok('plus de 12 personnes : champ de recherche', Boolean(recherche()));
  ok('une case par personne', $$('.fiche-menu input[type="checkbox"]').length === 14,
    String($$('.fiche-menu input[type="checkbox"]').length));
  ok('pas de « — aucune — » en mode cases', !libelles().includes('— aucune —'));
  ok('valeurs actuelles cochées', cochees().join('|') === 'Personne 01|Personne 03', cochees().join('|'));

  let avant = FAUX_GRIST.actions.length;
  taper('personne 05');
  ok('recherche : un seul résultat', libelles().join('|') === 'Personne 05', libelles().join('|'));
  cases('Personne 05')[0].click();
  await attendre(150);
  ok('case cochée : liste écrite sous ses NUMÉROS', derniere() === '["UpdateRecord","EPICs",3,{"Redacteurs":["L",1,3,5]}]', derniere());
  ok('case cochée : le menu reste ouvert', Boolean(menu()));
  ok('case cochée : carte redessinée', pastillesCarte(3).join('|') === 'Personne 01|Personne 03|Personne 05', pastillesCarte(3).join('|'));
  ok('case cochée : message', $('#toast').textContent === '✓ Rédacteurs modifié', $('#toast').textContent);

  // Entrée : coche le premier résultat, puis vide le champ pour enchaîner
  taper('13');
  entree();
  await attendre(150);
  ok('Entrée : premier résultat coché et écrit', derniere() === '["UpdateRecord","EPICs",3,{"Redacteurs":["L",1,3,5,13]}]', derniere());
  ok('Entrée : champ vidé, toute la liste revient', recherche().value === ''
    && $$('.fiche-menu input[type="checkbox"]').length === 14);
  ok('Entrée : coches conservées', cochees().join('|') === 'Personne 01|Personne 03|Personne 05|Personne 13', cochees().join('|'));

  ['Personne 01', 'Personne 03', 'Personne 05', 'Personne 13'].forEach(n => cases(n)[0].click());
  await attendre(150);
  ok('tout décoché : cellule vidée (null)', derniere() === '["UpdateRecord","EPICs",3,{"Redacteurs":null}]', derniere());
  ok('une écriture par case', FAUX_GRIST.actions.length === avant + 6, String(FAUX_GRIST.actions.length - avant));
  ok('liste vide : pastilles retirées de la carte', pastillesCarte(3).length === 0, pastillesCarte(3).join('|'));
  echap();
  await attendre(50);
  ok('Échap : menu fermé, fiche toujours fermée', !menu() && !ficheOuverte());

  // ════════ Homonymes : le numéro fait foi, pas le nom ════════
  pastille(1, 'Personne 02').click();
  await attendre(100);
  const homonymes = cases('Personne 02');
  ok('homonymes : deux lignes « Personne 02 »', homonymes.length === 2, String(homonymes.length));
  ok('homonymes : seule la seconde (n° 14) est cochée', homonymes[0] && !homonymes[0].checked && homonymes[1]?.checked);
  cases('Personne 04')[0].click();
  await attendre(150);
  ok('homonymes : le bon numéro est gardé', derniere() === '["UpdateRecord","EPICs",1,{"Redacteurs":["L",14,4]}]', derniere());
  echap();
  await attendre(50);

  // ════════ Menu à cases : 12 personnes ou moins ════════
  // On ne garde que Personne 01 à 03 : la carte 1 vise alors deux numéros
  // inconnus (4 et 14), qui restent proposés, cochés, sous leur numéro.
  const personnes = FAUX_GRIST.donnees.Personnes;
  personnes.id.splice(3);
  personnes.Nom.splice(3);
  pastille(1, 'Personne 04').click();
  await attendre(100);
  ok('peu de personnes : pas de champ de recherche', Boolean(menu()) && !recherche());
  ok('peu de personnes : numéros inconnus proposés, cochés', cochees().join('|') === 'n° 14|n° 4', cochees().join('|'));
  ok('peu de personnes : liste de A à Z', libelles().join('|') === 'n° 14|n° 4|Personne 01|Personne 02|Personne 03', libelles().join('|'));
  cases('Personne 02')[0].click();
  await attendre(150);
  ok('menu à cases : liste écrite', derniere() === '["UpdateRecord","EPICs",1,{"Redacteurs":["L",14,4,2]}]', derniere());
  cases('n° 4')[0].click();
  await attendre(150);
  ok('numéro inconnu décoché : retiré', derniere() === '["UpdateRecord","EPICs",1,{"Redacteurs":["L",14,2]}]', derniere());
  echap();
  await attendre(50);

  // ════════ Dans la fiche : rien d'écrit avant « ✓ Sauvegarder » ════════
  ouvrirFiche(3);
  await attendre(100);
  const encart = () => textes('.fiche-entete-pastilles .pastille');
  const pastilleFiche = (texte) => $$('.fiche-entete-pastilles .pastille').find(p => p.textContent === texte);
  ok('fiche : liste vide → « + Rédacteurs »', encart().join('|') === '+ Priorité|+ Rédacteurs', encart().join('|'));
  avant = FAUX_GRIST.actions.length;
  pastilleFiche('+ Rédacteurs').click();
  await attendre(100);
  ok('fiche : aucune case cochée', Boolean(menu()) && cochees().length === 0, cochees().join('|'));
  cases('Personne 01')[0].click();
  await attendre(50);
  cases('Personne 03')[0].click();
  await attendre(50);
  ok('fiche : choix affichés aussitôt', encart().join('|') === '+ Priorité|Personne 01|Personne 03', encart().join('|'));
  ok('fiche : rien d\'écrit avant « Sauvegarder »', FAUX_GRIST.actions.length === avant);
  echap();
  await attendre(50);
  ok('fiche : Échap ferme le menu, la fiche reste ouverte', !menu() && ficheOuverte());
  pastilleFiche('Personne 01').click();
  await attendre(100);
  ok('fiche : choix en attente recochés à la réouverture', cochees().join('|') === 'Personne 01|Personne 03', cochees().join('|'));
  echap();
  await attendre(50);
  $('#fiche-sauver').click();
  await attendre(300);
  ok('fiche : « Sauvegarder » écrit la liste', JSON.stringify(Banc.actionsDepuis(avant)) === '[["UpdateRecord","EPICs",3,{"Redacteurs":["L",1,3]}]]',
    JSON.stringify(Banc.actionsDepuis(avant)));
  ok('fiche : carte mise à jour', pastillesCarte(3).join('|') === 'Personne 01|Personne 03', pastillesCarte(3).join('|'));
  fermerFiche(true);
});
