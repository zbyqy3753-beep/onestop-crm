"use client";

import { useEffect, type RefObject } from "react";

/**
 * שני עוזרים לשכבות שנפתחות מעל התוכן — מודאל, מגירה ותפריט נפתח.
 */

/**
 * מונה נעילות פתוחות — **חייב להיות ברמת המודול, לא בתוך ה-hook.**
 *
 * ⚠️ הגרסה הקודמת שמרה את `body.style.overflow` הקודם בכל נעילה בנפרד
 * והחזירה אותו בשחרור. עם שתי שכבות פתוחות זה נשבר: `MoreSheet`
 * ו-`Modal` שניהם נועלים, ו-`AppShell` סוגר את `moreOpen` **בזמן
 * רינדור** כשמשתנה הנתיב. סדר ה-cleanup בין תתי-עצים אחים אינו מובטח,
 * ולכן שחרור שרץ אחרי נעילה החזיר `""` על גוף שעדיין אמור להיות נעול —
 * או, בכיוון ההפוך, השאיר את הנעילה תקועה **בלי ששום דבר פתוח**.
 * במקרה השני העמוד פשוט מפסיק להיגלל, ואין שום דרך להתאושש חוץ מרענון.
 *
 * מונה פותר את שניהם: משחררים רק כשהנעילה האחרונה נסגרה.
 */
let lockCount = 0;
let restoreScrollY = 0;

/**
 * נועל את גלילת העמוד כל עוד השכבה פתוחה.
 *
 * ⚠️ בלי זה נוצרים שני גוללים מוערמים: המודאל גולל בפנים והעמוד ממשיך
 * לגלול מאחוריו. במגע זה בולט במיוחד — החלקה שעברה את סוף המודאל
 * ממשיכה להזיז את הרקע, והמשתמש חוזר למקום אחר לגמרי אחרי הסגירה.
 *
 * ⚠️ **`overflow: hidden` לבדו לא עובד ב-iOS.** ספארי בנייד גולל את
 * ה-viewport החזותי ולא את ה-`<body>`, ופשוט מתעלם מהכלל. `overscroll-contain`
 * שעל השכבות עוצר שרשור גלילה כשהגולל הפנימי מגיע לקצה, אבל לא עוצר
 * מגע שמתחיל על חלק לא-נגלל של השכבה — הכותרת, הריפוד או הרקע המעומעם.
 * לכן נועלים ב-`position: fixed` עם היסט שלילי בגובה מיקום הגלילה,
 * ומשחזרים אותו ביציאה. בלי השחזור הדף היה קופץ לראש בכל סגירת מודאל.
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

    // רק הנעילה הראשונה נוגעת בסגנון. השאר רק מגדילות את המונה.
    if (lockCount === 0) {
      restoreScrollY = window.scrollY;
      body.style.position = "fixed";
      body.style.top = `-${restoreScrollY}px`;
      body.style.insetInline = "0";
      body.style.overflow = "hidden";
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount > 0) return;

      body.style.position = "";
      body.style.top = "";
      body.style.insetInline = "";
      body.style.overflow = "";

      /*
       * ⚠️ `instant` ולא ברירת המחדל. אם למשתמש מוגדר
       * `scroll-behavior: smooth` השחזור היה מונפש — כלומר הדף היה
       * גולל לאחור מול העיניים בכל סגירת שכבה.
       */
      window.scrollTo({ top: restoreScrollY, behavior: "instant" });
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
