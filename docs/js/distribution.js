(function () {
  "use strict";

  const element = id => document.getElementById(id);

  function draw(canvas, observed, expected) {
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const padding = 28;
    const maximum = Math.max(...observed, ...expected) * 1.12;
    const column = (width - padding * 2) / observed.length;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f8f8f4";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#bfc2b8";
    context.beginPath();
    context.moveTo(padding, height - padding);
    context.lineTo(width - padding, height - padding);
    context.stroke();
    observed.forEach((value, index) => {
      const x = padding + index * column + 4;
      const barHeight = value / maximum * (height - padding * 2);
      context.fillStyle = "#161713";
      context.fillRect(x, height - padding - barHeight, column - 8, barHeight);
      const expectedY = height - padding - expected[index] / maximum * (height - padding * 2);
      context.fillStyle = "#ad2c22";
      context.fillRect(x - 2, expectedY - 1, column - 4, 3);
      context.fillStyle = "#656960";
      context.font = "10px monospace";
      context.textAlign = "center";
      context.fillText(String(index), x + (column - 8) / 2, height - 10);
    });
  }

  function format(result) {
    return `chi-square ${result.chiSquare.toFixed(1)} / total variation ${(result.totalVariation * 100).toFixed(1)}%`;
  }

  function build(event) {
    if (event) event.preventDefault();
    const samples = Number(element("distributionSamples").value);
    const simulation = HideAndSeenDistribution.simulate(samples, element("distributionSeed").value);
    element("distributionCount").textContent = samples;
    const expected = simulation.cover.map(value => value * samples);
    for (const [key, canvasId, statId] of [
      ["normal", "normalChart", "normalStat"],
      ["naive", "naiveChart", "naiveStat"],
      ["shaped", "shapedChart", "shapedStat"]
    ]) {
      draw(element(canvasId), simulation.result[key].counts, expected);
      element(statId).textContent = format(simulation.result[key]);
    }
    const critical = 14.07;
    element("distributionNaive").textContent = `Direct mapping produced chi-square ${simulation.result.naive.chiSquare.toFixed(1)} against the cover model${simulation.result.naive.chiSquare > critical ? ", above" : ", below"} the illustrative 5% threshold for seven degrees of freedom.`;
    element("distributionShaped").textContent = `CDF shaping produced chi-square ${simulation.result.shaped.chiSquare.toFixed(1)} with the same cover probabilities. This result addresses only this one synthetic statistic.`;
    element("distributionTest").textContent = `At ${samples} samples, a simple goodness-of-fit test ${simulation.result.naive.chiSquare > critical ? "flags" : "does not flag"} the naive channel and ${simulation.result.shaped.chiSquare > critical ? "flags" : "does not flag"} the shaped sample.`;
  }

  element("distributionForm").addEventListener("submit", build);
  element("distributionSamples").addEventListener("input", build);
  build();
})();
