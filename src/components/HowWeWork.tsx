import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  {
    num: '01',
    title: 'You create your account',
    body: 'Sign up and tell us your goals — markets, budget, preferred property type. No commitment required to browse.',
  },
  {
    num: '02',
    title: 'Browse landlord-approved deals',
    body: 'Every listing on the marketplace has already been negotiated with the landlord. No cold outreach, no guessing — just reviewed opportunities with real market projections.',
  },
  {
    num: '03',
    title: 'Your Acquisition Manager closes it',
    body: 'A certified Acquisition Manager carries the deal from offer through signed lease — handling landlord conversations, lease review, and coordination so you don\'t have to.',
  },
  {
    num: '04',
    title: 'Setup Manager launches operations',
    body: 'Once the lease is signed, your Setup Manager takes over — furniture, decor, housekeeping coordination, Wi-Fi, and vendor setup. We get you live.',
  },
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
              From marketplace to lease signed.<br />
              <span className="text-[#d4a574]">We run the whole process.</span>
            </h2>
            <p className="text-gray-400 leading-relaxed mb-8">
              Most courses teach you to find a unit and list it on Airbnb. We do the part they skip — the landlord relationship, the lease negotiation, and the operational launch. You bring the capital and drive; we bring the network and the certified team.
            </p>
            <div className="flex flex-col gap-3">
              {['No cold landlord outreach', 'No guessing on market projections', 'Certified AM and SM on every deal', 'Four-month training program — not a weekend course'].map(item => (
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

          {/* Right — Steps */}
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
