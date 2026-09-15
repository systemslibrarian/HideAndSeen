# HideAndSeen

**Live exhibit: https://systemslibrarian.github.io/HideAndSeen/**

**HideAndSeen is an interactive QR-code steganography and forensics laboratory.**

It explores what can exist inside a valid QR code beyond the message an ordinary
scanner returns—from alternate segmentation and padding codewords to
error-correction channels, visual secret sharing, nested representations, and
microscopic structure.

Each exhibit asks the same questions: What does the ordinary reader see? What
changed underneath? What can a specialized reader recover? And how might an
analyst detect it?

The project reproduces published techniques where practical, clearly labels
teaching models where it does not, and tests the assumptions behind QR
steganalysis itself.

Its central lesson is simple:

**Hidden is not the same as unfindable.**

> **Publishing note:** this repository does not redistribute third-party
> research papers, and never has in any commit. Every reference below links to
> a DOI, or to a free copy offered by the publisher or author. A workflow fails
> the build if a third-party paper is ever committed to `articles/`.

## Live teaching exhibits

| # | exhibit | implementation relationship |
|---:|---|---|
| 01 | [The Padding Channel](docs/exhibits/padding.html) | Live pad-codeword replacement, recovery, and detection |
| 02 | [Same Message, Different Segmentation](docs/exhibits/segmentation.html) | Live implementation of the same general suboptimal-segmentation technique |
| 03 | [Error Correction as Hiding Space](docs/exhibits/ecc.html) | Live RS-block laboratory with spread, concentrated, and Wan-style region placement |
| 04 | [Two Secrets, Two Channels](docs/exhibits/multi-secret.html) | Live combination of segmentation selection and correctable changes |
| 05 | [Two-Level / Textured QR](docs/exhibits/two-level.html) | Explicitly labeled teaching model of microscopic module texture |
| 06 | [QR Visual Secret Sharing](docs/exhibits/secret-sharing.html) | Live 2-of-2 XOR shadows carried in two scannable QRs' padding |
| 07 | [Near/Far Dual-Message QR](docs/exhibits/nested.html) | Paper-style centered/outer module construction with pixel-derived sampling |
| 08 | [Regeneration and Compare](docs/exhibits/steganalysis.html) | Live test of detection and reference-encoder mismatch |
| 09 | [Encoder Fingerprints](docs/exhibits/fingerprints.html) | Live two-encoder comparison plus controlled five-encoder profiles |
| 10 | [Can You Guess the Encoder?](docs/exhibits/attribution.html) | Corrected held-out attribution experiment and game |
| 11 | [Distribution Matching](docs/exhibits/distribution.html) | Clearly labeled synthetic model of general steganography concepts |
| 12 | [The Detection Challenge](docs/exhibits/challenge.html) | Capstone using eight analyst tools across five generated case types |
| 13 | [The Base Rate](docs/exhibits/base-rate.html) | Model of what an alarm is worth once prevalence is taken into account |
| 14 | [The Adaptive Adversary](docs/exhibits/adversary.html) | Coverage map of this site's own channels against its own checks |

Every exhibit answers the same four questions about its symbol, states what a
reader should be able to do afterwards, and links to the exhibits either side of
it. Ten of them ask for a prediction before revealing the answer.

The site also includes [interactive QR anatomy](docs/learn/anatomy.html), a
[glossary](docs/learn/glossary.html) of the structure, error-correction,
steganography and detection terms the exhibits assume, and an exhibit-by-exhibit
[Papers and Methods guide](docs/learn/papers.html). The guide states the source,
verification grade, implementation relationship, simplification, and detection
lesson for every exhibit.

## Research basis

The bibliography below preserves its verification grades:

    [FULL]  fetched and read in full
    [META]  title, authors, venue, DOI, and abstract verified directly
    [BIB]   verified in another paper's bibliography or publisher metadata
    [2ND]   reported second-hand, not independently verified

Some exhibits implement a published mechanism directly. Others implement the
same general technique with transparent local rules. Physical-layer and
theoretical demonstrations remain labeled teaching models until their claimed
behavior is independently established. No exhibit should be read as a claim of
novelty, secrecy, anonymity, authentication, or universal steganographic
security.

## What the code can inspect

| path | role |
|---|---|
| `docs/js/qr-core.js` | shared QR encoder: segmentation, data framing, padding, Reed–Solomon parity, interleaving, placement, masking, and module-role traces |
| `docs/js/qr-inspect.js` | browser-side unmasking, de-interleaving, complete segment parsing, padding inspection, and RS parity checks |
| `docs/js/qr-vss.js` | packed 2-of-2 random-grid XOR visual shares used by Exhibit 06 |
| `docs/js/dual-message.js` | Chou–Wang-style near/far two-state module rendering and pixel sampling |
| `docs/js/ecc-model.js` | block-aware correctable-change placement strategies |
| `src/extract.py` | matrix-to-codeword extractor with numeric, alphanumeric, byte, ECI, and mixed-segment parsing |
| `src/hide.py` / `src/detect.py` | Python pad-channel encoder, cooperating reader, and standards-aware detector |
| `src/regen_attack.py` | regeneration-and-compare experiment across encoder assumptions |
| `src/encoders.py` / `src/attribute.py` | five-encoder adapters and held-out attribution experiment |
| `tools/emit.js` / `tools/verify-js.js` | rendered-symbol corpus and independent ZXing verification |

The public site is static and browser-local. It needs no application server and
makes no network requests after its static assets have loaded.

## Testing and validation

Install the JavaScript and Python dependencies, then run the reproducible test
commands:

```bash
npm install
python3 -m pip install -r requirements.txt
npx playwright install chromium

npm test             # JS known answers + Python parser tests + desktop/mobile browser tests
npm run test:emit    # render the QR corpus and independently decode it with ZXing
```

Current validated baseline:

- **3** JavaScript core/known-answer groups pass, including binary padding,
  mixed segmentation, XOR shares, dual-message matrices, RS placement, and
  distribution sampling.
- **5** Python extraction tests pass, including numeric, alphanumeric, byte, and
  mixed-mode streams.
- **88** Playwright checks pass across desktop and mobile projects.
- **432/432** rendered QR symbols decode to their expected overt payload with
  independent ZXing verification; four requested combinations are skipped
  because they do not fit versions 1–12.

`tools/verify.py` remains available for independent zbar verification when
`libzbar` is installed. OpenCV's `QRCodeDetector` was scale-sensitive on valid
symbols during development and is not used as the acceptance oracle.

## Corrected attribution result

The former first-segment parser defect is fixed and covered by mixed-mode tests.
The corrected deterministic build uses 500 training payloads and 250 disjoint
test payloads across five encoders: 2,500 training symbols and 1,250 test
symbols, with **zero skipped symbols**. It reaches **53.52% five-way accuracy**
against a 20% random baseline. Segno is the easiest outlier; the other four
encoders remain heavily confused. Every tested one-vs-rest profile has an
unacceptable false-reject rate.

That is an interesting behavioral signal, not reliable forensic attribution.
The historical 81.8% tight-template number is not presented in the exhibit
because it was contaminated by the old parser dropping two encoders.

Regenerate the static result used by the site with:

```bash
npm run build:data
```

The full five-encoder build additionally requires the `qrencode` executable.

## Research limitations

- Browser simulations do not establish print/scan performance across phones,
  cameras, displays, paper, lighting, distance, or angle.
- The near/far page reproduces the published module construction and verifies
  deterministic pixel sampling; physical reader behavior still varies.
- The two-level texture page remains a teaching model rather than an
  authentication-system reproduction.
- Passing one detector does not establish that a sample contains no hidden
  information in another layer.
- Regeneration differences require a model of innocent encoder variation.
- Encoder traces are not identities and do not authenticate an issuer.
- Distribution matching against one statistic does not prove undetectability.

## History of the original investigation

This repository began as a dated investigation into possible QR covert channels
and generator attribution. Both lines produced negative results. Padding hiding
was already published, the channel is directly detectable, and the corrected
attribution experiment remains far below a deployable forensic standard.

Those negative results are retained because they became the teaching material:
they show where capacity exists, what assumptions fail, and how a detector can
misread innocent variation.

---

# References

Every entry is marked with how far it was actually checked. Nothing here should
be cited onward at a higher confidence than its marker.

    [FULL]  fetched and read in full
    [META]  title, authors, venue, DOI and abstract verified directly
    [BIB]   verified as appearing in another paper's bibliography
    [2ND]   reported by a second-hand source, NOT independently verified

**No local copies.** This repository does not redistribute third-party papers.
Every reference below carries a resolvable DOI, or a direct link where the
publisher or author offers a free copy — follow those to fetch your own. The
confidence marker records how far the reference was actually *read*, and is
independent of how easy a copy is to obtain.

## QR steganography — the carrier techniques

- **[META] Koptyra, K. & Ogiela, M.R., "Steganography in QR Codes—Information
  Hiding with Suboptimal Segmentation", *Electronics* 13(13):2658, 2024.**
  [doi:10.3390/electronics13132658](https://doi.org/10.3390/electronics13132658). AGH University of Krakow.
  Embeds a secret by choosing *non-optimal segment modes*. Valid codes, standard
  readers return only the overt message, error-correction quality undiminished.
  **This is the closest prior art to the "secret chooses among equivalent
  encodings" idea, and it is why that idea cannot be claimed.**

- **[META] Koptyra, K. & Ogiela, M.R., "Multi-secret Steganography in QR Codes",
  *WSEAS Trans. Information Science and Applications* 21:533–537, 2024.**
  [doi:10.37394/23209.2024.21.49](https://doi.org/10.37394/23209.2024.21.49).
  Two independent secrets in one QR code, in two separate domains — one embedded
  in the segments, one in the modules via error correction. **This is the
  nearest published relative of the two-layer exhibit in `src/hide.py`.**

- **[BIB] Chiang, Y.J., Lin, P.Y., Wang, R.Z., Chen, Y.H., "Blind QR code
  steganographic approach based upon error correction capability", *KSII Trans.
  Internet Inf. Syst.* 7:2527–2543, 2013.**
  [doi:10.3837/tiis.2013.10.012](https://doi.org/10.3837/tiis.2013.10.012).

- **[BIB] Bui, T., Vu, N., Nguyen, T., Echizen, I., Nguyen, T., "Robust message
  hiding for QR code", IIH-MSP 2014.** [doi:10.1109/IIH-MSP.2014.135](https://doi.org/10.1109/IIH-MSP.2014.135),
  pp. 520–523. IEEE paywalled; an author copy is reported at
  [ResearchGate 286572060](https://www.researchgate.net/publication/286572060_Robust_Message_Hiding_for_QR_Code)
  (not verified from here).

- **[BIB] Lin, P.Y. & Chen, Y.H., "High payload secret hiding technology for QR
  codes", *EURASIP J. Image Video Process.* 2017(1).**
  [doi:10.1186/s13640-016-0155-0](https://doi.org/10.1186/s13640-016-0155-0) — note the `-016-` year stem; an earlier copy of
  this list carried `10.1186/s13640-017-0155-8`, which does not resolve.
  Open access.

- **[BIB] Huang, P.C., Li, Y.H., Chang, C.C., Liu, Y., "Efficient scheme for
  secret hiding in QR code by improving exploiting modification direction",
  *KSII Trans.* 12(5):2348–2365, 2018.** [doi:10.3837/tiis.2018.05.024](https://doi.org/10.3837/tiis.2018.05.024).

- **[BIB] Wan, S., Lu, Y., Yan, X., Ding, W., Liu, H., "High capacity embedding
  methods of QR code error correction", 2018.** [doi:10.1007/978-3-319-72998-5_8](https://doi.org/10.1007/978-3-319-72998-5_8)
  — Crossref dates the chapter 2017, LNICST pp. 70–79. Springer paywalls it but
  **EUDL hosts it free**: [eudl.eu/pdf/10.1007/978-3-319-72998-5_8](https://eudl.eu/pdf/10.1007/978-3-319-72998-5_8).

- **[FULL] Tan, L., Lu, Y., Yan, X., Liu, L., Zhou, X., "XOR-ed visual secret
  sharing scheme with robust and meaningful shadows based on QR codes",
  *Multimedia Tools and Applications* 79:5719–5741, 2020.**
  [doi:10.1007/s11042-019-08351-0](https://doi.org/10.1007/s11042-019-08351-0). Open access.
  **This is the reference that independently closes the padding channel used in
  `src/hide.py`**, and it says so in as many words: *"Since the standard QR
  encoder does not check if the padding codewords are correct during the
  encoding phase, we replace padding codewords by initial shadows"* — replaced
  *after the terminator*, decoded identically by a standard reader, error
  correction preserved. That is `hide.py`'s channel, described by someone else,
  in a journal, in 2020.
  Its conclusion also reaches finding 4 in this repo independently: *"the size
  of the secret image is limited by the number of padding codewords of the cover
  QR code"* — covert capacity is payload-dependent.

- **[BIB] Tan, L., Lu, Y., Yan, X., Liu, L., Chen, J., "(2,2) threshold robust
  visual secret sharing scheme for QR code based on pad codewords", SICBS 2018,
  Springer AISC 895:619–628.** [doi:10.1007/978-3-030-16946-6_50](https://doi.org/10.1007/978-3-030-16946-6_50) — Crossref dates
  the chapter 2019, not 2020. Same group, one different co-author, earlier and
  narrower.
  **Not obtained** (Springer chapter, paywalled) **and no longer worth buying.**
  It was the priority purchase only while it was the sole support for "pad
  codewords were already published as a carrier". The 2020 journal paper above
  is open access, is by the same authors, states the mechanism more explicitly,
  and can be read in full — so that claim no longer rests on a paywalled
  bibliography entry.

- **[META] Cucurull, J., Guasch, S., Escala, A., Navarro-Arribas, G., Acín, V.,
  "QR Steganography — A Threat to New Generation Electronic Voting Systems",
  SECRYPT 2014, SciTePress 484–491.** [doi:10.5220/0005120404840491](https://doi.org/10.5220/0005120404840491). Codeword
  substitution consuming error-correction capacity; notes that hidden data
  degrades correction capacity proportionally. Author names were missing from an
  earlier copy of this list and are taken from the paper itself.

- **[META] "Steganography of Encrypted Messages Inside Valid QR Codes",
  *IEEE Access* 8, 2020.** [doi:10.1109/ACCESS.2020.2971984](https://doi.org/10.1109/ACCESS.2020.2971984), IEEE Xplore document
  8985346. Published February 2020, not 2019, and it is **open access** — an
  earlier copy of this list recorded it as a paywalled 2019 item.

### Two-level and nested QR codes

All four are paywalled, and none has an open copy in Unpaywall, OpenAlex,
Semantic Scholar, DOAJ or HAL. **Three of the four are still unobtained.**

- **[BIB] Tkachenko, I., Puech, W., Destruel, C., Strauss, O., Gaudin, J.M.,
  Guichard, C., "Two-level QR code for private message sharing and document
  authentication", *IEEE TIFS* 11(3):571–583, 2016.**
  [doi:10.1109/TIFS.2015.2506546](https://doi.org/10.1109/TIFS.2015.2506546).
  Public level readable by any standard app; private level encoded by replacing
  black modules with textured patterns, sensitive to print-and-scan so a copy is
  distinguishable from the original.
  — obtained separately, not from a free source. The HAL record
  [lirmm-01337360](https://hal-lirmm.ccsd.cnrs.fr/lirmm-01337360v1) is
  metadata-only; no file was deposited.
- **[BIB] Chou, G.J. & Wang, R.Z., "The nested QR code", *IEEE Signal Process.
  Lett.* 27:1230–1234, 2020.** [doi:10.1109/LSP.2020.3006375](https://doi.org/10.1109/LSP.2020.3006375)
  **Not obtained, and not worth pursuing:** Chou & Wang's own open-access
  "Dual-Message QR Codes" (*Sensors* 24(10):3055, 2024,
  [doi:10.3390/s24103055](https://doi.org/10.3390/s24103055)) describes their
  earlier nested method and is open access at the DOI above.
- **[BIB] Cheng, Y., Fu, Z., Yu, B., Shen, G., "A new two-level QR code with
  visual cryptography scheme", *Multimedia Tools Appl.* 77(16), 2018.**
  [doi:10.1007/s11042-017-5465-4](https://doi.org/10.1007/s11042-017-5465-4)
- **[BIB] Liu, S., Fu, Z., Yu, B., "A two-level QR code scheme based on
  polynomial secret sharing", *Multimedia Tools Appl.* 78:21291–21308, 2019.**
  [doi:10.1007/s11042-019-7455-1](https://doi.org/10.1007/s11042-019-7455-1)

## QR steganalysis — detection

- **[FULL] Chen, J., Chen, K., Wang, Y., Yan, X., Li, L., "A General Steganalysis
  Method of QR Codes", ICDF2C 2022, Springer LNICST 508:472–483, 2023.**
  [doi:10.1007/978-3-031-36574-4_28](https://doi.org/10.1007/978-3-031-36574-4_28). National University of Defense Technology.
  Code regeneration, module comparison, embedded-information filtering. Claims to
  "perfectly distinguish" stego codes for **spatial** QR steganography.
  **`src/regen_attack.py` reimplements this and measures 3/3 false positives on
  innocent codes when analyst and issuer use different libraries** — its notion
  of "the pure QR code" presupposes a canonical encoder that does not exist.
  Body paywalled (USD 29.95); buy it before relying on this critique. — obtained separately,
  not from a free source.

## General steganography theory — distribution matching

These matter because they are what make a "learn the normal distribution, then
sample from it" QR claim obvious under §103 rather than novel.

- **[2ND] Sallee, P., "Model-Based Steganography", 2003.** Uses a statistical
  model of the cover to determine how much can be hidden without statistical
  detection and to approach that capacity. **If accurate, this anticipates the
  adaptive-capacity idea at the general level.** Verify before relying on it.
  IWDW 2003, LNCS 2939. Free author copy:
  [digitnet.github.io/m4jpeg](https://digitnet.github.io/m4jpeg/downloads/pdf/model-based-steganography.pdf).
- **[2ND] Liśkiewicz, M., Reischuk, R., Wölfel, U., "Grey-box steganography".**
  Samples ordinary covertexts, learns the covertext distribution, constructs
  stegotexts from it. TAMC 2011 → *Theoretical Computer Science* 505, 2013 —
  **not *Signal Processing*, as an earlier copy of this list had it.** The local
  copy is the Lübeck technical report SIIM-TR-A-09-03, not the journal version:
  [tcs.uni-luebeck.de](http://www.tcs.uni-luebeck.de/downloads/papers/2009/SIIM-TR-A-09-03_GreyBox.pdf).
- **[2ND] Meteor (2021); Discop (2023); perfectly secure steganography via
  minimum entropy coupling (2022).** Provably secure steganography by sampling
  from a model's true distribution. Cited from memory, not searched.
  Sources: [Meteor](https://eprint.iacr.org/2021/686) (ePrint 2021/686) ·
  [Discop](https://dingjinyang.github.io/uploads/Discop_sp23_paper.pdf) (author
  copy, IEEE S&P 2023) · [minimum entropy
  coupling](https://arxiv.org/abs/2210.14889) (arXiv:2210.14889, ICLR 2023)
- **[2ND] arXiv:2605.19885 — "Set Shaping Theory as a Complementary
  Payload-Shaping Layer for Steganography", May 2026.** Koch, Lewis, Scott,
  Weber. [arxiv.org/abs/2605.19885](https://arxiv.org/abs/2605.19885).

## Standards and tools

- **ISO/IEC 18004** — QR Code bar code symbology specification. Obtain the actual
  standard, not a summary: the pad-codeword rule (alternating `0xEC`/`0x11`) and
  the mask-evaluation procedure are both load-bearing here.
  **Current edition is ISO/IEC 18004:2024** (Ed. 4, August 2024), which revises
  ISO/IEC 18004:2015. Work in this repo that quotes the standard — including
  libqrencode issue #220 on mask scoring criterion 3 — cites the **2015** text,
  so check clause numbering against whichever edition you buy.
  **Not obtained** — a paid standard, from ISO, IEC or a national body, and no
  tier permits redistribution.
- **[2ND] QRazyBox** — [github.com/Merricx/qrazybox](https://github.com/Merricx/qrazybox). QR analysis and recovery
  toolkit; exposes unmasking and Reed–Solomon internals interactively. **Cited
  here because it is why the "nothing public does this" claim about
  `src/extract.py` was withdrawn.**
- **[libqrencode issue #220](https://github.com/fukuchi/libqrencode/issues/220)** — implementations disagreeing on mask scoring
  criterion 3. Third-party evidence that mask choice carries implementation
  identity.

## Two traps in the encoder, both silent

Building `docs/qr.js` cost two debugging cycles, and both failures produced a
symbol that rendered perfectly and decoded to nothing:

1. **segno stores Reed–Solomon generator polynomials as alpha exponents**, with
   the leading zero term dropped. `GEN_POLY[7]` is `(87, 229, 146, ...)` — an
   exponent table, not field elements.
2. **The reference implementations index modules as (x, y) = (column, row).**
   Written as `[row][col]`, the two format-information strips swap places.
   Everything looks right; nothing decodes.

Also: `FORMAT_INFO` is indexed by segno's own error constants (M=0, L=1, H=2,
Q=3), not by L/M/Q/H order.
