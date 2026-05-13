// app.js - V6.5.2 (WEB APP VERSION)
// (UPDATED: Auto Email Authentication, Removed PIN Login, Dynamic URL Routing, Anonymous Access, Mobile UI Polish, Unique ID, Fixed CORS & WhatsApp Popup, Pemutihan Email Confirmation, Ketua Seksyen Tab Fixes, GIS Integration)

document.addEventListener('DOMContentLoaded', () => {
  console.log("STB Web App V6.5.2 Loaded - Auto Email Auth, Separated History Search, Dynamic Routing, Anonymous Access, Mobile Menu, Pemutihan Email & Ketua Seksyen Fixes, GIS Integration");
  
  // =========================================================================
  // FIREBASE CONFIG (UNTUK TAPISAN & BAKUL SAHAJA)
  // =========================================================================
  const firebaseConfig = {
      apiKey: "AIzaSyCiRTUSrEm7mxZ4Hzfb2iT3QevF9tZm6xA",
      authDomain: "tapisan-stb-g4-g7.firebaseapp.com",
      projectId: "tapisan-stb-g4-g7",
      storageBucket: "tapisan-stb-g4-g7.firebasestorage.app",
      messagingSenderId: "471944484216",
      appId: "1:471944484216:web:444b36f32ef52143c4a48d"
  };
  
  let dbFirestore = null;
  let authFirebase = null;

  // Safety Check: Pastikan Firebase telah dimuat turun sebelum di-init
  if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
      }
      dbFirestore = firebase.firestore();
      authFirebase = firebase.auth();
  } else {
      console.error("Sistem Gagal Memuatkan Firebase. Sila semak fail index.html (CSP).");
  }

  // Kod Rahsia Firebase kini diambil dari Backend (code.gs)
  let currentUserFirebaseCode = null;
  let firebaseUserRules = null; 
  let excelRawData = [];
  let allExcelDistricts = [];
  let selectedExcelDistricts = new Set();
  let bakulUnsubscribe = null;

  // URL APPSCRIPT
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbymhb1CUzUC5WPRt4YJjOT2lNFZtKYk0wpsQaWUVQtnYsueGVcNDUx2Vg1vtriSw3kk/exec';
  
  // Google Client ID
  const GOOGLE_CLIENT_ID = '758579492428-rnfev1nkkf2e6qduhujgtfbhudl2j9td.apps.googleusercontent.com';
  
  // =========================================================================
  // PEMBALUT LOCALSTORAGE (Menggantikan chrome.storage.local)
  // =========================================================================
  const storageWrapper = {
    get: function(keys) {
      return new Promise((resolve) => {
        let result = {};
        keys.forEach(key => {
          let val = window.localStorage.getItem(key);
          if (val !== null) {
            try {
              result[key] = JSON.parse(val);
            } catch (e) {
              result[key] = val;
            }
          }
        });
        resolve(result);
      });
    },
    set: function(obj) {
      return new Promise((resolve) => {
        for (let key in obj) {
          window.localStorage.setItem(key, JSON.stringify(obj[key]));
        }
        resolve();
      });
    },
    remove: function(keys) {
      return new Promise((resolve) => {
        keys.forEach(key => window.localStorage.removeItem(key));
        resolve();
      });
    }
  };
  // =========================================================================
  // ENJIN CUSTOM ANIMATED MODAL (PENGGANTI ALERT & CONFIRM CHROME)
  // =========================================================================
  window.CustomAppModal = {
      show: function(options) {
          return new Promise((resolve) => {
              const overlay = document.getElementById('customModalOverlay');
              const iconBox = document.getElementById('customModalIconBox');
              const iconEl = document.getElementById('customModalIcon');
              const titleEl = document.getElementById('customModalTitle');
              const messageEl = document.getElementById('customModalMessage');
              const actionsEl = document.getElementById('customModalActions');

              // Set Ikon & Warna
              iconBox.className = 'custom-modal-icon-container';
              const type = options.type || 'info';
              if (type === 'success') { iconBox.classList.add('icon-success'); iconEl.innerHTML = '✨'; }
              else if (type === 'error') { iconBox.classList.add('icon-error'); iconEl.innerHTML = '❌'; }
              else if (type === 'warning') { iconBox.classList.add('icon-warning'); iconEl.innerHTML = '⚠️'; }
              else { iconBox.classList.add('icon-info'); iconEl.innerHTML = 'ℹ️'; }

              titleEl.innerText = options.title || 'Makluman';
              messageEl.innerHTML = options.message || '';
              actionsEl.innerHTML = ''; // Clear butang lama

              const close = (result) => {
                  overlay.classList.remove('show');
                  setTimeout(() => {
                      overlay.style.display = 'none';
                      resolve(result); // Kembalikan true (Pasti) atau false (Batal)
                  }, 300);
              };

              // Jika ia adalah Modal CONFIRM
              if (options.isConfirm) {
                  const cancelBtn = document.createElement('button');
                  cancelBtn.className = 'custom-modal-btn custom-modal-btn-cancel';
                  cancelBtn.innerText = options.cancelText || 'Batal';
                  cancelBtn.onclick = () => { playSoundEffect('ui_click.mp3'); close(false); };

                  const confirmBtn = document.createElement('button');
                  confirmBtn.className = `custom-modal-btn ${options.isDanger ? 'custom-modal-btn-danger' : 'custom-modal-btn-confirm'}`;
                  confirmBtn.innerText = options.confirmText || 'Teruskan';
                  confirmBtn.onclick = () => { playSoundEffect('ui_click.mp3'); close(true); };

                  actionsEl.appendChild(cancelBtn);
                  actionsEl.appendChild(confirmBtn);
              } 
              // Jika ia adalah Modal ALERT biasa
              else {
                  const okBtn = document.createElement('button');
                  okBtn.className = 'custom-modal-btn custom-modal-btn-confirm';
                  okBtn.innerText = 'OK';
                  okBtn.onclick = () => { playSoundEffect('ui_click.mp3'); close(true); };
                  actionsEl.appendChild(okBtn);
              }

              // Paparkan Modal dengan animasi
              overlay.style.display = 'flex';
              void overlay.offsetWidth; // Trigger reflow
              overlay.classList.add('show');
          });
      },
      alert: function(message, title = 'Makluman', type = 'info') {
          playSoundEffect(type === 'error' ? 'error_buzz.mp3' : 'minimal alert.mp3');
          return this.show({ message, title, type, isConfirm: false });
      },
      confirm: function(message, title = 'Pengesahan Tindakan', type = 'warning', confirmText = 'Teruskan', isDanger = false) {
          playSoundEffect('minimal alert.mp3');
          return this.show({ message, title, type, isConfirm: true, confirmText, isDanger });
      }
  };

  // --- AI Model Selection Elements (V6.4.5) ---
  const aiModelSelect = document.getElementById('aiModelSelect');
  const aiProfileModelSelect = document.getElementById('aiProfileModelSelect');

  // --- GLOBAL CHART VARIABLES ---
  let dashboardStatusChart = null;
  let dashboardTypeChart = null;
  let dashboardReasonChart = null;
  let dashboardTrendChart = null;
  let dashboardKonsultansiChart = null;
  
  // =========================================================================
  // MOBILE MENU DOM ELEMENTS
  // =========================================================================
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const tabsContainer = document.getElementById('tabs-container');
  const menuOverlay = document.getElementById('menuOverlay');
  const anonymousBadge = document.getElementById('anonymousBadge');

  // =========================================================================
  // V6.5.2 AUDIO & VOLUME CONTROL SYSTEM (SFX ONLY)
  // =========================================================================

  let sfxVolume = 0.7; // Default SFX volume: 70%

  // DOM Elements for Audio Controls
  const sfxVolumeSlider = document.getElementById('sfxVolumeSlider');
  const sfxVolumeValue = document.getElementById('sfxVolumeValue');

  async function playSoundEffect(soundFile) {
    try {
      let fileName = soundFile;
      if (fileName === 'ui_click.mp3') fileName = 'audio/ui click.mp3';
      else if (fileName === 'positive_chime.mp3') fileName = 'audio/positive chime.mp3';
      else if (fileName === 'error_buzz.mp3') fileName = 'audio/error buzz.mp3';
      else if (!fileName.includes('/')) fileName = 'audio/' + fileName;

      const sfx = new Audio(fileName);
      sfx.volume = sfxVolume;
      await sfx.play();
      console.log(`V6.5.2 (Web) Sound effect played: ${fileName}`);
    } catch (error) {
      console.error(`V6.5.2 (Web) Failed to play sound effect (${soundFile}):`, error);
    }
  }
    
  async function updateSfxVolume(newVolume) {
    try {
      sfxVolume = newVolume;
      
      if (sfxVolumeValue) {
        sfxVolumeValue.textContent = Math.round(sfxVolume * 100) + '%';
      }
      
      // Simpan tetapan volume SFX ke dalam local storage
      storageWrapper.set({ 'stb_sfx_volume': sfxVolume });
      
      console.log(`V6.5.2 (Web) SFX volume updated to ${Math.round(sfxVolume * 100)}%`);
    } catch (error) {
      console.error("V6.5.2 (Web) Failed to update SFX volume:", error);
    }
  }
    
  function setupAudioControls() {
    // HANYA KEKALKAN KAWALAN SFX SAHAJA
    if (sfxVolumeSlider) {
      sfxVolumeSlider.addEventListener('change', async (e) => {
        const newVolume = parseFloat(e.target.value);
        await updateSfxVolume(newVolume);
      });
      sfxVolumeSlider.value = sfxVolume;
      if (sfxVolumeValue) {
        sfxVolumeValue.textContent = Math.round(sfxVolume * 100) + '%';
      }
    }
    
    console.log("V6.5.2 Audio controls (SFX Only) setup completed");
  }
  
  function setupGlobalButtonClickSound() {
    document.addEventListener('click', async (e) => {
      const target = e.target.closest('button, .btn, [role="button"], .tab-btn, .tick-btn, .filter-btn');
      
      if (target) {
        // Mainkan bunyi tanpa perlu check btnToggleMusic lagi
        await playSoundEffect('ui_click.mp3');
      }
    }, true);
    console.log("V6.5.2 Global button click sound setup completed");
  }  
  // =========================================================================
  // MOBILE MENU LOGIC
  // =========================================================================
  function closeMobileMenu() {
    if (tabsContainer) {
      tabsContainer.classList.remove('show-menu');
    }
    if (menuOverlay) {
      menuOverlay.classList.remove('show');
      menuOverlay.style.display = 'none';
    }
  }

  function openMobileMenu() {
    if (tabsContainer) {
      tabsContainer.classList.add('show-menu');
    }
    if (menuOverlay) {
      menuOverlay.classList.add('show');
      menuOverlay.style.display = 'block';
    }
  }

  function toggleMobileMenu() {
    if (tabsContainer && tabsContainer.classList.contains('show-menu')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }

  if (menuOverlay) {
    menuOverlay.addEventListener('click', closeMobileMenu);
  }

  // Pastikan menu ditutup apabila saiz skrin berubah ke desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMobileMenu();
    }
  });

  async function playSuccessSound() {
    await playSoundEffect('positive_chime.mp3');
  }
  
  async function playErrorSound() {
    await playSoundEffect('error_buzz.mp3');
  }

  // =========================================================================
  // END V6.4.8 AUDIO SYSTEM & MOBILE MENU
  // =========================================================================
  
  // --- FETCH WITH RETRY MECHANISM ---
  async function fetchWithRetry(url, options = {}, maxRetries = 3, delay = 1000) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`V6.5.2 Fetch attempt ${attempt} for ${url.substring(0, 100)}...`);
        
        const response = await fetch(url, options);
        
        if (response.ok) {
          console.log(`V6.5.2 Fetch successful on attempt ${attempt}`);
          return response;
        }
        
        if (response.status === 503) {
          console.warn(`V6.5.2 Service Unavailable (503) on attempt ${attempt}. Retrying...`);
          const backoffDelay = delay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
        
      } catch (error) {
        lastError = error;
        console.warn(`V6.5.2 Fetch attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const backoffDelay = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    throw lastError;
  }

  // =========================================================================
  // GOOGLE IDENTITY SERVICES (GIS) FUNCTIONS
  // =========================================================================
  
  // Fungsi untuk decode JWT token dari Google
  function decodeJwtResponse(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error("V6.5.2 Error decoding JWT:", error);
      return null;
    }
  }
  
  // Fungsi pengendali respons credential Google
async function handleCredentialResponse(response) {
  console.log("V6.5.2 Google credential response received");
  
  // 1. Sembunyi butang Google & ralat (jika ada)
  const googleButton = document.getElementById('googleButton');
  if (googleButton) {
    googleButton.style.display = 'none';
  }
  
  if (loginError) {
    loginError.style.display = 'none';
    loginError.textContent = '';
  }
  
  // 2. MULA PAPARKAN LOADING PROGRESS BAR (0-100%)
  simulateLoadingWithSteps(
    [
      'Mengesahkan token Google...',
      'Mengekstrak maklumat e-mel...',
      'Menyemak pangkalan data...',
      'Mengesahkan peranan pengguna...',
      'Menyediakan sistem...',
      'Log masuk berjaya!'
    ],
    'Proses Log Masuk'
  );
  
  try {
    // Decode JWT token untuk dapatkan email
    const decodedToken = decodeJwtResponse(response.credential);
    
    if (!decodedToken || !decodedToken.email) {
      throw new Error('Token Google tidak sah atau tiada e-mel.');
    }
    
    const userEmail = decodedToken.email;
    console.log("V6.5.2 Email extracted from Google token:", userEmail);
    
    // Hantar email ke backend GAS untuk pengesahan
    const result = await verifyEmailWithBackend(userEmail);
    
    if (result.authenticated && result.user) {
      console.log("V6.5.2 GIS Authentication successful for:", result.user.email);
      
      currentUser = result.user;
      currentUser.role = result.user.role ? result.user.role.toUpperCase().trim() : "";
      
      // KOD BARU: Simpan emel dalam objek currentUser
      currentUser.email = userEmail.toLowerCase();

      // Log masuk ke Firebase untuk SEMUA role supaya Firebase membenarkan akses (Rules)
      authFirebase.signInAnonymously().then(() => {
          console.log("Berjaya log masuk ke Firebase untuk fungsi YouTube/Cache.");
          
          // KOD LAMA: Sambungkan ke Firebase Bakul HANYA jika peranan adalah PENGESYOR
          if (currentUser.role === 'PENGESYOR') {
              currentUserFirebaseCode = result.user.firebaseCode || null; 
              if (currentUserFirebaseCode) {
                  console.log("Menyambung ke Firebase Bakul dengan kod:", currentUserFirebaseCode);
                  dbFirestore.collection("users").doc(currentUserFirebaseCode).get().then(doc => {
                      if (doc.exists) {
                          firebaseUserRules = doc.data();
                          console.log("Peraturan Tapisan Firebase dimuatkan.");
                          subscribeToBakulFirebase();
                      }
                  });
              }
          }
      }).catch(err => console.error("Ralat Firebase Auth:", err));

      // Simpan sesi dan tarikh hari ini ke storage
      const todayStr = new Date().toDateString();
      await storageWrapper.set({ 
        'stb_session': currentUser,
        'stb_login_date': todayStr
      });

      // --- KOD PENYELAMAT: Tukar paparan di belakang tabir loading ---
      if (loginScreen) loginScreen.style.display = 'none';
      if (appContainer) appContainer.style.display = 'block';
      
      // Update maklumat profil pengguna
      if (userBadge) {
    userBadge.innerText = `👤 ${currentUser.name} (${currentUser.role})`;
    userBadge.title = "Buka Portal YouTube";
    userBadge.style.cursor = "pointer";
    userBadge.onclick = function() {
        if (lastActiveTab !== 'youtube') {
            window.tabSebelumYoutube = lastActiveTab; 
        }
        switchTab('youtube');
    };
  }

      // Biarkan bar peratusan berjalan sehingga tamat untuk "User Experience" yang premium
      setTimeout(() => {
        hideLoading(); 
        // Jalankan fungsi initialize app selepas loading hilang
        setupUserUI(); 
      }, 1500); 
      
    } else {
      // Jika emel salah/tidak berdaftar, barulah panggil error
      hideLoading();
      const errorMsg = result.message || 'Akses Ditolak: E-mel tidak didaftarkan dalam sistem.';
      handleAuthError(errorMsg);
    }
   
  } catch (error) {
    console.error("V6.5.2 GIS Authentication error:", error);
    hideLoading(); // Tutup progress bar
    const errorMsg = `Ralat Pengesahan: ${error.message}. Sila cuba lagi.`;
    handleAuthError(errorMsg);
  }
}
  
  // Fungsi untuk menghantar email ke backend
  async function verifyEmailWithBackend(email) {
    console.log("V6.5.2 Verifying email with backend:", email);
    
    try {
      const response = await fetchWithRetry(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'checkAuth',
          email: email
        })
      }, 3, 1500);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log("V6.5.2 Backend verification response:", result);
      
      return result;
      
    } catch (error) {
      console.error("V6.5.2 Backend verification error:", error);
      throw error;
    }
  }
  
  // Fungsi untuk papar ralat autentikasi
  function handleAuthError(errorMsg) {
    if (loginLoadingText) {
      loginLoadingText.style.display = 'none';
    }
    
    if (loginError) {
      loginError.style.display = 'block';
      loginError.textContent = errorMsg;
      loginError.style.color = '#dc2626';
      loginError.style.fontWeight = 'bold';
      loginError.style.padding = '12px';
      loginError.style.backgroundColor = '#fee2e2';
      loginError.style.borderRadius = '8px';
      loginError.style.border = '1px solid #ef4444';
    }
    
    // Tunjuk semula butang Google supaya user boleh cuba lagi
    const googleButton = document.getElementById('googleButton');
    if (googleButton) {
      googleButton.style.display = 'flex';
    }
    
    // Sembunyikan input PIN kerana tidak digunakan
    if (loginPin) loginPin.style.display = 'none';
    if (btnLogin) btnLogin.style.display = 'none';
    
    // Kekal di skrin login
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
  }
  
  // Fungsi untuk initialize Google Sign-In
  function initializeGoogleSignIn() {
    const googleButton = document.getElementById('googleButton');
    if (!googleButton) {
      console.warn("V6.5.2 Google button container not found");
      return;
    }
    
    // Pastikan Google API sudah dimuatkan
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
      console.warn("V6.5.2 Google Identity Services API not loaded yet");
      // Cuba lagi selepas 500ms
      setTimeout(initializeGoogleSignIn, 500);
      return;
    }
    
    console.log("V6.5.2 Initializing Google Identity Services...");
    
    try {
      // Initialize Google Sign-In
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      
      // Render butang Google Sign-In (Gaya Moden)
      google.accounts.id.renderButton(
        googleButton,
        { 
          theme: 'filled_blue', // Tukar dari outline ke filled_blue
          size: 'large',
          type: 'standard',
          shape: 'pill',       // Tukar dari rectangular ke pill (bujur)
          width: '320',        // Lebar yang lebih selesa
          logo_alignment: 'left'
        }
      );
      
      // Tunjukkan googleButton
      googleButton.style.display = 'flex';
      googleButton.style.justifyContent = 'center';
      googleButton.style.alignItems = 'center';
      googleButton.style.padding = '10px';
      
      console.log("V6.5.2 Google Sign-In button rendered successfully");
      
    } catch (error) {
      console.error("V6.5.2 Error initializing Google Sign-In:", error);
      
      // Fallback: tunjuk mesej error di login screen
      if (loginError) {
        loginError.style.display = 'block';
        loginError.textContent = 'Ralat memuatkan Google Sign-In. Sila muat semula halaman.';
        loginError.style.color = '#dc2626';
      }
    }
  }

  // --- Helper function to get user color in HEX ---
  function getUserColorHex(colorName) {
    if (!colorName) return '#2563eb';
    
    const colorUpper = colorName.toUpperCase();
    if (colorUpper.includes('OREN')) return '#ea580c';
    if (colorUpper.includes('HIJAU')) return '#16a34a';
    if (colorUpper.includes('UNGU')) return '#9333ea';
    if (colorUpper.includes('HITAM')) return '#000000';
    if (colorUpper.includes('PINK')) return '#ec4899';
    if (colorUpper.startsWith('#')) return colorName;
    
    return '#2563eb';
  }

  // --- FUNGSI BANTUAN DESTROY CHART ---
  function safeDestroyChart(chartInstance, canvasId) {
    if (chartInstance) {
      try {
        chartInstance.destroy();
      } catch (e) {
        console.warn("V6.5.2 Error destroying chart instance:", e);
      }
    }
    
    if (canvasId) {
      const existingChart = Chart.getChart(canvasId);
      if (existingChart) {
        try {
          existingChart.destroy();
        } catch (e) {
          console.warn("V6.5.2 Error destroying existing chart by ID:", e);
        }
      }
    }
    
    return null;
  }

  // --- GLOBAL VARIABLES ---
  let loadingProgressInterval = null;
  let typeMonthlyChart = null;
  let typeYearlyChart = null;
  let approverMonthlyChart = null;
  let recommenderMonthlyChart = null;
  
  let isDashboardFirstLoad = true;
  
  let usersList = []; 
  let currentUser = null;
  let cachedData = [];
  let pelulusActiveItem = null;
  let isRestoring = false; 
  let isAppReady = false;
  let activeListType = '';
  let hasPrinted = false;
  let isFetching = false;
  let driveFolderCreated = false;
  let createdFolderUrl = '';
  let userFolderUrl = '';
  let allRecommenders = [];
  let allApprovers = [];
  
  let isSaving = false;
  
  // V6.4.5: Inactivity Timeout Variables
  let inactivityTimer = null;
  const TIMEOUT_DURATION = 3600000; // 1 jam = 3600000 milisaat
  
  // Dashboard data
  let dashboardData = {
    yearly: {},
    monthly: {},
    daily: {},
    currentPeriod: 'monthly',
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    currentDay: new Date().getDate(),
    stats: {
      total: 0,
      supported: 0,
      notSupported: 0,
      approvalRate: 0,
      monthlyTrend: [],
      reasons: {},
      types: {}
    }
  };
  
  // USER FOLDER SYSTEM VARIABLES
  let mainFolderUrl = 'https://drive.google.com/drive/folders/1-IszGRdSjoJz2oOjUs_KO7HRz7oE2Hzn';
  let mainFolderId = '1-IszGRdSjoJz2oOjUs_KO7HRz7oE2Hzn';

  // STATE VARIABLES
  let lastActiveElementId = '';
  let lastActiveTab = 'stb';
  let formStates = {};

  // PDF PROCESSING VARIABLES
  let extractedPdfData = null;
  let extractedProfileData = null;
  
  // V6.4.8: Filter variables untuk kombinasi tapisan
  let currentDraftFilter = 'ALL';
  let currentSubmittedStatusFilter = 'ALL';
  let currentSubmittedJenisFilter = 'ALL';
  let currentHistoryStatusFilter = 'ALL';
  let currentHistoryJenisFilter = 'ALL';

  // DOM Elements (Sebahagian besar diisytihar kemudian, tetapi beberapa digunakan untuk mobile menu)
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app-container');
  const loginPin = document.getElementById('login_pin');
  const btnLogin = document.getElementById('btnLogin');
  const loginError = document.getElementById('loginError');
  const loginLoadingText = document.getElementById('loginLoadingText');
  const userBadge = document.getElementById('userBadge');
  const listStatus = document.getElementById('listStatus');
  const openFullBtn = document.getElementById('openFullBtn');
  const openFullBtnPelulus = document.getElementById('openFullBtnPelulus');
  const dbSyor = document.getElementById('db_syor');
  const dbPautanInput = document.getElementById('db_pautan');
  const btnSyncToDb = document.getElementById('btnSyncToDb');
  const triggerPrintBtn = document.getElementById('triggerPrintBtn');
  const driveSection = document.getElementById('driveSection');
  const driveStatus = document.getElementById('driveStatus');
  const driveFolderInfo = document.getElementById('driveFolderInfo');
  const driveResult = document.getElementById('driveResult');
  const cbCreateDriveFolder = document.getElementById('cbCreateDriveFolder');
  const btnCreateDriveFolder = document.getElementById('btnCreateDriveFolder');
  const btnOpenDriveFolder = document.getElementById('btnOpenDriveFolder');
  const btnOpenMyDriveFolder = document.getElementById('btnOpenMyDriveFolder');
  const filterSection = document.getElementById('filterSection');
  const filterPengesyor = document.getElementById('filterPengesyor');
  const btnClearFilter = document.getElementById('btnClearFilter');
  
  // Filter Bulan & Tahun untuk Senarai
  const listFilterMonth = document.getElementById('listFilterMonth');
  const listFilterYear = document.getElementById('listFilterYear');
  
  // Filter Jenis Permohonan & SPI - Butang dan Badge
  const draftFiltersContainer = document.getElementById('draftFiltersContainer');
  const filterBtnAll = document.getElementById('filterBtnAll');
  const filterBtnBaru = document.getElementById('filterBtnBaru');
  const filterBtnPembaharuan = document.getElementById('filterBtnPembaharuan');
  const filterBtnUbahMaklumat = document.getElementById('filterBtnUbahMaklumat');
  const filterBtnUbahGred = document.getElementById('filterBtnUbahGred');
  const filterBtnSpi = document.getElementById('filterBtnSpi');
  
  // Badge elements untuk kiraan
  const badgeAll = document.getElementById('badgeAll');
  const badgeBaru = document.getElementById('badgeBaru');
  const badgePembaharuan = document.getElementById('badgePembaharuan');
  const badgeUbahMaklumat = document.getElementById('badgeUbahMaklumat');
  const badgeUbahGred = document.getElementById('badgeUbahGred');
  const badgeSpi = document.getElementById('badgeSpi');
  
  // Submitted Tab Filter Elements
  const submittedFiltersContainer = document.getElementById('submittedFiltersContainer');
  const filterSubmittedAll = document.getElementById('filterSubmittedAll');
  const filterSubmittedLulus = document.getElementById('filterSubmittedLulus');
  const filterSubmittedTolak = document.getElementById('filterSubmittedTolak');
  const filterSubmittedPending = document.getElementById('filterSubmittedPending');
  const filterSubmittedJenisBaru = document.getElementById('filterSubmittedJenisBaru');
  const filterSubmittedJenisPembaharuan = document.getElementById('filterSubmittedJenisPembaharuan');
  const filterSubmittedJenisUbahMaklumat = document.getElementById('filterSubmittedJenisUbahMaklumat');
  const filterSubmittedJenisUbahGred = document.getElementById('filterSubmittedJenisUbahGred');
  
  // Badge elements for submitted filters
  const badgeSubmittedAll = document.getElementById('badgeSubmittedAll');
  const badgeSubmittedLulus = document.getElementById('badgeSubmittedLulus');
  const badgeSubmittedTolak = document.getElementById('badgeSubmittedTolak');
  const badgeSubmittedPending = document.getElementById('badgeSubmittedPending');
  const badgeSubmittedJenisBaru = document.getElementById('badgeSubmittedJenisBaru');
  const badgeSubmittedJenisPembaharuan = document.getElementById('badgeSubmittedJenisPembaharuan');
  const badgeSubmittedJenisUbahMaklumat = document.getElementById('badgeSubmittedJenisUbahMaklumat');
  const badgeSubmittedJenisUbahGred = document.getElementById('badgeSubmittedJenisUbahGred');
  
  // History Tab Filter Elements
  const historyFiltersContainer = document.getElementById('historyFiltersContainer');
  const filterHistoryAll = document.getElementById('filterHistoryAll');
  const filterHistoryStatusAll = document.getElementById('filterHistoryStatusAll');
  const filterHistoryStatusLulus = document.getElementById('filterHistoryStatusLulus');
  const filterHistoryStatusTolak = document.getElementById('filterHistoryStatusTolak');
  const filterHistoryStatusPending = document.getElementById('filterHistoryStatusPending');
  const filterHistoryJenisBaru = document.getElementById('filterHistoryJenisBaru');
  const filterHistoryJenisPembaharuan = document.getElementById('filterHistoryJenisPembaharuan');
  const filterHistoryJenisUbahMaklumat = document.getElementById('filterHistoryJenisUbahMaklumat');
  const filterHistoryJenisUbahGred = document.getElementById('filterHistoryJenisUbahGred');
  
  // Badges History
  const badgeHistoryAll = document.getElementById('badgeHistoryAll');
  const badgeHistoryStatusLulus = document.getElementById('badgeHistoryStatusLulus');
  const badgeHistoryStatusTolak = document.getElementById('badgeHistoryStatusTolak');
  const badgeHistoryStatusPending = document.getElementById('badgeHistoryStatusPending');
  const badgeHistoryJenisBaru = document.getElementById('badgeHistoryJenisBaru');
  const badgeHistoryJenisPembaharuan = document.getElementById('badgeHistoryJenisPembaharuan');
  const badgeHistoryJenisUbahMaklumat = document.getElementById('badgeHistoryJenisUbahMaklumat');
  const badgeHistoryJenisUbahGred = document.getElementById('badgeHistoryJenisUbahGred');

  // Loading Overlay Elements
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  const loadingSubtext = document.getElementById('loading-subtext');
  
  // PDF Upload Elements for Main Form
  const pdfUploadArea = document.getElementById('pdfUploadArea');
  const pdfFileName = document.getElementById('pdfFileName');
  const pdfProcessing = document.getElementById('pdfProcessing');
  const pdfResult = document.getElementById('pdfResult');
  const pdfExtractedData = document.getElementById('pdfExtractedData');
  const btnApplyPdfData = document.getElementById('btnApplyPdfData');
  const btnClearPdfData = document.getElementById('btnClearPdfData');
  
  // PDF Upload Elements for Profile Tab
  const profilePdfUploadArea = document.getElementById('profilePdfUploadArea');
  const profilePdfFileName = document.getElementById('profilePdfFileName');
  const profilePdfProcessing = document.getElementById('profilePdfProcessing');
  const profilePdfResult = document.getElementById('profilePdfResult');
  const profilePdfExtractedData = document.getElementById('profilePdfExtractedData');
  const btnProsesProfileAI = document.getElementById('btnProsesProfileAI');
  const btnApplyProfileData = document.getElementById('btnApplyProfileData');
  const btnClearProfileData = document.getElementById('btnClearProfileData');
  const btnCetakProfile = document.getElementById('btnCetakProfile');
  const btnResetProfile = document.getElementById('btnResetProfile');
  const btnPreviewQR = document.getElementById('btnPreviewQR');
  const previewQrCode = document.getElementById('previewQrCode');
  
  // Profile Tab Input Elements
  const profileSyarikat = document.getElementById('profile_syarikat');
  const profileCidb = document.getElementById('profile_cidb');
  const profileGred = document.getElementById('profile_gred');
  const profileNamaPemohon = document.getElementById('profile_nama_pemohon');
  const profileJawatanPemohon = document.getElementById('profile_jawatan_pemohon');
  const profileIcPemohon = document.getElementById('profile_ic_pemohon');
  const profileTelefonPemohon = document.getElementById('profile_telefon_pemohon');
  const profileEmailPemohon = document.getElementById('profile_email_pemohon');
  const profileJenisPendaftaran = document.getElementById('profile_jenis_pendaftaran');
  const profileTarikhDaftar = document.getElementById('profile_tarikh_daftar');
  const profileAlamatBerdaftar = document.getElementById('profile_alamat_berdaftar');
  const profileAlamatSurat = document.getElementById('profile_alamat_surat');
  const profileNoTelefonSyarikat = document.getElementById('profile_no_telefon_syarikat');
  const profileNoFax = document.getElementById('profile_no_fax');
  const profileEmailSyarikat = document.getElementById('profile_email_syarikat');
  const profileWeb = document.getElementById('profile_web');
  const profilePautanDrive = document.getElementById('profile_pautan_drive');
  const profileJenisPerubahan = document.getElementById('profile_jenis_perubahan');
  const cbSsmBerdaftar = document.getElementById('cb_ssm_berdaftar');
  const cbSsmSurat = document.getElementById('cb_ssm_surat');
  const labelAlamatBerdaftar = document.getElementById('label_alamat_berdaftar');
  
  // Profile PDF Input
  let profilePdfInput = document.getElementById('profilePdfInput');
  
  // PDF Processing Buttons
  const btnProcessManual = document.getElementById('btnProcessManual');
  const btnProcessAI = document.getElementById('btnProcessAI');
  
  // PDF File Input
  let pdfFileInput = document.getElementById('pdfFileInput');
  
  // Dashboard Elements
  const dashboardPeriod = document.getElementById('dashboardPeriod');
  const dashboardYear = document.getElementById('dashboardYear');
  const dashboardMonth = document.getElementById('dashboardMonth');
  const dashboardDay = document.getElementById('dashboardDay');
  const detailedTableBody = document.getElementById('detailedTableBody');
  const chartMonthlyTrend = document.getElementById('chartMonthlyTrend');
  const chartStatus = document.getElementById('chartStatus');
  const dashboardUserInfo = document.getElementById('dashboardUserInfo');
  const dashboardUserRole = document.getElementById('dashboardUserRole');
  const dashboardUserSpecificInfo = document.getElementById('dashboardUserSpecificInfo');
  const typeStats = document.getElementById('typeStats');
  const reasonStatsContainer = document.getElementById('reasonStatsContainer');
  const reasonStats = document.getElementById('reasonStats');
  const detailCol1 = document.getElementById('detailCol1');
  const detailCol2 = document.getElementById('detailCol2');
  const detailCol3 = document.getElementById('detailCol3');
  const detailCol4 = document.getElementById('detailCol4');
  
  // Chart Containers
  const applicationTypeChartContainer = document.getElementById('chartTypeDistContainer');
  const rejectionReasonChartContainer = document.getElementById('chartReasonDistContainer');
  
  // Admin Dashboard Elements
  const tabAdminBtn = document.getElementById('tabAdminBtn');
  const adminTotalCount = document.getElementById('admin-total-count');
  const adminApprovedCount = document.getElementById('admin-approved-count');
  const adminRejectedCount = document.getElementById('admin-rejected-count');
  const adminPendingCount = document.getElementById('admin-pending-count');
  const adminPengesyorTbody = document.getElementById('admin-pengesyor-tbody');
  const adminPelulusTbody = document.getElementById('admin-pelulus-tbody');
  const adminStatsModal = document.getElementById('adminStatsModal');
  const adminStatsClose = document.getElementById('adminStatsClose');
  const btnPrintAdminStats = document.getElementById('btnPrintAdminStats');
  const btnPrintStatsModal = document.getElementById('btnPrintStatsModal');
  const adminStatsPrintContent = document.getElementById('adminStatsPrintContent');
  const adminStatsDate = document.getElementById('adminStatsDate');
  
  // Admin Filter Elements
  const adminFilterMonth = document.getElementById('adminFilterMonth');
  const adminFilterYear = document.getElementById('adminFilterYear');
  
  // Analisis Penolakan Container
  const adminRejectionReasonStats = document.getElementById('adminRejectionReasonStats');
  
  // Butang CSV
  const btnAdminCsv = document.getElementById('btnAdminCsv');
  
  // Butang Paparan Penuh Admin
  const btnAdminFullView = document.getElementById('btnAdminFullView');
  
  // Chart Elements for Application Type Analysis
  const chartTypeMonthly = document.getElementById('chartTypeMonthly');
  const chartTypeYearly = document.getElementById('chartTypeYearly');
  const chartTypeMonthlyContainer = document.getElementById('chartTypeMonthlyContainer');
  const chartTypeYearlyContainer = document.getElementById('chartTypeYearlyContainer');
  
  // Kad 4 Statistik Elements
  const totalCountElement = document.getElementById('total-count');
  const successCountElement = document.getElementById('success-count');
  const labelSuccessElement = document.getElementById('label-success');
  const rejectCountElement = document.getElementById('reject-count');
  const labelRejectElement = document.getElementById('label-reject');
  const processCountElement = document.getElementById('process-count');
  const labelStatusElement = document.getElementById('label-status');

  // WhatsApp Dropdown
  const dbPelulusWhatsapp = document.getElementById('db_pelulus_whatsapp');
  
  // Lawatan Elements
  const cbSelesaiLawatan = document.getElementById('cb_selesai_lawatan');
  const containerLawatan = document.getElementById('container_lawatan');
  const dbLawatanTarikh = document.getElementById('db_lawatan_tarikh');
  const dbLawatanSubmitSptb = document.getElementById('db_lawatan_submit_sptb');
  const dbLawatanSyor = document.getElementById('db_lawatan_syor');

  // WhatsApp Notification Elements
  const cbNotifyWhatsapp = document.getElementById('cb_notify_whatsapp');
  const pelulusWhatsappContainer = document.getElementById('pelulus_whatsapp_container');
  const labelNotifyWhatsapp = document.getElementById('label_notify_whatsapp');

  // Profile Tab Button
  const tabProfileBtn = document.getElementById('tabProfileBtn');
  
  // Top Full View Button
  const btnTopFullView = document.getElementById('btnTopFullView');
  
  // NEW BUTTON: Pergi ke Cipta Profile from Database Tab
  const btnPergiCiptaProfile = document.getElementById('btnPergiCiptaProfile');
  
  // NEW BUTTON: Download Dashboard CSV
  const btnDownloadDashboardCsv = document.getElementById('btnDashboardCsv');

  // Rujukan DOM untuk Label Checkbox Pengesahan
  const labelDbSahSyor = document.getElementById('label_db_sah_syor');
  const labelPelulusSahLulus = document.getElementById('label_pelulus_sah_lulus');
  const dbSahSyor = document.getElementById('db_sah_syor');
  const pelulusSahLulus = document.getElementById('pelulus_sah_lulus');
  
  // Pelulus Elements untuk Tukar Syor Lawatan
  const pelulusTukarSyor = document.getElementById('pelulus_tukar_syor_lawatan');
  const divPelulusJustifikasi = document.getElementById('div_pelulus_justifikasi');
  const divPelulusDateSpi = document.getElementById('div_pelulus_date_spi');
  const pelulusJustifikasi = document.getElementById('pelulus_justifikasi_lawatan');
  const pelulusDateSpi = document.getElementById('pelulus_date_submit_spi');
  
  // Filter Container Elements
  const pengesyorFilterButtonsContainer = document.getElementById('pengesyorFilterButtonsContainer');
  const pelulusFilterSection = document.getElementById('pelulusFilterSection');
  const pelulusFilterButtonsContainer = document.getElementById('pelulusFilterButtonsContainer');

  // =========================================================================
  // V6.4.9: DYNAMIC URL ROUTING & UNIQUE ID GENERATOR
  // =========================================================================
  
  function generateUniqueId(rowNumber) {
    if (!rowNumber) return '';
    const num = parseInt(rowNumber);
    if (isNaN(num)) return '';
    return num.toString().padStart(5, '0');
  }

  function getCompanySlug(companyName) {
    if (!companyName) return 'unknown';
    return companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function updateBrowserUrl(params) {
    const url = new URL(window.location);
    // Clear existing params
    url.searchParams.forEach((value, key) => {
      if (params.hasOwnProperty(key)) return;
      url.searchParams.delete(key);
    });
    
    // Set new params
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
    }
    
    window.history.pushState({}, '', url);
  }

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      user: params.get('user'),
      tab: params.get('tab'),
      id: params.get('id'),
      company: params.get('company')
    };
  }

  // =========================================================================
  // FUNGSI UTAMA
  // =========================================================================

  // LOADING OVERLAY FUNCTIONS
  function simulateLoading(message = 'Memuatkan data...', submessage = '') {
    if (loadingOverlay && loadingText) {
      loadingText.textContent = message;
      if (loadingSubtext && submessage) {
        loadingSubtext.textContent = submessage;
      }
      loadingOverlay.style.display = 'flex';
      
      const progressBar = document.querySelector('.loading-progress-bar');
      const progressText = document.querySelector('.loading-progress-text');
      if (progressBar) progressBar.style.display = 'none';
      if (progressText) progressText.style.display = 'none';
    }
  }

  function simulateLoadingWithSteps(steps, overallMessage = 'Memuatkan data...') {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    
    if (!overlay || !text) return;
    
    text.textContent = overallMessage;
    overlay.style.display = 'flex';
    
    const progressBar = document.getElementById('loading-progress-bar');
    const progressPercent = document.getElementById('loading-progress-percent');
    const progressLabel = document.getElementById('loading-progress-label');
    
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressLabel && steps.length > 0) progressLabel.textContent = steps[0];
    
    if (loadingProgressInterval) clearInterval(loadingProgressInterval);
    
    let currentStep = 0;
    const totalSteps = steps.length;
    
    loadingProgressInterval = setInterval(() => {
      currentStep++;
      let progress = Math.min((currentStep / totalSteps) * 100, 100);
      
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressPercent) progressPercent.textContent = `${Math.round(progress)}%`;
      
      if (progressLabel) {
        progressLabel.textContent = (currentStep < totalSteps) ? steps[currentStep] : "Selesai!";
      }
      
      if (currentStep >= totalSteps) {
        clearInterval(loadingProgressInterval);
        setTimeout(() => { if(overlay) overlay.style.display = 'none'; }, 600);
      }
    }, 300);
  }

  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
    if (loadingProgressInterval) {
      clearInterval(loadingProgressInterval);
      loadingProgressInterval = null;
    }
  }

  // =========================================================================
  // FORM PERSISTENCE FUNCTIONS - INSTANT SAVE
  // =========================================================================
  function saveFormData() {
    if (isSaving || !currentUser) return;
    
    isSaving = true;
    console.log('V6.5.2 Instant auto-save: Menyimpan...');
    
    const formData = {
      timestamp: new Date().toISOString(),
      user: currentUser.name,
      role: currentUser.role,
      tab: lastActiveTab
    };
    
    const fields = {};
    document.querySelectorAll('#tab-checker input, #tab-checker select, #tab-checker textarea').forEach(el => {
      if (el.id && !el.id.includes('print_') && !el.id.includes('pelulus_') && !el.id.includes('login')) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          fields[el.id] = el.checked;
        } else {
          fields[el.id] = el.value;
        }
      }
    });
    
    const selectedRadio = document.querySelector('input[name="jenisApp"]:checked');
    if (selectedRadio) {
      fields['jenisApp'] = selectedRadio.value;
    }
    
    const personnel = [];
    document.querySelectorAll('.person-card').forEach(card => {
      const roles = [];
      card.querySelectorAll('.role-cb:checked').forEach(cb => roles.push(cb.value));
      
      personnel.push({
        name: card.querySelector('.p-name')?.value || '',
        isCompany: card.querySelector('.is-company')?.checked || false,
        roles: roles,
        s_ic: card.querySelector('.status-ic')?.value || '',
        s_sb: card.querySelector('.status-sb')?.value || '',
        s_epf: card.querySelector('.status-epf')?.value || ''
      });
    });
    
    fields.personnel = personnel;
    formData.fields = fields;
    
    try {
      storageWrapper.set({ 'stb_form_persistence': formData })
        .then(() => {
          console.log('V6.5.2 Instant auto-save: Berjaya');
          isSaving = false;
        })
        .catch(error => {
          console.error('V6.5.2 Error saving form data:', error);
          isSaving = false;
        });
    } catch (error) {
      console.error('V6.5.2 Error in saveFormData:', error);
      isSaving = false;
    }
  }

  function saveDatabaseFormData() {
    if (isSaving || !currentUser) return;
    
    isSaving = true;
    
    const formData = {
      timestamp: new Date().toISOString(),
      user: currentUser.name,
      role: currentUser.role,
      tab: 'db'
    };
    
    const fields = {};
    document.querySelectorAll('#tab-database input, #tab-database select, #tab-database textarea').forEach(el => {
      if (el.id && !el.id.includes('print_') && !el.id.includes('pelulus_') && !el.id.includes('login')) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          fields[el.id] = el.checked;
        } else {
          fields[el.id] = el.value;
        }
      }
    });
    
    const createDriveFolder = document.getElementById('cbCreateDriveFolder');
    if (createDriveFolder) {
      fields['cbCreateDriveFolder'] = createDriveFolder.checked;
    }
    
    formData.fields = fields;
    
    storageWrapper.set({ 'stb_database_persistence': formData })
      .then(() => {
        console.log('V6.5.2 Database form data saved');
        isSaving = false;
      })
      .catch(error => {
        console.error('V6.5.2 Error saving database form data:', error);
        isSaving = false;
      });
  }

  function loadFormData() {
    try {
      storageWrapper.get(['stb_form_persistence'])
        .then(result => {
          if (!result.stb_form_persistence) return;
          
          const formData = result.stb_form_persistence;
          const fields = formData.fields || {};
          
          Object.keys(fields).forEach(key => {
            if (key === 'personnel' || key === 'jenisApp') return;
            
            const el = document.getElementById(key);
            if (el) {
              if (el.type === 'checkbox' || el.type === 'radio') {
                el.checked = fields[key];
              } else if (el.type !== 'file') { // <-- TAMBAH SYARAT INI
                el.value = fields[key];
              }
            }
          });
          
          if (fields.jenisApp) {
            const radio = document.querySelector(`input[name="jenisApp"][value="${fields.jenisApp}"]`);
            if (radio) {
              radio.checked = true;
              radio.dispatchEvent(new Event('change'));
            }
          }
          
          const personnelListEl = document.getElementById('personnelList');
          if (personnelListEl && fields.personnel && Array.isArray(fields.personnel)) {
            personnelListEl.innerHTML = '';
            fields.personnel.forEach(person => {
              addPerson(person);
            });
          }
          
          setTimeout(() => {
            initializeTickButtons();
          }, 100);
          
          console.log('V6.5.2 Form data restored from persistence');
        })
        .catch(error => {
          console.error('V6.5.2 Error loading form data:', error);
        });
    } catch (error) {
      console.error('V6.5.2 Error in loadFormData:', error);
    }
  }

  function loadDatabaseFormData() {
    storageWrapper.get(['stb_database_persistence'])
      .then(result => {
        if (!result.stb_database_persistence) return;
        
        const formData = result.stb_database_persistence;
        const fields = formData.fields || {};
        
        Object.keys(fields).forEach(key => {
          if (key === 'cbCreateDriveFolder') {
            const el = document.getElementById(key);
            if (el) {
              el.checked = fields[key];
              el.dispatchEvent(new Event('change'));
            }
          } else {
            const el = document.getElementById(key);
            if (el) {
              if (el.type === 'checkbox' || el.type === 'radio') {
                el.checked = fields[key];
              } else if (el.type !== 'file') { // <-- TAMBAH SYARAT INI
                el.value = fields[key];
              }
            }
          }
        });
        
        console.log('V6.5.2 Database form data restored from persistence');
      })
      .catch(error => {
        console.error('V6.5.2 Error loading database form data:', error);
      });
  }

  // =========================================================================
  // TICK BUTTONS FUNCTIONALITY
  // =========================================================================

  function initializeTickButtons() {
    console.log("V6.5.2 Initializing tick buttons for all status inputs...");
    
    document.querySelectorAll('.status-input-container').forEach(container => {
      const input = container.querySelector('.status-input');
      const tickRightBtn = container.querySelector('.tick-btn.tick-right');
      const tickWrongBtn = container.querySelector('.tick-btn.tick-wrong');
      
      if (tickRightBtn) {
        tickRightBtn.addEventListener('click', () => {
          input.value = '✓';
          input.style.backgroundColor = '#dcfce7';
          input.style.color = '#166534';
          
          input.dispatchEvent(new Event('input'));
          input.dispatchEvent(new Event('change'));
          
          saveFormData();
        });
      }
      
      if (tickWrongBtn) {
        tickWrongBtn.addEventListener('click', () => {
          input.value = 'X';
          input.style.backgroundColor = '#fee2e2';
          input.style.color = '#991b1b';
          
          input.dispatchEvent(new Event('input'));
          input.dispatchEvent(new Event('change'));
          
          saveFormData();
        });
      }
      
      if (input) {
        input.addEventListener('input', saveFormData);
      }
    });

    document.querySelectorAll('.person-card').forEach(card => {
      const docTypes = ['ic', 'sb', 'epf'];
      
      docTypes.forEach(type => {
        const input = card.querySelector(`.status-${type}`);
        if (input) {
          if (!input.parentElement.querySelector('.tick-buttons')) {
            const container = document.createElement('div');
            container.className = 'tick-buttons';
            container.innerHTML = `
              <button type="button" class="tick-btn tick-right" title="Set OK">✓</button>
              <button type="button" class="tick-btn tick-wrong" title="Set X">✗</button>
            `;
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(container);
            
            const tickRightBtn = container.querySelector('.tick-right');
            const tickWrongBtn = container.querySelector('.tick-wrong');
            
            if (tickRightBtn) {
              tickRightBtn.addEventListener('click', () => {
                input.value = '✓';
                input.style.backgroundColor = '#dcfce7';
                input.style.color = '#166534';
                input.dispatchEvent(new Event('input'));
                saveFormData();
              });
            }
            
            if (tickWrongBtn) {
              tickWrongBtn.addEventListener('click', () => {
                input.value = 'X';
                input.style.backgroundColor = '#fee2e2';
                input.style.color = '#991b1b';
                input.dispatchEvent(new Event('input'));
                saveFormData();
              });
            }
          }
          
          input.addEventListener('input', saveFormData);
        }
      });
    });
    
    console.log("V6.5.2 Tick buttons initialized successfully");
  }

  // =========================================================================
  // FUNGSI UPDATE DASHBOARD
  // =========================================================================
  
  function updateDashboard(showLoading = true) {
    console.log("V6.5.2 updateDashboard dipanggil dengan:", {
      currentUser: currentUser?.name,
      cachedDataLength: cachedData?.length,
      period: dashboardData.currentPeriod,
      year: dashboardData.currentYear,
      month: dashboardData.currentMonth,
      day: dashboardData.currentDay
    });
    
    if (dashboardUserInfo && dashboardUserRole) {
      if (currentUser.role === 'PENGESYOR') {
        dashboardUserRole.textContent = 'Pengesyor';
        if(dashboardUserSpecificInfo) dashboardUserSpecificInfo.textContent = 'Statistik berdasarkan syor anda (SOKONG/TIDAK DISOKONG)';
      } else if (currentUser.role === 'PELULUS') {
        dashboardUserRole.textContent = 'Pelulus';
        if(dashboardUserSpecificInfo) dashboardUserSpecificInfo.textContent = 'Statistik berdasarkan keputusan anda (LULUS/TOLAK)';
      } else if (currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN') {
        dashboardUserRole.textContent = currentUser.role === 'ADMIN' ? 'Admin' : 'Ketua Seksyen';
        if(dashboardUserSpecificInfo) dashboardUserSpecificInfo.textContent = 'Statistik keseluruhan sistem';
      } else if (currentUser.role === 'PENGARAH') {
        dashboardUserRole.textContent = 'Pengarah';
        if(dashboardUserSpecificInfo) dashboardUserSpecificInfo.textContent = 'Statistik keseluruhan (Lihat Sahaja)';
      }
    }

    if (!cachedData || cachedData.length === 0) {
      console.warn("V6.5.2 Dashboard: Tiada data cache.");
      showDashboardNoData();
      if(document.getElementById('loading-overlay')) 
         document.getElementById('loading-overlay').style.display = 'none';
      return;
    }
    
    if (showLoading) {
      simulateLoadingWithSteps(
        ['Menganalisis data...', 'Mengira statistik...', 'Membina carta...', 'Siap!'],
        'Menjana Dashboard'
      );
    } else {
      if(document.getElementById('loading-overlay')) 
         document.getElementById('loading-overlay').style.display = 'none';
    }
    
    const currentYear = dashboardData.currentYear;
    const currentMonth = dashboardData.currentMonth;
    const currentDay = dashboardData.currentDay;
    const period = dashboardData.currentPeriod;
    
    let filteredData = [];
    
    console.log("V6.5.2 Filtering data untuk period:", period, "tahun:", currentYear, "bulan:", currentMonth, "hari:", currentDay);
    
    if (period === 'yearly') {
      filteredData = cachedData.filter(item => {
        let dateToUse = null;
        
        if (item.start_date) {
          dateToUse = new Date(item.start_date);
        } else if (item.tarikh_lulus) {
          dateToUse = new Date(item.tarikh_lulus);
        } else if (item.date_submit) {
          dateToUse = new Date(item.date_submit);
        }
        
        if (!dateToUse || isNaN(dateToUse)) return false;
        
        return dateToUse.getFullYear() === currentYear;
      });
    } else if (period === 'daily') {
      filteredData = cachedData.filter(item => {
        let dateToUse = null;
        
        if (item.start_date) {
          dateToUse = new Date(item.start_date);
        } else if (item.tarikh_lulus) {
          dateToUse = new Date(item.tarikh_lulus);
        } else if (item.date_submit) {
          dateToUse = new Date(item.date_submit);
        }
        
        if (!dateToUse || isNaN(dateToUse)) return false;
        
        return dateToUse.getFullYear() === currentYear && 
               dateToUse.getMonth() + 1 === currentMonth && 
               dateToUse.getDate() === currentDay;
      });
    } else {
      filteredData = cachedData.filter(item => {
        let dateToUse = null;
        
        if (item.start_date) {
          dateToUse = new Date(item.start_date);
        } else if (item.tarikh_lulus) {
          dateToUse = new Date(item.tarikh_lulus);
        } else if (item.date_submit) {
          dateToUse = new Date(item.date_submit);
        }
        
        if (!dateToUse || isNaN(dateToUse)) return false;
        
        return dateToUse.getFullYear() === currentYear && dateToUse.getMonth() + 1 === currentMonth;
      });
    }
    
    console.log("V6.5.2 Data setelah filter:", filteredData.length);

    let userSpecificData = filteredData.filter(item => {
      if (currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN' || currentUser.role === 'PENGARAH') {
        return true;
      } else if (currentUser.role === 'PENGESYOR') {
        return item.pengesyor && item.pengesyor.trim().toUpperCase() === currentUser.name.trim().toUpperCase();
      } else if (currentUser.role === 'PELULUS') {
        return item.pelulus && item.pelulus.trim().toUpperCase() === currentUser.name.trim().toUpperCase();
      }
      return false;
    });
    
    console.log("V6.5.2 Data user-specific:", userSpecificData.length);

    const total = userSpecificData.length;
    
    let success = 0;
    let reject = 0;
    let card4Value = 0;
    let lblSuccess = '';
    let lblReject = '';
    let lblStatus = '';
    
    if (currentUser.role === 'PENGESYOR') {
      success = userSpecificData.filter(d => d.syor_status === 'SOKONG').length;
      reject = userSpecificData.filter(d => d.syor_status === 'TIDAK DISOKONG').length;
      card4Value = total - (success + reject);
      
      lblSuccess = 'SOKONG';
      lblReject = 'TOLAK';
      lblStatus = 'PROSES';
    } else if (currentUser.role === 'PELULUS') {
      success = userSpecificData.filter(d => d.kelulusan && d.kelulusan.includes('LULUS')).length;
      reject = userSpecificData.filter(d => d.kelulusan && (d.kelulusan.includes('TOLAK') || d.kelulusan.includes('SIASAT'))).length;
      let percent = total > 0 ? Math.round((success / total) * 100) : 0;
      card4Value = percent + '%';
      
      lblSuccess = 'LULUS';
      lblReject = 'GAGAL';
      lblStatus = 'PERATUS';
    } else if (currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN' || currentUser.role === 'PENGARAH') {
      success = userSpecificData.filter(d => d.kelulusan && d.kelulusan.includes('LULUS')).length;
      reject = userSpecificData.filter(d => d.kelulusan && (d.kelulusan.includes('TOLAK') || d.kelulusan.includes('SIASAT'))).length;
      card4Value = userSpecificData.filter(d => !d.kelulusan || d.kelulusan === '').length;
      
      lblSuccess = 'LULUS';
      lblReject = 'TOLAK';
      lblStatus = 'PROSES';
    }
    
    console.log("V6.5.2 Statistik kad 4:", { total, success, reject, card4Value });
    
    if (totalCountElement) totalCountElement.textContent = total;
    if (successCountElement) successCountElement.textContent = success;
    if (labelSuccessElement) labelSuccessElement.textContent = lblSuccess;
    if (rejectCountElement) rejectCountElement.textContent = reject;
    if (labelRejectElement) labelRejectElement.textContent = lblReject;
    if (processCountElement) processCountElement.textContent = card4Value;
    if (labelStatusElement) labelStatusElement.textContent = lblStatus;
    
    updateApplicationTypeChart(userSpecificData);
    updateStatusChart(userSpecificData);
    
    if (currentUser.role === 'PELULUS' || currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN') {
      updateRejectionReasonChart(userSpecificData);
      if (rejectionReasonChartContainer) {
        rejectionReasonChartContainer.style.display = 'block';
      }
    } else {
      if (rejectionReasonChartContainer) {
        rejectionReasonChartContainer.style.display = 'none';
      }
    }
    
    if (currentUser.role === 'PENGESYOR') {
       if (typeof updateRecommenderCharts === 'function') {
           updateRecommenderCharts(userSpecificData, filteredData);
       }
    } else if (currentUser.role === 'PELULUS' || currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN' || currentUser.role === 'PENGARAH') {
       if (typeof updateApproverCharts === 'function') {
           updateApproverCharts(userSpecificData, filteredData);
       }
    }
    
    if (typeof updateDetailedTable === 'function') {
        updateDetailedTable(userSpecificData, period);
    }
    
    if (typeof updateApplicationTypeStats === 'function') {
      updateApplicationTypeStats(userSpecificData);
    }
    
    if ((currentUser.role === 'PELULUS' || currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN') && typeof updateReasonStats === 'function') {
      updateReasonStats(userSpecificData);
    }
    
    updateKonsultansiChart(userSpecificData);
    
    hideLoading();
  }

  function updateStatusChart(data) {
    const canvasId = 'chartStatus';
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    dashboardStatusChart = safeDestroyChart(dashboardStatusChart, canvasId);
    
    let labels = [], counts = [], colors = [];
    if (currentUser.role === 'PENGESYOR') {
      const sokong = data.filter(d => d.syor_status === 'SOKONG').length;
      const tidak = data.filter(d => d.syor_status === 'TIDAK DISOKONG').length;
      const proses = data.filter(d => !d.syor_status || d.syor_status === '').length;
      labels = ['SOKONG', 'TIDAK SOKONG', 'DALAM PROSES'];
      counts = [sokong, tidak, proses];
      colors = ['#22c55e', '#ef4444', '#f59e0b'];
    } else {
      const lulus = data.filter(d => d.kelulusan && d.kelulusan.includes('LULUS')).length;
      const tolak = data.filter(d => d.kelulusan && (d.kelulusan.includes('TOLAK') || d.kelulusan.includes('SIASAT'))).length;
      const proses = data.length - (lulus + tolak);
      labels = ['LULUS', 'TOLAK/SIASAT', 'DALAM PROSES'];
      counts = [lulus, tolak, proses];
      colors = ['#22c55e', '#ef4444', '#f59e0b'];
    }
    
    dashboardStatusChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderWidth: 3,           
          borderColor: '#ffffff',
          hoverOffset: 15,          
          borderRadius: 8           
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',              
        animation: {
          animateScale: true,
          animateRotate: true,
          duration: 2000,
          easing: 'easeOutElastic'  
        },
        plugins: {
          alive: { enabled: true }, /* KOD BARU: MENGAKTIFKAN NAFAS (ALIVE) */
          title: { display: true, text: currentUser.role === 'PENGESYOR' ? 'Status Syor' : 'Status Permohonan', font: { size: 14, weight: 'bold' } },
          legend: { position: 'bottom' }
        }
      }
    });
  }

  function updateApplicationTypeChart(data) {
    const canvasId = 'chartTypeDist';
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    dashboardTypeChart = safeDestroyChart(dashboardTypeChart, canvasId);
    
    const types = {};
    data.forEach(item => {
      const t = item.jenis ? item.jenis.toUpperCase().trim() : 'LAIN-LAIN';
      types[t] = (types[t] || 0) + 1;
    });
    
    const labels = Object.keys(types);
    const values = Object.values(types);
    if (labels.length === 0) return;
    
    dashboardTypeChart = new Chart(ctx, {
      type: 'doughnut',             
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'],
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 15,          
          borderRadius: 6           
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        animation: {
          animateScale: true,
          duration: 1800,
          easing: 'easeOutQuart'    
        },
        plugins: {
          alive: { enabled: true }, /* KOD BARU: MENGAKTIFKAN NAFAS (ALIVE) */
          title: { display: true, text: 'Jenis Permohonan', font: { size: 14, weight: 'bold' } },
          legend: { position: 'bottom' }
        }
      }
    });
  }

  function updateRejectionReasonChart(data) {
    const container = document.getElementById('chartReasonDistContainer');
    const canvasId = 'chartReasonDist';
    const ctx = document.getElementById(canvasId);
    
    dashboardReasonChart = safeDestroyChart(dashboardReasonChart, canvasId);
    
    if (!ctx || (currentUser.role !== 'PELULUS' && currentUser.role !== 'ADMIN' && currentUser.role !== 'KETUA SEKSYEN')) {
      if (container) container.style.display = 'none';
      return;
    }
    
    const rejected = data.filter(d => d.kelulusan && (d.kelulusan.includes('TOLAK') || d.kelulusan.includes('SIASAT')));
    if (rejected.length === 0) {
      if (container) container.style.display = 'none';
      return;
    }
    
    if (container) container.style.display = 'block';
    const reasons = {};
    rejected.forEach(item => {
      const r = item.alasan ? item.alasan.trim() : 'Tiada Alasan';
      reasons[r] = (reasons[r] || 0) + 1;
    });
    
    const sortedReasons = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const reasonLabels = sortedReasons.map(r => r[0].length > 30 ? r[0].substring(0, 27) + '...' : r[0]);
    const reasonValues = sortedReasons.map(r => r[1]);
    
    dashboardReasonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: reasonLabels,
        datasets: [{
          label: 'Jumlah',
          data: reasonValues,
          backgroundColor: '#ef4444',
          borderRadius: 8,          
          borderSkipped: false,
          barPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1500,
          easing: 'easeOutQuart'    
        },
        plugins: {
          alive: { enabled: true }, /* KOD BARU: MENGAKTIFKAN NAFAS (ALIVE) */
          title: { display: true, text: 'Alasan Penolakan', font: { size: 14, weight: 'bold' } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { display: false } } 
        }
      }
    });
  }

  function updateKonsultansiChart(data) {
    const canvasId = 'chartKonsultansi';
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    dashboardKonsultansiChart = safeDestroyChart(dashboardKonsultansiChart, canvasId);
    
    const counts = { 'Emel': 0, 'WhatsApp': 0, 'Call': 0 };
    data.forEach(item => {
      const konsultansi = (item.jenis_konsultansi || '').toLowerCase();
      if (konsultansi.includes('emel')) counts['Emel']++;
      if (konsultansi.includes('whatsapp')) counts['WhatsApp']++;
      if (konsultansi.includes('call') || konsultansi.includes('panggilan')) counts['Call']++;
    });
    
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    
    dashboardKonsultansiChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Jumlah Konsultansi',
          data: values,
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
          borderRadius: 8,          
          borderSkipped: false,
          maxBarThickness: 50
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1500,
          easing: 'easeOutQuart'    
        },
        plugins: {
          alive: { enabled: true }, /* KOD BARU: MENGAKTIFKAN NAFAS (ALIVE) */
          title: { display: true, text: 'Statistik Jenis Konsultansi', font: { size: 14, weight: 'bold' } },
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Bilangan' }, ticks: { stepSize: 1 }, border: { display: false } },
          x: { grid: { display: false }, border: { display: false } }
        }
      }
    });
  }

  function updateRecommenderCharts(userData, filteredData) {
    if (recommenderMonthlyChart) { recommenderMonthlyChart.destroy(); recommenderMonthlyChart = null; }
    const monthlyTrendCanvas = document.getElementById('chartMonthlyTrend');
    if (!monthlyTrendCanvas) return;
    const monthlyCtx = monthlyTrendCanvas.getContext('2d');
    
    monthlyCtx.clearRect(0, 0, monthlyTrendCanvas.width, monthlyTrendCanvas.height);
    const monthlyData = {};
    const monthlyLabels = [];
    const currentYear = dashboardData.currentYear;
    const currentMonth = dashboardData.currentMonth;
    
    const monthsToShow = 6;
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${date.toLocaleString('ms-MY', { month: 'short' })} ${date.getFullYear()}`;
      monthlyData[monthKey] = { label: monthLabel, supported: 0, notSupported: 0 };
      monthlyLabels.push(monthKey);
    }
    
    filteredData.forEach(item => {
      if (item.start_date && item.pengesyor && item.pengesyor.toUpperCase() === currentUser.name.toUpperCase()) {
        const date = new Date(item.start_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[monthKey]) {
          if (item.syor_status && item.syor_status.includes('TIDAK DISOKONG')) monthlyData[monthKey].notSupported++;
          else if (item.syor_status && item.syor_status.includes('SOKONG')) monthlyData[monthKey].supported++;
        }
      }
    });
    
    recommenderMonthlyChart = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: monthlyLabels.map(key => monthlyData[key]?.label || key),
        datasets: [
          {
            label: 'SOKONG',
            data: monthlyLabels.map(key => monthlyData[key]?.supported || 0),
            backgroundColor: '#10b981',
            borderRadius: 6,        
            borderSkipped: false
          },
          {
            label: 'TIDAK DISOKONG',
            data: monthlyLabels.map(key => monthlyData[key]?.notSupported || 0),
            backgroundColor: '#ef4444',
            borderRadius: 6,        
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1500, easing: 'easeOutQuart' }, 
        plugins: {
          alive: { enabled: true }, /* KOD BARU: MENGAKTIFKAN NAFAS (ALIVE) */
          legend: { position: 'top' },
          title: { display: true, text: 'Trend Syor Bulanan' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Bilangan Syor' }, ticks: { stepSize: 1 }, border: { display: false } },
          x: { title: { display: true, text: 'Bulan' }, grid: { display: false }, border: { display: false } }
        }
      }
    });
  }

  function updateApproverCharts(userData, filteredData) {
    if (approverMonthlyChart) { approverMonthlyChart.destroy(); approverMonthlyChart = null; }
    const monthlyTrendCanvas = document.getElementById('chartMonthlyTrend');
    if (!monthlyTrendCanvas) return;
    const monthlyCtx = monthlyTrendCanvas.getContext('2d');
    
    monthlyCtx.clearRect(0, 0, monthlyTrendCanvas.width, monthlyTrendCanvas.height);
    const monthlyData = {};
    const monthlyLabels = [];
    const currentYear = dashboardData.currentYear;
    const currentMonth = dashboardData.currentMonth;
    
    const monthsToShow = 6;
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${date.toLocaleString('ms-MY', { month: 'short' })} ${date.getFullYear()}`;
      monthlyData[monthKey] = { label: monthLabel, approved: 0, rejected: 0 };
      monthlyLabels.push(monthKey);
    }
    
    filteredData.forEach(item => {
      if (item.start_date) {
        const date = new Date(item.start_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[monthKey]) {
          if (item.kelulusan && item.kelulusan.includes('LULUS')) monthlyData[monthKey].approved++;
          else if (item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))) monthlyData[monthKey].rejected++;
        }
      }
    });
    
    approverMonthlyChart = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: monthlyLabels.map(key => monthlyData[key]?.label || key),
        datasets: [
          {
            label: 'DILULUSKAN',
            data: monthlyLabels.map(key => monthlyData[key]?.approved || 0),
            backgroundColor: '#10b981',
            borderRadius: 6,        
            borderSkipped: false
          },
          {
            label: 'DITOLAK/SIASAT',
            data: monthlyLabels.map(key => monthlyData[key]?.rejected || 0),
            backgroundColor: '#ef4444',
            borderRadius: 6,        
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1500, easing: 'easeOutQuart' }, 
        plugins: {
          alive: { enabled: true }, /* KOD BARU: MENGAKTIFKAN NAFAS (ALIVE) */
          legend: { position: 'top' },
          title: { display: true, text: 'Trend Kelulusan Bulanan' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Bilangan Permohonan' }, ticks: { stepSize: 1 }, border: { display: false } },
          x: { title: { display: true, text: 'Bulan' }, grid: { display: false }, border: { display: false } }
        }
      }
    });
  }

  // =========================================================================
  // FUNGSI INITIALIZE DASHBOARD
  // =========================================================================

  function initializeDashboard() {
    console.log("V6.5.2 Initializing dashboard...");
    
    if (dashboardDay) {
      dashboardDay.innerHTML = '';
      for (let i = 1; i <= 31; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = i.toString().padStart(2, '0');
        dashboardDay.appendChild(option);
      }
    }
    
    if (dashboardPeriod && !dashboardPeriod.hasAttribute('data-listener')) {
      dashboardPeriod.setAttribute('data-listener', 'true');
      dashboardPeriod.addEventListener('change', (e) => {
        dashboardData.currentPeriod = e.target.value;
        if (dashboardMonth) dashboardMonth.style.display = (e.target.value === 'monthly' || e.target.value === 'daily') ? 'block' : 'none';
        if (dashboardDay) dashboardDay.style.display = (e.target.value === 'daily') ? 'block' : 'none';
        updateDashboard(true);
      });
    }
    
    if (dashboardYear && !dashboardYear.hasAttribute('data-listener')) {
      dashboardYear.setAttribute('data-listener', 'true');
      dashboardYear.addEventListener('change', (e) => {
        dashboardData.currentYear = parseInt(e.target.value);
        updateDashboard(true);
      });
    }
    
    if (dashboardMonth && !dashboardMonth.hasAttribute('data-listener')) {
      dashboardMonth.setAttribute('data-listener', 'true');
      dashboardMonth.addEventListener('change', (e) => {
        dashboardData.currentMonth = parseInt(e.target.value);
        updateDashboard(true);
      });
    }
    
    if (dashboardDay && !dashboardDay.hasAttribute('data-listener')) {
      dashboardDay.setAttribute('data-listener', 'true');
      dashboardDay.addEventListener('change', (e) => {
        dashboardData.currentDay = parseInt(e.target.value);
        updateDashboard(true);
      });
    }
    
    if (isDashboardFirstLoad) {
      const now = new Date();
      dashboardData.currentPeriod = 'monthly';
      dashboardData.currentYear = now.getFullYear();
      dashboardData.currentMonth = now.getMonth() + 1;
      dashboardData.currentDay = now.getDate();
      
      isDashboardFirstLoad = false; 
    }
    
    if (dashboardPeriod) dashboardPeriod.value = dashboardData.currentPeriod;
    
    if (dashboardYear) {
       const yearOption = dashboardYear.querySelector(`option[value="${dashboardData.currentYear}"]`);
       if (yearOption) dashboardYear.value = dashboardData.currentYear;
    }
    
    if (dashboardMonth) {
      const monthStr = dashboardData.currentMonth.toString().padStart(2, '0');
      dashboardMonth.value = monthStr;
      dashboardMonth.style.display = (dashboardData.currentPeriod === 'monthly' || dashboardData.currentPeriod === 'daily') ? 'block' : 'none';
    }
    
    if (dashboardDay) {
      const dayStr = dashboardData.currentDay.toString().padStart(2, '0');
      dashboardDay.value = dayStr;
      dashboardDay.style.display = (dashboardData.currentPeriod === 'daily') ? 'block' : 'none';
    }
    
    updateDashboard(false);
  }

  function updateApplicationTypeStats(data) {
    if (!typeStats) return;
    
    const typeCounts = {
      'BARU': 0,
      'PEMBAHARUAN': 0,
      'UBAH MAKLUMAT': 0,
      'UBAH GRED': 0
    };
    
    data.forEach(item => {
      const jenis = item.jenis ? item.jenis.toUpperCase() : '';
      if (typeCounts.hasOwnProperty(jenis)) {
        typeCounts[jenis]++;
      } else if (jenis) {
        typeCounts[jenis] = 1;
      }
    });
    
    let badgesHtml = '';
    const colors = {
      'BARU': '#3b82f6',
      'PEMBAHARUAN': '#10b981',
      'UBAH MAKLUMAT': '#f59e0b',
      'UBAH GRED': '#8b5cf6'
    };
    
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > 0) {
        const color = colors[type] || '#6b7280';
        badgesHtml += `
          <div class="type-badge" style="background: ${color}20; border: 1px solid ${color}; color: ${color};">
            ${type}
            <span class="type-count" style="background: ${color}; color: white;">${count}</span>
          </div>
        `;
      }
    }
    
    if (badgesHtml === '') {
      badgesHtml = '<div style="color: #64748b; font-size: 0.9rem;">Tiada data jenis permohonan</div>';
    }
    
    typeStats.innerHTML = badgesHtml;
  }

  function updateRecommenderCharts(userData, filteredData) {
    if (recommenderMonthlyChart) { recommenderMonthlyChart.destroy(); recommenderMonthlyChart = null; }
    const monthlyTrendCanvas = document.getElementById('chartMonthlyTrend');
    if (!monthlyTrendCanvas) return;
    const monthlyCtx = monthlyTrendCanvas.getContext('2d');
    
    monthlyCtx.clearRect(0, 0, monthlyTrendCanvas.width, monthlyTrendCanvas.height);
    const monthlyData = {};
    const monthlyLabels = [];
    const currentYear = dashboardData.currentYear;
    const currentMonth = dashboardData.currentMonth;
    
    const monthsToShow = 6;
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${date.toLocaleString('ms-MY', { month: 'short' })} ${date.getFullYear()}`;
      monthlyData[monthKey] = { label: monthLabel, supported: 0, notSupported: 0 };
      monthlyLabels.push(monthKey);
    }
    
    filteredData.forEach(item => {
      if (item.start_date && item.pengesyor && item.pengesyor.toUpperCase() === currentUser.name.toUpperCase()) {
        const date = new Date(item.start_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[monthKey]) {
          if (item.syor_status && item.syor_status.includes('TIDAK DISOKONG')) monthlyData[monthKey].notSupported++;
          else if (item.syor_status && item.syor_status.includes('SOKONG')) monthlyData[monthKey].supported++;
        }
      }
    });
    
    recommenderMonthlyChart = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: monthlyLabels.map(key => monthlyData[key]?.label || key),
        datasets: [
          {
            label: 'SOKONG',
            data: monthlyLabels.map(key => monthlyData[key]?.supported || 0),
            backgroundColor: '#10b981',
            borderRadius: 6,        /* KOD BARU */
            borderSkipped: false
          },
          {
            label: 'TIDAK DISOKONG',
            data: monthlyLabels.map(key => monthlyData[key]?.notSupported || 0),
            backgroundColor: '#ef4444',
            borderRadius: 6,        /* KOD BARU */
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1500, easing: 'easeOutQuart' }, /* KOD BARU */
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Bilangan Syor' }, ticks: { stepSize: 1 }, border: { display: false } },
          x: { title: { display: true, text: 'Bulan' }, grid: { display: false }, border: { display: false } }
        },
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Trend Syor Bulanan' }
        }
      }
    });
  }

  function updateApproverCharts(userData, filteredData) {
    if (approverMonthlyChart) { approverMonthlyChart.destroy(); approverMonthlyChart = null; }
    const monthlyTrendCanvas = document.getElementById('chartMonthlyTrend');
    if (!monthlyTrendCanvas) return;
    const monthlyCtx = monthlyTrendCanvas.getContext('2d');
    
    monthlyCtx.clearRect(0, 0, monthlyTrendCanvas.width, monthlyTrendCanvas.height);
    const monthlyData = {};
    const monthlyLabels = [];
    const currentYear = dashboardData.currentYear;
    const currentMonth = dashboardData.currentMonth;
    
    const monthsToShow = 6;
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${date.toLocaleString('ms-MY', { month: 'short' })} ${date.getFullYear()}`;
      monthlyData[monthKey] = { label: monthLabel, approved: 0, rejected: 0 };
      monthlyLabels.push(monthKey);
    }
    
    filteredData.forEach(item => {
      if (item.start_date) {
        const date = new Date(item.start_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[monthKey]) {
          if (item.kelulusan && item.kelulusan.includes('LULUS')) monthlyData[monthKey].approved++;
          else if (item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))) monthlyData[monthKey].rejected++;
        }
      }
    });
    
    approverMonthlyChart = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: monthlyLabels.map(key => monthlyData[key]?.label || key),
        datasets: [
          {
            label: 'DILULUSKAN',
            data: monthlyLabels.map(key => monthlyData[key]?.approved || 0),
            backgroundColor: '#10b981',
            borderRadius: 6,        /* KOD BARU */
            borderSkipped: false
          },
          {
            label: 'DITOLAK/SIASAT',
            data: monthlyLabels.map(key => monthlyData[key]?.rejected || 0),
            backgroundColor: '#ef4444',
            borderRadius: 6,        /* KOD BARU */
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1500, easing: 'easeOutQuart' }, /* KOD BARU */
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Bilangan Permohonan' }, ticks: { stepSize: 1 }, border: { display: false } },
          x: { title: { display: true, text: 'Bulan' }, grid: { display: false }, border: { display: false } }
        },
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Trend Kelulusan Bulanan' }
        }
      }
    });
  }

  function updateReasonStats(data) {
    if (!reasonStats) return;
    
    const reasonCounts = {};
    const rejectedData = data.filter(item => 
      item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))
    );
    
    rejectedData.forEach(item => {
      const alasan = item.alasan || 'Tiada alasan dinyatakan';
      if (reasonCounts[alasan]) {
        reasonCounts[alasan]++;
      } else {
        reasonCounts[alasan] = 1;
      }
    });
    
    let reasonCardsHtml = '';
    const totalRejected = rejectedData.length;
    const reasonColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4'];
    
    let colorIndex = 0;
    for (const [reason, count] of Object.entries(reasonCounts)) {
      const percentage = totalRejected > 0 ? Math.round((count / totalRejected) * 100) : 0;
      const color = reasonColors[colorIndex % reasonColors.length];
      
      reasonCardsHtml += `
        <div class="reason-card" style="border-left-color: ${color};">
          <h4>
            <span>${reason}</span>
            <span class="reason-count">${count}</span>
          </h4>
          <div>${percentage}% dari total ditolak</div>
          <div class="reason-bar">
            <div class="reason-fill" style="width: ${percentage}%; background: ${color};"></div>
          </div>
        </div>
      `;
      
      colorIndex++;
    }
    
    if (reasonCardsHtml === '') {
      reasonCardsHtml = '<div style="color: #64748b; font-size: 0.9rem; text-align: center;">Tiada data alasan penolakan</div>';
    }
    
    reasonStats.innerHTML = reasonCardsHtml;
  }

  function updateDetailedTable(data, period) {
    if (!detailedTableBody) return;
    
    let rowsHtml = '';
    
    if (period === 'yearly') {
      const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
      
      months.forEach((month, index) => {
        const monthData = data.filter(item => {
          if (!item.start_date) return false;
          const date = new Date(item.start_date);
          return date.getMonth() === index;
        });
        
        if (currentUser.role === 'PENGESYOR') {
          const user = currentUser.name.toUpperCase();
          const userData = monthData.filter(item => item.pengesyor && item.pengesyor.toUpperCase() === user);
          
          const total = userData.length;
          const supported = userData.filter(item => 
            item.syor_status && item.syor_status.includes('SOKONG') && !item.syor_status.includes('TIDAK')
          ).length;
          const notSupported = userData.filter(item => 
            item.syor_status && item.syor_status.includes('TIDAK DISOKONG')
          ).length;
          const inProcess = userData.filter(item => 
            !item.syor_status || item.syor_status === ''
          ).length;
          const rate = total > 0 ? Math.round((supported / total) * 100) : 0;
          
          rowsHtml += `
            <tr>
              <td>${month}</td>
              <td>${total}</td>
              <td>${supported}</td>
              <td>${notSupported}</td>
              <td>${inProcess}</td>
              <td>${rate}%</td>
            </tr>
          `;
        } else {
          const total = monthData.length;
          const approved = monthData.filter(item => 
            item.kelulusan && item.kelulusan.includes('LULUS')
          ).length;
          const rejected = monthData.filter(item => 
            item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))
          ).length;
          const inProcess = monthData.filter(item => 
            !item.kelulusan || item.kelulusan === ''
          ).length;
          const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
          
          rowsHtml += `
            <tr>
              <td>${month}</td>
              <td>${total}</td>
              <td>${approved}</td>
              <td>${rejected}</td>
              <td>${inProcess}</td>
              <td>${rate}%</td>
            </tr>
          `;
        }
      });
    } else if (period === 'daily') {
      rowsHtml = `
        <tr>
          <td colspan="6" style="text-align:center;">
            Paparan Harian: ${dashboardData.currentDay}/${dashboardData.currentMonth}/${dashboardData.currentYear}<br>
            Jumlah rekod: ${data.length}
          </td>
        </tr>
      `;
    } else {
      const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
      const monthName = monthNames[dashboardData.currentMonth - 1];
      
      const weeks = [];
      data.forEach(item => {
        if (item.start_date) {
          const date = new Date(item.start_date);
          const week = Math.ceil(date.getDate() / 7);
          if (!weeks[week]) weeks[week] = [];
          weeks[week].push(item);
        }
      });
      
      for (let week = 1; week <= 5; week++) {
        const weekData = weeks[week] || [];
        
        if (currentUser.role === 'PENGESYOR') {
          const user = currentUser.name.toUpperCase();
          const userData = weekData.filter(item => item.pengesyor && item.pengesyor.toUpperCase() === user);
          
          const total = userData.length;
          const supported = userData.filter(item => 
            item.syor_status && item.syor_status.includes('SOKONG') && !item.syor_status.includes('TIDAK')
          ).length;
          const notSupported = userData.filter(item => 
            item.syor_status && item.syor_status.includes('TIDAK DISOKONG')
          ).length;
          const inProcess = userData.filter(item => 
            !item.syor_status || item.syor_status === ''
          ).length;
          const rate = total > 0 ? Math.round((supported / total) * 100) : 0;
          
          rowsHtml += `
            <tr>
              <td>Minggu ${week} (${monthName})</td>
              <td>${total}</td>
              <td>${supported}</td>
              <td>${notSupported}</td>
              <td>${inProcess}</td>
              <td>${rate}%</td>
            </tr>
          `;
        } else {
          const total = weekData.length;
          const approved = weekData.filter(item => 
            item.kelulusan && item.kelulusan.includes('LULUS')
          ).length;
          const rejected = weekData.filter(item => 
            item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))
          ).length;
          const inProcess = weekData.filter(item => 
            !item.kelulusan || item.kelulusan === ''
          ).length;
          const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
          
          rowsHtml += `
            <tr>
              <td>Minggu ${week} (${monthName})</td>
              <td>${total}</td>
              <td>${approved}</td>
              <td>${rejected}</td>
              <td>${inProcess}</td>
              <td>${rate}%</td>
            </tr>
          `;
        }
      }
    }
    
    if (rowsHtml === '') {
      rowsHtml = `<tr><td colspan="6" style="text-align:center;">Tiada data untuk dipaparkan</td></tr>`;
    }
    
    detailedTableBody.innerHTML = rowsHtml;
  }

  function showDashboardNoData() {
    if (document.querySelector('.stat-card')) {
      document.querySelectorAll('.stat-card').forEach(card => {
        card.style.display = 'none';
      });
    }
    
    if (chartTypeMonthlyContainer) chartTypeMonthlyContainer.style.display = 'none';
    if (chartTypeYearlyContainer) chartTypeYearlyContainer.style.display = 'none';
    
    if (approverMonthlyChart) {
      approverMonthlyChart.destroy();
      approverMonthlyChart = null;
    }
    
    if (recommenderMonthlyChart) {
      recommenderMonthlyChart.destroy();
      recommenderMonthlyChart = null;
    }
    
    if (typeMonthlyChart) {
      typeMonthlyChart.destroy();
      typeMonthlyChart = null;
    }
    
    if (typeYearlyChart) {
      typeYearlyChart.destroy();
      typeYearlyChart = null;
    }
    
    dashboardStatusChart = safeDestroyChart(dashboardStatusChart, 'chartStatus');
    dashboardTypeChart = safeDestroyChart(dashboardTypeChart, 'chartTypeDist');
    dashboardReasonChart = safeDestroyChart(dashboardReasonChart, 'chartReasonDist');
    dashboardTrendChart = safeDestroyChart(dashboardTrendChart, 'chartMonthlyTrend');
    dashboardKonsultansiChart = safeDestroyChart(dashboardKonsultansiChart, 'chartKonsultansi');
    
    const canvases = [
      'chartMonthlyTrend', 'chartStatus', 'chartTypeMonthly', 'chartTypeYearly',
      'chartTypeDist', 'chartReasonDist', 'chartKonsultansi'
    ];
    
    canvases.forEach(canvasId => {
      const canvas = document.getElementById(canvasId);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    });

    if (dashboardUserInfo) {
      dashboardUserInfo.innerHTML = `
        <p style="margin: 0; font-weight: 600; color: #64748b;">
          📊 Tiada data untuk dipaparkan
        </p>
        <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #94a3b8;">
          Sila muat turun data atau hantar permohonan terlebih dahulu
        </p>
      `;
    }
    
    if (detailedTableBody) {
      detailedTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Tiada data untuk dipaparkan</td></tr>`;
    }
    
    if (chartMonthlyTrend) {
      const container = chartMonthlyTrend.parentElement;
      if (container) {
        container.style.display = 'none';
      }
    }
    
    if (chartStatus) {
      const container = chartStatus.parentElement;
      if (container) {
        container.style.display = 'none';
      }
    }
    
    if (chartTypeMonthly) {
      const container = chartTypeMonthly.parentElement;
      if (container) {
        container.style.display = 'none';
      }
    }
    
    if (chartTypeYearly) {
      const container = chartTypeYearly.parentElement;
      if (container) {
        container.style.display = 'none';
      }
    }
    
    if (applicationTypeChartContainer) {
      applicationTypeChartContainer.style.display = 'none';
    }
    
    if (rejectionReasonChartContainer) {
      rejectionReasonChartContainer.style.display = 'none';
    }
  }

  // =========================================================================
  // FUNGSI ADMIN DASHBOARD
  // =========================================================================

  function loadAdminDashboard() {
    console.log("V6.5.2 Loading admin dashboard...");
    
    if (!cachedData || cachedData.length === 0) {
      console.warn("V6.5.2 No data for admin dashboard");
      if (adminTotalCount) adminTotalCount.textContent = '0';
      if (adminApprovedCount) adminApprovedCount.textContent = '0';
      if (adminRejectedCount) adminRejectedCount.textContent = '0';
      if (adminPendingCount) adminPendingCount.textContent = '0';
      if (adminPengesyorTbody) adminPengesyorTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tiada data</td></tr>';
      if (adminPelulusTbody) adminPelulusTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tiada data</td></tr>';
      if (adminRejectionReasonStats) adminRejectionReasonStats.innerHTML = '<div style="text-align:center; color:#64748b;">Tiada data penolakan</div>';
      const adminJenisTbody = document.getElementById('adminJenisTbody');
      if (adminJenisTbody) adminJenisTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Tiada data</td></tr>';
      return;
    }
    
    const selectedMonth = adminFilterMonth ? parseInt(adminFilterMonth.value) : null;
    const selectedYear = adminFilterYear ? parseInt(adminFilterYear.value) : dashboardData.currentYear;
    
    let filteredData = cachedData;
    if (selectedMonth && selectedYear) {
      filteredData = cachedData.filter(item => {
        let dateToUse = null;
        if (item.start_date) {
          dateToUse = new Date(item.start_date);
        } else if (item.tarikh_lulus) {
          dateToUse = new Date(item.tarikh_lulus);
        } else if (item.date_submit) {
          dateToUse = new Date(item.date_submit);
        }
        
        if (!dateToUse || isNaN(dateToUse)) return false;
        
        return dateToUse.getMonth() + 1 === selectedMonth && dateToUse.getFullYear() === selectedYear;
      });
    } else if (selectedYear) {
      filteredData = cachedData.filter(item => {
        let dateToUse = null;
        if (item.start_date) {
          dateToUse = new Date(item.start_date);
        } else if (item.tarikh_lulus) {
          dateToUse = new Date(item.tarikh_lulus);
        } else if (item.date_submit) {
          dateToUse = new Date(item.date_submit);
        }
        
        if (!dateToUse || isNaN(dateToUse)) return false;
        
        return dateToUse.getFullYear() === selectedYear;
      });
    }
    
    const total = filteredData.length;
    const lulus = filteredData.filter(item => item.kelulusan && item.kelulusan.includes('LULUS')).length;
    const tolak = filteredData.filter(item => item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))).length;
    const proses = total - (lulus + tolak);
    
    if (adminTotalCount) adminTotalCount.textContent = total;
    if (adminApprovedCount) adminApprovedCount.textContent = lulus;
    if (adminRejectedCount) adminRejectedCount.textContent = tolak;
    if (adminPendingCount) adminPendingCount.textContent = proses;
    
    const jenisStats = {
      'BARU': 0,
      'PEMBAHARUAN': 0,
      'UBAH MAKLUMAT': 0,
      'UBAH GRED': 0,
      'LAIN-LAIN': 0
    };
    
    filteredData.forEach(item => {
      const jenis = item.jenis ? item.jenis.toUpperCase().trim() : 'LAIN-LAIN';
      if (jenisStats.hasOwnProperty(jenis)) {
        jenisStats[jenis]++;
      } else {
        jenisStats['LAIN-LAIN']++;
      }
    });
    
    renderAdminJenisTable(jenisStats, total);
    
    const pengesyorStats = {};
    const pelulusStats = {};
    
    filteredData.forEach(item => {
      const pengesyor = item.pengesyor || 'Tiada Pengesyor';
      if (!pengesyorStats[pengesyor]) {
        pengesyorStats[pengesyor] = { total: 0, sokong: 0, tidak_sokong: 0 };
      }
      pengesyorStats[pengesyor].total++;
      
      if (item.syor_status === 'SOKONG') {
        pengesyorStats[pengesyor].sokong++;
      } else if (item.syor_status === 'TIDAK DISOKONG') {
        pengesyorStats[pengesyor].tidak_sokong++;
      }
      
      const pelulus = item.pelulus || 'Tiada Pelulus';
      if (!pelulusStats[pelulus]) {
        pelulusStats[pelulus] = { total: 0, lulus: 0, tolak: 0 };
      }
      pelulusStats[pelulus].total++;
      
      if (item.kelulusan && item.kelulusan.includes('LULUS')) {
        pelulusStats[pelulus].lulus++;
      } else if (item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))) {
        pelulusStats[pelulus].tolak++;
      }
    });
    
    renderAdminPengesyorTable(pengesyorStats);
    renderAdminPelulusTable(pelulusStats);
    
    renderAdminRejectionReasons(filteredData);
  }

  function renderAdminJenisTable(jenisStats, total) {
    const adminJenisTbody = document.getElementById('adminJenisTbody');
    if (!adminJenisTbody) return;
    
    let html = '';
    const jenisColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];
    let colorIndex = 0;
    
    for (const [jenis, count] of Object.entries(jenisStats)) {
      if (count > 0) {
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        const color = jenisColors[colorIndex % jenisColors.length];
        html += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px; font-weight: 600;">${jenis}</td>
            <td style="padding: 8px; text-align: center; font-weight: bold;">${count}</td>
            <td style="padding: 8px;">
              <div style="display: flex; align-items: center;">
                <span style="width: 50px;">${percentage}%</span>
                <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; margin-left: 8px;">
                  <div style="width: ${percentage}%; height: 8px; background: ${color}; border-radius: 4px;"></div>
                </div>
              </div>
            </td>
          </tr>
        `;
        colorIndex++;
      }
    }
    
    if (html === '') {
      html = '<tr><td colspan="3" style="text-align:center; padding: 8px;">Tiada data</td></tr>';
    }
    
    adminJenisTbody.innerHTML = html;
  }

  function renderAdminPengesyorTable(stats) {
    if (!adminPengesyorTbody) return;
    
    let html = '';
    const sorted = Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
    
    sorted.forEach(([nama, data]) => {
      const kadarSokong = data.total > 0 ? Math.round((data.sokong / data.total) * 100) : 0;
      html += `
        <tr>
          <td>${nama}</td>
          <td>${data.total}</td>
          <td>${data.sokong}</td>
          <td>${data.tidak_sokong}</td>
          <td>${kadarSokong}%</td>
        </tr>
      `;
    });
    
    if (html === '') {
      html = '<tr><td colspan="5" style="text-align:center;">Tiada data</td></tr>';
    }
    
    adminPengesyorTbody.innerHTML = html;
  }

  function renderAdminPelulusTable(stats) {
    if (!adminPelulusTbody) return;
    
    let html = '';
    const sorted = Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
    
    sorted.forEach(([nama, data]) => {
      const kadarLulus = data.total > 0 ? Math.round((data.lulus / data.total) * 100) : 0;
      html += `
        <tr>
          <td>${nama}</td>
          <td>${data.total}</td>
          <td>${data.lulus}</td>
          <td>${data.tolak}</td>
          <td>${kadarLulus}%</td>
        </tr>
      `;
    });
    
    if (html === '') {
      html = '<tr><td colspan="5" style="text-align:center;">Tiada data</td></tr>';
    }
    
    adminPelulusTbody.innerHTML = html;
  }
  
  function renderAdminRejectionReasons(data) {
    if (!adminRejectionReasonStats) return;
    
    const rejectedData = data.filter(item => 
      item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))
    );
    
    if (rejectedData.length === 0) {
      adminRejectionReasonStats.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">Tiada rekod penolakan untuk tempoh ini</div>';
      return;
    }
    
    const reasonCounts = {};
    rejectedData.forEach(item => {
      const alasan = item.alasan || 'Tiada alasan dinyatakan';
      reasonCounts[alasan] = (reasonCounts[alasan] || 0) + 1;
    });
    
    const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
    const totalRejected = rejectedData.length;
    
    let html = '<table style="width:100%; border-collapse:collapse;">';
    html += '<thead><tr style="background:#1e40af; color:white;"><th>Alasan Penolakan</th><th>Bilangan</th><th>Peratusan</th></tr></thead><tbody>';
    
    sortedReasons.forEach(([alasan, count]) => {
      const percentage = Math.round((count / totalRejected) * 100);
      html += `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:8px;">${alasan}</td>
          <td style="padding:8px; text-align:center; font-weight:bold;">${count}</td>
          <td style="padding:8px;">
            <div style="display:flex; align-items:center;">
              <span style="width:50px;">${percentage}%</span>
              <div style="flex:1; height:8px; background:#fee2e2; border-radius:4px; margin-left:8px;">
                <div style="width:${percentage}%; height:8px; background:#ef4444; border-radius:4px;"></div>
              </div>
            </div>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    adminRejectionReasonStats.innerHTML = html;
  }

  function showAdminStatsModal() {
    if (!adminStatsModal || !adminStatsPrintContent) return;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('ms-MY', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (adminStatsDate) {
      adminStatsDate.textContent = `Dijana pada: ${dateStr}`;
    }
    
    const selectedMonth = adminFilterMonth ? parseInt(adminFilterMonth.value) : null;
    const selectedYear = adminFilterYear ? parseInt(adminFilterYear.value) : dashboardData.currentYear;
    
    let filteredData = cachedData;
    if (selectedMonth && selectedYear) {
      filteredData = cachedData.filter(item => {
        let dateToUse = null;
        if (item.start_date) {
          dateToUse = new Date(item.start_date);
        } else if (item.tarikh_lulus) {
          dateToUse = new Date(item.tarikh_lulus);
        } else if (item.date_submit) {
          dateToUse = new Date(item.date_submit);
        }
        
        if (!dateToUse || isNaN(dateToUse)) return false;
        
        return dateToUse.getMonth() + 1 === selectedMonth && dateToUse.getFullYear() === selectedYear;
      });
    } else if (selectedYear) {
      filteredData = cachedData.filter(item => {
        let dateToUse = null;
        if (item.start_date) {
          dateToUse = new Date(item.start_date);
        } else if (item.tarikh_lulus) {
          dateToUse = new Date(item.tarikh_lulus);
        } else if (item.date_submit) {
          dateToUse = new Date(item.date_submit);
        }
        
        if (!dateToUse || isNaN(dateToUse)) return false;
        
        return dateToUse.getFullYear() === selectedYear;
      });
    }
    
    const pengesyorStats = {};
    const pelulusStats = {};
    const jenisStats = {
      'BARU': 0,
      'PEMBAHARUAN': 0,
      'UBAH MAKLUMAT': 0,
      'UBAH GRED': 0,
      'LAIN-LAIN': 0
    };
    const rejectionReasons = {};
    
    filteredData.forEach(item => {
      const pengesyor = item.pengesyor || 'Tiada Pengesyor';
      if (!pengesyorStats[pengesyor]) {
        pengesyorStats[pengesyor] = { total: 0, sokong: 0, tidak_sokong: 0 };
      }
      pengesyorStats[pengesyor].total++;
      
      if (item.syor_status === 'SOKONG') {
        pengesyorStats[pengesyor].sokong++;
      } else if (item.syor_status === 'TIDAK DISOKONG') {
        pengesyorStats[pengesyor].tidak_sokong++;
      }
      
      const pelulus = item.pelulus || 'Tiada Pelulus';
      if (!pelulusStats[pelulus]) {
        pelulusStats[pelulus] = { total: 0, lulus: 0, tolak: 0 };
      }
      pelulusStats[pelulus].total++;
      
      if (item.kelulusan && item.kelulusan.includes('LULUS')) {
        pelulusStats[pelulus].lulus++;
      } else if (item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))) {
        pelulusStats[pelulus].tolak++;
        
        const alasan = item.alasan || 'Tiada alasan dinyatakan';
        rejectionReasons[alasan] = (rejectionReasons[alasan] || 0) + 1;
      }
      
      const jenis = item.jenis ? item.jenis.toUpperCase().trim() : 'LAIN-LAIN';
      if (jenisStats.hasOwnProperty(jenis)) {
        jenisStats[jenis]++;
      } else {
        jenisStats['LAIN-LAIN']++;
      }
    });
    
    let pengesyorHtml = '';
    Object.entries(pengesyorStats).sort((a, b) => b[1].total - a[1].total).forEach(([nama, data]) => {
      const kadarSokong = data.total > 0 ? Math.round((data.sokong / data.total) * 100) : 0;
      pengesyorHtml += `
        <tr>
          <td>${nama}</td>
          <td>${data.total}</td>
          <td>${data.sokong}</td>
          <td>${data.tidak_sokong}</td>
          <td>${kadarSokong}%</td>
        </tr>
      `;
    });
    
    let pelulusHtml = '';
    Object.entries(pelulusStats).sort((a, b) => b[1].total - a[1].total).forEach(([nama, data]) => {
      const kadarLulus = data.total > 0 ? Math.round((data.lulus / data.total) * 100) : 0;
      pelulusHtml += `
        <tr>
          <td>${nama}</td>
          <td>${data.total}</td>
          <td>${data.lulus}</td>
          <td>${data.tolak}</td>
          <td>${kadarLulus}%</td>
        </tr>
      `;
    });
    
    let jenisHtml = '';
    const jenisColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];
    let colorIndex = 0;
    for (const [jenis, count] of Object.entries(jenisStats)) {
      if (count > 0) {
        const color = jenisColors[colorIndex % jenisColors.length];
        jenisHtml += `
          <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #e2e8f0;">
            <span style="font-weight: 600;">${jenis}</span>
            <span style="background: ${color}; color: white; padding: 2px 10px; border-radius: 20px;">${count}</span>
          </div>
        `;
        colorIndex++;
      }
    }
    
    let rejectionHtml = '';
    const totalRejected = filteredData.filter(item => item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))).length;
    const sortedReasons = Object.entries(rejectionReasons).sort((a, b) => b[1] - a[1]);
    
    sortedReasons.forEach(([alasan, count]) => {
      const percentage = totalRejected > 0 ? Math.round((count / totalRejected) * 100) : 0;
      rejectionHtml += `
        <div style="display: flex; justify-content: space-between; padding: 6px; border-bottom: 1px solid #fee2e2;">
          <span>${alasan}</span>
          <span style="font-weight: bold; color: #b91c1c;">${count} (${percentage}%)</span>
        </div>
      `;
    });
    
    const totalT = filteredData.length;
    const lulusT = filteredData.filter(item => item.kelulusan && item.kelulusan.includes('LULUS')).length;
    const tolakT = filteredData.filter(item => item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))).length;
    const prosesT = totalT - (lulusT + tolakT);
    
    const filterInfo = (selectedMonth && selectedYear) 
      ? `Bulan: ${new Date(selectedYear, selectedMonth - 1).toLocaleString('ms-MY', { month: 'long' })} ${selectedYear}`
      : (selectedYear ? `Tahun: ${selectedYear}` : 'Semua Data');
    
    adminStatsPrintContent.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #1e40af; text-align: center;">RINGKASAN KESELURUHAN</h3>
        <div style="text-align: center; margin-bottom: 10px; font-weight: bold; color: #64748b;">${filterInfo}</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 15px;">
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; text-align: center; border-left: 5px solid #2563eb;">
            <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${totalT}</div>
            <div style="font-size: 12px; color: #64748b;">JUMLAH</div>
          </div>
          <div style="background: #dcfce7; padding: 15px; border-radius: 8px; text-align: center; border-left: 5px solid #22c55e;">
            <div style="font-size: 24px; font-weight: bold; color: #166534;">${lulusT}</div>
            <div style="font-size: 12px; color: #64748b;">LULUS</div>
          </div>
          <div style="background: #fee2e2; padding: 15px; border-radius: 8px; text-align: center; border-left: 5px solid #ef4444;">
            <div style="font-size: 24px; font-weight: bold; color: #991b1b;">${tolakT}</div>
            <div style="font-size: 12px; color: #64748b;">TOLAK/SIASAT</div>
          </div>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center; border-left: 5px solid #f59e0b;">
            <div style="font-size: 24px; font-weight: bold; color: #92400e;">${prosesT}</div>
            <div style="font-size: 12px; color: #64748b;">DALAM PROSES</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #1e40af;">STATISTIK JENIS PERMOHONAN</h3>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          ${jenisHtml || '<div style="padding: 10px; text-align: center;">Tiada data</div>'}
        </div>
      </div>
      
      ${rejectionHtml ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #1e40af;">ANALISIS PENOLAKAN</h3>
        <div style="border: 1px solid #fee2e2; border-radius: 8px; background: #fef2f2; padding: 10px;">
          ${rejectionHtml}
        </div>
      </div>
      ` : ''}
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #1e40af;">STATISTIK MENGIKUT PENGESYOR</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #1e40af; color: white;">
              <th style="padding: 8px; border: 1px solid #3b82f6;">Pengesyor</th>
              <th style="padding: 8px; border: 1px solid #3b82f6;">Jumlah</th>
              <th style="padding: 8px; border: 1px solid #3b82f6;">SOKONG</th>
              <th style="padding: 8px; border: 1px solid #3b82f6;">TIDAK DISOKONG</th>
              <th style="padding: 8px; border: 1px solid #3b82f6;">Kadar Sokongan</th>
            </tr>
          </thead>
          <tbody>
            ${pengesyorHtml || '<tr><td colspan="5" style="text-align:center; padding: 8px;">Tiada data</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div>
        <h3 style="color: #1e40af;">STATISTIK MENGIKUT PELULUS</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #1e40af; color: white;">
              <th style="padding: 8px; border: 1px solid #3b82f6;">Pelulus</th>
              <th style="padding: 8px; border: 1px solid #3b82f6;">Jumlah</th>
              <th style="padding: 8px; border: 1px solid #3b82f6;">LULUS</th>
              <th style="padding: 8px; border: 1px solid #3b82f6;">TOLAK</th>
              <th style="padding: 8px; border: 1px solid #3b82f6;">Kadar Kelulusan</th>
            </tr>
          </thead>
          <tbody>
            ${pelulusHtml || '<tr><td colspan="5" style="text-align:center; padding: 8px;">Tiada data</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    
    adminStatsModal.classList.add('active');
  }

  // =========================================================================
  // FUNGSI MUAT TURUN CSV
  // =========================================================================
  
  function downloadAdminStatsCSV() {
    if (!cachedData || cachedData.length === 0) {
      alert("Tiada data untuk dimuat turun.");
      return;
    }
    
    const selectedMonth = adminFilterMonth ? parseInt(adminFilterMonth.value) : null;
    const selectedYear = adminFilterYear ? parseInt(adminFilterYear.value) : dashboardData.currentYear;
    
    let filteredData = cachedData;
    if (selectedMonth && selectedYear) {
      filteredData = cachedData.filter(item => {
        let dateToUse = null;
        if (item.start_date) {
          dateToUse = new Date(item.start_date);
        } else if (item.tarikh_lulus) {
          dateToUse = new Date(item.tarikh_lulus);
        } else if (item.date_submit) {
          dateToUse = new Date(item.date_submit);
        }
        
        if (!dateToUse || isNaN(dateToUse)) return false;
        
        return dateToUse.getMonth() + 1 === selectedMonth && dateToUse.getFullYear() === selectedYear;
      });
    } else if (selectedYear) {
      filteredData = cachedData.filter(item => {
        let dateToUse = null;
        if (item.start_date) {
          dateToUse = new Date(item.start_date);
        } else if (item.tarikh_lulus) {
          dateToUse = new Date(item.tarikh_lulus);
        } else if (item.date_submit) {
          dateToUse = new Date(item.date_submit);
        }
        
        if (!dateToUse || isNaN(dateToUse)) return false;
        
        return dateToUse.getFullYear() === selectedYear;
      });
    }
    
    const total = filteredData.length;
    const lulus = filteredData.filter(item => item.kelulusan && item.kelulusan.includes('LULUS')).length;
    const tolak = filteredData.filter(item => item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))).length;
    const proses = total - (lulus + tolak);
    
    const jenisStats = {};
    filteredData.forEach(item => {
      const jenis = item.jenis || 'LAIN-LAIN';
      jenisStats[jenis] = (jenisStats[jenis] || 0) + 1;
    });
    
    const rejectionReasons = {};
    filteredData.forEach(item => {
      if (item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))) {
        const alasan = item.alasan || 'Tiada alasan';
        rejectionReasons[alasan] = (rejectionReasons[alasan] || 0) + 1;
      }
    });
    
    const pengesyorStats = {};
    filteredData.forEach(item => {
      const pengesyor = item.pengesyor || 'Tiada Pengesyor';
      if (!pengesyorStats[pengesyor]) {
        pengesyorStats[pengesyor] = { total: 0, sokong: 0, tidak_sokong: 0 };
      }
      pengesyorStats[pengesyor].total++;
      if (item.syor_status === 'SOKONG') pengesyorStats[pengesyor].sokong++;
      else if (item.syor_status === 'TIDAK DISOKONG') pengesyorStats[pengesyor].tidak_sokong++;
    });
    
    const pelulusStats = {};
    filteredData.forEach(item => {
      const pelulus = item.pelulus || 'Tiada Pelulus';
      if (!pelulusStats[pelulus]) {
        pelulusStats[pelulus] = { total: 0, lulus: 0, tolak: 0 };
      }
      pelulusStats[pelulus].total++;
      if (item.kelulusan && item.kelulusan.includes('LULUS')) pelulusStats[pelulus].lulus++;
      else if (item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))) pelulusStats[pelulus].tolak++;
    });
    
    let csvContent = "LAPORAN STATISTIK ADMIN\n";
    csvContent += `Tarikh Jana,${new Date().toLocaleString('ms-MY')}\n`;
    csvContent += `Tempoh,${selectedMonth ? `Bulan ${selectedMonth} ` : ''}Tahun ${selectedYear}\n\n`;
    
    csvContent += "RINGKASAN KESELURUHAN\n";
    csvContent += `Jumlah,${total}\n`;
    csvContent += `LULUS,${lulus}\n`;
    csvContent += `TOLAK/SIASAT,${tolak}\n`;
    csvContent += `DALAM PROSES,${proses}\n\n`;
    
    csvContent += "ANALISIS MENGIKUT JENIS PERMOHONAN\n";
    csvContent += "Jenis,Bilangan\n";
    Object.entries(jenisStats).forEach(([jenis, count]) => {
      csvContent += `${jenis},${count}\n`;
    });
    csvContent += "\n";
    
    csvContent += "ANALISIS PENOLAKAN MENGIKUT ALASAN\n";
    csvContent += "Alasan,Bilangan\n";
    Object.entries(rejectionReasons).forEach(([alasan, count]) => {
      csvContent += `"${alasan}",${count}\n`;
    });
    csvContent += "\n";
    
    csvContent += "PRESTASI PENGESYOR\n";
    csvContent += "Pengesyor,Jumlah,SOKONG,TIDAK DISOKONG,Kadar Sokongan\n";
    Object.entries(pengesyorStats).forEach(([nama, data]) => {
      const kadar = data.total > 0 ? Math.round((data.sokong / data.total) * 100) : 0;
      csvContent += `"${nama}",${data.total},${data.sokong},${data.tidak_sokong},${kadar}%\n`;
    });
    csvContent += "\n";
    
    csvContent += "PRESTASI PELULUS\n";
    csvContent += "Pelulus,Jumlah,LULUS,TOLAK,Kadar Kelulusan\n";
    Object.entries(pelulusStats).forEach(([nama, data]) => {
      const kadar = data.total > 0 ? Math.round((data.lulus / data.total) * 100) : 0;
      csvContent += `"${nama}",${data.total},${data.lulus},${data.tolak},${kadar}%\n`;
    });
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `admin_stats_${selectedYear}${selectedMonth ? '_'+selectedMonth : ''}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadDashboardCSV() {
    if (!cachedData || cachedData.length === 0) {
      alert("Tiada data untuk dimuat turun.");
      return;
    }
    
    const currentYear = dashboardData.currentYear;
    const currentMonth = dashboardData.currentMonth;
    const currentDay = dashboardData.currentDay;
    const period = dashboardData.currentPeriod;
    
    let filteredData = [];
    
    if (period === 'yearly') {
      filteredData = cachedData.filter(item => {
        let dateToUse = item.start_date ? new Date(item.start_date) : (item.tarikh_lulus ? new Date(item.tarikh_lulus) : (item.date_submit ? new Date(item.date_submit) : null));
        if (!dateToUse || isNaN(dateToUse)) return false;
        return dateToUse.getFullYear() === currentYear;
      });
    } else if (period === 'daily') {
      filteredData = cachedData.filter(item => {
        let dateToUse = item.start_date ? new Date(item.start_date) : (item.tarikh_lulus ? new Date(item.tarikh_lulus) : (item.date_submit ? new Date(item.date_submit) : null));
        if (!dateToUse || isNaN(dateToUse)) return false;
        return dateToUse.getFullYear() === currentYear && dateToUse.getMonth() + 1 === currentMonth && dateToUse.getDate() === currentDay;
      });
    } else {
      filteredData = cachedData.filter(item => {
        let dateToUse = item.start_date ? new Date(item.start_date) : (item.tarikh_lulus ? new Date(item.tarikh_lulus) : (item.date_submit ? new Date(item.date_submit) : null));
        if (!dateToUse || isNaN(dateToUse)) return false;
        return dateToUse.getFullYear() === currentYear && dateToUse.getMonth() + 1 === currentMonth;
      });
    }
    
    let userSpecificData = filteredData.filter(item => {
      if (currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN' || currentUser.role === 'PENGARAH') {
        return true;
      } else if (currentUser.role === 'PENGESYOR') {
        return item.pengesyor && item.pengesyor.trim().toUpperCase() === currentUser.name.trim().toUpperCase();
      } else if (currentUser.role === 'PELULUS') {
        return item.pelulus && item.pelulus.trim().toUpperCase() === currentUser.name.trim().toUpperCase();
      }
      return false;
    });
    
    let csvContent = "DATA DASHBOARD INDIVIDU\n";
    csvContent += `Pengguna,${currentUser.name} (${currentUser.role})\n`;
    csvContent += `Tempoh,${period} ${currentYear}${period === 'daily' ? `-${currentMonth}-${currentDay}` : (period === 'monthly' ? `-${currentMonth}` : '')}\n`;
    csvContent += `Tarikh Jana,${new Date().toLocaleString('ms-MY')}\n\n`;
    
    csvContent += "KUMPULAN: BELUM SYOR\n";
    csvContent += "Nama Syarikat,No. CIDB,Jenis Permohonan,Tarikh Mohon,Nama Pengesyor,Status Syor,Nama Pelulus,Status Kelulusan\n";
    const belumSyor = userSpecificData.filter(item => !item.tarikh_syor);
    belumSyor.forEach(item => {
      csvContent += `"${item.syarikat || '-'}",${item.cidb || '-'},${item.jenis || '-'},${item.start_date || '-'},${item.pengesyor || '-'},${item.syor_status || '-'},${item.pelulus || '-'},${item.kelulusan || '-'}\n`;
    });
    
    csvContent += "\nKUMPULAN: TELAH SYOR (MENUNGGU KELULUSAN)\n";
    csvContent += "Nama Syarikat,No. CIDB,Jenis Permohonan,Tarikh Mohon,Nama Pengesyor,Status Syor,Nama Pelulus,Status Kelulusan\n";
    const telahSyor = userSpecificData.filter(item => item.tarikh_syor && (!item.tarikh_lulus || item.tarikh_lulus === ''));
    telahSyor.forEach(item => {
      csvContent += `"${item.syarikat || '-'}",${item.cidb || '-'},${item.jenis || '-'},${item.start_date || '-'},${item.pengesyor || '-'},${item.syor_status || '-'},${item.pelulus || '-'},${item.kelulusan || '-'}\n`;
    });
    
    csvContent += "\nKUMPULAN: SELESAI (LULUS/TOLAK)\n";
    csvContent += "Nama Syarikat,No. CIDB,Jenis Permohonan,Tarikh Mohon,Nama Pengesyor,Status Syor,Nama Pelulus,Status Kelulusan\n";
    const selesai = userSpecificData.filter(item => item.tarikh_lulus && item.tarikh_lulus !== '');
    selesai.forEach(item => {
      csvContent += `"${item.syarikat || '-'}",${item.cidb || '-'},${item.jenis || '-'},${item.start_date || '-'},${item.pengesyor || '-'},${item.syor_status || '-'},${item.pelulus || '-'},${item.kelulusan || '-'}\n`;
    });
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `dashboard_${currentUser.name}_${period}_${currentYear}${currentMonth ? '_'+currentMonth : ''}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // DYNAMIC YEAR FUNCTION
  // =========================================================================
  function updateDynamicYears(data) {
    if (!data || data.length === 0) return;
    
    const years = new Set();
    data.forEach(item => {
      if (item.start_date) {
        const year = new Date(item.start_date).getFullYear();
        if (!isNaN(year)) years.add(year);
      }
      if (item.tarikh_syor) {
        const year = new Date(item.tarikh_syor).getFullYear();
        if (!isNaN(year)) years.add(year);
      }
      if (item.tarikh_lulus) {
        const year = new Date(item.tarikh_lulus).getFullYear();
        if (!isNaN(year)) years.add(year);
      }
      if (item.date_submit) {
        const year = new Date(item.date_submit).getFullYear();
        if (!isNaN(year)) years.add(year);
      }
    });
    
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    
    const yearSelectors = [
      { element: dashboardYear, addAll: false },
      { element: adminFilterYear, addAll: true },
      { element: listFilterYear, addAll: true },
      { element: document.getElementById('historyYearFilter'), addAll: true }
    ];
    
    yearSelectors.forEach(({ element, addAll }) => {
      if (element) {
        const currentVal = element.value;
        element.innerHTML = '';
        if (addAll) {
          const allOption = document.createElement('option');
          allOption.value = '';
          allOption.textContent = 'Semua Tahun';
          element.appendChild(allOption);
        }
        sortedYears.forEach(year => {
          const option = document.createElement('option');
          option.value = year;
          option.textContent = year;
          element.appendChild(option);
        });
        if (currentVal && element.querySelector(`option[value="${currentVal}"]`)) {
          element.value = currentVal;
        } else if (sortedYears.length > 0) {
          element.value = addAll ? '' : sortedYears[0];
        }
      }
    });
    
    console.log("V6.5.2 Dynamic years updated:", sortedYears);
  }

  // =========================================================================
  // PDF UPLOAD FUNCTIONALITY - MAIN FORM
  // =========================================================================

  if (pdfUploadArea) {
    pdfUploadArea.addEventListener('click', () => {
      pdfFileInput.click();
    });

    pdfUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      pdfUploadArea.classList.add('dragover');
    });

    pdfUploadArea.addEventListener('dragleave', () => {
      pdfUploadArea.classList.remove('dragover');
    });

    pdfUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      pdfUploadArea.classList.remove('dragover');
      
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type === 'application/pdf') {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          pdfFileInput.files = dataTransfer.files;
          
          pdfFileInput.dispatchEvent(new Event('change', { bubbles: true }));
          updateFileName(file.name);
        } else {
          alert("Sila muat naik fail PDF sahaja.");
        }
      }
    });
  }

  if (pdfFileInput) {
    pdfFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        updateFileName(e.target.files[0].name);
        
        // --- KOD BARU: Arahkan sistem terus proses AI ---
        processPdfWithAI();
        // ----------------------------------------------
        
      } else {
        updateFileName('Tiada fail dipilih');
      }
    });
  }

  if (btnProcessManual) {
    btnProcessManual.addEventListener('click', () => {
      processPdfManual();
    });
  }

  if (btnProcessAI) {
    btnProcessAI.addEventListener('click', () => {
      processPdfWithAI();
    });
  }

  if (btnApplyPdfData) {
    btnApplyPdfData.addEventListener('click', applyPdfDataToForm);
  }

  if (btnClearPdfData) {
    btnClearPdfData.addEventListener('click', clearPdfData);
  }

  function updateFileName(fileName) {
    if (pdfFileName) {
      pdfFileName.textContent = fileName;
      pdfFileName.style.fontWeight = 'bold';
      pdfFileName.style.color = '#3b82f6';
    }
    if (btnProcessManual) {
      btnProcessManual.disabled = fileName === 'Tiada fail dipilih';
    }
    if (btnProcessAI) {
      btnProcessAI.disabled = fileName === 'Tiada fail dipilih';
    }
  }

  async function processPdfManual() {
    if (!pdfFileInput.files.length) {
      await CustomAppModal.alert("Sila pilih fail PDF terlebih dahulu.", "Fail Diperlukan", "warning");
      return;
    }

    const file = pdfFileInput.files[0];
    
    if (file.size > 10 * 1024 * 1024) {
      await CustomAppModal.alert("Fail terlalu besar. Sila pilih fail kurang daripada 10MB.", "Ralat Saiz", "error");
      return;
    }

    if (pdfProcessing) {
      pdfProcessing.style.display = 'block';
      pdfProcessing.textContent = 'Memproses PDF... Sila tunggu.';
    }
    if (pdfResult) {
      pdfResult.style.display = 'none';
    }

    try {
      if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
      } else {
        console.error("V6.5.2 PDF.js library not loaded");
        alert("PDF processing library tidak dimuatkan. Sila muat semula halaman.");
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      console.log("V6.5.2 PDF Text extracted (first 5000 chars):", fullText.substring(0, 5000));
      
      extractedPdfData = extractDataFromPdfSimple(fullText);
      
      displayExtractedData(extractedPdfData);
      
      if (pdfResult) {
        pdfResult.style.display = 'block';
      }
      
      storageWrapper.set({ 'stb_extracted_pdf_data': extractedPdfData });
      
    } catch (error) {
      console.error("V6.5.2 Error processing PDF:", error);
      await playErrorSound();
      await CustomAppModal.alert("Ralat memproses PDF: " + error.message, "Ralat Sistem", "error");
    }
}

  async function processPdfWithAI() {
    if (!pdfFileInput.files.length) {
      alert("Sila pilih fail PDF terlebih dahulu.");
      return;
    }

    const file = pdfFileInput.files[0];
    if (file.size > 10 * 1024 * 1024) {
      alert("Fail terlalu besar (Maks 10MB).");
      return;
    }

    let aiInterval = null;

    // --- KOD ANIMASI BARU (Morphing & Outliner) ---
    const updateProgress = (percent, message) => {
      const statusBox = document.getElementById('status-box-main');
      const progressRing = document.getElementById('progress-ring-main');
      const percentageText = document.getElementById('percentage-main');
      const progressMsg = document.getElementById('pdfProgressMsg');

      // 1. Morph bentuk: Bulat -> Petak bila proses mula
      if (statusBox.classList.contains('morph-circle')) {
        statusBox.classList.replace('morph-circle', 'morph-square');
      }

      // 2. Kemaskini teks peratusan & mesej
      percentageText.innerHTML = `${percent}%`;
      progressMsg.style.display = 'block';
      progressMsg.innerText = message;

      // 3. Gerakkan outliner SVG (Panjang garisan ialah 440)
      const circumference = 440;
      const offset = circumference - (percent / 100) * circumference;
      progressRing.style.strokeDashoffset = offset;

      if (pdfResult) pdfResult.style.display = 'none';
    };

    try {
      updateProgress(5, "Membaca fail...");
      
      if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
      } else {
        throw new Error("PDF.js library not loaded");
      }

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const totalPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
        
        const progress = 10 + Math.round((pageNum / totalPages) * 30); // 10% ke 40%
        updateProgress(progress, `Mengekstrak halaman ${pageNum}/${totalPages}`);
      }

      console.log("V6.5.2 PDF Extracted. Length:", fullText.length);
      
      updateProgress(45, "Menganalisis dengan AI...");
      
      let aiProgress = 45;
      aiInterval = setInterval(() => {
        if (aiProgress < 95) {
          aiProgress += 1;
          updateProgress(aiProgress, "Menganalisis dengan AI...");
        }
      }, 300); // Bergerak lebih pantas

      extractedPdfData = await processPdfTextWithAI(fullText);
      
      if (aiInterval) clearInterval(aiInterval);
      
      updateProgress(100, "Selesai!");
      
      // MEMAINKAN BUNYI SUCCESS KETIKA MENCAPAI 100%
      await playSuccessSound(); 
      
      // Tunggu 1 saat untuk bagi pengguna lihat "100% Selesai" sebelum memaparkan kotak hijau
      setTimeout(() => {
        // Kembalikan kotak ke keadaan asal
        document.getElementById('status-box-main').classList.replace('morph-square', 'morph-circle');
        document.getElementById('progress-ring-main').style.strokeDashoffset = 440;
        document.getElementById('percentage-main').innerHTML = `📄<br><span>Pilih PDF</span>`;
        document.getElementById('pdfProgressMsg').style.display = 'none';

        displayExtractedData(extractedPdfData);
        if (pdfResult) {
          pdfResult.style.display = 'block';
        }
      }, 1000);
      
      storageWrapper.set({ 'stb_extracted_pdf_data': extractedPdfData });
      
    } catch (error) {
      console.error("V6.5.2 AI Error:", error);
      if (aiInterval) clearInterval(aiInterval);
      await playErrorSound();

      document.getElementById('pdfProgressMsg').innerHTML = `<span style="color:#ef4444; font-weight:bold;">Ralat: ${error.message}</span>`;
      alert("Gagal memproses: " + error.message);
    }
  }

  async function processPdfTextWithAI(pdfText) {
    const maxTextLength = 30000;
    const truncatedText = pdfText.length > maxTextLength
      ? pdfText.substring(0, maxTextLength) + "... [text truncated]"
      : pdfText;

    console.log("V6.5.2 (Web) Menghantar teks borang ke backend untuk AI processing...");
    
    const payload = {
      action: 'processAI',
      type: 'borang',
      text: truncatedText,
      email: currentUser ? currentUser.email : '' // <-- TAMBAH INI
    };

    const response = await fetchWithRetry(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }, 3, 1000);

    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.message || result.error || 'Gagal mengekstrak data dari pelayan AI.');
    }
    
    return result.data;
  }

  function extractDataFromPdfSimple(pdfText) {
    const extractedData = {
      companyName: '',
      cidbNumber: '',
      grade: '',
      spkkStartDate: '',
      spkkEndDate: '',
      stbStartDate: '',
      stbEndDate: '',
      directors: [],
      shareholders: [],
      spkkPersons: [],
      chequeSignatories: [],
      phoneNumbers: [],
      alamatPerniagaan: ''
    };

    console.log("V6.5.2 Mula mengekstrak data...");

    const rawText = pdfText.toUpperCase().replace(/\s+/g, ' ');
    const cleanHeaderText = rawText.replace(/TEL\s*:\s*[\d-]+\s*/g, '');

    const companyMatch = cleanHeaderText.match(/([A-Z0-9\s\.\&\-]+?)\s*\(\d{6,}[-\s]?[A-Z0-9]+\)/);
    if (companyMatch && companyMatch[1]) {
      let name = companyMatch[1].trim();
      name = name.replace(/.*(?:ADDR|ALAMAT|LUMPUR|SELANGOR|JOHOR|KUALA)[:\s]*/, '').trim();
      extractedData.companyName = name;
    }

    const cidbMatch = rawText.match(/(\d{6,}-[A-Z]{2,}\d{5,})/);
    if (cidbMatch) extractedData.cidbNumber = cidbMatch[1];
    
    const gradeMatches = rawText.match(/\b(G[1-7])\b/gi);
    if (gradeMatches && gradeMatches.length > 0) {
      extractedData.grade = gradeMatches[0].toUpperCase();
    }

    const spkkMatch = rawText.match(/KERJA KERAJAAN \(SPKK\)\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}\/\d{2}\/\d{4})/);
    if (spkkMatch) { 
      extractedData.spkkStartDate = spkkMatch[1]; 
      extractedData.spkkEndDate = spkkMatch[2]; 
    }

    const stbMatch = rawText.match(/TARAF BUMIPUTERA \(STB\)\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}\/\d{2}\/\d{4})/);
    if (stbMatch) { 
      extractedData.stbStartDate = stbMatch[1]; 
      extractedData.stbEndDate = stbMatch[2]; 
    }
    
    const phoneRegex = /(?:TEL|H\/P|PHONE)[\s:]*([\d\s\-\(\)\+]+)/gi;
    let phoneMatch;
    const phones = new Set();
    while ((phoneMatch = phoneRegex.exec(rawText)) !== null) {
      let phoneNum = phoneMatch[1].trim();
      phoneNum = phoneNum.replace(/\s+/g, '');
      if (phoneNum.length >= 6) {
        phones.add(phoneNum);
      }
    }
    extractedData.phoneNumbers = Array.from(phones);

    function sanitizeName(rawName) {
      let name = rawName.trim();
      
      const cutOffWords = [
        " PENGARAH", " PENGURUS", " MANAGER", " SECRETARY", " SETIAUSAHA",
        " PEMEGANG", " SAHAM", " SHARES", " EKUITI", " EQUITY",
        " LEMBAGA", " JAWATAN", " POSITION", " APPOINTMENT", " LANTIKAN", 
        " WARGANEGARA", " MALAYSIA", " MELAYU", " LELAKI", " PEREMPUAN",
        " NO.", " BIL", " IC", " KP", " PASSPORT", " MANAGING", " EXECUTIVE"
      ];

      for (let word of cutOffWords) {
        const idx = name.indexOf(word);
        if (idx !== -1) {
          name = name.substring(0, idx).trim();
        }
      }
      
      name = name.replace(/[^A-Z0-9\)\.\@\&\-\/\s]*$/, ''); 
      name = name.replace(/^[\d\.\)\-\s]+/, '');   
      
      return name.trim();
    }

    function extractNamesFromStream(streamText) {
      if (!streamText) return [];

      let cleanStream = streamText.replace(/NO\.?\s+NAME\s+IC\s+NO.*?DATE/g, ''); 
      cleanStream = cleanStream.replace(/NO\.?\s+NAMA\s+NO\.\s+KAD.*?TARIKH/g, '');

      const headerBlocklist = [
        "DIRECTOR", "PENGARAH", "SHAREHOLDER", "PEMEGANG SAHAM",
        "SPKK RESPONSIBLE", "PENAMA SPKK", "CHEQUE SIGNATORIES", "PENANDATANGAN CEK",
        "KEY MANAGEMENT", "PERSONEL PENGURUSAN", "TECHNICAL PERSONNEL", "PERSONEL TEKNIKAL",
        "COMPETENT PERSON", "ORANG KOMPETEN", "JOINT VENTURE", "KONSORTIUM", 
        "INTERNATIONAL REGISTERED", "REGISTRATION NO", "APPLICATION NO",
        "EQUITY", "BUMIPUTERA", "ASING", "BUKAN BUMIPUTERA", "AGENSI BERKAITAN"
      ];

      const regex = /(?:\b|^)(\d{1,2})(?:[\.\)\s]*)\s+([A-Z\s\.\'\@\&\-\(\)\/]+?)(?=\s+(?:\d{6,}|\d{5,}[A-Z]|[A-Z]\d{5,}|MALAYSIA|MELAYU|CINA|INDIA|LELAKI|PEREMPUAN|DIRECTOR|PENGARAH|MANAGING|WARGANEGARA))/g;

      let match;
      const names = [];
      
      while ((match = regex.exec(cleanStream)) !== null) {
        let potentialName = match[2].trim();
        
        let isHeader = false;
        for (let block of headerBlocklist) {
          if (potentialName.includes(block)) { 
            isHeader = true; 
            break; 
          }
        }
        if (isHeader) continue;

        if (potentialName.length > 80 || potentialName.length < 3) continue;

        let clean = sanitizeName(potentialName);

        if (clean.length > 3 && /[A-Z]/.test(clean) && !names.includes(clean)) {
          if (!/^[\W\d]+$/.test(clean)) {
            names.push(clean);
          }
        }
      }
      return names;
    }

    const getIndex = (pattern) => {
      const m = rawText.match(pattern);
      return m ? m.index : -1;
    };

    const idxDir = getIndex(/4\.\s*(?:DIRECTORS|PENGARAH)/);
    const idxShare = getIndex(/5\.\s*(?:SHAREHOLDERS|PEMEGANG)/);

    let idxNext = getIndex(/6\.\s*(?:KEY|PERSONEL)/);
    if (idxNext === -1) idxNext = getIndex(/7\.\s*(?:TECHNICAL|TEKNIKAL)/);

    const idxSpkk = getIndex(/(\d+\.\s+SPKK\s+(?:RESPONSIBLE|PENAMA))/);
    const idxCheque = getIndex(/(\d+\.\s+CHEQUE\s+(?:SIGNATORIES|PENANDATANGAN))/);

    let idxStopCheque = getIndex(/(?:MANDATORY|JOINT VENTURE|INTERNATIONAL|DISCLAIMER|20\.|21\.)/);
    if (idxStopCheque === -1 || idxStopCheque < idxCheque) idxStopCheque = rawText.length;

    const strDirectors = (idxDir !== -1 && idxShare !== -1) ? rawText.substring(idxDir + 15, idxShare) : "";
    const strShareholders = (idxShare !== -1 && idxNext !== -1) ? rawText.substring(idxShare + 15, idxNext) : "";

    let strSpkk = "";
    if (idxSpkk !== -1) {
      const endSpkk = (idxCheque !== -1) ? idxCheque : rawText.length;
      strSpkk = rawText.substring(idxSpkk + 25, endSpkk); 
    }

    let strCheque = "";
    if (idxCheque !== -1) {
      strCheque = rawText.substring(idxCheque + 25, idxStopCheque);
    }

    extractedData.directors = extractNamesFromStream(strDirectors);
    extractedData.shareholders = extractNamesFromStream(strShareholders);
    extractedData.spkkPersons = extractNamesFromStream(strSpkk);
    extractedData.chequeSignatories = extractNamesFromStream(strCheque);

    console.log("V6.5.2 Final Clean Data:", extractedData);
    return extractedData;
  }

  function displayExtractedData(data) {
    if (!pdfExtractedData) return;

    let html = '';

    if (data.companyName) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Nama Syarikat:</span>
        <span class="extracted-value">${data.companyName}</span>
      </div>`;
    }

    if (data.cidbNumber) {
      html += `<div class="extracted-item">
        <span class="extracted-label">No. CIDB:</span>
        <span class="extracted-value">${data.cidbNumber}</span>
      </div>`;
    }
    
    if (data.grade) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Gred:</span>
        <span class="extracted-value">${data.grade}</span>
      </div>`;
    }

    if (data.spkkStartDate && data.spkkEndDate) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Tempoh SPKK:</span>
        <span class="extracted-value">${data.spkkStartDate} - ${data.spkkEndDate}</span>
      </div>`;
    }

    if (data.stbStartDate && data.stbEndDate) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Tempoh STB:</span>
        <span class="extracted-value">${data.stbStartDate} - ${data.stbEndDate}</span>
      </div>`;
    }

    if (data.phoneNumbers && data.phoneNumbers.length > 0) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Nombor Telefon (${data.phoneNumbers.length}):</span>
        <span class="extracted-value">${data.phoneNumbers.join(', ')}</span>
      </div>`;
    } else {
      html += `<div class="extracted-item">
        <span class="extracted-label" style="color: #dc2626;">Nombor Telefon:</span>
        <span class="extracted-value" style="color: #dc2626;">Tiada nombor telefon dapat diekstrak</span>
      </div>`;
    }

    if (data.alamatPerniagaan) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Alamat Perniagaan:</span>
        <span class="extracted-value">${data.alamatPerniagaan}</span>
      </div>`;
    }

    if (data.directors.length > 0) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Pengarah (${data.directors.length}):</span>
        <span class="extracted-value">${data.directors.join(', ')}</span>
      </div>`;
    } else {
      html += `<div class="extracted-item">
        <span class="extracted-label" style="color: #dc2626;">Pengarah:</span>
        <span class="extracted-value" style="color: #dc2626;">Tiada nama dapat diekstrak</span>
      </div>`;
    }

    if (data.shareholders.length > 0) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Pemegang Saham (${data.shareholders.length}):</span>
        <span class="extracted-value">${data.shareholders.join(', ')}</span>
      </div>`;
    }

    if (data.spkkPersons.length > 0) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Penama SPKK (${data.spkkPersons.length}):</span>
        <span class="extracted-value">${data.spkkPersons.join(', ')}</span>
      </div>`;
    }

    if (data.chequeSignatories.length > 0) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Penandatangan Cek (${data.chequeSignatories.length}):</span>
        <span class="extracted-value">${data.chequeSignatories.join(', ')}</span>
      </div>`;
    }

    pdfExtractedData.innerHTML = html;
  }

  async function applyPdfDataToForm() {
    if (!extractedPdfData) {
      await CustomAppModal.alert("Tiada data PDF untuk digunakan.", "Tiada Data", "warning");
      return;
    }

    const setValueAndTrigger = (elementId, value) => {
      const el = document.getElementById(elementId);
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`V6.5.2 Set value for ${elementId}:`, value);
      }
    };

    const setSelectValue = (elementId, valueToFind) => {
      const el = document.getElementById(elementId);
      if (el) {
        for (let i = 0; i < el.options.length; i++) {
          if (el.options[i].value.toUpperCase() === valueToFind.toUpperCase()) {
            el.selectedIndex = i;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`V6.5.2 Set select for ${elementId}:`, valueToFind);
            break;
          }
        }
      }
    };

    if (extractedPdfData.companyName) {
      setValueAndTrigger('borang_syarikat', extractedPdfData.companyName);
      setValueAndTrigger('db_syarikat', extractedPdfData.companyName);
    }
    if (extractedPdfData.cidbNumber) {
      setValueAndTrigger('borang_cidb', extractedPdfData.cidbNumber);
      setValueAndTrigger('db_cidb', extractedPdfData.cidbNumber);
    }
    
    if (extractedPdfData.grade) {
      setSelectValue('borang_gred', extractedPdfData.grade);
      setSelectValue('db_gred', extractedPdfData.grade);
    }
    
    if (extractedPdfData.spkkStartDate) {
      setValueAndTrigger('spkkDuration', `${extractedPdfData.spkkStartDate} - ${extractedPdfData.spkkEndDate}`);
    }
    if (extractedPdfData.stbStartDate) {
      setValueAndTrigger('stbDuration', `${extractedPdfData.stbStartDate} - ${extractedPdfData.stbEndDate}`);
    }
    
    if (extractedPdfData.phoneNumbers && extractedPdfData.phoneNumbers.length > 0) {
      setValueAndTrigger('borang_no_telefon', extractedPdfData.phoneNumbers.join(', '));
    }

    if (extractedPdfData.alamatPerniagaan) {
      setValueAndTrigger('db_alamat_perniagaan', extractedPdfData.alamatPerniagaan);
      
      const negeriSelect = document.getElementById('db_negeri');
      if (negeriSelect && extractedPdfData.alamatPerniagaan) {
        const alamatUpper = extractedPdfData.alamatPerniagaan.toUpperCase();
        const stateMap = {
          'JOHOR': 'JOHOR', 'KEDAH': 'KEDAH', 'KELANTAN': 'KELANTAN', 'MELAKA': 'MELAKA',
          'NEGERI SEMBILAN': 'NEGERI SEMBILAN', 'PAHANG': 'PAHANG', 'PERAK': 'PERAK',
          'PERLIS': 'PERLIS', 'PULAU PINANG': 'PULAU PINANG', 'PENANG': 'PULAU PINANG',
          'SABAH': 'SABAH', 'SARAWAK': 'SARAWAK', 'SELANGOR': 'SELANGOR', 'TERENGGANU': 'TERENGGANU',
          'KUALA LUMPUR': 'W.P. KUALA LUMPUR', 'LABUAN': 'W.P. LABUAN', 'PUTRAJAYA': 'W.P. PUTRAJAYA'
        };
        
        let foundState = '';
        for (const [key, value] of Object.entries(stateMap)) {
          if (alamatUpper.includes(key)) {
            foundState = value;
            break;
          }
        }
        
        if (foundState) {
          setSelectValue('db_negeri', foundState);
        }
      }
    }

    const personnelList = document.getElementById('personnelList');
    if (personnelList) personnelList.innerHTML = '';

    const allNames = new Set();
    [extractedPdfData.directors, extractedPdfData.shareholders, 
     extractedPdfData.spkkPersons, extractedPdfData.chequeSignatories]
     .forEach(list => { 
       if(Array.isArray(list)) list.forEach(n => allNames.add(n)); 
     });

    allNames.forEach(name => {
      if (name && name.length > 2) {
        const roles = [];
        if (extractedPdfData.directors.includes(name)) roles.push('PENGARAH');
        if (extractedPdfData.shareholders.includes(name)) roles.push('P.EKUITI');
        if (extractedPdfData.spkkPersons.includes(name)) roles.push('P.SPKK');
        if (extractedPdfData.chequeSignatories.includes(name)) roles.push('T.T CEK');

        addPerson({ 
          name: name, 
          isCompany: false, 
          roles: roles, 
          s_ic: '', 
          s_sb: '', 
          s_epf: '' 
        });
      }
    });

    if (allNames.size === 0) addPerson();

    saveFormData();
    saveDatabaseFormData(); 
    
    setTimeout(async () => { // <--- Tambah 'async' di sini
      const dbState = {};
      document.querySelectorAll('#tab-database input, #tab-database select, #tab-database textarea').forEach(el => {
        if (el.id) {
          dbState[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
        }
      });
      
      formStates['db'] = dbState;
      storageWrapper.set({ 'stb_form_states': formStates });
      
      console.log("V6.5.2 PDF Data applied and force-saved to storage successfully.");
      
      // PENGGUNAAN MODAL BARU
      await CustomAppModal.alert("PDF Data berjaya diekstrak dan disimpan! Semua input termasuk Alamat Perniagaan & Negeri telah diisi.", "Berjaya", "success");
      
    }, 200);
  } //

  function clearPdfData() {
    if (pdfFileInput) {
      pdfFileInput.value = ''; // Kosongkan fail tanpa buang fungsi AI
    }

    if (pdfFileName) {
      pdfFileName.textContent = 'Tiada fail dipilih';
      pdfFileName.style.fontWeight = 'normal';
      pdfFileName.style.color = '';
    }
    if (pdfResult) {
      pdfResult.style.display = 'none';
    }
    if (pdfExtractedData) {
      pdfExtractedData.innerHTML = '';
    }
    if (btnProcessManual) {
      btnProcessManual.disabled = true;
    }
    if (btnProcessAI) {
      btnProcessAI.disabled = true;
    }
    extractedPdfData = null;

    storageWrapper.remove(['stb_extracted_pdf_data']);
  }

  // =========================================================================
  // PROFILE PDF AI PROCESSING
  // =========================================================================

  if (profilePdfUploadArea) {
    profilePdfUploadArea.addEventListener('click', () => {
      profilePdfInput.click();
    });

    profilePdfUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      profilePdfUploadArea.classList.add('dragover');
    });

    profilePdfUploadArea.addEventListener('dragleave', () => {
      profilePdfUploadArea.classList.remove('dragover');
    });

    profilePdfUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      profilePdfUploadArea.classList.remove('dragover');
      
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type === 'application/pdf') {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          profilePdfInput.files = dataTransfer.files;
          
          profilePdfInput.dispatchEvent(new Event('change', { bubbles: true }));
          updateProfileFileName(file.name);
        } else {
          alert("Sila muat naik fail PDF sahaja.");
        }
      }
    });
  }

  if (profilePdfInput) {
    profilePdfInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        updateProfileFileName(e.target.files[0].name);
        
        // --- KOD BARU: Arahkan sistem terus proses AI Profile ---
        processProfileWithAI();
        // ------------------------------------------------------
        
      } else {
        updateProfileFileName('Tiada fail dipilih');
      }
    });
  }

  function updateProfileFileName(fileName) {
    if (profilePdfFileName) {
      profilePdfFileName.textContent = fileName;
      profilePdfFileName.style.fontWeight = 'bold';
      profilePdfFileName.style.color = '#3b82f6';
    }
    if (btnProsesProfileAI) {
      btnProsesProfileAI.disabled = fileName === 'Tiada fail dipilih';
    }
  }

  if (btnProsesProfileAI) {
    btnProsesProfileAI.addEventListener('click', () => {
      processProfileWithAI();
    });
  }

  if (btnApplyProfileData) {
    btnApplyProfileData.addEventListener('click', applyProfileDataToForm);
  }

  if (btnClearProfileData) {
    btnClearProfileData.addEventListener('click', clearProfileData);
  }

  if (btnResetProfile) {
    btnResetProfile.addEventListener('click', async () => {
      const isConfirmed = await CustomAppModal.confirm(
          "Adakah anda pasti mahu mereset semua maklumat dalam borang Profile Syarikat?",
          "Reset Profile",
          "warning",
          "Ya, Reset",
          true
      );
      if (isConfirmed) {
        resetProfileForm();
        await CustomAppModal.alert("Borang Profile Syarikat telah direset.", "Selesai", "success");
      }
    });
}

  function resetProfileForm() {
    if (profileSyarikat) profileSyarikat.value = '';
    if (profileCidb) profileCidb.value = '';
    if (profileGred) profileGred.value = '';
    if (profileNamaPemohon) profileNamaPemohon.value = '';
    if (profileJawatanPemohon) profileJawatanPemohon.value = '';
    if (profileIcPemohon) profileIcPemohon.value = '';
    if (profileTelefonPemohon) profileTelefonPemohon.value = '';
    if (profileEmailPemohon) profileEmailPemohon.value = '';
    if (profileJenisPendaftaran) profileJenisPendaftaran.value = '';
    if (profileTarikhDaftar) profileTarikhDaftar.value = '';
    if (profileAlamatBerdaftar) profileAlamatBerdaftar.value = '';
    if (profileAlamatSurat) profileAlamatSurat.value = '';
    if (profileNoTelefonSyarikat) profileNoTelefonSyarikat.value = '';
    if (profileNoFax) profileNoFax.value = '';
    if (profileEmailSyarikat) profileEmailSyarikat.value = '';
    if (profileWeb) profileWeb.value = '';
    if (profilePautanDrive) profilePautanDrive.value = '';
    if (profileJenisPerubahan) profileJenisPerubahan.value = '';
    
    if (cbSsmBerdaftar) cbSsmBerdaftar.checked = false;
    if (cbSsmSurat) cbSsmSurat.checked = false;
    
    if (labelAlamatBerdaftar) labelAlamatBerdaftar.textContent = 'Alamat Berdaftar';
    
    if (previewQrCode) {
      previewQrCode.style.display = 'none';
      previewQrCode.src = '';
    }
    
    if (profilePdfInput) {
      profilePdfInput.value = ''; // Kosongkan fail tanpa buang fungsi AI
    }
    
    if (profilePdfFileName) {
      profilePdfFileName.textContent = 'Tiada fail dipilih';
      profilePdfFileName.style.fontWeight = 'normal';
      profilePdfFileName.style.color = '';
    }
    if (profilePdfResult) {
      profilePdfResult.style.display = 'none';
    }
    if (profilePdfExtractedData) {
      profilePdfExtractedData.innerHTML = '';
    }
    if (btnProsesProfileAI) {
      btnProsesProfileAI.disabled = true;
    }
    
    extractedProfileData = null;
    
    storageWrapper.remove(['stb_extracted_profile_data']);
    
    alert("Borang Profile Syarikat telah direset.");
    console.log("V6.5.2 Profile form reset completed");
  }

  if (btnPreviewQR) {
    btnPreviewQR.addEventListener('click', async () => {
      const driveUrl = profilePautanDrive ? profilePautanDrive.value.trim() : '';
      
      if (!driveUrl) {
        await CustomAppModal.alert("Sila masukkan Pautan Drive terlebih dahulu.", "Pautan Diperlukan", "warning");
        return;
      }
      
      const encodedUrl = encodeURIComponent(driveUrl);
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodedUrl}`;
      
      if (previewQrCode) {
        previewQrCode.src = qrApiUrl;
        previewQrCode.style.display = 'block';
        console.log("V6.5.2 QR Code generated for URL:", driveUrl);
      }
    });
  }

  async function processProfileWithAI() {
    if (!profilePdfInput.files.length) {
      alert("Sila pilih fail PDF terlebih dahulu.");
      return;
    }

    const file = profilePdfInput.files[0];
    if (file.size > 10 * 1024 * 1024) {
      alert("Fail terlalu besar (Maks 10MB).");
      return;
    }

    let aiInterval = null;

    // --- KOD ANIMASI BARU (Morphing & Outliner) UNTUK PROFILE ---
    const updateProgress = (percent, message) => {
      const statusBox = document.getElementById('status-box-profile');
      const progressRing = document.getElementById('progress-ring-profile');
      const percentageText = document.getElementById('percentage-profile');
      const progressMsg = document.getElementById('profilePdfProgressMsg');

      // 1. Morph bentuk: Bulat -> Petak bila proses mula
      if (statusBox.classList.contains('morph-circle')) {
        statusBox.classList.replace('morph-circle', 'morph-square');
      }

      // 2. Kemaskini teks peratusan & mesej
      percentageText.innerHTML = `${percent}%`;
      progressMsg.style.display = 'block';
      progressMsg.innerText = message;

      // 3. Gerakkan outliner SVG (Panjang garisan ialah 440)
      const circumference = 440;
      const offset = circumference - (percent / 100) * circumference;
      progressRing.style.strokeDashoffset = offset;

      if (profilePdfResult) profilePdfResult.style.display = 'none';
    };

    try {
      updateProgress(5, "Membaca fail...");

      if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
      } else {
        throw new Error("PDF.js library not loaded");
      }

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const totalPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
        
        const progress = 10 + Math.round((pageNum / totalPages) * 30);
        updateProgress(progress, `Mengekstrak halaman ${pageNum}/${totalPages}`);
      }

      console.log("V6.5.2 Profile PDF extracted. Length:", fullText.length);
      
      updateProgress(45, "Menganalisis dengan AI...");
      
      let aiProgress = 45;
      aiInterval = setInterval(() => {
        if (aiProgress < 95) {
          aiProgress += 1;
          updateProgress(aiProgress, "Menganalisis dengan AI...");
        }
      }, 300);

      extractedProfileData = await processProfileTextWithAI(fullText);
      
      if (aiInterval) clearInterval(aiInterval);
      
      updateProgress(100, "Selesai!");
      
      // MEMAINKAN BUNYI SUCCESS KETIKA MENCAPAI 100%
      await playSuccessSound();
      
      // Tunggu 1 saat untuk paparkan "100% Selesai" sebelum memaparkan borang Profile
      setTimeout(() => {
        // Kembalikan kotak ke keadaan asal (bulat semula)
        document.getElementById('status-box-profile').classList.replace('morph-square', 'morph-circle');
        document.getElementById('progress-ring-profile').style.strokeDashoffset = 440;
        document.getElementById('percentage-profile').innerHTML = `🏢<br><span>Pilih Profil</span>`;
        document.getElementById('profilePdfProgressMsg').style.display = 'none';

        displayProfileExtractedData(extractedProfileData);
        if (profilePdfResult) {
          profilePdfResult.style.display = 'block';
        }
      }, 1000);
      
      storageWrapper.set({ 'stb_extracted_profile_data': extractedProfileData });
      
    } catch (error) {
      console.error("V6.5.2 Profile AI Error:", error);
      if (aiInterval) clearInterval(aiInterval);
      
      // MEMAINKAN BUNYI ERROR JIKA GAGAL
      await playErrorSound();
      
      document.getElementById('profilePdfProgressMsg').innerHTML = `<span style="color:#ef4444; font-weight:bold;">Ralat: ${error.message}</span>`;
      alert("Gagal memproses profile PDF: " + error.message);
    }
  }

  async function processProfileTextWithAI(pdfText) {
    const maxTextLength = 30000;
    const truncatedText = pdfText.length > maxTextLength
      ? pdfText.substring(0, maxTextLength) + "... [text truncated]"
      : pdfText;

    console.log("V6.5.2 (Web) Menghantar teks profil ke backend untuk AI processing...");
    
    const payload = {
      action: 'processAI',
      type: 'profile',
      text: truncatedText,
      email: currentUser ? currentUser.email : '' // <-- TAMBAH INI
    };

    const response = await fetchWithRetry(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }, 3, 1000);

    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.message || result.error || 'Gagal mengekstrak data dari pelayan AI.');
    }
    
    return result.data;
  }

  function displayProfileExtractedData(data) {
    if (!profilePdfExtractedData) return;

    let html = '';

    if (data.applicantName) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Nama Pemohon:</span>
        <span class="extracted-value">${data.applicantName}</span>
      </div>`;
    }

    if (data.jawatan) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Jawatan:</span>
        <span class="extracted-value">${data.jawatan}</span>
      </div>`;
    }

    if (data.icNumber) {
      html += `<div class="extracted-item">
        <span class="extracted-label">No. IC Pemohon:</span>
        <span class="extracted-value">${data.icNumber}</span>
      </div>`;
    }

    if (data.phoneNumber) {
      html += `<div class="extracted-item">
        <span class="extracted-label">No. Telefon Pemohon:</span>
        <span class="extracted-value">${data.phoneNumber}</span>
      </div>`;
    }

    if (data.email) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Emel Pemohon:</span>
        <span class="extracted-value">${data.email}</span>
      </div>`;
    }

    if (data.companyName) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Nama Syarikat:</span>
        <span class="extracted-value">${data.companyName}</span>
      </div>`;
    }

    if (data.registrationNumber) {
      html += `<div class="extracted-item">
        <span class="extracted-label">No. Pendaftaran/CIDB:</span>
        <span class="extracted-value">${data.registrationNumber}</span>
      </div>`;
    }

    if (data.grade) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Gred:</span>
        <span class="extracted-value">${data.grade}</span>
      </div>`;
    }

    if (data.registrationDate) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Tarikh Daftar:</span>
        <span class="extracted-value">${data.registrationDate}</span>
      </div>`;
    }

    if (data.jenisPendaftaran) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Jenis Pendaftaran:</span>
        <span class="extracted-value">${data.jenisPendaftaran}</span>
      </div>`;
    }

    if (data.alamatUtama) {
      const labelText = data.labelAlamatUtama || 'Alamat';
      html += `<div class="extracted-item">
        <span class="extracted-label">${labelText}:</span>
        <span class="extracted-value">${data.alamatUtama}</span>
      </div>`;
    }

    if (data.alamatSuratMenyurat) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Alamat Surat-menyurat:</span>
        <span class="extracted-value">${data.alamatSuratMenyurat}</span>
      </div>`;
    }

    if (data.noTelefonSyarikat) {
      html += `<div class="extracted-item">
        <span class="extracted-label">No. Telefon Syarikat:</span>
        <span class="extracted-value">${data.noTelefonSyarikat}</span>
      </div>`;
    }

    if (data.noFax) {
      html += `<div class="extracted-item">
        <span class="extracted-label">No. Fax:</span>
        <span class="extracted-value">${data.noFax}</span>
      </div>`;
    }

    if (data.emailSyarikat) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Emel Syarikat:</span>
        <span class="extracted-value">${data.emailSyarikat}</span>
      </div>`;
    }

    if (data.webAddress) {
      html += `<div class="extracted-item">
        <span class="extracted-label">Web Address:</span>
        <span class="extracted-value">${data.webAddress}</span>
      </div>`;
    }

    if (html === '') {
      html = '<div class="extracted-item"><span class="extracted-label">Tiada data diekstrak</span></div>';
    }

    profilePdfExtractedData.innerHTML = html;
  }

  function applyProfileDataToForm() {
    if (!extractedProfileData) {
      alert("Tiada data profile untuk digunakan.");
      return;
    }

    if (extractedProfileData.applicantName && profileNamaPemohon) {
      profileNamaPemohon.value = extractedProfileData.applicantName;
    }

    if (extractedProfileData.jawatan && profileJawatanPemohon) {
      profileJawatanPemohon.value = extractedProfileData.jawatan;
    }

    if (extractedProfileData.icNumber && profileIcPemohon) {
      profileIcPemohon.value = extractedProfileData.icNumber;
    }

    if (extractedProfileData.phoneNumber && profileTelefonPemohon) {
      profileTelefonPemohon.value = extractedProfileData.phoneNumber;
    }

    if (extractedProfileData.email && profileEmailPemohon) {
      profileEmailPemohon.value = extractedProfileData.email;
    }

    if (extractedProfileData.companyName && profileSyarikat) {
      profileSyarikat.value = extractedProfileData.companyName;
    }

    if (extractedProfileData.registrationNumber && profileCidb) {
      profileCidb.value = extractedProfileData.registrationNumber;
    }

    if (extractedProfileData.grade && profileGred) {
      for (let i = 0; i < profileGred.options.length; i++) {
        if (profileGred.options[i].value.toUpperCase() === extractedProfileData.grade.toUpperCase()) {
          profileGred.selectedIndex = i;
          break;
        }
      }
    }

    if (extractedProfileData.registrationDate && profileTarikhDaftar) {
      let dateVal = extractedProfileData.registrationDate;
      if (dateVal.match(/\d{2}\/\d{2}\/\d{4}/)) {
        const parts = dateVal.split('/');
        dateVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      profileTarikhDaftar.value = dateVal;
    }

    if (extractedProfileData.jenisPendaftaran && profileJenisPendaftaran) {
      profileJenisPendaftaran.value = extractedProfileData.jenisPendaftaran;
    }

    if (extractedProfileData.labelAlamatUtama && labelAlamatBerdaftar) {
      const labelLower = extractedProfileData.labelAlamatUtama.toLowerCase();
      if (labelLower.includes('perniagaan') || labelLower.includes('business')) {
        labelAlamatBerdaftar.textContent = 'Alamat Perniagaan';
      } else if (labelLower.includes('surat-menyurat') || labelLower.includes('correspondence')) {
        labelAlamatBerdaftar.textContent = 'Alamat Surat-menyurat';
      } else {
        labelAlamatBerdaftar.textContent = 'Alamat Berdaftar';
      }
    }

    if (extractedProfileData.alamatUtama && profileAlamatBerdaftar) {
      profileAlamatBerdaftar.value = extractedProfileData.alamatUtama;
    }

    if (extractedProfileData.alamatSuratMenyurat && profileAlamatSurat) {
      profileAlamatSurat.value = extractedProfileData.alamatSuratMenyurat;
    }

    if (extractedProfileData.noTelefonSyarikat && profileNoTelefonSyarikat) {
      profileNoTelefonSyarikat.value = extractedProfileData.noTelefonSyarikat;
    }

    if (extractedProfileData.noFax && profileNoFax) {
      profileNoFax.value = extractedProfileData.noFax;
    }

    if (extractedProfileData.emailSyarikat && profileEmailSyarikat) {
      profileEmailSyarikat.value = extractedProfileData.emailSyarikat;
    }

    if (extractedProfileData.webAddress && profileWeb) {
      profileWeb.value = extractedProfileData.webAddress;
    }

    alert("Data profile berjaya diisi ke borang!");
  }

  function clearProfileData() {
    if (profilePdfInput) {
      profilePdfInput.value = ''; // Kosongkan fail tanpa buang fungsi AI
    }

    if (profilePdfFileName) {
      profilePdfFileName.textContent = 'Tiada fail dipilih';
      profilePdfFileName.style.fontWeight = 'normal';
      profilePdfFileName.style.color = '';
    }
    if (profilePdfResult) {
      profilePdfResult.style.display = 'none';
    }
    if (profilePdfExtractedData) {
      profilePdfExtractedData.innerHTML = '';
    }
    if (btnProsesProfileAI) {
      btnProsesProfileAI.disabled = true;
    }
    extractedProfileData = null;

    storageWrapper.remove(['stb_extracted_profile_data']);
  }

  if (btnCetakProfile) {
    btnCetakProfile.addEventListener('click', async () => {
      if (!profileSyarikat.value.trim()) {
        alert("Sila isi Nama Syarikat terlebih dahulu sebelum mencetak.");
        return;
      }

      const printProfileSyarikat = document.getElementById('printProfile_syarikat_header');
      const printProfileCidb = document.getElementById('printProfile_cidb_header');
      const printProfileNamaPemohon = document.getElementById('printProfile_nama_pemohon');
      const printProfileJawatanPemohon = document.getElementById('printProfile_jawatan_pemohon');
      const printProfileIcPemohon = document.getElementById('printProfile_ic_pemohon');
      const printProfileTelefonPemohon = document.getElementById('printProfile_telefon_pemohon');
      const printProfileEmailPemohon = document.getElementById('printProfile_email_pemohon');
      const printProfileJenisPendaftaran = document.getElementById('printProfile_jenis_pendaftaran');
      const printProfileTarikhDaftar = document.getElementById('printProfile_tarikh_daftar');
      const printProfileAlamatBerdaftar = document.getElementById('printProfile_alamat_berdaftar');
      const printProfileAlamatSurat = document.getElementById('printProfile_alamat_surat');
      const printProfileNoTelefonSyarikat = document.getElementById('printProfile_no_telefon_syarikat');
      const printProfileNoFax = document.getElementById('printProfile_no_fax');
      const printProfileEmailSyarikat = document.getElementById('printProfile_email_syarikat');
      const printProfileWeb = document.getElementById('printProfile_web');
      const printProfileGred = document.getElementById('printProfile_gred');
      const printProfileJenisPerubahan = document.getElementById('printProfile_jenis_perubahan');
      
      if (printProfileSyarikat) printProfileSyarikat.innerText = profileSyarikat.value || '-';
      if (printProfileCidb) printProfileCidb.innerText = profileCidb.value || '-';
      if (printProfileNamaPemohon) printProfileNamaPemohon.innerText = profileNamaPemohon ? (profileNamaPemohon.value || '-') : '-';
      if (printProfileJawatanPemohon) printProfileJawatanPemohon.innerText = profileJawatanPemohon ? (profileJawatanPemohon.value || '-') : '-';
      if (printProfileIcPemohon) printProfileIcPemohon.innerText = profileIcPemohon ? (profileIcPemohon.value || '-') : '-';
      if (printProfileTelefonPemohon) printProfileTelefonPemohon.innerText = profileTelefonPemohon ? (profileTelefonPemohon.value || '-') : '-';
      if (printProfileEmailPemohon) printProfileEmailPemohon.innerText = profileEmailPemohon ? (profileEmailPemohon.value || '-') : '-';
      if (printProfileJenisPendaftaran) printProfileJenisPendaftaran.innerText = profileJenisPendaftaran ? (profileJenisPendaftaran.value || '-') : '-';
      if (printProfileTarikhDaftar) printProfileTarikhDaftar.innerText = profileTarikhDaftar.value ? formatDateDisplay(profileTarikhDaftar.value) : '-';
      
      const alamatBerdaftarText = (profileAlamatBerdaftar.value || '-') + (cbSsmBerdaftar && cbSsmBerdaftar.checked ? ' (Sepadan e-info SSM)' : '');
      if (printProfileAlamatBerdaftar) printProfileAlamatBerdaftar.innerText = alamatBerdaftarText;
      
      const alamatSuratText = (profileAlamatSurat.value || '-') + (cbSsmSurat && cbSsmSurat.checked ? ' (Sepadan e-info SSM)' : '');
      if (printProfileAlamatSurat) printProfileAlamatSurat.innerText = alamatSuratText;
      
      if (printProfileNoTelefonSyarikat) printProfileNoTelefonSyarikat.innerText = profileNoTelefonSyarikat ? (profileNoTelefonSyarikat.value || '-') : '-';
      if (printProfileNoFax) printProfileNoFax.innerText = profileNoFax ? (profileNoFax.value || '-') : '-';
      if (printProfileEmailSyarikat) printProfileEmailSyarikat.innerText = profileEmailSyarikat ? (profileEmailSyarikat.value || '-') : '-';
      if (printProfileWeb) printProfileWeb.innerText = profileWeb ? (profileWeb.value || '-') : '-';
      if (printProfileGred) printProfileGred.innerText = profileGred.options[profileGred.selectedIndex]?.text || '-';
      
      if (printProfileJenisPerubahan) printProfileJenisPerubahan.innerText = profileJenisPerubahan ? (profileJenisPerubahan.value || '-') : '-';
      
      const today = new Date();
      const dateStr = today.toLocaleDateString('ms-MY', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      const printProfileDate = document.getElementById('printProfile_date');
      if (printProfileDate) printProfileDate.innerText = dateStr;
      
      const driveUrl = profilePautanDrive ? profilePautanDrive.value.trim() : '';
      const printProfileQrCodeImg = document.getElementById('printProfileQrCode');
      
      if (driveUrl && printProfileQrCodeImg) {
        const encodedUrl = encodeURIComponent(driveUrl);
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodedUrl}`;
        printProfileQrCodeImg.src = qrApiUrl;
        printProfileQrCodeImg.style.display = 'block';
      } else if (printProfileQrCodeImg) {
        printProfileQrCodeImg.style.display = 'none';
      }
      
      const userColor = getUserColorHex(currentUser.color);
      let themeColorHex = userColor;
      
      const profilePrintLayout = document.getElementById('printProfileLayout');
      if (profilePrintLayout) {
        const themeBgElements = profilePrintLayout.querySelectorAll('.profile-theme-bg');
        themeBgElements.forEach(el => {
          el.style.backgroundColor = themeColorHex;
          el.style.color = 'white';
        });
        
        const themeBorderElements = profilePrintLayout.querySelectorAll('.profile-theme-border');
        themeBorderElements.forEach(el => {
          el.style.borderLeftColor = themeColorHex;
        });
        
        const profileHeader = profilePrintLayout.querySelector('.profile-company-header');
        if (profileHeader) {
          profileHeader.style.backgroundColor = themeColorHex;
          profileHeader.style.color = 'white';
        }
      }
      
      const mainPrintLayout = document.getElementById('printLayout');
      
      if (mainPrintLayout) mainPrintLayout.style.display = 'none';
      if (profilePrintLayout) profilePrintLayout.style.display = 'block';
      
      window.print();
      
      setTimeout(() => {
        if (mainPrintLayout) mainPrintLayout.style.display = '';
        if (profilePrintLayout) profilePrintLayout.style.display = 'none';
      }, 500);
    });
  }

  // =========================================================================
  // CORE SYSTEM FUNCTIONS
  // =========================================================================

  async function initSystem() {
    simulateLoading('Menyediakan sistem...', 'Memuatkan tetapan...');

    try {
      const storage = await storageWrapper.get([
        'stb_session', 
        'stb_login_date',
        'stb_last_active_tab',
        'stb_last_active_element',
        'stb_form_states',
        'stb_pelulus_state',
        'stb_search_state',
        'stb_search_history_state',
        'stb_has_printed',
        'stb_users_cache',
        'stb_data_cache',
        'stb_cache_timestamp',
        'stb_drive_folder_url',
        'stb_user_folder_url',
        'stb_filter_pengesyor',
        'stb_all_recommenders',
        'stb_all_approvers',
        'stb_form_data',
        'stb_extracted_pdf_data',
        'stb_extracted_profile_data',
        'stb_dashboard_data',
        'stb_form_persistence',
        'stb_database_persistence',
        'stb_current_draft_filter',
        'stb_current_submitted_status_filter',
        'stb_current_submitted_jenis_filter',
        'stb_current_history_status_filter',
        'stb_current_history_jenis_filter',
        'stb_music_playing',
        'stb_bgm_volume',
        'stb_sfx_volume'
      ]);
      
      if (storage.stb_session) {
  const todayStr = new Date().toDateString();
  if (storage.stb_login_date && storage.stb_login_date !== todayStr) {
      console.log("V6.5.2 Sesi dibatalkan kerana pertukaran hari.");
      storageWrapper.remove(['stb_session', 'stb_login_date']).then(() => {
          currentUser = null;
      });
  } else {
      currentUser = storage.stb_session;

      // Log masuk semula ke Firebase secara automatik untuk SEMUA role
      if (currentUser && currentUser.email) {
          authFirebase.signInAnonymously().then(() => {
              // Khusus untuk Pengesyor (Sambung ke fungsi Bakul)
              if (currentUser.role === 'PENGESYOR') {
                  currentUserFirebaseCode = currentUser.firebaseCode || null; 
                  if (currentUserFirebaseCode) {
                      dbFirestore.collection("users").doc(currentUserFirebaseCode).get().then(doc => {
                          if (doc.exists) {
                              firebaseUserRules = doc.data();
                              subscribeToBakulFirebase();
                          }
                      });
                  }
              }
          });
      }
      setupUserUI(); 
  }
}
      
      if (storage.stb_last_active_tab) {
        lastActiveTab = storage.stb_last_active_tab;
      }
      
      if (storage.stb_last_active_element) {
        lastActiveElementId = storage.stb_last_active_element;
      }
      
      if (storage.stb_form_states) {
        formStates = storage.stb_form_states;
      }
      
      if (storage.stb_has_printed) {
        hasPrinted = storage.stb_has_printed;
        if (btnSyncToDb && hasPrinted) {
          btnSyncToDb.style.display = 'inline-block';
        }
      }
      
      if (storage.stb_drive_folder_url) {
        createdFolderUrl = storage.stb_drive_folder_url;
        driveFolderCreated = true;
      }
      
      if (storage.stb_user_folder_url) {
        userFolderUrl = storage.stb_user_folder_url;
      }
      
      if (storage.stb_all_recommenders) {
        allRecommenders = storage.stb_all_recommenders;
      }
      
      if (storage.stb_all_approvers) {
        allApprovers = storage.stb_all_approvers;
      }
      
      if (storage.stb_users_cache) {
        usersList = storage.stb_users_cache;
        console.log("V6.5.2 Loaded users from cache:", usersList.length);
        populateWhatsAppDropdown();
      }
      
      if (storage.stb_data_cache) {
        cachedData = storage.stb_data_cache;
        console.log("V6.5.2 Loaded data from cache:", cachedData.length);
        updateDynamicYears(cachedData);
      }
      
      if (storage.stb_extracted_pdf_data) {
        extractedPdfData = storage.stb_extracted_pdf_data;
        displayExtractedData(extractedPdfData);
        if (pdfResult) {
          pdfResult.style.display = 'block';
        }
      }
      
      if (storage.stb_extracted_profile_data) {
        extractedProfileData = storage.stb_extracted_profile_data;
        displayProfileExtractedData(extractedProfileData);
        if (profilePdfResult) {
          profilePdfResult.style.display = 'block';
        }
      }
      
      if (storage.stb_dashboard_data) {
        dashboardData = storage.stb_dashboard_data;
      }
      
      if (storage.stb_form_persistence) {
        console.log('V6.5.2 Found persisted form data');
      }
      
      if (storage.stb_database_persistence) {
        console.log('V6.5.2 Found persisted database form data');
      }
      
      if (storage.stb_current_draft_filter) {
        currentDraftFilter = storage.stb_current_draft_filter;
      }
      
      if (storage.stb_current_submitted_status_filter) {
        currentSubmittedStatusFilter = storage.stb_current_submitted_status_filter;
      }
      if (storage.stb_current_submitted_jenis_filter) {
        currentSubmittedJenisFilter = storage.stb_current_submitted_jenis_filter;
      }
      if (storage.stb_current_history_status_filter) {
        currentHistoryStatusFilter = storage.stb_current_history_status_filter;
      }
      if (storage.stb_current_history_jenis_filter) {
        currentHistoryJenisFilter = storage.stb_current_history_jenis_filter;
      }
            
      if (storage.stb_sfx_volume !== undefined) {
        sfxVolume = storage.stb_sfx_volume;
      }
      
      // Restore search inputs
      const searchListInput = document.getElementById('searchListInput');
      const searchHistoryInput = document.getElementById('searchHistoryInput');
      if (storage.stb_search_state && searchListInput) {
        searchListInput.value = storage.stb_search_state;
      }
      if (storage.stb_search_history_state && searchHistoryInput) {
        searchHistoryInput.value = storage.stb_search_history_state;
      }
      
    } catch (e) { 
      console.error("V6.5.2 Storage Error:", e); 
    }

    setupAudioControls();
    setupGlobalButtonClickSound();
    
    // Setup Mobile Menu Listeners
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    if (menuOverlay) {
      menuOverlay.addEventListener('click', closeMobileMenu);
    }
    
    // Tutup menu pada saiz desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        closeMobileMenu();
      }
    });
    
    hideLoading();
    
    // Show login screen if no active session
    if (!currentUser) {
      console.log("V6.5.2 No active session, showing login screen with Google Sign-In");
      if (loginScreen) {
        loginScreen.style.display = 'flex';
      }
      if (appContainer) {
        appContainer.style.display = 'none';
      }
      // Initialize Google Sign-In pada skrin login
      initializeGoogleSignIn();
    }
  }

  function populateWhatsAppDropdown() {
    if (!dbPelulusWhatsapp) return;
    
    const pelulusList = usersList.filter(user => user.role === 'PELULUS');
    
    dbPelulusWhatsapp.innerHTML = '<option value="">- Tiada Notifikasi / Pilih Pelulus -</option>';
    
    pelulusList.forEach(pelulus => {
      const phone = pelulus.phone || '';
      const name = pelulus.name || '';
      const option = document.createElement('option');
      option.value = phone;
      option.textContent = `${name} ${phone ? '(' + phone + ')' : ''}`;
      dbPelulusWhatsapp.appendChild(option);
    });
    
    console.log(`V6.5.2 WhatsApp dropdown populated with ${pelulusList.length} pelulus`);
  }

  function sendWhatsAppNotification(companyName, cidb, jenisPermohonan, syorStatus, tarikhSyor, pelulusPhone) {
    if (!pelulusPhone || pelulusPhone.trim() === '') {
      console.log("V6.5.2 No phone number provided for WhatsApp notification");
      return null;
    }
    
    let cleanPhone = pelulusPhone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '60' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('60')) {
      cleanPhone = '60' + cleanPhone;
    }
    
    if (!/^\d{9,15}$/.test(cleanPhone)) {
      console.log("V6.5.2 Invalid phone number format:", cleanPhone);
      return null;
    }
    
    const message = `*NOTIFIKASI PERMOHONAN STB*
    
Syarikat: ${companyName}
No. CIDB: ${cidb || 'Tiada'}
Jenis Permohonan: ${jenisPermohonan || 'Tiada'}
Status Syor: ${syorStatus || 'Tiada'}
Tarikh Syor: ${tarikhSyor || 'Tiada'}

Sila semak sistem STB untuk tindakan selanjutnya.`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    
    console.log("V6.5.2 WhatsApp notification URL prepared:", whatsappUrl);
    
    return whatsappUrl;
  }

  function generatePdfCssString(userColor) {
    const themeColor = userColor || '#2563eb';
    
    return `
      body {
        font-family: 'Arial', 'Segoe UI', sans-serif;
        margin: 0;
        padding: 10px;
        color: #000000;
        background: white;
      }
      
      /* GAYA BARU: Penandaan Syor untuk PDF */
      .syor-selected {
        border: 2px solid black !important;
        padding: 2px 8px !important;
        border-radius: 6px !important;
        font-weight: 900 !important;
        background-color: #f3f4f6 !important;
        display: inline-block !important;
      }
      .syor-dimmed {
        text-decoration: line-through !important;
        color: #888 !important;
        opacity: 0.5;
      }
      
      .print-header-strip {
        height: 6px;
        background-color: ${themeColor};
        margin-bottom: 10px;
      }
      
      .jenis-permohonan-bar {
        border: 1px solid #000;
        padding: 8px 10px;
        margin-bottom: 10px;
        background-color: #f0f9ff;
      }
      
      .jenis-permohonan-row-1 {
        border-bottom: 1px dotted #ccc;
        padding-bottom: 5px;
        margin-bottom: 5px;
      }
      
      .jenis-permohonan-row-2 {
        border-bottom: 1px dotted #ccc;
        padding-bottom: 5px;
        margin-bottom: 5px;
      }
      
      .jenis-permohonan-row-3 {
        display: block;
      }
      
      .checkbox-large {
        transform: scale(1.2);
        margin: 0 5px;
      }
      
      .print-fill-text {
        font-weight: bold;
        text-decoration: underline;
        padding: 0 10px;
      }
      
      .border-box {
        border: 1px solid #000;
        padding: 8px;
        margin: 2px 0;
        background-color: #f8fafc;
      }
      
      .themed-box {
        background-color: ${themeColor};
        color: white;
        padding: 8px;
      }
      
      .grade-bar {
        border: 1px solid #000;
        padding: 8px;
        margin: 5px 0;
        background-color: #fef3c7;
        display: block;
      }
      
      .print-table {
        width: 100%;
        border-collapse: collapse;
        margin: 5px 0;
      }
      
      .print-table th, .print-table td {
        border: 1px solid #000;
        padding: 4px 6px;
        vertical-align: top;
      }
      
      .col-tick {
        text-align: center;
        width: 40px;
      }
      
      .layout-table td {
        border: none;
        padding: 2px;
      }
      
      .info-field {
        display: inline-block;
        margin-right: 15px;
      }
      
      .info-label {
        font-weight: bold;
      }
      
      .print-result {
        font-weight: bold;
        text-align: center;
      }
      
      .verification-box {
        border: none;
        padding: 10px;
        margin-top: 10px;
      }
      
      .ver-title {
        font-weight: bold;
        text-decoration: underline;
        margin-bottom: 5px;
      }
      
      .options-text-center {
        text-align: center;
        font-style: italic;
        border-bottom: 1px dotted #ccc;
        padding-bottom: 5px;
        margin-bottom: 5px;
      }
      
      .pengesyor-grid-new {
        display: block;
        margin-top: 10px;
      }
      
      .pengesyor-dates {
        margin-bottom: 10px;
      }
      
      .pengesyor-sign-box {
        text-align: center;
        margin-top: 15px;
      }
      
      .verification-separator {
        border-bottom: 2px solid #000;
        margin: 10px 0;
      }
      
      .font-large-nobold {
        font-size: 16pt;
        font-weight: normal;
      }
      
      h2 {
        font-size: 14pt;
        margin: 10px 0 5px 0;
        border-bottom: 1px solid #000;
      }
    `;
  }

  function getCompanyFolderName() {
    const companyName = document.getElementById('borang_syarikat')?.value.trim() || '';
    const tarikhMohon = document.getElementById('borang_tarikh_mohon')?.value || '';
    const dbJenis = document.getElementById('db_jenis')?.value || '';
    const ubahMaklumat = document.getElementById('input_ubah_maklumat')?.value.trim() || '';
    const ubahGred = document.getElementById('input_ubah_gred')?.value.trim() || '';
    
    let formattedDate = '';
    try {
      const tarikhDate = new Date(tarikhMohon);
      formattedDate = tarikhDate.toLocaleDateString('ms-MY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');
    } catch (e) {
      formattedDate = tarikhMohon;
    }
    
    let folderName = `${companyName.toUpperCase()} - ${formattedDate}`;
    
    if (dbJenis === 'UBAH MAKLUMAT' && ubahMaklumat) {
      folderName = `${companyName.toUpperCase()} - ${formattedDate} - ${ubahMaklumat.toUpperCase()}`;
    } else if (dbJenis === 'UBAH GRED' && ubahGred) {
      folderName = `${companyName.toUpperCase()} - ${formattedDate} - ${ubahGred.toUpperCase()}`;
    }
    
    return folderName;
  }

  if(triggerPrintBtn) {
    triggerPrintBtn.addEventListener('click', async () => {
      preparePrintView();
      
      const dbPautanValue = document.getElementById('db_pautan')?.value || '';
      const isDriveAlreadyCreated = driveFolderCreated === true || (dbPautanValue && dbPautanValue.trim() !== '');
      
      let proceedToDrive = false;

      // KOD BARU: Logik Pilihan Cetak (Kemaskini Drive vs Cetak Biasa)
      if (isDriveAlreadyCreated) {
        const updateDrive = await CustomAppModal.confirm(
            "Rekod ini telah mempunyai pautan Drive. Adakah anda ingin KEMASKINI (simpan semula) fail PDF ini ke dalam Drive, atau sekadar cetakan biasa pada pencetak?",
            "Kemaskini PDF di Drive",
            "info",
            "Ya, Kemaskini Drive" // Teks Butang Biru
        );
        
        // Jika pengguna pilih "Batal" (Mahu cetak biasa sahaja)
        if (!updateDrive) {
            window.print();
            hasPrinted = true;
            storageWrapper.set({ 'stb_has_printed': true });
            if (btnSyncToDb) {
              btnSyncToDb.style.display = 'inline-block';
            }
            return; // Berhenti di sini, tak perlu panggil API Drive
        }
        
        // Jika pengguna tekan "Ya, Kemaskini Drive"
        proceedToDrive = true;

      } else {
        // Logik asal untuk rekod baru
        const userConfirmed = await CustomAppModal.confirm(
            "Adakah anda pasti ingin mencetak dan menyimpan borang ini ke Google Drive?",
            "Cetak & Simpan",
            "info",
            "Ya, Teruskan",
            false
        );
        
        if (!userConfirmed) {
          window.print();
          hasPrinted = true;
          storageWrapper.set({ 'stb_has_printed': true });
          if (btnSyncToDb) {
            btnSyncToDb.style.display = 'inline-block';
          }
          await CustomAppModal.alert("Borang telah dicetak. Butang 'Simpan & Ke Input Database' kini tersedia.", "Info", "success");
          return;
        }
        proceedToDrive = true;
      }
      
      // Jika proceedToDrive adalah BENAR (True), teruskan penjanaan fail PDF ke Server
      if (proceedToDrive) {
        const companyName = document.getElementById('borang_syarikat')?.value.trim();
        if (!companyName) {
          await CustomAppModal.alert("Sila isi Nama Syarikat terlebih dahulu sebelum mencetak dan menyimpan ke Drive.", "Maklumat Tidak Lengkap", "warning");
          return;
        }
        
        const applicationTypeRadio = document.querySelector('input[name="jenisApp"]:checked');
        let applicationType = '';
        if (applicationTypeRadio) {
          if (applicationTypeRadio.value === 'baru') applicationType = 'BARU';
          else if (applicationTypeRadio.value === 'pembaharuan') applicationType = 'PEMBAHARUAN';
          else if (applicationTypeRadio.value === 'ubah_maklumat') applicationType = 'UBAH MAKLUMAT';
          else if (applicationTypeRadio.value === 'ubah_gred') applicationType = 'UBAH GRED';
        }
        
        if (!applicationType) {
          await CustomAppModal.alert("Sila pilih Jenis Permohonan terlebih dahulu.", "Maklumat Tidak Lengkap", "warning");
          return;
        }
        
        const tarikhMohon = document.getElementById('borang_tarikh_mohon')?.value;
        if (!tarikhMohon) {
          await CustomAppModal.alert("Sila isi Tarikh Mohon terlebih dahulu.", "Maklumat Tidak Lengkap", "warning");
          return;
        }
        
        const userName = currentUser.name;
        const now = new Date();
        const currentMonth = now.toLocaleString('ms-MY', { month: 'long' });
        const currentYear = now.getFullYear();
        const monthYearFolder = `${currentMonth.toUpperCase()} ${currentYear}`;
        
        let formattedDate = '';
        try {
          const tarikhDate = new Date(tarikhMohon);
          formattedDate = tarikhDate.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        } catch (e) {
          formattedDate = tarikhMohon;
        }
        
        const ubahMaklumatVal = document.getElementById('input_ubah_maklumat')?.value || '';
        const ubahGredVal = document.getElementById('input_ubah_gred')?.value || '';
        let specificType = '';
        if (applicationType === 'UBAH MAKLUMAT' && ubahMaklumatVal) specificType = ` (${ubahMaklumatVal})`;
        if (applicationType === 'UBAH GRED' && ubahGredVal) specificType = ` (${ubahGredVal})`;
        
        const subfolderName = `${applicationType}${specificType} - ${formattedDate}`;
        
        const printLayoutElement = document.getElementById('printLayout');
        if (!printLayoutElement) {
          await CustomAppModal.alert("Ralat: Elemen cetakan tidak ditemui.", "Ralat Sistem", "error");
          return;
        }
        
        const userColorHex = getUserColorHex(currentUser.color);
        const pdfCss = generatePdfCssString(userColorHex);
        // Simpan status asal display untuk dikembalikan semula nanti
        const imgEls = [
            document.getElementById('print_pengesyor_sign'), document.getElementById('print_pengesyor_cop'),
            document.getElementById('print_pelulus_sign'), document.getElementById('print_pelulus_cop')
        ];
        const originalDisplays = imgEls.map(el => el ? el.style.display : 'none');

        // Sembunyikan gambar khusus untuk capture HTML ke Drive
        imgEls.forEach(el => { if(el) el.style.display = 'none'; });
        const printHTMLForDrive = `<style>${pdfCss}</style>${printLayoutElement.outerHTML}`;

        // Tunjukkan semula gambar untuk cetakan browser (window.print)
        imgEls.forEach((el, idx) => { if(el) el.style.display = originalDisplays[idx]; });
        
        // Gunakan printHTMLForDrive dalam payload ke backend
        
        if (loadingOverlay) {
          loadingOverlay.style.display = 'flex';
          loadingText.textContent = 'Menyimpan ke Drive';
          if (loadingSubtext) loadingSubtext.textContent = 'Sila tunggu sebentar';
          
          const progressBar = document.getElementById('loading-progress-bar');
          const progressPercent = document.getElementById('loading-progress-percent');
          const progressLabel = document.getElementById('loading-progress-label');
          
          if (progressBar) { progressBar.style.display = 'block'; progressBar.style.width = '0%'; }
          if (progressPercent) progressPercent.textContent = '0%';
          if (progressLabel) progressLabel.textContent = 'Menyediakan dokumen PDF...';
          
          const progressSteps = document.getElementById('loading-progress-steps');
          if (progressSteps) progressSteps.style.display = 'flex';
          
          let currentProgress = 0;
          if (loadingProgressInterval) clearInterval(loadingProgressInterval);
          
          loadingProgressInterval = setInterval(() => {
            if (currentProgress < 90) {
              currentProgress += Math.floor(Math.random() * 5) + 1;
              if (currentProgress > 90) currentProgress = 90;
              if (progressBar) progressBar.style.width = `${currentProgress}%`;
              if (progressPercent) progressPercent.textContent = `${currentProgress}%`;
              if (progressLabel) progressLabel.textContent = currentProgress < 30 ? 'Menyediakan dokumen PDF...' : currentProgress < 60 ? 'Mencipta folder di Google Drive...' : 'Menyimpan fail...';
            }
          }, 200);
        }
        
        if (printLayoutElement) printLayoutElement.style.display = 'none';
        
        // Format Nama File (Title Case)
        const syorChoice = document.getElementById('borang_syor_status')?.value;
        let customFileName = `Borang Semakan ${companyName}`; 
        
        if (syorChoice === 'SOKONG') {
            const tProses = document.getElementById('borang_tarikh_proses')?.value || '';
            customFileName = `Borang Semakan Sokong-${tProses}`;
        } else if (syorChoice === 'TIDAK DISOKONG') {
            const tProses = document.getElementById('borang_tarikh_proses')?.value || '';
            customFileName = `Borang Semakan Tidak Disokong-${tProses}`;
        } else if (syorChoice === 'SIASAT') {
            const tLengkap = document.getElementById('borang_tarikh_lengkap')?.value || '';
            customFileName = `Borang Semakan Siasat-${tLengkap}`;
        }

        const payload = {
          action: 'cetak_dan_simpan_pdf',
          company_name: companyName,
          custom_file_name: customFileName,
          application_type: subfolderName,
          month_year: monthYearFolder,
          user_name: userName,
          user_color: userColorHex,
          main_folder_id: mainFolderId,
          htmlContent: printHTMLForDrive,
          email: currentUser ? currentUser.email : ''
        };
        
        try {
          const response = await fetchWithRetry(SCRIPT_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
          }, 3, 1000);
          
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const result = await response.json();
          
          if (loadingProgressInterval) clearInterval(loadingProgressInterval);
          const progressBar = document.getElementById('loading-progress-bar');
          const progressPercent = document.getElementById('loading-progress-percent');
          const progressLabel = document.getElementById('loading-progress-label');
          
          if (progressBar) progressBar.style.width = '100%';
          if (progressPercent) progressPercent.textContent = '100%';
          if (progressLabel) progressLabel.textContent = 'Selesai!';
          
          if (result.success) {
            await playSuccessSound();
            const folderUrl = result.folder_url;
            const dbPautanField = document.getElementById('db_pautan');
            if (dbPautanField) dbPautanField.value = folderUrl;
            
            driveFolderCreated = true;
            createdFolderUrl = folderUrl;
            userFolderUrl = result.user_folder_url || '';
            
            if (cbCreateDriveFolder) cbCreateDriveFolder.checked = false;
            
            await storageWrapper.set({ 'stb_drive_folder_url': folderUrl, 'stb_user_folder_url': userFolderUrl });
            updateOpenDriveButton();
            
            setTimeout(async () => {
              if (loadingOverlay) loadingOverlay.style.display = 'none';
              if (printLayoutElement) printLayoutElement.style.display = '';
              
              window.print();
              hasPrinted = true;
              storageWrapper.set({ 'stb_has_printed': true });
              if (btnSyncToDb) btnSyncToDb.style.display = 'inline-block';
              if (driveResult && folderUrl) showDriveFolderLink(folderUrl, userFolderUrl);
              
              // Mesej berjaya dikemaskini
              await CustomAppModal.alert("Borang telah dicetak dan fail PDF berjaya dikemaskini di Drive!<br><br>Pautan folder telah dimasukkan secara automatik ke Input Database.", "Berjaya Disimpan", "success");
            }, 500);
            
          } else {
            throw new Error(result.message || 'Gagal menyimpan ke Drive');
          }
        } catch (error) {
          console.error("V6.5.2 Print & Drive save error:", error);
          await playErrorSound();
          if (loadingProgressInterval) clearInterval(loadingProgressInterval);
          if (loadingOverlay) loadingOverlay.style.display = 'none';
          if (printLayoutElement) printLayoutElement.style.display = '';
          
          await CustomAppModal.alert(`Gagal menyimpan ke Drive: ${error.message}<br><br>Cetakan akan diteruskan tanpa simpanan Drive.`, "Ralat Drive", "error");
          
          window.print();
          hasPrinted = true;
          storageWrapper.set({ 'stb_has_printed': true });
          if (btnSyncToDb) btnSyncToDb.style.display = 'inline-block';
        }
      }
    });
  }

  function preparePrintView() {
    const val = (id) => { 
      const el = document.getElementById(id); 
      return el ? el.value.toUpperCase() : ''; 
    };

    // Kemaskini Checkbox untuk PDF
    const selectedType = document.querySelector('input[name="jenisApp"]:checked')?.value;
    ['baru', 'pembaharuan', 'ubah_maklumat', 'ubah_gred'].forEach(type => {
      const cb = document.getElementById(`print_type_${type}`);
      if(cb) {
          cb.checked = false;
          cb.removeAttribute('checked');
      }
    });
    if(selectedType) {
      const targetCb = document.getElementById(`print_type_${selectedType}`);
      if(targetCb) {
          targetCb.checked = true;
          targetCb.setAttribute('checked', 'checked'); // PENTING: Untuk Drive
      }
    }

    const setTxt = (id, val) => { 
      const el = document.getElementById(id); 
      if(el) el.innerText = val; 
    };

    const combinedNameCidb = `${val('borang_syarikat')} (${val('borang_cidb')})`;
    setTxt('print_companyDetails', combinedNameCidb);

    setTxt('print_spkkDuration', val('spkkDuration'));
    setTxt('print_stbDuration', val('stbDuration'));
    setTxt('print_text_ubah_maklumat', val('input_ubah_maklumat'));
    setTxt('print_text_ubah_gred', val('input_ubah_gred'));
    setTxt('print_grade_display', val('borang_gred'));
    setTxt('print_tatatertib', val('borang_tatatertib'));
    setTxt('print_justifikasi', val('borang_justifikasi') || val('input_justifikasi') || val('db_justifikasi'));
    
    setTxt('print_no_telefon', val('borang_no_telefon'));
    
    setTxt('print_ssm_date', formatDateDisplay(val('ssm_date_input')));
    setTxt('print_bank_date', formatDateDisplay(val('bank_date_input')));
    setTxt('print_ssm_status_display', val('ssm_status'));

    const bankSign = val('bank_sign_input');
    const bankStatus = val('bank_status_input');
    const bankDisplay = bankStatus ? `${bankSign} (${bankStatus})` : bankSign;
    setTxt('print_bank_sign', bankDisplay);

    setTxt('print_doc_carta', val('doc_carta_status'));
    setTxt('print_doc_peta', val('doc_peta_status'));
    setTxt('print_doc_gambar', val('doc_gambar_status'));
    setTxt('print_doc_sewa', val('doc_sewa_status'));

    const kwsp1 = formatKWSP(val('kwsp_date_1'), val('kwsp_s1'));
    const kwsp2 = formatKWSP(val('kwsp_date_2'), val('kwsp_s2'));
    const kwsp3 = formatKWSP(val('kwsp_date_3'), val('kwsp_s3'));
    setTxt('print_kwsp_1', kwsp1);
    setTxt('print_kwsp_2', kwsp2);
    setTxt('print_kwsp_3', kwsp3);
    
    const tMohon = document.getElementById('borang_tarikh_mohon')?.value || '';
    setTxt('print_tarikh_mohon', tMohon ? formatDateDisplay(tMohon) : '_____________');
    // KOD BARU: Set Tarikh Tambahan
    setTxt('print_tarikh_lengkap', val('borang_tarikh_lengkap') ? formatDateDisplay(val('borang_tarikh_lengkap')) : '_____________');
    setTxt('print_tarikh_siasatan', val('borang_tarikh_siasatan') ? formatDateDisplay(val('borang_tarikh_siasatan')) : '_____________');
    setTxt('print_tarikh_proses', val('borang_tarikh_proses') ? formatDateDisplay(val('borang_tarikh_proses')) : '_____________');

    // Kemaskini Highlight Syor untuk PDF
    const syorPilihan = val('borang_syor_status');
    const elSokong = document.getElementById('print_syor_sokong');
    const elSiasat = document.getElementById('print_syor_siasat');
    const elTidak = document.getElementById('print_syor_tidak_sokong');

    [elSokong, elSiasat, elTidak].forEach(el => {
        if(el) { 
            el.setAttribute('class', 'syor-dimmed'); // Gunakan setAttribute
        }
    });

    if(syorPilihan === 'SOKONG' && elSokong) {
        elSokong.setAttribute('class', 'syor-selected');
    } else if(syorPilihan === 'SIASAT' && elSiasat) {
        elSiasat.setAttribute('class', 'syor-selected');
    } else if(syorPilihan === 'TIDAK DISOKONG' && elTidak) {
        elTidak.setAttribute('class', 'syor-selected');
    }

    const tbody = document.getElementById('print_personnel_page1');
    if (!tbody) return;

    tbody.innerHTML = '';

    const cards = document.querySelectorAll('.person-card');
    let rowsHtml = '';

    cards.forEach(card => {
      const name = card.querySelector('.p-name')?.value.toUpperCase() || '';
      const roles = [];
      card.querySelectorAll('.role-cb:checked').forEach(cb => roles.push(cb.value));
      const s_ic = card.querySelector('.status-ic')?.value.toUpperCase() || '';
      const s_sb = card.querySelector('.status-sb')?.value.toUpperCase() || '';
      const s_epf = card.querySelector('.status-epf')?.value.toUpperCase() || '';
      
      const tick = (role) => roles.includes(role) ? '✓' : '';
      
      rowsHtml += `<tr>
        <td style="padding:2px;"><div style="font-weight:bold; font-size:12pt; text-transform:uppercase;">${name}</div></td>
        <td class="col-tick">${tick('PENGARAH')}</td>
        <td class="col-tick">${tick('P.EKUITI')}</td>
        <td class="col-tick">${tick('T.T CEK')}</td>
        <td class="col-tick">${tick('P.SPKK')}</td>
        <td class="col-tick">${s_ic}</td>
        <td class="col-tick">${s_sb}</td>
        <td class="col-tick">${s_epf}</td>
      </tr>`;
    });

    for(let i = cards.length; i < 6; i++) {
      rowsHtml += `<tr><td style="height:35px;"></td><td class="col-tick"></td><td class="col-tick"></td><td class="col-tick"></td><td class="col-tick"></td><td class="col-tick"></td><td class="col-tick"></td><td class="col-tick"></td></tr>`;
    }

    tbody.innerHTML = rowsHtml;

    // =========================================================================
    // KOD BARU: AUTO-INJECT TANDATANGAN & COP (PEMBAIKAN DRIVE PDF)
    // =========================================================================
    
    // Dapatkan nama pegawai
    const namaPengesyor = val('db_pengesyor') || val('pengesyor') || (currentUser && currentUser.role === 'PENGESYOR' ? currentUser.name : '');
    const namaPelulus = document.getElementById('pelulus_nama')?.value || (typeof pelulusActiveItem !== 'undefined' && pelulusActiveItem ? pelulusActiveItem.pelulus : '');
    const keputusanPelulus = document.getElementById('pelulus_keputusan')?.value || (typeof pelulusActiveItem !== 'undefined' && pelulusActiveItem ? pelulusActiveItem.kelulusan : '');

    // Dapatkan elemen gambar
    const imgSignPengesyor = document.getElementById('print_pengesyor_sign');
    const imgCopPengesyor = document.getElementById('print_pengesyor_cop');
    const imgSignPelulus = document.getElementById('print_pelulus_sign');
    const imgCopPelulus = document.getElementById('print_pelulus_cop');
    
    // RESET PENTING: Sembunyikan & BUANG atribut 'src' supaya tak keluar ikon 'broken image' di PDF Drive
    [imgSignPengesyor, imgCopPengesyor, imgSignPelulus, imgCopPelulus].forEach(img => { 
        if (img) {
            img.style.display = 'none'; 
            img.removeAttribute('src'); 
        }
    });

    if (typeof usersList !== 'undefined' && usersList.length > 0) {
        
        // Sign/Cop hanya muncul jika syorPilihan (SOKONG/SIASAT/TIDAK DISOKONG) sudah dipilih
        if (namaPengesyor && syorPilihan) { 
            const userPengesyor = usersList.find(u => u.name.toUpperCase() === namaPengesyor.toUpperCase());
            if (userPengesyor) {
                if (userPengesyor.signUrl && userPengesyor.signUrl.trim() !== '') { 
                    imgSignPengesyor.setAttribute('src', userPengesyor.signUrl.trim()); 
                    imgSignPengesyor.style.display = 'block'; 
                }
                if (userPengesyor.copUrl && userPengesyor.copUrl.trim() !== '') { 
                    imgCopPengesyor.setAttribute('src', userPengesyor.copUrl.trim()); 
                    imgCopPengesyor.style.display = 'block'; 
                }
            }
        }

        // 2. Masukkan Sign Pelulus (Jika ada keputusan)
        if (keputusanPelulus && keputusanPelulus.trim() !== '') {
            const userPelulus = usersList.find(u => u.name.toUpperCase() === namaPelulus.toUpperCase());
            if (userPelulus) {
                if (userPelulus.signUrl && userPelulus.signUrl.trim() !== '') { 
                    imgSignPelulus.setAttribute('src', userPelulus.signUrl.trim()); 
                    imgSignPelulus.style.display = 'block'; 
                }
                if (userPelulus.copUrl && userPelulus.copUrl.trim() !== '') { 
                    imgCopPelulus.setAttribute('src', userPelulus.copUrl.trim()); 
                    imgCopPelulus.style.display = 'block'; 
                }
                
                // Masukkan Maklumat Tarikh & Catatan Pelulus
                const tLulus = pelulusActiveItem ? pelulusActiveItem.tarikh_lulus : new Date().toISOString().split('T')[0];
                
                let catatan = '';
                if (pelulusActiveItem && pelulusActiveItem.borang_json) {
                    try { 
                        const parsed = JSON.parse(pelulusActiveItem.borang_json);
                        if (parsed.catatan_pelulus) catatan = parsed.catatan_pelulus;
                    } catch(e){}
                }
                if (!catatan) {
                    catatan = document.getElementById('pelulus_catatan')?.value || document.getElementById('pelulus_alasan')?.value || (pelulusActiveItem ? pelulusActiveItem.alasan : '');
                }
                
                setTxt('print_tarikh_lulus', tLulus ? formatDateDisplay(tLulus) : '________________');
                setTxt('print_catatan_pelulus', catatan);
                
                // Highlight Keputusan Pelulus di PDF
                const elLulus = document.getElementById('print_lulus');
                const elLulusSyarat = document.getElementById('print_lulus_syarat');
                const elPemutihan = document.getElementById('print_pemutihan');
                const elTolak = document.getElementById('print_tolak');
                
                [elLulus, elLulusSyarat, elPemutihan, elTolak].forEach(el => { 
                    if (el) el.setAttribute('class', 'syor-dimmed'); 
                });
                
                if (keputusanPelulus === 'LULUS' && elLulus) elLulus.setAttribute('class', 'syor-selected');
                else if (keputusanPelulus === 'LULUS BERSYARAT' && elLulusSyarat) elLulusSyarat.setAttribute('class', 'syor-selected');
                else if (keputusanPelulus === 'PEMUTIHAN' && elPemutihan) elPemutihan.setAttribute('class', 'syor-selected');
                else if (keputusanPelulus.includes('TOLAK') && elTolak) elTolak.setAttribute('class', 'syor-selected');
            }
        }
    }
  }

  function setupAutoSaveListeners() {
    const checkerTab = document.getElementById('tab-checker');
    if (checkerTab) {
      checkerTab.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.id && !el.id.includes('print_') && !el.id.includes('pelulus_') && !el.id.includes('login')) {
          el.addEventListener('input', saveFormData);
          el.addEventListener('change', saveFormData);
        }
      });
    }

    document.querySelectorAll('input[name="jenisApp"]').forEach(radio => {
      radio.addEventListener('change', saveFormData);
    });

    document.querySelectorAll('.tick-btn').forEach(btn => {
      btn.addEventListener('click', saveFormData);
    });

    console.log('V6.5.2 Auto-save listeners initialized for checker tab');
  }

  function setupDatabaseAutoSaveListeners() {
    const databaseTab = document.getElementById('tab-database');
    if (databaseTab) {
      databaseTab.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.id && !el.id.includes('print_') && !el.id.includes('pelulus_') && !el.id.includes('login')) {
          el.addEventListener('input', saveDatabaseFormData);
          el.addEventListener('change', saveDatabaseFormData);
        }
      });
    }

    const createDriveFolder = document.getElementById('cbCreateDriveFolder');
    if (createDriveFolder) {
      createDriveFolder.addEventListener('change', saveDatabaseFormData);
    }

    console.log('V6.5.2 Auto-save listeners initialized for database tab');
  }

  if(dbSyor) {
    dbSyor.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'YA' && dbPautanInput) {
        dbPautanInput.style.backgroundColor = '#fffbeb';
        dbPautanInput.style.borderColor = '#f59e0b';
        dbPautanInput.style.borderWidth = '2px';
      } else if (dbPautanInput) {
        dbPautanInput.style.backgroundColor = '';
        dbPautanInput.style.borderColor = '';
        dbPautanInput.style.borderWidth = '';
      }
      
      if(currentUser && (currentUser.role === 'PENGESYOR' || currentUser.role === 'ADMIN') && !isRestoring) {
        saveDatabaseFormData();
      }
    });
  }

  if (cbCreateDriveFolder) {
    cbCreateDriveFolder.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (driveFolderInfo) {
        driveFolderInfo.style.display = isChecked ? 'block' : 'none';
      }
      if (btnCreateDriveFolder) {
        btnCreateDriveFolder.style.display = isChecked ? 'inline-block' : 'none';
      }
      
      if(currentUser && (currentUser.role === 'PENGESYOR' || currentUser.role === 'ADMIN') && !isRestoring) {
        saveDatabaseFormData();
      }
    });
  }

  if (btnCreateDriveFolder) {
    btnCreateDriveFolder.addEventListener('click', () => {
      createDriveFolder();
    });
  }

  function openDriveFolder() {
    const dbPautan = document.getElementById('db_pautan')?.value;
    
    if (!dbPautan || dbPautan.trim() === '') {
      alert("Tiada pautan folder Drive. Sila cipta folder terlebih dahulu.");
      return;
    }
    
    window.open(dbPautan, '_blank');
  }

  if (btnOpenDriveFolder) {
    btnOpenDriveFolder.addEventListener('click', openDriveFolder);
  }

  if (btnOpenMyDriveFolder) {
    btnOpenMyDriveFolder.addEventListener('click', () => {
      if (userFolderUrl) {
        window.open(userFolderUrl, '_blank');
      } else {
        alert("Folder user anda belum dicipta. Sila cipta folder untuk syarikat ini terlebih dahulu.");
      }
    });
  }

  if (btnClearFilter) {
    btnClearFilter.addEventListener('click', () => {
      document.querySelectorAll('#pengesyorFilterButtonsContainer button').forEach(btn => {
        btn.style.backgroundColor = '#f3f4f6';
        btn.style.color = '#374151';
        btn.style.fontWeight = 'normal';
      });
      storageWrapper.set({ 'stb_filter_pengesyor': '' });
      renderFilteredList(activeListType);
    });
  }

  function updatePengesyorFilter() {
    if (!pengesyorFilterButtonsContainer) return;
    
    const recommenders = new Set();
    if (cachedData && cachedData.length > 0) {
      cachedData.forEach(item => {
        if (item.pengesyor && item.pengesyor.trim() !== '') {
          recommenders.add(item.pengesyor.trim());
        }
      });
    }
    allRecommenders = Array.from(recommenders).sort();
    storageWrapper.set({ 'stb_all_recommenders': allRecommenders });
    
    let buttonsHtml = '';
    allRecommenders.forEach(name => {
      buttonsHtml += `<button class="filter-btn" data-name="${name}" style="padding:4px 12px; background:#f3f4f6; border:none; border-radius:16px; font-size:0.8rem; cursor:pointer; transition:all 0.2s;">${name}</button>`;
    });
    pengesyorFilterButtonsContainer.innerHTML = buttonsHtml;
    
    pengesyorFilterButtonsContainer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedName = btn.getAttribute('data-name');
        const isActive = btn.style.backgroundColor === 'rgb(37, 99, 235)' || btn.style.backgroundColor === '#2563eb';
        
        pengesyorFilterButtonsContainer.querySelectorAll('button').forEach(b => {
          b.style.backgroundColor = '#f3f4f6';
          b.style.color = '#374151';
          b.style.fontWeight = 'normal';
        });
        
        if (isActive) {
          storageWrapper.set({ 'stb_filter_pengesyor': '' });
        } else {
          btn.style.backgroundColor = '#2563eb';
          btn.style.color = 'white';
          btn.style.fontWeight = 'bold';
          storageWrapper.set({ 'stb_filter_pengesyor': selectedName });
        }
        
        renderFilteredList(activeListType);
      });
    });
    
    storageWrapper.get(['stb_filter_pengesyor']).then(storage => {
      if (storage.stb_filter_pengesyor) {
        const activeBtn = Array.from(pengesyorFilterButtonsContainer.querySelectorAll('button')).find(b => b.getAttribute('data-name') === storage.stb_filter_pengesyor);
        if (activeBtn) {
          activeBtn.style.backgroundColor = '#2563eb';
          activeBtn.style.color = 'white';
          activeBtn.style.fontWeight = 'bold';
        }
      }
    });
  }

  function updatePelulusFilter() {
    if (!pelulusFilterButtonsContainer) return;
    
    const approvers = new Set();
    if (cachedData && cachedData.length > 0) {
      cachedData.forEach(item => {
        if (item.pelulus && item.pelulus.trim() !== '') {
          approvers.add(item.pelulus.trim());
        }
      });
    }
    allApprovers = Array.from(approvers).sort();
    storageWrapper.set({ 'stb_all_approvers': allApprovers });
    
    let buttonsHtml = '';
    allApprovers.forEach(name => {
      buttonsHtml += `<button class="filter-btn" data-name="${name}" style="padding:4px 12px; background:#f3f4f6; border:none; border-radius:16px; font-size:0.8rem; cursor:pointer; transition:all 0.2s;">${name}</button>`;
    });
    pelulusFilterButtonsContainer.innerHTML = buttonsHtml;
    
    pelulusFilterButtonsContainer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedName = btn.getAttribute('data-name');
        const isActive = btn.style.backgroundColor === 'rgb(37, 99, 235)' || btn.style.backgroundColor === '#2563eb';
        
        pelulusFilterButtonsContainer.querySelectorAll('button').forEach(b => {
          b.style.backgroundColor = '#f3f4f6';
          b.style.color = '#374151';
          b.style.fontWeight = 'normal';
        });
        
        if (isActive) {
          storageWrapper.set({ 'stb_filter_pelulus': '' });
        } else {
          btn.style.backgroundColor = '#2563eb';
          btn.style.color = 'white';
          btn.style.fontWeight = 'bold';
          storageWrapper.set({ 'stb_filter_pelulus': selectedName });
        }
        
        renderFilteredList(activeListType);
      });
    });
    
    storageWrapper.get(['stb_filter_pelulus']).then(storage => {
      if (storage.stb_filter_pelulus) {
        const activeBtn = Array.from(pelulusFilterButtonsContainer.querySelectorAll('button')).find(b => b.getAttribute('data-name') === storage.stb_filter_pelulus);
        if (activeBtn) {
          activeBtn.style.backgroundColor = '#2563eb';
          activeBtn.style.color = 'white';
          activeBtn.style.fontWeight = 'bold';
        }
      }
    });
  }

  if (listFilterMonth) {
    listFilterMonth.addEventListener('change', () => {
      if (activeListType) {
        renderFilteredList(activeListType);
      }
    });
  }
  
  if (listFilterYear) {
    listFilterYear.addEventListener('change', () => {
      if (activeListType) {
        renderFilteredList(activeListType);
      }
    });
  }
  
  const historyMonthFilter = document.getElementById('historyMonthFilter');
  if (historyMonthFilter) {
    historyMonthFilter.addEventListener('change', () => {
      if (activeListType) renderFilteredList(activeListType);
    });
  }

  const historyYearFilter = document.getElementById('historyYearFilter');
  if (historyYearFilter) {
    historyYearFilter.addEventListener('change', () => {
      if (activeListType) renderFilteredList(activeListType);
    });
  }

  const btnRefreshHistory = document.getElementById('btnRefreshHistory');
  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', () => {
      fetchAndRenderList('history');
    });
  }
  
  const draftContainer = document.getElementById('draftFiltersContainer');
  if (draftContainer && !draftContainer.hasAttribute('data-listener')) {
      draftContainer.setAttribute('data-listener', 'true');
      draftContainer.addEventListener('click', (e) => {
          const btn = e.target.closest('button');
          if (!btn || !btn.id.startsWith('filterBtn')) return;
          
          let filterVal = '';
          if (btn.id === 'filterBtnBaru') filterVal = 'BARU';
          else if (btn.id === 'filterBtnPembaharuan') filterVal = 'PEMBAHARUAN';
          else if (btn.id === 'filterBtnUbahMaklumat') filterVal = 'UBAH MAKLUMAT';
          else if (btn.id === 'filterBtnUbahGred') filterVal = 'UBAH GRED';
          else if (btn.id === 'filterBtnSpi') filterVal = 'SPI';
          else if (btn.id === 'filterBtnAll') filterVal = 'ALL';
          
          if (filterVal) {
              if (filterVal === 'ALL') {
                  currentDraftFilter = 'ALL';
              } else {
                  currentDraftFilter = (currentDraftFilter === filterVal) ? 'ALL' : filterVal;
              }
              
              updateDraftFilterButtons();
              
              if (activeListType) {
                  renderFilteredList(activeListType);
              }
              
              storageWrapper.set({ 'stb_current_draft_filter': currentDraftFilter });
          }
      });
  }
  
  if (submittedFiltersContainer && !submittedFiltersContainer.hasAttribute('data-listener')) {
    submittedFiltersContainer.setAttribute('data-listener', 'true');
    submittedFiltersContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !btn.id.startsWith('filterSubmitted')) return;
      
      const isStatusBtn = ['filterSubmittedAll', 'filterSubmittedLulus', 'filterSubmittedTolak', 'filterSubmittedPending'].includes(btn.id);
      const isJenisBtn = ['filterSubmittedJenisBaru', 'filterSubmittedJenisPembaharuan', 'filterSubmittedJenisUbahMaklumat', 'filterSubmittedJenisUbahGred'].includes(btn.id);
      
      if (isStatusBtn) {
        if (btn.id === 'filterSubmittedAll') {
          currentSubmittedStatusFilter = 'ALL';
        } else if (btn.id === 'filterSubmittedLulus') {
          currentSubmittedStatusFilter = (currentSubmittedStatusFilter === 'LULUS') ? 'ALL' : 'LULUS';
        } else if (btn.id === 'filterSubmittedTolak') {
          currentSubmittedStatusFilter = (currentSubmittedStatusFilter === 'TOLAK') ? 'ALL' : 'TOLAK';
        } else if (btn.id === 'filterSubmittedPending') {
          currentSubmittedStatusFilter = (currentSubmittedStatusFilter === 'PENDING') ? 'ALL' : 'PENDING';
        }
      } else if (isJenisBtn) {
        if (btn.id === 'filterSubmittedJenisBaru') {
          currentSubmittedJenisFilter = (currentSubmittedJenisFilter === 'BARU') ? 'ALL' : 'BARU';
        } else if (btn.id === 'filterSubmittedJenisPembaharuan') {
          currentSubmittedJenisFilter = (currentSubmittedJenisFilter === 'PEMBAHARUAN') ? 'ALL' : 'PEMBAHARUAN';
        } else if (btn.id === 'filterSubmittedJenisUbahMaklumat') {
          currentSubmittedJenisFilter = (currentSubmittedJenisFilter === 'UBAH MAKLUMAT') ? 'ALL' : 'UBAH MAKLUMAT';
        } else if (btn.id === 'filterSubmittedJenisUbahGred') {
          currentSubmittedJenisFilter = (currentSubmittedJenisFilter === 'UBAH GRED') ? 'ALL' : 'UBAH GRED';
        }
      }
      
      updateSubmittedFilterButtons();
      
      if (activeListType === 'submitted') {
        renderFilteredList('submitted');
      }
      
      storageWrapper.set({ 
        'stb_current_submitted_status_filter': currentSubmittedStatusFilter,
        'stb_current_submitted_jenis_filter': currentSubmittedJenisFilter
      });
    });
  }
  
  if (historyFiltersContainer && !historyFiltersContainer.hasAttribute('data-listener')) {
    historyFiltersContainer.setAttribute('data-listener', 'true');
    historyFiltersContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !btn.id.startsWith('filterHistory')) return;
      
      const isStatusBtn = ['filterHistoryAll', 'filterHistoryStatusAll', 'filterHistoryStatusLulus', 'filterHistoryStatusTolak', 'filterHistoryStatusPending'].includes(btn.id);
      const isJenisBtn = ['filterHistoryJenisBaru', 'filterHistoryJenisPembaharuan', 'filterHistoryJenisUbahMaklumat', 'filterHistoryJenisUbahGred'].includes(btn.id);
      
      if (isStatusBtn) {
        if (btn.id === 'filterHistoryStatusAll' || btn.id === 'filterHistoryAll') {
          currentHistoryStatusFilter = 'ALL';
        } else if (btn.id === 'filterHistoryStatusLulus') {
          currentHistoryStatusFilter = (currentHistoryStatusFilter === 'LULUS') ? 'ALL' : 'LULUS';
        } else if (btn.id === 'filterHistoryStatusTolak') {
          currentHistoryStatusFilter = (currentHistoryStatusFilter === 'TOLAK') ? 'ALL' : 'TOLAK';
        } else if (btn.id === 'filterHistoryStatusPending') {
          currentHistoryStatusFilter = (currentHistoryStatusFilter === 'PENDING') ? 'ALL' : 'PENDING';
        }
      } else if (isJenisBtn) {
        if (btn.id === 'filterHistoryJenisBaru') {
          currentHistoryJenisFilter = (currentHistoryJenisFilter === 'BARU') ? 'ALL' : 'BARU';
        } else if (btn.id === 'filterHistoryJenisPembaharuan') {
          currentHistoryJenisFilter = (currentHistoryJenisFilter === 'PEMBAHARUAN') ? 'ALL' : 'PEMBAHARUAN';
        } else if (btn.id === 'filterHistoryJenisUbahMaklumat') {
          currentHistoryJenisFilter = (currentHistoryJenisFilter === 'UBAH MAKLUMAT') ? 'ALL' : 'UBAH MAKLUMAT';
        } else if (btn.id === 'filterHistoryJenisUbahGred') {
          currentHistoryJenisFilter = (currentHistoryJenisFilter === 'UBAH GRED') ? 'ALL' : 'UBAH GRED';
        }
      }
      
      updateHistoryFilterButtons();
      
      if (activeListType === 'history') {
        renderFilteredList('history');
      }
      
      storageWrapper.set({ 
        'stb_current_history_status_filter': currentHistoryStatusFilter,
        'stb_current_history_jenis_filter': currentHistoryJenisFilter
      });
    });
  }
  
  function updateSubmittedFilterButtons() {
    if (!submittedFiltersContainer) return;
    
    submittedFiltersContainer.querySelectorAll('button').forEach(b => {
      b.style.opacity = '0.4';
      b.style.border = '2px solid transparent';
    });
    
    if (currentSubmittedStatusFilter !== 'ALL') {
      let activeId = 'filterSubmittedAll';
      if (currentSubmittedStatusFilter === 'LULUS') activeId = 'filterSubmittedLulus';
      else if (currentSubmittedStatusFilter === 'TOLAK') activeId = 'filterSubmittedTolak';
      else if (currentSubmittedStatusFilter === 'PENDING') activeId = 'filterSubmittedPending';
      
      const activeBtn = document.getElementById(activeId);
      if (activeBtn) {
        activeBtn.style.opacity = '1';
        activeBtn.style.border = '2px solid #000000';
      }
    } else {
      const allBtn = document.getElementById('filterSubmittedAll');
      if (allBtn) {
        allBtn.style.opacity = '1';
        allBtn.style.border = '2px solid #000000';
      }
    }
    
    if (currentSubmittedJenisFilter !== 'ALL') {
      let activeId = 'filterSubmittedAll';
      if (currentSubmittedJenisFilter === 'BARU') activeId = 'filterSubmittedJenisBaru';
      else if (currentSubmittedJenisFilter === 'PEMBAHARUAN') activeId = 'filterSubmittedJenisPembaharuan';
      else if (currentSubmittedJenisFilter === 'UBAH MAKLUMAT') activeId = 'filterSubmittedJenisUbahMaklumat';
      else if (currentSubmittedJenisFilter === 'UBAH GRED') activeId = 'filterSubmittedJenisUbahGred';
      
      const activeBtn = document.getElementById(activeId);
      if (activeBtn) {
        activeBtn.style.opacity = '1';
        activeBtn.style.border = '2px solid #000000';
      }
    }
  }
  
  function updateHistoryFilterButtons() {
    if (!historyFiltersContainer) return;
    
    historyFiltersContainer.querySelectorAll('button').forEach(b => {
      b.style.opacity = '0.4';
      b.style.border = '2px solid transparent';
    });
    
    if (currentHistoryStatusFilter !== 'ALL') {
      let activeId = 'filterHistoryStatusAll';
      if (currentHistoryStatusFilter === 'LULUS') activeId = 'filterHistoryStatusLulus';
      else if (currentHistoryStatusFilter === 'TOLAK') activeId = 'filterHistoryStatusTolak';
      else if (currentHistoryStatusFilter === 'PENDING') activeId = 'filterHistoryStatusPending';
      
      const activeBtn = document.getElementById(activeId);
      if (activeBtn) {
        activeBtn.style.opacity = '1';
        activeBtn.style.border = '2px solid #000000';
      }
    } else {
      const allBtn = document.getElementById('filterHistoryStatusAll');
      if (allBtn) {
        allBtn.style.opacity = '1';
        allBtn.style.border = '2px solid #000000';
      }
    }
    
    if (currentHistoryJenisFilter !== 'ALL') {
      let activeId = 'filterHistoryJenisBaru';
      if (currentHistoryJenisFilter === 'PEMBAHARUAN') activeId = 'filterHistoryJenisPembaharuan';
      else if (currentHistoryJenisFilter === 'UBAH MAKLUMAT') activeId = 'filterHistoryJenisUbahMaklumat';
      else if (currentHistoryJenisFilter === 'UBAH GRED') activeId = 'filterHistoryJenisUbahGred';
      
      const activeBtn = document.getElementById(activeId);
      if (activeBtn) {
        activeBtn.style.opacity = '1';
        activeBtn.style.border = '2px solid #000000';
      }
    }
  }
  
  function updateDraftFilterButtons() {
    if (!draftFiltersContainer) return;
    
    draftFiltersContainer.querySelectorAll('button').forEach(b => {
        b.style.opacity = '0.4';
        b.style.border = '2px solid transparent';
    });
    
    let activeBtnId = 'filterBtnAll';
    if (currentDraftFilter !== 'ALL') {
        if (currentDraftFilter === 'BARU') activeBtnId = 'filterBtnBaru';
        else if (currentDraftFilter === 'PEMBAHARUAN') activeBtnId = 'filterBtnPembaharuan';
        else if (currentDraftFilter === 'UBAH MAKLUMAT') activeBtnId = 'filterBtnUbahMaklumat';
        else if (currentDraftFilter === 'UBAH GRED') activeBtnId = 'filterBtnUbahGred';
        else if (currentDraftFilter === 'SPI') activeBtnId = 'filterBtnSpi';
    }
    
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.style.opacity = '1';
        activeBtn.style.border = '2px solid #000000';
    }
  }

  function updateSubmittedBadges(baseSubmittedData) {
    if (!badgeSubmittedAll) return;
    
    const total = baseSubmittedData.length;
    const lulus = baseSubmittedData.filter(item => item.kelulusan && item.kelulusan.includes('LULUS')).length;
    const tolak = baseSubmittedData.filter(item => item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))).length;
    const pending = total - (lulus + tolak);
    
    const jenisBaru = baseSubmittedData.filter(item => item.jenis === 'BARU').length;
    const jenisPembaharuan = baseSubmittedData.filter(item => item.jenis === 'PEMBAHARUAN').length;
    const jenisUbahMaklumat = baseSubmittedData.filter(item => item.jenis === 'UBAH MAKLUMAT').length;
    const jenisUbahGred = baseSubmittedData.filter(item => item.jenis === 'UBAH GRED').length;
    
    if (badgeSubmittedAll) badgeSubmittedAll.textContent = total;
    if (badgeSubmittedLulus) badgeSubmittedLulus.textContent = lulus;
    if (badgeSubmittedTolak) badgeSubmittedTolak.textContent = tolak;
    if (badgeSubmittedPending) badgeSubmittedPending.textContent = pending;
    if (badgeSubmittedJenisBaru) badgeSubmittedJenisBaru.textContent = jenisBaru;
    if (badgeSubmittedJenisPembaharuan) badgeSubmittedJenisPembaharuan.textContent = jenisPembaharuan;
    if (badgeSubmittedJenisUbahMaklumat) badgeSubmittedJenisUbahMaklumat.textContent = jenisUbahMaklumat;
    if (badgeSubmittedJenisUbahGred) badgeSubmittedJenisUbahGred.textContent = jenisUbahGred;
  }
  
  function updateHistoryBadges(data) {
    if (!badgeHistoryAll) return;
    
    const total = data.length;
    const lulus = data.filter(item => item.kelulusan && item.kelulusan.includes('LULUS')).length;
    const tolak = data.filter(item => item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT'))).length;
    const pending = total - (lulus + tolak);
    
    const jenisBaru = data.filter(item => item.jenis === 'BARU').length;
    const jenisPembaharuan = data.filter(item => item.jenis === 'PEMBAHARUAN').length;
    const jenisUbahMaklumat = data.filter(item => item.jenis === 'UBAH MAKLUMAT').length;
    const jenisUbahGred = data.filter(item => item.jenis === 'UBAH GRED').length;
    
    if (badgeHistoryAll) badgeHistoryAll.textContent = total;
    if (badgeHistoryStatusLulus) badgeHistoryStatusLulus.textContent = lulus;
    if (badgeHistoryStatusTolak) badgeHistoryStatusTolak.textContent = tolak;
    if (badgeHistoryStatusPending) badgeHistoryStatusPending.textContent = pending;
    if (badgeHistoryJenisBaru) badgeHistoryJenisBaru.textContent = jenisBaru;
    if (badgeHistoryJenisPembaharuan) badgeHistoryJenisPembaharuan.textContent = jenisPembaharuan;
    if (badgeHistoryJenisUbahMaklumat) badgeHistoryJenisUbahMaklumat.textContent = jenisUbahMaklumat;
    if (badgeHistoryJenisUbahGred) badgeHistoryJenisUbahGred.textContent = jenisUbahGred;
  }

  const dbJenisSelect = document.getElementById('db_jenis');
  if (dbJenisSelect) {
    dbJenisSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const dbPerubahanContainer = document.getElementById('db_perubahan_container');
      const dbPerubahanLabel = document.getElementById('db_perubahan_label');
      const dbPerubahanInput = document.getElementById('db_perubahan_input');
      
      if (!dbPerubahanContainer || !dbPerubahanLabel || !dbPerubahanInput) return;

      if (val === 'UBAH MAKLUMAT') {
        dbPerubahanContainer.style.display = 'block';
        dbPerubahanLabel.textContent = 'Nyatakan Perubahan Maklumat:';
        const ubahMaklumatValue = document.getElementById('input_ubah_maklumat')?.value || '';
        dbPerubahanInput.value = ubahMaklumatValue;
      } else if (val === 'UBAH GRED') {
        dbPerubahanContainer.style.display = 'block';
        dbPerubahanLabel.textContent = 'Nyatakan Perubahan Gred:';
        const ubahGredValue = document.getElementById('input_ubah_gred')?.value || '';
        dbPerubahanInput.value = ubahGredValue;
      } else {
        dbPerubahanContainer.style.display = 'none';
        dbPerubahanInput.value = '';
      }
      
      saveDatabaseFormData();
    });
  }

  const radioInputs = document.querySelectorAll('input[name="jenisApp"]');
  radioInputs.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const val = e.target.value;
      const ubahMaklumatInput = document.getElementById('input_ubah_maklumat');
      const ubahGredInput = document.getElementById('input_ubah_gred');
      if (ubahMaklumatInput) ubahMaklumatInput.style.display = (val === 'ubah_maklumat') ? 'block' : 'none';
      if (ubahGredInput) ubahGredInput.style.display = (val === 'ubah_gred') ? 'block' : 'none';
      saveFormData();
    });
  });

  if (pelulusTukarSyor) {
    pelulusTukarSyor.addEventListener('change', (e) => {
      const val = e.target.value;
      
      if (divPelulusJustifikasi) {
        divPelulusJustifikasi.style.display = (val === 'YA' || val === 'PEMUTIHAN') ? 'block' : 'none';
      }
      
      if (divPelulusDateSpi) {
        divPelulusDateSpi.style.display = (val === 'YA') ? 'block' : 'none';
      }
    });
  }

  if (cbSelesaiLawatan) {
    cbSelesaiLawatan.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (containerLawatan) {
        containerLawatan.style.display = isChecked ? 'block' : 'none';
      }
      
      if (!isChecked) {
        if (dbLawatanTarikh) dbLawatanTarikh.value = '';
        if (dbLawatanSubmitSptb) dbLawatanSubmitSptb.value = '';
        if (dbLawatanSyor) dbLawatanSyor.value = '';
      }
    });
  }

  if (cbNotifyWhatsapp) {
    cbNotifyWhatsapp.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (pelulusWhatsappContainer) {
        pelulusWhatsappContainer.style.display = isChecked ? 'block' : 'none';
      }
      if (!isChecked && dbPelulusWhatsapp) {
        dbPelulusWhatsapp.value = '';
      }
    });
  }

  if (dbSahSyor) {
    dbSahSyor.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      
      if (labelNotifyWhatsapp) {
        labelNotifyWhatsapp.style.display = isChecked ? 'block' : 'none';
      }
      
      if (!isChecked) {
        if (cbNotifyWhatsapp) {
          cbNotifyWhatsapp.checked = false;
        }
        if (pelulusWhatsappContainer) {
          pelulusWhatsappContainer.style.display = 'none';
        }
        if (dbPelulusWhatsapp) {
          dbPelulusWhatsapp.value = '';
        }
      }
    });
  }

  initSystem();

  function saveActiveElement() {
    if (document.activeElement && document.activeElement.id) {
      lastActiveElementId = document.activeElement.id;
      storageWrapper.set({ 
        'stb_last_active_element': lastActiveElementId,
            'stb_last_active_tab': lastActiveTab 
          });
        }
      }

  function restoreActiveElement() {
    if (lastActiveElementId) {
      const element = document.getElementById(lastActiveElementId);
      if (element) {
        setTimeout(() => {
          element.focus();
          if (element.type === 'text' || element.type === 'textarea') {
            element.setSelectionRange(element.value.length, element.value.length);
          }
        }, 100);
      }
    }
  }

  function saveFormState(tabName) {
    if (isRestoring) return;

    const tabContent = document.getElementById(`tab-${tabName}`);
    if (!tabContent) return;

    const state = {};
    tabContent.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.id && !el.id.startsWith('login')) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          state[el.id] = el.checked;
        } else if (el.type !== 'file') { // <-- TAMBAH SYARAT INI
          state[el.id] = el.value;
        }
      }
    });

    formStates[tabName] = state;
    storageWrapper.set({ 'stb_form_states': formStates });
  }

  function restoreFormState(tabName) {
    isRestoring = true;

    if (formStates[tabName]) {
      const state = formStates[tabName];
      const tabContent = document.getElementById(`tab-${tabName}`);
      if (tabContent) {
        tabContent.querySelectorAll('input, select, textarea').forEach(el => {
          if (el.id && state[el.id] !== undefined) {
            if (el.type === 'checkbox' || el.type === 'radio') {
              el.checked = state[el.id];
            } else {
              el.value = state[el.id];
            }
            
            if (el.type === 'radio' || el.classList.contains('.role-cb')) {
              el.dispatchEvent(new Event('change'));
            }
          }
        });
      }
    }

    const syorVal = document.getElementById('db_syor')?.value;
    if (syorVal === 'YA' && dbPautanInput) {
      dbPautanInput.style.backgroundColor = '#fffbeb';
      dbPautanInput.style.borderColor = '#f59e0b';
      dbPautanInput.style.borderWidth = '2px';
    }

    isRestoring = false;
  }

  document.addEventListener('focusin', saveActiveElement);

  // Lencana nama pengguna (Telah dibuang fungsi log keluar dari sini)
  if (userBadge) {
    userBadge.title = "Profil Pengguna"; // Tukar tajuk bila hover
    userBadge.style.cursor = "default";  // Tukar kursor tetikus
  }

 async function logoutUserOnTimeout() {
    if (!currentUser) return; 
    
    // PENGGUNAAN MODAL BARU
    await CustomAppModal.alert(
        "Sesi anda telah tamat tempoh kerana tiada aktiviti selama 1 jam. Anda telah dilog keluar secara automatik demi keselamatan.", 
        "Sesi Tamat", 
        "warning"
    );
    
    await storageWrapper.remove([
      'stb_session', 'stb_form_data', 'stb_pelulus_state', 'stb_last_active_tab',
      'stb_last_active_element', 'stb_form_states', 'stb_search_state', 'stb_search_history_state',
      'stb_has_printed', 'stb_drive_folder_url', 'stb_user_folder_url', 'stb_filter_pengesyor',
      'stb_dashboard_data', 'stb_form_persistence', 'stb_database_persistence',
      'stb_current_submitted_status_filter', 'stb_current_submitted_jenis_filter',
      'stb_current_history_status_filter', 'stb_current_history_jenis_filter',
      'stb_current_draft_filter', 'stb_music_playing', 'stb_bgm_volume', 'stb_sfx_volume'
    ]);
    location.reload();
  }    

  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (currentUser) { 
      inactivityTimer = setTimeout(logoutUserOnTimeout, TIMEOUT_DURATION);
    }
  }

  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, true);
  });
  
  // KOD BARU: Fungsi semak jika hari dah bertukar
  async function checkDayChangeLogout() {
    if (!currentUser) return false;
    
    const storage = await storageWrapper.get(['stb_login_date']);
    const loginDate = storage.stb_login_date;
    const todayStr = new Date().toDateString();
    
    if (loginDate && loginDate !== todayStr) {
      // PENGGUNAAN MODAL BARU
      await CustomAppModal.alert(
          "Sesi anda telah tamat tempoh kerana pertukaran hari. Sila log masuk semula demi keselamatan.", 
          "Sesi Tamat", 
          "warning"
      );
      
      await storageWrapper.remove([
        'stb_session', 'stb_login_date', 'stb_form_data', 'stb_pelulus_state', 'stb_last_active_tab',
        'stb_last_active_element', 'stb_form_states', 'stb_search_state', 'stb_search_history_state',
        'stb_has_printed', 'stb_drive_folder_url', 'stb_user_folder_url', 'stb_filter_pengesyor',
        'stb_dashboard_data', 'stb_form_persistence', 'stb_database_persistence',
        'stb_current_submitted_status_filter', 'stb_current_submitted_jenis_filter',
        'stb_current_history_status_filter', 'stb_current_history_jenis_filter',
        'stb_current_draft_filter', 'stb_music_playing', 'stb_bgm_volume', 'stb_sfx_volume'
      ]);
      location.reload();
      return true;
    }
    return false;
  }

  function setupUserUI() {
    if (!currentUser || !appContainer || !userBadge) return;

    // Pastikan skrin login tertutup
    if (loginScreen) loginScreen.style.display = 'none';
    appContainer.style.display = 'block';
    
    if (anonymousBadge) anonymousBadge.style.display = 'none';
    
    // KEMASKINI: Pastikan fungsi klik YouTube dipasang setiap kali UI dimuatkan (termasuk selepas refresh)
    userBadge.innerText = `👤 ${currentUser.name} (${currentUser.role})`;
    userBadge.title = "Buka Portal YouTube";
    userBadge.style.cursor = "pointer";
    userBadge.onclick = function() {
        if (lastActiveTab !== 'youtube') {
            window.tabSebelumYoutube = lastActiveTab; 
        }
        switchTab('youtube');
    };
    
    let themeColor = getUserColorHex(currentUser.color);
    
    // --- KOD TAMBAHAN: Terapkan warna pengguna ke seluruh sistem & cetakan ---
    document.documentElement.style.setProperty('--theme-color', themeColor);
    
    // Inisialkan aplikasi berdasarkan peranan
    if (!isAppReady) {
      initAppBasedOnRole();
    }
    
    resetInactivityTimer();

    // --- KOD BARU: Download Senarai Pelulus dari Database ---
    console.log("V6.5.2 Memuat turun senarai pelulus untuk notifikasi...");
    fetchWithRetry(SCRIPT_URL + '?action=getUsers&t=' + Date.now(), { 
        method: 'GET',
        redirect: 'follow' // Penting untuk Google Apps Script
    }, 3, 1000)
      .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
      })
      .then(users => {
        usersList = users;
        storageWrapper.set({ 'stb_users_cache': users });
        populateWhatsAppDropdown();
        console.log("V6.5.2 Senarai Pelulus berjaya dikemaskini:", users.length);
      })
      .catch(err => console.error("V6.5.2 Gagal muat turun senarai pengguna:", err));
    // ---------------------------------------------------------
  }

  async function initAppBasedOnRole() {
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    await loadPelulusState(); 
    if (currentUser.role === 'PENGESYOR' || currentUser.role === 'ADMIN') {
      await loadPengesyorState();
      loadFormData();
      setupAutoSaveListeners();
      setupDatabaseAutoSaveListeners();
      loadDatabaseFormData();
    }

    const searchState = await storageWrapper.get(['stb_search_state', 'stb_search_history_state']);
    const searchListInput = document.getElementById('searchListInput');
    const searchHistoryInput = document.getElementById('searchHistoryInput');
    
    if(searchState.stb_search_state && searchListInput) {
      try {
        searchListInput.value = searchState.stb_search_state;
      } catch (e) {
        console.log("V6.5.2 Error setting search input:", e);
      }
    }
    if(searchState.stb_search_history_state && searchHistoryInput) {
      try {
        searchHistoryInput.value = searchState.stb_search_history_state;
      } catch (e) {
        console.log("V6.5.2 Error setting history search input:", e);
      }
    }

    const storage = await storageWrapper.get(['stb_last_active_tab', 'stb_filter_pengesyor']);
    let activeTab = storage.stb_last_active_tab;
    
    const urlParams = getUrlParams();
    if (urlParams.tab) {
      activeTab = urlParams.tab;
      console.log("V6.5.2 Using tab from URL:", activeTab);
    }

    if (!activeTab) {
      if (currentUser.role === 'PENGESYOR') {
        activeTab = 'dashboard';
      } else if (currentUser.role === 'PELULUS') {
        activeTab = 'dashboard';
      } else if (currentUser.role === 'ADMIN') {
        activeTab = 'dashboard';
      } else if (currentUser.role === 'PENGARAH') {
        activeTab = 'admin-dashboard';
      } else if (currentUser.role === 'KETUA SEKSYEN') {
        activeTab = 'admin-dashboard';
      }
    }

    const showProfileTab = (currentUser.role === 'PENGESYOR' || currentUser.role === 'ADMIN');
    
    if (currentUser.role === 'PENGESYOR') {
      tabsContainer.innerHTML = `
        <button class="tab-btn" data-target="dashboard"><span class="tab-icon">📊</span><span class="tab-text">Dashboard</span></button>
        <button class="tab-btn" data-target="tab-tapisan"><span class="tab-icon">📄</span><span class="tab-text">Tapisan Excel</span></button>
        <button class="tab-btn" data-target="tab-bakul"><span class="tab-icon">🛒</span><span class="tab-text">Bakul Permohonan</span></button>
        <button class="tab-btn" data-target="stb"><span class="tab-icon">✓</span><span class="tab-text">Borang Semakan</span></button>
        <button class="tab-btn" data-target="db"><span class="tab-icon">📂</span><span class="tab-text">Input Database</span></button>
        <button class="tab-btn" data-target="drafts"><span class="tab-icon">📋</span><span class="tab-text">Belum Hantar</span></button>
        <button class="tab-btn" data-target="submitted"><span class="tab-icon">✅</span><span class="tab-text">Telah Disyor</span></button>
      `;
      
      const nameField = document.getElementById('db_pengesyor');
      if(nameField) {
        nameField.value = currentUser.name;
        nameField.readOnly = true;
      }
      
      // Kemas kini senarai tab yang dibenarkan
      if(!activeTab || !['dashboard','tab-tapisan','tab-bakul','stb','db','drafts','submitted', 'profile', 'youtube'].includes(activeTab)) {
        activeTab = 'dashboard';
      }

      switchTab(activeTab);

    } else if (currentUser.role === 'PELULUS') {
      tabsContainer.innerHTML = `
        <button class="tab-btn" data-target="dashboard"><span class="tab-icon">📊</span><span class="tab-text">Dashboard</span></button>
        <button class="tab-btn" data-target="inbox"><span class="tab-icon">📥</span><span class="tab-text">1. Inbox</span></button>
        <button class="tab-btn" data-target="pelulus-view"><span class="tab-icon">🔍</span><span class="tab-text">2. Semakan</span></button>
        <button class="tab-btn" data-target="pelulus-action"><span class="tab-icon">⚖️</span><span class="tab-text">3. Keputusan</span></button>
        <button class="tab-btn" data-target="history"><span class="tab-icon">📜</span><span class="tab-text">4. Sejarah</span></button>
      `;
      
      const pelulusNamaField = document.getElementById('pelulus_nama');
      if (pelulusNamaField) pelulusNamaField.value = currentUser.name;
      
      if(!activeTab || !['dashboard','inbox','pelulus-view','pelulus-action','history', 'youtube'].includes(activeTab)) {
        activeTab = 'dashboard';
      }
      
      if (pelulusActiveItem) {
        if (!activeTab || (activeTab !== 'pelulus-action' && activeTab !== 'pelulus-view')) {
          activeTab = 'pelulus-view';
        }
      } else {
        if(activeTab === 'pelulus-view' || activeTab === 'pelulus-action') {
          activeTab = 'dashboard';
        }
      }
      
      switchTab(activeTab);
      
    } else if (currentUser.role === 'ADMIN') {
      tabsContainer.innerHTML = `
        <button class="tab-btn" data-target="admin-dashboard"><span class="tab-icon">👑</span><span class="tab-text">Admin Dashboard</span></button>
      `;
      
      const nameField = document.getElementById('db_pengesyor');
      if(nameField) {
        nameField.value = currentUser.name;
        nameField.readOnly = true;
      }
      
      const pelulusNamaField = document.getElementById('pelulus_nama');
      if (pelulusNamaField) pelulusNamaField.value = currentUser.name;
      
      if(!activeTab || !['admin-dashboard', 'profile'].includes(activeTab)) {
        activeTab = 'admin-dashboard';
      }
      
      switchTab(activeTab);
      
    } else if (currentUser.role === 'PENGARAH' || currentUser.role === 'KETUA SEKSYEN') {
      tabsContainer.innerHTML = `
        <button class="tab-btn" data-target="admin-dashboard"><span class="tab-icon">👑</span><span class="tab-text">Admin Dashboard</span></button>
        <button class="tab-btn" data-target="inbox"><span class="tab-icon">📥</span><span class="tab-text">Belum Syor</span></button>
        <button class="tab-btn" data-target="submitted"><span class="tab-icon">✅</span><span class="tab-text">Telah Syor</span></button>
        <button class="tab-btn" data-target="history"><span class="tab-icon">📜</span><span class="tab-text">Sejarah</span></button>
      `;
      
      const nameField = document.getElementById('db_pengesyor');
      if(nameField) {
        nameField.value = currentUser.name;
        nameField.readOnly = true;
      }
      
      const pelulusNamaField = document.getElementById('pelulus_nama');
      if (pelulusNamaField) pelulusNamaField.value = currentUser.name;
      
      if(!activeTab || !['admin-dashboard','inbox','submitted','history'].includes(activeTab)) {
        activeTab = 'admin-dashboard';
      }
      
      switchTab(activeTab);
      
    } else {
      alert("Role pengguna tidak dikenali.");
    }

    // --- KOD BARU (a): Masukkan elemen slider ke dalam container ---
    if (tabsContainer) {
        let existingSlider = document.getElementById('tabSlider');
        if (!existingSlider) {
            const slider = document.createElement('div');
            slider.className = 'tab-slider';
            slider.id = 'tabSlider';
            tabsContainer.appendChild(slider);
        }
    }
    // -------------------------------------------------------------

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        closeMobileMenu();
        switchTab(this.getAttribute('data-target')); 
      });
    });

    isAppReady = true; 
  }


  // --- KOD BARU (b): Fungsi menggerakkan slider ---
  function updateTabSlider() {
      const tabsContainer = document.getElementById('tabs-container');
      const slider = document.getElementById('tabSlider');
      const activeBtn = tabsContainer ? tabsContainer.querySelector('.tab-btn.active') : null;

      if (slider && activeBtn) {
          // Ambil saiz dan kedudukan butang yang aktif
          slider.style.width = activeBtn.offsetWidth + 'px';
          slider.style.height = activeBtn.offsetHeight + 'px';
          slider.style.left = activeBtn.offsetLeft + 'px';
          slider.style.top = activeBtn.offsetTop + 'px';
          slider.style.opacity = '1'; // Pastikan slider kelihatan
      } else if (slider) {
          // JIKA TIADA TAB AKTIF (Contohnya apabila berada di Portal YouTube)
          // Sembunyikan slider sepenuhnya
          slider.style.opacity = '0';
          slider.style.width = '0px';
          slider.style.height = '0px';
      }
  }

  // Kemaskini apabila skrin berubah saiz
  window.addEventListener('resize', updateTabSlider);
  // ------------------------------------------------


  function switchTab(tabName) {
    closeMobileMenu();
    
    if (lastActiveTab) {
      saveFormState(lastActiveTab);
    }

    document.querySelectorAll('.tab-content').forEach(el => {
      el.style.display = 'none';
    });

    document.querySelectorAll('.tab-btn').forEach(btn => { 
      btn.classList.remove('active');
      if(btn.getAttribute('data-target') === tabName) {
        btn.classList.add('active');
      }
    });

    // --- KOD BARU (c): Panggil fungsi animasi selepas tab ditukar ---
    // Mula bergerak serta merta
    setTimeout(updateTabSlider, 10);
    // Bergerak sekali lagi di pertengahan animasi supaya nampak lebih lancar
    setTimeout(updateTabSlider, 150); 
    // Bergerak apabila butang sudah siap mengembang sepenuhnya (tambah sedikit masa)
    setTimeout(updateTabSlider, 350);
    // Langkah berjaga-jaga terakhir jika browser lambat memproses data (lag)
    setTimeout(updateTabSlider, 600);
    // ---------------------------------------------------------------
    lastActiveTab = tabName;
    storageWrapper.set({ 'stb_last_active_tab': tabName });
    
    if (currentUser) {
      const urlParams = {
        user: (currentUser.name || '').toLowerCase().replace(/\s+/g, '-'),
        tab: tabName
      };
      updateBrowserUrl(urlParams);
    }

    // Ensure search box is always visible except for specific tabs like dashboard, stb, db, pelulus-view, pelulus-action
    const searchBoxEl = document.querySelector('.search-box');
    if (searchBoxEl) {
      const tabsWithSearch = ['drafts', 'submitted', 'inbox', 'history'];
      if (tabsWithSearch.includes(tabName)) {
        searchBoxEl.style.display = 'flex';
      } else {
        searchBoxEl.style.display = 'none';
      }
    }

    // Toggle visibility of specific search inputs based on tab
    const searchListInputContainer = document.getElementById('searchListInput')?.parentElement;
    const searchHistoryInputContainer = document.getElementById('searchHistoryInput')?.parentElement;
    
    if (searchListInputContainer) {
      searchListInputContainer.style.display = (tabName === 'history') ? 'none' : 'flex';
    }
    if (searchHistoryInputContainer) {
      searchHistoryInputContainer.style.display = (tabName === 'history') ? 'flex' : 'none';
    }

    if (submittedFiltersContainer) {
      submittedFiltersContainer.style.display = 'none';
    }
    if (draftFiltersContainer) {
      draftFiltersContainer.style.display = 'none';
    }
    if (historyFiltersContainer) {
      historyFiltersContainer.style.display = 'none';
    }
    if (filterSection) {
      filterSection.style.display = 'none';
    }
    if (pelulusFilterSection) {
      pelulusFilterSection.style.display = 'none';
    }

    if (tabName === 'pelulus-view') {
      if (!pelulusActiveItem) { 
        switchTab(currentUser.role === 'PENGESYOR' ? 'submitted' : 'inbox'); 
        return; 
      }
      const tabPelulusView = document.getElementById('tab-pelulus-view');
      if (tabPelulusView) {
        tabPelulusView.style.display = 'block';
        tabPelulusView.classList.add('active');
      }
      
      let isReadOnly = true;
      if (currentUser.role === 'PELULUS' && !pelulusActiveItem.tarikh_lulus) {
        isReadOnly = false; 
      }
      renderPelulusView(isReadOnly);
      
      setTimeout(() => {
        restoreActiveElement();
      }, 200);
      return;
    }

    if (tabName === 'dashboard') {
      const tabDashboard = document.getElementById('tab-dashboard');
      if (tabDashboard) {
        tabDashboard.style.display = 'block';
        tabDashboard.classList.add('active');
      }
      
      setTimeout(() => {
        initializeTickButtons();
        
        if (!cachedData || cachedData.length === 0) {
           console.log("V6.5.2 Dashboard: Cache kosong, memuat turun data...");
           const listType = (currentUser.role === 'PENGESYOR') ? 'drafts' : 'inbox';
           
           fetchAndRenderList(listType).then(() => {
             isDashboardFirstLoad = true; 
             initializeDashboard();
           }).catch(err => {
             showDashboardNoData();
           });
        } else {
           initializeDashboard();
        }
        
        restoreActiveElement();
      }, 200);
    }
    else if (tabName === 'admin-dashboard') {
      const tabAdminDashboard = document.getElementById('tab-admin-dashboard');
      if (tabAdminDashboard) {
        tabAdminDashboard.style.display = 'block';
        tabAdminDashboard.classList.add('active');
      }
      
      setTimeout(() => {
        loadAdminDashboard();
        restoreActiveElement();
      }, 200);
    }
    else if (tabName === 'profile') {
      const tabProfile = document.getElementById('tab-profile');
      if (tabProfile) {
        tabProfile.style.display = 'block';
        tabProfile.classList.add('active');
      }
      
      setTimeout(() => {
        restoreActiveElement();
      }, 200);
    }
    // =========================================================
    // TAMBAH KOD YOUTUBE DI SINI SUPAYA SEMUA ROLE BOLEH AKSES
    // =========================================================
    else if (tabName === 'youtube') {
      const tabYoutube = document.getElementById('tab-youtube');
      if (tabYoutube) {
        tabYoutube.style.display = 'block';
        tabYoutube.classList.add('active');
        
        // --- KOD TAMBAHAN: Muatkan cache YouTube secara automatik ---
        const youtubeContainer = document.getElementById('youtubeResults');
        // Hanya panggil fungsi jika bekas (container) video masih kosong
        if (youtubeContainer && youtubeContainer.children.length === 0) {
             loadRecentYoutubeCache();
        }
        // -----------------------------------------------------------
      }
    }
    // =========================================================
    // KOD BARU DITAMBAH DI SINI (UNTUK TAPISAN & BAKUL)
    // =========================================================
    else if (tabName === 'tab-tapisan' && currentUser.role === 'PENGESYOR') {
      const tabTapisan = document.getElementById('tab-tapisan');
      if (tabTapisan) {
        tabTapisan.style.display = 'block';
        tabTapisan.classList.add('active');
      }
    }
    else if (tabName === 'tab-bakul' && currentUser.role === 'PENGESYOR') {
      const tabBakul = document.getElementById('tab-bakul');
      if (tabBakul) {
        tabBakul.style.display = 'block';
        tabBakul.classList.add('active');
      }
    }
    // =========================================================
    // TAMAT KOD BARU
    // =========================================================
    else if (currentUser.role === 'PENGESYOR' || currentUser.role === 'ADMIN' || currentUser.role === 'PENGARAH' || currentUser.role === 'KETUA SEKSYEN') {
      if (tabName === 'stb' && (currentUser.role === 'PENGESYOR' || currentUser.role === 'ADMIN')) {
        const tabChecker = document.getElementById('tab-checker');
        if (tabChecker) {
          tabChecker.style.display = 'block';
          tabChecker.classList.add('active');
        }
        
        setTimeout(() => {
          restoreFormState('stb');
          initializeTickButtons();
          restoreActiveElement();
        }, 200);
      }
      else if (tabName === 'db' && (currentUser.role === 'PENGESYOR' || currentUser.role === 'ADMIN')) {
        const tabDatabase = document.getElementById('tab-database');
        if (tabDatabase) {
          tabDatabase.style.display = 'block';
          tabDatabase.classList.add('active');
        }
        
        setTimeout(() => {
          restoreFormState('db');
          initializeTickButtons();
          restoreActiveElement();
        }, 200);
        
        if (driveSection) {
          driveSection.style.display = 'block';
          
          if (driveFolderInfo) {
            driveFolderInfo.style.display = 'block';
          }
          
          updateOpenDriveButton();
          
          if (driveFolderCreated && createdFolderUrl) {
            showDriveFolderLink(createdFolderUrl);
          }
        }
      }
      else if (tabName === 'drafts' && (currentUser.role === 'PENGESYOR' || currentUser.role === 'ADMIN')) {
        const tabList = document.getElementById('tab-list');
        if (tabList) {
          tabList.style.display = 'block';
          tabList.classList.add('active');
        }
        
        if (draftFiltersContainer) {
          draftFiltersContainer.style.display = 'flex';
        }
        
        fetchAndRenderList('drafts');
      }
      else if (tabName === 'submitted') {
        const tabList = document.getElementById('tab-list');
        if (tabList) {
          tabList.style.display = 'block';
          tabList.classList.add('active');
        }
        
        if (submittedFiltersContainer) {
          submittedFiltersContainer.style.display = 'flex';
        }
        
        // For KETUA SEKSYEN, also show pengesyor filter
        if (currentUser.role === 'KETUA SEKSYEN') {
          if (filterSection) {
            filterSection.style.display = 'flex';
            updatePengesyorFilter();
          }
        }
        
        fetchAndRenderList('submitted');
      }
      else if (tabName === 'inbox') {
        const tabList = document.getElementById('tab-list');
        if (tabList) {
          tabList.style.display = 'block';
          tabList.classList.add('active');
        }
        
        if (filterSection) {
          filterSection.style.display = 'flex';
          updatePengesyorFilter();
        }
        
        fetchAndRenderList('inbox');
      }
      else if (tabName === 'history') {
        const tabHistory = document.getElementById('tab-history');
        if (tabHistory) {
          tabHistory.style.display = 'block';
          tabHistory.classList.add('active');
        }
        
        if (historyFiltersContainer) {
          historyFiltersContainer.style.display = 'flex';
        }
        if (pelulusFilterSection) {
          pelulusFilterSection.style.display = 'flex';
          updatePelulusFilter();
        }
        
        fetchAndRenderList('history');
      }
    } 
    else if (currentUser.role === 'PELULUS') {
      if (tabName === 'inbox') {
        const tabList = document.getElementById('tab-list');
        if (tabList) {
          tabList.style.display = 'block';
          tabList.classList.add('active');
        }
        
        if (filterSection) {
          filterSection.style.display = 'flex';
          updatePengesyorFilter();
        }
        
        fetchAndRenderList('inbox');
      }
      else if (tabName === 'pelulus-action') {
        if(!pelulusActiveItem) { 
          switchTab('inbox'); 
          return; 
        } 
        const tabPelulusAction = document.getElementById('tab-pelulus-action');
        if (tabPelulusAction) {
          tabPelulusAction.style.display = 'block';
          tabPelulusAction.classList.add('active');
        }
        
        const actionSummary = document.getElementById('pelulus_action_summary');
        if (actionSummary) actionSummary.innerText = pelulusActiveItem.syarikat; 
        
        setTimeout(() => {
          restoreFormState('pelulus-action');
          restoreActiveElement();
        }, 200);
      }
      else if (tabName === 'history') {
        const tabHistory = document.getElementById('tab-history');
        if (tabHistory) {
          tabHistory.style.display = 'block';
          tabHistory.classList.add('active');
        }
        
        if (historyFiltersContainer) {
          historyFiltersContainer.style.display = 'flex';
        }
        
        fetchAndRenderList('history');
      }
    }

    updateValidationCheckboxDisplay();
  }

  async function createDriveFolder() {
    const syarikat = document.getElementById('db_syarikat')?.value.trim();
    const jenisPermohonan = document.getElementById('db_jenis')?.value;
    const tarikhMohon = document.getElementById('db_start_date')?.value || document.getElementById('borang_tarikh_mohon')?.value;
    const userName = currentUser.name;

    if (!syarikat) {
      await CustomAppModal.alert("Sila isi Nama Syarikat terlebih dahulu.", "Maklumat Diperlukan", "warning");
      return;
    }

    if (!jenisPermohonan) {
      await CustomAppModal.alert("Sila pilih Jenis Permohonan terlebih dahulu.", "Maklumat Diperlukan", "warning");
      return;
    }

    if (!tarikhMohon) {
      await CustomAppModal.alert("Sila isi Tarikh Mohon atau Start Date terlebih dahulu.", "Maklumat Diperlukan", "warning");
      return;
    }

    // --- KOD BARU: MULA PAPARKAN LOADING ANIMATION DI SINI ---
    simulateLoadingWithSteps(
      ['Menghubungi Google Drive...', 'Mencipta Folder Syarikat...', 'Menyusun Sub-folder...', 'Menjana Pautan Kongsi...'],
      'Mencipta Folder Drive'
    );
    // ---------------------------------------------------------

    if (driveStatus) {
      driveStatus.style.display = 'inline-block';
      driveStatus.className = 'drive-status drive-creating';
      driveStatus.innerText = 'Mencipta...';
    }

    if (driveResult) {
      driveResult.innerHTML = '<div style="color: #92400e;">Sedang mencipta folder dalam User Folder...</div>';
    }

    const now = new Date();
    const currentMonth = now.toLocaleString('ms-MY', { month: 'long' });
    const currentYear = now.getFullYear();
    const monthYearFolder = `${currentMonth.toUpperCase()} ${currentYear}`;

    let formattedDate = '';
    try {
      const tarikhDate = new Date(tarikhMohon);
      formattedDate = tarikhDate.toLocaleDateString('ms-MY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');
    } catch (e) {
      formattedDate = tarikhMohon;
    }

    const companyFolderName = syarikat.toUpperCase();
    const subfolderName = `${jenisPermohonan.toUpperCase()} - ${formattedDate}`;

    const payload = {
      action: 'createDriveFolder',
      month_year: monthYearFolder,
      company_name: companyFolderName,
      application_type: subfolderName,
      user_name: userName,
      main_folder_id: mainFolderId,
      email: currentUser ? currentUser.email : ''
    };

    try {
      const response = await fetchWithRetry(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }, 3, 1000);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // --- KOD BARU: TUTUP LOADING JIKA BERJAYA ---
      hideLoading();
      
      if (result.success) {
        await playSuccessSound();
        
        driveFolderCreated = true;
        createdFolderUrl = result.folder_url;
        userFolderUrl = result.user_folder_url;
        
        await storageWrapper.set({ 
          'stb_drive_folder_url': createdFolderUrl,
          'stb_user_folder_url': userFolderUrl 
        });
        
        const dbPautan = document.getElementById('db_pautan');
        if (dbPautan) {
          dbPautan.value = createdFolderUrl;
        }
        
        if (driveStatus) {
          driveStatus.className = 'drive-status drive-success';
          driveStatus.innerText = 'Berjaya';
        }
        
        showDriveFolderLink(createdFolderUrl, userFolderUrl);
        
        if (cbCreateDriveFolder) {
          cbCreateDriveFolder.checked = true;
        }
        
        updateOpenDriveButton();
        
        await CustomAppModal.alert("Folder Drive berjaya dicipta dalam User Folder System!<br>Pautan telah dimasukkan secara automatik.", "Berjaya", "success");
        
      } else {
        throw new Error(result.message || 'Gagal mencipta folder');
      }
      
    } catch (error) {
      console.error("V6.5.2 Error creating drive folder:", error);
      
      // --- KOD BARU: TUTUP LOADING JIKA RALAT ---
      hideLoading();
      
      await playErrorSound();
      
      if (driveStatus) {
        driveStatus.className = 'drive-status drive-error';
        driveStatus.innerText = 'Gagal';
      }
      
      if (driveResult) {
        driveResult.innerHTML = `<div style="color: #991b1b;">Ralat: ${error.message}</div>`;
      }
      
      await CustomAppModal.alert(`Gagal mencipta folder: ${error.message}`, "Ralat", "error");
    }
  }

  function showDriveFolderLink(folderUrl, userFolderUrl) {
    if (!driveResult) return;

    const syarikat = document.getElementById('db_syarikat')?.value || '';
    const userName = currentUser.name;

    driveResult.innerHTML = `
      <div style="margin-top: 10px; padding: 10px; background: #dcfce7; border-radius: 8px; border: 1px solid #22c55e;">
        <div style="font-weight: bold; color: #166534; margin-bottom: 5px;">✓ Folder berjaya dicipta dalam User Folder System!</div>
        <div style="margin-bottom: 8px;">
          <a href="${folderUrl}" target="_blank" class="drive-link">
            📂 Klik untuk buka folder syarikat
          </a>
        </div>
        <div style="margin-bottom: 5px;">
          <a href="${userFolderUrl}" target="_blank" class="drive-link" style="background: #dbeafe;">
            👤 Klik untuk buka folder user: ${userName}
          </a>
        </div>
        <div style="font-size: 0.8rem; color: #4b5563; margin-top: 5px;">
          Folder: ${syarikat}
        </div>
        <div style="font-size: 0.7rem; color: #6b7280; margin-top: 3px;">
          Pautan telah dimasukkan ke dalam "Pautan Dokumen"
        </div>
      </div>
    `;
  }

  function updateOpenDriveButton() {
    const dbPautan = document.getElementById('db_pautan')?.value;
    const btnOpenDrive = document.getElementById('btnOpenDriveFolder');

    if (btnOpenDrive) {
      if (dbPautan && dbPautan.trim() !== '') {
        btnOpenDrive.disabled = false;
        btnOpenDrive.title = "Buka Folder Drive";
      } else {
        btnOpenDrive.disabled = true;
        btnOpenDrive.title = "Sila cipta folder terlebih dahulu";
      }
    }
  }

  function savePelulusState() {
    if (isRestoring) return;
    const state = {
      activeItem: pelulusActiveItem,
      keputusan: document.getElementById('pelulus_keputusan')?.value || '',
      alasan: document.getElementById('pelulus_alasan')?.value || '',
      catatan: document.getElementById('pelulus_catatan')?.value || ''
    };
    storageWrapper.set({ 'stb_pelulus_state': state });
  }

  async function loadPelulusState() {
    const stored = await storageWrapper.get(['stb_pelulus_state']);
    const state = stored.stb_pelulus_state;
    if(state && state.activeItem) {
      pelulusActiveItem = state.activeItem; 
      const elKeputusan = document.getElementById('pelulus_keputusan');
      if(elKeputusan) {
        elKeputusan.value = state.keputusan || '';
        
        const alasanEl = document.getElementById('pelulus_alasan');
        if (alasanEl) alasanEl.value = state.alasan || '';
        
        const catatanEl = document.getElementById('pelulus_catatan');
        if (catatanEl) catatanEl.value = state.catatan || '';
        
        const evt = new Event('change');
        elKeputusan.dispatchEvent(evt);
      }
    }
    updateValidationCheckboxDisplay();
  }

  const pelKeputusan = document.getElementById('pelulus_keputusan');
  if(pelKeputusan) {
    pelKeputusan.addEventListener('change', (e) => {
      const val = e.target.value;
      const divAlasan = document.getElementById('div_alasan');
      const alasanSelect = document.getElementById('pelulus_alasan');
      
      if(divAlasan) {
        divAlasan.style.display = (val.includes('TOLAK') || val === 'SIASAT') ? 'block' : 'none';
      }
      
      if(alasanSelect && (val.includes('LULUS') || val === '')) {
        alasanSelect.value = '';
        savePelulusState();
      }

      if (labelPelulusSahLulus) {
        if (val !== '') {
          labelPelulusSahLulus.style.display = 'block';
        } else {
          labelPelulusSahLulus.style.display = 'none';
          if (pelulusSahLulus) pelulusSahLulus.checked = false;
        }
      }
    });
  }

  ['pelulus_keputusan', 'pelulus_alasan', 'pelulus_catatan'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.addEventListener('input', savePelulusState);
      el.addEventListener('change', savePelulusState);
    }
  });

  function savePengesyorState() {
    if (isRestoring || (currentUser && currentUser.role !== 'PENGESYOR' && currentUser.role !== 'ADMIN')) return;

    const formData = {};
    document.querySelectorAll('input, select, textarea').forEach(el => {
      if(el.id && !el.id.startsWith('pelulus_') && el.id !== 'searchListInput' && el.id !== 'searchHistoryInput' && !el.id.startsWith('login')) {
        if (el.type === 'text' || el.type === 'textarea') {
          if (el.id.includes('pautan') || el.id.includes('link')) {
            formData[el.id] = el.value;
          } else {
            formData[el.id] = el.value.toUpperCase();
          }
        } else {
          formData[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        }
      }
    });

    const selectedRadio = document.querySelector('input[name="jenisApp"]:checked');
    if(selectedRadio) formData['jenisApp'] = selectedRadio.value;

    const personnel = [];
    document.querySelectorAll('.person-card').forEach(card => {
      const roles = [];
      card.querySelectorAll('.role-cb:checked').forEach(cb => roles.push(cb.value));
      personnel.push({
        name: card.querySelector('.p-name')?.value.toUpperCase() || '',
        isCompany: card.querySelector('.is-company')?.checked || false,
        roles: roles,
        s_ic: card.querySelector('.status-ic')?.value.toUpperCase() || '',
        s_sb: card.querySelector('.status-sb')?.value.toUpperCase() || '',
        s_epf: card.querySelector('.status-epf')?.value.toUpperCase() || ''
      });
    });
    formData.personnel = personnel;
    storageWrapper.set({ 'stb_form_data': formData });
  }

  async function loadPengesyorState() {
    isRestoring = true; 
    const stored = await storageWrapper.get(['stb_form_data']);
    const data = stored.stb_form_data;

    const personnelListEl = document.getElementById('personnelList');
    if (personnelListEl) personnelListEl.innerHTML = ''; 

    if(data) {
      for(const key in data) {
        if(key === 'personnel') continue;
        const el = document.getElementById(key);
        if(el) {
          if(el.type === 'checkbox') el.checked = data[key];
          else el.value = data[key];
        }
      }
      
      if(data.jenisApp) {
        const radio = document.querySelector(`input[name="jenisApp"][value="${data.jenisApp}"]`);
        if(radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      }

      if(data.personnel && data.personnel.length > 0) {
        data.personnel.forEach(p => addPerson(p));
      } else {
        addPerson();
      }
    } else {
      addPerson(); 
    }

    const syorVal = document.getElementById('db_syor')?.value;
    if (syorVal === 'YA' && dbPautanInput) {
      dbPautanInput.style.backgroundColor = '#fffbeb';
      dbPautanInput.style.borderColor = '#f59e0b';
      dbPautanInput.style.borderWidth = '2px';
    }

    updateOpenDriveButton();

    isRestoring = false;

    updateValidationCheckboxDisplay();
  }

  function updateValidationCheckboxDisplay() {
    const dbSyorStatusVal = document.getElementById('db_syor_status')?.value || '';
    if (labelDbSahSyor) {
      if (dbSyorStatusVal !== '') {
        labelDbSahSyor.style.display = 'block';
      } else {
        labelDbSahSyor.style.display = 'none';
        if (dbSahSyor) dbSahSyor.checked = false;
      }
    }

    const pelulusKeputusanVal = document.getElementById('pelulus_keputusan')?.value || '';
    if (labelPelulusSahLulus) {
      if (pelulusKeputusanVal !== '') {
        labelPelulusSahLulus.style.display = 'block';
      } else {
        labelPelulusSahLulus.style.display = 'none';
        if (pelulusSahLulus) pelulusSahLulus.checked = false;
      }
    }
  }

  if(btnSyncToDb) {
    btnSyncToDb.addEventListener('click', () => {
      const syarikat = document.getElementById('borang_syarikat')?.value || '';
      const cidb = document.getElementById('borang_cidb')?.value || '';
      const tMohon = document.getElementById('borang_tarikh_mohon')?.value || '';
      const tatatertib = document.getElementById('borang_tatatertib')?.value || '';
      const gred = document.getElementById('borang_gred')?.value || '';
      const justifikasi = document.getElementById('borang_justifikasi')?.value || '';
      
      const dbSyarikat = document.getElementById('db_syarikat');
      const dbCidb = document.getElementById('db_cidb');
      const dbStartDate = document.getElementById('db_start_date');
      const dbTatatertib = document.getElementById('db_tatatertib');
      const dbGred = document.getElementById('db_gred');
      const dbJustifikasi = document.getElementById('db_justifikasi');
      
      if (dbSyarikat) dbSyarikat.value = syarikat;
      if (dbCidb) dbCidb.value = cidb;
      if (dbStartDate) dbStartDate.value = tMohon; 
      if (dbTatatertib) dbTatatertib.value = tatatertib;
      if (dbGred) dbGred.value = gred;
      if (dbJustifikasi) dbJustifikasi.value = justifikasi;

      const selectedType = document.querySelector('input[name="jenisApp"]:checked')?.value;
      if(selectedType) {
        const dropdown = document.getElementById('db_jenis');
        let dbVal = "";

        if(selectedType === 'baru') dbVal = "BARU";
        if(selectedType === 'pembaharuan') dbVal = "PEMBAHARUAN";
        if(selectedType === 'ubah_maklumat') dbVal = "UBAH MAKLUMAT";
        if(selectedType === 'ubah_gred') dbVal = "UBAH GRED";
        if(dbVal && dropdown) dropdown.value = dbVal;
        
        const dbPerubahanInput = document.getElementById('db_perubahan_input');
        if (dbPerubahanInput) {
          if (selectedType === 'ubah_maklumat') {
            const ubahMaklumatValue = document.getElementById('input_ubah_maklumat')?.value || '';
            dbPerubahanInput.value = ubahMaklumatValue;
          } else if (selectedType === 'ubah_gred') {
            const ubahGredValue = document.getElementById('input_ubah_gred')?.value || '';
            dbPerubahanInput.value = ubahGredValue;
          }
        }
      }

      saveDatabaseFormData();
      switchTab('db');
    });
  }

  const btnBackToForm = document.getElementById('btnBackToForm');
  if(btnBackToForm) {
    btnBackToForm.addEventListener('click', () => {
      switchTab('stb');
    });
  }

  const btnViewBack = document.getElementById('btnViewBack');
  if(btnViewBack) {
    btnViewBack.addEventListener('click', () => {
      if (currentUser.role === 'PENGESYOR') {
        switchTab('submitted');
      } else if (currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN' || currentUser.role === 'PENGARAH') {
        switchTab('inbox');
      } else {
        if (pelulusActiveItem && pelulusActiveItem.tarikh_lulus) {
          switchTab('history');
        } else {
          switchTab('inbox');
        }
      }
    });
  }

  const btnToForm = document.getElementById('btnToForm');
  if(btnToForm) btnToForm.addEventListener('click', () => switchTab('stb'));

  const btnToApproval = document.getElementById('btnToApproval');
  if(btnToApproval) btnToApproval.addEventListener('click', () => switchTab('pelulus-action'));

  const btnPelulusBack = document.getElementById('btnPelulusBack');
  if(btnPelulusBack) btnPelulusBack.addEventListener('click', () => switchTab('pelulus-view'));

  const btnRefreshList = document.getElementById('btnRefreshList');
  if(btnRefreshList) btnRefreshList.addEventListener('click', () => {
    if (currentUser.role === 'PENGESYOR') {
      fetchAndRenderList('drafts');
    } else {
      fetchAndRenderList('inbox');
    }
  });

  if(openFullBtn) {
    openFullBtn.addEventListener('click', () => { 
      saveFormData();
      if (lastActiveTab) {
        saveFormState(lastActiveTab);
      }
      
      const fullViewUrl = 'index.html?view=full';
      window.open(fullViewUrl, '_blank'); 
    });
  }
  if(openFullBtnPelulus) {
    openFullBtnPelulus.addEventListener('click', () => { 
      savePelulusState();
      
      const fullViewUrl = 'index.html?view=full';
      window.open(fullViewUrl, '_blank'); 
    });
  }
  
  if(btnAdminFullView) {
    btnAdminFullView.addEventListener('click', () => {
      const fullViewUrl = 'index.html?view=full';
      window.open(fullViewUrl, '_blank');
    });
  }
  
  const btnLogoutTop = document.getElementById('btnLogoutTop');
  if (btnLogoutTop) {
    btnLogoutTop.addEventListener('click', async () => {
      // PENGGUNAAN MODAL BARU
      const isConfirmed = await CustomAppModal.confirm(
          "Adakah anda pasti mahu log keluar dari sistem?", 
          "Log Keluar", 
          "warning", 
          "Ya, Log Keluar", 
          true // true = Butang akan jadi warna merah (Danger)
      );

      if(isConfirmed) {
        await storageWrapper.remove([
          'stb_session', 'stb_form_data', 'stb_pelulus_state', 'stb_last_active_tab',
          'stb_last_active_element', 'stb_form_states', 'stb_search_state',
          // ... array pemadaman seperti asal ...
          'stb_current_draft_filter', 'stb_music_playing', 'stb_bgm_volume', 'stb_sfx_volume'
        ]);
        location.reload();
      }
    });
  }

  const btnResetTab1 = document.getElementById('btnResetTab1');
  if(btnResetTab1) btnResetTab1.addEventListener('click', async () => {
    const isReset = await CustomAppModal.confirm("Anda pasti mahu set semula (reset) semua maklumat dalam borang ini?", "Reset Borang", "warning", "Ya, Reset", true);
    if(isReset) await resetForm();
  });
  
  const btnResetTab2 = document.getElementById('btnResetTab2');
  if(btnResetTab2) btnResetTab2.addEventListener('click', async () => {
    const isReset = await CustomAppModal.confirm("Anda pasti mahu set semula (reset) semua maklumat dalam borang ini?", "Reset Borang", "warning", "Ya, Reset", true);
    if(isReset) await resetForm();
  });

  async function resetForm() {
    await storageWrapper.remove([
      'stb_form_data', 
      'stb_form_states', 
      'stb_has_printed', 
      'stb_drive_folder_url', 
      'stb_user_folder_url', 
      'stb_extracted_pdf_data',
      'stb_form_persistence',
      'stb_database_persistence'
    ]);

    document.querySelectorAll('input, select').forEach(el => {
      if (el.id !== 'db_pengesyor' && el.id !== 'pelulus_nama' && !el.id.startsWith('login')) {
        if(el.type === 'checkbox' || el.type === 'radio') el.checked = false;
        else el.value = '';
      }
    });

    if (dbPautanInput) {
      dbPautanInput.style.backgroundColor = '';
      dbPautanInput.style.borderColor = '';
      dbPautanInput.style.borderWidth = '';
    }

    if (btnSyncToDb) {
      btnSyncToDb.style.display = 'none';
    }

    hasPrinted = false;
    driveFolderCreated = false;
    createdFolderUrl = '';
    userFolderUrl = '';
    extractedPdfData = null;

    const ubahMaklumatInput = document.getElementById('input_ubah_maklumat');
    const ubahGredInput = document.getElementById('input_ubah_gred');
    if (ubahMaklumatInput) ubahMaklumatInput.style.display = 'none';
    if (ubahGredInput) ubahGredInput.style.display = 'none';

    const personnelListEl = document.getElementById('personnelList');
    if (personnelListEl) personnelListEl.innerHTML = '';

    if (driveResult) driveResult.innerHTML = '';
    if (driveStatus) {
      driveStatus.style.display = 'none';
    }

    clearPdfData();

    updateOpenDriveButton();

    addPerson();
    alert("Borang telah diset semula.");

    updateValidationCheckboxDisplay();
  }

  function checkUnsavedData() {
    const borangFields = [
      'borang_syarikat', 'borang_cidb', 'borang_gred', 'borang_tarikh_mohon',
      'borang_tatatertib', 'borang_justifikasi', 'spkkDuration', 'stbDuration'
    ];

    const dbFields = ['db_syarikat', 'db_cidb', 'db_gred'];

    let hasData = false;

    borangFields.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value.trim() !== '') {
        hasData = true;
      }
    });

    dbFields.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value.trim() !== '') {
        hasData = true;
      }
    });

    const personCards = document.querySelectorAll('.person-card');
    personCards.forEach(card => {
      const name = card.querySelector('.p-name')?.value;
      if (name && name.trim() !== '') {
        hasData = true;
      }
    });

    return hasData;
  }

  async function resetFormForEdit() {
    const fieldsToClear = [
      'borang_syarikat', 'borang_cidb', 'borang_gred', 'borang_tarikh_mohon',
      'borang_tatatertib', 'borang_justifikasi', 'spkkDuration', 'stbDuration', 'ssm_date_input',
      'ssm_status', 'bank_date_input', 'bank_sign_input', 'bank_status_input',
      'doc_carta_status', 'doc_peta_status', 'doc_gambar_status', 'doc_sewa_status',
      'kwsp_date_1', 'kwsp_s1', 'kwsp_date_2', 'kwsp_s2', 'kwsp_date_3', 'kwsp_s3',
      'db_status_hantar_spi',
      'borang_no_telefon',
      'input_ubah_maklumat', 'input_ubah_gred'
    ];

    fieldsToClear.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    document.querySelectorAll('input[name="jenisApp"]').forEach(radio => {
      radio.checked = false;
    });
    
    const statusDisp = document.getElementById('db_status_hantar_display');
    if (statusDisp) statusDisp.style.display = 'none';
    
    const ubahMaklumatInput = document.getElementById('input_ubah_maklumat');
    const ubahGredInput = document.getElementById('input_ubah_gred');
    if (ubahMaklumatInput) ubahMaklumatInput.style.display = 'none';
    if (ubahGredInput) ubahGredInput.style.display = 'none';

    const personnelListEl = document.getElementById('personnelList');
    if (personnelListEl) personnelListEl.innerHTML = '';

    addPerson();

    await storageWrapper.remove([
      'stb_form_data', 
      'stb_drive_folder_url', 
      'stb_user_folder_url', 
      'stb_extracted_pdf_data',
      'stb_form_persistence',
      'stb_database_persistence'
    ]);

    console.log("V6.5.2 Borang telah direset untuk edit.");
  }

  // === PENAMBAHBAIKAN: DEBOUNCING UNTUK CARIAN LEBIH LANCAR ===
  let searchTimeoutList;
  const searchInput = document.getElementById('searchListInput');
  if(searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeoutList);
      searchTimeoutList = setTimeout(() => {
          const val = e.target.value;
          storageWrapper.set({ 'stb_search_state': val }); 
          if(activeListType) renderFilteredList(activeListType);
      }, 350); // Sistem tunggu 350ms (lepas berhenti menaip) sebelum render
    });
  }

  let searchTimeoutHistory;
  const searchHistoryInput = document.getElementById('searchHistoryInput');
  if(searchHistoryInput) {
    searchHistoryInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeoutHistory);
      searchTimeoutHistory = setTimeout(() => {
          const val = e.target.value;
          storageWrapper.set({ 'stb_search_history_state': val }); 
          if(activeListType) renderFilteredList(activeListType);
      }, 350);
    });
  }

  function fetchAndRenderList(listType) {
    if (!listStatus) return;

    activeListType = listType; 

    simulateLoadingWithSteps(
      [
        'Menyambung ke pelayan...',
        'Memuat turun data terkini...',
        'Memproses rekod...',
        'Menyusun senarai...',
        'Menyiapkan paparan...'
      ],
      'Muat turun data'
    );

    if (cachedData.length > 0) {
      renderFilteredList(listType);
      listStatus.innerText = `Using cached data (${cachedData.length} records)`;
      hideLoading();
    }

    return fetchWithRetry(SCRIPT_URL + '?action=getData&t=' + Date.now(), {
      method: 'GET',
      redirect: 'follow'
    }, 3, 1000)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        cachedData = data;
        
        storageWrapper.set({ 
          'stb_data_cache': data,
          'stb_cache_timestamp': Date.now()
        });
        
        updateDynamicYears(data);
        
        if (currentUser.role === 'PELULUS' || currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN' || currentUser.role === 'PENGARAH') {
          updatePengesyorFilter();
        }
        
        renderFilteredList(listType);
        listStatus.innerText = `Kemaskini: ${data.length} rekod`;
        
        setTimeout(() => {
          hideLoading();
        }, 500);
        
        return data;
      })
      .catch(err => {
        console.error("V6.5.2 Fetch list error:", err);
        if (cachedData.length > 0) {
          if (currentUser.role === 'PELULUS' || currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN' || currentUser.role === 'PENGARAH') {
            updatePengesyorFilter();
          }
          
          renderFilteredList(listType);
          listStatus.innerText = `Using cached data (${cachedData.length} records) - Offline mode`;
        } else {
          listStatus.innerText = "Gagal memuat data.";
        }
        hideLoading();
        throw err;
      });
  }

  function renderFilteredList(type) {
    const listId = type === 'history' ? 'historyList' : 'applicationsList';
    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = '';

    if (!currentUser || !cachedData) {
      list.innerHTML = '<div style="padding:10px; text-align:center; color:#777;">Tiada data pengguna.</div>';
      return;
    }

    const user = currentUser.name.toUpperCase();
    let filtered = [];

    if (type === 'drafts') {
      filtered = cachedData.filter(i => (!i.tarikh_syor) && (!i.pengesyor || i.pengesyor.toUpperCase() === user));
    }
    else if (type === 'submitted') {
      if (currentUser.role === 'PENGESYOR') {
        filtered = cachedData.filter(i => i.tarikh_syor && i.pengesyor && i.pengesyor.toUpperCase() === user);
      } else if (currentUser.role === 'KETUA SEKSYEN') {
        // KETUA SEKSYEN: Telah disyor tetapi belum diluluskan (Inbox Pelulus)
        filtered = cachedData.filter(i => i.tarikh_syor && (!i.tarikh_lulus || i.tarikh_lulus === ''));
      } else {
        filtered = cachedData.filter(i => i.tarikh_syor && i.tarikh_lulus);
      }
    }
     else if (type === 'inbox') {
      	// Filter logic for inbox
      if (currentUser.role === 'KETUA SEKSYEN') {
        // Untuk Ketua Seksyen, "Belum Syor" bermaksud semua rekod yang belum ada tarikh_syor (dari SEMUA pengesyor)
        filtered = cachedData.filter(i => !i.tarikh_syor);
      } else {
        // Original logic for Pelulus, Pengarah: Has been syor but not yet lulus
        filtered = cachedData.filter(i => i.tarikh_syor && (!i.tarikh_lulus || i.tarikh_lulus === ''));
      }
    }    else if (type === 'history') {
      if (currentUser.role === 'PELULUS') {
        filtered = cachedData.filter(i => i.tarikh_lulus && i.pelulus && i.pelulus.toUpperCase() === user);
      } else {
        filtered = cachedData.filter(i => i.tarikh_lulus);
      }
    }

    filtered = filtered.filter(item => item.syarikat && item.syarikat.trim() !== "");
    
    if (type === 'submitted') {
      updateSubmittedBadges(filtered);
    }
    
    if (type === 'drafts' || type === 'inbox') {
      const countAll = filtered.length;
      const countBaru = filtered.filter(item => item.jenis === 'BARU').length;
      const countPembaharuan = filtered.filter(item => item.jenis === 'PEMBAHARUAN').length;
      const countUbahMaklumat = filtered.filter(item => item.jenis === 'UBAH MAKLUMAT').length;
      const countUbahGred = filtered.filter(item => item.jenis === 'UBAH GRED').length;
      const countSpi = filtered.filter(item => item.date_submit && item.date_submit.trim() !== '').length;
      
      if (badgeAll) badgeAll.textContent = countAll;
      if (badgeBaru) badgeBaru.textContent = countBaru;
      if (badgePembaharuan) badgePembaharuan.textContent = countPembaharuan;
      if (badgeUbahMaklumat) badgeUbahMaklumat.textContent = countUbahMaklumat;
      if (badgeUbahGred) badgeUbahGred.textContent = countUbahGred;
      if (badgeSpi) badgeSpi.textContent = countSpi;
    }

    if (type === 'history') {
      updateHistoryBadges(filtered);
    }

    if (type === 'history') {
      if (historyMonthFilter && historyYearFilter) {
        const selectedMonth = parseInt(historyMonthFilter.value);
        const selectedYear = parseInt(historyYearFilter.value);
        
        if (selectedMonth && selectedYear) {
          filtered = filtered.filter(item => {
            let dateToUse = null;
            if (item.start_date) dateToUse = new Date(item.start_date);
            else if (item.tarikh_lulus) dateToUse = new Date(item.tarikh_lulus);
            else if (item.date_submit) dateToUse = new Date(item.date_submit);
            
            if (!dateToUse || isNaN(dateToUse)) return true;
            return dateToUse.getMonth() + 1 === selectedMonth && dateToUse.getFullYear() === selectedYear;
          });
        } else if (selectedYear) {
          filtered = filtered.filter(item => {
            let dateToUse = null;
            if (item.start_date) dateToUse = new Date(item.start_date);
            else if (item.tarikh_lulus) dateToUse = new Date(item.tarikh_lulus);
            else if (item.date_submit) dateToUse = new Date(item.date_submit);
            
            if (!dateToUse || isNaN(dateToUse)) return true;
            return dateToUse.getFullYear() === selectedYear;
          });
        }
      }
    } else if (listFilterMonth && listFilterYear) {
      const selectedMonth = parseInt(listFilterMonth.value);
      const selectedYear = parseInt(listFilterYear.value);
      
      if (selectedMonth && selectedYear) {
        filtered = filtered.filter(item => {
          let dateToUse = null;
          if (item.start_date) dateToUse = new Date(item.start_date);
          else if (item.tarikh_lulus) dateToUse = new Date(item.tarikh_lulus);
          else if (item.date_submit) dateToUse = new Date(item.date_submit);
          
          if (!dateToUse || isNaN(dateToUse)) return true;
          return dateToUse.getMonth() + 1 === selectedMonth && dateToUse.getFullYear() === selectedYear;
        });
      } else if (selectedYear) {
        filtered = filtered.filter(item => {
          let dateToUse = null;
          if (item.start_date) dateToUse = new Date(item.start_date);
          else if (item.tarikh_lulus) dateToUse = new Date(item.tarikh_lulus);
          else if (item.date_submit) dateToUse = new Date(item.date_submit);
          
          if (!dateToUse || isNaN(dateToUse)) return true;
          return dateToUse.getFullYear() === selectedYear;
        });
      }
    }

    // Separate search logic for history and other tabs
    let searchVal = '';
    if (type === 'history') {
      const searchHistoryInput = document.getElementById('searchHistoryInput');
      searchVal = searchHistoryInput ? searchHistoryInput.value.trim().toUpperCase() : '';
    } else {
      const searchListInput = document.getElementById('searchListInput');
      searchVal = searchListInput ? searchListInput.value.trim().toUpperCase() : '';
    }
    
    if(searchVal) {
      filtered = filtered.filter(item => {
        const syarikat = item.syarikat ? item.syarikat.toUpperCase() : '';
        const cidb = item.cidb ? String(item.cidb).toUpperCase() : '';
        return syarikat.includes(searchVal) || cidb.includes(searchVal);
      });
    }
    
    if ((type === 'drafts' || type === 'inbox') && currentDraftFilter !== 'ALL') {
      if (currentDraftFilter === 'SPI') {
        filtered = filtered.filter(item => item.date_submit && item.date_submit.trim() !== '');
      } else {
        filtered = filtered.filter(item => item.jenis === currentDraftFilter);
      }
    }
    
    if (type === 'submitted') {
      if (currentSubmittedStatusFilter !== 'ALL') {
        if (currentSubmittedStatusFilter === 'LULUS') {
          filtered = filtered.filter(item => item.kelulusan && item.kelulusan.includes('LULUS'));
        } else if (currentSubmittedStatusFilter === 'TOLAK') {
          filtered = filtered.filter(item => item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT')));
        } else if (currentSubmittedStatusFilter === 'PENDING') {
          filtered = filtered.filter(item => !item.kelulusan || item.kelulusan === '');
        }
      }
      if (currentSubmittedJenisFilter !== 'ALL') {
        filtered = filtered.filter(item => item.jenis === currentSubmittedJenisFilter);
      }
    }
    
    if (type === 'history') {
      if (currentHistoryStatusFilter !== 'ALL') {
        if (currentHistoryStatusFilter === 'LULUS') {
          filtered = filtered.filter(item => item.kelulusan && item.kelulusan.includes('LULUS'));
        } else if (currentHistoryStatusFilter === 'TOLAK') {
          filtered = filtered.filter(item => item.kelulusan && (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT')));
        } else if (currentHistoryStatusFilter === 'PENDING') {
          filtered = filtered.filter(item => !item.kelulusan || item.kelulusan === '');
        }
      }
      if (currentHistoryJenisFilter !== 'ALL') {
        filtered = filtered.filter(item => item.jenis === currentHistoryJenisFilter);
      }
    }

    if ((type === 'inbox' || type === 'submitted' || type === 'history') && (currentUser.role === 'PELULUS' || currentUser.role === 'KETUA SEKSYEN' || currentUser.role === 'PENGARAH')) {
      storageWrapper.get(['stb_filter_pengesyor', 'stb_filter_pelulus']).then(result => {
        if (type !== 'history' && result.stb_filter_pengesyor) {
          filtered = filtered.filter(item => item.pengesyor && item.pengesyor.toUpperCase() === result.stb_filter_pengesyor.toUpperCase());
        }
        if (type === 'history' && result.stb_filter_pelulus) {
          filtered = filtered.filter(item => item.pelulus && item.pelulus.toUpperCase() === result.stb_filter_pelulus.toUpperCase());
        }
        displayFilteredItems(filtered, type);
      });
    } else {
      displayFilteredItems(filtered, type);
    }
    
    updateDraftFilterButtons();
    updateSubmittedFilterButtons();
    updateHistoryFilterButtons();
  }

  async function deleteOrClearRecord(item, actionType) {
    if (!item || !item.row) {
      await CustomAppModal.alert("Rekod tidak sah.", "Ralat", "error");
      return;
    }
    
    let message = '';
    let action = '';
    let modalTitle = 'Pengesahan';
    let btnText = 'Teruskan';
    let isDanger = true;
    let modalType = 'warning';
    
    if (actionType === 'padam_semua') {
      message = `Anda pasti mahu PADAM KESELURUHAN rekod untuk <b>${item.syarikat}</b>? Tindakan ini TIDAK BOLEH dibatalkan.`;
      action = 'padam_semua';
      modalTitle = "Pengesahan Padam";
      btnText = "Ya, Padam";
      isDanger = true;
      modalType = "error"; 
    } else if (actionType === 'undo_syor') {
      message = `Anda pasti mahu UNDO syor untuk <b>${item.syarikat}</b>? Rekod akan kembali ke "Belum Syor".`;
      action = 'undo_syor';
      modalTitle = "Pengesahan Undo";
      btnText = "Ya, Undo";
      isDanger = false;
      modalType = "warning"; 
    } else if (actionType === 'undo_lulus') {
      message = `Anda pasti mahu UNDO kelulusan untuk <b>${item.syarikat}</b>? Rekod akan kembali ke Inbox Pelulus.`;
      action = 'undo_lulus';
      modalTitle = "Pengesahan Undo";
      btnText = "Ya, Undo";
      isDanger = false;
      modalType = "warning"; 
    } else {
      message = `Anda pasti mahu KOSONGKAN SYOR untuk <b>${item.syarikat}</b>?`;
      action = 'padam_syor';
      modalTitle = "Kosongkan Syor";
      btnText = "Ya, Kosongkan";
      isDanger = true;
      modalType = "warning";
    }
    
    // GUNA CUSTOM APP MODAL
    const isConfirmed = await CustomAppModal.confirm(message, modalTitle, modalType, btnText, isDanger);
    if (!isConfirmed) return;
    
    // MULA PAPARKAN LOADING
    simulateLoadingWithSteps(
      ['Menghubungi pangkalan data...', 'Memproses tindakan...', 'Menyusun semula senarai...'],
      'Sila Tunggu Sebentar'
    );
    
    let payload;
    if (action === 'undo_syor') {
      payload = {
        action: 'updateRecord',
        row: item.row,
        syor_status: '',
        tarikh_syor: '',
        email: currentUser ? currentUser.email : '',
        ...item
      };
      payload.syor_status = '';
      payload.tarikh_syor = '';
      delete payload.kelulusan;
      delete payload.tarikh_lulus;
      
    } else if (action === 'undo_lulus') {
      payload = {
        action: 'updateRecord',
        row: item.row,
        kelulusan: '',
        alasan: '',
        tarikh_lulus: '',
        pelulus: '',
        email: currentUser ? currentUser.email : '',
        ...item
      };
      payload.kelulusan = '';
      payload.alasan = '';
      payload.tarikh_lulus = '';
      payload.pelulus = '';
      
    } else {
      payload = {
        action: 'deleteRecord',
        row: item.row,
        deleteType: action,
        user: currentUser.name,
        email: currentUser ? currentUser.email : '',
      };
    }
    
    try {
      const response = await fetchWithRetry(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }, 3, 1000);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        await playSoundEffect('positive_chime.mp3');
        
        if (cachedData && cachedData.length > 0) {
          const index = cachedData.findIndex(d => d.row === item.row);
          if (index !== -1) {
            if (action === 'padam_semua') {
              cachedData.splice(index, 1);
            } else if (action === 'undo_syor') {
              cachedData[index].syor_status = '';
              cachedData[index].tarikh_syor = '';
            } else if (action === 'undo_lulus') {
              cachedData[index].kelulusan = '';
              cachedData[index].alasan = '';
              cachedData[index].tarikh_lulus = '';
              cachedData[index].pelulus = '';
            } else if (action === 'padam_syor') {
              cachedData[index].syor_status = '';
              cachedData[index].tarikh_syor = '';
            }
          }
        }
        
        // TUNGGU fetchAndRenderList SELESAI SUSUN SEMULA SENARAI BARU
        await fetchAndRenderList(activeListType);
        
        // TUTUP LOADING SELEPAS SEMUANYA SELESAI
        hideLoading();
        
        // GUNA CUSTOM APP MODAL
        await CustomAppModal.alert(result.message, "Selesai", "success");
        
      } else {
        hideLoading();
        await CustomAppModal.alert("Ralat: " + (result.message || 'Gagal memproses rekod'), "Ralat", "error");
      }
    } catch (err) {
      console.error("V6.5.2 Delete error:", err);
      hideLoading();
      await CustomAppModal.alert("Gagal memproses rekod: " + err.message, "Ralat", "error");
    }
  }

  function displayFilteredItems(filtered, type) {
    const listId = type === 'history' ? 'historyList' : 'applicationsList';
    const list = document.getElementById(listId);
    if (!list) return;

    if(filtered.length === 0) { 
      list.innerHTML = '<div style="padding:10px; text-align:center; color:#777;">Tiada rekod.</div>'; 
      return; 
    }

    filtered.forEach((item, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'app-item-wrapper';
      
      const numberDiv = document.createElement('div');
      numberDiv.className = 'app-item-number';
      numberDiv.textContent = generateUniqueId(item.row) || (index + 1).toString();
      wrapper.appendChild(numberDiv);
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'app-item-content';
      
      const div = document.createElement('div');
      div.className = 'app-item';
      
      if (item.lawatan_submit_sptb && item.lawatan_syor) {
        div.style.backgroundColor = '#d1fae5';
        div.style.borderLeft = '4px solid #10b981';
      } else if (item.date_submit && type === 'drafts') {
        div.classList.add('blue-bg');
      }
      
      const btnContainer = document.createElement('div');
      btnContainer.className = 'app-actions-btn';
      btnContainer.style.display = 'flex';
      btnContainer.style.gap = '8px';
      btnContainer.style.flexShrink = '0';

      if (type === 'drafts') {
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-sm btn-edit';
        btnEdit.innerText = 'Edit';
        btnEdit.onclick = function() { loadRecordToDbOnly(item); }; 
        btnContainer.appendChild(btnEdit);
        
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn-sm btn-delete-sm';
        btnDelete.innerText = 'Padam';
        btnDelete.style.backgroundColor = '#ef4444';
        btnDelete.onclick = function() { 
            // Serahkan sepenuhnya kepada fungsi deleteOrClearRecord untuk memaparkan Modal
            deleteOrClearRecord(item, 'padam_semua');
        };
        btnContainer.appendChild(btnDelete);
      } else if (type === 'inbox') {
        const btn = document.createElement('button');
        btn.className = 'btn-sm btn-view';
        btn.innerText = 'Proses';
        btn.onclick = function() { loadRecordToPelulus(item); }; 
        btnContainer.appendChild(btn);
      } else if (type === 'submitted') {
        const btnView = document.createElement('button');
        
        if (item.kelulusan) {
          if (item.kelulusan.includes('LULUS')) {
            btnView.className = 'btn-sm btn-view-approved';
          } else if (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT')) {
            btnView.className = 'btn-sm btn-view-rejected';
          } else {
            btnView.className = 'btn-sm btn-view-pending';
          }
        } else {
          btnView.className = 'btn-sm btn-view-pending';
        }
        
        btnView.innerText = 'Lihat';
        btnView.onclick = function() { viewRecordOnly(item); }; 
        btnContainer.appendChild(btnView);
        
        if (currentUser.role === 'PENGESYOR') {
          const btnUndo = document.createElement('button');
          btnUndo.className = 'btn-sm';
          btnUndo.innerText = 'Undo';
          btnUndo.style.backgroundColor = '#f59e0b';
          btnUndo.style.color = 'white';
          btnUndo.onclick = function() { 
            deleteOrClearRecord(item, 'undo_syor');
          };
          btnContainer.appendChild(btnUndo);
        }
      } else if (type === 'history') {
        const btn = document.createElement('button');
        
        if (item.kelulusan) {
          if (item.kelulusan.includes('LULUS')) {
            btn.className = 'btn-sm btn-view-approved';
          } else if (item.kelulusan.includes('TOLAK') || item.kelulusan.includes('SIASAT')) {
            btn.className = 'btn-sm btn-view-rejected';
          } else {
            btn.className = 'btn-sm btn-view-pending';
          }
        } else {
          btn.className = 'btn-sm btn-view-pending';
        }
        
        btn.innerText = 'Lihat';
        btn.onclick = function() { viewRecordOnly(item); }; 
        btnContainer.appendChild(btn);
        
        if (item.borang_json && item.borang_json.trim() !== '') {
            const btnPrint = document.createElement('button');
            btnPrint.className = 'btn-sm';
            btnPrint.style.backgroundColor = '#6366f1';
            btnPrint.innerText = '🖨️ Cetak';
            btnPrint.onclick = function() { processPelulusPrint(item); };
            btnContainer.appendChild(btnPrint);
        }

        if (currentUser.role === 'PELULUS') {
          const btnUndo = document.createElement('button');
          btnUndo.className = 'btn-sm';
          btnUndo.innerText = 'Undo';
          btnUndo.style.backgroundColor = '#f59e0b';
          btnUndo.style.color = 'white';
          btnUndo.style.marginLeft = '5px';
          btnUndo.onclick = function() { 
            deleteOrClearRecord(item, 'undo_lulus');
          };
          btnContainer.appendChild(btnUndo);
        }
      }

      let jenisBadge = '';
      let perubahanRowHtml = '';
      
      const jenisUpper = item.jenis ? item.jenis.toUpperCase() : '';
      if (jenisUpper === 'BARU') {
        jenisBadge = `<span class="app-type-badge type-baru">BARU</span>`;
      } else if (jenisUpper === 'PEMBAHARUAN') {
        jenisBadge = `<span class="app-type-badge type-pembaharuan">PEMBAHARUAN</span>`;
      } else if (jenisUpper === 'UBAH MAKLUMAT') {
        jenisBadge = `<span class="app-type-badge type-ubah-maklumat">UBAH MAKLUMAT</span>`;
        if (item.ubah_maklumat) {
          perubahanRowHtml = `<div style="background-color:#fffbeb; border-left:3px solid #f59e0b; padding:4px 8px; margin-top:5px; font-size:0.8rem; font-weight:600; color:#d97706;">📝 Perubahan: ${item.ubah_maklumat}</div>`;
        }
      } else if (jenisUpper === 'UBAH GRED') {
        jenisBadge = `<span class="app-type-badge type-ubah-gred">UBAH GRED</span>`;
        if (item.ubah_gred) {
          perubahanRowHtml = `<div style="background-color:#fffbeb; border-left:3px solid #f59e0b; padding:4px 8px; margin-top:5px; font-size:0.8rem; font-weight:600; color:#d97706;">📝 Perubahan Gred: ${item.ubah_gred}</div>`;
        }
      } else {
        jenisBadge = `<span class="app-type-badge">${item.jenis || 'LAIN-LAIN'}</span>`;
      }

      let extraInfo = '';
      if ((currentUser.role === 'PELULUS' || currentUser.role === 'ADMIN' || currentUser.role === 'KETUA SEKSYEN' || currentUser.role === 'PENGARAH') && (type === 'inbox' || type === 'history')) {
        extraInfo = `<div style="font-size:0.75rem; color:#555; margin-top:2px;">Pengesyor: ${item.pengesyor || '-'}</div>`;
      }
      
      if (type === 'history' && item.pelulus) {
        extraInfo += `<div style="font-size:0.75rem; color:#555; margin-top:2px;">Pelulus: ${item.pelulus || '-'}</div>`;
      }

      let dateInfo = '';
      if (item.start_date) {
        const displayDate = formatDateDisplay(item.start_date);
        const dateLabel = 'TARIKH MULA (START DATE)';
        dateInfo = `<div style="font-size:0.75rem; color:#047857; font-weight:600; margin-top:2px;">📅 ${dateLabel}: ${displayDate}</div>`;
      }

      let spiDateInfo = '';
      if (item.date_submit) {
        const spiDate = formatDateDisplay(item.date_submit);
        spiDateInfo = `<div style="font-size:0.75rem; color:#1d4ed8; font-weight:600; margin-top:2px;">📤 Tarikh Hantar SPI: ${spiDate}</div>`;
      }

      let sptbDateInfo = '';
      if (item.lawatan_submit_sptb) {
        const sptbDate = formatDateDisplay(item.lawatan_submit_sptb);
        sptbDateInfo = `<div style="font-size:0.75rem; color:#059669; font-weight:600; margin-top:2px;">📋 Date Submit to SPTB: ${sptbDate}</div>`;
      }

      div.innerHTML = `
        <div class="app-info" style="flex: 1; padding-right: 15px; overflow: hidden;">
          <div class="app-title" style="font-weight:bold; font-size:1.1rem; word-break: break-word; white-space: normal;">${item.syarikat || '-'}</div>
          <div class="app-sub">${item.cidb || '-'} | ${item.gred || '-'} | ${jenisBadge}</div>
          ${dateInfo}
          ${spiDateInfo}
          ${sptbDateInfo}
          ${extraInfo}
          ${perubahanRowHtml}
        </div>
      `;
      
      div.appendChild(btnContainer);
      contentDiv.appendChild(div);
      wrapper.appendChild(contentDiv);
      list.appendChild(wrapper);
    });
  }

 async function loadRecordToDbOnly(item) {
    const hasUnsaved = checkUnsavedData();
    
    // Jika ada data belum simpan, tanya sekali sahaja (Warning)
    if (hasUnsaved) {
      const confirmLoad = await CustomAppModal.confirm(
          "Anda mempunyai data yang belum disimpan. Muatkan rekod ini akan menulis semula borang. Teruskan?",
          "Data Belum Simpan",
          "warning",
          "Ya, Teruskan",
          true
      );
      if (!confirmLoad) return;
      
      await resetFormForEdit();
    } 
    // Jika tiada data belum simpan, tanya adakah pasti mahu edit (Info)
    else {
      const finalConfirm = await CustomAppModal.confirm(
          "Adakah anda pasti mahu mengedit rekod ini?", 
          "Edit Rekod", 
          "info",
          "Ya, Edit",
          false
      );
      if(!finalConfirm) return;
    }

    document.getElementById('db_row_index').value = item.row || '';
    document.getElementById('db_syarikat').value = item.syarikat || '';
    document.getElementById('db_cidb').value = item.cidb || '';
    document.getElementById('db_gred').value = item.gred || '';
    document.getElementById('db_jenis').value = item.jenis || '';
    document.getElementById('db_negeri').value = item.negeri || '';
    document.getElementById('db_tatatertib').value = item.tatatertib || '';
    document.getElementById('db_syor').value = item.syor_lawatan || '';
    document.getElementById('db_pautan').value = item.pautan || '';
    document.getElementById('db_justifikasi').value = item.justifikasi || '';
    document.getElementById('db_syor_status').value = item.syor_status || '';
    
    const ubahMakInput = document.getElementById('input_ubah_maklumat');
    if(ubahMakInput) ubahMakInput.value = item.ubah_maklumat || '';
    const ubahGredInput = document.getElementById('input_ubah_gred');
    if(ubahGredInput) ubahGredInput.value = item.ubah_gred || '';

    const dbPerubahanInput = document.getElementById('db_perubahan_input');
    const dbPerubahanContainer = document.getElementById('db_perubahan_container');
    const dbPerubahanLabel = document.getElementById('db_perubahan_label');
    if (dbPerubahanInput && dbPerubahanContainer && dbPerubahanLabel) {
      if (item.jenis === 'UBAH MAKLUMAT') {
        dbPerubahanContainer.style.display = 'block';
        dbPerubahanLabel.textContent = 'Nyatakan Perubahan Maklumat:';
        dbPerubahanInput.value = item.ubah_maklumat || '';
      } else if (item.jenis === 'UBAH GRED') {
        dbPerubahanContainer.style.display = 'block';
        dbPerubahanLabel.textContent = 'Nyatakan Perubahan Gred:';
        dbPerubahanInput.value = item.ubah_gred || '';
      } else {
        dbPerubahanContainer.style.display = 'none';
        dbPerubahanInput.value = '';
      }
    }
    
    if (item.alamat_perniagaan) {
      const el = document.getElementById('db_alamat_perniagaan');
      if (el) el.value = item.alamat_perniagaan;
    }

    if (item.jenis_konsultansi) {
      document.querySelectorAll('.konsultansi-checkbox').forEach(cb => { cb.checked = false; });
      document.querySelectorAll('.konsultansi-date').forEach(d => { d.value = ''; d.style.display = 'none'; });
      
      const pattern = /(Emel|WhatsApp|Whatsapp|Call),?\s*(\d{1,2}\/\d{1,2}\/\d{4})/gi;
      let match;
      while ((match = pattern.exec(item.jenis_konsultansi)) !== null) {
        let type = match[1].toLowerCase();
        if (type === 'whatsapp') type = 'whatsapp';
        const date = match[2];
        
        const cb = document.getElementById(`cb_konsultansi_${type}`);
        if (cb) {
          cb.checked = true;
          const dateInput = document.getElementById(`date_konsultansi_${type}`);
          if (dateInput) {
            const parts = date.split('/');
            dateInput.value = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            dateInput.style.display = 'block';
          }
        }
      }
    }

    const tarikhSyorInput = document.getElementById('db_tarikh_syor');
    if (tarikhSyorInput && item.tarikh_syor) {
      tarikhSyorInput.value = new Date(item.tarikh_syor).toISOString().split('T')[0];
    }

    if (item.syor_lawatan === 'YA' && dbPautanInput) {
      dbPautanInput.style.backgroundColor = '#fffbeb';
      dbPautanInput.style.borderColor = '#f59e0b';
      dbPautanInput.style.borderWidth = '2px';
    }

    const startDateInput = document.getElementById('db_start_date');
    if (startDateInput && item.start_date) {
      startDateInput.value = new Date(item.start_date).toISOString().split('T')[0];
    }

    const dateMap = {
      'db_tarikh_surat': item.tarikh_surat_terdahulu, 
      'db_submit_date': item.date_submit
    };

    for(let id in dateMap) { 
      const el = document.getElementById(id); 
      if(el && dateMap[id]) {
        try {
          el.value = new Date(dateMap[id]).toISOString().split('T')[0];
        } catch (e) {
          console.error("V6.5.2 Error parsing date:", e);
        }
      }
    }

    if (cbSelesaiLawatan) {
      const hasLawatan = item.lawatan_tarikh || item.lawatan_submit_sptb || item.lawatan_syor;
      cbSelesaiLawatan.checked = hasLawatan ? true : false;
      
      if (containerLawatan) {
        containerLawatan.style.display = hasLawatan ? 'block' : 'none';
      }
      
      if (dbLawatanTarikh && item.lawatan_tarikh) {
        dbLawatanTarikh.value = item.lawatan_tarikh;
      }
      if (dbLawatanSubmitSptb && item.lawatan_submit_sptb) {
        dbLawatanSubmitSptb.value = item.lawatan_submit_sptb;
      }
      if (dbLawatanSyor && item.lawatan_syor) {
        dbLawatanSyor.value = item.lawatan_syor;
      }
    }
    
    // === SET STATUS & PAPARAN SPI ===
    const dbStatusHantarSpi = document.getElementById('db_status_hantar_spi');
    if (dbStatusHantarSpi) {
        dbStatusHantarSpi.value = item.status_hantar_spi || '';
    }
    
    const statusDisp = document.getElementById('db_status_hantar_display');
    if (statusDisp) {
        if(item.status_hantar_spi === 'DALAM QUEUE') {
            statusDisp.textContent = '⏳ DALAM QUEUE';
            statusDisp.style.backgroundColor = '#fef3c7';
            statusDisp.style.borderColor = '#d97706';
            statusDisp.style.color = '#b45309';
            statusDisp.style.display = 'inline-block';
        } else if(item.status_hantar_spi === 'TELAH DIHANTAR') {
            statusDisp.textContent = `✅ TELAH DIHANTAR (${item.tarikh_hantar_spi || ''})`;
            statusDisp.style.backgroundColor = '#dcfce7';
            statusDisp.style.borderColor = '#16a34a';
            statusDisp.style.color = '#15803d';
            statusDisp.style.display = 'inline-block';
        } else {
            statusDisp.style.display = 'none';
        }
    }

    updateValidationCheckboxDisplay();

    // =====================================================================
    // (KOD BARU KEMASKINI) LANGKAH B: RESTORE LENGKAP BORANG SEMAKAN & PERSONEL
    // =====================================================================
    saveDatabaseFormData();
    updateOpenDriveButton();

    if (item.borang_json && item.borang_json.trim() !== '') {
        try {
            const parsedData = JSON.parse(item.borang_json);
            
            // 1. Masukkan nilai ke elemen berdasarkan ID
            Object.keys(parsedData).forEach(key => {
                if (key === 'personnel' || key === 'jenisApp') return; // Skip khas untuk jenisApp & personnel
                
                const el = document.getElementById(key);
                if (el) {
                    if (el.type === 'checkbox' || el.type === 'radio') {
                        el.checked = parsedData[key];
                    } else if (el.type !== 'file') {
                        el.value = parsedData[key];
                    }
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            // 2. Set Radio Button jenisApp
            if (parsedData.jenisApp) {
                const radio = document.querySelector(`input[name="jenisApp"][value="${parsedData.jenisApp}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            // 3. Set Senarai Personel
            const personnelListEl = document.getElementById('personnelList');
            if (personnelListEl) personnelListEl.innerHTML = ''; // Kosongkan dahulu
            if (parsedData.personnel && Array.isArray(parsedData.personnel) && parsedData.personnel.length > 0) {
                parsedData.personnel.forEach(person => {
                    addPerson(person); 
                });
            } else {
                addPerson(); // Tambah satu yang kosong jika tiada data
            }

            // 4. SELAMATKAN KE DALAM MEMORI (HINDARI OVERWRITE OLEH switchTab)
            formStates['stb'] = parsedData;
            storageWrapper.set({ 'stb_form_states': formStates });
            
            // Re-initialize butang tick supaya warna berubah ikut data
            setTimeout(() => {
                initializeTickButtons();
            }, 100);

            // 5. Buka tab Borang Semakan
            switchTab('stb'); 
            
            // 6. Suspend sekejap dan paksa simpan state terakhir (overwrite timer `switchTab`)
            setTimeout(() => {
                saveFormData();
                savePengesyorState();
            }, 250);

            return; // Berhenti di sini supaya tidak melompat ke tab 'db'
        } catch (e) {
            console.error("Gagal parse borang_json", e);
        }
    }
    
    // Jika tiada JSON, buka Input Database (lalai seperti sistem asal)
    switchTab('db');
    // =====================================================================
  }

  function loadRecordToPelulus(item) {
    pelulusActiveItem = item;
    savePelulusState(); 
    renderPelulusView(false); 
    switchTab('pelulus-view');
  }

  function viewRecordOnly(item) {
    pelulusActiveItem = item;
    savePelulusState();
    
    renderPelulusView(true); 
    switchTab('pelulus-view');
  }

  function renderPelulusView(readOnly) {
    const c = document.getElementById('pelulus_view_content');
    if (!c) return;

    const i = pelulusActiveItem;
    if (!i) return;

    const safe = (val) => val || '-';
    const formatDate = (d) => d ? formatDateDisplay(d) : '-';

    let link = '-';
    if (i.pautan) {
      link = `<a href="${i.pautan}" target="_blank" style="color:#2563eb; font-weight:bold; text-decoration:none;">BUKA DOKUMEN</a>`;
    }

    let statusBadge = `<span class="status-badge bg-blue">${safe(i.syor_status)}</span>`;
    if(i.syor_status === 'SOKONG') statusBadge = `<span class="status-badge bg-green">SOKONG</span>`;
    else if(i.syor_status === 'TIDAK DISOKONG') statusBadge = `<span class="status-badge bg-red">TIDAK SOKONG</span>`;

    const rowStartDate = i.start_date ? `
      <div class="view-row">
        <span class="view-label">TARIKH MULA (START DATE)</span>
        <span class="view-value">${formatDate(i.start_date)}</span>
      </div>` : '';

    const rowPrevDate = i.tarikh_surat_terdahulu ? `
      <div class="view-row">
        <span class="view-label">TARIKH SURAT TERDAHULU</span>
        <span class="view-value">${formatDate(i.tarikh_surat_terdahulu)}</span>
      </div>` : '';

    c.innerHTML = `
      <div class="view-container">
        <div class="view-section">
          <div class="view-section-header">🏢 MAKLUMAT PERMOHONAN</div>
          <div class="view-grid">
            <div class="view-row full-width">
              <span class="view-label">NAMA SYARIKAT</span>
              <span class="view-value" style="font-size:1.1rem; font-weight:bold;">${safe(i.syarikat)}</span>
            </div>
            <div class="view-row">
              <span class="view-label">NO. CIDB</span>
              <span class="view-value">${safe(i.cidb)}</span>
            </div>
            <div class="view-row">
              <span class="view-label">GRED & JENIS</span>
              <span class="view-value">${safe(i.gred)} (${safe(i.jenis)})</span>
            </div>
            ${rowStartDate}
            ${rowPrevDate}
            <div class="view-row">
              <span class="view-label">NEGERI OPERASI</span>
              <span class="view-value">${safe(i.negeri)}</span>
            </div>
            <div class="view-row full-width">
              <span class="view-label">ALAMAT PERNIAGAAN</span>
              <span class="view-value">${safe(i.alamat_perniagaan)}</span>
            </div>
            <div class="view-row full-width">
              <span class="view-label">JENIS KONSULTANSI</span>
              <span class="view-value">${safe(i.jenis_konsultansi)}</span>
            </div>
            <div class="view-row">
              <span class="view-label">PAUTAN DOKUMEN</span>
              <span class="view-value">${link}</span>
            </div>
          </div>
        </div>

        <div class="view-section">
          <div class="view-section-header">🚧 MAKLUMAT LAWATAN & PEMATUHAN</div>
          <div class="view-grid">
            <div class="view-row">
              <span class="view-label">TARIKH LAWATAN</span>
              <span class="view-value">${formatDate(i.lawatan_tarikh)}</span>
            </div>
            <div class="view-row">
              <span class="view-label">DATE SUBMIT TO SPTB</span>
              <span class="view-value">${formatDate(i.lawatan_submit_sptb)}</span>
            </div>
            <div class="view-row">
              <span class="view-label">SYOR LAWATAN</span>
              <span class="view-value">${safe(i.lawatan_syor)}</span>
            </div>
          </div>
        </div>

        <div class="view-section">
          <div class="view-section-header">👤 ULASAN PENGESYOR</div>
          <div class="view-grid">
            <div class="view-row full-width">
              <span class="view-label">NAMA PENGESYOR</span>
              <span class="view-value">${safe(i.pengesyor)}</span>
            </div>
            <div class="view-row">
              <span class="view-label">TARIKH SYOR</span>
              <span class="view-value">${formatDate(i.tarikh_syor)}</span>
            </div>
            <div class="view-row">
              <span class="view-label">KEPUTUSAN SYOR</span>
              <span class="view-value">${statusBadge}</span>
            </div>
            <div class="view-row full-width">
              <span class="view-label">JUSTIFIKASI</span>
              <span class="view-value">${safe(i.justifikasi)}</span>
            </div>
          </div>
        </div>

        ${i.tarikh_lulus ? `
        <div class="view-section" style="border-color:#22c55e;">
          <div class="view-section-header" style="background:#f0fdf4; color:#166534;">✅ KEPUTUSAN PELULUS</div>
          <div class="view-grid">
            <div class="view-row full-width">
              <span class="view-label">KEPUTUSAN AKHIR</span>
              <span class="view-value" style="font-weight:bold; color:#15803d;">${safe(i.kelulusan)}</span>
            </div>
            <div class="view-row full-width">
              <span class="view-label">NAMA PELULUS</span>
              <span class="view-value">${safe(i.pelulus)}</span>
            </div>
            <div class="view-row">
              <span class="view-label">TARIKH LULUS</span>
              <span class="view-value">${formatDate(i.tarikh_lulus)}</span>
            </div>
            <div class="view-row">
              <span class="view-label">ALASAN/CATATAN</span>
              <span class="view-value">${safe(i.alasan)}</span>
            </div>
          </div>
        </div>` : ''}
        
        ${(i.borang_json && i.borang_json.trim() !== '') ? 
            `<div style="margin-top: 15px;"><button id="btnLihatBorangSemakan" class="btn btn-blue" style="width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">📄 Lihat Borang Semakan</button></div>` 
        : ''}
      </div>
    `;

    // GUNAKAN .onclick AGAR IA HANYA BERLAKU SEKALI SAHAJA (TIDAK DOUBLE)
    setTimeout(() => {
        const btnLihat = document.getElementById('btnLihatBorangSemakan');
        if (btnLihat) {
            btnLihat.onclick = function() {
                processLihatBorangPreview(pelulusActiveItem);
            };
        }
    }, 100);

    const btnToApproval = document.getElementById('btnToApproval');
    const btnViewBack = document.getElementById('btnViewBack');
    const btnOpenFull = document.getElementById('openFullBtnPelulus');

    if(readOnly) {
      if(btnToApproval) btnToApproval.style.display = 'none';
      if(btnViewBack) btnViewBack.style.display = 'inline-block';
    } else {
      if(btnToApproval) btnToApproval.style.display = 'inline-block';
      if(btnViewBack) btnViewBack.style.display = 'none';
    }

    if (btnOpenFull) {
        btnOpenFull.style.display = 'inline-block';
    }
  }

  function submitData(payload, successMsg, callback) {
    console.log("V6.5.2 submitData dipanggil dengan payload:", payload);
    
    const statusEl = document.getElementById('statusMsg');
    if(statusEl) statusEl.innerText = "Sedang menghantar...";
    
    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
      loadingText.textContent = 'Menghantar data...';
      
      const progressBar = document.getElementById('loading-progress-bar');
      const progressPercent = document.getElementById('loading-progress-percent');
      const progressLabel = document.getElementById('loading-progress-label');
      
      if (progressBar) progressBar.style.width = '0%';
      if (progressPercent) progressPercent.textContent = '0%';
      if (progressLabel) progressLabel.textContent = 'Menyediakan data...';
      
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        if (currentProgress < 90) {
          currentProgress += 2;
          if (progressBar) progressBar.style.width = `${currentProgress}%`;
          if (progressPercent) progressPercent.textContent = `${currentProgress}%`;
          
          if (progressLabel) {
            if (currentProgress < 30) {
              progressLabel.textContent = 'Menyediakan data...';
            } else if (currentProgress < 60) {
              progressLabel.textContent = 'Menghantar ke pelayan...';
            } else {
              progressLabel.textContent = 'Memproses di pelayan...';
            }
          }
        }
      }, 100);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      fetchWithRetry(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller.signal
      }, 3, 1000)
      .then(async response => {
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          console.log("V6.5.2 Response is not JSON:", text);
          result = { status: 'success', message: 'Data dihantar (tiada respons JSON)' };
        }
        
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressLabel) progressLabel.textContent = 'Selesai!';
        
        if(statusEl) { 
          statusEl.innerText = successMsg; 
          statusEl.style.color = "green"; 
          setTimeout(() => statusEl.innerText = "", 3000); 
        }
        
        setTimeout(() => {
          if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
          }
          
          if(callback) callback(result);
        }, 500);
      })
      .catch(err => { 
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        console.error("V6.5.2 Submit error:", err);
        
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressLabel) progressLabel.textContent = 'Ralat!';
        if (progressBar) progressBar.style.backgroundColor = '#ef4444';
        
        let errorMsg = "Ralat penghantaran.";
        if (err.name === 'AbortError') {
          errorMsg = "Penghantaran dibatalkan atau timeout. Sila semak sambungan internet.";
        } else if (err.message) {
          errorMsg = err.message;
        }
        
        if(statusEl) statusEl.innerText = errorMsg; 
        
        setTimeout(() => {
          if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
          }
          alert("GAGAL menghantar data: " + errorMsg);
        }, 1000);
      });
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      fetchWithRetry(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller.signal
      }, 3, 1000)
      .then(async response => {
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          console.log("V6.5.2 Response is not JSON:", text);
          result = { status: 'success', message: 'Data dihantar (tiada respons JSON)' };
        }
        
        if(statusEl) { 
          statusEl.innerText = successMsg; 
          statusEl.style.color = "green"; 
          setTimeout(() => statusEl.innerText = "", 3000); 
        }
        if(callback) callback(result);
      })
      .catch(err => { 
        clearTimeout(timeoutId);
        console.error("V6.5.2 Submit error:", err);
        
        let errorMsg = "Ralat penghantaran.";
        if (err.name === 'AbortError') {
          errorMsg = "Penghantaran dibatalkan atau timeout. Sila semak sambungan internet.";
        } else if (err.message) {
          errorMsg = err.message;
        }
        
        if(statusEl) statusEl.innerText = errorMsg; 
        alert("GAGAL menghantar data: " + errorMsg);
      });
    }
  }

  const btnSendDb = document.getElementById('btnSendToSheet');
  if (btnSendDb) {
    btnSendDb.addEventListener('click', async () => {
      
      // PENGGUNAAN MODAL BARU
      const isConfirmedAct = await CustomAppModal.confirm(
          "Adakah anda pasti mahu menghantar dan menyimpan data permohonan ini?", 
          "Hantar Data", 
          "info", 
          "Hantar & Simpan", 
          false
      );
      if(!isConfirmedAct) return;
      
      let targetRow = document.getElementById('db_row_index')?.value || '';
      let isGapFill = false;

      if (!targetRow && cachedData && cachedData.length > 0) {
        const gapItem = cachedData.find(item => (!item.syarikat || item.syarikat.toString().trim() === ""));
        if (gapItem && gapItem.row) {
          targetRow = gapItem.row;
          isGapFill = true;
        }
      }

      const isConfirmed = dbSahSyor ? dbSahSyor.checked : false;
      
      const isLawatanSelesai = cbSelesaiLawatan ? cbSelesaiLawatan.checked : false;
      const lawatanTarikh = isLawatanSelesai && dbLawatanTarikh ? dbLawatanTarikh.value : '';
      const lawatanSubmitSptb = isLawatanSelesai && dbLawatanSubmitSptb ? dbLawatanSubmitSptb.value : '';
      const lawatanSyor = isLawatanSelesai && dbLawatanSyor ? dbLawatanSyor.value : '';
      
      const dbSyorValue = document.getElementById('db_syor')?.value || '';
      const dbSubmitDateValue = document.getElementById('db_submit_date')?.value || '';
      const dbSyorStatusValue = document.getElementById('db_syor_status')?.value || '';
      const dbStartDateValue = document.getElementById('db_start_date')?.value || document.getElementById('borang_tarikh_mohon')?.value || '';
      
      // === LOGIK BARU SEMAKAN HANTAR SPI ===
      const dbStatusHantarSpi = document.getElementById('db_status_hantar_spi')?.value || '';
      
      let confirmHantarEmel = false;
      
      if (dbSyorValue === 'YA' && dbSubmitDateValue && dbSubmitDateValue.trim() !== '') {
        const hasSyorAndConfirmed = (dbSyorStatusValue.trim() !== '') && isConfirmed;
        const isTelahDihantar = (dbStatusHantarSpi === 'TELAH DIHANTAR' || dbStatusHantarSpi === 'DALAM QUEUE');
        
        // HANYA MINTA POPUP JIKA: Ia belum dihantar ke queue DAN sudah tekan SOKONG.
        if (!hasSyorAndConfirmed && !isTelahDihantar) {
          confirmHantarEmel = await CustomAppModal.confirm(
              "Adakah anda ingin hantar emel syarikat ini ke SPI?",
              "Hantar Emel SPI",
              "info",
              "Ya, Hantar",
              false
          );
        }
      }
      
      let jenisKonsultansiParts = [];
      const konsultansiTypes = ['emel', 'whatsapp', 'call'];
      const namaLabel = { 'emel': 'Emel', 'whatsapp': 'WhatsApp', 'call': 'Call' };
      konsultansiTypes.forEach(type => {
        const cb = document.getElementById(`cb_konsultansi_${type}`);
        const dateInput = document.getElementById(`date_konsultansi_${type}`);
        if (cb && cb.checked && dateInput && dateInput.value) {
          const formattedDate = formatDateDisplay(dateInput.value);
          jenisKonsultansiParts.push(`${namaLabel[type]}, ${formattedDate}`);
        }
      });
      const jenisKonsultansiString = jenisKonsultansiParts.join(' - ');
      
      const dbJenisValue = document.getElementById('db_jenis')?.value || '';
      let ubahMaklumatVal = '';
      let ubahGredVal = '';
      const dbPerubahanInputVal = document.getElementById('db_perubahan_input')?.value || '';
      
      if (dbJenisValue === 'UBAH MAKLUMAT') {
        ubahMaklumatVal = dbPerubahanInputVal;
      } else if (dbJenisValue === 'UBAH GRED') {
        ubahGredVal = dbPerubahanInputVal;
      }

      // =====================================================================
      // (KOD BARU KEMASKINI) LANGKAH A: TANGKAP SEMUA DATA BORANG & PERSONEL
      // =====================================================================
      const borangJsonData = {};
      
      document.querySelectorAll('#tab-checker input, #tab-checker select, #tab-checker textarea').forEach(el => {
        if (el.id && !el.id.includes('print_') && !el.id.includes('pelulus_') && !el.id.includes('login')) {
          if (el.type === 'checkbox' || el.type === 'radio') {
            borangJsonData[el.id] = el.checked;
          } else {
            borangJsonData[el.id] = el.value;
          }
        }
      });
      
      // Ambil nilai radio button jenis permohonan secara manual
      const selectedRadio = document.querySelector('input[name="jenisApp"]:checked');
      if (selectedRadio) {
        borangJsonData['jenisApp'] = selectedRadio.value;
      }
      
      // Ambil maklumat personel dinamik
      const personnelListObj = [];
      document.querySelectorAll('.person-card').forEach(card => {
        const roles = [];
        card.querySelectorAll('.role-cb:checked').forEach(cb => roles.push(cb.value));
        personnelListObj.push({
          name: card.querySelector('.p-name')?.value || '',
          isCompany: card.querySelector('.is-company')?.checked || false,
          roles: roles,
          s_ic: card.querySelector('.status-ic')?.value || '',
          s_sb: card.querySelector('.status-sb')?.value || '',
          s_epf: card.querySelector('.status-epf')?.value || ''
        });
      });
      borangJsonData['personnel'] = personnelListObj;
      // =====================================================================
      
      const payload = {
        row: targetRow,
        syarikat: document.getElementById('db_syarikat')?.value || '',
        cidb: document.getElementById('db_cidb')?.value || '',
        gred: document.getElementById('db_gred')?.value || '',
        jenis: dbJenisValue,
        negeri: document.getElementById('db_negeri')?.value || '',
        tarikh_surat_terdahulu: document.getElementById('db_tarikh_surat')?.value || '',
        start_date: document.getElementById('db_start_date')?.value || '',
        tatatertib: document.getElementById('db_tatatertib')?.value || '',
        syor_lawatan: dbSyorValue,
        date_submit: dbSubmitDateValue,
        pautan: document.getElementById('db_pautan')?.value || '',
        justifikasi: document.getElementById('db_justifikasi')?.value || '',
        pengesyor: document.getElementById('db_pengesyor')?.value || '',
        createFolder: document.getElementById('cbCreateDriveFolder')?.checked || false,
        lawatan_tarikh: lawatanTarikh,
        lawatan_submit_sptb: lawatanSubmitSptb,
        lawatan_syor: lawatanSyor,
        alamat_perniagaan: document.getElementById('db_alamat_perniagaan')?.value || '',
        jenis_konsultansi: jenisKonsultansiString,
        hantar_emel_spi: confirmHantarEmel,
        ubah_maklumat: ubahMaklumatVal,
        ubah_gred: ubahGredVal,
        email: currentUser ? currentUser.email : '',
        borang_json: JSON.stringify(borangJsonData) // JSON yang telah merangkumi semua elemen
      };
      
      if (isConfirmed) {
        payload.syor_status = document.getElementById('db_syor_status')?.value || 'SOKONG';
        payload.tarikh_syor = new Date().toISOString().split('T')[0];
      } else {
        payload.syor_status = '';
        payload.tarikh_syor = '';
      }
      
      if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingText.textContent = 'Menghantar data...';
      }

      submitData(payload, "Rekod berjaya disimpan!", async (result) => {
        const message = isConfirmed ? 
          "Data BERJAYA dihantar ke pangkalan data dan telah dipindahkan ke 'Telah Syor'." : 
          "Data BERJAYA disimpan sebagai DRAFT (Belum Syor).";
        
        await playSuccessSound();
        
        const isNotifyWhatsapp = cbNotifyWhatsapp ? cbNotifyWhatsapp.checked : false;
        const selectedPelulus = document.getElementById('db_pelulus_whatsapp') ? document.getElementById('db_pelulus_whatsapp').value : '';
        
        let whatsappUrl = null;
        if (isConfirmed && isNotifyWhatsapp && selectedPelulus.trim() !== '') {
            whatsappUrl = sendWhatsAppNotification(payload.syarikat, payload.cidb, payload.jenis, payload.syor_status, payload.tarikh_syor, selectedPelulus);
        }
        
        if (whatsappUrl) {
            const isWaConfirmed = await CustomAppModal.confirm(
                message + "<br><br>Adakah anda ingin buka dan hantar notifikasi WhatsApp sekarang?",
                "Hantar WhatsApp",
                "success",
                "Ya, Hantar",
                false
            );
            if (isWaConfirmed) {
                window.open(whatsappUrl, '_blank');
            }
        } else {
            await CustomAppModal.alert(message, "Selesai", "success");
        }
        
        await resetFormAfterSubmit();
        
        fetchAndRenderList('drafts');
        
        if (loadingOverlay) {
          loadingOverlay.style.display = 'none';
        }
      });
    });
  }

  async function resetFormAfterSubmit() {
    // 1. Kosongkan semua form di tab borang semakan dan input database
    const tabsToClear = ['tab-checker', 'tab-database'];
    tabsToClear.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.querySelectorAll('input, select, textarea').forEach(el => {
                if (el.id !== 'db_pengesyor' && el.id !== 'pelulus_nama' && !el.id.startsWith('login')) {
                    if(el.type === 'checkbox' || el.type === 'radio') {
                        el.checked = false;
                    } else if (el.type !== 'file') {
                        el.value = '';
                    }
                    // Reset inline styles for status inputs (✓/✗)
                    if (el.classList.contains('status-input')) {
                        el.style.backgroundColor = '#eff6ff';
                        el.style.color = '#1e40af';
                    }
                }
            });
        }
    });
    
    const statusDisp = document.getElementById('db_status_hantar_display');
    if (statusDisp) statusDisp.style.display = 'none';
    
    document.querySelectorAll('.konsultansi-checkbox').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.konsultansi-date').forEach(d => { d.value = ''; d.style.display = 'none'; });
    
    if (cbSelesaiLawatan) cbSelesaiLawatan.checked = false;
    if (containerLawatan) containerLawatan.style.display = 'none';
    
    if (cbNotifyWhatsapp) cbNotifyWhatsapp.checked = false;
    if (pelulusWhatsappContainer) pelulusWhatsappContainer.style.display = 'none';
    if (dbPelulusWhatsapp) dbPelulusWhatsapp.value = '';

    const dbPerubahanContainer = document.getElementById('db_perubahan_container');
    if (dbPerubahanContainer) dbPerubahanContainer.style.display = 'none';

    document.querySelectorAll('input[name="jenisApp"]').forEach(radio => {
      radio.checked = false;
    });

    const ubahMaklumatInput = document.getElementById('input_ubah_maklumat');
    const ubahGredInput = document.getElementById('input_ubah_gred');
    if (ubahMaklumatInput) ubahMaklumatInput.style.display = 'none';
    if (ubahGredInput) ubahGredInput.style.display = 'none';

    const personnelListEl = document.getElementById('personnelList');
    if (personnelListEl) personnelListEl.innerHTML = '';

    addPerson();

    if (dbPautanInput) {
      dbPautanInput.style.backgroundColor = '';
      dbPautanInput.style.borderColor = '';
      dbPautanInput.style.borderWidth = '';
    }

    if (btnSyncToDb) {
      btnSyncToDb.style.display = 'none';
    }

    hasPrinted = false;
    driveFolderCreated = false;
    createdFolderUrl = '';
    userFolderUrl = '';

    if (cbCreateDriveFolder) {
      cbCreateDriveFolder.checked = true;
    }

    if (driveResult) driveResult.innerHTML = '';
    if (driveStatus) {
      driveStatus.style.display = 'none';
    }

    clearPdfData();

    updateOpenDriveButton();

    storageWrapper.set({ 
      'stb_has_printed': false,
      'stb_drive_folder_url': '',
      'stb_user_folder_url': ''
    });

    await storageWrapper.remove([
      'stb_form_data', 
      'stb_form_states',
      'stb_form_persistence',
      'stb_database_persistence'
    ]);

    console.log("V6.5.2 Borang telah direset sepenuhnya selepas hantar data.");

    updateValidationCheckboxDisplay();
    if (typeof applyDynamicFormColors === 'function') {
        applyDynamicFormColors();
    }
  }

  const btnPelulusSubmit = document.getElementById('btnPelulusSubmit');
  if (btnPelulusSubmit) {
    btnPelulusSubmit.addEventListener('click', async () => {
      // 1. Semak kotak pengesahan
      if (pelulusSahLulus && !pelulusSahLulus.checked) {
        await CustomAppModal.alert("Sila tandakan kotak pengesahan!", "Pengesahan Diperlukan", "warning");
        return;
      }
      
      if(!pelulusActiveItem) return;
      
      // 2. Ambil nilai-nilai dari borang
      const tukarSyor = document.getElementById('pelulus_tukar_syor_lawatan')?.value || '';
      const justifikasiPelulus = document.getElementById('pelulus_justifikasi_lawatan')?.value || '';
      const dateSpiPelulus = document.getElementById('pelulus_date_submit_spi')?.value || '';
      const keputusan = document.getElementById('pelulus_keputusan')?.value || '';
      
      // 3. Validasi pertukaran syor kepada YA
      if (tukarSyor === 'YA' && dateSpiPelulus === '') {
        await CustomAppModal.alert("Sila masukkan Date Submit to SPI jika Syor Lawatan ditukar kepada YA.", "Maklumat Diperlukan", "warning");
        return;
      }
      
      // 4. Pengesahan keputusan utama
      const isConfirmed = await CustomAppModal.confirm(
          "Adakah anda pasti dengan keputusan ini?",
          "Sahkan Keputusan",
          "info",
          "Ya, Sahkan",
          false
      );
      if(!isConfirmed) return;

      // 5. Fungsi pengesahan emel pemutihan (Hanya jika perlu)
      let confirmSpiPemutihan = false;
      if (tukarSyor === 'PEMUTIHAN' || pelulusActiveItem.syor_lawatan === 'PEMUTIHAN') {
        if (keputusan) {
          confirmSpiPemutihan = await CustomAppModal.confirm(
              "Adakah anda pasti ingin hantar permohonan ini ke SPI?",
              "Pengesahan Hantar SPI",
              "warning",
              "Ya, Hantar",
              false
          );
        }
      }

      // 6. Sediakan data untuk dihantar
      const catatanPelulus = document.getElementById('pelulus_catatan')?.value || '';
      let borangJsonData = {};
      if (pelulusActiveItem.borang_json && pelulusActiveItem.borang_json.trim() !== '') {
          try { borangJsonData = JSON.parse(pelulusActiveItem.borang_json); } catch(e){}
      }
      borangJsonData.catatan_pelulus = catatanPelulus;
      const newBorangJson = JSON.stringify(borangJsonData);

      const payload = {
        row: pelulusActiveItem.row || '',
        kelulusan: keputusan,
        alasan: document.getElementById('pelulus_alasan')?.value || '',
        tarikh_lulus: new Date().toISOString().split('T')[0],
        pelulus: currentUser.name || '',
        syor_lawatan_baru: tukarSyor,
        justifikasi_baru: justifikasiPelulus,
        date_submit_baru: dateSpiPelulus,
        hantar_emel_spi_pemutihan: confirmSpiPemutihan,
        borang_json: newBorangJson, // Set ruangan catatan pelulus
        email: currentUser ? currentUser.email : '' 
      };
      
      // 7. Hantar data ke pelayan (server)
      submitData(payload, "Keputusan berjaya dihantar!", async (result) => {
        if (result.status === 'success') {
          await playSuccessSound();
        }
        
        // Kemas kini data dalam memori supaya jadual terkini
        if (cachedData && cachedData.length > 0) {
          const index = cachedData.findIndex(d => d.row === pelulusActiveItem.row);
          if (index !== -1) {
            cachedData[index].kelulusan = payload.kelulusan;
            cachedData[index].alasan = payload.alasan;
            cachedData[index].tarikh_lulus = payload.tarikh_lulus;
            cachedData[index].pelulus = payload.pelulus;
            cachedData[index].borang_json = payload.borang_json;
          }
        }
        
        // Buang cache sesi pelulus dari localStorage
        await storageWrapper.remove(['stb_pelulus_state', 'stb_drive_folder_url', 'stb_user_folder_url']);
        
        // Jika borang JSON ada, pelulus boleh terus cetak dengan animasi Modal!
        if (pelulusActiveItem.borang_json && pelulusActiveItem.borang_json.trim() !== '') {
            const isCetak = await CustomAppModal.confirm(
                "Keputusan pelulus BERJAYA direkodkan. Adakah anda mahu mencetak Borang Semakan sekarang?",
                "Cetak Borang",
                "info",
                "Ya, Cetak",
                false
            );
            if (isCetak) {
                pelulusActiveItem.kelulusan = payload.kelulusan;
                pelulusActiveItem.alasan = payload.alasan;
                pelulusActiveItem.tarikh_lulus = payload.tarikh_lulus;
                pelulusActiveItem.pelulus = payload.pelulus;
                pelulusActiveItem.borang_json = payload.borang_json;
                await processPelulusPrint(pelulusActiveItem);
            }
        } else {
            await CustomAppModal.alert("Keputusan pelulus BERJAYA direkodkan.", "Selesai", "success");
        }
        
        // Kembali ke tab inbox
        switchTab('inbox');
      });
    });
  }

  const personnelList = document.getElementById('personnelList');
  const addPersonBtn = document.getElementById('addPersonBtn');

  function addPerson(data=null) {
    if (!personnelList) return;

    const div = document.createElement('div');
    div.className = 'person-card';
    div.innerHTML = `
      <button class="delete-btn" type="button">✕</button>
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <label>Nama Personel</label>
        <label><input type="checkbox" class="is-company"> Syarikat?</label>
      </div>
      <input type="text" class="p-name" placeholder="NAMA PENUH">
      <div style="margin-top:5px;">
        <label>Jawatan:</label>
        <div style="display:flex; gap:8px;">
        <label><input type="checkbox" value="PENGARAH" class="role-cb"> PENGARAH</label>
        <label><input type="checkbox" value="P.EKUITI" class="role-cb"> P.EKUITI</label>
        <label><input type="checkbox" value="P.SPKK" class="role-cb"> P.SPKK</label>
        <label><input type="checkbox" value="T.T CEK" class="role-cb"> T.T CEK</label>
        </div>
      </div>
      <div style="margin-top:5px; border-top:1px dashed #ccc; padding-top:5px;">
        <div class="grid-equal">
          <div>
            <label>IC</label>
            <div class="status-input-container">
              <input type="text" class="status-ic status-input" maxlength="10" placeholder="-">
            </div>
          </div>
          <div>
            <label>SB</label>
            <div class="status-input-container">
              <input type="text" class="status-sb status-input" maxlength="10" placeholder="-">
            </div>
          </div>
        </div>
        <div class="grid-equal" style="margin-top:5px;">
          <div>
            <label>EPF</label>
            <div class="status-input-container">
              <input type="text" class="status-epf status-input" maxlength="10" placeholder="-">
            </div>
          </div>
        </div>
      </div>
    `;
    personnelList.appendChild(div);

    const docTypes = ['ic', 'sb', 'epf'];
    
    docTypes.forEach(type => {
      const input = div.querySelector(`.status-${type}`);
      if (input) {
        const tickContainer = document.createElement('div');
        tickContainer.className = 'tick-buttons';
        tickContainer.innerHTML = `
          <button type="button" class="tick-btn tick-right" title="Set OK">✓</button>
          <button type="button" class="tick-btn tick-wrong" title="Set X">✗</button>
        `;
        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(tickContainer);
        
        const tickRightBtn = tickContainer.querySelector('.tick-right');
        const tickWrongBtn = tickContainer.querySelector('.tick-wrong');
        
        if (tickRightBtn) {
          tickRightBtn.addEventListener('click', () => {
            input.value = '✓';
            input.style.backgroundColor = '#dcfce7';
            input.style.color = '#166534';
            input.dispatchEvent(new Event('input'));
            saveFormData();
          });
        }
        
        if (tickWrongBtn) {
          tickWrongBtn.addEventListener('click', () => {
            input.value = 'X';
            input.style.backgroundColor = '#fee2e2';
            input.style.color = '#991b1b';
            input.dispatchEvent(new Event('input'));
            saveFormData();
          });
        }
        
        input.addEventListener('input', saveFormData);
      }
    });

    div.querySelectorAll('.status-input').forEach(input => {
      input.addEventListener('input', (e) => { 
        e.target.value = e.target.value.toUpperCase(); 
        saveFormData();
      });
    });

    const nameInput = div.querySelector('.p-name');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
        saveFormData();
      });
    }

    div.querySelectorAll('.role-cb, .is-company').forEach(cb => {
      cb.addEventListener('change', saveFormData);
    });

    if(data) {
      if (nameInput) nameInput.value = data.name || '';
      
      const isCompanyCheckbox = div.querySelector('.is-company');
      if (isCompanyCheckbox) isCompanyCheckbox.checked = data.isCompany || false;
      
      if(data.roles) {
        div.querySelectorAll('.role-cb').forEach(cb => {
          if(data.roles.includes(cb.value)) cb.checked = true;
        });
      }
      
      const statusIc = div.querySelector('.status-ic');
      const statusSb = div.querySelector('.status-sb');
      const statusEpf = div.querySelector('.status-epf');
      
      if (statusIc && data.s_ic) {
        statusIc.value = data.s_ic;
        if (data.s_ic === '✓') {
          statusIc.style.backgroundColor = '#dcfce7';
          statusIc.style.color = '#166534';
        } else if (data.s_ic === 'X') {
          statusIc.style.backgroundColor = '#fee2e2';
          statusIc.style.color = '#991b1b';
        }
      }
      if (statusSb && data.s_sb) {
        statusSb.value = data.s_sb;
        if (data.s_sb === '✓') {
          statusSb.style.backgroundColor = '#dcfce7';
          statusSb.style.color = '#166534';
        } else if (data.s_sb === 'X') {
          statusSb.style.backgroundColor = '#fee2e2';
          statusSb.style.color = '#991b1b';
        }
      }
      if (statusEpf && data.s_epf) {
        statusEpf.value = data.s_epf;
        if (data.s_epf === '✓') {
          statusEpf.style.backgroundColor = '#dcfce7';
          statusEpf.style.color = '#166534';
        } else if (data.s_epf === 'X') {
          statusEpf.style.backgroundColor = '#fee2e2';
          statusEpf.style.color = '#991b1b';
        }
      }
    }

    const deleteBtn = div.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => { 
        div.remove(); 
        saveFormData();
      });
    }
  }

  if(addPersonBtn) {
    addPersonBtn.addEventListener('click', () => { 
      addPerson(); 
      saveFormData();
    });
  }

  document.querySelectorAll('.konsultansi-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const dateInput = document.getElementById(e.target.id.replace('cb_', 'date_'));
      if (dateInput) {
        if (e.target.checked) {
          dateInput.style.display = 'block';
          if (!dateInput.value) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;
          }
        } else {
          dateInput.style.display = 'none';
          dateInput.value = '';
        }
      }
      saveDatabaseFormData();
    });
  });

  const btnToggleAlamat = document.getElementById('btnToggleAlamat');
  if (btnToggleAlamat) {
    btnToggleAlamat.addEventListener('click', () => {
      const dbAlamatPerniagaan = document.getElementById('db_alamat_perniagaan');
      if (dbAlamatPerniagaan) {
        if (dbAlamatPerniagaan.style.display === 'none') {
          dbAlamatPerniagaan.style.display = 'block';
          btnToggleAlamat.textContent = 'Sembunyi Alamat';
        } else {
          dbAlamatPerniagaan.style.display = 'none';
          btnToggleAlamat.textContent = 'Tunjuk Alamat';
        }
      }
    });
  }

  function formatKWSP(dateStr, status) {
    if (!dateStr && !status) return '';
    if (!dateStr && status) return `(${status})`;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 2) {
        return `${parts[1]}/${parts[0].slice(-2)} (${status || ''})`;
      }
    }
    return dateStr;
  }

  function formatDateDisplay(isoStr) {
    if(!isoStr) return '';
    if (isoStr.includes('✓')) return isoStr;
    if (isoStr.includes('/')) return isoStr; 

    const d = new Date(isoStr);
    if(isNaN(d)) return isoStr;
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  }

  if (btnPrintAdminStats) {
    btnPrintAdminStats.addEventListener('click', () => {
      showAdminStatsModal();
    });
  }
  
  if (adminStatsClose) {
    adminStatsClose.addEventListener('click', () => {
      adminStatsModal.classList.remove('active');
    });
  }
  
  if (btnPrintStatsModal) {
    btnPrintStatsModal.addEventListener('click', () => {
      window.print();
    });
  }
  
  if (btnAdminCsv) {
    btnAdminCsv.addEventListener('click', downloadAdminStatsCSV);
  }
  
  if (adminFilterMonth) {
    adminFilterMonth.addEventListener('change', () => {
      loadAdminDashboard();
    });
  }
  
  if (adminFilterYear) {
    adminFilterYear.addEventListener('change', () => {
      loadAdminDashboard();
    });
  }
  
  if (adminStatsModal) {
    adminStatsModal.addEventListener('click', (e) => {
      if (e.target === adminStatsModal) {
        adminStatsModal.classList.remove('active');
      }
    });
  }

  const dbSyorStatus = document.getElementById('db_syor_status');
  if (dbSyorStatus) {
    dbSyorStatus.addEventListener('change', (e) => {
      const val = e.target.value;
      if (labelDbSahSyor) {
        if (val !== '') {
          labelDbSahSyor.style.display = 'block';
        } else {
          labelDbSahSyor.style.display = 'none';
          if (dbSahSyor) dbSahSyor.checked = false;
        }
      }
    });
  }

  if (btnPergiCiptaProfile) {
    btnPergiCiptaProfile.addEventListener('click', () => {
      console.log("V6.5.2 btnPergiCiptaProfile clicked - Navigating to Profile tab and copying Drive link");
      
      const dbPautanValue = document.getElementById('db_pautan')?.value || '';
      
      switchTab('profile');
      
      if (dbPautanValue && dbPautanValue.trim() !== '') {
        const profilePautanDriveField = document.getElementById('profile_pautan_drive');
        if (profilePautanDriveField) {
          profilePautanDriveField.value = dbPautanValue;
          console.log("V6.5.2 Drive link copied to profile form:", dbPautanValue);
          
          const successMsg = document.createElement('div');
          successMsg.textContent = '✓ Pautan Drive telah disalin ke borang Profile';
          successMsg.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#10b981; color:white; padding:8px 16px; border-radius:8px; z-index:10000; font-size:0.9rem;';
          document.body.appendChild(successMsg);
          setTimeout(() => successMsg.remove(), 2000);
        } else {
          console.warn("V6.5.2 Profile Drive link input field not found");
        }
      } else {
        console.log("V6.5.2 No Drive link found in Input Database tab");
        const warningMsg = document.createElement('div');
        warningMsg.textContent = '⚠ Tiada pautan Drive di Input Database untuk disalin';
        warningMsg.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#f59e0b; color:white; padding:8px 16px; border-radius:8px; z-index:10000; font-size:0.9rem;';
        document.body.appendChild(warningMsg);
        setTimeout(() => warningMsg.remove(), 2000);
      }
    });
  }

  if (btnDownloadDashboardCsv) {
    btnDownloadDashboardCsv.addEventListener('click', downloadDashboardCSV);
  }

  setTimeout(() => {
    if (isAppReady) {
      initializeTickButtons();
      updateValidationCheckboxDisplay();
      updateDraftFilterButtons();
      updateSubmittedFilterButtons();
      updateHistoryFilterButtons();
      
      // HANYA TINGGALKAN SFX SAHAJA
      if (sfxVolumeSlider) sfxVolumeSlider.value = sfxVolume;
      if (sfxVolumeValue) sfxVolumeValue.textContent = Math.round(sfxVolume * 100) + '%';
    }
  }, 1000);

  document.addEventListener('visibilitychange', async () => {
    // Jika pengguna kembali ke tab ini, semak jika hari dah bertukar
    if (document.visibilityState === 'visible') {
      if (currentUser) {
        await checkDayChangeLogout();
      }
    } 
    // Jika pengguna pergi ke tab lain, buat auto-save
    else if (document.visibilityState === 'hidden' && currentUser && !isRestoring) {
      console.log('V6.5.2 Web App visibility hidden - melakukan auto-save terakhir');
      saveFormData();
      saveDatabaseFormData();
    }
  });

  window.addEventListener('pagehide', () => {
    if (currentUser && !isRestoring) {
      console.log('V6.5.2 Web App pagehide - melakukan auto-save terakhir');
      saveFormData();
      saveDatabaseFormData();
    }
  });

  window.addEventListener('blur', () => {
    if (currentUser && !isRestoring) {
      console.log('V6.5.2 Web App blur - melakukan auto-save terakhir');
      saveFormData();
      saveDatabaseFormData();
    }
  });
// =========================================================================
  // FUNGSI SEMAKAN CEPAT PERSONEL (QUICK CHECK) - DIKEMASKINI
  // =========================================================================
  const btnSemakCepat = document.getElementById('btnSemakCepat');
  const quickCheckModal = document.getElementById('quickCheckModal');
  const quickCheckClose = document.getElementById('quickCheckClose');
  const btnSelesaiQuickCheck = document.getElementById('btnSelesaiQuickCheck');
  const quickCheckContent = document.getElementById('quickCheckContent');

  if (btnSemakCepat) {
      btnSemakCepat.addEventListener('click', () => {
          playSoundEffect('ui_click.mp3');
          openQuickCheckModal();
      });
  }

  const closeQCModal = () => {
      if (quickCheckModal) quickCheckModal.style.display = 'none';
      playSoundEffect('ui_click.mp3');
  };
  
  if (quickCheckClose) quickCheckClose.addEventListener('click', closeQCModal);
  if (btnSelesaiQuickCheck) btnSelesaiQuickCheck.addEventListener('click', closeQCModal);

  function openQuickCheckModal() {
      if (!quickCheckContent) return;
      quickCheckContent.innerHTML = ''; 

      const cards = document.querySelectorAll('.person-card');

      if (cards.length === 0) {
          quickCheckContent.innerHTML = '<div style="text-align:center; color:#64748b; padding: 20px; font-weight: bold;">Tiada personel ditambah. Sila klik "Tambah Personel" di bawah.</div>';
      } else {
          cards.forEach((card, index) => {
              const nameInputOriginal = card.querySelector('.p-name');
              const name = nameInputOriginal?.value || '';
              const icInput = card.querySelector('.status-ic');
              const sbInput = card.querySelector('.status-sb');
              const epfInput = card.querySelector('.status-epf');

              if (!icInput || !sbInput || !epfInput) return; 
              
              const div = document.createElement('div');
              div.style.cssText = "background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); position: relative;";
              
              div.innerHTML = `
                  <button class="qc-btn-delete" data-index="${index}" style="position: absolute; top: 12px; right: 12px; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 6px; padding: 5px 10px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: all 0.2s;">🗑️ Buang</button>
                  
                  <div style="margin-bottom: 12px; border-bottom: 2px dashed #e2e8f0; padding-bottom: 12px; padding-right: 80px;">
                      <label style="font-size: 0.75rem; color: #64748b; font-weight: bold; margin-bottom: 5px; display: block;">NAMA PERSONEL:</label>
                      <div style="display: flex; align-items: center; gap: 8px;">
                          <span style="font-size: 1.2rem;">👤</span>
                          <input type="text" class="qc-input-name" value="${name}" placeholder="MASUKKAN NAMA" style="width: 100%; border: 1px solid #94a3b8; border-radius: 6px; padding: 8px 10px; font-weight: bold; font-size: 0.95rem; text-transform: uppercase; outline: none; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
                      </div>
                  </div>

                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
                      ${createQuickCheckFieldUI('IC', icInput.value, index, 'ic')}
                      ${createQuickCheckFieldUI('SB', sbInput.value, index, 'sb')}
                      ${createQuickCheckFieldUI('EPF', epfInput.value, index, 'epf')}
                  </div>
              `;
              quickCheckContent.appendChild(div);

              // 1. Fungsi Edit/Sync Nama Personel
              const qcNameInput = div.querySelector('.qc-input-name');
              qcNameInput.addEventListener('input', (e) => {
                  e.target.value = e.target.value.toUpperCase();
                  if (nameInputOriginal) {
                      nameInputOriginal.value = e.target.value;
                      nameInputOriginal.dispatchEvent(new Event('input', { bubbles: true }));
                      saveFormData();
                  }
              });

              // 2. Fungsi Buang Personel
              const delBtn = div.querySelector('.qc-btn-delete');
              delBtn.addEventListener('click', () => {
                  if (confirm("Adakah anda pasti mahu membuang personel ini?")) {
                      card.remove(); // Buang kotak di borang asal
                      saveFormData();
                      openQuickCheckModal(); // Refresh modal
                  }
              });
              
              // 3. Fungsi Menaip dan Butang (✓/✗)
              ['ic', 'sb', 'epf'].forEach(type => {
                  const btnRight = div.querySelector(`.qc-btn-right-${type}-${index}`);
                  const btnWrong = div.querySelector(`.qc-btn-wrong-${type}-${index}`);
                  const displayInput = div.querySelector(`.qc-input-${type}-${index}`);
                  const originalInput = card.querySelector(`.status-${type}`);
                  
                  // Benarkan pengguna menaip sendiri (contoh: "TIDAK BERKAITAN")
                  displayInput.addEventListener('input', (e) => {
                      const val = e.target.value.toUpperCase();
                      e.target.value = val;
                      originalInput.value = val;
                      
                      // Tukar warna secara automatik jika mereka menaip ✓ atau X
                      if (val === '✓') {
                          displayInput.style.backgroundColor = '#dcfce7'; displayInput.style.color = '#166534';
                          originalInput.style.backgroundColor = '#dcfce7'; originalInput.style.color = '#166534';
                      } else if (val === 'X' || val === '✗') {
                          displayInput.style.backgroundColor = '#fee2e2'; displayInput.style.color = '#991b1b';
                          originalInput.style.backgroundColor = '#fee2e2'; originalInput.style.color = '#991b1b';
                      } else {
                          displayInput.style.backgroundColor = '#eff6ff'; displayInput.style.color = '#1e40af';
                          originalInput.style.backgroundColor = '#eff6ff'; originalInput.style.color = '#1e40af';
                      }
                      
                      originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                      saveFormData();
                  });

                  const updateStatus = (statusVal, bgColor, textColor) => {
                      displayInput.value = statusVal;
                      displayInput.style.backgroundColor = bgColor;
                      displayInput.style.color = textColor;
                      
                      originalInput.value = statusVal;
                      originalInput.style.backgroundColor = bgColor;
                      originalInput.style.color = textColor;
                      originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                      saveFormData();
                  };

                  if (btnRight) {
                      btnRight.addEventListener('click', () => updateStatus('✓', '#dcfce7', '#166534'));
                  }
                  if (btnWrong) {
                      btnWrong.addEventListener('click', () => updateStatus('X', '#fee2e2', '#991b1b'));
                  }
              });
          });
      }

      // 4. Tambah Butang "Tambah Personel" di bahagian bawah Modal
      const addBtnContainer = document.createElement('div');
      addBtnContainer.style.textAlign = 'center';
      addBtnContainer.style.marginTop = '20px';
      addBtnContainer.innerHTML = `<button class="btn btn-blue" style="padding: 12px 25px; font-size: 0.95rem; border-radius: 30px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);">+ Tambah Personel Baru</button>`;
      
      addBtnContainer.querySelector('button').addEventListener('click', () => {
          addPerson(); // Fungsi sistem asal untuk tambah kad
          saveFormData();
          openQuickCheckModal(); // Refresh modal supaya kotak baru muncul
          
          // Automatik scroll ke bawah supaya nampak personel baru ditambah
          setTimeout(() => {
              if (quickCheckContent) {
                  quickCheckContent.scrollTop = quickCheckContent.scrollHeight;
              }
          }, 100);
      });

      quickCheckContent.appendChild(addBtnContainer);
      quickCheckModal.style.display = 'flex';
  }

  function createQuickCheckFieldUI(label, value, index, type) {
      let bg = '#eff6ff';
      let color = '#1e40af';
      if (value === '✓') { bg = '#dcfce7'; color = '#166534'; }
      else if (value === 'X' || value === '✗') { bg = '#fee2e2'; color = '#991b1b'; }
      
      // 'readonly' telah dibuang dan 'placeholder' diletakkan
      return `
          <div style="background: white; border: 1px solid #e5e7eb; padding: 10px; border-radius: 8px;">
              <label style="font-size: 0.8rem; font-weight: bold; color: #64748b; margin-bottom: 5px; display: block;">${label}</label>
              <div style="position: relative; display: flex; height: 38px;">
                  <input type="text" class="qc-input-${type}-${index}" value="${value}" placeholder="Catatan..." style="width: 100%; padding: 0 70px 0 10px; font-weight: bold; font-size: 0.9rem; text-align: left; border: 1px solid #cbd5e1; border-radius: 6px; background-color: ${bg}; color: ${color}; outline: none; text-transform: uppercase;">
                  <div style="position: absolute; right: 3px; top: 3px; display: flex; gap: 4px; height: calc(100% - 6px);">
                      <button type="button" class="qc-btn-right-${type}-${index}" title="Lengkap" style="width: 30px; border: none; border-radius: 4px; background: linear-gradient(135deg, #10b981, #059669); color: white; cursor: pointer; font-weight: bold; font-size: 1.1rem;">✓</button>
                      <button type="button" class="qc-btn-wrong-${type}-${index}" title="Tidak Lengkap" style="width: 30px; border: none; border-radius: 4px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; cursor: pointer; font-weight: bold; font-size: 1.1rem;">✗</button>
                  </div>
              </div>
          </div>
      `;
  }
  // =========================================================================
  // FUNGSI JAM DIGITAL (WAKTU & HARI & TARIKH MALAYSIA)
  // =========================================================================
  function startDigitalClock() {
      const clockEl = document.getElementById('digitalClock');
      if (!clockEl) return;

      const hariDalamBM = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      const bulanDalamBM = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

      setInterval(() => {
          const now = new Date();
          
          // Dapatkan Hari & Tarikh
          const hari = hariDalamBM[now.getDay()];
          const tarikh = now.getDate();
          const bulan = bulanDalamBM[now.getMonth()];
          const tahun = now.getFullYear();
          
          // Dapatkan Masa
          let jam = now.getHours();
          let minit = now.getMinutes();
          let saat = now.getSeconds();
          
          // Tentukan AM / PM
          const ampm = jam >= 12 ? 'PM' : 'AM';
          
          // Tukar Format 24-jam ke 12-jam
          jam = jam % 12;
          jam = jam ? jam : 12; // Jika jam 0, jadikan ia 12
          
          // Tambah '0' di depan jika nombor kurang dari 10
          minit = minit < 10 ? '0' + minit : minit;
          saat = saat < 10 ? '0' + saat : saat;
          
          // Paparkan ke skrin (Hari, Tarikh Bulan Tahun | Masa AM/PM)
          clockEl.innerHTML = `🗓️ ${hari}, ${tarikh} ${bulan} ${tahun} <span style="color:#cbd5e1; margin: 0 6px;">|</span> ⏱️ ${jam}:${minit}:${saat} ${ampm}`;
      }, 1000); // Bergerak setiap 1 saat
  }

  // Mulakan jam sebaik sahaja sistem dimuatkan
  startDigitalClock();
  
  // --- KOD BARU: Plugin Carta Hidup (Breathing Effect) ---
  const alivePlugin = {
    id: 'alivePlugin',
    beforeDraw: (chart) => {
      // Pastikan chart.ctx wujud sebelum draw
      if (chart.options.plugins.alive?.enabled && chart.ctx) {
        const timestamp = Date.now();
        // Cipta pergerakan sinus yang sangat halus (scale antara 0.99 ke 1.01)
        const scale = 1 + Math.sin(timestamp / 1000) * 0.01;
        const ctx = chart.ctx;
        ctx.save();
        ctx.translate(chart.width / 2, chart.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-chart.width / 2, -chart.height / 2);
      }
    },
    afterDraw: (chart) => {
      if (chart.options.plugins.alive?.enabled && chart.ctx) {
        chart.ctx.restore();
        // Arahkan browser lukis semula HANYA jika canvas masih aktif/wujud
        requestAnimationFrame(() => {
          if (chart && chart.canvas && chart.ctx) {
            chart.render();
          }
        });
      }
    }
  };
  Chart.register(alivePlugin);
  // =========================================================================
  // FUNGSI WARNA FORM DINAMIK (KOSONG vs DIISI)
  // =========================================================================
  function applyDynamicFormColors() {
      // Tab utama yang mengandungi borang
      const formContainers = ['tab-checker', 'tab-database', 'tab-profile', 'tab-pelulus-action'];
      
      formContainers.forEach(tabId => {
          const tab = document.getElementById(tabId);
          if (!tab) return;
          
          // Pilih semua elemen input, select dan textarea (Kecuali butang radio, file, checkbox & hidden)
          const fields = tab.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not([hidden]), select, textarea');
          
          fields.forEach(field => {
              // Abaikan field tertentu yang kita tak nak ubah warnanya (contoh: readonly, field status ✔/✗)
              if (field.readOnly || field.disabled || field.classList.contains('status-input') || field.id === 'db_pautan') {
                  field.classList.remove('form-empty', 'form-filled');
                  return;
              }
              
              // Jika ruangan mempunyai teks/nilai
              if (field.value && field.value.trim() !== '') {
                  if (!field.classList.contains('form-filled')) {
                      field.classList.remove('form-empty');
                      field.classList.add('form-filled');
                  }
              } 
              // Jika ruangan kosong
              else {
                  if (!field.classList.contains('form-empty')) {
                      field.classList.remove('form-filled');
                      field.classList.add('form-empty');
                  }
              }
          });
      });
  }

  // 1. Pantau setiap kali pengguna menaip / pilih sesuatu (Real-time)
  document.addEventListener('input', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) applyDynamicFormColors();
  });
  
  document.addEventListener('change', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) applyDynamicFormColors();
  });

  // 2. Semak secara automatik setiap 1 saat (Berguna bila borang diisi automatik oleh AI/Database)
  setInterval(applyDynamicFormColors, 1000);
  
  // Panggil sekali sewaktu sistem mula dibuka
  setTimeout(applyDynamicFormColors, 500);
  // =========================================================================
  // LOGIK TAPISAN EXCEL & BAKUL PERMOHONAN (PENGESYOR)
  // =========================================================================

  let globalBakulData = [];

  // FUNGSI BANTUAN: Menyamakan format tarikh Excel (DD/MM/YYYY) ke Database (YYYY-MM-DD)
  function normalizeDateToDBFormat(dateStr) {
      if (!dateStr) return '';
      if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
      }
      return dateStr;
  }

  document.addEventListener('change', (e) => {
      // UPLOAD EXCEL
      if (e.target.id === 'excelFileInput') {
          
          // KEMASKINI 1: Sekat upload jika data tapisan (rules) belum siap di-load dari Firebase
          if (currentUser && currentUser.role === 'PENGESYOR' && !firebaseUserRules) {
              alert("⏳ Sistem sedang mendapatkan peraturan tapisan peribadi anda. Sila tunggu 2-3 saat dan klik 'Pilih Fail Excel' sekali lagi.");
              e.target.value = ''; 
              return;
          }

          const file = e.target.files[0];
          if (!file) return;
          
          const nameLabel = document.getElementById('excelFileName');
          if (nameLabel) nameLabel.innerText = file.name;
          
          simulateLoadingWithSteps(['Membaca fail Excel...', 'Menapis data berdasarkan ketetapan anda...'], 'Sila Tunggu');
          
          const reader = new FileReader();
          reader.onload = (evt) => {
              try {
                  const data = new Uint8Array(evt.target.result);
                  const workbook = XLSX.read(data, { type: 'array' });
                  const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
                  processExcelForTapisan(jsonData);
              } catch (error) {
                  alert("Ralat membaca fail Excel. Pastikan ia format .xlsx yang betul.");
              } finally {
                  hideLoading();
                  e.target.value = ''; 
              }
          };
          reader.readAsArrayBuffer(file);
      }
      
      // SELECT ALL DI EXCEL
      if (e.target.id === 'selectAllExcelRows') {
          document.querySelectorAll('.excel-row-check:not(:disabled)').forEach(cb => cb.checked = e.target.checked);
      }
  });

  function processExcelForTapisan(rawData) {
      if (rawData.length < 2) return;
      const headers = rawData[0].map(h => String(h).toLowerCase().trim());
      
      // KEMASKINI: Cari kolum dengan lebih spesifik. 'update type' sahaja, abaikan 'category'. 
      // Tambah 'disctrict' untuk menyokong format typo dari CIDB.
      const keys = {
          company: headers.findIndex(h => h.includes('syarikat') || h.includes('company') || h.includes('nama')),
          grade: headers.findIndex(h => h.includes('gred') || h.includes('grade')),
          cidb: headers.findIndex(h => h.includes('cidb') || h.includes('reg') || h.includes('pendaftar')),
          district: headers.findIndex(h => h.includes('daerah') || h.includes('district') || h.includes('negeri') || h.includes('disctrict')),
          date: headers.findIndex(h => h.includes('tarikh') || h.includes('date') || h.includes('submitted')),
          updateType: headers.findIndex(h => h.includes('update type') || h === 'update type' || h.includes('jenis perubahan'))
      };

      if (keys.company === -1 || keys.grade === -1 || keys.cidb === -1) {
          CustomAppModal.alert("Format Excel tidak sah. Mesti ada kolum Syarikat, Gred, dan Reg. No/CIDB.", "Ralat Format", "error");
          return;
      }

      const gradeRegex = /^G[4-7]/i;
      const numberMap = {'0':'K', '1':'S', '2':'D', '3':'T', '4':'E', '5':'L', '6':'E', '7':'T', '8':'L', '9':'S'};

      excelRawData = rawData.slice(1).filter(row => {
          const g = String(row[keys.grade] || '').trim();
          if (!gradeRegex.test(g)) return false; 
          
          // LOGIK KETAT UNTUK PENGESYOR: Pastikan peraturan wujud sebelum membenarkan data dipaparkan
          if (currentUser && currentUser.role === 'PENGESYOR') {
              // Jika tiada peraturan dikesan langsung untuk pengesyor ini, HALANG SEMUA
              if (!firebaseUserRules || !firebaseUserRules.cidbEndsWith || firebaseUserRules.cidbEndsWith.length === 0) {
                  return false; 
              }

              const cidbStr = String(row[keys.cidb] || '').trim();
              const lastDigit = cidbStr.slice(-1);
              
              // Tapisan 1: Hujung nombor CIDB
              if (!firebaseUserRules.cidbEndsWith.includes(lastDigit)) return false;
              
              // Tapisan 2: Huruf abjad pertama (Alpha split)
              if (firebaseUserRules.alphaSplit && firebaseUserRules.alphaSplit[lastDigit]) {
                  const [start, end] = firebaseUserRules.alphaSplit[lastDigit].split('-');
                  let first = String(row[keys.company] || '').trim().toUpperCase().charAt(0);
                  if (/[0-9]/.test(first)) first = numberMap[first] || first;
                  if (first < start || first > end) return false;
              }
          }
          
          // Lulus hanya jika syarat di atas dipenuhi (Atau jika user adalah Admin/Ketua Seksyen)
          return true; 
          
      }).map((row, idx) => {
          let dateStr = '-';
          let rawSortDate = new Date(1970, 0, 1);
          if (row[keys.date]) {
              if (typeof row[keys.date] === 'number') {
                  rawSortDate = new Date(Math.round((row[keys.date] - 25569) * 86400 * 1000));
                  dateStr = rawSortDate.toLocaleDateString('en-GB');
              } else {
                  dateStr = String(row[keys.date]);
                  const parts = dateStr.split('/');
                  if(parts.length === 3) rawSortDate = new Date(parts[2], parts[1]-1, parts[0]);
              }
          }
          return {
              id: idx,
              company: String(row[keys.company] || '-').trim().toUpperCase(),
              cidb: String(row[keys.cidb] || '-').trim(),
              district: keys.district !== -1 ? String(row[keys.district] || '-').trim().toUpperCase() : '-',
              grade: String(row[keys.grade] || '-').trim().toUpperCase(),
              dateSubmitted: dateStr,
              rawSortDate: rawSortDate,
              // Jika tiada Update Type dalam Excel (contoh: fail 56), ia akan simpan sebagai '-'
              updateType: keys.updateType !== -1 && row[keys.updateType] ? String(row[keys.updateType]).trim() : '-'
          };
      });

      allExcelDistricts = [...new Set(excelRawData.map(d => d.district))].filter(d => d && d !== '-').sort();
      selectedExcelDistricts = new Set(allExcelDistricts);
      
      renderExcelDistrictButtons();
      renderExcelTable();
      
      document.getElementById('districtFilterContainer').style.display = 'block';
      document.getElementById('excelResultsContainer').style.display = 'block';
  }

  function renderExcelDistrictButtons() {
      const container = document.getElementById('districtGrid');
      if(!container) return;
      container.innerHTML = '';
      
      allExcelDistricts.forEach(d => {
          const isActive = selectedExcelDistricts.has(d);
          const btn = document.createElement('button');
          
          // KEMASKINI 1: Besarkan sikit saiz butang (padding dan font-size)
          btn.style.padding = '10px 20px'; 
          btn.style.borderRadius = '8px';
          btn.style.fontWeight = 'bold';
          btn.style.fontSize = '0.95rem';
          btn.style.border = 'none';
          btn.style.cursor = 'pointer';
          btn.style.transition = 'all 0.2s ease';
          
          if(isActive) {
              // KEMASKINI 2: Gunakan warna tema pengesyor (--theme-color) berbanding warna oren tetap
              btn.style.backgroundColor = 'var(--theme-color)';
              btn.style.color = 'white';
              btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'; // Timbul sikit bila aktif
          } else {
              btn.style.backgroundColor = '#e2e8f0';
              btn.style.color = '#475569';
              btn.style.boxShadow = 'none';
          }
          
          btn.innerText = d;
          
          // Efek hover supaya nampak lebih interaktif
          btn.onmouseover = () => {
              if (!isActive) btn.style.backgroundColor = '#cbd5e1';
          };
          btn.onmouseout = () => {
              if (!isActive) btn.style.backgroundColor = '#e2e8f0';
          };

          btn.onclick = () => {
              if (selectedExcelDistricts.has(d)) selectedExcelDistricts.delete(d);
              else selectedExcelDistricts.add(d);
              renderExcelDistrictButtons();
              renderExcelTable();
          };
          container.appendChild(btn);
      });
  }

  const btnSelectAllDistricts = document.getElementById('btnSelectAllDistricts');
  if(btnSelectAllDistricts){
    btnSelectAllDistricts.addEventListener('click', () => {
        if (selectedExcelDistricts.size === allExcelDistricts.length) {
            selectedExcelDistricts.clear();
            btnSelectAllDistricts.innerText = "Pilih Semua";
        } else {
            selectedExcelDistricts = new Set(allExcelDistricts);
            btnSelectAllDistricts.innerText = "✓ Kosongkan";
        }
        renderExcelDistrictButtons();
        renderExcelTable();
    });
  }

  function renderExcelTable() {
      const tbody = document.getElementById('excelTableBody');
      const filtered = excelRawData.filter(d => selectedExcelDistricts.has(d.district));
      document.getElementById('excelRowCount').innerText = filtered.length;
      
      tbody.innerHTML = filtered.map(item => {
          let rowColorClass = '';
          const tLower = (item.updateType || '').toLowerCase();
          if(tLower.includes('baru')) rowColorClass = 'row-new';
          else if(tLower.includes('pembaharuan') || tLower.includes('renewal')) rowColorClass = 'row-renewal';
          else if(tLower.includes('maklumat') || tLower.includes('info')) rowColorClass = 'row-info';
          else if(tLower.includes('gred') || tLower.includes('grade')) rowColorClass = 'row-grade';

          // KEMASKINI: Semakan status yang ketat (CIDB + Tarikh Mohon)
          const normExcelDate = normalizeDateToDBFormat(item.dateSubmitted);
          
          let isProcessed = false;
          let inDrafts = false;

          if (cachedData) {
              for (let c of cachedData) {
                  // Mesti CIDB sama DAN Tarikh Mohon sama
                  if (c.cidb === item.cidb && c.start_date === normExcelDate) {
                      if (c.tarikh_syor && c.tarikh_syor.trim() !== '') {
                          isProcessed = true;
                      } else {
                          inDrafts = true;
                      }
                      break;
                  }
              }
          }

          const inBasket = globalBakulData.some(b => b.cidb === item.cidb && normalizeDateToDBFormat(b.dateSubmitted) === normExcelDate);

          let statusBadge = '';
          let disableCheckbox = false;

          if (isProcessed) {
              statusBadge = `<span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">✅ Telah Disyor</span>`;
              disableCheckbox = true;
          } else if (inDrafts) {
              statusBadge = `<span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">📝 Belum Hantar</span>`;
              disableCheckbox = true;
          } else if (inBasket) {
              statusBadge = `<span style="background: #f59e0b; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">🛒 Dalam Bakul</span>`;
              disableCheckbox = true;
          } else {
              statusBadge = `<span style="background: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">✨ Baru</span>`;
          }

          const checkboxHtml = disableCheckbox 
              ? `<input type="checkbox" disabled style="transform: scale(1.2); opacity: 0.3;" title="Telah ada dalam sistem/bakul">`
              : `<input type="checkbox" class="excel-row-check" value="${item.id}" style="transform: scale(1.2);">`;

          return `
          <tr class="${rowColorClass}" style="border-bottom: 1px solid #f1f5f9; ${disableCheckbox ? 'opacity: 0.6;' : ''}">
              <td style="text-align:center;">${checkboxHtml}</td>
              <td style="font-weight:bold; color: #1e293b;">${item.company}</td>
              <td style="color: #475569;">${item.cidb}</td>
              <td>${item.district}</td>
              <td style="font-weight:bold; color: #f59e0b;">${item.grade}</td>
              <td><span style="font-weight:600; color:#475569;">${item.dateSubmitted}</span></td>
              <td><span style="background: rgba(255,255,255,0.7); color: #333; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; border: 1px solid #cbd5e1;">${item.updateType}</span></td>
              <td style="text-align:center;">${statusBadge}</td>
          </tr>
          `;
      }).join('');
  }

  // =========================================================================
  // LOGIK MODAL BAKUL & SIMPAN KE FIREBASE
  // =========================================================================
  const btnSaveToBasket = document.getElementById('btnSaveToBasket');
  const typeModalBakul = document.getElementById('type-modal-bakul');
  const btnCancelBakulModal = document.getElementById('btnCancelBakulModal');
  const btnConfirmBakulModal = document.getElementById('btnConfirmBakulModal');

  if (btnSaveToBasket) {
      btnSaveToBasket.addEventListener('click', async () => {
          if (!currentUserFirebaseCode) {
              await CustomAppModal.alert("Akaun anda tiada kod tapisan dikesan. Anda tidak boleh menyimpan ke bakul.", "Akses Ditolak", "error");
              return;
          }
          const checked = document.querySelectorAll('.excel-row-check:checked');
          if (checked.length === 0) {
              await CustomAppModal.alert("Sila tick kotak permohonan yang ingin disimpan terlebih dahulu.", "Pilih Permohonan", "warning");
              return;
          }
          
          document.getElementById('modal-bakul-count').innerText = checked.length;
          if (typeModalBakul) typeModalBakul.style.display = 'flex';
      });
  }

  if (btnCancelBakulModal) {
      btnCancelBakulModal.addEventListener('click', () => {
          if (typeModalBakul) typeModalBakul.style.display = 'none';
      });
  }

  if (btnConfirmBakulModal) {
      btnConfirmBakulModal.addEventListener('click', async () => {
          const checked = document.querySelectorAll('.excel-row-check:checked');
          const selectedType = document.getElementById('modal-bakul-type-select').value;
          
          btnConfirmBakulModal.innerText = "Menyimpan...";
          btnConfirmBakulModal.disabled = true;

          const idMap = new Map(excelRawData.map(i => [i.id, i]));
          const batch = [];
          
          checked.forEach(cb => {
              const item = idMap.get(parseInt(cb.value));
              if(item) {
                  let typeToSave = selectedType;
                  if (item.updateType && item.updateType !== '-') {
                      typeToSave = `${selectedType} (${item.updateType})`;
                  }
                  
                  batch.push(dbFirestore.collection("applications").add({
                      company: item.company,
                      cidb: item.cidb,
                      grade: item.grade,
                      district: item.district,
                      type: typeToSave,
                      dateSubmitted: item.dateSubmitted,
                      sortableDate: firebase.firestore.Timestamp.fromDate(item.rawSortDate),
                      status: 'Pending',
                      processedBy: currentUserFirebaseCode,
                      processorName: currentUser.name,
                      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                      addedToBasketAt: firebase.firestore.FieldValue.serverTimestamp(),
                  }));
              }
          });

          try {
              await Promise.all(batch);
              playSoundEffect('positive_chime.mp3');
              
              checked.forEach(cb => cb.checked = false);
              const checkAllBox = document.getElementById('selectAllExcelRows');
              if(checkAllBox) checkAllBox.checked = false;
              
              if (typeModalBakul) typeModalBakul.style.display = 'none';
              switchTab('tab-bakul');
              
              // GUNA MODAL BARU
              await CustomAppModal.alert(`${batch.length} permohonan telah berjaya dimasukkan ke Bakul!`, "Berjaya Disimpan", "success");
              
          } catch(e) {
              console.error("Gagal simpan ke bakul:", e);
              playSoundEffect('error_buzz.mp3');
              // GUNA MODAL BARU
              await CustomAppModal.alert("Ralat sistem. Gagal menyimpan ke bakul Firebase.", "Ralat", "error");
          } finally {
              btnConfirmBakulModal.innerText = "Simpan";
              btnConfirmBakulModal.disabled = false;
          }
      });
  }

  // FUNGSI BAKUL & FIREBASE LISTENER
  function subscribeToBakulFirebase() {
      if (bakulUnsubscribe) bakulUnsubscribe();
      
      bakulUnsubscribe = dbFirestore.collection("applications")
          .where("processedBy", "==", currentUserFirebaseCode)
          .where("status", "==", "Pending")
          .onSnapshot((snap) => {
              const bakulData = [];
              snap.forEach(doc => {
                  bakulData.push({ id: doc.id, ...doc.data() });
              });
              
              // KEMASKINI: Auto-cleanup Firebase Bakul dengan syarat ketat (CIDB + Tarikh)
              const validBakulData = [];
              bakulData.forEach(d => {
                  const normBDate = normalizeDateToDBFormat(d.dateSubmitted);
                  let shouldDelete = false;

                  if (cachedData) {
                      for (let c of cachedData) {
                          // Jika CIDB dan Tarikh Mohon adalah sama
                          if (c.cidb === d.cidb && c.start_date === normBDate) {
                              // Kita boleh anggap ia telah diproses jika ia berada di sistem (Drafts/Submitted)
                              shouldDelete = true;
                              break;
                          }
                      }
                  }

                  if (shouldDelete) {
                      dbFirestore.collection("applications").doc(d.id).delete().catch(err => console.log(err));
                  } else {
                      validBakulData.push(d);
                  }
              });

              globalBakulData = validBakulData;

              // Susun terbaharu di atas
              validBakulData.sort((a, b) => {
                  const timeA = a.addedToBasketAt ? a.addedToBasketAt.seconds : 0;
                  const timeB = b.addedToBasketAt ? b.addedToBasketAt.seconds : 0;
                  return timeB - timeA;
              });

              const badge = document.getElementById('bakulCountBadge');
              if (badge) badge.innerText = validBakulData.length;
              
              const tbody = document.getElementById('bakulTableBody');
              if (!tbody) return;

              if(validBakulData.length === 0) {
                  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color:#94a3b8; font-style: italic;">Bakul Kosong. Sila tapis dan tambah dari Tapisan Excel.</td></tr>`;
              } else {
                  tbody.innerHTML = validBakulData.map(d => {
                      let rowColorClass = '';
                      const tLower = (d.type || '').toLowerCase();
                      if(tLower.includes('baru')) rowColorClass = 'row-new';
                      else if(tLower.includes('pembaharuan') || tLower.includes('renewal')) rowColorClass = 'row-renewal';
                      else if(tLower.includes('maklumat') || tLower.includes('info')) rowColorClass = 'row-info';
                      else if(tLower.includes('gred') || tLower.includes('grade')) rowColorClass = 'row-grade';

                      return `
                      <tr class="${rowColorClass}" style="border-bottom: 1px solid #f1f5f9;">
                          <td style="font-weight:bold; color: #1e3a8a; font-size: 1.05rem;">${d.company}</td>
                          <td>
                              <span style="font-weight:bold; color: #f59e0b;">${d.grade}</span> <br>
                              <span style="font-size:0.85rem; color:#64748b; font-family: monospace;">${d.cidb}</span>
                          </td>
                          <td>${d.district}</td>
                          <td><span style="background: rgba(255,255,255,0.7); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; border: 1px solid #cbd5e1; color:#333; font-weight:bold;">${d.type}</span></td>
                          <td><span style="font-weight:600; color:#475569;">${d.dateSubmitted || '-'}</span></td>
                          <td>
                              <div style="display: flex; gap: 8px;">
                                  <button class="btn btn-blue btn-proses-bakul" style="padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; flex: 1;" 
                                      data-id="${d.id}" 
                                      data-company="${(d.company || '').replace(/"/g, '&quot;')}" 
                                      data-cidb="${d.cidb || ''}" 
                                      data-grade="${d.grade || ''}" 
                                      data-type="${(d.type || '').replace(/"/g, '&quot;')}"
                                      data-date="${d.dateSubmitted || ''}">Proses</button>
                                  <button class="btn btn-delete btn-padam-bakul" style="padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; background: #ef4444;" data-id="${d.id}">Padam</button>
                              </div>
                          </td>
                      </tr>
                      `;
                  }).join('');
              }

              // Update lencana di Tapisan Excel
              if (document.getElementById('tab-tapisan').classList.contains('active')) {
                  if (typeof renderExcelTable === 'function') renderExcelTable();
              }
          });
  }

  // =========================================================================
  // Event Delegation untuk Bakul
  // =========================================================================
  const bakulTableBody = document.getElementById('bakulTableBody');
  if (bakulTableBody && !bakulTableBody.hasAttribute('data-listener-bakul')) {
      bakulTableBody.setAttribute('data-listener-bakul', 'true');
      bakulTableBody.addEventListener('click', async (e) => {
          const prosesBtn = e.target.closest('.btn-proses-bakul');
          const padamBtn = e.target.closest('.btn-padam-bakul');

          if (padamBtn) {
              const docId = padamBtn.getAttribute('data-id');
              
              const isPadam = await CustomAppModal.confirm(
                  "Adakah anda pasti mahu memadam permohonan ini dari bakul? Ia akan dipadam selamanya.", 
                  "Padam Dari Bakul", 
                  "warning", 
                  "Ya, Padam", 
                  true
              );
              
              if(isPadam) {
                  try {
                      await dbFirestore.collection("applications").doc(docId).delete();
                      playSoundEffect('positive_chime.mp3');
                  } catch(err) {
                      console.error("Gagal padam:", err);
                      CustomAppModal.alert("Gagal memadam permohonan dari bakul Firebase.", "Ralat", "error");
                  }
              }
          } else if (prosesBtn) {
              playSoundEffect('ui_click.mp3');
              const docId = prosesBtn.getAttribute('data-id');
              const company = prosesBtn.getAttribute('data-company');
              const cidb = prosesBtn.getAttribute('data-cidb');
              const grade = prosesBtn.getAttribute('data-grade');
              const type = prosesBtn.getAttribute('data-type');
              const dateSubmitted = prosesBtn.getAttribute('data-date');

              const hasUnsaved = checkUnsavedData();
              if (hasUnsaved) {
                  const isConfirmedOverwrite = await CustomAppModal.confirm(
                      "Borang semakan anda sekarang mempunyai data. Anda pasti mahu overwrite (timpa) borang ini?",
                      "Data Belum Disimpan",
                      "warning",
                      "Ya, Timpa",
                      true
                  );
                  if (!isConfirmedOverwrite) {
                      return;
                  }
                  await resetFormForEdit();
              }

              // 1. Set Borang Semakan (Tab Checker)
              document.getElementById('borang_syarikat').value = company;
              document.getElementById('borang_cidb').value = cidb;
              const gredSelect = document.getElementById('borang_gred');
              if(gredSelect) {
                  for(let i=0; i<gredSelect.options.length; i++) {
                      if(gredSelect.options[i].value === grade.toUpperCase()) gredSelect.selectedIndex = i;
                  }
              }
              
              const tLower = type.toLowerCase();
              let radioVal = 'baru';
              if(tLower.includes('pembaharuan') || tLower.includes('renewal')) radioVal = 'pembaharuan';
              else if(tLower.includes('maklumat') || tLower.includes('info')) radioVal = 'ubah_maklumat';
              else if(tLower.includes('gred') || tLower.includes('grade')) radioVal = 'ubah_gred';
              
              const radios = document.getElementsByName('jenisApp');
              for(let r of radios) {
                  r.checked = (r.value === radioVal);
              }

              if(radioVal === 'ubah_maklumat') {
                  document.getElementById('input_ubah_maklumat').style.display = 'block';
                  let specInfo = type;
                  if (type.includes('(')) specInfo = type.split('(')[1].replace(')', '').trim();
                  document.getElementById('input_ubah_maklumat').value = specInfo;
              }
              if(radioVal === 'ubah_gred') {
                  document.getElementById('input_ubah_gred').style.display = 'block';
                  let specInfo = type;
                  if (type.includes('(')) specInfo = type.split('(')[1].replace(')', '').trim();
                  document.getElementById('input_ubah_gred').value = specInfo;
              }

              if (dateSubmitted && dateSubmitted !== '-') {
                  const parts = dateSubmitted.split('/');
                  if (parts.length === 3) {
                      const formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                      const bTarikh = document.getElementById('borang_tarikh_mohon');
                      const dbTarikh = document.getElementById('db_start_date');
                      if(bTarikh) bTarikh.value = formattedDate;
                      if(dbTarikh) dbTarikh.value = formattedDate;
                  }
              }

              // 2. Set Database Form
              document.getElementById('db_syarikat').value = company;
              document.getElementById('db_cidb').value = cidb;
              const dbGredSelect = document.getElementById('db_gred');
              if(dbGredSelect) {
                  for(let i=0; i<dbGredSelect.options.length; i++) {
                      if(dbGredSelect.options[i].value === grade.toUpperCase()) dbGredSelect.selectedIndex = i;
                  }
              }

              try {
                  await dbFirestore.collection("applications").doc(docId).update({
                      status: 'Processed',
                      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
              } catch(err) {
                  console.error("Gagal update status bakul:", err);
              }

              saveFormData();
              saveDatabaseFormData();

              switchTab('stb');
              
              // PENGGUNAAN MODAL BARU
              await CustomAppModal.alert("Maklumat Syarikat dari Bakul telah diisi secara automatik ke dalam Borang Semakan!", "Berjaya Dipindahkan", "success");
          }
      });
  }
  // =========================================================================
  // FUNGSI QUEUE SPI MODAL
  // =========================================================================
  const btnQueueSPI = document.getElementById('btnQueueSPI');
  const queueSpiModal = document.getElementById('queueSpiModal');
  const queueSpiClose = document.getElementById('queueSpiClose');
  
  if (btnQueueSPI) {
      btnQueueSPI.addEventListener('click', async () => {
          
          // 1. Gunakan fungsi animasi berperingkat (0% - 100%)
          simulateLoadingWithSteps(
              ['Menyambung ke pelayan...', 'Menyemak Queue Siasatan Biasa...', 'Menyemak Queue Pemutihan...', 'Menyediakan paparan...'],
              'Mendapatkan senarai queue SPI'
          );
          
          try {
              const userEmail = currentUser ? encodeURIComponent(currentUser.email) : '';
              const response = await fetchWithRetry(SCRIPT_URL + `?action=getQueueData&email=${userEmail}&t=` + Date.now(), { method: 'GET' }, 3, 1000);
              const result = await response.json();
              
              // 2. Set progress ke 100% dan tunjuk mesej Selesai sebelum tutup
              const progressBar = document.getElementById('loading-progress-bar');
              const progressPercent = document.getElementById('loading-progress-percent');
              const progressLabel = document.getElementById('loading-progress-label');
              
              if (progressBar) progressBar.style.width = '100%';
              if (progressPercent) progressPercent.textContent = '100%';
              if (progressLabel) progressLabel.textContent = 'Selesai!';
              
              // 3. Tunggu setengah saat (500ms) supaya pengguna nampak peratusan penuh 100%
              // Tambah perkataan 'async' di dalam setTimeout supaya boleh menggunakan fungsi bunyi
              setTimeout(async () => {
                  hideLoading();
                  
                  if (result.status === 'success') {
                      populateQueueTable('tbodyQueueSiasat', result.siasat);
                      populateQueueTable('tbodyQueuePemutihan', result.pemutihan);
                      
                      queueSpiModal.classList.add('show');
                      queueSpiModal.style.display = 'flex';
                      
                      // KOD TAMBAHAN: Mainkan bunyi berjaya!
                      await playSuccessSound();
                      
                  } else {
                      CustomAppModal.alert('Gagal mendapatkan senarai queue.', 'Ralat', 'error');
                  }
              }, 500);
              
          } catch (error) {
              hideLoading();
              CustomAppModal.alert('Gagal mendapatkan senarai queue: ' + error.message, 'Ralat', 'error');
          }
      });
  }
  
  if (queueSpiClose) {
      queueSpiClose.addEventListener('click', () => {
          queueSpiModal.classList.remove('show');
          setTimeout(() => queueSpiModal.style.display = 'none', 300);
      });
  }

  // === TAMBAH KOD INI DI BAWAHNYA ===
  const btnTutupQueueSPI = document.getElementById('btnTutupQueueSPI');
  if (btnTutupQueueSPI) {
      btnTutupQueueSPI.addEventListener('click', () => {
          queueSpiModal.classList.remove('show');
          setTimeout(() => queueSpiModal.style.display = 'none', 300);
      });
  }

  function populateQueueTable(tbodyId, dataArray) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      
      if (!dataArray || dataArray.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:#64748b;">✅ Tiada permohonan dalam queue ini</td></tr>`;
          return;
      }
      
      tbody.innerHTML = dataArray.map((item, index) => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="text-align:center;">${index + 1}</td>
              <td style="font-weight:bold; color: #1e293b;">${item.syarikat}</td>
              <td style="text-align:center; color: #475569;">${item.cidb}</td>
              <td style="text-align:center; font-size: 0.85rem;">${item.pengesyor}</td>
          </tr>
      `).join('');
  }
  // =========================================================================
  // KAWALAN KEMBALI KE DB DARI PROFILE
  // =========================================================================
  const btnKembaliDbDariProfile = document.getElementById('btnKembaliDbDariProfile');
  if (btnKembaliDbDariProfile) {
      btnKembaliDbDariProfile.addEventListener('click', () => {
          switchTab('db');
      });
  }

  // =========================================================================
  // ENJIN CUSTOM YOUTUBE PLAYER & KEMBALI
  // =========================================================================
  const btnTutupYoutube = document.getElementById('btnTutupYoutube');
  if (btnTutupYoutube) {
      btnTutupYoutube.addEventListener('click', () => {
          let tabUtama = window.tabSebelumYoutube;
          if (!tabUtama) {
              tabUtama = ['ADMIN', 'PENGARAH', 'KETUA SEKSYEN'].includes(currentUser.role) ? 'admin-dashboard' : 'dashboard';
          }
          switchTab(tabUtama);
      });
  }

  const btnSearchYoutube = document.getElementById('btnSearchYoutube');
  const youtubeSearchInput = document.getElementById('youtubeSearchInput');

  if (btnSearchYoutube) btnSearchYoutube.addEventListener('click', performYoutubeSearch);
  if (youtubeSearchInput) {
      youtubeSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performYoutubeSearch(); });
  }

  async function performYoutubeSearch() {
      // Normalkan kata kunci carian
      const query = youtubeSearchInput.value.trim().toLowerCase(); 
      if (!query || !currentUser || !currentUser.email) return;

      simulateLoadingWithSteps(['Mencari di YouTube...', 'Memuatkan video...'], 'Mencari Video');

      try {
          // 1. Tentukan laluan cache individu: users/{email}/youtube_cache/{query}
          const cacheRef = dbFirestore.collection("users").doc(currentUser.email).collection("youtube_cache").doc(query);
          
          // 2. SEMAK CACHE INDIVIDU
          const cacheDoc = await cacheRef.get();
          if (cacheDoc.exists) {
              const cacheData = cacheDoc.data();
              // Semak tempoh sah cache (2 hari = 172,800,000 milisaat)
              const isFresh = (Date.now() - cacheData.timestamp) < (2 * 24 * 60 * 60 * 1000);
              
              if (isFresh && cacheData.results) {
                  console.log("Memuatkan hasil carian dari Cache Individu: " + currentUser.email);
                  hideLoading();
                  displayYoutubeResults(cacheData.results);
                  return; 
              }
          }

          // 3. JIKA TIADA CACHE, PANGGIL BACKEND
          const response = await fetchWithRetry(SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'searchYoutube', query: query })
          }, 3, 1000);

          const result = await response.json();
          hideLoading();

          if (result.success) {
              displayYoutubeResults(result.data);
              
              // 4. SIMPAN HASIL KE CACHE INDIVIDU
              if (dbFirestore && result.data && result.data.length > 0) {
                  try {
                      await cacheRef.set({
                          results: result.data,
                          timestamp: Date.now(),
                          query: query,
                          userEmail: currentUser.email
                      });
                      console.log("Carian disimpan ke cache peribadi anda.");
                  } catch (saveErr) {
                      console.warn("Gagal menyimpan cache individu:", saveErr);
                  }
              }
          } else {
              CustomAppModal.alert("Gagal cari video: " + result.message, "Ralat", "error");
          }
      } catch (error) {
          hideLoading();
          CustomAppModal.alert("Ralat sistem: " + error.message, "Ralat", "error");
      }
  }
  function displayYoutubeResults(items) {
      const container = document.getElementById('youtubeResults');
      container.innerHTML = '';

      if (!items || items.length === 0) {
          container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #64748b;">Tiada video dijumpai.</div>';
          return;
      }

      items.forEach(item => {
          if (!item.id || !item.id.videoId) return;

          const card = document.createElement('div');
          card.style.cssText = "background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; cursor: pointer; transition: transform 0.2s;";
          card.onmouseover = () => { card.style.transform = 'scale(1.02)'; };
          card.onmouseout = () => { card.style.transform = 'scale(1)'; };
          
          card.innerHTML = `
              <img src="${item.snippet.thumbnails.medium.url}" style="width:100%; border-radius:8px; margin-bottom:10px; aspect-ratio: 16/9; object-fit: cover;">
              <h4 style="margin:0 0 5px 0; font-size:0.9rem; color:#1e40af;">${item.snippet.title}</h4>
              <p style="margin:0; font-size:0.75rem; color:#64748b;">👤 ${item.snippet.channelTitle}</p>
          `;

          card.onclick = () => {
              const pc = document.getElementById('youtubePlayerContainer');
              const mp = document.getElementById('youtubeMainPlayer');
              pc.style.display = 'block';
              
              // Tambah &list=RD[VIDEO_ID] untuk jadikan ia YouTube Mix (Auto-play lagu seterusnya)
              mp.src = `https://www.youtube.com/embed/${item.id.videoId}?autoplay=1&list=RD${item.id.videoId}`;
              
              window.scrollTo({ top: pc.offsetTop - 50, behavior: 'smooth' });
          };
          
          container.appendChild(card);
      });
  }
  // =========================================================================
  // FUNGSI PAPAR VIDEO DARI CACHE SEBELUM CARIAN
  // =========================================================================
  async function loadRecentYoutubeCache() {
      if (!dbFirestore || !currentUser || !currentUser.email) return;
      
      try {
          // Ambil carian terakhir KHUSUS untuk user ini sahaja daripada sub-koleksinya
          const cacheSnapshot = await dbFirestore.collection("users")
              .doc(currentUser.email)
              .collection("youtube_cache")
              .orderBy("timestamp", "desc")
              .limit(1)
              .get();

          if (!cacheSnapshot.empty) {
              const cacheData = cacheSnapshot.docs[0].data();
              const isFresh = (Date.now() - cacheData.timestamp) < (2 * 24 * 60 * 60 * 1000); 
              
              if (isFresh && cacheData.results) {
                  console.log("Memuatkan carian terakhir anda (" + cacheData.query + ")");
                  
                  const searchInput = document.getElementById('youtubeSearchInput');
                  if (searchInput) {
                      searchInput.placeholder = "Carian terakhir anda: " + cacheData.query;
                  }
                  
                  displayYoutubeResults(cacheData.results);
              }
          }
      } catch (error) {
          console.warn("Gagal memuatkan cache individu:", error);
      }
  }
  // =========================================================================
  // FUNGSI CETAK / PAPAR BORANG SEMAKAN UNTUK PELULUS & PENGESYOR
  // =========================================================================

  async function processPelulusPrint(item) {
      if (!item.borang_json) return;
      try {
          const parsedData = JSON.parse(item.borang_json);
          
          // --- 1. BACKUP: SIMPAN KEADAAN BORANG SEMASA ---
          const backupValues = {};
          document.querySelectorAll('#tab-checker input, #tab-checker select, #tab-checker textarea, #tab-database input, #tab-database select, #tab-database textarea, #tab-pelulus-action input, #tab-pelulus-action select, #tab-pelulus-action textarea').forEach(el => {
              if (el.id && el.type !== 'file') {
                  backupValues[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
              }
          });
          const backupPersonnelData = [];
          document.querySelectorAll('.person-card').forEach(card => {
              const roles = [];
              card.querySelectorAll('.role-cb:checked').forEach(cb => roles.push(cb.value));
              backupPersonnelData.push({
                  name: card.querySelector('.p-name')?.value || '',
                  isCompany: card.querySelector('.is-company')?.checked || false,
                  roles: roles,
                  s_ic: card.querySelector('.status-ic')?.value || '',
                  s_sb: card.querySelector('.status-sb')?.value || '',
                  s_epf: card.querySelector('.status-epf')?.value || ''
              });
          });
          const oldActiveItem = pelulusActiveItem;

          // --- 2. INJECT SEMENTARA DATA JSON UNTUK CETAKAN ---
          Object.keys(parsedData).forEach(key => {
              if (key === 'personnel' || key === 'jenisApp') return;
              const el = document.getElementById(key);
              if (el && el.type !== 'file') {
                  if (el.type === 'checkbox' || el.type === 'radio') el.checked = parsedData[key];
                  else el.value = parsedData[key];
              }
          });
          if (parsedData.jenisApp) {
              const radio = document.querySelector(`input[name="jenisApp"][value="${parsedData.jenisApp}"]`);
              if (radio) radio.checked = true;
          }
          const personnelListEl = document.getElementById('personnelList');
          if (personnelListEl) {
              personnelListEl.innerHTML = '';
              if (parsedData.personnel && Array.isArray(parsedData.personnel)) {
                  parsedData.personnel.forEach(p => addPerson(p));
              }
          }
          
          pelulusActiveItem = item;
          const elKeputusan = document.getElementById('pelulus_keputusan');
          if(elKeputusan) elKeputusan.value = item.kelulusan || '';
          const elNama = document.getElementById('pelulus_nama');
          if(elNama) elNama.value = item.pelulus || '';
          
          // --- 3. JANA REKAAN CETAKAN ---
          preparePrintView(); 
          
          // --- 4. RESTORE: KEMBALIKAN BORANG KEPADA KEADAAN ASAL ---
          pelulusActiveItem = oldActiveItem;
          Object.keys(backupValues).forEach(id => {
              const el = document.getElementById(id);
              if (el && el.type !== 'file') {
                  if (el.type === 'checkbox' || el.type === 'radio') el.checked = backupValues[id];
                  else el.value = backupValues[id];
              }
          });
          if (personnelListEl) {
              personnelListEl.innerHTML = '';
              if (backupPersonnelData.length > 0) backupPersonnelData.forEach(p => addPerson(p));
              else addPerson();
          }
          // Kembalikan warna tick (jika ada)
          document.querySelectorAll('.status-input').forEach(input => {
              if (input.value === '✓') { input.style.backgroundColor = '#dcfce7'; input.style.color = '#166534'; } 
              else if (input.value === 'X' || input.value === '✗') { input.style.backgroundColor = '#fee2e2'; input.style.color = '#991b1b'; } 
              else { input.style.backgroundColor = '#eff6ff'; input.style.color = '#1e40af'; }
          });

          // --- 5. LOGIK PEMPROSESAN DRIVE & CETAKAN ---
          const hasUpdatedDrive = parsedData.pelulus_drive_updated === true;
          const isDriveAlreadyCreated = (item.pautan && item.pautan.trim() !== '');
          let proceedToDrive = false;
          
          if (hasUpdatedDrive) {
              await CustomAppModal.alert("Keputusan borang ini <b style='color:#2563eb;'>telah dikemaskini ke Drive sebelum ini</b>. Untuk mengelakkan pertindanan, anda hanya dibenarkan membuat cetakan biasa sahaja.", "Makluman", "info");
              window.print();
              return;
          }
          
          if (isDriveAlreadyCreated) {
              const updateDrive = await CustomAppModal.confirm(
                  "Adakah anda ingin KEMASKINI fail PDF keputusan ini ke dalam Drive, atau sekadar cetakan biasa pada pencetak?<br><br><b style='color:#ef4444;'>NOTA: Kemaskini ke Drive bagi setiap keputusan hanya dibenarkan SEKALI SAHAJA.</b>",
                  "Cetak & Kemaskini Drive",
                  "info",
                  "Ya, Kemaskini Drive"
              );
              if (!updateDrive) {
                  window.print();
                  return;
              }
              proceedToDrive = true;
          } else {
              const userConfirmed = await CustomAppModal.confirm(
                  "Adakah anda pasti ingin mencetak dan menyimpan borang keputusan ini ke Google Drive?<br><br><b style='color:#ef4444;'>NOTA: Simpanan ke Drive bagi setiap keputusan hanya dibenarkan SEKALI SAHAJA.</b>",
                  "Cetak & Simpan",
                  "info",
                  "Ya, Teruskan"
              );
              if (!userConfirmed) {
                  window.print();
                  return;
              }
              proceedToDrive = true;
          }
          
          if (proceedToDrive) {
              const imgEls = [
                  document.getElementById('print_pengesyor_sign'), document.getElementById('print_pengesyor_cop'),
                  document.getElementById('print_pelulus_sign'), document.getElementById('print_pelulus_cop')
              ];
              const originalDisplays = imgEls.map(el => el ? el.style.display : 'none');
              imgEls.forEach(el => { if(el) el.style.display = 'none'; });
              
              const printLayoutElement = document.getElementById('printLayout');
              const userColorHex = getUserColorHex(currentUser.color);
              const pdfCss = generatePdfCssString(userColorHex);
              const printHTMLForDrive = `<style>${pdfCss}</style>${printLayoutElement.outerHTML}`;
              
              imgEls.forEach((el, idx) => { if(el) el.style.display = originalDisplays[idx]; });
              
              const payload = {
                  action: 'cetak_dan_simpan_pdf',
                  company_name: item.syarikat,
                  custom_file_name: `Borang Semakan Keputusan-${item.tarikh_lulus || ''}`,
                  application_type: `${item.jenis} - ${formatDateDisplay(item.start_date)}`.replace(/\//g, '-'),
                  month_year: `${new Date().toLocaleString('ms-MY', { month: 'long' }).toUpperCase()} ${new Date().getFullYear()}`,
                  user_name: item.pengesyor || currentUser.name,
                  user_color: userColorHex,
                  main_folder_id: mainFolderId,
                  htmlContent: printHTMLForDrive,
                  email: currentUser ? currentUser.email : ''
              };
              
              simulateLoadingWithSteps(['Menjana dokumen PDF...', 'Memuat naik ke Google Drive...', 'Merekodkan status kemaskini...'], 'Sila Tunggu Sebentar');
              
              const response = await fetchWithRetry(SCRIPT_URL, {
                  method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
              }, 3, 1000);
              
              const result = await response.json();
              
              if (result.success) {
                  parsedData.pelulus_drive_updated = true;
                  item.borang_json = JSON.stringify(parsedData);
                  
                  const updatePayload = {
                      action: 'updateRecord',
                      row: item.row,
                      borang_json: item.borang_json,
                      email: currentUser ? currentUser.email : ''
                  };
                  
                  fetchWithRetry(SCRIPT_URL, {
                      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(updatePayload)
                  }, 3, 1000).catch(e => console.error("Gagal simpan flag drive pelulus:", e));

                  hideLoading();
                  await playSuccessSound();
                  await CustomAppModal.alert("Fail PDF berjaya dikemaskini di Drive! Pilihan untuk mengemaskini ke Drive bagi rekod ini telah ditutup.", "Berjaya Disimpan", "success");
                  window.print();
              } else {
                  hideLoading();
                  throw new Error(result.message);
              }
          }
      } catch(e) {
          hideLoading();
          console.error(e);
          await CustomAppModal.alert("Gagal memproses cetakan: " + e.message, "Ralat", "error");
      }
  }

  function processLihatBorangPreview(item) {
      if (!item.borang_json) return;
      try {
          const parsedData = JSON.parse(item.borang_json);
          
          // --- 1. BACKUP: SIMPAN KEADAAN BORANG SEMASA ---
          const backupValues = {};
          document.querySelectorAll('#tab-checker input, #tab-checker select, #tab-checker textarea, #tab-database input, #tab-database select, #tab-database textarea, #tab-pelulus-action input, #tab-pelulus-action select, #tab-pelulus-action textarea').forEach(el => {
              if (el.id && el.type !== 'file') {
                  backupValues[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
              }
          });
          const backupPersonnelData = [];
          document.querySelectorAll('.person-card').forEach(card => {
              const roles = [];
              card.querySelectorAll('.role-cb:checked').forEach(cb => roles.push(cb.value));
              backupPersonnelData.push({
                  name: card.querySelector('.p-name')?.value || '',
                  isCompany: card.querySelector('.is-company')?.checked || false,
                  roles: roles,
                  s_ic: card.querySelector('.status-ic')?.value || '',
                  s_sb: card.querySelector('.status-sb')?.value || '',
                  s_epf: card.querySelector('.status-epf')?.value || ''
              });
          });
          const oldActiveItem = pelulusActiveItem;

          // --- 2. INJECT SEMENTARA DATA JSON UNTUK PREVIEW ---
          Object.keys(parsedData).forEach(key => {
              if (key === 'personnel' || key === 'jenisApp') return;
              const el = document.getElementById(key);
              if (el && el.type !== 'file') {
                  if (el.type === 'checkbox' || el.type === 'radio') el.checked = parsedData[key];
                  else el.value = parsedData[key];
              }
          });
          if (parsedData.jenisApp) {
              const radio = document.querySelector(`input[name="jenisApp"][value="${parsedData.jenisApp}"]`);
              if (radio) radio.checked = true;
          }
          const personnelListEl = document.getElementById('personnelList');
          if (personnelListEl) {
              personnelListEl.innerHTML = '';
              if (parsedData.personnel && Array.isArray(parsedData.personnel)) {
                  parsedData.personnel.forEach(p => addPerson(p));
              }
          }
          
          pelulusActiveItem = item;
          const elKeputusan = document.getElementById('pelulus_keputusan');
          if(elKeputusan) elKeputusan.value = item.kelulusan || '';
          const elNama = document.getElementById('pelulus_nama');
          if(elNama) elNama.value = item.pelulus || '';
          
          // --- 3. JANA REKAAN CETAKAN ---
          preparePrintView();
          
          const printLayoutElement = document.getElementById('printLayout');
          const userColorHex = getUserColorHex(currentUser.color);
          const pdfCss = generatePdfCssString(userColorHex);
          const generatedHtml = printLayoutElement.outerHTML;

          // --- 4. RESTORE: KEMBALIKAN BORANG KEPADA KEADAAN ASAL ---
          pelulusActiveItem = oldActiveItem;
          Object.keys(backupValues).forEach(id => {
              const el = document.getElementById(id);
              if (el && el.type !== 'file') {
                  if (el.type === 'checkbox' || el.type === 'radio') el.checked = backupValues[id];
                  else el.value = backupValues[id];
              }
          });
          if (personnelListEl) {
              personnelListEl.innerHTML = '';
              if (backupPersonnelData.length > 0) backupPersonnelData.forEach(p => addPerson(p));
              else addPerson();
          }
          // Kembalikan warna tick (jika ada)
          document.querySelectorAll('.status-input').forEach(input => {
              if (input.value === '✓') { input.style.backgroundColor = '#dcfce7'; input.style.color = '#166534'; } 
              else if (input.value === 'X' || input.value === '✗') { input.style.backgroundColor = '#fee2e2'; input.style.color = '#991b1b'; } 
              else { input.style.backgroundColor = '#eff6ff'; input.style.color = '#1e40af'; }
          });

          // --- 5. BUKA TAB PREVIEW (VERSI PENUH SKRIN & KEDUDUKAN BERTENTANGAN) ---
          const newWin = window.open('', '_blank');
          newWin.document.write(`
            <html>
            <head>
              <title>Borang Semakan - ${item.syarikat}</title>
              <style>
                ${pdfCss} 
                body { 
                  background: white !important; 
                  margin: 0;
                  padding: 30px; 
                  font-family: Arial, sans-serif;
                }
                .print-only-container {
                  width: 100% !important; /* Kembali ke paparan penuh skrin */
                  max-width: 1100px;
                  margin: 0 auto;
                  display: block !important;
                  box-shadow: none !important;
                }
                
                /* PENYUSUNAN BERTENTANGAN (SIDE-BY-SIDE) UNTUK PENGESYOR */
                .pengesyor-grid-new {
                  display: flex !important;
                  justify-content: space-between !important;
                  align-items: flex-end !important;
                  margin-top: 15px !important;
                  padding-bottom: 10px !important; /* Beri ruang supaya tak langgar garisan bawah */
                }
                .pengesyor-dates {
                  flex: 1 !important;
                  line-height: 1.8 !important;
                }
                .pengesyor-sign-box {
                  width: 50% !important;
                  height: 110px !important; /* Besarkan sikit ruang kotak untuk elak imej terkeluar */
                  position: relative !important;
                  display: flex !important;
                  justify-content: center !important;
                }
                
                /* PENYUSUNAN BERTENTANGAN (SIDE-BY-SIDE) UNTUK PELULUS */
                /* Mencari div yang mengandungi Tarikh Pelulus dan Sign Pelulus */
                .verification-box:last-child > div:last-child {
                  display: flex !important;
                  justify-content: space-between !important;
                  align-items: flex-end !important;
                  margin-top: 10px !important;
                }
                
                /* GARISAN PEMISAH */
                .verification-separator {
                  margin: 25px 0 15px 0 !important; /* Tolak garisan ke bawah jauh sikit dari cop pengesyor */
                  border-bottom: 1px solid #000 !important;
                }
                
                /* KAWALAN SAIZ & KEDUDUKAN COP / SIGN */
                #print_pengesyor_sign, #print_pelulus_sign {
                  bottom: 60px !important; /* Naikkan sign supaya berada di atas nama cop */
                  position: absolute !important;
                  height: 45px !important; /* Kecilkan saiz sign */
                  z-index: 2 !important; /* Pastikan sign berada di lapisan paling atas */
                }
                #print_pengesyor_cop, #print_pelulus_cop {
                  bottom: 0px !important; 
                  position: absolute !important;
                  height: 85px !important; /* Kekalkan saiz cop */
                  z-index: 1 !important; /* Cop berada di belakang sign */
                }

                @media print {
                  body { padding: 0; }
                  .print-only-container { max-width: 100%; }
                }
              </style>
            </head>
            <body>${generatedHtml}</body>
            </html>
          `);
          newWin.document.close();
      } catch(e) {
          console.error(e);
          CustomAppModal.alert("Gagal memaparkan borang: " + e.message, "Ralat", "error"); 
      }
  }

}); // <--- PENUTUP UTAMA UNTUK DOMContentLoaded

console.log("STB System V6.5.2 - Web App JS loaded successfully");
