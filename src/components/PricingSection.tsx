import { Check } from 'lucide-react';

export default function PricingSection() {
  const services = [
    {
      title: 'Empty Property Acquisition',
      price: '$2,500',
      description: 'Complete property sourcing and acquisition service',
      features: [
        'Market analysis and deal sourcing',
        'Property negotiation',
        'Lease agreement support',
        'Access to 3,700+ property database',
        'Penny AI deal evaluation'
      ]

    },
    {
      title: 'Total Setup & Administration',
      price: '$2,500',
      description: 'Comprehensive property setup and launch',
      breakdown: [
        { item: 'Furniture sourcing and design', cost: '$1,500' },
        { item: 'Software/CRM setup & listing optimization', cost: '$650' },
        { item: 'Binder setup, utilities & WiFi setup', cost: '$350' }
      ],
      features: [
        'Professional interior design',
        'Complete property furnishing',
        'Software and CRM configuration',
        'Listing optimization across platforms',
        'Utility and WiFi coordination'
      ]
    }
  ];

  const additionalServices = [
    {
      title: 'Property Negotiation Service',
      price: '$500',
      description: 'Expert negotiation for properties you find'
    },
    {
      title: 'Full-Service Property Procurement',
      price: '$2,500',
      description: 'Research, find, negotiate, procure, and support throughout lease term with corporate lease negotiation'
    },
    {
      title: 'VIP Master Lease Service',
      price: 'Custom',
      description: 'Leverage our experience to acquire properties under our master lease. For qualified clients, unlimited access to large apartment portfolios through our negotiations'
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#1a2332] mb-4">Transparent Pricing</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Professional acquisition and setup services with no hidden fees
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {services.map((service) => (
            <div key={service.title} className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-100 hover:border-[#d4a574] transition-colors">
              <h3 className="text-2xl font-bold text-[#1a2332] mb-2">{service.title}</h3>
              <div className="text-4xl font-bold text-[#d4a574] mb-4">{service.price}</div>
              <p className="text-gray-600 mb-6">{service.description}</p>
              
              {service.breakdown && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-[#1a2332] mb-3">Fee Breakdown:</h4>
                  {service.breakdown.map((item) => (
                    <div key={item.item} className="flex justify-between mb-2 text-sm">
                      <span className="text-gray-700">{item.item}</span>
                      <span className="font-semibold text-[#d4a574]">{item.cost}</span>
                    </div>
                  ))}
                </div>
              )}

              <ul className="space-y-3">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="w-5 h-5 text-[#d4a574] mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mb-12">
          <h3 className="text-3xl font-bold text-[#1a2332] mb-8 text-center">Additional Services</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {additionalServices.map((service) => (
              <div key={service.title} className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <h4 className="text-xl font-bold text-[#1a2332] mb-2">{service.title}</h4>
                <div className="text-3xl font-bold text-[#d4a574] mb-4">{service.price}</div>
                <p className="text-gray-600 text-sm">{service.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <a
            href="https://calendly.com/investyourplaces"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#d4a574] text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-[#c49564] transition-colors"
          >
            Schedule Your Strategy Call
          </a>
        </div>
      </div>
    </section>
  );
}
