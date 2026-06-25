import React from 'react';
import Header from './Header';
import Hero2026 from './Hero2026';
import TechShowcase from './TechShowcase';
import FeaturedDeals from './FeaturedDeals';
import TestimonialsSection from './TestimonialsSection';
import FAQSection from './FAQSection';
import BookCallSection from './BookCallSection';
import Footer from './Footer';
import SubmitPropertyModal from './SubmitPropertyModal';
import SEO, { getOrganizationSchema, getWebsiteSchema, getFAQSchema } from './SEO';

const AppLayout: React.FC = () => {
  const faqData = [
    {
      question: 'What does Access Your Place help operators do?',
      answer: 'Access Your Place helps operator clients research markets, review qualified corporate lease opportunities, work with acquisition support, and manage flexible housing growth through one platform.'
    },
    {
      question: 'Are investors and operators separate account types?',
      answer: 'No. Access Your Place uses one operator client account. Investor describes a pre-launch operator; once properties are live and hosting guests, that client is operating.'
    },
    {
      question: 'Can public users see property addresses?',
      answer: 'Public marketplace cards protect exact addresses. Funded operator accounts can access full addresses through the internal marketplace and dashboard experience.'
    },
    {
      question: 'How does Penny qualify properties?',
      answer: 'Penny uses a 0-100 score across demand, supply, regulation, and economics. Properties under 50 do not qualify for public listing because they fail Access Your Place minimum slow-season economics.'
    },
    {
      question: 'Who can use the client access portal?',
      answer: 'Operator clients, pre-launch investors, vendors, and landlords can use the public account flow. Staff login remains separate for internal teams.'
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
        title="Access Your Place - Flexible Housing Operator Platform"
        description="Access Your Place helps operator clients move past traditional real estate barriers with Penny market research, qualified corporate lease opportunities, acquisition support, and flexible housing resources."
        keywords="flexible housing, corporate lease opportunities, rental arbitrage, short-term rental operator, co-living operator, Penny market research, real estate access, operator dashboard, acquisition support"
        canonicalUrl="/"
        ogType="website"
        structuredData={homepageSchema}
      />
      <Header />
      <main id="main-content" role="main">
        <Hero2026 />
        <TechShowcase />
        <FeaturedDeals />
        <TestimonialsSection />
        <FAQSection />
        <BookCallSection />
      </main>
      <Footer />
      <SubmitPropertyModal />
    </div>
  );
};

export default AppLayout;
