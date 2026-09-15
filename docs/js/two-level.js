(function () {
  "use strict";

  const element = id => document.getElementById(id);
  let symbol = null;
  let texture = null;

  function renderTexture() {
    const canvas = element("textureQr");
    const detail = Number(element("textureDetail").value) / 100;
    const blur = Number(element("textureBlur").value);
    const zoom = Number(element("textureZoom").value);
    const moduleSize = 12;
    const border = 4;
    const size = (symbol.matrix.length + border * 2) * moduleSize;
    const offscreen = document.createElement("canvas");
    offscreen.width = size;
    offscreen.height = size;
    const context = offscreen.getContext("2d");
    context.fillStyle = "#f8f8f4";
    context.fillRect(0, 0, size, size);
    context.fillStyle = "#161713";
    for (let row = 0; row < symbol.matrix.length; row += 1) {
      for (let column = 0; column < symbol.matrix.length; column += 1) {
        if (symbol.matrix[row][column])
          context.fillRect((column + border) * moduleSize, (row + border) * moduleSize, moduleSize, moduleSize);
      }
    }
    const markMap = new Map(texture.marks.map(mark => [`${mark.row}:${mark.column}`, mark.bit]));
    const notch = Math.max(1, Math.round(moduleSize * .34 * detail));
    if (notch > 0) {
      context.fillStyle = "#f8f8f4";
      markMap.forEach((bit, key) => {
        const [row, column] = key.split(":").map(Number);
        const x = (column + border) * moduleSize + (bit ? moduleSize - notch - 1 : 1);
        const y = (row + border) * moduleSize + (bit ? moduleSize - notch - 1 : 1);
        context.fillRect(x, y, notch, notch);
      });
    }
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${Math.round(560 * zoom / 100)}px`;
    canvas.style.height = "auto";
    const output = canvas.getContext("2d");
    output.clearRect(0, 0, size, size);
    output.filter = `blur(${blur}px)`;
    output.drawImage(offscreen, 0, 0);
    output.filter = "none";

    const readability = detail >= .45 && blur <= 2.5;
    element("textureZoomValue").textContent = `${zoom}%`;
    element("textureDetailValue").textContent = `${Math.round(detail * 100)}%`;
    element("textureBlurValue").textContent = `${blur} px`;
    element("textureScan").textContent = `${symbol.text} (macro-matrix simulation)`;
    element("textureChanged").textContent = `${texture.marks.length} dark data modules contain one of two equal-area notch positions.`;
    element("textureReveal").textContent = readability ? texture.recovered : "Fine pattern below the simulated reader threshold";
    element("textureReveal").className = readability ? "" : "flag";
    element("textureDetect").textContent = detail > 20
      ? "Repeated high-frequency structure appears inside nominally solid modules."
      : "Downsampling suppresses the texture; inspect the original at higher resolution.";
  }

  function build(event) {
    if (event) event.preventDefault();
    try {
      symbol = QR.build(element("textureOvert").value || "TWO LEVEL", { ecc: "M" });
      texture = HideAndSeenVisualModels.texture(symbol, element("textureSecret").value || "SEEN");
      renderTexture();
    } catch (error) {
      element("textureReveal").textContent = error.message;
      element("textureReveal").className = "flag";
    }
  }

  for (const id of ["textureZoom", "textureDetail", "textureBlur"])
    element(id).addEventListener("input", renderTexture);
  document.querySelectorAll("[data-texture-view]").forEach(button => {
    button.addEventListener("click", () => {
      const microscopic = button.dataset.textureView === "microscopic";
      element("textureDetail").value = microscopic ? 100 : 0;
      element("textureZoom").value = microscopic ? 115 : 65;
      renderTexture();
      document.querySelectorAll("[data-texture-view]").forEach(control =>
        control.setAttribute("aria-pressed", String(control === button)));
    });
  });
  element("textureBuilder").addEventListener("submit", build);
  build();
})();
