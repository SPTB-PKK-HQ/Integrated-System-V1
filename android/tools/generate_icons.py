#!/usr/bin/env python3
"""Jana ikon Android, PWA dan splash daripada icon.png di root repo."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "icon.png"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
WEB_ICONS = ROOT / "icons"

LANCZOS = getattr(Image, "Resampling", Image).LANCZOS


def load_logo() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    return image


def fit_logo(
    logo: Image.Image,
    size: int,
    padding_ratio: float,
    background: tuple[int, int, int, int] | None = None,
    circle: bool = False,
) -> Image.Image:
    inner = max(1, int(size * (1.0 - (padding_ratio * 2.0))))
    ratio = min(inner / logo.width, inner / logo.height)
    new_size = (max(1, int(logo.width * ratio)), max(1, int(logo.height * ratio)))
    resized = logo.resize(new_size, LANCZOS)
    resized = resized.filter(ImageFilter.UnsharpMask(radius=1.4, percent=70, threshold=2))

    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    if circle and background:
        mask = Image.new("L", (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size - 1, size - 1), fill=255)
        canvas.putalpha(mask)

    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)}")


def main() -> None:
    logo = load_logo()
    white = (255, 255, 255, 255)

    print("Ikon PWA:")
    save(fit_logo(logo, 192, 0.10, white), WEB_ICONS / "icon-192.png")
    save(fit_logo(logo, 512, 0.10, white), WEB_ICONS / "icon-512.png")
    save(fit_logo(logo, 512, 0.25, white), WEB_ICONS / "icon-maskable-512.png")
    save(fit_logo(logo, 180, 0.10, white), WEB_ICONS / "apple-touch-icon.png")

    print("Ikon launcher Android:")
    legacy_sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    for density, size in legacy_sizes.items():
        save(fit_logo(logo, size, 0.10, white), ANDROID_RES / f"mipmap-{density}" / "ic_launcher.png")
        save(
            fit_logo(logo, size, 0.12, white, circle=True),
            ANDROID_RES / f"mipmap-{density}" / "ic_launcher_round.png",
        )

    print("Ikon adaptive Android:")
    adaptive_sizes = {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }
    for density, size in adaptive_sizes.items():
        save(
            fit_logo(logo, size, 0.20, None),
            ANDROID_RES / f"mipmap-{density}" / "ic_launcher_foreground.png",
        )

    print("Ikon splash:")
    save(fit_logo(logo, 512, 0.20, None), ANDROID_RES / "drawable-nodpi" / "splash_icon.png")


if __name__ == "__main__":
    main()
