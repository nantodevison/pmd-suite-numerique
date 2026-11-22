// Toast et questions d'abandon communs (../_commun/messages.js, #249 étape D) :
// toast à 70 px du bas, visible puis effacé, texte jamais lu comme du HTML ;
// questions « … Les abandonner ? » de la fiche et de la fenêtre ⚙ ;
// message unique après « Appliquer ».
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $ } = Banc;

  // 1. Toast : style commun, durée, texte seul
  Messages.toast('<img src=x onerror="window.PIEGE_TOAST=1">', 300);
  const t = $('#toast');
  ok('toast : un seul élément #toast, visible', document.querySelectorAll('.toast').length === 1 && t.classList.contains('visible'));
  ok('toast : à 70 px du bas (au-dessus du pied de la fiche)', getComputedStyle(t).bottom === '70px', getComputedStyle(t).bottom);
  await attendre(100);
  ok('toast : texte affiché tel quel, sans balise', t.textContent.startsWith('<img') && !t.querySelector('img') && window.PIEGE_TOAST === undefined);
  await attendre(400);
  ok('toast : effacé après la durée demandée', !t.classList.contains('visible'));
  ok('afficherToast de la Galerie passe par le module', (afficherToast('essai'), t.textContent === 'essai' && t.classList.contains('visible')));

  // 1 bis. Fiche ouverte : le toast se pose au-dessus de son pied, qu'elle
  // soit sur le côté ou au centre (écran peu haut, retour du 2026-11-22)
  const pied = () => $('#fiche .fiche-panneau-pied');
  const auDessus = () => t.getBoundingClientRect().bottom <= pied().getBoundingClientRect().top;
  ouvrirFiche(1);
  await attendre(400);   // fin de l'animation d'ouverture
  Messages.toast('Essai côté');
  ok('toast : au-dessus du pied de la fiche ouverte sur le côté', auDessus(),
    `${t.getBoundingClientRect().bottom} / ${pied().getBoundingClientRect().top}`);
  $('#fiche').classList.add('fiche-centre');
  await attendre(100);
  Messages.toast('Essai centre');
  ok('toast : au-dessus du pied de la fiche au centre', auDessus(),
    `${t.getBoundingClientRect().bottom} / ${pied().getBoundingClientRect().top}`);
  $('#fiche').classList.remove('fiche-centre');
  fermerFiche(true);
  Messages.toast('Essai sans fiche');
  ok('toast : fiche fermée, retour à 70 px du bas', t.style.bottom === '70px', t.style.bottom);

  // 2. Fiche modifiée puis fermée : question commune
  ouvrirFiche(1);
  await attendre(100);
  const titre = $('#fiche-corps .fiche-titre');
  titre.value = 'Titre changé';
  titre.dispatchEvent(new Event('input'));
  const avant = Banc.confirmations.length;
  Banc.repondre(false);
  fermerFiche();
  ok('fiche : « Les modifications de cette fiche ne sont pas sauvegardées. Les abandonner ? »',
    Banc.confirmations.length === avant + 1
    && Banc.confirmations.at(-1) === 'Les modifications de cette fiche ne sont pas sauvegardées. Les abandonner ?',
    Banc.confirmations.at(-1));
  ok('fiche : « Annuler » garde la saisie', $('#fiche').classList.contains('open') && titre.value === 'Titre changé');
  Banc.repondre(true);
  fermerFiche();
  ok('fiche : « OK » abandonne', !$('#fiche').classList.contains('open'));

  // 3. Fenêtre ⚙ modifiée, Échap : question commune de fenetre.js
  ouvrirReglages();
  $('#reglages-nom').value = 'Brouillon';
  $('#reglages-nom').dispatchEvent(new Event('input', { bubbles: true }));
  Banc.repondre(true);
  $('#reglages').dispatchEvent(new Event('cancel', { cancelable: true }));
  ok('⚙ : « Les modifications de cette fenêtre ne sont pas appliquées. Les abandonner ? »',
    Banc.confirmations.at(-1) === 'Les modifications de cette fenêtre ne sont pas appliquées. Les abandonner ?'
    && !$('#reglages').open, Banc.confirmations.at(-1));

  // 4. Message après « Appliquer » : le même dans les quatre widgets
  ok('message après « Appliquer » commun', Messages.REGLAGES_APPLIQUES
    === '✓ Réglages appliqués — cliquez sur « Enregistrer » dans Grist pour les garder');
});
