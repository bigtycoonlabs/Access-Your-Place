import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useCallerType } from '@/hooks/useCallerType';
import { PennyScoreBadge } from '@/components/investor/PennyScoreBadge';
import { PropertyImage } from '@/components/marketplace/PropertyImage';
import { resolvePublicPhotoUrl } from '@/utils/photoUtils';
import { DealSEO } from '@/components/marketplace/DealSEO';
import {
  ArrowLeft, MapPin, Bed, Bath, Home, Building2, DollarSign, TrendingUp,
  Calendar, Clock, Heart, Share2, Phone, Mail, Shield, ShieldCheck,
  Users, Star, Briefcase, ChevronLeft, ChevronRight, Maximize2, X,
  Copy, Check, Facebook, Twitter, Linkedin, MessageCircle, Loader2,
  AlertTriangle, FileText, Calculator, BarChart3, Zap, Target, Camera,
  Lock, Eye
} from 'lucide-react';

interface Property {
  id: string;
  listing_title: string;
  address: string | null;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  square_feet?: number;
  sqft?: number;

  monthly_rent: number;
  acquisition_fee: number;
  is_furnished: boolean;
  is_verified: boolean;
  staff_verified: boolean;
  operation_type: string;
  property_type: string;
  description: string;
  created_at: string;
  is_featured?: boolean;
  photos?: string[];
  penny_score?: number;
  penny_recommendation?: string;
  source?: string;
  landlord_name?: string | null;
  landlord_phone?: string | null;
  landlord_email?: string | null;
  community_name?: string | null;
  internal_notes?: string | null;
}

interface PropertyAnalytics {
  property_id: string;
  str_average_daily_rate: number;
  str_occupancy_rate: number;
  str_projected_yearly_revenue: number;
  str_viability_score: number;
  coliving_per_room_rate: number;
  coliving_projected_yearly_revenue: number;
  coliving_viability_score: number;
  overall_deal_score?: number;
}


export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { callerType, isFunded, loading: callerLoading } = useCallerType();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [analytics, setAnalytics] = useState<PropertyAnalytics | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  // Wait for caller type to resolve before fetching property
  useEffect(() => {
    if (id && !callerLoading) {
      fetchProperty();
    }
  }, [id, callerLoading, callerType]);

  const fetchProperty = async () => {
    setLoading(true);
    setError(null);
    
    console.log(`[PropertyDetail] Fetching property ${id} with caller_type=${callerType}, isFunded=${isFunded}`);
    
    try {
      let propertyData: Property | null = null;

      // Strategy 1: Use get-properties edge function with caller_type for proper visibility filtering
      try {
        const { data: efData, error: efError } = await supabase.functions.invoke('get-properties', {
          body: { 
            id,
            caller_type: callerType,
          }
        });
        
        if (!efError && efData?.property) {
          propertyData = efData.property;
          console.log(`[PropertyDetail] Edge function returned property. Address visible: ${!!propertyData?.address}`);
        } else if (!efError && efData?.properties?.length > 0) {
          propertyData = efData.properties[0];
          console.log(`[PropertyDetail] Edge function returned property from array. Address visible: ${!!propertyData?.address}`);
        } else {
          console.warn('[PropertyDetail] Edge function returned no data:', efError);
        }
      } catch (efErr) {
        console.warn('[PropertyDetail] Edge function failed, falling back to DB:', efErr);
      }

      // Strategy 2: Direct DB query fallback with client-side visibility filtering
      if (!propertyData) {
        const { data: dbData, error: dbError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', id)
          .single();

        if (dbError) throw dbError;
        if (!dbData) throw new Error('Property not found');
        
        // Apply client-side visibility filtering since we bypassed the edge function
        propertyData = { ...dbData };
        if (callerType !== 'staff') {
          // Strip landlord contact for non-staff
          propertyData.landlord_name = null;
          propertyData.landlord_email = null;
          propertyData.landlord_phone = null;
          propertyData.internal_notes = null;
          propertyData.community_name = null;
          
          // Strip address unless funded investor with visibility enabled
          const vis = (dbData as any).visibility_settings || {};
          if (callerType === 'funded_investor' && vis.show_address) {
            // Keep address for funded investors
          } else {
            propertyData.address = null;
          }
        }
        
        console.log(`[PropertyDetail] DB fallback used. Address visible: ${!!propertyData.address}`);
      }
      
      setProperty(propertyData);

      // Fetch analytics from deal_analytics (the actual table)
      const { data: analyticsData } = await supabase
        .from('deal_analytics')
        .select('*')
        .eq('property_id', id)
        .single();

      if (analyticsData) {
        setAnalytics(analyticsData);
      }

      // Resolve photos
      const photoUrls: string[] = [];

      // Photos from edge function response (already enriched)
      if (propertyData.photos && Array.isArray(propertyData.photos) && propertyData.photos.length > 0) {
        propertyData.photos
          .filter((url: string) => url && url.trim().length > 0)
          .forEach((url: string) => {
            photoUrls.push(resolvePublicPhotoUrl(url));
          });
        console.log(`[PropertyDetail] Found ${photoUrls.length} photos from property data`);
      }

      // Also try property_photos table as secondary source
      if (photoUrls.length === 0) {
        const { data: photosData } = await supabase
          .from('property_photos')
          .select('original_url, processed_url, thumbnail_url, display_order')
          .eq('property_id', id)
          .order('display_order', { ascending: true });

        if (photosData && photosData.length > 0) {
          photosData.forEach(p => {
            const url = p.processed_url || p.original_url;
            if (url) {
              photoUrls.push(resolvePublicPhotoUrl(url));
            }
          });
          console.log(`[PropertyDetail] Found ${photosData.length} photos in property_photos table`);
        }
      }

      console.log(`[PropertyDetail] Total photos resolved: ${photoUrls.length}`);
      setPhotos(photoUrls);

    } catch (err: any) {
      console.error('Error fetching property:', err);
      setError(err.message || 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  // Helper: build the display location string based on what's visible
  const getDisplayLocation = () => {
    if (!property) return '';
    const parts: string[] = [];
    if (property.address) {
      parts.push(property.address);
    }
    if (property.city) parts.push(property.city);
    if (property.state) parts.push(property.state);
    if (property.zip_code) parts.push(property.zip_code);
    
    if (property.address) {
      // Full address: "123 Main St, Dallas, TX 75201"
      return `${'📍 Address Protected'}, ${property.city}, ${property.state} ${property.zip_code}`;
    }
    // ZIP only: "Dallas, TX 75201"
    return `${property.city}, ${property.state} ${property.zip_code}`;
  };

  // Check if address is hidden (server stripped it)
  const isAddressHidden = !property?.address;

  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: property?.listing_title || 'Property Deal',
          text: `Check out this rental arbitrage opportunity in ${property?.city}, ${property?.state}`,
          url
        });
      } catch (err) {
        setShareOpen(true);
      }
    } else {
      setShareOpen(true);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link copied!', description: 'Property link copied to clipboard' });
  };

  const handleInquirySubmit = async () => {
    if (!inquiryForm.name || !inquiryForm.email) {
      toast({ title: 'Missing information', description: 'Please provide your name and email', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('submit-deal-inquiry', {
        body: {
          property_id: id,
          name: inquiryForm.name,
          email: inquiryForm.email,
          phone: inquiryForm.phone,
          message: inquiryForm.message,
          property_address: `${property?.city}, ${property?.state}`,
          property_title: property?.listing_title
        }
      });

      if (error) throw error;

      toast({ title: 'Inquiry submitted!', description: 'Our team will contact you within 24 hours.' });
      setInquiryOpen(false);
      setInquiryForm({ name: '', email: '', phone: '', message: '' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to submit inquiry', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const getOperationBadge = () => {
    switch (property?.operation_type) {
      case 'coliving':
        return { label: 'Co-Living', icon: Users, color: 'bg-purple-500' };
      case 'both':
        return { label: 'STR + Co-Living', icon: Star, color: 'bg-amber-500' };
      case 'peerspace':
        return { label: 'Peer Space', icon: Briefcase, color: 'bg-emerald-500' };
      default:
        return { label: 'Short-Term Rental', icon: Building2, color: 'bg-blue-500' };
    }
  };
  const opBadge = getOperationBadge();
  const isVerified = property?.is_verified || property?.staff_verified;
  const pennyScore = property?.penny_score ?? analytics?.overall_deal_score ?? null;

  // Normalize analytics field names — handle both `_yearly_revenue` and
  // `_projected_yearly_revenue` shapes (DB vs. edge function).
  const a: any = analytics || {};
  const strYearly = Number(a.str_yearly_revenue ?? a.str_projected_yearly_revenue ?? 0);
  const colivingYearly = Number(a.coliving_yearly_revenue ?? a.coliving_projected_yearly_revenue ?? 0);
  const strADR = Number(a.str_adr ?? a.str_average_daily_rate ?? 0);
  const strOcc = Number(a.str_occupancy ?? a.str_occupancy_rate ?? 0);
  const colivingPerRoomVal = Number(a.coliving_per_room ?? a.coliving_per_room_rate ?? 0);

  // Staff-entered financials from properties table — these are authoritative
  // numbers the YP team curated in the staff dashboard. Display them
  // prominently in the Financials tab for the public deal flow.
  const p: any = property || {};
  const adrPeak = Number(p.adr_peak_season) || 0;
  const adrSlow = Number(p.adr_slow_season) || 0;
  const roomRate = Number(p.monthly_room_rate) || 0;
  const occupancyRate = Number(p.avg_occupancy_rate) || 0;
  const projYearly = Number(p.projected_yearly_revenue) || 0;
  const projMonthlyPeak = Number(p.projected_monthly_revenue_peak) || 0;
  const projMonthlySlow = Number(p.projected_monthly_revenue_slow) || 0;
  const peakSeasonDesc = p.peak_season_description || '';
  const depositsNotes = p.deposits_concessions_notes || '';
  const hasStaffFinancials =
    adrPeak > 0 || adrSlow > 0 || roomRate > 0 || occupancyRate > 0 ||
    projYearly > 0 || projMonthlyPeak > 0 || projMonthlySlow > 0;

  const monthlyProfit = analytics
    ? Math.max(
        (strYearly / 12) - (property?.monthly_rent || 0),
        (colivingYearly / 12) - (property?.monthly_rent || 0)
      )
    : 0;


  // Show loading while caller type is being determined OR property is loading
  if (loading || callerLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="pt-20 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#d4a574] animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading property details...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="pt-20 flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md mx-auto px-4">
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Property Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'This property may have been removed or is no longer available.'}</p>
            <Button onClick={() => navigate('/deals')} className="bg-[#d4a574] hover:bg-[#c49464]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const displayTitle = property.listing_title || `${property.bedrooms}BR ${property.property_type?.replace('_', ' ') || 'Property'} in ${property.city}`;
  const displayLocation = getDisplayLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Deal pages had no title, no meta and no structured data, so twelve distinct
          listings looked like twelve copies of the homepage. */}
      <DealSEO deal={property as never} />
      <SEO 
        title={`${displayTitle} | Rental Arbitrage Deal`}
        description={`${property.bedrooms} bed, ${property.bathrooms} bath property in ${property.city}, ${property.state}. Monthly rent: $${property.monthly_rent?.toLocaleString()}. Acquisition fee: $${property.acquisition_fee?.toLocaleString()}.`}
        canonicalUrl={`/deals/${id}`}
        ogType="article"
      />
      <Header />
      
      <main className="pt-20 pb-12">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
            <Link to="/deals" className="text-gray-500 hover:text-[#d4a574] flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Marketplace
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-700 truncate max-w-[300px]">{displayTitle}</span>
          </nav>
        </div>

        <div className="max-w-7xl mx-auto px-4">
          {/* Photo Gallery */}
          <div className="mb-8">
            {photos.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Main Photo */}
                <div 
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 cursor-pointer group"
                  onClick={() => { setCurrentPhotoIndex(0); setLightboxOpen(true); }}
                >
                  <PropertyImage
                    src={photos[0]}
                    alt={displayTitle}
                    fallbackSources={photos.slice(1, 3)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    <Badge className={`${opBadge.color} text-white border-0 shadow-lg`}>
                      <opBadge.icon className="w-4 h-4 mr-1" />
                      {opBadge.label}
                    </Badge>
                    {isVerified && (
                      <Badge className="bg-emerald-500 text-white border-0 shadow-lg">
                        <ShieldCheck className="w-4 h-4 mr-1" />
                        YP Verified
                      </Badge>
                    )}
                    {property.source === 'third_party' && (
                      <Badge className="bg-purple-500 text-white border-0 shadow-lg">
                        <Users className="w-4 h-4 mr-1" />
                        Third-Party
                      </Badge>
                    )}
                  </div>

                  {/* Penny Score */}
                  <div className="absolute top-4 right-4 z-10">
                    <PennyScoreBadge 
                      score={pennyScore} 
                      propertyId={property.id}
                      size="lg"
                    />
                  </div>

                  {/* Expand Icon */}
                  <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-2 rounded-lg flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Maximize2 className="w-4 h-4" />
                    View Gallery ({photos.length} photos)
                  </div>
                </div>

                {/* Thumbnail Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {photos.slice(1, 5).map((photo, idx) => (
                    <div 
                      key={idx}
                      className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-200 cursor-pointer group"
                      onClick={() => { setCurrentPhotoIndex(idx + 1); setLightboxOpen(true); }}
                    >
                      <PropertyImage
                        src={photo}
                        alt={`${displayTitle} - Photo ${idx + 2}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {idx === 3 && photos.length > 5 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                          <span className="text-white text-xl font-bold">+{photos.length - 5} more</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Fill empty slots with placeholders */}
                  {photos.length < 5 && Array.from({ length: Math.max(0, 4 - (photos.length - 1)) }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-[4/3] rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex flex-col items-center justify-center">
                      <Camera className="w-8 h-8 text-slate-300 mb-1" />
                      <span className="text-xs text-slate-400">More photos coming</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* No photos - show styled placeholder */
              <div className="relative aspect-[21/9] rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1a365d]/10 to-[#d4a574]/10 flex items-center justify-center mb-3">
                  <Building2 className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-400 font-medium">Photos Coming Soon</p>
                <p className="text-sm text-slate-300 mt-1">Our team is preparing property photos</p>
                
                {/* Badges still show */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  <Badge className={`${opBadge.color} text-white border-0 shadow-lg`}>
                    <opBadge.icon className="w-4 h-4 mr-1" />
                    {opBadge.label}
                  </Badge>
                  {isVerified && (
                    <Badge className="bg-emerald-500 text-white border-0 shadow-lg">
                      <ShieldCheck className="w-4 h-4 mr-1" />
                      YP Verified
                    </Badge>
                  )}
                </div>
                <div className="absolute top-4 right-4">
                  <PennyScoreBadge score={pennyScore} propertyId={property.id} size="lg" />
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title & Location */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{displayTitle}</h1>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#d4a574] flex-shrink-0" />
                  <p className="text-lg text-gray-600">
                    {displayLocation}
                  </p>
                  {isAddressHidden && (
                    <Badge variant="outline" className="text-xs text-gray-500 border-gray-300 ml-2">
                      <Lock className="w-3 h-3 mr-1" />
                      Full address available to funded investors
                    </Badge>
                  )}
                </div>
                {isAddressHidden && !isFunded && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
                    <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Want to see the full address?</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Fund your investor account to unlock full property addresses for faster decision-making.
                        <Link to="/investor/login" className="ml-1 underline font-medium hover:text-blue-800">
                          Sign in to your portal
                        </Link>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Bed className="w-6 h-6 mx-auto mb-2 text-[#1a365d]" />
                    <p className="text-2xl font-bold">{property.bedrooms}</p>
                    <p className="text-sm text-gray-500">Bedrooms</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Bath className="w-6 h-6 mx-auto mb-2 text-[#1a365d]" />
                    <p className="text-2xl font-bold">{property.bathrooms}</p>
                    <p className="text-sm text-gray-500">Bathrooms</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Home className="w-6 h-6 mx-auto mb-2 text-[#1a365d]" />
                    <p className="text-2xl font-bold">{(property.sqft || property.square_feet)?.toLocaleString() || 'N/A'}</p>

                    <p className="text-sm text-gray-500">Sq Ft</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Building2 className="w-6 h-6 mx-auto mb-2 text-[#1a365d]" />
                    <p className="text-lg font-bold capitalize">{property.property_type?.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-500">Type</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full justify-start bg-white border">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="financials">Financials</TabsTrigger>
                  <TabsTrigger value="penny">Penny AI Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-[#d4a574]" />
                        Property Description
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {property.description || 'No description available for this property.'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Property Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${property.is_furnished ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <Check className={`w-5 h-5 ${property.is_furnished ? 'text-green-600' : 'text-gray-400'}`} />
                          </div>
                          <div>
                            <p className="font-medium">{property.is_furnished ? 'Furnished' : 'Unfurnished'}</p>
                            <p className="text-sm text-gray-500">Furniture status</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isVerified ? 'bg-green-100' : 'bg-amber-100'}`}>
                            <Shield className={`w-5 h-5 ${isVerified ? 'text-green-600' : 'text-amber-600'}`} />
                          </div>
                          <div>
                            <p className="font-medium">{isVerified ? 'Verified Deal' : 'Pending Verification'}</p>
                            <p className="text-sm text-gray-500">Verification status</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
                            <opBadge.icon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{opBadge.label}</p>
                            <p className="text-sm text-gray-500">Operation type</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100">
                            <Calendar className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium">{new Date(property.created_at).toLocaleDateString()}</p>
                            <p className="text-sm text-gray-500">Listed date</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Landlord Contact - only shown if server returned the data (staff or funded with visibility enabled) */}
                  {(property.landlord_name || property.landlord_phone || property.landlord_email) && (
                    <Card className="border-amber-200 bg-amber-50/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-800">
                          <Phone className="w-5 h-5" />
                          Landlord Contact
                          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 ml-2">
                            <Lock className="w-3 h-3 mr-1" />
                            Restricted
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {property.landlord_name && (
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="w-4 h-4 text-amber-600" />
                              <span className="text-gray-700">{property.landlord_name}</span>
                            </div>
                          )}
                          {property.landlord_phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-amber-600" />
                              <a href={`tel:${property.landlord_phone}`} className="text-blue-600 hover:underline">{property.landlord_phone}</a>
                            </div>
                          )}
                          {property.landlord_email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-4 h-4 text-amber-600" />
                              <a href={`mailto:${property.landlord_email}`} className="text-blue-600 hover:underline">{property.landlord_email}</a>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="financials" className="mt-4 space-y-6">
                  {/* Staff-entered financial projections — these are the
                      AUTHORITATIVE numbers entered by the YP team in the
                      staff dashboard (AMSubmitDealModal). They are pulled
                      directly from the properties row and surfaced for the
                      public deal flow so investors see ADR, monthly room
                      rate, occupancy, and projected revenue figures. */}
                  {hasStaffFinancials && (
                    <Card className="border-amber-200">
                      <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
                        <CardTitle className="flex items-center gap-2 text-amber-900">
                          <DollarSign className="w-5 h-5" />
                          Team Financial Projections
                          <Badge variant="outline" className="ml-auto text-xs border-amber-300 text-amber-700">
                            Verified by YP Team
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {adrPeak > 0 && (
                            <div className="bg-amber-50 rounded-lg p-3">
                              <div className="text-xs text-amber-700 font-medium uppercase tracking-wide">ADR (Peak)</div>
                              <div className="text-2xl font-bold text-amber-900 mt-1">${adrPeak.toLocaleString()}<span className="text-sm font-normal text-amber-700">/nt</span></div>
                            </div>
                          )}
                          {adrSlow > 0 && (
                            <div className="bg-amber-50 rounded-lg p-3">
                              <div className="text-xs text-amber-700 font-medium uppercase tracking-wide">ADR (Slow)</div>
                              <div className="text-2xl font-bold text-amber-900 mt-1">${adrSlow.toLocaleString()}<span className="text-sm font-normal text-amber-700">/nt</span></div>
                            </div>
                          )}
                          {roomRate > 0 && (
                            <div className="bg-purple-50 rounded-lg p-3">
                              <div className="text-xs text-purple-700 font-medium uppercase tracking-wide">Avg Room Rate</div>
                              <div className="text-2xl font-bold text-purple-900 mt-1">${roomRate.toLocaleString()}<span className="text-sm font-normal text-purple-700">/mo</span></div>
                            </div>
                          )}
                          {occupancyRate > 0 && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <div className="text-xs text-blue-700 font-medium uppercase tracking-wide">Avg Occupancy</div>
                              <div className="text-2xl font-bold text-blue-900 mt-1">{occupancyRate}%</div>
                            </div>
                          )}
                          {projMonthlyPeak > 0 && (
                            <div className="bg-emerald-50 rounded-lg p-3">
                              <div className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Proj. Monthly (Peak)</div>
                              <div className="text-2xl font-bold text-emerald-900 mt-1">${projMonthlyPeak.toLocaleString()}</div>
                            </div>
                          )}
                          {projMonthlySlow > 0 && (
                            <div className="bg-emerald-50 rounded-lg p-3">
                              <div className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Proj. Monthly (Slow)</div>
                              <div className="text-2xl font-bold text-emerald-900 mt-1">${projMonthlySlow.toLocaleString()}</div>
                            </div>
                          )}
                          {projYearly > 0 && (
                            <div className="bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg p-3 md:col-span-2 lg:col-span-3">
                              <div className="text-xs text-emerald-800 font-medium uppercase tracking-wide">Projected Yearly Revenue</div>
                              <div className="text-3xl font-bold text-emerald-900 mt-1">${projYearly.toLocaleString()}</div>
                            </div>
                          )}
                        </div>
                        {(peakSeasonDesc || depositsNotes) && (
                          <div className="mt-4 pt-4 border-t border-amber-200 space-y-2 text-sm">
                            {peakSeasonDesc && (
                              <div>
                                <span className="font-semibold text-amber-800">Peak Season:</span>{' '}
                                <span className="text-gray-700">{peakSeasonDesc}</span>
                              </div>
                            )}
                            {depositsNotes && (
                              <div>
                                <span className="font-semibold text-amber-800">Deposits & Concessions:</span>{' '}
                                <span className="text-gray-700">{depositsNotes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-[#d4a574]" />
                        Financial Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-gray-600">Monthly Rent</span>
                            <span className="font-bold text-lg">${property.monthly_rent?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-gray-600">Acquisition Fee</span>
                            <span className="font-bold text-lg text-[#1a365d]">${property.acquisition_fee?.toLocaleString()}</span>
                          </div>
                          {analytics && monthlyProfit > 0 && (
                            <>
                              <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-gray-600">Est. Monthly Profit</span>
                                <span className="font-bold text-lg text-green-600">${Math.round(monthlyProfit).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center py-2">
                                <span className="text-gray-600">Est. Annual Revenue</span>
                                <span className="font-bold text-lg">${Math.round(Math.max(strYearly, colivingYearly)).toLocaleString()}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {analytics && (strYearly > 0 || colivingYearly > 0) && (
                          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6">
                            <h4 className="font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                              <TrendingUp className="w-5 h-5" />
                              Revenue Projections
                            </h4>
                            <div className="space-y-3">
                              {strYearly > 0 && (
                                <div>
                                  <p className="text-sm text-gray-600">STR Revenue</p>
                                  <p className="text-xl font-bold text-emerald-700">${Math.round(strYearly).toLocaleString()}/yr</p>
                                  <p className="text-xs text-gray-500">ADR: ${strADR ? Math.round(strADR) : 'N/A'} | Occ: {Math.round(strOcc * (strOcc <= 1 ? 100 : 1))}%</p>
                                </div>
                              )}
                              {colivingYearly > 0 && (
                                <div className="pt-3 border-t border-emerald-200">
                                  <p className="text-sm text-gray-600">Co-Living Revenue</p>
                                  <p className="text-xl font-bold text-emerald-700">${Math.round(colivingYearly).toLocaleString()}/yr</p>
                                  <p className="text-xs text-gray-500">Per Room: ${colivingPerRoomVal ? Math.round(colivingPerRoomVal) : 'N/A'}/mo</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>


                <TabsContent value="penny" className="mt-4 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-purple-500" />
                        Penny AI Deal Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl">
                          <PennyScoreBadge 
                            score={pennyScore} 
                            propertyId={property.id}
                            size="xl"
                          />
                          <p className="mt-4 text-gray-600">
                            {property.penny_recommendation === 'strong_buy' && 'Penny AI strongly recommends this deal based on market data and projections.'}
                            {property.penny_recommendation === 'buy' && 'Penny AI recommends this deal as a solid investment opportunity.'}
                            {property.penny_recommendation === 'hold' && 'Penny AI suggests further analysis before proceeding.'}
                            {property.penny_recommendation === 'pass' && 'Penny AI has flagged concerns with this deal.'}
                            {!property.penny_recommendation && 'Penny AI analysis pending for this property.'}
                          </p>
                        </div>
                        
                        {analytics && (
                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm text-gray-600">STR Viability</span>
                                <span className="text-sm font-medium">{analytics.str_viability_score || 0}%</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full transition-all"
                                  style={{ width: `${analytics.str_viability_score || 0}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm text-gray-600">Co-Living Viability</span>
                                <span className="text-sm font-medium">{analytics.coliving_viability_score || 0}%</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-purple-500 rounded-full transition-all"
                                  style={{ width: `${analytics.coliving_viability_score || 0}%` }}
                                />
                              </div>
                            </div>
                            {pennyScore !== null && (
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm text-gray-600">Overall Penny Score</span>
                                  <span className="text-sm font-medium">{pennyScore}/100</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      pennyScore >= 70 ? 'bg-green-500' :
                                      pennyScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${pennyScore}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column - CTA */}
            <div className="space-y-6">
              {/* Price Card */}
              <Card className="sticky top-24 shadow-lg border-2 border-[#d4a574]/20">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <p className="text-sm text-gray-500 mb-1">Acquisition Fee</p>
                    <p className="text-4xl font-bold text-[#1a365d]">${property.acquisition_fee?.toLocaleString()}</p>
                    <p className="text-gray-500 mt-2">${property.monthly_rent?.toLocaleString()}/mo rent</p>
                  </div>

                  {monthlyProfit > 0 && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-700 font-medium">Est. Monthly Profit</span>
                        <span className="text-xl font-bold text-emerald-700">${Math.round(monthlyProfit).toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full bg-[#d4a574] hover:bg-[#c49464] mb-3 h-12 text-lg"
                    onClick={() => setInquiryOpen(true)}
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Inquire About This Deal
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsSaved(!isSaved)}
                      className={isSaved ? 'border-red-300 text-red-600' : ''}
                    >
                      <Heart className={`w-4 h-4 mr-2 ${isSaved ? 'fill-current' : ''}`} />
                      {isSaved ? 'Saved' : 'Save'}
                    </Button>
                    <Button variant="outline" onClick={handleShare}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </div>

                  <Separator className="my-6" />

                  {/* Address visibility info */}
                  {isAddressHidden && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4 flex items-start gap-2">
                      <Lock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-gray-500">
                        <p className="font-medium text-gray-600">ZIP Code: {property.zip_code}</p>
                        <p className="mt-0.5">Full address visible to funded investors only.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Shield className="w-4 h-4 text-[#d4a574]" />
                      <span>Landlord pre-approved for arbitrage</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4 text-[#d4a574]" />
                      <span>Response within 24 hours</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Target className="w-4 h-4 text-[#d4a574]" />
                      <span>Full acquisition support included</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Card */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Need Help?</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Our acquisition team is available to answer any questions about this property.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => window.location.href = 'mailto:deals@accessyourplace.com'}>
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Photo Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl p-0 bg-black/95">
          <DialogHeader className="sr-only">
            <DialogTitle>Photo Gallery</DialogTitle>
            <DialogDescription>Property photos</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close photo viewer"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-6 h-6" />
            </Button>
            
            {photos[currentPhotoIndex] && (
              <PropertyImage
                src={photos[currentPhotoIndex]}
                alt={`${displayTitle} - Photo ${currentPhotoIndex + 1}`}
                fallbackSources={photos.filter((_, i) => i !== currentPhotoIndex).slice(0, 2)}
                className="w-full max-h-[80vh] object-contain"
              />
            )}

            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous photo"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                  onClick={() => setCurrentPhotoIndex(prev => (prev - 1 + photos.length) % photos.length)}
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next photo"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                  onClick={() => setCurrentPhotoIndex(prev => (prev + 1) % photos.length)}
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
              {currentPhotoIndex + 1} / {photos.length || 1}
            </div>

            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-2 max-w-[80%] overflow-x-auto pb-2">
                {photos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPhotoIndex(idx)}
                    className={`w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === currentPhotoIndex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Inquiry Modal */}
      <Dialog open={inquiryOpen} onOpenChange={setInquiryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inquire About This Property</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Your Name *</Label>
              <Input 
                id="name"
                value={inquiryForm.name}
                onChange={e => setInquiryForm({...inquiryForm, name: e.target.value})}
                placeholder="John Smith"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input 
                id="email"
                type="email"
                value={inquiryForm.email}
                onChange={e => setInquiryForm({...inquiryForm, email: e.target.value})}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input 
                id="phone"
                type="tel"
                value={inquiryForm.phone}
                onChange={e => setInquiryForm({...inquiryForm, phone: e.target.value})}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea 
                id="message"
                value={inquiryForm.message}
                onChange={e => setInquiryForm({...inquiryForm, message: e.target.value})}
                placeholder="I'm interested in learning more about this property..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInquiryOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleInquirySubmit}
              disabled={submitting}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Inquiry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Share This Property</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input 
                value={typeof window !== 'undefined' ? window.location.href : ''}
                readOnly
                className="flex-1"
              />
              <Button onClick={copyLink} variant="outline">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                aria-label="Share this property on Facebook"
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}
              >
                <Facebook className="w-5 h-5 text-blue-600" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Share this property on X, formerly Twitter"
                onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(displayTitle)}`, '_blank')}
              >
                <Twitter className="w-5 h-5 text-sky-500" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Share this property on LinkedIn"
                onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank')}
              >
                <Linkedin className="w-5 h-5 text-blue-700" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
