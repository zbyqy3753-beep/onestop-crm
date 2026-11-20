package il.co.onestop.calls

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

/** קריאות לשרת ה-CRM. כולן חוסמות: נקראות רק מה-Worker או מ-Thread. */
object Api {
    private const val CHUNK = 3 * 1024 * 1024

    val configured get() = BuildConfig.PHONE_KEY.isNotEmpty()

    private fun open(path: String, method: String): HttpURLConnection =
        (URL(BuildConfig.BASE_URL.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 20_000
            readTimeout = 120_000
            setRequestProperty("Authorization", "Bearer ${BuildConfig.PHONE_KEY}")
        }

    private fun HttpURLConnection.body(): String {
        val code = responseCode
        val stream = if (code in 200..299) inputStream else errorStream
        val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
        if (code !in 200..299) throw RuntimeException("HTTP $code: ${text.take(200)}")
        return text
    }

    /** מעלה הקלטה בחתיכות. ממשיך מאיפה שנעצר אם חלק כבר הגיע. */
    fun upload(context: Context, rec: Recording) {
        val chunkCount = maxOf(1, ((rec.size + CHUNK - 1) / CHUNK).toInt())
        val meta = JSONObject()
            .put("fileName", rec.fileName)
            .put("phone", rec.phone)
            .put("recordedAt", Instant.ofEpochSecond(rec.addedAtSec).toString())
            .put("durationSec", rec.durationSec)
            .put("chunkCount", chunkCount)

        val res = open("/api/calls", "POST").run {
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            outputStream.use { it.write(meta.toString().toByteArray(Charsets.UTF_8)) }
            JSONObject(body())
        }
        if (res.optString("status") != "uploading") return
        val id = res.getString("id")
        val received = res.optJSONArray("received")?.let { a -> (0 until a.length()).map { a.getInt(it) }.toSet() } ?: emptySet()

        context.contentResolver.openInputStream(rec.uri)?.use { input ->
            for (i in 0 until chunkCount) {
                val bytes = readChunk(input)
                if (i in received || bytes.isEmpty()) continue
                open("/api/calls/$id/chunks/$i", "PUT").run {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/octet-stream")
                    setFixedLengthStreamingMode(bytes.size)
                    outputStream.use { it.write(bytes) }
                    body()
                }
            }
        } ?: throw RuntimeException("לא ניתן לפתוח את ${rec.fileName}")
    }

    private fun readChunk(input: InputStream): ByteArray {
        val buf = ByteArray(CHUNK)
        var n = 0
        while (n < CHUNK) {
            val r = input.read(buf, n, CHUNK - n)
            if (r < 0) break
            n += r
        }
        return buf.copyOf(n)
    }

    /** ההקלטות האחרונות עם הסיכום. */
    fun list(): JSONArray = JSONObject(open("/api/calls", "GET").body()).getJSONArray("recordings")
}
