/* ══════════════════════════════════════════════════════════════
   GALERIE GRIST — galerie.js

   Affiche les lignes d'une table sous forme de cartes. Un clic sur une
   carte ouvre sa « fiche » (sur le côté ou au centre, voir
   ../_commun/fiche.js) pour lire et modifier son titre et son texte
   principal, écrit en Markdown.

   GÉNÉRIQUE : aucune table ni colonne n'est codée en dur. Les colonnes
   s'associent dans le panneau de droite de Grist (section « Colonnes » du
   widget) :
     - Titre        (obligatoire)
     - Description  (facultatif) : texte principal, en Markdown ;
     - Pastilles    (facultatif, plusieurs colonnes possibles) : pastilles
                    colorées, sur la carte ET en tête de la fiche ;
     - ObjetsLies   (facultatif, listes de références) : les tâches d'un
                    EPIC, les EPICs d'un projet… sous le titre de la fiche ;
     - Contexte     (facultatif, plusieurs colonnes possibles) : rappelé en
                    en-tête de la fiche seulement, avec son libellé.
   La carte ne montre que le titre et les pastilles ; le texte principal
   se lit dans la fiche. La recherche porte sur toutes les colonnes,
   comme dans le Kanban (règle commune : ../_commun/recherche.js).
   Couleur d'une pastille : celle du choix dans Grist pour une colonne
   Choix ; une échelle du rouge au vert pour un pourcentage ; sinon un
   pastel fixe propre à chaque valeur.
   Pour n'afficher qu'une partie des lignes (par exemple les EPICs d'un
   projet), on utilise le filtrage natif de Grist : « Sélectionner par » ou
   les filtres de la vue.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const ETAT = {
  lignes:     [],     // lignes reçues de Grist
  colonnes:   null,   // association : { Titre: 'colId', Description: 'colId', Pastilles: [...], Contexte: [...] }
  table:      null,   // identifiant de la table affichée
  infos:      {},     // colId → { libelle, type, formule, colAffichee, couleursChoix }
  references: {},     // 'table|colonne affichée' → { numéro de ligne: nom affiché }
  recherche:  '',     // texte saisi dans la recherche (règle : ../_commun/recherche.js)
  structureRecherche: null,   // types des colonnes et noms des références, pour la recherche
  structureAJour:     false,  // false : à relire avant la prochaine recherche
  structureEnCours:   null,   // lecture en cours (une seule à la fois)
  selection:  null,   // numéro de la ligne sélectionnée dans Grist
  // Carte affichée dans la fiche : numéro de ligne (null pour une nouvelle
  // carte, pas encore créée dans Grist) et colonnes modifiées.
  fiche:      { id: null, nouvelle: false, modifs: {} },
  modele:     '',     // texte de départ des nouvelles cartes (réglage ⚙)
};

/* ══════════════════════════════════════════════════════════════
   1. LIEN AVEC GRIST
   ══════════════════════════════════════════════════════════════ */

// grist.ready() doit précéder tout autre appel à l'API Grist.
grist.ready({
  requiredAccess: 'full',   // le widget écrit le titre et la description
  columns: [
    { name: 'Titre',       title: 'Titre', type: 'Text' },
    { name: 'Description', title: 'Texte principal (Markdown)', type: 'Text', optional: true },
    // « type » limite les colonnes proposées par Grist. Les listes de
    // références (RefList) sont exclues des pastilles : elles vont dans
    // « Objets liés ». Une colonne calculée sans type déclaré (« Any »,
    // comme Avancement) reste proposée partout.
    { name: 'Pastilles',   title: 'Pastilles (carte et fiche)', allowMultiple: true, optional: true,
      type: 'Text,Numeric,Int,Bool,Date,DateTime,Choice,ChoiceList,Ref' },
    { name: 'ObjetsLies',  title: 'Objets liés (sous le titre de la fiche)', allowMultiple: true, optional: true,
      type: 'RefList' },
    { name: 'Contexte',    title: 'Contexte (fiche seulement)', allowMultiple: true, optional: true },
  ],
});

grist.onRecords(async (lignes, colonnes) => {
  ETAT.lignes   = lignes;
  ETAT.colonnes = colonnes;
  try {
    await chargerInfosColonnes();
  } catch (err) {
    // Sans ces informations, le widget fonctionne quand même : libellés =
    // identifiants des colonnes, références affichées par leur numéro.
    console.error('Galerie – lecture de la structure impossible :', err);
  }
  afficherGrille();
  // Recherche : un nom de référence a pu changer, la structure sera relue
  ETAT.structureAJour = false;
  if (ETAT.recherche.trim()) assurerStructureRecherche();
  // Fiche ouverte sans modification en cours : on la rafraîchit avec les
  // nouvelles valeurs (par exemple juste après une sauvegarde).
  if (ETAT.fiche.id !== null && !ficheModifiee()) remplirFiche(ETAT.fiche.id);
});

// Réglages du widget, enregistrés dans le document Grist (grist.setOption) :
// chaque Galerie (EPICs, OKR…) garde les siens.
grist.onOptions((options) => {
  ETAT.modele = (options && options.modele) || '';
});

grist.onRecord((ligne) => {
  ETAT.selection = ligne ? ligne.id : null;
  document.querySelectorAll('.carte').forEach(c =>
    c.classList.toggle('selectionnee', Number(c.dataset.id) === ETAT.selection));
});

/**
 * Lit dans les tables internes de Grist la description des colonnes de la
 * table affichée (libellé, type, formule ou non), puis, pour les colonnes de
 * contexte qui sont des références, le nom affiché de chaque ligne visée.
 */
async function chargerInfosColonnes() {
  const table = await grist.getTable().getTableId();
  if (table !== ETAT.table) { ETAT.table = table; ETAT.infos = {}; }

  if (Object.keys(ETAT.infos).length === 0) {
    const tables = await grist.docApi.fetchTable('_grist_Tables');
    const cols   = await grist.docApi.fetchTable('_grist_Tables_column');
    const numeroTable = tables.id[tables.tableId.indexOf(table)];
    cols.id.forEach((_, i) => {
      if (cols.parentId[i] !== numeroTable) return;
      // visibleCol : numéro (dans cette même table interne) de la colonne
      // qu'une référence affiche, par exemple « Titre » pour une réf. vers EPICs.
      const iAffichee = cols.id.indexOf(cols.visibleCol[i]);
      ETAT.infos[cols.colId[i]] = {
        libelle:     cols.label[i] || cols.colId[i],
        type:        String(cols.type[i]),
        // isFormula avec une formule vide = colonne vide, encore modifiable
        formule:     Boolean(cols.isFormula[i]) && Boolean(cols.formula[i]),
        colAffichee: iAffichee !== -1 ? cols.colId[iAffichee] : null,
        ...lireOptions(cols.widgetOptions[i]),
      };
    });
  }

  for (const colId of [...colonnesPastilles(), ...colonnesObjetsLies(), ...colonnesContexte()]) {
    const info = ETAT.infos[colId];
    const ref  = info && /^(Ref|RefList):(.+)$/.exec(info.type);
    if (!ref) continue;
    const cle = ref[2] + '|' + info.colAffichee;
    if (ETAT.references[cle]) continue;   // déjà chargée
    const lignes = await grist.docApi.fetchTable(ref[2]);
    const noms = {};
    lignes.id.forEach((id, i) => {
      noms[id] = info.colAffichee ? String(lignes[info.colAffichee][i] ?? '') : String(id);
    });
    ETAT.references[cle] = noms;
  }
}

/* ══════════════════════════════════════════════════════════════
   2. LECTURE DES VALEURS
   ══════════════════════════════════════════════════════════════ */

/**
 * Réglages d'affichage d'une colonne, rangés par Grist dans ses
 * « widgetOptions » (texte JSON) :
 *   couleursChoix : { choix: { fond, texte } } (colonnes Choix) ;
 *   pourcentage   : true pour un nombre affiché en % dans Grist.
 */
function lireOptions(widgetOptions) {
  try {
    const options = JSON.parse(widgetOptions || '{}');
    const couleursChoix = {};
    Object.entries(options.choiceOptions || {}).forEach(([choix, o]) => {
      if (o.fillColor) couleursChoix[choix] = { fond: o.fillColor, texte: o.textColor || '#000000' };
    });
    return { couleursChoix, pourcentage: options.numMode === 'percent' };
  } catch (_) { return { couleursChoix: {}, pourcentage: false }; }
}

/**
 * Colonnes associées sous un nom (« Pastilles », « ObjetsLies »,
 * « Contexte »), toujours en liste, sans la colonne du texte principal
 * (déjà affichée en grand).
 */
function colonnesAssociees(nom) {
  const c = ETAT.colonnes && ETAT.colonnes[nom];
  const liste = Array.isArray(c) ? c : (c ? [c] : []);
  return liste.filter(colId => colId !== ETAT.colonnes.Description);
}
function colonnesPastilles()  { return colonnesAssociees('Pastilles'); }
function colonnesObjetsLies() { return colonnesAssociees('ObjetsLies'); }
/** Contexte, sans les colonnes déjà affichées en pastilles ou en objets liés. */
function colonnesContexte() {
  const dejaAffichees = [...colonnesPastilles(), ...colonnesObjetsLies()];
  return colonnesAssociees('Contexte').filter(colId => !dejaAffichees.includes(colId));
}

function libelle(colId) {
  return (ETAT.infos[colId] && ETAT.infos[colId].libelle) || colId;
}

function estFormule(colId) {
  return Boolean(ETAT.infos[colId] && ETAT.infos[colId].formule);
}

/**
 * Valeur d'une cellule sous forme d'une liste de textes : un seul élément
 * en général, plusieurs pour une liste (références multiples, choix
 * multiples). Les éléments vides sont retirés.
 */
function elementsAffiches(colId, valeur) {
  const info = ETAT.infos[colId] || { type: '', colAffichee: null };
  if (estErreur(valeur)) return ['⚠️ invalide'];
  if (Array.isArray(valeur)) {
    // Une liste peut arriver « encodée » : ['L', a, b…]
    const liste = valeur[0] === 'L' ? valeur.slice(1) : valeur;
    return liste.map(v => valeurSimple(info, v)).filter(Boolean);
  }
  const texte = valeurSimple(info, valeur);
  return texte ? [texte] : [];
}

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

function valeurSimple(info, v) {
  if (estErreur(v)) return '⚠️ invalide';
  if (v === null || v === undefined || v === '') return '';
  const ref = /^(Ref|RefList):(.+)$/.exec(info.type);
  if (ref && typeof v === 'number') {
    if (v === 0) return '';   // référence vide
    const noms = ETAT.references[ref[2] + '|' + info.colAffichee];
    return noms && noms[v] !== undefined ? noms[v] : String(v);
  }
  if (v instanceof Date) return v.toLocaleDateString('fr-FR');
  // Grist stocke les dates en secondes depuis le 1er janvier 1970
  if (info.type === 'Date' && typeof v === 'number') {
    return new Date(v * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  }
  if (info.type.startsWith('DateTime') && typeof v === 'number') {
    return new Date(v * 1000).toLocaleString('fr-FR');
  }
  if (typeof v === 'boolean') return v ? '✓ oui' : '✗ non';
  // Nombre affiché en pourcentage dans Grist : 0.67 → « 67 % »
  if (info.pourcentage && typeof v === 'number') return `${Math.round(v * 100)} %`;
  if (typeof v === 'object') return JSON.stringify(v);   // cas rares (pièces jointes…)
  // Un texte peut contenir du Markdown : on en retire les symboles.
  return info.type === 'Text' ? Fiche.markdownVersTexte(String(v)) : String(v);
}

/* ══════════════════════════════════════════════════════════════
   3. PASTILLES ET COULEURS
   ══════════════════════════════════════════════════════════════ */

// Pourcentages : du rouge (peu avancé) au vert (terminé)
const COULEURS_POURCENTAGE = [
  { jusqua: 33,  fond: '#fed7d7', texte: '#9b2c2c' },   // rouge
  { jusqua: 66,  fond: '#feebc8', texte: '#9c4221' },   // orange
  { jusqua: 99,  fond: '#ecf5c6', texte: '#4a6115' },   // jaune-vert
  { jusqua: 100, fond: '#c6f6d5', texte: '#22543d' },   // vert
];

/**
 * Couleur d'une pastille d'après son texte affiché, ou null (gris neutre).
 *   - choix coloré dans Grist → cette couleur ;
 *   - « 67 % »                → échelle COULEURS_POURCENTAGE ;
 *   - choix sans couleur, ou référence → pastel fixe propre à la valeur.
 */
function couleurPastille(colId, texte) {
  const info = ETAT.infos[colId] || { type: '', couleursChoix: {} };
  if (info.couleursChoix && info.couleursChoix[texte]) return info.couleursChoix[texte];

  const pourcent = /^\s*(-?\d+(?:[.,]\d+)?)\s*%\s*$/.exec(texte);
  if (pourcent) {
    const n = parseFloat(pourcent[1].replace(',', '.'));
    return COULEURS_POURCENTAGE.find(c => n <= c.jusqua) || COULEURS_POURCENTAGE[COULEURS_POURCENTAGE.length - 1];
  }

  if (/^(Choice|ChoiceList|Ref|RefList)\b/.test(info.type)) return couleurPastel(texte);
  return null;
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
 * Pastilles d'une cellule : une par élément (une liste de choix en donne
 * plusieurs). Renvoie un tableau d'éléments <span>, vide si la cellule l'est.
 */
function creerPastilles(colId, valeur) {
  const erreur = estErreur(valeur);
  return elementsAffiches(colId, valeur).map(texte => {
    const p = document.createElement('span');
    p.className = 'pastille' + (erreur ? ' pastille-erreur' : '');
    p.textContent = texte;
    p.title = `${libelle(colId)} : ${texte}`;
    const couleur = erreur ? null : couleurPastille(colId, texte);
    if (couleur) { p.style.background = couleur.fond; p.style.color = couleur.texte; }
    return p;
  });
}

/* ══════════════════════════════════════════════════════════════
   4. GRILLE DE CARTES
   ══════════════════════════════════════════════════════════════ */

function afficherGrille() {
  const grille = document.getElementById('grille');
  grille.innerHTML = '';
  document.getElementById('titre-table').textContent = '🖼️ ' + (ETAT.table || 'Galerie');

  if (!ETAT.colonnes || !ETAT.colonnes.Titre) {
    grille.appendChild(message('Associez au moins la colonne « Titre » dans le panneau de droite de Grist '
      + '(section « Colonnes » du widget), puis, si vous le souhaitez, le texte principal et le contexte.'));
    document.getElementById('compte').textContent = '0';
    document.getElementById('bandeau-notepad').hidden = true;
    document.getElementById('btn-nouvelle').disabled = true;
    return;
  }
  document.getElementById('btn-nouvelle').disabled = false;

  majBandeauNotepad();

  const visibles = ETAT.lignes.filter(correspondRecherche);
  document.getElementById('compte').textContent = visibles.length === ETAT.lignes.length
    ? String(ETAT.lignes.length) : `${visibles.length} / ${ETAT.lignes.length}`;

  if (!visibles.length) {
    grille.appendChild(message(ETAT.lignes.length ? 'Aucune carte ne correspond à la recherche.' : 'Aucune ligne à afficher.'));
    return;
  }
  visibles.forEach(ligne => grille.appendChild(construireCarte(ligne)));
}

/**
 * Règle commune avec le Kanban (../_commun/recherche.js) : tous les mots,
 * dans toutes les colonnes reçues de Grist, accents ignorés ; #12 cherche
 * la ligne n° 12.
 */
function correspondRecherche(ligne) {
  return Recherche.ligneCorrespond(ligne, ETAT.recherche, ETAT.structureRecherche);
}

/**
 * Structure de la table pour la recherche (types, noms des références) :
 * lue à la première recherche, relue quand les données ont changé.
 */
function assurerStructureRecherche() {
  if (ETAT.structureAJour || ETAT.structureEnCours) return;
  ETAT.structureEnCours = (async () => {
    try {
      const table = ETAT.table || await grist.getTable().getTableId();
      ETAT.structureRecherche = await Recherche.lireStructure(table);
    } catch (err) {
      // Sans structure, la recherche parcourt quand même les textes
      console.error('Galerie – structure de la table illisible pour la recherche :', err);
    }
    ETAT.structureAJour = true;   // même en cas d'échec : pas de nouvel essai à chaque touche
    ETAT.structureEnCours = null;
    if (ETAT.recherche.trim()) afficherGrille();
  })();
}

function construireCarte(ligne) {
  const carte = document.createElement('article');
  carte.className = 'carte' + (ligne.id === ETAT.selection ? ' selectionnee' : '');
  carte.dataset.id = ligne.id;

  const titre = document.createElement('div');
  titre.className = 'carte-titre';
  titre.textContent = ligne[ETAT.colonnes.Titre] || '(sans titre)';
  carte.appendChild(titre);

  // Pastilles : toutes les colonnes associées comme « Pastilles », non vides
  const pastilles = document.createElement('div');
  pastilles.className = 'carte-contexte';
  colonnesPastilles().forEach(colId => pastilles.append(...creerPastilles(colId, ligne[colId])));
  if (pastilles.children.length) carte.appendChild(pastilles);
  // Pas d'aperçu du texte principal : la carte reste concise (titre et
  // pastilles) ; le texte se lit dans la fiche. La place libre en bas de
  // carte pourra accueillir une image plus tard.

  carte.addEventListener('click', () => ouvrirFiche(ligne.id));
  return carte;
}

function message(texte) {
  const div = document.createElement('div');
  div.className = 'message';
  div.textContent = texte;
  return div;
}

/* ══════════════════════════════════════════════════════════════
   5. FICHE
   ══════════════════════════════════════════════════════════════ */

const panneau = () => document.getElementById('fiche');

function ficheModifiee() { return Object.keys(ETAT.fiche.modifs).length > 0; }

function ouvrirFiche(id) {
  if (ficheModifiee() && ETAT.fiche.id !== id) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  ETAT.fiche = { id, nouvelle: false, modifs: {} };
  remplirFiche(id);
  Fiche.ouvrir(panneau());
  // Déplace le curseur de Grist sur la ligne : les vues liées à ce widget
  // (« Sélectionner par ») suivent la carte ouverte.
  grist.setCursorPos({ rowId: id }).catch(() => {});
}

/**
 * Ouvre une fiche vide pour une nouvelle carte, avec le modèle de texte.
 * Rien n'est créé dans Grist avant « Sauvegarder » : fermer la fiche ne
 * laisse donc aucune ligne vide.
 */
function ouvrirNouvelleFiche() {
  if (ficheModifiee()) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  ETAT.fiche = { id: null, nouvelle: true, modifs: {} };
  remplirFiche(null);
  Fiche.ouvrir(panneau());
  const titre = document.querySelector('#fiche-corps .fiche-titre');
  if (titre && !titre.readOnly) titre.focus();
}

function remplirFiche(id) {
  const nouvelle = ETAT.fiche.nouvelle;
  // Nouvelle carte : une ligne « vierge », avec le modèle comme texte.
  const ligne = nouvelle
    ? { id: null, [ETAT.colonnes.Description]: ETAT.modele }
    : ETAT.lignes.find(l => l.id === id);
  if (!ligne) { fermerFiche(true); return; }   // ligne supprimée ou filtrée entre-temps

  document.getElementById('fiche-libelle').textContent = nouvelle ? 'Nouvelle carte' : 'Fiche';
  const corps = document.getElementById('fiche-corps');
  corps.innerHTML = '';

  // Titre (en lecture seule si la colonne est calculée par une formule)
  const colTitre = ETAT.colonnes.Titre;
  const titre = Fiche.champTitre(ligne[colTitre] ?? '', {
    placeholder:   nouvelle ? 'Titre de la nouvelle carte' : '',
    lectureSeule:  estFormule(colTitre),
    surChangement: (texte) => noterModif(colTitre, texte),
  });
  // En-tête (styles dans ../_commun/fiche.css) :
  //   à gauche, le titre puis les objets liés ;
  //   à droite (au centre) ou dessous (sur le côté), les pastilles.
  const entete = document.createElement('div');
  entete.className = 'fiche-entete';
  const principal = document.createElement('div');
  principal.className = 'fiche-entete-principal';
  const encart = document.createElement('div');
  encart.className = 'fiche-entete-pastilles';
  entete.append(principal, encart);
  corps.appendChild(entete);

  principal.appendChild(titre);
  if (estFormule(colTitre)) {
    // Une infobulle ne se découvre qu'en survolant : on l'écrit en clair.
    const note = document.createElement('div');
    note.className = 'fiche-titre-note';
    note.textContent = '🔒 Calculé par une formule : non modifiable ici';
    principal.appendChild(note);
  }

  // Une nouvelle carte n'a encore ni objets liés, ni pastilles, ni contexte
  // (non modifiables dans la fiche pour l'instant) : on passe au texte.
  if (!nouvelle) remplirEntete(ligne, principal, encart, corps);

  // Texte principal en Markdown
  const colTexte = ETAT.colonnes.Description;
  if (colTexte) {
    const lib = document.createElement('div');
    lib.className = 'fiche-libelle-texte';
    lib.textContent = libelle(colTexte);
    corps.appendChild(lib);
    if (estFormule(colTexte)) {
      const rendu = document.createElement('div');
      rendu.className = 'fiche-md-rendu';
      rendu.innerHTML = Fiche.markdownVersHtml(ligne[colTexte]);   // HTML déjà nettoyé
      corps.appendChild(rendu);
    } else {
      corps.appendChild(Fiche.champMarkdown(ligne[colTexte], (texte) => noterModif(colTexte, texte)));
    }
  }

  ETAT.fiche.modifs = {};
  majIndicateur();
}

/** En-tête d'une carte existante : objets liés, pastilles et contexte. */
function remplirEntete(ligne, principal, encart, corps) {
  // Objets liés : une ligne par colonne, « LIBELLÉ  [élément] [élément]… »
  colonnesObjetsLies().forEach(colId => {
    const ligneLies = document.createElement('div');
    ligneLies.className = 'fiche-lies';
    const lib = document.createElement('span');
    lib.className = 'fiche-lies-libelle';
    lib.textContent = libelle(colId);
    const elements = valeurContexte(colId, ligne[colId]);
    if (!elements.length) {
      const vide = document.createElement('span');
      vide.className = 'fiche-lies-vide';
      vide.textContent = '—';
      elements.push(vide);
    }
    ligneLies.append(lib, ...elements);
    principal.appendChild(ligneLies);
  });

  // Pastilles colorées, sans libellé (rappelé au survol) ; vides omises
  colonnesPastilles().forEach(colId => encart.append(...creerPastilles(colId, ligne[colId])));

  // Contexte : paires « libellé : valeur », même vides (« — »)
  const contexte = colonnesContexte();
  if (contexte.length) {
    const liste = document.createElement('dl');
    liste.className = 'fiche-contexte';
    contexte.forEach(colId => liste.append(...ligneEntete(colId, valeurContexte(colId, ligne[colId]))));
    corps.appendChild(liste);
  }
}

/** Une ligne de l'en-tête de la fiche : libellé, puis les éléments donnés (ou « — »). */
function ligneEntete(colId, elements) {
  const dt = document.createElement('dt');
  dt.textContent = libelle(colId);
  const dd = document.createElement('dd');
  if (elements.length) dd.append(...elements); else dd.textContent = '—';
  return [dt, dd];
}

/**
 * Valeur d'une colonne de contexte : un texte simple, ou, pour une liste
 * (les tâches d'un EPIC…), une pastille blanche par élément, plus lisible
 * qu'une énumération séparée par des virgules.
 */
function valeurContexte(colId, valeur) {
  const elements = elementsAffiches(colId, valeur);
  const estListe = Array.isArray(valeur) && !estErreur(valeur);
  if (!estListe) return elements.length ? [document.createTextNode(elements.join(', '))] : [];
  const bloc = document.createElement('div');
  bloc.className = 'fiche-liste';
  elements.forEach(texte => {
    const puce = document.createElement('span');
    puce.className = 'fiche-liste-element';
    puce.textContent = texte;
    bloc.appendChild(puce);
  });
  return elements.length ? [bloc] : [];
}

function noterModif(colId, valeur) {
  ETAT.fiche.modifs[colId] = valeur;
  majIndicateur();
}

function majIndicateur() {
  document.getElementById('fiche-modifie').classList.toggle('visible', ficheModifiee());
  // Une nouvelle carte peut être créée telle quelle (avec le modèle) ;
  // une carte existante seulement s'il y a quelque chose à enregistrer.
  document.getElementById('fiche-sauver').disabled = !(ficheModifiee() || ETAT.fiche.nouvelle);
}

async function sauverFiche() {
  if (ETAT.fiche.nouvelle) { await creerCarte(); return; }
  if (!ficheModifiee() || ETAT.fiche.id === null) return;
  const bouton = document.getElementById('fiche-sauver');
  bouton.disabled = true;
  bouton.textContent = '…';
  try {
    await grist.docApi.applyUserActions([['UpdateRecord', ETAT.table, ETAT.fiche.id, ETAT.fiche.modifs]]);
    ETAT.fiche.modifs = {};
    afficherToast('✓ Modifications sauvegardées');
  } catch (err) {
    afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Galerie – erreur de sauvegarde :', err);
  } finally {
    bouton.textContent = '✓ Sauvegarder';
    majIndicateur();
  }
}

/**
 * Crée dans Grist la carte de la fiche « nouvelle carte » : titre saisi,
 * texte principal (le modèle, éventuellement modifié). La fiche reste
 * ouverte sur la carte créée.
 */
async function creerCarte() {
  const colTitre = ETAT.colonnes.Titre;
  const colTexte = ETAT.colonnes.Description;
  if (!estFormule(colTitre) && !String(ETAT.fiche.modifs[colTitre] || '').trim()) {
    afficherToast('⚠️ Saisissez un titre avant de sauvegarder', 3000);
    const titre = document.querySelector('#fiche-corps .fiche-titre');
    if (titre) titre.focus();
    return;
  }
  // Le modèle d'abord, puis ce qui a été saisi (qui l'emporte).
  const champs = {};
  if (colTexte && !estFormule(colTexte) && ETAT.modele) champs[colTexte] = ETAT.modele;
  Object.assign(champs, ETAT.fiche.modifs);

  const bouton = document.getElementById('fiche-sauver');
  bouton.disabled = true;
  bouton.textContent = '…';
  try {
    const resultat = await grist.docApi.applyUserActions([['AddRecord', ETAT.table, null, champs]]);
    const id = resultat.retValues[0];   // numéro de la ligne créée
    ETAT.fiche = { id, nouvelle: false, modifs: {} };
    grist.setCursorPos({ rowId: id }).catch(() => {});
    if (await attendreLigne(id)) {
      remplirFiche(id);
      afficherToast('✓ Carte créée');
    } else {
      // Grist ne l'a pas renvoyée : un filtre de la vue la masque.
      fermerFiche(true);
      afficherToast(`✓ Carte créée (ligne n° ${id}) ; elle est peut-être masquée par un filtre de la vue`, 6000);
    }
  } catch (err) {
    afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Galerie – erreur de création :', err);
  } finally {
    bouton.textContent = '✓ Sauvegarder';
    majIndicateur();
  }
}

/**
 * Attend que Grist renvoie (par onRecords) une ligne qui vient d'être
 * créée. Renvoie false si elle n'arrive pas : elle est alors filtrée.
 */
async function attendreLigne(id, delaiMax = 2000) {
  for (let attente = 0; attente < delaiMax; attente += 100) {
    if (ETAT.lignes.some(l => l.id === id)) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return ETAT.lignes.some(l => l.id === id);
}

function fermerFiche(force = false) {
  if (ficheModifiee() && !force) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  Fiche.fermer(panneau());
  ETAT.fiche = { id: null, nouvelle: false, modifs: {} };
  majIndicateur();
}

function afficherToast(texte, duree = 2200) {
  const toast = document.getElementById('toast');
  toast.textContent = texte;
  toast.classList.add('visible');
  clearTimeout(afficherToast.minuteur);
  afficherToast.minuteur = setTimeout(() => toast.classList.remove('visible'), duree);
}

/* ══════════════════════════════════════════════════════════════
   6. RÉGLAGES (bouton ⚙) : MODÈLE DES NOUVELLES CARTES
   ══════════════════════════════════════════════════════════════ */

const fenetreReglages = () => document.getElementById('reglages');

/** Carte dont on peut reprendre le texte : celle ouverte, sinon celle sélectionnée. */
function carteSource() {
  const id = ETAT.fiche.id ?? ETAT.selection;
  return ETAT.lignes.find(l => l.id === id) || null;
}

function ouvrirReglages() {
  document.getElementById('reglages-modele').value = ETAT.modele;
  const bouton = document.getElementById('reglages-reprendre');
  const source = carteSource();
  const colTexte = ETAT.colonnes && ETAT.colonnes.Description;
  bouton.disabled = !(source && colTexte);
  bouton.textContent = bouton.disabled
    ? 'Reprendre le texte d\'une carte : ouvrez ou sélectionnez-la d\'abord'
    : `↧ Reprendre le texte de « ${source[ETAT.colonnes.Titre] || '(sans titre)'} »`;
  fenetreReglages().showModal();
}

function reprendreTexteCarte() {
  const source = carteSource();
  const colTexte = ETAT.colonnes && ETAT.colonnes.Description;
  if (!source || !colTexte) return;
  // Un ancien texte Notepad est repris directement en Markdown.
  document.getElementById('reglages-modele').value = Fiche.notepadVersMarkdown(String(source[colTexte] || ''));
}

async function enregistrerReglages() {
  const modele = document.getElementById('reglages-modele').value;
  try {
    await grist.setOption('modele', modele);
    ETAT.modele = modele;
    fenetreReglages().close();
    afficherToast('✓ Modèle enregistré');
  } catch (err) {
    afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Galerie – enregistrement des réglages impossible :', err);
  }
}

/* ══════════════════════════════════════════════════════════════
   7. CONVERSION DES ANCIENS TEXTES « NOTEPAD »
   Le widget Notepad de Grist enregistrait ses textes en JSON. Ils sont
   déjà affichés convertis ; ce bandeau propose de les réécrire en
   Markdown dans Grist, une fois pour toutes. Il disparaît de lui-même
   quand il n'y a plus rien à convertir.
   ══════════════════════════════════════════════════════════════ */

/** Colonne du texte principal, si elle peut être réécrite (sinon null). */
function colonneTexteModifiable() {
  const col = ETAT.colonnes && ETAT.colonnes.Description;
  return col && !estFormule(col) ? col : null;
}

function majBandeauNotepad() {
  const bandeau = document.getElementById('bandeau-notepad');
  const col = colonneTexteModifiable();
  const nb = col ? ETAT.lignes.filter(l => Fiche.estNotepad(l[col])).length : 0;
  bandeau.hidden = nb === 0;
  if (nb) {
    document.getElementById('bandeau-notepad-texte').textContent =
      `${nb} texte${nb > 1 ? 's' : ''} au format de l'ancien widget Notepad `
      + '(affichés ici convertis, mais enregistrés tels quels dans Grist).';
  }
}

async function convertirNotepad() {
  const col = colonneTexteModifiable();
  if (!col) return;
  // On lit la table entière : les lignes masquées par un filtre ou par
  // « Sélectionner par » sont converties aussi.
  const table = await grist.docApi.fetchTable(ETAT.table);
  const ids = [], textes = [];
  table.id.forEach((id, i) => {
    if (Fiche.estNotepad(table[col][i])) {
      ids.push(id);
      textes.push(Fiche.notepadVersMarkdown(table[col][i]));
    }
  });
  if (!ids.length) { afficherToast('Rien à convertir'); return; }

  const ok = confirm(`${ids.length} texte(s) de la colonne « ${libelle(col)} » (table ${ETAT.table}) `
    + 'vont être réécrits en Markdown, y compris dans les lignes masquées par un filtre.\n\n'
    + 'Le souligné, les couleurs et le surlignage seront perdus (le texte reste).\n'
    + 'Le widget Notepad ne saura plus les afficher.\n\nContinuer ?');
  if (!ok) return;

  const bouton = document.getElementById('bandeau-notepad-bouton');
  bouton.disabled = true;
  try {
    // Une seule action : un Ctrl+Z dans Grist annule toute la conversion.
    await grist.docApi.applyUserActions([['BulkUpdateRecord', ETAT.table, ids, { [col]: textes }]]);
    afficherToast(`✓ ${ids.length} texte(s) converti(s) en Markdown`, 3000);
  } catch (err) {
    // Le pare-feu devant Grist peut refuser un envoi contenant du SQL : on
    // repasse ligne par ligne, pour convertir tout ce qui peut l'être.
    console.warn('Galerie – conversion groupée refusée, essai ligne par ligne :', err);
    const echecs = [];
    for (let i = 0; i < ids.length; i++) {
      try {
        await grist.docApi.applyUserActions([['UpdateRecord', ETAT.table, ids[i], { [col]: textes[i] }]]);
      } catch (e) {
        echecs.push(ids[i]);
        console.error(`Galerie – ligne ${ids[i]} non convertie :`, e);
      }
    }
    afficherToast(echecs.length
      ? `⚠️ ${ids.length - echecs.length} converti(s), ${echecs.length} refusé(s) : lignes ${echecs.join(', ')}`
      : `✓ ${ids.length} texte(s) converti(s) en Markdown`, 6000);
  } finally {
    bouton.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════════
   8. ÉVÉNEMENTS DE LA PAGE
   ══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  Fiche.installer(panneau(), {
    actions: document.getElementById('fiche-actions'),
    fermer:  () => fermerFiche(),
  });
  document.getElementById('fiche-fermer').addEventListener('click', () => fermerFiche());
  document.getElementById('fiche-annuler').addEventListener('click', () => fermerFiche());
  document.getElementById('fiche-sauver').addEventListener('click', sauverFiche);
  document.getElementById('btn-nouvelle').addEventListener('click', ouvrirNouvelleFiche);
  document.getElementById('btn-reglages').addEventListener('click', ouvrirReglages);
  document.getElementById('reglages-reprendre').addEventListener('click', reprendreTexteCarte);
  document.getElementById('reglages-enregistrer').addEventListener('click', enregistrerReglages);
  document.getElementById('reglages-annuler').addEventListener('click', () => fenetreReglages().close());
  document.getElementById('bandeau-notepad-bouton').addEventListener('click', () =>
    convertirNotepad().catch(err => afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000)));
  document.getElementById('recherche').addEventListener('input', (e) => {
    ETAT.recherche = e.target.value;
    if (ETAT.recherche.trim()) assurerStructureRecherche();
    afficherGrille();
  });
  document.addEventListener('keydown', (e) => {
    // Réglages ouverts : Échap ferme seulement leur fenêtre (géré par le navigateur).
    if (fenetreReglages().open) return;
    if (e.key === 'Escape' && panneau().classList.contains('open')) fermerFiche();
  });
});
