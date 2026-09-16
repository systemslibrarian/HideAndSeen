const { test, expect } = require("@playwright/test");

async function expectCanvasInk(page, selector) {
  const pixels = await page.locator(selector).evaluate(canvas => {
    const context = canvas.getContext("2d");
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let light = 0;
    let dark = 0;
    for (let index = 0; index < data.length; index += 16) {
      const value = data[index] + data[index + 1] + data[index + 2];
      if (value < 180) dark += 1;
      if (value > 660) light += 1;
    }
    return { dark, light };
  });
  expect(pixels.dark).toBeGreaterThan(100);
  expect(pixels.light).toBeGreaterThan(100);
}

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
});

test("home renders the exhibit index and a live QR", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hide And Seen" })).toBeVisible();
  await expect(page.locator("[data-exhibit-index] li")).toHaveCount(14);
  await expectCanvasInk(page, "#heroQr");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("href", "#main");
});

test("padding exhibit builds, reveals, and detects", async ({ page }) => {
  await page.goto("/exhibits/padding.html");
  await expectCanvasInk(page, "#heroA");
  await expectCanvasInk(page, "#heroB");
  await expectCanvasInk(page, "#out");
  await expect(page.locator("#p1")).toHaveText("https://ciphermuseum.com");
  await expect(page.locator("#p2")).toHaveText("MEET AT 7");
  await expect(page.locator("#p3")).toContainText("flagged");
  await expect(page.locator("#dump .anomaly")).not.toHaveCount(0);

  await page.locator("#secret").fill("");
  await page.getByRole("button", { name: "Build QR" }).click();
  await expect(page.locator("#p2")).toContainText("Nothing encoded");
  await expect(page.locator("#p3")).toContainText("no padding anomaly");
  await expect(page.locator("#dump .anomaly")).toHaveCount(0);
});

test("padding page has no horizontal overflow", async ({ page }) => {
  await page.goto("/exhibits/padding.html");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("anatomy viewer highlights actual QR layers", async ({ page }) => {
  await page.goto("/learn/anatomy.html");
  await expectCanvasInk(page, "#anatomyQr");
  await expect(page.locator("#overlayControls button")).toHaveCount(12);
  await page.getByRole("button", { name: "Pad codewords" }).click();
  await expect(page.locator("#layerTitle")).toHaveText("Pad codewords");
  await expect(page.locator("#metaCount")).toContainText("modules");
  await page.getByRole("button", { name: "Version information" }).click();
  await expect(page.locator("#metaCount")).toHaveText("36 modules");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("segmentation variants preserve the overt message", async ({ page }) => {
  await page.goto("/exhibits/segmentation.html");
  await expectCanvasInk(page, "#selectedQr");
  await expect(page.locator(".representation-row")).toHaveCount(4);
  await expect(page.locator("#segmentOvert")).toHaveText("MEET AT GATE 7 / CODE 86753091234567890");
  await expect(page.locator("#segmentSequence")).toContainText("ALPHANUMERIC");
  await page.locator("#hiddenBits").selectOption("11");
  await expect(page.locator("#segmentHidden")).toContainText("11");
  await expect(page.locator("#segmentDetect")).toContainText("above the efficient representation");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("ECC laboratory shows that fixed error placement changes the outcome", async ({ page }) => {
  await page.goto("/exhibits/ecc.html");
  await expectCanvasInk(page, "#eccOriginal");
  await expectCanvasInk(page, "#eccModified");
  await expect(page.locator("#eccDecode")).toHaveText("BLOCK PLACEMENT / 2026");
  await expect(page.locator("#eccChanged")).toContainText("16 controlled codeword changes");
  await expect(page.locator("#eccChanged")).toContainText("within its algebraic limit");
  await page.getByRole("button", { name: "Concentrate in one block" }).click();
  await expect(page.locator("#budgetUsed")).toHaveClass(/over/);
  await expect(page.locator("#eccChanged")).toContainText("16 controlled codeword changes");
  await expect(page.locator("#eccChanged")).toContainText("beyond its algebraic limit");
  await expect(page.locator("#eccDecode")).toContainText("could not decode");
  await page.getByRole("button", { name: "Paper-style region" }).click();
  await expect(page.locator("#placementNote")).toContainText("lower-right encoding region");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("multi-secret readers expose separate channels", async ({ page }) => {
  await page.goto("/exhibits/multi-secret.html");
  await expectCanvasInk(page, "#multiQr");
  await expect(page.locator("#multiOvert")).toHaveText("MEET AT GATE 7 / CODE 86753091234567890");
  await expect(page.locator("#multiAOut")).toHaveText("Not read");
  await page.getByRole("button", { name: "Reveal channel A" }).click();
  await expect(page.locator("#multiAOut")).toContainText("01");
  await expect(page.locator("#multiOvert")).toHaveText("Not read");
  await page.getByRole("button", { name: "Reveal channel B" }).click();
  await expect(page.locator("#multiBOut")).toHaveText("10110");
  await page.getByRole("button", { name: "Inspect everything" }).click();
  await expect(page.locator("#multiInspect")).toContainText("changed codewords");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("regeneration distinguishes evidence from interpretation", async ({ page }) => {
  await page.goto("/exhibits/steganalysis.html");
  await expectCanvasInk(page, "#receivedQr");
  await expect(page.locator("#regenDecoded")).toHaveText("https://ciphermuseum.com/profile/8675309");
  await expect(page.locator("#regenVerdict")).toHaveText("CLEAN / FALSE POSITIVE");
  await expect(page.locator("#regenDiff")).toContainText("naive alert");
  await page.getByRole("button", { name: "Same encoder / clean" }).click();
  await expect(page.locator("#regenDiff")).toHaveText("0 module differences");
  await expect(page.locator("#regenVerdict")).toHaveText("CLEAN");
  await page.getByRole("button", { name: "Padding channel / hidden" }).click();
  await expect(page.locator("#regenVerdict")).toHaveText("HIDDEN DATA PRESENT");
  await expect(page.locator("#regenDiff")).toContainText("naive alert");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("fingerprint lab inspects two live encoders", async ({ page }) => {
  await page.goto("/exhibits/fingerprints.html");
  await expectCanvasInk(page, "#fingerprintA");
  await expectCanvasInk(page, "#fingerprintB");
  await expect(page.locator("#fingerprintTable .comparison-row")).toHaveCount(9);
  await expect(page.locator("#fingerprintTable")).toContainText("https://ciphermuseum.com/profile/8675309");
  await expect(page.locator("#profileTable tbody tr")).toHaveCount(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("attribution game uses corrected held-out results", async ({ page }) => {
  await page.goto("/exhibits/attribution.html");
  await expectCanvasInk(page, "#guessQr");
  await expect(page.locator("#guessButtons button")).toHaveCount(5);
  await expect(page.locator("#overallAccuracy")).toHaveText("53.5%");
  await expect(page.locator("#testSymbols")).toHaveText("1250");
  await expect(page.locator("#skippedSymbols")).toHaveText("0");
  await page.locator("#guessButtons button").first().click();
  await expect(page.locator("#trueEncoder")).not.toHaveText("Hidden until you guess");
  await expect(page.locator("#modelPrediction")).toContainText("/");
  await expect(page.locator("#confusionTable tbody tr")).toHaveCount(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("two-level model changes with sampling controls", async ({ page }) => {
  await page.goto("/exhibits/two-level.html");
  await expectCanvasInk(page, "#textureQr");
  await expect(page.locator("#textureReveal")).toHaveText("SEEN");
  await page.getByRole("button", { name: "Ordinary view" }).click();
  await expect(page.locator("#textureReveal")).toContainText("below the simulated reader threshold");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("two QR shadows scan separately and XOR to the secret image", async ({ page }) => {
  await page.goto("/exhibits/secret-sharing.html");
  await expectCanvasInk(page, "#vssQrA");
  await expectCanvasInk(page, "#vssQrB");
  await page.getByRole("button", { name: "Scan A" }).click();
  await page.getByRole("button", { name: "Scan B" }).click();
  await expect(page.locator("#vssScanA")).toHaveText("https://example.org/public-a");
  await expect(page.locator("#vssScanB")).toHaveText("https://example.org/public-b");
  await page.getByRole("button", { name: "Inspect A" }).click();
  await page.getByRole("button", { name: "Inspect B" }).click();
  await expect(page.locator("#vssOutputA")).toContainText("shadow bytes extracted");
  await expect(page.locator("#vssOutputB")).toContainText("shadow bytes extracted");
  await expectCanvasInk(page, "#extractedA");
  await expectCanvasInk(page, "#extractedB");
  await page.getByRole("button", { name: "Combine shares" }).click();
  await expect(page.locator("#recoveredCaption")).toHaveText("RECOVERED EXACTLY / SEEN");
  await expect(page.locator("#vssShadowStatus")).toContainText("Neither extracted shadow matches the secret");
  await expectCanvasInk(page, "#recoveredSecret");
});

test("paper-style dual-message QR decodes under near and far sampling", async ({ page }) => {
  await page.goto("/exhibits/nested.html");
  await expectCanvasInk(page, "#dualComposite");
  await expectCanvasInk(page, "#dualSampled");
  await expect(page.locator("#dualNearOut")).toHaveText("Near view is less");
  await expect(page.locator("#dualFarOut")).toHaveText("Far view is more");
  await expect(page.locator("#dualDecoded")).toHaveText("Near view is less");
  const directDecode = await page.locator("#dualComposite").evaluate(canvas =>
    HideAndSeenDecoder.decodeCanvas(canvas));
  expect(directDecode).toBe("Near view is less");
  await page.getByRole("button", { name: "Sample far" }).click();
  await expect(page.locator("#dualDecoded")).toHaveText("Far view is more");
  await page.getByRole("button", { name: "Sample near" }).click();
  await expect(page.locator("#dualDecoded")).toHaveText("Near view is less");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("distribution model separates naive from shaped selection", async ({ page }) => {
  await page.goto("/exhibits/distribution.html");
  await expectCanvasInk(page, "#normalChart");
  await expectCanvasInk(page, "#naiveChart");
  await expectCanvasInk(page, "#shapedChart");
  await expect(page.locator("#distributionNaive")).toContainText("above the illustrative");
  await expect(page.locator("#distributionTest")).toContainText("flags the naive channel");
  await page.locator("#distributionSamples").fill("1200");
  await expect(page.locator("#distributionCount")).toHaveText("1200");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("challenge padding case identifies the standards anomaly", async ({ page }) => {
  await page.goto("/exhibits/challenge.html?case=padding");
  await expectCanvasInk(page, "#challengeQr");
  await page.getByRole("button", { name: "Padding inspection" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("Padding anomaly detected");
  await page.getByRole("button", { name: "ECC anomalies" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("Reed-Solomon parity is internally consistent");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("#caseTruth")).toHaveText("Hidden data present");
});

test("challenge ECC case detects parity errors after ordinary decode", async ({ page }) => {
  await page.goto("/exhibits/challenge.html?case=ecc");
  await page.getByRole("button", { name: "Ordinary decode" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("Ordinary decode succeeded");
  await page.getByRole("button", { name: "ECC anomalies" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("ECC anomaly detected");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("#caseTruth")).toHaveText("Controlled correctable changes present");
});

test("challenge encoder case exposes misleading regeneration evidence", async ({ page }) => {
  await page.goto("/exhibits/challenge.html?case=encoder");
  await page.getByRole("button", { name: "Regeneration comparison" }).click();
  await expect(page.locator("#toolFinding")).toContainText("mismatch");
  await page.getByRole("button", { name: "ECC anomalies" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("Reed-Solomon parity is internally consistent");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("#caseTruth")).toHaveText("No hidden data");
  await expect(page.locator("#caseMisleading")).toContainText("false positive");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("challenge segmentation case requires segment inspection", async ({ page }) => {
  await page.goto("/exhibits/challenge.html?case=segmentation");
  await page.getByRole("button", { name: "Padding inspection" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("Padding matches the expected pattern");
  await page.getByRole("button", { name: "Segmentation inspection" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("2 data segments");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("#caseTruth")).toHaveText("Hidden selection signal present");
});

test("challenge ordinary case leaves tested checks clean", async ({ page }) => {
  await page.goto("/exhibits/challenge.html?case=ordinary");
  await page.getByRole("button", { name: "Padding inspection" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("Padding matches the expected pattern");
  await page.getByRole("button", { name: "ECC anomalies" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("Reed-Solomon parity is internally consistent");
  await page.getByRole("button", { name: "Regeneration comparison" }).click();
  await expect(page.locator("#toolFinding")).toHaveText("Exact regeneration match");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("#caseTruth")).toHaveText("No hidden data");
});

test("papers page documents every exhibit without private PDF links", async ({ page }) => {
  await page.goto("/learn/papers.html");
  await expect(page.locator(".research-entry")).toHaveCount(14);
  await expect(page.locator(".research-entry#padding")).toContainText("FULL");
  await expect(page.locator(".research-entry#attribution")).toContainText("53.52%");
  await expect(page.locator('a[href*="articles/"]')).toHaveCount(0);
  await expect(page.locator('a[href^="https://doi.org/"]')).not.toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
test("challenge scores a correct hidden call", async ({ page }) => {
  await page.goto("/exhibits/challenge.html?case=padding");
  await page.locator('input[name="verdict"][value="hidden"]').check();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("#caseScore")).toHaveAttribute("data-outcome", "correct");
  await expect(page.locator("#caseScore")).toContainText("Something is hidden");
});

test("challenge names a false positive when a clean case is called hidden", async ({ page }) => {
  await page.goto("/exhibits/challenge.html?case=encoder");
  await page.locator('input[name="verdict"][value="hidden"]').check();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("#caseScore")).toHaveAttribute("data-outcome", "wrong");
  await expect(page.locator("#caseScore")).toContainText("false positive");
});

test("challenge credits a clean call on the innocent encoder case", async ({ page }) => {
  await page.goto("/exhibits/challenge.html?case=encoder");
  await page.locator('input[name="verdict"][value="clean"]').check();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("#caseScore")).toHaveAttribute("data-outcome", "correct");
});

test("challenge treats an undecided verdict as defensible but incomplete", async ({ page }) => {
  await page.goto("/exhibits/challenge.html?case=ecc");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.locator("#caseScore")).toHaveAttribute("data-outcome", "partial");
  await expect(page.locator("#caseScore")).toContainText("Defensible");
});

test("exhibits link to their neighbours in sequence", async ({ page }) => {
  await page.goto("/exhibits/ecc.html");
  const steps = page.locator(".exhibit-step");
  await expect(steps).toHaveCount(2);
  await expect(steps.first()).toContainText("EXHIBIT 02");
  await expect(steps.last()).toContainText("EXHIBIT 04");
  await steps.last().click();
  await expect(page).toHaveURL(/multi-secret\.html$/);
});

test("the first and last exhibits fall back to the index and the papers page", async ({ page }) => {
  await page.goto("/exhibits/padding.html");
  await expect(page.locator(".exhibit-step.prev")).toContainText("Back to all exhibits");
  await expect(page.locator(".exhibit-step.next")).toContainText("EXHIBIT 02");
  await page.goto("/exhibits/adversary.html");
  await expect(page.locator(".exhibit-step.prev")).toContainText("EXHIBIT 13");
  await expect(page.locator(".exhibit-step.next")).toContainText("Research notes");
});

test("base rate shows that a rare target makes most alarms false", async ({ page }) => {
  await page.goto("/exhibits/base-rate.html");
  // The grid itself carries the argument: false alarms swamp real detections.
  const mix = await page.locator("#brGrid").evaluate(canvas => {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let alarmsWrong = 0;
    let alarmsRight = 0;
    for (let index = 0; index < data.length; index += 4) {
      const [r, g, b] = [data[index], data[index + 1], data[index + 2]];
      if (r > 140 && r < 200 && g < 70 && b < 70) alarmsWrong += 1;
      else if (r < 40 && g < 40 && b < 40) alarmsRight += 1;
    }
    return { alarmsWrong, alarmsRight };
  });
  expect(mix.alarmsRight).toBeGreaterThan(0);
  expect(mix.alarmsWrong).toBeGreaterThan(mix.alarmsRight * 10);

  // Defaults: 1 in 1,000 prevalence with a 95% / 95% detector.
  await expect(page.locator("#brAlarms")).toHaveText("510");
  await expect(page.locator("#brTrue")).toHaveText("10");
  await expect(page.locator("#brPpv")).toHaveText("2.0%");
  await expect(page.locator("#brHeadline")).toContainText("98.0% of every alarm you investigate is clean");
});

test("base rate improves when the target is common", async ({ page }) => {
  await page.goto("/exhibits/base-rate.html");
  await page.locator("#brPrevalence").fill("0"); // 1 in 10
  await expect(page.locator("#brPrevalenceValue")).toHaveText("1 in 10");
  const precision = await page.locator("#brPpv").textContent();
  expect(Number.parseFloat(precision)).toBeGreaterThan(50);
});

test("base rate arithmetic conserves the population", async ({ page }) => {
  await page.goto("/exhibits/base-rate.html");
  const totals = await page.evaluate(() => {
    const api = window.HideAndSeenBaseRate;
    return api.PREVALENCES.map(oneIn => {
      const r = api.tally({ oneIn, sensitivity: 0.93, specificity: 0.971 });
      return r.truePositive + r.falseNegative + r.falsePositive + r.trueNegative;
    });
  });
  for (const total of totals) expect(total).toBe(10000);
});

test("the glossary defines the terms exhibit 01 opens with", async ({ page }) => {
  await page.goto("/learn/glossary.html");
  for (const term of ["Codeword", "Terminator", "Pad codeword", "Mask", "Base rate", "Precision"]) {
    await expect(page.locator(".glossary-list dt", { hasText: new RegExp(`^${term}$`) })).toHaveCount(1);
  }
  // The exhibit status tags are defined nowhere else on the site.
  for (const tag of ["LIVE", "MODEL", "DATA"]) {
    await expect(page.locator(".glossary-list dt", { hasText: new RegExp(`^${tag}$`) })).toHaveCount(1);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the glossary is reachable from every page and links back to the exhibits", async ({ page }) => {
  await page.goto("/exhibits/padding.html");
  await page.getByRole("link", { name: "Glossary" }).click();
  await expect(page).toHaveURL(/glossary\.html$/);
  await page.getByRole("link", { name: "exhibit 13" }).click();
  await expect(page).toHaveURL(/base-rate\.html$/);
});

test("the home page explains all three exhibit status tags", async ({ page }) => {
  await page.goto("/");
  const legend = page.locator("#exhibits-title").locator("xpath=../..");
  for (const tag of ["LIVE", "MODEL", "DATA"]) {
    await expect(legend).toContainText(tag);
  }
});

test("a correct prediction is scored and explained", async ({ page }) => {
  await page.goto("/exhibits/padding.html");
  const gate = page.locator(".predict");
  await expect(page.locator(".predict-why")).toBeHidden();
  await gate.locator('input[value="yes"]').check();
  await page.getByRole("button", { name: "Run the padding check" }).click();
  await expect(gate).toHaveAttribute("data-outcome", "correct");
  await expect(page.locator(".predict-outcome")).toHaveText("Correct.");
  await expect(page.locator(".predict-why")).toBeVisible();
});

test("a wrong prediction is corrected rather than hidden", async ({ page }) => {
  await page.goto("/exhibits/fingerprints.html");
  const gate = page.locator(".predict");
  await gate.locator('input[value="yes"]').check(); // wrong: the answer is "no"
  await page.getByRole("button", { name: "Compare encoders" }).click();
  await expect(gate).toHaveAttribute("data-outcome", "wrong");
  await expect(page.locator(".predict-outcome")).toHaveText("Not quite.");
  await expect(page.locator(".predict-why")).toContainText("two honest encoders routinely disagree");
});

test("skipping the prediction still explains, and never blocks the exhibit", async ({ page }) => {
  await page.goto("/exhibits/padding.html");
  await page.getByRole("button", { name: "Run the padding check" }).click();
  await expect(page.locator(".predict-why")).toBeVisible();
  await expect(page.locator(".predict")).not.toHaveAttribute("data-outcome", /.*/);
  // the exhibit's own behaviour is untouched
  await expect(page.locator("#verA, #verB").first()).not.toBeEmpty();
});

test("the base rate gate settles on its own check button", async ({ page }) => {
  await page.goto("/exhibits/base-rate.html");
  const gate = page.locator(".predict");
  await gate.locator('input[value="two"]').check();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(gate).toHaveAttribute("data-outcome", "correct");
});

test("every predicting exhibit carries exactly one gate with an answer", async ({ page }) => {
  const pages = ["padding", "segmentation", "ecc", "fingerprints", "secret-sharing",
                 "steganalysis", "nested", "distribution", "base-rate", "adversary"];
  for (const name of pages) {
    await page.goto(`/exhibits/${name}.html`);
    const gate = page.locator(".predict");
    await expect(gate, name).toHaveCount(1);
    await expect(gate, name).toHaveAttribute("data-predict-answer", /.+/);
    const options = await gate.locator('input[type="radio"]').count();
    expect(options, name).toBeGreaterThanOrEqual(2);
    // the declared answer must actually be one of the options
    const values = await gate.locator('input[type="radio"]').evaluateAll(els => els.map(e => e.value));
    expect(values, name).toContain(await gate.getAttribute("data-predict-answer"));
  }
});

test("every exhibit states what the reader should be able to do", async ({ page }) => {
  const pages = ["padding", "segmentation", "ecc", "multi-secret", "two-level",
                 "secret-sharing", "nested", "steganalysis", "fingerprints",
                 "attribution", "distribution", "challenge", "base-rate", "adversary"];
  for (const name of pages) {
    await page.goto(`/exhibits/${name}.html`);
    const objective = page.locator(".objective");
    await expect(objective, name).toHaveCount(1);
    await expect(objective, name).toContainText("AFTER THIS EXHIBIT YOU SHOULD BE ABLE TO");
    // an actual capability, not a restatement of the title
    const text = (await objective.textContent()).replace("AFTER THIS EXHIBIT YOU SHOULD BE ABLE TO", "").trim();
    expect(text.length, name).toBeGreaterThan(40);
  }
});

test("attribution shows the per-encoder spread, not just the aggregate", async ({ page }) => {
  await page.goto("/exhibits/attribution.html");
  const rows = page.locator("#encoderSpread li");
  await expect(rows).toHaveCount(5);
  // ranked best-first, so the spread is the first thing read
  await expect(rows.first()).toContainText("segno");
  await expect(rows.first()).toContainText("91.2%");
  await expect(rows.last()).toContainText("python-qrcode");
  await expect(rows.last()).toContainText("35.2%");
  const widths = await page.locator("#encoderSpread .encoder-track i").evaluateAll(
    els => els.map(el => Number.parseFloat(el.style.width)));
  expect(widths).toEqual([...widths].sort((a, b) => b - a));
});

test("two good checks still leave an informed adversary a channel", async ({ page }) => {
  await page.goto("/exhibits/adversary.html");
  // defaults: padding inspection + parity check
  await expect(page.locator("#adversaryChecks")).toHaveText("2");
  await expect(page.locator(".coverage-list li.open")).toHaveCount(3);
  await expect(page.locator(".coverage-list li.chosen")).toHaveCount(1);
  await expect(page.locator("#adversaryVerdict")).toContainText("reports clean");
  // work is done, nothing real is found
  await expect(page.locator("#adversaryReal")).toHaveText("0");
  await expect(page.locator("#adversaryPrecision")).toHaveText("0.0%");
  await expect(page.locator("#adversaryAlarms")).not.toHaveText("0");
});

test("covering every channel closes the gap but costs more false alarms", async ({ page }) => {
  await page.goto("/exhibits/adversary.html");
  const alarmsBefore = Number((await page.locator("#adversaryAlarms").textContent()).replace(/,/g, ""));
  for (const id of ["segments", "magnification", "regeneration", "distribution"]) {
    await page.locator(`#det-${id}`).check();
  }
  await expect(page.locator(".coverage-list li.open")).toHaveCount(0);
  await expect(page.locator("#adversaryVerdict")).toContainText("Every channel this site implements is covered");
  await expect(page.locator("#adversaryReal")).toHaveText("10");
  const alarmsAfter = Number((await page.locator("#adversaryAlarms").textContent()).replace(/,/g, ""));
  expect(alarmsAfter).toBeGreaterThan(alarmsBefore);
});

test("the coverage map only names channels and checks the site implements", async ({ page }) => {
  await page.goto("/exhibits/adversary.html");
  const model = await page.evaluate(() => {
    const api = window.HideAndSeenAdversary;
    return {
      detectors: api.DETECTORS.map(d => d.id),
      caught: api.CHANNELS.flatMap(c => c.caughtBy),
      links: api.CHANNELS.map(c => c.href)
    };
  });
  // every catcher named by a channel must be a real detector
  for (const id of model.caught) expect(model.detectors).toContain(id);
  // and every channel must link to an exhibit that exists
  for (const href of model.links) {
    const response = await page.request.get(`/exhibits/${href}`);
    expect(response.status(), href).toBe(200);
  }
});

// The note previously claimed independence was "generous" and that correlated
// checks "would be worse, not better". That is unsound: positive correlation
// shrinks the combined false-alarm rate and the combined coverage together, and
// because false alarms dominate precision at 1-in-1,000, the net effect on
// precision is unsigned. These tests pin the corrected wording.
test("the adversary exhibit claims no direction for the independence assumption", async ({ page }) => {
  await page.goto("/exhibits/adversary.html");
  const note = page.locator(".research-note").first();
  await expect(note).toContainText("simplification rather than a bound");
  await expect(note).toContainText("overstates combined coverage and combined alarm volume together");
  await expect(note).toContainText("can land either side of what this model reports");
  await expect(note).toContainText("The sign of that error is not something this exhibit can establish");
  await expect(note).not.toContainText("generous");
  await expect(note).not.toContainText("worse, not better");
});

test("the research record makes the same unsigned claim about independence", async ({ page }) => {
  await page.goto("/learn/papers.html");
  const simplified = page.locator(".research-entry#adversary .research-facts div", { hasText: "Simplified" });
  await expect(simplified).toContainText("simplification rather than a bound");
  await expect(simplified).toContainText("its net effect there is unsigned");
  await expect(simplified).not.toContainText("generous");
});

test("the site cites no patents", async ({ page }) => {
  const pages = [
    "/", "/learn/papers.html", "/learn/glossary.html", "/learn/anatomy.html",
    ...["padding", "segmentation", "ecc", "multi-secret", "two-level", "secret-sharing",
        "nested", "steganalysis", "fingerprints", "attribution", "distribution",
        "challenge", "base-rate", "adversary"].map(name => `/exhibits/${name}.html`)
  ];
  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator('a[href*="patents.google.com"]'), path).toHaveCount(0);
    await expect(page.locator("main"), path).not.toContainText(/patent/i);
  }
});

// --- Accessibility regressions -------------------------------------------
// These pin fixes made after an axe-core audit. axe itself is not a project
// dependency; these checks are the parts that can be asserted without it.

const A11Y_PAGES = ["/", "/learn/papers.html", "/learn/glossary.html", "/learn/anatomy.html",
  ...["padding", "segmentation", "ecc", "multi-secret", "two-level", "secret-sharing", "nested",
      "steganalysis", "fingerprints", "attribution", "distribution", "challenge", "base-rate",
      "adversary"].map(name => `/exhibits/${name}.html`)];

test("muted text meets WCAG AA contrast on every surface it is used on", async ({ page }) => {
  await page.goto("/");
  const ratios = await page.evaluate(() => {
    const luminance = hex => {
      const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return {
      mutedOnPaper: ratio(token("--muted"), token("--paper")),
      mutedOnBright: ratio(token("--muted"), token("--paper-bright")),
      inkOnPaper: ratio(token("--ink"), token("--paper")),
      darkBandMuted: ratio("#8e9589", token("--dark"))
    };
  });
  // 5.0 rather than 4.5 on purpose. Muted text also sits on tinted surfaces
  // (selected variant buttons, for one), and at exactly 4.5 against --paper it
  // fell under the threshold there. The margin is the point.
  expect(ratios.mutedOnPaper, `${ratios.mutedOnPaper.toFixed(2)}`).toBeGreaterThanOrEqual(5);
  expect(ratios.mutedOnBright, `${ratios.mutedOnBright.toFixed(2)}`).toBeGreaterThanOrEqual(5);
  expect(ratios.inkOnPaper).toBeGreaterThanOrEqual(4.5);
  expect(ratios.darkBandMuted, `${ratios.darkBandMuted.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
});

test("muted text clears AA against the tinted surfaces it actually sits on", async ({ page }) => {
  await page.goto("/exhibits/segmentation.html");
  await page.waitForTimeout(400);
  const worst = await page.evaluate(() => {
    const luminance = rgb => {
      const c = rgb.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    // Computed backgrounds come back as rgb()/rgba() or as color(srgb ...) with
    // 0-1 components, and translucent layers have to be composited rather than
    // taken at face value.
    const parse = s => {
      if (!s) return null;
      const srgb = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
      if (srgb) return [+srgb[1] * 255, +srgb[2] * 255, +srgb[3] * 255, srgb[4] === undefined ? 1 : +srgb[4]];
      const n = (s.match(/[\d.]+/g) || []).map(Number);
      return n.length < 3 ? null : [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
    };
    const over = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
    const effectiveBackground = el => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (!c || c[3] === 0) continue;
        layers.push(c);
        if (c[3] === 1) break;
      }
      let base = [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i -= 1) base = over(layers[i], base);
      return base;
    };
    let lowest = Infinity;
    let where = "";
    for (const el of document.querySelectorAll("small, .representation-cost, .representation-bits, figcaption, .readout > p")) {
      if (!el.textContent.trim()) continue;
      const fg = parse(getComputedStyle(el).color).slice(0, 3);
      const bg = effectiveBackground(el);
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      const r = (hi + 0.05) / (lo + 0.05);
      if (r < lowest) { lowest = r; where = el.className || el.tagName; }
    }
    return { lowest, where };
  });
  expect(worst.lowest, `worst was ${worst.lowest.toFixed(2)} on ${worst.where}`).toBeGreaterThanOrEqual(4.5);
});

test("every canvas has an accessible name", async ({ page }) => {
  let total = 0;
  for (const path of A11Y_PAGES) {
    await page.goto(path);
    const unnamed = await page.locator("canvas").evaluateAll(els => {
      const bad = els.filter(el => !el.getAttribute("aria-label") &&
        !el.getAttribute("aria-labelledby") && !el.textContent.trim());
      return { count: els.length, bad: bad.map(el => el.id || "(no id)") };
    });
    total += unnamed.count;
    expect(unnamed.bad, path).toEqual([]);
  }
  expect(total).toBeGreaterThan(20);
});

test("no page scrolls sideways at 320px, the WCAG reflow width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of A11Y_PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test("text can be doubled without forcing sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  for (const path of A11Y_PAGES) {
    await page.goto(path);
    await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
    await page.waitForTimeout(120);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test("scrollable tables are reachable by keyboard", async ({ page }) => {
  for (const path of ["/exhibits/attribution.html", "/exhibits/fingerprints.html"]) {
    await page.goto(path);
    const wrap = page.locator(".profile-table-wrap");
    await expect(wrap, path).toHaveAttribute("tabindex", "0");
    await expect(wrap, path).toHaveAttribute("aria-label", /.+/);
  }
});
