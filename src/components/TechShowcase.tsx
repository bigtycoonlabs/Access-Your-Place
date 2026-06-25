import { Shield, Users, BarChart3, Lock, CheckCircle, ArrowRight, Search, BriefcaseBusiness, FileCheck } from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Penny Market Research',
    desc: 'Penny scores opportunities from 0-100 across demand, supply, regulation, and economics before a property can move forward.'
  },
  {
    icon: BarChart3,
    title: 'Qualified Deal Flow',
    desc: 'Properties under a 50 Penny Score do not qualify for public listing because they fail minimum slow-season economics.'
  },
  {
    icon: Lock,
    title: 'Funded Account Address Access',
    desc: 'Public marketplace cards hide exact addresses. Funded operator accounts unlock the internal marketplace with full details.'
  },
  {
    icon: Users,
    title: 'Human Acquisition Support',
    desc: 'Acquisition managers guide deal selection while the success team handles screening, compliance, and sensitive documents.'
  },
];

const steps = [
  'Research markets with Penny and review qualified opportunities.',
  'Create one operator client account for investor-stage and active operator workflows.',
  'Work with an acquisition manager to review recommendations and start acquisition.',
  'Move completed acquisitions into the portfolio where Penny can track trends and seasonality.'
];

export default function TechShowcase() {
  return (
    <section className="py-16 bg-gradient-to-b from-[#0a0f1a] to-[#111827]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 items-start mb-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d4a574]/30 bg-[#d4a574]/10 px-4 py-2 text-sm font-medium text-[#e8c99d] mb-5">
              <BriefcaseBusiness className="w-4 h-4" />
              Built for flexible housing operators
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              A technology opportunity suite for real estate access.
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Access Your Place combines market research, acquisition support, operator education, deal intelligence, vendor resources, and portfolio tools into one platform. Investors and operators use one client account; staff login remains separate.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-[#d4a574]/30 transition-all">
                <div className="w-11 h-11 bg-gradient-to-br from-[#d4a574] to-[#c49564] rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-[#0a0f1a]" />
                </div>
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/[0.04] rounded-3xl border border-white/10 p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">From research to live portfolio.</h3>
              <p className="text-slate-400 leading-relaxed">
                The platform keeps the current acquisition and portfolio workflows intact while making the experience cleaner, more data-forward, and easier to navigate.
              </p>
            </div>
            <a href="/investor/login?tab=register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d4a574] text-[#0a0f1a] px-6 py-3 font-bold hover:bg-[#e5b685] transition-colors">
              Start Client Access
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mt-8">
            {steps.map((step, index) => (
              <div key={step} className="rounded-2xl bg-[#0a0f1a]/60 border border-white/10 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-[#d4a574]">0{index + 1}</span>
                  {index === steps.length - 1 ? <FileCheck className="w-5 h-5 text-emerald-400" /> : <CheckCircle className="w-5 h-5 text-[#d4a574]" />}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
