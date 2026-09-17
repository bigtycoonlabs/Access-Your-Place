import { Link } from 'react-router-dom';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';
import CompanyLayout, { gold, section, wrap, h2, prose } from './CompanyLayout';

const tag = (url: string) => `${url}?utm_source=setupyourplace&utm_medium=company_page`;

const platforms = [
  {
    name: 'Access Your Place', assistant: 'Where it started', href: '/', external: false,
    lines: [
      'Furnished rental operations without buying the property. We find the opportunity, vet it in person, negotiate with the landlord, and hand the operator a deal ready to sign, then set it up with our logistics network and team.',
      'Running in the United States and Mexico.',
    ],
    cta: 'Visit Access Your Place',
  },
  {
    name: 'Access YP Labs', assistant: 'The back office, with Penny', href: 'https://accessyplabs.com', external: true,
    lines: [
      'The back office for a small business. Penny keeps track of filings, licences and renewals in all fifty states and DC, the documents that should be on file, what is owed to and by customers, and who on the team can see what, and warns you before anything is late.',
      'She also builds sites, customer portals and tools for the business, with a free mock-up first.',
    ],
    cta: 'Visit Access YP Labs',
  },
  {
    name: 'Access YP Flow', assistant: 'Money and cash flow, with Arbo', href: 'https://accessypflow.com', external: true,
    lines: [
      'Bookkeeping that answers questions. Arbo keeps the books for every business and property you run: bills, wages, rent, tax, and who owes you, each with the date it lands.',
      'He works out what is genuinely spare and how long it would last, bills customers and chases late payments, and, only if you want, puts the spare cash to work under your own limits. Your money never leaves your own accounts. Asking Arbo is free, forever.',
    ],
    cta: 'Visit Access YP Flow',
  },
];

const network = [
  ['Landlords and property managers', 'who needed reliable operators and corporate tenants for units that were sitting empty.'],
  ['Apartment communities', 'looking for a responsible way to open units to furnished and corporate stays.'],
  ['Furnished rental operators', 'from first-timers to people running whole portfolios.'],
  ['Business owners', 'who wanted a second income stream without buying real estate.'],
  ['Housekeeping companies', 'who keep units guest-ready between every stay.'],
  ['Maintenance companies', 'who keep them safe and working.'],
  ['Local home service providers', 'the movers, installers, handymen and small crews that every launch depends on.'],
  ['Furniture and supply vendors', 'who outfit a unit from empty to ready.'],
];

export default function CompanyAbout() {
  const orgSchema = {
    '@context': 'https://schema.org', '@type': 'Organization',
    name: 'Set Up Your Place LLC', url: 'https://accessyourplace.com/setupyourplace', email: 'success@accessyourplace.com',
    description: 'A technology company behind Access Your Place, Access YP Labs and Access YP Flow.',
    founder: [{ '@type': 'Person', name: 'Vission Cooper' }, { '@type': 'Person', name: 'Rel Cooper' }],
    brand: platforms.map((p) => ({ '@type': 'Brand', name: p.name })),
  };
  return (
    <CompanyLayout
      eyebrow="About the company"
      title="Set Up Your Place: access for everyone."
      intro={<p>Set Up Your Place LLC is a technology company. We build three platforms today, and every one of them came from the work: five years of serving hundreds of business owners, the data from running real operations, and the things people kept asking us for.</p>}
    >
      <SEO
        title="About Set Up Your Place LLC | Access Your Place, YP Labs and YP Flow"
        description="Set Up Your Place LLC is a technology company founded by Vission and Rel Cooper. Access Your Place, Access YP Labs and Access YP Flow were built from five years of serving hundreds of business owners."
        keywords="Set Up Your Place LLC, Vission Cooper, Rel Cooper, Access Your Place, Access YP Labs, Access YP Flow"
        canonicalUrl="/setupyourplace"
        ogType="website"
        structuredData={[getBreadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Set Up Your Place', url: '/setupyourplace' }]), orgSchema]}
      />

      <section className={section} aria-labelledby="story-heading">
        <div className={wrap}>
          <h2 id="story-heading" className={h2}>Our story</h2>
          <div className={prose}>
            <p>
              Set Up Your Place was founded by Vission and Rel Cooper, husband and wife. It began with Access Your Place:
              helping people run full-service furnished rental operations without having to buy the property, and standing
              behind them with our own logistics network and team.
            </p>
            <p>
              Vission and Rel are both blind, and both use screen readers every day. That shapes everything we build.
              Software that cannot be heard, or that reports success when nothing happened, is software they cannot use,
              so every platform we make is built to be reachable and to tell the truth.
            </p>
            <p>
              Running real operations taught us what business owners actually carry: the filings nobody reminds you about,
              the paperwork that should be on file and is not, money that comes in lumps weeks apart while the bills keep their own schedule. Our tools grew out of
              that. They now serve far more people than rental operators, and each one stands on its own.
            </p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="network-heading">
        <div className={wrap}>
          <h2 id="network-heading" className={h2}>The network we have built</h2>
          <div className={prose}>
            <p>
              The furnished rental industry touches a lot of people, and over five years we have worked with hundreds of them.
              Not only people looking to acquire a property: everyone it takes to keep a home open to guests.
            </p>
          </div>
          <ul className="mt-6 grid sm:grid-cols-2 gap-4" role="list">
            {network.map(([who, what]) => (
              <li key={who} className="rounded-lg bg-white/5 border border-white/10 p-4 leading-relaxed">
                <span className={`font-semibold ${gold}`}>{who}</span>, {what}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-lg text-white/85 leading-relaxed">All of them needed help, and all of them shaped what we built.</p>
        </div>
      </section>

      <section className={section} aria-labelledby="platforms-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="platforms-heading" className={h2}>Our platforms</h2>
          <ul className="grid md:grid-cols-3 gap-6" role="list">
            {platforms.map((p) => (
              <li key={p.name} className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col">
                <h3 className={`text-xl font-bold ${gold}`}>{p.name}</h3>
                <p className="text-sm text-white/65 mb-4">{p.assistant}</p>
                <div className="space-y-3 text-white/85 leading-relaxed flex-1">{p.lines.map((l) => <p key={l}>{l}</p>)}</div>
                {p.external ? (
                  <a href={tag(p.href)} className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md border border-[#d4a574] px-4 font-medium text-[#d4a574] hover:bg-[#d4a574] hover:text-[#0a0f1a] focus:outline-none focus:ring-2 focus:ring-[#d4a574]">{p.cta}</a>
                ) : (
                  <Link to={p.href} className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md border border-[#d4a574] px-4 font-medium text-[#d4a574] hover:bg-[#d4a574] hover:text-[#0a0f1a] focus:outline-none focus:ring-2 focus:ring-[#d4a574]">{p.cta}</Link>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-lg text-white/85 leading-relaxed max-w-3xl">
            Use one, or use them all. Nothing on one platform requires another. Behind them is one company and one Success
            Team, and YP Labs and YP Flow can be taken together as one bundle.
          </p>
        </div>
      </section>

      <section className={section} aria-labelledby="mission-heading">
        <div className={wrap}>
          <h2 id="mission-heading" className={h2}>What we believe</h2>
          <div className={prose}>
            <p>Our mission is to give access to everyone: to housing, to income, to the tools that usually only bigger companies can afford, and to software that works for people who cannot see it.</p>
            <p>We believe AI should help people, not harm them. Our assistants explain what they are doing, say plainly when they do not know, and never claim to have done something they did not do.</p>
          </div>
          <p className="mt-6"><Link to="/core-values" className={`${gold} underline underline-offset-2`}>Read the operating principles behind Access Your Place</Link></p>
        </div>
      </section>

      <section className="py-14" aria-labelledby="contact-heading">
        <div className={wrap}>
          <h2 id="contact-heading" className={h2}>Talk to us</h2>
          <div className={prose}>
            <p>The Success Team answers for the whole company at <a href="mailto:success@accessyourplace.com" className={`${gold} underline underline-offset-2`}>success@accessyourplace.com</a>.</p>
            <p>Media and interview requests: <Link to="/setupyourplace/press" className={`${gold} underline underline-offset-2`}>our press page</Link>. Want to work with us: <Link to="/setupyourplace/careers" className={`${gold} underline underline-offset-2`}>careers</Link>.</p>
          </div>
        </div>
      </section>
    </CompanyLayout>
  );
}
