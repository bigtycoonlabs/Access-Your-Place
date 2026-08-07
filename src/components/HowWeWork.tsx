import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

// The deal no longer comes together one fixed way. You choose how much to carry
// and how much to hand our team — find it yourself with Penny + LeadForge or take
// it from the marketplace; negotiate it yourself or let a certified AM close it.
const steps = [
  {
    num: '01',
    title: 'Find the deal — your way',
    body: "Take a landlord-approved deal straight from the marketplace, or point Penny and LeadForge at any market — by city, ZIP code, and property type — to surface off-market opportunities that aren't listed anywhere yet.",
  },
  {
    num: '02',
    title: 'Vet it with Penny — free',
    body: "Penny scores the opportunity and walks the numbers with you before you spend a dollar. If a deal doesn't pencil, she tells you straight. Data over dreams.",
  },
  {
    num: '03',
    title: 'Close it — solo or with us',
    body: "Negotiate the landlord yourself with Penny coaching every step, or hand it to a certified Acquisition Manager who carries it from offer to signed lease. Your call, deal by deal.",
  },
  {
    num: '04',
    title: 'Launch operations',
    body: "Furniture, decor, Wi-Fi, housekeeping, vendors — your Setup Manager runs the launch, or guides you if you'd rather run it yourself. Either way, you go live.",
  },
];

const points = [
  'Source deals yourself with Penny + Property Forge — or pick from the marketplace',
  'Negotiate your own, or let a certified Acquisition Manager close it',
  'Penny scores every deal and runs the numbers — free',
  'Our team guides and supports every step — as much or as little as you want',
];

export default function HowWeWork() {
  return (
    <section className="bg-[#0a0f1a] text-white py-20 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          {/* Left */}
          <div>
            <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-3">How We Work</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-5">
              From finding the deal to signed lease —<br />
              <span className="text-[#d4a574]">you choose how much we carry.</span>
            </h2>
            <p className="text-gray-400 leading-relaxed mb-8">
              For years we ran every deal for you, human-first — landlord outreach, negotiation,
              launch, all of it. That team hasn't gone anywhere. What's new is that Penny and
              LeadForge put real deal-finding in your hands: source your own deals, vet them free,
              even negotiate them yourself — and lean on our team for as much or as little as you
              want. The expertise didn't shrink; it moved from doing it <span className="italic">for</span> you
              to doing it <span className="italic">with</span> you.
            </p>
            <div className="flex flex-col gap-3">
              {points.map(item => (
                <div key={item} className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-[#d4a574] flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link to="/how-it-works" className="text-[#d4a574] hover:underline text-sm font-medium">
                Full breakdown of how it works →
              </Link>
            </div>
          </div>

          {/* Right — the four paths */}
          <div className="space-y-1 divide-y divide-white/10">
            {steps.map(step => (
              <div key={step.num} className="py-6 grid grid-cols-[48px_1fr] gap-4">
                <div className="text-2xl font-mono text-white/20 pt-0.5">{step.num}</div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
