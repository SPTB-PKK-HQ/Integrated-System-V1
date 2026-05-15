// Tentukan nama Tab Sheet anda
const SHEET_NAME = "Sheet1";
const USERS_SHEET_NAME = "Users";
const LOGS_SHEET_NAME = "Logs";

// FOLDER INDUK ID (Folder utama yang mengandungi folder-folder user)
const MAIN_FOLDER_ID = "1-IszGRdSjoJz2oOjUs_KO7HRz7oE2Hzn";
const MAIN_FOLDER_NAME = "STB MAIN FOLDER";

// Domain rasmi yang dibenarkan untuk akses
const AUTHORIZED_DOMAIN = "kuskop.gov.my";
const ADDITIONAL_AUTHORIZED_DOMAINS = ["kuskop.gov.my"]; // Boleh tambah domain lain jika perlu

// =========================================================================
// V6.5.0: API KEYS - DISIMPAN DI BACKEND UNTUK KESELAMATAN
// =========================================================================
const DEEPSEEK_API_KEY = "sk-afac9888701c4678a58dfef2d49feb7d";
const GEMINI_API_KEY = "AIzaSyDuwh_qFiE-WeQnJiB1VCXj5mpf7fi96K0";
const OPENROUTER_API_KEY = "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";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "tencent/hy3-preview:free";

// =========================================================================
// YOUTUBE API KEY (Disimpan di pelayan untuk keselamatan)
// =========================================================================
const YOUTUBE_API_KEY = "AIzaSyA9ROLuQPwVtUYhnA6uInSTF2kjk7SdSMM";

// =========================================================================
// V6.5.0: FIREBASE PENGESYOR MAP - KOD RAHSIA DISIMPAN DI BACKEND
// =========================================================================
const FIREBASE_PENGESYOR_MAP = {
  'zariff.zainudin@kuskop.gov.my': '0707',
  'ilyanadia.azmi@kuskop.gov.my': '6166',
  'norhamizi.hamdzah@kuskop.gov.my': '5757',
  'khairulfitri.kamaruddin@kuskop.gov.my': '5381'
};

// Role definitions
const ROLE_PENGESYOR = "PENGESYOR";
const ROLE_PELULUS = "PELULUS";
const ROLE_PENGARAH = "PENGARAH";
const ROLE_KETUA_SEKSYEN = "KETUA_SEKSYEN";
const ROLE_ADMIN = "ADMIN";

// Jumlah lajur dalam sheet (A hingga AC = 29 lajur)
const TOTAL_COLUMNS = 29;

// Email recipients for SPI notifications
const EMAIL_TO_SPI = "suhaizal@kuskop.gov.my,hairul.ab@kuskop.gov.my";
const EMAIL_CC_SPTB = "sptb.pkk@kuskop.gov.my";

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
    
    const finalNameIndex = nameColIndex !== -1 ? nameColIndex : 0;
    const finalEmailIndex = emailColIndex !== -1 ? emailColIndex : 1;
    const finalRoleIndex = roleColIndex !== -1 ? roleColIndex : 2;
    const finalColorIndex = colorColIndex !== -1 ? colorColIndex : 3;
    const finalPhoneIndex = phoneColIndex !== -1 ? phoneColIndex : 5;
    const finalImageIndex = 6;
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
    if (userProfile.role === ROLE_PENGESYOR) {
      const firebaseCode = FIREBASE_PENGESYOR_MAP[userProfile.email.toLowerCase()];
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
  const lock = LockService.getScriptLock();
  let locked = false;
  
  try {
    // Tunggu sehingga 15 saat untuk mendapatkan kunci
    lock.waitLock(15000);
    locked = true;
    
    const action = e.parameter ? e.parameter.action : "";
    const role = e.parameter ? e.parameter.role : "";
    const userName = e.parameter ? e.parameter.userName : "";
    const email = e.parameter ? e.parameter.email : "";

    // V6.4.9: Handler untuk checkAuth - kini menerima email dari parameter
    if (action === "checkAuth") {
      return handleCheckAuth(email);
    }
    
    // V6.5.0: Handler untuk getQueueData - memerlukan pengesahan ADMIN
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
    
    let result;

    if (action === "getUsers") {
      result = getUsersData();
    } else if (action === "getStats") {
      result = getStatisticsData(role, userName);
    } else if (action === "getRepeatedApplications") {
      result = getRepeatedApplicationsData();
    } else {
      result = getApplicationsData(role, userName);
    }
    
    return result;

  } catch (error) {
    // Jika timeout lock, kembalikan error 503
    if (error.toString().includes('timed out')) {
      return createJSONOutput({ 
        status: "error", 
        code: 503,
        message: "Server sibuk, sila cuba sebentar lagi. (Lock timeout)" 
      });
    }
    return createJSONOutput({ 
      status: "error", 
      message: error.toString() 
    });

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

/**
 * Fungsi doPost: Mengendalikan permintaan POST (Simpan Data / Cipta Folder / Padam Rekod / Cetak PDF / AI Processing / CheckAuth)
 * V6.5.0: Menambah pengesahan verifyUserAccess untuk semua tindakan kritikal
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  
  try {
    // Tunggu sehingga 15 saat untuk mendapatkan kunci
    lock.waitLock(15000);
    locked = true;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return createJSONOutput({ status: "error", message: "Sheet not found" });
    }
    
    const data = JSON.parse(e.postData.contents);

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
    
    // Handler untuk padam rekod
    if (data.action === 'deleteRecord') {
      // V6.5.0: Pengesahan ketat untuk deleteRecord
      return handleDeleteRecord(data, sheet);
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
    // Jika timeout lock, kembalikan error 503
    if (error.toString().includes('timed out')) {
      return createJSONOutput({ 
        status: "error", 
        code: 503,
        message: "Server sibuk, sila cuba sebentar lagi. (Lock timeout)" 
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
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`;
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
    
    if (!pdfText || pdfText.trim() === '') {
      return createJSONOutput({
        success: false,
        error: "Teks PDF kosong. Tiada data untuk diproses."
      });
    }
    
    Logger.log(`[V6.5.0] AI Processing diminta untuk jenis: ${promptType}, panjang teks: ${pdfText.length}`);

    // Panggil fungsi processWithAI dengan 3-Tier Fallback
    const result = processWithAI(pdfText, promptType);

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
function processWithAI(pdfText, promptType) {
  const maxTextLength = 30000;

  const truncatedText = pdfText.length > maxTextLength 
    ? pdfText.substring(0, maxTextLength) + "... [text truncated]"
    : pdfText;
  
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
  
  Logger.log(`[V6.5.0] 3-Tier Fallback: Mencuba DeepSeek...`);
  
  // Tier 1: DeepSeek
  try {
    const deepseekResult = callDeepSeekAPI(prompt);
    if (deepseekResult) {
      const processedData = processResponseFn(deepseekResult);
      return { success: true, data: processedData, provider: 'DeepSeek', error: null };
    }
  } catch (error) {
    Logger.log(`[V6.5.0] DeepSeek gagal: ${error.toString()}. Mencuba Gemini...`);
  }
  
  // Tier 2: Gemini (Backup 1)
  try {
    const geminiResult = callGeminiAPI(prompt);
    if (geminiResult) {
      const processedData = processResponseFn(geminiResult);
      return { success: true, data: processedData, provider: 'Gemini', error: null };
    }
  } catch (error) {
    Logger.log(`[V6.5.0] Gemini gagal: ${error.toString()}. Mencuba OpenRouter...`);
  }
  
  // Tier 3: OpenRouter (Backup 2)
  try {
    const openRouterResult = callOpenRouterAPI(prompt);
    if (openRouterResult) {
      const processedData = processResponseFn(openRouterResult);
      return { success: true, data: processedData, provider: 'OpenRouter', error: null };
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
  return `Ekstrak data syarikat dari teks PDF ini ke format JSON SAHAJA.
 PENTING: 
    1. spkkDuration dan stbDuration MESTI string format "DD/MM/YYYY - DD/MM/YYYY" atau string kosong "" jika tiada.
 2. directors, shareholders, checkSignatories, spkkNominees, phoneNumbers MESTI "Array of Strings" (Senarai Nama/No Telefon Sahaja, BUKAN Object).
 3. phoneNumbers: Ekstrak nombor telefon. PASTIKAN SANGAT KETAT hanya ekstrak nombor telefon pemohon (individu) dan nombor telefon pejabat sahaja.
 ABAIKAN sebarang nombor faksimili (Fax) atau nombor lain.
    4. grade: Ekstrak Gred syarikat seperti G1, G2, G3, G4, G5, G6, G7.
 Cari corak seperti "Gred:", "Grade:", "G1", "G2", dsb. JIKA TERDAPAT LEBIH DARIPADA SATU GRED, AMBIL HANYA SATU GRED PERTAMA YANG DIJUMPAI.
 5. alamatPerniagaan: Ekstrak "Alamat Perniagaan Syarikat" atau "Alamat Surat-Menyurat" secara penuh. Jika tidak dijumpai, gunakan string kosong "".
 6. PASTIKAN No. Pendaftaran/CIDB diekstrak dengan 100% TEPAT mengikut format rasmi dari dokumen. Contoh format yang betul: '0120201118-KD061300'.
 JANGAN mengubah suai, meramal, atau mencipta nombor ini. Cari format yang mempunyai gabungan nombor dan huruf seperti contoh.
 Keys: companyName, cidbNumber, grade, spkkDuration (string), stbDuration (string), directors (array of strings), shareholders (array of strings), checkSignatories (array of strings), spkkNominees (array of strings), phoneNumbers (array of strings), alamatPerniagaan (string).
 Teks PDF: ${truncatedText}`;
}

function buildProfilePrompt(truncatedText) {
  return `Ekstrak maklumat syarikat dari teks PDF ini ke format JSON SAHAJA.
 PENTING UNTUK ALAMAT: 
    Cari dan ekstrak maklumat alamat.
 AI PERLU mengenalpasti label alamat utama yang digunakan dalam dokumen.
 Label alamat utama mungkin berupa 'Alamat Berdaftar', 'Registered Address', 'Alamat Perniagaan', 'Business Address', 'Alamat Surat-menyurat', atau 'Correspondence Address'.
 Jika label alamat utama mengandungi perkataan "Perniagaan" atau "Business", maka ia adalah Alamat Perniagaan.
 Jika label tersebut mengandungi perkataan "Surat-menyurat" atau "Correspondence", maka ia adalah Alamat Surat-menyurat. Jika tidak, ia adalah Alamat Berdaftar.
 Ekstrak juga alamat kedua (jika ada) yang mungkin dilabel sebagai 'Alamat Surat-menyurat', 'Correspondence Address', 'Alamat Kiriman'.
 PASTIKAN No. Pendaftaran/CIDB diekstrak dengan 100% TEPAT mengikut format rasmi dari dokumen. Contoh format yang betul: '0120201118-KD061300'.
 JANGAN mengubah suai, meramal, atau mencipta nombor ini. Cari format yang mempunyai gabungan nombor dan huruf seperti contoh.
 Keys yang diperlukan:
    - applicantName: Nama pemohon/individu (jika ada)
    - jawatan: Jawatan pemohon (jika ada)
    - icNumber: No Kad Pengenalan pemohon (contoh: 123456-78-9012)
    - phoneNumber: No Telefon pemohon (contoh: 012-3456789)
    - email: Alamat Emel pemohon (contoh: nama@email.com)
    - companyName: Nama Syarikat
    - registrationNumber: No Pendaftaran/CIDB
    - grade: Gred Syarikat (G1, G2, G3, G4, G5, G6, G7)
    - registrationDate: Tarikh Daftar (format: DD/MM/YYYY)
    - jenisPendaftaran: Jenis Pendaftaran (ROC/ROB)
    
 - alamatUtama: Alamat utama yang diekstrak dari label alamat utama
    - labelAlamatUtama: Label asal alamat utama yang ditemui (contoh: 'Alamat Berdaftar', 'Registered Address', 'Alamat Perniagaan', 'Business Address')
    - alamatSuratMenyurat: Alamat surat-menyurat (jika ada, label seperti 'Alamat Surat-menyurat', 'Correspondence Address', 'Alamat Kiriman')
    - noTelefonSyarikat: No Telefon Syarikat
    - noFax: No Fax Syarikat
    - emailSyarikat: Alamat Emel Syarikat
    - webAddress: Web Address / Laman Web
    
    Jika sesuatu maklumat tidak ditemui, gunakan string kosong "".
 Teks PDF: ${truncatedText}`;
}

// =========================================================================
// V6.4.8: FUNGSI PANGGILAN API AI
// =========================================================================

function callDeepSeekAPI(prompt) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
    },
    payload: JSON.stringify({
      model: 'deepseek-chat',
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
  const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
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
      'Authorization': 'Bearer ' + OPENROUTER_API_KEY
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
    alamatPerniagaan: aiData.alamatPerniagaan || ''
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
    
    // Dapatkan justifikasi (utamakan justifikasi_baru, kemudian justifikasi)
    const justifikasi = data.justifikasi_baru || data.justifikasi || 'Tiada justifikasi disediakan';
    
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
          <div class="info-value">📍 ${alamatPerniagaan}</div>
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
      © ${new Date().getFullYear()} PKK. Hak Cipta Terpelihara.</p>
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
      to: EMAIL_TO_SPI,
      cc: EMAIL_CC_SPTB,
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
          validateHttpsCertificates: false
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
    if (!appType) return createJSONOutput({ success: false, message: "Jenis permohonan tidak disediakan" });
    
    let mainFolder;
    try {
      mainFolder = DriveApp.getFolderById(MAIN_FOLDER_ID);
    } catch (e) {
      const folders = DriveApp.getFoldersByName(MAIN_FOLDER_NAME);
      if (folders.hasNext()) mainFolder = folders.next();
      else mainFolder = DriveApp.createFolder(MAIN_FOLDER_NAME);
    }
    
    let userFolder = findFolderInParent(mainFolder, data.user_name);
    if (!userFolder) userFolder = mainFolder.createFolder(data.user_name);
    
    let companyFolder = findFolderInParent(userFolder, data.company_name);
    if (!companyFolder) companyFolder = userFolder.createFolder(data.company_name);
    
    let typeFolder = findFolderInParent(companyFolder, appType.toUpperCase());
    if (!typeFolder) typeFolder = companyFolder.createFolder(appType.toUpperCase());
    
    const themeColor = data.user_color && data.user_color.trim() !== "" ? data.user_color : "#1a73e8";
    
    // V6.5.2: Tukar semua imej luaran kepada Base64 SEBELUM membina HTML penuh
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
    .print-container { max-width: 1000px; margin: 0 auto; background: white; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
    .print-header-strip { background: ${themeColor}; height: 8px; width: 100%; }
    .themed-box { background: ${themeColor}15; border-left: 4px solid ${themeColor}; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .themed-header { color: ${themeColor}; border-bottom: 2px solid ${themeColor}; padding-bottom: 8px; margin-bottom: 15px; }
    th { background: ${themeColor}20; color: #333; padding: 10px; border: 1px solid #ddd; font-weight: bold; }
    td { padding: 8px; border: 1px solid #ddd; }
    .print-header { padding: 20px; background: #f8f9fa; border-bottom: 2px solid ${themeColor}; }
    .print-header h1 { color: ${themeColor}; font-size: 24px; margin-bottom: 5px; }
    .print-header h2 { color: ${themeColor}; font-size: 18px; margin-bottom: 5px; }
    .print-header h3 { color: ${themeColor}; font-size: 16px; }
    .print-content { padding: 20px; }
    .info-row { display: flex; margin-bottom: 12px; padding: 8px; border-bottom: 1px solid #eee; }
    .info-label { width: 180px; font-weight: bold; color: #555; }
    .info-value { flex: 1; color: #333; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-sokong { background: #d4edda; color: #155724; }
    .status-tidak-sokong { background: #f8d7da; color: #721c24; }
    .status-lulus { background: #d4edda; color: #155724; }
    .status-tolak { background: #f8d7da; color: #721c24; }
    .footer { margin-top: 30px; padding-top: 20px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; }
    @media print {
      body { margin: 0; padding: 0; }
      .print-container { border: none; }
      .print-header-strip { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .themed-box { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="print-header-strip"></div>
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
    
    const pdfFile = typeFolder.createFile(blob);

    logActivity(
      data.user_name, 
      'CETAK_PDF', 
      `PDF Borang Semakan disimpan untuk ${data.company_name} (Warna: ${themeColor}) - Imej Base64`, 
      typeFolder.getId()
    );

    return createJSONOutput({
      success: true,
      folder_url: typeFolder.getUrl(),
      folder_id: typeFolder.getId(),
      file_url: pdfFile.getUrl(),
      file_id: pdfFile.getId(),
      file_name: fileName,
      folder_path: `${MAIN_FOLDER_NAME} > ${data.user_name} > ${data.company_name} > ${appType}`,
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
      data.justifikasi_baru !== undefined ? data.justifikasi_baru : (data.justifikasi !== undefined ? data.justifikasi : existingData[11]),
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
        justifikasi: data.justifikasi_baru !== undefined ? data.justifikasi_baru : (data.justifikasi !== undefined ? data.justifikasi : existingData[11]),
        pautan: (data.pautan && data.pautan.toString().trim() !== "") ? data.pautan : existingData[10],
        date_submit: dateSubmitValue,
        syor_lawatan: syorLawatanValue
      };

      try {
        addToSiasatQueue(emailData);
        console.log(`[V6.5.0] SPI SIASAT queued for daily 10AM for row ${rowNum}: ${emailData.syarikat}`);
      } catch (queueError) {
        console.error(`[V6.5.0] Failed to queue SPI SIASAT on update: ${queueError.toString()}`);
      }
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
        pelulus: data.pelulus !== undefined ? data.pelulus : existingData[25], // KOD BARU DITAMBAH
        justifikasi: data.justifikasi_baru !== undefined ? data.justifikasi_baru : (data.justifikasi !== undefined ? data.justifikasi : existingData[11]),
        pautan: (data.pautan && data.pautan.toString().trim() !== "") ? data.pautan : existingData[10],
        date_submit: dateSubmitValue,
        syor_lawatan: syorLawatanValue
      };

      try {
        addToPemutihanQueue(emailDataPemutihan);
        console.log(`[V6.5.0] SPI PEMUTIHAN queued for Friday 11AM for row ${rowNum}: ${emailDataPemutihan.syarikat}`);
      } catch (queueError) {
        console.error(`[V6.5.0] Failed to queue SPI PEMUTIHAN on update: ${queueError.toString()}`);
      }
    }
    
    // === UPDATE KE DALAM QUEUE - Kolum P & Q (16 & 17) ===
    if (data.date_submit === '') {
        sheet.getRange(rowNum, 16, 1, 2).clearContent();
        removeFromQueue(existingData[0], 'SIASAT_QUEUE');
        removeFromQueue(existingData[0], 'PEMUTIHAN_QUEUE');
    } else {
        if (syorLawatanYA && dateSubmitExists && hantarEmelSPI) {
            sheet.getRange(rowNum, 16, 1, 1).setValue("DALAM QUEUE");
        }
        if (syorLawatanPemutihan && tarikhLulusExists && hantarEmelSPIPemutihan) {
            sheet.getRange(rowNum, 16, 1, 1).setValue("DALAM QUEUE");
        }
    }
    
    const actionType = (data.syor_status === "" && existingData[13] !== "") ? 'UNDO_RECOMMENDATION' : 'UPDATE_RECORD';
    const actionDesc = actionType === 'UNDO_RECOMMENDATION' 
      ? `Undo syor di baris ${rowNum} untuk ${data.syarikat || existingData[0] || 'syarikat'}`
      : `Rekod dikemaskini di baris ${rowNum} untuk ${data.syarikat || existingData[0] || 'syarikat'}`;
    logActivity(userName, actionType, actionDesc, '');

    return createJSONOutput({ 
      status: "success", 
      action: "updated", 
      row: rowNum,
      message: actionType === 'UNDO_RECOMMENDATION' ? "Syor berjaya dibatalkan" : "Rekod berjaya dikemaskini"
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
      const folderResult = createUserFolderStructure(data.syarikat, data.start_date, data.jenis, data.pengesyor);
      if (folderResult.success) {
        folderUrl = folderResult.folderUrl;
        folderId = folderResult.folderId;
      }
    }
    
    // Susunan kolum: A-O (1-15) | P-Q (16-17) STATUS & TARIKH HANTAR SPI | R-X (18-24) | Y-AB (25-28) | AC (29) BORANG JSON
    const newRow = [
      // A-O (Kolum 1-15)
      data.syarikat||"", data.cidb||"", data.gred||"", data.jenis||"", 
      data.negeri||"", data.tarikh_surat_terdahulu||"", data.tatatertib||"", 
      data.start_date||"", data.syor_lawatan||"", data.date_submit||"", 
      folderUrl || data.pautan||"", 
      data.justifikasi||"", data.pengesyor||"", 
      data.syor_status||"", data.tarikh_syor||"",
      // P-Q (Kolum 16-17): STATUS HANTAR SPI & TARIKH HANTAR SPI
      data.hantar_emel_spi ? "DALAM QUEUE" : "",  // P (16) - Status Hantar SPI
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
      data.borang_json||""
    ];

    const targetRange = sheet.getRange(targetRow, 1, 1, newRow.length);
    targetRange.setValues([newRow]);
    cache.put("firstEmptyRow_" + SHEET_NAME, (targetRow + 1).toString(), 300);

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
        justifikasi: data.justifikasi || "",
        pautan: folderUrl || data.pautan || "",
        date_submit: data.date_submit || "",
        syor_lawatan: data.syor_lawatan || ""
      };

      try {
        addToSiasatQueue(emailData);
        console.log(`[V6.5.0] SPI SIASAT queued for daily 10AM on insert for row ${targetRow}: ${emailData.syarikat}`);
      } catch (queueError) {
        console.error(`[V6.5.0] Failed to queue SPI SIASAT on insert: ${queueError.toString()}`);
      }
    }
    
    const response = { status: "success", action: "inserted", row: targetRow, message: "Data dimasukkan di baris " + targetRow };
    if (folderUrl) { response.pautan = folderUrl; response.folderId = folderId; }
    return createJSONOutput(response);

  } catch (error) {
    logActivity("System", 'ERROR', `Ralat tambah rekod: ${error.toString()}`, '');
    return createJSONOutput({ status: "error", message: error.toString() });
  }
}

/**
 * Fungsi untuk mengendalikan padam rekod
 * V6.5.0: Menambah perlindungan ketat - hanya pemohon asal (pengesyor) atau ADMIN boleh padam_semua
 */
function handleDeleteRecord(data, sheet) {
  try {
    const userName = data.user || "System";
    const rowNum = parseInt(data.row);
    const deleteType = data.deleteType;
    const email = data.email || '';
    
    if (!rowNum || rowNum < 2) return createJSONOutput({ status: "error", message: "Baris tidak sah" });
    
    if (deleteType === 'padam_semua') {
      // V6.5.0: PERLINDUNGAN KETAT - Hanya ADMIN atau pengesyor asal yang boleh padam semua
      
      // Dapatkan data sedia ada pada baris tersebut
      const existingDataRange = sheet.getRange(rowNum, 1, 1, TOTAL_COLUMNS);
      const existingData = existingDataRange.getValues()[0];
      const existingPengesyor = existingData[12] ? existingData[12].toString().trim() : '';
      
      // Semak jika pengguna adalah ADMIN atau pengesyor asal
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
      
      sheet.deleteRow(rowNum);
      logActivity(userName, 'DELETE_RECORD', `Rekod dipadam sepenuhnya di baris ${rowNum}`, '');
      return createJSONOutput({ status: "success", message: "Rekod berjaya dipadam sepenuhnya", action: "deleted_full" });
      
    } else if (deleteType === 'padam_syor') {
      // Untuk padam syor, mana-mana pengguna yang dibenarkan boleh lakukan
      const rangeToClear = sheet.getRange(rowNum, 13, 1, 3);
      rangeToClear.clearContent();
      logActivity(userName, 'CLEAR_RECOMMENDATION', `Syor dikosongkan di baris ${rowNum}`, '');
      return createJSONOutput({ status: "success", message: "Syor berjaya dikosongkan", action: "cleared_syor" });
    } else {
      return createJSONOutput({ status: "error", message: "Jenis padam tidak sah" });
    }
  } catch (error) {
    logActivity("System", 'ERROR', `Ralat padam rekod: ${error.toString()}`, '');
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
    const startDate = row[7];
    if (startDate) {
      const date = new Date(startDate);
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

function getApplicationsData(role, userName) {
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
  
  const cache = CacheService.getScriptCache();
  cache.put("firstEmptyRow_" + SHEET_NAME, firstEmptyRow.toString(), 300);

  const dataRange = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
  const data = dataRange.getDisplayValues();
  const headers = data.shift();

  let filteredData = data.filter((row, index) => { return row[0] && row[0].toString().trim() !== ""; });

  if (role === ROLE_PENGESYOR && userName) {
    filteredData = filteredData.filter(row => row[12] && row[12].toString().toUpperCase() === userName.toUpperCase());
  } else if (role === ROLE_PELULUS && userName) {
    filteredData = filteredData.filter(row => {
      const syorStatus = row[13];
      return syorStatus && syorStatus.toString().trim() !== "";
    });
  }

  const jsonData = filteredData.map((row, index) => {
    return {
      row: index + 2, 
      syarikat: row[0], cidb: row[1], gred: row[2], jenis: row[3], negeri: row[4], 
      tarikh_surat_terdahulu: row[5], tatatertib: row[6], start_date: row[7], 
      syor_lawatan: row[8], date_submit: row[9], pautan: row[10], justifikasi: row[11], 
      pengesyor: row[12], syor_status: row[13], tarikh_syor: row[14],
      // P-Q: Status & Tarikh Hantar SPI
      status_hantar_spi: row[15] || "", 
      tarikh_hantar_spi: row[16] || "",
      // R-X
      lawatan_tarikh: row[17], lawatan_submit_sptb: row[18], lawatan_syor: row[19], 
      alamat_perniagaan: row[20], jenis_konsultansi: row[21], alasan: row[22], 
      kelulusan: row[23],
      // Y-AB
      tarikh_lulus: row[24], pelulus: row[25], ubah_maklumat: row[26], ubah_gred: row[27],
      // AC
      borang_json: row[28] || ""
    };
  });
  
  return createJSONOutput(jsonData);
}

// === HELPER FUNCTIONS ===
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

function handleCreateDriveFolderAction(data) {
  try {
    const companyName = data.company_name;
    const userName = data.user_name;
    const mainFolderId = data.main_folder_id || MAIN_FOLDER_ID;
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
    
    let companyFolder = findFolderInParent(userFolder, companyName);
    if (!companyFolder) companyFolder = userFolder.createFolder(companyName);
    
    let typeFolder = findFolderInParent(companyFolder, appType);
    if (!typeFolder) typeFolder = companyFolder.createFolder(appType);
    
    logActivity(userName, 'CREATE_FOLDER_USER', `Folder dicipta (V6.5.0): ${companyName} > ${appType}`, typeFolder.getId());

    return createJSONOutput({ success: true, folder_url: typeFolder.getUrl(), folder_id: typeFolder.getId(), folder_path: `${MAIN_FOLDER_NAME} > ${userName} > ${companyName} > ${appType}`, user_folder_url: userFolder.getUrl(), message: `Folder berjaya dicipta` });
  } catch (err) {
    return createJSONOutput({ success: false, message: `Gagal mencipta folder: ${err.toString()}` });
  }
}

function createUserFolderStructure(syarikat, startDate, jenisPermohonan, pengesyor) {
  try {
    const dateObj = new Date(startDate);
    const formattedDate = formatDateForFolder(startDate);
    const typeFolderName = `${jenisPermohonan.toUpperCase()} - ${formattedDate}`;
    const companyFolderName = syarikat.toUpperCase();
    
    let mainFolder;
    try { mainFolder = DriveApp.getFolderById(MAIN_FOLDER_ID); } 
    catch (e) {
      const folders = DriveApp.getFoldersByName(MAIN_FOLDER_NAME);
      if (folders.hasNext()) mainFolder = folders.next();
      else mainFolder = DriveApp.createFolder(MAIN_FOLDER_NAME);
    }
    
    let userFolder = findFolderInParent(mainFolder, pengesyor);
    if (!userFolder) userFolder = mainFolder.createFolder(pengesyor);
    
    let companyFolder = findFolderInParent(userFolder, companyFolderName);
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
  const result = handleCreateDriveFolderAction({ application_type: "BARU - 21-04-2026", company_name: "SYARIKAT TEST", user_name: "Zariff Fahmi", main_folder_id: MAIN_FOLDER_ID });
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
    const userEmail = Session.getActiveUser().getEmail();
    MailApp.sendEmail({ to: userEmail, subject: "Test Permission V6.5.0", body: "Test sahaja.", name: EMAIL_SENDER_NAME });
    return createJSONOutput({ success: true, message: `Emel ujian berjaya dihantar ke ${userEmail} dari ${EMAIL_SENDER_NAME}.` });
  } catch (error) {
    return createJSONOutput({ success: false, message: `Gagal menghantar emel ujian: ${error.toString()}` });
  }
}

function testSendSPIEmail() {
  const testData = { syarikat: "SYARIKAT UJIAN SDN BHD", cidb: "CIDB12345678", gred: "G7", jenis: "BARU", alamat_perniagaan: "No. 123, Jalan Test, Taman Ujian, 50000 Kuala Lumpur", pengesyor: "Ahmad bin Abdullah", justifikasi: "Ini adalah justifikasi ujian", pautan: "https://drive.google.com", date_submit: "25-04-2026" };
  const result = sendAutoEmailSPI(testData);
  console.log(JSON.stringify(result));
  return result;
}

function testCheckAuthWithEmail() {
  const testEmail1 = "pengesyor@kuskop.gov.my";
  const result1 = handleCheckAuth(testEmail1);
  console.log(result1.getContent());
  
  // Test untuk PENGESYOR dengan Firebase code
  const testEmail2 = "zariff.zainudin@kuskop.gov.my";
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
// FUNGSI BERJADUAL: KUMPULAN EMEL PEMUTIHAN (SETIAP JUMAAT 10 PAGI - Kitaran 2 Minggu)
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
      <p>Sistem Bersepadu SPTB<br>© ${new Date().getFullYear()} PKK. Hak Cipta Terpelihara.</p>
      <p>Dijana pada: ${new Date().toLocaleString('ms-MY')}</p>
    </div>
  </div>
</body>
</html>`;

  const plainBody = `NOTIS DWI-MINGGUAN LAWATAN SPI (PEMUTIHAN)\n\nBerikut adalah senarai ${queue.length} permohonan pemutihan minggu ini:\n\n${textList}\n*** Emel automatik oleh Sistem STB ***`;

  try {
    MailApp.sendEmail({ to: EMAIL_TO_SPI, cc: EMAIL_CC_SPTB, subject: subject, htmlBody: htmlBody, body: plainBody, name: EMAIL_SENDER_NAME });
    
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
  const hariSemasa = parseInt(Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "u"));
  if (hariSemasa === 6 || hariSemasa === 7) {
    console.log("Hari ini adalah hujung minggu (Sabtu/Ahad). Penghantaran Siasat Biasa ditangguhkan ke hari Isnin.");
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
      <p>Sistem Bersepadu SPTB<br>© ${new Date().getFullYear()} PKK. Hak Cipta Terpelihara.</p>
      <p>Dijana pada: ${new Date().toLocaleString('ms-MY')}</p>
    </div>
  </div>
</body>
</html>`;

  const plainBody = `NOTIS HARIAN LAWATAN SPI\n\nSenarai ${queue.length} permohonan siasat biasa hari ini:\n\n${textList}\n*** Emel automatik oleh Sistem STB ***`;

  try {
    MailApp.sendEmail({ to: EMAIL_TO_SPI, cc: EMAIL_CC_SPTB, subject: subject, htmlBody: htmlBody, body: plainBody, name: EMAIL_SENDER_NAME });
    
    // Update SPI status dalam sheet
    updateSPIStatusInSheet(queue);
    
    props.deleteProperty('SIASAT_QUEUE');
    logActivity('System', 'BATCH_EMAIL_SIASAT', `Berjaya menghantar emel harian siasat untuk ${queue.length} syarikat.`, '');
  } catch (error) {
    console.error("Gagal menghantar emel harian siasat:", error);
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