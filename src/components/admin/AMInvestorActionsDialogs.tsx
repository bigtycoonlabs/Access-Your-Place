import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Send, MessageSquare, FileText, FolderOpen,
  Plus, Clock, User, Download, ExternalLink, Building2,
  DollarSign, MapPin, CheckCircle, X, Upload
} from 'lucide-react';

// ==================== MESSAGE DIALOG ====================
interface MessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor: { id: string; full_name: string; email: string } | null;
  staffId: string;
  staffName: string;
}

export function AMMessageDialog({ open, onOpenChange, investor, staffId, staffName }: MessageDialogProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    if (!investor?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('investor-messaging', {
        body: { action: 'get_conversation', investor_id: investor.id }
      });
      setMessages(data?.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
    setLoading(false);
  }, [investor?.id]);

  useEffect(() => {
    if (open && investor?.id) {
      fetchMessages();
      setSubject('');
      setMessage('');
    }
  }, [open, investor?.id, fetchMessages]);

  const handleSend = async () => {
    if (!message.trim() || !investor?.id) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: {
          action: 'send_to_investor',
          investor_id: investor.id,
          subject: subject.trim() || `Message from ${staffName}`,
          message: message.trim(),
          staff_id: staffId,
          staff_name: staffName
        }
      });
      if (error) throw error;
      toast({ title: 'Message Sent', description: `Message sent to ${investor.full_name}` });
      setMessage('');
      setSubject('');
      fetchMessages();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            Messages - {investor?.full_name}
          </DialogTitle>
          <DialogDescription>
            Send and view messages with this investor. They will receive email notifications.
          </DialogDescription>
        </DialogHeader>

        {/* Message History */}
        <ScrollArea className="flex-1 max-h-[300px] border rounded-lg p-3 bg-gray-50">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-sm ${
                    msg.sender_type === 'staff'
                      ? 'bg-blue-100 ml-4'
                      : 'bg-white border mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs">
                      {msg.sender_type === 'staff' ? (msg.sender_name || 'Staff') : investor?.full_name}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  {msg.subject && <p className="text-xs font-medium text-gray-600 mb-1">{msg.subject}</p>}
                  <p className="text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Compose */}
        <div className="space-y-3 pt-3 border-t">
          <Input aria-label="Subject (optional)"
            placeholder="Subject (optional)"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
          <div className="flex gap-2">
            <Textarea aria-label="Type your message"
              placeholder="Type your message..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              className="flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
              }}
            />
            <Button
              className="self-end bg-blue-600 hover:bg-blue-700"
              disabled={sending || !message.trim()}
              onClick={handleSend}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-gray-400">Press Ctrl+Enter to send</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== NOTES DIALOG ====================
interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor: { id: string; full_name: string } | null;
  staffId: string;
  staffName: string;
}

export function AMNotesDialog({ open, onOpenChange, investor, staffId, staffName }: NotesDialogProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('general');
  const { toast } = useToast();

  const fetchNotes = useCallback(async () => {
    if (!investor?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-notes', {
        body: { action: 'get_notes', investor_id: investor.id }
      });
      setNotes(data?.notes || []);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
    setLoading(false);
  }, [investor?.id]);

  useEffect(() => {
    if (open && investor?.id) {
      fetchNotes();
      setNoteText('');
    }
  }, [open, investor?.id, fetchNotes]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !investor?.id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-notes', {
        body: {
          action: 'add_note',
          investor_id: investor.id,
          note: noteText.trim(),
          note_type: noteType,
          created_by: staffId,
          created_by_name: staffName
        }
      });
      if (error) throw error;
      toast({ title: 'Note Added', description: 'Note saved successfully.' });
      setNoteText('');
      fetchNotes();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-green-100 text-green-800';
      case 'meeting': return 'bg-blue-100 text-blue-800';
      case 'follow_up': return 'bg-amber-100 text-amber-800';
      case 'important': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Notes - {investor?.full_name}
          </DialogTitle>
          <DialogDescription>
            View and add notes for this investor's account.
          </DialogDescription>
        </DialogHeader>

        {/* Add Note */}
        <div className="space-y-3 pb-3 border-b">
          <div className="flex gap-2">
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="important">Important</SelectItem>
              </SelectContent>
            </Select>
            <Textarea aria-label="Add a note"
              placeholder="Add a note..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={2}
              className="flex-1"
            />
          </div>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600"
            disabled={saving || !noteText.trim()}
            onClick={handleAddNote}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Add Note
          </Button>
        </div>

        {/* Notes List */}
        <ScrollArea className="flex-1 max-h-[350px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notes yet</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {notes.map((note: any) => (
                <div key={note.id} className="p-3 border rounded-lg bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${getNoteTypeColor(note.note_type || note.type || 'general')}`}>
                        {note.note_type || note.type || 'general'}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {note.created_by_name || 'Staff'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {new Date(note.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.note || note.content}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ==================== DOCUMENTS DIALOG ====================
interface DocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor: { id: string; full_name: string } | null;
  staffId: string;
  staffName: string;
}

export function AMDocumentsDialog({ open, onOpenChange, investor, staffId, staffName }: DocumentsDialogProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('general');
  const [docNotes, setDocNotes] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const { toast } = useToast();

  const fetchDocuments = useCallback(async () => {
    if (!investor?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-investor-documents', {
        body: { action: 'get_documents', investor_id: investor.id }
      });
      setDocuments(data?.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
    setLoading(false);
  }, [investor?.id]);

  useEffect(() => {
    if (open && investor?.id) {
      fetchDocuments();
      setDocName('');
      setDocUrl('');
      setDocNotes('');
    }
  }, [open, investor?.id, fetchDocuments]);

  const handleUpload = async () => {
    if (!docName.trim() || !investor?.id) {
      toast({ title: 'Document name is required', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-documents', {
        body: {
          action: 'add_document',
          investor_id: investor.id,
          document_name: docName.trim(),
          document_type: docType,
          document_url: docUrl.trim() || null,
          notes: docNotes.trim() || null,
          uploaded_by: staffId,
          uploaded_by_name: staffName
        }
      });
      if (error) throw error;
      toast({ title: 'Document Added', description: 'Document record saved.' });
      setDocName('');
      setDocUrl('');
      setDocNotes('');
      fetchDocuments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-purple-500" />
            Documents - {investor?.full_name}
          </DialogTitle>
          <DialogDescription>
            View and manage documents for this investor.
          </DialogDescription>
        </DialogHeader>

        {/* Add Document */}
        <div className="space-y-3 pb-3 border-b">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs" htmlFor="document-name">Document Name *</Label>
              <Input id="document-name"
                value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder="Lease Agreement"
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="lease">Lease</SelectItem>
                  <SelectItem value="agreement">Agreement</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="id_verification">ID Verification</SelectItem>
                  <SelectItem value="property">Property</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs" htmlFor="document-url-optional">Document URL (optional)</Label>
            <Input id="document-url-optional"
              value={docUrl}
              onChange={e => setDocUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label className="text-xs" htmlFor="notes-optional">Notes (optional)</Label>
            <Input id="notes-optional"
              value={docNotes}
              onChange={e => setDocNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
            disabled={uploading || !docName.trim()}
            onClick={handleUpload}
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Add Document
          </Button>
        </div>

        {/* Documents List */}
        <ScrollArea className="flex-1 max-h-[300px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No documents yet</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded">
                      <FileText className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{doc.document_name || doc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">{doc.document_type || doc.type || 'general'}</Badge>
                        <span className="text-[10px] text-gray-400">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {doc.notes && <p className="text-xs text-gray-500 mt-1">{doc.notes}</p>}
                    </div>
                  </div>
                  {(doc.document_url || doc.url || doc.file_url) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(doc.document_url || doc.url || doc.file_url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ==================== SEND DEAL DIALOG ====================
interface SendDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor: { id: string; full_name: string; email: string } | null;
  staffId: string;
  staffName: string;
  deals: Array<{ id: string; title?: string; address: string; city: string; state: string; acquisition_fee?: number; monthly_revenue?: number; monthly_rent?: number }>;
}

export function AMSendDealDialog({ open, onOpenChange, investor, staffId, staffName, deals }: SendDealDialogProps) {
  const [selectedDealId, setSelectedDealId] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setSelectedDealId('');
      setPersonalNote('');
      setSearchQuery('');
    }
  }, [open]);

  const filteredDeals = deals.filter(d => {
    const q = searchQuery.toLowerCase();
    return !q || d.address?.toLowerCase().includes(q) || d.city?.toLowerCase().includes(q) || d.title?.toLowerCase().includes(q);
  });

  const selectedDeal = deals.find(d => d.id === selectedDealId);

  const handleSendDeal = async () => {
    if (!selectedDealId || !investor?.id) return;
    setSending(true);
    try {
      const deal = deals.find(d => d.id === selectedDealId);
      const dealTitle = deal?.title || `${deal?.address}, ${deal?.city}`;
      const priceStr = deal?.acquisition_fee ? `$${deal.acquisition_fee.toLocaleString()}` : 'Contact for pricing';
      const revenueStr = deal?.monthly_revenue || deal?.monthly_rent
        ? `$${(deal?.monthly_revenue || deal?.monthly_rent || 0).toLocaleString()}/mo`
        : 'N/A';

      const messageBody = `Hi ${investor.full_name?.split(' ')[0] || 'there'},\n\nI wanted to share a deal I think would be a great fit for you:\n\n${dealTitle}\nAcquisition Fee: ${priceStr}\nProjected Revenue: ${revenueStr}\n\n${personalNote ? `${personalNote}\n\n` : ''}Let me know if you'd like to learn more or schedule a call to discuss!\n\nBest,\n${staffName}`;

      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: {
          action: 'send_to_investor',
          investor_id: investor.id,
          subject: `Deal Recommendation: ${dealTitle}`,
          message: messageBody,
          staff_id: staffId,
          staff_name: staffName
        }
      });
      if (error) throw error;

      toast({
        title: 'Deal Sent!',
        description: `Deal recommendation sent to ${investor.full_name}`
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-600" />
            Send Deal to {investor?.full_name}
          </DialogTitle>
          <DialogDescription>
            Select a deal to recommend to this investor. They'll receive a message with details.
          </DialogDescription>
        </DialogHeader>

        {/* Search Deals */}
        <Input aria-label="Search deals by address or city"
          placeholder="Search deals by address or city..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        {/* Deal List */}
        <ScrollArea className="max-h-[250px] border rounded-lg">
          <div className="p-2 space-y-2">
            {filteredDeals.length === 0 ? (
              <p className="text-center py-4 text-sm text-gray-400">No deals found</p>
            ) : (
              filteredDeals.slice(0, 20).map(deal => (
                <div
                  key={deal.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDealId === deal.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedDealId(deal.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{deal.title || deal.address}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {deal.city}, {deal.state}
                      </p>
                    </div>
                    <div className="text-right">
                      {deal.acquisition_fee && (
                        <p className="text-sm font-semibold text-green-700">
                          ${deal.acquisition_fee.toLocaleString()}
                        </p>
                      )}
                      {(deal.monthly_revenue || deal.monthly_rent) && (
                        <p className="text-xs text-gray-500">
                          ${(deal.monthly_revenue || deal.monthly_rent || 0).toLocaleString()}/mo
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedDealId === deal.id && (
                    <div className="mt-2 flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      <span className="text-xs font-medium">Selected</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Personal Note */}
        <div>
          <Label className="text-xs" htmlFor="personal-note-optional">Personal Note (optional)</Label>
          <Textarea id="personal-note-optional"
            value={personalNote}
            onChange={e => setPersonalNote(e.target.value)}
            placeholder="Add a personal note about why this deal is a good fit..."
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={sending || !selectedDealId}
            onClick={handleSendDeal}
          >
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
