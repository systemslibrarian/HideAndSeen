(function () {
  "use strict";

  const root = document.body.dataset.root || ".";
  const currentPage = document.body.dataset.page || "";
  const exhibits = [
    ["01", "The Padding Channel", "Pad bytes carry a message and betray it.", "exhibits/padding.html", "LIVE", "explain why an ordinary scanner never reads the pad codewords, and check a symbol's padding against the pattern the standard prescribes."],
    ["02", "Same Message, Different Segmentation", "Equivalent payloads, different mode sequences.", "exhibits/segmentation.html", "LIVE", "explain how one piece of text has many valid encodings, and read a mode sequence as a deliberate choice rather than a fact about the text."],
    ["03", "Error Correction as Hiding Space", "Spend robustness to alter the symbol.", "exhibits/ecc.html", "LIVE", "predict whether a given number of changed codewords will still decode, and check parity without letting the decoder repair it first."],
    ["04", "Two Secrets, Two Channels", "One object, three readers.", "exhibits/multi-secret.html", "LIVE", "describe how a single symbol can answer to three different readers, and name what each additional channel costs."],
    ["05", "Two-Level / Textured QR", "Information above and below scanner resolution.", "exhibits/two-level.html", "MODEL", "explain what information can live below the resolution an ordinary scan preserves, and why that is a physical claim rather than a coding one."],
    ["06", "Visual Secret Sharing", "Two scannable QR shadows recover one image together.", "exhibits/secret-sharing.html", "LIVE", "explain why one share of a two-of-two split reveals nothing at all about the secret, rather than half of it."],
    ["07", "Near/Far Dual-Message QR", "Centered and outer module regions carry separate QR matrices.", "exhibits/nested.html", "LIVE", "explain how the sampling aperture, not the image, selects which of two matrices a reader decodes."],
    ["08", "Regeneration and Compare", "Difference is not automatically evidence.", "exhibits/steganalysis.html", "LIVE", "run regeneration-and-compare, and say precisely why a difference from a reference is not yet evidence of hiding."],
    ["09", "Encoder Fingerprints", "Legal defaults leave behavioral traces.", "exhibits/fingerprints.html", "DATA", "read an encoder's defaults as behaviour, and say why behaviour that is measurable is still not an identity."],
    ["10", "Can You Guess the Encoder?", "A weak forensic signal becomes a game.", "exhibits/attribution.html", "DATA", "read a confusion matrix rather than a headline accuracy, and say why better-than-chance is not attribution."],
    ["11", "Distribution Matching", "Model the cover before selecting variants.", "exhibits/distribution.html", "MODEL", "explain why a hidden channel can be invisible in any one symbol and obvious across many of them."],
    ["12", "The Detection Challenge", "Choose the right analytical tool.", "exhibits/challenge.html", "LIVE", "choose an instrument that matches the layer you suspect, and defend a verdict of clean."],
    ["13", "The Base Rate", "What an alarm is worth depends on how rare hiding is.", "exhibits/base-rate.html", "MODEL", "compute what one alarm is actually worth, and say why specificity matters more than sensitivity when the target is rare."],
    ["14", "The Adaptive Adversary", "The opponent reads your method before choosing a channel.", "exhibits/adversary.html", "MODEL", "state which layers an analysis actually covered, and say why a detection rate measured against a passive adversary is an upper bound."]
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
      ["papers", "Papers", "learn/papers.html"],
      ["glossary", "Glossary", "learn/glossary.html"]
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

  // Learning objective, from the same list, so every exhibit states one and
  // they can be reviewed together rather than drifting page by page.
  const heroTag = document.querySelector(".exhibit-hero .status-tag");
  const listed = exhibits.findIndex(entry => location.pathname.endsWith(entry[3]));
  if (listed >= 0 && heroTag && exhibits[listed][5]) {
    const objective = document.createElement("p");
    objective.className = "objective";
    objective.innerHTML = `<span>AFTER THIS EXHIBIT YOU SHOULD BE ABLE TO</span>${exhibits[listed][5]}`;
    heroTag.insertAdjacentElement("afterend", objective);
  }

  // Exhibit sequence. Derived from the list above, so a new exhibit gets
  // previous/next navigation without touching any exhibit page.
  const position = exhibits.findIndex(entry => location.pathname.endsWith(entry[3]));
  const main = document.getElementById("main");
  if (position >= 0 && main) {
    const step = (entry, direction) => {
      const word = direction === "prev" ? "PREVIOUS" : "NEXT";
      if (entry) {
        return `<a class="exhibit-step ${direction}" href="${path(entry[3])}"><span>${word} &middot; EXHIBIT ${entry[0]}</span><strong>${entry[1]}</strong></a>`;
      }
      const [label, href] = direction === "prev"
        ? ["Back to all exhibits", "index.html#exhibits-title"]
        : ["Research notes and references", "learn/papers.html"];
      return `<a class="exhibit-step ${direction}" href="${path(href)}"><span>${word}</span><strong>${label}</strong></a>`;
    };
    const section = document.createElement("section");
    section.className = "exhibit-nav-band";
    section.innerHTML = `<nav class="wrap exhibit-nav" aria-label="Exhibit sequence">${
      step(position > 0 ? exhibits[position - 1] : null, "prev")
    }${
      step(position < exhibits.length - 1 ? exhibits[position + 1] : null, "next")
    }</nav>`;
    main.appendChild(section);
  }

  window.HideAndSeenSite = Object.freeze({ exhibits, root, path });
})();
