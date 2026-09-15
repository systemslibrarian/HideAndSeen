(function (root) {
  "use strict";

  const MASKS = [
    (row, column) => (row + column) % 2 === 0,
    row => row % 2 === 0,
    (_, column) => column % 3 === 0,
    (row, column) => (row + column) % 3 === 0,
    (row, column) => (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0,
    (row, column) => ((row * column) % 2) + ((row * column) % 3) === 0,
    (row, column) => (((row * column) % 2) + ((row * column) % 3)) % 2 === 0,
    (row, column) => (((row + column) % 2) + ((row * column) % 3)) % 2 === 0
  ];
  const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

  function readBits(matrix, version, mask) {
    const roles = root.QR.functionMap(version);
    const bits = [];
    let column = matrix.length - 1;
    let upward = true;
    while (column > 0) {
      if (column === 6) column -= 1;
      for (let index = 0; index < matrix.length; index += 1) {
        const row = upward ? matrix.length - 1 - index : index;
        for (const current of [column, column - 1]) {
          if (roles[row][current].role !== "data") continue;
          let bit = matrix[row][current] ? 1 : 0;
          if (MASKS[mask](row, current)) bit ^= 1;
          bits.push(bit);
        }
      }
      upward = !upward;
      column -= 2;
    }
    return bits;
  }

  function bitsToCodewords(bits) {
    const result = [];
    for (let start = 0; start + 7 < bits.length; start += 8) {
      let value = 0;
      for (let index = 0; index < 8; index += 1)
        value = (value << 1) | bits[start + index];
      result.push(value);
    }
    return result;
  }

  function blockSpec(version, ecc) {
    const result = [];
    for (const [count, total, data] of root.QRTABLES.blocks[version][ecc])
      for (let index = 0; index < count; index += 1) result.push([data, total - data]);
    return result;
  }

  function deinterleave(codewords, version, ecc) {
    const specs = blockSpec(version, ecc);
    const blocks = specs.map(() => []);
    let position = 0;
    const maximum = Math.max(...specs.map(spec => spec[0]));
    for (let index = 0; index < maximum; index += 1) {
      specs.forEach((spec, block) => {
        if (index < spec[0]) blocks[block].push(codewords[position++]);
      });
    }
    return blocks.flat();
  }

  function deinterleaveFull(codewords, version, ecc) {
    const specs = blockSpec(version, ecc);
    const data = specs.map(() => []);
    const parity = specs.map(() => []);
    let position = 0;
    for (let index = 0; index < Math.max(...specs.map(spec => spec[0])); index += 1)
      specs.forEach((spec, block) => {
        if (index < spec[0]) data[block].push(codewords[position++]);
      });
    for (let index = 0; index < Math.max(...specs.map(spec => spec[1])); index += 1)
      specs.forEach((spec, block) => {
        if (index < spec[1]) parity[block].push(codewords[position++]);
      });
    return { specs, data, parity };
  }

  function rsParity(data, count) {
    const generator = root.QRTABLES.genPoly[count];
    const result = new Array(count).fill(0);
    for (const byte of data) {
      const factor = byte ^ result[0];
      result.shift();
      result.push(0);
      if (factor) {
        const logarithm = root.QRTABLES.logTable[factor];
        for (let index = 0; index < generator.length; index += 1)
          result[index] ^= root.QRTABLES.expTable[generator[index] + logarithm];
      }
    }
    return result;
  }

  function verifyErrorCorrection(matrix, version, ecc, mask) {
    const rawCodewords = bitsToCodewords(readBits(matrix, version, mask));
    const blocks = deinterleaveFull(rawCodewords, version, ecc);
    const results = blocks.data.map((data, block) => {
      const expected = rsParity(data, blocks.specs[block][1]);
      const actual = blocks.parity[block];
      const mismatches = expected.reduce((count, value, index) =>
        count + (value !== actual[index] ? 1 : 0), 0);
      return { block, mismatches, valid: mismatches === 0, expected, actual };
    });
    return {
      valid: results.every(block => block.valid),
      invalidBlocks: results.filter(block => !block.valid).length,
      blocks: results
    };
  }

  class Reader {
    constructor(bits) { this.bits = bits; this.position = 0; }
    get remaining() { return this.bits.length - this.position; }
    take(count) {
      if (this.remaining < count) throw new Error("truncated QR data stream");
      let value = 0;
      for (let index = 0; index < count; index += 1)
        value = (value << 1) | this.bits[this.position++];
      return value;
    }
  }

  function cciBits(mode, version) {
    const band = version <= 9 ? 0 : (version <= 26 ? 1 : 2);
    return { numeric: [10, 12, 14], alphanumeric: [9, 11, 13], byte: [8, 16, 16] }[mode][band];
  }

  function parse(dataCodewords, version) {
    const bits = [];
    for (const codeword of dataCodewords)
      for (let shift = 7; shift >= 0; shift -= 1) bits.push((codeword >> shift) & 1);
    const reader = new Reader(bits);
    const segments = [];
    const modes = { 1: "numeric", 2: "alphanumeric", 4: "byte" };
    while (reader.remaining >= 4) {
      const start = reader.position;
      const indicator = reader.take(4);
      if (indicator === 0) break;
      if (indicator === 7) {
        const first = reader.take(1);
        const assignment = first === 0 ? reader.take(7) :
          (reader.take(1) === 0 ? reader.take(14) : reader.take(21));
        segments.push({ mode: "eci", text: "", count: 0, start, end: reader.position, assignment });
        continue;
      }
      const mode = modes[indicator];
      if (!mode) throw new Error(`unsupported mode ${indicator}`);
      const count = reader.take(cciBits(mode, version));
      let text = "";
      if (mode === "byte") {
        const bytes = new Uint8Array(Array.from({ length: count }, () => reader.take(8)));
        text = new TextDecoder().decode(bytes);
      } else if (mode === "alphanumeric") {
        const pairs = Math.floor(count / 2);
        for (let index = 0; index < pairs; index += 1) {
          const value = reader.take(11);
          text += ALPHANUMERIC[Math.floor(value / 45)] + ALPHANUMERIC[value % 45];
        }
        if (count % 2) text += ALPHANUMERIC[reader.take(6)];
      } else {
        const triplets = Math.floor(count / 3);
        for (let index = 0; index < triplets; index += 1)
          text += String(reader.take(10)).padStart(3, "0");
        if (count % 3 === 1) text += String(reader.take(4));
        if (count % 3 === 2) text += String(reader.take(7)).padStart(2, "0");
      }
      segments.push({ mode, text, count, start, end: reader.position });
    }
    const boundary = (8 - (reader.position % 8)) % 8;
    for (let index = 0; index < boundary && reader.remaining; index += 1) reader.take(1);
    const padStart = reader.position / 8;
    return {
      payload: segments.map(segment => segment.text).join(""),
      segments,
      padStart,
      padding: dataCodewords.slice(padStart)
    };
  }

  function inspect(matrix, version, ecc, mask) {
    const rawCodewords = bitsToCodewords(readBits(matrix, version, mask));
    const dataCodewords = deinterleave(rawCodewords, version, ecc);
    return Object.assign({ rawCodewords, dataCodewords, version, ecc, mask },
      parse(dataCodewords, version));
  }

  root.HideAndSeenInspect = Object.freeze({ readBits, bitsToCodewords,
    deinterleave, deinterleaveFull, parse, inspect, verifyErrorCorrection });
})(typeof self !== "undefined" ? self : this);
