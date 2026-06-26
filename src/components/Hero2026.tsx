import { useEffect, useState } from 'react';
import { Shield, ArrowRight, CheckCircle, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Hero2026() {
  const [counts, setCounts] = useState({ rentals: 0, cities: 0, years: 0, clients: 0 });

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

  return (
    <section className="bg-gradient-to-br from-[#0a0f1a] via-[#111827] to-[#0a0f1a] text-white py-20 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
      
      {/* Gradient Orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#d4a574]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#d4a574]/5 rounded-full blur-3xl"></div>
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-10">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest text-[#5EEAD4] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5EEAD4] animate-pulse"></span>
            Penny · Market Intelligence AI
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              You Shouldn't Need Permission
            </span>
            <br />
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              to Build
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#d4a574] via-[#e5c9a8] to-[#d4a574] bg-clip-text text-transparent">
              Something of Your Own.
            </span>
          </h1>
          
          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-4 leading-relaxed">
            Every year, it gets harder for an individual to break into housing — tighter credit requirements, closed-door landlord relationships, institutions with the inside track.
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            Access Your Place gives that access back. We give you the engine, the network, and the certified team to build a flexible housing portfolio that's actually yours.
          </p>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Landlord-Approved Deals</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#d4a574]" />
              <span>Certified Acquisition Managers</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              <span>Real Market Data — Not Platform Scrapes</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto mb-10">
          {[
            { value: counts.rentals, label: 'Properties', suffix: '+' },
            { value: counts.clients, label: 'Investors', suffix: '+' },
            { value: counts.cities, label: 'Markets', suffix: '+' },
            { value: counts.years, label: 'Years', suffix: '' }
          ].map((stat, i) => (
            <div key={i} className="text-center p-3 bg-white/5 rounded-lg backdrop-blur-sm border border-white/10">
              <div className="text-xl md:text-2xl font-bold text-[#d4a574]">{stat.value}{stat.suffix}</div>
              <div className="text-xs text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Link
            to="/deals"
            className="group bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-8 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-[#d4a574]/20 transition-all flex items-center justify-center gap-3"
          >
            Create Your Account
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/landlord-partnership"
            className="border-2 border-[#d4a574] text-[#d4a574] px-8 py-4 rounded-xl font-bold hover:bg-[#d4a574]/10 transition-all text-center"
          >
            Real Estate Partners: Fill Vacancies
          </Link>
        </div>

        {/* Penny CTA */}
        <p className="text-center text-sm text-gray-500">
          Prefer to talk it through?{' '}
          <a href="tel:8133039110" className="text-[#5EEAD4] hover:underline inline-flex items-center gap-1">
            <Phone className="w-3 h-3" />
            Call Penny: (813) 303-9110
          </a>
        </p>
      </div>
    </section>
  );
}

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

  return (
    <section className="bg-gradient-to-br from-[#0a0f1a] via-[#111827] to-[#0a0f1a] text-white py-20 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
      
      {/* Gradient Orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#d4a574]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#d4a574]/5 rounded-full blur-3xl"></div>
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-10">
          {/* Main Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              Find Your Next
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#d4a574] via-[#e5c9a8] to-[#d4a574] bg-clip-text text-transparent">
              Rental Arbitrage Deal
            </span>
          </h1>
          
          {/* Subheadline - More casual */}
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-4 leading-relaxed">
            We find the deals. You build your brand.
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            Pre-vetted, landlord-approved properties ready for your STR or co-living operation.
          </p>

          {/* Trust Indicators - Simplified */}
          <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Landlord-Approved</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#d4a574]" />
              <span>Compliance-First</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              <span>Expert Support</span>
            </div>
          </div>
        </div>

        {/* Stats Grid - Compact */}
        <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto mb-10">
          {[
            { value: counts.rentals, label: 'Properties', suffix: '+' },
            { value: counts.clients, label: 'Investors', suffix: '+' },
            { value: counts.cities, label: 'Markets', suffix: '+' },
            { value: counts.years, label: 'Years', suffix: '' }
          ].map((stat, i) => (
            <div key={i} className="text-center p-3 bg-white/5 rounded-lg backdrop-blur-sm border border-white/10">
              <div className="text-xl md:text-2xl font-bold text-[#d4a574]">{stat.value}{stat.suffix}</div>
              <div className="text-xs text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a 
            href="/deals" 
            className="group bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-8 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-[#d4a574]/20 transition-all flex items-center justify-center gap-3"
          >
            Browse Deals
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a 
            href="/investor/login" 
            className="border-2 border-[#d4a574] text-[#d4a574] px-8 py-4 rounded-xl font-bold hover:bg-[#d4a574]/10 transition-all text-center"
          >
            Investor Login
          </a>
        </div>
      </div>
    </section>
  );
}
