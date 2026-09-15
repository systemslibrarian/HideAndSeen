/* emit.js -- render symbols from the browser engine so an independent decoder
 * can check them. Pairs with tools/verify.py.
 *
 *     node tools/emit.js /tmp/out && python3 tools/verify.py /tmp/out
 *
 * Writes one PGM per case plus a manifest. PGM because it needs no library on
 * either side.
 */
const path = require("path");
const fs = require("fs");
const QR = require(path.join(__dirname, "..", "docs", "js", "qr-core.js"));
const Vss = require(path.join(__dirname, "..", "docs", "js", "qr-vss.js"));

const outDir = process.argv[2] || "/tmp/hideandseen";
fs.mkdirSync(outDir, { recursive: true });

function cases() {
  const out = [];
  const secrets = [null, "MEET AT 7", "k=9f3ad107bb4218e6", "hello from the padding"];
  for (let len = 10; len <= 140; len += 5) {
    const url = "https://x.example.com/" + "a".repeat(Math.max(0, len - 22));
    for (const ecc of ["L", "M", "Q", "H"]) {
      for (const secret of secrets) {
        try {
          out.push({ text: url, ecc: ecc, secret: secret });
        } catch (e) { /* skip */ }
      }
    }
  }
  out.push({
    text: "MEET AT GATE 7 / CODE 86753091234567890",
    ecc: "L",
    secret: null,
    segments: [
      { mode: "alphanumeric", text: "MEET AT GATE 7 / CODE " },
      { mode: "numeric", text: "86753091234567890" }
    ]
  });
  out.push({
    text: "MEET AT GATE 7 / CODE 86753091234567890",
    ecc: "L",
    secret: null,
    segments: [
      { mode: "byte", text: "MEET AT GATE 7 / CODE" },
      { mode: "byte", text: " 86753091234567890" }
    ]
  });
  const mask = Array.from({ length: 18 }, (_, row) =>
    Array.from({ length: 64 }, (_, column) =>
      ((row >= 4 && row <= 13 && (column % 13 < 6)) ||
       (column >= 18 && column <= 45 && (row === 4 || row === 13))) ? 1 : 0));
  const packed = Vss.pack(mask);
  const deterministic = new Uint8Array(packed.bytes.length);
  deterministic.forEach((_, index) => { deterministic[index] = (index * 73 + 41) & 0xff; });
  const shares = Vss.create(mask, deterministic);
  out.push({ text: "https://example.org/public-a", ecc: "M", secret: null,
    secretBytes: Vss.encodeShare(shares.width, shares.height, shares.first) });
  out.push({ text: "https://example.org/public-b", ecc: "M", secret: null,
    secretBytes: Vss.encodeShare(shares.width, shares.height, shares.second) });
  return out;
}

function writePGM(file, matrix, scale, border) {
  const n = matrix.length, w = (n + 2 * border) * scale;
  const buf = Buffer.alloc(w * w, 255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!matrix[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = ((y + border) * scale + dy) * w + (x + border) * scale;
        buf.fill(0, row, row + scale);
      }
    }
  }
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`P5\n${w} ${w}\n255\n`), buf]));
}

const manifest = [];
let skipped = 0;
cases().forEach((c, i) => {
  let sym;
  try {
    sym = QR.build(c.text, { ecc: c.ecc, secret: c.secret,
      secretBytes: c.secretBytes, segments: c.segments });
  } catch (e) { skipped++; return; }

  const file = path.join(outDir, `s${String(i).padStart(4, "0")}.pgm`);
  writePGM(file, sym.matrix, 6, 4);

  const revealed = QR.reveal(sym);
  const revealedBytes = QR.revealBytes(sym);
  const report = QR.inspect(sym);
  const hasHidden = c.secret !== null || c.secretBytes !== undefined;
  const binaryRevealOk = c.secretBytes === undefined ||
    (revealedBytes && Array.from(revealedBytes).every((value, index) =>
      value === c.secretBytes[index]) && revealedBytes.length === c.secretBytes.length);
  manifest.push({
    file: path.basename(file), text: c.text, secret: c.secret,
    hasHidden: hasHidden,
    version: sym.version, ecc: sym.ecc, mask: sym.mask,
    padBytes: sym.padding.length,
    revealed: revealed,
    revealOk: binaryRevealOk && (c.secretBytes !== undefined || (c.secret || null) === revealed),
    deviating: report.deviating.length,
    anomalous: report.anomalous
  });
});

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`${manifest.length} symbols written to ${outDir}` +
            (skipped ? ` (${skipped} skipped: would not fit)` : ""));
