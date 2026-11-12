// Règle des filtres (../_commun/filtres.js, #191) : vérifiée directement sur
// le module (données inventées), puis dans le Kanban, avec « 👤 Moi » (#202).
Banc.lancer(async () => {
  const { ok } = Banc;
  await Banc.demarrer();
  const F = Filtres;

  // ── Valeurs d'une cellule ──
  ok('cellule vide : null, \'\', espaces, [] et 0', [null, '', '   ', [], 0].every(v => F.valeursCellule(v).length === 0));
  ok('espaces en trop retirés, doublons fusionnés',
    F.valeursCellule([' Alice  Durand ', 'Alice Durand', 'Bruno']).join('|') === 'Alice Durand|Bruno',
    F.valeursCellule([' Alice  Durand ', 'Alice Durand', 'Bruno']).join('|'));
  ok('majuscules conservées', F.valeursCellule(['Fait', 'fait']).length === 2);

  // ── Règle ──
  const ligne = { Priorite: 'Haute', qui_: ['Alice Durand', 'Bruno'], EPIC: null };
  const filtre = (col, op, valeurs) => ({ col, op, valeurs });
  ok('« est » : une valeur cochée suffit', F.ligneRespecte(ligne, filtre('Priorite', 'est', ['Basse', 'Haute'])));
  ok('« est » : aucune valeur cochée portée', !F.ligneRespecte(ligne, filtre('Priorite', 'est', ['Basse'])));
  ok('« n\'est pas »', !F.ligneRespecte(ligne, filtre('Priorite', 'nestpas', ['Haute'])));
  ok('liste : l\'une des valeurs suffit', F.ligneRespecte(ligne, filtre('qui_', 'est', ['Bruno'])));
  ok('(vide) : cellule vide', F.ligneRespecte(ligne, filtre('EPIC', 'est', [F.VIDE])));
  ok('(vide) : cellule remplie', !F.ligneRespecte(ligne, filtre('Priorite', 'est', [F.VIDE])));
  ok('condition sans valeur cochée : ignorée', F.ligneRespecte(ligne, filtre('Priorite', 'nestpas', [])));
  ok('remplacer : valeur spéciale traduite avant la comparaison',
    F.ligneRespecte(ligne, filtre('qui_', 'est', ['@moi']), v => v.map(x => x === '@moi' ? 'Bruno' : x)));

  // ── Valeurs proposées ──
  const lignes = [{ P: 'Haute' }, { P: 'basse' }, { P: null }, { P: 'Haute' }, { P: 'Élevée' }];
  const proposees = F.valeursProposees(lignes, 'P', ['Ancienne', '@moi'], ['@moi']);
  ok('(vide) en tête, puis ordre alphabétique français',
    proposees.map(p => p.valeur || '(vide)').join('|') === '(vide)|Ancienne|basse|Élevée|Haute', proposees.map(p => p.valeur).join('|'));
  ok('nombre de lignes par valeur', proposees.find(p => p.valeur === 'Haute').nb === 2 && proposees.find(p => p.valeur === '').nb === 1);
  ok('valeur cochée absente des lignes : proposée avec 0', proposees.find(p => p.valeur === 'Ancienne')?.nb === 0);
  ok('valeur spéciale : laissée au widget', !proposees.some(p => p.valeur === '@moi'));
  const selonChoix = F.valeursProposees(lignes, 'P', ['Ancienne'], [], ['Haute', 'basse']);
  ok('#236 : (vide), puis les choix dans l\'ordre de Grist, puis les autres de A à Z',
    selonChoix.map(p => p.valeur || '(vide)').join('|') === '(vide)|Haute|basse|Ancienne|Élevée', selonChoix.map(p => p.valeur).join('|'));

  // ── Copie et signature (vues) ──
  const originaux = [filtre('P', 'est', ['b', 'a']), filtre('Q', 'est', [])];
  const copie = F.copier(originaux);
  copie[0].valeurs.push('c');
  ok('copie indépendante', originaux[0].valeurs.length === 2);
  ok('signature : ordre des valeurs et filtres vides ignorés',
    F.signature(originaux) === F.signature([filtre('P', 'est', ['a', 'b'])]));

  // ── Attributs ──
  ok('date d\'attribut en jj/mm/aaaa', F.texteAttribut(1767225600, 'Date') === '01/01/2026', F.texteAttribut(1767225600, 'Date'));
  ok('case cochée : ✓, liste : virgules', F.texteAttribut(true, 'Bool') === '✓' && F.texteAttribut(['a', 'b'], 'Any') === 'a, b');
  const cartes = [
    { qui_: ['L', 'Alice', 'Bruno'], qui__Equipe: ['L', 'Études', 'Terrain'], EPIC: 'E1', EPIC_P: 'Now' },
    { qui_: ['Alice'], qui__Equipe: ['Études'], EPIC: 'E1', EPIC_P: 'Then' },
  ];
  const parPersonne = F.morceauxParValeur(cartes, 'qui_', [{ colId: 'qui__Equipe', type: 'Any' }]);
  ok('liste de références : attribut apparié personne par personne',
    F.texteMorceaux(parPersonne.get('Alice')) === 'Études' && F.texteMorceaux(parPersonne.get('Bruno')) === 'Terrain');
  const parEpic = F.morceauxParValeur(cartes, 'EPIC', [{ colId: 'EPIC_P', type: 'Choice' }],
    (col, texte) => texte === 'Now' ? { fond: '#000', texte: '#fff' } : null);
  ok('cartes en désaccord : toutes les valeurs données', F.texteMorceaux(parEpic.get('E1')) === 'Now, Then', F.texteMorceaux(parEpic.get('E1')));
  ok('couleur du choix transmise', parEpic.get('E1')[0][0].style?.fond === '#000' && parEpic.get('E1')[0][1].style === null);

  // ── Mémoire des attributs ──
  let cle = null;
  const memoire = F.memoireAttributs(() => cle);
  memoire.definir('EPIC', ['b', 'a', 'z'], ['a', 'b', 'c']);
  ok('clé inconnue : choix gardé pour la séance, dans l\'ordre des possibles', memoire.affiches('EPIC', ['a', 'b', 'c']).join() === 'a,b');
  ok('attribut disparu : ignoré', memoire.affiches('EPIC', ['b']).join() === 'b');
  cle = 'banc.attributs';
  ok('nouvelle clé : mémoire relue (vide)', memoire.affiches('EPIC', ['a', 'b']).length === 0);
  memoire.definir('EPIC', ['b'], ['a', 'b']);
  ok('choix retenu par le navigateur', JSON.parse(localStorage.getItem('banc.attributs') || '{}').EPIC?.join() === 'b');
  ok('relu par une autre mémoire sur la même clé', F.memoireAttributs(() => cle).affiches('EPIC', ['a', 'b']).join() === 'b');

  // ── Dans le Kanban : « 👤 Moi » (#202) ──
  STATE.moi = 2;   // Bruno Lefèvre, inventé dans le faux Grist
  const assigne = STATE.mapping.assigne;
  const valeurs = valeursProposees(assigne, []);
  ok('« 👤 Moi » en tête des valeurs d\'Assigné à', valeurs[0]?.valeur === MOI, valeurs.map(v => v.valeur).join('|'));
  ok('« 👤 Moi » : nombre de cartes de la personne déclarée',
    valeurs[0]?.nb === valeurs.find(v => v.valeur === 'Bruno Lefèvre')?.nb && valeurs[0]?.nb > 0, JSON.stringify(valeurs[0]));
  const filtreMoi = { col: assigne, op: 'est', valeurs: [MOI] };
  const siennes = STATE.records.filter(r => carteRespecte(r, filtreMoi)).map(r => r.id).join();
  ok('filtre « 👤 Moi » : les cartes de Bruno Lefèvre', siennes === '1,3', siennes);
  STATE.moi = null;
  ok('personne déclarée : aucune carte', STATE.records.filter(r => carteRespecte(r, filtreMoi)).length === 0);
  ok('valeur « 👤 Moi » cochée : jamais comptée comme une valeur des cartes',
    !valeursProposees(assigne, [MOI]).some((v, i) => i > 0 && v.valeur === MOI));

  // ── Panneau commun (Filtres.creerPanneau), dans « Gérer la vue » ──
  const $ = Banc.$;
  ouvrirFenetreVue('filtres');
  await Banc.attendre(200);
  ok('panneau construit par filtres.js dans l\'onglet Filtres', $('#fv-filtres #filtre-popover') && $('#fv-filtres #filtre-ajouter'));
  ajouterFiltre();
  const sel = $('#filtre-colonne');
  sel.value = 'Priorite'; sel.dispatchEvent(new Event('change'));
  await Banc.attendre(100);
  const noms = () => [...document.querySelectorAll('#filtre-valeurs .filtre-valeur-nom')].map(n => n.textContent);
  ok('#236 : valeurs d\'une colonne Choix dans l\'ordre de Grist', noms().join('|') === 'Haute|Moyenne|Basse', noms().join('|'));
  const pastille = $('#filtre-valeurs .filtre-valeur-pastille');
  ok('#236 : choix coloré dans Grist en pastille, à sa couleur',
    pastille && pastille.textContent === 'Haute' && getComputedStyle(pastille).backgroundColor === 'rgb(254, 202, 202)',
    pastille ? getComputedStyle(pastille).backgroundColor : 'aucune pastille');
  ok('#236 : choix sans couleur : texte simple', document.querySelectorAll('#filtre-valeurs .filtre-valeur-pastille').length === 1);
  // Cocher une valeur filtre les cartes ; l'étiquette résume le filtre
  const caseHaute = $('#filtre-valeurs .filtre-valeur input');
  caseHaute.checked = true; caseHaute.dispatchEvent(new Event('change'));
  await Banc.attendre(100);
  ok('cocher « Haute » : seule la carte #1 reste', Banc.cartes().join() === '1', Banc.cartes().join());
  ok('étiquette du filtre', ($('#filtres-actifs .filtre-chip')?.textContent || '').startsWith('Priorite est : Haute'),
    $('#filtres-actifs .filtre-chip')?.textContent);
  ok('bouton de la barre : « 🔽 1 filtre »', $('#filtres-bouton').textContent === '🔽 1 filtre', $('#filtres-bouton').textContent);
  $('#filtre-popover .filtre-op[data-op="nestpas"]').click();
  await Banc.attendre(100);
  ok('« n\'est pas » : les trois autres cartes', Banc.cartes().length === 3 && !Banc.cartes().includes(1), Banc.cartes().join());
  $('#filtre-supprimer').click();
  await Banc.attendre(100);
  ok('« Supprimer le filtre » : plus de filtre, quatre cartes', STATE.filters.length === 0 && Banc.cartes().length === 4);
  fenetreVue.fermer({ forcer: true });
});
