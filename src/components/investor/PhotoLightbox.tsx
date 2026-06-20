import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  Maximize2, Download, RotateCw, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhotoLightboxProps {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
  propertyAddress?: string;
}

export function PhotoLightbox({ 
  photos, 
  initialIndex = 0, 
  onClose,
  propertyAddress 
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const currentPhoto = photos[currentIndex];
  const totalPhotos = photos.length;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          resetView();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [currentIndex]);

  // Scroll thumbnail into view
  useEffect(() => {
    if (thumbnailRef.current) {
      const thumb = thumbnailRef.current.children[currentIndex] as HTMLElement;
      if (thumb) {
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex]);

  // Reset zoom/rotation when changing photos
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
    setIsLoading(true);
    setImageError(false);
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % totalPhotos);
  }, [totalPhotos]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + totalPhotos) % totalPhotos);
  }, [totalPhotos]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 0.5, 0.5);
      if (newZoom <= 1) setPanOffset({ x: 0, y: 0 });
      return newZoom;
    });
  };
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(currentPhoto);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `property-photo-${currentIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(currentPhoto, '_blank');
    }
  };

  // Touch/swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1) return; // Don't swipe when zoomed
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!dragStart || zoom > 1) return;
    const endX = e.changedTouches[0].clientX;
    const diff = dragStart.x - endX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNext();
      else goToPrev();
    }
    setDragStart(null);
  };

  // Mouse drag for panning when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || zoom <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setDragStart(null);
  };

  // Double-click to zoom
  const handleDoubleClick = () => {
    if (zoom > 1) {
      resetView();
    } else {
      setZoom(2);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Photo lightbox"
    >
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <span className="text-white/80 text-sm font-medium">
            {currentIndex + 1} / {totalPhotos}
          </span>
          {propertyAddress && (
            <span className="text-white/50 text-sm hidden sm:inline">
              {propertyAddress}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            onClick={handleZoomOut}
            title="Zoom out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-white/60 text-xs min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            onClick={handleZoomIn}
            title="Zoom in (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            onClick={handleRotate}
            title="Rotate"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            onClick={resetView}
            title="Reset view (0)"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="w-4 h-4" />
          </Button>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main image area */}
      <div 
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
      >
        {/* Navigation arrows */}
        {totalPhotos > 1 && (
          <>
            <button
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 sm:p-3 transition-all backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 sm:p-3 transition-all backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-5">
            <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
          </div>
        )}

        {/* Error state */}
        {imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-5">
            <div className="text-white/50 text-center">
              <X className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Failed to load image</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white mt-2"
                onClick={() => { setImageError(false); setIsLoading(true); }}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Main image */}
        <img
          key={currentIndex}
          src={currentPhoto}
          alt={`Property photo ${currentIndex + 1} of ${totalPhotos}`}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
            opacity: isLoading ? 0 : 1,
            transition: dragStart ? 'none' : 'transform 0.2s ease, opacity 0.3s ease'
          }}
          onLoad={() => setIsLoading(false)}
          onError={() => { setIsLoading(false); setImageError(true); }}
          draggable={false}
        />

        {/* Click-to-close overlay (only on background, not on image) */}
        <div 
          className="absolute inset-0 -z-10" 
          onClick={onClose}
        />
      </div>

      {/* Thumbnail strip */}
      {totalPhotos > 1 && showThumbnails && (
        <div className="bg-black/60 backdrop-blur-sm px-4 py-3">
          <div 
            ref={thumbnailRef}
            className="flex gap-2 overflow-x-auto justify-center scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {photos.map((photo, index) => (
              <button
                key={index}
                className={`
                  flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all
                  ${index === currentIndex 
                    ? 'border-[#d4a574] ring-1 ring-[#d4a574]/50 scale-105' 
                    : 'border-transparent opacity-60 hover:opacity-90'
                  }
                `}
                onClick={() => setCurrentIndex(index)}
                aria-label={`View photo ${index + 1}`}
              >
                <img
                  src={photo}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 text-white/30 text-xs hidden sm:flex items-center gap-3 pointer-events-none">
        <span>Arrow keys to navigate</span>
        <span>+/- to zoom</span>
        <span>Double-click to zoom</span>
        <span>Esc to close</span>
      </div>
    </div>
  );
}
