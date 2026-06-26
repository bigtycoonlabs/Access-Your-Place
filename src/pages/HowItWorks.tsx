import { ArrowLeft, CheckCircle, Users, Wrench, Star, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';
import { useState } from 'react';

const faqs = [
  {
    q: 'What is rental arbitrage, really?',
    a: 'You lease a property long-term and operate it as a short-term rental, mid-term corporate stay, or co-living space — generating margin between your lease cost and rental income. It\'s a different strategy from buying real estate outright, and it\'s still a specialized, niche approach that most investors haven\'t been exposed to.',
  },
  {
    q: 'Do you guarantee any returns?',
    a: 'No — and we never will. We give you data-backed, research-driven projections on every deal, built from raw micro-market indices. Real estate and booking platforms fluctuate. We project; we don\'t promise.',
  },
  {
    q: 'Do I need real estate experience?',
    a: 'No prior experience required. Your Acquisition Manager and Setup Manager are trained across all four certification pillars to guide you from sourcing through launch.',
  },
  {
    q: 'What does a Setup Manager actually handle?',
    a: 'Setup Managers handle logistics on furnished and unfurnished properties alike — furniture, decor, refresher packages, housekeeping coordination, Wi-Fi setup, maintenance matching, and connecting you to the right vendors and software. Many of our Acquisition Managers are dual-certified, so you may work with the same specialist end to end.',
  },
  {
    q: 'Why can\'t I just learn this from a course?',
    a: 'Most courses teach you to list a unit on Airbnb — they don\'t get you a landlord relationship. Corporate property managers generally won\'t engage an unknown individual cold-messaging them about a short-term rental. Closing a Master Lease takes a network with standing relationships, which is what an Acquisition Manager actually brings to the table.',
  },
  {
    q: 'Is Penny a chatbot I\'m stuck talking to?',
    a: 'No. Penny is our market intelligence AI — one of several specialized AI tools built across the Set Up Your Place / AYP Enterprise — and she\'s focused specifically on real historical short-term and mid-term rental performance data, not general conversation. You can call her line to ask how we work or get scheduled, but a real Acquisition Manager follows up and runs your deal.',
  },
  {
    q: 'What happens after I call to schedule?',
    a: 'Call Penny at (813) 303-9110 to get scheduled with an Acquisition Manager. They\'ll review your goals, walk through available deals, and build a custom strategy — with zero obligation to proceed.',
  },
];

const pillars = [
  { num: '01', title: 'Market Mastery' },
  { num: '02', title: 'Rainmaker Lead Sourcing' },
  { num: '03', title: 'Full-Cycle Management' },
  { num: '04', title: 'Technical Operational Proficiency' },
];

export default function HowItWorks() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'How It Works', url: '/how-it-works' },
  ]);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <SEO
        title="How It Works - Access Your Place"
        description="Three departments, one launch engine. Learn how Acquisition Managers, Setup Managers, and the Success Team work together to get your corporate lease acquisition done right."
        keywords="how it works, acquisition manager, setup manager, corporate leasing, rental arbitrage, how to start"
        canonicalUrl="/how-it-works"
        ogType="website"
        structuredData={breadcrumbSchema}
      />

      {/* Header bar */}
      <header className="bg-[#0a0f1a] border-b border-white/10 py-5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <Link to="/" className="inline-flex items-center text-[#d4a574] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white/50 text-sm">How It Works</span>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-4">The Flow</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Three departments.<br />
            <span className="text-[#d4a574]">One launch engine.</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl leading-relaxed">
            Rental arbitrage and corporate lease acquisition is still a niche strategy — not yet mass-market, and not something a course or a guru webinar can teach in a weekend. It requires a real end-to-end platform. Here's exactly how ours is structured.
          </p>
        </div>
      </section>

      {/* Three Departments */}
      <section className="py-16 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {[
              {
                num: '01', color: 'text-[#d4a574]', borderColor: 'border-[#d4a574]/30',
                icon: <Star className="w-5 h-5 text-[#d4a574]" />,
                label: 'Acquisition', title: 'Source deals. Negotiate leases. Build your pipeline.',
                body: 'Your Acquisition Manager analyzes the marketplace, runs the 80/20 micro-market valuation on every deal, and negotiates with landlords on your behalf — on-market, off-market, and through our Master Lease program.',
              },
              {
                num: '02', color: 'text-[#5EEAD4]', borderColor: 'border-[#5EEAD4]/30',
                icon: <Wrench className="w-5 h-5 text-[#5EEAD4]" />,
                label: 'Setup', title: 'Launch operations. Coordinate logistics. Get units live.',
                body: 'Whether the asset is unfurnished or already furnished, your Setup Manager takes over — furniture and decor procurement, refresher packages, housekeeping coordination, Wi-Fi setup, and maintenance provider matching.',
              },
              {
                num: '03', color: 'text-purple-400', borderColor: 'border-purple-400/30',
                icon: <Users className="w-5 h-5 text-purple-400" />,
                label: 'Success', title: 'Command. Compliance. Dispute mediation.',
                body: 'The Success Team is the backbone — mediating disputes, distributing overflow leads across the network, and keeping every relationship (client, landlord, staff) running on calm, structured communication.',
              },
            ].map(dept => (
              <div key={dept.num} className="bg-[#0d1424] p-8">
                <div className={`flex items-center gap-2 text-xs font-mono tracking-widest uppercase mb-4 ${dept.color}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Department {dept.num}
                </div>
                <h3 className="text-lg font-bold mb-3 text-white">{dept.label}</h3>
                <p className="text-[#d4a574] text-sm font-medium mb-3">{dept.title}</p>
                <p className="text-gray-400 text-sm leading-relaxed">{dept.body}</p>
              </div>
            ))}
          </div>

          {/* Dual cert */}
          <div className="mt-6 rounded-2xl border border-white/10 p-8 bg-gradient-to-r from-[#5EEAD4]/5 to-[#d4a574]/5">
            <h3 className="text-lg font-bold mb-3">Cross-train. Get certified in both.</h3>
            <p className="text-gray-400 leading-relaxed">
              Acquisition Managers can train and certify as Setup Managers, and Setup Managers can train and certify as Acquisition Managers. Most of our highest-performing team members hold both certifications — meaning they can carry a client from sourcing straight through launch without a handoff.
            </p>
          </div>
        </div>
      </section>

      {/* 4 Pillars */}
      <section className="py-16 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-3">Certification</p>
          <h2 className="text-3xl font-bold mb-3">A real four-month training program, not a weekend course.</h2>
          <p className="text-gray-400 mb-10">Every certified team member passes a rigorous examination across four pillars before working with clients.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {pillars.map(p => (
              <div key={p.num} className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <div className="text-xs font-mono text-gray-500 mb-2">{p.num}</div>
                <div className="text-sm font-semibold text-white">{p.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why not a course */}
      <section className="py-16 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-3">Why a Course Can't Do This</p>
          <h2 className="text-3xl font-bold mb-3">Corporate leasing requires a network. Not a webinar.</h2>
          <p className="text-gray-400 mb-10">There's an entire industry of gurus and courses selling hype around Airbnb-style short-term rentals as if that's the whole opportunity. It isn't — and most of them skip the part that actually matters.</p>
          <div className="grid md:grid-cols-2 gap-px bg-white/10 rounded-2xl overflow-hidden">
            <div className="bg-[#0d1424] p-8">
              <p className="text-xs font-mono text-red-400 tracking-widest uppercase mb-4">What the Guru Model Sells</p>
              <h3 className="text-lg font-bold mb-4">A PDF, a webinar, and an Airbnb listing</h3>
              <p className="text-gray-400 text-sm mb-3">Most courses stop at "find a property and list it." They rarely mention that landlords and property managers don't want a random individual cold-messaging them on Zillow about starting a short-term rental in their building.</p>
              <p className="text-gray-400 text-sm">Without a real network behind you, that outreach gets ignored — or gets you flagged as a liability before you ever get a lease signed.</p>
            </div>
            <div className="bg-[#0d1424] p-8">
              <p className="text-xs font-mono text-[#d4a574] tracking-widest uppercase mb-4">What Corporate Leasing Actually Requires</p>
              <h3 className="text-lg font-bold mb-4">A network with standing relationships</h3>
              <p className="text-gray-400 text-sm mb-3">Corporate lease acquisition moves at the speed of trust. Our Acquisition Managers carry an existing relationship and a track record into every landlord conversation — that's what gets a Master Lease approved instead of ignored.</p>
              <p className="text-gray-400 text-sm">We built Access Your Place to remove the noise: no guessing how to professionally approach a landlord, no learning curve burned on trial and error. Just a faster, supported path to scale.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-3">FAQ</p>
          <h2 className="text-3xl font-bold mb-10">What people ask before their first acquisition.</h2>
          <div className="divide-y divide-white/10">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  className="w-full text-left py-5 flex justify-between items-center gap-4 hover:text-[#d4a574] transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-base">{faq.q}</span>
                  <span className="text-2xl leading-none flex-shrink-0 text-[#d4a574]">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <p className="pb-5 text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                )}
              </div>
            ))}
          </div>

          {/* Call CTA */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-6">
            <div>
              <p className="font-semibold text-white">Ready to talk to an Acquisition Manager?</p>
              <p className="text-sm text-gray-400">Call Penny to get scheduled — no obligation.</p>
            </div>
            <a
              href="tel:8133039110"
              className="flex items-center gap-2 bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all whitespace-nowrap"
            >
              <Phone className="w-4 h-4" />
              (813) 303-9110
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
