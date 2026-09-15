#!/usr/bin/env python3
"""
census.py -- how many bits of slack does one QR code actually have?

For a given payload string, enumerate the encoder choices that produce a
DIFFERENT symbol but the SAME decoded text, and count the bits each choice
can carry.

Channels measured:
  padding   free data codewords after the terminator (spec says fill with
            alternating 0xEC/0x11; every decoder stops at the terminator)
  mask      3 bits -- 8 mask patterns
  ecc       2 bits -- L/M/Q/H, where more than one level fits the payload
  version   log2(number of versions that fit), capped by a size budget
  segment   mode-split choices for payloads with mixed character classes

Channels are reported separately because they are NOT equally safe. Padding
is unconstrained by the spec. Mask is recommended (penalty minimisation), so
a deviation is recomputable by an analyst. Version and ECC are visible in the
symbol's size and format info.
"""

import math
from dataclasses import dataclass, field

from segno import consts

# segno's internal encoding for error levels
L, M, Q, H = (
    consts.ERROR_LEVEL_L,
    consts.ERROR_LEVEL_M,
    consts.ERROR_LEVEL_Q,
    consts.ERROR_LEVEL_H,
)
ECC_NAME = {L: "L", M: "M", Q: "Q", H: "H"}
ECC_ORDER = [L, M, Q, H]

MODE_NUMERIC, MODE_ALNUM, MODE_BYTE = 1, 2, 4
MODE_NAME = {MODE_NUMERIC: "numeric", MODE_ALNUM: "alphanumeric", MODE_BYTE: "byte"}

ALNUM_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"

# character-count indicator width, by mode and version band
CCI = {
    MODE_NUMERIC: (10, 12, 14),
    MODE_ALNUM: (9, 11, 13),
    MODE_BYTE: (8, 16, 16),
}


def cci_bits(mode: int, version: int) -> int:
    band = 0 if version <= 9 else (1 if version <= 26 else 2)
    return CCI[mode][band]


def data_bits(mode: int, payload: str) -> int:
    """Bits of actual data, excluding mode indicator and count indicator."""
    n = len(payload)
    if mode == MODE_NUMERIC:
        full, rem = divmod(n, 3)
        return full * 10 + {0: 0, 1: 4, 2: 7}[rem]
    if mode == MODE_ALNUM:
        full, rem = divmod(n, 2)
        return full * 11 + (6 if rem else 0)
    return len(payload.encode("utf-8")) * 8


def usable_modes(payload: str):
    """Every mode that can legally represent this payload, cheapest first."""
    modes = []
    if payload.isdigit():
        modes.append(MODE_NUMERIC)
    if all(c in ALNUM_CHARSET for c in payload):
        modes.append(MODE_ALNUM)
    modes.append(MODE_BYTE)
    return modes


def capacity_bits(version: int, ecc: int) -> int:
    return consts.SYMBOL_CAPACITY[version][ecc]


@dataclass
class Fit:
    version: int
    ecc: int
    mode: int
    used_bits: int
    capacity_bits: int
    free_pad_bytes: int = field(init=False)

    def __post_init__(self):
        # terminator (<=4 bits) then pad to a byte boundary, then free codewords
        after_terminator = min(self.used_bits + 4, self.capacity_bits)
        padded = math.ceil(after_terminator / 8) * 8
        self.free_pad_bytes = max(0, (self.capacity_bits - padded) // 8)

    @property
    def pad_bits(self) -> int:
        return self.free_pad_bytes * 8


def fits(payload: str, version: int, ecc: int, mode: int):
    used = 4 + cci_bits(mode, version) + data_bits(mode, payload)
    cap = capacity_bits(version, ecc)
    if used + 4 > cap and used > cap:
        return None
    if used > cap:
        return None
    return Fit(version, ecc, mode, used, cap)


def census(payload: str, max_version: int = 10):
    """All (version, ecc, mode) triples that encode this payload."""
    out = []
    for mode in usable_modes(payload):
        for ecc in ECC_ORDER:
            for version in range(1, max_version + 1):
                f = fits(payload, version, ecc, mode)
                if f:
                    out.append(f)
    return out


def minimal_fit(payload: str):
    """What a normal encoder would produce: smallest version, cheapest mode."""
    modes = usable_modes(payload)
    for version in range(1, 41):
        for mode in modes:
            f = fits(payload, version, M, mode)
            if f:
                return f
    return None


def report(payload: str, size_budget: int = None):
    base = minimal_fit(payload)
    budget = size_budget or base.version + 2

    print(f"payload   {payload!r}  ({len(payload)} chars)")
    print(f"baseline  version {base.version}-M, {MODE_NAME[base.mode]} mode, "
          f"{base.free_pad_bytes} free padding bytes")
    print(f"budget    versions {base.version}..{budget} "
          f"(a larger symbol is visually obvious)\n")

    rows = [f for f in census(payload, max_version=budget) if f.version >= base.version]

    print(f"{'ver':>4} {'ecc':>4} {'mode':>13} {'pad bytes':>10} {'pad bits':>9}")
    print("-" * 46)
    for f in sorted(rows, key=lambda r: (r.version, ECC_ORDER.index(r.ecc))):
        print(f"{f.version:>4} {ECC_NAME[f.ecc]:>4} {MODE_NAME[f.mode]:>13} "
              f"{f.free_pad_bytes:>10} {f.pad_bits:>9}")

    # ---- channel accounting, at the baseline symbol ----
    same_symbol = [f for f in rows if f.version == base.version]
    ecc_choices = len({f.ecc for f in same_symbol})
    mode_choices = len({f.mode for f in same_symbol})
    version_choices = len({f.version for f in rows})

    print("\nchannel accounting")
    print("-" * 46)
    print(f"  padding   {base.pad_bits:>4} bits   (clean: spec-unconstrained)")
    print(f"  mask      {3:>4} bits   (leaky: penalty score is recomputable)")
    print(f"  ecc       {math.floor(math.log2(ecc_choices)) if ecc_choices else 0:>4} bits"
          f"   (leaky: visible in format info) [{ecc_choices} levels fit]")
    print(f"  version   {math.floor(math.log2(version_choices)) if version_choices else 0:>4} bits"
          f"   (leaky: symbol size) [{version_choices} versions in budget]")
    print(f"  segment   {math.floor(math.log2(mode_choices)) if mode_choices else 0:>4} bits"
          f"   (semi-clean: re-encode diff) [{mode_choices} modes fit]")
    print("-" * 46)
    print(f"  CLEAN ONLY          {base.pad_bits:>4} bits  "
          f"= {base.pad_bits // 8} bytes")
    total = base.pad_bits + 3 + math.floor(math.log2(max(ecc_choices, 1))) \
        + math.floor(math.log2(max(version_choices, 1))) \
        + math.floor(math.log2(max(mode_choices, 1)))
    print(f"  ALL CHANNELS        {total:>4} bits  = {total // 8} bytes")
    print()


if __name__ == "__main__":
    import sys

    payloads = sys.argv[1:] or [
        "https://example.com",
        "https://prayerwarriors.mobi",
        "HTTPS://EXAMPLE.COM/A",
        "8675309",
        "https://ciphermuseum.com/exhibit/one-time-pad",
    ]
    for p in payloads:
        report(p)
