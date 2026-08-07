import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageCircle, X, Send, Loader2, HelpCircle, 
  Mail, Phone, Clock, CheckCircle, AlertTriangle
} from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'support' | 'system';
  content: string;
  timestamp: Date;
}

interface Props {
  failedAttempts?: number;
  lastAttemptEmail?: string;
}

export function LoginSupportChat({ failedAttempts = 0, lastAttemptEmail = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'initial' | 'chat' | 'submitted'>('initial');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    name: '',
    email: lastAttemptEmail,
    phone: ''
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-open chat if user has multiple failed attempts
  useEffect(() => {
    if (failedAttempts >= 3 && !isOpen) {
      // Don't auto-open, but show a pulse animation on the button
    }
  }, [failedAttempts]);

  // Update email if lastAttemptEmail changes
  useEffect(() => {
    if (lastAttemptEmail && !contactInfo.email) {
      setContactInfo(prev => ({ ...prev, email: lastAttemptEmail }));
    }
  }, [lastAttemptEmail]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleStartChat = () => {
    if (!contactInfo.email) {
      toast({ title: 'Email Required', description: 'Please enter your email address', variant: 'destructive' });
      return;
    }
    
    setStep('chat');
    
    // Add welcome message
    const welcomeMessage: Message = {
      id: 'welcome',
      type: 'support',
      content: `Hi${contactInfo.name ? ` ${contactInfo.name.split(' ')[0]}` : ''}! 👋 I'm here to help you access your account. What issue are you experiencing?\n\nCommon issues I can help with:\n• Forgot password\n• Account not found\n• Verification email not received\n• Login errors`,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: newMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setSending(true);

    try {
      // Send support request to backend
      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: {
          action: 'submit_support_request',
          email: contactInfo.email,
          name: contactInfo.name,
          phone: contactInfo.phone,
          message: newMessage.trim(),
          context: {
            failed_login_attempts: failedAttempts,
            last_attempt_email: lastAttemptEmail,
            page: 'login',
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      // Add automated response
      const autoResponse: Message = {
        id: `support-${Date.now()}`,
        type: 'support',
        content: getAutoResponse(newMessage.trim().toLowerCase()),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, autoResponse]);

      // If this is a password reset request, offer to send reset email
      if (newMessage.toLowerCase().includes('password') || newMessage.toLowerCase().includes('forgot')) {
        const resetOffer: Message = {
          id: `system-${Date.now()}`,
          type: 'system',
          content: '🔑 Would you like me to send a password reset link to your email? Just confirm and I\'ll send it right away.',
          timestamp: new Date()
        };
        setTimeout(() => {
          setMessages(prev => [...prev, resetOffer]);
        }, 1000);
      }

    } catch (err: any) {
      console.error('Support chat error:', err);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: 'Sorry, there was an issue sending your message. Please try again or email us directly at success@accessyourplace.com',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const getAutoResponse = (message: string): string => {
    if (message.includes('password') || message.includes('forgot')) {
      return 'I understand you\'re having trouble with your password. You can use the "Forgot password?" link on the login page to reset it via email or SMS. If you\'re not receiving the reset email, check your spam folder or let me know and I\'ll have our team look into it.';
    }
    if (message.includes('verification') || message.includes('verify') || message.includes('email')) {
      return 'Verification emails sometimes take a few minutes to arrive. Please check your spam/junk folder. If you still haven\'t received it after 10 minutes, I\'ll have our Success Team resend it manually.';
    }
    if (message.includes('account') || message.includes('not found')) {
      return 'If your account isn\'t being found, please double-check the email address you\'re using. If you registered with a different email or through Google/Apple, try those options. Our team can also look up your account manually.';
    }
    if (message.includes('locked') || message.includes('blocked') || message.includes('too many')) {
      return 'For security, accounts are temporarily locked after multiple failed login attempts. This lock usually expires after 15-30 minutes. If you need immediate access, our team can help unlock your account.';
    }
    return 'Thank you for reaching out! I\'ve forwarded your message to our Success Team. They typically respond within a few hours during business hours (9 AM - 6 PM EST). For urgent issues, you can also call us at (555) 123-4567.';
  };

  const handlePasswordReset = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-login', {
        body: {
          action: 'forgot_password',
          email: contactInfo.email,
          base_url: window.location.origin
        }
      });

      const confirmMessage: Message = {
        id: `system-${Date.now()}`,
        type: 'system',
        content: `✅ Password reset link sent to ${contactInfo.email}! Please check your inbox (and spam folder) within the next few minutes.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, confirmMessage]);
      toast({ title: 'Reset Email Sent', description: 'Check your inbox for the password reset link' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to send reset email', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Floating Help Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 ${
          failedAttempts >= 3 
            ? 'bg-amber-500 hover:bg-amber-600 animate-pulse' 
            : 'bg-[#1a365d] hover:bg-[#2d4a7c]'
        } text-white`}
        aria-label="Need help? Open support chat"
      >
        <HelpCircle className="w-5 h-5" />
        <span className="font-medium">Need Help?</span>
        {failedAttempts >= 3 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
        )}
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1a365d] to-[#2d5a87] p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Success Team Support</h3>
                    <p className="text-xs text-white/70">
                      {step === 'chat' ? 'We typically respond within minutes' : 'Here to help you log in'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="h-[400px] flex flex-col">
              {step === 'initial' ? (
                <div className="flex-1 p-6 space-y-4">
                  {/* Failed attempts warning */}
                  {failedAttempts >= 2 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Having trouble logging in?</p>
                        <p className="text-xs text-amber-600 mt-1">
                          We noticed {failedAttempts} failed attempt{failedAttempts > 1 ? 's' : ''}. Let us help you get back into your account.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h4 className="font-semibold text-gray-900">How can we help?</h4>
                    <p className="text-sm text-gray-500">Enter your details and we'll assist you right away</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="support-name">Your Name</Label>
                      <Input
                        id="support-name"
                        placeholder="John Doe"
                        value={contactInfo.name}
                        onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="support-email">Email Address *</Label>
                      <Input
                        id="support-email"
                        type="email"
                        placeholder="you@example.com"
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="support-phone">Phone (Optional)</Label>
                      <Input
                        id="support-phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleStartChat}
                    className="w-full bg-[#d4a574] hover:bg-[#c49464]"
                    disabled={!contactInfo.email}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Start Chat
                  </Button>

                  {/* Quick Actions */}
                  <div className="pt-4 border-t space-y-2">
                    <p className="text-xs text-gray-500 text-center">Or try these quick solutions:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setContactInfo({ ...contactInfo, email: lastAttemptEmail || '' });
                          handleStartChat();
                          setTimeout(() => {
                            setNewMessage('I forgot my password');
                            handleSendMessage();
                          }, 500);
                        }}
                        className="p-2 text-xs text-left border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium block">Reset Password</span>
                        <span className="text-gray-500">Get a reset link</span>
                      </button>
                      <button
                        onClick={() => {
                          setContactInfo({ ...contactInfo, email: lastAttemptEmail || '' });
                          handleStartChat();
                          setTimeout(() => {
                            setNewMessage('I never received my verification email');
                            handleSendMessage();
                          }, 500);
                        }}
                        className="p-2 text-xs text-left border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium block">Resend Verification</span>
                        <span className="text-gray-500">Email not received</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                              msg.type === 'user'
                                ? 'bg-[#1a365d] text-white rounded-br-md'
                                : msg.type === 'system'
                                ? 'bg-amber-50 border border-amber-200 text-amber-800 rounded-bl-md'
                                : 'bg-gray-100 text-gray-900 rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                              msg.type === 'user' ? 'text-white/60' : 'text-gray-400'
                            }`}>
                              {formatTime(msg.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {sending && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Quick Actions */}
                  {messages.some(m => m.content.includes('password reset link')) && (
                    <div className="px-4 pb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePasswordReset}
                        disabled={sending}
                        className="w-full border-[#d4a574] text-[#d4a574] hover:bg-[#d4a574]/10"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                        Yes, Send Reset Link
                      </Button>
                    </div>
                  )}

                  {/* Input */}
                  <div className="p-4 border-t bg-white">
                    <div className="flex gap-2">
                      <Input aria-label="Type your message"
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        disabled={sending}
                      />
                      <Button
                        onClick={handleSendMessage}
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
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t text-center">
              <p className="text-xs text-gray-500">
                <Clock className="w-3 h-3 inline mr-1" />
                Support hours: 9 AM - 6 PM EST
                <span className="mx-2">•</span>
                <a href="mailto:success@accessyourplace.com" className="text-[#d4a574] hover:underline">
                  success@accessyourplace.com
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
