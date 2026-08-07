import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Loader2, Image, Trash2, ArrowUp, ArrowDown, Plus, Save, X, GripVertical, Upload,
  Star, AlertCircle, CheckCircle, ImageOff, RefreshCw
} from 'lucide-react';

interface PhotoManagementPanelProps {
  property: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId?: string;
  staffName?: string;
  onSaved: () => void;
}

export function PhotoManagementPanel({ property, open, onOpenChange, staffId, staffName, onSaved }: PhotoManagementPanelProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (property?.photos) {
      setPhotos([...property.photos].filter(Boolean));
    } else {
      setPhotos([]);
    }
    setBrokenImages(new Set());
  }, [property?.id, property?.photos]);

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const updated = [...photos];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setPhotos(updated);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setBrokenImages(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const addPhotoUrl = () => {
    if (!newPhotoUrl.trim()) return;
    setPhotos(prev => [...prev, newPhotoUrl.trim()]);
    setNewPhotoUrl('');
  };

  // File upload to property-photos bucket
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!property?.id) return;
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast({ title: 'No valid images', description: 'Please select image files (JPG, PNG, WebP)', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: imageFiles.length });
    const newUrls: string[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      setUploadProgress({ current: i + 1, total: imageFiles.length });

      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${property.id}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          console.error(`Upload failed for ${file.name}:`, uploadError);
          toast({ title: 'Upload failed', description: `${file.name}: ${uploadError.message}`, variant: 'destructive' });
          continue;
        }

        const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(fileName);
        if (urlData?.publicUrl) {
          newUrls.push(urlData.publicUrl);
          console.log(`[PhotoUpload] Uploaded ${file.name} -> ${urlData.publicUrl}`);

          // Also save to property_photos table
          try {
            await supabase.from('property_photos').insert({
              property_id: property.id,
              original_url: urlData.publicUrl,
              processed_url: urlData.publicUrl,
              display_order: photos.length + newUrls.length - 1,
              is_primary: photos.length === 0 && newUrls.length === 1,
              processing_status: 'completed',
              created_at: new Date().toISOString()
            });
          } catch (dbErr) {
            console.log('property_photos insert skipped:', dbErr);
          }
        }
      } catch (err: any) {
        console.error(`Error uploading ${file.name}:`, err);
      }
    }

    if (newUrls.length > 0) {
      setPhotos(prev => [...prev, ...newUrls]);
      toast({
        title: `${newUrls.length} photo${newUrls.length > 1 ? 's' : ''} uploaded`,
        description: 'Click "Save Photos" to update the property listing.'
      });
    }

    setUploading(false);
    setUploadProgress(null);
  }, [property?.id, photos.length, toast]);

  // Drag and drop file handlers
  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex !== null) return; // photo reorder in progress
    setFileDragOver(true);
  }, [dragIndex]);

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(false);
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(false);
    if (dragIndex !== null) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  }, [dragIndex, uploadFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Photo reorder drag handlers
  const handlePhotoDragStart = (index: number) => setDragIndex(index);
  const handlePhotoDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };
  const handlePhotoDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const updated = [...photos];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(dragOverIndex, 0, moved);
      setPhotos(updated);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Save photos to properties.photos column
  const handleSave = async () => {
    if (!property) return;
    setSaving(true);
    try {
      // Strategy 1: Edge function
      const { data, error } = await supabase.functions.invoke('update-property', {
        body: {
          id: property.id,
          photos: photos,
          updated_by_staff_id: staffId,
          updated_by_staff_name: staffName
        }
      });

      if (error || data?.error) {
        console.log('Edge function failed, using direct DB:', error?.message || data?.error);
        // Strategy 2: Direct DB update
        const { error: dbError } = await supabase.from('properties').update({
          photos: photos,
          updated_at: new Date().toISOString()
        }).eq('id', property.id);
        if (dbError) throw dbError;
      }

      toast({
        title: 'Photos Saved',
        description: `${photos.length} photo${photos.length !== 1 ? 's' : ''} saved for "${property.listing_title || property.address}". Changes are live on the marketplace.`
      });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message || 'Could not update photos', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleImageError = (index: number) => {
    setBrokenImages(prev => new Set(prev).add(index));
  };

  if (!property) return null;

  const brokenCount = brokenImages.size;
  const validCount = photos.length - brokenCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="w-5 h-5 text-indigo-600" />
            Manage Property Photos
          </DialogTitle>
          <DialogDescription>
            {property.listing_title || property.address} — Upload, reorder, or remove photos. Changes are saved to the marketplace.
          </DialogDescription>
        </DialogHeader>

        {/* Photo Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-sm">
            <Image className="w-3.5 h-3.5 mr-1" />{photos.length} photo{photos.length !== 1 ? 's' : ''}
          </Badge>
          {validCount > 0 && (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <CheckCircle className="w-3.5 h-3.5 mr-1" />{validCount} valid
            </Badge>
          )}
          {brokenCount > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200">
              <ImageOff className="w-3.5 h-3.5 mr-1" />{brokenCount} broken
            </Badge>
          )}
        </div>

        {/* Upload Area */}
        <div
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
            fileDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
          }`}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm text-indigo-700 font-medium">
                Uploading {uploadProgress?.current}/{uploadProgress?.total}...
              </p>
              {uploadProgress && (
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-indigo-600 transition-all"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <Upload className={`w-8 h-8 mx-auto mb-2 ${fileDragOver ? 'text-indigo-500' : 'text-gray-400'}`} />
              <p className="text-sm text-gray-600 font-medium">
                {fileDragOver ? 'Drop photos here' : 'Drag & drop photos here, or click to browse'}
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP up to 10MB each</p>
            </>
          )}
        </div>

        {/* Photo Grid */}
        {photos.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900 text-sm">
                Photo Order <span className="text-gray-400 font-normal">(first = cover image)</span>
              </h4>
              {brokenCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const validPhotos = photos.filter((_, i) => !brokenImages.has(i));
                    setPhotos(validPhotos);
                    setBrokenImages(new Set());
                    toast({ title: `Removed ${brokenCount} broken image${brokenCount > 1 ? 's' : ''}` });
                  }}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Remove {brokenCount} Broken
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo, index) => {
                const isBroken = brokenImages.has(index);
                const isDragging = dragIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={`${photo}-${index}`}
                    draggable
                    onDragStart={() => handlePhotoDragStart(index)}
                    onDragOver={(e) => handlePhotoDragOver(e, index)}
                    onDragEnd={handlePhotoDragEnd}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${
                      isDragging ? 'opacity-40 scale-95 border-indigo-400' :
                      isDragOver ? 'border-indigo-500 ring-2 ring-indigo-300 scale-[1.02]' :
                      isBroken ? 'border-red-300 bg-red-50' :
                      index === 0 ? 'border-amber-400 ring-1 ring-amber-200' :
                      'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {/* Image */}
                    {isBroken ? (
                      <div className="w-full h-28 bg-red-50 flex flex-col items-center justify-center">
                        <ImageOff className="w-6 h-6 text-red-400 mb-1" />
                        <span className="text-xs text-red-500">Broken</span>
                      </div>
                    ) : (
                      <img
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-28 object-cover pointer-events-none"
                        draggable={false}
                        onError={() => handleImageError(index)}
                        referrerPolicy="no-referrer"
                      />
                    )}

                    {/* Position badge */}
                    <div className={`absolute top-1.5 left-1.5 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      index === 0 ? 'bg-amber-500' : 'bg-black/60'
                    }`}>
                      {index === 0 ? (
                        <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-current" />Cover</span>
                      ) : `#${index + 1}`}
                    </div>

                    {/* Drag handle - desktop only */}
                    <div className="absolute top-1.5 right-1.5 bg-black/50 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>

                    {/* Desktop: Hover actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center gap-2">
                      {index !== 0 && (
                        <button onClick={() => {
                          const updated = [...photos];
                          const [item] = updated.splice(index, 1);
                          updated.unshift(item);
                          setPhotos(updated);
                        }} className="bg-amber-500/80 hover:bg-amber-600 text-white p-1.5 rounded" title="Set as cover">
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => movePhoto(index, index - 1)} disabled={index === 0}
                        className="bg-white/20 hover:bg-white/40 text-white p-1.5 rounded disabled:opacity-30" title="Move left">
                        <ArrowUp className="w-3.5 h-3.5 -rotate-90" />
                      </button>
                      <button onClick={() => movePhoto(index, index + 1)} disabled={index === photos.length - 1}
                        className="bg-white/20 hover:bg-white/40 text-white p-1.5 rounded disabled:opacity-30" title="Move right">
                        <ArrowDown className="w-3.5 h-3.5 -rotate-90" />
                      </button>
                      <button onClick={() => removePhoto(index)}
                        className="bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Mobile: Always-visible bottom action bar */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex items-center justify-between md:hidden">
                      <div className="flex gap-1">
                        {index !== 0 && (
                          <button onClick={() => {
                            const updated = [...photos];
                            const [item] = updated.splice(index, 1);
                            updated.unshift(item);
                            setPhotos(updated);
                          }} className="bg-amber-500/80 active:bg-amber-600 text-white p-1.5 rounded touch-manipulation" title="Set as cover">
                            <Star className="w-3 h-3" />
                          </button>
                        )}
                        <button onClick={() => movePhoto(index, index - 1)} disabled={index === 0}
                          className="bg-white/20 active:bg-white/40 text-white p-1.5 rounded disabled:opacity-30 touch-manipulation" title="Move left">
                          <ArrowUp className="w-3 h-3 -rotate-90" />
                        </button>
                        <button onClick={() => movePhoto(index, index + 1)} disabled={index === photos.length - 1}
                          className="bg-white/20 active:bg-white/40 text-white p-1.5 rounded disabled:opacity-30 touch-manipulation" title="Move right">
                          <ArrowDown className="w-3 h-3 -rotate-90" />
                        </button>
                      </div>
                      <button onClick={() => removePhoto(index)}
                        className="bg-red-500/80 active:bg-red-600 text-white p-1.5 rounded touch-manipulation" title="Remove">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Drop indicator */}
                    {isDragOver && dragIndex !== index && (
                      <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center pointer-events-none">
                        <div className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">Drop here</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Image className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No photos yet. Upload files above or add URLs below.</p>
          </div>
        )}

        {/* Add Photo URL */}
        <div className="bg-gray-50 p-3 rounded-lg border">
          <Label className="text-xs font-medium flex items-center gap-1.5 mb-1.5" htmlFor="add-photo-by-url">
            <Plus className="w-3.5 h-3.5" /> Add Photo by URL
          </Label>
          <div className="flex gap-2">
            <Input id="add-photo-by-url"
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              onKeyDown={(e) => e.key === 'Enter' && addPhotoUrl()}
              className="text-sm"
            />
            <Button onClick={addPhotoUrl} disabled={!newPhotoUrl.trim()} size="sm" className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save {photos.length} Photo{photos.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
