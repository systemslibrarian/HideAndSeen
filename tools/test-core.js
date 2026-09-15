"use strict";

const assert = require("assert");
const QR = require("../docs/js/qr-core.js");
const Ecc = require("../docs/js/ecc-model.js");
const Segments = require("../docs/js/segments.js");
const Visual = require("../docs/js/visual-models.js");
const Distribution = require("../docs/js/distribution-model.js");
const Vss = require("../docs/js/qr-vss.js");
const DualMessage = require("../docs/js/dual-message.js");

const cases = [
  { text: "https://example.com", secret: null },
  { text: "https://ciphermuseum.com", secret: "MEET AT 7" },
  { text: "8675309", secret: "42" },
];

for (const testCase of cases) {
  const symbol = QR.build(testCase.text, { secret: testCase.secret });
  assert.equal(symbol.text, testCase.text);
  assert.equal(QR.reveal(symbol), testCase.secret);
  assert.equal(QR.inspect(symbol).anomalous, testCase.secret !== null);
  assert.equal(symbol.matrix.length, symbol.version * 4 + 17);
  assert.equal(symbol.moduleMap.length, symbol.matrix.length);
}

const anatomy = QR.build("QR ANATOMY / 2026", { version: 7, ecc: "M" });
const roles = new Set(anatomy.moduleMap.flat().map(cell => cell.role));
for (const role of ["finder", "separator", "timing", "alignment", "format",
  "version", "payload", "terminator", "padding", "error-correction"])
  assert(roles.has(role), `anatomy trace is missing ${role}`);
assert(anatomy.moduleMap.flat().some(cell => cell.maskFlips),
  "anatomy trace is missing mask operations");

const segmentedText = "MEET AT GATE 7 / CODE 86753091234567890";
const segmented = QR.buildSegments(segmentedText, [
  { mode: "alphanumeric", text: "MEET AT GATE 7 / CODE " },
  { mode: "numeric", text: "86753091234567890" }
], { ecc: "L" });
assert.equal(segmented.text, segmentedText);
assert.deepEqual(segmented.segments.map(segment => segment.mode),
  ["alphanumeric", "numeric"]);

const binarySecret = new Uint8Array([0, 255, 17, 128, 42]);
const binarySymbol = QR.build("BINARY SHARE", { secretBytes: binarySecret });
assert.deepEqual(Array.from(QR.revealBytes(binarySymbol)), Array.from(binarySecret));
assert.equal(QR.inspect(binarySymbol).anomalous, true);

const protectedSymbol = QR.build("https://ciphermuseum.com/ecc", { ecc: "M" });
const plan = Ecc.orderedTargets(protectedSymbol);
const correctionCapacity = plan.capacities.reduce((sum, count) => sum + count, 0);
const withinLimit = Ecc.mutate(protectedSymbol, correctionCapacity, 0, "10110");
const beyondLimit = Ecc.mutate(protectedSymbol, correctionCapacity + 1, 0, "10110");
assert.equal(withinLimit.predictedCorrectable, true);
assert.equal(beyondLimit.predictedCorrectable, false);
assert.equal(withinLimit.changes.length, correctionCapacity);
assert.equal(withinLimit.hidden.length, correctionCapacity);
assert.notDeepEqual(withinLimit.matrix, protectedSymbol.matrix);
assert.equal(QR.inspect(protectedSymbol).anomalous, false);

const multiBlockSymbol = QR.build("BLOCK PLACEMENT", { version: 7, ecc: "H" });
const fixedErrors = 16;
const spreadErrors = Ecc.mutate(multiBlockSymbol, fixedErrors, 0, "10110", "spread");
const concentratedErrors = Ecc.mutate(multiBlockSymbol, fixedErrors, 0, "10110", "concentrate");
const regionErrors = Ecc.mutate(multiBlockSymbol, fixedErrors, 0, "10110", "region");
assert.equal(spreadErrors.changes.length, fixedErrors);
assert.equal(concentratedErrors.changes.length, fixedErrors);
assert.equal(regionErrors.changes.length, fixedErrors);
assert.equal(spreadErrors.predictedCorrectable, true);
assert.equal(concentratedErrors.predictedCorrectable, false);
assert(regionErrors.changes.every(change => change.column >= 0 && change.row >= 0));

const representations = Segments.variants(segmentedText, "M");
assert.equal(representations.length, 4);
assert.equal(new Set(representations.map(item =>
  Segments.representationKey(item.segments))).size, 4);
assert(representations.every(item => item.symbol.text === segmentedText));
const combined = Ecc.mutate(representations[1].symbol, 5, 0, "10110");
assert.equal(combined.hidden, "10110");
assert.equal(combined.predictedCorrectable, true);

const textured = Visual.texture(protectedSymbol, "SEEN");
assert.equal(textured.recovered, "SEEN");
const secretMask = [[0, 1, 0], [1, 1, 0]];
const visualShares = Visual.shares(secretMask, "seed");
const visualOverlay = Visual.combine(visualShares.first, visualShares.second, 0);
secretMask.forEach((row, rowIndex) => row.forEach((secret, columnIndex) => {
  const density = visualOverlay[rowIndex][columnIndex * 2] +
    visualOverlay[rowIndex][columnIndex * 2 + 1];
  assert.equal(density, secret ? 2 : 1);
}));
const nested = Visual.nested([[1, 0], [0, 1]], [[0, 1], [1, 0]]);
assert.deepEqual(nested.outer, [[1, 0], [0, 1]]);
assert.deepEqual(nested.inner, [[0, 1], [1, 0]]);

const distribution = Distribution.simulate(400, "museum-2026");
for (const key of ["normal", "naive", "shaped"])
  assert.equal(distribution.result[key].counts.reduce((sum, value) => sum + value, 0), 400);
assert(distribution.result.naive.chiSquare > distribution.result.normal.chiSquare);
assert(distribution.result.naive.chiSquare > distribution.result.shaped.chiSquare);

const secretImage = [[1, 0, 1, 0], [0, 1, 0, 1]];
const packedImage = Vss.pack(secretImage);
const xorShares = Vss.create(secretImage, new Uint8Array(packedImage.bytes.length).fill(0x3c));
const encodedFirst = Vss.encodeShare(xorShares.width, xorShares.height, xorShares.first);
const encodedSecond = Vss.encodeShare(xorShares.width, xorShares.height, xorShares.second);
const recoveredImage = Vss.combine(encodedFirst, encodedSecond);
assert.deepEqual(recoveredImage.mask, secretImage);
assert.deepEqual(Array.from(recoveredImage.bytes), Array.from(packedImage.bytes));
assert.notDeepEqual(Array.from(xorShares.first), Array.from(packedImage.bytes));
assert.notDeepEqual(Array.from(xorShares.second), Array.from(packedImage.bytes));

const nearMatrix = [[0, 1], [1, 0]];
const farMatrix = [[1, 0], [0, 1]];
DualMessage.validate(nearMatrix, farMatrix, 29, 7);
const idealDual = DualMessage.idealSamples(nearMatrix, farMatrix);
assert.deepEqual(idealDual.near, nearMatrix);
assert.deepEqual(idealDual.far, farMatrix);

console.log(`${cases.length} QR core round trips passed`);
