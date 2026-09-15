"use strict";

const fs = require("fs");
const path = require("path");
const {
  BinaryBitmap,
  DecodeHintType,
  BarcodeFormat,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource
} = require("@zxing/library");

const outDir = process.argv[2] || "/tmp/hideandseen";
const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
hints.set(DecodeHintType.TRY_HARDER, true);
hints.set(DecodeHintType.PURE_BARCODE, true);

function readPgm(file) {
  const buffer = fs.readFileSync(file);
  const match = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(buffer.toString("ascii", 0, 80));
  if (!match) throw new Error(`unsupported PGM header: ${file}`);
  const offset = match[0].length;
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    pixels: new Uint8ClampedArray(buffer.subarray(offset))
  };
}

function decode(file) {
  const image = readPgm(file);
  const source = new RGBLuminanceSource(image.pixels, image.width, image.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  return new MultiFormatReader().decode(bitmap, hints).getText();
}

const failures = [];
const behaviorFailures = [];
for (const entry of manifest) {
  let result = "";
  try {
    result = decode(path.join(outDir, entry.file));
  } catch (error) {
    failures.push({ file: entry.file, expected: entry.text, got: error.message });
    continue;
  }
  if (result !== entry.text)
    failures.push({ file: entry.file, expected: entry.text, got: result });
  if (!entry.revealOk || entry.anomalous !== entry.hasHidden)
    behaviorFailures.push(entry.file);
}

console.log(`${manifest.length - failures.length}/${manifest.length} rendered symbols decoded by ZXing`);
console.log(`${manifest.length - behaviorFailures.length}/${manifest.length} hidden payload and detector checks passed`);
for (const failure of failures.slice(0, 5))
  console.error(`${failure.file}: expected ${JSON.stringify(failure.expected)}, got ${JSON.stringify(failure.got)}`);
for (const file of behaviorFailures.slice(0, 5))
  console.error(`${file}: hidden payload or detector check failed`);
if (failures.length || behaviorFailures.length) process.exitCode = 1;