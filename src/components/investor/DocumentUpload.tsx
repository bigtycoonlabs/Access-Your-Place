import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Download, Loader2, CheckCircle, Clock, X, Eye, Bell } from 'lucide-react';

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  file_path: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  status: string;
  created_at: string;
  notes?: string;
}

interface Props {
  acquisitionId: string;
  investorId: string;
  investorName: string;
  investorEmail: string;
  documents: Document[];
  onUpload: () => void;
}

const docTypes = [
  { value: 'id', label: 'Government ID' },
  { value: 'proof_of_funds', label: 'Proof of Funds' },
  { value: 'signed_agreement', label: 'Signed Agreement' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'other', label: 'Other Document' }
];

export function DocumentUpload({ acquisitionId, investorId, investorName, investorEmail, documents, onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('id');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await supabase.functions.invoke('manage-investor-documents', {
        body: {
          action: 'upload',
          acquisition_id: acquisitionId,
          investor_id: investorId,
          document_type: docType,
          document_name: file.name,
          file_data: base64,
          mime_type: file.type,
          uploaded_by: 'investor',
          uploaded_by_name: investorName,
          investor_email: investorEmail,
          investor_name: investorName
        }
      });
      setUploading(false);
      onUpload();
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (doc: Document) => {
    const { data } = await supabase.functions.invoke('manage-investor-documents', {
      body: { action: 'download', file_path: doc.file_path }
    });
    if (data?.url) window.open(data.url, '_blank');
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-800"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  };

  const investorDocs = documents.filter(d => d.uploaded_by === 'investor');
  const staffDocs = documents.filter(d => d.uploaded_by === 'staff');

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 flex items-center gap-2"><Upload className="w-4 h-4" />Upload Documents</h4>
        <p className="text-xs text-gray-500 mb-3 flex items-center gap-1"><Bell className="w-3 h-3" />Our team will be notified when you upload a document</p>
        <div className="flex gap-3 flex-wrap">
          <select value={docType} onChange={e => setDocType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            {docTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="file" ref={fileRef} onChange={handleUpload} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="bg-[#d4a574] hover:bg-[#c49464]">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? 'Uploading...' : 'Select File'}
          </Button>
        </div>
      </div>

      {investorDocs.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">Your Uploaded Documents</h4>
          <div className="space-y-2">
            {investorDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-white border p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-sm">{doc.document_name}</p>
                    <p className="text-xs text-gray-500">{docTypes.find(t => t.value === doc.document_type)?.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(doc.status)}
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)}><Eye className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {staffDocs.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 text-[#1a365d]">Documents From Our Team</h4>
          <div className="space-y-2">
            {staffDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">{doc.document_name}</p>
                    <p className="text-xs text-gray-500">From: {doc.uploaded_by_name || 'Staff'}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleDownload(doc)} className="bg-blue-600 hover:bg-blue-700">
                  <Download className="w-4 h-4 mr-1" />Download
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
