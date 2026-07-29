import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

// Slimmed from a second full hero into a compact proof band: real numbers, the
// three things that make an AYP deal different, and the primary CTAs. The old
// "You shouldn't need permission..." headline is gone.
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

  const stats = [
    { value: counts.rentals, label: 'Properties launched', suffix: '+' },
    { value: counts.clients, label: 'Operators', suffix: '+' },
    { value: counts.cities, label: 'Markets', suffix: '+' },
    { value: counts.years, label: 'Years', suffix: '' },
  ];

  return (
    <section aria-labelledby="proof-heading" className="border-y border-white/10 bg-[#0a0f1a] px-6 py-14">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 id="proof-heading" className="text-2xl font-bold leading-tight text-white sm:text-3xl">
            Five years in. Real operators, real deals,{' '}
            <span className="text-[#d4a574]">landlord already approved.</span>
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-gray-400">
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />Landlord-approved deals
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#d4a574]" aria-hidden="true" />Certified Acquisition Managers
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-400" aria-hidden="true" />Real market data
            </span>
          </div>
        </div>

        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3 text-center backdrop-blur-sm">
              <div className="text-xl font-bold text-[#d4a574] md:text-2xl">
                {s.value}
                {s.suffix}
              </div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            to="/deals"
            className="group flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#d4a574] to-[#c49464] px-8 py-4 font-bold text-[#0a0f1a] transition-all hover:shadow-lg hover:shadow-[#d4a574]/20"
          >
            View Available Deals
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/landlord-partnership"
            className="rounded-xl border-2 border-[#d4a574] px-8 py-4 text-center font-bold text-[#d4a574] transition-all hover:bg-[#d4a574]/10"
          >
            Landlord Partners: Fill Vacancies
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Prefer to talk?{' '}
          <a href="tel:8138220610" className="inline-flex items-center gap-1 text-[#5EEAD4] hover:underline">
            <Phone className="h-3 w-3" aria-hidden="true" />
            Call the team: (813) 822-0610
          </a>
        </p>
      </div>
    </section>
  );
}
