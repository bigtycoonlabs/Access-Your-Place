
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  FileText, Upload, Download, Trash2, Shield, Award, Receipt,
  Loader2, FolderOpen, Calendar
} from 'lucide-react';

interface ComplianceDoc {
  id: string;
  staff_id: string;
  doc_type: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
  year: number | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  notes: string | null;
  created_at: string;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ComplianceDocumentsProps {
  staffId: string;
  staffName: string;
  isAdmin: boolean;
}

const DOC_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  contractor_agreement: { label: 'Contractor Agreement', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  certification: { label: 'Certification', icon: Award, color: 'bg-emerald-100 text-emerald-700' },
  '1099': { label: '1099 Tax Form', icon: Receipt, color: 'bg-amber-100 text-amber-700' },
  w9: { label: 'W-9 Form', icon: FileText, color: 'bg-purple-100 text-purple-700' },
  nda: { label: 'NDA', icon: Shield, color: 'bg-red-100 text-red-700' },
  other: { label: 'Other', icon: FolderOpen, color: 'bg-gray-100 text-gray-700' },
};

export function ComplianceDocuments({ staffId, staffName, isAdmin }: ComplianceDocumentsProps) {
  const [documents, setDocuments] = useState<ComplianceDoc[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    staff_id: '', doc_type: '1099', title: '', year: new Date().getFullYear().toString(), notes: ''
  });
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [docsRes, staffRes] = await Promise.all([
      supabase.functions.invoke('manage-hr-commissions', {
        body: { action: 'get_compliance_docs', staff_id: staffId, is_admin: isAdmin }
      }),
      isAdmin ? supabase.functions.invoke('manage-hr-commissions', { body: { action: 'get_staff_list', staff_id: staffId, is_admin: isAdmin } }) : Promise.resolve({ data: null })
    ]);
    if (docsRes.data?.documents) {
      // Client-side safety filter: when not admin (e.g. AM), only show own documents
      // even if the edge function returns records for other staff (defense-in-depth)
      const docs = docsRes.data.documents as ComplianceDoc[];
      setDocuments(!isAdmin ? docs.filter(d => d.staff_id === staffId) : docs);
    }
    if (staffRes.data?.staff) setStaffList(staffRes.data.staff);
    setLoading(false);
  }, [staffId, isAdmin]);


  useEffect(() => { loadData(); }, [loadData]);

  const handleUpload = async () => {
    if (!uploadFile) {
      toast({ title: 'No File', description: 'Please select a file to upload.', variant: 'destructive' });
      return;
    }
    const targetStaffId = isAdmin ? (uploadForm.staff_id || staffId) : staffId;
    setUploading(true);

    try {
      const filePath = `compliance/${targetStaffId}/${Date.now()}-${uploadFile.name}`;
      const { error: storageError } = await supabase.storage.from('seller-documents').upload(filePath, uploadFile);
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from('seller-documents').getPublicUrl(filePath);

      const { error } = await supabase.functions.invoke('manage-hr-commissions', {
        body: {
          action: 'upload_compliance_doc',
          staff_id: targetStaffId,
          doc_type: uploadForm.doc_type,
          title: uploadForm.title || uploadFile.name,
          file_url: urlData.publicUrl,
          file_name: uploadFile.name,
          year: parseInt(uploadForm.year) || null,
          uploaded_by: staffId,
          uploaded_by_name: staffName,
          notes: uploadForm.notes
        }
      });
      if (error) throw error;

      toast({ title: 'Document Uploaded' });
      setShowUpload(false);
      setUploadFile(null);
      setUploadForm({ staff_id: '', doc_type: '1099', title: '', year: new Date().getFullYear().toString(), notes: '' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const handleDelete = async (docId: string) => {
    const { error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'delete_compliance_doc', staff_id: staffId, is_admin: isAdmin, doc_id: docId }
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Document Removed' });
      loadData();
    }
  };

  // Group documents by type
  const grouped = documents.reduce((acc, doc) => {
    const type = doc.doc_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, ComplianceDoc[]>);

  const contracts = [...(grouped.contractor_agreement || []), ...(grouped.nda || [])];
  const certifications = grouped.certification || [];
  const taxDocs = [...(grouped['1099'] || []), ...(grouped.w9 || [])];
  const otherDocs = grouped.other || [];

  return (
    <div className="space-y-6">
      {/* Upload Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-900">Compliance & Documents</h3>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Manage contracts, certifications, and tax documents for all staff' : 'View your contracts, certifications, and tax documents'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowUpload(true)} className="bg-[#1a365d]">
            <Upload className="w-4 h-4 mr-2" /> Upload Document
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No documents yet</p>
            <p className="text-sm text-gray-400 mt-1">
              {isAdmin ? 'Upload contracts and tax documents for staff members' : 'Documents will appear here once uploaded by your team'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Contracts Section */}
          {contracts.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" /> Contracts & Agreements
              </h4>
              <div className="grid gap-3">
                {contracts.map(doc => <DocCard key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={handleDelete} />)}
              </div>
            </div>
          )}

          {/* Certifications */}
          {certifications.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" /> Certifications
              </h4>
              <div className="grid gap-3">
                {certifications.map(doc => <DocCard key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={handleDelete} />)}
              </div>
            </div>
          )}

          {/* Tax Center */}
          {taxDocs.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" /> Tax Center
              </h4>
              <div className="grid gap-3">
                {taxDocs.map(doc => <DocCard key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={handleDelete} />)}
              </div>
            </div>
          )}

          {/* Other */}
          {otherDocs.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-gray-600" /> Other Documents
              </h4>
              <div className="grid gap-3">
                {otherDocs.map(doc => <DocCard key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={handleDelete} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg" aria-describedby="upload-doc-desc">
          <DialogHeader>
            <DialogTitle>Upload Compliance Document</DialogTitle>
            <DialogDescription id="upload-doc-desc">Upload contracts, 1099s, or other compliance documents</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isAdmin && staffList.length > 0 && (
              <div>
                <Label>Assign to Staff Member</Label>
                <Select value={uploadForm.staff_id} onValueChange={(v) => setUploadForm({ ...uploadForm, staff_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                  <SelectContent>
                    {staffList.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Document Type</Label>
                <Select value={uploadForm.doc_type} onValueChange={(v) => setUploadForm({ ...uploadForm, doc_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input type="number" value={uploadForm.year} onChange={(e) => setUploadForm({ ...uploadForm, year: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} placeholder="Document title" />
            </div>
            <div>
              <Label>File (PDF)</Label>
              <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={uploadForm.notes} onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile} className="bg-[#1a365d]">
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocCard({ doc, isAdmin, onDelete }: { doc: ComplianceDoc; isAdmin: boolean; onDelete: (id: string) => void }) {
  const config = DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other;
  const Icon = config.icon;

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{doc.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{config.label}</Badge>
                {doc.year && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {doc.year}
                  </span>
                )}
              </div>
              {doc.uploaded_by_name && (
                <p className="text-xs text-gray-400 mt-1">Uploaded by {doc.uploaded_by_name} on {new Date(doc.created_at).toLocaleDateString()}</p>
              )}
              {doc.notes && <p className="text-xs text-gray-500 mt-1">{doc.notes}</p>}
            </div>
          </div>
          <div className="flex gap-1">
            {doc.file_url && (
              <Button size="sm" variant="outline" onClick={() => window.open(doc.file_url!, '_blank')}>
                <Download className="w-4 h-4" />
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => onDelete(doc.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
