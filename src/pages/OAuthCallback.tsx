import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Home, ArrowRight, LogIn } from 'lucide-react';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authorization...');
  const [platform, setPlatform] = useState<string>('');
  const [callbackType, setCallbackType] = useState<'investor_auth' | 'platform_connection'>('platform_connection');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      
      // For Apple Sign-In (form_post), check for id_token in hash or body
      const hashParams = new URLSearchParams(location.hash.slice(1));
      const idToken = hashParams.get('id_token') || searchParams.get('id_token');

      // Handle OAuth errors
      if (error) {
        setStatus('error');
        setMessage(errorDescription || `Authorization denied: ${error}`);
        return;
      }

      if (!code && !idToken) {
        setStatus('error');
        setMessage('No authorization code received. Please try again.');
        return;
      }

      // Determine callback type based on state format or URL path
      const isInvestorAuth = location.pathname.includes('/investor') || 
        (state && !state.includes('{')) || // Simple state = investor auth
        !!idToken; // Apple Sign-In

      if (isInvestorAuth) {
        await handleInvestorOAuthCallback(code, state, idToken);
      } else {
        await handlePlatformConnectionCallback(code, state);
      }
    };

    handleCallback();
  }, [searchParams, location, navigate]);

  // Handle investor social login (Google/Apple)
  const handleInvestorOAuthCallback = async (code: string | null, state: string | null, idToken: string | null) => {
    setCallbackType('investor_auth');
    
    if (!state) {
      setStatus('error');
      setMessage('Invalid authorization state. Please try again.');
      return;
    }

    try {
      setMessage('Signing you in...');

      const { data, error: callbackError } = await supabase.functions.invoke('investor-oauth', {
        body: {
          action: 'handle_callback',
          code,
          state,
          id_token: idToken
        }
      });

      if (callbackError) {
        throw new Error(callbackError.message);
      }

      if (data?.error) {
        // Handle specific error cases
        if (data.existing_email) {
          setStatus('error');
          setMessage(data.error);
          return;
        }
        throw new Error(data.error);
      }

      if (data?.success) {
        const providerName = data.provider === 'google' ? 'Google' : 'Apple';
        setPlatform(providerName);

        if (data.action === 'linked') {
          // Account linking success
          setStatus('success');
          setMessage(data.message || `${providerName} account linked successfully!`);
          
          setTimeout(() => {
            navigate('/investor?tab=settings');
          }, 2000);
        } else {
          // Login or register success
          // Store session data
          localStorage.setItem('investorSession', JSON.stringify({
            ...data.investor,
            loginTime: Date.now(),
            email_verified: data.email_verified
          }));
          localStorage.setItem('investorSessionToken', data.session.token);

          setStatus('success');
          setMessage(data.action === 'register' 
            ? `Welcome! Your account has been created with ${providerName}.`
            : `Welcome back! Signed in with ${providerName}.`
          );

          setTimeout(() => {
            navigate('/investor');
          }, 2000);
        }
      }
    } catch (err: any) {
      console.error('Investor OAuth error:', err);
      setStatus('error');
      setMessage(err.message || 'Failed to complete sign-in. Please try again.');
    }
  };

  // Handle platform connections (Airbnb, VRBO, etc.)
  const handlePlatformConnectionCallback = async (code: string | null, state: string | null) => {
    setCallbackType('platform_connection');

    // Parse state to get investor_id and platform
    let stateData: { investor_id: string; platform: string } | null = null;
    try {
      if (state) {
        stateData = JSON.parse(atob(state));
        setPlatform(stateData.platform);
      }
    } catch (e) {
      setStatus('error');
      setMessage('Invalid authorization state. Please try connecting again.');
      return;
    }

    if (!stateData) {
      setStatus('error');
      setMessage('Missing authorization state. Please try connecting again.');
      return;
    }

    try {
      setMessage(`Connecting your ${stateData.platform} account...`);

      // Exchange the authorization code for tokens
      const { data, error: exchangeError } = await supabase.functions.invoke('manage-platform-connections', {
        body: {
          action: 'exchange_oauth_code',
          platform: stateData.platform,
          code,
          redirect_uri: `${window.location.origin}/oauth/callback`,
          investor_id: stateData.investor_id,
          state
        }
      });

      if (exchangeError) {
        throw new Error(exchangeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStatus('success');
      setMessage(`Successfully connected your ${stateData.platform} account! Initial data sync has started.`);

      // Redirect to operator portal after a delay
      setTimeout(() => {
        navigate('/investor?tab=portfolio');
      }, 3000);

    } catch (err: any) {
      console.error('OAuth exchange error:', err);
      setStatus('error');
      setMessage(err.message || 'Failed to complete authorization. Please try again.');
    }
  };

  const getPlatformName = (p: string) => {
    const names: Record<string, string> = {
      airbnb: 'Airbnb',
      vrbo: 'VRBO',
      guesty: 'Guesty',
      hostaway: 'Hostaway',
      ownerrez: 'OwnerRez',
      google: 'Google',
      apple: 'Apple'
    };
    return names[p?.toLowerCase()] || p;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
            status === 'processing' ? 'bg-blue-100' :
            status === 'success' ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {status === 'processing' && (
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle className="w-8 h-8 text-green-600" />
            )}
            {status === 'error' && (
              <XCircle className="w-8 h-8 text-red-600" />
            )}
          </div>
          <CardTitle className="text-xl">
            {status === 'processing' && (callbackType === 'investor_auth' ? 'Signing In' : 'Connecting Account')}
            {status === 'success' && (callbackType === 'investor_auth' ? 'Sign In Successful!' : 'Connection Successful!')}
            {status === 'error' && (callbackType === 'investor_auth' ? 'Sign In Failed' : 'Connection Failed')}
          </CardTitle>
          {platform && (
            <CardDescription>
              {getPlatformName(platform)}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant={status === 'error' ? 'destructive' : 'default'}>
            <AlertDescription className="text-center">
              {message}
            </AlertDescription>
          </Alert>

          {status === 'success' && (
            <div className="text-center text-sm text-gray-500">
              Redirecting in a few seconds...
            </div>
          )}

          <div className="flex flex-col gap-2">
            {status === 'error' && (
              <>
                {callbackType === 'investor_auth' ? (
                  <>
                    <Button 
                      onClick={() => navigate('/investor/login')}
                      className="w-full bg-[#d4a574] hover:bg-[#c49464]"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/')}
                      className="w-full"
                    >
                      <Home className="w-4 h-4 mr-2" />
                      Go to Home
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      onClick={() => navigate('/investor?tab=portfolio')}
                      className="w-full bg-[#d4a574] hover:bg-[#c49464]"
                    >
                      Try Again
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/investor')}
                      className="w-full"
                    >
                      <Home className="w-4 h-4 mr-2" />
                      Go to Dashboard
                    </Button>
                  </>
                )}
              </>
            )}

            {status === 'success' && (
              <Button 
                onClick={() => navigate(callbackType === 'investor_auth' ? '/investor' : '/investor?tab=portfolio')}
                className="w-full bg-[#d4a574] hover:bg-[#c49464]"
              >
                {callbackType === 'investor_auth' ? 'Go to Dashboard' : 'Go to Portfolio'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {status === 'processing' && (
              <p className="text-center text-sm text-gray-500">
                Please wait while we securely {callbackType === 'investor_auth' ? 'sign you in' : 'connect your account'}...
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
