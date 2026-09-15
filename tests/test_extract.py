import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import qrcode
from qrcode.util import MODE_8BIT_BYTE, MODE_ALPHA_NUM, MODE_NUMBER, QRData
from segno import consts

import extract
import attribute


ECC = {
    "L": consts.ERROR_LEVEL_L,
    "M": consts.ERROR_LEVEL_M,
    "Q": consts.ERROR_LEVEL_Q,
    "H": consts.ERROR_LEVEL_H,
}


def explicit_symbol(parts, ecc="M"):
    levels = {
        "L": qrcode.constants.ERROR_CORRECT_L,
        "M": qrcode.constants.ERROR_CORRECT_M,
        "Q": qrcode.constants.ERROR_CORRECT_Q,
        "H": qrcode.constants.ERROR_CORRECT_H,
    }
    modes = {
        "numeric": MODE_NUMBER,
        "alphanumeric": MODE_ALPHA_NUM,
        "byte": MODE_8BIT_BYTE,
    }
    qr = qrcode.QRCode(error_correction=levels[ecc], box_size=1, border=0)
    for mode, text in parts:
        qr.add_data(QRData(text.encode("utf-8"), mode=modes[mode]), optimize=0)
    qr.make(fit=True)
    return qr.version, [[1 if cell else 0 for cell in row] for row in qr.modules]


def parse_matrix(parts, ecc="M"):
    version, matrix = explicit_symbol(parts, ecc)
    expected = "".join(text for _, text in parts)
    for mask in range(8):
        bits = extract.read_bits(matrix, version, mask)
        data = extract.deinterleave(extract.bits_to_codewords(bits), version, ECC[ecc])
        try:
            parsed = extract.parse_stream(data, version)
        except (IndexError, ValueError):
            continue
        if parsed.payload == expected:
            return parsed
    raise AssertionError(f"could not parse explicit segments for {expected!r}")


class ParseSegmentsTest(unittest.TestCase):
    def test_numeric_segment(self):
        parsed = parse_matrix([("numeric", "867530912345")])
        self.assertEqual(parsed.payload, "867530912345")
        self.assertEqual([segment.mode for segment in parsed.segments], [1])

    def test_alphanumeric_segment(self):
        parsed = parse_matrix([("alphanumeric", "MEET AT GATE 7")])
        self.assertEqual(parsed.payload, "MEET AT GATE 7")
        self.assertEqual([segment.mode for segment in parsed.segments], [2])

    def test_byte_segment(self):
        parsed = parse_matrix([("byte", "Mixed case / west")])
        self.assertEqual(parsed.payload, "Mixed case / west")
        self.assertEqual([segment.mode for segment in parsed.segments], [4])

    def test_mixed_mode_stream(self):
        parts = [
            ("alphanumeric", "MEET AT GATE "),
            ("numeric", "8675309"),
            ("byte", "/west"),
        ]
        parsed = parse_matrix(parts)
        self.assertEqual(parsed.payload, "MEET AT GATE 8675309/west")
        self.assertEqual([segment.mode for segment in parsed.segments], [2, 1, 4])
        self.assertTrue(parsed.terminator_ok)
        self.assertGreater(len(parsed.padding), 0)

    def test_attribution_reader_keeps_mixed_mode_symbol(self):
        parts = [
            ("alphanumeric", "MEET AT GATE "),
            ("numeric", "8675309"),
            ("byte", "/west"),
        ]
        version, matrix = explicit_symbol(parts)
        features = attribute.read_symbol(matrix, "MEET AT GATE 8675309/west")
        self.assertIsNotNone(features)
        self.assertEqual(features["version"], version)
        self.assertEqual(features["segments"], 3)
        self.assertEqual(features["numseg"], 1)
        self.assertEqual(features["alnumseg"], 1)
        self.assertEqual(features["byteseg"], 1)


if __name__ == "__main__":
    unittest.main()