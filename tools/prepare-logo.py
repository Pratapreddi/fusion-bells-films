"""Turn a raw logo export into the two files the site actually uses.

    python tools/prepare-logo.py images/logo-new.png

Does three things the site needs and design exports never do:

  1. Knocks out a flat white/near-white background so the logo can sit on the
     ivory header and the dark footer without a visible box behind it.
  2. Trims the empty canvas. Exports are usually a huge frame with the mark
     floating in the middle; left as-is the logo renders at a third of its
     intended size in the nav.
  3. Writes the full lockup plus a square monogram crop for the favicon.

Outputs: images/logo-full.png  (whole lockup, transparent, trimmed)
         images/logo-mark.png  (FBF monogram only, square, for the favicon)
"""
import sys, os
from PIL import Image

WHITE_CUTOFF = 238      # anything lighter than this counts as background
PAD = 0.02              # breathing room around the trimmed art, as a fraction


def knockout_background(im):
    """Make a flat light background transparent. Left alone if already alpha."""
    im = im.convert("RGBA")
    alpha = im.getchannel("A")
    if alpha.getextrema()[0] < 250:      # already has real transparency
        return im, False

    px = im.load()
    w, h = im.size
    # Only knock out if the corners really are light — otherwise this is
    # artwork on a dark plate and we would destroy it.
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    if not all(sum(c[:3]) / 3 >= WHITE_CUTOFF for c in corners):
        return im, False

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = (r + g + b) / 3
            if lum >= WHITE_CUTOFF:
                px[x, y] = (r, g, b, 0)
            elif lum > WHITE_CUTOFF - 40:
                # feather the edge so letterforms keep their anti-aliasing
                px[x, y] = (r, g, b, int(255 * (WHITE_CUTOFF - lum) / 40))
    return im, True


def trim(im, pad=PAD):
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if not box:
        return im
    l, t, r, b = box
    mx, my = int((r - l) * pad), int((b - t) * pad)
    return im.crop((max(l - mx, 0), max(t - my, 0),
                    min(r + mx, im.width), min(b + my, im.height)))


def fit(im, max_w):
    if im.width <= max_w:
        return im
    return im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)


def square(im, size=512):
    """Centre the art on a transparent square — favicons must not be letterboxed."""
    art = fit(trim(im), size)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def cut_above_gap(full, nth=1):
    """Crop everything above the nth horizontal blank band.

    A lockup is stacked bands of art separated by empty rows. Finding those
    bands lets us slice off the monogram (nth=1) or the monogram plus wordmark
    (nth=2) without hard-coding fractions, which clip letterforms when the
    lockup changes.
    """
    alpha = full.getchannel("A")
    w, h = full.size
    rows = [sum(1 for x in range(0, w, 4) if alpha.getpixel((x, y)) > 8)
            for y in range(h)]
    busy = max(rows) if rows else 0
    if not busy:
        return full

    gap_threshold = max(1, busy * 0.02)
    found, y, seen_content = 0, 0, False
    while y < h:
        if rows[y] > busy * 0.15:
            seen_content = True
        if seen_content and rows[y] <= gap_threshold:
            run = 0
            while y + run < h and rows[y + run] <= gap_threshold:
                run += 1
            if run >= max(3, h * 0.012) and y > h * 0.12:
                found += 1
                if found == nth:
                    return trim(full.crop((0, 0, w, y)))
            y += run
            continue
        y += 1
    return full


def main(src):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    im, knocked = knockout_background(Image.open(src))
    full = trim(im)

    mono = cut_above_gap(full, 1)      # FBF monogram
    word = cut_above_gap(full, 2)      # monogram + FUSION BELLS FILMS

    outputs = {
        # complete lockup incl. tagline — only legible when shown large
        "logo-full.png":     fit(full, 1400),
        # what the site uses at 50-60px, where a tagline would be unreadable
        "logo-wordmark.png": fit(word, 1000),
        "logo-mark.png":     square(mono, 512),
    }
    print(f"source  {Image.open(src).size}  background knocked out: {knocked}")
    for name, img in outputs.items():
        path = os.path.join(root, "images", name)
        img.save(path)
        print(f"  images/{name:<18} {img.size}  {os.path.getsize(path)//1024} KB")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: python tools/prepare-logo.py <path-to-logo>")
    main(sys.argv[1])
