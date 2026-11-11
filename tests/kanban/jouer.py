"""Joue les scénarios du banc d'essai du Kanban dans Chrome (ou Edge) sans affichage.

Pour chaque scénario de scenarios/ et chaque largeur de fenêtre :
  1. assemble le widget (assembler.py) ;
  2. remplace l'API Grist par faux-grist.js et ajoute en fin de page les
     outils communs (outils-scenario.js) puis le scénario ;
  3. ouvre la page dans le navigateur sans affichage, avec un profil neuf
     (mémoire du navigateur vide), et lit le bilan écrit par le scénario.

Usage (depuis la racine du dépôt) :
    py tests/kanban/jouer.py                      tous les scénarios, 1200 et 480 px
    py tests/kanban/jouer.py attributs-menus      un seul scénario
    py tests/kanban/jouer.py --largeurs 1200 -v   une largeur, toutes les lignes OK
Code de sortie : 0 si tout est OK, 1 sinon.

Navigateur : Chrome, sinon Edge ; ou celui indiqué par la variable
d'environnement BANC_NAVIGATEUR (chemin complet de l'exécutable).

Limite connue : le navigateur sans affichage ne joue pas
requestAnimationFrame ; le placement des menus de fiche.js ne peut donc pas
être vérifié ici (un scénario peut le simuler). Le test dans le Custom
Widget Builder reste la dernière étape avant une fusion.
"""
import argparse
import html
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

from assembler import GENERE, assembler

ICI = pathlib.Path(__file__).resolve().parent
API_GRIST = '<script src="https://grist.numerique.gouv.fr/grist-plugin-api.js"></script>'


def trouver_navigateur():
    """Chemin de Chrome ou d'Edge, ou None."""
    if os.environ.get('BANC_NAVIGATEUR'):
        return os.environ['BANC_NAVIGATEUR']
    candidats = []
    for base in (os.environ.get('PROGRAMFILES'), os.environ.get('PROGRAMFILES(X86)'), os.environ.get('LOCALAPPDATA')):
        if base:
            candidats += [pathlib.Path(base) / 'Google/Chrome/Application/chrome.exe',
                          pathlib.Path(base) / 'Microsoft/Edge/Application/msedge.exe']
    for c in candidats:
        if c.exists():
            return str(c)
    for nom in ('google-chrome', 'chromium', 'chrome', 'msedge'):
        if shutil.which(nom):
            return shutil.which(nom)
    return None


def construire_page(widget, scenario):
    """Page du banc : widget assemblé + faux Grist + scénario lancé au chargement."""
    if API_GRIST not in widget:
        raise RuntimeError("Le widget ne charge plus l'API Grist attendue : mettre à jour API_GRIST.")
    faux = (ICI / 'faux-grist.js').read_text(encoding='utf-8')
    # Outils communs (Banc.ok, Banc.demarrer…), puis le scénario lui-même
    code = (ICI / 'outils-scenario.js').read_text(encoding='utf-8') + '\n' + scenario.read_text(encoding='utf-8')
    page = widget.replace(API_GRIST, '<script>\n' + faux + '\n</script>')
    return page.replace('</body>', '<script>\nwindow.addEventListener("load", () => {\n'
                        + code + '\n});\n</script>\n</body>')


def jouer(navigateur, page, largeur):
    """Ouvre la page sans affichage ; renvoie le texte du bilan, ou None."""
    # Profil neuf, retiré automatiquement à la fin (dossier temporaire créé ici)
    with tempfile.TemporaryDirectory(prefix='banc-kanban-', ignore_cleanup_errors=True) as profil:
        resultat = subprocess.run(
            [navigateur, '--headless=new', '--disable-gpu', '--no-first-run',
             f'--user-data-dir={profil}', f'--window-size={largeur},900',
             '--virtual-time-budget=20000', '--dump-dom', page.as_uri()],
            capture_output=True, timeout=180)
    dom = resultat.stdout.decode('utf-8', errors='replace')
    bilans = re.findall(r'<pre id="resultats">(BILAN.*?)</pre>', dom, re.S)
    return html.unescape(bilans[-1]) if bilans else None


def main():
    parser = argparse.ArgumentParser(description="Banc d'essai du Kanban")
    parser.add_argument('scenarios', nargs='*', help='noms de scénarios (sans .js) ; tous par défaut')
    parser.add_argument('--largeurs', nargs='+', type=int, default=[1200, 480])
    parser.add_argument('-v', '--detail', action='store_true', help='affiche aussi les lignes OK')
    args = parser.parse_args()

    # Les consoles Windows n'affichent pas toujours l'UTF-8 (▾, « », émojis)
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    navigateur = trouver_navigateur()
    if not navigateur:
        print('Ni Chrome ni Edge trouvés : indiquez le chemin dans BANC_NAVIGATEUR.')
        return 1

    tous = sorted((ICI / 'scenarios').glob('*.js'))
    choisis = [s for s in tous if not args.scenarios or s.stem in args.scenarios]
    if not choisis:
        print('Aucun scénario trouvé. Disponibles :', ', '.join(s.stem for s in tous))
        return 1

    GENERE.mkdir(exist_ok=True)
    widget = assembler()
    echec = False
    for scenario in choisis:
        page = GENERE / f'banc-{scenario.stem}.html'
        page.write_text(construire_page(widget, scenario), encoding='utf-8')
        for largeur in args.largeurs:
            bilan = jouer(navigateur, page, largeur)
            print(f'── {scenario.stem} · {largeur} px')
            if bilan is None:
                print('   PAS DE RÉSULTAT (erreur de chargement ou délai dépassé)')
                echec = True
                continue
            lignes = bilan.splitlines()
            print('   ' + lignes[0])
            for ligne in lignes[1:]:
                if args.detail or not ligne.startswith('OK'):
                    print('   ' + ligne)
            if not re.match(r'BILAN \d+ OK, 0 KO', lignes[0]):
                echec = True
    print('Tout est OK.' if not echec else 'Au moins une vérification a échoué.')
    return 1 if echec else 0


if __name__ == '__main__':
    sys.exit(main())
