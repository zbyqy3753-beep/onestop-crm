# ONE STOP — API לשליחת לידים

**עבור:** ש. רומי
**גרסה:** 1.0 · אוקטובר 2026

ה-API מאפשר לשלוח ליד חדש למערכת ONE STOP. הוא מיועד **ליצירת לידים בלבד**:
אין בו קריאה, עדכון או מחיקה של לידים קיימים.

---

## 1. כתובת

```
POST https://onestop-crm.vercel.app/api/leads
```

## 2. אימות

כל בקשה חייבת לכלול את המפתח האישי שקיבלתם מ-ONE STOP (נשלח בנפרד ממסמך זה).

| כותרת          | ערך                |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |
| `x-api-key`    | המפתח שלכם         |

**אם המערכת שלכם לא יכולה לשלוח כותרות**, אפשר לשים את המפתח בגוף הבקשה,
בשדה `api_key`:

```json
{ "api_key": "<המפתח>", "fullName": "ישראל ישראלי", "phone": "0501234567" }
```

> שמרו על המפתח בסוד ואל תטמיעו אותו בקוד שרץ בדפדפן. הקריאה מיועדת
> **משרת לשרת**. אם המפתח נחשף, פנו אלינו ונחליף אותו.

## 3. גוף הבקשה

```json
{
  "fullName": "ישראל ישראלי",
  "phone": "0501234567",
  "email": "israel@example.com",
  "category": "cellular",
  "packageName": "500GB 5G",
  "providerName": "פלאפון",
  "message": "מעוניין לעבור עד סוף החודש"
}
```

| שדה            | חובה | תיאור                                                                    |
| -------------- | :--: | ------------------------------------------------------------------------ |
| `fullName`     |  ✔   | שם הלקוח (2 תווים לפחות)                                                 |
| `phone`        |  ✔   | טלפון ישראלי. מתקבל בכל פורמט: `050-1234567`, `+972501234567` וכו׳        |
| `email`        |      | אימייל הלקוח                                                             |
| `category`     |      | תחום העניין. ראו טבלה בהמשך                                              |
| `packageName`  |      | שם החבילה שהלקוח מתעניין בה                                              |
| `providerName` |      | הספק **הנוכחי** של הלקוח (לדוגמה: `פלאפון`, `סלקום`, `yes`, `בזק`)       |
| `price`        |      | מחיר שהוצג ללקוח (מספר או טקסט)                                          |
| `message`      |      | הערה חופשית לנציג                                                       |

**ערכי `category`:**

| ערך           | משמעות    |
| ------------- | --------- |
| `cellular`    | סלולר     |
| `internet`    | אינטרנט   |
| `tv`          | טלוויזיה  |
| `triple`      | טריפל     |
| `electricity` | חשמל      |
| `general`     | כללי      |

אפשר לשלוח גם את התווית בעברית (`סלולר`, `אינטרנט` וכו׳).

שדה שאינו מופיע בטבלה לא יידחה. הוא יישמר בהערה של הליד כדי שהמידע לא ילך לאיבוד.

## 4. תשובות

| קוד   | גוף התשובה                            | משמעות                                                  |
| ----- | ------------------------------------- | ------------------------------------------------------- |
| `201` | `{"success":true,"id":"..."}`         | הליד נוצר                                               |
| `200` | `{"success":true,"duplicate":true}`   | מספר הטלפון כבר קיים במערכת. לא נוצר ליד כפול           |
| `400` | `{"success":false,"error":"..."}`     | שדה חובה חסר או ערך לא תקין. הסיבה מפורטת ב-`error`     |
| `401` | `{"success":false,"error":"..."}`     | מפתח חסר או שגוי                                        |
| `413` | `{"success":false,"error":"..."}`     | גוף הבקשה גדול מ-16KB                                   |
| `429` | `{"success":false,"error":"..."}`     | יותר מ-120 בקשות בדקה. נסו שוב אחרי דקה                 |

**ניסיון חוזר בטוח:** אם הבקשה נכשלה ב-timeout או בשגיאת רשת, אפשר לשלוח אותה
שוב. אם הליד כבר נקלט, תתקבל תשובה `duplicate` ולא ייווצר ליד נוסף.
אל תנסו שוב אחרי `400` או `401`, כי אותה בקשה תיכשל שוב.

## 5. בדיקת חיבור

כדי לוודא שהמפתח עובד בלי ליצור ליד:

```
GET https://onestop-crm.vercel.app/api/leads
x-api-key: <המפתח>
```

תשובה תקינה: `{"success":true,"partner":"ש. רומי"}`

## 6. דוגמאות

**curl**

```bash
curl -X POST https://onestop-crm.vercel.app/api/leads \
  -H "Content-Type: application/json" \
  -H "x-api-key: <המפתח>" \
  -d '{"fullName":"ישראל ישראלי","phone":"0501234567","category":"cellular"}'
```

**PHP**

```php
$ch = curl_init('https://onestop-crm.vercel.app/api/leads');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: <המפתח>'],
    CURLOPT_POSTFIELDS => json_encode(
        ['fullName' => 'ישראל ישראלי', 'phone' => '0501234567', 'category' => 'cellular'],
        JSON_UNESCAPED_UNICODE
    ),
]);
$response = json_decode(curl_exec($ch), true);
```

**Node.js**

```js
const res = await fetch("https://onestop-crm.vercel.app/api/leads", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": "<המפתח>" },
  body: JSON.stringify({ fullName: "ישראל ישראלי", phone: "0501234567", category: "cellular" }),
});
const data = await res.json();
```

> שלחו את הגוף בקידוד UTF-8, אחרת שמות בעברית יגיעו כסימני שאלה.

## 7. מה קורה לליד אחרי שהוא נקלט

- הליד נרשם במערכת עם המקור **"ש. רומי"**, בסטטוס "חדש".
- הוא משויך אוטומטית לנציג המטפל, שמקבל התראה על ליד חדש.

## 8. יצירת קשר

שאלות טכניות או החלפת מפתח: ONE STOP.
