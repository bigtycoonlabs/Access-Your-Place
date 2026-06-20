import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link2, Unlink, CheckCircle, AlertCircle } from 'lucide-react';

interface LinkedAccount {
  id: string;
  provider: string;
  provider_email: string;
  provider_name: string;
  provider_avatar_url: string | null;
  linked_at: string;
  last_used_at: string | null;
}

interface LinkedAccountsSectionProps {
  investorId: string;
  hasPassword: boolean;
}

// Google Icon SVG
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// Apple Icon SVG
const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

export function LinkedAccountsSection({ investorId, hasPassword }: LinkedAccountsSectionProps) {
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<LinkedAccount | null>(null);
  const [providers, setProviders] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false });
  const { toast } = useToast();

  useEffect(() => {
    loadLinkedAccounts();
    checkOAuthConfig();
  }, [investorId]);

  const checkOAuthConfig = async () => {
    try {
      const { data } = await supabase.functions.invoke('investor-oauth', {
        body: { action: 'check_oauth_config' }
      });
      if (data?.success) {
        setProviders(data.providers);
      }
    } catch (err) {
      console.error('Failed to check OAuth config:', err);
    }
  };

  const loadLinkedAccounts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('investor-oauth', {
        body: { action: 'get_linked_accounts', investor_id: investorId }
      });

      if (error) throw error;
      if (data?.success) {
        setLinkedAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load linked accounts:', err);
    }
    setLoading(false);
  };

  const handleLinkAccount = async (provider: 'google' | 'apple') => {
    setLinking(provider);

    try {
      const redirectUri = `${window.location.origin}/oauth/callback/investor`;
      
      const { data, error } = await supabase.functions.invoke('investor-oauth', {
        body: {
          action: 'initiate_oauth',
          provider,
          redirect_uri: redirectUri,
          investor_id: investorId,
          oauth_action: 'link'
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      toast({
        title: 'Link Failed',
        description: err.message || `Failed to link ${provider} account`,
        variant: 'destructive'
      });
      setLinking(null);
    }
  };

  const handleUnlinkAccount = async () => {
    if (!confirmUnlink) return;

    setUnlinking(confirmUnlink.provider);

    try {
      const { data, error } = await supabase.functions.invoke('investor-oauth', {
        body: {
          action: 'unlink_account',
          investor_id: investorId,
          provider: confirmUnlink.provider
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Account Unlinked',
        description: data.message || `${confirmUnlink.provider} account has been unlinked`
      });

      // Refresh linked accounts
      await loadLinkedAccounts();
    } catch (err: any) {
      toast({
        title: 'Unlink Failed',
        description: err.message || 'Failed to unlink account',
        variant: 'destructive'
      });
    }

    setUnlinking(null);
    setConfirmUnlink(null);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return <GoogleIcon className="w-6 h-6" />;
      case 'apple':
        return <AppleIcon className="w-6 h-6" />;
      default:
        return <Link2 className="w-6 h-6" />;
    }
  };

  const getProviderName = (provider: string) => {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const isProviderLinked = (provider: string) => {
    return linkedAccounts.some(a => a.provider.toLowerCase() === provider.toLowerCase());
  };

  const canUnlink = () => {
    // Can unlink if user has password OR has more than one linked account
    return hasPassword || linkedAccounts.length > 1;
  };

  // Don't show if no providers are configured
  if (!providers.google && !providers.apple) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Linked Accounts
        </CardTitle>
        <CardDescription>
          Connect your social accounts for faster sign-in
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Google Account */}
            {providers.google && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <GoogleIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Google</span>
                      {isProviderLinked('google') && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    {isProviderLinked('google') && (
                      <p className="text-sm text-gray-500">
                        {linkedAccounts.find(a => a.provider === 'google')?.provider_email}
                      </p>
                    )}
                  </div>
                </div>
                {isProviderLinked('google') ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmUnlink(linkedAccounts.find(a => a.provider === 'google')!)}
                    disabled={!canUnlink() || !!unlinking}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {unlinking === 'google' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Unlink className="w-4 h-4 mr-1" />
                        Unlink
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLinkAccount('google')}
                    disabled={!!linking}
                  >
                    {linking === 'google' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-1" />
                        Link
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Apple Account */}
            {providers.apple && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
                    <AppleIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Apple</span>
                      {isProviderLinked('apple') && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    {isProviderLinked('apple') && (
                      <p className="text-sm text-gray-500">
                        {linkedAccounts.find(a => a.provider === 'apple')?.provider_email || 'Private email'}
                      </p>
                    )}
                  </div>
                </div>
                {isProviderLinked('apple') ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmUnlink(linkedAccounts.find(a => a.provider === 'apple')!)}
                    disabled={!canUnlink() || !!unlinking}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {unlinking === 'apple' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Unlink className="w-4 h-4 mr-1" />
                        Unlink
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLinkAccount('apple')}
                    disabled={!!linking}
                  >
                    {linking === 'apple' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-1" />
                        Link
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Warning if can't unlink */}
            {!canUnlink() && linkedAccounts.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  You need to set a password or link another account before you can unlink your only login method.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Confirm Unlink Dialog */}
      <Dialog open={!!confirmUnlink} onOpenChange={() => setConfirmUnlink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlink {confirmUnlink && getProviderName(confirmUnlink.provider)} Account?</DialogTitle>
            <DialogDescription>
              You will no longer be able to sign in using your {confirmUnlink && getProviderName(confirmUnlink.provider)} account
              {confirmUnlink?.provider_email && ` (${confirmUnlink.provider_email})`}.
              You can always link it again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnlink(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleUnlinkAccount}
              disabled={!!unlinking}
            >
              {unlinking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4 mr-2" />
              )}
              Unlink Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
