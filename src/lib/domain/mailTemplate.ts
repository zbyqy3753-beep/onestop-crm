/**
 * העטיפה שכל דיוור יוצא בתוכה.
 *
 * ⚠️ **הטקסט של המשתמש מנוטרל ולא מסומן.** הוא נכתב בשדה טקסט ולא
 * בעורך HTML; תגית שנכנסה בהדבקה מוורד היא תקלה, לא כוונה.
 *
 * ⚠️ **סגנון בתוך התגיות (`style=`) ולא בגיליון.** לקוחות מייל —
 * ובראשם Gmail — מסלקים או מתעלמים מ-`<style>` בראש המסמך. זה נראה
 * כמו קוד מיושן והוא בדיוק ההפך: זה מה שעובד.
 *
 * ⚠️ **גרסת טקסט נקי נשלחת תמיד.** הודעה בלי `text/plain` מקבלת
 * ניקוד ספאם גבוה יותר, וזו התוצאה שלא רואים — הדוח אומר "נשלח".
 */

const INK = "#1f2933";
const MUTED = "#6b7280";
const BRAND = "#c9a227";
const PAPER = "#ffffff";
const BACKDROP = "#f4f2ed";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * טקסט → פסקאות. שורה ריקה מפרידה פסקה, שורה בודדת היא ירידת שורה
 * בתוכה. זה בדיוק מה שמישהו שמקליד בשדה טקסט מצפה שיקרה.
 */
function paragraphs(body: string): string {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:${INK}">` +
        escapeHtml(block).replace(/\n/g, "<br />") +
        `</p>`,
    )
    .join("");
}

export interface RenderedMail {
  html: string;
  text: string;
}

export function renderMail(input: {
  subject: string;
  body: string;
  unsubscribeUrl: string;
}): RenderedMail {
  const url = escapeHtml(input.unsubscribeUrl);

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:${BACKDROP};font-family:Arial,Helvetica,sans-serif" dir="rtl">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse;background:${PAPER};border-top:4px solid ${BRAND};border-radius:8px">
<tr><td style="padding:32px 28px" dir="rtl">
${paragraphs(input.body)}
</td></tr>
<tr><td style="padding:0 28px 28px" dir="rtl">
<hr style="border:0;border-top:1px solid #e5e7eb;margin:0 0 12px" />
<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED}">
קיבלת את ההודעה הזו מ-ONE STOP.
<a href="${url}" style="color:${MUTED}">להסרה מרשימת התפוצה</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `${input.body.trim()}

—
קיבלת את ההודעה הזו מ-ONE STOP.
להסרה מרשימת התפוצה: ${input.unsubscribeUrl}`;

  return { html, text };
}
