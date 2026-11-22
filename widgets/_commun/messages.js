/* ══════════════════════════════════════════════════════════════
   MESSAGES — petit message temporaire (toast) et questions d'abandon,
   communs aux widgets (#249, étape D, règle R5).

   Avant, chaque widget avait sa copie de la fonction du toast, et ses
   propres textes de confirmation (« … Continuer ? », où l'on ne savait pas
   si « OK » gardait ou jetait la saisie). Ici, un seul code et une seule
   formulation : la question finit toujours par « … Les abandonner ? ».

   UTILISATION
     Messages.toast('✓ Carte créée');               // 2,2 s par défaut
     Messages.toast('⚠️ Erreur : …', 5000);         // durée en millisecondes
     Messages.reglagesAppliques();                  // après « Appliquer » de ⚙
     if (!Messages.abandonner('fiche')) return;     // true : on abandonne

   Objets de Messages.abandonner : 'fiche', 'texte', 'fenetre', 'vue'.

   DÉPENDANCES : la feuille de style ../_commun/messages.css, et un élément
   <div id="toast" class="toast"></div> dans la page (créé ici s'il manque).
   Le toast n'affiche que du texte (textContent) : un nom venu de Grist ne
   peut pas y être lu comme du HTML.
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Questions d'abandon, une par sorte de saisie
  const QUESTIONS = {
    fiche:   'Les modifications de cette fiche ne sont pas sauvegardées. Les abandonner ?',
    texte:   'Le texte modifié n\'est pas sauvegardé. L\'abandonner ?',
    fenetre: 'Les modifications de cette fenêtre ne sont pas appliquées. Les abandonner ?',
    vue:     'Les modifications de cette vue ne sont pas enregistrées. Les abandonner ?',
  };

  // Message après « Appliquer » dans ⚙ : les options du widget ne sont
  // gardées dans le document qu'après le bouton « Enregistrer » de Grist.
  const REGLAGES_APPLIQUES = '✓ Réglages appliqués — cliquez sur « Enregistrer » dans Grist pour les garder';

  // Barres du bas que le toast ne doit jamais cacher : pied de la fiche
  // (Galerie, Page, Interactions ; Kanban), pied d'une fenêtre ouverte,
  // barre « Texte modifié » de la Page.
  const PIEDS = '.fiche-panneau-pied, .edit-panel-footer, .fenetre[open] .fenetre-pied, .barre-sauver';
  // Hauteur par défaut (px depuis le bas) et écart au-dessus d'une barre
  const BAS_DEFAUT = 70;
  const ECART = 12;

  let minuterie = null;

  /**
   * Distance au bas de l'écran où poser le toast : 70 px, ou plus haut si
   * une barre du bas visible monterait jusque-là (fiche au centre sur un
   * écran peu haut, par exemple). Une barre cachée (fiche fermée, hors de
   * l'écran ou masquée) ne compte pas.
   */
  function hauteurLibre() {
    const hauteur = window.innerHeight;
    let bas = BAS_DEFAUT;
    document.querySelectorAll(PIEDS).forEach((pied) => {
      // Pied d'une fiche : seulement si elle est ouverte (pendant son
      // animation de fermeture, elle déborde encore dans l'écran)
      const fiche = pied.closest('.fiche-panneau, .edit-panel');
      if (fiche && !fiche.classList.contains('open')) return;
      const r = pied.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.top < hauteur && r.bottom > 0
        && r.left < window.innerWidth && r.right > 0 && getComputedStyle(pied).visibility !== 'hidden';
      if (visible) bas = Math.max(bas, hauteur - r.top + ECART);
    });
    return bas;
  }

  /** L'élément du toast : celui de la page, ou un nouveau s'il n'y en a pas. */
  function element() {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    return t;
  }

  /** Affiche `texte` en bas de l'écran pendant `duree` millisecondes. */
  function toast(texte, duree = 2200) {
    const t = element();
    t.style.bottom = `${hauteurLibre()}px`;
    t.textContent = texte;
    t.classList.add('visible');
    clearTimeout(minuterie);
    minuterie = setTimeout(() => t.classList.remove('visible'), duree);
  }

  /** Rappel d'« Enregistrer » de Grist après « Appliquer » (règle R3). */
  function reglagesAppliques() {
    toast(REGLAGES_APPLIQUES, 5000);
  }

  /**
   * Demande s'il faut abandonner une saisie. Renvoie true si l'on abandonne.
   * Fenêtre confirm() du navigateur : « OK » abandonne, « Annuler » garde.
   */
  function abandonner(objet) {
    return window.confirm(QUESTIONS[objet] || QUESTIONS.fiche);
  }

  window.Messages = { toast, reglagesAppliques, abandonner, QUESTIONS, REGLAGES_APPLIQUES };
})();
