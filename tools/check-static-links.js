"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "docs");
const htmlFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith(".html")) htmlFiles.push(file);
  }
}

function targetFor(file, reference) {
  const [pathname, fragment] = reference.split("#", 2);
  const decoded = decodeURIComponent(pathname || path.basename(file));
  const target = path.resolve(path.dirname(file), decoded);
  return { target, fragment };
}

walk(root);
const failures = [];
const attributePattern = /(?:href|src)=["']([^"']+)["']/g;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(attributePattern)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|data:|javascript:)/.test(reference)) continue;
    const { target, fragment } = targetFor(file, reference);
    if (!fs.existsSync(target)) {
      failures.push(`${path.relative(root, file)} -> missing ${reference}`);
      continue;
    }
    if (fragment && target.endsWith(".html")) {
      const targetHtml = fs.readFileSync(target, "utf8");
      const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`id=["']${escaped}["']`).test(targetHtml))
        failures.push(`${path.relative(root, file)} -> missing fragment ${reference}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${htmlFiles.length} HTML pages have valid local links and assets`);
}