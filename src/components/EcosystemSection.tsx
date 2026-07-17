import { ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EcosystemSection() {
  return (
    <section className="bg-[#080d18] text-white py-20 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-3">The Platform Ecosystem</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Three platforms. One operating company.
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Set Up Your Place LLC builds and operates the full stack — corporate lease acquisition, market intelligence software, and operator technology. Every product connects.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">

          {/* Access Your Place */}
          <div className="bg-gradient-to-b from-[#d4a574]/10 to-transparent border border-[#d4a574]/20 rounded-2xl p-8">
            <div className="text-xs font-mono text-[#d4a574] tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4a574]"></span>
              Access Your Place
            </div>
            <h3 className="text-xl font-bold mb-3">Corporate Lease Acquisition</h3>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              The deal engine. Certified Acquisition Managers source and close furnished rental deals across 30+ markets. Landlord relationships, Master Lease programs, and real market data — not platform scrapes.
            </p>
            <div className="space-y-2 mb-6">
              {['Acquisition Managers', 'Setup Managers', 'Landlord Network', 'Penny Market AI'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="w-1 h-1 rounded-full bg-[#d4a574]"></span>{f}
                </div>
              ))}
            </div>
            <Link to="/deals" className="inline-flex items-center gap-2 text-sm text-[#d4a574] hover:underline">
              View Deals <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Access YP Flow */}
          <div className="bg-gradient-to-b from-[#5EEAD4]/10 to-transparent border border-[#5EEAD4]/20 rounded-2xl p-8">
            <div className="text-xs font-mono text-[#5EEAD4] tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5EEAD4]"></span>
              Access YP Flow
            </div>
            <h3 className="text-xl font-bold mb-3">Arbo Bot — Market Intelligence</h3>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              Arbo Bot monitors micro-market performance across short-term, mid-term, and co-living segments — giving operators real-time occupancy intelligence, pricing signals, and portfolio alerts. One bot, one subscription.
            </p>
            <div className="space-y-2 mb-4">
              {['Real-time STR occupancy data', 'Mid-term rental signals', 'Co-living market tracking', 'Portfolio performance alerts'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="w-1 h-1 rounded-full bg-[#5EEAD4]"></span>{f}
                </div>
              ))}
            </div>
            <div className="bg-[#5EEAD4]/10 border border-[#5EEAD4]/20 rounded-xl p-3 mb-5 text-center">
              <span className="text-2xl font-bold text-[#5EEAD4]">$999</span>
              <span className="text-gray-400 text-sm">/month</span>
            </div>
            <a href="https://accessypflow.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-[#5EEAD4] hover:underline">
              accessypflow.com <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* YP Labs */}
          <div className="bg-gradient-to-b from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-8">
            <div className="text-xs font-mono text-purple-400 tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              Access YP Labs
            </div>
            <h3 className="text-xl font-bold mb-3">Operator Technology Builds</h3>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              The digital agency arm. YP Labs builds operator-branded web applications, AI hospitality concierge tools, direct-booking infrastructure, and custom technology for furnished rental operators at scale.
            </p>
            <div className="space-y-2 mb-6">
              {['Branded booking engines', 'AI concierge bots', 'React Native mobile apps', 'Web portals & dashboards'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="w-1 h-1 rounded-full bg-purple-400"></span>{f}
                </div>
              ))}
            </div>
            <a href="https://accessyplabs.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-purple-400 hover:underline">
              accessyplabs.com <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm mb-4">One operating company. Three interconnected platforms.</p>
          <a href="tel:8138220610" className="inline-flex items-center gap-2 text-[#d4a574] hover:underline text-sm font-medium">
            Talk to the team: (813) 822-0610
          </a>
        </div>
      </div>
    </section>
  );
}
