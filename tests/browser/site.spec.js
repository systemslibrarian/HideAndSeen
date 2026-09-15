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
  await expect(page.locator("[data-exhibit-index] li")).toHaveCount(13);
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
  await expect(page.locator(".research-entry")).toHaveCount(13);
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
  await page.goto("/exhibits/base-rate.html");
  await expect(page.locator(".exhibit-step.prev")).toContainText("EXHIBIT 12");
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
