// Tentukan nama Tab Sheet anda
const SHEET_NAME = "Sheet1";
const USERS_SHEET_NAME = "Users";
const LOGS_SHEET_NAME = "Logs";

// FOLDER INDUK ID - Disimpan di Script Properties (key: MAIN_FOLDER_ID)
const MAIN_FOLDER_NAME = "STB MAIN FOLDER";
function getMainFolderId() {
  return PropertiesService.getScriptProperties().getProperty('MAIN_FOLDER_ID') || '1-IszGRdSjoJz2oOjUs_KO7HRz7oE2Hzn';
}
function getEmailToSPI() {
  return PropertiesService.getScriptProperties().getProperty('EMAIL_TO_SPI') || '';
}
function getEmailCcSPTB() {
  return PropertiesService.getScriptProperties().getProperty('EMAIL_CC_SPTB') || '';
}

// Domain rasmi yang dibenarkan untuk akses
const AUTHORIZED_DOMAIN = "kuskop.gov.my";
const ADDITIONAL_AUTHORIZED_DOMAINS = ["kuskop.gov.my"]; // Boleh tambah domain lain jika perlu

// =========================================================================
// V6.5.0: API KEYS - DIBACA DARI SCRIPT PROPERTIES UNTUK KESELAMATAN
// =========================================================================
// Semua key/kata laluan disimpan di Script Properties (File > Project settings > Script Properties)
// Nama property: YOUTUBE_API_KEY

function getScriptProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

// Role definitions
const ROLE_PENGESYOR = "PENGESYOR";
const ROLE_PELULUS = "PELULUS";
const ROLE_PENGARAH = "PENGARAH";
const ROLE_KETUA_SEKSYEN = "KETUA_SEKSYEN";
const ROLE_ADMIN = "ADMIN";
const ROLE_PKA = "PKA";

// Jumlah lajur dalam sheet (A hingga AF = 32 lajur)
const TOTAL_COLUMNS = 32;

// === CACHE CONFIG ===
const APP_DATA_CACHE_KEY = 'STB_APP_DATA_V3';
const APP_DATA_VERSION_KEY = 'STB_APP_DATA_VERSION';
const APP_DATA_CACHE_TTL = 600; // 10 minit

// V6.9.3: Chunked cache untuk getData - DocumentCache had 10MB/doc, 100KB/key.
// Data JSON ~7.4MB dimampatkan gzip + base64 dan dipecah kepada beberapa chunk.
// CHUNK 45KB: selamat di bawah had 100KB per entry dalam kedua-dua kiraan
// (bait UTF-8 DAN unit UTF-16 - 90KB sebelumnya melebihi had jika dikira sebagai string UTF-16).
const APP_DATA_CHUNK_PREFIX = 'STB_APP_DATA_CHUNK_';
const APP_DATA_CHUNK_COUNT_KEY = APP_DATA_CHUNK_PREFIX + 'COUNT';
const APP_DATA_CHUNK_LIMIT = 45000; // 45KB per chunk (selamat di bawah 100KB/key)
const APP_DATA_CHUNK_TTL = 600; // 10 minit

// V6.11.0: Rebuild lock - elak "stampede" (banyak eksekusi baca sheet serentak
// bila chunked cache tamat). Hanya SATU eksekusi baca spreadsheet; yang lain
// dapat rebuilding:true dan cuba semula. TTL 90 saat cukup untuk rebuild penuh.
const APP_DATA_REBUILD_KEY = 'STB_APP_DATA_REBUILDING';
const APP_DATA_REBUILD_TTL = 90;

// V6.10.0: Window bulan semasa - hanya data N bulan terkini dimuat secara lalai.
// Data bulan lama dimuat atas permintaan (butang "Muat Data Bulan Lama").
const DEFAULT_MONTHS_WINDOW = 3;

// Email recipients for SPI notifications - disimpan di Script Properties
// Key: EMAIL_TO_SPI, EMAIL_CC_SPTB

// Nama penghantar emel
const EMAIL_SENDER_NAME = "Sistem Bersepadu SPTB";

// =========================================================================
// V6.5.0: FUNGSI MIDDLEWARE PENGESAHAN (VERIFICATION)
// =========================================================================

/**
 * Normalisasi role: "KETUA SEKSYEN", "KETUA_SEKSYEN" dan "ketua seksyen"
 * dianggap sama (buang ruang/garis bawah/sempang, huruf besar semua).
 */
function normalizeRoleKey(role) {
  return String(role || '').toUpperCase().trim().replace(/[\s_-]+/g, '');
}

/**
 * Fungsi verifyUserAccess: Middleware pengesahan akses pengguna
 * Menyemak sama ada pengguna mempunyai role yang dibenarkan
 * @param {string} email - Alamat emel pengguna
 * @param {Array<string>} allowedRolesArray - Senarai role yang dibenarkan
 * @returns {Object} - { isAuthorized: boolean, userProfile: Object|null, error: string|null }
 */
function verifyUserAccess(email, allowedRolesArray) {
  try {
    // Semak jika email disediakan
    if (!email || email.toString().trim() === '') {
      return {
        isAuthorized: false,
        userProfile: null,
        error: 'Akses Ditolak: Emel tidak disediakan.'
      };
    }
    
    // Dapatkan pengesahan email dan domain
    const authResult = getAuthenticatedUserEmail(email);
    if (!authResult.isValid) {
      return {
        isAuthorized: false,
        userProfile: null,
        error: `Akses Ditolak: ${authResult.error}`
      };
    }
    
    // Cari profil pengguna dari Sheet 'Users' (V6.9.0: guna versi cache)
    const userProfile = findUserByEmailCached(authResult.email);
    if (!userProfile) {
      return {
        isAuthorized: false,
        userProfile: null,
        error: 'Akses Ditolak: Pengguna tidak berdaftar dalam sistem.'
      };
    }
    
    // Semak role pengguna (normalisasi supaya "KETUA SEKSYEN" & "KETUA_SEKSYEN" dipadankan)
    const userRoleNorm = normalizeRoleKey(userProfile.role);
    if (!allowedRolesArray.some(ar => normalizeRoleKey(ar) === userRoleNorm)) {
      return {
        isAuthorized: false,
        userProfile: userProfile,
        error: `Akses Ditolak: Role '${userProfile.role}' tidak mempunyai kebenaran untuk tindakan ini.`
      };
    }
    
    return {
      isAuthorized: true,
      userProfile: userProfile,
      error: null
    };
    
  } catch (error) {
    Logger.log(`[V6.5.0] Ralat dalam verifyUserAccess: ${error.toString()}`);
    return {
      isAuthorized: false,
      userProfile: null,
      error: `Ralat sistem semasa pengesahan: ${error.toString()}`
    };
  }
}

// =========================================================================
// V6.4.9: FUNGSI AUTHENTIKASI - LOG MASUK AUTOMATIK GOOGLE
// DIUBAH: Menerima email dari parameter frontend (bukan Session.getActiveUser())
// =========================================================================

/**
 * Fungsi untuk mendapatkan email pengguna dari parameter frontend dan melakukan validasi domain
 * DIUBAH: Menerima email sebagai parameter dan bukannya dari Session.getActiveUser()
 * @param {string} email - Alamat emel pengguna yang dihantar oleh frontend
 * @returns {Object} - { email: string, isValid: boolean, error: string|null }
 */
function getAuthenticatedUserEmail(email) {
  try {
    // Semak jika email disediakan oleh frontend
    if (!email || email.toString().trim() === '') {
      return { 
        email: null, 
        isValid: false, 
        error: 'Emel tidak disediakan. Sila pastikan anda telah log masuk dan menghantar emel yang sah.'
      };
    }
    
    const normalizedEmail = email.toString().trim().toLowerCase();

    // Semak domain
    const emailDomain = normalizedEmail.split('@')[1];
    if (!emailDomain) {
      return { 
        email: normalizedEmail, 
        isValid: false, 
        error: 'Format emel tidak sah. Sila semak alamat emel anda.'
      };
    }
    
    const allAuthorizedDomains = [AUTHORIZED_DOMAIN, ...ADDITIONAL_AUTHORIZED_DOMAINS];
    const isAuthorized = allAuthorizedDomains.some(domain => emailDomain === domain.toLowerCase());
    
    if (!isAuthorized) {
      return { 
        email: normalizedEmail, 
        isValid: false, 
        error: `Akses tidak dibenarkan. Hanya akaun dengan domain @${AUTHORIZED_DOMAIN} dibenarkan. Emel anda: ${normalizedEmail}`
      };
    }
    
    return { email: normalizedEmail, isValid: true, error: null };

  } catch (error) {
    Logger.log(`[V6.5.0] Ralat mendapatkan email pengguna: ${error.toString()}`);
    return { 
      email: null, 
      isValid: false, 
      error: 'Ralat mendapatkan sesi pengguna. Sila muat semula halaman dan log masuk ke akaun Google anda.'
    };
  }
}

/**
 * Fungsi untuk mencari profil pengguna dari Sheet 'Users' berdasarkan emel
 * @param {string} email - Alamat emel pengguna
 * @returns {Object|null} - Objek pengguna atau null jika tidak dijumpai
 */
function findUserByEmail(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    
    if (!sheet) {
      Logger.log(`[V6.5.0] Sheet '${USERS_SHEET_NAME}' tidak dijumpai`);
      return null;
    }
    
    const data = sheet.getDataRange().getDisplayValues();
    if (!data || data.length < 2) {
      Logger.log(`[V6.5.0] Sheet '${USERS_SHEET_NAME}' tiada data`);
      return null;
    }
    
    const headers = data.shift();
    // Cari indeks lajur berdasarkan nama header
    const nameColIndex = headers.findIndex(h => h && h.toString().toUpperCase().includes('NAMA'));
    const emailColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('EMEL') || h.toString().toUpperCase().includes('EMAIL') || h.toString().toUpperCase().includes('E-MEL')));
    const roleColIndex = headers.findIndex(h => h && h.toString().toUpperCase().includes('ROLE'));
    const colorColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('WARNA') || h.toString().toUpperCase().includes('COLOR')));
    const phoneColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('TELEFON') || h.toString().toUpperCase().includes('PHONE') || h.toString().toUpperCase().includes('NO TEL')));
    // V6.5.1: Cari indeks untuk Tandatangan dan Cop
    const signColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('TANDATANGAN') || h.toString().toUpperCase().includes('SIGN')));
    const copColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('COP') || h.toString().toUpperCase().includes('STAMP')));
    // Cari indeks untuk gambar pengguna
    const imageColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('GAMBAR') || h.toString().toUpperCase().includes('IMAGE') || h.toString().toUpperCase().includes('PHOTO') || h.toString().toUpperCase().includes('PICTURE') || h.toString().toUpperCase().includes('PROFILE')));
    
    const finalNameIndex = nameColIndex !== -1 ? nameColIndex : 0;
    const finalEmailIndex = emailColIndex !== -1 ? emailColIndex : 1;
    const finalRoleIndex = roleColIndex !== -1 ? roleColIndex : 2;
    const finalColorIndex = colorColIndex !== -1 ? colorColIndex : 3;
    const finalPhoneIndex = phoneColIndex !== -1 ? phoneColIndex : 5;
    const finalImageIndex = imageColIndex !== -1 ? imageColIndex : 7;
    const finalSignIndex = signColIndex !== -1 ? signColIndex : -1;
    const finalCopIndex = copColIndex !== -1 ? copColIndex : -1;
    
    // Cari pengguna berdasarkan emel (case-insensitive)
    const normalizedSearchEmail = email.toLowerCase().trim();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowEmail = row[finalEmailIndex] ? row[finalEmailIndex].toString().trim().toLowerCase() : '';
      
      if (rowEmail === normalizedSearchEmail) {
        const safeGet = (index, defaultValue = '') => {
          return row && row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : defaultValue;
        };
        
        const user = {
          name: safeGet(finalNameIndex),
          email: safeGet(finalEmailIndex),
          role: safeGet(finalRoleIndex).toUpperCase(),
          color: safeGet(finalColorIndex),
          phone: safeGet(finalPhoneIndex),
          imageUrl: safeGet(finalImageIndex),
          // V6.5.1: Tambah atribut signUrl dan copUrl
          signUrl: finalSignIndex !== -1 ? safeGet(finalSignIndex) : '',
          copUrl: finalCopIndex !== -1 ? safeGet(finalCopIndex) : ''
        };

        Logger.log(`[V6.5.0] Pengguna dijumpai: ${user.name} (${user.email}) - Role: ${user.role}`);
        return user;
      }
    }
    
    Logger.log(`[V6.5.0] Tiada padanan pengguna untuk emel: ${email}`);
    return null;
    
  } catch (error) {
    Logger.log(`[V6.5.0] Ralat mencari pengguna: ${error.toString()}`);
    return null;
  }
}

// V6.9.0: Versi cache findUserByEmail untuk elak baca penuh sheet Users
// pada setiap permintaan (mempercepatkan verifyUserAccess).
// TTL 10 minit; cache dibuang dalam handleAddUser/UpdateUser/DeleteUser.
const USER_CACHE_TTL_SECONDS = 600;

function findUserByEmailCached(email) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'STB_USER_' + String(email).toLowerCase().trim();
    
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    
    const user = findUserByEmail(email);
    if (user) {
      try {
        cache.put(cacheKey, JSON.stringify(user), USER_CACHE_TTL_SECONDS);
      } catch (e) {}
    }
    return user;
  } catch (error) {
    Logger.log(`[V6.9.0] Ralat cache pengguna: ${error.toString()}`);
    return findUserByEmail(email);
  }
}

function invalidateUserCache(email) {
  try {
    if (!email) return;
    const cache = CacheService.getScriptCache();
    cache.remove('STB_USER_' + String(email).toLowerCase().trim());
  } catch (e) {}
}

/**
 * Fungsi untuk mengendalikan permintaan checkAuth dari frontend
 * DIUBAH: Menerima email dari parameter GET/POST dan bukannya Session.getActiveUser()
 * V6.5.0: Menambah Firebase code untuk PENGESYOR
 * @param {string} email - Alamat emel dari frontend
 * @returns {ContentService.TextOutput} - Respons JSON dengan status pengesahan
 */
function handleCheckAuth(email) {
  try {
    // Dapatkan email pengguna dari parameter frontend dan validasi domain
    const authResult = getAuthenticatedUserEmail(email);

    if (!authResult.isValid) {
      return createJSONOutput({
        authenticated: false,
        error: authResult.error,
        code: 403
      });
    }
    
    // Cari profil pengguna dari Sheet 'Users' (V6.9.0: guna versi cache)
    const userProfile = findUserByEmailCached(authResult.email);

    if (!userProfile) {
      return createJSONOutput({
        authenticated: false,
        email: authResult.email,
        error: 'Akaun Google anda (' + authResult.email + ') tidak berdaftar dalam sistem. Sila hubungi Pentadbir.',
        code: 403
      });
    }
    
    // V6.5.0: Jika role adalah PENGESYOR, semak dan masukkan Firebase code
    // Firebase code disimpan di Script Properties dengan key format: FIREBASE_CODE_MAP_<email>
    if (userProfile.role === ROLE_PENGESYOR) {
      const propKey = 'FIREBASE_CODE_MAP_' + userProfile.email.toLowerCase();
      const firebaseCode = getScriptProp(propKey);
      if (firebaseCode) {
        userProfile.firebaseCode = firebaseCode;
        Logger.log(`[V6.5.0] Firebase code disediakan untuk PENGESYOR: ${userProfile.email}`);
      } else {
        Logger.log(`[V6.5.0] Tiada Firebase code untuk PENGESYOR: ${userProfile.email}`);
        // Tidak perlu gagalkan auth jika tiada Firebase code, cuma tidak disertakan
      }
    }
    
    // Auth berjaya
    return createJSONOutput({
      authenticated: true,
      user: userProfile,
      message: 'Log masuk berjaya'
    });

  } catch (error) {
    Logger.log(`[V6.5.0] Ralat dalam handleCheckAuth: ${error.toString()}`);
    return createJSONOutput({
      authenticated: false,
      error: 'Ralat sistem semasa pengesahan: ' + error.toString(),
      code: 500
    });
  }
}

// =========================================================================
// FUNGSI doGet: Mengendalikan permintaan GET (Membaca Data, CheckAuth)
// DIUBAH: Action 'checkAuth' kini menerima parameter 'email' dari frontend
// =========================================================================
function doGet(e) {
  // doGet hanya membaca data, tidak memerlukan ScriptLock yang melambatkan sistem
  try {
    const action = e.parameter ? e.parameter.action : "";
    const role = e.parameter ? e.parameter.role : "";
    const userName = e.parameter ? e.parameter.userName : "";
    const email = e.parameter ? e.parameter.email : "";
    const clientVersion = e.parameter ? e.parameter.v : "";

    // V6.4.9: Handler untuk checkAuth - kini menerima email dari parameter
    if (action === "checkAuth") {
      return handleCheckAuth(email);
    }
    
    // V6.5.0: Handler untuk getQueueData
    if (action === "getQueueData") {
      if (!email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan untuk akses queue data." });
      }
      const accessCheck = verifyUserAccess(email, [ROLE_ADMIN, ROLE_PENGESYOR, ROLE_PELULUS, ROLE_PENGARAH, ROLE_KETUA_SEKSYEN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      
      const props = PropertiesService.getScriptProperties();
      const siasatQ = JSON.parse(props.getProperty('SIASAT_QUEUE') || "[]");
      const pemutihanQ = JSON.parse(props.getProperty('PEMUTIHAN_QUEUE') || "[]");
      return createJSONOutput({ status: "success", siasat: siasatQ, pemutihan: pemutihanQ });
    }
    
    // V6.8.0: Handler untuk getSpiQueueData (SPI Queue Tab)
    if (action === "getSpiQueueData") {
      if (!email) {
        return createJSONOutput({ success: false, error: "Email diperlukan" });
      }
      return getSpiQueueData(email);
    }

    // V6.8.0: Preview backlog tanpa hantar emel
    if (action === "previewSpiBacklog") {
      return getSpiBacklogData();
    }

    // V6.8.0: Trigger manual sendSpiBacklogReminder
    if (action === "sendSpiBacklogReminder") {
      return sendSpiBacklogReminder();
    }

    // V6.8.0: Dapatkan Firebase code untuk email tertentu
    if (action === "getUserFirebaseCode") {
      const fbEmail = e.parameter ? e.parameter.email : '';
      if (fbEmail) {
        const propKey = 'FIREBASE_CODE_MAP_' + fbEmail.toLowerCase().trim();
        const code = PropertiesService.getScriptProperties().getProperty(propKey) || '';
        return createJSONOutput({ status: "success", firebaseCode: code });
      }
      return createJSONOutput({ status: "error", firebaseCode: '' });
    }
    
    let result;
    if (action === "getUsers") {
      result = getUsersData();
    } else if (action === "refreshData") {
      // V6.6.0: Paksa refresh dengan increment version
      invalidateDataCache();
      result = getApplicationsData(role, userName, '', true, '', DEFAULT_MONTHS_WINDOW, '', '');
    } else if (action === "getRow") {
      const rowNum = parseInt(e.parameter.row);
      result = getSingleRowData(rowNum);
    } else if (action === "getData") {
      // V6.10.0: refresh=true paksa baca semula sheet; months lalai 3 (window bulan semasa);
      // from/to untuk data bulan lama (mod sejarah); w = windowStart client untuk version check.
      const forceRefresh = e.parameter.refresh === 'true' || e.parameter.refresh === '1';
      result = getApplicationsData(role, userName, clientVersion, forceRefresh,
        e.parameter.w || '', e.parameter.months || DEFAULT_MONTHS_WINDOW,
        e.parameter.from || '', e.parameter.to || '');
    } else if (action === "getDashboardStats") {
      // V6.10.0: Agregat kecil untuk dashboard (12 bulan, <50KB, cache ScriptCache)
      result = getDashboardStats(role, userName);
    } else {
      result = getApplicationsData(role, userName, clientVersion, false,
        e.parameter.w || '', DEFAULT_MONTHS_WINDOW, '', '');
    }
    
    return result;
  } catch (error) {
    return createJSONOutput({ 
      status: "error", 
      message: error.toString() 
    });
  } 
  // Blok finally lock.releaseLock() dibuang kerana lock tidak lagi digunakan di sini
}
/**
 * Fungsi doPost: Mengendalikan permintaan POST (Simpan Data / Cipta Folder / Padam Rekod / Cetak PDF / AI Processing / CheckAuth)
 * V6.5.0: Menambah pengesahan verifyUserAccess untuk semua tindakan kritikal
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  
  try {
    // 1. Parse data terlebih dahulu untuk mengetahui jenis 'action'
    const data = JSON.parse(e.postData.contents);
    
    // 2. Senarai tindakan yang TIDAK perlukan lock (Log masuk & API Luar yang lama)
    const noLockActions = ['checkAuth', 'searchYoutube', 'cetak_dan_simpan_pdf', 'refreshData', 'listDriveFiles', 'pkaGetPengesyorContact'];
    
    // 3. Hanya lock jika ia adalah operasi menulis (write) ke dalam Google Sheet
    if (!noLockActions.includes(data.action)) {
      lock.waitLock(28000);
      locked = true;
    }
    
    // NOTA PRESTASI (V6.9.0): Spreadsheet TIDAK dibuka di awal doPost.
    // Ia hanya dibuka secara 'lazy' untuk action yang benar-benar memerlukan
    // sheet (deleteRecord, restoreRecord, pkaUpdateLawatan, handleUpdateRecord,
    // handleInsertNewRecord).
    // Action seperti checkAuth tidak lagi membazir masa buka sheet.
    // =====================================================================
    // V6.4.9: HANDLER UNTUK CHECK AUTH MELALUI POST
    // Frontend boleh menghantar { action: 'checkAuth', email: '...' }
    // =====================================================================
    if (data.action === 'checkAuth') {
      return handleCheckAuth(data.email || '');
    }
    
    // =====================================================================
    // HANDLER UNTUK YOUTUBE CUSTOM PLAYER
    // =====================================================================
    if (data.action === 'searchYoutube') {
      return handleSearchYoutube(data.query);
    }
    
    // =====================================================================
    // V6.5.0: PENGESAHAN UNTUK SEMUA TINDAKAN KRITIKAL
    // =====================================================================
    
    // Handler untuk dapatkan log
    if (data.action === 'getLogs') {
      return handleGetLogs();
    }
    
    // Handler untuk padam rekod
    if (data.action === 'deleteRecord') {
      // V6.5.0: Pengesahan ketat untuk deleteRecord
      const sheet = getMainSheet();
      if (!sheet) {
        return createJSONOutput({ status: "error", message: "Sheet not found" });
      }
      return handleDeleteRecord(data, sheet);
    }
    
    // Handler untuk restore rekod dari snapshot
    if (data.action === 'restoreRecord') {
      const sheet = getMainSheet();
      if (!sheet) {
        return createJSONOutput({ status: "error", message: "Sheet not found" });
      }
      return handleRestoreRecord(data, sheet);
    }
    
    // Handler khas: Butang Cipta Folder (Dari Popup)
    if (data.action === 'createDriveFolder') {
      // V6.5.0: Pengesahan untuk createDriveFolder
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan untuk mencipta folder." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      return handleCreateDriveFolderAction(data);
    }
    
    // V6.7.0: Handler untuk listDriveFiles (papar fail dalam folder)
    if (data.action === 'listDriveFiles') {
      return handleListDriveFiles(data);
    }
    
    // V6.7.0: Handler untuk uploadDriveFile
    if (data.action === 'uploadDriveFile') {
      if (!data.email) {
        return createJSONOutput({ success: false, error: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS, ROLE_PKA]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ success: false, error: accessCheck.error });
      }
      return handleUploadDriveFile(data);
    }

    // V6.12.0: Handler muat naik berchunk (progress sebenar tanpa preflight CORS).
    // Setiap chunk dihantar sebagai simple POST (fetch text/plain); backend cantumkan semula.
    if (data.action === 'uploadDriveFileChunk' || data.action === 'finalizeDriveUpload') {
      if (!data.email) {
        return createJSONOutput({ success: false, error: "Email diperlukan." });
      }
      const accessCheckChunk = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS, ROLE_PKA]);
      if (!accessCheckChunk.isAuthorized) {
        return createJSONOutput({ success: false, error: accessCheckChunk.error });
      }
      if (data.action === 'uploadDriveFileChunk') return handleUploadDriveFileChunk(data);
      return handleFinalizeDriveUpload(data);
    }
    
    // V6.7.0: Handler untuk deleteDriveFile
    if (data.action === 'deleteDriveFile') {
      if (!data.email) {
        return createJSONOutput({ success: false, error: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS, ROLE_PKA]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ success: false, error: accessCheck.error });
      }
      return handleDeleteDriveFile(data);
    }
    
    // V6.7.2: Handler untuk renameDriveFile
    if (data.action === 'renameDriveFile') {
      if (!data.email) {
        return createJSONOutput({ success: false, error: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ success: false, error: accessCheck.error });
      }
      return handleRenameDriveFile(data);
    }
    
    // Handler baharu: Cetak dan simpan PDF
    if (data.action === 'cetak_dan_simpan_pdf') {
      // V6.5.0: Pengesahan untuk cetak PDF
      if (!data.email) {
        return createJSONOutput({ success: false, message: "Email diperlukan untuk mencetak PDF." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ success: false, message: accessCheck.error });
      }
      return handleCetakDanSimpanPDF(data);
    }
    
    // V6.8.0: Handler untuk addUser (Admin sahaja)
    if (data.action === 'addUser') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      data.adminName = accessCheck.userProfile.name;
      // data.userEmail = email pengguna baru, data.email = email admin
      data.newUserEmail = data.userEmail || '';
      return handleAddUser(data);
    }
    
    // V6.8.0: Handler untuk updateUser (Admin sahaja)
    if (data.action === 'updateUser') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      data.adminName = accessCheck.userProfile.name;
      // data.targetEmail = email pengguna yang nak diupdate
      return handleUpdateUser(data);
    }
    
    // V6.8.0: Handler untuk deleteUser (Admin sahaja)
    if (data.action === 'deleteUser') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      data.adminName = accessCheck.userProfile.name;
      return handleDeleteUser(data);
    }
    
    // V6.8.0: Handler untuk archiveYearSheet (Admin sahaja)
    if (data.action === 'archiveYearSheet') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      data.adminName = accessCheck.userProfile.name;
      return handleArchiveYearSheet(data);
    }
    
    // V6.8.0: Handler untuk cleanupFirebaseCodes (Admin sahaja)
    if (data.action === 'cleanupFirebaseCodes') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      return handleCleanupFirebaseCodes(data);
    }
    
    // V6.8.0: Handler untuk PKA update lawatan
    if (data.action === 'pkaUpdateLawatan') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PKA]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      const sheet = getMainSheet();
      if (!sheet) {
        return createJSONOutput({ status: "error", message: "Sheet not found" });
      }
      return handlePKAUpdateLawatan(data, sheet);
    }
    
    // V6.8.0: Handler untuk PKA dapatkan contact pengesyor
    if (data.action === 'pkaGetPengesyorContact') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PKA]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      return handlePKAGetPengesyorContact(data);
    }

    // Handler SIASAT: Pelulus sahkan ke SPI (6 petang)
    if (data.action === 'siasatSahkan') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PELULUS, ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      const sheet = getMainSheet();
      if (!sheet) {
        return createJSONOutput({ status: "error", message: "Sheet not found" });
      }
      return handleSiasatSahkan(data, sheet);
    }

    // Handler SIASAT: Pelulus tolak ke Pengesyor + WA
    if (data.action === 'siasatTolak') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PELULUS, ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      const sheet = getMainSheet();
      if (!sheet) {
        return createJSONOutput({ status: "error", message: "Sheet not found" });
      }
      return handleSiasatTolak(data, sheet);
    }

    // Handler SIASAT: Pelulus undo pengesahan selagi emel SPI belum dihantar
    if (data.action === 'siasatUndo') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PELULUS, ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      const sheet = getMainSheet();
      if (!sheet) {
        return createJSONOutput({ status: "error", message: "Sheet not found" });
      }
      return handleSiasatUndo(data, sheet);
    }
    
    const shouldCreateFolder = data.createFolder === true;

    // ============================================================
    // LOGIK UTAMA: EDIT / KEMASKINI ROW (BERDASARKAN PARAMETER row)
    // V6.5.0: Menambah pengesahan untuk update record
    // ============================================================
    if (data.row && parseInt(data.row) > 1) {
      // Pengesahan untuk kemaskini rekod
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan untuk mengemaskini rekod." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      const sheet = getMainSheet();
      if (!sheet) {
        return createJSONOutput({ status: "error", message: "Sheet not found" });
      }
      return handleUpdateRecord(data, sheet);
    } 
    // ============================================================
    // LOGIK UTAMA: TAMBAH REKOD BARU (JIKA TIADA data.row)
    // V6.5.0: Menambah pengesahan untuk insert record
    // ============================================================
    else {
      // Pengesahan untuk tambah rekod baru
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan untuk menambah rekod." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      const sheet = getMainSheet();
      if (!sheet) {
        return createJSONOutput({ status: "error", message: "Sheet not found" });
      }
      return handleInsertNewRecord(data, sheet, shouldCreateFolder);
    }
    
  } catch (error) {
    // Semak kedua-dua 'timeout' dan 'timed out'
    if (error.toString().toLowerCase().includes('timeout') || error.toString().includes('timed out')) {
      return createJSONOutput({ 
        status: "error", 
        code: 503,
        message: "Server sibuk memproses data lain, sila cuba sebentar lagi." 
      });
    }
    logActivity("System", 'ERROR', `Ralat: ${error.toString()}`, '');
    return createJSONOutput({ status: "error", message: error.toString() });
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

// =========================================================================
// FUNGSI YOUTUBE CUSTOM PLAYER
// =========================================================================

/**
 * Fungsi handleSearchYoutube: Mencari video YouTube berdasarkan query
 * @param {string} query - Kata kunci carian
 * @returns {ContentService.TextOutput} - Respons JSON dengan hasil carian
 */
function handleSearchYoutube(query) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=video&key=${getScriptProp('YOUTUBE_API_KEY')}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200) {
      return createJSONOutput({ success: false, message: result.error.message || "Ralat API YouTube" });
    }

    return createJSONOutput({ success: true, data: result.items });
  } catch (error) {
    return createJSONOutput({ success: false, message: error.toString() });
  }
}

/**
 * FUNGSI BAHARU: Menukar semua imej luaran dalam HTML kepada Base64
 * V6.5.2: Fungsi ini memastikan semua imej (termasuk cop/sign) tertanam terus dalam HTML
 *          sebelum ditukar ke PDF untuk mengelakkan imej kosong di Google Drive
 */
function embedAllImagesAsBase64(htmlContent) {
  try {
    // Regex untuk mencari semua tag <img> dan mengekstrak atribut src
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    let updatedHtml = htmlContent;
    let replacementCount = 0;
    
    // Cari semua padanan
    while ((match = imgRegex.exec(htmlContent)) !== null) {
      const fullTag = match[0];
      const imgUrl = match[1];
      
      // Langkau jika sudah Base64 atau bukan URL HTTP/HTTPS
      if (imgUrl.startsWith('data:') || !imgUrl.match(/^https?:\/\//i)) {
        continue;
      }
      
      try {
        Logger.log(`[V6.5.2] Memuat turun imej: ${imgUrl.substring(0, 100)}...`);
        
        // Muat turun imej menggunakan UrlFetchApp
        const response = UrlFetchApp.fetch(imgUrl, { 
          muteHttpExceptions: true,
          validateHttpsCertificates: false,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        
        const responseCode = response.getResponseCode();
        
        if (responseCode === 200) {
          const imageBlob = response.getBlob();
          const contentType = imageBlob.getContentType() || 'image/png';
          const base64Data = Utilities.base64Encode(imageBlob.getBytes());
          const base64Src = `data:${contentType};base64,${base64Data}`;
          
          // Gantikan URL asal dengan Base64 dalam tag img
          const updatedTag = fullTag.replace(imgUrl, base64Src);
          updatedHtml = updatedHtml.replace(fullTag, updatedTag);
          
          replacementCount++;
          Logger.log(`[V6.5.2] Berjaya menukar imej ke Base64: ${contentType} (${base64Data.length} bytes base64)`);
        } else {
          Logger.log(`[V6.5.2] Gagal memuat turun imej (HTTP ${responseCode}): ${imgUrl.substring(0, 100)}...`);
        }
        
      } catch (fetchError) {
        Logger.log(`[V6.5.2] Ralat memuat turun imej ${imgUrl.substring(0, 100)}...: ${fetchError.toString()}`);
        // Teruskan dengan imej seterusnya walaupun satu gagal
      }
    }
    
    Logger.log(`[V6.5.2] Selesai menukar imej: ${replacementCount} imej berjaya ditukar ke Base64.`);
    return updatedHtml;
    
  } catch (error) {
    Logger.log(`[V6.5.2] Ralat dalam embedAllImagesAsBase64: ${error.toString()}`);
    // Jika berlaku ralat, kembalikan HTML asal supaya proses tidak gagal sepenuhnya
    return htmlContent;
  }
}

/**
 * FUNGSI BAHARU: Mengendalikan cetakan HTML ke PDF dan simpan ke Drive
 * V6.5.2: Ditambah proses embedAllImagesAsBase64 sebelum penjanaan PDF
 */
function handleCetakDanSimpanPDF(data) {
  try {
    if (!data.htmlContent) return createJSONOutput({ success: false, message: "Kandungan HTML tidak disediakan" });
    if (!data.company_name) return createJSONOutput({ success: false, message: "Nama syarikat tidak disediakan" });
    if (!data.user_name) return createJSONOutput({ success: false, message: "Nama pengguna tidak disediakan" });
    
    const appType = data.application_type || data.subfolder_name;
    
    let targetFolder = null;
    let folderPath = '';
    
    // V6.8.0: Guna folder sedia ada jika diberikan (Kemaskini Drive)
    if (data.existing_folder_url) {
      const existingId = extractFolderIdFromUrl(data.existing_folder_url);
      if (existingId) {
        try {
          targetFolder = DriveApp.getFolderById(existingId);
          folderPath = targetFolder.getName();
        } catch (e) {
          // Folder dah tak wujud, teruskan cipta baru
        }
      }
    }
    
    if (!targetFolder) {
      let mainFolder;
      try {
        mainFolder = DriveApp.getFolderById(getMainFolderId());
      } catch (e) {
        const folders = DriveApp.getFoldersByName(MAIN_FOLDER_NAME);
        if (folders.hasNext()) mainFolder = folders.next();
        else mainFolder = DriveApp.createFolder(MAIN_FOLDER_NAME);
      }
      
      let userFolder = findFolderInParent(mainFolder, data.user_name);
      if (!userFolder) userFolder = mainFolder.createFolder(data.user_name);
      
      let companyFolder = findCompanyFolderInParent(userFolder, data.company_name);
      if (!companyFolder) companyFolder = userFolder.createFolder(data.company_name);
      
      // Jika appType ada, cipta subfolder jenis permohonan; jika tiada, simpan terus dalam folder syarikat
      targetFolder = companyFolder;
      folderPath = `${MAIN_FOLDER_NAME} > ${data.user_name} > ${data.company_name}`;
      if (appType && appType.trim() !== '') {
        let typeFolder = findFolderInParent(companyFolder, appType.toUpperCase());
        if (!typeFolder) typeFolder = companyFolder.createFolder(appType.toUpperCase());
        targetFolder = typeFolder;
        folderPath += ` > ${appType}`;
      }
    }
    
    const themeColor = data.user_color && data.user_color.trim() !== "" ? data.user_color : "#1a73e8";
    
    // Tukar semua imej luaran kepada Base64 SEBELUM membina HTML penuh
    Logger.log(`[V6.5.2] Memproses imej dalam HTML untuk ${data.company_name}...`);
    const embeddedHtmlContent = embedAllImagesAsBase64(data.htmlContent);
    
    const validHtmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', 'Helvetica', sans-serif; background: #fff; padding: 20px; }
    .print-container { max-width: 1000px; margin: 0 auto; background: white; }
    .footer { margin-top: 30px; padding-top: 20px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; }
    @media print {
      body { margin: 0; padding: 0; }
      .print-container { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${embeddedHtmlContent}
    <div class="footer">
      <p>Dokumen ini telah disahkan dan dicetak pada ${new Date().toLocaleString('ms-MY')}</p>
    </div>
  </div>
</body>
</html>
    `;
    
    const blob = Utilities.newBlob(validHtmlContent, MimeType.HTML).getAs(MimeType.PDF);
    const fileName = data.custom_file_name ? data.custom_file_name + '.pdf' : 'Borang_Semakan_' + data.company_name + '.pdf';
    blob.setName(fileName);

    // V6.12.0: Padam Borang Semakan lama — hanya yang terkini dikekalkan dalam Drive (ke Trash, boleh restore 30 hari).
    // Skop ketat: hanya fail nama mula 'Borang Semakan' / 'Borang_Semakan_' (tampung varian biasa, SOKONG, TIDAK DISOKONG, SIASAT, LULUS, TOLAK).
    // Fail lain (surat, KWSP, laporan SPI, upload manual) TIDAK disentuh.
    const deletedFiles = [];
    try {
      const existingFiles = targetFolder.getFiles();
      while (existingFiles.hasNext()) {
        const oldFile = existingFiles.next();
        const oldName = (oldFile.getName() || '').toString().trim();
        const oldUpper = oldName.toUpperCase();
        if (oldUpper.indexOf('BORANG SEMAKAN') === 0 || oldUpper.indexOf('BORANG_SEMAKAN') === 0) {
          try {
            deletedFiles.push(oldName);
            oldFile.setTrashed(true);
          } catch (eDel) {
            Logger.log('[CetakPDF] Gagal padam fail lama ' + oldName + ': ' + eDel.toString());
          }
        }
      }
    } catch (eScan) {
      Logger.log('[CetakPDF] Gagal imbas fail lama: ' + eScan.toString());
    }

    const pdfFile = targetFolder.createFile(blob);

    logActivity(
      data.user_name,
      'CETAK_PDF',
      `PDF Borang Semakan disimpan untuk ${data.company_name} (Warna: ${themeColor})` + (deletedFiles.length > 0 ? ` — ${deletedFiles.length} borang lama dipadam: ${deletedFiles.join(', ')}` : ''),
      targetFolder.getId()
    );
    if (deletedFiles.length > 0) {
      try {
        logActivity(data.user_name, 'CETAK_PDF_GANTI', `Borang lama dipadam untuk ${data.company_name}: ${deletedFiles.join(', ')} — hanya terkini dikekalkan (${fileName})`, targetFolder.getId());
      } catch (eLog) {}
    }

    invalidateDataCache();
    return createJSONOutput({
      success: true,
      folder_url: targetFolder.getUrl(),
      folder_id: targetFolder.getId(),
      file_url: pdfFile.getUrl(),
      file_id: pdfFile.getId(),
      file_name: fileName,
      folder_path: folderPath,
      deleted_count: deletedFiles.length,
      deleted_files: deletedFiles,
      message: deletedFiles.length > 0 ? `PDF berjaya dikemaskini. ${deletedFiles.length} borang lama dipadam, hanya yang terkini dikekalkan.` : "PDF berjaya disimpan dengan imej tertanam dan folder disiapkan"
    });

  } catch (error) {
    logActivity("System", 'ERROR_CETAK_PDF', `Ralat mencetak PDF: ${error.toString()}`, '');
    return createJSONOutput({ success: false, message: `Gagal mencetak dan menyimpan PDF: ${error.toString()}` });
  }
}

/**
 * FUNGSI KEMASKINI REKOD
 */
function handleUpdateRecord(data, sheet) {
  try {
    const userName = data.pengesyor || data.pelulus || data.user || "System";
    const rowNum = parseInt(data.row);
    
    if (rowNum < 2) return createJSONOutput({ status: "error", message: "Nombor baris tidak sah" });
    
    const existingDataRange = sheet.getRange(rowNum, 1, 1, TOTAL_COLUMNS);
    const existingData = existingDataRange.getValues()[0];
    
    // BLOK 1 (A-O: Kolum 1-15)
    const rangePengesyor = sheet.getRange(rowNum, 1, 1, 15);
    const jenisForJustifikasi = data.jenis !== undefined ? data.jenis : existingData[3];
    const updatedPengesyor = [
      data.syarikat !== undefined ? data.syarikat : existingData[0],
      data.cidb !== undefined ? data.cidb : existingData[1],
      data.gred !== undefined ? data.gred : existingData[2],
      data.jenis !== undefined ? data.jenis : existingData[3],
      data.negeri !== undefined ? data.negeri : existingData[4],
      data.tarikh_surat_terdahulu !== undefined ? data.tarikh_surat_terdahulu : existingData[5],
      data.tatatertib !== undefined ? data.tatatertib : existingData[6],
      data.start_date !== undefined ? data.start_date : existingData[7],
      data.syor_lawatan_baru !== undefined ? data.syor_lawatan_baru : (data.syor_lawatan !== undefined ? data.syor_lawatan : existingData[8]),
      data.date_submit_baru !== undefined ? data.date_submit_baru : (data.date_submit !== undefined ? data.date_submit : existingData[9]),
      (data.pautan && data.pautan.toString().trim() !== "") ? data.pautan : existingData[10],
      data.justifikasi_baru !== undefined ? formatJenisJustifikasi(jenisForJustifikasi, data.justifikasi_baru) : (data.justifikasi !== undefined ? formatJenisJustifikasi(jenisForJustifikasi, data.justifikasi) : existingData[11]),
      data.pengesyor !== undefined ? data.pengesyor : existingData[12],
      data.syor_status !== undefined ? data.syor_status : existingData[13],
      data.tarikh_syor !== undefined ? data.tarikh_syor : existingData[14]
    ];
    rangePengesyor.setValues([updatedPengesyor]);

    // BLOK 2: STATUS HANTAR SPI & TARIKH HANTAR SPI (P-Q: Kolum 16-17)
    if (data.status_hantar_spi !== undefined || data.tarikh_hantar_spi !== undefined) {
      const rangeSPI = sheet.getRange(rowNum, 16, 1, 2);
      const currentSPI = rangeSPI.getValues()[0];
      const updatedSPI = [
        data.status_hantar_spi !== undefined ? data.status_hantar_spi : currentSPI[0],
        data.tarikh_hantar_spi !== undefined ? data.tarikh_hantar_spi : currentSPI[1]
      ];
      rangeSPI.setValues([updatedSPI]);
    }

    // BLOK 3 (R-X: Kolum 18-24) - lawatan_tarikh, lawatan_submit_sptb, lawatan_syor, alamat_perniagaan, jenis_konsultansi, alasan, kelulusan
    if (data.lawatan_tarikh !== undefined || data.lawatan_submit_sptb !== undefined ||
        data.lawatan_syor !== undefined || data.alamat_perniagaan !== undefined ||
        data.jenis_konsultansi !== undefined || data.alasan !== undefined ||
        data.kelulusan !== undefined) {
      
      const rangeLawatan = sheet.getRange(rowNum, 18, 1, 7);
      const currentLawatan = rangeLawatan.getValues()[0];
      const updatedLawatan = [
        data.lawatan_tarikh !== undefined ? data.lawatan_tarikh : currentLawatan[0],
        data.lawatan_submit_sptb !== undefined ? data.lawatan_submit_sptb : currentLawatan[1],
        data.lawatan_syor !== undefined ? data.lawatan_syor : currentLawatan[2],
        data.alamat_perniagaan !== undefined ? data.alamat_perniagaan : currentLawatan[3],
        data.jenis_konsultansi !== undefined ? data.jenis_konsultansi : currentLawatan[4],
        data.alasan !== undefined ? data.alasan : currentLawatan[5],
        data.kelulusan !== undefined ? data.kelulusan : currentLawatan[6]
      ];
      rangeLawatan.setValues([updatedLawatan]);
    }
    
    // BLOK 4 (Y-AB: Kolum 25-28) - tarikh_lulus, pelulus, ubah_maklumat, ubah_gred
    if (data.tarikh_lulus !== undefined || data.pelulus !== undefined ||
        data.ubah_maklumat !== undefined || data.ubah_gred !== undefined) {
      
      const rangePelulus = sheet.getRange(rowNum, 25, 1, 4);
      const currentPelulus = rangePelulus.getValues()[0];
      const updatedPelulus = [
        data.tarikh_lulus !== undefined ? data.tarikh_lulus : currentPelulus[0],
        data.pelulus !== undefined ? data.pelulus : currentPelulus[1],
        data.ubah_maklumat !== undefined ? data.ubah_maklumat : currentPelulus[2],
        data.ubah_gred !== undefined ? data.ubah_gred : currentPelulus[3]
      ];
      rangePelulus.setValues([updatedPelulus]);
    }

    // BLOK 5 (AC: Kolum 29) - borang_json
    if (data.borang_json !== undefined) {
      sheet.getRange(rowNum, 29).setValue(data.borang_json);
    }
    
    // BLOK 8 (AF: Kolum 32) - ulasan_spi
    if (data.ulasan_spi !== undefined) {
      sheet.getRange(rowNum, 32).setValue(data.ulasan_spi);
    }
    
    // === OPERASI PASCA-TULISAN (TIDAK KRITIKAL) ===
    // Jika mana-mana gagal, data sheet sudah selamat. Jangan bagi error.
    let pascaActionType = 'UPDATE_RECORD';
    try {
      // AUTO EMAIL LOGIC
      let syorLawatanValue = data.syor_lawatan_baru !== undefined ? data.syor_lawatan_baru : (data.syor_lawatan !== undefined ? data.syor_lawatan : existingData[8]);
      let dateSubmitValue = data.date_submit_baru !== undefined ? data.date_submit_baru : (data.date_submit !== undefined ? data.date_submit : existingData[9]);
      
      const syorLawatanYA = syorLawatanValue && syorLawatanValue.toString().toUpperCase() === 'YA';
      const dateSubmitExists = dateSubmitValue && dateSubmitValue.toString().trim() !== '';
      const hantarEmelSPI = data.hantar_emel_spi === true;

      if (syorLawatanYA && dateSubmitExists && hantarEmelSPI) {
        let alamatPerniagaanValue = data.alamat_perniagaan !== undefined ? data.alamat_perniagaan : existingData[20];
        const emailData = {
          row: rowNum,
          syarikat: data.syarikat !== undefined ? data.syarikat : existingData[0],
          cidb: data.cidb !== undefined ? data.cidb : existingData[1],
          gred: data.gred !== undefined ? data.gred : existingData[2],
          jenis: data.jenis !== undefined ? data.jenis : existingData[3],
          alamat_perniagaan: alamatPerniagaanValue || 'Tiada',
          pengesyor: data.pengesyor !== undefined ? data.pengesyor : existingData[12],
          pelulus: data.pelulus !== undefined ? data.pelulus : existingData[25],
          justifikasi: data.justifikasi_baru !== undefined ? formatJenisJustifikasi(jenisForJustifikasi, data.justifikasi_baru) : (data.justifikasi !== undefined ? formatJenisJustifikasi(jenisForJustifikasi, data.justifikasi) : existingData[11]),
          pautan: (data.pautan && data.pautan.toString().trim() !== "") ? data.pautan : existingData[10],
          date_submit: dateSubmitValue,
          syor_lawatan: syorLawatanValue
        };
        addToSiasatQueue(emailData);
        try { createSpiCalendarEvent(rowNum, emailData.syarikat, emailData.cidb, emailData.jenis, emailData.pengesyor, emailData.date_submit); } catch (e) { console.error(`[SPI Calendar] Gagal buat event row ${rowNum}: ${e.toString()}`); }
      }
      
      const syorLawatanPemutihan = (syorLawatanValue && syorLawatanValue.toString().toUpperCase() === 'PEMUTIHAN')
        || (data.kelulusan && data.kelulusan.toString().toUpperCase() === 'PEMUTIHAN');
      const tarikhLulusValue = data.tarikh_lulus !== undefined ? data.tarikh_lulus : existingData[24];
      const tarikhLulusExists = tarikhLulusValue && tarikhLulusValue.toString().trim() !== '';
      const hantarEmelSPIPemutihan = data.hantar_emel_spi_pemutihan === true;
      
      if (syorLawatanPemutihan && tarikhLulusExists && hantarEmelSPIPemutihan) {
        let alamatPerniagaanValue = data.alamat_perniagaan !== undefined ? data.alamat_perniagaan : existingData[20];
        const emailDataPemutihan = {
          row: rowNum,
          syarikat: data.syarikat !== undefined ? data.syarikat : existingData[0],
          cidb: data.cidb !== undefined ? data.cidb : existingData[1],
          gred: data.gred !== undefined ? data.gred : existingData[2],
          jenis: data.jenis !== undefined ? data.jenis : existingData[3],
          alamat_perniagaan: alamatPerniagaanValue || 'Tiada',
          pengesyor: data.pengesyor !== undefined ? data.pengesyor : existingData[12],
          pelulus: data.pelulus !== undefined ? data.pelulus : existingData[25],
          justifikasi: data.justifikasi_baru !== undefined ? formatJenisJustifikasi(jenisForJustifikasi, data.justifikasi_baru) : (data.justifikasi !== undefined ? formatJenisJustifikasi(jenisForJustifikasi, data.justifikasi) : existingData[11]),
          pautan: (data.pautan && data.pautan.toString().trim() !== "") ? data.pautan : existingData[10],
          date_submit: dateSubmitValue,
          syor_lawatan: syorLawatanValue
        };
        addToPemutihanQueue(emailDataPemutihan);
      }
      
      // === UPDATE KE DALAM QUEUE - Kolum P & Q (16 & 17) ===
      // Keahlian queue berasaskan keadaan rekod (state-based):
      // - SIASAT: syor=YA DAN date_submit diisi
      // - PEMUTIHAN: syor=PEMUTIHAN (atau keputusan=PEMUTIHAN) DAN tarikh_lulus diisi
      const stateSiasat = syorLawatanYA && dateSubmitExists;
      const statePemutihan = syorLawatanPemutihan && tarikhLulusExists;

      if (!stateSiasat) {
        removeFromQueue(existingData[0], 'SIASAT_QUEUE');
      }
      if (!statePemutihan) {
        removeFromQueue(existingData[0], 'PEMUTIHAN_QUEUE');
      }

      if (stateSiasat && hantarEmelSPI) {
        sheet.getRange(rowNum, 16, 1, 1).setValue("DALAM QUEUE");
      } else if (statePemutihan) {
        sheet.getRange(rowNum, 16, 1, 1).setValue("DALAM QUEUE");
      } else if (!stateSiasat && !statePemutihan) {
        sheet.getRange(rowNum, 16, 1, 2).clearContent();
      }

      // Diagnostik: log keadaan queue (semak di LOG sheet)
      try {
        logActivity('System', 'QUEUE_UPDATE', `Row ${rowNum} (${existingData[0] || ''}): syor='${syorLawatanValue}' date_submit='${dateSubmitValue}' tarikh_lulus='${tarikhLulusValue}' siasat=${stateSiasat}/${hantarEmelSPI} pemutihan=${statePemutihan}/${hantarEmelSPIPemutihan}`, '');
      } catch (e) {
        console.error('Gagal log QUEUE_UPDATE:', e.toString());
      }
      
      // V6.6.0: Auto-populate catatan untuk TOLAK & BEKU (elak duplicate)
      const kelulusanValue = data.kelulusan || existingData[23] || '';
      if ((kelulusanValue === 'TOLAK & BEKU 3 BULAN' || kelulusanValue === 'TOLAK & BEKU 6 BULAN') && keputusanBaru) {
        const bulanBeku = kelulusanValue === 'TOLAK & BEKU 3 BULAN' ? 3 : 6;
        const tarikhLulus = data.tarikh_lulus || existingData[24] || new Date().toISOString().split('T')[0];
        const mula = new Date(tarikhLulus);
        const tamat = new Date(mula);
        tamat.setMonth(tamat.getMonth() + bulanBeku);
        const mulaStr = Utilities.formatDate(mula, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
        const tamatStr = Utilities.formatDate(tamat, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
        const bekuNote = `TARIKH MULA BEKU: ${mulaStr} HINGGA TAMAT BEKU: ${tamatStr}`;
        
        let borangJson = data.borang_json || existingData[28] || '{}';
        const parsed = JSON.parse(borangJson);
        if (!parsed.catatan_pelulus || !parsed.catatan_pelulus.includes('TARIKH MULA BEKU')) {
          parsed.catatan_pelulus = parsed.catatan_pelulus 
            ? parsed.catatan_pelulus + '\n' + bekuNote 
            : bekuNote;
          sheet.getRange(rowNum, 29).setValue(JSON.stringify(parsed));
        }
      }

      // V6.6.0: Kes pengundoan syor/keputusan
      const existingSyor = existingData[13] ? existingData[13].toString().trim() : '';
      const existingKelulusan = existingData[23] ? existingData[23].toString().trim() : '';
      const newSyor = data.syor_status !== undefined ? data.syor_status.toString().trim() : undefined;
      const newKelulusan = data.kelulusan !== undefined ? data.kelulusan.toString().trim() : undefined;
      const isUndoSyor = newSyor === '' && existingSyor !== '';
      const isUndoLulus = newKelulusan === '' && existingKelulusan !== '' && (newSyor === undefined || newSyor === existingSyor);

      pascaActionType = isUndoSyor ? 'UNDO_RECOMMENDATION' : 'UPDATE_RECORD';
      const actionDesc = pascaActionType === 'UNDO_RECOMMENDATION' 
        ? `Undo syor di baris ${rowNum} untuk ${data.syarikat || existingData[0] || 'syarikat'}`
        : `Rekod dikemaskini di baris ${rowNum} untuk ${data.syarikat || existingData[0] || 'syarikat'}`;
      logActivity(userName, pascaActionType, actionDesc, '');

      invalidateDataCache();
    } catch (postError) {
      console.error(`[V6.6.0] Operasi pasca-tulisan gagal (data sheet sudah selamat): ${postError.toString()}`);
    }

    return createJSONOutput({ 
      status: "success", 
      action: "updated", 
      row: rowNum,
      message: pascaActionType === 'UNDO_RECOMMENDATION' ? "Syor berjaya dibatalkan" : "Rekod berjaya dikemaskini"
    });

  } catch (error) {
    logActivity("System", 'ERROR', `Ralat kemaskini rekod: ${error.toString()}`, '');
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

/**
 * FUNGSI TAMBAH REKOD BARU
 */
function handleInsertNewRecord(data, sheet, shouldCreateFolder) {
  try {
    const userName = data.pengesyor || data.pelulus || data.user || "System";
    
    const cache = CacheService.getScriptCache();
    let targetRow = cache.get("firstEmptyRow_" + SHEET_NAME);

    if (!targetRow) {
      const lastRow = sheet.getLastRow();
      targetRow = 2;
      if (lastRow > 1) {
        const columnA = sheet.getRange("A2:A" + lastRow).getValues();
        for (let i = 0; i < columnA.length; i++) {
          if (!columnA[i][0] || columnA[i][0].toString().trim() === "") {
            targetRow = i + 2;
            break;
          }
        }
        if (targetRow === 2) targetRow = lastRow + 1;
      }
    } else {
      targetRow = parseInt(targetRow);
    }

    let folderUrl = "";
    let folderId = "";
    if (shouldCreateFolder && data.syarikat && data.start_date && data.jenis && data.pengesyor) {
      
      // KOD BARU: Selitkan jenis perubahan jika ada
      let fullJenis = data.jenis;
      if (data.jenis === 'UBAH MAKLUMAT' && data.ubah_maklumat) fullJenis += ` (${data.ubah_maklumat})`;
      else if (data.jenis === 'UBAH GRED' && data.ubah_gred) fullJenis += ` (${data.ubah_gred})`;

      const folderResult = createUserFolderStructure(data.syarikat, data.start_date, fullJenis, data.pengesyor);
      if (folderResult.success) {
        folderUrl = folderResult.folderUrl;
        folderId = folderResult.folderId;
      }
    }
    
    // Susunan kolum: A-O (1-15) | P-Q (16-17) | R-X (18-24) | Y-AB (25-28) | AC (29) BORANG JSON | AD (30) WHATSAPP | AE (31) INBOX
    const newRow = [
      // A-O (Kolum 1-15)
      data.syarikat||"", data.cidb||"", data.gred||"", data.jenis||"", 
      data.negeri||"", data.tarikh_surat_terdahulu||"", data.tatatertib||"", 
      data.start_date||"", data.syor_lawatan||"", data.date_submit||"", 
      folderUrl || data.pautan||"", 
      formatJenisJustifikasi(data.jenis, data.justifikasi), data.pengesyor||"", 
      data.syor_status||"", data.tarikh_syor||"",
      // P-Q (Kolum 16-17): STATUS HANTAR SPI & TARIKH HANTAR SPI
      (data.hantar_emel_spi && data.syor_lawatan && data.syor_lawatan.toString().toUpperCase() === 'YA' && data.date_submit && data.date_submit.toString().trim() !== '') ? "DALAM QUEUE" : "",  // P (16) - Status Hantar SPI
      "",                                          // Q (17) - Tarikh Hantar SPI
      // R-X (Kolum 18-24)
      data.lawatan_tarikh||"",        
      data.lawatan_submit_sptb||"",   
      data.lawatan_syor||"",          
      data.alamat_perniagaan||"",     
      data.jenis_konsultansi||"",     
      data.alasan||"", 
      data.kelulusan||"",
      // Y-AB (Kolum 25-28)
      data.tarikh_lulus||"", 
      data.pelulus||"",
      data.ubah_maklumat||"",         
      data.ubah_gred||"",
      // AC (Kolum 29)
      data.borang_json||"",
      // AD (Kolum 30) - legasi (jadual WhatsApp dibuang; slot dikekalkan supaya lajur AE/AF tidak bergeser)
      ""
    ];

    const targetRange = sheet.getRange(targetRow, 1, 1, newRow.length);
    targetRange.setValues([newRow]);
    try { cache.put("firstEmptyRow_" + SHEET_NAME, (targetRow + 1).toString(), 300); } catch (e) {}

    logActivity(data.pengesyor || "System", 'INSERT_RECORD', `Rekod baharu dimasukkan di baris ${targetRow} untuk ${data.syarikat || 'syarikat'}`, folderId);

    const syorLawatanYA = data.syor_lawatan && data.syor_lawatan.toString().toUpperCase() === 'YA';
    const dateSubmitExists = data.date_submit && data.date_submit.toString().trim() !== '';
    const hantarEmelSPI = data.hantar_emel_spi === true;

    if (syorLawatanYA && dateSubmitExists && hantarEmelSPI) {
      const emailData = {
        row: targetRow,
        syarikat: data.syarikat || "",
        cidb: data.cidb || "",
        gred: data.gred || "",
        jenis: data.jenis || "", 
        alamat_perniagaan: data.alamat_perniagaan || "Tiada",
        pengesyor: data.pengesyor || "",
        pelulus: data.pelulus || "",
        justifikasi: formatJenisJustifikasi(data.jenis, data.justifikasi),
        pautan: folderUrl || data.pautan || "",
        date_submit: data.date_submit || "",
        syor_lawatan: data.syor_lawatan || ""
      };

      try {
        addToSiasatQueue(emailData);
        try { createSpiCalendarEvent(targetRow, emailData.syarikat, emailData.cidb, emailData.jenis, emailData.pengesyor, emailData.date_submit); } catch (e) { console.error(`[SPI Calendar] Gagal buat event row ${targetRow}: ${e.toString()}`); }
        console.log(`[V6.5.0] SPI SIASAT queued for daily 10AM on insert for row ${targetRow}: ${emailData.syarikat}`);
      } catch (queueError) {
        console.error(`[V6.5.0] Failed to queue SPI SIASAT on insert: ${queueError.toString()}`);
      }
    }
    
    invalidateDataCache();
    const response = { status: "success", action: "inserted", row: targetRow, message: "Data dimasukkan di baris " + targetRow };
    if (folderUrl) { response.pautan = folderUrl; response.folderId = folderId; }
    return createJSONOutput(response);

  } catch (error) {
    logActivity("System", 'ERROR', `Ralat tambah rekod: ${error.toString()}`, '');
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

function handleGetLogs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(LOGS_SHEET_NAME);
    if (!logSheet) {
      return createJSONOutput({ status: "success", logs: [] });
    }
    const lastRow = logSheet.getLastRow();
    if (lastRow < 2) {
      return createJSONOutput({ status: "success", logs: [] });
    }
    const dataRange = logSheet.getRange(2, 1, lastRow - 1, 6);
    const rows = dataRange.getDisplayValues();
    const logs = rows.map((r, i) => ({
      timestamp: r[0] || '',
      user: r[1] || '',
      action: r[2] || '',
      description: r[3] || '',
      folderId: r[4] || '',
      url: r[5] || ''
    }));
    // Balikkan tertib terbaru dulu
    logs.reverse();
    return createJSONOutput({ status: "success", logs: logs });
  } catch (error) {
    return createJSONOutput({ status: "error", message: error.toString(), logs: [] });
  }
}

/**
 * Fungsi untuk mengendalikan padam rekod
 * V6.5.2: Menambah perlindungan ketat dan pembersihan automatik dari barisan gilir (queue) SPI
 */
function handleDeleteRecord(data, sheet) {
  try {
    const userName = data.user || "System";
    const rowNum = parseInt(data.row);
    const deleteType = data.deleteType;
    const email = data.email || '';
    
    if (!rowNum || rowNum < 2) {
      return createJSONOutput({ status: "error", message: "Baris tidak sah" });
    }
    
    if (deleteType === 'padam_semua') {
      // V6.5.0: PERLINDUNGAN KETAT - Hanya ADMIN atau pengesyor asal yang boleh padam semua
      
      // Dapatkan data sedia ada pada baris tersebut
      const existingDataRange = sheet.getRange(rowNum, 1, 1, TOTAL_COLUMNS);
      const existingData = existingDataRange.getValues()[0];
      const existingPengesyor = existingData[12] ? existingData[12].toString().trim() : '';
      
      // KOD BARU: Ambil nama syarikat terlebih dahulu sebelum baris dipadam dari sheet
      const namaSyarikat = existingData[0] ? existingData[0].toString().trim() : '';
      
      // Semak jika emel pengguna disediakan
      if (!email) {
        return createJSONOutput({ 
          status: "error", 
          message: "Akses Ditolak: Pengesahan emel diperlukan untuk padam rekod." 
        });
      }
      
      const accessCheck = verifyUserAccess(email, [ROLE_ADMIN, ROLE_PENGESYOR]);
      
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ 
          status: "error", 
          message: "Akses Ditolak: Hanya ADMIN atau PENGESYOR yang boleh memadam rekod." 
        });
      }
      
      // Jika role PENGESYOR, semak sama ada dia adalah pengesyor asal
      if (accessCheck.userProfile.role === ROLE_PENGESYOR) {
        const userEmail = accessCheck.userProfile.email.toLowerCase();
        const pengesyorUser = findUserByEmail(userEmail);
        
        if (!pengesyorUser || pengesyorUser.name.toUpperCase() !== existingPengesyor.toUpperCase()) {
          return createJSONOutput({ 
            status: "error", 
            message: `Akses Ditolak: Anda (${pengesyorUser ? pengesyorUser.name : email}) bukan pengesyor asal (${existingPengesyor}) untuk rekod ini. Hanya pengesyor asal atau ADMIN boleh memadam rekod.` 
          });
        }
      }
      
      // KOD BARU: Simpan snapshot data sebelum padam
      const columnLabels = ['syarikat','cidb','gred','jenis','negeri','tarikh_surat_terdahulu','tatatertib','start_date','syor_lawatan','date_submit','pautan','justifikasi','pengesyor','syor_status','tarikh_syor','status_hantar_spi','tarikh_hantar_spi','lawatan_tarikh','lawatan_submit_sptb','lawatan_syor','alamat_perniagaan','jenis_konsultansi','alasan','kelulusan','tarikh_lulus','pelulus','ubah_maklumat','ubah_gred','borang_json','whatsapp_schedule','inbox','ulasan_spi'];
      const snapshot = {};
      for (let i = 0; i < existingData.length && i < columnLabels.length; i++) {
        snapshot[columnLabels[i]] = existingData[i] ? existingData[i].toString() : '';
      }
      snapshot.tindakan = 'DIPADAM';
      const snapshotJSON = JSON.stringify(snapshot, null, 2);

      // KOD BARU: Padam nama syarikat daripada barisan gilir (queue) SPI jika wujud sebelum row dipadam
      if (namaSyarikat) {
        removeFromQueue(namaSyarikat, 'SIASAT_QUEUE');
        removeFromQueue(namaSyarikat, 'PEMUTIHAN_QUEUE');
      }
      
      logActivity(userName, 'DELETE_SNAPSHOT', `Data penuh baris ${rowNum} (${namaSyarikat || 'tiada nama'}): ${snapshotJSON}`, '');
      sheet.deleteRow(rowNum);
      logActivity(userName, 'DELETE_RECORD', `Rekod dipadam sepenuhnya di baris ${rowNum}`, '');
      invalidateDataCache();
      return createJSONOutput({ status: "success", message: "Rekod berjaya dipadam sepenuhnya", action: "deleted_full" });
      
    } else if (deleteType === 'padam_syor') {
      // Dapatkan data sedia ada pada baris tersebut untuk ambil nama syarikat
      const existingDataRange = sheet.getRange(rowNum, 1, 1, TOTAL_COLUMNS);
      const existingData = existingDataRange.getValues()[0];
      const namaSyarikat = existingData[0] ? existingData[0].toString().trim() : '';

      // KOD BARU: Bersihkan status hantar SPI di kolum P & Q (16 & 17) serta keluarkan dari gilir memori
      sheet.getRange(rowNum, 16, 1, 2).clearContent();
      if (namaSyarikat) {
        removeFromQueue(namaSyarikat, 'SIASAT_QUEUE');
        removeFromQueue(namaSyarikat, 'PEMUTIHAN_QUEUE');
      }

      // Untuk padam syor, mana-mana pengguna yang dibenarkan boleh lakukan (Kolum 13-15)
      const rangeToClear = sheet.getRange(rowNum, 13, 1, 3);
      rangeToClear.clearContent();
      // V6.6.0: Turut kosongkan kolum Z (25) - nama pelulus
      sheet.getRange(rowNum, 25).clearContent();
      logActivity(userName, 'CLEAR_RECOMMENDATION', `Syor dikosongkan di baris ${rowNum}`, '');
      invalidateDataCache();
      return createJSONOutput({ status: "success", message: "Syor berjaya dikosongkan", action: "cleared_syor" });
      
    } else {
      return createJSONOutput({ status: "error", message: "Jenis padam tidak sah" });
    }
  } catch (error) {
    logActivity("System", 'ERROR', `Ralat padam rekod: ${error.toString()}`, '');
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

function handleRestoreRecord(data, sheet) {
  try {
    const snapshotJSON = data.snapshot;
    const userName = data.user || "System";
    
    if (!snapshotJSON) {
      return createJSONOutput({ status: "error", message: "Snapshot JSON diperlukan." });
    }
    
    let snapshot;
    try {
      snapshot = JSON.parse(snapshotJSON);
    } catch (e) {
      return createJSONOutput({ status: "error", message: "Snapshot JSON tidak sah." });
    }
    
    const namaSyarikat = snapshot.syarikat || 'Tiada nama';
    const lastRow = sheet.getLastRow();
    let targetRow = lastRow + 1;
    
    // Cari baris kosong pertama dari atas untuk letak semula data
    for (let r = 2; r <= lastRow + 1; r++) {
      const cellValue = sheet.getRange(r, 1).getValue();
      if (!cellValue || cellValue.toString().trim() === '') {
        targetRow = r;
        break;
      }
    }
    
    const columnLabels = ['syarikat','cidb','gred','jenis','negeri','tarikh_surat_terdahulu','tatatertib','start_date','syor_lawatan','date_submit','pautan','justifikasi','pengesyor','syor_status','tarikh_syor','status_hantar_spi','tarikh_hantar_spi','lawatan_tarikh','lawatan_submit_sptb','lawatan_syor','alamat_perniagaan','jenis_konsultansi','alasan','kelulusan','tarikh_lulus','pelulus','ubah_maklumat','ubah_gred','borang_json','whatsapp_schedule','inbox','ulasan_spi'];
    const newRow = [];
    for (let i = 0; i < columnLabels.length; i++) {
      const val = snapshot[columnLabels[i]];
      newRow.push(val !== undefined ? val : '');
    }
    
    sheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
    logActivity(userName, 'RESTORE_RECORD', `Rekod dipulihkan ke baris ${targetRow}: ${namaSyarikat}`, '');
    invalidateDataCache();
    return createJSONOutput({ status: "success", message: `Rekod ${namaSyarikat} berjaya dipulihkan ke baris ${targetRow}`, row: targetRow });
    
  } catch (error) {
    logActivity("System", 'ERROR', `Ralat restore rekod: ${error.toString()}`, '');
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

function getUsersData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) return createJSONOutput([]);
  const data = sheet.getDataRange().getDisplayValues();
  if (!data || data.length < 2) return createJSONOutput([]);
  
  const headers = data.shift();
  const nameColIndex = headers.findIndex(h => h && h.toString().toUpperCase().includes('NAMA'));
  const emailColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('EMEL') || h.toString().toUpperCase().includes('EMAIL') || h.toString().toUpperCase().includes('E-MEL')));
  const roleColIndex = headers.findIndex(h => h && h.toString().toUpperCase().includes('ROLE'));
  const colorColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('WARNA') || h.toString().toUpperCase().includes('COLOR')));
  const phoneColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('TELEFON') || h.toString().toUpperCase().includes('PHONE') || h.toString().toUpperCase().includes('NO TEL')));
  // V6.5.1: Cari indeks untuk Tandatangan dan Cop
  const signColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('TANDATANGAN') || h.toString().toUpperCase().includes('SIGN')));
  const copColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('COP') || h.toString().toUpperCase().includes('STAMP')));
  
  const finalNameIndex = nameColIndex !== -1 ? nameColIndex : 0;
  const finalEmailIndex = emailColIndex !== -1 ? emailColIndex : 1;
  const finalRoleIndex = roleColIndex !== -1 ? roleColIndex : 2;
  const finalColorIndex = colorColIndex !== -1 ? colorColIndex : 3;
  const finalPhoneIndex = phoneColIndex !== -1 ? phoneColIndex : 5;
  const finalImageIndex = 6;
  const finalSignIndex = signColIndex !== -1 ? signColIndex : -1;
  const finalCopIndex = copColIndex !== -1 ? copColIndex : -1;

  const users = data.map(row => {
    const safeGet = (index, defaultValue = '') => { return row && row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : defaultValue; };
    return { 
      name: safeGet(finalNameIndex), 
      email: safeGet(finalEmailIndex), 
      role: safeGet(finalRoleIndex).toUpperCase(), 
      color: safeGet(finalColorIndex), 
      phone: safeGet(finalPhoneIndex), 
      imageUrl: safeGet(finalImageIndex),
      // V6.5.1: Tambah atribut signUrl dan copUrl
      signUrl: finalSignIndex !== -1 ? safeGet(finalSignIndex) : '',
      copUrl: finalCopIndex !== -1 ? safeGet(finalCopIndex) : ''
    };
  }).filter(user => user.name !== "");
  return createJSONOutput(users);
}

/**
 * Fungsi untuk mendapatkan indeks lajur dari header Users sheet
 */
function getUsersColumnIndices(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const nameCol = headers.findIndex(h => h && h.toString().toUpperCase().includes('NAMA'));
  const emailCol = headers.findIndex(h => h && (h.toString().toUpperCase().includes('EMEL') || h.toString().toUpperCase().includes('EMAIL') || h.toString().toUpperCase().includes('E-MEL')));
  const roleCol = headers.findIndex(h => h && h.toString().toUpperCase().includes('ROLE'));
  const colorCol = headers.findIndex(h => h && (h.toString().toUpperCase().includes('WARNA') || h.toString().toUpperCase().includes('COLOR')));
  const phoneCol = headers.findIndex(h => h && (h.toString().toUpperCase().includes('TELEFON') || h.toString().toUpperCase().includes('PHONE') || h.toString().toUpperCase().includes('NO TEL')));
  const signCol = headers.findIndex(h => h && (h.toString().toUpperCase().includes('TANDATANGAN') || h.toString().toUpperCase().includes('SIGN')));
  const copCol = headers.findIndex(h => h && (h.toString().toUpperCase().includes('COP') || h.toString().toUpperCase().includes('STAMP')));
  return {
    name: nameCol !== -1 ? nameCol : 0,
    email: emailCol !== -1 ? emailCol : 1,
    role: roleCol !== -1 ? roleCol : 2,
    color: colorCol !== -1 ? colorCol : 3,
    phone: phoneCol !== -1 ? phoneCol : 5,
    image: 6,
    sign: signCol !== -1 ? signCol : -1,
    cop: copCol !== -1 ? copCol : -1,
    totalCols: Math.max(nameCol !== -1 ? nameCol : 0, emailCol !== -1 ? emailCol : 1, roleCol !== -1 ? roleCol : 2, colorCol !== -1 ? colorCol : 3, phoneCol !== -1 ? phoneCol : 5, 6, signCol !== -1 ? signCol : 0, copCol !== -1 ? copCol : 0) + 1
  };
}

/**
 * Fungsi untuk menambah pengguna baru ke Users sheet
 */
function handleAddUser(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) return createJSONOutput({ status: "error", message: "Sheet Users tidak dijumpai" });
    
    const idx = getUsersColumnIndices(sheet);
    const email = data.newUserEmail ? data.newUserEmail.toString().trim().toLowerCase() : '';
    if (!email) return createJSONOutput({ status: "error", message: "Email pengguna baru diperlukan" });
    
    // Semak jika email sudah wujud
    const existing = findUserByEmail(email);
    if (existing) return createJSONOutput({ status: "error", message: "Email sudah berdaftar: " + email });
    
    // Cari baris kosong pertama
    const lastRow = sheet.getLastRow();
    const newRow = lastRow + 1;
    
    // Sediakan array data dengan panjang mencukupi
    const rowData = [];
    const totalCols = Math.max(idx.totalCols, 9);
    for (let i = 0; i < totalCols; i++) rowData.push('');
    
    rowData[idx.name] = data.name || '';
    rowData[idx.email] = email;
    rowData[idx.role] = (data.role || 'PENGESYOR').toUpperCase();
    rowData[idx.color] = data.color || '#2563eb';
    rowData[idx.phone] = data.phone || '';
    rowData[idx.image] = data.imageUrl || '';
    if (idx.sign !== -1) rowData[idx.sign] = data.signUrl || '';
    if (idx.cop !== -1) rowData[idx.cop] = data.copUrl || '';
    
    sheet.getRange(newRow, 1, 1, totalCols).setValues([rowData]);
    
    // Jika PENGESYOR, simpan Firebase code
    if (rowData[idx.role] === 'PENGESYOR' && data.firebaseCode) {
      const propKey = 'FIREBASE_CODE_MAP_' + email;
      PropertiesService.getScriptProperties().setProperty(propKey, data.firebaseCode.toString().trim());
    }
    
    logActivity(data.adminName || "System", 'ADD_USER', `Tambah pengguna baru: ${data.name || ''} (${email}) - Role: ${rowData[idx.role]}`, '');
    invalidateDataCache();
    invalidateUserCache(email);
    return createJSONOutput({ status: "success", message: "Pengguna berjaya ditambah" });
    
  } catch (error) {
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

/**
 * Fungsi untuk mengemaskini pengguna dalam Users sheet
 */
function handleUpdateUser(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) return createJSONOutput({ status: "error", message: "Sheet Users tidak dijumpai" });
    
    const idx = getUsersColumnIndices(sheet);
    const email = data.targetEmail ? data.targetEmail.toString().trim().toLowerCase() : '';
    if (!email) return createJSONOutput({ status: "error", message: "Email pengguna diperlukan" });
    
    // Cari pengguna dalam sheet
    const dataRange = sheet.getDataRange().getDisplayValues();
    const headers = dataRange.shift();
    let targetRow = -1;
    for (let i = 0; i < dataRange.length; i++) {
      const rowEmail = dataRange[i][idx.email] ? dataRange[i][idx.email].toString().trim().toLowerCase() : '';
      if (rowEmail === email) {
        targetRow = i + 2; // +2 because we removed header (0-indexed) and sheet is 1-indexed
        break;
      }
    }
    
    if (targetRow === -1) return createJSONOutput({ status: "error", message: "Pengguna tidak dijumpai: " + email });
    
    const totalCols = Math.max(idx.totalCols, 9);
    const existingRow = sheet.getRange(targetRow, 1, 1, totalCols).getValues()[0];
    
    if (data.name !== undefined) existingRow[idx.name] = data.name;
    if (data.role !== undefined) existingRow[idx.role] = data.role.toUpperCase();
    if (data.color !== undefined) existingRow[idx.color] = data.color;
    if (data.phone !== undefined) existingRow[idx.phone] = data.phone;
    if (data.imageUrl !== undefined) existingRow[idx.image] = data.imageUrl;
    if (data.signUrl !== undefined && idx.sign !== -1) existingRow[idx.sign] = data.signUrl;
    if (data.copUrl !== undefined && idx.cop !== -1) existingRow[idx.cop] = data.copUrl;
    
    sheet.getRange(targetRow, 1, 1, totalCols).setValues([existingRow]);
    
    // Kemaskini Firebase code jika PENGESYOR
    const currentRole = data.role !== undefined ? data.role.toUpperCase() : existingRow[idx.role];
    const props = PropertiesService.getScriptProperties();
    const propKey = 'FIREBASE_CODE_MAP_' + email;
    
    if (currentRole === 'PENGESYOR') {
      if (data.firebaseCode !== undefined) {
        if (data.firebaseCode.toString().trim()) {
          props.setProperty(propKey, data.firebaseCode.toString().trim());
        } else {
          props.deleteProperty(propKey);
        }
      }
    } else {
      // Jika role ditukar bukan PENGESYOR, padam Firebase code
      props.deleteProperty(propKey);
    }
    
    logActivity(data.adminName || "System", 'UPDATE_USER', `Kemaskini pengguna: ${email}`, '');
    invalidateDataCache();
    invalidateUserCache(email);
    return createJSONOutput({ status: "success", message: "Pengguna berjaya dikemaskini" });
    
  } catch (error) {
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

/**
 * Fungsi untuk memadam pengguna dari Users sheet
 */
function handleDeleteUser(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) return createJSONOutput({ status: "error", message: "Sheet Users tidak dijumpai" });
    
    const idx = getUsersColumnIndices(sheet);
    const email = data.targetEmail ? data.targetEmail.toString().trim().toLowerCase() : '';
    if (!email) return createJSONOutput({ status: "error", message: "Email pengguna diperlukan" });
    
    // Cari pengguna dalam sheet
    const dataRange = sheet.getDataRange().getDisplayValues();
    const headers = dataRange.shift();
    let targetRow = -1;
    let userName = '';
    for (let i = 0; i < dataRange.length; i++) {
      const rowEmail = dataRange[i][idx.email] ? dataRange[i][idx.email].toString().trim().toLowerCase() : '';
      if (rowEmail === email) {
        targetRow = i + 2;
        userName = dataRange[i][idx.name] || '';
        break;
      }
    }
    
    if (targetRow === -1) return createJSONOutput({ status: "error", message: "Pengguna tidak dijumpai: " + email });
    
    // Padam row
    sheet.deleteRow(targetRow);
    
    // Padam Firebase code jika ada
    const props = PropertiesService.getScriptProperties();
    const propKey = 'FIREBASE_CODE_MAP_' + email;
    props.deleteProperty(propKey);
    
    logActivity(data.adminName || "System", 'DELETE_USER', `Padam pengguna: ${userName} (${email})`, '');
    invalidateDataCache();
    invalidateUserCache(email);
    return createJSONOutput({ status: "success", message: "Pengguna berjaya dipadam", deletedUser: { name: userName, email: email } });
    
  } catch (error) {
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

/**
 * Fungsi untuk bersihkan Firebase code yang orphans (tiada padanan pengguna)
 */
function handleCleanupFirebaseCodes(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) return createJSONOutput({ status: "error", message: "Sheet Users tidak dijumpai" });
    
    const idx = getUsersColumnIndices(sheet);
    const dataRange = sheet.getDataRange().getDisplayValues();
    const headers = dataRange.shift();
    
    // Kumpul semua email pengguna sedia ada
    const activeEmails = new Set();
    for (let i = 0; i < dataRange.length; i++) {
      const email = dataRange[i][idx.email] ? dataRange[i][idx.email].toString().trim().toLowerCase() : '';
      if (email) activeEmails.add(email);
    }
    
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const prefix = 'FIREBASE_CODE_MAP_';
    let cleaned = 0;
    
    for (const key of Object.keys(allProps)) {
      if (key.startsWith(prefix)) {
        const email = key.substring(prefix.length).toLowerCase();
        if (!activeEmails.has(email)) {
          props.deleteProperty(key);
          cleaned++;
          Logger.log(`[V6.8.0] Firease code orphan dipadam: ${key}`);
        }
      }
    }
    
    return createJSONOutput({ 
      status: "success", 
      message: `Bersihkan ${cleaned} Firebase code orphan.`,
      cleaned: cleaned
    });
    
  } catch (error) {
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

/**
 * Fungsi untuk arkib data tahunan: rename Sheet1 ke tahun, cipta Sheet1 baru
 */
function handleArchiveYearSheet(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return createJSONOutput({ status: "error", message: "Sheet1 tidak dijumpai" });
    
    const currentYear = new Date().getFullYear().toString();
    
    // Semak jika sheet tahun sudah wujud
    const existingYearSheet = ss.getSheetByName(currentYear);
    if (existingYearSheet) {
      return createJSONOutput({ status: "error", message: "Data tahun " + currentYear + " sudah diarkibkan" });
    }
    
    // Backup headers
    const lastColumn = sheet.getLastColumn();
    const headers = lastColumn > 0 ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] : [];
    
    // Semak jika ada data
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return createJSONOutput({ status: "error", message: "Tiada data untuk diarkibkan" });
    }
    
    // Rename Sheet1 ke tahun semasa
    sheet.setName(currentYear);
    
    // Cipta Sheet1 baru
    const newSheet = ss.insertSheet(SHEET_NAME);
    
    // Salin headers ke Sheet1 baru
    if (headers.length > 0) {
      newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // Gerakkan Sheet1 baru ke indeks pertama (paling kiri)
    ss.setActiveSheet(newSheet);
    ss.moveActiveSheet(0);
    
    logActivity(data.adminName || "System", 'ARCHIVE_YEAR', `Arkib data tahun ${currentYear}: ${lastRow - 1} rekod dipindahkan ke sheet "${currentYear}"`, '');
    invalidateDataCache();
    return createJSONOutput({ 
      status: "success", 
      message: `Data berjaya diarkibkan ke sheet "${currentYear}". Sheet1 baru telah disediakan.`,
      archivedYear: currentYear,
      totalRecords: lastRow - 1
    });
    
  } catch (error) {
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

// =========================================================================
// V6.10.0: WINDOW BULAN SEMASA (SERVER-SIDE)
// Only data N bulan terkini dimuat secara lalai; bulan lama atas permintaan.
// Kolum tarikh utama: start_date (H / indeks 7, format YYYY-MM-DD).
// =========================================================================

function formatYYYYMMDD(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Hari pertama bulan semasa tolak (months-1) bulan. Contoh: Aug 2026, months=3 -> 2026-06-01.
function getServerWindowStart(months) {
  const n = parseInt(months, 10);
  const count = (!isNaN(n) && n > 0) ? n : DEFAULT_MONTHS_WINDOW;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1);
  return formatYYYYMMDD(start);
}

// Validasi parameter from/to (format YYYY-MM). Pulangkan null jika tidak sah.
function parseMonthParam(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const parts = s.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return null;
  return { year: y, month: m, key: s };
}

function monthStartDate(monthKey) { return monthKey + '-01'; }

function monthEndDate(monthKey) {
  const parts = monthKey.split('-');
  const last = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
  return monthKey + '-' + String(last).padStart(2, '0');
}

// Filter window: start_date >= windowStart ATAU rekod belum selesai (tarikh_lulus kosong)
// tanpa mengira bulan - supaya kerja tergantung/bakul lama tidak hilang dari pandangan.
function filterRowsByWindow(rows, windowStart) {
  if (!windowStart) return rows;
  return rows.filter(r => {
    if (!r.tarikh_lulus || String(r.tarikh_lulus).trim() === '') return true;
    const sd = r.start_date ? String(r.start_date).trim() : '';
    return sd >= windowStart;
  });
}

// Filter julat bulan (mod sejarah): start_date dalam [from-01, to-last-day] sahaja.
// Perbandingan string lexicographic selamat kerana format tetap YYYY-MM-DD.
function filterRowsByMonthRange(rows, fromKey, toKey) {
  if (!fromKey || !toKey) return rows;
  const fromDate = monthStartDate(fromKey);
  const toDate = monthEndDate(toKey);
  return rows.filter(r => {
    const sd = r.start_date ? String(r.start_date).trim() : '';
    return sd >= fromDate && sd <= toDate;
  });
}

// Baca sheet penuh dan transform ke objek rekod (V6.10.0).
function readSheetRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return { rows: [], lastRow: 0 };
  const dataRange = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
  const data = dataRange.getDisplayValues();
  data.shift(); // buang header
  return { rows: transformSheetRows(data), lastRow: lastRow };
}

// Transform baris mentah (selepas header) ke objek rekod.
// Diekstrak daripada getApplicationsData - logik sama seperti V6.9.3.
function transformSheetRows(data) {
  const allRows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || row[0].toString().trim() === "") continue;

    let dueDateValue = "";
    let konsultansiStr = row[21] ? row[21].toString() : "";
    let dueMatch = konsultansiStr.match(/Due Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dueMatch && dueMatch[1]) {
      let dParts = dueMatch[1].split('/');
      if (dParts.length === 3) {
        dueDateValue = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
      }
    }

    allRows.push({
      row: i + 2,
      syarikat: row[0], cidb: row[1], gred: row[2], jenis: row[3], negeri: row[4],
      tarikh_surat_terdahulu: row[5], tatatertib: row[6], start_date: row[7],
      syor_lawatan: row[8], date_submit: row[9], pautan: row[10], justifikasi: row[11],
      pengesyor: row[12], syor_status: row[13], tarikh_syor: row[14],
      status_hantar_spi: row[15] || "", tarikh_hantar_spi: row[16] || "",
      lawatan_tarikh: row[17], lawatan_submit_sptb: row[18], lawatan_syor: row[19],
      alamat_perniagaan: row[20],
      jenis_konsultansi: konsultansiStr,
      due_date: dueDateValue,
      alasan: row[22], kelulusan: row[23],
      tarikh_lulus: row[24], pelulus: row[25], ubah_maklumat: row[26], ubah_gred: row[27],
      borang_json: row[28] || "",
      ulasan_spi: row[31] || ""
    });
  }
  return allRows;
}

// V6.10.0: Bina chunked cache ikut window - key: STB_APP_DATA_CHUNK_<version>_<windowStart>_<i>.
function buildChunkedAppDataCache(version, windowStart, allRows) {
  const cache = CacheService.getDocumentCache();
  const json = JSON.stringify(allRows);
  const compressed = Utilities.base64Encode(
    Utilities.compress(Utilities.newBlob(json, 'application/json'), Utilities.CompressionAlgorithm.GZIP)
  );
  
  const chunks = [];
  for (let i = 0; i < compressed.length; i += APP_DATA_CHUNK_LIMIT) {
    chunks.push(compressed.substring(i, i + APP_DATA_CHUNK_LIMIT));
  }
  if (chunks.length === 0) return;

  // Buang chunk versi/window lama (best effort; TTL 10 minit kekal sebagai jaring keselamatan).
  // Windows semasa TIDAK terhapus kerana cleanup ini hanya buang set yang berlainan
  // (versi ATAU windowStart tidak padan) daripada count key tersimpan.
  try {
    const oldCountJson = cache.get(APP_DATA_CHUNK_COUNT_KEY);
    if (oldCountJson) {
      const old = JSON.parse(oldCountJson);
      if (old.version && old.count &&
          (old.version !== version || old.windowStart !== windowStart)) {
        for (let j = 0; j < old.count; j++) {
          cache.remove(APP_DATA_CHUNK_PREFIX + old.version + '_' + (old.windowStart || '') + '_' + j);
        }
      }
    }
  } catch (e) {}

  // Tulis setiap chunk dengan try/catch sendiri - jika mana-mana gagal,
  // count key TIDAK ditulis supaya baca tidak guna data separa.
  let allPutsOk = true;
  for (let i = 0; i < chunks.length; i++) {
    try {
      cache.put(APP_DATA_CHUNK_PREFIX + version + '_' + windowStart + '_' + i, chunks[i], APP_DATA_CHUNK_TTL);
    } catch (e) {
      allPutsOk = false;
      Logger.log('[V6.10.0] Gagal tulis chunk ' + i + ': ' + e.toString());
      break;
    }
  }

  if (!allPutsOk) {
    Logger.log('[V6.10.0] Gagal menyimpan chunked cache - cache tidak lengkap');
    return;
  }

  try {
    cache.put(APP_DATA_CHUNK_COUNT_KEY, JSON.stringify({ version: version, windowStart: windowStart, count: chunks.length }), APP_DATA_CHUNK_TTL);
  } catch (e) {
    Logger.log('[V6.10.0] Gagal tulis count key: ' + e.toString());
    return;
  }
  Logger.log('[V6.10.0] Chunked cache dibina: ' + chunks.length + ' chunk untuk versi ' + version + ' window ' + windowStart);
}

// V6.10.0: Baca chunked cache ikut window; pulangkan null jika tiada/luput/versi/window lain.
function readChunkedAppDataCache(version, windowStart) {
  const cache = CacheService.getDocumentCache();
  const countJson = cache.get(APP_DATA_CHUNK_COUNT_KEY);
  if (!countJson) return null;
  
  let info;
  try { info = JSON.parse(countJson); } catch (e) { return null; }
  if (!info.version || info.version !== version || !info.count) return null;
  if (windowStart && info.windowStart !== windowStart) return null;

  let compressed = '';
  for (let i = 0; i < info.count; i++) {
    const part = cache.get(APP_DATA_CHUNK_PREFIX + version + '_' + info.windowStart + '_' + i);
    if (!part) return null;
    compressed += part;
  }

  try {
    const blob = Utilities.ungzip(Utilities.base64Decode(compressed));
    return JSON.parse(blob.getDataAsString('utf-8'));
  } catch (e) {
    Logger.log('[V6.10.0] Gagal nyahmampat chunked cache: ' + e.toString());
    return null;
  }
}

// V6.10.0: getApplicationsData dengan window bulan semasa (months, lalai 3).
// - from/to dihantar -> mod sejarah: filter start_date dalam julat bulan sahaja.
// - months=N (atau tiada) -> window server-side: start_date >= windowStart ATAU rekod
//   belum selesai (tarikh_lulus kosong). Filter bulan server-side SEBELUM role filter.
// - cache chunked ikut window (key: <version>_<windowStart>); data lama SKIP cache.
function getApplicationsData(role, userName, clientVersion, forceRefresh, clientWindowStart, months, from, to) {
  const props = PropertiesService.getScriptProperties();
  const currentVersion = props.getProperty(APP_DATA_VERSION_KEY) || '0';

  // ======================
  // V6.10.0: MOD SEJARAH (from/to) - tiada version check, tiada cache window.
  // ======================
  const fromKey = parseMonthParam(from);
  const toKey = parseMonthParam(to);
  if (fromKey && toKey) {
    const sheet = getMainSheet();
    if (!sheet) return createJSONOutput([]);
    const rangeRows = filterRowsByMonthRange(readSheetRows(sheet).rows, fromKey.key, toKey.key);
    const filtered = filterRowsByRole(rangeRows, role, userName);
    return createJSONOutput({
      mode: 'history', from: fromKey.key, to: toKey.key,
      data: filtered, version: currentVersion, engine: 'v610',
      windowStart: '', months: 0
    });
  }

  // ======================
  // V6.10.0: KIRA WINDOW SERVER-SIDE (bukan client)
  // ======================
  const windowCount = parseInt(months, 10);
  const windowMonths = (!isNaN(windowCount) && windowCount > 0) ? windowCount : DEFAULT_MONTHS_WINDOW;
  const windowStart = getServerWindowStart(windowMonths);

  // ======================
  // CHECK VERSION (CLIENT HASH + WINDOW)
  // V6.10.0: cached:true HANYA jika window client sama dengan window server.
  // Jika window dah berubah (bulan baharu masuk), terus hantar data baharu
  // walaupun versi sama.
  // ======================
  if (!forceRefresh && clientVersion && clientVersion === currentVersion &&
      (!clientWindowStart || clientWindowStart === windowStart)) {
    return createJSONOutput({ cached: true, version: currentVersion, windowStart: windowStart, months: windowMonths, engine: 'v610' });
  }

  // ======================
  // V6.10.0: CHUNKED CACHE HIT (key termasuk windowStart)
  // ======================
  if (!forceRefresh) {
    const cachedAllRows = readChunkedAppDataCache(currentVersion, windowStart);
    if (cachedAllRows && Array.isArray(cachedAllRows)) {
      const filtered = filterRowsByRole(cachedAllRows, role, userName);
      return createJSONOutput({ cached: false, data: filtered, version: currentVersion, windowStart: windowStart, months: windowMonths, engine: 'v610' });
    }
  }

  // ======================
  // READ FROM SHEET (FALLBACK ATAU REFRESH)
  // V6.11.0: Rebuild lock - elak stampede. Bila chunked cache tamat, hanya SATU
  // eksekusi baca sheet (pemilik rebuild); yang lain pulang rebuilding:true dan
  // frontend cuba semula selepas jeda. Lock DIABAIKAN untuk forceRefresh (refresh
  // paksa mesti baca sheet selalu) dan mod sejarah (sudah pulang awal di atas).
  // ======================
  const cache = CacheService.getScriptCache();

  if (!forceRefresh) {
    const rebuilding = cache.get(APP_DATA_REBUILD_KEY);
    if (rebuilding) {
      return createJSONOutput({ cached: true, version: currentVersion, windowStart: windowStart, months: windowMonths, rebuilding: true, engine: 'v610' });
    }
    try { cache.put(APP_DATA_REBUILD_KEY, String(Date.now()), APP_DATA_REBUILD_TTL); } catch (e) {}
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return createJSONOutput([]);
    
    const lastRow = sheet.getLastRow();
    let firstEmptyRow = 2;

    if (lastRow > 1) {
      const columnA = sheet.getRange("A2:A" + lastRow).getValues();
      for (let i = 0; i < columnA.length; i++) {
        if (!columnA[i][0] || columnA[i][0].toString().trim() === "") {
          firstEmptyRow = i + 2;
          break;
        }
      }
      if (firstEmptyRow === 2) firstEmptyRow = lastRow + 1;
    }
    
    try { cache.put("firstEmptyRow_" + SHEET_NAME, firstEmptyRow.toString(), 300); } catch (e) {}

    const allRows = readSheetRows(sheet).rows;

    // V6.10.0: Filter bulan server-side (window + rekod belum selesai) sebelum cache & role filter
    const windowRows = filterRowsByWindow(allRows, windowStart);

    // V6.10.0: Simpan chunked cache untuk window semasa sahaja
    try {
      buildChunkedAppDataCache(currentVersion, windowStart, windowRows);
    } catch (e) {
      Logger.log('[V6.10.0] Gagal bina chunked cache: ' + e.toString());
    }

    // Filter dan return
    const filtered = filterRowsByRole(windowRows, role, userName);
    return createJSONOutput({ cached: false, data: filtered, version: currentVersion, windowStart: windowStart, months: windowMonths, engine: 'v610' });
  } finally {
    // V6.11.0: Buang rebuild lock supaya eksekusi seterusnya boleh baca cache baru
    if (!forceRefresh) {
      try { cache.remove(APP_DATA_REBUILD_KEY); } catch (e) {}
    }
  }
}

function getSingleRowData(rowNum) {
  if (!rowNum || rowNum < 2) return createJSONOutput({ status: 'error', message: 'Row tidak sah' });
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const lastRow = sheet.getLastRow();
    if (rowNum > lastRow) return createJSONOutput({ status: 'error', message: 'Row melebihi had' });
    const dataRange = sheet.getRange(rowNum, 1, 1, TOTAL_COLUMNS);
    const row = dataRange.getDisplayValues()[0];
    if (!row[0] || row[0].toString().trim() === '') return createJSONOutput({ status: 'error', message: 'Row kosong' });
    return createJSONOutput({
      status: 'success',
      data: {
        row: rowNum,
        syarikat: row[0], cidb: row[1], gred: row[2], jenis: row[3], negeri: row[4],
        tarikh_surat_terdahulu: row[5], tatatertib: row[6], start_date: row[7],
        syor_lawatan: row[8], date_submit: row[9], pautan: row[10], justifikasi: row[11],
        pengesyor: row[12], syor_status: row[13], tarikh_syor: row[14],
        status_hantar_spi: row[15] || "", tarikh_hantar_spi: row[16] || "",
        lawatan_tarikh: row[17], lawatan_submit_sptb: row[18], lawatan_syor: row[19],
        alamat_perniagaan: row[20], jenis_konsultansi: row[21] || "", alasan: row[22],
        kelulusan: row[23], tarikh_lulus: row[24], pelulus: row[25],
        ubah_maklumat: row[26], ubah_gred: row[27], borang_json: row[28] || "",
        ulasan_spi: row[31] || ""
      }
    });
  } catch (e) {
    return createJSONOutput({ status: 'error', message: e.toString() });
  }
}

function filterRowsByRole(rows, role, userName) {
  if (role === ROLE_PENGESYOR && userName) {
    return rows.filter(r => r.pengesyor && r.pengesyor.toUpperCase() === userName.toUpperCase());
  } else if (role === ROLE_PELULUS && userName) {
    // V6.10.2: Tanpa syarat syor_status - selaras dengan kiraan getDashboardStats
    // (rekod pelulus==user dikira dalam kad, jadi mesti dikira dalam jadual juga).
    return rows.filter(r => r.pelulus && r.pelulus.toString().toUpperCase() === userName.toUpperCase());
  } else if (role === ROLE_PKA) {
    return rows.filter(r => !r.syor_lawatan || r.syor_lawatan.toString().toUpperCase() !== 'PEMUTIHAN');
  }
  return rows;
}

// =========================================================================
// V6.10.0: GETDASHBOARDSTATS - Agregat kecil untuk dashboard
// Baca sheet penuh, kira kiraan per bulan (start_date = bulan permohonan)
// untuk 12 bulan terkini. Output <50KB walaupun 20k rekod.
// Cache: ScriptCache (bawah 100KB) - bukan DocumentCache/Chunked.
// Status: tiada tarikh_lulus = menunggu; tarikh_lulus + kelulusan LULUS = lulus;
//         tarikh_lulus + TOLAK/SIASAT = tolak; tarikh_lulus tanpa kelulusan = menunggu.
// =========================================================================
function getDashboardStats(role, userName) {
  try {
    const props = PropertiesService.getScriptProperties();
    const currentVersion = props.getProperty(APP_DATA_VERSION_KEY) || '0';
    const roleNorm = normalizeRoleKey(role || '');
    const userKey = (roleNorm === 'PENGESYOR' || roleNorm === 'PELULUS') ? String(userName || '').toUpperCase().trim() : '';
    const cache = CacheService.getScriptCache();
    const cacheKey = 'STB_DASH_STATS_' + currentVersion + '_' + roleNorm + '_' + userKey;
    const cached = cache.get(cacheKey);
    if (cached) {
      try { return createJSONOutput(JSON.parse(cached)); } catch (e) {}
    }

    const sheet = getMainSheet();
    if (!sheet) return createJSONOutput({ error: "Sheet not found" });
    const lastRow = sheet.getLastRow();
    const empty = { months: [], years: [], grand: { total: 0, lulus: 0, tolak: 0, menunggu: 0, sokong: 0, tidakSokong: 0, pkaSpi: 0, pkaSelesai: 0 }, pengesyorStats: {}, pelulusStats: {} };
    if (lastRow < 2) return createJSONOutput(empty);

    const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS).getDisplayValues();

    // Indeks kolum (A=0): jenis 3, start_date 7, syor_lawatan 8, date_submit 9,
    // pengesyor 12, syor_status 13, alasan 22, kelulusan 23, tarikh_lulus 24, pelulus 25.
    // V6.10.1: Semua bulan yang ada data (bukan had 12) - supaya filter tahunan/bulanan
    // lengkap untuk mana-mana tahun. Output kekal kecil (<50KB walaupun 20k rekod).
    const monthMap = {};
    function ensureMonth(key) {
      if (!monthMap[key]) {
        const p = key.split('-');
        const d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1);
        monthMap[key] = {
          month: key,
          label: d.toLocaleString('ms-MY', { month: 'short' }),
          total: 0, lulus: 0, tolak: 0, menunggu: 0,
          sokong: 0, tidakSokong: 0,
          jenis: {}, alasan: {},
          pkaSpi: 0, pkaSelesai: 0
        };
      }
      return monthMap[key];
    }

    const years = new Set();
    const grand = { total: 0, lulus: 0, tolak: 0, menunggu: 0, sokong: 0, tidakSokong: 0, pkaSpi: 0, pkaSelesai: 0 };
    const pengesyorStats = {};
    const pelulusStats = {};

    const isPengesyor = roleNorm === 'PENGESYOR';
    const isPelulus = roleNorm === 'PELULUS';
    const isPKA = roleNorm === 'PKA';
    const isAdminView = !isPengesyor && !isPelulus && !isPKA;
    const userUpper = String(userName || '').toUpperCase().trim();

    const JENIS_KEYS = ['BARU', 'PEMBAHARUAN', 'UBAH MAKLUMAT', 'UBAH GRED'];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || row[0].toString().trim() === "") continue;

      // Filter role (semantik selaras filterRowsByRole / roleFilter dashboard)
      if (isPengesyor) {
        if (!row[12] || row[12].toString().toUpperCase().trim() !== userUpper) continue;
      } else if (isPelulus) {
        if (!row[25] || row[25].toString().toUpperCase().trim() !== userUpper) continue;
      } else if (isPKA) {
        if (row[8] && row[8].toString().toUpperCase().trim() === 'PEMUTIHAN') continue;
      }

      const startDate = row[7] ? String(row[7]).trim() : '';
      const monthKey = /^\d{4}-\d{2}/.test(startDate) ? startDate.substring(0, 7) : '';
      const kelulusan = row[23] ? String(row[23]) : '';
      const tarikhLulus = row[24] ? String(row[24]).trim() : '';
      const syorStatus = row[13] ? String(row[13]) : '';

      // Status permohonan
      let status = 'menunggu';
      if (tarikhLulus !== '') {
        if (kelulusan.indexOf('LULUS') !== -1) status = 'lulus';
        else if (kelulusan.indexOf('TOLAK') !== -1 || kelulusan.indexOf('SIASAT') !== -1) status = 'tolak';
      }

      const isSupported = syorStatus.indexOf('SOKONG') !== -1 && syorStatus.indexOf('TIDAK') === -1;
      const isNotSupported = syorStatus.indexOf('TIDAK DISOKONG') !== -1;

      grand.total++;
      if (status === 'lulus') grand.lulus++;
      else if (status === 'tolak') grand.tolak++;
      else grand.menunggu++;
      if (isSupported) grand.sokong++;
      if (isNotSupported) grand.tidakSokong++;

      // Metrik PKA (diSPI / selesaiLawatan)
      const syorLawatan = row[8] ? String(row[8]).toUpperCase().trim() : '';
      const hasSyorStatus = syorStatus.trim() !== '';
      const lawatanSyor = row[19] ? String(row[19]).trim() : '';
      const isDiSPI = syorLawatan === 'YA' && row[9] && String(row[9]).trim() !== '' && !hasSyorStatus && lawatanSyor === '';
      if (isDiSPI) grand.pkaSpi++;
      if (lawatanSyor !== '') grand.pkaSelesai++;

      if (startDate) {
        const yearNum = monthKey ? parseInt(monthKey.substring(0, 4), 10) : NaN;
        if (!isNaN(yearNum)) years.add(yearNum);
      }

      if (monthKey) {
        const m = ensureMonth(monthKey);
        m.total++;
        if (status === 'lulus') m.lulus++;
        else if (status === 'tolak') m.tolak++;
        else m.menunggu++;
        if (isSupported) m.sokong++;
        if (isNotSupported) m.tidakSokong++;
        const jenis = row[3] ? String(row[3]).toUpperCase().trim() : '';
        const jenisKey = JENIS_KEYS.indexOf(jenis) !== -1 ? jenis : 'LAIN';
        m.jenis[jenisKey] = (m.jenis[jenisKey] || 0) + 1;
        if (status === 'tolak' && row[22]) {
          const alasan = String(row[22]).trim().substring(0, 80);
          if (alasan) m.alasan[alasan] = (m.alasan[alasan] || 0) + 1;
        }
        if (isDiSPI) m.pkaSpi++;
        if (lawatanSyor !== '') m.pkaSelesai++;
      }

      // Statistik per pengguna (jadual admin)
      if (isAdminView) {
        const pengesyor = row[12] ? String(row[12]).trim() : 'Tiada Pengesyor';
        if (!pengesyorStats[pengesyor]) pengesyorStats[pengesyor] = { total: 0, sokong: 0, tidak_sokong: 0 };
        pengesyorStats[pengesyor].total++;
        if (isSupported) pengesyorStats[pengesyor].sokong++;
        if (isNotSupported) pengesyorStats[pengesyor].tidak_sokong++;

        const pelulus = row[25] ? String(row[25]).trim() : 'Tiada Pelulus';
        if (!pelulusStats[pelulus]) pelulusStats[pelulus] = { total: 0, lulus: 0, tolak: 0 };
        pelulusStats[pelulus].total++;
        if (kelulusan.indexOf('LULUS') !== -1) pelulusStats[pelulus].lulus++;
        else if (kelulusan.indexOf('TOLAK') !== -1 || kelulusan.indexOf('SIASAT') !== -1) pelulusStats[pelulus].tolak++;
      }
    }

    // V6.10.1: Susun semua bulan menurun (bulan terkini dahulu)
    const months = Object.keys(monthMap).sort(function (a, b) { return b.localeCompare(a); })
      .map(function (k) { return monthMap[k]; });

    const payload = {
      months: months,
      years: Array.from(years).sort(function (a, b) { return b - a; }),
      grand: grand,
      pengesyorStats: pengesyorStats,
      pelulusStats: pelulusStats
    };
    // V6.11.0: TTL 3600 saat (1 jam) - stats jarang berubah, key guna versi data
    // jadi auto-invalid bila data dikemas kini. Kurangkan kekerapan baca sheet penuh.
    try { cache.put(cacheKey, JSON.stringify(payload), 3600); } catch (e) {}
    return createJSONOutput(payload);
  } catch (e) {
    return createJSONOutput({ error: e.toString() });
  }
}

// =========================================================================
// V6.8.0: PKA HANDLERS
// =========================================================================

/**
 * Fungsi handlePKAUpdateLawatan: PKA mengemaskini lawatan dan syor SPI
 * Hanya update kolum R(18), S(19), T(20), AF(32) + borang_json jika ada laporan
 */
function handlePKAUpdateLawatan(data, sheet) {
  try {
    const rowNum = parseInt(data.row);
    if (rowNum < 2) return createJSONOutput({ status: "error", message: "Nombor baris tidak sah" });

    // BLOK 3: Update lawatan_tarikh (R/18), lawatan_submit_sptb (S/19), lawatan_syor (T/20)
    if (data.lawatan_tarikh !== undefined || data.lawatan_submit_sptb !== undefined ||
        data.lawatan_syor !== undefined) {
      const currentLawatan = sheet.getRange(rowNum, 18, 1, 3).getValues()[0];
      const updatedLawatan = [
        data.lawatan_tarikh !== undefined ? data.lawatan_tarikh : currentLawatan[0],
        data.lawatan_submit_sptb !== undefined ? data.lawatan_submit_sptb : currentLawatan[1],
        data.lawatan_syor !== undefined ? data.lawatan_syor : currentLawatan[2]
      ];
      sheet.getRange(rowNum, 18, 1, 3).setValues([updatedLawatan]);
    }

    // BLOK 8: Update ulasan_spi (AF/32)
    if (data.ulasan_spi !== undefined) {
      sheet.getRange(rowNum, 32).setValue(data.ulasan_spi);
    }

    // BLOK 5: Update borang_json jika ada laporan_spi_url
    if (data.laporan_spi_url !== undefined) {
      const existingJSON = sheet.getRange(rowNum, 29).getValue() || '{}';
      let parsed = {};
      try { parsed = JSON.parse(existingJSON); } catch (e) { parsed = {}; }
      parsed.laporan_spi_url = data.laporan_spi_url;
      sheet.getRange(rowNum, 29).setValue(JSON.stringify(parsed));
    }

    logActivity(data.email || 'PKA', 'PKA_UPDATE_LAWATAN', `Lawatan diupdate oleh PKA untuk baris ${rowNum}`, '');
    if (data.lawatan_syor && data.lawatan_syor.toString().trim() !== '') {
      try { updateSpiCalendarEvent(rowNum, data.lawatan_syor); } catch (e) { console.error(`[SPI Calendar] Gagal update PKA: ${e.toString()}`); }
    }
    invalidateDataCache();
    return createJSONOutput({ status: "success", message: "Lawatan berjaya dikemaskini" });
  } catch (error) {
    logActivity('System', 'ERROR_PKA_UPDATE', `Ralat: ${error.toString()}`, '');
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

/**
 * Fungsi handlePKAGetPengesyorContact: Dapatkan no telefon pengesyor dari Users sheet
 */
function handlePKAGetPengesyorContact(data) {
  try {
    const pengesyorName = data.pengesyor || '';
    if (!pengesyorName) {
      return createJSONOutput({ success: false, error: "Nama pengesyor tidak disediakan" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) return createJSONOutput({ success: false, error: "Users sheet tidak dijumpai" });

    const usersData = sheet.getDataRange().getDisplayValues();
    if (!usersData || usersData.length < 2) return createJSONOutput({ success: false, error: "Tiada data pengguna" });

    const headers = usersData.shift();
    let nameCol = headers.findIndex(h => h && (h.toString().toUpperCase().trim().includes('NAMA') || h.toString().toUpperCase().trim().includes('NAME') || h.toString().toUpperCase().trim().includes('PENGGUNA')));
    const phoneCol = headers.findIndex(h => h && (h.toString().toUpperCase().includes('TELEFON') || h.toString().toUpperCase().includes('PHONE') || h.toString().toUpperCase().includes('NO TEL') || h.toString().toUpperCase().includes('HP') || h.toString().toUpperCase().includes('MOBILE') || h.toString().toUpperCase().includes('HANDPHONE')));

    if (nameCol === -1 && headers.length > 0) {
      nameCol = 0; // fallback guna column pertama
    } else if (nameCol === -1) {
      return createJSONOutput({ success: false, error: "Lajur nama tidak dijumpai dalam Users sheet" });
    }

    function normalizeName(n) {
      return n.toString().toUpperCase().replace(/\s+/g, ' ').trim();
    }
    function stripTitle(n) {
      return n.replace(/\b(ENCIK|CIK|PUAN|TUAN|DATIN|DATO|DATUK|HAJI|HAJJAH|HAJJAH|IR|DR|PROF|MD|BIN|BINTI)\b/g, '').replace(/\s+/g, ' ').trim();
    }
    const rawName = pengesyorName.toString().toUpperCase().replace(/\s+/g, ' ').trim();
    const searchName = stripTitle(rawName);
    const searchNames = [...new Set([rawName, searchName])];
    let matched = false;
    for (let i = 0; i < usersData.length; i++) {
      const rawUserName = normalizeName(usersData[i][nameCol] || '');
      const userName = stripTitle(rawUserName);
      const userNames = [...new Set([rawUserName, userName])];
      const match = searchNames.some(s => userNames.some(u => u === s));
      if (match) {
        matched = true;
        let phone = phoneCol !== -1 ? (usersData[i][phoneCol] || '') : '';
        phone = phone.replace(/[\s\-\(\)]/g, '');
        if (!phone) continue;
        let cleanPhone = phone;
        if (cleanPhone.startsWith('0')) cleanPhone = '60' + cleanPhone.substring(1);
        else if (!cleanPhone.startsWith('60')) cleanPhone = '60' + cleanPhone;
        return createJSONOutput({ success: true, phone: phone, waLink: `https://wa.me/${cleanPhone}` });
      }
    }

    // Fallback: partial name match
    for (let i = 0; i < usersData.length; i++) {
      const rawUserName = normalizeName(usersData[i][nameCol] || '');
      const userName = stripTitle(rawUserName);
      if (!userName) continue;
      const matchPartial = searchNames.some(s => s && (userName.includes(s) || s.includes(userName)));
      if (matchPartial) {
        let phone = phoneCol !== -1 ? (usersData[i][phoneCol] || '') : '';
        phone = phone.replace(/[\s\-\(\)]/g, '');
        if (!phone) continue;
        let cleanPhone = phone;
        if (cleanPhone.startsWith('0')) cleanPhone = '60' + cleanPhone.substring(1);
        else if (!cleanPhone.startsWith('60')) cleanPhone = '60' + cleanPhone;
        return createJSONOutput({ success: true, phone: phone, waLink: `https://wa.me/${cleanPhone}` });
      }
    }

    const allNames = usersData.map(r => (r[nameCol] || '').toString().trim()).filter(Boolean).join(', ');
    return createJSONOutput({ success: false, error: "Pengesyor '" + pengesyorName + "' tidak dijumpai. Nama dalam Users: " + allNames.substring(0, 200) });
  } catch (error) {
    return createJSONOutput({ success: false, error: error.toString() });
  }
}

function handleSiasatSahkan(data, sheet) {
  try {
    const rowNum = parseInt(data.row);
    if (rowNum < 2) return createJSONOutput({ status: "error", message: "Row tidak sah" });
    const justifikasiBaru = data.justifikasi_baru || '';
    const dateSubmit = data.date_submit || Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "yyyy-MM-dd");
    // Update justifikasi L(12) dan date_submit J(10)
    sheet.getRange(rowNum, 12).setValue(justifikasiBaru); // L justifikasi
    sheet.getRange(rowNum, 10).setValue(dateSubmit); // J date_submit
    // Update borang_json AC(29)
    if (data.borang_json) {
      sheet.getRange(rowNum, 29).setValue(data.borang_json);
    }
    // Set status_hantar_spi P(16) = DALAM QUEUE
    sheet.getRange(rowNum, 16).setValue("DALAM QUEUE");
    sheet.getRange(rowNum, 17).setValue(""); // Q tarikh_hantar_spi kosong selagi queue
    // Queue ke SIASAT
    const emailData = {
      row: rowNum,
      syarikat: data.syarikat || '',
      cidb: data.cidb || '',
      gred: data.gred || '',
      jenis: data.jenis || '',
      alamat_perniagaan: sheet.getRange(rowNum, 21).getValue() || '',
      pengesyor: data.pengesyor || sheet.getRange(rowNum, 13).getValue() || '',
      pelulus: data.pelulus || sheet.getRange(rowNum, 26).getValue() || '',
      justifikasi: justifikasiBaru,
      pautan: sheet.getRange(rowNum, 11).getValue() || '',
      date_submit: dateSubmit,
      syor_lawatan: "YA"
    };
    try { addToSiasatQueue(emailData); } catch (e) { console.error("addToSiasatQueue gagal: " + e.toString()); }
    try { createSpiCalendarEvent(rowNum, data.syarikat || '', data.cidb || '', data.jenis || '', data.pengesyor || '', dateSubmit); } catch (e) { console.error("createSpiCalendarEvent gagal: " + e.toString()); }
    invalidateDataCache();
    logActivity(data.email || data.pelulus || 'Pelulus', 'SIASAT_SAHKAN', `Siasat disahkan ke SPI (row ${rowNum}) - ${data.syarikat}`, '');
    return createJSONOutput({ status: "success", success: true, message: "Siasat berjaya disahkan ke SPI (6 Petang)" });
  } catch (error) {
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

function handleSiasatTolak(data, sheet) {
  try {
    const rowNum = parseInt(data.row);
    if (rowNum < 2) return createJSONOutput({ status: "error", message: "Row tidak sah" });
    const alasanTolak = data.alasan_tolak || '';
    const justifikasiBaru = data.justifikasi_baru || '';
    // Update justifikasi L(12) jika ada edit
    if (justifikasiBaru) sheet.getRange(rowNum, 12).setValue(justifikasiBaru);
    // Update borang_json AC(29) dengan workflow DITOLAK
    if (data.borang_json) {
      sheet.getRange(rowNum, 29).setValue(data.borang_json);
    }
    // Kekalkan pelulus untuk audit (col Z/26 jangan clear), tapi clear queue/status
    sheet.getRange(rowNum, 16).setValue(""); // P kosong
    sheet.getRange(rowNum, 17).setValue("");
    // Buang dari SIASAT_QUEUE jika ada
    try { removeFromQueue(data.syarikat || sheet.getRange(rowNum, 1).getValue(), 'SIASAT_QUEUE'); } catch (e) {}
    invalidateDataCache();
    // Cari telefon pengesyor untuk WA
    let pengesyorPhone = "";
    let waUrl = "";
    try {
      const res = handlePKAGetPengesyorContact({ pengesyor: data.pengesyor || sheet.getRange(rowNum, 13).getValue() });
      const payload = JSON.parse(res.getContent());
      if (payload.success && payload.waLink) { waUrl = payload.waLink; pengesyorPhone = payload.phone || ""; }
    } catch (e) {}
    logActivity(data.email || data.pelulus || 'Pelulus', 'SIASAT_TOLAK', `Siasat ditolak ke pengesyor (row ${rowNum}) - ${data.syarikat}: ${alasanTolak}`, '');
    return createJSONOutput({ status: "success", success: true, message: "Siasat ditolak ke pengesyor", pengesyorPhone: pengesyorPhone, waUrl: waUrl });
  } catch (error) {
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

function handleSiasatUndo(data, sheet) {
  try {
    const rowNum = parseInt(data.row);
    if (rowNum < 2) return createJSONOutput({ status: "error", message: "Row tidak sah" });
    const syarikat = data.syarikat || sheet.getRange(rowNum, 1).getValue() || '';

    // Tolak undo jika emel ke SPI sudah dihantar
    const statusSpi = (sheet.getRange(rowNum, 16).getValue() || '').toString().trim().toUpperCase();
    if (statusSpi === 'TELAH DIHANTAR') {
      return createJSONOutput({ status: "error", message: "Emel ke SPI telah dihantar. Undo tidak dibenarkan." });
    }

    // Baca JSON sedia ada dari sheet untuk kekalkan medan server (cth: spi_calendar_event_id)
    let existing = {};
    try { existing = JSON.parse(sheet.getRange(rowNum, 29).getValue() || '{}'); } catch (e) { existing = {}; }

    // Padam event kalendar SPI jika ada
    const eventId = existing.spi_calendar_event_id;
    if (eventId) {
      try {
        const cal = CalendarApp.getCalendarById(SPI_CALENDAR_ID);
        const ev = cal ? cal.getEventById(eventId) : null;
        if (ev) ev.deleteEvent();
        console.log(`[SPI Calendar] Event dipadam kerana undo row ${rowNum}`);
      } catch (e) { console.error('Gagal padam event SPI: ' + e.toString()); }
    }
    existing.spi_calendar_event_id = '';

    // Guna workflow terbaru dari frontend (stage kembali MENUNGGU_PELULUS)
    let wfBaru = {};
    try { wfBaru = JSON.parse(data.borang_json || '{}'); } catch (e) { wfBaru = {}; }
    if (wfBaru && wfBaru.siasat_workflow) existing.siasat_workflow = wfBaru.siasat_workflow;
    // WHATSAPP KE PELULUS SEKALI SAHAJA: undo -> reset supaya jadi macam tak hantar lagi
    if (wfBaru && wfBaru.whatsapp_pelulus) {
      existing.whatsapp_pelulus = wfBaru.whatsapp_pelulus;
    } else if (existing.whatsapp_pelulus && existing.whatsapp_pelulus.sent === true) {
      existing.whatsapp_pelulus.sent = false;
    }
    sheet.getRange(rowNum, 29).setValue(JSON.stringify(existing));

    // Buang dari queue SIASAT + kosongkan status/tarikh supaya keluar dari cron 6 petang
    try { removeFromQueue(syarikat, 'SIASAT_QUEUE'); } catch (e) {}
    sheet.getRange(rowNum, 16).setValue(''); // P status_hantar_spi
    sheet.getRange(rowNum, 17).setValue(''); // Q tarikh_hantar_spi
    sheet.getRange(rowNum, 10).setValue(''); // J date_submit – keluar dari queue

    invalidateDataCache();
    logActivity(data.email || data.pelulus || 'Pelulus', 'SIASAT_UNDO', `Undo pengesahan siasat (row ${rowNum}) - ${syarikat}`, '');
    return createJSONOutput({ status: "success", success: true, message: "Undo berjaya. Permohonan dikeluarkan dari queue email SPI." });
  } catch (error) {
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

// === HELPER FUNCTIONS ===
function formatJenisJustifikasi(jenis, justifikasi) {
  const j = (justifikasi || '').trim();
  const t = (jenis || '').trim();
  if (!j) return j;
  if (!t) return j;
  if (j.startsWith(t + ' - ')) return j;
  return t + ' - ' + j;
}

function extractFolderIdFromUrl(url) {
  if (!url) return null;
  var match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function findFolderInParent(parentFolder, folderName) {
  try {
    const folders = parentFolder.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      if (folder.getName() === folderName) return folder;
    }
    return null;
  } catch (error) { return null; }
}

function formatDateForFolder(dateString) {
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) { return new Date().toISOString().split('T')[0].replace(/-/g, '-'); }
}

function logActivity(user, action, description, folderId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName(LOGS_SHEET_NAME);
    if (!logSheet) {
      logSheet = ss.insertSheet(LOGS_SHEET_NAME);
      const headers = [['Timestamp', 'User', 'Action', 'Description', 'Folder ID', 'URL']];
      logSheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
      logSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const timestamp = new Date();
    const url = folderId ? `https://drive.google.com/drive/folders/${folderId}` : '';
    const newRow = [timestamp, user, action, description, folderId || '', url];
    logSheet.appendRow(newRow);
    const lastRow = logSheet.getLastRow();
    if (lastRow > 1001) logSheet.deleteRows(2, lastRow - 1001);
  } catch (error) { console.error('Error logging activity:', error); }
}

function createJSONOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// V6.9.0: Helper lazy-load sheet utama. Hanya dipanggil oleh action yang
// benar-benar memerlukan sheet, elak bukaan spreadsheet yang tidak perlu
// (mempercepatkan checkAuth dll).
function getMainSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;
  return ss.getSheetByName(SHEET_NAME);
}

function invalidateDataCache() {
  const cache = CacheService.getScriptCache();
  cache.remove(APP_DATA_CACHE_KEY);
  // V6.10.0: Buang chunked cache versi/window lama (best effort)
  try {
    const docCache = CacheService.getDocumentCache();
    const countJson = docCache.get(APP_DATA_CHUNK_COUNT_KEY);
    if (countJson) {
      const old = JSON.parse(countJson);
      if (old.version && old.count) {
        for (let j = 0; j < old.count; j++) {
          docCache.remove(APP_DATA_CHUNK_PREFIX + old.version + '_' + (old.windowStart || '') + '_' + j);
        }
      }
      docCache.remove(APP_DATA_CHUNK_COUNT_KEY);
    }
  } catch (e) {}
  const props = PropertiesService.getScriptProperties();
  const ver = (parseInt(props.getProperty(APP_DATA_VERSION_KEY) || '0') + 1).toString();
  props.setProperty(APP_DATA_VERSION_KEY, ver);
}

function handleCreateDriveFolderAction(data) {
  try {
    const companyName = data.company_name;
    const userName = data.user_name;
    const mainFolderId = data.main_folder_id || getMainFolderId();
    const appType = data.application_type || data.subfolder_name;

    let mainFolder;
    try { mainFolder = DriveApp.getFolderById(mainFolderId); } 
    catch (e) {
      const folders = DriveApp.getFoldersByName(MAIN_FOLDER_NAME);
      if (folders.hasNext()) mainFolder = folders.next();
      else mainFolder = DriveApp.createFolder(MAIN_FOLDER_NAME);
    }
    
    let userFolder = findFolderInParent(mainFolder, userName);
    if (!userFolder) userFolder = mainFolder.createFolder(userName);
    
    // Ganti fungsi carian folder syarikat menggunakan penapis kurungan
    let companyFolder = findCompanyFolderInParent(userFolder, companyName);
    if (!companyFolder) companyFolder = userFolder.createFolder(companyName);
    
    let typeFolder = findFolderInParent(companyFolder, appType);
    if (!typeFolder) typeFolder = companyFolder.createFolder(appType);
    
    logActivity(userName, 'CREATE_FOLDER_USER', `Folder dicipta (V6.5.0): ${companyName} > ${appType}`, typeFolder.getId());

    return createJSONOutput({ success: true, folder_url: typeFolder.getUrl(), folder_id: typeFolder.getId(), folder_path: `${MAIN_FOLDER_NAME} > ${userName} > ${companyName} > ${appType}`, user_folder_url: userFolder.getUrl(), message: `Folder berjaya dicipta` });
  } catch (err) {
    return createJSONOutput({ success: false, message: `Gagal mencipta folder: ${err.toString()}` });
  }
}

/**
 * Fungsi khas untuk mencari folder syarikat dengan mengabaikan kandungan di dalam kurungan
 * serta membandingkan nama secara bersih (Case-Insensitive & Trimmed)
 */
function findCompanyFolderInParent(parentFolder, companyName) {
  try {
    if (!companyName) return null;
    
    // Bersihkan nama sasaran: Buang kurungan "()" beserta isinya, tukar ke huruf besar, dan trim
    const cleanTarget = companyName.toString().replace(/\s*\([^)]*\)/g, "").toUpperCase().trim();
    
    const folders = parentFolder.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      // Bersihkan nama folder sedia ada di Drive untuk perbandingan lancar
      const cleanFolder = folder.getName().toString().replace(/\s*\([^)]*\)/g, "").toUpperCase().trim();
      
      // Jika sepadan, pulangkan folder tersebut (jangan cipta folder baharu lagi)
      if (cleanFolder === cleanTarget) {
        Logger.log(`[Drive] Folder sepadan dijumpai: "${folder.getName()}" sepadan dengan "${companyName}"`);
        return folder;
      }
    }
    return null;
  } catch (error) {
    Logger.log(`Error dalam findCompanyFolderInParent: ${error.toString()}`);
    return null;
  }
}

function createUserFolderStructure(syarikat, startDate, jenisPermohonan, pengesyor) {
  try {
    const dateObj = new Date(startDate);
    const formattedDate = formatDateForFolder(startDate);
    const typeFolderName = `${jenisPermohonan.toUpperCase()} - ${formattedDate}`;
    const companyFolderName = syarikat.toUpperCase();
    
    let mainFolder;
    try { mainFolder = DriveApp.getFolderById(getMainFolderId()); } 
    catch (e) {
      const folders = DriveApp.getFoldersByName(MAIN_FOLDER_NAME);
      if (folders.hasNext()) mainFolder = folders.next();
      else mainFolder = DriveApp.createFolder(MAIN_FOLDER_NAME);
    }
    
    let userFolder = findFolderInParent(mainFolder, pengesyor);
    if (!userFolder) userFolder = mainFolder.createFolder(pengesyor);
    
    // Ganti fungsi carian folder syarikat menggunakan penapis kurungan
    let companyFolder = findCompanyFolderInParent(userFolder, companyFolderName);
    if (!companyFolder) companyFolder = userFolder.createFolder(companyFolderName);
    
    let typeFolder = findFolderInParent(companyFolder, typeFolderName);
    if (!typeFolder) typeFolder = companyFolder.createFolder(typeFolderName);
    
    logActivity(pengesyor, 'AUTO_CREATE_USER_FOLDER', `Folder auto-dicipta: ${companyFolderName} > ${typeFolderName}`, typeFolder.getId());

    return { success: true, folderUrl: typeFolder.getUrl(), userFolderUrl: userFolder.getUrl(), folderId: typeFolder.getId(), folderName: typeFolderName };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// =========================================================================
// TEST FUNCTIONS
// =========================================================================
function testCheckAuth() {
  const testEmail = "pengesyor@kuskop.gov.my";
  const result = handleCheckAuth(testEmail);
  console.log(result.getContent());
  return result;
}

function testVerifyUserAccess() {
  const testEmail = "pengesyor@kuskop.gov.my";
  const result = verifyUserAccess(testEmail, [ROLE_PENGESYOR, ROLE_ADMIN]);
  console.log(JSON.stringify(result));
  return result;
}

function testFindUserByEmail() {
  const testEmail = "pengesyor@kuskop.gov.my";
  const authResult = getAuthenticatedUserEmail(testEmail);
  if (authResult.isValid) {
    const user = findUserByEmail(authResult.email);
    console.log("User found:", JSON.stringify(user));
    return user;
  }
  return null;
}

function testUserFolder() {
  const result = handleCreateDriveFolderAction({ application_type: "BARU - 21-04-2026", company_name: "SYARIKAT TEST", user_name: "Zariff Fahmi", main_folder_id: getMainFolderId() });
  console.log(JSON.stringify(result));
  return result;
}

function testDeleteRecord() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const testData = { action: 'deleteRecord', row: 2, deleteType: 'padam_syor', user: 'Test User' };
  const result = handleDeleteRecord(testData, sheet);
  console.log(result.getContent());
  return result;
}

function testCetakDanSimpanPDF() {
  const testData = { action: 'cetak_dan_simpan_pdf', htmlContent: '<div class="print-header"><h1>Borang Semakan</h1><p>Ini adalah kandungan ujian.</p></div>', company_name: 'SYARIKAT TEST', user_name: 'Zariff Fahmi', application_type: 'BARU - 21-04-2026', user_color: '#ff6b35' };
  const result = handleCetakDanSimpanPDF(testData);
  console.log(result.getContent());
  return result;
}

function testSendEmailPermission() {
  try {
    MailApp.sendEmail({ to: 'zariff.zainudin@kuskop.gov.my', subject: "Test Permission V6.5.0", body: "Test sahaja.", name: EMAIL_SENDER_NAME });
    return createJSONOutput({ success: true, message: `Emel ujian berjaya dihantar ke zariff.zainudin@kuskop.gov.my.` });
  } catch (error) {
    return createJSONOutput({ success: false, message: `Gagal menghantar emel ujian: ${error.toString()}` });
  }
}

function testSendSPIEmail() {
  const testHtml = '<p>TEST: Emel SPI automatik — sila abaikan.</p>';
  MailApp.sendEmail({
    to: 'zariff.zainudin@kuskop.gov.my',
    subject: '[TEST] Emel SPI Automatik',
    htmlBody: testHtml,
    name: EMAIL_SENDER_NAME
  });
  console.log('[Test SPI Email] Emel test dihantar ke zariff.zainudin@kuskop.gov.my.');
  return createJSONOutput({ success: true, message: 'Emel test dihantar.' });
}

function testCheckAuthWithEmail() {
  const testEmail1 = "pengesyor@kuskop.gov.my";
  const result1 = handleCheckAuth(testEmail1);
  console.log(result1.getContent());
  
  // Test untuk PENGESYOR dengan Firebase code (guna emel ujian)
  const testEmail2 = "pengesyor2@kuskop.gov.my";
  const result2 = handleCheckAuth(testEmail2);
  console.log(result2.getContent());
  
  return "All tests completed";
}

function testDoGetCheckAuth() {
  const e = { parameter: { action: "checkAuth", email: "pengesyor@kuskop.gov.my" } };
  const result = doGet(e);
  console.log(result.getContent());
  return result;
}

function testDoPostCheckAuth() {
  const payload = { action: "checkAuth", email: "pengesyor@kuskop.gov.my" };
  const e = { postData: { contents: JSON.stringify(payload) } };
  const result = doPost(e);
  console.log(result.getContent());
  return result;
}

function testSearchYoutube() {
  const result = handleSearchYoutube("tutorial google apps script");
  console.log(result.getContent());
  return result;
}

// =========================================================================
// V6.5.2: FUNGSI UJI embedAllImagesAsBase64
// =========================================================================
function testEmbedAllImagesAsBase64() {
  const testHtml = `
    <div>
      <img src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png" />
      <p>Ini adalah ujian</p>
      <img src="data:image/png;base64,ABC123=" />
      <img src="https://via.placeholder.com/150" />
    </div>
  `;
  
  const result = embedAllImagesAsBase64(testHtml);
  console.log("Original HTML length:", testHtml.length);
  console.log("Result HTML length:", result.length);
  console.log("Contains base64:", result.includes('data:image/') ? 'YES' : 'NO');
  return result;
}

// =========================================================================
// FUNGSI HELPER: SEMAKAN HARI CUTI UMUM WILAYAH PERSEKUTUAN PUTRAJAYA
// Sumber automatik: kalendar awam Google "Holidays in Malaysia".
// 1) UTAMA: fail ICS awam melalui UrlFetchApp dengan cubaan semula (HTTP 429
//    biasanya sementara; cubaan kedua biasanya berjaya).
// 2) SANDARAN: CalendarApp - hanya berfungsi jika kalendar awam tersebut
//    dilanggan/ditambah dalam Google Calendar akaun pelaksana.
// 3) Terakhir: cache lama + senarai cuti tetap Persekutuan.
// Senarai cuti di-cache dalam Script Properties mengikut tahun (~20 tarikh/tahun)
// dan di-refresh setiap 30 hari sahaja.
// =========================================================================

const MY_HOLIDAY_CALENDAR_ID = 'en.malaysia#holiday@group.v.calendar.google.com';
const MY_HOLIDAY_ICS_URL = 'https://calendar.google.com/calendar/ical/en.malaysia%23holiday%40group.v.calendar.google.com/public/basic.ics';
const PUTRAJAYA_HOLIDAYS_REFRESH_DAYS = 30;

// Tapisan 'Observance' (bukan cuti umum) bila description CalendarApp tiada
const OBSERVANCE_TITLE_BLOCKLIST = /observance|valentine|easter|christmas eve|new year'?s eve|halloween|april fool|mother'?s day|father'?s day/i;

// Cuti Kelepasan Am Tetap Persekutuan/Putrajaya (sandaran jika sumber automatik gagal)
const CUTI_TETAP_PUTRAJAYA = [
  '01-01', // Tahun Baru
  '02-01', // Hari Wilayah Persekutuan (Putrajaya/KL/Labuan)
  '05-01', // Hari Pekerja
  '08-31', // Hari Kebangsaan / Merdeka
  '09-16', // Hari Malaysia
  '12-25'  // Hari Krismas
];

// Memo dalam-memori per eksekusi: elak baca Properties/fetch berulang dalam
// gelung addWorkingDays/countWorkingDays.
let putrajayaHolidayMemo = {};

function getPutrajayaHolidayMap(year) {
  const yearKey = String(year);
  if (putrajayaHolidayMemo[yearKey]) return putrajayaHolidayMemo[yearKey];

  const props = PropertiesService.getScriptProperties();
  const cacheKey = 'PUTRAJAYA_HOLIDAYS_' + yearKey;
  const syncedKey = cacheKey + '_SYNCED_AT';
  let dates = [];

  try {
    const cached = props.getProperty(cacheKey);
    const syncedAt = parseInt(props.getProperty(syncedKey) || '0', 10);
    const stale = !syncedAt || (Date.now() - syncedAt) > (PUTRAJAYA_HOLIDAYS_REFRESH_DAYS * 24 * 60 * 60 * 1000);

    if (cached) {
      try { dates = JSON.parse(cached) || []; } catch (e) { dates = []; }
    }

    if (!cached || stale) {
      const fresh = fetchPutrajayaHolidayDates(year);
      if (fresh.length > 0) {
        dates = fresh;
        props.setProperty(cacheKey, JSON.stringify(dates));
        props.setProperty(syncedKey, String(Date.now()));
      }
    }
  } catch (e) {
    console.error(`[Cuti Putrajaya] Ralat muat cuti ${year}: ${e.toString()}`);
  }

  const map = {};
  dates.forEach(d => { map[d] = true; });

  // Override manual (cth. cuti ganti): PUTRAJAYA_HOLIDAYS_MANUAL = "2026-02-03, 2026-11-09"
  try {
    const manual = (props.getProperty('PUTRAJAYA_HOLIDAYS_MANUAL') || '')
      .split(',').map(s => s.trim())
      .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s) && s.substring(0, 4) === yearKey);
    manual.forEach(d => { map[d] = true; });
  } catch (e) {}

  putrajayaHolidayMemo[yearKey] = map;
  return map;
}

function fetchPutrajayaHolidayDates(year) {
  // 1) ICS awam dengan cubaan semula (429 = rate limit sementara)
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = UrlFetchApp.fetch(MY_HOLIDAY_ICS_URL, { muteHttpExceptions: true });
      const code = response.getResponseCode();
      if (code === 200) {
        const dates = parseMalaysiaHolidayIcs(response.getContentText(), year);
        if (dates.length > 0) {
          console.log(`[Cuti Putrajaya] ${dates.length} tarikh cuti ${year} dimuatkan dari ICS (cubaan ${attempt}).`);
          return dates;
        }
      } else if (code === 429) {
        console.log(`[Cuti Putrajaya] ICS rate-limit 429 untuk ${year} (cubaan ${attempt}/4), cuba semula...`);
      } else {
        console.error(`[Cuti Putrajaya] ICS pulangkan HTTP ${code} (cubaan ${attempt}/4).`);
      }
    } catch (e) {
      console.error(`[Cuti Putrajaya] ICS ralat (cubaan ${attempt}/4): ${e.toString()}`);
    }
    if (attempt < 4) Utilities.sleep(attempt * 3000);
  }

  // 2) Sandaran CalendarApp (hanya jika kalendar awam dilanggan dalam akaun)
  try {
    const viaCalendar = fetchHolidaysViaCalendarApp(year);
    if (viaCalendar.length > 0) {
      console.log(`[Cuti Putrajaya] ${viaCalendar.length} tarikh cuti ${year} dimuatkan dari CalendarApp.`);
      return viaCalendar;
    }
  } catch (e) {
    console.error(`[Cuti Putrajaya] CalendarApp gagal: ${e.toString()}`);
  }

  console.error(`[Cuti Putrajaya] Semua sumber automatik gagal untuk ${year}. Guna cache lama/senarai tetap.`);
  return [];
}

function fetchHolidaysViaCalendarApp(year) {
  const cal = CalendarApp.getCalendarById(MY_HOLIDAY_CALENDAR_ID);
  if (!cal) {
    console.log(`[Cuti Putrajaya] Kalendar awam ${MY_HOLIDAY_CALENDAR_ID} tidak dilanggan akaun; langkau sandaran CalendarApp.`);
    return [];
  }

  const start = new Date(year, 0, 1, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59);
  const events = cal.getEvents(start, end);
  const result = [];
  const seen = {};
  let descKosong = 0;

  events.forEach(ev => {
    const desc = (ev.getDescription() || '').trim();
    const title = (ev.getTitle() || '').trim();

    if (desc) {
      // Hanya cuti umum sebenar (buang 'Observance' seperti Valentine's Day)
      if (!/^Public holiday/i.test(desc)) return;
      // Cuti serantau: ambil hanya jika Putrajaya tersenarai; cuti kebangsaan tiada senarai negeri
      if (/Public holiday in /i.test(desc) && !/Putrajaya/i.test(desc)) return;
    } else {
      // Description tiada: tapis acara bukan cuti mengikut tajuk (berhati-hati)
      descKosong++;
      if (OBSERVANCE_TITLE_BLOCKLIST.test(title)) return;
    }

    let d;
    try {
      d = ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime();
    } catch (e) {
      d = ev.getStartTime();
    }
    if (!d || isNaN(d.getTime())) return;

    const iso = Utilities.formatDate(d, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
    if (iso.substring(0, 4) !== String(year)) return;
    if (!seen[iso]) { seen[iso] = true; result.push(iso); }
  });

  if (descKosong > 0) {
    console.warn(`[Cuti Putrajaya] ${descKosong} acara CalendarApp tiada description; tapisan tajuk digunakan.`);
  }
  return result;
}

function parseMalaysiaHolidayIcs(icsText, year) {
  const ics = String(icsText || '').replace(/\r\n[ \t]/g, '');
  const blocks = ics.split('BEGIN:VEVENT');
  const result = [];
  const seen = {};

  blocks.forEach(block => {
    if (block.indexOf('END:VEVENT') === -1) return;
    const dtMatch = block.match(/DTSTART;VALUE=DATE:(\d{8})/);
    if (!dtMatch) return;
    const dt = dtMatch[1];
    if (dt.substring(0, 4) !== String(year)) return;

    const desc = (block.match(/DESCRIPTION:([^\r\n]*)/) || [])[1] || '';
    if (!/^Public holiday/i.test(desc)) return;
    if (/Public holiday in /i.test(desc) && !/Putrajaya/i.test(desc)) return;

    const iso = dt.substring(0, 4) + '-' + dt.substring(4, 6) + '-' + dt.substring(6, 8);
    if (!seen[iso]) { seen[iso] = true; result.push(iso); }
  });

  return result;
}

function isCutiUmumPutrajaya(date) {
  const iso = Utilities.formatDate(date, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  const mmdd = Utilities.formatDate(date, 'Asia/Kuala_Lumpur', 'MM-dd');
  if (CUTI_TETAP_PUTRAJAYA.indexOf(mmdd) !== -1) return true;
  return getPutrajayaHolidayMap(iso.substring(0, 4))[iso] === true;
}

function isHariBekerja(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !isCutiUmumPutrajaya(date);
}

// Jalankan manual bila perlu (cth. selepas pengumuman cuti ganti) untuk paksa refresh.
function refreshPutrajayaHolidays() {
  const props = PropertiesService.getScriptProperties();
  const currentYear = parseInt(Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy'), 10);
  let total = 0;
  for (let y = currentYear; y <= currentYear + 1; y++) {
    const dates = fetchPutrajayaHolidayDates(y);
    if (dates.length > 0) {
      props.setProperty('PUTRAJAYA_HOLIDAYS_' + y, JSON.stringify(dates));
      props.setProperty('PUTRAJAYA_HOLIDAYS_' + y + '_SYNCED_AT', String(Date.now()));
      total += dates.length;
    }
  }
  putrajayaHolidayMemo = {};
  if (total > 0) {
    console.log(`[Cuti Putrajaya] Refresh selesai: ${total} tarikh untuk ${currentYear}-${currentYear + 1}.`);
  } else {
    console.error(`[Cuti Putrajaya] Refresh GAGAL: tiada tarikh diperoleh untuk ${currentYear}-${currentYear + 1}. Sistem guna cache lama/senarai tetap.`);
  }
  return createJSONOutput({ success: total > 0, count: total, message: total > 0 ? 'Cuti umum berjaya dimuatkan.' : 'Gagal memuatkan cuti; guna sandaran.' });
}

function testCutiPutrajaya() {
  // Pastikan cache cuti ada; jika belum, muatkan dahulu
  const props = PropertiesService.getScriptProperties();
  const tahunSemasa = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy');
  if (!props.getProperty('PUTRAJAYA_HOLIDAYS_' + tahunSemasa)) {
    console.log('[Cuti Putrajaya] Cache belum ada - muatkan cuti dahulu...');
    refreshPutrajayaHolidays();
  }

  const tarikhUji = [
    '2026-03-07', // Nuzul Al-Quran
    '2026-02-02', // Cuti ganti Thaipusam
    '2026-11-08', // Diwali
    '2026-03-09'  // Hari biasa (Isnin)
  ];
  tarikhUji.forEach(t => {
    const d = new Date(t + 'T00:00:00');
    console.log(`${t} | cuti=${isCutiUmumPutrajaya(d)} | hariBekerja=${isHariBekerja(d)}`);
  });
  const mula = new Date('2026-03-05T00:00:00');
  const tamat = addWorkingDays(mula, 14);
  console.log(`14 hari bekerja dari 2026-03-05 = ${Utilities.formatDate(tamat, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd')}`);
  return createJSONOutput({ success: true });
}

// =========================================================================
// FUNGSI BERJADUAL: KUMPULAN EMEL PEMUTIHAN (JUMAAT 10 PAGI - Kitaran 2 Minggu)
// Ditambah logik ganjakan automatik ke hari Isnin sekiranya Jumaat adalah cuti umum
// =========================================================================
function addToPemutihanQueue(emailData) {
  const props = PropertiesService.getScriptProperties();
  let queue = [];
  const existingQueue = props.getProperty('PEMUTIHAN_QUEUE');
  if (existingQueue) queue = JSON.parse(existingQueue);
  const isDuplicate = queue.some(item => item.syarikat === emailData.syarikat);
  if (!isDuplicate) {
    queue.push(emailData);
    props.setProperty('PEMUTIHAN_QUEUE', JSON.stringify(queue));
  }
}

function processPemutihanQueue() {
  const today = new Date();
  const hariSemasa = parseInt(Utilities.formatDate(today, "Asia/Kuala_Lumpur", "u")); // 1=Isnin, 5=Jumaat

  // Logik Pembersihan & Pemulihan Pemicu (Trigger) jika berjalan pada hari Isnin (Hasil ganjakan)
  if (hariSemasa === 1) {
    console.log("Menjalankan jadual ganjakan Pemutihan pada hari Isnin. Menetapkan semula jadual asal dwi-mingguan.");
    setupPemutihanCronJob(); // Memadam trigger ganjakan sementara dan membina semula trigger Jumaat dwi-mingguan asal
  }

  // Jika hari ini hari Jumaat dan dikesan sebagai Cuti Umum Putrajaya, ganjakkan ke Isnin minggu berikutnya
  if (hariSemasa === 5 && isCutiUmumPutrajaya(today)) {
    console.log("Hari Jumaat ini adalah Cuti Umum Putrajaya. Mengganjakkan proses Pemutihan ke hari Isnin depan jam 10 pagi.");
    
    // Kira tarikh hari Isnin berikutnya (+3 hari dari Jumaat)
    let nextMonday = new Date(today.getTime());
    nextMonday.setDate(today.getDate() + 3);
    nextMonday.setHours(10, 0, 0, 0); // Tetapkan tepat jam 10:00 AM

    // Bina trigger pakai-buang khusus untuk hari Isnin tersebut
    ScriptApp.newTrigger('processPemutihanQueue')
      .timeBased()
      .at(nextMonday)
      .create();
      
    return; // Keluar dari fungsi, emel tidak akan dihantar pada hari cuti ini
  }

  const props = PropertiesService.getScriptProperties();
  const existingQueue = props.getProperty('PEMUTIHAN_QUEUE');
  if (!existingQueue) return; 
  const queue = JSON.parse(existingQueue);
  if (queue.length === 0) return; 

  let rowsHtml = '';
  let textList = '';
  queue.forEach((data, index) => {
    rowsHtml += `
      <tr>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${index + 1}</td>
        <td style="padding:10px; border:1px solid #ddd;"><strong>${data.syarikat}</strong></td>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${data.cidb}</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${data.gred}</td>
        <td style="padding:10px; border:1px solid #ddd;">${data.alamat_perniagaan || 'Tiada'}</td>
        <td style="padding:10px; border:1px solid #ddd;">${data.justifikasi || 'Tiada'}</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${data.pelulus || 'Tiada'}</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><a href="${data.pautan}" style="color:#1a73e8; font-weight:bold;">Buka Drive</a></td>
      </tr>
    `;
    textList += `${index + 1}. ${data.syarikat}\n   CIDB: ${data.cidb} | Gred: ${data.gred} | Pelulus: ${data.pelulus || 'Tiada'}\n   Alamat Perniagaan: ${data.alamat_perniagaan || 'Tiada'}\n   Justifikasi: ${data.justifikasi || 'Tiada'}\n\n`;
  });

  const subject = `Makluman Dwi-Mingguan: ${queue.length} Permohonan Lawatan Premis (PEMUTIHAN)`;
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
    .footer { margin-top: 20px; padding-top: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">⚠️ MAKLUMAN DWI-MINGGUAN (PEMUTIHAN)</h2>
      <p style="margin: 5px 0 0 0;">Sistem Bersepadu SPTB</p>
    </div>
    <div class="content">
      <p>Tuan/Puan,</p>
      <p>Berikut adalah senarai <strong>${queue.length} permohonan lawatan premis (PEMUTIHAN)</strong> yang telah disyorkan dikumpul dalam tempoh 2 minggu ini. Sila ambil tindakan sewajarnya.</p>
      <table style="width:100%; border-collapse:collapse; margin: 20px 0; background:white;">
        <thead style="background:#f1f5f9; color:#1e293b;">
          <tr>
            <th style="padding:10px; border:1px solid #ddd;">Bil</th>
            <th style="padding:10px; border:1px solid #ddd;">Nama Syarikat</th>
            <th style="padding:10px; border:1px solid #ddd;">No. CIDB</th>
            <th style="padding:10px; border:1px solid #ddd;">Gred</th>
            <th style="padding:10px; border:1px solid #ddd;">Alamat Perniagaan</th>
            <th style="padding:10px; border:1px solid #ddd;">Justifikasi Lawatan</th>
            <th style="padding:10px; border:1px solid #ddd;">Penlulus</th>
            <th style="padding:10px; border:1px solid #ddd;">Pautan Drive</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin-top: 20px;"><em>*** Emel ini dijana secara automatik setiap hari Jumaat (Setiap 2 Minggu). Sila jangan balas emel ini. ***</em></p>
    </div>
    <div class="footer">
      <p>Sistem Bersepadu SPTB<br>© ${new Date().getFullYear()} KUSKOP. Hak Cipta Terpelihara.</p>
      <p>Dijana pada: ${new Date().toLocaleString('ms-MY')}</p>
    </div>
  </div>
</body>
</html>`;

  const plainBody = `NOTIS DWI-MINGGUAN LAWATAN SPI (PEMUTIHAN)\n\nBerikut adalah senarai ${queue.length} permohonan pemutihan minggu ini:\n\n${textList}\n*** Emel automatik oleh Sistem STB ***`;

  try {
    MailApp.sendEmail({ to: getEmailToSPI(), cc: getEmailCcSPTB(), subject: subject, htmlBody: htmlBody, body: plainBody, name: EMAIL_SENDER_NAME });
    
    // Update SPI status dalam sheet
    updateSPIStatusInSheet(queue);
    
    props.deleteProperty('PEMUTIHAN_QUEUE');
    logActivity('System', 'BATCH_EMAIL_PEMUTIHAN', `Berjaya menghantar emel pukal dwi-mingguan pemutihan untuk ${queue.length} syarikat.`, '');
  } catch (error) {
    console.error("Gagal menghantar emel pukal dwi-mingguan pemutihan:", error);
    logActivity('System', 'ERROR_BATCH_EMAIL', `Gagal menghantar emel pukal dwi-mingguan: ${error.toString()}`, '');
  }
}

function setupPemutihanCronJob() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processPemutihanQueue') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('processPemutihanQueue')
    .timeBased()
    .everyWeeks(2) 
    .onWeekDay(ScriptApp.WeekDay.FRIDAY) 
    .atHour(10) 
    .create();
  console.log("✅ Cron job Dwi-Mingguan Pemutihan berjaya ditetapkan setiap hari Jumaat jam 10 pagi, setiap 2 minggu.");
}

// =========================================================================
// FUNGSI BERJADUAL: KUMPULAN EMEL SIASAT BIASA (SETIAP HARI BEKERJA 8 PAGI)
// Ditambah logik sekatan cuti umum persekutuan Wilayah Persekutuan Putrajaya
// =========================================================================
function addToSiasatQueue(emailData) {
  const props = PropertiesService.getScriptProperties();
  let queue = [];
  const existingQueue = props.getProperty('SIASAT_QUEUE');
  if (existingQueue) queue = JSON.parse(existingQueue);
  const isDuplicate = queue.some(item => item.syarikat === emailData.syarikat);
  if (!isDuplicate) {
    queue.push(emailData);
    props.setProperty('SIASAT_QUEUE', JSON.stringify(queue));
  }
}

function processSiasatQueue() {
  const today = new Date();
  const hariSemasa = parseInt(Utilities.formatDate(today, "Asia/Kuala_Lumpur", "u"));
  
  // 1. Sekat penghantaran jika hujung minggu (Sabtu / Ahad)
  if (hariSemasa === 6 || hariSemasa === 7) {
    console.log("Hari ini adalah hujung minggu (Sabtu/Ahad). Penghantaran Siasat Biasa ditangguhkan ke hari Isnin.");
    return; 
  }

  // 2. Sekat penghantaran jika hari bekerja tersebut jatuh pada Cuti Umum Putrajaya
  if (isCutiUmumPutrajaya(today)) {
    console.log("Hari ini adalah Cuti Umum Putrajaya. Penghantaran Siasat Biasa ditangguhkan ke hari bekerja berikutnya.");
    return;
  }

  const props = PropertiesService.getScriptProperties();
  const existingQueue = props.getProperty('SIASAT_QUEUE');
  if (!existingQueue) return; 
  const queue = JSON.parse(existingQueue);
  if (queue.length === 0) return; 

  let rowsHtml = '';
  let textList = '';
  
  queue.forEach((data, index) => {
    rowsHtml += `
      <tr>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${index + 1}</td>
        <td style="padding:10px; border:1px solid #ddd;"><strong>${data.syarikat}</strong></td>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${data.cidb}</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${data.gred}</td>
        <td style="padding:10px; border:1px solid #ddd;">${data.alamat_perniagaan || 'Tiada'}</td>
        <td style="padding:10px; border:1px solid #ddd;">${data.justifikasi || 'Tiada'}</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${data.pengesyor}</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${data.pelulus || '-'}</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><a href="${data.pautan}" style="color:#1a73e8; font-weight:bold;">Buka Drive</a></td>
      </tr>
    `;
    textList += `${index + 1}. ${data.syarikat}\n   CIDB: ${data.cidb} | Gred: ${data.gred} | Pengesyor: ${data.pengesyor}\n   Pelulus (Pengesahan): ${data.pelulus || '-'}\n   Alamat Perniagaan: ${data.alamat_perniagaan || 'Tiada'}\n   Justifikasi: ${data.justifikasi || 'Tiada'}\n\n`;
  });

  const subject = `Makluman Harian: ${queue.length} Permohonan Lawatan Premis SPI`;
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: #3498db; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
    .footer { margin-top: 20px; padding-top: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">📋 MAKLUMAN HARIAN (LAWATAN PREMIS SPI)</h2>
      <p style="margin: 5px 0 0 0;">Sistem Bersepadu SPTB</p>
    </div>
    <div class="content">
      <p>Tuan/Puan,</p>
      <p>Berikut adalah senarai <strong>${queue.length} permohonan lawatan premis SPI </strong> yang telah disyorkan. Sila ambil tindakan sewajarnya.</p>
      <table style="width:100%; border-collapse:collapse; margin: 20px 0; background:white;">
        <thead style="background:#f1f5f9; color:#1e293b;">
          <tr>
            <th style="padding:10px; border:1px solid #ddd;">Bil</th>
            <th style="padding:10px; border:1px solid #ddd;">Nama Syarikat</th>
            <th style="padding:10px; border:1px solid #ddd;">No. CIDB</th>
            <th style="padding:10px; border:1px solid #ddd;">Gred</th>
            <th style="padding:10px; border:1px solid #ddd;">Alamat Perniagaan</th>
            <th style="padding:10px; border:1px solid #ddd;">Justifikasi Lawatan</th>
            <th style="padding:10px; border:1px solid #ddd;">Pengesyor</th>
            <th style="padding:10px; border:1px solid #ddd;">Pelulus (Pengesahan)</th>
            <th style="padding:10px; border:1px solid #ddd;">Pautan Drive</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin-top: 20px;"><em>*** Emel ini dijana secara automatik setiap hari bekerja. Sila jangan balas emel ini. ***</em></p>
    </div>
    <div class="footer">
      <p>Sistem Bersepadu SPTB<br>© ${new Date().getFullYear()} KUSKOP. Hak Cipta Terpelihara.</p>
      <p>Dijana pada: ${new Date().toLocaleString('ms-MY')}</p>
    </div>
  </div>
</body>
</html>`;

  const plainBody = `NOTIS HARIAN LAWATAN SPI\n\nSenarai ${queue.length} permohonan siasat biasa hari ini:\n\n${textList}\n*** Emel automatik oleh Sistem STB ***`;

  try {
    MailApp.sendEmail({ to: getEmailToSPI(), cc: getEmailCcSPTB(), subject: subject, htmlBody: htmlBody, body: plainBody, name: EMAIL_SENDER_NAME });
    
    // Update SPI status dalam sheet
    updateSPIStatusInSheet(queue);
    
    props.deleteProperty('SIASAT_QUEUE');
    logActivity('System', 'BATCH_EMAIL_SIASAT', `Berjaya menghantar emel harian siasat untuk ${queue.length} syarikat.`, '');
  } catch (error) {
    logActivity('System', 'ERROR_BATCH_EMAIL_SIASAT', `Ralat emel harian: ${error.toString()}`, '');
  }
}

function setupSiasatCronJob() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processSiasatQueue') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('processSiasatQueue')
    .timeBased()
    .everyDays(1)
    .atHour(18) 
    .create();
  console.log("✅ Cron job Siasat Biasa berjaya ditetapkan setiap hari jam 6 PETANG.");
}

// =========================================================================
// FUNGSI KHAS: LIHAT SENARAI QUEUE (BARISAN GILIR)
// =========================================================================

function lihatSenaraiQueue() {
  const props = PropertiesService.getScriptProperties();

  console.log("=== QUEUE PEMUTIHAN (JUMAAT 10 PAGI SETIAP 2 MINGGU) ===");
  const pemutihanQ = props.getProperty('PEMUTIHAN_QUEUE');
  if (pemutihanQ) {
    const pData = JSON.parse(pemutihanQ);
    console.log(`Terdapat ${pData.length} syarikat menunggu:`);
    pData.forEach((item, i) => {
      console.log(`${i+1}. ${item.syarikat} (CIDB: ${item.cidb}) - Pengesyor: ${item.pengesyor}`);
    });
  } else {
    console.log("Tiada data dalam queue Pemutihan.");
  }

  console.log("\n=== QUEUE SIASAT BIASA (HARI BEKERJA 9 PAGI) ===");
  const siasatQ = props.getProperty('SIASAT_QUEUE');
  if (siasatQ) {
    const sData = JSON.parse(siasatQ);
    console.log(`Terdapat ${sData.length} syarikat menunggu:`);
    sData.forEach((item, i) => {
      console.log(`${i+1}. ${item.syarikat} (CIDB: ${item.cidb}) - Pengesyor: ${item.pengesyor}`);
    });
  } else {
    console.log("Tiada data dalam queue Siasat Biasa.");
  }
}

// =========================================================================
// FUNGSI HELPER BARU
// =========================================================================

function updateSPIStatusInSheet(queueItems) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const timestamp = Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "dd/MM/yyyy HH:mm:ss");
  
  queueItems.forEach(item => {
    if (item.row) {
      try {
         // Update kolum P (16) & Q (17)
         sheet.getRange(item.row, 16, 1, 2).setValues([["TELAH DIHANTAR", timestamp]]);
      } catch(e) {
         console.error("Gagal update status sheet untuk baris: " + item.row);
      }
    }
  });
}

function removeFromQueue(syarikatName, queueName) {
  const props = PropertiesService.getScriptProperties();
  const qStr = props.getProperty(queueName);
  if (qStr) {
    let queue = JSON.parse(qStr);
    const initLength = queue.length;
    queue = queue.filter(item => item.syarikat !== syarikatName);
    if (queue.length !== initLength) {
      props.setProperty(queueName, JSON.stringify(queue));
      console.log(`[Queue] Dibuang: ${syarikatName} dari ${queueName}`);
    }
  }
}

// =========================================================================
// KOD SEMENTARA: JALANKAN SEKALI SAHAJA UNTUK PADAM SYARIKAT GHOST DARI QUEUE
// =========================================================================
function manualPadamSyarikatDariQueue() {
  // 1. GANTIKAN teks di bawah dengan nama tepat syarikat yang telah awak delete itu
  const namaSyarikatGhost = " "; 
  
  console.log("Memulakan proses pembersihan bagi: " + namaSyarikatGhost);
  
  // 2. Panggil fungsi sedia ada untuk delete dari memori backend
  removeFromQueue(namaSyarikatGhost, 'SIASAT_QUEUE'); //
  removeFromQueue(namaSyarikatGhost, 'PEMUTIHAN_QUEUE'); //
  
  console.log("Pembersihan manual selesai! Sila semak log di atas.");
}

// =========================================================================
// V6.7.0: FILE MANAGER — SENARAI FAIL DALAM FOLDER DRIVE
// =========================================================================

function getDriveFileOwnerInfo(file) {
  try {
    const desc = file.getDescription ? (file.getDescription() || '') : '';
    if (!desc) return { uploadedBy: '', uploadedByName: '' };
    const obj = JSON.parse(desc);
    return {
      uploadedBy: String(obj.uploadedBy || '').toLowerCase().trim(),
      uploadedByName: String(obj.uploadedByName || '')
    };
  } catch (e) {
    return { uploadedBy: '', uploadedByName: '' };
  }
}

function handleListDriveFiles(data) {
  try {
    const folderId = data.folderId;
    if (!folderId) {
      return createJSONOutput({ success: false, error: "folderId diperlukan." });
    }
    
    const folder = DriveApp.getFolderById(folderId);
    const folderName = folder.getName();
    const files = [];
    const fileIterator = folder.getFiles();
    
    while (fileIterator.hasNext()) {
      const file = fileIterator.next();
      const ownerInfo = getDriveFileOwnerInfo(file);
      files.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getMimeType(),
        size: file.getSize(),
        lastUpdated: file.getLastUpdated().toISOString(),
        webViewLink: file.getUrl(),
        thumbnailLink: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=s200',
        iconLink: file.getMimeType().startsWith('image/') 
          ? 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=s200'
          : '',
        uploadedBy: ownerInfo.uploadedBy,
        uploadedByName: ownerInfo.uploadedByName
      });
    }
    
    const folders = [];
    const folderIterator = folder.getFolders();
    while (folderIterator.hasNext()) {
      const subFolder = folderIterator.next();
      folders.push({
        id: subFolder.getId(),
        name: subFolder.getName(),
        mimeType: 'application/vnd.google-apps.folder',
        isFolder: true
      });
    }
    
    var parentFolderId = '';
    try {
      const parents = folder.getParents();
      if (parents.hasNext()) {
        parentFolderId = parents.next().getId();
      }
    } catch(e) {
      parentFolderId = '';
    }
    
    return createJSONOutput({ 
      success: true, 
      files: files, 
      folders: folders,
      folderName: folderName,
      folderId: folderId,
      parentFolderId: parentFolderId
    });
    
  } catch (error) {
    var msg = error.toString();
    if (msg.indexOf('No item with the given ID') > -1 || msg.indexOf('permission to access') > -1) {
      msg = "Folder Drive tidak dapat diakses. Mungkin folder ini telah dipadam atau anda tiada kebenaran.";
    }
    return createJSONOutput({ success: false, error: msg });
  }
}

function handleUploadDriveFile(data) {
  try {
    const folderId = data.folderId;
    const fileName = data.fileName;
    const mimeType = data.mimeType;
    const fileData = data.fileData;
    
    if (!folderId || !fileName || !fileData) {
      return createJSONOutput({ success: false, error: "folderId, fileName, dan fileData diperlukan." });
    }
    
    const folder = DriveApp.getFolderById(folderId);
    const bytes = Utilities.base64Decode(fileData);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const createdFile = folder.createFile(blob);

    // V6.6.1: Simpan pemilik muat naik dalam Description (untuk kebenaran padam fail sendiri)
    try {
      const uploaderEmail = String(data.email || '').toLowerCase().trim();
      let uploaderName = '';
      try {
        const uploaderProfile = findUserByEmailCached(data.email);
        if (uploaderProfile && uploaderProfile.name) uploaderName = uploaderProfile.name;
      } catch (e) {}
      createdFile.setDescription(JSON.stringify({ uploadedBy: uploaderEmail, uploadedByName: uploaderName, at: new Date().toISOString() }));
    } catch (e) {}
    
    logActivity(data.email || 'System', 'UPLOAD_FILE', 'Fail dimuat naik: ' + fileName + ' ke folder ' + folder.getName(), folderId);
    
    return createJSONOutput({
      success: true,
      file: {
        id: createdFile.getId(),
        name: createdFile.getName(),
        mimeType: createdFile.getMimeType(),
        size: createdFile.getSize(),
        lastUpdated: createdFile.getLastUpdated().toISOString(),
        webViewLink: createdFile.getUrl(),
        thumbnailLink: createdFile.getMimeType().startsWith('image/') 
          ? 'https://drive.google.com/thumbnail?id=' + createdFile.getId() + '&sz=s200'
          : '',
        uploadedBy: String(data.email || '').toLowerCase().trim()
      }
    });
    
  } catch (error) {
    var msg = error.toString();
    if (msg.indexOf('No item with the given ID') > -1) {
      msg = "Fail tidak dapat diakses. Mungkin fail ini telah dipadam atau anda tiada kebenaran.";
    }
    return createJSONOutput({ success: false, error: msg });
  }
}

// V6.12.0: MUAT NAIK BERCHUNK — terima satu chunk base64, simpan dalam ScriptCache (TTL 10 minit).
// Chunk dihantar sebagai simple POST (fetch text/plain) supaya tiada preflight CORS.
// Frontend bahagikan base64 kepada ~64KB setiap chunk, hantar selari, kemudian finalize.
function handleUploadDriveFileChunk(data) {
  try {
    const sessionId = (data.sessionId || '').toString().trim();
    const index = parseInt(data.chunkIndex, 10);
    const total = parseInt(data.totalChunks, 10);
    const chunk = data.chunkData || '';
    if (!sessionId || isNaN(index) || isNaN(total) || index < 0 || index >= total || !chunk) {
      return createJSONOutput({ success: false, error: 'Data chunk tidak lengkap.' });
    }
    if (chunk.length > 100000) {
      return createJSONOutput({ success: false, error: 'Saiz chunk melebihi had.' });
    }
    const cache = CacheService.getScriptCache();
    cache.put('UPL_' + sessionId + '_' + index, chunk, 600);
    cache.put('UPL_' + sessionId + '_meta', String(total), 600);
    return createJSONOutput({ success: true, received: index });
  } catch (error) {
    return createJSONOutput({ success: false, error: error.toString() });
  }
}

// V6.12.0: Cantum semua chunk dari cache → decode → cipta fail dalam folder Drive.
function handleFinalizeDriveUpload(data) {
  try {
    const sessionId = (data.sessionId || '').toString().trim();
    const folderId = data.folderId;
    const fileName = data.fileName;
    const mimeType = data.mimeType || 'application/octet-stream';
    if (!sessionId || !folderId || !fileName) {
      return createJSONOutput({ success: false, error: 'sessionId, folderId dan fileName diperlukan.' });
    }
    const cache = CacheService.getScriptCache();
    const metaVal = cache.get('UPL_' + sessionId + '_meta');
    if (!metaVal) {
      return createJSONOutput({ success: false, error: 'Sesi muat naik tamat. Sila cuba semula.' });
    }
    const total = parseInt(metaVal, 10);
    const parts = [];
    for (let i = 0; i < total; i++) {
      const part = cache.get('UPL_' + sessionId + '_' + i);
      if (part === null || part === undefined) {
        return createJSONOutput({ success: false, error: 'Bahagian ' + (i + 1) + '/' + total + ' hilang. Sila cuba semula.' });
      }
      parts.push(part);
    }
    const folder = DriveApp.getFolderById(folderId);
    const bytes = Utilities.base64Decode(parts.join(''));
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const createdFile = folder.createFile(blob);

    try {
      const uploaderEmail = String(data.email || '').toLowerCase().trim();
      let uploaderName = '';
      try {
        const uploaderProfile = findUserByEmailCached(data.email);
        if (uploaderProfile && uploaderProfile.name) uploaderName = uploaderProfile.name;
      } catch (e) {}
      createdFile.setDescription(JSON.stringify({ uploadedBy: uploaderEmail, uploadedByName: uploaderName, at: new Date().toISOString(), chunked: true }));
    } catch (e) {}

    try {
      cache.remove('UPL_' + sessionId + '_meta');
      for (let i = 0; i < total; i++) { try { cache.remove('UPL_' + sessionId + '_' + i); } catch (e) {} }
    } catch (e) {}

    logActivity(data.email || 'System', 'UPLOAD_FILE', 'Fail dimuat naik (berchunk): ' + fileName + ' ke folder ' + folder.getName(), folderId);

    return createJSONOutput({
      success: true,
      file: {
        id: createdFile.getId(),
        name: createdFile.getName(),
        mimeType: createdFile.getMimeType(),
        size: createdFile.getSize(),
        lastUpdated: createdFile.getLastUpdated().toISOString(),
        webViewLink: createdFile.getUrl(),
        thumbnailLink: createdFile.getMimeType().startsWith('image/')
          ? 'https://drive.google.com/thumbnail?id=' + createdFile.getId() + '&sz=s200'
          : '',
        uploadedBy: String(data.email || '').toLowerCase().trim()
      }
    });
  } catch (error) {
    var msg = error.toString();
    if (msg.indexOf('No item with the given ID') > -1) {
      msg = "Fail tidak dapat diakses. Mungkin fail ini telah dipadam atau anda tiada kebenaran.";
    }
    return createJSONOutput({ success: false, error: msg });
  }
}

function handleDeleteDriveFile(data) {
  try {
    const fileId = data.fileId;
    if (!fileId) {
      return createJSONOutput({ success: false, error: "fileId diperlukan." });
    }
    
    const file = DriveApp.getFileById(fileId);
    const fileName = file.getName();

    // V6.6.1: Hanya pemuat naik asal atau ADMIN boleh padam (fail lama tanpa owner dikecualikan)
    const requesterEmail = String(data.email || '').toLowerCase().trim();
    let requesterRole = '';
    try {
      const requesterProfile = findUserByEmailCached(data.email);
      if (requesterProfile && requesterProfile.role) requesterRole = String(requesterProfile.role).toUpperCase();
    } catch (e) {}
    const ownerInfo = getDriveFileOwnerInfo(file);
    if (ownerInfo.uploadedBy && ownerInfo.uploadedBy !== requesterEmail && requesterRole !== 'ADMIN') {
      return createJSONOutput({ success: false, error: "Hanya pemuat naik asal fail ini atau ADMIN boleh memadamnya." });
    }
    file.setTrashed(true);
    
    logActivity(data.email || 'System', 'DELETE_FILE', 'Fail dipadam: ' + fileName, '');
    
    return createJSONOutput({
      success: true,
      message: 'Fail "' + fileName + '" berjaya dipadam.'
    });
    
  } catch (error) {
    var msg = error.toString();
    if (msg.indexOf('No item with the given ID') > -1) {
      msg = "Fail tidak dapat diakses. Mungkin fail ini telah dipadam atau anda tiada kebenaran.";
    }
    return createJSONOutput({ success: false, error: msg });
  }
}

function handleRenameDriveFile(data) {
  try {
    const fileId = data.fileId;
    const newName = data.newName;
    if (!fileId || !newName) {
      return createJSONOutput({ success: false, error: "fileId dan newName diperlukan." });
    }
    
    const file = DriveApp.getFileById(fileId);
    file.setName(newName);
    
    logActivity(data.email || 'System', 'RENAME_FILE', 'Fail dinamakan semula: ' + newName, '');
    
    return createJSONOutput({
      success: true,
      file: {
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getMimeType(),
        size: file.getSize(),
        lastUpdated: file.getLastUpdated().toISOString(),
        webViewLink: file.getUrl(),
        thumbnailLink: file.getMimeType().startsWith('image/') 
          ? 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=s200'
          : ''
      }
    });
    
  } catch (error) {
    var msg = error.toString();
    if (msg.indexOf('No item with the given ID') > -1) {
      msg = "Fail tidak dapat diakses. Mungkin fail ini telah dipadam atau anda tiada kebenaran.";
    }
    return createJSONOutput({ success: false, error: msg });
  }
}

// =========================================================================
// FUNGSI SPI CALENDAR & OVERDUE CHECKER
// =========================================================================

const SPI_CALENDAR_ID = 'pkk.sptb@kuskop.gov.my';

function addWorkingDays(startDate, numDays) {
  let result = new Date(startDate);
  let added = 0;
  while (added < numDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day === 0 || day === 6) continue;
    if (isCutiUmumPutrajaya(result)) continue;
    added++;
  }
  return result;
}

function countWorkingDays(fromDate, toDate) {
  let count = 0;
  let current = new Date(fromDate);
  current.setDate(current.getDate() + 1);
  while (current <= toDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6 && !isCutiUmumPutrajaya(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function createSpiCalendarEvent(rowNum, syarikat, cidb, jenis, pengesyor, dateSubmit) {
  try {
    if (!dateSubmit) return null;
    let cal;
    try { cal = CalendarApp.getCalendarById(SPI_CALENDAR_ID); } catch (permErr) {
      console.error(`[SPI Calendar] Gagal akses kalendar — kemungkinan OAuth scope kalendar belum diauthorize. Sila redeploy & authorize semula. Detail: ${permErr.toString()}`);
      return null;
    }
    if (!cal) {
      console.error(`Kalendar ${SPI_CALENDAR_ID} tidak dijumpai`);
      return null;
    }
    const startDate = new Date(dateSubmit);
    const endDate = addWorkingDays(startDate, 14);
    const title = `SPI: ${syarikat} (${jenis})`;
    const desc = [
      `Syarikat: ${syarikat}`,
      `CIDB: ${cidb}`,
      `Jenis: ${jenis}`,
      `Pengesyor: ${pengesyor}`,
      `Tarikh Submit: ${dateSubmit}`,
      `Baris: ${rowNum}`,
      `Target Siap: ${Utilities.formatDate(endDate, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd')}`
    ].join('\n');
    const event = cal.createAllDayEvent(title, startDate, endDate, { description: desc });
    const eventId = event.getId();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const existingJSON = sheet.getRange(rowNum, 29).getValue() || '{}';
    let parsed = {};
    try { parsed = JSON.parse(existingJSON); } catch (e) { parsed = {}; }
    parsed.spi_calendar_event_id = eventId;
    sheet.getRange(rowNum, 29).setValue(JSON.stringify(parsed));
    console.log(`[SPI Calendar] Event created for row ${rowNum}: ${title}`);
    return eventId;
  } catch (e) {
    console.error(`[SPI Calendar] Gagal buat event untuk row ${rowNum}: ${e.toString()}`);
    return null;
  }
}

function updateSpiCalendarEvent(rowNum, lawatanSyor) {
  try {
    if (!lawatanSyor) return;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const existingJSON = sheet.getRange(rowNum, 29).getValue() || '{}';
    let parsed = {};
    try { parsed = JSON.parse(existingJSON); } catch (e) { parsed = {}; }
    const eventId = parsed.spi_calendar_event_id;
    if (!eventId) {
      console.log(`[SPI Calendar] Tiada event ID untuk row ${rowNum}, skip update`);
      return;
    }
    const cal = CalendarApp.getCalendarById(SPI_CALENDAR_ID);
    if (!cal) return;
    const event = cal.getEventById(eventId);
    if (!event) {
      console.log(`[SPI Calendar] Event ${eventId} tidak dijumpai untuk row ${rowNum}`);
      return;
    }
    const existingDesc = event.getDescription() || '';
    const updatedDesc = existingDesc + `\nPKA Siap: ${lawatanSyor}`;
    event.setDescription(updatedDesc);
    event.setColor('2');
    console.log(`[SPI Calendar] Event updated for row ${rowNum} with PKA siap: ${lawatanSyor}`);
  } catch (e) {
    console.error(`[SPI Calendar] Gagal update event untuk row ${rowNum}: ${e.toString()}`);
  }
}

function getSpiQueueData(email) {
  try {
    const accessCheck = verifyUserAccess(email, [ROLE_ADMIN, ROLE_PENGESYOR, ROLE_PELULUS, ROLE_PENGARAH, ROLE_KETUA_SEKSYEN, ROLE_PKA]);
    if (!accessCheck.isAuthorized) {
      return createJSONOutput({ success: false, error: accessCheck.error });
    }
    const isPengesyor = accessCheck.userProfile && accessCheck.userProfile.role === ROLE_PENGESYOR;
    const pengesyorName = isPengesyor ? accessCheck.userProfile.name : '';
    
    // KACHE: Data timeline SPI dikira dalaman (tanpa tapisan pengesyor) dan
    // disimpan mengikut versi data. Jika versi sama (tiada perubahan), guna cache.
    const props = PropertiesService.getScriptProperties();
    const cacheKey = 'SPI_QUEUE_RAW_' + (props.getProperty(APP_DATA_VERSION_KEY) || '0');
    const cache = CacheService.getScriptCache();
    const cachedRaw = cache.get(cacheKey);
    let result;
    if (cachedRaw) {
      result = JSON.parse(cachedRaw);
    } else {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_NAME);
      const rows = sheet.getDataRange().getDisplayValues();
      result = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const syorLawatan = (r[8] || '').toString().toUpperCase();
        if (syorLawatan !== 'YA') continue;
        if (r[8] && r[8].toString().toUpperCase() === 'PEMUTIHAN') continue;
        const statusSpi = (r[15] || '').toString().trim();
        if (statusSpi === '') continue;
        const lawatanSyor = (r[19] || '').toString().trim();
        const kelulusan = (r[23] || '').toString().trim();
        // Sembunyikan dari timeline jika sudah ada kelulusan pelulus (mana-mana keputusan: LULUS/TOLAK/SIASAT)
        if (kelulusan !== '') continue;
        const eventId = (() => {
          try {
            const j = JSON.parse(r[28] || '{}');
            return j.spi_calendar_event_id || '';
          } catch (e) { return ''; }
        })();
        let deadline = '';
        let bakiHari = -1;
        let hariLewat = 0;
        let progressPct = 0;
        const ds = r[9] ? r[9].toString().trim() : '';
        if (ds) {
          try {
            const d = new Date(ds);
            if (!isNaN(d.getTime())) {
              const dd = addWorkingDays(d, 14);
              deadline = Utilities.formatDate(dd, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
              const today = new Date();
              today.setHours(0,0,0,0);
              const elapsed = countWorkingDays(d, today);
              progressPct = Math.min(Math.round((elapsed / 14) * 100), 100);
              if (dd >= today && !lawatanSyor) {
                bakiHari = countWorkingDays(today, dd);
              } else if (dd < today && !lawatanSyor) {
                bakiHari = 0;
                hariLewat = countWorkingDays(dd, today);
              }
            }
          } catch (ex) {}
        }
        result.push({
          row: i + 1,
          syarikat: r[0] || '',
          cidb: r[1] || '',
          gred: r[2] || '',
          jenis: r[3] || '',
          pengesyor: r[12] || '',
          date_submit: r[9] || '',
          deadline: deadline,
          baki_hari: bakiHari,
          hari_lewat: hariLewat,
          progress_pct: progressPct,
          status_hantar_spi: statusSpi,
          tarikh_hantar_spi: r[16] || '',
          lawatan_syor: lawatanSyor,
          kelulusan: kelulusan,
          event_id: eventId
        });
      }
      cache.put(cacheKey, JSON.stringify(result), 600); // TTL 10 minit
    }
    
    // Tapisan pengesyor dilakukan per-permintaan ke atas data cache
    let data = result;
    if (isPengesyor) {
      const nameUpper = pengesyorName.toUpperCase();
      data = result.filter(x => (x.pengesyor || '').toString().toUpperCase() === nameUpper);
    }
    return createJSONOutput({ success: true, data: data });
  } catch (e) {
    return createJSONOutput({ success: false, error: e.toString() });
  }
}

function checkOverdueSPI() {
  try {
    const today = new Date();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const rows = sheet.getDataRange().getDisplayValues();
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const syorLawatan = (r[8] || '').toString().toUpperCase();
      if (syorLawatan !== 'YA') continue;
      const syorStatus = (r[13] || '').toString().trim();
      if (syorStatus !== '') continue;
      const statusSpi = (r[15] || '').toString().trim();
      if (statusSpi === '') continue;
      const dateSubmit = (r[9] || '').toString().trim();
      if (!dateSubmit) continue;
      const lawatanSyor = (r[19] || '').toString().trim();
      if (lawatanSyor !== '') continue;
      const submitDate = new Date(dateSubmit);
      if (isNaN(submitDate.getTime())) continue;
      const deadline = addWorkingDays(submitDate, 14);
      if (today >= deadline) {
        count++;
      }
    }
    console.log(`[SPI Calendar] Overdue check selesai: ${count} notifikasi dihantar`);
    return createJSONOutput({ success: true, count: count });
  } catch (e) {
    console.error(`[SPI Calendar] Ralat checkOverdueSPI: ${e.toString()}`);
    return createJSONOutput({ success: false, error: e.toString() });
  }
}

function sendSpiDeadlineReminder() {
  try {
    const props = PropertiesService.getScriptProperties();
    const todayStr = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');

    // Hanya hantar pada hari bekerja (bukan hujung minggu/cuti umum Putrajaya)
    if (!isHariBekerja(new Date())) {
      console.log(`[SPI Deadline] ${todayStr} bukan hari bekerja, skip.`);
      return createJSONOutput({ success: true, count: 0, skipped: true });
    }

    const lastSent = props.getProperty('SPI_DEADLINE_REMINDER_DATE');
    if (lastSent === todayStr) {
      console.log(`[SPI Deadline] Reminder sudah dihantar hari ini (${todayStr}), skip.`);
      return createJSONOutput({ success: true, count: 0, skipped: true });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const rows = sheet.getDataRange().getDisplayValues();
    const reminders = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const syorLawatan = (r[8] || '').toString().toUpperCase();
      if (syorLawatan !== 'YA') continue;
      const syorStatus = (r[13] || '').toString().trim();
      if (syorStatus !== '') continue;
      const statusSpi = (r[15] || '').toString().trim();
      if (statusSpi === '') continue;
      const dateSubmit = (r[9] || '').toString().trim();
      if (!dateSubmit) continue;
      const lawatanSyor = (r[19] || '').toString().trim();
      if (lawatanSyor !== '') continue;
      const submitDate = new Date(dateSubmit);
      if (isNaN(submitDate.getTime())) continue;
      const deadline = addWorkingDays(submitDate, 14);
      const deadlineStr = Utilities.formatDate(deadline, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
      if (deadlineStr === todayStr) {
        reminders.push({
          row: i + 1,
          syarikat: r[0] || '',
          cidb: r[1] || '',
          jenis: r[3] || '',
          pengesyor: r[12] || '',
          date_submit: dateSubmit,
          deadline: deadlineStr
        });
      }
    }

    if (reminders.length === 0) {
      console.log(`[SPI Deadline] Tiada permohonan yang deadline hari ini (${todayStr}).`);
      return createJSONOutput({ success: true, count: 0 });
    }

    let rowsHtml = '';
    let textList = '';
    reminders.forEach((d, idx) => {
      rowsHtml += `<tr>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${idx + 1}</td>
        <td style="padding:10px;border:1px solid #ddd;"><strong>${d.syarikat}</strong></td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.cidb || '-'}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.jenis || '-'}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.date_submit}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;font-weight:700;color:#ef4444;">${d.deadline}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.pengesyor || '-'}</td>
      </tr>`;
      textList += `${idx + 1}. ${d.syarikat} (CIDB: ${d.cidb || '-'}) | ${d.jenis || '-'} | Hantar: ${d.date_submit} | Deadline: ${d.deadline} | Pengesyor: ${d.pengesyor || '-'}\n`;
    });

    const subject = `⚠️ TINDAKAN SEGERA: ${reminders.length} Permohonan SPI Mencapai Deadline Hari Ini`;
    const htmlBody = `<!DOCTYPE html>
<html>
<head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}
  .container{max-width:800px;margin:0 auto;padding:20px;}
  .header{background:#ef4444;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0;}
  .content{background:#f9f9f9;padding:20px;border:1px solid #ddd;border-top:none;}
  .footer{margin-top:20px;padding-top:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #ddd;}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h2 style="margin:0;">⚠️ PERINGATAN DEADLINE SPI</h2>
    <p style="margin:5px 0 0;">${todayStr}</p>
  </div>
  <div class="content">
    <p>Tuan/Puan,</p>
    <p>Berikut adalah <strong>${reminders.length} permohonan SPI</strong> yang mencapai tarikh deadline (<strong>14 hari bekerja</strong>) pada hari ini. Sila ambil tindakan PKA segera.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;background:white;">
      <thead style="background:#f1f5f9;color:#1e293b;">
        <tr>
          <th style="padding:10px;border:1px solid #ddd;">Bil</th>
          <th style="padding:10px;border:1px solid #ddd;">Syarikat</th>
          <th style="padding:10px;border:1px solid #ddd;">CIDB</th>
          <th style="padding:10px;border:1px solid #ddd;">Jenis</th>
          <th style="padding:10px;border:1px solid #ddd;">Tarikh Hantar</th>
          <th style="padding:10px;border:1px solid #ddd;">Deadline</th>
          <th style="padding:10px;border:1px solid #ddd;">Pengesyor</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="margin-top:20px;"><em>*** Emel ini dijana secara automatik. Sila jangan balas emel ini. ***</em></p>
  </div>
  <div class="footer">
    <p>Sistem Bersepadu SPTB<br>© ${new Date().getFullYear()} KUSKOP. Hak Cipta Terpelihara.</p>
    <p>Dijana pada: ${new Date().toLocaleString('ms-MY')}</p>
  </div>
</div>
</body>
</html>`;

    const plainBody = `PERINGATAN DEADLINE SPI\n\n${reminders.length} permohonan SPI mencapai deadline hari ini (${todayStr}):\n\n${textList}\n*** Emel automatik oleh Sistem STB ***`;

    MailApp.sendEmail({
      to: getEmailToSPI(),
      cc: getEmailCcSPTB(),
      subject: subject,
      htmlBody: htmlBody,
      body: plainBody,
      name: EMAIL_SENDER_NAME
    });

    props.setProperty('SPI_DEADLINE_REMINDER_DATE', todayStr);
    logActivity('System', 'SPI_DEADLINE_REMINDER', `${reminders.length} permohonan deadline hari ini diemelkan.`, '');
    console.log(`[SPI Deadline] Berjaya hantar reminder untuk ${reminders.length} permohonan.`);
    return createJSONOutput({ success: true, count: reminders.length });
  } catch (e) {
    console.error(`[SPI Deadline] Ralat: ${e.toString()}`);
    return createJSONOutput({ success: false, error: e.toString() });
  }
}

function authorizeCalendar() {
  const cal = CalendarApp.getCalendarById(SPI_CALENDAR_ID);
  if (cal) {
    console.log('✅ Kalendar dijumpai: ' + cal.getName());
  } else {
    console.log('❌ Kalendar ' + SPI_CALENDAR_ID + ' tidak dijumpai');
  }
}

function testSpiBacklogReminder() {
  const result = getSpiBacklogData();
  const data = JSON.parse(result.getContent());
  if (!data.success || !data.count) {
    console.log('[Test Backlog] Tiada backlog.');
    return;
  }
  const items = data.data;
  let rowsHtml = '';
  items.forEach((d, idx) => {
    rowsHtml += `<tr>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${idx + 1}</td>
      <td style="padding:10px;border:1px solid #ddd;"><strong>${d.syarikat}</strong></td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.cidb || '-'}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.jenis || '-'}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.date_submit}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;font-weight:700;color:#991b1b;">${d.deadline}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.pengesyor || '-'}</td>
    </tr>`;
  });
  const html = `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}
  .container{max-width:800px;margin:0 auto;padding:20px;}
  .header{background:#991b1b;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0;}
  .content{background:#f9f9f9;padding:20px;border:1px solid #ddd;border-top:none;}
  .footer{margin-top:20px;padding-top:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #ddd;}
</style></head>
<body><div class="container">
  <div class="header"><h2 style="margin:0;">🔴 TEST BACKLOG SPI</h2><p style="margin:5px 0 0;">${items.length} backlog — TEST sahaja</p></div>
  <div class="content">
    <p>TEST: Berikut adalah ${items.length} permohonan backlog.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;background:white;">
      <thead style="background:#f1f5f9;color:#1e293b;"><tr>
        <th style="padding:10px;border:1px solid #ddd;">Bil</th>
        <th style="padding:10px;border:1px solid #ddd;">Syarikat</th>
        <th style="padding:10px;border:1px solid #ddd;">CIDB</th>
        <th style="padding:10px;border:1px solid #ddd;">Jenis</th>
        <th style="padding:10px;border:1px solid #ddd;">Tarikh Hantar</th>
        <th style="padding:10px;border:1px solid #ddd;">Deadline</th>
        <th style="padding:10px;border:1px solid #ddd;">Pengesyor</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p><em>*** TEST — BUKAN emel sebenar ***</em></p>
  </div>
  <div class="footer"><p>Sistem Bersepadu SPTB</p></div>
</div></body></html>`;
  MailApp.sendEmail({
    to: 'zariff.zainudin@kuskop.gov.my',
    subject: `[TEST] Backlog SPI: ${items.length} Permohonan`,
    htmlBody: html,
    name: EMAIL_SENDER_NAME
  });
  console.log(`[Test Backlog] Emel test dihantar ke zariff.zainudin@kuskop.gov.my untuk ${items.length} backlog.`);
}

function testSpiDeadlineReminder() {
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getDisplayValues();
  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if ((r[8]||'').toString().toUpperCase() !== 'YA') continue;
    if ((r[13]||'').toString().trim() !== '') continue;
    if ((r[15]||'').toString().trim() === '') continue;
    if (!(r[9]||'').toString().trim()) continue;
    if ((r[19]||'').toString().trim() !== '') continue;
    const sd = new Date(r[9]);
    if (isNaN(sd.getTime())) continue;
    const dl = addWorkingDays(sd, 14);
    const dls = Utilities.formatDate(dl, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
    if (dls === todayStr) {
      items.push({ row: i+1, syarikat: r[0]||'', cidb: r[1]||'', jenis: r[3]||'', pengesyor: r[12]||'', date_submit: r[9], deadline: dls });
    }
  }
  if (!items.length) { console.log('[Test Deadline] Tiada deadline hari ini.'); return; }
  let rowsHtml = '';
  items.forEach((d, idx) => {
    rowsHtml += `<tr>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${idx+1}</td>
      <td style="padding:10px;border:1px solid #ddd;"><strong>${d.syarikat}</strong></td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.cidb||'-'}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.jenis||'-'}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.date_submit}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;font-weight:700;color:#ef4444;">${d.deadline}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.pengesyor||'-'}</td>
    </tr>`;
  });
  const html = `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}
  .container{max-width:800px;margin:0 auto;padding:20px;}
  .header{background:#ef4444;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0;}
  .content{background:#f9f9f9;padding:20px;border:1px solid #ddd;border-top:none;}
  .footer{margin-top:20px;padding-top:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #ddd;}
</style></head>
<body><div class="container">
  <div class="header"><h2 style="margin:0;">⚠️ TEST DEADLINE SPI</h2><p style="margin:5px 0 0;">${todayStr} — TEST sahaja</p></div>
  <div class="content">
    <p>TEST: ${items.length} permohonan deadline hari ini.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;background:white;">
      <thead style="background:#f1f5f9;color:#1e293b;"><tr>
        <th style="padding:10px;border:1px solid #ddd;">Bil</th>
        <th style="padding:10px;border:1px solid #ddd;">Syarikat</th>
        <th style="padding:10px;border:1px solid #ddd;">CIDB</th>
        <th style="padding:10px;border:1px solid #ddd;">Jenis</th>
        <th style="padding:10px;border:1px solid #ddd;">Hantar</th>
        <th style="padding:10px;border:1px solid #ddd;">Deadline</th>
        <th style="padding:10px;border:1px solid #ddd;">Pengesyor</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p><em>*** TEST — BUKAN emel sebenar ***</em></p>
  </div>
  <div class="footer"><p>Sistem Bersepadu SPTB</p></div>
</div></body></html>`;
  MailApp.sendEmail({
    to: 'zariff.zainudin@kuskop.gov.my',
    subject: `[TEST] Deadline SPI: ${items.length} Permohonan Hari Ini`,
    htmlBody: html,
    name: EMAIL_SENDER_NAME
  });
  console.log(`[Test Deadline] Emel test dihantar ke zariff.zainudin@kuskop.gov.my.`);
}

function getSpiBacklogData() {
  try {
    const today = new Date();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const rows = sheet.getDataRange().getDisplayValues();
    const items = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const syorLawatan = (r[8] || '').toString().toUpperCase();
      if (syorLawatan !== 'YA') continue;
      const syorStatus = (r[13] || '').toString().trim();
      if (syorStatus !== '') continue;
      const statusSpi = (r[15] || '').toString().trim();
      if (statusSpi === '') continue;
      const dateSubmit = (r[9] || '').toString().trim();
      if (!dateSubmit) continue;
      const lawatanSyor = (r[19] || '').toString().trim();
      if (lawatanSyor !== '') continue;
      const submitDate = new Date(dateSubmit);
      if (isNaN(submitDate.getTime())) continue;
      const deadline = addWorkingDays(submitDate, 14);
      const deadlineDate = new Date(deadline);
      deadlineDate.setHours(0,0,0,0);
      const todayClone = new Date(today);
      todayClone.setHours(0,0,0,0);
      if (deadlineDate < todayClone) {
        const deadlineStr = Utilities.formatDate(deadline, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
        items.push({
          row: i + 1,
          syarikat: r[0] || '',
          cidb: r[1] || '',
          jenis: r[3] || '',
          pengesyor: r[12] || '',
          date_submit: dateSubmit,
          deadline: deadlineStr
        });
      }
    }

    return createJSONOutput({ success: true, count: items.length, data: items });
  } catch (e) {
    return createJSONOutput({ success: false, error: e.toString() });
  }
}

function sendSpiBacklogReminder() {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('SPI_BACKLOG_REMINDER_SENT') === 'true') {
      console.log('[SPI Backlog] Reminder backlog sudah dihantar, skip.');
      return createJSONOutput({ success: true, count: 0, skipped: true });
    }
    const today = new Date();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const rows = sheet.getDataRange().getDisplayValues();
    const items = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const syorLawatan = (r[8] || '').toString().toUpperCase();
      if (syorLawatan !== 'YA') continue;
      const syorStatus = (r[13] || '').toString().trim();
      if (syorStatus !== '') continue;
      const statusSpi = (r[15] || '').toString().trim();
      if (statusSpi === '') continue;
      const dateSubmit = (r[9] || '').toString().trim();
      if (!dateSubmit) continue;
      const lawatanSyor = (r[19] || '').toString().trim();
      if (lawatanSyor !== '') continue;
      const submitDate = new Date(dateSubmit);
      if (isNaN(submitDate.getTime())) continue;
      const deadline = addWorkingDays(submitDate, 14);
      const deadlineDate = new Date(deadline);
      deadlineDate.setHours(0,0,0,0);
      const todayClone = new Date(today);
      todayClone.setHours(0,0,0,0);
      if (deadlineDate < todayClone) {
        const deadlineStr = Utilities.formatDate(deadline, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
        items.push({
          row: i + 1,
          syarikat: r[0] || '',
          cidb: r[1] || '',
          jenis: r[3] || '',
          pengesyor: r[12] || '',
          date_submit: dateSubmit,
          deadline: deadlineStr
        });
      }
    }

    if (items.length === 0) {
      console.log('[SPI Backlog] Tiada backlog.');
      return createJSONOutput({ success: true, count: 0 });
    }

    let rowsHtml = '';
    let textList = '';
    items.forEach((d, idx) => {
      rowsHtml += `<tr>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${idx + 1}</td>
        <td style="padding:10px;border:1px solid #ddd;"><strong>${d.syarikat}</strong></td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.cidb || '-'}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.jenis || '-'}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.date_submit}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;font-weight:700;color:#991b1b;">${d.deadline}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${d.pengesyor || '-'}</td>
      </tr>`;
      textList += `${idx + 1}. ${d.syarikat} (CIDB: ${d.cidb || '-'}) | ${d.jenis || '-'} | Hantar: ${d.date_submit} | Deadline: ${d.deadline} | Pengesyor: ${d.pengesyor || '-'}\n`;
    });

    const subject = `🔴 TINDAKAN: ${items.length} Permohonan SPI Melebihi Deadline (Backlog)`;
    const htmlBody = `<!DOCTYPE html>
<html>
<head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}
  .container{max-width:800px;margin:0 auto;padding:20px;}
  .header{background:#991b1b;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0;}
  .content{background:#f9f9f9;padding:20px;border:1px solid #ddd;border-top:none;}
  .footer{margin-top:20px;padding-top:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #ddd;}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h2 style="margin:0;">🔴 BACKLOG PERMOHONAN SPI</h2>
    <p style="margin:5px 0 0;">Melebihi 14 hari bekerja — ${new Date().toLocaleDateString('ms-MY')}</p>
  </div>
  <div class="content">
    <p>Tuan/Puan,</p>
    <p>Berikut adalah <strong>${items.length} permohonan SPI</strong> yang telah melebihi tempoh 14 hari bekerja dan masih belum diisi keputusan PKA / syor_status pengesyor.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;background:white;">
      <thead style="background:#f1f5f9;color:#1e293b;">
        <tr>
          <th style="padding:10px;border:1px solid #ddd;">Bil</th>
          <th style="padding:10px;border:1px solid #ddd;">Syarikat</th>
          <th style="padding:10px;border:1px solid #ddd;">CIDB</th>
          <th style="padding:10px;border:1px solid #ddd;">Jenis</th>
          <th style="padding:10px;border:1px solid #ddd;">Tarikh Hantar</th>
          <th style="padding:10px;border:1px solid #ddd;">Deadline</th>
          <th style="padding:10px;border:1px solid #ddd;">Pengesyor</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p><em>*** Ini adalah notifikasi backlog satu kali. Notifikasi seterusnya hanya untuk deadline harian. ***</em></p>
  </div>
  <div class="footer">
    <p>Sistem Bersepadu SPTB<br>© ${new Date().getFullYear()} KUSKOP. Hak Cipta Terpelihara.</p>
    <p>Dijana pada: ${new Date().toLocaleString('ms-MY')}</p>
  </div>
</div>
</body>
</html>`;

    const plainBody = `BACKLOG PERMOHONAN SPI\n\n${items.length} permohonan melebihi deadline:\n\n${textList}\n*** Notifikasi backlog satu kali oleh Sistem STB ***`;

    MailApp.sendEmail({
      to: getEmailToSPI(),
      cc: getEmailCcSPTB(),
      subject: subject,
      htmlBody: htmlBody,
      body: plainBody,
      name: EMAIL_SENDER_NAME
    });

    props.setProperty('SPI_BACKLOG_REMINDER_SENT', 'true');
    logActivity('System', 'SPI_BACKLOG_REMINDER', `${items.length} permohonan backlog diemelkan.`, '');
    console.log(`[SPI Backlog] Berjaya hantar untuk ${items.length} backlog.`);
    return createJSONOutput({ success: true, count: items.length });
  } catch (e) {
    console.error(`[SPI Backlog] Ralat: ${e.toString()}`);
    return createJSONOutput({ success: false, error: e.toString() });
  }
}

function setupSpiOverdueCron() {
  try {
    ['checkOverdueSPI','sendSpiDeadlineReminder'].forEach(fn => {
      ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === fn).forEach(t => ScriptApp.deleteTrigger(t));
      ScriptApp.newTrigger(fn).timeBased().everyDays(1).atHour(9).create();
    });
    console.log('✅ Cron SPI overdue + deadline reminder ditetapkan setiap hari jam 9 pagi.');
    return createJSONOutput({ success: true, message: 'Cron SPI + deadline reminder ditetapkan' });
  } catch (e) {
    return createJSONOutput({ success: false, error: e.toString() });
  }
}
