(function (root, factory) {
  "use strict";

  const qr = typeof module !== "undefined" && module.exports
    ? require("./qr-core.js") : root.QR;
  const api = factory(qr);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HideAndSeenSegments = api;
})(typeof self !== "undefined" ? self : this, function (QR) {
  "use strict";

  const modes = ["numeric", "alphanumeric", "byte"];

  function usableModes(text) {
    const result = [];
    if (/^\d+$/.test(text)) result.push("numeric");
    if (Array.from(text).every(character => QR.ALPHANUMERIC.includes(character)))
      result.push("alphanumeric");
    result.push("byte");
    return result;
  }

  function representationKey(segments) {
    return segments.map(segment => `${segment.mode}:${segment.text}`).join("|");
  }

  function optimize(text, version) {
    const best = Array.from({ length: text.length + 1 }, () => null);
    best[0] = { bits: 0, segments: [] };
    for (let start = 0; start < text.length; start += 1) {
      if (!best[start]) continue;
      for (let end = start + 1; end <= text.length; end += 1) {
        const slice = text.slice(start, end);
        for (const mode of usableModes(slice)) {
          const segment = { mode, text: slice };
          const bits = best[start].bits + QR.segmentBitLength([segment], version);
          const current = best[end];
          if (!current || bits < current.bits ||
              (bits === current.bits && best[start].segments.length + 1 < current.segments.length)) {
            best[end] = { bits, segments: best[start].segments.concat(segment) };
          }
        }
      }
    }
    return best[text.length];
  }

  function efficient(text, ecc) {
    for (let version = 1; version <= 12; version += 1) {
      const result = optimize(text, version);
      if (result && QR.fitSegments(result.segments, version, ecc))
        return { version, bits: result.bits, segments: result.segments };
    }
    throw new Error("message does not fit versions 1-12");
  }

  function byteSplit(text, indexes) {
    const points = [0].concat(indexes.filter(index => index > 0 && index < text.length), text.length);
    return points.slice(0, -1).map((start, index) => ({
      mode: "byte",
      text: text.slice(start, points[index + 1])
    }));
  }

  function variants(text, ecc) {
    if (text.length < 4) throw new Error("use at least four characters to compare representations");
    const optimal = efficient(text, ecc);
    const midpoint = Math.floor(text.length / 2);
    const candidates = [
      { bits: "00", name: "Efficient", segments: optimal.segments },
      { bits: "01", name: "Single byte segment", segments: [{ mode: "byte", text }] },
      { bits: "10", name: "Two byte segments", segments: byteSplit(text, [midpoint]) },
      { bits: "11", name: "Offset byte split", segments: byteSplit(text, [Math.max(1, Math.floor(text.length / 3))]) }
    ];
    const unique = new Set(candidates.map(candidate => representationKey(candidate.segments)));
    if (unique.size !== candidates.length)
      throw new Error("message needs more representational variety");
    let version = optimal.version;
    for (const candidate of candidates) {
      const needed = QR.chooseVersionForSegments(candidate.segments, ecc, 0);
      version = Math.max(version, needed || 13);
    }
    if (version > 12) throw new Error("representations do not fit versions 1-12");
    return candidates.map(candidate => Object.assign(candidate, {
      version,
      bitLength: QR.segmentBitLength(candidate.segments, version),
      symbol: QR.buildSegments(text, candidate.segments, { version, ecc })
    }));
  }

  return Object.freeze({ modes, usableModes, optimize,
    efficient, variants, representationKey });
});
