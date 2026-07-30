import { useNavigate } from 'react-router-dom';
import { Check, X, BookOpen, Sparkles } from 'lucide-react';

const ALONE = [
  'Piece the knowledge together from scattered videos',
  'Cold-call landlords and hope one says yes',
  'Bet the whole business on one booking algorithm',
  'Figure out the setup on your own',
];

const WITH_AYP = [
  'A living knowledge library from Penny — free',
  'Find deals yourself with Penny + LeadForge — or let the team source and close',
  'Built to diversify: short-term, mid-term, corporate, co-living',
  'Coached and supported the whole way — as much or as little as you want',
];

/**
 * What Access Your Place is, stated plainly: the knowledge is free, and the team
 * does the part that's actually hard — getting a landlord to say yes.
 */
export default function MissionSection() {
  const navigate = useNavigate();
  const start = () => navigate('/investor/login');

  return (
    <section aria-labelledby="mission-heading" className="border-y border-white/5 bg-[#0a0f1a] px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-[#d4a574]">
          Why Access Your Place
        </p>
        <h2 id="mission-heading" className="mt-3 text-center text-3xl font-bold leading-tight text-white sm:text-4xl">
          We give you the knowledge —{' '}
          <span className="text-[#d4a574]">and do the part that's actually hard.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-slate-300">
          The mechanics of furnished-rental arbitrage were never a secret. The hard part is getting a
          landlord to say yes. Penny gives you the knowledge for free and the tools to find and vet
          deals yourself — and a real team is right there to source, negotiate, and close whenever you
          want them. Either way, you become an operator who owns the business.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Doing it alone</h3>
            <ul className="mt-4 space-y-3">
              {ALONE.map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-400">
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#d4a574]/30 bg-[#d4a574]/[0.06] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#e7c9a0]">With Access Your Place</h3>
            <ul className="mt-4 space-y-3">
              {WITH_AYP.map((t) => (
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
              <span className="font-semibold text-white">A free, living knowledge library.</span> Penny
              researches the market, tracks short-term-rental and shared-living license requirements, and
              keeps it current — the most honest knowledge base in the furnished-rental space.
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
