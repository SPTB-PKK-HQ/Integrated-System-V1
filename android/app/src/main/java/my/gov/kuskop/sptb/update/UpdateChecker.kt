package my.gov.kuskop.sptb.update

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import my.gov.kuskop.sptb.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class UpdateChecker {

    private val client = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .callTimeout(6, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    suspend fun fetch(): Result<UpdateManifest> = withContext(Dispatchers.IO) {
        runCatching {
            val url = BuildConfig.UPDATE_MANIFEST_URL + "?t=" + System.currentTimeMillis()
            val request = Request.Builder()
                .url(url)
                .header("Cache-Control", "no-cache")
                .header("User-Agent", "SPTB-HQ-Android/${BuildConfig.VERSION_NAME}")
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    error("Pelayan kemas kini membalas HTTP ${response.code}")
                }
                val body = response.body?.string() ?: error("Respons kemas kini kosong")
                UpdateManifest.parse(body)
            }
        }
    }
}
