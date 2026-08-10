import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SocialLoginButtons } from '@/components/investor/SocialLoginButtons';
import { PasswordStrengthIndicator, validatePasswordStrength } from '@/components/investor/PasswordStrengthIndicator';
import { LoginSupportChat } from '@/components/investor/LoginSupportChat';
import SEO from '@/components/SEO';
import { 
  Loader2, Building2, TrendingUp, Shield, ArrowLeft,
  Mail, Eye, EyeOff, ArrowRight, CheckCircle, Phone, MessageSquare, Gift, AlertTriangle, Clock
} from 'lucide-react';

// ============================================================
// Client-side password hashing utilities (Web Crypto API)
// Uses SHA-256 with random salt, prefixed with "v2$" to distinguish
// from edge function's "v1$" format.
// ============================================================
async function generateSalt(): Promise<string> {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hash(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPasswordClient(password: string): Promise<string> {
  const salt = await generateSalt();
  const hash = await sha256Hash(salt + password);
  return `v2$${salt}$${hash}`;
}

async function verifyPasswordClient(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('v2$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const expectedHash = parts[2];
  const computedHash = await sha256Hash(salt + password);
  return computedHash === expectedHash;
}

// Helper function for direct database login (fallback when edge function unavailable)
async function directInvestorLogin(email: string, password: string): Promise<{
  success: boolean;
  error?: string;
  data?: any;
}> {
  try {
    // Query the investors table directly - use ilike for case-insensitive email matching
    const { data: investors, error: queryError } = await supabase
      .from('investors')
      .select('*')
      .ilike('email', email.toLowerCase().trim())
      .limit(1);

    if (queryError) {
      console.error('[DirectLogin] Database query error:', queryError);
      return { success: false, error: 'Database connection error. Please try again.' };
    }

    if (!investors || investors.length === 0) {
      console.log('[DirectLogin] No investor found with email:', email);
      return { success: false, error: 'Invalid email or password' };
    }

    const investor = investors[0];
    const storedPassword = investor.password_hash || investor.password;

    if (!storedPassword) {
      console.log('[DirectLogin] No password set for investor:', investor.id);
      return { 
        success: false, 
        error: 'Account not set up. Please use the forgot password feature or contact support.' 
      };
    }

    // Check password format and verify
    let passwordValid = false;
    
    // Check if it's a v2$ client-side hash (from our fallback registration)
    if (storedPassword.startsWith('v2$')) {
      try {
        passwordValid = await verifyPasswordClient(password, storedPassword);
      } catch (hashErr) {
        console.error('[DirectLogin] v2$ hash verification error:', hashErr);
        passwordValid = false;
      }
    }
    // Check if it's a v1$ salted hash (from investor-register edge function)
    else if (storedPassword.startsWith('v1$')) {
      // v1$ format: v1$salt$hash - try SHA-256 verification (same as edge function)
      try {
        const parts = storedPassword.split('$');
        if (parts.length === 3) {
          const salt = parts[1];
          const expectedHash = parts[2];
          const computedHash = await sha256Hash(salt + password);
          passwordValid = computedHash === expectedHash;
        }
        if (!passwordValid) {
          // Also try: hash(password + salt) in case edge function uses different order
          const parts2 = storedPassword.split('$');
          if (parts2.length === 3) {
            const salt = parts2[1];
            const expectedHash = parts2[2];
            const computedHash2 = await sha256Hash(password + salt);
            passwordValid = computedHash2 === expectedHash;
          }
        }
      } catch (hashErr) {
        console.error('[DirectLogin] v1$ hash verification error:', hashErr);
      }
      
      if (!passwordValid) {
        console.log('[DirectLogin] v1$ hash verification failed - edge function may use different algorithm');
        return { 
          success: false, 
          error: 'Please try again in a moment. If the problem persists, use "Forgot Password" to reset your password.' 
        };
      }
    }
    // Check if it might be a bcrypt hash (starts with $2)
    else if (storedPassword.startsWith('$2')) {
      console.log('[DirectLogin] Password is bcrypt hashed - cannot verify client-side');
      return { 
        success: false, 
        error: 'Please try again in a moment. If the problem persists, use "Forgot Password" to reset your password.' 
      };
    }
    // Plain text comparison for legacy/fallback passwords
    else {
      passwordValid = storedPassword === password;
      
      // If plain text match succeeds, upgrade to hashed password
      if (passwordValid) {
        try {
          const hashedPassword = await hashPasswordClient(password);
          await supabase
            .from('investors')
            .update({ password_hash: hashedPassword })
            .eq('id', investor.id);
          console.log('[DirectLogin] Upgraded plain text password to v2$ hash for investor:', investor.id);
        } catch (upgradeErr) {
          console.warn('[DirectLogin] Password upgrade failed (non-critical):', upgradeErr);
        }
      }
    }

    if (!passwordValid) {
      console.log('[DirectLogin] Password mismatch for investor:', investor.id);
      return { success: false, error: 'Invalid email or password' };
    }

    console.log('[DirectLogin] Password match successful for:', investor.email);

    // Update last login timestamp
    await supabase
      .from('investors')
      .update({ last_login: new Date().toISOString() })
      .eq('id', investor.id);

    // Generate a simple session token
    const sessionToken = `fallback_${investor.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      success: true,
      data: {
        investor: {
          id: investor.id,
          email: investor.email,
          full_name: investor.full_name || investor.name || email,
          phone: investor.phone,
          company_name: investor.company_name,
          portfolio_count: investor.portfolio_count || 0,
          investment_budget_min: investor.investment_budget_min,
          investment_budget_max: investor.investment_budget_max,
          preferred_markets: investor.preferred_markets || [],
          preferred_operation_types: investor.preferred_operation_types || [],
          referral_code: investor.referral_code,
          onboarding_completed: investor.onboarding_completed,
          sms_opt_in: investor.sms_opt_in,
          email_opt_in: investor.email_opt_in
        },
        session: {
          token: sessionToken
        },
        email_verified: investor.email_verified || false
      }
    };
  } catch (err: any) {
    console.error('[DirectLogin] Exception:', err);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}


// Helper function for direct database registration (fallback when edge function unavailable)
async function directInvestorRegister(data: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  sms_opt_in?: boolean;
  email_opt_in?: boolean;
  referral_code?: string | null;
}): Promise<{
  success: boolean;
  error?: string;
  data?: any;
}> {
  try {
    // Check if email already exists (case-insensitive)
    const { data: existing } = await supabase
      .from('investors')
      .select('id')
      .ilike('email', data.email.toLowerCase().trim())
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
    }

    // Hash the password using client-side hashing (v2$ format)
    let hashedPassword: string;
    try {
      hashedPassword = await hashPasswordClient(data.password);
    } catch (hashErr) {
      console.error('[DirectRegister] Password hashing failed:', hashErr);
      return { success: false, error: 'Failed to secure your password. Please try again.' };
    }

    // Generate referral code for new user
    const newReferralCode = `INV${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Generate email verification token
    const verificationToken = crypto.randomUUID ? crypto.randomUUID() : 
      `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Create new investor with hashed password
    const { data: newInvestor, error: insertError } = await supabase
      .from('investors')
      .insert({
        email: data.email.toLowerCase().trim(),
        password_hash: hashedPassword,
        full_name: data.full_name.trim(),
        phone: data.phone || null,
        sms_opt_in: data.sms_opt_in || false,
        email_opt_in: data.email_opt_in !== false,
        referral_code: newReferralCode,
        referred_by_code: data.referral_code || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email_verified: false,
        onboarding_completed: false,
        email_verification_token: verificationToken,
        email_verification_sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Registration error:', insertError);
      if (insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
        return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
      }
      return { success: false, error: 'Failed to create account. Please try again.' };
    }

    // Generate a simple session token
    const sessionToken = `fallback_${newInvestor.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Try to send verification email via edge function (best effort)
    try {
      await supabase.functions.invoke('investor-auth-v2', {
        body: {
          action: 'resend_verification',
          email: data.email.toLowerCase().trim(),
          base_url: window.location.origin
        }
      });
    } catch (emailErr) {
      console.warn('[DirectRegister] Verification email send failed (non-critical):', emailErr);
    }

    return {
      success: true,
      data: {
        investor: {
          id: newInvestor.id,
          email: newInvestor.email,
          full_name: newInvestor.full_name,
          phone: newInvestor.phone,
          referral_code: newInvestor.referral_code
        },
        session: {
          token: sessionToken
        },
        email_verified: false,
        message: 'Account created successfully! Please check your email to verify your account.'
      }
    };
  } catch (err: any) {
    console.error('Direct registration error:', err);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

// Helper function for direct database password reset (fallback)
async function directForgotPassword(email: string, baseUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Check if investor exists (case-insensitive)
    const { data: investors } = await supabase
      .from('investors')
      .select('id, email, full_name')
      .ilike('email', email.toLowerCase().trim())
      .limit(1);

    // Always return success for security (don't reveal if email exists)
    if (!investors || investors.length === 0) {
      return { success: true };
    }

    const investor = investors[0];

    // Generate a reset token
    const resetToken = crypto.randomUUID ? crypto.randomUUID() : 
      `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Store the reset token with 1-hour expiry
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Try to store in password_reset_tokens table
    try {
      await supabase.from('password_reset_tokens').insert({
        investor_id: investor.id,
        token: resetToken,
        expires_at: expiresAt,
        used: false,
        created_at: new Date().toISOString()
      });
    } catch (tokenErr) {
      // If table doesn't exist, store in investor record directly
      console.warn('[DirectForgotPassword] Token table insert failed, storing on investor record:', tokenErr);
      await supabase
        .from('investors')
        .update({
          reset_token: resetToken,
          reset_token_expires: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', investor.id);
    }

    // Try to send email via edge function
    try {
      await supabase.functions.invoke('send-notification-email', {
        body: {
          to: investor.email,
          subject: 'Reset Your Password - Access Your Place',
          template: 'password_reset',
          data: {
            name: investor.full_name || 'Investor',
            reset_link: `${baseUrl}/investor/reset-password?token=${resetToken}`,
            expires_in: '1 hour'
          }
        }
      });
    } catch (emailErr) {
      console.warn('[DirectForgotPassword] Email send failed:', emailErr);
      // Try alternative email function
      try {
        await supabase.functions.invoke('investor-login', {
          body: {
            action: 'forgot_password',
            email: investor.email,
            reset_method: 'email',
            base_url: baseUrl
          }
        });
      } catch (altErr) {
        console.warn('[DirectForgotPassword] Alternative email also failed:', altErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[DirectForgotPassword] Exception:', err);
    return { success: true }; // Always return success for security
  }
}


// Session timeout message component
function SessionTimeoutMessage({ message, type }: { message: string; type: string }) {
  if (!message) return null;
  
  return (
    <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
      type === 'timeout' 
        ? 'bg-amber-50 border border-amber-200' 
        : 'bg-blue-50 border border-blue-200'
    }`}>
      {type === 'timeout' ? (
        <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      ) : (
        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      )}
      <div>
        <p className={`font-medium ${type === 'timeout' ? 'text-amber-800' : 'text-blue-800'}`}>
          {type === 'timeout' ? 'Session Expired' : 'Logged Out'}
        </p>
        <p className={`text-sm ${type === 'timeout' ? 'text-amber-600' : 'text-blue-600'}`}>
          {message}
        </p>
      </div>
    </div>
  );
}

// Failed login attempts helper message
function FailedAttemptsMessage({ attempts, onResetPassword, onGetHelp }: { 
  attempts: number; 
  onResetPassword: () => void;
  onGetHelp: () => void;
}) {
  if (attempts < 2) return null;
  
  return (
    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-amber-800">Having trouble logging in?</p>
          <p className="text-sm text-amber-600 mt-1">
            {attempts >= 3 
              ? "We've noticed multiple failed attempts. Let us help you get back into your account."
              : "If you've forgotten your password, we can help you reset it."}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onResetPassword}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <Mail className="w-3 h-3 mr-1" />
              Reset Password
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onGetHelp}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Chat with Support
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvestorLogin() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '', rememberMe: false });
  const [registerData, setRegisterData] = useState({ 
    email: '', 
    password: '', 
    confirmPassword: '', 
    full_name: '', 
    phone: '',
    sms_opt_in: false,
    email_opt_in: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('login');
  const [initialized, setInitialized] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [failedLoginAttempts, setFailedLoginAttempts] = useState(0);
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  
  // Session timeout message from redirect
  const location = useLocation();
  const sessionMessage = (location.state as any)?.message || '';
  const sessionMessageType = (location.state as any)?.type || '';
  
  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetMethod, setResetMethod] = useState<'email' | 'sms'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Clear location state after reading it
  useEffect(() => {
    if (sessionMessage) {
      const timer = setTimeout(() => {
        window.history.replaceState({}, document.title);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [sessionMessage]);
  const initializeFromUrl = useCallback(() => {
    const session = localStorage.getItem('investorSession');
    const sessionToken = localStorage.getItem('investorSessionToken');
    
    if (session && sessionToken) {
      validateExistingSession(sessionToken);
      return;
    }
    
    const ref = searchParams.get('ref');
    const tab = searchParams.get('tab');
    
    if (ref) {
      setReferralCode(ref);
    }
    
    if (tab === 'register') {
      setActiveTab('register');
    } else if (tab === 'login') {
      setActiveTab('login');
    } else if (ref) {
      setActiveTab('register');
    }
    
    setInitialized(true);
  }, [searchParams]);

  const validateExistingSession = async (token: string) => {
    const timeoutId = setTimeout(() => {
      setInitialized(true);
    }, 5000);

    try {
      // For fallback tokens, just check if session data exists locally
      if (token.startsWith('fallback_')) {
        clearTimeout(timeoutId);
        const session = localStorage.getItem('investorSession');
        if (session) {
          try {
            const parsed = JSON.parse(session);
            if (parsed.id && parsed.email) {
              navigate('/investor');
              return;
            }
          } catch {}
        }
        localStorage.removeItem('investorSession');
        localStorage.removeItem('investorSessionToken');
        setInitialized(true);
        return;
      }

      const { data, error } = await supabase.functions.invoke('investor-session', {
        body: { action: 'validate_session', session_token: token }
      });

      clearTimeout(timeoutId);

      if (!error && data?.success) {
        navigate('/investor');
        return;
      }
    } catch (e) {
      clearTimeout(timeoutId);
    }
    // Session invalid or expired — silently clear and show login form (no error banner)
    localStorage.removeItem('investorSession');
    localStorage.removeItem('investorSessionToken');
    setInitialized(true);
  };

  useEffect(() => {
    if (!initialized) {
      initializeFromUrl();
    }
  }, [initialized, initializeFromUrl]);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (value: string, isRegister = true) => {
    const formatted = formatPhoneNumber(value);
    if (isRegister) {
      setRegisterData({ ...registerData, phone: formatted });
    } else {
      setForgotPhone(formatted);
    }
  };

  // Login with failed attempt tracking and fallback support
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setErrors({});
    setUsingFallback(false);
    
    // Validate required fields
    if (!loginData.email || !loginData.password) { 
      setErrors({ 
        email: !loginData.email ? 'Email is required' : '', 
        password: !loginData.password ? 'Password is required' : '' 
      }); 
      return; 
    }
    
    setLoading(true);
    
    try {
      const attemptLogin = async (retryCount = 0): Promise<void> => {
        try {
          const { data, error } = await supabase.functions.invoke('investor-login', {
            body: { 
              action: 'login', 
              email: loginData.email.trim().toLowerCase(), 
              password: loginData.password,
              remember_me: loginData.rememberMe
            }
          });
          
          if (error) {
            const isNetworkError = error.message?.includes('Failed to send') || 
                                   error.message?.includes('fetch') || 
                                   error.message?.includes('network') ||
                                   error.message?.includes('Edge Function');
            
            if (isNetworkError && retryCount < 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              return attemptLogin(retryCount + 1);
            }
            
            // Try fallback direct database login
            console.log('Edge function unavailable, using fallback login...');
            setUsingFallback(true);
            
            const fallbackResult = await directInvestorLogin(loginData.email, loginData.password);
            
            if (fallbackResult.success && fallbackResult.data) {
              localStorage.setItem('investorSession', JSON.stringify({ 
                ...fallbackResult.data.investor, 
                loginTime: Date.now(),
                email_verified: fallbackResult.data.email_verified 
              }));
              localStorage.setItem('investorSessionToken', fallbackResult.data.session.token);
              
              if (loginData.rememberMe) {
                localStorage.setItem('investorRememberMe', 'true');
              } else {
                localStorage.removeItem('investorRememberMe');
              }
              
              toast({ title: 'Welcome back!', description: `Logged in as ${fallbackResult.data.investor.full_name}` });
              navigate('/investor');
              return;
            } else {
              setFailedLoginAttempts(prev => prev + 1);
              setErrors({ general: fallbackResult.error || 'Login failed. Please try again.' });
              return;
            }
          }
          
          if (data?.error) {
            setFailedLoginAttempts(prev => prev + 1);
            if (data.retry_after) {
              const minutes = Math.ceil(data.retry_after / 60);
              setErrors({ general: `${data.error} Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
            } else {
              setErrors({ general: data.error });
            }
            toast({ title: 'Login Failed', description: data.error, variant: 'destructive' });
            return;
          }
          
          if (data?.success) {
            setFailedLoginAttempts(0);
            localStorage.setItem('investorSession', JSON.stringify({ 
              ...data.investor, 
              loginTime: Date.now(),
              email_verified: data.email_verified 
            }));
            localStorage.setItem('investorSessionToken', data.session.token);
            
            if (loginData.rememberMe) {
              localStorage.setItem('investorRememberMe', 'true');
            } else {
              localStorage.removeItem('investorRememberMe');
            }
            
            toast({ title: 'Welcome back!', description: `Logged in as ${data.investor.full_name}` });
            navigate('/investor');
            return;
          }
          
          setFailedLoginAttempts(prev => prev + 1);
          setErrors({ general: 'Unexpected response from server. Please try again.' });
          
        } catch (err: any) {
          // Try fallback on any error
          console.log('Login error, trying fallback...');
          setUsingFallback(true);
          
          const fallbackResult = await directInvestorLogin(loginData.email, loginData.password);
          
          if (fallbackResult.success && fallbackResult.data) {
            localStorage.setItem('investorSession', JSON.stringify({ 
              ...fallbackResult.data.investor, 
              loginTime: Date.now(),
              email_verified: fallbackResult.data.email_verified 
            }));
            localStorage.setItem('investorSessionToken', fallbackResult.data.session.token);
            
            toast({ title: 'Welcome back!', description: `Logged in as ${fallbackResult.data.investor.full_name}` });
            navigate('/investor');
            return;
          }
          
          setFailedLoginAttempts(prev => prev + 1);
          setErrors({ general: fallbackResult.error || err?.message || 'An error occurred. Please try again.' });
        }
      };
      
      await attemptLogin();
    } finally {
      // Always reset loading state
      setLoading(false);
    }
  };


  // Registration with fallback support - FIXED: uses finally block to ensure loading state is reset
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setErrors({});
    setUsingFallback(false);
    
    const newErrors: Record<string, string> = {};
    if (!registerData.email) newErrors.email = 'Email is required';
    if (!registerData.full_name) newErrors.full_name = 'Name is required';
    
    if (!registerData.password) {
      newErrors.password = 'Password is required';
    } else {
      const passwordValidation = validatePasswordStrength(registerData.password);
      if (!passwordValidation.isValid) {
        newErrors.password = passwordValidation.errors[0];
      }
    }
    
    if (registerData.password !== registerData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    
    try {
      console.log('[Registration] Starting registration for:', registerData.email);
      
      const { data, error } = await supabase.functions.invoke('investor-register', {
        body: {
          action: 'register',
          email: registerData.email.trim().toLowerCase(),
          password: registerData.password,
          full_name: registerData.full_name.trim(),
          phone: registerData.phone ? registerData.phone.replace(/\D/g, '') : null,
          sms_opt_in: registerData.sms_opt_in,
          email_opt_in: registerData.email_opt_in,
          referral_code: referralCode,
          base_url: window.location.origin
        }
      });
      
      console.log('[Registration] Response:', { data, error });
      
      if (error) {
        const isNetworkError = error.message?.includes('Failed to send') || 
                               error.message?.includes('fetch') || 
                               error.message?.includes('network') ||
                               error.message?.includes('Edge Function');
        
        if (isNetworkError) {
          // Try fallback direct database registration
          console.log('[Registration] Edge function unavailable, using fallback registration...');
          setUsingFallback(true);
          
          const fallbackResult = await directInvestorRegister({
            email: registerData.email.trim().toLowerCase(),
            password: registerData.password,
            full_name: registerData.full_name.trim(),
            phone: registerData.phone ? registerData.phone.replace(/\D/g, '') : undefined,
            sms_opt_in: registerData.sms_opt_in,
            email_opt_in: registerData.email_opt_in,
            referral_code: referralCode
          });
          
          if (fallbackResult.success && fallbackResult.data) {
            localStorage.setItem('investorSession', JSON.stringify({ 
              ...fallbackResult.data.investor, 
              loginTime: Date.now(),
              email_verified: fallbackResult.data.email_verified || false 
            }));
            
            if (fallbackResult.data.session?.token) {
              localStorage.setItem('investorSessionToken', fallbackResult.data.session.token);
            }
            
            setVerificationEmailSent(true);
            toast({ title: 'Account Created!', description: fallbackResult.data.message || 'Welcome to Access Your Place!' });
            
            setTimeout(() => {
              navigate('/investor');
            }, 2000);
            return; // Early return is fine now because finally block will handle setLoading(false)
          } else {
            setErrors({ general: fallbackResult.error || 'Registration failed. Please try again.' });
            toast({ title: 'Registration Failed', description: fallbackResult.error, variant: 'destructive' });
            return;
          }
        }
        
        // Non-network error from edge function
        setErrors({ general: error.message || 'Registration failed. Please try again.' });
        toast({ title: 'Registration Failed', description: error.message, variant: 'destructive' });
        return;
      }
      
      if (data?.error) {
        setErrors({ general: data.error });
        toast({ title: 'Registration Failed', description: data.error, variant: 'destructive' });
        return;
      }

      if (data?.success) {
        console.log('[Registration] Success! Storing session...');
        localStorage.setItem('investorSession', JSON.stringify({ 
          ...data.investor, 
          loginTime: Date.now(),
          email_verified: data.email_verified || false 
        }));
        
        if (data.session?.token) {
          localStorage.setItem('investorSessionToken', data.session.token);
        }
        
        setVerificationEmailSent(true);
        toast({ title: 'Account Created!', description: data.message || 'Welcome to Access Your Place!' });
        
        setTimeout(() => {
          navigate('/investor');
        }, 2000);
        return;
      }
      
      // Unexpected response
      console.error('[Registration] Unexpected response:', data);
      setErrors({ general: 'Unexpected response from server. Please try again.' });
      
    } catch (err: any) {
      console.error('[Registration] Exception:', err);
      
      // Try fallback on any error
      console.log('[Registration] Error occurred, trying fallback...');
      setUsingFallback(true);
      
      try {
        const fallbackResult = await directInvestorRegister({
          email: registerData.email.trim().toLowerCase(),
          password: registerData.password,
          full_name: registerData.full_name.trim(),
          phone: registerData.phone ? registerData.phone.replace(/\D/g, '') : undefined,
          sms_opt_in: registerData.sms_opt_in,
          email_opt_in: registerData.email_opt_in,
          referral_code: referralCode
        });
        
        if (fallbackResult.success && fallbackResult.data) {
          localStorage.setItem('investorSession', JSON.stringify({ 
            ...fallbackResult.data.investor, 
            loginTime: Date.now(),
            email_verified: false 
          }));
          
          if (fallbackResult.data.session?.token) {
            localStorage.setItem('investorSessionToken', fallbackResult.data.session.token);
          }
          
          setVerificationEmailSent(true);
          toast({ title: 'Account Created!', description: 'Welcome to Access Your Place!' });
          
          setTimeout(() => {
            navigate('/investor');
          }, 2000);
          return;
        }
        
        setErrors({ general: fallbackResult.error || err?.message || 'An error occurred. Please try again.' });
      } catch (fallbackErr: any) {
        console.error('[Registration] Fallback also failed:', fallbackErr);
        setErrors({ general: err?.message || 'An error occurred. Please try again.' });
      }
      
      toast({ title: 'Error', description: 'Please try again or contact support', variant: 'destructive' });
    } finally {
      // CRITICAL: Always reset loading state, regardless of success or failure
      setLoading(false);
    }
  };


  const handleForgotPasswordEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast({ title: 'Email Required', description: 'Please enter your email address', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('investor-login', {
        body: { 
          action: 'forgot_password', 
          email: forgotEmail.trim().toLowerCase(),
          reset_method: 'email',
          base_url: window.location.origin
        }
      });
      
      if (error) {
        // Edge function failed - use direct DB fallback to generate reset token
        console.log('[ForgotPassword] Edge function failed, using direct DB fallback:', error.message);
        await directForgotPassword(forgotEmail.trim().toLowerCase(), window.location.origin);
      }
      
      // Always show success for security (don't reveal if email exists)
      setResetSent(true);
      toast({ title: 'Check Your Email', description: 'If an account exists, you will receive a password reset link.' });
    } catch (err: any) {
      // Try direct DB fallback on any error
      console.log('[ForgotPassword] Exception, using direct DB fallback:', err.message);
      try {
        await directForgotPassword(forgotEmail.trim().toLowerCase(), window.location.origin);
      } catch (fallbackErr) {
        console.error('[ForgotPassword] Fallback also failed:', fallbackErr);
      }
      // Still show success for security
      setResetSent(true);
      toast({ title: 'Check Your Email', description: 'If an account exists, you will receive a password reset link.' });
    } finally {
      setLoading(false);
    }
  };


  const handleForgotPasswordSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneDigits = forgotPhone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 10) {
      toast({ title: 'Phone Required', description: 'Please enter a valid 10-digit phone number', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-login', {
        body: { action: 'forgot_password', phone: phoneDigits, reset_method: 'sms' }
      });
      
      if (error) {
        toast({ title: 'Error', description: 'SMS service temporarily unavailable. Please try email reset instead.', variant: 'destructive' });
      } else if (data?.error) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      } else if (data?.success) {
        setOtpStep(true);
        toast({ title: 'Code Sent!', description: 'Check your phone for a 6-digit verification code.' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: 'SMS service temporarily unavailable. Please try email reset instead.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      toast({ title: 'Invalid Code', description: 'Please enter the 6-digit code', variant: 'destructive' });
      return;
    }
    
    setOtpVerifying(true);
    try {
      const phoneDigits = forgotPhone.replace(/\D/g, '');
      const { data, error } = await supabase.functions.invoke('investor-auth-v2', {
        body: { action: 'verify_otp', phone: phoneDigits, otp_code: otpCode }
      });
      
      if (error) {
        toast({ title: 'Error', description: error.message || 'Failed to verify code', variant: 'destructive' });
      } else if (data?.error) {
        toast({ title: 'Invalid Code', description: data.error, variant: 'destructive' });
      } else if (data?.success && data?.reset_token) {
        toast({ title: 'Code Verified!', description: 'Redirecting to password reset...' });
        navigate(`/investor/reset-password?token=${data.reset_token}`);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setOtpVerifying(false);
  };

  const resetForgotPasswordModal = () => {
    setShowForgotModal(false);
    setResetMethod('email');
    setForgotEmail('');
    setForgotPhone('');
    setResetSent(false);
    setOtpStep(false);
    setOtpCode('');
  };

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a365d] via-[#2d5a87] to-[#1a365d] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a365d] via-[#2d5a87] to-[#1a365d]">
      <SEO 
        title="Investor Login - Access Your Place"
        description="Sign in to your Access Your Place investor account. Access exclusive rental arbitrage deals, market reports, and investment tools."
        keywords="investor login, rental arbitrage portal, AYP login, investor account"
        canonicalUrl="/investor-login"
        noIndex={true}
      />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-[#1a365d] px-4 py-2 rounded z-50">
        Skip to main content
      </a>

      <div className="flex min-h-screen">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 text-white">
          <Link to="/" className="inline-flex items-center text-white/80 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mb-8 flex items-center justify-center">
            <span className="text-white font-bold text-2xl">AYP</span>
          </div>
          
          <h1 className="text-4xl font-bold mb-4">Access Your Place</h1>
          <p className="text-xl text-white/80 mb-8">Your complete platform for rental arbitrage investments</p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-lg"><Building2 className="w-6 h-6" /></div>
              <div>
                <h3 className="font-semibold text-lg">Exclusive Deals</h3>
                <p className="text-white/70">Access verified rental arbitrage opportunities</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-lg"><TrendingUp className="w-6 h-6" /></div>
              <div>
                <h3 className="font-semibold text-lg">Market Intelligence</h3>
                <p className="text-white/70">AI-powered market reports and analysis</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-lg"><Shield className="w-6 h-6" /></div>
              <div>
                <h3 className="font-semibold text-lg">Secure Transactions</h3>
                <p className="text-white/70">Protected escrow and verified sellers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8" id="main-content">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center pb-2">
              <div className="lg:hidden w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold text-xl">AYP</span>
              </div>
              <CardTitle className="text-2xl">Investor Portal</CardTitle>
              <CardDescription>Sign in or create your account</CardDescription>
            </CardHeader>
            <CardContent>
              <SessionTimeoutMessage message={sessionMessage} type={sessionMessageType} />
              
              {/* Failed Login Attempts Helper */}
              <FailedAttemptsMessage 
                attempts={failedLoginAttempts}
                onResetPassword={() => setShowForgotModal(true)}
                onGetHelp={() => setShowSupportChat(true)}
              />

              {errors.general && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p>{errors.general}</p>
                      {usingFallback && (
                        <p className="text-xs mt-1 text-red-600">
                          Note: Using backup authentication. Some features may be limited.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {verificationEmailSent && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-start gap-2" role="alert">
                  <Mail className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Verification Email Sent!</p>
                    <p className="text-green-600">Please check your inbox and click the verification link.</p>
                  </div>
                </div>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="register">Create Account</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                      {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember-me"
                          checked={loginData.rememberMe}
                          onCheckedChange={(checked) => setLoginData({ ...loginData, rememberMe: checked as boolean })}
                        />
                        <label htmlFor="remember-me" className="text-sm text-gray-600 cursor-pointer">
                          Remember me for 30 days
                        </label>
                      </div>
                      <button type="button" onClick={() => setShowForgotModal(true)} className="text-sm text-[#d4a574] hover:underline">
                        Forgot password?
                      </button>
                    </div>

                    <Button type="submit" className="w-full bg-[#d4a574] hover:bg-[#c49464]" disabled={loading}>
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Sign In
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                  
                  <div className="mt-4">
                    <SocialLoginButtons mode="login" disabled={loading} onError={(error) => setErrors({ general: error })} />
                  </div>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    {referralCode && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                        <Gift className="w-4 h-4 flex-shrink-0" />
                        <span>Referral code applied: <strong>{referralCode}</strong></span>
                      </div>
                    )}

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-start gap-2">
                      <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>You'll receive a verification email after registration.</span>
                    </div>

                    <div>
                      <Label htmlFor="register-name">Full Name</Label>
                      <Input
                        id="register-name"
                        value={registerData.full_name}
                        onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })}
                        placeholder="John Doe"
                        autoComplete="name"
                      />
                      {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
                    </div>

                    <div>
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                      {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <Label htmlFor="register-phone">Phone (Optional)</Label>
                      <Input
                        id="register-phone"
                        type="tel"
                        value={registerData.phone}
                        onChange={(e) => handlePhoneChange(e.target.value, true)}
                        placeholder="(555) 123-4567"
                        autoComplete="tel"
                      />
                    </div>

                    <div>
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showPassword ? 'text' : 'password'}
                          value={registerData.password}
                          onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                          placeholder="Create a strong password"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                      <PasswordStrengthIndicator password={registerData.password} />
                    </div>

                    <div>
                      <Label htmlFor="register-confirm">Confirm Password</Label>
                      <Input
                        id="register-confirm"
                        type="password"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                      />
                      {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="email-opt-in"
                          checked={registerData.email_opt_in}
                          onCheckedChange={(checked) => setRegisterData({ ...registerData, email_opt_in: checked as boolean })}
                        />
                        <label htmlFor="email-opt-in" className="text-sm text-gray-600 cursor-pointer">
                          Receive deal alerts and market updates via email
                        </label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="sms-opt-in"
                          checked={registerData.sms_opt_in}
                          onCheckedChange={(checked) => setRegisterData({ ...registerData, sms_opt_in: checked as boolean })}
                        />
                        <label htmlFor="sms-opt-in" className="text-sm text-gray-600 cursor-pointer">
                          Receive SMS notifications for time-sensitive deals
                        </label>
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-[#d4a574] hover:bg-[#c49464]" disabled={loading}>
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Account
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                  
                  <div className="mt-4">
                    <SocialLoginButtons mode="register" disabled={loading} onError={(error) => setErrors({ general: error })} />
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="mt-6 text-center space-y-2">
                <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 block">
                  <ArrowLeft className="w-3 h-3 inline mr-1" />
                  Back to Home
                </Link>
                <p className="text-xs text-gray-400">
                  Need help? <a href="mailto:success@accessyourplace.com" className="text-[#d4a574] hover:underline">Contact Support</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={showForgotModal} onOpenChange={(open) => !open && resetForgotPasswordModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Reset Your Password</DialogTitle>
            <DialogDescription className="text-center">
              Choose how you'd like to receive your password reset
            </DialogDescription>
          </DialogHeader>

          {resetSent && resetMethod === 'email' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Check Your Email</h3>
                <p className="text-gray-600 text-sm mt-2">
                  If an account exists with <strong>{forgotEmail}</strong>, you'll receive a password reset link shortly.
                </p>
              </div>
              <Button variant="outline" onClick={resetForgotPasswordModal} className="w-full">
                Back to Login
              </Button>
            </div>
          )}

          {otpStep && resetMethod === 'sms' && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg">Enter Verification Code</h3>
                <p className="text-gray-600 text-sm mt-2">We sent a 6-digit code to <strong>{forgotPhone}</strong></p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <Label htmlFor="otp-code">6-Digit Code</Label>
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <Button type="submit" className="w-full bg-[#d4a574] hover:bg-[#c49464]" disabled={otpVerifying || otpCode.length !== 6}>
                  {otpVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify Code
                </Button>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setOtpStep(false)} className="flex-1">
                    Change Number
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleForgotPasswordSMS} disabled={loading} className="flex-1">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resend Code'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {!resetSent && !otpStep && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setResetMethod('email')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                    resetMethod === 'email' ? 'bg-white shadow text-[#1a365d]' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Via Email
                </button>
                <button
                  type="button"
                  onClick={() => setResetMethod('sms')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                    resetMethod === 'sms' ? 'bg-white shadow text-[#1a365d]' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Via Text
                </button>
              </div>

              {resetMethod === 'email' && (
                <form onSubmit={handleForgotPasswordEmail} className="space-y-4">
                  <div className="text-center pb-2">
                    <div className="w-12 h-12 bg-amber-100 rounded-full mx-auto flex items-center justify-center mb-3">
                      <Mail className="w-6 h-6 text-amber-600" />
                    </div>
                    <p className="text-sm text-gray-600">Enter your email address and we'll send you a link to reset your password.</p>
                  </div>

                  <div>
                    <Label htmlFor="forgot-email">Email Address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  <Button type="submit" className="w-full bg-[#d4a574] hover:bg-[#c49464]" disabled={loading || !forgotEmail}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Send Reset Link
                  </Button>
                </form>
              )}

              {resetMethod === 'sms' && (
                <form onSubmit={handleForgotPasswordSMS} className="space-y-4">
                  <div className="text-center pb-2">
                    <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-3">
                      <Phone className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="text-sm text-gray-600">Enter your phone number and we'll text you a 6-digit verification code.</p>
                  </div>

                  <div>
                    <Label htmlFor="forgot-phone">Phone Number</Label>
                    <Input
                      id="forgot-phone"
                      type="tel"
                      value={forgotPhone}
                      onChange={(e) => handlePhoneChange(e.target.value, false)}
                      placeholder="(555) 123-4567"
                      autoComplete="tel"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">Must match the phone number on your account</p>
                  </div>

                  <Button type="submit" className="w-full bg-[#d4a574] hover:bg-[#c49464]" disabled={loading || forgotPhone.replace(/\D/g, '').length < 10}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Send Verification Code
                  </Button>
                </form>
              )}

              <div className="text-center pt-2">
                <button type="button" onClick={resetForgotPasswordModal} className="text-sm text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="w-3 h-3 inline mr-1" />
                  Back to Login
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Live Support Chat Widget */}
      <LoginSupportChat 
        failedAttempts={failedLoginAttempts} 
        lastAttemptEmail={loginData.email}
      />
    </div>
  );
}
