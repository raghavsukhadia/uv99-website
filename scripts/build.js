/* UV99 Glazing is a static site — there is no bundler step.
   This "build" verifies every page and its referenced local CSS/JS
   assets are present and non-empty, so `npm run build` fails loudly
   if a file goes missing before a deploy. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const htmlFiles = [
  ...fs.readdirSync(root).filter((f) => f.endsWith(".html")),
  ...fs.readdirSync(path.join(root, "pages")).filter((f) => f.endsWith(".html")).map((f) => path.join("pages", f)),
];

if (htmlFiles.length === 0) {
  console.error("build: no .html pages found");
  process.exit(1);
}

let checked = 0;
const missing = [];

for (const page of htmlFiles) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  if (html.trim().length === 0) {
    missing.push(`${page} (empty)`);
    continue;
  }
  checked++;
  const refs = [...html.matchAll(/(?:href|src)="\/([^"?#]+\.(?:css|js))/g)].map((m) => m[1]);
  for (const ref of refs) {
    const target = path.join(root, ref);
    if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
      missing.push(`${ref} (referenced by ${page})`);
    }
  }
}

if (missing.length) {
  console.error("build FAILED — missing or empty files:");
  for (const m of [...new Set(missing)]) console.error("  - " + m);
  process.exit(1);
}

console.log(`build OK — ${checked} page(s) verified, all local CSS/JS assets present.`);
