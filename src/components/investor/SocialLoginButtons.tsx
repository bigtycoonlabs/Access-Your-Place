import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface SocialLoginButtonsProps {
  mode: 'login' | 'register';
  onError?: (error: string) => void;
  disabled?: boolean;
}

// Google Icon SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// Apple Icon SVG
const AppleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

export function SocialLoginButtons({ mode, onError, disabled }: SocialLoginButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false });
  const [checkingConfig, setCheckingConfig] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkOAuthConfig();
  }, []);

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
    setCheckingConfig(false);
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    if (disabled || loadingProvider) return;

    setLoadingProvider(provider);

    try {
      const redirectUri = `${window.location.origin}/oauth/callback/investor`;
      
      const { data, error } = await supabase.functions.invoke('investor-oauth', {
        body: {
          action: 'initiate_oauth',
          provider,
          redirect_uri: redirectUri,
          oauth_action: mode
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.auth_url) {
        // Redirect to OAuth provider
        window.location.href = data.auth_url;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (err: any) {
      console.error(`${provider} OAuth error:`, err);
      const errorMessage = err.message || `Failed to sign in with ${provider}`;
      onError?.(errorMessage);
      toast({
        title: 'Sign In Error',
        description: errorMessage,
        variant: 'destructive'
      });
      setLoadingProvider(null);
    }
  };

  // Don't show anything while checking config
  if (checkingConfig) {
    return null;
  }

  // Don't show if no providers are configured
  if (!providers.google && !providers.apple) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">
            Or continue with
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {providers.google && (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSocialLogin('google')}
            disabled={disabled || !!loadingProvider}
            className="w-full"
          >
            {loadingProvider === 'google' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            <span className="ml-2">Google</span>
          </Button>
        )}

        {providers.apple && (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSocialLogin('apple')}
            disabled={disabled || !!loadingProvider}
            className="w-full"
          >
            {loadingProvider === 'apple' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <AppleIcon />
            )}
            <span className="ml-2">Apple</span>
          </Button>
        )}
      </div>

      {(providers.google || providers.apple) && (
        <p className="text-xs text-center text-gray-500">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      )}
    </div>
  );
}
