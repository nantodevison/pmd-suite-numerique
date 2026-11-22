/* ══════════════════════════════════════════════════════════════
   INTERACTIONS GRIST — interactions.js
   ══════════════════════════════════════════════════════════════

   Journal des interactions d'UN projet (rendez-vous, appels, réunions…),
   ligne à ligne, de la plus récente à la plus ancienne : date, titre, type,
   personnes, et un lien 🔗 vers la note (un document Docs, par exemple).
   Un bouton « ＋ Rendez-vous » en crée une ; un clic sur une ligne ouvre sa
   fiche pour la modifier.

   GÉNÉRIQUE : aucune table ni colonne n'est codée en dur.
     - La TABLE est celle que Grist relie au widget (choisie à son ajout).
     - Les COLONNES s'associent dans le panneau de droite de Grist :
         Date, Titre, Projet (obligatoires) ;
         Type, Personnes, Lien, Description (facultatives).
     - Le PROJET affiché se choisit dans ⚙ (une ligne de la table visée par
       la colonne Projet). Il est gardé dans les options du widget
       (grist.setOption), donc dans le document, après « Enregistrer ».
       Pourquoi pas « Sélectionner par » de Grist ? Une ligne créée par le
       widget ne serait pas reliée d'office au projet : choisi une fois dans
       ⚙, le projet sert à la fois à filtrer et à remplir les nouvelles lignes.

   POURQUOI RELIRE LA TABLE ? Grist n'envoie au widget (onRecords) que les
   colonnes associées, et des références sous leur NOM (#239). On relit donc
   la table (fetchTable), qui donne les valeurs brutes : références sous leur
   NUMÉRO, dates en secondes. De onRecords, on ne garde que les numéros des
   lignes envoyées : les filtres de la vue Grist restent respectés.

   Briques communes utilisées (../_commun/) :
     fiche.js     : panneau de fiche (côté / centre), titre, menus ;
     pastilles.js : pastille colorée du type ;
     colonnes.js  : structure du document et noms des références ;
     fenetre.js   : fenêtre de réglages ⚙.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const ETAT = {
  table:     null,    // identifiant de la table reliée au widget
  doc:       null,    // structure du document (../_commun/colonnes.js), relue à chaque envoi
  colonnes:  null,    // association : { Date: 'colId', Titre: 'colId', … }
  recues:    null,    // numéros des lignes envoyées par Grist (Set) ; null avant le 1er envoi
  donnees:   null,    // la table relue par fetchTable (valeurs brutes, « en colonnes »)
  refProjet:    null, // noms des projets (Colonnes.lireReference), ou null
  refPersonnes: null, // noms des personnes, ou null
  // Réglages ⚙ : { projet: numéro ou null, libelle: texte du bouton }.
  // null tant que les options ne sont pas lues.
  reglages:  null,
  reglagesProposes: false,  // ⚙ ouverte d'office une fois, si aucun projet
  // Fiche ouverte : { id: numéro, ou null pour une création ; defauts ; modifs }
  fiche:     null,
};

const LIBELLE_DEFAUT = 'Rendez-vous';

/* ══════════════════════════════════════════════════════════════
   1. LIEN AVEC GRIST
   ══════════════════════════════════════════════════════════════ */

// grist.ready() doit précéder tout autre appel à l'API Grist.
grist.ready({
  requiredAccess: 'full',   // le widget écrit dans la table et lit celles des projets et des personnes
  columns: [
    { name: 'Date',        title: 'Date', type: 'Date,DateTime' },
    { name: 'Titre',       title: 'Titre', type: 'Text' },
    { name: 'Projet',      title: 'Projet (filtre et nouvelles lignes)', type: 'Ref,RefList' },
    { name: 'Type',        title: 'Type', type: 'Choice', optional: true },
    { name: 'Personnes',   title: 'Personnes', type: 'RefList', optional: true },
    { name: 'Lien',        title: 'Lien vers la note (Docs…)', type: 'Text', optional: true },
    { name: 'Description', title: 'Description (lecture seule)', type: 'Text', optional: true },
  ],
});

// Numéro du dernier envoi de Grist : si un envoi arrive pendant qu'on relit
// les tables pour le précédent, seul le plus récent est affiché.
let _dernierEnvoi = 0;

grist.onRecords(async (lignes, colonnes) => {
  const envoi = ++_dernierEnvoi;
  let doc = null, donnees = null, refProjet = null, refPersonnes = null;
  const table = await grist.getTable().getTableId();
  try {
    // Relue à chaque envoi : un projet ou une personne ajoutés dans Grist
    // apparaissent ainsi sans recharger la page.
    doc = await Colonnes.lireDocument();
  } catch (err) {
    console.error('Interactions – lecture de la structure impossible :', err);
  }
  try {
    donnees = await grist.docApi.fetchTable(table);
  } catch (err) {
    console.error('Interactions – lecture de la table impossible :', err);
  }
  if (doc) {
    refProjet    = await lireReferenceSure(doc, table, colonnes && colonnes.Projet);
    refPersonnes = await lireReferenceSure(doc, table, colonnes && colonnes.Personnes);
  }
  if (envoi !== _dernierEnvoi) return;   // un envoi plus récent est arrivé entre-temps
  Object.assign(ETAT, { table, doc, donnees, refProjet, refPersonnes, colonnes: colonnes || {} });
  ETAT.recues = new Set(lignes.map(l => l.id));
  afficher();
  // Fiche ouverte sans modification : on la redessine avec les valeurs à jour.
  if (ETAT.fiche && !ficheModifiee()) dessinerFiche();
  if (FENETRE.estOuverte()) remplirReglages();
});

/** Noms des lignes visées par une référence ; null si impossible (sans bloquer le reste). */
async function lireReferenceSure(doc, table, colId) {
  if (!colId) return null;
  try {
    return await Colonnes.lireReference(doc, table, colId);
  } catch (err) {
    console.error(`Interactions – lecture de la table visée par ${colId} impossible :`, err);
    return null;
  }
}

// Options du widget (gardées dans le document). Lues à l'ouverture
// seulement : Grist rappelle onOptions après chaque setOption, parfois dans
// le désordre ; le widget étant seul à les écrire, sa copie fait foi.
grist.onOptions((options) => {
  if (ETAT.reglages !== null) return;
  const o = options || {};
  ETAT.reglages = {
    projet:  Number.isInteger(o.projet) && o.projet > 0 ? o.projet : null,
    libelle: typeof o.libelleBouton === 'string' && o.libelleBouton.trim() ? o.libelleBouton.trim() : LIBELLE_DEFAUT,
  };
  afficher();
});

/** Description d'une colonne de la table, ou une description minimale. */
function info(colId) {
  return (ETAT.doc && ETAT.doc.colonne(ETAT.table, colId))
    || { colId, libelle: colId, type: '', typeBase: '', formule: false, couleurs: {}, choix: [], pourcentage: false };
}

/** Colonne associée à un champ du widget (« Date », « Titre »…), ou undefined. */
const col = (champ) => ETAT.colonnes && ETAT.colonnes[champ] || undefined;

/** Valeur brute d'un champ, au rang `i` de la table relue (null si non associé). */
function brute(champ, i) {
  const c = col(champ);
  return c && ETAT.donnees[c] ? ETAT.donnees[c][i] : null;
}

/** Numéros contenus dans une référence ou une liste de références brute. */
function numeros(v) {
  if (Array.isArray(v)) return (v[0] === 'L' ? v.slice(1) : v).filter(n => Number.isInteger(n) && n > 0);
  return Number.isInteger(v) && v > 0 ? [v] : [];
}

/** Colonne calculée par une formule : non modifiable dans la fiche. */
const calculee = (champ) => Boolean(col(champ)) && info(col(champ)).formule;

/* ══════════════════════════════════════════════════════════════
   2. DATES
   Grist range une date en secondes depuis le 1er janvier 1970 :
     Date     : minuit en temps universel du jour choisi ;
     DateTime : l'instant exact, affiché dans le fuseau de la colonne
                (« DateTime:Europe/Paris »).
   On convertit nous-mêmes dans ce fuseau : le résultat ne dépend pas du
   réglage de l'ordinateur.
   ══════════════════════════════════════════════════════════════ */

const avecHeure = () => info(col('Date')).typeBase === 'DateTime';

/** Fuseau de la colonne Date (undefined : celui du navigateur). */
function fuseau() {
  const m = /^DateTime:(.+)$/.exec(info(col('Date')).type);
  if (!m) return undefined;
  try { new Intl.DateTimeFormat('fr-FR', { timeZone: m[1] }); return m[1]; } catch (_) { return undefined; }
}

/** Année, mois, jour, heure, minute d'un instant (ms) dans un fuseau. */
function parties(ms, tz) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  return Object.fromEntries(f.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
}

/** Secondes de Grist → texte du champ de saisie (« AAAA-MM-JJ » ou « AAAA-MM-JJTHH:MM »). */
function versSaisie(secondes) {
  if (typeof secondes !== 'number') return '';
  if (!avecHeure()) return new Date(secondes * 1000).toISOString().slice(0, 10);
  const p = parties(secondes * 1000, fuseau());
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Texte du champ de saisie → secondes de Grist (null si vide ou illisible). */
function depuisSaisie(texte) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(texte || '');
  if (!m) return null;
  const [an, mois, jour, h = 0, min = 0] = m.slice(1).map(x => Number(x || 0));
  const mur = Date.UTC(an, mois - 1, jour, h, min);   // l'heure lue « sur l'horloge »
  if (!avecHeure()) return mur / 1000;
  // On cherche l'instant qui affiche cette heure dans le fuseau de la colonne :
  // on corrige de l'écart observé (deux fois, pour les changements d'heure).
  let ms = mur;
  for (let k = 0; k < 2; k++) {
    const p = parties(ms, fuseau());
    ms += mur - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return Math.round(ms / 1000);
}

/** Date affichée dans la liste : « 10 mars 2026 » (et « · 09:30 » avec l'heure). */
function dateAffichee(secondes) {
  if (typeof secondes !== 'number') return 'Sans date';
  const d = new Date(secondes * 1000);
  const jour = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!avecHeure()) return d.toLocaleDateString('fr-FR', { ...jour, timeZone: 'UTC' });
  const tz = fuseau();
  return d.toLocaleDateString('fr-FR', { ...jour, timeZone: tz })
    + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
}

/** Date d'une nouvelle interaction : maintenant (à la minute), ou aujourd'hui. */
function maintenant() {
  const ms = Math.floor(Date.now() / 60000) * 60000;
  if (avecHeure()) return ms / 1000;
  const d = new Date(ms);   // le jour de l'ordinateur, rangé à minuit universel
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 1000;
}

/* ══════════════════════════════════════════════════════════════
   3. LA LISTE
   ══════════════════════════════════════════════════════════════ */

const contenu = () => document.getElementById('contenu');

/** Lien sûr : seulement une adresse http(s), jamais « javascript: ». null sinon. */
function lienSur(v) {
  const s = String(v ?? '').trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

/** Noms des personnes d'une valeur brute (liste de numéros). */
function nomsPersonnes(v) {
  const ref = ETAT.refPersonnes;
  return numeros(v).map(id => (ref && ref.nom(id)) || `#${id}`);
}

/** Nom d'un projet d'après son numéro. */
function nomProjet(id) {
  return (ETAT.refProjet && ETAT.refProjet.nom(id)) || `n° ${id}`;
}

/**
 * Rangs (dans la table relue) des interactions du projet choisi, parmi les
 * lignes envoyées par Grist, de la plus récente à la plus ancienne (sans
 * date à la fin).
 */
function rangsDuProjet() {
  const t = ETAT.donnees;
  const projet = ETAT.reglages.projet;
  const rangs = [];
  t.id.forEach((id, i) => {
    if (ETAT.recues.has(id) && numeros(brute('Projet', i)).includes(projet)) rangs.push(i);
  });
  const date = (i) => (typeof brute('Date', i) === 'number' ? brute('Date', i) : -Infinity);
  return rangs.sort((a, b) => (date(b) - date(a)) || (t.id[b] - t.id[a]));
}

/** Dessine la liste, ou un message s'il n'y a rien à afficher. */
function afficher() {
  if (ETAT.recues === null || ETAT.reglages === null) return;   // Grist n'a pas encore tout envoyé

  const manquantes = ['Date', 'Titre', 'Projet'].filter(c => !col(c));
  if (manquantes.length) {
    afficherMessage(`Associez les colonnes <strong>${manquantes.join('</strong>, <strong>')}</strong> dans le panneau `
      + 'de droite de Grist (section « Colonnes » du widget).');
    return;
  }
  if (!ETAT.donnees) {
    afficherMessage('⚠️ Impossible de lire la table. Vérifiez que le widget a l\'<strong>accès complet</strong> au document.');
    return;
  }
  const projet = ETAT.reglages.projet;
  if (!projet) {
    afficherMessage('Aucun projet choisi pour cette liste.', true);
    // Première visite : on ouvre directement la fenêtre de choix.
    if (!ETAT.reglagesProposes) { ETAT.reglagesProposes = true; ouvrirReglages(); }
    return;
  }
  if (ETAT.refProjet && !ETAT.refProjet.options.some(o => o.id === projet)) {
    afficherMessage(`⚠️ Le projet choisi (n° ${projet}) n'existe plus dans la table « ${ETAT.refProjet.tableVisee} ».`, true, false);
    return;
  }
  dessinerListe(rangsDuProjet());
}

/**
 * Message à la place de la liste.
 *   html      : true si `texte` est un HTML écrit ICI (jamais un texte de Grist) ;
 *   avecBouton: ajoute « ⚙ Choisir le projet ».
 */
function afficherMessage(texte, avecBouton = false, html = true) {
  majBarre(null);
  const zone = contenu();
  zone.replaceChildren();
  const bloc = document.createElement('div');
  bloc.className = 'message';
  const p = document.createElement('p');
  if (html) p.innerHTML = texte; else p.textContent = texte;
  bloc.appendChild(p);
  if (avecBouton) bloc.appendChild(bouton('⚙ Choisir le projet', 'btn-primary', ouvrirReglages));
  zone.appendChild(bloc);
}

/** Petit bouton. */
function bouton(texte, classe, surClic) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = texte;
  b.addEventListener('click', surClic);
  return b;
}

/**
 * Barre du haut (#249) : « 🤝 Interactions », suivi en gris du nom du
 * projet, le nombre d'interactions et le bouton de création.
 *   nombre : null quand un message remplace la liste ; on n'affiche alors
 *            ni projet, ni nombre, ni bouton de création.
 * textContent partout : le nom du projet vient de Grist, jamais lu comme du HTML.
 */
function majBarre(nombre) {
  const avecListe = nombre !== null;
  const titre = document.getElementById('barre-titre');
  titre.textContent = '🤝 Interactions';
  if (avecListe) {
    const nom = document.createElement('span');
    nom.className = 'barre-nom';
    nom.textContent = ' · ' + nomProjet(ETAT.reglages.projet);
    titre.appendChild(nom);
  }
  const compte = document.getElementById('barre-compte');
  compte.hidden = !avecListe;
  compte.textContent = avecListe ? String(nombre) : '';
  compte.title = !avecListe ? '' : (nombre > 1 ? `${nombre} interactions` : `${nombre} interaction`);
  const creer = document.getElementById('bouton-creer');
  creer.hidden = !avecListe;
  creer.textContent = `＋ ${(ETAT.reglages && ETAT.reglages.libelle) || LIBELLE_DEFAUT}`;
}

function dessinerListe(rangs) {
  majBarre(rangs.length);
  const zone = contenu();
  zone.replaceChildren();
  const journal = document.createElement('section');
  journal.className = 'journal';

  if (!rangs.length) {
    const vide = document.createElement('p');
    vide.className = 'message';
    vide.textContent = `Aucune interaction pour ce projet : cliquez sur « ＋ ${ETAT.reglages.libelle} ».`;
    journal.appendChild(vide);
  }
  rangs.forEach(i => journal.appendChild(ligneInteraction(i)));
  zone.appendChild(journal);
}

/**
 * Une ligne de la liste. Ce n'est pas un <button> : un lien ne peut pas se
 * trouver dans un bouton. role="button" et tabindex la rendent quand même
 * utilisable au clavier (Entrée ou Espace ouvre la fiche).
 */
function ligneInteraction(i) {
  const id = ETAT.donnees.id[i];
  const ligne = document.createElement('div');
  ligne.className = 'interaction';
  ligne.dataset.id = id;
  ligne.setAttribute('role', 'button');
  ligne.tabIndex = 0;
  ligne.addEventListener('click', () => ouvrirFiche(id));
  ligne.addEventListener('keydown', (e) => {
    if (e.target === ligne && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ouvrirFiche(id); }
  });

  const date = document.createElement('span');
  date.className = 'interaction-date';
  date.textContent = dateAffichee(brute('Date', i));

  const corps = document.createElement('div');
  corps.className = 'interaction-corps';
  const titre = document.createElement('span');
  const texteTitre = String(brute('Titre', i) ?? '').trim();
  titre.className = 'interaction-titre' + (texteTitre ? '' : ' interaction-sans-titre');
  titre.textContent = texteTitre || 'Sans titre';   // textContent : jamais de HTML interprété
  corps.appendChild(titre);
  if (col('Type')) Pastilles.creer(info(col('Type')), brute('Type', i)).forEach(p => corps.appendChild(p));
  if (col('Personnes')) {
    const noms = nomsPersonnes(brute('Personnes', i));
    if (noms.length) {
      const personnes = document.createElement('span');
      personnes.className = 'interaction-personnes';
      personnes.textContent = '👤 ' + noms.join(', ');
      corps.appendChild(personnes);
    }
  }

  ligne.append(date, corps);
  const adresse = col('Lien') ? lienSur(brute('Lien', i)) : null;
  if (adresse) {
    const lien = document.createElement('a');
    lien.className = 'interaction-lien';
    lien.href = adresse;
    lien.target = '_blank';
    lien.rel = 'noopener noreferrer';
    lien.textContent = '🔗';
    lien.title = 'Ouvrir la note : ' + adresse;
    lien.addEventListener('click', (e) => e.stopPropagation());   // n'ouvre pas la fiche
    ligne.appendChild(lien);
  } else {
    ligne.appendChild(document.createElement('span'));   // garde la grille alignée
  }
  return ligne;
}

/* ══════════════════════════════════════════════════════════════
   4. LA FICHE (création et modification)
   Les changements sont gardés dans ETAT.fiche.modifs jusqu'à
   « Sauvegarder » : seules les colonnes modifiées sont écrites.
   ══════════════════════════════════════════════════════════════ */

const panneau = document.getElementById('fiche');
Fiche.installer(panneau, { actions: document.getElementById('fiche-actions'), fermer: () => fermerFiche() });

const ficheModifiee = () => Boolean(ETAT.fiche) && Object.keys(ETAT.fiche.modifs).length > 0;

/** Ouvre la fiche d'une interaction (id), ou une fiche vide pour en créer une (null). */
function ouvrirFiche(id) {
  if (ETAT.fiche && ficheModifiee() && ETAT.fiche.id !== id
      && !confirm('La fiche ouverte a des modifications non sauvegardées. Les abandonner ?')) return;
  ETAT.fiche = {
    id,
    // Valeurs de départ d'une nouvelle ligne (écrites même si l'on n'y touche pas)
    defauts: id === null ? { Date: maintenant() } : {},
    modifs: {},
  };
  dessinerFiche();
  Fiche.ouvrir(panneau);
}

/** Rang de la ligne de la fiche dans la table relue (-1 pour une création). */
function rangFiche() {
  return ETAT.fiche.id === null ? -1 : ETAT.donnees.id.indexOf(ETAT.fiche.id);
}

/** Valeur actuelle d'un champ de la fiche : modifiée, sinon enregistrée, sinon par défaut. */
function valeurFiche(champ) {
  const f = ETAT.fiche;
  if (champ in f.modifs) return f.modifs[champ];
  const i = rangFiche();
  if (i !== -1) return brute(champ, i);
  return champ in f.defauts ? f.defauts[champ] : null;
}

function modifier(champ, valeur) {
  ETAT.fiche.modifs[champ] = valeur;
  majIndicateur();
}

function majIndicateur() {
  const nouvelle = ETAT.fiche && ETAT.fiche.id === null;
  document.getElementById('fiche-modifie').classList.toggle('visible', ficheModifiee());
  document.getElementById('fiche-sauver').disabled = !(nouvelle || ficheModifiee());
}

/** Ajoute à la grille de la fiche une ligne « libellé : valeur ». */
function ajouterChamp(grille, libelle, ...elements) {
  const l = document.createElement('div');
  l.className = 'champ-libelle';
  l.textContent = libelle;
  const v = document.createElement('div');
  v.className = 'champ-valeur';
  v.append(...elements);
  grille.append(l, v);
  return v;
}

/** Petit texte d'aide sous un champ. */
function aide(texte) {
  const a = document.createElement('span');
  a.className = 'champ-aide';
  a.textContent = texte;
  return a;
}

/** Note « 🔒 » d'une colonne calculée par une formule. */
const NOTE_CALCULEE = '🔒 Calculé par une formule : non modifiable ici';

function dessinerFiche() {
  const f = ETAT.fiche;
  if (!f) return;
  const nouvelle = f.id === null;
  if (!nouvelle && rangFiche() === -1) {   // ligne supprimée entre-temps dans Grist
    fermerFiche(true);
    afficherToast('⚠️ Cette interaction n\'existe plus', 3000);
    return;
  }
  document.getElementById('fiche-libelle').textContent = nouvelle ? `Nouveau : ${ETAT.reglages.libelle}` : 'Interaction';
  const corps = document.getElementById('fiche-corps');
  corps.replaceChildren();

  // Titre
  corps.appendChild(Fiche.champTitre(String(valeurFiche('Titre') ?? ''), {
    placeholder: 'Titre', lectureSeule: calculee('Titre'),
    surChangement: (v) => modifier('Titre', v),
  }));
  if (calculee('Titre')) corps.appendChild(aide(NOTE_CALCULEE));

  const grille = document.createElement('div');
  grille.className = 'champs';
  corps.appendChild(grille);

  // Date
  const date = document.createElement('input');
  date.type = avecHeure() ? 'datetime-local' : 'date';
  date.className = 'champ-saisie';
  date.id = 'fiche-date';
  date.value = versSaisie(valeurFiche('Date'));
  date.disabled = calculee('Date');
  date.addEventListener('change', () => modifier('Date', depuisSaisie(date.value)));
  ajouterChamp(grille, 'Date', date, ...(calculee('Date') ? [aide(NOTE_CALCULEE)] : []));

  if (col('Type')) ajouterChamp(grille, info(col('Type')).libelle, pastilleType());
  if (col('Personnes')) ajouterChamp(grille, info(col('Personnes')).libelle, ...pastillesPersonnes());
  if (col('Lien')) ajouterChamp(grille, 'Lien', ...champLien());

  // Projet : rappel, non modifiable (une création reçoit le projet de ⚙)
  const projets = nouvelle ? [ETAT.reglages.projet] : numeros(brute('Projet', rangFiche()));
  const rappel = document.createElement('span');
  rappel.className = 'fiche-rappel';
  rappel.textContent = '📁 ' + (projets.map(nomProjet).join(', ') || '—');
  ajouterChamp(grille, info(col('Projet')).libelle, rappel);

  // Ancienne description : affichée seulement si elle est remplie, sans
  // modification possible (la note vit désormais dans Docs).
  const description = col('Description') && !nouvelle ? String(brute('Description', rangFiche()) ?? '').trim() : '';
  if (description) {
    const bloc = document.createElement('div');
    bloc.className = 'description-ancienne';
    const titre = document.createElement('span');
    titre.className = 'fiche-libelle-texte';
    titre.textContent = `${info(col('Description')).libelle} (ancienne, lecture seule)`;
    const rendu = document.createElement('div');
    rendu.className = 'fiche-md-rendu';
    rendu.innerHTML = Fiche.markdownVersHtml(description);   // HTML nettoyé par DOMPurify
    bloc.append(titre, rendu);
    corps.appendChild(bloc);
  }
  majIndicateur();
}

/** Pastille du type : un clic ouvre la liste des choix de la colonne. */
function pastilleType() {
  const c = info(col('Type'));
  const valeur = String(valeurFiche('Type') ?? '');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fiche-pastille' + (valeur ? '' : ' fiche-pastille-vide');
  b.id = 'fiche-type';
  b.textContent = valeur || '+ Type';
  const couleur = valeur ? Pastilles.couleur(c, valeur) : null;
  if (couleur) { b.style.background = couleur.fond; b.style.color = couleur.texte; }
  if (c.formule) { b.disabled = true; b.title = NOTE_CALCULEE; return b; }
  b.title = `${c.libelle} — cliquer pour changer`;
  b.addEventListener('click', () => Fiche.menuChoix(b, {
    options: c.choix.map(x => ({ valeur: x, libelle: x })),
    selection: [valeur], vide: '— aucun —', valeurVide: '',
    surChoix: (v) => { modifier('Type', v); dessinerFiche(); },
  }));
  return b;
}

/** Une pastille par personne (× pour la retirer), puis « ＋ Ajouter ». */
function pastillesPersonnes() {
  const ids = numeros(valeurFiche('Personnes'));
  const c = info(col('Personnes'));
  const elements = ids.map(id => {
    const p = document.createElement('span');
    p.className = 'fiche-pastille personne';
    p.dataset.id = id;
    const nom = (ETAT.refPersonnes && ETAT.refPersonnes.nom(id)) || `#${id}`;
    const couleur = Pastilles.couleurPastel(nom);
    p.style.background = couleur.fond;
    p.style.color = couleur.texte;
    p.append('👤 ' + nom);   // texte, jamais interprété comme du HTML
    if (!c.formule) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'personne-retirer';
      x.textContent = '✕';
      x.title = `Retirer ${nom}`;
      x.addEventListener('click', () => {
        modifier('Personnes', ids.filter(n => n !== id));
        dessinerFiche();
      });
      p.appendChild(x);
    }
    return p;
  });
  if (c.formule) return [...elements, aide(NOTE_CALCULEE)];
  const ajouter = document.createElement('button');
  ajouter.type = 'button';
  ajouter.className = 'fiche-pastille fiche-pastille-vide';
  ajouter.id = 'fiche-ajouter-personne';
  ajouter.textContent = '＋ Ajouter';
  ajouter.addEventListener('click', () => ouvrirMenuPersonnes(ajouter, ids));
  return [...elements, ajouter];
}

/**
 * Menu de recherche des personnes. La table visée est relue à chaque
 * ouverture : une personne ajoutée dans Grist entre-temps est proposée tout
 * de suite (comme les menus de la Galerie).
 */
async function ouvrirMenuPersonnes(ancre, ids) {
  let ref = null;
  try {
    const doc = await Colonnes.lireDocument();
    ref = await Colonnes.lireReference(doc, ETAT.table, col('Personnes'));
  } catch (err) {
    console.error('Interactions – lecture des personnes impossible :', err);
  }
  if (!ref) { afficherToast('⚠️ Impossible de lire la liste des personnes', 3000); return; }
  ETAT.refPersonnes = ref;
  if (!ancre.isConnected) return;   // la fiche a été redessinée pendant la lecture
  const options = ref.options
    .filter(o => !ids.includes(o.id))
    .map(o => ({ valeur: o.id, libelle: o.nom || `#${o.id}` }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
  Fiche.menuRecherche(ancre, {
    options, placeholder: 'Rechercher une personne…',
    surChoix: (id) => { modifier('Personnes', [...numeros(valeurFiche('Personnes')), id]); dessinerFiche(); },
  });
}

/** Champ du lien, avec l'aide et « 🔗 Ouvrir la note » quand l'adresse est valable. */
function champLien() {
  const saisie = document.createElement('input');
  saisie.type = 'url';
  saisie.className = 'champ-saisie';
  saisie.id = 'fiche-lien';
  saisie.placeholder = 'https://…';
  saisie.value = String(valeurFiche('Lien') ?? '');
  saisie.disabled = calculee('Lien');
  const note = aide('');
  const majNote = () => {
    note.replaceChildren();
    if (calculee('Lien')) { note.textContent = NOTE_CALCULEE; return; }
    const adresse = lienSur(saisie.value);
    if (saisie.value.trim() && !adresse) {
      note.textContent = '⚠️ Adresse non reconnue : elle doit commencer par https://';
      return;
    }
    note.append('Créez d\'abord la note dans Docs, puis collez son adresse ici.');
    if (adresse) {
      const a = document.createElement('a');
      a.href = adresse;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = ' 🔗 Ouvrir la note';
      note.appendChild(a);
    }
  };
  saisie.addEventListener('input', () => { modifier('Lien', saisie.value.trim()); majNote(); });
  majNote();
  return [saisie, note];
}

/** Valeur à écrire dans Grist pour un champ de la fiche. */
function valeurAEcrire(champ, v) {
  if (champ === 'Personnes') {
    const ids = numeros(v);
    return ids.length ? ['L', ...ids] : null;
  }
  return v;
}

async function sauverFiche() {
  const f = ETAT.fiche;
  if (!f) return;
  const nouvelle = f.id === null;
  if (!nouvelle && !ficheModifiee()) return;

  // Colonnes à écrire : valeurs par défaut (création), puis modifications ;
  // jamais une colonne calculée par une formule.
  const champs = {};
  Object.entries({ ...f.defauts, ...f.modifs }).forEach(([champ, v]) => {
    if (col(champ) && !calculee(champ)) champs[col(champ)] = valeurAEcrire(champ, v);
  });
  if (nouvelle) {
    if (!String(valeurFiche('Titre') ?? '').trim()) {
      afficherToast('⚠️ Donnez un titre avant de sauvegarder', 3000);
      return;
    }
    // Le projet de ⚙ : un numéro, ou une liste d'un numéro
    const projet = ETAT.reglages.projet;
    champs[col('Projet')] = info(col('Projet')).typeBase === 'RefList' ? ['L', projet] : projet;
  }

  const b = document.getElementById('fiche-sauver');
  b.disabled = true;
  b.textContent = '…';
  try {
    await grist.docApi.applyUserActions([nouvelle
      ? ['AddRecord', ETAT.table, null, champs]
      : ['UpdateRecord', ETAT.table, f.id, champs]]);
    afficherToast(nouvelle ? '✓ Interaction créée' : '✓ Modifications sauvegardées');
    fermerFiche(true);   // Grist renverra les lignes (onRecords) : la liste sera à jour
  } catch (err) {
    afficherToast(`⚠️ Erreur : ${err.message || err}`, 4000);
    console.error('Interactions – erreur de sauvegarde :', err);
  } finally {
    b.textContent = '✓ Sauvegarder';
    majIndicateur();
  }
}

/** Ferme la fiche ; demande confirmation si elle a des modifications (sauf forcer). */
function fermerFiche(forcer = false) {
  if (!forcer && ficheModifiee() && !confirm('Abandonner les modifications de cette fiche ?')) return;
  Fiche.fermer(panneau);
  ETAT.fiche = null;
}

document.getElementById('fiche-sauver').addEventListener('click', sauverFiche);
document.getElementById('fiche-annuler').addEventListener('click', () => fermerFiche());
document.getElementById('fiche-fermer').addEventListener('click', () => fermerFiche());
document.addEventListener('keydown', (e) => {
  if (!ETAT.fiche || FENETRE.estOuverte() || FENETRE_AIDE.estOuverte()) return;
  // Ctrl + S (ou Cmd + S) sauvegarde ; Échap ferme (un menu ouvert se ferme d'abord : fiche.js)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); sauverFiche(); }
  if (e.key === 'Escape') fermerFiche();
});

/* ══════════════════════════════════════════════════════════════
   5. FENÊTRE ⚙ « PROJET AFFICHÉ »
   ══════════════════════════════════════════════════════════════ */

const choixProjet = document.getElementById('reglages-choix-projet');
const champLibelle = document.getElementById('reglages-libelle');

const FENETRE = Fenetre.creer({
  titre: '⚙️ Réglages des interactions',
  onglets: [{
    id: 'projet', libelle: 'Projet', contenu: document.getElementById('reglages-projet'),
    etat: () => (Number(choixProjet.value) > 0
      ? { etat: 'ok', aide: 'Projet choisi' }
      : { etat: 'alerte', aide: 'Choisissez le projet' }),
  }],
  actions: [
    { libelle: 'Annuler', classe: 'btn-ghost', fermer: true },
    { libelle: '✓ Appliquer', classe: 'btn-primary', surClic: appliquerReglages },
  ],
});

/** Remplit la liste des projets (de A à Z) et le libellé du bouton. */
function remplirReglages(projetChoisi = Number(choixProjet.value) || (ETAT.reglages && ETAT.reglages.projet)) {
  const ref = ETAT.refProjet;
  const aideTexte = document.getElementById('reglages-aide');
  aideTexte.textContent = ref
    ? `Choisissez le projet dont la liste montre les interactions (table « ${ref.tableVisee} »). `
      + 'Les nouvelles interactions lui seront rattachées.'
    : '⚠️ Associez d\'abord la colonne Projet dans le panneau de droite de Grist.';
  const options = ref
    ? ref.options.map(o => ({ valeur: o.id, libelle: o.nom || `n° ${o.id}` }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr', { numeric: true }))
    : [];
  // Un projet enregistré qui n'existe plus reste affiché, signalé
  if (projetChoisi && !options.some(o => o.valeur === projetChoisi)) {
    options.push({ valeur: projetChoisi, libelle: `⚠️ n° ${projetChoisi} (introuvable)` });
  }
  choixProjet.replaceChildren();
  const invite = new Option('Choisir un projet…', '');
  invite.disabled = true;
  choixProjet.appendChild(invite);
  options.forEach(o => choixProjet.appendChild(new Option(o.libelle, String(o.valeur))));
  choixProjet.value = projetChoisi ? String(projetChoisi) : '';
  FENETRE.majEtats();
}

function ouvrirReglages() {
  remplirReglages((ETAT.reglages && ETAT.reglages.projet) || 0);
  champLibelle.value = (ETAT.reglages && ETAT.reglages.libelle) || LIBELLE_DEFAUT;
  FENETRE.ouvrir();
}

choixProjet.addEventListener('change', () => FENETRE.majEtats());

/** « Appliquer » : seulement avec un projet qui existe. */
async function appliquerReglages() {
  const projet = Number(choixProjet.value);
  if (!(projet > 0) || (ETAT.refProjet && !ETAT.refProjet.options.some(o => o.id === projet))) {
    afficherToast('⚠️ Choisissez un projet de la liste', 3000);
    return;
  }
  if (ficheModifiee() && !confirm('La fiche ouverte a des modifications non sauvegardées. Les abandonner ?')) return;
  if (ETAT.fiche) fermerFiche(true);
  ETAT.reglages = { projet, libelle: champLibelle.value.trim() || LIBELLE_DEFAUT };
  FENETRE.fermer({ forcer: true });
  try {
    await grist.setOption('projet', ETAT.reglages.projet);
    await grist.setOption('libelleBouton', ETAT.reglages.libelle);
    afficherToast('✓ Projet choisi — cliquez sur « Enregistrer » dans Grist pour garder ce choix', 5000);
  } catch (err) {
    afficherToast(`⚠️ Réglage non enregistré : ${err.message || err}`, 5000);
    console.error('Interactions – erreur setOption :', err);
  }
  afficher();
}

document.getElementById('bouton-reglages').addEventListener('click', ouvrirReglages);
document.getElementById('bouton-creer').addEventListener('click', () => ouvrirFiche(null));

/* Mode d'emploi, derrière le bouton « ? » (#249, règle R4), comme le Kanban
   et la Galerie. Le texte est écrit dans index.html (#aide-contenu) : rien de
   Grist n'y entre. Un seul onglet, donc pas de colonne d'onglets (classe
   « fenetre-aide », style dans ../_commun/fenetre.css). */
const FENETRE_AIDE = Fenetre.creer({
  titre: '📖 Mode d\'emploi',
  onglets: [{ id: 'aide', libelle: 'Mode d\'emploi', contenu: document.getElementById('aide-contenu') }],
  actions: [{ libelle: 'Fermer', classe: 'btn-primary', fermer: true }],
});
FENETRE_AIDE.element.classList.add('fenetre-aide');
document.getElementById('bouton-aide').addEventListener('click', () => FENETRE_AIDE.ouvrir());

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
