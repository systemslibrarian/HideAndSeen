#!/usr/bin/env python3
"""
hide.py -- put a second message inside a working QR code.

The visible layer is an ordinary URL that any phone camera opens. The hidden
layer sits in the pad codewords after the terminator, which the spec fills with
0xEC / 0x11 and which every decoder skips. Overwrite them, recompute the
Reed-Solomon parity so the symbol is still mathematically valid, and re-render.

The result is a real QR code. Not a mock-up, not a drawing of one. It is
verified three ways at the bottom of this file:

    1. OpenCV's decoder reads the visible URL       (a normal scanner works)
    2. our extractor recovers the hidden message    (the covert layer works)
    3. detect.py flags it in one comparison         (and it is NOT secret)

Point three is the exhibit. Hiding something is not the same as making it
unfindable, and this is what the difference looks like.
"""

import segno
from segno import consts

import extract as X

PAD_A, PAD_B = 0xEC, 0x11
MAGIC = b"\x1f\x8b"          # marks a hidden payload for the cooperating decoder
ECC_CONST = {"L": consts.ERROR_LEVEL_L, "M": consts.ERROR_LEVEL_M,
             "Q": consts.ERROR_LEVEL_Q, "H": consts.ERROR_LEVEL_H}


# ---------- GF(256) Reed-Solomon, using segno's own field tables ----------

def rs_parity(data, num_ec):
    """Reed-Solomon check codewords for one block.

    segno stores generator polynomials as ALPHA EXPONENTS with the leading
    zero term dropped -- GEN_POLY[7] is (87, 229, ...), the exponent table,
    not field elements. Multiplying them as field elements silently produces
    a symbol that renders fine and decodes to nothing.
    """
    gen = consts.GEN_POLY[num_ec]
    res = [0] * num_ec
    for byte in data:
        factor = byte ^ res[0]
        res = res[1:] + [0]
        if factor:
            lf = consts.GALIOS_LOG[factor]
            for i, g in enumerate(gen):
                res[i] ^= consts.GALIOS_EXP[g + lf]
    return res


# ---------- block layout ----------

def block_spec(version, ecc):
    """(num_data, num_ec) for each block, in order."""
    out = []
    for b in consts.ECC[version][ecc]:
        for _ in range(b.num_blocks):
            out.append((b.num_data, b.num_total - b.num_data))
    return out


def interleave(data_codewords, version, ecc):
    """Split data into blocks, add parity, interleave as the spec requires."""
    specs = block_spec(version, ecc)
    blocks, pos = [], 0
    for ndata, _ in specs:
        blocks.append(data_codewords[pos:pos + ndata])
        pos += ndata

    parities = [rs_parity(blk, nec) for blk, (_, nec) in zip(blocks, specs)]

    stream = []
    for j in range(max(len(b) for b in blocks)):
        for b in blocks:
            if j < len(b):
                stream.append(b[j])
    for j in range(max(len(p) for p in parities)):
        for p in parities:
            if j < len(p):
                stream.append(p[j])
    return stream


# ---------- module writing (the inverse of extract.read_bits) ----------

def write_bits(matrix, version, mask, bits):
    """Lay bits into the data modules, applying the mask."""
    n = len(matrix)
    reserved = X.reserved_map(version, n)
    fn = X.MASK_FN[mask]
    it = iter(bits)

    col = n - 1
    upward = True
    while col > 0:
        if col == 6:
            col -= 1
        rows = range(n - 1, -1, -1) if upward else range(n)
        for row in rows:
            for c in (col, col - 1):
                if reserved[row][c]:
                    continue
                try:
                    bit = next(it)
                except StopIteration:
                    return matrix
                matrix[row][c] = bit ^ 1 if fn(row, c) else bit
        upward = not upward
        col -= 2
    return matrix


def codewords_to_bits(codewords):
    out = []
    for cw in codewords:
        out.extend((cw >> k) & 1 for k in range(7, -1, -1))
    return out


# ---------- the thing itself ----------

def capacity(overt, version=None, ecc=None):
    p = X.inspect(overt, **({"version": version} if version else {}),
                  **({"error": ecc} if ecc else {}))
    pad = p.padding
    keep = 1 if pad and pad[0] == 0x00 else 0
    return max(0, len(pad) - keep - len(MAGIC) - 1), p


def fit_version(overt, secret_len, ecc=None):
    """Smallest version whose pad codewords hold the secret.

    Capacity lives in the gap between payload and symbol capacity, so a payload
    that nearly fills its symbol carries nothing. Stepping up one version is
    usually enough, and the step is visible: the symbol gets bigger.
    """
    base = X.inspect(overt).version
    for v in range(base, min(base + 6, 41)):
        room, _ = capacity(overt, version=v, ecc=ecc)
        if room >= secret_len:
            return v, room, base
    raise ValueError("no version within +5 holds that secret")


def hide(overt, secret, version=None, ecc=None):
    """Return a matrix for a QR that reads as `overt` and carries `secret`."""
    if isinstance(secret, str):
        secret = secret.encode()

    if version is None:
        version, _, _ = fit_version(overt, len(secret), ecc)
    room, p = capacity(overt, version, ecc)
    if len(secret) > room:
        raise ValueError(f"secret is {len(secret)} bytes, only {room} fit.")

    kwargs = {"micro": False, "boost_error": False}
    if version:
        kwargs["version"] = version
    if ecc:
        kwargs["error"] = ecc
    q = segno.make(overt, **kwargs)
    matrix = [list(r) for r in q.matrix]
    ecc_const = ECC_CONST[q.error.upper()]

    data = list(p.data_codewords)
    start = len(data) - len(p.padding)
    keep = 1 if p.padding and p.padding[0] == 0x00 else 0
    slot = start + keep

    blob = MAGIC + bytes([len(secret)]) + secret
    room_total = len(data) - slot
    filler = [PAD_A if k % 2 == 0 else PAD_B for k in range(room_total - len(blob))]
    data[slot:] = list(blob) + filler

    stream = interleave(data, q.version, ecc_const)
    write_bits(matrix, q.version, q.mask, codewords_to_bits(stream))
    return matrix, q


def reveal(matrix, version, ecc):
    """The cooperating decoder: pull the hidden message back out."""
    for mask in range(8):
        try:
            bits = X.read_bits(matrix, version, mask)
            data = X.deinterleave(X.bits_to_codewords(bits), version,
                                  ECC_CONST[ecc])
            _, text, _, _, padding = X.parse(data, version)
        except Exception:
            continue
        if text and text != "<unsupported mode>":
            body = padding[1:] if padding and padding[0] == 0x00 else padding
            if len(body) > 3 and bytes(body[:2]) == MAGIC:
                length = body[2]
                return text, bytes(body[3:3 + length]).decode("utf-8", "replace")
            return text, None
    return None, None


def parsed_from_matrix(matrix, version, ecc):
    """Re-read a rendered symbol into the structure detect.py expects."""
    for mask in range(8):
        try:
            bits = X.read_bits(matrix, version, mask)
            data = X.deinterleave(X.bits_to_codewords(bits), version,
                                  ECC_CONST[ecc])
            mode, text, used, term_ok, padding = X.parse(data, version)
        except Exception:
            continue
        if text and text != "<unsupported mode>":
            return X.Parsed(version, ecc, mask, mode, text, data, used,
                            term_ok, padding)
    raise ValueError("could not re-read the symbol")


def to_png(matrix, path, scale=8, border=4):
    import png
    n = len(matrix)
    rows = []
    for _ in range(border * scale):
        rows.append([255] * ((n + 2 * border) * scale))
    for r in matrix:
        line = [255] * (border * scale)
        for v in r:
            line.extend([0 if v else 255] * scale)
        line.extend([255] * (border * scale))
        for _ in range(scale):
            rows.append(list(line))
    for _ in range(border * scale):
        rows.append([255] * ((n + 2 * border) * scale))
    png.from_array(rows, "L").save(path)


if __name__ == "__main__":
    OVERT = "https://ciphermuseum.com/exhibits/two-layer-qr"
    SECRET = "MEET AT 7"

    v, room, base = fit_version(OVERT, len(SECRET))
    print(f"visible payload : {OVERT}")
    print(f"hidden payload  : {SECRET!r}  ({len(SECRET)} bytes)")
    print(f"version         : {base} holds the URL, {v} needed for the secret "
          f"({room} pad bytes free)\n")

    matrix, q = hide(OVERT, SECRET)
    to_png(matrix, "/tmp/two_layer.png")
    print(f"symbol          : v{q.version}-{q.error} mask {q.mask}\n")

    # 1. an ordinary scanner
    import cv2
    img = cv2.imread("/tmp/two_layer.png", cv2.IMREAD_GRAYSCALE)
    seen, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    print(f"1. OpenCV (a normal phone) reads : {seen!r}")
    print(f"   matches the visible payload   : {seen == OVERT}")

    # 2. the cooperating decoder
    overt_back, hidden = reveal(matrix, q.version, q.error.upper())
    print(f"\n2. cooperating decoder reads     : {overt_back!r}")
    print(f"   and recovers hidden message   : {hidden!r}")

    # 3. the analyst -- run against the REAL forged symbol, not a simulation
    import detect
    forged = parsed_from_matrix(matrix, q.version, q.error.upper())
    report = detect.analyse(forged)
    print("\n3. the analyst:")
    for f in report.findings:
        print(f"   [{f.level:<7}] {f.check:<20} {f.detail}")
    print(f"   VERDICT: {'ANOMALOUS' if report.anomalous else 'passes'}")

    print("""
The exhibit's point is panel 3. The message is hidden from a scanner and
recovered by a decoder that knows where to look -- and it is also caught, in a
single comparison, by anyone who checks whether the pad codewords say what the
standard says they should. Hidden is not the same as unfindable.""")
