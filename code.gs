// Tentukan nama Tab Sheet anda
const SHEET_NAME = "Sheet1";
const USERS_SHEET_NAME = "Users";
const LOGS_SHEET_NAME = "Logs";
const CHANGELOG_SHEET_NAME = "Changelog";
const USER_META_SHEET_NAME = "UserMeta"; // V6.6.0

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
// Nama property: DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, YOUTUBE_API_KEY

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "tencent/hy3-preview:free";

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

// Email recipients for SPI notifications - disimpan di Script Properties
// Key: EMAIL_TO_SPI, EMAIL_CC_SPTB

// Nama penghantar emel
const EMAIL_SENDER_NAME = "Sistem Bersepadu SPTB";

// =========================================================================
// V6.5.0: FUNGSI MIDDLEWARE PENGESAHAN (VERIFICATION)
// =========================================================================

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
    
    // Cari profil pengguna dari Sheet 'Users'
    const userProfile = findUserByEmail(authResult.email);
    if (!userProfile) {
      return {
        isAuthorized: false,
        userProfile: null,
        error: 'Akses Ditolak: Pengguna tidak berdaftar dalam sistem.'
      };
    }
    
    // Semak role pengguna
    const userRole = userProfile.role ? userProfile.role.toUpperCase() : '';
    if (!allowedRolesArray.includes(userRole)) {
      return {
        isAuthorized: false,
        userProfile: userProfile,
        error: `Akses Ditolak: Role '${userRole}' tidak mempunyai kebenaran untuk tindakan ini.`
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
    // Cari indeks untuk gambar/profile
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
    
    // Cari profil pengguna dari Sheet 'Users'
    const userProfile = findUserByEmail(authResult.email);

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
    
    // V6.6.0: Handler untuk getChangelog (public - tiada auth diperlukan)
    if (action === "getChangelog") {
      return handleGetChangelog();
    }
    
    // V6.5.0: Handler untuk getQueueData
    if (action === "getQueueData") {
      if (!email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan untuk akses queue data." });
      }
      const accessCheck = verifyUserAccess(email, [ROLE_ADMIN, ROLE_PENGESYOR, ROLE_PELULUS]);
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

    // V6.6.0: Handler untuk getInbox
    if (action === "getInbox") {
      return handleGetInbox(e.parameter);
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
    } else if (action === "getStats") {
      result = getStatisticsData(role, userName);
    } else if (action === "getRepeatedApplications") {
      result = getRepeatedApplicationsData();
    } else if (action === "refreshData") {
      // V6.6.0: Paksa refresh dengan increment version
      invalidateDataCache();
      result = getApplicationsData(role, userName, '');
    } else if (action === "getRow") {
      const rowNum = parseInt(e.parameter.row);
      result = getSingleRowData(rowNum);
    } else {
      result = getApplicationsData(role, userName, clientVersion);
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
    const noLockActions = ['checkAuth', 'searchYoutube', 'processAI', 'cetak_dan_simpan_pdf', 'getUserLastSeenVersion', 'updateUserLastSeenVersion', 'refreshData', 'getInbox', 'deleteInbox', 'markInboxRead', 'scheduleWhatsApp', 'listDriveFiles', 'pkaGetPengesyorContact'];
    
    // 3. Hanya lock jika ia adalah operasi menulis (write) ke dalam Google Sheet
    if (!noLockActions.includes(data.action)) {
      lock.waitLock(28000);
      locked = true;
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return createJSONOutput({ status: "error", message: "Sheet not found" });
    }
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
    
    // =====================================================================
    // V6.4.8: HANDLER BAHARU UNTUK AI PROCESSING (BACKEND)
    // V6.5.0: Menambah pengesahan pengguna berdaftar
    // =====================================================================
    if (data.action === 'processAI') {
      // Semak pengesahan untuk AI processing
      if (!data.email) {
        return createJSONOutput({ success: false, error: "Email diperlukan untuk AI processing." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ success: false, error: accessCheck.error });
      }
      return handleProcessAI(data);
    }
    
    // Handler untuk dapatkan log
    if (data.action === 'getLogs') {
      return handleGetLogs();
    }
    
    // Handler untuk padam rekod
    if (data.action === 'deleteRecord') {
      // V6.5.0: Pengesahan ketat untuk deleteRecord
      return handleDeleteRecord(data, sheet);
    }
    
    // Handler untuk restore rekod dari snapshot
    if (data.action === 'restoreRecord') {
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
    
    // Handler khas: Log Aktiviti
    if (data.action === 'logActivity') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan untuk log aktiviti." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      logActivity(data.user, data.actionType, data.description, data.folderId);
      return createJSONOutput({ status: "success", message: "Activity logged" });
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
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ success: false, error: accessCheck.error });
      }
      return handleUploadDriveFile(data);
    }
    
    // V6.7.0: Handler untuk deleteDriveFile
    if (data.action === 'deleteDriveFile') {
      if (!data.email) {
        return createJSONOutput({ success: false, error: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
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
    
    // V6.6.0: Handler untuk scheduleWhatsApp
    if (data.action === 'scheduleWhatsApp') {
      if (!data.email) {
        return createJSONOutput({ status: "error", message: "Email diperlukan." });
      }
      const accessCheck = verifyUserAccess(data.email, [ROLE_PENGESYOR, ROLE_ADMIN]);
      if (!accessCheck.isAuthorized) {
        return createJSONOutput({ status: "error", message: accessCheck.error });
      }
      const result = scheduleWhatsApp(data);
      return createJSONOutput(result);
    }
    
    // V6.6.0: Handler untuk getInbox
    if (data.action === 'getInbox') {
      return handleGetInbox(data);
    }
    
    // V6.6.0: Handler untuk deleteInbox
    if (data.action === 'deleteInbox') {
      return handleDeleteInbox(data);
    }
    
    // V6.6.0: Handler untuk markInboxRead
    if (data.action === 'markInboxRead') {
      return handleMarkInboxRead(data);
    }
    
    // V6.6.0: Handler untuk markAllInboxRead & deleteAllInbox
    if (data.action === 'markAllInboxRead') {
      return handleMarkAllInboxRead(data);
    }
    if (data.action === 'deleteAllInbox') {
      return handleDeleteAllInbox(data);
    }
    
    // V6.6.0: Handler untuk user version tracking
    if (data.action === 'getUserLastSeenVersion') {
      return handleGetUserLastSeenVersion(data.email);
    }
    if (data.action === 'updateUserLastSeenVersion') {
      return handleUpdateUserLastSeenVersion(data.email, data.version);
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

// =========================================================================
// V6.4.8: FUNGSI HANDLER AI PROCESSING (BACKEND)
// V6.5.0: Pengesahan dilakukan di doPost sebelum memanggil fungsi ini
// =========================================================================

/**
 * Fungsi handleProcessAI: Mengendalikan permintaan AI processing dari frontend
 * Menerima teks PDF dan jenis prompt (borang/profile), menghantar ke API AI
 * dengan 3-Tier Fallback (DeepSeek -> Gemini -> OpenRouter)
 */
function handleProcessAI(data) {
  try {
    const promptType = data.type || 'borang';
    const pdfText = data.text || '';
    const selectedModel = data.model || 'auto'; // <-- TERIMA PILIHAN MODEL
    
    if (!pdfText || pdfText.trim() === '') {
      return createJSONOutput({
        success: false,
        error: "Teks PDF kosong. Tiada data untuk diproses."
      });
    }
    
    Logger.log(`[V6.5.0] AI Processing diminta untuk jenis: ${promptType}, Model: ${selectedModel}, panjang teks: ${pdfText.length}`);
    
    // Hantar model yang dipilih ke fungsi utama
    const result = processWithAI(pdfText, promptType, selectedModel);

    // ---> KESILAPAN DI SINI: Tertinggal statement IF <---
    if (result.success && result.data) {
      
      Logger.log(`[V6.5.0] AI Processing berjaya untuk ${promptType}`);
      return createJSONOutput({
        success: true,
        data: result.data,
        provider: result.provider,
        message: `Data berjaya diekstrak menggunakan ${result.provider}`
      });

    } else {
      Logger.log(`[V6.5.0] AI Processing gagal: ${result.error}`);

      return createJSONOutput({
        success: false,
        error: result.error || "Gagal mengekstrak data dari AI",
        provider: result.provider || 'none'
      });
    }
    
  } catch (error) {
    Logger.log(`[V6.5.0] Ralat dalam handleProcessAI: ${error.toString()}`);

    return createJSONOutput({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * Fungsi processWithAI: Memproses teks dengan AI menggunakan 3-Tier Fallback
 */
function processWithAI(pdfText, promptType, selectedModel = 'auto') {
  // 1. Bersihkan teks: Tukar semua baris baru (\n), tab (\t) dan double-space menjadi satu jarak sahaja
  let cleanedText = pdfText.replace(/\s+/g, ' ').trim();
  
  // 2. Kurangkan had maksimum aksara (Sebab teks dah padat, 15,000 aksara sudah sangat banyak)
  const maxTextLength = 15000; 
  
  const truncatedText = cleanedText.length > maxTextLength 
    ? cleanedText.substring(0, maxTextLength)
    : cleanedText;
  
  // Bina prompt berdasarkan jenis
  let prompt;
  let processResponseFn;
  
  if (promptType === 'profile') {
    prompt = buildProfilePrompt(truncatedText);
    processResponseFn = processProfileResponse;
  } else {
    prompt = buildBorangPrompt(truncatedText);
    processResponseFn = processBorangResponse;
  }
  
  // JIKA PENGGUNA PILIH MODEL SPESIFIK (TIADA FALLBACK)
  if (selectedModel === 'deepseek') {
    Logger.log(`[V6.5.0] AI Processing: Menggunakan DeepSeek SAHAJA`);
    try {
      const deepseekResult = callDeepSeekAPI(prompt);
      if (deepseekResult) return { success: true, data: processResponseFn(deepseekResult), provider: 'DeepSeek', error: null };
    } catch (error) {
      return { success: false, data: null, provider: 'DeepSeek', error: "DeepSeek API Ralat: " + error.toString() };
    }
  } 
  else if (selectedModel === 'gemini') {
    Logger.log(`[V6.5.0] AI Processing: Menggunakan Gemini SAHAJA`);
    try {
      const geminiResult = callGeminiAPI(prompt);
      if (geminiResult) return { success: true, data: processResponseFn(geminiResult), provider: 'Gemini', error: null };
    } catch (error) {
      return { success: false, data: null, provider: 'Gemini', error: "Gemini API Ralat: " + error.toString() };
    }
  }
  else if (selectedModel === 'openrouter') {
    Logger.log(`[V6.5.0] AI Processing: Menggunakan OpenRouter SAHAJA`);
    try {
      const openRouterResult = callOpenRouterAPI(prompt);
      if (openRouterResult) return { success: true, data: processResponseFn(openRouterResult), provider: 'OpenRouter', error: null };
    } catch (error) {
      return { success: false, data: null, provider: 'OpenRouter', error: "OpenRouter API Ralat: " + error.toString() };
    }
  }
  
  // JIKA PENGGUNA PILIH 'AUTO' (KEKALKAN 3-TIER FALLBACK LAMA)
  Logger.log(`[V6.5.0] 3-Tier Fallback Auto: Mencuba DeepSeek...`);
  
  // Tier 1: DeepSeek
  try {
    const deepseekResult = callDeepSeekAPI(prompt);
    if (deepseekResult) {
      const processedData = processResponseFn(deepseekResult);
      return { success: true, data: processedData, provider: 'DeepSeek (Auto)', error: null };
    }
  } catch (error) {
    Logger.log(`[V6.5.0] DeepSeek gagal: ${error.toString()}. Mencuba Gemini...`);
  }
  
  // Tier 2: Gemini (Backup 1)
  try {
    const geminiResult = callGeminiAPI(prompt);
    if (geminiResult) {
      const processedData = processResponseFn(geminiResult);
      return { success: true, data: processedData, provider: 'Gemini (Auto)', error: null };
    }
  } catch (error) {
    Logger.log(`[V6.5.0] Gemini gagal: ${error.toString()}. Mencuba OpenRouter...`);
  }
  
  // Tier 3: OpenRouter (Backup 2)
  try {
    const openRouterResult = callOpenRouterAPI(prompt);
    if (openRouterResult) {
      const processedData = processResponseFn(openRouterResult);
      return { success: true, data: processedData, provider: 'OpenRouter (Auto)', error: null };
    }
  } catch (error) {
    Logger.log(`[V6.5.0] OpenRouter gagal: ${error.toString()}. Semua API gagal.`);
  }
  
  // Jika semua gagal
  return { 
    success: false, 
    data: null, 
    provider: 'none', 
    error: "Ketiga-tiga API AI (DeepSeek, Gemini, OpenRouter) gagal memproses teks."
  };
}
// =========================================================================
// V6.4.8: FUNGSI PEMBINA PROMPT UNTUK AI
// =========================================================================

function buildBorangPrompt(truncatedText) {
  return `Return JSON ONLY matching this schema. No extra text, conversational prose or markdown wrap (except codeblock).
  {
    "companyName": "Exact Company Name",
    "cidbNumber": "Exact CIDB number, e.g. 0120201118-KD061300. Do not guess.",
    "grade": "First G1-G7 found",
    "spkkDuration": "DD/MM/YYYY - DD/MM/YYYY format or ''",
    "stbDuration": "DD/MM/YYYY - DD/MM/YYYY format or ''",
    "directors": ["Array of names only"],
    "shareholders": ["Array of names only"],
    "checkSignatories": ["Array of names only"],
    "spkkNominees": ["Array of names only"],
    "phoneNumbers": ["Pejabat/individus numbers only. Ignore Fax"],
    "alamatPerniagaan": "Full BUSINESS ADDRESS only or ''",
    "alamatSuratMenyurat": "Full CORRESPONDENCE ADDRESS only or ''"
  }
  IMPORTANT: Ignore REGISTERED ADDRESS. Only extract BUSINESS ADDRESS (Alamat Perniagaan) or CORRESPONDENCE ADDRESS (Alamat Surat-menyurat).
  Priority: Return BUSINESS ADDRESS as alamatPerniagaan if found. Otherwise, return CORRESPONDENCE ADDRESS as alamatSuratMenyurat.
  PDF Text: ${truncatedText}`;
}

function buildProfilePrompt(truncatedText) {
  return `Return JSON ONLY matching this schema. No conversational prose or markdown wrap (except codeblock). Use empty string "" if not found.
  {
    "applicantName": "string",
    "jawatan": "string",
    "icNumber": "string (e.g. 123456-78-9012)",
    "phoneNumber": "string (e.g. 012-3456789)",
    "email": "string",
    "companyName": "string",
    "registrationNumber": "Exact CIDB number, e.g. 0120201118-KD061300",
    "grade": "G1-G7",
    "registrationDate": "DD/MM/YYYY format",
    "jenisPendaftaran": "ROC or ROB",
    "alamatUtama": "Extract primary address",
    "labelAlamatUtama": "Exact label found for primary address (e.g. 'Alamat Berdaftar', 'Business Address', etc.)",
    "alamatSuratMenyurat": "Extract correspondence address if any",
    "noTelefonSyarikat": "string",
    "noFax": "string",
    "emailSyarikat": "string",
    "webAddress": "string"
  }
  PDF Text: ${truncatedText}`;
}

// =========================================================================
// V6.4.8: FUNGSI PANGGILAN API AI
// =========================================================================

function callDeepSeekAPI(prompt) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getScriptProp('DEEPSEEK_API_KEY')
    },
    payload: JSON.stringify({
      model: 'deepseek-v4-flash', // DIUBAH: Dikunci terus ke versi Flash yang jimat dan murah
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(DEEPSEEK_API_URL, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`DeepSeek API returned ${responseCode}: ${responseText}`);
  }
  
  const data = JSON.parse(responseText);
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from DeepSeek');
  }
  
  return data.choices[0].message.content;
}

function callGeminiAPI(prompt) {
  // 1. BUANG parameter '?key=' dari URL utama demi keselamatan & kestabilan kunci AQ.
  const url = GEMINI_API_URL; 

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 2. MASUKKAN kunci API dalam 'headers' menggunakan standard Google yang baharu
      'x-goog-api-key': getScriptProp('GEMINI_API_KEY')
    },
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`Gemini API returned ${responseCode}: ${responseText}`);
  }
  
  const data = JSON.parse(responseText);
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || 
      !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
    throw new Error('Invalid response from Gemini');
  }
  
  return data.candidates[0].content.parts[0].text;
}

function callOpenRouterAPI(prompt) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getScriptProp('OPENROUTER_API_KEY')
    },
    payload: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(OPENROUTER_API_URL, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`OpenRouter API returned ${responseCode}: ${responseText}`);
  }
  
  const data = JSON.parse(responseText);
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from OpenRouter');
  }
  
  return data.choices[0].message.content;
}

// =========================================================================
// V6.4.8: FUNGSI PEMPROSESAN RESPONS AI
// =========================================================================

function processBorangResponse(aiResponse) {
  let cleanedText = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleanedText = jsonMatch[0];
  
  const aiData = JSON.parse(cleanedText);

  const cleanList = (arr) => {
    if (!Array.isArray(arr)) return [];

    return arr.map(item => {
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'object' && item !== null) {
         return item.name || item.nama || Object.values(item)[0] || ""; 
      }
      return String(item);
    }).filter(item => item !== "");
  };
  
  let phoneNumbers = [];
  if (aiData.phoneNumbers && Array.isArray(aiData.phoneNumbers)) {
    phoneNumbers = aiData.phoneNumbers.map(p => String(p).trim()).filter(p => p !== "");
  }
  
  let grade = '';
  if (aiData.grade) {
    let gradeStr = aiData.grade.toString();

    if (gradeStr.includes(',')) {
      grade = gradeStr.split(',')[0].trim();
    } else if (gradeStr.includes(' ')) {
      grade = gradeStr.split(' ')[0].trim();
    } else {
      grade = gradeStr.trim();
    }
    const gradeMatch = grade.match(/\b(G[1-7])\b/i);

    if (gradeMatch) grade = gradeMatch[1].toUpperCase();
  }
  
  const transformedData = {
    companyName: aiData.companyName || '',
    cidbNumber: aiData.cidbNumber || '',
    grade: grade,
    spkkStartDate: '',
    spkkEndDate: '',
    stbStartDate: '',
    stbEndDate: '',
    directors: cleanList(aiData.directors),
    shareholders: cleanList(aiData.shareholders),
    spkkPersons: cleanList(aiData.spkkNominees),
    chequeSignatories: cleanList(aiData.checkSignatories),
    phoneNumbers: phoneNumbers,
    alamatPerniagaan: aiData.alamatPerniagaan || '',
    alamatSuratMenyurat: aiData.alamatSuratMenyurat || ''
  };
  
  if (aiData.spkkDuration && typeof aiData.spkkDuration === 'string' && aiData.spkkDuration.includes('-')) {
    const parts = aiData.spkkDuration.split('-');
    if (parts.length >= 2) {
      transformedData.spkkStartDate = parts[0].trim();
      transformedData.spkkEndDate = parts[1].trim();
    }
  }
  
  if (aiData.stbDuration && typeof aiData.stbDuration === 'string' && aiData.stbDuration.includes('-')) {
    const parts = aiData.stbDuration.split('-');
    if (parts.length >= 2) {
      transformedData.stbStartDate = parts[0].trim();
      transformedData.stbEndDate = parts[1].trim();
    }
  }
  
  return transformedData;
}

function processProfileResponse(aiResponse) {
  let cleanedText = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleanedText = jsonMatch[0];
  
  const aiData = JSON.parse(cleanedText);

  return {
    applicantName: aiData.applicantName || '',
    jawatan: aiData.jawatan || '',
    icNumber: aiData.icNumber || '',
    phoneNumber: aiData.phoneNumber || '',
    email: aiData.email || '',
    companyName: aiData.companyName || '',
    registrationNumber: aiData.registrationNumber || '',
    grade: aiData.grade || '',
    registrationDate: aiData.registrationDate || '',
    jenisPendaftaran: aiData.jenisPendaftaran || '',
    alamatUtama: aiData.alamatUtama || '',
    labelAlamatUtama: aiData.labelAlamatUtama || '',
    alamatSuratMenyurat: aiData.alamatSuratMenyurat || '',
    noTelefonSyarikat: aiData.noTelefonSyarikat || '',
    noFax: aiData.noFax || '',
    emailSyarikat: aiData.emailSyarikat || '',
    webAddress: aiData.webAddress || ''
  };
}

// =========================================================================
// FUNGSI SEDIA ADA
// =========================================================================

function sendAutoEmailSPI(data) {
  try {
    // Validasi data yang diperlukan
    const syarikat = data.syarikat || 'Tiada';
    const cidb = data.cidb || 'Tiada';
    const gred = data.gred || 'Tiada';
    const alamatPerniagaan = data.alamat_perniagaan || 'Tiada';
    const pengesyor = data.pengesyor || 'Tiada';
    
    // V6.4.1: Gantikan date_submit dengan jenis permohonan
    const jenisPermohonan = data.jenis || 'Tiada';
    
    // Dapatkan justifikasi (utamakan justifikasi_baru, kemudian justifikasi) dengan prefix jenis permohonan
    const justifikasi = formatJenisJustifikasi(data.jenis, data.justifikasi_baru || data.justifikasi) || 'Tiada justifikasi disediakan';
    
    // Dapatkan pautan dokumen
    const pautan = data.pautan || 'Tiada pautan';
    
    // Semak jika ini adalah permohonan pemutihan
    const isPemutihan = data.syor_lawatan && data.syor_lawatan.toString().toUpperCase() === 'PEMUTIHAN';
    
    // Bina subjek emel
    const subject = isPemutihan 
      ? `Makluman Permohonan Lawatan Premis (PEMUTIHAN) - ${syarikat}`
      : `Makluman Permohonan Lawatan Premis - ${syarikat}`;
      
    // Label tambahan untuk pemutihan dalam badan emel
    const pemutihanLabelHTML = isPemutihan ? '<span class="badge" style="background: #e74c3c; margin-left: 10px;">⚠️ PEMUTIHAN</span>' : '';
    const pemutihanText = isPemutihan ? ' (PEMUTIHAN)' : '';
    
    const pemutihanNoteHTML = isPemutihan ? '<div style="background: #fdf2f2; border-left: 4px solid #e74c3c; padding: 15px; margin: 15px 0;"><strong>⚠️ NOTIS PENTING:</strong> Permohonan ini adalah <strong>PEMUTIHAN</strong>. Sila beri perhatian sewajarnya.</div>' : '';
    const pemutihanNoteText = isPemutihan ? '\n⚠️ NOTIS PENTING: Permohonan ini adalah PEMUTIHAN. Sila beri perhatian sewajarnya.\n' : '';
    
    // Bina kandungan emel dalam format HTML yang kemas
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a73e8; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
    .info-row { display: flex; margin-bottom: 12px; padding: 8px; border-bottom: 1px solid #eee; }
    .info-label { width: 180px; font-weight: bold; color: #555; }
    .info-value { flex: 1; color: #333; }
    .justification-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .link-box { background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 15px 0; }
    .footer { margin-top: 20px; padding-top: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #ddd; }
    .badge { background: #28a745; color: white; padding: 3px 10px; border-radius: 20px; font-size: 12px; display: inline-block; }
    .gred-badge { background: #6c757d; color: white; padding: 3px 10px; border-radius: 20px; font-size: 12px; display: inline-block; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🔔 MAKLUMAN LAWATAN PREMIS${pemutihanText}</h1>
      <p style="margin: 5px 0 0 0;">Sistem Bersepadu SPTB</p>
    </div>
    
    <div class="content">
      <p>Tuan/Puan,</p>
      
      <p>Dimaklumkan bahawa satu permohonan lawatan telah <strong>DISYORKAN</strong> dan tarikh serahan kepada SPI telah ditetapkan. Butiran adalah seperti berikut:</p>
      
      ${pemutihanNoteHTML}
      
      <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <div class="info-row">
          <div class="info-label">Nama Syarikat:</div>
          <div class="info-value"><strong>${syarikat}</strong>${pemutihanLabelHTML}</div>
        </div>
        
        <div class="info-row">
           <div class="info-label">No. CIDB:</div>
          <div class="info-value"><strong>${cidb}</strong></div>
        </div>
        
        <div class="info-row">
          <div class="info-label">Gred:</div>
          <div class="info-value"><span class="gred-badge">🏗️ ${gred}</span></div>
        </div>
        
        <div class="info-row">
          <div class="info-label">Alamat Perniagaan Syarikat:</div>
          <div class="info-value">📍 ${alamatPerniagaan} — <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(alamatPerniagaan)}" target="_blank" style="font-size:12px; color:#1a73e8;">🗺️ Maps</a></div>
        </div>
        
        <div class="info-row">
          <div class="info-label">Pengesyor:</div>
          <div class="info-value">👤 ${pengesyor}</div>
        </div>
        
        <div class="info-row">
          <div class="info-label">Jenis Permohonan:</div>
          <div class="info-value"><span class="badge">📋 ${jenisPermohonan}</span></div>
        </div>
      </div>
      
      <div class="justification-box">
        <strong>📋 Justifikasi Lawatan:</strong><br>
        ${justifikasi}
      </div>
      
      <div class="link-box">
        <strong>🔗 Pautan Google Drive:</strong><br>
        <a href="${pautan}" style="color: #0056b3; word-break: break-all;">${pautan}</a>
      </div>
      
      <p style="margin-top: 20px;">Sila ambil tindakan sewajarnya. Untuk maklumat lanjut, sila rujuk pautan Google Drive di atas.</p>
      
      <p>Terima kasih.</p>
      
      <p style="margin-top: 20px;">
        <em>*** Emel ini dijana secara automatik oleh Sistem STB. Sila jangan balas emel ini. ***</em>
      </p>
    </div>
    
    <div class="footer">
      <p>Sistem Bersepadu SPTB<br>
      © ${new Date().getFullYear()} KUSKOP. Hak Cipta Terpelihara.</p>

      <p>Dijana pada: ${new Date().toLocaleString('ms-MY')}</p>
    </div>
  </div>
</body>
</html>
    `;
    
    // Versi plain text sebagai fallback
    const plainBody = `
NOTIS LAWATAN SPI - SISTEM STB${pemutihanText}
================================

Dimaklumkan bahawa satu permohonan lawatan telah DISYORKAN dan tarikh serahan kepada SPI telah ditetapkan.
${pemutihanNoteText}
BUTIRAN PERMOHONAN:
-------------------
Nama Syarikat       : ${syarikat}${isPemutihan ? ' [PEMUTIHAN]' : ''}
No. CIDB            : ${cidb}
Gred                : ${gred}
Alamat Perniagaan Syarikat: ${alamatPerniagaan}
Peta: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(alamatPerniagaan)}
Pengesyor           : ${pengesyor}
Jenis Permohonan    : ${jenisPermohonan}${isPemutihan ? ' (PEMUTIHAN)' : ''}

JUSTIFIKASI LAWATAN:
-------------------
${justifikasi}

PAUTAN GOOGLE DRIVE:
-------------------
${pautan}

Sila ambil tindakan sewajarnya.

*** Emel ini dijana secara automatik oleh Sistem STB. Sila jangan balas emel ini. ***
    `;

    // Hantar emel dengan nama penghantar yang ditetapkan
    MailApp.sendEmail({
      to: getEmailToSPI(),
      cc: getEmailCcSPTB(),
      subject: subject,
      htmlBody: htmlBody,
      body: plainBody,
      name: EMAIL_SENDER_NAME
    });

    // Log kejayaan
    logActivity(
      "System", 
      'EMAIL_SENT_SPI', 
      `Emel notifikasi SPI${isPemutihan ? ' (PEMUTIHAN)' : ''} berjaya dihantar untuk ${syarikat} (CIDB: ${cidb}, Pengesyor: ${pengesyor}) dari ${EMAIL_SENDER_NAME}`, 
      ''
    );

    console.log(`[V6.5.0] Email SPI${isPemutihan ? ' (PEMUTIHAN)' : ''} berjaya dihantar untuk ${syarikat} dari ${EMAIL_SENDER_NAME}`);

    return { success: true, message: "Emel berjaya dihantar" };
    
  } catch (error) {
    // Log ralat
    logActivity(
      "System", 
      'ERROR_EMAIL_SPI', 
      `Gagal menghantar emel SPI: ${error.toString()}`, 
      ''
    );

    console.error(`[V6.5.0] Error sending SPI email: ${error.toString()}`);
    
    return { success: false, message: error.toString() };
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
    
    const pdfFile = targetFolder.createFile(blob);
    
    const isProfile = data.custom_file_name && data.custom_file_name.includes('Profile Syarikat');
    const logAction = isProfile ? 'CETAK_PROFILE' : 'CETAK_PDF';
    const logDesc = isProfile
      ? `PDF Profile Syarikat disimpan untuk ${data.company_name} (Warna: ${themeColor})`
      : `PDF Borang Semakan disimpan untuk ${data.company_name} (Warna: ${themeColor})`;
    logActivity(data.user_name, logAction, logDesc, targetFolder.getId());
    
    invalidateDataCache();
    return createJSONOutput({
      success: true,
      folder_url: targetFolder.getUrl(),
      folder_id: targetFolder.getId(),
      file_url: pdfFile.getUrl(),
      file_id: pdfFile.getId(),
      file_name: fileName,
      folder_path: folderPath,
      message: "PDF berjaya disimpan dengan imej tertanam dan folder disiapkan"
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
      data.date_submit !== undefined ? data.date_submit : existingData[9],
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
    
    // V6.6.0: BLOK 6 (AD: Kolum 30) - whatsapp_schedule
    if (data.whatsapp_schedule !== undefined) {
      sheet.getRange(rowNum, 30).setValue(data.whatsapp_schedule);
    }
    
    // V6.6.0: BLOK 7 (AE: Kolum 31) - inbox
    let inboxUpdated = false;
    if (data.add_inbox !== undefined && data.add_inbox.message && data.add_inbox.role) {
      const existingStr = sheet.getRange(rowNum, 31).getValue() || '[]';
      let messages = [];
      try { messages = JSON.parse(existingStr); } catch (e) { messages = []; }
      messages.push({
        id: Utilities.getUuid(),
        masa: new Date().toISOString(),
        mesej: data.add_inbox.message,
        jenis: data.add_inbox.type || 'INFO',
        role: data.add_inbox.role,
        dibaca: false
      });
      if (messages.length > 50) messages = messages.slice(-50);
      sheet.getRange(rowNum, 31).setValue(JSON.stringify(messages));
      inboxUpdated = true;
    }
    if (data.inbox !== undefined && !inboxUpdated) {
      sheet.getRange(rowNum, 31).setValue(data.inbox);
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
      let dateSubmitValue = data.date_submit !== undefined ? data.date_submit : existingData[9];
      
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
          justifikasi: data.justifikasi_baru !== undefined ? formatJenisJustifikasi(jenisForJustifikasi, data.justifikasi_baru) : (data.justifikasi !== undefined ? formatJenisJustifikasi(jenisForJustifikasi, data.justifikasi) : existingData[11]),
          pautan: (data.pautan && data.pautan.toString().trim() !== "") ? data.pautan : existingData[10],
          date_submit: dateSubmitValue,
          syor_lawatan: syorLawatanValue
        };
        addToSiasatQueue(emailData);
        try { createSpiCalendarEvent(rowNum, emailData.syarikat, emailData.cidb, emailData.jenis, emailData.pengesyor, emailData.date_submit); } catch (e) { console.error(`[SPI Calendar] Gagal buat event row ${rowNum}: ${e.toString()}`); }
      }
      
      const syorLawatanPemutihan = syorLawatanValue && syorLawatanValue.toString().toUpperCase() === 'PEMUTIHAN';
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
      if (data.date_submit === '') {
          sheet.getRange(rowNum, 16, 1, 2).clearContent();
          removeFromQueue(existingData[0], 'SIASAT_QUEUE');
          removeFromQueue(existingData[0], 'PEMUTIHAN_QUEUE');
      } else {
          const shouldSetSiasat = syorLawatanYA && dateSubmitExists && hantarEmelSPI;
          const shouldSetPemutihan = syorLawatanPemutihan && tarikhLulusExists && hantarEmelSPIPemutihan;
          if (shouldSetSiasat) {
              sheet.getRange(rowNum, 16, 1, 1).setValue("DALAM QUEUE");
          }
          if (shouldSetPemutihan) {
              sheet.getRange(rowNum, 16, 1, 1).setValue("DALAM QUEUE");
          }
          if (!shouldSetSiasat && !shouldSetPemutihan) {
              sheet.getRange(rowNum, 16, 1, 2).clearContent();
              removeFromQueue(existingData[0], 'SIASAT_QUEUE');
              removeFromQueue(existingData[0], 'PEMUTIHAN_QUEUE');
          }
      }
      
      // V6.6.0: Auto inbox notification untuk pelulus bila syor diupdate dengan pelulus
      const syorBaruDisahkan = data.syor_status && data.syor_status.toString().trim() !== '' 
        && data.pelulus && (!existingData[13] || existingData[13].toString().trim() === '');
      if (syorBaruDisahkan) {
        const inboxMsg = `📋 Permohonan *${data.syarikat || existingData[0] || ''}* (${data.jenis || existingData[3] || ''}) menunggu keputusan anda. Sila semak di tab Keputusan.`;
        addInboxToRow(rowNum, data.pelulus, inboxMsg, 'INFO');
      }
      
      // V6.6.0: Auto inbox notification untuk pengesyor bila pelulus buat keputusan
      const keputusanBaru = data.kelulusan && data.kelulusan.toString().trim() !== '' 
        && (!existingData[23] || existingData[23].toString().trim() === '');
      if (keputusanBaru) {
        const pengesyorName = existingData[12] || '';
        const pelulusName = data.pelulus || existingData[25] || '';
        const statusKeputusan = data.kelulusan;
        const inboxMsg = `📬 Keputusan untuk *${data.syarikat || existingData[0] || ''}*: *${statusKeputusan}* oleh ${pelulusName}.`;
        addInboxToRow(rowNum, pengesyorName, inboxMsg, statusKeputusan.includes('LULUS') ? 'SUCCESS' : 'INFO');
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

      // V6.6.0: Inbox notification bila undo
      const existingSyor = existingData[13] ? existingData[13].toString().trim() : '';
      const existingKelulusan = existingData[23] ? existingData[23].toString().trim() : '';
      const newSyor = data.syor_status !== undefined ? data.syor_status.toString().trim() : undefined;
      const newKelulusan = data.kelulusan !== undefined ? data.kelulusan.toString().trim() : undefined;
      const isUndoSyor = newSyor === '' && existingSyor !== '';
      const isUndoLulus = newKelulusan === '' && existingKelulusan !== '' && (newSyor === undefined || newSyor === existingSyor);
      if (isUndoSyor || isUndoLulus) {
        const syarikat = data.syarikat || existingData[0] || '';
        const pelulusName = data.pelulus || existingData[25] || '';
        const pengesyorName = existingData[12] || '';
        if (isUndoSyor) {
          if (pengesyorName) {
            addInboxToRow(rowNum, pengesyorName, '\u{1F519} Anda telah tarik balik syor untuk ' + syarikat, 'INFO');
          }
          if (pelulusName) {
            addInboxToRow(rowNum, pelulusName, '\u{1F519} Permohonan ' + syarikat + ' telah ditarik balik oleh pengesyor', 'WARNING');
          }
        }
        if (isUndoLulus) {
          addInboxToRow(rowNum, pelulusName || existingData[12] || '', '\u{1F519} Anda telah undo keputusan untuk ' + syarikat, 'INFO');
        }
      }

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
      // AD (Kolum 30) - WhatsApp Schedule
      data.whatsapp_schedule||"",
      // AE (Kolum 31) - Inbox
      data.inbox||""
    ];

    const targetRange = sheet.getRange(targetRow, 1, 1, newRow.length);
    targetRange.setValues([newRow]);
    try { cache.put("firstEmptyRow_" + SHEET_NAME, (targetRow + 1).toString(), 300); } catch (e) {}

    logActivity(data.pengesyor || "System", 'INSERT_RECORD', `Rekod baharu dimasukkan di baris ${targetRow} untuk ${data.syarikat || 'syarikat'}`, folderId);

    // V6.6.0: Auto inbox notification untuk pelulus bila syor dihantar
    if (data.syor_status && data.syor_status.toString().trim() !== '' && data.pelulus) {
      try {
        const inboxMsg = `📋 Permohonan *${data.syarikat || ''}* (${data.jenis || ''}) menunggu keputusan anda. Sila semak di tab Keputusan.`;
        addInboxToRow(targetRow, data.pelulus, inboxMsg, 'INFO');
      } catch (e) {
        console.error('Gagal hantar inbox pelulus:', e.toString());
      }
    }

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

function getStatisticsData(role, userName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return createJSONOutput({ error: "Sheet not found" });
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return createJSONOutput({ total: 0 });
  
  const dataRange = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS);
  const data = dataRange.getDisplayValues();
  
  let filteredData = data.filter(row => row[0] && row[0].toString().trim() !== "");
  if (role === ROLE_PENGESYOR && userName) {
    filteredData = filteredData.filter(row => row[12] && row[12].toString().toUpperCase() === userName.toUpperCase());
  } else if (role === ROLE_PELULUS && userName) {
    filteredData = filteredData.filter(row => row[25] && row[25].toString().toUpperCase() === userName.toUpperCase());
  }
  
  const total = filteredData.length;
  const lulus = filteredData.filter(row => row[23] && row[23].toString().includes('LULUS')).length;
  const tolak = filteredData.filter(row => row[23] && (row[23].toString().includes('TOLAK') || row[23].toString().includes('SIASAT'))).length;
  const proses = total - (lulus + tolak);

  const monthlyStats = {};
  const yearStats = {};
  
  filteredData.forEach(row => {
    // Cari tarikh_masuk_sheet di dalam borang_json (Kolum AC / indeks 28)
    let tarikhMasukSheet = '';
    if (row[28]) {
       try {
          const parsed = JSON.parse(row[28]);
          if (parsed.tarikh_masuk_sheet) tarikhMasukSheet = parsed.tarikh_masuk_sheet;
       } catch(e) {}
    }

    // Hierarki: Tarikh Lulus (Y/24) > Tarikh Syor (O/14) > Tarikh Masuk Sheet (JSON) > Start Date (H/7) > Tarikh Submit (J/9)
    let dynamicDate = row[24] ? row[24] : (row[14] ? row[14] : (tarikhMasukSheet ? tarikhMasukSheet : (row[7] ? row[7] : row[9])));
    
    if (dynamicDate) {
      const date = new Date(dynamicDate);
      if (!isNaN(date)) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
        const yearKey = year.toString();
        
        if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { total: 0, lulus: 0, tolak: 0, proses: 0 };
        monthlyStats[monthKey].total++;
        
        if (row[23] && row[23].toString().includes('LULUS')) monthlyStats[monthKey].lulus++;
        else if (row[23] && (row[23].toString().includes('TOLAK') || row[23].toString().includes('SIASAT'))) monthlyStats[monthKey].tolak++;
        else monthlyStats[monthKey].proses++;
        
        if (!yearStats[yearKey]) yearStats[yearKey] = { total: 0, lulus: 0, tolak: 0, proses: 0 };
        yearStats[yearKey].total++;
        if (row[23] && row[23].toString().includes('LULUS')) yearStats[yearKey].lulus++;
        else if (row[23] && (row[23].toString().includes('TOLAK') || row[23].toString().includes('SIASAT'))) yearStats[yearKey].tolak++;
        else yearStats[yearKey].proses++;
      }
    }
  });
  
  let pengesyorStats = {};
  let pelulusStats = {};
  
  if (role === ROLE_ADMIN) {
    filteredData.forEach(row => {
      const pengesyor = row[12] || 'Tiada Pengesyor';
      if (!pengesyorStats[pengesyor]) pengesyorStats[pengesyor] = { total: 0, sokong: 0, tidak_sokong: 0 };
      pengesyorStats[pengesyor].total++;
      if (row[13] && row[13].toString().includes('SOKONG') && !row[13].toString().includes('TIDAK')) pengesyorStats[pengesyor].sokong++;
      else if (row[13] && row[13].toString().includes('TIDAK DISOKONG')) pengesyorStats[pengesyor].tidak_sokong++;
      
      const pelulus = row[25] || 'Tiada Pelulus';
      if (!pelulusStats[pelulus]) pelulusStats[pelulus] = { total: 0, lulus: 0, tolak: 0 };
      pelulusStats[pelulus].total++;
      if (row[23] && row[23].toString().includes('LULUS')) pelulusStats[pelulus].lulus++;
      else if (row[23] && (row[23].toString().includes('TOLAK') || row[23].toString().includes('SIASAT'))) pelulusStats[pelulus].tolak++;
    });
  }
  
  return createJSONOutput({ total: total, lulus: lulus, tolak: tolak, proses: proses, monthlyStats: monthlyStats, yearStats: yearStats, pengesyorStats: pengesyorStats, pelulusStats: pelulusStats });
}

function getRepeatedApplicationsData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return createJSONOutput([]);
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return createJSONOutput([]);

  const dataRange = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS);
  const data = dataRange.getDisplayValues();
  const groupedByCIDB = {};

  data.forEach((row, index) => {
    if (!row[0] || row[0].toString().trim() === "") return;
    const cidb = row[1] ? row[1].toString().trim() : '';
    if (!cidb) return;
    if (!groupedByCIDB[cidb]) groupedByCIDB[cidb] = { cidb: cidb, syarikat: row[0] || '-', rekod: [] };
    
    groupedByCIDB[cidb].rekod.push({
      row: index + 2, syarikat: row[0], cidb: row[1], gred: row[2], jenis: row[3], start_date: row[7], kelulusan: row[23], tarikh_lulus: row[24], pelulus: row[25], borang_json: row[28] || ""
    });
  });

  const repeatedCompanies = [];
  Object.keys(groupedByCIDB).forEach(cidb => {
    const company = groupedByCIDB[cidb];
    if (company.rekod.length > 1) repeatedCompanies.push(company);
  });

  repeatedCompanies.sort((a, b) => b.rekod.length - a.rekod.length);
  return createJSONOutput(repeatedCompanies);
}

function getApplicationsData(role, userName, clientVersion) {
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();
  const currentVersion = props.getProperty(APP_DATA_VERSION_KEY) || '0';

  // ======================
  // CHECK VERSION (CLIENT HASH)
  // ======================
  if (clientVersion && clientVersion === currentVersion) {
    return createJSONOutput({ cached: true, version: currentVersion });
  }

  // ======================
  // BUANG STALE CACHE (data melebihi 100KB limit)
  // ======================
  cache.remove(APP_DATA_CACHE_KEY);

  // ======================
  // READ FROM SHEET (FALLBACK)
  // ======================
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

  const dataRange = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
  const data = dataRange.getDisplayValues();
  const headers = data.shift();

  // Transform ALL rows (unfiltered) untuk cache
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
      whatsapp_schedule: row[29] || "",
      inbox: row[30] || "",
      ulasan_spi: row[31] || ""
    });
  }

  // NOTA: CacheService had 100KB - data 3000+ rows exceeds limit, so skip caching

  // Filter dan return
  const filtered = filterRowsByRole(allRows, role, userName);
  return createJSONOutput({ cached: false, data: filtered, version: currentVersion });
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
        whatsapp_schedule: row[29] || "", inbox: row[30] || "", ulasan_spi: row[31] || ""
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
    return rows.filter(r => r.syor_status && r.syor_status.toString().trim() !== ""
      && r.pelulus && r.pelulus.toString().toUpperCase() === userName.toUpperCase());
  } else if (role === ROLE_PKA) {
    return rows.filter(r => !r.syor_lawatan || r.syor_lawatan.toString().toUpperCase() !== 'PEMUTIHAN');
  }
  return rows;
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
    // Hantar notifikasi inbox kepada Pengesyor
    try {
      const rowData = sheet.getRange(rowNum, 1, 1, TOTAL_COLUMNS).getValues()[0];
      const pengesyorName = rowData[12] || '';
      const syarikat = rowData[0] || '';
      if (pengesyorName) {
        addInboxToRow(rowNum, pengesyorName, `📋 Lawatan premis untuk *${syarikat}* telah selesai. Sila berikan syor anda.`, 'PENTING');
      }
    } catch (e) {
      console.error(`[Inbox] Gagal hantar notifikasi PKA: ${e.toString()}`);
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

function getMonthName(monthNumber) {
  const monthNames = ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'];
  return monthNames[monthNumber - 1];
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

function invalidateDataCache() {
  const cache = CacheService.getScriptCache();
  cache.remove(APP_DATA_CACHE_KEY);
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

function testGetRepeatedApplications() {
  const result = getRepeatedApplicationsData();
  console.log(result.getContent());
  return result;
}

function testGetStatistics() {
  const result = getStatisticsData(ROLE_PENGARAH, "");
  console.log(result.getContent());
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

function testProcessAI() {
  const testText = "SYARIKAT ABC SDN BHD (0120201118-KD061300)\nGred: G7\nAlamat: No. 123, Jalan Test, Kuala Lumpur";
  const testData = { action: 'processAI', type: 'borang', text: testText };
  const result = handleProcessAI(testData);
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
// =========================================================================
function isCutiUmumPutrajaya(date) {
  const formatTarikh = Utilities.formatDate(date, "Asia/Kuala_Lumpur", "MM-dd");
  
  // 1. Cuti Kelepasan Am Tetap Persekutuan / Putrajaya
  const cutiTetap = [
    "01-01", // Tahun Baru 
    "02-01", // Hari Wilayah Persekutuan (Khusus Putrajaya, KL, Labuan)
    "05-01", // Hari Pekerja
    "08-31", // Hari Kebangsaan / Merdeka
    "09-16", // Hari Malaysia
    "12-25"  // Hari Krismas
  ];
  
  if (cutiTetap.includes(formatTarikh)) return true;
  return false;
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
// FUNGSI BERJADUAL: KUMPULAN EMEL SIASAT BIASA (SETIAP HARI BEKERJA 9 PAGI)
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
        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><a href="${data.pautan}" style="color:#1a73e8; font-weight:bold;">Buka Drive</a></td>
      </tr>
    `;
    textList += `${index + 1}. ${data.syarikat}\n   CIDB: ${data.cidb} | Gred: ${data.gred} | Pengesyor: ${data.pengesyor}\n   Alamat Perniagaan: ${data.alamat_perniagaan || 'Tiada'}\n   Justifikasi: ${data.justifikasi || 'Tiada'}\n\n`;
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
    .atHour(9) 
    .create();
  console.log("✅ Cron job Siasat Biasa berjaya ditetapkan setiap hari jam 9 pagi.");
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
// V6.6.0: WHATSAPP SCHEDULING SYSTEM (MANUAL/AUTO)
// =========================================================================

/**
 * Fungsi scheduleWhatsApp: Menyimpan jadual WhatsApp ke kolum AD
 * @param {Object} data - { row, mode, tarikh, masa, ayat, no_hantar }
 */
function scheduleWhatsApp(data) {
  try {
    const scheduleData = {
      mode: data.mode || 'MANUAL',
      tarikh: data.tarikh || '',
      masa: data.masa || 8,
      ayat: data.ayat || '',
      status: data.mode === 'AUTO' ? 'PENDING' : 'MANUAL',
      no_hantar: data.no_hantar || '',
      no_tujuan: data.no_tujuan || '',
      created_at: new Date().toISOString(),
      syarikat: data.syarikat || '',
      email_pengesyor: data.email || ''
    };
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const rowNum = parseInt(data.row);
    
    if (rowNum && rowNum > 1) {
      sheet.getRange(rowNum, 30).setValue(JSON.stringify(scheduleData));
    }
    
    const msg = data.mode === 'AUTO' 
      ? `WhatsAP dijadualkan AUTO pada ${data.tarikh} jam ${data.masa}:00`
      : 'WhatsApp MANUAL direkodkan';
    
    logActivity(data.user || 'System', 'SCHEDULE_WHATSAPP', `${msg} untuk ${data.syarikat || ''} (Baris ${data.row})`, '');
    
    // Jika AUTO, daftarkan trigger satu masa
    if (data.mode === 'AUTO' && data.tarikh && data.masa) {
      registerWhatsAppTrigger(rowNum, data.tarikh, data.masa);
    }
    
    return { success: true, message: msg };
  } catch (error) {
    logActivity('System', 'ERROR_SCHEDULE_WHATSAPP', `Ralat: ${error.toString()}`, '');
    return { success: false, message: error.toString() };
  }
}

function registerWhatsAppTrigger(row, tarikhStr, jam) {
  try {
    const [tahun, bulan, hari] = tarikhStr.split('-');
    const scheduledDate = new Date(tahun, bulan - 1, hari, jam, 0, 0);
    
    if (scheduledDate <= new Date()) {
      logActivity('System', 'WHATSAPP_TRIGGER', `Masa sudah lepas untuk baris ${row}, hantar segera`, '');
      return;
    }
    
    ScriptApp.newTrigger('processSingleWhatsApp')
      .timeBased()
      .at(scheduledDate)
      .create();
      
    logActivity('System', 'WHATSAPP_TRIGGER', `Trigger didaftarkan untuk baris ${row} pada ${scheduledDate.toLocaleString('ms-MY')}`, '');
  } catch (error) {
    logActivity('System', 'ERROR_WHATSAPP_TRIGGER', `Ralat daftar trigger: ${error.toString()}`, '');
  }
}

/**
 * Fungsi processSingleWhatsApp: Dipanggil oleh trigger untuk proses WhatsApp.
 * Jika CallMeBot API ada, hantar auto. Jika tidak, inbox notification dengan wa.me link.
 */
function processSingleWhatsApp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  for (let r = 2; r <= lastRow; r++) {
    const scheduleCell = sheet.getRange(r, 30).getValue();
    if (!scheduleCell) continue;
    
    try {
      const schedule = JSON.parse(scheduleCell);
      if (schedule.mode !== 'AUTO' || schedule.status !== 'PENDING') continue;
      
      const tarikh = schedule.tarikh;
      const jam = schedule.masa;
      const now = new Date();
      const nowDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      
      if (tarikh === nowDate && now.getHours() >= jam) {
        const rowData = sheet.getRange(r, 1, 1, TOTAL_COLUMNS).getValues()[0];
        const syarikat = rowData[0] || '';
        
        // Dapatkan semua no telefon dari borang_json
        const borangJson = rowData[28] || '';
        let rawNumbers = [];
        if (borangJson) {
          try {
            const parsed = JSON.parse(borangJson);
            if (parsed.borang_no_telefon) {
              // Format: "0388805281, 0142473308, 018140081" - asingkan dengan koma
              rawNumbers = rawNumbers.concat(parsed.borang_no_telefon.split(',').map(s => s.trim()).filter(s => s));
            }
            if (parsed.phoneNumbers && Array.isArray(parsed.phoneNumbers)) {
              rawNumbers = rawNumbers.concat(parsed.phoneNumbers);
            }
          } catch (e) {}
        }
        
        // Tapis: hanya nombor mobile Malaysia (bermula 011, 012, 013, 014, 015, 016, 017, 018, 019)
        const noTujuanList = [];
        rawNumbers.forEach(no => {
          let clean = no.replace(/[\s\-\(\)\+]/g, '');
          if (clean.startsWith('60')) clean = clean.substring(2);
          // Mobile Malaysia: panjang 9-11 digit, bermula dengan 01x
          if (/^01[0-9]{7,9}$/.test(clean)) {
            noTujuanList.push('60' + clean);
          }
        });
        
        // Generate wa.me links untuk setiap no telefon
        let waLinks = [];
        noTujuanList.forEach(no => {
          let clean = no.replace(/[\s\-\(\)]/g, '');
          if (clean.startsWith('0')) clean = '60' + clean.substring(1);
          else if (!clean.startsWith('60')) clean = '60' + clean;
          if (/^\d{9,15}$/.test(clean)) {
            waLinks.push({ no: clean, url: `https://wa.me/${clean}?text=${encodeWhatsAppText(schedule.ayat)}` });
          }
        });
        
        // Cuba hantar via CallMeBot API
        const result = hantarWhatsApp(r, schedule);
        
        schedule.status = result.success ? 'SENT' : 'PENDING_MANUAL';
        schedule.hantar_masa = now.toISOString();
        schedule.ralat = result.error || '';
        schedule.wa_links = waLinks;
        
        sheet.getRange(r, 30).setValue(JSON.stringify(schedule));
        
        // Inbox notification: kalau gagal/takde API, bagi link manual
        if (result.success) {
          addInboxToRow(r, 'PENGESYOR', `✅ WhatsApp AUTO berjaya dihantar ke ${noTujuanList.length} nombor untuk ${syarikat}`, 'SUCCESS');
          addInboxToRow(r, 'PELULUS', `✅ WhatsApp AUTO berjaya dihantar untuk ${syarikat}`, 'SUCCESS');
        } else {
          let mesejInbox = `📤 WhatsApp AUTO untuk ${syarikat} sudah tiba masa dihantar.\n\nMesej: ${schedule.ayat}\n\n`;
          if (waLinks.length > 0) {
            mesejInbox += `📱 Klik link untuk hantar:\n`;
            waLinks.forEach((link, i) => {
              mesejInbox += `${link.url}\n`;
            });
          } else {
            mesejInbox += `❌ Tiada nombor WhatsApp yang sah dijumpai dalam borang.`;
          }
          addInboxToRow(r, 'PENGESYOR', mesejInbox, 'WARNING');
        }
        
        logActivity('System', 'WHATSAPP_SENT', `WhatsApp AUTO ${result.success ? 'BERJAYA' : 'PERLU MANUAL'} untuk ${syarikat} (Baris ${r}) - ${waLinks.length} nombor`, '');
      }
    } catch (e) {
      logActivity('System', 'ERROR_WHATSAPP_PROCESS', `Ralat proses baris ${r}: ${e.toString()}`, '');
    }
  }
}

/**
 * Fungsi hantarWhatsApp: Menghantar WhatsApp menggunakan CallMeBot API atau wa.me
 */
function hantarWhatsApp(row, schedule) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const rowData = sheet.getRange(row, 1, 1, TOTAL_COLUMNS).getValues()[0];
    const syarikat = rowData[0] || '';
    const borangJson = rowData[28] || '';
    const pengesyor = rowData[12] || '';
    
    let noTujuan = schedule.no_tujuan || '';
    if (!noTujuan && borangJson) {
      try {
        const parsed = JSON.parse(borangJson);
        if (parsed.phoneNumbers && parsed.phoneNumbers.length > 0) {
          noTujuan = parsed.phoneNumbers[0];
        } else if (parsed.borang_no_telefon) {
          noTujuan = parsed.borang_no_telefon;
        }
      } catch (e) {}
    }
    
    if (!noTujuan) {
      return { success: false, error: 'No telefon tujuan tidak dijumpai' };
    }
    
    let cleanPhone = noTujuan.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '60' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('60')) cleanPhone = '60' + cleanPhone;
    
    if (!/^\d{9,15}$/.test(cleanPhone)) {
      return { success: false, error: 'No telefon tidak sah: ' + cleanPhone };
    }
    
    // Cari API key peribadi pengesyor dari Script Properties
    let callmebotKey = '';
    const emailPengesyor = schedule.email_pengesyor || '';
    if (emailPengesyor) {
      const propKey = 'CALLMEBOT_API_KEY_' + emailPengesyor.toLowerCase();
      callmebotKey = getScriptProp(propKey);
    }
    // Fallback: guna nama pengesyor untuk cari email
    if (!callmebotKey && pengesyor) {
      const userProfile = findUserByPengesyorName(pengesyor);
      if (userProfile) {
        const propKey = 'CALLMEBOT_API_KEY_' + userProfile.email.toLowerCase();
        callmebotKey = getScriptProp(propKey);
      }
    }
    // Fallback ke key global jika tiada key peribadi
    if (!callmebotKey) {
      callmebotKey = getScriptProp('CALLMEBOT_API_KEY');
    }
    
    if (callmebotKey) {
      return hantarViaCallMeBot(cleanPhone, schedule.ayat, callmebotKey);
    }
    
    // Fallback: Log wa.me URL dan maklumkan
    return { 
      success: false, 
      error: 'API WhatsApp tidak dikonfigurasi untuk pengesyor ini. Sila guna Manual.',
      waUrl: `https://wa.me/${cleanPhone}?text=${encodeWhatsAppText(schedule.ayat)}`
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function findUserByPengesyorName(name) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) return null;
    const data = sheet.getDataRange().getDisplayValues();
    if (!data || data.length < 2) return null;
    const headers = data.shift();
    const nameColIndex = headers.findIndex(h => h && h.toString().toUpperCase().includes('NAMA'));
    const emailColIndex = headers.findIndex(h => h && (h.toString().toUpperCase().includes('EMEL') || h.toString().toUpperCase().includes('EMAIL')));
    for (let i = 0; i < data.length; i++) {
      if (data[i][nameColIndex] && data[i][nameColIndex].toString().toUpperCase().trim() === name.toUpperCase().trim()) {
        return {
          name: data[i][nameColIndex] || '',
          email: data[i][emailColIndex] || ''
        };
      }
    }
    return null;
  } catch (e) { return null; }
}

function encodeWhatsAppText(text) {
  // Guna Utilities.newBlob().getBytes() untuk pastikan UTF-8 yang betul
  // (GAS encodeURIComponent boleh hasilkan CESU-8 untuk emoji)
  if (!text) return '';
  var bytes = Utilities.newBlob(text).getBytes();
  var result = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    // unreserved characters (RFC 3986): A-Z a-z 0-9 - _ . ~
    if ((b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A) || (b >= 0x30 && b <= 0x39)
        || b === 0x2D || b === 0x5F || b === 0x2E || b === 0x7E) {
      result += String.fromCharCode(b);
    } else {
      result += '%' + b.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return result;
}

function hantarViaCallMeBot(phone, message, apiKey) {
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeWhatsAppText(message)}&apikey=${apiKey}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = response.getResponseCode();
    
    if (code === 200) {
      return { success: true, error: null };
    } else {
      return { success: false, error: `API Error HTTP ${code}: ${response.getContentText()}` };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Fungsi WhatsApp: Check nombor menggunakan API (placeholder)
 */
function checkWhatsAppNumber(phone) {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  if (!/^\d{9,15}$/.test(cleanPhone)) {
    return { valid: false, reason: 'Format nombor tidak sah' };
  }
  // Untuk CallMeBot, tiada API check number. Anggap sah.
  return { valid: true };
}

// =========================================================================
// V6.6.0: INBOX / NOTIFICATION SYSTEM (Kolum AE / 31)
// =========================================================================

/**
 * Fungsi addInboxToRow: Tambah mesej inbox ke kolum AE
 * @param {number} row - Nombor baris sheet
 * @param {string} roleOrName - Boleh jadi nama PELULUS atau nama pengguna spesifik
 * @param {string} message - Mesej notifikasi
 * @param {string} type - INFO/SUCCESS/ERROR/WARNING
 */
function addInboxToRow(row, roleOrName, message, type = 'INFO') {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const existingStr = sheet.getRange(row, 31).getValue() || '[]';
    let messages = [];
    try { messages = JSON.parse(existingStr); } catch (e) { messages = []; }
    
    messages.push({
      id: Utilities.getUuid(),
      masa: new Date().toISOString(),
      mesej: message,
      jenis: type,
      role: roleOrName, // BOLEH jadi nama spesifik (contoh: "ALI BIN AHMAD")
      dibaca: false
    });
    
    // Simpan maksimum 50 mesej
    if (messages.length > 50) messages = messages.slice(-50);
    
    sheet.getRange(row, 31).setValue(JSON.stringify(messages));
    
    // Dapatkan syarikat untuk logging
    const syarikat = sheet.getRange(row, 1).getValue() || '';
    logActivity('System', 'INBOX_ADD', `Inbox untuk ${roleOrName}: ${message.substring(0, 80)} (${syarikat})`, '');
    
    return { success: true };
  } catch (error) {
    logActivity('System', 'ERROR_INBOX', error.toString(), '');
    return { success: false, error: error.toString() };
  }
}

/**
 * Fungsi getInboxForRole: Dapatkan inbox untuk role tertentu dari seluruh sheet
 */
function handleGetInbox(data) {
  try {
    const role = data.role || '';
    const email = data.email || '';
    
    if (!email) return createJSONOutput({ status: 'error', message: 'Email diperlukan' });
    
    const accessCheck = verifyUserAccess(email, [ROLE_PENGESYOR, ROLE_PELULUS, ROLE_ADMIN, ROLE_PENGARAH, ROLE_KETUA_SEKSYEN]);
    if (!accessCheck.isAuthorized) {
      return createJSONOutput({ status: 'error', message: accessCheck.error });
    }
    
    const userRole = accessCheck.userProfile.role;
    const userName = accessCheck.userProfile.name;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) return createJSONOutput({ status: 'success', inbox: [] });
    
    const dataRange = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS);
    const rows = dataRange.getDisplayValues();
    
    const inboxItems = [];
    
    rows.forEach((row, index) => {
      if (!row[0] || row[0].toString().trim() === '') return;
      
      const inboxStr = row[30] || '';
      if (!inboxStr) return;
      
      let messages = [];
      try { messages = JSON.parse(inboxStr); } catch (e) { return; }
      
      // Filter messages for this user's role OR name
      messages.forEach(msg => {
        let shouldShow = false;
        
        if (userRole === 'ADMIN' || userRole === 'PENGARAH' || userRole === 'KETUA_SEKSYEN') {
          shouldShow = true; // Admin/Pengarah/KetuaSeksyen boleh nampak semua
        } else if (msg.role === userRole) {
          shouldShow = true; // Contoh: msg.role = 'PENGESYOR' cocok dengan userRole
        } else if (msg.role === 'ALL') {
          shouldShow = true;
        } else if (msg.role && msg.role.toUpperCase() === userName.toUpperCase()) {
          shouldShow = true; // V6.6.0: msg.role = nama spesifik pengguna (contoh: "ALI BIN AHMAD")
        }
        
        // Pengesyor only sees messages for their own records
        if (userRole === 'PENGESYOR') {
          const rowPengesyor = row[12] || '';
          if (rowPengesyor.toUpperCase() !== userName.toUpperCase()) {
            shouldShow = false;
          }
        }
        
        if (shouldShow) {
          inboxItems.push({
            id: msg.id,
            row: index + 2,
            syarikat: row[0] || '',
            cidb: row[1] || '',
            jenis: row[3] || '',
            kelulusan: row[23] || '',
            whatsapp_schedule: row[29] || '',
            masa: msg.masa,
            mesej: msg.mesej,
            jenisMsg: msg.jenis || 'INFO',
            role: msg.role,
            dibaca: msg.dibaca || false
          });
        }
      });
    });
    
    // Sort by date descending (newest first)
    inboxItems.sort((a, b) => new Date(b.masa) - new Date(a.masa));
    
    return createJSONOutput({ status: 'success', inbox: inboxItems });
    
  } catch (error) {
    return createJSONOutput({ status: 'error', message: error.toString(), inbox: [] });
  }
}

/**
 * Fungsi handleDeleteInbox: Padam mesej inbox tertentu
 */
function handleDeleteInbox(data) {
  try {
    const email = data.email || '';
    const msgId = data.msgId || '';
    const row = parseInt(data.row);
    
    if (!email || !msgId || !row) {
      return createJSONOutput({ status: 'error', message: 'Data tidak lengkap' });
    }
    
    const accessCheck = verifyUserAccess(email, [ROLE_PENGESYOR, ROLE_PELULUS, ROLE_ADMIN, ROLE_PENGARAH, ROLE_KETUA_SEKSYEN]);
    if (!accessCheck.isAuthorized) {
      return createJSONOutput({ status: 'error', message: accessCheck.error });
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const existingStr = sheet.getRange(row, 31).getValue() || '[]';
    let messages = [];
    try { messages = JSON.parse(existingStr); } catch (e) { messages = []; }
    
    messages = messages.filter(msg => msg.id !== msgId);
    sheet.getRange(row, 31).setValue(JSON.stringify(messages));
    
    return createJSONOutput({ status: 'success', message: 'Mesej inbox berjaya dipadam' });
    
  } catch (error) {
    return createJSONOutput({ status: 'error', message: error.toString() });
  }
}

// =========================================================================
// V6.6.0: CHANGELOG / RELEASE NOTES
// =========================================================================

function handleGetChangelog() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CHANGELOG_SHEET_NAME);
    
    if (!sheet) {
      // Create sheet if not exists
      sheet = ss.insertSheet(CHANGELOG_SHEET_NAME);
      const headers = [['Versi', 'Tarikh', 'Penerangan', 'Imej']];
      sheet.getRange(1, 1, 1, 4).setValues(headers);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.getRange(2, 1, 1, 4).setValues([['V6.6.0', '2026-06-21', '• WhatsApp Scheduling Manual/Auto\n• Inbox Notifikasi (kolum AE)\n• Pelulus Wajib Pilih + Kolum Z\n• WhatsApp Confirm Modal (ganti checkbox)\n• CallMeBot API per-user\n• Inbox Notifikasi Pelulus/Pengesyor\n• Landing Page & Changelog\n• Changelog Walkthrough', '']]);
      sheet.getRange(3, 1, 1, 4).setValues([['V6.5.2', '2026-04-01', '• Auto Email Authentication\n• Mobile UI Polish\n• QR Code Preview', '']]);
      sheet.getRange(4, 1, 1, 4).setValues([['V6.5.0', '2026-03-01', '• API Keys di Script Properties\n• Firebase Integration\n• 3-Tier AI Fallback', '']]);
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return createJSONOutput({ status: 'success', changelog: [] });
    }
    
    const cols = sheet.getLastColumn();
    const data = sheet.getRange(2, 1, lastRow - 1, Math.max(cols, 4)).getDisplayValues();
    const changelog = data
      .filter(r => r[0] && r[0].toString().trim() !== '')
      .map(r => ({
        versi: r[0].toString().trim(),
        tarikh: r[1] || '',
        penerangan: r[2] || '',
        imej: r[3] || ''
      }));
    
    return createJSONOutput({ status: 'success', changelog: changelog });
    
  } catch (error) {
    return createJSONOutput({ status: 'error', message: error.toString(), changelog: [] });
  }
}

// V6.6.0: User version tracking
function handleGetUserLastSeenVersion(email) {
  try {
    if (!email) return createJSONOutput({ status: 'error', message: 'Email diperlukan' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(USER_META_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(USER_META_SHEET_NAME);
      const headers = [['Email', 'LastSeenVersion']];
      sheet.getRange(1, 1, 1, 2).setValues(headers);
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return createJSONOutput({ status: 'success', version: '' });
    }
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const found = data.find(r => r[0] && r[0].toString().trim().toLowerCase() === email.toLowerCase().trim());
    return createJSONOutput({ status: 'success', version: found ? (found[1] || '') : '' });
  } catch (error) {
    return createJSONOutput({ status: 'error', message: error.toString() });
  }
}

function handleUpdateUserLastSeenVersion(email, version) {
  try {
    if (!email) return createJSONOutput({ status: 'error', message: 'Email diperlukan' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(USER_META_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(USER_META_SHEET_NAME);
      const headers = [['Email', 'LastSeenVersion']];
      sheet.getRange(1, 1, 1, 2).setValues(headers);
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      sheet.getRange(2, 1, 1, 2).setValues([[email, version]]);
      return createJSONOutput({ status: 'success', message: 'Versi dikemaskini' });
    }
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    let foundRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === email.toLowerCase().trim()) {
        foundRow = i + 2;
        break;
      }
    }
    if (foundRow > 0) {
      sheet.getRange(foundRow, 2).setValue(version);
    } else {
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, 2).setValues([[email, version]]);
    }
    return createJSONOutput({ status: 'success', message: 'Versi dikemaskini' });
  } catch (error) {
    return createJSONOutput({ status: 'error', message: error.toString() });
  }
}

/**
 * Fungsi handleMarkInboxRead: Tandakan inbox sebagai dibaca
 */
function handleMarkInboxRead(data) {
  try {
    const email = data.email || '';
    const msgId = data.msgId || '';
    const row = parseInt(data.row);
    
    if (!email || !msgId || !row) {
      return createJSONOutput({ status: 'error', message: 'Data tidak lengkap' });
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const existingStr = sheet.getRange(row, 31).getValue() || '[]';
    let messages = [];
    try { messages = JSON.parse(existingStr); } catch (e) { messages = []; }
    
    messages = messages.map(msg => {
      if (msg.id === msgId) msg.dibaca = true;
      return msg;
    });
    
    sheet.getRange(row, 31).setValue(JSON.stringify(messages));
    
    return createJSONOutput({ status: 'success', message: 'Mesej ditandakan dibaca' });
    
  } catch (error) {
    return createJSONOutput({ status: 'error', message: error.toString() });
  }
}

/**
 * Fungsi handleMarkAllInboxRead: Tandakan SEMUA inbox sebagai dibaca untuk pengguna ini
 */
function handleMarkAllInboxRead(data) {
  try {
    const email = data.email || '';
    if (!email) {
      return createJSONOutput({ status: 'error', message: 'Email diperlukan' });
    }
    const accessCheck = verifyUserAccess(email, [ROLE_PENGESYOR, ROLE_PELULUS, ROLE_ADMIN, ROLE_PENGARAH, ROLE_KETUA_SEKSYEN]);
    if (!accessCheck.isAuthorized) {
      return createJSONOutput({ status: 'error', message: accessCheck.error });
    }
    const userRole = accessCheck.userProfile.role;
    const userName = accessCheck.userProfile.name;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return createJSONOutput({ status: 'success' });
    
    for (let r = 2; r <= lastRow; r++) {
      const rowData = sheet.getRange(r, 1, 1, TOTAL_COLUMNS).getDisplayValues()[0];
      if (!rowData[0] || rowData[0].toString().trim() === '') continue;
      
      const inboxStr = sheet.getRange(r, 31).getValue() || '[]';
      let messages = [];
      try { messages = JSON.parse(inboxStr); } catch (e) { continue; }
      if (!messages.length) continue;
      
      let changed = false;
      messages = messages.map(function(msg) {
        var shouldShow = false;
        if (userRole === 'ADMIN' || userRole === 'PENGARAH' || userRole === 'KETUA_SEKSYEN') {
          shouldShow = true;
        } else if (msg.role === userRole) {
          shouldShow = true;
        } else if (msg.role === 'ALL') {
          shouldShow = true;
        } else if (msg.role && msg.role.toUpperCase() === userName.toUpperCase()) {
          shouldShow = true;
        }
        if (userRole === 'PENGESYOR') {
          var rowPengesyor = rowData[12] || '';
          if (rowPengesyor.toUpperCase() !== userName.toUpperCase()) {
            shouldShow = false;
          }
        }
        if (shouldShow && !msg.dibaca) {
          msg.dibaca = true;
          changed = true;
        }
        return msg;
      });
      
      if (changed) {
        sheet.getRange(r, 31).setValue(JSON.stringify(messages));
      }
    }
    
    return createJSONOutput({ status: 'success', message: 'Semua mesej ditandakan dibaca' });
    
  } catch (error) {
    return createJSONOutput({ status: 'error', message: error.toString() });
  }
}

/**
 * Fungsi handleDeleteAllInbox: Padam SEMUA inbox untuk pengguna ini
 */
function handleDeleteAllInbox(data) {
  try {
    const email = data.email || '';
    if (!email) {
      return createJSONOutput({ status: 'error', message: 'Email diperlukan' });
    }
    const accessCheck = verifyUserAccess(email, [ROLE_PENGESYOR, ROLE_PELULUS, ROLE_ADMIN, ROLE_PENGARAH, ROLE_KETUA_SEKSYEN]);
    if (!accessCheck.isAuthorized) {
      return createJSONOutput({ status: 'error', message: accessCheck.error });
    }
    const userRole = accessCheck.userProfile.role;
    const userName = accessCheck.userProfile.name;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return createJSONOutput({ status: 'success' });
    
    for (let r = 2; r <= lastRow; r++) {
      const rowData = sheet.getRange(r, 1, 1, TOTAL_COLUMNS).getDisplayValues()[0];
      if (!rowData[0] || rowData[0].toString().trim() === '') continue;
      
      const inboxStr = sheet.getRange(r, 31).getValue() || '[]';
      let messages = [];
      try { messages = JSON.parse(inboxStr); } catch (e) { continue; }
      if (!messages.length) continue;
      
      var beforeCount = messages.length;
      messages = messages.filter(function(msg) {
        var shouldDelete = false;
        if (userRole === 'ADMIN' || userRole === 'PENGARAH' || userRole === 'KETUA_SEKSYEN') {
          shouldDelete = true;
        } else if (msg.role === userRole) {
          shouldDelete = true;
        } else if (msg.role === 'ALL') {
          shouldDelete = true;
        } else if (msg.role && msg.role.toUpperCase() === userName.toUpperCase()) {
          shouldDelete = true;
        }
        if (userRole === 'PENGESYOR') {
          var rowPengesyor = rowData[12] || '';
          if (rowPengesyor.toUpperCase() !== userName.toUpperCase()) {
            shouldDelete = false;
          }
        }
        return !shouldDelete;
      });
      
      if (messages.length !== beforeCount) {
        sheet.getRange(r, 31).setValue(JSON.stringify(messages));
      }
    }
    
    return createJSONOutput({ status: 'success', message: 'Semua mesej dipadam' });
    
  } catch (error) {
    return createJSONOutput({ status: 'error', message: error.toString() });
  }
}

// =========================================================================
// V6.7.0: FILE MANAGER — SENARAI FAIL DALAM FOLDER DRIVE
// =========================================================================

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
          : ''
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

function handleDeleteDriveFile(data) {
  try {
    const fileId = data.fileId;
    if (!fileId) {
      return createJSONOutput({ success: false, error: "fileId diperlukan." });
    }
    
    const file = DriveApp.getFileById(fileId);
    const fileName = file.getName();
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const rows = sheet.getDataRange().getDisplayValues();
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const syorLawatan = (r[8] || '').toString().toUpperCase();
      if (syorLawatan !== 'YA') continue;
      if (r[8] && r[8].toString().toUpperCase() === 'PEMUTIHAN') continue;
      const statusSpi = (r[15] || '').toString().trim();
      if (statusSpi === '') continue;
      if (isPengesyor) {
        const rowPengesyor = (r[12] || '').toString().trim().toUpperCase();
        if (rowPengesyor !== pengesyorName.toUpperCase()) continue;
      }
      const lawatanSyor = (r[19] || '').toString().trim();
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
        event_id: eventId
      });
    }
    return createJSONOutput({ success: true, data: result });
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
        const pengesyor = r[12] || '';
        const msg = `⚠️ SPI untuk *${r[0] || ''}* (${r[3] || ''}) melebihi 14 hari bekerja. Sila ambil tindakan.`;
        addInboxToRow(i + 1, pengesyor, msg, 'WARNING');
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