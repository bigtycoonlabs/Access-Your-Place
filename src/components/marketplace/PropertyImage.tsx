import { useState, useCallback, useRef, useEffect } from 'react';
import { Building2 } from 'lucide-react';

interface PropertyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSources?: string[];
  placeholderClassName?: string;
  onLoadSuccess?: () => void;
  onAllFailed?: () => void;
}

/**
 * Smart property image component with multi-source fallback.
 * Tries the primary src, then each fallback source in order.
 * Shows a styled gradient placeholder if all sources fail.
 */
export function PropertyImage({ 
  src, 
  alt, 
  className = 'w-full h-full object-cover',
  fallbackSources = [],
  placeholderClassName = '',
  onLoadSuccess,
  onAllFailed
}: PropertyImageProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const attemptedRef = useRef(new Set<string>());

  // Build all sources list, filtering out empty/invalid ones
  const allSources = [src, ...fallbackSources].filter(s => s && s.trim().length > 0 && s !== 'null' && s !== 'undefined');

  // Reset state when src changes
  useEffect(() => {
    setSourceIndex(0);
    setFailed(false);
    setLoaded(false);
    attemptedRef.current.clear();
  }, [src]);

  const currentSrc = allSources[sourceIndex];

  const handleError = useCallback(() => {
    if (currentSrc) {
      attemptedRef.current.add(currentSrc);
      console.warn(`[PropertyImage] Failed to load: ${currentSrc.substring(0, 80)}...`);
    }
    
    const nextIndex = sourceIndex + 1;
    if (nextIndex < allSources.length) {
      setSourceIndex(nextIndex);
      setLoaded(false);
    } else {
      setFailed(true);
      onAllFailed?.();
    }
  }, [sourceIndex, allSources.length, currentSrc, onAllFailed]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoadSuccess?.();
  }, [onLoadSuccess]);

  if (failed || allSources.length === 0 || !currentSrc) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 ${placeholderClassName}`}>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a365d]/10 to-[#d4a574]/10 flex items-center justify-center mb-2">
          <Building2 className="w-8 h-8 text-slate-300" />
        </div>
        <span className="text-xs text-slate-400 font-medium">No Photo Available</span>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse flex items-center justify-center z-[1]">
          <Building2 className="w-10 h-10 text-slate-300" />
        </div>
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </>
  );
}
