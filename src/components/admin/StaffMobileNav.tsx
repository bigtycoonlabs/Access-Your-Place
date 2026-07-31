import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, BarChart3, Target, Building, UserCog, Users, PenTool, 
  Mail, FileText, UsersRound, Wrench, Scale, HeadphonesIcon, BookOpen, 
  Settings, UserCheck, ClipboardCheck, X, Landmark, Briefcase, Inbox, Sparkles
} from 'lucide-react';


export interface NavItem {
  value: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  group?: string;
}

interface StaffMobileNavProps {
  items: NavItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  accentColor?: string;
}

// Tab group definitions for organized mobile navigation
const TAB_GROUPS: Record<string, { label: string; order: number }> = {
  'core': { label: 'Core', order: 1 },
  'deals': { label: 'Deals & Investors', order: 2 },
  'content': { label: 'Content & Comms', order: 3 },
  'operations': { label: 'Operations', order: 4 },
  'system': { label: 'System', order: 5 },
};

export function StaffMobileNav({ items, activeTab, onTabChange, accentColor = 'amber' }: StaffMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeItem = items.find(item => item.value === activeTab);
  const ActiveIcon = activeItem?.icon || BarChart3;

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

  // Close on escape
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
    const group = item.group || 'core';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const sortedGroups = Object.entries(groupedItems).sort(
    ([a], [b]) => (TAB_GROUPS[a]?.order || 99) - (TAB_GROUPS[b]?.order || 99)
  );

  const accentClasses: Record<string, { bg: string; text: string; ring: string; activeBg: string; border: string; dot: string }> = {
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-300', activeBg: 'bg-amber-100', border: 'border-amber-300', dot: 'bg-amber-500' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-300', activeBg: 'bg-indigo-100', border: 'border-indigo-300', dot: 'bg-indigo-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-300', activeBg: 'bg-emerald-100', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  };
  const accent = accentClasses[accentColor] || accentClasses.amber;


  return (
    <div className="relative md:hidden mb-4">
      {/* Mobile dropdown trigger */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-2 ${
          isOpen ? `${accent.bg} ${accent.border} ${accent.ring}` : 'bg-white border-gray-200'
        } transition-all shadow-sm`}

        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Navigation menu, currently on ${activeItem?.label || 'Dashboard'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${accent.activeBg}`}>
            <ActiveIcon className={`w-4 h-4 ${accent.text}`} aria-hidden="true" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-gray-900">{activeItem?.label || 'Dashboard'}</p>
            <p className="text-xs text-gray-500">{activeItem?.group ? TAB_GROUPS[activeItem.group]?.label : 'Navigation'}</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
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
            aria-label="Dashboard navigation"
          >
            {/* Close button for touch accessibility */}
            <div className="sticky top-0 bg-white border-b px-4 py-2 flex items-center justify-between rounded-t-xl">
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
                      {TAB_GROUPS[groupKey]?.label || groupKey}
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
                            ? `${accent.activeBg} ${accent.text} font-semibold` 
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? accent.text : 'text-gray-400'}`} aria-hidden="true" />
                        <span className="flex-1 text-sm">{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <Badge 
                            className="bg-red-500 text-white text-[10px] min-w-[20px] h-5 flex items-center justify-center"
                          >
                            {item.badge}
                          </Badge>
                        )}
                        {isActive && (
                          <div className={`w-2 h-2 rounded-full ${accent.dot}`} aria-hidden="true" />
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

// Pre-built tab configurations for each dashboard type
export function getSuccessTeamTabs(unassignedCount: number, landlordOpsCount?: number): NavItem[] {
  return [
    { value: 'penny-home', label: 'Penny', icon: Sparkles, group: 'core' },
    { value: 'analytics', label: 'Analytics Dashboard', icon: BarChart3, group: 'core' },
    { value: 'list-a-deal', label: 'List a Deal', icon: Sparkles, group: 'core' },
    { value: 'request-center', label: 'Request Center', icon: Inbox, group: 'core' },
    { value: 'acq-dashboard', label: 'Acquisitions', icon: Target, group: 'core' },
    { value: 'dealflow', label: 'Deal Flow & Marketplace', icon: Building, group: 'deals' },
    { value: 'investors', label: 'Investor Management', icon: UserCog, badge: unassignedCount, group: 'deals' },
    { value: 'landlord-ops', label: 'Landlord Ops', icon: Landmark, badge: landlordOpsCount, group: 'deals' },
    { value: 'content', label: 'Content Management', icon: PenTool, group: 'content' },
    { value: 'communications', label: 'Communications', icon: Mail, group: 'content' },
    { value: 'documents', label: 'Documents', icon: FileText, group: 'operations' },
    { value: 'staff', label: 'Staff Management', icon: UsersRound, group: 'operations' },
    { value: 'hr-commissions', label: 'HR & Pay', icon: Briefcase, group: 'operations' },
    { value: 'setups', label: 'Setup Dashboard', icon: Wrench, group: 'operations' },
    { value: 'disputes', label: 'Disputes', icon: Scale, group: 'operations' },
    { value: 'support', label: 'Support Requests', icon: HeadphonesIcon, group: 'system' },
    { value: 'sops', label: 'SOPs', icon: BookOpen, group: 'system' },
    { value: 'settings', label: 'Settings', icon: Settings, group: 'system' },
  ];
}



/**
 * Mobile navigation tabs for Acquisition Managers.
 * 
 * IMPORTANT: This list is intentionally restricted to AM-safe tabs only.
 * The following success-team-only tab values are EXCLUDED and must NOT be added:
 *   - 'reservations'       (Pending Reservations — success team only)
 *   - 'workflow'            (Workflow Pipeline — success team only)
 *   - 'verification'       (Deal Verification — success team only)
 *   - 'transactions'       (Transaction Management — success team only)
 *   - 'payments'           (Payment Approvals — success team only)
 *   - 'property-referrals' (Property Referrals — success team only)
 *   - 'referrals'          (Client Referrals — success team only)
 * 
 * These tabs are gated behind isSuccessManager in StaffDashboard.tsx (both
 * TabsTrigger and TabsContent). This mobile nav list must stay in sync with
 * the desktop Acquisition Manager TabsTrigger block (lines ~1152-1179 of
 * StaffDashboard.tsx).
 * 
 * Allowed values: acq-dashboard, my-investors, dealflow, landlord-ops,
 *                 hr-commissions, sops, settings
 */
export function getAcquisitionTabs(landlordOpsCount?: number): NavItem[] {
  // Success-team-only tab values that must never appear here
  const FORBIDDEN_TAB_VALUES = new Set([
    'reservations', 'workflow', 'verification', 'transactions',
    'payments', 'property-referrals', 'referrals',
  ]);

  const tabs: NavItem[] = [
    { value: 'penny-home', label: 'Penny', icon: Sparkles, group: 'core' },
    { value: 'acq-dashboard', label: 'Dashboard', icon: Target, group: 'core' },
    { value: 'list-a-deal', label: 'List a Deal', icon: Sparkles, group: 'core' },
    { value: 'my-investors', label: 'My Investors', icon: UserCheck, group: 'core' },
    { value: 'dealflow', label: 'Deal Flow', icon: Building, group: 'deals' },
    { value: 'landlord-ops', label: 'Landlord Ops', icon: Landmark, badge: landlordOpsCount, group: 'deals' },
    { value: 'hr-commissions', label: 'HR & Pay', icon: Briefcase, group: 'operations' },
    { value: 'sops', label: 'SOPs', icon: BookOpen, group: 'system' },
    { value: 'settings', label: 'Settings', icon: Settings, group: 'system' },
  ];

  // Runtime safety: filter out any accidentally-added success-only tabs
  return tabs.filter(tab => !FORBIDDEN_TAB_VALUES.has(tab.value));
}


export function getSetupTabs(): NavItem[] {
  return [
    { value: 'penny-home', label: 'Penny', icon: Sparkles, group: 'core' },
    { value: 'setups', label: 'Setup Dashboard', icon: Wrench, group: 'core' },
    { value: 'my-setups', label: 'My Projects', icon: ClipboardCheck, group: 'core' },
    { value: 'hr-commissions', label: 'HR & Pay', icon: Briefcase, group: 'operations' },
    { value: 'sops', label: 'SOPs', icon: BookOpen, group: 'system' },
    { value: 'settings', label: 'Settings', icon: Settings, group: 'system' },
  ];
}
