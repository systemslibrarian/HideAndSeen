(function () {
  "use strict";

  const element = id => document.getElementById(id);
  let state = null;

  function describeSegments(segments) {
    return segments.map(segment => `${segment.mode}(${JSON.stringify(segment.text)})`).join(" + ");
  }

  function show(reader) {
    if (!state) return;
    const normal = reader === "normal" || reader === "all";
    const channelA = reader === "a" || reader === "all";
    const channelB = reader === "b" || reader === "all";
    const inspect = reader === "all";
    element("multiOvert").textContent = normal
      ? (state.decoded || "Independent decoder could not recover the overt message")
      : "Not read";
    element("multiAOut").textContent = channelA
      ? `${state.variant.bits} / ${state.variant.name}` : "Not read";
    element("multiBOut").textContent = channelB
      ? state.mutation.hidden : "Not read";
    element("multiInspect").textContent = inspect
      ? `${describeSegments(state.variant.segments)}; ${state.mutation.changes.length} changed codewords; ` +
        `${state.mutation.predictedCorrectable ? "inside" : "outside"} the correction bound`
      : "Not inspected";
    HideAndSeenRender.draw(element("multiQr"), state.mutation.matrix, {
      size: 380,
      highlights: inspect ? state.mutation.changes : null
    });
    document.querySelectorAll("[data-reader]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.reader === reader));
    });
  }

  function build(event) {
    if (event) event.preventDefault();
    const text = element("multiText").value;
    const variants = HideAndSeenSegments.variants(text, "M");
    const variant = variants.find(item => item.bits === element("multiA").value);
    const requested = element("multiB").value.replace(/[^01]/g, "").slice(0, 16);
    const plan = HideAndSeenEcc.orderedTargets(variant.symbol);
    const capacity = plan.capacities.reduce((sum, count) => sum + count, 0);
    const hidden = requested.slice(0, capacity);
    const mutation = HideAndSeenEcc.mutate(variant.symbol, hidden.length, 0, hidden);
    state = {
      variant,
      mutation,
      decoded: HideAndSeenDecoder.decodeMatrix(mutation.matrix)
    };
    element("multiCaption").textContent = `v${variant.symbol.version}-${variant.symbol.ecc} / channel A ${variant.bits} / channel B ${hidden.length} bits`;
    show("normal");
  }

  document.querySelectorAll("[data-reader]").forEach(button => {
    button.addEventListener("click", () => show(button.dataset.reader));
  });
  element("multiBuilder").addEventListener("submit", build);
  build();
})();
