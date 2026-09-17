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


// ── Public Access Your Place pages ──────────────────────────────────────────────
const AYP_ORG = {
  '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'Access Your Place', url: SITE,
  logo: `${SITE}/og-image.jpg`, email: 'success@accessyourplace.com',
  parentOrganization: { '@id': ORG['@id'], '@type': 'Organization', name: 'Set Up Your Place LLC' },
};
const page = (path, title, description, h1, paras, extra = {}) => ({
  title, description, type: 'website', h1,
  body: paras.map((x) => (Array.isArray(x) ? x : ['p', x])),
  schema: [
    { '@type': 'WebPage', name: title, url: SITE + path, description, publisher: { '@id': AYP_ORG['@id'] } },
    crumbs([['Home', '/'], [h1, path]]),
    ...(extra.schema || []),
  ],
  ...extra.opts,
});

Object.assign(PAGES, {
  '/deals': page('/deals',
    'Turnkey Furnished Rental Operations for Sale | Access Your Place',
    'Furnished rental businesses that are already running, and verified deals ready to launch. Every listing is checked with the landlord before it goes live. Addresses are shared after you commit.',
    'Furnished rental deals and running operations',
    ['Browse furnished rental operations that are already running and deals ready to launch. Every verified listing has been checked with the landlord, and the numbers have been reviewed by our team.',
     'Street addresses are kept private until you commit, to protect landlords and sellers.']),
  '/start': page('/start',
    'Get Started | Access Your Place',
    'Sell a furnished rental operation, acquire a property, book setup or teardown, or list your property as a landlord or apartment community. No account required.',
    'Let\u2019s get you to the right person',
    ['Choose what you need: sell an operation you already run, acquire a property to operate, get a unit set up, get a unit taken down or moved, list a property as a landlord or apartment community, or get urgent help with a live operation.']),
  '/how-it-works': page('/how-it-works',
    'How It Works | Access Your Place',
    'Three departments, one launch engine. How Acquisition Managers, Setup Managers and the Success Team take a furnished rental from deal to launch.',
    'How Access Your Place works',
    ['Acquisition Managers find and negotiate the deal. Setup Managers furnish and launch it. The Success Team handles documents, compliance and support.']),
  '/setup-services': page('/setup-services',
    'Furnished Rental Setup Services | Access Your Place',
    'Fourteen days from sourcing to guest-ready. Furniture, freight, junk removal, technology install and styling for one unit or an entire building.',
    'Property setup services',
    ['Furniture and supply sourcing, freight, junk removal, technology install and styling, for one unit or a whole building.']),
  '/landlord-partnership': page('/landlord-partnership',
    'Landlord and Apartment Community Partnerships | Access Your Place',
    'Partner with Access Your Place to place vetted furnished rental and corporate housing operators in your units. Individual landlords, property managers and apartment communities.',
    'Landlord partnership program',
    ['We place vetted operators and corporate tenants in your units, and speak to every landlord before a property goes in front of an operator.']),
  '/list-your-property': page('/list-your-property',
    'List Your Property | Access Your Place',
    'Landlords and owners: tell us about your property. We vet every property and speak to every landlord before it goes in front of an operator.',
    'List your property with Access Your Place',
    ['Tell us about your property. We vet every property and speak to every landlord before it goes in front of an operator.']),
  '/penny-ai': page('/penny-ai',
    'Penny, the Access Your Place Deal Assistant',
    'Penny answers questions about furnished rental deals: what a listing earns, how the acquisition fee is repaid, and how each deal is scored.',
    'Penny, your deal assistant',
    ['Ask Penny what a listing earns, how the acquisition fee is repaid, and how each deal is scored.']),
  '/core-values': page('/core-values',
    'Core Values | Access Your Place',
    'The ten operating principles behind Access Your Place. Data over dreams, collaboration over competition, and housing that cannot wait.',
    'Our core values',
    ['Ten operating principles: collaboration, cash flow, data over dreams, furnished rental businesses beyond one platform, integrity, and housing that cannot wait.']),
  '/careers': page('/careers',
    'Careers: Acquisition and Setup Managers | Access Your Place',
    'We are hiring Acquisition Managers and Setup Managers. A four-month certification program, cross-training, and commission tied to deals sourced, closed and launched.',
    'We\u2019re hiring Acquisition Managers and Setup Managers',
    ['Get certified, cross-train in both roles, and build your own book. Commission is tied to deals sourced, deals closed and operations launched.',
     ['p', 'More about the company: accessyourplace.com/setupyourplace/careers']]),
  '/knowledge-library': page('/knowledge-library',
    'Knowledge Library: Furnished Rental Guides and Local Regulations | Access Your Place',
    'Free guides on furnished rentals, rental arbitrage, co-living and corporate housing, including city-by-city short-term rental regulations with sources.',
    'Knowledge library',
    ['Free guides on furnished rentals, rental arbitrage, co-living and corporate housing, including city-by-city regulations with their sources.']),
  '/privacy-policy': page('/privacy-policy',
    'Privacy Policy | Access Your Place',
    'How Access Your Place collects, uses and protects your personal information.',
    'Privacy policy', ['How we collect, use and protect your personal information.']),
  '/terms-of-service': page('/terms-of-service',
    'Terms of Service | Access Your Place',
    'Terms of Service for Access Your Place: acquisition services, payment terms, refunds and user responsibilities.',
    'Terms of service', ['Our terms for acquisition services, payments, refunds and user responsibilities.']),
});
PAGES['/'] = {
  ...page('/',
    'Access Your Place | Turnkey Furnished Rental Operations Without Buying Property',
    'Run a furnished rental business without buying the property. Verified deals checked with the landlord, running operations for sale, lease negotiation, setup and support in the United States and Mexico.',
    'Furnished rental operations, without buying the property',
    ['Access Your Place finds furnished rental opportunities, checks them with the landlord, negotiates the lease, and sets the unit up with our logistics network and team.',
     ['h2', 'Where to start'],
     ['p', 'Browse deals at /deals. Tell us what you need at /start. Landlords: /landlord-partnership.']]),
  keepShellSchema: true,
};

// Addresses that are other addresses. Sent as real redirects so search engines follow them.
const REDIRECTS = {
  '/deal-flow': '/deals', '/client-access': '/investor/login', '/article-demo': '/knowledge-library',
  '/knowledge': '/knowledge-library', '/accessibility': '/setupyourplace/accessibility',
  '/press': '/setupyourplace/press', '/set-up-your-place': '/setupyourplace', '/company': '/setupyourplace',
  '/investor-login': '/investor/login', '/staff-login': '/staff/login', '/staff': '/staff/workspace',
  '/staff/dashboard': '/staff/workspace',
  '/community-standards': '/pages/community-standards.html',
};

// Real pages that are private or one-time: served normally, kept out of search results.
const PRIVATE = [
  /^\/staff(\/|$)/, /^\/admin(\/|$)/, /^\/investor\/?$/, /^\/investor\/(portal|reset-password|unsubscribe|verify-email)/,
  /^\/landlord\/(portal|reset-password|login)/, /^\/investor\/login/, /^\/pro-portal\//, /^\/am-agreement\//, /^\/oauth\//, /^\/legal-agreement-gate/,
];

// ── Deals and articles, read live ──────────────────────────────────────────────
const REST = (process.env.SUPABASE_PUBLIC_REST_URL || 'https://adcbrclppmnguzkzwiys.supabase.co') + '/rest/v1';
// The publishable key: both views are public by design, so nothing stronger is needed.
const PUBLIC_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_rcKz17ALYwdZs3OKrUGhQQ_0eLzF8mg';
const cache = new Map();
async function readJson(pathAndQuery) {
  const hit = cache.get(pathAndQuery);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`${REST}/${pathAndQuery}`, { headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${PUBLIC_KEY}` }, signal: ctrl.signal });
    if (!r.ok) return undefined; // unknown, not "none"
    const value = await r.json();
    cache.set(pathAndQuery, { at: Date.now(), value });
    return value;
  } catch { return undefined; } finally { clearTimeout(timer); }
}
const money = (n) => (typeof n === 'number' && n > 0 ? `$${Math.round(n).toLocaleString('en-US')}` : null);
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}\u2026` : t; };

async function dealPage(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { notFound: true };
  const rows = await readJson(`marketplace_public?id=eq.${id}&select=id,listing_title,operation_type,city,state,bedrooms,bathrooms,monthly_rent,acquisition_fee,description,photos,is_third_party_seller,verification_tier,projected_monthly_revenue_peak,projected_monthly_revenue_slow,created_at&limit=1`);
  if (rows === undefined) return null; // could not look: serve the plain shell, never a false 404
  const d = rows[0];
  if (!d) return { notFound: true };
  const where = [d.city, d.state].filter(Boolean).join(', ');
  const kind = d.is_third_party_seller ? 'Running furnished rental operation for sale' : 'Furnished rental deal';
  // Same shape as the page's own title (src/components/marketplace/DealSEO.tsx), so the two agree.
  const shape = d.operation_type === 'coliving' ? 'shared living' : d.operation_type === 'mtr' ? 'mid-term rental'
    : d.operation_type === 'str' ? 'short-term rental' : 'furnished rental';
  const title = [d.bedrooms ? `${d.bedrooms} bed` : '', d.bathrooms ? `${d.bathrooms} bath` : '', shape,
    where ? `in ${where}` : '', '| Access Your Place'].filter(Boolean).join(' ');
  const facts = [
    d.bedrooms != null && `${d.bedrooms} bedroom${d.bedrooms === 1 ? '' : 's'}`,
    d.bathrooms != null && `${d.bathrooms} bath${d.bathrooms === 1 ? '' : 's'}`,
    money(d.monthly_rent) && `rent ${money(d.monthly_rent)} a month`,
    money(d.acquisition_fee) && `acquisition fee ${money(d.acquisition_fee)}`,
  ].filter(Boolean).join(', ');
  const description = clip(`${kind}${where ? ` in ${where}` : ''}: ${facts}. ${d.verification_tier === 'ayp_verified' ? 'Verified by Access Your Place. ' : ''}${d.description || ''}`, 300);
  const image = Array.isArray(d.photos) && d.photos[0] ? d.photos[0] : null;
  const path = `/deals/${d.id}`;
  return {
    path, title, description, type: 'product', image,
    h1: d.listing_title || kind,
    body: [['p', `${kind}${where ? ` in ${where}` : ''}. ${facts}.`], ['p', clip(d.description, 1200)]],
    schema: [
      {
        '@type': 'Product', name: d.listing_title || kind, description, url: SITE + path,
        ...(image ? { image } : {}),
        brand: { '@id': AYP_ORG['@id'] },
        ...(money(d.acquisition_fee) ? { offers: { '@type': 'Offer', price: Math.round(d.acquisition_fee), priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: SITE + path } } : {}),
      },
      crumbs([['Home', '/'], ['Deals', '/deals'], [d.listing_title || kind, path]]),
    ],
  };
}

async function articlePage(slug) {
  if (!/^[a-z0-9-]{1,160}$/i.test(slug)) return { notFound: true };
  const rows = await readJson(`blog_articles?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=title,slug,excerpt,meta_description,seo_title,seo_description,image_url,city,state,category,publish_date,published_at,updated_at,content&limit=1`);
  if (rows === undefined) return null;
  const a = rows[0];
  if (!a) return { notFound: true };
  const path = `/blog/${a.slug}`;
  const title = `${a.seo_title || a.title} | Access Your Place`;
  const description = clip(a.seo_description || a.meta_description || a.excerpt || a.content, 300);
  const text = clip(String(a.content || '').replace(/<[^>]+>/g, ' ').replace(/[#*_>`]/g, ''), 1500);
  return {
    path, title, description, type: 'article', image: a.image_url || null,
    h1: a.title,
    body: [['p', description], ['p', text]],
    schema: [
      {
        '@type': 'Article', headline: clip(a.title, 110), description, url: SITE + path,
        ...(a.image_url ? { image: a.image_url } : {}),
        datePublished: a.published_at || a.publish_date || undefined,
        dateModified: a.updated_at || a.published_at || undefined,
        author: { '@id': AYP_ORG['@id'] }, publisher: AYP_ORG,
        mainEntityOfPage: SITE + path,
      },
      crumbs([['Home', '/'], ['Knowledge library', '/knowledge-library'], [clip(a.title, 80), path]]),
    ],
  };
}

// Every route the app knows, so an unknown address can honestly be called not found.
const KNOWN = [/^\/deals\/[^/]+$/, /^\/blog\/[^/]+$/, /^\/investor\/login$/, /^\/landlord\/login$/, /^\/pro-portal\/[^/]+$/, /^\/am-agreement\/[^/]+$/];

async function resolve(pathname) {
  const clean = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (REDIRECTS[clean]) return { redirect: REDIRECTS[clean] };
  if (PAGES[clean]) return { page: { path: clean, ...PAGES[clean] } };
  if (PRIVATE.some((re) => re.test(clean))) return { noindex: true };
  let m = clean.match(/^\/deals\/([^/]+)$/);
  if (m) { const r = await dealPage(m[1]); return r === null ? {} : r.notFound ? { notFound: true } : { page: r }; }
  m = clean.match(/^\/blog\/([^/]+)$/);
  if (m) { const r = await articlePage(m[1]); return r === null ? {} : r.notFound ? { notFound: true } : { page: r }; }
  if (KNOWN.some((re) => re.test(clean))) return {};
  return { notFound: true };
}

async function deals() {
  const rows = await readJson('marketplace_public?select=id,created_at&order=created_at.desc&limit=500');
  return Array.isArray(rows) ? rows : undefined;
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
  if (page.image) {
    set(/<meta property="og:image" [^>]*>/, `<meta property="og:image" content="${esc(page.image)}" />`);
    set(/<meta name="twitter:image" [^>]*>/, `<meta name="twitter:image" content="${esc(page.image)}" />`);
    html = html.replace(/<meta property="og:image:(width|height)"[^>]*>\s*/g, '');
  }
  const alt = page.path.startsWith('/setupyourplace') ? 'Set Up Your Place LLC' : page.h1;
  set(/<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${esc(alt)}" />`);
  set(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(page.title)}" />`);
  set(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(page.description)}" />`);
  set(/<meta name="twitter:image:alt"[^>]*>/, `<meta name="twitter:image:alt" content="${esc(alt)}" />`);
  // The shell's keywords describe rental arbitrage; they do not belong on the company pages.
  if (page.path !== '/') html = html.replace(/<meta name="keywords"[^>]*>\s*/, '');
  // Replace the homepage's structured data with this page's (the homepage keeps its own too).
  if (!page.keepShellSchema) html = html.replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/g, '');
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': page.schema }).replace(/</g, '\\u003c');
  html = html.replace('</head>', `<script type="application/ld+json">${ld}</script>\n</head>`);

  const isCompany = page.path.startsWith('/setupyourplace');
  const nav = COMPANY_NAV.map(([p, l]) => `<li><a href="${p}"${p === page.path ? ' aria-current="page"' : ''}>${l}</a></li>`).join('');
  const body = page.body.map(([t, text]) => `<${t}>${esc(text)}</${t}>`).join('');
  const header = isCompany
    ? `<header><a href="/setupyourplace">Set Up Your Place LLC</a><nav aria-label="Company"><ul>${nav}<li><a href="/">Access Your Place</a></li></ul></nav></header>`
    : `<header><a href="/">Access Your Place</a><nav aria-label="Main"><ul><li><a href="/deals">Deals</a></li><li><a href="/start">Get started</a></li><li><a href="/how-it-works">How it works</a></li><li><a href="/setup-services">Setup services</a></li><li><a href="/landlord-partnership">Landlords</a></li><li><a href="/knowledge-library">Knowledge library</a></li><li><a href="/setupyourplace">Company</a></li></ul></nav></header>`;
  const prerender = `${header}<main><h1>${esc(page.h1)}</h1>${body}</main>`;
  html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${prerender}</div>`);
  return html;
}

function noindex(html) {
  return html
    .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, nofollow" />')
    .replace(/<link rel="canonical"[^>]*>\s*/, '');
}
function notFoundHtml(html, pathname) {
  html = noindex(html);
  return html.replace(/<title>[\s\S]*?<\/title>/, '<title>Page not found | Access Your Place</title>');
}

// Older static copies under /pages/. Most duplicate an app page, so they point search
// engines at it; community standards only exists here, so it points at itself.
const STATIC_CANONICAL = {
  'index.html': '/', 'how-it-works.html': '/how-it-works', 'core-values.html': '/core-values',
  'careers.html': '/careers', 'privacy-policy.html': '/privacy-policy', 'terms-of-service.html': '/terms-of-service',
  'community-standards.html': '/pages/community-standards.html',
};
function staticPageHeaders(req, res, next) {
  const m = req.path.match(/^\/pages\/([a-z0-9-]+\.html)$/);
  if (m) {
    const c = STATIC_CANONICAL[m[1]];
    if (c) res.set('Link', `<${SITE}${c}>; rel="canonical"`);
    else res.set('X-Robots-Tag', 'noindex');
  }
  next();
}

module.exports = { staticPageHeaders, resolve, renderPage, noindex, notFoundHtml, deals, PAGES, REDIRECTS };
