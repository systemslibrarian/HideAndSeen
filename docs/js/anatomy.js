(function () {
  "use strict";

  const layers = [
    ["all", "Whole symbol", "Every dark and light module participates in the image a scanner samples. Select a layer to isolate its job."],
    ["finder", "Finder patterns", "Three large targets establish position, orientation, and module scale."],
    ["separator", "Separators", "A one-module light border keeps each finder pattern distinct from nearby data."],
    ["timing", "Timing patterns", "Alternating modules establish the row and column grid between finder patterns."],
    ["alignment", "Alignment patterns", "Smaller targets compensate for perspective and distortion in larger versions."],
    ["format", "Format information", "Two copies encode the error-correction level and selected mask pattern."],
    ["version", "Version information", "Versions 7 and above carry an 18-bit version identifier in two places."],
    ["data", "Payload and framing", "Mode, character count, payload, and byte-boundary bits form the data stream a normal reader interprets."],
    ["error-correction", "Reed-Solomon correction", "These modules carry parity codewords computed from each data block. They let a decoder repair symbol errors."],
    ["mask", "Mask operation", "The highlighted data-bearing modules were inverted by this symbol's selected mask formula before rendering."],
    ["terminator", "Terminator", "Up to four zero bits mark the end of the overt segment stream."],
    ["padding", "Pad codewords", "Alternating 0xEC and 0x11 codewords fill unused data capacity after framing ends."]
  ];
  const aggregateDataRoles = new Set(["mode", "count", "payload", "zero-fill"]);
  const element = id => document.getElementById(id);
  let symbol = null;
  let selected = "all";

  function matches(info, layer) {
    if (layer === "mask") return Boolean(info.maskFlips);
    if (layer === "data") return aggregateDataRoles.has(info.role);
    return info.role === layer;
  }

  function pointsFor(layer) {
    if (layer === "all") return [];
    const points = [];
    symbol.moduleMap.forEach((row, rowIndex) => row.forEach((info, columnIndex) => {
      if (matches(info, layer)) points.push({ row: rowIndex, column: columnIndex });
    }));
    return points;
  }

  function renderLayer(layer) {
    selected = layer;
    const points = pointsFor(layer);
    HideAndSeenRender.draw(element("anatomyQr"), symbol.matrix, {
      size: 520,
      dim: layer !== "all",
      highlights: points
    });
    const definition = layers.find(item => item[0] === layer);
    element("layerLabel").textContent = layer === "all" ? "WHOLE SYMBOL" : "SELECTED LAYER";
    element("layerTitle").textContent = definition[1];
    element("layerDescription").textContent = definition[2];
    element("metaCount").textContent = layer === "all" ? `${symbol.matrix.length ** 2} modules` : `${points.length} modules`;
    document.querySelectorAll("[data-layer]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.layer === layer));
    });
  }

  function build(event) {
    if (event) event.preventDefault();
    const text = element("anatomyText").value || "QR ANATOMY";
    const ecc = element("anatomyEcc").value;
    const value = element("anatomyVersion").value;
    const options = { ecc };
    if (value !== "auto") options.version = Number(value);
    try {
      symbol = QR.build(text, options);
      element("metaVersion").textContent = symbol.version;
      element("metaEcc").textContent = symbol.ecc;
      element("metaMask").textContent = symbol.mask;
      element("anatomyCaption").textContent = `v${symbol.version}-${symbol.ecc} / ${symbol.matrix.length} x ${symbol.matrix.length} modules`;
      renderLayer(selected);
    } catch (error) {
      element("layerDescription").textContent = `${error.message}. Choose a larger version or lower ECC level.`;
    }
  }

  const controls = element("overlayControls");
  for (const [id, title] of layers) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.layer = id;
    button.textContent = title;
    button.setAttribute("aria-pressed", String(id === selected));
    button.addEventListener("click", () => renderLayer(id));
    controls.appendChild(button);
  }
  element("anatomyBuilder").addEventListener("submit", build);
  build();
})();
