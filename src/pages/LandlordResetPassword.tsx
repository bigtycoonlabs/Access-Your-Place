import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Landlord password reset — the page the reset email links to.
 *
 * It did not exist. landlord-auth had no recovery actions at all until today, and once
 * forgot_password started emailing a link to /landlord/reset-password, that link went to
 * a route with nothing behind it. This is the other half.
 *
 * Built to avoid the failure the staff and investor equivalents both shipped with: those
 * pages validated their token by calling an action that had never been written, so a
 * valid link reported itself invalid and the only evidence was a browser console. Here
 * the validator exists first, and every failure shows the SERVER's reason — expired,
 * already used, suspended — rather than one catch-all word.
 *
 * Accessibility: single h1, labelled inputs, errors in a live region so a screen reader
 * hears them without hunting, 44px targets, and no reliance on colour alone.
 */
export default function LandlordResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError('This link is missing its reset code. Please request a new reset email.');
        setValidating(false);
        return;
      }
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke('landlord-auth', {
          body: { action: 'validate_token', reset_token: token },
        });
        if (cancelled) return;
        if (invokeErr) {
          setError('We could not check that reset link right now. Please try again in a moment.');
        } else if (data?.valid) {
          setTokenValid(true);
          setName(data.name || '');
        } else {
          // The server's specific reason, not a generic "invalid".
          setError(data?.error || 'This reset link is not valid. Please request a new one.');
        }
      } catch {
        if (!cancelled) setError('We could not check that reset link right now. Please try again in a moment.');
      }
      if (!cancelled) setValidating(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those two passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('landlord-auth', {
        body: { action: 'reset_password', reset_token: token, new_password: password },
      });
      if (invokeErr) {
        // Read the real reason off the response rather than reporting a generic outage.
        const ctx = (invokeErr as any)?.context;
        const parsed = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json().catch(() => null) : null;
        setError(parsed?.error || 'We could not save your new password. Please try again.');
      } else if (data?.success) {
        setDone(true);
        setTimeout(() => navigate('/landlord/login'), 2500);
      } else {
        setError(data?.error || 'We could not save your new password. Please try again.');
      }
    } catch {
      setError('We could not save your new password. Please try again.');
    }
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Choose a new password</h1>

        {/* Errors and status announced without the person having to go looking. */}
        <div aria-live="polite" role="status" className="mt-2">
          {validating && <p className="text-slate-600">Checking your reset link…</p>}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">{error}</p>
          )}
          {done && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-green-800">
              Your password has been updated. Taking you to sign in…
            </p>
          )}
        </div>

        {!validating && !tokenValid && !done && (
          <p className="mt-4">
            <Link to="/landlord/login" className="text-[#1a365d] underline underline-offset-2">
              Back to sign in
            </Link>
          </p>
        )}

        {tokenValid && !done && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {name && <p className="text-slate-700">Hi {name}, set a new password below.</p>}

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-800">
                New password
              </label>
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                /* iOS autocapitalises and autocorrects a type="text" input, and the reveal
                   toggle flips this field to text — which silently corrupts what gets
                   submitted. That bites screen-reader users hardest, since revealing the
                   field is how you get it read back. */
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                minLength={8}
                className="mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-800">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                minLength={8}
                className="mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="min-h-[44px] text-sm text-[#1a365d] underline underline-offset-2"
            >
              {showPassword ? 'Hide passwords' : 'Show passwords'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] rounded-md bg-[#1a365d] px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
