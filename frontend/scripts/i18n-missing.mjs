import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dictionaryFiles = readdirSync("src/i18n/locales").map((name) => join("src/i18n/locales", name));
const keys = new Set();
for (const file of dictionaryFiles) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) keys.add(match[1].replace(/\\"/g, '"'));
}
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}
const FRENCH = /[éèêëàâùûçôîï]|\b(le|la|les|de|des|du|un|une|et|ou|pour|sur|dans|avec|pas|est|sont|vous|votre|aucun|aucune)\b/i;
const NOISE = /^(className|class|key|id|to|href|type|variant|tone|size)$/;
let total = 0;
for (const target of process.argv.slice(2)) {
  for (const file of walk(target)) {
    if (file.includes("src\\i18n") || file.includes("src/i18n")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (/^(import |export \* |\/\/|\*|\/\*)/.test(trimmed)) return;
      const found = new Set();
      for (const m of trimmed.matchAll(/"((?:[^"\\]|\\.)+)"/g)) found.add(m[1]);
      for (const m of trimmed.matchAll(/`([^`]*)`/g)) found.add(m[1]);
      for (const m of trimmed.matchAll(/>\s*([^<>{}]*[A-Za-zÀ-ÿ]{3}[^<>{}]*)\s*(?=<|$)/g)) found.add(m[1].trim());
      if (/^[A-ZÀ-Ý«][^<>{}=;()]{5,}$/.test(trimmed)) found.add(trimmed);
      for (const text of found) {
        if (text.length < 4 || !FRENCH.test(text) || /^[a-z0-9:\-/._\s]+$/.test(text) || NOISE.test(text)) continue;
        if (keys.has(text)) continue;
        total += 1;
        console.log(`${file}:${index + 1}  ${text}`);
      }
    });
  }
}
console.log(`\n${total} texte(s) français sans clé dans le dictionnaire.`);