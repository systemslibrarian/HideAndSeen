(function () {
  "use strict";

  const element = id => document.getElementById(id);
  let symbol = null;
  let placement = "spread";

  const placementNotes = {
    spread: "The same number of altered codewords is distributed round-robin across Reed-Solomon blocks.",
    concentrate: "The same number of altered codewords is placed into one Reed-Solomon block first.",
    region: "Data codewords are selected from the lower-right encoding region, following Wan et al.'s spatial embedding rule."
  };

  function render() {
    const intentional = Number(element("intentional").value);
    const noise = Number(element("noise").value);
    const result = HideAndSeenEcc.mutate(symbol, intentional, noise,
      element("eccBits").value, placement);
    const decoded = HideAndSeenDecoder.decodeMatrix(result.matrix);
    element("intentionalValue").textContent = intentional;
    element("noiseValue").textContent = noise;
    HideAndSeenRender.draw(element("eccOriginal"), symbol.matrix, { size: 330 });
    HideAndSeenRender.draw(element("eccModified"), result.matrix, {
      size: 330,
      highlights: result.changes
    });
    element("eccModifiedCaption").textContent = `MODIFIED / ${result.changes.length} codeword errors`;

    const used = result.errorsByBlock.reduce((sum, count) => sum + count, 0);
    const percentage = Math.min(100, used / Math.max(1, result.correctionCapacity) * 100);
    element("budgetText").textContent = `${used} used / ${result.correctionCapacity} correctable across ${result.capacities.length} block${result.capacities.length === 1 ? "" : "s"}`;
    element("budgetUsed").style.width = `${percentage}%`;
    element("budgetUsed").className = result.predictedCorrectable ? "" : "over";
    element("blockBudget").textContent = result.errorsByBlock.map((count, block) =>
      `block ${block + 1}: ${count}/${result.capacities[block]}`).join("  |  ");

    element("eccDecode").textContent = decoded === null ? "ZXing could not decode the modified symbol" : decoded;
    element("eccDecode").className = decoded === symbol.text ? "" : "flag";
    const peak = Math.max(...result.errorsByBlock);
    const peakBlock = result.errorsByBlock.indexOf(peak);
    element("eccChanged").textContent = `${intentional} controlled codeword changes + ${noise} simulated damage changes using ${placement}; most-loaded block ${peakBlock + 1} has ${peak}/${result.capacities[peakBlock]} errors, ${result.predictedCorrectable ? "within" : "beyond"} its algebraic limit`;
    element("eccHidden").textContent = result.hidden || "No intentional hidden bits selected";
    element("eccDetect").textContent = result.changes.length
      ? `${result.changes.length} module differences appear against the original matrix; correction syndromes would also be non-zero before repair.`
      : "No differences from the original symbol.";
    element("placementNote").textContent = placementNotes[placement];
    document.querySelectorAll("[data-placement]").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.placement === placement)));
  }

  function build(event) {
    if (event) event.preventDefault();
    try {
      symbol = QR.build(element("eccText").value || "ECC LAB", {
        ecc: element("eccLevel").value,
        version: Number(element("eccVersion").value)
      });
      const plan = HideAndSeenEcc.targetPlan(symbol, placement);
      const capacity = plan.capacities.reduce((sum, count) => sum + count, 0);
      const maximum = Math.min(plan.targets.length, capacity + Math.max(8, plan.capacities.length * 3));
      element("intentional").max = Math.min(32, maximum);
      element("noise").max = Math.min(24, maximum);
      if (Number(element("intentional").value) > Number(element("intentional").max))
        element("intentional").value = element("intentional").max;
      render();
    } catch (error) {
      element("eccDecode").textContent = error.message;
      element("eccDecode").className = "flag";
    }
  }

  element("eccBuilder").addEventListener("submit", build);
  for (const id of ["intentional", "noise", "eccBits"])
    element(id).addEventListener("input", render);
  element("breakIt").addEventListener("click", () => {
    const plan = HideAndSeenEcc.concentratedTargets(symbol);
    placement = "concentrate";
    element("intentional").value = Math.min(Number(element("intentional").max), plan.capacities[0] + 3);
    element("noise").value = 0;
    render();
  });
  document.querySelectorAll("[data-placement]").forEach(button => {
    button.addEventListener("click", () => {
      placement = button.dataset.placement;
      render();
    });
  });
  build();
})();
