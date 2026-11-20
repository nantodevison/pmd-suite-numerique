/* ══════════════════════════════════════════════════════════════
   PAGE GRIST — page.js
   ══════════════════════════════════════════════════════════════

   Affiche UNE ligne d'une table comme une page, à la manière de Notion :
   un grand titre, quelques pastilles, puis un texte en Markdown qu'on lit
   et qu'on modifie sur place. Exemple : la page d'accueil d'un projet
   (une ligne de Projets2, texte « Presentation »).

   GÉNÉRIQUE : aucune table ni colonne n'est codée en dur.
     - La TABLE est celle que Grist relie au widget (choisie à son ajout).
     - Les COLONNES s'associent dans le panneau de droite de Grist :
         Titre      (obligatoire) : grand titre de la page, en lecture seule ;
         Texte      (facultatif)  : corps de la page, en Markdown, modifiable ;
         Pastilles  (facultatif, plusieurs) : sous le titre, en lecture seule.
     - La LIGNE affichée se choisit dans ⚙ par un ou plusieurs critères
       « colonne = valeur » (le numéro de ligne en est un) qui, ensemble,
       doivent désigner une seule ligne. Ils sont gardés dans les options du
       widget (grist.setOption), donc dans le document, après « Enregistrer ».

   POURQUOI RELIRE LA TABLE ? Grist n'envoie au widget (onRecords) que les
   colonnes ASSOCIÉES (constaté, #239). Un critère peut porter sur une autre
   colonne : on relit donc la table entière (fetchTable) à chaque envoi.
   Seules les lignes envoyées par Grist comptent : les filtres de la vue
   Grist restent respectés.

   Briques communes utilisées (../_commun/) :
     fiche.js     : champ Markdown (Aperçu / Modifier), nettoyé par DOMPurify ;
     pastilles.js : dessin des pastilles (couleurs des choix de Grist…) ;
     colonnes.js  : structure du document (libellés, types, couleurs) ;
     fenetre.js   : fenêtre de réglages ⚙.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const ETAT = {
  table:     null,    // identifiant de la table reliée au widget
  doc:       null,    // structure du document (../_commun/colonnes.js)
  colonnes:  null,    // association : { Titre: 'colId', Texte: 'colId', Pastilles: [...] }
  lignes:    null,    // lignes envoyées par Grist (colonnes associées seulement) ; null avant le 1er envoi
  tableComplete: null,   // la table relue par fetchTable (toutes les colonnes, valeurs brutes)
  // Critères qui désignent la ligne affichée : [{ col, valeur }] ; col vaut
  // 'id' pour le numéro de ligne. null tant que les options ne sont pas lues.
  criteres:  null,
  idAffiche: null,    // numéro de la ligne affichée, ou null
  curseur:   null,    // numéro de ligne où l'on a placé le curseur de Grist
  texteModifie: null, // texte saisi pas encore sauvegardé, ou null
  reglagesProposes: false,  // ⚙ ouverte d'office une fois, si aucun critère
};

// Types de colonnes proposés comme critères (les listes en sont exclues :
// « contient » serait une autre règle). typeBase : 'Ref' pour 'Ref:Projets'.
const TYPES_CRITERES = ['Text', 'Choice', 'Ref', 'Int', 'Numeric', 'Bool'];
// Pseudo-colonne du numéro de ligne
const COL_NUMERO = 'id';

/* ══════════════════════════════════════════════════════════════
   1. LIEN AVEC GRIST
   ══════════════════════════════════════════════════════════════ */

// grist.ready() doit précéder tout autre appel à l'API Grist.
grist.ready({
  requiredAccess: 'full',   // le widget écrit le texte et relit la table et la structure
  // Rend le widget proposable comme source de « Sélectionner par » pour les
  // autres vues de la page (tâches, rendez-vous…) : sans cette option, Grist
  // ne le propose pas, même si le widget place le curseur (setCursorPos).
  allowSelectBy: true,
  columns: [
    { name: 'Titre',     title: 'Titre', type: 'Text' },
    { name: 'Texte',     title: 'Texte de la page (Markdown)', type: 'Text', optional: true },
    // Mêmes types que les pastilles de la Galerie ; une liste de références
    // (ex. les chefs d'un projet) donne une pastille par élément.
    { name: 'Pastilles', title: 'Pastilles (sous le titre)', allowMultiple: true, optional: true,
      type: 'Text,Numeric,Int,Bool,Date,DateTime,Choice,ChoiceList,Ref,RefList' },
  ],
});

// Numéro du dernier envoi de Grist : si un envoi arrive pendant qu'on relit
// la table pour le précédent, seul le plus récent est affiché.
let _dernierEnvoi = 0;

grist.onRecords(async (lignes, colonnes) => {
  const envoi = ++_dernierEnvoi;
  try {
    await chargerStructure();
  } catch (err) {
    // Sans structure : libellés = identifiants, pastilles sans couleurs.
    console.error('Page – lecture de la structure impossible :', err);
  }
  let table = null;
  try {
    table = await grist.docApi.fetchTable(ETAT.table);
  } catch (err) {
    console.error('Page – lecture de la table impossible :', err);
  }
  if (envoi !== _dernierEnvoi) return;   // un envoi plus récent est arrivé entre-temps
  ETAT.colonnes = colonnes;
  ETAT.lignes = lignes;
  ETAT.tableComplete = table;
  afficher();
  if (FENETRE.estOuverte()) dessinerCriteres();   // valeurs proposées à jour
});

// Options du widget (gardées dans le document) : les critères. Lues à
// l'ouverture seulement : Grist rappelle onOptions après chaque setOption,
// parfois dans le désordre ; le widget étant seul à les écrire, sa copie
// en mémoire fait foi (même règle que les vues du Kanban).
grist.onOptions((options) => {
  if (ETAT.criteres !== null) return;
  ETAT.criteres = criteresValides(options && options.criteres);
  afficher();
});

/** Garde seulement des critères bien formés : [{ col: texte, valeur }]. */
function criteresValides(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.filter(c => c && typeof c.col === 'string' && 'valeur' in c);
}

/** Lit la table reliée et la structure du document (une fois par table). */
async function chargerStructure() {
  const table = await grist.getTable().getTableId();
  if (table !== ETAT.table) { ETAT.table = table; ETAT.doc = null; }
  if (!ETAT.doc) ETAT.doc = await Colonnes.lireDocument();
}

/** Description d'une colonne de la table, ou une description minimale. */
function info(colId) {
  return (ETAT.doc && ETAT.doc.colonne(ETAT.table, colId))
    || { colId, libelle: colId, type: '', typeBase: '', formule: false, couleurs: {}, pourcentage: false };
}

/** Colonnes associées sous un nom, toujours en liste. */
function associees(nom) {
  const c = ETAT.colonnes && ETAT.colonnes[nom];
  return Array.isArray(c) ? c.filter(Boolean) : (c ? [c] : []);
}

/* ══════════════════════════════════════════════════════════════
   2. QUELLE LIGNE AFFICHER ?
   ══════════════════════════════════════════════════════════════ */

/**
 * Numéros des lignes qui respectent TOUS les critères, parmi celles que
 * Grist a envoyées. Les valeurs sont comparées telles que fetchTable les
 * donne : une référence sous son NUMÉRO (renommer la ligne visée ne casse
 * donc pas le critère).
 */
function lignesTrouvees(criteres) {
  const t = ETAT.tableComplete;
  if (!t || !ETAT.lignes || !criteres.length) return [];
  const recues = new Set(ETAT.lignes.map(l => l.id));
  const resultat = [];
  t.id.forEach((id, i) => {
    if (!recues.has(id)) return;
    if (criteres.every(c => valeurBrute(c.col, i) === c.valeur)) resultat.push(id);
  });
  return resultat;
}

/** Valeur brute de la colonne `col` au rang `i` de la table relue. */
function valeurBrute(col, i) {
  const t = ETAT.tableComplete;
  if (col === COL_NUMERO) return t.id[i];
  return t[col] ? t[col][i] : undefined;
}

/** Libellé d'une colonne de critère (« N° de ligne » pour le numéro). */
function libelleColonne(col) {
  return col === COL_NUMERO ? 'N° de ligne' : info(col).libelle;
}

/**
 * Texte affiché d'une valeur brute de critère :
 *   numéro de ligne → « #12 — Titre de la ligne » ;
 *   référence       → nom affiché (colonne cachée de Grist), sinon « #12 » ;
 *   case à cocher   → « ✓ oui » / « ✗ non ».
 */
function libelleValeur(col, valeur) {
  const t = ETAT.tableComplete;
  if (col === COL_NUMERO) {
    const i = t ? t.id.indexOf(valeur) : -1;
    const colTitre = ETAT.colonnes && ETAT.colonnes.Titre;
    const titre = i !== -1 && colTitre && t[colTitre] ? t[colTitre][i] : '';
    return `#${valeur}` + (titre ? ` — ${titre}` : '');
  }
  const c = info(col);
  if (c.typeBase === 'Ref') {
    const i = t && c.colAffichage && t[c.colAffichage] ? t[col].indexOf(valeur) : -1;
    return i !== -1 ? String(t[c.colAffichage][i] ?? `#${valeur}`) : `#${valeur}`;
  }
  if (typeof valeur === 'boolean') return valeur ? '✓ oui' : '✗ non';
  return String(valeur);
}

/** Résumé lisible des critères : « N° de ligne = #12 — … et Type = Interne ». */
function resumeCriteres(criteres) {
  return criteres.map(c => `${libelleColonne(c.col)} = ${libelleValeur(c.col, c.valeur)}`).join(' et ');
}

/* ══════════════════════════════════════════════════════════════
   3. AFFICHAGE
   ══════════════════════════════════════════════════════════════ */

const contenu = () => document.getElementById('contenu');

/**
 * Dessine la page, ou un message s'il n'y a rien (ou trop) à afficher.
 * Un texte en cours de saisie n'est jamais effacé : tant qu'il n'est ni
 * sauvegardé ni annulé, la page n'est pas redessinée.
 */
function afficher() {
  if (ETAT.texteModifie !== null) return;
  if (ETAT.lignes === null || ETAT.criteres === null) return;   // Grist n'a pas encore tout envoyé

  if (!associees('Titre').length) {
    afficherMessage('Associez au moins la colonne <strong>Titre</strong> dans le panneau de droite de Grist (section « Colonnes » du widget).');
    return;
  }
  if (!ETAT.tableComplete) {
    afficherMessage('⚠️ Impossible de lire la table. Vérifiez que le widget a l\'<strong>accès complet</strong> au document.');
    return;
  }
  if (!ETAT.criteres.length) {
    afficherMessage('Aucune ligne choisie pour cette page.', true);
    // Première visite : on ouvre directement la fenêtre de choix.
    if (!ETAT.reglagesProposes) { ETAT.reglagesProposes = true; ouvrirReglages(); }
    return;
  }
  const trouvees = lignesTrouvees(ETAT.criteres);
  if (trouvees.length !== 1) {
    const raison = trouvees.length === 0
      ? 'Aucune ligne ne correspond aux critères'
      : `${trouvees.length} lignes correspondent aux critères`;
    // Texte venu de Grist dans le résumé : échappé par afficherMessage (textContent)
    afficherMessage(`⚠️ ${raison} : ${resumeCriteres(ETAT.criteres)}.`, true, false);
    ETAT.idAffiche = null;
    return;
  }
  const ligne = ETAT.lignes.find(l => l.id === trouvees[0]);
  dessinerPage(ligne);
}

/**
 * Message à la place de la page.
 *   html      : true si `texte` est un HTML écrit ICI (jamais un texte de Grist) ;
 *   avecBouton: ajoute « ⚙ Choisir la ligne ».
 */
function afficherMessage(texte, avecBouton = false, html = true) {
  ETAT.idAffiche = null;
  const zone = contenu();
  zone.replaceChildren();
  const bloc = document.createElement('div');
  bloc.className = 'page-message';
  const p = document.createElement('p');
  if (html) p.innerHTML = texte; else p.textContent = texte;
  bloc.appendChild(p);
  if (avecBouton) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-primary';
    b.textContent = '⚙ Choisir la ligne';
    b.addEventListener('click', ouvrirReglages);
    bloc.appendChild(b);
  }
  zone.appendChild(bloc);
}

/** Dessine la page d'une ligne : titre, pastilles, texte. */
function dessinerPage(ligne) {
  ETAT.idAffiche = ligne.id;
  placerCurseur(ligne.id);
  const zone = contenu();
  zone.replaceChildren();
  const page = document.createElement('article');
  page.className = 'page';
  page.dataset.id = ligne.id;

  // 1. Titre, en lecture seule (voir le README : une règle de Grist peut
  //    remplacer un titre trop long par un message d'erreur)
  const colTitre = ETAT.colonnes.Titre;
  const titre = document.createElement('h1');
  titre.className = 'page-titre';
  const texteTitre = Pastilles.elements(info(colTitre), ligne[colTitre]).join(' ');
  titre.textContent = texteTitre || 'Sans titre';
  titre.classList.toggle('page-sans-titre', !texteTitre);
  page.appendChild(titre);

  // 2. Pastilles (sans la colonne du texte, affichée en grand)
  const colTexte = ETAT.colonnes.Texte;
  const zonePastilles = document.createElement('div');
  zonePastilles.className = 'page-pastilles';
  associees('Pastilles').filter(c => c !== colTexte).forEach(colId => {
    Pastilles.creer(info(colId), ligne[colId]).forEach(p => zonePastilles.appendChild(p));
  });
  if (zonePastilles.children.length) page.appendChild(zonePastilles);

  // 3. Texte en Markdown : modifiable, sauf s'il est calculé par une formule
  if (colTexte) {
    if (info(colTexte).formule) {
      const rendu = document.createElement('div');
      rendu.className = 'fiche-md-rendu';
      rendu.innerHTML = Fiche.markdownVersHtml(ligne[colTexte]);   // HTML déjà nettoyé
      const note = document.createElement('div');
      note.className = 'page-note';
      note.textContent = '🔒 Texte calculé par une formule : non modifiable ici';
      page.append(rendu, note);
    } else {
      page.appendChild(Fiche.champMarkdown(ligne[colTexte] ?? '', (texte) => {
        ETAT.texteModifie = texte;
        majBarreSauver();
      }));
    }
  }
  zone.appendChild(page);
  majBarreSauver();
}

/**
 * Place le curseur de Grist sur la ligne affichée : un autre widget de la
 * page peut ainsi « Sélectionner par » celui-ci (les tâches du projet…).
 * Une seule fois par ligne, pour ne pas déplacer le curseur sans cesse.
 */
function placerCurseur(id) {
  if (ETAT.curseur === id) return;
  ETAT.curseur = id;
  Promise.resolve(grist.setCursorPos({ rowId: id })).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════
   4. SAUVEGARDE DU TEXTE
   ══════════════════════════════════════════════════════════════ */

function majBarreSauver() {
  document.getElementById('barre-sauver').hidden = ETAT.texteModifie === null;
}

async function sauverTexte() {
  if (ETAT.texteModifie === null || ETAT.idAffiche === null) return;
  const bouton = document.getElementById('bouton-sauver');
  bouton.disabled = true;
  bouton.textContent = '…';
  try {
    await grist.docApi.applyUserActions([
      ['UpdateRecord', ETAT.table, ETAT.idAffiche, { [ETAT.colonnes.Texte]: ETAT.texteModifie }],
    ]);
    ETAT.texteModifie = null;
    afficherToast('✓ Texte sauvegardé');
    afficher();   // Grist renverra aussi la ligne (onRecords) : la page sera à jour
  } catch (err) {
    afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Page – erreur de sauvegarde :', err);
  } finally {
    bouton.disabled = false;
    bouton.textContent = '✓ Sauvegarder';
    majBarreSauver();
  }
}

function annulerTexte() {
  if (!confirm('Abandonner les modifications du texte ?')) return;
  ETAT.texteModifie = null;
  majBarreSauver();
  afficher();
}

document.getElementById('bouton-sauver').addEventListener('click', sauverTexte);
document.getElementById('bouton-annuler').addEventListener('click', annulerTexte);
// Ctrl + S (ou Cmd + S) sauvegarde, comme dans un éditeur
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && ETAT.texteModifie !== null) {
    e.preventDefault();
    sauverTexte();
  }
});

/* ══════════════════════════════════════════════════════════════
   5. FENÊTRE ⚙ « LIGNE AFFICHÉE »
   On y compose des critères « colonne = valeur ». Les valeurs se
   choisissent dans la liste de celles qui existent dans la table : pas de
   faute de frappe possible. Le résultat (combien de lignes) s'affiche en
   direct ; « Appliquer » n'est possible qu'avec une seule ligne.
   ══════════════════════════════════════════════════════════════ */

// Critères en cours de modification dans la fenêtre : [{ col, valeur }],
// valeur undefined tant qu'elle n'est pas choisie.
let brouillon = [];

const FENETRE = Fenetre.creer({
  titre: '⚙️ Réglages de la page',
  onglets: [{
    id: 'ligne', libelle: 'Ligne affichée', contenu: document.getElementById('reglages-ligne'),
    etat: () => (lignesTrouvees(criteresComplets()).length === 1
      ? { etat: 'ok', aide: 'Une seule ligne désignée' }
      : { etat: 'alerte', aide: 'Les critères doivent désigner une seule ligne' }),
  }],
  actions: [
    { libelle: 'Annuler', classe: 'btn-ghost', fermer: true },
    { libelle: '✓ Appliquer', classe: 'btn-primary', surClic: appliquerReglages },
  ],
});

/** Critères du brouillon dont la valeur est choisie. */
function criteresComplets() {
  return brouillon.filter(c => c.valeur !== undefined);
}

function ouvrirReglages() {
  brouillon = (ETAT.criteres || []).map(c => ({ ...c }));
  if (!brouillon.length) brouillon.push({ col: COL_NUMERO, valeur: undefined });
  const aide = document.getElementById('reglages-aide');
  aide.textContent = `Choisissez une ou plusieurs colonnes de la table « ${ETAT.table || '?'} » et leur valeur : `
    + 'ensemble, elles doivent désigner une seule ligne. Le n° de ligne est le plus sûr : il ne change jamais, '
    + 'même si l\'on renomme la ligne.';
  dessinerCriteres();
  FENETRE.ouvrir();
}

/** Colonnes proposées comme critères : le numéro de ligne, puis les autres de A à Z. */
function colonnesCriteres() {
  const autres = ETAT.doc
    ? ETAT.doc.colonnes(ETAT.table)
      .filter(c => TYPES_CRITERES.includes(c.typeBase))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
      .map(c => ({ col: c.colId, libelle: c.libelle }))
    : [];
  return [{ col: COL_NUMERO, libelle: 'N° de ligne' }, ...autres];
}

/**
 * Valeurs proposées pour une colonne : celles des lignes envoyées par Grist,
 * sans doublon ni vide, rangées (nombres dans l'ordre, textes de A à Z).
 */
function valeursProposees(col) {
  const t = ETAT.tableComplete;
  if (!t || !ETAT.lignes) return [];
  const recues = new Set(ETAT.lignes.map(l => l.id));
  const vues = new Set();
  const valeurs = [];
  t.id.forEach((id, i) => {
    if (!recues.has(id)) return;
    const v = valeurBrute(col, i);
    // Vide, référence vide (0), liste ou cellule en erreur : pas proposées
    if (v === null || v === undefined || v === '' || typeof v === 'object') return;
    if (info(col).typeBase === 'Ref' && v === 0) return;
    if (vues.has(v)) return;
    vues.add(v);
    valeurs.push({ valeur: v, libelle: libelleValeur(col, v) });
  });
  return valeurs.sort((a, b) => (typeof a.valeur === 'number' && col === COL_NUMERO
    ? a.valeur - b.valeur
    : a.libelle.localeCompare(b.libelle, 'fr', { numeric: true })));
}

/** Liste déroulante (<select>) : options [{ libelle }], rang choisi ou -1. */
function liste(options, rangChoisi, invite) {
  const s = document.createElement('select');
  if (invite) {
    const o = new Option(invite, '');
    o.disabled = true;
    s.appendChild(o);
  }
  options.forEach((opt, i) => s.appendChild(new Option(opt.libelle, String(i))));
  s.value = rangChoisi >= 0 ? String(rangChoisi) : '';
  return s;
}

/** Redessine les lignes de critères et le résultat. */
function dessinerCriteres() {
  const zone = document.getElementById('criteres');
  zone.replaceChildren();
  const colonnes = colonnesCriteres();

  brouillon.forEach((critere, n) => {
    const ligne = document.createElement('div');
    ligne.className = 'critere';
    const et = document.createElement('span');
    et.className = 'critere-et';
    et.textContent = n === 0 ? '' : 'et';

    // Colonne (une colonne disparue de la table reste affichée, signalée)
    const options = [...colonnes];
    if (!options.some(o => o.col === critere.col)) {
      options.push({ col: critere.col, libelle: `⚠️ ${critere.col} (colonne introuvable)` });
    }
    const choixCol = liste(options, options.findIndex(o => o.col === critere.col));
    choixCol.title = 'Colonne';
    choixCol.addEventListener('change', () => {
      critere.col = options[Number(choixCol.value)].col;
      critere.valeur = undefined;   // l'ancienne valeur n'a plus de sens
      dessinerCriteres();
    });

    // Valeur (une valeur qui n'existe plus reste affichée, signalée)
    const valeurs = valeursProposees(critere.col);
    let rang = valeurs.findIndex(v => v.valeur === critere.valeur);
    if (critere.valeur !== undefined && rang === -1) {
      valeurs.push({ valeur: critere.valeur, libelle: `⚠️ ${libelleValeur(critere.col, critere.valeur)} (introuvable)` });
      rang = valeurs.length - 1;
    }
    const choixValeur = liste(valeurs, rang, valeurs.length ? 'Choisir une valeur…' : 'Aucune valeur');
    choixValeur.title = 'Valeur';
    choixValeur.addEventListener('change', () => {
      critere.valeur = valeurs[Number(choixValeur.value)].valeur;
      majResultat();
    });

    const retirer = document.createElement('button');
    retirer.type = 'button';
    retirer.className = 'critere-retirer';
    retirer.textContent = '✕';
    retirer.title = 'Retirer ce critère';
    retirer.addEventListener('click', () => {
      brouillon.splice(n, 1);
      FENETRE.marquerModifiee(true);
      dessinerCriteres();
    });

    const egal = document.createElement('span');
    egal.textContent = '=';
    ligne.append(et, choixCol, egal, choixValeur, retirer);
    zone.appendChild(ligne);
  });
  majResultat();
}

/** Affiche combien de lignes les critères désignent. */
function majResultat() {
  const zone = document.getElementById('criteres-resultat');
  const complets = criteresComplets();
  const trouvees = lignesTrouvees(complets);
  zone.className = 'criteres-resultat';
  if (!complets.length) {
    zone.textContent = 'Choisissez au moins un critère.';
  } else if (trouvees.length === 1) {
    zone.classList.add('ok');
    zone.textContent = `✓ Une ligne : ${libelleValeur(COL_NUMERO, trouvees[0])}`;
  } else {
    zone.classList.add('alerte');
    zone.textContent = trouvees.length === 0
      ? '⚠️ Aucune ligne ne correspond : changez une valeur.'
      : `⚠️ ${trouvees.length} lignes correspondent : ajoutez un critère.`;
  }
  FENETRE.majEtats();
}

document.getElementById('critere-ajouter').addEventListener('click', () => {
  brouillon.push({ col: COL_NUMERO, valeur: undefined });
  FENETRE.marquerModifiee(true);
  dessinerCriteres();
});

/** « Appliquer » : seulement si les critères désignent une seule ligne. */
async function appliquerReglages() {
  const complets = criteresComplets();
  if (lignesTrouvees(complets).length !== 1) {
    const zone = document.getElementById('criteres-resultat');
    zone.classList.add('alerte');
    if (!zone.textContent.startsWith('⚠️')) zone.textContent = '⚠️ Les critères doivent désigner une seule ligne.';
    return;
  }
  if (ETAT.texteModifie !== null && !confirm('Le texte modifié de la page n\'est pas sauvegardé. L\'abandonner ?')) return;
  ETAT.texteModifie = null;
  ETAT.criteres = complets.map(c => ({ col: c.col, valeur: c.valeur }));
  FENETRE.fermer({ forcer: true });
  try {
    await grist.setOption('criteres', ETAT.criteres);
    afficherToast('✓ Ligne choisie — cliquez sur « Enregistrer » dans Grist pour garder ce choix', 5000);
  } catch (err) {
    afficherToast(`⚠️ Réglage non enregistré : ${err.message || err}`, 5000);
    console.error('Page – erreur setOption :', err);
  }
  majBarreSauver();
  afficher();
}

document.getElementById('bouton-reglages').addEventListener('click', ouvrirReglages);

/* ══════════════════════════════════════════════════════════════
   6. PETIT MESSAGE TEMPORAIRE
   ══════════════════════════════════════════════════════════════ */

let _minuterieToast = null;
function afficherToast(texte, duree = 2200) {
  const t = document.getElementById('toast');
  t.textContent = texte;
  t.classList.add('visible');
  clearTimeout(_minuterieToast);
  _minuterieToast = setTimeout(() => t.classList.remove('visible'), duree);
}
