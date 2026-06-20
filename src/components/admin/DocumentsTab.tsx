import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Download, Loader2, Trash2, Bell, Mail } from 'lucide-react';

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  file_path: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  status: string;
  created_at: string;
}

interface Props {
  acquisitionId: string;
  investorId: string;
  documents: Document[];
  onUpdate: () => void;
}

const docTypes = [
  { value: 'signed_lease', label: 'Signed Lease' },
  { value: 'signed_agreement', label: 'Signed Agreement' },
  { value: 'welcome_packet', label: 'Welcome Packet' },
  { value: 'property_report', label: 'Property Report' },
  { value: 'other', label: 'Other Document' }
];

export function DocumentsTab({ acquisitionId, investorId, documents, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('signed_lease');
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
          action: 'upload', acquisition_id: acquisitionId, investor_id: investorId,
          document_type: docType, document_name: file.name, file_data: base64,
          mime_type: file.type, uploaded_by: 'staff', uploaded_by_name: 'Staff'
        }
      });
      setUploading(false);
      onUpdate();
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (doc: Document) => {
    const { data } = await supabase.functions.invoke('manage-investor-documents', {
      body: { action: 'download', file_path: doc.file_path }
    });
    if (data?.url) window.open(data.url, '_blank');
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Delete this document?')) return;
    await supabase.functions.invoke('manage-investor-documents', {
      body: { action: 'delete', document_id: doc.id, file_path: doc.file_path }
    });
    onUpdate();
  };

  const updateStatus = async (docId: string, status: string) => {
    await supabase.functions.invoke('manage-investor-documents', {
      body: { action: 'update_status', document_id: docId, status, reviewed_by: 'Staff' }
    });
    onUpdate();
  };

  const investorDocs = documents.filter(d => d.uploaded_by === 'investor');
  const staffDocs = documents.filter(d => d.uploaded_by === 'staff');

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-900"><Upload className="w-4 h-4" />Upload Document for Investor</h4>
        <p className="text-xs text-blue-700 mb-3 flex items-center gap-1"><Mail className="w-3 h-3" />Investor will receive an email notification</p>
        <div className="flex gap-3 flex-wrap">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{docTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <input type="file" ref={fileRef} onChange={handleUpload} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="bg-blue-600 hover:bg-blue-700">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>

      {investorDocs.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">Investor Uploaded Documents</h4>
          <div className="space-y-2">
            {investorDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-white border p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-sm">{doc.document_name}</p>
                    <p className="text-xs text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Bell className="w-3 h-3 text-orange-500" title="Status change will notify investor" />
                    <Select value={doc.status} onValueChange={v => updateStatus(doc.id, v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}><Download className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {staffDocs.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">Staff Uploaded Documents</h4>
          <div className="space-y-2">
            {staffDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">{doc.document_name}</p>
                    <p className="text-xs text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}><Download className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length === 0 && <p className="text-gray-500 text-center py-8">No documents uploaded yet</p>}
    </div>
  );
}
