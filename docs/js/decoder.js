(function (root) {
  "use strict";

  function decodeMatrix(matrix) {
    if (!root.ZXing) throw new Error("ZXing decoder is unavailable");
    const border = 4;
    const scale = 6;
    const modules = matrix.length + border * 2;
    const size = modules * scale;
    const pixels = new Uint8ClampedArray(size * size);
    pixels.fill(255);
    for (let row = 0; row < matrix.length; row += 1) {
      for (let column = 0; column < matrix.length; column += 1) {
        if (!matrix[row][column]) continue;
        for (let y = 0; y < scale; y += 1) {
          const offset = ((row + border) * scale + y) * size + (column + border) * scale;
          pixels.fill(0, offset, offset + scale);
        }
      }
    }
    const source = new root.ZXing.RGBLuminanceSource(pixels, size, size);
    const bitmap = new root.ZXing.BinaryBitmap(new root.ZXing.HybridBinarizer(source));
    const hints = new Map();
    hints.set(root.ZXing.DecodeHintType.POSSIBLE_FORMATS, [root.ZXing.BarcodeFormat.QR_CODE]);
    hints.set(root.ZXing.DecodeHintType.PURE_BARCODE, true);
    try {
      return new root.ZXing.MultiFormatReader().decode(bitmap, hints).getText();
    } catch (error) {
      return null;
    }
  }

  function decodeCanvas(canvas) {
    if (!root.ZXing) throw new Error("ZXing decoder is unavailable");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let source = 0, target = 0; source < rgba.length; source += 4, target += 1)
      pixels[target] = Math.round(rgba[source] * .299 + rgba[source + 1] * .587 + rgba[source + 2] * .114);
    const source = new root.ZXing.RGBLuminanceSource(pixels, canvas.width, canvas.height);
    const bitmap = new root.ZXing.BinaryBitmap(new root.ZXing.HybridBinarizer(source));
    const hints = new Map();
    hints.set(root.ZXing.DecodeHintType.POSSIBLE_FORMATS, [root.ZXing.BarcodeFormat.QR_CODE]);
    hints.set(root.ZXing.DecodeHintType.PURE_BARCODE, true);
    try {
      return new root.ZXing.MultiFormatReader().decode(bitmap, hints).getText();
    } catch (error) {
      return null;
    }
  }

  root.HideAndSeenDecoder = Object.freeze({ decodeMatrix, decodeCanvas });
})(typeof self !== "undefined" ? self : this);
