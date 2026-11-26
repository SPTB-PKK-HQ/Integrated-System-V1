package my.gov.kuskop.sptb.update

import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import my.gov.kuskop.sptb.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext

class ApkDownloader(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .callTimeout(10, TimeUnit.MINUTES)
        .followRedirects(true)
        .build()

    suspend fun download(
        manifest: UpdateManifest,
        onProgress: (Int?) -> Unit
    ): Result<File> = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "updates").apply { mkdirs() }
        val target = File(dir, "sptb-hq-${manifest.versionName}.apk")
        val temp = File(dir, target.name + ".part")
        val job = coroutineContext[Job]

        try {
            coroutineContext.ensureActive()
            if (target.exists() && target.length() == manifest.apkSizeBytes) {
                val existingHash = HashUtils.sha256(target)
                if (existingHash.equals(manifest.sha256, ignoreCase = true)) {
                    onProgress(100)
                    return@withContext Result.success(target)
                }
                target.delete()
            }

            temp.delete()

            val request = Request.Builder()
                .url(manifest.apkUrl)
                .header("User-Agent", "SPTB-HQ-Android/${BuildConfig.VERSION_NAME}")
                .header("Accept", "application/octet-stream")
                .build()

            val call = client.newCall(request)
            val cancellationHandle = job?.invokeOnCompletion { call.cancel() }
            try {
                call.execute().use { response ->
                    if (!response.isSuccessful) {
                        error("Muat turun gagal (HTTP ${response.code})")
                    }
                    val body = response.body ?: error("Respons muat turun kosong")
                    val total = body.contentLength().takeIf { it > 0 }
                        ?: manifest.apkSizeBytes.takeIf { it > 0 }
                    var downloaded = 0L

                    body.byteStream().use { input ->
                        temp.outputStream().use { output ->
                            val buffer = ByteArray(64 * 1024)
                            while (true) {
                                coroutineContext.ensureActive()
                                val read = input.read(buffer)
                                if (read <= 0) break
                                output.write(buffer, 0, read)
                                downloaded += read
                                if (total != null && total > 0) {
                                    onProgress(((downloaded * 100) / total).toInt().coerceIn(0, 100))
                                } else {
                                    onProgress(null)
                                }
                            }
                        }
                    }

                    if (downloaded <= 0) error("Fail APK kosong")
                    if (manifest.apkSizeBytes > 0 && downloaded != manifest.apkSizeBytes) {
                        error("Saiz APK tidak sepadan (${downloaded} vs ${manifest.apkSizeBytes})")
                    }
                }
            } finally {
                cancellationHandle?.dispose()
            }

            val actualHash = HashUtils.sha256(temp)
            if (!actualHash.equals(manifest.sha256, ignoreCase = true)) {
                error("Semakan SHA-256 gagal. Fail mungkin rosak.")
            }

            if (target.exists()) target.delete()
            if (!temp.renameTo(target)) {
                temp.copyTo(target, overwrite = true)
                temp.delete()
            }

            dir.listFiles()
                ?.filter { it != target && it.name.endsWith(".apk") }
                ?.forEach { it.delete() }

            onProgress(100)
            Result.success(target)
        } catch (e: Exception) {
            temp.delete()
            if (e is CancellationException) throw e
            if (job?.isActive == false) {
                throw CancellationException("Muat turun dibatalkan")
            }
            Result.failure(e)
        }
    }
}
