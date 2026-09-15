(function () {
  "use strict";

  // A prediction is additive: it never blocks the exhibit's own controls. If a
  // reader ignores it and presses the button, the exhibit behaves exactly as it
  // did before, and the explanation is still revealed rather than withheld.
  const groups = document.querySelectorAll("[data-predict]");
  if (!groups.length) return;

  groups.forEach((group, position) => {
    const inputs = Array.from(group.querySelectorAll("input[type=radio]"));
    const name = `predict-${position}`;
    inputs.forEach(input => { input.name = name; });

    const outcome = group.querySelector("[data-predict-outcome]");
    const why = group.querySelector("[data-predict-why]");
    let settled = false;

    function settle() {
      if (settled) return;
      settled = true;
      if (why) why.hidden = false;

      const picked = inputs.find(input => input.checked);
      if (!picked) return;

      const correct = picked.value === group.dataset.predictAnswer;
      group.dataset.outcome = correct ? "correct" : "wrong";
      if (outcome) outcome.textContent = correct ? "Correct." : "Not quite.";
      inputs.forEach(input => { input.disabled = true; });
    }

    // Tie to the exhibit's own reveal where it has one, so the prediction is
    // settled by the same action that answers it.
    const trigger = group.dataset.predictReveal;
    if (trigger) {
      document.querySelectorAll(trigger).forEach(node =>
        node.addEventListener("click", () => window.setTimeout(settle, 0)));
    }

    // Exhibits that render continuously have no single reveal moment, so they
    // carry their own check button instead.
    const own = group.querySelector("[data-predict-check]");
    if (own) own.addEventListener("click", settle);
  });
})();
