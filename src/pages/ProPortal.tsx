import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, CheckCircle, Circle, Package, ClipboardCheck,
  Camera, FileSignature, Home, MapPin, User, Wrench,
  Upload, AlertCircle, Truck, Image, Video, RefreshCw,
  ChevronDown, ChevronUp, Shield
} from 'lucide-react';

// Maintenance form fields
const MAINTENANCE_FIELDS = [
  { id: 'exterior_condition', label: 'Exterior Condition', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Needs Repair'] },
  { id: 'exterior_notes', label: 'Exterior Notes', type: 'textarea' },
  { id: 'front_door', label: 'Front Door & Lock', type: 'select', options: ['Working Properly', 'Needs Adjustment', 'Needs Repair'] },
  { id: 'windows', label: 'Windows & Screens', type: 'select', options: ['All Good', 'Minor Issues', 'Needs Repair'] },
  { id: 'windows_notes', label: 'Window Notes', type: 'textarea' },
  { id: 'flooring', label: 'Flooring Condition', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Needs Repair'] },
  { id: 'flooring_notes', label: 'Flooring Notes', type: 'textarea' },
  { id: 'walls_paint', label: 'Walls & Paint', type: 'select', options: ['Excellent', 'Good', 'Touch-up Needed', 'Needs Repainting'] },
  { id: 'walls_notes', label: 'Wall Notes', type: 'textarea' },
  { id: 'kitchen', label: 'Kitchen Condition', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Needs Attention'] },
  { id: 'kitchen_appliances', label: 'Kitchen Appliances', type: 'textarea', placeholder: 'List each appliance and its condition' },
  { id: 'bathrooms', label: 'Bathroom(s) Condition', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Needs Attention'] },
  { id: 'bathroom_notes', label: 'Bathroom Notes', type: 'textarea' },
  { id: 'plumbing', label: 'Plumbing (sinks, toilets, showers)', type: 'select', options: ['All Working', 'Minor Leaks', 'Needs Repair'] },
  { id: 'electrical', label: 'Electrical (outlets, switches, lights)', type: 'select', options: ['All Working', 'Some Issues', 'Needs Repair'] },
  { id: 'hvac', label: 'HVAC / Climate Control', type: 'select', options: ['Working Properly', 'Needs Service', 'Not Working'] },
  { id: 'smoke_detectors', label: 'Smoke / CO Detectors', type: 'select', options: ['All Present & Working', 'Some Missing', 'Need Batteries'] },
  { id: 'pest_issues', label: 'Pest Issues', type: 'select', options: ['None Observed', 'Minor Signs', 'Active Infestation'] },
  { id: 'overall_cleanliness', label: 'Overall Cleanliness', type: 'select', options: ['Clean', 'Needs Light Cleaning', 'Needs Deep Clean'] },
  { id: 'additional_notes', label: 'Additional Notes / Concerns', type: 'textarea', placeholder: 'Any other issues, damage, or concerns to report' },
];

export default function ProPortal() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('spreadsheet');
  const { toast } = useToast();

  // Maintenance form state
  const [maintenanceData, setMaintenanceData] = useState<Record<string, string>>({});
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false);

  // Media upload state
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Contract signing state
  const [signatureName, setSignatureName] = useState('');
  const [signingContract, setSigningContract] = useState(false);

  // Delivery update state
  const [updatingItem, setUpdatingItem] = useState<number | null>(null);

  useEffect(() => {
    if (token) fetchProject();
  }, [token]);

  const fetchProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'pro_portal_access', token }
      });
      if (fnError || data?.error) throw new Error(data?.error || 'Invalid portal link');
      setProject(data.project);
      if (data.project.maintenance_check_data) {
        setMaintenanceData(data.project.maintenance_check_data);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to access portal');
    }
    setLoading(false);
  };

  // Items were addressed by ARRAY POSITION. Marking index 0 delivered marked every item on
  // the project delivered, and the write went into a JSONB blob that staff tools overwrite,
  // so a Pro's real confirmation was silently discarded. Both faults were reproduced live.
  // Now addressed by item id against the actual item record.
  const handleDeliveryUpdate = async (index: number, field: 'delivered' | 'placed', value: boolean, itemId?: string) => {
    setUpdatingItem(index);
    try {
      if (!itemId) {
        toast({ title: 'Cannot update this item', description: 'This item has no id yet. Ask your setup manager to re-add it.', variant: 'destructive' });
        setUpdatingItem(null);
        return;
      }
      const { data, error: fnError } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'pro_mark_item', token, item_id: itemId, [field]: value }
      });
      if (fnError || data?.error) throw new Error(data?.error || 'Update failed');
      setProject((prev: any) => ({ ...prev, sourcing_spreadsheet: data.spreadsheet }));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setUpdatingItem(null);
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingMaintenance(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'pro_submit_maintenance', token, maintenance_data: maintenanceData }
      });
      if (fnError || data?.error) throw new Error(data?.error || 'Submit failed');
      toast({ title: 'Maintenance Check Submitted!', description: 'The Setup Manager has been notified.' });
      setProject((prev: any) => ({ ...prev, maintenance_check_completed: true, maintenance_check_data: maintenanceData }));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSubmittingMaintenance(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingMedia(true);
    const urls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const fileName = `${project.id}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('setup-media')
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('setup-media').getPublicUrl(fileName);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      }
      if (urls.length > 0) {
        await supabase.functions.invoke('manage-setup-tasks', {
          body: { action: 'pro_upload_media', token, photos: urls, videos: [] }
        });
        setUploadedPhotos(prev => [...prev, ...urls]);
        toast({ title: `${urls.length} photo(s) uploaded!` });
      }
    } catch (err: any) {
      toast({ title: 'Upload Error', description: err.message, variant: 'destructive' });
    }
    setUploadingMedia(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingMedia(true);
    const urls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const fileName = `${project.id}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('setup-media')
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('setup-media').getPublicUrl(fileName);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      }
      if (urls.length > 0) {
        await supabase.functions.invoke('manage-setup-tasks', {
          body: { action: 'pro_upload_media', token, photos: [], videos: urls }
        });
        setUploadedVideos(prev => [...prev, ...urls]);
        toast({ title: `${urls.length} video(s) uploaded!` });
      }
    } catch (err: any) {
      toast({ title: 'Upload Error', description: err.message, variant: 'destructive' });
    }
    setUploadingMedia(false);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSignContract = async () => {
    if (!signatureName.trim()) {
      toast({ title: 'Please enter your full name', variant: 'destructive' });
      return;
    }
    setSigningContract(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'pro_sign_contract', token, signature: signatureName.trim(), signer_name: signatureName.trim() }
      });
      if (fnError || data?.error) throw new Error(data?.error || 'Signing failed');
      toast({ title: 'Contract Signed!', description: 'The Setup Manager has been notified.' });
      setProject((prev: any) => ({ ...prev, pro_contract_signed: true, pro_contract_signed_at: new Date().toISOString() }));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSigningContract(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#1a365d] mx-auto mb-4" />
          <p className="text-gray-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">If you believe this is an error, please contact your Setup Manager.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) return null;

  const spreadsheet = Array.isArray(project.sourcing_spreadsheet) ? project.sourcing_spreadsheet : [];
  const totalItems = spreadsheet.length;
  const deliveredCount = spreadsheet.filter((i: any) => i.delivered).length;
  const placedCount = spreadsheet.filter((i: any) => i.placed).length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Skip to main content link - WCAG 2.1 Level A: Bypass Blocks (2.4.1) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-[#1a365d] focus:ring-2 focus:ring-[#d4a574] focus:outline-none focus:font-medium"
      >
        Skip to main content
      </a>


      {/* Header */}
      <header className="bg-[#1a365d] text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Setup Pro Portal</h1>
                <p className="text-white/70 text-sm">{project.property_address || 'Property Setup'}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="text-white/70">Welcome, <span className="text-white font-medium">{project.setup_pro_name || 'Pro'}</span></p>
              {project.assigned_manager_name && (
                <p className="text-white/50 text-xs">Manager: {project.assigned_manager_name}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Project Info Bar */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {project.city_state && (
              <span className="flex items-center gap-1 text-gray-600">
                <MapPin className="w-3.5 h-3.5" /> {project.city_state}
              </span>
            )}
            {project.num_beds && (
              <span className="text-gray-600">{project.num_beds} bed / {project.num_baths} bath</span>
            )}
            <Badge variant="outline" className="text-xs">Phase {project.phase || '?'}</Badge>
            <Button variant="ghost" size="sm" onClick={fetchProject} className="ml-auto">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-6" role="main">

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white shadow w-full flex">
            <TabsTrigger value="spreadsheet" className="flex-1 flex items-center gap-1.5 text-xs sm:text-sm">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Spreadsheet</span>
              <span className="sm:hidden">Items</span>
              {totalItems > 0 && <Badge variant="secondary" className="ml-1 text-xs">{deliveredCount}/{totalItems}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="flex-1 flex items-center gap-1.5 text-xs sm:text-sm">
              <ClipboardCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Maintenance</span>
              <span className="sm:hidden">Check</span>
              {project.maintenance_check_completed && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="media" className="flex-1 flex items-center gap-1.5 text-xs sm:text-sm">
              <Camera className="w-4 h-4" />
              Media
            </TabsTrigger>
            <TabsTrigger value="contract" className="flex-1 flex items-center gap-1.5 text-xs sm:text-sm">
              <FileSignature className="w-4 h-4" />
              <span className="hidden sm:inline">Contract</span>
              <span className="sm:hidden">Sign</span>
              {project.pro_contract_signed && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-1" />}
            </TabsTrigger>
          </TabsList>

          {/* SPREADSHEET TAB */}
          <TabsContent value="spreadsheet" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#1a365d]" />
                  Sourcing Spreadsheet
                </CardTitle>
                <CardDescription>
                  Mark items as delivered and placed as they arrive. Updates are live.
                </CardDescription>
                {totalItems > 0 && (
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Truck className="w-4 h-4 text-blue-500" />
                      <span>{deliveredCount}/{totalItems} delivered</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span>{placedCount}/{totalItems} placed</span>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {totalItems === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <Package className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p>No items in the spreadsheet yet.</p>
                    <p className="text-sm">Items will appear here once your Setup Manager adds them.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {spreadsheet.map((item: any, idx: number) => (
                      <div key={idx} className={`p-3 rounded-lg border ${item.delivered && item.placed ? 'bg-emerald-50 border-emerald-200' : item.delivered ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-start gap-3">
                          {item.image_url && (
                            <img src={item.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 text-sm">{item.name || item.item_name || `Item ${idx + 1}`}</p>
                            {item.category && <p className="text-xs text-gray-500">{item.category}</p>}
                            {item.link && (
                              <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                                View Product
                              </a>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Qty: {item.quantity || 1}</p>
                          </div>
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleDeliveryUpdate(idx, 'delivered', !item.delivered, item.item_id)}
                              disabled={updatingItem === idx}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${item.delivered ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-blue-100'}`}
                            >
                              {updatingItem === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : item.delivered ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                              Delivered
                            </button>
                            <button
                              onClick={() => handleDeliveryUpdate(idx, 'placed', !item.placed, item.item_id)}
                              disabled={updatingItem === idx}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${item.placed ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-emerald-100'}`}
                            >
                              {updatingItem === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : item.placed ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                              Placed
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MAINTENANCE TAB */}
          <TabsContent value="maintenance" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-[#1a365d]" />
                      Maintenance Inventory Check
                    </CardTitle>
                    <CardDescription>
                      Walk the property and document its condition before unboxing anything.
                    </CardDescription>
                  </div>
                  {project.maintenance_check_completed && (
                    <Badge className="bg-emerald-100 text-emerald-700">Submitted</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {project.maintenance_check_completed ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="font-medium text-emerald-800">Maintenance check submitted</span>
                      </div>
                      <p className="text-sm text-emerald-700">
                        Submitted on {project.maintenance_check_submitted_at ? new Date(project.maintenance_check_submitted_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {MAINTENANCE_FIELDS.map(field => (
                        maintenanceData[field.id] ? (
                          <div key={field.id} className="flex flex-col sm:flex-row sm:items-start gap-1 p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium text-gray-500 sm:w-48 flex-shrink-0">{field.label}:</span>
                            <span className="text-sm text-gray-800">{maintenanceData[field.id]}</span>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleMaintenanceSubmit} className="space-y-4">
                    {MAINTENANCE_FIELDS.map(field => (
                      <div key={field.id}>
                        <Label htmlFor={`maint-${field.id}`} className="text-sm font-medium">{field.label}</Label>
                        {field.type === 'select' ? (
                          <select
                            id={`maint-${field.id}`}
                            value={maintenanceData[field.id] || ''}
                            onChange={(e) => setMaintenanceData(prev => ({ ...prev, [field.id]: e.target.value }))}
                            className="w-full mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="">Select...</option>
                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <Textarea
                            id={`maint-${field.id}`}
                            value={maintenanceData[field.id] || ''}
                            onChange={(e) => setMaintenanceData(prev => ({ ...prev, [field.id]: e.target.value }))}
                            placeholder={field.placeholder || ''}
                            rows={2}
                            className="mt-1"
                          />
                        )}
                      </div>
                    ))}
                    <Button type="submit" disabled={submittingMaintenance} className="w-full bg-[#1a365d] hover:bg-[#2d4a7a]">
                      {submittingMaintenance ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
                      Submit Maintenance Check
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEDIA TAB */}
          <TabsContent value="media" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#1a365d]" />
                  Photos & Video Upload
                </CardTitle>
                <CardDescription>
                  Upload professional photos and a continuous video walkthrough of the furnished property.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Photo Upload */}
                <div>
                  <h4 className="font-medium text-gray-800 flex items-center gap-2 mb-3">
                    <Image className="w-4 h-4" /> Property Photos
                  </h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-3">Turn on all lights. Take photos of every room and angle.</p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingMedia}
                    >
                      {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Select Photos
                    </Button>
                  </div>
                  {/* Uploaded photos preview */}
                  {(uploadedPhotos.length > 0 || (Array.isArray(project.media_photos) && project.media_photos.length > 0)) && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[...(Array.isArray(project.media_photos) ? project.media_photos : []), ...uploadedPhotos].map((url: string, idx: number) => (
                        <div key={idx} className="aspect-square rounded-lg overflow-hidden border">
                          <img src={typeof url === 'string' ? url : (url as any).url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Video Upload */}
                <div>
                  <h4 className="font-medium text-gray-800 flex items-center gap-2 mb-3">
                    <Video className="w-4 h-4" /> Video Walkthrough
                  </h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <Video className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-3">Record a continuous walkthrough. Ensure you are not visible in the footage.</p>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleVideoUpload}
                      className="hidden"
                      id="video-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={uploadingMedia}
                    >
                      {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Select Video
                    </Button>
                  </div>
                  {(uploadedVideos.length > 0 || (Array.isArray(project.media_videos) && project.media_videos.length > 0)) && (
                    <div className="space-y-2 mt-3">
                      {[...(Array.isArray(project.media_videos) ? project.media_videos : []), ...uploadedVideos].map((url: string, idx: number) => (
                        <div key={idx} className="rounded-lg overflow-hidden border bg-black">
                          <video src={typeof url === 'string' ? url : (url as any).url} controls className="w-full max-h-[300px]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {project.media_approved && (
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <CheckCircle className="w-5 h-5 text-emerald-600 inline mr-2" />
                    <span className="font-medium text-emerald-800">Media has been approved by the Setup Manager</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTRACT TAB */}
          <TabsContent value="contract" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-[#1a365d]" />
                  Independent Contractor Agreement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {project.pro_contract_signed ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="font-medium text-emerald-800">Agreement Signed</span>
                      </div>
                      <p className="text-sm text-emerald-700">
                        Signed on {project.pro_contract_signed_at ? new Date(project.pro_contract_signed_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Agreement Text */}
                    <div className="bg-gray-50 rounded-lg p-6 border max-h-[400px] overflow-y-auto text-sm leading-relaxed">
                      {project.pro_contract_agreement_text ? (
                        <div dangerouslySetInnerHTML={{ __html: project.pro_contract_agreement_text }} />
                      ) : (
                        <div className="space-y-4">
                          <h3 className="font-bold text-lg text-center">INDEPENDENT CONTRACTOR AGREEMENT</h3>
                          <p>This Independent Contractor Agreement ("Agreement") is entered into as of the date of digital signature below.</p>
                          <p><strong>PARTIES:</strong></p>
                          <p>Company: Access Your Place LLC ("Company")<br/>Contractor: {project.setup_pro_name || '[Setup Pro Name]'} ("Contractor")</p>
                          <p><strong>1. SCOPE OF WORK:</strong> Contractor agrees to provide on-site property setup services including but not limited to: receiving and verifying deliveries, unboxing and assembling furniture, coordinating with vendors, performing maintenance inventory checks, capturing professional property photos and video walkthroughs, and general property cleanup.</p>
                          <p><strong>2. PROPERTY:</strong> {project.property_address || '[Property Address]'}</p>
                          <p><strong>3. COMPENSATION:</strong> Contractor shall receive a flat fee of $1,200 for the completion of all services outlined in this Agreement. Payment shall be disbursed upon satisfactory completion of all tasks and approval by the assigned Setup Manager.</p>
                          <p><strong>4. INDEPENDENT CONTRACTOR STATUS:</strong> Contractor is an independent contractor and not an employee. Contractor is responsible for their own taxes, insurance, and expenses unless otherwise specified.</p>
                          <p><strong>5. CONFIDENTIALITY:</strong> Contractor agrees to maintain the confidentiality of all property access codes, client information, and business processes.</p>
                          <p><strong>6. TERM:</strong> This Agreement begins on the date of signature and continues until the setup project is marked complete by the Setup Manager.</p>
                          <p><strong>7. LIABILITY:</strong> Contractor assumes responsibility for any damage caused to the property or its contents during the setup process due to negligence.</p>
                        </div>
                      )}
                    </div>

                    {/* Signature */}
                    <div className="border-t pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-5 h-5 text-[#1a365d]" />
                        <h4 className="font-semibold text-gray-800">Digital Signature</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        By typing your full legal name below and clicking "Sign Agreement", you acknowledge that you have read, understood, and agree to all terms of this Independent Contractor Agreement.
                      </p>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="sig-name">Full Legal Name</Label>
                          <Input
                            id="sig-name"
                            value={signatureName}
                            onChange={(e) => setSignatureName(e.target.value)}
                            placeholder="Enter your full legal name"
                            className="text-lg"
                          />
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg border">
                          <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString()}</p>
                          {signatureName && (
                            <p className="text-2xl font-script mt-2 text-[#1a365d]" style={{ fontFamily: 'cursive' }}>
                              {signatureName}
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={handleSignContract}
                          disabled={signingContract || !signatureName.trim()}
                          className="w-full bg-[#1a365d] hover:bg-[#2d4a7a]"
                        >
                          {signingContract ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSignature className="w-4 h-4 mr-2" />}
                          Sign Agreement
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>Access Your Place - Setup Pro Portal</p>
          <p className="text-xs mt-1">This is a secure portal. Do not share your access link.</p>
        </div>
      </footer>
    </div>
  );
}
