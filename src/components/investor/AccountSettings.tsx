import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { InvestmentCredits } from './InvestmentCredits';
import SessionManager from './SessionManager';
import { SecurityAlertsSettings } from './SecurityAlertsSettings';
import { LinkedAccountsSection } from './LinkedAccountsSection';
import { PasswordStrengthIndicator, validatePasswordStrength } from './PasswordStrengthIndicator';
import { 
  Loader2, Download, Trash2, Save, User, DollarSign, 
  MapPin, Bell, Mail, CreditCard, Shield, Settings, Monitor, ShieldAlert, Link2,
  Eye, EyeOff, Lock, CheckCircle
} from 'lucide-react';

// Change Password Component
function ChangePasswordSection({ investorId, investorEmail }: { investorId: string; investorEmail: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changing, setChanging] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const passwordValidation = validatePasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }
    if (!passwordValidation.isValid) {
      setError('New password does not meet requirements');
      return;
    }
    if (!passwordsMatch) {
      setError('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setChanging(true);
    try {
      // Try edge function first
      const { data, error: fnError } = await supabase.functions.invoke('investor-login', {
        body: {
          action: 'change_password',
          investor_id: investorId,
          email: investorEmail,
          current_password: currentPassword,
          new_password: newPassword
        }
      });

      if (fnError) {
        // Fallback: verify current password directly, then update
        const { data: investors } = await supabase
          .from('investors')
          .select('password_hash')
          .eq('id', investorId)
          .limit(1);

        if (!investors || investors.length === 0) {
          setError('Account not found');
          setChanging(false);
          return;
        }

        const stored = investors[0].password_hash;
        let verified = false;

        // Verify current password
        if (stored?.startsWith('v2$')) {
          const parts = stored.split('$');
          if (parts.length === 3) {
            const encoder = new TextEncoder();
            const hashData = encoder.encode(parts[1] + currentPassword);
            const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            verified = computedHash === parts[2];
          }
        } else if (stored && !stored.startsWith('v1$') && !stored.startsWith('$2')) {
          verified = stored === currentPassword;
        }

        if (!verified) {
          setError('Current password is incorrect');
          setChanging(false);
          return;
        }

        // Hash new password
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
        const encoder = new TextEncoder();
        const hashData = encoder.encode(salt + newPassword);
        const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const newHash = `v2$${salt}$${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;

        const { error: updateError } = await supabase
          .from('investors')
          .update({ password_hash: newHash, updated_at: new Date().toISOString() })
          .eq('id', investorId);

        if (updateError) throw updateError;

        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast({ title: 'Password Changed', description: 'Your password has been updated successfully.' });
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.success) {
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast({ title: 'Password Changed', description: 'Your password has been updated successfully.' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setChanging(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" aria-hidden="true" />
          Change Password
        </CardTitle>
        <CardDescription>
          Update your account password. You'll need your current password to make changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Password changed successfully!
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="new-password-change">New Password</Label>
            <div className="relative">
              <Input
                id="new-password-change"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrengthIndicator password={newPassword} />
          </div>
          <div>
            <Label htmlFor="confirm-password-change">Confirm New Password</Label>
            <Input
              id="confirm-password-change"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
            {confirmPassword && (
              <p className={`text-xs mt-1 ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={changing || !currentPassword || !passwordValidation.isValid || !passwordsMatch}
            className="bg-[#d4a574] hover:bg-[#c49464]"
          >
            {changing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}


interface Props {
  investor: any;
  onUpdate: (inv: any) => void;
  onLogout: () => void;
}


const markets = [
  'Austin, TX', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX', 
  'Phoenix, AZ', 'Denver, CO', 'Nashville, TN', 'Atlanta, GA', 
  'Tampa, FL', 'Orlando, FL', 'Miami, FL', 'Charlotte, NC',
  'Jacksonville, FL', 'Raleigh, NC', 'Columbus, OH', 'Indianapolis, IN'
];

const opTypes = [
  { id: 'str', label: 'Short-Term Rentals' }, 
  { id: 'coliving', label: 'Co-Living' }, 
  { id: 'mtr', label: 'Mid-Term Rentals' }
];

export function AccountSettings({ investor, onUpdate, onLogout }: Props) {
  const defaultNotifs = { 
    document_updates: true, 
    deal_alerts: true, 
    article_alerts: true, 
    acquisition_updates: true,
    marketplace_updates: true,
    marketplace_verification: true,
    marketplace_transaction: true
  };

  const defaultSmsNotifs = {
    marketplace_updates: true,
    urgent_updates: true
  };
  
  const [activeTab, setActiveTab] = useState('profile');
  const [form, setForm] = useState({
    full_name: investor.full_name || '', 
    phone: investor.phone || '', 
    company_name: investor.company_name || '',
    portfolio_count: investor.portfolio_count || 0, 
    investment_budget_min: investor.investment_budget_min || '',
    investment_budget_max: investor.investment_budget_max || '',
    preferred_markets: investor.preferred_markets || [], 
    preferred_operation_types: investor.preferred_operation_types || [],
    email_notifications: investor.email_notifications || defaultNotifs,
    sms_notifications: investor.notification_preferences?.sms_notifications || defaultSmsNotifs
  });

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const toggleMarket = (m: string) => {
    setForm(f => ({ 
      ...f, 
      preferred_markets: f.preferred_markets.includes(m) 
        ? f.preferred_markets.filter((x: string) => x !== m) 
        : [...f.preferred_markets, m] 
    }));
  };

  const toggleOp = (o: string) => {
    setForm(f => ({ 
      ...f, 
      preferred_operation_types: f.preferred_operation_types.includes(o) 
        ? f.preferred_operation_types.filter((x: string) => x !== o) 
        : [...f.preferred_operation_types, o] 
    }));
  };

  const toggleNotif = (key: string) => {
    setForm(f => ({ 
      ...f, 
      email_notifications: { ...f.email_notifications, [key]: !f.email_notifications[key] } 
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    
    // Retry logic for network issues (up to 3 attempts)
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[AccountSettings] Attempt ${attempt} to save profile...`);
        
        // Use investor-login for reliability (confirmed working)
        const { data, error } = await supabase.functions.invoke('investor-login', { 
          body: { 
            action: 'update_profile', 
            investor_id: investor.id, 
            ...form, 
            investment_budget_min: Number(form.investment_budget_min) || null, 
            investment_budget_max: Number(form.investment_budget_max) || null 
          } 
        });
        
        if (error) {
          console.error(`[AccountSettings] Attempt ${attempt} error:`, error);
          lastError = error;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        if (data?.success) { 
          toast({ title: 'Settings Saved', description: 'Your profile has been updated successfully.' }); 
          onUpdate(data.investor);
          setSaving(false);
          return;
        } else if (data?.error) {
          console.error(`[AccountSettings] Server error:`, data.error);
          lastError = new Error(data.error);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
      } catch (err: any) {
        console.error(`[AccountSettings] Attempt ${attempt} exception:`, err);
        lastError = err;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }
    
    // All attempts failed
    const errorMessage = lastError?.message || 'Failed to save settings';
    toast({ 
      title: 'Error', 
      description: errorMessage.includes('fetch') || errorMessage.includes('network') 
        ? 'Network error. Please check your connection and try again.' 
        : errorMessage, 
      variant: 'destructive' 
    });
    setSaving(false);
  };


  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await supabase.functions.invoke('investor-auth', { 
        body: { action: 'export_data', investor_id: investor.id } 
      });
      if (data?.success) {
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); 
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `investor-data-${new Date().toISOString().split('T')[0]}.json`; 
        a.click();
        toast({ title: 'Data Exported', description: 'Your data has been downloaded.' });
      }
    } catch (err) {
      toast({ title: 'Export Failed', description: 'Please try again or contact support.', variant: 'destructive' });
    }
    setExporting(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.functions.invoke('investor-auth', { 
        body: { action: 'delete_account', investor_id: investor.id } 
      });
      toast({ title: 'Account Deleted', description: 'Your account has been permanently removed.' }); 
      onLogout();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete account', variant: 'destructive' });
    }
    setDeleting(false); 
    setDeleteOpen(false);
  };

  const notifOptions = [
    { key: 'document_updates', label: 'Document Updates', desc: 'When documents are approved, rejected, or uploaded by staff' },
    { key: 'deal_alerts', label: 'New Deal Alerts', desc: 'When new deals match your preferred markets and operation types' },
    { key: 'article_alerts', label: 'Article Alerts', desc: 'When new articles are published related to your markets' },
    { key: 'acquisition_updates', label: 'Acquisition Updates', desc: 'Status changes and notes on your active acquisitions' },
    { key: 'marketplace_updates', label: 'Marketplace Updates', desc: 'When you receive private deals or listing status changes' },
    { key: 'marketplace_verification', label: 'Verification Notifications', desc: 'When deal verification is requested, completed, or reports are released' },
    { key: 'marketplace_transaction', label: 'Transaction Updates', desc: 'Status changes for deals you are buying or selling through AYP' }
  ];

  const smsNotifOptions = [
    { key: 'marketplace_updates', label: 'Marketplace SMS', desc: 'Receive SMS for new private deals and urgent marketplace updates' },
    { key: 'urgent_updates', label: 'Urgent Notifications', desc: 'SMS for time-sensitive actions like document signatures needed' }
  ];

  const toggleSmsNotif = (key: string) => {
    setForm(f => ({ 
      ...f, 
      sms_notifications: { ...f.sms_notifications, [key]: !f.sms_notifications[key] } 
    }));
  };

  const handleSecurityAlertsUpdate = (enabled: boolean) => {
    onUpdate({ ...investor, security_alerts_enabled: enabled });
  };

  return (
    <div className="space-y-6" role="main" aria-label="Account Settings">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white shadow h-auto flex-wrap p-1" aria-label="Settings categories">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" aria-hidden="true" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <MapPin className="w-4 h-4 mr-2" aria-hidden="true" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" aria-hidden="true" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldAlert className="w-4 h-4 mr-2" aria-hidden="true" />
            Security
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Monitor className="w-4 h-4 mr-2" aria-hidden="true" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="credits">
            <CreditCard className="w-4 h-4 mr-2" aria-hidden="true" />
            YP Credits
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Shield className="w-4 h-4 mr-2" aria-hidden="true" />
            Privacy
          </TabsTrigger>
        </TabsList>




        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" aria-hidden="true" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input 
                    id="full-name"
                    value={form.full_name} 
                    onChange={e => setForm({...form, full_name: e.target.value})}
                    aria-describedby="full-name-desc"
                  />
                  <p id="full-name-desc" className="sr-only">Enter your full legal name</p>
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone"
                    type="tel"
                    value={form.phone} 
                    onChange={e => setForm({...form, phone: e.target.value})}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="company">Company Name (Optional)</Label>
                  <Input 
                    id="company"
                    value={form.company_name} 
                    onChange={e => setForm({...form, company_name: e.target.value})}
                    placeholder="Your company or LLC"
                  />
                </div>
                <div>
                  <Label htmlFor="portfolio-count">Properties in Portfolio</Label>
                  <Input 
                    id="portfolio-count"
                    type="number" 
                    value={form.portfolio_count} 
                    onChange={e => setForm({...form, portfolio_count: Number(e.target.value)})} 
                    min={0}
                    aria-describedby="portfolio-desc"
                  />
                  <p id="portfolio-desc" className="text-xs text-gray-500 mt-1">
                    Total number of investment properties you currently track
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* TycoonLabs Partner Services */}
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-purple-900">
                      <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-600">TL</span>
                      TycoonLabs Partner Services
                    </CardTitle>
                    <CardDescription>
                      Our sister company provides operational infrastructure for your business
                    </CardDescription>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700">Sister Company</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Access Your Place focuses on acquisition and launch. For ongoing operational needs, 
                  our sister company TycoonLabs offers:
                </p>
                <ul className="grid md:grid-cols-2 gap-2 text-sm mb-4">
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    Custom SOP Development
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    Virtual Assistance
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    Staffing & Hiring
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    Training Programs
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    Custom Applications
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    Ongoing Support
                  </li>
                </ul>
                <div className="flex gap-3">
                  <a 
                    href="https://bigggtycoon.net" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                  >
                    Visit TycoonLabs
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <a 
                    href="https://calendly.com/investyourplaces" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-purple-300 text-purple-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors"
                  >
                    Request Introduction
                  </a>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  TycoonLabs is a separate entity. Services are subject to their own terms and agreements.
                </p>
              </CardContent>
            </Card>

            <Card>

              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" aria-hidden="true" />
                  Investment Budget
                </CardTitle>
                <CardDescription>
                  Set your investment range to receive matching deal alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="budget-min">Minimum Budget ($)</Label>
                  <Input 
                    id="budget-min"
                    type="number" 
                    value={form.investment_budget_min} 
                    onChange={e => setForm({...form, investment_budget_min: e.target.value})}
                    placeholder="10000"
                    aria-label="Minimum investment budget in dollars"
                  />
                </div>
                <div>
                  <Label htmlFor="budget-max">Maximum Budget ($)</Label>
                  <Input 
                    id="budget-max"
                    type="number" 
                    value={form.investment_budget_max} 
                    onChange={e => setForm({...form, investment_budget_max: e.target.value})}
                    placeholder="50000"
                    aria-label="Maximum investment budget in dollars"
                  />
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={handleSave} 
              disabled={saving} 
              className="bg-[#d4a574] hover:bg-[#c49464]"
              aria-label="Save profile changes"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-4 h-4 mr-2" aria-hidden="true" />
              )}
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" aria-hidden="true" />
                Investment Preferences
              </CardTitle>
              <CardDescription>
                Select your preferred markets and operation types to receive relevant deal alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block font-semibold" id="markets-label">Preferred Markets</Label>
                <div 
                  className="flex flex-wrap gap-2" 
                  role="group" 
                  aria-labelledby="markets-label"
                >
                  {markets.map(m => (
                    <Badge 
                      key={m} 
                      variant={form.preferred_markets.includes(m) ? 'default' : 'outline'} 
                      className="cursor-pointer hover:bg-[#d4a574]/20 transition-colors"
                      onClick={() => toggleMarket(m)}
                      role="checkbox"
                      aria-checked={form.preferred_markets.includes(m)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && toggleMarket(m)}
                    >
                      {m}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {form.preferred_markets.length} market{form.preferred_markets.length !== 1 ? 's' : ''} selected
                </p>
              </div>
              
              <div>
                <Label className="mb-3 block font-semibold" id="ops-label">Operation Types</Label>
                <div 
                  className="flex flex-wrap gap-2" 
                  role="group" 
                  aria-labelledby="ops-label"
                >
                  {opTypes.map(o => (
                    <Badge 
                      key={o.id} 
                      variant={form.preferred_operation_types.includes(o.id) ? 'default' : 'outline'} 
                      className="cursor-pointer hover:bg-[#d4a574]/20 transition-colors"
                      onClick={() => toggleOp(o.id)}
                      role="checkbox"
                      aria-checked={form.preferred_operation_types.includes(o.id)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && toggleOp(o.id)}
                    >
                      {o.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleSave} 
                disabled={saving} 
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" aria-hidden="true" />
                  Email Notifications
                </CardTitle>
                <CardDescription>
                  Choose which emails you'd like to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notifOptions.map(opt => (
                  <div 
                    key={opt.key} 
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex-1 pr-4">
                      <Label 
                        htmlFor={`notif-${opt.key}`}
                        className="font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <Mail className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
                        {opt.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                    <Switch 
                      id={`notif-${opt.key}`}
                      checked={form.email_notifications[opt.key]} 
                      onCheckedChange={() => toggleNotif(opt.key)}
                      aria-describedby={`notif-${opt.key}-desc`}
                    />
                    <span id={`notif-${opt.key}-desc`} className="sr-only">
                      {form.email_notifications[opt.key] ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" aria-hidden="true" />
                  SMS Notifications
                </CardTitle>
                <CardDescription>
                  Receive text message alerts for urgent updates (requires phone number)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!form.phone && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-amber-700">
                      Add a phone number in your profile to enable SMS notifications.
                    </p>
                  </div>
                )}
                {smsNotifOptions.map(opt => (
                  <div 
                    key={opt.key} 
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex-1 pr-4">
                      <Label 
                        htmlFor={`sms-${opt.key}`}
                        className="font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <Bell className="w-4 h-4 text-[#1a365d]" aria-hidden="true" />
                        {opt.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                    <Switch 
                      id={`sms-${opt.key}`}
                      checked={form.sms_notifications[opt.key]} 
                      onCheckedChange={() => toggleSmsNotif(opt.key)}
                      disabled={!form.phone}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
                
            <Button 
              onClick={handleSave} 
              disabled={saving} 
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              <Save className="w-4 h-4 mr-2" aria-hidden="true" />
              Save Notification Settings
            </Button>
          </div>
        </TabsContent>
        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-6">
            {/* Change Password Section */}
            <ChangePasswordSection investorId={investor.id} investorEmail={investor.email} />
            
            <LinkedAccountsSection 
              investorId={investor.id} 
              hasPassword={!!investor.password_hash}
            />
            <SecurityAlertsSettings 
              investorId={investor.id}
              securityAlertsEnabled={investor.security_alerts_enabled !== false}
              onUpdate={handleSecurityAlertsUpdate}
            />
          </div>
        </TabsContent>



        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <SessionManager />
        </TabsContent>


        {/* YP Credits Tab */}
        <TabsContent value="credits">
          <InvestmentCredits investorId={investor.id} />
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" aria-hidden="true" />
                  Export Your Data
                </CardTitle>
                <CardDescription>
                  Download a copy of all your data including profile, saved deals, and activity history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  onClick={handleExport} 
                  disabled={exporting}
                  aria-label="Export all your data as JSON file"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                  )}
                  Export Data
                </Button>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <Trash2 className="w-5 h-5" aria-hidden="true" />
                  Delete Account
                </CardTitle>
                <CardDescription>
                  Permanently delete your account and all associated data. This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={() => setDeleteOpen(true)}
                  aria-label="Delete your account permanently"
                >
                  <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account?</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data including saved deals, 
              documents, and activity history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={deleting}
              aria-label="Confirm account deletion"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
