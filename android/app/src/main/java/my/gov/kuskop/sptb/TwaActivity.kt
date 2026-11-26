package my.gov.kuskop.sptb

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.androidbrowserhelper.trusted.LauncherActivity
import com.google.androidbrowserhelper.trusted.TwaLauncher

/**
 * Aktiviti Trusted Web Activity (TWA) yang membuka sistem web rasmi.
 *
 * Chrome dipilih secara eksplisit supaya TWA tidak bergantung kepada browser lalai
 * yang mungkin hanya menyokong Custom Tabs. Jika TWA gagal dibuka dalam 8 saat,
 * pengguna diberi pilihan untuk membuka sistem dalam pelayar biasa.
 */
class TwaActivity : LauncherActivity() {

    private val handler = Handler(Looper.getMainLooper())
    private var isResumed = false
    private var fallbackShown = false

    private val launchCheck = Runnable {
        if (isResumed && !fallbackShown && !isFinishing && !isDestroyed) {
            showBrowserFallback()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handler.postDelayed(launchCheck, LAUNCH_TIMEOUT_MILLIS)
    }

    override fun launchTwa() {
        try {
            super.launchTwa()
        } catch (_: Exception) {
            showBrowserFallback()
        }
    }

    override fun createTwaLauncher(): TwaLauncher {
        val provider = findChromePackage()
        return if (provider != null) {
            TwaLauncher(this, provider)
        } else {
            TwaLauncher(this)
        }
    }

    override fun onResume() {
        super.onResume()
        isResumed = true
    }

    override fun onPause() {
        isResumed = false
        handler.removeCallbacks(launchCheck)
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacks(launchCheck)
        super.onDestroy()
    }

    private fun findChromePackage(): String? {
        val candidates = listOf(
            "com.android.chrome",
            "com.chrome.beta",
            "com.chrome.dev",
            "com.chrome.canary"
        )
        return candidates.firstOrNull { isPackageInstalled(it) }
    }

    private fun isPackageInstalled(packageName: String): Boolean {
        return try {
            packageManager.getPackageInfo(packageName, 0)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun showBrowserFallback() {
        if (fallbackShown || isFinishing || isDestroyed) return
        fallbackShown = true

        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.twa_failed_title)
            .setMessage(R.string.twa_failed_message)
            .setPositiveButton(R.string.open_in_browser) { _, _ -> openInBrowser() }
            .setNegativeButton(R.string.close) { _, _ -> finish() }
            .setCancelable(false)
            .show()
    }

    private fun openInBrowser() {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.WEB_APP_URL))
            findChromePackage()?.let { intent.setPackage(it) }
            startActivity(intent)
            finish()
        } catch (_: Exception) {
            Toast.makeText(this, R.string.no_browser_found, Toast.LENGTH_LONG).show()
        }
    }

    companion object {
        private const val LAUNCH_TIMEOUT_MILLIS = 8_000L
    }
}
