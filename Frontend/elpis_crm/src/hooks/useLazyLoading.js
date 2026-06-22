import { useEffect, useRef, useState } from 'react';

/**
 * Hook for lazy loading elements when they enter the viewport
 * Usage: 
 *   const [isVisible, ref] = useIntersectionObserver({ threshold: 0.1 });
 *   <div ref={ref}>{isVisible && <ExpensiveComponent />}</div>
 */
export const useIntersectionObserver = (options = {}) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        // Unobserve after it becomes visible to avoid re-rendering
        observer.unobserve(entry.target);
      }
    }, {
      threshold: 0.1,
      rootMargin: '50px', // Start loading 50px before entering viewport
      ...options,
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [options]);

  return [isVisible, ref];
};

/**
 * Hook for lazy loading images with intersection observer
 * Falls back to native loading="lazy" if available
 * Usage:
 *   const [imgRef, isLoaded] = useLazyImage();
 *   <img ref={imgRef} src={src} alt={alt} />
 */
export const useLazyImage = (options = {}) => {
  const imgRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // If native lazy loading is supported, use it
    if ('loading' in img) {
      img.loading = 'lazy';
      img.onload = () => setIsLoaded(true);
    } else {
      // Fallback to Intersection Observer
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          const image = entry.target;
          const src = image.dataset.src || image.src;
          
          if (src && !image.src.includes(src)) {
            image.src = src;
          }
          
          image.onload = () => {
            setIsLoaded(true);
            observer.unobserve(image);
          };
          observer.unobserve(image);
        }
      }, {
        rootMargin: '50px',
        ...options,
      });

      observer.observe(img);
      return () => observer.unobserve(img);
    }
  }, [options]);

  return [imgRef, isLoaded];
};

/**
 * Hook for pagination/infinite scroll in large tables
 * Usage:
 *   const { items, page, pageSize, totalItems, onPageChange, hasMore } = usePagination(allItems);
 */
export const usePagination = (allItems, itemsPerPage = 50) => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(itemsPerPage);

  const totalItems = allItems?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const items = allItems?.slice(startIdx, endIdx) || [];
  const hasMore = page < totalPages;

  const onPageChange = (newPage) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages));
    setPage(validPage);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => setPage(1);

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
    onPageChange,
    hasMore,
    reset,
  };
};

/**
 * Hook for virtual scrolling in very large lists (1000+ items)
 * Only renders visible items to improve performance
 * Usage:
 *   const { visibleItems, containerRef, scrollTop } = useVirtualScrolling(items, itemHeight);
 */
export const useVirtualScrolling = (items, itemHeight = 50, containerHeight = 500) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
  const endIdx = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + 1);
  const visibleItems = items.slice(startIdx, endIdx);
  const offsetY = startIdx * itemHeight;

  return {
    visibleItems,
    containerRef,
    scrollTop,
    startIdx,
    endIdx,
    offsetY,
    totalHeight: items.length * itemHeight,
  };
};

/**
 * Hook for debounced search to avoid excessive API calls
 * Usage:
 *   const debouncedSearch = useDebouncedSearch(searchValue, onSearch, 300);
 */
export const useDebouncedValue = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};
