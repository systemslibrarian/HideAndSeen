#!/usr/bin/env python3
"""
fingerprint.py -- do different QR libraries make different default choices?

The security argument for the padding channel depends on knowing what normal
looks like. "Normal" is not one distribution: it is a mixture, one component
per encoder in common use. If segno, python-qrcode, qrencode and ZXing each
default differently, then the version/ecc/mask triple is an encoder
fingerprint, and a covert code drawn from the WRONG component is detectable
even though every individual choice is legal.

This is the first probe. Two Python encoders only -- the real census needs
qrencode, ZXing, libqrencode-backed tools, and the online generators.
"""

import segno
import qrcode


def segno_probe(payload: str):
    q = segno.make(payload)
    return {
        "encoder": "segno",
        "version": q.version,
        "ecc": q.error,
        "mask": q.mask,
        "mode": q.mode,
    }


def pyqrcode_probe(payload: str):
    # python-qrcode defaults: error_correction=M, version auto, mask auto
    q = qrcode.QRCode()
    q.add_data(payload)
    q.make(fit=True)
    ecc_map = {0: "M", 1: "L", 2: "H", 3: "Q"}
    return {
        "encoder": "python-qrcode",
        "version": q.version,
        "ecc": ecc_map.get(q.error_correction, "?"),
        "mask": getattr(q, "best_mask", None),
        "mode": "auto",
    }


def compare(payload: str):
    print(f"\npayload: {payload!r}")
    print(f"{'encoder':>16} {'ver':>4} {'ecc':>4} {'mask':>5} {'mode':>14}")
    print("-" * 50)
    for probe in (segno_probe, pyqrcode_probe):
        try:
            r = probe(payload)
        except Exception as exc:  # noqa: BLE001 - probe should never abort the run
            print(f"{probe.__name__:>16}  FAILED: {exc}")
            continue
        print(f"{r['encoder']:>16} {str(r['version']):>4} {str(r['ecc']):>4} "
              f"{str(r['mask']):>5} {str(r['mode']):>14}")


if __name__ == "__main__":
    import sys

    payloads = sys.argv[1:] or [
        "https://example.com",
        "https://prayerwarriors.mobi",
        "HTTPS://EXAMPLE.COM/A",
        "8675309",
    ]
    for p in payloads:
        compare(p)
    print()
