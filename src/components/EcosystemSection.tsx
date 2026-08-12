import { ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EcosystemSection() {
  return (
    <section className="bg-[#080d18] text-white py-20 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-3">The Set Up Your Place family</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Three platforms. One operating company.
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Set Up Your Place LLC builds a family of platforms — furnished-rental acquisition, automated
            trading, and a place to launch the businesses that never got built. Access Your Place came first,
            and taught us the lesson each one runs on: find the gap, and do the work others skip.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">

          {/* Access Your Place */}
          <div className="bg-gradient-to-b from-[#d4a574]/10 to-transparent border border-[#d4a574]/20 rounded-2xl p-8">
            <div className="text-xs font-mono text-[#d4a574] tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4a574]"></span>
              Access Your Place
            </div>
            <h3 className="text-xl font-bold mb-3">Furnished-Rental Acquisition</h3>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              The deal engine. Penny does the research and a certified team sources and closes furnished-rental
              deals across 30+ markets — landlord already approved. You own the operation.
            </p>
            <div className="space-y-2 mb-6">
              {['Landlord-approved deals', 'Acquisition & Setup Managers', 'Penny, the acquisition guide', 'A free knowledge library'].map(f => (
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
            <h3 className="text-xl font-bold mb-3">Automated Trading, run by Arbo</h3>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              An automated crypto-trading platform. Its AI, Arbo, runs disciplined strategies on the exchange
              accounts you connect — you keep custody and control, the automation does the work. The same
              operator mindset as AYP, pointed at the markets.
            </p>
            <div className="space-y-2 mb-6">
              {['Connects to your own exchange', 'Trade-only keys — never withdrawal', 'Automated, disciplined strategies', 'Arbo, the trading AI'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="w-1 h-1 rounded-full bg-[#5EEAD4]"></span>{f}
                </div>
              ))}
            </div>
            <a href="https://accessypflow.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-[#5EEAD4] hover:underline">
              accessypflow.com <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Access YP Labs */}
          <div className="bg-gradient-to-b from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-8">
            <div className="text-xs font-mono text-purple-400 tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              Access YP Labs
            </div>
            <h3 className="text-xl font-bold mb-3">The businesses the world never launched</h3>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              Where an idea becomes something you can own. Its AI, Clay, shapes a raw concept into a complete,
              pre-proven business — plan, research, a working demo, and a path to build it. The Exchange is a
              marketplace of unlaunched businesses to claim and grow.
            </p>
            <div className="space-y-2 mb-6">
              {['Clay shapes your idea into a business', 'Plan, research & a working demo', 'A real path to build it', 'The Exchange: businesses to claim'].map(f => (
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

        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm mb-4">One operating company. Three platforms that share the same roots.</p>
          <a href="tel:8138220610" className="inline-flex items-center gap-2 text-[#d4a574] hover:underline text-sm font-medium">
            Talk to the team: (813) 822-0610
          </a>
        </div>
      </div>
    </section>
  );
}
