package il.co.onestop.calls

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import android.provider.MediaStore

/** הקלטת שיחה שנמצאה בטלפון ועוברת את הסינון. */
data class Recording(
    val uri: Uri,
    val fileName: String,
    val phone: String,
    val addedAtSec: Long,
    val durationSec: Int,
    val size: Long,
)

object Recordings {

    /*
     * ⚠️ שמות הקבצים של מקליט השיחות של סמסונג משתנים בין גרסאות One UI:
     *   "Call recording 0541234567_241120_143005.m4a"
     *   "Call recording ישראל ישראלי_241120_143005.m4a"
     *   "הקלטת שיחה 0541234567_241120_143005.m4a"
     *   "0541234567_20241120143005.m4a"
     * מה שבין הקידומת לתאריך הוא הצד השני: מספר, או שם כשהוא באנשי הקשר.
     */
    private val PREFIXES = listOf("Call recording ", "הקלטת שיחה ", "שיחה ", "Recording ")
    private val PARTY_AND_DATE = Regex("""^(.*?)[_ ]\d{6,8}[_ ]?\d{4,6}$""")
    private val PHONE_LIKE = Regex("""^[+\d][\d\s\-]{5,}$""")

    /*
     * ⚠️ מספר בסוף הצד השני, אחרי מילה כלשהי. הסמסונג של אלירן קורא לקבצים
     * "שיחה 0587900058_261120_114651.m4a", וקידומת שלא הכרנו גרמה לכל
     * ההקלטות להיראות כמו שם של איש קשר ולהידלג בשקט. שם של איש קשר הוא
     * מילים בלי מספר של 6 ספרות בסופו, ולכן הוא עדיין מזוהה כאיש קשר.
     */
    private val TRAILING_PHONE = Regex("""(?:^|\s)(\+?\d[\d\-]{5,})$""")

    /** הצד השני של השיחה, כפי שמופיע בשם הקובץ. */
    fun partyOf(fileName: String): String {
        /*
         * ⚠️ סמסונג עוטפת את המספר בתווי כיווניות בלתי נראים (LRM ודומיו,
         * קטגוריה Cf), כדי שיוצג נכון בשם קובץ עברי. על המסך רואים
         * "0587900058", אבל ה-regex רואה תו נוסף ולא מזהה מספר. מנקים
         * אותם, וגם רווח קשיח, לפני כל ניתוח.
         */
        var base = fileName.substringBeforeLast('.')
            .replace(Regex("""\p{Cf}"""), "")
            .replace(' ', ' ')
        PREFIXES.firstOrNull { base.startsWith(it) }?.let { base = base.removePrefix(it) }
        return PARTY_AND_DATE.find(base)?.groupValues?.get(1)?.trim() ?: base.trim()
    }

    /** מספר טלפון בספרות בלבד, או null כשהצד השני מופיע בשם (כלומר איש קשר). */
    fun phoneOf(party: String): String? {
        val raw = if (PHONE_LIKE.matches(party)) party
        else TRAILING_PHONE.find(party)?.groupValues?.get(1) ?: return null
        return raw.filter { it.isDigit() || it == '+' }
    }

    fun isContact(context: Context, phone: String): Boolean {
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phone))
        return try {
            context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup._ID), null, null, null)
                ?.use { it.count > 0 } ?: false
        } catch (_: SecurityException) {
            // ⚠️ בלי הרשאת אנשי קשר אי אפשר לדעת, ולכן לא שולחים כלום.
            true
        }
    }

    /**
     * מה האפליקציה רואה ולמה היא מדלגת, להצגה במסך.
     *
     * ⚠️ קיים כי כשהקלטה לא מגיעה לשרת אין שום עקבה בצד השרת: הסיבה
     * (תיקייה אחרת, שם קובץ בפורמט לא מוכר, איש קשר, הקלטה ישנה) נראית
     * רק בטלפון.
     */
    fun diagnose(context: Context, sinceSec: Long): String = try {
        val sb = StringBuilder()
        val uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val proj = arrayOf(
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.RELATIVE_PATH,
            MediaStore.Audio.Media.DATE_ADDED,
        )
        var callCount = 0
        context.contentResolver.query(
            uri, proj, "${MediaStore.Audio.Media.RELATIVE_PATH} LIKE ?", arrayOf("%Call%"),
            "${MediaStore.Audio.Media.DATE_ADDED} DESC",
        )?.use { c ->
            callCount = c.count
            sb.append("הקלטות שיחה בטלפון: ${c.count}\n")
            var n = 0
            while (c.moveToNext() && n < 5) {
                n++
                val name = c.getString(0) ?: ""
                val party = partyOf(name)
                val phone = phoneOf(party)
                val why = when {
                    c.getLong(2) < sinceSec -> "דילוג: לפני ההתקנה"
                    phone == null -> "דילוג: \"$party\" לא מספר (איש קשר?)"
                    isContact(context, phone) -> "דילוג: $phone באנשי הקשר"
                    else -> "נשלחת ($phone)"
                }
                sb.append("• $name\n   ${c.getString(1)} · $why\n")
            }
        }
        if (callCount == 0) {
            sb.append("קבצי שמע אחרונים בטלפון (לאיתור התיקייה):\n")
            context.contentResolver.query(
                uri, proj, null, null, "${MediaStore.Audio.Media.DATE_ADDED} DESC",
            )?.use { c ->
                var n = 0
                while (c.moveToNext() && n < 5) {
                    n++
                    sb.append("• ${c.getString(1)}${c.getString(0)}\n")
                }
                if (c.count == 0) sb.append("אין גישה לקבצי שמע, או שאין כאלה.\n")
            }
        }
        sb.toString().trimEnd()
    } catch (e: Exception) {
        "אבחון נכשל: ${e.message}"
    }

    /**
     * הקלטות שיחה שנוספו מאז [sinceSec], רק עם מספרים שאינם באנשי הקשר.
     *
     * ⚠️ רק מאז ההתקנה ולא כל ההיסטוריה: שיחות ישנות הן של לקוחות שכבר
     * טופלו, ומשלוח של מאות קבצים בבת אחת יחסום את התור במחשב לשעות.
     */
    fun scan(context: Context, sinceSec: Long): List<Recording> {
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.DATE_ADDED,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
        )
        val selection = "${MediaStore.Audio.Media.RELATIVE_PATH} LIKE ? AND ${MediaStore.Audio.Media.DATE_ADDED} >= ?"
        val args = arrayOf("%Call%", sinceSec.toString())
        val out = mutableListOf<Recording>()

        context.contentResolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, projection, selection, args,
            "${MediaStore.Audio.Media.DATE_ADDED} ASC",
        )?.use { c ->
            while (c.moveToNext()) {
                val name = c.getString(1) ?: continue
                val phone = phoneOf(partyOf(name)) ?: continue
                if (isContact(context, phone)) continue
                out += Recording(
                    uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, c.getLong(0)),
                    fileName = name,
                    phone = phone,
                    addedAtSec = c.getLong(2),
                    durationSec = (c.getLong(3) / 1000).toInt(),
                    size = c.getLong(4),
                )
            }
        }
        return out
    }
}
