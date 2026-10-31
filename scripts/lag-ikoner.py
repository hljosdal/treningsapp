#!/usr/bin/env python3
"""Lager enkle PNG-ikoner av en vektstang. Ingen tredjepartspakker."""

import struct
import zlib
from pathlib import Path

ROT = Path(__file__).resolve().parents[1] / "icons"
BAKGRUNN = (28, 25, 21, 255)
GULL = (240, 162, 2, 255)
LYS = (255, 224, 150, 255)


def png(path, bredde, hoyde, piksel):
    raw = bytearray()
    for y in range(hoyde):
        raw.append(0)
        for x in range(bredde):
            raw.extend(piksel(x, y))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", bredde, hoyde, 8, 6, 0, 0, 0)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(data)


def plate(x, y, venstre, topp, hoyre, bunn, radius):
    if x < venstre or x > hoyre or y < topp or y > bunn:
        return False
    dx = max(venstre + radius - x, 0, x - (hoyre - radius))
    dy = max(topp + radius - y, 0, y - (bunn - radius))
    if dx and dy:
        return dx * dx + dy * dy <= radius * radius
    return True


def ikon(storrelse, innrykk):
    """Vektstang som holder seg innenfor lerretet. Færre skiver på små ikon."""
    antall = 2 if storrelse < 64 else 3
    hoyder = (0.56, 0.42, 0.30)[:antall]

    def piksel(x, y):
        margin = storrelse * innrykk
        venstre = margin
        hoyre = storrelse - 1 - margin
        midt = (storrelse - 1) / 2
        bredde = max(storrelse * 0.05, 2)
        mellomrom = bredde * 0.28
        stigning = bredde + mellomrom
        bar_tykk = max(storrelse * 0.045, 2)
        if plate(x, y, venstre + bredde * 0.45, midt - bar_tykk / 2, hoyre - bredde * 0.45, midt + bar_tykk / 2, bar_tykk / 2):
            return LYS
        for i, andel in enumerate(hoyder):
            halv = storrelse * andel / 2
            x0 = venstre + i * stigning
            if plate(x, y, x0, midt - halv, x0 + bredde, midt + halv, bredde * 0.28):
                return GULL
            rx1 = hoyre - i * stigning
            if plate(x, y, rx1 - bredde, midt - halv, rx1, midt + halv, bredde * 0.28):
                return GULL
        return BAKGRUNN
    return piksel


def main():
    ROT.mkdir(parents=True, exist_ok=True)
    png(ROT / "icon-512.png", 512, 512, ikon(512, 0.08))
    png(ROT / "icon-maskable-512.png", 512, 512, ikon(512, 0.22))
    png(ROT / "icon-192.png", 192, 192, ikon(192, 0.08))
    png(ROT / "apple-touch-icon.png", 180, 180, ikon(180, 0.1))
    png(ROT / "favicon-32.png", 32, 32, ikon(32, 0.06))


if __name__ == "__main__":
    main()
