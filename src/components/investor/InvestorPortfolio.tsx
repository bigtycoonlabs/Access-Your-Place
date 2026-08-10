import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { notifyAMAboutAction } from '@/utils/notifyAM';
import { generateSignedUrls, clearPhotoUrlCache } from '@/utils/photoUtils';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PortfolioPerformanceTracker } from './PortfolioPerformanceTracker';
import { PlatformConnections } from './PlatformConnections';
import { RevenueForecastChart } from './RevenueForecastChart';
import { WebhookEndpoints } from './WebhookEndpoints';
import { ReportPreferences } from './ReportPreferences';
import { ExpenseTracker } from './ExpenseTracker';
import { EnhancedPhotoUploader } from './EnhancedPhotoUploader';
import { PortfolioPhotoManager } from './PortfolioPhotoManager';
import { ClaimLegacyProperty } from './ClaimLegacyProperty';
import { SellMyOperation } from './SellMyOperation';
import { PortfolioDashboard } from './PortfolioDashboard';
import { PhotoLightbox } from './PhotoLightbox';
import { PortfolioStatusTimeline } from './PortfolioStatusTimeline';
import { PennyScoreBadge } from './PennyScoreBadge';

import { 
  Loader2, Plus, Building2, MapPin, DollarSign, Bed, Bath, 
  TrendingUp, Edit2, Trash2, CheckCircle, Clock, Home,
  PiggyBank, LineChart, Link2, Target, Store,
  Webhook, FileBarChart, Receipt, Camera, Image,
  FileText, AlertCircle, CreditCard, Eye, MessageSquare,
  Ruler, Shield, ArrowRight, X, BarChart3, ChevronLeft, ChevronRight,
  Globe, ExternalLink, Brain
} from 'lucide-react';




interface Props {
  investorId: string;
  investorName: string;
  investorEmail?: string;
}

interface PortfolioProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  square_footage?: number;
  monthly_rent: number;
  initial_investment: number;
  monthly_earnings: number;
  acquisition_fee: number;
  acquired_through_ayp: boolean;
  acquisition_source: 'ayp' | 'off_platform';
  acquisition_manager?: string;
  acquisition_date?: string;
  property_type: string;
  property_status: 'active' | 'pending' | 'pending_approval' | 'inactive' | 'rejected';
  has_lease_documents: boolean;
  has_corporate_sublease: boolean;
  lease_agreements_received: boolean;
  lease_type?: string;
  documents_complete: boolean;
  photo_urls: string[];
  notes?: string;
  credit_amount: number;
  credit_status: 'none' | 'pending_approval' | 'approved' | 'applied';
  staff_notes: Array<{ author: string; text: string; date: string }>;
  property_documents: Array<{ name: string; url: string; type: string; date: string }>;
  added_by_staff: boolean;
  deal_flow_property_id?: string;
  last_status_update?: string;
  status_updated_by?: string;
  operation_type?: string;
  community_name?: string;
  community_website?: string;
  penny_score?: number | null;
  penny_recommendation?: string | null;
  penny_scored_at?: string | null;
}



const ACQUISITION_MANAGERS = [
  { id: 'sarah_johnson', name: 'Sarah Johnson' },
  { id: 'michael_chen', name: 'Michael Chen' },
  { id: 'david_rodriguez', name: 'David Rodriguez' },
  { id: 'emily_thompson', name: 'Emily Thompson' },
  { id: 'james_wilson', name: 'James Wilson' },
  { id: 'other', name: 'Other / Unknown' }
];

const PROPERTY_TYPES = [
  { id: 'single_family', label: 'Single Family Home' },
  { id: 'multi_family', label: 'Multi-Family' },
  { id: 'condo', label: 'Condo/Townhouse' },
  { id: 'apartment', label: 'Apartment' },
  { id: 'duplex', label: 'Duplex' },
  { id: 'other', label: 'Other' }
];

const emptyProperty = {
  address: '', city: '', state: '', zip_code: '', bedrooms: 3, bathrooms: 2,
  square_footage: 0, monthly_rent: 0, initial_investment: 0, monthly_earnings: 0, 
  acquisition_fee: 0, acquired_through_ayp: true, acquisition_source: 'ayp' as const,
  acquisition_manager: '', acquisition_date: '', property_type: 'single_family',
  has_lease_documents: false, has_corporate_sublease: false, lease_agreements_received: false,
  lease_type: '', notes: '', operation_type: ''
};

export function InvestorPortfolio({ investorId, investorName, investorEmail }: Props) {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PortfolioProperty | null>(null);
  const [formData, setFormData] = useState(emptyProperty);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [photoManagerProperty, setPhotoManagerProperty] = useState<PortfolioProperty | null>(null);
  const [detailProperty, setDetailProperty] = useState<PortfolioProperty | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Photo URL resolution state
  const [resolvedPhotoUrls, setResolvedPhotoUrls] = useState<Record<string, string[]>>({});
  const [lightboxState, setLightboxState] = useState<{ photos: string[]; index: number; address: string } | null>(null);
  const [detailResolvedPhotos, setDetailResolvedPhotos] = useState<string[]>([]);
  
  const { toast } = useToast();

  useEffect(() => { fetchPortfolio(); }, [investorId]);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: { action: 'get_portfolio_properties', investor_id: investorId }
      });
      if (data?.properties) {
        setProperties(data.properties);
        // Resolve photo URLs for thumbnails in background
        resolveAllPropertyPhotos(data.properties);
      }
    } catch (err) { console.error('Error fetching portfolio:', err); }
    setLoading(false);
  };

  // Resolve photo URLs for all properties (for thumbnail display)
  const resolveAllPropertyPhotos = async (props: PortfolioProperty[]) => {
    const resolved: Record<string, string[]> = {};
    
    // Process in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < props.length; i += batchSize) {
      const batch = props.slice(i, i + batchSize);
      await Promise.all(batch.map(async (prop) => {
        if (prop.photo_urls?.length > 0) {
          try {
            // Only resolve the first photo for thumbnails (performance)
            const firstPhotoUrls = await generateSignedUrls([prop.photo_urls[0]]);
            resolved[prop.id] = firstPhotoUrls;
          } catch {
            resolved[prop.id] = [prop.photo_urls[0]]; // Fallback to original
          }
        }
      }));
    }
    
    setResolvedPhotoUrls(prev => ({ ...prev, ...resolved }));
  };

  // Resolve all photos when detail modal opens
  useEffect(() => {
    if (detailProperty?.photo_urls?.length) {
      setDetailResolvedPhotos([]); // Reset
      generateSignedUrls(detailProperty.photo_urls).then(urls => {
        setDetailResolvedPhotos(urls);
      }).catch(() => {
        setDetailResolvedPhotos(detailProperty.photo_urls); // Fallback
      });
    } else {
      setDetailResolvedPhotos([]);
    }
  }, [detailProperty?.id]);

  // Get resolved thumbnail URL for a property
  const getPropertyThumbnail = (property: PortfolioProperty): string | null => {
    const resolved = resolvedPhotoUrls[property.id];
    if (resolved?.length > 0) return resolved[0];
    if (property.photo_urls?.length > 0) return property.photo_urls[0];
    return null;
  };


  const handlePhotosChange = useCallback((urls: string[]) => {
    setPhotoUrls(urls);
  }, []);

  const handleSubmit = async () => {
    if (!formData.address || !formData.city || !formData.state) {
      toast({ title: 'Missing Information', description: 'Please fill in the address, city, and state.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const propertyPayload = {
        ...formData,
        photo_urls: photoUrls,
        acquired_through_ayp: formData.acquisition_source === 'ayp',
      };

      const { data, error: fnError } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: editingProperty ? 'update_portfolio_property' : 'add_portfolio_property',
          investor_id: investorId,
          property_id: editingProperty?.id,
          property_data: propertyPayload
        }
      });

      if (fnError) throw new Error(fnError.message || 'Edge function failed');

      if (data?.success) {
        toast({ title: editingProperty ? 'Property Updated' : 'Property Submitted', description: editingProperty ? 'Your property has been updated.' : 'Your property has been submitted for approval. The Success Team will review it shortly.' });
        if (!editingProperty) {
          notifyAMAboutAction(investorId, 'Portfolio Property Added', `Added ${formData.address}, ${formData.city}, ${formData.state} (${formData.acquisition_source === 'ayp' ? 'AYP' : 'Off-Platform'})`);
          
          // Notify Success Team via manage-portfolio-approvals (sends email + SMS)
          if (formData.acquisition_source === 'ayp') {
            try {
              await supabase.functions.invoke('manage-portfolio-approvals', {
                body: {
                  action: 'submit_property',
                  investor_id: investorId,
                  property_data: {
                    ...formData,
                    photo_urls: photoUrls,
                    acquired_through_ayp: true,
                  }
                }
              });
              console.log('[Portfolio] Success team notified of new AYP property submission');
            } catch (notifyErr) {
              console.warn('[Portfolio] Failed to notify success team:', notifyErr);
            }
          }

          const newPropertyId = data.property?.id;
          const currentPortfolioSize = properties.length + 1;
          toast({ 
            title: 'Penny AI Analyzing...', 
            description: 'Penny is scoring your property and preparing a personalized market analysis email.',
          });
          
          supabase.functions.invoke('penny-portfolio-analysis', {
            body: {
              action: 'analyze_portfolio_property',
              investor_id: investorId,
              investor_name: investorName,
              investor_email: investorEmail,
              property_data: {
                id: newPropertyId,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                zip_code: formData.zip_code,
                bedrooms: formData.bedrooms,
                bathrooms: formData.bathrooms,
                monthly_rent: formData.monthly_rent,
                property_type: formData.property_type,
                operation_type: formData.operation_type || 'str',
              },
              portfolio_size: currentPortfolioSize
            }
          }).then(({ data: pennyData }) => {
            if (pennyData?.success) {
              console.log(`[Portfolio] Penny AI scored property: ${pennyData.penny_score}/100`);
              toast({ 
                title: `Penny Score: ${pennyData.penny_score}/100`, 
                description: pennyData.email_sent 
                  ? 'Full analysis email sent to your inbox!' 
                  : 'Analysis complete. Check your portal for details.',
              });
              // Refresh portfolio to show updated penny scores
              fetchPortfolio();
            }
          }).catch(err => {
            console.warn('[Portfolio] Penny AI analysis failed (non-blocking):', err);
          });
        }


        // If AYP property without lease agreements, auto-request credit
        if (formData.acquisition_source === 'ayp' && !formData.lease_agreements_received && formData.acquisition_fee > 0 && !editingProperty) {
          try {
            await supabase.from('portfolio_credits').insert({
              investor_id: investorId,
              portfolio_property_id: data.property?.id || 'unknown',
              credit_amount: formData.acquisition_fee,
              credit_reason: `Acquisition fee credit - lease agreements not yet received for ${formData.address}`,
              credit_status: 'pending_approval'
            });
          } catch (e) { console.error('Credit request failed:', e); }
        }


        fetchPortfolio();
        handleCloseModal();
      } else if (data?.error) {
        // Fallback: direct insert
        const propertyData = {
          investor_id: investorId,
          address: formData.address, city: formData.city, state: formData.state,
          zip_code: formData.zip_code, bedrooms: formData.bedrooms, bathrooms: formData.bathrooms,
          square_footage: formData.square_footage || null,
          monthly_rent: formData.monthly_rent, initial_investment: formData.initial_investment,
          monthly_earnings: formData.monthly_earnings, acquisition_fee: formData.acquisition_fee || 0,
          acquired_through_ayp: formData.acquisition_source === 'ayp',
          acquisition_source: formData.acquisition_source,
          acquisition_manager: formData.acquisition_manager,
          acquisition_date: formData.acquisition_date || null,
          property_type: formData.property_type,
          has_lease_documents: formData.has_lease_documents,
          has_corporate_sublease: formData.has_corporate_sublease,
          lease_agreements_received: formData.lease_agreements_received,
          lease_type: formData.lease_type, notes: formData.notes,
          photo_urls: photoUrls, property_status: formData.acquisition_source === 'ayp' ? 'pending' : 'active',
          documents_complete: false, operation_type: formData.operation_type
        };

        // Routed through the edge functions rather than writing the table directly. Anon
        // INSERT and UPDATE on investor_portfolio have been revoked: they let anybody with
        // the publishable key add a holding to any client's portfolio. These handlers check
        // that the property actually belongs to the person editing it.
        if (editingProperty) {
          const { data: upd } = await supabase.functions.invoke('investor-auth', {
            body: { action: 'update_portfolio_property', investor_id: investorId,
                    property_id: editingProperty.id, property_data: propertyData },
          });
          if (!upd?.success) throw new Error(upd?.error || 'Could not save the changes.');
        } else {
          const { data: ins } = await supabase.functions.invoke('manage-investor-admin', {
            body: { action: 'add_portfolio_property', investor_id: investorId,
                    ...propertyData, status: 'active' },
          });
          if (!ins?.success) throw new Error(ins?.error || 'Could not add the property.');
        }

        toast({ title: editingProperty ? 'Property Updated' : 'Property Added' });
        fetchPortfolio();
        handleCloseModal();
      }
    } catch (err: any) {
      toast({ title: 'Error Saving Property', description: err.message || 'Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (propertyId: string) => {
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: { action: 'delete_portfolio_property', investor_id: investorId, property_id: propertyId }
      });
      if (data?.success) {
        toast({ title: 'Property Removed' });
        fetchPortfolio();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to remove property', variant: 'destructive' });
    }
    setDeleteConfirm(null);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingProperty(null);
    setFormData(emptyProperty);
    setPhotoUrls([]);
  };

  const handleEdit = (property: PortfolioProperty) => {
    setEditingProperty(property);
    setFormData({
      address: property.address, city: property.city, state: property.state, zip_code: property.zip_code,
      bedrooms: property.bedrooms, bathrooms: property.bathrooms,
      square_footage: property.square_footage || 0,
      monthly_rent: property.monthly_rent, initial_investment: property.initial_investment,
      monthly_earnings: property.monthly_earnings, acquisition_fee: property.acquisition_fee || 0,
      acquired_through_ayp: property.acquired_through_ayp,
      acquisition_source: property.acquisition_source || (property.acquired_through_ayp ? 'ayp' : 'off_platform'),
      acquisition_manager: property.acquisition_manager || '',
      acquisition_date: property.acquisition_date || '',
      property_type: property.property_type,
      has_lease_documents: property.has_lease_documents || false,
      has_corporate_sublease: property.has_corporate_sublease || false,
      lease_agreements_received: property.lease_agreements_received || false,
      lease_type: property.lease_type || '', notes: property.notes || '',
      operation_type: property.operation_type || ''
    });
    setPhotoUrls(property.photo_urls || []);
    setShowAddModal(true);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; label: string }> = {
      active: { bg: 'bg-green-500', label: 'Active' },
      pending: { bg: 'bg-yellow-500', label: 'Pending - Acquisition in Progress' },
      pending_approval: { bg: 'bg-yellow-500', label: 'Pending Approval' },
      inactive: { bg: 'bg-gray-500', label: 'Inactive' },
      rejected: { bg: 'bg-red-500', label: 'Rejected' }
    };
    const s = map[status] || { bg: 'bg-gray-500', label: status };
    return <Badge className={s.bg}>{s.label}</Badge>;
  };


  const filteredProperties = filterStatus === 'all' 
    ? properties 
    : properties.filter(p => {
        if (filterStatus === 'pending') return p.property_status === 'pending' || p.property_status === 'pending_approval';
        return p.property_status === filterStatus;
      });

  const stats = {
    totalProperties: properties.length,
    activeProperties: properties.filter(p => p.property_status === 'active').length,
    pendingProperties: properties.filter(p => p.property_status === 'pending' || p.property_status === 'pending_approval').length,
    totalInvested: properties.reduce((sum, p) => sum + (p.initial_investment || 0), 0),
    monthlyEarnings: properties.reduce((sum, p) => sum + (p.monthly_earnings || 0), 0),
    pendingCredits: properties.filter(p => p.credit_status === 'pending_approval').reduce((sum, p) => sum + (p.credit_amount || 0), 0),
    avgROI: properties.length > 0 
      ? ((properties.reduce((sum, p) => sum + (p.monthly_earnings || 0), 0) * 12) / 
         Math.max(properties.reduce((sum, p) => sum + (p.initial_investment || 0), 0), 1) * 100).toFixed(1) : '0'
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="dashboard" className="flex items-center gap-1 text-xs sm:text-sm">
            <BarChart3 className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="properties" className="flex items-center gap-1 text-xs sm:text-sm">
            <Building2 className="w-4 h-4" /><span className="hidden sm:inline">Properties</span>
          </TabsTrigger>
          <TabsTrigger value="sell" className="flex items-center gap-1 text-xs sm:text-sm">
            <Store className="w-4 h-4" /><span className="hidden sm:inline">Sell</span>
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-1 text-xs sm:text-sm">
            <Receipt className="w-4 h-4" /><span className="hidden sm:inline">Expenses</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-1 text-xs sm:text-sm">
            <LineChart className="w-4 h-4" /><span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="forecasting" className="flex items-center gap-1 text-xs sm:text-sm">
            <Target className="w-4 h-4" /><span className="hidden sm:inline">Forecast</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-1 text-xs sm:text-sm">
            <Link2 className="w-4 h-4" /><span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-1 text-xs sm:text-sm">
            <Webhook className="w-4 h-4" /><span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-1 text-xs sm:text-sm">
            <FileBarChart className="w-4 h-4" /><span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <PortfolioDashboard 
            investorId={investorId} 
            investorName={investorName}
            onNavigateToProperties={() => setActiveTab('properties')}
          />
        </TabsContent>

        <TabsContent value="properties" className="space-y-6">

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg"><Building2 className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalProperties}</p>
                    <p className="text-xs text-muted-foreground">Total Properties</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{stats.activeProperties}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{stats.pendingProperties}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#d4a574]/20 rounded-lg"><DollarSign className="w-5 h-5 text-[#d4a574]" /></div>
                  <div>
                    <p className="text-2xl font-bold">${stats.monthlyEarnings.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Monthly Earnings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{stats.avgROI}%</p>
                    <p className="text-xs text-muted-foreground">Annual ROI</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Credits Banner */}
          {stats.pendingCredits > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">Pending Credit: ${stats.pendingCredits.toLocaleString()}</p>
                    <p className="text-sm text-amber-600">You have acquisition fee credits pending Success Team approval for properties without lease agreements.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filter & Actions */}
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Your Properties</h2>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">In Progress</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowAddModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
              <Plus className="w-4 h-4 mr-2" />Add Property
            </Button>
          </div>

          {/* Properties List */}
          {filteredProperties.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Home className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">
                  {filterStatus !== 'all' ? `No ${filterStatus} properties` : 'No Properties Yet'}
                </h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  Add properties to track investments, earnings, and ROI.
                </p>
                <Button onClick={() => setShowAddModal(true)} className="mt-4 bg-[#d4a574] hover:bg-[#c49464]">
                  <Plus className="w-4 h-4 mr-2" />Add Your First Property
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredProperties.map((property) => (
                <Card key={property.id} className={
                  property.property_status === 'pending' || property.property_status === 'pending_approval' 
                    ? 'border-yellow-300 bg-yellow-50/30' : ''
                }>
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1 flex items-start gap-3">
                        {(() => {
                          const thumbUrl = getPropertyThumbnail(property);
                          return thumbUrl ? (
                            <img src={thumbUrl} alt={property.address}
                              className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setDetailProperty(property)} />
                          ) : (
                            <div className="p-3 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 w-20 h-20 flex items-center justify-center"
                              onClick={() => setDetailProperty(property)}>
                              <Camera className="w-6 h-6 text-gray-400" />
                            </div>
                          );
                        })()}

                        <div className="flex-1">
                          {/* Community Name - shown prominently above address when available */}
                          {property.community_name && (
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-bold text-base text-[#d4a574]">{property.community_name}</h3>
                              {getStatusBadge(property.property_status)}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={property.community_name ? 'text-sm text-gray-600' : 'font-semibold'}>{property.address}</h3>
                            {!property.community_name && getStatusBadge(property.property_status)}
                          </div>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{property.city}, {property.state} {property.zip_code}
                          </p>
                          {/* Community Website Link */}
                          {property.community_website && (
                            <a
                              href={property.community_website.startsWith('http') ? property.community_website : `https://${property.community_website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe className="w-3 h-3" />
                              Community Website
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              <Bed className="w-3 h-3 mr-1" />{property.bedrooms} bed
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Bath className="w-3 h-3 mr-1" />{property.bathrooms} bath
                            </Badge>
                            {property.square_footage ? (
                              <Badge variant="outline" className="text-xs">
                                <Ruler className="w-3 h-3 mr-1" />{property.square_footage.toLocaleString()} sqft
                              </Badge>
                            ) : null}
                            {(property.acquired_through_ayp || property.acquisition_source === 'ayp') ? (
                              <Badge className="bg-[#d4a574] text-xs">
                                <Shield className="w-3 h-3 mr-1" />AYP Acquired
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Off-Platform</Badge>
                            )}
                            {property.lease_agreements_received && (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <FileText className="w-3 h-3 mr-1" />Lease Received
                              </Badge>
                            )}
                            {property.credit_status === 'pending_approval' && (
                              <Badge className="bg-amber-100 text-amber-700 text-xs">
                                <CreditCard className="w-3 h-3 mr-1" />Credit Pending: ${property.credit_amount?.toLocaleString()}
                              </Badge>
                            )}
                            {property.credit_status === 'approved' && (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <CreditCard className="w-3 h-3 mr-1" />Credit: ${property.credit_amount?.toLocaleString()}
                              </Badge>
                            )}
                          </div>
                          {/* Penny Score Badge */}
                          <div className="mt-2">
                            <PennyScoreBadge 
                              score={property.penny_score} 
                              propertyId={property.id}
                              size="sm"
                              showLabel={true}
                              showTooltip={true}
                            />
                          </div>


                          {/* Staff Notes Preview for in-progress properties */}
                          {(property.property_status === 'pending' || property.property_status === 'pending_approval') && 
                           property.staff_notes && property.staff_notes.length > 0 && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-xs font-medium text-blue-800 mb-1 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />Latest Update from Team
                              </p>
                              <p className="text-sm text-blue-700">
                                {property.staff_notes[property.staff_notes.length - 1]?.text}
                              </p>
                              <p className="text-xs text-blue-500 mt-1">
                                — {property.staff_notes[property.staff_notes.length - 1]?.author}, {new Date(property.staff_notes[property.staff_notes.length - 1]?.date).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>

                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-gray-50 p-2 rounded-lg min-w-[70px]">
                            <p className="text-xs text-gray-500">Rent</p>
                            <p className="font-bold text-sm">${property.monthly_rent?.toLocaleString()}</p>
                          </div>
                          <div className="bg-green-50 p-2 rounded-lg min-w-[70px]">
                            <p className="text-xs text-gray-500">Earnings</p>
                            <p className="font-bold text-sm text-green-700">${property.monthly_earnings?.toLocaleString()}</p>
                          </div>
                          <div className="bg-blue-50 p-2 rounded-lg min-w-[70px]">
                            <p className="text-xs text-gray-500">Invested</p>
                            <p className="font-bold text-sm text-blue-700">${property.initial_investment?.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => setDetailProperty(property)} className="text-blue-600">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setPhotoManagerProperty(property)} className="text-[#d4a574]">
                            <Camera className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(property)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600" onClick={() => setDeleteConfirm(property.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {investorEmail && (
            <ClaimLegacyProperty investorId={investorId} investorEmail={investorEmail} onPropertyClaimed={fetchPortfolio} />
          )}
        </TabsContent>

        <TabsContent value="sell"><SellMyOperation investorId={investorId} investorName={investorName} /></TabsContent>
        <TabsContent value="expenses">
          <ExpenseTracker investorId={investorId} properties={properties.map(p => ({ id: p.id, address: p.address, city: p.city, state: p.state }))} />
        </TabsContent>
        <TabsContent value="performance"><PortfolioPerformanceTracker investorId={investorId} investorName={investorName} /></TabsContent>
        <TabsContent value="forecasting"><RevenueForecastChart investorId={investorId} /></TabsContent>
        <TabsContent value="integrations"><PlatformConnections investorId={investorId} /></TabsContent>
        <TabsContent value="webhooks"><WebhookEndpoints investorId={investorId} /></TabsContent>
        <TabsContent value="reports"><ReportPreferences investorId={investorId} /></TabsContent>
      </Tabs>

      {/* Add/Edit Property Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProperty ? 'Edit Property' : 'Add Property to Portfolio'}</DialogTitle>
            <DialogDescription>Track your investment performance by adding property details.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
            {/* Acquisition Source */}
            <Card className="bg-[#d4a574]/10 border-[#d4a574]/30">
              <CardContent className="pt-4 space-y-4">
                <div>
                  <Label className="font-semibold">How was this property acquired?</Label>
                  <Select value={formData.acquisition_source} onValueChange={(v: 'ayp' | 'off_platform') => setFormData({ ...formData, acquisition_source: v, acquired_through_ayp: v === 'ayp' })}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ayp">Through Access Your Place (AYP)</SelectItem>
                      <SelectItem value="off_platform">Off-Platform / Independent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.acquisition_source === 'ayp' && (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Acquisition Manager</Label>
                        <Select value={formData.acquisition_manager} onValueChange={(v) => setFormData({ ...formData, acquisition_manager: v })}>
                          <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                          <SelectContent>
                            {ACQUISITION_MANAGERS.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="acquisition-date">Acquisition Date</Label>
                        <Input id="acquisition-date" type="date" value={formData.acquisition_date} onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="acquisition-fee-paid">Acquisition Fee Paid ($)</Label>
                        <Input id="acquisition-fee-paid" type="number" min="0" value={formData.acquisition_fee} onChange={(e) => setFormData({ ...formData, acquisition_fee: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-end">
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border w-full">
                          <Switch checked={formData.lease_agreements_received} onCheckedChange={(c) => setFormData({ ...formData, lease_agreements_received: c })} />
                          <div>
                            <Label className="cursor-pointer">Lease Agreements Received?</Label>
                            <p className="text-xs text-gray-500">Toggle if you have received all lease documents</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {!formData.lease_agreements_received && formData.acquisition_fee > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">Credit Eligible</p>
                            <p className="text-xs text-amber-600">
                              Since lease agreements have not been received, your acquisition fee of <strong>${formData.acquisition_fee.toLocaleString()}</strong> will appear as a pending credit in your account. The Success Team must approve this credit. Once you receive your lease agreements, the credit will no longer apply.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Property Address */}
            <fieldset className="space-y-4">
              <legend className="font-semibold text-base">Property Address</legend>
              <Input aria-label="Street Address *" placeholder="Street Address *" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required />
              <div className="grid grid-cols-3 gap-4">
                <Input aria-label="City *" placeholder="City *" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} required />
                <Input aria-label="State *" placeholder="State *" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} required />
                <Input aria-label="ZIP" placeholder="ZIP" value={formData.zip_code} onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })} />
              </div>
            </fieldset>

            {/* Property Details */}
            <fieldset className="space-y-4">
              <legend className="font-semibold text-base">Property Details</legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Property Type</Label>
                  <Select value={formData.property_type} onValueChange={(v) => setFormData({ ...formData, property_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (<SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input id="bedrooms" type="number" min="0" value={formData.bedrooms} onChange={(e) => setFormData({ ...formData, bedrooms: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input id="bathrooms" type="number" min="0" step="0.5" value={formData.bathrooms} onChange={(e) => setFormData({ ...formData, bathrooms: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label htmlFor="sq-footage">Sq. Footage</Label>
                  <Input id="sq-footage" type="number" min="0" value={formData.square_footage || ''} onChange={(e) => setFormData({ ...formData, square_footage: parseInt(e.target.value) || 0 })} placeholder="e.g. 1500" />
                </div>
              </div>
            </fieldset>

            {/* Photos */}
            <fieldset className="space-y-2">
              <legend className="font-semibold text-base">Property Photos</legend>
              <EnhancedPhotoUploader investorId={investorId} existingPhotos={editingProperty?.photo_urls || []} onPhotosChange={handlePhotosChange} maxPhotos={10} />
            </fieldset>

            {/* Financial Details */}
            <fieldset className="space-y-4">
              <legend className="font-semibold text-base">Financial Details</legend>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="monthly-rent">Monthly Rent ($)</Label>
                  <Input id="monthly-rent" type="number" min="0" value={formData.monthly_rent} onChange={(e) => setFormData({ ...formData, monthly_rent: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label htmlFor="initial-investment">Initial Investment ($)</Label>
                  <Input id="initial-investment" type="number" min="0" value={formData.initial_investment} onChange={(e) => setFormData({ ...formData, initial_investment: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label htmlFor="monthly-earnings">Monthly Earnings ($)</Label>
                  <Input id="monthly-earnings" type="number" min="0" value={formData.monthly_earnings} onChange={(e) => setFormData({ ...formData, monthly_earnings: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </fieldset>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} placeholder="Add any additional notes..." />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingProperty ? 'Update' : 'Add'} Property
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Property Detail Modal */}
      <Dialog open={!!detailProperty} onOpenChange={(open) => !open && setDetailProperty(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailProperty && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#d4a574]" />
                  {detailProperty.community_name || detailProperty.address}
                </DialogTitle>
                <DialogDescription className="space-y-1">
                  {detailProperty.community_name && (
                    <span className="block text-sm text-gray-600">{detailProperty.address}</span>
                  )}
                  <span className="block">{detailProperty.city}, {detailProperty.state} {detailProperty.zip_code}</span>
                  {detailProperty.community_website && (
                    <a
                      href={detailProperty.community_website.startsWith('http') ? detailProperty.community_website : `https://${detailProperty.community_website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Visit Community Website
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </DialogDescription>
              </DialogHeader>


              <div className="space-y-6">
                {/* Status & Source */}
                <div className="flex flex-wrap gap-2 items-center">
                  {getStatusBadge(detailProperty.property_status)}
                  {(detailProperty.acquired_through_ayp || detailProperty.acquisition_source === 'ayp') ? (
                    <Badge className="bg-[#d4a574]">AYP Acquired</Badge>
                  ) : (
                    <Badge variant="outline">Off-Platform</Badge>
                  )}
                  {detailProperty.lease_agreements_received && <Badge className="bg-green-500">Lease Received</Badge>}
                  {detailProperty.credit_status !== 'none' && detailProperty.credit_status && (
                    <Badge className={detailProperty.credit_status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}>
                      Credit: ${detailProperty.credit_amount?.toLocaleString()} ({detailProperty.credit_status})
                    </Badge>
                  )}
                  <PennyScoreBadge 
                    score={detailProperty.penny_score} 
                    propertyId={detailProperty.id}
                    size="md"
                    showLabel={true}
                    showTooltip={true}
                  />
                </div>


                {/* Photo Gallery with Lightbox */}
                {detailProperty.photo_urls?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-600 flex items-center gap-1">
                        <Camera className="w-4 h-4" />
                        {detailProperty.photo_urls.length} Photo{detailProperty.photo_urls.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-gray-400">Click any photo to view full size</p>
                    </div>
                    
                    {/* Hero photo */}
                    {(detailResolvedPhotos.length > 0 || detailProperty.photo_urls.length > 0) && (
                      <div 
                        className="relative w-full h-64 rounded-lg overflow-hidden cursor-pointer group"
                        onClick={() => setLightboxState({
                          photos: detailResolvedPhotos.length > 0 ? detailResolvedPhotos : detailProperty.photo_urls,
                          index: 0,
                          address: `${detailProperty.address}, ${detailProperty.city}, ${detailProperty.state}`
                        })}
                      >
                        <img 
                          src={detailResolvedPhotos[0] || detailProperty.photo_urls[0]} 
                          alt={detailProperty.address}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-3">
                            <Eye className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        {detailResolvedPhotos.length === 0 && detailProperty.photo_urls.length > 0 && (
                          <div className="absolute bottom-2 right-2 bg-black/50 rounded-full px-2 py-1 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 text-white animate-spin" />
                            <span className="text-white text-xs">Loading...</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Thumbnail strip */}
                    {detailProperty.photo_urls.length > 1 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {(detailResolvedPhotos.length > 0 ? detailResolvedPhotos : detailProperty.photo_urls).slice(1, 7).map((url, i) => (
                          <div
                            key={i}
                            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group border-2 border-transparent hover:border-[#d4a574] transition-colors"
                            onClick={() => setLightboxState({
                              photos: detailResolvedPhotos.length > 0 ? detailResolvedPhotos : detailProperty.photo_urls,
                              index: i + 1,
                              address: `${detailProperty.address}, ${detailProperty.city}, ${detailProperty.state}`
                            })}
                          >
                            <img src={url} alt={`Photo ${i + 2}`} className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          </div>
                        ))}
                        {detailProperty.photo_urls.length > 7 && (
                          <div
                            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                            onClick={() => setLightboxState({
                              photos: detailResolvedPhotos.length > 0 ? detailResolvedPhotos : detailProperty.photo_urls,
                              index: 7,
                              address: `${detailProperty.address}, ${detailProperty.city}, ${detailProperty.state}`
                            })}
                          >
                            <span className="text-gray-600 font-bold text-lg">+{detailProperty.photo_urls.length - 7}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}


                {/* Property Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Bedrooms</p>
                    <p className="font-bold">{detailProperty.bedrooms}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Bathrooms</p>
                    <p className="font-bold">{detailProperty.bathrooms}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Sq. Footage</p>
                    <p className="font-bold">{detailProperty.square_footage?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Property Type</p>
                    <p className="font-bold capitalize">{detailProperty.property_type?.replace(/_/g, ' ')}</p>
                  </div>
                </div>

                {/* Financial Details */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Monthly Rent</p>
                        <p className="text-lg font-bold">${detailProperty.monthly_rent?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Monthly Earnings</p>
                        <p className="text-lg font-bold text-green-600">${detailProperty.monthly_earnings?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Initial Investment</p>
                        <p className="text-lg font-bold text-blue-600">${detailProperty.initial_investment?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Acquisition Fee</p>
                        <p className="text-lg font-bold">${detailProperty.acquisition_fee?.toLocaleString() || '0'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Property Documents */}
                {detailProperty.property_documents && detailProperty.property_documents.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" />Documents</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {detailProperty.property_documents.map((doc, i) => (
                          <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium">{doc.name}</p>
                                <p className="text-xs text-gray-500">{doc.type} - {new Date(doc.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                            {doc.url && (
                              <Button variant="ghost" size="sm" onClick={() => window.open(doc.url, '_blank')}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Staff Notes / Updates */}
                {detailProperty.staff_notes && detailProperty.staff_notes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />Team Updates
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[...detailProperty.staff_notes].reverse().map((note, i) => (
                          <div key={i} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-sm text-gray-800">{note.text}</p>
                            <p className="text-xs text-gray-500 mt-1">— {note.author}, {new Date(note.date).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Investor Notes */}
                {detailProperty.notes && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Your Notes</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailProperty.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailProperty(null)}>Close</Button>
                <Button onClick={() => { setDetailProperty(null); handleEdit(detailProperty); }} className="bg-[#d4a574] hover:bg-[#c49464]">
                  <Edit2 className="w-4 h-4 mr-2" />Edit Property
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete Property</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Manager Modal */}
      <Dialog open={!!photoManagerProperty} onOpenChange={(open) => !open && setPhotoManagerProperty(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {photoManagerProperty && (
            <PortfolioPhotoManager
              investorId={investorId}
              propertyId={photoManagerProperty.id}
              existingPhotos={photoManagerProperty.photo_urls || []}
              primaryPhotoIndex={0}
              onPhotosChange={async (filePaths) => {
                try {
                  // filePaths are now storage paths, not full URLs
                  const { data } = await supabase.functions.invoke('investor-auth', {
                    body: { 
                      action: 'update_portfolio_property', 
                      investor_id: investorId, 
                      property_id: photoManagerProperty.id, 
                      property_data: { photo_urls: filePaths } 
                    }
                  });
                  if (data?.success) {
                    // Clear cache for this property so new URLs are resolved
                    clearPhotoUrlCache();
                    toast({ title: 'Photos Saved' });
                    fetchPortfolio();
                    setPhotoManagerProperty(null);
                  } else {
                    // Was a direct table write, which anon can no longer do. Routed
                    // through the ownership-checked handler instead.
                    const { data: pu } = await supabase.functions.invoke('investor-auth', {
                      body: { action: 'update_portfolio_property', investor_id: investorId,
                              property_id: photoManagerProperty.id,
                              property_data: { photo_urls: filePaths } },
                    });
                    if (!pu?.success) throw new Error(pu?.error || 'Could not save the photos.');
                    clearPhotoUrlCache();
                    toast({ title: 'Photos Saved' });
                    fetchPortfolio();
                    setPhotoManagerProperty(null);
                  }
                } catch (err: any) {
                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                }
              }}
              onClose={() => setPhotoManagerProperty(null)}
              maxPhotos={20}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Lightbox */}
      {lightboxState && (
        <PhotoLightbox
          photos={lightboxState.photos}
          initialIndex={lightboxState.index}
          onClose={() => setLightboxState(null)}
          propertyAddress={lightboxState.address}
        />
      )}
    </div>
  );
}
