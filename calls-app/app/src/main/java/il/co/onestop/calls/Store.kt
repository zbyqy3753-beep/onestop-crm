package il.co.onestop.calls

import android.content.Context

/** מצב מקומי קטן ב-SharedPreferences. */
class Store(ctx: Context) {
    private val p = ctx.getSharedPreferences("calls", Context.MODE_PRIVATE)

    /**
     * מאיזה רגע לחפש הקלטות. נקבע בהפעלה הראשונה, כדי שההיסטוריה שכבר
     * בטלפון לא תישלח.
     */
    val sinceSec: Long
        get() {
            val v = p.getLong("sinceSec", 0)
            if (v > 0) return v
            val now = System.currentTimeMillis() / 1000
            p.edit().putLong("sinceSec", now).apply()
            return now
        }

    val uploaded: Set<String> get() = p.getStringSet("uploaded", emptySet()) ?: emptySet()
    fun markUploaded(name: String) = p.edit().putStringSet("uploaded", uploaded + name).apply()

    val notified: Set<String> get() = p.getStringSet("notified", emptySet()) ?: emptySet()
    fun markNotified(id: String) = p.edit().putStringSet("notified", notified + id).apply()

    var cachedList: String
        get() = p.getString("list", "[]") ?: "[]"
        set(v) = p.edit().putString("list", v).apply()

    var lastError: String?
        get() = p.getString("lastError", null)
        set(v) = p.edit().putString("lastError", v).apply()

    var lastRunMs: Long
        get() = p.getLong("lastRunMs", 0)
        set(v) = p.edit().putLong("lastRunMs", v).apply()
}
