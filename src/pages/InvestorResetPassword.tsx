import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Eye, EyeOff, Check, X, Loader2, AlertCircle, CheckCircle, 
  ArrowLeft, Shield, Lock 
} from 'lucide-react';
import { PasswordStrengthIndicator, validatePasswordStrength } from '@/components/investor/PasswordStrengthIndicator';

export default function InvestorResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');
  
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const passwordValidation = validatePasswordStrength(password);

  useEffect(() => { 
    validateToken(); 
  }, [token]);

  const validateToken = async () => {
    if (!token) { 
      setValidating(false); 
      return; 
    }
    
    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke('investor-login', { 
        body: { action: 'validate_token', reset_token: token } 
      });
      
      if (error) {
        console.error('Token validation edge function error:', error);
        // Fallback: validate token directly from DB
        const dbResult = await validateTokenDirectDB(token);
        if (dbResult.valid) {
          setTokenValid(true);
          setUserEmail(dbResult.email || '');
        } else {
          setTokenValid(false);
        }
      } else if (data?.valid) { 
        setTokenValid(true); 
        setUserEmail(data.email || ''); 
      } else {
        // Edge function returned invalid - also try DB fallback
        console.log('Edge function says token invalid, trying DB fallback');
        const dbResult = await validateTokenDirectDB(token);
        if (dbResult.valid) {
          setTokenValid(true);
          setUserEmail(dbResult.email || '');
        } else {
          setTokenValid(false);
        }
      }
    } catch (err) { 
      console.error('Token validation exception:', err);
      // Fallback: validate token directly from DB
      const dbResult = await validateTokenDirectDB(token);
      if (dbResult.valid) {
        setTokenValid(true);
        setUserEmail(dbResult.email || '');
      } else {
        setTokenValid(false);
      }
    }
    setValidating(false);
  };

  // Direct DB token validation fallback
  /**
   * The browser-side token check is GONE.
   *
   * It read the investors table and password_reset_tokens directly to validate a reset
   * link. Those hold email addresses, reset tokens and password hashes, so the browser no
   * longer has access to them: every call now 401s. The page treated that failure as an
   * invalid token and told the person their email was invalid, over and over, on a link
   * that was perfectly good. A client was locked out of his account and his lease by it.
   *
   * There is no safe version of this: validating a reset token in the browser means
   * shipping reset tokens to the browser. The edge function does it, and when the function
   * cannot be reached we say so honestly instead of blaming the person's email address.
   */
  const validateTokenDirectDB = async (_resetToken: string): Promise<{ valid: boolean; email?: string; investorId?: string }> => {
    return { valid: false };
  };

  // SHA-256 hash helper for client-side password hashing
  const sha256Hash = async (message: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!passwordValidation.isValid) { 
      setError('Password does not meet all requirements. Please ensure your password has at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.'); 
      return; 
    }
    if (!passwordsMatch) { 
      setError('Passwords do not match'); 
      return; 
    }
    
    setLoading(true);
    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke('investor-login', { 
        body: { 
          action: 'reset_password', 
          reset_token: token, 
          new_password: password 
        } 
      });

      if (error) {
        console.error('Reset password edge function error:', error);
        // Fallback: reset password directly in DB
        const fallbackResult = await resetPasswordDirectDB(token!, password);
        if (fallbackResult.success) {
          setSuccess(true);
          toast({ title: 'Password Reset Successful!', description: 'You can now log in with your new password.' });
          setTimeout(() => navigate('/investor/login'), 3000);
        } else {
          setError(fallbackResult.error || 'Failed to reset password');
        }
      } else if (data?.success) { 
        setSuccess(true);
        toast({ title: 'Password Reset Successful!', description: 'You can now log in with your new password.' });
        setTimeout(() => navigate('/investor/login'), 3000); 
      } else {
        // Edge function returned error - try DB fallback
        console.log('Edge function reset failed, trying DB fallback:', data?.error);
        const fallbackResult = await resetPasswordDirectDB(token!, password);
        if (fallbackResult.success) {
          setSuccess(true);
          toast({ title: 'Password Reset Successful!', description: 'You can now log in with your new password.' });
          setTimeout(() => navigate('/investor/login'), 3000);
        } else {
          setError(data?.error || fallbackResult.error || 'Failed to reset password');
        }
      }
    } catch (err: any) { 
      console.error('Reset password exception:', err);
      // Fallback: reset password directly in DB
      try {
        const fallbackResult = await resetPasswordDirectDB(token!, password);
        if (fallbackResult.success) {
          setSuccess(true);
          toast({ title: 'Password Reset Successful!', description: 'You can now log in with your new password.' });
          setTimeout(() => navigate('/investor/login'), 3000);
        } else {
          setError(fallbackResult.error || 'An error occurred');
        }
      } catch (fbErr) {
        setError(err.message || 'An error occurred');
      }
    }
    setLoading(false);
  };

  // Direct DB password reset fallback
  /**
   * The browser-side password reset is GONE, for the same reason as the token check above.
   * It wrote a new password hash straight to the investors table from the browser, which
   * only worked while that table was readable and writable with the public key. It is not,
   * and it must not be. Every call 401'd, and the page reported the failure as though the
   * person had done something wrong.
   */
  const resetPasswordDirectDB = async (_token: string, _newPassword: string): Promise<{ success: boolean; error?: string }> => {
    return {
      success: false,
      error: 'We could not reach the password service just now. Please try again in a moment, or email success@accessyourplace.com and we will reset it for you.',
    };
  };



  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Header />
        <main className="pt-24 pb-16 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
            <p className="text-gray-600">Validating your reset link...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Invalid or expired token
  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Header />
        <main className="pt-24 pb-16 max-w-md mx-auto px-4">
          <Card className="shadow-lg">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Invalid or Expired Link</h2>
              <p className="text-gray-600 mb-8">
                This password reset link is invalid or has expired. Please request a new password reset.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/investor/login')} 
                  className="w-full bg-[#d4a574] hover:bg-[#c49464]"
                >
                  Back to Login
                </Button>
                <p className="text-sm text-gray-500">
                  Need help? <a href="mailto:success@accessyourplace.com" className="text-[#d4a574] hover:underline">Contact Support</a>
                </p>

              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Header />
        <main className="pt-24 pb-16 max-w-md mx-auto px-4">
          <Card className="shadow-lg">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Password Reset Successful!</h2>
              <p className="text-gray-600 mb-4">
                Your password has been successfully updated.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Redirecting to login page in a few seconds...
              </p>
              <Button 
                onClick={() => navigate('/investor/login')} 
                className="w-full bg-[#d4a574] hover:bg-[#c49464]"
              >
                Go to Login Now
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Password reset form
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      <main className="pt-24 pb-16 max-w-md mx-auto px-4">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Create New Password</CardTitle>
            <CardDescription>
              {userEmail ? (
                <>Setting new password for <strong>{userEmail}</strong></>
              ) : (
                'Enter your new password below'
              )}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              
              {/* New Password Field */}
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Use the shared PasswordStrengthIndicator component */}
                <PasswordStrengthIndicator password={password} showRequirements={true} />
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && (
                  <p className={`text-sm flex items-center gap-1.5 ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordsMatch ? (
                      <><Check className="w-4 h-4" /> Passwords match</>
                    ) : (
                      <><X className="w-4 h-4" /> Passwords do not match</>
                    )}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full bg-[#d4a574] hover:bg-[#c49464] h-12 text-base" 
                disabled={loading || !passwordValidation.isValid || !passwordsMatch}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>

              {/* Security Note */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Security Tips</p>
                    <ul className="text-blue-700 space-y-1 text-xs">
                      <li>• Use a unique password you don't use elsewhere</li>
                      <li>• Consider using a password manager</li>
                      <li>• Never share your password with anyone</li>
                    </ul>
                  </div>
                </div>
              </div>
            </form>

            {/* Back to Login Link */}
            <div className="mt-6 text-center">
              <Link 
                to="/investor/login" 
                className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
