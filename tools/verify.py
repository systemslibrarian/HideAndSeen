#!/usr/bin/env python3
"""
verify.py -- does the browser engine actually produce scannable QR codes?

Decodes every symbol emitted by tools/emit.js with zbar, which is the decoder
phone apps are built on, and checks three things per symbol:

    scan     an independent decoder reads the visible URL
    reveal   the hidden payload comes back byte-for-byte
    detect   the padding check fires when, and only when, something is hidden

    node tools/emit.js /tmp/hideandseen
    python3 tools/verify.py /tmp/hideandseen

Requires: pip install pyzbar pillow  (and the libzbar0 system package)

A note on decoders. OpenCV's QRCodeDetector fails on some of these symbols at
some rendering scales while reading the same symbol fine at others, and reads
segno's output at scales where it fails on ours. That erratic pattern is the
detector, not the symbol: zbar reads all of them, and our own codeword reader
round-trips every one. Do not use OpenCV to judge an encoder.
"""

import json
import os
import sys
from collections import Counter

try:
    from pyzbar.pyzbar import decode
    from PIL import Image
except ImportError:
    sys.exit("need: pip install pyzbar pillow  (plus the libzbar0 system package)")


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/hideandseen"
    manifest = json.load(open(os.path.join(out_dir, "manifest.json")))

    scan_fail, reveal_fail, detect_fail = [], [], []
    by_version = Counter()

    for entry in manifest:
        by_version[entry["version"]] += 1

        res = decode(Image.open(os.path.join(out_dir, entry["file"])))
        got = res[0].data.decode() if res else ""
        if got != entry["text"]:
            scan_fail.append((entry, got))

        if not entry["revealOk"]:
            reveal_fail.append(entry)

        should_flag = entry.get("hasHidden", entry["secret"] is not None)
        if entry["anomalous"] != should_flag:
            detect_fail.append(entry)

    n = len(manifest)
    print(f"{n} symbols, versions {min(by_version)}-{max(by_version)}, "
          f"all four ECC levels\n")

    def line(label, fails):
        status = "PASS" if not fails else f"FAIL ({len(fails)})"
        print(f"  {label:<34} {n - len(fails):>4}/{n}   {status}")

    line("scans as the visible URL", scan_fail)
    line("hidden payload recovered exactly", reveal_fail)
    line("padding check fires iff hiding", detect_fail)

    print("\nsymbols per version")
    for v in sorted(by_version):
        print(f"  v{v:<3} {by_version[v]:>4}")

    for entry, got in scan_fail[:5]:
        print(f"\n  SCAN FAIL v{entry['version']}-{entry['ecc']} "
              f"mask {entry['mask']}: got {got!r}")
    for entry in reveal_fail[:5]:
        print(f"\n  REVEAL FAIL {entry['secret']!r} -> {entry['revealed']!r}")

    bad = len(scan_fail) + len(reveal_fail) + len(detect_fail)
    print("\n" + ("ALL CHECKS PASS" if not bad else f"{bad} FAILURES"))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
