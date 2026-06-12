import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  GripVertical, 
  Loader2, 
  Plus,
  Star,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
  Move,
  RefreshCw,
  Zap,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PropertyPhoto {
  id: string;
  url: string;
  order: number;
  is_primary: boolean;
  processing_status?: string;
  address_detected?: boolean;
  address_blurred?: boolean;
  thumbnail_url?: string;
}

interface PhotoUploadManagerProps {
  propertyId: string;
  existingPhotos: PropertyPhoto[];
  onPhotosChange: (photos: PropertyPhoto[]) => void;
}

export function PhotoUploadManager({ propertyId, existingPhotos, onPhotosChange }: PhotoUploadManagerProps) {
  const [photos, setPhotos] = useState<PropertyPhoto[]>(existingPhotos);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null);
  const [dragOverPhoto, setDragOverPhoto] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Check processing status periodically
  useEffect(() => {
    const checkProcessingStatus = async () => {
      if (!propertyId) return;
      
      try {
        const { data } = await supabase.functions.invoke('background-photo-processing', {
          body: { action: 'get_processing_status', property_id: propertyId }
        });

        if (data?.photos) {
          const statusMap: Record<string, string> = {};
          data.photos.forEach((p: any) => {
            statusMap[p.id] = p.processing_status || 'pending';
          });
          setProcessingStatus(statusMap);
          
          const stillProcessing = data.photos.some((p: any) => 
            p.processing_status === 'processing' || p.processing_status === 'pending'
          );
          setIsProcessing(stillProcessing);
        }
      } catch (err) {
        console.error('Error checking processing status:', err);
      }
    };

    checkProcessingStatus();
    const interval = setInterval(checkProcessingStatus, 5000);
    return () => clearInterval(interval);
  }, [propertyId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedPhoto) {
      setDragOver(true);
    }
  }, [draggedPhoto]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (draggedPhoto) return;
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      await uploadFiles(files);
    }
  }, [propertyId, draggedPhoto]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    const newPhotos: PropertyPhoto[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${propertyId}/${Date.now()}-${i}.${fileExt}`;

        const { error } = await supabase.storage
          .from('property-photos')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (error) {
          console.error('Upload error:', error);
          toast({ title: 'Upload failed', description: `Failed to upload ${file.name}`, variant: 'destructive' });
          continue;
        }

        const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(fileName);

        const newPhoto: PropertyPhoto = {
          id: `photo-${Date.now()}-${i}`,
          url: urlData.publicUrl,
          order: photos.length + newPhotos.length,
          is_primary: photos.length === 0 && newPhotos.length === 0,
          processing_status: 'pending'
        };

        newPhotos.push(newPhoto);

        // Save to property_photos table
        try {
          await supabase.from('property_photos').insert({
            property_id: propertyId,
            original_url: urlData.publicUrl,
            processed_url: urlData.publicUrl,
            display_order: newPhoto.order,
            is_primary: newPhoto.is_primary,
            processing_status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.error('Error saving to property_photos:', dbErr);
        }
      }

      if (newPhotos.length > 0) {
        const updatedPhotos = [...photos, ...newPhotos];
        setPhotos(updatedPhotos);
        onPhotosChange(updatedPhotos);
        
        // Trigger background processing
        try {
          await supabase.functions.invoke('background-photo-processing', {
            body: { action: 'process_property', property_id: propertyId }
          });
          setIsProcessing(true);
        } catch (err) {
          console.error('Error triggering background processing:', err);
        }
        
        toast({ title: 'Photos uploaded', description: `Successfully uploaded ${newPhotos.length} photo(s). Processing in background...` });
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }

    setUploading(false);
  };

  const deletePhoto = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    try {
      const urlParts = photo.url.split('/property-photos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('property-photos').remove([filePath]);
      }

      // Delete from property_photos table
      try {
        await supabase.from('property_photos')
          .delete()
          .eq('property_id', propertyId)
          .or(`original_url.eq.${photo.url},processed_url.eq.${photo.url}`);
      } catch (dbErr) {
        console.error('Error deleting from property_photos:', dbErr);
      }

      const updatedPhotos = photos
        .filter(p => p.id !== photoId)
        .map((p, idx) => ({ ...p, order: idx, is_primary: idx === 0 }));
      
      setPhotos(updatedPhotos);
      onPhotosChange(updatedPhotos);
      setDeleteConfirm(null);
      toast({ title: 'Photo deleted' });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const movePhoto = (photoId: string, direction: 'up' | 'down') => {
    const idx = photos.findIndex(p => p.id === photoId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === photos.length - 1) return;

    const newPhotos = [...photos];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newPhotos[idx], newPhotos[swapIdx]] = [newPhotos[swapIdx], newPhotos[idx]];
    
    const updatedPhotos = newPhotos.map((p, i) => ({ ...p, order: i, is_primary: i === 0 }));
    setPhotos(updatedPhotos);
    onPhotosChange(updatedPhotos);

    // Update display order in property_photos table
    updatedPhotos.forEach(async (photo, i) => {
      try {
        await supabase.from('property_photos')
          .update({ display_order: i, is_primary: i === 0 })
          .eq('property_id', propertyId)
          .or(`original_url.eq.${photo.url},processed_url.eq.${photo.url}`);
      } catch (err) {
        console.error('Error updating photo order:', err);
      }
    });
  };

  const setPrimaryPhoto = (photoId: string) => {
    const idx = photos.findIndex(p => p.id === photoId);
    if (idx === -1 || idx === 0) return;

    const newPhotos = [...photos];
    const [photo] = newPhotos.splice(idx, 1);
    newPhotos.unshift(photo);
    
    const updatedPhotos = newPhotos.map((p, i) => ({ ...p, order: i, is_primary: i === 0 }));
    setPhotos(updatedPhotos);
    onPhotosChange(updatedPhotos);
    toast({ title: 'Primary photo updated' });

    // Update in property_photos table
    updatedPhotos.forEach(async (photo, i) => {
      try {
        await supabase.from('property_photos')
          .update({ display_order: i, is_primary: i === 0 })
          .eq('property_id', propertyId)
          .or(`original_url.eq.${photo.url},processed_url.eq.${photo.url}`);
      } catch (err) {
        console.error('Error updating photo order:', err);
      }
    });
  };

  // Drag and drop reordering handlers
  const handlePhotoDragStart = (e: React.DragEvent, photoId: string) => {
    setDraggedPhoto(photoId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', photoId);
    setTimeout(() => {
      const element = e.target as HTMLElement;
      element.style.opacity = '0.5';
    }, 0);
  };

  const handlePhotoDragEnd = (e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.style.opacity = '1';
    setDraggedPhoto(null);
    setDragOverPhoto(null);
  };

  const handlePhotoDragOver = (e: React.DragEvent, photoId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedPhoto && draggedPhoto !== photoId) {
      setDragOverPhoto(photoId);
    }
  };

  const handlePhotoDragLeaveItem = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPhoto(null);
  };

  const handlePhotoDrop = (e: React.DragEvent, targetPhotoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedPhoto || draggedPhoto === targetPhotoId) {
      setDraggedPhoto(null);
      setDragOverPhoto(null);
      return;
    }

    const draggedIdx = photos.findIndex(p => p.id === draggedPhoto);
    const targetIdx = photos.findIndex(p => p.id === targetPhotoId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedPhoto(null);
      setDragOverPhoto(null);
      return;
    }

    const newPhotos = [...photos];
    const [draggedItem] = newPhotos.splice(draggedIdx, 1);
    newPhotos.splice(targetIdx, 0, draggedItem);

    const updatedPhotos = newPhotos.map((p, i) => ({ ...p, order: i, is_primary: i === 0 }));
    setPhotos(updatedPhotos);
    onPhotosChange(updatedPhotos);
    setDraggedPhoto(null);
    setDragOverPhoto(null);
    
    toast({ title: 'Photos reordered', description: 'Drag and drop to continue arranging' });

    // Update display order in property_photos table
    updatedPhotos.forEach(async (photo, i) => {
      try {
        await supabase.from('property_photos')
          .update({ display_order: i, is_primary: i === 0 })
          .eq('property_id', propertyId)
          .or(`original_url.eq.${photo.url},processed_url.eq.${photo.url}`);
      } catch (err) {
        console.error('Error updating photo order:', err);
      }
    });
  };

  const reprocessPhotos = async () => {
    try {
      await supabase.functions.invoke('background-photo-processing', {
        body: { action: 'reprocess_failed', property_id: propertyId }
      });
      setIsProcessing(true);
      toast({ title: 'Reprocessing started', description: 'Failed photos are being reprocessed' });
    } catch (err) {
      toast({ title: 'Reprocess failed', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status?: string, addressDetected?: boolean) => {
    if (status === 'processing') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
    }
    if (status === 'failed') {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    }
    if (status === 'completed') {
      if (addressDetected) {
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Shield className="w-3 h-3 mr-1" />Address Found</Badge>;
      }
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Check className="w-3 h-3 mr-1" />Processed</Badge>;
    }
    return <Badge variant="outline" className="bg-gray-50 text-gray-600"><Zap className="w-3 h-3 mr-1" />Pending</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Processing Status Banner */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">Processing photos in background...</p>
            <p className="text-xs text-blue-600">Photos are being optimized, resized, and checked for visible addresses</p>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragOver ? 'border-[#d4a574] bg-[#d4a574]/10' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-[#d4a574]" />
            <p className="text-gray-600">Uploading photos...</p>
          </div>
        ) : (
          <>
            <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-[#d4a574]' : 'text-gray-400'}`} />
            <p className="text-gray-600 mb-2">Drag and drop photos here, or click to browse</p>
            <p className="text-sm text-gray-400 mb-4">Supports JPG, PNG, WebP (max 10MB each)</p>
            <label className="cursor-pointer">
              <input type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
              <Button type="button" variant="outline" className="pointer-events-none">
                <Plus className="w-4 h-4 mr-2" />Select Photos
              </Button>
            </label>
          </>
        )}
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Property Photos ({photos.length})</h4>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Move className="w-4 h-4" />
                <span>Drag to reorder</span>
              </div>
              <Button variant="outline" size="sm" onClick={reprocessPhotos}>
                <RefreshCw className="w-4 h-4 mr-1" />Reprocess
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo, idx) => (
              <div 
                key={photo.id}
                draggable
                onDragStart={(e) => handlePhotoDragStart(e, photo.id)}
                onDragEnd={handlePhotoDragEnd}
                onDragOver={(e) => handlePhotoDragOver(e, photo.id)}
                onDragLeave={handlePhotoDragLeaveItem}
                onDrop={(e) => handlePhotoDrop(e, photo.id)}
                className={`relative group rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all duration-200 ${
                  photo.is_primary ? 'border-[#d4a574] ring-2 ring-[#d4a574]/30' : 'border-gray-200 hover:border-gray-300'
                } ${draggedPhoto === photo.id ? 'opacity-50 scale-95' : ''} ${
                  dragOverPhoto === photo.id ? 'border-blue-500 ring-2 ring-blue-500/30 scale-105' : ''
                }`}
              >
                <div className="absolute top-2 left-2 z-10 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-4 h-4" />
                </div>

                <img src={photo.url} alt={`Property photo ${idx + 1}`} className="w-full h-32 object-cover pointer-events-none" draggable={false} />
                
                {photo.is_primary && (
                  <div className="absolute top-2 left-8 bg-[#d4a574] text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />Cover
                  </div>
                )}
                
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">#{idx + 1}</div>

                {/* Processing Status Badge */}
                <div className="absolute bottom-2 left-2">
                  {getStatusBadge(photo.processing_status || processingStatus[photo.id], photo.address_detected)}
                </div>

                {dragOverPhoto === photo.id && draggedPhoto !== photo.id && (
                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                    <div className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full">Drop here</div>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!photo.is_primary && (
                    <Button size="sm" variant="secondary" className="h-8" onClick={(e) => { e.stopPropagation(); setPrimaryPhoto(photo.id); }} title="Set as cover">
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" className="h-8" onClick={(e) => { e.stopPropagation(); movePhoto(photo.id, 'up'); }} disabled={idx === 0} title="Move up">
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="secondary" className="h-8" onClick={(e) => { e.stopPropagation(); movePhoto(photo.id, 'down'); }} disabled={idx === photos.length - 1} title="Move down">
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(photo.id); }} title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-start gap-2">
            <Move className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Tip:</strong> Drag and drop photos to rearrange them. The first photo will be used as the cover image. 
              Photos are automatically processed to optimize size and detect visible addresses.
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />Delete Photo?
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">Are you sure you want to delete this photo? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deletePhoto(deleteConfirm)}>
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Photo Upload Modal
interface PhotoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyAddress: string;
  existingPhotos: string[];
  onSave: (photos: string[]) => Promise<void>;
}

export function PhotoUploadModal({ open, onOpenChange, propertyId, propertyAddress, existingPhotos, onSave }: PhotoUploadModalProps) {
  const [photos, setPhotos] = useState<PropertyPhoto[]>(
    existingPhotos.map((url, idx) => ({ id: `existing-${idx}`, url, order: idx, is_primary: idx === 0 }))
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handlePhotosChange = (newPhotos: PropertyPhoto[]) => setPhotos(newPhotos);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(photos.map(p => p.url));
      toast({ title: 'Photos saved successfully' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Failed to save photos', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#d4a574]" />Manage Photos
          </DialogTitle>
          <p className="text-sm text-gray-500">{propertyAddress}</p>
        </DialogHeader>
        <PhotoUploadManager propertyId={propertyId} existingPhotos={photos} onPhotosChange={handlePhotosChange} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Save Photos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
