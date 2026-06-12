import { Crown, Shield, Building2, CheckCircle, ArrowRight, Users, FileText, Lock } from 'lucide-react';

const benefits = [
  {
    icon: Shield,
    title: 'Landlord-Approved Compliance',
    description: 'All VIP subleases are structured with full landlord knowledge and approval, eliminating lease violation risks.'
  },
  {
    icon: Building2,
    title: 'YP Holds the Master Lease',
    description: 'We maintain the primary lease relationship with the property owner, providing an extra layer of security and professionalism.'
  },
  {
    icon: Users,
    title: 'You Operate, We Support',
    description: 'Maintain full operational control while paying the community directly. Your brand, your business, our backing.'
  },
  {
    icon: FileText,
    title: 'Transparent Documentation',
    description: 'Clear sublease agreements, compliance documentation, and landlord communications—all handled professionally.'
  }
];

const qualifications = [
  'Minimum 6-month operational history',
  'Verified positive guest reviews',
  'Clean compliance record',
  'Adequate insurance coverage',
  'Completed YP onboarding'
];

export default function VIPProgram() {
  return (
    <section className="py-20 bg-gradient-to-b from-[#0a0f1a] to-[#111827] relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4a574]/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#d4a574]/5 rounded-full blur-3xl"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#d4a574]/20 to-amber-500/20 border border-[#d4a574]/40 rounded-full px-5 py-2.5 mb-6">
            <Crown className="w-5 h-5 text-[#d4a574]" />
            <span className="text-sm text-[#d4a574] font-bold tracking-wide">VIP PROGRAM</span>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            VIP Corporate <span className="text-[#d4a574]">Sublease Program</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            The gold standard in compliant rental arbitrage. A landlord-approved structure 
            where YP holds the master lease and you maintain the operation.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Benefits */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6">Program Benefits</h3>
            {benefits.map((benefit, index) => (
              <div 
                key={index}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:border-[#d4a574]/30 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d4a574] to-[#c49464] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <benefit.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">{benefit.title}</h4>
                    <p className="text-gray-400 text-sm">{benefit.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* VIP Card */}
          <div>
            <div className="bg-gradient-to-br from-[#1a365d] to-[#0f172a] border border-[#d4a574]/30 rounded-2xl p-8 relative overflow-hidden">
              {/* Gold Corner Accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#d4a574]/20 to-transparent"></div>
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <Crown className="w-8 h-8 text-[#d4a574]" />
                  <div>
                    <h3 className="text-2xl font-bold text-white">VIP Status</h3>
                    <p className="text-[#d4a574] text-sm font-medium">Corporate Sublease Partner</p>
                  </div>
                </div>

                <div className="bg-black/30 rounded-xl p-6 mb-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#d4a574]" />
                    Qualification Requirements
                  </h4>
                  <ul className="space-y-3">
                    {qualifications.map((qual, index) => (
                      <li key={index} className="flex items-center gap-3 text-gray-300">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{qual}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-xl p-4 mb-6">
                  <p className="text-[#d4a574] text-sm font-medium text-center">
                    "Landlord-approved compliance structure for serious operators"
                  </p>
                </div>

                <a 
                  href="/investor/login" 
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-6 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-[#d4a574]/20 transition-all"
                >
                  Apply for VIP Status
                  <ArrowRight className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Trust Note */}
            <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium text-sm">Compliance Guarantee</p>
                  <p className="text-gray-400 text-xs mt-1">
                    All VIP sublease arrangements are fully documented and landlord-approved. 
                    We maintain transparent relationships with property owners.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="bg-gradient-to-r from-amber-900/30 to-[#d4a574]/20 border border-[#d4a574]/30 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">Ready to Elevate Your Operations?</h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Join our VIP Corporate Sublease Program and operate with the confidence of full landlord approval 
            and YP's institutional backing.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="https://calendly.com/investyourplaces" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#d4a574] text-[#0a0f1a] px-6 py-3 rounded-xl font-bold hover:bg-[#e5c9a8] transition-all"
            >
              Schedule VIP Consultation
              <ArrowRight className="w-4 h-4" />
            </a>
            <a 
              href="/knowledge-library" 
              className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-3 rounded-xl font-medium hover:bg-white/10 transition-all"
            >
              Learn More About VIP
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
