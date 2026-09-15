#!/usr/bin/env python3
"""
detect.py -- the adversary. Build this before believing anything.

Two checks, in order of how cheap they are to run:

  1. CANONICAL PADDING. The spec says pad codewords are 0xEC and 0x11,
     alternating. Both encoders tested write exactly that. So any code whose
     padding is anything else is anomalous in one comparison. This check costs
     three lines and it is the thing that decides whether a padding-based
     covert channel is viable at all.

  2. ENCODER ATTRIBUTION. Even among conforming encoders the codeword tail
     differs. segno emits an extra 0x00 codeword before the pad pattern where
     python-qrcode goes straight to 0xEC, on identical symbol parameters. Add
     the (version, ecc, mask, mode) defaults and you can often name the
     library that produced a symbol.

Check 2 is the interesting one: it means a QR code carries provenance it was
never meant to carry.
"""

from dataclasses import dataclass, field

import extract as X

PAD_A, PAD_B = 0xEC, 0x11


@dataclass
class Finding:
    level: str          # "clean" | "notice" | "anomaly"
    check: str
    detail: str


@dataclass
class Report:
    payload: str
    version: int
    ecc: str
    mask: int
    padding: list
    findings: list = field(default_factory=list)

    @property
    def anomalous(self) -> bool:
        return any(f.level == "anomaly" for f in self.findings)


def check_canonical_padding(parsed) -> Finding:
    pad = parsed.padding
    if not pad:
        return Finding("clean", "canonical-padding", "no padding codewords present")

    # tolerate a single leading zero-fill byte: legal when the data stream does
    # not end on a byte boundary, and observed from both encoders
    body = pad[1:] if pad and pad[0] == 0x00 else pad
    expected = [PAD_A if k % 2 == 0 else PAD_B for k in range(len(body))]
    if body == expected:
        return Finding("clean", "canonical-padding",
                       f"{len(body)} pad codewords, spec pattern intact")

    wrong = sum(1 for a, b in zip(body, expected) if a != b)
    return Finding("anomaly", "canonical-padding",
                   f"{wrong}/{len(body)} pad codewords deviate from 0xEC/0x11 "
                   f"-- detected in one comparison")


def check_terminator(parsed) -> Finding:
    if parsed.terminator_ok:
        return Finding("clean", "terminator", "terminator bits are zero")
    return Finding("anomaly", "terminator", "non-zero bits in the terminator")


# byte-level encoder signatures, measured 2026-09-15
SIGNATURES = {
    "segno": {"extra_zero_codeword": True},
    "python-qrcode": {"extra_zero_codeword": False},
}


def check_attribution(parsed) -> Finding:
    pad = parsed.padding
    has_zero = bool(pad) and pad[0] == 0x00
    ends_on_boundary = (parsed.header_bits + 4) % 8 == 0

    if not ends_on_boundary:
        return Finding("notice", "attribution",
                       "data does not end on a byte boundary; the leading 0x00 "
                       "is required zero-fill and carries no attribution")

    candidates = [name for name, sig in SIGNATURES.items()
                  if sig["extra_zero_codeword"] == has_zero]
    return Finding("notice", "attribution",
                   f"codeword tail consistent with: {', '.join(candidates) or 'none known'}")


def analyse(parsed) -> Report:
    r = Report(parsed.payload, parsed.version, parsed.ecc, parsed.mask, parsed.padding)
    r.findings.append(check_canonical_padding(parsed))
    r.findings.append(check_terminator(parsed))
    r.findings.append(check_attribution(parsed))
    return r


def print_report(r: Report):
    icon = {"clean": "  ok ", "notice": "note ", "anomaly": "FLAG "}
    print(f"\n{r.payload!r}  v{r.version}-{r.ecc} mask {r.mask}")
    print(f"  padding: {' '.join(f'{b:02X}' for b in r.padding) or '(none)'}")
    for f in r.findings:
        print(f"  {icon[f.level]}{f.check:<20} {f.detail}")
    print(f"  VERDICT: {'ANOMALOUS' if r.anomalous else 'passes'}")


def forge(payload: str, secret: bytes):
    """Naive covert encode: overwrite padding with ciphertext. Then get caught."""
    p = X.inspect(payload)
    forged = list(p.data_codewords)
    start = len(p.data_codewords) - len(p.padding)
    keep_zero = 1 if p.padding and p.padding[0] == 0x00 else 0
    room = len(p.padding) - keep_zero
    body = (secret + b"\x00" * room)[:room]
    forged[start + keep_zero:] = list(body)
    p.padding = forged[start:]
    return p


if __name__ == "__main__":
    print("=" * 66)
    print("BASELINE -- untouched codes from a conforming encoder")
    print("=" * 66)
    for t in ["https://example.com", "https://prayerwarriors.mobi",
              "HTTPS://EXAMPLE.COM/A", "8675309"]:
        print_report(analyse(X.inspect(t)))

    print()
    print("=" * 66)
    print("ADVERSARIAL -- padding overwritten with ciphertext")
    print("=" * 66)
    for t in ["https://example.com", "https://prayerwarriors.mobi"]:
        print_report(analyse(forge(t, b"\x9f\x3a\xd1\x07\xbb\x42\x18\xe6")))
