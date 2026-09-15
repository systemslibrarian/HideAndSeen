(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HideAndSeenEcc = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function groups(symbol) {
    const byCodeword = new Map();
    symbol.moduleMap.forEach((row, rowIndex) => row.forEach((info, columnIndex) => {
      if (info.streamCodeword === undefined || info.streamCodeword === null ||
          info.block === undefined || info.block === null) return;
      if (!byCodeword.has(info.streamCodeword)) {
        byCodeword.set(info.streamCodeword, {
          streamCodeword: info.streamCodeword,
          block: info.block,
          kind: info.role === "error-correction" ? "error-correction" : "data",
          points: []
        });
      }
      byCodeword.get(info.streamCodeword).points.push({ row: rowIndex, column: columnIndex });
    }));
    return Array.from(byCodeword.values()).sort((first, second) =>
      first.streamCodeword - second.streamCodeword);
  }

  function orderedTargets(symbol) {
    const byBlock = symbol.blockSpec.map(() => []);
    for (const group of groups(symbol)) byBlock[group.block].push(group);
    const capacities = symbol.blockSpec.map(spec => Math.floor(spec[1] / 2));
    const safe = [];
    const overflow = [];
    byBlock.forEach((blockGroups, block) => {
      blockGroups.forEach((group, index) => {
        (index < capacities[block] ? safe : overflow).push(group);
      });
    });
    safe.sort((first, second) => {
      const firstIndex = byBlock[first.block].indexOf(first);
      const secondIndex = byBlock[second.block].indexOf(second);
      return firstIndex - secondIndex || first.block - second.block;
    });
    overflow.sort((first, second) => first.streamCodeword - second.streamCodeword);
    return { targets: safe.concat(overflow), capacities };
  }

  function concentratedTargets(symbol) {
    const grouped = groups(symbol);
    const byBlock = symbol.blockSpec.map(() => []);
    for (const group of grouped) byBlock[group.block].push(group);
    return {
      targets: byBlock.flat(),
      capacities: symbol.blockSpec.map(spec => Math.floor(spec[1] / 2))
    };
  }

  function regionTargets(symbol) {
    const candidates = groups(symbol).filter(group => group.kind === "data");
    candidates.forEach(group => {
      group.regionScore = Math.max(...group.points.map(point =>
        point.column * symbol.matrix.length + point.row));
    });
    candidates.sort((first, second) => second.regionScore - first.regionScore ||
      first.streamCodeword - second.streamCodeword);
    return {
      targets: candidates,
      capacities: symbol.blockSpec.map(spec => Math.floor(spec[1] / 2))
    };
  }

  function targetPlan(symbol, strategy) {
    if (strategy === "concentrate") return concentratedTargets(symbol);
    if (strategy === "region") return regionTargets(symbol);
    return orderedTargets(symbol);
  }

  function mutate(symbol, intentionalCount, noiseCount, hiddenBits, strategy) {
    const matrix = symbol.matrix.map(row => row.slice());
    const plan = targetPlan(symbol, strategy || "spread");
    const total = Math.min(plan.targets.length, intentionalCount + noiseCount);
    const changes = [];
    const errorsByBlock = plan.capacities.map(() => 0);
    const bits = String(hiddenBits || "0").replace(/[^01]/g, "") || "0";
    for (let index = 0; index < total; index += 1) {
      const target = plan.targets[index];
      const intentional = index < intentionalCount;
      const bit = intentional ? Number(bits[index % bits.length]) : ((index * 17 + 11) % 2);
      const point = target.points[Math.min(target.points.length - 1, bit ? 6 : 1)];
      matrix[point.row][point.column] ^= 1;
      errorsByBlock[target.block] += 1;
      changes.push({
        row: point.row,
        column: point.column,
        block: target.block,
        streamCodeword: target.streamCodeword,
        intentional,
        bit: intentional ? bit : null
      });
    }
    const predictedCorrectable = errorsByBlock.every((count, block) =>
      count <= plan.capacities[block]);
    return {
      matrix,
      changes,
      errorsByBlock,
      capacities: plan.capacities,
      correctionCapacity: plan.capacities.reduce((sum, count) => sum + count, 0),
      predictedCorrectable,
      hidden: changes.filter(change => change.intentional).map(change => change.bit).join("")
    };
  }

  return Object.freeze({ groups, orderedTargets, concentratedTargets,
    regionTargets, targetPlan, mutate });
});
