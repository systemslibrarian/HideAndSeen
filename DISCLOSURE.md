# Invention record — encoder-slack

Running, dated record of conception and reduction to practice. Keep entries
append-only; do not rewrite history. This document is the raw material for a
provisional application.

**Inventor:** Paul
**Conception date:** 2026-09-15
**Public disclosure to date:** NONE. Private repository only.

---

## Disclosure ledger

Every public mention goes in this table. If this table stays empty, the
12-month US grace period has not started and foreign rights are alive.

| date | venue | what was said |
|---|---|---|
| 2026-09-16 | GitHub public repo + Pages site `HideAndSeen` | everything: the padding channel, the working encoder, the attribution results, the full record |

**The disclosure was deliberate.** By the time it was made, nothing in this work
was patentable: the padding channel is published prior art (Tan et al. 2020),
its detection is published (Chen et al. 2023), two-layer QR codes are published
(Koptyra & Ogiela 2024), the distribution-matching claim is obvious over Sallee
2003 plus Koptyra 2024, and generator attribution measured 52.8% against a 90%
pre-registered bar. Publishing costs nothing that had value.

**Employment check outstanding:** confirm LCPL / Leon County IP assignment terms
before filing. This work is unrelated to library systems, which helps, but the
agreement should be read rather than assumed.

---

## 2026-09-15 — Conception

### Problem

Steganographic schemes that modify a carrier are detectable in principle,
because modification is measurable. Every published QR steganography method
modifies something: it injects errors the Reed–Solomon layer repairs, or it
selects a suboptimal segmentation. Both leave a signature.

### Mechanism

Do not embed. Sample. A QR encoding of a fixed payload has multiple degrees of
freedom that all yield valid, standard, identically-decoding symbols:

1. mask pattern (8)
2. error-correction level (up to 4)
3. version, where more than one fits
4. padding codewords after the terminator (spec: alternating `0xEC` / `0x11`)
5. segment mode splits for mixed-class payloads

Encrypt the covert payload, then use the ciphertext as the randomness that
selects among these. The symbol is not "a QR code with data hidden in it"; it
is a QR code whose encoder settings were chosen by a particular process.

Security therefore reduces to: is the distribution of settings produced by the
sampler distinguishable from the distribution produced by ordinary encoders?

### Leak classification (which channels are actually safe)

| channel | constrained by | detectability |
|---|---|---|
| padding codewords | nothing — decoders stop at the terminator | **clean** |
| segment splits | nothing, but re-encoding and diffing reveals suboptimality | semi-clean |
| mask | spec *recommends* minimum penalty score; recomputable | leaky |
| ecc level | encoded in format info, plainly readable | leaky |
| version | symbol size, visible | leaky |

Design consequence: the padding channel carries the payload; the leaky channels
must be set to whatever the imitated encoder would have set them to, and carry
nothing.

### Measured capacity (see `src/census.py`)

At baseline symbol, typical short URLs yield **7–15 bytes** of clean channel.
Larger versions or ECC level L yield far more (up to ~59 bytes) but only through
leaky channels.

**Claim-shaping consequence:** the invention is key-material distribution in
plain sight, not covert messaging. Candidate applications: one-time-pad page
labels, key identifiers, rendezvous nonces, out-of-band fingerprints.

### Measured encoder divergence (see `src/fingerprint.py`)

segno and python-qrcode produce different (version, ecc, mask) for the same
payload in every test case, and differ on whether to emit Micro QR at all.

Therefore the cover distribution is a mixture over encoders, and correct
sampling requires targeting a component of that mixture. A uniform sampler over
legal settings is *more* detectable than a naive scheme, because real codes
cluster and uniform output does not.

---

## Prior art found (2026-09-15)

Not yet a formal search — these surfaced during concept exploration and each
needs proper review.

- **Barrero et al., "QR Steganography — A Threat to New Generation Electronic
  Voting Systems" (SciTePress, 2014).** Hides data by substituting codewords,
  consuming error-correction capacity. Notes that hidden data counts as errors
  and degrades correction capacity proportionally. *Distinguishing point: we
  consume no correction capacity.*
- **"Steganography in QR Codes — Information Hiding with Suboptimal
  Segmentation" (MDPI Electronics 13(13):2658, 2024).** Uses alternative segment
  modes rather than error correction; standard readers return only the visible
  message and correction quality is preserved. Admits stego codes come out
  slightly larger. *Closest prior art. Distinguishing points: (a) no size
  anomaly, (b) distribution-matched sampling rather than free choice.*
- **"Steganography of Encrypted Messages Inside Valid QR Codes" (IEEE, 2019).**
- **US 11,785,452 — error-correction-code-based embedding in adaptive rate
  communication systems.** Replaces codeword parity bits with a keyed hidden
  message. Scoped to wireless MCS selection, not QR, but the parity-substitution
  concept will be cited. *We do not touch parity.*
- **Provably secure steganography via distribution matching:** Meteor (2021),
  Discop (2023), perfectly secure steganography via minimum entropy coupling
  (2022). These establish the *principle* for language models. The application to
  a structured machine-readable artifact with spec-defined slack appears open.

### Searches still owed

- Google Patents / Espacenet on: QR padding codeword covert channel; barcode
  encoder parameter selection covert channel; distribution-matched steganography
  barcode.
- Whether anyone has published a *detector* for QR encoder-parameter anomalies.
  If a detector exists, it is both the strongest prior art and the best test rig.

---

## Open questions

1. Do real-world codes cluster tightly enough that the mixture is learnable from
   a feasible corpus size?
2. Does re-encoding attack work? Given a suspect code, re-encode its payload with
   each known library and diff. This is the obvious detector and it must be built.
3. Does the padding channel survive the print/scan round trip intact? It should —
   it is inside the error-corrected data region — but this needs demonstrating,
   not assuming.
4. Can the covert layer survive a code being regenerated by a third party (a
   platform that re-renders links as its own QR)? Almost certainly not. Scope
   accordingly.
5. Chaining: does a sequence of codes carrying 7–15 bytes each compose into
   something useful, and does chaining create a detectable correlation?

---

## 2026-09-15 (later) — Reduction to practice, and the premise falsified

### Built

`src/extract.py` — recovers raw data codewords from a rendered QR matrix
(function-pattern map, zigzag data walk, mask removal, block de-interleaving,
header/terminator/padding parse). Round-trip verified on byte, alphanumeric and
numeric payloads. No existing library exposes this; every decoder returns text.

`src/detect.py` — the adversary. Canonical-padding check, terminator check,
encoder attribution, plus a `forge()` routine that performs the naive covert
encode so the detector can be run against it.

### Result: the padding channel is falsified

The conception entry assumed padding was the *clean* channel because the spec
does not constrain it. That was wrong, and wrong in the direction that matters.
The spec does not merely permit a value, it **prescribes** one: alternating
`0xEC` / `0x11`. Both encoders tested emit exactly that.

Measured, same payload, same version, same ECC, same mask:

    segno          ... F6 26 90 00 EC 11 EC 11
    python-qrcode  ... F6 26 90    EC 11 EC 11 EC

Padding is therefore a constant, not a distribution. Distribution matching has
nothing to match. A covert payload written there is flagged by a three-line
comparison — 4/4 codewords deviating, no corpus or statistics required.

**Consequence for the claim: the distribution-matched padding steganography
claim is abandoned.** The 7–15 bytes measured this morning is capacity against
a scanner, not against an analyst. Recording this rather than narrowing the
claim to hide it: a provisional built on the original premise would have been
enabling a scheme that fails its own security argument.

### Result: encoder attribution is real at byte level

The same diff shows segno inserting an extra `0x00` codeword where
python-qrcode does not, on identical symbol parameters — on top of the
parameter-level divergence (version, ECC, mask, Micro-QR eligibility) measured
in `fingerprint.py`. Two conforming libraries, separable from the bytes alone.

**New candidate invention: generator attribution and tamper detection for
2D barcodes.** A symbol's encoder choices identify the software that produced
it. A QR sticker applied over a legitimate one was made with a different
generator than the legitimate issuer uses, so the substitution is detectable
from the artifact itself, before the destination is ever resolved.

Distinguishing feature versus existing anti-quishing work: current defenses
inspect the *destination* (URL reputation, redirect chains, landing-page
analysis). This inspects the *artifact* and is destination-agnostic — it works
on a first-seen domain, an offline code, or a payload that is not a URL.

### Prior art searches now owed, and they come first

- QR / 2D barcode generator attribution, encoder fingerprinting, provenance
- barcode tamper detection, overlay / sticker substitution detection
- quishing detection patents (likely crowded; assume Proofpoint, Abnormal,
  Cisco, Microsoft have filings)
- device/software fingerprinting from output artifacts generally (printer
  forensics, camera PRNU, JPEG quantisation-table attribution) — these are the
  analogous arts and an examiner will reach for them

The printer-forensics and JPEG-quantisation-table analogies are close enough
that they will be cited. Read them before drafting anything.

### Status of the original idea

Not fully dead, but demoted. Parameter-level channels (version, ECC, mask,
segmentation) genuinely do vary across encoders, so a distribution-matched
covert channel remains possible there — estimated 3–6 bits per symbol. That is
a watermark, not a key, and it is the same measurement the attribution work
needs anyway. Pursue it as a by-product, not as the lead.

---

## 2026-09-15 (evening) — the steganalysis paper, obtained and tested against

**Chen, J., Chen, K., Wang, Y., Yan, X., Li, L. "A General Steganalysis Method
of QR Codes." ICDF2C 2022, Springer LNICST vol. 508, pp. 472–483 (2023).
doi:10.1007/978-3-031-36574-4_28.** National University of Defense Technology,
Hefei. Abstract, keywords and full reference list obtained; body paywalled
(USD 29.95 — buy it, this is the load-bearing reference).

Method: code regeneration, module comparison, embedded-information filtering.
Claims to "perfectly distinguish the stego code" for **spatial** QR
steganography schemes. Keywords: QR codes, Steganography, Steganalysis, Code
regeneration, Protection.

### Effect on the covert channel: closed twice over

The abstract's scope word is *spatial* — module-domain manipulation. Its
reference list confirms the target class: error-correction-capacity embedding
(Chiang 2013, Wan 2018), exploiting-modification-direction (Huang 2018), high
payload hiding (Lin 2017), two-level codes (Tkachenko 2016, Chou 2020, Cheng
2018, Liu 2019).

**Reference [18] is the one that matters to us:** Tan, Lu, Yan, Liu, Chen,
"(2,2) threshold robust visual secret sharing scheme for QR code **based on pad
codewords**", SICBS 2018, Springer AISC 895, pp. 619–628 (2020).

So the padding channel is closed from both ends: **pad codewords as a covert
carrier are published prior art (2020), and manipulating them is caught by
published steganalysis (2023).** The abandonment recorded this morning stands
on independent grounds and is now final.

### Effect on the attribution pivot: survives, with a gift attached

Nothing in the abstract, keywords or reference list concerns generator
attribution or provenance. Their output is binary (stego / not) plus recovery
of "the pure QR code." Attribution is a different output from a partly
overlapping mechanism. Not blocking on what is visible; the body must still be
read for its regeneration procedure.

**And our measurements expose an unstated assumption in it.** `regen_attack.py`
reimplements regeneration-and-compare and runs it on *innocent* codes:

    FALSE POSITIVES ON INNOCENT CODES: 3/3

An innocent segno-issued code, regenerated by an analyst using python-qrcode at
identical version, ECC and mask, differs in 5, 13 and 18 codewords across the
three test payloads. Regenerated with the *same* library: 0 differences, every
time. A padding payload is correctly caught when the libraries match.

The phrase "the pure QR code" presupposes a canonical encoder. There isn't one.
The method's accuracy is conditional on the analyst's reference library
matching the issuer's — an assumption the abstract does not state. Whether the
body addresses it is the first thing to check on purchase.

**This inverts the reference's role.** It is not only prior art against the
abandoned branch; it is a published method whose stated limitation we can
supply, and the fix for it *is* the attribution work. That is a defensible
position: encoder attribution as a precondition for reliable QR steganalysis.

### New finding: segno boosts the error-correction level silently

Found while debugging the above. `segno.make(..., error='L')` returns a **Q**
symbol for `https://example.com` and an **H** symbol for
`https://ciphermuseum.com` at a fixed version — `boost_error` defaults to True,
so segno raises the ECC level to consume spare data capacity. python-qrcode
does not.

Two consequences:

1. **Another fingerprint, and a strong one.** A requested-versus-delivered ECC
   mismatch is a behavioural signature, not a byte-level quirk.
2. **It suppresses padding by design.** segno-issued codes systematically carry
   less free padding than the census predicts, because spare capacity is spent
   on error correction rather than left as pad codewords. Anyone measuring
   covert capacity with segno and `boost_error` at its default is measuring the
   wrong thing. `extract.py` and `regen_attack.py` now set it False explicitly.

### Also queued from this paper's "related" links

- "Optimizing QR Code Security: Best Practices and Anti-tampering Strategies",
  SN Computer Science, Oct 2025 — recent, and directly adjacent to the pivot.
- "QR Code Authentication with Embedded Message Authentication Code" (2016).

---

## 2026-09-15 (night) — Datamax cleared, separability measured, and the flaw

### US 11,430,100 B2 family — read, and it is not what we feared

Family: US 10,304,174 (filed 2016-12-19) → US 10,559,075 → US 11,430,100 →
US 12,033,011. Datamax-O'Neil, assigned to **Hand Held Products, Inc.**
(Honeywell) in Jan/Feb 2023. Inventors Celinder and Ackley. Related:
US 10,867,145 (verifier/printer handshake), US 2020/0082131 (print quality
feedback and control).

What it actually claims: an imaging module captures the printed indicium, a
processor **evaluates print quality against a print quality standard**, rejects
non-conforming media, and either emits location-specific feedback in the local
language or signals a cutter to destroy the rejected media.

**This is print-quality grading, not attribution.** The signal is optical and
mechanical — contrast, modulation, fixed-pattern damage, the ink-on-media
tolerances that determine whether a scanner reads the symbol in one pass. Our
signal is logical: version, ECC, mask, segmentation, codeword tail. The two are
orthogonal, and the clean statement of the difference is this:

> **A perfectly printed malicious QR sticker passes every print-quality check in
> this family. It would be graded and accepted.** Print quality says whether the
> symbol was rendered well. It says nothing about who encoded it.

So the pivot is not blocked. But note the shape of the §103 risk: this family
does teach *capture image of indicium → evaluate against a stored reference →
reject*. An examiner can use it for that skeleton. The distinguishing limitation
must be that the reference is a **generator behavioural profile derived from the
symbol's logical encoding parameters**, and that the check is invariant to print
quality. Say it in the claim, not the spec.

Commercial note: Honeywell owning inline barcode verification makes them a
plausible licensee as well as a prior-art source. Verification at PRINT time is
occupied. Verification at SCAN time, against an encoder profile, is not.

### Separability measured (`src/separability.py`)

120 generated payloads (URLs, numeric, uppercase alphanumeric), both libraries
at their real defaults:

    distinguishable       120/120  (100.0%)
    feature vectors seen  88
    vectors claimed by both libraries: 1

    pad0      90.0%   version  76.7%   mode  66.7%
    mask      85.8%   micro    59.2%   ecc   46.7%

Every payload in the corpus was attributable from the symbol alone.

### The flaw, stated plainly before anyone else states it for us

**That 100% is inflated, and the reason matters.** Most of the separation comes
from the two libraries shipping different *defaults* — segno emits Micro QR and
boosts ECC, python-qrcode does neither. That is configuration divergence, not
deep behavioural fingerprinting. Configure both identically and the signal
collapses to the `pad0` codeword quirk plus mask-scoring disagreements.

Which exposes the real limitation of the whole attribution idea:

> **An attacker can configure their generator to match the issuer's profile.**

Attribution therefore detects substitution by an adversary using a generic
online generator at its defaults — which is the bulk of real quishing — and
fails against a targeted adversary who profiles the issuer's toolchain first.
It raises cost and catches volume. It is not a security guarantee, and any
claim that implies otherwise is one an expert will break in ten minutes.

Two consequences for drafting:

1. Claim the **detection of profile mismatch**, not the prevention of
   substitution. The honest technical effect is "flags symbols inconsistent with
   the registered issuer profile," and that is enough.
2. An **issuer-registered expected profile** is worth a dependent claim — it
   forces an attacker into reconnaissance of a specific issuer's toolchain
   rather than generic mimicry, and it is the difference between a heuristic and
   a deployable control.

### Where this leaves the project

- Covert channel: closed. Three independent negative assessments plus two
  published references.
- Attribution: not blocked by the steganalysis paper, not blocked by the
  Honeywell print-verification family, demonstrated at 120/120 on a toy corpus,
  and now with its own principal weakness identified and a drafting response to
  it.
- Outstanding before any filing: §101 anchoring, the multi-encoder census (two
  libraries is a toy), print/scan survivability, and the CPC-class searches in
  docs/PRIOR-ART.md.

---

## 2026-09-16 — Multi-encoder census. The attribution claim FAILS.

The gate test. Five independent implementations, each at its own defaults:

    segno           Python  (micro auto, boost_error on)
    python-qrcode   Python  (ECC M, no micro)
    qrcodegen       Python  (Nayuki reference; boosts -- asked M, returned Q)
    node-qrcode     JS      (ECC M)
    qrencode        C       (libqrencode 4.1.1, ECC L)

Features read from the SYMBOL ONLY — micro, version, ecc, mask, mode, first pad
codeword, pad length — recovered by brute-forcing mask and ECC until the payload
parses, exactly as an analyst without prior knowledge would. Random forest.
**Test payloads never seen in training**, which is the control that matters:
without it the classifier learns properties of the strings, not the encoder.

### Result

    run 1   300 train / 150 test payloads   1497 / 746 symbols   55.8%
    run 2   500 train / 250 test payloads   2498 / 1244 symbols  52.8%
    chance with five encoders                                    20.0%

Per encoder (run 2):

    segno           91.2%
    qrencode        59.1%
    qrcodegen       40.0%
    node-qrcode     39.7%
    python-qrcode   34.0%

**This does not clear the bar.** The pre-registered criterion was >90% on unseen
payloads with several independent features contributing. Actual: ~53%, carried
almost entirely by one encoder, with the other four heavily confused with each
other. No single feature exceeds 38% alone.

### Why the earlier 100% was a mirage

`separability.py` reported 120/120 on two libraries. That number was measuring
**segno versus not-segno**. segno is the outlier — it emits Micro QR by default,
boosts the error level, and writes an extra 0x00 pad codeword. Strip it out and
the remaining four are largely standards-convergent: given the same segment
stream, version and ECC level, conforming implementations produce substantially
the same codewords, and the residual disagreements (mask scoring, tie handling)
are too weak and too correlated to separate four libraries.

The depth-3 tree confirms it — the first split is `mode <= 0`, which is just
"is this a Micro QR", i.e. "is this segno".

This is the failure the two-library experiment was structurally unable to show,
and it is the reason the unseen-payload multi-encoder test was worth a day.

### Disposition

**The attribution direction is closed.** Sticker-substitution detection by
encoder fingerprint does not work at usable accuracy against the realistic
population of generators. A detector at ~53% five-way, ~59% on the second-best
encoder, is not deployable for a security decision and is not patentable subject
matter worth pursuing.

What survives the day, honestly stated:

1. `extract.py` — scriptable byte-level QR extraction. **Not unprecedented**;
   QRazyBox already exposes unmasking and Reed-Solomon internals interactively.
   The contribution here is that it is a library for batch measurement rather
   than a UI, which is a modest engineering claim, not a novelty claim.
2. Three measured findings that are true and were not previously written down
   anywhere we found: segno's extra 0x00 pad codeword; silent ECC boosting in
   segno and qrcodegen; and 3/3 false positives from published
   regeneration-and-compare steganalysis when analyst and issuer use different
   libraries. That last one is a real limitation of a published method and is
   the only result here with any claim to being worth publishing.
3. A complete, dated falsification record.

**No provisional will be filed on this work.** Nothing has been publicly
disclosed, so the option to publish items (2) as a short note remains open, and
that decision is now independent of any patent consideration.

---

## 2026-09-16 (later) — Rebuilt as an exhibit. Working artifact.

Patent track closed. Repurposed as a Cipher Museum / Crypto Lab piece, which is
where the prior art stops mattering: the exhibit teaches a known mechanism
rather than claiming a new one.

`src/hide.py` is the missing half — it writes a hidden payload into the pad
codewords, recomputes Reed-Solomon parity so the symbol stays mathematically
valid, and re-renders. Output is a real scannable QR, verified three ways:

    1. OpenCV 4.13 decodes the visible URL from the forged PNG   -> passes
    2. the cooperating decoder recovers 'MEET AT 7'              -> passes
    3. detect.py flags 12/31 pad codewords in one comparison     -> ANOMALOUS

Panel 3 is the exhibit's thesis and the reason it belongs in the museum rather
than in a magic act: **hidden is not the same as unfindable.**

### Implementation note worth keeping

segno stores Reed-Solomon generator polynomials as ALPHA EXPONENTS with the
leading zero term dropped — `GEN_POLY[7]` is `(87, 229, 146, ...)`, the exponent
table, not field elements. Multiplying them as field elements produces a symbol
that renders perfectly and decodes to nothing. It cost one debugging cycle and
the failure was silent, which is the same class of failure this whole file keeps
recording.

### Capacity behaviour, which the exhibit should show rather than hide

The URL used needs version 3; carrying a 9-byte secret needs version 4. Capacity
lives in the gap between payload and symbol capacity, so a payload that nearly
fills its symbol carries nothing at all. `fit_version()` steps up until the
secret fits, and the step is visible — the symbol gets bigger. That is a better
demonstration of the constraint than a paragraph explaining it.

---

## 2026-09-16 (third pass) — one-vs-rest, and a blind spot in our own instrument

External review raised a distinction `attribute.py` did not test. It asked
"which of five libraries made this?" (52.8%). The deployable question is binary:
"is this consistent with the issuer who should have made it?" A parking
authority does not need to name the attacker's software.

### One-vs-rest on the diverse corpus: worse, not better

`src/issuer.py`, 400/200 disjoint payloads, each library as issuer in turn:

    issuer           accepted   FALSE REJECT   FALSE ACCEPT
    node-qrcode         18.7%         81.3%           4.5%
    python-qrcode       26.5%         73.5%           5.9%
    qrcodegen           31.0%         69.0%           5.0%
    qrencode            43.4%         56.6%           7.8%
    segno               88.5%         11.5%           0.6%

False accept is low; false reject is catastrophic. The classifier almost never
lets a foreign code through and almost never lets the issuer's own through
either. At 50,000 codes an 11.5% false-reject rate — the BEST row — is 5,750
alarms.

Why: the features are payload-driven more than library-driven. version, padlen,
mode and ecc are mostly determined by what is being encoded. The library
contributes a perturbation on top. An issuer encoding varied payloads has no
tight profile to belong to.

### Tight template: the realistic issuer, and it does help

A real issuer's codes are near-identical — one URL template, only a serial
changes. Re-ran on `https://park.tallahassee.gov/m/NNNNN`:

    5-way accuracy                81.8%   (up from 52.8% on varied payloads)
    segno as issuer      100% accepted, 0% false reject, 0% false accept
    qrcodegen as issuer   79.0%, 21.0% false reject, 16.8% false accept
    python-qrcode         66.5%, 33.5% false reject, 10.5% false accept

Homogeneous payloads tighten the profile substantially. That part of the
external suggestion is correct and is now measured.

### But two things must be said about that 81.8%

**It is three-way, not five-way.** qrencode and node-qrcode dropped out of the
run entirely.

**And they dropped out because of a blind spot in our own instrument.** This URL
ends in digits, so an optimising encoder splits it into a byte-mode segment plus
a numeric-mode segment. `extract.py` parses **only the first segment**, so those
symbols never matched their payload and were silently discarded.

That is not a null result about qrencode and node-qrcode. It is a measurement
failure, and it is pointing at the one channel the literature says carries the
real implementation differences — segmentation strategy. We have been running
the whole attribution experiment with that channel switched off.

Third instance this week of the same failure class: a check that could not see
anything, reporting as though it had looked.

### Also visible in the raw feature dump

For one template URL, python-qrcode and qrcodegen produce **identical** vectors
— same version, ecc, mask, mode, pad0, padlen. segno differs only in mask (7 vs
3) and pad0 (1 vs 0). So even on the tight template, the separation that exists
rests on two features, one of which is segno's non-standard pad byte.

### Revised disposition

Not "dead". **Unfinished, with a known defect in the instrument.**

- `extract.py` needs multi-segment parsing before any attribution number from
  this repo should be believed. Until then every result here is conditioned on
  single-segment payloads.
- Even at its best measured point, only segno — the outlier — reaches deployable
  error rates. That is not encouraging for the general case.
- The world here is four libraries. Real deployments face hundreds, so every
  false-accept figure above is a lower bound.

Next, in order: (1) multi-segment parsing in `extract.py`; (2) re-run both
experiments with it; (3) only then decide. The patent track stays closed
regardless — this is now a research question with permission to end in "no".

---

## 2026-09-16 — reference list compiled and verification-graded

Full bibliography now in README.md, every entry graded by how far it was
actually checked: [FULL] read in full, [META] authors/venue/DOI/abstract
verified directly, [BIB] verified as appearing in another paper's bibliography,
[2ND] second-hand and unverified.

Two verifications completed:

- **Koptyra, K. & Ogiela, M.R., *Electronics* 13(13):2658, 2024** —
  confirmed, AGH University of Krakow. The suboptimal-segmentation paper. This
  is the closest prior art to encoding-choice steganography.

- **NEW, and closer to our exhibit than anything found so far:
  Koptyra & Ogiela, "Multi-secret Steganography in QR Codes", WSEAS Trans.
  Information Science and Applications 21:533–537, 2024,
  doi:10.37394/23209.2024.21.49.** Two independent secrets in one QR code, in
  two separate domains — one in the segments, one in the modules via error
  correction, recoverable separately because the embedding areas differ.

  This is the nearest published relative of `src/hide.py`. It does not change
  the disposition (the patent track was already closed) but it is now the
  citation the exhibit should credit, and it confirms for the third time that
  the two-layer QR concept is thoroughly occupied.

The same search surfaced further work to review if this is ever taken up again:
"Information Hiding in QR Codes using Segment Manipulation"; "Enhancing Secured
QR Code Large Storage Capacity through Steganography and Compression
Techniques". Neither verified.

Also recorded in the README: [2ND] markers on Sallee 2003 and Grey-box
steganography, which are the references that would defeat an adaptive-capacity
claim. They came from a second-hand review and have NOT been independently
verified. They are load-bearing for that conclusion and should be read before
the conclusion is relied on anywhere outside this repo.
