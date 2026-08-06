import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Phone, CheckCircle, Eye, EyeOff, ArrowRight, Check, X, AlertTriangle, Mail, ShieldAlert } from 'lucide-react';
import { PasswordStrengthIndicator, validatePasswordStrength } from '@/components/investor/PasswordStrengthIndicator';

type ViewState = 'login' | 'forgot' | 'reset_sent' | 'incomplete_account' | 'otp_verify' | 'complete_account' | 'invitation';

// ─── Client-side rate limiting ───────────────────────────────────────────────
const MAX_CLIENT_ATTEMPTS = 5;
const CLIENT_LOCKOUT_MS = 30_000; // 30 seconds

interface RateLimitState {
  failedAttempts: number;
  lockedUntil: number | null; // epoch ms
}

function loadRateLimit(): RateLimitState {
  try {
    const raw = sessionStorage.getItem('staff_login_rl');
    if (raw) {
      const parsed = JSON.parse(raw);
      // If the lockout has expired, reset
      if (parsed.lockedUntil && Date.now() > parsed.lockedUntil) {
        return { failedAttempts: 0, lockedUntil: null };
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return { failedAttempts: 0, lockedUntil: null };
}

function saveRateLimit(state: RateLimitState) {
  try { sessionStorage.setItem('staff_login_rl', JSON.stringify(state)); } catch { /* ignore */ }
}

// ─── Fallback direct-database login (security-hardened) ──────────────────────
// [removed] directDatabaseLogin: insecure client-side auth that pulled password_hash
// to the browser under the anon key. All staff login now goes through the
// staff-login edge function (server-side bcrypt verification).

export default function StaffLogin() {
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('token');

  const [view, setView] = useState<ViewState>(invitationToken ? 'invitation' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);
  
  // Rate limiting state
  const [rateLimit, setRateLimit] = useState<RateLimitState>(loadRateLimit);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Forgot password / incomplete account flow
  const [forgotEmail, setForgotEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userId, setUserId] = useState('');
  
  // Invitation flow
  const [invitationData, setInvitationData] = useState<{
    email: string;
    first_name: string;
    last_name: string;
    department: string;
  } | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Password validation
  const passwordValidation = validatePasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  // ─── Rate-limit countdown timer ──────────────────────────────────────────
  const isLockedOut = rateLimit.lockedUntil !== null && Date.now() < rateLimit.lockedUntil;

  useEffect(() => {
    if (isLockedOut && rateLimit.lockedUntil) {
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((rateLimit.lockedUntil! - Date.now()) / 1000));
        setLockoutCountdown(remaining);
        if (remaining <= 0) {
          // Lockout expired — reset
          const newState: RateLimitState = { failedAttempts: 0, lockedUntil: null };
          setRateLimit(newState);
          saveRateLimit(newState);
          setLockoutCountdown(0);
          setError('');
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      };
      tick();
      countdownRef.current = setInterval(tick, 1000);
      return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }
  }, [isLockedOut, rateLimit.lockedUntil]);

  const recordClientFailedAttempt = useCallback(() => {
    setRateLimit(prev => {
      const newCount = prev.failedAttempts + 1;
      const newState: RateLimitState = {
        failedAttempts: newCount,
        lockedUntil: newCount >= MAX_CLIENT_ATTEMPTS ? Date.now() + CLIENT_LOCKOUT_MS : null,
      };
      saveRateLimit(newState);
      return newState;
    });
  }, []);

  const resetClientRateLimit = useCallback(() => {
    const newState: RateLimitState = { failedAttempts: 0, lockedUntil: null };
    setRateLimit(newState);
    saveRateLimit(newState);
  }, []);

  useEffect(() => {
    // Check if already logged in
    const session = localStorage.getItem('staffSession');
    if (session) {
      navigate('/staff');
    }
    
    if (invitationToken) {
      validateInvitation();
    }
  }, [invitationToken, navigate]);

  const validateInvitation = async () => {
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('staff-login', {
        body: { action: 'validate_invitation', invitation_token: invitationToken }
      });
      
      if (invokeError) {
        toast({ title: 'Error', description: 'Could not validate your invitation right now. Please try again in a moment.', variant: 'destructive' });
        setView('login');
      } else if (data?.valid) {
        setInvitationData({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          department: data.department
        });
        setView('invitation');
      } else {
        toast({ title: 'Invalid Invitation', description: data?.error || 'This invitation link is invalid or has expired.', variant: 'destructive' });
        setView('login');
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to validate invitation', variant: 'destructive' });
      setView('login');
    }
    setLoading(false);
  };

  // Detect server/temporary errors vs. real credential failures.
  // We must NOT count server errors against the rate limit, AND we should
  // automatically fall back to direct-DB login when the edge function is flaky.
  const isServerError = (msg: string | undefined | null): boolean => {
    if (!msg) return false;
    const m = String(msg).toLowerCase();
    // 'Account temporarily locked' contains 'temporarily' but is a DEFINITIVE answer,
      // not an outage. Without this exclusion a locked-out staff member is told the
      // service is down and keeps retrying, which is the worst possible advice.
      if (m.includes('account temporarily locked') || m.includes('invalid email or password')) return false;
      return (
      m.includes('temporary issue') ||
      m.includes('temporarily unavailable') ||
      m.includes('temporary connection') ||
      m.includes('database connection error') ||
      m.includes('unable to connect') ||
      m.includes('try again in a moment') ||
      m.includes('try again in a few') ||
      m.includes('service unavailable') ||
      m.includes('non-2xx') ||
      m.includes('failed to fetch') ||
      m.includes('networkerror') ||
      m.includes('timeout') ||
      m.includes('timed out') ||
      m.includes('bad gateway') ||
      m.includes('gateway timeout') ||
      m.includes('internal server error') ||
      m.includes('500') ||
      m.includes('502') ||
      m.includes('503') ||
      m.includes('504')
    );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUsingFallback(false);
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    // ── Client-side rate limit check ──
    if (isLockedOut) {
      setError(`Too many failed attempts. Please wait ${lockoutCountdown} seconds.`);
      return;
    }
    
    setLoading(true);
    
    // Retry helper: attempts the edge function up to `maxAttempts` times.
    // Also retries when the function returns a transient server error payload
    // (e.g. `{ success: false, error: "The server is experiencing a temporary issue..." }`).
    /**
     * Pull the real HTTP status and body out of a supabase-js function error.
     *
     * supabase-js reports EVERY non-2xx as the same opaque message, "Edge Function
     * returned a non-2xx status code". staff-login answers a wrong password with 401
     * and a locked account with 423, so without unwrapping this, a rejected password is
     * indistinguishable from the server being down — which is exactly what an owner
     * saw: "The authentication service is temporarily unavailable" when the real answer
     * was that the credentials were refused.
     */
    const readInvokeError = async (err: any): Promise<{ status: number | null; body: any }> => {
      const ctx = err?.context;
      if (ctx && typeof ctx.status === 'number') {
        let body: any = null;
        try { body = await ctx.clone().json(); } catch { /* not json */ }
        return { status: ctx.status, body };
      }
      return { status: null, body: null };
    };

    const invokeWithRetry = async (maxAttempts: number) => {
      let lastError: any = null;
      let lastData: any = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const { data, error: invokeError } = await supabase.functions.invoke('staff-login', {
            body: { email: email.toLowerCase().trim(), password }
          });

          // A 4xx is the server's ANSWER, not a failure to reach it. Retrying it is
          // actively harmful here: staff-login increments failed_login_attempts on every
          // 401 and locks the account at 10, so a 3x retry burned three of the ten on a
          // single typo — locking someone out in four attempts instead of ten, while
          // telling them the service was unavailable. Return 4xx immediately.
          if (invokeError) {
            const { status, body } = await readInvokeError(invokeError);
            if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429) {
              console.warn(`[StaffLogin] Definitive ${status} from staff-login — not retrying.`);
              return { data: body ?? { success: false, error: 'Invalid email or password' }, error: null };
            }
          }

          if (!invokeError) {
            // Check for transient server-side errors in the payload — retry those too
            if (data && data.success === false && isServerError(data.error)) {
              lastData = data;
              lastError = null;
              console.warn(`[StaffLogin] Edge function attempt ${attempt}/${maxAttempts} returned transient server error:`, data.error);
            } else {
              return { data, error: null };
            }
          } else {
            lastError = invokeError;
            lastData = null;
            console.warn(`[StaffLogin] Edge function attempt ${attempt}/${maxAttempts} failed:`, invokeError.message || invokeError);
          }
        } catch (err) {
          lastError = err;
          lastData = null;
          console.warn(`[StaffLogin] Edge function attempt ${attempt}/${maxAttempts} threw:`, (err as Error).message);
        }
        // Exponential backoff: 400ms, 800ms, 1600ms
        if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 400 * Math.pow(2, attempt - 1)));
      }
      // All attempts exhausted — return the last data if we have it, otherwise the error
      return lastData ? { data: lastData, error: null } : { data: null, error: lastError };
    };

    /**
     * Handle a successful login response — store session & navigate.
     */
    const handleSuccessfulLogin = (data: any, source: 'edge' | 'fallback') => {
      const sessionData = {
        id: data.id,
        email: data.email,
        name: data.name,
        first_name: data.first_name,
        last_name: data.last_name,
        team: data.team,
        role: data.role,
        department: data.department,
        permissions: data.permissions || [],
        linked_investor_id: data.linked_investor_id,
        roles: data.roles || [],
        agreement_signed: data.agreement_signed !== false,
        agreement_id: data.agreement_id || null,
        session_token: data.session_token || null,
        loginTime: Date.now()
      };
      
      console.log('[StaffLogin] Session data being stored:', {
        id: sessionData.id, email: sessionData.email, department: sessionData.department,
        roles: sessionData.roles, permissions: sessionData.permissions,
        agreement_signed: sessionData.agreement_signed, source,
        has_session_token: !!sessionData.session_token
      });
      
      localStorage.setItem('staffSession', JSON.stringify(sessionData));
      resetClientRateLimit();
      toast({ title: 'Welcome!', description: `Logged in as ${data.name}` });

      if (data.agreement_signed === false && data.agreement_id) {
        toast({ title: 'Agreement Required', description: 'Please review and sign your service agreement before accessing the dashboard.' });
        navigate(`/am-agreement/${data.agreement_id}`);
      } else {
        navigate('/staff');
      }
    };

    /**
     * Handle a CREDENTIAL failure — record the attempt for rate limiting.
     * Do NOT call this for server errors.
     */
    const handleCredentialFailure = (errorMsg: string) => {
      recordClientFailedAttempt();
      const newCount = rateLimit.failedAttempts + 1;
      const remaining = MAX_CLIENT_ATTEMPTS - newCount;
      
      if (remaining <= 0) {
        setError(`Too many failed attempts. Login disabled for ${CLIENT_LOCKOUT_MS / 1000} seconds.`);
      } else if (remaining <= 2) {
        setError(`${errorMsg} (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`);
      } else {
        setError(errorMsg);
      }
    };

    /**
     * Handle a transient server error — do NOT count against rate limit.
     * Shows a friendly "try again" message.
     */
    const handleServerError = (sourceMsg?: string) => {
      console.warn('[StaffLogin] Server error (not counted against rate limit):', sourceMsg);
      setError('The authentication service is temporarily unavailable. Please wait a few seconds and try again. If the problem persists, contact your administrator.');
    };

    // [removed] tryFallback — no insecure client-side login fallback.

    try {
      const { data, error: invokeError } = await invokeWithRetry(3);
      
      console.log('[StaffLogin] Edge function response:', { hasData: !!data, hasError: !!invokeError, dataSuccess: data?.success });
      
      if (invokeError) {
        // Edge function completely unavailable after retries — try fallback
        console.log('[StaffLogin] Edge function unavailable after retries, using fallback login...', invokeError);
        handleServerError();

      } else if (data?.success) {
        handleSuccessfulLogin(data, 'edge');

      } else if (data?.rate_limited) {
        // Server-side rate limiting — sync to client state
        const lockUntil = Date.now() + (data.retry_after_seconds || 30) * 1000;
        const newState: RateLimitState = { failedAttempts: MAX_CLIENT_ATTEMPTS, lockedUntil: lockUntil };
        setRateLimit(newState);
        saveRateLimit(newState);
        setError(data.error || `Too many failed attempts. Please wait ${data.retry_after_seconds || 30} seconds.`);

      } else if (data?.error && isServerError(data.error)) {
        // Edge function returned a transient server error — try fallback automatically.
        // Do NOT count this as a failed login attempt.
        console.log('[StaffLogin] Edge function returned transient server error, trying fallback...', data.error);
        handleServerError();

      } else if (data?.error) {
        // Genuine credential/account failure
        handleCredentialFailure(data.error);

      } else {
        // Unexpected shape — treat as server error
        handleServerError('Unexpected response from login service');
      }
    } catch (err: any) {
      console.error('[StaffLogin] Login error:', err);
      
      // Decide whether this is a server error or a credential error based on the message
      if (isServerError(err?.message)) {
        handleServerError();
      } else {
        // Unknown error — try fallback as a last resort
        handleServerError();
      }
    }
    
    setLoading(false);
  };




  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast({ title: 'Email Required', description: 'Please enter your email address.', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      // Try the dedicated staff-forgot-password function first
      const { data, error: invokeError } = await supabase.functions.invoke('staff-forgot-password', {
        body: { 
          email: forgotEmail.toLowerCase().trim(),
          base_url: window.location.origin
        }
      });
      
      if (invokeError) {
        // Fallback to staff-login forgot_password action
        console.log('Trying staff-login forgot_password action...');
        const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('staff-login', {
          body: { 
            action: 'forgot_password', 
            email: forgotEmail.toLowerCase().trim(),
            base_url: window.location.origin
          }
        });
        
        if (fallbackError) {
          console.log('Both edge functions unavailable for password reset');
        }
      }
      
      // Always show success message for security (don't reveal if email exists)
      setView('reset_sent');
      toast({ 
        title: 'Check Your Email', 
        description: 'If an account exists with that email, you will receive a password reset link.' 
      });
    } catch (err: any) {
      console.error('Forgot password error:', err);
      // Still show success for security (don't reveal if email exists)
      setView('reset_sent');
      toast({ 
        title: 'Check Your Email', 
        description: 'If an account exists with that email, you will receive a password reset link.' 
      });
    }
    setLoading(false);
  };


  // Helper: Build and store a staffSession from complete_invitation response + invitationData
  const storeSessionFromInvitation = (responseData: any) => {
    const sessionData = {
      id: responseData.id || responseData.staff_id || '',
      email: responseData.email || invitationData?.email || '',
      name: responseData.name || `${invitationData?.first_name || ''} ${invitationData?.last_name || ''}`.trim(),
      first_name: responseData.first_name || invitationData?.first_name || '',
      last_name: responseData.last_name || invitationData?.last_name || '',
      team: responseData.team || responseData.department || invitationData?.department || '',
      role: responseData.role || 'staff',
      department: responseData.department || invitationData?.department || '',
      permissions: responseData.permissions || [],
      linked_investor_id: responseData.linked_investor_id || null,
      roles: responseData.roles || [],
      agreement_signed: responseData.agreement_signed !== false,
      agreement_id: responseData.agreement_id || null,
      session_token: responseData.session_token || null,
      loginTime: Date.now()
    };

    // If department-based permissions weren't set by the edge function, set them
    if (sessionData.permissions.length === 0) {
      if (sessionData.department === 'success_managers') {
        sessionData.permissions = ['all'];
      } else if (sessionData.department === 'acquisition_managers') {
        sessionData.permissions = ['deals', 'acquisitions', 'investors', 'crm', 'inquiries', 'marketplace'];
      } else if (sessionData.department === 'setup_managers') {
        sessionData.permissions = ['deals', 'setups', 'investors', 'crm'];
      }
    }

    console.log('[StaffLogin] Storing session from invitation completion:', {
      id: sessionData.id, email: sessionData.email, department: sessionData.department,
      agreement_signed: sessionData.agreement_signed, agreement_id: sessionData.agreement_id,
    });

    localStorage.setItem('staffSession', JSON.stringify(sessionData));
    return sessionData;
  };

  const handleCompleteInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use validatePasswordStrength to ensure all 5 requirements are met
    if (!passwordValidation.isValid) {
      toast({ 
        title: 'Password Requirements Not Met', 
        description: 'Please ensure your password meets all 5 security requirements.', 
        variant: 'destructive' 
      });
      return;
    }
    if (!passwordsMatch) {
      toast({ title: 'Passwords Do Not Match', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('staff-login', {
        body: {
          action: 'complete_invitation',
          invitation_token: invitationToken,
          new_password: newPassword,
          phone: phone.replace(/\D/g, ''),
          whatsapp_number: whatsappNumber.replace(/\D/g, '')
        }
      });
      
      if (invokeError) {
        console.error('[StaffLogin] complete_invitation edge function unavailable:', invokeError);
        toast({ title: 'Service temporarily unavailable', description: 'We could not complete your account setup right now. Please wait a few seconds and try again. If it keeps failing, contact your administrator.', variant: 'destructive' });
      } else if (data?.success) {
        const session = storeSessionFromInvitation(data);
        
        if (data.agreement_signed === false && data.agreement_id) {
          toast({ title: 'Account Created!', description: 'Please review and sign your service agreement.' });
          navigate(`/am-agreement/${data.agreement_id}`);
        } else {
          const firstName = data.first_name || invitationData?.first_name || 'team member';
          toast({ title: 'Welcome!', description: `Your account is ready. Welcome to the team, ${firstName}!` });
          navigate('/staff');
        }

      } else {
        toast({ title: 'Error', description: data?.error || 'Failed to complete account setup', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };


  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const attemptsRemaining = MAX_CLIENT_ATTEMPTS - rateLimit.failedAttempts;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a365d] via-[#2d5a87] to-[#1a365d] flex items-center justify-center p-4">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-[#1a365d] px-4 py-2 rounded z-50">
        Skip to main content
      </a>

      <Card className="w-full max-w-md" id="main-content">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl mx-auto mb-4 flex items-center justify-center" aria-hidden="true">
            <span className="text-white font-bold text-xl">AYP</span>
          </div>
          <CardTitle className="text-2xl">
            {view === 'login' && 'Staff Login'}
            {view === 'forgot' && 'Reset Password'}
            {view === 'reset_sent' && 'Check Your Email'}
            {view === 'invitation' && 'Complete Your Account'}
          </CardTitle>
          <CardDescription>
            {view === 'login' && 'Access the staff dashboard'}
            {view === 'forgot' && 'Enter your email to receive a reset link'}
            {view === 'reset_sent' && 'A password reset link has been sent'}
            {view === 'invitation' && `Welcome, ${invitationData?.first_name}! Set up your account.`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Login View */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
                  <div className="flex items-start gap-2">
                    {isLockedOut ? (
                      <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p>{error}</p>
                      {usingFallback && (
                        <p className="text-xs mt-1 text-red-600">
                          Note: Using backup authentication. Some features may be limited.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Lockout countdown banner */}
              {isLockedOut && lockoutCountdown > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm" role="status">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <p>Login disabled for <span className="font-bold tabular-nums">{lockoutCountdown}s</span></p>
                  </div>
                </div>
              )}

              {/* Remaining attempts warning */}
              {!isLockedOut && attemptsRemaining > 0 && attemptsRemaining <= 2 && rateLimit.failedAttempts > 0 && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-xs" role="status">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <p>{attemptsRemaining} login attempt{attemptsRemaining === 1 ? '' : 's'} remaining before temporary lockout</p>
                  </div>
                </div>
              )}
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@accessyourplace.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-required="true"
                  disabled={isLockedOut}
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    // iOS autocapitalises and autocorrects a type="text" input. The
                    // show-password toggle flips this field to type="text", so revealing
                    // the password could silently capitalise its first letter or
                    // "correct" a word inside it — and the submitted value is then wrong
                    // with nothing on screen to say so. That bites screen-reader users
                    // hardest, because revealing the field is how you get VoiceOver to
                    // read back what was actually typed.
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-required="true"
                    disabled={isLockedOut}
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
              </div>

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-sm text-[#d4a574] hover:underline"
                >
                  Forgot password?
                </button>
                <Link
                  to="/staff/reset-password"
                  className="text-sm text-gray-400 hover:text-gray-600 hover:underline"
                >
                  Reset via link
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#d4a574] hover:bg-[#c49464]"
                disabled={loading || isLockedOut}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                {isLockedOut ? `Locked (${lockoutCountdown}s)` : 'Sign In'}
                {!isLockedOut && <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />}
              </Button>

              <div className="text-center pt-4">
                <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="w-3 h-3 inline mr-1" aria-hidden="true" />
                  Back to Home
                </Link>
              </div>
            </form>
          )}

          {/* Forgot Password View */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <Mail className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="font-medium">Password Reset</p>
                    <p className="text-blue-600 mt-1">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="forgot-email">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@accessyourplace.com"
                  autoComplete="email"
                  aria-required="true"
                />
              </div>
              
              <Button type="submit" className="w-full bg-[#d4a574] hover:bg-[#c49464]" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Send Reset Link
              </Button>
              
              <Button type="button" variant="ghost" onClick={() => setView('login')} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                Back to Login
              </Button>
            </form>
          )}

          {/* Reset Sent View */}
          {view === 'reset_sent' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center" aria-hidden="true">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-600">
                If an account exists with that email, you'll receive a password reset link shortly.
              </p>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <p className="font-medium">Didn't receive the email?</p>
                <ul className="text-left mt-2 space-y-1 text-amber-700">
                  <li>• Check your spam or junk folder</li>
                  <li>• Make sure you entered the correct email</li>
                  <li>• Wait a few minutes and try again</li>
                </ul>
              </div>
              <Button 
                variant="outline" 
                onClick={() => { setView('login'); setForgotEmail(''); }}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                Back to Login
              </Button>
            </div>
          )}

          {/* Invitation View */}
          {view === 'invitation' && invitationData && (
            <form onSubmit={handleCompleteInvitation} className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <p className="font-medium text-blue-800">{invitationData.first_name} {invitationData.last_name}</p>
                <p className="text-blue-600">{invitationData.email}</p>
                <p className="text-blue-600 capitalize">{invitationData.department?.replace('_', ' ')}</p>
              </div>

              <div>
                <Label htmlFor="inv-phone">Phone Number</Label>
                <Input
                  id="inv-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                />
              </div>

              <div>
                <Label htmlFor="inv-whatsapp">WhatsApp Number (Optional)</Label>
                <Input
                  id="inv-whatsapp"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(formatPhone(e.target.value))}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="inv-password">Create Password</Label>
                <div className="relative">
                  <Input
                    id="inv-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    aria-required="true"
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
                
                {/* Password Strength Indicator */}
                <PasswordStrengthIndicator password={newPassword} showRequirements={true} />
              </div>

              <div>
                <Label htmlFor="inv-confirm">Confirm Password</Label>
                <Input
                  id="inv-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  aria-required="true"
                />
                {confirmPassword && (
                  <p className={`text-sm mt-1 flex items-center gap-1.5 ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordsMatch ? (
                      <><Check className="w-4 h-4" /> Passwords match</>
                    ) : (
                      <><X className="w-4 h-4" /> Passwords do not match</>
                    )}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full bg-[#d4a574] hover:bg-[#c49464]" 
                disabled={loading || !passwordValidation.isValid || !passwordsMatch}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Complete Setup
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
