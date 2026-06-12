import { Building2, Users, Home, PartyPopper, Shield, CheckCircle, ArrowRight } from 'lucide-react';

export default function ProofSection() {
  const propertyTypes = [
    {
      icon: Home,
      title: 'Short-Term Rentals (STR)',
      description: 'High-turnover vacation and business travel properties with landlord-approved compliance structures.',
      count: '1,800+',
    },
    {
      icon: Users,
      title: 'Co-Living Spaces',
      description: 'Modern shared living arrangements for young professionals in urban markets. VIP sublease options available.',
      count: '950+',
    },
    {
      icon: Building2,
      title: 'Group Homes',
      description: 'Multi-bedroom properties for corporate housing, traveling nurses, and long-term group rentals.',
      count: '720+',
    },
    {
      icon: PartyPopper,
      title: 'Event Style Properties',
      description: 'Premium venues designed for weddings, retreats, photo shoots, and special occasions.',
      count: '230+',
    },
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-[#0a0f1a] to-[#111827]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-full px-4 py-2 mb-6">
            <Shield className="w-4 h-4 text-[#d4a574]" />
            <span className="text-sm text-[#d4a574] font-medium">Compliance-Driven Acquisition</span>
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">
            What We Do: <span className="text-[#d4a574]">Compliant Acquisition at Scale</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-4">
            We don't just find properties—we secure them compliantly. Our Success Team negotiates directly with landlords, ensuring every deal is approved and documented properly.
          </p>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            With 3,700+ properties launched across 64+ cities, we've mastered the art of landlord-approved rental arbitrage acquisition. We handle compliance, negotiations, and market analysis so you can focus on building your brand.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {propertyTypes.map((type, idx) => {
            const Icon = type.icon;
            return (
              <div key={idx} className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-xl hover:border-[#d4a574]/30 transition-all group">
                <Icon size={40} className="text-[#d4a574] mb-4 group-hover:scale-110 transition-transform" />
                <div className="text-3xl font-bold text-[#d4a574] mb-2">{type.count}</div>
                <h3 className="text-lg font-bold text-white mb-3">{type.title}</h3>
                <p className="text-gray-400 text-sm">{type.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white p-8 rounded-2xl border border-[#d4a574]/20">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-4">
                Ready to leverage our 5+ years of compliant acquisition expertise?
              </h3>
              <p className="text-gray-300 mb-6">
                Our acquisition services give you access to our entire compliance infrastructure, YP Approved deals, and proven negotiation strategies.
              </p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>YP Approved deals eligible for credits up to $12k</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Full compliance documentation included</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Success Team handles all landlord negotiations</span>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <a
                href="/investor/login"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-8 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-[#d4a574]/20 transition-all"
              >
                Start Your Evaluation
                <ArrowRight className="w-5 h-5" />
              </a>
              <p className="text-gray-400 text-sm mt-4">
                Fund your account to unlock full property details
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
