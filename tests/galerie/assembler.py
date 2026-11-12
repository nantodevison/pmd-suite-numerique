"""Assemble le widget Galerie en un seul fichier HTML, pour le Custom Widget Builder.

Le moteur est commun à tous les bancs : voir ../_commun/banc.py.

Usage (depuis la racine du dépôt) :
    py tests/galerie/assembler.py
        → écrit tests/galerie/genere/galerie-builder.html, à coller dans
          l'onglet HTML du Custom Widget Builder (dossier ignoré par Git)
"""
import pathlib
import sys

ICI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent / '_commun'))
from banc import ecrire_page_builder  # noqa: E402  (après l'ajout du chemin ci-dessus)

if __name__ == '__main__':
    ecrire_page_builder('galerie', ICI)
