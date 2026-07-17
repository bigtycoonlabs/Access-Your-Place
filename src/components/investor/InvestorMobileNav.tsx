import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, LayoutDashboard, Home, Store, Search, Bell, Heart,
  MessageSquare, Mail, Briefcase, FolderOpen, FileSignature, Brain,
  BellRing, Wallet, CalendarDays, FileText, Gift, Scale, BookOpen,
  MailOpen, Settings, X, AlertTriangle, Zap
} from 'lucide-react';

export interface InvestorNavItem {
  value: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  group?: string;
}

interface InvestorMobileNavProps {
  items: InvestorNavItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
}

const INVESTOR_TAB_GROUPS: Record<string, { label: string; order: number }> = {
  'overview': { label: 'Overview', order: 1 },
  'deals': { label: 'Deals & Properties', order: 2 },
  'communications': { label: 'Communications', order: 3 },
  'management': { label: 'Management', order: 4 },
  'financial': { label: 'Financial & Reports', order: 5 },
  'account': { label: 'Account', order: 6 },
};

export function InvestorMobileNav({ items, activeTab, onTabChange }: InvestorMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeItem = items.find(item => item.value === activeTab);
  const ActiveIcon = activeItem?.icon || LayoutDashboard;

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Group items
  const groupedItems = items.reduce((acc, item) => {
    const group = item.group || 'overview';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, InvestorNavItem[]>);

  const sortedGroups = Object.entries(groupedItems).sort(
    ([a], [b]) => (INVESTOR_TAB_GROUPS[a]?.order || 99) - (INVESTOR_TAB_GROUPS[b]?.order || 99)
  );

  return (
    <div className="relative md:hidden mb-4">
      {/* Mobile dropdown trigger */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-2 ${
          isOpen ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200' : 'bg-white border-gray-200'
        } transition-all shadow-sm`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Navigation menu, currently on ${activeItem?.label || 'Dashboard'}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md flex items-center justify-center bg-amber-100">
            <ActiveIcon className="w-4 h-4 text-amber-700" aria-hidden="true" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-gray-900">{activeItem?.label || 'Dashboard'}</p>
            <p className="text-xs text-gray-500">
              {activeItem?.group ? INVESTOR_TAB_GROUPS[activeItem.group]?.label : 'Navigation'}
            </p>
          </div>
        </div>
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          aria-hidden="true" 
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40" 
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu panel */}
          <div
            ref={menuRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[70vh] overflow-y-auto"
            role="listbox"
            aria-label="Investor portal navigation"
          >
            {/* Close button header */}
            <div className="sticky top-0 bg-white border-b px-4 py-2 flex items-center justify-between rounded-t-xl z-10">
              <span className="text-sm font-semibold text-gray-700">Navigate to...</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md hover:bg-gray-100"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-2">
              {sortedGroups.map(([groupKey, groupItems]) => (
                <div key={groupKey} className="mb-1">
                  {/* Group header */}
                  {sortedGroups.length > 1 && (
                    <p className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {INVESTOR_TAB_GROUPS[groupKey]?.label || groupKey}
                    </p>
                  )}
                  
                  {/* Group items */}
                  {groupItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.value;
                    
                    return (
                      <button
                        key={item.value}
                        onClick={() => {
                          onTabChange(item.value);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isActive 
                            ? 'bg-amber-100 text-amber-700 font-semibold' 
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <Icon 
                          className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-700' : 'text-gray-400'}`} 
                          aria-hidden="true" 
                        />
                        <span className="flex-1 text-sm">{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <Badge 
                            className="bg-red-500 text-white text-[10px] min-w-[20px] h-5 flex items-center justify-center"
                          >
                            {item.badge}
                          </Badge>
                        )}
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Pre-built tab configuration for investor portal
export function getInvestorTabs(): InvestorNavItem[] {
  return [
    { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'overview' },
    { value: 'portfolio', label: 'Portfolio', icon: Home, group: 'overview' },
    { value: 'marketplace', label: 'Marketplace', icon: Store, group: 'deals' },
    { value: 'property-search', label: 'Property Search', icon: Search, group: 'deals' },
    { value: 'saved', label: 'Saved Deals', icon: Heart, group: 'deals' },
    { value: 'deal-matching', label: 'Deal Matching', icon: Brain, group: 'deals' },
    { value: 'deal-alerts', label: 'Deal Alerts', icon: BellRing, group: 'deals' },
    { value: 'leadforge', label: 'LeadForge', icon: Zap, group: 'deals' },
    { value: 'notifications-hub', label: 'Notifications & Alerts', icon: Bell, group: 'communications' },
    { value: 'inquiries', label: 'Inquiries', icon: MessageSquare, group: 'communications' },
    { value: 'messages', label: 'Messages', icon: Mail, group: 'communications' },
    { value: 'acquisitions', label: 'Acquisitions', icon: Briefcase, group: 'management' },
    { value: 'documents', label: 'Documents', icon: FolderOpen, group: 'management' },
    { value: 'signatures', label: 'Signatures', icon: FileSignature, group: 'management' },
    { value: 'calendar', label: 'Calendar', icon: CalendarDays, group: 'management' },
    { value: 'financial', label: 'Financial Hub', icon: Wallet, group: 'financial' },
    { value: 'reports', label: 'Market Reports', icon: FileText, group: 'financial' },
    { value: 'referrals', label: 'Referral Program', icon: Gift, group: 'financial' },
    { value: 'disputes', label: 'Disputes', icon: Scale, group: 'account' },
    { value: 'tutorials', label: 'Tutorials', icon: BookOpen, group: 'account' },
    { value: 'email-preferences', label: 'Email Preferences', icon: MailOpen, group: 'account' },
    { value: 'settings', label: 'Settings', icon: Settings, group: 'account' },
  ];
}
