#!/usr/bin/env python3
"""
regen_attack.py -- the published adversary, reimplemented and stress-tested.

Chen, Chen, Wang, Yan & Li, "A General Steganalysis Method of QR Codes",
ICDF2C 2022, Springer LNICST 508, pp. 472-483 (2023). Method: code
regeneration, module comparison, embedded information filtering. Claimed to
"perfectly distinguish the stego code" for spatial QR steganography schemes.

Two things we want to know and cannot get from a paywalled abstract:

  1. Does regeneration-and-compare catch a PADDING payload?      (expect: yes)
  2. Does it produce FALSE POSITIVES on innocent codes made by a
     different encoder than the analyst's?                        (expect: yes)

(2) is the interesting one. Regeneration needs a reference encoder. The paper's
framing treats the regenerated code as "the pure QR code" -- singular. Our
fingerprint measurements say there is no such thing: conforming encoders
produce different codeword streams for identical symbol parameters. If so, the
method's accuracy is conditional on the analyst happening to use the same
library as the issuer, which is not a property the abstract acknowledges.

Comparison is at codeword level rather than module level. Modules are a
deterministic function of codewords plus mask, and we hold mask fixed, so a
codeword difference is exactly a module difference.
"""

import sys

import qrcode
import segno
from segno import consts

import extract as X

ECC_CONST = {"L": consts.ERROR_LEVEL_L, "M": consts.ERROR_LEVEL_M,
             "Q": consts.ERROR_LEVEL_Q, "H": consts.ERROR_LEVEL_H}
QR_ECC = {"L": qrcode.constants.ERROR_CORRECT_L, "M": qrcode.constants.ERROR_CORRECT_M,
          "Q": qrcode.constants.ERROR_CORRECT_Q, "H": qrcode.constants.ERROR_CORRECT_H}


def codewords_segno(payload, version, ecc):
    q = segno.make(payload, micro=False, version=version, error=ecc, boost_error=False)
    matrix = [list(r) for r in q.matrix]
    bits = X.read_bits(matrix, q.version, q.mask)
    return X.deinterleave(X.bits_to_codewords(bits), q.version, ECC_CONST[ecc]), q.mask


def codewords_pyqrcode(payload, version, ecc):
    q = qrcode.QRCode(version=version, error_correction=QR_ECC[ecc])
    q.add_data(payload)
    q.make(fit=False)
    matrix = [[1 if c else 0 for c in row] for row in q.modules]
    for mk in range(8):
        try:
            bits = X.read_bits(matrix, q.version, mk)
            data = X.deinterleave(X.bits_to_codewords(bits), q.version, ECC_CONST[ecc])
            _, text, _, _, _ = X.parse(data, q.version)
        except Exception:
            continue
        if text == payload:
            return data, mk
    return None, None


def compare(label, a, b):
    if a is None or b is None:
        print(f"  {label}: could not regenerate")
        return None
    diffs = [i for i, (x, y) in enumerate(zip(a, b)) if x != y]
    extra = abs(len(a) - len(b))
    verdict = "STEGO DETECTED" if (diffs or extra) else "clean"
    print(f"  {label}: {len(diffs)} differing codewords"
          f"{f' (+{extra} length mismatch)' if extra else ''} -> {verdict}")
    if diffs:
        i = diffs[0]
        print(f"      first difference at codeword {i}: "
              f"{a[i]:02X} vs {b[i]:02X}")
    return bool(diffs or extra)


def run(payload, version=2, ecc="L"):
    print(f"\npayload {payload!r}  (forced v{version}-{ecc})")

    issuer_segno, mask_s = codewords_segno(payload, version, ecc)
    analyst_pyqr, mask_p = codewords_pyqrcode(payload, version, ecc)

    print(f"  issuer  = segno         (mask {mask_s})")
    print(f"  analyst = python-qrcode (mask {mask_p})")

    print("\n  TEST 1 -- innocent code, analyst regenerates with a different library")
    fp = compare("innocent vs regenerated", issuer_segno, analyst_pyqr)

    print("\n  TEST 2 -- innocent code, analyst regenerates with the SAME library")
    same, _ = codewords_segno(payload, version, ecc)
    compare("innocent vs regenerated", issuer_segno, same)

    print("\n  TEST 3 -- padding payload, analyst regenerates with the same library")
    stego = list(issuer_segno)
    p = X.inspect(payload, version=version, error=ecc)
    start = len(stego) - len(p.padding)
    keep = 1 if p.padding and p.padding[0] == 0x00 else 0
    room = len(p.padding) - keep
    secret = (b"\x9f\x3a\xd1\x07\xbb\x42\x18\xe6" * 4)[:room]
    stego[start + keep:] = list(secret)
    compare("stego vs regenerated", stego, same)

    return fp


if __name__ == "__main__":
    cases = [("https://prayerwarriors.mobi", 2, "L"),
             ("https://example.com", 2, "L"),
             ("https://ciphermuseum.com", 3, "M")]
    if len(sys.argv) > 1:
        cases = [(sys.argv[1], int(sys.argv[2]), sys.argv[3])]

    false_positives = 0
    for payload, v, e in cases:
        if run(payload, v, e):
            false_positives += 1

    print("\n" + "=" * 68)
    print(f"FALSE POSITIVES ON INNOCENT CODES: {false_positives}/{len(cases)}")
    print("=" * 68)
    print("""
Reading: regeneration-and-compare detects a padding payload, confirming the
padding channel is closed by published work. But the same mechanism flags
innocent codes whenever the analyst's reference encoder differs from the
issuer's -- because there is no single "pure QR code" for a given payload and
symbol configuration. The method's accuracy is conditional on an encoder
assumption its abstract does not state.

This is not a refutation of the paper -- we do not have its full text, and it
may address encoder variance in a section we cannot read. It is a question the
full text has to answer, and it is the first thing to check on obtaining it.
""")
