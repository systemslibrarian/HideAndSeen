(function () {
  "use strict";

  const element = id => document.getElementById(id);
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heroUrl = "https://ciphermuseum.com/qr";
  const heroSecret = "MEET AT 7";
  let heroSymbols = [];
  let current = null;

  function label(symbol) {
    return `v${symbol.version}-${symbol.ecc} / mask ${symbol.mask} / ${symbol.padding.length} pad bytes`;
  }

  function buildHero() {
    const hidden = QR.build(heroUrl, { secret: heroSecret });
    const clean = QR.build(heroUrl, { version: hidden.version });
    heroSymbols = Math.random() < .5 ? [hidden, clean] : [clean, hidden];
    heroSymbols.forEach((symbol, index) => {
      const letter = index === 0 ? "A" : "B";
      HideAndSeenRender.draw(element(`hero${letter}`), symbol.matrix, { size: 240 });
      element(`cap${letter}`).textContent = `${letter} / ${label(symbol)}`;
      element(`ver${letter}`).textContent = "";
      element(`ver${letter}`).className = "verdict";
    });
  }

  function inspectHero() {
    heroSymbols.forEach((symbol, index) => {
      const report = QR.inspect(symbol);
      const letter = index === 0 ? "A" : "B";
      const verdict = element(`ver${letter}`);
      verdict.textContent = report.anomalous
        ? `CARRYING / ${report.deviating.length} pad bytes differ`
        : `CLEAN / ${report.total} pad bytes match`;
      verdict.className = `verdict${report.anomalous ? " carrying" : ""}`;
    });
    element("tell").textContent = "Shuffle the pair";
  }

  function renderBytes(symbol, report) {
    const dump = element("dump");
    dump.replaceChildren();
    const changed = new Set(report.deviating.map(index => index + symbol.padStart));
    symbol.codewords.forEach((byte, index) => {
      const node = document.createElement("span");
      node.className = `byte${changed.has(index) ? " anomaly" : index >= symbol.padStart ? " pad" : ""}`;
      node.textContent = byte.toString(16).toUpperCase().padStart(2, "0");
      node.title = index >= symbol.padStart ? `Pad codeword ${index - symbol.padStart + 1}` : `Data codeword ${index + 1}`;
      dump.appendChild(node);
    });
    if (!reducedMotion) {
      dump.querySelectorAll(".anomaly").forEach((node, index) => {
        node.animate([{ opacity: .25 }, { opacity: 1 }], { duration: 180, delay: index * 18 });
      });
    }
  }

  function render(symbol) {
    current = symbol;
    HideAndSeenRender.draw(element("out"), symbol.matrix, { size: 280 });
    element("outcap").textContent = label(symbol);
    const revealed = QR.reveal(symbol);
    const report = QR.inspect(symbol);
    element("p1").textContent = symbol.text;
    element("p2").textContent = revealed === null ? "Nothing encoded in the padding" : revealed;
    element("p3").textContent = report.anomalous
      ? `${report.deviating.length} of ${report.total} pad bytes depart from 0xEC / 0x11: flagged`
      : `All ${report.total} pad bytes match the specified pattern: no padding anomaly`;
    element("p3").className = report.anomalous ? "flag" : "";
    element("pChanged").textContent = report.anomalous
      ? `${report.deviating.length} pad codewords replaced after the terminator`
      : "No pad codewords replaced";
    renderBytes(symbol, report);
  }

  function build(event) {
    if (event) event.preventDefault();
    const text = element("url").value.trim() || "https://example.com";
    const secret = element("secret").value;
    try {
      render(QR.build(text, { secret: secret || null }));
    } catch (error) {
      element("dump").textContent = `${error.message}. Try a shorter message.`;
      ["p1", "p2", "p3"].forEach(id => { element(id).textContent = "Unavailable"; });
    }
  }

  element("tell").addEventListener("click", function () {
    if (this.textContent === "Shuffle the pair") {
      buildHero();
      this.textContent = "Run the padding check";
      return;
    }
    inspectHero();
  });
  element("builder").addEventListener("submit", build);
  element("save").addEventListener("click", () => {
    if (!current) return;
    const canvas = document.createElement("canvas");
    HideAndSeenRender.draw(canvas, current.matrix, { size: 960 });
    HideAndSeenRender.save(canvas, "hideandseen-padding.png");
  });

  buildHero();
  build();
})();
