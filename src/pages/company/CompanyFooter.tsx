import { Link } from 'react-router-dom';
import { COMPANY_PAGES, gold } from './CompanyLayout';

// The company site's own footer. Deliberately not the Access Your Place footer: this is a
// different website, for the parent company. Access Your Place appears here only as one of
// the three platforms, the same as the other two.

const platforms = [
  { label: 'Access Your Place', href: 'https://accessyourplace.com/?utm_source=setupyourplace&utm_medium=company_footer', note: 'Furnished rental operations' },
  { label: 'Access YP Labs', href: 'https://accessyplabs.com/?utm_source=setupyourplace&utm_medium=company_footer', note: 'The back office, with Penny' },
  { label: 'Access YP Flow', href: 'https://accessypflow.com/?utm_source=setupyourplace&utm_medium=company_footer', note: 'Bookkeeping and cash flow, with Arbo' },
];

export default function CompanyFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#070b13]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="text-lg font-bold">Set Up Your Place <span className={gold}>LLC</span></p>
            <p className="mt-3 text-white/75 leading-relaxed">
              A technology company. Three platforms, built from five years of real operations.
            </p>
            <p className="mt-3 text-white/75">
              <a href="mailto:success@accessyourplace.com" className={`${gold} underline underline-offset-2`}>success@accessyourplace.com</a>
            </p>
          </div>

          <nav aria-labelledby="footer-company">
            <h2 id="footer-company" className="font-semibold mb-3">Company</h2>
            <ul className="space-y-1" role="list">
              {COMPANY_PAGES.map((p) => (
                <li key={p.to}>
                  <Link to={p.to} className="inline-flex min-h-[44px] items-center text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d4a574]">{p.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-platforms">
            <h2 id="footer-platforms" className="font-semibold mb-3">Our platforms</h2>
            <ul className="space-y-2" role="list">
              {platforms.map((p) => (
                <li key={p.label}>
                  <a href={p.href} className="inline-flex min-h-[44px] items-center text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d4a574]">{p.label}</a>
                  <span className="block text-sm text-white/55 -mt-2">{p.note}</span>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-12 pt-6 border-t border-white/10 text-sm text-white/55">
          © {new Date().getFullYear()} Set Up Your Place LLC. Written to be read aloud. If any of it does not work with
          your screen reader, that is our defect and we want to hear about it.
        </p>
      </div>
    </footer>
  );
}
