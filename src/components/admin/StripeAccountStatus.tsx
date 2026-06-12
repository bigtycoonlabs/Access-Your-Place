import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { 
  CreditCard, CheckCircle, AlertCircle, ExternalLink, 
  Loader2, DollarSign, ArrowRight, Shield, Building2
} from 'lucide-react';

interface StripeAccountStatusProps {
  onSetupClick?: () => void;
}

export function StripeAccountStatus({ onSetupClick }: StripeAccountStatusProps) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<any>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      // In a real implementation, you would call an edge function to get the status
      // For now, we'll show a placeholder based on the known account status
      setStatus({
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        requirements_count: 23
      });
    } catch (error) {
      console.error('Failed to fetch Stripe status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#d4a574] mx-auto" />
          <p className="text-gray-500 mt-2">Loading payment status...</p>
        </CardContent>
      </Card>
    );
  }

  const isFullySetup = status?.charges_enabled && status?.payouts_enabled;
  const setupProgress = status?.details_submitted ? 50 : 0;

  return (
    <Card className={`overflow-hidden ${isFullySetup ? 'border-green-200' : 'border-yellow-200'}`}>
      <CardHeader className={`${isFullySetup ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-yellow-500 to-orange-500'} text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-white">Payment Account Status</CardTitle>
              <CardDescription className="text-white/80">
                Stripe Connect Integration
              </CardDescription>
            </div>
          </div>
          <Badge className={isFullySetup ? 'bg-white text-green-700' : 'bg-white text-yellow-700'}>
            {isFullySetup ? 'Active' : 'Setup Required'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Status Indicators */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border ${status?.charges_enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {status?.charges_enabled ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-gray-400" />
              )}
              <span className="font-medium">Accept Payments</span>
            </div>
            <p className="text-sm text-gray-600">
              {status?.charges_enabled ? 'Ready to accept payments' : 'Complete setup to accept payments'}
            </p>
          </div>

          <div className={`p-4 rounded-lg border ${status?.payouts_enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {status?.payouts_enabled ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-gray-400" />
              )}
              <span className="font-medium">Receive Payouts</span>
            </div>
            <p className="text-sm text-gray-600">
              {status?.payouts_enabled ? 'Payouts enabled' : 'Add bank account for payouts'}
            </p>
          </div>

          <div className={`p-4 rounded-lg border ${status?.details_submitted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {status?.details_submitted ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-gray-400" />
              )}
              <span className="font-medium">Account Verified</span>
            </div>
            <p className="text-sm text-gray-600">
              {status?.details_submitted ? 'Identity verified' : 'Verification pending'}
            </p>
          </div>
        </div>

        {/* Setup Progress */}
        {!isFullySetup && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Complete Your Stripe Account Setup
            </h4>
            <p className="text-sm text-yellow-700 mb-4">
              To start receiving acquisition fee payments from investors, you need to complete your Stripe account setup. This includes:
            </p>
            <ul className="text-sm text-yellow-700 space-y-2 mb-4">
              <li className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Business information (name, address, tax ID)
              </li>
              <li className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Representative verification (identity, SSN)
              </li>
              <li className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Bank account for receiving payouts
              </li>
            </ul>
            <Button 
              className="bg-yellow-600 hover:bg-yellow-700"
              onClick={() => window.open('https://dashboard.stripe.com/account/onboarding', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Complete Setup in Stripe Dashboard
            </Button>
          </div>
        )}

        {/* Balance Display (when active) */}
        {isFullySetup && balance && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600 mb-1">Available Balance</p>
              <p className="text-2xl font-bold text-green-600">
                ${((balance.available?.[0]?.amount || 0) / 100).toFixed(2)}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Pending Balance</p>
              <p className="text-2xl font-bold text-blue-600">
                ${((balance.pending?.[0]?.amount || 0) / 100).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Payment Configuration</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Acquisition Fee</span>
              <span className="font-medium">$499.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Platform Fee</span>
              <span className="font-medium">2%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Currency</span>
              <span className="font-medium">USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Methods</span>
              <span className="font-medium">Card</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
