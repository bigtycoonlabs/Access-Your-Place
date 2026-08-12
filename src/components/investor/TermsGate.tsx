/**
 * TermsGate
 *
 * Nobody uses the platform until they have accepted the current terms.
 *
 * Before this, a new account could browse, enquire and get all the way to a payment screen
 * without ever agreeing to anything. Acceptance was only recorded at the point of reserving
 * a deal, which is far too late.
 *
 * It is versioned: the terms changed materially on 12 August 2026, so an acceptance of the
 * older terms does not clear somebody for these. When the version is bumped, everybody is
 * asked again.
 *
 * Accessibility notes, because this blocks the whole product:
 *  - It is a real dialog with a heading, announced on arrival.
 *  - The summary is linear speakable prose, not a scroll-trap of legalese.
 *  - The full terms open in a new tab and that is stated out loud, not just implied.
 *  - The Accept control is a 44px target and is never pre-ticked. Consent is an act.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

function getInvestorSessionToken(): string | null {
  try {
    const direct = window.localStorage.getItem('investorSessionToken');
    if (direct) return direct;
    const raw = window.localStorage.getItem('investorSession');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.session_token || parsed?.token || null;
  } catch {
    return null;
  }
}

interface Props {
  children: React.ReactNode;
}

export function TermsGate({ children }: Props) {
  const [state, setState] = useState<'checking' | 'blocked' | 'clear'>('checking');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getInvestorSessionToken();
      if (!token) {
        // Not signed in: the portal's own auth handles that, this gate stays out of it.
        if (!cancelled) setState('clear');
        return;
      }
      try {
        const { data, error: err } = await supabase.functions.invoke('legal-acceptance', {
          body: { action: 'status', session_token: token },
        });
        if (cancelled) return;
        if (err) throw err;
        // Fail closed: if we could not confirm acceptance, ask. An unverifiable read is
        // not consent, and asking twice is a smaller harm than never asking.
        setState(data?.accepted === true ? 'clear' : 'blocked');
      } catch {
        if (!cancelled) setState('blocked');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (state === 'blocked') headingRef.current?.focus();
  }, [state]);

  const accept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('legal-acceptance', {
        body: { action: 'accept', accepted: true, session_token: getInvestorSessionToken() },
      });
      if (err) throw err;
      if (!data?.success) {
        // Never let somebody through on an acceptance that was not recorded.
        setError(data?.message || 'We could not record your acceptance. Please try again.');
        setSubmitting(false);
        return;
      }
      setState('clear');
    } catch {
      setError('We could not record your acceptance. Please try again, or email success@accessyourplace.com.');
    }
    setSubmitting(false);
  };

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-[#1a365d]" aria-hidden="true" />
        <span className="ml-3 text-gray-700">Checking your account</span>
      </div>
    );
  }

  if (state === 'clear') return <>{children}</>;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-heading"
      className="min-h-screen bg-gray-50 px-4 py-10"
    >
      <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1
          id="terms-gate-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold text-[#1a365d] outline-none"
        >
          Before you start, please accept our terms
        </h1>
        <p className="mt-3 text-gray-700">
          We updated these on 12 August 2026. Here is what matters most, in plain English.
          The full terms are linked below.
        </p>

        <ul className="mt-5 space-y-3 text-gray-700">
          <li>
            <strong>It costs $2,500 to take an operation off the market.</strong> That deposit
            goes to Set Up Your Place LLC and comes off the acquisition fee. It is not an extra
            charge, and it is the only payment ever due up front. If you hold credit with us,
            you can use that instead.
          </li>
          <li>
            <strong>Reserving is what releases the address.</strong> Listings do not show the
            street address or the landlord's details. Once the Success Team approves your
            reservation, the operation is held for 72 hours and the address is released so you
            can check the numbers yourself.
          </li>
          <li>
            <strong>You meet the landlord when you are ready, not before.</strong> We introduce
            you once you tell us you are comfortable.
          </li>
          <li>
            <strong>Nothing completes without a person.</strong> Payment proof puts a deal on
            reserve. An acquisition manager verifies it and speaks with you to finalise. The
            full acquisition fee is paid before lease documents are signed.
          </li>
          <li>
            <strong>A landlord deposit, where one exists, is separate and is not ours.</strong>{' '}
            It is never due until the lease is in your hands and you have read it.
          </li>
          <li>
            <strong>Setup is its own service.</strong> We can launch a property you already own.
            Nothing is scoped, quoted or charged before a consultation, and anything we buy for
            your project belongs to you.
          </li>
        </ul>

        <p className="mt-5">
          <a
            href="/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#1a365d] underline"
          >
            Read the full Terms of Service
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>

        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            {error}
          </p>
        )}

        <button
          onClick={accept}
          disabled={submitting}
          className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#1a365d] px-6 py-3 text-lg font-semibold text-white hover:bg-[#12283f] disabled:opacity-60"
        >
          {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />}
          {submitting ? 'Recording your acceptance' : 'I accept these terms'}
        </button>
        <p className="mt-3 text-sm text-gray-600">
          Accepting records the date and time against your account. You can read the full terms
          at any time from the footer of any page.
        </p>
      </div>
    </div>
  );
}

export default TermsGate;
