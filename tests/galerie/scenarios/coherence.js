// Cohérence entre deux références d'une carte (#205, #206) : chaque version
// relève d'un projet (table Versions inventée : Version A → Atelier, Version B →
// Vitrine). Changer le projet sans changer la version, ou choisir la version
// d'un autre projet, affiche une alerte ; l'écriture a lieu quand même.
//
// Cartes au départ : 1 Atelier + Version A (cohérente), 2 Atelier sans version,
// 3 Vitrine + Version B (cohérente).
Banc.lancer(async () => {
  await Banc.demarrer({ colonnes: { Pastilles: ['Priorite', 'Projet', 'Version'] } });
  const { ok, attendre, $, $$ } = Banc;
  const pastille = (id, texte) => $$(`.carte[data-id="${id}"] .pastille`).find(p => p.textContent === texte);
  const item = (libelle) => $$('.fiche-menu .fiche-menu-item').find(i => i.textContent.trim() === libelle);
  const toast = () => $('#toast').textContent;
  const derniere = () => JSON.stringify(FAUX_GRIST.actions.at(-1)?.[0]);
  // Choisit `valeur` dans le menu de la pastille `texte` de la carte `id`
  const choisir = async (id, texte, valeur) => {
    $('#toast').textContent = '';
    pastille(id, texte).click();
    await attendre(100);
    item(valeur).click();
    await attendre(250);
  };

  // ── Changer le projet : la version n'en relève plus ──
  await choisir(1, 'Atelier', 'Vitrine');
  ok('projet changé : écrit quand même', derniere() === '["UpdateRecord","EPICs",1,{"Projet":2}]', derniere());
  ok('projet changé : alerte sur la version',
    toast() === '✓ Projet modifié — ⚠️ « Version A » (Version) relève d\'un autre projet que « Vitrine » : pensez à le changer', toast());

  // ── Revenir au bon projet : plus d'alerte ──
  await choisir(1, 'Vitrine', 'Atelier');
  ok('projet cohérent : pas d\'alerte', toast() === '✓ Projet modifié', toast());

  // ── Carte sans version : rien à vérifier ──
  await choisir(2, 'Atelier', 'Vitrine');
  ok('sans version : pas d\'alerte', toast() === '✓ Projet modifié', toast());

  // ── Dans l'autre sens : choisir la version d'un autre projet ──
  await choisir(3, 'Version B', 'Version A');
  ok('version d\'un autre projet : alerte',
    toast() === '✓ Version modifié — ⚠️ « Version A » (Version) relève d\'un autre projet que « Vitrine » : pensez à le changer', toast());

  // ── Changer une colonne qui n'est pas une référence : pas de vérification ──
  const lectures = FAUX_GRIST.lectures.length;
  await choisir(1, 'Now', 'Later');
  ok('choix simple : aucune lecture, pas d\'alerte', FAUX_GRIST.lectures.length === lectures && toast() === '✓ Priorité modifié', toast());

  // ── Dans la fiche : les choix en attente comptent ──
  ouvrirFiche(3);   // Vitrine + Version A : incohérente
  await attendre(100);
  const pastilleFiche = (texte) => $$('.fiche-entete-pastilles .pastille').find(p => p.textContent === texte);
  const choisirFiche = async (texte, valeur) => {
    $('#toast').textContent = '';
    pastilleFiche(texte).click();
    await attendre(100);
    item(valeur).click();
    await attendre(250);
  };
  await choisirFiche('Vitrine', 'Atelier');
  ok('fiche : projet rendu cohérent avec la version → pas d\'alerte', toast() === '', toast());
  await choisirFiche('Version A', 'Version B');
  ok('fiche : version comparée au projet en attente (Atelier)',
    toast() === '⚠️ « Version B » (Version) relève d\'un autre projet que « Atelier » : pensez à le changer', toast());
  ok('fiche : rien d\'écrit avant « Sauvegarder »', derniere() === '["UpdateRecord","EPICs",1,{"Priorite":"Later"}]', derniere());
  fermerFiche(true);
});
