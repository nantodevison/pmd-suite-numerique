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
   Filtres et vues enregistrées (#204), communs avec le Kanban
   (../_commun/filtres.js et ../_commun/vues.js) : on filtre sur n'importe
   quelle colonne Choix ou Référence de la table, et on garde ses réglages
   dans des vues 👥 partagées ou 🔒 personnelles. Le filtrage natif de Grist
   (« Sélectionner par », filtres de la vue Grist) reste possible : il
   choisit les lignes envoyées au widget, nos filtres s'appliquent ensuite.
   Tri (#232), commun avec le Kanban (../_commun/tri.js) : sur n'importe
   quelle colonne de la table, enregistré dans la vue. Sans tri, ou à
   égalité, les cartes gardent l'ordre envoyé par Grist (tri de la vue Grist).
   ══════════════════════════════════════════════════════════════ */

'use strict';

const ETAT = {
  lignes:     [],     // lignes reçues de Grist
  colonnes:   null,   // association : { Titre: 'colId', Description: 'colId', Pastilles: [...], Contexte: [...] }
  table:      null,   // identifiant de la table affichée
  docNom:     null,   // identifiant du document (clés de mémoire du navigateur)
  // Filtres affichés (format de ../_commun/filtres.js) et tri affiché
  // (format de ../_commun/tri.js : [{ col, sens }], #232)
  filtres:    [],
  tri:        [],
  // Colonnes de la table, d'après la structure du document (#204) :
  // toutes (pour le tri et les attributs d'une référence), et celles qu'on peut filtrer
  colonnesTable:      [],
  colonnesFiltrables: [],
  optionsChargees: false,   // vues lues à l'ouverture seulement (voir onOptions)
  // Structure du document (libellés, types, couleurs des choix…), lue une
  // fois par table affichée : voir ../_commun/colonnes.js
  doc:        null,
  recherche:  '',     // texte saisi dans la recherche (règle : ../_commun/recherche.js)
  selection:  null,   // numéro de la ligne sélectionnée dans Grist
  // Carte affichée dans la fiche : numéro de ligne (null pour une nouvelle
  // carte, pas encore créée dans Grist) et colonnes modifiées.
  fiche:      { id: null, nouvelle: false, modifs: {} },
  modele:     '',     // texte de départ des nouvelles cartes (réglage ⚙)
};

/* Registre des vues enregistrées (#204), commun avec le Kanban : voir
   ../_commun/vues.js. Vues 👥 partagées dans les options du widget (chaque
   Galerie a les siennes), vues 🔒 perso et vue active dans le navigateur.
   Pas de contexte (la Galerie n'a pas de projet) : toutes les vues
   s'affichent. Créé ici, avant que Grist n'appelle onOptions. */
const VUES = Vues.creer({
  cle: (nom) => cleMemoire(nom),
  prevenir: (message, duree) => afficherToast(message, duree),
});

/**
 * Clé de mémoire du navigateur pour la donnée `nom` ('vueActive',
 * 'vuesPerso', 'attributs'), ou null si le document est encore inconnu.
 * Tous les widgets publiés sur nantodevison.github.io partagent cette
 * mémoire : la clé contient donc le document et la table. Deux Galeries
 * sur la même table partagent ainsi leurs vues perso (accepté, #204).
 * NE PAS CHANGER le format de ces clés : chacun perdrait ses vues perso.
 */
function cleMemoire(nom) {
  if (!ETAT.docNom || !ETAT.table) return null;
  return `galerie.${nom}.${ETAT.docNom}.${ETAT.table}`;
}

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

// Identifiants du document et de la table, lus une fois au chargement : ils
// composent les clés de mémoire du navigateur (vues perso, vue active). On
// garde la « promesse » pour pouvoir les attendre avant de lire les vues.
const _identitePrete = (async () => {
  try { ETAT.docNom = await grist.docApi.getDocName(); }
  catch (err) { console.warn('Galerie – nom du document introuvable :', err); }
  try { ETAT.table = ETAT.table || await grist.getTable().getTableId(); }
  catch (err) { console.warn('Galerie – nom de la table introuvable :', err); }
})();

// includeColumns 'normal' : toutes les colonnes de la table, même masquées
// dans le widget. Sinon une colonne masquée serait proposée dans les filtres
// sans aucune valeur (même choix que le Kanban).
grist.onRecords(async (lignes, colonnes) => {
  ETAT.lignes   = lignes;
  ETAT.colonnes = colonnes;
  try {
    await chargerInfosColonnes();
  } catch (err) {
    // Sans ces informations, le widget fonctionne quand même : libellés =
    // identifiants des colonnes, pastilles sans les couleurs de Grist, et
    // pas de filtre (on ne sait pas quelles colonnes sont des choix).
    console.error('Galerie – lecture de la structure impossible :', err);
  }
  afficherGrille();
  // Fiche ouverte sans modification en cours : on la rafraîchit avec les
  // nouvelles valeurs (par exemple juste après une sauvegarde).
  if (ETAT.fiche.id !== null && !ficheModifiee()) remplirFiche(ETAT.fiche.id);
}, { includeColumns: 'normal' });

// Réglages du widget, enregistrés dans le document Grist (grist.setOption) :
// chaque Galerie (EPICs, OKR…) garde les siens.
grist.onOptions(async (options) => {
  ETAT.modele = (options && options.modele) || '';
  // Vues enregistrées (#204) : lues à l'ouverture seulement. Grist rappelle
  // onOptions après chaque setOption (une vue partagée créée, le modèle…),
  // parfois dans le désordre : relire ramènerait un état périmé. Le widget
  // étant seul à les écrire, sa copie en mémoire fait foi.
  if (ETAT.optionsChargees) return;
  ETAT.optionsChargees = true;   // tout de suite : onOptions peut revenir pendant l'attente
  await _identitePrete;           // les clés de mémoire en dépendent
  VUES.charger(options && options.vues);
  appliquerVue();
  afficherGrille();
});

grist.onRecord((ligne) => {
  ETAT.selection = ligne ? ligne.id : null;
  document.querySelectorAll('.carte').forEach(c =>
    c.classList.toggle('selectionnee', Number(c.dataset.id) === ETAT.selection));
});

/**
 * Lit la structure du document (libellés, types, formules, couleurs des
 * choix : ../_commun/colonnes.js), une fois par table affichée.
 * Les noms des références n'ont pas à être lus : Grist les envoie déjà.
 */
async function chargerInfosColonnes() {
  const table = await grist.getTable().getTableId();
  if (table !== ETAT.table) { ETAT.table = table; ETAT.doc = null; }
  if (!ETAT.doc) {
    ETAT.doc = await Colonnes.lireDocument();
    preparerColonnesFiltrables();
  }
}

/**
 * Colonnes de la table pour les filtres (#204), d'après la structure du
 * document. Seules les colonnes Choix, Choix multiple, Référence et Liste
 * de références sont filtrables (même règle que le Kanban). Une colonne
 * « rapportée » d'une autre table ($Projet.Statut) est nommée
 * « Projet › Statut » : elle sert d'attribut à sa référence (#223).
 */
function preparerColonnesFiltrables() {
  ETAT.colonnesTable = ETAT.doc.colonnes(ETAT.table).map(c => {
    const r = c.rapportee;
    return {
      colId:    c.colId,
      type:     c.type,
      label:    r ? `${r.via} › ${r.attribut}` : c.libelle,
      ref:      r ? r.colRef : null,     // référence dont elle est un attribut
      attribut: r ? r.attribut : null,   // libellé court de l'attribut
    };
  }).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  ETAT.colonnesFiltrables = ETAT.colonnesTable
    .filter(c => /^(Choice|ChoiceList|Ref:.+|RefList:.+)$/.test(c.type));
}

/* ══════════════════════════════════════════════════════════════
   2. LECTURE DES VALEURS
   ══════════════════════════════════════════════════════════════ */

/**
 * Description d'une colonne de la table affichée (voir ../_commun/colonnes.js),
 * ou une description minimale si la structure n'a pas pu être lue.
 */
function info(colId) {
  return (ETAT.doc && ETAT.doc.colonne(ETAT.table, colId))
    || { libelle: colId, type: '', formule: false, couleurs: {}, pourcentage: false };
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

function libelle(colId) { return info(colId).libelle; }

function estFormule(colId) { return info(colId).formule; }

/**
 * Valeur d'une cellule sous forme d'une liste de textes : un seul élément
 * en général, plusieurs pour une liste (références multiples, choix
 * multiples). Les éléments vides sont retirés.
 */
function elementsAffiches(colId, valeur) {
  const colonne = info(colId);
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
 * Texte affiché d'une valeur simple, selon la description de sa colonne
 * (`colonne`, donnée par info()).
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
  const colonne = info(colId);
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
  // Barre des vues (onglets, « 🔽 Filtres ») et bas de « Gérer la vue »
  majBarreVues();
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

  const visibles = lignesVisibles();
  document.getElementById('compte').textContent = visibles.length === ETAT.lignes.length
    ? String(ETAT.lignes.length) : `${visibles.length} / ${ETAT.lignes.length}`;

  if (!visibles.length) {
    grille.appendChild(message(ETAT.lignes.length
      ? 'Aucune carte ne correspond aux filtres ou à la recherche.'
      : 'Aucune ligne à afficher.'));
    return;
  }
  visibles.forEach(ligne => grille.appendChild(construireCarte(ligne)));
}

/**
 * Lignes affichées : celles qui respectent les filtres de la vue ET la
 * recherche, rangées selon le tri de la vue (#232).
 */
function lignesVisibles() {
  const lignes = ETAT.lignes.filter(l => respecteFiltres(l) && correspondRecherche(l));
  if (ETAT.tri.length) {
    // Type et choix déclarés de chaque colonne du tri (ordre des choix de Grist…)
    const infos = Object.fromEntries(ETAT.tri.map(c => [c.col, info(c.col)]));
    // Le tri du navigateur est « stable » : à égalité, deux cartes gardent
    // leur ordre de départ, celui envoyé par Grist.
    lignes.sort((a, b) => Tri.comparerLignes(a, b, ETAT.tri, infos));
  }
  return lignes;
}

/**
 * Règle commune avec le Kanban (../_commun/filtres.js) : une carte doit
 * respecter tous les filtres (« et ») ; dans un filtre, une seule des
 * valeurs cochées suffit (« ou »).
 */
function respecteFiltres(ligne) {
  return ETAT.filtres.every(f => Filtres.ligneRespecte(ligne, f));
}

/**
 * Règle commune avec le Kanban (../_commun/recherche.js) : tous les mots,
 * dans toutes les colonnes reçues de Grist, accents ignorés ; #12 cherche
 * la ligne n° 12.
 */
function correspondRecherche(ligne) {
  return Recherche.ligneCorrespond(ligne, ETAT.recherche);
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
   4 bis. FILTRES ET VUES ENREGISTRÉES (#204)
   La barre des vues, ses petits panneaux, la fenêtre « Gérer la vue » et
   les panneaux des filtres et du tri (#232) sont construits par les
   modules communs avec le Kanban (../_commun/vues.js, filtres.js et
   tri.js). La Galerie leur prête son état affiché (ETAT.filtres, ETAT.tri)
   et ses cartes, et redessine la grille quand ils changent quelque chose.
   ══════════════════════════════════════════════════════════════ */

let UI_VUES = null;          // interface des vues, créée au chargement de la page
let PANNEAU_FILTRES = null;  // panneau des filtres, dans l'onglet Filtres de « Gérer la vue »
let PANNEAU_TRI = null;      // panneau du tri, dans l'onglet Tri de « Gérer la vue » (#232)

/** Filtres et tri de la vue active, copiés : les modifier ne touche pas la vue. */
function appliquerVue() {
  const vue = VUES.active();
  ETAT.filtres = vue ? Filtres.copier(vue.filtres) : [];
  // Tri.nettoyer renvoie une copie bien formée (la vue vient du document ou du navigateur)
  ETAT.tri = vue ? Tri.nettoyer(vue.tri) : [];
}

/** Onglets des vues, étiquettes des filtres et bas de « Gérer la vue », à jour. */
function majBarreVues() {
  if (!UI_VUES) return;
  PANNEAU_FILTRES.dessinerEtiquettes();   // qui met aussi à jour « 🔽 Filtres »
  UI_VUES.dessinerBarre();
  UI_VUES.majFenetre();
}

/** Colonnes rapportées de la référence `colId` (ex. pour 'Projet' : Projet › Statut). */
function attributsDe(colId) {
  return ETAT.colonnesTable.filter(c => c.ref === colId);
}

/** Couleur Grist d'un choix ({ fond, texte }), ou null s'il n'en a pas. */
function styleChoix(colId, texte) {
  return info(colId).couleurs[texte] || null;
}

function creerPanneauFiltres(zone) {
  PANNEAU_FILTRES = Filtres.creerPanneau({
    zone,
    colonnes:         () => ETAT.colonnesFiltrables,
    filtres:          () => ETAT.filtres,
    remplacerFiltres: (liste) => { ETAT.filtres = liste; },
    lignes:           () => ETAT.lignes,
    choixDe:          (colId) => info(colId).choix,   // ordre des choix de Grist (#236)
    styleChoix,
    attributsDe,
    // Attributs affichés (#223) : retenus par le navigateur, comme les vues perso
    memoire:          Filtres.memoireAttributs(() => cleMemoire('attributs')),
    surChangement:    afficherGrille,
    // Résumés de la barre, à jour après chaque dessin des étiquettes
    surEtiquettes:    () => {
      if (UI_VUES) UI_VUES.majBoutonFiltres();
      if (PANNEAU_TRI) PANNEAU_TRI.majBouton();
    },
  });
  return PANNEAU_FILTRES;
}

/**
 * Panneau du tri (#232), commun avec le Kanban : toutes les colonnes de la
 * table sont proposées (plus « # Numéro », ajouté par le module).
 * « ＋ Ajouter un critère » propose d'abord une colonne de pastilles, puis
 * le titre : ce que l'on voit sur la carte.
 */
function creerPanneauTri(zone) {
  PANNEAU_TRI = Tri.creerPanneau({
    zone,
    bouton:        document.getElementById('tri-bouton'),
    colonnes:      () => ETAT.colonnesTable,
    typeDe:        (colId) => info(colId).type,
    tri:           () => ETAT.tri,
    remplacerTri:  (tri) => { ETAT.tri = tri; },
    preferees:     () => [...colonnesPastilles(), ETAT.colonnes && ETAT.colonnes.Titre],
    texteVide:     'Aucun tri choisi : les cartes suivent l\'ordre de Grist.',
    aide:          'Les cartes sans valeur restent en bas ; à égalité, l\'ordre de Grist départage.',
    bulleVide:     'Trier les cartes (par défaut : ordre de Grist)',
    surChangement: afficherGrille,
  });
}

function creerInterfaceVues() {
  creerPanneauTri(document.getElementById('fv-tri'));   // avant l'interface, qui reçoit son onglet
  UI_VUES = Vues.creerInterface(VUES, {
    barre:            document.getElementById('barre-vues'),
    zoneVues:         document.getElementById('view-tabs'),
    zoneResumes:      document.getElementById('resumes-vue'),
    filtres:          () => ETAT.filtres,
    remplacerFiltres: (liste) => { ETAT.filtres = liste; },
    tri:              () => ETAT.tri,
    remplacerTri:     (tri) => { ETAT.tri = tri; },
    nettoyerTri:      Tri.nettoyer,
    appliquerVue,
    redessiner:       afficherGrille,
    compter:          () => ({ affichees: lignesVisibles().length, total: ETAT.lignes.length }),
    panneauFiltres:   creerPanneauFiltres,
    // Onglet Tri (#232), rempli à chaque ouverture de la fenêtre
    onglets:          [{ id: 'tri', libelle: 'Tri', contenu: document.getElementById('fv-tri') }],
    surOuverture:     () => PANNEAU_TRI.remplir(),
    aideDefaut:       'Toutes les lignes que Grist envoie à la Galerie',
    prevenir:         afficherToast,
  });
}

/**
 * Un petit panneau flottant (vues, filtres) est-il ouvert ? Ceux posés dans
 * la fenêtre « Gérer la vue » (le panneau du tri, #232) ne comptent pas :
 * ils ne sont jamais masqués, ils suivent la fenêtre.
 */
function panneauOuvert() {
  return [...document.querySelectorAll('.filtre-popover')]
    .some(p => !p.classList.contains('hidden') && !p.closest('.fenetre'));
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
      // La fiche reste ouverte, mais la carte peut ne pas figurer dans la
      // grille : les filtres de la vue active la masquent (#204).
      const ligne = ETAT.lignes.find(l => l.id === id);
      afficherToast(respecteFiltres(ligne)
        ? '✓ Carte créée'
        : '✓ Carte créée ; elle est masquée par les filtres de la vue', 4000);
    } else {
      // Grist ne l'a pas renvoyée : un filtre de la vue la masque.
      fermerFiche(true);
      afficherToast(`✓ Carte créée (ligne n° ${id}) ; elle est peut-être masquée par un filtre de Grist `
        + '(« Sélectionner par », filtres de la vue Grist)', 6000);
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
  // Barre des vues et « Gérer la vue » (#204) ; Grist a pu envoyer ses
  // données avant : on dessine la barre tout de suite.
  creerInterfaceVues();
  majBarreVues();
  // « ⇅ Trier » (#232) : ouvre « Gérer la vue » sur l'onglet Tri
  document.getElementById('tri-bouton').addEventListener('click', () => UI_VUES.ouvrirFenetre('tri'));
  // Un clic ailleurs ferme les panneaux des vues et des filtres (sauf sur ce qui en ouvre un)
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.fenetre, .filtre-popover, #vue-ajouter, .vue-menu-btn, .vue-selecteur, .fiche-menu')) return;
    UI_VUES.fermerMenus();
  });

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
    afficherGrille();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Réglages ou « Gérer la vue » ouverts : Échap ne concerne qu'eux
    // (le navigateur ferme lui-même ces fenêtres <dialog>).
    if (fenetreReglages().open || UI_VUES.fenetre.estOuverte()) return;
    // Un panneau des vues ou un filtre ouvert : on le ferme, lui seul
    if (panneauOuvert()) { UI_VUES.fermerMenus(); return; }
    if (panneau().classList.contains('open')) fermerFiche();
  });
});
