import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { PennyMark } from '@/components/investor/PennyMark';
import { playPennyChime } from '@/lib/pennyChime';
import { 
  Bot, Send, Loader2, X, Minimize2, Maximize2, 
  Sparkles, Plus, History, ChevronDown, Building2,
  CheckCircle, Zap, Database, FileText, Search as SearchIcon
} from 'lucide-react';



interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  // Penny can attach one action to a reply. Today that is the payment page, and only
  // when a signed-in operator has said they are ready to take an operation off market.
  actionCard?: { type: string; label: string; href: string; spoken?: string } | null;
}

interface ChatSession {
  id: string;
  session_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

interface PennyChatButtonProps {
  userId: string;
  userName: string;
  userType: 'staff' | 'investor';
}

export function PennyChatButton({ userId, userName, userType }: PennyChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isNewInvestor, setIsNewInvestor] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const floatingButtonRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();

  const firstName = userName?.split(' ')[0] || 'there';

  // Announce to screen readers with proper ARIA live region
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Find or create the announcement region
    let announcementRegion = document.getElementById('penny-announcements');
    if (!announcementRegion) {
      announcementRegion = document.createElement('div');
      announcementRegion.id = 'penny-announcements';
      announcementRegion.setAttribute('role', 'status');
      announcementRegion.setAttribute('aria-live', priority);
      announcementRegion.setAttribute('aria-atomic', 'true');
      announcementRegion.className = 'sr-only';
      document.body.appendChild(announcementRegion);
    }
    
    // Clear and set new message (helps screen readers detect change)
    announcementRegion.textContent = '';
    announcementRegion.setAttribute('aria-live', priority);
    
    // Use setTimeout to ensure screen readers detect the change
    setTimeout(() => {
      if (announcementRegion) {
        announcementRegion.textContent = message;
      }
    }, 100);
  }, []);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch suggested questions on mount
  useEffect(() => {
    if (isOpen) {
      fetchSuggestedQuestions();
      fetchChatHistory();
      announceToScreenReader('Penny AI chat opened. Type your message or select a suggested question.');
    }
  }, [isOpen, userType, announceToScreenReader]);

  // Scroll and announce new messages
  useEffect(() => {
    scrollToBottom();
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        // Penny's coin-chime the moment her reply drops in.
        playPennyChime();
        // Announce the full message for screen readers
        announceToScreenReader(`Penny says: ${lastMessage.content}`);
      }
    }
  }, [messages, scrollToBottom, announceToScreenReader]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Handle keyboard navigation for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
        announceToScreenReader('Penny AI chat closed', 'assertive');
        // Return focus to the floating button
        setTimeout(() => floatingButtonRef.current?.focus(), 100);
      }
      
      // Tab trap within chat dialog
      if (e.key === 'Tab' && chatContainerRef.current) {
        const focusableElements = chatContainerRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, announceToScreenReader]);

  const fetchSuggestedQuestions = async () => {
    try {
      const { data } = await supabase.functions.invoke('ai-investor-chat', {
        body: { action: 'get_suggested_questions', user_type: userType }
      });
      if (data?.suggestions) {
        setSuggestedQuestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const { data } = await supabase.functions.invoke('ai-investor-chat', {
        body: { action: 'get_history', user_id: userId, user_type: userType }
      });
      if (data?.history) {
        setChatHistory(data.history);
        // Check if this is a new investor (no chat history)
        if (userType === 'investor' && data.history.length === 0) {
          setIsNewInvestor(true);
        }
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setShowHistory(false);
    announceToScreenReader('Started a new conversation with Penny');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [announceToScreenReader]);

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages || []);
    setSessionId(session.session_id);
    setShowHistory(false);
    announceToScreenReader(`Loaded previous conversation with ${session.messages?.length || 0} messages`);
  };

  const [executingActions, setExecutingActions] = useState(false);
  const [lastActionsExecuted, setLastActionsExecuted] = useState<Array<{action: string; success: boolean}>>([]);

  const getActionIcon = (actionName: string) => {
    if (actionName.includes('lookup') || actionName.includes('search') || actionName.includes('marketplace') || actionName.includes('portfolio')) return SearchIcon;
    if (actionName.includes('update') || actionName.includes('log_note')) return Database;
    if (actionName.includes('draft') || actionName.includes('generate') || actionName.includes('listing')) return FileText;
    if (actionName.includes('score') || actionName.includes('analyze') || actionName.includes('calculate') || actionName.includes('pipeline')) return Zap;
    return CheckCircle;
  };

  const getActionLabel = (actionName: string) => {
    const labels: Record<string, string> = {
      lookup_investor: 'Investor Lookup',
      update_investor_status: 'Status Update',
      log_note: 'Note Logged',
      draft_agreement: 'Agreement Drafted',
      draft_refund_rebuttal: 'Rebuttal Drafted',
      search_properties: 'Property Search',
      score_deal: 'Deal Scored',
      generate_listing: 'Listing Generated',
      get_pipeline_stats: 'Pipeline Stats',
      landlord_outreach: 'Outreach Points',
      analyze_deal: 'Deal Analysis',
      calculate_revenue: 'Revenue Calculated',
      get_marketplace: 'Marketplace Deals',
      get_portfolio: 'Portfolio Summary',
    };
    return labels[actionName] || actionName.replace(/_/g, ' ');
  };

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setExecutingActions(false);
    setLastActionsExecuted([]);
    announceToScreenReader('Sending your message to Penny. Please wait for a response.', 'polite');

    // Show "executing" state after a brief delay if still loading
    const execTimer = setTimeout(() => setExecutingActions(true), 1500);

    try {
      const { data, error } = await supabase.functions.invoke('ai-investor-chat', {
        body: {
          action: 'chat',
          user_id: userId,
          user_type: userType,
          user_name: userName,
          message: text,
          session_id: sessionId,
          conversation_history: updatedMessages.map(m => ({ role: m.role, content: m.content }))
        }
      });

      clearTimeout(execTimer);

      if (error) throw error;

      if (data?.success) {
        // Track executed actions
        if (data.actions_executed?.length > 0) {
          setLastActionsExecuted(data.actions_executed);
          const actionNames = data.actions_executed.map((a: any) => getActionLabel(a.action)).join(', ');
          announceToScreenReader(`Penny executed: ${actionNames}`);
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString(),
          actionCard: data.action_card || null
        };
        setMessages(prev => [...prev, assistantMessage]);

        // A component that is never spoken does not exist. The live region only ever
        // read the message text, so a button attached to a reply was silent.
        if (data.action_card?.spoken) {
          announceToScreenReader(data.action_card.spoken, 'assertive');
        }
        
        if (data.is_new_investor !== undefined) {
          setIsNewInvestor(data.is_new_investor);
        }
      } else {
        throw new Error(data?.error || 'Failed to get response');
      }
    } catch (err: any) {
      clearTimeout(execTimer);
      console.error('Error sending message:', err);
      toast({ 
        title: 'Message failed to send', 
        description: 'Please try again.',
        variant: 'destructive' 
      });
      announceToScreenReader('Failed to send message. Please try again.', 'assertive');
      setMessages(prev => prev.slice(0, -1));
    }
    setLoading(false);
    setExecutingActions(false);
    inputRef.current?.focus();
  }, [input, loading, messages, userId, userType, userName, sessionId, toast, announceToScreenReader]);


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatMarkdown = (text: string) => {
    // Convert markdown links to HTML
    let formatted = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#d4a574] underline hover:text-[#c49464]" target="_blank" rel="noopener noreferrer">$1</a>');
    // Bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic text
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br />');
    return formatted;
  };

  const handleOpenChat = () => {
    setIsOpen(true);
    announceToScreenReader('Opening Penny AI chat assistant');
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <>
        {/* Screen reader announcement region */}
        <div 
          id="penny-chat-status" 
          role="status" 
          aria-live="polite" 
          aria-atomic="true" 
          className="sr-only"
        />
        
        <button
          ref={floatingButtonRef}
          onClick={handleOpenChat}
          className="min-h-[44px] fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group focus:outline-none focus:ring-4 focus:ring-[#d4a574] focus:ring-offset-2"
          aria-label="Open Penny AI Chat Assistant. Penny is your AI partner who can help with property searches, investment questions, and acquisition support."
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          type="button"
        >
          <PennyMark size={58} label="Chat with Penny" />
          {/* Tooltip - hidden from screen readers since aria-label provides this info */}
          <span 
            className="absolute -top-10 right-0 bg-gray-900 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
            aria-hidden="true"
          >
            Chat with Penny AI
          </span>
        </button>

      </>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden w-80"
        role="region"
        aria-label="Penny AI chat minimized"
      >
        <button
          onClick={() => {
            setIsMinimized(false);
            announceToScreenReader('Penny AI chat expanded');
          }}
          className="min-h-[44px] w-full p-3 flex items-center justify-between bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
          aria-label="Expand Penny AI chat window"
          aria-expanded="false"
          type="button"
        >
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Penny AI</span>
            <Sparkles className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
          </div>
          <Maximize2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  // Full chat window
  return (
    <>
      {/* Global announcement region for screen readers */}
      <div 
        id="penny-announcements" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      />
      
      <div 
        ref={chatContainerRef}
        className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        role="dialog"
        aria-label="Penny AI Chat Assistant"
        aria-modal="true"
        aria-describedby="penny-chat-description"
      >
        {/* Screen reader only description */}
        <div id="penny-chat-description" className="sr-only">
          Penny is your AI partner at Access Your Place, built by Set Up Your Place LLC. 
          {userType === 'staff' 
            ? 'As a staff member, you can use Penny to search properties, generate listings, pull photos, and manage acquisitions.'
            : 'As an investor, Penny can help you search for deals, analyze your portfolio, answer questions about rental arbitrage, and connect you with acquisition managers.'
          }
          Use Enter to send messages and Escape to close the chat. Use Tab to navigate between controls.
        </div>

        {/* Header */}
        <header className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center" aria-hidden="true">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold flex items-center gap-2" id="penny-chat-title">
                Penny AI
                <Sparkles className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
              </h2>
              <p className="text-xs text-white/70">
                {userType === 'staff' ? 'Staff Assistant' : 'Your AI partner'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1" role="toolbar" aria-label="Chat controls">
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                announceToScreenReader(showHistory ? 'Chat history hidden' : 'Showing chat history');
              }}
              className="min-h-[44px] p-2 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label={showHistory ? 'Hide chat history' : 'Show chat history'}
              aria-pressed={showHistory}
              type="button"
            >
              <History className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={startNewConversation}
              className="min-h-[44px] p-2 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Start new conversation"
              type="button"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => {
                setIsMinimized(true);
                announceToScreenReader('Penny AI chat minimized');
              }}
              className="min-h-[44px] p-2 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Minimize chat window"
              type="button"
            >
              <Minimize2 className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                announceToScreenReader('Penny AI chat closed', 'assertive');
                setTimeout(() => floatingButtonRef.current?.focus(), 100);
              }}
              className="min-h-[44px] p-2 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Close chat window"
              type="button"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* History Panel */}
        {showHistory && (
          <div className="absolute top-16 left-0 right-0 bottom-0 bg-white z-10 flex flex-col" role="region" aria-label="Chat history">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Chat History</h3>
              <p className="text-sm text-gray-500">Your recent conversations with Penny</p>
            </div>
            <ScrollArea className="flex-1 p-4">
              {chatHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No previous conversations</p>
              ) : (
                <div className="space-y-2" role="list" aria-label="Previous conversations">
                  {chatHistory.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className="min-h-[44px] w-full text-left p-3 rounded-lg border border-gray-200 hover:border-[#d4a574] hover:bg-[#d4a574]/5 transition-all focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                      type="button"
                      aria-label={`Load conversation from ${new Date(session.updated_at).toLocaleDateString()} with ${session.messages?.length || 0} messages. First message: ${session.messages?.[0]?.content?.substring(0, 50) || 'New conversation'}`}
                    >
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {session.messages?.[0]?.content || 'New conversation'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(session.updated_at).toLocaleDateString()} • {session.messages?.length || 0} messages
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="p-4 border-t">
              <Button
                onClick={() => {
                  setShowHistory(false);
                  announceToScreenReader('Returned to chat');
                }}
                variant="outline"
                className="w-full"
                type="button"
              >
                <ChevronDown className="w-4 h-4 mr-2" aria-hidden="true" />
                Back to Chat
              </Button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <ScrollArea 
          className="flex-1 p-4" 
          role="log" 
          aria-label="Chat messages" 
          aria-live="polite" 
          aria-relevant="additions"
          aria-describedby="messages-count"
        >
          <div id="messages-count" className="sr-only">
            {messages.length} messages in conversation
          </div>
          
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center mb-4" aria-hidden="true">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Hi {firstName}! I'm Penny
              </h3>
              <p className="text-sm text-gray-500 mb-1">
                Your AI partner at Access Your Place
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Powered by Set Up Your Place LLC
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {userType === 'staff' 
                  ? "I'm here to help you find deals, generate listings, pull property photos, and manage acquisitions. What can I help with?"
                  : isNewInvestor
                    ? "I'd love to get to know you and your investment goals! Ask me anything about rental arbitrage, markets, or your portfolio."
                    : "Ask me anything about rental arbitrage, markets, or your portfolio!"
                }
              </p>
              
              {/* Quick suggestions */}
              <div className="w-full space-y-2" role="list" aria-label="Suggested questions to get started">
                {suggestedQuestions.slice(0, 4).map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(question)}
                    className="min-h-[44px] w-full text-left p-3 rounded-lg border border-gray-200 hover:border-[#d4a574] hover:bg-[#d4a574]/5 transition-all text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                    type="button"
                    aria-label={`Ask Penny: ${question}`}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <article
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  aria-label={`${msg.role === 'user' ? 'You' : 'Penny'} said at ${msg.timestamp ? formatTime(msg.timestamp) : 'unknown time'}`}
                >
                  <div className={`flex items-start gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div 
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user' ? 'bg-[#d4a574]' : 'bg-gradient-to-br from-[#1a365d] to-[#2d4a7c]'
                      }`}
                      aria-hidden="true"
                    >
                      {msg.role === 'user' ? (
                        <span className="text-white text-xs font-medium">
                          {firstName.charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div 
                      className={`rounded-2xl px-3 py-2 ${
                        msg.role === 'user' 
                          ? 'bg-[#d4a574] text-white rounded-tr-sm' 
                          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}
                    >
                      <div 
                        className="text-sm whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                      />
                      {msg.actionCard && (
                        <a
                          href={msg.actionCard.href}
                          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#1a365d] px-4 py-3 text-sm font-semibold text-white hover:bg-[#12283f]"
                        >
                          {msg.actionCard.label}
                        </a>
                      )}
                      {msg.timestamp && (
                        <p 
                          className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}
                        >
                          <span className="sr-only">Sent at </span>
                          {formatTime(msg.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
              {loading && (
                <div className="flex justify-start" role="status" aria-label="Penny is processing">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center" aria-hidden="true">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="flex items-center gap-2">
                        {executingActions ? (
                          <>
                            <Zap className="w-4 h-4 text-amber-500 animate-pulse" aria-hidden="true" />
                            <span className="text-sm text-gray-600 font-medium">Executing operations...</span>
                          </>
                        ) : (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#d4a574]" aria-hidden="true" />
                            <span className="text-sm text-gray-500">Penny is analyzing...</span>
                          </>
                        )}
                      </div>
                      {executingActions && (
                        <p className="text-xs text-gray-400 mt-1">Querying database, running calculations...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Action execution badges */}
              {!loading && lastActionsExecuted.length > 0 && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
                <div className="flex flex-wrap gap-1 ml-9 -mt-2 mb-2">
                  {lastActionsExecuted.map((action, idx) => {
                    const Icon = getActionIcon(action.action);
                    return (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className={`text-[10px] h-5 ${action.success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                      >
                        <Icon className="w-2.5 h-2.5 mr-1" />
                        {getActionLabel(action.action)}
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-3 bg-gray-50">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-center">
            <label htmlFor="penny-chat-input" className="sr-only">
              Type your message to Penny. Press Enter to send, or use the microphone for voice input.
            </label>
            <Input
              id="penny-chat-input"
              ref={inputRef}
              placeholder={userType === 'staff' ? "Ask Penny or use voice..." : "Ask Penny anything..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 text-sm"
              aria-describedby="penny-chat-help"
              autoComplete="off"
            />
            <VoiceInputButton
              onTranscript={(text) => setInput(text)}
              onAutoSend={(text) => {
                setInput('');
                sendMessage(text);
                announceToScreenReader('Voice message sent to Penny');
              }}
              disabled={loading}
              size="sm"
              autoSendDelay={2500}
            />
            <Button 
              type="submit"
              size="sm"
              className="bg-[#d4a574] hover:bg-[#c49464]"
              disabled={!input.trim() || loading}
              aria-label={loading ? "Sending message..." : "Send message to Penny"}
              aria-busy={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="w-4 h-4" aria-hidden="true" />
              )}
            </Button>
          </form>
          <p id="penny-chat-help" className="text-xs text-gray-400 mt-2 text-center">
            Enter to send • Mic for voice • Esc to close
          </p>
        </div>

      </div>
    </>
  );
}

export default PennyChatButton;
