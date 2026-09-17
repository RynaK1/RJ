"""Run isolated browser regression tests without contacting Supabase.
Usage: python tests/run-task-retention.py [--chrome PATH]
"""
import argparse
from pathlib import Path
import re
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--chrome', default=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
def inline(match):
    source = (root / match[1]).read_text(encoding='utf-8')
    if match[1] == 'app.js':
        source = source.replace('initialize();', '/* Isolated test: no auth or timers. */', 1)
    return '<script>' + source + '</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
html = html.replace('</body>', '<script>' + (root / 'tests/task-retention.js').read_text(encoding='utf-8-sig') + '</script></body>')
with tempfile.TemporaryDirectory(prefix='rj-retention-') as work:
    page = Path(work) / 'test.html'
    page.write_text(html, encoding='utf-8')
    result = subprocess.run([args.chrome, '--headless', '--disable-gpu', '--no-sandbox',
        '--user-data-dir=' + str(Path(work) / 'profile'), '--virtual-time-budget=1500',
        '--dump-dom', page.as_uri()], capture_output=True, text=True, encoding='utf-8', timeout=30)
    match = re.search(r'<body>(.*?)</body>', result.stdout, re.S)
    output = match[1].strip() if match else result.stderr
    print(output)
    if not output.startswith('PASS'):
        raise SystemExit(1)
