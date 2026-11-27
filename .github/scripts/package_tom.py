"""Export checked-in website files and only the archive assets they reference."""
import shutil
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

source, output = (Path(arg).resolve() for arg in sys.argv[1:])
files = {source / name for name in ('index.html', 'directory.html', 'site.css', 'directory.js')}
files.update((source / 'read').rglob('*.html'))
assets = [source / 'archive' / directory for directory in ('images','files')]

class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name not in ('href', 'src', 'action') or not value:
                continue
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue
            dest = (self.page.parent / unquote(url.path)).resolve()
            if dest in files:
                continue
            if not any(dest.is_relative_to(folder) for folder in assets):
                raise ValueError(f'Unexpected local destination in {self.page.name}: {value}')
            files.add(dest)

for page in sorted(files):
    if page.suffix == '.html':
        parser = Links()
        parser.page = page
        parser.feed(page.read_text(encoding='utf-8'))
        parser.close()

for path in sorted(files):
    relative = path.relative_to(source)
    if path.resolve() != path or not path.is_file():
        raise ValueError(f'Missing or indirect file: {relative}')
    target = output / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
print(f'Packaged {len(files):,} website files.')
