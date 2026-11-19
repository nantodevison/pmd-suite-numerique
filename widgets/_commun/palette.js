/* ══════════════════════════════════════════════════════════════
   PALETTE — couleurs nommées, communes aux widgets (#241)

   Huit couleurs, chacune en trois teintes :
     fond  : très pâle, pour le fond d'une carte ;
     trait : soutenue, pour un bandeau ou une bordure ;
     texte : foncée, lisible sur le fond.
   Ce sont les couleurs du Kanban (PASTEL_PALETTE dans kanban.js, couleurs
   des statuts), qui garde pour l'instant sa propre copie : il est en
   service, on ne le touche pas pour ce module.

   Une couleur s'enregistre dans Grist sous son NOM (« bleu »…), lisible
   dans la table et indépendant des teintes : on peut ajuster une teinte
   ici sans toucher aux données.

   Couleur automatique : une ligne sans couleur choisie reçoit une couleur
   calculée d'après son numéro (1 → bleu, 2 → vert…). Rien n'est écrit dans
   Grist ; la couleur ne change pas d'un affichage à l'autre, et deux lignes
   qui se suivent n'ont jamais la même. Le gris n'est jamais automatique :
   il reste pour une ligne qu'on veut volontairement effacer.

   Utilisé par : galerie.
   ══════════════════════════════════════════════════════════════ */

const Palette = (() => {
  'use strict';

  const COULEURS = [
    { nom: 'bleu',   fond: '#dbeafe', trait: '#60a5fa', texte: '#1d4ed8' },
    { nom: 'vert',   fond: '#dcfce7', trait: '#4ade80', texte: '#15803d' },
    { nom: 'rose',   fond: '#fce7f3', trait: '#f472b6', texte: '#be185d' },
    { nom: 'jaune',  fond: '#fef9c3', trait: '#facc15', texte: '#a16207' },
    { nom: 'violet', fond: '#ede9fe', trait: '#a78bfa', texte: '#6d28d9' },
    { nom: 'cyan',   fond: '#cffafe', trait: '#22d3ee', texte: '#0e7490' },
    { nom: 'orange', fond: '#ffedd5', trait: '#fb923c', texte: '#c2410c' },
    { nom: 'gris',   fond: '#f1f5f9', trait: '#94a3b8', texte: '#475569' },
  ];

  // Couleurs tirées pour une ligne sans choix : toutes sauf le gris
  const AUTOMATIQUES = COULEURS.filter(c => c.nom !== 'gris');

  /**
   * Couleur d'après son nom, sans tenir compte des majuscules ni des espaces
   * autour (« Bleu », « bleu ») ; null si le nom est vide ou inconnu.
   */
  function parNom(nom) {
    const cle = String(nom ?? '').trim().toLowerCase();
    return COULEURS.find(c => c.nom === cle) || null;
  }

  /** Couleur automatique d'une ligne, d'après son numéro (1, 2, 3…). */
  function automatique(id) {
    const n = Math.abs(Math.trunc(Number(id) || 0));
    return AUTOMATIQUES[(Math.max(n, 1) - 1) % AUTOMATIQUES.length];
  }

  /**
   * Couleur d'une ligne : celle choisie (valeur de la cellule) si elle est
   * reconnue, sinon l'automatique. Renvoie { ...couleur, choisie, inconnue } :
   *   choisie  : true si la cellule désigne une couleur de la palette ;
   *   inconnue : la valeur de la cellule si elle n'est pas reconnue (sinon '').
   */
  function pourLigne(id, valeur) {
    const choisie = parNom(valeur);
    if (choisie) return { ...choisie, choisie: true, inconnue: '' };
    const texte = String(valeur ?? '').trim();
    return { ...automatique(id), choisie: false, inconnue: texte };
  }

  /**
   * Teinte « #rrggbb » rendue transparente : « rgba(r, g, b, opacite) ».
   * opacite va de 0 (invisible) à 1 (pleine). Sert à adoucir un fond.
   */
  function transparente(hex, opacite) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacite})`;
  }

  /** Nom affiché d'une couleur : « Bleu ». */
  function libelle(couleur) {
    return couleur.nom.charAt(0).toUpperCase() + couleur.nom.slice(1);
  }

  return { COULEURS, parNom, automatique, pourLigne, libelle, transparente };
})();
