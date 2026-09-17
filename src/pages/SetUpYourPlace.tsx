import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';

// The company page: Set Up Your Place LLC and its three platforms. Each platform stands on
// its own, so this page introduces them side by side and never routes one audience into
// another. Links out carry a source tag so each platform can see visits from here.

const tag = (url: string) => `${url}${url.includes('?') ? '&' : '?'}utm_source=setupyourplace&utm_medium=company_page`;

const platforms = [
  {
    name: 'Access Your Place',
    assistant: 'Where it started',
    href: '/',
    external: false,
    lines: [
      'Furnished rental operations without buying the property. We find the opportunity, vet it in person, negotiate with the landlord, and hand the operator a deal ready to sign, then set it up with our logistics network and team.',
      'Running operations in the United States and Mexico.',
    ],
    cta: 'Visit Access Your Place',
  },
  {
    name: 'Access YP Labs',
    assistant: 'With Penny',
    href: 'https://accessyplabs.com',
    external: true,
    lines: [
      'The back office for a small business. Penny keeps track of filings, licences and renewals in all fifty states and DC, the documents that should be on file, what is owed to and by customers, and who on the team can see what, and warns you before anything is late.',
      'She also builds: sites, customer portals and tools for the business, with a free mock-up first.',
    ],
    cta: 'Visit Access YP Labs',
  },
  {
    name: 'Access YP Flow',
    assistant: 'With Arbo',
    href: 'https://accessypflow.com',
    external: true,
    lines: [
      'Puts a business’s idle cash to work on the owner’s own exchange account, under limits the owner sets, with Arbo explaining every decision.',
      'We never hold anyone’s money. Practice mode is free, with every strategy, for as long as you like.',
    ],
    cta: 'Visit Access YP Flow',
  },
];

export default function SetUpYourPlace() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Set Up Your Place', url: '/setupyourplace' },
  ]);
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Set Up Your Place LLC',
    url: 'https://accessyourplace.com/setupyourplace',
    email: 'success@accessyourplace.com',
    description: 'A technology company behind Access Your Place, Access YP Labs and Access YP Flow.',
    brand: platforms.map((p) => ({ '@type': 'Brand', name: p.name })),
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <SEO
        title="Set Up Your Place LLC - The company behind Access Your Place, YP Labs and YP Flow"
        description="Set Up Your Place LLC is a technology company. Access Your Place, Access YP Labs and Access YP Flow were built from five years of serving business owners and what they asked us for."
        keywords="Set Up Your Place LLC, Access Your Place, Access YP Labs, Access YP Flow, Penny, Arbo"
        canonicalUrl="/setupyourplace"
        ogType="website"
        structuredData={[breadcrumbSchema, orgSchema]}
      />

      <header className="bg-[#0a0f1a] border-b border-white/10 py-5">
        <nav aria-label="Breadcrumb" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <Link to="/" className="inline-flex min-h-[44px] items-center text-[#d4a574] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Back to Access Your Place
          </Link>
        </nav>
      </header>

      <main>
        <section className="py-16 border-b border-white/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-mono tracking-widest text-white/60 uppercase mb-4">The company</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Set Up Your Place LLC
            </h1>
            <p className="text-xl text-white/85 leading-relaxed max-w-3xl">
              We are a technology company. We build three platforms today, and every one of them came from
              the work: five years of serving hundreds of business owners, the data from running real
              operations, and the things our clients kept asking us for.
            </p>
          </div>
        </section>

        <section className="py-14 border-b border-white/10" aria-labelledby="where-heading">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="where-heading" className="text-2xl md:text-3xl font-bold mb-5">Where we started</h2>
            <div className="space-y-4 text-white/80 text-lg leading-relaxed">
              <p>
                Access Your Place came first. We help people run full-service furnished rental operations
                without buying the property, and we stand behind them with our own logistics network and team.
                It is still the heart of the company.
              </p>
              <p>
                Running those operations taught us what a business owner actually carries: the filings nobody
                reminds you about, the paperwork that should be on file and is not, and cash sitting idle
                between bookings. The tools grew out of that. They serve far more than rental operators now,
                and each one stands on its own.
              </p>
            </div>
          </div>
        </section>

        <section className="py-14 border-b border-white/10" aria-labelledby="platforms-heading">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="platforms-heading" className="text-2xl md:text-3xl font-bold mb-8">Our platforms</h2>
            <ul className="grid md:grid-cols-3 gap-6" role="list">
              {platforms.map((p) => (
                <li key={p.name} className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col">
                  <h3 className="text-xl font-bold text-[#d4a574]">{p.name}</h3>
                  <p className="text-sm text-white/60 mb-4">{p.assistant}</p>
                  <div className="space-y-3 text-white/80 leading-relaxed flex-1">
                    {p.lines.map((l) => <p key={l}>{l}</p>)}
                  </div>
                  {p.external ? (
                    <a
                      href={tag(p.href)}
                      className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md border border-[#d4a574] px-4 font-medium text-[#d4a574] hover:bg-[#d4a574] hover:text-[#0a0f1a] focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                    >
                      {p.cta}
                    </a>
                  ) : (
                    <Link
                      to={p.href}
                      className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md border border-[#d4a574] px-4 font-medium text-[#d4a574] hover:bg-[#d4a574] hover:text-[#0a0f1a] focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                    >
                      {p.cta}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-14 border-b border-white/10" aria-labelledby="together-heading">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="together-heading" className="text-2xl md:text-3xl font-bold mb-5">How they fit together</h2>
            <div className="space-y-4 text-white/80 text-lg leading-relaxed">
              <p>
                Use one, or use them all. Nothing on one platform requires another.
              </p>
              <p>
                Behind them is one company and one Success Team. Penny is the same assistant on Access Your
                Place and Access YP Labs, and YP Labs and YP Flow can be taken together as one bundle.
              </p>
            </div>
          </div>
        </section>

        <section className="py-14" aria-labelledby="contact-heading">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="contact-heading" className="text-2xl md:text-3xl font-bold mb-5">Talk to us</h2>
            <p className="text-white/80 text-lg leading-relaxed">
              The Success Team answers for the whole company at{' '}
              <a href="mailto:success@accessyourplace.com" className="text-[#d4a574] underline underline-offset-2">
                success@accessyourplace.com
              </a>.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
