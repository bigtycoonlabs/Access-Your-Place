import { useMemo, useState } from 'react';
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
  Loader2, Download, Trash2, Save, User, DollarSign, MapPin, Bell,
  Mail, CreditCard, Shield, Monitor, ShieldAlert, Eye, EyeOff, Lock,
  CheckCircle,
} from 'lucide-react';

type StringMap = Record<string, boolean>;

interface Props {
  investor: any;
  onUpdate: (investor: any) => void;
  onLogout: () => void;
}

const markets = [
  'Austin, TX', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX',
  'Phoenix, AZ', 'Denver, CO', 'Nashville, TN', 'Atlanta, GA',
  'Tampa, FL', 'Orlando, FL', 'Miami, FL', 'Charlotte, NC',
  'Jacksonville, FL', 'Raleigh, NC', 'Columbus, OH', 'Indianapolis, IN',
];

const operationTypes = [
  { id: 'str', label: 'Short-Term Rentals' },
  { id: 'coliving', label: 'Co-Living' },
  { id: 'mtr', label: 'Mid-Term Rentals' },
];

const defaultEmailNotifications: StringMap = {
  document_updates: true,
  deal_alerts: true,
  article_alerts: true,
  acquisition_updates: true,
  marketplace_updates: true,
  marketplace_verification: true,
  marketplace_transaction: true,
};

const defaultSmsNotifications: StringMap = {
  marketplace_updates: true,
  urgent_updates: true,
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      return trimmed.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function asBooleanMap(value: unknown, defaults: StringMap): StringMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaults };
  const result: StringMap = { ...defaults };
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'boolean') result[key] = item;
  }
  return result;
}

function ChangePasswordSection({ investorId, investorEmail }: { investorId: string; investorEmail: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const validation = validatePasswordStrength(newPassword);
  const matches = newPassword === confirmPassword && confirmPassword.length > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    if (!currentPassword) return setError('Current password is required');
    if (!validation.isValid) return setError('New password does not meet requirements');
    if (!matches) return setError('New passwords do not match');
    if (currentPassword === newPassword) return setError('New password must be different from the current password');

    setChanging(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('investor-login', {
        body: {
          action: 'change_password',
          investor_id: investorId,
          email: investorEmail,
          current_password: currentPassword,
          new_password: newPassword,
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Password change failed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      toast({ title: 'Password Changed', description: 'Your password has been updated.' });
    } catch (err: any) {
      setError(err?.message || 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" />Change Password</CardTitle>
        <CardDescription>Update your investor account password.</CardDescription>
      </CardHeader>
      <CardContent>
        {success && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 flex gap-2"><CheckCircle className="w-4 h-4" />Password changed successfully.</div>}
        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4 max-w-md">
          <div>
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input id="current-password" type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              <button type="button" onClick={() => setShowCurrent(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">{showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input id="new-password" type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
              <button type="button" onClick={() => setShowNew(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">{showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
            <PasswordStrengthIndicator password={newPassword} />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={changing || !validation.isValid || !matches} className="bg-[#d4a574] hover:bg-[#c49464]">
            {changing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function AccountSettings({ investor, onUpdate, onLogout }: Props) {
  const { toast } = useToast();
  const initialForm = useMemo(() => ({
    full_name: typeof investor?.full_name === 'string' ? investor.full_name : '',
    phone: typeof investor?.phone === 'string' ? investor.phone : '',
    company_name: typeof investor?.company_name === 'string' ? investor.company_name : '',
    portfolio_count: Number(investor?.portfolio_count) || 0,
    investment_budget_min: investor?.investment_budget_min ?? '',
    investment_budget_max: investor?.investment_budget_max ?? '',
    preferred_markets: asStringArray(investor?.preferred_markets),
    preferred_operation_types: asStringArray(investor?.preferred_operation_types),
    email_notifications: asBooleanMap(investor?.email_notifications, defaultEmailNotifications),
    sms_notifications: asBooleanMap(investor?.notification_preferences?.sms_notifications, defaultSmsNotifications),
  }), [investor]);

  const [activeTab, setActiveTab] = useState('profile');
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleArrayValue = (key: 'preferred_markets' | 'preferred_operation_types', value: string) => {
    setForm(current => {
      const list = asStringArray(current[key]);
      return { ...current, [key]: list.includes(value) ? list.filter(item => item !== value) : [...list, value] };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        preferred_markets: asStringArray(form.preferred_markets),
        preferred_operation_types: asStringArray(form.preferred_operation_types),
        investment_budget_min: Number(form.investment_budget_min) || null,
        investment_budget_max: Number(form.investment_budget_max) || null,
        notification_preferences: {
          ...(investor?.notification_preferences && typeof investor.notification_preferences === 'object' ? investor.notification_preferences : {}),
          sms_notifications: asBooleanMap(form.sms_notifications, defaultSmsNotifications),
        },
      };
      const { data, error } = await supabase.functions.invoke('investor-login', {
        body: { action: 'update_profile', session_token: localStorage.getItem('investorSessionToken'), ...payload },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to save settings');
      const updated = data.investor || { ...investor, ...payload };
      localStorage.setItem('investorSession', JSON.stringify(updated));
      onUpdate(updated);
      toast({ title: 'Settings Saved', description: 'Your account settings have been updated.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-auth', { body: { action: 'export_data', investor_id: investor.id } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Export failed');
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `investor-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Export Failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-auth', { body: { action: 'delete_account', investor_id: investor.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onLogout();
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err?.message || 'Failed to delete account', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const emailOptions = [
    ['document_updates', 'Document Updates'], ['deal_alerts', 'New Deal Alerts'],
    ['article_alerts', 'Article Alerts'], ['acquisition_updates', 'Acquisition Updates'],
    ['marketplace_updates', 'Marketplace Updates'], ['marketplace_verification', 'Verification Notifications'],
    ['marketplace_transaction', 'Transaction Updates'],
  ];

  return (
    <div className="space-y-6" role="main" aria-label="Account Settings">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white shadow h-auto flex-wrap p-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="credits">YP Credits</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Profile Information</CardTitle><CardDescription>Update your personal and investment information.</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div><Label htmlFor="full-name">Full Name</Label><Input id="full-name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label htmlFor="company">Company</Label><Input id="company" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} /></div>
              <div><Label htmlFor="portfolio-count">Properties in Portfolio</Label><Input id="portfolio-count" type="number" min={0} value={form.portfolio_count} onChange={e => setForm({ ...form, portfolio_count: Number(e.target.value) || 0 })} /></div>
              <div><Label htmlFor="budget-min">Minimum Budget</Label><Input id="budget-min" type="number" value={form.investment_budget_min} onChange={e => setForm({ ...form, investment_budget_min: e.target.value })} /></div>
              <div><Label htmlFor="budget-max">Maximum Budget</Label><Input id="budget-max" type="number" value={form.investment_budget_max} onChange={e => setForm({ ...form, investment_budget_max: e.target.value })} /></div>
            </CardContent>
          </Card>
          <Button onClick={save} disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}<Save className="w-4 h-4 mr-2" />Save Changes</Button>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Investment Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div><Label className="mb-3 block">Preferred Markets</Label><div className="flex flex-wrap gap-2">{markets.map(market => <Badge key={market} variant={form.preferred_markets.includes(market) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleArrayValue('preferred_markets', market)}>{market}</Badge>)}</div></div>
              <div><Label className="mb-3 block">Operation Types</Label><div className="flex flex-wrap gap-2">{operationTypes.map(type => <Badge key={type.id} variant={form.preferred_operation_types.includes(type.id) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleArrayValue('preferred_operation_types', type.id)}>{type.label}</Badge>)}</div></div>
              <Button onClick={save} disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" />Email Notifications</CardTitle></CardHeader><CardContent className="space-y-3">{emailOptions.map(([key, label]) => <div key={key} className="flex items-center justify-between py-2 border-b"><Label htmlFor={`email-${key}`}>{label}</Label><Switch id={`email-${key}`} checked={Boolean(form.email_notifications[key])} onCheckedChange={() => setForm(current => ({ ...current, email_notifications: { ...current.email_notifications, [key]: !current.email_notifications[key] } }))} /></div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" />SMS Notifications</CardTitle></CardHeader><CardContent className="space-y-3">{Object.keys(defaultSmsNotifications).map(key => <div key={key} className="flex items-center justify-between py-2 border-b"><Label htmlFor={`sms-${key}`}>{key === 'urgent_updates' ? 'Urgent Notifications' : 'Marketplace Updates'}</Label><Switch id={`sms-${key}`} checked={Boolean(form.sms_notifications[key])} disabled={!form.phone} onCheckedChange={() => setForm(current => ({ ...current, sms_notifications: { ...current.sms_notifications, [key]: !current.sms_notifications[key] } }))} /></div>)}</CardContent></Card>
          <Button onClick={save} disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Notifications</Button>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <ChangePasswordSection investorId={investor.id} investorEmail={investor.email} />
          <LinkedAccountsSection investorId={investor.id} hasPassword={Boolean(investor.password_hash)} />
          <SecurityAlertsSettings investorId={investor.id} securityAlertsEnabled={investor.security_alerts_enabled !== false} onUpdate={enabled => onUpdate({ ...investor, security_alerts_enabled: enabled })} />
        </TabsContent>

        <TabsContent value="sessions"><SessionManager /></TabsContent>
        <TabsContent value="credits"><InvestmentCredits investorId={investor.id} /></TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Export Your Data</CardTitle></CardHeader><CardContent><Button variant="outline" onClick={exportData} disabled={exporting}>{exporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Export Data</Button></CardContent></Card>
          <Card className="border-red-200"><CardHeader><CardTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-5 h-5" />Delete Account</CardTitle><CardDescription>Permanently delete your account and associated data.</CardDescription></CardHeader><CardContent><Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete Account</Button></CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent><DialogHeader><DialogTitle>Delete Account?</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={deleteAccount} disabled={deleting}>{deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Delete Account</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
