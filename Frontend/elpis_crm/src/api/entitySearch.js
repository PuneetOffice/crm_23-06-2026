import apiClient from "./client";

/**
 * Typeahead search for accounts (API requires min 2 characters).
 * @param {string} q
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
export async function searchAccounts(q, limit = 50) {
  const t = String(q || "").trim();
  if (t.length < 2) return [];
  const res = await apiClient.get("/Account/search", { params: { q: t, limit } });
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * Typeahead search for contacts (API requires min 2 characters).
 */
export async function searchContacts(q, limit = 50) {
  const t = String(q || "").trim();
  if (t.length < 2) return [];
  const res = await apiClient.get("/Contact/search", { params: { q: t, limit } });
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * Typeahead search for deals (API requires min 2 characters).
 */
export async function searchDeals(q, limit = 50) {
  const t = String(q || "").trim();
  if (t.length < 2) return [];
  const res = await apiClient.get("/Deal/search", { params: { q: t, limit } });
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * Contacts linked to an account, optionally filtered (server-side cap).
 */
export async function searchContactsByAccount(accountId, q, limit = 300) {
  if (accountId === undefined || accountId === null || accountId === "") return [];
  const params = { limit };
  const trimmed = String(q || "").trim();
  if (trimmed.length >= 1) params.q = trimmed;
  const res = await apiClient.get(`/Contact/account/${encodeURIComponent(accountId)}`, { params });
  return Array.isArray(res.data) ? res.data : [];
}
