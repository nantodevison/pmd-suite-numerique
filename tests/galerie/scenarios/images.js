// Image des cartes (#241, étape B) : sans colonne associée, rien ne change
// (ni jeton demandé, ni table lue) ; avec une colonne « pièce jointe », la
// première IMAGE de la cellule (un PDF est ignoré) s'affiche en haut des
// cartes moyennes (80 px) et grandes (140 px), jamais en compacte ni dans
// la fiche ; jeton en lecture seule, gardé tant qu'il est valide, renouvelé
// avant d'expirer ; fichier introuvable : nouveau jeton, un essai, puis
// image retirée ; un clic sur l'image ouvre la fiche.
Banc.lancer(async () => {
  await Banc.demarrer();
  const { ok, attendre, $, $$ } = Banc;
  const carte = (id) => $(`#grille .carte[data-id="${id}"]`);
  const image = (id) => carte(id)?.querySelector('.carte-image');
  const lectures = (t) => FAUX_GRIST.lectures.filter(x => x === t).length;
  const taille = (t) => {
    if (t) localStorage.setItem('galerie.taille.doc-invente.EPICs', t);
    else localStorage.removeItem('galerie.taille.doc-invente.EPICs');
    _tailleSeance = null;
    afficherGrille();
  };

  // ── Sans colonne associée : rien ne change ──
  ok('sans association : aucune image', !$('.carte-image'));
  ok('sans association : aucun jeton demandé, _grist_Attachments non lue',
    FAUX_GRIST.jetons.length === 0 && lectures('_grist_Attachments') === 0);

  // ── Avec la colonne Image ──
  FAUX_GRIST.associer({ Image: 'Image' });
  await attendre(300);
  ok('jetons toujours demandés en lecture seule', FAUX_GRIST.jetons.length
    && FAUX_GRIST.jetons.every(j => j.readOnly === true), JSON.stringify(FAUX_GRIST.jetons));
  ok('association : pièces jointes lues une fois', lectures('_grist_Attachments') === 1);
  const src1 = image(1)?.getAttribute('src') || '';
  ok('PDF ignoré : la carte 1 montre la 1re image (n° 2)', /\/pieces-jointes\/attachments\/2\/download\?auth=jeton-1$/.test(src1), src1);
  ok('carte 2 : image n° 3', /attachments\/3\/download/.test(image(2)?.getAttribute('src') || ''));
  ok('carte sans pièce jointe : pas d\'image', !image(4));
  ok('image en tête de la carte, texte alternatif vide', carte(1).firstElementChild === image(1) && image(1).alt === '');
  ok('image réellement chargée', image(1).complete && image(1).naturalWidth === 64,
    `complete=${image(1).complete} largeur=${image(1).naturalWidth}`);
  const h = image(1).getBoundingClientRect();
  const c = carte(1).getBoundingClientRect();
  ok('moyenne : 80 px de haut, collée aux bords de la carte', Math.round(h.height) === 80
    && Math.abs(h.left - c.left - 1) <= 1 && Math.abs(c.right - h.right - 1) <= 1,
    `h=${h.height} gauche=${h.left - c.left} droite=${c.right - h.right}`);

  // Fichier introuvable (n° 4) : un nouveau jeton, un essai, puis l'image est retirée
  ok('fichier introuvable : un seul nouveau jeton demandé', FAUX_GRIST.jetons.length === 2, String(FAUX_GRIST.jetons.length));
  ok('fichier introuvable : image retirée (pas d\'icône cassée)', !image(3));
  // Redessins (recherche, filtres…) : le fichier en échec n'est plus tenté
  for (const mot of ['a', 'ar', '']) { ETAT.recherche = mot; afficherGrille(); }
  await attendre(200);
  ok('redessins : fichier en échec plus tenté, aucun jeton redemandé', !image(3) && FAUX_GRIST.jetons.length === 2,
    String(FAUX_GRIST.jetons.length));

  // ── Tailles ──
  taille('grande');
  await attendre(200);
  ok('grande : 140 px de haut', Math.round(image(1).getBoundingClientRect().height) === 140,
    String(image(1)?.getBoundingClientRect().height));
  taille('compacte');
  ok('compacte : aucune image', !$('.carte-image') && carte(1));
  taille(null);
  ok('retour en moyenne : image revenue', !!image(1));

  // ── Clic sur l'image : la fiche s'ouvre, sans image ──
  image(2).click();
  await attendre(50);
  ok('clic sur l\'image : fiche ouverte', $('#fiche').classList.contains('open'));
  ok('fiche : pas d\'image', !$('#fiche .carte-image, #fiche img[src*="attachments"]'));
  fermerFiche(true);

  // ── Nouvel envoi de Grist : jeton gardé, pièces jointes non relues ──
  const jetons = FAUX_GRIST.jetons.length;
  FAUX_GRIST.associer({ Image: 'Image' });
  await attendre(300);
  ok('nouvel envoi : jeton encore valide gardé', FAUX_GRIST.jetons.length === jetons, String(FAUX_GRIST.jetons.length));
  ok('nouvel envoi : pièces jointes connues non relues', lectures('_grist_Attachments') === 1);

  // Jeton sur le point d'expirer : renouvelé au prochain envoi
  PIECES.expire = Date.now() + 10 * 1000;
  FAUX_GRIST.associer({ Image: 'Image' });
  await attendre(300);
  ok('jeton bientôt expiré : renouvelé', FAUX_GRIST.jetons.length === jetons + 1);
  ok('image avec le nouveau jeton', (image(1)?.getAttribute('src') || '').endsWith('auth=jeton-' + (jetons + 1)),
    image(1)?.getAttribute('src'));

  // Pièce jointe ajoutée dans Grist (numéro inconnu) : la liste est relue
  FAUX_GRIST.meta._grist_Attachments.id.push(5);
  FAUX_GRIST.meta._grist_Attachments.fileName.push('nouvelle.png');
  FAUX_GRIST.meta._grist_Attachments.fileExt.push('.png');
  await applyUserActionsFaux([['UpdateRecord', 'EPICs', 4, { Image: ['L', 5] }]]);
  await attendre(300);
  ok('pièce jointe ajoutée : liste relue', lectures('_grist_Attachments') === 2);
  ok('pièce jointe ajoutée : image tentée sur la carte 4',
    /attachments\/5\/download/.test(image(4)?.getAttribute('src') || '') || !image(4));

  // ── Retrait de l'association ──
  FAUX_GRIST.associer({});
  await attendre(200);
  ok('association retirée : aucune image', !$('.carte-image'));

  /** Écrit directement dans le faux Grist (comme un collègue dans le document). */
  function applyUserActionsFaux(actions) { return grist.docApi.applyUserActions(actions); }
});
