#!/usr/bin/env python3
"""Build the static, corrected attribution dataset used by the teaching site."""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import attribute as attribution
import encoders
import issuer

OUTPUT = ROOT / "docs" / "data" / "attribution.json"
SAMPLE_PAYLOADS = [
    "https://library.example.org/renew/4815",
    "HTTPS://MUSEUM.EXAMPLE/QR-2026",
    "86753091234567890123",
    "Mixed case teaching sample 42",
    "https://parking.example.gov/m/314159",
]


def encoder_results(payloads):
    node = encoders.enc_node_batch(payloads)
    for payload in payloads:
        for function in encoders.PY_ENCODERS:
            result = function(payload)
            yield payload, result
        yield payload, node[payload]


def serialize_matrix(matrix):
    return ["".join("1" if value else "0" for value in row) for row in matrix]


def main():
    train_payloads = 500
    test_payloads = 250
    train_rows, train_labels, train_misses = attribution.build(
        attribution.corpus(train_payloads, seed=20260915)
    )
    test_rows, test_labels, test_misses = attribution.build(
        attribution.corpus(test_payloads, seed=771104)
    )
    libraries = sorted(set(train_labels))
    classifier = RandomForestClassifier(
        n_estimators=200, random_state=0
    ).fit(train_rows, train_labels)
    predictions = classifier.predict(test_rows)
    probabilities = classifier.predict_proba(test_rows)

    confusion = {library: Counter() for library in libraries}
    totals = Counter(test_labels)
    correct = Counter()
    for predicted, actual in zip(predictions, test_labels):
        confusion[actual][predicted] += 1
        if predicted == actual:
            correct[actual] += 1

    issuer_metrics = {}
    for library in libraries:
        accepted, false_reject, false_accept, precision = issuer.one_vs_rest(
            library, train_rows, train_labels, test_rows, test_labels
        )
        issuer_metrics[library] = {
            "accepted": accepted,
            "falseReject": false_reject,
            "falseAccept": false_accept,
            "precision": precision,
        }

    samples = []
    for payload, result in encoder_results(SAMPLE_PAYLOADS):
        features = attribution.read_symbol(result["matrix"], payload)
        if features is None:
            raise RuntimeError(f"could not read {result['lib']} sample {payload!r}")
        row = [features[name] for name in attribution.FEATURES]
        predicted = classifier.predict([row])[0]
        scores = classifier.predict_proba([row])[0]
        probability = {name: float(score) for name, score in zip(classifier.classes_, scores)}
        samples.append({
            "payload": payload,
            "encoder": result["lib"],
            "prediction": predicted,
            "confidence": max(probability.values()),
            "probability": probability,
            "features": features,
            "declared": {
                "version": result.get("version"),
                "ecc": result.get("ecc"),
                "mask": result.get("mask"),
                "micro": result.get("micro"),
            },
            "matrix": serialize_matrix(result["matrix"]),
        })

    accuracy = sum(
        predicted == actual for predicted, actual in zip(predictions, test_labels)
    ) / len(test_labels)
    output = {
        "schemaVersion": 1,
        "method": {
            "trainingPayloads": train_payloads,
            "testPayloads": test_payloads,
            "trainingSymbols": len(train_rows),
            "testSymbols": len(test_rows),
            "payloadsDisjoint": True,
            "randomForestTrees": 200,
            "randomState": 0,
            "featureNames": attribution.FEATURES,
            "skipped": dict(train_misses + test_misses),
        },
        "result": {
            "libraries": libraries,
            "chance": 1 / len(libraries),
            "accuracy": accuracy,
            "perEncoder": {
                library: correct[library] / totals[library]
                for library in libraries
            },
            "confusion": {
                library: {candidate: confusion[library][candidate] for candidate in libraries}
                for library in libraries
            },
            "featureImportance": {
                name: float(value)
                for name, value in zip(attribution.FEATURES, classifier.feature_importances_)
            },
            "issuer": issuer_metrics,
        },
        "samples": samples,
        "limitations": [
            "The five encoders and their chosen defaults are a controlled sample, not the population of QR generators.",
            "Features are influenced by payload as well as implementation.",
            "A prediction is a behavioral classification, not proof of software identity.",
            "An issuer profile is not authentication and can be imitated.",
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(
        f"wrote {OUTPUT.relative_to(ROOT)}: {len(test_rows)} test symbols, "
        f"{accuracy:.1%} accuracy, {len(samples)} game samples"
    )


if __name__ == "__main__":
    main()
