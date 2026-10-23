from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
source = root / 'extension'
manifest = json.loads((source / 'manifest.json').read_text())
target = root / 'dist' / f'tabbynotey-{manifest["version"]}.zip'
target.parent.mkdir(exist_ok=True)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob('*')):
        if path.is_file() and path.name != '.DS_Store':
            archive.write(path, path.relative_to(source))
print(target)
