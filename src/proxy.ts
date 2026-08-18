import { NextResponse, type NextRequest } from "next/server";
import {
  GATE_COOKIE,
  GATE_COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/gate";
import { NEXT_PARAM } from "@/lib/returnTo";

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
  /*
   * ⚠️ ה-service worker ועמוד הנפילה חייבים להיות פתוחים לגמרי, לא רק
   * פטורים משער המפתח.
   *
   * `/sw.js` — הדפדפן מושך אותו מחוץ להקשר הדף וגם מרענן אותו ברקע.
   * אם הוא חוזר הפניה או 404 הרישום נכשל בשקט, וכרום לא יציע התקנה
   * לעולם: זו בדיוק הסיבה שלא הופיע כלום עד עכשיו.
   *
   * `/offline.html` — נטען כשאין רשת. אין בו שום נתון, ובדיקת סשן
   * עליו הייתה הופכת אותו לחסר תועלת בדיוק ברגע שהוא נחוץ.
   */
  "/sw.js",
  "/offline.html",
  /*
   * ⚠️ מדיניות הפרטיות חייבת להיות פתוחה **לגמרי**, לא רק פטורה משער
   * המפתח. Google Play דורש כתובת מדיניות פרטיות שנפתחת בלי התחברות
   * ובלי קישור סודי — בודק אנושי או אוטומטי פותח אותה מדפדפן נקי, וכל
   * דבר שאינו 200 חוסם את שחרור האפליקציה לכל ערוץ, גם Internal Testing.
   */
  "/privacy",
  /*
   * ⚠️ עמוד קביעת הסיסמה חייב להיות פתוח לגמרי, ומאותה משפחה של
   * סיבות: העובד מגיע אליו **דווקא** כשאין לו דרך להיכנס — הסיסמה
   * שלו אופסה. שער שדורש עוגייה או סשן היה הופך כל קישור איפוס
   * ל-404, וזה נראה כמו קישור שבור ולא כמו הגדרה חסרה.
   *
   * מה שמגן עליו הוא הטוקן שבכתובת: 256 ביט אקראיים, חד-פעמי, ופג
   * תוך 72 שעות. בלי טוקן תקף העמוד לא מציג טופס בכלל.
   */
  "/set-password",
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
  // מכסה גם את `/icons/*` שהמניפסט מצביע אליו — `startsWith("/icon")`
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
 * `start_url` של האפליקציה המותקנת.
 *
 * ⚠️ הוא פטור **משער המפתח בלבד, ולא מהסשן** — ולכן הוא ברשימה נפרדת
 * מ-`GATE_EXEMPT`, שנתיביה מדלגים על שתי הבדיקות. הפעלה ממסך הבית
 * חייבת לנחות על מסך התחברות ולא על 404, אבל היא בהחלט חייבת להתחבר.
 *
 * זה לא מדליף כלום: מי שמגיע בלי מפתח מקבל בדיוק את אותה הפניה
 * ל-`/login` שהוא היה מקבל מהנתיב `/login` עצמו, שפטור ממילא.
 */
const START_URL = "/leads";

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
  const gateExempt =
    GATE_EXEMPT.some((p) => pathname.startsWith(p)) ||
    pathname === START_URL;

  if (!gateOpen && !gateExempt) {
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

  // נכסים ומסך ההתחברות — מדלגים גם על בדיקת הסשן.
  // `START_URL` **לא** נכלל כאן בכוונה; ראה ההערה עליו.
  if (GATE_EXEMPT.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.cookies.get(SESSION_COOKIE)) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    // לאן לחזור אחרי ההתחברות. בלי זה משתמש שנשלח מ-`/leads` נוחת
    // בדשבורד ונאלץ לנווט חזרה — ובטלפון זו הדרך הארוכה.
    if (pathname !== "/") login.searchParams.set(NEXT_PARAM, pathname);
    return NextResponse.redirect(login);
  }

  return withRolledCookies(req, NextResponse.next());
}

/**
 * מאריך את תוקף העוגיות בכל ניווט מסמך — הסשן המתגלגל.
 *
 * ⚠️ **רק לניווטי מסמך.** בלי הבדיקה הזו כל שליפת RSC וכל
 * `router.refresh()` (מסך הלידים מרענן את עצמו כל 60 שניות) היו נושאים
 * `Set-Cookie` מיותר — תעבורת כותרות מתמדת בלי שום תועלת.
 *
 * `sec-fetch-dest` נתמך בכל דפדפן שהאפליקציה רצה בו. דפדפן שלא שולח
 * אותו פשוט לא מקבל חידוש ומתנהג כמו קודם — פג אחרי שבוע.
 */
function withRolledCookies(
  req: NextRequest,
  res: NextResponse,
): NextResponse {
  if (req.headers.get("sec-fetch-dest") !== "document") return res;

  res.cookies.set(
    SESSION_COOKIE,
    req.cookies.get(SESSION_COOKIE)!.value,
    SESSION_COOKIE_OPTIONS,
  );

  /*
   * עוגיית השער נקבעת גם אם לא הייתה קודם — **סשן תקף הוא ראיה חזקה
   * יותר מהמפתח המשותף**, ומי שיש לו אחד ראוי גם לשני.
   *
   * זה מה שמציל את האפליקציה המותקנת: היא נפתחת ב-`/leads` (פטור
   * מהשער), ובלי השורה הזו כל שאר הניווט היה מחזיר 404 עד שהמשתמש
   * היה מוצא את הקישור הסודי מחדש.
   */
  res.cookies.set(GATE_COOKIE, "1", GATE_COOKIE_OPTIONS);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
