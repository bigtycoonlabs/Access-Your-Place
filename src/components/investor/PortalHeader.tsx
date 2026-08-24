import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, LogOut, User, Settings, ChevronDown, MessageSquare, Menu, X, ArrowLeftRight, Briefcase } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NotificationBell } from './NotificationBell';
import { MessageNotificationBadge } from './MessageNotificationBadge';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface PortalHeaderProps {
  investor: { id?: string; full_name: string; email: string; company_name?: string; linked_staff_id?: string };
  onSettingsClick?: () => void;
  onMessagesClick?: () => void;
}

export function PortalHeader({ investor, onSettingsClick, onMessagesClick }: PortalHeaderProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasStaffSession, setHasStaffSession] = useState(false);
  const [hasLinkedStaffAccount, setHasLinkedStaffAccount] = useState(false);
  const [switchingToStaff, setSwitchingToStaff] = useState(false);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Check if there's a staff session backup (staff member viewing as investor)
    const staffBackup = localStorage.getItem('staffSessionBackup');
    setHasStaffSession(!!staffBackup);
    
    // Check if investor has a linked staff account
    checkLinkedStaffAccount();
  }, [investor.id]);

  const checkLinkedStaffAccount = async () => {
    if (!investor.id) return;
    
    try {
      // Check if investor has linked_staff_id in their record
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: { action: 'get_linked_staff', investor_id: investor.id }
      });
      
      if (data?.staff_id) {
        setHasLinkedStaffAccount(true);
      }
    } catch (err) {
      console.error('Failed to check linked staff account:', err);
    }
  };

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  // Focus management for mobile menu
  useEffect(() => {
    if (mobileMenuOpen && mobileMenuRef.current) {
      const firstLink = mobileMenuRef.current.querySelector('a, button') as HTMLElement;
      firstLink?.focus();
    }
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem('investorSession');
    // Also clear staff session backup if exists
    localStorage.removeItem('staffSessionBackup');
    navigate('/investor/login');
  };

  const handleReturnToStaff = () => {
    const staffBackup = localStorage.getItem('staffSessionBackup');
    if (staffBackup) {
      // Restore the staff session
      localStorage.setItem('staffSession', staffBackup);
      // Clear the backup
      localStorage.removeItem('staffSessionBackup');
      // Navigate back to staff dashboard
      navigate('/staff');
    }
  };

  const handleSwitchToStaff = async () => {
    if (!investor.id) return;
    
    setSwitchingToStaff(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-auth', {
        body: { action: 'switch_to_staff', investor_id: investor.id }
      });
      
      if (error) throw error;
      
      if (data?.staff) {
        // Store investor session for switching back
        localStorage.setItem('investorSessionBackup', JSON.stringify({
          ...investor,
          loginTime: Date.now()
        }));
        
        // Set staff session
        localStorage.setItem('staffSession', JSON.stringify({
          ...data.staff,
          loginTime: Date.now()
        }));
        
        toast({ 
          title: 'Switched to Staff Dashboard', 
          description: `Welcome back, ${data.staff.first_name || data.staff.name}!` 
        });
        
        // Navigate to staff dashboard
        navigate('/staff');
      } else {
        toast({ 
          title: 'Error', 
          description: 'Could not load staff account data', 
          variant: 'destructive' 
        });
      }
    } catch (err: any) {
      console.error('Switch to staff error:', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to switch to staff dashboard', 
        variant: 'destructive' 
      });
    } finally {
      setSwitchingToStaff(false);
    }
  };

  const firstName = investor.full_name?.split(' ')[0] || 'User';
  const initials = investor.full_name?.charAt(0).toUpperCase() || 'U';

  return (
    <header className="bg-[#1a365d] text-white shadow-lg" role="banner">
      {/* Staff Return Banner */}
      {hasStaffSession && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2" role="alert">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm font-medium text-white">
              You are viewing as an investor. Your staff session is preserved.
            </p>
            <Button
              size="sm"
              onClick={handleReturnToStaff}
              className="bg-white text-amber-600 hover:bg-amber-50 font-medium focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-amber-500"
              aria-label="Return to staff dashboard"
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" aria-hidden="true" />
              Return to Staff Dashboard
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a 
            href="/"
            onClick={(e) => { e.preventDefault(); navigate('/'); }}
            className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#1a365d] rounded-lg p-1"
            aria-label="Access Your Place - Go to homepage"
          >
            <Building2 className="w-8 h-8 text-[#d4a574]" aria-hidden="true" />
            <div>
              <span className="font-bold text-lg">Access Your Place</span>
              <span className="text-xs block text-[#d4a574]">Operator Portal</span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav 
            id="main-navigation"
            className="hidden md:flex items-center gap-6" 
            aria-label="Main navigation"
          >
            <a 
              href="/investor/portal"
              onClick={(e) => { e.preventDefault(); navigate('/investor/portal'); }}
              className="hover:text-[#d4a574] transition focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded px-2 py-1"
            >
              Dashboard
            </a>
            <a 
              href="/deals"
              onClick={(e) => { e.preventDefault(); navigate('/deals'); }}
              className="hover:text-[#d4a574] transition focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded px-2 py-1"
            >
              Deal Flow
            </a>
            <a
              href="/investor/portal"
              onClick={(e) => { e.preventDefault(); navigate('/investor/portal?tab=documents'); }}
              className="hover:text-[#d4a574] transition focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded px-2 py-1"
            >
              Documents
            </a>
            <a 
              href="/knowledge-library"
              onClick={(e) => { e.preventDefault(); navigate('/knowledge-library'); }}
              className="hover:text-[#d4a574] transition focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded px-2 py-1"
            >
              Resources
            </a>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Switch to Staff Account Button - Only show if investor has linked staff account */}
            {hasLinkedStaffAccount && !hasStaffSession && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSwitchToStaff}
                disabled={switchingToStaff}
                className="hidden sm:flex bg-gradient-to-r from-purple-600/10 to-blue-600/10 border-purple-400/30 text-white hover:bg-purple-600/20 hover:text-white"
                aria-label="Switch to staff dashboard"
              >
                <Briefcase className="w-4 h-4 mr-2" aria-hidden="true" />
                {switchingToStaff ? 'Switching...' : 'Staff Dashboard'}
              </Button>
            )}

            {investor.id && (
              <>
                <MessageNotificationBadge 
                  investorId={investor.id} 
                  onClick={onMessagesClick} 
                />
                <NotificationBell investorId={investor.id} />
              </>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="text-white hover:bg-white/10 gap-2 focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#1a365d]"
                  aria-label={`Account menu for ${investor.full_name}`}
                  aria-haspopup="menu"
                >
                  <div 
                    className="w-8 h-8 rounded-full bg-[#d4a574] flex items-center justify-center text-[#1a365d] font-bold"
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium">{firstName}</p>
                    {investor.company_name && (
                      <p className="text-xs text-white/70">{investor.company_name}</p>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-70" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" role="menu" aria-label="User account menu">
                <div className="px-3 py-2 border-b" role="presentation">
                  <p className="font-medium text-sm">{investor.full_name}</p>
                  <p className="text-xs text-gray-500">{investor.email}</p>
                </div>
                {hasStaffSession && (
                  <>
                    <DropdownMenuItem 
                      onClick={handleReturnToStaff} 
                      className="cursor-pointer text-amber-600 focus:bg-amber-50 focus:text-amber-700"
                      role="menuitem"
                    >
                      <ArrowLeftRight className="w-4 h-4 mr-2" aria-hidden="true" />
                      Return to Staff Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {hasLinkedStaffAccount && !hasStaffSession && (
                  <>
                    <DropdownMenuItem 
                      onClick={handleSwitchToStaff}
                      disabled={switchingToStaff}
                      className="cursor-pointer text-purple-600 focus:bg-purple-50 focus:text-purple-700"
                      role="menuitem"
                    >
                      <Briefcase className="w-4 h-4 mr-2" aria-hidden="true" />
                      {switchingToStaff ? 'Switching...' : 'Switch to Staff Account'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem 
                  onClick={onMessagesClick} 
                  className="cursor-pointer focus:bg-gray-100"
                  role="menuitem"
                >
                  <MessageSquare className="w-4 h-4 mr-2" aria-hidden="true" />
                  Messages
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onSettingsClick} 
                  className="cursor-pointer focus:bg-gray-100"
                  role="menuitem"
                >
                  <Settings className="w-4 h-4 mr-2" aria-hidden="true" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onSettingsClick} 
                  className="cursor-pointer focus:bg-gray-100"
                  role="menuitem"
                >
                  <User className="w-4 h-4 mr-2" aria-hidden="true" />
                  Edit Preferences
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="text-red-600 cursor-pointer focus:bg-red-50 focus:text-red-700"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button
              ref={menuButtonRef}
              variant="ghost"
              className="md:hidden text-white hover:bg-white/10 focus:ring-2 focus:ring-[#d4a574]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav 
            ref={mobileMenuRef}
            id="mobile-menu"
            className="md:hidden mt-4 pt-4 border-t border-white/20"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-2">
              {hasStaffSession && (
                <button
                  onClick={handleReturnToStaff}
                  className="py-2 px-3 rounded bg-amber-500 hover:bg-amber-600 transition text-left font-medium focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <ArrowLeftRight className="w-4 h-4 inline mr-2" aria-hidden="true" />
                  Return to Staff Dashboard
                </button>
              )}
              {hasLinkedStaffAccount && !hasStaffSession && (
                <button
                  onClick={handleSwitchToStaff}
                  disabled={switchingToStaff}
                  className="py-2 px-3 rounded bg-purple-600 hover:bg-purple-700 transition text-left font-medium focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                >
                  <Briefcase className="w-4 h-4 inline mr-2" aria-hidden="true" />
                  {switchingToStaff ? 'Switching...' : 'Switch to Staff Account'}
                </button>
              )}
              <a 
                href="/investor/portal"
                onClick={(e) => { e.preventDefault(); navigate('/investor/portal'); setMobileMenuOpen(false); }}
                className="py-2 px-3 rounded hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
              >
                Dashboard
              </a>
              <a 
                href="/deals"
                onClick={(e) => { e.preventDefault(); navigate('/deals'); setMobileMenuOpen(false); }}
                className="py-2 px-3 rounded hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
              >
                Deal Flow
              </a>
              <a
                href="/investor/portal"
                onClick={(e) => { e.preventDefault(); navigate('/investor/portal?tab=documents'); setMobileMenuOpen(false); }}
                className="py-2 px-3 rounded hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
              >
                Documents
              </a>
              <a 
                href="/knowledge-library"
                onClick={(e) => { e.preventDefault(); navigate('/knowledge-library'); setMobileMenuOpen(false); }}
                className="py-2 px-3 rounded hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
              >
                Resources
              </a>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
