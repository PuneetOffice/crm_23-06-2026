import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook for server-side pagination with caching
 * Fetches only the requested page from the server
 */
export function useServerPagination(fetchFunc, pageSize = 50) {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Cache for already-fetched pages
  const cacheRef = useRef(new Map());
  
  const totalItemsRef = useRef(0);
  
  const fetchPage = useCallback(async (pageNum) => {
    // Check cache first
    if (cacheRef.current.has(pageNum)) {
      const cached = cacheRef.current.get(pageNum);
      setData(cached.data);
      setTotalItems(cached.totalItems);
      setTotalPages(Math.ceil(cached.totalItems / pageSize));
      setCurrentPage(pageNum);  // UPDATE CURRENT PAGE WHEN LOADING FROM CACHE
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchFunc(pageNum, pageSize);
      const { items, totalCount } = result;
      
      // Update cache
      cacheRef.current.set(pageNum, { data: items, totalItems: totalCount });
      totalItemsRef.current = totalCount;
      
      setData(items);
      setTotalItems(totalCount);
      setTotalPages(Math.ceil(totalCount / pageSize));
      setCurrentPage(pageNum);
    } catch (err) {
      setError(err.message);
      console.error('Pagination fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchFunc, pageSize]);
  
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);
  
  const goToPage = useCallback((pageNum) => {
    // Allow fetching if totalPages hasn't been loaded yet (first call)
    const totalPagesRef = Math.ceil(totalItemsRef.current / pageSize);
    if (totalItemsRef.current === 0 && pageNum === 1) {
      fetchPage(pageNum);
    } else if (pageNum >= 1 && pageNum <= totalPagesRef) {
      fetchPage(pageNum);
    }
  }, [fetchPage, pageSize]);
  
  const nextPage = useCallback(() => {
    const totalPagesRef = Math.ceil(totalItemsRef.current / pageSize);
    if (currentPage < totalPagesRef) {
      fetchPage(currentPage + 1);
    }
  }, [currentPage, fetchPage, pageSize]);
  
  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      fetchPage(currentPage - 1);
    }
  }, [currentPage, fetchPage]);
  
  return {
    data,
    currentPage,
    totalItems,
    totalPages,
    loading,
    error,
    goToPage,
    nextPage,
    prevPage,
    clearCache,
    pageSize,
  };
}

/**
 * Hook for debounced value updates
 */
export function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}
