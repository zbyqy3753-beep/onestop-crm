// מדבקות QR לסניפי מוביסל: 3×3 ס״מ, רקע שקוף, אחת לכל סניף.
//
// שימוש: node tools/mobicell/make-stickers.mjs <תיקיית יעד>
//
// לכל סניף: SVG בגודל מדויק של 30 מ״מ (וקטורי, לבית דפוס) ו-PNG שקוף
// ב-600 DPI (709 פיקסלים). בנוסף `כל-הסניפים.html`, דף A4 עם כל הקודים
// בגודל אמיתי ושם הסניף מתחת לכל אחד (מחוץ לשטח המדבקה), להדפסה לבדיקה.
//
// ⚠️ הקישור הוא ה-QR הכללי של הסניף (`/s/<code>`). מכאן הלקוח בוחר באתר
// איזה עובד הפנה אותו. אסור לשנות `code` בסניף אחרי שהמדבקה הודפסה.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = process.argv[2];
if (!out) {
  console.error("שימוש: node tools/mobicell/make-stickers.mjs <תיקיית יעד>");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const src = readFileSync(join(ROOT, "src", "lib", "domain", "branches.ts"), "utf8");
const origin = src.match(/BRANCH_SITE_ORIGIN = "([^"]+)"/)[1];
const branches = [...src.matchAll(/\{ code: "([a-z0-9-]+)", name: "([^"]+)"/g)].map((m) => ({
  code: m[1],
  name: m[2],
}));

const SIZE_MM = 30;
const DPI = 600;
const PX = Math.round((SIZE_MM / 25.4) * DPI); // 709
// Q: עמיד ל-25% פגיעה. מדבקה על דלפק נשרטת ומתלכלכת.
const OPTS = { errorCorrectionLevel: "Q", margin: 2, color: { dark: "#000000", light: "#00000000" } };

const cells = [];
for (const b of branches) {
  const url = `${origin}/s/${b.code}`;
  const file = `QR-${b.name}`.replace(/[\\/:*?"<>|]/g, "");

  const svg = (await QRCode.toString(url, { ...OPTS, type: "svg" })).replace(
    "<svg ",
    `<svg width="${SIZE_MM}mm" height="${SIZE_MM}mm" `,
  );
  writeFileSync(join(out, `${file}.svg`), svg);

  const png = await QRCode.toBuffer(url, { ...OPTS, type: "png", width: PX });
  await sharp(png).withMetadata({ density: DPI }).png().toFile(join(out, `${file}.png`));

  cells.push(`<figure><div class="qr">${svg}</div><figcaption>${b.name}</figcaption></figure>`);
}

writeFileSync(
  join(out, "כל-הסניפים.html"),
  `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>מדבקות QR – סניפי מוביסל</title>
<style>
@page { size: A4; margin: 10mm; }
body { margin: 0; font-family: Arial, sans-serif; }
main { display: grid; grid-template-columns: repeat(5, 36mm); gap: 4mm 2mm; justify-content: center; }
figure { margin: 0; text-align: center; break-inside: avoid; }
.qr { width: ${SIZE_MM}mm; height: ${SIZE_MM}mm; margin: 0 auto; outline: 0.2mm dashed #bbb; }
.qr svg { display: block; width: 100%; height: 100%; }
figcaption { font-size: 7pt; margin-top: 1mm; line-height: 1.2; }
</style>
<main>${cells.join("\n")}</main></html>`,
);

console.log(`${branches.length} סניפים: SVG בגודל ${SIZE_MM} מ״מ ו-PNG שקוף ${PX}×${PX} ב-${DPI} DPI → ${out}`);
