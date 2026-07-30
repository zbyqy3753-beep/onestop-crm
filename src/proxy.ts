import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_COOKIE_OPTIONS } from "@/lib/gate";

/**
 * שער הגישה לגרסת הבדיקה — שתי שכבות.
 *
 * הקובץ נקרא `proxy.ts` ולא `middleware.ts`: ב-Next.js 16 מוסכמת
 * `middleware` הוצאה משימוש ושמה שונה ל-`proxy`.
 *
 *
 * 1. `os_gate`  — נקבעת ע"י הקישור הסודי (`/?k=<ACCESS_KEY>`).
 *                 בלעדיה כל נתיב מחזיר 404.
 * 2. `os_session` — נקבעת ע"י "כניסת בדיקה" במסך `/login`.
 *                 בלעדיה מפנים ל-`/login`.
 *
 * ⚠️ זו הסתרה, לא אבטחה. מי שקיבל את הקישור יכול להעביר אותו הלאה,
 * והעוגיות אינן חתומות. המודל נבחר במודע לגרסת בדיקה עם בודקים
 * מוכרים — אין להעלות לסביבה הזו נתוני לקוחות אמיתיים.
 *
 * המפתח נמחק מה-URL בהפניה, כדי שלא יישאר בהיסטוריה, ב-referrer
 * או בצילום מסך. 404 (ולא הפניה) כדי לא להסגיר שיש כאן מערכת בכלל.
 */

const SESSION_COOKIE = "os_session";
const KEY_PARAM = "k";

/**
 * נתיבים שנשארים פתוחים לגמרי: הטופס הציבורי, ה-API ונכסי המערכת.
 *
 * `/api` פתוח כי הקוראים שלו הם שרתים של שותפים — אין להם עוגייה
 * ואין להם דפדפן שיעבור בשער. כל נתיב תחת `/api` **חייב** לאמת את
 * עצמו (ראה `src/app/api/leads/route.ts`, שמאמת `x-api-key`).
 */
const PUBLIC_PREFIXES = [
  "/form",
  "/api",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
];

/**
 * נתיבים שעוברים את **שער הגישה** בלי עוגיית `os_gate`, אבל עדיין
 * דורשים סשן לכל השאר. שונה מ-`PUBLIC_PREFIXES`: אלה לא "פתוחים",
 * הם רק לא מוסתרים מאחורי המפתח הסודי.
 *
 * הסיבה היא אייפון: אפליקציה שהותקנה למסך הבית רצה במחיצת אחסון
 * **נפרדת מספארי**, ולכן היא נפתחת בלי `os_gate` ובלי `os_session`.
 * בלי הרשימה הזו היא הייתה מקבלת 404 בהפעלה הראשונה, בלי שום דרך
 * להתאושש מתוך האפליקציה — אייקון מת.
 *
 * המניפסט והאייקונים חייבים להיות כאן גם מסיבה שנייה: הדפדפן מושך
 * אותם בלי לצרף עוגיות אלא אם ה-tag נושא `crossorigin`, ו-Next לא
 * פולט אותו.
 */
const GATE_EXEMPT = [
  "/login",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
  "/apple-touch-icon",
  /*
   * `/.well-known/assetlinks.json` — מה שקושר את אפליקציית האנדרואיד
   * (TWA) לדומיין. אנדרואיד מושך אותו **מהשרת, בלי דפדפן ובלי עוגיות**,
   * ואם הוא לא חוזר 200 האפליקציה נפתחת עם סרגל כתובת קבוע למעלה.
   * הקובץ מכיל טביעת אצבע של מפתח חתימה ציבורי — הוא נועד להיות גלוי.
   */
  "/.well-known",
];

/**
 * השוואה בזמן קבוע. `node:crypto` לא זמין ב-Edge runtime, אז
 * מימוש ידני — הוא זול והמחלקה שהוא מונע היא היחידה שרלוונטית כאן.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const expected = process.env.ACCESS_KEY?.trim();

  /*
   * `ACCESS_KEY` ריק = אין שכבת הסתרה, אבל **הסשן עדיין נדרש**.
   *
   * זו לא אותה משמעות כמו קודם. פעם "שער פתוח" היה מסוכן, כי מאחוריו
   * ישב כפתור "כניסת בדיקה" שנתן גישת owner בלי סיסמה — כלומר משתנה
   * סביבה חסר חשף את המערכת. הכפתור הוסר, ולכן מה שנשאר מאחורי השער
   * הוא מסך התחברות אמיתי מול Supabase, וזו ההגנה בפועל.
   *
   * ⚠️ במפורש **לא** מחזירים 404 כשהמפתח חסר: זה היה הופך את הכתובת
   * הראשית ל"אתר שבור" עבור הבעלים, ושובר את `start_url` של האפליקציה
   * המותקנת — שחייב לנחות על `/login` כדי שאפשר יהיה להתחבר ממנה.
   */
  const gateConfigured = Boolean(expected);
  const gateOpen = !gateConfigured || Boolean(req.cookies.get(GATE_COOKIE));

  if (!gateOpen && !GATE_EXEMPT.some((p) => pathname.startsWith(p))) {
    const provided = searchParams.get(KEY_PARAM);
    if (!provided || !safeEqual(provided, expected!)) {
      return new NextResponse(null, { status: 404 });
    }

    const clean = req.nextUrl.clone();
    clean.searchParams.delete(KEY_PARAM);
    const res = NextResponse.redirect(clean);
    res.cookies.set(GATE_COOKIE, "1", GATE_COOKIE_OPTIONS);
    return res;
  }

  if (pathname === "/login") return NextResponse.next();
  if (GATE_EXEMPT.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.cookies.get(SESSION_COOKIE)) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
