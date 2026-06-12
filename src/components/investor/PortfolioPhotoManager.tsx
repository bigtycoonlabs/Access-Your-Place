import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  X, GripVertical, Image, Loader2, CheckCircle, 
  AlertCircle, Trash2, RotateCcw, ZoomIn, Star,
  Camera, ImagePlus, ArrowUp, ArrowDown
} from 'lucide-react';
import { generateSignedUrl, generateSignedUrls, extractFilePath, buildUploadPath, isBlobUrl } from '@/utils/photoUtils';
import { PhotoLightbox } from './PhotoLightbox';

interface PortfolioPhotoManagerProps {
  investorId: string;
  propertyId: string;
  propertyAddress: string;
  existingPhotos?: string[];
  primaryPhotoIndex?: number;
  onPhotosChange: (filePaths: string[], primaryIndex: number) => void;
  onClose?: () => void;
  maxPhotos?: number;
}

interface PhotoItem {
  id: string;
  url: string;        // Display URL (signed)
  filePath: string;    // Storage file path
  file?: File;
  status: 'existing' | 'uploading' | 'uploaded' | 'error' | 'resolving';
  progress: number;
  error?: string;
  isPrimary: boolean;
}

async function compressImage(file: File, maxWidth = 1920, quality = 0.85): Promise<File> {
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
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else { resolve(file); }
          },
          'image/jpeg', quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function PortfolioPhotoManager({
  investorId,
  propertyId,
  propertyAddress,
  existingPhotos = [],
  primaryPhotoIndex = 0,
  onPhotosChange,
  onClose,
  maxPhotos = 20
}: PortfolioPhotoManagerProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Initialize with existing photos - resolve to signed URLs
  useEffect(() => {
    if (existingPhotos.length > 0 && !initialized) {
      setInitialized(true);
      
      const initialPhotos: PhotoItem[] = existingPhotos.map((pathOrUrl, index) => ({
        id: `existing-${index}`,
        url: pathOrUrl,
        filePath: extractFilePath(pathOrUrl),
        status: 'resolving' as const,
        progress: 100,
        isPrimary: index === primaryPhotoIndex
      }));
      
      setPhotos(initialPhotos);
      resolveExistingPhotos(existingPhotos);
    } else if (existingPhotos.length === 0 && !initialized) {
      setInitialized(true);
    }
  }, [existingPhotos, primaryPhotoIndex]);

  const resolveExistingPhotos = async (paths: string[]) => {
    try {
      const signedUrls = await generateSignedUrls(paths);
      setPhotos(prev => prev.map((p, i) => {
        if (p.id.startsWith('existing-')) {
          const idx = parseInt(p.id.replace('existing-', ''));
          return { ...p, url: signedUrls[idx] || p.url, status: 'existing' as const };
        }
        return p;
      }));
    } catch (err) {
      console.error('[PortfolioPhotoManager] Failed to resolve URLs:', err);
      setPhotos(prev => prev.map(p => p.status === 'resolving' ? { ...p, status: 'existing' as const } : p));
    }
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxPhotos - photos.length;
    
    if (fileArray.length > remainingSlots) {
      toast({ title: 'Too Many Photos', description: `You can only add ${remainingSlots} more.`, variant: 'destructive' });
      return;
    }

    const validFiles = fileArray.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid File Type', description: `${file.name} is not an image.`, variant: 'destructive' });
        return false;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast({ title: 'File Too Large', description: `${file.name} exceeds 15MB.`, variant: 'destructive' });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newPhotos: PhotoItem[] = validFiles.map((file, index) => ({
      id: `new-${Date.now()}-${index}`,
      url: URL.createObjectURL(file),
      filePath: '',
      file,
      status: 'uploading' as const,
      progress: 0,
      isPrimary: photos.length === 0 && index === 0
    }));

    setPhotos(prev => [...prev, ...newPhotos]);

    for (const photo of newPhotos) {
      if (!photo.file) continue;
      try {
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, progress: 10 } : p));
        const compressedFile = await compressImage(photo.file);
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, progress: 30 } : p));

        const filePath = buildUploadPath(investorId, photo.file.name, propertyId);
        
        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(filePath, compressedFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, progress: 80 } : p));

        // Generate signed URL for display
        let displayUrl: string;
        try {
          displayUrl = await generateSignedUrl(filePath);
        } catch {
          const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(filePath);
          displayUrl = urlData.publicUrl;
        }

        URL.revokeObjectURL(photo.url);
        
        setPhotos(prev => prev.map(p => 
          p.id === photo.id 
            ? { ...p, url: displayUrl, filePath, status: 'uploaded', progress: 100 } 
            : p
        ));

        toast({ title: 'Photo Uploaded', description: `${photo.file.name} uploaded successfully.` });
      } catch (err: any) {
        console.error('[PortfolioPhotoManager] Upload error:', err);
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, status: 'error', error: err.message || 'Upload failed' } : p
        ));
      }
    }
  }, [photos.length, maxPhotos, investorId, propertyId, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
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
      if (isBlobUrl(photo.url)) URL.revokeObjectURL(photo.url);
      if (photo.filePath && photo.status === 'uploaded') {
        try { await supabase.storage.from('property-photos').remove([photo.filePath]); } catch {}
      }
    }
    setPhotos(prev => {
      const newPhotos = prev.filter(p => p.id !== id);
      if (photo?.isPrimary && newPhotos.length > 0) newPhotos[0].isPrimary = true;
      return newPhotos;
    });
  };

  const handleSetPrimary = (id: string) => {
    setPhotos(prev => prev.map(p => ({ ...p, isPrimary: p.id === id })));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setPhotos(prev => {
      const n = [...prev];
      [n[index - 1], n[index]] = [n[index], n[index - 1]];
      return n;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === photos.length - 1) return;
    setPhotos(prev => {
      const n = [...prev];
      [n[index], n[index + 1]] = [n[index + 1], n[index]];
      return n;
    });
  };

  const handleRetry = async (photo: PhotoItem) => {
    if (!photo.file) return;
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    handleFiles([photo.file]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const uploadedPhotos = photos.filter(p => p.status === 'existing' || p.status === 'uploaded');
      const filePaths = uploadedPhotos.map(p => p.filePath);
      const primaryIndex = uploadedPhotos.findIndex(p => p.isPrimary);
      
      onPhotosChange(filePaths, primaryIndex >= 0 ? primaryIndex : 0);
      
      toast({ title: 'Photos Saved', description: `${filePaths.length} photo${filePaths.length !== 1 ? 's' : ''} saved.` });
      if (onClose) onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save', variant: 'destructive' });
    }
    setSaving(false);
  };

  const totalProgress = photos.length > 0 ? photos.reduce((sum, p) => sum + p.progress, 0) / photos.length : 0;
  const isUploading = photos.some(p => p.status === 'uploading');
  const hasErrors = photos.some(p => p.status === 'error');
  const uploadedCount = photos.filter(p => p.status === 'existing' || p.status === 'uploaded').length;
  const displayablePhotos = photos.filter(p => p.status !== 'error' && p.status !== 'resolving');
  const lightboxPhotos = displayablePhotos.map(p => p.url);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#d4a574]" />
              Property Photos
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">{propertyAddress}</p>
          </div>
          <Badge variant="outline" className="text-sm">{uploadedCount} / {maxPhotos} photos</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Upload Zone */}
        <div
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              photos.length < maxPhotos && fileInputRef.current?.click();
            }
          }}
        >
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden" disabled={photos.length >= maxPhotos} />
          <div className="flex flex-col items-center gap-2">
            <div className={`p-3 rounded-full ${isDragging ? 'bg-[#d4a574]/20' : 'bg-gray-100'}`}>
              <ImagePlus className={`w-8 h-8 ${isDragging ? 'text-[#d4a574]' : 'text-gray-400'}`} />
            </div>
            <p className="font-medium text-gray-700">{isDragging ? 'Drop photos here' : 'Drag & drop photos here'}</p>
            <p className="text-sm text-gray-500">or click to browse &bull; Max {maxPhotos} photos &bull; Up to 15MB each</p>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-700 font-medium flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />Uploading...
              </span>
              <span className="font-medium text-blue-700">{Math.round(totalProgress)}%</span>
            </div>
            <Progress value={totalProgress} className="h-2" />
          </div>
        )}

        {/* Photo Grid */}
        {photos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">{uploadedCount} photo{uploadedCount !== 1 ? 's' : ''} uploaded</p>
              <p className="text-xs text-gray-500">Drag to reorder &bull; Click star to set primary</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                    ${photo.isPrimary ? 'ring-2 ring-[#d4a574] ring-offset-2' : ''}
                  `}
                >
                  {photo.status === 'resolving' ? (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    </div>
                  ) : (
                    <img src={photo.url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  )}
                  
                  {photo.isPrimary && photo.status !== 'uploading' && photo.status !== 'resolving' && (
                    <div className="absolute top-1 left-1 bg-[#d4a574] text-white text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />Primary
                    </div>
                  )}
                  
                  {!photo.isPrimary && photo.status !== 'uploading' && photo.status !== 'resolving' && (
                    <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">#{index + 1}</div>
                  )}
                  
                  {photo.status !== 'uploading' && photo.status !== 'resolving' && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 rounded p-1 cursor-grab"><GripVertical className="w-4 h-4 text-white" /></div>
                    </div>
                  )}
                  
                  {photo.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                      <span className="text-white text-sm mt-2">{photo.progress}%</span>
                    </div>
                  )}
                  
                  {photo.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500/90 flex flex-col items-center justify-center p-2">
                      <AlertCircle className="w-6 h-6 text-white" />
                      <span className="text-white text-xs mt-1 text-center line-clamp-2">{photo.error}</span>
                      <Button size="sm" variant="secondary" className="mt-2 h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleRetry(photo); }}>
                        <RotateCcw className="w-3 h-3 mr-1" />Retry
                      </Button>
                    </div>
                  )}
                  
                  {photo.status === 'uploaded' && (
                    <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-0.5">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  {(photo.status === 'existing' || photo.status === 'uploaded') && (
                    <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 to-transparent p-2 pt-8">
                      <div className="flex gap-1 justify-center">
                        {!photo.isPrimary && (
                          <Button size="sm" variant="secondary"
                            className="h-7 px-2 text-xs bg-[#d4a574] hover:bg-[#c49464] text-white border-0"
                            onClick={(e) => { e.stopPropagation(); handleSetPrimary(photo.id); }} title="Set primary">
                            <Star className="w-3 h-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="secondary"
                          className="h-7 px-2 text-xs bg-white/90 hover:bg-white text-gray-700 border-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dIdx = displayablePhotos.findIndex(p => p.id === photo.id);
                            setLightboxIndex(dIdx >= 0 ? dIdx : 0);
                          }} title="Preview">
                          <ZoomIn className="w-3 h-3" />
                        </Button>
                        {index > 0 && (
                          <Button size="sm" variant="secondary"
                            className="h-7 px-2 text-xs bg-white/90 hover:bg-white text-gray-700 border-0"
                            onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }} title="Move up">
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                        )}
                        {index < photos.length - 1 && (
                          <Button size="sm" variant="secondary"
                            className="h-7 px-2 text-xs bg-white/90 hover:bg-white text-gray-700 border-0"
                            onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }} title="Move down">
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="secondary"
                          className="h-7 px-2 text-xs bg-red-500 hover:bg-red-600 text-white border-0"
                          onClick={(e) => { e.stopPropagation(); handleRemovePhoto(photo.id); }} title="Remove">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {photos.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Image className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium">No photos yet</p>
            <p className="text-sm">Upload photos to showcase your property</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-500">
            {hasErrors && (
              <span className="text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />Some uploads failed
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {onClose && <Button variant="outline" onClick={onClose}>Cancel</Button>}
            <Button onClick={handleSave} disabled={saving || isUploading || uploadedCount === 0}
              className="bg-[#d4a574] hover:bg-[#c49464]">
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" />Save Photos ({uploadedCount})</>
              )}
            </Button>
          </div>
        </div>

        {/* Photo Lightbox */}
        {lightboxIndex !== null && lightboxPhotos.length > 0 && (
          <PhotoLightbox
            photos={lightboxPhotos}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            propertyAddress={propertyAddress}
          />
        )}
      </CardContent>
    </Card>
  );
}
