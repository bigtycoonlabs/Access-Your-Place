import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Loader2, Image, Star, GripVertical, Check, X,
  Download, Trash2, Eye, EyeOff, Sparkles, Camera, Home,
  ChevronLeft, ChevronRight, ZoomIn, Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Photo {
  id: string;
  url: string;
  description: string;
  room_type?: string;
  is_interior?: boolean;
  is_community_amenity?: boolean;
  quality_score?: number;
  key_features?: string[];
  order: number;
  is_primary: boolean;
  selected: boolean;
}

interface PropertyData {
  city?: string;
  state?: string;
  zipCode?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: number;
  rent?: number;
  propertyType?: string;
}

interface PennyPhotoGalleryProps {
  staffId: string;
  onPhotosSelected?: (photos: Photo[], propertyData: PropertyData | null) => void;
}

export function PennyPhotoGallery({ staffId, onPhotosSelected }: PennyPhotoGalleryProps) {
  const [address, setAddress] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [describingPhotos, setDescribingPhotos] = useState(false);
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [showAccessibilityPanel, setShowAccessibilityPanel] = useState(false);
  const { toast } = useToast();
  
  // For screen reader announcements
  const announceRef = useRef<HTMLDivElement>(null);
  
  const announce = useCallback((message: string) => {
    if (announceRef.current) {
      announceRef.current.textContent = message;
    }
  }, []);

  // Search for property photos
  const searchPhotos = async () => {
    if (!address.trim()) {
      toast({ title: 'Please enter an address', variant: 'destructive' });
      return;
    }

    setLoading(true);
    announce('Searching for property photos, please wait...');

    try {
      const { data, error } = await supabase.functions.invoke('penny-property-photos', {
        body: {
          action: 'scrape_photos',
          address: address.trim(),
          staff_id: staffId,
          include_descriptions: true
        }
      });

      if (error) throw error;

      if (data?.success) {
        setPhotos(data.photos || []);
        setPropertyData(data.property_data || null);
        
        const photoCount = data.photos?.length || 0;
        announce(`Found ${photoCount} interior photos. ${photoCount > 0 ? 'Use arrow keys to navigate photos.' : ''}`);
        
        toast({
          title: data.message || `Found ${photoCount} photos`,
          description: photoCount > 0 ? 'Photos have been analyzed and filtered for interior shots only.' : undefined
        });
      } else {
        throw new Error(data?.error || 'Failed to search photos');
      }
    } catch (err: any) {
      console.error('Photo search error:', err);
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
      announce('Photo search failed. Please try again.');
    }

    setLoading(false);
  };

  // Get AI descriptions for photos (for accessibility)
  const getPhotoDescriptions = async () => {
    if (photos.length === 0) return;

    setDescribingPhotos(true);
    announce('Generating accessibility descriptions for photos...');

    try {
      const { data, error } = await supabase.functions.invoke('penny-property-photos', {
        body: {
          action: 'describe_photos',
          photos: photos,
          staff_id: staffId
        }
      });

      if (error) throw error;

      if (data?.success && data.photos) {
        setPhotos(data.photos);
        announce(`Generated descriptions for ${data.photos.length} photos.`);
        toast({ title: 'Descriptions generated', description: 'AI accessibility descriptions added to all photos.' });
      }
    } catch (err: any) {
      console.error('Description error:', err);
      toast({ title: 'Failed to generate descriptions', variant: 'destructive' });
    }

    setDescribingPhotos(false);
  };

  // Handle drag start
  const handleDragStart = (photoId: string) => {
    setDraggedPhoto(photoId);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedPhoto || draggedPhoto === targetId) return;
  };

  // Handle drop - reorder photos
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedPhoto || draggedPhoto === targetId) return;

    const draggedIndex = photos.findIndex(p => p.id === draggedPhoto);
    const targetIndex = photos.findIndex(p => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newPhotos = [...photos];
    const [removed] = newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(targetIndex, 0, removed);

    // Update order numbers
    const reordered = newPhotos.map((p, idx) => ({ ...p, order: idx }));
    setPhotos(reordered);
    
    announce(`Photo moved to position ${targetIndex + 1}`);
    setDraggedPhoto(null);
  };

  // Toggle photo selection
  const togglePhotoSelection = (photoId: string) => {
    setPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, selected: !p.selected } : p
    ));
  };

  // Set primary photo
  const setPrimaryPhoto = (photoId: string) => {
    setPhotos(prev => prev.map(p => ({
      ...p,
      is_primary: p.id === photoId
    })));
    announce('Primary photo updated');
  };

  // Remove photo
  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    announce('Photo removed');
  };

  // Select all photos
  const selectAll = () => {
    setPhotos(prev => prev.map(p => ({ ...p, selected: true })));
    announce('All photos selected');
  };

  // Deselect all photos
  const deselectAll = () => {
    setPhotos(prev => prev.map(p => ({ ...p, selected: false })));
    announce('All photos deselected');
  };

  // Get selected photos
  const getSelectedPhotos = () => photos.filter(p => p.selected);

  // Keyboard navigation for photo grid
  const handleKeyDown = (e: React.KeyboardEvent, photo: Photo, index: number) => {
    const cols = 3; // Grid columns
    
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        if (index < photos.length - 1) {
          const nextEl = document.getElementById(`photo-${photos[index + 1].id}`);
          nextEl?.focus();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (index > 0) {
          const prevEl = document.getElementById(`photo-${photos[index - 1].id}`);
          prevEl?.focus();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (index + cols < photos.length) {
          const belowEl = document.getElementById(`photo-${photos[index + cols].id}`);
          belowEl?.focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (index - cols >= 0) {
          const aboveEl = document.getElementById(`photo-${photos[index - cols].id}`);
          aboveEl?.focus();
        }
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        togglePhotoSelection(photo.id);
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        setPrimaryPhoto(photo.id);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        removePhoto(photo.id);
        break;
      case 'v':
      case 'V':
        e.preventDefault();
        setPreviewPhoto(photo);
        break;
    }
  };

  // Call onPhotosSelected when photos change
  useEffect(() => {
    if (onPhotosSelected) {
      onPhotosSelected(getSelectedPhotos(), propertyData);
    }
  }, [photos, propertyData]);

  const selectedCount = getSelectedPhotos().length;
  const primaryPhoto = photos.find(p => p.is_primary);

  return (
    <Card className="w-full">
      {/* Screen reader announcements */}
      <div 
        ref={announceRef}
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      />

      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
              Penny Photo Gallery
            </CardTitle>
            <CardDescription>
              Search property addresses to pull interior photos. Community amenities are automatically filtered out.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAccessibilityPanel(!showAccessibilityPanel)}
            aria-pressed={showAccessibilityPanel}
            aria-label="Toggle accessibility panel"
          >
            <Info className="w-4 h-4 mr-2" aria-hidden="true" />
            Accessibility
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Accessibility Panel */}
        {showAccessibilityPanel && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4" role="region" aria-label="Accessibility help">
            <h3 className="font-semibold text-blue-900 mb-2">Keyboard Navigation</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><kbd className="px-1 bg-blue-100 rounded">Arrow keys</kbd> - Navigate between photos</li>
              <li><kbd className="px-1 bg-blue-100 rounded">Space</kbd> or <kbd className="px-1 bg-blue-100 rounded">Enter</kbd> - Select/deselect photo</li>
              <li><kbd className="px-1 bg-blue-100 rounded">P</kbd> - Set as primary photo</li>
              <li><kbd className="px-1 bg-blue-100 rounded">V</kbd> - View photo details</li>
              <li><kbd className="px-1 bg-blue-100 rounded">Delete</kbd> - Remove photo</li>
            </ul>
            <p className="text-sm text-blue-700 mt-3">
              Each photo has an AI-generated description for screen readers. Click "Generate Descriptions" to refresh them.
            </p>
          </div>
        )}

        {/* Search Section */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="property-address" className="sr-only">Property Address</label>
            <Input
              id="property-address"
              placeholder="Enter full property address (e.g., 123 Main St, Austin, TX 78701)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchPhotos()}
              aria-describedby="address-help"
            />
            <p id="address-help" className="sr-only">
              Enter the full property address including street, city, state, and ZIP code
            </p>
          </div>
          <Button
            onClick={searchPhotos}
            disabled={loading || !address.trim()}
            className="bg-[#1a365d] hover:bg-[#2d4a7c]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
            ) : (
              <Search className="w-4 h-4 mr-2" aria-hidden="true" />
            )}
            {loading ? 'Searching...' : 'Search Photos'}
          </Button>
        </div>

        {/* Property Data Summary */}
        {propertyData && (
          <div className="bg-gray-50 rounded-lg p-4" role="region" aria-label="Property details">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Home className="w-4 h-4" aria-hidden="true" />
              Property Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {propertyData.city && (
                <div>
                  <span className="text-gray-500">Location:</span>{' '}
                  <span className="font-medium">{propertyData.city}, {propertyData.state}</span>
                </div>
              )}
              {propertyData.bedrooms && (
                <div>
                  <span className="text-gray-500">Bedrooms:</span>{' '}
                  <span className="font-medium">{propertyData.bedrooms}</span>
                </div>
              )}
              {propertyData.bathrooms && (
                <div>
                  <span className="text-gray-500">Bathrooms:</span>{' '}
                  <span className="font-medium">{propertyData.bathrooms}</span>
                </div>
              )}
              {propertyData.sqft && (
                <div>
                  <span className="text-gray-500">Sq Ft:</span>{' '}
                  <span className="font-medium">{propertyData.sqft.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photo Actions */}
        {photos.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedCount} of {photos.length} selected
              </Badge>
              {primaryPhoto && (
                <Badge className="bg-[#d4a574]">
                  Primary: {primaryPhoto.room_type || 'Photo'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                <Check className="w-4 h-4 mr-1" aria-hidden="true" />
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                <X className="w-4 h-4 mr-1" aria-hidden="true" />
                Deselect All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={getPhotoDescriptions}
                disabled={describingPhotos}
              >
                {describingPhotos ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1" aria-hidden="true" />
                )}
                {describingPhotos ? 'Generating...' : 'Generate Descriptions'}
              </Button>
            </div>
          </div>
        )}

        {/* Photo Grid */}
        {photos.length > 0 ? (
          <div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            role="grid"
            aria-label="Property photos"
          >
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                id={`photo-${photo.id}`}
                role="gridcell"
                tabIndex={0}
                draggable
                onDragStart={() => handleDragStart(photo.id)}
                onDragOver={(e) => handleDragOver(e, photo.id)}
                onDrop={(e) => handleDrop(e, photo.id)}
                onKeyDown={(e) => handleKeyDown(e, photo, index)}
                className={`
                  relative group rounded-lg border-2 overflow-hidden cursor-move
                  focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2
                  ${photo.selected ? 'border-[#d4a574] bg-[#d4a574]/5' : 'border-gray-200'}
                  ${photo.is_primary ? 'ring-2 ring-yellow-400' : ''}
                  ${draggedPhoto === photo.id ? 'opacity-50' : ''}
                `}
                aria-label={`${photo.description}. ${photo.is_primary ? 'Primary photo.' : ''} ${photo.selected ? 'Selected.' : 'Not selected.'}`}
                aria-selected={photo.selected}
              >
                {/* Drag Handle */}
                <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-white/90 rounded p-1" aria-hidden="true">
                    <GripVertical className="w-4 h-4 text-gray-500" />
                  </div>
                </div>

                {/* Primary Badge */}
                {photo.is_primary && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge className="bg-yellow-400 text-yellow-900">
                      <Star className="w-3 h-3 mr-1 fill-current" aria-hidden="true" />
                      Primary
                    </Badge>
                  </div>
                )}

                {/* Photo Image */}
                <div className="aspect-video bg-gray-100 relative">
                  <img
                    src={photo.url}
                    alt={photo.description}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPreviewPhoto(photo)}
                      aria-label="View photo details"
                    >
                      <ZoomIn className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPrimaryPhoto(photo.id)}
                      aria-label="Set as primary photo"
                    >
                      <Star className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removePhoto(photo.id)}
                      aria-label="Remove photo"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {/* Photo Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {photo.room_type || 'Interior'}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {photo.description}
                      </p>
                    </div>
                    <Checkbox
                      checked={photo.selected}
                      onCheckedChange={() => togglePhotoSelection(photo.id)}
                      aria-label={`Select ${photo.room_type || 'photo'}`}
                    />
                  </div>
                  
                  {/* Quality Score */}
                  {photo.quality_score && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-xs text-gray-500">Quality:</span>
                      <div className="flex gap-0.5" aria-label={`Quality score ${photo.quality_score} out of 10`}>
                        {[...Array(10)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              i < photo.quality_score! ? 'bg-[#d4a574]' : 'bg-gray-200'
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Features */}
                  {photo.key_features && photo.key_features.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {photo.key_features.slice(0, 3).map((feature, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : !loading && address && (
          <div className="text-center py-12 text-gray-500">
            <Image className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
            <p>No interior photos found for this address.</p>
            <p className="text-sm mt-1">Try a different address format or check the listing manually.</p>
          </div>
        )}

        {/* Empty State */}
        {photos.length === 0 && !loading && !address && (
          <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-lg">
            <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
            <p className="font-medium">Search for Property Photos</p>
            <p className="text-sm mt-1">Enter a property address above to pull interior photos.</p>
            <p className="text-xs mt-2 text-gray-400">
              Community amenities (pools, gyms, etc.) are automatically filtered out.
            </p>
          </div>
        )}

        {/* Photo Preview Dialog */}
        <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
          <DialogContent className="max-w-3xl" aria-describedby="photo-preview-description">
            <DialogHeader>
              <DialogTitle className="capitalize">
                {previewPhoto?.room_type || 'Property Photo'}
              </DialogTitle>
              <DialogDescription id="photo-preview-description">
                {previewPhoto?.description}
              </DialogDescription>
            </DialogHeader>
            
            {previewPhoto && (
              <div className="space-y-4">
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={previewPhoto.url}
                    alt={previewPhoto.description}
                    className="w-full h-full object-contain"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Room Type:</span>{' '}
                    <span className="font-medium capitalize">{previewPhoto.room_type || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Quality Score:</span>{' '}
                    <span className="font-medium">{previewPhoto.quality_score || 'N/A'}/10</span>
                  </div>
                </div>
                
                {previewPhoto.key_features && previewPhoto.key_features.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500">Key Features:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {previewPhoto.key_features.map((feature, idx) => (
                        <Badge key={idx} variant="secondary">{feature}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPrimaryPhoto(previewPhoto.id);
                      setPreviewPhoto(null);
                    }}
                  >
                    <Star className="w-4 h-4 mr-2" aria-hidden="true" />
                    Set as Primary
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      togglePhotoSelection(previewPhoto.id);
                      setPreviewPhoto(null);
                    }}
                  >
                    {previewPhoto.selected ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2" aria-hidden="true" />
                        Deselect
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
                        Select
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default PennyPhotoGallery;
