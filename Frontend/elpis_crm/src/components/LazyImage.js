import React, { useState, useEffect, useRef } from 'react';

/**
 * LazyImage Component
 * Automatically uses native lazy loading or Intersection Observer fallback
 * Shows placeholder while loading, handles error states
 * 
 * Usage:
 *   <LazyImage src={imageUrl} alt="Description" className="rounded-lg" />
 */
const LazyImage = ({
  src,
  alt = '',
  className = '',
  placeholder = 'bg-gray-200',
  errorImage = null,
  width,
  height,
  onLoad,
  onError,
}) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);
  const [supportsNativeLazy] = useState(() => 'loading' in new Image());

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    if (supportsNativeLazy) {
      // Use native lazy loading
      img.loading = 'lazy';
      const handleLoad = () => {
        setIsLoaded(true);
        onLoad?.();
      };
      const handleError = () => {
        setHasError(true);
        onError?.();
      };
      img.addEventListener('load', handleLoad);
      img.addEventListener('error', handleError);
      return () => {
        img.removeEventListener('load', handleLoad);
        img.removeEventListener('error', handleError);
      };
    } else {
      // Fallback to Intersection Observer
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            const image = entry.target;
            image.src = src;
            image.onload = () => {
              setIsLoaded(true);
              onLoad?.();
              observer.unobserve(image);
            };
            image.onerror = () => {
              setHasError(true);
              onError?.();
              observer.unobserve(image);
            };
          }
        },
        { rootMargin: '50px' }
      );

      observer.observe(img);
      return () => observer.unobserve(img);
    }
  }, [src, supportsNativeLazy, onLoad, onError]);

  const displaySrc = hasError && errorImage ? errorImage : imageSrc;

  return (
    <img
      ref={imgRef}
      src={displaySrc}
      alt={alt}
      width={width}
      height={height}
      className={`
        ${className}
        transition-opacity duration-300
        ${isLoaded ? 'opacity-100' : 'opacity-0'}
        ${!isLoaded && !hasError ? placeholder : ''}
      `}
      onLoadingError={(e) => {
        setHasError(true);
        onError?.();
      }}
    />
  );
};

export default LazyImage;
