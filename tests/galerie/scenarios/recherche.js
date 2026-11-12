// Recherche 🔍 (règle commune avec le Kanban, ../_commun/recherche.js) :
// majuscules et accents ignorés, tous les mots, #numéro, noms des références,
// toutes les colonnes reçues, textes Notepad lus convertis.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, $ } = Banc;

  async function chercher(texte) {
    const champ = $('#recherche');
    champ.value = texte;
    champ.dispatchEvent(new Event('input'));
    await Banc.attendre(300);   // la structure est lue à la première recherche
    return Banc.cartes().join();
  }

  ok('« documentation »', await chercher('documentation') === '1');
  ok('majuscules ignorées', await chercher('DOCUMENTATION') === '1');
  ok('accents ignorés : « ecrire »', await chercher('ecrire') === '1');
  ok('compteur « 1 / 4 »', $('#compte').textContent === '1 / 4', $('#compte').textContent);
  ok('tous les mots, dans n\'importe quel ordre', await chercher('site archiver') === '3');
  ok('un mot absent : aucune carte', await chercher('archiver documentation') === '');
  ok('« #2 » : la carte numéro 2', await chercher('#2') === '2');
  ok('nom d\'une référence (Projet)', await chercher('vitrine') === '3');
  ok('nom dans une liste de références (Tâches)', await chercher('relire') === '1');
  ok('colonne de contexte (Objectif)', await chercher('guide publie') === '1');
  ok('texte principal', await chercher('sommaire') === '1');
  ok('texte Notepad : cherché dans le texte', await chercher('ancien texte') === '2');
  ok('texte Notepad : pas dans son enveloppe JSON', await chercher('insert') === '');
  ok('aucune carte : message', ($('#grille .message')?.textContent || '').includes('Aucune carte ne correspond'));
  ok('recherche vidée : quatre cartes', await chercher('') === '1,2,3,4');
  ok('compteur « 4 »', $('#compte').textContent === '4', $('#compte').textContent);
});
