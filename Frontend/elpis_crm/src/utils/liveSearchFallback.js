function normalizeSearchValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase();
}

export function matchesSearch(item, query) {
  const normalizedQuery = normalizeSearchValue(query).trim();
  if (!normalizedQuery) return true;

  return Object.values(item || {}).some((value) => {
    if (value === null || value === undefined) return false;

    if (Array.isArray(value)) {
      return value.some((entry) => normalizeSearchValue(entry).includes(normalizedQuery));
    }

    if (typeof value === "object") {
      return Object.values(value).some((entry) => normalizeSearchValue(entry).includes(normalizedQuery));
    }

    return normalizeSearchValue(value).includes(normalizedQuery);
  });
}

export function paginateClientResults(items, page, pageSize) {
  const safeItems = Array.isArray(items) ? items : [];
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || safeItems.length || 1);
  const start = (safePage - 1) * safePageSize;

  return {
    items: safeItems.slice(start, start + safePageSize),
    totalCount: safeItems.length,
  };
}

export function filterAndPaginateResults(items, query, page, pageSize) {
  const filteredItems = String(query || "").trim()
    ? (Array.isArray(items) ? items : []).filter((item) => matchesSearch(item, query))
    : (Array.isArray(items) ? items : []);

  return paginateClientResults(filteredItems, page, pageSize);
}
