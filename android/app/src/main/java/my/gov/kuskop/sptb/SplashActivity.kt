package my.gov.kuskop.sptb

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.progressindicator.LinearProgressIndicator
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import my.gov.kuskop.sptb.databinding.ActivitySplashBinding
import my.gov.kuskop.sptb.databinding.DialogDownloadBinding
import my.gov.kuskop.sptb.update.ApkInstaller
import my.gov.kuskop.sptb.update.UpdateManifest
import my.gov.kuskop.sptb.update.UpdateUiState
import my.gov.kuskop.sptb.update.UpdateViewModel
import java.util.Locale

class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding
    private val viewModel: UpdateViewModel by viewModels()

    private var updateDialog: AlertDialog? = null
    private var downloadDialog: AlertDialog? = null
    private var errorDialog: AlertDialog? = null
    private var permissionDialog: AlertDialog? = null
    private var waitingForInstallPermission = false
    private var launchedTwa = false

    private val installLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        if (!isFinishing && !isDestroyed) {
            showInstallIncompleteDialog()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state -> render(state) }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (waitingForInstallPermission) {
            waitingForInstallPermission = false
            permissionDialog?.dismiss()
            permissionDialog = null
            installPendingApk()
        }
    }

    private fun render(state: UpdateUiState) {
        when (state) {
            UpdateUiState.Checking -> {
                binding.splashStatus.setText(R.string.checking_update)
                binding.splashProgress.visibility = View.VISIBLE
            }

            UpdateUiState.NoUpdate -> launchTwa()

            is UpdateUiState.UpdateAvailable -> {
                binding.splashProgress.visibility = View.GONE
                binding.splashStatus.setText(R.string.update_available_short)
                showUpdateDialog(state.manifest, state.forced)
            }

            is UpdateUiState.Downloading -> {
                binding.splashProgress.visibility = View.GONE
                binding.splashStatus.setText(R.string.downloading_update)
                showDownloadDialog(state)
            }

            is UpdateUiState.ReadyToInstall -> {
                dismissDownloadDialog()
                binding.splashProgress.visibility = View.GONE
                binding.splashStatus.setText(R.string.ready_to_install)
                viewModel.setPendingInstall(state.file)
                installPendingApk()
            }

            is UpdateUiState.Error -> {
                binding.splashProgress.visibility = View.GONE
                if (state.manifest == null) {
                    binding.splashStatus.setText(R.string.offline_continue)
                    launchTwa()
                } else {
                    dismissDownloadDialog()
                    showDownloadErrorDialog(state)
                }
            }
        }
    }

    private fun showUpdateDialog(manifest: UpdateManifest, forced: Boolean) {
        if (isFinishing || isDestroyed) return
        if (updateDialog?.isShowing == true) return

        val message = buildString {
            append(getString(R.string.update_version_label, manifest.versionName))
            if (manifest.changelog.isNotBlank()) {
                append("\n\n")
                append(manifest.changelog)
            }
            if (manifest.apkSizeBytes > 0) {
                append("\n\n")
                append(getString(R.string.update_size_label, formatSize(manifest.apkSizeBytes)))
            }
        }

        val builder = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.update_available_title)
            .setMessage(message)
            .setPositiveButton(R.string.update_now) { _, _ ->
                updateDialog = null
                viewModel.startDownload(manifest, forced)
            }

        if (!forced) {
            builder.setNegativeButton(R.string.later) { _, _ ->
                updateDialog = null
                viewModel.postpone(manifest)
                launchTwa()
            }
            builder.setOnCancelListener {
                updateDialog = null
                viewModel.postpone(manifest)
                launchTwa()
            }
        } else {
            builder.setCancelable(false)
        }

        updateDialog = builder.show()
    }

    private fun showDownloadDialog(state: UpdateUiState.Downloading) {
        val existing = downloadDialog
        if (existing?.isShowing == true) {
            val progress = existing.findViewById<LinearProgressIndicator>(R.id.downloadProgress)
            val percent = existing.findViewById<android.widget.TextView>(R.id.downloadPercent)
            if (state.progress == null) {
                progress?.isIndeterminate = true
                percent?.text = getString(R.string.downloading_unknown)
            } else {
                progress?.isIndeterminate = false
                progress?.setProgressCompat(state.progress, true)
                percent?.text = getString(R.string.download_percent, state.progress)
            }
            return
        }

        val dialogBinding = DialogDownloadBinding.inflate(layoutInflater)
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.downloading_title)
            .setView(dialogBinding.root)
            .setNegativeButton(R.string.cancel) { _, _ ->
                downloadDialog = null
                viewModel.cancelDownload()
            }
            .setCancelable(false)
            .create()

        dialog.show()
        downloadDialog = dialog

        if (state.progress == null) {
            dialogBinding.downloadProgress.isIndeterminate = true
            dialogBinding.downloadPercent.text = getString(R.string.downloading_unknown)
        } else {
            dialogBinding.downloadProgress.isIndeterminate = false
            dialogBinding.downloadProgress.setProgressCompat(state.progress, false)
            dialogBinding.downloadPercent.text = getString(R.string.download_percent, state.progress)
        }
    }

    private fun dismissDownloadDialog() {
        downloadDialog?.dismiss()
        downloadDialog = null
    }

    private fun showDownloadErrorDialog(state: UpdateUiState.Error) {
        if (isFinishing || isDestroyed) return
        if (errorDialog?.isShowing == true) return

        val builder = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.download_failed_title)
            .setMessage(state.message)
            .setPositiveButton(R.string.retry) { _, _ ->
                errorDialog = null
                state.manifest?.let { viewModel.startDownload(it, state.forced) }
            }
            .setNeutralButton(R.string.open_release_page) { _, _ ->
                errorDialog = null
                openReleasePage()
            }

        if (!state.forced) {
            builder.setNegativeButton(R.string.continue_without_update) { _, _ ->
                errorDialog = null
                launchTwa()
            }
            builder.setOnCancelListener {
                errorDialog = null
                launchTwa()
            }
        } else {
            builder.setCancelable(false)
        }

        errorDialog = builder.show()
    }

    private fun installPendingApk() {
        val file = viewModel.pendingInstallFile ?: return
        if (!file.exists()) {
            viewModel.setPendingInstall(null)
            return
        }

        if (!ApkInstaller.canInstall(this)) {
            waitingForInstallPermission = true
            permissionDialog?.dismiss()
            permissionDialog = MaterialAlertDialogBuilder(this)
                .setTitle(R.string.install_permission_title)
                .setMessage(R.string.install_permission_message)
                .setPositiveButton(R.string.open_settings) { _, _ ->
                    permissionDialog = null
                    ApkInstaller.openUnknownSourcesSettings(this)
                }
                .setNegativeButton(R.string.cancel) { _, _ ->
                    permissionDialog = null
                    waitingForInstallPermission = false
                    launchTwa()
                }
                .setCancelable(false)
                .show()
            return
        }

        try {
            installLauncher.launch(ApkInstaller.createInstallIntent(this, file))
            binding.splashStatus.setText(R.string.installer_opened)
        } catch (e: Exception) {
            MaterialAlertDialogBuilder(this)
                .setTitle(R.string.install_failed_title)
                .setMessage(e.message ?: getString(R.string.install_failed_message))
                .setPositiveButton(R.string.open_release_page) { _, _ -> openReleasePage() }
                .setNegativeButton(R.string.close, null)
                .show()
        }
    }

    private fun showInstallIncompleteDialog() {
        val manifest = (viewModel.state.value as? UpdateUiState.ReadyToInstall)?.manifest
        val forced = manifest?.let {
            BuildConfig.VERSION_CODE < it.minSupportedVersionCode
        } ?: false

        val builder = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.install_incomplete_title)
            .setMessage(
                if (forced) R.string.install_incomplete_forced_message
                else R.string.install_incomplete_message
            )
            .setPositiveButton(R.string.retry) { _, _ -> installPendingApk() }

        if (forced) {
            builder.setNeutralButton(R.string.open_release_page) { _, _ -> openReleasePage() }
            builder.setCancelable(false)
        } else {
            builder.setNegativeButton(R.string.continue_without_update) { _, _ -> launchTwa() }
            builder.setOnCancelListener { launchTwa() }
        }

        builder.show()
    }

    private fun launchTwa() {
        if (launchedTwa) return
        launchedTwa = true
        // NEW_TASK penting: tanpa flag ini, LauncherActivity akan mencipta instance
        // kedua melalui restartInNewTask(). Pada MIUI/HyperOS kedua-dua instance
        // boleh finish serentak, menyebabkan app terus keluar.
        val intent = Intent(this, TwaActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
        finish()
    }

    private fun openReleasePage() {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.RELEASE_PAGE_URL)))
        } catch (_: Exception) {
        }
    }

    private fun formatSize(bytes: Long): String {
        val mb = bytes / (1024.0 * 1024.0)
        return String.format(Locale("ms", "MY"), "%.1f MB", mb)
    }

    override fun onDestroy() {
        updateDialog?.dismiss()
        downloadDialog?.dismiss()
        errorDialog?.dismiss()
        permissionDialog?.dismiss()
        super.onDestroy()
    }
}
