// Fiche : en-tête (titre, objets liés, pastilles, contexte), texte principal,
// modification et sauvegarde, titre calculé en lecture seule, fermeture.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, $, $$ } = Banc;
  const textes = (sel) => $$(sel).map(e => e.textContent);
  const ouverte = () => $('#fiche').classList.contains('open');

  ouvrirFiche(1);
  await Banc.attendre(100);
  ok('fiche ouverte', ouverte());
  ok('libellé « Fiche »', $('#fiche-libelle').textContent === 'Fiche');
  const titre = $('#fiche-corps .fiche-titre');
  ok('titre modifiable', titre && titre.value === 'Écrire la documentation' && !titre.readOnly);

  // Objets liés : « Tâches » puis une pastille blanche par tâche
  ok('objets liés : libellé', textes('.fiche-lies-libelle').join() === 'Tâches', textes('.fiche-lies-libelle').join());
  ok('objets liés : une pastille par tâche',
    textes('.fiche-lies .fiche-liste-element').join('|') === 'Rédiger le guide|Relire le guide',
    textes('.fiche-lies .fiche-liste-element').join('|'));
  ok('pastilles dans l\'en-tête', textes('.fiche-entete-pastilles .pastille').join('|') === 'Now|67 %|Atelier',
    textes('.fiche-entete-pastilles .pastille').join('|'));
  ok('contexte : libellés', textes('.fiche-contexte dt').join('|') === 'Objectif|Échéance',
    textes('.fiche-contexte dt').join('|'));
  ok('contexte : valeurs, date au format français', textes('.fiche-contexte dd').join('|') === 'Guide publié|01/01/2026',
    textes('.fiche-contexte dd').join('|'));
  ok('texte principal : libellé de la colonne', $('.fiche-libelle-texte')?.textContent === 'Description');
  ok('texte principal : cases à cocher dans l\'aperçu', $$('.fiche-md-rendu input[type="checkbox"]').length === 2);

  // Carte 3 : contexte vide affiché « — », une seule tâche liée
  ouvrirFiche(3);
  await Banc.attendre(100);
  ok('contexte vide : « — »', textes('.fiche-contexte dd').join('|') === '—|—', textes('.fiche-contexte dd').join('|'));
  ok('objets liés de la carte 3', textes('.fiche-lies .fiche-liste-element').join('|') === 'Copier les pages');

  // Modification du titre, puis sauvegarde
  const zone = $('#fiche-corps .fiche-titre');
  ok('rien de modifié : « Sauvegarder » grisé', $('#fiche-sauver').disabled);
  zone.value = 'Archiver le site inventé';
  zone.dispatchEvent(new Event('input'));
  ok('modifié : indicateur visible', $('#fiche-modifie').classList.contains('visible'));
  ok('modifié : « Sauvegarder » actif', !$('#fiche-sauver').disabled);

  // Changer de carte avec des modifications : confirmation ; « Annuler » garde la fiche
  Banc.repondre(false);
  ouvrirFiche(1);
  ok('changer de carte : confirmation demandée', Banc.confirmations.length === 1);
  ok('« Annuler » : la fiche reste sur la carte 3', $('#fiche-corps .fiche-titre').value === 'Archiver le site inventé');
  Banc.repondre(true);

  const avant = FAUX_GRIST.actions.length;
  $('#fiche-sauver').click();
  await Banc.attendre(300);
  const action = Banc.actionsDepuis(avant)[0];
  ok('sauvegarde : UpdateRecord de la ligne 3', JSON.stringify(action) === JSON.stringify(
    ['UpdateRecord', 'EPICs', 3, { Titre: 'Archiver le site inventé' }]), JSON.stringify(action));
  ok('sauvegarde : carte mise à jour', $('.carte[data-id="3"] .carte-titre')?.textContent === 'Archiver le site inventé');
  ok('sauvegarde : plus rien de modifié', !$('#fiche-modifie').classList.contains('visible'));
  ok('sauvegarde : message', $('#toast').textContent.includes('Modifications sauvegardées'), $('#toast').textContent);

  // Échap ferme la fiche
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  ok('Échap : fiche fermée', !ouverte());

  // Titre calculé par une formule : lecture seule, signalée en clair
  FAUX_GRIST.associer({ Titre: 'Code' });
  await Banc.attendre(300);
  ok('titre calculé : affiché sur la carte', $('.carte[data-id="2"] .carte-titre')?.textContent === 'E2');
  ouvrirFiche(2);
  await Banc.attendre(100);
  ok('titre calculé : lecture seule', $('#fiche-corps .fiche-titre')?.readOnly === true);
  ok('titre calculé : note 🔒', ($('.fiche-titre-note')?.textContent || '').includes('🔒'));
  fermerFiche();
  ok('fermée sans modification : pas de confirmation', Banc.confirmations.length === 1 && !ouverte());
});
