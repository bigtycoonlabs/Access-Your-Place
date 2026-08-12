/**
 * Sitemap Generator Utility
 * Generates XML sitemaps for SEO optimization
 */

const BASE_URL = 'https://accessyourplace.com';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  images?: Array<{
    loc: string;
    title?: string;
    caption?: string;
  }>;
}

// Static pages with their priorities and change frequencies
export const staticPages: SitemapUrl[] = [
  { loc: '/', changefreq: 'daily', priority: 1.0 },
  { loc: '/deals', changefreq: 'daily', priority: 0.9 },
  { loc: '/knowledge-library', changefreq: 'daily', priority: 0.9 },
  { loc: '/setup-services', changefreq: 'weekly', priority: 0.8 },
  { loc: '/landlord-partnership', changefreq: 'weekly', priority: 0.7 },
  { loc: '/investor-login', changefreq: 'monthly', priority: 0.5 },
  { loc: '/privacy-policy', changefreq: 'yearly', priority: 0.3 },
  { loc: '/terms-of-service', changefreq: 'yearly', priority: 0.3 },
];

// Generate XML for a single URL entry
function generateUrlEntry(url: SitemapUrl): string {
  let entry = `  <url>\n`;
  entry += `    <loc>${BASE_URL}${url.loc}</loc>\n`;
  
  if (url.lastmod) {
    entry += `    <lastmod>${url.lastmod}</lastmod>\n`;
  }
  
  if (url.changefreq) {
    entry += `    <changefreq>${url.changefreq}</changefreq>\n`;
  }
  
  if (url.priority !== undefined) {
    entry += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
  }
  
  // Image sitemap extension
  if (url.images && url.images.length > 0) {
    url.images.forEach(image => {
      entry += `    <image:image>\n`;
      entry += `      <image:loc>${image.loc}</image:loc>\n`;
      if (image.title) {
        entry += `      <image:title>${escapeXml(image.title)}</image:title>\n`;
      }
      if (image.caption) {
        entry += `      <image:caption>${escapeXml(image.caption)}</image:caption>\n`;
      }
      entry += `    </image:image>\n`;
    });
  }
  
  entry += `  </url>\n`;
  return entry;
}

// Escape special XML characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate the main sitemap XML
export function generateMainSitemap(urls: SitemapUrl[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;
  
  urls.forEach(url => {
    xml += generateUrlEntry(url);
  });
  
  xml += `</urlset>`;
  return xml;
}

// Generate sitemap index for multiple sitemaps
export function generateSitemapIndex(sitemaps: Array<{ loc: string; lastmod?: string }>): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  sitemaps.forEach(sitemap => {
    xml += `  <sitemap>\n`;
    xml += `    <loc>${BASE_URL}${sitemap.loc}</loc>\n`;
    if (sitemap.lastmod) {
      xml += `    <lastmod>${sitemap.lastmod}</lastmod>\n`;
    }
    xml += `  </sitemap>\n`;
  });
  
  xml += `</sitemapindex>`;
  return xml;
}

// Generate article URLs from blog articles
export function generateArticleUrls(articles: Array<{
  slug: string;
  publishDate?: string;
  imageUrl?: string;
  title?: string;
}>): SitemapUrl[] {
  return articles.map(article => ({
    loc: `/blog/${article.slug}`,
    lastmod: article.publishDate || new Date().toISOString().split('T')[0],
    changefreq: 'monthly' as const,
    priority: 0.7,
    ...(article.imageUrl && {
      images: [{
        loc: article.imageUrl,
        title: article.title,
      }],
    }),
  }));
}

// Generate property/deal URLs
export function generateDealUrls(deals: Array<{
  id: string;
  city: string;
  state: string;
  imageUrl?: string;
  title?: string;
}>): SitemapUrl[] {
  return deals.map(deal => ({
    loc: `/deals?property=${deal.id}`,
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'weekly' as const,
    priority: 0.8,
    ...(deal.imageUrl && {
      images: [{
        loc: deal.imageUrl,
        title: deal.title || `Property in ${deal.city}, ${deal.state}`,
      }],
    }),
  }));
}

// Generate market-specific URLs
export function generateMarketUrls(markets: string[]): SitemapUrl[] {
  return markets.map(market => ({
    loc: `/deals?market=${encodeURIComponent(market.toLowerCase())}`,
    changefreq: 'weekly' as const,
    priority: 0.6,
  }));
}

// List of all markets for sitemap generation
export const allMarkets = [
  'Atlanta, GA',
  'Austin, TX',
  'Charlotte, NC',
  'Dallas, TX',
  'Denver, CO',
  'Houston, TX',
  'Jacksonville, FL',
  'Los Angeles, CA',
  'Miami, FL',
  'Nashville, TN',
  'Orlando, FL',
  'Phoenix, AZ',
  'San Antonio, TX',
  'San Diego, CA',
  'Tampa, FL',
  'Albuquerque, NM',
  'Arlington, TX',
  'Asheville, NC',
  'Charleston, SC',
  'Cleveland, OH',
  'Columbia, SC',
  'Columbus, OH',
  'Georgetown, TX',
  'Leander, TX',
  'Louisville, KY',
  'New York, NY',
  'Panama City Beach, FL',
  'Philadelphia, PA',
  'Portland, OR',
  'Reno, NV',
  'Santa Fe, NM',
  'St. Augustine, FL',
  'West Palm Beach, FL',
  'Wilmington, NC',
];

// Generate complete sitemap data
export function generateCompleteSitemapData(): {
  mainSitemap: string;
  articlesSitemap: string;
  marketsSitemap: string;
  sitemapIndex: string;
} {
  const today = new Date().toISOString().split('T')[0];
  
  // Main sitemap with static pages
  const mainUrls = staticPages.map(page => ({
    ...page,
    lastmod: today,
  }));
  
  // Market URLs
  const marketUrls = generateMarketUrls(allMarkets);
  
  return {
    mainSitemap: generateMainSitemap(mainUrls),
    articlesSitemap: '', // Would be populated from actual articles
    marketsSitemap: generateMainSitemap(marketUrls),
    sitemapIndex: generateSitemapIndex([
      { loc: '/sitemap-main.xml', lastmod: today },
      { loc: '/sitemap-articles.xml', lastmod: today },
      { loc: '/sitemap-markets.xml', lastmod: today },
      { loc: '/sitemap-deals.xml', lastmod: today },
    ]),
  };
}

// Export for use in edge functions or build scripts
export default {
  generateMainSitemap,
  generateSitemapIndex,
  generateArticleUrls,
  generateDealUrls,
  generateMarketUrls,
  generateCompleteSitemapData,
  staticPages,
  allMarkets,
};
