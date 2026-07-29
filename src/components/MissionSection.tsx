import { useNavigate } from 'react-router-dom';
import { Check, X, BookOpen, Sparkles } from 'lucide-react';

const OLD_WAY = [
  'Pay $2,000–$14,000 for a course',
  'Learn the theory, then cold-call landlords alone',
  'Bet the whole business on one OTA algorithm',
  "You're on your own the moment you check out",
];

const AYP_WAY = [
  'The same knowledge — free, from Penny',
  'A real team finds, negotiates, and closes the landlord',
  'Built to diversify: short-term, mid-term, corporate, co-living',
  'Coached and supported the whole way',
];

/**
 * The mission, stated plainly, and the difference the competitor research makes obvious:
 * the courses never sold secrets — they sold access, then skipped the hardest part.
 */
export default function MissionSection() {
  const navigate = useNavigate();
  const start = () => navigate('/investor/login');

  return (
    <section
      aria-labelledby="mission-heading"
      className="border-y border-white/5 bg-[#0a0f1a] px-6 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-[#d4a574]">
          Why Access Your Place
        </p>
        <h2
          id="mission-heading"
          className="mt-3 text-center text-3xl font-bold leading-tight text-white sm:text-4xl"
        >
          The knowledge they sell for <span className="text-[#d4a574]">$7,000</span> — free.
          <br className="hidden sm:block" /> The part they skip — done for you.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-slate-300">
          The courses were never selling secrets — the mechanics are all over YouTube. They sell you
          access, then leave you to do the hardest thing alone: convince a landlord. Penny gives you
          the knowledge for free, and a real team does the acquisition. You become an operator — not a
          course graduate.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              A $7,000 course
            </h3>
            <ul className="mt-4 space-y-3">
              {OLD_WAY.map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-400">
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#d4a574]/30 bg-[#d4a574]/[0.06] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#e7c9a0]">
              Access Your Place
            </h3>
            <ul className="mt-4 space-y-3">
              {AYP_WAY.map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-200">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#d4a574]" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-1 h-6 w-6 shrink-0 text-[#d4a574]" aria-hidden="true" />
            <p className="text-slate-300">
              <span className="font-semibold text-white">A free, living knowledge library.</span>{' '}
              Penny researches the market, tracks short-term-rental and shared-living license
              requirements, and keeps it current — building the most honest knowledge base in the
              furnished-rental space.
            </p>
          </div>
          <button
            type="button"
            onClick={start}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-[#d4a574] px-6 font-semibold text-[#1a365d] transition hover:bg-[#e7c9a0] focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#0a0f1a]"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Start with Penny — free
          </button>
        </div>
      </div>
    </section>
  );
}
