import { Users, FileText, Key, ArrowRight, CheckCircle, Sparkles, Building2, Handshake } from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Referral Network for Vetted Co-Hosts',
    description: 'Access our curated network of experienced property managers and co-hosts who have been vetted by our team.',
    benefits: ['Background-verified professionals', 'Performance-tracked partners', 'Market-specific expertise'],
  },
  {
    icon: FileText,
    title: 'Custom SOP Development',
    description: 'Build your operational playbook with professionally crafted standard operating procedures — Penny helps you shape them for your operation type and market.',
    benefits: ['Guest communication templates', 'Cleaning checklists', 'Maintenance protocols'],
  },
  {
    icon: Handshake,
    title: 'Brand Development Support',
    description: 'Establish your unique identity in the furnished-rental market with guidance from experienced operators.',
    benefits: ['Listing optimization', 'Review management strategies', 'Pricing consultation'],
  },
];

export default function BuildYourBrand() {
  return (
    <section className="py-20 bg-gradient-to-b from-[#111827] to-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-full px-4 py-2 mb-6">
              <Building2 className="w-4 h-4 text-[#d4a574]" />
              <span className="text-sm text-[#d4a574] font-medium">Build Your Brand</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              We Give You the Keys.<br />
              <span className="text-[#d4a574]">We Help You Build the Team.</span>
            </h2>

            <p className="text-lg text-gray-400 mb-6">
              Access Your Place provides the <span className="text-white font-semibold">Launch &amp; Setup</span>, not long-term management.
              We believe in empowering operators to build sustainable, independent businesses.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4a574] to-[#c49464] flex items-center justify-center flex-shrink-0">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Own Your Portfolio, Own Your Brand</h3>
                  <p className="text-gray-400">
                    Our mission is to set you up for success, then step back and let you run your business your way.
                    No ongoing management fees. No revenue sharing. Just pure ownership.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <a
                href="/setup-services"
                className="inline-flex items-center gap-2 bg-[#d4a574] text-[#0a0f1a] px-6 py-3 rounded-xl font-bold hover:bg-[#e5c9a8] transition-all"
              >
                Explore Setup Services
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="/knowledge-library"
                className="inline-flex items-center gap-2 border border-[#d4a574] text-[#d4a574] px-6 py-3 rounded-xl font-bold hover:bg-[#d4a574]/10 transition-all"
              >
                Free Resources
              </a>
            </div>
          </div>

          {/* Right Content - Feature Cards */}
          <div className="space-y-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-[#d4a574]/30 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400 text-sm mb-3">{feature.description}</p>
                    <ul className="space-y-1">
                      {feature.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-500">
                          <CheckCircle className="w-3 h-3 text-[#d4a574]" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="mt-16 bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] rounded-2xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[#d4a574]" />
            <span className="text-[#d4a574] font-semibold">Consulting Available</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Need Ongoing Support?</h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            While AYP doesn't manage properties, our Success Team can help you with setup services and connect
            you with vetted vendors from the operator network to scale your operation independently.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://calendly.com/investyourplaces"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-[#1a365d] px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all"
            >
              Schedule Consultation
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
