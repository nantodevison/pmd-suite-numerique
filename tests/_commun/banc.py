"""Moteur commun des bancs d'essai des widgets (tests/<widget>/).

Chaque banc d'essai a son propre dossier, avec :
  - faux-grist.js : imite l'API Grist avec des données inventées ;
  - scenarios/*.js : un scénario par fonction du widget ;
  - jouer.py et assembler.py : de courts relais vers ce fichier.

Ce fichier fait le reste, identique pour tous les widgets :
  1. assembler() recopie dans index.html les styles et scripts locaux
     (../_commun/…, <widget>.js) : une seule page, comme pour le Custom
     Widget Builder de Grist, qui ne suit pas les chemins relatifs ;
  2. jouer() remplace l'API Grist par faux-grist.js, ajoute en fin de page
     les outils communs (outils-scenario.js, dans ce dossier) puis le
     scénario, et ouvre la page dans Chrome ou Edge sans affichage, avec un
     profil neuf (mémoire du navigateur vide) ; il lit le bilan écrit par le
     scénario.

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

COMMUN = pathlib.Path(__file__).resolve().parent
RACINE = COMMUN.parents[1]
API_GRIST = '<script src="https://grist.numerique.gouv.fr/grist-plugin-api.js"></script>'


# ── 1. Assembler le widget en une seule page ──────────────────────────

def assembler(widget):
    """Renvoie le HTML du widget `widget` (nom du dossier dans widgets/),
    styles et scripts locaux recopiés dedans."""
    dossier = RACINE / 'widgets' / widget
    page = (dossier / 'index.html').read_text(encoding='utf-8')

    def style(m):
        return '<style>\n' + (dossier / m.group(1)).read_text(encoding='utf-8') + '\n</style>'

    def script(m):
        code = (dossier / m.group(1)).read_text(encoding='utf-8')
        # « </script » dans le code fermerait la balise trop tôt
        return '<script>\n' + code.replace('</script', '<\\/script') + '\n</script>'

    page = re.sub(r'<link rel="stylesheet" href="([^"]+)" />', style, page)
    page = re.sub(r'<script src="((?:\.\./_commun/)?[\w-]+\.js)"></script>', script, page)
    restes = re.findall(r'(?:src|href)="\.\.?/[^"]+"', page)
    if restes:
        raise RuntimeError(f'Références locales non recopiées : {restes}')
    return page


def ecrire_page_builder(widget, banc):
    """Écrit tests/<widget>/genere/<widget>-builder.html, à coller dans
    l'onglet HTML du Custom Widget Builder (dossier ignoré par Git)."""
    genere = banc / 'genere'
    genere.mkdir(exist_ok=True)
    sortie = genere / f'{widget}-builder.html'
    sortie.write_text(assembler(widget), encoding='utf-8')
    print(f'Page à coller dans le Custom Widget Builder : {sortie}')


# ── 2. Jouer les scénarios ────────────────────────────────────────────

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


def construire_page(page_widget, banc, scenario):
    """Page du banc : widget assemblé + faux Grist + scénario lancé au chargement."""
    if API_GRIST not in page_widget:
        raise RuntimeError("Le widget ne charge plus l'API Grist attendue : mettre à jour API_GRIST.")
    faux = (banc / 'faux-grist.js').read_text(encoding='utf-8')
    # Outils communs (Banc.ok, Banc.demarrer…), puis le scénario lui-même
    code = (COMMUN / 'outils-scenario.js').read_text(encoding='utf-8') + '\n' + scenario.read_text(encoding='utf-8')
    page = page_widget.replace(API_GRIST, '<script>\n' + faux + '\n</script>')
    return page.replace('</body>', '<script>\nwindow.addEventListener("load", () => {\n'
                        + code + '\n});\n</script>\n</body>')


def jouer_page(navigateur, page, largeur, widget):
    """Ouvre la page sans affichage ; renvoie le texte du bilan, ou None."""
    # Profil neuf, retiré automatiquement à la fin (dossier temporaire créé ici)
    with tempfile.TemporaryDirectory(prefix=f'banc-{widget}-', ignore_cleanup_errors=True) as profil:
        resultat = subprocess.run(
            [navigateur, '--headless=new', '--disable-gpu', '--no-first-run',
             f'--user-data-dir={profil}', f'--window-size={largeur},900',
             '--virtual-time-budget=20000', '--dump-dom', page.as_uri()],
            capture_output=True, timeout=180)
    dom = resultat.stdout.decode('utf-8', errors='replace')
    bilans = re.findall(r'<pre id="resultats">(BILAN.*?)</pre>', dom, re.S)
    return html.unescape(bilans[-1]) if bilans else None


def jouer(widget, banc):
    """Point d'entrée de tests/<widget>/jouer.py. Renvoie le code de sortie :
    0 si tout est OK, 1 sinon."""
    parser = argparse.ArgumentParser(description=f"Banc d'essai du widget {widget}")
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

    tous = sorted((banc / 'scenarios').glob('*.js'))
    choisis = [s for s in tous if not args.scenarios or s.stem in args.scenarios]
    if not choisis:
        print('Aucun scénario trouvé. Disponibles :', ', '.join(s.stem for s in tous))
        return 1

    genere = banc / 'genere'
    genere.mkdir(exist_ok=True)
    page_widget = assembler(widget)
    echec = False
    for scenario in choisis:
        page = genere / f'banc-{scenario.stem}.html'
        page.write_text(construire_page(page_widget, banc, scenario), encoding='utf-8')
        for largeur in args.largeurs:
            bilan = jouer_page(navigateur, page, largeur, widget)
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
