import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, CheckCircle } from 'lucide-react';

/**
 * Casual-visitor capture. Most people who visit aren't ready to book a call or fund
 * an account — but they're interested. This gives them a low-friction way to stay
 * close (the free market read from Penny), and writes them into the leads table
 * through the shared submit-lead function so the Success Team can follow up.
 */
export default function LeadCapture() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    try {
      const { error } = await supabase.functions.invoke('submit-lead', {
        body: {
          type: 'homepage_interest',
          source: 'homepage_capture',
          name: name.trim() || null,
          email: email.trim(),
          message: 'Requested the free operator market read from the homepage.',
        },
      });
      if (error) throw error;
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section aria-labelledby="capture-heading" className="border-y border-white/5 bg-[#0a0f1a] px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d4a574]/30 bg-[#d4a574]/10 px-4 py-1.5">
          <Sparkles className="h-4 w-4 text-[#d4a574]" aria-hidden="true" />
          <span className="text-sm font-medium text-[#d4a574]">Free — no account needed</span>
        </div>
        <h2 id="capture-heading" className="text-2xl font-bold text-white sm:text-3xl">
          Get the operator's market read
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">
          Not ready to dive in? Leave your email and Penny will send you honest market signals and new
          deals worth watching — the knowledge other people charge thousands for, free.
        </p>

        {status === 'done' ? (
          <div
            role="status"
            className="mx-auto mt-8 flex max-w-md items-center justify-center gap-3 rounded-xl border border-[#d4a574]/30 bg-[#d4a574]/10 px-6 py-4 text-slate-100"
          >
            <CheckCircle className="h-5 w-5 shrink-0 text-[#d4a574]" aria-hidden="true" />
            <span>You're on the list. Penny will keep you posted.</span>
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 max-w-md space-y-3 text-left">
            <div>
              <label htmlFor="capture-name" className="mb-1 block text-sm font-medium text-slate-300">
                Name <span className="text-slate-500">(optional)</span>
              </label>
              <input
                id="capture-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder-slate-500 focus:border-[#d4a574] focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="capture-email" className="mb-1 block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                id="capture-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder-slate-500 focus:border-[#d4a574] focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#d4a574] px-6 font-semibold text-[#1a365d] transition hover:bg-[#e7c9a0] focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#0a0f1a] disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending…' : 'Send me the market read'}
            </button>
            {status === 'error' && (
              <p role="alert" className="text-center text-sm text-red-300">
                Something went wrong. Please try again in a moment.
              </p>
            )}
            <p className="text-center text-xs text-slate-500">
              No spam. Unsubscribe anytime. Your info stays with Access Your Place.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
