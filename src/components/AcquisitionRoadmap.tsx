import { DollarSign, MapPin, Users, Key, ArrowRight, CheckCircle, Shield } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: DollarSign,
    title: 'Fund Account',
    description: 'Pay the activation fee or deposit to show intent and unlock deal access.',
    details: ['Secure payment processing', 'Refundable deposit options', 'Instant account activation'],
    color: 'from-emerald-500 to-emerald-600'
  },
  {
    number: '02',
    icon: MapPin,
    title: 'Address Release',
    description: 'Full property data and Penny AI market analysis unlocked for deep evaluation.',
    details: ['Complete property details', 'AI-powered market analysis', 'Revenue projections'],
    color: 'from-blue-500 to-blue-600'
  },
  {
    number: '03',
    icon: Users,
    title: 'Application & Mediation',
    description: 'YP Success Team handles corporate screening and landlord negotiation.',
    details: ['Corporate application prep', 'Landlord negotiations', 'Lease term optimization'],
    color: 'from-purple-500 to-purple-600'
  },
  {
    number: '04',
    icon: Key,
    title: 'Launch & Handover',
    description: 'Final acquisition agreement signed and property keys/bookings transferred.',
    details: ['Legal documentation', 'Key handover coordination', 'Booking platform setup'],
    color: 'from-[#d4a574] to-[#c49464]'
  }
];

export default function AcquisitionRoadmap() {
  return (
    <section className="py-20 bg-gradient-to-b from-[#0a0f1a] to-[#111827]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-full px-4 py-2 mb-6">
            <Shield className="w-4 h-4 text-[#d4a574]" />
            <span className="text-sm text-[#d4a574] font-medium">The Acquisition Engine</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Your Path to <span className="text-[#d4a574]">Compliant Ownership</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            A structured, transparent process designed to protect both investors and landlords at every step.
          </p>
        </div>

        {/* Desktop Roadmap */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Connection Line */}
            <div className="absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-blue-500 via-purple-500 to-[#d4a574] opacity-30"></div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <div key={index} className="relative">
                  {/* Step Card */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-[#d4a574]/50 transition-all duration-300 group">
                    {/* Step Number */}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <step.icon className="w-6 h-6 text-white" />
                    </div>
                    
                    {/* Step Number Badge */}
                    <div className="absolute top-4 right-4 text-4xl font-bold text-white/5 group-hover:text-white/10 transition-colors">
                      {step.number}
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-gray-400 text-sm mb-4">{step.description}</p>
                    
                    {/* Details List */}
                    <ul className="space-y-2">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-500">
                          <CheckCircle className="w-3 h-3 text-[#d4a574]" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Arrow Connector */}
                  {index < steps.length - 1 && (
                    <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <ArrowRight className="w-6 h-6 text-[#d4a574]/50" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Roadmap */}
        <div className="lg:hidden space-y-6">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0`}>
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">{step.title}</h3>
                      <span className="text-2xl font-bold text-white/10">{step.number}</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{step.description}</p>
                    <ul className="space-y-1">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
                          <CheckCircle className="w-3 h-3 text-[#d4a574]" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Vertical Connector */}
              {index < steps.length - 1 && (
                <div className="flex justify-center py-2">
                  <div className="w-0.5 h-6 bg-gradient-to-b from-[#d4a574]/50 to-transparent"></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a 
            href="/investor/login" 
            className="inline-flex items-center gap-2 bg-[#d4a574] text-[#0a0f1a] px-8 py-4 rounded-xl font-bold hover:bg-[#e5c9a8] transition-all"
          >
            Begin Your Acquisition Journey
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
}
