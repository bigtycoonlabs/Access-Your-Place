import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, Save, Globe, Image, Link, Upload, Trash2, Star, DollarSign, TrendingUp, BarChart3, Percent, Home, Bot, Sparkles, RotateCcw, ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';
import { Property, DealAnalytics, PropertyPhoto } from '@/types/dealflow';
import { DealPreview } from './DealPreview';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { sendDealFlowNotification } from '@/hooks/useDealFlowRealtime';



interface EditPublishModalProps {
  property: Property | null;
  analytics: DealAnalytics | null;
  photos: PropertyPhoto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Property>) => Promise<void>;
  onPublish: () => Promise<void>;
  onProcessPhotos?: (listingUrl?: string, photoUrls?: string[]) => Promise<void>;
  userRole?: string;
  /** Whether the current AM user owns this deal (submitted or found by them).
   *  When true AND userRole is Acquisition_Manager, the AM can edit financials, photos, description, and notes.
   *  When false AND userRole is Acquisition_Manager, the modal should not be opened (enforced by parent). */
  isOwnDeal?: boolean;
}

export function EditPublishModal({ property, analytics, photos, open, onOpenChange, onSave, onPublish, onProcessPhotos, userRole = 'Acquisition_Manager', isOwnDeal }: EditPublishModalProps) {
  const [form, setForm] = useState<Partial<Property>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [listingUrl, setListingUrl] = useState('');
  const [photoUrls, setPhotoUrls] = useState('');
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [pennyMarketData, setPennyMarketData] = useState<any>(null);
  const { toast } = useToast();

  const isSuccessTeam = userRole === 'Success_Manager' || userRole === 'Admin';
  /**
   * AM Role-Based Restrictions:
   * - AMs cannot verify, approve, or publish deals (success-team-only master actions)
   * - AMs CAN edit: financials, photos, description, and staff notes on their own deals
   * - AMs CANNOT edit: property type, bedrooms, bathrooms, units, featured toggle, verified toggle
   * - These master property fields are controlled exclusively by the success team
   */
  const isAM = userRole === 'Acquisition_Manager';
  // AMs can only edit limited fields on their own deals
  const amCanEdit = isAM && isOwnDeal;
  // Master edit controls (property details, verify, featured) are success-team-only
  const canEditMasterFields = isSuccessTeam;


  useEffect(() => {
    if (property) {
      setForm({
        listing_title: property.listing_title || '',
        description: property.description || property.listing_description || '',

        acquisition_fee: property.acquisition_fee,
        property_type: property.property_type,
        units_available: property.units_available,
        is_verified: property.is_verified,
        is_furnished: property.is_furnished,
        is_featured: property.is_featured || false,
        monthly_rent: property.monthly_rent,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        // Financial fields
        adr_peak_season: property.adr_peak_season,
        adr_slow_season: property.adr_slow_season,
        monthly_room_rate: property.monthly_room_rate,
        avg_occupancy_rate: property.avg_occupancy_rate,
        projected_yearly_revenue: property.projected_yearly_revenue,
        projected_monthly_revenue_peak: property.projected_monthly_revenue_peak,
        projected_monthly_revenue_slow: property.projected_monthly_revenue_slow,
        peak_season_description: property.peak_season_description,
        deposits_concessions_notes: property.deposits_concessions_notes,
      });
      // Reset Penny market data on property change
      setPennyMarketData(null);
    }
  }, [property]);

  if (!property) return null;

  const handleSave = async () => {
    // Validate key financial fields before save
    const missingFinancials: string[] = [];
    if (!form.monthly_rent || form.monthly_rent <= 0) missingFinancials.push('Monthly Rent');
    if (!form.acquisition_fee || form.acquisition_fee <= 0) missingFinancials.push('Acquisition Fee');
    if (!form.projected_yearly_revenue || form.projected_yearly_revenue <= 0) missingFinancials.push('Projected Yearly Revenue');
    if (!form.adr_peak_season || form.adr_peak_season <= 0) missingFinancials.push('ADR Peak Season');

    if (missingFinancials.length > 0) {
      toast({
        title: 'Financial projections incomplete',
        description: `Missing: ${missingFinancials.join(', ')}. Switch to the Financials tab to fill in these fields before publishing.`,
        variant: 'destructive',
      });
      // Still allow save — this is a warning, not a blocker
    }

    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const handlePublish = async () => { setPublishing(true); await onPublish(); setPublishing(false); };
  
  // Approve deal (verify + set status to approved)
  const handleApprove = async () => {
    setApproving(true);
    try {
      const approveData: Partial<Property> = {
        ...form,
        is_verified: true,
        status: 'approved' as any,
        deal_status: 'approved',
      };
      
      // Try edge function first
      try {
        const { data, error } = await supabase.functions.invoke('update-property', {
          body: { 
            id: property.id, 
            ...approveData,
            verified_at: new Date().toISOString(),
          }
        });
        if (!error && data?.success !== false) {
          setForm(f => ({ ...f, is_verified: true }));
          toast({ title: 'Deal Approved!', description: `"${property.listing_title || property.address}" has been verified and approved. You can now publish it.` });
          setApproving(false);
          return;
        }
      } catch (efErr) {
        console.warn('Edge function failed for approve, using direct DB:', efErr);
      }

      // Direct DB fallback
      const { error } = await supabase.from('properties').update({
        is_verified: true,
        status: 'approved',
        deal_status: 'approved',
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', property.id);
      
      if (error) throw error;
      
      setForm(f => ({ ...f, is_verified: true }));
      toast({ title: 'Deal Approved!', description: `"${property.listing_title || property.address}" has been verified and approved.` });
    } catch (err: any) {
      console.error('Approve error:', err);
      toast({ title: 'Approval Failed', description: err.message || 'Could not approve deal', variant: 'destructive' });
    }
    setApproving(false);
  };

  const handleProcessPhotos = async () => {
    if (!onProcessPhotos) return;
    setProcessingPhotos(true);
    const urls = photoUrls.split('\n').filter(u => u.trim());
    await onProcessPhotos(listingUrl || undefined, urls.length > 0 ? urls : undefined);
    setProcessingPhotos(false);
    setListingUrl('');
    setPhotoUrls('');
  };

  // Penny AI Description Generator
  const handlePennyDescription = async () => {
    if (!property?.city || !property?.state) {
      toast({ title: 'Property location required', description: 'Property must have city and state to generate a description.', variant: 'destructive' });
      return;
    }
    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke('penny-generate-description', {
        body: {
          address: property.address,
          city: property.city,
          state: property.state,
          zip_code: property.zip_code,
          bedrooms: form.bedrooms || property.bedrooms,
          bathrooms: form.bathrooms || property.bathrooms,
          monthly_rent: form.monthly_rent || property.monthly_rent,
          property_type: form.property_type || property.property_type,
          operation_type: property.operation_type,
          listing_title: form.listing_title || property.listing_title,
          acquisition_fee: form.acquisition_fee || property.acquisition_fee,
          is_furnished: form.is_furnished ?? property.is_furnished,
          penny_score: property.penny_score,
          adr_peak_season: form.adr_peak_season || property.adr_peak_season,
          adr_slow_season: form.adr_slow_season || property.adr_slow_season,
          monthly_room_rate: form.monthly_room_rate || property.monthly_room_rate,
          avg_occupancy_rate: form.avg_occupancy_rate || property.avg_occupancy_rate,
          peak_season_description: form.peak_season_description || property.peak_season_description,
          description: form.description
        }
      });
      if (error) throw error;
      if (data?.success && data.description) {
        setForm(f => ({ ...f, description: data.description }));
        if (data.market_data) setPennyMarketData(data.market_data);
        toast({ title: 'Description generated by Penny AI', description: 'Review and edit to match Access Your Place standards before publishing.' });

      } else {
        throw new Error(data?.error || 'Failed to generate description');
      }
    } catch (err: any) {
      console.error('Penny description error:', err);
      toast({ title: 'Description generation failed', description: err.message || 'Please try again.', variant: 'destructive' });
    }
    setGeneratingDescription(false);
  };

  // Calculate projected revenue based on financial inputs
  const calcMonthlyRevenue = () => {
    const adr = form.adr_peak_season || 0;
    const occ = (form.avg_occupancy_rate || 0) / 100;
    return Math.round(adr * occ * 30);
  };

  const calcNetMonthly = () => {
    return calcMonthlyRevenue() - (form.monthly_rent || 0);
  };

  const previewProperty = { ...property, ...form } as Property;

  // Determine if publish should be allowed
  // Success team can publish even if not verified (they can verify+publish)
  // Other roles need verification first
  const canPublish = isSuccessTeam || form.is_verified;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-publish-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAM ? 'Edit Deal Details' : 'Edit & Publish Deal'}
            {form.is_verified ? (
              <Badge className="bg-green-100 text-green-700 ml-2">
                <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                Verified
              </Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-700 ml-2">
                <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
                Unverified
              </Badge>
            )}
            {isAM && (
              <Badge className="bg-indigo-100 text-indigo-700 ml-2">
                AM Edit Mode
              </Badge>
            )}
          </DialogTitle>
          <p id="edit-publish-desc" className="text-sm text-gray-500">
            {property.address}, {property.city}, {property.state} {property.zip_code}
            {isAM && <span className="block text-xs text-indigo-600 mt-1">You can edit financials, photos, description, and notes on your deals. Verify, approve, and publish actions are managed by the Success Team.</span>}
          </p>
        </DialogHeader>
        <Tabs defaultValue={isAM ? 'financials' : 'edit'}>
          <TabsList className="flex-wrap" aria-label="Edit deal sections">
            {/* AMs see Edit Details tab but with restricted fields; default to financials */}
            <TabsTrigger value="edit">Edit Details</TabsTrigger>
            <TabsTrigger value="financials" className="flex items-center gap-1"><DollarSign className="w-4 h-4" aria-hidden="true" /> Financials</TabsTrigger>
            <TabsTrigger value="photos"><Image className="w-4 h-4 mr-1" aria-hidden="true" /> Photos</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="w-4 h-4 mr-1" aria-hidden="true" /> Preview</TabsTrigger>
          </TabsList>


          {/* Edit Details Tab */}
          <TabsContent value="edit" className="space-y-6 mt-4">
            
            {/* ============================================================
                DESCRIPTION SECTION — RENDERED FIRST FOR VISIBILITY
                BUG FIX: Previously this was below the grid and could be
                missed. Now it's the first thing staff sees.
                ============================================================ */}
            <Card className="border-2 border-[#d4a574]/30 bg-gradient-to-r from-[#1a365d]/[0.02] to-[#d4a574]/[0.05]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="w-5 h-5 text-[#1a365d]" aria-hidden="true" />
                    Listing Description
                    <Badge variant="outline" className="text-[#d4a574] border-[#d4a574]/50 text-xs">
                      <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
                      Penny AI Available
                    </Badge>
                  </CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePennyDescription}
                    disabled={generatingDescription}
                    className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7a] hover:from-[#2d4a7a] hover:to-[#3d5a8a] text-white"
                    aria-label="Let Penny AI generate an investor-focused listing description based on property data and market research"
                    aria-busy={generatingDescription}
                  >
                    {generatingDescription ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                        Penny is writing...
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4 mr-2" aria-hidden="true" />
                        <Sparkles className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                        Generate with Penny AI
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea 
                  id="edit-listing-description"
                  value={form.description || ''} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                  rows={Math.max(6, Math.min(16, Math.ceil((form.description || '').length / 80)))}
                  placeholder="Write an investor-focused property description here, or click 'Generate with Penny AI' to auto-generate a description with market data, platform recommendations, and revenue projections."
                  className="min-h-[150px] text-sm"
                  aria-label="Listing description text"
                  aria-describedby="edit-desc-help"
                />
                <p id="edit-desc-help" className="text-xs text-gray-500 mt-2">
                  {(form.description || '').length > 0 
                    ? `${(form.description || '').length} characters — review and edit to match AYP standards before publishing` 
                    : 'Click "Generate with Penny AI" to create an investor-focused description with market data, revenue projections, and platform recommendations.'}
                </p>


                {/* Penny Market Data Panel */}
                {pennyMarketData && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-[#1a365d]/5 to-[#d4a574]/10 rounded-lg border border-[#d4a574]/20" role="complementary" aria-label="Market data used by Penny AI">
                    <p className="text-xs font-semibold text-[#1a365d] mb-1.5 flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                      Penny Market Insights — {pennyMarketData.name}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div><span className="text-gray-500">Top Platform:</span> <span className="font-medium text-[#1a365d]">{pennyMarketData.top_platform}</span></div>
                      <div><span className="text-gray-500">Hotel ADR:</span> <span className="font-medium">{pennyMarketData.hotel_adr}</span></div>
                      <div><span className="text-gray-500">STR ADR:</span> <span className="font-medium">{pennyMarketData.str_adr}</span></div>
                      <div><span className="text-gray-500">Trend:</span> <span className="font-medium text-green-600">{pennyMarketData.market_trend}</span></div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handlePennyDescription}
                      disabled={generatingDescription}
                      className="h-6 text-[10px] text-[#d4a574] hover:text-[#c49464] mt-2"
                      aria-label="Regenerate description with Penny AI"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" aria-hidden="true" />
                      Regenerate
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Property Details Grid — Master fields hidden for AMs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-listing-title">Listing Title</Label>
                  <Input id="edit-listing-title" value={form.listing_title || ''} onChange={(e) => setForm({ ...form, listing_title: e.target.value })} placeholder="e.g., Stunning 3BR Near Downtown" />
                </div>
                {/* Property Type, Bedrooms, Bathrooms, Units — Success Team only */}
                {canEditMasterFields ? (
                  <>
                    <div>
                      <Label htmlFor="edit-property-type">Property Type</Label>
                      <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v as Property['property_type'] })}>
                        <SelectTrigger id="edit-property-type" aria-label="Property type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="apartment">Apartment Community</SelectItem>
                          <SelectItem value="private_landlord">Private Landlord</SelectItem>
                          <SelectItem value="townhome">Townhome Community</SelectItem>
                          <SelectItem value="single_family">Single Family Home</SelectItem>
                          <SelectItem value="condo">Condo</SelectItem>
                          <SelectItem value="multi_family">Multi-Family</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-bedrooms">Bedrooms</Label>
                        <Input id="edit-bedrooms" type="number" min={0} value={form.bedrooms || ''} onChange={(e) => setForm({ ...form, bedrooms: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label htmlFor="edit-bathrooms">Bathrooms</Label>
                        <Input id="edit-bathrooms" type="number" min={0} step={0.5} value={form.bathrooms || ''} onChange={(e) => setForm({ ...form, bathrooms: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="edit-units">Units Available</Label>
                      <Input id="edit-units" type="number" min={1} value={form.units_available || 1} onChange={(e) => setForm({ ...form, units_available: Number(e.target.value) })} />
                    </div>
                  </>
                ) : (
                  /* AM read-only summary of master fields */
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2 text-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Property Details (read-only)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-gray-500">Type:</span> <span className="font-medium">{form.property_type?.replace('_', ' ')}</span></div>
                      <div><span className="text-gray-500">Beds/Baths:</span> <span className="font-medium">{form.bedrooms}/{form.bathrooms}</span></div>
                      <div><span className="text-gray-500">Units:</span> <span className="font-medium">{form.units_available || 1}</span></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Contact Success Team to modify property details.</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {/* Verified toggle — Success Team only */}
                {canEditMasterFields && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-verified">Verified</Label>
                    <Switch id="edit-verified" checked={form.is_verified} onCheckedChange={(v) => setForm({ ...form, is_verified: v })} aria-label="Mark as verified" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-furnished">Furnished</Label>
                  <Switch id="edit-furnished" checked={form.is_furnished} onCheckedChange={(v) => setForm({ ...form, is_furnished: v })} aria-label="Mark as furnished" />
                </div>
                
                {/* Featured on Homepage Toggle — Success Team only */}
                {canEditMasterFields && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className={`w-5 h-5 ${form.is_featured ? 'text-amber-500 fill-amber-500' : 'text-amber-400'}`} aria-hidden="true" />
                        <Label htmlFor="edit-featured" className="font-medium text-amber-800">Feature on Homepage</Label>
                      </div>
                      <Switch 
                        id="edit-featured"
                        checked={form.is_featured || false} 
                        onCheckedChange={(v) => setForm({ ...form, is_featured: v })} 
                        aria-label="Feature this property on the homepage"
                      />
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                      When enabled and published, this property will appear in the "Featured Live Deals" section on the homepage.
                    </p>
                  </div>
                )}

                {/* Approval Status Card - Success Team only */}
                {isSuccessTeam && !form.is_verified && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      <span className="font-medium text-blue-800">Quick Approve</span>
                    </div>
                    <p className="text-xs text-blue-600 mb-3">
                      As Success Team, you can approve this deal directly without going through the verification tab.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleApprove}
                      disabled={approving}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      aria-label="Approve and verify this deal"
                    >
                      {approving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                      )}
                      Approve Deal
                    </Button>
                  </div>
                )}
              </div>
            </div>

          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials" className="space-y-6 mt-4">
            {/* Revenue Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="group" aria-label="Financial summary">
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-600" aria-hidden="true" />
                    <span className="text-xs text-green-700 font-medium">Est. Monthly Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-green-800">${calcMonthlyRevenue().toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Home className="w-4 h-4 text-blue-600" aria-hidden="true" />
                    <span className="text-xs text-blue-700 font-medium">Monthly Rent</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800">${(form.monthly_rent || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className={`bg-gradient-to-br ${calcNetMonthly() >= 0 ? 'from-emerald-50 to-green-50 border-emerald-200' : 'from-red-50 to-rose-50 border-red-200'}`}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span className="text-xs font-medium">Net Monthly</span>
                  </div>
                  <p className={`text-2xl font-bold ${calcNetMonthly() >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    ${calcNetMonthly().toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-amber-600" aria-hidden="true" />
                    <span className="text-xs text-amber-700 font-medium">Acquisition Fee</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-800">${(form.acquisition_fee || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            {/* Core Financial Fields */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                  Core Financial Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="fin-rent" className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-gray-400" aria-hidden="true" />
                      Monthly Property Rent
                    </Label>
                    <Input 
                      id="fin-rent"
                      type="number" 
                      min={0} 
                      step={50}
                      value={form.monthly_rent || ''} 
                      onChange={(e) => setForm({ ...form, monthly_rent: Number(e.target.value) })} 
                      placeholder="e.g., 1500"
                    />
                    <p className="text-xs text-gray-500 mt-1">What the investor pays the landlord monthly</p>
                  </div>
                  <div>
                    <Label htmlFor="fin-acq-fee" className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-gray-400" aria-hidden="true" />
                      Acquisition Fee
                    </Label>
                    <Input 
                      id="fin-acq-fee"
                      type="number" 
                      min={0} 
                      step={100}
                      value={form.acquisition_fee || ''} 
                      onChange={(e) => setForm({ ...form, acquisition_fee: Number(e.target.value) })} 
                      placeholder="e.g., 2500"
                    />
                    <p className="text-xs text-gray-500 mt-1">One-time fee charged to investor ($2,500-$10,000)</p>
                  </div>
                  <div>
                    <Label htmlFor="fin-occ" className="flex items-center gap-1">
                      <Percent className="w-3 h-3 text-gray-400" aria-hidden="true" />
                      Average Occupancy Rate (%)
                    </Label>
                    <Input 
                      id="fin-occ"
                      type="number" 
                      min={0} 
                      max={100} 
                      step={1}
                      value={form.avg_occupancy_rate || ''} 
                      onChange={(e) => setForm({ ...form, avg_occupancy_rate: Number(e.target.value) })} 
                      placeholder="e.g., 75"
                    />
                    <p className="text-xs text-gray-500 mt-1">Expected average occupancy percentage</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Rate Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                  Average Daily Rate (ADR) Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="fin-adr-peak">ADR - Peak Season ($)</Label>
                    <Input 
                      id="fin-adr-peak"
                      type="number" 
                      min={0} 
                      step={5}
                      value={form.adr_peak_season || ''} 
                      onChange={(e) => setForm({ ...form, adr_peak_season: Number(e.target.value) })} 
                      placeholder="e.g., 180"
                    />
                    <p className="text-xs text-gray-500 mt-1">Average nightly rate during peak season</p>
                  </div>
                  <div>
                    <Label htmlFor="fin-adr-slow">ADR - Slow Season ($)</Label>
                    <Input 
                      id="fin-adr-slow"
                      type="number" 
                      min={0} 
                      step={5}
                      value={form.adr_slow_season || ''} 
                      onChange={(e) => setForm({ ...form, adr_slow_season: Number(e.target.value) })} 
                      placeholder="e.g., 120"
                    />
                    <p className="text-xs text-gray-500 mt-1">Average nightly rate during slow season</p>
                  </div>
                  <div>
                    <Label htmlFor="fin-room-rate">Average Room Rate ($/month)</Label>
                    <Input 
                      id="fin-room-rate"
                      type="number" 
                      min={0} 
                      step={25}
                      value={form.monthly_room_rate || ''} 
                      onChange={(e) => setForm({ ...form, monthly_room_rate: Number(e.target.value) })} 
                      placeholder="e.g., 850"
                    />
                    <p className="text-xs text-gray-500 mt-1">For co-living: per-room monthly rate</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="fin-peak-desc">Peak Season Description</Label>
                  <Input 
                    id="fin-peak-desc"
                    value={form.peak_season_description || ''} 
                    onChange={(e) => setForm({ ...form, peak_season_description: e.target.value })} 
                    placeholder="e.g., June through September, major events in October"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Revenue Projections */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                  Revenue Projections
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="fin-yearly-rev">Projected Yearly Revenue ($)</Label>
                    <Input 
                      id="fin-yearly-rev"
                      type="number" 
                      min={0} 
                      step={500}
                      value={form.projected_yearly_revenue || ''} 
                      onChange={(e) => setForm({ ...form, projected_yearly_revenue: Number(e.target.value) })} 
                      placeholder="e.g., 48000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fin-monthly-peak">Monthly Revenue - Peak ($)</Label>
                    <Input 
                      id="fin-monthly-peak"
                      type="number" 
                      min={0} 
                      step={100}
                      value={form.projected_monthly_revenue_peak || ''} 
                      onChange={(e) => setForm({ ...form, projected_monthly_revenue_peak: Number(e.target.value) })} 
                      placeholder="e.g., 5400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fin-monthly-slow">Monthly Revenue - Slow ($)</Label>
                    <Input 
                      id="fin-monthly-slow"
                      type="number" 
                      min={0} 
                      step={100}
                      value={form.projected_monthly_revenue_slow || ''} 
                      onChange={(e) => setForm({ ...form, projected_monthly_revenue_slow: Number(e.target.value) })} 
                      placeholder="e.g., 3200"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="fin-deposits">Deposits, Concessions & Notes</Label>
                  <Textarea 
                    id="fin-deposits"
                    value={form.deposits_concessions_notes || ''} 
                    onChange={(e) => setForm({ ...form, deposits_concessions_notes: e.target.value })} 
                    rows={3}
                    placeholder="e.g., First month free, $500 security deposit, pet deposit $300..."
                  />
                </div>

                {/* Auto-calculated summary */}
                {(form.adr_peak_season || form.adr_slow_season) && form.avg_occupancy_rate ? (
                  <div className="p-4 bg-gradient-to-r from-[#1a365d]/5 to-[#d4a574]/10 rounded-lg border border-[#d4a574]/20">
                    <h4 className="font-semibold text-sm text-[#1a365d] mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" aria-hidden="true" />
                      Auto-Calculated Estimates
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {form.adr_peak_season ? (
                        <div>
                          <p className="text-gray-500">Peak Monthly (est.)</p>
                          <p className="font-bold text-green-700">
                            ${Math.round(form.adr_peak_season * (form.avg_occupancy_rate / 100) * 30).toLocaleString()}
                          </p>
                        </div>
                      ) : null}
                      {form.adr_slow_season ? (
                        <div>
                          <p className="text-gray-500">Slow Monthly (est.)</p>
                          <p className="font-bold text-amber-700">
                            ${Math.round(form.adr_slow_season * (form.avg_occupancy_rate / 100) * 30).toLocaleString()}
                          </p>
                        </div>
                      ) : null}
                      {form.monthly_rent ? (
                        <div>
                          <p className="text-gray-500">Net Peak (est.)</p>
                          <p className={`font-bold ${(form.adr_peak_season || 0) * (form.avg_occupancy_rate / 100) * 30 - form.monthly_rent >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            ${Math.round((form.adr_peak_season || 0) * (form.avg_occupancy_rate / 100) * 30 - form.monthly_rent).toLocaleString()}
                          </p>
                        </div>
                      ) : null}
                      {form.monthly_rent && form.adr_slow_season ? (
                        <div>
                          <p className="text-gray-500">Net Slow (est.)</p>
                          <p className={`font-bold ${form.adr_slow_season * (form.avg_occupancy_rate / 100) * 30 - form.monthly_rent >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            ${Math.round(form.adr_slow_season * (form.avg_occupancy_rate / 100) * 30 - form.monthly_rent).toLocaleString()}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Photos Tab */}
          <TabsContent value="photos" className="space-y-4 mt-4">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h4 className="font-semibold mb-3 flex items-center gap-2"><Upload className="w-4 h-4" aria-hidden="true" /> Photo Processing Pipeline</h4>
              <p className="text-sm text-gray-600 mb-4">Scrape photos from a listing URL or paste image URLs. Photos will be processed to remove EXIF data and blur any visible addresses.</p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="photo-listing-url" className="flex items-center gap-1"><Link className="w-3 h-3" aria-hidden="true" /> Listing URL (Zillow, Apartments.com, etc.)</Label>
                  <Input id="photo-listing-url" value={listingUrl} onChange={(e) => setListingUrl(e.target.value)} placeholder="https://www.zillow.com/..." />
                </div>
                <div>
                  <Label htmlFor="photo-urls">Or paste photo URLs (one per line)</Label>
                  <Textarea id="photo-urls" value={photoUrls} onChange={(e) => setPhotoUrls(e.target.value)} rows={3} placeholder="https://example.com/photo1.jpg&#10;https://example.com/photo2.jpg" />
                </div>
                <Button onClick={handleProcessPhotos} disabled={processingPhotos || (!listingUrl && !photoUrls)} className="bg-indigo-600 hover:bg-indigo-700">
                  {processingPhotos ? <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden="true" /> : <Image className="w-4 h-4 mr-1" aria-hidden="true" />} Process Photos
                </Button>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Processed Photos ({photos.length})</h4>
              {photos.length === 0 ? <p className="text-gray-500 text-sm">No photos yet. Use the form above to add photos.</p> : (
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img src={photo.processed_url || photo.original_url} alt={`Property photo`} className="w-full h-24 object-cover rounded-lg" />
                      {photo.is_processed && <span className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 rounded">Processed</span>}
                      <button className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove photo"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="mt-4"><DealPreview property={previewProperty} analytics={analytics} photos={photos} /></TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} aria-label="Save changes">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden="true" /> : <Save className="w-4 h-4 mr-1" aria-hidden="true" />} Save
          </Button>
          {/* Approve button — Success Team only (AMs cannot approve deals) */}
          {isSuccessTeam && !form.is_verified && (
            <Button 
              onClick={handleApprove} 
              disabled={approving}
              className="bg-blue-600 hover:bg-blue-700"
              aria-label="Approve and verify this deal"
            >
              {approving ? <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden="true" /> : <ShieldCheck className="w-4 h-4 mr-1" aria-hidden="true" />} Approve
            </Button>
          )}
          {/* Publish button — Success Team only (AMs cannot publish deals) */}
          {!isAM && (
            <Button 
              onClick={handlePublish} 
              disabled={publishing || !canPublish} 
              className="bg-green-600 hover:bg-green-700"
              aria-label={canPublish ? 'Publish this deal to the marketplace' : 'Deal must be verified before publishing'}
              title={!canPublish ? 'Deal must be verified before publishing. Click "Approve" first.' : ''}
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden="true" /> : <Globe className="w-4 h-4 mr-1" aria-hidden="true" />} Publish
            </Button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
