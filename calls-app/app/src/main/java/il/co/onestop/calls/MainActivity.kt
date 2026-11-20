package il.co.onestop.calls

import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale

/**
 * מסך אחד: מצב, הרשאות, ורשימת השיחות עם הסיכום של כל אחת.
 * בנוי בקוד ולא ב-XML כדי שהאפליקציה תישאר קובץ אחד שקל לקרוא.
 */
class MainActivity : Activity() {

    private val ink = Color.parseColor("#0F172A")
    private val muted = Color.parseColor("#64748B")
    private val brand = Color.parseColor("#1D4ED8")

    private lateinit var list: LinearLayout
    private lateinit var status: TextView
    private lateinit var permButton: Button

    private val needed: Array<String>
        get() = buildList {
            add(android.Manifest.permission.READ_CONTACTS)
            if (Build.VERSION.SDK_INT >= 33) {
                add(android.Manifest.permission.READ_MEDIA_AUDIO)
                add(android.Manifest.permission.POST_NOTIFICATIONS)
            } else {
                add(android.Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }.toTypedArray()

    private fun missing() = needed.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(16), dp(24), dp(16), dp(24))
        }
        root.addView(text("מאמן שיחות", 24f, ink, bold = true))
        root.addView(text(
            "כל שיחה עם מספר שלא שמור באנשי הקשר נשלחת לניתוח. אחרי כמה דקות מגיעה התראה עם סיכום, מה לשפר ומה הצעד הבא.",
            14f, muted,
        ).apply { setPadding(0, dp(4), 0, dp(12)) })

        status = text("", 13f, muted)
        root.addView(status)

        permButton = button("אישור הרשאות") { requestPermissions(needed, 1) }
        root.addView(permButton)
        root.addView(button("בדיקה עכשיו") {
            SyncWorker.runNow(this)
            status.text = "בודק… הרשימה תתעדכן בעוד כמה שניות"
            status.postDelayed({ render() }, 8000)
        })
        root.addView(text(
            "חשוב: בחייגן של סמסונג ⋮ ← הגדרות ← הקלטת שיחות ← הקלטה אוטומטית ← \"שיחות עם מספרים לא שמורים\".",
            12f, muted,
        ).apply { setPadding(0, dp(8), 0, dp(16)) })

        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(list)

        setContentView(ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#F8FAFC"))
            addView(root)
        })

        Store(this).sinceSec // קובע את נקודת ההתחלה כבר בפתיחה הראשונה
        SyncWorker.schedule(this)
    }

    override fun onResume() {
        super.onResume()
        if (missing().isEmpty()) SyncWorker.runNow(this)
        render()
    }

    override fun onRequestPermissionsResult(code: Int, perms: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, perms, results)
        if (missing().isEmpty()) SyncWorker.runNow(this)
        render()
    }

    private fun render() {
        val store = Store(this)
        val miss = missing()
        permButton.visibility = if (miss.isEmpty()) View.GONE else View.VISIBLE

        status.text = when {
            !Api.configured -> "⚠️ חסר מפתח שרת בגרסה הזו"
            miss.isNotEmpty() -> "⚠️ צריך לאשר הרשאות כדי שהאפליקציה תמצא את ההקלטות"
            else -> buildString {
                append("פעיל. ")
                if (store.lastRunMs > 0) append("בדיקה אחרונה: ${time(store.lastRunMs)}")
                store.lastError?.let { append("\nשגיאה אחרונה: $it") }
            }
        }

        list.removeAllViews()
        val items = JSONArray(store.cachedList)
        if (items.length() == 0) {
            list.addView(text("עוד אין שיחות. השיחה הבאה עם מספר לא שמור תופיע כאן.", 14f, muted))
            return
        }
        for (i in 0 until items.length()) {
            val r = items.getJSONObject(i)
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(14), dp(12), dp(14), dp(12))
                background = GradientDrawable().apply {
                    setColor(Color.WHITE)
                    cornerRadius = dp(12).toFloat()
                    setStroke(dp(1), Color.parseColor("#E2E8F0"))
                }
                layoutParams = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) }
            }
            val recorded = runCatching { Instant.parse(r.getString("recordedAt")).toEpochMilli() }.getOrDefault(0L)
            card.addView(text("${r.optString("phone")} · ${time(recorded)}", 15f, ink, bold = true))

            val body = when (r.optString("status")) {
                "done" -> r.optString("analysis")
                "failed" -> "הניתוח נכשל: ${r.optString("error")}"
                "pending" -> "ממתין לתמלול ולניתוח…"
                else -> "בהעלאה…"
            }
            card.addView(text(body, 14f, ink).apply {
                setPadding(0, dp(6), 0, 0)
                setLineSpacing(0f, 1.25f)
                setTextIsSelectable(true)
            })
            list.addView(card)
        }
    }

    private fun time(ms: Long) = SimpleDateFormat("d.M HH:mm", Locale("he")).format(Date(ms))

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun text(s: String, size: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
        text = s
        textSize = size
        setTextColor(color)
        textDirection = View.TEXT_DIRECTION_RTL
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        setTextColor(Color.WHITE)
        isAllCaps = false
        background = GradientDrawable().apply {
            setColor(brand)
            cornerRadius = dp(10).toFloat()
        }
        layoutParams = LinearLayout.LayoutParams(-1, dp(48)).apply { topMargin = dp(8) }
        setOnClickListener { onClick() }
    }
}
