// Anciens textes du widget Notepad (JSON) : affichés convertis, bandeau qui
// propose de les réécrire en Markdown dans Grist, une fois pour toutes.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, $ } = Banc;

  ok('bandeau visible', !$('#bandeau-notepad').hidden);
  ok('bandeau : un texte à convertir', $('#bandeau-notepad-texte').textContent.startsWith('1 texte au format'),
    $('#bandeau-notepad-texte').textContent);

  ouvrirFiche(2);
  await Banc.attendre(100);
  const rendu = $('.fiche-md-rendu')?.textContent || '';
  ok('fiche : texte affiché converti', rendu.includes('Ancien texte') && !rendu.includes('"ops"'), JSON.stringify(rendu));
  fermerFiche();

  // « Annuler » à la confirmation : rien n'est écrit
  Banc.repondre(false);
  let avant = FAUX_GRIST.actions.length;
  $('#bandeau-notepad-bouton').click();
  await Banc.attendre(300);
  ok('« Annuler » : confirmation demandée', Banc.confirmations.length === 1);
  ok('« Annuler » : rien d\'écrit', FAUX_GRIST.actions.length === avant);

  // Confirmé : une seule action pour toute la conversion (un Ctrl+Z l'annule)
  Banc.repondre(true);
  avant = FAUX_GRIST.actions.length;
  $('#bandeau-notepad-bouton').click();
  await Banc.attendre(400);
  const actions = FAUX_GRIST.actions.slice(avant);
  const action = actions[0] && actions[0][0];
  ok('conversion : une seule écriture', actions.length === 1 && actions[0].length === 1, JSON.stringify(actions));
  ok('conversion : BulkUpdateRecord de la ligne 2', action && action[0] === 'BulkUpdateRecord'
    && action[1] === 'EPICs' && JSON.stringify(action[2]) === '[2]', JSON.stringify(action));
  ok('conversion : texte en Markdown', action && String(action[3].Description[0]).trim() === 'Ancien texte',
    JSON.stringify(action && action[3]));
  ok('conversion : bandeau masqué', $('#bandeau-notepad').hidden);
  ok('conversion : message', $('#toast').textContent.includes('converti'), $('#toast').textContent);
});
