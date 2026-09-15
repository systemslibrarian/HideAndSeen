#!/usr/bin/env python3
"""
extract.py -- read the raw data codewords back out of a rendered QR symbol.

Nothing off the shelf does this. Every library decodes a symbol to its *text*;
we need the bytes underneath, because the whole question is what sits in the
padding codewords after the terminator.

Pipeline:
  matrix -> mark function patterns -> read data modules in zigzag order
         -> undo mask -> de-interleave blocks -> data codewords
         -> parse header, terminator, padding

Verified by round-trip: the parsed payload must equal the string we encoded.
"""

from dataclasses import dataclass, field

import segno
from segno import consts

MASK_FN = {
    0: lambda i, j: (i + j) % 2 == 0,
    1: lambda i, j: i % 2 == 0,
    2: lambda i, j: j % 3 == 0,
    3: lambda i, j: (i + j) % 3 == 0,
    4: lambda i, j: (i // 2 + j // 3) % 2 == 0,
    5: lambda i, j: (i * j) % 2 + (i * j) % 3 == 0,
    6: lambda i, j: ((i * j) % 2 + (i * j) % 3) % 2 == 0,
    7: lambda i, j: ((i + j) % 2 + (i * j) % 3) % 2 == 0,
}

MODE_NAME = {1: "numeric", 2: "alphanumeric", 4: "byte", 7: "eci", 8: "kanji"}
PAD_A, PAD_B = 0xEC, 0x11

ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"


def reserved_map(version: int, n: int):
    """True where a module is a function pattern and carries no data."""
    r = [[False] * n for _ in range(n)]

    def block(r0, c0, h, w):
        for i in range(r0, r0 + h):
            for j in range(c0, c0 + w):
                if 0 <= i < n and 0 <= j < n:
                    r[i][j] = True

    # finder patterns + separators + format information areas
    block(0, 0, 9, 9)
    block(0, n - 8, 9, 8)
    block(n - 8, 0, 8, 9)

    # timing patterns
    for k in range(n):
        r[6][k] = True
        r[k][6] = True

    # alignment patterns
    if version >= 2:
        pos = consts.ALIGNMENT_POS[version - 2]
        for a in pos:
            for b in pos:
                # skip the three that collide with finder patterns
                if (a < 9 and b < 9) or (a < 9 and b > n - 10) or (a > n - 10 and b < 9):
                    continue
                block(a - 2, b - 2, 5, 5)

    # version information blocks
    if version >= 7:
        block(n - 11, 0, 3, 6)
        block(0, n - 11, 6, 3)

    return r


def read_bits(matrix, version: int, mask: int):
    """Walk the data modules in spec order, undoing the mask as we go."""
    n = len(matrix)
    reserved = reserved_map(version, n)
    fn = MASK_FN[mask]
    bits = []

    col = n - 1
    upward = True
    while col > 0:
        if col == 6:  # vertical timing pattern column is skipped entirely
            col -= 1
        rows = range(n - 1, -1, -1) if upward else range(n)
        for row in rows:
            for c in (col, col - 1):
                if reserved[row][c]:
                    continue
                bit = matrix[row][c]
                if fn(row, c):
                    bit ^= 1
                bits.append(bit)
        upward = not upward
        col -= 2
    return bits


def bits_to_codewords(bits):
    out = []
    for i in range(0, len(bits) - 7, 8):
        b = 0
        for k in range(8):
            b = (b << 1) | bits[i + k]
        out.append(b)
    return out


def deinterleave(codewords, version: int, ecc: int):
    """Undo block interleaving; return the data codewords in logical order."""
    blocks = consts.ECC[version][ecc]
    specs = []
    for b in blocks:
        for _ in range(b.num_blocks):
            specs.append(b.num_data)

    data = [[] for _ in specs]
    pos = 0
    for j in range(max(specs)):
        for bi, ndata in enumerate(specs):
            if j < ndata:
                data[bi].append(codewords[pos])
                pos += 1
    return [cw for blk in data for cw in blk]


@dataclass
class Segment:
    mode: int
    text: str
    count: int
    start_bit: int
    end_bit: int
    eci_assignment: int | None = None


@dataclass
class Parsed:
    version: int
    ecc: str
    mask: int
    mode: int
    payload: str
    data_codewords: list
    header_bits: int
    terminator_ok: bool
    padding: list
    segments: list[Segment] = field(default_factory=list)

    @property
    def canonical_padding(self) -> bool:
        """Is the padding the spec's alternating 0xEC / 0x11?"""
        for k, b in enumerate(self.padding):
            if b != (PAD_A if k % 2 == 0 else PAD_B):
                return False
        return True


def cci_bits(mode: int, version: int) -> int:
    band = 0 if version <= 9 else (1 if version <= 26 else 2)
    return {1: (10, 12, 14), 2: (9, 11, 13), 4: (8, 16, 16)}[mode][band]


class BitReader:
    def __init__(self, bits):
        self.bits = bits
        self.position = 0

    @property
    def remaining(self):
        return len(self.bits) - self.position

    def take(self, count):
        if count < 0 or self.remaining < count:
            raise ValueError(f"requested {count} bits with {self.remaining} remaining")
        value = 0
        for bit in self.bits[self.position:self.position + count]:
            value = (value << 1) | bit
        self.position += count
        return value


def parse_eci(reader):
    first = reader.take(1)
    if first == 0:
        return reader.take(7)
    second = reader.take(1)
    if second == 0:
        return reader.take(14)
    third = reader.take(1)
    if third == 0:
        return reader.take(21)
    raise ValueError("invalid ECI assignment prefix")


def parse_segment(reader, mode: int, version: int):
    start = reader.position - 4
    if mode == 7:
        assignment = parse_eci(reader)
        return Segment(mode, "", 0, start, reader.position, assignment)

    if mode not in (1, 2, 4):
        raise ValueError(f"unsupported mode indicator {mode}")

    count = reader.take(cci_bits(mode, version))
    if mode == 4:
        raw = bytes(reader.take(8) for _ in range(count))
        payload = raw.decode("utf-8", "replace")
    elif mode == 2:
        chars = []
        full, rem = divmod(count, 2)
        for _ in range(full):
            value = reader.take(11)
            if value >= 45 * 45:
                raise ValueError("invalid alphanumeric pair")
            chars += [ALNUM[value // 45], ALNUM[value % 45]]
        if rem:
            value = reader.take(6)
            if value >= len(ALNUM):
                raise ValueError("invalid alphanumeric character")
            chars.append(ALNUM[value])
        payload = "".join(chars)
    else:
        digits = []
        full, rem = divmod(count, 3)
        for _ in range(full):
            value = reader.take(10)
            if value > 999:
                raise ValueError("invalid numeric triplet")
            digits.append(f"{value:03d}")
        if rem == 1:
            value = reader.take(4)
            if value > 9:
                raise ValueError("invalid numeric digit")
            digits.append(str(value))
        elif rem == 2:
            value = reader.take(7)
            if value > 99:
                raise ValueError("invalid numeric pair")
            digits.append(f"{value:02d}")
        payload = "".join(digits)
    return Segment(mode, payload, count, start, reader.position)


@dataclass
class ParsedStream:
    mode: int
    payload: str
    used_bits: int
    terminator_ok: bool
    padding: list
    segments: list[Segment]


def parse_stream(data_codewords, version: int) -> ParsedStream:
    bits = []
    for cw in data_codewords:
        bits.extend((cw >> k) & 1 for k in range(7, -1, -1))
    reader = BitReader(bits)
    segments = []
    terminator_ok = True
    used = 0

    while reader.remaining >= 4:
        mode = reader.take(4)
        if mode == 0:
            used = reader.position - 4
            break
        segments.append(parse_segment(reader, mode, version))
        used = reader.position
    else:
        used = reader.position

    boundary_bits = (-reader.position) % 8
    if boundary_bits:
        terminator_ok = reader.remaining >= boundary_bits and all(
            reader.take(1) == 0 for _ in range(boundary_bits)
        )

    padding = data_codewords[reader.position // 8:]
    payload = "".join(segment.text for segment in segments)
    first_mode = next((segment.mode for segment in segments if segment.mode != 7), 0)
    return ParsedStream(first_mode, payload, used, terminator_ok, padding, segments)


def parse(data_codewords, version: int):
    try:
        parsed = parse_stream(data_codewords, version)
    except ValueError:
        mode = (data_codewords[0] >> 4) if data_codewords else 0
        return mode, "<unsupported mode>", 4, False, []
    return (parsed.mode, parsed.payload, parsed.used_bits,
            parsed.terminator_ok, parsed.padding)


def inspect(payload: str, **kwargs) -> Parsed:
    kwargs.setdefault("boost_error", False)
    q = segno.make(payload, micro=False, **kwargs)
    version = q.version
    ecc = {"L": consts.ERROR_LEVEL_L, "M": consts.ERROR_LEVEL_M,
           "Q": consts.ERROR_LEVEL_Q, "H": consts.ERROR_LEVEL_H}[q.error.upper()]
    matrix = [list(row) for row in q.matrix]

    bits = read_bits(matrix, version, q.mask)
    cws = bits_to_codewords(bits)
    data = deinterleave(cws, version, ecc)
    stream = parse_stream(data, version)

    return Parsed(version, q.error.upper(), q.mask, stream.mode, stream.payload,
                  data, stream.used_bits, stream.terminator_ok, stream.padding,
                  stream.segments)


if __name__ == "__main__":
    import sys

    tests = sys.argv[1:] or [
        "https://example.com",
        "https://prayerwarriors.mobi",
        "HTTPS://EXAMPLE.COM/A",
        "8675309",
    ]
    ok = True
    for t in tests:
        p = inspect(t)
        match = p.payload == t
        ok &= match
        print(f"\npayload      {t!r}")
        print(f"  symbol     v{p.version}-{p.ecc} mask {p.mask} mode {MODE_NAME.get(p.mode)}")
        print(f"  round trip {'OK' if match else 'FAILED -> ' + repr(p.payload)}")
        print(f"  terminator {'ok' if p.terminator_ok else 'NON-ZERO'}")
        print(f"  padding    {len(p.padding)} bytes: "
              f"{' '.join(f'{b:02X}' for b in p.padding[:12])}"
              f"{' ...' if len(p.padding) > 12 else ''}")
        print(f"  canonical  {p.canonical_padding}")
    print("\nALL ROUND TRIPS OK" if ok else "\nEXTRACTOR BROKEN")
