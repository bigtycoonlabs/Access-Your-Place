import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, X, GripVertical, Loader2, CheckCircle, 
  AlertCircle, Trash2, RotateCcw, ZoomIn
} from 'lucide-react';
import { generateSignedUrl, generateSignedUrls, extractFilePath, buildUploadPath, isBlobUrl } from '@/utils/photoUtils';
import { PhotoLightbox } from './PhotoLightbox';

interface EnhancedPhotoUploaderProps {
  investorId: string;
  propertyId?: string;
  existingPhotos?: string[];
  onPhotosChange: (filePaths: string[]) => void;
  maxPhotos?: number;
  bucketName?: string;
  folderPath?: string;
}

interface PhotoItem {
  id: string;
  url: string;        // Display URL (signed or blob for preview)
  filePath: string;    // Storage file path (what gets saved to DB)
  file?: File;
  status: 'existing' | 'uploading' | 'uploaded' | 'error' | 'resolving';
  progress: number;
  error?: string;
}

// Image compression utility
async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function EnhancedPhotoUploader({
  investorId,
  propertyId,
  existingPhotos = [],
  onPhotosChange,
  maxPhotos = 10,
  bucketName = 'property-photos',
  folderPath = 'portfolio'
}: EnhancedPhotoUploaderProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize with existing photos - resolve to signed URLs for display
  useEffect(() => {
    if (existingPhotos.length > 0 && !initialized) {
      setInitialized(true);
      
      // Create initial items with resolving status
      const initialPhotos: PhotoItem[] = existingPhotos.map((pathOrUrl, index) => ({
        id: `existing-${index}`,
        url: pathOrUrl, // Temporary - will be replaced with signed URL
        filePath: extractFilePath(pathOrUrl),
        status: 'resolving' as const,
        progress: 100
      }));
      
      setPhotos(initialPhotos);
      
      // Resolve all URLs to signed URLs
      resolveExistingPhotos(existingPhotos, initialPhotos);
    } else if (existingPhotos.length === 0 && !initialized) {
      setInitialized(true);
    }
  }, [existingPhotos]);

  const resolveExistingPhotos = async (paths: string[], items: PhotoItem[]) => {
    try {
      const signedUrls = await generateSignedUrls(paths);
      
      setPhotos(prev => prev.map((p, i) => {
        if (p.id.startsWith('existing-')) {
          const idx = parseInt(p.id.replace('existing-', ''));
          return {
            ...p,
            url: signedUrls[idx] || p.url,
            status: 'existing' as const
          };
        }
        return p;
      }));
    } catch (err) {
      console.error('[EnhancedPhotoUploader] Failed to resolve existing photo URLs:', err);
      // Mark as existing anyway so they're still usable
      setPhotos(prev => prev.map(p => 
        p.status === 'resolving' ? { ...p, status: 'existing' as const } : p
      ));
    }
  };

  // Update parent when photos change - send file_paths (not display URLs)
  useEffect(() => {
    if (!initialized) return;
    
    const filePaths = photos
      .filter(p => p.status === 'existing' || p.status === 'uploaded')
      .map(p => p.filePath);
    onPhotosChange(filePaths);
  }, [photos, initialized]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxPhotos - photos.length;
    
    if (fileArray.length > remainingSlots) {
      toast({
        title: 'Too Many Photos',
        description: `You can only add ${remainingSlots} more photo${remainingSlots !== 1 ? 's' : ''}. Maximum is ${maxPhotos}.`,
        variant: 'destructive'
      });
      return;
    }

    const validFiles = fileArray.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid File Type', description: `${file.name} is not an image file.`, variant: 'destructive' });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'File Too Large', description: `${file.name} exceeds 10MB limit.`, variant: 'destructive' });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newPhotos: PhotoItem[] = validFiles.map((file, index) => ({
      id: `new-${Date.now()}-${index}`,
      url: URL.createObjectURL(file),
      filePath: '', // Will be set after upload
      file,
      status: 'uploading' as const,
      progress: 0
    }));

    setPhotos(prev => [...prev, ...newPhotos]);

    for (const photo of newPhotos) {
      if (!photo.file) continue;
      
      try {
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, progress: 10 } : p
        ));

        const compressedFile = await compressImage(photo.file);
        
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, progress: 30 } : p
        ));

        // Build the file path
        const filePath = buildUploadPath(investorId, photo.file.name, propertyId);
        
        console.log(`[EnhancedPhotoUploader] Uploading to ${bucketName}/${filePath}`);
        
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, compressedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, progress: 80 } : p
        ));

        // Generate a signed URL for display
        let displayUrl: string;
        try {
          displayUrl = await generateSignedUrl(filePath);
        } catch {
          // Fallback to public URL
          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
          displayUrl = urlData.publicUrl;
        }

        // Revoke the blob URL and update with signed URL + file path
        URL.revokeObjectURL(photo.url);
        
        setPhotos(prev => prev.map(p => 
          p.id === photo.id 
            ? { ...p, url: displayUrl, filePath, status: 'uploaded', progress: 100 } 
            : p
        ));

        console.log(`[EnhancedPhotoUploader] Upload complete. Path: ${filePath}`);

      } catch (err: any) {
        console.error('[EnhancedPhotoUploader] Upload error:', err);
        setPhotos(prev => prev.map(p => 
          p.id === photo.id 
            ? { ...p, status: 'error', error: err.message || 'Upload failed' } 
            : p
        ));
      }
    }
  }, [photos.length, maxPhotos, investorId, propertyId, bucketName, folderPath, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragEnd = () => setDraggedIndex(null);

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setPhotos(prev => {
      const newPhotos = [...prev];
      const [draggedItem] = newPhotos.splice(draggedIndex, 1);
      newPhotos.splice(index, 0, draggedItem);
      return newPhotos;
    });
    setDraggedIndex(index);
  };

  const handleRemovePhoto = async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (photo) {
      if (isBlobUrl(photo.url)) {
        URL.revokeObjectURL(photo.url);
      }
      // Optionally delete from storage
      if (photo.filePath && photo.status === 'uploaded') {
        try {
          await supabase.storage.from(bucketName).remove([photo.filePath]);
          console.log(`[EnhancedPhotoUploader] Deleted from storage: ${photo.filePath}`);
        } catch (err) {
          console.warn('[EnhancedPhotoUploader] Failed to delete from storage:', err);
        }
      }
    }
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleRetry = async (photo: PhotoItem) => {
    if (!photo.file) return;
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    handleFiles([photo.file]);
  };

  const totalProgress = photos.length > 0
    ? photos.reduce((sum, p) => sum + p.progress, 0) / photos.length
    : 0;

  const isUploading = photos.some(p => p.status === 'uploading');
  const displayablePhotos = photos.filter(p => p.status !== 'error');
  const lightboxPhotos = displayablePhotos.map(p => p.url);

  return (
    <div className="space-y-4" role="region" aria-label="Photo upload section">
      {/* Upload Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-all
          ${isDragging ? 'border-[#d4a574] bg-[#d4a574]/10' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
          ${photos.length >= maxPhotos ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={() => photos.length < maxPhotos && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={`Drop photos here or click to upload. ${photos.length} of ${maxPhotos} photos added.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            photos.length < maxPhotos && fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          aria-hidden="true"
          disabled={photos.length >= maxPhotos}
        />
        <div className="flex flex-col items-center gap-2">
          <div className={`p-3 rounded-full ${isDragging ? 'bg-[#d4a574]/20' : 'bg-gray-100'}`}>
            <Upload className={`w-6 h-6 ${isDragging ? 'text-[#d4a574]' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="font-medium text-gray-700">
              {isDragging ? 'Drop photos here' : 'Drag & drop photos here'}
            </p>
            <p className="text-sm text-gray-500">
              or click to browse &bull; Max {maxPhotos} photos &bull; Up to 10MB each
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Images will be automatically compressed for optimal performance
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Uploading photos...</span>
            <span className="font-medium">{Math.round(totalProgress)}%</span>
          </div>
          <Progress value={totalProgress} className="h-2" aria-label="Upload progress" />
        </div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {photos.length} of {maxPhotos} photos
            </p>
            <p className="text-xs text-gray-500">
              Drag to reorder &bull; First photo is the cover
            </p>
          </div>
          
          <div 
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            role="list"
            aria-label="Uploaded photos"
          >
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                draggable={photo.status !== 'uploading' && photo.status !== 'resolving'}
                onDragStart={() => handleDragStart(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOverItem(e, index)}
                className={`
                  relative group aspect-square rounded-lg overflow-hidden border-2 transition-all
                  ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
                  ${photo.status === 'error' ? 'border-red-300' : 'border-gray-200'}
                  ${index === 0 ? 'ring-2 ring-[#d4a574] ring-offset-2' : ''}
                `}
                role="listitem"
              >
                {/* Image */}
                {photo.status === 'resolving' ? (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                ) : (
                  <img
                    src={photo.url}
                    alt={`Property photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                
                {/* Cover badge */}
                {index === 0 && photo.status !== 'uploading' && photo.status !== 'resolving' && (
                  <div className="absolute top-1 left-1 bg-[#d4a574] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    Cover
                  </div>
                )}
                
                {/* Drag handle */}
                {photo.status !== 'uploading' && photo.status !== 'resolving' && (
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 rounded p-1 cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
                
                {/* Upload progress overlay */}
                {photo.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                    <span className="text-white text-sm mt-1">{photo.progress}%</span>
                  </div>
                )}
                
                {/* Error overlay */}
                {photo.status === 'error' && (
                  <div className="absolute inset-0 bg-red-500/80 flex flex-col items-center justify-center p-2">
                    <AlertCircle className="w-6 h-6 text-white" />
                    <span className="text-white text-xs mt-1 text-center">{photo.error}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); handleRetry(photo); }}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />Retry
                    </Button>
                  </div>
                )}
                
                {/* Success indicator */}
                {photo.status === 'uploaded' && (
                  <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-0.5">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
                
                {/* Action buttons */}
                {(photo.status === 'existing' || photo.status === 'uploaded') && (
                  <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 flex-1 text-xs bg-black/50 hover:bg-black/70 text-white border-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const displayIdx = displayablePhotos.findIndex(p => p.id === photo.id);
                        setLightboxIndex(displayIdx >= 0 ? displayIdx : 0);
                      }}
                      aria-label={`Preview photo ${index + 1}`}
                    >
                      <ZoomIn className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 flex-1 text-xs bg-red-500/80 hover:bg-red-600 text-white border-0"
                      onClick={(e) => { e.stopPropagation(); handleRemovePhoto(photo.id); }}
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxIndex !== null && lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
