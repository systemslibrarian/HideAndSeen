(function () {
  "use strict";

  const element = id => document.getElementById(id);
  let state = null;

  function textMask(text) {
    const width = 64;
    const height = 18;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "black";
    context.font = "bold 14px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text.toUpperCase(), width / 2, height / 2, width - 2);
    const pixels = context.getImageData(0, 0, width, height).data;
    return Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, column) =>
        pixels[(row * width + column) * 4] < 128 ? 1 : 0));
  }

  function drawBits(canvas, mask, width) {
    const scale = Math.max(1, Math.floor(width / mask[0].length));
    canvas.width = mask[0].length * scale;
    canvas.height = mask.length * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = "auto";
    const context = canvas.getContext("2d");
    context.fillStyle = "#f8f8f4";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#161713";
    mask.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
      if (value) context.fillRect(columnIndex * scale, rowIndex * scale, scale, scale);
    }));
  }

  function extracted(symbol) {
    const bytes = QR.revealBytes(symbol);
    if (!bytes) throw new Error("no share found in QR padding");
    return HideAndSeenVss.decodeShare(bytes);
  }

  function inspect(which) {
    const symbol = which === "a" ? state.symbolA : state.symbolB;
    const share = extracted(symbol);
    const mask = HideAndSeenVss.unpack(share.bytes, share.width, share.height);
    drawBits(element(which === "a" ? "extractedA" : "extractedB"), mask, 384);
    const report = QR.inspect(symbol);
    element(which === "a" ? "vssOutputA" : "vssOutputB").textContent =
      `${share.bytes.length} shadow bytes extracted; ${report.deviating.length}/${report.total} pad bytes differ from the standard pattern.`;
  }

  function scan(which) {
    const matrix = which === "a" ? state.symbolA.matrix : state.symbolB.matrix;
    const decoded = HideAndSeenDecoder.decodeMatrix(matrix);
    element(which === "a" ? "vssScanA" : "vssScanB").textContent = decoded || "Independent decode failed";
    element(which === "a" ? "vssOutputA" : "vssOutputB").textContent = decoded || "Independent decode failed";
  }

  function combine() {
    const first = QR.revealBytes(state.symbolA);
    const second = QR.revealBytes(state.symbolB);
    const result = HideAndSeenVss.combine(first, second);
    drawBits(element("recoveredSecret"), result.mask, 768);
    const exact = result.bytes.length === state.secret.bytes.length &&
      result.bytes.every((value, index) => value === state.secret.bytes[index]);
    element("recoveredCaption").textContent = exact
      ? `RECOVERED EXACTLY / ${state.label}` : "RECOVERY MISMATCH";
    element("vssShadowStatus").textContent = exact
      ? `Neither extracted shadow matches the secret; XOR of both restores ${state.label}.`
      : "The shares did not reconstruct correctly.";
    inspect("a");
    inspect("b");
  }

  function build(event) {
    if (event) event.preventDefault();
    try {
      const label = element("sharingText").value.trim().toUpperCase() || "SEEN";
      const secretMask = textMask(label);
      const shares = HideAndSeenVss.create(secretMask);
      const payloadA = HideAndSeenVss.encodeShare(shares.width, shares.height, shares.first);
      const payloadB = HideAndSeenVss.encodeShare(shares.width, shares.height, shares.second);
      const overtA = element("publicA").value || "PUBLIC SHARE A";
      const overtB = element("publicB").value || "PUBLIC SHARE B";
      const need = Math.max(payloadA.length, payloadB.length) + QR.MAGIC.length + 1;
      const version = Math.max(QR.chooseVersion(overtA, "M", need), QR.chooseVersion(overtB, "M", need));
      const symbolA = QR.build(overtA, { ecc: "M", version, secretBytes: payloadA });
      const symbolB = QR.build(overtB, { ecc: "M", version, secretBytes: payloadB });
      state = { label, secret: HideAndSeenVss.pack(secretMask), symbolA, symbolB };
      HideAndSeenRender.draw(element("vssQrA"), symbolA.matrix, { size: 320 });
      HideAndSeenRender.draw(element("vssQrB"), symbolB.matrix, { size: 320 });
      element("vssCaptionA").textContent = `QR SHADOW A / v${version}-M / ${payloadA.length} hidden bytes`;
      element("vssCaptionB").textContent = `QR SHADOW B / v${version}-M / ${payloadB.length} hidden bytes`;
      element("vssScanA").textContent = "Not scanned";
      element("vssScanB").textContent = "Not scanned";
      element("vssOutputA").textContent = "Not read";
      element("vssOutputB").textContent = "Not read";
      element("recoveredCaption").textContent = "WAITING FOR BOTH SHARES";
      element("vssDetection").textContent = `A: ${QR.inspect(symbolA).deviating.length} altered pad bytes; B: ${QR.inspect(symbolB).deviating.length} altered pad bytes.`;
      const blank = Array.from({ length: shares.height }, () => new Array(shares.width).fill(0));
      drawBits(element("extractedA"), blank, 384);
      drawBits(element("extractedB"), blank, 384);
      drawBits(element("recoveredSecret"), blank, 768);
    } catch (error) {
      element("vssShadowStatus").textContent = error.message;
      element("vssShadowStatus").className = "flag";
    }
  }

  document.querySelectorAll("[data-vss-action]").forEach(button => {
    button.addEventListener("click", () => {
      const [action, which] = button.dataset.vssAction.split("-");
      if (action === "scan") scan(which);
      else inspect(which);
    });
  });
  element("combineShares").addEventListener("click", combine);
  element("sharingBuilder").addEventListener("submit", build);
  build();
})();
