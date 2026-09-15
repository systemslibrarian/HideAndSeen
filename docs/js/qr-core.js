/* HideAndSeen -- a QR encoder that lets you write into the padding.
 *
 * No QR library exposes the pad codewords, because nothing legitimate needs
 * them. Byte mode only, versions 1-12, which covers any URL you would put on
 * a sticker.
 *
 * Runs in the browser and in node (for the headless scan test).
 */
(function (root) {
  "use strict";

  const T = (typeof require !== "undefined" && typeof module !== "undefined")
    ? require("./qr-tables.js")
    : root.QRTABLES;

  const PAD_A = 0xEC, PAD_B = 0x11;
  const MAGIC = [0x1f, 0x8b];               // marks a hidden payload
  const MODES = { numeric: 1, alphanumeric: 2, byte: 4 };
  const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

  // ---- field arithmetic -------------------------------------------------

  function rsParity(data, numEc) {
    const gen = T.genPoly[numEc];           // alpha exponents, leading 0 dropped
    const res = new Array(numEc).fill(0);
    for (const byte of data) {
      const factor = byte ^ res[0];
      res.shift(); res.push(0);
      if (factor) {
        const lf = T.logTable[factor];
        for (let i = 0; i < gen.length; i++) res[i] ^= T.expTable[gen[i] + lf];
      }
    }
    return res;
  }

  // ---- capacity ---------------------------------------------------------

  function blockSpec(version, ecc) {
    const out = [];
    for (const [count, total, data] of T.blocks[version][ecc]) {
      for (let i = 0; i < count; i++) out.push([data, total - data]);
    }
    return out;
  }

  function dataCodewords(version, ecc) {
    return blockSpec(version, ecc).reduce((n, b) => n + b[0], 0);
  }

  function cciBits(mode, version) {
    const band = version <= 9 ? 0 : (version <= 26 ? 1 : 2);
    return {
      numeric: [10, 12, 14],
      alphanumeric: [9, 11, 13],
      byte: [8, 16, 16]
    }[mode][band];
  }

  function segmentDataBits(segment) {
    if (segment.mode === "numeric") {
      const groups = Math.floor(segment.text.length / 3);
      return groups * 10 + [0, 4, 7][segment.text.length % 3];
    }
    if (segment.mode === "alphanumeric") {
      return Math.floor(segment.text.length / 2) * 11 +
        (segment.text.length % 2 ? 6 : 0);
    }
    return new TextEncoder().encode(segment.text).length * 8;
  }

  function normalizeSegments(text, input) {
    const segments = input && input.length
      ? input.map(segment => ({ mode: segment.mode, text: String(segment.text) }))
      : [{ mode: "byte", text: text }];
    if (segments.map(segment => segment.text).join("") !== text)
      throw new Error("segment text must concatenate to the overt message");
    for (const segment of segments) {
      if (!Object.prototype.hasOwnProperty.call(MODES, segment.mode))
        throw new Error(`unsupported segment mode: ${segment.mode}`);
      if (!segment.text.length) throw new Error("segments must not be empty");
      if (segment.mode === "numeric" && !/^\d+$/.test(segment.text))
        throw new Error("numeric segments may contain digits only");
      if (segment.mode === "alphanumeric" &&
          Array.from(segment.text).some(character => !ALPHANUMERIC.includes(character)))
        throw new Error("alphanumeric segment contains a character outside the QR set");
    }
    return segments;
  }

  function segmentCount(segment) {
    return segment.mode === "byte"
      ? new TextEncoder().encode(segment.text).length
      : segment.text.length;
  }

  function segmentBitLength(segments, version) {
    return segments.reduce((total, segment) => total + 4 +
      cciBits(segment.mode, version) + segmentDataBits(segment), 0);
  }

  function fitSegments(segments, version, ecc) {
    const cap = dataCodewords(version, ecc);
    const used = segmentBitLength(segments, version);
    if (used > cap * 8) return null;
    const padded = Math.ceil(Math.min(used + 4, cap * 8) / 8) * 8;
    return { segments: segments, cap: cap, used: used,
      padBytes: Math.max(0, (cap * 8 - padded) / 8) };
  }

  /** Bytes of payload a given symbol holds, and how many pad bytes are left. */
  function fit(text, version, ecc) {
    const bytes = new TextEncoder().encode(text);
    const result = fitSegments([{ mode: "byte", text: text }], version, ecc);
    return result ? Object.assign({ bytes: bytes }, result) : null;
  }

  /** Smallest version that holds the text plus `need` bytes of padding. */
  function chooseVersionForSegments(segments, ecc, need) {
    for (let v = 1; v <= T.maxVersion; v++) {
      const f = fitSegments(segments, v, ecc);
      if (f && f.padBytes >= need) return v;
    }
    return null;
  }

  function chooseVersion(text, ecc, need) {
    return chooseVersionForSegments([{ mode: "byte", text: text }], ecc, need);
  }

  // ---- data codewords ---------------------------------------------------

  function buildData(text, version, ecc, secretBytes, segments) {
    const f = fitSegments(segments, version, ecc);
    if (!f) throw new Error("payload does not fit that version");

    const bits = [];
    const bitRoles = [];
    const push = (val, n, role) => {
      for (let i = n - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
        bitRoles.push(role);
      }
    };
    for (const segment of segments) {
      push(MODES[segment.mode], 4, "mode");
      push(segmentCount(segment), cciBits(segment.mode, version), "count");
      if (segment.mode === "numeric") {
        for (let index = 0; index < segment.text.length; index += 3) {
          const group = segment.text.slice(index, index + 3);
          push(Number(group), [0, 4, 7, 10][group.length], "payload");
        }
      } else if (segment.mode === "alphanumeric") {
        for (let index = 0; index < segment.text.length; index += 2) {
          const group = segment.text.slice(index, index + 2);
          const value = group.length === 2
            ? ALPHANUMERIC.indexOf(group[0]) * 45 + ALPHANUMERIC.indexOf(group[1])
            : ALPHANUMERIC.indexOf(group[0]);
          push(value, group.length === 2 ? 11 : 6, "payload");
        }
      } else {
        for (const byte of new TextEncoder().encode(segment.text)) push(byte, 8, "payload");
      }
    }
    push(0, Math.min(4, f.cap * 8 - bits.length), "terminator");
    while (bits.length % 8) {
      bits.push(0);
      bitRoles.push("zero-fill");
    }

    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0; for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
      cw.push(v);
    }

    const padStart = cw.length;
    const room = f.cap - padStart;
    let tail;
    if (secretBytes && secretBytes.length) {
      const blob = MAGIC.concat([secretBytes.length], Array.from(secretBytes));
      if (blob.length > room) throw new Error("secret does not fit the padding");
      tail = blob.concat(Array.from({ length: room - blob.length },
        (_, k) => (k + blob.length) % 2 === 0 ? PAD_A : PAD_B));
    } else {
      tail = Array.from({ length: room }, (_, k) => k % 2 === 0 ? PAD_A : PAD_B);
    }
    for (let i = 0; i < tail.length * 8; i++) bitRoles.push("padding");
    return { codewords: cw.concat(tail), padStart: padStart, bitRoles: bitRoles };
  }

  function interleaveDetailed(data, version, ecc) {
    const specs = blockSpec(version, ecc);
    const blocks = [], indices = [], parities = [];
    let pos = 0;
    for (const [nd, ne] of specs) {
      const blk = data.slice(pos, pos + nd);
      blocks.push(blk);
      indices.push(Array.from({ length: nd }, (_, index) => pos + index));
      parities.push(rsParity(blk, ne));
      pos += nd;
    }
    const stream = [], layout = [];
    const maxD = Math.max(...blocks.map(b => b.length));
    for (let j = 0; j < maxD; j++)
      for (let block = 0; block < blocks.length; block++) {
        if (j < blocks[block].length) {
          stream.push(blocks[block][j]);
          layout.push({ kind: "data", block: block, withinBlock: j,
            logicalIndex: indices[block][j], ecCodewords: specs[block][1] });
        }
      }
    const maxE = Math.max(...parities.map(p => p.length));
    for (let j = 0; j < maxE; j++)
      for (let block = 0; block < parities.length; block++) {
        if (j < parities[block].length) {
          stream.push(parities[block][j]);
          layout.push({ kind: "error-correction", block: block,
            withinBlock: j, logicalIndex: null, ecCodewords: specs[block][1] });
        }
      }
    return { stream: stream, layout: layout, blockSpec: specs };
  }

  function interleave(data, version, ecc) {
    return interleaveDetailed(data, version, ecc).stream;
  }

  // ---- geometry ---------------------------------------------------------

  const MASKS = [
    (i, j) => (i + j) % 2 === 0,
    (i, j) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0
  ];

  function reservedMap(version, n) {
    const r = Array.from({ length: n }, () => new Array(n).fill(false));
    const block = (r0, c0, h, w) => {
      for (let i = r0; i < r0 + h; i++)
        for (let j = c0; j < c0 + w; j++)
          if (i >= 0 && i < n && j >= 0 && j < n) r[i][j] = true;
    };
    block(0, 0, 9, 9); block(0, n - 8, 9, 8); block(n - 8, 0, 8, 9);
    for (let k = 0; k < n; k++) { r[6][k] = true; r[k][6] = true; }
    if (version >= 2) {
      const pos = T.align[version];
      for (const a of pos) for (const b of pos) {
        if ((a < 9 && b < 9) || (a < 9 && b > n - 10) || (a > n - 10 && b < 9)) continue;
        block(a - 2, b - 2, 5, 5);
      }
    }
    if (version >= 7) { block(n - 11, 0, 3, 6); block(0, n - 11, 6, 3); }
    return r;
  }

  function functionMap(version) {
    const n = version * 4 + 17;
    const roles = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ role: "data" })));
    const set = (row, column, role) => {
      if (row >= 0 && row < n && column >= 0 && column < n)
        roles[row][column] = { role: role };
    };
    const block = (row, column, height, width, role) => {
      for (let r = row; r < row + height; r++)
        for (let c = column; c < column + width; c++) set(r, c, role);
    };

    block(0, 0, 7, 7, "finder");
    block(0, n - 7, 7, 7, "finder");
    block(n - 7, 0, 7, 7, "finder");
    for (let index = 0; index < 8; index++) {
      set(7, index, "separator"); set(index, 7, "separator");
      set(7, n - 1 - index, "separator"); set(index, n - 8, "separator");
      set(n - 8, index, "separator"); set(n - 1 - index, 7, "separator");
    }
    for (let index = 8; index < n - 8; index++) {
      set(6, index, "timing");
      set(index, 6, "timing");
    }
    if (version >= 2) {
      const positions = T.align[version];
      for (const row of positions) for (const column of positions) {
        if ((row < 9 && column < 9) || (row < 9 && column > n - 10) ||
            (row > n - 10 && column < 9)) continue;
        block(row - 2, column - 2, 5, 5, "alignment");
      }
    }
    for (let index = 0; index <= 5; index++) set(index, 8, "format");
    set(7, 8, "format"); set(8, 8, "format"); set(8, 7, "format");
    for (let index = 9; index <= 14; index++) set(8, 14 - index, "format");
    for (let index = 0; index <= 7; index++) set(8, n - 1 - index, "format");
    for (let index = 8; index <= 14; index++) set(n - 15 + index, 8, "format");
    set(n - 8, 8, "dark-module");
    if (version >= 7) {
      block(n - 11, 0, 3, 6, "version");
      block(0, n - 11, 6, 3, "version");
    }
    return roles;
  }

  function blankMatrix(version) {
    const n = version * 4 + 17;
    const m = Array.from({ length: n }, () => new Array(n).fill(0));
    const finder = (r0, c0) => {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        const r = r0 + i, c = c0 + j;
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const edge = (i === 0 || i === 6) && j >= 0 && j <= 6;
        const side = (j === 0 || j === 6) && i >= 0 && i <= 6;
        const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        m[r][c] = (edge || side || core) ? 1 : 0;
      }
    };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let k = 8; k < n - 8; k++) { m[6][k] = k % 2 === 0 ? 1 : 0; m[k][6] = k % 2 === 0 ? 1 : 0; }
    if (version >= 2) {
      const pos = T.align[version];
      for (const a of pos) for (const b of pos) {
        if ((a < 9 && b < 9) || (a < 9 && b > n - 10) || (a > n - 10 && b < 9)) continue;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++)
          m[a + i][b + j] = (Math.max(Math.abs(i), Math.abs(j)) !== 1) ? 1 : 0;
      }
    }
    m[n - 8][8] = 1;                         // the always-dark module
    return m;
  }

  function placeBits(matrix, version, mask, bits, trace) {
    const n = matrix.length, res = reservedMap(version, n), fn = MASKS[mask];
    let idx = 0, col = n - 1, up = true;
    while (col > 0) {
      if (col === 6) col--;
      for (let k = 0; k < n; k++) {
        const row = up ? n - 1 - k : k;
        for (const c of [col, col - 1]) {
          if (res[row][c]) continue;
          if (trace) trace.push({ row: row, column: c, bitIndex: idx,
            maskFlips: fn(row, c) });
          const bit = idx < bits.length ? bits[idx++] : 0;
          matrix[row][c] = fn(row, c) ? bit ^ 1 : bit;
        }
      }
      up = !up; col -= 2;
    }
    return matrix;
  }

  // segno's FORMAT_INFO is indexed by ITS OWN error constants (M=0, L=1, H=2,
  // Q=3), not by L/M/Q/H order. Getting this wrong yields a symbol that looks
  // perfect and decodes to nothing.
  const ECC_TABLE_INDEX = { L: 1, M: 0, Q: 3, H: 2 };

  function placeFormat(matrix, ecc, mask) {
    const n = matrix.length;
    const bits = T.formatInfo[ECC_TABLE_INDEX[ecc] * 8 + mask];
    const bit = k => (bits >> k) & 1;          // bit 0 is the least significant

    // The reference implementations index modules as (x, y) = (column, row).
    // Written as [row][col] the strips swap, which produces a symbol that
    // looks perfect and decodes to nothing.
    for (let k = 0; k <= 5; k++) matrix[k][8] = bit(k);
    matrix[7][8] = bit(6);
    matrix[8][8] = bit(7);
    matrix[8][7] = bit(8);
    for (let k = 9; k <= 14; k++) matrix[8][14 - k] = bit(k);

    for (let k = 0; k <= 7; k++) matrix[8][n - 1 - k] = bit(k);
    for (let k = 8; k <= 14; k++) matrix[n - 15 + k][8] = bit(k);

    matrix[n - 8][8] = 1;                      // the always-dark module
    return matrix;
  }

  function placeVersion(matrix, version) {
    if (version < 7) return matrix;
    const n = matrix.length, bits = T.versionInfo[version - 7];
    for (let k = 0; k < 18; k++) {
      const bit = (bits >> k) & 1;
      const r = Math.floor(k / 3), c = k % 3;
      matrix[n - 11 + c][r] = bit;
      matrix[r][n - 11 + c] = bit;
    }
    return matrix;
  }

  function penalty(m) {
    const n = m.length; let p = 0;
    const run = line => {
      let s = 0;
      for (let i = 0, c = 1; i < n; i++) {
        if (i && line[i] === line[i - 1]) c++; else c = 1;
        if (c === 5) s += 3; else if (c > 5) s += 1;
      }
      return s;
    };
    for (let i = 0; i < n; i++) { p += run(m[i]); p += run(m.map(r => r[i])); }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++)
      if (m[i][j] === m[i][j + 1] && m[i][j] === m[i + 1][j] && m[i][j] === m[i + 1][j + 1]) p += 3;
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const rpat = pat.slice().reverse();
    const scan = line => {
      let s = 0;
      for (let i = 0; i + 11 <= n; i++) {
        const w = line.slice(i, i + 11);
        if (w.every((v, k) => v === pat[k]) || w.every((v, k) => v === rpat[k])) s += 40;
      }
      return s;
    };
    for (let i = 0; i < n; i++) { p += scan(m[i]); p += scan(m.map(r => r[i])); }
    let dark = 0;
    for (const row of m) for (const v of row) dark += v;
    p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }

  // ---- the public surface -----------------------------------------------

  /** Build a symbol. `secret` may be null. Returns matrix + everything about it. */
  function build(text, opts) {
    opts = opts || {};
    const ecc = opts.ecc || "L";
    const segments = normalizeSegments(text, opts.segments);
    const secretBytes = opts.secretBytes !== undefined && opts.secretBytes !== null
      ? Array.from(opts.secretBytes)
      : (opts.secret ? Array.from(new TextEncoder().encode(opts.secret)) : null);
    if (secretBytes && secretBytes.length > 255)
      throw new Error("hidden payload is limited to 255 bytes");
    const need = secretBytes ? secretBytes.length + MAGIC.length + 1 : 0;
    const version = opts.version || chooseVersionForSegments(segments, ecc, need);
    if (!version) throw new Error("no version up to " + T.maxVersion + " fits that");

    const { codewords, padStart, bitRoles } = buildData(text, version, ecc, secretBytes, segments);
    const interleaved = interleaveDetailed(codewords, version, ecc);
    const stream = interleaved.stream;
    const bits = [];
    for (const cw of stream) for (let k = 7; k >= 0; k--) bits.push((cw >> k) & 1);

    if (opts.mask !== undefined &&
        (!Number.isInteger(opts.mask) || opts.mask < 0 || opts.mask > 7))
      throw new Error("mask must be an integer from 0 to 7");
    const masks = opts.mask === undefined
      ? Array.from({ length: 8 }, (_, index) => index) : [opts.mask];
    let best = null;
    for (const mask of masks) {
      const m = blankMatrix(version);
      const trace = [];
      placeBits(m, version, mask, bits, trace);
      placeFormat(m, ecc, mask);
      placeVersion(m, version);
      const p = penalty(m);
      if (!best || p < best.penalty)
        best = { matrix: m, mask: mask, penalty: p, trace: trace };
    }

    const moduleMap = functionMap(version);
    for (const point of best.trace) {
      const streamIndex = Math.floor(point.bitIndex / 8);
      const streamMeta = interleaved.layout[streamIndex];
      let role = "remainder";
      let logicalIndex = null;
      if (streamMeta) {
        logicalIndex = streamMeta.logicalIndex;
        role = streamMeta.kind;
        if (streamMeta.kind === "data") {
          const logicalBit = streamMeta.logicalIndex * 8 + (point.bitIndex % 8);
          role = bitRoles[logicalBit] || "data";
        }
      }
      moduleMap[point.row][point.column] = {
        role: role,
        maskFlips: point.maskFlips,
        streamCodeword: streamIndex,
        logicalCodeword: logicalIndex,
        block: streamMeta ? streamMeta.block : null
      };
    }

    return {
      matrix: best.matrix, version: version, ecc: ecc, mask: best.mask,
      codewords: codewords, padStart: padStart,
      padding: codewords.slice(padStart),
      text: text, secret: opts.secret || null,
      secretBytes: secretBytes ? secretBytes.slice() : null,
      segments: segments.map(segment => ({ mode: segment.mode, text: segment.text,
        bits: 4 + cciBits(segment.mode, version) + segmentDataBits(segment) })),
      streamCodewords: stream,
      blockSpec: interleaved.blockSpec,
      moduleMap: moduleMap
    };
  }

  /** What a cooperating decoder finds in the padding, as opaque bytes. */
  function revealBytes(sym) {
    const pad = sym.padding;
    if (pad.length > 3 && pad[0] === MAGIC[0] && pad[1] === MAGIC[1]) {
      const len = pad[2];
      return new Uint8Array(pad.slice(3, 3 + len));
    }
    return null;
  }

  /** What the cooperating text decoder finds. */
  function reveal(sym) {
    const bytes = revealBytes(sym);
    return bytes === null ? null : new TextDecoder().decode(bytes);
  }

  /** What the analyst finds: pad codewords the standard says should be there. */
  function inspect(sym) {
    const pad = sym.padding;
    const expected = pad.map((_, k) => k % 2 === 0 ? PAD_A : PAD_B);
    const bad = [];
    pad.forEach((v, k) => { if (v !== expected[k]) bad.push(k); });
    return { total: pad.length, deviating: bad, expected: expected, anomalous: bad.length > 0 };
  }

  function buildSegments(text, segments, opts) {
    return build(text, Object.assign({}, opts, { segments: segments }));
  }

  const API = { build, buildSegments, reveal, revealBytes, inspect, fit, fitSegments,
    chooseVersion, chooseVersionForSegments, segmentBitLength, normalizeSegments,
    functionMap, MODES, ALPHANUMERIC,
    PAD_A, PAD_B, MAGIC };
  if (typeof module !== "undefined") module.exports = API; else root.QR = API;
})(typeof self !== "undefined" ? self : this);
