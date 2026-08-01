import { useState, useEffect } from 'react';
import PennyPublicChat from './PennyPublicChat';
import { Sparkles, ArrowRight, Send } from 'lucide-react';
import { PennyMark } from '@/components/investor/PennyMark';

// Rotating example prompts — makes the hero feel alive without any backend call.
const EXAMPLE_PROMPTS = [
  'Penny, run the numbers on 1423 Oak Ave for a mid-term corporate setup…',
  'Help me build a co-living operation — then find the units that fit it…',
  'Which of my listings should I diversify off Airbnb?…',
  'Pull MTR demand for this ZIP before I commit…',
  'Draft the acquisition agreement for the Dallas deal…',
];

const CAPABILITIES = [
  'Runs the numbers on any address',
  'Shapes your operation, then finds the fit',
  'Sources & negotiates through the team',
  'Coaches you past the one-OTA trap',
];

/**
 * PennyHero — the flagship crown at the top of Access Your Place.
 * Penny 10.3, our most intelligent model, framed as the acquisition guide.
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
          Penny&nbsp;10.3
          <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-[#7CFFB2]" aria-hidden="true" />
          <span className="sr-only">— live, our most intelligent model</span>
        </span>

        <h1
          id="penny-hero-heading"
          className="mt-6 text-4xl font-bold leading-tight text-white sm:text-5xl"
        >
          Meet Penny — your <span className="text-[#d4a574]">acquisition guide.</span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-300">
          Our most intelligent model — coach, acquisition specialist, and research desk in one.
          Hand her an address and she runs the real numbers. Tell her your idea and she builds the
          operation, then finds the units that fit it. A human team negotiates and closes, so you
          never cold-call a landlord — and she will tell you the truth when a deal does not pencil.
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
