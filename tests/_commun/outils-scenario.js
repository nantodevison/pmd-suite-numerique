/* ══════════════════════════════════════════════════════════════
   OUTILS DES SCÉNARIOS — communs à tous les bancs d'essai (tests/<widget>/),
   chargés par banc.py avant chaque scénario
   ══════════════════════════════════════════════════════════════

   Un scénario s'écrit ainsi :

     Banc.lancer(async () => {
       await Banc.demarrer();                       // cartes et options du faux Grist
       Banc.ok('quatre cartes affichées', Banc.cartes().length === 4);
     });

   Banc.lancer écrit le bilan (« BILAN n OK, m KO » puis une ligne par
   vérification) dans <pre id="resultats">, que jouer.py lit.

   window.confirm est remplacé : il n'ouvre aucune fenêtre, note le message
   dans Banc.confirmations et répond ce que le scénario a choisi
   (Banc.repondre(true / false), « oui » par défaut).
   ══════════════════════════════════════════════════════════════ */
window.Banc = (function () {
  const lignes = [];
  let nbOk = 0, nbKo = 0;
  let reponse = true;
  const confirmations = [];

  window.confirm = (message) => { confirmations.push(String(message)); return reponse; };
  // Une erreur JavaScript du widget compte comme un échec : sinon le bilan
  // pourrait afficher « 0 KO » alors que le widget a planté.
  window.addEventListener('error', e => { nbKo++; lignes.push('KO  ERREUR JS ' + e.message); });
  window.addEventListener('unhandledrejection', e => {
    nbKo++;
    lignes.push('KO  PROMESSE REJETÉE ' + (e.reason && e.reason.message || e.reason));
  });

  const attendre = (ms) => new Promise(r => setTimeout(r, ms));

  return {
    attendre,
    confirmations,
    $:  (s) => document.querySelector(s),
    $$: (s) => [...document.querySelectorAll(s)],

    /** Note une vérification ; `detail` s'affiche après « — » (utile en cas d'échec). */
    ok(nom, condition, detail = '') {
      if (condition) nbOk++; else nbKo++;
      lignes.push(`${condition ? 'OK ' : 'KO '} ${nom}${detail !== '' ? ' — ' + detail : ''}`);
    },

    /** Réponse des prochains window.confirm. */
    repondre(oui) { reponse = oui; },

    /** Mémoire vide, cartes et options envoyées, mode d'emploi de première visite fermé. */
    async demarrer(options = {}) {
      localStorage.clear();
      FAUX_GRIST.demarrer(options);
      await attendre(800);
      document.querySelectorAll('dialog[open]').forEach(d => d.close());
    },

    /**
     * Numéros des cartes affichées, dans l'ordre (de gauche à droite, de haut
     * en bas). Cartes du Kanban (.card) ou de la Galerie (.carte) ; `statut`
     * limite à une colonne du Kanban.
     */
    cartes(statut) {
      const zone = statut ? document.querySelector(`.cards-list[data-statut="${statut}"]`) : document;
      return zone ? [...zone.querySelectorAll('.card, .carte')].map(c => Number(c.dataset.id)) : [];
    },

    /** Actions écrites dans le faux Grist depuis le rang `depuis` (voir FAUX_GRIST.actions.length). */
    actionsDepuis(depuis) {
      return FAUX_GRIST.actions.slice(depuis).flat();
    },

    /** Exécute le scénario, puis écrit le bilan. */
    async lancer(scenario) {
      try {
        await scenario();
      } catch (err) {
        nbKo++;
        lignes.push('EXCEPTION ' + err.stack);
      }
      const pre = document.createElement('pre');
      pre.id = 'resultats';
      pre.textContent = `BILAN ${nbOk} OK, ${nbKo} KO\n` + lignes.join('\n');
      document.body.appendChild(pre);
    },
  };
})();
