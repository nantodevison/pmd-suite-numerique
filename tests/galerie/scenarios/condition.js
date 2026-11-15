// Condition de liste déroulante de Grist (#238) : évaluateur commun
// (../_commun/condition.js), puis menus des pastilles qui ne proposent que
// les options permises : référence (choice.Projet == $Projet), « et » / « !== »,
// choix simple et choix multiple, valeur actuelle toujours gardée, choix en
// attente de la fiche pris en compte, expression inconnue (tout proposé).
//
// Versions inventées : A → Atelier, B → Vitrine, C (ajoutée ici) → Atelier.
// Cartes : 1 Atelier + Version A, 2 Atelier sans version, 3 Vitrine + Version B.
Banc.lancer(async () => {
  await Banc.demarrer({ colonnes: { Pastilles: ['Priorite', 'Projet', 'Version'] } });
  const { ok, attendre, $, $$ } = Banc;
  const G = Condition.garder;
  const choice = ['Name', 'choice'];
  const rec = ['Name', 'rec'];
  const attr = (objet, col) => ['Attr', objet, col];
  const memeProjet = ['Eq', attr(choice, 'Projet'), attr(rec, 'Projet')];

  // ── 1. L'évaluateur ──
  ok('égalité : même projet gardé, autre projet écarté',
    G(memeProjet, { choice: { Projet: 1 }, rec: { Projet: 1 } }) === true
    && G(memeProjet, { choice: { Projet: 2 }, rec: { Projet: 1 } }) === false);
  ok('« et » avec « != »', G(['And', memeProjet, ['NotEq', attr(choice, 'Nom'), attr(rec, 'Nom')]],
    { choice: { Projet: 1, Nom: 'x' }, rec: { Projet: 1, Nom: 'x' } }) === false);
  ok('« ou » et « non »', G(['Or', ['Eq', ['Const', 1], ['Const', 2]], ['Not', ['Eq', ['Const', 1], ['Const', 2]]]], {}) === true);
  ok('« in » une liste de constantes', G(['In', choice, ['List', ['Const', 'a'], ['Const', 'b']]], { choice: 'a' }) === true
    && G(['In', choice, ['List', ['Const', 'a'], ['Const', 'b']]], { choice: 'c' }) === false);
  ok('« in » une liste de références (encodée par Grist)',
    G(['In', attr(rec, 'Projet'), attr(choice, 'Projets')], { choice: { Projets: ['L', 1, 2] }, rec: { Projet: 2 } }) === true);
  ok('comparaison « < »', G(['Lt', attr(choice, 'n'), ['Const', 5]], { choice: { n: 3 } }) === true);
  ok('valeur seule, au sens de Python (case non cochée = faux)', G(attr(choice, 'Actif'), { choice: { Actif: false } }) === false);
  ok('opération inconnue : gardée', G(['Call', ['Name', 'len'], choice], { choice: 'a' }) === true);
  ok('chaîne $Projet.Etat (autre table) : inconnue, gardée',
    G(['Eq', attr(attr(rec, 'Projet'), 'Etat'), ['Const', 'Ouvert']], { rec: { Projet: 1 } }) === true);
  ok('« et » : un faux l\'emporte sur un inconnu', G(['And', ['Call'], ['Eq', ['Const', 1], ['Const', 2]]], {}) === false);
  ok('pas de condition : tout gardé', G(null, {}) === true);

  // ── 2. Lecture de la condition dans la structure du document ──
  const cols = FAUX_GRIST.meta._grist_Tables_column;
  const poserCondition = async (colId, arbre) => {
    const i = cols.colId.findIndex((c, k) => c === colId && cols.parentId[k] === 1);
    const options = JSON.parse(cols.widgetOptions[i] || '{}');
    if (arbre) options.dropdownCondition = { text: '(formule)', parsed: JSON.stringify(arbre) };
    else delete options.dropdownCondition;
    cols.widgetOptions[i] = JSON.stringify(options);
    ETAT.doc = await Colonnes.lireDocument();   // structure relue, comme au rechargement du widget
  };
  FAUX_GRIST.donnees.Versions.id.push(3);
  FAUX_GRIST.donnees.Versions.Nom.push('Version C');
  FAUX_GRIST.donnees.Versions.Projet.push(1);
  await poserCondition('Version', memeProjet);
  ok('condition lue dans la structure (champ condition)', JSON.stringify(info('Version').condition) === JSON.stringify(memeProjet));
  ok('colonne sans condition : null', info('Projet').condition === null);

  // ── 3. Menus sur la carte ──
  const libelles = () => $$('.fiche-menu .fiche-menu-item').map(i => i.textContent.trim()).join('|');
  const ouvrir = async (selecteurPastille, texte) => {
    Fiche.fermerMenu();
    $$(selecteurPastille).find(p => p.textContent === texte).click();
    await attendre(150);
  };
  await ouvrir('.carte[data-id="1"] .pastille', 'Version A');
  ok('carte 1 (Atelier) : versions de l\'Atelier seulement', libelles() === '— aucune —|Version A|Version C', libelles());
  await ouvrir('.carte[data-id="3"] .pastille', 'Version B');
  ok('carte 3 (Vitrine) : Version B seule', libelles() === '— aucune —|Version B', libelles());
  ok('la carte est relue sous ses numéros (fetchTable)', FAUX_GRIST.lectures.includes('EPICs'));

  // Valeur actuelle hors condition : toujours proposée
  await grist.docApi.applyUserActions([['UpdateRecord', 'EPICs', 3, { Version: 1 }]]);   // Vitrine + Version A
  await attendre(200);
  await ouvrir('.carte[data-id="3"] .pastille', 'Version A');
  ok('valeur actuelle hors condition : gardée, en plus des permises', libelles() === '— aucune —|Version A|Version B', libelles());
  Fiche.fermerMenu();

  // ── 4. Dans la fiche : les choix en attente comptent ──
  ouvrirFiche(2);   // Atelier, sans version
  await attendre(100);
  const pastillesFiche = '#fiche-corps .fiche-entete-pastilles .pastille';
  await ouvrir(pastillesFiche, '+ Version');
  ok('fiche 2 (Atelier) : versions de l\'Atelier', libelles() === '— aucune —|Version A|Version C', libelles());
  await ouvrir(pastillesFiche, 'Atelier');
  $$('.fiche-menu .fiche-menu-item').find(i => i.textContent.trim() === 'Vitrine').click();
  await attendre(100);
  await ouvrir(pastillesFiche, '+ Version');
  ok('projet changé dans la fiche (pas encore sauvegardé) : versions de la Vitrine',
    libelles() === '— aucune —|Version B', libelles());
  Fiche.fermerMenu();
  fermerFiche(true);

  // ── 5. Expression inconnue : tout est proposé ──
  await poserCondition('Version', ['Eq', attr(attr(choice, 'Projet'), 'Etat'), ['Const', 'Ouvert']]);
  await ouvrir('.carte[data-id="1"] .pastille', 'Version A');
  ok('expression inconnue : toutes les versions', libelles() === '— aucune —|Version A|Version B|Version C', libelles());

  // ── 6. Choix simple : choice est le texte du choix ──
  await poserCondition('Version', null);
  await poserCondition('Priorite', ['NotEq', choice, ['Const', 'Later']]);
  await ouvrir('.carte[data-id="1"] .pastille', 'Now');
  ok('choix simple : « Later » écarté', libelles() === '— aucun —|Now', libelles());
  await ouvrir('.carte[data-id="2"] .pastille', 'Later');
  ok('choix simple : valeur actuelle « Later » gardée', libelles() === '— aucun —|Now|Later', libelles());
  Fiche.fermerMenu();
  await poserCondition('Priorite', null);
  await ouvrir('.carte[data-id="1"] .pastille', 'Now');
  ok('condition retirée : tous les choix reviennent', libelles() === '— aucun —|Now|Later', libelles());
  Fiche.fermerMenu();
});
