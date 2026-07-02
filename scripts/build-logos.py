# Redimensionne les logos partenaires et les intègre en base64 dans lib/logos.js
# Usage: python scripts/build-logos.py
import base64
import io
import os
from PIL import Image, ImageChops


def trim(img):
    """Rogne les marges transparentes ou blanches autour d'un logo.
    Ne touche pas aux logos à fond plein (noir/coloré) comme De Vinci."""
    r, g, b, a = img.getpixel((0, 0))
    if a < 10:
        # fond transparent → on recadre sur le contenu (alpha)
        bbox = img.split()[-1].getbbox()
        return img.crop(bbox) if bbox else img
    if r > 240 and g > 240 and b > 240:
        # fond blanc → on rogne les bords quasi-blancs
        rgb = img.convert("RGB")
        bg = Image.new("RGB", rgb.size, (255, 255, 255))
        bbox = ImageChops.difference(rgb, bg).getbbox()
        return img.crop(bbox) if bbox else img
    # fond plein coloré/noir → on garde tel quel
    return img

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, "assets", "logos")
OUT = os.path.join(HERE, "lib", "logos.js")

# nom_de_clé -> fichier
LOGOS = {
    "devinci": "devinci.png",
    "altavo": "altavo.png",
    "darblockchain": "darblockchain.png",
    "hedera": "hedera.png",
    "lightency": "lightency.png",
}

MAX_DIM = 260  # dimension max après redimensionnement (px)

entries = []
for key, fname in LOGOS.items():
    path = os.path.join(SRC, fname)
    img = Image.open(path).convert("RGBA")
    img = trim(img)  # on enlève les marges autour du logo
    w, h = img.size
    # on met à l'échelle pour que la plus grande dimension = MAX_DIM
    scale = MAX_DIM / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    data_uri = "data:image/png;base64," + b64
    entries.append((key, data_uri, nw, nh, len(buf.getvalue())))
    print(f"{key}: {w}x{h} -> {nw}x{nh}, {len(buf.getvalue())} bytes")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// ═══════════════════════════════════════════════════════════════\n")
    f.write("//  lib/logos.js — Logos des partenaires intégrés en base64\n")
    f.write("//  Généré par scripts/build-logos.py (ne pas éditer à la main).\n")
    f.write("// ═══════════════════════════════════════════════════════════════\n")
    f.write("export const LOGOS = {\n")
    for key, data_uri, nw, nh, _ in entries:
        f.write(f'  {key}: {{ w: {nw}, h: {nh}, data: "{data_uri}" }},\n')
    f.write("};\n")

total = sum(e[4] for e in entries)
print(f"\nlib/logos.js written. Total image bytes: {total} (~{round(total*1.33/1024)} KB base64)")
