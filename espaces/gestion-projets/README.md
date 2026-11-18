# Espace « gestion de projets »

Document Grist unique du groupe PMD (instance Grist de la DINUM), qui regroupe
plusieurs modules autour de la table **`Projets2`**. Chaque projet suivi
(Valorisation, Écoute client, Observatoire des trafics…) est une **ligne** de
`Projets2`.

[`grist_schema.py`](grist_schema.py) est l'export du code Grist (*Outils → Vue du
code*) : il décrit la structure des tables, sans aucune donnée. C'est la
référence pour les noms de tables et de colonnes utilisés par les widgets.

## Modules

| Module | Tables ou colonnes |
|---|---|
| Gestion de projet | `Projets2` → `Objectifs_resultats_cles` → `EPICs` → `Taches` ; colonnes `Presentation` (texte Markdown de la page du projet, sans limite de longueur), `Chef_de_projet` (→ `Contacts`) et `Type` de `Projets2` |
| Documents | `Documents` : `Titre`, `Projet` (liste de références : un document peut servir plusieurs projets), `Type`, `url` (Box, Docs…) |
| CRM | `Contacts`, `Structures`, `Interactions` (dont `Titre` et `url` : lien vers la note Docs d'une réunion) |
| Retours utilisateurs | `Retour_U` et ses tables `Enum_…` (`Enum_Type_retourU`, `Enum_Tags_retourU`, `Enum_Opportunite_retourU`) |
| Valorisation | colonnes de `Projets2` : `Plus_value_Cerema`, `Exemple_de_resultat`, `Duplicable`, `image`, `Latitude`/`Longitude`… ; table `Info_valorisation_projet` |
| Écoute client | colonnes `ect_client_*` de `Projets2` ; table `Rex_ecoute_client` |

## Points d'attention

- **`Taches.couleur_statut`** ne connaît que 5 statuts (`🖐️ À faire`, `♻️ En cours`,
  `✅ Fait`, `🗃️ Archivé`, `❌ Annulé`) et lève une erreur pour les autres, alors
  que `EPICs.Avancement` et le Kanban de l'Observatoire en utilisent d'autres
  (`📧Demande envoyée`, `💾Data non transmises`, `🆙Disponible`…). Un widget ne
  doit pas dépendre de cette colonne.
- **Longueurs limitées dans `Projets2`** : des formules d'initialisation
  remplacent un `Titre` de plus de 30 caractères (`Sous_Titre` : 50) par un
  message d'erreur, et mettent probablement en erreur `Description`, `Exemple_de_resultat` (250),
  `Plus_value_Cerema` et `ect_client_probleme` (150) trop longs. Le texte long
  d'un projet va dans `Presentation`, sans limite. Un widget ne doit pas
  écrire le titre sans vérifier sa longueur.
- **Colonnes vides** : une colonne créée mais jamais remplie apparaît dans
  l'export comme une formule vide (`return ''`, `return 0`). La convertir en
  colonne de données dans Grist avant qu'un widget n'y écrive.
- **`Taches.qui_`** est une liste de références (`ReferenceList`) vers `Contacts`,
  pas une référence simple.

## À nettoyer un jour

- Deux tables proches : `Departement` et `Departements`.
- Plusieurs liens entre `Projets2` et les contacts ou structures : `Contacts`,
  `Contacts_Projets`, `ect_client_contacts`, `Structures`, `Client`, `Partenaire`.
- `from urllib import quote` (formules `Envoi_mail` et `Mail_groupe`) est une
  syntaxe Python 2, alors que `EPICs.Avancement` utilise une f-string (Python 3) :
  le document tourne donc probablement en Python 3, et `Mail_groupe` est
  probablement en erreur (`from urllib.parse import quote` en Python 3).
