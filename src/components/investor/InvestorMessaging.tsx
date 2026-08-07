import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { notifyAMAboutAction } from '@/utils/notifyAM';
import { 
  Loader2, MessageSquare, Send, User, Clock, CheckCheck, 
  Check, RefreshCw, Mail, MailCheck, MailX, Users, UserCircle,
  ChevronDown, AlertCircle, Shield
} from 'lucide-react';

interface Message {
  id: string;
  subject?: string;
  message: string;
  sender_type: 'investor' | 'staff';
  sender_name?: string;
  sender_id?: string;
  read: boolean;
  read_at?: string;
  email_notification_sent?: boolean;
  created_at: string;
}

interface Props {
  investorId: string;
  investorName: string;
  assignedAMName?: string;
  assignedAMId?: string;
}

export function InvestorMessaging({ investorId, investorName, assignedAMName, assignedAMId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [emailNotifSent, setEmailNotifSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, [investorId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: { action: 'get_conversation', investor_id: investorId }
      });

      if (error) throw error;
      setMessages(data?.messages || []);
      
      const unreadIds = (data?.messages || [])
        .filter((m: Message) => !m.read && m.sender_type === 'staff')
        .map((m: Message) => m.id);
      
      if (unreadIds.length > 0) {
        await supabase.functions.invoke('investor-messaging', {
          body: { action: 'mark_all_read', investor_id: investorId }
        });
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    setEmailNotifSent(false);
    try {
      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: {
          action: 'send_reply',
          investor_id: investorId,
          message: newMessage.trim(),
          subject: newSubject.trim() || 'Message',
          investor_name: investorName
        }
      });

      if (error || data?.error) throw new Error(data?.error || 'Failed to send');

      const subjectLine = newSubject.trim() || 'Message';
      notifyAMAboutAction(investorId, 'New Message', `Sent a message — Subject: "${subjectLine}"`);

      // Check email notification status
      const emailNotifs = data?.email_notifications;
      const amNotified = emailNotifs?.am_notified;
      const successNotified = emailNotifs?.success_team_notified;

      setNewMessage('');
      setNewSubject('');
      setShowCompose(false);
      
      if (amNotified || successNotified) {
        setEmailNotifSent(true);
        setTimeout(() => setEmailNotifSent(false), 5000);
      }

      toast({ 
        title: 'Message Sent', 
        description: amNotified 
          ? `Your ${assignedAMName ? `AM (${assignedAMName})` : 'Acquisition Manager'} and the Success Team have been notified via email.`
          : successNotified 
            ? 'The Success Team has been notified via email.'
            : 'Your team will be notified.'
      });
      loadMessages();

    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const unreadCount = messages.filter(m => !m.read && m.sender_type === 'staff').length;

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

  return (
    <Card className="h-[650px] flex flex-col">
      <CardHeader className="border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#d4a574]" />
              Messages
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white">{unreadCount} new</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Chat with your {assignedAMName ? `Acquisition Manager (${assignedAMName})` : 'team'} and Success Team
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadMessages}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowCompose(!showCompose)}
              className="bg-[#1a365d]"
            >
              <Send className="w-4 h-4 mr-2" />
              New Message
            </Button>
          </div>
        </div>

        {/* AM Info Bar */}
        {assignedAMName && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
            <UserCircle className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-blue-700">
              Your Acquisition Manager: <strong>{assignedAMName}</strong>
            </span>
            <span className="text-xs text-blue-400 ml-auto">Messages are also sent to the Success Team</span>
          </div>
        )}

        {/* Email notification banner */}
        {emailNotifSent && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200 animate-in fade-in duration-300">
            <MailCheck className="w-4 h-4 text-green-600" />
            <span className="text-xs text-green-700">Email notification sent to your team</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Compose Area */}
        {showCompose && (
          <div className="p-4 border-b bg-gray-50 space-y-3">
            <Input aria-label="Subject (optional)"
              placeholder="Subject (optional)"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
            />
            <Textarea aria-label="Type your message to your AM and Success Team"
              placeholder="Type your message to your AM and Success Team..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail className="w-3 h-3" />
                <span>Your {assignedAMName || 'AM'} and Success Team will be emailed</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCompose(false)}>
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Messages List */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No messages yet</p>
              <p className="text-sm text-gray-400 mb-4">
                Start a conversation with your {assignedAMName ? `AM (${assignedAMName})` : 'team'}
              </p>
              <Button 
                size="sm" 
                onClick={() => setShowCompose(true)}
                className="bg-[#1a365d]"
              >
                <Send className="w-4 h-4 mr-2" />
                Send First Message
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date separators and messages */}
              {messages.map((msg, idx) => {
                const msgDate = new Date(msg.created_at).toLocaleDateString();
                const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at).toLocaleDateString() : null;
                const showDateSep = msgDate !== prevDate;
                
                return (
                  <div key={msg.id}>
                    {showDateSep && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium px-2">
                          {new Date(msg.created_at).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}
                    <div className={`flex ${msg.sender_type === 'investor' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.sender_type === 'investor'
                          ? 'bg-[#1a365d] text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}>
                        {msg.sender_type === 'staff' && msg.sender_name && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <UserCircle className="w-3 h-3 text-[#d4a574]" />
                            <p className="text-xs font-medium text-[#d4a574]">
                              {msg.sender_name}
                            </p>
                          </div>
                        )}
                        {msg.subject && msg.subject !== 'Message' && msg.subject !== 'Reply' && (
                          <p className={`text-xs font-semibold mb-1 ${
                            msg.sender_type === 'investor' ? 'text-white/80' : 'text-gray-500'
                          }`}>
                            {msg.subject}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <div className={`flex items-center gap-1 mt-2 text-xs ${
                          msg.sender_type === 'investor' ? 'text-white/60' : 'text-gray-400'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(msg.created_at)}</span>
                          {msg.sender_type === 'investor' && (
                            <>
                              {msg.read ? (
                                <CheckCheck className="w-3 h-3 ml-1 text-blue-400" title="Read" />
                              ) : (
                                <Check className="w-3 h-3 ml-1" title="Delivered" />
                              )}
                              {msg.email_notification_sent && (
                                <MailCheck className="w-3 h-3 ml-1 text-green-400" title="Email notification sent to team" />
                              )}
                            </>
                          )}
                          {msg.sender_type === 'staff' && msg.email_notification_sent && (
                            <Mail className="w-3 h-3 ml-1 text-blue-400" title="You were emailed about this message" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Quick Reply */}
        {!showCompose && messages.length > 0 && (
          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <Input
                placeholder={`Reply to ${assignedAMName || 'your team'}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button 
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
              <Mail className="w-3 h-3" />
              <span>Your AM and Success Team will receive an email notification</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
