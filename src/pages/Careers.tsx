import { ArrowLeft, CheckCircle, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';

const amResponsibilities = [
  'Build and own your client pipeline',
  'Direct landlord and property manager negotiations',
  'Run the 80/20 micro-market valuation on every deal',
  'Source both furnished and unfurnished opportunities and list them on the marketplace',
  'Use Penny\'s real historical market data — not platform scrapes',
  'Run your own furnished rental portfolio alongside the role',
];

const smResponsibilities = [
  'Own the full launch process, start to finish',
  'Furniture and decor procurement for unfurnished assets',
  'Refresher packages and upgrades for existing furnished units',
  'Coordinate with housekeepers and maintenance providers on the ground',
  'Wi-Fi setup and utility coordination',
  'Connect clients to vendors and software needed to go live',
];

const pillars = [
  { num: '01', title: 'Market Mastery' },
  { num: '02', title: 'Rainmaker Lead Sourcing' },
  { num: '03', title: 'Full-Cycle Management' },
  { num: '04', title: 'Technical Operational Proficiency' },
];

export default function Careers() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Careers', url: '/careers' },
  ]);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <SEO
        title="Careers - Access Your Place"
        description="We're hiring Acquisition Managers and Setup Managers. Get certified, cross-train, and build your own book in the corporate lease acquisition space."
        keywords="careers, acquisition manager jobs, setup manager jobs, rental arbitrage careers, corporate housing jobs, AYP careers"
        canonicalUrl="/careers"
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
          <span className="text-white/50 text-sm">Careers</span>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-4">Now Hiring</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            We're hiring Acquisition Managers<br />
            <span className="text-[#d4a574]">and Setup Managers.</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl leading-relaxed">
            Join the team that's actually building the engine — not selling a course about it. Get certified, get trained across both disciplines, and build your own track record placing corporate leases and launching operations across our network.
          </p>
        </div>
      </section>

      {/* Open Roles */}
      <section className="py-16 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-3">Open Roles</p>
          <h2 className="text-3xl font-bold mb-3">Two roles. One certification path that connects them.</h2>
          <p className="text-gray-400 mb-10">Every Acquisition Manager and Setup Manager goes through the same rigorous training program. Many of our team members end up certified in both.</p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* AM Card */}
            <div className="bg-[#0d1424] border border-[#d4a574]/20 rounded-2xl p-8 relative">
              <div className="absolute top-6 right-6 flex items-center gap-1.5 text-xs font-mono text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Open
              </div>
              <p className="text-xs font-mono text-[#d4a574] tracking-widest uppercase mb-3">Acquisition Manager</p>
              <h3 className="text-xl font-bold mb-3">Source deals. Negotiate leases. Build your book.</h3>
              <p className="text-gray-400 text-sm mb-6">You'll analyze the marketplace, run the 80/20 micro-market valuation on every deal, negotiate directly with landlords, and place corporate leases for clients across our network — on-market, off-market, and through our Master Lease program.</p>
              <div className="space-y-2.5">
                {amResponsibilities.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-[#d4a574] flex-shrink-0 mt-0.5" />
                    {r}
                  </div>
                ))}
              </div>
            </div>

            {/* SM Card */}
            <div className="bg-[#0d1424] border border-[#5EEAD4]/20 rounded-2xl p-8 relative">
              <div className="absolute top-6 right-6 flex items-center gap-1.5 text-xs font-mono text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Open
              </div>
              <p className="text-xs font-mono text-[#5EEAD4] tracking-widest uppercase mb-3">Setup Manager</p>
              <h3 className="text-xl font-bold mb-3">Launch operations. Coordinate logistics. Get units live.</h3>
              <p className="text-gray-400 text-sm mb-6">You'll manage the full setup process for furnished and unfurnished properties alike — from furniture procurement and refresher packages to housekeeping coordination, Wi-Fi setup, and vendor matching.</p>
              <div className="space-y-2.5">
                {smResponsibilities.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-[#5EEAD4] flex-shrink-0 mt-0.5" />
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dual cert */}
          <div className="mt-6 rounded-2xl border border-white/10 p-8 bg-gradient-to-r from-[#5EEAD4]/5 to-[#d4a574]/5 text-center">
            <h3 className="text-lg font-bold mb-3">Cross-train. Get certified in both.</h3>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm leading-relaxed">
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
          <p className="text-gray-400 mb-8">Every certified team member passes a rigorous examination across four pillars before working with clients.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {pillars.map(p => (
              <div key={p.num} className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <div className="text-xs font-mono text-gray-500 mb-2">{p.num}</div>
                <div className="text-sm font-semibold">{p.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compensation */}
      <section className="py-16 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-3">Earning Potential</p>
          <h2 className="text-3xl font-bold mb-3">You're building your own book — your earnings scale with it.</h2>
          <p className="text-gray-400 mb-10">Acquisition Managers and Setup Managers earn on a commission structure tied to deals sourced, deals closed, and operations launched — not a flat hourly rate.</p>

          {/* AM Comp */}
          <h3 className="text-lg font-semibold mb-4 text-[#d4a574]">Acquisition Manager Commission</h3>
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-4">
            <div className="grid grid-cols-2 bg-white/5 border-b border-white/10">
              <div className="p-4 text-xs font-mono text-white/40 uppercase tracking-widest">Structure</div>
              <div className="p-4 text-xs font-mono text-white/40 uppercase tracking-widest">Commission</div>
            </div>
            {[
              ['Sourcing a deal', '15% of the acquisition fee'],
              ['Closing a deal', '15% of the acquisition fee'],
              ['Sourced and closed the same deal', '30% total'],
              ['Found a deal, regardless of who closes it', '15% sourcing commission — paid either way'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 border-b border-white/10 last:border-b-0">
                <div className="p-4 text-sm text-gray-300">{label}</div>
                <div className="p-4 text-sm font-mono text-[#d4a574]">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-10">Acquisition Managers can source both furnished and unfurnished opportunities and list them on the marketplace. Your 15% sourcing commission is yours once you've found the deal — whether you personally close it or another team member does.</p>

          {/* SM Comp */}
          <h3 className="text-lg font-semibold mb-4 text-[#5EEAD4]">Setup Manager Compensation</h3>
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-4">
            <div className="grid grid-cols-2 bg-white/5 border-b border-white/10">
              <div className="p-4 text-xs font-mono text-white/40 uppercase tracking-widest">Project Type</div>
              <div className="p-4 text-xs font-mono text-white/40 uppercase tracking-widest">Compensation</div>
            </div>
            {[
              ['Furnished deal requiring a refresher package', '15% commission'],
              ['Unfurnished property launch (client-requested setup)', '$750 – $1,800 flat fee per launch'],
              ['Other assigned projects', 'Flat setup management fee, set per project'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 border-b border-white/10 last:border-b-0">
                <div className="p-4 text-sm text-gray-300">{label}</div>
                <div className="p-4 text-sm font-mono text-[#5EEAD4]">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">Setup Managers are typically assigned to most furnished deals and to unfurnished launches where a client has requested setup support. Staff members are also encouraged and supported in building their own furnished rental portfolio alongside their role.</p>
        </div>
      </section>

      {/* Apply */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#0d1424] border border-white/10 rounded-2xl p-10 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to apply?</h2>
            <p className="text-gray-400 max-w-lg mx-auto mb-8">
              Send your resume and a short note about why you're interested in Acquisition Management or Setup Management to our Success Team. Include which role (or both) you're applying for.
            </p>
            <a
              href="mailto:success@accessyourplace.com?subject=Career%20Inquiry%20-%20Acquisition%20Manager%20%2F%20Setup%20Manager"
              className="inline-flex items-center gap-2 text-xl font-mono text-[#5EEAD4] hover:underline mb-8"
            >
              <Mail className="w-5 h-5" />
              success@accessyourplace.com
            </a>
            <div className="mt-4">
              <a
                href="tel:8133039110"
                className="inline-flex items-center gap-2 border border-white/20 text-white px-6 py-3 rounded-xl font-medium hover:bg-white/5 transition-all"
              >
                <Phone className="w-4 h-4" />
                Or call Penny: (813) 303-9110
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
