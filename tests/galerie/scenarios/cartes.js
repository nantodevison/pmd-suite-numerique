// Grille de cartes : titres, pastilles et leurs couleurs, compteur, message
// quand la colonne « Titre » n'est pas associée.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, $ } = Banc;

  ok('quatre cartes, dans l\'ordre de Grist', Banc.cartes().join() === '1,2,3,4', Banc.cartes().join());
  ok('compteur : 4', $('#compte').textContent === '4', $('#compte').textContent);
  ok('nom de la table en titre', $('#titre-table').textContent === '🖼️ EPICs', $('#titre-table').textContent);

  const carte = (id) => $(`.carte[data-id="${id}"]`);
  const pastilles = (id) => [...carte(id).querySelectorAll('.pastille')];
  const textes = (id) => pastilles(id).map(p => p.textContent);
  const fond = (id, texte) => pastilles(id).find(p => p.textContent === texte)?.style.background || '';

  ok('titre de la carte 1', carte(1).querySelector('.carte-titre').textContent === 'Écrire la documentation');
  ok('pastilles de la carte 1 : choix, pourcentage, référence par son nom',
    textes(1).join('|') === 'Now|67 %|Atelier', textes(1).join('|'));
  ok('pastille vide omise (carte 3 sans priorité)', textes(3).join('|') === '10 %|Vitrine', textes(3).join('|'));
  ok('libellé de la colonne au survol', pastilles(1)[0].title === 'Priorité : Now', pastilles(1)[0].title);

  // Couleurs
  ok('choix coloré dans Grist : sa couleur', fond(1, 'Now').includes('rgb(254, 202, 202)'), fond(1, 'Now'));
  ok('choix sans couleur dans Grist : un pastel', fond(2, 'Later') !== '', fond(2, 'Later'));
  // Échelle : rouge jusqu'à 33 %, orange jusqu'à 66 %, jaune-vert jusqu'à 99 %, vert à 100 %
  ok('67 % : jaune-vert', fond(1, '67 %').includes('rgb(236, 245, 198)'), fond(1, '67 %'));
  ok('100 % : vert', fond(2, '100 %').includes('rgb(198, 246, 213)'), fond(2, '100 %'));
  ok('10 % : rouge', fond(3, '10 %').includes('rgb(254, 215, 215)'), fond(3, '10 %'));
  ok('même référence, même couleur', fond(1, 'Atelier') !== '' && fond(1, 'Atelier') === fond(2, 'Atelier'));
  ok('référence différente, autre couleur', fond(3, 'Vitrine') !== fond(1, 'Atelier'));

  // Cellule en erreur (référence vers une ligne absente)
  const erreur = pastilles(4).find(p => p.classList.contains('pastille-erreur'));
  ok('cellule en erreur : « ⚠️ invalide »', erreur && erreur.textContent === '⚠️ invalide', textes(4).join('|'));

  // Pas d'aperçu du texte principal sur la carte
  ok('texte principal absent de la carte', !carte(1).textContent.includes('Sommaire'));

  // Sans colonne « Titre » associée : un message, et pas de nouvelle carte
  FAUX_GRIST.associer({ Titre: null });
  await Banc.attendre(300);
  ok('sans Titre : message d\'aide', ($('#grille .message')?.textContent || '').includes('Associez au moins la colonne « Titre »'));
  ok('sans Titre : aucune carte', Banc.cartes().length === 0);
  ok('sans Titre : « Nouvelle carte » désactivé', $('#btn-nouvelle').disabled);

  FAUX_GRIST.associer({});
  await Banc.attendre(300);
  ok('Titre associé de nouveau : quatre cartes', Banc.cartes().length === 4);
  ok('« Nouvelle carte » réactivé', !$('#btn-nouvelle').disabled);

  // Un clic sur une carte ouvre sa fiche et place le curseur de Grist sur sa ligne
  carte(3).click();
  await Banc.attendre(100);
  ok('clic : fiche ouverte', $('#fiche').classList.contains('open'));
  ok('clic : curseur de Grist sur la ligne 3', FAUX_GRIST.curseur?.rowId === 3, JSON.stringify(FAUX_GRIST.curseur));
  ok('aucune écriture dans Grist', FAUX_GRIST.actions.length === 0);

  // Lectures (#188) : la structure est lue une fois (../_commun/colonnes.js) ;
  // les tables visées par les références ne sont pas lues (Grist envoie les noms)
  const lectures = FAUX_GRIST.lectures;
  ok('structure lue une seule fois', lectures.filter(t => t === '_grist_Tables_column').length === 1, lectures.join());
  ok('tables visées non lues', !lectures.includes('Projets') && !lectures.includes('Taches'), lectures.join());
});
