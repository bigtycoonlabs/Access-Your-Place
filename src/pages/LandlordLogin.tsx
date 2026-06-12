import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, LogIn, Eye, EyeOff, ArrowLeft, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function LandlordLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [forgotSent, setForgotSent] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side rate limiting
    if (attempts >= 5) {
      setError('Too many login attempts. Please wait a few minutes and try again.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setAttempts(prev => prev + 1);

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('landlord-auth', {
        body: { action: 'login', email: email.trim().toLowerCase(), password }
      });

      // Handle network / invoke-level errors
      if (invokeErr) {
        console.error('Landlord auth invoke error:', invokeErr);
        setError(
          invokeErr.message?.includes('FunctionsFetchError')
            ? 'Unable to reach the server. Please check your connection and try again.'
            : invokeErr.message || 'Login failed. Please try again.'
        );
        setLoading(false);
        return;
      }

      // Handle edge function returning an error in the body
      if (!data || data.error) {
        const msg = data?.error || 'Invalid email or password.';
        setError(typeof msg === 'string' ? msg : 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      // Successful login — store session and redirect
      if (data.session_token) {
        localStorage.setItem('landlord_session', data.session_token);
        localStorage.setItem('landlord_data', JSON.stringify(data.landlord || {}));
        // Reset attempts on success
        setAttempts(0);
        navigate('/landlord/portal');
      } else {
        setError('Login succeeded but no session was returned. Please contact support.');
      }
    } catch (err: any) {
      console.error('Landlord login unexpected error:', err);
      setError('Something went wrong. Please try again later.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('landlord-auth', {
        body: { action: 'forgot_password', email: email.trim().toLowerCase() }
      });
      if (invokeErr) {
        setError('Unable to send reset email. Please try again.');
      } else {
        // Always show success to prevent email enumeration
        setForgotSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#1a2332] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building2 className="w-8 h-8 text-[#d4a574]" />
            </div>
            <h1 className="text-3xl font-bold text-[#1a2332]">Landlord Portal</h1>
            <p className="text-gray-600 mt-2">
              {mode === 'login'
                ? 'Sign in to manage your corporate leasing operations'
                : 'Reset your password'}
            </p>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg p-8 space-y-6 border border-gray-100">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent transition-all"
                  placeholder="you@company.com"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); }}
                    className="text-xs text-[#d4a574] hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent pr-12 transition-all"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || attempts >= 5}
                className="w-full bg-[#d4a574] text-white py-3.5 rounded-lg font-semibold hover:bg-[#c49564] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </>
                )}
              </button>

              <div className="text-center space-y-3">
                <p className="text-sm text-gray-500">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => navigate('/landlord-partnership#landlord-inquiry')} className="text-[#d4a574] font-medium hover:underline">
                    Sign up here
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/landlord-partnership')}
                  className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Landlord Partnership
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="bg-white rounded-2xl shadow-lg p-8 space-y-6 border border-gray-100">
              {forgotSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1a2332]">Check Your Email</h3>
                  <p className="text-sm text-gray-600">
                    If an account exists for <strong>{email}</strong>, we've sent a password reset link.
                    Please check your inbox and spam folder.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setForgotSent(false); setError(''); }}
                    className="text-[#d4a574] font-medium hover:underline text-sm"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                      placeholder="you@company.com"
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#d4a574] text-white py-3.5 rounded-lg font-semibold hover:bg-[#c49564] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Send Reset Link
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Sign In
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
