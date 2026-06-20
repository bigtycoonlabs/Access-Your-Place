import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Mail, 
  MailX, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Bell, 
  BellOff,
  AlertTriangle,
  ArrowLeft,
  Settings,
  Building2,
  FileText,
  BarChart3,
  CreditCard,
  RefreshCw
} from 'lucide-react';

interface TokenData {
  investor_id: string;
  investor_email: string;
  investor_name: string;
  email_type: string;
  current_preferences: Record<string, any>;
}

const emailTypeLabels: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  deal_alert: { 
    label: 'Deal Alerts', 
    description: 'New deals matching your investment criteria',
    icon: <Building2 className="w-5 h-5" />
  },
  new_deals: { 
    label: 'New Deal Notifications', 
    description: 'All new property listings',
    icon: <Building2 className="w-5 h-5" />
  },
  inquiry_update: { 
    label: 'Inquiry Updates', 
    description: 'Status changes on your property inquiries',
    icon: <FileText className="w-5 h-5" />
  },
  acquisition_milestone: { 
    label: 'Acquisition Milestones', 
    description: 'Progress updates on your acquisitions',
    icon: <CheckCircle className="w-5 h-5" />
  },
  document_update: { 
    label: 'Document Updates', 
    description: 'New documents and signature requests',
    icon: <FileText className="w-5 h-5" />
  },
  payment_confirmation: { 
    label: 'Payment Confirmations', 
    description: 'Receipts and payment notifications',
    icon: <CreditCard className="w-5 h-5" />
  },
  weekly_summary: { 
    label: 'Weekly Summary', 
    description: 'Weekly portfolio performance report',
    icon: <BarChart3 className="w-5 h-5" />
  },
  monthly_report: { 
    label: 'Monthly Reports', 
    description: 'Detailed monthly analytics',
    icon: <BarChart3 className="w-5 h-5" />
  },
  market_report: { 
    label: 'Market Reports', 
    description: 'Market analysis and insights',
    icon: <BarChart3 className="w-5 h-5" />
  },
  platform_update: { 
    label: 'Platform Updates', 
    description: 'New features and announcements',
    icon: <Bell className="w-5 h-5" />
  }
};

export default function InvestorUnsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const requestedType = searchParams.get('type');

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [resubscribed, setResubscribed] = useState(false);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
      setError('No unsubscribe token provided. Please use the link from your email.');
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('investor-email-notifications', {
        body: { action: 'verify_token', token }
      });

      if (error || !data?.success) {
        setError(data?.error || 'Invalid or expired unsubscribe link. Please use a recent email link or log in to manage preferences.');
        return;
      }

      setTokenData(data);
      
      // If type=all was requested, show confirmation
      if (requestedType === 'all') {
        setShowOptions(false);
      } else if (requestedType && requestedType !== 'all') {
        setSelectedTypes([requestedType]);
        setShowOptions(true);
      } else {
        setShowOptions(true);
      }
    } catch (err: any) {
      setError('Failed to verify unsubscribe link. Please try again or log in to manage preferences.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (type: 'all' | 'single' | 'specific') => {
    try {
      setProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('investor-email-notifications', {
        body: { 
          action: 'unsubscribe', 
          token,
          unsubscribe_type: type,
          specific_types: type === 'specific' ? selectedTypes : undefined
        }
      });

      if (error || !data?.success) {
        setError(data?.error || 'Failed to update preferences. Please try again.');
        return;
      }

      setSuccess(data.message);
    } catch (err: any) {
      setError('An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleResubscribe = async () => {
    try {
      setProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('investor-email-notifications', {
        body: { 
          action: 'resubscribe', 
          token,
          email_types: Object.keys(emailTypeLabels)
        }
      });

      if (error || !data?.success) {
        setError(data?.error || 'Failed to resubscribe. Please log in to manage preferences.');
        return;
      }

      setResubscribed(true);
      setSuccess('You have been resubscribed to emails. Welcome back!');
    } catch (err: any) {
      setError('An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const toggleEmailType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-slate-600">Verifying your request...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state (no token or invalid token)
  if (error && !tokenData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-xl">Link Expired or Invalid</CardTitle>
            <CardDescription className="mt-2">{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Unsubscribe links expire after 30 days</p>
                  <p>For security, please use a link from a recent email or log in to your account to manage preferences.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Link to="/investor/login">
                <Button className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Log In to Manage Preferences
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Return to Homepage
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className={`w-16 h-16 ${resubscribed ? 'bg-green-100' : 'bg-blue-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {resubscribed ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <MailX className="w-8 h-8 text-blue-600" />
              )}
            </div>
            <CardTitle className="text-xl">
              {resubscribed ? 'Welcome Back!' : 'Preferences Updated'}
            </CardTitle>
            <CardDescription className="mt-2">{success}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!resubscribed && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600 mb-3">Changed your mind?</p>
                <Button 
                  variant="outline" 
                  onClick={handleResubscribe}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Resubscribe to Emails
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Link to="/investor?tab=email">
                <Button variant="outline" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage All Preferences
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Return to Homepage
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main unsubscribe options
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <div className="flex items-center justify-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-[#1e3a5f]">Access Your Place</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Email Preferences</h1>
          {tokenData?.investor_email && (
            <p className="text-slate-600">
              Managing preferences for <span className="font-medium">{tokenData.investor_email}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Quick Unsubscribe from All */}
        {requestedType === 'all' && !showOptions && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <BellOff className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <CardTitle>Unsubscribe from All Emails</CardTitle>
                  <CardDescription>You will no longer receive any email notifications from us</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> You will still receive essential account-related emails such as password resets and security alerts.
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="destructive"
                  onClick={() => handleUnsubscribe('all')}
                  disabled={processing}
                  className="flex-1"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MailX className="w-4 h-4 mr-2" />
                  )}
                  Unsubscribe from All
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowOptions(true)}
                  disabled={processing}
                >
                  Choose Specific Types
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Specific Email Type Options */}
        {showOptions && (
          <>
            {/* Quick unsubscribe from triggered email type */}
            {requestedType && requestedType !== 'all' && emailTypeLabels[requestedType] && (
              <Card className="mb-6 border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                        {emailTypeLabels[requestedType].icon}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{emailTypeLabels[requestedType].label}</p>
                        <p className="text-sm text-slate-600">{emailTypeLabels[requestedType].description}</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => handleUnsubscribe('single')}
                      disabled={processing}
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <MailX className="w-4 h-4 mr-2" />
                      )}
                      Unsubscribe
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All email types */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Select Email Types to Unsubscribe
                </CardTitle>
                <CardDescription>
                  Choose which types of emails you'd like to stop receiving
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {Object.entries(emailTypeLabels).map(([type, { label, description, icon }]) => (
                    <div 
                      key={type}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedTypes.includes(type) 
                          ? 'border-primary bg-primary/5' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => toggleEmailType(type)}
                    >
                      <Checkbox 
                        id={type}
                        checked={selectedTypes.includes(type)}
                        onCheckedChange={() => toggleEmailType(type)}
                      />
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={type} className="font-medium cursor-pointer">
                          {label}
                        </Label>
                        <p className="text-sm text-slate-500">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  <Button 
                    onClick={() => handleUnsubscribe('specific')}
                    disabled={processing || selectedTypes.length === 0}
                    className="flex-1"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <MailX className="w-4 h-4 mr-2" />
                    )}
                    Unsubscribe from Selected ({selectedTypes.length})
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => handleUnsubscribe('all')}
                    disabled={processing}
                  >
                    <BellOff className="w-4 h-4 mr-2" />
                    Unsubscribe from All
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Additional options */}
            <div className="mt-6 text-center space-y-4">
              <p className="text-sm text-slate-600">
                Want more control over your notifications?
              </p>
              <Link to="/investor?tab=email">
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Open Full Email Settings
                </Button>
              </Link>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-slate-500">
          <p>Access Your Place | 1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126</p>
          <div className="mt-2 space-x-4">
            <Link to="/privacy-policy" className="hover:text-slate-700 underline">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-slate-700 underline">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
