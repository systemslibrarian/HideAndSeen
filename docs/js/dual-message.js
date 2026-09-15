(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HideAndSeenDualMessage = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function validate(near, far, moduleSize, centroidSize) {
    if (!near.length || near.length !== far.length ||
        near.some((row, index) => row.length !== near.length || far[index].length !== near.length))
      throw new Error("near and far QR matrices must have the same square dimensions");
    if (!Number.isInteger(moduleSize) || !Number.isInteger(centroidSize) ||
        moduleSize < 3 || centroidSize < 1 || centroidSize >= moduleSize ||
        moduleSize % 2 === 0 || centroidSize % 2 === 0)
      throw new Error("module and centroid sizes must be odd, with centroid smaller than module");
  }

  function render(canvas, near, far, options) {
    const settings = Object.assign({ moduleSize: 29, centroidSize: 7, border: 4 }, options);
    validate(near, far, settings.moduleSize, settings.centroidSize);
    const count = near.length;
    const size = (count + settings.border * 2) * settings.moduleSize;
    const inset = Math.floor((settings.moduleSize - settings.centroidSize) / 2);
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#f8f8f4";
    context.fillRect(0, 0, size, size);
    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        const x = (column + settings.border) * settings.moduleSize;
        const y = (row + settings.border) * settings.moduleSize;
        context.fillStyle = far[row][column] ? "#161713" : "#f8f8f4";
        context.fillRect(x, y, settings.moduleSize, settings.moduleSize);
        context.fillStyle = near[row][column] ? "#161713" : "#f8f8f4";
        context.fillRect(x + inset, y + inset, settings.centroidSize, settings.centroidSize);
      }
    }
    return Object.assign({ count, size, inset }, settings);
  }

  function sample(canvas, count, options) {
    const settings = Object.assign({ moduleSize: 29, centroidSize: 7, border: 4, aperture: 7 }, options);
    const aperture = Math.max(1, Math.min(settings.moduleSize,
      Math.round(settings.aperture) | 1));
    const offset = Math.floor((settings.moduleSize - aperture) / 2);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const matrix = [];
    for (let row = 0; row < count; row += 1) {
      const values = [];
      for (let column = 0; column < count; column += 1) {
        let luminance = 0;
        let pixels = 0;
        const startX = (column + settings.border) * settings.moduleSize + offset;
        const startY = (row + settings.border) * settings.moduleSize + offset;
        for (let y = 0; y < aperture; y += 1) {
          for (let x = 0; x < aperture; x += 1) {
            const index = ((startY + y) * canvas.width + startX + x) * 4;
            luminance += image[index] * .299 + image[index + 1] * .587 + image[index + 2] * .114;
            pixels += 1;
          }
        }
        values.push(luminance / pixels < 128 ? 1 : 0);
      }
      matrix.push(values);
    }
    return matrix;
  }

  function idealSamples(near, far) {
    if (near.length !== far.length) throw new Error("matrix sizes differ");
    return { near: near.map(row => row.slice()), far: far.map(row => row.slice()) };
  }

  return Object.freeze({ validate, render, sample, idealSamples });
});