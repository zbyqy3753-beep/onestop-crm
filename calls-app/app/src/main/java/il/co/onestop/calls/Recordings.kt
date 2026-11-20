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
    private val PREFIXES = listOf("Call recording ", "הקלטת שיחה ", "Recording ")
    private val PARTY_AND_DATE = Regex("""^(.*?)[_ ]\d{6,8}[_ ]?\d{4,6}$""")
    private val PHONE_LIKE = Regex("""^[+\d][\d\s\-]{5,}$""")

    /** הצד השני של השיחה, כפי שמופיע בשם הקובץ. */
    fun partyOf(fileName: String): String {
        var base = fileName.substringBeforeLast('.')
        PREFIXES.firstOrNull { base.startsWith(it) }?.let { base = base.removePrefix(it) }
        return PARTY_AND_DATE.find(base)?.groupValues?.get(1)?.trim() ?: base.trim()
    }

    /** מספר טלפון בספרות בלבד, או null כשהצד השני מופיע בשם (כלומר איש קשר). */
    fun phoneOf(party: String): String? =
        if (PHONE_LIKE.matches(party)) party.filter { it.isDigit() || it == '+' } else null

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
