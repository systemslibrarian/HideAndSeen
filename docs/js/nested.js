(function () {
  "use strict";

  const element = id => document.getElementById(id);
  let state = null;

  function geometry() {
    const [moduleSize, centroidSize] = element("dualGeometry").value.split(",").map(Number);
    return { moduleSize, centroidSize, border: 4 };
  }

  function build(event) {
    if (event) event.preventDefault();
    try {
      const nearText = element("dualNear").value || "Near view is less";
      const farText = element("dualFar").value || "Far view is more";
      const first = QR.build(nearText, { ecc: "L" });
      const second = QR.build(farText, { ecc: "L" });
      const version = Math.max(first.version, second.version);
      const near = QR.build(nearText, { ecc: "L", version });
      const far = QR.build(farText, { ecc: "L", version });
      const settings = geometry();
      const render = HideAndSeenDualMessage.render(element("dualComposite"), near.matrix, far.matrix, settings);
      state = { near, far, settings, render };
      element("dualAperture").min = settings.centroidSize;
      element("dualAperture").max = settings.moduleSize;
      element("dualAperture").step = 2;
      element("dualAperture").value = settings.centroidSize;
      element("dualCaption").textContent = `DUAL QR / v${version}-L / m ${settings.moduleSize} / omega ${settings.centroidSize}`;
      element("dualNearOut").textContent = HideAndSeenDecoder.decodeMatrix(near.matrix) || "target decode failed";
      element("dualFarOut").textContent = HideAndSeenDecoder.decodeMatrix(far.matrix) || "target decode failed";
      element("dualStructure").textContent = `${near.matrix.length ** 2} two-state modules; center ${settings.centroidSize} x ${settings.centroidSize}px, outer field ${settings.moduleSize} x ${settings.moduleSize}px.`;
      sample();
    } catch (error) {
      element("dualDecoded").textContent = error.message;
      element("dualDecoded").className = "flag";
    }
  }

  function sample() {
    if (!state) return;
    const aperture = Number(element("dualAperture").value);
    const matrix = HideAndSeenDualMessage.sample(element("dualComposite"), state.near.matrix.length,
      Object.assign({}, state.settings, { aperture }));
    HideAndSeenRender.draw(element("dualSampled"), matrix, { size: 320 });
    const decoded = HideAndSeenDecoder.decodeMatrix(matrix);
    const nearEnd = state.settings.centroidSize;
    const farStart = Math.ceil(Math.sqrt(2) * state.settings.centroidSize);
    const region = aperture <= nearEnd ? "near" : aperture >= farStart ? "far-dominant" : "transition";
    element("dualApertureValue").textContent = `${aperture} x ${aperture} px / ${region}`;
    element("dualSampledCaption").textContent = `SAMPLED MATRIX / ${region.toUpperCase()}`;
    element("dualDecoded").textContent = decoded || "No valid QR at this transition aperture";
    element("dualDecoded").className = decoded ? "" : "flag";
  }

  document.querySelectorAll("[data-dual-view]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.dualView === "near") {
        element("dualAperture").value = state.settings.centroidSize;
        sample();
      } else if (button.dataset.dualView === "far") {
        element("dualAperture").value = state.settings.moduleSize;
        sample();
      } else {
        HideAndSeenDualMessage.render(element("dualComposite"), state.near.matrix, state.far.matrix, state.settings);
      }
    });
  });
  element("dualAperture").addEventListener("input", sample);
  element("dualBuilder").addEventListener("submit", build);
  element("dualGeometry").addEventListener("change", build);
  element("saveDual").addEventListener("click", () => HideAndSeenRender.save(element("dualComposite"), "hideandseen-dual-message.png"));
  build();
})();
