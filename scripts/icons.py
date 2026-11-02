"""Draws the toolbar icons: a note sheet with a folded corner on the accent green,
and the amber bell the icon switches to while a reminder alert is waiting."""
from pathlib import Path
from PIL import Image, ImageDraw

ACCENT = (47, 107, 87, 255)
DUE = (180, 83, 9, 255)
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

# Ringing state, used only by chrome.action.setIcon, so just the toolbar sizes.
# Eight frames make one swing: the bell pivots on its hanger (the hinge, which stays
# put) from centre to left, back through centre, to right. The clapper lags behind
# the bell, and the background brightens at each end of the swing, where it strikes.
DUE_BRIGHT = (245, 140, 20, 255)
HINGE = (S / 2, 92)
SWING = [0, 10, 18, 10, 0, -10, -18, -10]       # degrees, one per frame
STRIKES = {2, 6}                             # frames at the ends of the swing


def bell_mask(angle):
    body = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(body)
    d.ellipse((232, 68, 280, 116), fill=255)                                 # hanger
    d.ellipse((150, 92, 362, 304), fill=255)                                 # crown
    d.polygon([(150, 200), (362, 200), (392, 352), (120, 352)], fill=255)    # flared body
    d.rounded_rectangle((96, 336, 416, 380), radius=22, fill=255)            # lip
    clapper = Image.new('L', (S, S), 0)
    ImageDraw.Draw(clapper).ellipse((218, 380, 294, 452), fill=255)
    mask = body.rotate(angle, resample=Image.BICUBIC, center=HINGE)
    mask.paste(255, (0, 0), clapper.rotate(angle * .4, resample=Image.BICUBIC, center=HINGE))
    # Shrink so the swung bell stays clear of the rounded corners.
    small = mask.resize((int(S * .8),) * 2, Image.LANCZOS)
    out_mask = Image.new('L', (S, S), 0)
    out_mask.paste(small, ((S - small.width) // 2, (S - small.height) // 2 + 4))
    return out_mask


def bell_frame(background, mask):
    frame = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, S - 1, S - 1), radius=112, fill=background)
    frame.paste(Image.new('RGBA', (S, S), PAPER), (0, 0), mask)
    return frame


for index, angle in enumerate(SWING):
    frame = bell_frame(DUE_BRIGHT if index in STRIKES else DUE, bell_mask(angle))
    for size in (16, 32):
        frame.resize((size, size), Image.LANCZOS).save(out / f'bell-{index}-{size}.png')
print(out / 'bell-*.png')
