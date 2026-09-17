// Page details for crawlers and link previews.
//
// The site is a single-page app: every address gets the same index.html, whose head says
// "Access Your Place homepage" and whose canonical link points at "/". Search engines that
// do not run JavaScript, link previews, and AI crawlers therefore saw every company page as
// a duplicate of the homepage. For the pages listed here the server now writes the real
// title, description, canonical address, preview tags and structured data into the head,
// and puts the page's text inside #root, which React replaces when it starts.

const SITE = 'https://accessyourplace.com';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/setupyourplace#organization`,
  name: 'Set Up Your Place LLC',
  url: `${SITE}/setupyourplace`,
  logo: `${SITE}/og-image.jpg`,
  email: 'success@accessyourplace.com',
  description: 'A technology company behind Access Your Place, Access YP Labs and Access YP Flow.',
  founder: [
    { '@type': 'Person', name: 'Vission Cooper' },
    { '@type': 'Person', name: 'Rel Cooper' },
  ],
  areaServed: ['United States', 'Mexico'],
  contactPoint: [
    { '@type': 'ContactPoint', contactType: 'customer support', email: 'success@accessyourplace.com' },
    { '@type': 'ContactPoint', contactType: 'media relations', email: 'success@accessyourplace.com', url: `${SITE}/setupyourplace/press` },
  ],
  sameAs: ['https://accessypflow.com', 'https://accessyplabs.com'],
  brand: [
    { '@type': 'Brand', name: 'Access Your Place', url: SITE },
    { '@type': 'Brand', name: 'Access YP Labs', url: 'https://accessyplabs.com' },
    { '@type': 'Brand', name: 'Access YP Flow', url: 'https://accessypflow.com' },
  ],
};

const crumbs = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })),
});

const COMPANY_NAV = [
  ['/setupyourplace', 'About'],
  ['/setupyourplace/accessibility', 'Accessibility'],
  ['/setupyourplace/careers', 'Careers'],
  ['/setupyourplace/press', 'Press'],
];

const PAGES = {
  '/setupyourplace': {
    title: 'About Set Up Your Place LLC | Access Your Place, YP Labs and YP Flow',
    description: 'Set Up Your Place LLC is a technology company founded by Vission and Rel Cooper. Access Your Place, Access YP Labs and Access YP Flow were built from five years of serving hundreds of business owners.',
    type: 'website',
    schema: [
      ORG,
      { '@type': 'AboutPage', name: 'About Set Up Your Place LLC', url: `${SITE}/setupyourplace`, about: { '@id': ORG['@id'] } },
      crumbs([['Home', '/'], ['Set Up Your Place', '/setupyourplace']]),
    ],
    h1: 'Set Up Your Place: access for everyone.',
    body: [
      ['p', 'Set Up Your Place LLC is a technology company. We build three platforms today, and every one of them came from the work: five years of serving hundreds of business owners, the data from running real operations, and the things people kept asking us for.'],
      ['h2', 'Our story'],
      ['p', 'Set Up Your Place was founded by Vission and Rel Cooper, husband and wife. It began with Access Your Place: helping people run full-service furnished rental operations without having to buy the property, backed by our own logistics network and team. Vission and Rel are both blind and use screen readers every day, so every platform we make is built to be reachable and to tell the truth.'],
      ['h2', 'The network we have built'],
      ['p', 'Landlords and property managers, apartment communities, furnished rental operators, business owners, housekeeping companies, maintenance companies, local home service providers, and furniture and supply vendors.'],
      ['h2', 'Our platforms'],
      ['p', 'Access Your Place: furnished rental operations without buying the property, in the United States and Mexico. Access YP Labs: the back office for a small business, run by Penny. Access YP Flow: idle business cash put to work on the owner\u2019s own exchange account, explained by Arbo.'],
      ['h2', 'What we believe'],
      ['p', 'Our mission is to give access to everyone. AI should help people, not harm them.'],
    ],
  },
  '/setupyourplace/accessibility': {
    title: 'Accessibility | Set Up Your Place LLC',
    description: 'Built by blind founders who use screen readers every day. How Access Your Place, Access YP Labs and Access YP Flow are built for assistive technology, and how to report a barrier.',
    type: 'website',
    schema: [
      { '@type': 'WebPage', name: 'Accessibility at Set Up Your Place', url: `${SITE}/setupyourplace/accessibility`, publisher: { '@id': ORG['@id'] } },
      crumbs([['Home', '/'], ['Set Up Your Place', '/setupyourplace'], ['Accessibility', '/setupyourplace/accessibility']]),
    ],
    h1: 'Built by people who use screen readers.',
    body: [
      ['p', 'Our founders, Vission and Rel Cooper, are both blind. Accessibility is not a feature we add at the end. It is how everything starts.'],
      ['h2', 'How we build'],
      ['p', 'Screen readers first. Every field has a name. Status you can hear. Room to tap. Meaning without colour. Plain sentences over dense tables. Honest about what happened.'],
      ['h2', 'Tell us about a barrier'],
      ['p', 'Email success@accessyourplace.com with the subject "Accessibility barrier".'],
    ],
  },
  '/setupyourplace/careers': {
    title: 'Careers | Set Up Your Place LLC',
    description: 'Join Set Up Your Place: commission-based Acquisition Manager, Setup Manager and Admin roles at Access Your Place, administration roles at Access YP Flow and Access YP Labs, and entrepreneurs who want AI to help people.',
    type: 'website',
    schema: [
      { '@type': 'WebPage', name: 'Careers at Set Up Your Place', url: `${SITE}/setupyourplace/careers`, publisher: { '@id': ORG['@id'] } },
      crumbs([['Home', '/'], ['Set Up Your Place', '/setupyourplace'], ['Careers', '/setupyourplace/careers']]),
    ],
    h1: 'Grow with a team that builds access.',
    body: [
      ['p', 'We are looking for operators, organisers and entrepreneurs who are excited about using AI to help people, not harm them.'],
      ['h2', 'Access Your Place: commission-based roles'],
      ['p', 'Acquisition Manager, Setup Manager and Admin. Full role details, training and commission: accessyourplace.com/careers.'],
      ['h2', 'Access YP Flow and Access YP Labs: administration'],
      ['h2', 'Entrepreneurs and builders'],
    ],
  },
  '/setupyourplace/press': {
    title: 'Press and Media | Set Up Your Place LLC',
    description: 'Interview Vission and Rel Cooper, blind founders of Set Up Your Place LLC. Podcasts, interviews, articles, video and events. Request an interview.',
    type: 'website',
    schema: [
      ORG,
      { '@type': 'WebPage', name: 'Press and media', url: `${SITE}/setupyourplace/press`, publisher: { '@id': ORG['@id'] } },
      crumbs([['Home', '/'], ['Set Up Your Place', '/setupyourplace'], ['Press', '/setupyourplace/press']]),
    ],
    h1: 'We are available.',
    body: [
      ['p', 'Podcasts, interviews, articles, video and events. If you would like to speak with our founders or anyone on our team, we would love to hear from you.'],
      ['h2', 'About us, in brief'],
      ['p', 'Set Up Your Place LLC is a technology company founded by Vission and Rel Cooper, a husband and wife who are both blind. It runs Access Your Place, Access YP Labs and Access YP Flow, with operations in the United States and Mexico.'],
      ['h2', 'What we can talk about'],
      ['p', 'Building a technology company as blind founders. Furnished rental operations without owning the property. Accessible and honest AI. Small business compliance. Putting idle business cash to work.'],
      ['h2', 'Request an interview'],
      ['p', 'Email success@accessyourplace.com.'],
    ],
  },
};

function pageFor(pathname) {
  const clean = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return PAGES[clean] ? { path: clean, ...PAGES[clean] } : null;
}

function renderPage(html, page) {
  const url = SITE + page.path;
  const set = (re, tag) => { html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}\n</head>`); };
  set(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`);
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(page.description)}" />`);
  set(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);
  set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`);
  set(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${page.type}" />`);
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(page.title)}" />`);
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(page.description)}" />`);
  set(/<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="Set Up Your Place LLC" />`);
  set(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(page.title)}" />`);
  set(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(page.description)}" />`);
  set(/<meta name="twitter:image:alt"[^>]*>/, `<meta name="twitter:image:alt" content="Set Up Your Place LLC" />`);
  // The shell's keywords describe rental arbitrage; they do not belong on the company pages.
  html = html.replace(/<meta name="keywords"[^>]*>\s*/, '');
  // Replace the homepage's structured data with this page's.
  html = html.replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/g, '');
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': page.schema }).replace(/</g, '\\u003c');
  html = html.replace('</head>', `<script type="application/ld+json">${ld}</script>\n</head>`);

  const nav = COMPANY_NAV.map(([p, l]) => `<li><a href="${p}"${p === page.path ? ' aria-current="page"' : ''}>${l}</a></li>`).join('');
  const body = page.body.map(([t, text]) => `<${t}>${esc(text)}</${t}>`).join('');
  const prerender = `<header><a href="/setupyourplace">Set Up Your Place LLC</a><nav aria-label="Company"><ul>${nav}<li><a href="/">Access Your Place</a></li></ul></nav></header><main><h1>${esc(page.h1)}</h1>${body}</main>`;
  html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${prerender}</div>`);
  return html;
}

module.exports = { pageFor, renderPage, PAGES };
