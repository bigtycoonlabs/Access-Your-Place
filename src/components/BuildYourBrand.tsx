import { Users, FileText, Key, ArrowRight, CheckCircle, Sparkles, Building2, Handshake, Code, Headphones, GraduationCap, ExternalLink } from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Referral Network for Vetted Co-Hosts',
    description: 'Access our curated network of experienced property managers and co-hosts who have been vetted by our team.',
    benefits: ['Background-verified professionals', 'Performance-tracked partners', 'Market-specific expertise'],
    provider: 'AYP Network'
  },
  {
    icon: FileText,
    title: 'Custom SOP Development',
    description: 'Build your operational playbook with professionally crafted standard operating procedures through our sister company.',
    benefits: ['Guest communication templates', 'Cleaning checklists', 'Maintenance protocols'],
    provider: 'TycoonLabs'
  },
  {
    icon: Handshake,
    title: 'Brand Development Support',
    description: 'Establish your unique identity in the short-term rental market with guidance from industry experts.',
    benefits: ['Listing optimization', 'Review management strategies', 'Pricing consultation'],
    provider: 'AYP Network'
  }
];

const tycoonLabsServices = [
  {
    icon: FileText,
    title: 'Standard Operating Procedures',
    description: 'Custom SOPs built for your specific operation type and market'
  },
  {
    icon: Headphones,
    title: 'Virtual Assistance',
    description: 'Trained VAs for guest communication, booking management, and admin tasks'
  },
  {
    icon: Users,
    title: 'Staffing & Hiring',
    description: 'Recruit, vet, and train cleaners, maintenance staff, and local teams'
  },
  {
    icon: GraduationCap,
    title: 'Training Programs',
    description: 'Comprehensive training for your team on hospitality best practices'
  },
  {
    icon: Code,
    title: 'Custom Applications',
    description: 'Full React Native web applications built for your unique operational needs'
  },
  {
    icon: Headphones,
    title: 'Ongoing Support',
    description: 'Dedicated support teams to help scale your operation efficiently'
  }
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
              <span className="text-[#d4a574]">We Help You Hire the Team.</span>
            </h2>
            
            <p className="text-lg text-gray-400 mb-6">
              Access Your Place provides the <span className="text-white font-semibold">Launch & Setup</span>, not long-term management. 
              We believe in empowering investors to build sustainable, independent operations.
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
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                      {feature.provider === 'TycoonLabs' && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                          via TycoonLabs
                        </span>
                      )}
                    </div>
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

        {/* TycoonLabs Sister Company Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400 font-medium">Sister Company Partnership</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Powered by <span className="text-purple-400">TycoonLabs</span>
            </h3>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto">
              Access Your Place partners with our sister company, <strong className="text-white">TycoonLabs</strong>, 
              for operational infrastructure services. While AYP focuses on acquisition and launch, TycoonLabs 
              handles the tools you need to scale your operation independently.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {tycoonLabsServices.map((service, index) => (
              <div 
                key={index}
                className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/40 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                  <service.icon className="w-5 h-5 text-purple-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">{service.title}</h4>
                <p className="text-sm text-gray-400">{service.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-purple-900/30 to-purple-800/20 border border-purple-500/30 rounded-2xl p-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-purple-400">TL</span>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">TycoonLabs</h4>
                  <p className="text-gray-400">bigggtycoon.net</p>
                </div>
              </div>
              <div className="text-center lg:text-left flex-1 lg:px-8">
                <p className="text-gray-300">
                  TycoonLabs works closely with the AYP Success Team to deliver SOPs, staffing, virtual assistance, 
                  training, and custom technology solutions for our clients' operations.
                </p>
              </div>
              <a 
                href="https://bigggtycoon.net" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-purple-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-600 transition-all whitespace-nowrap"
              >
                Visit TycoonLabs
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              TycoonLabs is a separate entity from Access Your Place. Services provided by TycoonLabs are subject to their own terms and agreements. 
              AYP Success Team coordinates deliverables but TycoonLabs maintains independent service relationships with clients.
            </p>
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
            While AYP doesn't manage properties, our Success Team can connect you with TycoonLabs for 
            operational infrastructure, staffing solutions, and custom technology development.
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
            <a 
              href="https://bigggtycoon.net" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-purple-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-600 transition-all"
            >
              Explore TycoonLabs
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
