"""Joue les scénarios du banc d'essai du Kanban dans Chrome (ou Edge) sans affichage.

Le moteur est commun à tous les bancs : voir ../_commun/banc.py.

Usage (depuis la racine du dépôt) :
    py tests/kanban/jouer.py                      tous les scénarios, 1200 et 480 px
    py tests/kanban/jouer.py attributs-menus      un seul scénario
    py tests/kanban/jouer.py --largeurs 1200 -v   une largeur, toutes les lignes OK
Code de sortie : 0 si tout est OK, 1 sinon.
"""
import pathlib
import sys

ICI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent / '_commun'))
from banc import jouer  # noqa: E402  (après l'ajout du chemin ci-dessus)

if __name__ == '__main__':
    sys.exit(jouer('kanban', ICI))
