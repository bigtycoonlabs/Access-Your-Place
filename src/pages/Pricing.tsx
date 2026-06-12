import React from 'react';
import Header from '@/components/Header';
import PricingSection from '@/components/PricingSection';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema, getServiceSchema } from '@/components/SEO';
import { AppProvider } from '@/contexts/AppContext';

const Pricing: React.FC = () => {
  // Pricing tiers for structured data
  const pricingServices = [
    {
      name: 'Starter Plan',
      description: 'Perfect for new investors starting their rental arbitrage journey. Includes access to deal flow, market research tools, and basic support.',
      price: '0',
      url: '/pricing'
    },
    {
      name: 'Professional Plan',
      description: 'For serious investors looking to scale their portfolio. Includes priority deal access, advanced analytics, and dedicated support.',
      price: '99',
      url: '/pricing'
    },
    {
      name: 'Enterprise Plan',
      description: 'Full-service solution for portfolio investors. Includes exclusive deals, white-glove setup services, and personal acquisition manager.',
      price: '299',
      url: '/pricing'
    }
  ];

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Pricing', url: '/pricing' }
  ]);

  const servicesSchema = pricingServices.map(service => getServiceSchema(service));

  const pageSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbSchema,
      ...servicesSchema,
      {
        '@type': 'WebPage',
        name: 'Pricing - Access Your Place',
        description: 'Transparent pricing for rental arbitrage investment services. Choose the plan that fits your investment goals.',
        url: 'https://accessyourplace.com/pricing'
      }
    ]
  };

  return (
    <AppProvider>
      <div className="min-h-screen bg-white">
        {/* Skip to main content link - WCAG 2.1 Level A: Bypass Blocks (2.4.1) */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-[#1a365d] focus:ring-2 focus:ring-[#d4a574] focus:outline-none focus:font-medium"
        >
          Skip to main content
        </a>

        <SEO 
          title="Pricing Plans - Rental Arbitrage Investment Services"
          description="Transparent pricing for rental arbitrage investment services. From free starter plans to full-service enterprise solutions. Find the perfect plan for your investment goals."
          keywords="rental arbitrage pricing, STR investment plans, Airbnb business pricing, real estate investment services, property investment subscription"
          canonicalUrl="/pricing"
          ogType="website"
          structuredData={pageSchema}
        />
        <Header />
        <main id="main-content" role="main">
          <PricingSection />
        </main>
        <Footer />
      </div>
    </AppProvider>
  );

};

export default Pricing;
