(function () {
  "use strict";

  const element = id => document.getElementById(id);

  // Every channel here is a mechanism this site implements, and every detector
  // is a check this site demonstrates. The coverage map is the site's own.
  const CHANNELS = [
    { id: "padding", name: "Pad codewords", exhibit: "01", href: "padding.html",
      caughtBy: ["padding", "regeneration"] },
    { id: "segmentation", name: "Segment mode choice", exhibit: "02", href: "segmentation.html",
      caughtBy: ["segments", "regeneration"] },
    { id: "ecc", name: "Correctable codeword changes", exhibit: "03", href: "ecc.html",
      caughtBy: ["parity", "regeneration"] },
    { id: "modules", name: "Sub-module structure", exhibit: "07", href: "nested.html",
      caughtBy: ["magnification"] },
    { id: "shaped", name: "Distribution-shaped selection", exhibit: "11", href: "distribution.html",
      caughtBy: ["distribution"] }
  ];

  const DETECTORS = [
    { id: "padding", name: "Padding inspection", exhibit: "01",
      weakness: "Reads one layer. Silent on every channel that does not touch the pad bytes." },
    { id: "segments", name: "Segmentation inspection", exhibit: "02",
      weakness: "A non-minimal segmentation is a choice, not proof of intent." },
    { id: "parity", name: "Reed–Solomon parity check", exhibit: "03",
      weakness: "Catches deliberate errors, but ordinary damage produces them too." },
    { id: "magnification", name: "Module magnification", exhibit: "07",
      weakness: "Needs a capture better than the one an ordinary scan provides." },
    { id: "regeneration", name: "Regeneration and compare", exhibit: "08",
      weakness: "Broad, but fires on innocent encoder mismatch. Its reference has to be the issuer's." },
    { id: "distribution", name: "Distribution test", exhibit: "11",
      weakness: "Needs many symbols from one source. Says nothing about any single code." }
  ];

  const POPULATION = 10000;
  const ONE_IN = 1000;

  const selected = () =>
    DETECTORS.filter(d => element(`det-${d.id}`) && element(`det-${d.id}`).checked).map(d => d.id);

  function analyse(running) {
    const covered = [];
    const open = [];
    for (const channel of CHANNELS) {
      (channel.caughtBy.some(id => running.includes(id)) ? covered : open).push(channel);
    }
    return { covered, open, evasion: open[0] || null };
  }

  function renderCoverage(state, running) {
    element("coverageList").innerHTML = CHANNELS.map(channel => {
      const caught = state.covered.includes(channel);
      const chosen = state.evasion === channel;
      return `<li class="${caught ? "covered" : "open"}${chosen ? " chosen" : ""}">
        <span class="coverage-state">${caught ? "COVERED" : "OPEN"}</span>
        <span><strong><a href="${channel.href}">${channel.name}</a></strong>
        <em>exhibit ${channel.exhibit}</em></span>
        <span class="coverage-note">${caught
          ? `caught by ${channel.caughtBy.filter(id => running.includes(id)).map(id => DETECTORS.find(d => d.id === id).name).join(" / ")}`
          : "no selected check looks at this layer"}</span>
      </li>`;
    }).join("");
  }

  function render() {
    const running = selected();
    const state = analyse(running);
    const verdict = element("adversaryVerdict");

    if (!running.length) {
      verdict.textContent = "You are running no checks at all. Every channel on this site is available, and nothing you do will produce an alarm.";
    } else if (state.evasion) {
      verdict.textContent = `You are checking ${running.length} of ${DETECTORS.length} layers. An adversary who has read this page uses ${state.evasion.name.toLowerCase()} instead, from exhibit ${state.evasion.exhibit}. Every check you selected reports clean.`;
    } else {
      verdict.textContent = "Every channel this site implements is covered. That closes the mechanisms demonstrated here — it does not close the ones nobody has published yet.";
    }
    verdict.classList.toggle("flag", Boolean(state.evasion) || !running.length);

    renderCoverage(state, running);

    // The cost of covering everything, in the terms of exhibit 13.
    const perCheck = Number(element("adversaryFp").value) / 100;
    element("adversaryFpValue").textContent = `${(perCheck * 100).toFixed(1)}%`;
    const combined = running.length ? 1 - Math.pow(1 - perCheck, running.length) : 0;
    const hidden = POPULATION / ONE_IN;
    const clean = POPULATION - hidden;
    const truePositive = state.evasion ? 0 : hidden;
    const falsePositive = Math.round(clean * combined);
    const alarms = truePositive + falsePositive;

    element("adversaryChecks").textContent = String(running.length);
    element("adversaryAlarms").textContent = alarms.toLocaleString("en-US");
    element("adversaryReal").textContent = String(Math.round(truePositive));
    element("adversaryPrecision").textContent = alarms
      ? `${(truePositive / alarms * 100).toFixed(1)}%`
      : "no alarms";

    element("adversaryCost").textContent = running.length
      ? `${running.length} independent ${running.length === 1 ? "check" : "checks"} at ${(perCheck * 100).toFixed(1)}% each fire on about ${(combined * 100).toFixed(1)}% of clean symbols, which is ${falsePositive.toLocaleString("en-US")} false alarms in ${POPULATION.toLocaleString("en-US")}. Adding checks to close a gap raises this every time.`
      : "Running nothing costs nothing and finds nothing.";

    element("adversaryOutcome").textContent = state.evasion
      ? `Of ${alarms.toLocaleString("en-US")} alarms, none is the hidden symbol. The work is real; the result is not.`
      : running.length
        ? `Of ${alarms.toLocaleString("en-US")} alarms, ${Math.round(truePositive)} are real. Closing every gap does not make the false alarms go away.`
        : "Nothing to report.";
  }

  function build() {
    element("detectorRack").innerHTML = DETECTORS.map(d =>
      `<label class="detector"><input type="checkbox" id="det-${d.id}"${d.id === "padding" || d.id === "parity" ? " checked" : ""}>
        <span><strong>${d.name}</strong><em>exhibit ${d.exhibit}</em>
        <span class="detector-weakness">${d.weakness}</span></span></label>`).join("");
    DETECTORS.forEach(d => element(`det-${d.id}`).addEventListener("change", render));
    element("adversaryFp").addEventListener("input", render);
    element("adversaryForm").addEventListener("submit", event => event.preventDefault());
    render();
  }

  build();
  window.HideAndSeenAdversary = Object.freeze({ CHANNELS, DETECTORS, analyse });
})();
