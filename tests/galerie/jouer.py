"""Joue les scénarios du banc d'essai de la Galerie dans Chrome (ou Edge) sans affichage.

Le moteur est commun à tous les bancs : voir ../_commun/banc.py.

Usage (depuis la racine du dépôt) :
    py tests/galerie/jouer.py                     tous les scénarios, 1200 et 480 px
    py tests/galerie/jouer.py fiche               un seul scénario
    py tests/galerie/jouer.py --largeurs 1200 -v  une largeur, toutes les lignes OK
Code de sortie : 0 si tout est OK, 1 sinon.
"""
import pathlib
import sys

ICI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent / '_commun'))
from banc import jouer  # noqa: E402  (après l'ajout du chemin ci-dessus)

if __name__ == '__main__':
    sys.exit(jouer('galerie', ICI))
