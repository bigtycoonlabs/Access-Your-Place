import SEO, { getBreadcrumbSchema } from '@/components/SEO';
import CompanyLayout, { gold, section, wrap, h2, prose } from './CompanyLayout';

const practices = [
  ['Screen readers first', 'Pages are built to be heard in order: real headings, one main area, labelled navigation, and a skip link at the top.'],
  ['Every field has a name', 'Form fields carry visible labels tied to the field, and required fields say so. Email and password fields do not auto-capitalise, so a phone cannot quietly change what you typed.'],
  ['Status you can hear', 'When something is sending, saved or has failed, it is announced, not just shown. A result nobody can hear is treated as a bug.'],
  ['Room to tap', 'Buttons and links are at least 44 pixels, so they work with a thumb, a switch or a shaky hand.'],
  ['Meaning without colour', 'Nothing depends on colour alone. Red and green are always backed by words.'],
  ['Plain sentences over dense tables', 'Where a sighted person would glance at a chart, we write the figure as a sentence, so it reads well aloud.'],
  ['Honest about what happened', 'Our assistants, Penny and Arbo, say what they actually did. A failed read is never presented as "nothing found", and a failure is never reported as success.'],
];

export default function CompanyAccessibility() {
  return (
    <CompanyLayout
      eyebrow="Accessibility"
      title="Built by people who use screen readers."
      intro={<p>Our founders, Vission and Rel Cooper, are both blind. They run this company with the same screen readers many of our customers use. Accessibility is not a feature we add at the end. It is how everything starts.</p>}
    >
      <SEO
        title="Accessibility - Set Up Your Place LLC"
        description="How Set Up Your Place builds Access Your Place, Access YP Labs and Access YP Flow to work with screen readers and assistive technology, and how to tell us when something does not."
        canonicalUrl="/setupyourplace/accessibility"
        ogType="website"
        structuredData={getBreadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Set Up Your Place', url: '/setupyourplace' }, { name: 'Accessibility', url: '/setupyourplace/accessibility' }])}
      />

      <section className={section} aria-labelledby="why-heading">
        <div className={wrap}>
          <h2 id="why-heading" className={h2}>Why it matters so much to us</h2>
          <div className={prose}>
            <p>A sighted person can glance at a dashboard and notice when a number looks wrong. Someone using a screen reader has to trust what the software tells them. That is why we hold our platforms to two rules together: everything must be reachable, and everything must be true.</p>
            <p>A correct answer that nobody can hear is the same failure as a wrong one.</p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="how-heading">
        <div className={wrap}>
          <h2 id="how-heading" className={h2}>How we build</h2>
          <ul className="space-y-4" role="list">
            {practices.map(([t, d]) => (
              <li key={t} className="rounded-lg bg-white/5 border border-white/10 p-5">
                <h3 className={`text-lg font-semibold ${gold}`}>{t}</h3>
                <p className="mt-1 text-white/85 leading-relaxed">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={section} aria-labelledby="where-heading">
        <div className={wrap}>
          <h2 id="where-heading" className={h2}>Where we are honest about gaps</h2>
          <div className={prose}>
            <p>Our platforms are large and still growing, and not every older screen meets these standards yet. We are working through them, and we would rather tell you that than claim a perfect score.</p>
            <p>If something does not work with your screen reader, keyboard, magnifier, voice control or any other tool, we want to know. Tell us the page and what happened, and we will fix it and tell you when it is done.</p>
          </div>
        </div>
      </section>

      <section className="py-14" aria-labelledby="report-heading">
        <div className={wrap}>
          <h2 id="report-heading" className={h2}>Tell us about a barrier</h2>
          <div className={prose}>
            <p>Email <a href="mailto:success@accessyourplace.com?subject=Accessibility%20barrier" className={`${gold} underline underline-offset-2`}>success@accessyourplace.com</a> with the subject "Accessibility barrier". It goes straight to the team, and every one is read.</p>
          </div>
        </div>
      </section>
    </CompanyLayout>
  );
}
