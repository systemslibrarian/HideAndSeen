(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HideAndSeenDistribution = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const cover = [0.28, 0.20, 0.15, 0.12, 0.09, 0.07, 0.05, 0.04];

  function seedValue(text) {
    let value = 2166136261;
    for (const character of String(text)) {
      value ^= character.charCodeAt(0);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function generator(seed) {
    let state = seedValue(seed);
    return function () {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(probabilities, value) {
    let cumulative = 0;
    for (let index = 0; index < probabilities.length; index += 1) {
      cumulative += probabilities[index];
      if (value < cumulative) return index;
    }
    return probabilities.length - 1;
  }

  function counts(probabilities, samples, random) {
    const output = new Array(probabilities.length).fill(0);
    for (let index = 0; index < samples; index += 1)
      output[pick(probabilities, random())] += 1;
    return output;
  }

  function directSecret(samples, random) {
    const output = new Array(cover.length).fill(0);
    for (let index = 0; index < samples; index += 1)
      output[Math.floor(random() * cover.length)] += 1;
    return output;
  }

  function chiSquare(observed, probabilities) {
    const total = observed.reduce((sum, count) => sum + count, 0);
    return observed.reduce((sum, count, index) => {
      const expected = total * probabilities[index];
      return sum + ((count - expected) ** 2 / expected);
    }, 0);
  }

  function variation(observed, probabilities) {
    const total = observed.reduce((sum, count) => sum + count, 0);
    return observed.reduce((sum, count, index) =>
      sum + Math.abs(count / total - probabilities[index]), 0) / 2;
  }

  function simulate(samples, seed) {
    const normal = counts(cover, samples, generator(`${seed}:cover`));
    const naive = directSecret(samples, generator(`${seed}:secret`));
    const shaped = counts(cover, samples, generator(`${seed}:shaped-secret`));
    const result = { normal, naive, shaped };
    for (const key of Object.keys(result)) {
      result[key] = {
        counts: result[key],
        chiSquare: chiSquare(result[key], cover),
        totalVariation: variation(result[key], cover)
      };
    }
    return { cover: cover.slice(), samples, seed, result };
  }

  return Object.freeze({ cover, seedValue, generator, pick, counts,
    directSecret, chiSquare, variation, simulate });
});
