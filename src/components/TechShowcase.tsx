import { Shield, Users, BarChart3, Lock, CheckCircle, ArrowRight, Gift } from 'lucide-react';

const features = [
  { icon: Lock, title: 'Address Protection', desc: 'Full details released after funding to protect landlord relationships' },
  { icon: Users, title: 'Success Team', desc: 'Dedicated managers handle negotiations and due diligence' },
  { icon: BarChart3, title: 'Vetted Deals', desc: 'Every property checked for compliance before release' },
  { icon: Gift, title: 'Referral Program', desc: 'Earn 20% commission on property referrals or $300 for client referrals' },
];

export default function TechShowcase() {
  return (
    <section className="py-16 bg-gradient-to-b from-[#0a0f1a] to-[#111827]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            How It Works
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            We handle the hard stuff so you can focus on running your operation.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {features.map((feature, i) => (
            <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:border-[#d4a574]/30 transition-all">
              <div className="w-10 h-10 bg-gradient-to-br from-[#d4a574] to-[#c49564] rounded-lg flex items-center justify-center mb-3">
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Simple CTA */}
        <div className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] rounded-xl p-6 md:p-8 text-white border border-[#d4a574]/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-bold mb-2">Ready to find your next deal?</h3>
              <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Landlord-approved
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Compliance-first
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Expert support
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <a href="/deals" className="bg-[#d4a574] text-[#0a0f1a] px-6 py-3 rounded-lg font-bold hover:bg-[#e5b685] transition-colors flex items-center gap-2">
                View Deals
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
