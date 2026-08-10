import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  User, Phone, Link2, Unlink, Eye, EyeOff, Loader2, Check, X,
  AlertCircle, Building2, Mail, Shield, ArrowLeftRight, Bell,
  MessageSquare, Send, UserPlus, Home, Store, FileText, RefreshCw,
  Info, ShieldCheck
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { PasswordStrengthIndicator, validatePasswordStrength } from '@/components/investor/PasswordStrengthIndicator';

interface StaffSettingsTabProps {
  staffSession: {
    id?: string;
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    whatsapp?: string;
    whatsapp_number?: string;
    linked_investor_id?: string;
    department?: string;
    roles?: string[];
    permissions?: string[];
    role?: string;
    yp_certified?: boolean;
    trainee_status?: string;
    notification_preferences?: {
      sms?: boolean;
      email?: boolean;
      new_investor?: boolean;
      portfolio_property?: boolean;
      marketplace_listing?: boolean;
      acquisition_request?: boolean;
    };
  };
  onSessionUpdate: (updatedSession: any) => void;
  /** Whether the current user is a Success Manager (controls visibility of Session & Roles card) */
  isSuccessManager?: boolean;
}


interface LinkedInvestor {
  id: string;
  full_name: string;
  email: string;
  company_name?: string;
  phone?: string;
}

export function StaffSettingsTab({ staffSession, onSessionUpdate, isSuccessManager: isSuccessManagerProp }: StaffSettingsTabProps) {

  const { toast } = useToast();
  
  // Profile state
  const [phone, setPhone] = useState(staffSession.phone || '');
  const [whatsapp, setWhatsapp] = useState(staffSession.whatsapp || staffSession.whatsapp_number || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [testingSMS, setTestingSMS] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<'success' | 'error' | null>(null);
  
  // Session refresh state
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  
  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    sms: staffSession.notification_preferences?.sms !== false,
    email: staffSession.notification_preferences?.email !== false,
    new_investor: staffSession.notification_preferences?.new_investor !== false,
    portfolio_property: staffSession.notification_preferences?.portfolio_property !== false,
    marketplace_listing: staffSession.notification_preferences?.marketplace_listing !== false,
    acquisition_request: staffSession.notification_preferences?.acquisition_request !== false,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Investor linking state
  const [investorEmail, setInvestorEmail] = useState('');
  const [linkedInvestor, setLinkedInvestor] = useState<LinkedInvestor | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [loadingLinked, setLoadingLinked] = useState(false);

  useEffect(() => {
    if (staffSession.linked_investor_id) {
      loadLinkedInvestor();
    }
  }, [staffSession.linked_investor_id]);

  const loadLinkedInvestor = async () => {
    if (!staffSession.linked_investor_id) return;
    
    setLoadingLinked(true);
    try {
      const { data, error } = await supabase.functions.invoke('staff-login', {
        body: { 
          action: 'get_linked_investor',
          staff_id: staffSession.id
        }
      });

      if (data?.investor) {
        setLinkedInvestor(data.investor);
      }
    } catch (err) {
      console.error('Failed to load linked investor:', err);
    } finally {
      setLoadingLinked(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (value: string, setter: (v: string) => void) => {
    const formatted = formatPhoneNumber(value);
    setter(formatted);
    // Reset test result when phone changes
    setSmsTestResult(null);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'update_profile',
          staff_id: staffSession.id,
          phone,
          whatsapp
        }
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error);
      }

      // Update local session
      const updatedSession = { ...staffSession, phone, whatsapp, whatsapp_number: whatsapp };
      localStorage.setItem('staffSession', JSON.stringify(updatedSession));
      onSessionUpdate(updatedSession);

      toast({
        title: 'Profile updated',
        description: 'Your profile information has been saved.'
      });
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err.message || 'Failed to update profile',
        variant: 'destructive'
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTestSMS = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid 10-digit phone number first.',
        variant: 'destructive'
      });
      return;
    }

    setTestingSMS(true);
    setSmsTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'test_sms',
          phone: phone.replace(/\D/g, '')
        }
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error);
      }

      if (data?.success) {
        setSmsTestResult('success');
        toast({
          title: 'Test SMS sent!',
          description: 'Check your phone for the test message. It may take a few seconds to arrive.'
        });
      } else {
        throw new Error(data?.error || 'Failed to send test SMS');
      }
    } catch (err: any) {
      setSmsTestResult('error');
      toast({
        title: 'Test SMS failed',
        description: err.message || 'Failed to send test SMS. Please check the phone number and try again.',
        variant: 'destructive'
      });
    } finally {
      setTestingSMS(false);
    }
  };

  const handleSaveNotificationPrefs = async () => {
    setSavingPrefs(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'update_profile',
          staff_id: staffSession.id,
          notification_preferences: notificationPrefs
        }
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error);
      }

      // Update local session
      const updatedSession = { ...staffSession, notification_preferences: notificationPrefs };
      localStorage.setItem('staffSession', JSON.stringify(updatedSession));
      onSessionUpdate(updatedSession);

      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.'
      });
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err.message || 'Failed to save notification preferences',
        variant: 'destructive'
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  // Password validation
  const passwordValidation = validatePasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleChangePassword = async () => {
    // Use validatePasswordStrength to ensure all 5 requirements are met
    if (!passwordValidation.isValid) {
      toast({
        title: 'Password Requirements Not Met',
        description: 'Please ensure your password meets all 5 security requirements.',
        variant: 'destructive'
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both password fields match.',
        variant: 'destructive'
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('staff-login', {
        body: {
          action: 'change_password',
          staff_id: staffSession.id,
          current_password: currentPassword,
          new_password: newPassword
        }
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error);
      }

      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.'
      });

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({
        title: 'Password change failed',
        description: err.message || 'Failed to change password',
        variant: 'destructive'
      });
    } finally {
      setChangingPassword(false);
    }
  };


  const handleLinkInvestor = async () => {
    if (!investorEmail.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter an investor email address.',
        variant: 'destructive'
      });
      return;
    }

    setLinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('staff-login', {
        body: {
          action: 'link_investor_account',
          staff_id: staffSession.id,
          investor_email: investorEmail.trim()
        }
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error);
      }

      // Update local session
      const updatedSession = { ...staffSession, linked_investor_id: data.investor_id };
      localStorage.setItem('staffSession', JSON.stringify(updatedSession));
      onSessionUpdate(updatedSession);

      setLinkedInvestor(data.investor);
      setInvestorEmail('');

      toast({
        title: 'Account linked',
        description: `Successfully linked to investor account: ${data.investor.full_name}`
      });
    } catch (err: any) {
      toast({
        title: 'Linking failed',
        description: err.message || 'Failed to link investor account',
        variant: 'destructive'
      });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkInvestor = async () => {
    setUnlinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('staff-login', {
        body: {
          action: 'unlink_investor_account',
          staff_id: staffSession.id
        }
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error);
      }

      // Update local session
      const updatedSession = { ...staffSession, linked_investor_id: undefined };
      localStorage.setItem('staffSession', JSON.stringify(updatedSession));
      onSessionUpdate(updatedSession);

      setLinkedInvestor(null);

      toast({
        title: 'Account unlinked',
        description: 'Investor account has been unlinked from your staff account.'
      });
    } catch (err: any) {
      toast({
        title: 'Unlinking failed',
        description: err.message || 'Failed to unlink investor account',
        variant: 'destructive'
      });
    } finally {
      setUnlinking(false);
    }
  };

  // Use prop if provided (from StaffDashboard which has the authoritative multi-role check),
  // otherwise fall back to local department check
  const isSuccessManager = isSuccessManagerProp ?? staffSession.department === 'success_managers';
  const isAcquisitionManager = staffSession.department === 'acquisition_managers';
  const showNotificationSettings = isSuccessManager || isAcquisitionManager;
  
  // Whether to show the full Session & Roles card with detailed permissions breakdown
  // Only Success Managers should see the full internal role structure
  const showFullSessionCard = isSuccessManager;


  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" aria-hidden="true" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your contact information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="staff-name">Name</Label>
              <Input 
                id="staff-name"
                value={`${staffSession.first_name || ''} ${staffSession.last_name || ''}`.trim() || 'Not set'}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">Contact admin to change your name</p>
            </div>
            <div>
              <Label htmlFor="staff-email">Email</Label>
              <Input 
                id="staff-email"
                value={staffSession.email}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="staff-phone">Phone Number (for SMS notifications)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <Input 
                    id="staff-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value, setPhone)}
                    placeholder="(555) 123-4567"
                    className={`pl-10 ${smsTestResult === 'success' ? 'border-green-500' : smsTestResult === 'error' ? 'border-red-500' : ''}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestSMS}
                  disabled={testingSMS || !phone || phone.replace(/\D/g, '').length < 10}
                  className={`whitespace-nowrap ${smsTestResult === 'success' ? 'border-green-500 text-green-600' : ''}`}
                >
                  {testingSMS ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : smsTestResult === 'success' ? (
                    <>
                      <Check className="w-4 h-4 mr-1" aria-hidden="true" />
                      Verified
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" aria-hidden="true" />
                      Test SMS
                    </>
                  )}
                </Button>
              </div>
              {smsTestResult === 'success' && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> SMS test successful! Check your phone.
                </p>
              )}
              {smsTestResult === 'error' && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> SMS test failed. Please check the number.
                </p>
              )}
              {!smsTestResult && (
                <p className="text-xs text-gray-500 mt-1">Click "Test SMS" to verify your number works</p>
              )}
            </div>
            <div>
              <Label htmlFor="staff-whatsapp">WhatsApp Number</Label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <Input 
                  id="staff-whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => handlePhoneChange(e.target.value, setWhatsapp)}
                  placeholder="(555) 123-4567"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Optional: For WhatsApp notifications</p>
            </div>
          </div>

          <Button 
            onClick={handleSaveProfile} 
            disabled={savingProfile}
            className="bg-[#1a365d] hover:bg-[#1a365d]/90"
          >
            {savingProfile ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" aria-hidden="true" />
                Save Profile
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* SMS Notification Preferences - Only for Success Managers and Acquisition Managers */}
      {showNotificationSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" aria-hidden="true" />
              SMS Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose which events you want to receive SMS notifications for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200">
              <Bell className="w-4 h-4 text-blue-600" aria-hidden="true" />
              <AlertTitle className="text-blue-800">Stay Updated</AlertTitle>
              <AlertDescription className="text-blue-700">
                Enable SMS notifications to receive instant alerts about important investor activities.
                Make sure your phone number is saved and verified above.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {/* Master SMS Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1a365d] rounded-lg flex items-center justify-center">
                    <Phone className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Enable SMS Notifications</p>
                    <p className="text-sm text-gray-500">Master toggle for all SMS notifications</p>
                  </div>
                </div>
                <Switch
                  checked={notificationPrefs.sms}
                  onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, sms: checked }))}
                />
              </div>

              {notificationPrefs.sms && (
                <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                  {/* New Investor Signup */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <UserPlus className="w-5 h-5 text-green-600" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-gray-900">New Investor Signups</p>
                        <p className="text-sm text-gray-500">When a new investor joins the platform</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.new_investor}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, new_investor: checked }))}
                    />
                  </div>

                  {/* Portfolio Property Added */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Home className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-gray-900">Portfolio Property Added</p>
                        <p className="text-sm text-gray-500">When an investor adds a property (especially AYP acquisitions)</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.portfolio_property}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, portfolio_property: checked }))}
                    />
                  </div>

                  {/* Marketplace Listing */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Store className="w-5 h-5 text-purple-600" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-gray-900">Marketplace Listings</p>
                        <p className="text-sm text-gray-500">When an investor lists a property for sale (pending approval)</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.marketplace_listing}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, marketplace_listing: checked }))}
                    />
                  </div>

                  {/* Acquisition Requests */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-amber-600" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-gray-900">Acquisition Requests</p>
                        <p className="text-sm text-gray-500">When an investor submits an acquisition request</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.acquisition_request}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, acquisition_request: checked }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <Button 
              onClick={handleSaveNotificationPrefs} 
              disabled={savingPrefs}
              className="bg-[#1a365d] hover:bg-[#1a365d]/90"
            >
              {savingPrefs ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  Saving Preferences...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" aria-hidden="true" />
                  Save Notification Preferences
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Linked Investor Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" aria-hidden="true" />
            Linked Investor Account
          </CardTitle>
          <CardDescription>
            Link your staff account to an investor account to easily switch between portals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingLinked ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" aria-hidden="true" />
            </div>
          ) : linkedInvestor ? (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
                <AlertTitle className="text-green-800">Account Linked</AlertTitle>
                <AlertDescription className="text-green-700">
                  Your staff account is linked to an investor account.
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#d4a574] rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {linkedInvestor.full_name?.charAt(0).toUpperCase() || 'I'}
                  </div>
                  <div>
                    <p className="font-semibold text-[#1a365d]">{linkedInvestor.full_name}</p>
                    {linkedInvestor.company_name && (
                      <p className="text-sm text-gray-600">{linkedInvestor.company_name}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    {linkedInvestor.email}
                  </div>
                  {linkedInvestor.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" aria-hidden="true" />
                      {linkedInvestor.phone}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      // Fetch the full investor data from the database
                      const { data } = await supabase.functions.invoke('staff-login', {
                        body: { 
                          action: 'get_linked_investor',
                          staff_id: staffSession.id
                        }
                      });
                      
                      if (data?.investor) {
                        // Store staff session for switching back
                        localStorage.setItem('staffSessionBackup', JSON.stringify(staffSession));
                        // Set investor session with full data
                        localStorage.setItem('investorSession', JSON.stringify({
                          ...data.investor,
                          loginTime: Date.now()
                        }));
                        // Navigate to operator portal
                        window.location.href = '/investor';
                      }
                    } catch (err) {
                      console.error('Failed to switch to operator portal:', err);
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-[#d4a574]/10 to-[#d4a574]/5 border-[#d4a574]/30 hover:bg-[#d4a574]/20"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" aria-hidden="true" />
                  Switch to Operator Portal
                </Button>

                <Button
                  variant="outline"
                  onClick={handleUnlinkInvestor}
                  disabled={unlinking}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {unlinking ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      <Unlink className="w-4 h-4 mr-2" aria-hidden="true" />
                      Unlink
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                <AlertTitle>No Linked Account</AlertTitle>
                <AlertDescription>
                  Link an investor account to easily switch between staff and operator portals.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="investor-email">Investor Email Address</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                    <Input
                      id="investor-email"
                      type="email"
                      value={investorEmail}
                      onChange={(e) => setInvestorEmail(e.target.value)}
                      placeholder="investor@example.com"
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={handleLinkInvestor}
                    disabled={linking || !investorEmail.trim()}
                    className="bg-[#1a365d] hover:bg-[#1a365d]/90"
                  >
                    {linking ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" aria-hidden="true" />
                        Link Account
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Enter the email address of an existing investor account to link it.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" aria-hidden="true" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password for security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              <PasswordStrengthIndicator password={newPassword} showRequirements={true} />
            </div>
            
            <div>
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              {confirmPassword && (
                <p className={`text-sm mt-1 flex items-center gap-1.5 ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                  {passwordsMatch ? (
                    <><Check className="w-4 h-4" /> Passwords match</>
                  ) : (
                    <><X className="w-4 h-4" /> Passwords do not match</>
                  )}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !passwordValidation.isValid || !passwordsMatch}
            className="bg-[#1a365d] hover:bg-[#1a365d]/90"
          >
            {changingPassword ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Changing Password...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" aria-hidden="true" />
                Change Password
              </>
            )}
          </Button>

        </CardContent>
      </Card>

      {/* Platform Info - Read-only card for non-success-managers (AMs, Setup Managers) */}
      {/* Shows department and certification status without exposing internal role structure */}
      {!showFullSessionCard && (
        <Card className="border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              Platform Info
            </CardTitle>
            <CardDescription>
              Your department and certification status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Department</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {staffSession.department?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Status</p>
                  <p className="text-sm font-semibold text-emerald-700 mt-1">Active</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Certifications & Status</p>
                <div className="flex flex-wrap gap-2">
                  {staffSession.yp_certified ? (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                      <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                      YP Certified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500">
                      Not Yet Certified
                    </Badge>
                  )}
                  {staffSession.trainee_status === 'active' && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      Trainee (Active)
                    </Badge>
                  )}
                  {staffSession.trainee_status === 'completed' && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                      Training Completed
                    </Badge>
                  )}
                  {isAcquisitionManager && (
                    <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                      Acquisition Manager
                    </Badge>
                  )}
                  {staffSession.department === 'setup_managers' && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                      Setup Manager
                    </Badge>
                  )}
                </div>
              </div>

              {staffSession.linked_investor_id && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
                    <span>Investor account linked</span>
                    <Badge variant="outline" className="text-xs">Active</Badge>
                  </div>
                </>
              )}
            </div>

            <Alert className="bg-gray-50 border-gray-200">
              <Info className="w-4 h-4 text-gray-500" aria-hidden="true" />
              <AlertDescription className="text-gray-600">
                Your roles and permissions are managed by the Success Team. If you believe your access level needs updating, 
                please contact your team lead or the Success Team directly.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Session & Roles - Full detail card, only visible to Success Managers */}
      {/* Exposes complete internal role structure, permissions list, and session refresh */}
      {showFullSessionCard && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" aria-hidden="true" />
              Session & Roles
            </CardTitle>
            <CardDescription>
              View your current roles and permissions. Refresh to pick up changes made by an admin without logging out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Session Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Department</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {staffSession.department?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Role</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {staffSession.role || staffSession.department?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Staff'}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Active Roles</p>
                <div className="flex flex-wrap gap-2">
                  {(staffSession.roles && staffSession.roles.length > 0) ? (
                    staffSession.roles.map((role) => (
                      <Badge 
                        key={role} 
                        variant="secondary"
                        className={
                          role === 'success_managers' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                          role === 'acquisition_managers' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                          role === 'setup_managers' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          'bg-gray-100 text-gray-800'
                        }
                      >
                        {role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-gray-500">
                      {staffSession.department?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'No roles assigned'}
                    </Badge>
                  )}
                  {staffSession.yp_certified && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                      <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                      YP Certified
                    </Badge>
                  )}
                  {staffSession.trainee_status === 'active' && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      Trainee (Active)
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Permissions</p>
                <div className="flex flex-wrap gap-2">
                  {staffSession.permissions?.includes('all') ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                      Full Access (All Permissions)
                    </Badge>
                  ) : (staffSession.permissions && staffSession.permissions.length > 0) ? (
                    staffSession.permissions.map((perm) => (
                      <Badge key={perm} variant="outline" className="text-gray-700">
                        {perm.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-gray-500">
                      Default permissions
                    </Badge>
                  )}
                </div>
              </div>

              {staffSession.linked_investor_id && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
                    <span>Linked Investor Account: <span className="font-mono text-xs">{staffSession.linked_investor_id}</span></span>
                  </div>
                </>
              )}
            </div>

            {/* Refresh Session Button */}
            <Alert className="bg-amber-50 border-amber-200">
              <Info className="w-4 h-4 text-amber-600" aria-hidden="true" />
              <AlertTitle className="text-amber-800">Role Changes</AlertTitle>
              <AlertDescription className="text-amber-700">
                If an admin has updated your roles or permissions, click "Refresh Session" to apply the changes without logging out. 
                This fetches the latest data from the database.
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-4">
              <Button
                onClick={async () => {
                  if (!staffSession.id) {
                    toast({ title: 'Error', description: 'No staff ID found in session', variant: 'destructive' });
                    return;
                  }
                  
                  setRefreshingSession(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('staff-login', {
                      body: { 
                        action: 'refresh_session',
                        staff_id: staffSession.id
                      }
                    });

                    if (error) {
                      throw new Error(error.message || 'Edge function error');
                    }

                    if (data?.success) {
                      // Build updated session preserving loginTime
                      const currentSession = JSON.parse(localStorage.getItem('staffSession') || '{}');
                      const updatedSession = {
                        ...currentSession,
                        id: data.id,
                        email: data.email,
                        name: data.name,
                        first_name: data.first_name,
                        last_name: data.last_name,
                        phone: data.phone,
                        whatsapp_number: data.whatsapp_number,
                        team: data.team,
                        role: data.role,
                        department: data.department,
                        permissions: data.permissions || [],
                        linked_investor_id: data.linked_investor_id,
                        roles: data.roles || [],
                        yp_certified: data.yp_certified,
                        trainee_status: data.trainee_status,
                        commission_split: data.commission_split,
                        notification_preferences: data.notification_preferences,
                        loginTime: currentSession.loginTime || Date.now()
                      };
                      
                      localStorage.setItem('staffSession', JSON.stringify(updatedSession));
                      onSessionUpdate(updatedSession);
                      
                      // Update local phone/whatsapp state
                      if (data.phone) setPhone(data.phone);
                      if (data.whatsapp_number) setWhatsapp(data.whatsapp_number);
                      if (data.notification_preferences) {
                        setNotificationPrefs({
                          sms: data.notification_preferences.sms !== false,
                          email: data.notification_preferences.email !== false,
                          new_investor: data.notification_preferences.new_investor !== false,
                          portfolio_property: data.notification_preferences.portfolio_property !== false,
                          marketplace_listing: data.notification_preferences.marketplace_listing !== false,
                          acquisition_request: data.notification_preferences.acquisition_request !== false,
                        });
                      }
                      
                      setLastRefreshed(new Date().toLocaleTimeString());
                      
                      // Show what changed
                      const roleChanges: string[] = [];
                      const oldRoles = currentSession.roles || [];
                      const newRoles = data.roles || [];
                      const addedRoles = newRoles.filter((r: string) => !oldRoles.includes(r));
                      const removedRoles = oldRoles.filter((r: string) => !newRoles.includes(r));
                      if (addedRoles.length > 0) roleChanges.push(`Added: ${addedRoles.join(', ')}`);
                      if (removedRoles.length > 0) roleChanges.push(`Removed: ${removedRoles.join(', ')}`);
                      if (currentSession.department !== data.department) roleChanges.push(`Department: ${data.department}`);
                      
                      toast({
                        title: 'Session Refreshed',
                        description: roleChanges.length > 0 
                          ? `Changes detected: ${roleChanges.join('; ')}. Page will update with new permissions.`
                          : 'Session data is up to date. No changes detected.'
                      });
                    } else {
                      throw new Error(data?.error || 'Failed to refresh session');
                    }
                  } catch (err: any) {
                    toast({
                      title: 'Refresh Failed',
                      description: err.message || 'Failed to refresh session from database',
                      variant: 'destructive'
                    });
                  } finally {
                    setRefreshingSession(false);
                  }
                }}
                disabled={refreshingSession}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {refreshingSession ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                    Refresh Session
                  </>
                )}
              </Button>
              
              {lastRefreshed && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Last refreshed at {lastRefreshed}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
