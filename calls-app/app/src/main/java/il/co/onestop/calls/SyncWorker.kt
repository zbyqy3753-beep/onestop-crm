package il.co.onestop.calls

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * הסבב שרץ ברקע כל 15 דקות (המינימום של אנדרואיד) וגם בפתיחת האפליקציה:
 * מעלה הקלטות חדשות, ומתריע על סיכומים שחזרו מהמחשב.
 */
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        if (!Api.configured) return@withContext Result.success()
        val ctx = applicationContext
        val store = Store(ctx)
        var failed = false

        for (rec in Recordings.scan(ctx, store.sinceSec)) {
            if (rec.fileName in store.uploaded) continue
            try {
                Api.upload(ctx, rec)
                store.markUploaded(rec.fileName)
            } catch (e: Exception) {
                store.lastError = "${rec.fileName}: ${e.message}"
                failed = true
            }
        }

        try {
            val list = Api.list()
            store.cachedList = list.toString()
            for (i in 0 until list.length()) {
                val r = list.getJSONObject(i)
                val id = r.getString("id")
                val status = r.optString("status")
                if ((status == "done" || status == "failed") && id !in store.notified) {
                    notify(ctx, id, r.optString("phone"), status == "done")
                    store.markNotified(id)
                }
            }
        } catch (e: Exception) {
            store.lastError = "רענון: ${e.message}"
            failed = true
        }

        store.lastRunMs = System.currentTimeMillis()
        if (failed) Result.retry() else Result.success()
    }

    private fun notify(ctx: Context, id: String, phone: String, ok: Boolean) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "סיכומי שיחות", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(
            ctx, 0, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle(if (ok) "הסיכום מוכן" else "הניתוח נכשל")
            .setContentText(if (ok) "השיחה עם $phone: מה לשפר ומה הצעד הבא" else "השיחה עם $phone")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(ctx).notify(id.hashCode(), n)
    }

    companion object {
        private const val CHANNEL = "calls"
        private const val PERIODIC = "calls-sync"
        private const val NOW = "calls-sync-now"

        private val constraints =
            Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedule(ctx: Context) {
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(constraints).build(),
            )
        }

        fun runNow(ctx: Context) {
            WorkManager.getInstance(ctx).enqueueUniqueWork(
                NOW,
                ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(constraints).build(),
            )
        }
    }
}
