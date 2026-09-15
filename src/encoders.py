#!/usr/bin/env python3
"""
encoders.py -- one interface over five independent QR implementations.

Each adapter returns the module matrix plus whatever the library declares, at
that library's OWN default settings. Defaults are the point: a fingerprint that
only shows up under forced configuration is not a fingerprint of anything.

Where a library has no default (qrcodegen requires an explicit ECC level) the
choice made here is recorded in NOTES rather than hidden.

  segno           Python   micro=auto, boost_error=on
  python-qrcode   Python   ECC M, no micro
  qrcodegen       Python   Nayuki reference; ECC must be given -> MEDIUM
  node-qrcode     JS       ECC M default
  qrencode        C        libqrencode 4.1.1 CLI, ECC L default
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

NOTES = {
    "qrcodegen": "no library default; MEDIUM requested. NOTE: it boosts -- asked M, returned Q",
    "qrencode": "CLI default is -l L; invoked with -s 1 -m 0 for a raw matrix",
}

PROJECT_ROOT = Path(__file__).resolve().parents[1]
NODE_DIR = os.environ.get("NODE_QRCODE_DIR", str(PROJECT_ROOT))
QRENCODE = os.environ.get("QRENCODE", shutil.which("qrencode") or "qrencode")


def enc_segno(payload):
    import segno
    q = segno.make(payload)
    return {"lib": "segno", "matrix": [list(r) for r in q.matrix],
            "version": str(q.version), "ecc": str(q.error).upper(),
            "mask": q.mask, "micro": q.is_micro}


def enc_pyqrcode(payload):
    import qrcode
    q = qrcode.QRCode()
    q.add_data(payload)
    q.make(fit=True)
    return {"lib": "python-qrcode",
            "matrix": [[1 if c else 0 for c in row] for row in q.modules],
            "version": str(q.version), "ecc": "M", "mask": None, "micro": False}


def enc_qrcodegen(payload):
    from qrcodegen import QrCode
    qr = QrCode.encode_text(payload, QrCode.Ecc.MEDIUM)
    n = qr.get_size()
    return {"lib": "qrcodegen",
            "matrix": [[1 if qr.get_module(x, y) else 0 for x in range(n)]
                       for y in range(n)],
            "version": str(qr.get_version()),
            "ecc": "LMQH"[qr.get_error_correction_level().ordinal],
            "mask": qr.get_mask(), "micro": False}


def enc_qrencode(payload):
    import png
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as fh:
        path = fh.name
    try:
        environment = os.environ.copy()
        subprocess.run([QRENCODE, "-s", "1", "-m", "0", "-o", path, payload],
                       check=True, capture_output=True, env=environment)
        w, h, rows, _ = png.Reader(filename=path).read()
        matrix = []
        for row in rows:
            vals = list(row)
            stride = max(1, len(vals) // w)
            matrix.append([0 if vals[i * stride] else 1 for i in range(w)])
    finally:
        os.unlink(path)
    return {"lib": "qrencode", "matrix": matrix, "version": None,
            "ecc": "L", "mask": None, "micro": False}


def enc_node_batch(payloads):
    """node-qrcode, all payloads in one process call."""
    script = """
const q = require('qrcode');
const out = process.argv.slice(1).map(function (p) {
  try {
    const c = q.create(p);
    const ecc = {0:'M',1:'L',2:'H',3:'Q'}[c.errorCorrectionLevel.bit];
    return {lib:'node-qrcode', payload:p, version:c.version, ecc:ecc,
            mask:c.maskPattern, micro:false, size:c.modules.size,
            data:Array.from(c.modules.data)};
  } catch (e) { return {lib:'node-qrcode', payload:p, error:String(e)}; }
});
process.stdout.write(JSON.stringify(out));
"""
    res = subprocess.run(["node", "-e", script, "--"] + payloads,
                         cwd=NODE_DIR, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr[:400])
    out = {}
    for r in json.loads(res.stdout):
        if "error" in r:
            continue
        n = r["size"]
        r["matrix"] = [r["data"][i * n:(i + 1) * n] for i in range(n)]
        del r["data"]
        out[r["payload"]] = r
    return out


PY_ENCODERS = [enc_segno, enc_pyqrcode, enc_qrcodegen, enc_qrencode]


if __name__ == "__main__":
    p = "https://example.com"
    for fn in PY_ENCODERS:
        r = fn(p)
        print(f"{r['lib']:<15} v{r['version']}-{r['ecc']} mask={r['mask']} "
              f"size={len(r['matrix'])}")
    r = enc_node_batch([p])[p]
    print(f"{r['lib']:<15} v{r['version']}-{r['ecc']} mask={r['mask']} "
          f"size={len(r['matrix'])}")
