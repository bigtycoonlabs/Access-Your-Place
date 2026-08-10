import { useEffect } from 'react';

/**
 * SEO for a single deal page.
 *
 * Deal pages had NO title, NO meta description and NO structured data -- every one of them
 * inherited the site-wide title, so twelve distinct listings looked like twelve copies of
 * the homepage to a search engine and to anyone pasting a link into a message.
 *
 * Two rules this follows, both from how the rest of the platform behaves:
 *
 * 1. NEVER CLAIM VERIFICATION THE SYSTEM CANNOT BACK. The title and description say what a
 *    deal IS, not that it is "AYP verified", unless the tier actually computes as verified.
 *    The marketplace's whole value is that the claim is real; putting it in a page title
 *    where nobody checks it is exactly how it stops being real.
 *
 * 2. NEVER PUT THE FULL STREET ADDRESS IN PUBLIC METADATA. The deal presentation mechanic
 *    exists to withhold the address until it is released. A meta description that leaks it
 *    into a search result hands away the thing being sold.
 */

interface Deal {
  id: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthly_rent?: number;
  acquisition_fee?: number;
  asking_price?: number;
  description?: string;
  operation_type?: string;
  is_furnished?: boolean;
  photos?: string[];
  verification_tier?: string;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function DealSEO({ deal }: { deal: Deal | null }) {
  useEffect(() => {
    if (!deal) return;

    const where = [deal.city, deal.state].filter(Boolean).join(', ');
    const beds = deal.bedrooms ? `${deal.bedrooms} bed` : '';
    const baths = deal.bathrooms ? `${deal.bathrooms} bath` : '';
    const kind =
      deal.operation_type === 'coliving'
        ? 'shared living'
        : deal.operation_type === 'mtr'
          ? 'mid-term rental'
          : deal.operation_type === 'str'
            ? 'short-term rental'
            : 'furnished rental';

    // No street address. The city and the shape of the deal, which is what somebody
    // searching actually types.
    const title = [
      [beds, baths].filter(Boolean).join(' '),
      kind,
      where ? `in ${where}` : '',
      '| Access Your Place',
    ]
      .filter(Boolean)
      .join(' ');

    const rent = deal.monthly_rent ? `Lease is ${Math.round(deal.monthly_rent).toLocaleString()} a month.` : '';
    const fee = deal.acquisition_fee ?? deal.asking_price;
    const acq = fee ? `Acquisition cost ${Math.round(Number(fee)).toLocaleString()}.` : '';

    // Only claim verification when the tier genuinely says so.
    const verified =
      deal.verification_tier === 'ayp_verified'
        ? 'We have spoken to the landlord and pre-negotiated the terms.'
        : 'Sourced and worked by our acquisition team.';

    const description = [
      `${[beds, baths].filter(Boolean).join(' ')} ${kind}${where ? ` in ${where}` : ''}.`.trim(),
      rent,
      acq,
      verified,
      'We negotiate the lease, handle the paperwork, and support the launch.',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 300);

    const url = `https://accessyourplace.com/property/${deal.id}`;
    const image = deal.photos?.[0] || 'https://accessyourplace.com/og-image.jpg';

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:type', 'product');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertLink('canonical', url);

    // Structured data. Offer rather than a residence listing, because what is being sold is
    // the ACQUISITION of the deal, not the property itself -- describing it as real estate
    // for sale would be a straightforwardly false claim to a search engine.
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title.replace(' | Access Your Place', ''),
      description,
      ...(image ? { image } : {}),
      brand: { '@type': 'Brand', name: 'Access Your Place' },
      ...(fee
        ? {
            offers: {
              '@type': 'Offer',
              price: Number(fee),
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
              url,
            },
          }
        : {}),
      ...(where ? { areaServed: where } : {}),
    };

    let script = document.head.querySelector<HTMLScriptElement>('script[data-deal-ld]');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-deal-ld', 'true');
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(ld);

    return () => {
      // Leaving a previous deal's structured data behind means the next page describes the
      // wrong property to anything reading it.
      document.head.querySelector('script[data-deal-ld]')?.remove();
    };
  }, [deal]);

  return null;
}
