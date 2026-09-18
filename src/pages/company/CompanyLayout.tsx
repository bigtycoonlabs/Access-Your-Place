import { ReactNode, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import CompanyFooter from './CompanyFooter';

// Shared frame for the Set Up Your Place company site: a skip link, one labelled navigation
// with the current page marked, one main landmark, and the site footer. Moving between pages
// puts focus on the new page's heading so a screen reader announces where you arrived.

let companyPageShown = false;

export const COMPANY_PAGES = [
  { to: '/setupyourplace', label: 'Home' },
  { to: '/setupyourplace/about', label: 'About' },
  { to: '/setupyourplace/accessibility', label: 'Accessibility' },
  { to: '/setupyourplace/careers', label: 'Careers' },
  { to: '/setupyourplace/library', label: 'Library' },
  { to: '/setupyourplace/press', label: 'Press' },
];

export const gold = 'text-[#d4a574]';
export const section = 'py-14 border-b border-white/10';
export const wrap = 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8';
export const h2 = 'text-2xl md:text-3xl font-bold mb-5';
export const prose = 'space-y-4 text-white/85 text-lg leading-relaxed';

export default function CompanyLayout({ eyebrow, title, intro, children }: {
  eyebrow: string; title: string; intro: ReactNode; children: ReactNode;
}) {
  const { pathname } = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Each company page mounts its own layout, so "have we already shown a company page this
  // visit" lives at module level. The first page loads normally; every page after that moves
  // focus to its heading.
  useEffect(() => {
    if (companyPageShown) headingRef.current?.focus();
    companyPageShown = true;
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <a href="#company-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[#d4a574] focus:px-4 focus:py-2 focus:text-[#0a0f1a]">
        Skip to content
      </a>
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/setupyourplace" className="min-h-[44px] inline-flex items-center text-lg font-bold">
            Set Up Your Place <span className={`ml-1 ${gold}`}>LLC</span>
          </Link>
          <nav aria-label="Company">
            <ul className="flex flex-wrap items-center gap-1" role="list">
              {COMPANY_PAGES.map((p) => {
                const current = pathname.replace(/\/$/, '') === p.to;
                return (
                  <li key={p.to}>
                    <Link
                      to={p.to}
                      aria-current={current ? 'page' : undefined}
                      className={`inline-flex min-h-[44px] items-center rounded-md px-3 ${current ? 'bg-white/10 text-[#d4a574] font-semibold' : 'text-white/85 hover:text-white'} focus:outline-none focus:ring-2 focus:ring-[#d4a574]`}
                    >
                      {p.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link to="/" className="inline-flex min-h-[44px] items-center rounded-md px-3 text-white/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d4a574]">
                  <span aria-hidden="true" className="mr-1">↗</span>Access Your Place
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="company-main">
        <section className="py-16 border-b border-white/10">
          <div className={wrap}>
            <p className="text-xs font-mono tracking-widest text-white/60 uppercase mb-4">{eyebrow}</p>
            <h1 ref={headingRef} tabIndex={-1} className="text-4xl md:text-5xl font-bold mb-6 leading-tight focus:outline-none">{title}</h1>
            <div className="text-xl text-white/85 leading-relaxed max-w-3xl">{intro}</div>
          </div>
        </section>
        {children}
      </main>
      <CompanyFooter />
    </div>
  );
}
