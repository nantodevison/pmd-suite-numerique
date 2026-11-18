/* ══════════════════════════════════════════════════════════════
   PASTILLES — brique commune aux widgets (Galerie, Page…)
   ══════════════════════════════════════════════════════════════

   Une « pastille » est une petite étiquette colorée qui montre la valeur
   d'une cellule (priorité, projet, avancement…). Ce module la DESSINE, en
   lecture seule ; la rendre cliquable (menus de choix) reste l'affaire de
   chaque widget (voir la Galerie).

   Il ne connaît AUCUN nom de table ni de colonne : on lui passe, avec la
   valeur, la description de la colonne, telle que la donne
   ../_commun/colonnes.js (Colonnes.lireDocument()…colonne(table, colId)) :
     { libelle, type, couleurs, pourcentage }
       libelle     : nom affiché de la colonne (bulle au survol) ;
       type        : type Grist ('Choice', 'Ref:Projets', 'Date'…) ;
       couleurs    : { texte du choix: { fond, texte } }, réglées dans Grist ;
       pourcentage : vrai si Grist affiche le nombre en %.

   Couleur d'une pastille :
     - choix coloré dans Grist → cette couleur ;
     - « 67 % »                → du rouge (peu avancé) au vert (terminé) ;
     - choix sans couleur, ou référence → un pastel propre à la valeur ;
     - autre colonne           → gris neutre ;
     - cellule en erreur       → « ⚠️ invalide » en rouge.

   DÉPENDANCES : ../_commun/fiche.js (chargé AVANT : Fiche.markdownVersTexte
   retire les symboles du Markdown d'un texte) et la feuille de style
   ../_commun/pastilles.css.

   UTILISATION (exemple)
     const colonne = doc.colonne(table, 'Priorite');
     Pastilles.creer(colonne, ligne.Priorite).forEach(p => zone.appendChild(p));
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Pourcentages : du rouge (peu avancé) au vert (terminé)
  const COULEURS_POURCENTAGE = [
    { jusqua: 33,  fond: '#fed7d7', texte: '#9b2c2c' },   // rouge
    { jusqua: 66,  fond: '#feebc8', texte: '#9c4221' },   // orange
    { jusqua: 99,  fond: '#ecf5c6', texte: '#4a6115' },   // jaune-vert
    { jusqua: 100, fond: '#c6f6d5', texte: '#22543d' },   // vert
  ];

  /**
   * Une cellule en erreur (par exemple une référence vers une ligne qui
   * n'existe pas : « InvalidTypedValue ») arrive soit comme un objet
   * { name, message, details }, soit « encodée » : ['E', nom, …].
   */
  function estErreur(v) {
    if (Array.isArray(v)) return v[0] === 'E';
    return Boolean(v) && typeof v === 'object' && !(v instanceof Date)
      && typeof v.name === 'string' && 'message' in v;
  }

  /**
   * Texte affiché d'une valeur simple (pas une liste), selon la description
   * de sa colonne.
   */
  function valeurSimple(colonne, v) {
    if (estErreur(v)) return '⚠️ invalide';
    if (v === null || v === undefined || v === '') return '';
    // Grist envoie une référence sous son nom affiché ; un numéro n'arrive que
    // si la référence n'affiche aucune colonne : on montre alors ce numéro.
    if (/^(Ref|RefList):/.test(colonne.type) && typeof v === 'number') {
      return v === 0 ? '' : String(v);   // 0 = référence vide
    }
    if (v instanceof Date) return v.toLocaleDateString('fr-FR');
    // Grist stocke les dates en secondes depuis le 1er janvier 1970
    if (colonne.type === 'Date' && typeof v === 'number') {
      return new Date(v * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
    }
    if (colonne.type.startsWith('DateTime') && typeof v === 'number') {
      return new Date(v * 1000).toLocaleString('fr-FR');
    }
    if (typeof v === 'boolean') return v ? '✓ oui' : '✗ non';
    // Nombre affiché en pourcentage dans Grist : 0.67 → « 67 % »
    if (colonne.pourcentage && typeof v === 'number') return `${Math.round(v * 100)} %`;
    if (typeof v === 'object') return JSON.stringify(v);   // cas rares (pièces jointes…)
    // Un texte peut contenir du Markdown : on en retire les symboles.
    return colonne.type === 'Text' ? Fiche.markdownVersTexte(String(v)) : String(v);
  }

  /**
   * Valeur d'une cellule sous forme d'une liste de textes : un seul élément
   * en général, plusieurs pour une liste (références multiples, choix
   * multiples). Les éléments vides sont retirés.
   */
  function elements(colonne, valeur) {
    if (estErreur(valeur)) return ['⚠️ invalide'];
    if (Array.isArray(valeur)) {
      // Une liste peut arriver « encodée » : ['L', a, b…]
      const liste = valeur[0] === 'L' ? valeur.slice(1) : valeur;
      return liste.map(v => valeurSimple(colonne, v)).filter(Boolean);
    }
    const texte = valeurSimple(colonne, valeur);
    return texte ? [texte] : [];
  }

  /**
   * Pastel calculé à partir du texte : la même valeur a toujours la même
   * couleur (d'une carte à l'autre, d'une séance à l'autre).
   */
  function couleurPastel(texte) {
    let somme = 0;
    for (const caractere of texte) somme = (somme * 31 + caractere.codePointAt(0)) % 360;
    return { fond: `hsl(${somme}, 70%, 91%)`, texte: `hsl(${somme}, 45%, 28%)` };
  }

  /**
   * Couleur d'une pastille d'après son texte affiché : { fond, texte }, ou
   * null pour le gris neutre (voir l'en-tête du module).
   */
  function couleur(colonne, texte) {
    // Couleur de fond réglée dans Grist (texte noir si Grist n'en précise pas)
    const choix = colonne.couleurs[texte];
    if (choix && choix.fond) return { fond: choix.fond, texte: choix.texte || '#000000' };

    const pourcent = /^\s*(-?\d+(?:[.,]\d+)?)\s*%\s*$/.exec(texte);
    if (pourcent) {
      const n = parseFloat(pourcent[1].replace(',', '.'));
      return COULEURS_POURCENTAGE.find(c => n <= c.jusqua) || COULEURS_POURCENTAGE[COULEURS_POURCENTAGE.length - 1];
    }

    if (/^(Choice|ChoiceList|Ref|RefList)\b/.test(colonne.type)) return couleurPastel(texte);
    return null;
  }

  /**
   * Pastilles d'une cellule : une par élément (une liste de choix en donne
   * plusieurs). Renvoie un tableau d'éléments <span class="pastille">, vide
   * si la cellule l'est. Le texte est posé par textContent : jamais
   * interprété comme du HTML.
   */
  function creer(colonne, valeur) {
    const erreur = estErreur(valeur);
    return elements(colonne, valeur).map(texte => {
      const p = document.createElement('span');
      p.className = 'pastille' + (erreur ? ' pastille-erreur' : '');
      p.textContent = texte;
      p.title = `${colonne.libelle} : ${texte}`;
      const c = erreur ? null : couleur(colonne, texte);
      if (c) { p.style.background = c.fond; p.style.color = c.texte; }
      return p;
    });
  }

  window.Pastilles = { estErreur, valeurSimple, elements, couleur, couleurPastel, creer };
})();
