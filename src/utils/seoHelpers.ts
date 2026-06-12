/**
 * SEO Helper Utilities
 * Functions for generating optimized meta content and structured data
 */

const BASE_URL = 'https://accessyourplace.com';
const SITE_NAME = 'Access Your Place';

// ============================================
// META TAG HELPERS
// ============================================

/**
 * Generate optimized title tag (50-60 characters ideal)
 */
export function generateTitle(title: string, includeBrand = true): string {
  const maxLength = includeBrand ? 50 : 60;
  const suffix = includeBrand ? ` | ${SITE_NAME}` : '';
  
  if (title.length + suffix.length <= 60) {
    return `${title}${suffix}`;
  }
  
  // Truncate title if too long
  const truncatedTitle = title.substring(0, maxLength - 3) + '...';
  return `${truncatedTitle}${suffix}`;
}

/**
 * Generate optimized meta description (150-160 characters ideal)
 */
export function generateDescription(description: string, maxLength = 160): string {
  if (description.length <= maxLength) {
    return description;
  }
  
  // Find last complete word within limit
  const truncated = description.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace) + '...';
}

/**
 * Generate keywords from content
 */
export function extractKeywords(content: string, maxKeywords = 10): string[] {
  // Common words to exclude
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when',
    'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then'
  ]);

  // Extract words and count frequency
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  const wordCount = new Map<string, number>();
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  // Sort by frequency and return top keywords
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Generate canonical URL
 */
export function generateCanonicalUrl(path: string): string {
  // Remove trailing slash
  const cleanPath = path.replace(/\/$/, '');
  // Ensure starts with /
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return `${BASE_URL}${normalizedPath}`;
}

// ============================================
// CONTENT OPTIMIZATION
// ============================================

/**
 * Calculate reading time for content
 */
export function calculateReadingTime(content: string, wordsPerMinute = 200): number {
  const text = content.replace(/<[^>]*>/g, ''); // Remove HTML tags
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Count words in content
 */
export function countWords(content: string): number {
  const text = content.replace(/<[^>]*>/g, '');
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate excerpt from content
 */
export function generateExcerpt(content: string, maxLength = 200): string {
  // Remove HTML tags
  const text = content.replace(/<[^>]*>/g, '');
  // Get first paragraph or truncate
  const firstParagraph = text.split(/\n\n/)[0];
  return generateDescription(firstParagraph, maxLength);
}

// ============================================
// OPEN GRAPH HELPERS
// ============================================

/**
 * Generate Open Graph image URL with text overlay
 * (For dynamic OG image generation services)
 */
export function generateOGImageUrl(params: {
  title: string;
  subtitle?: string;
  template?: 'default' | 'article' | 'property';
}): string {
  const { title, subtitle, template = 'default' } = params;
  // This would integrate with an OG image generation service
  // For now, return default image
  return `${BASE_URL}/og-image.jpg`;
}

// ============================================
// STRUCTURED DATA HELPERS
// ============================================

/**
 * Generate ItemList structured data for collections
 */
export function generateItemListSchema(items: Array<{
  name: string;
  url: string;
  image?: string;
  description?: string;
}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
      ...(item.image && { image: item.image }),
      ...(item.description && { description: item.description }),
    })),
  };
}

/**
 * Generate SpeakableSpecification for voice search
 */
export function generateSpeakableSchema(cssSelectors: string[]) {
  return {
    '@type': 'SpeakableSpecification',
    cssSelector: cssSelectors,
  };
}

/**
 * Generate WebPage structured data
 */
export function generateWebPageSchema(page: {
  name: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.name,
    description: page.description,
    url: page.url.startsWith('http') ? page.url : `${BASE_URL}${page.url}`,
    ...(page.datePublished && { datePublished: page.datePublished }),
    ...(page.dateModified && { dateModified: page.dateModified }),
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: BASE_URL,
    },
    ...(page.breadcrumbs && {
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: page.breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
        })),
      },
    }),
  };
}

// ============================================
// SOCIAL SHARING HELPERS
// ============================================

/**
 * Generate social share URLs
 */
export function generateShareUrls(url: string, title: string, description?: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = description ? encodeURIComponent(description) : '';

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}${encodedDesc ? `&summary=${encodedDesc}` : ''}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDesc}%0A%0A${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
  };
}

// ============================================
// MARKET-SPECIFIC SEO
// ============================================

/**
 * Generate market-specific SEO data
 */
export function generateMarketSEO(market: {
  city: string;
  state: string;
  description?: string;
  stats?: {
    avgADR?: number;
    avgOccupancy?: number;
    propertyCount?: number;
  };
}) {
  const { city, state, description, stats } = market;
  
  return {
    title: `${city}, ${state} Rental Arbitrage Opportunities`,
    description: description || 
      `Discover rental arbitrage investment opportunities in ${city}, ${state}. ` +
      `Browse pre-negotiated property deals with landlord approval already secured.` +
      (stats?.avgADR ? ` Average daily rate: $${stats.avgADR}.` : '') +
      (stats?.avgOccupancy ? ` Average occupancy: ${stats.avgOccupancy}%.` : ''),
    keywords: [
      `${city} rental arbitrage`,
      `${city} Airbnb`,
      `${city} short-term rental`,
      `${state} STR investment`,
      `${city} vacation rental`,
      `${city} co-living`,
      `${city} property investment`,
    ].join(', '),
    localBusiness: {
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: `${SITE_NAME} - ${city}`,
      description: `Rental arbitrage investment services in ${city}, ${state}`,
      url: BASE_URL,
      areaServed: {
        '@type': 'City',
        name: city,
        containedInPlace: {
          '@type': 'State',
          name: state,
        },
      },
    },
  };
}

// ============================================
// PROPERTY-SPECIFIC SEO
// ============================================

/**
 * Generate property-specific SEO data
 */
export function generatePropertySEO(property: {
  id: string;
  title: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  projectedRevenue?: number;
  imageUrl?: string;
}) {
  const { id, title, city, state, bedrooms, bathrooms, monthlyRent, projectedRevenue, imageUrl } = property;
  
  return {
    title: `${title} - ${bedrooms}BR/${bathrooms}BA in ${city}, ${state}`,
    description: 
      `${bedrooms} bedroom, ${bathrooms} bathroom rental arbitrage opportunity in ${city}, ${state}. ` +
      `Monthly rent: $${monthlyRent.toLocaleString()}.` +
      (projectedRevenue ? ` Projected monthly revenue: $${projectedRevenue.toLocaleString()}.` : '') +
      ` Landlord approval already secured.`,
    keywords: [
      `${city} rental arbitrage`,
      `${bedrooms} bedroom ${city}`,
      `${city} Airbnb property`,
      `${city} investment property`,
      `${state} short-term rental`,
    ].join(', '),
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name: title,
      description: `${bedrooms}BR/${bathrooms}BA rental arbitrage opportunity in ${city}, ${state}`,
      url: `${BASE_URL}/deals?property=${id}`,
      datePosted: new Date().toISOString(),
      address: {
        '@type': 'PostalAddress',
        addressLocality: city,
        addressRegion: state,
        addressCountry: 'US',
      },
      offers: {
        '@type': 'Offer',
        price: monthlyRent,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      numberOfRooms: bedrooms,
      numberOfBathroomsTotal: bathrooms,
      ...(imageUrl && { image: imageUrl }),
    },
  };
}

// Export all helpers
export default {
  generateTitle,
  generateDescription,
  extractKeywords,
  generateCanonicalUrl,
  calculateReadingTime,
  countWords,
  generateSlug,
  generateExcerpt,
  generateOGImageUrl,
  generateItemListSchema,
  generateSpeakableSchema,
  generateWebPageSchema,
  generateShareUrls,
  generateMarketSEO,
  generatePropertySEO,
};
