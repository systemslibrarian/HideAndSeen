(function () {
  "use strict";

  const element = id => document.getElementById(id);

  // One dot per symbol in the grid below, so the population has to stay square.
  const POPULATION = 10000;
  const COLUMNS = 100;
  const PREVALENCES = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];

  const COLOURS = {
    truePositive: "#161713",
    falseNegative: "#8e9288",
    falsePositive: "#ad2c22",
    trueNegative: "#dfe1da"
  };

  const count = value => value.toLocaleString("en-US");

  function readControls() {
    return {
      oneIn: PREVALENCES[Number(element("brPrevalence").value)],
      sensitivity: Number(element("brSensitivity").value) / 100,
      specificity: Number(element("brSpecificity").value) / 100
    };
  }

  // Whole dots, and they must total POPULATION exactly or the grid lies.
  function tally({ oneIn, sensitivity, specificity }) {
    const hidden = Math.round(POPULATION / oneIn);
    const clean = POPULATION - hidden;
    const truePositive = Math.round(hidden * sensitivity);
    const falseNegative = hidden - truePositive;
    const falsePositive = Math.round(clean * (1 - specificity));
    const trueNegative = clean - falsePositive;
    const alarms = truePositive + falsePositive;
    return {
      hidden, clean, truePositive, falseNegative, falsePositive, trueNegative, alarms,
      precision: alarms > 0 ? truePositive / alarms : null
    };
  }

  function draw(canvas, result) {
    const context = canvas.getContext("2d");
    const cell = canvas.width / COLUMNS;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f8f8f4";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Grouped rather than scattered: the block of false alarms beside the
    // handful of real ones is the entire point of the picture.
    const groups = [
      [result.truePositive, COLOURS.truePositive],
      [result.falseNegative, COLOURS.falseNegative],
      [result.falsePositive, COLOURS.falsePositive],
      [result.trueNegative, COLOURS.trueNegative]
    ];

    let index = 0;
    for (const [total, colour] of groups) {
      context.fillStyle = colour;
      for (let drawn = 0; drawn < total; drawn += 1, index += 1) {
        const x = (index % COLUMNS) * cell;
        const y = Math.floor(index / COLUMNS) * cell;
        context.fillRect(x + 0.6, y + 0.6, cell - 1.2, cell - 1.2);
      }
    }
  }

  function render() {
    const controls = readControls();
    const result = tally(controls);

    element("brPrevalenceValue").textContent = `1 in ${count(controls.oneIn)}`;
    element("brSensitivityValue").textContent = `${(controls.sensitivity * 100).toFixed(1)}%`;
    element("brSpecificityValue").textContent = `${(controls.specificity * 100).toFixed(1)}%`;

    element("brAlarms").textContent = count(result.alarms);
    element("brTrue").textContent = count(result.truePositive);
    element("brPpv").textContent = result.precision === null
      ? "no alarms"
      : `${(result.precision * 100).toFixed(1)}%`;
    element("brMissed").textContent = count(result.falseNegative);

    const headline = element("brHeadline");
    if (result.alarms === 0) {
      headline.textContent = "This instrument never fires on this population. It misses everything, which is its own kind of failure.";
    } else {
      const wrong = 100 - result.precision * 100;
      headline.textContent = `Of the ${count(result.alarms)} symbols that alarm, ${count(result.truePositive)} actually hide something. ${wrong.toFixed(1)}% of every alarm you investigate is clean.`;
    }
    headline.classList.toggle("flag", result.precision !== null && result.precision < 0.5);

    element("brInstrument").textContent =
      `Catches ${(controls.sensitivity * 100).toFixed(1)}% of hidden symbols and stays quiet on ${(controls.specificity * 100).toFixed(1)}% of clean ones. Both numbers are properties of the detector alone, and neither changes when the population does.`;

    element("brPopulation").textContent =
      `${count(result.hidden)} of ${count(POPULATION)} symbols actually hide something, so ${count(result.clean)} do not. The ${(100 - controls.specificity * 100).toFixed(1)}% of clean symbols that alarm is multiplied by that much larger number, which is why it dominates.`;

    element("brReport").textContent = result.precision === null
      ? "That the instrument produced no positives, which is not the same as establishing that nothing is hidden."
      : `That a positive result from this instrument, on this population, is right about ${(result.precision * 100).toFixed(1)}% of the time. Reporting the accuracy figure without the prevalence overstates the finding.`;

    draw(element("brGrid"), result);
  }

  element("baseRateForm").addEventListener("submit", event => event.preventDefault());
  for (const id of ["brPrevalence", "brSensitivity", "brSpecificity"]) {
    element(id).addEventListener("input", render);
  }
  render();

  window.HideAndSeenBaseRate = Object.freeze({ tally, POPULATION, PREVALENCES });
})();
