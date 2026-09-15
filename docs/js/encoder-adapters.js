(function (root) {
  "use strict";

  const ECC_BITS = { 0: "M", 1: "L", 2: "H", 3: "Q" };

  function nodeQrcode(text, options) {
    if (!root.NodeQRCode) throw new Error("node-qrcode browser bundle is unavailable");
    const settings = Object.assign({ errorCorrectionLevel: "M" }, options);
    const code = root.NodeQRCode.create(text, settings);
    const size = code.modules.size;
    const matrix = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, column) => code.modules.get(row, column) ? 1 : 0));
    return {
      encoder: "node-qrcode",
      text,
      matrix,
      version: code.version,
      ecc: ECC_BITS[code.errorCorrectionLevel.bit] || settings.errorCorrectionLevel,
      mask: code.maskPattern,
      segments: code.segments.map(segment => ({
        mode: segment.mode.id.toLowerCase(),
        length: segment.getLength()
      }))
    };
  }

  function hideAndSeen(text, options) {
    const symbol = root.QR.build(text, options);
    return Object.assign({ encoder: "HideAndSeen" }, symbol);
  }

  function compare(first, second) {
    if (first.matrix.length !== second.matrix.length) {
      return { comparable: false, differences: [], count: null,
        reason: `matrix sizes differ (${first.matrix.length} vs ${second.matrix.length})` };
    }
    const differences = root.HideAndSeenRender.diff(first.matrix, second.matrix);
    return { comparable: true, differences, count: differences.length, reason: null };
  }

  root.HideAndSeenEncoders = Object.freeze({ nodeQrcode, hideAndSeen, compare });
})(typeof self !== "undefined" ? self : this);
