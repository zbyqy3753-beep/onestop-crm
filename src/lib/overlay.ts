"use client";

import { useEffect, type RefObject } from "react";

/**
 * שני עוזרים לשכבות שנפתחות מעל התוכן — מודאל, מגירה ותפריט נפתח.
 */

/**
 * נועל את גלילת העמוד כל עוד השכבה פתוחה.
 *
 * ⚠️ בלי זה נוצרים שני גוללים מוערמים: המודאל גולל בפנים והעמוד ממשיך
 * לגלול מאחוריו. במגע זה בולט במיוחד — החלקה שעברה את סוף המודאל
 * ממשיכה להזיז את הרקע, והמשתמש חוזר למקום אחר לגמרי אחרי הסגירה.
 *
 * ⚠️ הקפיצה של 15px בשולחן — הסתרת פס הגלילה מרחיבה את ה-viewport —
 * **לא** מטופלת כאן אלא ב-`scrollbar-gutter: stable` שב-globals.css.
 * ניסיון לפצות מכאן ב-`padding-inline-end` נכשל ב-RTL: הצד שבו הדפדפן
 * מצייר את פס הגלילה אינו נגזר מ-`direction`, ולכן הריפוד נוחת בצד
 * ההפוך ומזיז את התוכן פעמיים במקום אפס.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previous;
    };
  }, [locked]);
}

/**
 * סוגר `<details>` בלחיצה מחוץ לו.
 *
 * ⚠️ `<details>` **אינו** נסגר ב-Escape ואינו נסגר בלחיצה בחוץ — בשום
 * דפדפן. בעכבר זה מטריד; במגע זה מלכודת: הפאנל הצף נשאר פתוח מעל
 * התוכן, והלחיצה הבאה נבלעת בסגירתו במקום לעשות את מה שהתכוונת.
 *
 * מאזין ל-`pointerdown` ולא ל-`click`, כדי שהסגירה תקרה לפני שהלחיצה
 * מגיעה ליעדה — אחרת היא הייתה נבלעת בדיוק כמו קודם.
 */
export function useDetailsAutoClose(
  ref: RefObject<HTMLDetailsElement | null>,
): void {
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const el = ref.current;
      if (!el?.open) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      el.open = false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && ref.current?.open) ref.current.open = false;
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref]);
}
