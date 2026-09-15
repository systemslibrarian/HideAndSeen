# src

Run order matters — each tool depends on the one before it.

| file | what it does | depends on |
|---|---|---|
| `census.py` | counts covert capacity per channel for a payload, with leak classification | segno |
| `fingerprint.py` | probes encoder default choices (version/ecc/mask/mode) | segno, qrcode |
| `extract.py` | **the foundation** — recovers raw data codewords from a rendered symbol | segno |
| `detect.py` | the adversary: canonical-padding check, terminator check, encoder attribution | extract.py |

```bash
pip install segno qrcode
python3 src/census.py
python3 src/fingerprint.py
python3 src/extract.py        # must print ALL ROUND TRIPS OK
cd src && python3 detect.py
```

`extract.py` must pass before anything downstream is trustworthy. If a round
trip fails, every number `detect.py` prints is meaningless.
