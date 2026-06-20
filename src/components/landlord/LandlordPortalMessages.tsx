import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, User, Building2, Clock } from 'lucide-react';

interface Message {
  id: string;
  sender_type: string;
  sender_name?: string;
  message: string;
  is_read: boolean;
  application_id?: string;
  created_at: string;
}

interface Props {
  landlordId: string;
  landlordName: string;
  applicationId?: string | null;
}

export default function LandlordPortalMessages({ landlordId, landlordName, applicationId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMessages();
    markAsRead();
    const interval = setInterval(fetchMessages, 15000);
    return () => clearInterval(interval);
  }, [landlordId, applicationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const body: any = { action: 'get_messages', landlord_id: landlordId };
      if (applicationId) body.application_id = applicationId;
      const { data } = await supabase.functions.invoke('manage-landlord-portal', { body });
      if (data?.messages) setMessages(data.messages);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const markAsRead = async () => {
    try {
      await supabase.functions.invoke('manage-landlord-portal', {
        body: { action: 'mark_messages_read', landlord_id: landlordId, reader_type: 'landlord' }
      });
    } catch (err) { console.error(err); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'send_message',
          landlord_id: landlordId,
          application_id: applicationId || null,
          sender_type: 'landlord',
          sender_name: landlordName,
          message: newMessage.trim()
        }
      });
      if (data?.success) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    }
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1a2332] rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-[#d4a574]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1a2332]">Communication Center</h3>
            <p className="text-xs text-gray-500">
              {applicationId ? 'Messages about this application' : 'Direct messages with your Acquisition Manager'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-400">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No messages yet</p>
              <p className="text-sm text-gray-400 mt-1">Start a conversation with your Acquisition Manager</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_type === 'landlord' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${msg.sender_type === 'landlord' ? 'order-2' : ''}`}>
                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.sender_type === 'landlord'
                      ? 'bg-[#d4a574] text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <div className={`flex items-center gap-2 mt-1 ${msg.sender_type === 'landlord' ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-xs text-gray-400">{msg.sender_name || (msg.sender_type === 'staff' ? 'AM Team' : 'You')}</span>
                    <span className="text-xs text-gray-300">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
                <div className={`flex-shrink-0 ${msg.sender_type === 'landlord' ? 'order-1 mr-2' : 'ml-0 mr-2'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.sender_type === 'landlord' ? 'bg-[#d4a574]/20' : 'bg-[#1a2332]/10'
                  }`}>
                    {msg.sender_type === 'landlord'
                      ? <Building2 className="w-4 h-4 text-[#d4a574]" />
                      : <User className="w-4 h-4 text-[#1a2332]" />
                    }
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="bg-[#d4a574] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#c49564] transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
