/**
 * שדות מיזוג בתבנית הדיוור — `{{שם}}`.
 *
 * ⚠️ **מעבר יחיד על התבנית, בלי הרחבה חוזרת של הערכים.** ערך מגיע
 * מתא בקובץ שמישהו העלה; אילו היה מורחב שוב, תא שמכיל `{{...}}` היה
 * שולף שדה אחר של אותו נמען לתוך הטקסט.
 *
 * ⚠️ **שדה חסר הופך למחרוזת ריקה ולא נשאר כסוגריים.** תבנית שיוצאת
 * ללקוח כמו שהיא נראית כמו תקלה. במקום לתקן בזמן השליחה, המסך סופר
 * מראש כמה שורות ייצאו עם שדה ריק ומציג את זה לפני האישור —
 * `emptyFieldsIn` קיים בשביל הספירה ההיא.
 */

/** `{{שם}}` וגם `{{ שם }}`. השם הוא כל מה שאינו סוגר או סוגריים. */
const FIELD = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** שמות השדות שהתבנית משתמשת בהם, בסדר הופעה ובלי כפילויות. */
export function mergeFieldsIn(template: string): string[] {
  const seen = new Set<string>();
  for (const m of template.matchAll(FIELD)) seen.add(m[1]);
  return [...seen];
}

/** ממזג את הערכים לתוך התבנית. מעבר אחד בלבד. */
export function renderMerge(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(FIELD, (_all, name: string) => {
    const value = values[name];
    return value === undefined ? "" : value.trim();
  });
}

/** השדות שהתבנית דורשת ושאין להם ערך של ממש. */
export function emptyFieldsIn(
  template: string,
  values: Record<string, string>,
): string[] {
  return mergeFieldsIn(template).filter(
    (name) => (values[name] ?? "").trim() === "",
  );
}
