import axios from "axios";
import tokenUtils from "../auth/tokenUtils";

// Use 127.0.0.1 (not "localhost") to force IPv4. The backend (Kestrel) binds to
// 0.0.0.0:7229 which is IPv4-only, but browsers resolve "localhost" to IPv6 (::1)
// first, causing ERR_CONNECTION_REFUSED even when the API is running.
const DEFAULT_API_BASE_URL = "http://127.0.0.1:7229/api";
const BASE_URL = process.env.REACT_APP_API_BASE_URL || DEFAULT_API_BASE_URL;

try { console.debug("API base URL:", BASE_URL); } catch (e) {}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  withCredentials: true,
});

const MAX_RETRIES = 1;
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Prevent multiple simultaneous redirects
let isRedirecting = false;

function redirectToLogin() {
  if (isRedirecting) return;
  if (typeof window === "undefined") return;
  // Only redirect if not already on login page
  const path = window.location.pathname;
  if (path === "/" || path.toLowerCase().includes("login") || path.toLowerCase().includes("forgot")) return;
  isRedirecting = true;
  try {
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userName");
  } catch (e) {}
  window.location.href = "/";
}

client.interceptors.request.use(
  (config) => {
    try {
      if (config.url?.includes('login.microsoftonline.com') || config.url?.includes('graph.microsoft.com')) {
        return config;
      }
      const token = typeof window !== "undefined" ? tokenUtils.getToken() : null;
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error("Error attaching token to request:", e);
    }
    return config;
  },
  (err) => Promise.reject(err)
);

client.interceptors.response.use(
  (res) => res,
  (error) => {
    try {
      const config = error.config || {};
      if (config && !config.__isRetryRequest) {
        config.__retryCount = config.__retryCount || 0;
        const shouldRetry =
          (!error.response && error.code === 'ECONNABORTED');
        if (shouldRetry && config.__retryCount < MAX_RETRIES) {
          config.__retryCount += 1;
          config.__isRetryRequest = true;
          return delay(500).then(() => client.request(config));
        }
      }
    } catch (e) {}

    // Network error (no response) — backend unreachable
    if (!error || !error.response) {
      try { console.error('[API Network Error] Could not reach API at', BASE_URL, error?.message || error); } catch (e) {}
      // Do NOT redirect on network error — backend may just be slow
      // Only redirect on 401 (token expired/invalid)
      return Promise.reject({ message: `Network Error: Unable to reach API at ${BASE_URL}`, originalError: error });
    }

    if (error.response.status === 403) {
      const token = typeof window !== "undefined" ? tokenUtils.getToken() : null;
      console.warn("[API 403 Forbidden]", {
        url: error.config?.url,
        hasToken: !!token,
        method: error.config?.method,
        message: error.response?.data?.message || error.message,
      });
    }

    // Only redirect to login on 401 (unauthorized / token expired)
    try {
      if (error.response.status === 401 && !error.config?.url?.includes('/Login')) {
        redirectToLogin();
      }
    } catch (e) {}

    const err = error.response.data || error.response;
    return Promise.reject(err);
  }
);

export default client;
