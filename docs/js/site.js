(function () {
  "use strict";

  const root = document.body.dataset.root || ".";
  const currentPage = document.body.dataset.page || "";
  const exhibits = [
    ["01", "The Padding Channel", "Pad bytes carry a message and betray it.", "exhibits/padding.html", "LIVE"],
    ["02", "Same Message, Different Segmentation", "Equivalent payloads, different mode sequences.", "exhibits/segmentation.html", "LIVE"],
    ["03", "Error Correction as Hiding Space", "Spend robustness to alter the symbol.", "exhibits/ecc.html", "LIVE"],
    ["04", "Two Secrets, Two Channels", "One object, three readers.", "exhibits/multi-secret.html", "LIVE"],
    ["05", "Two-Level / Textured QR", "Information above and below scanner resolution.", "exhibits/two-level.html", "MODEL"],
    ["06", "Visual Secret Sharing", "Two scannable QR shadows recover one image together.", "exhibits/secret-sharing.html", "LIVE"],
    ["07", "Near/Far Dual-Message QR", "Centered and outer module regions carry separate QR matrices.", "exhibits/nested.html", "LIVE"],
    ["08", "Regeneration and Compare", "Difference is not automatically evidence.", "exhibits/steganalysis.html", "LIVE"],
    ["09", "Encoder Fingerprints", "Legal defaults leave behavioral traces.", "exhibits/fingerprints.html", "DATA"],
    ["10", "Can You Guess the Encoder?", "A weak forensic signal becomes a game.", "exhibits/attribution.html", "DATA"],
    ["11", "Distribution Matching", "Model the cover before selecting variants.", "exhibits/distribution.html", "MODEL"],
    ["12", "The Detection Challenge", "Choose the right analytical tool.", "exhibits/challenge.html", "LIVE"]
  ];

  function path(relative) {
    return `${root}/${relative}`.replace("././", "./");
  }

  const header = document.querySelector("[data-site-header]");
  if (header) {
    const links = [
      ["start", "Start", "index.html"],
      ["exhibits", "Exhibits", "index.html#exhibits-title"],
      ["anatomy", "How QR works", "learn/anatomy.html"],
      ["detection", "Detection", "exhibits/steganalysis.html"],
      ["papers", "Papers", "learn/papers.html"]
    ];
    const navLinks = links.map(([id, label, href]) => {
      const active = currentPage === id ? ' aria-current="page"' : "";
      return `<a href="${path(href)}"${active}>${label}</a>`;
    }).join("");
    header.innerHTML = `<nav class="site-nav wrap" aria-label="Primary"><a class="site-mark" href="${path("index.html")}">Hide<span>And</span>Seen</a><div class="site-links">${navLinks}</div></nav>`;
  }

  const footer = document.querySelector("[data-site-footer]");
  if (footer) {
    footer.innerHTML = `<div class="footer-grid wrap"><p>Browser-local teaching demonstrations. Claims and limitations are tied to the repository's verification-graded bibliography.</p><a href="${path("learn/papers.html")}">Research notes and references</a></div>`;
  }

  const index = document.querySelector("[data-exhibit-index]");
  if (index) {
    for (const [number, title, description, href, status] of exhibits) {
      const item = document.createElement("li");
      item.innerHTML = `<a href="${path(href)}"><span class="index-number">${number}</span><span><h3>${title}</h3><p>${description}</p></span><span class="index-status">${status}</span></a>`;
      index.appendChild(item);
    }
  }

  window.HideAndSeenSite = Object.freeze({ exhibits, root, path });
})();
