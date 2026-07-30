import { NextResponse, type NextRequest } from "next/server";

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

const GATE_COOKIE = "os_gate";
const SESSION_COOKIE = "os_session";
const KEY_PARAM = "k";
const MAX_AGE = 60 * 60 * 24 * 7;

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

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: MAX_AGE,
  secure: process.env.NODE_ENV === "production",
} as const;

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

  const expected = process.env.ACCESS_KEY;
  // ACCESS_KEY ריק = השער פתוח. מכוון, כדי ש-`npm run dev` מקומי
  // יעבוד בלי הגדרות. בייצור חובה להגדיר אותו.
  const gateOpen = !expected || Boolean(req.cookies.get(GATE_COOKIE));

  if (!gateOpen) {
    const provided = searchParams.get(KEY_PARAM);
    if (!provided || !safeEqual(provided, expected!)) {
      return new NextResponse(null, { status: 404 });
    }

    const clean = req.nextUrl.clone();
    clean.searchParams.delete(KEY_PARAM);
    const res = NextResponse.redirect(clean);
    res.cookies.set(GATE_COOKIE, "1", COOKIE_OPTIONS);
    return res;
  }

  if (pathname === "/login") return NextResponse.next();

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
