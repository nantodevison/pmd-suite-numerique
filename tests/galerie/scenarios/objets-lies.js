// En-tête de la fiche (#184) : encart Contexte souple (largeur naturelle de
// chaque paire), objets liés avec leurs attributs (« Afficher ▾ », même
// mémoire que les filtres), triés selon l'ordre des choix de Grist, bulle
// avec tous les attributs, liste limitée à 2 lignes et « + n autres ▾ »
// (liste complète avec recherche), objet de la même table ouvert dans sa
// fiche (confirmation si la carte est modifiée, carte non envoyée).
//
// Données du faux Grist : carte 1, Tâches « Rédiger le guide » (Fait) et
// « Relire le guide » (En cours), colonne rapportée Taches_statut non
// associée ; carte 2, Voir aussi → carte 4 « Carte en erreur ».
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $, $$ } = Banc;
  const ligneDe = (libelle) => $$('#fiche-corps .fiche-lies').find(l => l.querySelector('.fiche-lies-libelle').textContent === libelle);
  const noms = (ligne) => [...ligne.querySelectorAll('.fiche-lie')].filter(p => !p.hidden)
    .map(p => p.querySelector('.fiche-lie-nom').textContent).join(',');
  const lectures = FAUX_GRIST.lectures.length;

  ouvrirFiche(1);
  await attendre(100);

  // ── 1. Encart Contexte souple ──
  const contexte = $('#fiche-corps .fiche-contexte');
  ok('encart Contexte : paires côte à côte (flex), plus de grille fixe', getComputedStyle(contexte).display === 'flex',
    getComputedStyle(contexte).display);
  ok('une enveloppe par paire « libellé : valeur »', $$('#fiche-corps .fiche-contexte-paire').length === 2
    && $$('#fiche-corps .fiche-contexte-paire').every(p => p.querySelector('dt') && p.querySelector('dd')));

  // ── 2. Objets liés, sans attribut affiché ──
  let taches = ligneDe('Tâches');
  ok('objets liés sous l\'en-tête, hors de la colonne du titre', !taches.closest('.fiche-entete')
    && taches.closest('.fiche-lies-zone')?.previousElementSibling?.classList.contains('fiche-entete'));
  ok('… sur toute la largeur de la fiche', Math.abs(taches.offsetWidth - $('#fiche-corps .fiche-entete').offsetWidth) <= 2,
    `${taches.offsetWidth} / ${$('#fiche-corps .fiche-entete').offsetWidth}`);
  ok('ligne de titre : libellé, nombre total, « Afficher ▾ » à la fin',
    [...taches.querySelector('.fiche-lies-tete').children].map(e => e.className.split(' ')[0]).join()
      === 'fiche-lies-libelle,fiche-lies-nombre,fiche-lies-afficher'
    && taches.querySelector('.fiche-lies-nombre').textContent === '2');
  ok('Tâches : dans l\'ordre de Grist, sans attribut', noms(taches) === 'Rédiger le guide,Relire le guide'
    && !taches.querySelector('.fiche-lie-attributs'), noms(taches));
  ok('« Afficher ▾ » proposé (colonne rapportée Taches_statut, non associée)',
    taches.querySelector('.fiche-lies-afficher')?.textContent === 'Afficher ▾');
  ok('bulle : tous les attributs avec leur libellé, même non cochés',
    taches.querySelector('.fiche-lie').title === 'Rédiger le guide\nStatut : Fait', taches.querySelector('.fiche-lie').title);
  ok('tâches d\'une autre table : non cliquables', taches.querySelector('.fiche-lie').tagName === 'SPAN');

  // ── 3. « Afficher ▾ » : statut à côté du nom, tri, couleurs ──
  taches.querySelector('.fiche-lies-afficher').click();
  await attendre(50);
  const caseStatut = [...document.querySelectorAll('.fiche-menu .fiche-menu-item')]
    .find(l => l.textContent.includes('Statut'))?.querySelector('input');
  ok('menu : l\'attribut « Statut »', Boolean(caseStatut));
  caseStatut.checked = true;
  caseStatut.dispatchEvent(new Event('change'));
  await attendre(50);
  Fiche.fermerMenu();
  taches = ligneDe('Tâches');
  ok('bouton « Afficher (1) ▾ » actif', taches.querySelector('.fiche-lies-afficher').textContent === 'Afficher (1) ▾'
    && taches.querySelector('.fiche-lies-afficher').classList.contains('actif'));
  ok('tri selon l\'ordre des choix de Grist : En cours avant Fait', noms(taches) === 'Relire le guide,Rédiger le guide', noms(taches));
  const attributs = [...taches.querySelectorAll('.fiche-lie-attributs')].map(z => z.textContent).join('|');
  ok('statut affiché à côté de chaque tâche', attributs === 'En cours|Fait', attributs);
  const fait = [...taches.querySelectorAll('.fiche-attribut-pastille')].find(p => p.textContent === 'Fait');
  ok('« Fait » aux couleurs de la colonne d\'origine', fait?.style.background === 'rgb(198, 246, 213)', fait?.style.background);
  ok('choix retenu par le navigateur, même clé que les filtres',
    (localStorage.getItem('galerie.attributs.doc-invente.EPICs') || '').includes('Taches_statut'));
  ok('aucune table lue pour les attributs (données déjà reçues)', !FAUX_GRIST.lectures.slice(lectures).some(t => t !== 'EPICs'),
    FAUX_GRIST.lectures.slice(lectures).join());

  // ── 4. Longue liste : 2 lignes, puis « + n autres ▾ » ──
  const t = FAUX_GRIST.donnees.Taches;
  for (let i = 10; i < 40; i++) { t.id.push(i); t.Nom.push(`Tâche inventée ${i}`); t.statut.push('À faire'); }
  await grist.docApi.applyUserActions([['UpdateRecord', 'EPICs', 1, {
    Taches: ['L', 1, 2, ...t.id.slice(3)],
    Taches_statut: ['L', 'Fait', 'En cours', ...t.statut.slice(3)],
  }]]);
  await attendre(300);
  const deuxLignes = () => {
    const l = ligneDe('Tâches');
    const visibles = [...l.querySelectorAll('.fiche-lie, .fiche-lies-plus')].filter(e => !e.hidden);
    return new Set(visibles.map(e => e.offsetTop)).size;
  };
  taches = ligneDe('Tâches');
  const plus = taches.querySelector('.fiche-lies-plus');
  const caches = [...taches.querySelectorAll('.fiche-lie')].filter(p => p.hidden).length;
  ok('nombre total : 32', taches.querySelector('.fiche-lies-nombre').textContent === '32');
  ok('32 tâches : certaines masquées', taches.querySelectorAll('.fiche-lie').length === 32 && caches > 0, String(caches));
  ok('« + n autres ▾ » visible, n = tâches masquées', !plus.hidden && plus.textContent === `+ ${caches} autres ▾`, plus.textContent);
  ok('tout tient sur 2 lignes, bouton compris', deuxLignes() === 2, String(deuxLignes()));
  ok('les tâches « À faire » d\'abord (ordre des choix)', noms(taches).startsWith('Tâche inventée 10'), noms(taches).slice(0, 40));

  plus.click();
  await attendre(50);
  const menu = document.querySelector('.fiche-menu.fiche-menu-recherche');
  ok('« + n autres ▾ » : liste complète avec recherche', menu && menu.querySelectorAll('.fiche-menu-item').length === 32);
  const saisie = menu.querySelector('.fiche-menu-saisie');
  saisie.value = 'relire';
  saisie.dispatchEvent(new Event('input'));
  const trouvee = menu.querySelector('.fiche-menu-item');
  ok('recherche « relire » : une tâche, avec son statut', menu.querySelectorAll('.fiche-menu-item').length === 1
    && trouvee.textContent === 'Relire le guideEn cours', trouvee?.textContent);
  Fiche.fermerMenu();

  // Fiche au centre : presque tout le cadre du widget
  if (Fiche.disposition(panneau()) !== 'centre') $('#fiche .fiche-bascule').click();
  await attendre(100);
  ok('fiche au centre : tout le cadre moins 32 px', Math.abs(panneau().offsetWidth - (window.innerWidth - 32)) <= 2
    && Math.abs(panneau().offsetHeight - (window.innerHeight - 32)) <= 2,
    `${panneau().offsetWidth}x${panneau().offsetHeight} pour ${window.innerWidth}x${window.innerHeight}`);
  $('#fiche .fiche-bascule').click();
  await attendre(100);
  // (Largeur changée, fiche au centre ⇄ sur le côté : nouveau repli par
  // ResizeObserver, que le banc ne peut pas vérifier — Chrome y tourne en
  // temps virtuel, sans dessiner d'images. À vérifier dans le builder.)

  // ── 5. Objet de la même table : sa fiche s'ouvre ──
  FAUX_GRIST.associer({ ObjetsLies: ['Taches', 'Voir_aussi'] });
  await attendre(100);
  ouvrirFiche(2);
  await attendre(100);
  const lien = ligneDe('Voir aussi')?.querySelector('.fiche-lie');
  ok('Voir aussi (même table) : élément cliquable', lien?.tagName === 'BUTTON' && lien.textContent === 'Carte en erreur', lien?.textContent);

  // Carte modifiée : confirmation ; refusée, on reste
  const titre = $('#fiche-corps .fiche-titre');
  titre.value = 'Titre changé';
  titre.dispatchEvent(new Event('input'));
  const confirmer = window.confirm;
  window.confirm = () => false;
  ligneDe('Voir aussi').querySelector('.fiche-lie').click();
  await attendre(150);
  ok('carte modifiée, confirmation refusée : on reste sur la carte 2', ETAT.fiche.id === 2);
  window.confirm = () => true;
  ligneDe('Voir aussi').querySelector('.fiche-lie').click();
  await attendre(150);
  window.confirm = confirmer;
  ok('confirmation acceptée : fiche de la carte 4', ETAT.fiche.id === 4
    && $('#fiche-corps .fiche-titre').value === 'Carte en erreur', String(ETAT.fiche.id));

  // Carte liée que Grist n'envoie pas (« Sélectionner par ») : message
  ouvrirFiche(2);
  await attendre(100);
  ETAT.lignes = ETAT.lignes.filter(l => l.id !== 4);
  ligneDe('Voir aussi').querySelector('.fiche-lie').click();
  await attendre(150);
  ok('carte liée non envoyée par Grist : message, la fiche reste', ETAT.fiche.id === 2
    && $('#toast').textContent.includes('pas envoyée à la Galerie'), $('#toast').textContent);
  fermerFiche(true);
  FAUX_GRIST.associer({});
  await attendre(100);

  // ── Même mémoire dans le panneau des filtres ──
  $('#filtres-bouton').click();
  $('#filtre-ajouter').click();
  const colonne = $('#filtre-colonne');
  colonne.value = 'Taches';
  colonne.dispatchEvent(new Event('change'));
  await attendre(50);
  const relire = $$('#filtre-valeurs .filtre-valeur').find(v => v.textContent.includes('Relire le guide'));
  ok('filtres : le statut coché dans la fiche y est aussi affiché',
    relire?.querySelector('.filtre-valeur-detail').textContent === 'En cours', relire?.textContent);
  UI_VUES.fenetre.fermer({ forcer: true });
});
