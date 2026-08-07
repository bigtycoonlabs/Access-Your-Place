import { useState, useEffect, useCallback } from 'react';
import { notifyAMAboutAction } from '@/utils/notifyAM';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SellerDocumentUploader, UploadedFile } from '@/components/investor/SellerDocumentUploader';
import { SellerOffersPanel } from '@/components/investor/SellerOffersPanel';
import {
  Loader2, Plus, Store, DollarSign, FileText, Upload, CheckCircle,
  Clock, AlertCircle, XCircle, Eye, Percent, ShieldCheck, ScrollText,
  Building2, Video, Package, BarChart3, ArrowRight, RefreshCw,
  Image, FileSpreadsheet, Paperclip, Pencil, RotateCcw, MessageSquareWarning, Handshake
} from 'lucide-react';


interface Props {
  investorId: string;
  investorName: string;
}

interface PortfolioProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  monthly_earnings: number;
  initial_investment: number;
}

interface SellerListing {
  id: string;
  property_id: string;
  asking_price: number;
  description: string;
  monthly_revenue: number;
  monthly_expenses: number;
  monthly_rent: number;
  lease_months_remaining: number;
  operation_type: string;
  status: string;
  is_furnished: boolean;
  has_lease_proof: boolean;
  inventory_list: string;
  video_walkthrough_url: string;
  proof_of_lease_urls: string[];
  financial_data_urls: string[];
  property_photo_urls: string[];
  rejection_reason?: string;
  changes_requested?: string;
  resubmit_count?: number;
  resubmitted_at?: string;
  adr: number;
  occupancy_rate: number;
  projected_monthly_revenue: number;
  created_at: string;
  property?: PortfolioProperty;
}

const SELLER_TOS = `THIRD-PARTY SELLER & REFERRAL PARTNER TERMS OF SERVICE
Set Up Your Place LLC (DBA: Access Your Place / AYP)
A Subsidiary of Cooper Family Inc.
Effective Date: February 1, 2026

1. ACCEPTANCE OF TERMS
By submitting a referral, property lead, or listing an operation for sale on the Access Your Place (AYP) platform, you (the "Partner" or "Seller") agree to be bound by these Terms of Service.

2. DEFINITIONS & CLASSIFICATIONS
• Third-Party Seller: An existing operator who holds a valid lease and assets (furniture/inventory) and wishes to sell/transfer this active operation to another investor through the AYP Marketplace.
• Acquisition Fee: The fee paid by the final buyer to secure the deal.

4. THE THIRD-PARTY SELLER PROGRAM

4.1 Definition of Third-Party Deal
A transaction where an Operator transfers an active lease, furniture, and booking history to a new buyer.

4.2 Seller Obligations (The "Verified Listing" Standard)
To list an operation on the AYP Marketplace, the Seller must provide:
• Proof of Lease: Confirmation of a secured lease agreement with the Master Landlord.
• Inventory List: A detailed breakdown of all furniture and assets included in the sale.
• Visual Verification: Confirmation of a property tour (video walkthrough or in-person) to verify condition.
• Financial Data: Profit & Loss (P&L) statements or verified booking history (Airbnb/VRBO data).

4.3 Commission & Pricing
• Pricing Authority: The Seller reserves the right to set their own Acquisition/Takeover Fee.
• AYP Commission: AYP retains 20% of the final Acquisition Fee as a marketing and facilitation fee.
• Seller Net: The Seller receives 80% of the final Acquisition Fee.

5. QUALITY CONTROL & RESTRICTIONS

5.1 Due Diligence Rights
AYP is not required to accept every deal submitted. We reserve the absolute right to perform independent due diligence on any listing. If a deal does not meet our "Foundation of Truth" standards (market viability, safety, profit potential), it will be rejected.

6. PAYMENT TERMS
• Third-Party Seller Payouts: Seller funds are disbursed within 3 business days of the buyer's funds clearing AYP's escrow account and the lease assignment being executed.

7. LEGAL & COMPLIANCE

7.1 Independent Contractor Status
Sellers are independent contractors, not employees of Set Up Your Place LLC. You are responsible for reporting your own taxes on commissions earned.

7.2 Non-Circumvention
Sellers agree not to circumvent AYP by attempting to sell a listed property directly to an AYP Client outside of the platform once the listing has been submitted.

7.3 Liability
AYP acts solely as a transactional marketplace and technology platform. AYP is not liable for the performance, profitability, or condition of any property listed through the platform.`;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; description: string }> = {
  pending_approval: { label: 'Under Review', color: 'bg-yellow-500', icon: Clock, description: 'Our success team is reviewing your listing' },
  needs_changes: { label: 'Changes Requested', color: 'bg-orange-500', icon: AlertCircle, description: 'Please update your listing based on staff feedback' },
  active: { label: 'Published', color: 'bg-green-600', icon: CheckCircle, description: 'Your listing is live on the marketplace' },
  sold: { label: 'Sold', color: 'bg-blue-600', icon: Store, description: 'This operation has been sold' },
  rejected: { label: 'Rejected', color: 'bg-red-500', icon: XCircle, description: 'This listing was not approved' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500', icon: XCircle, description: 'You cancelled this listing' },
};

interface FormState {
  property_id: string;
  asking_price: string;
  description: string;
  operation_type: string;
  lease_months_remaining: string;
  is_furnished: boolean;
  projected_monthly_revenue: string;
  adr: string;
  occupancy_rate: string;
  monthly_rent: string;
  inventory_list: string;
  video_walkthrough_url: string;
  has_lease_proof: boolean;
}

const EMPTY_FORM: FormState = {
  property_id: '', asking_price: '', description: '', operation_type: 'str',
  lease_months_remaining: '', is_furnished: true, projected_monthly_revenue: '',
  adr: '', occupancy_rate: '', monthly_rent: '', inventory_list: '',
  video_walkthrough_url: '', has_lease_proof: false,
};

export function SellMyOperation({ investorId, investorName }: Props) {
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTosModal, setShowTosModal] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);
  const [sellerTosAgreed, setSellerTosAgreed] = useState(false);
  const [agreeingTos, setAgreeingTos] = useState(false);
  const [selectedListing, setSelectedListing] = useState<SellerListing | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [createStep, setCreateStep] = useState<'details' | 'documents'>('details');

  // Edit mode state
  const [editingListing, setEditingListing] = useState<SellerListing | null>(null);
  const [loadingEditDocs, setLoadingEditDocs] = useState(false);

  const isEditMode = !!editingListing;

  // Form state
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  // Document upload state
  const [leaseFiles, setLeaseFiles] = useState<UploadedFile[]>([]);
  const [financialFiles, setFinancialFiles] = useState<UploadedFile[]>([]);
  const [photoFiles, setPhotoFiles] = useState<UploadedFile[]>([]);

  // Detail modal document state
  const [detailLeaseFiles, setDetailLeaseFiles] = useState<UploadedFile[]>([]);
  const [detailFinancialFiles, setDetailFinancialFiles] = useState<UploadedFile[]>([]);
  const [detailPhotoFiles, setDetailPhotoFiles] = useState<UploadedFile[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch listings, portfolio, and TOS status in parallel with fallbacks
      const [listingsRes, portfolioRes, tosRes] = await Promise.allSettled([
        supabase.functions.invoke('manage-deal-marketplace', {
          body: { action: 'get_my_seller_listings', investor_id: investorId }
        }),
        supabase.functions.invoke('investor-auth', {
          body: { action: 'get_portfolio_properties', investor_id: investorId }
        }),
        supabase.functions.invoke('manage-property-referrals', {
          body: { action: 'check_tos_status', investor_id: investorId }
        })
      ]);

      // Handle listings
      if (listingsRes.status === 'fulfilled' && listingsRes.value.data?.listings) {
        setListings(listingsRes.value.data.listings);
      } else {
        // DB fallback for listings
        try {
          const { data: dbListings } = await supabase
            .from('marketplace_listings')
            .select('*, property:investor_portfolio(*)')
            .eq('seller_id', investorId)
            .order('created_at', { ascending: false });
          setListings(dbListings || []);
        } catch { setListings([]); }
      }

      // Handle portfolio
      if (portfolioRes.status === 'fulfilled' && portfolioRes.value.data?.properties) {
        setPortfolio(portfolioRes.value.data.properties);
      } else {
        // DB fallback for portfolio
        try {
          const { data: dbPortfolio } = await supabase
            .from('investor_portfolio')
            .select('id, address, city, state, zip_code, bedrooms, bathrooms, monthly_rent, monthly_earnings, initial_investment')
            .eq('investor_id', investorId)
            .in('property_status', ['active', 'pending']);
          setPortfolio(dbPortfolio || []);
        } catch { setPortfolio([]); }
      }

      // Handle TOS
      if (tosRes.status === 'fulfilled' && tosRes.value.data) {
        setSellerTosAgreed(tosRes.value.data.seller_tos_agreed || false);
      } else {
        // DB fallback for TOS
        try {
          const { data: profile } = await supabase
            .from('investors')
            .select('seller_tos_agreed')
            .eq('id', investorId)
            .single();
          setSellerTosAgreed(profile?.seller_tos_agreed || false);
        } catch { setSellerTosAgreed(false); }
      }
    } catch (err) {
      console.error('Error loading seller data:', err);
    }
    setLoading(false);
  }, [investorId]);


  useEffect(() => { loadData(); }, [loadData]);

  const agreeToTos = async () => {
    if (!tosChecked) { toast({ title: 'Please agree to the terms', variant: 'destructive' }); return; }
    setAgreeingTos(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-property-referrals', {
        body: { action: 'agree_to_tos', investor_id: investorId, tos_type: 'seller' }
      });
      if (!error && data?.success) {
        setSellerTosAgreed(true);
        setShowTosModal(false);
        toast({ title: 'Terms Accepted', description: 'You can now list operations for sale on the marketplace.' });
      } else {
        // DB fallback: update investor_profiles directly
        const { error: updateError } = await supabase
          .from('investors')
          .update({ seller_tos_agreed: true, seller_tos_agreed_at: new Date().toISOString() })
          .eq('id', investorId);
        if (updateError) throw new Error(updateError.message);
        setSellerTosAgreed(true);
        setShowTosModal(false);
        toast({ title: 'Terms Accepted', description: 'You can now list operations for sale on the marketplace.' });
      }
    } catch (err: any) { toast({ title: 'Error', description: err.message || 'Failed to save agreement', variant: 'destructive' }); }
    setAgreeingTos(false);
  };


  // Load documents for a listing (used in edit mode and detail view)
  const loadListingDocuments = async (listing: SellerListing): Promise<{
    lease: UploadedFile[];
    financial: UploadedFile[];
    photos: UploadedFile[];
  }> => {
    // Try edge function first
    try {
      const { data } = await supabase.functions.invoke('seller-document-upload', {
        body: { action: 'get_listing_documents', listing_id: listing.id }
      });
      if (data?.success && data.documents) {
        const mapDocs = (docs: any[], category: string): UploadedFile[] =>
          (docs || []).map((d: any) => ({
            path: d.path,
            name: d.file_name || d.path?.split('/').pop()?.replace(/^\d+_/, '') || 'file',
            mime_type: d.is_image ? 'image/jpeg' : 'application/pdf',
            size: 0,
            category,
            signed_url: d.signed_url,
            uploaded_at: '',
            is_image: d.is_image
          }));
        return {
          lease: mapDocs(data.documents?.lease, 'lease'),
          financial: mapDocs(data.documents?.financial, 'financial'),
          photos: mapDocs(data.documents?.photos, 'photos'),
        };
      }
    } catch (err) {
      console.error('Edge function loadListingDocuments failed:', err);
    }

    // DB Fallback 1: Try seller_listing_documents table
    try {
      const { data: dbDocs } = await supabase
        .from('seller_listing_documents')
        .select('*')
        .eq('listing_id', listing.id)
        .order('created_at', { ascending: true });
      
      if (dbDocs && dbDocs.length > 0) {
        const categorized: Record<string, UploadedFile[]> = { lease: [], financial: [], photos: [] };
        
        // Generate signed URLs for all docs in parallel
        const signedUrlPromises = dbDocs.map(async (doc: any) => {
          const bucketName = doc.bucket_name || 'seller-documents';
          let signedUrl: string | null = null;
          
          // Try primary bucket
          try {
            const { data: urlData } = await supabase.storage.from(bucketName).createSignedUrl(doc.file_path, 3600);
            signedUrl = urlData?.signedUrl || null;
          } catch {}
          
          // Fallback to other bucket
          if (!signedUrl) {
            const fallbackBucket = bucketName === 'seller-documents' ? 'investor-documents' : 'seller-documents';
            try {
              const { data: urlData } = await supabase.storage.from(fallbackBucket).createSignedUrl(doc.file_path, 3600);
              signedUrl = urlData?.signedUrl || null;
            } catch {}
          }
          
          return { doc, signedUrl };
        });
        
        const results = await Promise.all(signedUrlPromises);
        
        for (const { doc, signedUrl } of results) {
          const cat = doc.category as string;
          if (categorized[cat]) {
            categorized[cat].push({
              path: doc.file_path,
              name: doc.original_file_name || doc.file_name || 'file',
              mime_type: doc.mime_type || 'application/octet-stream',
              size: doc.file_size || 0,
              category: cat,
              signed_url: signedUrl,
              uploaded_at: doc.created_at || '',
              is_image: (doc.mime_type || '').startsWith('image/')
            });
          }
        }
        
        return categorized as { lease: UploadedFile[]; financial: UploadedFile[]; photos: UploadedFile[] };
      }
    } catch (dbErr) {
      console.error('DB fallback seller_listing_documents failed:', dbErr);
    }

    // DB Fallback 2: Reconstruct from listing's URL arrays
    try {
      const allPaths = {
        lease: listing.proof_of_lease_urls || [],
        financial: listing.financial_data_urls || [],
        photos: listing.property_photo_urls || []
      };
      
      const hasAnyPaths = allPaths.lease.length > 0 || allPaths.financial.length > 0 || allPaths.photos.length > 0;
      if (!hasAnyPaths) return { lease: [], financial: [], photos: [] };
      
      const result: { lease: UploadedFile[]; financial: UploadedFile[]; photos: UploadedFile[] } = {
        lease: [], financial: [], photos: []
      };
      
      // Generate signed URLs for each category
      for (const [category, paths] of Object.entries(allPaths)) {
        if (paths.length === 0) continue;
        
        // Try edge function batch signing
        let signedUrls: Record<string, string> = {};
        try {
          const { data: urlData } = await supabase.functions.invoke('seller-document-upload', {
            body: { action: 'get_signed_urls', file_paths: paths }
          });
          if (urlData?.urls) {
            for (const u of urlData.urls) {
              if (u.signed_url) signedUrls[u.path] = u.signed_url;
            }
          }
        } catch {
          // Generate signed URLs individually via direct storage
          for (const path of paths) {
            try {
              const { data: urlData } = await supabase.storage.from('seller-documents').createSignedUrl(path, 3600);
              if (urlData?.signedUrl) { signedUrls[path] = urlData.signedUrl; continue; }
            } catch {}
            try {
              const { data: urlData } = await supabase.storage.from('investor-documents').createSignedUrl(path, 3600);
              if (urlData?.signedUrl) signedUrls[path] = urlData.signedUrl;
            } catch {}
          }
        }
        
        const cat = category as 'lease' | 'financial' | 'photos';
        result[cat] = paths.map((path: string) => {
          const fileName = path.split('/').pop()?.replace(/^\d+_/, '') || 'file';
          const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(path);
          return {
            path,
            name: fileName,
            mime_type: isImage ? 'image/jpeg' : 'application/pdf',
            size: 0,
            category: cat,
            signed_url: signedUrls[path] || null,
            uploaded_at: '',
            is_image: isImage
          };
        });
      }
      
      return result;
    } catch (reconstructErr) {
      console.error('Reconstruct from URL arrays failed:', reconstructErr);
    }

    return { lease: [], financial: [], photos: [] };
  };


  // Enter edit mode for a listing
  const handleEditListing = async (listing: SellerListing) => {
    setEditingListing(listing);
    setLoadingEditDocs(true);

    // Pre-populate form with existing data
    setForm({
      property_id: listing.property_id || '',
      asking_price: listing.asking_price ? String(listing.asking_price) : '',
      description: listing.description || '',
      operation_type: listing.operation_type || 'str',
      lease_months_remaining: listing.lease_months_remaining ? String(listing.lease_months_remaining) : '',
      is_furnished: listing.is_furnished ?? true,
      projected_monthly_revenue: listing.projected_monthly_revenue ? String(listing.projected_monthly_revenue) : '',
      adr: listing.adr ? String(listing.adr) : '',
      occupancy_rate: listing.occupancy_rate ? String(listing.occupancy_rate) : '',
      monthly_rent: listing.monthly_rent ? String(listing.monthly_rent) : '',
      inventory_list: listing.inventory_list || '',
      video_walkthrough_url: listing.video_walkthrough_url || '',
      has_lease_proof: listing.has_lease_proof ?? false,
    });

    setCreateStep('details');
    setShowCreateModal(true);

    // Load existing documents
    const docs = await loadListingDocuments(listing);
    setLeaseFiles(docs.lease);
    setFinancialFiles(docs.financial);
    setPhotoFiles(docs.photos);
    setLoadingEditDocs(false);
  };

  const handleCreateListing = async () => {
    if (!form.property_id) { toast({ title: 'Please select a property', variant: 'destructive' }); return; }
    if (!form.asking_price || parseFloat(form.asking_price) <= 0) { toast({ title: 'Please enter a valid asking price', variant: 'destructive' }); return; }
    if (!form.description) { toast({ title: 'Please add a description', variant: 'destructive' }); return; }
    if (!form.has_lease_proof && leaseFiles.length === 0) { toast({ title: 'Please upload proof of lease or confirm you have one', variant: 'destructive' }); return; }
    if (!form.inventory_list.trim()) { toast({ title: 'Please provide an inventory list of furniture/assets', variant: 'destructive' }); return; }

    setSubmitting(true);
    try {
      const listingPayload = {
        seller_id: investorId,
        property_id: form.property_id,
        listing_type: 'public',
        acquisition_cost: parseFloat(form.asking_price),
        asking_price: parseFloat(form.asking_price),
        description: form.description,
        operation_type: form.operation_type,
        lease_months_remaining: form.lease_months_remaining ? parseInt(form.lease_months_remaining) : null,
        is_furnished: form.is_furnished,
        projected_monthly_revenue: form.projected_monthly_revenue ? parseFloat(form.projected_monthly_revenue) : null,
        adr: form.adr ? parseFloat(form.adr) : null,
        occupancy_rate: form.occupancy_rate ? parseFloat(form.occupancy_rate) : null,
        monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : null,
        inventory_list: form.inventory_list,
        video_walkthrough_url: form.video_walkthrough_url || null,
        has_lease_proof: form.has_lease_proof || leaseFiles.length > 0,
        seller_tos_agreed: true,
        proof_of_lease_urls: leaseFiles.map(f => f.path),
        financial_data_urls: financialFiles.map(f => f.path),
        property_photo_urls: photoFiles.map(f => f.path),
        status: 'pending_approval',
      };

      // Try edge function first
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'create_listing',
          investor_id: investorId,
          ...listingPayload,
        }
      });

      let listingId: string | null = null;

      if (data?.success && data?.listing?.id) {
        listingId = data.listing.id;
      } else if (error || data?.error) {
        // DB fallback: insert directly into marketplace_listings
        console.warn('Edge function failed, trying DB fallback:', data?.error || error?.message);
        const { data: dbListing, error: dbError } = await supabase
          .from('marketplace_listings')
          .insert(listingPayload)
          .select('id')
          .single();
        
        if (dbError) throw new Error(dbError.message);
        listingId = dbListing?.id;
      }

      // Update document URLs if we have a listing ID
      if (listingId) {
        const updatePromises = [];
        if (leaseFiles.length > 0) {
          updatePromises.push(supabase.functions.invoke('seller-document-upload', {
            body: { action: 'update_listing_urls', listing_id: listingId, investor_id: investorId, category: 'lease', file_paths: leaseFiles.map(f => f.path) }
          }).catch(() => {})); // Don't fail on doc update
        }
        if (financialFiles.length > 0) {
          updatePromises.push(supabase.functions.invoke('seller-document-upload', {
            body: { action: 'update_listing_urls', listing_id: listingId, investor_id: investorId, category: 'financial', file_paths: financialFiles.map(f => f.path) }
          }).catch(() => {}));
        }
        if (photoFiles.length > 0) {
          updatePromises.push(supabase.functions.invoke('seller-document-upload', {
            body: { action: 'update_listing_urls', listing_id: listingId, investor_id: investorId, category: 'photos', file_paths: photoFiles.map(f => f.path) }
          }).catch(() => {}));
        }
        await Promise.allSettled(updatePromises);
      }

      notifyAMAboutAction(investorId, 'Selling Operation', `Listed operation for sale — Asking: $${parseFloat(form.asking_price).toLocaleString()}`);
      toast({ title: 'Listing Submitted!', description: 'Your listing has been submitted for review by the AYP Success Team.' });
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (err: any) { toast({ title: 'Error', description: err.message || 'Failed to create listing', variant: 'destructive' }); }
    setSubmitting(false);
  };


  // Resubmit an edited listing
  const handleResubmitListing = async () => {
    if (!editingListing) return;
    if (!form.asking_price || parseFloat(form.asking_price) <= 0) { toast({ title: 'Please enter a valid asking price', variant: 'destructive' }); return; }
    if (!form.description) { toast({ title: 'Please add a description', variant: 'destructive' }); return; }
    if (!form.has_lease_proof && leaseFiles.length === 0) { toast({ title: 'Please upload proof of lease or confirm you have one', variant: 'destructive' }); return; }
    if (!form.inventory_list.trim()) { toast({ title: 'Please provide an inventory list of furniture/assets', variant: 'destructive' }); return; }

    setSubmitting(true);
    try {
      // First, update document URLs on the listing
      const docUpdatePromises = [
        supabase.functions.invoke('seller-document-upload', {
          body: { action: 'update_listing_urls', listing_id: editingListing.id, investor_id: investorId, category: 'lease', file_paths: leaseFiles.map(f => f.path) }
        }),
        supabase.functions.invoke('seller-document-upload', {
          body: { action: 'update_listing_urls', listing_id: editingListing.id, investor_id: investorId, category: 'financial', file_paths: financialFiles.map(f => f.path) }
        }),
        supabase.functions.invoke('seller-document-upload', {
          body: { action: 'update_listing_urls', listing_id: editingListing.id, investor_id: investorId, category: 'photos', file_paths: photoFiles.map(f => f.path) }
        }),
      ];
      await Promise.all(docUpdatePromises);

      // Then resubmit with updated fields
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'resubmit_listing',
          listing_id: editingListing.id,
          investor_id: investorId,
          updates: {
            asking_price: parseFloat(form.asking_price),
            acquisition_cost: parseFloat(form.asking_price),
            description: form.description,
            operation_type: form.operation_type,
            lease_months_remaining: form.lease_months_remaining ? parseInt(form.lease_months_remaining) : null,
            is_furnished: form.is_furnished,
            projected_monthly_revenue: form.projected_monthly_revenue ? parseFloat(form.projected_monthly_revenue) : null,
            adr: form.adr ? parseFloat(form.adr) : null,
            occupancy_rate: form.occupancy_rate ? parseFloat(form.occupancy_rate) : null,
            monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : null,
            inventory_list: form.inventory_list,
            video_walkthrough_url: form.video_walkthrough_url || null,
            has_lease_proof: form.has_lease_proof || leaseFiles.length > 0,
            proof_of_lease_urls: leaseFiles.map(f => f.path),
            financial_data_urls: financialFiles.map(f => f.path),
            property_photo_urls: photoFiles.map(f => f.path),
          }
        }
      });

      if (data?.success) {
        toast({
          title: 'Listing Resubmitted!',
          description: 'Your updated listing has been resubmitted for review. Our team will review your changes shortly.',
        });
        setShowCreateModal(false);
        resetForm();
        loadData();
      } else {
        throw new Error(data?.error || error?.message || 'Failed to resubmit listing');
      }
    } catch (err: any) {
      toast({ title: 'Resubmit Error', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleCancelListing = async (listingId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'cancel_listing', listing_id: listingId, investor_id: investorId }
      });
      if (!error && data?.success) {
        toast({ title: 'Listing Cancelled' });
        loadData();
      } else {
        // DB fallback: update status directly
        const { error: dbError } = await supabase
          .from('marketplace_listings')
          .update({ status: 'cancelled' })
          .eq('id', listingId)
          .eq('seller_id', investorId);
        if (dbError) throw new Error(dbError.message);
        toast({ title: 'Listing Cancelled' });
        loadData();
      }
    } catch (err: any) { toast({ title: 'Error', description: err.message || 'Failed to cancel listing', variant: 'destructive' }); }
  };


  const handleViewListingDocs = async (listing: SellerListing) => {
    setSelectedListing(listing);
    setShowDetailModal(true);
    setLoadingDocs(true);

    const docs = await loadListingDocuments(listing);
    setDetailLeaseFiles(docs.lease);
    setDetailFinancialFiles(docs.financial);
    setDetailPhotoFiles(docs.photos);
    setLoadingDocs(false);
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setLeaseFiles([]);
    setFinancialFiles([]);
    setPhotoFiles([]);
    setCreateStep('details');
    setEditingListing(null);
    setLoadingEditDocs(false);
  };

  const askingPrice = parseFloat(form.asking_price) || 0;
  const aypCommission = Math.round(askingPrice * 0.2);
  const sellerNet = Math.round(askingPrice * 0.8);

  const totalUploadedFiles = leaseFiles.length + financialFiles.length + photoFiles.length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white border-0">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Store className="w-6 h-6 text-[#d4a574]" /> Sell My Operation
              </h3>
              <p className="text-white/70 mt-1 max-w-xl">
                List your active arbitrage operation for sale on the AYP Marketplace. You set the price, AYP handles marketing and facilitation.
              </p>
            </div>
            <Button
              onClick={() => {
                if (!sellerTosAgreed) { setShowTosModal(true); return; }
                if (portfolio.length === 0) { toast({ title: 'No Properties', description: 'Add a property to your portfolio first before listing an operation for sale.', variant: 'destructive' }); return; }
                resetForm();
                setShowCreateModal(true);
              }}
              className="bg-[#d4a574] hover:bg-[#c49464] text-white whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" /> List an Operation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Commission Breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-[#d4a574]/20 bg-[#d4a574]/5">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <DollarSign className="w-6 h-6 text-[#d4a574]" />
            </div>
            <p className="text-sm text-muted-foreground">You Set The Price</p>
            <p className="text-lg font-bold mt-1">Your Acquisition Fee</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Percent className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground">AYP Marketing & Facilitation</p>
            <p className="text-lg font-bold mt-1 text-blue-700">20% Commission</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">Your Net Payout</p>
            <p className="text-lg font-bold mt-1 text-green-700">80% of Sale Price</p>
          </CardContent>
        </Card>
      </div>

      {/* TOS Gate */}
      {!sellerTosAgreed && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex gap-3">
                <ScrollText className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-amber-800">Terms of Service Required</p>
                  <p className="text-sm text-amber-600 mt-1">You must agree to the Third-Party Seller Terms of Service before listing an operation for sale.</p>
                </div>
              </div>
              <Button onClick={() => setShowTosModal(true)} className="bg-[#d4a574] hover:bg-[#c49464] whitespace-nowrap">
                <FileText className="w-4 h-4 mr-2" /> Review & Agree
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Listings */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>My Listings</CardTitle>
              <CardDescription>Track the status of your operation listings</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {listings.length === 0 ? (
            <div className="text-center py-12">
              <Store className="w-16 h-16 mx-auto text-gray-200 mb-4" />
              <h3 className="text-lg font-medium text-gray-600">No Listings Yet</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                Ready to sell your operation? List it on the AYP Marketplace and reach verified investors.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {listings.map(listing => {
                const config = STATUS_CONFIG[listing.status] || STATUS_CONFIG.pending_approval;
                const propAddr = listing.property
                  ? `${listing.property.address}, ${listing.property.city}, ${listing.property.state}`
                  : 'Property';
                const docCount = (listing.proof_of_lease_urls?.length || 0) + (listing.financial_data_urls?.length || 0) + (listing.property_photo_urls?.length || 0);
                const isNeedsChanges = listing.status === 'needs_changes';

                return (
                  <div key={listing.id} className={`border rounded-lg p-5 transition-colors ${isNeedsChanges ? 'border-orange-300 bg-orange-50/30' : 'hover:border-[#d4a574]/30'}`}>
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-lg">{propAddr}</h4>
                          <Badge className={config.color}>{config.label}</Badge>
                          {listing.resubmit_count && listing.resubmit_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <RotateCcw className="w-3 h-3 mr-1" /> Resubmitted {listing.resubmit_count}x
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{config.description}</p>

                        {/* Changes Requested Banner (prominent) */}
                        {isNeedsChanges && listing.changes_requested && (
                          <div className="mt-2 p-4 bg-orange-100 border border-orange-300 rounded-lg">
                            <div className="flex items-start gap-2">
                              <MessageSquareWarning className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold text-orange-800 text-sm">Staff Requested Changes:</p>
                                <p className="text-sm text-orange-700 mt-1 whitespace-pre-wrap">{listing.changes_requested}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {listing.rejection_reason && listing.status === 'rejected' && (
                          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700"><strong>Rejection Reason:</strong> {listing.rejection_reason}</p>
                          </div>
                        )}

                        {listing.description && !isNeedsChanges && (
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">{listing.description}</p>
                        )}

                        {/* Document Summary */}
                        <div className="flex items-center gap-3 mt-3">
                          {docCount > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Paperclip className="w-3 h-3" /> {docCount} document{docCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {listing.video_walkthrough_url && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Video className="w-3 h-3" /> Video
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Listed {new Date(listing.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 min-w-[200px]">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Asking Price</p>
                          <p className="text-2xl font-bold">${listing.asking_price?.toLocaleString()}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center text-xs w-full">
                          <div className="bg-blue-50 p-2 rounded">
                            <p className="text-blue-600">AYP (20%)</p>
                            <p className="font-bold">${Math.round(listing.asking_price * 0.2).toLocaleString()}</p>
                          </div>
                          <div className="bg-green-50 p-2 rounded">
                            <p className="text-green-600">Your Net (80%)</p>
                            <p className="font-bold text-green-700">${Math.round(listing.asking_price * 0.8).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewListingDocs(listing)}>
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                          {isNeedsChanges && (
                            <Button
                              size="sm"
                              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                              onClick={() => handleEditListing(listing)}
                            >
                              <Pencil className="w-4 h-4 mr-1" /> Edit & Resubmit
                            </Button>
                          )}
                          {(listing.status === 'pending_approval' || isNeedsChanges) && (
                            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleCancelListing(listing.id)}>
                              <XCircle className="w-4 h-4 mr-1" /> Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incoming Offers Panel */}
      <SellerOffersPanel investorId={investorId} investorName={investorName} />

      {/* Offer count badges on active listings */}
      {listings.some(l => l.status === 'active' && ((l as any).pending_offer_count > 0 || (l as any).offer_count > 0)) && (
        <Card className="bg-[#d4a574]/5 border-[#d4a574]/20">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <Handshake className="w-5 h-5 text-[#d4a574]" />
              <div>
                <p className="font-medium text-sm">You have active listings receiving offers!</p>
                <p className="text-xs text-muted-foreground">Check the "Incoming Offers" section above to review and respond to buyer offers.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Flow */}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listing Approval Process</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              { label: 'Submit Listing', icon: Upload },
              { label: 'Under Review', icon: Clock },
              { label: 'Staff Verified', icon: ShieldCheck },
              { label: 'Published', icon: Eye },
              { label: 'Sold', icon: CheckCircle },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
                  <step.icon className="w-3.5 h-3.5 text-[#1a365d]" />
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
                {i < 4 && <ArrowRight className="w-4 h-4 text-gray-300" />}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            All listings must be verified by the AYP Success Team before being published. If changes are requested, you can edit and resubmit your listing.
          </p>
        </CardContent>
      </Card>

      {/* TOS Modal */}
      <Dialog open={showTosModal} onOpenChange={setShowTosModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Third-Party Seller Terms of Service</DialogTitle>
            <DialogDescription>Please read and agree to the following terms to list operations for sale.</DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto border text-sm">
            <pre className="whitespace-pre-wrap font-sans leading-relaxed text-gray-700">{SELLER_TOS}</pre>
          </div>
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <Checkbox id="seller-tos-agree" checked={tosChecked} onCheckedChange={(c) => setTosChecked(c === true)} />
            <Label htmlFor="seller-tos-agree" className="text-sm cursor-pointer leading-relaxed">
              I have read and agree to the Third-Party Seller Terms of Service. I understand that AYP retains 20% of the final Acquisition Fee as a marketing and facilitation commission, and that all listings must pass verification before being published.
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTosModal(false)}>Cancel</Button>
            <Button onClick={agreeToTos} disabled={!tosChecked || agreeingTos} className="bg-[#d4a574] hover:bg-[#c49464]">
              {agreeingTos && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} I Agree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Listing Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open) { setShowCreateModal(false); resetForm(); } else setShowCreateModal(true); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditMode ? (
                <><Pencil className="w-5 h-5 text-orange-500" /> Edit & Resubmit Listing</>
              ) : (
                <><Store className="w-5 h-5" /> List Your Operation for Sale</>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? `Editing listing — Make the requested changes and resubmit for review.`
                : createStep === 'details'
                  ? 'Step 1 of 2: Complete the listing details.'
                  : 'Step 2 of 2: Upload supporting documents for verification.'
              }
            </DialogDescription>
          </DialogHeader>

          {/* Staff Changes Requested Banner (Edit Mode) */}
          {isEditMode && editingListing?.changes_requested && (
            <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-5 mb-1">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageSquareWarning className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-orange-800 text-base">Staff Requested Changes</h4>
                  <p className="text-xs text-orange-500 mt-0.5 mb-2">
                    Please address the following feedback before resubmitting your listing:
                  </p>
                  <div className="bg-white border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-orange-900 whitespace-pre-wrap leading-relaxed">{editingListing.changes_requested}</p>
                  </div>
                  {editingListing.resubmit_count && editingListing.resubmit_count > 0 && (
                    <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> This listing has been resubmitted {editingListing.resubmit_count} time{editingListing.resubmit_count > 1 ? 's' : ''} previously
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Edit mode: show resubmit count badge */}
          {isEditMode && editingListing && !editingListing.changes_requested && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-1">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                <p className="text-sm text-blue-700">
                  You are editing this listing. Update any fields below and resubmit for review.
                </p>
              </div>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center gap-3 mb-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${createStep === 'details' ? (isEditMode ? 'bg-orange-500 text-white' : 'bg-[#d4a574] text-white') : 'bg-green-100 text-green-700'}`}>
              {createStep === 'documents' ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs">1</span>}
              Details
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${createStep === 'documents' ? (isEditMode ? 'bg-orange-500 text-white' : 'bg-[#d4a574] text-white') : 'bg-gray-100 text-gray-500'}`}>
              <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs">2</span>
              Documents {loadingEditDocs && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
          </div>

          {/* Step 1: Details */}
          {createStep === 'details' && (
            <div className="space-y-6">
              {/* Property Selection */}
              <div>
                <Label>Select Property from Portfolio *</Label>
                <Select
                  value={form.property_id}
                  onValueChange={(v) => setForm({ ...form, property_id: v })}
                  disabled={isEditMode} // Can't change property in edit mode
                >
                  <SelectTrigger className={isEditMode ? 'opacity-70' : ''}>
                    <SelectValue placeholder="Choose a property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolio.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address}, {p.city}, {p.state}
                      </SelectItem>
                    ))}
                    {/* Include the current property if it's not in the active portfolio */}
                    {isEditMode && editingListing?.property && !portfolio.find(p => p.id === editingListing.property_id) && (
                      <SelectItem value={editingListing.property_id}>
                        {editingListing.property.address}, {editingListing.property.city}, {editingListing.property.state}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {isEditMode && (
                  <p className="text-xs text-muted-foreground mt-1">Property cannot be changed when editing. Create a new listing for a different property.</p>
                )}
                {!isEditMode && portfolio.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">No properties in your portfolio. Add a property first.</p>
                )}
              </div>

              {/* Operation Type */}
              <div>
                <Label>Operation Type *</Label>
                <Select value={form.operation_type} onValueChange={(v) => setForm({ ...form, operation_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="str">Short-Term Rental (STR)</SelectItem>
                    <SelectItem value="coliving">Co-Living</SelectItem>
                    <SelectItem value="both">STR + Co-Living</SelectItem>
                    <SelectItem value="peerspace">Peerspace / Event Space</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pricing */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Pricing</h4>
                <div>
                  <Label htmlFor="your-asking-takeover-fee">Your Asking / Takeover Fee *</Label>
                  <Input id="your-asking-takeover-fee" type="number" min="0" value={form.asking_price} onChange={(e) => setForm({ ...form, asking_price: e.target.value })} placeholder="e.g., 15000" />
                </div>
                {askingPrice > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Asking Price</p>
                      <p className="text-lg font-bold">${askingPrice.toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-blue-600">AYP Commission (20%)</p>
                      <p className="text-lg font-bold text-blue-700">${aypCommission.toLocaleString()}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-green-600">Your Net (80%)</p>
                      <p className="text-lg font-bold text-green-700">${sellerNet.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Data */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Financial Data</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="projected-monthly-revenue">Projected Monthly Revenue</Label>
                    <Input id="projected-monthly-revenue" type="number" min="0" value={form.projected_monthly_revenue} onChange={(e) => setForm({ ...form, projected_monthly_revenue: e.target.value })} placeholder="4500" />
                  </div>
                  <div>
                    <Label htmlFor="average-daily-rate-adr">Average Daily Rate (ADR)</Label>
                    <Input id="average-daily-rate-adr" type="number" min="0" value={form.adr} onChange={(e) => setForm({ ...form, adr: e.target.value })} placeholder="150" />
                  </div>
                  <div>
                    <Label htmlFor="occupancy-rate">Occupancy Rate (%)</Label>
                    <Input id="occupancy-rate" type="number" min="0" max="100" value={form.occupancy_rate} onChange={(e) => setForm({ ...form, occupancy_rate: e.target.value })} placeholder="75" />
                  </div>
                  <div>
                    <Label htmlFor="monthly-rent">Monthly Rent</Label>
                    <Input id="monthly-rent" type="number" min="0" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} placeholder="2000" />
                  </div>
                  <div>
                    <Label htmlFor="lease-months-remaining">Lease Months Remaining</Label>
                    <Input id="lease-months-remaining" type="number" min="0" value={form.lease_months_remaining} onChange={(e) => setForm({ ...form, lease_months_remaining: e.target.value })} placeholder="8" />
                  </div>
                </div>
              </div>

              {/* Verification Requirements */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Verification Info</h4>
                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2" htmlFor="inventory-list-of-furniture-assets"><Package className="w-4 h-4" /> Inventory List of Furniture & Assets *</Label>
                    <Textarea id="inventory-list-of-furniture-assets"
                      value={form.inventory_list}
                      onChange={(e) => setForm({ ...form, inventory_list: e.target.value })}
                      placeholder={"List all furniture and assets included in the sale, e.g.:\n- Living room: Sofa, coffee table, TV stand, 55\" TV\n- Bedroom 1: Queen bed frame, mattress, dresser, nightstand\n- Kitchen: Dishes, cookware, utensils, coffee maker\n- Linens: 4 sets of sheets, towels, pillows"}
                      rows={5}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2" htmlFor="video-walkthrough-url"><Video className="w-4 h-4" /> Video Walkthrough URL</Label>
                    <Input id="video-walkthrough-url"
                      value={form.video_walkthrough_url}
                      onChange={(e) => setForm({ ...form, video_walkthrough_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=... or Google Drive link"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Upload a video walkthrough to YouTube, Google Drive, or Loom and paste the link here.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="is-furnished" checked={form.is_furnished} onCheckedChange={(c) => setForm({ ...form, is_furnished: c === true })} />
                    <Label htmlFor="is-furnished" className="cursor-pointer text-sm">This property is fully furnished and operational</Label>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="border-t pt-4">
                <Label htmlFor="listing-description">Listing Description *</Label>
                <Textarea id="listing-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe your operation, what makes it attractive, booking history highlights, neighborhood, etc."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 2: Document Uploads */}
          {createStep === 'documents' && (
            <div className="space-y-6">
              {/* Edit mode: reminder about changes */}
              {isEditMode && editingListing?.changes_requested && (
                <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
                  <p className="text-sm text-orange-700 font-medium flex items-center gap-2">
                    <MessageSquareWarning className="w-4 h-4" /> Remember to address the requested changes
                  </p>
                  <p className="text-xs text-orange-600 mt-1 line-clamp-2">{editingListing.changes_requested}</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {isEditMode ? 'Update Supporting Documents' : 'Upload Supporting Documents'}
                </h4>
                <p className="text-sm text-blue-600 mt-1">
                  {isEditMode
                    ? 'Add new documents or remove existing ones. All documents will be reviewed again during verification.'
                    : 'Upload your proof of lease, financial statements, and property photos. These documents will be reviewed by the AYP Success Team during verification. All files are stored securely and only accessible to you and AYP staff.'
                  }
                </p>
              </div>

              {loadingEditDocs ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
                  <p className="text-sm text-muted-foreground">Loading existing documents...</p>
                </div>
              ) : (
                <>
                  {/* Proof of Lease Upload */}
                  <Card className="border-[#d4a574]/20">
                    <CardContent className="pt-5">
                      <SellerDocumentUploader
                        investorId={investorId}
                        listingId={isEditMode ? editingListing?.id : undefined}
                        category="lease"
                        label="Proof of Lease *"
                        description="Upload your lease agreement, lease amendment, or landlord approval letter (PDF, images, or Word docs)"
                        files={leaseFiles}
                        onFilesChange={setLeaseFiles}
                        maxFiles={5}
                      />
                      {leaseFiles.length === 0 && (
                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mt-3">
                          <Checkbox id="lease-proof-confirm" checked={form.has_lease_proof} onCheckedChange={(c) => setForm({ ...form, has_lease_proof: c === true })} />
                          <Label htmlFor="lease-proof-confirm" className="cursor-pointer text-sm">
                            <span className="font-medium">I confirm I have proof of lease</span>
                            <p className="text-xs text-muted-foreground">If you can't upload now, check this box and provide the documents to your Acquisition Manager during verification.</p>
                          </Label>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Financial Documents Upload */}
                  <Card className="border-blue-200/50">
                    <CardContent className="pt-5">
                      <SellerDocumentUploader
                        investorId={investorId}
                        listingId={isEditMode ? editingListing?.id : undefined}
                        category="financial"
                        label="Financial Documents (P&L / Booking History)"
                        description="Upload P&L statements, Airbnb/VRBO earnings screenshots, bank statements, or spreadsheets"
                        files={financialFiles}
                        onFilesChange={setFinancialFiles}
                        maxFiles={10}
                      />
                    </CardContent>
                  </Card>

                  {/* Property Photos Upload */}
                  <Card className="border-green-200/50">
                    <CardContent className="pt-5">
                      <SellerDocumentUploader
                        investorId={investorId}
                        listingId={isEditMode ? editingListing?.id : undefined}
                        category="photos"
                        label="Property Photos"
                        description="Upload photos of the property interior, exterior, furniture, and amenities (JPG, PNG, WebP)"
                        files={photoFiles}
                        onFilesChange={setPhotoFiles}
                        maxFiles={20}
                      />
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Upload Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Upload Summary</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-red-500" />
                    <span className="text-sm">{leaseFiles.length} lease doc{leaseFiles.length !== 1 ? 's' : ''}</span>
                    {leaseFiles.length > 0 && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{financialFiles.length} financial doc{financialFiles.length !== 1 ? 's' : ''}</span>
                    {financialFiles.length > 0 && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">{photoFiles.length} photo{photoFiles.length !== 1 ? 's' : ''}</span>
                    {photoFiles.length > 0 && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <p className="font-medium flex items-center gap-1"><AlertCircle className="w-4 h-4" /> What happens next?</p>
                <ul className="mt-1 space-y-1 list-disc list-inside text-xs">
                  {isEditMode ? (
                    <>
                      <li>Your updated listing will be resubmitted for review by the AYP Success Team.</li>
                      <li>Staff will re-verify your documents, financial data, and any changes you made.</li>
                      <li>Once approved, your listing will be published (or re-published) on the marketplace.</li>
                    </>
                  ) : (
                    <>
                      <li>Your listing will be submitted for review by the AYP Success Team.</li>
                      <li>Staff will verify your proof of lease, inventory, financial data, and property condition.</li>
                      <li>Once verified, your listing will be published on the AYP Marketplace.</li>
                    </>
                  )}
                  <li>Seller payouts are disbursed within 3 business days of the buyer's funds clearing.</li>
                  <li>AYP retains 20% of the Acquisition Fee. You receive 80%.</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            {createStep === 'documents' ? (
              <>
                <Button variant="outline" onClick={() => setCreateStep('details')}>
                  Back to Details
                </Button>
                {isEditMode ? (
                  <Button
                    onClick={handleResubmitListing}
                    disabled={submitting || loadingEditDocs}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <RotateCcw className="w-4 h-4 mr-2" /> Resubmit for Review
                    {totalUploadedFiles > 0 && <Badge className="ml-2 bg-white/20">{totalUploadedFiles} files</Badge>}
                  </Button>
                ) : (
                  <Button onClick={handleCreateListing} disabled={submitting} className="bg-[#d4a574] hover:bg-[#c49464]">
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Upload className="w-4 h-4 mr-2" /> Submit for Review
                    {totalUploadedFiles > 0 && <Badge className="ml-2 bg-white/20">{totalUploadedFiles} files</Badge>}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>Cancel</Button>
                <Button
                  onClick={() => {
                    // Validate step 1 before proceeding
                    if (!form.property_id) { toast({ title: 'Please select a property', variant: 'destructive' }); return; }
                    if (!form.asking_price || parseFloat(form.asking_price) <= 0) { toast({ title: 'Please enter a valid asking price', variant: 'destructive' }); return; }
                    if (!form.description) { toast({ title: 'Please add a description', variant: 'destructive' }); return; }
                    if (!form.inventory_list.trim()) { toast({ title: 'Please provide an inventory list', variant: 'destructive' }); return; }
                    setCreateStep('documents');
                  }}
                  className={isEditMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#d4a574] hover:bg-[#c49464]'}
                >
                  Next: {isEditMode ? 'Update Documents' : 'Upload Documents'} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Listing Detail / Document View Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" /> Listing Details
            </DialogTitle>
            {selectedListing && (
              <DialogDescription>
                {selectedListing.property
                  ? `${selectedListing.property.address}, ${selectedListing.property.city}, ${selectedListing.property.state}`
                  : 'Property Details'
                }
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedListing && (
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="documents" className="flex-1">
                  Documents
                  {((selectedListing.proof_of_lease_urls?.length || 0) + (selectedListing.financial_data_urls?.length || 0) + (selectedListing.property_photo_urls?.length || 0)) > 0 && (
                    <Badge className="ml-2 bg-[#d4a574] text-white text-xs">
                      {(selectedListing.proof_of_lease_urls?.length || 0) + (selectedListing.financial_data_urls?.length || 0) + (selectedListing.property_photo_urls?.length || 0)}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                {/* Changes Requested Banner in Detail View */}
                {selectedListing.status === 'needs_changes' && selectedListing.changes_requested && (
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <MessageSquareWarning className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-orange-800 text-sm">Staff Requested Changes</p>
                        <p className="text-sm text-orange-700 mt-1 whitespace-pre-wrap">{selectedListing.changes_requested}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="mt-3 bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => {
                        setShowDetailModal(false);
                        handleEditListing(selectedListing);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-1" /> Edit & Resubmit
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Asking Price</p>
                    <p className="text-xl font-bold">${selectedListing.asking_price?.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-green-600">Your Net (80%)</p>
                    <p className="text-xl font-bold text-green-700">${Math.round(selectedListing.asking_price * 0.8).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedListing.projected_monthly_revenue && (
                    <div><span className="text-muted-foreground">Monthly Revenue:</span> <span className="font-medium">${selectedListing.projected_monthly_revenue.toLocaleString()}</span></div>
                  )}
                  {selectedListing.adr && (
                    <div><span className="text-muted-foreground">ADR:</span> <span className="font-medium">${selectedListing.adr}</span></div>
                  )}
                  {selectedListing.occupancy_rate && (
                    <div><span className="text-muted-foreground">Occupancy:</span> <span className="font-medium">{selectedListing.occupancy_rate}%</span></div>
                  )}
                  {selectedListing.monthly_rent && (
                    <div><span className="text-muted-foreground">Monthly Rent:</span> <span className="font-medium">${selectedListing.monthly_rent.toLocaleString()}</span></div>
                  )}
                  {selectedListing.lease_months_remaining && (
                    <div><span className="text-muted-foreground">Lease Remaining:</span> <span className="font-medium">{selectedListing.lease_months_remaining} months</span></div>
                  )}
                  <div><span className="text-muted-foreground">Furnished:</span> <span className="font-medium">{selectedListing.is_furnished ? 'Yes' : 'No'}</span></div>
                </div>

                {selectedListing.description && (
                  <div>
                    <p className="text-sm font-medium mb-1">Description</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedListing.description}</p>
                  </div>
                )}

                {selectedListing.inventory_list && (
                  <div>
                    <p className="text-sm font-medium mb-1">Inventory List</p>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 whitespace-pre-wrap">{selectedListing.inventory_list}</div>
                  </div>
                )}

                {selectedListing.video_walkthrough_url && (
                  <div>
                    <p className="text-sm font-medium mb-1">Video Walkthrough</p>
                    <a href={selectedListing.video_walkthrough_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <Video className="w-4 h-4" /> {selectedListing.video_walkthrough_url}
                    </a>
                  </div>
                )}

                {selectedListing.resubmit_count && selectedListing.resubmit_count > 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 pt-2 border-t">
                    <RotateCcw className="w-3 h-3" /> Resubmitted {selectedListing.resubmit_count} time{selectedListing.resubmit_count > 1 ? 's' : ''}
                    {selectedListing.resubmitted_at && ` — Last resubmitted ${new Date(selectedListing.resubmitted_at).toLocaleDateString()}`}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-4 mt-4">
                {loadingDocs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" />
                  </div>
                ) : (
                  <>
                    {detailLeaseFiles.length === 0 && detailFinancialFiles.length === 0 && detailPhotoFiles.length === 0 ? (
                      <div className="text-center py-8">
                        <Paperclip className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-500">No documents uploaded for this listing yet.</p>
                        {selectedListing.status === 'needs_changes' && (
                          <Button
                            size="sm"
                            className="mt-3 bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={() => {
                              setShowDetailModal(false);
                              handleEditListing(selectedListing);
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-1" /> Edit & Add Documents
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        {detailLeaseFiles.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-red-500" /> Proof of Lease ({detailLeaseFiles.length})
                            </h4>
                            <div className="space-y-2">
                              {detailLeaseFiles.map((f, i) => (
                                <a key={i} href={f.signed_url || '#'} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                  {f.is_image && f.signed_url ? (
                                    <img src={f.signed_url} alt={f.name} className="w-10 h-10 object-cover rounded" />
                                  ) : (
                                    <FileText className="w-5 h-5 text-red-500" />
                                  )}
                                  <span className="text-sm font-medium flex-1 truncate">{f.name}</span>
                                  <Eye className="w-4 h-4 text-gray-400" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {detailFinancialFiles.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-green-500" /> Financial Documents ({detailFinancialFiles.length})
                            </h4>
                            <div className="space-y-2">
                              {detailFinancialFiles.map((f, i) => (
                                <a key={i} href={f.signed_url || '#'} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                  {f.is_image && f.signed_url ? (
                                    <img src={f.signed_url} alt={f.name} className="w-10 h-10 object-cover rounded" />
                                  ) : (
                                    <FileSpreadsheet className="w-5 h-5 text-green-500" />
                                  )}
                                  <span className="text-sm font-medium flex-1 truncate">{f.name}</span>
                                  <Eye className="w-4 h-4 text-gray-400" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {detailPhotoFiles.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Image className="w-4 h-4 text-blue-500" /> Property Photos ({detailPhotoFiles.length})
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                              {detailPhotoFiles.map((f, i) => (
                                <a key={i} href={f.signed_url || '#'} target="_blank" rel="noopener noreferrer"
                                  className="block aspect-square rounded-lg overflow-hidden border hover:border-[#d4a574] transition-colors">
                                  <img
                                    src={f.signed_url || ''}
                                    alt={f.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '';
                                      (e.target as HTMLImageElement).className = 'hidden';
                                    }}
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="flex justify-between">
            {selectedListing?.status === 'needs_changes' && (
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => {
                  setShowDetailModal(false);
                  handleEditListing(selectedListing);
                }}
              >
                <Pencil className="w-4 h-4 mr-1" /> Edit & Resubmit
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
