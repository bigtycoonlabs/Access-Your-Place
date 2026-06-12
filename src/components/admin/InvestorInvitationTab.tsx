import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Send, Upload, Users, Phone, FileSpreadsheet, 
  CheckCircle, XCircle, AlertCircle, MessageSquare, Trash2,
  History, RefreshCw, Calendar, Filter, UserCheck, Clock,
  ChevronLeft, ChevronRight, Mail, MessageCircle, Plus,
  Save, UserPlus, Edit, Search, Tag, Tags, X, Palette,
  Target, MapPin, Sparkles, ChevronDown, Smartphone, ExternalLink
} from 'lucide-react';


interface ParsedContact {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  valid: boolean;
  error?: string;
}

interface InvestorTag {
  id: string;
  name: string;
  category: 'source' | 'interest_level' | 'market' | 'custom';
  color: string;
  description?: string;
  count?: number;
}

interface PendingContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  notes?: string;
  created_at: string;
  tags?: InvestorTag[];
}

interface InvitationRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  channel: 'sms' | 'email';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'signed_up' | 'queued' | 'undelivered';
  delivery_status?: string;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
  invite_code?: string;
  twilio_sid?: string;
  resend_id?: string;
  error_message?: string;
  twilio_error_code?: string;
  resend_count?: number;
  has_signed_up?: boolean;
}

interface InvitationStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
  signed_up: number;
  sms_sent?: number;
  email_sent?: number;
}

const TAG_CATEGORY_ICONS: Record<string, any> = {
  source: Users,
  interest_level: Target,
  market: MapPin,
  custom: Sparkles,
};

const TAG_CATEGORY_LABELS: Record<string, string> = {
  source: 'Source',
  interest_level: 'Interest Level',
  market: 'Market',
  custom: 'Custom',
};

const DEFAULT_TAG_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', 
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#6B7280', '#1F2937'
];


export function InvestorInvitationTab() {
  const [singleInvite, setSingleInvite] = useState({ name: '', phone: '', email: '', company: '' });
  const [inviteChannel, setInviteChannel] = useState<'sms' | 'email' | 'both'>('both');
  const [sending, setSending] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [parsing, setParsing] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkChannel, setBulkChannel] = useState<'sms' | 'email' | 'both'>('both');
  const [saveAsPending, setSaveAsPending] = useState(false);
  
  // Pending contacts state
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [pendingSearch, setPendingSearch] = useState('');
  const [sendingPending, setSendingPending] = useState(false);
  const [pendingChannel, setPendingChannel] = useState<'sms' | 'email' | 'both'>('both');
  const [editingContact, setEditingContact] = useState<PendingContact | null>(null);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', company: '', notes: '' });
  const [addingContact, setAddingContact] = useState(false);
  
  // Tags state
  const [tags, setTags] = useState<InvestorTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [tagManagementOpen, setTagManagementOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<InvestorTag | null>(null);
  const [newTag, setNewTag] = useState({ name: '', category: 'custom' as const, color: '#6B7280', description: '' });
  const [savingTag, setSavingTag] = useState(false);
  const [assignTagsOpen, setAssignTagsOpen] = useState(false);
  const [selectedTagsToAssign, setSelectedTagsToAssign] = useState<string[]>([]);
  const [assigningTags, setAssigningTags] = useState(false);
  const [newContactTags, setNewContactTags] = useState<string[]>([]);
  
  // History state
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState<InvitationStats | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalInvitations, setTotalInvitations] = useState(0);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const perPage = 20;
  
  const { toast } = useToast();

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const validatePhone = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const getStatusBadge = (status: string, hasSignedUp?: boolean, deliveryStatus?: string) => {
    if (hasSignedUp) {
      return <Badge className="bg-green-100 text-green-800">Signed Up</Badge>;
    }
    
    const effectiveStatus = deliveryStatus || status;
    
    switch (effectiveStatus) {
      case 'queued':
      case 'sending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-800">Sent</Badge>;
      case 'delivered':
        return <Badge className="bg-emerald-100 text-emerald-800">Delivered</Badge>;
      case 'failed':
      case 'undelivered':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'signed_up':
        return <Badge className="bg-green-100 text-green-800">Signed Up</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{effectiveStatus || 'Unknown'}</Badge>;
    }
  };

  const getChannelBadge = (channel: string) => {
    if (channel === 'email') {
      return <Badge variant="outline" className="text-purple-600 border-purple-300"><Mail className="w-3 h-3 mr-1" />Email</Badge>;
    }
    return <Badge variant="outline" className="text-blue-600 border-blue-300"><MessageCircle className="w-3 h-3 mr-1" />SMS</Badge>;
  };

  // Fetch tags
  const fetchTags = async () => {
    setLoadingTags(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_tags' }
      });

      if (error) throw error;

      if (data?.success) {
        setTags(data.tags || []);
      }
    } catch (err: any) {
      console.error('Failed to load tags:', err);
    }
    setLoadingTags(false);
  };

  // Fetch pending contacts
  const fetchPendingContacts = async () => {
    setLoadingPending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'get_pending',
          search: pendingSearch || undefined,
          tag_filter: selectedTagFilters.length > 0 ? selectedTagFilters : undefined
        }
      });

      if (error) throw error;

      if (data?.success) {
        setPendingContacts(data.contacts || []);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to load pending contacts', variant: 'destructive' });
    }
    setLoadingPending(false);
  };

  // Fetch invitation history
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'get_history',
          status_filter: statusFilter,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          page: currentPage,
          per_page: perPage
        }
      });

      if (error) throw error;

      if (data?.success) {
        setInvitations(data.invitations || []);
        setTotalInvitations(data.total || 0);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to load invitation history', variant: 'destructive' });
    }
    setLoadingHistory(false);
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_stats' }
      });

      if (error) throw error;

      if (data?.success) {
        setStats(data.stats);
        // Update tag counts from stats
        if (data.tags) {
          setTags(data.tags);
        }
      }
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    }
  };

  // Create or update tag
  const handleSaveTag = async () => {
    if (!newTag.name.trim()) {
      toast({ title: 'Error', description: 'Tag name is required', variant: 'destructive' });
      return;
    }

    setSavingTag(true);
    try {
      const action = editingTag ? 'update_tag' : 'create_tag';
      const body = editingTag 
        ? { action, tag_id: editingTag.id, name: newTag.name, color: newTag.color, description: newTag.description }
        : { action, ...newTag };

      const { data, error } = await supabase.functions.invoke('send-investor-invitation', { body });

      if (error) throw error;

      if (data?.success) {
        toast({ title: editingTag ? 'Tag Updated' : 'Tag Created' });
        setNewTag({ name: '', category: 'custom', color: '#6B7280', description: '' });
        setEditingTag(null);
        fetchTags();
        fetchStats();
      } else {
        throw new Error(data?.error || 'Failed to save tag');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSavingTag(false);
  };

  // Delete tag
  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Delete this tag? It will be removed from all contacts.')) return;

    try {
      const { error } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'delete_tag', tag_id: tagId }
      });

      if (error) throw error;

      toast({ title: 'Tag Deleted' });
      fetchTags();
      fetchStats();
      fetchPendingContacts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Assign tags to selected contacts
  const handleAssignTags = async () => {
    if (selectedTagsToAssign.length === 0) {
      toast({ title: 'Error', description: 'Select at least one tag', variant: 'destructive' });
      return;
    }

    if (selectedPending.size === 0) {
      toast({ title: 'Error', description: 'Select at least one contact', variant: 'destructive' });
      return;
    }

    setAssigningTags(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'assign_tags',
          tag_ids: selectedTagsToAssign,
          invitation_ids: Array.from(selectedPending)
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Tags Assigned', description: `Assigned ${selectedTagsToAssign.length} tag(s) to ${selectedPending.size} contact(s)` });
        setAssignTagsOpen(false);
        setSelectedTagsToAssign([]);
        fetchPendingContacts();
        fetchStats();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAssigningTags(false);
  };

  // Remove tags from contacts
  const handleRemoveTags = async (contactIds: string[], tagIds: string[]) => {
    try {
      const { error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'remove_tags',
          tag_ids: tagIds,
          invitation_ids: contactIds
        }
      });

      if (error) throw error;

      toast({ title: 'Tags Removed' });
      fetchPendingContacts();
      fetchStats();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };
  // Send to contacts by tag filter
  const handleSendByTags = async () => {
    if (selectedTagFilters.length === 0) {
      toast({ title: 'Error', description: 'Select at least one tag to filter by', variant: 'destructive' });
      return;
    }

    setSendingPending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'send_pending',
          tag_filter: selectedTagFilters,
          channel: pendingChannel
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ 
          title: 'Invitations Sent!', 
          description: `${data.sent} invitations sent${data.failed > 0 ? `, ${data.failed} failed` : ''}` 
        });
        fetchPendingContacts();
        fetchHistory();
        fetchStats();
      } else {
        throw new Error(data?.error || 'Failed to send invitations');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSendingPending(false);
  };

  // Send to ALL pending contacts (new function)
  const handleSendAllPending = async () => {
    const count = selectedTagFilters.length > 0 ? pendingContacts.length : (stats?.pending || pendingContacts.length);
    
    if (count === 0) {
      toast({ title: 'Error', description: 'No pending contacts to send to', variant: 'destructive' });
      return;
    }

    const confirmMsg = selectedTagFilters.length > 0 
      ? `Send invitations to ${count} filtered contacts?`
      : `Send invitations to ALL ${count} pending contacts? This action cannot be undone.`;
    
    if (!confirm(confirmMsg)) return;

    setSendingPending(true);
    try {
      // If tag filters are active, use send_pending with tag_filter
      // Otherwise, use send_all_pending to send to ALL
      const action = selectedTagFilters.length > 0 ? 'send_pending' : 'send_all_pending';
      const body: any = {
        action,
        channel: pendingChannel
      };
      
      if (selectedTagFilters.length > 0) {
        body.tag_filter = selectedTagFilters;
      }

      const { data, error } = await supabase.functions.invoke('send-investor-invitation', { body });

      if (error) throw error;

      if (data?.success) {
        const channelText = pendingChannel === 'both' ? 'SMS and email' : pendingChannel.toUpperCase();
        toast({ 
          title: 'Invitations Sent!', 
          description: `${data.sent} ${channelText} invitations sent${data.failed > 0 ? `, ${data.failed} failed` : ''}` 
        });
        setSelectedPending(new Set());
        fetchPendingContacts();
        fetchHistory();
        fetchStats();
      } else {
        throw new Error(data?.error || 'Failed to send invitations');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSendingPending(false);
  };


  // Add single pending contact
  const handleAddPendingContact = async () => {
    if (!newContact.name) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    if (!newContact.phone && !newContact.email) {
      toast({ title: 'Error', description: 'Phone or email is required', variant: 'destructive' });
      return;
    }

    setAddingContact(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'add_pending',
          contacts: [{
            name: newContact.name,
            phone: newContact.phone ? newContact.phone.replace(/\D/g, '') : undefined,
            email: newContact.email || undefined,
            company: newContact.company || undefined,
            notes: newContact.notes || undefined
          }],
          tag_ids: newContactTags.length > 0 ? newContactTags : undefined
        }
      });

      if (error) throw error;

      if (data?.added > 0) {
        toast({ title: 'Contact Added', description: `${newContact.name} added to pending list` });
        setNewContact({ name: '', phone: '', email: '', company: '', notes: '' });
        setNewContactTags([]);
        setAddContactOpen(false);
        fetchPendingContacts();
        fetchStats();
      } else if (data?.results?.[0]?.error) {
        toast({ title: 'Error', description: data.results[0].error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAddingContact(false);
  };

  // Send invitations to selected pending contacts
  const handleSendToPending = async () => {
    if (selectedPending.size === 0) {
      toast({ title: 'Error', description: 'Select at least one contact', variant: 'destructive' });
      return;
    }

    setSendingPending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'send_pending',
          contact_ids: Array.from(selectedPending),
          channel: pendingChannel
        }
      });

      if (error) throw error;

      if (data?.success) {
        const channelText = pendingChannel === 'both' ? 'SMS and email' : pendingChannel.toUpperCase();
        toast({ 
          title: 'Invitations Sent!', 
          description: `${data.sent} ${channelText} invitations sent${data.failed > 0 ? `, ${data.failed} failed` : ''}` 
        });
        setSelectedPending(new Set());
        fetchPendingContacts();
        fetchHistory();
        fetchStats();
      } else {
        throw new Error(data?.error || 'Failed to send invitations');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSendingPending(false);
  };

  // Delete pending contact
  const handleDeletePending = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'delete_pending',
          contact_id: contactId
        }
      });

      if (error) throw error;

      toast({ title: 'Contact Deleted' });
      fetchPendingContacts();
      fetchStats();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Delete selected pending contacts
  const handleDeleteSelectedPending = async () => {
    if (selectedPending.size === 0) {
      toast({ title: 'Error', description: 'Select at least one contact', variant: 'destructive' });
      return;
    }

    if (!confirm(`Delete ${selectedPending.size} selected contacts?`)) return;

    try {
      const { error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'delete_pending_bulk',
          contact_ids: Array.from(selectedPending)
        }
      });

      if (error) throw error;

      toast({ title: 'Contacts Deleted', description: `${selectedPending.size} contacts removed` });
      setSelectedPending(new Set());
      fetchPendingContacts();
      fetchStats();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Resend invitation
  const handleResend = async (invitation: InvitationRecord) => {
    setResendingId(invitation.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'resend',
          invitation_id: invitation.id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ 
          title: 'Invitation Resent!', 
          description: `${invitation.channel === 'email' ? 'Email' : 'SMS'} invitation resent to ${invitation.name}` 
        });
        fetchHistory();
        fetchStats();
      } else {
        throw new Error(data?.error || 'Failed to resend invitation');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setResendingId(null);
  };

  // Load data on mount and when filters change
  useEffect(() => {
    fetchHistory();
  }, [statusFilter, dateFrom, dateTo, currentPage]);

  useEffect(() => {
    fetchStats();
    fetchTags();
    fetchPendingContacts();
  }, []);

  useEffect(() => {
    fetchPendingContacts();
  }, [selectedTagFilters]);

  const handleSingleInvite = async () => {
    if (!singleInvite.name) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    if ((inviteChannel === 'sms' || inviteChannel === 'both') && !singleInvite.phone) {
      toast({ title: 'Error', description: 'Phone number is required for SMS invitations', variant: 'destructive' });
      return;
    }

    if ((inviteChannel === 'email' || inviteChannel === 'both') && !singleInvite.email) {
      toast({ title: 'Error', description: 'Email is required for email invitations', variant: 'destructive' });
      return;
    }

    if (singleInvite.phone && !validatePhone(singleInvite.phone)) {
      toast({ title: 'Error', description: 'Please enter a valid phone number', variant: 'destructive' });
      return;
    }

    if (singleInvite.email && !validateEmail(singleInvite.email)) {
      toast({ title: 'Error', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          channel: inviteChannel,
          contacts: [{
            name: singleInvite.name,
            phone: singleInvite.phone ? singleInvite.phone.replace(/\D/g, '') : undefined,
            email: singleInvite.email || undefined,
            company: singleInvite.company
          }]
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send invitation');
      }

      if (data?.sent > 0) {
        const channelText = inviteChannel === 'both' ? 'SMS and email' : inviteChannel.toUpperCase();
        toast({ 
          title: 'Invitation Sent!', 
          description: `${channelText} invitation sent to ${singleInvite.name}` 
        });
        setSingleInvite({ name: '', phone: '', email: '', company: '' });
        fetchHistory();
        fetchStats();
      } else if (data?.results?.[0]?.error) {
        throw new Error(data.results[0].error);
      } else {
        throw new Error('Failed to send invitation - please check the contact details');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };


  const handleCSVUpload = async (file: File) => {
    setCsvFile(file);
    setParsing(true);
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      const firstLine = lines[0].toLowerCase();
      const hasHeaders = firstLine.includes('name') || firstLine.includes('phone') || firstLine.includes('email') || firstLine.includes('company');
      
      const dataLines = hasHeaders ? lines.slice(1) : lines;
      
      const contacts: ParsedContact[] = dataLines.map(line => {
        const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
        
        let name = '';
        let phone = '';
        let email = '';
        let company = '';
        
        for (const part of parts) {
          const digits = part.replace(/\D/g, '');
          
          if (/@/.test(part) && !email) {
            email = part.toLowerCase();
          }
          else if (digits.length >= 10 && !phone) {
            phone = digits.slice(-10);
          } 
          else if (!name && part.length > 1 && !/^\d+$/.test(part)) {
            if (/\b(inc|llc|corp|company|co|ltd|group|holdings)\b/i.test(part)) {
              company = part;
            } else {
              name = part;
            }
          } else if (!company && part.length > 1 && !/^\d+$/.test(part) && !/@/.test(part)) {
            company = part;
          }
        }
        
        const hasValidPhone = phone.length === 10;
        const hasValidEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const valid = !!name && (hasValidPhone || hasValidEmail);
        
        return {
          name,
          phone: formatPhoneNumber(phone),
          email,
          company,
          valid,
          error: !valid ? (!name ? 'Missing name' : 'No valid phone or email') : undefined
        };
      }).filter(c => c.name || c.phone || c.email);
      
      setParsedContacts(contacts);
      setPreviewOpen(true);
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to parse CSV file', variant: 'destructive' });
    }
    setParsing(false);
  };

  const handleBulkSend = async () => {
    const validContacts = parsedContacts.filter(c => c.valid);
    
    if (validContacts.length === 0) {
      toast({ title: 'Error', description: 'No valid contacts to send', variant: 'destructive' });
      return;
    }

    setBulkSending(true);
    try {
      const action = saveAsPending ? 'add_pending' : undefined;
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action,
          channel: saveAsPending ? undefined : bulkChannel,
          contacts: validContacts.map(c => ({
            name: c.name,
            phone: c.phone ? c.phone.replace(/\D/g, '') : undefined,
            email: c.email || undefined,
            company: c.company
          }))
        }
      });

      if (saveAsPending) {
        if (data?.added > 0) {
          toast({ 
            title: 'Contacts Saved!', 
            description: `${data.added} contacts added to pending list${data.skipped > 0 ? `, ${data.skipped} skipped` : ''}` 
          });
          setPreviewOpen(false);
          setParsedContacts([]);
          setCsvFile(null);
          fetchPendingContacts();
          fetchStats();
        } else {
          throw new Error(data?.error || 'Failed to save contacts');
        }
      } else {
        if (data?.success) {
          toast({ 
            title: 'Invitations Sent!', 
            description: `${data.sent} invitations sent successfully${data.failed > 0 ? `, ${data.failed} failed` : ''}` 
          });
          setPreviewOpen(false);
          setParsedContacts([]);
          setCsvFile(null);
          fetchHistory();
          fetchStats();
        } else {
          throw new Error(data?.error || 'Failed to send invitations');
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setBulkSending(false);
  };

  const removeContact = (index: number) => {
    setParsedContacts(prev => prev.filter((_, i) => i !== index));
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedPending.size === pendingContacts.length) {
      setSelectedPending(new Set());
    } else {
      setSelectedPending(new Set(pendingContacts.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedPending);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPending(newSelected);
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagFilters(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const validCount = parsedContacts.filter(c => c.valid).length;
  const invalidCount = parsedContacts.filter(c => !c.valid).length;
  const totalPages = Math.ceil(totalInvitations / perPage);

  // Group tags by category
  const tagsByCategory = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, InvestorTag[]>);

  const invitationMessage = `Hi [Name]! You're invited to join Access Your Place - the premier platform for rental arbitrage investors. 

Benefits of joining:
• Track slow & peak seasons for your units
• Sell your operations to verified buyers
• Access exclusive resources & knowledge
• Track upcoming investments
• Acquire new properties with expert support
• Connect with our investor community

Create your free account: [Link]

- The Access Your Place Team`;

  return (
    <div className="space-y-6" role="main" aria-label="Investor Invitation Management">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Invite Investors</h2>
          <p className="text-gray-600">
            Send SMS and email invitations to potential investors to join the platform
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.open('/staff/quick-add', '_blank')}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Smartphone className="w-4 h-4 mr-2" />
            Mobile Quick Add
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
          <Button variant="outline" onClick={() => setTagManagementOpen(true)}>
            <Tags className="w-4 h-4 mr-2" />
            Manage Tags
          </Button>
        </div>
      </div>

      {/* Mobile Quick Add Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900">Add Contacts On-the-Go</h4>
            <p className="text-sm text-blue-700 mt-1">
              Share the mobile-friendly Quick Add page with your success team so they can add investor contacts directly from their phones at events, meetings, or anywhere.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button 
                size="sm" 
                variant="outline"
                className="text-blue-600 border-blue-300 hover:bg-blue-100"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/staff/quick-add`);
                  toast({ title: 'Link Copied!', description: 'Share this link with your team' });
                }}
              >
                Copy Link
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="text-blue-600 border-blue-300 hover:bg-blue-100"
                onClick={() => window.open('/staff/quick-add', '_blank')}
              >
                Open Quick Add
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>



      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold text-orange-700">{stats.pending}</p>
                  <p className="text-xs text-orange-600">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total - stats.pending}</p>
                  <p className="text-xs text-gray-500">Total Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.sms_sent || 0}</p>
                  <p className="text-xs text-gray-500">SMS Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.email_sent || 0}</p>
                  <p className="text-xs text-gray-500">Email Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                  <p className="text-xs text-gray-500">Delivered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                  <p className="text-xs text-gray-500">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.signed_up}</p>
                  <p className="text-xs text-gray-500">Signed Up</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList aria-label="Invitation methods">
          <TabsTrigger value="pending" onClick={fetchPendingContacts}>
            <Clock className="w-4 h-4 mr-2" aria-hidden="true" />
            Pending Invites ({stats?.pending || 0})
          </TabsTrigger>
          <TabsTrigger value="single">
            <Send className="w-4 h-4 mr-2" aria-hidden="true" />
            Single Invite
          </TabsTrigger>
          <TabsTrigger value="bulk">
            <FileSpreadsheet className="w-4 h-4 mr-2" aria-hidden="true" />
            CSV Upload
          </TabsTrigger>
          <TabsTrigger value="history" onClick={() => { fetchHistory(); fetchStats(); }}>
            <History className="w-4 h-4 mr-2" aria-hidden="true" />
            Invitation History
          </TabsTrigger>
          <TabsTrigger value="message">
            <MessageSquare className="w-4 h-4 mr-2" aria-hidden="true" />
            Message Preview
          </TabsTrigger>
        </TabsList>

        {/* Pending Invites Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pending Invites</span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAddContactOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchPendingContacts}
                    disabled={loadingPending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingPending ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Contacts that have been added but not yet sent an invitation. Use tags to organize and filter contacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search, Tag Filters, and Actions */}
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="pending-search" className="sr-only">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="pending-search"
                      placeholder="Search by name, email, phone..."
                      value={pendingSearch}
                      onChange={(e) => setPendingSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchPendingContacts()}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                {/* Tag Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[150px]">
                      <Tags className="w-4 h-4 mr-2" />
                      Filter by Tags
                      {selectedTagFilters.length > 0 && (
                        <Badge className="ml-2 bg-[#d4a574] text-white">{selectedTagFilters.length}</Badge>
                      )}
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 max-h-[400px] overflow-y-auto">
                    {selectedTagFilters.length > 0 && (
                      <>
                        <DropdownMenuLabel className="flex items-center justify-between">
                          <span>Active Filters</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => setSelectedTagFilters([])}
                          >
                            Clear All
                          </Button>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
                      <div key={category}>
                        <DropdownMenuLabel className="flex items-center gap-2">
                          {TAG_CATEGORY_ICONS[category] && (
                            <span className="text-gray-400">
                              {(() => {
                                const Icon = TAG_CATEGORY_ICONS[category];
                                return <Icon className="w-3 h-3" />;
                              })()}
                            </span>
                          )}
                          {TAG_CATEGORY_LABELS[category] || category}
                        </DropdownMenuLabel>
                        {categoryTags.map(tag => (
                          <DropdownMenuCheckboxItem
                            key={tag.id}
                            checked={selectedTagFilters.includes(tag.id)}
                            onCheckedChange={() => toggleTagFilter(tag.id)}
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: tag.color }}
                              />
                              <span>{tag.name}</span>
                              {tag.count !== undefined && (
                                <span className="text-xs text-gray-400">({tag.count})</span>
                              )}
                            </div>
                          </DropdownMenuCheckboxItem>
                        ))}
                        <DropdownMenuSeparator />
                      </div>
                    ))}
                    {tags.length === 0 && (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No tags created yet
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Send All Pending Button - Always visible when there are pending contacts */}
                {pendingContacts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select value={pendingChannel} onValueChange={(v: 'sms' | 'email' | 'both') => setPendingChannel(v)}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Both</SelectItem>
                        <SelectItem value="sms">SMS Only</SelectItem>
                        <SelectItem value="email">Email Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleSendAllPending}
                      disabled={sendingPending}
                      className="bg-[#1e3a5f] hover:bg-[#2d5a87]"
                    >
                      {sendingPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <Send className="w-4 h-4 mr-2" />
                      {selectedTagFilters.length > 0 
                        ? `Send to Filtered (${pendingContacts.length})`
                        : `Send All Pending (${stats?.pending || pendingContacts.length})`
                      }
                    </Button>
                  </div>
                )}
              </div>



              {/* Selected Tag Filters Display */}
              {selectedTagFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500 mr-2">Filtering by:</span>
                  {selectedTagFilters.map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <Badge 
                        key={tag.id}
                        className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: tag.color, color: '#fff' }}
                        onClick={() => toggleTagFilter(tag.id)}
                      >
                        {tag.name}
                        <X className="w-3 h-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Selection Actions */}
              {selectedPending.size > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg items-center">
                  <span className="text-sm font-medium text-blue-700">
                    {selectedPending.size} selected:
                  </span>
                  
                  <Select value={pendingChannel} onValueChange={(v: 'sms' | 'email' | 'both') => setPendingChannel(v)}>
                    <SelectTrigger className="w-[150px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both SMS & Email</SelectItem>
                      <SelectItem value="sms">SMS Only</SelectItem>
                      <SelectItem value="email">Email Only</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    size="sm"
                    onClick={handleSendToPending}
                    disabled={sendingPending}
                    className="bg-[#d4a574] hover:bg-[#c49464]"
                  >
                    {sendingPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Send className="w-4 h-4 mr-2" />
                    Send Invitations
                  </Button>
                  
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignTagsOpen(true)}
                  >
                    <Tag className="w-4 h-4 mr-2" />
                    Assign Tags
                  </Button>
                  
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteSelectedPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}

              {/* Pending Contacts Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={pendingContacts.length > 0 && selectedPending.size === pendingContacts.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPending ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          <p className="text-gray-500">Loading pending contacts...</p>
                        </TableCell>
                      </TableRow>
                    ) : pendingContacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <UserPlus className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                          <p className="text-gray-500 font-medium">
                            {selectedTagFilters.length > 0 ? 'No contacts match the selected tags' : 'No pending contacts'}
                          </p>
                          <p className="text-sm text-gray-400">
                            {selectedTagFilters.length > 0 ? 'Try removing some tag filters' : 'Add contacts manually or upload a CSV to get started'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingContacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPending.has(contact.id)}
                              onCheckedChange={() => toggleSelect(contact.id)}
                              aria-label={`Select ${contact.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              {contact.company && (
                                <p className="text-xs text-gray-500">{contact.company}</p>
                              )}
                              {contact.notes && (
                                <p className="text-xs text-gray-400 truncate max-w-[200px]" title={contact.notes}>
                                  {contact.notes}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {contact.phone && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  {formatPhoneDisplay(contact.phone)}
                                </div>
                              )}
                              {contact.email && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Mail className="w-3 h-3 text-gray-400" />
                                  {contact.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {contact.tags && contact.tags.length > 0 ? (
                                contact.tags.map(tag => (
                                  <Badge 
                                    key={tag.id}
                                    className="text-xs cursor-pointer hover:opacity-80"
                                    style={{ backgroundColor: tag.color, color: '#fff' }}
                                    onClick={() => handleRemoveTags([contact.id], [tag.id])}
                                    title="Click to remove"
                                  >
                                    {tag.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400">No tags</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {new Date(contact.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingContact(contact)}
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePending(contact.id)}
                                className="text-red-500 hover:text-red-700"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {pendingContacts.length > 0 && (
                <div className="text-sm text-gray-500">
                  {selectedPending.size > 0 
                    ? `${selectedPending.size} of ${pendingContacts.length} contacts selected`
                    : `${pendingContacts.length} pending contacts`
                  }
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Single Invite Tab */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Send Individual Invitation</CardTitle>
              <CardDescription>
                Enter the investor's details to send them an SMS and/or email invitation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSingleInvite(); }}
                className="space-y-4 max-w-md"
                aria-label="Single invitation form"
              >
                <div>
                  <Label htmlFor="invite-name">Name *</Label>
                  <Input
                    id="invite-name"
                    value={singleInvite.name}
                    onChange={(e) => setSingleInvite({ ...singleInvite, name: e.target.value })}
                    placeholder="John Doe"
                    aria-required="true"
                  />
                </div>
                
                <div>
                  <Label htmlFor="invite-phone">Phone Number {inviteChannel !== 'email' ? '*' : '(Optional)'}</Label>
                  <Input
                    id="invite-phone"
                    type="tel"
                    value={singleInvite.phone}
                    onChange={(e) => setSingleInvite({ ...singleInvite, phone: formatPhoneNumber(e.target.value) })}
                    placeholder="(555) 123-4567"
                    aria-required={inviteChannel !== 'email'}
                  />
                </div>

                <div>
                  <Label htmlFor="invite-email">Email Address {inviteChannel !== 'sms' ? '*' : '(Optional)'}</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={singleInvite.email}
                    onChange={(e) => setSingleInvite({ ...singleInvite, email: e.target.value })}
                    placeholder="john@example.com"
                    aria-required={inviteChannel !== 'sms'}
                  />
                </div>
                
                <div>
                  <Label htmlFor="invite-company">Company (Optional)</Label>
                  <Input
                    id="invite-company"
                    value={singleInvite.company}
                    onChange={(e) => setSingleInvite({ ...singleInvite, company: e.target.value })}
                    placeholder="ABC Properties LLC"
                  />
                </div>

                <div>
                  <Label htmlFor="invite-channel">Send Via</Label>
                  <Select value={inviteChannel} onValueChange={(v: 'sms' | 'email' | 'both') => setInviteChannel(v)}>
                    <SelectTrigger id="invite-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" />
                          <Mail className="w-4 h-4" />
                          Both SMS & Email
                        </div>
                      </SelectItem>
                      <SelectItem value="sms">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" />
                          SMS Only
                        </div>
                      </SelectItem>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email Only
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={sending}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                  <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                  Send Invitation
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CSV Upload Tab */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk CSV Upload</CardTitle>
              <CardDescription>
                Upload a CSV file with investor contacts. You can send invitations immediately or save them as pending.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Area */}
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" aria-hidden="true" />
                <p className="text-lg font-medium mb-2">Upload CSV File</p>
                <p className="text-sm text-gray-500 mb-4">
                  CSV should contain columns for name, phone number, email, and optionally company name
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCSVUpload(file);
                  }}
                  className="max-w-xs mx-auto"
                  aria-label="Upload CSV file"
                />
                {parsing && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Parsing CSV...</span>
                  </div>
                )}
              </div>

              {/* CSV Format Guide */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">CSV Format Guide</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Your CSV can be in various formats. The system will automatically detect:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li>Phone numbers (10 or 11 digits)</li>
                  <li>Email addresses (contains @)</li>
                  <li>Names (text without numbers)</li>
                  <li>Company names (text containing Inc, LLC, Corp, etc.)</li>
                </ul>
                <div className="mt-3 p-3 bg-white rounded border font-mono text-xs">
                  <p>Example formats:</p>
                  <p className="text-gray-500 mt-1">John Doe, (555) 123-4567, john@example.com, ABC Properties LLC</p>
                  <p className="text-gray-500">Jane Smith, 5551234567, jane@company.com</p>
                  <p className="text-gray-500">Bob Johnson, bob@email.com</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitation History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Invitation History</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { fetchHistory(); fetchStats(); }}
                  disabled={loadingHistory}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingHistory ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardTitle>
              <CardDescription>
                View all previously sent SMS and email invitations and their status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 items-end p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor="status-filter" className="text-sm">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="signed_up">Signed Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor="date-from" className="text-sm">From Date</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                
                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor="date-to" className="text-sm">To Date</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>

              {/* Results count */}
              <div className="text-sm text-gray-500">
                Showing {invitations.length} of {totalInvitations} invitations
              </div>

              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent Date</TableHead>
                      <TableHead>Account Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingHistory ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          <p className="text-gray-500">Loading invitations...</p>
                        </TableCell>
                      </TableRow>
                    ) : invitations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <History className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                          <p className="text-gray-500">No invitations found</p>
                          <p className="text-sm text-gray-400">Send your first invitation to get started</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{invitation.name}</p>
                              {invitation.company && (
                                <p className="text-xs text-gray-500">{invitation.company}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {invitation.channel === 'email' ? (
                                <span>{invitation.email}</span>
                              ) : (
                                <span>{formatPhoneDisplay(invitation.phone)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getChannelBadge(invitation.channel)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {getStatusBadge(invitation.status, invitation.has_signed_up, invitation.delivery_status)}
                              {invitation.error_message && (
                                <span className="text-xs text-red-500 max-w-[150px] truncate" title={invitation.error_message}>
                                  {invitation.twilio_error_code ? `Error ${invitation.twilio_error_code}` : invitation.error_message}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="w-3 h-3 text-gray-400" />
                              {formatDate(invitation.sent_at)}
                            </div>
                            {invitation.resend_count && invitation.resend_count > 0 && (
                              <span className="text-xs text-gray-400">
                                (Resent {invitation.resend_count}x)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {invitation.has_signed_up ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <UserCheck className="w-4 h-4" />
                                <span className="text-sm">Yes</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">No</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {(invitation.status === 'failed' || (!invitation.has_signed_up && invitation.status !== 'signed_up')) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResend(invitation)}
                                disabled={resendingId === invitation.id}
                              >
                                {resendingId === invitation.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                    Resend
                                  </>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loadingHistory}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || loadingHistory}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Message Preview Tab */}
        <TabsContent value="message">
          <Card>
            <CardHeader>
              <CardTitle>Invitation Message Preview</CardTitle>
              <CardDescription>
                This is the message that will be sent to invited investors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  SMS Message
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                    {invitationMessage}
                  </pre>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Message
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700">
                    Email invitations include a professionally designed HTML template with:
                  </p>
                  <ul className="text-sm text-gray-600 list-disc list-inside mt-2 space-y-1">
                    <li>Branded header with Access Your Place logo</li>
                    <li>Personalized greeting with investor's name</li>
                    <li>List of platform benefits</li>
                    <li>Prominent call-to-action button</li>
                    <li>Direct signup link</li>
                  </ul>
                </div>
              </div>
              
              <p className="text-sm text-gray-500">
                Note: [Name] will be replaced with the investor's name, and [Link] will be replaced with a unique signup link.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tag Management Dialog */}
      <Dialog open={tagManagementOpen} onOpenChange={setTagManagementOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Create and manage tags to categorize your investor contacts by source, interest level, market preference, or custom categories.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Create/Edit Tag Form */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <h4 className="font-medium">{editingTag ? 'Edit Tag' : 'Create New Tag'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tag-name">Tag Name *</Label>
                  <Input
                    id="tag-name"
                    value={newTag.name}
                    onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                    placeholder="e.g., Hot Lead, Dallas Market"
                  />
                </div>
                <div>
                  <Label htmlFor="tag-category">Category *</Label>
                  <Select 
                    value={newTag.category} 
                    onValueChange={(v: 'source' | 'interest_level' | 'market' | 'custom') => setNewTag({ ...newTag, category: v })}
                    disabled={!!editingTag}
                  >
                    <SelectTrigger id="tag-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="source">Source (how they found us)</SelectItem>
                      <SelectItem value="interest_level">Interest Level (hot/warm/cold)</SelectItem>
                      <SelectItem value="market">Market (preferred locations)</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tag-color">Color</Label>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <div 
                            className="w-5 h-5 rounded mr-2" 
                            style={{ backgroundColor: newTag.color }}
                          />
                          {newTag.color}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3">
                        <div className="grid grid-cols-6 gap-2">
                          {DEFAULT_TAG_COLORS.map(color => (
                            <button
                              key={color}
                              className={`w-8 h-8 rounded-full border-2 ${newTag.color === color ? 'border-gray-900' : 'border-transparent'}`}
                              style={{ backgroundColor: color }}
                              onClick={() => setNewTag({ ...newTag, color })}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div>
                  <Label htmlFor="tag-description">Description (optional)</Label>
                  <Input
                    id="tag-description"
                    value={newTag.description}
                    onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                    placeholder="Brief description..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveTag}
                  disabled={savingTag || !newTag.name.trim()}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {savingTag && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingTag ? 'Update Tag' : 'Create Tag'}
                </Button>
                {editingTag && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setEditingTag(null);
                      setNewTag({ name: '', category: 'custom', color: '#6B7280', description: '' });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Existing Tags by Category */}
            {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
              <div key={category}>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  {TAG_CATEGORY_ICONS[category] && (
                    <span className="text-gray-400">
                      {(() => {
                        const Icon = TAG_CATEGORY_ICONS[category];
                        return <Icon className="w-4 h-4" />;
                      })()}
                    </span>
                  )}
                  {TAG_CATEGORY_LABELS[category] || category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {categoryTags.map(tag => (
                    <div 
                      key={tag.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-white group"
                      style={{ backgroundColor: tag.color }}
                    >
                      <span>{tag.name}</span>
                      {tag.count !== undefined && (
                        <span className="opacity-75">({tag.count})</span>
                      )}
                      <button
                        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setEditingTag(tag);
                          setNewTag({ name: tag.name, category: tag.category, color: tag.color, description: tag.description || '' });
                        }}
                        title="Edit"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteTag(tag.id)}
                        title="Delete"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {categoryTags.length === 0 && (
                    <span className="text-sm text-gray-400">No tags in this category</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTagManagementOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tags Dialog */}
      <Dialog open={assignTagsOpen} onOpenChange={setAssignTagsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Tags</DialogTitle>
            <DialogDescription>
              Select tags to assign to {selectedPending.size} selected contact(s).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
              <div key={category}>
                <h4 className="font-medium mb-2 text-sm text-gray-500">
                  {TAG_CATEGORY_LABELS[category] || category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {categoryTags.map(tag => (
                    <Badge 
                      key={tag.id}
                      className={`cursor-pointer transition-all ${
                        selectedTagsToAssign.includes(tag.id) 
                          ? 'ring-2 ring-offset-2 ring-gray-400' 
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: tag.color, color: '#fff' }}
                      onClick={() => {
                        setSelectedTagsToAssign(prev => 
                          prev.includes(tag.id) 
                            ? prev.filter(id => id !== tag.id)
                            : [...prev, tag.id]
                        );
                      }}
                    >
                      {tag.name}
                      {selectedTagsToAssign.includes(tag.id) && (
                        <CheckCircle className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            {tags.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No tags created yet. Create tags in the Tag Management section.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTagsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignTags}
              disabled={assigningTags || selectedTagsToAssign.length === 0}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {assigningTags && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign {selectedTagsToAssign.length} Tag(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent aria-describedby="add-contact-description">
          <DialogHeader>
            <DialogTitle>Add Pending Contact</DialogTitle>
            <DialogDescription id="add-contact-description">
              Add a contact to the pending list. You can send them an invitation later.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-name">Name *</Label>
              <Input
                id="new-name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <Label htmlFor="new-phone">Phone Number</Label>
              <Input
                id="new-phone"
                type="tel"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: formatPhoneNumber(e.target.value) })}
                placeholder="(555) 123-4567"
              />
            </div>
            
            <div>
              <Label htmlFor="new-email">Email Address</Label>
              <Input
                id="new-email"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            
            <div>
              <Label htmlFor="new-company">Company</Label>
              <Input
                id="new-company"
                value={newContact.company}
                onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                placeholder="ABC Properties LLC"
              />
            </div>
            
            <div>
              <Label htmlFor="new-notes">Notes</Label>
              <Textarea
                id="new-notes"
                value={newContact.notes}
                onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                placeholder="Any notes about this contact..."
                rows={2}
              />
            </div>

            {/* Tags Selection */}
            <div>
              <Label>Tags (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-lg min-h-[60px]">
                {tags.length > 0 ? (
                  tags.map(tag => (
                    <Badge 
                      key={tag.id}
                      className={`cursor-pointer transition-all ${
                        newContactTags.includes(tag.id) 
                          ? 'ring-2 ring-offset-1 ring-gray-400' 
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: tag.color, color: '#fff' }}
                      onClick={() => {
                        setNewContactTags(prev => 
                          prev.includes(tag.id) 
                            ? prev.filter(id => id !== tag.id)
                            : [...prev, tag.id]
                        );
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">No tags available</span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddContactOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddPendingContact}
              disabled={addingContact}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {addingContact && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Save Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" aria-describedby="csv-preview-description">
          <DialogHeader>
            <DialogTitle>Review Contacts</DialogTitle>
            <DialogDescription id="csv-preview-description">
              Review the parsed contacts before sending invitations or saving as pending
            </DialogDescription>
          </DialogHeader>

          {/* Options */}
          <div className="flex flex-wrap gap-4 items-center mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-as-pending"
                checked={saveAsPending}
                onCheckedChange={(checked) => setSaveAsPending(checked === true)}
              />
              <Label htmlFor="save-as-pending" className="cursor-pointer">
                Save as pending (don't send yet)
              </Label>
            </div>
            
            {!saveAsPending && (
              <Select value={bulkChannel} onValueChange={(v: 'sms' | 'email' | 'both') => setBulkChannel(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both SMS & Email</SelectItem>
                  <SelectItem value="sms">SMS Only</SelectItem>
                  <SelectItem value="email">Email Only</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
              <span className="font-medium">{validCount} valid</span>
            </div>
            {invalidCount > 0 && (
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
                <span className="font-medium">{invalidCount} invalid</span>
              </div>
            )}
          </div>

          {/* Contacts Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="w-[50px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedContacts.map((contact, index) => (
                  <TableRow key={index} className={!contact.valid ? 'bg-red-50' : ''}>
                    <TableCell>
                      {contact.valid ? (
                        <CheckCircle className="w-5 h-5 text-green-500" aria-label="Valid" />
                      ) : (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
                          <span className="text-xs text-red-600">{contact.error}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{contact.name || '-'}</TableCell>
                    <TableCell>{contact.phone || '-'}</TableCell>
                    <TableCell>{contact.email || '-'}</TableCell>
                    <TableCell>{contact.company || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeContact(index)}
                        aria-label={`Remove ${contact.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkSend}
              disabled={bulkSending || validCount === 0}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {bulkSending && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              {saveAsPending ? (
                <>
                  <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                  Save {validCount} as Pending
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                  Send {validCount} Invitations
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      {editingContact && (
        <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
          <DialogContent aria-describedby="edit-contact-description">
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
              <DialogDescription id="edit-contact-description">
                Update the contact information
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={editingContact.name}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editingContact.phone ? formatPhoneDisplay(editingContact.phone) : ''}
                  onChange={(e) => setEditingContact({ ...editingContact, phone: formatPhoneNumber(e.target.value) })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-email">Email Address</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingContact.email || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-company">Company</Label>
                <Input
                  id="edit-company"
                  value={editingContact.company || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, company: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editingContact.notes || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingContact(null)}>
                Cancel
              </Button>
              <Button 
                onClick={async () => {
                  try {
                    const { error } = await supabase.functions.invoke('send-investor-invitation', {
                      body: {
                        action: 'update_pending',
                        contact_id: editingContact.id,
                        name: editingContact.name,
                        phone: editingContact.phone?.replace(/\D/g, '') || '',
                        email: editingContact.email || '',
                        company: editingContact.company || '',
                        notes: editingContact.notes || ''
                      }
                    });
                    
                    if (error) throw error;
                    
                    toast({ title: 'Contact Updated' });
                    setEditingContact(null);
                    fetchPendingContacts();
                  } catch (err: any) {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                  }
                }}
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
