import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles,
  User, CreditCard, Bell, FileText, Building2, MessageSquare,
  Calendar, Shield, BookOpen, Target, Loader2, Cloud, CloudOff
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  actionTab?: string;
  category: 'setup' | 'explore' | 'engage';
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'complete_profile',
    title: 'Complete Your Profile',
    description: 'Add your investment preferences, budget range, and preferred markets to get personalized recommendations.',
    icon: <User className="w-5 h-5" />,
    action: 'Go to Settings',
    actionTab: 'settings',
    category: 'setup'
  },
  {
    id: 'verify_email',
    title: 'Verify Your Email',
    description: 'Check your inbox for a verification link to unlock all platform features.',
    icon: <Shield className="w-5 h-5" />,
    category: 'setup'
  },
  {
    id: 'fund_account',
    title: 'Fund Your Account',
    description: 'Choose an activation tier to unlock property addresses and start your acquisition journey.',
    icon: <CreditCard className="w-5 h-5" />,
    action: 'Fund Account',
    actionTab: 'financial',
    category: 'setup'
  },
  {
    id: 'setup_deal_alerts',
    title: 'Set Up Deal Alerts',
    description: 'Configure your deal preferences so you get notified instantly when matching properties are listed.',
    icon: <Bell className="w-5 h-5" />,
    action: 'Configure Alerts',
    actionTab: 'notifications-hub',
    category: 'setup'
  },
  {
    id: 'browse_deals',
    title: 'Browse Active Deals',
    description: 'Explore our current deal flow to see what properties are available in your target markets.',
    icon: <Building2 className="w-5 h-5" />,
    action: 'View Deals',
    actionTab: 'property-search',
    category: 'explore'
  },
  {
    id: 'watch_tutorials',
    title: 'Watch Getting Started Videos',
    description: 'Learn how to use the platform effectively with our quick tutorial videos.',
    icon: <BookOpen className="w-5 h-5" />,
    action: 'Watch Videos',
    actionTab: 'tutorials',
    category: 'explore'
  },
  {
    id: 'book_call',
    title: 'Book a Discovery Call',
    description: 'Schedule a call with an acquisition manager to discuss your investment goals and strategy.',
    icon: <Calendar className="w-5 h-5" />,
    action: 'Book Call',
    actionTab: 'book-call',
    category: 'engage'
  },
  {
    id: 'send_message',
    title: 'Send Your First Message',
    description: 'Introduce yourself to your team through the messaging system.',
    icon: <MessageSquare className="w-5 h-5" />,
    action: 'Open Messages',
    actionTab: 'messages',
    category: 'engage'
  },
  {
    id: 'review_documents',
    title: 'Review Key Documents',
    description: 'Familiarize yourself with the platform terms, acquisition process, and compliance requirements.',
    icon: <FileText className="w-5 h-5" />,
    action: 'View Documents',
    actionTab: 'documents',
    category: 'explore'
  },
  {
    id: 'set_deal_matching',
    title: 'Configure AI Deal Matching',
    description: 'Set up intelligent deal matching preferences so our AI can find the best properties for you.',
    icon: <Target className="w-5 h-5" />,
    action: 'Set Preferences',
    actionTab: 'deal-matching',
    category: 'engage'
  }
];

interface Props {
  investor: any;
  onNavigate: (tab: string) => void;
  onBookCall?: () => void;
}

export function OnboardingChecklist({ investor, onNavigate, onBookCall }: Props) {
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [synced, setSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load from DB on mount, fallback to localStorage
  useEffect(() => {
    const loadProgress = async () => {
      // First load from localStorage for instant display
      const stored = localStorage.getItem(`onboarding_checklist_${investor.id}`);
      let localItems: string[] = stored ? JSON.parse(stored) : [];

      // Auto-detect completed items from investor data
      const autoCompleted: string[] = [];
      if (investor.email_verified) autoCompleted.push('verify_email');
      if (investor.account_funded) autoCompleted.push('fund_account');
      if (investor.preferred_markets?.length > 0 && investor.investment_budget_max) {
        autoCompleted.push('complete_profile');
      }
      if (investor.deals_closed > 0) autoCompleted.push('browse_deals');

      const mergedLocal = [...new Set([...localItems, ...autoCompleted])];
      setCompletedItems(mergedLocal);

      // Then try to load from database
      try {
        const { data } = await supabase.functions.invoke('manage-investor-progress', {
          body: { action: 'get_checklist', investor_id: investor.id }
        });

        if (data?.success && data.completed_items) {
          const dbItems: string[] = data.completed_items;
          // Merge DB items with auto-detected and local items
          const merged = [...new Set([...dbItems, ...mergedLocal])];
          setCompletedItems(merged);
          // Update localStorage cache
          localStorage.setItem(`onboarding_checklist_${investor.id}`, JSON.stringify(merged));
          // If there were new items from local, sync back to DB
          if (merged.length > dbItems.length) {
            await saveToDB(merged);
          }
          setSynced(true);
        } else {
          // DB had no data, push local data to DB
          if (mergedLocal.length > 0) {
            await saveToDB(mergedLocal);
          }
          setSynced(true);
        }
      } catch (err) {
        console.error('Failed to load checklist from DB, using localStorage:', err);
        // localStorage data is already set above
      }
    };

    loadProgress();
  }, [investor.id, investor.email_verified, investor.account_funded, investor.preferred_markets, investor.investment_budget_max, investor.deals_closed]);

  const saveToDB = async (items: string[]) => {
    try {
      await supabase.functions.invoke('manage-investor-progress', {
        body: {
          action: 'update_checklist',
          investor_id: investor.id,
          completed_items: items
        }
      });
      setSynced(true);
    } catch (err) {
      console.error('Failed to save checklist to DB:', err);
      setSynced(false);
    }
  };

  // Debounced save to DB
  const debouncedSave = useCallback((items: string[]) => {
    // Always save to localStorage immediately
    localStorage.setItem(`onboarding_checklist_${investor.id}`, JSON.stringify(items));
    
    // Debounce DB save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSyncing(true);
    saveTimeoutRef.current = setTimeout(async () => {
      await saveToDB(items);
      setSyncing(false);
    }, 1000);
  }, [investor.id]);

  const toggleItem = (itemId: string) => {
    setCompletedItems(prev => {
      const updated = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      debouncedSave(updated);
      return updated;
    });
  };

  const handleAction = (item: ChecklistItem) => {
    if (item.actionTab === 'book-call' && onBookCall) {
      onBookCall();
    } else if (item.actionTab === 'deals') {
      window.location.href = '/deals';
    } else if (item.actionTab) {
      onNavigate(item.actionTab);
    }
    // Mark as completed when action is taken
    if (!completedItems.includes(item.id)) {
      toggleItem(item.id);
    }
  };

  const progress = Math.round((completedItems.length / CHECKLIST_ITEMS.length) * 100);
  const remainingItems = CHECKLIST_ITEMS.filter(item => !completedItems.includes(item.id));
  const displayItems = showAll ? CHECKLIST_ITEMS : remainingItems.slice(0, 4);

  // Don't show if all items completed
  if (progress === 100) {
    return (
      <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Onboarding Complete!</h3>
              <p className="text-white/80 text-sm">
                You've completed all getting started steps. You're ready to find your next deal!
              </p>
            </div>
            <div className="flex items-center gap-1 text-white/60 text-xs">
              <Cloud className="w-3 h-3" />
              <span>Synced</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#d4a574]/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d4a574]/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-[#d4a574]" />
            </div>
            <div>
              <CardTitle className="text-lg">Getting Started</CardTitle>
              <p className="text-sm text-gray-500">
                {completedItems.length} of {CHECKLIST_ITEMS.length} steps completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Sync status indicator */}
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
            ) : synced ? (
              <Cloud className="w-3.5 h-3.5 text-green-500" title="Synced to cloud" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-gray-400" title="Saved locally" />
            )}
            <Badge variant="outline" className="text-[#d4a574] border-[#d4a574]">
              {progress}%
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <Progress value={progress} className="mt-3 h-2" />
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {displayItems.map((item) => {
              const isCompleted = completedItems.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                    isCompleted 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-gray-50 border border-gray-200 hover:border-[#d4a574]/50'
                  }`}
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="mt-0.5 flex-shrink-0"
                    aria-label={isCompleted ? `Mark ${item.title} as incomplete` : `Mark ${item.title} as complete`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 hover:text-[#d4a574]" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isCompleted ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                        {item.title}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                      {item.description}
                    </p>
                  </div>
                  {!isCompleted && item.action && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 text-xs h-7"
                      onClick={() => handleAction(item)}
                    >
                      {item.action}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {remainingItems.length > 4 && !showAll && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-[#d4a574]"
              onClick={() => setShowAll(true)}
            >
              Show {remainingItems.length - 4} more steps
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          )}
          {showAll && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-gray-500"
              onClick={() => setShowAll(false)}
            >
              Show less
              <ChevronUp className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
