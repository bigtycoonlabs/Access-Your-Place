import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Link2, UserPlus, Search, Check, X, Loader2, 
  ArrowRight, Mail, User, Building, Phone, AlertCircle
} from 'lucide-react';

interface StaffAccountLinkingWizardProps {
  staffId: string;
  staffEmail: string;
  staffName: string;
  staffPhone?: string;
  onLinkComplete: (investorId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 'check' | 'found' | 'not_found' | 'create' | 'success';

interface FoundInvestor {
  id: string;
  email: string;
  full_name: string;
  company_name?: string;
  phone?: string;
  created_at: string;
}

export function StaffAccountLinkingWizard({
  staffId,
  staffEmail,
  staffName,
  staffPhone,
  onLinkComplete,
  open,
  onOpenChange
}: StaffAccountLinkingWizardProps) {
  const [step, setStep] = useState<WizardStep>('check');
  const [loading, setLoading] = useState(false);
  const [foundInvestor, setFoundInvestor] = useState<FoundInvestor | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: staffName,
    email: staffEmail,
    phone: staffPhone || '',
    company_name: ''
  });
  const { toast } = useToast();

  // Reset wizard when opened
  useEffect(() => {
    if (open) {
      setStep('check');
      setFoundInvestor(null);
      setCreateForm({
        full_name: staffName,
        email: staffEmail,
        phone: staffPhone || '',
        company_name: ''
      });
    }
  }, [open, staffName, staffEmail, staffPhone]);

  // Auto-check for matching investor when wizard opens
  useEffect(() => {
    if (open && step === 'check') {
      checkForMatchingInvestor();
    }
  }, [open, step]);

  const checkForMatchingInvestor = async () => {
    setLoading(true);
    try {
      // Check if an investor account exists with the same email
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { 
          action: 'search_investors',
          search_query: staffEmail.toLowerCase()
        }
      });

      if (error) throw error;

      // Look for exact email match
      const exactMatch = data?.investors?.find(
        (inv: any) => inv.email?.toLowerCase() === staffEmail.toLowerCase()
      );

      if (exactMatch) {
        setFoundInvestor(exactMatch);
        setStep('found');
      } else {
        setStep('not_found');
      }
    } catch (err: any) {
      console.error('Error checking for investor:', err);
      setStep('not_found');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExisting = async () => {
    if (!foundInvestor) return;
    
    setLoading(true);
    try {
      // Link the staff account to the investor account
      const { data, error } = await supabase.functions.invoke('staff-login', {
        body: {
          action: 'link_investor_account',
          staff_id: staffId,
          investor_email: foundInvestor.email
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Also update the investor's linked_staff_id
        await supabase.functions.invoke('manage-investor-admin', {
          body: {
            action: 'update_investor',
            investor_id: foundInvestor.id,
            updates: { linked_staff_id: staffId }
          }
        });

        setStep('success');
        toast({
          title: 'Accounts Linked!',
          description: `Your staff account is now linked to your investor account.`
        });
        
        setTimeout(() => {
          onLinkComplete(foundInvestor.id);
          onOpenChange(false);
        }, 2000);
      } else {
        throw new Error(data?.error || 'Failed to link accounts');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to link accounts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  const handleCreateNew = async () => {
    if (!createForm.full_name || !createForm.email) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Create new investor account
      const { data, error } = await supabase.functions.invoke('investor-register', {
        body: {
          email: createForm.email.toLowerCase(),
          full_name: createForm.full_name,
          phone: createForm.phone,
          company_name: createForm.company_name,
          // Auto-verify since this is a staff member
          skip_verification: true,
          linked_staff_id: staffId
        }
      });

      if (error) throw error;

      if (data?.investor?.id) {
        // Link the staff account to the new investor
        await supabase.functions.invoke('staff-login', {
          body: {
            action: 'link_investor_account',
            staff_id: staffId,
            investor_email: createForm.email.toLowerCase()
          }
        });

        setStep('success');
        toast({
          title: 'Account Created & Linked!',
          description: 'Your new investor account has been created and linked to your staff account.'
        });

        setTimeout(() => {
          onLinkComplete(data.investor.id);
          onOpenChange(false);
        }, 2000);
      } else {
        throw new Error(data?.error || 'Failed to create investor account');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create investor account',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#d4a574]" />
              Link Investor Account
            </DialogTitle>
            <DialogDescription>
              Connect your staff account to an investor account for seamless switching.
            </DialogDescription>
          </DialogHeader>

          {/* Step: Checking */}
          {step === 'check' && (
            <div className="py-8 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-[#d4a574] animate-spin mb-4" />
              <p className="text-gray-600">
                Checking for existing investor account...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Looking for: {staffEmail}
              </p>
            </div>
          )}

          {/* Step: Found Existing Account */}
          {step === 'found' && foundInvestor && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">
                      Existing Account Found!
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      We found an investor account matching your email.
                    </p>
                  </div>
                </div>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{foundInvestor.full_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{foundInvestor.email}</span>
                    </div>
                    {foundInvestor.company_name && (
                      <div className="flex items-center gap-3">
                        <Building className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{foundInvestor.company_name}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t">
                      <Badge variant="secondary" className="text-xs">
                        Created {new Date(foundInvestor.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('not_found')}
                >
                  Use Different Account
                </Button>
                <Button
                  onClick={() => setConfirmDialogOpen(true)}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Link This Account
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step: Not Found */}
          {step === 'not_found' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-800">
                      No Matching Account Found
                    </p>
                    <p className="text-sm text-amber-600 mt-1">
                      No investor account exists with your email address.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Would you like to create a new investor account? This will allow you to:
              </p>
              
              <ul className="text-sm text-gray-600 space-y-2 ml-4">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Access the investor portal
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Save and track deals
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Switch between staff and investor views
                </li>
              </ul>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('create')}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create New Account
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step: Create New Account */}
          {step === 'create' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Create a new investor account with your staff information:
              </p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={createForm.full_name}
                    onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <Label htmlFor="company_name">Company Name (Optional)</Label>
                  <Input
                    id="company_name"
                    value={createForm.company_name}
                    onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })}
                    placeholder="Your company"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('not_found')}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreateNew}
                  disabled={loading}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  Create & Link Account
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Accounts Linked Successfully!
              </h3>
              <p className="text-gray-600">
                You can now switch between your staff and investor accounts seamlessly.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Account Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to link your staff account to the investor account for{' '}
              <strong>{foundInvestor?.full_name}</strong> ({foundInvestor?.email})?
              <br /><br />
              This will allow you to switch between both accounts from either dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLinkExisting}
              disabled={loading}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
