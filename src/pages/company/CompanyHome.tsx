import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import CompanyLayout, { gold, section, wrap, h2, prose } from './CompanyLayout';

const tag = (url: string) => `${url}?utm_source=setupyourplace&utm_medium=company_home`;

const platforms = [
  {
    name: 'Access Your Place', line: 'Property · with Penny', href: 'https://accessyourplace.com', internal: '/',
    blurb: 'Furnished rental operations without buying the property. We find the opportunity, check it with the landlord, negotiate the terms, and set the unit up, so an operator can simply run it.',
    cta: 'Go to Access Your Place',
  },
  {
    name: 'Access YP Labs', line: 'The back office · with Penny', href: 'https://accessyplabs.com',
    blurb: 'Filings, licences and renewals in every state you operate in, the documents that should be on file, what is owed to you and by you, and who on your team can see what. Penny warns you before anything is late, and builds the sites and tools the business needs.',
    cta: 'Go to Access YP Labs',
  },
  {
    name: 'Access YP Flow', line: 'Money and cash flow · with Arbo', href: 'https://accessypflow.com',
    blurb: 'Bookkeeping that answers questions. Arbo keeps the books for every business and property you run, works out what is genuinely spare and how long it lasts, bills and chases your customers, and, only if you want, puts spare cash to work in your own accounts.',
    cta: 'Go to Access YP Flow',
  },
];

const numbers: [string, string][] = [
  ['2,000+', 'closings since 2020'],
  ['400+', 'master leases signed in our own name'],
  ['5,000+', 'landlords and communities negotiated with'],
  ['3,000+', 'vendors and local service providers'],
];

export default function CompanyHome() {
  return (
    <CompanyLayout
      eyebrow="Set Up Your Place LLC"
      title="We give people access before they have earned it."
      intro={<>
        <p>Because that is the only way access is real. It is the expensive part, and we have been paying it for five years.</p>
        <p className="mt-4">Three platforms. Two AI assistants. One company, built from operations we run ourselves.</p>
        <p className="mt-7">
          <Link to="/setupyourplace/about" className="inline-flex min-h-[44px] items-center rounded-md bg-[#d4a574] px-6 font-semibold text-[#0a0f1a] hover:bg-[#c49464] focus:outline-none focus:ring-2 focus:ring-white">
            About the company
          </Link>
        </p>
      </>}
    >
      <SEO
        title="Set Up Your Place LLC | Three platforms for people who were never let in"
        description="Set Up Your Place LLC is a technology company behind Access Your Place, Access YP Labs and Access YP Flow. Five years of operations, 2,000+ closings, and software built from the work."
        canonicalUrl="/setupyourplace"
        ogType="website"
      />

      <section className={section} aria-labelledby="gaps-heading">
        <div className={wrap}>
          <h2 id="gaps-heading" className={h2}>Three gaps everybody can see</h2>
          <div className={prose}>
            <p>
              A lease is worth more as a furnished stay than as a monthly rental. A small business’s cash is worth more
              when it is planned and put to work. A back office is worth more when it runs itself.
            </p>
            <p>Standing in one of those gaps has always taken capital, credentials, or somebody willing to take your call. Getting let in is the part nobody solves. That is what we build.</p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="platforms-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="platforms-heading" className={h2}>Our platforms</h2>
          <ul className="grid md:grid-cols-3 gap-6" role="list">
            {platforms.map((p) => (
              <li key={p.name} className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col">
                <h3 className={`text-xl font-bold ${gold}`}>{p.name}</h3>
                <p className="text-sm text-white/65 mb-4">{p.line}</p>
                <p className="text-white/85 leading-relaxed flex-1">{p.blurb}</p>
                <a href={tag(p.href)} className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md border border-[#d4a574] px-4 font-medium text-[#d4a574] hover:bg-[#d4a574] hover:text-[#0a0f1a] focus:outline-none focus:ring-2 focus:ring-[#d4a574]">
                  {p.cta}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-lg text-white/85 leading-relaxed max-w-3xl">
            Use one, or use all three. Nothing on one platform requires another, and one Success Team stands behind all of it.
          </p>
        </div>
      </section>

      <section className={section} aria-labelledby="record-heading">
        <div className={wrap}>
          <h2 id="record-heading" className={h2}>Five years of operations</h2>
          <dl className="grid sm:grid-cols-2 gap-4">
            {numbers.map(([n, what]) => (
              <div key={n} className="rounded-lg bg-white/5 border border-white/10 p-5">
                <dt className={`text-3xl font-bold ${gold}`}>{n}</dt>
                <dd className="mt-1 text-white/85 leading-relaxed">{what}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-white/65">Figures from our own records.</p>
          <p className="mt-6"><Link to="/setupyourplace/about" className={`${gold} underline underline-offset-2`}>Read how the company got here</Link></p>
        </div>
      </section>

      <section className={section} aria-labelledby="accessible-heading">
        <div className={wrap}>
          <h2 id="accessible-heading" className={h2}>Accessible first</h2>
          <div className={prose}>
            <p>
              Every platform is designed for screen readers from the first line, so anyone, including people who are
              blind or have low vision, can use our software on their own.
            </p>
            <p>And software that reports success it did not achieve is treated here as the most serious kind of defect there is, above a crash.</p>
          </div>
          <p className="mt-6"><Link to="/setupyourplace/accessibility" className={`${gold} underline underline-offset-2`}>How we build for accessibility</Link></p>
        </div>
      </section>

      <section className="py-14" aria-labelledby="contact-heading">
        <div className={wrap}>
          <h2 id="contact-heading" className={h2}>Talk to us</h2>
          <div className={prose}>
            <p className="text-xl text-white">Everybody wants to be a business owner, until they actually are. If that does not scare you off, talk to us.</p>
            <p>The Success Team answers for the whole company at <a href="mailto:success@accessyourplace.com" className={`${gold} underline underline-offset-2`}>success@accessyourplace.com</a>.</p>
            <p>
              Media and interview requests: <Link to="/setupyourplace/press" className={`${gold} underline underline-offset-2`}>press</Link>.
              Want to work with us: <Link to="/setupyourplace/careers" className={`${gold} underline underline-offset-2`}>careers</Link>.
            </p>
          </div>
        </div>
      </section>
    </CompanyLayout>
  );
}
