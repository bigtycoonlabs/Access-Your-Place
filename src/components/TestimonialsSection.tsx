import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Shield } from 'lucide-react';

export default function TestimonialsSection() {
  const [current, setCurrent] = useState(0);

  const testimonials = [
    { name: 'Sarah Johnson', location: 'Austin, TX', text: 'Access Your Place helped me launch 3 compliant STR properties in 6 months. Their landlord-approved approach gave me peace of mind from day one.', rating: 5 },
    { name: 'Michael Chen', location: 'Miami, FL', text: 'The Success Team found deals I never would have discovered on my own. Now running 5 co-living spaces with consistent cash flow and full compliance.', rating: 5 },
    { name: 'Emily Rodriguez', location: 'Phoenix, AZ', text: 'From complete beginner to successful rental arbitrage investor in under a year. The compliance-first approach sets them apart.', rating: 5 },
    { name: 'David Thompson', location: 'Denver, CO', text: 'The YP Approved deals are worth their weight in gold. Every property comes with full documentation and landlord approval.', rating: 5 },
    { name: 'Jessica Martinez', location: 'San Diego, CA', text: 'Best investment I made was working with Access Your Place. They handle negotiations, compliance, and setup. True professionals.', rating: 5 },
    { name: 'Robert Lee', location: 'Nashville, TN', text: 'Their VIP Corporate Sublease Program changed everything. Full landlord approval and institutional backing. Game changer.', rating: 5 },
  ];

  const next = () => setCurrent((current + 1) % testimonials.length);
  const prev = () => setCurrent((current - 1 + testimonials.length) % testimonials.length);

  return (
    <section className="py-16 bg-gradient-to-b from-[#111827] to-[#0a0f1a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-full px-4 py-2 mb-4">
            <Shield className="w-4 h-4 text-[#d4a574]" />
            <span className="text-sm text-[#d4a574] font-medium">Investor Success Stories</span>
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">What Our <span className="text-[#d4a574]">Investors</span> Say</h2>
          <p className="text-xl text-gray-400">Real results from compliant operations</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 relative">
          <div className="flex mb-4">
            {[...Array(testimonials[current].rating)].map((_, i) => (
              <Star key={i} size={24} className="text-[#d4a574] fill-current" />
            ))}
          </div>
          
          <p className="text-xl text-gray-300 mb-6 italic">"{testimonials[current].text}"</p>
          
          <div className="font-semibold text-white">{testimonials[current].name}</div>
          <div className="text-gray-400">{testimonials[current].location}</div>

          <div className="flex justify-between mt-8">
            <button onClick={prev} className="bg-[#1a365d] text-white p-3 rounded-full hover:bg-[#2d4a7c] transition-colors">
              <ChevronLeft size={24} />
            </button>
            <button onClick={next} className="bg-[#1a365d] text-white p-3 rounded-full hover:bg-[#2d4a7c] transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        <div className="flex justify-center mt-6 space-x-2">
          {testimonials.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`w-3 h-3 rounded-full transition-colors ${idx === current ? 'bg-[#d4a574]' : 'bg-gray-600'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
