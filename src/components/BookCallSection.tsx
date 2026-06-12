import { Calendar, CheckCircle, Shield, Users, ArrowRight } from 'lucide-react';

export default function BookCallSection() {
  const benefits = [
    'Personalized acquisition strategy review',
    'Discussion of YP Approved deals in your target markets',
    'Explanation of the compliance-driven process',
    'Introduction to your dedicated Success Team',
    'Q&A with our expert acquisition managers',
  ];

  const handleBookCall = () => {
    window.open('https://calendly.com/investyourplaces', '_blank');
  };

  return (
    <section id="book-call" className="py-20 bg-gradient-to-br from-[#0a0f1a] to-[#111827] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-full px-4 py-2 mb-6">
              <Users className="w-4 h-4 text-[#d4a574]" />
              <span className="text-sm text-[#d4a574] font-medium">Success Team</span>
            </div>
            
            <h2 className="text-4xl font-bold mb-6">
              Book Your <span className="text-[#d4a574]">Discovery Call</span>
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Ready to start your compliant acquisition journey? Let's discuss how our Success Team can help you build your portfolio the right way.
            </p>
            
            <div className="space-y-4">
              {benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-start">
                  <CheckCircle size={20} className="text-green-500 mr-3 flex-shrink-0 mt-1" />
                  <span className="text-gray-300">{benefit}</span>
                </div>
              ))}
            </div>
            
            {/* Trust Note */}
            <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-[#d4a574] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium text-sm">Compliance Guarantee</p>
                  <p className="text-gray-400 text-xs mt-1">
                    All acquisitions follow our landlord-approved compliance structure. No unauthorized outreach—ever.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-gray-50 text-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#d4a574] to-[#c49464] rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[#0a0f1a] mb-2">Schedule Your Call</h3>
              <p className="text-gray-600">Choose a time that works best for you</p>
            </div>

            <button 
              onClick={handleBookCall}
              className="w-full bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-[#d4a574]/20 transition-all text-lg flex items-center justify-center gap-2"
            >
              Book My Discovery Call
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Free, no-obligation consultation</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>30-minute strategy session</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mt-6">
              We respect your privacy. Your information is never shared.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
