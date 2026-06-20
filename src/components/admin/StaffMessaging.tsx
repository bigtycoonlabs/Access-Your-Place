import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, MessageSquare, Send, User, Clock, CheckCheck, 
  Check, Search, FileText, Plus, Users, UserCircle,
  Mail, MailCheck, MailX, RefreshCw, Eye, ChevronRight
} from 'lucide-react';

interface Message {
  id: string;
  investor_id: string;
  subject?: string;
  message: string;
  sender_type: 'investor' | 'staff';
  sender_name?: string;
  read: boolean;
  read_at?: string;
  email_notification_sent?: boolean;
  email_delivery_id?: string;
  created_at: string;
}

interface StaffMessage {
  id: string;
  from_staff_id: string;
  to_staff_id: string;
  subject?: string;
  message: string;
  is_read: boolean;
  read_at?: string;
  email_notification_sent?: boolean;
  email_delivery_id?: string;
  created_at: string;
  sender_name?: string;
  is_from_me?: boolean;
}

interface Conversation {
  investor_id: string;
  messages: Message[];
  unread_count: number;
  last_message: Message | null;
}

interface StaffConversation {
  partner_id: string;
  partner_name: string;
  messages: StaffMessage[];
  unread_count: number;
  last_message: StaffMessage | null;
}

interface Template {
  id: string;
  name: string;
  subject?: string;
  body: string;
  category?: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Props {
  staffId: string;
  staffName: string;
}

export function StaffMessaging({ staffId, staffName }: Props) {
  const [activeTab, setActiveTab] = useState<'investors' | 'staff'>('investors');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [staffConversations, setStaffConversations] = useState<StaffConversation[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [investorNames, setInvestorNames] = useState<Record<string, string>>({});
  const [investorEmails, setInvestorEmails] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedStaffConversation, setSelectedStaffConversation] = useState<string | null>(null);
  
  // Separate message state for each context
  const [investorMessage, setInvestorMessage] = useState('');
  const [investorSubject, setInvestorSubject] = useState('');
  const [staffMessage, setStaffMessage] = useState('');
  const [staffSubject, setStaffSubject] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [newStaffMessageOpen, setNewStaffMessageOpen] = useState(false);
  const [selectedStaffRecipient, setSelectedStaffRecipient] = useState<string>('');
  const [newStaffModalMessage, setNewStaffModalMessage] = useState('');
  const [newStaffModalSubject, setNewStaffModalSubject] = useState('');

  // NEW: New investor message modal state
  const [newInvestorMessageOpen, setNewInvestorMessageOpen] = useState(false);
  const [newInvSearch, setNewInvSearch] = useState('');
  const [newInvResults, setNewInvResults] = useState<Array<{id: string; full_name: string; email: string}>>([]);
  const [newInvSelected, setNewInvSelected] = useState<{id: string; full_name: string; email: string} | null>(null);
  const [newInvSubject, setNewInvSubject] = useState('');
  const [newInvMessage, setNewInvMessage] = useState('');
  const [searchingInvestors, setSearchingInvestors] = useState(false);

  const [lastEmailStatus, setLastEmailStatus] = useState<{ sent: boolean; message: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const investorTextareaRef = useRef<HTMLTextAreaElement>(null);
  const staffTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [staffId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation, selectedStaffConversation, conversations, staffConversations]);

  useEffect(() => {
    if (selectedConversation) {
      const conv = conversations.find(c => c.investor_id === selectedConversation);
      if (conv && conv.unread_count > 0) {
        const unreadMsgs = conv.messages.filter(m => !m.read && m.sender_type === 'investor');
        unreadMsgs.forEach(async (msg) => {
          await supabase.functions.invoke('investor-messaging', {
            body: { action: 'mark_read', message_id: msg.id, investor_id: selectedConversation }
          });
        });
        setConversations(prev => prev.map(c => 
          c.investor_id === selectedConversation 
            ? { ...c, unread_count: 0, messages: c.messages.map(m => ({ ...m, read: true })) }
            : c
        ));
      }
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (selectedStaffConversation) {
      const conv = staffConversations.find(c => c.partner_id === selectedStaffConversation);
      if (conv && conv.unread_count > 0) {
        supabase.functions.invoke('investor-messaging', {
          body: { action: 'mark_staff_conversation_read', staff_id: staffId, partner_id: selectedStaffConversation }
        });
        setStaffConversations(prev => prev.map(c =>
          c.partner_id === selectedStaffConversation
            ? { ...c, unread_count: 0, messages: c.messages.map(m => ({ ...m, is_read: true })) }
            : c
        ));
      }
    }
  }, [selectedStaffConversation]);

  const loadData = async () => {
    try {
      // Load all data sources in parallel
      const [messagesRes, templatesRes, staffMessagesRes, staffListRes] = await Promise.all([
        supabase.functions.invoke('investor-messaging', {
          body: { action: 'get_am_messages', staff_id: staffId }
        }),
        supabase.functions.invoke('investor-messaging', {
          body: { action: 'get_templates' }
        }),
        supabase.functions.invoke('investor-messaging', {
          body: { action: 'get_staff_messages', staff_id: staffId }
        }),
        supabase.functions.invoke('investor-messaging', {
          body: { action: 'get_staff_for_messaging', exclude_staff_id: staffId }
        })
      ]);

      // Also try to load ALL investor messages (not just assigned) for success team view
      let allConversations = messagesRes.data?.conversations || [];
      
      // If no conversations from assigned investors, try getting all
      if (allConversations.length === 0) {
        try {
          const allMsgRes = await supabase.functions.invoke('investor-messaging', {
            body: { action: 'get_all_investor_messages', limit: 200 }
          });
          if (allMsgRes.data?.conversations?.length > 0) {
            allConversations = allMsgRes.data.conversations;
          }
        } catch {}
      }

      setConversations(allConversations);
      setTemplates(templatesRes.data?.templates || []);
      setStaffConversations(staffMessagesRes.data?.conversations || []);
      setAllStaff(staffListRes.data?.staff || []);

      // Load investor names and emails
      const investorIds = allConversations.map((c: Conversation) => c.investor_id);
      if (investorIds.length > 0) {
        // Try multiple approaches to get investor names
        const names: Record<string, string> = {};
        const emails: Record<string, string> = {};
        
        // First try: get assigned investors
        try {
          const { data: investors } = await supabase.functions.invoke('manage-investor-admin', {
            body: { action: 'get_all_investors', limit: 500 }
          });
          (investors?.investors || []).forEach((inv: any) => {
            names[inv.id] = inv.full_name || inv.email?.split('@')[0] || 'Unknown';
            emails[inv.id] = inv.email || '';
          });
        } catch {
          // Fallback: direct query
          try {
            const { data: invData } = await supabase
              .from('investors')
              .select('id, full_name, email')
              .in('id', investorIds);
            (invData || []).forEach((inv: any) => {
              names[inv.id] = inv.full_name || inv.email?.split('@')[0] || 'Unknown';
              emails[inv.id] = inv.email || '';
            });
          } catch {}
        }

        // Also extract names from messages themselves
        allConversations.forEach((conv: Conversation) => {
          if (!names[conv.investor_id]) {
            const invMsg = conv.messages.find(m => m.sender_type === 'investor' && m.sender_name);
            if (invMsg?.sender_name) {
              names[conv.investor_id] = invMsg.sender_name;
            }
          }
        });

        setInvestorNames(prev => ({ ...prev, ...names }));
        setInvestorEmails(prev => ({ ...prev, ...emails }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Search investors for new message modal
  const handleSearchNewInvestor = async (query: string) => {
    setNewInvSearch(query);
    if (query.length < 2) { setNewInvResults([]); return; }
    setSearchingInvestors(true);
    try {
      const { data } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'search_investors', query }
      });
      if (data?.investors) {
        setNewInvResults(data.investors.slice(0, 15).map((i: any) => ({
          id: i.id,
          full_name: i.full_name || i.email?.split('@')[0] || 'Unknown',
          email: i.email || ''
        })));
      }
    } catch {
      try {
        const { data } = await supabase
          .from('investors')
          .select('id, full_name, email')
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(15);
        if (data) setNewInvResults(data.map(i => ({
          id: i.id,
          full_name: i.full_name || i.email?.split('@')[0] || 'Unknown',
          email: i.email || ''
        })));
      } catch {}
    }
    setSearchingInvestors(false);
  };

  const handleSendNewInvestorMessage = async () => {
    if (!newInvMessage.trim() || !newInvSelected) return;
    setSending(true);
    setLastEmailStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: {
          action: 'send_to_investor',
          investor_id: newInvSelected.id,
          message: newInvMessage.trim(),
          subject: newInvSubject.trim() || 'Message from your Success Team',
          staff_id: staffId,
          staff_name: staffName
        }
      });
      if (error || data?.error) throw new Error(data?.error || 'Failed to send');

      const emailSent = data?.email_sent;
      
      // Also try dedicated email notification
      if (!emailSent && newInvSelected.email) {
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              action: 'new_message',
              investor_id: newInvSelected.id,
              investor_name: newInvSelected.full_name,
              investor_email: newInvSelected.email,
              staff_name: staffName,
              message_subject: newInvSubject.trim() || 'Message from your Success Team',
              message_preview: newInvMessage.trim().substring(0, 200)
            }
          });
        } catch {}
      }

      toast({ 
        title: 'Message Sent!', 
        description: `Message delivered to ${newInvSelected.full_name}. ${emailSent ? 'Email notification sent.' : ''}` 
      });

      // Update local state
      setInvestorNames(prev => ({ ...prev, [newInvSelected.id]: newInvSelected.full_name }));
      setInvestorEmails(prev => ({ ...prev, [newInvSelected.id]: newInvSelected.email }));
      
      setNewInvestorMessageOpen(false);
      setNewInvSelected(null);
      setNewInvSearch('');
      setNewInvSubject('');
      setNewInvMessage('');
      setNewInvResults([]);
      
      // Select the new conversation
      setSelectedConversation(newInvSelected.id);
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSendToInvestor = useCallback(async () => {
    if (!investorMessage.trim() || !selectedConversation) return;
    setSending(true);
    setLastEmailStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: {
          action: 'send_to_investor',
          investor_id: selectedConversation,
          message: investorMessage.trim(),
          subject: investorSubject.trim() || 'Message from your AM',
          staff_id: staffId,
          staff_name: staffName
        }
      });
      if (error || data?.error) throw new Error(data?.error || 'Failed to send');

      const emailSent = data?.email_sent;
      const investorName = investorNames[selectedConversation] || 'Investor';
      const investorEmail = investorEmails[selectedConversation] || '';
      
      // If edge function didn't send email, try dedicated notification
      if (!emailSent && investorEmail) {
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              action: 'new_message',
              investor_id: selectedConversation,
              investor_name: investorName,
              investor_email: investorEmail,
              staff_name: staffName,
              message_subject: investorSubject.trim() || 'Message from your AM',
              message_preview: investorMessage.trim().substring(0, 200)
            }
          });
        } catch {}
      }

      setLastEmailStatus({
        sent: !!emailSent,
        message: emailSent 
          ? `Email notification sent to ${investorName}`
          : 'Message sent (investor may have email notifications disabled)'
      });
      setTimeout(() => setLastEmailStatus(null), 5000);

      setInvestorMessage('');
      setInvestorSubject('');
      toast({ 
        title: 'Message Sent', 
        description: emailSent 
          ? 'Investor has been notified via email.'
          : 'Message delivered. Investor will see it when they log in.'
      });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
      setTimeout(() => investorTextareaRef.current?.focus(), 100);
    }
  }, [investorMessage, investorSubject, selectedConversation, staffId, staffName, investorNames, investorEmails]);

  const handleSendToStaff = useCallback(async () => {
    const isFromModal = newStaffMessageOpen && selectedStaffRecipient;
    const recipientId = isFromModal ? selectedStaffRecipient : selectedStaffConversation;
    const messageText = isFromModal ? newStaffModalMessage : staffMessage;
    const subjectText = isFromModal ? newStaffModalSubject : staffSubject;
    
    if (!messageText.trim() || !recipientId) return;
    setSending(true);
    setLastEmailStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: {
          action: 'send_staff_message',
          from_staff_id: staffId,
          to_staff_id: recipientId,
          message: messageText.trim(),
          subject: subjectText.trim() || undefined
        }
      });
      if (error || data?.error) throw new Error(data?.error || 'Failed to send');

      const emailSent = data?.email_sent;
      const recipientName = allStaff.find(s => s.id === recipientId)?.full_name || 
        staffConversations.find(c => c.partner_id === recipientId)?.partner_name || 'team member';
      
      setLastEmailStatus({
        sent: !!emailSent,
        message: emailSent 
          ? `Email notification sent to ${recipientName}`
          : `Message sent to ${recipientName}`
      });
      setTimeout(() => setLastEmailStatus(null), 5000);

      if (isFromModal) {
        setNewStaffModalMessage('');
        setNewStaffModalSubject('');
        setNewStaffMessageOpen(false);
        setSelectedStaffRecipient('');
      } else {
        setStaffMessage('');
        setStaffSubject('');
      }
      
      toast({ 
        title: 'Message Sent', 
        description: `Message delivered to ${recipientName}.`
      });
      loadData();
      
      if (!selectedStaffConversation && recipientId) {
        setSelectedStaffConversation(recipientId);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
      setTimeout(() => staffTextareaRef.current?.focus(), 100);
    }
  }, [staffMessage, staffSubject, newStaffModalMessage, newStaffModalSubject, selectedStaffConversation, selectedStaffRecipient, newStaffMessageOpen, staffId, allStaff, staffConversations]);

  const applyTemplate = (template: Template) => {
    let body = template.body;
    const investorName = investorNames[selectedConversation || ''] || 'Investor';
    body = body.replace(/\{\{investor_name\}\}/g, investorName.split(' ')[0]);
    setInvestorMessage(body);
    if (template.subject) setInvestorSubject(template.subject);
    setTemplateModalOpen(false);
    setTimeout(() => investorTextareaRef.current?.focus(), 100);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const selectedMessages = conversations.find(c => c.investor_id === selectedConversation)?.messages || [];
  const selectedStaffMessages = staffConversations.find(c => c.partner_id === selectedStaffConversation)?.messages || [];
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const totalStaffUnread = staffConversations.reduce((sum, c) => sum + c.unread_count, 0);

  const filteredConversations = conversations.filter(c => {
    const name = investorNames[c.investor_id] || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredStaffConversations = staffConversations.filter(c => {
    return c.partner_name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1a365d]" />
          <p className="mt-2 text-gray-500">Loading messages...</p>
        </CardContent>
      </Card>
    );
  }

  const renderEmailStatusBadge = (msg: { email_notification_sent?: boolean; sender_type?: string; is_from_me?: boolean }) => {
    const isSentByMe = msg.sender_type === 'staff' || msg.is_from_me;
    if (!isSentByMe) return null;
    if (msg.email_notification_sent) {
      return <MailCheck className="w-3 h-3 ml-1 text-green-400" title="Email notification sent" />;
    }
    return null;
  };

  const renderMessageBubble = (msg: Message | StaffMessage, isFromMe: boolean, partnerName?: string) => {
    const subject = msg.subject;
    const showSubject = subject && subject !== 'Message' && subject !== 'Reply' && subject !== 'Message from your AM';
    
    return (
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isFromMe ? 'bg-[#1a365d] text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'
      }`}>
        {!isFromMe && (
          <div className="flex items-center gap-1.5 mb-1">
            <UserCircle className="w-3 h-3 text-[#d4a574]" />
            <span className="text-xs font-medium text-[#d4a574]">
              {'sender_name' in msg ? (msg as any).sender_name : partnerName || 'Unknown'}
            </span>
          </div>
        )}
        {showSubject && (
          <p className={`text-xs font-semibold mb-1 ${isFromMe ? 'text-white/80' : 'text-gray-500'}`}>{subject}</p>
        )}
        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
        <div className={`flex items-center gap-1 mt-2 text-xs ${isFromMe ? 'text-white/60' : 'text-gray-400'}`}>
          <Clock className="w-3 h-3" />
          <span>{formatTime(msg.created_at)}</span>
          {isFromMe && (
            <>
              {'read' in msg ? (
                (msg as Message).read ? <CheckCheck className="w-3 h-3 ml-1 text-blue-400" /> : <Check className="w-3 h-3 ml-1" />
              ) : (
                (msg as StaffMessage).is_read ? <CheckCheck className="w-3 h-3 ml-1 text-blue-400" /> : <Check className="w-3 h-3 ml-1" />
              )}
              {renderEmailStatusBadge(msg)}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDateSeparator = (dateStr: string) => (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium px-2">
        {new Date(dateStr).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Email status banner */}
      {lastEmailStatus && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border animate-in fade-in duration-300 ${
          lastEmailStatus.sent ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        }`}>
          {lastEmailStatus.sent ? <MailCheck className="w-4 h-4 text-green-600 flex-shrink-0" /> : <Mail className="w-4 h-4 text-amber-600 flex-shrink-0" />}
          <span className={`text-sm ${lastEmailStatus.sent ? 'text-green-700' : 'text-amber-700'}`}>{lastEmailStatus.message}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => { setActiveTab('investors'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'investors' ? 'bg-white shadow-sm text-[#1a365d]' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <User className="w-4 h-4" />
            Investor Messages
            {totalUnread > 0 && <Badge className="bg-red-500 text-white ml-1 text-xs">{totalUnread}</Badge>}
          </button>
          <button
            onClick={() => { setActiveTab('staff'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'staff' ? 'bg-white shadow-sm text-[#1a365d]' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <Users className="w-4 h-4" />
            Staff Messages
            {totalStaffUnread > 0 && <Badge className="bg-red-500 text-white ml-1 text-xs">{totalStaffUnread}</Badge>}
          </button>
        </div>
        <div className="flex gap-2">
          {activeTab === 'investors' && (
            <Button size="sm" onClick={() => setNewInvestorMessageOpen(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
              <Plus className="w-4 h-4 mr-1" />New Investor Message
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
        </div>
      </div>

      {/* Investor Messages Tab */}
      {activeTab === 'investors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: '620px' }}>
          {/* Conversations List */}
          <Card className="lg:col-span-1 flex flex-col overflow-hidden">
            <CardHeader className="border-b flex-shrink-0 pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#d4a574]" />
                Investors
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search investors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No conversations yet</p>
                  <Button variant="link" size="sm" onClick={() => setNewInvestorMessageOpen(true)} className="mt-2 text-[#d4a574]">
                    Start a new conversation
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.investor_id}
                      onClick={() => {
                        setSelectedConversation(conv.investor_id);
                        setSelectedStaffConversation(null);
                        setTimeout(() => investorTextareaRef.current?.focus(), 200);
                      }}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedConversation === conv.investor_id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="font-medium truncate">{investorNames[conv.investor_id] || 'Unknown Investor'}</span>
                            {conv.unread_count > 0 && <Badge className="bg-red-500 text-white text-xs">{conv.unread_count}</Badge>}
                          </div>
                          {conv.last_message && (
                            <p className="text-sm text-gray-500 truncate mt-1">
                              {conv.last_message.sender_type === 'staff' ? 'You: ' : ''}{conv.last_message.message}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {conv.last_message && <span className="text-xs text-gray-400">{formatTime(conv.last_message.created_at)}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Message Thread */}
          <Card className="lg:col-span-2 flex flex-col overflow-hidden">
            <CardHeader className="border-b flex-shrink-0 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {selectedConversation ? investorNames[selectedConversation] || 'Investor' : 'Select a conversation'}
                  </CardTitle>
                  <CardDescription>
                    {selectedConversation ? 'Direct messaging with investor' : 'Choose an investor to message or start a new conversation'}
                  </CardDescription>
                </div>
                {selectedConversation && (
                  <Button variant="outline" size="sm" onClick={() => setTemplateModalOpen(true)}>
                    <FileText className="w-4 h-4 mr-2" />Templates
                  </Button>
                )}
              </div>
            </CardHeader>

            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                  <p>Select a conversation to view messages</p>
                  <Button variant="link" className="mt-2 text-[#d4a574]" onClick={() => setNewInvestorMessageOpen(true)}>
                    Or start a new conversation
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {selectedMessages.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedMessages.map((msg, idx) => {
                        const msgDate = new Date(msg.created_at).toLocaleDateString();
                        const prevDate = idx > 0 ? new Date(selectedMessages[idx - 1].created_at).toLocaleDateString() : null;
                        const showDateSep = msgDate !== prevDate;
                        const isFromMe = msg.sender_type === 'staff';
                        return (
                          <div key={msg.id}>
                            {showDateSep && renderDateSeparator(msg.created_at)}
                            <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                              {renderMessageBubble(msg, isFromMe)}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Compose area */}
                <div className="flex-shrink-0 p-4 border-t bg-white space-y-3">
                  <input
                    type="text"
                    placeholder="Subject (optional)"
                    value={investorSubject}
                    onChange={(e) => setInvestorSubject(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); investorTextareaRef.current?.focus(); } }}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  <div className="flex gap-2">
                    <textarea
                      ref={investorTextareaRef}
                      placeholder="Type your message to the investor..."
                      value={investorMessage}
                      onChange={(e) => setInvestorMessage(e.target.value)}
                      rows={3}
                      className="flex-1 min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSendToInvestor(); }
                      }}
                    />
                    <Button 
                      onClick={handleSendToInvestor}
                      disabled={!investorMessage.trim() || sending}
                      className="bg-[#d4a574] hover:bg-[#c49464] self-end h-10 px-4"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" />Send</>}
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Mail className="w-3 h-3" />
                    <span>Investor will receive an email notification</span>
                    <span className="ml-auto text-gray-300">Ctrl+Enter to send</span>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Staff Messages Tab */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: '620px' }}>
          <Card className="lg:col-span-1 flex flex-col overflow-hidden">
            <CardHeader className="border-b flex-shrink-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#d4a574]" />Team
                </CardTitle>
                <Button size="sm" onClick={() => setNewStaffMessageOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />New
                </Button>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto">
              {filteredStaffConversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No staff conversations yet</p>
                  <Button variant="link" size="sm" onClick={() => setNewStaffMessageOpen(true)} className="mt-2">Start a conversation</Button>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredStaffConversations.map((conv) => (
                    <button
                      key={conv.partner_id}
                      onClick={() => {
                        setSelectedStaffConversation(conv.partner_id);
                        setSelectedConversation(null);
                        setTimeout(() => staffTextareaRef.current?.focus(), 200);
                      }}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedStaffConversation === conv.partner_id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <UserCircle className="w-4 h-4 text-[#1a365d] flex-shrink-0" />
                            <span className="font-medium truncate">{conv.partner_name}</span>
                            {conv.unread_count > 0 && <Badge className="bg-red-500 text-white text-xs">{conv.unread_count}</Badge>}
                          </div>
                          {conv.last_message && (
                            <p className="text-sm text-gray-500 truncate mt-1">
                              {conv.last_message.is_from_me ? 'You: ' : ''}{conv.last_message.message}
                            </p>
                          )}
                        </div>
                        {conv.last_message && <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(conv.last_message.created_at)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="lg:col-span-2 flex flex-col overflow-hidden">
            <CardHeader className="border-b flex-shrink-0 pb-3">
              <CardTitle className="text-lg">
                {selectedStaffConversation 
                  ? staffConversations.find(c => c.partner_id === selectedStaffConversation)?.partner_name || 'Staff Member'
                  : 'Select a conversation'}
              </CardTitle>
              <CardDescription>
                {selectedStaffConversation ? 'Internal team messaging' : 'Choose a team member to message'}
              </CardDescription>
            </CardHeader>

            {!selectedStaffConversation ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-4" />
                  <p>Select a conversation or start a new one</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {selectedStaffMessages.length === 0 ? (
                    <div className="text-center py-12 text-gray-400"><p>No messages yet.</p></div>
                  ) : (
                    <div className="space-y-4">
                      {selectedStaffMessages.map((msg, idx) => {
                        const msgDate = new Date(msg.created_at).toLocaleDateString();
                        const prevDate = idx > 0 ? new Date(selectedStaffMessages[idx - 1].created_at).toLocaleDateString() : null;
                        const showDateSep = msgDate !== prevDate;
                        const isFromMe = !!msg.is_from_me;
                        const partnerName = staffConversations.find(c => c.partner_id === selectedStaffConversation)?.partner_name;
                        return (
                          <div key={msg.id}>
                            {showDateSep && renderDateSeparator(msg.created_at)}
                            <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                              {renderMessageBubble(msg, isFromMe, partnerName)}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 p-4 border-t bg-white space-y-3">
                  <input
                    type="text"
                    placeholder="Subject (optional)"
                    value={staffSubject}
                    onChange={(e) => setStaffSubject(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); staffTextareaRef.current?.focus(); } }}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  <div className="flex gap-2">
                    <textarea
                      ref={staffTextareaRef}
                      placeholder="Type your message..."
                      value={staffMessage}
                      onChange={(e) => setStaffMessage(e.target.value)}
                      rows={3}
                      className="flex-1 min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSendToStaff(); }
                      }}
                    />
                    <Button 
                      onClick={handleSendToStaff}
                      disabled={!staffMessage.trim() || sending}
                      className="bg-[#1a365d] hover:bg-[#2d5a87] self-end h-10 px-4"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" />Send</>}
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Mail className="w-3 h-3" />
                    <span>Recipient will receive an email notification</span>
                    <span className="ml-auto text-gray-300">Ctrl+Enter to send</span>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Templates Modal */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Message Templates</DialogTitle>
            <DialogDescription>Use a template to quickly compose common messages</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No templates available</p>
            ) : (
              templates.map((template) => (
                <button key={template.id} onClick={() => applyTemplate(template)}
                  className="w-full p-4 border rounded-lg text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{template.name}</span>
                    {template.category && <Badge variant="outline">{template.category}</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">{template.body}</p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Staff Message Modal */}
      <Dialog open={newStaffMessageOpen} onOpenChange={(open) => {
        setNewStaffMessageOpen(open);
        if (!open) { setNewStaffModalMessage(''); setNewStaffModalSubject(''); setSelectedStaffRecipient(''); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Staff Message</DialogTitle>
            <DialogDescription>Send a message to another team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Recipient</label>
              <Select value={selectedStaffRecipient} onValueChange={setSelectedStaffRecipient}>
                <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                <SelectContent>
                  {allStaff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>{staff.full_name} ({staff.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Subject (optional)</label>
              <input type="text" placeholder="Message subject" value={newStaffModalSubject}
                onChange={(e) => setNewStaffModalSubject(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea placeholder="Type your message..." value={newStaffModalMessage}
                onChange={(e) => setNewStaffModalMessage(e.target.value)} rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewStaffMessageOpen(false)}>Cancel</Button>
              <Button onClick={handleSendToStaff} disabled={!newStaffModalMessage.trim() || !selectedStaffRecipient || sending}
                className="bg-[#1a365d] hover:bg-[#2d5a87]">
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Message
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* NEW: New Investor Message Modal */}
      <Dialog open={newInvestorMessageOpen} onOpenChange={(open) => {
        setNewInvestorMessageOpen(open);
        if (!open) { setNewInvSelected(null); setNewInvSearch(''); setNewInvSubject(''); setNewInvMessage(''); setNewInvResults([]); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#d4a574]" />
              New Message to Investor
            </DialogTitle>
            <DialogDescription>Search for any investor and send them a direct message. They'll receive an email notification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Investor Search */}
            <div>
              <label className="text-sm font-medium">Search Investor *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Type investor name or email..."
                  value={newInvSearch}
                  onChange={(e) => handleSearchNewInvestor(e.target.value)}
                  className="w-full pl-10 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                {searchingInvestors && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
              </div>
              {newInvResults.length > 0 && !newInvSelected && (
                <div className="mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {newInvResults.map((inv) => (
                    <button key={inv.id} className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                      onClick={() => { setNewInvSelected(inv); setNewInvSearch(inv.full_name); setNewInvResults([]); }}>
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm">{inv.full_name}</p>
                        <p className="text-xs text-gray-500">{inv.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {newInvSelected && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">
                    <Check className="w-3 h-3 mr-1" />{newInvSelected.full_name}
                  </Badge>
                  <span className="text-xs text-gray-500">{newInvSelected.email}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setNewInvSelected(null); setNewInvSearch(''); }}>Change</Button>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Subject (optional)</label>
              <input type="text" placeholder="Message subject" value={newInvSubject}
                onChange={(e) => setNewInvSubject(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Message *</label>
              <textarea placeholder="Type your message to the investor..." value={newInvMessage}
                onChange={(e) => setNewInvMessage(e.target.value)} rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[120px]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <Mail className="w-3 h-3" />
              <span>The investor will receive an email notification with your message and a link to reply on the platform.</span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewInvestorMessageOpen(false)}>Cancel</Button>
              <Button onClick={handleSendNewInvestorMessage}
                disabled={!newInvMessage.trim() || !newInvSelected || sending}
                className="bg-[#d4a574] hover:bg-[#c49464]">
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Message
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
