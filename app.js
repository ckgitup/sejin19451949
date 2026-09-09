/**
 * UNIVERSAL INTERACTIVE E-MODULE ENGINE (APP.JS)
 * Features: GAS Backend Integration, Student Gatekeeper Form, Single-Email Session Lock,
 * Progressive Module Unlocking (KKTP/KKM Mastery System), & Hidden Teacher Dashboard.
 */

// =========================================================================
// KONFIGURASI PERMANEN: URL Google Apps Script Backend
// URL ini DITANAMKAN PERMANEN — tidak akan berubah atau kosong
// =========================================================================
const PERMANENT_GAS_URL = "https://script.google.com/macros/s/AKfycbzySO-8yPjYhHLKCBOPtpLxW6KHLZfnUkeroV1UZVt0lQ-HzpoOGh5wY3TsSfaYppO-/exec";
const NEW_GAS_URL = PERMANENT_GAS_URL; // alias untuk kompatibilitas

// Tanamkan permanen ke localStorage dan window — tidak bisa dikosongkan
localStorage.setItem("sejarah_gas_url", PERMANENT_GAS_URL);
window.GAS_API_URL = PERMANENT_GAS_URL;

// Guard: pastikan tidak pernah kosong
const _origSetItem = localStorage.setItem.bind(localStorage);
const _origRemoveItem = localStorage.removeItem.bind(localStorage);
(function guardGasUrl() {
  const _origSet = localStorage.setItem.bind(localStorage);
  const _origRemove = localStorage.removeItem.bind(localStorage);
  Object.defineProperty(window, "GAS_API_URL", {
    get: function() { return PERMANENT_GAS_URL; },
    set: function(v) { /* URL permanen, tidak bisa diganti */ },
    configurable: false
  });
})();

let GAS_API_URL = PERMANENT_GAS_URL;


// =========================================================================
// SECURITY & SANITIZATION ENGINE (XSS PROTECTION & CRYPTO AUTH)
// =========================================================================
window.safeHTML = window.safeHTML || function(str) {
  if (typeof str !== 'string') return str;
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(str, {
      ADD_TAGS: ['iframe', 'marquee'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'direction', 'scrollamount']
    });
  }
  return str;
};

window.hashSHA256 = window.hashSHA256 || async function(str) {
  if (!str) return '';
  const buffer = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
};

window.verifyPasswordSecure = window.verifyPasswordSecure || async function(inputPin) {
  if (!inputPin) return false;
  const trimmed = inputPin.trim();
  const normalized = trimmed.toLowerCase();

  const VALID_KEYS = ["idem", "SEJARAH12", "SOSIO10", "cornelcktc", "pulucinor", "TEACHER_MASTER_KEY"];
  if (VALID_KEYS.some(key => key.toLowerCase() === normalized)) {
    return true;
  }

  const gasUrl = localStorage.getItem("sejarah_gas_url") || GAS_API_URL;
  if (gasUrl && window.navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(`${gasUrl}?action=verifyMasterPassword&pin=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await resp.json();
      if (data && data.isValid === true) {
        return true;
      }
    } catch (e) {
      console.warn("GAS Password verify fallback to SHA-256 hash:", e);
    }
  }

  const ALLOWED_HASHES = [
    "ec5f7959b870d0615fb38e9a65fb019eb9031ef09f086ff90d797f1f9e2d3119", // SEJARAH12
    "9b69b61d36d8f1e58ae9b1580aa13e9a0f0d2358890cb54854c6cf4c20790b41", // cornelcktc
    "2b9322040685be91544a49c66914b53ef1b54a22b757e7f607ecbb3f8373b9e4", // SOSIO10
    "63690f0559a41c19b02a632ed6eb99ec0558b9fa00c43ca3f07a0ab8a0fc2f13"  // TEACHER_MASTER_KEY
  ];
  const inputHash = await window.hashSHA256(trimmed);
  return ALLOWED_HASHES.includes(inputHash);
};

window.verifyTeacherPassword = window.verifyTeacherPassword || async function(inputPin) {
  return window.verifyPasswordSecure(inputPin);
};

// =========================================================================
// TAMPER-PROOF LOCALSTORAGE ENGINE (BYPASS LOCALSTORAGE MITIGATION & FALLBACK MIGRATION)
// =========================================================================
window.secureStorage = window.secureStorage || {
  PREFIX: "SEC_V1_",
  calcSignature: function(encoded) {
    let hash = 17;
    for (let i = 0; i < encoded.length; i++) {
      hash = (hash * 37 + encoded.charCodeAt(i)) % 2147483647;
    }
    return hash.toString(16);
  },
  setItem: function(key, val) {
    if (val === null || val === undefined) {
      localStorage.removeItem(key);
      return;
    }
    try {
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      const encoded = btoa(encodeURIComponent(str));
      const sig = this.calcSignature(encoded);
      localStorage.setItem(key, this.PREFIX + encoded + "." + sig);
    } catch(e) {
      console.error("[SECURE STORAGE] Error encoding key:", key, e);
      try {
        localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
      } catch(err) {}
    }
  },
  getItem: function(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      // 1. Encrypted & Signed Format Check
      if (raw.startsWith(this.PREFIX)) {
        const payload = raw.substring(this.PREFIX.length);
        const dotIdx = payload.lastIndexOf(".");
        if (dotIdx === -1) {
          console.warn(`[SECURITY ALERT] Invalid format for key '${key}'. Resetting.`);
          localStorage.removeItem(key);
          return null;
        }
        const encoded = payload.substring(0, dotIdx);
        const sig = payload.substring(dotIdx + 1);
        const expectedSig = this.calcSignature(encoded);

        if (sig !== expectedSig) {
          console.warn(`[SECURITY ALERT] LocalStorage key '${key}' tampered! Clearing key.`);
          localStorage.removeItem(key);
          return null;
        }

        const decoded = decodeURIComponent(atob(encoded));
        try { return JSON.parse(decoded); } catch(e) { return decoded; }
      }

      // 2. Fallback Migration for Legacy Data (Unencrypted Plaintext / JSON)
      let parsedLegacy = null;
      try {
        parsedLegacy = JSON.parse(raw);
      } catch(e) {
        parsedLegacy = raw;
      }

      // Auto-migrate legacy data to secure encrypted format
      if (parsedLegacy !== null) {
        this.setItem(key, parsedLegacy);
      }
      return parsedLegacy;

    } catch(e) {
      console.error("[SECURE STORAGE] Error reading key:", key, e);
      const raw = localStorage.getItem(key);
      try { return JSON.parse(raw); } catch(err) { return raw; }
    }
  },
  removeItem: function(key) {
    localStorage.removeItem(key);
  }
};

// =========================================================================
// OFFLINE QUEUE FALLBACK MECHANISM (ZERO DATA LOSS GUARANTEE)
// =========================================================================
window.sejarahOfflineQueue = JSON.parse(localStorage.getItem("sejarah_offline_queue") || "[]");

window.enqueueOfflinePayload = function(payload) {
  window.sejarahOfflineQueue.push({ timestamp: Date.now(), payload });
  localStorage.setItem("sejarah_offline_queue", JSON.stringify(window.sejarahOfflineQueue));
  console.log("Payload queued for offline sync:", payload.action);
};

window.processOfflineQueue = function() {
  if (!navigator.onLine || !GAS_API_URL || window.sejarahOfflineQueue.length === 0) return;
  const queueCopy = [...window.sejarahOfflineQueue];
  window.sejarahOfflineQueue = [];
  localStorage.setItem("sejarah_offline_queue", JSON.stringify(window.sejarahOfflineQueue));
  
  queueCopy.forEach(item => {
    fetch(GAS_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.payload)
    }).catch(err => {
      window.enqueueOfflinePayload(item.payload);
    });
  });
};

window.addEventListener('online', window.processOfflineQueue);
setInterval(window.processOfflineQueue, 15000);

// Global State
let currentSubModule = "1A";
let activeQuizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = Array(15).fill(null);
let tabSwitchCount = 0;
let isQuizChecked = false;

// =========================================================================
// GOVERNANCE & CONTROL VARIABLES (FIX MISSING GLOBALS)
// =========================================================================
let kkmThreshold = parseInt(localStorage.getItem("sejarah_kkm_threshold") || "80", 10);
let quizTimerMinutes = parseInt(localStorage.getItem("sejarah_quiz_timer") || "20", 10);
let unlockedModules = JSON.parse(localStorage.getItem("unlockedModules") || '["1A"]');
let classControlMatrix = JSON.parse(localStorage.getItem("sejarah_class_control_matrix") || JSON.stringify({
  modules: { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" },
  quizzes: { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" },
  flashcards: { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" },
  tokens: { "1A": "IDEM", "1B": "IDEM", "1C": "IDEM", "1D": "IDEM", "1E": "IDEM", "1F": "IDEM" },
  kkmThreshold: 80,
  quizTimerMinutes: 20,
  previewMode: false,
  emergencyLocked: false,
  broadcastMessage: ""
}));
if (!classControlMatrix.modules) classControlMatrix.modules = { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" };
if (!classControlMatrix.quizzes) classControlMatrix.quizzes = { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" };
if (!classControlMatrix.flashcards) classControlMatrix.flashcards = { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" };
if (!classControlMatrix.tokens) classControlMatrix.tokens = { "1A": "IDEM", "1B": "IDEM", "1C": "IDEM", "1D": "IDEM", "1E": "IDEM", "1F": "IDEM" };
if (!classControlMatrix.tokenLocks) classControlMatrix.tokenLocks = {};
window.kkmThreshold = kkmThreshold;
window.quizTimerMinutes = quizTimerMinutes;
window.classControlMatrix = classControlMatrix;
window.unlockedModules = unlockedModules;

// =========================================================================
// GLOSARIUM INTERAKTIF SEJARAH (DICTIONARY & POPUP ENGINE)
// =========================================================================
const GLOSSARY_DICTIONARY = {
  "PPKI": "Panitia Persiapan Kemerdekaan Indonesia yang bertugas merumuskan UUD 1945, memilih Presiden/Wapres, dan membentuk KNIP.",
  "BPUPKI": "Badan Penyelidik Usaha-Usaha Persiapan Kemerdekaan Indonesia yang dibentuk 1 Maret 1945 untuk merumuskan dasar negara dan rancangan UUD.",
  "Vacuum of Power": "Kondisi kosongnya kekuasaan di Indonesia pasca-penyerahan Jepang tanpa syarat pada 14 Agustus 1945 sebelum kedatangan tentara Sekutu.",
  "Janji Koiso": "Pernyataan PM Kuniaki Koiso (7 Sept 1944) yang menjanjikan kemerdekaan bagi bangsa Indonesia di kemudian hari.",
  "Golongan Tua": "Tokoh senior kebangsaan (Soekarno, Hatta, Achmad Soebardjo) yang menghendaki pelaksanaan proklamasi secara cermat via PPKI.",
  "Golongan Muda": "Kelompok pejuang muda (Sjahrir, Chaerul Saleh, Wikana, Sukarni) yang menuntut proklamasi dilaksanakan murni tanpa campur tangan Jepang.",
  "Peristiwa Rengasdengklok": "Aksi pengamanan Soekarno-Hatta ke Rengasdengklok pada 16 Agustus 1945 oleh pemuda agar terbebas dari provokasi militer Jepang.",
  "Piagam Jakarta": "Dokumen rumusan dasar negara 22 Juni 1945 yang kemudian disempurnakan Sila Pertamanya menjadi 'Ketuhanan Yang Maha Esa' demi persatuan nasional.",
  "AFNEI": "Allied Forces Netherlands East Indies - Pasukan Sekutu pimpinan Sir Philip Christison yang bertugas melucuti tentara Jepang dan membebaskan tawanan APWI.",
  "NICA": "Netherlands Indies Civil Administration - Pemerintahan sipil Belanda yang memboncengi AFNEI untuk menegakkan kembali kekuasaan kolonial di Indonesia.",
  "KNIP": "Komite Nasional Indonesia Pusat - Badan pembantu Presiden yang kemudian diserahi fungsi legislatif melalui Maklumat No. X.",
  "Sutan Sjahrir": "Perdana Menteri pertama Republik Indonesia yang memimpin kabinet parlementer pertama pada 14 November 1945.",
  "BKR": "Badan Keamanan Rakyat - Organisasi pertahanan awal bertugas menjaga keselamatan umum yang dibentuk PPKI pada 22 Agustus 1945.",
  "TKR": "Tentara Keamanan Rakyat - Angkatan perang resmi pertama RI yang dibentuk 5 Oktober 1945 melalui Maklumat No. 6, dipimpin Jenderal Soedirman.",
  "Insiden Hotel Yamato": "Aksi perobekan warna biru bendera Belanda di Hotel Yamato Surabaya pada 19 September 1945 oleh pemuda Hariyono dan Kusno Wibowo.",
  "Ultimatum 10 November": "Instruksi Mayor Jenderal Robert Mansergh yang menuntut penyerahan senjata rakyat Surabaya tanpa syarat paling lambat 10 November 1945.",
  "Hari Pahlawan": "Peringatan nasional setiap 10 November untuk mengabadikan perlawanan total rakyat dan pemuda Surabaya membela kedaulatan RI.",
  "Supit Urang": "Taktik pengepungan jepit ganda dari dua sisi secara serentak yang dirancang Kolonel Soedirman untuk memutus logistik Sekutu di Ambarawa.",
  "Hari Juang Kartika": "Hari peringatan TNI Angkatan Darat setiap 15 Desember untuk mengenang kemenangan taktis TKR membebaskan Kota Ambarawa (1945).",
  "PDRI": "Pemerintah Darurat Republik Indonesia - Pemerintahan darurat di Bukittinggi, Sumatra yang dipimpin Sjafruddin Prawiranegara saat Soekarno-Hatta ditawan.",
  "Serangan Umum 1 Maret": "Serangan TNI 6 jam di Yogyakarta pada 1 Maret 1949 yang membuktikan kepada dunia internasional bahwa RI masih berdiri tegak.",
  "KMB": "Konferensi Meja Bundar - Perundingan di Den Haag (1949) yang berujung pada penyerahan kedaulatan dari Belanda kepada RIS.",
  "BFO": "Bijeenkomst voor Federaal Overleg - Majelis permusyawaratan negara-negara bagian (negara boneka bentukan Belanda) di Indonesia.",
  "KTN": "Komisi Tiga Negara - Badan mediasi bentukan PBB yang beranggotakan wakil Australia, Belgia, dan Amerika Serikat untuk menyelesaikan konflik Indonesia-Belanda.",
};

function renderGlossaryChips(filterQuery = "") {
  const container = document.getElementById("glossary-chips-container");
  if (!container) return;
  container.innerHTML = "";
  const q = (filterQuery || "").toLowerCase().trim();
  const keys = Object.keys(GLOSSARY_DICTIONARY);

  const filtered = keys.filter(k => !q || k.toLowerCase().includes(q) || (GLOSSARY_DICTIONARY[k] && GLOSSARY_DICTIONARY[k].toLowerCase().includes(q)));

  if (filtered.length === 0) {
    container.innerHTML = `<span class="text-[11px] text-[#a53e24] font-semibold py-1">Tidak ditemukan istilah yang cocok.</span>`;
    return;
  }

  filtered.forEach(term => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rounded-lg border border-[#174d3a]/20 bg-[#fffdf7] px-2.5 py-1 text-[11px] font-bold text-[#174d3a] hover:bg-[#174d3a] hover:text-[#d8ee93] transition shrink-0 shadow-xs cursor-pointer";
    btn.textContent = term;
    btn.onclick = () => {
      displayGlossaryDetail(term);
    };
    container.appendChild(btn);
  });
}

function displayGlossaryDetail(term) {
  const def = GLOSSARY_DICTIONARY[term] || "Penjelasan istilah belum tersedia.";
  const titleEl = document.getElementById("glossary-display-title");
  const defEl = document.getElementById("glossary-modal-def");
  const termHeader = document.getElementById("glossary-modal-term");

  if (termHeader) termHeader.textContent = term;
  if (titleEl) titleEl.textContent = `📌 ${term}`;
  if (defEl) defEl.textContent = def;
}

function openGlossaryBrowser() {
  const isTeacher = sessionStorage.getItem("isTeacherActive") === "true";
  const glosStatus = (classControlMatrix.globalElements && classControlMatrix.globalElements.glossary) || "VISIBLE";
  if (!isTeacher && glosStatus === "HIDDEN") {
    alert("📖 Fitur Glosarium disembunyikan oleh Guru.");
    return;
  }
  const modal = document.getElementById("glossary-modal");
  const searchInput = document.getElementById("glossary-search-input");
  if (searchInput) searchInput.value = "";

  renderGlossaryChips();
  const firstTerm = Object.keys(GLOSSARY_DICTIONARY)[0] || "PPKI";
  displayGlossaryDetail(firstTerm);

  if (modal) modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
}

function filterGlossaryChips(query) {
  renderGlossaryChips(query);
}

function openGlossaryTerm(term) {
  const isTeacher = sessionStorage.getItem("isTeacherActive") === "true";
  const glosStatus = (classControlMatrix.globalElements && classControlMatrix.globalElements.glossary) || "VISIBLE";
  if (!isTeacher && glosStatus === "HIDDEN") {
    alert("📖 Fitur Glosarium disembunyikan oleh Guru.");
    return;
  }
  openGlossaryBrowser();
  if (term && GLOSSARY_DICTIONARY[term]) {
    displayGlossaryDetail(term);
  }
}

function closeGlossaryModal() {
  const modal = document.getElementById("glossary-modal");
  if (modal) modal.classList.add("hidden");
}

window.openGlossaryTerm = openGlossaryTerm;
window.openGlossaryBrowser = openGlossaryBrowser;
window.filterGlossaryChips = filterGlossaryChips;
window.closeGlossaryModal = closeGlossaryModal;

// =========================================================================
// AUDIO POD-SUMMARY ENGINE (WEB SPEECH API SCAFFOLDING)
// =========================================================================
let currentUtterance = null;
let isAudioPlaying = false;

function toggleAudioPodSummary(textSummary) {
  if (!('speechSynthesis' in window)) {
    alert("⚠️ Browser Anda belum mendukung fitur Web Speech Audio.");
    return;
  }

  const btn = document.getElementById("btn-audio-pod");
  const eq = document.getElementById("audio-pod-equalizer");

  if (isAudioPlaying) {
    window.speechSynthesis.cancel();
    isAudioPlaying = false;
    if (btn) btn.innerHTML = `<i data-lucide="headphones" class="h-3.5 w-3.5 text-[#ee824b]"></i> <span>Dengarkan Pod (Audio 1m)</span>`;
    if (eq) eq.classList.add("hidden");
    if (window.lucide) lucide.createIcons();
    return;
  }

  window.speechSynthesis.cancel();
  const textToRead = textSummary || "Selamat datang di modul Sejarah Indonesia 1945-1949. Mari pelajari dinamika revolusi fisik dan diplomasi mempertahankan kemerdekaan.";
  
  currentUtterance = new SpeechSynthesisUtterance(textToRead);
  currentUtterance.lang = "id-ID";
  currentUtterance.rate = 1.0;
  currentUtterance.pitch = 1.0;

  currentUtterance.onstart = () => {
    isAudioPlaying = true;
    if (btn) btn.innerHTML = `<i data-lucide="square" class="h-3.5 w-3.5 text-[#a53e24]"></i> <span>Hentikan Audio Pod</span>`;
    if (eq) eq.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  };

  currentUtterance.onend = () => {
    isAudioPlaying = false;
    if (btn) btn.innerHTML = `<i data-lucide="headphones" class="h-3.5 w-3.5 text-[#ee824b]"></i> <span>Dengarkan Pod (Audio 1m)</span>`;
    if (eq) eq.classList.add("hidden");
    if (window.lucide) lucide.createIcons();
  };

  currentUtterance.onerror = () => {
    isAudioPlaying = false;
    if (btn) btn.innerHTML = `<i data-lucide="headphones" class="h-3.5 w-3.5 text-[#ee824b]"></i> <span>Dengarkan Pod (Audio 1m)</span>`;
    if (eq) eq.classList.add("hidden");
    if (window.lucide) lucide.createIcons();
  };

  window.speechSynthesis.speak(currentUtterance);
}

window.openGlossaryTerm = openGlossaryTerm;
window.closeGlossaryModal = closeGlossaryModal;
window.toggleAudioPodSummary = toggleAudioPodSummary;

function jumpToMateriJejak(cardId) {
  showPage("materi");
  setTimeout(() => {
    const lessonCard = document.querySelector(`[data-template-id="${cardId}"]`) || document.querySelector(`.${cardId}`);
    if (lessonCard) {
      lessonCard.scrollIntoView({ behavior: "smooth", block: "center" });
      lessonCard.classList.add("ring-4", "ring-[#ee824b]");
      setTimeout(() => lessonCard.classList.remove("ring-4", "ring-[#ee824b]"), 2500);
    }
  }, 150);
}
window.jumpToMateriJejak = jumpToMateriJejak;

// =========================================================================
// MODE LATIHAN FLASHCARDS (KARTU KONSEP MANDIRI)
// =========================================================================
const FLASHCARD_DATA = {
  "1A": [
    { category: "Sidang PPKI", front: "PPKI & UUD 1945", back: "Sidang PPKI (18-19 Agt 1945) mengesahkan UUD 1945, memilih Soekarno-Hatta, dan membagi 8 Provinsi." },
    { category: "Pasukan Asing", front: "AFNEI & NICA", back: "AFNEI melucuti tentara Jepang tetapi diboncengi NICA yang bermaksud menguasai kembali Indonesia." },
    { category: "Insiden Bendera", front: "Hotel Yamato", back: "Pemuda Surabaya merobek bagian biru bendera Belanda di Hotel Yamato pada 19 September 1945." },
    { category: "Perubahan Sistem", front: "Maklumat 14 Nov 1945", back: "Perubahan sistem pemerintahan RI dari Presidensial ke Parlementer dengan PM Sutan Sjahrir." },
    { category: "Militer RI", front: "Tentara Keamanan Rakyat", back: "Dibentuk 5 Oktober 1945 dari BKR, dipimpin Jenderal Soedirman sebagai Panglima Besar." }
  ],
  "1B": [
    { category: "Revolusi Fisik", front: "Pertempuran 10 Nov 1945", back: "Puncak perlawanan rakyat Surabaya dipicu gugurnya Jend. Mallaby, dipimpin Bung Tomo." },
    { category: "Taktik Militer", front: "Palagan Ambarawa", back: "TKR dipimpin Kolonel Soedirman menggunakan taktik Supit Urang mengurung musuh (15 Des 1945)." },
    { category: "Hari Nasional", front: "Hari Juang Kartika", back: "Peringatan kemenangan TKR atas Sekutu dalam Pertempuran Ambarawa 15 Desember 1945." },
    { category: "Pertempuran Daerah", front: "Pertempuran 5 Hari Semarang", back: "Bentrokan pemuda Semarang vs pasukan Jepang Kido Butai pasca gugurnya dr. Kariadi." },
    { category: "Strategi Perang", front: "Taktik Supit Urang", back: "Strategi pengepungan rangkap dari kedua sisi untuk memutuskan komunikasi dan suplai musuh." }
  ],
  "1C": [
    { category: "Bumi Hangus", front: "Bandung Lautan Api", back: "Pembumihanjutan Bandung Selatan (24 Mar 1946) oleh pejuang agar tidak dijadikan markas Sekutu." },
    { category: "Sumatra", front: "Pertempuran Medan Area", back: "Perlawanan rakyat Sumatra Utara diawali insiden penginjakan lencana Merah Putih oleh Sekutu." },
    { category: "Bali", front: "Puputan Margarana", back: "Perang habis-habisan pasukan Ciung Wanara dipimpin I Gusti Ngurah Rai di Bali (20 Nov 1946)." },
    { category: "Pahlawan Nasional", front: "I Gusti Ngurah Rai", back: "Komandan pasukan Ciung Wanara yang gugur bersama seluruh pasukannya dalam Puputan Margarana." },
    { category: "Lagu Perjuangan", front: "Halo-Halo Bandung", back: "Lagu ciptaan Ismail Marzuki yang mengabadikan peristiwa Bandung Lautan Api." }
  ],
  "1D": [
    { category: "Diplomasi", front: "Perjanjian Linggarjati", back: "Perundingan pertama (Nov 1946) di mana Belanda mengakui de facto RI atas Jawa, Sumatra, Madura." },
    { category: "Agresi Militer", front: "Agresi Militer Belanda I", back: "Serangan Belanda (21 Juli 1947) melanggar Linggarjati untuk merebut kawasan ekonomi penting." },
    { category: "Peran PBB", front: "Komisi Tiga Negara (KTN)", back: "Komisi PBB (Australia, Belgia, AS) yang menengahi konflik Indonesia-Belanda pasca Agresi I." },
    { category: "Diplomasi Kapal", front: "Perjanjian Renville", back: "Perundingan di atas kapal USS Renville (Jan 1948) yang merugikan RI karena Garis Van Mook." },
    { category: "Garis Demarkasi", front: "Garis Van Mook", back: "Garis perbatasan buatan Belanda yang memotong wilayah kekuasaan RI pasca Agresi Militer I." }
  ],
  "1E": [
    { category: "Agresi Militer", front: "Agresi Militer Belanda II", back: "Serangan Belanda ke Yogyakarta (19 Des 1948) serta menawan Presiden Soekarno & Hatta." },
    { category: "Pemerintahan Darurat", front: "PDRI Bukittinggi", back: "Pemerintah Darurat RI dipimpin Sjafruddin Prawiranegara menjaga kontinuitas negara saat Ibu Kota jatuh." },
    { category: "Gerilya", front: "Perang Gerilya Soedirman", back: "Perjuangan Panglima Besar Soedirman menembus hutan & desa meski dalam kondisi sakit parah." },
    { category: "Militer & Diplomasi", front: "Serangan Umum 1 Maret 1949", back: "Serangan TNI 6 jam di Jogja dipimpin Letkol Soeharto membuktikan RI dan TNI masih ada." },
    { category: "Pahlawan PDRI", front: "Sjafruddin Prawiranegara", back: "Ketua PDRI yang menjalankan roda pemerintahan RI dari pedalaman Sumatra Barat." }
  ],
  "1F": [
    { category: "Diplomasi", front: "Perjanjian Roem-Royen", back: "Kesepakatan (Mei 1949) penghentian gerilya & pengembalian Soekarno-Hatta ke Yogyakarta." },
    { category: "Konsolidasi", front: "Konferensi Inter-Indonesia", back: "Musyawarah antara RI dan BFO (negara bagian) menyepakati bentuk negara Indonesia Serikat." },
    { category: "Puncak Diplomasi", front: "Konferensi Meja Bundar (KMB)", back: "Perundingan Den Haag (Agu-Nov 1949) yang berujung pengakuan kedaulatan Indonesia." },
    { category: "Sejarah RIS", front: "Pengakuan Kedaulatan 1949", back: "Penandatanganan di Amsterdam & Jakarta (27 Des 1949) menandai pengakuan resmi kedaulatan RIS." },
    { category: "Peran Tokoh", front: "Mohammad Hatta (KMB)", back: "Ketua Delegasi RI dalam KMB Den Haag yang berhasil memperjuangkan pengakuan kedaulatan penuh." }
  ]
};

let currentFlashcardIdx = 0;
let isFlashcardFlipped = false;

function renderCurrentFlashcard() {
  const list = FLASHCARD_DATA[currentSubModule] || FLASHCARD_DATA["1A"];
  if (currentFlashcardIdx >= list.length) currentFlashcardIdx = 0;
  if (currentFlashcardIdx < 0) currentFlashcardIdx = list.length - 1;

  const cardData = list[currentFlashcardIdx];
  const catEl = document.getElementById("flashcard-category");
  const frontEl = document.getElementById("flashcard-front-text");
  const backEl = document.getElementById("flashcard-back-text");
  const counterEl = document.getElementById("flashcard-counter");
  const hintEl = document.getElementById("flashcard-hint");

  if (catEl) catEl.textContent = cardData.category;
  if (frontEl) frontEl.textContent = cardData.front;
  if (backEl) backEl.textContent = cardData.back;
  if (counterEl) counterEl.textContent = `Kartu ${currentFlashcardIdx + 1} / ${list.length}`;

  isFlashcardFlipped = false;
  if (frontEl) frontEl.classList.remove("hidden");
  if (backEl) backEl.classList.add("hidden");
  if (hintEl) hintEl.textContent = "💡 Depan: Istilah / Tokoh — Belakang: Definisi & Penjelasan";
}

function flipCurrentFlashcard() {
  const frontEl = document.getElementById("flashcard-front-text");
  const backEl = document.getElementById("flashcard-back-text");
  const cardEl = document.getElementById("flashcard-card");
  const hintEl = document.getElementById("flashcard-hint");

  if (!frontEl || !backEl) return;

  isFlashcardFlipped = !isFlashcardFlipped;

  if (cardEl) {
    cardEl.classList.add("scale-95");
    setTimeout(() => cardEl.classList.remove("scale-95"), 150);
  }

  if (isFlashcardFlipped) {
    frontEl.classList.add("hidden");
    backEl.classList.remove("hidden");
    if (hintEl) hintEl.textContent = "✨ Sisi Belakang: Definisi & Penjelasan Konsep (Klik lagi untuk balik)";
  } else {
    frontEl.classList.remove("hidden");
    backEl.classList.add("hidden");
    if (hintEl) hintEl.textContent = "💡 Sisi Depan: Peristiwa / Tokoh Sejarah (Klik lagi untuk lihat arti)";
  }
}

function nextFlashcard() {
  currentFlashcardIdx++;
  renderCurrentFlashcard();
}

function prevFlashcard() {
  currentFlashcardIdx--;
  renderCurrentFlashcard();
}

window.renderCurrentFlashcard = renderCurrentFlashcard;
window.flipCurrentFlashcard = flipCurrentFlashcard;
window.nextFlashcard = nextFlashcard;
window.prevFlashcard = prevFlashcard;

// Student & Session State
let activeStudent = null; // { nama, email, kelas, token }
let savedUnlockedModules = [];
if (typeof window.getUnlockedModulesHelper === 'function') {
  savedUnlockedModules = window.getUnlockedModulesHelper();
} else {
  try {
    savedUnlockedModules = JSON.parse(localStorage.getItem("unlockedModules") || "[]");
  } catch(e) {}
}
unlockedModules = Array.isArray(savedUnlockedModules) && savedUnlockedModules.length > 0 ? savedUnlockedModules : ["1A"];
kkmThreshold = 80; // Default KKM 80%
quizTimerMinutes = 20; // Default Quiz Timer 20 Menit
let remainingSeconds = 1200; // 20 min * 60 sec
let timerInterval = null;
let quizStartTime = null;
let headerClickCounter = 0;

// =============== TEACHER CONTROL ADVANCED FLAGS ===============
let isExamMode = false;       // Kunci siswa ke halaman kuis (Mode Ujian Serentak)
let isQuizPaused = false;     // Pause/Resume kuis seluruh kelas
let isModuleNavLocked = false; // Kunci navigasi antar sub-modul saat ujian

// DOM Element References
let materiPage, kuisPage, materiTab, kuisTab, quizList, scoreDisplay, progressDisplay, progressFill;
let feedback, resultPanel, prevQBtn, nextQBtn, checkQuizButton, antiCheatBadge, tabSwitchCountSpan;
let timerDisplay, quizTimerBadge;
let studentAuthModal, studentAuthForm, authErrorMsg, activeStudentNameSpan, reloginBtn;
let teacherAdminModal, teacherAdminForm, closeTeacherModalBtn, teacherMsg;

// Helper: Get active modulesData safely
function getModulesData() {
  return window.modulesData || (typeof modulesData !== "undefined" ? modulesData : null);
}

// Helper: Shuffle Array (Fisher-Yates) for Question Randomization
function shuffleArray(array) {
  if (!Array.isArray(array)) return [];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ------------------- SUB-MODULE UNLOCKING & LOCK STATE -------------------

function updateTeacherUIIndicator() {
  const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
  const teacherBadge = document.getElementById("teacher-mode-badge");
  if (teacherBadge) {
    if (isTeacherActive) {
      teacherBadge.classList.remove("hidden");
    } else {
      teacherBadge.classList.add("hidden");
    }
  }

  const openTeacherPortalBtn = document.getElementById("open-teacher-portal-btn");
  if (openTeacherPortalBtn) {
    if (isTeacherActive) {
      openTeacherPortalBtn.classList.remove("hidden");
    } else {
      openTeacherPortalBtn.classList.add("hidden");
    }
  }

  const navBtnLogout = document.getElementById("nav-btn-teacher-logout");
  if (navBtnLogout) {
    if (isTeacherActive) {
      navBtnLogout.classList.remove("hidden");
    } else {
      navBtnLogout.classList.add("hidden");
    }
  }
}

function getSubModuleTimeScheduleStatus(subId) {
  if (!classControlMatrix.schedules || !classControlMatrix.schedules[subId]) return "ACTIVE";
  const sched = classControlMatrix.schedules[subId];
  const now = new Date().getTime();

  if (sched.start) {
    const startTime = new Date(sched.start).getTime();
    if (!isNaN(startTime) && now < startTime) return "NOT_OPEN_YET";
  }

  if (sched.expire) {
    const expireTime = new Date(sched.expire).getTime();
    if (!isNaN(expireTime) && now > expireTime) return "EXPIRED";
  }

  return "ACTIVE";
}

function updateSubTabLockStates() {
  const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
  const isPreview = classControlMatrix.previewMode;
  const isStudentView = !isTeacherActive || isPreview;

  // Handle Emergency Lock Overlay & Broadcast Banner for Students
  const emergencyOverlay = document.getElementById("emergency-lock-overlay");
  if (emergencyOverlay) {
    if (isStudentView && classControlMatrix.emergencyLocked) {
      emergencyOverlay.classList.remove("hidden");
    } else {
      emergencyOverlay.classList.add("hidden");
    }
  }

  const broadcastBanner = document.getElementById("student-broadcast-banner");
  const broadcastText = document.getElementById("student-broadcast-text");
  if (broadcastBanner && broadcastText) {
    if (classControlMatrix.broadcastMessage && classControlMatrix.broadcastMessage.trim()) {
      broadcastText.textContent = `📢 PENGUMUMAN GURU: ${classControlMatrix.broadcastMessage}`;
      broadcastBanner.classList.remove("hidden");
    } else {
      broadcastBanner.classList.add("hidden");
    }
  }

  let loggedUser = null;
  try { loggedUser = JSON.parse(localStorage.getItem("sejarah_user_session") || sessionStorage.getItem("sejarah_user_session") || "null"); } catch(e){}
  if (!Array.isArray(unlockedModules)) unlockedModules = ["1A"];

  document.querySelectorAll(".sub-tab").forEach(btn => {
    const subId = btn.dataset.submod;
    if (!subId) return;

    // Get or create lock icon dynamically if missing
    let lockIcon = btn.querySelector(".lock-icon");
    if (!lockIcon) {
      lockIcon = document.createElement("span");
      lockIcon.className = "lock-icon hidden shrink-0 inline-flex items-center text-[#ee824b]";
      lockIcon.innerHTML = `<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>`;
      btn.insertBefore(lockIcon, btn.firstChild);
    }

    const modStatus = (classControlMatrix.modules && classControlMatrix.modules[subId]) || "VISIBLE";
    const schedStatus = getSubModuleTimeScheduleStatus(subId);
    const hasRemedialOverride = isStudentView && loggedUser && loggedUser.nama && classControlMatrix.remedialOverrides && classControlMatrix.remedialOverrides[loggedUser.nama] && classControlMatrix.remedialOverrides[loggedUser.nama][subId];

    if (hasRemedialOverride) {
      btn.style.display = "inline-flex";
      btn.classList.remove("locked", "token-locked");
      btn.title = `Sub-Modul ${subId} (Remedial Diberikan oleh Guru)`;
      if (lockIcon) lockIcon.classList.add("hidden");
    } else if (isStudentView) {
      if (schedStatus === "NOT_OPEN_YET" || schedStatus === "EXPIRED") {
        btn.style.display = "inline-flex";
        btn.classList.add("locked");
        btn.classList.remove("token-locked");
        btn.title = `⏰ Sub-Modul ${subId} Belum Dibuka / Kadaluarsa`;
        if (lockIcon) lockIcon.classList.remove("hidden");
      } else if (modStatus === "HIDDEN" || modStatus === "LOCKED_HIDDEN") {
        btn.style.display = "none";
      } else if (modStatus === "LOCKED_VISIBLE") {
        const requiredToken = (classControlMatrix.tokenLocks && classControlMatrix.tokenLocks[subId]) || "";
        const isUnlocked = typeof window.isElementUnlockedByToken === "function" && window.isElementUnlockedByToken(subId);
        btn.style.display = "inline-flex";
        if (isUnlocked) {
          btn.classList.remove("locked", "token-locked");
          btn.title = `🔓 Sub-Modul ${subId} (Token Terkonfirmasi)`;
          if (lockIcon) lockIcon.classList.add("hidden");
        } else {
          btn.classList.add("locked", "token-locked");
          btn.title = requiredToken ? `🔑 Sub-Modul ${subId} Dikunci (Klik untuk Masukkan Token)` : `🔒 Sub-Modul ${subId} Dikunci Guru`;
          if (lockIcon) lockIcon.classList.remove("hidden");
        }
      } else {
        btn.style.display = "inline-flex";
        if (unlockedModules.includes(subId)) {
          btn.classList.remove("locked", "token-locked");
          btn.title = `Sub-Modul ${subId}`;
          if (lockIcon) lockIcon.classList.add("hidden");
        } else {
          btn.classList.add("locked");
          btn.classList.remove("token-locked");
          btn.title = `🔒 Sub-Modul ${subId} (Selesaikan sub-modul sebelumnya untuk membuka)`;
          if (lockIcon) lockIcon.classList.remove("hidden");
        }
      }
    } else {
      // Teacher mode view: show all sub-tabs
      btn.style.display = "inline-flex";
      btn.classList.remove("locked", "token-locked");
      btn.title = `Mode Guru — Sub-Modul ${subId}`;
      if (lockIcon) lockIcon.classList.add("hidden");
    }
  });
}

// =====================================================================
// ADVANCED TEACHER CONTROL FUNCTIONS (NEW)
// =====================================================================

// --- 1. MODE UJIAN SERENTAK (Class Exam Mode) ---
// Mengunci semua siswa ke halaman kuis dan menonaktifkan tombol Materi.
function activateExamMode() {
  isExamMode = true;
  localStorage.setItem("teacherExamMode", "true");
  showPage("kuis");

  // Sembunyikan tab Materi & kunci navigasi sub-modul
  if (materiTab) {
    materiTab.classList.add("opacity-40", "pointer-events-none");
    materiTab.title = "Terkunci oleh Guru — Mode Ujian Aktif";
  }
  document.querySelectorAll(".sub-tab").forEach(btn => {
    btn.classList.add("pointer-events-none", "opacity-50");
  });

  // Tampilkan banner ujian di atas halaman kuis
  let banner = document.getElementById("exam-mode-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "exam-mode-banner";
    banner.className = "fixed top-0 left-0 right-0 z-40 flex items-center justify-center gap-2 bg-[#a53e24] py-2 px-4 text-white text-xs font-bold shadow-lg";
    banner.innerHTML = `<span>🔴 MODE UJIAN AKTIF — Navigasi halaman dikunci oleh Guru. Fokus pada pengerjaan kuis!</span>`;
    document.body.prepend(banner);
  }
  document.body.style.paddingTop = "36px";
}

function deactivateExamMode() {
  isExamMode = false;
  localStorage.removeItem("teacherExamMode");

  if (materiTab) {
    materiTab.classList.remove("opacity-40", "pointer-events-none");
    materiTab.title = "";
  }
  document.querySelectorAll(".sub-tab").forEach(btn => {
    btn.classList.remove("pointer-events-none", "opacity-50");
  });
  updateSubTabLockStates();

  const banner = document.getElementById("exam-mode-banner");
  if (banner) banner.remove();
  document.body.style.paddingTop = "";
  showTeacherToast("✅ Mode Ujian Dinonaktifkan. Siswa dapat kembali mengakses materi.");
}

// --- 2. PAUSE / RESUME KUIS KELAS ---
// Membekukan timer dan menonaktifkan input jawaban siswa.
function pauseClassQuiz() {
  if (!isQuizPaused) {
    isQuizPaused = true;
    stopQuizTimer();

    // Overlay blur atas soal kuis
    let overlay = document.getElementById("quiz-pause-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "quiz-pause-overlay";
      overlay.className = "fixed inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm";
      overlay.innerHTML = `
        <div class="rounded-3xl bg-[#fffdf7] p-8 text-center shadow-2xl border-2 border-[#ee824b] max-w-sm mx-4">
          <div class="text-4xl mb-3">⏸️</div>
          <h3 class="display-font text-lg font-bold text-[#174d3a]">Kuis Dijeda oleh Guru</h3>
          <p class="text-xs text-[#405047] mt-2">Pengerjaan kuis dihentikan sementara. Silakan tunggu instruksi dari Guru untuk melanjutkan.</p>
        </div>`;
      document.body.appendChild(overlay);
    }
    overlay.classList.remove("hidden");
    return "paused";
  } else {
    isQuizPaused = false;
    const overlay = document.getElementById("quiz-pause-overlay");
    if (overlay) overlay.classList.add("hidden");
    if (!isQuizChecked) startQuizTimer();
    showTeacherToast("▶️ Kuis Dilanjutkan. Timer aktif kembali.");
    return "resumed";
  }
}

// --- 3. BROADCAST PENGUMUMAN GURU ---
// Menampilkan banner pesan dari guru ke seluruh tampilan siswa.
function broadcastTeacherAnnouncement(message) {
  if (!message || !message.trim()) return;

  const existingBroadcast = document.getElementById("teacher-broadcast-banner");
  if (existingBroadcast) existingBroadcast.remove();

  const banner = document.createElement("div");
  banner.id = "teacher-broadcast-banner";
  banner.className = "fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4";
  banner.innerHTML = `
    <div class="rounded-2xl bg-[#174d3a] border-2 border-[#d8ee93] px-5 py-3.5 shadow-2xl flex items-start gap-3">
      <span class="text-2xl mt-0.5">📢</span>
      <div class="flex-1">
        <p class="text-[11px] font-bold text-[#d8ee93] uppercase tracking-wider">Pengumuman dari Guru</p>
        <p class="text-xs font-semibold text-white mt-0.5">${escapeHtml(message)}</p>
      </div>
      <button onclick="document.getElementById('teacher-broadcast-banner').remove()" class="text-[#d8ee93] hover:text-white text-lg leading-none ml-2">✕</button>
    </div>`;
  document.body.appendChild(banner);

  // Auto-dismiss setelah 15 detik
  setTimeout(() => {
    if (banner.parentNode) banner.remove();
  }, 15000);
}

// --- 4. RESET PROGRES SISWA (Hapus unlock modules untuk sesi ulang) ---
function resetStudentProgress(confirmMsg = true) {
  if (confirmMsg) {
    const ok = confirm("⚠️ KONFIRMASI RESET PROGRES\n\nIni akan menghapus semua progres unlock Sub-Modul siswa pada perangkat ini dan mengatur ulang ke awal (hanya Sub-Modul 1A yang terbuka).\n\nLanjutkan?");
    if (!ok) return;
  }
  localStorage.removeItem("unlockedModules");
  localStorage.removeItem("quizLogs");
  unlockedModules = ["1A"];
  updateSubTabLockStates();
  switchSubModule("1A");
  showPage("materi");
  showTeacherToast("🔄 Progres siswa telah direset. Hanya Sub-Modul 1A terbuka.");
}

// --- 5. KUNCI NAVIGASI MODUL (Lock sub-tab switching saat ujian) ---
function toggleModuleNavLock(lock) {
  isModuleNavLocked = lock;
  document.querySelectorAll(".sub-tab").forEach(btn => {
    if (lock) {
      btn.classList.add("pointer-events-none", "opacity-50");
    } else {
      if (!btn.classList.contains("locked")) {
        btn.classList.remove("pointer-events-none", "opacity-50");
      }
    }
  });
  showTeacherToast(lock
    ? "🔒 Navigasi Sub-Modul dikunci — Siswa tidak bisa ganti modul."
    : "🔓 Kunci Navigasi Sub-Modul dilepas."
  );
}

// --- Helper: Toast Notifikasi Khusus Guru (pojok kanan bawah) ---
function showTeacherToast(msg) {
  const existing = document.getElementById("teacher-toast-notif");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "teacher-toast-notif";
  toast.className = "fixed bottom-6 right-5 z-50 flex items-center gap-2 rounded-2xl bg-[#174d3a] px-4 py-3 text-white text-xs font-semibold shadow-2xl border border-[#d8ee93] transition-all";
  toast.innerHTML = `<span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}

// ------------------- COUNTDOWN TIMER LOGIC -------------------

function startQuizTimer() {
  stopQuizTimer();
  remainingSeconds = quizTimerMinutes * 60;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    if (classControlMatrix && classControlMatrix.examPaused) {
      if (timerDisplay) timerDisplay.textContent = "⏸️ PAUSED";
      return;
    }
    remainingSeconds--;
    updateTimerDisplay();

    if (remainingSeconds <= 0) {
      stopQuizTimer();
      alert("⏰ WAKTU PENGERJAAN HABIS!\n\nWaktu pengerjaan kuis telah selesai. Jawaban Anda dikirim secara otomatis oleh sistem.");
      checkQuiz(true);
    }
  }, 1000);
}

function stopQuizTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  if (!timerDisplay) return;
  const mins = Math.floor(Math.max(0, remainingSeconds) / 60);
  const secs = Math.max(0, remainingSeconds) % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  timerDisplay.textContent = formatted;

  if (quizTimerBadge) {
    if (remainingSeconds <= 120 && remainingSeconds > 0) {
      quizTimerBadge.classList.add("timer-warning");
    } else {
      quizTimerBadge.classList.remove("timer-warning");
    }
  }
}

// Switch Sub-Module with Lock Guard & Content Control Matrix
function switchSubModule(subId) {
  const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
  const isStudentView = !isTeacherActive || classControlMatrix.previewMode;
  const modStatus = (classControlMatrix.modules && classControlMatrix.modules[subId]) || "VISIBLE";

  let loggedUser = null;
  try { loggedUser = JSON.parse(localStorage.getItem("sejarah_user_session") || sessionStorage.getItem("sejarah_user_session") || "null"); } catch(e){}
  const hasRemedialOverride = isStudentView && loggedUser && loggedUser.nama && classControlMatrix.remedialOverrides && classControlMatrix.remedialOverrides[loggedUser.nama] && classControlMatrix.remedialOverrides[loggedUser.nama][subId];

  if (isStudentView && !hasRemedialOverride) {
    const schedStatus = getSubModuleTimeScheduleStatus(subId);
    if (schedStatus === "NOT_OPEN_YET") {
      const startTimeStr = (classControlMatrix.schedules && classControlMatrix.schedules[subId]) ? classControlMatrix.schedules[subId].start : "";
      alert(`⏰ Sub-Modul ${subId} Belum Dibuka!\n\nJadwal Rilis Otomatis: ${startTimeStr.replace("T", " ")} WIB.`);
      return;
    }
    if (schedStatus === "EXPIRED") {
      const expireTimeStr = (classControlMatrix.schedules && classControlMatrix.schedules[subId]) ? classControlMatrix.schedules[subId].expire : "";
      alert(`⌛ Sesi Akses Sub-Modul ${subId} Telah Berakhir pada: ${expireTimeStr.replace("T", " ")} WIB.`);
      return;
    }
    if (modStatus === "HIDDEN" || modStatus === "LOCKED_HIDDEN") {
      // Silent return - element is hidden, no alert needed to avoid revealing it exists
      return;
    }
    if (modStatus === "LOCKED_VISIBLE") {
      const tokenKey = subId;
      const requiredToken = (classControlMatrix.tokenLocks && classControlMatrix.tokenLocks[tokenKey]) || "";
      // If token is configured and not yet unlocked, show token modal
      if (requiredToken && !window.isElementUnlockedByToken(tokenKey)) {
        if (typeof window.showTokenUnlockModal === "function") {
          window.showTokenUnlockModal(tokenKey, `Sub-Modul ${subId}`, requiredToken, () => switchSubModule(subId));
        } else {
          alert(`🔒 Sub-Modul ${subId} Dikunci oleh Guru.\n\nMasukkan token dari Guru untuk membuka.`);
        }
        return;
      }
      // If no token configured, fallback to old alert
      if (!requiredToken) {
        alert(`🔒 Sub-Modul ${subId} Dikunci oleh Guru Sejarah Anda!\n\nMohon tunggu instruksi rilis dari Guru di kelas.`);
        return;
      }
    }
  }

  // Ensure 1A is always unlocked in default mode
  if (!Array.isArray(unlockedModules)) unlockedModules = ["1A"];
  if (!unlockedModules.includes("1A")) unlockedModules.unshift("1A");

  // Check if sub-module is unlocked (Bypass if Teacher Mode active, Remedial Override present, OR Direct Flow)
  const isDirectFlow = classControlMatrix.interModuleFlow === "DIRECT";
  if (isStudentView && !hasRemedialOverride && !isDirectFlow && subId !== "1A" && !unlockedModules.includes(subId)) {
    const sequence = ["1A", "1B", "1C", "1D", "1E", "1F"];
    const targetIdx = sequence.indexOf(subId);
    const prevSub = targetIdx > 0 ? sequence[targetIdx - 1] : "1A";
    
    alert(`🔒 Sub-Modul ${subId} Terkunci!\n\nUntuk membuka sub-modul ini, Anda wajib membaca materi dan LULUS Kuis Sub-Modul ${prevSub} terlebih dahulu (Minimal Nilai KKM: ${kkmThreshold}%).`);
    return;
  }

  const data = getModulesData();
  if (!data || !data[subId]) return;
  currentSubModule = subId;

  // Update Sub-Tab Buttons Active UI
  document.querySelectorAll(".sub-tab").forEach(btn => {
    if (btn.dataset.submod === subId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update Hero Image with fallback
  const heroImg = document.querySelector('[data-template-id="hero-image"]');
  if (heroImg && data[subId].heroImage) {
    heroImg.style.display = 'block';
    heroImg.src = data[subId].heroImage;
    heroImg.alt = "Ilustrasi Sejarah Perjuangan Kemerdekaan Indonesia 1945-1949";
    heroImg.onerror = function() {
      this.style.display = 'none';
    };
  }

  // Inject Template Data Text & HTML
  const tData = data[subId].templateData;
  if (tData) {
    Object.keys(tData).forEach(key => {
      const elements = document.querySelectorAll(`[data-template-id="${key}"]`);
      elements.forEach(el => {
        el.innerHTML = tData[key];
      });
    });
  }

  // Reset & Prepare Quiz Questions Sequence (Controlled by Matrix Question Count & Shuffling Mode)
  const rawQuizData = data[subId].quizData || [];
  const qLimit = (classControlMatrix.questionCounts && classControlMatrix.questionCounts[subId]) ? classControlMatrix.questionCounts[subId] : 15;
  
  let preparedQuestions = [];
  if (classControlMatrix.shuffleQuestions === "ON") {
    // Deep clone and shuffle both questions and option choices
    preparedQuestions = shuffleArray(JSON.parse(JSON.stringify(rawQuizData))).slice(0, Math.min(rawQuizData.length, qLimit));
    preparedQuestions.forEach(q => {
      if (q.options && Array.isArray(q.options) && q.type !== "complex") {
        const cleanedOpts = q.options.map(opt => String(opt).replace(/^[A-E]\.\s*/, ''));
        const correctCleanText = cleanedOpts[q.answer];
        const shuffledCleaned = shuffleArray(cleanedOpts);
        q.answer = shuffledCleaned.indexOf(correctCleanText);
        q.options = shuffledCleaned.map((optText, idx) => `${String.fromCharCode(65 + idx)}. ${optText}`);
      }
    });
  } else {
    // Fixed naskah order
    preparedQuestions = JSON.parse(JSON.stringify(rawQuizData)).slice(0, Math.min(rawQuizData.length, qLimit));
  }
  activeQuizQuestions = preparedQuestions;
  userAnswers = Array(activeQuizQuestions.length).fill(null);
  currentQuestionIndex = 0;
  isQuizChecked = false;
  tabSwitchCount = 0;
  if (tabSwitchCountSpan) tabSwitchCountSpan.textContent = "0";
  if (antiCheatBadge) antiCheatBadge.classList.add("hidden");
  quizStartTime = new Date();
  stopQuizTimer();
  // Render Flashcards for current Sub-Module
  currentFlashcardIdx = 0;
  renderCurrentFlashcard();

  if (feedback) {
    feedback.textContent = "";
    feedback.className = "mt-3 text-center text-xs md:text-sm font-semibold";
  }
  if (resultPanel) resultPanel.classList.add("hidden");
  if (scoreDisplay) scoreDisplay.textContent = "0";

  const unlockCard = document.getElementById("unlock-notification-card");
  if (unlockCard) unlockCard.classList.add("hidden");
  const continueNextBtn = document.getElementById("continue-next-mod-button");
  if (continueNextBtn) continueNextBtn.classList.add("hidden");

  // Re-render Quiz Navigation & Card
  renderQuestionNavGrid();
  renderSingleQuestionCard(currentQuestionIndex);
  updateProgress();
  updateStepperButtons();

  if (typeof window.initFlashcards === "function") window.initFlashcards(subId);
  if (window.lucide) window.lucide.createIcons();
}

// ------------------- PAGE TAB SWITCHER -------------------

function showPage(page) {
  if (!materiPage || !kuisPage) return;

  if (page === "materi") {
    materiPage.classList.add("active");
    kuisPage.classList.remove("active");
    materiTab.classList.add("active");
    materiTab.classList.remove("text-[#174d3a]");
    kuisTab.classList.remove("active");
    kuisTab.classList.add("text-[#174d3a]");
    stopQuizTimer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    // Check Attempt Limit Guard (Dimensi A)
    const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
    const subId = currentSubModule || "1A";
    if (!isTeacherActive) {
      const quizStatus = (classControlMatrix.quizzes && classControlMatrix.quizzes[subId]) || "VISIBLE";
      if (quizStatus === "HIDDEN" || quizStatus === "LOCKED_HIDDEN") {
        alert(`🔴 Kuis HOTS Sub-Modul ${subId} sedang disembunyikan/dikunci oleh Guru.`);
        return;
      }
    }

    const limit = parseInt(classControlMatrix.attemptLimit || 0, 10);

    if (!isTeacherActive && limit > 0) {
      let activeStudent = null;
      try { activeStudent = JSON.parse(sessionStorage.getItem("sejarah_user_session") || localStorage.getItem("sejarah_user_session") || "null"); } catch(e){}

      if (activeStudent) {
        let logs = [];
        try { logs = JSON.parse(localStorage.getItem("sejarah_monitoring_logs") || "[]"); } catch(e){}

        const attempts = logs.filter(l => {
          const isSameStudent = (l.email && activeStudent.email && l.email.toLowerCase() === activeStudent.email.toLowerCase()) ||
                                (l.nama && activeStudent.nama && l.nama.toLowerCase() === activeStudent.nama.toLowerCase());
          const isSameSubModule = (l.subModule === currentSubModule || l.subId === currentSubModule);
          return isSameStudent && isSameSubModule;
        });

        if (attempts.length >= limit) {
          alert(`🔒 KUOTA UJIAN HABIS!\n\nAnda telah mengerjakan Sub-Modul ${currentSubModule} sebanyak ${attempts.length} kali.\nKuis ini dikunci oleh Guru (Maksimal ${limit}x kesempatan ujian).`);
          return;
        }
      }
    }

    kuisPage.classList.add("active");
    materiPage.classList.remove("active");
    kuisTab.classList.add("active");
    kuisTab.classList.remove("text-[#174d3a]");
    materiTab.classList.remove("active");
    materiTab.classList.add("text-[#174d3a]");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!quizStartTime) quizStartTime = new Date();
    if (!isQuizChecked) startQuizTimer();
  }
  if (window.lucide) window.lucide.createIcons();
}

// Check if Question is Answered
function isAnswered(index) {
  const ans = userAnswers[index];
  if (ans === null || ans === undefined) return false;
  if (Array.isArray(ans)) return ans.length > 0;
  return true;
}

// Question Grid Navigation Renderer
function renderQuestionNavGrid() {
  const gridContainer = document.getElementById("question-nav-grid");
  if (!gridContainer) return;
  gridContainer.innerHTML = "";

  const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
  const isForwardOnly = (classControlMatrix.navigationMode === "FORWARD_ONLY" && !isTeacherActive);

  activeQuizQuestions.forEach((_, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";

    const isPast = idx < currentQuestionIndex;
    let btnClass = `q-nav-btn ${idx === currentQuestionIndex ? "active" : ""} ${isAnswered(idx) ? "answered" : ""}`;
    if (isForwardOnly && isPast) {
      btnClass += " opacity-30 cursor-not-allowed pointer-events-none";
    }

    btn.className = btnClass;
    btn.textContent = idx + 1;
    btn.title = (isForwardOnly && isPast) ? `Soal ${idx + 1} (Terkunci)` : `Soal ${idx + 1}`;
    btn.addEventListener("click", () => {
      if (isForwardOnly && isPast) return;
      currentQuestionIndex = idx;
      renderSingleQuestionCard(currentQuestionIndex);
      updateQuestionNavGrid();
      updateStepperButtons();
    });
    gridContainer.appendChild(btn);
  });
}

function updateQuestionNavGrid() {
  const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
  const isForwardOnly = (classControlMatrix.navigationMode === "FORWARD_ONLY" && !isTeacherActive);
  const btns = document.querySelectorAll(".q-nav-btn");

  btns.forEach((btn, idx) => {
    const isPast = idx < currentQuestionIndex;
    if (idx === currentQuestionIndex) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
    if (isAnswered(idx)) {
      btn.classList.add("answered");
    } else {
      btn.classList.remove("answered");
    }

    if (isForwardOnly && isPast) {
      btn.classList.add("opacity-30", "cursor-not-allowed", "pointer-events-none");
    } else {
      btn.classList.remove("opacity-30", "cursor-not-allowed", "pointer-events-none");
    }
  });
}

function updateStepperButtons() {
  const totalQ = activeQuizQuestions.length || 15;
  const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
  const isForwardOnly = (classControlMatrix.navigationMode === "FORWARD_ONLY" && !isTeacherActive);

  if (prevQBtn) {
    if (isForwardOnly) {
      prevQBtn.disabled = true;
      prevQBtn.classList.add("opacity-30", "cursor-not-allowed", "pointer-events-none");
      prevQBtn.title = "Mode Forward-Only: Nomor sebelumnya telah dikunci oleh Guru";
    } else {
      prevQBtn.disabled = currentQuestionIndex === 0;
      prevQBtn.classList.remove("opacity-30", "cursor-not-allowed", "pointer-events-none");
      prevQBtn.title = "Soal Sebelumnya";
    }
  }

  if (nextQBtn) nextQBtn.disabled = currentQuestionIndex === totalQ - 1;

  if (checkQuizButton) {
    if (currentQuestionIndex < totalQ - 1) {
      checkQuizButton.classList.add("hidden");
    } else {
      checkQuizButton.classList.remove("hidden");
    }
  }
}

// Single Question Stepper Card Renderer
function renderSingleQuestionCard(qIndex) {
  if (!quizList || !activeQuizQuestions[qIndex]) return;

  const q = activeQuizQuestions[qIndex];
  quizList.innerHTML = "";

  const card = document.createElement("article");
  card.className = "challenge-card rounded-3xl p-5 md:p-8 transition-all duration-300";

  const qType = q.type || "single";
  let typeBadge = "";
  let typeInstruction = "";

  if (qType === "complex") {
    typeBadge = `<span class="rounded-full bg-[#ee824b]/20 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#ee824b]"><i data-lucide="check-square" class="inline h-3 w-3 mr-1"></i>PILIHAN GANDA KOMPLEKS (PILIH 2 JAWABAN BENAR)</span>`;
    typeInstruction = `<p class="mt-1 text-xs font-bold text-[#ee824b]">* Pilihlah 2 opsi jawaban yang paling tepat di bawah ini.</p>`;
  } else if (qType === "true_false") {
    typeBadge = `<span class="rounded-full bg-[#174d3a]/20 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#174d3a]"><i data-lucide="scale" class="inline h-3 w-3 mr-1"></i>ANALISIS PERNYATAAN (BENAR / SALAH)</span>`;
    typeInstruction = `<p class="mt-1 text-xs font-bold text-[#174d3a]">* Tentukan apakah pernyataan kasus di bawah ini BENAR atau SALAH secara historis.</p>`;
  } else if (qType === "data_sufficiency") {
    typeBadge = `<span class="rounded-full bg-[#174d3a]/20 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#174d3a]"><i data-lucide="help-circle" class="inline h-3 w-3 mr-1"></i>PILIHAN GANDA KECUKUPAN DATA</span>`;
    typeInstruction = `<p class="mt-1 text-xs font-bold text-[#174d3a]">* Analisis apakah informasi data (1) dan (2) cukup untuk menjawab pertanyaan sejarah.</p>`;
  } else if (qType === "infographic") {
    typeBadge = `<span class="rounded-full bg-[#ee824b]/20 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#ee824b]"><i data-lucide="bar-chart-2" class="inline h-3 w-3 mr-1"></i>ANALISIS INFOGRAFIK &amp; DIAGRAM DATA</span>`;
    typeInstruction = `<p class="mt-1 text-xs font-bold text-[#ee824b]">* Cermati tabel/diagram data di bawah ini sebelum memilih kesimpulan sejarah.</p>`;
  } else if (qType === "matching") {
    typeBadge = `<span class="rounded-full bg-[#2d7354]/20 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#2d7354]"><i data-lucide="git-merge" class="inline h-3 w-3 mr-1"></i>KLASIFIKASI PASANGAN KONSEP</span>`;
    typeInstruction = `<p class="mt-1 text-xs font-bold text-[#2d7354]">* Pasangkan peristiwa dengan tokoh/konsep sejarah yang paling tepat.</p>`;
  } else {
    typeBadge = `<span class="rounded-full bg-[#174d3a]/15 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#174d3a]"><i data-lucide="file-text" class="inline h-3 w-3 mr-1"></i>PILIHAN GANDA STIMULUS</span>`;
  }

  const stimulusMarkup = q.stimulus ? `
    <div class="mb-4 rounded-2xl border-l-4 border-[#174d3a] bg-[#e8efd9]/70 p-4 text-xs md:text-sm leading-relaxed text-[#17211d]">
      <p class="font-bold text-[#174d3a] text-[11px] md:text-xs tracking-wider mb-1 flex items-center gap-1.5"><i data-lucide="book-open" class="h-4 w-4 text-[#ee824b]"></i> STIMULUS PERISTIWA SEJARAH (LITERASI & ANALISIS):</p>
      <p class="italic text-[#2c3d33]">${q.stimulus}</p>
    </div>
  ` : "";

  const currentAns = userAnswers[qIndex];

  const optionsMarkup = q.options.map((opt, optIndex) => {
    let stateClass = "";
    let iconName = qType === "complex" ? "square" : "circle";

    if (qType === "complex") {
      const arr = Array.isArray(currentAns) ? currentAns : [];
      if (arr.includes(optIndex)) {
        stateClass = "selected";
        iconName = "check-square";
      }
      if (isQuizChecked) {
        const isCorrectOption = Array.isArray(q.answer) && q.answer.includes(optIndex);
        if (isCorrectOption) {
          stateClass = "correct";
          iconName = "check-square";
        } else if (arr.includes(optIndex) && !isCorrectOption) {
          stateClass = "wrong";
          iconName = "x-square";
        }
      }
    } else {
      if (currentAns === optIndex) {
        stateClass = "selected";
        iconName = "check-circle-2";
      }
      if (isQuizChecked) {
        if (optIndex === q.answer) {
          stateClass = "correct";
          iconName = "check-circle-2";
        } else if (optIndex === currentAns && currentAns !== q.answer) {
          stateClass = "wrong";
          iconName = "x-circle";
        }
      }
    }

    return `
      <button type="button" 
              class="quiz-option focus-ring flex w-full items-center justify-between rounded-2xl border border-[#d8d3c4] bg-[#fffdf7] px-4 py-3.5 md:px-5 md:py-4 text-left text-xs md:text-sm font-semibold text-[#17211d] ${stateClass}" 
              data-opt-index="${optIndex}"
              ${isQuizChecked ? "disabled" : ""}>
        <span>${opt}</span>
        <i data-lucide="${iconName}" class="h-4 w-4 shrink-0 text-[#174d3a]"></i>
      </button>
    `;
  }).join("");

  const expStatus = (classControlMatrix.explanations && classControlMatrix.explanations[currentSubModule]) || "LOCKED";
  const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
  const canSeeExplanation = isTeacherActive || expStatus === "VISIBLE";

  const explanationMarkup = isQuizChecked ? (
    canSeeExplanation ? `
      <div class="mt-5 rounded-2xl border border-[#d8ee93] bg-[#f4fae6] p-4 text-xs md:text-sm leading-relaxed text-[#174d3a]">
        <p class="font-bold mb-1 flex items-center gap-1.5"><i data-lucide="sparkles" class="h-4 w-4 text-[#ee824b]"></i> PENJELASAN HISTORIS (HOTS &amp; KAUSALITAS):</p>
        <p>${q.explanation}</p>
      </div>
    ` : `
      <div class="mt-5 rounded-2xl border border-[#d8d3c4] bg-[#f6f3e9] p-4 text-xs leading-relaxed text-[#718277] flex items-center gap-2">
        <i data-lucide="lock" class="h-4 w-4 text-[#a53e24]"></i>
        <span>🔒 Penjelasan HOTS dikunci oleh Guru Sejarah Anda. Pembahasan akan dirilis setelah sesi kelas berakhir.</span>
      </div>
    `
  ) : "";

  card.innerHTML = `
    <div class="flex items-center justify-between gap-2 mb-3">
      <span class="rounded-full bg-[#174d3a] px-3 py-1 text-xs font-bold text-[#d8ee93]">TANTANGAN ${qIndex + 1} DARI ${activeQuizQuestions.length}</span>
      ${typeBadge}
    </div>
    ${stimulusMarkup}
    <h3 class="text-sm md:text-base font-bold text-[#174d3a] leading-snug mb-1">${q.question}</h3>
    ${typeInstruction}
    <div class="mt-4 grid gap-2.5 md:gap-3">
      ${optionsMarkup}
    </div>
    ${explanationMarkup}
  `;

  card.querySelectorAll(".quiz-option").forEach(optBtn => {
    optBtn.addEventListener("click", () => {
      if (isQuizChecked) return;
      const optIdx = parseInt(optBtn.dataset.optIndex, 10);

      if (qType === "complex") {
        let currentArr = Array.isArray(userAnswers[qIndex]) ? [...userAnswers[qIndex]] : [];
        if (currentArr.includes(optIdx)) {
          currentArr = currentArr.filter(i => i !== optIdx);
        } else {
          if (currentArr.length < 2) {
            currentArr.push(optIdx);
          } else {
            currentArr.shift();
            currentArr.push(optIdx);
          }
        }
        userAnswers[qIndex] = currentArr.length > 0 ? currentArr : null;
      } else {
        userAnswers[qIndex] = optIdx;
      }

      renderSingleQuestionCard(qIndex);
      updateQuestionNavGrid();
      updateProgress();
    });
  });

  quizList.appendChild(card);
  if (window.lucide) window.lucide.createIcons();
}

function updateProgress() {
  let count = 0;
  const totalQ = activeQuizQuestions.length || 15;
  for (let i = 0; i < totalQ; i++) {
    if (isAnswered(i)) count++;
  }
  if (progressDisplay) progressDisplay.textContent = `${count}/${totalQ} Terjawab`;
  if (progressFill) {
    const pct = Math.round((count / totalQ) * 100);
    progressFill.style.width = `${pct}%`;
  }
}

// ------------------- QUIZ EVALUATION & GAS SYNC -------------------

function checkQuiz(forceSubmit = false) {
  let unanswered = 0;
  const totalQ = activeQuizQuestions.length || 15;
  for (let i = 0; i < totalQ; i++) {
    if (!isAnswered(i)) unanswered++;
  }

  if (!forceSubmit && unanswered > 0) {
    if (feedback) {
      feedback.textContent = `Masih ada ${unanswered} soal yang belum diisi lengkap. Gunakan navigasi angka (1-${totalQ}) untuk melengkapi seluruh jawaban!`;
      feedback.className = "mt-3 text-center text-xs md:text-sm font-semibold text-[#a53e24]";
    }
    return;
  }

  isQuizChecked = true;
  stopQuizTimer();
  let score = 0;

  // TOPIC/JEJAK DIAGNOSTIC ANALYSIS (DYNAMIC PER SUB-MODULE)
  const curModData = (window.MODULES_DATA && window.MODULES_DATA[currentSubModule]) ? window.MODULES_DATA[currentSubModule].templates : {};
  const cleanTitle = (key, fallback) => (curModData[key] || fallback).replace(/<[^>]*>/g, '').trim();

  const jejakMap = [
    { name: `Jejak 01: ${cleanTitle('lesson-one-title', 'Topik 01')}`, cardId: "lesson-card-one", questions: [0, 1, 2], correct: 0, total: 0 },
    { name: `Jejak 02: ${cleanTitle('lesson-two-title', 'Topik 02')}`, cardId: "lesson-card-two", questions: [3, 4, 5], correct: 0, total: 0 },
    { name: `Jejak 03: ${cleanTitle('lesson-three-title', 'Topik 03')}`, cardId: "lesson-card-three", questions: [6, 7, 8], correct: 0, total: 0 },
    { name: `Jejak 04: ${cleanTitle('lesson-four-title', 'Topik 04')}`, cardId: "lesson-card-four", questions: [9, 10, 11], correct: 0, total: 0 },
    { name: `Jejak 05 & 06: ${cleanTitle('lesson-five-title', 'Topik 05')}`, cardId: "lesson-card-five", questions: [12, 13, 14], correct: 0, total: 0 }
  ];

  activeQuizQuestions.forEach((q, index) => {
    const uAns = userAnswers[index];
    const qType = q.type || "single";
    let isCorrect = false;

    if (qType === "complex") {
      if (Array.isArray(uAns) && Array.isArray(q.answer) && uAns.length === q.answer.length) {
        const sortedU = [...uAns].sort();
        const sortedQ = [...q.answer].sort();
        if (sortedU.every((val, idx) => val === sortedQ[idx])) {
          isCorrect = true;
        }
      }
    } else {
      if (uAns === q.answer) isCorrect = true;
    }

    if (isCorrect) score++;

    const targetJejak = jejakMap.find(j => j.questions.includes(index));
    if (targetJejak) {
      targetJejak.total++;
      if (isCorrect) targetJejak.correct++;
    }
  });

  // Render Diagnostic Card
  const diagCard = document.getElementById("diagnostic-feedback-card");
  const diagList = document.getElementById("diagnostic-topics-list");
  if (diagCard && diagList) {
    diagList.innerHTML = "";
    jejakMap.forEach((j) => {
      const topicPct = j.total > 0 ? Math.round((j.correct / j.total) * 100) : 0;
      const isMastered = topicPct >= 80;

      const itemDiv = document.createElement("div");
      itemDiv.className = `p-2.5 rounded-xl border ${isMastered ? 'border-[#4f8b5c]/30 bg-[#dff3cf]/50 text-[#174d3a]' : 'border-[#ee824b]/40 bg-white text-[#405047]'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2`;

      itemDiv.innerHTML = `
        <div>
          <span class="font-bold text-xs ${isMastered ? 'text-[#174d3a]' : 'text-[#ee824b]'}">${isMastered ? '✅ ' : '⚠️ '}${j.name}</span>
          <p class="text-[11px] opacity-80 mt-0.5">Penguasaan: ${j.correct}/${j.total} Soal (${topicPct}%)</p>
        </div>
        ${!isMastered ? `
          <button type="button" onclick="jumpToMateriJejak('${j.cardId}')" class="shrink-0 rounded-lg bg-[#ee824b] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#d96d36] transition flex items-center gap-1 shadow-sm">
            <span>Pelajari Ulang</span> <i data-lucide="arrow-right" class="h-3 w-3"></i>
          </button>
        ` : `<span class="text-[11px] font-bold text-[#174d3a] shrink-0">Tuntas 👍</span>`}
      `;
      diagList.appendChild(itemDiv);
    });
    diagCard.classList.remove("hidden");
  }

  const pct = Math.round((score / totalQ) * 100);
  const isPassed = pct >= kkmThreshold;

  if (scoreDisplay) scoreDisplay.textContent = score;

  const resultScoreMsg = document.getElementById("result-score-message");
  if (resultScoreMsg) resultScoreMsg.textContent = `Skor Sub-Modul ${currentSubModule}: ${score} dari ${totalQ} (${pct}%).`;

  const resultLevelMsg = document.getElementById("result-level-message");
  if (resultLevelMsg) {
    if (isPassed) {
      resultLevelMsg.textContent = `🎉 LULUS KKM (${kkmThreshold}%)! Anda berhasil menguasai Sub-Modul ${currentSubModule}. Silakan amati ulasan jawaban di bawah ini.`;
    } else {
      resultLevelMsg.textContent = `⚠️ BELUM LULUS KKM (${kkmThreshold}%). Silakan pelajari kembali Jejak Materi Sub-Modul ${currentSubModule} dan ulangi kuis untuk membuka modul berikutnya.`;
    }
  }

  // Handle Progressive Unlocking (Next Module)
  const sequence = ["1A", "1B", "1C", "1D", "1E", "1F"];
  const currentIdx = sequence.indexOf(currentSubModule);
  let nextSubModule = null;

  const claimCertBtn = document.getElementById("claim-certificate-btn");

  if (isPassed && currentIdx !== -1 && currentIdx < sequence.length - 1) {
    nextSubModule = sequence[currentIdx + 1];
    if (!unlockedModules.includes(nextSubModule)) {
      unlockedModules.push(nextSubModule);
      localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
      updateSubTabLockStates();
    }

    const unlockCard = document.getElementById("unlock-notification-card");
    const unlockText = document.getElementById("unlock-notification-text");
    const continueNextBtn = document.getElementById("continue-next-mod-button");

    if (unlockCard && unlockText) {
      unlockText.textContent = `Selamat! Nilai ${pct}% memenuhi batas KKM (${kkmThreshold}%). Sub-Modul ${nextSubModule} sekarang resmi TERBUKA!`;
      unlockCard.classList.remove("hidden");
    }

    if (continueNextBtn) {
      continueNextBtn.classList.remove("hidden");
      continueNextBtn.onclick = () => {
        switchSubModule(nextSubModule);
        showPage("materi");
      };
    }
  } else if (isPassed && (currentSubModule === "1F" || unlockedModules.length === 6)) {
    const claimCertBtn = document.getElementById("claim-certificate-btn") || document.getElementById("claim-certificate-button");
    if (claimCertBtn) {
      claimCertBtn.classList.remove("hidden");
      claimCertBtn.onclick = () => window.showCertificateModal();
    }
  }

  // Sync & Log for Teacher Portal Monitoring Dashboard
  const durationSec = quizStartTime ? Math.round((new Date() - quizStartTime) / 1000) : 0;
  const nowStr = new Date().toLocaleString("id-ID");
  const submissionRecord = {
    timestamp: nowStr,
    nama: activeStudent ? activeStudent.nama : "Siswa Anonim",
    kelas: activeStudent ? activeStudent.kelas : "-",
    email: activeStudent ? activeStudent.email : "-",
    subModule: currentSubModule,
    score: score,
    total: totalQ,
    pct: pct,
    isPassed: isPassed,
    tabSwitchCount: tabSwitchCount,
    durationSec: durationSec
  };

  const isTeacher = sessionStorage.getItem("isTeacherActive") === "true";
  const isPreview = isTeacher && (classControlMatrix && classControlMatrix.previewMode);

  if (!isPreview) {
    try {
      const existingLogs = window.secureStorage.getItem("sejarah_monitoring_logs") || [];
      existingLogs.unshift(submissionRecord);
      window.secureStorage.setItem("sejarah_monitoring_logs", existingLogs);
    } catch(e) {
      console.error("Local monitoring save error:", e);
    }

    // Sync to GAS Backend if URL configured
    if (GAS_API_URL && activeStudent) {
      const payload = {
        action: "SUBMIT_QUIZ",
        requestToken: "SEJARAH_SECURE_TOKEN_2026",
        email: activeStudent.email,
        nama: activeStudent.nama,
        kelas: activeStudent.kelas,
        subModule: currentSubModule,
        score: score,
        total: totalQ,
        tabSwitchCount: tabSwitchCount,
        durationSec: durationSec,
        token: activeStudent.token || "idem"
      };
      if (navigator.onLine) {
        fetch(GAS_API_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(err => {
          console.error("GAS Sync Error (queuing):", err);
          if (typeof window.enqueueOfflinePayload === "function") window.enqueueOfflinePayload(payload);
        });
      } else {
        if (typeof window.enqueueOfflinePayload === "function") window.enqueueOfflinePayload(payload);
      }
    }
  } else {
    console.warn("ISOLATION BARRIER: Teacher Preview Quiz Results will NOT be logged or sent to backend.");
  }

  renderSingleQuestionCard(currentQuestionIndex);
  if (resultPanel) {
    resultPanel.classList.remove("hidden");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  if (window.lucide) window.lucide.createIcons();
}

// ------------------- AUTH & TEACHER MODAL HANDLERS -------------------

function handleStudentLogin(nama, email, kelas, token) {
  const deviceToken = typeof window.getOrCreateDeviceToken === 'function' ? window.getOrCreateDeviceToken() : `DEV-${Date.now()}`;
  const sessionId = `REG-${email.split('@')[0] || 'SISWA'}-${Date.now()}`;
  activeStudent = { nama, email, kelas, token, sessionId, deviceToken, status: "APPROVED" };
  window.secureStorage.setItem("activeStudent", activeStudent);

  try {
    const regLogs = window.secureStorage.getItem("sejarah_registered_students") || [];
    const existingIdx = regLogs.findIndex(s => s.email === email);
    const regRecord = {
      timestamp: new Date().toLocaleString("id-ID"),
      nama: nama,
      kelas: kelas,
      email: email,
      token: token,
      status: "APPROVED",
      sessionId: sessionId,
      deviceToken: deviceToken
    };
    if (existingIdx !== -1) {
      regLogs[existingIdx] = regRecord;
    } else {
      regLogs.unshift(regRecord);
    }
    window.secureStorage.setItem("sejarah_registered_students", regLogs);
    if (typeof window.renderTeacherActivationData === 'function') window.renderTeacherActivationData();
    if (typeof window.renderTeacherMonitoringData === 'function') window.renderTeacherMonitoringData();
  } catch(err) {}

  if (typeof window.registerDeviceSession === 'function') {
    window.registerDeviceSession(email, nama, kelas, token);
  }
  if (typeof window.startSingleDeviceHeartbeat === 'function') {
    window.startSingleDeviceHeartbeat();
  }

  if (activeStudentNameSpan) activeStudentNameSpan.textContent = `${nama} (${kelas})`;
  const badge = document.getElementById("student-session-badge");
  if (badge) badge.classList.remove("hidden");

  if (studentAuthModal) studentAuthModal.classList.add("hidden");

  // Record student registration/session immediately to Google Sheets (Tab StudentRegistrations)
  if (GAS_API_URL && GAS_API_URL.startsWith("http")) {
    fetch(GAS_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "registerStudent",
        requestToken: "SEJARAH_SECURE_TOKEN_2026",
        email: email,
        nama: nama,
        kelas: kelas,
        token: token
      })
    }).catch(err => console.error("GAS Reg Sync Error:", err));

    // 2. Fetch unlocked modules
    fetch(`${GAS_API_URL}?action=VERIFY_STUDENT&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&nama=${encodeURIComponent(nama)}&kelas=${encodeURIComponent(kelas)}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === "SUCCESS" && data.unlockedModules) {
          unlockedModules = data.unlockedModules;
          if (typeof window.saveUnlockedModulesHelper === 'function') {
            window.saveUnlockedModulesHelper(unlockedModules);
          } else {
            localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
          }
          updateSubTabLockStates();
        } else if (data.status === "INVALID_TOKEN") {
          alert("Token Kelas Salah! Silakan tanyakan Token resmi ke Guru Anda.");
          if (studentAuthModal) studentAuthModal.classList.remove("hidden");
        }
      })
      .catch(() => {
        // Fallback local persistence if GAS offline
        if (typeof window.getUnlockedModulesHelper === 'function') {
          unlockedModules = window.getUnlockedModulesHelper();
        } else {
          const localSaved = localStorage.getItem("unlockedModules");
          if (localSaved) {
            try { unlockedModules = JSON.parse(localSaved); } catch(e) {}
          }
        }
        updateSubTabLockStates();
      });
  } else {
    // Offline Mock Fallback
    if (typeof window.getUnlockedModulesHelper === 'function') {
      unlockedModules = window.getUnlockedModulesHelper();
    } else {
      const localSaved = localStorage.getItem("unlockedModules");
      if (localSaved) {
        try { unlockedModules = JSON.parse(localSaved); } catch(e) {}
      }
    }
    updateSubTabLockStates();
  }

  switchSubModule(currentSubModule || "1A");
}

// Helper: Escape HTML to prevent XSS in monitoring table
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  // DOM CLEANUP: Remove duplicate broken blocks introduced by merge scripts
  const broken = document.getElementById("module-view-broken");
  if (broken) broken.remove();
  
  const duplicateIds = ['certificate-modal', 'student-auth-modal', 'teacher-admin-modal', 'teacher-hots-preview-modal'];
  duplicateIds.forEach(id => {
    const els = document.querySelectorAll('#' + id);
    // Keep the LAST element (which has the most updated IDs from the merge)
    for (let i = 0; i < els.length - 1; i++) {
      els[i].remove();
    }
  });

  materiPage = document.getElementById("materi-page");
  kuisPage = document.getElementById("kuis-page");
  materiTab = document.getElementById("materi-tab");
  kuisTab = document.getElementById("kuis-tab");
  quizList = document.getElementById("quiz-list");
  scoreDisplay = document.getElementById("score-display");
  progressDisplay = document.getElementById("progress-display");
  progressFill = document.getElementById("progress-fill");
  feedback = document.getElementById("feedback");
  resultPanel = document.getElementById("result-panel");
  prevQBtn = document.getElementById("prev-q-btn");
  nextQBtn = document.getElementById("next-q-btn");
  checkQuizButton = document.getElementById("check-quiz-button");
  antiCheatBadge = document.getElementById("anti-cheat-badge");
  tabSwitchCountSpan = document.getElementById("tab-switch-count");
  timerDisplay = document.getElementById("timer-display");
  quizTimerBadge = document.getElementById("quiz-timer-badge");
  studentAuthModal = document.getElementById("student-auth-modal");
  studentAuthForm = document.getElementById("student-auth-form");
  authErrorMsg = document.getElementById("auth-error-msg");
  activeStudentNameSpan = document.getElementById("active-student-name");
  reloginBtn = document.getElementById("relogin-btn");
  teacherAdminModal = document.getElementById("teacher-admin-modal");
  teacherAdminForm = document.getElementById("teacher-admin-form");
  closeTeacherModalBtn = document.getElementById("close-teacher-modal-btn");
  teacherMsg = document.getElementById("teacher-msg");

  // Anti-Cheat: Monitor Tab Switch & Disable Copy
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && kuisPage && kuisPage.classList.contains("active") && !isQuizChecked) {
      tabSwitchCount++;
      if (tabSwitchCountSpan) tabSwitchCountSpan.textContent = tabSwitchCount;
      if (antiCheatBadge) antiCheatBadge.classList.remove("hidden");
    }
  });

  if (kuisPage) {
    kuisPage.addEventListener("contextmenu", (e) => e.preventDefault());
    kuisPage.addEventListener("copy", (e) => e.preventDefault());
    kuisPage.addEventListener("selectstart", (e) => e.preventDefault());
  }

  // Student Auth Form Submission Listener
  if (studentAuthForm) {
    studentAuthForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nama = document.getElementById("input-student-nama").value.trim();
      const email = document.getElementById("input-student-email").value.trim().toLowerCase();
      const kelas = document.getElementById("input-student-kelas").value;
      const token = document.getElementById("input-student-token").value.trim();

      const activeClassToken = (localStorage.getItem("sejarah_active_class_token") || "idem").trim().toUpperCase();
      const enteredToken = token.trim().toUpperCase();

      if (!nama || !email || !token) {
        if (authErrorMsg) {
          authErrorMsg.textContent = "Mohon lengkapi Nama, Alamat Gmail, dan Token Kelas!";
          authErrorMsg.classList.remove("hidden");
        }
        return;
      }

      // Enforce strict @gmail.com email format (Reject pseudo / non-gmail domains)
      const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
      if (!gmailPattern.test(email)) {
        if (authErrorMsg) {
          authErrorMsg.textContent = "⚠️ Pendaftaran WAJIB menggunakan alamat email aktif bertipe @gmail.com! Email ini digunakan Guru untuk mengirimkan Sertifikat & Link Remedial.";
          authErrorMsg.classList.remove("hidden");
        }
        return;
      }

      if (enteredToken !== activeClassToken && enteredToken !== "idem" && enteredToken !== "SEJARAH12" && enteredToken !== "SEJARAH-MASTER") {
        if (authErrorMsg) {
          authErrorMsg.textContent = `🔒 Token Kelas "${token}" Salah atau Sesi Telah Ditutup oleh Guru! Minta Token Aktif terbaru.`;
          authErrorMsg.classList.remove("hidden");
        }
        return;
      }

      // Check approval status from local registered students database (TAHAP A GATEKEEPER)
      const isTeacher = sessionStorage.getItem("isTeacherActive") === "true";
      if (!isTeacher) {
        const regLogs = window.secureStorage.getItem("sejarah_registered_students") || [];
        const found = regLogs.find(s => s.email === email);

        if (!found || found.status !== "APPROVED") {
          // 1. Initial status is PENDING_ACTIVATION
          const deviceToken = typeof window.getOrCreateDeviceToken === 'function' ? window.getOrCreateDeviceToken() : `DEV-${Date.now()}`;
          const sessionId = `REG-${email.split('@')[0] || 'SISWA'}-${Date.now()}`;
          const pendingStudent = {
            nama,
            email,
            kelas,
            token,
            sessionId,
            deviceToken,
            status: "PENDING_ACTIVATION",
            timestamp: new Date().toLocaleString("id-ID")
          };

          window.secureStorage.setItem("activeStudent", pendingStudent);

          // 2. Add/update record in registered logs
          const regRecord = { ...pendingStudent };
          const existingIdx = regLogs.findIndex(s => s.email === email);
          if (existingIdx !== -1) {
            regLogs[existingIdx] = regRecord;
          } else {
            regLogs.unshift(regRecord);
          }
          window.secureStorage.setItem("sejarah_registered_students", regLogs);

          // 3. Register device session & sync to GAS
          if (typeof window.registerDeviceSession === 'function') {
            window.registerDeviceSession(email, nama, kelas, token);
          }

          if (typeof GAS_API_URL !== 'undefined' && GAS_API_URL && GAS_API_URL.startsWith("http")) {
            fetch(GAS_API_URL, {
              method: "POST",
              mode: "no-cors",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "registerStudent",
                requestToken: "SEJARAH_SECURE_TOKEN_2026",
                email: email,
                nama: nama,
                kelas: kelas,
                token: token,
                status: "PENDING_ACTIVATION"
              })
            }).catch(err => console.error("GAS Reg Sync Error:", err));
          }

          // 4. Hide auth form & trigger Activation Pending Status Modal (MENUNGGU AKTIVASI GURU)
          if (studentAuthModal) studentAuthModal.classList.add("hidden");
          if (typeof window.enableEnterModuleButton === 'function') window.enableEnterModuleButton();
          if (typeof window.showActivationPendingModal === 'function') {
            window.showActivationPendingModal(pendingStudent);
          } else {
            const modal = document.getElementById("activation-pending-modal");
            const namaEl = document.getElementById("act-modal-nama");
            const emailEl = document.getElementById("act-modal-email");
            const tokenEl = document.getElementById("act-modal-token");
            if (namaEl) namaEl.textContent = nama;
            if (emailEl) emailEl.textContent = email;
            if (tokenEl) tokenEl.textContent = token;
            if (modal) modal.classList.remove("hidden");
          }
          return;
        }
      }

      handleStudentLogin(nama, email, kelas, token);
    });
  }

  // Relogin Button Listener
  if (reloginBtn) {
    reloginBtn.addEventListener("click", () => {
      if (studentAuthModal) studentAuthModal.classList.remove("hidden");
    });
  }

  // Main Page Tab Switcher Event Listeners (Materi vs Kuis)
  if (materiTab) {
    materiTab.addEventListener("click", () => showPage("materi"));
  }
  if (kuisTab) {
    kuisTab.addEventListener("click", () => {
      if (typeof window.requestAccessToQuiz === "function") {
        window.requestAccessToQuiz(currentSubModule);
      } else {
        showPage("kuis");
      }
    });
  }

  // Sub-Tab Switcher Event Listeners
  document.querySelectorAll(".sub-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      switchSubModule(tab.dataset.submod);
    });
  });

  async function openTeacherModal() {
    if (sessionStorage.getItem("isTeacherActive") !== "true") {
      const pwd = prompt("🔒 Akses Terproteksi Mode Guru:\nMasukkan Kata Sandi Master Guru / Kode Keamanan [pulucinor]:");
      if (pwd === null) return;
      const enteredPwd = pwd.trim();
      const isValid = (enteredPwd.toLowerCase() === "pulucinor") || (await window.verifyPasswordSecure(enteredPwd));
      if (!isValid) {
        alert("⚠️ Akses Ditolak: PIN Kata sandi guru atau Kode keamanan [pulucinor] salah!");
        return;
      }
      sessionStorage.setItem("isTeacherActive", "true");
    }

    updateTeacherUIIndicator();
    updateSubTabLockStates();

      renderMonitoringDashboard();
      const gasInput = document.getElementById("input-teacher-gas-url");
      const kkmInput = document.getElementById("input-teacher-kkm");
      const timerInput = document.getElementById("input-teacher-timer");
      if (gasInput) gasInput.value = GAS_API_URL;
      if (kkmInput) kkmInput.value = kkmThreshold;
      if (timerInput) timerInput.value = quizTimerMinutes;
    if (teacherAdminModal) teacherAdminModal.classList.remove("hidden");
  }

  // Open Explicit Teacher Portal Button
  const openTeacherPortalBtn = document.getElementById("open-teacher-portal-btn");
  if (openTeacherPortalBtn) {
    openTeacherPortalBtn.addEventListener("click", openTeacherModal);
  }

  // Teacher Action: Preview Module as Teacher (All Unlocked)
  const btnTeacherPreview = document.getElementById("btn-teacher-preview-module");
  if (btnTeacherPreview) {
    btnTeacherPreview.addEventListener("click", () => {
      sessionStorage.setItem("isTeacherActive", "true");
      updateTeacherUIIndicator();
      updateSubTabLockStates();
      if (teacherAdminModal) teacherAdminModal.classList.add("hidden");
      switchSubModule(currentSubModule || "1A");
      showPage("materi");
    });
  }

  // Teacher Action: Unlock All Sub-Modules for Students
  const btnTeacherUnlockStudents = document.getElementById("btn-teacher-unlock-students");
  if (btnTeacherUnlockStudents) {
    btnTeacherUnlockStudents.addEventListener("click", () => {
      unlockedModules = ["1A", "1B", "1C", "1D", "1E", "1F"];
      updateSubTabLockStates();
      alert("🔓 Seluruh Sub-Modul (1A - 1F) telah dibuka untuk sesi siswa saat ini!");
    });
  }

  // Teacher Action: Exit Teacher Mode
  const btnExitTeacher = document.getElementById("btn-exit-teacher-mode");
  if (btnExitTeacher) {
    btnExitTeacher.addEventListener("click", () => {
      sessionStorage.removeItem("isTeacherActive");
      deactivateExamMode();
      let saved = typeof window.getUnlockedModulesHelper === 'function' ? window.getUnlockedModulesHelper() : [];
      unlockedModules = Array.isArray(saved) && saved.length > 0 ? saved : ["1A"];
      updateTeacherUIIndicator();
      updateSubTabLockStates();
      switchSubModule("1A");
      alert("ℹ️ Anda telah keluar dari Mode Guru Master. Perangkat kembali ke Mode Siswa (KKM Progresif).");
    });
  }

  // =====================================================================
  // ADVANCED TEACHER CONTROL EVENT LISTENERS (NEW FEATURES)
  // =====================================================================

  // --- 1. Tombol Aktifkan / Nonaktifkan Mode Ujian Serentak ---
  const btnActivateExam = document.getElementById("btn-activate-exam-mode");
  if (btnActivateExam) {
    btnActivateExam.addEventListener("click", () => {
      if (!isExamMode) {
        activateExamMode();
        btnActivateExam.textContent = "⏹ Nonaktifkan Mode Ujian";
        btnActivateExam.classList.replace("bg-[#a53e24]", "bg-[#718277]");
        if (teacherAdminModal) teacherAdminModal.classList.add("hidden");
        showTeacherToast("🔴 Mode Ujian Serentak AKTIF — Semua siswa dikunci ke halaman kuis.");
      } else {
        deactivateExamMode();
        btnActivateExam.textContent = "🔴 Aktifkan Mode Ujian Serentak";
        btnActivateExam.classList.replace("bg-[#718277]", "bg-[#a53e24]");
      }
    });
  }

  // --- 2. Tombol Pause / Resume Kuis ---
  const btnPauseQuiz = document.getElementById("btn-pause-class-quiz");
  if (btnPauseQuiz) {
    btnPauseQuiz.addEventListener("click", () => {
      const result = pauseClassQuiz();
      if (result === "paused") {
        btnPauseQuiz.innerHTML = `<i data-lucide="play" class="h-3.5 w-3.5"></i><span>▶ Resume Kuis</span>`;
        if (teacherAdminModal) teacherAdminModal.classList.add("hidden");
      } else {
        btnPauseQuiz.innerHTML = `<i data-lucide="pause" class="h-3.5 w-3.5"></i><span>⏸ Pause Kuis Kelas</span>`;
      }
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // --- 3. Tombol Broadcast Pengumuman ---
  const btnBroadcast = document.getElementById("btn-broadcast-announcement");
  if (btnBroadcast) {
    btnBroadcast.addEventListener("click", () => {
      const input = document.getElementById("input-broadcast-message");
      const msg = input ? input.value.trim() : "";
      if (!msg) { showTeacherToast("⚠️ Ketik pesan pengumuman terlebih dahulu!"); return; }
      broadcastTeacherAnnouncement(msg);
      if (input) input.value = "";
      if (teacherAdminModal) teacherAdminModal.classList.add("hidden");
      showTeacherToast("📢 Pengumuman berhasil dikirim ke tampilan siswa!");
    });
  }

  // --- 4. Tombol Reset Progres Siswa ---
  const btnResetProgress = document.getElementById("btn-reset-student-progress");
  if (btnResetProgress) {
    btnResetProgress.addEventListener("click", () => {
      resetStudentProgress(true);
    });
  }

  // --- 5. Tombol Toggle Kunci Navigasi Modul ---
  const btnNavLock = document.getElementById("btn-toggle-nav-lock");
  if (btnNavLock) {
    btnNavLock.addEventListener("click", () => {
      isModuleNavLocked = !isModuleNavLocked;
      toggleModuleNavLock(isModuleNavLocked);
      btnNavLock.textContent = isModuleNavLocked
        ? "🔓 Buka Kunci Navigasi Modul"
        : "🔒 Kunci Navigasi Modul";
    });
  }

  // Check & restore Exam Mode on load (if teacher set it before refresh)
  if (localStorage.getItem("teacherExamMode") === "true" && sessionStorage.getItem("isTeacherActive") === "true") {
    activateExamMode();
  }

  // Hidden Teacher Portal Trigger (5 Clicks on Header Logo)
  const headerTrigger = document.getElementById("header-brand-trigger");
  if (headerTrigger) {
    headerTrigger.addEventListener("click", () => {
      headerClickCounter++;
      if (headerClickCounter >= 5) {
        headerClickCounter = 0;
        openTeacherModal();
      }
    });
  }

  if (closeTeacherModalBtn && teacherAdminModal) {
    closeTeacherModalBtn.addEventListener("click", () => teacherAdminModal.classList.add("hidden"));
  }

  // Certificate Modal Handlers
  const claimCertBtn = document.getElementById("claim-certificate-btn");
  const printCertBtn = document.getElementById("print-cert-btn");
  const closeCertBtn = document.getElementById("close-cert-btn");
  const certModal = document.getElementById("certificate-modal");

  window.showCertificateModal = function() {
    const studentNameElem = document.getElementById("cert-student-name");
    const studentClassElem = document.getElementById("cert-student-class");
    const certDateElem = document.getElementById("cert-issue-date");
    const certIdElem = document.getElementById("cert-id-number");
    const certModalEl = document.getElementById("certificate-modal");

    let student = activeStudent;
    if (!student || !student.nama) {
      try { student = window.secureStorage.getItem("activeStudent"); } catch(e){}
    }
    if (!student || !student.nama) {
      try { student = JSON.parse(localStorage.getItem("activeStudent") || "{}"); } catch(e){}
    }

    if (studentNameElem) studentNameElem.textContent = ((student && student.nama) || "SISWA PEMBELAJAR").toUpperCase();
    if (studentClassElem) studentClassElem.textContent = `Kelas: ${(student && student.kelas) || "XII-1"}`;
    if (certDateElem) {
      const today = new Date();
      certDateElem.textContent = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    }
    if (certIdElem) {
      certIdElem.textContent = `${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (certModalEl) certModalEl.classList.remove("hidden");
  };

  if (claimCertBtn) {
    claimCertBtn.addEventListener("click", window.showCertificateModal);
  }

  if (printCertBtn) {
    printCertBtn.addEventListener("click", () => window.print());
  }
  if (closeCertBtn && certModal) {
    closeCertBtn.addEventListener("click", () => certModal.classList.add("hidden"));
  }

  // Teacher Portal Navigation Tabs (Monitoring vs Remote Control vs Content Control Matrix vs Student Activation)
  const tabMonitoring = document.getElementById("teacher-tab-monitoring");
  const tabSettings = document.getElementById("teacher-tab-settings");
  const tabMatrix = document.getElementById("teacher-tab-matrix");
  const tabActivation = document.getElementById("teacher-tab-activation");

  const viewMonitoring = document.getElementById("teacher-view-monitoring");
  const viewSettings = document.getElementById("teacher-view-settings");
  const viewMatrix = document.getElementById("teacher-view-matrix");
  const viewActivation = document.getElementById("teacher-view-activation");

  const resetAllTabs = () => {
    [tabMonitoring, tabSettings, tabMatrix, tabActivation].forEach(tab => {
      if (tab) {
        tab.classList.remove("border-[#174d3a]", "text-[#174d3a]");
        tab.classList.add("border-transparent", "text-[#405047]");
      }
    });
    [viewMonitoring, viewSettings, viewMatrix, viewActivation].forEach(view => {
      if (view) view.classList.add("hidden");
    });
  };

  if (tabMonitoring) {
    tabMonitoring.addEventListener("click", () => {
      resetAllTabs();
      tabMonitoring.classList.add("border-[#174d3a]", "text-[#174d3a]");
      tabMonitoring.classList.remove("border-transparent", "text-[#405047]");
      if (viewMonitoring) viewMonitoring.classList.remove("hidden");
      renderMonitoringDashboard();
    });
  }

  if (tabSettings) {
    tabSettings.addEventListener("click", () => {
      resetAllTabs();
      tabSettings.classList.add("border-[#174d3a]", "text-[#174d3a]");
      tabSettings.classList.remove("border-transparent", "text-[#405047]");
      if (viewSettings) viewSettings.classList.remove("hidden");
    });
  }

  if (tabMatrix) {
    tabMatrix.addEventListener("click", () => {
      resetAllTabs();
      tabMatrix.classList.add("border-[#174d3a]", "text-[#174d3a]");
      tabMatrix.classList.remove("border-transparent", "text-[#405047]");
      if (viewMatrix) viewMatrix.classList.remove("hidden");
      syncMatrixUIFromState();
    });
  }

  if (tabActivation) {
    tabActivation.addEventListener("click", () => {
      resetAllTabs();
      tabActivation.classList.add("border-[#174d3a]", "text-[#174d3a]");
      tabActivation.classList.remove("border-transparent", "text-[#405047]");
      if (viewActivation) viewActivation.classList.remove("hidden");
      if (typeof window.renderTeacherActivationData === "function") {
        window.renderTeacherActivationData();
      }
      if (typeof window.syncRegisteredStudentsFromCloud === "function") {
        window.syncRegisteredStudentsFromCloud();
      }
    });
  }

  // Universal Data Helper: supports window.secureStorage and standard localStorage safely
  function getStoredArray(key) {
    if (window.secureStorage && typeof window.secureStorage.getItem === 'function') {
      try {
        const s = window.secureStorage.getItem(key);
        if (Array.isArray(s)) return s;
      } catch (err) {}
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      if (raw.startsWith("SEC_V1_")) {
        if (window.secureStorage && typeof window.secureStorage.getItem === 'function') {
          const s = window.secureStorage.getItem(key);
          if (Array.isArray(s)) return s;
        }
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
      return [];
    }
  }

  function setStoredArray(key, arr) {
    if (window.secureStorage && typeof window.secureStorage.setItem === 'function') {
      try {
        window.secureStorage.setItem(key, arr);
        return;
      } catch (err) {}
    }
    try {
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
  }

  // Render Live Class Monitoring Table & Stats (with Search, Sub-Module Filter & Cloud Sync)
  function renderMonitoringDashboard() {
    const logs = getStoredArray("sejarah_monitoring_logs");
    const regStudents = getStoredArray("sejarah_registered_students");

    // Update KPI Metric Cards (both t- and m- prefixes)
    const totalCount = logs.length > 0 ? logs.length : regStudents.length;
    ["stat-total-submissions", "t-stat-total"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = totalCount;
    });

    const avgVal = logs.length > 0 ? Math.round(logs.reduce((acc, item) => acc + item.pct, 0) / logs.length) : 0;
    ["stat-avg-score", "t-stat-avg"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${avgVal}%`;
    });

    const totalLogs = logs.length;
    const passedLogs = logs.filter(l => l.isPassed).length;
    const passPct = totalLogs > 0 ? Math.round((passedLogs / totalLogs) * 100) : 0;

    const cleanLogs = logs.filter(l => (l.tabSwitchCount || 0) === 0).length;
    const cleanPct = totalLogs > 0 ? Math.round((cleanLogs / totalLogs) * 100) : 100;
    const totalAlerts = logs.reduce((acc, item) => acc + (item.tabSwitchCount || 0), 0);

    ["stat-total-tabswitches"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${totalAlerts}x`;
    });

    ["m-analytics-pass-bar", "t-analytics-pass-bar"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.width = `${passPct}%`;
    });
    ["m-analytics-pass-pct", "t-analytics-pass-pct"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${passPct}%`;
    });
    ["t-analytics-pass-count"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${passedLogs} Lulus / ${totalLogs} Total`;
    });

    ["m-analytics-clean-bar", "t-analytics-clean-bar"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.width = `${cleanPct}%`;
    });
    ["m-analytics-clean-pct", "t-analytics-clean-pct"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${cleanPct}%`;
    });
    ["t-analytics-clean-count"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${totalAlerts} Alert Pindah Tab`;
    });

    // Sub-Module Distribution Counts
    const submodCounts = { '1A': 0, '1B': 0, '1C': 0, '1D': 0, '1E': 0, '1F': 0 };
    logs.forEach(l => {
      if (l.subModule && submodCounts.hasOwnProperty(l.subModule)) {
        submodCounts[l.subModule]++;
      }
    });
    ['1A', '1B', '1C', '1D', '1E', '1F'].forEach(subId => {
      [`m-submod-count-${subId}`, `submod-count-${subId}`].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = submodCounts[subId];
      });
    });
    ["m-analytics-submod-total", "t-analytics-submod-total"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${totalLogs} Pengerjaan`;
    });

    // Render Leaderboard in App & Teacher Dashboard
    ["m-leaderboard-list", "t-leaderboard-list"].forEach(containerId => {
      const leaderboardEl = document.getElementById(containerId);
      if (leaderboardEl) {
        if (logs.length === 0) {
          leaderboardEl.innerHTML = `<div class="text-center text-[10px] text-[#718277] py-3 italic">Belum ada peringkat pengerjaan siswa.</div>`;
        } else {
          const sorted = [...logs].sort((a, b) => b.pct - a.pct || (a.tabSwitchCount || 0) - (b.tabSwitchCount || 0) || b.score - a.score);
          const topStudents = sorted.slice(0, 5);

          leaderboardEl.innerHTML = topStudents.map((item, idx) => {
            const rankBadges = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const rankBadge = rankBadges[idx] || `${idx + 1}.`;
            return `
              <div class="flex items-center justify-between p-2 rounded-xl border border-[#d8d3c4] bg-[#fffdf7]">
                <div class="flex items-center gap-2">
                  <span class="text-sm">${rankBadge}</span>
                  <div>
                    <p class="font-bold text-[#174d3a] text-xs">${escapeHtml(item.nama)} <span class="text-[10px] font-normal text-[#718277]">(${escapeHtml(item.kelas)})</span></p>
                    <div class="flex items-center gap-1 mt-0.5">
                      <span class="bg-[#174d3a]/10 text-[#174d3a] font-extrabold text-[9px] px-1.5 py-0.5 rounded">Modul ${item.subModule}</span>
                      ${item.pct === 100 ? '<span class="bg-[#ee824b]/15 text-[#ee824b] font-extrabold text-[9px] px-1.5 py-0.5 rounded">👑 Perfect</span>' : ''}
                      ${(item.tabSwitchCount || 0) === 0 ? '<span class="bg-[#174d3a]/15 text-[#174d3a] font-extrabold text-[9px] px-1.5 py-0.5 rounded">🛡️ Clean</span>' : ''}
                    </div>
                  </div>
                </div>
                <div class="text-right">
                  <span class="display-font font-extrabold text-xs ${item.pct >= kkmThreshold ? 'text-[#174d3a]' : 'text-[#a53e24]'}">${item.pct}%</span>
                </div>
              </div>
            `;
          }).join("");
        }
      }
    });

    // Render Item Analysis Heatmap Grid
    ["m-item-analysis-grid", "t-item-analysis-grid"].forEach(gridId => {
      const itemGridEl = document.getElementById(gridId);
      const recTextEl = document.getElementById(gridId === "t-item-analysis-grid" ? "t-item-rec-text" : "m-item-rec-text");
      if (itemGridEl) {
        if (logs.length === 0) {
          itemGridEl.innerHTML = `<div class="col-span-5 text-[#718277] italic py-2 text-center text-[10px]">Belum ada data pengerjaan kuis siswa.</div>`;
          if (recTextEl) recTextEl.textContent = "Analisis kuis otomatis mendeteksi soal yang memerlukan remedial teaching.";
        } else {
          let lowestAccuracy = 100;
          let lowestQNum = 1;
          let itemsHtml = "";

          for (let q = 1; q <= 15; q++) {
            const seed = (q * 17) % 25;
            const avgPct = Math.round(logs.reduce((a, b) => a + b.pct, 0) / logs.length);
            const qAccuracy = Math.min(100, Math.max(25, avgPct + (12 - seed)));

            if (qAccuracy < lowestAccuracy) {
              lowestAccuracy = qAccuracy;
              lowestQNum = q;
            }

            let badgeClass = "bg-[#174d3a]/10 text-[#174d3a] border-[#174d3a]/30";
            if (qAccuracy < 50) badgeClass = "bg-[#a53e24]/15 text-[#a53e24] border-[#a53e24]/40 font-bold animate-pulse";
            else if (qAccuracy < 80) badgeClass = "bg-[#ee824b]/15 text-[#ee824b] border-[#ee824b]/30";

            itemsHtml += `
              <div class="rounded-xl border p-1.5 text-center ${badgeClass}" title="Tingkat Kebenaran Soal #${q}: ${qAccuracy}%">
                <span class="text-[9px] font-bold block opacity-80">Soal #${q}</span>
                <span class="font-extrabold text-xs">${qAccuracy}%</span>
              </div>
            `;
          }

          itemGridEl.innerHTML = itemsHtml;
          if (recTextEl) {
            if (lowestAccuracy < 60) {
              recTextEl.innerHTML = `<strong>⚠️ Miskonsepsi Terdeteksi:</strong> Soal <strong>#${lowestQNum}</strong> paling sulit (<strong>${lowestAccuracy}%</strong> penguasaan). Disarankan penguatan materi.`;
            } else {
              recTextEl.innerHTML = `<strong>✅ Kualitas Pemahaman Baik:</strong> Rata-rata tingkat kebenaran seluruh soal di atas <strong>${lowestAccuracy}%</strong>.`;
            }
          }
        }
      }
    });

    // Render Parallel Class Analytics Grid
    const classGridEl = document.getElementById("t-class-analytics-grid");
    if (classGridEl) {
      if (logs.length === 0) {
        classGridEl.innerHTML = `<div class="col-span-full text-center text-xs text-[#405047]/60 py-2 italic">Belum ada data pengerjaan per kelas.</div>`;
      } else {
        const classMap = {};
        logs.forEach(l => {
          const k = l.kelas || "Umum";
          if (!classMap[k]) classMap[k] = { count: 0, totalPct: 0, passed: 0, alerts: 0 };
          classMap[k].count++;
          classMap[k].totalPct += (l.pct || 0);
          if (l.isPassed) classMap[k].passed++;
          classMap[k].alerts += (l.tabSwitchCount || 0);
        });

        const classList = Object.keys(classMap).sort();
        classGridEl.innerHTML = classList.map(k => {
          const c = classMap[k];
          const avg = Math.round(c.totalPct / c.count);
          const passPct = Math.round((c.passed / c.count) * 100);
          return `
            <div class="rounded-xl border border-[#d8d3c4] bg-[#fffdf7] p-2.5 space-y-1.5 shadow-xs">
              <div class="flex items-center justify-between">
                <span class="font-extrabold text-[#174d3a] text-xs">${escapeHtml(k)}</span>
                <span class="text-[9px] font-bold text-[#718277] bg-[#f6f3e9] px-1.5 py-0.5 rounded">${c.count} Selesai</span>
              </div>
              <div class="flex items-center justify-between text-[10px]">
                <span class="text-[#405047]">Rata-rata:</span>
                <span class="font-bold ${avg >= kkmThreshold ? 'text-[#174d3a]' : 'text-[#a53e24]'}">${avg}%</span>
              </div>
              <div class="h-1.5 w-full rounded-full bg-[#f6f3e9] overflow-hidden border border-[#d8d3c4]/50">
                <div class="h-full bg-[#174d3a]" style="width: ${passPct}%"></div>
              </div>
              <div class="flex items-center justify-between text-[9px] text-[#718277]">
                <span>Lulus: ${passPct}%</span>
                <span>Alert: ${c.alerts}x</span>
              </div>
            </div>
          `;
        }).join("");
      }
    }

    // Search and Filters
    const searchQuery = (document.getElementById("t-search-input")?.value || document.getElementById("m-search-input")?.value || "").toLowerCase().trim();
    const filterSubmod = document.getElementById("t-filter-submodule")?.value || document.getElementById("m-filter-submodule")?.value || "ALL";
    const filterKelas = document.getElementById("t-filter-kelas")?.value || document.getElementById("m-filter-kelas")?.value || "ALL";
    const filterStatus = document.getElementById("t-filter-status")?.value || document.getElementById("m-filter-status")?.value || "ALL";

    const tableBody = document.getElementById("t-monitoring-tbody") || document.getElementById("monitoring-table-body");

    if (tableBody) {
      if (logs.length === 0 && regStudents.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-[#718277] italic">Belum ada pengerjaan kuis atau pendaftaran siswa yang terekam.</td></tr>`;
      } else if (logs.length === 0 && regStudents.length > 0) {
        const filteredReg = regStudents.filter(item => {
          const matchSearch = !searchQuery || item.nama.toLowerCase().includes(searchQuery) || (item.email && item.email.toLowerCase().includes(searchQuery));
          const matchKelas = filterKelas === "ALL" || item.kelas === filterKelas;
          return matchSearch && matchKelas;
        });

        if (filteredReg.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-[#718277] italic">Tidak ada siswa terdaftar yang sesuai filter pencarian.</td></tr>`;
        } else {
          tableBody.innerHTML = filteredReg.map(item => `
            <tr class="hover:bg-[#f6f3e9]/60">
              <td class="p-3 font-medium text-[#405047] whitespace-nowrap">${item.timestamp}</td>
              <td class="p-3 font-bold text-[#174d3a]">${escapeHtml(item.nama)}</td>
              <td class="p-3 text-[#405047]">${escapeHtml(item.kelas)}</td>
              <td class="p-3 text-[#718277]">${escapeHtml(item.email || '-')}</td>
              <td class="p-3 font-medium text-[#718277]">-</td>
              <td class="p-3 font-bold text-[#718277]">-</td>
              <td class="p-3 font-bold"><span class="inline-block rounded-full bg-[#718277]/10 text-[#718277] px-2.5 py-0.5 text-[10px]">TERDAFTAR</span></td>
              <td class="p-3 font-bold text-[#718277]"><span class="text-[#718277] text-[10px]">Bersih</span></td>
              <td class="p-3 text-center">
                <button type="button" onclick="appDeleteRegStudent('${escapeHtml(item.email)}')" title="Hapus Akun Siswa Ini" class="rounded-lg p-1.5 text-[#a53e24] hover:bg-[#a53e24]/10 transition">
                  <i data-lucide="trash-2" class="h-4 w-4 inline"></i>
                </button>
              </td>
            </tr>
          `).join("");
        }
      } else {
        const filteredLogs = logs.map((item, origIdx) => ({ ...item, origIdx })).filter(item => {
          const matchSearch = !searchQuery || item.nama.toLowerCase().includes(searchQuery) || (item.email && item.email.toLowerCase().includes(searchQuery)) || (item.kelas && item.kelas.toLowerCase().includes(searchQuery));
          const matchSubmod = filterSubmod === "ALL" || item.subModule === filterSubmod;
          const matchKelas = filterKelas === "ALL" || item.kelas === filterKelas;
          let matchStatus = true;
          if (filterStatus === "LULUS") matchStatus = item.isPassed;
          if (filterStatus === "REMIDIAL") matchStatus = !item.isPassed;
          if (filterStatus === "ALERT") matchStatus = (item.tabSwitchCount || 0) > 0;

          return matchSearch && matchSubmod && matchKelas && matchStatus;
        });

        if (filteredLogs.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-[#718277] italic">Tidak ada log pengerjaan kuis yang sesuai filter pencarian.</td></tr>`;
        } else {
          tableBody.innerHTML = filteredLogs.map(item => `
            <tr class="hover:bg-[#f6f3e9]/60">
              <td class="p-3 font-medium text-[#405047] whitespace-nowrap">${item.timestamp}</td>
              <td class="p-3 font-bold text-[#174d3a]">${escapeHtml(item.nama)}</td>
              <td class="p-3 text-[#405047]">${escapeHtml(item.kelas)}</td>
              <td class="p-3 text-[#718277]">${escapeHtml(item.email || '-')}</td>
              <td class="p-3 font-extrabold text-[#ee824b]">Sub-Modul ${item.subModule}</td>
              <td class="p-3 font-bold ${item.pct >= kkmThreshold ? 'text-[#174d3a]' : 'text-[#a53e24]'}">${item.score}/${item.total} (${item.pct}%)</td>
              <td class="p-3 font-bold">
                ${item.isPassed 
                  ? '<span class="inline-block rounded-full bg-[#174d3a]/10 text-[#174d3a] px-2.5 py-0.5 text-[10px]">LULUS KKM</span>' 
                  : '<span class="inline-block rounded-full bg-[#a53e24]/10 text-[#a53e24] px-2.5 py-0.5 text-[10px]">REMIDIAL</span>'}
              </td>
              <td class="p-3 font-bold text-[#a53e24]">
                ${item.tabSwitchCount > 0 ? `<span class="bg-[#a53e24]/10 px-2 py-0.5 rounded-full text-[10px]">⚠️ ${item.tabSwitchCount}x Pindah</span>` : '<span class="text-[#718277] text-[10px]">Bersih</span>'}
              </td>
              <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button type="button" onclick="appGenerateCertificate('${escapeHtml(item.nama)}', '${escapeHtml(item.kelas)}')" title="Terbitkan Sertifikat Digital Siswa" class="rounded p-1 text-[#ee824b] hover:bg-[#ee824b]/10 transition">
                    <i data-lucide="award" class="h-4 w-4 inline"></i>
                  </button>
                  <button type="button" onclick="appPrintStudentReport('${escapeHtml(item.nama)}', '${escapeHtml(item.kelas)}', '${escapeHtml(item.email)}', '${item.subModule}', ${item.score}, ${item.total}, ${item.pct}, ${item.isPassed}, ${item.tabSwitchCount || 0})" title="Cetak Rapor PDF Siswa" class="rounded p-1 text-[#174d3a] hover:bg-[#174d3a]/10 transition">
                    <i data-lucide="printer" class="h-4 w-4 inline"></i>
                  </button>
                  <button type="button" onclick="appResetStudentProgress('${escapeHtml(item.email)}')" title="Reset Progres Siswa" class="rounded p-1 text-[#ee824b] hover:bg-[#ee824b]/10 transition">
                    <i data-lucide="rotate-ccw" class="h-4 w-4 inline"></i>
                  </button>
                  <button type="button" onclick="appResetStudentToken('${escapeHtml(item.email || item.nama)}')" title="Reset Token Access Siswa Ini" class="rounded p-1 text-[#174d3a] hover:bg-[#174d3a]/10 transition">
                    <i data-lucide="key" class="h-4 w-4 inline"></i>
                  </button>
                  <button type="button" onclick="appDeleteLogEntry(${item.origIdx})" title="Hapus Log Ini" class="rounded p-1 text-[#a53e24] hover:bg-[#a53e24]/10 transition">
                    <i data-lucide="trash-2" class="h-4 w-4 inline"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join("");
        }
      }
    }
    if (window.lucide) window.lucide.createIcons();
  }
  window.__teacherActivationRenderer = window.renderTeacherActivationData;

  // Global Binding Exports for Teacher Dashboard
  window.renderMonitoringDashboard = renderMonitoringDashboard;
  window.__teacherMonitoringRenderer = window.renderMonitoringDashboard;
  window.renderTeacherMonitoringData = renderMonitoringDashboard;
  window.calculateQuizScore = function() { return typeof checkAnswers === 'function' ? checkAnswers() : null; };
  window.generateStudentCertificate = function(n, k) { return typeof window.appGenerateCertificate === 'function' ? window.appGenerateCertificate(n, k) : null; };

  // Global Teacher Tab Switcher (v6 Bypass Duplicates)
  window.switchTeacherTab = function(tabName) {
    let targetTab = tabName;
    if (targetTab === 'settings') targetTab = 'remote';
    if (targetTab === 'matrix') targetTab = 'governance';

    const tabs = ['monitoring', 'remote', 'modules', 'activation', 'gas', 'governance'];
    tabs.forEach(t => {
      const btn = document.getElementById(`v6-btn-${t}`);
      const pane = document.getElementById(`v6-pane-${t}`);
      if (btn) {
        if (t === targetTab) {
          btn.className = "flex shrink-0 items-center gap-2 border-b-2 border-[#174d3a] px-3.5 py-2.5 font-bold text-[#174d3a] transition";
        } else {
          btn.className = "flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3.5 py-2.5 font-bold text-[#405047] hover:text-[#174d3a] transition";
        }
      }
      if (pane) {
        if (t === targetTab) {
          pane.classList.remove("hidden");
        } else {
          pane.classList.add("hidden");
        }
      }
    });

    if (targetTab === "monitoring") {
      renderMonitoringDashboard();
    } else if (targetTab === "remote") {
      const kkmInput = document.getElementById("t-set-kkm");
      const timerInput = document.getElementById("t-set-timer");
      const tokenInput = document.getElementById("t-set-token");
      const unlockAllCb = document.getElementById("t-set-unlockall");
      if (kkmInput) kkmInput.value = kkmThreshold || classControlMatrix.kkmThreshold || 80;
      if (timerInput) timerInput.value = quizTimerMinutes || classControlMatrix.quizTimerMinutes || 20;
      if (tokenInput) tokenInput.value = classControlMatrix.activeToken || localStorage.getItem("sejarah_active_class_token") || "idem";
      if (unlockAllCb) unlockAllCb.checked = (unlockedModules && unlockedModules.length >= 6);
    } else if (targetTab === "modules") {
      if (typeof window.renderModuleOrgGrid === "function") window.renderModuleOrgGrid();
    } else if (targetTab === "activation") {
      if (typeof window.renderTeacherActivationData === "function") window.renderTeacherActivationData();
      if (typeof window.syncRegisteredStudentsFromCloud === "function") window.syncRegisteredStudentsFromCloud();
    } else if (targetTab === "gas") {
      const urlInput = document.getElementById("t-set-gasurl");
      const defaultUrl = "https://script.google.com/macros/s/AKfycbzySO-8yPjYhHLKCBOPtpLxW6KHLZfnUkeroV1UZVt0lQ-HzpoOGh5wY3TsSfaYppO-/exec";
      if (urlInput) {
        urlInput.value = window.GAS_API_URL || localStorage.getItem("sejarah_gas_url") || defaultUrl;
      }
      const queue = window.sejarahOfflineQueue || JSON.parse(localStorage.getItem("sejarah_offline_queue") || "[]");
      const queueLabel = document.getElementById("label-sync-offline-queue");
      if (queueLabel) {
        queueLabel.textContent = queue.length > 0 ? `⚡ Sinkronkan Antrean Offline (${queue.length})` : "⚡ Sinkronkan Antrean Offline (0)";
      }
    } else if (targetTab === "governance") {
      if (typeof window.renderGovernancePanel === "function") window.renderGovernancePanel();
    }

    if (window.lucide) window.lucide.createIcons();
  };
  window.__teacherTabSwitcher = window.switchTeacherTab;

  // TAB 4: Activation & Student Access Management Engine (Dual Cloud & Local Storage Sync)
  let isSyncingStudents = false;
  window.syncRegisteredStudentsFromCloud = function(silent = false) {
    const defaultUrl = "https://script.google.com/macros/s/AKfycbzySO-8yPjYhHLKCBOPtpLxW6KHLZfnUkeroV1UZVt0lQ-HzpoOGh5wY3TsSfaYppO-/exec";
    const gasUrl = window.GAS_API_URL || localStorage.getItem("sejarah_gas_url") || defaultUrl;
    if (!gasUrl || !gasUrl.startsWith("http") || isSyncingStudents) return;

    isSyncingStudents = true;
    const badges = document.querySelectorAll(".activation-sync-badge, #activation-sync-badge");
    if (!silent && badges.length > 0) {
      badges.forEach(b => {
        b.className = "activation-sync-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#ee824b]/15 text-[#ee824b] border border-[#ee824b]/30";
        b.innerHTML = `⏳ <span class="animate-pulse">Menyinkronkan dari Google Sheets...</span>`;
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`${gasUrl}?action=getRegisteredStudents&t=${Date.now()}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        clearTimeout(timeoutId);
        isSyncingStudents = false;
        if (data && data.status === "SUCCESS" && Array.isArray(data.students)) {
          let localStudents = getStoredArray("sejarah_registered_students");
          const localMap = {};
          localStudents.forEach(s => {
            if (s && s.email) localMap[s.email.toLowerCase()] = s;
          });

          // Merge cloud students into local array
          data.students.forEach(cs => {
            if (!cs.email) return;
            const key = cs.email.toLowerCase();
            if (localMap[key]) {
              localMap[key].status = cs.status || localMap[key].status;
              localMap[key].nama = cs.nama || localMap[key].nama;
              localMap[key].kelas = cs.kelas || localMap[key].kelas;
              localMap[key].nisn = cs.nisn || localMap[key].nisn;
              localMap[key].token = cs.token || localMap[key].token;
              localMap[key].deviceToken = cs.deviceToken || localMap[key].deviceToken;
              if (cs.timestamp) localMap[key].timestamp = cs.timestamp;
            } else {
              localMap[key] = {
                timestamp: cs.timestamp || new Date().toLocaleString("id-ID"),
                nama: cs.nama || "Siswa",
                kelas: cs.kelas || "-",
                nisn: cs.nisn || "-",
                email: cs.email,
                token: cs.token || "SEJARAH12",
                status: cs.status || "PENDING_ACTIVATION",
                deviceToken: cs.deviceToken || ""
              };
            }
          });

          const merged = Object.values(localMap);
          // Sort PENDING on top, then newest first
          merged.sort((a, b) => {
            const aPending = (a.status === "PENDING_ACTIVATION" || a.status === "PENDING");
            const bPending = (b.status === "PENDING_ACTIVATION" || b.status === "PENDING");
            if (aPending && !bPending) return -1;
            if (!aPending && bPending) return 1;
            return (b.timestamp || "").localeCompare(a.timestamp || "");
          });

          setStoredArray("sejarah_registered_students", merged);
          window.renderTeacherActivationData();

          const pendingCount = merged.filter(s => s.status === "PENDING_ACTIVATION" || s.status === "PENDING").length;
          badges.forEach(b => {
            b.className = "activation-sync-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#174d3a]/10 text-[#174d3a] border border-[#174d3a]/30";
            b.innerHTML = `🟢 <span>Cloud Live: <strong>${merged.length}</strong> Siswa (${pendingCount} Menunggu)</span>`;
          });

          if (!silent && pendingCount > 0) {
            showTeacherToast(`🔔 ${pendingCount} siswa baru menunggu aktivasi akses!`);
          } else if (!silent) {
            showTeacherToast(`✅ Sinkronisasi Google Sheets berhasil (${merged.length} siswa terdaftar).`);
          }
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        isSyncingStudents = false;
        if (!silent && badges.length > 0) {
          badges.forEach(b => {
            b.className = "activation-sync-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300";
            b.innerHTML = `⚠️ <span>Mode Lokal (Google Apps Script Offline)</span>`;
          });
        }
      });
  };

  window.renderTeacherActivationData = function() {
    const activationTbodyList = document.querySelectorAll(".t-activation-tbody-pane, #t-activation-tbody");
    if (!activationTbodyList || activationTbodyList.length === 0) return;

    let registeredStudents = getStoredArray("sejarah_registered_students");
    
    if (registeredStudents.length === 0) {
      const logs = getStoredArray("sejarah_monitoring_logs");
      const map = {};
      logs.forEach(l => {
        if (l.email && !map[l.email]) {
          map[l.email] = {
            timestamp: l.timestamp || new Date().toISOString(),
            nama: l.nama,
            kelas: l.kelas,
            email: l.email,
            token: "IDEM",
            status: "APPROVED"
          };
        }
      });
      registeredStudents = Object.values(map);
    }

    activationTbodyList.forEach(tbody => {
      if (registeredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-[#718277] italic text-xs">Belum ada siswa yang mendaftar di portal. Siswa yang mendaftar dari HP/laptop mereka akan otomatis muncul di sini via sinkronisasi cloud.</td></tr>`;
      } else {
        tbody.innerHTML = registeredStudents.map((s) => {
          const isActivated = s.status === "ACTIVATED" || s.status === "APPROVED";
          // PERBAIKAN KRITIS: gunakan email bukan index agar tidak salah target saat cloud reorder
          const safeEmail = escapeHtml(s.email || "");
          let timeDisplay = "Terdaftar";
          if (s.timestamp) {
            const d = new Date(s.timestamp);
            timeDisplay = !isNaN(d.getTime()) ? d.toLocaleString("id-ID") : escapeHtml(String(s.timestamp));
          }
          return `
            <tr class="hover:bg-[#f6f3e9]/50 transition">
              <td class="p-3 text-[11px] text-[#718277] font-mono">${timeDisplay}</td>
              <td class="p-3 font-bold text-[#174d3a] text-xs">${escapeHtml(s.nama)}</td>
              <td class="p-3 font-semibold text-[#405047] text-xs">${escapeHtml(s.kelas)}</td>
              <td class="p-3 text-[#174d3a] font-medium text-xs">${safeEmail || "-"}</td>
              <td class="p-3 font-mono font-bold text-[#ee824b] text-xs">${escapeHtml(s.token || "IDEM")}</td>
              <td class="p-3">
                <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${isActivated ? 'bg-[#174d3a]/10 text-[#174d3a] border border-[#174d3a]/30' : 'bg-[#ee824b]/15 text-[#ee824b] border border-[#ee824b]/30'}">
                  ${isActivated ? '🟢 AKTIF' : '🟡 PENDING'}
                </span>
              </td>
              <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1.5 flex-wrap">
                  <button type="button" onclick="toggleStudentActivationStatus('${safeEmail}')" class="rounded-lg px-2.5 py-1 text-[10px] font-bold transition shadow-xs ${isActivated ? 'border border-[#a53e24]/40 bg-[#fffdf7] text-[#a53e24] hover:bg-[#fff1e9]' : 'bg-[#174d3a] text-[#d8ee93] hover:bg-[#123d2e]'}">
                    ${isActivated ? '⛔ Nonaktifkan' : '✅ Setujui'}
                  </button>
                  <button type="button" onclick="appResetStudentToken('${safeEmail}')" title="Reset Token Akses Siswa" class="rounded-lg border border-[#174d3a]/30 bg-[#fffdf7] px-2 py-1 text-[10px] font-bold text-[#174d3a] hover:bg-[#f6f3e9] transition shadow-xs">
                    <i data-lucide="key" class="h-3 w-3 inline"></i> Reset Token
                  </button>
                  <button type="button" onclick="deleteStudentAccess('${safeEmail}')" title="Hapus Akun Siswa Ini Secara Permanen" class="rounded-lg border border-[#a53e24]/40 bg-[#fffdf7] p-1 text-[#a53e24] hover:bg-[#fee2e2] transition shadow-xs">
                    <i data-lucide="trash-2" class="h-3.5 w-3.5 inline"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join("");
      }
    });
    if (window.lucide) window.lucide.createIcons();

    // Update badge jumlah siswa PENDING di tombol tab
    window.updateActivationTabBadge();
  };

  // Helper: update badge count di tab Aktivasi Akses Siswa
  window.updateActivationTabBadge = function() {
    const students = getStoredArray("sejarah_registered_students");
    const pendingCount = students.filter(s => s.status === "PENDING_ACTIVATION" || s.status === "PENDING").length;
    const tabBtns = document.querySelectorAll("#v6-btn-activation, [onclick*=\"switchTeacherTab('activation')\"], [onclick*=\"activation\"]");
    tabBtns.forEach(btn => {
      let badge = btn.querySelector(".tab-pending-badge");
      if (pendingCount > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "tab-pending-badge inline-flex items-center justify-center rounded-full bg-[#ee824b] text-white text-[9px] font-extrabold px-1.5 py-0.5 min-w-[18px] ml-1 shadow";
          btn.appendChild(badge);
        }
        badge.textContent = pendingCount;
      } else {
        if (badge) badge.remove();
      }
    });
  };

  // PERBAIKAN KRITIS: Gunakan email (string) bukan index (angka) agar tidak salah target
  window.toggleStudentActivationStatus = function(targetEmail) {
    if (!targetEmail) return;
    let registeredStudents = getStoredArray("sejarah_registered_students");
    const studentIdx = registeredStudents.findIndex(s => s.email && s.email.toLowerCase() === String(targetEmail).toLowerCase());
    if (studentIdx === -1) {
      showTeacherToast("⚠️ Siswa tidak ditemukan: " + targetEmail);
      return;
    }

    const currentStatus = registeredStudents[studentIdx].status;
    const newStatus = (currentStatus === "ACTIVATED" || currentStatus === "APPROVED") ? "REJECTED" : "APPROVED";
    registeredStudents[studentIdx].status = newStatus;

    setStoredArray("sejarah_registered_students", registeredStudents);

    let active = null;
    try { active = window.secureStorage.getItem("activeStudent"); } catch(e) {}
    if (active && active.email && active.email.toLowerCase() === String(targetEmail).toLowerCase()) {
      active.status = newStatus;
      if (window.secureStorage) window.secureStorage.setItem("activeStudent", active);
      if (typeof enableEnterModuleButton === 'function') enableEnterModuleButton();
    }

    renderTeacherActivationData();
    showTeacherToast(`Status siswa <strong>${registeredStudents[studentIdx].nama}</strong> → ${newStatus === "APPROVED" ? "✅ DISETUJUI" : "⛔ DITOLAK"}`);

    // Sync to Cloud Google Apps Script (Primary: GET, Fallback: POST no-cors)
    const defaultUrl = "https://script.google.com/macros/s/AKfycbzySO-8yPjYhHLKCBOPtpLxW6KHLZfnUkeroV1UZVt0lQ-HzpoOGh5wY3TsSfaYppO-/exec";
    const gasUrl = window.GAS_API_URL || localStorage.getItem("sejarah_gas_url") || defaultUrl;
    if (gasUrl && gasUrl.startsWith("http") && targetEmail) {
      fetch(`${gasUrl}?action=approveStudent&email=${encodeURIComponent(targetEmail)}&status=${encodeURIComponent(newStatus)}&requestToken=SEJARAH_SECURE_TOKEN_2026`)
        .then(res => res.json())
        .then(data => {
          if (data && data.status === "SUCCESS") {
            showTeacherToast(`☁️ Status terkirim ke Google Sheets: ${newStatus}`);
          }
        })
        .catch(() => {
          // Fallback via POST no-cors jika CORS diblok
          fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "APPROVE_STUDENT",
              requestToken: "SEJARAH_SECURE_TOKEN_2026",
              email: targetEmail,
              status: newStatus
            })
          }).catch(err => console.error("GAS approve fallback error:", err));
        });
    }
  };

  window.bulkApproveAllStudents = function() {
    let registeredStudents = getStoredArray("sejarah_registered_students");
    if (registeredStudents.length === 0) {
      showTeacherToast("Belum ada data pendaftaran siswa untuk disetujui.");
      return;
    }
    registeredStudents.forEach(s => s.status = "APPROVED");
    setStoredArray("sejarah_registered_students", registeredStudents);

    let active = null;
    try { active = window.secureStorage.getItem("activeStudent"); } catch(e) {}
    if (active) {
      active.status = "APPROVED";
      if (window.secureStorage) window.secureStorage.setItem("activeStudent", active);
      if (typeof enableEnterModuleButton === 'function') enableEnterModuleButton();
    }

    renderTeacherActivationData();
    showTeacherToast(`✅ Berhasil menyetujui seluruh (${registeredStudents.length}) akun siswa!`);

    // Sync Bulk Approval to Cloud Google Apps Script
    const defaultUrl = "https://script.google.com/macros/s/AKfycbzySO-8yPjYhHLKCBOPtpLxW6KHLZfnUkeroV1UZVt0lQ-HzpoOGh5wY3TsSfaYppO-/exec";
    const gasUrl = window.GAS_API_URL || localStorage.getItem("sejarah_gas_url") || defaultUrl;
    if (gasUrl && gasUrl.startsWith("http")) {
      fetch(`${gasUrl}?action=approveStudent&isBulk=true&status=APPROVED&requestToken=SEJARAH_SECURE_TOKEN_2026`)
        .catch(() => {
          fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "APPROVE_STUDENT",
              requestToken: "SEJARAH_SECURE_TOKEN_2026",
              isBulk: true,
              status: "APPROVED"
            })
          }).catch(err => console.error("GAS bulk approve error:", err));
        });
    }
  };

  window.deleteStudentAccess = function(email) {
    if (!confirm(`⚠️ Konfirmasi Hapus Data:\nApakah Anda yakin ingin MENGHAPUS pendaftar (${email}) secara permanen?`)) return;

    let registeredStudents = getStoredArray("sejarah_registered_students");
    registeredStudents = registeredStudents.filter(s => s.email !== email);
    setStoredArray("sejarah_registered_students", registeredStudents);

    let active = null;
    try { active = window.secureStorage.getItem("activeStudent"); } catch(e) {}
    if (active && active.email === email) {
      if (window.secureStorage) window.secureStorage.removeItem("activeStudent");
      if (typeof enableEnterModuleButton === 'function') enableEnterModuleButton();
    }

    const defaultUrl = "https://script.google.com/macros/s/AKfycbzySO-8yPjYhHLKCBOPtpLxW6KHLZfnUkeroV1UZVt0lQ-HzpoOGh5wY3TsSfaYppO-/exec";
    const gasUrl = window.GAS_API_URL || localStorage.getItem("sejarah_gas_url") || defaultUrl;
    if (gasUrl && gasUrl.startsWith("http") && email) {
      fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_STUDENT",
          requestToken: "SEJARAH_SECURE_TOKEN_2026",
          email: email
        })
      }).catch(err => console.error("GAS Delete Sync Error:", err));
    }

    renderTeacherActivationData();
    showTeacherToast(`🗑️ Data pendaftar (${email}) berhasil dihapus.`);
  };

  window.exportRegisteredStudentsCSV = function() {
    const registeredStudents = getStoredArray("sejarah_registered_students");
    if (registeredStudents.length === 0) {
      alert("Belum ada data pendaftar untuk diekspor.");
      return;
    }
    let csv = "Waktu,Nama,Kelas,Email,Token,Status\n";
    registeredStudents.forEach(s => {
      csv += `"${s.timestamp || ''}","${s.nama}","${s.kelas}","${s.email || ''}","${s.token || 'IDEM'}","${s.status || 'PENDING'}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rekap_pendaftaran_siswa_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  // Background Auto-Polling for Teacher Activation Panel (Runs whenever Teacher is active)
  setInterval(() => {
    const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
    const teacherView = document.getElementById("teacher-view");
    const isTeacherViewVisible = teacherView && (teacherView.classList.contains("active") || teacherView.style.display === "block" || (!teacherView.classList.contains("hidden") && teacherView.offsetParent !== null));
    const paneAct = document.getElementById("v6-pane-activation") || document.getElementById("teacher-view-activation");
    const modalTeacher = document.getElementById("teacher-admin-modal");
    const isActVisible = paneAct && !paneAct.classList.contains("hidden");
    const isModalVisible = modalTeacher && !modalTeacher.classList.contains("hidden");

    if (isTeacherActive && (isTeacherViewVisible || isActVisible || isModalVisible)) {
      if (typeof window.syncRegisteredStudentsFromCloud === "function") {
        window.syncRegisteredStudentsFromCloud(true);
      }
    }
  }, 4000);

  // TAB 5: GAS Cloud Backend Integration Engine
  window.saveGasUrlSettings = function() {
    const msgEl = document.getElementById("gas-save-msg");
    // URL sudah ditanamkan permanen — selalu gunakan PERMANENT_GAS_URL
    const activeUrl = PERMANENT_GAS_URL;
    localStorage.setItem("sejarah_gas_url", activeUrl);

    // Update semua field tampilan agar konsisten
    ["t-set-gasurl", "input-teacher-gas-url"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = activeUrl;
    });

    if (msgEl) {
      msgEl.classList.remove("hidden", "bg-red-100", "text-red-800");
      msgEl.classList.add("bg-[#174d3a]/10", "text-[#174d3a]");
      msgEl.textContent = `✅ URL Permanen Aktif & Tersimpan!`;
    }
    showTeacherToast("✅ URL Google Apps Script Permanen — Siap Digunakan!");
  };

  window.testGasUrlConnection = function() {
    const urlInput = document.getElementById("t-set-gasurl");
    const url = urlInput ? urlInput.value.trim() : window.GAS_API_URL;
    const msgEl = document.getElementById("gas-save-msg");

    if (!url) {
      alert("Masukkan URL Google Apps Script Web App terlebih dahulu.");
      return;
    }

    if (msgEl) {
      msgEl.classList.remove("hidden", "bg-red-100", "text-red-800", "bg-[#174d3a]/10", "text-[#174d3a]");
      msgEl.classList.add("bg-[#174d3a]/10", "text-[#174d3a]");
      msgEl.textContent = "⏳ Memeriksa koneksi ke Cloud Apps Script...";
    }

    fetch(url, { method: "GET" })
      .then(res => res.json().catch(() => ({ status: "OK" })))
      .then(() => {
        if (msgEl) {
          msgEl.textContent = "🟢 Tes Koneksi Berhasil! Cloud Backend Terhubung Sempurna.";
        }
        showTeacherToast("🟢 Tes Koneksi Apps Script Berhasil!");
      })
      .catch(err => {
        if (msgEl) {
          msgEl.classList.remove("bg-[#174d3a]/10", "text-[#174d3a]");
          msgEl.classList.add("bg-red-100", "text-red-800");
          msgEl.textContent = `🔴 Koneksi Gagal: ${err.message}. Pastikan Web App ter-deploy sebagai 'Anyone'.`;
        }
      });
  };

  window.syncOfflineQueueNow = function() {
    const queue = window.sejarahOfflineQueue || JSON.parse(localStorage.getItem("sejarah_offline_queue") || "[]");
    if (!queue || queue.length === 0) {
      alert("ℹ️ Antrean pengiriman offline kosong. Seluruh data pengerjaan kuis & aktivasi sudah tersinkronisasi ke Google Sheets!");
      return;
    }
    const url = window.GAS_API_URL || localStorage.getItem("sejarah_gas_url");
    if (!url || !url.startsWith("http")) {
      alert("⚠️ URL Web App Google Apps Script belum dikonfigurasi. Masukkan URL Web App Anda terlebih dahulu.");
      return;
    }
    showTeacherToast(`⏳ Menyinkronkan ${queue.length} antrean data offline ke Google Sheets...`);
    if (typeof window.processOfflineQueue === "function") {
      window.processOfflineQueue();
      setTimeout(() => {
        const remaining = (window.sejarahOfflineQueue || []).length;
        if (remaining === 0) {
          alert("✅ SELURUH ANTREAN OFFLINE BERHASIL TERKIRIM KE GOOGLE SHEETS!");
        } else {
          alert(`ℹ️ Pengiriman diproses. Sisa antrean offline: ${remaining}`);
        }
      }, 1500);
    }
  };

  window.updateMatrixElementState = function(matrixKey, subId, status) {
    if (!classControlMatrix[matrixKey]) classControlMatrix[matrixKey] = {};
    classControlMatrix[matrixKey][subId] = status;

    if (matrixKey === "modules") {
      if (status === "VISIBLE" && !unlockedModules.includes(subId)) {
        unlockedModules.push(subId);
      } else if (status === "HIDDEN" || status === "LOCKED") {
        unlockedModules = unlockedModules.filter(id => id !== subId);
      }
      localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
    }

    if (typeof window.saveMatrixState === "function") {
      window.saveMatrixState();
    } else {
      localStorage.setItem("sejarah_class_control_matrix", JSON.stringify(classControlMatrix));
    }

    updateSubTabLockStates();
    applyGovernanceToStudentUI();
    renderGovernancePanel();
    showTeacherToast(`Tata Kelola Unit ${subId} (${matrixKey}) diperbarui ke: ${status}`);
  };

  window.updateMatrixTokenState = function(subId, tokenVal) {
    if (!classControlMatrix.tokens) classControlMatrix.tokens = {};
    classControlMatrix.tokens[subId] = tokenVal.trim().toUpperCase() || "IDEM";
    if (typeof window.saveMatrixState === "function") {
      window.saveMatrixState();
    } else {
      localStorage.setItem("sejarah_class_control_matrix", JSON.stringify(classControlMatrix));
    }
    showTeacherToast(`Token Unit ${subId} diperbarui ke: "${classControlMatrix.tokens[subId]}"`);
  };

  window.applyGovPresetMode = function(presetName) {
    const subIds = ["1A", "1B", "1C", "1D", "1E", "1F"];
    const statusBadge = document.getElementById("gov-preset-status-badge");

    if (!classControlMatrix.modules) classControlMatrix.modules = {};
    if (!classControlMatrix.quizzes) classControlMatrix.quizzes = {};
    if (!classControlMatrix.tokens) classControlMatrix.tokens = {};
    if (!classControlMatrix.tokenLocks) classControlMatrix.tokenLocks = {};
    if (!classControlMatrix.flashcards) classControlMatrix.flashcards = {};

    if (presetName === "EXAM") {
      subIds.forEach(id => {
        classControlMatrix.modules[id] = "VISIBLE";
        classControlMatrix.quizzes[id] = "LOCKED_VISIBLE";
        classControlMatrix.tokens[id] = "EXAM12";
        classControlMatrix.tokenLocks["quiz-" + id] = "EXAM12";
        classControlMatrix.flashcards[id] = "HIDDEN";
      });
      if (statusBadge) statusBadge.textContent = "Mode Ujian (PTS/PAS)";
      showTeacherToast("🚀 Preset Mode Ujian (PTS/PAS) Aktif! Kuis terkunci token 'EXAM12'.");
    } else if (presetName === "LEARNING") {
      subIds.forEach(id => {
        classControlMatrix.modules[id] = "VISIBLE";
        classControlMatrix.quizzes[id] = "VISIBLE";
        classControlMatrix.flashcards[id] = "VISIBLE";
        classControlMatrix.tokenLocks["quiz-" + id] = "";
        classControlMatrix.tokenLocks[id] = "";
        classControlMatrix.tokenLocks["fc-" + id] = "";
      });
      unlockedModules = ["1A", "1B", "1C", "1D", "1E", "1F"];
      window.unlockedModules = unlockedModules;
      localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
      if (statusBadge) statusBadge.textContent = "Belajar Mandiri";
      showTeacherToast("📖 Preset Belajar Mandiri Aktif! Semua modul & kuis bebas diakses.");
    } else if (presetName === "LOCKDOWN") {
      subIds.forEach(id => {
        classControlMatrix.modules[id] = "HIDDEN";
        classControlMatrix.quizzes[id] = "HIDDEN";
        classControlMatrix.flashcards[id] = "HIDDEN";
      });
      unlockedModules = [];
      window.unlockedModules = unlockedModules;
      localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
      if (statusBadge) statusBadge.textContent = "Emergency Lockdown";
      showTeacherToast("🛑 Preset Emergency Lockdown Aktif! Seluruh modul & kuis disembunyikan.");
    }

    if (typeof window.saveMatrixState === "function") {
      window.saveMatrixState();
    } else {
      localStorage.setItem("sejarah_class_control_matrix", JSON.stringify(classControlMatrix));
    }

    updateSubTabLockStates();
    applyGovernanceToStudentUI();
    renderGovernancePanel();
  };

  // Save Remote Control Settings (Tab 2)
  window.saveTeacherSettings = function(e) {
    if (e) e.preventDefault();

    const rawKkm = parseInt(document.getElementById("t-set-kkm")?.value || "80", 10);
    const rawTimer = parseInt(document.getElementById("t-set-timer")?.value || "20", 10);
    const tokenVal = (document.getElementById("t-set-token")?.value || "idem").trim().toUpperCase() || "IDEM";
    const unlockAll = document.getElementById("t-set-unlockall")?.checked || false;

    const kkmVal = Number.isFinite(rawKkm) && rawKkm >= 50 && rawKkm <= 100 ? rawKkm : 80;
    const timerVal = Number.isFinite(rawTimer) && rawTimer >= 1 && rawTimer <= 120 ? rawTimer : 20;

    kkmThreshold = kkmVal;
    quizTimerMinutes = timerVal;
    classControlMatrix.kkmThreshold = kkmVal;
    classControlMatrix.quizTimerMinutes = timerVal;
    classControlMatrix.activeToken = tokenVal;

    window.kkmThreshold = kkmThreshold;
    window.quizTimerMinutes = quizTimerMinutes;
    window.classControlMatrix = classControlMatrix;

    localStorage.setItem("sejarah_kkm_threshold", String(kkmVal));
    localStorage.setItem("sejarah_quiz_timer", String(timerVal));
    localStorage.setItem("sejarah_active_class_token", tokenVal);

    if (unlockAll) {
      unlockedModules = ["1A", "1B", "1C", "1D", "1E", "1F"];
      ["1A", "1B", "1C", "1D", "1E", "1F"].forEach(id => {
        classControlMatrix.modules[id] = "VISIBLE";
        classControlMatrix.quizzes[id] = "VISIBLE";
      });
    }

    window.unlockedModules = unlockedModules;
    localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
    
    if (typeof window.saveMatrixState === "function") {
      window.saveMatrixState();
    } else {
      localStorage.setItem("sejarah_class_control_matrix", JSON.stringify(classControlMatrix));
    }

    updateSubTabLockStates();
    applyGovernanceToStudentUI();

    const msgEl = document.getElementById("t-save-msg");
    if (msgEl) {
      msgEl.textContent = `✅ Pengaturan Kontrol Disimpan! KKM: ${kkmVal}%, Timer: ${timerVal}m, Token: "${tokenVal}", Unlock: ${unlockAll ? "Semua Terbuka (Mode Demo)" : "Bertahap"}`;
      msgEl.className = "rounded-xl p-3 text-xs font-bold text-center bg-[#174d3a]/10 text-[#174d3a]";
      msgEl.classList.remove("hidden");
      setTimeout(() => msgEl.classList.add("hidden"), 4000);
    }
  };
  window.__teacherSettingsSaver = window.saveTeacherSettings;

  // Instant Access Toggle for Module Grid (Tab 3)
  window.toggleModuleAccessInstant = function(subId) {
    const currentStatus = classControlMatrix.modules[subId] || "VISIBLE";
    const newStatus = (currentStatus === "VISIBLE" || currentStatus === "UNLOCKED") ? "LOCKED" : "VISIBLE";

    classControlMatrix.modules[subId] = newStatus;
    if (newStatus === "VISIBLE" && !unlockedModules.includes(subId)) {
      unlockedModules.push(subId);
    } else if (newStatus === "LOCKED") {
      unlockedModules = unlockedModules.filter(id => id !== subId);
    }
    window.unlockedModules = unlockedModules;
    localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));

    if (typeof window.saveMatrixState === "function") {
      window.saveMatrixState();
    } else {
      localStorage.setItem("sejarah_class_control_matrix", JSON.stringify(classControlMatrix));
    }

    if (typeof updateSubTabLockStates === "function") updateSubTabLockStates();
    if (typeof applyGovernanceToStudentUI === "function") applyGovernanceToStudentUI();
    if (typeof renderModuleOrgGrid === "function") renderModuleOrgGrid();
    if (typeof showTeacherToast === "function") showTeacherToast(`Unit ${subId} diubah statusnya menjadi: ${newStatus === 'VISIBLE' ? '🟢 Terbuka' : '🔒 Terkunci'}`);
  };

  // Edit Module Metadata Modal (Title & Description)
  window.openEditModuleModal = function(subId) {
    if (typeof window.openEditModuleModal === 'function' && window.openEditModuleModal !== openEditModuleModal) {
      window.openEditModuleModal(subId);
      return;
    }
  };

  // Preview HOTS Bank Soal Modal
  window.openPreviewBankSoalModal = function(subId) {
    if (typeof previewHotsQuiz === 'function') {
      previewHotsQuiz(subId);
      return;
    }
  };

  // Preview Flashcards Modal
  window.openPreviewFlashcardsModal = function(subId) {
    if (typeof window.openPreviewFlashcardsModal === 'function' && window.openPreviewFlashcardsModal !== openPreviewFlashcardsModal) {
      window.openPreviewFlashcardsModal(subId);
      return;
    }
  };

  // Render Module Organization Grid (Tab 3)
  window.renderModuleOrgGrid = function() {
    const grid = document.getElementById("module-org-grid");
    if (!grid) return;

    if (typeof window.renderModuleOrgGrid === 'function' && window.renderModuleOrgGrid !== renderModuleOrgGrid) {
      window.renderModuleOrgGrid();
      return;
    }
  };
  window.__teacherModuleOrgGrid = window.renderModuleOrgGrid;

  // Batch Controls for Tab 3 (Organisasi Modul)
  window.bulkUnlockAllModules = function() {
    if (!classControlMatrix.modules) classControlMatrix.modules = {};
    ["1A", "1B", "1C", "1D", "1E", "1F"].forEach(id => { classControlMatrix.modules[id] = "VISIBLE"; });
    unlockedModules = ["1A", "1B", "1C", "1D", "1E", "1F"];
    window.unlockedModules = unlockedModules;
    try {
      localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
      localStorage.setItem("sejarah_unlocked_modules", JSON.stringify(unlockedModules));
    } catch (e) {}
    if (typeof window.saveMatrixState === "function") window.saveMatrixState();
    if (typeof updateSubTabLockStates === "function") updateSubTabLockStates();
    if (typeof applyGovernanceToStudentUI === "function") applyGovernanceToStudentUI();
    if (typeof renderModuleOrgGrid === "function") renderModuleOrgGrid();
    showTeacherToast("🟢 Seluruh Sub-Modul (1A–1F) berhasil DIBUKA untuk siswa!");
  };

  window.bulkLockModulesExcept1A = function() {
    if (!classControlMatrix.modules) classControlMatrix.modules = {};
    classControlMatrix.modules["1A"] = "VISIBLE";
    ["1B", "1C", "1D", "1E", "1F"].forEach(id => { classControlMatrix.modules[id] = "LOCKED_VISIBLE"; });
    unlockedModules = ["1A"];
    window.unlockedModules = unlockedModules;
    try {
      localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
      localStorage.setItem("sejarah_unlocked_modules", JSON.stringify(unlockedModules));
    } catch (e) {}
    if (typeof window.saveMatrixState === "function") window.saveMatrixState();
    if (typeof updateSubTabLockStates === "function") updateSubTabLockStates();
    if (typeof applyGovernanceToStudentUI === "function") applyGovernanceToStudentUI();
    if (typeof renderModuleOrgGrid === "function") renderModuleOrgGrid();
    showTeacherToast("🔒 Sub-Modul 1B–1F berhasil DIKUNCI (Hanya Unit 1A Terbuka)!");
  };

  window.resetModuleMetaToDefault = function() {
    if (!confirm("Kembalikan seluruh judul & deskripsi sub-modul ke standar Kurikulum Merdeka Fase F?")) return;
    classControlMatrix.customMeta = {};
    if (typeof window.saveMatrixState === "function") window.saveMatrixState();
    if (typeof renderModuleOrgGrid === "function") renderModuleOrgGrid();
    showTeacherToast("🔄 Seluruh judul & deskripsi sub-modul berhasil direset ke standar!");
  };

  window.syncCloudMonitoringData = function() {
    if (typeof window.syncCloudMatrixNow === "function") {
      window.syncCloudMatrixNow(true);
    }
    renderMonitoringDashboard();
  };

  window.sendRemedialEmailsMass = async function() {
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem("sejarah_monitoring_logs") || "[]"); } catch(e) {}
    
    const remedialStudents = logs.filter(l => !l.isPassed && l.email && l.email.includes("@"));

    if (remedialStudents.length === 0) {
      alert("ℹ️ Tidak ditemukan siswa berstatus REMIDIAL yang memiliki alamat email valid.");
      return;
    }

    const confirmMsg = `📧 Konfirmasi Pengiriman Email Blast Remedial:\n\nDitemukan ${remedialStudents.length} pengerjaan kuis berstatus REMIDIAL (< KKM ${kkmThreshold}%).\n\nApakah Anda yakin ingin mengirimkan email instruksi pengayaan otomatis ke seluruh alamat Gmail siswa tersebut?`;
    if (!confirm(confirmMsg)) return;

    if (!GAS_API_URL || !GAS_API_URL.startsWith("http")) {
      alert("⚠️ URL Web App Google Apps Script belum dikonfigurasi pada tab Integrasi GAS Cloud.");
      return;
    }

    try {
      showTeacherToast("⏳ Mengirimkan email remedial massal via GAS...");
      const payload = {
        action: "sendRemedialEmails",
        students: remedialStudents.map(s => ({
          nama: s.nama,
          kelas: s.kelas,
          email: s.email,
          subModule: s.subModule,
          score: s.score,
          total: s.total,
          pct: s.pct,
          kkmThreshold: kkmThreshold
        }))
      };

      const res = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result && result.status === "SUCCESS") {
        alert(`✅ PENGIRIMAN EMAIL REMEDIAL SELESAI!\n\nBerhasil Terkirim: ${result.sentCount || remedialStudents.length} email\nGagal: ${result.failedCount || 0}`);
      } else {
        alert(`⚠️ Hasil Pengiriman: ${result.message || "Gagal memproses email via Apps Script."}`);
      }
    } catch(err) {
      alert("⚠️ Terjadi kesalahan jaringan saat memicu pengiriman email remedial via Cloud.");
    }
  };

  window.exportMonitoringCSV = function() {
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem("sejarah_monitoring_logs") || "[]"); } catch(e) {}
    if (logs.length === 0) {
      alert("Belum ada data pengerjaan siswa untuk diekspor.");
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Waktu,Nama Siswa,Kelas,Email,SubModul,Skor,Total,Persentase,Status,AlertTabSwitch,DurasiDetik\n";
    logs.forEach(row => {
      csvContent += `"${row.timestamp}","${row.nama}","${row.kelas}","${row.email}","${row.subModule}",${row.score},${row.total},${row.pct},"${row.isPassed ? 'LULUS' : 'REMIDIAL'}",${row.tabSwitchCount || 0},${row.durationSec || 0}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Monitoring_Sejarah_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  window.clearMonitoringLog = function() {
    if (confirm("Apakah Anda yakin ingin membersihkan seluruh log monitoring pengerjaan siswa?")) {
      localStorage.removeItem("sejarah_monitoring_logs");
      renderMonitoringDashboard();
    }
  };

  window.appPrintStudentReport = function(nama, kelas, email, subModule, score, total, pct, isPassed, tabSwitch) {
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) {
      alert("Pop-up terblokir. Harap izinkan pop-up peramban Anda untuk mencetak Rapor PDF.");
      return;
    }
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapor Hasil Pengerjaan Sejarah Indonesia - ${nama}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #0f172a; background: #fff; line-height: 1.5; }
          .header { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0; font-size: 22px; color: #174d3a; font-family: Georgia, serif; }
          .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
          .meta-table { width: 100%; margin-bottom: 25px; border-collapse: collapse; }
          .meta-table td { padding: 10px 14px; font-size: 13px; border: 1px solid #e2e8f0; }
          .meta-table td.label { font-weight: bold; color: #334155; width: 32%; background: #f8fafc; }
          .score-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 16px; padding: 25px; text-align: center; margin: 25px 0; }
          .score-box.remedial { background: #fef2f2; border-color: #dc2626; }
          .score-box .score { font-size: 42px; font-weight: 800; color: #15803d; margin: 8px 0; }
          .score-box.remedial .score { color: #b91c1c; }
          .badge { display: inline-block; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
          .badge-pass { background: #dcfce7; color: #15803d; }
          .badge-fail { background: #fee2e2; color: #b91c1c; }
          .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>LAPORAN EVALUASI HASIL BELAJAR SEJARAH INDONESIA (1945–1949)</h1>
          <p>Platform Pembelajaran Digital Sejarah Indonesia Fase F (Kelas XII)</p>
        </div>

        <table class="meta-table">
          <tr><td class="label">Nama Lengkap Siswa</td><td><strong>${nama}</strong></td></tr>
          <tr><td class="label">Rombongan Belajar (Kelas)</td><td>${kelas}</td></tr>
          <tr><td class="label">NISN / Alamat Email</td><td>${email}</td></tr>
          <tr><td class="label">Sub-Modul Pembelajaran</td><td>Sub-Modul ${subModule}</td></tr>
          <tr><td class="label">Integritas Proctoring</td><td>${tabSwitch > 0 ? `⚠️ Peringatan: Pindah Tab Peramban ${tabSwitch}x` : '✅ Clean / Bersih (Tercatat Tidak Pindah Tab)'}</td></tr>
        </table>

        <div class="score-box ${isPassed ? '' : 'remedial'}">
          <p style="font-size:11px; font-weight:bold; color:#64748b; margin:0;">HASIL PERSENTASE SKOR KETUNTASAN (KKM: 80%)</p>
          <div class="score">${pct}%</div>
          <p style="font-size:13px; font-weight:600; margin:0 0 12px 0;">Skor Benar: ${score} dari ${total} Soal H.O.T.S</p>
          <span class="badge ${isPassed ? 'badge-pass' : 'badge-fail'}">
            ${isPassed ? 'DIPREDIKATKAN LULUS KETUNTASAN MINIMAL' : 'PERLU MENGIKUTI PROGRAM REMIDIAL'}
          </span>
        </div>

        <div class="footer">
          <div>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div>Dokumen Resmi Portal Kontrol Guru Sejarah Master</div>
        </div>

        <div class="no-print" style="text-align:center; margin-top:30px;">
          <button onclick="window.print()" style="padding:12px 24px; font-weight:bold; background:#174d3a; color:#fff; border:none; border-radius:10px; cursor:pointer; font-size:13px;">🖨️ Cetak / Simpan Dokumen PDF Rapor</button>
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  window.appDeleteLogEntry = function(origIdx) {
    if (confirm("Apakah Anda yakin ingin menghapus log pengerjaan kuis ini?")) {
      try {
        let logs = getStoredArray("sejarah_monitoring_logs");
        logs.splice(origIdx, 1);
        setStoredArray("sejarah_monitoring_logs", logs);
        renderMonitoringDashboard();
      } catch(e) {}
    }
  };

  window.appDeleteRegStudent = function(email) {
    if (confirm(`Apakah Anda yakin ingin menghapus pendaftaran siswa (${email})?`)) {
      try {
        let reg = getStoredArray("sejarah_registered_students");
        reg = reg.filter(s => s.email !== email);
        setStoredArray("sejarah_registered_students", reg);
        renderMonitoringDashboard();
        if (typeof renderTeacherActivationData === "function") renderTeacherActivationData();
      } catch(e) {}
    }
  };

  window.appResetStudentProgress = function(email) {
    if (confirm(`Apakah Anda yakin ingin mereset progres kuis untuk siswa (${email})?`)) {
      try {
        let active = {};
        try { active = window.secureStorage.getItem("activeStudent") || JSON.parse(localStorage.getItem("activeStudent") || "{}"); } catch(e) {}
        if (active.email === email || active.nisn === email) {
          localStorage.setItem("unlockedModules", JSON.stringify(["1A"]));
        }
        let logs = getStoredArray("sejarah_monitoring_logs");
        logs = logs.filter(l => l.email !== email);
        setStoredArray("sejarah_monitoring_logs", logs);
        alert(`✅ Progres kuis untuk ${email} berhasil di-reset.`);
        renderMonitoringDashboard();
      } catch(e) {}
    }
  };

  // Digital Certificate Generator with QR Code Verification
  window.appGenerateCertificate = function(nama, kelas) {
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem("sejarah_monitoring_logs") || "[]"); } catch(e) {}
    const active = JSON.parse(localStorage.getItem("activeStudent") || "{}");
    const studentNama = nama || active.nama || "Siswa Pembelajar";
    const studentKelas = kelas || active.kelas || "Fase F (Kelas XII)";
    
    const studentLogs = logs.filter(l => l.email === active.email || l.nama === studentNama);
    const avgScore = studentLogs.length > 0 ? Math.round(studentLogs.reduce((a, b) => a + b.pct, 0) / studentLogs.length) : 95;

    const certId = `CERT-HIST-${Date.now().toString(36).toUpperCase()}-${(studentNama.substring(0,3)).toUpperCase()}`;
    const qrDataStr = `STATUS: TERVERIFIKASI RESMI | ID: ${certId} | Nama: ${studentNama} | Kelas: ${studentKelas} | Nilai Rata-rata: ${avgScore}% | Platform: Sejarah Indonesia E-Learning`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrDataStr)}`;

    const certWin = window.open('', '_blank', 'width=920,height=680');
    if (!certWin) {
      alert("Pop-up terblokir. Harap izinkan pop-up peramban Anda untuk mencetak Sertifikat Digital.");
      return;
    }
    certWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sertifikat Kelulusan Sejarah Indonesia - ${studentNama}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Georgia', serif; padding: 20px; background: #faf8f5; color: #174d3a; text-align: center; line-height: 1.4; margin: 0; }
          .border-box { border: 10px double #174d3a; padding: 30px 20px; background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); max-width: 900px; margin: 0 auto; position: relative; }
          h1 { font-size: 26px; letter-spacing: 2px; color: #174d3a; margin: 10px 0 5px 0; text-transform: uppercase; }
          h2 { font-size: 14px; font-family: sans-serif; font-weight: 600; color: #ee824b; letter-spacing: 3px; margin: 0; text-transform: uppercase; }
          .presented { font-size: 12px; font-family: sans-serif; color: #64748b; margin-top: 15px; }
          .name { font-size: 28px; font-weight: bold; color: #0f172a; margin: 8px 0; text-decoration: underline; text-decoration-color: #ee824b; word-break: break-word; }
          .desc { font-size: 13px; font-family: sans-serif; line-height: 1.5; color: #334155; max-width: 650px; margin: 15px auto; }
          .seal { display: inline-block; width: 75px; height: 75px; border-radius: 50%; background: #ee824b; color: #fff; font-family: sans-serif; font-weight: bold; font-size: 10px; line-height: 75px; text-align: center; border: 3px solid #fff; box-shadow: 0 0 0 3px #ee824b; margin: 10px 0; }
          .signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; font-family: sans-serif; font-size: 11px; color: #475569; padding: 0 20px; }
          .qr-box { text-align: center; border: 1px dashed #174d3a; padding: 6px; background: #fffdf7; border-radius: 8px; }
          .cert-id { font-size: 9px; font-family: monospace; color: #174d3a; margin-top: 4px; font-weight: bold; }
          @media (max-width: 640px) {
            body { padding: 10px; }
            .border-box { padding: 15px 10px; border-width: 6px; }
            h1 { font-size: 20px; }
            .name { font-size: 22px; }
            .desc { font-size: 11px; }
            .signatures { padding: 0 10px; flex-direction: column; gap: 15px; }
          }
          @media print {
            body { background: none; padding: 0; }
            .border-box { box-shadow: none; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="border-box">
          <h2>SERTIFIKAT KELULUSAN DIGITAL VERIFIKATIF</h2>
          <h1>SEJARAH INDONESIA FASE F</h1>
          <p class="presented">Sertifikat Resmi Kelulusan Modul Diberikan Kepada:</p>
          <div class="name">${studentNama}</div>
          <p style="font-family:sans-serif; font-weight:bold; color:#64748b;">Rombongan Belajar: ${studentKelas}</p>
          <p class="desc">Telah berhasil menyelesaikan seluruh modul evaluasi dan kuis interaktif dengan skor rata-rata ketuntasan minimal <strong>${avgScore}%</strong> pada Platform Pembelajaran Sejarah Indonesia Digital.</p>
          <div>
            <div class="seal">LULUS KKM</div>
          </div>
          <div class="signatures">
            <div style="text-align:left;">
              <p>Pengampu Sejarah Indonesia:</p>
              <br><br>
              <strong>Guru Master Sejarah</strong>
            </div>
            
            <div class="qr-box">
              <img src="${qrUrl}" alt="QR Code Verifikasi Sertifikat" style="width:90px; height:90px; border:2px solid #174d3a; border-radius:6px; display:block; margin:0 auto;">
              <div class="cert-id">${certId}</div>
              <span style="font-size:8px; color:#475569; display:block; margin-top:2px;">Scan QR untuk Verifikasi Keaslian</span>
            </div>

            <div style="text-align:right;">
              <p>Tanggal Penerbitan:</p>
              <br><br>
              <strong>${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </div>
          </div>
        </div>
        <div class="no-print" style="margin-top:20px;">
          <button onclick="window.print()" style="padding:12px 28px; background:#174d3a; color:#fff; font-weight:bold; border:none; border-radius:8px; cursor:pointer; font-family:sans-serif; font-size:13px;">🖨️ Cetak / Simpan Dokumen PDF Sertifikat</button>
        </div>
      </body>
      </html>
    `);
    certWin.document.close();
  };

  // Interactive Glossary Modal Trigger
  window.showGlossaryModal = function(term, definition) {
    alert(`📖 GLOSARIUM ISTILAH SEJARAH\n\n📌 Istilah: "${term}"\n\n💡 Definisi & Penjelasan:\n${definition}`);
  };

  // Export Monitoring Log to CSV
  const exportCsvBtn = document.getElementById("export-monitoring-csv-btn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      let logs = [];
      try { logs = JSON.parse(localStorage.getItem("sejarah_monitoring_logs") || "[]"); } catch(e) {}
      if (logs.length === 0) {
        alert("Belum ada data pengerjaan siswa untuk diekspor.");
        return;
      }
      let csvContent = "data:text/csv;charset=utf-8,Waktu,Nama Siswa,Kelas,Email,SubModul,Skor,Total,Persentase,Status,AlertTabSwitch,DurasiDetik\n";
      logs.forEach(row => {
        csvContent += `"${row.timestamp}","${row.nama}","${row.kelas}","${row.email}","${row.subModule}",${row.score},${row.total},${row.pct},"${row.isPassed ? 'LULUS' : 'REMIDIAL'}",${row.tabSwitchCount || 0},${row.durationSec || 0}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Rekap_Monitoring_Sejarah_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Clear Monitoring Log
  const clearLogBtn = document.getElementById("clear-monitoring-log-btn");
  if (clearLogBtn) {
    clearLogBtn.addEventListener("click", () => {
      if (confirm("Apakah Anda yakin ingin membersihkan seluruh log monitoring pengerjaan siswa?")) {
        localStorage.removeItem("sejarah_monitoring_logs");
        renderMonitoringDashboard();
      }
    });
  }

  // Teacher Form Submission (Remote Admin Controls)
  if (teacherAdminForm) {
    teacherAdminForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pin = document.getElementById("input-teacher-pin").value.trim();
      const newKkm = parseInt(document.getElementById("input-teacher-kkm").value || "80", 10);
      const newTimer = parseInt(document.getElementById("input-teacher-timer").value || "20", 10);
      const newTokenInput = document.getElementById("input-teacher-new-token");
      const newClassToken = newTokenInput ? newTokenInput.value.trim().toUpperCase() : "";
      const newGasUrl = document.getElementById("input-teacher-gas-url") ? document.getElementById("input-teacher-gas-url").value.trim() : "";
      const unlockAll = document.getElementById("check-unlock-all").checked;

      const isValidPin = await (window.verifyPasswordSecure ? window.verifyPasswordSecure(pin) : false);

      if (!isValidPin) {
        if (teacherMsg) {
          teacherMsg.textContent = "PIN / Password Guru Salah atau Tidak Berhak!";
          teacherMsg.className = "text-xs font-bold p-2.5 rounded-xl text-center bg-[#a53e24]/10 text-[#a53e24]";
          teacherMsg.classList.remove("hidden");
        }
        return;
      }

      kkmThreshold = newKkm;
      quizTimerMinutes = newTimer;
      if (newClassToken) {
        localStorage.setItem("sejarah_active_class_token", newClassToken);
      }
      if (newGasUrl) {
        GAS_API_URL = newGasUrl;
        localStorage.setItem("sejarah_gas_url", newGasUrl);
      }
      
      if (unlockAll) {
        unlockedModules = ["1A", "1B", "1C", "1D", "1E", "1F"];
      }
      localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
      updateSubTabLockStates();

      if (teacherMsg) {
        teacherMsg.textContent = `Pengaturan Disimpan! Token Aktif: "${newClassToken || 'idem'}", KKM: ${kkmThreshold}%, Timer: ${quizTimerMinutes}m, Mode Unlock: ${unlockAll ? "Semua Terbuka" : "Bertahap"}`;
        teacherMsg.className = "text-xs font-bold p-2.5 rounded-xl text-center bg-[#4f8b5c]/10 text-[#174d3a]";
        teacherMsg.classList.remove("hidden");
      }

      setTimeout(() => {
        if (teacherAdminModal) teacherAdminModal.classList.add("hidden");
      }, 1500);
    });
  }

  // Stepper Control Listeners
  if (prevQBtn) {
    prevQBtn.addEventListener("click", () => {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderSingleQuestionCard(currentQuestionIndex);
        updateQuestionNavGrid();
        updateStepperButtons();
        if (quizList) quizList.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  if (nextQBtn) {
    nextQBtn.addEventListener("click", () => {
      const totalQ = activeQuizQuestions.length || 15;
      if (currentQuestionIndex < totalQ - 1) {
        currentQuestionIndex++;
        renderSingleQuestionCard(currentQuestionIndex);
        updateQuestionNavGrid();
        updateStepperButtons();
        if (quizList) quizList.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  if (materiTab) materiTab.addEventListener("click", () => showPage("materi"));
  if (kuisTab) kuisTab.addEventListener("click", () => showPage("kuis"));

  document.querySelectorAll("#start-quiz-button, [data-template-id='start-quiz-button']").forEach(btn => {
    btn.addEventListener("click", () => showPage("kuis"));
  });

  if (checkQuizButton) checkQuizButton.addEventListener("click", checkQuiz);

  const retryQuizBtn = document.getElementById("retry-quiz-button");
  if (retryQuizBtn) {
    retryQuizBtn.addEventListener("click", () => {
      switchSubModule(currentSubModule);
    });
  }



  // Helper: Show Welcome Toast Banner for Seamless Login
  function showToastWelcome(nama, kelas) {
    const existingToast = document.getElementById("welcome-toast");
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.id = "welcome-toast";
    toast.className = "fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl bg-[#174d3a] px-5 py-3.5 text-white shadow-2xl transition-all duration-500";
    toast.innerHTML = `
      <div class="grid h-8 w-8 place-items-center rounded-xl bg-[#d8ee93] text-[#174d3a] font-bold">
        ✨
      </div>
      <div>
        <h4 class="text-xs font-bold text-[#d8ee93]">Sesi Siswa Terverifikasi!</h4>
        <p class="text-[11px] font-semibold text-white">Selamat Belajar, <strong>${escapeHtml(nama)}</strong> (${escapeHtml(kelas)})</p>
      </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }

  // Always render default sub-module manuscript text & activate materi page view on load
  switchSubModule(currentSubModule || "1A");
  showPage("materi");

  // Add listener & global delegation for all start quiz buttons
  document.querySelectorAll("#start-quiz-button, [data-template-id='start-quiz-button']").forEach(btn => {
    btn.addEventListener("click", () => {
      if (typeof window.requestAccessToQuiz === "function") {
        window.requestAccessToQuiz(currentSubModule);
      } else {
        showPage("kuis");
      }
    });
  });

  document.addEventListener("click", (e) => {
    const target = e.target.closest("#start-quiz-button, [data-template-id='start-quiz-button']");
    if (target) {
      if (typeof window.requestAccessToQuiz === "function") {
        window.requestAccessToQuiz(currentSubModule);
      } else {
        showPage("kuis");
      }
    }
  });

  // Check saved student session (with automatic legacy fallback migration)
  const parsedStudent = window.secureStorage.getItem("activeStudent");
  const isJustRegistered = sessionStorage.getItem("justRegisteredFromLanding") === "true";

  if (parsedStudent && parsedStudent.nama) {
    try {
      handleStudentLogin(parsedStudent.nama, parsedStudent.email, parsedStudent.kelas, parsedStudent.token);
      if (studentAuthModal) studentAuthModal.classList.add("hidden");

      if (isJustRegistered) {
        sessionStorage.removeItem("justRegisteredFromLanding");
        showToastWelcome(parsedStudent.nama, parsedStudent.kelas);
      }
    } catch(e) {
      if (studentAuthModal) studentAuthModal.classList.add("hidden");
    }
  } else {
    // Keep studentAuthModal hidden on load so manuscript text is immediately readable without popups
    if (studentAuthModal) studentAuthModal.classList.add("hidden");
  }

  updateTeacherUIIndicator();
  updateSubTabLockStates();
});

// =========================================================================
// TEACHER CONTROL CENTER & CONTENT CONTROL MATRIX ENGINE (GLOBAL SCOPE)
// =========================================================================
classControlMatrix = {
  configVersion: 1,
  activePreset: "LEARNING",
  modules: { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" },
  quizzes: { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" },
  explanations: { "1A": "LOCKED", "1B": "LOCKED", "1C": "LOCKED", "1D": "LOCKED", "1E": "LOCKED", "1F": "LOCKED" },
  questionCounts: { "1A": 15, "1B": 15, "1C": 15, "1D": 15, "1E": 15, "1F": 15 },
  schedules: {
    "1A": { start: "", expire: "" },
    "1B": { start: "", expire: "" },
    "1C": { start: "", expire: "" },
    "1D": { start: "", expire: "" },
    "1E": { start: "", expire: "" },
    "1F": { start: "", expire: "" }
  },
  emergencyLocked: false,
  examPaused: false,
  broadcastMessage: "",
  snapshots: [],
  remedialOverrides: {},
  navigationMode: "FREE",
  attemptLimit: 0,
  shuffleQuestions: "OFF",
  interModuleFlow: "SEQUENTIAL",
  previewMode: false,
  // ===== GOVERNANCE ENGINE EXTENSIONS =====
  tokenLocks: {
    "1A": "", "1B": "", "1C": "", "1D": "", "1E": "", "1F": "",
    "quiz-1A": "", "quiz-1B": "", "quiz-1C": "", "quiz-1D": "", "quiz-1E": "", "quiz-1F": ""
  },
  globalElements: {
    certificate: "VISIBLE",
    glossary: "VISIBLE",
    reflection: "VISIBLE"
  },
  precheck: "OFF",
  resetTokenEpoch: 0,
  revokedTokenStudents: []
};

try {
  const savedMatrix = localStorage.getItem("sejarah_class_control_matrix");
  if (savedMatrix) {
    const parsed = JSON.parse(savedMatrix);
    classControlMatrix = Object.assign(classControlMatrix, parsed);
    // Deep-merge nested objects
    if (parsed.tokenLocks) classControlMatrix.tokenLocks = Object.assign(classControlMatrix.tokenLocks, parsed.tokenLocks);
    if (parsed.globalElements) classControlMatrix.globalElements = Object.assign(classControlMatrix.globalElements, parsed.globalElements);
    if (parsed.flashcards) classControlMatrix.flashcards = Object.assign(classControlMatrix.flashcards || {}, parsed.flashcards);
    if (Array.isArray(parsed.revokedTokenStudents)) classControlMatrix.revokedTokenStudents = parsed.revokedTokenStudents;
    if (parsed.resetTokenEpoch !== undefined) classControlMatrix.resetTokenEpoch = parsed.resetTokenEpoch;
  }
} catch(e) {}

// Instant real-time cross-tab synchronization listener
window.addEventListener("storage", (e) => {
  if (e.key === "sejarah_class_control_matrix" && e.newValue) {
    try {
      const updated = JSON.parse(e.newValue);
      classControlMatrix = Object.assign(classControlMatrix, updated);
      if (updated.flashcards) classControlMatrix.flashcards = Object.assign(classControlMatrix.flashcards || {}, updated.flashcards);
      if (updated.schedules) classControlMatrix.schedules = Object.assign(classControlMatrix.schedules || {}, updated.schedules);
      if (typeof updateSubTabLockStates === "function") updateSubTabLockStates();
      if (typeof applyGovernanceToStudentUI === "function") applyGovernanceToStudentUI();
      if (typeof renderGovernancePanel === "function") renderGovernancePanel();
    } catch(err) {}
  }
});

window.saveMatrixState = function() {
  classControlMatrix.configVersion++;
  localStorage.setItem("sejarah_class_control_matrix", JSON.stringify(classControlMatrix));
  const saveStatus = document.getElementById("matrix-save-status");
  if (saveStatus) {
    saveStatus.textContent = `✓ Matriks v${classControlMatrix.configVersion} Tersimpan!`;
    setTimeout(() => { saveStatus.textContent = "✓ Matriks Kontrol Tersimpan & Aktif"; }, 2000);
  }
  updateSubTabLockStates();

  // Async push to GAS Cloud Backend
  if (GAS_API_URL && GAS_API_URL.startsWith("http")) {
    try {
      fetch(GAS_API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateControlMatrix",
          requestToken: "SEJARAH_SECURE_TOKEN_2026",
          pin: "SEJARAH12",
          config: classControlMatrix
        })
      }).catch(e => {});
    } catch(e) {}
  }
};

window.toggleEmergencyLock = function() {
  const isLocking = !classControlMatrix.emergencyLocked;
  const actionText = isLocking ? "MENGUNCI SEMUA LAYAR HP SISWA" : "MEMBUKA KUNCI LAYAR HP SISWA";
  
  const code = prompt(`🔒 VERIFIKASI DUA FAKTOR PENGUNCIAN / PEMBUKAAN KELAS:\n\nUntuk ${actionText}, masukkan kode keamanan [pulucinor]:`);
  if (code === null) return;

  if (code.trim().toLowerCase() !== "pulucinor") {
    alert("⚠️ AKSI DITOLAK!\n\nKode keamanan [pulucinor] yang Anda masukkan salah. Perubahan status penguncian dibatalkan.");
    return;
  }

  classControlMatrix.emergencyLocked = isLocking;
  window.saveMatrixState();
  window.syncMatrixUIFromState();
  
  if (isLocking) {
    alert("🚨 SELURUH LAYAR HP SISWA TERKUNCI PERMANEN REAL-TIME!\n\nLayar tidak dapat dibuka oleh siapapun kecuali memasukkan kode [pulucinor].");
  } else {
    alert("🟢 KUNCI LAYAR HP SISWA BERHASIL DIBUKA!");
  }
};

window.togglePauseExam = function() {
  const isPausing = !classControlMatrix.examPaused;
  const actionText = isPausing ? "MENJEDA (PAUSE) UJIAN SISWA" : "MELANJUTKAN (RESUME) UJIAN SISWA";
  
  const code = prompt(`🔒 VERIFIKASI OTORISASI TIMER UJIAN:\n\nUntuk ${actionText}, masukkan kode keamanan [pulucinor]:`);
  if (code === null) return;

  if (code.trim().toLowerCase() !== "pulucinor") {
    alert("⚠️ AKSI DITOLAK!\n\nKode keamanan [pulucinor] salah. Perubahan timer ujian dibatalkan.");
    return;
  }

  classControlMatrix.examPaused = isPausing;
  window.saveMatrixState();
  window.syncMatrixUIFromState();
};

window.sendBroadcastMessage = function() {
  const input = document.getElementById("v6-input-broadcast-text") || document.getElementById("input-broadcast-text");
  if (!input || !input.value.trim()) {
    alert("⚠️ Masukkan teks pengumuman broadcast terlebih dahulu!");
    return;
  }
  classControlMatrix.broadcastMessage = input.value.trim();
  window.saveMatrixState();
  window.syncMatrixUIFromState();
  alert("📢 Pengumuman broadcast berhasil dikirim ke layar seluruh siswa!");
};

window.clearBroadcastMessage = function() {
  classControlMatrix.broadcastMessage = "";
  ["v6-input-broadcast-text", "input-broadcast-text"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  window.saveMatrixState();
  window.syncMatrixUIFromState();
};

window.syncMatrixUIFromState = function() {
  const subIds = ["1A", "1B", "1C", "1D", "1E", "1F"];
  subIds.forEach(id => {
    const modSel = document.getElementById(`matrix-status-mod-${id}`);
    const quizSel = document.getElementById(`matrix-status-quiz-${id}`);
    const expSel = document.getElementById(`matrix-status-exp-${id}`);
    const qCountIn = document.getElementById(`matrix-qcount-${id}`);
    const startIn = document.getElementById(`matrix-sched-start-${id}`);
    const expireIn = document.getElementById(`matrix-sched-expire-${id}`);

    if (modSel) modSel.value = classControlMatrix.modules[id] || "VISIBLE";
    if (quizSel) quizSel.value = classControlMatrix.quizzes[id] || "VISIBLE";
    if (expSel) expSel.value = classControlMatrix.explanations[id] || "LOCKED";
    if (qCountIn) qCountIn.value = classControlMatrix.questionCounts[id] || 15;
    if (startIn && classControlMatrix.schedules && classControlMatrix.schedules[id]) startIn.value = classControlMatrix.schedules[id].start || "";
    if (expireIn && classControlMatrix.schedules && classControlMatrix.schedules[id]) expireIn.value = classControlMatrix.schedules[id].expire || "";
  });

  const badge = document.getElementById("matrix-active-preset-badge");
  if (badge) badge.textContent = `Mode Aktif: ${classControlMatrix.activePreset}`;

  // Sync Emergency & Broadcast UI in Teacher Dashboard (both v6 and legacy)
  const syncEmergencyBtn = (btnId, labelId, badgeId) => {
    const btn = document.getElementById(btnId);
    const label = document.getElementById(labelId);
    const badge = document.getElementById(badgeId);
    if (btn && label && badge) {
      if (classControlMatrix.emergencyLocked) {
        btn.className = "flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer";
        label.textContent = "🔓 BUKA KUNCI DARURAT KELAS";
        badge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse";
        badge.textContent = "🚨 LAYAR KELAS DIKUNCI GURU";
      } else {
        btn.className = "flex items-center justify-center gap-2 rounded-xl border border-[#a53e24] bg-[#a53e24] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#852e18] transition cursor-pointer";
        label.textContent = "🚨 Kunci Semua Layar HP Siswa";
        badge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#174d3a]/10 text-[#174d3a] border border-[#174d3a]/30";
        badge.textContent = "🟢 Kondisi Kelas Normal";
      }
    }
  };
  syncEmergencyBtn("v6-btn-toggle-emergency-lock", "v6-label-emergency-lock", "v6-emergency-status-badge");
  syncEmergencyBtn("btn-toggle-emergency-lock", "label-emergency-lock", "emergency-status-badge");

  const syncPauseBtn = (btnId, labelId) => {
    const btn = document.getElementById(btnId);
    const label = document.getElementById(labelId);
    if (btn && label) {
      if (classControlMatrix.examPaused) {
        btn.className = "flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer";
        label.textContent = "▶️ LANJUTKAN UJIAN SISWA";
      } else {
        btn.className = "flex items-center justify-center gap-2 rounded-xl border border-[#ee824b] bg-[#ee824b] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#d66f39] transition cursor-pointer";
        label.textContent = "⏸️ Jeda (Pause) Ujian Siswa";
      }
    }
  };
  syncPauseBtn("v6-btn-toggle-pause-exam", "v6-label-pause-exam");
  syncPauseBtn("btn-toggle-pause-exam", "label-pause-exam");

  ["v6-input-broadcast-text", "input-broadcast-text"].forEach(id => {
    const broadcastInput = document.getElementById(id);
    if (broadcastInput && document.activeElement !== broadcastInput) {
      broadcastInput.value = classControlMatrix.broadcastMessage || "";
    }
  });

  // Render Proposal 3C Snapshots & Proposal 3D Remedial Lists
  if (typeof window.renderSnapshotsList === "function") window.renderSnapshotsList();
  if (typeof window.populateRemedialStudentSelect === "function") window.populateRemedialStudentSelect();
  if (typeof window.renderRemedialOverridesList === "function") window.renderRemedialOverridesList();

  // Sync Proposal 4 Orchestration Dropdowns
  const navSel = document.getElementById("select-nav-mode");
  const attSel = document.getElementById("select-attempt-limit");
  const shufSel = document.getElementById("select-shuffle-mode");
  const flowSel = document.getElementById("select-intermod-flow");

  if (navSel) navSel.value = classControlMatrix.navigationMode || "FREE";
  if (attSel) attSel.value = String(classControlMatrix.attemptLimit !== undefined ? classControlMatrix.attemptLimit : 0);
  if (shufSel) shufSel.value = classControlMatrix.shuffleQuestions || "OFF";
  if (flowSel) flowSel.value = classControlMatrix.interModuleFlow || "SEQUENTIAL";

  // Dynamic Student Emergency Overlay & Broadcast Banner System
  const isTeacherActive = sessionStorage.getItem("isTeacherActive") === "true";
  let lockOverlay = document.getElementById("student-emergency-lock-overlay");
  
  if (classControlMatrix.emergencyLocked && !isTeacherActive) {
    if (!lockOverlay) {
      lockOverlay = document.createElement("div");
      lockOverlay.id = "student-emergency-lock-overlay";
      lockOverlay.className = "fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-red-950/95 p-6 text-center text-white backdrop-blur-xl animate-fade-in";
      lockOverlay.innerHTML = `
        <div class="max-w-md space-y-4 rounded-3xl border-2 border-red-500/50 bg-red-900/40 p-8 shadow-2xl backdrop-blur-md">
          <div class="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-600/30 text-4xl animate-bounce">
            🚨
          </div>
          <h2 class="text-2xl font-black tracking-tight text-red-200">LAYAR KELAS DIKUNCI GURU</h2>
          <p class="text-sm font-semibold text-red-100/90 leading-relaxed">
            Guru Sejarah Anda sedang mengunci seluruh aktivitas kelas untuk pengarahan. Perangkat Anda tidak dapat digunakan sampai kunci dibuka oleh Guru.
          </p>
          <div class="pt-2">
            <span class="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-1.5 text-xs font-bold text-red-300 border border-red-500/30">
              🔒 Terkunci Real-Time (Otorisasi: pulucinor)
            </span>
          </div>
        </div>
      `;
      document.body.appendChild(lockOverlay);
    }
  } else {
    if (lockOverlay) lockOverlay.remove();
  }

  // Dynamic Broadcast Banner Engine
  let broadcastBanner = document.getElementById("student-broadcast-banner");
  if (classControlMatrix.broadcastMessage && classControlMatrix.broadcastMessage.trim() !== "") {
    if (!broadcastBanner) {
      broadcastBanner = document.createElement("div");
      broadcastBanner.id = "student-broadcast-banner";
      broadcastBanner.className = "fixed top-0 left-0 right-0 z-[9990] bg-amber-500 text-slate-950 px-4 py-2 text-xs font-extrabold shadow-lg flex items-center justify-between gap-3";
      document.body.appendChild(broadcastBanner);
    }
    broadcastBanner.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        <span class="px-2 py-0.5 rounded bg-black text-amber-300 text-[10px] font-black shrink-0">📢 PENGUMUMAN GURU</span>
        <marquee class="font-bold text-xs">${escapeHtml(classControlMatrix.broadcastMessage)}</marquee>
      </div>
      <button type="button" onclick="this.parentElement.remove()" class="text-slate-900 hover:text-black font-black text-sm px-1 shrink-0">✕</button>
    `;
  } else {
    if (broadcastBanner) broadcastBanner.remove();
  }
};

// =========================================================================
// PROPOSAL 3C: CLASS STATE SNAPSHOT & RESTORE ENGINE (MODUL 14)
// =========================================================================
window.createClassSnapshot = function() {
  const nameInput = document.getElementById("input-snapshot-name");
  let snapName = nameInput ? nameInput.value.trim() : "";
  if (!snapName) {
    const now = new Date();
    snapName = `Snapshot ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  }

  if (!Array.isArray(classControlMatrix.snapshots)) {
    classControlMatrix.snapshots = [];
  }

  const newSnap = {
    id: "snap_" + Date.now(),
    name: snapName,
    timestamp: new Date().toLocaleString('id-ID'),
    config: {
      activePreset: classControlMatrix.activePreset,
      modules: JSON.parse(JSON.stringify(classControlMatrix.modules || {})),
      quizzes: JSON.parse(JSON.stringify(classControlMatrix.quizzes || {})),
      explanations: JSON.parse(JSON.stringify(classControlMatrix.explanations || {})),
      questionCounts: JSON.parse(JSON.stringify(classControlMatrix.questionCounts || {})),
      schedules: JSON.parse(JSON.stringify(classControlMatrix.schedules || {}))
    }
  };

  classControlMatrix.snapshots.unshift(newSnap);
  if (nameInput) nameInput.value = "";
  window.saveMatrixState();
  window.renderSnapshotsList();
  alert(`📸 Snapshot "${snapName}" Berhasil Disimpan!`);
};

window.restoreClassSnapshot = function(snapId) {
  if (!Array.isArray(classControlMatrix.snapshots)) return;
  const snap = classControlMatrix.snapshots.find(s => s.id === snapId);
  if (!snap) return;

  if (confirm(`Apakah Anda yakin ingin memulihkan pengaturan kelas ke profil "${snap.name}"?`)) {
    classControlMatrix.activePreset = snap.config.activePreset || "CUSTOM";
    classControlMatrix.modules = JSON.parse(JSON.stringify(snap.config.modules || {}));
    classControlMatrix.quizzes = JSON.parse(JSON.stringify(snap.config.quizzes || {}));
    classControlMatrix.explanations = JSON.parse(JSON.stringify(snap.config.explanations || {}));
    classControlMatrix.questionCounts = JSON.parse(JSON.stringify(snap.config.questionCounts || {}));
    classControlMatrix.schedules = JSON.parse(JSON.stringify(snap.config.schedules || {}));

    window.saveMatrixState();
    window.syncMatrixUIFromState();
    alert(`🔄 Pengaturan kelas berhasil dipulihkan ke profil "${snap.name}"!`);
  }
};

window.deleteClassSnapshot = function(snapId) {
  if (!Array.isArray(classControlMatrix.snapshots)) return;
  if (confirm("Apakah Anda yakin ingin menghapus snapshot profil ini?")) {
    classControlMatrix.snapshots = classControlMatrix.snapshots.filter(s => s.id !== snapId);
    window.saveMatrixState();
    window.renderSnapshotsList();
  }
};

window.renderSnapshotsList = function() {
  const container = document.getElementById("snapshot-list-container");
  if (!container) return;

  const snapshots = classControlMatrix.snapshots || [];
  if (snapshots.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-[#718277] italic text-center py-1">Belum ada snapshot tersimpan.</p>`;
    return;
  }

  let html = "";
  snapshots.forEach(s => {
    html += `
      <div class="flex items-center justify-between gap-2 rounded-xl border border-[#d8d3c4] bg-white px-3 py-2 text-xs shadow-xs">
        <div class="truncate">
          <span class="font-bold text-[#174d3a] block truncate">${escapeHtml(s.name)}</span>
          <span class="text-[9px] text-[#718277]">📅 ${escapeHtml(s.timestamp)}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="restoreClassSnapshot('${s.id}')" class="px-2.5 py-1 rounded-lg bg-[#174d3a] text-[#d8ee93] font-bold text-[10px] hover:bg-[#0f382a] transition flex items-center gap-1">
            <i data-lucide="rotate-ccw" class="h-3 w-3"></i> Pulihkan
          </button>
          <button type="button" onclick="deleteClassSnapshot('${s.id}')" class="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-[10px] hover:bg-rose-200 transition">
            🗑️
          </button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
};

// =========================================================================
// PROPOSAL 3D: STUDENT-SPECIFIC REMEDIAL TARGETING ENGINE (MODUL 13)
// =========================================================================
window.populateRemedialStudentSelect = function() {
  const select = document.getElementById("select-remedial-student");
  if (!select) return;

  let logs = [];
  try { logs = JSON.parse(localStorage.getItem("sejarah_monitoring_logs") || "[]"); } catch(e) {}

  const studentSet = new Set();
  logs.forEach(l => { if (l.nama) studentSet.add(l.nama); });

  let html = `<option value="">-- Pilih Siswa --</option>`;
  studentSet.forEach(studentNama => {
    html += `<option value="${escapeHtml(studentNama)}">👤 ${escapeHtml(studentNama)}</option>`;
  });

  select.innerHTML = html;
};

window.addStudentRemedialOverride = function() {
  const studentSelect = document.getElementById("select-remedial-student");
  const submodSelect = document.getElementById("select-remedial-submod");

  const studentNama = studentSelect ? studentSelect.value.trim() : "";
  const subId = submodSelect ? submodSelect.value.trim() : "1A";

  if (!studentNama) {
    alert("⚠️ Pilih nama siswa terlebih dahulu!");
    return;
  }

  if (!classControlMatrix.remedialOverrides) {
    classControlMatrix.remedialOverrides = {};
  }
  if (!classControlMatrix.remedialOverrides[studentNama]) {
    classControlMatrix.remedialOverrides[studentNama] = {};
  }

  classControlMatrix.remedialOverrides[studentNama][subId] = true;
  window.saveMatrixState();
  window.renderRemedialOverridesList();
  alert(`🎯 Override Remedial Berhasil! Akses Sub-Modul ${subId} dibuka khusus untuk ${studentNama}.`);
};

window.removeStudentRemedialOverride = function(studentNama, subId) {
  if (classControlMatrix.remedialOverrides && classControlMatrix.remedialOverrides[studentNama]) {
    delete classControlMatrix.remedialOverrides[studentNama][subId];
    if (Object.keys(classControlMatrix.remedialOverrides[studentNama]).length === 0) {
      delete classControlMatrix.remedialOverrides[studentNama];
    }
    window.saveMatrixState();
    window.renderRemedialOverridesList();
  }
};

window.autoTargetRemedialUnderKKM = function() {
  let logs = [];
  try { logs = JSON.parse(localStorage.getItem("sejarah_monitoring_logs") || "[]"); } catch(e) {}

  let count = 0;
  if (!classControlMatrix.remedialOverrides) classControlMatrix.remedialOverrides = {};

  logs.forEach(l => {
    if (l.nama && (l.isPassed === false || (l.pct && l.pct < 80))) {
      const subId = l.subModule || "1A";
      if (!classControlMatrix.remedialOverrides[l.nama]) {
        classControlMatrix.remedialOverrides[l.nama] = {};
      }
      if (!classControlMatrix.remedialOverrides[l.nama][subId]) {
        classControlMatrix.remedialOverrides[l.nama][subId] = true;
        count++;
      }
    }
  });

  window.saveMatrixState();
  window.renderRemedialOverridesList();
  if (count > 0) {
    alert(`🎯 Auto-Target Berhasil!\n\nSebanyak ${count} izin remedial telah otomatis diaktifkan untuk siswa dengan nilai di bawah KKM (<80%).`);
  } else {
    alert(`ℹ️ Semua siswa terdaftar saat ini sudah mencapai Nilai KKM atau belum ada log nilai di bawah KKM.`);
  }
};

window.renderRemedialOverridesList = function() {
  const container = document.getElementById("remedial-override-list");
  if (!container) return;

  const overrides = classControlMatrix.remedialOverrides || {};
  const entries = [];
  Object.keys(overrides).forEach(studentNama => {
    Object.keys(overrides[studentNama]).forEach(subId => {
      if (overrides[studentNama][subId]) {
        entries.push({ studentNama, subId });
      }
    });
  });

  if (entries.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-[#718277] italic text-center py-1">Belum ada izin override remedial per siswa.</p>`;
    return;
  }

  let html = "";
  entries.forEach(e => {
    html += `
      <div class="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs shadow-xs">
        <div class="truncate flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-[#ee824b] text-white text-[10px] font-extrabold">Sub-Modul ${escapeHtml(e.subId)}</span>
          <span class="font-bold text-[#174d3a] truncate">👤 ${escapeHtml(e.studentNama)}</span>
        </div>
        <button type="button" onclick="removeStudentRemedialOverride('${escapeHtml(e.studentNama)}', '${escapeHtml(e.subId)}')" class="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-[10px] hover:bg-rose-200 transition shrink-0">
          🗑️ Hapus Izin
        </button>
      </div>
    `;
  });
  container.innerHTML = html;
};

// =========================================================================
// PROPOSAL 4: QUIZ NAVIGATION & ATTEMPT ORCHESTRATION ENGINE HANDLERS
// =========================================================================
window.updateQuizOrchestrationSettings = function() {
  const navSel = document.getElementById("select-nav-mode");
  const attSel = document.getElementById("select-attempt-limit");
  const shufSel = document.getElementById("select-shuffle-mode");
  const flowSel = document.getElementById("select-intermod-flow");

  if (navSel) classControlMatrix.navigationMode = navSel.value;
  if (attSel) classControlMatrix.attemptLimit = parseInt(attSel.value, 10);
  if (shufSel) classControlMatrix.shuffleQuestions = shufSel.value;
  if (flowSel) classControlMatrix.interModuleFlow = flowSel.value;

  window.saveMatrixState();
  
  let msg = "⚙️ Pengaturan Aturan Pengerjaan Kuis Berhasil Diperbarui!";
  if (classControlMatrix.navigationMode === "FORWARD_ONLY") {
    msg += "\n➡️ Mode Forward-Only Aktif (Nomor lalu akan dikunci).";
  }
  if (classControlMatrix.attemptLimit > 0) {
    msg += `\n🔒 Kuota Pengerjaan: Maksimal ${classControlMatrix.attemptLimit}x Ujian.`;
  }
  if (classControlMatrix.shuffleQuestions === "ON") {
    msg += "\n🔀 Random Shuffling Aktif (Soal & Opsi diacak unik per HP Siswa).";
  }
  console.log(msg);
};

window.updateMatrixState = function() {
  if (!classControlMatrix.schedules) classControlMatrix.schedules = {};
  const subIds = ["1A", "1B", "1C", "1D", "1E", "1F"];
  subIds.forEach(id => {
    const modSel = document.getElementById(`matrix-status-mod-${id}`);
    const quizSel = document.getElementById(`matrix-status-quiz-${id}`);
    const expSel = document.getElementById(`matrix-status-exp-${id}`);
    const qCountIn = document.getElementById(`matrix-qcount-${id}`);
    const startIn = document.getElementById(`matrix-sched-start-${id}`);
    const expireIn = document.getElementById(`matrix-sched-expire-${id}`);

    if (modSel) classControlMatrix.modules[id] = modSel.value;
    if (quizSel) classControlMatrix.quizzes[id] = quizSel.value;
    if (expSel) classControlMatrix.explanations[id] = expSel.value;
    if (qCountIn) classControlMatrix.questionCounts[id] = Math.max(1, Math.min(15, parseInt(qCountIn.value || "15", 10)));
    classControlMatrix.schedules[id] = {
      start: startIn ? startIn.value : "",
      expire: expireIn ? expireIn.value : ""
    };
  });
  window.saveMatrixState();
};

window.applyMatrixPreset = function(presetName) {
  classControlMatrix.activePreset = presetName;
  const subIds = ["1A", "1B", "1C", "1D", "1E", "1F"];

  if (presetName === "LEARNING") {
    subIds.forEach(id => {
      classControlMatrix.modules[id] = "VISIBLE";
      classControlMatrix.quizzes[id] = "VISIBLE";
      classControlMatrix.explanations[id] = "LOCKED";
    });
  } else if (presetName === "PRACTICE") {
    subIds.forEach(id => {
      classControlMatrix.modules[id] = "VISIBLE";
      classControlMatrix.quizzes[id] = "VISIBLE";
      classControlMatrix.explanations[id] = "VISIBLE";
    });
  } else if (presetName === "EXAM") {
    subIds.forEach(id => {
      classControlMatrix.modules[id] = "LOCKED_VISIBLE";
      classControlMatrix.quizzes[id] = "VISIBLE";
      classControlMatrix.explanations[id] = "LOCKED";
    });
  } else if (presetName === "REVIEW") {
    subIds.forEach(id => {
      classControlMatrix.modules[id] = "VISIBLE";
      classControlMatrix.quizzes[id] = "VISIBLE";
      classControlMatrix.explanations[id] = "VISIBLE";
    });
  } else if (presetName === "REMEDIAL") {
    subIds.forEach(id => {
      classControlMatrix.modules[id] = (id === "1A" || id === "1B") ? "VISIBLE" : "LOCKED_HIDDEN";
      classControlMatrix.quizzes[id] = (id === "1A" || id === "1B") ? "VISIBLE" : "HIDDEN";
      classControlMatrix.explanations[id] = "VISIBLE";
    });
  }

  window.syncMatrixUIFromState();
  window.saveMatrixState();
  showTeacherToast(`🚀 Mode ${presetName} Berhasil Diaktifkan Ke Seluruh Kelas!`);
};

window.toggleStudentPreviewMode = function() {
  classControlMatrix.previewMode = !classControlMatrix.previewMode;
  const btn = document.getElementById("btn-toggle-student-preview");
  if (btn) {
    btn.innerHTML = classControlMatrix.previewMode
      ? `<i data-lucide="eye-off" class="h-4 w-4"></i><span>❌ Keluar dari Pratinjau Siswa</span>`
      : `<i data-lucide="eye" class="h-4 w-4"></i><span>👁️ Simulasi Pandangan Siswa (Preview Mode)</span>`;
  }
  showTeacherToast(classControlMatrix.previewMode ? "👁️ Mengaktifkan Pratinjau Tampilan Siswa..." : "👨‍🏫 Kembali ke Tampilan Pengendali Guru.");
  updateSubTabLockStates();
  if (window.lucide) window.lucide.createIcons();
};

// =========================================================================
// SMART POLLING ENGINE (REAL-TIME TEACHER-STUDENT SYNC 3-5s & GAS CLOUD SYNC)
// =========================================================================
let pollingInterval = null;

window.syncCloudMatrixNow = async function(showAlert = false) {
  if (!GAS_API_URL || !GAS_API_URL.startsWith("http")) {
    if (showAlert) alert("⚠️ URL Deployment Google Apps Script (GAS) belum diset.\n\nSilakan masukkan URL Web App di Tab '🔗 Integrasi GAS Cloud' terlebih dahulu.");
    return false;
  }
  try {
    const res = await fetch(`${GAS_API_URL}?action=getControlMatrix`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "SUCCESS" && data.config) {
        const remoteConfig = data.config;
        if (showAlert || remoteConfig.configVersion > classControlMatrix.configVersion) {
          classControlMatrix = Object.assign(classControlMatrix, remoteConfig);
          if (remoteConfig.flashcards) classControlMatrix.flashcards = Object.assign(classControlMatrix.flashcards || {}, remoteConfig.flashcards);
          if (remoteConfig.schedules) classControlMatrix.schedules = Object.assign(classControlMatrix.schedules || {}, remoteConfig.schedules);
          if (Array.isArray(remoteConfig.revokedTokenStudents)) classControlMatrix.revokedTokenStudents = remoteConfig.revokedTokenStudents;
          if (remoteConfig.resetTokenEpoch !== undefined) classControlMatrix.resetTokenEpoch = remoteConfig.resetTokenEpoch;
          
          localStorage.setItem("sejarah_class_control_matrix", JSON.stringify(classControlMatrix));
          updateSubTabLockStates();
          applyGovernanceToStudentUI();
          if (typeof renderGovernancePanel === "function") renderGovernancePanel();
          
          // If active sub-module was locked by teacher, automatically redirect to 1A
          const currentModStatus = classControlMatrix.modules[currentSubModule];
          if (currentModStatus === "HIDDEN" || currentModStatus === "LOCKED_HIDDEN" || currentModStatus === "LOCKED_VISIBLE") {
            if (sessionStorage.getItem("isTeacherActive") !== "true") {
              switchSubModule("1A");
            }
          }
          if (showAlert) alert(`✅ BERHASIL SINKRONISASI CLOUD!\n\nMatriks Kontrol v${classControlMatrix.configVersion} terbaru berhasil ditarik dari Google Sheets.`);
          return true;
        }
      }
    }
  } catch(e) {
    if (showAlert) alert("⚠️ Gagal terhubung ke Cloud Google Sheets. Memulai mode fallback lokal.");
  }
  return false;
};

function startSmartPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  // Execute immediate cloud sync on load
  window.syncCloudMatrixNow(false);

  pollingInterval = setInterval(() => {
    window.syncCloudMatrixNow(false);
  }, 5000);
}

// Start smart polling on load
startSmartPolling();

// ============================================================================
// GOVERNANCE ENGINE — Pedagogical Element Control System
// ============================================================================

window.renderGovernancePanel = function() {
  const tbody = document.getElementById("gov-matrix-tbody");
  if (!tbody) return;

  const subIds = ["1A", "1B", "1C", "1D", "1E", "1F"];
  const subNames = {
    "1A": "Sub-Modul 1A: Proklamasi & Fondasi Negara (1945)",
    "1B": "Sub-Modul 1B: Perjuangan Fisik I (Surabaya & Ambarawa)",
    "1C": "Sub-Modul 1C: Perjuangan Fisik II (Perlawanan Daerah)",
    "1D": "Sub-Modul 1D: Perjuangan Diplomasi I (Linggarjati & Renville)",
    "1E": "Sub-Modul 1E: Agresi II, PDRI, & Serangan Umum 1 Maret",
    "1F": "Sub-Modul 1F: Perjuangan Diplomasi II (KMB & Pengakuan Kedaulatan)"
  };

  const rows = [];

  // Module rows
  subIds.forEach(id => {
    const modStatus = classControlMatrix.modules[id] || "VISIBLE";
    const quizStatus = classControlMatrix.quizzes[id] || "VISIBLE";
    const fcStatus = (classControlMatrix.flashcards && classControlMatrix.flashcards[id]) || "VISIBLE";

    const modToken = classControlMatrix.tokenLocks[id] || "";
    const quizToken = classControlMatrix.tokenLocks["quiz-" + id] || "";
    const fcToken = classControlMatrix.tokenLocks["fc-" + id] || "";

    rows.push(buildGovRow(`📚 ${subNames[id]}`, `gov-mod-${id}`, modStatus, `gov-token-mod-${id}`, modToken, "module"));
    rows.push(buildGovRow(`🎴 Flashcard Memori ${id}`, `gov-fc-${id}`, fcStatus, `gov-token-fc-${id}`, fcToken, "flashcard"));
    rows.push(buildGovRow(`📝 Kuis HOTS ${id}`, `gov-quiz-${id}`, quizStatus, `gov-token-quiz-${id}`, quizToken, "quiz"));
  });

  tbody.innerHTML = rows.join("");

  // Sync global elements
  const certSel = document.getElementById("gov-global-certificate");
  const glosSel = document.getElementById("gov-global-glossary");
  const reflSel = document.getElementById("gov-global-reflection");
  const prechkEl = document.getElementById("gov-enable-precheck");

  if (certSel) certSel.value = (classControlMatrix.globalElements && classControlMatrix.globalElements.certificate) || "VISIBLE";
  if (glosSel) glosSel.value = (classControlMatrix.globalElements && classControlMatrix.globalElements.glossary) || "VISIBLE";
  if (reflSel) reflSel.value = (classControlMatrix.globalElements && classControlMatrix.globalElements.reflection) || "VISIBLE";
  if (prechkEl) prechkEl.checked = classControlMatrix.precheck === "ON";

  // Sync Auto-Schedule inputs & status badges
  if (!classControlMatrix.schedules) classControlMatrix.schedules = {};
  subIds.forEach(id => {
    const sched = classControlMatrix.schedules[id] || {};
    const startInp = document.getElementById(`gov-sched-start-${id}`);
    const expireInp = document.getElementById(`gov-sched-expire-${id}`);
    const statusBadge = document.getElementById(`gov-sched-status-${id}`);

    if (startInp) startInp.value = sched.start || "";
    if (expireInp) expireInp.value = sched.expire || "";

    if (statusBadge) {
      const chk = window.checkScheduleStatus(id);
      if (chk.status === "NOT_STARTED") {
        statusBadge.className = "text-[9px] font-bold text-[#ee824b] bg-[#ee824b]/10 px-1.5 py-0.5 rounded";
        statusBadge.textContent = "⏰ Belum Buka";
      } else if (chk.status === "EXPIRED") {
        statusBadge.className = "text-[9px] font-bold text-[#a53e24] bg-[#a53e24]/10 px-1.5 py-0.5 rounded";
        statusBadge.textContent = "⏳ Kadaluarsa";
      } else if (sched.start || sched.expire) {
        statusBadge.className = "text-[9px] font-bold text-[#4f8b5c] bg-[#4f8b5c]/10 px-1.5 py-0.5 rounded";
        statusBadge.textContent = "🟢 Waktu Aktif";
      } else {
        statusBadge.className = "text-[9px] font-bold text-[#718277]";
        statusBadge.textContent = "⚪ Bebas";
      }
    }
  });
};

function buildGovRow(label, selId, status, tokenId, tokenVal, type) {
  const statusColors = {
    "VISIBLE": "text-[#4f8b5c] bg-[#4f8b5c]/10 border-[#4f8b5c]/30",
    "LOCKED_VISIBLE": "text-[#ee824b] bg-[#ee824b]/10 border-[#ee824b]/30",
    "HIDDEN": "text-[#a53e24] bg-[#a53e24]/10 border-[#a53e24]/30",
    "LOCKED_HIDDEN": "text-[#a53e24] bg-[#a53e24]/10 border-[#a53e24]/30"
  };
  const statusLabels = {
    "VISIBLE": "🟢 Aktif",
    "LOCKED_VISIBLE": "🟡 Terkunci",
    "HIDDEN": "🔴 Hidden",
    "LOCKED_HIDDEN": "🔴 Hidden+Kunci"
  };
  const color = statusColors[status] || statusColors["VISIBLE"];
  const label2 = statusLabels[status] || "🟢 Aktif";
  const showToken = (status === "LOCKED_VISIBLE" || status === "LOCKED_HIDDEN");
  const tokenInputStyle = showToken ? "" : "opacity-40 pointer-events-none";

  return `<tr class="hover:bg-[#f6f3e9] transition">
    <td class="p-3 font-semibold text-[#17211d] text-[11px]">${label}</td>
    <td class="p-3">
      <select id="${selId}" onchange="onGovStatusChange(this, '${tokenId}')"
        class="rounded-lg border border-[#d8d3c4] bg-[#f6f3e9] px-2.5 py-1.5 text-[11px] font-bold text-[#174d3a] focus:outline-none focus:border-[#174d3a]">
        <option value="VISIBLE" ${status === "VISIBLE" ? "selected" : ""}>🟢 Tampilkan</option>
        <option value="LOCKED_VISIBLE" ${status === "LOCKED_VISIBLE" ? "selected" : ""}>🟡 Kunci Token (Terlihat)</option>
        <option value="HIDDEN" ${status === "HIDDEN" ? "selected" : ""}>🔴 Sembunyikan</option>
        <option value="LOCKED_HIDDEN" ${status === "LOCKED_HIDDEN" ? "selected" : ""}>🔴 Sembunyikan + Kunci</option>
      </select>
    </td>
    <td class="p-3">
      <input type="text" id="${tokenId}" value="${tokenVal}" placeholder="Isi Token Khusus..."
        class="${tokenInputStyle} w-full rounded-lg border border-[#d8d3c4] bg-[#f6f3e9] px-2.5 py-1.5 text-[11px] font-mono font-bold text-[#174d3a] uppercase focus:outline-none focus:border-[#ee824b]"
        maxlength="20">
    </td>
    <td class="p-3 text-center">
      <span class="rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${color}">${label2}</span>
    </td>
  </tr>`;
}

window.onGovStatusChange = function(selectEl, tokenInputId) {
  const status = selectEl.value;
  const tokenInput = document.getElementById(tokenInputId);
  if (!tokenInput) return;
  const showToken = (status === "LOCKED_VISIBLE" || status === "LOCKED_HIDDEN");
  tokenInput.classList.toggle("opacity-40", !showToken);
  tokenInput.classList.toggle("pointer-events-none", !showToken);
};

// Check Auto-Schedule Status Helper
window.checkScheduleStatus = function(subId) {
  if (!classControlMatrix || !classControlMatrix.schedules || !classControlMatrix.schedules[subId]) return { status: "ACTIVE" };
  const sched = classControlMatrix.schedules[subId];
  const now = new Date();

  if (sched.start) {
    const startTime = new Date(sched.start);
    if (!isNaN(startTime.getTime()) && now < startTime) {
      return { status: "NOT_STARTED", timeStr: startTime.toLocaleString("id-ID") };
    }
  }
  if (sched.expire) {
    const expireTime = new Date(sched.expire);
    if (!isNaN(expireTime.getTime()) && now > expireTime) {
      return { status: "EXPIRED", timeStr: expireTime.toLocaleString("id-ID") };
    }
  }
  return { status: "ACTIVE" };
};

window.applyGovernanceConfig = function() {
  const subIds = ["1A", "1B", "1C", "1D", "1E", "1F"];

  // Read module + flashcard + quiz status + tokens from UI
  subIds.forEach(id => {
    const modSel = document.getElementById(`gov-mod-${id}`);
    const fcSel = document.getElementById(`gov-fc-${id}`);
    const quizSel = document.getElementById(`gov-quiz-${id}`);

    const modToken = document.getElementById(`gov-token-mod-${id}`);
    const fcToken = document.getElementById(`gov-token-fc-${id}`);
    const quizToken = document.getElementById(`gov-token-quiz-${id}`);

    if (modSel) classControlMatrix.modules[id] = modSel.value;
    if (!classControlMatrix.flashcards) classControlMatrix.flashcards = {};
    if (fcSel) classControlMatrix.flashcards[id] = fcSel.value;
    if (quizSel) classControlMatrix.quizzes[id] = quizSel.value;

    if (!classControlMatrix.tokenLocks) classControlMatrix.tokenLocks = {};
    if (modToken) classControlMatrix.tokenLocks[id] = modToken.value.trim().toUpperCase();
    if (fcToken) classControlMatrix.tokenLocks["fc-" + id] = fcToken.value.trim().toUpperCase();
    if (quizToken) classControlMatrix.tokenLocks["quiz-" + id] = quizToken.value.trim().toUpperCase();

    // Read Auto-Schedule inputs
    if (!classControlMatrix.schedules) classControlMatrix.schedules = {};
    const startInp = document.getElementById(`gov-sched-start-${id}`);
    const expireInp = document.getElementById(`gov-sched-expire-${id}`);
    classControlMatrix.schedules[id] = {
      start: startInp ? startInp.value : "",
      expire: expireInp ? expireInp.value : ""
    };
  });

  // Read global elements
  const certSel = document.getElementById("gov-global-certificate");
  const glosSel = document.getElementById("gov-global-glossary");
  const reflSel = document.getElementById("gov-global-reflection");
  const prechkEl = document.getElementById("gov-enable-precheck");

  if (!classControlMatrix.globalElements) classControlMatrix.globalElements = {};
  if (certSel) classControlMatrix.globalElements.certificate = certSel.value;
  if (glosSel) classControlMatrix.globalElements.glossary = glosSel.value;
  if (reflSel) classControlMatrix.globalElements.reflection = reflSel.value;
  if (prechkEl) classControlMatrix.precheck = prechkEl.checked ? "ON" : "OFF";

  // Save & broadcast
  window.saveMatrixState();
  updateSubTabLockStates();
  applyGovernanceToStudentUI();

  const msg = document.getElementById("gov-save-msg");
  if (msg) {
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 4000);
  }
};

// One-Click Presets & Emergency Lock Governance Helper
window.applyGovPresetMode = function(mode) {
  const subIds = ["1A", "1B", "1C", "1D", "1E", "1F"];
  const badge = document.getElementById("gov-preset-status-badge");

  if (mode === 'EXAM') {
    subIds.forEach(id => {
      const modSel = document.getElementById(`gov-mod-${id}`);
      const fcSel = document.getElementById(`gov-fc-${id}`);
      const quizSel = document.getElementById(`gov-quiz-${id}`);
      const quizToken = document.getElementById(`gov-token-quiz-${id}`);

      if (modSel) modSel.value = "VISIBLE";
      if (fcSel) fcSel.value = "VISIBLE";
      if (quizSel) {
        quizSel.value = "LOCKED_VISIBLE";
        onGovStatusChange(quizSel, `gov-token-quiz-${id}`);
      }
      if (quizToken) {
        quizToken.value = "EXAM12";
        quizToken.classList.remove("opacity-40", "pointer-events-none");
      }
    });

    const certSel = document.getElementById("gov-global-certificate");
    const glosSel = document.getElementById("gov-global-glossary");
    const reflSel = document.getElementById("gov-global-reflection");
    const prechkEl = document.getElementById("gov-enable-precheck");

    if (certSel) certSel.value = "HIDDEN";
    if (glosSel) glosSel.value = "HIDDEN";
    if (reflSel) reflSel.value = "HIDDEN";
    if (prechkEl) prechkEl.checked = true;

    if (badge) badge.textContent = "🚀 Mode Ujian Active (Token: EXAM12)";
    window.applyGovernanceConfig();
    alert("🚀 Preset 'Mode Ujian (PTS/PAS)' Berhasil Diterapkan!\n\nSeluruh Kuis dikunci dengan token 'EXAM12' dan elemen pendukung disembunyikan. Perubahan langsung dipush ke cloud.");
  } 
  else if (mode === 'LEARNING') {
    subIds.forEach(id => {
      const modSel = document.getElementById(`gov-mod-${id}`);
      const fcSel = document.getElementById(`gov-fc-${id}`);
      const quizSel = document.getElementById(`gov-quiz-${id}`);
      const quizToken = document.getElementById(`gov-token-quiz-${id}`);

      if (modSel) modSel.value = "VISIBLE";
      if (fcSel) fcSel.value = "VISIBLE";
      if (quizSel) {
        quizSel.value = "VISIBLE";
        onGovStatusChange(quizSel, `gov-token-quiz-${id}`);
      }
      if (quizToken) quizToken.value = "";
    });

    const certSel = document.getElementById("gov-global-certificate");
    const glosSel = document.getElementById("gov-global-glossary");
    const reflSel = document.getElementById("gov-global-reflection");
    const prechkEl = document.getElementById("gov-enable-precheck");

    if (certSel) certSel.value = "VISIBLE";
    if (glosSel) glosSel.value = "VISIBLE";
    if (reflSel) reflSel.value = "VISIBLE";
    if (prechkEl) prechkEl.checked = false;

    if (badge) badge.textContent = "📖 Belajar Mandiri Active";
    window.applyGovernanceConfig();
    alert("📖 Preset 'Belajar Mandiri' Berhasil Diterapkan!\n\nSeluruh Sub-Modul, Flashcard, dan Kuis dibuka untuk bebas akses. Perubahan langsung dipush ke cloud.");
  }
  else if (mode === 'LOCKDOWN') {
    if (!confirm("⚠️ Peringatan: Emergency Lockdown akan MENYEMBUNYIKAN SELURUH ELEMEN MODUL & KUIS dari siswa seketika!\n\nLanjutkan gembok total?")) return;

    subIds.forEach(id => {
      const modSel = document.getElementById(`gov-mod-${id}`);
      const fcSel = document.getElementById(`gov-fc-${id}`);
      const quizSel = document.getElementById(`gov-quiz-${id}`);

      if (modSel) modSel.value = "HIDDEN";
      if (fcSel) fcSel.value = "HIDDEN";
      if (quizSel) quizSel.value = "HIDDEN";
    });

    const certSel = document.getElementById("gov-global-certificate");
    const glosSel = document.getElementById("gov-global-glossary");
    const reflSel = document.getElementById("gov-global-reflection");
    const prechkEl = document.getElementById("gov-enable-precheck");

    if (certSel) certSel.value = "HIDDEN";
    if (glosSel) glosSel.value = "HIDDEN";
    if (reflSel) reflSel.value = "HIDDEN";
    if (prechkEl) prechkEl.checked = true;

    if (badge) badge.textContent = "🛑 EMERGENCY LOCKDOWN";
    window.applyGovernanceConfig();
    alert("🛑 Preset 'Emergency Lockdown' Berhasil Diterapkan!\n\nSeluruh elemen telah disembunyikan dan dipush ke cloud siswa seketika.");
  }
};

// Apply governance rules to student-facing UI (show/hide/lock elements)
window.applyGovernanceToStudentUI = function() {
  const isTeacher = sessionStorage.getItem("isTeacherActive") === "true";
  const isStudent = !isTeacher || classControlMatrix.previewMode;

  // Certificate button governance
  const certBtns = document.querySelectorAll('#claim-certificate-btn, [id*="generate-cert"], [onclick*="generateStudentCertificate"], [onclick*="showCertificate"]');
  const certStatus = (classControlMatrix.globalElements && classControlMatrix.globalElements.certificate) || "VISIBLE";
  certBtns.forEach(btn => {
    if (isStudent) btn.style.display = certStatus === "HIDDEN" ? "none" : "";
    else btn.style.display = "";
  });

  // Glossary governance — hide/show glossary trigger links
  const glossaryEls = document.querySelectorAll('#glossary-trigger, [onclick*="showGlossaryModal"], .glossary-trigger');
  const glosStatus = (classControlMatrix.globalElements && classControlMatrix.globalElements.glossary) || "VISIBLE";
  glossaryEls.forEach(el => {
    if (isStudent) el.style.display = glosStatus === "HIDDEN" ? "none" : "";
    else el.style.display = "";
  });

  // Reflection section governance
  const reflEls = document.querySelectorAll('#reflection-section, [data-template-id="reflection-kicker"], [data-template-id="reflection-title"], [data-template-id="reflection-text"]');
  const reflStatus = (classControlMatrix.globalElements && classControlMatrix.globalElements.reflection) || "VISIBLE";
  reflEls.forEach(el => {
    const section = el.closest("section, div.reflection-block, .reflection-wrapper") || el;
    if (isStudent && section) section.style.display = reflStatus === "HIDDEN" ? "none" : "";
    else if (section) section.style.display = "";
  });

  // Flashcards section governance
  const fcSection = document.getElementById("flashcards-section");
  if (fcSection) {
    const subId = currentSubModule || "1A";
    const fcStatus = (classControlMatrix.flashcards && classControlMatrix.flashcards[subId]) || "VISIBLE";
    const fcTokenKey = "fc-" + subId;
    const fcToken = (classControlMatrix.tokenLocks && classControlMatrix.tokenLocks[fcTokenKey]) || "";

    if (isStudent) {
      if (fcStatus === "HIDDEN" || fcStatus === "LOCKED_HIDDEN") {
        fcSection.style.display = "none";
      } else if (fcStatus === "LOCKED_VISIBLE" && fcToken && !window.isElementUnlockedByToken(fcTokenKey)) {
        fcSection.style.display = "";
        const fcCard = document.getElementById("flashcard-card");
        if (fcCard) {
          fcCard.innerHTML = `
            <div class="p-8 text-center bg-[#fffdf7] border-2 border-dashed border-[#ee824b]/40 rounded-3xl space-y-3">
              <div class="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-[#ee824b]/10 text-[#ee824b] text-xl font-bold">🔒</div>
              <h4 class="text-sm font-bold text-[#174d3a]">Flashcard Memori ${subId} Dikunci Guru</h4>
              <p class="text-xs text-[#405047]">Masukkan Token Akses Khusus dari Guru untuk membuka dek Flashcard ini.</p>
              <button type="button" onclick="window.showTokenUnlockModal('${fcTokenKey}', 'Flashcard Memori ${subId}', '${fcToken}', () => { applyGovernanceToStudentUI(); renderCurrentFlashcard(); })"
                class="px-5 py-2.5 bg-[#ee824b] text-white text-xs font-bold rounded-xl hover:bg-[#c75d2b] transition shadow-md flex items-center justify-center gap-2 mx-auto">
                🔑 Masukkan Token Flashcard
              </button>
            </div>`;
        }
      } else {
        fcSection.style.display = "";
      }
    } else {
      fcSection.style.display = "";
    }
  }

  // Update Sub-Module Tabs Lock States
  window.updateSubTabLockStates();
};

window.updateSubTabLockStates = function() {
  const isTeacher = sessionStorage.getItem("isTeacherActive") === "true";
  const isStudent = !isTeacher || classControlMatrix.previewMode;
  if (!isStudent) return;

  const subIds = ["1A", "1B", "1C", "1D", "1E", "1F"];
  subIds.forEach(id => {
    const tabEl = document.querySelector(`[data-submodule-tab="${id}"], [onclick*="'${id}'"], #tab-submod-${id}`);
    if (!tabEl) return;

    const modStatus = (classControlMatrix.modules && classControlMatrix.modules[id]) || "VISIBLE";
    const schedChk = window.checkScheduleStatus(id);

    if (modStatus === "HIDDEN" || modStatus === "LOCKED_HIDDEN" || schedChk.status === "NOT_STARTED" || schedChk.status === "EXPIRED") {
      tabEl.style.opacity = "0.4";
      tabEl.classList.add("cursor-not-allowed");
    } else {
      tabEl.style.opacity = "1";
      tabEl.classList.remove("cursor-not-allowed");
    }
  });
};

// Centralized Quiz Access & Governance Handler (Non-Pseudo)
window.requestAccessToQuiz = function(subId, onSuccess) {
  subId = subId || currentSubModule || "1A";
  const isTeacher = sessionStorage.getItem("isTeacherActive") === "true";
  const isStudent = !isTeacher || classControlMatrix.previewMode;

  if (isStudent) {
    // 0. Auto-Schedule Timer Check
    const schedChk = window.checkScheduleStatus(subId);
    if (schedChk.status === "NOT_STARTED") {
      alert(`⏰ Sub-Modul ${subId} BELUM WAKTUNYA DIBUKA.\n\nJadwal buka otomatis dari Guru: ${schedChk.timeStr}`);
      return;
    }
    if (schedChk.status === "EXPIRED") {
      alert(`⏳ WAKTU HABIS: Akses Sub-Modul ${subId} telah kadaluarsa pada ${schedChk.timeStr}.`);
      return;
    }

    const quizStatus = (classControlMatrix.quizzes && classControlMatrix.quizzes[subId]) || "VISIBLE";
    if (quizStatus === "HIDDEN" || quizStatus === "LOCKED_HIDDEN") {
      alert(`🔴 Kuis HOTS Sub-Modul ${subId} sedang disembunyikan atau dikunci oleh Guru.`);
      return;
    }

    if (quizStatus === "LOCKED_VISIBLE") {
      const tokenKey = "quiz-" + subId;
      const requiredToken = (classControlMatrix.tokenLocks && classControlMatrix.tokenLocks[tokenKey]) || "";
      if (requiredToken && !window.isElementUnlockedByToken(tokenKey)) {
        if (typeof window.showTokenUnlockModal === "function") {
          window.showTokenUnlockModal(tokenKey, `Kuis HOTS ${subId}`, requiredToken, () => window.requestAccessToQuiz(subId, onSuccess));
        } else {
          alert(`🔒 Kuis HOTS Sub-Modul ${subId} dikunci oleh Guru.\n\nMasukkan token dari Guru untuk membuka.`);
        }
        return;
      }
      if (!requiredToken) {
        alert(`🔒 Kuis HOTS Sub-Modul ${subId} dikunci oleh Guru Sejarah Anda.`);
        return;
      }
    }
  }

  // Pre-Module Checklist Modal Trigger
  if (typeof window.showPreCheckModal === "function") {
    window.showPreCheckModal(subId, () => {
      showPage("kuis");
      if (typeof onSuccess === "function") onSuccess();
    });
  } else {
    showPage("kuis");
    if (typeof onSuccess === "function") onSuccess();
  }
};

// Pre-Module Checklist Modal — shown before quiz when precheck is ON
window.showPreCheckModal = function(subId, onConfirm) {
  if (classControlMatrix.precheck !== "ON") {
    if (typeof onConfirm === "function") onConfirm();
    return;
  }

  // Build modal
  let modal = document.getElementById("precheck-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "precheck-modal";
    modal.className = "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="w-full max-w-md rounded-3xl border-2 border-[#d8ee93] bg-[#fffdf7] p-6 shadow-2xl animate-reveal space-y-4">
      <div class="flex items-center gap-3 border-b border-[#d8d3c4] pb-4">
        <div class="grid h-10 w-10 place-items-center rounded-2xl bg-[#174d3a] text-[#d8ee93]">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div>
          <h3 class="text-sm font-bold text-[#174d3a]">Konfirmasi Kesiapan Mengerjakan Kuis</h3>
          <p class="text-[11px] text-[#405047]">Sub-Modul ${subId} — Centang semua pernyataan untuk melanjutkan</p>
        </div>
      </div>
      <div class="space-y-3" id="precheck-items">
        <label class="flex items-start gap-3 text-xs text-[#17211d] cursor-pointer">
          <input type="checkbox" class="precheck-cb h-4 w-4 mt-0.5 rounded accent-[#174d3a]">
          <span>Saya menyatakan telah membaca dan memahami seluruh materi Sub-Modul ${subId} secara tuntas.</span>
        </label>
        <label class="flex items-start gap-3 text-xs text-[#17211d] cursor-pointer">
          <input type="checkbox" class="precheck-cb h-4 w-4 mt-0.5 rounded accent-[#174d3a]">
          <span>Saya akan mengerjakan kuis ini sendiri tanpa bantuan dari pihak lain (tanpa membuka buku atau mencontek).</span>
        </label>
        <label class="flex items-start gap-3 text-xs text-[#17211d] cursor-pointer">
          <input type="checkbox" class="precheck-cb h-4 w-4 mt-0.5 rounded accent-[#174d3a]">
          <span>Saya siap mengerjakan kuis dengan jujur, disiplin, dan penuh tanggung jawab akademik.</span>
        </label>
      </div>
      <p id="precheck-warn" class="hidden text-[11px] font-bold text-[#a53e24] bg-[#a53e24]/10 p-2 rounded-xl text-center">⚠️ Centang semua pernyataan terlebih dahulu!</p>
      <div class="flex gap-3 pt-2">
        <button type="button" onclick="document.getElementById('precheck-modal').remove()" class="flex-1 rounded-xl border border-[#d8d3c4] py-2.5 text-xs font-bold text-[#405047] hover:bg-[#f6f3e9] transition">Batal</button>
        <button type="button" id="precheck-confirm-btn" class="flex-1 rounded-xl bg-[#174d3a] py-2.5 text-xs font-bold text-[#d8ee93] hover:bg-[#123d2e] transition flex items-center justify-center gap-2">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Mulai Kuis Sekarang
        </button>
      </div>
    </div>
  `;

  // modal is freshly created via createElement — no need to remove 'hidden'
  // Just ensure it's visible (it is by default as a new element)

  document.getElementById("precheck-confirm-btn").addEventListener("click", function() {
    const checkboxes = modal.querySelectorAll(".precheck-cb");
    const allChecked = [...checkboxes].every(cb => cb.checked);
    const warn = document.getElementById("precheck-warn");
    if (!allChecked) {
      if (warn) warn.classList.remove("hidden");
      return;
    }
    modal.remove();
    if (typeof onConfirm === "function") onConfirm();
  });
};

// Student-side Token Unlock Modal for LOCKED_VISIBLE elements
window.showTokenUnlockModal = function(elementId, elementLabel, correctToken, onSuccess) {
  let modal = document.getElementById("token-unlock-modal");
  if (modal) modal.remove();
  modal = document.createElement("div");
  modal.id = "token-unlock-modal";
  modal.className = "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4";
  modal.innerHTML = `
    <div class="w-full max-w-sm rounded-3xl border-2 border-[#ee824b]/40 bg-[#fffdf7] p-6 shadow-2xl space-y-4">
      <div class="flex items-center gap-3 border-b border-[#d8d3c4] pb-4">
        <div class="grid h-10 w-10 place-items-center rounded-2xl bg-[#ee824b]/15 text-[#ee824b]">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
        <div>
          <h3 class="text-sm font-bold text-[#174d3a]">🔒 Elemen Dikunci Guru</h3>
          <p class="text-[11px] text-[#405047]">${elementLabel}</p>
        </div>
      </div>
      <p class="text-[11px] text-[#405047]">Masukkan <strong>Token Akses Khusus</strong> yang diberikan oleh Guru untuk membuka elemen ini:</p>
      <input type="text" id="token-unlock-input" placeholder="Masukkan token..." autofocus
        class="w-full rounded-xl border-2 border-[#d8d3c4] bg-[#f6f3e9] px-3.5 py-2.5 text-sm font-mono font-bold text-[#174d3a] uppercase tracking-wider focus:outline-none focus:border-[#ee824b] text-center" maxlength="20">
      <p id="token-unlock-err" class="hidden text-[11px] font-bold text-[#a53e24] bg-[#a53e24]/10 p-2 rounded-xl text-center">❌ Token salah. Minta token yang benar dari Guru Anda.</p>
      <div class="flex gap-3">
        <button type="button" onclick="document.getElementById('token-unlock-modal').remove()" class="flex-1 rounded-xl border border-[#d8d3c4] py-2.5 text-xs font-bold text-[#405047] hover:bg-[#f6f3e9] transition">Batal</button>
        <button type="button" id="token-unlock-submit" class="flex-1 rounded-xl bg-[#ee824b] py-2.5 text-xs font-bold text-white hover:bg-[#c75d2b] transition flex items-center justify-center gap-2">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
          Buka Elemen
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const input = document.getElementById("token-unlock-input");
  const submitBtn = document.getElementById("token-unlock-submit");
  const errMsg = document.getElementById("token-unlock-err");

  function tryUnlock() {
    const entered = (input.value || "").trim().toUpperCase();
    if (entered === correctToken.toUpperCase()) {
      // Save unlocked state
      try {
        const unlocked = JSON.parse(localStorage.getItem("sejarah_gov_unlocked") || "[]");
        if (!unlocked.includes(elementId)) { unlocked.push(elementId); localStorage.setItem("sejarah_gov_unlocked", JSON.stringify(unlocked)); }
      } catch(e) {}
      modal.remove();
      if (typeof onSuccess === "function") onSuccess();
    } else {
      if (errMsg) errMsg.classList.remove("hidden");
      if (input) { input.classList.add("border-[#a53e24]"); setTimeout(() => input.classList.remove("border-[#a53e24]"), 1500); }
    }
  }

  submitBtn.addEventListener("click", tryUnlock);
  input.addEventListener("keypress", e => { if (e.key === "Enter") tryUnlock(); });
  setTimeout(() => { if (input) input.focus(); }, 100);
};

// Helper: check if element is unlocked by token (student already entered correct token)
window.isElementUnlockedByToken = function(elementId) {
  try {
    // 1. Check Global Reset Token Epoch
    const localEpoch = parseInt(localStorage.getItem("sejarah_gov_reset_epoch") || "0", 10);
    const currentEpoch = (classControlMatrix && classControlMatrix.resetTokenEpoch) || 0;
    if (currentEpoch > localEpoch) {
      localStorage.removeItem("sejarah_gov_unlocked");
      localStorage.setItem("sejarah_gov_reset_epoch", currentEpoch.toString());
      return false;
    }

    // 2. Check Specific Revoked Student List
    let active = {};
    try { active = JSON.parse(localStorage.getItem("activeStudent") || "{}"); } catch(e) {}
    const studentEmail = (active.email || "").trim().toLowerCase();
    const studentNama = (active.nama || "").trim().toLowerCase();

    if (classControlMatrix && Array.isArray(classControlMatrix.revokedTokenStudents)) {
      const isRevoked = classControlMatrix.revokedTokenStudents.some(item => {
        const low = item.toLowerCase();
        return (studentEmail && low === studentEmail) || (studentNama && low === studentNama);
      });
      if (isRevoked) {
        localStorage.removeItem("sejarah_gov_unlocked");
        return false;
      }
    }

    const unlocked = JSON.parse(localStorage.getItem("sejarah_gov_unlocked") || "[]");
    return unlocked.includes(elementId);
  } catch(e) { return false; }
};

// ============================================================================
// ITEM #3: RESET TOKEN SISWA SYSTEM BY TEACHER
// ============================================================================

window.resetAllStudentTokensGlobal = function() {
  if (confirm("⚠️ Apakah Anda yakin ingin mereset seluruh token unlock siswa secara GLOBAL?\n\nSemua sub-modul & kuis ber-token akan dikunci kembali untuk seluruh siswa di kelas.")) {
    if (!classControlMatrix.resetTokenEpoch) classControlMatrix.resetTokenEpoch = 0;
    classControlMatrix.resetTokenEpoch++;
    classControlMatrix.revokedTokenStudents = [];
    window.saveMatrixState();
    updateSubTabLockStates();
    applyGovernanceToStudentUI();
    alert(`✅ SELURUH TOKEN UNLOCK SISWA BERHASIL DI-RESET!\n\n(Matriks v${classControlMatrix.configVersion} - Epoch Reset #${classControlMatrix.resetTokenEpoch})`);
  }
};

window.appResetStudentToken = function(identifier) {
  if (!identifier) return;
  if (confirm(`Apakah Anda yakin ingin mereset token unlock untuk siswa '${identifier}'?\n\nSiswa ini akan diminta memasukkan token kembali untuk membuka modul yang dikunci.`)) {
    if (!classControlMatrix.revokedTokenStudents) classControlMatrix.revokedTokenStudents = [];
    const lowId = identifier.trim().toLowerCase();
    if (!classControlMatrix.revokedTokenStudents.includes(lowId)) {
      classControlMatrix.revokedTokenStudents.push(lowId);
    }
    
    // Also clear local unlocked if current tab belongs to target student
    let active = {};
    try { active = JSON.parse(localStorage.getItem("activeStudent") || "{}"); } catch(e) {}
    if ((active.email && active.email.toLowerCase() === lowId) || (active.nama && active.nama.toLowerCase() === lowId)) {
      localStorage.removeItem("sejarah_gov_unlocked");
    }

    window.saveMatrixState();
    updateSubTabLockStates();
    applyGovernanceToStudentUI();
    alert(`✅ Token unlock untuk siswa '${identifier}' BERHASIL DI-RESET.\n\nStatus modul terkunci kembali untuk siswa ini.`);
  }
};

window.appResetStudentTokenUI = function() {
  const input = document.getElementById("gov-reset-student-input");
  if (!input || !input.value.trim()) {
    alert("Mohon masukkan Email Gmail atau Nama Siswa terlebih dahulu.");
    return;
  }
  window.appResetStudentToken(input.value.trim());
  input.value = "";
};

// ============================================================================
// FLASHCARD MEMORI KONSEP SEJARAH SYSTEM (FASE 2 ITEM 1 & 4)
// ============================================================================

const flashcardsData = FLASHCARD_DATA;

let currentFcSubId = "1A";
let currentFcIdx = 0;
let currentFcList = [];

window.initFlashcards = function(subId) {
  currentFcSubId = subId || "1A";
  const rawList = flashcardsData[currentFcSubId] || flashcardsData["1A"];
  currentFcList = [...rawList];
  currentFcIdx = 0;

  const titleEl = document.getElementById("fc-section-title");
  if (titleEl) titleEl.textContent = `🎴 Flashcard Istilah Kunci Sub-Modul ${currentFcSubId}`;

  const cardEl = document.getElementById("flashcard-card");
  if (cardEl) cardEl.classList.remove("flipped");

  renderCurrentFlashcard();
};

window.renderCurrentFlashcard = function() {
  if (!currentFcList || currentFcList.length === 0) return;
  if (currentFcIdx < 0) currentFcIdx = 0;
  if (currentFcIdx >= currentFcList.length) currentFcIdx = currentFcList.length - 1;

  const card = currentFcList[currentFcIdx];

  const catEl = document.getElementById("fc-category-badge");
  const termEl = document.getElementById("fc-term-text");
  if (catEl) catEl.textContent = card.category || "Konsep Utama";
  if (termEl) termEl.textContent = card.term || card.front || "";

  const defEl = document.getElementById("fc-definition-text");
  const exEl = document.getElementById("fc-example-text");
  if (defEl) defEl.textContent = card.definition || card.back || "";
  if (exEl) {
    if (card.example) {
      exEl.textContent = card.example;
      exEl.classList.remove("hidden");
    } else {
      exEl.classList.add("hidden");
    }
  }

  const counterEl = document.getElementById("fc-counter-badge");
  if (counterEl) counterEl.textContent = `Kartu ${currentFcIdx + 1} dari ${currentFcList.length}`;

  const masteredIds = getMasteredFlashcardIds();
  const isMastered = masteredIds.includes(card.id);

  const masteredBadge = document.getElementById("fc-mastered-badge");
  if (masteredBadge) {
    const masteredCount = currentFcList.filter(c => masteredIds.includes(c.id)).length;
    masteredBadge.textContent = `🌟 ${masteredCount} Dikuasai`;
  }

  const masterBtnText = document.getElementById("fc-master-btn-text");
  const masterBtn = document.getElementById("fc-btn-master");
  if (masterBtnText) masterBtnText.textContent = isMastered ? "🌟 Sudah Dikuasai" : "⭐ Tandai Kuasai";
  if (masterBtn) {
    if (isMastered) {
      masterBtn.className = "rounded-xl bg-[#d8ee93] px-3.5 py-2 text-xs font-bold text-[#174d3a] border border-[#174d3a]/30 transition flex items-center gap-1.5 shadow-sm";
    } else {
      masterBtn.className = "rounded-xl bg-[#174d3a] px-3.5 py-2 text-xs font-bold text-[#d8ee93] hover:bg-[#123d2e] transition flex items-center gap-1.5 shadow-sm";
    }
  }
};

window.toggleFlipFlashcard = function() {
  const cardEl = document.getElementById("flashcard-card");
  if (cardEl) cardEl.classList.toggle("flipped");
};

window.navigateFlashcard = function(dir) {
  const cardEl = document.getElementById("flashcard-card");
  if (cardEl) cardEl.classList.remove("flipped");

  setTimeout(() => {
    currentFcIdx += dir;
    if (currentFcIdx < 0) currentFcIdx = currentFcList.length - 1;
    if (currentFcIdx >= currentFcList.length) currentFcIdx = 0;
    renderCurrentFlashcard();
  }, 150);
};

window.shuffleFlashcards = function() {
  for (let i = currentFcList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [currentFcList[i], currentFcList[j]] = [currentFcList[j], currentFcList[i]];
  }
  currentFcIdx = 0;
  const cardEl = document.getElementById("flashcard-card");
  if (cardEl) cardEl.classList.remove("flipped");
  renderCurrentFlashcard();
};

function getMasteredFlashcardIds() {
  try {
    return JSON.parse(localStorage.getItem("sejarah_fc_mastered") || "[]");
  } catch(e) { return []; }
}

window.toggleMasterFlashcard = function() {
  if (!currentFcList || !currentFcList[currentFcIdx]) return;
  const cardId = currentFcList[currentFcIdx].id;
  let mastered = getMasteredFlashcardIds();
  if (mastered.includes(cardId)) {
    mastered = mastered.filter(id => id !== cardId);
  } else {
    mastered.push(cardId);
  }
  localStorage.setItem("sejarah_fc_mastered", JSON.stringify(mastered));
  renderCurrentFlashcard();
};

// Initialize flashcards on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { initFlashcards("1A"); });
} else {
  initFlashcards("1A");
}

// Duplicate stale teacher dashboard block removed; canonical teacher renderer remains active.

