import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // בוט הוואטסאפ הוא פרויקט npm נפרד עם tsconfig משלו — הוא לא
    // חלק מבניית Next ואסור לו להיכנס אליה
    "bot/**",
    /*
     * פרויקט האנדרואיד של Capacitor. הוא נוצר אוטומטית, ו-
     * `android/app/build/` מכיל בין השאר את `native-bridge.js` של
     * Capacitor — קוד צד שלישי שמייצר 16 אזהרות lint שאין לנו מה
     * לעשות איתן, ושהיו מטביעות אזהרה אמיתית שלנו ברעש.
     */
    "android/**",
  ]),
]);

export default eslintConfig;
