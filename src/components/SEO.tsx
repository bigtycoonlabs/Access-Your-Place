import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogType?: 'website' | 'article' | 'product' | 'video.other' | 'profile';
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'player';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  noIndex?: boolean;
  structuredData?: object;
  // Additional props for enhanced SEO
  locale?: string;
  alternateLocales?: string[];
  videoUrl?: string;
  videoDuration?: number;
  audioUrl?: string;
  priceAmount?: string;
  priceCurrency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  ratingValue?: number;
  reviewCount?: number;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

const BASE_URL = 'https://accessyourplace.com';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.jpg`;
const SITE_NAME = 'Access Your Place';
const TWITTER_HANDLE = '@accessyourplace';

export default function SEO({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = 'website',
  ogImage = DEFAULT_IMAGE,
  ogImageAlt,
  twitterCard = 'summary_large_image',
  author,
  publishedTime,
  modifiedTime,
  section,
  noIndex = false,
  structuredData,
  locale = 'en_US',
  alternateLocales,
  videoUrl,
  videoDuration,
  priceAmount,
  priceCurrency = 'USD',
  availability,
  ratingValue,
  reviewCount,
}: SEOProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const fullCanonicalUrl = canonicalUrl 
    ? (canonicalUrl.startsWith('http') ? canonicalUrl : `${BASE_URL}${canonicalUrl}`)
    : typeof window !== 'undefined' ? window.location.href : BASE_URL;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper function to update or create meta tags
    const setMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    // Helper function to update or create link tags
    const setLinkTag = (rel: string, href: string, hreflang?: string) => {
      const selector = hreflang 
        ? `link[rel="${rel}"][hreflang="${hreflang}"]` 
        : `link[rel="${rel}"]:not([hreflang])`;
      let element = document.querySelector(selector) as HTMLLinkElement;
      
      if (!element) {
        element = document.createElement('link');
        element.rel = rel;
        if (hreflang) element.hreflang = hreflang;
        document.head.appendChild(element);
      }
      element.href = href;
    };

    // Basic Meta Tags
    setMetaTag('description', description);
    if (keywords) setMetaTag('keywords', keywords);
    if (author) setMetaTag('author', author);
    
    // Robots
    if (noIndex) {
      setMetaTag('robots', 'noindex, nofollow');
    } else {
      setMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    }

    // Canonical URL
    setLinkTag('canonical', fullCanonicalUrl);

    // Alternate language links
    if (alternateLocales) {
      alternateLocales.forEach(loc => {
        setLinkTag('alternate', `${BASE_URL}/${loc.toLowerCase()}${canonicalUrl || '/'}`, loc);
      });
    }

    // Open Graph Tags
    setMetaTag('og:title', fullTitle, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:type', ogType, true);
    setMetaTag('og:url', fullCanonicalUrl, true);
    setMetaTag('og:site_name', SITE_NAME, true);
    setMetaTag('og:image', ogImage, true);
    setMetaTag('og:image:width', '1200', true);
    setMetaTag('og:image:height', '630', true);
    if (ogImageAlt) setMetaTag('og:image:alt', ogImageAlt, true);
    setMetaTag('og:locale', locale, true);

    // Video-specific Open Graph tags
    if (videoUrl) {
      setMetaTag('og:video', videoUrl, true);
      setMetaTag('og:video:secure_url', videoUrl, true);
      setMetaTag('og:video:type', 'video/mp4', true);
      if (videoDuration) setMetaTag('og:video:duration', videoDuration.toString(), true);
    }

    // Product-specific Open Graph tags
    if (priceAmount) {
      setMetaTag('og:price:amount', priceAmount, true);
      setMetaTag('og:price:currency', priceCurrency, true);
      if (availability) setMetaTag('og:availability', availability, true);
    }

    // Article-specific Open Graph tags
    if (ogType === 'article') {
      if (publishedTime) setMetaTag('article:published_time', publishedTime, true);
      if (modifiedTime) setMetaTag('article:modified_time', modifiedTime, true);
      if (author) setMetaTag('article:author', author, true);
      if (section) setMetaTag('article:section', section, true);
    }

    // Twitter Card Tags
    setMetaTag('twitter:card', twitterCard);
    setMetaTag('twitter:site', TWITTER_HANDLE);
    setMetaTag('twitter:creator', TWITTER_HANDLE);
    setMetaTag('twitter:title', fullTitle);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', ogImage);
    if (ogImageAlt) setMetaTag('twitter:image:alt', ogImageAlt);

    // Twitter video player
    if (videoUrl && twitterCard === 'player') {
      setMetaTag('twitter:player', videoUrl);
      setMetaTag('twitter:player:width', '1280');
      setMetaTag('twitter:player:height', '720');
    }

    // Additional SEO meta tags
    setMetaTag('theme-color', '#1a365d');
    setMetaTag('msapplication-TileColor', '#1a365d');
    setMetaTag('format-detection', 'telephone=no');
    
    // Mobile optimization
    setMetaTag('mobile-web-app-capable', 'yes');
    setMetaTag('apple-mobile-web-app-capable', 'yes');
    setMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');

    // Structured Data (JSON-LD)
    const existingScript = document.querySelector('script[data-seo-structured-data]');
    if (existingScript) {
      existingScript.remove();
    }

    if (structuredData) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-structured-data', 'true');
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    // Cleanup function
    return () => {
      // Reset to defaults when component unmounts
      document.title = `${SITE_NAME} - Rental Arbitrage Investment Platform`;
    };
  }, [fullTitle, description, keywords, fullCanonicalUrl, ogType, ogImage, ogImageAlt, twitterCard, author, publishedTime, modifiedTime, section, noIndex, structuredData, locale, alternateLocales, videoUrl, videoDuration, priceAmount, priceCurrency, availability]);

  return null;
}

// ============================================
// SCHEMA HELPER FUNCTIONS
// ============================================

// Helper function to generate Organization structured data
export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Access Your Place is the leading platform for rental arbitrage investments, offering pre-negotiated property deals, market research tools, and comprehensive investor resources.',
    foundingDate: '2024',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'support@accessyourplace.com',
        availableLanguage: 'English',
        areaServed: 'US',
      },
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'success@accessyourplace.com',
        availableLanguage: 'English',
        areaServed: 'US',
      }
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: '1150 NW 72nd Ave, Tower I, Suite 455',
      addressLocality: 'Miami',
      addressRegion: 'FL',
      postalCode: '33126',
      addressCountry: 'US',
    },
    sameAs: [
      'https://twitter.com/accessyourplace',
      'https://www.facebook.com/accessyourplace',
      'https://www.linkedin.com/company/accessyourplace',
      'https://www.instagram.com/accessyourplace',
      'https://www.youtube.com/@accessyourplace',
    ],
  };
}

// Helper function to generate WebSite structured data with enhanced search
export function getWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'AYP',
    url: BASE_URL,
    description: 'Rental arbitrage investment platform with pre-negotiated property deals and market research tools.',
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    potentialAction: [
      {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE_URL}/deals?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
      {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE_URL}/knowledge-library?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      }
    ],
  };
}

// Helper function to generate Article structured data
export function getArticleSchema(article: {
  title: string;
  description: string;
  slug: string;
  imageUrl: string;
  publishDate?: string;
  modifiedDate?: string;
  author?: string;
  category?: string;
  wordCount?: number;
  readingTime?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: [article.imageUrl],
    url: `${BASE_URL}/blog/${article.slug}`,
    datePublished: article.publishDate || new Date().toISOString(),
    dateModified: article.modifiedDate || article.publishDate || new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: article.author || SITE_NAME,
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
        width: 600,
        height: 60,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/blog/${article.slug}`,
    },
    articleSection: article.category || 'Real Estate',
    ...(article.wordCount && { wordCount: article.wordCount }),
    ...(article.readingTime && { timeRequired: `PT${article.readingTime}M` }),
    inLanguage: 'en-US',
  };
}

// Helper function to generate Product/Service structured data
export function getServiceSchema(service: {
  name: string;
  description: string;
  price?: string;
  url: string;
  category?: string;
  ratingValue?: number;
  reviewCount?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: BASE_URL,
    },
    url: `${BASE_URL}${service.url}`,
    serviceType: service.category || 'Real Estate Services',
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    ...(service.price && {
      offers: {
        '@type': 'Offer',
        price: service.price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    }),
    ...(service.ratingValue && service.reviewCount && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: service.ratingValue,
        reviewCount: service.reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
}

// Helper function to generate RealEstateListing structured data
export function getPropertySchema(property: {
  id: string;
  title: string;
  description: string;
  city: string;
  state: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  imageUrl?: string;
  propertyType?: string;
  availableDate?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.description,
    url: `${BASE_URL}/deals?property=${property.id}`,
    datePosted: new Date().toISOString(),
    ...(property.availableDate && { availabilityStarts: property.availableDate }),
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.city,
      addressRegion: property.state,
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      addressCountry: 'US',
    },
    offers: {
      '@type': 'Offer',
      price: property.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    numberOfRooms: property.bedrooms,
    numberOfBathroomsTotal: property.bathrooms,
    ...(property.squareFeet && { 
      floorSize: { 
        '@type': 'QuantitativeValue', 
        value: property.squareFeet, 
        unitCode: 'FTK' 
      } 
    }),
    ...(property.imageUrl && { image: property.imageUrl }),
    ...(property.propertyType && { propertyType: property.propertyType }),
  };
}

// Helper function to generate BreadcrumbList structured data
export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

// Helper function to generate FAQ structured data
export function getFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// Helper function to generate LocalBusiness structured data (for specific markets)
export function getLocalBusinessSchema(market: {
  name: string;
  city: string;
  state: string;
  description: string;
  latitude?: number;
  longitude?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: `${SITE_NAME} - ${market.city}`,
    description: market.description,
    url: BASE_URL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: market.city,
      addressRegion: market.state,
      addressCountry: 'US',
    },
    ...(market.latitude && market.longitude && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: market.latitude,
        longitude: market.longitude,
      },
    }),
    areaServed: {
      '@type': 'City',
      name: market.city,
    },
    parentOrganization: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: BASE_URL,
    },
  };
}

// Helper function to generate HowTo structured data (for guides)
export function getHowToSchema(howTo: {
  name: string;
  description: string;
  totalTime?: string;
  estimatedCost?: string;
  steps: Array<{
    name: string;
    text: string;
    imageUrl?: string;
  }>;
  tools?: string[];
  supplies?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: howTo.name,
    description: howTo.description,
    ...(howTo.totalTime && { totalTime: howTo.totalTime }),
    ...(howTo.estimatedCost && {
      estimatedCost: {
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: howTo.estimatedCost,
      },
    }),
    ...(howTo.tools && {
      tool: howTo.tools.map(tool => ({
        '@type': 'HowToTool',
        name: tool,
      })),
    }),
    ...(howTo.supplies && {
      supply: howTo.supplies.map(supply => ({
        '@type': 'HowToSupply',
        name: supply,
      })),
    }),
    step: howTo.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.imageUrl && { image: step.imageUrl }),
    })),
  };
}

// Helper function to generate Video structured data
export function getVideoSchema(video: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  contentUrl?: string;
  embedUrl?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.name,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    uploadDate: video.uploadDate,
    ...(video.duration && { duration: video.duration }),
    ...(video.contentUrl && { contentUrl: video.contentUrl }),
    ...(video.embedUrl && { embedUrl: video.embedUrl }),
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
      },
    },
  };
}

// Helper function to generate Course structured data (for educational content)
export function getCourseSchema(course: {
  name: string;
  description: string;
  provider?: string;
  url: string;
  price?: string;
  duration?: string;
  educationalLevel?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.name,
    description: course.description,
    provider: {
      '@type': 'Organization',
      name: course.provider || SITE_NAME,
      url: BASE_URL,
    },
    url: course.url.startsWith('http') ? course.url : `${BASE_URL}${course.url}`,
    ...(course.price && {
      offers: {
        '@type': 'Offer',
        price: course.price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    }),
    ...(course.duration && { timeRequired: course.duration }),
    ...(course.educationalLevel && { educationalLevel: course.educationalLevel }),
    inLanguage: 'en-US',
  };
}

// Helper function to generate Event structured data
export function getEventSchema(event: {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  location?: string;
  isOnline?: boolean;
  url?: string;
  price?: string;
  organizer?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    ...(event.endDate && { endDate: event.endDate }),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.isOnline 
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: event.isOnline
      ? {
          '@type': 'VirtualLocation',
          url: event.url || BASE_URL,
        }
      : {
          '@type': 'Place',
          name: event.location || 'TBD',
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'US',
          },
        },
    organizer: {
      '@type': 'Organization',
      name: event.organizer || SITE_NAME,
      url: BASE_URL,
    },
    ...(event.price && {
      offers: {
        '@type': 'Offer',
        price: event.price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: event.url || BASE_URL,
      },
    }),
  };
}

// Helper function to generate Review structured data
export function getReviewSchema(review: {
  itemReviewed: {
    type: 'Service' | 'Product' | 'Organization';
    name: string;
  };
  author: string;
  reviewRating: number;
  reviewBody: string;
  datePublished?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': review.itemReviewed.type,
      name: review.itemReviewed.name,
    },
    author: {
      '@type': 'Person',
      name: review.author,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.reviewRating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: review.reviewBody,
    datePublished: review.datePublished || new Date().toISOString(),
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };
}

// Helper function to generate Aggregate Rating structured data
export function getAggregateRatingSchema(rating: {
  itemType: 'Service' | 'Product' | 'Organization' | 'LocalBusiness';
  itemName: string;
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': rating.itemType,
    name: rating.itemName,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: rating.ratingValue,
      reviewCount: rating.reviewCount,
      bestRating: rating.bestRating || 5,
      worstRating: rating.worstRating || 1,
    },
  };
}

// Helper function to generate SoftwareApplication structured data
export function getSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      reviewCount: 150,
      bestRating: 5,
      worstRating: 1,
    },
    description: 'Rental arbitrage investment platform with pre-negotiated property deals, market research tools, and investor resources.',
    url: BASE_URL,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };
}

// Helper function to combine multiple schemas into a graph
export function combineSchemas(...schemas: object[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': schemas.map(schema => {
      // Remove @context from individual schemas when combining
      const { '@context': _, ...rest } = schema as any;
      return rest;
    }),
  };
}

// Export BASE_URL for use in other components
export { BASE_URL, SITE_NAME };
