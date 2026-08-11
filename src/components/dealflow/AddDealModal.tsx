import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Plus, Star, Building2, Users, Upload, Image as ImageIcon, 

  Trash2, ArrowUp, ArrowDown, X, AlertCircle, ShieldCheck, Shield,
  Zap, CheckCircle, Copy, XCircle, ShieldAlert, WifiOff, Server, Clock, Info, AlertTriangle,
  Bot, Sparkles, RotateCcw, DollarSign, BarChart3, TrendingUp
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { handleDealError, ClassifiedError } from '@/utils/dealErrorHandler';

/**
 * Safely parse a string/number to a float, returning `null` instead of `NaN`.
 *
 * DB schema note — the properties table financial columns
 * (sqft, adr_peak_season, adr_slow_season, monthly_room_rate,
 *  avg_occupancy_rate, projected_yearly_revenue, projected_monthly_revenue_peak,
 *  projected_monthly_revenue_slow, peak_season_description, deposits_concessions_notes)
 * were added via ALTER TABLE and are **nullable** — sending `null` is safe.
 *
 * The only NOT NULL columns in the properties table are `city` and `state`.
 */
function safeParseFloat(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === '') return null;
  try {
    const num = parseFloat(str);
    return Number.isNaN(num) || !Number.isFinite(num) ? null : num;
  } catch {
    return null;
  }
}



interface AddDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (deal: any) => Promise<void>;
  staffId?: string;
  staffName?: string;
}

interface PhotoItem {
  id: string;
  url: string;
  file?: File;
  order: number;
  is_primary: boolean;
}

const categories = [
  { id: 'str', label: 'Short-Term Rental' },
  { id: 'coliving', label: 'Co-Living' },
  { id: 'peerspace', label: 'Peer Space / Event Venue' },
  { id: 'unique', label: 'Unique Opportunity' },
  { id: 'apartment_community', label: 'Apartment Community' },
  { id: 'townhome_community', label: 'Townhome/SFH Community' },
  { id: 'private_landlord', label: 'Private Landlord' }
];

// Error category icon mapping
function ErrorIcon({ category }: { category: string }) {
  switch (category) {
    case 'rls_permission': return <ShieldAlert className="w-4 h-4 text-orange-500" />;
    case 'network': return <WifiOff className="w-4 h-4 text-red-500" />;
    case 'edge_function_502': return <Server className="w-4 h-4 text-red-500" />;
    case 'edge_function_timeout': return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'auth_expired': return <ShieldAlert className="w-4 h-4 text-red-500" />;
    default: return <AlertTriangle className="w-4 h-4 text-red-500" />;
  }
}

function getErrorColors(category: string) {
  switch (category) {
    case 'rls_permission': return 'bg-orange-50 border-orange-300 text-orange-900';
    case 'network': return 'bg-red-50 border-red-300 text-red-900';
    case 'edge_function_502': return 'bg-red-50 border-red-300 text-red-900';
    case 'edge_function_timeout': return 'bg-yellow-50 border-yellow-300 text-yellow-900';
    case 'auth_expired': return 'bg-red-50 border-red-300 text-red-900';
    case 'validation': return 'bg-blue-50 border-blue-300 text-blue-900';
    case 'storage': return 'bg-purple-50 border-purple-300 text-purple-900';
    default: return 'bg-red-50 border-red-300 text-red-900';
  }
}


export function AddDealModal({ open, onOpenChange, onAdd, staffId, staffName }: AddDealModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastError, setLastError] = useState<ClassifiedError | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [pennyMarketData, setPennyMarketData] = useState<any>(null);
  const { toast } = useToast();

  
  const [form, setForm] = useState({
    address: '', city: '', state: '', zip_code: '', bedrooms: '3', bathrooms: '2',
    monthly_rent: '', property_type: 'single_family', listing_title: '', description: '',
    landlord_name: '', landlord_phone: '', landlord_email: '', listing_url: '', acquisition_fee: '2500',
    is_furnished: false, is_featured: false, operation_type: 'str', selected_categories: [] as string[],
    source: 'acquisition_team',
    is_verified: false,
    staff_verified: false,
    // Financial projections
    adr_peak_season: '', adr_slow_season: '', monthly_room_rate: '',
    avg_occupancy_rate: '', projected_yearly_revenue: '', projected_monthly_revenue_peak: '',
    projected_monthly_revenue_slow: '', peak_season_description: '', deposits_concessions_notes: '',
    sqft: '',
  });


  /** Show a classified error toast and persist the error in the inline panel */
  const showError = (err: unknown, operation: Parameters<typeof handleDealError>[1], context?: Record<string, any>) => {
    const { toast: toastData, classified } = handleDealError(err, operation, context);
    setLastError(classified);
    toast(toastData);
    return classified;
  };

  /** Copy error reference to clipboard */
  const copyErrorRef = () => {
    if (!lastError) return;
    const text = `Error Reference: ${lastError.errorCode}\nCategory: ${lastError.category}\nTime: ${lastError.timestamp}\nOperation: Add Deal\nAddress: ${form.address}, ${form.city}, ${form.state}\nDetails: ${lastError.rawMessage.slice(0, 300)}`;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied to clipboard', description: 'Error details copied — paste into your support message.' });
    });
  };

  const toggleCategory = (id: string) => {
    setForm(f => ({
      ...f,
      selected_categories: f.selected_categories.includes(id)
        ? f.selected_categories.filter(c => c !== id)
        : [...f.selected_categories, id]
    }));
  };

  // Penny AI Description Generator
  const handlePennyDescription = async () => {
    if (!form.city || !form.state) {
      toast({ title: 'City and State required', description: 'Please fill in the city and state before generating a description.', variant: 'destructive' });
      return;
    }
    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke('penny-generate-description', {
        body: {
          address: form.address,
          city: form.city,
          state: form.state,
          zip_code: form.zip_code,
          bedrooms: parseInt(form.bedrooms) || 3,
          bathrooms: parseFloat(form.bathrooms) || 2,
          monthly_rent: parseFloat(form.monthly_rent) || 0,
          property_type: form.property_type,
          operation_type: form.operation_type,
          listing_title: form.listing_title,
          acquisition_fee: parseFloat(form.acquisition_fee) || 2500,
          is_furnished: form.is_furnished,
          staff_name: staffName || 'Acquisition Team',
          description: form.description
        }
      });
      if (error) throw error;
      if (data?.success && data.description) {
        setForm(f => ({ ...f, description: data.description }));
        if (data.market_data) setPennyMarketData(data.market_data);
        toast({ title: 'Description generated by Penny AI', description: 'Review and edit the description to match Access Your Place standards.' });
      } else {
        throw new Error(data?.error || 'Failed to generate description');
      }
    } catch (err: any) {
      console.error('Penny description error:', err);
      toast({ title: 'Description generation failed', description: err.message || 'Please try again.', variant: 'destructive' });
    }
    setGeneratingDescription(false);
  };



  // Photo handling functions
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      await addPhotos(files);
    }
  }, [photos]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      await addPhotos(files);
    }
    e.target.value = ''; // Reset input
  };

  const addPhotos = async (files: File[]) => {
    const newPhotos: PhotoItem[] = files.map((file, idx) => ({
      id: `new-${Date.now()}-${idx}`,
      url: URL.createObjectURL(file),
      file,
      order: photos.length + idx,
      is_primary: photos.length === 0 && idx === 0
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
    toast({ title: `${files.length} photo(s) added`, description: 'Photos will be uploaded when you save the deal' });
  };

  const removePhoto = (photoId: string) => {
    setPhotos(prev => {
      const filtered = prev.filter(p => p.id !== photoId);
      return filtered.map((p, idx) => ({ ...p, order: idx, is_primary: idx === 0 }));
    });
  };

  const movePhoto = (photoId: string, direction: 'up' | 'down') => {
    const idx = photos.findIndex(p => p.id === photoId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === photos.length - 1) return;

    const newPhotos = [...photos];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newPhotos[idx], newPhotos[swapIdx]] = [newPhotos[swapIdx], newPhotos[idx]];
    
    setPhotos(newPhotos.map((p, i) => ({ ...p, order: i, is_primary: i === 0 })));
  };

  const uploadPhotosToStorage = async (propertyId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const photo of photos) {
      if (photo.file) {
        const fileExt = photo.file.name.split('.').pop();
        const fileName = `${propertyId}/${Date.now()}-${photo.order}.${fileExt}`;
        
        const { error } = await supabase.storage
          .from('property-photos')
          .upload(fileName, photo.file, { cacheControl: '3600', upsert: false });

        if (!error) {
          const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(fileName);
          uploadedUrls.push(urlData.publicUrl);
        } else {
          console.error(`Photo upload failed for ${fileName}:`, error);
          // Don't throw — continue uploading remaining photos
        }
      } else {
        uploadedUrls.push(photo.url);
      }
    }
    
    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!form.address || !form.city || !form.state || !form.monthly_rent) {
      toast({ title: 'Missing required fields', description: 'Please fill in address, city, state, and monthly rent', variant: 'destructive' });
      return;
    }
    
    // Clear previous error
    setLastError(null);
    setLoading(true);

    try {
      // Build property data with ONLY columns known to exist in the properties table.
      // CRITICAL FIX: Removed `staff_verified` — this column does not exist in the DB schema
      // and was causing the entire insert to fail with a "column does not exist" error.
      // The `staff_verified` UI toggle now maps to `is_verified` when enabled.
      const effectiveVerified = form.is_verified || form.staff_verified;
      
      const propertyData: Record<string, any> = {
        address: form.address,
        listing_title: form.listing_title || `${form.bedrooms}BR in ${form.city}`,
        title: form.listing_title || `${form.bedrooms}BR in ${form.city}`,
        city: form.city,
        state: form.state.toUpperCase(),
        zip_code: form.zip_code,
        bedrooms: parseInt(form.bedrooms) || 3,
        bathrooms: parseFloat(form.bathrooms) || 2,
        monthly_rent: parseFloat(form.monthly_rent) || 0,
        property_type: form.property_type,
        operation_type: form.operation_type,
        description: form.description,
        landlord_name: form.landlord_name,
        landlord_phone: form.landlord_phone,
        landlord_email: form.landlord_email,
        listing_url: form.listing_url,
        acquisition_fee: parseFloat(form.acquisition_fee) || 2500,
        is_furnished: form.is_furnished,
        is_featured: form.is_featured,
        is_verified: effectiveVerified,
        property_categories: form.selected_categories,
        source: form.source,
        status: 'active',
        deal_status: 'active',
        workflow_stage: 'new_lead',
        penny_score: Math.floor(Math.random() * 30) + 70,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // ── Financial projection fields ──
        // All financial columns are NULLABLE in the DB (added via ALTER TABLE).
        // We always include every field explicitly so the insert payload is
        // deterministic. safeParseFloat returns `null` (not NaN) for empty /
        // invalid values, which Postgres accepts for nullable columns.
        sqft: safeParseFloat(form.sqft),
        monthly_room_rate: safeParseFloat(form.monthly_room_rate),
        adr_peak_season: safeParseFloat(form.adr_peak_season),
        adr_slow_season: safeParseFloat(form.adr_slow_season),
        avg_occupancy_rate: safeParseFloat(form.avg_occupancy_rate),
        projected_yearly_revenue: safeParseFloat(form.projected_yearly_revenue),
        projected_monthly_revenue_peak: safeParseFloat(form.projected_monthly_revenue_peak),
        projected_monthly_revenue_slow: safeParseFloat(form.projected_monthly_revenue_slow),
        peak_season_description: form.peak_season_description?.trim() || null,
        deposits_concessions_notes: form.deposits_concessions_notes?.trim() || null,

      };



      let propertyId: string | null = null;
      let createdProperty: any = null;
      let usedDirectDatabase = false;

      // Try direct database insert first (more reliable)
      let directInsertError: any = null;
      try {
        console.log('Attempting direct database insert...');
        const { data: directData, error: dbError } = await supabase
          .from('properties')
          .insert(propertyData)
          .select()
          .single();
        
        if (dbError) {
          console.error('Direct database insert failed:', dbError);
          directInsertError = dbError;
          throw dbError;
        }
        
        propertyId = directData?.id;
        createdProperty = directData;
        usedDirectDatabase = true;
        console.log('Direct database insert successful:', propertyId);
      } catch (directError: any) {
        console.log('Direct insert failed, trying edge function:', directError.message);
        
        // Fallback to edge function
        try {
          const { data, error } = await supabase.functions.invoke('new-deal-create', {
            body: propertyData
          });
          
          if (error || data?.error) {
            // Both methods failed — build a combined error for detailed classification
            const combinedMessage = `Direct DB: ${directInsertError?.message || directError.message} | Edge Function: ${error?.message || data?.error || 'unknown'}`;
            const combinedError = new Error(combinedMessage);
            // Attach status code from edge function if available
            if (error && typeof error === 'object') {
              (combinedError as any).status = (error as any).status || (error as any).statusCode;
            }
            // Also attach the original DB error code for RLS detection
            if (directInsertError?.code) {
              (combinedError as any).code = directInsertError.code;
            }
            throw combinedError;
          }
          
          propertyId = data?.property?.id;
          createdProperty = data?.property;
        } catch (edgeFnError: any) {
          // If the edge function catch itself threw (not the combined error), wrap it
          if (edgeFnError.message?.startsWith('Direct DB:')) {
            throw edgeFnError; // Already a combined error
          }
          console.error('Edge function also failed:', edgeFnError.message);
          const combinedError = new Error(
            `Direct DB: ${directInsertError?.message || directError.message} | Edge Function: ${edgeFnError.message}`
          );
          if (directInsertError?.code) {
            (combinedError as any).code = directInsertError.code;
          }
          throw combinedError;
        }
      }
      
      // Upload photos if any
      if (photos.length > 0 && propertyId) {
        setUploading(true);
        try {
          const photoUrls = await uploadPhotosToStorage(propertyId);
          
          // Update property with photo URLs using direct database
          if (photoUrls.length > 0) {
            const { error: photoUpdateError } = await supabase
              .from('properties')
              .update({ photos: photoUrls, updated_at: new Date().toISOString() })
              .eq('id', propertyId);
            
            if (photoUpdateError) {
              console.error('Error updating photos:', photoUpdateError);
              // Try edge function as fallback
              try {
                await supabase.functions.invoke('update-property', {
                  body: { 
                    id: propertyId, 
                    photos: photoUrls,
                    updated_by_staff_id: staffId,
                    updated_by_staff_name: staffName
                  }
                });
              } catch (e) {
                console.error('Edge function photo update also failed:', e);
              }
            }

            // Report partial success if some photos failed
            if (photoUrls.length < photos.length) {
              const failedCount = photos.length - photoUrls.length;
              toast({
                title: 'Some photos failed to upload',
                description: `${photoUrls.length} of ${photos.length} photos uploaded successfully. ${failedCount} photo(s) failed — you can re-upload them from the deal detail view.`,
                variant: 'destructive',
              });
            }
          }
        } catch (photoError: any) {
          console.error('Photo upload error:', photoError);
          // Deal was created, so show a partial-success error
          showError(photoError, 'photos', { propertyId, photoCount: photos.length });
          toast({
            title: 'Deal created, but photos failed',
            description: 'The deal was saved successfully. Photos could not be uploaded — you can add them later from the deal detail view.',
            variant: 'destructive',
          });
        }
        setUploading(false);
      }
      
      toast({ 
        title: 'Deal added successfully!', 
        description: `Property at ${form.address} has been added to deal flow${photos.length > 0 ? ` with ${photos.length} photos` : ''}.${usedDirectDatabase ? '' : ' (via edge function)'}` 
      });
      await onAdd(createdProperty || {});
      
      // Reset form
      setForm({ 
        address: '', city: '', state: '', zip_code: '', bedrooms: '3', bathrooms: '2',
        monthly_rent: '', property_type: 'single_family', listing_title: '', description: '',
        landlord_name: '', landlord_phone: '', landlord_email: '', listing_url: '', acquisition_fee: '2500',
        is_furnished: false, is_featured: false, operation_type: 'str', selected_categories: [], 
        source: 'acquisition_team', is_verified: false, staff_verified: false,
        // Reset financial projection fields
        adr_peak_season: '', adr_slow_season: '', monthly_room_rate: '',
        avg_occupancy_rate: '', projected_yearly_revenue: '', projected_monthly_revenue_peak: '',
        projected_monthly_revenue_slow: '', peak_season_description: '', deposits_concessions_notes: '',
        sqft: '',
      });

      setPhotos([]);
      setActiveTab('details');
      setLastError(null);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Deal creation error:', err);
      showError(err, 'add', {
        address: form.address,
        city: form.city,
        state: form.state,
        source: form.source,
      });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) setLastError(null); onOpenChange(isOpen); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="add-deal-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" aria-hidden="true" />
            Add New Deal
          </DialogTitle>
          <p id="add-deal-description" className="sr-only">Form to add a new property deal to the system</p>
        </DialogHeader>

        {/* Inline Error Detail Panel */}
        {lastError && (
          <div className={`p-3 rounded-lg border ${getErrorColors(lastError.category)}`}>
            <div className="flex items-start gap-2">
              <ErrorIcon category={lastError.category} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm">{lastError.title}</h4>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-mono bg-white/60 px-1.5 py-0.5 rounded">{lastError.errorCode}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs"
                      onClick={copyErrorRef}
                      title="Copy error details for support"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setLastError(null)}
                      title="Dismiss"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs mt-1 opacity-90">{lastError.description}</p>
                <div className="mt-1.5 p-1.5 bg-white/40 rounded text-xs">
                  <p className="font-medium flex items-center gap-1"><Info className="w-3 h-3" /> What to do:</p>
                  <p className="mt-0.5">{lastError.supportAction}</p>
                </div>
                <p className="text-xs mt-1 opacity-50">
                  {new Date(lastError.timestamp).toLocaleTimeString()} — {lastError.category}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="financials">
              <DollarSign className="w-3 h-3 mr-1" aria-hidden="true" />
              Financials
            </TabsTrigger>
            <TabsTrigger value="verification">
              Verification
              {(form.is_verified || form.staff_verified) && (
                <CheckCircle className="w-3 h-3 ml-1 text-green-500" />
              )}
            </TabsTrigger>
            <TabsTrigger value="photos">
              Photos {photos.length > 0 && <span className="ml-1 text-xs bg-[#d4a574] text-white px-1.5 rounded-full">{photos.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="landlord">Landlord</TabsTrigger>
          </TabsList>

          
          {/* Property Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Deal Source Selection */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <Label className="font-semibold text-blue-800 mb-3 block">Deal Source *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({...form, source: 'acquisition_team'})}
                  className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                    form.source === 'acquisition_team' 
                      ? 'border-blue-500 bg-blue-100 text-blue-800' 
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                  aria-pressed={form.source === 'acquisition_team'}
                >
                  <Building2 className={`w-6 h-6 ${form.source === 'acquisition_team' ? 'text-blue-600' : 'text-gray-400'}`} aria-hidden="true" />
                  <div className="text-left">
                    <p className="font-semibold">YP Acquisition Team</p>
                    <p className="text-xs text-gray-600">Found by our internal team</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({...form, source: 'third_party'})}
                  className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                    form.source === 'third_party' 
                      ? 'border-purple-500 bg-purple-100 text-purple-800' 
                      : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}
                  aria-pressed={form.source === 'third_party'}
                >
                  <Users className={`w-6 h-6 ${form.source === 'third_party' ? 'text-purple-600' : 'text-gray-400'}`} aria-hidden="true" />
                  <div className="text-left">
                    <p className="font-semibold">Third-Party Vendor</p>
                    <p className="text-xs text-gray-600">Sourced from external partner</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="listing_title">Listing Title</Label>
              <Input 
                id="listing_title"
                value={form.listing_title} 
                onChange={e => setForm({...form, listing_title: e.target.value})} 
                placeholder="Beautiful 3BR Home in Austin" 
                aria-describedby="listing_title_help"
              />
              <p id="listing_title_help" className="text-xs text-gray-500 mt-1">Leave blank to auto-generate</p>
            </div>
            
            <div>
              <Label htmlFor="address">Address * <span className="text-xs text-gray-500">(Hidden from public view)</span></Label>
              <Input 
                id="address"
                value={form.address} 
                onChange={e => setForm({...form, address: e.target.value})} 
                placeholder="123 Main St" 
                required 
                aria-required="true"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input 
                  id="city"
                  value={form.city} 
                  onChange={e => setForm({...form, city: e.target.value})} 
                  placeholder="Austin" 
                  required 
                  aria-required="true"
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input 
                  id="state"
                  value={form.state} 
                  onChange={e => setForm({...form, state: e.target.value})} 
                  placeholder="TX" 
                  maxLength={2} 
                  required 
                  aria-required="true"
                />
              </div>
              <div>
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input 
                  id="zip_code"
                  value={form.zip_code} 
                  onChange={e => setForm({...form, zip_code: e.target.value})} 
                  placeholder="78701" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="property_type">Property Type</Label>
                <Select value={form.property_type} onValueChange={v => setForm({...form, property_type: v})}>
                  <SelectTrigger id="property_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_family">Single Family</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="townhome">Townhome</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="multi_family">Multi-Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="operation_type">Operation Type</Label>
                <Select value={form.operation_type} onValueChange={v => setForm({...form, operation_type: v})}>
                  <SelectTrigger id="operation_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="str">STR (Short-Term Rental)</SelectItem>
                    <SelectItem value="coliving">Co-Living</SelectItem>
                    <SelectItem value="peerspace">Peer Space / Event Venue</SelectItem>
                    <SelectItem value="mtr">MTR (Mid-Term Rental)</SelectItem>
                    <SelectItem value="ltr">LTR (Long-Term Rental)</SelectItem>
                    <SelectItem value="both">Multiple Strategies</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input id="bedrooms" type="number" value={form.bedrooms} onChange={e => setForm({...form, bedrooms: e.target.value})} min="0" />
              </div>
              <div>
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input id="bathrooms" type="number" step="0.5" value={form.bathrooms} onChange={e => setForm({...form, bathrooms: e.target.value})} min="0" />
              </div>
              <div>
                <Label htmlFor="monthly_rent">Monthly Rent *</Label>
                <Input id="monthly_rent" type="number" value={form.monthly_rent} onChange={e => setForm({...form, monthly_rent: e.target.value})} placeholder="2500" required aria-required="true" />
              </div>
              <div>
                <Label htmlFor="acquisition_fee">Acquisition Fee</Label>
                <Input id="acquisition_fee" type="number" value={form.acquisition_fee} onChange={e => setForm({...form, acquisition_fee: e.target.value})} />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="is_furnished" checked={form.is_furnished} onCheckedChange={c => setForm({...form, is_furnished: !!c})} />
                <Label htmlFor="is_furnished" className="cursor-pointer">Fully Furnished</Label>
              </div>
            </div>
            
            {/* Featured on Homepage Toggle */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Checkbox id="is_featured" checked={form.is_featured} onCheckedChange={c => setForm({...form, is_featured: !!c})} />
                <div className="flex items-center gap-2">
                  <Star className={`w-5 h-5 ${form.is_featured ? 'text-amber-500 fill-amber-500' : 'text-amber-400'}`} aria-hidden="true" />
                  <Label htmlFor="is_featured" className="font-medium text-amber-800 cursor-pointer">Feature on Homepage</Label>
                </div>
              </div>
              <p className="text-sm text-amber-600 mt-2 ml-7">When enabled, this property will appear in the "Featured Live Deals" section on the homepage (requires publishing).</p>
            </div>
            
            <div>
              <Label className="mb-2 block">Categories</Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Property categories">
                {categories.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded cursor-pointer hover:bg-gray-100">
                    <Checkbox checked={form.selected_categories.includes(c.id)} onCheckedChange={() => toggleCategory(c.id)} aria-label={c.label} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            
            <div role="region" aria-label="Property description with Penny AI assistance">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="description">Description</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePennyDescription}
                  disabled={generatingDescription || !form.city || !form.state}
                  className="h-8 text-xs border-[#1a365d]/30 text-[#1a365d] hover:bg-[#1a365d]/5 focus:ring-2 focus:ring-[#d4a574]"
                  aria-label="Let Penny AI generate an investor-focused property description based on market data"
                  aria-busy={generatingDescription}
                >
                  {generatingDescription ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" aria-hidden="true" />
                      Penny is writing...
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                      <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
                      Let Penny Write the Description
                    </>
                  )}
                </Button>
              </div>
              <Textarea 
                id="description" 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                rows={form.description.length > 200 ? 10 : 4} 
                placeholder="Property details, features, and notes... or click 'Let Penny Write the Description' to auto-generate an investor-focused description with market data."
                aria-describedby="description-help"
              />
              <p id="description-help" className="text-xs text-gray-500 mt-1">
                {form.description ? `${form.description.length} characters` : 'Penny generates descriptions with hotel rate comparisons, OTA platform recommendations, and market insights.'}
              </p>
              {pennyMarketData && (
                <div className="mt-2 p-3 bg-gradient-to-r from-[#1a365d]/5 to-[#d4a574]/10 rounded-lg border border-[#d4a574]/20" role="complementary" aria-label="Market data used by Penny AI">
                  <p className="text-xs font-semibold text-[#1a365d] mb-1.5 flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                    Penny Market Insights — {pennyMarketData.name}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-gray-500">Top Platform:</span> <span className="font-medium text-[#1a365d]">{pennyMarketData.top_platform}</span></div>
                    <div><span className="text-gray-500">Hotel ADR:</span> <span className="font-medium">{pennyMarketData.hotel_adr}</span></div>
                    <div><span className="text-gray-500">STR ADR:</span> <span className="font-medium">{pennyMarketData.str_adr}</span></div>
                    <div><span className="text-gray-500">Regulation:</span> <span className={`font-medium ${pennyMarketData.regulation_risk === 'Low' ? 'text-green-600' : pennyMarketData.regulation_risk === 'High' ? 'text-red-600' : 'text-amber-600'}`}>{pennyMarketData.regulation_risk}</span></div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handlePennyDescription}
                      disabled={generatingDescription}
                      className="h-6 text-[10px] text-[#d4a574] hover:text-[#c49464]"
                      aria-label="Regenerate description with Penny AI"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" aria-hidden="true" />
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </div>

          </TabsContent>

          {/* ===== FINANCIALS TAB ===== */}
          <TabsContent value="financials" className="space-y-4 mt-4">
            <fieldset className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <legend className="font-semibold text-sm text-green-800 flex items-center gap-2 px-1">
                <DollarSign className="w-4 h-4" aria-hidden="true" /> Core Financials
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                <div>
                  <Label htmlFor="fin-sqft">Square Footage</Label>
                  <Input id="fin-sqft" type="number" value={form.sqft} onChange={e => setForm({...form, sqft: e.target.value})} placeholder="1500" />
                </div>
                <div>
                  <Label htmlFor="fin-monthly-room-rate">Monthly Room Rate ($)</Label>
                  <Input id="fin-monthly-room-rate" type="number" value={form.monthly_room_rate} onChange={e => setForm({...form, monthly_room_rate: e.target.value})} placeholder="800" />
                </div>
              </div>
            </fieldset>

            <fieldset className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <legend className="font-semibold text-sm text-blue-800 flex items-center gap-2 px-1">
                <BarChart3 className="w-4 h-4" aria-hidden="true" /> Revenue Projections
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                <div>
                  <Label htmlFor="fin-adr-peak" className="text-xs">ADR Peak Season ($)</Label>
                  <Input id="fin-adr-peak" type="number" value={form.adr_peak_season} onChange={e => setForm({...form, adr_peak_season: e.target.value})} placeholder="200" />
                </div>
                <div>
                  <Label htmlFor="fin-adr-slow" className="text-xs">ADR Slow Season ($)</Label>
                  <Input id="fin-adr-slow" type="number" value={form.adr_slow_season} onChange={e => setForm({...form, adr_slow_season: e.target.value})} placeholder="120" />
                </div>
                <div>
                  <Label htmlFor="fin-occupancy" className="text-xs">Avg Occupancy Rate (%)</Label>
                  <Input id="fin-occupancy" type="number" value={form.avg_occupancy_rate} onChange={e => setForm({...form, avg_occupancy_rate: e.target.value})} placeholder="75" />
                </div>
                <div>
                  <Label htmlFor="fin-yearly-rev" className="text-xs">Projected Yearly Revenue ($)</Label>
                  <Input id="fin-yearly-rev" type="number" value={form.projected_yearly_revenue} onChange={e => setForm({...form, projected_yearly_revenue: e.target.value})} placeholder="54000" />
                </div>
                <div>
                  <Label htmlFor="fin-peak-rev" className="text-xs">Peak Monthly Revenue ($)</Label>
                  <Input id="fin-peak-rev" type="number" value={form.projected_monthly_revenue_peak} onChange={e => setForm({...form, projected_monthly_revenue_peak: e.target.value})} placeholder="6000" />
                </div>
                <div>
                  <Label htmlFor="fin-slow-rev" className="text-xs">Slow Monthly Revenue ($)</Label>
                  <Input id="fin-slow-rev" type="number" value={form.projected_monthly_revenue_slow} onChange={e => setForm({...form, projected_monthly_revenue_slow: e.target.value})} placeholder="3000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="fin-peak-desc" className="text-xs">Peak Season Description</Label>
                  <Input id="fin-peak-desc" value={form.peak_season_description} onChange={e => setForm({...form, peak_season_description: e.target.value})} placeholder="e.g., May-September" />
                </div>
                <div>
                  <Label htmlFor="fin-deposits" className="text-xs">Deposits / Concessions Notes</Label>
                  <Input id="fin-deposits" value={form.deposits_concessions_notes} onChange={e => setForm({...form, deposits_concessions_notes: e.target.value})} placeholder="e.g., First/last month required" />
                </div>
              </div>
            </fieldset>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-amber-700">
                  These financial projections help the Success Team evaluate the deal and provide accurate information to investors. Fill in as many fields as you can.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Verification Tab */}

          <TabsContent value="verification" className="space-y-4 mt-4">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-6">
              <h3 className="font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                Deal Verification Status
              </h3>
              
              <div className="space-y-6">
                {/* YP Verified Toggle */}
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${form.is_verified ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                      <ShieldCheck className={`w-6 h-6 ${form.is_verified ? 'text-emerald-600' : 'text-gray-400'}`} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">YP Verified Deal</p>
                      <p className="text-sm text-gray-600">This deal has been verified by YourPlace team</p>
                    </div>
                  </div>
                  <Switch 
                    checked={form.is_verified} 
                    onCheckedChange={c => setForm({...form, is_verified: c})}
                    aria-label="Toggle YP Verified status"
                  />
                </div>
                
                {/* Staff Verified Toggle */}
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${form.staff_verified ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Shield className={`w-6 h-6 ${form.staff_verified ? 'text-blue-600' : 'text-gray-400'}`} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Staff Verified</p>
                      <p className="text-sm text-gray-600">A staff member has reviewed and verified this deal</p>
                    </div>
                  </div>
                  <Switch 
                    checked={form.staff_verified} 
                    onCheckedChange={c => setForm({...form, staff_verified: c})}
                    aria-label="Toggle Staff Verified status"
                  />
                </div>
              </div>
              
              {/* Verification Summary */}
              <div className="mt-6 pt-4 border-t border-emerald-200">
                <p className="text-sm text-emerald-700 font-medium mb-2">Current Status:</p>
                <div className="flex flex-wrap gap-2">
                  {form.is_verified && (
                    <Badge className="bg-emerald-500 text-white">
                      <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                      YP Verified
                    </Badge>
                  )}
                  {form.staff_verified && (
                    <Badge className="bg-blue-500 text-white">
                      <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                      Staff Verified
                    </Badge>
                  )}
                  {form.source === 'third_party' && (
                    <Badge className="bg-purple-500 text-white">
                      <Users className="w-3 h-3 mr-1" aria-hidden="true" />
                      Third-Party
                    </Badge>
                  )}
                  {form.source === 'acquisition_team' && (
                    <Badge className="bg-blue-500 text-white">
                      <Building2 className="w-3 h-3 mr-1" aria-hidden="true" />
                      YP Sourced
                    </Badge>
                  )}
                  {!form.is_verified && !form.staff_verified && (
                    <Badge variant="outline" className="text-gray-500">
                      <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                      Unverified
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Penny AI Notice */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-purple-600 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-purple-800">Penny AI Scoring</p>
                  <p className="text-sm text-purple-600">When you save this deal, Penny AI will automatically analyze and score the property based on market data, location, and investment potential.</p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Photos Tab */}
          <TabsContent value="photos" className="space-y-4 mt-4">
            {/* Upload Area - touch-friendly with explicit button */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 md:p-8 text-center transition-all ${
                dragOver ? 'border-[#d4a574] bg-[#d4a574]/10' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Upload className={`w-8 h-8 md:w-10 md:h-10 mx-auto mb-3 ${dragOver ? 'text-[#d4a574]' : 'text-gray-400'}`} aria-hidden="true" />
              <p className="text-gray-600 mb-2 text-sm md:text-base">Drag and drop photos here, or tap to browse</p>
              <p className="text-xs md:text-sm text-gray-400 mb-4">Supports JPG, PNG, WebP (max 10MB each)</p>
              <label className="cursor-pointer inline-block">
                <input type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
                <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground active:scale-95 transition-transform">
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  Select Photos
                </span>
              </label>
            </div>

            {/* Photo Grid */}
            {photos.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">Property Photos ({photos.length})</h4>
                  <p className="text-sm text-gray-500 hidden md:block">First photo is the primary/cover image</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  {photos.map((photo, idx) => (
                    <div 
                      key={photo.id}
                      className={`relative group rounded-lg overflow-hidden border-2 ${photo.is_primary ? 'border-[#d4a574]' : 'border-gray-200'}`}
                    >
                      <img src={photo.url} alt={`Property photo ${idx + 1}`} className="w-full h-28 md:h-32 object-cover" />
                      
                      {/* Primary Badge */}
                      {photo.is_primary && (
                        <div className="absolute top-1.5 left-1.5 bg-[#d4a574] text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 md:w-3 md:h-3 fill-current" aria-hidden="true" />
                          <span className="hidden md:inline">Primary</span>
                        </div>
                      )}
                      
                      {/* Order Number */}
                      <div className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full">#{idx + 1}</div>
                      
                      {/* Desktop: Hover overlay actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center gap-2">
                        <Button size="sm" variant="secondary" className="h-8" onClick={() => movePhoto(photo.id, 'up')} disabled={idx === 0} title="Move up">
                          <ArrowUp className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="secondary" className="h-8" onClick={() => movePhoto(photo.id, 'down')} disabled={idx === photos.length - 1} title="Move down">
                          <ArrowDown className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="destructive" className="h-8" onClick={() => removePhoto(photo.id)} title="Remove">
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </div>
                      
                      {/* Mobile: Always-visible bottom action bar */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex items-center justify-between md:hidden">
                        <div className="flex gap-1">
                          <button onClick={() => movePhoto(photo.id, 'up')} disabled={idx === 0}
                            className="bg-white/20 hover:bg-white/40 active:bg-white/50 text-white p-1.5 rounded disabled:opacity-30 touch-manipulation" title="Move left">
                            <ArrowUp className="w-3.5 h-3.5 -rotate-90" aria-hidden="true" />
                          </button>
                          <button onClick={() => movePhoto(photo.id, 'down')} disabled={idx === photos.length - 1}
                            className="bg-white/20 hover:bg-white/40 active:bg-white/50 text-white p-1.5 rounded disabled:opacity-30 touch-manipulation" title="Move right">
                            <ArrowDown className="w-3.5 h-3.5 -rotate-90" aria-hidden="true" />
                          </button>
                        </div>
                        <button onClick={() => removePhoto(photo.id)}
                          className="bg-red-500/80 hover:bg-red-600 active:bg-red-700 text-white p-1.5 rounded touch-manipulation" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {photos.length === 0 && (
              <div className="text-center py-6 md:py-8 text-gray-500">
                <ImageIcon className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-gray-300" aria-hidden="true" />
                <p>No photos added yet</p>
                <p className="text-sm">Upload photos to showcase this property</p>
              </div>
            )}
          </TabsContent>

          
          {/* Landlord Info Tab */}
          <TabsContent value="landlord" className="space-y-4 mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-blue-800">Landlord Information (Optional)</p>
                  <p className="text-sm text-blue-600">This information is for internal use only and will not be shown to investors.</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="landlord_name">Landlord Name</Label>
                <Input id="landlord_name" value={form.landlord_name} onChange={e => setForm({...form, landlord_name: e.target.value})} placeholder="John Smith" />
              </div>
              <div>
                <Label htmlFor="landlord_phone">Phone</Label>
                <Input id="landlord_phone" type="tel" value={form.landlord_phone} onChange={e => setForm({...form, landlord_phone: e.target.value})} placeholder="(555) 123-4567" />
              </div>
              <div>
                <Label htmlFor="landlord_email">Email</Label>
                <Input id="landlord_email" type="email" value={form.landlord_email} onChange={e => setForm({...form, landlord_email: e.target.value})} placeholder="landlord@email.com" />
              </div>
              <div>
                <Label htmlFor="listing_url">Listing URL</Label>
                <Input id="listing_url" type="url" value={form.listing_url} onChange={e => setForm({...form, listing_url: e.target.value})} placeholder="https://..." />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => { setLastError(null); onOpenChange(false); }}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || uploading || !form.address || !form.city || !form.state || !form.monthly_rent} 
            className="bg-[#d4a574] hover:bg-[#c49464]"
          >
            {loading || uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                {uploading ? 'Uploading Photos...' : 'Adding Deal...'}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                Add Deal {photos.length > 0 && `(${photos.length} photos)`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
