import { BRAND, type Block, type Slide, type Tone } from "@/lib/posts/templates";

/**
 * מצייר שקף של "אלירן תקשורת" על קנבס 1080×1350 (4:5, המקסימום שאינסטגרם
 * לא חותך).
 *
 * ⚠️ קנבס ולא צילום של DOM. ספריות "HTML לתמונה" מסתמכות על
 * `foreignObject`, ושם גופני רשת נטענים או לא לפי הדפדפן, ובספארי באייפון,
 * המכשיר שאלירן עובד ממנו, הכותרות יוצאות בגופן מערכת. בקנבס הגופן
 * נטען פעם אחת דרך `document.fonts` ומשמש ישירות.
 */

export const W = 1080;
export const H = 1350;
const PAD = 96;
const TOP = 104;
const BOTTOM = 150;

const C = {
  navy: "#0B2545",
  ink2: "#3D5A80",
  blue: "#1E6FD9",
  blue2: "#1559B8",
  blueLight: "#2A86F0",
  yellow: "#FFD84D",
  green: "#22A45D",
  red: "#E0393E",
  line: "#CFE4F3",
  white: "#FFFFFF",
};

const TONE: Record<Tone, string> = { navy: C.navy, blue: C.blue, red: C.red, green: C.green };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** שבירת שורות לפי רוחב. מילה בודדת שארוכה מהשורה נשארת שלמה. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
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

interface Ctx {
  ctx: CanvasRenderingContext2D;
  font: string;
  s: number; // מקדם הקטנה, כשהתוכן לא נכנס
  right: number;
  width: number;
}

const font = (c: Ctx, weight: number, size: number) => `${weight} ${Math.round(size * c.s)}px ${c.font}`;

/** מצייר בלוק ומחזיר את הגובה שתפס. `dry` מודד בלי לצייר. */
function block(c: Ctx, b: Block, y: number, dry: boolean): number {
  const { ctx, right, width, s } = c;
  ctx.direction = "rtl";
  ctx.textBaseline = "alphabetic";

  switch (b.t) {
    case "title": {
      const size = 78 * s;
      const lh = size * 1.16;
      ctx.font = font(c, 900, 78);
      const lines = wrap(ctx, b.text, width);
      if (!dry) {
        lines.forEach((ln, i) => {
          const base = y + lh * i + size * 0.92;
          const at = b.mark ? ln.indexOf(b.mark) : -1;
          if (at >= 0) {
            const before = ctx.measureText(ln.slice(0, at)).width;
            const mw = ctx.measureText(b.mark!).width;
            ctx.save();
            ctx.translate(right - before - mw / 2, base - size * 0.32);
            ctx.rotate((-1 * Math.PI) / 180);
            ctx.fillStyle = C.yellow;
            roundRect(ctx, -mw / 2 - 12, -size * 0.5, mw + 24, size * 0.86, 14);
            ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = C.navy;
          ctx.textAlign = "right";
          ctx.fillText(ln, right, base);
        });
      }
      return lh * lines.length + 22 * s;
    }
    case "big": {
      const size = 168 * s;
      ctx.font = font(c, 900, 168);
      if (!dry) {
        ctx.fillStyle = TONE[b.tone];
        ctx.textAlign = "right";
        ctx.fillText(b.text, right, y + size * 0.9);
      }
      return size * 1.06 + 26 * s;
    }
    case "body":
    case "note": {
      const size = (b.t === "note" ? 27 : 42) * s;
      const lh = size * 1.45;
      ctx.font = font(c, b.t === "body" && b.strong ? 700 : 500, b.t === "note" ? 27 : 42);
      const lines = wrap(ctx, b.text, width);
      if (!dry) {
        ctx.fillStyle = b.t === "body" && b.strong ? C.navy : C.ink2;
        ctx.textAlign = "right";
        lines.forEach((ln, i) => ctx.fillText(ln, right, y + lh * i + size));
      }
      return lh * lines.length + 26 * s;
    }
    case "rows": {
      const rowH = (b.rows.some((r) => r.sub) ? 132 : 104) * s;
      const padY = 18 * s;
      const h = rowH * b.rows.length + padY * 2;
      if (!dry) {
        ctx.save();
        ctx.shadowColor = "rgba(11,37,69,0.08)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = C.white;
        roundRect(ctx, PAD, y, width, h, 30);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 2;
        roundRect(ctx, PAD, y, width, h, 30);
        ctx.stroke();
        b.rows.forEach((r, i) => {
          const top = y + padY + rowH * i;
          const mid = top + rowH / 2;
          if (i > 0) {
            ctx.strokeStyle = C.line;
            ctx.beginPath();
            ctx.moveTo(PAD + 44, top);
            ctx.lineTo(PAD + width - 44, top);
            ctx.stroke();
          }
          ctx.textAlign = "right";
          ctx.fillStyle = C.navy;
          ctx.font = font(c, 800, 40);
          ctx.fillText(r.label, right - 44, r.sub ? mid - 6 * s : mid + 14 * s);
          if (r.sub) {
            ctx.fillStyle = C.ink2;
            ctx.font = font(c, 500, 28);
            const sub = wrap(ctx, r.sub, width * 0.5)[0];
            ctx.fillText(sub, right - 44, mid + 36 * s);
          }
          ctx.textAlign = "left";
          ctx.font = font(c, 800, 40);
          ctx.fillStyle = r.tone ? TONE[r.tone] : C.navy;
          ctx.fillText(r.value, PAD + 44, mid + 14 * s);
        });
      }
      return h + 30 * s;
    }
    case "checks": {
      const size = 44 * s;
      const lh = size * 1.3;
      const dot = 72 * s;
      ctx.font = font(c, 700, 44);
      let h = 0;
      for (const item of b.items) {
        const lines = wrap(ctx, item, width - dot - 30 * s);
        const itemH = Math.max(dot, lh * lines.length);
        if (!dry) {
          const top = y + h;
          ctx.fillStyle = C.green;
          ctx.beginPath();
          ctx.arc(right - dot / 2, top + dot / 2, dot / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = C.white;
          ctx.lineWidth = 7 * s;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(right - dot * 0.72, top + dot * 0.52);
          ctx.lineTo(right - dot * 0.55, top + dot * 0.68);
          ctx.lineTo(right - dot * 0.28, top + dot * 0.36);
          ctx.stroke();
          ctx.fillStyle = C.navy;
          ctx.textAlign = "right";
          ctx.font = font(c, 700, 44);
          const textTop = top + (itemH - lh * lines.length) / 2;
          lines.forEach((ln, i) => ctx.fillText(ln, right - dot - 30 * s, textTop + lh * i + size));
        }
        h += itemH + 30 * s;
      }
      return h + 10 * s;
    }
    case "cta": {
      // מוצמד לתחתית — ראה `drawSlide`. כאן רק מודדים ומציירים במקום שקיבלנו.
      const phoneH = 84 * s;
      ctx.font = font(c, 500, 36);
      const bodyLines = wrap(ctx, b.body, width - 96);
      const cardH = (60 + 60 + bodyLines.length * 52) * s;
      if (!dry) {
        ctx.textAlign = "right";
        ctx.fillStyle = C.green;
        ctx.font = font(c, 900, 64);
        ctx.direction = "ltr";
        ctx.textAlign = "right";
        ctx.fillText(BRAND.phone, right, y + 64 * s);
        const pw = ctx.measureText(BRAND.phone).width;
        ctx.font = font(c, 800, 36);
        ctx.fillText("WhatsApp", right - pw - 24, y + 62 * s);
        ctx.direction = "rtl";

        const top = y + phoneH + 20 * s;
        const g = ctx.createLinearGradient(PAD, top, PAD + width, top + cardH);
        g.addColorStop(0, C.blueLight);
        g.addColorStop(1, C.blue2);
        ctx.fillStyle = g;
        roundRect(ctx, PAD, top, width, cardH, 30);
        ctx.fill();
        ctx.fillStyle = C.white;
        ctx.font = font(c, 800, 48);
        ctx.fillText(b.headline, right - 48, top + 84 * s);
        ctx.font = font(c, 500, 36);
        bodyLines.forEach((ln, i) => ctx.fillText(ln, right - 48, top + (140 + 52 * i) * s));
      }
      return phoneH + 20 * s + cardH;
    }
  }
}

function background(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#F7FBFF");
  g.addColorStop(0.5, "#EEF7FD");
  g.addColorStop(1, "#E3F1FC");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#D3EAFA";
  ctx.beginPath();
  ctx.arc(100, 100, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#DDF0FB";
  ctx.beginPath();
  ctx.arc(990, 1300, 190, 0, Math.PI * 2);
  ctx.fill();
}

function tag(c: Ctx, text: string, y: number): number {
  const { ctx, right, s } = c;
  ctx.font = font(c, 700, 34);
  ctx.direction = "rtl";
  const w = ctx.measureText(text).width + 60;
  const h = 66 * s;
  ctx.fillStyle = C.blue;
  roundRect(ctx, right - w, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.textAlign = "right";
  ctx.fillText(text, right - 30, y + h * 0.68);
  return h + 54 * s;
}

function footer(ctx: CanvasRenderingContext2D, fam: string, index: number, total: number) {
  const y = H - 70;
  ctx.direction = "rtl";
  ctx.font = `700 30px ${fam}`;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "right";
  ctx.fillText(`${BRAND.handle} · ${BRAND.name}, ${BRAND.title}`, W - PAD, y + 10);
  // נקודות: הראשונה מימין, כמו כיוון ההחלקה בעברית
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i === index ? C.navy : C.line;
    ctx.beginPath();
    ctx.arc(PAD + 7 + (total - 1 - i) * 26, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (index < total - 1) {
    ctx.fillStyle = C.blue;
    ctx.font = `800 30px ${fam}`;
    ctx.textAlign = "left";
    ctx.fillText("החליקו ←", PAD + total * 26 + 28, y + 10);
  }
}

/**
 * מצייר שקף. אם התוכן לא נכנס בין הכותרת לשורת התחתית, מקטין הכול
 * בהדרגה. מחזיר `false` רק אם גם בהקטנה המקסימלית זה לא נכנס.
 */
export function drawSlide(
  canvas: HTMLCanvasElement,
  slide: Slide,
  index: number,
  total: number,
  fontFamily: string,
): boolean {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const flow = slide.blocks.filter((b) => b.t !== "cta");
  const cta = slide.blocks.find((b) => b.t === "cta");

  for (const s of [1, 0.92, 0.84, 0.76, 0.7]) {
    const c: Ctx = { ctx, font: fontFamily, s, right: W - PAD, width: W - PAD * 2 };
    ctx.font = font(c, 700, 34);
    const tagH = slide.tag ? 66 * s + 54 * s : 0;
    const flowH = flow.reduce((h, b) => h + block(c, b, 0, true), 0);
    const ctaH = cta ? block(c, cta, 0, true) + 30 * s : 0;
    const fits = TOP + tagH + flowH + ctaH <= H - BOTTOM;
    if (!fits && s > 0.7) continue;

    ctx.clearRect(0, 0, W, H);
    background(ctx);
    // שקף קצר לא נדחס למעלה עם חצי תחתון ריק: שליש מהמרווח עובר מעליו
    const spare = cta ? 0 : Math.max(0, H - BOTTOM - TOP - tagH - flowH);
    let y = TOP + spare * 0.3;
    if (slide.tag) y += tag(c, slide.tag, y);
    for (const b of flow) y += block(c, b, y, false);
    if (cta) block(c, cta, H - BOTTOM - (ctaH - 30 * s), false);
    footer(ctx, fontFamily, index, total);
    return fits;
  }
  return false;
}
