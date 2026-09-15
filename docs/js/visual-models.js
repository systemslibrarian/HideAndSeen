(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HideAndSeenVisualModels = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function bitsFromText(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    const bits = [];
    for (const byte of [bytes.length].concat(bytes))
      for (let shift = 7; shift >= 0; shift -= 1) bits.push((byte >> shift) & 1);
    return bits;
  }

  function textFromBits(bits) {
    if (bits.length < 8) return "";
    let length = 0;
    for (let index = 0; index < 8; index += 1) length = (length << 1) | bits[index];
    const bytes = [];
    for (let start = 8; start + 7 < bits.length && bytes.length < length; start += 8) {
      let value = 0;
      for (let index = 0; index < 8; index += 1) value = (value << 1) | bits[start + index];
      bytes.push(value);
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  function texture(symbol, secret) {
    const bits = bitsFromText(secret);
    const candidates = [];
    symbol.moduleMap.forEach((row, rowIndex) => row.forEach((info, columnIndex) => {
      if (symbol.matrix[rowIndex][columnIndex] &&
          ["payload", "padding", "error-correction"].includes(info.role))
        candidates.push({ row: rowIndex, column: columnIndex });
    }));
    if (bits.length > candidates.length)
      throw new Error(`secret needs ${bits.length} textured modules; only ${candidates.length} are available`);
    const marks = bits.map((bit, index) => Object.assign({ bit }, candidates[index]));
    return { marks, bits, recovered: textFromBits(marks.map(mark => mark.bit)) };
  }

  function seedValue(text) {
    let value = 2166136261;
    for (const character of text) {
      value ^= character.charCodeAt(0);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function randomBits(count, seed) {
    let state = seedValue(seed);
    const values = [];
    for (let index = 0; index < count; index += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      values.push((state >>> 31) & 1);
    }
    return values;
  }

  function shares(secretMask, seed) {
    const height = secretMask.length;
    const width = secretMask[0].length;
    const random = randomBits(width * height, seed);
    const first = [];
    const second = [];
    let offset = 0;
    for (let row = 0; row < height; row += 1) {
      const firstRow = [];
      const secondRow = [];
      for (let column = 0; column < width; column += 1) {
        const bit = random[offset++];
        const firstPattern = bit ? [1, 0] : [0, 1];
        const secondPattern = secretMask[row][column]
          ? firstPattern.map(value => value ^ 1) : firstPattern.slice();
        firstRow.push(...firstPattern);
        secondRow.push(...secondPattern);
      }
      first.push(firstRow);
      second.push(secondRow);
    }
    return { first, second, width: width * 2, height };
  }

  function combine(first, second, offset) {
    const height = first.length;
    const width = first[0].length;
    return Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, column) => {
        const shifted = column - offset;
        const secondValue = shifted >= 0 && shifted < width ? second[row][shifted] : 0;
        return first[row][column] || secondValue ? 1 : 0;
      }));
  }

  function nested(outer, inner) {
    if (outer.length !== inner.length) throw new Error("nested matrices must have the same size");
    const minority = {
      0: new Set([0, 3, 12, 15]),
      1: new Set([5, 6, 9, 10])
    };
    const cells = outer.map((row, rowIndex) => row.map((outerBit, columnIndex) => {
      const innerBit = inner[rowIndex][columnIndex] ? 1 : 0;
      const pattern = [];
      for (let index = 0; index < 16; index += 1) {
        const isMinority = minority[innerBit].has(index);
        pattern.push(outerBit ? (isMinority ? 0 : 1) : (isMinority ? 1 : 0));
      }
      return { outer: outerBit ? 1 : 0, inner: innerBit, pattern };
    }));
    return { cells, outer, inner };
  }

  return Object.freeze({ bitsFromText, textFromBits, texture, randomBits, shares, combine, nested });
});
