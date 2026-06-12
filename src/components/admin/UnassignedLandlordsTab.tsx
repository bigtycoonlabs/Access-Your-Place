import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Building, UserCheck, Clock, Phone, Mail, MapPin, Search, RefreshCw,
  ChevronDown, ChevronUp, FileText, Upload, Users, AlertCircle, CheckCircle,
  Send, Eye, Home, Globe, X, Loader2, Paperclip, File
} from 'lucide-react';

interface LandlordAccount {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  phone?: string;
  account_type?: string;
  status?: string;
  assigned_am_id?: string;
  assigned_am_name?: string;
  discovery_call_completed?: boolean;
  location?: string;
  unit_count?: number;
  property_type?: string;
  created_at: string;
}

interface Props {
  staffId?: string;
  staffName?: string;
}

export function UnassignedLandlordsTab({ staffId, staffName }: Props) {
  const [unassigned, setUnassigned] = useState<LandlordAccount[]>([]);
  const [allLandlords, setAllLandlords] = useState<LandlordAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'unassigned' | 'all'>('unassigned');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [showAppUpload, setShowAppUpload] = useState<string | null>(null);
  const [appForm, setAppForm] = useState({ client_name: '', client_business_name: '', community_name: '', unit_number: '' });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [submittingApp, setSubmittingApp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { fetchLandlords(); }, []);

  const fetchLandlords = async () => {
    setLoading(true);
    try {
      const [unassignedRes, allRes] = await Promise.all([
        supabase.functions.invoke('manage-landlord-portal', { body: { action: 'get_unassigned_landlords' } }),
        supabase.functions.invoke('manage-landlord-portal', { body: { action: 'get_all_portal_landlords' } })
      ]);
      if (unassignedRes.data?.landlords) setUnassigned(unassignedRes.data.landlords);
      if (allRes.data?.landlords) setAllLandlords(allRes.data.landlords);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleAssign = async (landlordId: string) => {
    setAssigningId(landlordId);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'assign_landlord',
          landlord_id: landlordId,
          am_id: staffId || 'staff',
          am_name: staffName || 'Acquisition Manager'
        }
      });
      if (data?.success) {
        toast({ title: 'Landlord Assigned', description: `Landlord verified and assigned to ${staffName || 'you'}.` });
        fetchLandlords();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to assign landlord', variant: 'destructive' });
    }
    setAssigningId(null);
  };

  const handleSubmitApplication = async (landlordId: string) => {
    if (!appForm.client_name) {
      toast({ title: 'Error', description: 'Client name is required', variant: 'destructive' });
      return;
    }
    setSubmittingApp(true);

    let pdfUrl = '';
    let pdfFilename = '';

    // Upload PDF if one is selected
    if (pdfFile) {
      setUploadingPdf(true);
      try {
        const timestamp = Date.now();
        const sanitizedName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `corporate-applications/${landlordId}/${timestamp}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('seller-documents')
          .upload(filePath, pdfFile, {
            contentType: pdfFile.type || 'application/pdf',
            upsert: false
          });

        if (uploadError) {
          console.error('PDF upload error:', uploadError);
          toast({ title: 'PDF Upload Failed', description: uploadError.message, variant: 'destructive' });
          setSubmittingApp(false);
          setUploadingPdf(false);
          return;
        }

        // Get the public URL (seller-documents is private, so we use createSignedUrl or just store the path)
        // Since seller-documents is private, store the path and generate signed URLs on demand
        const { data: signedData } = await supabase.storage
          .from('seller-documents')
          .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year signed URL

        pdfUrl = signedData?.signedUrl || filePath;
        pdfFilename = pdfFile.name;
      } catch (err: any) {
        console.error('PDF upload error:', err);
        toast({ title: 'PDF Upload Failed', description: err?.message || 'Failed to upload PDF', variant: 'destructive' });
        setSubmittingApp(false);
        setUploadingPdf(false);
        return;
      }
      setUploadingPdf(false);
    }

    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'submit_application',
          landlord_id: landlordId,
          client_name: appForm.client_name,
          client_business_name: appForm.client_business_name,
          community_name: appForm.community_name,
          unit_number: appForm.unit_number,
          pdf_url: pdfUrl || undefined,
          pdf_filename: pdfFilename || undefined,
          submitted_by: staffName || 'Staff',
          submitted_by_id: staffId
        }
      });
      if (data?.success) {
        toast({ title: 'Application Submitted', description: 'The landlord has been notified via email.' });
        setShowAppUpload(null);
        setAppForm({ client_name: '', client_business_name: '', community_name: '', unit_number: '' });
        setPdfFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to submit application', variant: 'destructive' });
    }
    setSubmittingApp(false);
  };

  const handleReviewProperty = async (propertyId: string, status: string, reason?: string) => {
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'review_property',
          property_id: propertyId,
          submission_status: status,
          rejection_reason: reason,
          reviewed_by: staffName || 'Staff'
        }
      });
      if (data?.success) {
        toast({ title: 'Property Reviewed', description: `Property ${status === 'approved' ? 'approved for marketplace' : 'rejected'}.` });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to review property', variant: 'destructive' });
    }
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Invalid File', description: 'Please select a PDF file', variant: 'destructive' });
        return;
      }
      if (file.size > 25 * 1024 * 1024) { // 25MB limit
        toast({ title: 'File Too Large', description: 'PDF must be under 25MB', variant: 'destructive' });
        return;
      }
      setPdfFile(file);
    }
  };

  const displayList = viewMode === 'unassigned' ? unassigned : allLandlords;
  const filtered = displayList.filter(l =>
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1a365d]">Landlord Operations</h2>
          <p className="text-sm text-gray-600">Manage landlord sign-ups, assignments, and corporate applications</p>
        </div>
        <button onClick={fetchLandlords} className="text-sm text-gray-500 hover:text-[#d4a574] flex items-center gap-1">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-gray-500">Unassigned</span>
          </div>
          <div className="text-2xl font-bold text-[#1a365d]">{unassigned.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500">Total Portal Users</span>
          </div>
          <div className="text-2xl font-bold text-[#1a365d]">{allLandlords.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500">Verified</span>
          </div>
          <div className="text-2xl font-bold text-[#1a365d]">{allLandlords.filter(l => l.status === 'verified' || l.status === 'active').length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500">Mgmt Companies</span>
          </div>
          <div className="text-2xl font-bold text-[#1a365d]">{allLandlords.filter(l => l.account_type === 'management_company').length}</div>
        </div>
      </div>

      {/* View Toggle & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('unassigned')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'unassigned' ? 'bg-white shadow-sm text-[#1a365d]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Unassigned ({unassigned.length})
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'all' ? 'bg-white shadow-sm text-[#1a365d]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All Landlords ({allLandlords.length})
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search landlords..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Landlord List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            {viewMode === 'unassigned' ? 'No Unassigned Landlords' : 'No Landlords Found'}
          </h3>
          <p className="text-gray-400">
            {viewMode === 'unassigned' ? 'All landlord sign-ups have been assigned.' : 'No landlords match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(landlord => (
            <div key={landlord.id} className="bg-white rounded-xl border border-gray-200 hover:border-[#d4a574]/30 transition-all overflow-hidden">
              {/* Row */}
              <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === landlord.id ? null : landlord.id)}>
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    landlord.status === 'pending_verification' ? 'bg-yellow-100' : 'bg-green-100'
                  }`}>
                    <Building className={`w-5 h-5 ${landlord.status === 'pending_verification' ? 'text-yellow-600' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1a365d]">{landlord.name}</h3>
                      {landlord.account_type === 'management_company' && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Mgmt Co.</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-0.5">
                      {landlord.company_name && <span>{landlord.company_name}</span>}
                      {landlord.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{landlord.email}</span>}
                      {landlord.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{landlord.location}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    landlord.status === 'pending_verification' ? 'bg-yellow-100 text-yellow-700' :
                    landlord.status === 'verified' ? 'bg-green-100 text-green-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {landlord.status === 'pending_verification' ? 'Pending' : landlord.status || 'Active'}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(landlord.created_at).toLocaleDateString()}</span>
                  {expandedId === landlord.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </div>

              {/* Expanded Actions */}
              {expandedId === landlord.id && (
                <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Details */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Details</h4>
                      <div className="space-y-2 text-sm">
                        {landlord.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" />{landlord.phone}</div>}
                        {landlord.property_type && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-gray-400" />{landlord.property_type.replace('_', ' ')}</div>}
                        {landlord.unit_count && <div className="flex items-center gap-2"><Building className="w-4 h-4 text-gray-400" />{landlord.unit_count} units</div>}
                        {landlord.assigned_am_name && <div className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-green-500" />Assigned to: {landlord.assigned_am_name}</div>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Actions</h4>
                      <div className="space-y-2">
                        {!landlord.assigned_am_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAssign(landlord.id); }}
                            disabled={assigningId === landlord.id}
                            className="w-full bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <UserCheck className="w-4 h-4" />
                            {assigningId === landlord.id ? 'Assigning...' : 'Verify & Assign to Me'}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowAppUpload(showAppUpload === landlord.id ? null : landlord.id); setPdfFile(null); }}
                          className="w-full bg-[#d4a574] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#c49564] transition-colors flex items-center justify-center gap-2"
                        >
                          <Upload className="w-4 h-4" /> Submit Corporate Application
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); /* Send message */ }}
                          className="w-full border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <Send className="w-4 h-4" /> Send Message
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Application Upload Form */}
                  {showAppUpload === landlord.id && (
                    <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-[#1a365d] text-sm">Submit Corporate Application</h4>
                        <button onClick={() => { setShowAppUpload(null); setPdfFile(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
                          <input type="text" value={appForm.client_name} onChange={e => setAppForm({...appForm, client_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" placeholder="Full name of the client" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Business Name</label>
                          <input type="text" value={appForm.client_business_name} onChange={e => setAppForm({...appForm, client_business_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" placeholder="Client's business entity" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Community Name</label>
                          <input type="text" value={appForm.community_name} onChange={e => setAppForm({...appForm, community_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" placeholder="Apartment community name" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Unit Number</label>
                          <input type="text" value={appForm.unit_number} onChange={e => setAppForm({...appForm, unit_number: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#d4a574] focus:border-transparent" placeholder="e.g., 204, A-12" />
                        </div>
                      </div>

                      {/* PDF Upload Section */}
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Corporate Application PDF
                          <span className="text-gray-400 font-normal ml-1">(optional, max 25MB)</span>
                        </label>
                        <div className="relative">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handlePdfSelect}
                            className="hidden"
                            id={`pdf-upload-${landlord.id}`}
                          />
                          {pdfFile ? (
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-green-300 bg-green-50">
                              <File className="w-5 h-5 text-green-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-green-800 truncate">{pdfFile.name}</p>
                                <p className="text-xs text-green-600">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                className="text-green-600 hover:text-green-800 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label
                              htmlFor={`pdf-upload-${landlord.id}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:bg-gray-100 hover:border-[#d4a574] transition-colors"
                            >
                              <Paperclip className="w-5 h-5 text-gray-400" />
                              <span className="text-sm text-gray-500">Click to attach a PDF application document</span>
                            </label>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSubmitApplication(landlord.id)}
                        disabled={submittingApp || uploadingPdf}
                        className="bg-[#1a365d] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a365d]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {submittingApp || uploadingPdf ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {uploadingPdf ? 'Uploading PDF...' : 'Submitting...'}
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4" />
                            Submit Application & Notify Landlord
                          </>
                        )}
                      </button>
                      {pdfFile && (
                        <p className="text-xs text-gray-400 mt-2">
                          PDF will be uploaded to secure storage and attached to the notification email.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
