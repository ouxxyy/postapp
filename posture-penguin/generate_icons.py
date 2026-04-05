#!/usr/bin/env python3
"""Generate proper PNG icons for Chrome Extension using PIL."""
from PIL import Image, ImageDraw, ImageFont
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'dist', 'icons')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Size requirements for Chrome Web Store
SIZES = {
    16: "toolbar",
    32: "toolbar @2x",
    48: "extension page",
    128: "web store",
}

def draw_penguin_icon(size):
    """Draw a coral-pink penguin icon with the 🐧 emoji centered."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Coral pink circle background (#ff8a9b)
    bg_color = (255, 138, 155, 255)
    margin = max(1, size // 8)
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill=bg_color
    )

    # White inner circle (smaller)
    inner_margin = max(2, size // 4)
    draw.ellipse(
        [inner_margin, inner_margin, size - inner_margin, size - inner_margin],
        fill=(255, 255, 255, 220)
    )

    # Draw penguin emoji centered
    try:
        # Try system emoji font
        font_size = max(8, int(size * 0.55))
        font = ImageFont.truetype('/System/Library/Fonts/Apple Color Emoji.ttc', font_size)
    except Exception:
        try:
            font = ImageFont.truetype('/System/Library/Fonts/NotoColorEmoji.ttf', font_size)
        except Exception:
            font = ImageFont.load_default()

    # Get text bounding box
    penguin = "🐧"
    try:
        bbox = draw.textbbox((0, 0), penguin, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except Exception:
        text_w = text_h = font_size

    x = (size - text_w) // 2
    y = (size - text_h) // 2 - max(1, size // 16)

    draw.text((x, y), penguin, font=font)

    return img

def create_icon(size):
    img = draw_penguin_icon(size)
    out_path = os.path.join(OUTPUT_DIR, f'icon{size}.png')
    img.save(out_path, 'PNG')
    print(f"✓ Created {out_path} ({SIZES.get(size, 'other')})")

def main():
    print("Generating Chrome Extension icons...")
    for size in [16, 32, 48, 128]:
        create_icon(size)
    print("\nAll icons generated successfully!")

if __name__ == '__main__':
    main()
