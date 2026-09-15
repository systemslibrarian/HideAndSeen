(function () {
  "use strict";

  const element = id => document.getElementById(id);
  const eccNames = "LMQH";

  function hex(values, limit) {
    return values.slice(0, limit).map(value => value.toString(16).toUpperCase().padStart(2, "0")).join(" ") +
      (values.length > limit ? " ..." : "");
  }

  function segmentText(segments) {
    return segments.map(segment => `${segment.mode}(${segment.count})`).join(" + ");
  }

  function row(label, first, second) {
    return `<div class="comparison-row"><strong>${label}</strong><code>${first}</code><code>${second}</code></div>`;
  }

  async function profiles() {
    const response = await fetch("../data/attribution.json");
    const data = await response.json();
    const grouped = new Map();
    for (const sample of data.samples) {
      if (!grouped.has(sample.encoder)) grouped.set(sample.encoder, []);
      grouped.get(sample.encoder).push(sample);
    }
    const body = element("profileTable").querySelector("tbody");
    body.replaceChildren();
    for (const encoder of data.result.libraries) {
      const samples = grouped.get(encoder);
      const values = key => Array.from(new Set(samples.map(sample => sample.features[key]))).sort((a, b) => a - b).join(", ");
      const zeroRate = samples.filter(sample => sample.features.pad0 === 1).length / samples.length;
      const tr = document.createElement("tr");
      tr.innerHTML = `<th>${encoder}</th><td>${values("version")}</td><td>${Array.from(new Set(samples.map(sample => eccNames[sample.features.ecc] || "micro"))).join(", ")}</td><td>${values("mask")}</td><td>${values("segments")}</td><td>${Math.round(zeroRate * 100)}%</td>`;
      body.appendChild(tr);
    }
  }

  function build(event) {
    if (event) event.preventDefault();
    const text = element("fingerprintText").value || "https://example.com";
    const first = HideAndSeenEncoders.hideAndSeen(text, { ecc: "M" });
    const second = HideAndSeenEncoders.nodeQrcode(text, { errorCorrectionLevel: "M" });
    const inspectedFirst = HideAndSeenInspect.inspect(first.matrix, first.version, first.ecc, first.mask);
    const inspectedSecond = HideAndSeenInspect.inspect(second.matrix, second.version, second.ecc, second.mask);
    HideAndSeenRender.draw(element("fingerprintA"), first.matrix, { size: 300 });
    HideAndSeenRender.draw(element("fingerprintB"), second.matrix, { size: 300 });
    const comparison = HideAndSeenEncoders.compare(first, second);
    if (comparison.comparable) {
      const diff = Array.from({ length: first.matrix.length }, () => new Array(first.matrix.length).fill(0));
      comparison.differences.forEach(point => { diff[point.row][point.column] = 1; });
      HideAndSeenRender.draw(element("fingerprintDiff"), diff, { size: 300 });
      element("fingerprintDiffCaption").textContent = `${comparison.count} MODULE DIFFERENCES`;
    } else {
      HideAndSeenRender.draw(element("fingerprintDiff"), [[0]], { size: 300 });
      element("fingerprintDiffCaption").textContent = comparison.reason.toUpperCase();
    }
    element("fingerprintTable").innerHTML =
      `<div class="comparison-row comparison-head"><strong>FIELD</strong><strong>HIDEANDSEEN</strong><strong>NODE-QRCODE</strong></div>` +
      row("ordinary decode", HideAndSeenDecoder.decodeMatrix(first.matrix), HideAndSeenDecoder.decodeMatrix(second.matrix)) +
      row("version", first.version, second.version) + row("ECC", first.ecc, second.ecc) +
      row("mask", first.mask, second.mask) +
      row("segments", segmentText(inspectedFirst.segments), segmentText(inspectedSecond.segments)) +
      row("padding", `${inspectedFirst.padding.length} bytes`, `${inspectedSecond.padding.length} bytes`) +
      row("padding head", hex(inspectedFirst.padding, 10) || "none", hex(inspectedSecond.padding, 10) || "none") +
      row("data codewords", hex(inspectedFirst.dataCodewords, 18), hex(inspectedSecond.dataCodewords, 18));
  }

  element("fingerprintBuilder").addEventListener("submit", build);
  build();
  profiles().catch(error => {
    element("profileTable").querySelector("tbody").innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
  });
})();
