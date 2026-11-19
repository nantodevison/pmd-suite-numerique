// Numéro des cartes (#244), comme dans le Kanban (#203) : « #12 » en petit
// gris, à droite de la dernière rangée (pastilles, ou objets liés d'une
// grande carte), rangée créée pour une carte sans pastilles, aucun numéro en
// taille compacte ; « Fiche · #12 » dans la barre de la fiche, rien pour une
// nouvelle carte ; le clic sur le numéro ouvre la fiche comme la carte.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $ } = Banc;
  const carte = (id) => $(`#grille .carte[data-id="${id}"]`);
  const numero = (id) => carte(id)?.querySelector('.carte-id');

  // ── Taille moyenne ──
  ok('numéro « #1 » sur la carte 1', numero(1)?.textContent === '#1', numero(1)?.textContent);
  ok('un seul numéro par carte', carte(1).querySelectorAll('.carte-id').length === 1);
  ok('numéro dans un pied de carte à lui, en dernier', numero(1)?.parentElement.classList.contains('carte-pied')
    && numero(1).parentElement.children.length === 1 && numero(1).parentElement === carte(1).lastElementChild);
  const style = getComputedStyle(numero(1));
  ok('numéro poussé à droite, en petit', style.marginLeft !== '0px' && parseFloat(style.fontSize) <= 11,
    `${style.marginLeft} / ${style.fontSize}`);
  // En bas à droite, même quand la carte est étirée (constaté au test : le
  // numéro restait à droite des pastilles, au milieu d'une carte haute)
  const basDroite = (id) => {
    const r = numero(id).getBoundingClientRect(), rc = carte(id).getBoundingClientRect();
    return { droite: Math.round(rc.right - r.right), bas: Math.round(rc.bottom - r.bottom) };
  };
  let ecart = basDroite(1);
  ok('numéro collé en bas à droite de la carte', ecart.droite < 24 && ecart.bas < 24, JSON.stringify(ecart));
  carte(1).style.minHeight = '260px';   // carte étirée, comme à côté d'une voisine plus haute
  ecart = basDroite(1);
  ok('carte étirée : numéro toujours en bas à droite', ecart.droite < 24 && ecart.bas < 24, JSON.stringify(ecart));
  ok('carte étirée : pastilles toujours sous le titre', carte(1).querySelector('.carte-contexte').getBoundingClientRect().top
    - carte(1).querySelector('.carte-titre').getBoundingClientRect().bottom < 20);

  // Carte sans pastilles : le numéro quand même
  FAUX_GRIST.associer({ Pastilles: null });
  await attendre(300);
  ok('sans pastilles : numéro quand même', numero(1)?.textContent === '#1', carte(1)?.innerHTML);
  FAUX_GRIST.associer({});
  await attendre(300);

  // ── Taille compacte : le titre seul ──
  changerTaille('compacte');
  ok('compacte : aucun numéro', !$('#grille .carte-id'));
  // ── Taille grande : à droite des objets liés ──
  changerTaille('grande');
  ok('grande : numéro dans la rangée des objets liés', numero(1)?.parentElement.classList.contains('carte-lies'),
    numero(1)?.parentElement.className);
  ok('grande : sans objets liés, dans le pied', numero(2)?.parentElement.classList.contains('carte-pied'),
    numero(2)?.parentElement.className);
  ecart = basDroite(1);
  ok('grande : numéro en bas à droite', ecart.droite < 24 && ecart.bas < 24, JSON.stringify(ecart));
  changerTaille('moyenne');

  // ── Clic sur le numéro : ouvre la fiche, comme la carte ──
  numero(3).click();
  await attendre(100);
  ok('clic sur le numéro : fiche de la carte 3', $('#fiche').classList.contains('open')
    && $('#fiche-libelle').textContent === 'Fiche· #3', $('#fiche-libelle').textContent);
  ok('fiche : numéro dans son propre élément', $('#fiche-libelle .fiche-numero')?.textContent === '· #3');
  fermerFiche(true);

  // ── Nouvelle carte : pas encore de numéro ──
  $('#btn-nouvelle').click();
  await attendre(100);
  ok('nouvelle carte : « Nouvelle carte », sans numéro', $('#fiche-libelle').textContent === 'Nouvelle carte'
    && !$('#fiche-libelle .fiche-numero'));
  fermerFiche(true);

  // ── La recherche « #3 » retrouve toujours la carte ──
  const recherche = $('#recherche');
  recherche.value = '#3';
  recherche.dispatchEvent(new Event('input'));
  await attendre(100);
  ok('recherche « #3 » : la carte 3', Banc.cartes().join() === '3', Banc.cartes().join());
});
