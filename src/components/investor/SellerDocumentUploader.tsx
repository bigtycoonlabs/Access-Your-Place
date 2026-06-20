import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, FileText, Image, X, Loader2, CheckCircle, AlertCircle,
  File, FileSpreadsheet, Eye, Trash2
} from 'lucide-react';


export interface UploadedFile {
  path: string;
  name: string;
  mime_type: string;
  size: number;
  category: string;
  signed_url?: string | null;
  uploaded_at: string;
  is_image?: boolean;
}

interface Props {
  investorId: string;
  listingId?: string;
  category: 'lease' | 'financial' | 'photos';
  label: string;
  description: string;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const CATEGORY_ACCEPT: Record<string, string> = {
  lease: '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx',
  financial: '.pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv',
  photos: '.jpg,.jpeg,.png,.webp,.gif'
};

const CATEGORY_TYPES: Record<string, string[]> = {
  lease: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  financial: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
  photos: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = 'seller-documents';

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  return <File className="w-5 h-5 text-gray-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Build the upload path following the pattern: seller-docs/{investorId}/{listingId}/{category}/{filename}
function buildUploadPath(investorId: string, listingId: string | undefined, category: string, fileName: string): string {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const uniqueName = `${timestamp}_${sanitizedName}`;
  const listingFolder = listingId || 'draft';
  return `seller-docs/${investorId}/${listingFolder}/${category}/${uniqueName}`;
}

// Generate a signed URL for a file path
async function generateSignedUrl(filePath: string): Promise<string | null> {
  // Try edge function first
  try {
    const { data } = await supabase.functions.invoke('seller-document-upload', {
      body: { action: 'get_signed_urls', file_paths: [filePath] }
    });
    if (data?.urls?.[0]?.signed_url) return data.urls[0].signed_url;
  } catch {}
  
  // Direct Supabase storage fallback
  try {
    const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(filePath, 3600);
    if (data?.signedUrl) return data.signedUrl;
  } catch {}
  
  // Try investor-documents bucket as legacy fallback
  try {
    const { data } = await supabase.storage.from('investor-documents').createSignedUrl(filePath, 3600);
    if (data?.signedUrl) return data.signedUrl;
  } catch {}
  
  return null;
}

export function SellerDocumentUploader({
  investorId, listingId, category, label, description,
  files, onFilesChange, maxFiles = 10, disabled = false
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    const allowedTypes = CATEGORY_TYPES[category];
    if (!allowedTypes.includes(file.type)) {
      return `File type "${file.type || 'unknown'}" is not allowed for ${label}. Accepted: ${CATEGORY_ACCEPT[category]}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large (${formatFileSize(file.size)}). Maximum size is 10MB.`;
    }
    return null;
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const uploadFiles = useCallback(async (fileList: File[]) => {
    if (disabled) return;

    const remainingSlots = maxFiles - files.length;
    if (remainingSlots <= 0) {
      toast({ title: 'Maximum files reached', description: `You can upload up to ${maxFiles} files for ${label}.`, variant: 'destructive' });
      return;
    }

    const filesToUpload = fileList.slice(0, remainingSlots);
    const validFiles: File[] = [];

    for (const file of filesToUpload) {
      const error = validateFile(file);
      if (error) {
        toast({ title: 'Invalid File', description: error, variant: 'destructive' });
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) return;

    const uploadingEntries: UploadingFile[] = validFiles.map((f, i) => ({
      id: `upload-${Date.now()}-${i}`,
      name: f.name,
      progress: 0,
      status: 'uploading' as const
    }));
    setUploading(prev => [...prev, ...uploadingEntries]);

    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const entryId = uploadingEntries[i].id;

      try {
        setUploading(prev => prev.map(u => u.id === entryId ? { ...u, progress: 10 } : u));

        const base64 = await readFileAsBase64(file);
        setUploading(prev => prev.map(u => u.id === entryId ? { ...u, progress: 30 } : u));

        let uploadedFile: UploadedFile | null = null;

        // Try edge function first
        try {
          const { data, error } = await supabase.functions.invoke('seller-document-upload', {
            body: {
              action: 'upload',
              investor_id: investorId,
              listing_id: listingId || 'draft',
              category,
              file_name: file.name,
              file_data: base64,
              mime_type: file.type,
              file_size: file.size
            }
          });

          setUploading(prev => prev.map(u => u.id === entryId ? { ...u, progress: 80 } : u));

          if (data?.success && data.file) {
            uploadedFile = {
              ...data.file,
              is_image: file.type.startsWith('image/')
            };
          } else if (data?.error || error) {
            throw new Error(data?.error || error?.message || 'Edge function upload failed');
          }
        } catch (edgeFnErr) {
          console.warn('Edge function upload failed, trying direct upload:', edgeFnErr);

          // Direct upload fallback: upload to seller-documents bucket directly
          const filePath = buildUploadPath(investorId, listingId, category, file.name);
          
          // Convert base64 back to binary for direct upload
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let j = 0; j < binaryStr.length; j++) {
            bytes[j] = binaryStr.charCodeAt(j);
          }

          setUploading(prev => prev.map(u => u.id === entryId ? { ...u, progress: 50 } : u));

          const { error: storageErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, bytes, { contentType: file.type, upsert: false });

          if (storageErr) {
            throw new Error(`Direct upload failed: ${storageErr.message}`);
          }

          setUploading(prev => prev.map(u => u.id === entryId ? { ...u, progress: 70 } : u));

          // Generate signed URL for immediate display
          const signedUrl = await generateSignedUrl(filePath);

          setUploading(prev => prev.map(u => u.id === entryId ? { ...u, progress: 85 } : u));

          // Store metadata in seller_listing_documents table (DB fallback)
          try {
            await supabase.from('seller_listing_documents').insert({
              investor_id: investorId,
              listing_id: listingId || null,
              category,
              file_name: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
              original_file_name: file.name,
              file_path: filePath,
              mime_type: file.type,
              file_size: file.size,
              bucket_name: BUCKET_NAME,
              status: 'uploaded'
            });
          } catch (metaErr) {
            console.warn('Failed to store file metadata in DB:', metaErr);
          }

          uploadedFile = {
            path: filePath,
            name: file.name,
            mime_type: file.type,
            size: file.size,
            category,
            signed_url: signedUrl,
            uploaded_at: new Date().toISOString(),
            is_image: file.type.startsWith('image/')
          };
        }

        if (uploadedFile) {
          newFiles.push(uploadedFile);
          setUploading(prev => prev.map(u => u.id === entryId ? { ...u, progress: 100, status: 'success' } : u));
        }
      } catch (err: any) {
        console.error('Upload error:', err);
        setUploading(prev => prev.map(u => u.id === entryId ? { ...u, status: 'error', error: err.message } : u));
        toast({ title: 'Upload Failed', description: `Failed to upload "${file.name}": ${err.message}`, variant: 'destructive' });
      }
    }

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles]);
      toast({ title: 'Upload Complete', description: `${newFiles.length} file${newFiles.length > 1 ? 's' : ''} uploaded successfully.` });
    }

    setTimeout(() => {
      setUploading(prev => prev.filter(u => u.status === 'uploading'));
    }, 2000);
  }, [investorId, listingId, category, files, maxFiles, disabled, onFilesChange, toast, label]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }, [uploadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadFiles]);

  const handleRemoveFile = async (fileToRemove: UploadedFile) => {
    try {
      // Try edge function first
      try {
        await supabase.functions.invoke('seller-document-upload', {
          body: { action: 'delete', investor_id: investorId, file_path: fileToRemove.path }
        });
      } catch {
        // Direct storage delete fallback
        await supabase.storage.from(BUCKET_NAME).remove([fileToRemove.path]).catch(() => {});
        // Also try legacy bucket
        await supabase.storage.from('investor-documents').remove([fileToRemove.path]).catch(() => {});
        // Remove from DB
        await supabase.from('seller_listing_documents').delete().eq('file_path', fileToRemove.path).catch(() => {});
      }
      onFilesChange(files.filter(f => f.path !== fileToRemove.path));
      toast({ title: 'File Removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to remove file', variant: 'destructive' });
    }
  };

  const handlePreview = async (file: UploadedFile) => {
    let url = file.signed_url;
    
    // If no signed URL or it might be expired, get a fresh one
    if (!url) {
      url = await generateSignedUrl(file.path);
    }
    
    if (url) {
      if (file.is_image || file.mime_type?.startsWith('image/')) {
        setPreviewUrl(url);
      } else {
        window.open(url, '_blank');
      }
    } else {
      toast({ title: 'Preview Error', description: 'Could not generate preview URL', variant: 'destructive' });
    }
  };

  const isAtLimit = files.length >= maxFiles;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="text-xs">{files.length}/{maxFiles} files</Badge>
      </div>

      {/* Drop Zone */}
      {!isAtLimit && !disabled && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${isDragging ? 'border-[#d4a574] bg-[#d4a574]/10 scale-[1.01]' : 'border-gray-300 hover:border-[#d4a574]/50 hover:bg-gray-50'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input ref={fileInputRef} type="file" multiple accept={CATEGORY_ACCEPT[category]} onChange={handleFileSelect} className="hidden" disabled={disabled} />
          <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-[#d4a574]' : 'text-gray-400'}`} />
          <p className="text-sm font-medium text-gray-600">
            {isDragging ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Accepted: {CATEGORY_ACCEPT[category].replace(/\./g, '').toUpperCase()} — Max 10MB per file
          </p>
        </div>
      )}

      {isAtLimit && !disabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <p className="text-sm text-amber-700">Maximum of {maxFiles} files reached for {label}.</p>
        </div>
      )}

      {/* Upload Progress */}
      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map(u => (
            <div key={u.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              {u.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-[#d4a574] flex-shrink-0" />}
              {u.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
              {u.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.name}</p>
                {u.status === 'uploading' && <Progress value={u.progress} className="h-1.5 mt-1" />}
                {u.status === 'error' && <p className="text-xs text-red-500 mt-0.5">{u.error}</p>}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {u.status === 'uploading' && `${u.progress}%`}
                {u.status === 'success' && 'Done'}
                {u.status === 'error' && 'Failed'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, idx) => (
            <div key={file.path || idx} className="flex items-center gap-3 bg-white border rounded-lg p-3 group hover:border-[#d4a574]/30 transition-colors">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                {(file.is_image || file.mime_type?.startsWith('image/')) && file.signed_url ? (
                  <img src={file.signed_url} alt={file.name} className="w-10 h-10 object-cover rounded-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  getFileIcon(file.mime_type || '')
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size || 0)}
                  {file.uploaded_at && ` — ${new Date(file.uploaded_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePreview(file)} title="Preview">
                  <Eye className="w-4 h-4 text-gray-500" />
                </Button>
                {!disabled && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-red-500" onClick={() => handleRemoveFile(file)} title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="absolute -top-10 right-0 text-white hover:text-white/80" onClick={() => setPreviewUrl(null)}>
              <X className="w-5 h-5 mr-1" /> Close
            </Button>
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
