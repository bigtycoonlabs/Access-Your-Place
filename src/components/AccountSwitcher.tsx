import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { sessionSyncService, useSessionSync } from '@/services/SessionSyncService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowLeftRight, Briefcase, User, ChevronDown, Loader2, 
  LogOut, Settings, Link2, Shield, Building2
} from 'lucide-react';

interface AccountSwitcherProps {
  currentAccountType: 'staff' | 'investor';
  currentUser: {
    id: string;
    email: string;
    name: string;
    linkedAccountId?: string;
  };
  onSettingsClick?: () => void;
  onLogout: () => void;
  onLinkAccountClick?: () => void;
  compact?: boolean;
}

export function AccountSwitcher({
  currentAccountType,
  currentUser,
  onSettingsClick,
  onLogout,
  onLinkAccountClick,
  compact = false
}: AccountSwitcherProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [switching, setSwitching] = useState(false);
  const [hasLinkedAccount, setHasLinkedAccount] = useState(!!currentUser.linkedAccountId);
  const [hasBackupSession, setHasBackupSession] = useState(false);

  useEffect(() => {
    // Check for backup sessions (when viewing as different account type)
    const staffBackup = localStorage.getItem('staffSessionBackup');
    const investorBackup = localStorage.getItem('investorSessionBackup');
    setHasBackupSession(!!(staffBackup || investorBackup));
    
    // Check for linked account if not already known
    if (!currentUser.linkedAccountId) {
      checkLinkedAccount();
    }
  }, [currentUser.id, currentUser.linkedAccountId]);

  const checkLinkedAccount = async () => {
    try {
      if (currentAccountType === 'staff') {
        const { data } = await supabase.functions.invoke('staff-login', {
          body: { action: 'get_linked_investor', staff_id: currentUser.id }
        });
        setHasLinkedAccount(!!data?.investor?.id);
      } else {
        const { data } = await supabase.functions.invoke('investor-auth', {
          body: { action: 'get_linked_staff', investor_id: currentUser.id }
        });
        setHasLinkedAccount(!!data?.staff_id);
      }
    } catch (err) {
      console.error('Error checking linked account:', err);
    }
  };

  const handleSwitchAccount = async () => {
    setSwitching(true);
    
    try {
      if (currentAccountType === 'staff') {
        // Switch from Staff to Investor
        const { data, error } = await supabase.functions.invoke('staff-login', {
          body: { action: 'get_linked_investor', staff_id: currentUser.id }
        });

        if (error) throw error;

        if (data?.investor) {
          // Backup current staff session
          const currentSession = localStorage.getItem('staffSession');
          if (currentSession) {
            localStorage.setItem('staffSessionBackup', currentSession);
          }

          // Set investor session
          const investorSession = {
            ...data.investor,
            loginTime: Date.now()
          };
          localStorage.setItem('investorSession', JSON.stringify(investorSession));

          // Notify other tabs via session sync
          sessionSyncService.setInvestorSession(investorSession);

          toast({
            title: 'Switched to Investor Portal',
            description: `Welcome, ${data.investor.full_name || 'Investor'}!`
          });

          navigate('/investor');
        } else {
          throw new Error('No linked investor account found');
        }
      } else {
        // Switch from Investor to Staff
        const { data, error } = await supabase.functions.invoke('investor-auth', {
          body: { action: 'switch_to_staff', investor_id: currentUser.id }
        });

        if (error) throw error;

        if (data?.staff) {
          // Backup current investor session
          const currentSession = localStorage.getItem('investorSession');
          if (currentSession) {
            localStorage.setItem('investorSessionBackup', currentSession);
          }

          // Set staff session
          const staffSession = {
            ...data.staff,
            loginTime: Date.now()
          };
          localStorage.setItem('staffSession', JSON.stringify(staffSession));

          // Notify other tabs via session sync
          sessionSyncService.setStaffSession(staffSession);

          toast({
            title: 'Switched to Staff Dashboard',
            description: `Welcome back, ${data.staff.first_name || data.staff.name}!`
          });

          navigate('/staff');
        } else {
          throw new Error('No linked staff account found');
        }
      }
    } catch (err: any) {
      console.error('Switch account error:', err);
      toast({
        title: 'Switch Failed',
        description: err.message || 'Failed to switch accounts',
        variant: 'destructive'
      });
    } finally {
      setSwitching(false);
    }
  };

  const handleReturnToOriginal = () => {
    if (currentAccountType === 'investor') {
      // Return to Staff from Investor
      const staffBackup = localStorage.getItem('staffSessionBackup');
      if (staffBackup) {
        localStorage.setItem('staffSession', staffBackup);
        localStorage.removeItem('staffSessionBackup');
        
        const staffData = JSON.parse(staffBackup);
        sessionSyncService.setStaffSession(staffData);
        
        navigate('/staff');
      }
    } else {
      // Return to Investor from Staff
      const investorBackup = localStorage.getItem('investorSessionBackup');
      if (investorBackup) {
        localStorage.setItem('investorSession', investorBackup);
        localStorage.removeItem('investorSessionBackup');
        
        const investorData = JSON.parse(investorBackup);
        sessionSyncService.setInvestorSession(investorData);
        
        navigate('/investor');
      }
    }
  };

  const initials = currentUser.name?.charAt(0).toUpperCase() || 'U';
  const firstName = currentUser.name?.split(' ')[0] || 'User';

  // Check if there's a backup session to return to
  const canReturnToOriginal = currentAccountType === 'investor' 
    ? !!localStorage.getItem('staffSessionBackup')
    : !!localStorage.getItem('investorSessionBackup');

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Account Type Indicator */}
        <Badge 
          variant="outline" 
          className={`
            ${currentAccountType === 'staff' 
              ? 'bg-purple-100 text-purple-700 border-purple-300' 
              : 'bg-blue-100 text-blue-700 border-blue-300'
            }
          `}
        >
          {currentAccountType === 'staff' ? (
            <><Shield className="w-3 h-3 mr-1" /> Staff</>
          ) : (
            <><Building2 className="w-3 h-3 mr-1" /> Investor</>
          )}
        </Badge>

        {/* Quick Switch Button */}
        {(hasLinkedAccount || canReturnToOriginal) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={canReturnToOriginal ? handleReturnToOriginal : handleSwitchAccount}
            disabled={switching}
            className="h-8"
          >
            {switching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="gap-2 hover:bg-white/10"
        >
          {/* Avatar with account type indicator */}
          <div className="relative">
            <div 
              className={`
                w-8 h-8 rounded-full flex items-center justify-center font-bold
                ${currentAccountType === 'staff' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-[#d4a574] text-[#1a365d]'
                }
              `}
            >
              {initials}
            </div>
            {/* Account type dot indicator */}
            <div 
              className={`
                absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
                ${currentAccountType === 'staff' ? 'bg-purple-500' : 'bg-blue-500'}
              `}
              title={currentAccountType === 'staff' ? 'Staff Account' : 'Investor Account'}
            />
          </div>
          
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium">{firstName}</p>
            <p className="text-xs opacity-70 capitalize">{currentAccountType}</p>
          </div>
          <ChevronDown className="w-4 h-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {/* Current Account Info */}
        <div className="px-3 py-2 border-b">
          <div className="flex items-center gap-2 mb-1">
            <Badge 
              variant="outline" 
              className={`text-xs ${
                currentAccountType === 'staff' 
                  ? 'bg-purple-100 text-purple-700 border-purple-300' 
                  : 'bg-blue-100 text-blue-700 border-blue-300'
              }`}
            >
              {currentAccountType === 'staff' ? 'Staff Account' : 'Investor Account'}
            </Badge>
          </div>
          <p className="font-medium text-sm">{currentUser.name}</p>
          <p className="text-xs text-gray-500">{currentUser.email}</p>
        </div>

        {/* Return to Original Session */}
        {canReturnToOriginal && (
          <>
            <DropdownMenuItem 
              onClick={handleReturnToOriginal}
              className="cursor-pointer text-amber-600 focus:bg-amber-50 focus:text-amber-700"
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Return to {currentAccountType === 'investor' ? 'Staff' : 'Investor'} Dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Switch Account */}
        {hasLinkedAccount && !canReturnToOriginal && (
          <>
            <DropdownMenuItem 
              onClick={handleSwitchAccount}
              disabled={switching}
              className={`cursor-pointer ${
                currentAccountType === 'staff'
                  ? 'text-blue-600 focus:bg-blue-50 focus:text-blue-700'
                  : 'text-purple-600 focus:bg-purple-50 focus:text-purple-700'
              }`}
            >
              {switching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : currentAccountType === 'staff' ? (
                <Building2 className="w-4 h-4 mr-2" />
              ) : (
                <Briefcase className="w-4 h-4 mr-2" />
              )}
              Switch to {currentAccountType === 'staff' ? 'Investor Portal' : 'Staff Dashboard'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Link Account Option */}
        {!hasLinkedAccount && onLinkAccountClick && (
          <>
            <DropdownMenuItem 
              onClick={onLinkAccountClick}
              className="cursor-pointer text-[#d4a574] focus:bg-amber-50 focus:text-[#c49464]"
            >
              <Link2 className="w-4 h-4 mr-2" />
              Link {currentAccountType === 'staff' ? 'Investor' : 'Staff'} Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Settings */}
        {onSettingsClick && (
          <DropdownMenuItem 
            onClick={onSettingsClick}
            className="cursor-pointer"
          >
            <Settings className="w-4 h-4 mr-2" />
            Account Settings
          </DropdownMenuItem>
        )}

        {/* Logout */}
        <DropdownMenuItem 
          onClick={onLogout}
          className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Visual indicator banner for when viewing as a different account type
export function AccountViewingBanner({ 
  viewingAs, 
  onReturn 
}: { 
  viewingAs: 'staff' | 'investor';
  onReturn: () => void;
}) {
  return (
    <div 
      className={`
        px-4 py-2 flex items-center justify-between
        ${viewingAs === 'investor' 
          ? 'bg-gradient-to-r from-amber-500 to-amber-600' 
          : 'bg-gradient-to-r from-purple-500 to-purple-600'
        }
      `}
    >
      <p className="text-sm font-medium text-white">
        You are viewing as {viewingAs === 'investor' ? 'an investor' : 'staff'}. 
        Your {viewingAs === 'investor' ? 'staff' : 'investor'} session is preserved.
      </p>
      <Button
        size="sm"
        onClick={onReturn}
        className="bg-white text-gray-800 hover:bg-gray-100 font-medium"
      >
        <ArrowLeftRight className="w-4 h-4 mr-2" />
        Return to {viewingAs === 'investor' ? 'Staff' : 'Investor'} Dashboard
      </Button>
    </div>
  );
}
