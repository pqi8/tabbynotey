"""Draws the toolbar icon: a note sheet with a folded corner on the accent green."""
from pathlib import Path
from PIL import Image, ImageDraw

ACCENT = (47, 107, 87, 255)
PAPER = (250, 250, 249, 255)
FOLD = (205, 225, 216, 255)
S = 512  # draw large, then downsample for clean edges

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((0, 0, S - 1, S - 1), radius=112, fill=ACCENT)

left, top, right, bottom, fold = 128, 104, 384, 408, 84
d.polygon([(left, top), (right - fold, top), (right, top + fold), (right, bottom), (left, bottom)], fill=PAPER)
d.polygon([(right - fold, top), (right - fold, top + fold), (right, top + fold)], fill=FOLD)
for y, end in ((212, 320), (268, 320), (324, 264)):
    d.rounded_rectangle((176, y - 14, end, y + 14), radius=14, fill=ACCENT)

out = Path(__file__).resolve().parent.parent / 'extension' / 'icons'
out.mkdir(exist_ok=True)
for size in (16, 32, 48, 128):
    if size == 128:
        # Chrome Web Store square artwork: 96px inside a 128px transparent canvas.
        icon = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
        icon.paste(img.resize((96, 96), Image.LANCZOS), (16, 16))
    else:
        icon = img.resize((size, size), Image.LANCZOS)
    icon.save(out / f'{size}.png')
    print(out / f'{size}.png')
