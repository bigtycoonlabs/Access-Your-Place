import React from 'react';
import Header from './Header';
import PennyHero from './PennyHero';
import Hero2026 from './Hero2026';
import MissionSection from './MissionSection';
import HowWeWork from './HowWeWork';
import EcosystemSection from './EcosystemSection';
import TechShowcase from './TechShowcase';
import FeaturedDeals from './FeaturedDeals';
import TestimonialsSection from './TestimonialsSection';
import FAQSection from './FAQSection';
import BookCallSection from './BookCallSection';
import Footer from './Footer';
import LeadCapture from './LeadCapture';
import SubmitPropertyModal from './SubmitPropertyModal';
import SEO, { getOrganizationSchema, getWebsiteSchema, getFAQSchema } from './SEO';

const AppLayout: React.FC = () => {
  const faqData = [
    {
      question: 'What is rental arbitrage?',
      answer: 'Rental arbitrage is a real estate investment strategy where you lease a property long-term and then sublease it as a short-term rental or co-living space, profiting from the difference between your lease payment and rental income.'
    },
    {
      question: 'Do I need to own property to start?',
      answer: 'No. You lease properties from landlords who approve STR or co-living operations, eliminating the need for large down payments or mortgages.'
    },
    {
      question: 'How do I find landlords who allow short-term rentals?',
      answer: 'Access Your Place provides pre-negotiated deals where landlord approval is already secured. We handle the outreach and negotiation so you can focus on running your business.'
    },
    {
      question: 'What returns can I expect?',
      answer: 'Returns vary by market and property type. Each listing includes detailed revenue projections based on real micro-market data. We project — we never guarantee.'
    },
    {
      question: 'Is rental arbitrage legal?',
      answer: 'Yes, when done properly with landlord permission and in compliance with local regulations. We verify that all properties on our platform meet legal requirements.'
    }
  ];

  const homepageSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      getOrganizationSchema(),
      getWebsiteSchema(),
      getFAQSchema(faqData)
    ]
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-[#1a365d] focus:ring-2 focus:ring-[#d4a574] focus:outline-none focus:font-medium"
      >
        Skip to main content
      </a>

      <SEO
        title="Access Your Place — Corporate Lease Acquisition Platform"
        description="Certified Acquisition Managers source and close furnished rental deals across 30+ markets. Landlord-approved deals, real market projections, no cold outreach."
        keywords="rental arbitrage, corporate leasing, furnished rentals, acquisition manager, short-term rental investment"
        canonicalUrl="/"
        ogType="website"
        structuredData={homepageSchema}
      />

      <Header />

      <main id="main-content">
        <PennyHero />
        <Hero2026 />
        <MissionSection />
        <HowWeWork />
        <FeaturedDeals />
        <EcosystemSection />
        <TechShowcase />
        <TestimonialsSection />
        <LeadCapture />
        <FAQSection />
        <BookCallSection />
      </main>

      <Footer />
      <SubmitPropertyModal />
    </div>
  );
};

export default AppLayout;
