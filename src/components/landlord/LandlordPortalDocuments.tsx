import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Trash2, Download, Upload, FolderOpen, X, File, BookOpen, Car, Shield, CreditCard, Camera, Video } from 'lucide-react';

interface Document {
  id: string;
  document_type: string;
  title: string;
  description?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  uploaded_by: string;
  created_at: string;
}

interface Props {
  landlordId: string;
}

const DOC_TYPES = [
  { value: 'property_rules', label: 'Property Rules', icon: BookOpen, desc: 'Rules of Engagement — e.g., "No lockboxes on doors," "Trash pickup is Tuesday"' },
  { value: 'parking_map', label: 'Parking Map', icon: Car, desc: 'Parking assignments, maps, and restrictions' },
  { value: 'hoa_bylaws', label: 'HOA Bylaws', icon: Shield, desc: 'HOA rules, covenants, and bylaws' },
  { value: 'payment_preferences', label: 'Payment Preferences', icon: CreditCard, desc: 'How you prefer to receive rent payments' },
  { value: 'lease_template', label: 'Lease Template', icon: FileText, desc: 'Your standard lease agreement template' },
  { value: 'photos', label: 'Property Photos', icon: Camera, desc: 'High-resolution property photos for marketing' },
  { value: 'walkthrough_video', label: 'Walkthrough Video', icon: Video, desc: 'Property walkthrough videos' },
  { value: 'general', label: 'Other Document', icon: File, desc: 'Any other relevant documents' },
];

export default function LandlordPortalDocuments({ landlordId }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchDocuments(); }, [landlordId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'get_documents', landlord_id: landlordId }
      });
      if (data?.documents) setDocuments(data.documents);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedType) {
      toast({ title: 'Error', description: 'Title and document type are required', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      let fileUrl = '';
      let fileName = '';
      let fileSize = 0;

      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop();
        const path = `landlord-docs/${landlordId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('seller-documents').upload(path, selectedFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('seller-documents').getPublicUrl(path);
          fileUrl = urlData?.publicUrl || '';
          fileName = selectedFile.name;
          fileSize = selectedFile.size;
        }
      }

      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'upload_document', landlord_id: landlordId,
          document_type: selectedType, title, description,
          file_url: fileUrl, file_name: fileName, file_size: fileSize,
          uploaded_by: 'landlord'
        }
      });

      if (data?.success) {
        toast({ title: 'Document Uploaded', description: 'Your document has been saved.' });
        setShowUpload(false);
        setTitle(''); setDescription(''); setSelectedType(''); setSelectedFile(null);
        fetchDocuments();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to upload document', variant: 'destructive' });
    }
    setUploading(false);
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'delete_document', document_id: docId }
      });
      if (data?.success) {
        toast({ title: 'Deleted', description: 'Document removed.' });
        fetchDocuments();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const getDocIcon = (type: string) => {
    const found = DOC_TYPES.find(d => d.value === type);
    const Icon = found?.icon || File;
    return <Icon className="w-5 h-5 text-[#d4a574]" />;
  };

  const grouped = DOC_TYPES.map(dt => ({
    ...dt,
    docs: documents.filter(d => d.document_type === dt.value)
  })).filter(g => g.docs.length > 0);

  const ungrouped = documents.filter(d => !DOC_TYPES.find(dt => dt.value === d.document_type));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#1a2332]">Document Library</h3>
          <p className="text-sm text-gray-500">Your "Rules of Engagement" and property documents — upload once, we remember.</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="bg-[#d4a574] text-white px-4 py-2.5 rounded-lg font-medium hover:bg-[#c49564] transition-colors flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-[#1a2332]">Upload Document</h3>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {DOC_TYPES.map(dt => {
                    const Icon = dt.icon;
                    return (
                      <button
                        key={dt.value}
                        type="button"
                        onClick={() => setSelectedType(dt.value)}
                        className={`p-3 rounded-lg border text-left text-sm transition-all flex items-center gap-2 ${
                          selectedType === dt.value ? 'border-[#d4a574] bg-[#d4a574]/5 ring-1 ring-[#d4a574]' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-[#d4a574] flex-shrink-0" />
                        <span className="font-medium text-[#1a2332]">{dt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" placeholder="e.g., Building A Parking Map" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm" placeholder="Optional description..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#d4a574] transition-colors">
                  <input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="hidden" id="doc-upload" />
                  <label htmlFor="doc-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">{selectedFile ? selectedFile.name : 'Click to select a file'}</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOC, JPG, PNG, MP4 up to 50MB</p>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowUpload(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 text-sm">Cancel</button>
                <button type="submit" disabled={uploading} className="flex-1 bg-[#d4a574] text-white py-2.5 rounded-lg font-medium hover:bg-[#c49564] disabled:opacity-50 text-sm">
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Documents Grid */}
      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="bg-white rounded-xl border p-6 animate-pulse"><div className="h-5 bg-gray-200 rounded w-1/3" /></div>)}</div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Documents Yet</h3>
          <p className="text-gray-400 mb-2">Upload your property rules, parking maps, HOA bylaws, and other important documents.</p>
          <p className="text-sm text-gray-400 mb-4">Your AM will reference these so they never have to ask twice.</p>
          <button onClick={() => setShowUpload(true)} className="bg-[#d4a574] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#c49564] inline-flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Upload First Document
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.value}>
              <div className="flex items-center gap-2 mb-3">
                <group.icon className="w-5 h-5 text-[#d4a574]" />
                <h4 className="font-semibold text-[#1a2332]">{group.label}</h4>
                <span className="text-xs text-gray-400">({group.docs.length})</span>
              </div>
              <div className="grid gap-2">
                {group.docs.map(doc => (
                  <div key={doc.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:border-[#d4a574]/30 transition-all">
                    <div className="flex items-center gap-3">
                      {getDocIcon(doc.document_type)}
                      <div>
                        <p className="font-medium text-[#1a2332] text-sm">{doc.title}</p>
                        {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(doc.created_at).toLocaleDateString()}
                          {doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-[#d4a574] transition-colors">
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <h4 className="font-semibold text-[#1a2332] mb-3">Other Documents</h4>
              <div className="grid gap-2">
                {ungrouped.map(doc => (
                  <div key={doc.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <File className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-[#1a2332] text-sm">{doc.title}</p>
                        <p className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-[#d4a574]"><Download className="w-4 h-4" /></a>}
                      <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
