import { Link } from 'react-router-dom';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';
import CompanyLayout, { gold, section, wrap, h2, prose } from './CompanyLayout';
import CompanyForm from './CompanyForm';

const aypRoles = [
  ['Acquisition Manager', 'Finds furnished rental opportunities, contacts landlords, runs the numbers, negotiates terms, and walks clients through discovery and closing calls.'],
  ['Setup Manager', 'Sources furniture and supplies, matches clients with vendors on the ground, manages the pros at each launch, and keeps the client file current.'],
  ['Admin', 'Keeps compliance, documents and client support moving, and makes sure nothing goes out late.'],
];

export default function CompanyCareers() {
  return (
    <CompanyLayout
      eyebrow="Careers"
      title="Grow with a team that builds access."
      intro={<p>We are looking for people who want to build something that matters: operators, organisers and entrepreneurs who are excited about using AI to help people, not harm them.</p>}
    >
      <SEO
        title="Careers - Set Up Your Place LLC"
        description="Join Set Up Your Place: commission-based roles at Access Your Place, administration roles at Access YP Flow and Access YP Labs, and entrepreneurs who want AI to help people."
        canonicalUrl="/setupyourplace/careers"
        ogType="website"
        structuredData={getBreadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Set Up Your Place', url: '/setupyourplace' }, { name: 'Careers', url: '/setupyourplace/careers' }])}
      />

      <section className={section} aria-labelledby="ayp-heading">
        <div className={wrap}>
          <h2 id="ayp-heading" className={h2}>Access Your Place: commission-based roles</h2>
          <div className={prose}>
            <p>The Success Team at Access Your Place works on commission, so what you earn grows with the deals and launches you move. These roles suit self-starters who like people, numbers and getting things done.</p>
          </div>
          <ul className="mt-6 space-y-4" role="list">
            {aypRoles.map(([t, d]) => (
              <li key={t} className="rounded-lg bg-white/5 border border-white/10 p-5">
                <h3 className={`text-lg font-semibold ${gold}`}>{t}</h3>
                <p className="mt-1 text-white/85 leading-relaxed">{d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-lg text-white/85">
            Acquisition Managers and Setup Managers go through a four-month certification program, and many certify in both.{' '}
            <Link to="/careers" className={`${gold} underline underline-offset-2`}>Read the full role details, training and commission structure</Link>.
          </p>
        </div>
      </section>

      <section className={section} aria-labelledby="admin-heading">
        <div className={wrap}>
          <h2 id="admin-heading" className={h2}>Access YP Flow and Access YP Labs: administration</h2>
          <div className={prose}>
            <p>Our software platforms need people who keep the day running: supporting customers, reviewing what comes in, and making sure every person who writes to us gets a real answer.</p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="builders-heading">
        <div className={wrap}>
          <h2 id="builders-heading" className={h2}>Entrepreneurs and builders</h2>
          <div className={prose}>
            <p>If you are excited about what AI can do for people, especially people who are usually left out, we want to hear from you. Tell us what you would build, sell or grow with us.</p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="how-heading">
        <div className={wrap}>
          <h2 id="how-heading" className={h2}>How we work</h2>
          <div className={prose}>
            <p>Collaboration over competition. Honest numbers over hype. Accessibility in everything. We tell each other, and our customers, what is true, including when something did not work.</p>
          </div>
        </div>
      </section>

      <section className="py-14" aria-labelledby="apply-heading">
        <div className={wrap}>
          <h2 id="apply-heading" className={h2}>Tell us about you</h2>
          <p className="mb-6 text-lg text-white/85">No formal application needed to start a conversation. We reply to everyone by email.</p>
          <CompanyForm
            kind="career_interest"
            idPrefix="careers"
            phoneLabel="Phone number"
            submitLabel="Send to the team"
            fields={[
              { key: 'interest', label: 'What interests you', type: 'select', required: true, options: ['Acquisition Manager (commission)', 'Setup Manager (commission)', 'Admin (Access Your Place)', 'Administration (YP Flow or YP Labs)', 'Entrepreneur or builder', 'Something else'] },
              { key: 'experience_summary', label: 'Tell us a little about your experience', type: 'textarea', required: true },
              { key: 'links', label: 'Links', help: 'LinkedIn, a portfolio, or anything you would like us to see.' },
            ]}
          />
        </div>
      </section>
    </CompanyLayout>
  );
}
