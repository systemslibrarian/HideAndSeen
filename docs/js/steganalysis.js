(function () {
  "use strict";

  const element = id => document.getElementById(id);
  let scenarios = {};
  let selected = "encoder";

  function differenceMatrix(size, differences) {
    const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
    for (const point of differences) matrix[point.row][point.column] = 1;
    return matrix;
  }

  function build(event) {
    if (event) event.preventDefault();
    const text = element("regenText").value || "https://example.com";
    const reference = HideAndSeenEncoders.hideAndSeen(text, { ecc: "M" });
    const baseline = HideAndSeenEncoders.hideAndSeen(text, {
      ecc: reference.ecc, version: reference.version, mask: reference.mask
    });
    const hiddenAuto = HideAndSeenEncoders.hideAndSeen(text, {
      ecc: reference.ecc, version: reference.version + 1, secret: "MEET AT 7"
    });
    const hiddenReference = HideAndSeenEncoders.hideAndSeen(text, {
      ecc: hiddenAuto.ecc, version: hiddenAuto.version, mask: hiddenAuto.mask
    });
    const innocentOther = HideAndSeenEncoders.nodeQrcode(text, {
      errorCorrectionLevel: reference.ecc
    });
    scenarios = {
      baseline: {
        received: baseline, reference,
        label: "Same encoder, no hidden data",
        finding: "The regenerated symbol matches exactly. The comparison reports no anomaly.",
        truth: "CLEAN"
      },
      hidden: {
        received: hiddenAuto, reference: hiddenReference,
        label: "Same encoder, padding replaced",
        finding: "The comparison highlights the changed data and parity modules. Here the alert corresponds to hidden padding data.",
        truth: "HIDDEN DATA PRESENT"
      },
      encoder: {
        received: innocentOther, reference,
        label: "Different honest encoder, no hidden data",
        finding: "The naive detector sees differences and raises an alert, but this received symbol contains no hidden payload. Default segmentation and mask behavior caused the mismatch. When those choices are forced equal for a byte-only payload, these two implementations converge exactly.",
        truth: "CLEAN / FALSE POSITIVE"
      }
    };
    render();
  }

  function render() {
    const scenario = scenarios[selected];
    const comparison = HideAndSeenEncoders.compare(scenario.received, scenario.reference);
    const decoded = HideAndSeenDecoder.decodeMatrix(scenario.received.matrix);
    HideAndSeenRender.draw(element("receivedQr"), scenario.received.matrix, { size: 300 });
    HideAndSeenRender.draw(element("referenceQr"), scenario.reference.matrix, { size: 300 });
    const diffMatrix = differenceMatrix(scenario.received.matrix.length, comparison.differences);
    HideAndSeenRender.draw(element("differenceQr"), diffMatrix, { size: 300 });
    element("receivedCaption").textContent = `RECEIVED / ${scenario.received.encoder} / v${scenario.received.version}-${scenario.received.ecc} / mask ${scenario.received.mask}`;
    element("referenceCaption").textContent = `REGENERATED / ${scenario.reference.encoder} / v${scenario.reference.version}-${scenario.reference.ecc} / mask ${scenario.reference.mask}`;
    element("differenceCaption").textContent = comparison.comparable
      ? `DIFFERENCE MAP / ${comparison.count} modules`
      : `DIFFERENCE MAP / ${comparison.reason}`;
    element("regenDecoded").textContent = decoded || "decode failed";
    element("regenReference").textContent = scenario.label;
    element("regenDiff").textContent = !comparison.comparable
      ? `${comparison.reason}: visible mismatch`
      : comparison.count === 0
        ? "0 module differences" : `${comparison.count} module differences: naive alert`;
    element("regenVerdict").textContent = scenario.truth;
    element("regenVerdict").className = selected === "hidden" || selected === "encoder" ? "flag" : "";
    element("regenFinding").textContent = scenario.finding;
    document.querySelectorAll("[data-scenario]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.scenario === selected));
    });
  }

  document.querySelectorAll("[data-scenario]").forEach(button => {
    button.addEventListener("click", () => {
      selected = button.dataset.scenario;
      render();
    });
  });
  element("regenBuilder").addEventListener("submit", build);
  build();
})();
