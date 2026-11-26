package my.gov.kuskop.sptb.update

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import my.gov.kuskop.sptb.BuildConfig
import java.io.File

sealed interface UpdateUiState {
    data object Checking : UpdateUiState
    data object NoUpdate : UpdateUiState
    data class UpdateAvailable(val manifest: UpdateManifest, val forced: Boolean) : UpdateUiState
    data class Downloading(val manifest: UpdateManifest, val progress: Int?) : UpdateUiState
    data class ReadyToInstall(val manifest: UpdateManifest, val file: File) : UpdateUiState
    data class Error(
        val message: String,
        val manifest: UpdateManifest?,
        val forced: Boolean
    ) : UpdateUiState
}

class UpdateViewModel(app: Application) : AndroidViewModel(app) {

    private val prefs = app.getSharedPreferences("sptb_update", Context.MODE_PRIVATE)
    private val checker = UpdateChecker()
    private val downloader = ApkDownloader(app)
    private val _state = MutableStateFlow<UpdateUiState>(UpdateUiState.Checking)
    val state: StateFlow<UpdateUiState> = _state.asStateFlow()

    private var downloadJob: Job? = null
    var pendingInstallFile: File? = null
        private set

    init {
        checkForUpdate()
    }

    fun checkForUpdate() {
        _state.value = UpdateUiState.Checking
        viewModelScope.launch {
            if (!BuildConfig.ENABLE_UPDATE_CHECK) {
                _state.value = UpdateUiState.NoUpdate
                return@launch
            }

            checker.fetch()
                .onSuccess { manifest ->
                    val forced = BuildConfig.VERSION_CODE < manifest.minSupportedVersionCode
                    if (manifest.versionCode > BuildConfig.VERSION_CODE && !isPostponed(manifest, forced)) {
                        _state.value = UpdateUiState.UpdateAvailable(manifest, forced)
                    } else {
                        _state.value = UpdateUiState.NoUpdate
                    }
                }
                .onFailure { error ->
                    _state.value = UpdateUiState.Error(
                        message = error.message ?: "Gagal menyemak kemas kini.",
                        manifest = null,
                        forced = false
                    )
                }
        }
    }

    fun startDownload(manifest: UpdateManifest, forced: Boolean) {
        if (downloadJob?.isActive == true) return
        _state.value = UpdateUiState.Downloading(manifest, 0)
        downloadJob = viewModelScope.launch {
            downloader.download(manifest) { progress ->
                val current = _state.value
                if (current is UpdateUiState.Downloading &&
                    current.manifest.versionCode == manifest.versionCode
                ) {
                    _state.value = current.copy(progress = progress)
                }
            }.onSuccess { file ->
                _state.value = UpdateUiState.ReadyToInstall(manifest, file)
            }.onFailure { error ->
                _state.value = UpdateUiState.Error(
                    message = error.message ?: "Muat turun gagal.",
                    manifest = manifest,
                    forced = forced
                )
            }
        }
    }

    fun cancelDownload() {
        val current = _state.value
        downloadJob?.cancel()
        downloadJob = null
        if (current is UpdateUiState.Downloading) {
            val forced = BuildConfig.VERSION_CODE < current.manifest.minSupportedVersionCode
            _state.value = UpdateUiState.UpdateAvailable(current.manifest, forced)
        }
    }

    fun postpone(manifest: UpdateManifest) {
        prefs.edit()
            .putInt("postponed_version_code", manifest.versionCode)
            .putLong("postponed_at", System.currentTimeMillis())
            .apply()
    }

    fun setPendingInstall(file: File?) {
        pendingInstallFile = file
    }

    private fun isPostponed(manifest: UpdateManifest, forced: Boolean): Boolean {
        if (forced) return false
        val version = prefs.getInt("postponed_version_code", 0)
        val at = prefs.getLong("postponed_at", 0L)
        return version == manifest.versionCode &&
            (System.currentTimeMillis() - at) < POSTPONE_MILLIS
    }

    companion object {
        private const val POSTPONE_MILLIS = 12L * 60L * 60L * 1000L
    }
}
