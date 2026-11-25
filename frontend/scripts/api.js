/**
 * Thin REST client for the CyberHash Toolkit FastAPI backend.
 *
 * By default this assumes the frontend is served BY the backend
 * (FastAPI mounts frontend/ as static files at "/"), so relative
 * "/api/..." paths resolve to the same origin. If you run the
 * frontend from a separate dev server, set window.CYBERHASH_API_BASE
 * before this script loads, e.g.:
 *   <script>window.CYBERHASH_API_BASE = "http://localhost:8000";</script>
 */
const API_BASE = window.CYBERHASH_API_BASE || "";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      ...options,
    });
  } catch (networkErr) {
    throw new ApiError(
      "Could not reach the CyberHash Toolkit backend. Is the FastAPI server running?",
      0
    );
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail = (data && (data.detail || data.message)) || `Request failed (${response.status})`;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ")
      : detail;
    throw new ApiError(message, response.status);
  }

  return data;
}

const Api = {
  health: () => apiRequest("/api/health"),

  generateHash: (text, algorithm) =>
    apiRequest("/api/hash/generate", { method: "POST", body: JSON.stringify({ text, algorithm }) }),

  generateHashAll: (text) =>
    apiRequest("/api/hash/generate-all", { method: "POST", body: JSON.stringify({ text }) }),

  hashFile: (file) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest("/api/hash/file", { method: "POST", body: form });
  },

  identifyHash: (hash) =>
    apiRequest("/api/hash/identify", { method: "POST", body: JSON.stringify({ hash }) }),

  compareHash: (first_hash, second_hash, case_sensitive = false) =>
    apiRequest("/api/hash/compare", {
      method: "POST",
      body: JSON.stringify({ first_hash, second_hash, case_sensitive }),
    }),

  decodeHash: (hash) =>
    apiRequest("/api/hash/decode", { method: "POST", body: JSON.stringify({ hash }) }),

  encodeDecode: (text, encoding, mode) =>
    apiRequest("/api/hash/encode", { method: "POST", body: JSON.stringify({ text, encoding, mode }) }),

  runWordlistDemo: (payload) =>
    apiRequest("/api/demo/wordlist", { method: "POST", body: JSON.stringify(payload) }),

  runBruteForceDemo: (payload) =>
    apiRequest("/api/demo/bruteforce", { method: "POST", body: JSON.stringify(payload) }),

  getHistory: (search = "", limit = 100) =>
    apiRequest(`/api/history?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`),

  deleteHistoryEntry: (id) => apiRequest(`/api/history/${id}`, { method: "DELETE" }),

  clearHistory: () => apiRequest("/api/history", { method: "DELETE" }),
};
