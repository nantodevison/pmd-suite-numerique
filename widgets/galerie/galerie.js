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
     - Contexte     (facultatif, plusieurs colonnes possibles) : rappelé en
                    en-tête de la fiche ; les 3 premières apparaissent aussi
                    sur la carte.
   Pour n'afficher qu'une partie des lignes (par exemple les EPICs d'un
   projet), on utilise le filtrage natif de Grist : « Sélectionner par » ou
   les filtres de la vue.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const NB_PASTILLES_CARTE = 3;   // colonnes de contexte rappelées sur chaque carte

const ETAT = {
  lignes:     [],     // lignes reçues de Grist
  colonnes:   null,   // association : { Titre: 'colId', Description: 'colId', Contexte: ['colId', …] }
  table:      null,   // identifiant de la table affichée
  infos:      {},     // colId → { libelle, type, formule, colAffichee }
  references: {},     // 'table|colonne affichée' → { numéro de ligne: nom affiché }
  recherche:  '',
  selection:  null,   // numéro de la ligne sélectionnée dans Grist
  fiche:      { id: null, modifs: {} },   // carte affichée, et colonnes modifiées
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
    { name: 'Contexte',    title: 'Contexte (en-tête de la fiche)', allowMultiple: true, optional: true },
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
  // Fiche ouverte sans modification en cours : on la rafraîchit avec les
  // nouvelles valeurs (par exemple juste après une sauvegarde).
  if (ETAT.fiche.id !== null && !ficheModifiee()) remplirFiche(ETAT.fiche.id);
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
      };
    });
  }

  for (const colId of colonnesContexte()) {
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

/** Colonnes de contexte associées (toujours une liste, éventuellement vide). */
function colonnesContexte() {
  const c = ETAT.colonnes && ETAT.colonnes.Contexte;
  return Array.isArray(c) ? c : (c ? [c] : []);
}

function libelle(colId) {
  return (ETAT.infos[colId] && ETAT.infos[colId].libelle) || colId;
}

function estFormule(colId) {
  return Boolean(ETAT.infos[colId] && ETAT.infos[colId].formule);
}

/** Valeur d'une cellule mise en forme pour l'affichage ('' si vide). */
function valeurAffichee(colId, valeur) {
  const info = ETAT.infos[colId] || { type: '', colAffichee: null };
  if (Array.isArray(valeur)) {
    // Une liste peut arriver « encodée » : ['L', a, b…]
    const liste = valeur[0] === 'L' ? valeur.slice(1) : valeur;
    return liste.map(v => valeurSimple(info, v)).filter(Boolean).join(', ');
  }
  return valeurSimple(info, valeur);
}

function valeurSimple(info, v) {
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
  if (typeof v === 'object') return JSON.stringify(v);   // cas rares (pièces jointes…)
  // Un texte peut contenir du Markdown : on en retire les symboles.
  return info.type === 'Text' ? Fiche.markdownVersTexte(String(v)) : String(v);
}

/* ══════════════════════════════════════════════════════════════
   3. GRILLE DE CARTES
   ══════════════════════════════════════════════════════════════ */

function afficherGrille() {
  const grille = document.getElementById('grille');
  grille.innerHTML = '';
  document.getElementById('titre-table').textContent = '🖼️ ' + (ETAT.table || 'Galerie');

  if (!ETAT.colonnes || !ETAT.colonnes.Titre) {
    grille.appendChild(message('Associez au moins la colonne « Titre » dans le panneau de droite de Grist '
      + '(section « Colonnes » du widget), puis, si vous le souhaitez, le texte principal et le contexte.'));
    document.getElementById('compte').textContent = '0';
    return;
  }

  const visibles = ETAT.lignes.filter(correspondRecherche);
  document.getElementById('compte').textContent = visibles.length === ETAT.lignes.length
    ? String(ETAT.lignes.length) : `${visibles.length} / ${ETAT.lignes.length}`;

  if (!visibles.length) {
    grille.appendChild(message(ETAT.lignes.length ? 'Aucune carte ne correspond à la recherche.' : 'Aucune ligne à afficher.'));
    return;
  }
  visibles.forEach(ligne => grille.appendChild(construireCarte(ligne)));
}

function correspondRecherche(ligne) {
  if (!ETAT.recherche) return true;
  const texte = [ligne[ETAT.colonnes.Titre], ETAT.colonnes.Description && ligne[ETAT.colonnes.Description]]
    .filter(Boolean).join(' ').toLowerCase();
  return texte.includes(ETAT.recherche);
}

function construireCarte(ligne) {
  const carte = document.createElement('article');
  carte.className = 'carte' + (ligne.id === ETAT.selection ? ' selectionnee' : '');
  carte.dataset.id = ligne.id;

  const titre = document.createElement('div');
  titre.className = 'carte-titre';
  titre.textContent = ligne[ETAT.colonnes.Titre] || '(sans titre)';
  carte.appendChild(titre);

  // Pastilles : les premières colonnes de contexte non vides
  const pastilles = document.createElement('div');
  pastilles.className = 'carte-contexte';
  colonnesContexte().slice(0, NB_PASTILLES_CARTE).forEach(colId => {
    const valeur = valeurAffichee(colId, ligne[colId]);
    if (!valeur) return;
    const p = document.createElement('span');
    p.className = 'pastille';
    p.textContent = valeur;
    p.title = `${libelle(colId)} : ${valeur}`;
    pastilles.appendChild(p);
  });
  if (pastilles.children.length) carte.appendChild(pastilles);

  // Aperçu du texte principal, sans les symboles Markdown
  const colTexte = ETAT.colonnes.Description;
  const apercu = colTexte ? Fiche.markdownVersTexte(ligne[colTexte]) : '';
  if (apercu) {
    const texte = document.createElement('div');
    texte.className = 'carte-texte';
    texte.textContent = apercu;
    carte.appendChild(texte);
  }

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
   4. FICHE
   ══════════════════════════════════════════════════════════════ */

const panneau = () => document.getElementById('fiche');

function ficheModifiee() { return Object.keys(ETAT.fiche.modifs).length > 0; }

function ouvrirFiche(id) {
  if (ficheModifiee() && ETAT.fiche.id !== id) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  ETAT.fiche = { id, modifs: {} };
  remplirFiche(id);
  Fiche.ouvrir(panneau());
  // Déplace le curseur de Grist sur la ligne : les vues liées à ce widget
  // (« Sélectionner par ») suivent la carte ouverte.
  grist.setCursorPos({ rowId: id }).catch(() => {});
}

function remplirFiche(id) {
  const ligne = ETAT.lignes.find(l => l.id === id);
  if (!ligne) { fermerFiche(true); return; }   // ligne supprimée ou filtrée entre-temps

  const corps = document.getElementById('fiche-corps');
  corps.innerHTML = '';

  // Titre (en lecture seule si la colonne est calculée par une formule)
  const colTitre = ETAT.colonnes.Titre;
  const titre = document.createElement('input');
  titre.type = 'text';
  titre.className = 'fiche-titre';
  titre.value = ligne[colTitre] ?? '';
  if (estFormule(colTitre)) {
    titre.readOnly = true;
    titre.title = 'Calculé par une formule : non modifiable ici';
  } else {
    titre.addEventListener('input', () => noterModif(colTitre, titre.value));
  }
  corps.appendChild(titre);

  // En-tête de contexte : toutes les colonnes associées, même vides
  const cols = colonnesContexte();
  if (cols.length) {
    const liste = document.createElement('dl');
    liste.className = 'fiche-contexte';
    cols.forEach(colId => {
      const dt = document.createElement('dt');
      dt.textContent = libelle(colId);
      const dd = document.createElement('dd');
      dd.textContent = valeurAffichee(colId, ligne[colId]) || '—';
      liste.append(dt, dd);
    });
    corps.appendChild(liste);
  }

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

function noterModif(colId, valeur) {
  ETAT.fiche.modifs[colId] = valeur;
  majIndicateur();
}

function majIndicateur() {
  document.getElementById('fiche-modifie').classList.toggle('visible', ficheModifiee());
  document.getElementById('fiche-sauver').disabled = !ficheModifiee();
}

async function sauverFiche() {
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

function fermerFiche(force = false) {
  if (ficheModifiee() && !force) {
    if (!confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  }
  Fiche.fermer(panneau());
  ETAT.fiche = { id: null, modifs: {} };
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
   5. ÉVÉNEMENTS DE LA PAGE
   ══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  Fiche.installer(panneau(), {
    actions: document.getElementById('fiche-actions'),
    fermer:  () => fermerFiche(),
  });
  document.getElementById('fiche-fermer').addEventListener('click', () => fermerFiche());
  document.getElementById('fiche-annuler').addEventListener('click', () => fermerFiche());
  document.getElementById('fiche-sauver').addEventListener('click', sauverFiche);
  document.getElementById('recherche').addEventListener('input', (e) => {
    ETAT.recherche = e.target.value.trim().toLowerCase();
    afficherGrille();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panneau().classList.contains('open')) fermerFiche();
  });
});
