/**
 * ── עובדי מוביסל ─────────────────────────────────────────────────────
 *
 * ⚠️ קובץ שנוצר אוטומטית: `node tools/mobicell/build-workers.mjs <workers.json>`.
 * לא לערוך ידנית — ההרצה הבאה תדרוס.
 *
 * הנציגים של חנויות מוביסל, כפי שהם רשומים ב-CallUp (`crm.onestopil.co`).
 * הם **לא** משתמשי CRM: אין להם התחברות, ולידים לא משויכים אליהם. ל-
 * כל אחד QR אישי (`<סניף>--w<id>`), וליד שמגיע ממנו נכנס לחלוקה הרגילה
 * עם קרדיט לנציג ולסניף.
 *
 * `id` הוא מזהה הנציג ב-CallUp. ⚠️ הוא מודפס על ה-QR, ולכן אסור לשנות אותו.
 * `active: false` = הנציג כבר לא ברשימה של CallUp. הוא נשאר כאן כדי
 * שמדבקה שכבר תלויה תמשיך לתת לו קרדיט, ולא מוצג במסך הסניפים.
 *
 * ⚠️ מודול טהור, בלי ייבוא: משמש גם את מסלול ה-API וגם את המסך.
 */

export type MobicellWorker = {
  id: number;
  /** קוד הסניף ב-`branches.ts`. */
  branch: string;
  name: string;
  active: boolean;
};

export const MOBICELL_WORKERS: readonly MobicellWorker[] = [
  { id: 46, branch: "ashdod", name: "שוהם", active: true },
  { id: 47, branch: "rehovot", name: "אלה שלמה", active: true },
  { id: 48, branch: "rehovot", name: "איתי אלבז", active: true },
  { id: 49, branch: "ashdod", name: "ויקטור", active: true },
  { id: 50, branch: "ashdod", name: "רון", active: true },
  { id: 51, branch: "maxitel", name: "אדם אסולין", active: true },
  { id: 52, branch: "maxitel", name: "ירין", active: true },
  { id: 53, branch: "maxitel", name: "שנאל", active: true },
  { id: 54, branch: "maxitel", name: "שגיא", active: true },
  { id: 55, branch: "maxitel", name: "סתיו סלע", active: true },
  { id: 56, branch: "maxitel", name: "דין הראל", active: true },
  { id: 57, branch: "maxitel", name: "יאיר נפתלי", active: true },
  { id: 58, branch: "maxitel", name: "אלעד שרון", active: true },
  { id: 59, branch: "maxitel", name: "גל מסיקה", active: true },
  { id: 60, branch: "maxitel", name: "אביאל בר", active: true },
  { id: 61, branch: "maxitel", name: "מייקל בריגה", active: true },
  { id: 62, branch: "maxitel", name: "איתן", active: true },
  { id: 63, branch: "maxitel", name: "הארי לוי", active: true },
  { id: 64, branch: "maxitel", name: "אוריאל דוידוב", active: true },
  { id: 65, branch: "cellpower", name: "סתיו", active: true },
  { id: 66, branch: "nazareth", name: "לליאן", active: true },
  { id: 67, branch: "nazareth", name: "אדי", active: true },
  { id: 68, branch: "nazareth", name: "אמיר", active: true },
  { id: 69, branch: "nazareth", name: "טייבה", active: true },
  { id: 70, branch: "rehovot", name: "ענת ולדימירסקי", active: true },
  { id: 71, branch: "cellpower", name: "אוריאל", active: true },
  { id: 72, branch: "cellpower", name: "איתמר", active: true },
  { id: 73, branch: "maxitel", name: "שלמה אסולין", active: true },
  { id: 74, branch: "maxitel", name: "איאן גייסמן", active: true },
  { id: 75, branch: "cinema", name: "עמית בונפיל", active: true },
  { id: 76, branch: "cinema", name: "מיכאל חצקביץ", active: true },
  { id: 77, branch: "cinema", name: "שוהם זרגרוב", active: true },
  { id: 78, branch: "cinema", name: "ינון שרווה", active: true },
  { id: 79, branch: "maxitel", name: "אדיב מארגיה", active: true },
  { id: 81, branch: "rehovot", name: "עמית בונפיל", active: true },
  { id: 82, branch: "cellpower", name: "דין", active: true },
  { id: 83, branch: "malha", name: "אחמד טהבוב", active: true },
  { id: 84, branch: "malha", name: "מוחמד טהבוב", active: true },
  { id: 85, branch: "malha", name: "מוחמד מסוודי", active: true },
  { id: 86, branch: "malha", name: "מחמוד חמד", active: true },
  { id: 87, branch: "malha", name: "מחמוד מעתוק", active: true },
  { id: 88, branch: "ramat-aviv", name: "דור אמין", active: true },
  { id: 89, branch: "ramat-aviv", name: "צחי גלנטי", active: true },
  { id: 90, branch: "zahav", name: "ליאור בגה", active: true },
  { id: 91, branch: "zahav", name: "מאור", active: true },
  { id: 92, branch: "modiin", name: "גילי", active: true },
  { id: 93, branch: "malha", name: "עבד זיתון", active: true },
  { id: 94, branch: "malha", name: "בוסימה רמדאן", active: true },
  { id: 95, branch: "pinchas-rosen", name: "רם", active: true },
  { id: 96, branch: "zahav", name: "רעות דבורה", active: true },
  { id: 97, branch: "zahav", name: "נעמה", active: true },
  { id: 99, branch: "tiberias", name: "גריס", active: true },
  { id: 100, branch: "raanana-ubox", name: "רומן טיישידלר", active: true },
  { id: 101, branch: "simol", name: "אביגיל", active: true },
  { id: 102, branch: "simol", name: "אביגיל", active: true },
  { id: 103, branch: "simol", name: "ליאם", active: true },
  { id: 104, branch: "simol", name: "אפרת", active: true },
  { id: 105, branch: "simol", name: "נעה", active: true },
  { id: 106, branch: "hai", name: "הדסה", active: true },
  { id: 107, branch: "tiberias", name: "אלירן ברקוב", active: true },
  { id: 108, branch: "tiberias", name: "ננסי", active: true },
  { id: 109, branch: "tiberias", name: "סארי", active: true },
  { id: 110, branch: "petah-tikva", name: "ליחי חיים טוסון", active: true },
  { id: 112, branch: "or-akiva", name: "avi choma", active: true },
  { id: 113, branch: "or-akiva", name: "ella Ohayon", active: true },
  { id: 114, branch: "raanana-renanim", name: "אסלאם אבו פרח", active: true },
  { id: 115, branch: "raanana-renanim", name: "דור צמח", active: true },
  { id: 116, branch: "azrieli-tlv", name: "ליאם בן עמי", active: true },
  { id: 117, branch: "rehovot", name: "ינון עזרן", active: true },
  { id: 119, branch: "orel", name: "אדיר בידרמן", active: true },
  { id: 120, branch: "orel", name: "אוראל בני", active: true },
  { id: 122, branch: "cellpower", name: "סתיו סלע", active: true },
  { id: 123, branch: "azrieli-tlv", name: "מטילדה", active: true },
  { id: 124, branch: "hai", name: "נהוראי", active: true },
  { id: 125, branch: "hai", name: "אביב", active: true },
  { id: 128, branch: "kfar-saba", name: "אבי", active: true },
  { id: 129, branch: "kfar-saba", name: "גדי מחטייב", active: true },
  { id: 130, branch: "maxitel", name: "אביעד זרו", active: true },
  { id: 132, branch: "hai", name: "מיכאל", active: true },
  { id: 133, branch: "hai", name: "איתמר", active: true },
  { id: 134, branch: "tlv", name: "ירון", active: true },
  { id: 135, branch: "malha", name: "רומיו זאיד", active: true },
  { id: 136, branch: "bilu", name: "ניל ולדמן", active: true },
  { id: 137, branch: "cinema", name: "מיכאל גרישין", active: true },
  { id: 138, branch: "noam", name: "לינוי אלשיך", active: true },
  { id: 139, branch: "noam", name: "שי מדלסי", active: true },
  { id: 140, branch: "noam", name: "שירז ברוידו", active: true },
  { id: 141, branch: "azrieli-tlv", name: "רובי קצר", active: true },
  { id: 146, branch: "or-akiva", name: "lidor heftzi", active: true },
  { id: 147, branch: "maxitel", name: "אריק ברמן", active: true },
  { id: 148, branch: "pinchas-rosen", name: "גיא ימיני", active: true },
  { id: 149, branch: "maxitel", name: "אלירן שמח", active: true },
  { id: 150, branch: "cellpower", name: "צפריר שורץ", active: true },
  { id: 155, branch: "rehovot", name: "מיכאל", active: true },
  { id: 157, branch: "cinema", name: "עידו עוזרי", active: true },
  { id: 159, branch: "yehud", name: "איציק בן ורון", active: true },
  { id: 160, branch: "migdal-haemek", name: "איציק יעקב", active: true },
  { id: 161, branch: "migdal-haemek", name: "גבריאל יפרח", active: true },
  { id: 164, branch: "maxitel", name: "בן ישכרוב", active: true },
  { id: 165, branch: "maxitel", name: "בן אבשלום", active: true },
  { id: 166, branch: "yehud", name: "טטיאנה בראוז", active: true },
  { id: 168, branch: "noam", name: "ליאם בן דוד", active: true },
  { id: 169, branch: "cellpower", name: "אופיר", active: true },
  { id: 171, branch: "cellpower", name: "תומר ישר", active: true },
  { id: 173, branch: "orel", name: "אבישי דהן", active: true },
  { id: 175, branch: "modiin", name: "רוני", active: true },
  { id: 183, branch: "noam", name: "נועם ברוידו", active: true },
  { id: 184, branch: "simol", name: "שני שושן", active: true },
  { id: 185, branch: "shaarei-tzedek", name: "מוחמד טהבוב", active: true },
  { id: 186, branch: "ashdod", name: "עמיר בדלוב", active: true },
];
