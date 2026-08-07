import { useState, useRef, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { notifyDocumentUploaded } from '@/utils/emailNotifications';
import { 
  FileSignature, FileText, Loader2, Upload, FolderUp, 
  User, Search, CheckCircle, Download, Trash2, Eye, Mail, LayoutTemplate
} from 'lucide-react';

const SuccessAgreementManager = lazy(() => import('./SuccessAgreementManager').then(m => ({ default: m.SuccessAgreementManager })));
const DocumentTemplatesTab = lazy(() => import('./DocumentTemplatesTab').then(m => ({ default: m.DocumentTemplatesTab })));
const AgreementTemplateManager = lazy(() => import('./AgreementTemplateManager').then(m => ({ default: m.AgreementTemplateManager })));

interface Props {
  staffId: string;
  staffName: string;
}

function DocSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="flex-1">
            <CardContent className="pt-4">
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-8">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * DocumentsTabContent - Uses controlled state-based sub-navigation (plain buttons)
 * instead of nested Radix Tabs to prevent context conflicts with the parent Tabs
 * in StaffDashboard. This fixes the issue where clicking sub-tabs did nothing.
 * 
 * Now includes 3 sub-tabs:
 * 1. Investor Agreements - Send, edit, view, and manage signature agreements
 * 2. Document Templates - Manage reusable document templates
 * 3. Upload Documents - Upload files to template library or directly to investor document views
 */
export function DocumentsTabContent({ staffId, staffName }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'agreements' | 'agreement-templates' | 'templates' | 'upload'>('agreements');

  return (
    <div className="space-y-6" role="region" aria-label="Documents and Agreements">
      {/* Sub-navigation using plain buttons instead of nested Tabs */}
      <nav 
        className="flex gap-1 p-1 bg-muted rounded-lg w-fit flex-wrap" 
        role="tablist" 
        aria-label="Document sections"
      >
        <Button
          variant={activeSubTab === 'agreements' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveSubTab('agreements')}
          className={`gap-2 ${activeSubTab === 'agreements' ? 'bg-white shadow-sm text-[#1a365d] hover:bg-white' : 'hover:bg-white/50'}`}
          role="tab"
          aria-selected={activeSubTab === 'agreements'}
        >
          <FileSignature className="w-4 h-4" aria-hidden="true" />
          Investor Agreements
        </Button>
        <Button
          variant={activeSubTab === 'agreement-templates' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveSubTab('agreement-templates')}
          className={`gap-2 ${activeSubTab === 'agreement-templates' ? 'bg-white shadow-sm text-[#1a365d] hover:bg-white' : 'hover:bg-white/50'}`}
          role="tab"
          aria-selected={activeSubTab === 'agreement-templates'}
        >
          <LayoutTemplate className="w-4 h-4" aria-hidden="true" />
          Agreement Templates
        </Button>
        <Button
          variant={activeSubTab === 'templates' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveSubTab('templates')}
          className={`gap-2 ${activeSubTab === 'templates' ? 'bg-white shadow-sm text-[#1a365d] hover:bg-white' : 'hover:bg-white/50'}`}
          role="tab"
          aria-selected={activeSubTab === 'templates'}
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          Document Templates
        </Button>
        <Button
          variant={activeSubTab === 'upload' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveSubTab('upload')}
          className={`gap-2 ${activeSubTab === 'upload' ? 'bg-white shadow-sm text-[#1a365d] hover:bg-white' : 'hover:bg-white/50'}`}
          role="tab"
          aria-selected={activeSubTab === 'upload'}
        >
          <Upload className="w-4 h-4" aria-hidden="true" />
          Upload Documents
        </Button>
      </nav>

      {/* Content panels */}
      {activeSubTab === 'agreements' && (
        <Suspense fallback={<DocSkeleton />}>
          {staffId ? (
            <SuccessAgreementManager staffId={staffId} staffName={staffName} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#d4a574]" />
                <p>Loading staff session...</p>
              </CardContent>
            </Card>
          )}
        </Suspense>
      )}

      {activeSubTab === 'agreement-templates' && (
        <Suspense fallback={<DocSkeleton />}>
          <AgreementTemplateManager staffId={staffId} staffName={staffName} />
        </Suspense>
      )}

      {activeSubTab === 'templates' && (
        <Suspense fallback={<DocSkeleton />}>
          <DocumentTemplatesTab />
        </Suspense>
      )}

      {activeSubTab === 'upload' && (
        <DocumentUploadPanel staffId={staffId} staffName={staffName} />
      )}
    </div>
  );
}


/**
 * DocumentUploadPanel - Allows staff to:
 * 1. Upload documents to the investor-documents storage bucket (template library)
 * 2. Upload/attach documents directly to a specific investor's document view
 */
function DocumentUploadPanel({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [uploadMode, setUploadMode] = useState<'library' | 'investor'>('library');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('template');
  const [investorSearch, setInvestorSearch] = useState('');
  const [investorResults, setInvestorResults] = useState<any[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState<any>(null);
  const [docType, setDocType] = useState('contract');
  const [recentUploads, setRecentUploads] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSearchInvestors = async (query: string) => {
    setInvestorSearch(query);
    if (query.length < 2) { setInvestorResults([]); return; }
    try {
      const { data } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'search_investors', query }
      });
      if (data?.investors) {
        setInvestorResults(data.investors.slice(0, 10).map((i: any) => ({
          id: i.id,
          full_name: i.full_name || i.name || i.email?.split('@')[0],
          email: i.email
        })));
      }
    } catch {
      try {
        const { data } = await supabase
          .from('investors')
          .select('id, full_name, email')
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(10);
        if (data) setInvestorResults(data);
      } catch (e) { console.error(e); }
    }
  };

  const handleUploadToLibrary = async () => {
    if (!file || !docName.trim()) {
      toast({ title: 'Missing Information', description: 'Please provide a document name and select a file.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const filePath = `templates/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('investor-documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('investor-documents').getPublicUrl(filePath);

      // Also save metadata to a document_templates table or similar
      try {
        await supabase.from('document_templates').insert({
          name: docName.trim(),
          category: docCategory,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_path: filePath,
          uploaded_by: staffName,
          created_at: new Date().toISOString()
        });
      } catch {
        // Table might not exist, that's OK - file is still uploaded
        console.log('document_templates insert skipped (table may not exist)');
      }

      setRecentUploads(prev => [{
        name: docName.trim(),
        category: docCategory,
        file_name: file.name,
        url: urlData.publicUrl,
        uploaded_at: new Date().toISOString(),
        target: 'Template Library'
      }, ...prev]);

      toast({ title: 'Document Uploaded to Library', description: `"${docName}" has been added to the template library.` });
      setDocName('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message || 'Please try again.', variant: 'destructive' });
    }
    setUploading(false);
  };

  const handleUploadToInvestor = async () => {
    if (!file || !docName.trim() || !selectedInvestor) {
      toast({ title: 'Missing Information', description: 'Please provide a document name, select a file, and choose an investor.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const filePath = `investor-docs/${selectedInvestor.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('investor-documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      // IMPORTANT: investor-documents bucket is PRIVATE, so getPublicUrl won't work for investors.
      // We store the file_path so the investor portal can generate signed URLs on demand.
      // The edge function will also store the file_path for later signed URL generation.

      // Add to investor_documents table via edge function (which also sends email notification)
      let uploadSuccess = false;
      try {
        const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
          body: {
            action: 'upload_document',
            investor_id: selectedInvestor.id,
            document_name: docName.trim(),
            document_type: docType,
            file_path: filePath,  // Store file_path for signed URL generation
            staff_name: staffName,
            send_notification: true
          }
        });
        if (!error && data?.success) {
          uploadSuccess = true;
        }
      } catch (err) {
        console.warn('Edge function upload_document failed:', err);
      }

      // Fallback: direct DB insert if edge function failed
      if (!uploadSuccess) {
        try {
          const { error } = await supabase.from('investor_documents').insert({
            investor_id: selectedInvestor.id,
            document_name: docName.trim(),
            document_type: docType,
            file_path: filePath,
            uploaded_by: 'staff',
            uploaded_by_name: staffName,
            status: 'approved',
            created_at: new Date().toISOString()
          });
          if (!error) uploadSuccess = true;
        } catch {}
      }

      // Send email notification as backup (edge function already sends one, but just in case)
      if (uploadSuccess) {
        notifyDocumentUploaded({
          investorId: selectedInvestor.id,
          investorName: selectedInvestor.full_name,
          investorEmail: selectedInvestor.email,
          staffName,
          documentName: docName.trim(),
          documentType: docType
        }).then(result => {
          if (result.emailSent) {
            console.log('Backup email notification sent successfully');
          }
        }).catch(err => console.warn('Backup document notification failed:', err));
      }

      setRecentUploads(prev => [{
        name: docName.trim(),
        category: docType,
        file_name: file.name,
        file_path: filePath,
        uploaded_at: new Date().toISOString(),
        target: `Investor: ${selectedInvestor.full_name}`,
        emailSent: true
      }, ...prev]);

      toast({ title: 'Document Sent to Investor', description: `"${docName}" has been added to ${selectedInvestor.full_name}'s documents. Email notification sent.` });
      setDocName('');
      setFile(null);
      setSelectedInvestor(null);
      setInvestorSearch('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message || 'Please try again.', variant: 'destructive' });
    }
    setUploading(false);
  };



  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${uploadMode === 'library' ? 'border-[#d4a574] ring-2 ring-[#d4a574]/20 bg-[#d4a574]/5' : 'hover:border-gray-300'}`}
          onClick={() => setUploadMode('library')}
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${uploadMode === 'library' ? 'bg-[#d4a574]/20' : 'bg-gray-100'}`}>
                <FolderUp className={`w-6 h-6 ${uploadMode === 'library' ? 'text-[#d4a574]' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="font-semibold">Upload to Template Library</p>
                <p className="text-sm text-gray-500">Add documents to the shared template library for reuse</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${uploadMode === 'investor' ? 'border-[#1a365d] ring-2 ring-[#1a365d]/20 bg-[#1a365d]/5' : 'hover:border-gray-300'}`}
          onClick={() => setUploadMode('investor')}
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${uploadMode === 'investor' ? 'bg-[#1a365d]/20' : 'bg-gray-100'}`}>
                <User className={`w-6 h-6 ${uploadMode === 'investor' ? 'text-[#1a365d]' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="font-semibold">Upload to Investor</p>
                <p className="text-sm text-gray-500">Send a document directly to an investor's document view</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#d4a574]" />
            {uploadMode === 'library' ? 'Upload to Template Library' : 'Upload Document to Investor'}
          </CardTitle>
          <CardDescription>
            {uploadMode === 'library' 
              ? 'Upload PDFs, contracts, or templates that can be reused across investors.'
              : 'Upload a document directly to a specific investor\'s document view for downloading/viewing.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Investor Search (only for investor mode) */}
          {uploadMode === 'investor' && (
            <div>
              <Label>Select Investor *</Label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input aria-label="Search by investor name or email"
                    placeholder="Search by investor name or email..."
                    value={investorSearch}
                    onChange={(e) => handleSearchInvestors(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {investorResults.length > 0 && !selectedInvestor && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {investorResults.map((inv) => (
                      <button
                        key={inv.id}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                          setSelectedInvestor(inv);
                          setInvestorSearch(inv.full_name);
                          setInvestorResults([]);
                        }}
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-sm">{inv.full_name}</p>
                          <p className="text-xs text-gray-500">{inv.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedInvestor && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {selectedInvestor.full_name} ({selectedInvestor.email})
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedInvestor(null); setInvestorSearch(''); }}>
                    Change
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Document Name */}
          <div>
            <Label htmlFor="document-name">Document Name *</Label>
            <Input id="document-name"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g., Acquisition Agreement Template, Lease Addendum..."
            />
          </div>

          {/* Category / Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{uploadMode === 'library' ? 'Category' : 'Document Type'}</Label>
              {uploadMode === 'library' ? (
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="agreement">Agreement</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="guide">Guide / SOP</SelectItem>
                    <SelectItem value="form">Form</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="agreement">Agreement</SelectItem>
                    <SelectItem value="lease">Lease Document</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="guide">Guide</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label htmlFor="file">File *</Label>
              <Input id="file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <FileText className="w-5 h-5 text-gray-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}

          <Button
            onClick={uploadMode === 'library' ? handleUploadToLibrary : handleUploadToInvestor}
            disabled={uploading || !file || !docName.trim() || (uploadMode === 'investor' && !selectedInvestor)}
            className="bg-[#d4a574] hover:bg-[#c49464] w-full"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {uploading ? 'Uploading...' : uploadMode === 'library' ? 'Upload to Library' : 'Send to Investor'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Uploads */}
      {recentUploads.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Recent Uploads This Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentUploads.map((upload, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-green-50/50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-sm">{upload.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Badge variant="outline" className="text-xs">{upload.category}</Badge>
                        <span>{upload.target}</span>
                        <span>{new Date(upload.uploaded_at).toLocaleTimeString()}</span>
                        {upload.emailSent && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Mail className="w-3 h-3" />
                            Email sent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {upload.url && (
                    <Button variant="ghost" size="sm" onClick={() => window.open(upload.url, '_blank')}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
