import { BRAND, type Row, type Slide, type Title, type Tone } from "@/lib/posts/templates";

/**
 * מצייר שקף של "אלירן תקשורת" על קנבס 1080×1350 (4:5, המקסימום שאינסטגרם
 * לא חותך).
 *
 * ⚠️ העיצוב הוא הפוסטר המאושר של אלירן (הסקיל `eliran-tikshoret-design`,
 * `templates/poster-a4.html`) מתורגם לקנבס, ולא פרשנות שלו: ראש המותג עם
 * אייקון ה-Wi-Fi, מרקר צהוב ובלוק כחול בכותרת, איור הטלפון-סים-מטבעות,
 * כרטיסים עם פיל כחול, כרטיס יצירת קשר מפוצל ושורת הלוגואים. המשתמש פסל
 * גרסה ש"רק לקחה את הצבעים". שינוי כאן נבדק מול הפוסטר, לא מול הזיכרון.
 *
 * ⚠️ קנבס ולא צילום של DOM: ספריות "HTML לתמונה" עוברות דרך
 * `foreignObject`, ובספארי באייפון, המכשיר של אלירן, גופני רשת לא נטענים
 * שם. בקנבס הגופן נטען פעם אחת דרך `document.fonts` ומשמש ישירות.
 */

export const W = 1080;
export const H = 1350;
const PAD = 64;
const RIGHT = W - PAD;
const WIDTH = W - PAD * 2;

const C = {
  navy: "#0B2545",
  ink2: "#3D5A80",
  blue: "#1E6FD9",
  blue2: "#1559B8",
  blueLight: "#2A86F0",
  yellow: "#FFD84D",
  yellow2: "#FFE88A",
  green: "#22A45D",
  red: "#E0393E",
  line: "#CFE4F3",
  white: "#FFFFFF",
};

const TONE: Record<Tone, string> = { navy: C.navy, blue: C.blue, red: C.red };

export interface Fonts {
  sans: string;
  script: string;
}

/** הלוגואים של שקף הסיום, לפי הסדר בפוסטר. `null` = אריח טקסט. */
export const LOGOS = [
  "cellcom.png", "partner.png", "pelephone.png", "hot.png",
  "hotnet.png", "golan.png", "wecom.png", "bezeq.svg",
  "yes.png", "string.png", "next-tv.svg", "bezeq-international.svg",
  "cellcom-energy", "hotenergy.png", "walla.png", null,
] as const;

export type LogoImages = Record<string, HTMLImageElement>;

export function loadLogos(): Promise<LogoImages> {
  const files = [...new Set<string>(LOGOS.filter((l) => l !== null && l.includes(".")) as string[])];
  return Promise.all(
    files.map(
      (f) =>
        new Promise<[string, HTMLImageElement | null]>((resolve) => {
          const img = new Image();
          img.onload = () => resolve([f, img]);
          img.onerror = () => resolve([f, null]);
          // `/brand` פתוח ב-proxy גם בלי סשן, כמו שאר נכסי המותג
          img.src = `/brand/eliran-logos/${f}`;
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs.filter((p): p is [string, HTMLImageElement] => !!p[1])));
}

/* ── עזרים ───────────────────────────────────────────────────────────── */

type Ctx = CanvasRenderingContext2D;

const f = (fonts: Fonts, weight: number, size: number) => `${weight} ${Math.round(size)}px ${fonts.sans}`;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function shadow(ctx: Ctx, color: string, blur: number, dy: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
}

function noShadow(ctx: Ctx) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function wrap(ctx: Ctx, text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** טקסט מימין לשמאל, מיושר לימין, בקו בסיס `y`. */
function textR(ctx: Ctx, s: string, x: number, y: number) {
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillText(s, x, y);
}

function wifi(ctx: Ctx, cx: number, cy: number, s: number, width: number) {
  ctx.strokeStyle = C.white;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  for (const r of [1, 0.66, 0.33]) {
    ctx.beginPath();
    ctx.arc(cx, cy, s * r, Math.PI * 1.22, Math.PI * 1.78);
    ctx.stroke();
  }
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.arc(cx, cy, width * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

/* ── רקע ומותג ───────────────────────────────────────────────────────── */

function background(ctx: Ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#F7FBFF");
  g.addColorStop(0.45, "#EEF7FD");
  g.addColorStop(1, "#E3F1FC");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#DCEEFC";
  ctx.beginPath();
  ctx.arc(90, 80, 280, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#E4F3FD";
  ctx.beginPath();
  ctx.arc(W + 0, 890, 190, 0, Math.PI * 2);
  ctx.fill();
}

/** ראש המותג: ריבוע כחול עם Wi-Fi, "אלירן תקשורת" ושורת התיאור. מחזיר את התחתית. */
function brand(ctx: Ctx, fonts: Fonts): number {
  const top = 52;
  const size = 68;
  const x = RIGHT - size;
  shadow(ctx, "rgba(21,89,184,0.3)", 22, 10);
  const g = ctx.createLinearGradient(x, top, x + size, top + size);
  g.addColorStop(0, C.blueLight);
  g.addColorStop(1, C.blue2);
  ctx.fillStyle = g;
  rr(ctx, x, top, size, size, 20);
  ctx.fill();
  noShadow(ctx);
  wifi(ctx, x + size / 2, top + size * 0.7, 26, 4.4);

  const tr = x - 16;
  ctx.font = f(fonts, 900, 42);
  ctx.fillStyle = C.navy;
  textR(ctx, "אלירן ", tr, top + 38);
  const w1 = ctx.measureText("אלירן ").width;
  ctx.fillStyle = C.blue;
  textR(ctx, "תקשורת", tr - w1, top + 38);
  ctx.font = f(fonts, 600, 21);
  ctx.fillStyle = C.ink2;
  textR(ctx, BRAND.tagline, tr, top + 68);
  return top + size;
}

/* ── כותרת: מרקר צהוב + בלוק כחול ─────────────────────────────────────── */

/** מצייר (או רק מודד, `dry`) כותרת. מחזיר את הגובה. */
function title(ctx: Ctx, fonts: Fonts, t: Title, y: number, size: number, width: number, dry: boolean): number {
  const lh = size * 1.12;
  ctx.font = f(fonts, 900, size);
  ctx.direction = "rtl";
  const lines = wrap(ctx, t.text, width);
  let h = 0;
  lines.forEach((ln) => {
    const base = y + h + size * 0.88;
    if (!dry) {
      const at = t.mark ? ln.indexOf(t.mark) : -1;
      if (at >= 0) {
        const before = ctx.measureText(ln.slice(0, at)).width;
        const mw = ctx.measureText(t.mark!).width;
        ctx.save();
        ctx.translate(RIGHT - before - mw / 2, base - size * 0.32);
        ctx.rotate((-1 * Math.PI) / 180);
        shadow(ctx, "rgba(11,37,69,0.08)", 0, 6);
        ctx.fillStyle = C.yellow;
        rr(ctx, -mw / 2 - 16, -size * 0.56, mw + 32, size * 0.98, 14);
        ctx.fill();
        ctx.restore();
        noShadow(ctx);
      }
      ctx.fillStyle = C.navy;
      textR(ctx, ln, RIGHT, base);
    }
    h += lh;
  });

  if (t.block) {
    ctx.font = f(fonts, 900, size);
    const bl = wrap(ctx, t.block, width - 36);
    bl.forEach((ln) => {
      const bw = ctx.measureText(ln).width + 36;
      const top = y + h + 10;
      if (!dry) {
        ctx.fillStyle = C.blue;
        rr(ctx, RIGHT - bw, top, bw, size * 1.14, 14);
        ctx.fill();
        ctx.fillStyle = C.white;
        textR(ctx, ln, RIGHT - 18, top + size * 0.9);
      }
      h += size * 1.14 + 10;
    });
  }
  return h;
}

/** פסקה, עם אופציה לקו תחתון צהוב על חלק ממנה. */
function para(
  ctx: Ctx,
  fonts: Fonts,
  text: string,
  y: number,
  o: { size: number; weight: number; color: string; width: number; underline?: string },
  dry: boolean,
): number {
  const lh = o.size * 1.38;
  ctx.font = f(fonts, o.weight, o.size);
  ctx.direction = "rtl";
  const lines = wrap(ctx, text, o.width);
  if (!dry) {
    lines.forEach((ln, i) => {
      const base = y + lh * i + o.size;
      const at = o.underline ? ln.indexOf(o.underline) : -1;
      if (at >= 0) {
        const before = ctx.measureText(ln.slice(0, at)).width;
        const uw = ctx.measureText(o.underline!).width;
        ctx.fillStyle = C.yellow2;
        ctx.fillRect(RIGHT - before - uw, base - o.size * 0.28, uw, o.size * 0.42);
      }
      ctx.fillStyle = o.color;
      textR(ctx, ln, RIGHT, base);
    });
  }
  return lh * lines.length;
}

/* ── איור: טלפון + סים + מטבעות, ושרבוטים ─────────────────────────────── */

function art(ctx: Ctx, left: number, top: number) {
  // טלפון
  ctx.save();
  ctx.translate(left + 145, top + 182);
  ctx.rotate((-8 * Math.PI) / 180);
  shadow(ctx, "rgba(11,37,69,0.28)", 50, 30);
  const body = ctx.createLinearGradient(-115, -182, 115, 182);
  body.addColorStop(0, "#2D3E57");
  body.addColorStop(1, "#0E1B2E");
  ctx.fillStyle = body;
  rr(ctx, -115, -182, 230, 365, 44);
  ctx.fill();
  noShadow(ctx);
  const scr = ctx.createLinearGradient(-60, -168, 60, 168);
  scr.addColorStop(0, "#3E9BFF");
  scr.addColorStop(0.55, "#1E6FD9");
  scr.addColorStop(1, "#1450A8");
  ctx.fillStyle = scr;
  rr(ctx, -101, -168, 202, 337, 34);
  ctx.fill();
  ctx.fillStyle = "#0E1B2E";
  rr(ctx, -43, -156, 86, 22, 11);
  ctx.fill();
  // פסי קליטה
  ctx.fillStyle = C.white;
  [26, 42, 58].forEach((h, i) => {
    rr(ctx, -46 + i * 25, -40 - h, 17, h, 5);
    ctx.fill();
  });
  ctx.globalAlpha = 0.55;
  rr(ctx, -46 + 3 * 25, -40 - 76, 17, 76, 5);
  ctx.fill();
  ctx.globalAlpha = 1;
  wifi(ctx, 0, 92, 56, 9);
  ctx.restore();

  // סים
  ctx.save();
  ctx.translate(left + 256, top + 306);
  ctx.rotate((10 * Math.PI) / 180);
  shadow(ctx, "rgba(11,37,69,0.22)", 34, 20);
  const sim = ctx.createLinearGradient(-56, -71, 56, 71);
  sim.addColorStop(0, "#FFFFFF");
  sim.addColorStop(1, "#E9EEF4");
  ctx.fillStyle = sim;
  ctx.beginPath();
  ctx.roundRect(-56, -71, 112, 142, [48, 18, 18, 18]);
  ctx.fill();
  noShadow(ctx);
  const chip = ctx.createLinearGradient(-32, -38, 32, 38);
  chip.addColorStop(0, "#F6D676");
  chip.addColorStop(1, "#D9A92E");
  ctx.fillStyle = chip;
  rr(ctx, -32, -38, 64, 76, 14);
  ctx.fill();
  ctx.fillStyle = "rgba(120,80,0,0.45)";
  ctx.fillRect(-32, -1.5, 64, 3);
  ctx.fillRect(-1.5, -38, 3, 76);
  ctx.restore();

  // מטבעות
  const coin = (cx: number, cy: number, rx: number, ry: number, fill: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "#B57E0E";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  };
  const cg = (y: number) => {
    const g = ctx.createLinearGradient(0, y - 11, 0, y + 11);
    g.addColorStop(0, "#FFE07A");
    g.addColorStop(1, "#E0A41E");
    return g;
  };
  const bx = left;
  const by = top + 335;
  [[74, "#D99A1A"], [64, "#E3A925"], [54, "#E9B42F"]].forEach(([dy, c]) => coin(bx + 56, by + (dy as number), 43, 11, c as string));
  coin(bx + 56, by + 45, 43, 11, cg(by + 45));
  coin(bx + 134, by + 75, 40, 10.5, "#D99A1A");
  coin(bx + 134, by + 66, 40, 10.5, cg(by + 66));
  ctx.fillStyle = "#9A6A06";
  ctx.font = "900 18px sans-serif";
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText("₪", bx + 56, by + 51);
  ctx.fillText("₪", bx + 134, by + 72);
}

function doodles(ctx: Ctx, sparkX: number, sparkY: number, arrowX: number, arrowY: number) {
  ctx.strokeStyle = C.navy;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const s = 60 / 70;
  ctx.beginPath();
  [[10, 60, 24, 40], [30, 64, 38, 38], [50, 62, 56, 40]].forEach(([a, b, c, d]) => {
    ctx.moveTo(sparkX + a * s, sparkY + b * s);
    ctx.lineTo(sparkX + c * s, sparkY + d * s);
  });
  ctx.stroke();
  const k = 80 / 90;
  ctx.beginPath();
  ctx.moveTo(arrowX + 6 * k, arrowY + 30 * k);
  ctx.bezierCurveTo(arrowX + 30 * k, arrowY + 6 * k, arrowX + 60 * k, arrowY + 54 * k, arrowX + 84 * k, arrowY + 26 * k);
  ctx.moveTo(arrowX + 70 * k, arrowY + 16 * k);
  ctx.lineTo(arrowX + 84 * k, arrowY + 26 * k);
  ctx.lineTo(arrowX + 72 * k, arrowY + 38 * k);
  ctx.stroke();
}

/* ── כרטיס עם פיל ─────────────────────────────────────────────────────── */

function rowsHeight(rows: Row[]) {
  return rows.reduce((h, r) => h + (r.sub ? 120 : 96), 0);
}

function checksHeight(ctx: Ctx, fonts: Fonts, items: string[], width: number) {
  ctx.font = f(fonts, 700, 38);
  return items.reduce((h, it) => h + Math.max(52, wrap(ctx, it, width - 70).length * 48) + 22, 0);
}

function card(
  ctx: Ctx,
  fonts: Fonts,
  s: Extract<Slide, { kind: "card" }>,
  y: number,
  dry: boolean,
): number {
  const inner = WIDTH - 80;
  const bodyH = (s.rows ? rowsHeight(s.rows) : 0) + (s.checks ? checksHeight(ctx, fonts, s.checks, inner) : 0);
  const h = 54 + bodyH + 20;
  if (dry) return h;

  shadow(ctx, "rgba(11,37,69,0.08)", 34, 12);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  rr(ctx, PAD, y, WIDTH, h, 30);
  ctx.fill();
  noShadow(ctx);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  rr(ctx, PAD, y, WIDTH, h, 30);
  ctx.stroke();

  // הפיל, יושב על הקצה העליון
  ctx.font = f(fonts, 900, 34);
  const pw = ctx.measureText(s.pill).width;
  ctx.font = f(fonts, 900, 25);
  const tw = s.tag ? ctx.measureText(s.tag).width + 28 : 0;
  const pillW = pw + (s.tag ? tw + 12 : 0) + 64;
  const pillH = 60;
  const px = W / 2 - pillW / 2;
  const py = y - 30;
  shadow(ctx, "rgba(21,89,184,0.3)", 18, 8);
  ctx.fillStyle = C.blue2;
  rr(ctx, px, py, pillW, pillH, pillH / 2);
  ctx.fill();
  noShadow(ctx);
  ctx.fillStyle = C.white;
  ctx.font = f(fonts, 900, 34);
  textR(ctx, s.pill, px + pillW - 32, py + 42);
  if (s.tag) {
    const tx = px + 32;
    ctx.fillStyle = C.yellow;
    rr(ctx, tx, py + 13, tw, 36, 18);
    ctx.fill();
    ctx.fillStyle = C.navy;
    ctx.font = f(fonts, 900, 25);
    ctx.textAlign = "center";
    ctx.direction = "rtl";
    ctx.fillText(s.tag, tx + tw / 2, py + 40);
  }

  let cy = y + 44;
  const r = RIGHT - 40;
  const l = PAD + 40;
  s.rows?.forEach((row, i) => {
    const rh = row.sub ? 120 : 96;
    if (i > 0) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l, cy);
      ctx.lineTo(r, cy);
      ctx.stroke();
    }
    const mid = cy + rh / 2;
    ctx.fillStyle = C.navy;
    ctx.font = f(fonts, 900, 40);
    textR(ctx, row.label, r, row.sub ? mid - 4 : mid + 14);
    if (row.sub) {
      ctx.fillStyle = C.ink2;
      ctx.font = f(fonts, 600, 27);
      textR(ctx, wrap(ctx, row.sub, inner * 0.52)[0], r, mid + 34);
    }
    // ערך משמאל; "לפני ←" מימינו
    ctx.direction = "rtl";
    ctx.textAlign = "left";
    ctx.font = f(fonts, 900, 42);
    ctx.fillStyle = row.tone ? TONE[row.tone] : C.navy;
    ctx.fillText(row.value, l, mid + 15);
    if (row.from) {
      const vw = ctx.measureText(row.value).width;
      ctx.fillStyle = C.navy;
      ctx.fillText(`${row.from} ← `, l + vw, mid + 15);
    }
    cy += rh;
  });

  s.checks?.forEach((it) => {
    ctx.font = f(fonts, 700, 38);
    const lines = wrap(ctx, it, inner - 70);
    const ih = Math.max(52, lines.length * 48);
    const top = cy + 11;
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.arc(r - 26, top + 26, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(r - 37, top + 27);
    ctx.lineTo(r - 29, top + 35);
    ctx.lineTo(r - 15, top + 19);
    ctx.stroke();
    ctx.fillStyle = C.navy;
    const textTop = top + (ih - lines.length * 48) / 2;
    lines.forEach((ln, i) => textR(ctx, ln, r - 70, textTop + 48 * i + 37));
    cy += ih + 22;
  });
  return h;
}

function imp(ctx: Ctx, fonts: Fonts, box: { title: string; text: string }, y: number, dry: boolean): number {
  const h = 118;
  if (dry) return h;
  ctx.fillStyle = C.yellow2;
  rr(ctx, PAD, y, WIDTH, h, 26);
  ctx.fill();
  ctx.setLineDash([10, 7]);
  ctx.strokeStyle = "#E9B908";
  ctx.lineWidth = 2;
  rr(ctx, PAD, y, WIDTH, h, 26);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "46px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("👍", RIGHT - 58, y + 74);
  ctx.fillStyle = C.navy;
  ctx.font = f(fonts, 900, 34);
  textR(ctx, box.title, RIGHT - 104, y + 52);
  ctx.fillStyle = C.ink2;
  ctx.font = f(fonts, 600, 25);
  textR(ctx, box.text, RIGHT - 104, y + 90);
  return h;
}

/** פס יצירת קשר בתחתית שקפי התוכן. */
function strip(ctx: Ctx, fonts: Fonts) {
  const h = 92;
  const y = H - 120 - h;
  shadow(ctx, "rgba(21,89,184,0.28)", 30, 14);
  const g = ctx.createLinearGradient(PAD, y, RIGHT, y + h);
  g.addColorStop(0, C.blueLight);
  g.addColorStop(1, C.blue2);
  ctx.fillStyle = g;
  rr(ctx, PAD, y, WIDTH, h, h / 2);
  ctx.fill();
  noShadow(ctx);
  ctx.fillStyle = C.white;
  ctx.font = f(fonts, 800, 28);
  const ask = "👍 שלחו לי צילום של החשבון";
  textR(ctx, ask, RIGHT - 30, y + 56);
  const askW = ctx.measureText(ask).width;
  ctx.font = f(fonts, 900, 40);
  ctx.direction = "ltr";
  ctx.textAlign = "right";
  ctx.fillText(BRAND.phone, RIGHT - 30 - askW - 36, y + 60);
  // וואטסאפ
  ctx.font = f(fonts, 800, 24);
  const ww = ctx.measureText("וואטסאפ").width + 36;
  ctx.fillStyle = C.green;
  rr(ctx, PAD + 18, y + 24, ww, 44, 22);
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillText("וואטסאפ", PAD + 18 + ww / 2, y + 54);
}

function footer(ctx: Ctx, fonts: Fonts, index: number, total: number) {
  const y = H - 70;
  ctx.font = f(fonts, 800, 28);
  ctx.fillStyle = C.blue;
  textR(ctx, "החליקו ←", RIGHT, y + 10);
  let x = PAD;
  for (let i = total - 1; i >= 0; i--) {
    ctx.fillStyle = i === index ? C.navy : C.line;
    const w = i === index ? 34 : 14;
    rr(ctx, x, y - 7, w, 14, 7);
    ctx.fill();
    x += w + 12;
  }
}

/* ── שקף הסיום ────────────────────────────────────────────────────────── */

function intro(ctx: Ctx, fonts: Fonts, text: string, y: number, dry: boolean): number {
  const textW = WIDTH - 80 - 150;
  ctx.font = f(fonts, 600, 31);
  const lines = wrap(ctx, text, textW);
  const h = 26 + 46 + lines.length * 43 + 26;
  if (dry) return h;
  shadow(ctx, "rgba(11,37,69,0.08)", 34, 12);
  ctx.fillStyle = C.white;
  rr(ctx, PAD, y, WIDTH, h, 30);
  ctx.fill();
  noShadow(ctx);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  rr(ctx, PAD, y, WIDTH, h, 30);
  ctx.stroke();
  ctx.fillStyle = C.navy;
  ctx.font = f(fonts, 900, 38);
  textR(ctx, "אהלן לכולם 👋", RIGHT - 40, y + 64);
  ctx.font = f(fonts, 600, 31);
  lines.forEach((ln, i) => textR(ctx, ln, RIGHT - 40, y + 112 + i * 43));

  // "שירות אישי ומקצועי" בכתב יד
  ctx.save();
  ctx.translate(PAD + 100, y + h / 2);
  ctx.rotate((-10 * Math.PI) / 180);
  ctx.fillStyle = C.blue;
  ctx.font = `700 48px ${fonts.script}`;
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ["שירות", "אישי", "ומקצועי"].forEach((w, i) => ctx.fillText(w, 0, -34 + i * 44));
  ctx.restore();
  return h;
}

function contact(ctx: Ctx, fonts: Fonts, y: number): number {
  const h = 214;
  const whoW = 330;
  ctx.save();
  shadow(ctx, "rgba(21,89,184,0.28)", 40, 20);
  ctx.fillStyle = C.white;
  rr(ctx, PAD, y, WIDTH, h, 32);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, PAD, y, WIDTH, h, 32);
  ctx.clip();
  const g = ctx.createLinearGradient(PAD, y, PAD + WIDTH - whoW, y + h);
  g.addColorStop(0, C.blueLight);
  g.addColorStop(1, C.blue2);
  ctx.fillStyle = g;
  ctx.fillRect(PAD, y, WIDTH - whoW, h);
  ctx.restore();

  const wr = RIGHT - 30;
  ctx.fillStyle = C.ink2;
  ctx.font = f(fonts, 700, 24);
  textR(ctx, "דברו איתי ישירות", wr, y + 62);
  ctx.fillStyle = C.navy;
  ctx.font = f(fonts, 900, 54);
  textR(ctx, BRAND.name, wr, y + 124);
  ctx.fillStyle = C.blue;
  ctx.font = f(fonts, 700, 26);
  textR(ctx, BRAND.title, wr, y + 164);

  const cr = RIGHT - whoW - 30;
  ctx.fillStyle = C.white;
  ctx.font = f(fonts, 800, 24);
  textR(ctx, "👍 הייעוץ ללא עלות — שלחו לי צילום של החשבון", cr, y + 50);
  ctx.font = f(fonts, 900, 70);
  ctx.direction = "ltr";
  ctx.textAlign = "right";
  ctx.fillText(BRAND.phone, cr, y + 128);
  ctx.font = f(fonts, 800, 25);
  const ww = ctx.measureText("גם בוואטסאפ").width + 36;
  ctx.fillStyle = C.green;
  rr(ctx, cr - ww, y + 150, ww, 44, 22);
  ctx.fill();
  ctx.fillStyle = C.white;
  textR(ctx, "גם בוואטסאפ", cr - 18, y + 181);
  ctx.font = f(fonts, 700, 26);
  ctx.direction = "ltr";
  ctx.textAlign = "right";
  ctx.fillText(BRAND.handle, cr - ww - 22, y + 182);
  return h;
}

function logos(ctx: Ctx, fonts: Fonts, imgs: LogoImages) {
  const top = H - 250;
  ctx.fillStyle = C.white;
  ctx.fillRect(0, top, W, 250);
  ctx.fillStyle = C.line;
  ctx.fillRect(0, top, W, 2);
  ctx.fillStyle = C.ink2;
  ctx.font = f(fonts, 800, 24);
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillText("עובד עם כל החברות המובילות — סלולר, אינטרנט, טלוויזיה וחשמל", W / 2, top + 40);

  const gap = 9;
  const tw = (W - 60 - gap * 7) / 8;
  const th = 84;
  LOGOS.forEach((name, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    // RTL: האריח הראשון מימין
    const x = W - 30 - tw - col * (tw + gap);
    const y = top + 58 + row * (th + gap);
    ctx.fillStyle = "#F5FAFE";
    rr(ctx, x, y, tw, th, 16);
    ctx.fill();
    ctx.strokeStyle = "#E3EFF8";
    ctx.lineWidth = 2;
    rr(ctx, x, y, tw, th, 16);
    ctx.stroke();

    const drawImg = (img: HTMLImageElement | undefined, maxH: number, cy: number) => {
      if (!img) return;
      const scale = Math.min((tw - 16) / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(img, x + (tw - w) / 2, cy - h / 2, w, h);
      ctx.restore();
    };
    if (name === null) {
      ctx.fillStyle = C.blue2;
      ctx.textAlign = "center";
      ctx.font = f(fonts, 900, 24);
      ctx.fillText("ועוד", x + tw / 2, y + 38);
      ctx.font = f(fonts, 700, 17);
      ctx.fillText("חברות נוספות", x + tw / 2, y + 62);
    } else if (name === "cellcom-energy") {
      drawImg(imgs["cellcom.png"], 38, y + 32);
      ctx.fillStyle = "#6B2C91";
      ctx.textAlign = "center";
      ctx.font = f(fonts, 700, 17);
      ctx.fillText("Energy", x + tw / 2, y + 70);
    } else {
      const big = name === "hot.png" || name === "bezeq.svg" || name === "hotenergy.png";
      drawImg(imgs[name], big ? 70 : 58, y + th / 2);
    }
  });
}

/* ── השקף ─────────────────────────────────────────────────────────────── */

/**
 * מצייר שקף. מחזיר `false` אם התוכן לא נכנס (גם אחרי הקטנת הכותרת),
 * כדי שהמסך יבקש לקצר.
 */
export function drawSlide(
  canvas: HTMLCanvasElement,
  slide: Slide,
  index: number,
  total: number,
  fonts: Fonts,
  imgs: LogoImages,
): boolean {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  background(ctx);
  const head = brand(ctx, fonts);
  let fits = true;

  if (slide.kind === "hook") {
    const artTop = H - 150 - 440;
    let y = head + 64;
    let size = 84;
    const measure = () =>
      (slide.kicker ? 58 : 0) +
      title(ctx, fonts, slide.title, 0, size, WIDTH, true) +
      (slide.sub ? 24 + para(ctx, fonts, slide.sub, 0, { size: 34, weight: 600, color: C.navy, width: WIDTH }, true) : 0);
    while (size > 60 && y + measure() > artTop + 40) size -= 6;
    fits = y + measure() <= artTop + 120;
    if (slide.kicker) {
      ctx.font = f(fonts, 800, 38);
      ctx.fillStyle = C.ink2;
      textR(ctx, slide.kicker, RIGHT, y + 38);
      y += 58;
    }
    y += title(ctx, fonts, slide.title, y, size, WIDTH, false);
    if (slide.sub) {
      y += 24;
      para(ctx, fonts, slide.sub, y, { size: 34, weight: 600, color: C.navy, width: WIDTH, underline: slide.underline }, false);
    }
    art(ctx, 70, artTop);
    doodles(ctx, 330, artTop + 110, 420, H - 260);
    footer(ctx, fonts, index, total);
  } else if (slide.kind === "card") {
    const limit = H - 120 - 92 - 24;
    let size = 66;
    const restH = () =>
      (slide.sub ? 18 + para(ctx, fonts, slide.sub, 0, { size: 34, weight: 600, color: C.navy, width: WIDTH }, true) : 0) +
      64 + card(ctx, fonts, slide, 0, true) +
      (slide.imp ? 30 + imp(ctx, fonts, slide.imp, 0, true) : 0) +
      (slide.note ? 22 + 70 : 0);
    const titleText = slide.number ? { ...slide.title, text: `${slide.number} ${slide.title.text}` } : slide.title;
    while (size > 48 && head + 64 + title(ctx, fonts, titleText, 0, size, WIDTH, true) + restH() > limit) size -= 6;
    let y = head + 64;
    y += title(ctx, fonts, titleText, y, size, WIDTH, false);
    if (slide.sub) {
      y += 18;
      y += para(ctx, fonts, slide.sub, y, { size: 34, weight: 600, color: C.navy, width: WIDTH }, false);
    }
    y += 64;
    y += card(ctx, fonts, slide, y, false);
    if (slide.imp) {
      y += 30;
      y += imp(ctx, fonts, slide.imp, y, false);
    }
    if (slide.note) {
      y += 22;
      y += para(ctx, fonts, slide.note, y, { size: 24, weight: 600, color: C.ink2, width: WIDTH }, false);
    }
    fits = y <= limit + 10;
    strip(ctx, fonts);
    footer(ctx, fonts, index, total);
  } else {
    let y = head + 46;
    y += title(ctx, fonts, slide.title, y, 66, WIDTH, false);
    y += 40;
    y += intro(ctx, fonts, slide.intro, y, false);
    y += 34;
    y += contact(ctx, fonts, y);
    ctx.font = f(fonts, 700, 28);
    const a = "השוואת מחירים של כל החברות: ";
    const b = "הקישור בביו";
    const wa = ctx.measureText(a).width;
    const wb = ctx.measureText(b).width;
    const sx = W / 2 + (wa + wb) / 2;
    ctx.fillStyle = C.ink2;
    textR(ctx, a, sx, y + 56);
    ctx.fillStyle = C.blue;
    textR(ctx, b, sx - wa, y + 56);
    fits = y + 70 <= H - 250;
    logos(ctx, fonts, imgs);
  }
  return fits;
}
