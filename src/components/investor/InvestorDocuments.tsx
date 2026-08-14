import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, FileText, Download, Eye, CheckCircle, Clock, 
  Upload, AlertCircle, FolderOpen, FileSignature,
  Calculator, Shield, ChevronDown, ChevronRight, 
  RefreshCw, ExternalLink, User, Calendar, PenTool,
  BookOpen, ScrollText, Briefcase, Bell
} from 'lucide-react';

interface Props { 
  investorId: string;
  investorName?: string;
  onNavigateToSigning?: () => void;
}

interface StaffDocument {
  id: string;
  investor_id: string;
  document_name: string;
  document_type: string;
  document_url?: string;
  file_path?: string;
  status?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  created_at: string;
  notes?: string;
  has_file?: boolean;
  can_download?: boolean;
}

interface SignatureDocument {
  id: string;
  document_name: string;
  document_type: string;
  signature_status: string;
  sent_by?: string;
  expires_at?: string;
  created_at: string;
  signed_at?: string;
}

interface SavedQuote {
  id: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  total_estimate?: number;
  created_at: string;
}

const DOC_TYPE_GROUPS: Record<string, { label: string; icon: typeof FileText; color: string; bgColor: string; types: string[] }> = {
  agreements: {
    label: 'Agreements & Contracts',
    icon: FileSignature,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    types: ['agreement', 'contract', 'acquisition_agreement', 'corporate_agreement', 'third_party_seller', 'sublease']
  },
  leases: {
    label: 'Leases',
    icon: ScrollText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    types: ['lease', 'sublease_agreement', 'master_lease', 'lease_addendum']
  },
  guides: {
    label: 'Guides & Resources',
    icon: BookOpen,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    types: ['guide', 'resource', 'manual', 'handbook', 'tutorial', 'onboarding']
  },
  other: {
    label: 'Other Documents',
    icon: Briefcase,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    types: ['other', 'misc', 'report', 'invoice', 'receipt', 'tax', 'insurance']
  }
};

function getDocGroup(docType: string): string {
  const normalized = (docType || '').toLowerCase().replace(/[_-]/g, ' ');
  for (const [groupKey, group] of Object.entries(DOC_TYPE_GROUPS)) {
    if (group.types.some(t => normalized.includes(t))) return groupKey;
  }
  if (normalized.includes('agree') || normalized.includes('contract')) return 'agreements';
  if (normalized.includes('lease')) return 'leases';
  if (normalized.includes('guide') || normalized.includes('resource')) return 'guides';
  return 'other';
}

function getTypeBadge(docType: string) {
  const group = getDocGroup(docType);
  const label = (docType || 'Document').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const colorMap: Record<string, string> = {
    agreements: 'bg-blue-100 text-blue-700',
    leases: 'bg-purple-100 text-purple-700',
    guides: 'bg-green-100 text-green-700',
    other: 'bg-gray-100 text-gray-700'
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[group] || colorMap.other}`}>
      {label}
    </span>
  );
}

export function InvestorDocuments({ investorId, investorName, onNavigateToSigning }: Props) {
  const [staffDocuments, setStaffDocuments] = useState<StaffDocument[]>([]);
  const [signatureDocuments, setSignatureDocuments] = useState<SignatureDocument[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [newDocCount, setNewDocCount] = useState(0);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const lastDocCountRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => { 
    fetchAllDocuments(); 

    // Set up polling every 30 seconds for new documents
    pollIntervalRef.current = setInterval(() => {
      pollForNewDocuments();
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [investorId]);

  const pollForNewDocuments = async () => {
    try {
      // Quick count check - try edge function first, then direct DB
      let currentCount: number | null = null;

      try {
        const { data } = await supabase.functions.invoke('manage-investor-documents', {
          body: { action: 'count', investor_id: investorId }
        });
        if (data?.success && typeof data.count === 'number') {
          currentCount = data.count;
        }
      } catch {}

      // The direct database fallback that used to sit here has been removed. Signed
      // agreements carry client names and terms, so the browser no longer has read access
      // to that table: every call 401'd and put a red error in the console on a tab that
      // was otherwise working. A fallback that cannot succeed is not a fallback.
      //
      // If the count is unknown we leave it unknown rather than showing zero. Zero
      // documents and "we could not check" are different things, and only one of them
      // should make a "new document" badge disappear.

      if (currentCount !== null && currentCount > lastDocCountRef.current && lastDocCountRef.current > 0) {
        const newCount = currentCount - lastDocCountRef.current;
        setNewDocCount(newCount);
        toast({
          title: 'New Document Available',
          description: `${newCount} new document${newCount > 1 ? 's have' : ' has'} been uploaded to your portal.`,
        });
        // Auto-refresh
        fetchStaffDocumentsOnly();
      }
      if (currentCount !== null) {
        lastDocCountRef.current = currentCount;
      }
    } catch {
      // Silent fail for polling
    }
  };

  const fetchStaffDocumentsOnly = async () => {
    const docs = await fetchStaffDocuments();
    setStaffDocuments(docs);
    setNewDocCount(0);
    setLastRefreshed(new Date());
  };

  const fetchAllDocuments = async () => {
    setLoading(true);
    try {
      const [staffDocsResult, sigDocsResult, quotesResult] = await Promise.allSettled([
        fetchStaffDocuments(),
        fetchSignatureDocuments(),
        fetchSavedQuotes()
      ]);

      if (staffDocsResult.status === 'fulfilled') {
        setStaffDocuments(staffDocsResult.value);
        lastDocCountRef.current = staffDocsResult.value.length;
      }
      if (sigDocsResult.status === 'fulfilled') setSignatureDocuments(sigDocsResult.value);
      if (quotesResult.status === 'fulfilled') setSavedQuotes(quotesResult.value);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
    setLoading(false);
  };

  const fetchStaffDocuments = async (): Promise<StaffDocument[]> => {
    // Approach 1: manage-investor-documents edge function (enhanced v2.0)
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-documents', { 
        body: { action: 'list', investor_id: investorId } 
      });
      if (!error && data?.success && data?.documents && Array.isArray(data.documents) && data.documents.length > 0) {
        console.log('[InvestorDocuments] Fetched via manage-investor-documents v2.0:', data.documents.length);
        return data.documents;
      }
      // If success but empty, still return empty (don't try fallbacks for genuinely empty results)
      if (!error && data?.success && data?.documents && data.documents.length === 0) {
        console.log('[InvestorDocuments] manage-investor-documents returned 0 documents (confirmed empty)');
        // Still try other approaches in case the edge function has a different view of the data
      }
    } catch (err) {
      console.warn('[InvestorDocuments] manage-investor-documents failed:', err);
    }
    
    // Approach 2: manage-investor-admin get_investor
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'get_investor', investor_id: investorId }
      });
      if (!error && data?.documents && Array.isArray(data.documents) && data.documents.length > 0) {
        console.log('[InvestorDocuments] Fetched via manage-investor-admin:', data.documents.length);
        return data.documents;
      }
    } catch (err) {
      console.warn('[InvestorDocuments] manage-investor-admin failed:', err);
    }
    
    // Approach 3: Direct database query
    try {
      const { data, error } = await supabase
        .from('investor_documents')
        .select('*')
        .eq('investor_id', investorId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        console.log('[InvestorDocuments] Fetched via direct DB:', data.length);
        return data;
      }
    } catch (err) {
      console.warn('[InvestorDocuments] Direct DB query failed:', err);
    }

    console.log('[InvestorDocuments] No documents found from any source');
    return [];
  };

  const fetchSignatureDocuments = async (): Promise<SignatureDocument[]> => {
    // Try edge function first
    try {
      const { data, error } = await supabase.functions.invoke('manage-document-signatures', {
        body: { action: 'get_documents', investor_id: investorId }
      });
      if (!error && data?.documents && Array.isArray(data.documents)) return data.documents;
    } catch {}
    
    // Fallback: direct query
    try {
      const { data } = await supabase
        .from('document_signatures')
        .select('*')
        .eq('investor_id', investorId)
        .order('created_at', { ascending: false });
      return data || [];
    } catch {
      return [];
    }
  };

  const fetchSavedQuotes = async (): Promise<SavedQuote[]> => {
    try {
      const { data } = await supabase.functions.invoke('investor-login', { 
        body: { action: 'get_saved_quotes', investor_id: investorId } 
      });
      return data?.quotes || [];
    } catch {
      return [];
    }
  };

  /**
   * Get a working download/view URL for a document.
   * Uses the enhanced manage-investor-documents v2.0 edge function with multiple fallbacks.
   * The investor-documents bucket is PRIVATE so we need signed URLs.
   */
  const getDocumentUrl = async (doc: StaffDocument): Promise<string | null> => {
    // 1. If document_url is a full HTTPS URL that's NOT a Supabase storage URL, use it directly
    if (doc.document_url && doc.document_url.trim() !== '') {
      const url = doc.document_url.trim();
      if (url.startsWith('http') && !url.includes('/storage/v1/') && !url.includes('supabase')) {
        return url;
      }
    }

    // 2. Try the enhanced edge function download action (supports both file_path and document_id)
    if (doc.file_path || doc.id) {
      try {
        const { data, error } = await supabase.functions.invoke('manage-investor-documents', { 
          body: { 
            action: 'download', 
            file_path: doc.file_path || undefined,
            document_id: doc.file_path ? undefined : doc.id 
          } 
        });
        if (!error && data?.success && data?.url) {
          console.log('[InvestorDocuments] Got signed URL via edge function download action');
          return data.url;
        }
        if (data?.error) {
          console.warn('[InvestorDocuments] Edge function download error:', data.error);
        }
      } catch (err) {
        console.warn('[InvestorDocuments] Edge function download failed:', err);
      }
    }

    // 3. Try direct signed URL generation from Supabase client (requires service role or storage policy)
    if (doc.file_path) {
      try {
        const { data, error } = await supabase.storage
          .from('investor-documents')
          .createSignedUrl(doc.file_path, 3600);
        if (!error && data?.signedUrl) {
          console.log('[InvestorDocuments] Got signed URL via direct storage client');
          return data.signedUrl;
        }
      } catch {}
    }

    // 4. Try to extract file_path from document_url if it's a storage URL
    if (doc.document_url && doc.document_url.includes('investor-documents')) {
      try {
        const urlParts = doc.document_url.split('investor-documents/');
        if (urlParts.length > 1) {
          const extractedPath = decodeURIComponent(urlParts[1].split('?')[0]);
          
          // Try edge function with extracted path
          try {
            const { data } = await supabase.functions.invoke('manage-investor-documents', { 
              body: { action: 'download', file_path: extractedPath } 
            });
            if (data?.success && data?.url) {
              console.log('[InvestorDocuments] Got signed URL from extracted path via edge function');
              return data.url;
            }
          } catch {}

          // Try direct signed URL with extracted path
          const { data, error } = await supabase.storage
            .from('investor-documents')
            .createSignedUrl(extractedPath, 3600);
          if (!error && data?.signedUrl) {
            console.log('[InvestorDocuments] Got signed URL from extracted path');
            return data.signedUrl;
          }
        }
      } catch {}
    }

    // 5. Last resort: if document_url exists and is a regular URL, try it
    if (doc.document_url && doc.document_url.trim() !== '' && doc.document_url.startsWith('http')) {
      return doc.document_url;
    }

    return null;
  };

  const handleViewDocument = async (doc: StaffDocument) => {
    setDownloadingDoc(doc.id);
    try {
      const url = await getDocumentUrl(doc);
      if (url) {
        window.open(url, '_blank');
      } else {
        toast({ 
          title: 'No File Available', 
          description: 'This document does not have a viewable file attached. Please contact your Success Team.', 
          variant: 'destructive' 
        });
      }
    } catch (err) {
      console.error('Error viewing document:', err);
      toast({ title: 'Error', description: 'Failed to open document. Please try again.', variant: 'destructive' });
    }
    setDownloadingDoc(null);
  };

  const handleDownloadDocument = async (doc: StaffDocument) => {
    setDownloadingDoc(doc.id);
    try {
      const url = await getDocumentUrl(doc);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.document_name || 'document';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: 'Download Started', description: `Downloading ${doc.document_name}` });
      } else {
        toast({ 
          title: 'No File Available', 
          description: 'This document does not have a downloadable file. Please contact your Success Team.', 
          variant: 'destructive' 
        });
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      toast({ title: 'Download Failed', description: 'Please try again or contact support.', variant: 'destructive' });
    }
    setDownloadingDoc(null);
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const groupedDocs: Record<string, StaffDocument[]> = {};
  staffDocuments.forEach(doc => {
    const group = getDocGroup(doc.document_type);
    if (!groupedDocs[group]) groupedDocs[group] = [];
    groupedDocs[group].push(doc);
  });

  const pendingSignatures = signatureDocuments.filter(d => 
    d.signature_status === 'pending' || d.signature_status === 'viewed'
  );
  const signedDocuments = signatureDocuments.filter(d => d.signature_status === 'signed');
  const totalDocs = staffDocuments.length;
  const totalPendingSigs = pendingSignatures.length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Document Center</h1>
          <p className="text-sm text-gray-500">
            View, download, and manage all your documents
            {totalDocs > 0 && <span className="ml-1">({totalDocs} document{totalDocs !== 1 ? 's' : ''})</span>}
          </p>
          {lastRefreshed && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last refreshed: {lastRefreshed.toLocaleTimeString()} · Auto-checks every 30s
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {newDocCount > 0 && (
            <Badge className="bg-green-500 animate-pulse cursor-pointer" onClick={fetchStaffDocumentsOnly}>
              <Bell className="w-3 h-3 mr-1" />
              {newDocCount} New
            </Badge>
          )}
          {totalPendingSigs > 0 && (
            <Badge variant="destructive" className="text-sm">
              {totalPendingSigs} Signature{totalPendingSigs !== 1 ? 's' : ''} Required
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => { fetchAllDocuments(); setNewDocCount(0); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Pending Signatures Alert */}
      {pendingSignatures.length > 0 && (
        <Card className="border-yellow-300 bg-gradient-to-r from-yellow-50 to-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
              <PenTool className="w-5 h-5" />
              Documents Awaiting Your Signature
            </CardTitle>
            <CardDescription className="text-yellow-700">
              Please review and sign these documents to proceed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSignatures.map(doc => {
              const isExpiring = doc.expires_at && new Date(doc.expires_at).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
              return (
                <div key={doc.id}
                  className={`flex items-center justify-between p-4 bg-white rounded-lg border ${isExpiring ? 'border-red-300 ring-1 ring-red-100' : 'border-yellow-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isExpiring ? 'bg-red-100' : 'bg-yellow-100'}`}>
                      <FileSignature className={`w-5 h-5 ${isExpiring ? 'text-red-600' : 'text-yellow-600'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{doc.document_name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        {doc.sent_by && <span className="flex items-center gap-1"><User className="w-3 h-3" />Sent by {doc.sent_by}</span>}
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                      {doc.expires_at && (
                        <p className={`text-xs mt-1 font-medium ${isExpiring ? 'text-red-600' : 'text-gray-400'}`}>
                          {isExpiring ? 'Expiring soon - ' : ''}Expires {new Date(doc.expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={doc.signature_status === 'viewed' ? 'bg-blue-500' : 'bg-yellow-500'}>
                      {doc.signature_status === 'viewed' ? <><Eye className="w-3 h-3 mr-1" />Viewed</> : <><Clock className="w-3 h-3 mr-1" />Pending</>}
                    </Badge>
                    <Button size="sm" className="bg-[#d4a574] hover:bg-[#c49464]"
                      onClick={onNavigateToSigning || (() => toast({ title: 'Navigate to E-Signatures', description: 'Go to the E-Signatures tab to sign this document.' }))}>
                      <PenTool className="w-4 h-4 mr-1" />Sign Now
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Staff-Uploaded Documents */}
      {totalDocs > 0 ? (
        <div className="space-y-4">
          {Object.entries(DOC_TYPE_GROUPS).map(([groupKey, groupConfig]) => {
            const docs = groupedDocs[groupKey];
            if (!docs || docs.length === 0) return null;
            const isCollapsed = collapsedGroups[groupKey];
            const GroupIcon = groupConfig.icon;
            return (
              <Card key={groupKey}>
                <CardHeader className={`cursor-pointer hover:bg-gray-50 transition-colors pb-3 ${groupConfig.bgColor} rounded-t-lg`}
                  onClick={() => toggleGroup(groupKey)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-base flex items-center gap-2 ${groupConfig.color}`}>
                      <GroupIcon className="w-5 h-5" />
                      {groupConfig.label}
                      <Badge variant="secondary" className="ml-2 text-xs">{docs.length}</Badge>
                    </CardTitle>
                    {isCollapsed ? <ChevronRight className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {docs.map(doc => {
                        const hasFile = doc.can_download || doc.has_file || (doc.document_url && doc.document_url.trim() !== '') || !!doc.file_path;
                        const isDownloading = downloadingDoc === doc.id;
                        return (
                          <div key={doc.id} className="flex flex-col p-4 border rounded-lg hover:shadow-sm transition-shadow bg-white">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${groupConfig.bgColor} flex-shrink-0`}>
                                <FileText className={`w-5 h-5 ${groupConfig.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate" title={doc.document_name}>{doc.document_name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">{getTypeBadge(doc.document_type)}</div>
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(doc.created_at).toLocaleDateString()}</span>
                                  {(doc.uploaded_by || doc.uploaded_by_name) && (
                                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{doc.uploaded_by_name || doc.uploaded_by}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                              {hasFile ? (
                                <>
                                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleViewDocument(doc)} disabled={isDownloading}>
                                    {isDownloading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5 mr-1" />}
                                    View
                                  </Button>
                                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDownloadDocument(doc)} disabled={isDownloading}>
                                    {isDownloading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                                    Download
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 italic">No file attached - contact your Success Team</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        pendingSignatures.length === 0 && signedDocuments.length === 0 && savedQuotes.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <FolderOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="font-medium text-lg">No Documents Yet</p>
              <p className="text-sm mt-2">Documents from your Success Team will appear here as you progress through your acquisitions.</p>
              <p className="text-xs mt-4 text-gray-400">This page automatically checks for new documents every 30 seconds.</p>
            </CardContent>
          </Card>
        )
      )}

      {/* Signed Agreements */}
      {signedDocuments.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-3" onClick={() => toggleGroup('signed_agreements')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />Signed Agreements
                <Badge variant="secondary" className="ml-2 text-xs">{signedDocuments.length}</Badge>
              </CardTitle>
              {collapsedGroups['signed_agreements'] ? <ChevronRight className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </CardHeader>
          {!collapsedGroups['signed_agreements'] && (
            <CardContent>
              <div className="space-y-2">
                {signedDocuments.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <FileSignature className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">{doc.document_name}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>Signed {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString() : 'N/A'}</span>
                          {doc.sent_by && <span>from {doc.sent_by}</span>}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Signed</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Saved Quotes */}
      {savedQuotes.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-3" onClick={() => toggleGroup('saved_quotes')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-600">
                <Calculator className="w-5 h-5" />Saved Setup Quotes
                <Badge variant="secondary" className="ml-2 text-xs">{savedQuotes.length}</Badge>
              </CardTitle>
              {collapsedGroups['saved_quotes'] ? <ChevronRight className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </CardHeader>
          {!collapsedGroups['saved_quotes'] && (
            <CardContent>
              <div className="space-y-2">
                {savedQuotes.map((quote, idx) => (
                  <div key={quote.id || idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{quote.property_type || 'Property'} Setup Quote</p>
                      <p className="text-sm text-gray-500">{quote.bedrooms} bed / {quote.bathrooms} bath</p>
                      <p className="text-xs text-gray-400">Created {new Date(quote.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">${quote.total_estimate?.toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-500">Estimated Total</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Legal Documents */}
      <Card>
        <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-3" onClick={() => toggleGroup('legal')}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-purple-600">
              <Shield className="w-5 h-5" />Legal Documents
            </CardTitle>
            {collapsedGroups['legal'] ? <ChevronRight className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>
        </CardHeader>
        {!collapsedGroups['legal'] && (
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <ScrollText className="w-5 h-5 text-purple-600" />
                  <div><p className="font-medium">Terms of Service</p><p className="text-sm text-gray-500">Last updated: January 2026</p></div>
                </div>
                <Button size="sm" variant="outline" onClick={() => window.open('/terms-of-service', '_blank')}>
                  <Eye className="w-4 h-4 mr-1" />View
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <div><p className="font-medium">Privacy Policy</p><p className="text-sm text-gray-500">Last updated: January 2026</p></div>
                </div>
                <Button size="sm" variant="outline" onClick={() => window.open('/privacy-policy', '_blank')}>
                  <Eye className="w-4 h-4 mr-1" />View
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
