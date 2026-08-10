import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ActiveNegotiationsTab } from '@/components/admin/ActiveNegotiationsTab';
import { 
  Loader2, Building2, MapPin, DollarSign, Phone, Mail, User, 
  CheckCircle, XCircle, Clock, AlertCircle, Shield, FileText,
  Eye, ChevronRight, Calendar, AlertTriangle, RefreshCw, Edit,
  Download, Image, FileSpreadsheet, Video, Package, Paperclip, ExternalLink, Gavel,
  ClipboardCheck, ShieldCheck
} from 'lucide-react';

interface VerificationAlert {
  id: string;
  listing_id: string;
  investor_id: string;
  investor_email: string;
  investor_name: string;
  property_address: string;
  listing_type: 'public_sale' | 'private_sale';
  asking_price: number;
  priority: 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_review' | 'approved' | 'needs_changes' | 'rejected';
  verification_notes?: string;
  changes_requested?: string;
  reviewed_by_staff_id?: string;
  reviewed_at?: string;
  created_at: string;
  listing?: any;
  // v10 checklist fields
  checklist_lease_verified?: boolean;
  checklist_landlord_called?: boolean;
  checklist_financials_reviewed?: boolean;
  checklist_photos_verified?: boolean;
}

interface Verification {
  id: string;
  listing_id: string;
  requested_by: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  assigned_to?: string;
  seller_call_completed: boolean;
  seller_call_notes?: string;
  seller_verified_operator?: boolean;
  landlord_contacted: boolean;
  landlord_name?: string;
  landlord_phone?: string;
  landlord_email?: string;
  landlord_verified?: boolean;
  landlord_notes?: string;
  property_meets_standards?: boolean;
  property_notes?: string;
  operation_type?: string;
  report_summary?: string;
  created_at: string;
  listing?: {
    asking_price: number;
    monthly_revenue: number;
    listing_type: string;
    property?: { address: string; city: string; state: string; };
    seller?: { full_name: string; email: string; phone?: string; };
  };
}

interface PublicListing {
  id: string;
  property_id: string;
  seller_id: string;
  asking_price: number;
  monthly_revenue: number;
  description: string;
  status: string;
  created_at: string;
  inventory_list?: string;
  video_walkthrough_url?: string;
  proof_of_lease_urls?: string[];
  financial_data_urls?: string[];
  property_photo_urls?: string[];
  operation_type?: string;
  adr?: number;
  occupancy_rate?: number;
  monthly_rent?: number;
  lease_months_remaining?: number;
  is_furnished?: boolean;
  resubmit_count?: number;
  changes_requested?: string;
  property?: { address: string; city: string; state: string; bedrooms: number; bathrooms: number; };
  seller?: { full_name: string; email: string; };
}

interface DocumentFile {
  path: string;
  signed_url: string | null;
  file_name: string;
  is_image: boolean;
}

interface ListingDocuments {
  lease: DocumentFile[];
  financial: DocumentFile[];
  photos: DocumentFile[];
  inventory_list?: string;
  video_walkthrough_url?: string;
}

interface VerificationChecklist {
  lease_verified: boolean;
  landlord_called: boolean;
  financials_reviewed: boolean;
  photos_verified: boolean;
}

export function MarketplaceVerificationsTab() {
  const [activeTab, setActiveTab] = useState('verification-queue');
  const [verificationAlerts, setVerificationAlerts] = useState<VerificationAlert[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [publicListings, setPublicListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [selectedListing, setSelectedListing] = useState<PublicListing | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<VerificationAlert | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showListingModal, setShowListingModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [changesRequested, setChangesRequested] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [changesTargetListingId, setChangesTargetListingId] = useState<string | null>(null);
  const [listingDocs, setListingDocs] = useState<ListingDocuments | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // v10: Verification checklist state
  const [checklist, setChecklist] = useState<VerificationChecklist>({
    lease_verified: false, landlord_called: false, financials_reviewed: false, photos_verified: false
  });

  const [verificationForm, setVerificationForm] = useState({
    seller_call_completed: false, seller_call_notes: '', seller_verified_operator: false,
    landlord_contacted: false, landlord_name: '', landlord_phone: '', landlord_email: '',
    landlord_verified: false, landlord_notes: '', property_meets_standards: false,
    property_notes: '', operation_type: '', license_requirements: '', report_summary: ''
  });

  const { toast } = useToast();

  const allChecklistComplete = checklist.lease_verified && checklist.landlord_called && checklist.financials_reviewed && checklist.photos_verified;
  const checklistCount = [checklist.lease_verified, checklist.landlord_called, checklist.financials_reviewed, checklist.photos_verified].filter(Boolean).length;

  useEffect(() => { fetchData(); }, [statusFilter, priorityFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alertsRes, verificationsRes, listingsRes] = await Promise.allSettled([
        supabase.functions.invoke('manage-deal-marketplace', {
          body: { action: 'get_verification_queue', status_filter: statusFilter, priority_filter: priorityFilter }
        }),
        supabase.functions.invoke('manage-deal-marketplace', {
          body: { action: 'get_pending_verifications' }
        }),
        supabase.functions.invoke('manage-deal-marketplace', {
          body: { action: 'get_pending_listings' }
        })
      ]);

      if (alertsRes.status === 'fulfilled' && alertsRes.value.data?.alerts) {
        setVerificationAlerts(alertsRes.value.data.alerts);
      } else {
        // DB fallback for alerts
        try {
          let query = supabase.from('marketplace_verification_alerts').select('*').order('created_at', { ascending: false });
          if (statusFilter !== 'all') query = query.eq('status', statusFilter);
          if (priorityFilter !== 'all') query = query.eq('priority', priorityFilter);
          const { data } = await query;
          setVerificationAlerts(data || []);
        } catch { setVerificationAlerts([]); }
      }

      if (verificationsRes.status === 'fulfilled' && verificationsRes.value.data?.verifications) {
        setVerifications(verificationsRes.value.data.verifications);
      } else {
        try {
          const { data } = await supabase.from('deal_verifications').select('*').in('status', ['pending', 'in_progress']).order('created_at', { ascending: false });
          setVerifications(data || []);
        } catch { setVerifications([]); }
      }

      if (listingsRes.status === 'fulfilled' && listingsRes.value.data?.listings) {
        setPublicListings(listingsRes.value.data.listings);
      } else {
        try {
          const { data } = await supabase.from('deal_listings')
            .select('*, seller:investors!seller_id(full_name, email)')
            .eq('status', 'pending_approval').eq('listing_type', 'public')
            .order('created_at', { ascending: false });
          setPublicListings(data || []);
        } catch { setPublicListings([]); }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  const fetchListingDocuments = async (listingId: string) => {
    setLoadingDocs(true);
    setListingDocs(null);
    try {
      const { data } = await supabase.functions.invoke('seller-document-upload', {
        body: { action: 'get_listing_documents', listing_id: listingId }
      });
      if (data?.success) {
        setListingDocs({
          lease: data.documents?.lease || [], financial: data.documents?.financial || [],
          photos: data.documents?.photos || [], inventory_list: data.inventory_list,
          video_walkthrough_url: data.video_walkthrough_url
        });
      } else {
        // DB fallback: try seller_listing_documents table
        try {
          const { data: docs } = await supabase.from('seller_listing_documents')
            .select('*').eq('listing_id', listingId).order('created_at', { ascending: false });
          if (docs && docs.length > 0) {
            const lease: DocumentFile[] = []; const financial: DocumentFile[] = []; const photos: DocumentFile[] = [];
            for (const doc of docs) {
              const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_path || '');
              const fileName = (doc.file_path || '').split('/').pop() || 'file';
              let signedUrl: string | null = null;
              try {
                const bucket = doc.bucket_name || 'seller-documents';
                const { data: urlData } = await supabase.storage.from(bucket).createSignedUrl(doc.file_path, 3600);
                signedUrl = urlData?.signedUrl || null;
              } catch {}
              const fileObj: DocumentFile = { path: doc.file_path, signed_url: signedUrl, file_name: fileName, is_image: isImg };
              if (doc.category === 'lease') lease.push(fileObj);
              else if (doc.category === 'financial') financial.push(fileObj);
              else if (doc.category === 'photos') photos.push(fileObj);
            }
            setListingDocs({ lease, financial, photos });
          }
        } catch {}
      }
    } catch (err) {
      console.error('Error fetching listing documents:', err);
    }
    setLoadingDocs(false);
  };

  // Reset checklist when opening a new alert/listing, pre-fill from saved data
  const resetChecklist = (alert?: VerificationAlert | null) => {
    setChecklist({
      lease_verified: alert?.checklist_lease_verified || false,
      landlord_called: alert?.checklist_landlord_called || false,
      financials_reviewed: alert?.checklist_financials_reviewed || false,
      photos_verified: alert?.checklist_photos_verified || false,
    });
  };

  const handleSaveChecklist = async (listingId: string) => {
    try {
      const staffSession = JSON.parse(localStorage.getItem('staffSession') || '{}');
      await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'save_verification_checklist', listing_id: listingId, staff_id: staffSession.id, checklist }
      });
      toast({ title: 'Checklist Saved', description: 'Verification progress has been saved.' });
    } catch {
      // DB fallback
      try {
        await supabase.from('marketplace_verification_alerts').update({
          checklist_lease_verified: checklist.lease_verified,
          checklist_landlord_called: checklist.landlord_called,
          checklist_financials_reviewed: checklist.financials_reviewed,
          checklist_photos_verified: checklist.photos_verified,
        }).eq('listing_id', listingId);
        toast({ title: 'Checklist Saved' });
      } catch { toast({ title: 'Error', description: 'Failed to save checklist', variant: 'destructive' }); }
    }
  };

  const handleStartVerification = (verification: Verification) => {
    setSelectedVerification(verification);
    setVerificationForm({
      seller_call_completed: verification.seller_call_completed || false,
      seller_call_notes: verification.seller_call_notes || '', seller_verified_operator: verification.seller_verified_operator || false,
      landlord_contacted: verification.landlord_contacted || false, landlord_name: verification.landlord_name || '',
      landlord_phone: verification.landlord_phone || '', landlord_email: verification.landlord_email || '',
      landlord_verified: verification.landlord_verified || false, landlord_notes: verification.landlord_notes || '',
      property_meets_standards: verification.property_meets_standards || false, property_notes: verification.property_notes || '',
      operation_type: verification.operation_type || '', license_requirements: '', report_summary: verification.report_summary || ''
    });
    setShowVerificationModal(true);
  };

  const handleCompleteVerification = async (passed: boolean) => {
    if (!selectedVerification) return;
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'complete_verification', listing_id: selectedVerification.listing_id, passed, verification_notes: verificationForm.report_summary }
      });
      if (data?.success) {
        toast({ title: passed ? 'Verification Passed' : 'Verification Failed' });
        fetchData(); setShowVerificationModal(false);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to complete verification', variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleApproveListing = async (listingId: string) => {
    if (!allChecklistComplete) {
      toast({ title: 'Checklist Incomplete', description: 'All 4 verification checklist items must be completed before approving a listing.', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const staffSession = JSON.parse(localStorage.getItem('staffSession') || '{}');
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'approve_listing', listing_id: listingId, staff_id: staffSession.id, checklist }
      });
      if (data?.success) {
        toast({ title: 'Listing Approved', description: 'The listing is now live on the marketplace.' });
        fetchData(); setShowListingModal(false); setShowAlertModal(false);
      } else {
        throw new Error(data?.error || 'Failed');
      }
    } catch (err: any) {
      // DB fallback
      try {
        const staffSession = JSON.parse(localStorage.getItem('staffSession') || '{}');
        await supabase.from('deal_listings').update({
          status: 'active', approved_at: new Date().toISOString(), changes_requested: null,
          verification_lease_verified: checklist.lease_verified, verification_landlord_called: checklist.landlord_called,
          verification_financials_reviewed: checklist.financials_reviewed, verification_photos_verified: checklist.photos_verified,
          verification_completed_by: staffSession.id, verification_completed_at: new Date().toISOString()
        }).eq('id', listingId);
        await supabase.from('marketplace_verification_alerts').update({
          status: 'approved', reviewed_by_staff_id: staffSession.id, reviewed_at: new Date().toISOString(),
          checklist_lease_verified: checklist.lease_verified, checklist_landlord_called: checklist.landlord_called,
          checklist_financials_reviewed: checklist.financials_reviewed, checklist_photos_verified: checklist.photos_verified,
        }).eq('listing_id', listingId);
        toast({ title: 'Listing Approved (DB fallback)' });
        fetchData(); setShowListingModal(false); setShowAlertModal(false);
      } catch {
        toast({ title: 'Error', description: 'Failed to approve listing', variant: 'destructive' });
      }
    }
    setProcessing(false);
  };

  const handleRejectListing = async (listingId: string) => {
    if (!rejectionReason.trim()) { toast({ title: 'Error', description: 'Please provide a rejection reason', variant: 'destructive' }); return; }
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'reject_listing', listing_id: listingId, rejection_reason: rejectionReason }
      });
      if (data?.success) {
        toast({ title: 'Listing Rejected' }); fetchData(); setShowListingModal(false); setShowAlertModal(false); setRejectionReason('');
      }
    } catch {
      try {
        await supabase.from('deal_listings').update({ status: 'rejected', rejection_reason: rejectionReason, rejected_at: new Date().toISOString() }).eq('id', listingId);
        toast({ title: 'Listing Rejected (DB fallback)' }); fetchData(); setShowListingModal(false); setShowAlertModal(false); setRejectionReason('');
      } catch { toast({ title: 'Error', variant: 'destructive' }); }
    }
    setProcessing(false);
  };

  const handleRequestChanges = async (listingId: string) => {
    if (!changesRequested.trim()) { toast({ title: 'Error', description: 'Please describe the changes needed', variant: 'destructive' }); return; }
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'request_listing_changes', listing_id: listingId, changes_requested: changesRequested }
      });
      if (data?.success) {
        toast({ title: 'Changes Requested' }); fetchData(); setShowChangesModal(false); setShowAlertModal(false); setChangesRequested('');
      }
    } catch {
      try {
        await supabase.from('deal_listings').update({ status: 'needs_changes', changes_requested: changesRequested }).eq('id', listingId);
        toast({ title: 'Changes Requested (DB fallback)' }); fetchData(); setShowChangesModal(false); setShowAlertModal(false); setChangesRequested('');
      } catch { toast({ title: 'Error', variant: 'destructive' }); }
    }
    setProcessing(false);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return <Badge className="bg-red-600 text-white animate-pulse">URGENT</Badge>;
      case 'high': return <Badge className="bg-orange-500 text-white">HIGH PRIORITY</Badge>;
      default: return <Badge className="bg-blue-100 text-blue-700">Normal</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      case 'needs_changes': return <Badge className="bg-yellow-100 text-yellow-700">Needs Changes</Badge>;
      case 'in_review': return <Badge className="bg-blue-100 text-blue-700">In Review</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700">Pending</Badge>;
    }
  };

  // Verification Checklist Component
  const VerificationChecklistUI = ({ listingId, compact = false }: { listingId: string; compact?: boolean }) => (
    <Card className={`${allChecklistComplete ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
      <CardContent className={compact ? 'pt-3 pb-3' : 'pt-4'}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <ClipboardCheck className={`w-4 h-4 ${allChecklistComplete ? 'text-green-600' : 'text-amber-600'}`} />
            Verification Checklist ({checklistCount}/4)
          </h4>
          {!compact && (
            <Button variant="outline" size="sm" onClick={() => handleSaveChecklist(listingId)} className="h-7 text-xs">
              Save Progress
            </Button>
          )}
        </div>
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
          {[
            { key: 'lease_verified' as const, label: 'Lease Verified', desc: 'Proof of lease document reviewed and confirmed valid', icon: FileText },
            { key: 'landlord_called' as const, label: 'Landlord Called', desc: 'Landlord contacted and confirmed lease transfer approval', icon: Phone },
            { key: 'financials_reviewed' as const, label: 'Financials Reviewed', desc: 'Revenue, expenses, and financial documents verified', icon: DollarSign },
            { key: 'photos_verified' as const, label: 'Photos Verified', desc: 'Property photos match listing description and are current', icon: Image },
          ].map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${checklist[key] ? 'bg-green-100 border-green-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}
              onClick={() => setChecklist(prev => ({ ...prev, [key]: !prev[key] }))}>
              <Checkbox checked={checklist[key]} onCheckedChange={(c) => setChecklist(prev => ({ ...prev, [key]: c as boolean }))} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${checklist[key] ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${checklist[key] ? 'text-green-800' : 'text-gray-700'}`}>{label}</span>
                </div>
                {!compact && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
              </div>
              {checklist[key] && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />}
            </div>
          ))}
        </div>
        {!allChecklistComplete && (
          <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            All 4 items must be verified before you can approve this listing.
          </p>
        )}
        {allChecklistComplete && (
          <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            All verification checks passed. You may now approve this listing.
          </p>
        )}
      </CardContent>
    </Card>
  );

  // Document Viewer Component
  const DocumentViewer = ({ docs, title }: { docs: ListingDocuments | null; title?: string }) => {
    if (!docs) return null;
    const totalDocs = docs.lease.length + docs.financial.length + docs.photos.length;
    return (
      <div className="space-y-4">
        {title && <h4 className="font-semibold text-sm flex items-center gap-2"><Paperclip className="w-4 h-4" /> {title}</h4>}
        {totalDocs === 0 && !docs.inventory_list && !docs.video_walkthrough_url ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <Paperclip className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No documents uploaded by the seller.</p>
          </div>
        ) : (
          <>
            {docs.lease.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-red-500" /> Proof of Lease ({docs.lease.length})
                </p>
                <div className="space-y-1.5">
                  {docs.lease.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 border rounded-lg hover:bg-gray-50 transition-colors group">
                      {doc.is_image && doc.signed_url ? (
                        <img src={doc.signed_url} alt={doc.file_name} className="w-10 h-10 object-cover rounded cursor-pointer border"
                          onClick={() => setPreviewImage(doc.signed_url)} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-10 h-10 bg-red-50 rounded flex items-center justify-center"><FileText className="w-5 h-5 text-red-500" /></div>
                      )}
                      <span className="text-sm flex-1 truncate">{doc.file_name}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {doc.is_image && doc.signed_url && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewImage(doc.signed_url)}><Eye className="w-3.5 h-3.5" /></Button>}
                        {doc.signed_url && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => window.open(doc.signed_url!, '_blank')}><Download className="w-3.5 h-3.5" /></Button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {docs.financial.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-green-500" /> Financial Documents ({docs.financial.length})
                </p>
                <div className="space-y-1.5">
                  {docs.financial.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 border rounded-lg hover:bg-gray-50 transition-colors group">
                      {doc.is_image && doc.signed_url ? (
                        <img src={doc.signed_url} alt={doc.file_name} className="w-10 h-10 object-cover rounded cursor-pointer border"
                          onClick={() => setPreviewImage(doc.signed_url)} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-10 h-10 bg-green-50 rounded flex items-center justify-center"><FileSpreadsheet className="w-5 h-5 text-green-500" /></div>
                      )}
                      <span className="text-sm flex-1 truncate">{doc.file_name}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {doc.is_image && doc.signed_url && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewImage(doc.signed_url)}><Eye className="w-3.5 h-3.5" /></Button>}
                        {doc.signed_url && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => window.open(doc.signed_url!, '_blank')}><Download className="w-3.5 h-3.5" /></Button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {docs.photos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Image className="w-3.5 h-3.5 text-blue-500" /> Property Photos ({docs.photos.length})
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {docs.photos.map((doc, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:border-[#d4a574] transition-colors relative group"
                      onClick={() => doc.signed_url && setPreviewImage(doc.signed_url)}>
                      {doc.signed_url ? (
                        <img src={doc.signed_url} alt={doc.file_name} className="w-full h-full object-cover"
                          onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = 'none'; }} />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center"><Image className="w-6 h-6 text-gray-300" /></div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {docs.inventory_list && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Inventory List</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">{docs.inventory_list}</div>
              </div>
            )}
            {docs.video_walkthrough_url && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Video Walkthrough</p>
                <a href={docs.video_walkthrough_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 border rounded-lg hover:bg-blue-50 transition-colors text-blue-600">
                  <Video className="w-5 h-5" /><span className="text-sm flex-1 truncate">{docs.video_walkthrough_url}</span><ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>;

  const pendingAlerts = verificationAlerts.filter(a => a.status === 'pending' || a.status === 'in_review');
  const highPriorityAlerts = pendingAlerts.filter(a => a.priority === 'high' || a.priority === 'urgent');
  const pendingVerifications = verifications.filter(v => v.status === 'pending' || v.status === 'in_progress');
  const completedVerifications = verifications.filter(v => v.status === 'passed' || v.status === 'failed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deal Marketplace Management</h2>
          <p className="text-gray-600">Verify deals, review documents, and approve public listings</p>
        </div>
        <div className="flex gap-4">
          {highPriorityAlerts.length > 0 && (
            <Card className="px-4 py-2 border-red-500 bg-red-50">
              <div className="text-center"><p className="text-2xl font-bold text-red-600">{highPriorityAlerts.length}</p><p className="text-xs text-red-600 font-medium">High Priority</p></div>
            </Card>
          )}
          <Card className="px-4 py-2"><div className="text-center"><p className="text-2xl font-bold text-orange-600">{pendingAlerts.length}</p><p className="text-xs text-gray-500">Pending Queue</p></div></Card>
          <Card className="px-4 py-2"><div className="text-center"><p className="text-2xl font-bold text-blue-600">{publicListings.length}</p><p className="text-xs text-gray-500">Pending Approvals</p></div></Card>
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      {highPriorityAlerts.length > 0 && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-800">{highPriorityAlerts.length} High Priority Verification{highPriorityAlerts.length > 1 ? 's' : ''} Pending</h3>
                <p className="text-sm text-red-600">Private sale verification requests require immediate attention.</p>
              </div>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => { setSelectedAlert(highPriorityAlerts[0]); resetChecklist(highPriorityAlerts[0]); setShowAlertModal(true); fetchListingDocuments(highPriorityAlerts[0].listing_id); }}>Review Now</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="verification-queue">Verification Queue ({pendingAlerts.length})</TabsTrigger>
          <TabsTrigger value="pending-verifications">Private Sale Verifications ({pendingVerifications.length})</TabsTrigger>
          <TabsTrigger value="public-approvals">Public Listing Approvals ({publicListings.length})</TabsTrigger>
          <TabsTrigger value="active-negotiations" className="gap-1.5"><Gavel className="w-3.5 h-3.5" />Active Negotiations</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedVerifications.length})</TabsTrigger>
        </TabsList>

        {/* Verification Queue */}
        <TabsContent value="verification-queue" className="space-y-4">
          <div className="flex gap-4">
            <div className="w-48">
              <Label className="text-xs text-gray-500">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="needs_changes">Needs Changes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs text-gray-500">Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {pendingAlerts.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600">No Pending Verifications</h3>
              <p className="text-gray-500">All verification requests have been processed.</p>
            </CardContent></Card>
          ) : (
            pendingAlerts.map((alert) => (
              <Card key={alert.id} className={`border-l-4 ${alert.priority === 'urgent' ? 'border-l-red-600 bg-red-50' : alert.priority === 'high' ? 'border-l-orange-500 bg-orange-50' : 'border-l-blue-500'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getPriorityBadge(alert.priority)}
                        {getStatusBadge(alert.status)}
                        <Badge variant="outline">{alert.listing_type === 'private_sale' ? 'Private Sale' : 'Public Listing'}</Badge>
                      </div>
                      <h3 className="font-semibold text-lg">{alert.property_address}</h3>
                      <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div><p className="text-sm text-gray-500">Investor</p><p className="font-medium">{alert.investor_name}</p><p className="text-sm text-gray-500">{alert.investor_email}</p></div>
                        <div><p className="text-sm text-gray-500">Asking Price</p><p className="text-xl font-bold text-[#1a365d]">${alert.asking_price?.toLocaleString()}</p></div>
                      </div>
                      <p className="text-xs text-gray-400 mt-3">Submitted {new Date(alert.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button onClick={() => { setSelectedAlert(alert); resetChecklist(alert); setShowAlertModal(true); fetchListingDocuments(alert.listing_id); }}
                      className={alert.priority === 'urgent' || alert.priority === 'high' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#d4a574] hover:bg-[#c49464]'}>
                      Review <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Private Sale Verifications */}
        <TabsContent value="pending-verifications" className="space-y-4">
          {pendingVerifications.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Shield className="w-12 h-12 mx-auto text-gray-300 mb-4" /><h3 className="text-lg font-medium text-gray-600">No Pending Verifications</h3></CardContent></Card>
          ) : pendingVerifications.map((v) => (
            <Card key={v.id} className="border-l-4 border-l-orange-500">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Badge className={v.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>{v.status === 'in_progress' ? 'In Progress' : 'Pending'}</Badge>
                    <h3 className="font-semibold text-lg mt-2">{v.listing?.property?.address || 'Property'}</h3>
                    <p className="text-gray-500">{v.listing?.property?.city}, {v.listing?.property?.state}</p>
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div><p className="text-sm text-gray-500">Seller</p><p className="font-medium">{v.listing?.seller?.full_name}</p></div>
                      <div><p className="text-sm text-gray-500">Asking Price</p><p className="text-xl font-bold text-[#1a365d]">${v.listing?.asking_price?.toLocaleString()}</p></div>
                    </div>
                  </div>
                  <Button onClick={() => handleStartVerification(v)} className="bg-[#d4a574] hover:bg-[#c49464]">
                    {v.status === 'in_progress' ? 'Continue' : 'Start'} Verification <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Public Listing Approvals */}
        <TabsContent value="public-approvals" className="space-y-4">
          {publicListings.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" /><h3 className="text-lg font-medium text-gray-600">No Pending Approvals</h3></CardContent></Card>
          ) : publicListings.map((listing) => {
            const docCount = (listing.proof_of_lease_urls?.length || 0) + (listing.financial_data_urls?.length || 0) + (listing.property_photo_urls?.length || 0);
            return (
              <Card key={listing.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-100 text-blue-700">Public Listing</Badge>
                        {docCount > 0 && <Badge variant="outline" className="gap-1"><Paperclip className="w-3 h-3" /> {docCount} docs</Badge>}
                        {listing.video_walkthrough_url && <Badge variant="outline" className="gap-1"><Video className="w-3 h-3" /> Video</Badge>}
                      </div>
                      <h3 className="font-semibold text-lg">{listing.property?.address}</h3>
                      <p className="text-gray-500">{listing.property?.city}, {listing.property?.state}</p>
                      <p className="text-sm text-gray-500 mt-2">Seller: {listing.seller?.full_name} ({listing.seller?.email})</p>
                      <div className="flex gap-4 mt-3">
                        <span className="text-lg font-bold">${listing.asking_price.toLocaleString()}</span>
                        <span className="text-green-600">${listing.monthly_revenue?.toLocaleString() || 0}/mo</span>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => { setSelectedListing(listing); resetChecklist(null); setShowListingModal(true); fetchListingDocuments(listing.id); }}>
                      <Eye className="w-4 h-4 mr-2" /> Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Completed */}
        <TabsContent value="completed" className="space-y-4">
          {completedVerifications.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" /><h3 className="text-lg font-medium text-gray-600">No Completed Verifications</h3></CardContent></Card>
          ) : completedVerifications.map((v) => (
            <Card key={v.id} className={`border-l-4 ${v.status === 'passed' ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge className={v.status === 'passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{v.status === 'passed' ? 'Verified' : 'Failed'}</Badge>
                    <h3 className="font-semibold mt-2">{v.listing?.property?.address}</h3>
                    <p className="text-sm text-gray-500">${v.listing?.asking_price?.toLocaleString()}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleStartVerification(v)}>View Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="active-negotiations"><ActiveNegotiationsTab /></TabsContent>
      </Tabs>

      {/* Alert Review Modal - Enhanced with Checklist */}
      <Dialog open={showAlertModal} onOpenChange={(open) => { setShowAlertModal(open); if (!open) { setListingDocs(null); setRejectionReason(''); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAlert?.priority === 'high' || selectedAlert?.priority === 'urgent' ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <Shield className="w-5 h-5 text-blue-600" />}
              Review Verification Request
            </DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <Tabs defaultValue="overview">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="documents" className="flex-1">Documents {loadingDocs && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}</TabsTrigger>
                <TabsTrigger value="checklist" className="flex-1">Checklist ({checklistCount}/4)</TabsTrigger>
                <TabsTrigger value="actions" className="flex-1">Actions</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="flex items-center gap-2">{getPriorityBadge(selectedAlert.priority)}<Badge variant="outline">{selectedAlert.listing_type === 'private_sale' ? 'Private Sale' : 'Public Listing'}</Badge></div>
                <Card><CardContent className="pt-4">
                  <h3 className="font-semibold text-lg">{selectedAlert.property_address}</h3>
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div><p className="text-sm text-gray-500">Investor</p><p className="font-medium">{selectedAlert.investor_name}</p><p className="text-sm text-gray-500">{selectedAlert.investor_email}</p></div>
                    <div><p className="text-sm text-gray-500">Asking Price</p><p className="text-xl font-bold">${selectedAlert.asking_price?.toLocaleString()}</p>
                      <div className="flex gap-3 mt-1 text-xs"><span className="text-blue-600">AYP (20%): ${Math.round(selectedAlert.asking_price * 0.2).toLocaleString()}</span><span className="text-green-600">Seller (80%): ${Math.round(selectedAlert.asking_price * 0.8).toLocaleString()}</span></div>
                    </div>
                  </div>
                </CardContent></Card>
                <p className="text-xs text-gray-400">Submitted {new Date(selectedAlert.created_at).toLocaleDateString()}</p>
              </TabsContent>
              <TabsContent value="documents" className="mt-4">
                {loadingDocs ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" /></div> : <DocumentViewer docs={listingDocs} title="Seller Uploaded Documents" />}
              </TabsContent>
              <TabsContent value="checklist" className="mt-4">
                <VerificationChecklistUI listingId={selectedAlert.listing_id} />
              </TabsContent>
              <TabsContent value="actions" className="space-y-4 mt-4">
                <VerificationChecklistUI listingId={selectedAlert.listing_id} compact />
                <div><Label htmlFor="rejection-reason-if-rejecting-2">Rejection Reason (if rejecting)</Label><Textarea id="rejection-reason-if-rejecting-2" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Explain why this listing is being rejected..." rows={3} /></div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setChangesTargetListingId(selectedAlert.listing_id); setShowAlertModal(false); setShowChangesModal(true); }}><Edit className="w-4 h-4 mr-2" /> Request Changes</Button>
                  <Button variant="destructive" onClick={() => handleRejectListing(selectedAlert.listing_id)} disabled={processing}>Reject</Button>
                  <Button onClick={() => handleApproveListing(selectedAlert.listing_id)} disabled={processing || !allChecklistComplete} className="bg-green-600 hover:bg-green-700">
                    {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {allChecklistComplete ? <><ShieldCheck className="w-4 h-4 mr-2" /> Approve & Publish</> : <><AlertCircle className="w-4 h-4 mr-2" /> Complete Checklist First</>}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Changes Modal */}
      <Dialog open={showChangesModal} onOpenChange={setShowChangesModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Changes</DialogTitle><DialogDescription>Describe what changes the investor needs to make.</DialogDescription></DialogHeader>
          <div><Label htmlFor="changes-required">Changes Required</Label><Textarea id="changes-required" value={changesRequested} onChange={(e) => setChangesRequested(e.target.value)} placeholder="e.g., Please provide proof of lease, update revenue figures..." rows={5} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChangesModal(false); setChangesTargetListingId(null); }}>Cancel</Button>
            <Button onClick={() => { const targetId = changesTargetListingId || selectedAlert?.listing_id || selectedListing?.id; if (targetId) handleRequestChanges(targetId); }}
              disabled={processing || !changesRequested.trim()} className="bg-[#d4a574] hover:bg-[#c49464]">
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification Modal (Private Sale) */}
      <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Deal Verification</DialogTitle><DialogDescription>Complete the verification checklist for this deal</DialogDescription></DialogHeader>
          {selectedVerification && (
            <div className="space-y-6">
              <Card className="bg-gray-50"><CardContent className="pt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div><p className="text-sm text-gray-500">Property</p><p className="font-semibold">{selectedVerification.listing?.property?.address}</p></div>
                  <div><p className="text-sm text-gray-500">Asking Price</p><p className="text-xl font-bold">${selectedVerification.listing?.asking_price?.toLocaleString()}</p></div>
                </div>
              </CardContent></Card>
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Phone className="w-5 h-5" /> Seller Verification Call</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between"><div><p className="font-medium">Call Completed</p><p className="text-sm text-gray-500">Contact: {selectedVerification.listing?.seller?.full_name}</p></div>
                    <Switch checked={verificationForm.seller_call_completed} onCheckedChange={(c) => setVerificationForm({...verificationForm, seller_call_completed: c})} /></div>
                  {verificationForm.seller_call_completed && (<><div><Label htmlFor="call-notes">Call Notes</Label><Textarea id="call-notes" value={verificationForm.seller_call_notes} onChange={(e) => setVerificationForm({...verificationForm, seller_call_notes: e.target.value})} rows={3} /></div>
                    <div className="flex items-center justify-between"><Label>Seller is Verified Operator</Label><Switch checked={verificationForm.seller_verified_operator} onCheckedChange={(c) => setVerificationForm({...verificationForm, seller_verified_operator: c})} /></div></>)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5" /> Landlord Verification</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between"><Label>Landlord Contacted</Label><Switch checked={verificationForm.landlord_contacted} onCheckedChange={(c) => setVerificationForm({...verificationForm, landlord_contacted: c})} /></div>
                  {verificationForm.landlord_contacted && (<>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div><Label htmlFor="name">Name</Label><Input id="name" value={verificationForm.landlord_name} onChange={(e) => setVerificationForm({...verificationForm, landlord_name: e.target.value})} /></div>
                      <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={verificationForm.landlord_phone} onChange={(e) => setVerificationForm({...verificationForm, landlord_phone: e.target.value})} /></div>
                      <div><Label htmlFor="email">Email</Label><Input id="email" value={verificationForm.landlord_email} onChange={(e) => setVerificationForm({...verificationForm, landlord_email: e.target.value})} /></div>
                    </div>
                    <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={verificationForm.landlord_notes} onChange={(e) => setVerificationForm({...verificationForm, landlord_notes: e.target.value})} rows={2} /></div>
                    <div className="flex items-center justify-between"><Label>Landlord Verified & Approves Transfer</Label><Switch checked={verificationForm.landlord_verified} onCheckedChange={(c) => setVerificationForm({...verificationForm, landlord_verified: c})} /></div>
                  </>)}
                </CardContent>
              </Card>
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Report Summary</CardTitle></CardHeader>
                <CardContent><Textarea value={verificationForm.report_summary} onChange={(e) => setVerificationForm({...verificationForm, report_summary: e.target.value})} rows={4} placeholder="Write a summary of your findings." /></CardContent></Card>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setShowVerificationModal(false)}>Save & Close</Button>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => handleCompleteVerification(false)} disabled={processing}>{processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}<XCircle className="w-4 h-4 mr-2" /> Mark as Failed</Button>
              <Button onClick={() => handleCompleteVerification(true)} disabled={processing || !verificationForm.seller_call_completed || !verificationForm.landlord_verified} className="bg-green-600 hover:bg-green-700">
                {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}<CheckCircle className="w-4 h-4 mr-2" /> Mark as Verified
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Public Listing Review Modal - Enhanced with Checklist */}
      <Dialog open={showListingModal} onOpenChange={(open) => { setShowListingModal(open); if (!open) { setListingDocs(null); setRejectionReason(''); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review Public Listing</DialogTitle></DialogHeader>
          {selectedListing && (
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="documents" className="flex-1">Documents {loadingDocs && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}</TabsTrigger>
                <TabsTrigger value="review" className="flex-1">Review ({checklistCount}/4)</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4 mt-4">
                <Card><CardContent className="pt-4">
                  <h3 className="font-semibold text-lg">{selectedListing.property?.address}</h3>
                  <p className="text-gray-500">{selectedListing.property?.city}, {selectedListing.property?.state}</p>
                  <div className="flex gap-4 mt-2">
                    {selectedListing.property?.bedrooms && <Badge variant="outline">{selectedListing.property.bedrooms} bed</Badge>}
                    {selectedListing.property?.bathrooms && <Badge variant="outline">{selectedListing.property.bathrooms} bath</Badge>}
                    {selectedListing.operation_type && <Badge variant="outline">{selectedListing.operation_type.toUpperCase()}</Badge>}
                    {selectedListing.is_furnished && <Badge variant="outline">Furnished</Badge>}
                  </div>
                </CardContent></Card>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">${selectedListing.asking_price.toLocaleString()}</p><p className="text-sm text-gray-500">Asking Price</p>
                    <div className="flex gap-3 justify-center mt-1 text-xs"><span className="text-blue-600">AYP: ${Math.round(selectedListing.asking_price * 0.2).toLocaleString()}</span><span className="text-green-600">Seller: ${Math.round(selectedListing.asking_price * 0.8).toLocaleString()}</span></div>
                  </CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-green-600">${selectedListing.monthly_revenue?.toLocaleString() || 0}</p><p className="text-sm text-gray-500">Monthly Revenue</p></CardContent></Card>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {selectedListing.adr && <div className="bg-gray-50 p-2 rounded text-center"><p className="text-xs text-gray-500">ADR</p><p className="font-bold">${selectedListing.adr}</p></div>}
                  {selectedListing.occupancy_rate && <div className="bg-gray-50 p-2 rounded text-center"><p className="text-xs text-gray-500">Occupancy</p><p className="font-bold">{selectedListing.occupancy_rate}%</p></div>}
                  {selectedListing.monthly_rent && <div className="bg-gray-50 p-2 rounded text-center"><p className="text-xs text-gray-500">Rent</p><p className="font-bold">${selectedListing.monthly_rent.toLocaleString()}</p></div>}
                  {selectedListing.lease_months_remaining && <div className="bg-gray-50 p-2 rounded text-center"><p className="text-xs text-gray-500">Lease Left</p><p className="font-bold">{selectedListing.lease_months_remaining} mo</p></div>}
                </div>
                <Card><CardContent className="pt-4"><p className="text-sm text-gray-500">Seller</p><p className="font-medium">{selectedListing.seller?.full_name}</p><p className="text-sm text-gray-500">{selectedListing.seller?.email}</p></CardContent></Card>
                {selectedListing.description && <Card><CardContent className="pt-4"><p className="text-sm text-gray-500 mb-1">Description</p><p className="text-sm whitespace-pre-wrap">{selectedListing.description}</p></CardContent></Card>}
              </TabsContent>
              <TabsContent value="documents" className="mt-4">
                {loadingDocs ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" /></div> : <DocumentViewer docs={listingDocs} title="Seller Uploaded Documents" />}
              </TabsContent>
              <TabsContent value="review" className="space-y-4 mt-4">
                <VerificationChecklistUI listingId={selectedListing.id} />
                <div><Label htmlFor="rejection-reason-if-rejecting">Rejection Reason (if rejecting)</Label><Textarea id="rejection-reason-if-rejecting" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Explain why this listing is being rejected..." rows={3} /></div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setChangesTargetListingId(selectedListing.id); setShowListingModal(false); setShowChangesModal(true); }}><Edit className="w-4 h-4 mr-2" /> Request Changes</Button>
                  <Button variant="destructive" onClick={() => handleRejectListing(selectedListing.id)} disabled={processing}>Reject</Button>
                  <Button onClick={() => handleApproveListing(selectedListing.id)} disabled={processing || !allChecklistComplete} className="bg-green-600 hover:bg-green-700">
                    {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {allChecklistComplete ? <><ShieldCheck className="w-4 h-4 mr-2" /> Approve & Publish</> : <><AlertCircle className="w-4 h-4 mr-2" /> Complete Checklist</>}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview Overlay */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="absolute -top-10 right-0 text-white hover:text-white/80" onClick={() => setPreviewImage(null)}><XCircle className="w-5 h-5 mr-1" /> Close</Button>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <div className="absolute bottom-4 right-4"><Button size="sm" className="bg-white/20 hover:bg-white/30 text-white" onClick={() => window.open(previewImage!, '_blank')}><Download className="w-4 h-4 mr-1" /> Download</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
