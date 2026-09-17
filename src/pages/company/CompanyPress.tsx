import SEO, { getBreadcrumbSchema } from '@/components/SEO';
import CompanyLayout, { gold, section, wrap, h2, prose } from './CompanyLayout';
import CompanyForm from './CompanyForm';

const topics = [
  'Building accessible-first software, designed for screen readers from day one',
  'Five years of furnished rental operations: 2,000+ closings and 400+ master leases',
  'Furnished rental operations without owning the property',
  'Accessible and honest AI: software that says what it actually did',
  'Small business back offices and compliance across fifty states',
  'Bookkeeping that plans ahead: cash flow for businesses that get paid in lumps',
  'Putting spare business cash to work without handing it over',
  'A husband-and-wife company, from service business to software',
];

const facts = [
  ['Company', 'Set Up Your Place LLC, a technology company.'],
  ['Founders', 'Vission Cooper and Rel Cooper.'],
  ['Platforms', 'Access Your Place (furnished rental operations), Access YP Labs (the small business back office, with Penny) and Access YP Flow (bookkeeping and cash flow, with Arbo).'],
  ['Operations', 'United States and Mexico.'],
  ['Track record', 'Since 2020: more than 2,000 closings, 400+ master leases in our own name, and 5,000+ landlords negotiated with.'],
  ['Mission', 'Access for everyone.'],
  ['Press contact', 'success@accessyourplace.com'],
];

export default function CompanyPress() {
  return (
    <CompanyLayout
      eyebrow="Press and media"
      title="We are available."
      intro={<p>Podcasts, interviews, articles, video and events. If you would like to speak with our founders or anyone on our team, we would love to hear from you.</p>}
    >
      <SEO
        title="Press and Media | Set Up Your Place LLC"
        description="Interview Vission and Rel Cooper, founders of Set Up Your Place LLC. Podcasts, interviews, articles, video and events. Request an interview."
        canonicalUrl="/setupyourplace/press"
        ogType="website"
        structuredData={getBreadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Set Up Your Place', url: '/setupyourplace' }, { name: 'Press', url: '/setupyourplace/press' }])}
      />

      <section className={section} aria-labelledby="about-heading">
        <div className={wrap}>
          <h2 id="about-heading" className={h2}>About us, in brief</h2>
          <div className={prose}>
            <p>Set Up Your Place LLC is a technology company founded by husband and wife Vission and Rel Cooper. It began with Access Your Place, which helps people run full-service furnished rental operations without buying the property, and grew into software built from what its clients asked for: Access YP Labs, a small business back office run by an assistant named Penny, and Access YP Flow, bookkeeping and cash-flow software where an assistant named Arbo keeps the books, plans what is genuinely spare, gets customers to pay, and can put spare cash to work in the owner's own accounts.</p>
          </div>
          <dl className="mt-6 grid sm:grid-cols-2 gap-4">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/5 border border-white/10 p-4">
                <dt className={`font-semibold ${gold}`}>{k}</dt>
                <dd className="mt-1 text-white/85">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={section} aria-labelledby="topics-heading">
        <div className={wrap}>
          <h2 id="topics-heading" className={h2}>What we can talk about</h2>
          <ul className="list-disc pl-6 space-y-2 text-lg text-white/85">
            {topics.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </section>

      <section className="py-14" aria-labelledby="request-heading">
        <div className={wrap}>
          <h2 id="request-heading" className={h2}>Request an interview</h2>
          <p className="mb-6 text-lg text-white/85">
            Tell us about your show or publication and we will confirm who is available. You can also email{' '}
            <a href="mailto:success@accessyourplace.com?subject=Media%20request" className={`${gold} underline underline-offset-2`}>success@accessyourplace.com</a>.
          </p>
          <CompanyForm
            kind="press_inquiry"
            idPrefix="press"
            phoneLabel="Phone number"
            submitLabel="Send media request"
            fields={[
              { key: 'outlet', label: 'Outlet, show or publication', required: true },
              { key: 'media_type', label: 'Type of request', type: 'select', required: true, options: ['Podcast', 'Interview', 'Article or feature', 'Video', 'Speaking or event', 'Something else'] },
              { key: 'who', label: 'Who would you like to speak with', type: 'select', options: ['Vission Cooper', 'Rel Cooper', 'Both founders', 'Someone on the team', 'Not sure yet'] },
              { key: 'topic', label: 'Topic or angle', type: 'textarea' },
              { key: 'audience', label: 'Audience', help: 'Who listens, reads or watches, and roughly how many.' },
              { key: 'deadline', label: 'Deadline or recording date', type: 'date' },
              { key: 'links', label: 'Link to your show or past work' },
            ]}
          />
        </div>
      </section>
    </CompanyLayout>
  );
}
