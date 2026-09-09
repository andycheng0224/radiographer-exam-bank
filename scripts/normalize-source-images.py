"""One-time format repair; preserve decoded pixels and back up original bytes.

Requires Pillow with JPEG 2000 support. Not required by normal npm builds.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import os
from PIL import Image

root = Path(__file__).resolve().parents[1]
backup = root / '.cache' / 'original-image-formats'
backup.mkdir(parents=True, exist_ok=True)
report = []
for source in sorted((root / 'src' / 'uploads').glob('*.png')):
    original = source.read_bytes()
    with Image.open(BytesIO(original)) as decoded:
        decoded.load()
        if decoded.format == 'PNG':
            continue
        original_format = decoded.format
        target = BytesIO()
        decoded.save(target, format='PNG')
        converted = target.getvalue()
        with Image.open(BytesIO(converted)) as check:
            check.load()
            if check.mode != decoded.mode or check.size != decoded.size or check.tobytes() != decoded.tobytes():
                raise ValueError(f'Pixel mismatch: {source.name}')
        saved_original = backup / source.name
        if saved_original.exists() and saved_original.read_bytes() != original:
            raise ValueError(f'Backup already contains different bytes: {source.name}')
        if not saved_original.exists():
            saved_original.write_bytes(original)
        temporary = source.with_suffix('.png.tmp')
        temporary.write_bytes(converted)
        os.replace(temporary, source)
        report.append({'file': source.name, 'original_format': original_format, 'size': decoded.size,
                       'mode': decoded.mode, 'pixels_equal': True,
                       'before_sha256': hashlib.sha256(original).hexdigest(),
                       'after_sha256': hashlib.sha256(converted).hexdigest()})
if report:
    (backup / 'conversion-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(f'Converted {len(report)} images; all decoded pixels identical. Originals: {backup}')
