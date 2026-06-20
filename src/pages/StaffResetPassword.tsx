import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Eye, EyeOff, Check, X, Loader2, AlertCircle, CheckCircle, 
  ArrowLeft, Shield, Lock, Building2, RefreshCw
} from 'lucide-react';
import { PasswordStrengthIndicator, validatePasswordStrength } from '@/components/investor/PasswordStrengthIndicator';

export default function StaffResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');
  
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isNewAccount, setIsNewAccount] = useState(false);
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
      // Try staff-login validate_token action first
      const { data, error } = await supabase.functions.invoke('staff-login', {
        body: { action: 'validate_token', reset_token: token }
      });
      
      if (error) {
        console.error('Token validation error via staff-login:', error);
        
        // Fallback: Try direct database query
        const { data: users, error: dbError } = await supabase
          .from('staff_users')
          .select('id, email, name, first_name, last_name, reset_token_expires')
          .eq('reset_token', token)
          .limit(1);
        
        if (dbError || !users?.length) {
          console.error('Database fallback error:', dbError);
          setTokenValid(false);
        } else {
          const user = users[0];
          if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
            setTokenValid(false);
          } else {
            setTokenValid(true);
            setUserEmail(user.email || '');
            setUserName(user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim());
            setIsNewAccount(false);
          }
        }
      } else if (data?.valid) {
        setTokenValid(true);
        setUserEmail(data.email || '');
        setUserName(data.name || '');
        setIsNewAccount(data.is_new_account || false);
      } else {
        console.log('Token invalid:', data);
        setTokenValid(false);
      }
    } catch (err) {
      console.error('Token validation exception:', err);
      setTokenValid(false);
    }
    setValidating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Use the shared validatePasswordStrength function to ensure all 5 requirements are met
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
      // Try staff-forgot-password first (it has the reset_password action)
      let resetSuccess = false;
      let resetError = null;
      
      const { data: forgotData, error: forgotError } = await supabase.functions.invoke('staff-forgot-password', {
        body: { 
          action: 'reset_password', 
          reset_token: token, 
          new_password: password 
        }
      });
      
      if (forgotError) {
        console.log('staff-forgot-password failed, trying staff-login...');
        
        // Fallback to staff-login reset_password action
        const { data: loginData, error: loginError } = await supabase.functions.invoke('staff-login', {
          body: { 
            action: 'reset_password', 
            reset_token: token, 
            new_password: password 
          }
        });
        
        if (loginError) {
          console.error('Both edge functions failed:', loginError);
          resetError = 'Failed to connect to authentication service. Please try again.';
        } else if (loginData?.success) {
          resetSuccess = true;
        } else {
          resetError = loginData?.error || 'Failed to reset password';
        }
      } else if (forgotData?.success) {
        resetSuccess = true;
      } else {
        resetError = forgotData?.error || 'Failed to reset password';
      }
      
      if (resetSuccess) {
        setSuccess(true);
        toast({ 
          title: isNewAccount ? 'Account Setup Complete!' : 'Password Reset Successful!', 
          description: 'You can now log in with your new password.' 
        });
        setTimeout(() => navigate('/staff/login'), 3000);
      } else {
        setError(resetError || 'Failed to reset password');
      }
    } catch (err: any) {
      console.error('Reset password exception:', err);
      setError(err.message || 'An error occurred');
    }
    setLoading(false);
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-white/80">Validating your link...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired token
  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Invalid or Expired Link</h2>
            <p className="text-gray-600 mb-6">
              This password reset link is invalid or has expired. Password reset links are only valid for 1 hour.
            </p>
            
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/staff/login')} 
                className="w-full bg-slate-800 hover:bg-slate-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Staff Login
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">or</span>
                </div>
              </div>
              
              <Button 
                variant="outline"
                onClick={() => navigate('/staff/login')}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Request New Reset Link
              </Button>
              
              <p className="text-sm text-gray-500 pt-2">
                Need help? <a href="mailto:success@accessyourplace.com" className="text-amber-600 hover:underline">Contact Support</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {isNewAccount ? 'Account Setup Complete!' : 'Password Reset Successful!'}
            </h2>
            <p className="text-gray-600 mb-4">
              {isNewAccount 
                ? 'Your account has been set up successfully. Welcome to the team!'
                : 'Your password has been successfully updated.'}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Redirecting to login page in a few seconds...
            </p>
            <Button 
              onClick={() => navigate('/staff/login')} 
              className="w-full bg-amber-500 hover:bg-amber-600"
            >
              Go to Login Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password reset/setup form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
            {isNewAccount ? (
              <Building2 className="w-8 h-8 text-white" />
            ) : (
              <Lock className="w-8 h-8 text-white" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isNewAccount ? 'Complete Your Account Setup' : 'Reset Your Password'}
          </CardTitle>
          <CardDescription>
            {userName && <span className="block font-medium text-gray-700">Welcome, {userName}!</span>}
            {userEmail ? (
              <span className="text-gray-500">
                {isNewAccount 
                  ? `Create a password for ${userEmail}`
                  : `Enter a new password for ${userEmail}`}
              </span>
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
              <Label htmlFor="new-password">{isNewAccount ? 'Create Password' : 'New Password'}</Label>
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
                  placeholder="Confirm your password"
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
              className="w-full bg-amber-500 hover:bg-amber-600 h-12 text-base" 
              disabled={loading || !passwordValidation.isValid || !passwordsMatch}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {isNewAccount ? 'Setting Up Account...' : 'Resetting Password...'}
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  {isNewAccount ? 'Complete Setup' : 'Reset Password'}
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
              to="/staff/login" 
              className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Staff Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
