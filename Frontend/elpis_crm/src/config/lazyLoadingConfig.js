/**
 * Lazy Loading Configuration for Large Tables
 * Optimizes performance for tables with 1000+ rows
 */

export const LAZY_LOADING_CONFIG = {
  // Pagination
  PAGE_SIZE: 150,          // Rows per page (150 matches backend default)
  BUFFER_SIZE: 300,        // Total rows to keep in memory (current + adjacent pages)
  
  // Virtual Scrolling
  ITEM_HEIGHT: 48,         // Height of each row in pixels (for react-window)
  OVERSCAN_COUNT: 5,       // Rows to render outside visible area
  
  // Debouncing
  SEARCH_DEBOUNCE_MS: 300, // Time to wait after user stops typing
  FILTER_DEBOUNCE_MS: 300,
  SORT_DEBOUNCE_MS: 200,
  
  // Columns to fetch (reduce payload size)
  VISIBLE_COLUMNS: [
    'ContactId',
    'FirstName',
    'LastName',
    'WorkEmail',
    'WorkPhone',
    'Mobile',
    'Account',
    'SalesOwner',
    'Status',
    'CreatedAt',
    'UpdatedAt',
  ],
  
  // API Configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  REQUEST_TIMEOUT_MS: 15000,
};

/**
 * Debounce helper
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Memoization helper for expensive calculations
 */
export function memoize(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
