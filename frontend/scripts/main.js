"use strict";

/* =========================================================================
   Utilities
   ========================================================================= */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatTimestamp(iso) {
  try {
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for environments without clipboard API access
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Toasts */
function showToast(message, type = "success") {
  const stack = $("#toastStack");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast__dot" aria-hidden="true"></span><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 3400);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

function friendlyError(err) {
  return err && err.message ? err.message : "Something went wrong. Please try again.";
}

/* =========================================================================
   Navbar: mobile drawer + scroll-spy
   ========================================================================= */

(function initNavbar() {
  const toggle = $("#navToggle");
  const drawer = $("#mobileDrawer");

  toggle.addEventListener("click", () => {
    const open = drawer.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  $all(".mobile-drawer__link").forEach((link) => {
    link.addEventListener("click", () => {
      drawer.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  const navLinks = $all(".navlink");
  const sections = navLinks
    .map((l) => document.getElementById(l.getAttribute("href").slice(1)))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navLinks.forEach((l) => l.classList.remove("is-active"));
            const active = navLinks.find((l) => l.getAttribute("href") === `#${entry.target.id}`);
            if (active) active.classList.add("is-active");
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));
  }
})();

/* =========================================================================
   Module 01A — Plain Text Hash Generator
   ========================================================================= */

const ALL_ALGORITHMS = [
  "MD5", "SHA1", "SHA224", "SHA256", "SHA384", "SHA512",
  "SHA3-256", "SHA3-512", "BLAKE2b", "BLAKE2s",
];
const DEFAULT_CHECKED_ALGORITHMS = new Set(["MD5", "SHA1", "SHA256", "SHA512"]);

let lastTextResults = []; // [{algorithm, hash}]
let lastFileResults = null; // {filename, size_bytes, results}

function renderAlgoGrid() {
  const grid = $("#algoGrid");
  grid.innerHTML = ALL_ALGORITHMS.map((algo) => `
    <label class="algo-pill ${DEFAULT_CHECKED_ALGORITHMS.has(algo) ? "is-checked" : ""}" data-algo="${algo}">
      <input type="checkbox" value="${algo}" ${DEFAULT_CHECKED_ALGORITHMS.has(algo) ? "checked" : ""} />
      ${algo}
    </label>
  `).join("");

  $all(".algo-pill input", grid).forEach((cb) => {
    cb.addEventListener("change", () => {
      cb.closest(".algo-pill").classList.toggle("is-checked", cb.checked);
      maybeLiveGenerate();
    });
  });
}

function getSelectedAlgorithms() {
  return $all("#algoGrid input:checked").map((cb) => cb.value);
}

function renderHashResults(container, results) {
  container.innerHTML = results.map((r) => `
    <div class="result-row">
      <span class="result-row__label">${escapeHtml(r.algorithm)}</span>
      <span class="result-row__value mono">${escapeHtml(r.hash)}</span>
      <button class="result-row__copy" data-copy="${escapeHtml(r.hash)}" aria-label="Copy ${r.algorithm} hash" title="Copy">
        <svg width="15" height="15" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M9 9h10v10H9zM5 15V5h10"/></svg>
      </button>
    </div>
  `).join("");

  $all("[data-copy]", container).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await copyToClipboard(btn.getAttribute("data-copy"));
      showToast(ok ? "Copied to clipboard" : "Copy failed", ok ? "success" : "error");
    });
  });
}

async function generateHashes() {
  const text = $("#hashTextInput").value;
  const algorithms = getSelectedAlgorithms();

  if (!text) {
    showToast("Enter some text to hash first", "error");
    return;
  }
  if (algorithms.length === 0) {
    showToast("Select at least one algorithm", "error");
    return;
  }

  const btn = $("#generateHashBtn");
  btn.disabled = true;
  try {
    let results;
    if (algorithms.length === ALL_ALGORITHMS.length) {
      const res = await Api.generateHashAll(text);
      results = res.results;
    } else {
      results = await Promise.all(
        algorithms.map((algo) => Api.generateHash(text, algo))
      );
    }
    lastTextResults = results;
    renderHashResults($("#hashResultList"), results);
    $("#hashResultPanel").hidden = false;
    $("#hashEmptyState").hidden = true;
    refreshHistorySilently();
  } catch (err) {
    showToast(friendlyError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

const maybeLiveGenerate = debounce(() => {
  if ($("#liveHashToggle").checked && $("#hashTextInput").value.trim()) {
    generateHashes();
  }
}, 350);

function clearHashGenerator() {
  $("#hashTextInput").value = "";
  lastTextResults = [];
  $("#hashResultPanel").hidden = true;
  $("#hashEmptyState").hidden = false;
  $("#hashResultList").innerHTML = "";
}

async function copyAllHashResults() {
  if (!lastTextResults.length) {
    showToast("Nothing to copy yet", "error");
    return;
  }
  const block = lastTextResults.map((r) => `${r.algorithm}: ${r.hash}`).join("\n");
  const ok = await copyToClipboard(block);
  showToast(ok ? "All results copied" : "Copy failed", ok ? "success" : "error");
}

function downloadHashResults() {
  if (!lastTextResults.length) {
    showToast("Nothing to download yet", "error");
    return;
  }
  const block = lastTextResults.map((r) => `${r.algorithm}: ${r.hash}`).join("\n");
  downloadTextFile("cyberhash-results.txt", block);
}

function initHashGenerator() {
  renderAlgoGrid();
  $("#generateHashBtn").addEventListener("click", generateHashes);
  $("#clearHashBtn").addEventListener("click", clearHashGenerator);
  $("#copyAllHashBtn").addEventListener("click", copyAllHashResults);
  $("#downloadHashBtn").addEventListener("click", downloadHashResults);
  $("#hashTextInput").addEventListener("input", maybeLiveGenerate);
  $("#liveHashToggle").addEventListener("change", () => {
    if ($("#liveHashToggle").checked) maybeLiveGenerate();
  });
}

/* =========================================================================
   Module 01B — File Hash Generator
   ========================================================================= */

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
let selectedFile = null;

function setSelectedFile(file) {
  if (!file) return;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    showToast(`File exceeds the 50 MB maximum (${formatBytes(file.size)})`, "error");
    return;
  }
  selectedFile = file;
  $("#fileInfoName").textContent = file.name;
  $("#fileInfoSize").textContent = formatBytes(file.size);
  $("#fileInfo").hidden = false;
  $("#hashFileBtn").disabled = false;
  $("#fileResultPanel").hidden = true;
}

function clearSelectedFile() {
  selectedFile = null;
  $("#fileInput").value = "";
  $("#fileInfo").hidden = true;
  $("#hashFileBtn").disabled = true;
  $("#fileResultPanel").hidden = true;
}

async function hashSelectedFile() {
  if (!selectedFile) return;
  const btn = $("#hashFileBtn");
  btn.disabled = true;
  btn.textContent = "Hashing…";
  try {
    const res = await Api.hashFile(selectedFile);
    lastFileResults = res;
    renderHashResults($("#fileResultList"), res.results);
    $("#fileResultPanel").hidden = false;
    refreshHistorySilently();
  } catch (err) {
    showToast(friendlyError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Calculate File Hash";
  }
}

function initFileHashGenerator() {
  const dropzone = $("#fileDropzone");
  const fileInput = $("#fileInput");

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) setSelectedFile(fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  });

  $("#fileRemoveBtn").addEventListener("click", clearSelectedFile);
  $("#hashFileBtn").addEventListener("click", hashSelectedFile);

  $("#copyFileHashBtn").addEventListener("click", async () => {
    if (!lastFileResults) return;
    const block = lastFileResults.results.map((r) => `${r.algorithm}: ${r.hash}`).join("\n");
    const ok = await copyToClipboard(block);
    showToast(ok ? "All results copied" : "Copy failed", ok ? "success" : "error");
  });
  $("#downloadFileHashBtn").addEventListener("click", () => {
    if (!lastFileResults) return;
    const block = `File: ${lastFileResults.filename} (${formatBytes(lastFileResults.size_bytes)})\n\n` +
      lastFileResults.results.map((r) => `${r.algorithm}: ${r.hash}`).join("\n");
    downloadTextFile(`${lastFileResults.filename}.hashes.txt`, block);
  });
}

/* =========================================================================
   Module 02A — Hash Identifier
   ========================================================================= */

async function identifyHash() {
  const value = $("#identifyInput").value.trim();
  if (!value) {
    showToast("Paste a hash to identify", "error");
    return;
  }
  const btn = $("#identifyBtn");
  btn.disabled = true;
  try {
    const res = await Api.identifyHash(value);
    $("#identifyAlgo").textContent = res.algorithm;
    $("#identifyConfidenceValue").textContent = `${res.confidence}%`;
    requestAnimationFrame(() => {
      $("#identifyConfidenceFill").style.width = `${res.confidence}%`;
    });
    $("#identifyLength").textContent = `${res.length} characters`;
    $("#identifyCharset").textContent = res.charset;
    $("#identifyPossible").innerHTML = res.possible_algorithms
      .map((a) => `<span class="chip">${escapeHtml(a)}</span>`).join("");

    const warningEl = $("#identifyWarning");
    if (res.warning) {
      warningEl.hidden = false;
      warningEl.textContent = res.warning;
    } else {
      warningEl.hidden = true;
    }

    $("#identifyReasoning").innerHTML = res.reasoning.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    $("#identifyResultPanel").hidden = false;
    $("#identifyEmptyState").hidden = true;
    refreshHistorySilently();
  } catch (err) {
    showToast(friendlyError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

/* =========================================================================
   Module 02B — Hash Comparison
   ========================================================================= */

async function compareHashes() {
  const first = $("#compareFirst").value.trim();
  const second = $("#compareSecond").value.trim();
  if (!first || !second) {
    showToast("Enter both hashes to compare", "error");
    return;
  }
  const btn = $("#compareBtn");
  btn.disabled = true;
  try {
    const res = await Api.compareHash(first, second, false);
    const badge = $("#compareStatusBadge");
    if (res.match) {
      badge.textContent = "✓ Match";
      badge.className = "status-badge status-badge--success";
    } else {
      badge.textContent = "✕ No Match";
      badge.className = "status-badge status-badge--danger";
    }
    $("#compareResultPanel").hidden = false;
    $("#copyCompareBtn").onclick = async () => {
      const ok = await copyToClipboard(res.match ? "Match" : "No Match");
      showToast(ok ? "Copied" : "Copy failed", ok ? "success" : "error");
    };
    refreshHistorySilently();
  } catch (err) {
    showToast(friendlyError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

/* =========================================================================
   Module 02C — Hash Decoder (dictionary demo)
   ========================================================================= */

// Precomputed digests for the documented quick-test buttons (verified
// against the backend's own hashlib output).
const DECODE_QUICK_TESTS = [
  { label: "password (MD5)", hash: "5f4dcc3b5aa765d61d8327deb882cf99" },
  { label: "123456 (MD5)", hash: "e10adc3949ba59abbe56e057f20f883e" },
  { label: "admin (SHA256)", hash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" },
  { label: "test (MD5)", hash: "098f6bcd4621d373cade4e832627b4f6" },
  { label: "admin (SHA1)", hash: "d033e22ae348aeb5660fc2140aec35850c4da997" },
];

function renderDecodeQuickTests() {
  $("#decodeQuickTests").innerHTML = DECODE_QUICK_TESTS.map((t, i) => `
    <button type="button" class="quick-test-btn" data-idx="${i}">${escapeHtml(t.label)}</button>
  `).join("");
  $all("#decodeQuickTests .quick-test-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = DECODE_QUICK_TESTS[Number(btn.dataset.idx)];
      $("#decodeInput").value = t.hash;
      decodeHash();
    });
  });
}

async function decodeHash() {
  const value = $("#decodeInput").value.trim();
  if (!value) {
    showToast("Paste a hash to decode", "error");
    return;
  }
  const btn = $("#decodeBtn");
  btn.disabled = true;
  try {
    const res = await Api.decodeHash(value);
    const panel = $("#decodeResultPanel");
    if (res.found) {
      panel.innerHTML = `
        <div class="status-line" style="margin-bottom:0.9rem;">
          <span class="status-badge status-badge--success">✓ Found</span>
          <span class="chip">${res.entries_checked} entries checked</span>
        </div>
        <div class="result-row"><span class="result-row__label">Plaintext</span><span class="result-row__value mono">${escapeHtml(res.plaintext)}</span></div>
        <div class="result-row"><span class="result-row__label">Algorithm</span><span class="result-row__value mono">${escapeHtml(res.algorithm_guess)}</span></div>
      `;
    } else {
      panel.innerHTML = `
        <div class="status-line">
          <span class="status-badge status-badge--neutral">No match</span>
          <span class="chip">${res.entries_checked} entries checked</span>
        </div>
        <p style="margin-top:0.9rem;">Not found in the built-in educational wordlist. This is a bounded, curated demonstration — not an exhaustive lookup.</p>
      `;
    }
    panel.hidden = false;
    refreshHistorySilently();
  } catch (err) {
    showToast(friendlyError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

/* =========================================================================
   Module 02D — Encoding Decoder
   ========================================================================= */

async function runEncodeDecode(mode) {
  const text = $("#encodingInput").value;
  const encoding = $("#encodingSelect").value;
  if (!text) {
    showToast("Enter some input first", "error");
    return;
  }
  try {
    const res = await Api.encodeDecode(text, encoding, mode);
    $("#encodingOutput").value = res.output;
    refreshHistorySilently();
  } catch (err) {
    showToast(friendlyError(err), "error");
  }
}

function initEncodingDecoder() {
  $("#encodeBtn").addEventListener("click", () => runEncodeDecode("encode"));
  $("#decodeEncBtn").addEventListener("click", () => runEncodeDecode("decode"));
  $("#copyEncodingOutputBtn").addEventListener("click", async () => {
    const value = $("#encodingOutput").value;
    if (!value) {
      showToast("Nothing to copy yet", "error");
      return;
    }
    const ok = await copyToClipboard(value);
    showToast(ok ? "Output copied" : "Copy failed", ok ? "success" : "error");
  });
}

/* =========================================================================
   Module 03A — Wordlist Attack (bounded, educational)
   ========================================================================= */

// Small JS mirror of the backend's built-in presets, used only so
// "Load preset words" can show the user what will be tried.
const PRESET_WORDLISTS_PREVIEW = {
  "common-passwords": [
    "123456", "password", "123456789", "12345678", "12345", "1234567",
    "qwerty", "abc123", "111111", "123123", "admin", "letmein", "welcome",
    "monkey", "login", "princess", "solo", "iloveyou", "dragon", "master",
  ],
  "keyboard-patterns": [
    "qwerty", "asdfgh", "zxcvbn", "qazwsx", "1qaz2wsx", "qwertyuiop",
    "asdfghjkl", "1q2w3e4r", "q1w2e3r4t5", "qweasd", "poiuyt",
  ],
  "years-1990-2030": Array.from({ length: 41 }, (_, i) => String(1990 + i)),
  "default-credentials": [
    "admin", "administrator", "root", "toor", "guest", "user", "default",
    "password", "changeme", "cisco", "ubnt", "pass", "1234", "12345",
  ],
  "numeric-pins": ["0000", "0001", "0002", "…", "9999", "123456", "000000", "111111"],
  "standard-usernames": [
    "admin", "administrator", "root", "user", "guest", "test", "operator", "manager",
  ],
  "ctf-keywords": ["flag", "ctf", "picoctf", "hackme", "secret", "letmein", "pwned"],
  "master-combined": ["(all built-in presets combined — applied server-side)"],
};

const WORDLIST_QUICK_TESTS = [
  { label: "123456 (MD5)", hash: "e10adc3949ba59abbe56e057f20f883e", algo: "MD5" },
  { label: "admin (SHA256)", hash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", algo: "SHA256" },
  { label: "12345678 (MD5)", hash: "25d55ad283aa400af464c76d713c07ad", algo: "MD5" },
  { label: "123 (SHA256)", hash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3", algo: "SHA256" },
];

function renderWordlistQuickTests() {
  $("#wordlistQuickTests").innerHTML = WORDLIST_QUICK_TESTS.map((t, i) => `
    <button type="button" class="quick-test-btn" data-idx="${i}">${escapeHtml(t.label)}</button>
  `).join("");
  $all("#wordlistQuickTests .quick-test-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = WORDLIST_QUICK_TESTS[Number(btn.dataset.idx)];
      $("#wordlistTarget").value = t.hash;
      $("#wordlistAlgo").value = t.algo;
      $("#wordlistSource").value = "common-passwords";
      $("#wordlistEditor").value = "";
      runWordlistAttack();
    });
  });
}

function renderDemoResult(container, { matched, candidate, statLabel1, statVal1, statLabel2, statVal2, statLabel3, statVal3 }) {
  container.innerHTML = `
    <div class="status-line">
      <span class="status-badge ${matched ? "status-badge--success" : "status-badge--neutral"}">
        ${matched ? "✓ Match found" : "No match"}
      </span>
      ${matched ? `<span class="chip mono">${escapeHtml(candidate)}</span>` : ""}
    </div>
    <div class="demo-stats">
      <div class="demo-stat"><div class="demo-stat__value">${statVal1}</div><div class="demo-stat__label">${statLabel1}</div></div>
      <div class="demo-stat"><div class="demo-stat__value">${statVal2}</div><div class="demo-stat__label">${statLabel2}</div></div>
      <div class="demo-stat"><div class="demo-stat__value">${statVal3}</div><div class="demo-stat__label">${statLabel3}</div></div>
    </div>
  `;
}

async function runWordlistAttack() {
  const target = $("#wordlistTarget").value.trim();
  const algorithm = $("#wordlistAlgo").value;
  const source = $("#wordlistSource").value;
  const editorText = $("#wordlistEditor").value.trim();

  if (!target) {
    showToast("Enter a target hash first", "error");
    return;
  }

  const payload = { target_hash: target, algorithm };
  if (editorText) {
    payload.custom_candidates = editorText.split("\n").map((l) => l.trim()).filter(Boolean);
  } else if (source === "custom") {
    showToast("Type candidate lines in the editor, or choose a preset wordlist", "error");
    return;
  } else {
    payload.wordlist = source;
  }

  const btn = $("#runWordlistBtn");
  btn.disabled = true;
  btn.textContent = "Running…";
  try {
    const res = await Api.runWordlistDemo(payload);
    renderDemoResult($("#wordlistResultPanel"), {
      matched: res.matched,
      candidate: res.candidate,
      statLabel1: "Attempts", statVal1: res.attempts,
      statLabel2: "Total candidates", statVal2: res.total_candidates,
      statLabel3: "Time", statVal3: `${res.time_ms} ms`,
    });
    $("#wordlistResultPanel").hidden = false;
    refreshHistorySilently();
  } catch (err) {
    showToast(friendlyError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Wordlist Attack";
  }
}

function initWordlistAttack() {
  renderWordlistQuickTests();

  $("#loadPresetBtn").addEventListener("click", () => {
    const source = $("#wordlistSource").value;
    if (source === "custom") {
      showToast("Custom source selected — type your own candidates below", "error");
      return;
    }
    const preview = PRESET_WORDLISTS_PREVIEW[source] || [];
    $("#wordlistEditor").value = preview.join("\n");
    showToast(`Loaded ${preview.length} preview candidates from ${source}`, "success");
  });

  $("#wordlistUpload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      $("#wordlistEditor").value = String(reader.result);
      showToast(`Loaded candidates from ${file.name}`, "success");
    };
    reader.readAsText(file);
  });

  $("#runWordlistBtn").addEventListener("click", runWordlistAttack);
}

/* =========================================================================
   Module 03B — Brute-Force Demo (tightly bounded)
   ========================================================================= */

const BRUTE_QUICK_TESTS = [
  { label: "abc (MD5)", hash: "900150983cd24fb0d6963f7d28e17f72", algo: "MD5" },
  { label: "999 (MD5)", hash: "b706835de79a2b4e80506f582af3676a", algo: "MD5" },
  { label: "a (SHA1)", hash: "86f7e437faa5a7fce15d1ddcb9eaeaea377667b8", algo: "SHA1" },
];

function renderBruteQuickTests() {
  $("#bruteQuickTests").innerHTML = BRUTE_QUICK_TESTS.map((t, i) => `
    <button type="button" class="quick-test-btn" data-idx="${i}">${escapeHtml(t.label)}</button>
  `).join("");
  $all("#bruteQuickTests .quick-test-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = BRUTE_QUICK_TESTS[Number(btn.dataset.idx)];
      $("#bruteTarget").value = t.hash;
      $("#bruteAlgo").value = t.algo;
      $("#bruteMaxLength").value = 4;
      $("#bruteCharset").value = "abcdefghijklmnopqrstuvwxyz0123456789";
      runBruteForce();
    });
  });
}

async function runBruteForce() {
  const target = $("#bruteTarget").value.trim();
  const algorithm = $("#bruteAlgo").value;
  let maxLength = parseInt($("#bruteMaxLength").value, 10);
  const charset = $("#bruteCharset").value.trim();

  if (!target) {
    showToast("Enter a target hash first", "error");
    return;
  }
  if (!charset) {
    showToast("Charset cannot be empty", "error");
    return;
  }
  if (!Number.isFinite(maxLength) || maxLength < 1) maxLength = 1;
  if (maxLength > 5) {
    maxLength = 5;
    $("#bruteMaxLength").value = 5;
    showToast("Max length is capped at 5 for this bounded demo", "error");
  }

  const btn = $("#runBruteBtn");
  btn.disabled = true;
  btn.textContent = "Searching…";
  try {
    const res = await Api.runBruteForceDemo({
      target_hash: target, algorithm, max_length: maxLength, charset,
    });
    renderDemoResult($("#bruteResultPanel"), {
      matched: res.matched,
      candidate: res.candidate,
      statLabel1: "Candidates tested", statVal1: res.candidates_tested.toLocaleString(),
      statLabel2: "Search space", statVal2: res.search_space.toLocaleString(),
      statLabel3: "Time", statVal3: `${res.time_ms} ms`,
    });
    $("#bruteResultPanel").hidden = false;
    refreshHistorySilently();
  } catch (err) {
    showToast(friendlyError(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Brute-Force";
  }
}

function initBruteForce() {
  renderBruteQuickTests();
  $("#bruteMaxLength").addEventListener("change", () => {
    const v = parseInt($("#bruteMaxLength").value, 10);
    if (v > 5) $("#bruteMaxLength").value = 5;
    if (v < 1 || Number.isNaN(v)) $("#bruteMaxLength").value = 1;
  });
  $("#runBruteBtn").addEventListener("click", runBruteForce);
}

/* =========================================================================
   Module 04 — Hash History
   ========================================================================= */

function statusBadgeClass(status) {
  if (status === "success" || status === "match" || status === "found") return "status-badge--success";
  if (status === "no_match" || status === "not_found" || status === "error") return "status-badge--danger";
  return "status-badge--neutral";
}

async function loadHistory() {
  const search = $("#historySearch").value.trim();
  try {
    const res = await Api.getHistory(search, 100);
    const tbody = $("#historyTableBody");
    if (!res.entries.length) {
      tbody.innerHTML = "";
      $("#historyEmptyState").hidden = false;
      return;
    }
    $("#historyEmptyState").hidden = true;
    tbody.innerHTML = res.entries.map((e) => `
      <tr data-id="${e.id}">
        <td>${escapeHtml(formatTimestamp(e.timestamp))}</td>
        <td>${escapeHtml(e.operation)}</td>
        <td class="mono-cell">${escapeHtml(e.algorithm || "—")}</td>
        <td>${escapeHtml(e.input_type)}</td>
        <td>
          <span class="status-badge ${statusBadgeClass(e.status)}" style="font-size:0.75rem; padding:0.25rem 0.6rem;">${escapeHtml(e.status)}</span>
          ${e.result ? `<div class="mono" style="font-size:0.75rem; color:var(--text-muted); margin-top:0.3rem; overflow-wrap:anywhere;">${escapeHtml(e.result)}</div>` : ""}
        </td>
        <td>
          <button class="delete-row-btn" data-id="${e.id}" aria-label="Delete entry" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7"/></svg>
          </button>
        </td>
      </tr>
    `).join("");

    $all(".delete-row-btn", tbody).forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await Api.deleteHistoryEntry(Number(btn.dataset.id));
          loadHistory();
        } catch (err) {
          showToast(friendlyError(err), "error");
        }
      });
    });
  } catch (err) {
    showToast(friendlyError(err), "error");
  }
}

function refreshHistorySilently() {
  // Best-effort refresh so History stays live after actions elsewhere;
  // failures here are non-critical and shouldn't interrupt the user.
  loadHistory().catch(() => {});
}

function initHistory() {
  $("#historySearch").addEventListener("input", debounce(loadHistory, 300));
  $("#refreshHistoryBtn").addEventListener("click", loadHistory);
  $("#clearHistoryBtn").addEventListener("click", async () => {
    if (!confirm("Clear all history? This cannot be undone.")) return;
    try {
      await Api.clearHistory();
      loadHistory();
      showToast("History cleared", "success");
    } catch (err) {
      showToast(friendlyError(err), "error");
    }
  });
  loadHistory();
}

/* =========================================================================
   Bootstrap
   ========================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initHashGenerator();
  initFileHashGenerator();
  renderDecodeQuickTests();
  initEncodingDecoder();
  initWordlistAttack();
  initBruteForce();
  initHistory();

  $("#identifyBtn").addEventListener("click", identifyHash);
  $("#identifyInput").addEventListener("keydown", (e) => { if (e.key === "Enter") identifyHash(); });

  $("#compareBtn").addEventListener("click", compareHashes);

  $("#decodeBtn").addEventListener("click", decodeHash);
  $("#decodeInput").addEventListener("keydown", (e) => { if (e.key === "Enter") decodeHash(); });

  // Surface a clear message if the backend isn't reachable at all.
  Api.health().catch(() => {
    showToast("Backend not reachable — start the FastAPI server (see README)", "error");
  });
});
