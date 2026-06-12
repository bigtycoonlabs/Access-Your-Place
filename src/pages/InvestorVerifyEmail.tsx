import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { CheckCircle, XCircle, Loader2, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function InvestorVerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_verified' | 'expired' | 'timeout'>('loading');
  const [message, setMessage] = useState('');
  const [investorName, setInvestorName] = useState('');
  const [resending, setResending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const verificationAttempted = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    
    // Prevent double verification attempts
    if (verificationAttempted.current) {
      return;
    }
    
    if (token) {
      verificationAttempted.current = true;
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('No verification token provided.');
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    console.log('[VerifyEmail] Starting verification with token:', token.substring(0, 10) + '...');
    
    // Set a timeout - if verification takes more than 15 seconds, show timeout state
    timeoutRef.current = setTimeout(() => {
      console.log('[VerifyEmail] Verification timed out');
      setStatus('timeout');
      setMessage('Verification is taking longer than expected. Please try again.');
    }, 15000);

    try {
      console.log('[VerifyEmail] Calling investor-session function');
      
      const { data, error } = await supabase.functions.invoke('investor-session', {
        body: { action: 'verify_email', token: token }
      });

      // Clear the timeout since we got a response
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      console.log('[VerifyEmail] Response received:', { data, error });

      // Check for network/connection errors first
      if (error) {
        console.error('[VerifyEmail] Network error:', error);
        setStatus('error');
        setMessage(error.message || 'Network error. Please check your connection and try again.');
        return;
      }

      // Check if data is null or undefined
      if (!data) {
        console.error('[VerifyEmail] No data received');
        setStatus('error');
        setMessage('No response from server. Please try again.');
        return;
      }

      // Check for backend error response (success: false with error message)
      if (data.error) {
        console.log('[VerifyEmail] Backend error:', data.error);
        if (data.error.includes('expired')) {
          setStatus('expired');
          setMessage('This verification link has expired.');
        } else {
          setStatus('error');
          setMessage(data.error);
        }
        return;
      }

      // Check for success response
      if (data.success) {
        console.log('[VerifyEmail] Verification successful');
        if (data.already_verified) {
          setStatus('already_verified');
          setMessage('Your email has already been verified.');
        } else {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
          setInvestorName(data.investor?.full_name || '');
          
          // Update local session if exists
          const session = localStorage.getItem('investorSession');
          if (session) {
            try {
              const parsed = JSON.parse(session);
              parsed.email_verified = true;
              localStorage.setItem('investorSession', JSON.stringify(parsed));
            } catch (e) {
              console.error('[VerifyEmail] Error updating local session:', e);
            }
          }
        }
      } else {
        // success: false but no error message
        console.error('[VerifyEmail] Unexpected response format:', data);
        setStatus('error');
        setMessage('Verification failed. Please try again or contact support.');
      }
    } catch (err: any) {
      // Clear the timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      console.error('[VerifyEmail] Exception:', err);
      setStatus('error');
      setMessage(err.message || 'An error occurred during verification.');
    }
  };

  const handleRetry = async () => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }

    setRetrying(true);
    setStatus('loading');
    setMessage('');
    
    // Reset the verification attempted flag to allow retry
    verificationAttempted.current = false;
    
    await verifyEmail(token);
    setRetrying(false);
  };

  const handleResendVerification = async () => {
    // Get investor email from session
    const session = localStorage.getItem('investorSession');
    if (!session) {
      toast({
        title: 'Please log in',
        description: 'You need to be logged in to resend verification email.',
        variant: 'destructive'
      });
      navigate('/investor/login');
      return;
    }

    try {
      const parsed = JSON.parse(session);
      setResending(true);
      
      const { data, error } = await supabase.functions.invoke('investor-session', {
        body: { 
          action: 'resend_verification', 
          email: parsed.email,
          base_url: window.location.origin
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Verification Email Sent',
          description: 'Please check your inbox for the new verification link.'
        });
      } else {
        throw new Error(data?.error || 'Failed to resend verification email');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to resend verification email.',
        variant: 'destructive'
      });
    } finally {
      setResending(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1a365d] to-[#2d5a87] px-8 py-6 text-center">
            <h1 className="text-2xl font-bold text-white">Access Your Place</h1>
            <p className="text-[#d4a574] text-sm mt-1">Email Verification</p>
          </div>

          {/* Content */}
          <div className="p-8 text-center">
            {status === 'loading' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifying Your Email</h2>
                <p className="text-gray-600">Please wait while we verify your email address...</p>
                <p className="text-gray-400 text-sm mt-4">This usually takes just a few seconds.</p>
              </>
            )}

            {status === 'timeout' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Taking Too Long</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="space-y-3">
                  <Button
                    onClick={handleRetry}
                    disabled={retrying}
                    className="w-full bg-gradient-to-r from-[#d4a574] to-[#c49660] text-white hover:opacity-90"
                  >
                    {retrying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/investor/login')}
                    className="w-full"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Verified!</h2>
                <p className="text-gray-600 mb-6">
                  {investorName ? `Welcome, ${investorName}! ` : ''}
                  {message}
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/investor')}
                    className="w-full bg-gradient-to-r from-[#d4a574] to-[#c49660] text-white hover:opacity-90"
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/investor/login')}
                    className="w-full"
                  >
                    Sign In
                  </Button>
                </div>
              </>
            )}

            {status === 'already_verified' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Already Verified</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/investor')}
                    className="w-full bg-gradient-to-r from-[#d4a574] to-[#c49660] text-white hover:opacity-90"
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/investor/login')}
                    className="w-full"
                  >
                    Sign In
                  </Button>
                </div>
              </>
            )}

            {status === 'expired' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Expired</h2>
                <p className="text-gray-600 mb-6">
                  {message} Please request a new verification email.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="w-full bg-gradient-to-r from-[#d4a574] to-[#c49660] text-white hover:opacity-90"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend Verification Email
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/investor/login')}
                    className="w-full"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="space-y-3">
                  <Button
                    onClick={handleRetry}
                    disabled={retrying}
                    className="w-full bg-gradient-to-r from-[#d4a574] to-[#c49660] text-white hover:opacity-90"
                  >
                    {retrying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleResendVerification}
                    disabled={resending}
                    variant="outline"
                    className="w-full"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Request New Verification Email
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => navigate('/investor/login')}
                    variant="ghost"
                    className="w-full"
                  >
                    Go to Login
                  </Button>
                  <p className="text-sm text-gray-500 pt-2">
                    Need help? Contact{' '}
                    <a href="mailto:support@accessyourplace.com" className="text-[#d4a574] hover:underline">
                      support@accessyourplace.com
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Back to home link */}
        <div className="text-center mt-6">
          <Link to="/" className="text-white/70 hover:text-white text-sm inline-flex items-center">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
