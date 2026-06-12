import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema, getServiceSchema } from '@/components/SEO';
import LandlordHero from '@/components/landlord/LandlordHero';
import LandlordBenefits from '@/components/landlord/LandlordBenefits';
import LandlordProcess from '@/components/landlord/LandlordProcess';
import LandlordInquiryForm from '@/components/landlord/LandlordInquiryForm';

export default function LandlordPartnership() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Landlord Partnership', url: '/landlord-partnership' }
  ]);

  const serviceSchema = getServiceSchema({
    name: 'Landlord Partnership Program',
    description: 'Partner with Access Your Place to maximize your rental income through short-term rental and co-living arrangements. We handle tenant screening, property management coordination, and guaranteed rent payments.',
    url: '/landlord-partnership'
  });

  const pageSchema = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbSchema, serviceSchema]
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title="Landlord Partnership Program - Maximize Your Rental Income"
        description="Partner with Access Your Place to earn more from your rental property. We connect landlords with vetted investors for short-term rental and co-living arrangements. Guaranteed rent, professional management, and higher returns."
        keywords="landlord partnership, rental income, property owner program, STR landlord, co-living landlord, guaranteed rent, property management, rental arbitrage landlord"
        canonicalUrl="/landlord-partnership"
        ogType="website"
        structuredData={pageSchema}
      />
      <Header />
      <LandlordHero />
      <LandlordBenefits />
      <LandlordProcess />
      <LandlordInquiryForm />
      <Footer />
    </div>
  );
}
