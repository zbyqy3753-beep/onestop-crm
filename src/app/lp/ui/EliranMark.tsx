/**
 * הלוגו של "אלירן תקשורת": סמל "א" על אריח שטוח, ולצידו שם המותג.
 *
 * ⚠️ אריח שטוח, בלי ברק, בלי צל ובלי "ניצוצות". הסמל הקודם (אריח כחול
 * מבריק עם אייקון Wi-Fi וקווי ניצוץ צהובים, `Desktop\eliran-instagram\logo`)
 * נפסל ע"י המשתמש ב-11.2026 כ"AI slop". הסמל הזה זהה ל-favicon
 * (`public/brand/eliran/icon.png`), ולכן הלשונית בדפדפן והכותרת אומרות
 * אותו דבר.
 *
 * ⚠️ האות היא טקסט ולא תמונה: היא נכתבת בגופן של הדף (Assistant 800),
 * כמו בקובצי ה-PNG שנגזרו ממנה.
 */
export function EliranMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-9 rounded-[9px] text-2xl" : "size-11 rounded-[10px] text-[1.75rem]";
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center bg-lp-brand-bright font-extrabold text-white ${box}`}>
      <span className="-translate-y-[2px] leading-none">א</span>
    </span>
  );
}
