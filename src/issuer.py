#!/usr/bin/env python3
"""
issuer.py -- the question attribute.py did not ask.

attribute.py asked "which of these five libraries made this symbol?" and got
52.8% on unseen payloads. That kills generator identification.

It does not kill the deployable version of the question, which is binary:

    "is this symbol consistent with the profile of the issuer who is supposed
     to have produced it, or is it something else?"

A parking authority does not need to name the attacker's software. It needs to
know that this sticker was not made by its own pipeline. That is one-vs-rest,
and one-vs-rest can succeed on features that are hopeless for five-way
separation.

What matters for deployment is not accuracy, it is the two error rates:

    FALSE ACCEPT  a foreign code passes as the issuer's   -> the attack works
    FALSE REJECT  the issuer's own code gets flagged      -> the system is
                                                            unusable at scale

At 50,000 codes, a 2% false-reject rate is 1,000 alarms a day.
"""

import sys

from sklearn.ensemble import RandomForestClassifier

import attribute as A


def one_vs_rest(issuer, Xtr, ytr, Xte, yte):
    btr = [1 if y == issuer else 0 for y in ytr]
    bte = [1 if y == issuer else 0 for y in yte]
    clf = RandomForestClassifier(n_estimators=300, random_state=0).fit(Xtr, btr)
    pred = clf.predict(Xte)

    tp = sum(p == 1 and t == 1 for p, t in zip(pred, bte))
    fp = sum(p == 1 and t == 0 for p, t in zip(pred, bte))
    fn = sum(p == 0 and t == 1 for p, t in zip(pred, bte))
    tn = sum(p == 0 and t == 0 for p, t in zip(pred, bte))

    recall = tp / (tp + fn) if tp + fn else 0            # issuer codes accepted
    false_reject = fn / (tp + fn) if tp + fn else 0
    false_accept = fp / (fp + tn) if fp + tn else 0      # foreign codes accepted
    precision = tp / (tp + fp) if tp + fp else 0
    return recall, false_reject, false_accept, precision


def main():
    n_train = int(sys.argv[1]) if len(sys.argv) > 1 else 400
    n_test = int(sys.argv[2]) if len(sys.argv) > 2 else 200

    print("building...")
    Xtr, ytr, _ = A.build(A.corpus(n_train, seed=20260915))
    Xte, yte, _ = A.build(A.corpus(n_test, seed=771104))
    libs = sorted(set(ytr))

    print(f"\ntrain {len(Xtr)} / test {len(Xte)} symbols, payloads disjoint")
    print("one library treated as the issuer, the other four as the world\n")

    print(f"{'issuer':<15} {'accepted':>9} {'FALSE REJECT':>13} {'FALSE ACCEPT':>13}")
    print("-" * 56)
    rows = []
    for lib in libs:
        r, frej, facc, prec = one_vs_rest(lib, Xtr, ytr, Xte, yte)
        rows.append((lib, r, frej, facc, prec))
        print(f"{lib:<15} {100*r:8.1f}% {100*frej:12.1f}% {100*facc:12.1f}%")

    print("""
FALSE REJECT = the issuer's own codes wrongly flagged (alarm fatigue)
FALSE ACCEPT = a foreign generator's code wrongly passed (the attack succeeds)

Deployment reading
------------------""")
    for lib, r, frej, facc, prec in rows:
        if frej <= 0.02 and facc <= 0.10:
            verdict = "usable"
        elif frej <= 0.05 and facc <= 0.25:
            verdict = "marginal"
        else:
            verdict = "not usable"
        print(f"  {lib:<15} {verdict}")

    print("""
Hard caveat that must travel with any number above: "the world" here is FOUR
libraries. A real deployment faces hundreds of generators, including online
services whose configurations we have never sampled. Every false-accept rate
printed here is a LOWER BOUND on the real one -- more generators in the world
can only make it easier for one of them to land inside the issuer's profile.

And none of this is authentication. An attacker who identifies the issuer's
toolchain reproduces the profile exactly and the false-accept rate goes to 100%
for that attacker. The honest framing is a detection signal against adversaries
who did not bother, in the same family as a spam heuristic.
""")


if __name__ == "__main__":
    main()
