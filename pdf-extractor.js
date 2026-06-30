// =============================================================================
// pdf-extractor.js - V6.6.1
// Modul Ekstrak Data PDF (Borang & Profil)
// Diasingkan daripada app.js supaya mudah disemak & diselenggara
//
// Menyokong 2 mod:
//   - "manual" : Pengekstrakan menggunakan regex/kod tempatan (TANPA AI luar)
//   - "ai"     : Pengekstrakan menggunakan AI (DeepSeek/Gemini/OpenRouter)
//
// V6.6.1: Multi-strategy fallback, position-aware extraction, confidence scoring
//         Supaya mod manual semakin mantap & kurang bergantung pada AI
// =============================================================================

const PdfExtractor = (function() {

  // ===========================================================================
  // KONFIGURASI (diisi oleh app.js semasa init)
  // ===========================================================================
  let _fetchFn = null;
  let _scriptUrl = '';
  let _currentUser = null;
  let _storage = null;
  let _modal = null;
  let _playSuccess = null;
  let _playError = null;

  function init(deps) {
    _fetchFn = deps.fetchFn;
    _scriptUrl = deps.scriptUrl;
    _currentUser = deps.currentUser;
    _storage = deps.storage;
    _modal = deps.modal;
    _playSuccess = deps.playSuccess || (() => {});
    _playError = deps.playError || (() => {});
    console.log("V6.6.1 PdfExtractor initialized");
  }

  // ===========================================================================
  // MOD STATE
  // ===========================================================================
  let _borangMode = 'manual';
  let _profileMode = 'manual';

  function getBorangMode() { return _borangMode; }
  function getProfileMode() { return _profileMode; }
  function setBorangMode(mode) { _borangMode = mode; }
  function setProfileMode(mode) { _profileMode = mode; }

  // ===========================================================================
  // PEMBACAAN PDF (Shared)
  // ===========================================================================

  /**
   * Baca PDF & return plain text + positioned text items
   * @returns {{ plainText: string, items: Array<{str, x, y, w, h}> }}
   */
  async function readPdfPages(file, maxPages = 4, onProgress = null) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error("PDF.js library not loaded");
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let plainText = '';
    const allItems = [];
    const totalPages = Math.min(pdf.numPages, maxPages);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      for (const item of textContent.items) {
        allItems.push({
          str: item.str,
          x: item.transform ? item.transform[4] : 0,
          y: item.transform ? item.transform[5] : 0,
          w: item.width || 0,
          h: item.height || 0,
          page: pageNum,
          hasEOL: item.hasEOL || false
        });
        plainText += item.str + (item.hasEOL ? '\n' : ' ');
      }
      plainText += '\n';

      if (onProgress) {
        const progress = 10 + Math.round((pageNum / totalPages) * 30);
        onProgress(progress, `Mengekstrak halaman ${pageNum}/${totalPages}`);
      }
    }

    return { plainText, items: allItems };
  }

  // ===========================================================================
  //     BANTUAN: UTILITY UNTUK EKSTRAK
  // ===========================================================================

  /** Normalize whitespace, uppercase */
  function normalize(text) {
    return text.toUpperCase().replace(/\s+/g, ' ').trim();
  }

  /** Try multiple regex patterns, return first match group */
  function tryPatterns(text, patterns) {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m && m[1] && m[1].trim()) return m[1].trim();
    }
    return '';
  }

  /** Find text between two labels/patterns */
  function extractBetween(text, startPattern, endPattern, offset = 0) {
    const startM = text.match(startPattern);
    if (!startM) return '';
    const startIdx = startM.index + startM[0].length + offset;
    let endIdx = text.length;
    if (endPattern) {
      const endM = text.substring(startIdx).match(endPattern);
      if (endM) endIdx = startIdx + endM.index;
    }
    return text.substring(startIdx, endIdx).trim();
  }

  /** Get index of pattern match */
  function findIndex(text, pattern) {
    const m = text.match(pattern);
    return m ? m.index : -1;
  }

  /** Build lines from items grouped by Y position */
  function buildLines(items, yTolerance = 5) {
    if (!items || items.length === 0) return [];
    
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    let currentLine = { y: sorted[0].y, text: '' };
    
    for (const item of sorted) {
      if (Math.abs(item.y - currentLine.y) > yTolerance) {
        if (currentLine.text.trim()) lines.push(currentLine.text.trim());
        currentLine = { y: item.y, text: item.str };
      } else {
        currentLine.text += ' ' + item.str;
      }
    }
    if (currentLine.text.trim()) lines.push(currentLine.text.trim());
    
    return lines;
  }

  // ===========================================================================
  // ===========================================================================
  //     BAHAGIAN 1: EKSTRAK BORANG (UPGRADED - MULTI STRATEGY)
  // ===========================================================================
  // ===========================================================================

  /**
   * Ekstrak data dari teks PDF Borang CIDB/STB secara manual
   * V6.6.1: Multi-strategy fallback, position-aware name extraction, confidence
   */
  function extractBorangData(pdfText, pdfItems = null) {
    const data = {
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
      alamatPerniagaan: '',
      _confidence: {}
    };

    const raw = normalize(pdfText);
    const lines = pdfItems ? buildLines(pdfItems) : raw.split(/\.\s+/).filter(l => l.trim());
    const conf = data._confidence;

    // =====================================================================
    // NAMA SYARIKAT (3 strategi)
    // =====================================================================
    const namePatterns = [
      // Strategi 1: "SYARIKAT SDN BHD (YYYYMMDD-XX-YYYYY)" — CIDB format
      /([A-Z0-9\s\.\&\-]+?)\s*\(\d{6,}[-\s]?[A-Z]{2,}[-\s]?\d{4,}\)/,
      // Strategi 2: "NAMA SYARIKAT:" atau "COMPANY NAME:" diikuti nama
      /(?:NAMA\s*SYARIKAT|COMPANY\s*NAME)[\s:]+([A-Z\s\.\&\-\(\)\/]{5,80}?)(?=\s*(?:NO\.|CIDB|GRED|ALAMAT|TARIKH|\d{6}))/,
      // Strategi 3: Cari line yang mengandungi SDN BHD / ENTERPRISE / TRADING
      /([A-Z0-9\s\.\&\-\(\)\/]+\s(?:SDN|BHD|ENTERPRISE|TRADING|CORPORATION|RESOURCES|HOLDINGS)[A-Z\s\.\&\-\(\)\/]*)/,
    ];

    let companyName = tryPatterns(raw, namePatterns);
    if (companyName) {
      // Bersihkan prefix yg tak diingini
      companyName = companyName.replace(/.*(?:ADDR|ALAMAT|LUMPUR|SELANGOR|JOHOR|KUALA|TEL)[\s:]*/i, '').trim();
      data.companyName = companyName;
      conf.companyName = 'high';
    } else {
      conf.companyName = 'low';
    }

    // =====================================================================
    // NO. CIDB (3 strategi)
    // =====================================================================
    const cidbPatterns = [
      /(\d{6,}[-\s]?[A-Z]{2,}[-\s]?\d{4,})/,                      // Standard CIDB
      /(?:CIDB|NO\.?\s*PENDAFTARAN|REGISTRATION\s*NO)[\s:]*(\d{6,}[-\s]?[A-Z]{2,}[-\s]?\d{4,})/,  // Label
      /(\d{8,}[-\s][A-Z]{2,}[-\s]\d{5,})/,                         // Variasi
    ];
    const cidb = tryPatterns(raw, cidbPatterns);
    if (cidb) {
      data.cidbNumber = cidb.replace(/\s+/g, '').replace(/(\d{6,})-?([A-Z]{2,})-?(\d{4,})/, '$1-$2-$3');
      conf.cidbNumber = 'high';
    } else {
      conf.cidbNumber = 'low';
    }

    // =====================================================================
    // GRED (G1-G7)
    // =====================================================================
    const gradeMatch = raw.match(/\b(G[1-7])\b/i);
    if (gradeMatch) {
      data.grade = gradeMatch[0].toUpperCase();
      conf.grade = 'high';
    } else {
      conf.grade = 'low';
    }

    // =====================================================================
    // SPKK & STB DATES
    // =====================================================================
    const spkkMatch = raw.match(/KERJA\s*KERAJAAN\s*\(?SPKK\)?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (spkkMatch) {
      data.spkkStartDate = spkkMatch[1];
      data.spkkEndDate = spkkMatch[2];
      conf.spkk = 'high';
    } else {
      // Fallback: cari pattern "SPKK" berdekatan dengan sepasang tarikh
      const spkkIdx = raw.search(/SPKK/);
      if (spkkIdx >= 0) {
        const nearby = raw.substring(spkkIdx, spkkIdx + 100);
        const dates = nearby.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g);
        if (dates && dates.length >= 2) {
          data.spkkStartDate = dates[0];
          data.spkkEndDate = dates[1];
          conf.spkk = 'medium';
        } else {
          conf.spkk = 'low';
        }
      } else {
        conf.spkk = 'low';
      }
    }

    const stbMatch = raw.match(/TARAF\s*BUMIPUTERA\s*\(?STB\)?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (stbMatch) {
      data.stbStartDate = stbMatch[1];
      data.stbEndDate = stbMatch[2];
      conf.stb = 'high';
    } else {
      const stbIdx = raw.search(/STB/);
      if (stbIdx >= 0) {
        const nearby = raw.substring(stbIdx, stbIdx + 100);
        const dates = nearby.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g);
        if (dates && dates.length >= 2) {
          data.stbStartDate = dates[0];
          data.stbEndDate = dates[1];
          conf.stb = 'medium';
        } else {
          conf.stb = 'low';
        }
      } else {
        conf.stb = 'low';
      }
    }

    // =====================================================================
    // NOMBOR TELEFON
    // =====================================================================
    const phoneRegex = /(?:TEL|H\/P|PHONE|NO\.?\s*TELEFON)[\s:]*([\d\s\-\(\)\+]{6,18})/gi;
    const phones = new Set();
    let pm;
    while ((pm = phoneRegex.exec(raw)) !== null) {
      let num = pm[1].trim().replace(/\s+/g, '');
      if (num.length >= 6 && num.length <= 18) phones.add(num);
    }
    // Juga cuba tangkap nombor telefon tanpa label (contoh: 03-XXXXXXXX)
    if (phones.size === 0) {
      const barePhone = raw.match(/(?:^|\s)(0\d{1,2}[\-]\d{6,9})(?:\s|$)/g);
      if (barePhone) barePhone.forEach(p => phones.add(p.trim()));
    }
    data.phoneNumbers = Array.from(phones);
    conf.phoneNumbers = data.phoneNumbers.length > 0 ? 'high' : 'low';

    // =====================================================================
    // ALAMAT PERNIAGAAN
    // =====================================================================
    const alamatPatterns = [
      /(?:ALAMAT\s*(?:PERNIAGAAN|OPERASI|BUSINESS|OPERATION))[\s:]*(.+?)(?=\s*(?:TARIKH|DATE|NO\.\s*TEL|TELEFON|SPKK|STB|GRED|PENGARAH|\d{2}[\/\-]\d{2}[\/\-]))/,
      /(?:ADDRESS|ALAMAT)[\s:]*(.+?\d{5}.+?)(?=\s*(?:TEL|PHONE|NO\.|EMAIL|EMEL|\d{2}[\/\-]\d{2}[\/\-]))/,
    ];
    const alamat = tryPatterns(raw, alamatPatterns);
    if (alamat && alamat.length > 10) {
      data.alamatPerniagaan = alamat;
      conf.alamatPerniagaan = alamat.length > 20 ? 'high' : 'medium';
    } else {
      // Strategi 2: cari poskod 5 digit dan ambil teks sebelum & selepas
      const poskodMatch = raw.match(/(.{10,100}?\d{5}.{3,30}?)(?=\s*(?:TEL|NO\.\s*TEL|PHONE|FAX|EMAIL|EMEL|$))/);
      if (poskodMatch) {
        data.alamatPerniagaan = poskodMatch[1].trim();
        conf.alamatPerniagaan = 'medium';
      } else {
        conf.alamatPerniagaan = 'low';
      }
    }

    // =====================================================================
    // PERSONEL: EKSTRAK NAMA (UPGRADED)
    // =====================================================================
    
    // Fungsi pembersihan nama
    function cleanName(rawName) {
      let name = rawName.trim();
      const stopWords = [
        "PENGARAH", "PENGURUS", "MANAGER", "SECRETARY", "SETIAUSAHA",
        "PEMEGANG", "SAHAM", "SHARES", "EKUITI", "EQUITY",
        "LEMBAGA", "JAWATAN", "POSITION", "APPOINTMENT", "LANTIKAN",
        "WARGANEGARA", "MALAYSIA", "MELAYU", "LELAKI", "PEREMPUAN",
        "NO.", "BIL", "IC", "KP", "PASSPORT", "MANAGING", "EXECUTIVE",
        "ASING", "BUMIPUTERA", "BUKAN", "BUMIPUTRA",
        "TARIKH", "DATE", "JAWATAN", "JAWATAN:"
      ];
      for (const w of stopWords) {
        const idx = name.indexOf(w);
        if (idx > 1) name = name.substring(0, idx).trim();
      }
      name = name.replace(/[^A-Z\s\.\'\@\&\/\-\(\)\,\d]/g, '').trim();
      name = name.replace(/^\d+[\s\.\)]*/, '').trim();
      name = name.replace(/\s{2,}/g, ' ').trim();
      return name;
    }

    // Fungsi ekstrak nama dari blok teks (UPGRADED multi-strategy)
    function extractNames(blockText, sectionLabel) {
      if (!blockText || blockText.length < 5) return [];

      const norm = normalize(blockText);
      const names = [];

      // Strategi 1: Parse baris-baris jadual (nombor. NAMA ...)
      // Contoh: "1. AHMAD BIN ABDULLAH 800101-01-1234 LELAKI MELAYU PENGARAH"
      const tableRegex = /(?:\b|^)(\d{1,2})\s*[\.\)]?\s+([A-Z\s\.\'\@\&\/\-]{4,60}?)(?=\s+(?:\d{6,}|MALAYSIA|MELAYU|CINA|INDIA|LELAKI|PEREMPUAN|PENGARAH|PENGURUS|WARGANEGARA|IC|NO\.?\s*K\/P))/g;
      let m;
      while ((m = tableRegex.exec(norm)) !== null) {
        const cleaned = cleanName(m[2]);
        if (cleaned.length > 3 && /[A-Z]/.test(cleaned) && !names.includes(cleaned)) {
          names.push(cleaned);
        }
      }

      // Strategi 2: Jika tiada jumpa, cuba parse sebagai line-by-line
      if (names.length === 0) {
        const blockLines = blockText.split(/\n|\.\s{2,}/).filter(l => l.trim().length > 3);
        for (const line of blockLines) {
          const upper = line.toUpperCase().trim();
          
          // Skip header/ label lines
          if (/^(?:NO|BIL|NAME|NAMA|IC|PENGARAH|DIRECTOR|PEMEGANG|SHAREHOLDER|PENAMA|SPKK|CHEQUE|PENANDATANGAN|KEY|TECHNICAL|PERSONEL|COMPETENT)/.test(upper)) continue;
          if (upper.length < 5 || upper.length > 100) continue;
          if (/SYARIKAT|COMPANY|SDN|BHD|ENTERPRISE|ALAMAT|TEL|FAX|EMAIL|DATE|TARIKH/.test(upper)) continue;

          // Cuba ekstrak nama dari line
          // Pattern: NAMA [IC] [INFO...]
          const nameMatch = line.match(/^([A-Z\s\.\'\@\&\/\-]{5,50}?)(?=\s+(?:\d{6,}|MALAYSIA|MELAYU|CINA|INDIA|LELAKI|PEREMPUAN|PENGARAH|WARGANEGARA|$))/i);
          if (nameMatch) {
            const cleaned = cleanName(nameMatch[1]);
            if (cleaned.length > 3 && /[A-Z]/.test(cleaned) && !names.includes(cleaned)) {
              names.push(cleaned);
            }
          }
        }
      }

      return names;
    }

    // =====================================================================
    // PENGESANAN SEKSYEN (Keyword-based, bukan nombor sahaja)
    // =====================================================================
    
    // Cari sempadan seksyen menggunakan kata kunci
    function findSectionBoundaries(text, sectionKeywords, nextSectionKeywords) {
      let startIdx = -1;
      for (const kw of sectionKeywords) {
        const idx = text.search(new RegExp(kw, 'i'));
        if (idx !== -1) { startIdx = idx; break; }
      }
      if (startIdx === -1) return '';

      let endIdx = text.length;
      for (const kw of nextSectionKeywords) {
        const remaining = text.substring(startIdx + 10);
        const idx = remaining.search(new RegExp(kw, 'i'));
        if (idx !== -1 && idx < endIdx - startIdx) endIdx = startIdx + 10 + idx;
      }
      return text.substring(startIdx, endIdx).trim();
    }

    const allSectionKeywords = [
      { keys: ['4\\.\\s*(?:DIRECTOR|PENGARAH)', '\\bDIRECTOR\\b.*\\bLIST\\b', 'SENARAI\\s*PENGARAH'], next: ['5\\.\\s*(?:SHAREHOLDER|PEMEGANG)', '\\bSHAREHOLDER\\b', 'PEMEGANG\\s*SAHAM', '6\\.\\s*(?:KEY|PERSONEL)', '7\\.\\s*(?:TECHNICAL|TEKNIKAL)', 'SPKK', 'CHEQUE', 'MANDATORY'] },
      { keys: ['5\\.\\s*(?:SHAREHOLDER|PEMEGANG)', '\\bSHAREHOLDER\\b', 'PEMEGANG\\s*SAHAM'], next: ['6\\.\\s*(?:KEY|PERSONEL)', '7\\.\\s*(?:TECHNICAL|TEKNIKAL)', 'SPKK', 'CHEQUE', 'MANDATORY'] },
      { keys: ['SPKK\\s*(?:RESPONSIBLE|PENAMA)', 'PENAMA\\s*SPKK', '\\d+\\.\\s*SPKK'], next: ['CHEQUE', 'PENANDATANGAN', 'MANDATORY', 'DISCLAIMER', 'JOINT\\s*VENTURE'] },
      { keys: ['CHEQUE\\s*(?:SIGNATORIES|PENANDATANGAN)', 'PENANDATANGAN\\s*CEK', '\\d+\\.\\s*CHEQUE'], next: ['MANDATORY', 'DISCLAIMER', 'JOINT\\s*VENTURE', 'INTERNATIONAL', '20\\.', '21\\.'] },
    ];

    const directorsBlock = findSectionBoundaries(raw, allSectionKeywords[0].keys, allSectionKeywords[0].next);
    const shareholdersBlock = findSectionBoundaries(raw, allSectionKeywords[1].keys, allSectionKeywords[1].next);
    const spkkBlock = findSectionBoundaries(raw, allSectionKeywords[2].keys, allSectionKeywords[2].next);
    const chequeBlock = findSectionBoundaries(raw, allSectionKeywords[3].keys, allSectionKeywords[3].next);

    data.directors = extractNames(directorsBlock, 'DIRECTOR');
    data.shareholders = extractNames(shareholdersBlock, 'SHAREHOLDER');
    data.spkkPersons = extractNames(spkkBlock, 'SPKK');
    data.chequeSignatories = extractNames(chequeBlock, 'CHEQUE');

    conf.directors = data.directors.length > 0 ? 'high' : 'low';
    conf.shareholders = data.shareholders.length > 0 ? 'high' : 'low';
    conf.spkkPersons = data.spkkPersons.length > 0 ? 'high' : 'low';
    conf.chequeSignatories = data.chequeSignatories.length > 0 ? 'high' : 'low';

    console.log("V6.6.1 PdfExtractor: Borang data diekstrak (manual)", data);
    return data;
  }

  // ===========================================================================
  //     BAHAGIAN 2: EKSTRAK PROFIL (UPGRADED)
  // ===========================================================================

  /**
   * Ekstrak data dari teks PDF Profil Syarikat secara manual
   * V6.6.1: Multi-strategy field-value matching
   */
  function extractProfileData(pdfText, pdfItems = null) {
    const data = {
      applicantName: '',
      jawatan: '',
      icNumber: '',
      phoneNumber: '',
      email: '',
      companyName: '',
      registrationNumber: '',
      grade: '',
      registrationDate: '',
      jenisPendaftaran: '',
      alamatUtama: '',
      labelAlamatUtama: 'Alamat Berdaftar',
      alamatSuratMenyurat: '',
      noTelefonSyarikat: '',
      noFax: '',
      emailSyarikat: '',
      webAddress: '',
      _confidence: {}
    };

    const raw = normalize(pdfText);
    const conf = data._confidence;

    // =====================================================================
    // Helper: cari nilai selepas label
    // =====================================================================
    function findAfterLabel(text, labels, valuePattern) {
      for (const label of labels) {
        const regex = new RegExp(label + '[\\s:]+' + '([^\\n]{2,80}?)(?=\\s{2,}|$|\\n)', 'i');
        const m = text.match(regex);
        if (m && m[1]) {
          const val = m[1].trim();
          if (valuePattern && !valuePattern.test(val)) continue;
          return val;
        }
      }
      return '';
    }

    // =====================================================================
    // NAMA SYARIKAT (3 strategi)
    // =====================================================================
    const coPatterns = [
      /([A-Z0-9\s\.\&\-]+?)\s*\(\d{6,}[-\s]?[A-Z]{2,}[-\s]?\d{4,}\)/,
      /(?:NAMA\s*SYARIKAT|COMPANY\s*NAME|SYARIKAT)[\s:]+([A-Z\s\.\&\-\(\)\/]{5,80}?)(?=\s*(?:NO\.|CIDB|GRED|ROC|ROB|ALAMAT|TARIKH|\d{6}))/,
      /([A-Z0-9\s\.\&\-\(\)\/]+\s(?:SDN|BHD|ENTERPRISE|TRADING)[A-Z\s\.\&\-\(\)\/]*)/,
    ];
    data.companyName = tryPatterns(raw, coPatterns);
    conf.companyName = data.companyName ? 'high' : 'low';

    // =====================================================================
    // CIDB / NO. PENDAFTARAN
    // =====================================================================
    const cidbMatch = raw.match(/(\d{6,}[-\s]?[A-Z]{2,}[-\s]?\d{4,})/);
    if (cidbMatch) {
      data.registrationNumber = cidbMatch[1].replace(/\s+/g, '');
      conf.registrationNumber = 'high';
    } else {
      const regMatch = raw.match(/(?:NO\.?\s*(?:PENDAFTARAN|CIDB|REGISTRATION))[\s:]*(\d{6,}[-\s]?[A-Z0-9]+)/);
      if (regMatch) {
        data.registrationNumber = regMatch[1].trim().replace(/\s+/g, '');
        conf.registrationNumber = 'medium';
      } else {
        conf.registrationNumber = 'low';
      }
    }

    // =====================================================================
    // GRED
    // =====================================================================
    const gMatch = raw.match(/\b(G[1-7])\b/i);
    data.grade = gMatch ? gMatch[1].toUpperCase() : '';
    conf.grade = data.grade ? 'high' : 'low';

    // =====================================================================
    // NAMA PEMOHON
    // =====================================================================
    const applicantPatterns = [
      /(?:NAMA\s*PEMOHON|APPLICANT\s*NAME|PEMOHON)[\s:]+([A-Z\s\.\-\@]{4,60}?)(?=\s*(?:NO\.?\s*(?:IC|K\/P|PASPORT)|JAWATAN|DESIGNATION|\d{6,}|MALAYSIA|WARGANEGARA))/,
      /(?:^|\n)([A-Z\s\.\-\@]{5,50}?)(?=\s+(?:\d{6,}[\-]\d{2,}[\-]\d{4,}|\d{12,}))/,
    ];
    data.applicantName = tryPatterns(raw, applicantPatterns);
    if (data.applicantName && /SYARIKAT|COMPANY|SDN|BHD/.test(data.applicantName)) {
      data.applicantName = ''; // false positive
    }
    conf.applicantName = data.applicantName ? 'high' : 'low';

    // =====================================================================
    // JAWATAN
    // =====================================================================
    data.jawatan = findAfterLabel(raw, ['JAWATAN', 'DESIGNATION', 'JAWATAN\\s*PEMOHON'], null);
    conf.jawatan = data.jawatan ? 'high' : 'low';

    // =====================================================================
    // NO. IC
    // =====================================================================
    const icPatterns = [
      /(?:NO\.?\s*(?:IC|K\/P|PASPORT|PENGENALAN))[\s:]*(\d{6,}[\-\s]?\d{2,}[\-\s]?\d{4,})/,
      /(\d{6,}[\-]\d{2,}[\-]\d{4,})/,
      /(\d{12})/,
    ];
    data.icNumber = tryPatterns(raw, icPatterns).replace(/\s+/g, '');
    conf.icNumber = data.icNumber ? 'high' : 'low';

    // =====================================================================
    // TELEFON PEMOHON
    // =====================================================================
    const hpPatterns = [
      /(?:NO\.?\s*(?:TELEFON|TEL|H\/P|HANDPHONE))[\s:]*([\d\s\-\+\(\)]{7,15})/,
      /(?:H\/P|HANDPHONE)[\s:]*([\d\s\-\+\(\)]{7,15})/,
    ];
    data.phoneNumber = tryPatterns(raw, hpPatterns).replace(/\s+/g, '');
    conf.phoneNumber = data.phoneNumber ? 'high' : 'low';

    // =====================================================================
    // EMEL PEMOHON
    // =====================================================================
    const emailMatch = raw.match(/(?:EMEL|EMAIL|E-?MAIL)[\s:]*([\w\.\-\@]{5,60})/i);
    if (emailMatch) {
      const em = emailMatch[1].trim().toLowerCase();
      if (em.includes('@') && em.includes('.') && em.length > 5) {
        data.email = em;
        conf.email = 'high';
      } else {
        conf.email = 'low';
      }
    } else {
      conf.email = 'low';
    }

    // =====================================================================
    // JENIS PENDAFTARAN
    // =====================================================================
    const jenisMatch = raw.match(/\b(ROC|ROB|PARTNERSHIP|SOLE\s*PROPRIETOR|ENTERPRISE|LLP)\b/i);
    if (jenisMatch) {
      data.jenisPendaftaran = jenisMatch[1].toUpperCase();
      conf.jenisPendaftaran = 'high';
    } else {
      conf.jenisPendaftaran = 'low';
    }

    // =====================================================================
    // TARIKH DAFTAR
    // =====================================================================
    const datePatterns = [
      /(?:TARIKH\s*(?:DAFTAR|PENDAFTARAN|REGISTRATION|INCORPORATION))[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(?:DATE\s*(?:OF\s*)?(?:REGISTRATION|INCORPORATION))[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(?:INCORPORATION\s*DATE)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    ];
    data.registrationDate = tryPatterns(raw, datePatterns);
    conf.registrationDate = data.registrationDate ? 'high' : 'low';

    // =====================================================================
    // ALAMAT (UTAMA / BERDAFTAR / PERNIAGAAN)
    // =====================================================================
    function extractAddress(text, addrLabels, nextLabels) {
      const labelStr = addrLabels.join('|');
      const nextStr = (nextLabels && nextLabels.length > 0) ? nextLabels.join('|') : null;
      
      const m = text.match(new RegExp('(' + labelStr + ')[\\s:]*(.+?)(?=\\s*(?:' + (nextStr || '$') + '))', 'i'));
      if (m && m[2] && m[2].trim().length > 10) {
        return {
          text: m[2].trim(),
          labelMatch: m[1].toLowerCase()
        };
      }
      return null;
    }

    // Alamat Berdaftar / Utama
    const addrResult = extractAddress(raw, 
      ['ALAMAT\\s*(?:BERDAFTAR|PERNIAGAAN|UTAMA|REGISTERED|BUSINESS|PRINCIPAL)'],
      ['ALAMAT\\s*(?:SURAT|MENYURAT|CORRESPONDENCE)', 'NO\\.?\\s*(?:TELEFON|TEL|FAX)', 'EMEL', 'EMAIL', 'POSKOD', 'POSTCODE', 'TARIKH', 'DATE', 'JENIS', 'NO\\.?\\s*FAX', 'WEB', 'LAMAN']
    );
    if (addrResult) {
      data.alamatUtama = addrResult.text;
      const l = addrResult.labelMatch;
      if (l.includes('perniagaan') || l.includes('business')) data.labelAlamatUtama = 'Alamat Perniagaan';
      else if (l.includes('surat') || l.includes('correspondence')) data.labelAlamatUtama = 'Alamat Surat-menyurat';
      conf.alamatUtama = 'high';
    } else {
      conf.alamatUtama = 'low';
    }

    // Alamat Surat-menyurat
    const suratResult = extractAddress(raw,
      ['ALAMAT\\s*(?:SURAT[\\-\\s]*MENYURAT|CORRESPONDENCE)'],
      ['NO\\.?\\s*(?:TELEFON|TEL|FAX)', 'EMEL', 'EMAIL', 'POSKOD', 'POSTCODE', 'TARIKH', 'DATE', 'WEB', 'LAMAN', '$']
    );
    if (suratResult) {
      data.alamatSuratMenyurat = suratResult.text;
      conf.alamatSuratMenyurat = 'high';
    } else {
      conf.alamatSuratMenyurat = 'low';
    }

    // =====================================================================
    // TELEFON SYARIKAT
    // =====================================================================
    const telCoMatch = raw.match(/(?:NO\.?\s*(?:TELEFON|TEL)\s*(?:SYARIKAT|PEJABAT|COMPANY|OFFICE)?)[\s:]*([\d\s\-\+\(\)]{7,15})/i);
    if (telCoMatch) {
      data.noTelefonSyarikat = telCoMatch[1].trim().replace(/\s+/g, '');
      conf.noTelefonSyarikat = 'high';
    } else {
      conf.noTelefonSyarikat = 'low';
    }

    // =====================================================================
    // FAX
    // =====================================================================
    const faxMatch = raw.match(/(?:NO\.?\s*FAX|FAX\s*NO)[\s:]*([\d\s\-\+\(\)]{7,15})/i);
    if (faxMatch) {
      data.noFax = faxMatch[1].trim().replace(/\s+/g, '');
      conf.noFax = 'high';
    } else {
      conf.noFax = 'low';
    }

    // =====================================================================
    // EMEL SYARIKAT
    // =====================================================================
    const emelCoMatch = raw.match(/(?:EMEL\s*(?:SYARIKAT|COMPANY|PEJABAT|OFFICE)?)[\s:]*([\w\.\-\@]{5,60})/i);
    if (emelCoMatch) {
      const em = emelCoMatch[1].trim().toLowerCase();
      if (em.includes('@') && em.includes('.') && em !== data.email) {
        data.emailSyarikat = em;
        conf.emailSyarikat = 'high';
      } else {
        conf.emailSyarikat = 'low';
      }
    } else {
      conf.emailSyarikat = 'low';
    }

    // =====================================================================
    // WEB ADDRESS
    // =====================================================================
    const webMatch = raw.match(/(?:WEB|LAMAN\s*WEB|URL|WEBSITE)[\s:]*(www\.[\w\.\-]+|https?:\/\/[\w\.\-]+)/i);
    if (webMatch) {
      data.webAddress = webMatch[1].trim();
      conf.webAddress = 'high';
    } else {
      conf.webAddress = 'low';
    }

    console.log("V6.6.1 PdfExtractor: Profile data diekstrak (manual)", data);
    return data;
  }

  // ===========================================================================
  //     BAHAGIAN 3: AI PROCESSING (panggil backend)
  // ===========================================================================

  async function processBorangWithAI(pdfText, modelOverride = null) {
    const modelSelect = document.getElementById('aiModelSelect');
    const selectedModel = modelOverride || (modelSelect ? modelSelect.value : 'auto');
    const maxLen = 30000;
    const truncated = pdfText.length > maxLen ? pdfText.substring(0, maxLen) + "... [text truncated]" : pdfText;

    console.log("V6.6.1 PdfExtractor: Menghantar borang ke AI backend...");

    const payload = {
      action: 'processAI', type: 'borang', text: truncated,
      model: selectedModel, email: _currentUser ? _currentUser.email : ''
    };

    const response = await _fetchFn(_scriptUrl, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }, 3, 1000);

    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.message || result.error || 'Gagal mengekstrak data dari pelayan AI.');
    }
    console.log("V6.6.1 PdfExtractor: Borang AI data diterima", result.data);
    return result.data;
  }

  async function processProfileWithAI(pdfText, modelOverride = null) {
    const modelSelect = document.getElementById('aiProfileModelSelect');
    const selectedModel = modelOverride || (modelSelect ? modelSelect.value : 'auto');
    const maxLen = 30000;
    const truncated = pdfText.length > maxLen ? pdfText.substring(0, maxLen) + "... [text truncated]" : pdfText;

    console.log("V6.6.1 PdfExtractor: Menghantar profil ke AI backend...");

    const payload = {
      action: 'processAI', type: 'profile', text: truncated,
      model: selectedModel, email: _currentUser ? _currentUser.email : ''
    };

    const response = await _fetchFn(_scriptUrl, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }, 3, 1000);

    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.message || result.error || 'Gagal mengekstrak data profil dari pelayan AI.');
    }
    console.log("V6.6.1 PdfExtractor: Profile AI data diterima", result.data);
    return result.data;
  }

  // ===========================================================================
  //     BAHAGIAN 4: DISPLAY DATA (dengan confidence indicator)
  // ===========================================================================

  /** Tag confidence: hijau (high), kuning (medium), merah (low) */
  function confTag(level) {
    if (level === 'low') return ' <span style="font-size:0.7rem;background:#fef2f2;color:#dc2626;padding:1px 6px;border-radius:8px;" title="Keyakinan rendah - semak manual">⚠</span>';
    if (level === 'medium') return ' <span style="font-size:0.7rem;background:#fffbeb;color:#d97706;padding:1px 6px;border-radius:8px;" title="Keyakinan sederhana">○</span>';
    return '';
  }

  function renderBorangData(data, container) {
    if (!container) return;
    const c = data._confidence || {};
    let html = '';

    const items = [
      ['Nama Syarikat', data.companyName, c.companyName],
      ['No. CIDB', data.cidbNumber, c.cidbNumber],
      ['Gred', data.grade, c.grade],
    ];
    if (data.spkkStartDate && data.spkkEndDate) {
      items.push(['Tempoh SPKK', `${data.spkkStartDate} - ${data.spkkEndDate}`, c.spkk]);
    }
    if (data.stbStartDate && data.stbEndDate) {
      items.push(['Tempoh STB', `${data.stbStartDate} - ${data.stbEndDate}`, c.stb]);
    }

    for (const [label, value, level] of items) {
      if (value) {
        html += `<div class="extracted-item"><span class="extracted-label">${label}:</span><span class="extracted-value">${value}${confTag(level)}</span></div>`;
      }
    }

    if (data.phoneNumbers && data.phoneNumbers.length > 0) {
      html += `<div class="extracted-item"><span class="extracted-label">Nombor Telefon (${data.phoneNumbers.length}):</span><span class="extracted-value">${data.phoneNumbers.join(', ')}${confTag(c.phoneNumbers)}</span></div>`;
    } else {
      html += `<div class="extracted-item"><span class="extracted-label" style="color: #dc2626;">Nombor Telefon:</span><span class="extracted-value" style="color: #dc2626;">Tiada nombor telefon dapat diekstrak${confTag('low')}</span></div>`;
    }

    if (data.alamatPerniagaan) {
      html += `<div class="extracted-item"><span class="extracted-label">Alamat Perniagaan:</span><span class="extracted-value">${data.alamatPerniagaan}${confTag(c.alamatPerniagaan)}</span></div>`;
    }

    const personSections = [
      ['Pengarah', data.directors, c.directors],
      ['Pemegang Saham', data.shareholders, c.shareholders],
      ['Penama SPKK', data.spkkPersons, c.spkkPersons],
      ['Penandatangan Cek', data.chequeSignatories, c.chequeSignatories],
    ];

    for (const [label, list, level] of personSections) {
      if (list && list.length > 0) {
        html += `<div class="extracted-item"><span class="extracted-label">${label} (${list.length}):</span><span class="extracted-value">${list.join(', ')}${confTag(level)}</span></div>`;
      } else {
        html += `<div class="extracted-item"><span class="extracted-label" style="color: #dc2626;">${label}:</span><span class="extracted-value" style="color: #dc2626;">Tiada nama dapat diekstrak${confTag('low')}</span></div>`;
      }
    }

    container.innerHTML = html;
  }

  function renderProfileData(data, container) {
    if (!container) return;
    const c = data._confidence || {};
    let html = '';

    const items = [
      ['Nama Pemohon', data.applicantName, c.applicantName],
      ['Jawatan', data.jawatan, c.jawatan],
      ['No. IC Pemohon', data.icNumber, c.icNumber],
      ['No. Telefon Pemohon', data.phoneNumber, c.phoneNumber],
      ['Emel Pemohon', data.email, c.email],
      ['Nama Syarikat', data.companyName, c.companyName],
      ['No. Pendaftaran/CIDB', data.registrationNumber, c.registrationNumber],
      ['Gred', data.grade, c.grade],
      ['Tarikh Daftar', data.registrationDate, c.registrationDate],
      ['Jenis Pendaftaran', data.jenisPendaftaran, c.jenisPendaftaran],
    ];

    for (const [label, value, level] of items) {
      if (value) {
        html += `<div class="extracted-item"><span class="extracted-label">${label}:</span><span class="extracted-value">${value}${confTag(level)}</span></div>`;
      }
    }

    if (data.alamatUtama) {
      const addrLabel = data.labelAlamatUtama || 'Alamat';
      html += `<div class="extracted-item"><span class="extracted-label">${addrLabel}:</span><span class="extracted-value">${data.alamatUtama}${confTag(c.alamatUtama)}</span></div>`;
    }

    const more = [
      ['Alamat Surat-menyurat', data.alamatSuratMenyurat, c.alamatSuratMenyurat],
      ['No. Telefon Syarikat', data.noTelefonSyarikat, c.noTelefonSyarikat],
      ['No. Fax', data.noFax, c.noFax],
      ['Emel Syarikat', data.emailSyarikat, c.emailSyarikat],
      ['Web Address', data.webAddress, c.webAddress],
    ];

    for (const [label, value, level] of more) {
      if (value) {
        html += `<div class="extracted-item"><span class="extracted-label">${label}:</span><span class="extracted-value">${value}${confTag(level)}</span></div>`;
      }
    }

    container.innerHTML = html || '<div class="extracted-item"><span class="extracted-label">Tiada data diekstrak</span></div>';
  }

  // ===========================================================================
  //     BAHAGIAN 5: ANIMASI PROGRESS
  // ===========================================================================

  function startProgressAnimation(statusBoxId, ringId, percentageId, progressMsgId) {
    let _interval = null;
    const statusBox = document.getElementById(statusBoxId);
    const ring = document.getElementById(ringId);
    const pct = document.getElementById(percentageId);
    const msg = document.getElementById(progressMsgId);
    const circumference = 440;

    const update = (percent, message) => {
      if (statusBox && statusBox.classList.contains('morph-circle')) {
        statusBox.classList.replace('morph-circle', 'morph-square');
      }
      if (pct) pct.innerHTML = `${percent}%`;
      if (msg) { msg.style.display = 'block'; msg.innerText = message; }
      if (ring) ring.style.strokeDashoffset = circumference - (percent / 100) * circumference;
    };

    const setAutoIncrement = (startPercent = 45) => {
      let progress = startPercent;
      _interval = setInterval(() => {
        if (progress < 95) { progress += 1; update(progress, "Menganalisis..."); }
      }, 300);
    };

    const complete = () => { if (_interval) clearInterval(_interval); };
    const reset = () => {
      if (_interval) clearInterval(_interval);
      if (statusBox) statusBox.classList.replace('morph-square', 'morph-circle');
      if (ring) ring.style.strokeDashoffset = circumference;
      if (pct) pct.innerHTML = '📄<br><span>Pilih PDF</span>';
      if (msg) msg.style.display = 'none';
    };
    const resetProfile = () => {
      if (_interval) clearInterval(_interval);
      if (statusBox) statusBox.classList.replace('morph-square', 'morph-circle');
      if (ring) ring.style.strokeDashoffset = circumference;
      if (pct) pct.innerHTML = '🏢<br><span>Pilih Profil</span>';
      if (msg) msg.style.display = 'none';
    };

    return { update, setAutoIncrement, complete, reset, resetProfile };
  }

  // ===========================================================================
  //     BAHAGIAN 6: PROSES PENUH
  // ===========================================================================

  async function processBorangPdf(file, mode, displayOpts = {}) {
    const { resultEl, dataContainer, onDone } = displayOpts;

    if (file.size > 10 * 1024 * 1024) {
      if (_modal) await _modal.alert("Fail terlalu besar (Maks 10MB).", "Ralat Saiz", "error");
      return null;
    }

    const progress = startProgressAnimation('status-box-main', 'progress-ring-main', 'percentage-main', 'pdfProgressMsg');

    try {
      progress.update(5, "Membaca fail...");
      const { plainText, items } = await readPdfPages(file, 4, (pct, msg) => progress.update(pct, msg));
      console.log("V6.6.1 PdfExtractor: PDF text length =", plainText.length);

      let extractedData = null;

      if (mode === 'ai') {
        progress.update(45, "Menganalisis dengan AI...");
        progress.setAutoIncrement(45);
        extractedData = await processBorangWithAI(plainText);
      } else {
        progress.update(45, "Mengekstrak data secara manual...");
        extractedData = extractBorangData(plainText, items);
        let p = 45;
        const iv = setInterval(() => {
          if (p < 95) { p += 2; progress.update(p, "Mengekstrak data secara manual..."); }
          else { clearInterval(iv); }
        }, 100);
        await new Promise(r => setTimeout(r, 600));
      }

      progress.update(100, "Selesai!");
      progress.complete();
      if (_playSuccess) await _playSuccess();

      setTimeout(() => {
        progress.reset();
        if (dataContainer) renderBorangData(extractedData, dataContainer);
        if (resultEl) resultEl.style.display = 'block';
        if (onDone) onDone(extractedData);
      }, 1000);

      return extractedData;

    } catch (error) {
      console.error("V6.6.1 PdfExtractor Borang Error:", error);
      progress.complete();
      if (_playError) await _playError();
      const msgEl = document.getElementById('pdfProgressMsg');
      if (msgEl) msgEl.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Ralat: ${error.message}</span>`;
      if (_modal) await _modal.alert("Gagal memproses: " + error.message, "Ralat Sistem", "error");
      return null;
    }
  }

  async function processProfilePdf(file, mode, displayOpts = {}) {
    const { resultEl, dataContainer, onDone } = displayOpts;

    if (file.size > 10 * 1024 * 1024) {
      if (_modal) await _modal.alert("Fail terlalu besar (Maks 10MB).", "Ralat Saiz", "error");
      return null;
    }

    const progress = startProgressAnimation('status-box-profile', 'progress-ring-profile', 'percentage-profile', 'profilePdfProgressMsg');

    try {
      progress.update(5, "Membaca fail...");
      const { plainText, items } = await readPdfPages(file, 4, (pct, msg) => progress.update(pct, msg));
      console.log("V6.6.1 PdfExtractor: Profile PDF text length =", plainText.length);

      let extractedData = null;

      if (mode === 'ai') {
        progress.update(45, "Menganalisis dengan AI...");
        progress.setAutoIncrement(45);
        extractedData = await processProfileWithAI(plainText);
      } else {
        progress.update(45, "Mengekstrak data secara manual...");
        extractedData = extractProfileData(plainText, items);
        let p = 45;
        const iv = setInterval(() => {
          if (p < 95) { p += 2; progress.update(p, "Mengekstrak data secara manual..."); }
          else { clearInterval(iv); }
        }, 100);
        await new Promise(r => setTimeout(r, 600));
      }

      progress.update(100, "Selesai!");
      progress.complete();
      if (_playSuccess) await _playSuccess();

      setTimeout(() => {
        progress.resetProfile();
        if (dataContainer) renderProfileData(extractedData, dataContainer);
        if (resultEl) resultEl.style.display = 'block';
        if (onDone) onDone(extractedData);
      }, 1000);

      return extractedData;

    } catch (error) {
      console.error("V6.6.1 PdfExtractor Profile Error:", error);
      progress.complete();
      if (_playError) await _playError();
      const msgEl = document.getElementById('profilePdfProgressMsg');
      if (msgEl) msgEl.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Ralat: ${error.message}</span>`;
      if (_modal) await _modal.alert("Gagal memproses profile PDF: " + error.message, "Ralat Sistem", "error");
      return null;
    }
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================
  return {
    init,
    getBorangMode, getProfileMode, setBorangMode, setProfileMode,
    extractBorangData, extractProfileData,
    readPdfPages,
    processBorangPdf, processProfilePdf,
    renderBorangData, renderProfileData,
    startProgressAnimation,
  };
})();
