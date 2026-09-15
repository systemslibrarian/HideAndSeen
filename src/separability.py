#!/usr/bin/env python3
"""
separability.py -- bits, not adjectives.

Earlier runs showed segno and python-qrcode disagreeing on hand-picked
payloads. That proves divergence exists; it says nothing about how often, or
how reliably a single symbol identifies its generator.

This measures it. For a corpus of payloads, take each library's DEFAULT output
-- the settings a normal caller actually gets, boosting and Micro-QR included --
and ask: from the symbol's observable features alone, can you name the library?

Features are all recoverable by a scanner with no prior knowledge:
    symbol type   standard QR vs Micro QR
    version       grid size
    ecc           error-correction level (in format info)
    mask          mask pattern (in format info)
    mode          segmentation choice (first mode indicator)
    pad tail      first pad codeword is 0x00 vs 0xEC

Reported: agreement rate, per-feature discriminating power, and the fraction
of payloads where the feature vector is unique to one library.
"""

import string
import random
from collections import Counter, defaultdict

import qrcode
import segno
from segno import consts

import extract as X

ECC_CONST = {"L": consts.ERROR_LEVEL_L, "M": consts.ERROR_LEVEL_M,
             "Q": consts.ERROR_LEVEL_Q, "H": consts.ERROR_LEVEL_H}
MODE_NAME = {1: "num", 2: "alnum", 4: "byte", 8: "kanji"}


def corpus(n=120, seed=20260915):
    rng = random.Random(seed)
    out = []
    tlds = ["com", "org", "net", "mobi", "io", "gov"]
    words = ["shop", "menu", "pay", "invoice", "track", "order", "ticket",
             "verify", "account", "parking", "utility", "library", "catalog"]
    for _ in range(n // 3):                      # URLs, mixed length
        host = rng.choice(words) + rng.choice(["", "-" + rng.choice(words)])
        path = "/".join(rng.choice(words) for _ in range(rng.randint(0, 2)))
        out.append(f"https://{host}.{rng.choice(tlds)}" + (f"/{path}" if path else ""))
    for _ in range(n // 3):                      # numeric payloads
        out.append("".join(rng.choice(string.digits)
                           for _ in range(rng.randint(4, 24))))
    for _ in range(n - 2 * (n // 3)):            # uppercase alphanumeric
        out.append("".join(rng.choice(string.ascii_uppercase + string.digits)
                           for _ in range(rng.randint(6, 28))))
    return out


def features_segno(payload):
    """segno at its defaults: micro allowed, boost_error on."""
    q = segno.make(payload)
    f = {"lib": "segno", "micro": q.is_micro, "version": str(q.version),
         "ecc": str(q.error), "mask": q.mask, "mode": q.mode, "pad0": None}
    if not q.is_micro:
        try:
            p = X.inspect(payload, version=q.version, error=q.error)
            f["pad0"] = bool(p.padding and p.padding[0] == 0x00)
        except Exception:
            pass
    return f


def features_pyqrcode(payload):
    """python-qrcode at its defaults: no micro, ECC level M, auto version."""
    q = qrcode.QRCode()
    q.add_data(payload)
    q.make(fit=True)
    matrix = [[1 if c else 0 for c in row] for row in q.modules]
    mask, mode, pad0 = None, None, None
    for mk in range(8):
        try:
            bits = X.read_bits(matrix, q.version, mk)
            data = X.deinterleave(X.bits_to_codewords(bits), q.version,
                                  ECC_CONST["M"])
            m, text, _, _, padding = X.parse(data, q.version)
        except Exception:
            continue
        if text == payload:
            mask, mode = mk, MODE_NAME.get(m)
            pad0 = bool(padding and padding[0] == 0x00)
            break
    return {"lib": "python-qrcode", "micro": False, "version": str(q.version),
            "ecc": "M", "mask": mask, "mode": mode, "pad0": pad0}


FEATURES = ["micro", "version", "ecc", "mask", "mode", "pad0"]


def vector(f):
    return tuple(f[k] for k in FEATURES)


def main():
    payloads = corpus()
    per_feature = Counter()
    identical = 0
    usable = 0
    vectors = defaultdict(set)

    for p in payloads:
        try:
            a, b = features_segno(p), features_pyqrcode(p)
        except Exception:
            continue
        usable += 1
        for k in FEATURES:
            if a[k] != b[k]:
                per_feature[k] += 1
        va, vb = vector(a), vector(b)
        if va == vb:
            identical += 1
        vectors[va].add("segno")
        vectors[vb].add("python-qrcode")

    print(f"corpus: {usable} payloads, two libraries at their DEFAULT settings\n")

    print("how often each feature alone separates the two libraries")
    print("-" * 58)
    for k in FEATURES:
        n = per_feature[k]
        bar = "#" * int(40 * n / usable)
        print(f"  {k:<9} {n:>4}/{usable}  {100*n/usable:5.1f}%  {bar}")

    print("\nwhole feature vector")
    print("-" * 58)
    distinguishable = usable - identical
    print(f"  distinguishable       {distinguishable}/{usable}  "
          f"({100*distinguishable/usable:.1f}%)")
    print(f"  indistinguishable     {identical}/{usable}  "
          f"({100*identical/usable:.1f}%)")

    ambiguous = sum(1 for v, libs in vectors.items() if len(libs) > 1)
    print(f"  feature vectors seen  {len(vectors)}")
    print(f"  vectors claimed by both libraries: {ambiguous}")

    print("""
Reading
-------
A high per-payload separation rate means one symbol is usually enough to name
its generator. The ambiguous-vector count is the honest ceiling: those are the
symbols no amount of corpus work will attribute, because both libraries really
do produce the same thing for them.

Caveat that has to stay attached to this number: TWO libraries is a toy. Real
attribution needs qrencode, ZXing, the iOS and Android system generators, and
the large online services. Two-library separability is an upper bound on how
easy this looks, not an estimate of how hard it gets.
""")


if __name__ == "__main__":
    main()
