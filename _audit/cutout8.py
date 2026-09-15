"""Keep only the dish: not the plate, not the backdrop.

The five supplied photographs are studio shots on a smooth neutral grey
backdrop (measured: 200-221 grey, local texture ~1.0), with the dish sitting on
a pale plate. Measured on the originals:

  * the backdrop and the plate are neutral (max-min channel spread of a few
    levels) and smooth (local luminance deviation 1-4);
  * the dish is chromatic (spread 60+ on the bread, the meat, the salad) and
    full of detail (deviation 20-35);
  * a plate that picks up a wash of colour from the dish is still smooth and
    still bright, which is what the third test below catches.

So the dish is isolated on colour and on detail, never on brightness, and the
pale smooth parts inside it (white cheese, cream sauce) are recovered by
closing the outline - but only where the pixel is itself not plate-like, so the
plate showing through the gap between two sandwich halves stays transparent.
Nothing is drawn: every kept pixel is a pixel of the photograph.

Run: python _audit/cutout5.py [chroma] [dark] [feather]
"""

import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

CHROMA = float(sys.argv[1]) if len(sys.argv) > 1 else 12.0
DARK = float(sys.argv[2]) if len(sys.argv) > 2 else 100.0
FEATHER = float(sys.argv[3]) if len(sys.argv) > 3 else 1.1

BLOCK = 24
MARGIN = 8
OUT_WIDTH = 900
MIN_FRACTION = 0.01
SEAL = 2
OPENING = 14
TRIM = 10
TEXTURE = 4.0
ALLOW = 10
FADE_PX = 12.0
CORE = 9
SMOOTH = 1.3
GROW = 2
SPECK = 240
HOLE_FILL = 900

# Plate / backdrop: smooth, bright, and at most faintly tinted.
PLATE_TEXTURE = 5.0
PLATE_BRIGHT = 138.0
PLATE_CHROMA = 42.0

# A last pass along the silhouette: the plate's soft contact shadow survives the
# fill above (it is dimmer than the plate test allows), but it only ever sits
# just outside the dish. Anything flat, barely tinted and bright, within a few
# pixels of the outside, is that shadow - never the middle of a slice of cheese.
RIM = 6
RIM_TEXTURE = 3.8
RIM_CHROMA = 30.0
RIM_BRIGHT = 112.0

# Specks below this many pixels at the original scale (crumbs, parsley, dust on
# the plate) are dropped: they read as noise, not as part of the dish.
SPECK = 260

SOURCES_ALL = [
    ("_audit/incoming/in-01.png", "img/menu/cat-01-sandwich-froid.png"),
    ("_audit/incoming/in-02.png", "img/menu/cat-02-sandwich-chaud.png"),
    ("_audit/incoming/in-03.png", "img/menu/cat-03-burger.png"),
    ("_audit/incoming/in-04.png", "img/menu/cat-04-tacos.png"),
    ("_audit/incoming/in-05.png", "img/menu/cat-05-pates.png"),
]


def box_mean(array, radius):
    """Moving average, separable and exact at the borders."""
    out = np.asarray(array, dtype=np.float64)
    for axis in (0, 1):
        moved = np.moveaxis(out, axis, 0)
        total = np.cumsum(moved, axis=0)
        total = np.concatenate([np.zeros((1,) + moved.shape[1:]), total], axis=0)
        length = moved.shape[0]
        index = np.arange(length)
        start = np.clip(index - radius, 0, length)
        stop = np.clip(index + radius + 1, 0, length)
        out = np.moveaxis(
            (total[stop] - total[start]) / (stop - start)[:, None], 0, axis
        )
    return out


def texture(rgb, radius=5):
    """Local luminance deviation: how much detail the picture carries here."""
    luminance = rgb.mean(axis=2)
    mean = box_mean(luminance, radius)
    return np.sqrt(np.clip(box_mean(luminance * luminance, radius) - mean * mean, 0, None))


def bilinear(grid, ys, xs):
    rows, cols = grid.shape
    y0 = np.clip(np.floor(ys).astype(int), 0, rows - 1)
    x0 = np.clip(np.floor(xs).astype(int), 0, cols - 1)
    y1 = np.clip(y0 + 1, 0, rows - 1)
    x1 = np.clip(x0 + 1, 0, cols - 1)
    wy = np.clip(ys - y0, 0, 1)[:, None]
    wx = np.clip(xs - x0, 0, 1)[None, :]
    top = grid[y0][:, x0] * (1 - wx) + grid[y0][:, x1] * wx
    bottom = grid[y1][:, x0] * (1 - wx) + grid[y1][:, x1] * wx
    return top * (1 - wy) + bottom * wy


def local_backdrop(rgb, subject):
    """The backdrop's own colour at every pixel, read between the subject."""
    h, w, _ = rgb.shape
    rows = int(np.ceil(h / BLOCK))
    cols = int(np.ceil(w / BLOCK))
    grid = np.full((rows, cols, 3), np.nan)
    for row in range(rows):
        for col in range(cols):
            y0, y1 = row * BLOCK, min(h, (row + 1) * BLOCK)
            x0, x1 = col * BLOCK, min(w, (col + 1) * BLOCK)
            take = ~subject[y0:y1, x0:x1]
            if take.sum() < 40:
                continue
            grid[row, col] = np.median(rgb[y0:y1, x0:x1][take], axis=0)

    for _ in range(max(rows, cols)):
        if not np.isnan(grid).any():
            break
        filled = grid.copy()
        for row in range(rows):
            for col in range(cols):
                if not np.isnan(grid[row, col, 0]):
                    continue
                neighbours = [
                    grid[row + dy, col + dx]
                    for dy in (-1, 0, 1)
                    for dx in (-1, 0, 1)
                    if 0 <= row + dy < rows
                    and 0 <= col + dx < cols
                    and not np.isnan(grid[row + dy, col + dx, 0])
                ]
                if neighbours:
                    filled[row, col] = np.mean(neighbours, axis=0)
        grid = filled

    smooth = np.empty_like(rgb)
    ys = (np.arange(h) + 0.5) / BLOCK - 0.5
    xs = (np.arange(w) + 0.5) / BLOCK - 0.5
    for channel in range(3):
        smooth[..., channel] = box_mean(bilinear(grid[..., channel], ys, xs), 3)
    return smooth


def dilate(mask, rounds=1):
    out = mask.copy()
    for _ in range(rounds):
        grow = out.copy()
        grow[1:, :] |= out[:-1, :]
        grow[:-1, :] |= out[1:, :]
        grow[:, 1:] |= out[:, :-1]
        grow[:, :-1] |= out[:, 1:]
        out = grow
    return out


def erode(mask, rounds=1):
    return ~dilate(~mask, rounds)


def blob_labels(mask):
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    sizes = [0]
    current = 0
    for start_y in range(h):
        row = mask[start_y]
        for start_x in range(w):
            if not row[start_x] or labels[start_y, start_x]:
                continue
            current += 1
            size = 0
            queue = deque([(start_y, start_x)])
            labels[start_y, start_x] = current
            while queue:
                y, x = queue.popleft()
                size += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        queue.append((ny, nx))
            sizes.append(size)
    return labels, sizes


def outside_of(mask):
    """Everything reachable from the border without crossing the shape."""
    h, w = mask.shape
    free = ~mask
    seen = np.zeros((h, w), dtype=bool)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and free[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def fill_small_holes(shape, limit):
    """Put back the pale crumb inside the dish; leave big gaps open."""
    holes = enclosed(shape)
    labels, sizes = blob_labels(holes)
    filled = shape.copy()
    for index in range(1, len(sizes)):
        if sizes[index] < limit:
            filled |= labels == index
    return filled


def enclosed(mask):
    return ~outside_of(mask) & ~mask


def prune(mask, floor):
    """Keep only the blobs at or above `floor` pixels."""
    labels, sizes = blob_labels(mask)
    keep = np.zeros_like(mask)
    for index in range(1, len(sizes)):
        if sizes[index] >= floor:
            keep |= labels == index
    return keep


def main_blob(mask, fill_ok):
    """Largest blob, plus what it encloses - but only where that is dish."""
    labels, sizes = blob_labels(mask)
    if len(sizes) < 2:
        return mask
    keep = labels == (int(np.argmax(sizes[1:])) + 1)
    if sizes[int(np.argmax(sizes[1:])) + 1] < mask.size * MIN_FRACTION:
        return keep
    return keep | (~outside_of(keep) & fill_ok)


def cut(src, dst):
    image = Image.open(src).convert("RGB")
    rgb = np.asarray(image).astype(np.float64)

    subject = np.zeros(rgb.shape[:2], dtype=bool)
    model = local_backdrop(rgb, subject)
    for _ in range(3):
        subject = np.abs(rgb - model).max(axis=2) > 26
        model = local_backdrop(rgb, subject)

    luminance = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    detail = texture(rgb, 5)
    difference = np.abs(rgb - model).max(axis=2)

    # The dish: the chromatic part of the frame, plus its own deep shadows.
    food = (spread > CHROMA) | ((spread > 6) & (luminance < DARK))
    food &= difference > 8
    # A plate tinted by the dish passes the colour test but is still smooth.
    food &= detail > TEXTURE

    # Smooth, bright, barely tinted: plate or backdrop, never dish.
    plate_like = (detail < PLATE_TEXTURE) & (luminance > PLATE_BRIGHT) & (
        spread < PLATE_CHROMA
    )
    print(f"   food candidates: {food.mean() * 100:.1f}%  plate-like: {plate_like.mean() * 100:.1f}%")

    subject = main_blob(dilate(food, SEAL), fill_ok=~plate_like)
    # Opening rubs off the thin slivers the plate's rim leaves behind.
    subject = dilate(erode(subject, OPENING), max(0, OPENING - TRIM))

    # The plate is always *below* the dish: in each column, stop at the lowest
    # pixel that is unambiguously dish, plus a small allowance so no edge is
    # shaved. Pale columns borrow the neighbouring line so the cut stays
    # continuous instead of dropping a slice of the dish.
    strong = (spread > 60) | (luminance < 80)
    rows = np.arange(subject.shape[0])[:, None]
    # Only a *thick* piece of dish sets the line: a herb or a crumb lying on the
    # plate is strong and coloured but thin, and must not drag the line down to
    # its own row - that is how the crumbs survived.
    core = erode(subject, CORE)
    lowest = np.where(strong & core, rows, -1).max(axis=0)
    known = np.where(lowest >= 0)[0]
    if len(known) > 1:
        lowest = np.interp(np.arange(lowest.shape[0]), known, lowest[known])
    else:
        lowest = np.full(lowest.shape, subject.shape[0] + ALLOW, dtype=np.float64)
    subject = subject & (rows <= (lowest + ALLOW)[None, :])

    subject = main_blob(subject, fill_ok=~plate_like)

    # The line below the dish fades out over a few pixels instead of stopping
    # dead: a hard per-column cut leaves a staircase across the bread.
    cut_line = (lowest + ALLOW)[None, :]
    fade = np.clip((cut_line + FADE_PX - rows) / FADE_PX, 0, 1)
    subject = subject & (rows < (lowest + ALLOW + FADE_PX)[None, :])

    # Round the silhouette: a blur then a re-threshold turns the staircase into
    # an edge. Then drop the specks and put back the pale crumb the colour test
    # missed - small holes are always food, a large one is the plate showing
    # through the gap between two halves.
    soft = np.asarray(
        Image.fromarray((subject * 255).astype(np.uint8), mode="L").filter(
            ImageFilter.GaussianBlur(SMOOTH)
        )
    ).astype(np.float64)
    subject = prune(soft > 127, SPECK)
    subject = main_blob(subject, fill_ok=False)
    subject = fill_small_holes(subject, HOLE_FILL)
    subject = dilate(subject, GROW)
    print(f"   soft fade: {(fade < 0.999).sum()} px tapered")

    alpha = Image.fromarray(
        np.clip(subject * fade * 255, 0, 255).astype(np.uint8), mode="L"
    )
    alpha = alpha.filter(ImageFilter.GaussianBlur(FEATHER))
    subject = np.asarray(alpha) > 20

    out = image.convert("RGBA")
    out.putalpha(alpha)

    box = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
    if box:
        left, top, right, bottom = box
        out = out.crop(
            (
                max(0, left - MARGIN),
                max(0, top - MARGIN),
                min(out.width, right + MARGIN),
                min(out.height, bottom + MARGIN),
            )
        )
    if out.width > OUT_WIDTH:
        ratio = OUT_WIDTH / out.width
        out = out.resize((OUT_WIDTH, max(1, round(out.height * ratio))), Image.LANCZOS)

    out.save(dst)
    out.save(dst.replace(".png", ".webp"), quality=90, method=6)
    print(f"{src} -> {dst} {out.size[0]}x{out.size[1]} kept={subject.mean() * 100:.1f}%")


SOURCES = SOURCES_ALL
for src, dst in SOURCES:
    cut(src, dst)
