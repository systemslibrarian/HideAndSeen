(function (root) {
  "use strict";

  function palette() {
    const style = getComputedStyle(document.documentElement);
    return {
      light: style.getPropertyValue("--paper-bright").trim() || "#f8f8f4",
      dark: style.getPropertyValue("--ink").trim() || "#161713",
      accent: style.getPropertyValue("--accent").trim() || "#ad2c22",
      muted: style.getPropertyValue("--rule-dark").trim() || "#8e9288"
    };
  }

  function draw(canvas, matrix, options) {
    const settings = Object.assign({ size: canvas.width || 280, border: 4, highlights: null, dim: false }, options);
    const count = matrix.length;
    const total = count + settings.border * 2;
    const scale = Math.max(1, Math.floor(settings.size / total));
    const dimension = total * scale;
    const colors = palette();
    canvas.width = dimension;
    canvas.height = dimension;
    canvas.style.width = `${settings.size}px`;
    canvas.style.height = `${settings.size}px`;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.fillStyle = colors.light;
    context.fillRect(0, 0, dimension, dimension);
    context.fillStyle = settings.dim ? colors.muted : colors.dark;
    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (matrix[row][column]) {
          context.fillRect((column + settings.border) * scale, (row + settings.border) * scale, scale, scale);
        }
      }
    }
    if (settings.highlights) {
      for (const point of settings.highlights) {
        context.fillStyle = point.color || colors.accent;
        context.globalAlpha = point.alpha === undefined ? .82 : point.alpha;
        context.fillRect((point.column + settings.border) * scale, (point.row + settings.border) * scale, scale, scale);
      }
      context.globalAlpha = 1;
    }
    return { scale, dimension };
  }

  function diff(first, second) {
    if (first.length !== second.length) return [];
    const points = [];
    for (let row = 0; row < first.length; row += 1) {
      for (let column = 0; column < first.length; column += 1) {
        if (first[row][column] !== second[row][column]) points.push({ row, column });
      }
    }
    return points;
  }

  function save(canvas, filename) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  root.HideAndSeenRender = Object.freeze({ draw, diff, save, palette });
})(typeof self !== "undefined" ? self : this);
