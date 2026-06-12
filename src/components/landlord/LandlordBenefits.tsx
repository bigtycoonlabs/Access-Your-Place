import { CheckCircle, FileCheck, Clock, Shield, Users, Building, Award, Handshake, Eye } from 'lucide-react';

export default function LandlordBenefits() {
  const benefits = [
    { icon: Shield, title: 'Verified Corporate Tenants', desc: 'We place businesses, not just individuals. Every company is vetted, documented, and ready to comply with your lease terms.' },
    { icon: CheckCircle, title: 'Guaranteed Compliance', desc: 'We match your community rules with the right business model. No surprises, no violations, no headaches.' },
    { icon: Handshake, title: 'Dedicated Account Manager', desc: 'One point of contact who knows your property inside and out. No more repeating yourself to different reps.' },
    { icon: FileCheck, title: 'Pre-Screened Applications', desc: 'All corporate clients complete full documentation before submission. No incomplete applications hitting your desk.' },
    { icon: Clock, title: 'Reduced Vacancy Time', desc: 'Our ready-to-apply corporate tenants mean faster lease signings and quicker occupancy for your units.' },
    { icon: Eye, title: 'Full Transparency', desc: 'Track applications, review documents, and communicate with your AM—all through your dedicated Landlord Portal.' },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Standard of Truth Promise */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#d4a574]/10 px-4 py-2 rounded-full mb-4">
            <Award className="w-5 h-5 text-[#d4a574]" />
            <span className="text-[#d4a574] font-semibold text-sm uppercase tracking-wide">The "Standard of Truth" Promise</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-4">
            Why Partner With Access Your Place?
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg">
            We are not a lead generation site. We are an operational partner. When you join our network, you get:
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {benefits.map((benefit, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-6 hover:shadow-lg transition-all border border-gray-100 hover:border-[#d4a574]/30 group">
              <div className="w-12 h-12 bg-[#d4a574]/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#d4a574]/20 transition-colors">
                <benefit.icon className="w-6 h-6 text-[#d4a574]" />
              </div>
              <h3 className="text-xl font-semibold text-[#1a2332] mb-2">{benefit.title}</h3>
              <p className="text-gray-600 leading-relaxed">{benefit.desc}</p>
            </div>
          ))}
        </div>

        {/* How We Protect Your Community */}
        <div className="bg-gradient-to-r from-[#1a2332] to-[#243044] rounded-2xl p-8 md:p-12 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-bold mb-4">How We Protect Your Community</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Our acquisition managers take time to understand each landlord's and community's unique requirements—rules, 
              preferences, likes, and dislikes regarding corporate tenants. We only submit companies that meet your specific 
              criteria. This eliminates repeat conversations, prevents mismatched placements, and ensures every corporate 
              tenant understands their responsibilities before they apply.
            </p>
            <div className="grid sm:grid-cols-3 gap-6 mt-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#d4a574]">100%</div>
                <div className="text-sm text-gray-400 mt-1">Pre-Screened Applicants</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#d4a574]">24hr</div>
                <div className="text-sm text-gray-400 mt-1">Application Response Time</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#d4a574]">1</div>
                <div className="text-sm text-gray-400 mt-1">Dedicated Point of Contact</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
