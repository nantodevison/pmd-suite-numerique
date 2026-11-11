"""Assemble le widget Kanban en un seul fichier HTML.

Le Custom Widget Builder de Grist ne sait pas suivre les chemins relatifs
(../_commun/fiche.js…) : on y colle donc une page où les feuilles de style et
les scripts locaux sont recopiés à l'intérieur. Le banc d'essai part de la
même page (voir jouer.py).

Usage (depuis la racine du dépôt) :
    py tests/kanban/assembler.py
        → écrit tests/kanban/genere/kanban-builder.html, à coller dans
          l'onglet HTML du Custom Widget Builder (dossier ignoré par Git)
"""
import pathlib
import re

ICI = pathlib.Path(__file__).resolve().parent
WIDGET = ICI.parents[1] / 'widgets' / 'kanban'
GENERE = ICI / 'genere'


def assembler(dossier=WIDGET):
    """Renvoie le HTML du widget, styles et scripts locaux recopiés dedans."""
    html = (dossier / 'index.html').read_text(encoding='utf-8')

    def style(m):
        return '<style>\n' + (dossier / m.group(1)).read_text(encoding='utf-8') + '\n</style>'

    def script(m):
        code = (dossier / m.group(1)).read_text(encoding='utf-8')
        # « </script » dans le code fermerait la balise trop tôt
        return '<script>\n' + code.replace('</script', '<\\/script') + '\n</script>'

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)" />', style, html)
    html = re.sub(r'<script src="((?:\.\./_commun/)?[\w-]+\.js)"></script>', script, html)
    restes = re.findall(r'(?:src|href)="\.\.?/[^"]+"', html)
    if restes:
        raise RuntimeError(f'Références locales non recopiées : {restes}')
    return html


if __name__ == '__main__':
    GENERE.mkdir(exist_ok=True)
    sortie = GENERE / 'kanban-builder.html'
    sortie.write_text(assembler(), encoding='utf-8')
    print(f'Page à coller dans le Custom Widget Builder : {sortie}')
