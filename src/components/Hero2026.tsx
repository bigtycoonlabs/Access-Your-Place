import { useEffect, useState } from 'react';
import { Shield, ArrowRight, CheckCircle, BarChart3, Lock, Search } from 'lucide-react';

export default function Hero2026() {
  const [counts, setCounts] = useState({ rentals: 0, cities: 0, years: 0, clients: 0 });
  const [pennyInput, setPennyInput] = useState('');
  const [pennyMessage, setPennyMessage] = useState('');

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    const targets = { rentals: 3700, cities: 30, years: 5, clients: 1100 };
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCounts({
        rentals: Math.floor((targets.rentals / steps) * step),
        cities: Math.floor((targets.cities / steps) * step),
        years: Math.floor((targets.years / steps) * step),
        clients: Math.floor((targets.clients / steps) * step),
      });
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, []);

  const handlePennySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = pennyInput.trim();
    if (!value) {
      setPennyMessage('Enter a ZIP code, city, or property address to start a Penny market scan.');
      return;
    }

    const hasUsedPublicScan = localStorage.getItem('ayp_public_penny_scan_used') === 'true';
    if (hasUsedPublicScan) {
      setPennyMessage('Create a free operator account to keep using Penny market research.');
      window.setTimeout(() => {
        window.location.href = '/investor/login?tab=register&penny=continue';
      }, 900);
      return;
    }

    localStorage.setItem('ayp_public_penny_scan_used', 'true');
    setPennyMessage(`Penny is preparing a market scan for ${value}. Create an account to save reports, run unlimited scans, and review qualified opportunities.`);
  };

  return (
    <section className="bg-[#0a0f1a] text-white py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,165,116,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_32%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:48px_48px] opacity-20" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d4a574]/30 bg-[#d4a574]/10 px-4 py-2 text-sm font-medium text-[#e8c99d] mb-7">
              <BarChart3 className="w-4 h-4" />
              Penny-powered flexible housing intelligence
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
              Real estate should have
              <span className="block text-[#d4a574]">more than one way in.</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed mb-5">
              Access Your Place helps operator clients move past the traditional barriers of credit thresholds, large down payments, mortgage friction, and closed-door real estate relationships.
            </p>
            <p className="text-base md:text-lg text-slate-400 max-w-3xl leading-relaxed mb-8">
              Our consultancy and technology suite powers flexible housing operators with qualified opportunities, Penny market research, acquisition support, setup resources, and a platform built to help teams scale faster across short-term rental, mid-term rental, and shared living models.
            </p>

            <div className="flex flex-wrap gap-3 mb-9 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/7 border border-white/10 px-3 py-2"><CheckCircle className="w-4 h-4 text-emerald-400" />Operator-first access</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/7 border border-white/10 px-3 py-2"><Shield className="w-4 h-4 text-[#d4a574]" />Compliance-aware acquisitions</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/7 border border-white/10 px-3 py-2"><Lock className="w-4 h-4 text-blue-300" />Addresses protected until funded</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/deals"
                className="group bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-7 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-[#d4a574]/20 transition-all flex items-center justify-center gap-3"
              >
                View Public Marketplace
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="/investor/login?tab=register"
                className="border border-white/20 bg-white/5 text-white px-7 py-4 rounded-xl font-bold hover:bg-white/10 transition-all text-center"
              >
                Create Operator Account
              </a>
            </div>
          </div>

          <div className="bg-white text-slate-950 rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
            <div className="p-6 md:p-7 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#b6844f] font-bold mb-2">Penny Research</p>
                  <h2 className="text-2xl font-bold text-slate-950">Run a free market scan.</h2>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#0a0f1a] text-[#d4a574] flex items-center justify-center">
                  <Search className="w-6 h-6" />
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Type a ZIP code, city, or address to preview Penny's data-forward approach to corporate lease opportunities. Public users receive one free scan before account creation is required for continued free use.
              </p>
            </div>

            <form onSubmit={handlePennySubmit} className="p-6 md:p-7 space-y-4">
              <label htmlFor="penny-location" className="block text-sm font-semibold text-slate-700">
                ZIP code, city, or address
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="penny-location"
                  value={pennyInput}
                  onChange={(event) => setPennyInput(event.target.value)}
                  placeholder="Example: Tampa, FL 33602"
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                />
                <button type="submit" className="rounded-xl bg-[#0a0f1a] text-white px-5 py-3 font-bold hover:bg-[#172033] transition-colors">
                  Scan
                </button>
              </div>
              {pennyMessage && (
                <div className="rounded-xl border border-[#d4a574]/30 bg-[#d4a574]/10 px-4 py-3 text-sm text-slate-700" role="status">
                  {pennyMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-3">
                {[
                  ['Demand', 'Hotel and STR occupancy signals'],
                  ['Supply', 'Competition and saturation'],
                  ['Regulation', 'License and compliance checks'],
                  ['Economics', '$1,000+ slow-season viability'],
                ].map(([title, detail]) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-bold text-slate-950">{title}</div>
                    <div className="text-xs text-slate-500 mt-1">{detail}</div>
                  </div>
                ))}
              </div>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mt-14">
          {[
            { value: counts.rentals, label: 'Properties reviewed', suffix: '+' },
            { value: counts.clients, label: 'Operator clients', suffix: '+' },
            { value: counts.cities, label: 'Markets tracked', suffix: '+' },
            { value: counts.years, label: 'Years of data', suffix: '' }
          ].map((stat) => (
            <div key={stat.label} className="text-center p-4 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/10">
              <div className="text-2xl md:text-3xl font-bold text-[#d4a574]">{stat.value}{stat.suffix}</div>
              <div className="text-xs md:text-sm text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
