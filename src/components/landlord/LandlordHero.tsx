import { Building2, Shield, CheckCircle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LandlordHero() {
  const navigate = useNavigate();

  return (
    <section className="bg-gradient-to-br from-[#1a2332] via-[#243044] to-[#1a2332] text-white py-20 lg:py-28 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#d4a574] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#d4a574] rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#d4a574]/20 px-4 py-2 rounded-full mb-6">
            <Building2 className="w-5 h-5 text-[#d4a574]" />
            <span className="text-[#d4a574] font-medium">Corporate Leasing Partner Network</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Fill Your Vacancies with{' '}
            <span className="text-[#d4a574]">Corporate Reliability.</span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-4 leading-relaxed max-w-3xl mx-auto">
            We don't just find tenants. We partner with Landlords to install compliant, high-value business occupants.
          </p>

          <p className="text-lg text-gray-400 mb-10 leading-relaxed max-w-3xl mx-auto">
            You are tired of transient tenants, late rent, and uncertain screenings. We are the solution. 
            Access Your Place connects Property Owners and Apartment Communities with verified companies 
            looking for Corporate Leases.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={() => {
                const el = document.getElementById('landlord-inquiry');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-[#d4a574] text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-[#c49564] transition-all shadow-lg hover:shadow-xl"
            >
              Join Our Network
            </button>
            <button
              onClick={() => navigate('/landlord/login')}
              className="border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 transition-all"
            >
              Landlord Portal Login
            </button>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-[#d4a574]/40 transition-colors">
              <Shield className="w-10 h-10 text-[#d4a574] mb-4 mx-auto" />
              <h3 className="font-semibold text-lg mb-2">Verified Corporate Tenants</h3>
              <p className="text-gray-400 text-sm">We place businesses, not just individuals. Every tenant is pre-screened and verified.</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-[#d4a574]/40 transition-colors">
              <CheckCircle className="w-10 h-10 text-[#d4a574] mb-4 mx-auto" />
              <h3 className="font-semibold text-lg mb-2">Guaranteed Compliance</h3>
              <p className="text-gray-400 text-sm">We match your community rules with the right business model—Short-Term, Mid-Term, or Co-Living.</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-[#d4a574]/40 transition-colors">
              <TrendingUp className="w-10 h-10 text-[#d4a574] mb-4 mx-auto" />
              <h3 className="font-semibold text-lg mb-2">Streamlined Process</h3>
              <p className="text-gray-400 text-sm">One portal for applications, documents, and communication. Set it and forget it.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
