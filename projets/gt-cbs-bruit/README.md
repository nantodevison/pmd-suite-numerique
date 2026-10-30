# GT Harmonisation des méthodes de production des CBS

**État : terminé** — conservé comme référence.

Groupe de travail (DGPR) sur l'harmonisation des pratiques de cartographie du
bruit (cartes de bruit stratégiques, CBS). Le guide méthodologique, rédigé dans
Docs, était synchronisé dans Grist pour y être parcouru, commenté et questionné.

## Ce qui a été construit

| Élément | Où |
|---|---|
| Synchronisation du guide Docs → table `Chapitres` | [`../../python/`](../../python/) |
| Widgets `parcours-doc` (parcours des chapitres), `questions` et `echanges` (questions et réponses) | retirés le 2026-10-30 (#201) ; code dans l'historique Git, au tag `archive-widgets-gt-cbs` (commit `83a05a4`) (voir [`../../widgets/README.md`](../../widgets/README.md)) |
| Schéma du document Grist | [`../../espaces/gt-cbs-bruit/grist_schema.py`](../../espaces/gt-cbs-bruit/grist_schema.py) |
| Images du guide publiées par la sync | [`../../images/`](../../images/) |
| Exemple d'arborescence Docs récupérée | [`tree_example.txt`](tree_example.txt) |

## Ce qui peut resservir

- La **synchronisation Docs → Grist** (conversion BlockNote → Markdown, gestion
  des images), pour tout projet qui rédige dans Docs et exploite dans Grist
  (par exemple, les écoutes client).
- Le **parcours de chapitres** (`parcours-doc`), pour consulter un document Docs
  structuré depuis Grist : à reprendre depuis l'historique Git, en ajoutant
  DOMPurify et des dépendances à version figée (comme le Kanban).
