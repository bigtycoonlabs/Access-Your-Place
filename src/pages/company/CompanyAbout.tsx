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
      eyebrow="About Set Up Your Place LLC"
      title="We give people access before they have earned it."
      intro={<>
        <p>Because that is the only way access is real. It is the expensive part, and we have been paying it for five years.</p>
        <p className="mt-4">Set Up Your Place LLC is a technology company. Our three platforms came from the work: five years of real operations, the data they produced, and the things people kept asking us for.</p>
      </>}
    >
      <SEO
        title="About Set Up Your Place LLC | Access Your Place, YP Labs and YP Flow"
        description="We give people access before they have earned it. Set Up Your Place LLC, founded by Vission and Rel Cooper: five years, 2,000+ closings, and three platforms built from the work."
        keywords="Set Up Your Place LLC, Vission Cooper, Rel Cooper, Access Your Place, Access YP Labs, Access YP Flow"
        canonicalUrl="/setupyourplace"
        ogType="website"
        structuredData={[getBreadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Set Up Your Place', url: '/setupyourplace' }]), orgSchema]}
      />

      <section className={section} aria-labelledby="idea-heading">
        <div className={wrap}>
          <h2 id="idea-heading" className={h2}>The idea</h2>
          <div className={prose}>
            <p>
              A lease is worth more as a furnished stay than as a monthly rental. A small business’s cash is worth
              more when it is planned and put to work. A back office is worth more when it runs itself.
            </p>
            <p>
              Those gaps are real, and everybody can see them. Standing in one has always taken capital, credentials,
              or somebody willing to take your call. Getting let in is the part nobody solves. That is what we build.
            </p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="story-heading">
        <div className={wrap}>
          <h2 id="story-heading" className={h2}>Our story</h2>
          <div className={prose}>
            <p>
              Set Up Your Place was founded by Vission and Rel Cooper, husband and wife. They started with furnished
              housing, then built the acquisition business that fed it, then the software underneath both.
            </p>
            <p>
              For years the acquisition work ran as Master Spaces, alongside our setup service. At the end of 2024 the
              two became one platform, Access Your Place: we find the property, work with the community, negotiate the
              terms, set the unit up, and hand the operator a deal with the landlord’s approval already in hand.
            </p>
            <p>
              Running real operations taught us what business owners actually carry: the filings nobody reminds you
              about, the paperwork that should be on file and is not, and money that comes in lumps weeks apart while
              the bills keep their own schedule. That became Access YP Labs and Access YP Flow. Today the company is a
              team of engineers, operators and a Success Team, building all three.
            </p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="record-heading">
        <div className={wrap}>
          <h2 id="record-heading" className={h2}>Five years, in numbers</h2>
          <dl className="grid sm:grid-cols-2 gap-4">
            {[
              ['2,000+', 'closings since 2020, negotiated and launched for our clients'],
              ['400+', 'master leases signed in our own name and placed with operators'],
              ['5,000+', 'landlords and communities we have negotiated with'],
              ['3,000+', 'vendors and local service providers we have worked with'],
            ].map(([n, what]) => (
              <div key={n} className="rounded-lg bg-white/5 border border-white/10 p-5">
                <dt className={`text-3xl font-bold ${gold}`}>{n}</dt>
                <dd className="mt-1 text-white/85 leading-relaxed">{what}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-white/65">Figures from our own records.</p>
        </div>
      </section>

      <section className={section} aria-labelledby="cost-heading">
        <div className={wrap}>
          <h2 id="cost-heading" className={h2}>What access costs</h2>
          <div className={prose}>
            <p>
              The hard part about giving people access is that sometimes people have not earned it yet. You have to
              give it anyway, or the opportunity is not real. That has cost us money more than once. We keep doing it,
              and we keep getting better at deciding who is ready.
            </p>
            <p>
              When an operator walks away from a master lease, the lease is still ours. We keep the landlord whole, and
              we have never let that land on the landlord.
            </p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="network-heading">
        <div className={wrap}>
          <h2 id="network-heading" className={h2}>The network we have built</h2>
          <div className={prose}>
            <p>
              The furnished rental industry touches a lot of people, and over five years we have worked with thousands of
              them. Not only people looking to acquire a property: everyone it takes to keep a home open to guests.
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
            <p>Our mission is to give access to everyone: to housing, to income, and to the tools that usually only bigger companies can afford.</p>
            <p>Every platform is accessible first, designed for screen readers from the first line, so anyone, including people who are blind or have low vision, can use it on their own.</p>
            <p>We believe AI should help people, not harm them. Penny and Arbo exist so ordinary work does not require a person to absorb somebody’s bad day. They explain what they are doing, say plainly when they do not know, and never claim to have done something they did not do. When it actually matters, money on the table or a decision that cannot be undone, you get a human.</p>
          </div>
          <p className="mt-6"><Link to="/setupyourplace/accessibility" className={`${gold} underline underline-offset-2`}>How we build for accessibility</Link> · <Link to="/core-values" className={`${gold} underline underline-offset-2`}>Our operating principles</Link></p>
        </div>
      </section>

      <section className="py-14" aria-labelledby="contact-heading">
        <div className={wrap}>
          <h2 id="contact-heading" className={h2}>Talk to us</h2>
          <div className={prose}>
            <p className="text-xl text-white">Everybody wants to be a business owner, until they actually are. If that does not scare you off, talk to us.</p>
            <p>The Success Team answers for the whole company at <a href="mailto:success@accessyourplace.com" className={`${gold} underline underline-offset-2`}>success@accessyourplace.com</a>.</p>
            <p>Media and interview requests: <Link to="/setupyourplace/press" className={`${gold} underline underline-offset-2`}>our press page</Link>. Want to work with us: <Link to="/setupyourplace/careers" className={`${gold} underline underline-offset-2`}>careers</Link>.</p>
          </div>
        </div>
      </section>
    </CompanyLayout>
  );
}
