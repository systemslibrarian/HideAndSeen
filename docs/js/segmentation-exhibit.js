(function () {
  "use strict";

  const element = id => document.getElementById(id);
  let variants = [];

  function sequence(segments) {
    return segments.map(segment => `${segment.mode.toUpperCase()}(${JSON.stringify(segment.text)})`).join("  +  ");
  }

  function renderSelected() {
    const bits = element("hiddenBits").value;
    const selected = variants.find(variant => variant.bits === bits);
    if (!selected) return;
    HideAndSeenRender.draw(element("selectedQr"), selected.symbol.matrix, { size: 340 });
    element("selectedCaption").textContent = `${selected.name} / ${selected.bitLength} data bits / v${selected.version}-${selected.symbol.ecc}`;
    element("segmentOvert").textContent = selected.symbol.text;
    element("segmentSequence").textContent = sequence(selected.segments);
    element("segmentHidden").textContent = `${selected.bits} (recovered from representation ${variants.indexOf(selected)})`;
    const efficient = variants[0].bitLength;
    const overhead = selected.bitLength - efficient;
    element("segmentDetect").textContent = overhead === 0
      ? "This is the lowest-bit representation found by the exhibit optimizer."
      : `${overhead} bits above the efficient representation; a segment inspector can see the extra framing.`;
    document.querySelectorAll("[data-variant]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.variant === bits));
    });
  }

  function renderList() {
    const list = element("representationList");
    list.replaceChildren();
    variants.forEach(variant => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "representation-row";
      row.dataset.variant = variant.bits;
      row.setAttribute("aria-pressed", String(variant.bits === element("hiddenBits").value));
      row.innerHTML = `<span class="representation-bits">${variant.bits}</span><span><strong>${variant.name}</strong><small>${sequence(variant.segments)}</small></span><span class="representation-cost">${variant.bitLength} bits</span>`;
      row.addEventListener("click", () => {
        element("hiddenBits").value = variant.bits;
        renderSelected();
      });
      list.appendChild(row);
    });
  }

  function build(event) {
    if (event) event.preventDefault();
    const text = element("segmentText").value;
    const ecc = element("segmentEcc").value;
    try {
      variants = HideAndSeenSegments.variants(text, ecc);
      renderList();
      renderSelected();
    } catch (error) {
      element("segmentSequence").textContent = error.message;
      element("representationList").replaceChildren();
    }
  }

  element("segmentBuilder").addEventListener("submit", build);
  element("hiddenBits").addEventListener("change", renderSelected);
  build();
})();
