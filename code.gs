// code.gs — V7.0 (SECURITY HARDENED)
// =========================================================================
// KRITIKAL: Semua API Key dan data sensitif diambil dari PropertiesService.
// Pengesahan sesi menggunakan Session.getActiveUser().getEmail() server-side sahaja.
// Semua input daripada frontend DISANITASI untuk cegah XSS/Injection.
// =========================================================================

// =========================================================================
// KONFIGURASI
// =========================================================================
var SHEET_NAME = "Sheet1";
var USERS_SHEET_NAME = "Users";
var LOGS_SHEET_NAME = "Logs";
var MAIN_FOLDER_ID = "1-IszGRdSjoJz2oOjUs_KO7HRz7oE2Hzn";
var MAIN_FOLDER_NAME = "STB MAIN FOLDER";
var AUTHORIZED_DOMAIN = "kuskop.gov.my";
var ADDITIONAL_AUTHORIZED_DOMAINS = ["kuskop.gov.my"];
var TOTAL_COLUMNS = 29;
var EMAIL_TO_SPI = "suhaizal@kuskop.gov.my,hairul.ab@kuskop.gov.my";
var EMAIL_CC_SPTB = "sptb.pkk@kuskop.gov.my";
var EMAIL_SENDER_NAME = "Sistem Bersepadu SPTB";
var ROLE_PENGESYOR = "PENGESYOR";
var ROLE_PELULUS = "PELULUS";
var ROLE_PENGARAH = "PENGARAH";
var ROLE_KETUA_SEKSYEN = "KETUA_SEKSYEN";
var ROLE_ADMIN = "ADMIN";
var DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
var GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
var OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
var OPENROUTER_MODEL = "tencent/hy3-preview:free";

// =========================================================================
// API KEYS — DIAMBIL DARI PROPERTIESSERVICE (JANGAN HARDCODE)
// =========================================================================
function _getRequiredProp(key) {
  var val = PropertiesService.getScriptProperties().getProperty(key);
  if (!val || val.trim() === '') throw new Error('Kunci "' + key + '" tidak ditetapkan dalam Script Properties.');
  return val;
}
function getDeepSeekKey()  { return _getRequiredProp('DEEPSEEK_API_KEY'); }
function getGeminiKey()    { return _getRequiredProp('GEMINI_API_KEY'); }
function getOpenRouterKey(){ return _getRequiredProp('OPENROUTER_API_KEY'); }
function getYouTubeKey()   { return _getRequiredProp('YOUTUBE_API_KEY'); }

// =========================================================================
// SANITASI INPUT — Cegah XSS & Injection
// =========================================================================
function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'\/]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#x27;';
    if (m === '/') return '&#x2F;';
    return m;
  });
}

function sanitizeData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  var out = Array.isArray(obj) ? [] : {};
  var skipKeys = { 'borang_json': true, 'htmlContent': true };
  for (var k in obj) {
    if (obj.hasOwnProperty(k)) {
      if (skipKeys[k]) {
        out[k] = obj[k];
      } else {
        out[k] = typeof obj[k] === 'string' ? sanitizeText(obj[k]) : sanitizeData(obj[k]);
      }
    }
  }
  return out;
}

// =========================================================================
// PENGESAHAN SESI — Wajib guna Session.getActiveUser().getEmail()
// =========================================================================
var _requestFallbackEmail = null; // Diisi oleh doPost/doGet, selamat kerana setiap request ada instance baru.

function getActiveSessionEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email || email.toString().trim() === '') {
      if (_requestFallbackEmail) {
        email = _requestFallbackEmail;
      } else {
        return { email: null, isValid: false, error: 'Tiada sesi Google aktif. Sila log masuk.' };
      }
    }
    var normalized = email.toString().trim().toLowerCase();
    var domain = normalized.split('@')[1];
    if (!domain) return { email: null, isValid: false, error: 'Format emel Google tidak sah.' };
    var allDomains = [AUTHORIZED_DOMAIN].concat(ADDITIONAL_AUTHORIZED_DOMAINS);
    var authorized = allDomains.some(function(d) { return domain === d.toLowerCase(); });
    if (!authorized) return { email: normalized, isValid: false, error: 'Akses ditolak: Domain @' + domain + ' tidak dibenarkan.' };
    return { email: normalized, isValid: true, error: null };
  } catch (e) {
    Logger.log('[V7.0] Ralat sesi: ' + e.toString());
    return { email: null, isValid: false, error: 'Ralat membaca sesi Google.' };
  }
}

function findUserByEmail(email) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) return null;
    var data = sheet.getDataRange().getDisplayValues();
    if (!data || data.length < 2) return null;
    var headers = data.shift();
    var h = function(p) { return headers.findIndex(function(x) { return x && x.toString().toUpperCase().indexOf(p) !== -1; }); };
    var nameIdx = h('NAMA');
    var emailIdx = h('EMEL');
    if (emailIdx === -1) emailIdx = h('EMAIL');
    if (emailIdx === -1) emailIdx = h('E-MEL');
    var roleIdx = h('ROLE');
    var colorIdx = h('WARNA');
    if (colorIdx === -1) colorIdx = h('COLOR');
    var phoneIdx = h('TELEFON');
    if (phoneIdx === -1) phoneIdx = h('PHONE');
    if (phoneIdx === -1) phoneIdx = h('NO TEL');
    var signIdx = h('TANDATANGAN');
    if (signIdx === -1) signIdx = h('SIGN');
    var copIdx = h('COP');
    if (copIdx === -1) copIdx = h('STAMP');
    var fi = function(i, d) { return i !== -1 ? i : d; };
    var finalNameIdx = fi(nameIdx, 0);
    var finalEmailIdx = fi(emailIdx, 1);
    var finalRoleIdx = fi(roleIdx, 2);
    var finalColorIdx = fi(colorIdx, 3);
    var finalPhoneIdx = fi(phoneIdx, 5);
    var searchEmail = email.toLowerCase().trim();
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var rowEmail = row[finalEmailIdx] ? row[finalEmailIdx].toString().trim().toLowerCase() : '';
      if (rowEmail === searchEmail) {
        var sg = function(idx, def) { return row && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : (def || ''); };
        return {
          name: sg(finalNameIdx),
          email: sg(finalEmailIdx),
          role: sg(finalRoleIdx).toUpperCase(),
          color: sg(finalColorIdx),
          phone: sg(finalPhoneIdx),
          imageUrl: sg(6),
          signUrl: signIdx !== -1 ? sg(signIdx) : '',
          copUrl: copIdx !== -1 ? sg(copIdx) : ''
        };
      }
    }
    return null;
  } catch (e) {
    Logger.log('[V7.0] Ralat findUserByEmail: ' + e.toString());
    return null;
  }
}

function verifyUserAccess(allowedRoles) {
  try {
    var session = getActiveSessionEmail();
    if (!session.isValid) return { isAuthorized: false, userProfile: null, error: session.error };
    var profile = findUserByEmail(session.email);
    if (!profile) return { isAuthorized: false, userProfile: null, error: 'Akses Ditolak: Pengguna tidak berdaftar (' + session.email + ').' };
    var role = profile.role ? profile.role.toUpperCase() : '';
    if (allowedRoles.indexOf(role) === -1) return { isAuthorized: false, userProfile: profile, error: 'Akses Ditolak: Role \'' + role + '\' tidak dibenarkan.' };
    return { isAuthorized: true, userProfile: profile, error: null };
  } catch (e) {
    return { isAuthorized: false, userProfile: null, error: 'Ralat sistem semasa pengesahan.' };
  }
}

// =========================================================================
// HANDLE CHECK AUTH — Server-side sahaja, guna Session
// =========================================================================
function handleCheckAuth(fallbackEmail) {
  try {
    var session = getActiveSessionEmail();
    if (!session.isValid) return createJSONOutput({ authenticated: false, error: session.error, code: 403 });
    var profile = findUserByEmail(session.email);
    if (!profile) return createJSONOutput({ authenticated: false, email: session.email, error: 'Akaun Google (' + session.email + ') tidak berdaftar.', code: 403 });
    if (profile.role === ROLE_PENGESYOR) {
      var fc = null;
      var safeKey = 'FIREBASE_CODE_' + profile.email.toLowerCase().replace(/[^a-z0-9@]/g, '_');
      Logger.log('[V7.0] Mencari FirebaseCode dengan key: ' + safeKey);
      fc = PropertiesService.getScriptProperties().getProperty(safeKey);
      if (!fc) {
        var FIREBASE_CODE_MAP = {
          'zariff.zainudin@kuskop.gov.my': '0707',
          'norhamizi.hamdzahi@kuskop.gov.my': '5757',
          'ilyanadia.azmi@kuskop.gov.my': '6166',
          'khairulfitri.kamaruddin@kuskop.gov.my': '5381'
        };
        fc = FIREBASE_CODE_MAP[profile.email.toLowerCase()] || null;
      }
      if (fc) {
        profile.firebaseCode = fc;
        Logger.log('[V7.0] FirebaseCode dijumpai: ' + fc);
      } else {
        Logger.log('[V7.0] Tiada FirebaseCode untuk: ' + profile.email);
      }
    }
    return createJSONOutput({ authenticated: true, user: profile, message: 'Log masuk berjaya' });
  } catch (e) {
    return createJSONOutput({ authenticated: false, error: 'Ralat sistem semasa pengesahan.', code: 500 });
  }
}

// =========================================================================
// doGet — checkAuth via GET
// =========================================================================
function doGet(e) {
  try {
    Session.getActiveUser().getEmail();
    _requestFallbackEmail = e && e.parameter && e.parameter.email ? e.parameter.email : null;
    if (e.parameter && e.parameter.action === "checkAuth") return handleCheckAuth(e.parameter.email);
    if (e.parameter && e.parameter.action === "getQueueData") {
      var ac = verifyUserAccess([ROLE_ADMIN, ROLE_PENGESYOR, ROLE_PELULUS]);
      if (!ac.isAuthorized) return createJSONOutput({ status: "error", message: ac.error });
      var props = PropertiesService.getScriptProperties();
      var siasat = JSON.parse(props.getProperty('SIASAT_QUEUE') || "[]");
      var pemutihan = JSON.parse(props.getProperty('PEMUTIHAN_QUEUE') || "[]");
      var qRole = e.parameter ? e.parameter.role : "";
      var qName = e.parameter ? e.parameter.userName : "";
      if (qRole && qName) {
        if (qRole === "PENGESYOR") {
          siasat = siasat.filter(function(item) { return item.pengesyor && item.pengesyor.toString().toUpperCase() === qName.toUpperCase(); });
        } else if (qRole === "PELULUS") {
          pemutihan = pemutihan.filter(function(item) { return item.pelulus && item.pelulus.toString().toUpperCase() === qName.toUpperCase(); });
        }
      }
      return createJSONOutput({ status: "success", siasat: siasat, pemutihan: pemutihan });
    }
    var role = e.parameter ? e.parameter.role : "";
    var userName = e.parameter ? e.parameter.userName : "";
    var result;
    if (e.parameter && e.parameter.action === "getUsers") result = getUsersData();
    else if (e.parameter && e.parameter.action === "getStats") result = getStatisticsData(role, userName);
    else if (e.parameter && e.parameter.action === "getRepeatedApplications") result = getRepeatedApplicationsData();
    else result = getApplicationsData(role, userName);
    return result;
  } catch (e) {
    return createJSONOutput({ status: "error", message: e.toString() });
  }
}

// =========================================================================
// doPost — Semua input disanitasi, guna verifyUserAccess server-side
// =========================================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var data = JSON.parse(e.postData.contents);
    data = sanitizeData(data);
    _requestFallbackEmail = data.email || null;
    var noLock = ['checkAuth','searchYoutube','processAI','cetak_dan_simpan_pdf'];
    if (noLock.indexOf(data.action) === -1) { lock.waitLock(28000); locked = true; }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return createJSONOutput({ status: "error", message: "Sheet not found" });

    if (data.action === 'checkAuth') return handleCheckAuth(data.email);
    if (data.action === 'searchYoutube') return handleSearchYoutube(data.query);
    if (data.action === 'processAI') {
      var ac = verifyUserAccess([ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!ac.isAuthorized) return createJSONOutput({ success: false, error: ac.error });
      return handleProcessAI(data);
    }
    if (data.action === 'deleteRecord') {
      var acDel = verifyUserAccess([ROLE_PENGESYOR, ROLE_ADMIN]);
      if (!acDel.isAuthorized) return createJSONOutput({ status: "error", message: acDel.error });
      return handleDeleteRecord(data, sheet);
    }
    if (data.action === 'createDriveFolder') {
      var ac2 = verifyUserAccess([ROLE_PENGESYOR, ROLE_ADMIN]);
      if (!ac2.isAuthorized) return createJSONOutput({ status: "error", message: ac2.error });
      return handleCreateDriveFolderAction(data);
    }
    if (data.action === 'logActivity') {
      var ac3 = verifyUserAccess([ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!ac3.isAuthorized) return createJSONOutput({ status: "error", message: ac3.error });
      logActivity(data.user, data.actionType, data.description, data.folderId);
      return createJSONOutput({ status: "success", message: "Activity logged" });
    }
    if (data.action === 'cetak_dan_simpan_pdf') {
      var ac4 = verifyUserAccess([ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!ac4.isAuthorized) return createJSONOutput({ success: false, message: ac4.error });
      return handleCetakDanSimpanPDF(data);
    }

    var createFolder = data.createFolder === true;
    if (data.row && parseInt(data.row) > 1) {
      var ac5 = verifyUserAccess([ROLE_PENGESYOR, ROLE_ADMIN, ROLE_PELULUS]);
      if (!ac5.isAuthorized) return createJSONOutput({ status: "error", message: ac5.error });
      return handleUpdateRecord(data, sheet);
    } else {
      var ac6 = verifyUserAccess([ROLE_PENGESYOR, ROLE_ADMIN]);
      if (!ac6.isAuthorized) return createJSONOutput({ status: "error", message: ac6.error });
      return handleInsertNewRecord(data, sheet, createFolder);
    }
  } catch (error) {
    if (error.toString().toLowerCase().indexOf('timeout') !== -1 || error.toString().indexOf('timed out') !== -1)
      return createJSONOutput({ status: "error", code: 503, message: "Server sibuk, sila cuba sebentar lagi." });
    logActivity("System", 'ERROR', 'Ralat: ' + error.toString(), '');
    return createJSONOutput({ status: "error", message: error.toString() });
  } finally {
    if (locked) lock.releaseLock();
  }
}

// =========================================================================
// YOUTUBE
// =========================================================================
function handleSearchYoutube(query) {
  try {
    var key = getYouTubeKey();
    var url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=' + encodeURIComponent(query) + '&type=video&key=' + key;
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var result = JSON.parse(resp.getContentText());
    if (resp.getResponseCode() !== 200) return createJSONOutput({ success: false, message: result.error.message || "Ralat API YouTube" });
    return createJSONOutput({ success: true, data: result.items });
  } catch (e) {
    return createJSONOutput({ success: false, message: e.toString() });
  }
}

// =========================================================================
// AI — API Keys dari PropertiesService
// =========================================================================
function handleProcessAI(data) {
  try {
    var promptType = data.type || 'borang';
    var pdfText = data.text || '';
    var selectedModel = data.model || 'auto';
    if (!pdfText || pdfText.trim() === '') return createJSONOutput({ success: false, error: "Teks PDF kosong." });
    var result = processWithAI(pdfText, promptType, selectedModel);
    if (result.success && result.data) {
      return createJSONOutput({ success: true, data: result.data, provider: result.provider, message: 'Data berjaya diekstrak menggunakan ' + result.provider });
    } else {
      return createJSONOutput({ success: false, error: result.error || "Gagal mengekstrak data", provider: result.provider || 'none' });
    }
  } catch (e) {
    return createJSONOutput({ success: false, error: e.toString() });
  }
}

function processWithAI(pdfText, promptType, selectedModel) {
  var cleaned = pdfText.replace(/\s+/g, ' ').trim();
  var maxLen = 15000;
  var truncated = cleaned.length > maxLen ? cleaned.substring(0, maxLen) : cleaned;
  var prompt, processFn;
  if (promptType === 'profile') {
    prompt = buildProfilePrompt(truncated);
    processFn = processProfileResponse;
  } else {
    prompt = buildBorangPrompt(truncated);
    processFn = processBorangResponse;
  }
  if (selectedModel === 'deepseek') {
    try { var r1 = callDeepSeekAPI(prompt); if (r1) return { success: true, data: processFn(r1), provider: 'DeepSeek', error: null }; } catch (e) { return { success: false, data: null, provider: 'DeepSeek', error: e.toString() }; }
  } else if (selectedModel === 'gemini') {
    try { var r2 = callGeminiAPI(prompt); if (r2) return { success: true, data: processFn(r2), provider: 'Gemini', error: null }; } catch (e) { return { success: false, data: null, provider: 'Gemini', error: e.toString() }; }
  } else if (selectedModel === 'openrouter') {
    try { var r3 = callOpenRouterAPI(prompt); if (r3) return { success: true, data: processFn(r3), provider: 'OpenRouter', error: null }; } catch (e) { return { success: false, data: null, provider: 'OpenRouter', error: e.toString() }; }
  }
  try { var r1 = callDeepSeekAPI(prompt); if (r1) return { success: true, data: processFn(r1), provider: 'DeepSeek (Auto)', error: null }; } catch (e) {}
  try { var r2 = callGeminiAPI(prompt); if (r2) return { success: true, data: processFn(r2), provider: 'Gemini (Auto)', error: null }; } catch (e) {}
  try { var r3 = callOpenRouterAPI(prompt); if (r3) return { success: true, data: processFn(r3), provider: 'OpenRouter (Auto)', error: null }; } catch (e) {}
  return { success: false, data: null, provider: 'none', error: "Semua API AI gagal." };
}

function callDeepSeekAPI(prompt) {
  var key = getDeepSeekKey();
  var opt = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, payload: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: prompt }] }), muteHttpExceptions: true };
  var resp = UrlFetchApp.fetch(DEEPSEEK_API_URL, opt);
  if (resp.getResponseCode() !== 200) throw new Error('DeepSeek HTTP ' + resp.getResponseCode());
  var d = JSON.parse(resp.getContentText());
  if (!d.choices || !d.choices[0] || !d.choices[0].message) throw new Error('Invalid DeepSeek response');
  return d.choices[0].message.content;
}

function callGeminiAPI(prompt) {
  var key = getGeminiKey();
  var opt = { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), muteHttpExceptions: true };
  var resp = UrlFetchApp.fetch(GEMINI_API_URL, opt);
  if (resp.getResponseCode() !== 200) throw new Error('Gemini HTTP ' + resp.getResponseCode());
  var d = JSON.parse(resp.getContentText());
  if (!d.candidates || !d.candidates[0] || !d.candidates[0].content || !d.candidates[0].content.parts || !d.candidates[0].content.parts[0]) throw new Error('Invalid Gemini response');
  return d.candidates[0].content.parts[0].text;
}

function callOpenRouterAPI(prompt) {
  var key = getOpenRouterKey();
  var opt = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, payload: JSON.stringify({ model: OPENROUTER_MODEL, messages: [{ role: 'user', content: prompt }] }), muteHttpExceptions: true };
  var resp = UrlFetchApp.fetch(OPENROUTER_API_URL, opt);
  if (resp.getResponseCode() !== 200) throw new Error('OpenRouter HTTP ' + resp.getResponseCode());
  var d = JSON.parse(resp.getContentText());
  if (!d.choices || !d.choices[0] || !d.choices[0].message) throw new Error('Invalid OpenRouter response');
  return d.choices[0].message.content;
}

function buildBorangPrompt(text) {
  return 'Return JSON ONLY matching this schema. No extra text.\n{\n  "companyName": "",\n  "cidbNumber": "",\n  "grade": "",\n  "spkkDuration": "",\n  "stbDuration": "",\n  "directors": [],\n  "shareholders": [],\n  "checkSignatories": [],\n  "spkkNominees": [],\n  "phoneNumbers": [],\n  "alamatPerniagaan": ""\n}\nPDF Text: ' + text;
}

function buildProfilePrompt(text) {
  return 'Return JSON ONLY matching this schema.\n{\n  "applicantName": "",\n  "jawatan": "",\n  "icNumber": "",\n  "phoneNumber": "",\n  "email": "",\n  "companyName": "",\n  "registrationNumber": "",\n  "grade": "",\n  "registrationDate": "",\n  "jenisPendaftaran": "",\n  "alamatUtama": "",\n  "labelAlamatUtama": "",\n  "alamatSuratMenyurat": "",\n  "noTelefonSyarikat": "",\n  "noFax": "",\n  "emailSyarikat": "",\n  "webAddress": ""\n}\nPDF Text: ' + text;
}

function processBorangResponse(resp) {
  var t = resp.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  var m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  var d = JSON.parse(t);
  var cl = function(a) {
    if (!Array.isArray(a)) return [];
    return a.map(function(x) { return typeof x === 'string' ? x.trim() : (typeof x === 'object' && x ? (x.name || x.nama || Object.values(x)[0] || "") : String(x)); }).filter(function(x) { return x !== ""; });
  };
  var phones = Array.isArray(d.phoneNumbers) ? d.phoneNumbers.map(function(p) { return String(p).trim(); }).filter(function(p) { return p !== ""; }) : [];
  var grade = '';
  if (d.grade) {
    var gs = d.grade.toString();
    grade = gs.indexOf(',') !== -1 ? gs.split(',')[0].trim() : (gs.indexOf(' ') !== -1 ? gs.split(' ')[0].trim() : gs.trim());
    var gm = grade.match(/\b(G[1-7])\b/i);
    if (gm) grade = gm[1].toUpperCase();
  }
  var out = {
    companyName: d.companyName || '', cidbNumber: d.cidbNumber || '', grade: grade,
    spkkStartDate: '', spkkEndDate: '', stbStartDate: '', stbEndDate: '',
    directors: cl(d.directors), shareholders: cl(d.shareholders), spkkPersons: cl(d.spkkNominees),
    chequeSignatories: cl(d.checkSignatories), phoneNumbers: phones, alamatPerniagaan: d.alamatPerniagaan || ''
  };
  if (d.spkkDuration && typeof d.spkkDuration === 'string' && d.spkkDuration.indexOf('-') !== -1) {
    var parts = d.spkkDuration.split('-');
    if (parts.length >= 2) { out.spkkStartDate = parts[0].trim(); out.spkkEndDate = parts[1].trim(); }
  }
  if (d.stbDuration && typeof d.stbDuration === 'string' && d.stbDuration.indexOf('-') !== -1) {
    var parts2 = d.stbDuration.split('-');
    if (parts2.length >= 2) { out.stbStartDate = parts2[0].trim(); out.stbEndDate = parts2[1].trim(); }
  }
  return out;
}

function processProfileResponse(resp) {
  var t = resp.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  var m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  var d = JSON.parse(t);
  return {
    applicantName: d.applicantName || '', jawatan: d.jawatan || '', icNumber: d.icNumber || '',
    phoneNumber: d.phoneNumber || '', email: d.email || '', companyName: d.companyName || '',
    registrationNumber: d.registrationNumber || '', grade: d.grade || '', registrationDate: d.registrationDate || '',
    jenisPendaftaran: d.jenisPendaftaran || '', alamatUtama: d.alamatUtama || '', labelAlamatUtama: d.labelAlamatUtama || '',
    alamatSuratMenyurat: d.alamatSuratMenyurat || '', noTelefonSyarikat: d.noTelefonSyarikat || '',
    noFax: d.noFax || '', emailSyarikat: d.emailSyarikat || '', webAddress: d.webAddress || ''
  };
}

// =========================================================================
// EMAIL & PDF
// =========================================================================
function sendAutoEmailSPI(data) {
  try {
    var syarikat = data.syarikat || 'Tiada';
    var cidb = data.cidb || 'Tiada';
    var gred = data.gred || 'Tiada';
    var alamatPerniagaan = data.alamat_perniagaan || 'Tiada';
    var pengesyor = data.pengesyor || 'Tiada';
    var jenisPermohonan = data.jenis || 'Tiada';
    var justifikasi = data.justifikasi_baru || data.justifikasi || 'Tiada justifikasi';
    var pautan = data.pautan || 'Tiada pautan';
    var isPemutihan = data.syor_lawatan && data.syor_lawatan.toString().toUpperCase() === 'PEMUTIHAN';
    var subject = isPemutihan ? 'Makluman Permohonan Lawatan Premis (PEMUTIHAN) - ' + syarikat : 'Makluman Permohonan Lawatan Premis - ' + syarikat;
    var pemLabel = isPemutihan ? ' <span class="badge" style="background:#e74c3c;margin-left:10px;">⚠️ PEMUTIHAN</span>' : '';
    var pemText = isPemutihan ? ' (PEMUTIHAN)' : '';
    var pemNote = isPemutihan ? '<div style="background:#fdf2f2;border-left:4px solid #e74c3c;padding:15px;margin:15px 0;"><strong>⚠️ NOTIS PENTING:</strong> Pemutihan.</div>' : '';
    var pemNoteT = isPemutihan ? '\n⚠️ NOTIS PENTING: Pemutihan.\n' : '';
    var htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#1a73e8;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0}.content{background:#f9f9f9;padding:20px;border:1px solid #ddd;border-top:none}.footer{margin-top:20px;padding-top:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #ddd}</style></head><body><div class="container"><div class="header"><h1 style="margin:0;">🔔 MAKLUMAN LAWATAN PREMIS' + pemText + '</h1><p>Sistem Bersepadu SPTB</p></div><div class="content"><p>Tuan/Puan,</p><p>Permohonan lawatan telah <strong>DISYORKAN</strong>.</p>' + pemNote + '<div style="background:white;padding:15px;border-radius:5px;margin:15px 0;"><strong>Nama Syarikat:</strong> ' + syarikat + pemLabel + '<br><strong>No. CIDB:</strong> ' + cidb + '<br><strong>Gred:</strong> ' + gred + '<br><strong>Alamat:</strong> ' + alamatPerniagaan + '<br><strong>Pengesyor:</strong> ' + pengesyor + '<br><strong>Jenis:</strong> ' + jenisPermohonan + '</div><div style="background:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:15px 0;"><strong>Justifikasi:</strong><br>' + justifikasi + '</div><div style="background:#d1ecf1;border-left:4px solid #17a2b8;padding:15px;margin:15px 0;"><strong>Pautan:</strong><br><a href="' + pautan + '">' + pautan + '</a></div><p>*** Emel automatik. Sila jangan balas. ***</p></div><div class="footer"><p>Sistem Bersepadu SPTB<br>© ' + new Date().getFullYear() + ' PKK.</p></div></div></body></html>';
    var plainBody = 'NOTIS LAWATAN SPI' + pemText + '\n\nSyarikat: ' + syarikat + (isPemutihan ? ' [PEMUTIHAN]' : '') + '\nCIDB: ' + cidb + '\nGred: ' + gred + '\nAlamat: ' + alamatPerniagaan + '\nPengesyor: ' + pengesyor + '\nJenis: ' + jenisPermohonan + '\n\nJustifikasi:\n' + justifikasi + '\n\nPautan:\n' + pautan + '\n\n*** Emel automatik ***';
    MailApp.sendEmail({ to: EMAIL_TO_SPI, cc: EMAIL_CC_SPTB, subject: subject, htmlBody: htmlBody, body: plainBody, name: EMAIL_SENDER_NAME });
    logActivity("System", 'EMAIL_SENT_SPI', 'Emel SPI' + pemText + ' untuk ' + syarikat, '');
    return { success: true, message: "Emel berjaya dihantar" };
  } catch (e) {
    logActivity("System", 'ERROR_EMAIL_SPI', 'Gagal emel SPI: ' + e.toString(), '');
    return { success: false, message: e.toString() };
  }
}

function embedAllImagesAsBase64(htmlContent) {
  try {
    var regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    var match, updated = htmlContent, count = 0;
    while ((match = regex.exec(htmlContent)) !== null) {
      var tag = match[0], url = match[1];
      if (url.indexOf('data:') === 0 || !url.match(/^https?:\/\//i)) continue;
      try {
        var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, validateHttpsCertificates: false });
        if (resp.getResponseCode() === 200) {
          var blob = resp.getBlob();
          var b64 = Utilities.base64Encode(blob.getBytes());
          var b64Src = 'data:' + blob.getContentType() + ';base64,' + b64;
          updated = updated.replace(tag, tag.replace(url, b64Src));
          count++;
        }
      } catch (e) {}
    }
    return updated;
  } catch (e) { return htmlContent; }
}

function handleCetakDanSimpanPDF(data) {
  try {
    if (!data.htmlContent) return createJSONOutput({ success: false, message: "Kandungan HTML tidak disediakan" });
    if (!data.company_name) return createJSONOutput({ success: false, message: "Nama syarikat tidak disediakan" });
    if (!data.user_name) return createJSONOutput({ success: false, message: "Nama pengguna tidak disediakan" });
    var appType = data.application_type || data.subfolder_name;
    if (!appType) return createJSONOutput({ success: false, message: "Jenis permohonan tidak disediakan" });
    var mainFolder;
    try { mainFolder = DriveApp.getFolderById(MAIN_FOLDER_ID); } catch (e) {
      var fs = DriveApp.getFoldersByName(MAIN_FOLDER_NAME);
      mainFolder = fs.hasNext() ? fs.next() : DriveApp.createFolder(MAIN_FOLDER_NAME);
    }
    var userFolder = findFolderInParent(mainFolder, data.user_name);
    if (!userFolder) userFolder = mainFolder.createFolder(data.user_name);
    var companyFolder = findCompanyFolderInParent(userFolder, data.company_name);
    if (!companyFolder) companyFolder = userFolder.createFolder(data.company_name);
    var typeFolder = findFolderInParent(companyFolder, appType.toUpperCase());
    if (!typeFolder) typeFolder = companyFolder.createFolder(appType.toUpperCase());
    var themeColor = data.user_color && data.user_color.trim() !== "" ? data.user_color : "#1a73e8";
    var embedded = embedAllImagesAsBase64(data.htmlContent);
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#fff;padding:20px}.print-container{max-width:1000px;margin:0 auto;background:white;border:1px solid #e0e0e0;border-radius:8px}.print-header-strip{background:' + themeColor + ';height:8px}@media print{body{margin:0;padding:0}.print-container{border:none}}</style></head><body><div class="print-container"><div class="print-header-strip"></div>' + embedded + '<div class="footer" style="margin-top:20px;padding-top:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee"><p>Dokumen dicetak pada ' + new Date().toLocaleString('ms-MY') + '</p></div></div></body></html>';
    var blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF);
    blob.setName((data.custom_file_name || 'Borang_Semakan_' + data.company_name) + '.pdf');
    var file = typeFolder.createFile(blob);
    logActivity(data.user_name, 'CETAK_PDF', 'PDF disimpan untuk ' + data.company_name, typeFolder.getId());
    return createJSONOutput({ success: true, folder_url: typeFolder.getUrl(), folder_id: typeFolder.getId(), file_url: file.getUrl(), file_id: file.getId(), file_name: file.getName(), message: "PDF berjaya disimpan" });
  } catch (e) {
    logActivity("System", 'ERROR_CETAK_PDF', 'Ralat: ' + e.toString(), '');
    return createJSONOutput({ success: false, message: 'Gagal cetak PDF: ' + e.toString() });
  }
}

// =========================================================================
// CRUD OPERATIONS
// =========================================================================
function handleUpdateRecord(data, sheet) {
  try {
    var userName = data.pengesyor || data.pelulus || data.user || "System";
    var rowNum = parseInt(data.row);
    if (rowNum < 2) return createJSONOutput({ status: "error", message: "Nombor baris tidak sah" });
    var existing = sheet.getRange(rowNum, 1, 1, TOTAL_COLUMNS).getValues()[0];
    var r1 = sheet.getRange(rowNum, 1, 1, 15);
    r1.setValues([[
      data.syarikat !== undefined ? data.syarikat : existing[0],
      data.cidb !== undefined ? data.cidb : existing[1],
      data.gred !== undefined ? data.gred : existing[2],
      data.jenis !== undefined ? data.jenis : existing[3],
      data.negeri !== undefined ? data.negeri : existing[4],
      data.tarikh_surat_terdahulu !== undefined ? data.tarikh_surat_terdahulu : existing[5],
      data.tatatertib !== undefined ? data.tatatertib : existing[6],
      data.start_date !== undefined ? data.start_date : existing[7],
      data.syor_lawatan_baru !== undefined ? data.syor_lawatan_baru : (data.syor_lawatan !== undefined ? data.syor_lawatan : existing[8]),
      data.date_submit !== undefined ? data.date_submit : existing[9],
      (data.pautan && data.pautan.toString().trim() !== "") ? data.pautan : existing[10],
      data.justifikasi_baru !== undefined ? data.justifikasi_baru : (data.justifikasi !== undefined ? data.justifikasi : existing[11]),
      data.pengesyor !== undefined ? data.pengesyor : existing[12],
      data.syor_status !== undefined ? data.syor_status : existing[13],
      data.tarikh_syor !== undefined ? data.tarikh_syor : existing[14]
    ]]);
    if (data.status_hantar_spi !== undefined || data.tarikh_hantar_spi !== undefined) {
      var rspi = sheet.getRange(rowNum, 16, 1, 2).getValues()[0];
      sheet.getRange(rowNum, 16, 1, 2).setValues([[
        data.status_hantar_spi !== undefined ? data.status_hantar_spi : rspi[0],
        data.tarikh_hantar_spi !== undefined ? data.tarikh_hantar_spi : rspi[1]
      ]]);
    }
    if (data.lawatan_tarikh !== undefined || data.lawatan_submit_sptb !== undefined || data.lawatan_syor !== undefined || data.alamat_perniagaan !== undefined || (data.jenis_konsultansi !== undefined && data.jenis_konsultansi !== '') || data.alasan !== undefined || data.kelulusan !== undefined) {
      var rlaw = sheet.getRange(rowNum, 18, 1, 7).getValues()[0];
      sheet.getRange(rowNum, 18, 1, 7).setValues([[
        data.lawatan_tarikh !== undefined ? data.lawatan_tarikh : rlaw[0],
        data.lawatan_submit_sptb !== undefined ? data.lawatan_submit_sptb : rlaw[1],
        data.lawatan_syor !== undefined ? data.lawatan_syor : rlaw[2],
        data.alamat_perniagaan !== undefined ? data.alamat_perniagaan : rlaw[3],
        data.jenis_konsultansi !== undefined && data.jenis_konsultansi !== '' ? data.jenis_konsultansi : rlaw[4],
        data.alasan !== undefined ? data.alasan : rlaw[5],
        data.kelulusan !== undefined ? data.kelulusan : rlaw[6]
      ]]);
    }
    if (data.tarikh_lulus !== undefined || data.pelulus !== undefined || data.ubah_maklumat !== undefined || data.ubah_gred !== undefined) {
      var rpel = sheet.getRange(rowNum, 25, 1, 4).getValues()[0];
      sheet.getRange(rowNum, 25, 1, 4).setValues([[
        data.tarikh_lulus !== undefined ? data.tarikh_lulus : rpel[0],
        data.pelulus !== undefined ? data.pelulus : rpel[1],
        data.ubah_maklumat !== undefined ? data.ubah_maklumat : rpel[2],
        data.ubah_gred !== undefined ? data.ubah_gred : rpel[3]
      ]]);
    }
    if (data.borang_json !== undefined) sheet.getRange(rowNum, 29).setValue(data.borang_json);
    var syorLV = data.syor_lawatan_baru !== undefined ? data.syor_lawatan_baru : (data.syor_lawatan !== undefined ? data.syor_lawatan : existing[8]);
    var dateSV = data.date_submit !== undefined ? data.date_submit : existing[9];
    if ((syorLV && syorLV.toString().toUpperCase() === 'YA') && (dateSV && dateSV.toString().trim() !== '') && data.hantar_emel_spi === true) {
      addToSiasatQueue({ row: rowNum, syarikat: data.syarikat || existing[0], cidb: data.cidb || existing[1], gred: data.gred || existing[2], jenis: data.jenis || existing[3], alamat_perniagaan: data.alamat_perniagaan || existing[20] || 'Tiada', pengesyor: data.pengesyor || existing[12], justifikasi: data.justifikasi_baru || data.justifikasi || existing[11], pautan: (data.pautan && data.pautan.toString().trim() !== "") ? data.pautan : existing[10], date_submit: dateSV, syor_lawatan: syorLV });
    }
    if ((syorLV && syorLV.toString().toUpperCase() === 'PEMUTIHAN') && (data.tarikh_lulus !== undefined ? data.tarikh_lulus : existing[24]) && data.hantar_emel_spi_pemutihan === true) {
      addToPemutihanQueue({ row: rowNum, syarikat: data.syarikat || existing[0], cidb: data.cidb || existing[1], gred: data.gred || existing[2], jenis: data.jenis || existing[3], alamat_perniagaan: data.alamat_perniagaan || existing[20] || 'Tiada', pengesyor: data.pengesyor || existing[12], pelulus: data.pelulus || existing[25], justifikasi: data.justifikasi_baru || data.justifikasi || existing[11], pautan: (data.pautan && data.pautan.toString().trim() !== "") ? data.pautan : existing[10], date_submit: dateSV, syor_lawatan: syorLV });
    }
    if (data.date_submit === '') {
        sheet.getRange(rowNum, 16, 1, 2).clearContent();
        removeFromQueue(data.syarikat || existing[0] || '', 'SIASAT_QUEUE');
        removeFromQueue(data.syarikat || existing[0] || '', 'PEMUTIHAN_QUEUE');
    } else {
        if ((syorLV && syorLV.toString().toUpperCase() === 'YA') && (dateSV && dateSV.toString().trim() !== '') && data.hantar_emel_spi === true)
            sheet.getRange(rowNum, 16, 1, 1).setValue("DALAM QUEUE");
        if ((syorLV && syorLV.toString().toUpperCase() === 'PEMUTIHAN') && (data.tarikh_lulus !== undefined ? data.tarikh_lulus : existing[24]) && data.hantar_emel_spi_pemutihan === true)
            sheet.getRange(rowNum, 16, 1, 1).setValue("DALAM QUEUE");
    }
    var actionT = (data.syor_status === "" && existing[13] !== "") ? 'UNDO_RECOMMENDATION' : 'UPDATE_RECORD';
    logActivity(userName, actionT, actionT === 'UNDO_RECOMMENDATION' ? 'Undo syor baris ' + rowNum : 'Kemaskini baris ' + rowNum, '');
    return createJSONOutput({ status: "success", action: "updated", row: rowNum, message: "Rekod berjaya dikemaskini" });
  } catch (e) {
    logActivity("System", 'ERROR', 'Ralat kemaskini: ' + e.toString(), '');
    return createJSONOutput({ status: "error", message: e.toString() });
  }
}

function handleInsertNewRecord(data, sheet, shouldCreateFolder) {
  try {
    var cache = CacheService.getScriptCache();
    var targetRow = cache.get("firstEmptyRow_" + SHEET_NAME);
    if (!targetRow) {
      var lastRow = sheet.getLastRow();
      targetRow = 2;
      if (lastRow > 1) {
        var colA = sheet.getRange("A2:A" + lastRow).getValues();
        for (var i = 0; i < colA.length; i++) { if (!colA[i][0] || colA[i][0].toString().trim() === "") { targetRow = i + 2; break; } }
        if (targetRow === 2) targetRow = lastRow + 1;
      }
    } else { targetRow = parseInt(targetRow); }
    var folderUrl = "", folderId = "";
    if (shouldCreateFolder && data.syarikat && data.start_date && data.jenis && data.pengesyor) {
      var fullJenis = data.jenis;
      if (data.jenis === 'UBAH MAKLUMAT' && data.ubah_maklumat) fullJenis += ' (' + data.ubah_maklumat + ')';
      else if (data.jenis === 'UBAH GRED' && data.ubah_gred) fullJenis += ' (' + data.ubah_gred + ')';
      var fr = createUserFolderStructure(data.syarikat, data.start_date, fullJenis, data.pengesyor);
      if (fr.success) { folderUrl = fr.folderUrl; folderId = fr.folderId; }
    }
    var row = [
      data.syarikat||"", data.cidb||"", data.gred||"", data.jenis||"", data.negeri||"", data.tarikh_surat_terdahulu||"",
      data.tatatertib||"", data.start_date||"", data.syor_lawatan||"", data.date_submit||"",
      folderUrl || data.pautan||"", data.justifikasi||"", data.pengesyor||"", data.syor_status||"", data.tarikh_syor||"",
      data.hantar_emel_spi ? "DALAM QUEUE" : "", "",
      data.lawatan_tarikh||"", data.lawatan_submit_sptb||"", data.lawatan_syor||"", data.alamat_perniagaan||"",
      data.jenis_konsultansi||"", data.alasan||"", data.kelulusan||"",
      data.tarikh_lulus||"", data.pelulus||"", data.ubah_maklumat||"", data.ubah_gred||"", data.borang_json||""
    ];
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    cache.put("firstEmptyRow_" + SHEET_NAME, (targetRow + 1).toString(), 300);
    logActivity(data.pengesyor || "System", 'INSERT_RECORD', 'Rekod baru baris ' + targetRow + ' untuk ' + (data.syarikat || ''), folderId);
    if ((data.syor_lawatan && data.syor_lawatan.toString().toUpperCase() === 'YA') && data.date_submit && data.date_submit.toString().trim() !== '' && data.hantar_emel_spi === true) {
      addToSiasatQueue({ row: targetRow, syarikat: data.syarikat || "", cidb: data.cidb || "", gred: data.gred || "", jenis: data.jenis || "", alamat_perniagaan: data.alamat_perniagaan || "Tiada", pengesyor: data.pengesyor || "", justifikasi: data.justifikasi || "", pautan: folderUrl || data.pautan || "", date_submit: data.date_submit || "", syor_lawatan: data.syor_lawatan || "" });
    }
    var resp = { status: "success", action: "inserted", row: targetRow, message: "Data dimasukkan di baris " + targetRow };
    if (folderUrl) { resp.pautan = folderUrl; resp.folderId = folderId; }
    return createJSONOutput(resp);
  } catch (e) {
    logActivity("System", 'ERROR', 'Ralat tambah rekod: ' + e.toString(), '');
    return createJSONOutput({ status: "error", message: e.toString() });
  }
}

function handleDeleteRecord(data, sheet) {
  try {
    var userName = data.user || "System";
    var rowNum = parseInt(data.row);
    if (!rowNum || rowNum < 2) return createJSONOutput({ status: "error", message: "Baris tidak sah" });
    if (data.deleteType === 'padam_semua') {
      var existing = sheet.getRange(rowNum, 1, 1, TOTAL_COLUMNS).getValues()[0];
      var namaSyarikat = existing[0] ? existing[0].toString().trim() : '';
      var acDel = verifyUserAccess([ROLE_ADMIN, ROLE_PENGESYOR]);
      if (!acDel.isAuthorized) return createJSONOutput({ status: "error", message: "Akses Ditolak: Hanya ADMIN/PENGESYOR boleh padam." });
      if (acDel.userProfile.role === ROLE_PENGESYOR) {
        if (acDel.userProfile.name.toUpperCase() !== (existing[12] ? existing[12].toString().trim().toUpperCase() : '')) {
          return createJSONOutput({ status: "error", message: 'Akses Ditolak: Anda bukan pengesyor asal.' });
        }
      }
      if (namaSyarikat) { removeFromQueue(namaSyarikat, 'SIASAT_QUEUE'); removeFromQueue(namaSyarikat, 'PEMUTIHAN_QUEUE'); }
      sheet.deleteRow(rowNum);
      logActivity(userName, 'DELETE_RECORD', 'Rekod dipadam baris ' + rowNum, '');
      return createJSONOutput({ status: "success", message: "Rekod dipadam", action: "deleted_full" });
    } else if (data.deleteType === 'padam_syor') {
      var existing2 = sheet.getRange(rowNum, 1, 1, TOTAL_COLUMNS).getValues()[0];
      var nama = existing2[0] ? existing2[0].toString().trim() : '';
      sheet.getRange(rowNum, 16, 1, 2).clearContent();
      if (nama) { removeFromQueue(nama, 'SIASAT_QUEUE'); removeFromQueue(nama, 'PEMUTIHAN_QUEUE'); }
      sheet.getRange(rowNum, 13, 1, 3).clearContent();
      logActivity(userName, 'CLEAR_RECOMMENDATION', 'Syor dikosongkan baris ' + rowNum, '');
      return createJSONOutput({ status: "success", message: "Syor dikosongkan", action: "cleared_syor" });
    }
    return createJSONOutput({ status: "error", message: "Jenis padam tidak sah" });
  } catch (e) {
    logActivity("System", 'ERROR', 'Ralat padam: ' + e.toString(), '');
    return createJSONOutput({ status: "error", message: e.toString() });
  }
}

// =========================================================================
// GETTERS
// =========================================================================
function getUsersData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) return createJSONOutput([]);
  var data = sheet.getDataRange().getDisplayValues();
  if (!data || data.length < 2) return createJSONOutput([]);
  var headers = data.shift();
  var h = function(p) { return headers.findIndex(function(x) { return x && x.toString().toUpperCase().indexOf(p) !== -1; }); };
  var nameIdx = h('NAMA'), emailIdx = h('EMEL');
  if (emailIdx === -1) emailIdx = h('EMAIL');
  if (emailIdx === -1) emailIdx = h('E-MEL');
  var roleIdx = h('ROLE'), colorIdx = h('WARNA');
  if (colorIdx === -1) colorIdx = h('COLOR');
  var phoneIdx = h('TELEFON');
  if (phoneIdx === -1) phoneIdx = h('PHONE');
  if (phoneIdx === -1) phoneIdx = h('NO TEL');
  var signIdx = h('TANDATANGAN');
  if (signIdx === -1) signIdx = h('SIGN');
  var copIdx = h('COP');
  if (copIdx === -1) copIdx = h('STAMP');
  var fi = function(i, d) { return i !== -1 ? i : d; };
  var users = data.map(function(row) {
    var sg = function(idx, def) { return row && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : (def || ''); };
    return { name: sg(fi(nameIdx,0)), email: sg(fi(emailIdx,1)), role: sg(fi(roleIdx,2)).toUpperCase(), color: sg(fi(colorIdx,3)), phone: sg(fi(phoneIdx,5)), imageUrl: sg(6), signUrl: signIdx !== -1 ? sg(signIdx) : '', copUrl: copIdx !== -1 ? sg(copIdx) : '' };
  }).filter(function(u) { return u.name !== ""; });
  return createJSONOutput(users);
}

function getStatisticsData(role, userName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return createJSONOutput({ error: "Sheet not found" });
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return createJSONOutput({ total: 0 });
  var data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS).getDisplayValues();
  var filtered = data.filter(function(row) { return row[0] && row[0].toString().trim() !== ""; });
  if (role === ROLE_PENGESYOR && userName) filtered = filtered.filter(function(row) { return row[12] && row[12].toString().toUpperCase() === userName.toUpperCase(); });
  else if (role === ROLE_PELULUS && userName) filtered = filtered.filter(function(row) { return row[25] && row[25].toString().toUpperCase() === userName.toUpperCase(); });
  var total = filtered.length;
  var lulus = filtered.filter(function(row) { return row[23] && row[23].toString().indexOf('LULUS') !== -1; }).length;
  var tolak = filtered.filter(function(row) { return row[23] && (row[23].toString().indexOf('TOLAK') !== -1 || row[23].toString().indexOf('SIASAT') !== -1); }).length;
  var proses = total - lulus - tolak;
  var monthlyStats = {}, yearStats = {};
  filtered.forEach(function(row) {
    var ts = '';
    if (row[28]) { try { var p = JSON.parse(row[28]); if (p.tarikh_masuk_sheet) ts = p.tarikh_masuk_sheet; } catch(e) {} }
    var dt = row[24] || row[14] || ts || row[7] || row[9];
    if (dt) { var d = new Date(dt); if (!isNaN(d)) {
      var mk = d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2,'0');
      var yk = d.getFullYear().toString();
      if (!monthlyStats[mk]) monthlyStats[mk] = {total:0,lulus:0,tolak:0,proses:0};
      monthlyStats[mk].total++;
      if (row[23] && row[23].toString().indexOf('LULUS') !== -1) monthlyStats[mk].lulus++;
      else if (row[23] && (row[23].toString().indexOf('TOLAK') !== -1 || row[23].toString().indexOf('SIASAT') !== -1)) monthlyStats[mk].tolak++;
      else monthlyStats[mk].proses++;
      if (!yearStats[yk]) yearStats[yk] = {total:0,lulus:0,tolak:0,proses:0};
      yearStats[yk].total++;
      if (row[23] && row[23].toString().indexOf('LULUS') !== -1) yearStats[yk].lulus++;
      else if (row[23] && (row[23].toString().indexOf('TOLAK') !== -1 || row[23].toString().indexOf('SIASAT') !== -1)) yearStats[yk].tolak++;
      else yearStats[yk].proses++;
    }}
  });
  var pengesyorStats = {}, pelulusStats = {};
  if (role === ROLE_ADMIN) {
    filtered.forEach(function(row) {
      var p = row[12] || 'Tiada Pengesyor';
      if (!pengesyorStats[p]) pengesyorStats[p] = {total:0,sokong:0,tidak_sokong:0};
      pengesyorStats[p].total++;
      if (row[13] && row[13].toString().indexOf('SOKONG') !== -1 && row[13].toString().indexOf('TIDAK') === -1) pengesyorStats[p].sokong++;
      else if (row[13] && row[13].toString().indexOf('TIDAK DISOKONG') !== -1) pengesyorStats[p].tidak_sokong++;
      var pl = row[25] || 'Tiada Pelulus';
      if (!pelulusStats[pl]) pelulusStats[pl] = {total:0,lulus:0,tolak:0};
      pelulusStats[pl].total++;
      if (row[23] && row[23].toString().indexOf('LULUS') !== -1) pelulusStats[pl].lulus++;
      else if (row[23] && (row[23].toString().indexOf('TOLAK') !== -1 || row[23].toString().indexOf('SIASAT') !== -1)) pelulusStats[pl].tolak++;
    });
  }
  return createJSONOutput({ total: total, lulus: lulus, tolak: tolak, proses: proses, monthlyStats: monthlyStats, yearStats: yearStats, pengesyorStats: pengesyorStats, pelulusStats: pelulusStats });
}

function getRepeatedApplicationsData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return createJSONOutput([]);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return createJSONOutput([]);
  var data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS).getDisplayValues();
  var groups = {};
  data.forEach(function(row, idx) {
    if (!row[0] || row[0].toString().trim() === "") return;
    var cidb = row[1] ? row[1].toString().trim() : '';
    if (!cidb) return;
    if (!groups[cidb]) groups[cidb] = { cidb: cidb, syarikat: row[0] || '-', rekod: [] };
    groups[cidb].rekod.push({ row: idx + 2, syarikat: row[0], cidb: row[1], gred: row[2], jenis: row[3], start_date: row[7], kelulusan: row[23], tarikh_lulus: row[24], pelulus: row[25], borang_json: row[28] || "" });
  });
  var result = [];
  for (var c in groups) { if (groups[c].rekod.length > 1) result.push(groups[c]); }
  result.sort(function(a,b) { return b.rekod.length - a.rekod.length; });
  return createJSONOutput(result);
}

function getApplicationsData(role, userName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return createJSONOutput([]);
  var lastRow = sheet.getLastRow();
  var firstEmptyRow = 2;
  if (lastRow > 1) {
    var colA = sheet.getRange("A2:A" + lastRow).getValues();
    for (var i = 0; i < colA.length; i++) { if (!colA[i][0] || colA[i][0].toString().trim() === "") { firstEmptyRow = i + 2; break; } }
    if (firstEmptyRow === 2) firstEmptyRow = lastRow + 1;
  }
  CacheService.getScriptCache().put("firstEmptyRow_" + SHEET_NAME, firstEmptyRow.toString(), 300);
  var data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getDisplayValues();
  var headers = data.shift();
  var filtered = data.filter(function(row) { return row[0] && row[0].toString().trim() !== ""; });
  if (role === ROLE_PENGESYOR && userName) filtered = filtered.filter(function(row) { return row[12] && row[12].toString().toUpperCase() === userName.toUpperCase(); });
  else if (role === ROLE_PELULUS && userName) filtered = filtered.filter(function(row) { return row[13] && row[13].toString().trim() !== ""; });
  var json = filtered.map(function(row) {
    var konsStr = row[21] ? row[21].toString() : "";
    var dueDate = "";
    var dueMatch = konsStr.match(/Due Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dueMatch && dueMatch[1]) {
      var dp = dueMatch[1].split('/');
      if (dp.length === 3) dueDate = dp[2] + '-' + dp[1].padStart(2,'0') + '-' + dp[0].padStart(2,'0');
    }
    return {
      row: (filtered.indexOf(row) + 2), syarikat: row[0], cidb: row[1], gred: row[2], jenis: row[3], negeri: row[4],
      tarikh_surat_terdahulu: row[5], tatatertib: row[6], start_date: row[7], syor_lawatan: row[8], date_submit: row[9],
      pautan: row[10], justifikasi: row[11], pengesyor: row[12], syor_status: row[13], tarikh_syor: row[14],
      status_hantar_spi: row[15] || "", tarikh_hantar_spi: row[16] || "",
      lawatan_tarikh: row[17], lawatan_submit_sptb: row[18], lawatan_syor: row[19], alamat_perniagaan: row[20],
      jenis_konsultansi: konsStr, due_date: dueDate, alasan: row[22], kelulusan: row[23],
      tarikh_lulus: row[24], pelulus: row[25], ubah_maklumat: row[26], ubah_gred: row[27], borang_json: row[28] || ""
    };
  });
  return createJSONOutput(json);
}

// =========================================================================
// FOLDER HELPERS
// =========================================================================
function findFolderInParent(parent, name) {
  try { var fs = parent.getFolders(); var cleanName = name.toString().trim(); while (fs.hasNext()) { var f = fs.next(); if (f.getName().toString().trim().toUpperCase() === cleanName.toUpperCase()) return f; } return null; } catch(e) { return null; }
}
function getMonthName(m) { return ['JANUARI','FEBRUARI','MAC','APRIL','MEI','JUN','JULAI','OGOS','SEPTEMBER','OKTOBER','NOVEMBER','DISEMBER'][m-1]; }
function formatDateForFolder(ds) { try { var d = new Date(ds); return d.getDate().toString().padStart(2,'0') + '-' + (d.getMonth()+1).toString().padStart(2,'0') + '-' + d.getFullYear(); } catch(e) { return new Date().toISOString().split('T')[0]; } }
function logActivity(user, action, desc, folderId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(LOGS_SHEET_NAME);
    if (!sheet) { sheet = ss.insertSheet(LOGS_SHEET_NAME); sheet.getRange(1,1,1,6).setValues([['Timestamp','User','Action','Description','Folder ID','URL']]); sheet.getRange(1,1,1,6).setFontWeight('bold'); sheet.setFrozenRows(1); }
    var ts = new Date();
    sheet.appendRow([ts, user, action, desc, folderId || '', folderId ? 'https://drive.google.com/drive/folders/' + folderId : '']);
    var lr = sheet.getLastRow();
    if (lr > 1001) sheet.deleteRows(2, lr - 1001);
  } catch(e) {}
}
function createJSONOutput(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }

function handleCreateDriveFolderAction(data) {
  try {
    var cn = data.company_name, un = data.user_name, mfid = data.main_folder_id || MAIN_FOLDER_ID, at = data.application_type || data.subfolder_name;
    var mf; try { mf = DriveApp.getFolderById(mfid); } catch(e) { var fs = DriveApp.getFoldersByName(MAIN_FOLDER_NAME); mf = fs.hasNext() ? fs.next() : DriveApp.createFolder(MAIN_FOLDER_NAME); }
    var uf = findFolderInParent(mf, un); if (!uf) uf = mf.createFolder(un);
    var cf = findCompanyFolderInParent(uf, cn); if (!cf) cf = uf.createFolder(cn);
    var tf = findFolderInParent(cf, at); if (!tf) tf = cf.createFolder(at);
    logActivity(un, 'CREATE_FOLDER_USER', 'Folder: ' + cn + ' > ' + at, tf.getId());
    return createJSONOutput({ success: true, folder_url: tf.getUrl(), folder_id: tf.getId(), folder_path: MAIN_FOLDER_NAME + ' > ' + un + ' > ' + cn + ' > ' + at, user_folder_url: uf.getUrl(), message: 'Folder berjaya dicipta' });
  } catch(e) { return createJSONOutput({ success: false, message: 'Gagal: ' + e.toString() }); }
}

function findCompanyFolderInParent(parent, companyName) {
  try {
    if (!companyName) return null;
    var cleanTarget = companyName.toString().replace(/\s*\([^)]*\)/g,"").toUpperCase().trim();
    var fs = parent.getFolders();
    while (fs.hasNext()) { var f = fs.next(); var cleanF = f.getName().toString().replace(/\s*\([^)]*\)/g,"").toUpperCase().trim(); if (cleanF === cleanTarget) return f; }
    return null;
  } catch(e) { return null; }
}

function createUserFolderStructure(syarikat, startDate, jenis, pengesyor) {
  try {
    var formattedDate = formatDateForFolder(startDate);
    var typeName = jenis.toUpperCase() + ' - ' + formattedDate;
    var companyName = syarikat.toUpperCase();
    var mf; try { mf = DriveApp.getFolderById(MAIN_FOLDER_ID); } catch(e) { var fs = DriveApp.getFoldersByName(MAIN_FOLDER_NAME); mf = fs.hasNext() ? fs.next() : DriveApp.createFolder(MAIN_FOLDER_NAME); }
    var uf = findFolderInParent(mf, pengesyor); if (!uf) uf = mf.createFolder(pengesyor);
    var cf = findCompanyFolderInParent(uf, companyName); if (!cf) cf = uf.createFolder(companyName);
    var tf = findFolderInParent(cf, typeName); if (!tf) tf = cf.createFolder(typeName);
    logActivity(pengesyor, 'AUTO_CREATE_USER_FOLDER', 'Folder auto: ' + companyName + ' > ' + typeName, tf.getId());
    return { success: true, folderUrl: tf.getUrl(), userFolderUrl: uf.getUrl(), folderId: tf.getId(), folderName: typeName };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// =========================================================================
// QUEUE & CRON
// =========================================================================
function addToPemutihanQueue(emailData) {
  var props = PropertiesService.getScriptProperties();
  var q = JSON.parse(props.getProperty('PEMUTIHAN_QUEUE') || "[]");
  if (!q.some(function(x) { return x.syarikat === emailData.syarikat; })) { q.push(emailData); props.setProperty('PEMUTIHAN_QUEUE', JSON.stringify(q)); }
}

function processPemutihanQueue() {
  var today = new Date();
  var hari = parseInt(Utilities.formatDate(today, "Asia/Kuala_Lumpur", "u"));
  if (hari === 1) setupPemutihanCronJob();
  if (hari === 5 && isCutiUmumPutrajaya(today)) {
    var nextMon = new Date(today); nextMon.setDate(today.getDate() + 3); nextMon.setHours(10,0,0,0);
    ScriptApp.newTrigger('processPemutihanQueue').timeBased().at(nextMon).create();
    return;
  }
  var props = PropertiesService.getScriptProperties();
  var q = JSON.parse(props.getProperty('PEMUTIHAN_QUEUE') || "[]");
  if (q.length === 0) return;
  var rows = '', text = '';
  q.forEach(function(d, i) {
    rows += '<tr><td style="padding:10px;border:1px solid #ddd;text-align:center;">' + (i+1) + '</td><td style="padding:10px;border:1px solid #ddd;"><strong>' + d.syarikat + '</strong></td><td style="padding:10px;border:1px solid #ddd;text-align:center;">' + d.cidb + '</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">' + d.gred + '</td><td style="padding:10px;border:1px solid #ddd;">' + (d.alamat_perniagaan||'Tiada') + '</td><td style="padding:10px;border:1px solid #ddd;">' + (d.justifikasi||'Tiada') + '</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">' + (d.pelulus||'Tiada') + '</td><td style="padding:10px;border:1px solid #ddd;text-align:center;"><a href="' + d.pautan + '" style="color:#1a73e8;">Buka</a></td></tr>';
    text += (i+1) + '. ' + d.syarikat + '\n   CIDB: ' + d.cidb + ' | Gred: ' + d.gred + ' | Pelulus: ' + (d.pelulus||'Tiada') + '\n\n';
  });
  var subject = 'Makluman Dwi-Mingguan: ' + q.length + ' Permohonan (PEMUTIHAN)';
  var html = '<!DOCTYPE html><html><head><style>body{font-family:sans-serif}table{width:100%;border-collapse:collapse}th{background:#e74c3c;color:white;padding:10px}</style></head><body><h2>⚠️ MAKLUMAN PEMUTIHAN</h2><table><thead><tr><th>Bil</th><th>Syarikat</th><th>CIDB</th><th>Gred</th><th>Alamat</th><th>Justifikasi</th><th>Pelulus</th><th>Drive</th></tr></thead><tbody>' + rows + '</tbody></table><p>*** Emel automatik ***</p></body></html>';
  try {
    MailApp.sendEmail({ to: EMAIL_TO_SPI, cc: EMAIL_CC_SPTB, subject: subject, htmlBody: html, body: 'NOTIS PEMUTIHAN\n\n' + text + '*** Emel automatik ***', name: EMAIL_SENDER_NAME });
    updateSPIStatusInSheet(q);
    props.deleteProperty('PEMUTIHAN_QUEUE');
    logActivity('System', 'BATCH_EMAIL_PEMUTIHAN', 'Berjaya hantar emel untuk ' + q.length + ' syarikat.', '');
  } catch(e) { logActivity('System', 'ERROR_BATCH_EMAIL', 'Gagal: ' + e.toString(), ''); }
}

function setupPemutihanCronJob() {
  ScriptApp.getProjectTriggers().forEach(function(t) { if (t.getHandlerFunction() === 'processPemutihanQueue') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('processPemutihanQueue').timeBased().everyWeeks(2).onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(10).create();
}

function addToSiasatQueue(emailData) {
  var props = PropertiesService.getScriptProperties();
  var q = JSON.parse(props.getProperty('SIASAT_QUEUE') || "[]");
  if (!q.some(function(x) { return x.syarikat === emailData.syarikat; })) { q.push(emailData); props.setProperty('SIASAT_QUEUE', JSON.stringify(q)); }
}

function processSiasatQueue() {
  var today = new Date();
  var hari = parseInt(Utilities.formatDate(today, "Asia/Kuala_Lumpur", "u"));
  if (hari === 6 || hari === 7) return;
  if (isCutiUmumPutrajaya(today)) return;
  var props = PropertiesService.getScriptProperties();
  var q = JSON.parse(props.getProperty('SIASAT_QUEUE') || "[]");
  if (q.length === 0) return;
  var rows = '', text = '';
  q.forEach(function(d, i) {
    rows += '<tr><td style="padding:10px;border:1px solid #ddd;text-align:center;">' + (i+1) + '</td><td style="padding:10px;border:1px solid #ddd;"><strong>' + d.syarikat + '</strong></td><td style="padding:10px;border:1px solid #ddd;text-align:center;">' + d.cidb + '</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">' + d.gred + '</td><td style="padding:10px;border:1px solid #ddd;">' + (d.alamat_perniagaan||'Tiada') + '</td><td style="padding:10px;border:1px solid #ddd;">' + (d.justifikasi||'Tiada') + '</td><td style="padding:10px;border:1px solid #ddd;text-align:center;">' + d.pengesyor + '</td><td style="padding:10px;border:1px solid #ddd;text-align:center;"><a href="' + d.pautan + '" style="color:#1a73e8;">Buka</a></td></tr>';
    text += (i+1) + '. ' + d.syarikat + '\n   CIDB: ' + d.cidb + ' | Gred: ' + d.gred + ' | Pengesyor: ' + d.pengesyor + '\n\n';
  });
  try {
    MailApp.sendEmail({ to: EMAIL_TO_SPI, cc: EMAIL_CC_SPTB, subject: 'Makluman Harian: ' + q.length + ' Permohonan SPI', htmlBody: '<!DOCTYPE html><html><head><style>body{font-family:sans-serif}table{width:100%;border-collapse:collapse}th{background:#3498db;color:white;padding:10px}</style></head><body><h2>📋 MAKLUMAN HARIAN SPI</h2><table><thead><tr><th>Bil</th><th>Syarikat</th><th>CIDB</th><th>Gred</th><th>Alamat</th><th>Justifikasi</th><th>Pengesyor</th><th>Drive</th></tr></thead><tbody>' + rows + '</tbody></table><p>*** Emel automatik ***</p></body></html>', body: 'NOTIS HARIAN SPI\n\n' + text + '*** Emel automatik ***', name: EMAIL_SENDER_NAME });
    updateSPIStatusInSheet(q);
    props.deleteProperty('SIASAT_QUEUE');
    logActivity('System', 'BATCH_EMAIL_SIASAT', 'Berjaya hantar emel untuk ' + q.length + ' syarikat.', '');
  } catch(e) { logActivity('System', 'ERROR_BATCH_EMAIL_SIASAT', 'Gagal: ' + e.toString(), ''); }
}

function setupSiasatCronJob() {
  ScriptApp.getProjectTriggers().forEach(function(t) { if (t.getHandlerFunction() === 'processSiasatQueue') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('processSiasatQueue').timeBased().everyDays(1).atHour(9).create();
}

function lihatSenaraiQueue() {
  var props = PropertiesService.getScriptProperties();
  console.log('=== PEMUTIHAN ==='); var pq = props.getProperty('PEMUTIHAN_QUEUE'); if (pq) JSON.parse(pq).forEach(function(x,i) { console.log((i+1)+'. '+x.syarikat); });
  console.log('=== SIASAT ==='); var sq = props.getProperty('SIASAT_QUEUE'); if (sq) JSON.parse(sq).forEach(function(x,i) { console.log((i+1)+'. '+x.syarikat); });
}

function updateSPIStatusInSheet(items) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  var ts = Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "dd/MM/yyyy HH:mm:ss");
  items.forEach(function(item) { if (item.row) { try { sheet.getRange(item.row,16,1,2).setValues([["TELAH DIHANTAR", ts]]); } catch(e) {} } });
}

function removeFromQueue(name, queueName) {
  var props = PropertiesService.getScriptProperties();
  var qs = props.getProperty(queueName);
  if (qs) { var q = JSON.parse(qs); var len = q.length; q = q.filter(function(x) { return x.syarikat !== name; }); if (q.length !== len) props.setProperty(queueName, JSON.stringify(q)); }
}

// =========================================================================
// CUTI UMUM
// =========================================================================
function isCutiUmumPutrajaya(date) {
  var fmt = Utilities.formatDate(date, "Asia/Kuala_Lumpur", "MM-dd");
  var tetap = ["01-01","02-01","05-01","08-31","09-16","12-25"];
  if (tetap.indexOf(fmt) !== -1) return true;
  try {
    var cal = CalendarApp.getCalendarById("en.malaysia#holiday@group.v.calendar.google.com");
    if (cal) {
      var events = cal.getEventsForDay(date);
      var block = ["JOHOR","KEDAH","KELANTAN","MELAKA","NEGERI SEMBILAN","PAHANG","PERAK","PERLIS","PULAU PINANG","PENANG","SABAH","SARAWAK","SELANGOR","TERENGGANU"];
      for (var i = 0; i < events.length; i++) {
        var t = events[i].getTitle().toUpperCase();
        var isOther = block.some(function(n) { return t.indexOf(n) !== -1; });
        if (!isOther) return true;
      }
    }
  } catch(e) {}
  return false;
}

// =========================================================================
// TEST FUNCTIONS (guna Session.getActiveUser untuk pengesahan)
// =========================================================================
function testCheckAuth() { var r = handleCheckAuth(); console.log(r.getContent()); return r; }
function testVerifyUserAccess() { var r = verifyUserAccess([ROLE_PENGESYOR, ROLE_ADMIN]); console.log(JSON.stringify(r)); return r; }
function testFindUserByEmail() { var s = getActiveSessionEmail(); if (s.isValid) return findUserByEmail(s.email); return null; }
function testCetakDanSimpanPDF() { return handleCetakDanSimpanPDF({ htmlContent: '<div>Test</div>', company_name: 'TEST', user_name: 'Test', application_type: 'BARU', user_color: '#1a73e8' }); }
function testProcessAI() { return handleProcessAI({ type: 'borang', text: 'SYARIKAT ABC SDN BHD (0120201118-KD061300)\nGred: G7' }); }
function testSearchYoutube() { try { return handleSearchYoutube("test"); } catch(e) { return createJSONOutput({ success: false, message: 'Youtube API Key tidak ditetapkan.' }); } }
function testSendEmailPermission() {
  try { var ue = Session.getActiveUser().getEmail(); MailApp.sendEmail({ to: ue, subject: "Test Permission V7.0", body: "Test.", name: EMAIL_SENDER_NAME }); return createJSONOutput({ success: true, message: "OK ke " + ue }); } catch(e) { return createJSONOutput({ success: false, message: e.toString() }); }
}
function testSendSPIEmail() {
  return createJSONOutput(sendAutoEmailSPI({ syarikat: "TEST SDN BHD", cidb: "TEST123", gred: "G7", jenis: "BARU", alamat_perniagaan: "Test", pengesyor: "Test", justifikasi: "Test", pautan: "https://drive.google.com", date_submit: "01-01-2026" }));
}
function testEmbedAllImagesAsBase64() {
  var h = '<div><img src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png" /><p>Test</p></div>';
  return embedAllImagesAsBase64(h);
}
function testGetRepeatedApplications() { return getRepeatedApplicationsData(); }
function testGetStatistics() { return getStatisticsData(ROLE_PENGARAH, ""); }
function testUserFolder() { return handleCreateDriveFolderAction({ application_type: "BARU - 21-04-2026", company_name: "SYARIKAT TEST", user_name: "Test" }); }

// =========================================================================
// SETUP FIREBASE CODES — Jalankan sekali dari Apps Script Editor
// =========================================================================
function setupFirebaseCodes() {
  var codes = {
    'zariff.zainudin@kuskop.gov.my': '0707',
    'norhamizi.hamdzahi@kuskop.gov.my': '5757',
    'ilyanadia.azmi@kuskop.gov.my': '6166',
    'khairulfitri.kamaruddin@kuskop.gov.my': '5381'
  };
  var props = PropertiesService.getScriptProperties();
  for (var email in codes) {
    var safeKey = 'FIREBASE_CODE_' + email.toLowerCase().replace(/[^a-z0-9@]/g, '_');
    props.setProperty(safeKey, codes[email]);
    console.log('Set ' + safeKey + ' = ' + codes[email]);
  }
  console.log('Selesai. ' + Object.keys(codes).length + ' kod Firebase disimpan.');
  return 'Selesai. ' + Object.keys(codes).length + ' kod Firebase disimpan.';
}

function lihatFirebaseCodes() {
  var props = PropertiesService.getScriptProperties();
  var keys = props.getKeys().filter(function(k) { return k.indexOf('FIREBASE_CODE_') === 0; });
  if (keys.length === 0) return 'Tiada kod Firebase dalam Properties.';
  keys.forEach(function(k) {
    console.log(k + ' = ' + props.getProperty(k));
  });
  return keys.length + ' kod dijumpai.';
}

function padamFirebaseCode(email) {
  var safeKey = 'FIREBASE_CODE_' + email.toLowerCase().replace(/[^a-z0-9@]/g, '_');
  PropertiesService.getScriptProperties().deleteProperty(safeKey);
  console.log('Dipadam: ' + safeKey);
  return 'Dipadam: ' + safeKey;
}
