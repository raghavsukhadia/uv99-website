/* UV99 Glazing — image optimiser.
   ----------------------------------------------------------------------------
   Turns the large source PNGs into web-sized WebP files, next to the originals.
   The originals are never touched or deleted; the pages reference the .webp.

       npm install --no-save sharp      # one-off, not added to package.json
       node scripts/optimize-images.js          # only (re)builds what is missing/stale
       node scripts/optimize-images.js --force  # rebuild everything

   Output is named  <name>-<pixel width>.webp  (always lower-case, no spaces),
   so several widths of one picture can feed a srcset. A width of 0 means "the
   source's own width"; a width larger than the source is clamped to it.

   To add a picture: drop the PNG/JPG in place, add a line to JOBS below, run
   the script, then reference the .webp (see index.html for srcset examples).

   Videos are re-encoded with ffmpeg rather than this script, e.g.
       ffmpeg -i in.mp4 -an -c:v libx264 -preset slow -crf 26 -movflags +faststart out.mp4 */

const fs = require("fs");
const path = require("path");

let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error('optimize-images: "sharp" is not installed. Run:  npm install --no-save sharp');
  process.exit(1);
}

const IMG = path.join(__dirname, "..", "assets", "images");
const FORCE = process.argv.includes("--force");

/* quality: WebP quality 1-100. alpha: quality of the transparency channel.
   Dark, smooth-gradient renders band easily, so they get a higher quality. */
const PHOTO = { quality: 80 };
const DARK = { quality: 84 };
const CUTOUT = { quality: 86, alphaQuality: 95 };
const ICON = { quality: 88, alphaQuality: 95 };
const LOGO = { nearLossless: true, quality: 60 }; // keeps hard edges crisp, ~40% smaller than lossless

const CARD_W = [480, 800, 1200];
const HERO_W = [828, 1280, 0];

/* [source relative to assets/images, output name, widths, options] */
const JOBS = [
  // --- landing page hero + cards -------------------------------------------
  ["hero/uv99-plus-one-stage.png", "hero/uv99-plus-one-stage", [0], DARK],
  ["products/SIR-cutout.png", "products/sir-cutout", [0], CUTOUT],
  ["hero/rangerover.png", "hero/rangerover", CARD_W, PHOTO],
  ["hero/CARINTERIOR.png", "hero/car-interior", CARD_W, PHOTO],
  ["hero/withuv99.png", "hero/with-uv99", CARD_W, PHOTO],
  ["sections/glazing.png.png", "sections/glazing", [640, 1000, 0], PHOTO],

  // --- about page -----------------------------------------------------------
  ["sections/CAR.png", "sections/car", [640, 960, 1280, 0], PHOTO],
  ["sections/UV.png", "sections/uv", [1400], PHOTO],
  ["sections/RAINBOW.png", "sections/rainbow", [1400], PHOTO],
  ["sections/HEAT.png", "sections/heat", [1400], PHOTO],
  ["sections/layers.png", "sections/layers", [1100, 0], DARK],
  ["sections/CAR 10.png", "sections/car-10", [1100, 0], DARK],

  // --- products page --------------------------------------------------------
  ["hero/new product.png", "hero/new-product", HERO_W, DARK],
  ["products/UV99NEW70.png", "products/uv99-70", [480, 800, 0], PHOTO],
  ["products/UV99NEW50.png", "products/uv99-50", [480, 800, 0], PHOTO],
  ["products/UV99PRO70.png", "products/uv-pro-70", [480, 800, 0], PHOTO],
  ["products/UV99PRO50.png", "products/uv-pro-50", [480, 800, 0], PHOTO],
  ["products/UV99+1.png", "products/uv99-plus-one", [480, 0], CUTOUT],
  ["sections/BEFORE.png", "sections/before", [800, 1200, 0], PHOTO],
  ["sections/AFTER.png", "sections/after", [800, 1200, 0], PHOTO],
  ["hero/mustang.png", "hero/mustang", [640, 1000, 0], PHOTO],
  ["hero/protection.png", "hero/protection", [640, 1000, 0], PHOTO],

  // --- UV99+1 page ----------------------------------------------------------
  ["hero/layers.png", "hero/layers", [800, 1280, 0], CUTOUT],
  ["hero/bottom.png", "hero/bottom", [800, 1280, 0], CUTOUT],

  // --- shared ---------------------------------------------------------------
  ["logos/uv99-logo.png", "logos/uv99-logo", [360], LOGO],
  ["logos/logo.png", "logos/logo", [0], LOGO],
  ["icons/WHATSAPP.png", "icons/whatsapp", [64], ICON],
];

(async () => {
  let made = 0;
  let skipped = 0;
  let bytesIn = 0;
  let bytesOut = 0;

  for (const [src, out, widths, opts] of JOBS) {
    const srcPath = path.join(IMG, src);
    if (!fs.existsSync(srcPath)) {
      console.warn(`  missing source: ${src}`);
      continue;
    }
    const srcStat = fs.statSync(srcPath);
    const { width: natural } = await sharp(srcPath).metadata();
    bytesIn += srcStat.size;

    for (const w of widths) {
      const width = w === 0 ? natural : Math.min(w, natural);
      const outPath = path.join(IMG, `${out}-${width}.webp`);
      if (!FORCE && fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= srcStat.mtimeMs) {
        skipped++;
        bytesOut += fs.statSync(outPath).size;
        continue;
      }
      await sharp(srcPath)
        .resize({ width, withoutEnlargement: true })
        .webp({ effort: 6, smartSubsample: true, ...opts })
        .toFile(outPath);
      const size = fs.statSync(outPath).size;
      bytesOut += size;
      made++;
      console.log(`  ${path.relative(IMG, outPath).replace(/\\/g, "/").padEnd(44)} ${String(Math.round(size / 1024)).padStart(5)} KB`);
    }
  }

  console.log(`\noptimize-images: ${made} written, ${skipped} up to date.`);
  console.log(`  sources ${(bytesIn / 1048576).toFixed(1)} MB (one pass) -> all WebP variants ${(bytesOut / 1048576).toFixed(1)} MB`);
})();
