import { useState, useRef, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { sendDealFlowNotification } from '@/hooks/useDealFlowRealtime';
import {
  Loader2, Building2, MapPin, DollarSign, Home, FileText,
  Send, Plus, X, Link, User, Phone, Mail, Camera, Upload,
  Image, Trash2, CheckCircle, AlertTriangle, ShieldAlert,
  ChevronRight, ChevronLeft, Sparkles, Eye, Store, BarChart3
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  staffName: string;
  onSubmitted?: () => void;
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

interface UploadedPhoto {
  id: string;
  url: string;
  name: string;
  uploading: boolean;
  error?: string;
  type: 'file' | 'url';
}

const STEPS = [
  { id: 1, label: 'Property Info', icon: MapPin },
  { id: 2, label: 'Financials', icon: DollarSign },
  { id: 3, label: 'Details & Landlord', icon: User },
  { id: 4, label: 'Photos', icon: Camera },
  { id: 5, label: 'Review & Submit', icon: Eye },
];

export function AMSubmitDealModal({ open, onOpenChange, staffId, staffName, onSubmitted }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [form, setForm] = useState({
    address: '', city: '', state: '', zip_code: '',
    listing_title: '', listing_description: '',
    asking_price: '', monthly_revenue: '',
    bedrooms: '3', bathrooms: '2', sqft: '',
    property_type: 'single_family', operation_type: '',
    notes: '', listing_url: '',
    landlord_name: '', landlord_email: '', landlord_phone: '',
    is_third_party_seller: false,
    // Financial projections
    adr_peak_season: '', adr_slow_season: '',
    monthly_room_rate: '', avg_occupancy_rate: '',
    projected_yearly_revenue: '', projected_monthly_revenue_peak: '',
    projected_monthly_revenue_slow: '', peak_season_description: '',
    deposits_concessions_notes: '',
  });
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoMode, setPhotoMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const updateForm = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const generatePhotoId = () => `photo_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setShowValidation(false);
    }
  }, [open]);

  // Step-specific validation
  const stepErrors = useMemo(() => {
    const errors: Record<number, { field: string; message: string }[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    // Step 1: Address + Title
    if (!form.address.trim()) errors[1].push({ field: 'address', message: 'Street address is required' });
    if (!form.city.trim()) errors[1].push({ field: 'city', message: 'City is required' });
    if (!form.state) errors[1].push({ field: 'state', message: 'State is required' });
    if (!form.zip_code.trim()) errors[1].push({ field: 'zip_code', message: 'ZIP code is required' });
    // Step 2: Financials
    if (!form.asking_price || parseFloat(form.asking_price) <= 0) errors[2].push({ field: 'asking_price', message: 'Asking price is required' });
    if (!form.monthly_revenue || parseFloat(form.monthly_revenue) <= 0) errors[2].push({ field: 'monthly_revenue', message: 'Monthly revenue is required' });
    if (!form.operation_type) errors[2].push({ field: 'operation_type', message: 'Operation type is required' });
    // Step 3: Landlord
    if (!form.landlord_name.trim()) errors[3].push({ field: 'landlord_name', message: 'Landlord name is required' });
    if (!form.landlord_phone.trim() && !form.landlord_email.trim()) errors[3].push({ field: 'landlord_contact', message: 'Landlord phone or email is required' });
    // Step 4: Photos
    const successfulPhotos = photos.filter(p => p.url && !p.error && !p.uploading);
    if (successfulPhotos.length === 0) errors[4].push({ field: 'photos', message: 'At least 1 photo is required' });
    return errors;
  }, [form, photos]);

  const allErrors = [...stepErrors[1], ...stepErrors[2], ...stepErrors[3], ...stepErrors[4]];
  const isFormValid = allErrors.length === 0;
  const isStepValid = (s: number) => stepErrors[s]?.length === 0;
  const isFieldInvalid = (field: string) => showValidation && allErrors.some(e => e.field === field);

  const canAdvance = () => {
    if (step === 1) return isStepValid(1);
    if (step === 2) return isStepValid(2);
    if (step === 3) return isStepValid(3);
    if (step === 4) return isStepValid(4);
    return true;
  };

  const handleNext = () => {
    if (!canAdvance()) {
      setShowValidation(true);
      toast({ title: 'Please complete required fields', variant: 'destructive' });
      return;
    }
    setShowValidation(false);
    setStep(s => Math.min(s + 1, 5));
  };

  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  // Penny AI description generation
  const handleGenerateDescription = async () => {
    if (!form.city || !form.state) {
      toast({ title: 'Enter city and state first', variant: 'destructive' });
      return;
    }
    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke('penny-generate-description', {
        body: {
          address: form.address, city: form.city, state: form.state,
          bedrooms: parseInt(form.bedrooms) || 3, bathrooms: parseFloat(form.bathrooms) || 2,
          operation_type: form.operation_type || 'str', monthly_rent: parseFloat(form.monthly_revenue) || 0,
          property_type: form.property_type,
        }
      });
      if (error) throw error;
      if (data?.description) {
        updateForm('listing_description', data.description);
        if (data.title && !form.listing_title.trim()) updateForm('listing_title', data.title);
        toast({ title: 'Description generated by Penny AI' });
      }
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    }
    setGeneratingDescription(false);
  };

  // Photo upload handlers
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const maxSize = 10 * 1024 * 1024;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) { toast({ title: `${file.name} too large (max 10MB)`, variant: 'destructive' }); continue; }
      const photoId = generatePhotoId();
      setPhotos(prev => [...prev, { id: photoId, url: '', name: file.name, uploading: true, type: 'file' }]);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let j = 0; j < uint8Array.length; j += chunkSize) {
          binary += String.fromCharCode(...uint8Array.subarray(j, j + chunkSize));
        }
        const base64Data = btoa(binary);
        const { data, error } = await supabase.functions.invoke('upload-deal-photo', {
          body: { action: 'upload_photo', base64_data: base64Data, file_name: file.name, content_type: file.type || 'image/jpeg', staff_id: staffId, folder: `am-submissions/${staffId}` }
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Upload failed');
        setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, url: data.url, uploading: false } : p));
      } catch (err: any) {
        setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, uploading: false, error: err.message } : p));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addPhotoUrl = () => {
    const url = photoUrlInput.trim();
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return;
    setPhotos(prev => [...prev, { id: generatePhotoId(), url, name: url.split('/').pop() || 'Photo', uploading: false, type: 'url' }]);
    setPhotoUrlInput('');
  };

  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const resetForm = () => {
    setForm({
      address: '', city: '', state: '', zip_code: '',
      listing_title: '', listing_description: '',
      asking_price: '', monthly_revenue: '', bedrooms: '3', bathrooms: '2',
      sqft: '', property_type: 'single_family', operation_type: '',
      notes: '', listing_url: '', landlord_name: '', landlord_email: '', landlord_phone: '',
      is_third_party_seller: false,
      adr_peak_season: '', adr_slow_season: '', monthly_room_rate: '',
      avg_occupancy_rate: '', projected_yearly_revenue: '',
      projected_monthly_revenue_peak: '', projected_monthly_revenue_slow: '',
      peak_season_description: '', deposits_concessions_notes: '',
    });
    setPhotos([]);
    setPhotoUrlInput('');
    setShowValidation(false);
    setStep(1);
  };

  const handleSubmit = async () => {
    setShowValidation(true);
    if (!isFormValid) {
      toast({ title: 'Missing required fields', description: `${allErrors.length} field(s) need attention.`, variant: 'destructive' });
      return;
    }
    if (photos.some(p => p.uploading)) {
      toast({ title: 'Wait for photos to finish uploading', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const photoUrls = photos.filter(p => p.url && !p.error).map(p => p.url);
      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: {
          action: 'submit_deal',
          address: form.address.trim(), city: form.city.trim(), state: form.state, zip_code: form.zip_code.trim(),
          listing_title: form.listing_title.trim() || undefined,
          listing_description: form.listing_description.trim() || undefined,
          asking_price: parseFloat(form.asking_price), monthly_revenue: parseFloat(form.monthly_revenue),
          bedrooms: parseInt(form.bedrooms) || 3, bathrooms: parseFloat(form.bathrooms) || 2,
          sqft: form.sqft ? parseInt(form.sqft) : null,
          property_type: form.property_type, operation_type: form.operation_type,
          notes: form.notes.trim(), listing_url: form.listing_url.trim(),
          landlord_name: form.landlord_name.trim(), landlord_email: form.landlord_email.trim(), landlord_phone: form.landlord_phone.trim(),
          is_third_party_seller: form.is_third_party_seller,
          photos: photoUrls,
          submitted_by_staff_id: staffId, submitted_by_staff_name: staffName,
          submitted_by_type: 'acquisition_manager',
          // Financial projections
          adr_peak_season: form.adr_peak_season ? parseFloat(form.adr_peak_season) : undefined,
          adr_slow_season: form.adr_slow_season ? parseFloat(form.adr_slow_season) : undefined,
          monthly_room_rate: form.monthly_room_rate ? parseFloat(form.monthly_room_rate) : undefined,
          avg_occupancy_rate: form.avg_occupancy_rate ? parseFloat(form.avg_occupancy_rate) : undefined,
          projected_yearly_revenue: form.projected_yearly_revenue ? parseFloat(form.projected_yearly_revenue) : undefined,
          projected_monthly_revenue_peak: form.projected_monthly_revenue_peak ? parseFloat(form.projected_monthly_revenue_peak) : undefined,
          projected_monthly_revenue_slow: form.projected_monthly_revenue_slow ? parseFloat(form.projected_monthly_revenue_slow) : undefined,
          peak_season_description: form.peak_season_description.trim() || undefined,
          deposits_concessions_notes: form.deposits_concessions_notes.trim() || undefined,
        }
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Deal Submitted!', description: data.message || 'Submitted for Success Team review.' });
        sendDealFlowNotification({
          action: 'new_deal_submitted', property_id: data.property_id || data.id || '',
          property_title: form.listing_title.trim() || form.address.trim(),
          property_address: form.address.trim(), property_city: form.city.trim(), property_state: form.state,
          submitted_by_staff_id: staffId, submitted_by_staff_name: staffName,
          bedrooms: parseInt(form.bedrooms) || 3, bathrooms: parseFloat(form.bathrooms) || 2,
          monthly_rent: parseFloat(form.monthly_revenue) || 0, operation_type: form.operation_type,
        }).catch(() => {});
        resetForm();
        onOpenChange(false);
        onSubmitted?.();
      } else {
        throw new Error(data?.error || 'Submission failed');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const successfulPhotos = photos.filter(p => p.url && !p.error && !p.uploading);
  const fmt = (v: string) => v ? `$${parseFloat(v).toLocaleString()}` : 'N/A';
  const completedSteps = STEPS.filter(s => s.id < 5 && isStepValid(s.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center" aria-hidden="true">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            Submit Property to Deal Flow
          </DialogTitle>
          <DialogDescription>
            Step {step} of 5 — {STEPS[step - 1]?.label}
          </DialogDescription>
        </DialogHeader>

        {/* Step Progress Bar */}
        <nav aria-label="Form steps" className="flex items-center gap-1 mb-2">
          {STEPS.map((s) => {
            const StepIcon = s.icon;
            const isActive = step === s.id;
            const isComplete = s.id < step || (s.id < 5 && isStepValid(s.id));
            return (
              <button key={s.id} onClick={() => { if (s.id <= step || canAdvance()) setStep(s.id); }}
                aria-current={isActive ? 'step' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                  isActive ? 'bg-indigo-600 text-white shadow-md' :
                  isComplete ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' :
                  'bg-gray-100 text-gray-500'
                }`}>
                <StepIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.id}</span>
              </button>
            );
          })}
        </nav>

        {/* ===== STEP 1: Address + Title + Description ===== */}
        {step === 1 && (
          <div className="space-y-4">
            <fieldset className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <legend className="font-semibold text-sm text-indigo-800 flex items-center gap-2 px-1">
                <MapPin className="w-4 h-4" aria-hidden="true" /> Property Address
              </legend>
              <div className="space-y-3 mt-2">
                <div>
                  <Label htmlFor="field-address" className={isFieldInvalid('address') ? 'text-red-600' : ''}>Street Address *</Label>
                  <Input id="field-address" value={form.address} onChange={e => updateForm('address', e.target.value)} placeholder="123 Main Street"
                    aria-required="true" aria-invalid={isFieldInvalid('address') || undefined}
                    className={isFieldInvalid('address') ? 'border-red-400 bg-red-50' : ''} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="field-city" className={isFieldInvalid('city') ? 'text-red-600' : ''}>City *</Label>
                    <Input id="field-city" value={form.city} onChange={e => updateForm('city', e.target.value)} placeholder="Austin"
                      aria-required="true" aria-invalid={isFieldInvalid('city') || undefined}
                      className={isFieldInvalid('city') ? 'border-red-400 bg-red-50' : ''} />
                  </div>
                  <div>
                    <Label htmlFor="field-state" className={isFieldInvalid('state') ? 'text-red-600' : ''}>State *</Label>
                    <Select value={form.state} onValueChange={v => updateForm('state', v)}>
                      <SelectTrigger id="field-state" aria-required="true" aria-invalid={isFieldInvalid('state') || undefined}
                        className={isFieldInvalid('state') ? 'border-red-400 bg-red-50' : ''}>
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="field-zip" className={isFieldInvalid('zip_code') ? 'text-red-600' : ''}>ZIP *</Label>
                    <Input id="field-zip" value={form.zip_code} onChange={e => updateForm('zip_code', e.target.value)} placeholder="78701"
                      aria-required="true" aria-invalid={isFieldInvalid('zip_code') || undefined}
                      className={isFieldInvalid('zip_code') ? 'border-red-400 bg-red-50' : ''} />
                  </div>
                </div>
              </div>
            </fieldset>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="field-title">Listing Title</Label>
                  <Input id="field-title" value={form.listing_title} onChange={e => updateForm('listing_title', e.target.value)}
                    placeholder="e.g., Charming 3BR near Downtown" aria-describedby="title-hint" />
                  <p id="title-hint" className="text-xs text-gray-500 mt-1">Auto-generated if left blank</p>
                </div>
                <div>
                  <Label htmlFor="field-listing-url">Listing URL</Label>
                  <Input id="field-listing-url" value={form.listing_url} onChange={e => updateForm('listing_url', e.target.value)}
                    placeholder="https://zillow.com/..." />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="field-description">Description</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleGenerateDescription} disabled={generatingDescription}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50">
                    {generatingDescription ? <Loader2 className="w-3 h-3 mr-1 animate-spin" aria-hidden="true" /> : <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />}
                    Generate with Penny AI
                  </Button>
                </div>
                <Textarea id="field-description" value={form.listing_description} onChange={e => updateForm('listing_description', e.target.value)}
                  placeholder="Describe the property, neighborhood, and why it's a good deal..." rows={5} />
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP 2: Financial Projections ===== */}
        {step === 2 && (
          <div className="space-y-4">
            <fieldset className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <legend className="font-semibold text-sm text-green-800 flex items-center gap-2 px-1">
                <DollarSign className="w-4 h-4" aria-hidden="true" /> Core Financials
              </legend>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label htmlFor="field-price" className={isFieldInvalid('asking_price') ? 'text-red-600' : ''}>Asking Price ($) *</Label>
                  <Input id="field-price" type="number" value={form.asking_price} onChange={e => updateForm('asking_price', e.target.value)}
                    placeholder="250000" aria-required="true" aria-invalid={isFieldInvalid('asking_price') || undefined}
                    className={isFieldInvalid('asking_price') ? 'border-red-400 bg-red-50' : ''} />
                </div>
                <div>
                  <Label htmlFor="field-revenue" className={isFieldInvalid('monthly_revenue') ? 'text-red-600' : ''}>Monthly Revenue ($) *</Label>
                  <Input id="field-revenue" type="number" value={form.monthly_revenue} onChange={e => updateForm('monthly_revenue', e.target.value)}
                    placeholder="4500" aria-required="true" aria-invalid={isFieldInvalid('monthly_revenue') || undefined}
                    className={isFieldInvalid('monthly_revenue') ? 'border-red-400 bg-red-50' : ''} />
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor="field-optype" className={isFieldInvalid('operation_type') ? 'text-red-600' : ''}>Operation Type *</Label>
                <Select value={form.operation_type} onValueChange={v => updateForm('operation_type', v)}>
                  <SelectTrigger id="field-optype" aria-required="true" aria-invalid={isFieldInvalid('operation_type') || undefined}
                    className={`w-full md:w-64 ${isFieldInvalid('operation_type') ? 'border-red-400 bg-red-50' : ''}`}>
                    <SelectValue placeholder="Select operation type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="str">Short-Term Rental (STR)</SelectItem>
                    <SelectItem value="mtr">Mid-Term Rental (MTR)</SelectItem>
                    <SelectItem value="coliving">Co-Living</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>

            <fieldset className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <legend className="font-semibold text-sm text-blue-800 flex items-center gap-2 px-1">
                <BarChart3 className="w-4 h-4" aria-hidden="true" /> Financial Projections
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                <div>
                  <Label htmlFor="field-adr-peak" className="text-xs">ADR Peak Season ($)</Label>
                  <Input id="field-adr-peak" type="number" value={form.adr_peak_season} onChange={e => updateForm('adr_peak_season', e.target.value)} placeholder="200" />
                </div>
                <div>
                  <Label htmlFor="field-adr-slow" className="text-xs">ADR Slow Season ($)</Label>
                  <Input id="field-adr-slow" type="number" value={form.adr_slow_season} onChange={e => updateForm('adr_slow_season', e.target.value)} placeholder="120" />
                </div>
                <div>
                  <Label htmlFor="field-room-rate" className="text-xs">Monthly Room Rate ($)</Label>
                  <Input id="field-room-rate" type="number" value={form.monthly_room_rate} onChange={e => updateForm('monthly_room_rate', e.target.value)} placeholder="800" />
                </div>
                <div>
                  <Label htmlFor="field-occupancy" className="text-xs">Avg Occupancy Rate (%)</Label>
                  <Input id="field-occupancy" type="number" value={form.avg_occupancy_rate} onChange={e => updateForm('avg_occupancy_rate', e.target.value)} placeholder="75" />
                </div>
                <div>
                  <Label htmlFor="field-yearly-rev" className="text-xs">Projected Yearly Revenue ($)</Label>
                  <Input id="field-yearly-rev" type="number" value={form.projected_yearly_revenue} onChange={e => updateForm('projected_yearly_revenue', e.target.value)} placeholder="54000" />
                </div>
                <div>
                  <Label htmlFor="field-peak-rev" className="text-xs">Peak Monthly Revenue ($)</Label>
                  <Input id="field-peak-rev" type="number" value={form.projected_monthly_revenue_peak} onChange={e => updateForm('projected_monthly_revenue_peak', e.target.value)} placeholder="6000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="field-peak-desc" className="text-xs">Peak Season Description</Label>
                  <Input id="field-peak-desc" value={form.peak_season_description} onChange={e => updateForm('peak_season_description', e.target.value)} placeholder="e.g., May-September" />
                </div>
                <div>
                  <Label htmlFor="field-deposits" className="text-xs">Deposits / Concessions Notes</Label>
                  <Input id="field-deposits" value={form.deposits_concessions_notes} onChange={e => updateForm('deposits_concessions_notes', e.target.value)} placeholder="e.g., First/last month required" />
                </div>
              </div>
            </fieldset>
          </div>
        )}

        {/* ===== STEP 3: Property Details + Landlord ===== */}
        {step === 3 && (
          <div className="space-y-4">
            <fieldset className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <legend className="font-semibold text-sm text-blue-800 flex items-center gap-2 px-1">
                <Home className="w-4 h-4" aria-hidden="true" /> Property Details
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                <div>
                  <Label htmlFor="field-bedrooms">Bedrooms</Label>
                  <Input id="field-bedrooms" type="number" value={form.bedrooms} onChange={e => updateForm('bedrooms', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="field-bathrooms">Bathrooms</Label>
                  <Input id="field-bathrooms" type="number" step="0.5" value={form.bathrooms} onChange={e => updateForm('bathrooms', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="field-sqft">Sq Ft</Label>
                  <Input id="field-sqft" type="number" value={form.sqft} onChange={e => updateForm('sqft', e.target.value)} placeholder="1500" />
                </div>
                <div>
                  <Label htmlFor="field-proptype">Property Type</Label>
                  <Select value={form.property_type} onValueChange={v => updateForm('property_type', v)}>
                    <SelectTrigger id="field-proptype"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_family">Single Family</SelectItem>
                      <SelectItem value="multi_family">Multi Family</SelectItem>
                      <SelectItem value="condo">Condo</SelectItem>
                      <SelectItem value="townhouse">Townhouse</SelectItem>
                      <SelectItem value="apartment">Apartment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>

            <fieldset className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <legend className="font-semibold text-sm text-purple-800 flex items-center gap-2 px-1">
                <User className="w-4 h-4" aria-hidden="true" /> Landlord / Contact Info
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                <div>
                  <Label htmlFor="field-landlord-name" className={isFieldInvalid('landlord_name') ? 'text-red-600' : ''}>Landlord Name *</Label>
                  <Input id="field-landlord-name" value={form.landlord_name} onChange={e => updateForm('landlord_name', e.target.value)} placeholder="John Smith"
                    aria-required="true" aria-invalid={isFieldInvalid('landlord_name') || undefined}
                    className={isFieldInvalid('landlord_name') ? 'border-red-400 bg-red-50' : ''} />
                </div>
                <div>
                  <Label htmlFor="field-landlord-email" className={isFieldInvalid('landlord_contact') ? 'text-red-600' : ''}>Landlord Email</Label>
                  <Input id="field-landlord-email" type="email" value={form.landlord_email} onChange={e => updateForm('landlord_email', e.target.value)} placeholder="john@example.com"
                    aria-describedby={isFieldInvalid('landlord_contact') ? 'landlord-contact-error' : undefined}
                    className={isFieldInvalid('landlord_contact') && !form.landlord_phone.trim() ? 'border-red-400 bg-red-50' : ''} />
                </div>
                <div>
                  <Label htmlFor="field-landlord-phone" className={isFieldInvalid('landlord_contact') ? 'text-red-600' : ''}>Landlord Phone</Label>
                  <Input id="field-landlord-phone" type="tel" value={form.landlord_phone} onChange={e => updateForm('landlord_phone', e.target.value)} placeholder="(555) 123-4567"
                    aria-describedby={isFieldInvalid('landlord_contact') ? 'landlord-contact-error' : undefined}
                    className={isFieldInvalid('landlord_contact') && !form.landlord_email.trim() ? 'border-red-400 bg-red-50' : ''} />
                </div>
              </div>
              {isFieldInvalid('landlord_contact') && (
                <p id="landlord-contact-error" className="text-xs text-red-600 mt-2 flex items-center gap-1" role="alert">
                  <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Provide at least a phone number or email
                </p>
              )}
            </fieldset>

            {/* Submission Details */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-semibold text-sm text-amber-800 flex items-center gap-2 mb-3" aria-hidden="true">
                <Building2 className="w-4 h-4" /> Submission Details
              </h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1 p-3 bg-white rounded-lg border">
                  <p className="text-xs text-gray-500">Acquisition Manager</p>
                  <p className="font-semibold text-sm text-indigo-700">{staffName}</p>
                  <p className="text-xs text-gray-400">You are submitting this deal</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    <Store className="w-4 h-4 text-purple-500" aria-hidden="true" /> Third-Party Seller Deal
                  </p>
                  <p className="text-xs text-gray-500" id="third-party-hint">Mark if this deal is from a third-party seller, not a direct landlord</p>
                </div>
                <Switch checked={form.is_third_party_seller} onCheckedChange={v => updateForm('is_third_party_seller', v)} aria-describedby="third-party-hint" />
              </div>
            </div>

            <div>
              <Label htmlFor="field-notes" className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" aria-hidden="true" /> Internal Notes
              </Label>
              <Textarea id="field-notes" value={form.notes} onChange={e => updateForm('notes', e.target.value)}
                placeholder="Negotiation details, special terms, relevant info..." rows={3} />
            </div>
          </div>
        )}

        {/* ===== STEP 4: Photos ===== */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold text-sm flex items-center gap-2 ${isFieldInvalid('photos') ? 'text-red-600' : 'text-gray-700'}`}>
                <Camera className={`w-4 h-4 ${isFieldInvalid('photos') ? 'text-red-500' : 'text-indigo-500'}`} aria-hidden="true" />
                Property Photos * {successfulPhotos.length > 0 && <Badge variant="outline" className="ml-1 text-xs">{successfulPhotos.length} photo{successfulPhotos.length !== 1 ? 's' : ''}</Badge>}
              </h3>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs" role="group" aria-label="Photo input method">
                <button type="button" className={`px-3 py-1.5 flex items-center gap-1 ${photoMode === 'upload' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`} onClick={() => setPhotoMode('upload')}
                  aria-pressed={photoMode === 'upload'}>
                  <Upload className="w-3 h-3" aria-hidden="true" />Upload
                </button>
                <button type="button" className={`px-3 py-1.5 flex items-center gap-1 border-l ${photoMode === 'url' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`} onClick={() => setPhotoMode('url')}
                  aria-pressed={photoMode === 'url'}>
                  <Link className="w-3 h-3" aria-hidden="true" />URL
                </button>
              </div>
            </div>

            {isFieldInvalid('photos') && (
              <div className="text-xs text-red-600 flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-md border border-red-200" role="alert">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" /> At least 1 property photo is required
              </div>
            )}

            {photoMode === 'upload' && (
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer border-indigo-200"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); }} onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
                role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} aria-label="Upload property photos" />
                <Camera className="w-10 h-10 mx-auto text-indigo-400 mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-indigo-700">Click or drag photos here</p>
                <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP up to 10MB each</p>
              </div>
            )}

            {photoMode === 'url' && (
              <div className="flex gap-2">
                <Input value={photoUrlInput} onChange={e => setPhotoUrlInput(e.target.value)} placeholder="https://example.com/photo.jpg" className="flex-1"
                  onKeyDown={e => e.key === 'Enter' && addPhotoUrl()} aria-label="Photo URL" />
                <Button type="button" variant="outline" size="sm" onClick={addPhotoUrl}>
                  <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add
                </Button>
              </div>
            )}

            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group">
                    {photo.uploading ? (
                      <div className="w-full h-24 bg-gray-100 rounded-lg flex flex-col items-center justify-center border">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" aria-hidden="true" />
                        <span className="text-[10px] text-gray-500 mt-1 truncate max-w-full px-1">{photo.name}</span>
                      </div>
                    ) : photo.error ? (
                      <div className="w-full h-24 bg-red-50 rounded-lg flex flex-col items-center justify-center border border-red-200">
                        <X className="w-5 h-5 text-red-400" aria-hidden="true" /><span className="text-[10px] text-red-500">Failed</span>
                      </div>
                    ) : (
                      <img src={photo.url} alt={photo.name} className="w-full h-24 object-cover rounded-lg border"
                        onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" fill="%23f3f4f6"><rect width="100" height="80"/></svg>'; }} />
                    )}
                    <button type="button" className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(photo.id)} aria-label={`Remove photo ${photo.name}`}>
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 5: Review & Submit ===== */}
        {step === 5 && (
          <div className="space-y-4">
            {!isFormValid && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5" aria-hidden="true" />
                  <div>
                    <h4 className="font-semibold text-red-800 text-sm">{allErrors.length} Required Field{allErrors.length !== 1 ? 's' : ''} Missing</h4>
                    <ul className="mt-1 space-y-0.5">
                      {allErrors.map((err, i) => <li key={i} className="text-xs text-red-700 flex items-center gap-1"><X className="w-3 h-3" aria-hidden="true" />{err.message}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Property Summary */}
              <div className="p-4 bg-gray-50 rounded-lg border space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-500" aria-hidden="true" /> Property</h4>
                <p className="font-medium">{form.listing_title || `${form.bedrooms}BR in ${form.city}, ${form.state}`}</p>
                <p className="text-sm text-gray-600">{form.address}, {form.city}, {form.state} {form.zip_code}</p>
                <p className="text-sm">{form.bedrooms}BR / {form.bathrooms}BA {form.sqft ? `· ${form.sqft} sqft` : ''}</p>
                <p className="text-sm capitalize">{form.property_type.replace('_', ' ')} · {form.operation_type?.toUpperCase() || 'N/A'}</p>
                {form.is_third_party_seller && <Badge className="bg-purple-500 text-white"><Store className="w-3 h-3 mr-1" aria-hidden="true" />Third-Party Seller</Badge>}
              </div>

              {/* Financial Summary */}
              <div className="p-4 bg-green-50 rounded-lg border space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" aria-hidden="true" /> Financials</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Asking Price:</span> <strong>{fmt(form.asking_price)}</strong></div>
                  <div><span className="text-gray-500">Monthly Revenue:</span> <strong>{fmt(form.monthly_revenue)}/mo</strong></div>
                  {form.adr_peak_season && <div><span className="text-gray-500">ADR Peak:</span> <strong>{fmt(form.adr_peak_season)}/nt</strong></div>}
                  {form.avg_occupancy_rate && <div><span className="text-gray-500">Occupancy:</span> <strong>{form.avg_occupancy_rate}%</strong></div>}
                  {form.projected_yearly_revenue && <div><span className="text-gray-500">Yearly Rev:</span> <strong>{fmt(form.projected_yearly_revenue)}</strong></div>}
                </div>
              </div>

              {/* Landlord Summary */}
              <div className="p-4 bg-purple-50 rounded-lg border space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2"><User className="w-4 h-4 text-purple-600" aria-hidden="true" /> Landlord</h4>
                <p className="text-sm font-medium">{form.landlord_name || 'N/A'}</p>
                {form.landlord_email && <p className="text-sm text-gray-600 flex items-center gap-1"><Mail className="w-3 h-3" aria-hidden="true" />{form.landlord_email}</p>}
                {form.landlord_phone && <p className="text-sm text-gray-600 flex items-center gap-1"><Phone className="w-3 h-3" aria-hidden="true" />{form.landlord_phone}</p>}
              </div>

              {/* Photos Summary */}
              <div className="p-4 bg-amber-50 rounded-lg border space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Camera className="w-4 h-4 text-amber-600" aria-hidden="true" /> Photos ({successfulPhotos.length})</h4>
                {successfulPhotos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1">
                    {successfulPhotos.slice(0, 4).map((p, i) => (
                      <img key={p.id} src={p.url} alt={`Photo ${i + 1}`} className="w-full h-12 object-cover rounded" />
                    ))}
                  </div>
                ) : <p className="text-sm text-red-600">No photos uploaded</p>}
              </div>
            </div>

            {/* Submitter */}
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold" aria-hidden="true">
                {staffName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-800">Submitting as: {staffName}</p>
                <p className="text-xs text-indigo-600">This deal will be sent to the Success Team for review</p>
              </div>
            </div>

            {form.listing_description && (
              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700 line-clamp-3">{form.listing_description}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={submitting}>
                <ChevronLeft className="w-4 h-4 mr-1" aria-hidden="true" /> Back
              </Button>
            )}
            {step === 1 && (
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500" aria-live="polite">{completedSteps}/4 sections complete</span>
            {step < 5 ? (
              <Button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700">
                Next <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !isFormValid || photos.some(p => p.uploading)}
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4 mr-2" aria-hidden="true" />}
                Submit for Review
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
