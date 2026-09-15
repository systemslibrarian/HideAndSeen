(function () {
  "use strict";

  const element = id => document.getElementById(id);
  let data = null;
  let sampleIndex = 0;
  let current = null;

  function percent(value, digits) {
    return `${(value * 100).toFixed(digits === undefined ? 1 : digits)}%`;
  }

  function matrix(rows) {
    return rows.map(row => Array.from(row, value => value === "1" ? 1 : 0));
  }

  function showSample() {
    current = data.samples[sampleIndex % data.samples.length];
    HideAndSeenRender.draw(element("guessQr"), matrix(current.matrix), { size: 360 });
    element("guessCaption").textContent = `HELD-OUT SAMPLE ${sampleIndex % data.samples.length + 1} / ${data.samples.length}`;
    element("trueEncoder").textContent = "Hidden until you guess";
    element("modelPrediction").textContent = "Hidden until you guess";
    element("modelConfidence").textContent = "--";
    element("guessPayload").textContent = "Hidden until you guess";
    element("guessFinding").textContent = "Choose an encoder.";
    document.querySelectorAll("[data-guess]").forEach(button => { button.disabled = false; });
  }

  function reveal(guess) {
    const visitorRight = guess === current.encoder;
    const modelRight = current.prediction === current.encoder;
    element("trueEncoder").textContent = current.encoder;
    element("modelPrediction").textContent = `${current.prediction} / ${modelRight ? "correct" : "wrong"}`;
    element("modelConfidence").textContent = percent(current.confidence);
    element("guessPayload").textContent = current.payload;
    element("guessFinding").textContent = visitorRight
      ? `Your guess was right. The classifier was ${modelRight ? "also right" : "wrong"}.`
      : `Your guess was wrong. The classifier was ${modelRight ? "right" : "also wrong"}.`;
    document.querySelectorAll("[data-guess]").forEach(button => { button.disabled = true; });
  }

  function renderMetrics() {
    element("overallAccuracy").textContent = percent(data.result.accuracy);
    element("chanceAccuracy").textContent = percent(data.result.chance, 0);
    element("testSymbols").textContent = data.method.testSymbols;
    element("skippedSymbols").textContent = Object.keys(data.method.skipped).length ? JSON.stringify(data.method.skipped) : "0";
    element("attributionFinding").textContent = `${percent(data.result.accuracy)} accuracy against a ${percent(data.result.chance, 0)} random baseline is scientifically interesting, but it leaves ${Math.round((1 - data.result.accuracy) * data.method.testSymbols)} of ${data.method.testSymbols} controlled test symbols misclassified.`;

    // perEncoder is the real finding: the aggregate hides a spread from 91% to
    // 35%, and the last column of a five-by-five table hides it almost as well.
    const spread = element("encoderSpread");
    if (spread) {
      const baseline = (data.result.chance * 100).toFixed(1);
      spread.innerHTML = Object.entries(data.result.perEncoder)
        .sort((first, second) => second[1] - first[1])
        .map(([name, value]) => `<li><span class="encoder-name">${name}</span><span class="encoder-track"><i style="width:${(value * 100).toFixed(1)}%"></i><b style="left:${baseline}%" title="random baseline"></b></span><span class="encoder-value">${percent(value)}</span></li>`)
        .join("");
    }

    const table = element("confusionTable");
    const short = name => name.replace("python-", "py-").replace("node-", "node-");
    table.innerHTML = `<thead><tr><th>True \\ predicted</th>${data.result.libraries.map(name => `<th>${short(name)}</th>`).join("")}<th>Recall</th></tr></thead><tbody>${data.result.libraries.map(actual => {
      const row = data.result.confusion[actual];
      const total = Object.values(row).reduce((sum, value) => sum + value, 0);
      return `<tr><th>${actual}</th>${data.result.libraries.map(predicted => `<td class="${actual === predicted ? "diagonal" : ""}">${row[predicted]}</td>`).join("")}<td>${percent(row[actual] / total)}</td></tr>`;
    }).join("")}</tbody>`;
    element("attributionLimitations").innerHTML = data.limitations.map(item => `<p>${item}</p>`).join("");
  }

  async function init() {
    const response = await fetch("../data/attribution.json");
    data = await response.json();
    const buttons = element("guessButtons");
    for (const library of data.result.libraries) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.guess = library;
      button.textContent = library;
      button.addEventListener("click", () => reveal(library));
      buttons.appendChild(button);
    }
    element("nextGuess").addEventListener("click", () => {
      sampleIndex = (sampleIndex + 7) % data.samples.length;
      showSample();
    });
    renderMetrics();
    showSample();
  }

  init().catch(error => { element("guessFinding").textContent = error.message; });
})();
