"""Builds the app icon from pack art. Usage: python3 tools/make_icon.py <repo_root>"""
import sys, math, os
from PIL import Image, ImageDraw, ImageFilter

root = sys.argv[1]
A = os.path.join(root, 'assets')
S = 1024

def load(p): return Image.open(os.path.join(A, p)).convert('RGBA')

# Background: deep sea radial gradient
bg = Image.new('RGBA', (S, S))
px = bg.load()
cx, cy = S / 2, S * 0.46
for y in range(S):
    for x in range(S):
        d = min(1, math.hypot(x - cx, y - cy) / (S * 0.72))
        c0, c1 = (92, 196, 190), (24, 52, 74)
        px[x, y] = tuple(int(c0[i] + (c1[i] - c0[i]) * d ** 0.9) for i in range(3)) + (255,)

# Sun rays
rays = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(rays)
n = 14
for i in range(n):
    a0 = (i / n) * 2 * math.pi + 0.08
    a1 = a0 + math.pi / n * 0.85
    pts = [(cx, cy), (cx + math.cos(a0) * S, cy + math.sin(a0) * S), (cx + math.cos(a1) * S, cy + math.sin(a1) * S)]
    d.polygon(pts, fill=(255, 236, 160, 34))
rays = rays.filter(ImageFilter.GaussianBlur(3))
bg.alpha_composite(rays)

# Small island at the bottom, built from the real tileset (foam + autotiled ground)
tile = load('packs/free/Terrain/Tileset/Tilemap_color1.png')
foam = load('packs/free/Terrain/Tileset/Water Foam.png')
T = 64
W, H = 9, 3
island = Image.new('RGBA', (T * (W + 2), T * (H + 2)), (0, 0, 0, 0))
for j in range(H):
    for i in range(W):
        f = (i * 5 + j * 3) % 16
        island.alpha_composite(foam.crop((f * 192, 0, f * 192 + 192, 192)), (T * (i + 1) - 64, T * (j + 1) - 64))
for j in range(H):
    for i in range(W):
        cx_ = 0 if i == 0 else (2 if i == W - 1 else 1)
        cy_ = 0 if j == 0 else (2 if j == H - 1 else 1)
        island.alpha_composite(tile.crop((cx_ * T, cy_ * T, cx_ * T + T, cy_ * T + T)), (T * (i + 1), T * (j + 1)))
tower = load('packs/free/Buildings/Blue Buildings/Tower.png')
island.alpha_composite(tower, (T * 1 + 0, T * 2 - 192))
island.alpha_composite(tower, (T * (W - 1) - 0, T * 2 - 192))
island = island.resize((int(island.width * 1.25), int(island.height * 1.25)), Image.NEAREST)
bg.alpha_composite(island, ((S - island.width) // 2, S - island.height - 6))

# King avatar, big and centered
king = load('packs/warfare/King/King Avatar/King_Avatar_01.png')
king = king.crop(king.getbbox())
scale = 3
king = king.resize((king.width * scale, king.height * scale), Image.NEAREST)
kx = (S - king.width) // 2
ky = int(S * 0.45 - king.height / 2)
pad = 80
sh = Image.new('RGBA', (king.width + pad * 2, king.height + pad * 2), (0, 0, 0, 0))
m = Image.new('L', sh.size, 0); m.paste(king.getchannel('A'), (pad, pad))
sh.paste((8, 18, 28, 160), mask=m)
sh = sh.filter(ImageFilter.GaussianBlur(20))
bg.alpha_composite(sh, (kx - pad + 8, ky - pad + 30))
bg.alpha_composite(king, (kx, ky))

out = os.path.join(root, 'icons')
os.makedirs(out, exist_ok=True)
flat = bg.convert('RGB')
flat.save(os.path.join(out, 'icon-1024.png'))
for size in (512, 192, 180):
    flat.resize((size, size), Image.LANCZOS).save(os.path.join(out, f'icon-{size}.png'))
print('icons written')
