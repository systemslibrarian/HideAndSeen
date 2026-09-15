#!/usr/bin/env python3
"""
attribute.py -- can a single QR symbol name the software that made it?

Five independent implementations, each at its own defaults. For every payload,
every encoder produces a symbol; features are read back from the SYMBOL ONLY,
the way an analyst with no prior knowledge would, then a classifier is trained
to predict the library.

The methodological point that makes or breaks this: the test payloads are
NEVER seen during training. Otherwise the classifier can learn properties of
the strings instead of properties of the encoder, and the accuracy is a lie.

Features, all scanner-recoverable:
    micro       Micro QR symbol rather than standard
    version     from the module count
    ecc         recovered by trying each level until the payload parses
    mask        recovered by trying each pattern until the payload parses
    mode        first data mode indicator
    segments    number of data segments
    numseg      numeric segment count
    alnumseg    alphanumeric segment count
    byteseg     byte segment count
    pad0        first pad codeword is 0x00 rather than 0xEC
    padlen      number of pad codewords
"""

import random
import string
import sys
from collections import Counter, defaultdict

from segno import consts
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier, export_text

import encoders as E
import extract as X

ECC_TRY = [("L", consts.ERROR_LEVEL_L), ("M", consts.ERROR_LEVEL_M),
           ("Q", consts.ERROR_LEVEL_Q), ("H", consts.ERROR_LEVEL_H)]
MODE_NAME = {1: "num", 2: "alnum", 4: "byte", 8: "kanji"}
FEATURES = ["micro", "version", "ecc", "mask", "mode", "segments",
            "numseg", "alnumseg", "byteseg", "pad0", "padlen"]


def corpus(n, seed):
    rng = random.Random(seed)
    out = []
    tlds = ["com", "org", "net", "mobi", "io", "gov", "co.uk"]
    words = ["shop", "menu", "pay", "invoice", "track", "order", "ticket",
             "verify", "account", "parking", "utility", "library", "catalog",
             "renew", "hold", "branch", "event", "donate"]
    per = n // 4
    for _ in range(per):
        host = rng.choice(words) + rng.choice(["", "-" + rng.choice(words)])
        path = "/".join(rng.choice(words) for _ in range(rng.randint(0, 3)))
        out.append(f"https://{host}.{rng.choice(tlds)}" + (f"/{path}" if path else ""))
    for _ in range(per):
        out.append("".join(rng.choice(string.digits) for _ in range(rng.randint(4, 30))))
    for _ in range(per):
        out.append("".join(rng.choice(string.ascii_uppercase + string.digits)
                           for _ in range(rng.randint(6, 34))))
    for _ in range(n - 3 * per):                      # mixed case forces byte mode
        out.append("".join(rng.choice(string.ascii_letters + " .,")
                           for _ in range(rng.randint(8, 40))))
    return out


def read_symbol(matrix, payload):
    """Recover encoding parameters from the symbol alone, as an analyst would."""
    n = len(matrix)
    if n < 21 or (n - 17) % 4:
        return {"micro": 1, "version": -1, "ecc": -1, "mask": -1,
                "mode": -1, "segments": -1, "numseg": -1,
                "alnumseg": -1, "byteseg": -1, "pad0": -1, "padlen": -1}
    version = (n - 17) // 4
    for mask in range(8):
        for ecc_name, ecc in ECC_TRY:
            try:
                bits = X.read_bits(matrix, version, mask)
                data = X.deinterleave(X.bits_to_codewords(bits), version, ecc)
                parsed = X.parse_stream(data, version)
            except Exception:
                continue
            if parsed.payload == payload:
                modes = [segment.mode for segment in parsed.segments
                         if segment.mode in (1, 2, 4)]
                return {"micro": 0, "version": version,
                        "ecc": "LMQH".index(ecc_name), "mask": mask,
                        "mode": parsed.mode, "segments": len(modes),
                        "numseg": modes.count(1), "alnumseg": modes.count(2),
                        "byteseg": modes.count(4),
                        "pad0": 1 if (parsed.padding and parsed.padding[0] == 0x00) else 0,
                        "padlen": len(parsed.padding)}
    return None


def build(payloads):
    rows, labels, misses = [], [], Counter()
    node = E.enc_node_batch(payloads)
    for p in payloads:
        results = []
        for fn in E.PY_ENCODERS:
            try:
                results.append(fn(p))
            except Exception:
                misses[fn.__name__] += 1
        if p in node:
            results.append(node[p])
        for r in results:
            f = read_symbol(r["matrix"], p)
            if f is None:
                misses[r["lib"]] += 1
                continue
            rows.append([f[k] for k in FEATURES])
            labels.append(r["lib"])
    return rows, labels, misses


def main():
    n_train = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    n_test = int(sys.argv[2]) if len(sys.argv) > 2 else 150

    print("building training set...")
    Xtr, ytr, m1 = build(corpus(n_train, seed=20260915))
    print("building test set on payloads never used in training...")
    Xte, yte, m2 = build(corpus(n_test, seed=771104))

    libs = sorted(set(ytr))
    print(f"\n{len(libs)} encoders: {', '.join(libs)}")
    print(f"train {len(Xtr)} symbols / test {len(Xte)} symbols")
    if m1 or m2:
        print(f"unreadable symbols skipped: {dict(m1 + m2)}")
    baseline = 100.0 / len(libs)

    clf = RandomForestClassifier(n_estimators=200, random_state=0).fit(Xtr, ytr)
    pred = clf.predict(Xte)
    acc = sum(a == b for a, b in zip(pred, yte)) / len(yte)

    print(f"\nACCURACY ON UNSEEN PAYLOADS: {100*acc:.1f}%"
          f"   (chance = {baseline:.1f}%)")

    print("\nper encoder")
    print("-" * 52)
    right, total = Counter(), Counter()
    confusion = defaultdict(Counter)
    for a, b in zip(pred, yte):
        total[b] += 1
        confusion[b][a] += 1
        if a == b:
            right[b] += 1
    for lib in libs:
        pct = 100 * right[lib] / total[lib] if total[lib] else 0
        worst = [f"{k} {v}" for k, v in confusion[lib].most_common()
                 if k != lib][:2]
        print(f"  {lib:<15} {pct:5.1f}%   "
              f"{'confused with ' + ', '.join(worst) if worst else ''}")

    print("\nfeature importance")
    print("-" * 52)
    for name, imp in sorted(zip(FEATURES, clf.feature_importances_),
                            key=lambda t: -t[1]):
        print(f"  {name:<9} {imp:.3f}  {'#' * int(50 * imp)}")

    print("\nsingle-feature accuracy (is one feature carrying everything?)")
    print("-" * 52)
    for i, name in enumerate(FEATURES):
        s = DecisionTreeClassifier(random_state=0).fit(
            [[r[i]] for r in Xtr], ytr)
        a = sum(p == t for p, t in zip(s.predict([[r[i]] for r in Xte]), yte))
        print(f"  {name:<9} {100*a/len(yte):5.1f}%")

    print("\nhow the tree actually decides (depth 3)")
    print("-" * 52)
    small = DecisionTreeClassifier(max_depth=3, random_state=0).fit(Xtr, ytr)
    print(export_text(small, feature_names=FEATURES))


if __name__ == "__main__":
    main()
