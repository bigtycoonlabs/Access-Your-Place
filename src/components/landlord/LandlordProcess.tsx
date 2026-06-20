import { ArrowRight, Building, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LandlordProcess() {
  const navigate = useNavigate();

  const steps = [
    { num: '01', title: 'Sign Up & Discovery Call', desc: 'Register through our portal and schedule a discovery call. We learn about your property, corporate leasing program, and specific requirements for tenants.' },
    { num: '02', title: 'Verification & Onboarding', desc: 'After our call, your account is verified and your dedicated Acquisition Manager is assigned. Upload your property rules, parking maps, and any community documents.' },
    { num: '03', title: 'Corporate Tenant Matching', desc: 'We match your property with pre-qualified companies from our vetted corporate client network. Only businesses that meet YOUR criteria are submitted.' },
    { num: '04', title: 'Application Review', desc: 'Review corporate applications directly in your Landlord Portal. Approve, request more info, or communicate with your AM—all in one place.' },
    { num: '05', title: 'Ongoing Partnership', desc: 'We remain your point of contact throughout the lease term. Your "Rules of Engagement" are documented so your AM never has to ask twice.' },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-4">Our Partnership Process</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">A straightforward approach to corporate leasing that respects your time and requirements.</p>
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-[#d4a574]/20 transition-all">
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-[#d4a574] to-[#c49564] rounded-xl flex items-center justify-center shadow-md">
                <span className="text-2xl font-bold text-white">{step.num}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-[#1a2332] mb-2">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.desc}</p>
              </div>
              {i < steps.length - 1 && <ArrowRight className="w-6 h-6 text-gray-300 hidden md:block self-center flex-shrink-0" />}
            </div>
          ))}
        </div>

        <div className="mt-16 grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#d4a574]/10 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-[#d4a574]" />
              </div>
              <h3 className="text-xl font-bold text-[#1a2332]">For Apartment Communities</h3>
            </div>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />Streamline your existing corporate leasing program</li>
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />Receive only qualified, compliant applicants</li>
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />Reduce administrative burden on your leasing team</li>
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />Fill units faster with reliable corporate tenants</li>
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />Manage sub-profiles for community-specific managers</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#d4a574]/10 rounded-lg flex items-center justify-center">
                <Home className="w-5 h-5 text-[#d4a574]" />
              </div>
              <h3 className="text-xl font-bold text-[#1a2332]">For Individual Landlords</h3>
            </div>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />Access corporate tenants without the complexity</li>
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />We handle tenant vetting and documentation</li>
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />Your property requirements are always respected</li>
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />Professional support throughout the process</li>
              <li className="flex items-start gap-3"><span className="w-1.5 h-1.5 bg-[#d4a574] rounded-full mt-2 flex-shrink-0" />Document your "Rules of Engagement" once—we remember</li>
            </ul>
          </div>
        </div>

        <div className="text-center mt-12">
          <button
            onClick={() => navigate('/landlord/login')}
            className="bg-[#1a2332] text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-[#243044] transition-all shadow-lg inline-flex items-center gap-2"
          >
            Access the Landlord Portal
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
