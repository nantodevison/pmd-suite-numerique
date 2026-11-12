// Interface commune des vues (../_commun/vues.js, #231, étape 2) vérifiée
// SANS le Kanban : un mini-widget inventé (trois lignes, un filtre, un tri)
// s'y branche, comme le fera la Galerie (#204). Le Kanban, chargé à côté,
// n'est pas touché. Puis, dans le Kanban : barre et fenêtre construites par
// le module, avec ses onglets Tri et Colonnes.
Banc.lancer(async () => {
  const { ok, attendre, $ } = Banc;
  await Banc.demarrer();

  // ── Le mini-widget ──
  const etat = { filtres: [], tri: [] };
  const lignes = [{ P: 'a' }, { P: 'b' }, { P: 'a' }];
  const visibles = () => lignes.filter(l => etat.filtres.every(f => Filtres.ligneRespecte(l, f)));
  const journal = { redessins: 0, appliquees: 0, messages: [], ecrites: [], restaurees: [] };
  const barre = document.createElement('div');
  barre.style.cssText = 'display:flex; width:900px';
  const zoneVues = document.createElement('div');
  const zoneResumes = document.createElement('div');
  barre.append(zoneVues, zoneResumes);
  document.body.appendChild(barre);
  const panneau = { fermer() {}, dessinerEtiquettes() {}, resume: f => `${f.col} : ${f.valeurs.join(', ')}` };

  const R = Vues.creer({
    cle: (nom) => `mini.${nom}`,
    ecrirePartagees: (liste) => { journal.ecrites.push(liste); return Promise.resolve(); },
  });
  R.charger([]);
  let UI = null;
  UI = Vues.creerInterface(R, {
    barre, zoneVues, zoneResumes,
    filtres: () => etat.filtres,
    remplacerFiltres: (l) => { etat.filtres = l; },
    tri: () => etat.tri,
    remplacerTri: (t) => { etat.tri = t; },
    appliquerVue: () => {
      journal.appliquees++;
      etat.filtres = Filtres.copier(R.active().filtres);
      etat.tri = (R.active().tri || []).map(c => ({ ...c }));
    },
    redessiner: () => { journal.redessins++; if (UI) { UI.dessinerBarre(); UI.majBoutonFiltres(); UI.majFenetre(); } },
    compter: () => ({ affichees: visibles().length, total: lignes.length }),
    panneauFiltres: () => panneau,
    photographier: () => 'photo-propre',
    restaurer: (photo) => journal.restaurees.push(photo),
    prevenir: (m) => journal.messages.push(m),
  });
  UI.dessinerBarre();
  const dans = (sel) => barre.querySelector(sel);
  const onglets = () => [...zoneVues.querySelectorAll('.vue-enregistree')].map(o => o.textContent.replace('⋯', '').trim());

  // ── Barre ──
  ok('mini : « Toutes les cartes » seule, puis « ＋ Vue »', onglets().join('|') === 'Toutes les cartes' && dans('#vue-ajouter'), onglets().join('|'));
  ok('mini : « 🔽 Filtres » en tête des résumés', zoneResumes.firstElementChild?.textContent === '🔽 Filtres');
  ok('mini : bulle d\'aide de « Toutes les cartes » par défaut', zoneVues.querySelector('.vue-enregistree').title === 'Toutes les cartes');

  // ── Créer une vue partagée par « ＋ Vue » ──
  etat.filtres = [{ col: 'P', op: 'est', valeurs: ['a'] }];
  dans('#vue-ajouter').click();
  const popNom = UI.fenetre && [...document.querySelectorAll('#vue-nom-popover')].pop();
  ok('mini : panneau du nom ouvert, texte par défaut', !popNom.classList.contains('hidden')
    && popNom.querySelector('#vue-nom-aide').textContent === 'Reprend les filtres et le tri affichés.',
    popNom.querySelector('#vue-nom-aide').textContent);
  popNom.querySelector('#vue-nom').value = 'Les a';
  popNom.querySelector('input[name="vue-portee"][value="partagee"]').checked = true;
  popNom.querySelector('#vue-nom-valider').click();
  await attendre(20);
  const lesA = R.toutes().find(v => v.nom === 'Les a');
  ok('mini : vue créée, active, avec ses filtres', lesA && R.activeId() === lesA.id && lesA.filtres[0].valeurs[0] === 'a');
  ok('mini : écrite comme vue partagée', journal.ecrites.at(-1)?.some(v => v.nom === 'Les a'));
  ok('mini : le widget a appliqué la vue et redessiné', journal.appliquees > 0 && journal.redessins > 0);
  ok('mini : message de création', journal.messages.some(m => m.includes('« Les a » créée')), journal.messages.join(' / '));
  ok('mini : onglet actif avec ⋯', onglets().join('|') === 'Toutes les cartes|Les a' && zoneVues.querySelector('.active .vue-menu-btn'), onglets().join('|'));
  ok('mini : « 🔽 1 filtre »', zoneResumes.firstElementChild.textContent === '🔽 1 filtre', zoneResumes.firstElementChild.textContent);

  // ── Fenêtre : photographie, Annuler ──
  const dialogue = UI.fenetre.element;
  UI.ouvrirFenetre('vue');
  ok('mini : fenêtre ouverte sur le nom de la vue', dialogue.open && dialogue.querySelector('#fv-nom').value === 'Les a');
  ok('mini : compteur « 2 cartes sur 3 »', dialogue.querySelector('#fv-compteur').textContent === '2 cartes sur 3', dialogue.querySelector('#fv-compteur').textContent);
  etat.filtres = [];
  UI.majFenetre();
  ok('mini : filtre retiré, fenêtre marquée modifiée', dialogue.classList.contains('modifiee'));
  UI.fenetre.fermer({ forcer: true });
  ok('mini : Annuler restaure les filtres', etat.filtres.length === 1 && etat.filtres[0].valeurs[0] === 'a');
  ok('mini : … et les champs propres du widget', journal.restaurees.join() === 'photo-propre');

  // ── Fenêtre : 💾 ──
  UI.ouvrirFenetre('vue');
  dialogue.querySelector('#fv-nom').value = 'Les a, triées';
  etat.tri = [{ col: 'P', sens: 'desc' }];
  UI.enregistrerFenetre();
  await attendre(20);
  ok('mini : 💾 écrit nom et tri dans la vue', lesA.nom === 'Les a, triées' && lesA.tri[0]?.sens === 'desc');
  ok('mini : fenêtre fermée, rien restauré', !dialogue.open && journal.restaurees.length === 1);

  // ── Depuis « Toutes les cartes » : 💾 crée une vue perso ──
  UI.afficher(Vues.DEFAUT);
  ok('mini : retour à « Toutes les cartes », sans filtre', R.activeId() === Vues.DEFAUT && etat.filtres.length === 0);
  UI.ouvrirFenetre();
  ok('mini : « Toutes les cartes » : bouton « comme nouvelle vue »',
    dialogue.querySelector('.fenetre-pied .btn-primary').textContent === '💾 Enregistrer comme nouvelle vue');
  etat.filtres = [{ col: 'P', op: 'est', valeurs: ['b'] }];
  dialogue.querySelector('#fv-nom').value = 'Les b';
  UI.enregistrerFenetre();
  await attendre(20);
  const lesB = R.toutes().find(v => v.nom === 'Les b');
  ok('mini : nouvelle vue perso, active', lesB?.perso && R.activeId() === lesB.id);
  ok('mini : retenue par le navigateur sous la clé du widget', (localStorage.getItem('mini.vuesPerso') || '').includes('Les b'));

  // ── Menu ⋯ : supprimer en deux clics ──
  zoneVues.querySelector('.active .vue-menu-btn').click();
  const menu = [...document.querySelectorAll('#vue-menu-popover')].pop();
  ok('mini : menu ⋯ ouvert, sans « Copier » sur une vue perso', !menu.classList.contains('hidden') && menu.querySelector('#vue-menu-copier').hidden);
  menu.querySelector('#vue-menu-supprimer').click();
  ok('mini : premier clic : confirmation demandée', R.toutes().includes(lesB) && /confirmer/.test(menu.querySelector('#vue-menu-supprimer').textContent));
  menu.querySelector('#vue-menu-supprimer').click();
  ok('mini : second clic : vue supprimée, « Toutes les cartes »', !R.toutes().includes(lesB) && R.activeId() === Vues.DEFAUT);

  // ── Le Kanban n'a pas été touché ──
  ok('Kanban : toujours sur « Toutes les cartes », ses 4 cartes', STATE.activeView === DEFAUT && Banc.cartes().length === 4);
  ok('Kanban : aucune vue créée par le mini-widget', STATE.vues.length === 0);

  // ── Dans le Kanban : construit par le module ──
  ok('Kanban : barre construite par vues.js', $('#view-tabs #vues-enregistrees') && $('#view-tabs #vue-ajouter')
    && $('#resumes-vue').firstElementChild.id === 'filtres-bouton');
  ok('Kanban : bulle d\'aide propre au Kanban', $('#vues-enregistrees .vue-enregistree').title === 'Toutes les cartes du projet');
  ouvrirFenetreVue();
  const libelles = [...fenetreVue.element.querySelectorAll('.fenetre-onglet')].map(b => b.textContent.replace(/[✓⚠️ℹ️]/gu, '').trim());
  ok('Kanban : onglets Vue, Filtres, puis Tri et Colonnes du Kanban',
    libelles.join('|') === 'Vue|Filtres|Tri|Colonnes', libelles.join('|'));
  fenetreVue.fermer({ forcer: true });
  $('#vue-ajouter').click();
  ok('Kanban : texte « … et les colonnes »', $('#vue-nom-aide').textContent === 'Reprend les filtres, le tri et les colonnes affichés.',
    $('#vue-nom-aide').textContent);
});
