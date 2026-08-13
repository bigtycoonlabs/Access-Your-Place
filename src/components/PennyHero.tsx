import { useState, useEffect } from 'react';
import PennyPublicChat from './PennyPublicChat';
import { Sparkles, ArrowRight, Send } from 'lucide-react';
import { PennyMark } from '@/components/investor/PennyMark';

// Rotating example prompts — makes the hero feel alive without any backend call.
// What somebody can actually ASK PUBLIC PENNY, which is a scan on an address. The old set
// promised things this surface cannot do: it invited a stranger to "draft the acquisition
// agreement for the Dallas deal", which no client would ever ask and Penny cannot do here.
// Suggesting a capability that does not exist is a lie told before the conversation starts.
const EXAMPLE_PROMPTS = [
  'Run the numbers on 1423 Oak Ave, Austin TX…',
  'What would 200 Creek Ridge Dr earn as a furnished rental?…',
  'Scan 88 Harbor St, Tampa FL for me…',
  'What is the nightly rate and occupancy around this address?…',
  'How much would a mid-term stay bring in at this address?…',
];

// Plain descriptions of what she does. "Shapes your operation, then finds the fit" and
// "the one-OTA trap" told a newcomer nothing: OTA is industry shorthand for a booking site
// like Airbnb, and nobody outside the business has heard it.
const CAPABILITIES = [
  'Runs real numbers on any address, free',
  'Finds properties and talks to the landlord for you',
  'Handles the negotiation and the lease',
  'Coaches you on running it once it is yours',
];

/**
 * PennyHero — the flagship crown at the top of Access Your Place.
 * Penny 11, our most intelligent model, framed as the acquisition guide.
 * Self-contained; touches no auth or routing logic beyond a link into the portal.
 */
export default function PennyHero() {
  const [query, setQuery] = useState('');
  const [promptIdx, setPromptIdx] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [seed, setSeed] = useState('');

  useEffect(() => {
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % EXAMPLE_PROMPTS.length), 3200);
    return () => clearInterval(t);
  }, []);

  // The visitor meets the real Penny right here — open the public chat.
  const openChat = () => {
    setSeed(query.trim());
    setChatOpen(true);
  };

  return (
    <>
    <section
      aria-labelledby="penny-hero-heading"
      className="relative overflow-hidden border-b border-[#d4a574]/20 bg-gradient-to-b from-[#0b1220] via-[#0a0f1a] to-[#0a0f1a] px-6 py-16 sm:py-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[#d4a574]/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <PennyMark size={72} className="mx-auto mb-6" speaking={false} />
        <span
          role="status"
          className="inline-flex items-center gap-2 rounded-full border border-[#d4a574]/40 bg-[#d4a574]/10 px-4 py-1.5 text-sm font-semibold tracking-wide text-[#e7c9a0]"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Penny&nbsp;11
          <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-[#7CFFB2]" aria-hidden="true" />
          <span className="sr-only">— live, our most intelligent model</span>
        </span>

        <h1
          id="penny-hero-heading"
          className="mt-6 text-4xl font-bold leading-tight text-white sm:text-5xl"
        >
          Rent an apartment. Furnish it.{' '}
          <span className="text-[#d4a574]">Run it like a hotel.</span>
        </h1>

        {/* A client told us they did not understand what this company was until they
            started talking to Penny. The page opened on "rental arbitrage" and "pencils",
            which only mean something if you already know the business. Say the thing
            first, in words somebody's mother would follow, then use the terms. */}
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-200">
          That is the whole business, and it is called rental arbitrage. You lease a property,
          furnish it, and rent it out by the night, the month, or the room. The gap between your
          rent and what guests pay is yours.
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-lg leading-relaxed text-slate-300">
          The hard part was never the idea. It is getting a landlord to say yes. That is what we
          do: we find the properties, speak to the landlord ourselves, agree the terms, and hand
          you a deal that is ready to sign. We can furnish and launch it for you too, in about
          fourteen days.
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
          Ask Penny anything below. Give her an address and she runs real numbers on it, free,
          whether you buy anything or not. When a deal does not work, she says so.
        </p>

        <div className="mx-auto mt-8 max-w-xl">
          <label htmlFor="penny-ask" className="sr-only">
            Ask Penny about a deal
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-lg backdrop-blur focus-within:border-[#d4a574]/60">
            <input
              id="penny-ask"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openChat();
              }}
              placeholder={EXAMPLE_PROMPTS[promptIdx]}
              className="min-h-[44px] flex-1 bg-transparent px-4 text-base text-white placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={openChat}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#d4a574] px-5 font-semibold text-[#1a365d] transition hover:bg-[#e7c9a0] focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#0a0f1a]"
            >
              Ask Penny
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            She is inside the platform, working every deal.{' '}
            <button
              type="button"
              onClick={openChat}
              className="font-semibold text-[#d4a574] underline-offset-4 hover:underline"
            >
              Start with Penny <ArrowRight className="inline h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </p>
        </div>

        <ul
          className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2"
          aria-label="What Penny does"
        >
          {CAPABILITIES.map((c) => (
            <li
              key={c}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-slate-300"
            >
              {c}
            </li>
          ))}
        </ul>
      </div>
    </section>
    <PennyPublicChat open={chatOpen} initialQuery={seed} onClose={() => setChatOpen(false)} />
    </>
  );
}
