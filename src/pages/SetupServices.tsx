import { useState, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema, getServiceSchema, getFAQSchema } from '@/components/SEO';
import SetupCostCalculator, { CalculatorData } from '@/components/setup/SetupCostCalculator';
import BeforeAfterGallery from '@/components/setup/BeforeAfterGallery';
import { 
  Palette, 
  Package, 
  Truck, 
  CheckCircle2, 
  ArrowRight, 
  DollarSign,
  Users,
  Home,
  Camera,
  Wifi,
  Sofa,
  ClipboardList,
  Calendar,
  MapPin,
  Phone,
  Building,
  Sparkles,
  Clock,
  Shield,
  Star,
  ChevronDown,
  ChevronUp,
  Calculator,
  Images
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SetupServices() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    propertyCount: '1',
    propertyType: 'apartment',
    location: '',
    bedrooms: '2',
    timeline: 'flexible',
    message: '',
    estimatedTotal: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  
  const consultationFormRef = useRef<HTMLDivElement>(null);

  const handleCalculatorQuote = (data: CalculatorData) => {
    // Pre-fill the form with calculator data
    setFormData({
      ...formData,
      propertyCount: data.propertyCount.toString(),
      propertyType: data.propertyType,
      location: data.location,
      bedrooms: data.bedrooms,
      message: `Estimated from calculator:\n- Properties: ${data.propertyCount}\n- Bedrooms: ${data.bedrooms}\n- Type: ${data.propertyType}\n- Operation: ${data.operationType}\n\nEstimated Costs:\n- Admin Fee: $${data.totals.adminFee.toLocaleString()}\n- Furniture: $${data.totals.furnitureCost.toLocaleString()}\n- Logistics: $${data.totals.logisticsFee.toLocaleString()}\n- Total: $${data.totals.total.toLocaleString()}`,
      estimatedTotal: data.totals.total.toString()
    });
    
    // Scroll to consultation form
    consultationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await supabase.functions.invoke('submit-lead', {
        body: {
          ...formData,
          source: 'setup-services-page',
          type: 'setup-consultation'
        }
      });
      setSubmitSuccess(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        propertyCount: '1',
        propertyType: 'apartment',
        location: '',
        bedrooms: '2',
        timeline: 'flexible',
        message: '',
        estimatedTotal: ''
      });
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const costPillars = [
    {
      icon: ClipboardList,
      title: 'Setup Administration Fee',
      price: '$2,500',
      priceNote: 'per property (standard)',
      color: 'from-blue-500 to-blue-600',
      description: 'Your dedicated US-based Setup Manager handles everything from design to delivery coordination.',
      includes: [
        'Dedicated US-based Setup Manager',
        'Custom mood board & design creation',
        'Theme selection consultation',
        'Wholesale furniture sourcing',
        'Supplier coordination',
        'Spreadsheet approval process',
        'Delivery scheduling (50-150 packages)',
        'Project management from start to finish'
      ],
      bulkNote: 'Bulk discount available: As low as $1,500/property for 10+ unit launches'
    },
    {
      icon: Sofa,
      title: 'Furniture & Supplies',
      price: '~$4,000',
      priceNote: 'or less for under 4 bedrooms',
      color: 'from-[#d4a574] to-[#b8956a]',
      description: 'Wholesale-priced furniture, household supplies, and decor based on your approved design.',
      includes: [
        'Living room furniture package',
        'Bedroom sets & mattresses',
        'Kitchen essentials & cookware',
        'Bathroom supplies & linens',
        'Decor & artwork',
        'Technology (smart locks, TVs)',
        'Outdoor furniture (if applicable)',
        'All household supplies'
      ],
      bulkNote: 'Pricing varies based on bedroom count, design preferences, and property type'
    },
    {
      icon: Truck,
      title: 'Logistics Fee',
      price: '$3,350',
      priceNote: 'standard rate',
      color: 'from-emerald-500 to-emerald-600',
      description: 'Our YP Pro stays on-site for 14 business days to handle everything hands-on.',
      includes: [
        '14-day on-site YP Pro',
        'Package receiving & unboxing',
        'Furniture assembly & building',
        'Technology installation',
        'Wi-Fi setup & testing',
        'Junk removal coordination',
        'Complimentary property photos',
        'Guest-ready final walkthrough'
      ],
      bulkNote: 'Bundled rates available for multiple properties at same location'
    }
  ];

  const processSteps = [
    {
      step: 1,
      title: 'Design Consultation',
      description: 'Your Setup Manager creates custom mood boards based on your property type and target guest demographic.',
      duration: '2-3 days',
      icon: Palette
    },
    {
      step: 2,
      title: 'Theme Selection',
      description: 'Review and approve your preferred design theme, vibe, and aesthetic direction for the property.',
      duration: '1-2 days',
      icon: Star
    },
    {
      step: 3,
      title: 'Furniture Sourcing',
      description: 'We source all furniture, supplies, and decor from our wholesale suppliers at competitive prices.',
      duration: '3-5 days',
      icon: Sofa
    },
    {
      step: 4,
      title: 'Spreadsheet Approval',
      description: 'Review the complete item list with pricing. Request changes or approve to proceed with ordering.',
      duration: '1-3 days',
      icon: ClipboardList
    },
    {
      step: 5,
      title: 'Order & Delivery',
      description: 'Items ordered from multiple suppliers. Your Setup Manager coordinates 50-150 package deliveries.',
      duration: '7-14 days',
      icon: Package
    },
    {
      step: 6,
      title: 'YP Pro On-Site',
      description: 'Our professional stays 14 days to unbox, build, install, and set up everything perfectly.',
      duration: '14 days',
      icon: Users
    },
    {
      step: 7,
      title: 'Tech & Wi-Fi Setup',
      description: 'Smart locks, TVs, streaming services, and high-speed Wi-Fi installed and tested.',
      duration: 'Included',
      icon: Wifi
    },
    {
      step: 8,
      title: 'Photo-Ready',
      description: 'Final walkthrough, complimentary photos taken, junk removed. Your property is guest-ready!',
      duration: 'Day 14',
      icon: Camera
    }
  ];

  const pricingExamples = [
    {
      title: 'Single Property Launch',
      subtitle: '2-Bedroom Apartment',
      properties: 1,
      breakdown: [
        { item: 'Setup Administration Fee', price: 2500 },
        { item: 'Furniture & Supplies (2BR)', price: 3500 },
        { item: 'Logistics Fee', price: 3350 }
      ],
      total: 9350,
      perProperty: 9350,
      highlight: false
    },
    {
      title: 'Small Portfolio Launch',
      subtitle: '3 Properties at Same Location',
      properties: 3,
      breakdown: [
        { item: 'Setup Administration Fee (3x)', price: 6750 },
        { item: 'Furniture & Supplies (avg)', price: 10500 },
        { item: 'Logistics Fee (bundled)', price: 5500 }
      ],
      total: 22750,
      perProperty: 7583,
      savings: 5300,
      highlight: true
    },
    {
      title: 'Bulk Portfolio Launch',
      subtitle: '10 Properties at Same Location',
      properties: 10,
      breakdown: [
        { item: 'Setup Administration Fee (10x @ $1,500)', price: 15000 },
        { item: 'Furniture & Supplies (avg)', price: 35000 },
        { item: 'Logistics Fee (2-3 YP Pros)', price: 8500 }
      ],
      total: 58500,
      perProperty: 5850,
      savings: 35000,
      highlight: false
    }
  ];

  const faqs = [
    {
      question: 'What types of properties can you set up?',
      answer: 'We handle all furnished rental operation types including short-term rentals (Airbnb/VRBO), co-living spaces, Peerspace venues, corporate housing, and mid-term rentals. From studios to large single-family homes, our team is equipped to handle any property type.'
    },
    {
      question: 'How do delivery times work with 50-150 packages?',
      answer: 'Deliveries can arrive anytime—8 AM, 10 PM, or throughout the day. Your dedicated Setup Manager coordinates with all vendors to ensure packages arrive on schedule. Our YP Pro on-site receives and organizes everything as it arrives.'
    },
    {
      question: 'Can I make changes to the furniture selections?',
      answer: 'Absolutely! After we source items and create your spreadsheet, you can request any changes before we order. Want a different sofa style? Prefer a king bed over a queen? We\'ll adjust the selections until you\'re completely satisfied.'
    },
    {
      question: 'What\'s included in the complimentary photos?',
      answer: 'Our YP Pro takes professional-quality photos of every room once setup is complete. These are suitable for your listing platforms and marketing materials. For professional photography services, we can coordinate with local photographers at additional cost.'
    },
    {
      question: 'How does bulk pricing work for multiple properties?',
      answer: 'When launching multiple properties at the same location, we bundle logistics fees and reduce setup administration fees. For 10+ properties, admin fees can drop to $1,500/property. We\'ll create a custom package based on your specific portfolio.'
    },
    {
      question: 'How does co-living setup differ from standard STR setup?',
      answer: 'For co-living operations, we focus on the communal spaces rather than individual bedrooms. We add smart locks on internal bedroom doors, label cabinets and bathrooms, and set up the living space for communal use with larger seating and dining areas. Bedrooms typically remain unfurnished for tenants to personalize.'
    },
    {
      question: 'Do you work in all markets across the US?',
      answer: 'Yes! We have YP Pros ready to deploy to any of our 64+ markets nationwide. Our team can fly out to your property location anywhere in the United States. We also have strategic storage units and supplier relationships across the country.'
    }
  ];

  const designThemes = [
    { name: 'Coastal', description: 'Light, airy, beach-inspired with natural textures', color: 'bg-blue-100 text-blue-700' },
    { name: 'Modern Farmhouse', description: 'Warm neutrals with rustic wood accents', color: 'bg-amber-100 text-amber-700' },
    { name: 'Contemporary Luxury', description: 'Sleek lines, sophisticated neutrals', color: 'bg-gray-100 text-gray-700' },
    { name: 'Cozy Chic', description: 'Warm tones, soft textures, inviting atmosphere', color: 'bg-pink-100 text-pink-700' },
    { name: 'Contemporary Classic', description: 'Timeless elegance with modern touches', color: 'bg-slate-100 text-slate-700' }
  ];

  // Generate SEO structured data
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Setup Services', url: '/setup-services' }
  ]);

  const serviceSchema = getServiceSchema({
    name: 'Property Setup Services',
    description: 'Professional property setup services for short-term rentals and co-living spaces. From mood board to photo-ready in 30 days.',
    price: '2500',
    url: '/setup-services'
  });

  const faqSchema = getFAQSchema(faqs);

  const pageSchema = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbSchema, serviceSchema, faqSchema]
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to main content link - WCAG 2.1 Level A: Bypass Blocks (2.4.1) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-[#1a365d] focus:ring-2 focus:ring-[#d4a574] focus:outline-none focus:font-medium"
      >
        Skip to main content
      </a>

      <SEO 
        title="Property Setup Services - Professional Furnishing & Installation"
        description="Transform your rental property from empty to photo-ready in 30 days. Our Setup Management Team handles design, furniture sourcing, delivery, and installation across 64+ US markets."
        keywords="property setup services, Airbnb setup, vacation rental furnishing, STR setup, co-living setup, furniture installation, rental property design, turnkey rental setup"
        canonicalUrl="/setup-services"
        ogType="website"
        structuredData={pageSchema}
      />
      <Header />
      
      <main id="main-content" role="main">


      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1a2332] via-[#2a3d52] to-[#1a2332] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img 
            src="https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364299660_2d473e7c.jpg" 
            alt="Furnished property interior"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a2332]/95 via-[#1a2332]/80 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <span className="inline-block bg-[#d4a574]/20 text-[#d4a574] px-4 py-2 rounded-full text-sm font-semibold mb-6">
              À La Carte Setup Services
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Setup Management Team
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
              From mood board to photo-ready in as little as 30 days. Our dedicated team handles design, sourcing, delivery, and installation—so you don't have to lift a finger.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="#cost-calculator"
                className="inline-flex items-center justify-center gap-2 bg-[#d4a574] text-[#1a2332] px-8 py-4 rounded-lg font-bold text-lg hover:bg-[#c49564] transition-all shadow-lg hover:shadow-xl"
              >
                <Calculator size={20} />
                Calculate Your Cost
              </a>
              <a 
                href="#portfolio-gallery"
                className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/20 transition-all border border-white/20"
              >
                <Images size={20} />
                View Our Work
              </a>
            </div>
          </div>
        </div>
        
        {/* Stats Bar */}
        <div className="relative bg-black/30 backdrop-blur-sm border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-[#d4a574]">64+</div>
                <div className="text-sm text-gray-400">Markets Nationwide</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#d4a574]">14</div>
                <div className="text-sm text-gray-400">Days On-Site Setup</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#d4a574]">150+</div>
                <div className="text-sm text-gray-400">Packages Coordinated</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#d4a574]">100%</div>
                <div className="text-sm text-gray-400">Guest-Ready Guarantee</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-6">
              The Perfect Complement to Acquisition
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              While our Acquisition Management Team helps you find and secure the perfect property, our Setup Management Team transforms that empty space into a revenue-generating furnished rental. Unlike acquisition services, our setup team works <strong>à la carte</strong>—you choose exactly what you need.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-6 rounded-xl">
                <Shield className="w-10 h-10 text-[#d4a574] mx-auto mb-4" />
                <h3 className="font-bold text-[#1a2332] mb-2">US-Based Management</h3>
                <p className="text-sm text-gray-600">Your Setup Manager is based in the United States, ensuring clear communication and timezone alignment.</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl">
                <DollarSign className="w-10 h-10 text-[#d4a574] mx-auto mb-4" />
                <h3 className="font-bold text-[#1a2332] mb-2">Wholesale Pricing</h3>
                <p className="text-sm text-gray-600">Access our network of wholesale furniture suppliers for significant savings on quality furnishings.</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl">
                <Sparkles className="w-10 h-10 text-[#d4a574] mx-auto mb-4" />
                <h3 className="font-bold text-[#1a2332] mb-2">Turnkey Results</h3>
                <p className="text-sm text-gray-600">From design concept to photo-ready property—we handle every detail of the launch.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Cost Calculator */}
      <section id="cost-calculator" className="py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block bg-[#d4a574]/10 text-[#d4a574] px-4 py-2 rounded-full text-sm font-semibold mb-4">
              Interactive Tool
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-4">
              Setup Cost Calculator
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Get an instant estimate for your property setup. Adjust the inputs to see how costs change based on your specific needs.
            </p>
          </div>

          <SetupCostCalculator onGetQuote={handleCalculatorQuote} />
        </div>
      </section>

      {/* Three Cost Pillars */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block bg-[#d4a574]/10 text-[#d4a574] px-4 py-2 rounded-full text-sm font-semibold mb-4">
              Transparent Pricing
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-4">
              Three Cost Pillars
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every setup project has three distinct cost components. Understanding these helps you budget accurately and choose the services that fit your needs.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {costPillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div key={idx} className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow">
                  <div className={`bg-gradient-to-r ${pillar.color} p-6 text-white`}>
                    <Icon className="w-12 h-12 mb-4 opacity-90" />
                    <h3 className="text-2xl font-bold mb-2">{pillar.title}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{pillar.price}</span>
                      <span className="text-sm opacity-80">{pillar.priceNote}</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-600 mb-6">{pillar.description}</p>
                    <h4 className="font-semibold text-[#1a2332] mb-4">What's Included:</h4>
                    <ul className="space-y-3 mb-6">
                      {pillar.includes.map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-800">
                        <strong>Bulk Savings:</strong> {pillar.bulkNote}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Design Themes */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block bg-[#d4a574]/10 text-[#d4a574] px-4 py-2 rounded-full text-sm font-semibold mb-4">
              Design Options
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-4">
              Our Design Themes
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose from our curated design themes or work with your Setup Manager to create a custom aesthetic. We never overwhelm spaces—just the right amount to make them functional and beautiful.
            </p>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {designThemes.map((theme, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-5 hover:shadow-lg transition-shadow">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${theme.color}`}>
                  {theme.name}
                </span>
                <p className="text-sm text-gray-600">{theme.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before & After Portfolio Gallery */}
      <section id="portfolio-gallery" className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block bg-[#d4a574]/10 text-[#d4a574] px-4 py-2 rounded-full text-sm font-semibold mb-4">
              Our Work
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-4">
              Before & After Portfolio
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              See the transformations for yourself. Drag the slider to compare before and after shots from our recent property setups.
            </p>
          </div>

          <BeforeAfterGallery />
        </div>
      </section>

      {/* Process Timeline */}
      <section className="py-20 bg-[#1a2332] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block bg-[#d4a574]/20 text-[#d4a574] px-4 py-2 rounded-full text-sm font-semibold mb-4">
              Our Process
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              From Design to Photo-Ready
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              A scientifically designed workflow that transforms empty properties into stunning, guest-ready spaces.
            </p>
          </div>

          <div className="relative">
            {/* Timeline Line - Desktop */}
            <div className="hidden lg:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-[#d4a574] via-emerald-500 to-blue-500 rounded-full" />
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {processSteps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div key={idx} className="relative">
                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 hover:bg-white/10 transition-all h-full">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#d4a574] to-[#b8956a] rounded-full flex items-center justify-center text-[#1a2332] font-bold text-lg">
                          {step.step}
                        </div>
                        <Icon className="w-8 h-8 text-[#d4a574]" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                      <p className="text-gray-400 text-sm mb-4">{step.description}</p>
                      <div className="flex items-center gap-2 text-[#d4a574]">
                        <Clock size={16} />
                        <span className="text-sm font-medium">{step.duration}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-16 bg-white/5 backdrop-blur-sm rounded-xl p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Total Timeline: 25-40 Days</h3>
            <p className="text-gray-400 max-w-2xl mx-auto">
              From initial consultation to photo-ready property, most single-unit setups complete within 30 days. Bulk launches may require additional time based on property count and complexity.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Examples */}
      <section id="pricing-examples" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block bg-[#d4a574]/10 text-[#d4a574] px-4 py-2 rounded-full text-sm font-semibold mb-4">
              Real Numbers
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-4">
              Pricing Examples
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              See how costs scale from single properties to bulk portfolio launches. The more properties you launch together, the more you save.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {pricingExamples.map((example, idx) => (
              <div 
                key={idx} 
                className={`rounded-2xl overflow-hidden ${
                  example.highlight 
                    ? 'ring-4 ring-[#d4a574] shadow-2xl scale-105' 
                    : 'shadow-xl'
                }`}
              >
                {example.highlight && (
                  <div className="bg-[#d4a574] text-[#1a2332] text-center py-2 font-bold text-sm">
                    MOST POPULAR
                  </div>
                )}
                <div className="bg-gray-50 p-6">
                  <h3 className="text-xl font-bold text-[#1a2332] mb-1">{example.title}</h3>
                  <p className="text-gray-600 text-sm">{example.subtitle}</p>
                </div>
                <div className="bg-white p-6">
                  <div className="space-y-4 mb-6">
                    {example.breakdown.map((item, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-gray-700">{item.item}</span>
                        <span className="font-semibold text-[#1a2332]">
                          ${item.price.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-bold text-[#1a2332]">Total Investment</span>
                      <span className="text-2xl font-bold text-[#1a2332]">
                        ${example.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Per Property</span>
                      <span className="font-semibold text-[#d4a574]">
                        ${example.perProperty.toLocaleString()}
                      </span>
                    </div>
                    {example.savings && (
                      <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                        <span className="text-emerald-700 font-semibold">
                          Save ${example.savings.toLocaleString()} vs. individual launches
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-gray-50 rounded-xl p-8">
            <h3 className="text-xl font-bold text-[#1a2332] mb-4 text-center">Understanding Our Fees</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold text-[#1a2332] mb-2">Service Fees (Our Profit)</h4>
                <p className="text-gray-600 text-sm">
                  Setup Administration Fees are our service fees—the only place we make profit on transactions. These fees cover your dedicated Setup Manager's time, expertise, and project coordination.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[#1a2332] mb-2">Pass-Through Costs</h4>
                <p className="text-gray-600 text-sm">
                  Furniture & Supplies costs are passed through at wholesale pricing. Logistics fees cover YP Pro travel, accommodation, and on-site services. We don't markup these costs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Property Types */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1a2332] mb-4">
              Designed for All Rental Operations
            </h2>
            <p className="text-lg text-gray-600">
              Our workflows are scientifically designed to handle any furnished rental type.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Home, title: 'Short-Term Rentals', desc: 'Airbnb, VRBO, Booking.com' },
              { icon: Building, title: 'Co-Living Spaces', desc: 'Shared living arrangements' },
              { icon: Camera, title: 'Peerspace Venues', desc: 'Event & production spaces' },
              { icon: Users, title: 'Corporate Housing', desc: 'Mid-term business rentals' }
            ].map((type, idx) => {
              const Icon = type.icon;
              return (
                <div key={idx} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow text-center">
                  <div className="w-16 h-16 bg-[#d4a574]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-[#d4a574]" />
                  </div>
                  <h3 className="font-bold text-[#1a2332] mb-2">{type.title}</h3>
                  <p className="text-sm text-gray-600">{type.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1a2332] mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-100 transition-colors"
                >
                  <span className="font-semibold text-[#1a2332] pr-4">{faq.question}</span>
                  {expandedFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-[#d4a574] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#d4a574] flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === idx && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Consultation Form */}
      <section ref={consultationFormRef} id="consultation-form" className="py-20 bg-gradient-to-br from-[#1a2332] via-[#2a3d52] to-[#1a2332] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block bg-[#d4a574]/20 text-[#d4a574] px-4 py-2 rounded-full text-sm font-semibold mb-6">
                Get Started
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Request a Setup Consultation
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                Tell us about your property and goals. Our team will create a custom setup package tailored to your needs and budget.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-[#d4a574]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Quick Response</h3>
                    <p className="text-gray-400 text-sm">We respond to all inquiries within 24 hours</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-6 h-6 text-[#d4a574]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Custom Quotes</h3>
                    <p className="text-gray-400 text-sm">Receive a detailed breakdown based on your specific needs</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-6 h-6 text-[#d4a574]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Flexible Scheduling</h3>
                    <p className="text-gray-400 text-sm">We work around your timeline and launch goals</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 text-[#1a2332]">
              {submitSuccess ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Request Received!</h3>
                  <p className="text-gray-600 mb-6">
                    Our Setup Management Team will review your details and reach out within 24 hours with a custom consultation.
                  </p>
                  <button
                    onClick={() => setSubmitSuccess(false)}
                    className="text-[#d4a574] font-semibold hover:underline"
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {formData.estimatedTotal && (
                    <div className="bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-lg p-4 mb-4">
                      <p className="text-sm text-[#1a2332]">
                        <strong>Calculator Estimate:</strong> ${parseInt(formData.estimatedTotal).toLocaleString()}
                      </p>
                    </div>
                  )}
                  
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium mb-2" htmlFor="full-name">Full Name *</label>
                      <input id="full-name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" htmlFor="email">Email *</label>
                      <input id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium mb-2" htmlFor="phone">Phone</label>
                      <input id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Number of Properties *</label>
                      <select
                        required
                        value={formData.propertyCount}
                        onChange={(e) => setFormData({ ...formData, propertyCount: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                      >
                        <option value="1">1 Property</option>
                        <option value="2-3">2-3 Properties</option>
                        <option value="4-5">4-5 Properties</option>
                        <option value="6-10">6-10 Properties</option>
                        <option value="10+">10+ Properties</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium mb-2">Property Type *</label>
                      <select
                        required
                        value={formData.propertyType}
                        onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                      >
                        <option value="apartment">Apartment</option>
                        <option value="condo">Condo</option>
                        <option value="townhome">Townhome</option>
                        <option value="single-family">Single Family Home</option>
                        <option value="mixed">Mixed Types</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Bedrooms (avg) *</label>
                      <select
                        required
                        value={formData.bedrooms}
                        onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                      >
                        <option value="studio">Studio</option>
                        <option value="1">1 Bedroom</option>
                        <option value="2">2 Bedrooms</option>
                        <option value="3">3 Bedrooms</option>
                        <option value="4+">4+ Bedrooms</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium mb-2" htmlFor="property-location">Property Location *</label>
                      <input id="property-location"
                        type="text"
                        required
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                        placeholder="City, State"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Timeline</label>
                      <select
                        value={formData.timeline}
                        onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                      >
                        <option value="asap">ASAP</option>
                        <option value="1-month">Within 1 Month</option>
                        <option value="2-3-months">2-3 Months</option>
                        <option value="flexible">Flexible</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="additional-details">Additional Details</label>
                    <textarea id="additional-details"
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent resize-none"
                      placeholder="Tell us about your property, design preferences, or any specific requirements..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#d4a574] text-[#1a2332] py-4 rounded-lg font-bold text-lg hover:bg-[#c49564] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-[#1a2332]/30 border-t-[#1a2332] rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Request Consultation
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-[#d4a574]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-[#1a2332] mb-4">
            Ready to Transform Your Property?
          </h2>
          <p className="text-lg text-[#1a2332]/80 mb-8">
            Whether you're launching one property or twenty, our Setup Management Team has the expertise and infrastructure to deliver stunning, guest-ready results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="https://calendly.com/investyourplaces"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#1a2332] text-white px-8 py-4 rounded-lg font-bold hover:bg-[#2a3d52] transition-colors"
            >
              Schedule a Call
              <ArrowRight size={20} />
            </a>
            <a 
              href="/knowledge-library"
              className="inline-flex items-center justify-center gap-2 bg-white text-[#1a2332] px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Read Setup Guide
            </a>
          </div>
        </div>
      </section>

      </main>

      <Footer />
    </div>

  );
}
