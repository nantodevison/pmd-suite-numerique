/* ══════════════════════════════════════════════════════════════
   LIENS — enchaînement des cartes (« Bloque » / « Bloquée par »)
   ══════════════════════════════════════════════════════════════

   Deux colonnes Grist de type « liste de références » vers la table des
   cartes elle-même, l'une inverse de l'autre (référence à double sens) :
   si A « Bloque » B, alors B est « Bloquée par » A. Grist tient les deux
   colonnes à jour : le widget n'écrit qu'un côté.

   Ce module ne connaît AUCUN nom de table ni de colonne. Il fournit :

   1. indexer() : la liste des cartes (titre, statut, projet, liens), à
      partir d'une table lue par grist.docApi.fetchTable. Cette lecture
      donne les numéros de ligne ; grist.onRecords donne, lui, les titres
      affichés, ambigus si deux cartes portent le même titre.

   2. chercherBoucle() : repère un enchaînement qui revient sur lui-même
      (A bloque B, qui bloque A).

   3. bande() : la bande « enchaînement » d'une fiche,
        [cartes qui la bloquent] ▶ [cette carte] ▶ [cartes qu'elle bloque]
      avec ＋ (chercher une carte à lier), × (retirer un lien) et un clic
      sur une carte liée pour l'ouvrir.

   4. badges() : « ⛔ 2 » / « ➡️ 1 » sur une carte du tableau, d'après les
      classes de statut (À faire, En cours, Terminé, Autre) réglées par
      l'utilisateur : seules les cartes à faire ou en cours comptent.

   DÉPENDANCES : ../_commun/fiche.js (menu de recherche), à charger AVANT
   ce fichier, et la feuille de style ../_commun/liens.css.

   UTILISATION (exemple)
     const table = await grist.docApi.fetchTable('Taches');
     const index = Liens.indexer(table, { titre: 'Nom', statut: 'statut',
       projet: 'Projet', bloque: 'Bloque', bloqueePar: 'Bloquee_par' });
     zone.appendChild(Liens.bande({ index, carte: { id: 12, titre: '…' },
       bloqueePar: [3], bloque: [15], candidats: [3, 15, 20],
       surChangement: (liens) => …, surOuvrir: (id) => … }));
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. Lecture des cartes ─────────────────────────────────── */

  /** Valeur d'une liste de références → numéros de ligne (['L', 3, 5] → [3, 5]). */
  function versIds(valeur) {
    if (!Array.isArray(valeur)) return [];
    return valeur.filter(v => typeof v === 'number' && v > 0);
  }

  /**
   * Cartes d'une table lue par fetchTable (format en colonnes :
   * { id: [1, 2…], Nom: ['…', '…'], … }).
   *   colonnes : { titre, statut, projet, bloque, bloqueePar } : noms des
   *              colonnes Grist ; seul « titre » est obligatoire.
   * Renvoie une Map : numéro → { id, titre, statut, projet, bloque, bloqueePar }.
   */
  function indexer(table, colonnes) {
    const index = new Map();
    const lire = (col, i) => (col && table[col]) ? table[col][i] : null;
    (table.id || []).forEach((id, i) => {
      index.set(id, {
        id,
        titre:      String(lire(colonnes.titre, i) ?? ''),
        statut:     String(lire(colonnes.statut, i) ?? ''),
        projet:     lire(colonnes.projet, i) || 0,
        bloque:     versIds(lire(colonnes.bloque, i)),
        bloqueePar: versIds(lire(colonnes.bloqueePar, i)),
      });
    });
    // Une seule des deux colonnes associée : l'autre sens se déduit du premier.
    if (!colonnes.bloque !== !colonnes.bloqueePar) {
      const connu = colonnes.bloque ? 'bloque' : 'bloqueePar';
      const deduit = colonnes.bloque ? 'bloqueePar' : 'bloque';
      index.forEach(c => c[connu].forEach(autre => {
        if (index.has(autre)) index.get(autre)[deduit].push(c.id);
      }));
    }
    return index;
  }

  /* ── 2. Boucles ────────────────────────────────────────────── */

  /**
   * Cherche une boucle passant par la carte affichée, en tenant compte de
   * ses liens en cours de modification (pas encore enregistrés).
   *   carte : { id, bloque: [numéros], bloqueePar: [numéros] }
   *           (id 0 : carte en cours de création)
   * Renvoie le chemin [carte, …, carte] (numéros), ou null s'il n'y en a pas.
   */
  function chercherBoucle(index, carte) {
    // Cartes que « x » bloque, avec les liens en cours de la carte affichée
    function suivantes(x) {
      if (x === carte.id) return carte.bloque;
      const autres = ((index.get(x) || {}).bloque || []).filter(y => y !== carte.id);
      return carte.bloqueePar.includes(x) ? [...autres, carte.id] : autres;
    }
    // Parcours « en largeur » depuis la carte : on avance d'un lien à la fois,
    // si bien que le premier retour sur la carte donne la boucle la plus courte.
    const precedente = new Map();   // carte atteinte → carte d'où l'on vient
    const aVisiter = [];
    for (const y of suivantes(carte.id)) {
      if (y === carte.id) return [carte.id, carte.id];
      if (!precedente.has(y)) { precedente.set(y, carte.id); aVisiter.push(y); }
    }
    while (aVisiter.length) {
      const x = aVisiter.shift();
      for (const y of suivantes(x)) {
        if (y === carte.id) {
          // Retour sur la carte : on remonte le chemin parcouru
          const chemin = [carte.id];
          for (let n = x; n !== carte.id; n = precedente.get(n)) chemin.unshift(n);
          chemin.unshift(carte.id);
          return chemin;
        }
        if (!precedente.has(y)) { precedente.set(y, x); aVisiter.push(y); }
      }
    }
    return null;
  }

  /* ── 3. Bande « enchaînement » ─────────────────────────────── */

  const COTES = {
    bloqueePar: { libelle: '⛔ Bloquée par', ajout: '＋ Bloquée par…', classe: 'liens-bloqueur',
                  aide: 'Cartes à terminer avant celle-ci' },
    bloque:     { libelle: '➡️ Bloque',      ajout: '＋ Bloque…',      classe: 'liens-bloquee',
                  aide: 'Cartes qui attendent celle-ci' },
  };

  /**
   * Bande « enchaînement » d'une fiche.
   *   index         : cartes (voir indexer)
   *   carte         : { id, titre } de la carte affichée (id 0 : nouvelle carte)
   *   bloqueePar    : numéros des cartes qui la bloquent, ou null si la
   *                   colonne n'est pas associée (ce côté est alors masqué)
   *   bloque        : numéros des cartes qu'elle bloque, ou null
   *   candidats     : numéros des cartes que l'on peut lier (ex. celles du
   *                   projet) ; une carte liée hors de cette liste est grisée
   *   surChangement : appelée avec { bloqueePar, bloque } à chaque ajout ou retrait
   *   surOuvrir     : appelée avec le numéro d'une carte liée cliquée (facultatif)
   * Renvoie l'élément à insérer dans la fiche.
   */
  function bande({ index, carte, bloqueePar, bloque, candidats, surChangement, surOuvrir }) {
    const etat = {
      bloqueePar: bloqueePar ? [...bloqueePar] : null,
      bloque:     bloque     ? [...bloque]     : null,
    };
    const racine = document.createElement('div');
    racine.className = 'liens-bande';
    const grille = document.createElement('div');
    racine.appendChild(grille);

    const nomCarte = (n) => n === carte.id && !carte.id ? 'nouvelle carte' : '#' + n;

    function dessiner() {
      const aucunLien = !(etat.bloqueePar || []).length && !(etat.bloque || []).length;
      // Sans aucun lien, la bande se réduit aux deux boutons « ＋ ».
      grille.className = 'liens-grille' + (aucunLien ? ' liens-vide' : '');
      grille.replaceChildren(
        colonne('bloqueePar'), fleche(etat.bloqueePar), centre(), fleche(etat.bloque), colonne('bloque'));
    }

    function changer() {
      dessiner();
      surChangement({ bloqueePar: etat.bloqueePar, bloque: etat.bloque });
    }

    function colonne(cote) {
      const col = document.createElement('div');
      col.className = 'liens-colonne liens-colonne-' + cote;
      const ids = etat[cote];
      if (!ids) return col;   // colonne non associée dans le widget
      const titre = document.createElement('div');
      titre.className = 'liens-titre';
      titre.textContent = COTES[cote].libelle;
      titre.title = COTES[cote].aide;
      col.appendChild(titre);
      ids.forEach(id => col.appendChild(pastille(cote, id)));
      const ajout = document.createElement('button');
      ajout.type = 'button';
      ajout.className = 'liens-ajouter';
      ajout.textContent = COTES[cote].ajout;
      ajout.title = COTES[cote].aide;
      ajout.addEventListener('click', (e) => { e.stopPropagation(); ajouter(cote, ajout); });
      col.appendChild(ajout);
      return col;
    }

    function fleche(ids) {
      const f = document.createElement('span');
      f.className = 'liens-fleche';
      if (ids) f.textContent = '▶';
      return f;
    }

    function centre() {
      const c = document.createElement('div');
      c.className = 'liens-centre';
      c.textContent = carte.id ? `#${carte.id} ${carte.titre || ''}` : (carte.titre || 'Nouvelle carte');
      c.title = c.textContent;
      return c;
    }

    function pastille(cote, id) {
      const c = index.get(id);
      const autreProjet = Boolean(c) && !candidats.includes(id);
      const p = document.createElement('span');
      p.className = 'liens-pastille ' + COTES[cote].classe + (c && !autreProjet ? '' : ' liens-autre');

      // Texte : « #188 Titre · statut » ; un clic ouvre la carte (si elle est sur le tableau)
      const peutOuvrir = Boolean(surOuvrir && c && !autreProjet);
      const texte = document.createElement(peutOuvrir ? 'button' : 'span');
      texte.className = 'liens-pastille-texte';
      if (peutOuvrir) {
        texte.type = 'button';
        texte.addEventListener('click', (e) => { e.stopPropagation(); surOuvrir(id); });
      }
      texte.textContent = c ? `#${id} ${c.titre}` : `#${id} (carte introuvable)`;
      if (c && c.statut) {
        const statut = document.createElement('span');
        statut.className = 'liens-statut';
        statut.textContent = ' · ' + c.statut;
        texte.appendChild(statut);
      }
      texte.title = !c ? 'Carte supprimée ou inaccessible'
        : `#${id} ${c.titre}` + (c.statut ? `\nStatut : ${c.statut}` : '')
          + (autreProjet ? '\n(autre projet)' : (peutOuvrir ? '\nCliquer pour ouvrir' : ''));

      const retirer = document.createElement('button');
      retirer.type = 'button';
      retirer.className = 'liens-retirer';
      retirer.textContent = '×';
      retirer.title = 'Retirer ce lien';
      retirer.addEventListener('click', (e) => {
        e.stopPropagation();
        etat[cote] = etat[cote].filter(x => x !== id);
        changer();
      });

      p.append(texte, retirer);
      return p;
    }

    function ajouter(cote, ancre) {
      // Ni la carte elle-même, ni une carte déjà liée (d'un côté ou de l'autre)
      const exclues = new Set([carte.id, ...(etat.bloqueePar || []), ...(etat.bloque || [])]);
      const options = candidats
        .filter(id => !exclues.has(id) && index.has(id))
        .map(id => index.get(id))
        .sort((a, b) => b.id - a.id)   // les plus récentes d'abord
        .map(c => ({ valeur: c.id, libelle: `#${c.id} ${c.titre}`, detail: c.statut }));

      Fiche.menuRecherche(ancre, {
        options,
        placeholder: 'Titre ou #numéro…',
        surChoix: (id) => {
          const essai = { ...etat, [cote]: [...etat[cote], id] };
          // Côté non associé : on se fie à ce que Grist a enregistré
          const enregistree = index.get(carte.id) || { bloque: [], bloqueePar: [] };
          const boucle = chercherBoucle(index, {
            id: carte.id,
            bloque:     essai.bloque     || enregistree.bloque,
            bloqueePar: essai.bloqueePar || enregistree.bloqueePar,
          });
          if (boucle && !confirm('⚠️ Ce lien crée une boucle : '
              + boucle.map(nomCarte).join(' → ') + '.\nContinuer quand même ?')) return;
          etat[cote] = essai[cote];
          changer();
        },
      });
    }

    dessiner();
    return racine;
  }

  /* ── 4. Classes de statut et badges des cartes ─────────────── */

  /*
   * Chaque statut est rangé dans une des quatre classes ci-dessous, réglées
   * par l'utilisateur (le widget n'écrit aucun statut en dur). Seules les
   * cartes « actives » (À faire, En cours) comptent dans l'enchaînement :
   *   - une carte Terminée ne bloque plus personne ;
   *   - une carte Autre (idée, piste…) n'est pas en production : elle ne
   *     bloque pas, et n'est pas signalée comme bloquée.
   */
  const CLASSES = {
    afaire:  'À faire',
    encours: 'En cours',
    termine: 'Terminé',
    autre:   'Autre',
  };

  /**
   * Classe proposée par défaut pour un statut, d'après son texte. Un statut
   * inconnu est rangé en « À faire » : par prudence, il bloque ; l'utilisateur
   * le range ailleurs s'il le faut.
   */
  function devinerClasse(statut) {
    const s = String(statut || '').toLowerCase();
    if (/fait|termin|done|clos|validé|annul|archiv|abandon/.test(s)) return 'termine';
    if (/cours|progress|doing/.test(s))                             return 'encours';
    if (/id[ée]e|piste|brouillon/.test(s))                          return 'autre';
    return 'afaire';
  }

  /** Classe d'un statut : celle réglée par l'utilisateur, sinon celle devinée. */
  function classeDe(statut, classes) {
    return (classes && CLASSES[classes[statut]]) ? classes[statut] : devinerClasse(statut);
  }

  /** Vrai si la carte compte dans l'enchaînement (À faire ou En cours). */
  function estActive(carte, classes) {
    const c = classeDe(carte.statut, classes);
    return c === 'afaire' || c === 'encours';
  }

  /**
   * Liens encore « vivants » d'une carte :
   *   bloqueurs : cartes actives qui la bloquent ;
   *   attentes  : cartes actives qui l'attendent.
   * Deux listes vides si la carte elle-même n'est pas active (terminée ou
   * autre) : il n'y a rien à signaler sur le tableau.
   */
  function blocages(index, id, classes) {
    const carte = index.get(id);
    if (!carte || !estActive(carte, classes)) return { bloqueurs: [], attentes: [] };
    const actives = (ids) => ids.map(x => index.get(x)).filter(c => c && estActive(c, classes));
    return { bloqueurs: actives(carte.bloqueePar), attentes: actives(carte.bloque) };
  }

  /**
   * Badges d'une carte du tableau : « ⛔ n » (n cartes à terminer avant
   * elle) et « ➡️ n » (n cartes qui l'attendent). Le survol affiche la liste
   * des cartes concernées (bulle du navigateur). Renvoie une liste d'éléments,
   * vide s'il n'y a rien à signaler.
   */
  function badges(index, id, classes) {
    const { bloqueurs, attentes } = blocages(index, id, classes);
    const liste = (cartes) => cartes.map(c => `#${c.id} ${c.titre}` + (c.statut ? ` · ${c.statut}` : '')).join('\n');
    const resultat = [];
    const ajouter = (cartes, texte, classe, entete) => {
      if (!cartes.length) return;
      const b = document.createElement('span');
      b.className = 'liens-badge ' + classe;
      b.textContent = `${texte} ${cartes.length}`;
      b.title = entete + '\n' + liste(cartes);
      resultat.push(b);
    };
    ajouter(bloqueurs, '⛔', 'liens-bloqueur', 'Bloquée par (à terminer avant) :');
    ajouter(attentes,  '➡️', 'liens-bloquee',  'Bloque (cartes qui attendent) :');
    return resultat;
  }

  // Seul objet rendu visible au reste de la page.
  window.Liens = { indexer, chercherBoucle, bande, CLASSES, devinerClasse, classeDe, blocages, badges };
})();
