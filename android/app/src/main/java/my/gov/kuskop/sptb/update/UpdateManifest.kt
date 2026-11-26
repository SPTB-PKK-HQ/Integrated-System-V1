package my.gov.kuskop.sptb.update

import org.json.JSONObject

data class UpdateManifest(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val sha256: String,
    val apkSizeBytes: Long,
    val minSupportedVersionCode: Int,
    val changelog: String,
    val publishedAt: String?
) {
    companion object {
        private const val GITHUB_PREFIX =
            "https://github.com/SPTB-PKK-HQ/Integrated-System-V1/releases/download/"
        private val SHA256_REGEX = Regex("^[a-fA-F0-9]{64}$")

        fun parse(json: String): UpdateManifest {
            val obj = JSONObject(json)
            val versionCode = obj.optInt("versionCode", 0)
            val versionName = obj.optString("versionName", "").trim()
            val apkUrl = obj.optString("apkUrl", "").trim()
            val sha256 = obj.optString("sha256", "").trim()
            val apkSizeBytes = obj.optLong("apkSizeBytes", 0L)
            val minSupportedVersionCode = obj.optInt("minSupportedVersionCode", 1)
            val changelog = obj.optString("changelog", "").trim()
            val publishedAt = obj.optString("publishedAt", "").trim().ifEmpty { null }

            require(versionCode > 0) { "versionCode tidak sah" }
            require(versionName.isNotEmpty()) { "versionName kosong" }
            require(apkUrl.startsWith(GITHUB_PREFIX)) { "apkUrl bukan dari repo rasmi" }
            require(SHA256_REGEX.matches(sha256)) { "sha256 tidak sah" }
            require(apkSizeBytes > 0) { "apkSizeBytes tidak sah" }
            require(minSupportedVersionCode >= 0) { "minSupportedVersionCode tidak sah" }

            return UpdateManifest(
                versionCode = versionCode,
                versionName = versionName,
                apkUrl = apkUrl,
                sha256 = sha256,
                apkSizeBytes = apkSizeBytes,
                minSupportedVersionCode = minSupportedVersionCode,
                changelog = changelog,
                publishedAt = publishedAt
            )
        }
    }
}
