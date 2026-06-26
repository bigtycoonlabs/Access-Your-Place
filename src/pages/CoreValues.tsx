import { ArrowLeft, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';

const values = [
  {
    num: '01',
    title: 'Collaboration Is Key. Share the Wealth.',
    body: [
      'We reject the myth of competition inside our ecosystem. There is more than enough business for everyone — our staff, our clients, and our verified vendors included.',
      'When an operator captures overflow leads or unmapped market opportunities, they route them to the Success Team, who redistributes that opportunity to other network clients in the same submarket. The network wins together.',
    ],
  },
  {
    num: '02',
    title: 'Cash Flow Opens Opportunities.',
    body: [
      'Corporate leasing and rental arbitrage are engineered to open reliable cash flow quickly — letting investors scale an effective portfolio faster than traditional real estate acquisition allows.',
      'We don\'t chase overnight hype. We build sustainable, cash-flowing businesses.',
    ],
  },
  {
    num: '03',
    title: 'Data Over Dreams. Real Projections, Zero Guarantees.',
    body: [
      'We don\'t sell illusions, and we don\'t issue financial guarantees. Markets fluctuate. We project — we don\'t promise — and every strategy is derived from raw micro-market indices, not wishful thinking.',
    ],
  },
  {
    num: '04',
    title: 'We Build Furnished Rental Empires — Beyond Airbnb.',
    body: [
      'We\'re not in the business of fragile, single-platform "Airbnb side-gigs." We build diversified furnished rental businesses across corporate housing networks, mid-term insurance stays, direct booking channels, and institutional marketing.',
      'Flexible, premium corporate housing is a vital modern necessity, and we hold our network operators to elite hospitality standards.',
    ],
  },
  {
    num: '05',
    title: 'Work, Don\'t Worry.',
    body: [
      'True business is never fully passive — it\'s made hands-off through automated software, bulletproof SOPs, and trained specialists. When operational challenges hit, we don\'t panic. We execute.',
    ],
  },
  {
    num: '06',
    title: 'More Power to the Entrepreneurs.',
    body: [
      'This platform was engineered to level the playing field for small businesses, startups, independent entrepreneurs, and family offices — and we deliberately guard our marketplace from predatory hedge funds and conglomerates that restrict opportunity for independent owners.',
    ],
  },
  {
    num: '07',
    title: 'We Bridge the Credential Gap.',
    body: [
      'By empowering independent operators to launch high-performing corporate housing units, we expand available housing options across the cities we service.',
      'YP is the operational bridge for capable operators who have the capital and drive to scale but lack the rigid institutional credentials traditionally demanded by standard leasing offices.',
    ],
  },
  {
    num: '08',
    title: 'We Fix Crowns. We Don\'t Spread Rumors.',
    body: [
      'The performance or structural setup of another operator\'s business is strictly confidential — even within the same community. Gossip and backchannel rumors destroy ecosystems, and slander is grounds for permanent removal.',
      'The Success Team mediates every companywide dispute through calm, structured, professional conversation.',
    ],
  },
  {
    num: '09',
    title: 'We Love Flawless Integrity.',
    body: [
      'We mandate that 100% of known material facts about an asset\'s history and performance transfer openly to the incoming client. It\'s fine to not be perfect — markets shift, mistakes happen — but transparency is non-negotiable.',
    ],
  },
  {
    num: '10',
    title: 'Housing Can\'t Wait. People Need Us Right Now.',
    body: [
      'We built a high-performing acquisition engine. We could keep it entirely internal and monopolize the cash flow. We choose not to — because in every city we service, real people need a safe, flexible place to stay right now.',
      'That\'s why we move on acquisition without unnecessary delay, execute setups immediately, and distribute our proprietary knowledge through assigned consultants at no extra charge. Empowering entrepreneurs to scale faster isn\'t just building businesses — it\'s solving the housing access crisis together.',
    ],
  },
];

export default function CoreValues() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Core Values', url: '/core-values' },
  ]);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <SEO
        title="Core Values - Access Your Place"
        description="The 10 operating principles behind Access Your Place. We built the launch engine, not the course. Data over dreams, collaboration over competition, people over hedge funds."
        keywords="core values, access your place mission, rental arbitrage values, corporate housing principles"
        canonicalUrl="/core-values"
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
          <span className="text-white/50 text-sm">Core Values</span>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-4">Why We Exist</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            We built the launch engine.<br />
            <span className="text-[#d4a574]">Not the course.</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl leading-relaxed">
            Access Your Place has spent five years building a full end-to-end consultancy and technology platform for corporate lease acquisition. These ten principles are the operating doctrine behind every Acquisition Manager, Setup Manager, and Success Team decision we make.
          </p>
        </div>
      </section>

      {/* Mission band */}
      <section className="py-12 border-b border-white/10 bg-gradient-to-r from-[#d4a574]/5 to-transparent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-mono tracking-widest text-[#5EEAD4] uppercase mb-3">Why Access Matters</p>
          <h2 className="text-2xl font-bold mb-4">Housing can't wait. There are people who need us right now.</h2>
          <p className="text-gray-400 leading-relaxed max-w-2xl">
            We could keep this engine entirely internal and capture all of it ourselves. We don't — because in every city we service, real people need a safe, flexible place to stay today. That urgency is why we move on acquisition without unnecessary delay, execute setups immediately, and back every recommendation with real projections instead of guesswork.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-lg">
            {[
              { val: '5', label: 'Years building this platform' },
              { val: '80/20', label: 'Raw micro-data vs aggregated tools' },
              { val: '0', label: 'Financial guarantees ever issued' },
            ].map(stat => (
              <div key={stat.val} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#d4a574] font-mono">{stat.val}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values list */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="divide-y divide-white/10">
            {values.map(v => (
              <div key={v.num} className="py-10 grid grid-cols-[80px_1fr] gap-8 group">
                <div className="text-3xl font-mono text-white/20 group-hover:text-[#d4a574] transition-colors pt-1">
                  {v.num}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-4">{v.title}</h3>
                  {v.body.map((para, i) => (
                    <p key={i} className="text-gray-400 leading-relaxed mb-3">{para}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to see how the engine works for your portfolio?</h2>
          <p className="text-gray-400 mb-8">
            Call Penny at <strong className="text-white">(813) 303-9110</strong> to schedule time with a certified Acquisition Manager — or create your account to get started online.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:8133039110"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-8 py-4 rounded-xl font-bold hover:shadow-lg transition-all"
            >
              <Phone className="w-4 h-4" />
              Call Penny: (813) 303-9110
            </a>
            <Link
              to="/how-it-works"
              className="border-2 border-[#d4a574] text-[#d4a574] px-8 py-4 rounded-xl font-bold hover:bg-[#d4a574]/10 transition-all text-center"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
