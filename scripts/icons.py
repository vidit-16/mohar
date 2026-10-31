# python scripts/icons.py: the browser-tab and home-screen icons, cut from the lac seal the share card uses
# (api/assets/lac.png), so the logo is the same wax everywhere.
from PIL import Image

lac = Image.open("api/assets/lac.png").convert("RGBA")
x0, y0, x1, y1 = lac.getchannel("A").getbbox()
side = max(x1 - x0, y1 - y0) + 8
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
square = Image.new("RGBA", (side, side))
square.paste(lac.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)), (0, 0))

for size, name in [(32, "favicon-32.png"), (64, "favicon-64.png")]:
    square.resize((size, size), Image.LANCZOS).save(f"public/{name}", optimize=True)
# iOS draws transparent icons on black, so the home-screen icon sits on the page's paper colour
touch = Image.new("RGBA", (180, 180), "#fbfaf8")
seal = square.resize((150, 150), Image.LANCZOS)
touch.alpha_composite(seal, (15, 15))
touch.convert("RGB").save("public/apple-touch-icon.png", optimize=True)
print("wrote public/favicon-32.png, favicon-64.png, apple-touch-icon.png")
