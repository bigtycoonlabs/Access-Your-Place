
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Wallet, Plus, Pencil, Trash2, Star, CreditCard, Building2,
  Smartphone, Loader2, Shield
} from 'lucide-react';

interface PaymentProfile {
  id: string;
  staff_id: string;
  method_type: string;
  is_primary: boolean;
  account_details: Record<string, string>;
  label: string | null;
  created_at: string;
}

interface PaymentProfileManagerProps {
  staffId: string;
}

const METHOD_TYPES = [
  { value: 'direct_deposit', label: 'Direct Deposit', icon: Building2, fields: [
    { key: 'routing_number', label: 'Routing Number', type: 'text', placeholder: '9 digits' },
    { key: 'account_number', label: 'Account Number', type: 'password', placeholder: 'Account number' },
    { key: 'account_type', label: 'Account Type', type: 'select', options: ['Checking', 'Savings'] },
    { key: 'bank_name', label: 'Bank Name', type: 'text', placeholder: 'e.g., Chase, Wells Fargo' },
  ]},
  { value: 'wire_transfer', label: 'Wire Transfer', icon: Building2, fields: [
    { key: 'bank_name', label: 'Bank Name', type: 'text', placeholder: 'Bank name' },
    { key: 'routing_number', label: 'ABA/Routing Number', type: 'text', placeholder: 'Routing number' },
    { key: 'account_number', label: 'Account Number', type: 'password', placeholder: 'Account number' },
    { key: 'swift_code', label: 'SWIFT Code (if international)', type: 'text', placeholder: 'Optional' },
  ]},
  { value: 'zelle', label: 'Zelle', icon: Smartphone, fields: [
    { key: 'email_or_phone', label: 'Email or Phone', type: 'text', placeholder: 'Registered email or phone' },
    { key: 'registered_name', label: 'Registered Name', type: 'text', placeholder: 'Name on Zelle account' },
  ]},
  { value: 'apple_pay', label: 'Apple Pay', icon: Smartphone, fields: [
    { key: 'phone_number', label: 'Phone Number', type: 'text', placeholder: 'Apple Pay phone number' },
  ]},
  { value: 'venmo', label: 'Venmo', icon: CreditCard, fields: [
    { key: 'handle', label: 'Venmo Handle', type: 'text', placeholder: '@username' },
  ]},
  { value: 'cash_app', label: 'Cash App', icon: CreditCard, fields: [
    { key: 'cashtag', label: 'Cashtag', type: 'text', placeholder: '$cashtag' },
  ]},
];

export function PaymentProfileManager({ staffId }: PaymentProfileManagerProps) {
  const [profiles, setProfiles] = useState<PaymentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PaymentProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('direct_deposit');
  const [formDetails, setFormDetails] = useState<Record<string, string>>({});
  const [formLabel, setFormLabel] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const { toast } = useToast();

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'get_payment_profiles', staff_id: staffId }
    });
    if (data?.profiles) setProfiles(data.profiles);
    setLoading(false);
  }, [staffId]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const openAddForm = () => {
    setEditingProfile(null);
    setSelectedMethod('direct_deposit');
    setFormDetails({});
    setFormLabel('');
    setIsPrimary(profiles.length === 0);
    setShowForm(true);
  };

  const openEditForm = (profile: PaymentProfile) => {
    setEditingProfile(profile);
    setSelectedMethod(profile.method_type);
    setFormDetails(profile.account_details || {});
    setFormLabel(profile.label || '');
    setIsPrimary(profile.is_primary);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    const { error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: {
        action: 'save_payment_profile',
        staff_id: staffId,
        method_type: selectedMethod,
        account_details: formDetails,
        label: formLabel,
        is_primary: isPrimary,
        profile_id: editingProfile?.id
      }
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingProfile ? 'Profile Updated' : 'Profile Added' });
      setShowForm(false);
      loadProfiles();
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'delete_payment_profile', profile_id: deleteTarget.id }
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Payment Method Removed' });
      setDeleteTarget(null);
      loadProfiles();
    }
  };

  const methodConfig = METHOD_TYPES.find(m => m.value === selectedMethod);
  const maskValue = (val: string) => val ? val.slice(0, -4).replace(/./g, '*') + val.slice(-4) : '';

  return (
    <div className="space-y-6">
      {/* Security Notice */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 text-sm">Payment Security</p>
              <p className="text-xs text-blue-700">Your banking information is stored securely. Account numbers are masked for your protection. Only you and authorized administrators can view payment details.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-900">Payout Methods</h3>
          <p className="text-sm text-gray-500">Manage how you receive commission payments</p>
        </div>
        <Button onClick={openAddForm} className="bg-[#1a365d]">
          <Plus className="w-4 h-4 mr-2" /> Add Method
        </Button>
      </div>

      {/* Profiles List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : profiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No payment methods added</p>
            <p className="text-sm text-gray-400 mt-1">Add a payout method to receive commissions</p>
            <Button onClick={openAddForm} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" /> Add Your First Method
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {profiles.map(profile => {
            const config = METHOD_TYPES.find(m => m.value === profile.method_type);
            const Icon = config?.icon || CreditCard;
            return (
              <Card key={profile.id} className={profile.is_primary ? 'border-amber-300 bg-amber-50/30' : ''}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profile.is_primary ? 'bg-amber-100' : 'bg-gray-100'}`}>
                        <Icon className={`w-5 h-5 ${profile.is_primary ? 'text-amber-600' : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{config?.label || profile.method_type}</p>
                          {profile.is_primary && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                              <Star className="w-3 h-3 mr-1" /> Primary
                            </Badge>
                          )}
                        </div>
                        {profile.label && <p className="text-sm text-gray-500">{profile.label}</p>}
                        <div className="mt-1 text-xs text-gray-400 space-y-0.5">
                          {Object.entries(profile.account_details || {}).map(([key, val]) => (
                            <p key={key}>
                              <span className="capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                              {key.includes('number') || key.includes('routing') ? maskValue(val) : val}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditForm(profile)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(profile)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg" aria-describedby="payment-form-desc">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Edit' : 'Add'} Payment Method</DialogTitle>
            <DialogDescription id="payment-form-desc">Configure your payout preferences</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Method Type</Label>
              <Select value={selectedMethod} onValueChange={(v) => { setSelectedMethod(v); setFormDetails({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHOD_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label (Optional)</Label>
              <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="e.g., Personal Checking, Business Account" />
            </div>
            {methodConfig?.fields.map(field => (
              <div key={field.key}>
                <Label>{field.label}</Label>
                {field.type === 'select' ? (
                  <Select value={formDetails[field.key] || ''} onValueChange={(v) => setFormDetails({ ...formDetails, [field.key]: v })}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {field.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={formDetails[field.key] || ''}
                    onChange={(e) => setFormDetails({ ...formDetails, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Set as Primary</p>
                <p className="text-xs text-gray-500">Default method for all payouts</p>
              </div>
              <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-[#1a365d]">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProfile ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this payment method? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
