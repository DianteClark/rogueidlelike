"""Copies Tiny Swords pack folders into assets/packs/<name>, dropping macOS junk and .aseprite sources,
then builds compact 9-slice UI images in assets/ui/.

Usage: python3 tools/import_packs.py <repo_root> name=/path/to/pack/root [name=/path ...]
e.g.   free="/x/Tiny Swords (Free Pack)" enemy="/x/Enemy Pack" warfare="/x/Warfare"
When a new pack version comes out, run this again with the new folder.
"""
import sys, os, shutil
from PIL import Image

root = sys.argv[1]
packs = dict(a.split('=', 1) for a in sys.argv[2:])
for name, src in packs.items():
    dst = os.path.join(root, 'assets', 'packs', name)
    if os.path.exists(dst):
        shutil.rmtree(dst)
    for dirpath, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d != '__MACOSX']
        for f in files:
            if not f.lower().endswith('.png'):
                continue
            rel = os.path.relpath(os.path.join(dirpath, f), src)
            out = os.path.join(dst, rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            shutil.copy2(os.path.join(dirpath, f), out)
    print('imported', name)

# Compact 9-slice sheets: the pack spaces pieces apart with empty gutters; CSS border-image needs them packed.
ui = os.path.join(root, 'assets', 'packs', 'free', 'UI Elements', 'UI Elements')
if os.path.isdir(ui):
    outdir = os.path.join(root, 'assets', 'ui')
    os.makedirs(outdir, exist_ok=True)
    def nine(src, name, rows=None):
        im = Image.open(os.path.join(ui, src)).convert('RGBA')
        w = im.width
        c = 64 if w == 320 else 128           # corner cell size
        xs = [(0, c), (c + 64, c + 128), (c + 192, 2 * c + 192)] if c == 128 else [(0, 64), (128, 192), (256, 320)]
        ys = rows or xs
        out = Image.new('RGBA', (c * 2 + 64, (ys[0][1]-ys[0][0]) + (ys[1][1]-ys[1][0]) + (ys[2][1]-ys[2][0])))
        oy = 0
        for (y0, y1) in ys:
            ox = 0
            for (x0, x1) in xs:
                out.paste(im.crop((x0, y0, x1, y1)), (ox, oy)); ox += x1 - x0
            oy += y1 - y0
        out.save(os.path.join(outdir, name))
        print('ui', name, out.size, 'slice', c)
    nine('Papers/RegularPaper.png', 'paper.png')
    nine('Papers/SpecialPaper.png', 'paper-special.png')
    nine('Wood Table/WoodTable.png', 'wood.png')
    nine('Banners/Banner.png', 'banner.png')
    nine('Buttons/BigBlueButton_Regular.png', 'btn-blue.png')
    nine('Buttons/BigBlueButton_Pressed.png', 'btn-blue-pressed.png')
    nine('Buttons/BigRedButton_Regular.png', 'btn-red.png')
    nine('Buttons/BigRedButton_Pressed.png', 'btn-red-pressed.png')
