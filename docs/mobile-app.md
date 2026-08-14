# האפליקציה לנייד — אנדרואיד

המערכת ארוזה כאפליקציה נייטיבית באמצעות **Capacitor**. האפליקציה אינה
מכילה את קוד המערכת — היא טוענת אותו מהשרת.

המשמעות המעשית: **כל תיקון שנפרס ל-Vercel מגיע לכל הטלפונים מיד**, בלי
בנייה מחדש, בלי העלאה לחנות ובלי שהעובדים יעדכנו. האפליקציה בחנות
נשארת יציבה ומתעדכנת רק כשמשנים משהו במעטפת עצמה (אייקון, הרשאות,
כתובת השרת).

המחיר: בלי אינטרנט אין עבודה. זהה למצב היום באתר.

---

## מצב נוכחי

| רכיב | מצב |
|---|---|
| פרויקט Capacitor (`capacitor.config.ts`, `android/`) | ✅ קיים |
| אייקון מותג בכל הצפיפויות + adaptive icon | ✅ נוצר |
| APK לבדיקה (חתימת debug) | ✅ נבנה |
| דף מדיניות פרטיות ציבורי (`/privacy`) | ✅ קיים |
| הגדרת חתימת release ב-`build.gradle` | ✅ מוכנה, מחכה למפתח |
| מפתח חתימה קבוע | ⏳ **צריך ליצור** |
| `assetlinks.json` | ⏳ תלוי במפתח |
| חשבון Google Play | ⏳ **דורש 25$** |

---

## סביבת הבנייה במחשב הזה

```
JDK 21       C:\Users\ad\dev-tools\jdk-21.0.12+8
Android SDK  C:\Users\ad\dev-tools\android-sdk
```

⚠️ **הבנייה חייבת לרוץ מ-`C:\onestop-build` ולא מנתיב הפרויקט האמיתי.**

הנתיב האמיתי מכיל עברית (`עיצוב קנבה`), ושרשרת `gradlew.bat` → Java
מסרסת אותו ל-`?????` ונכשלת עם `Unable to access jarfile`. `C:\onestop-build`
הוא קישור תיקייה (junction) לאותם קבצים בדיוק — אותו פרויקט, נתיב באנגלית.

אם הקישור נמחק, יוצרים אותו מחדש ב-PowerShell:

```powershell
New-Item -ItemType Junction -Path "C:\onestop-build" -Target "C:\Users\ad\Desktop\עיצוב קנבה\onestop-crm"
```

### בניית APK לבדיקה

```powershell
$env:JAVA_HOME = "C:\Users\ad\dev-tools\jdk-21.0.12+8"; $env:ANDROID_HOME = "C:\Users\ad\dev-tools\android-sdk"; Set-Location "C:\onestop-build\android"; .\gradlew.bat assembleDebug --no-daemon
```

הקובץ נוצר ב-`android\app\build\outputs\apk\debug\app-debug.apk`.

---

## שלב 1 — יצירת מפתח החתימה ⏳ אתה

> ⚠️ **זה השלב הכי מסוכן בכל התהליך, ואי אפשר לתקן אותו בדיעבד.**
>
> גוגל מזהה אפליקציה לפי החתימה שלה. מי שמאבד את המפתח **לא יכול יותר
> לפרסם עדכון** לאפליקציה שכבר בחנות — לעולם. הפתרון היחיד הוא לפרסם
> אפליקציה חדשה עם מזהה חבילה אחר ולבקש מכולם להתקין מחדש.
>
> גבה את קובץ המפתח ואת הסיסמאות **מחוץ למחשב הזה** — מנהל סיסמאות,
> כספת, או דיסק חיצוני. לא בגיט: `.gitignore` כבר חוסם את זה.

הפקודה יוצרת מפתח בתוקף 27 שנה (Google Play דורש תוקף עד 2033 לפחות):

```powershell
& "C:\Users\ad\dev-tools\jdk-21.0.12+8\bin\keytool.exe" -genkeypair -v -keystore "C:\onestop-build\android\onestop-release.jks" -alias onestop -keyalg RSA -keysize 4096 -validity 10000
```

היא תשאל אותך סיסמה (פעמיים) ואז כמה פרטי זיהוי — שם, ארגון, עיר,
מדינה (`IL`). **בחר סיסמה חזקה ושמור אותה מיד.**

אחר כך צור את הקובץ `C:\onestop-build\android\keystore.properties`:

```properties
storeFile=onestop-release.jks
storePassword=<הסיסמה שבחרת>
keyAlias=onestop
keyPassword=<אותה סיסמה>
```

הקובץ הזה ו-`*.jks` כבר ב-`.gitignore` ולא ייכנסו לגיט.

---

## שלב 2 — בניית AAB לחנות

Google Play מקבל **AAB** ולא APK.

```powershell
$env:JAVA_HOME = "C:\Users\ad\dev-tools\jdk-21.0.12+8"; $env:ANDROID_HOME = "C:\Users\ad\dev-tools\android-sdk"; Set-Location "C:\onestop-build\android"; .\gradlew.bat bundleRelease --no-daemon
```

הקובץ נוצר ב-`android\app\build\outputs\bundle\release\app-release.aab`.

---

## שלב 3 — חשבון Google Play ⏳ אתה · 25$ חד-פעמי

1. היכנס ל-<https://play.google.com/console> עם חשבון גוגל.
2. שלם 25$ (חד-פעמי, לכל החיים).
3. אמת זהות — גוגל דורשת תעודה מזהה. **זה יכול לקחת מספר ימים**, אז
   כדאי להתחיל בזה מוקדם.
4. בחר סוג חשבון: **ארגון** (לא "אישי") אם האפליקציה בשם ONE STOP.
   חשבון ארגוני דורש מספר D-U-N-S, שההנפקה שלו לוקחת עד שבועיים.

---

## שלב 4 — יצירת האפליקציה בקונסולה

**Create app** עם הפרטים:

| שדה | ערך |
|---|---|
| שם | `ONE STOP CRM` |
| שפת ברירת מחדל | עברית (`he-IL`) |
| סוג | אפליקציה |
| חינם/בתשלום | חינם |

### App content — ההצהרות שחוסמות שחרור

גוגל לא תיתן לשחרר לשום ערוץ, כולל Internal Testing, עד שכל אלה מלאים:

- **Privacy policy** — `https://onestop-crm-demo.vercel.app/privacy`
  (הדף קיים ונפתח בלי התחברות — נבדק).
- **Data safety** — הצהר: נאספים דוא״ל ושם לצורך הזדהות; המידע מוצפן
  במעבר; אינו משותף עם צדדים שלישיים; המשתמש יכול לבקש מחיקה.
- **Ads** — אין פרסומות.
- **Target audience** — 18+.
- **Content rating** — מלא את השאלון; אפליקציה עסקית מקבלת דירוג "כולם".
- **Government apps / Financial features** — לא.

### App access — קריטי

האפליקציה מוסתרת מאחורי התחברות, ובודקי גוגל לא יכולים להיכנס.
בסעיף **App access** בחר *"All or some functionality is restricted"*
וספק להם **פרטי כניסה של חשבון בדיקה**.

> צור לשם כך משתמש ייעודי עם הרשאות מינימליות ונתוני דמו — לא חשבון
> אמיתי של עובד, ולא חשבון שרואה לידים של לקוחות אמיתיים.

---

## שלב 5 — Internal Testing

**Testing → Internal testing → Create new release**

1. העלה את `app-release.aab`.
2. גוגל תציע **Play App Signing** — קבל. גוגל תשמור מפתח חתימה משלה
   ותחתום את מה שמגיע למכשירים; המפתח שיצרת הופך למפתח ההעלאה בלבד.
   זו גם רשת ביטחון: אם תאבד את מפתח ההעלאה אפשר לבקש איפוס, מה שלא
   נכון לגבי מפתח החתימה עצמו.
3. צור רשימת בודקים והוסף את כתובות הגוגל של העובדים (עד 100).
4. שחרר. הקישור זמין תוך דקות עד שעות; העובדים מקבלים אותו במייל,
   מצטרפים, ומתקינים **ישירות מחנות Play** — בלי "מקורות לא מוכרים".

Internal Testing אינו עובר בדיקת אישור, ואינו מופיע בחיפוש בחנות.

---

## שלב 6 — assetlinks.json (מסיר את סרגל הכתובת)

רק אחרי שגוגל חתמה על הגרסה הראשונה:

1. ב-Play Console: **Release → Setup → App signing** → העתק את
   **SHA-256 certificate fingerprint**.
2. צור את `public/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "il.co.onestop.crm",
      "sha256_cert_fingerprints": ["<הטביעה מ-Play Console>"]
    }
  }
]
```

3. פרוס. `src/proxy.ts` כבר פוטר את `/.well-known` מכל בדיקות הגישה —
   אנדרואיד מושך את הקובץ מהשרת בלי דפדפן ובלי עוגיות, וכל תשובה
   שאינה 200 גורמת לאפליקציה להיפתח עם סרגל כתובת קבוע למעלה.

---

## נכסים לדף החנות

| נכס | מצב |
|---|---|
| אייקון 512×512 | ✅ `build-assets/play-icon-512.png` |
| Feature graphic 1024×500 | ⏳ צריך לעצב |
| צילומי מסך (2 לפחות) | ⏳ ראה אזהרה למטה |
| תיאור קצר (80 תווים) | `ניהול לידים, חבילות ועסקאות — למשתמשי ONE STOP` |

> ⚠️ **אל תעלה צילומי מסך עם נתוני לקוחות אמיתיים.** דף החנות נגיש
> לגוגל גם כשההפצה פנימית, וצילום של תור הלידים חושף שמות ומספרי טלפון
> של אנשים אמיתיים. צלם מחשבון הדמו, או טשטש.

---

## עדכון גרסה

לפני כל העלאה חדשה לחנות, הגדל ב-`android/app/build.gradle`:

```gradle
versionCode 2          // חייב לגדול בכל העלאה — גוגל דוחה ערך חוזר
versionName "1.1"      // מה שהמשתמש רואה
```

זכור: זה נדרש רק לשינויים **במעטפת**. שינוי במערכת עצמה מגיע דרך פריסת
Vercel ולא דורש גרסה חדשה.

---

## כשיגיע הדומיין האמיתי

1. חבר אותו ב-Vercel.
2. עדכן ב-`capacitor.config.ts` את `server.url` ואת `allowNavigation`.
3. העבר את `assetlinks.json` לדומיין החדש.
4. הגדל `versionCode`, בנה AAB חדש והעלה.

⚠️ הכתובת צרובה ב-AAB. עד שתעלה גרסה חדשה, מכשירים מותקנים ימשיכו
לפנות לכתובת הישנה.
