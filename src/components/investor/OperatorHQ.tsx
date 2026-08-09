import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Store, MessagesSquare, Target, Calendar, LayoutDashboard, Sparkles } from 'lucide-react';
import { AIChat } from '@/components/investor/AIChat';
import { PennyPresence } from '@/components/investor/PennyPresence';

interface InvestorLite {
  id: string;
  full_name?: string;
  email?: string;
}

interface OperatorHQProps {
  investor: InvestorLite;
  onNavigate: (tab: string) => void;
  onOpenDashboard: () => void;
  onBookCall?: () => void;
}

function HQCard({
  icon, title, description, onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 text-left rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#d4a574] hover:shadow-md min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2"
    >
      <span className="mt-0.5 flex-shrink-0" aria-hidden="true">{icon}</span>
      <span>
        <span className="block font-semibold text-slate-800">{title}</span>
        <span className="block text-sm text-slate-500">{description}</span>
      </span>
    </button>
  );
}

/**
 * Operator HQ — the Penny-first client home.
 *
 * Clients land here and are met by Penny herself: a warm greeting, the full
 * Penny chat front and center, and one-tap access to the places that matter.
 * The classic tabbed dashboard is always one tap away as a fallback, so nothing
 * is lost — the experience is just led by Penny instead of a wall of tabs.
 *
 * Accessible-first: the greeting is announced, every target is >= 44px, and the
 * chat is the single focus of the page.
 */
export function OperatorHQ({ investor, onNavigate, onOpenDashboard, onBookCall }: OperatorHQProps) {
  const navigate = useNavigate();
  const firstName = (investor.full_name || '').split(' ')[0] || 'there';

  return (
    <div className="relative max-w-4xl mx-auto">
      <PennyPresence className="left-1/2 top-0 -translate-x-1/2 -translate-y-1/3 opacity-80" size={620} intensity={0.13} />
      <div className="relative z-10">
      <section aria-label="Penny greeting" className="text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#1a365d]/5 px-3 py-1 text-sm font-medium text-[#1a365d]">
          <Sparkles className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
          Operator HQ
        </div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          Hi {firstName} — I'm Penny.
        </h1>
        <p className="mt-1 text-slate-600" role="status" aria-live="polite">
          I'm Penny. Tell me what you're working on and I'll take it from there —
          deals, your portfolio, messages, or getting you in front of the right property.
          Ask me anything below.
        </p>
      </section>

      {/* The main event: Penny chat, front and center */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <AIChat investorId={investor.id} investorName={investor.full_name || 'Investor'} />
      </div>

      {/* One-tap access to the places that matter */}
      <section aria-label="Quick access" className="mt-6">
        <h2 className="sr-only">Quick access</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <HQCard
            icon={<Building2 className="h-6 w-6 text-[#d4a574]" />}
            title="Active deal flow"
            description="Pre-verified properties ready to review"
            onClick={() => navigate('/deals')}
          />
          <HQCard
            icon={<Target className="h-6 w-6 text-[#1a365d]" />}
            title="Deal matching"
            description="Deals matched to what you want"
            onClick={() => onNavigate('deal-matching')}
          />
          <HQCard
            icon={<Building2 className="h-6 w-6 text-green-600" />}
            title="Your portfolio"
            description="Track your acquisitions"
            onClick={() => onNavigate('portfolio')}
          />
          <HQCard
            icon={<MessagesSquare className="h-6 w-6 text-[#1a365d]" />}
            title="Messages"
            description="Talk with your success team"
            onClick={() => onNavigate('messages')}
          />
          <HQCard
            icon={<Store className="h-6 w-6 text-green-600" />}
            title="Sell your operation"
            description="List a deal for sale"
            onClick={() => onNavigate('marketplace')}
          />
          <HQCard
            icon={<Calendar className="h-6 w-6 text-[#d4a574]" />}
            title="Book a call"
            description="Speak with an expert"
            onClick={() => (onBookCall ? onBookCall() : onNavigate('calendar'))}
          />
        </div>
      </section>

      {/* The full classic dashboard is always one tap away */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onOpenDashboard}
          className="inline-flex items-center gap-2 text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 min-h-[44px] px-4"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Open the full dashboard
        </button>
      </div>
      </div>
    </div>
  );
}

export default OperatorHQ;
