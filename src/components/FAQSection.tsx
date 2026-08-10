import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function FAQSection() {
  const faqs = [
    { q: 'What is rental arbitrage?', a: 'Rental arbitrage is leasing a property long-term and subletting it as a short-term rental or co-living space, generating profit from the difference between your lease cost and rental income.' },
    { q: 'How much capital do I need to start?', a: 'Most investors start with $5,000-$15,000 for their first property, covering first/last month rent, security deposit, furnishing, and initial setup costs.' },
    { q: 'Do I need experience in real estate?', a: 'No prior experience required. Our Success Team guides you through every step, from acquisition to setup to ongoing optimization.' },
    { q: 'What types of properties do you work with?', a: 'We specialize in four categories: Short-Term Rentals (STR), Co-Living Spaces, Group Homes, and Event Style Properties.' },
    { q: 'How do I access the deal flow?', a: 'Visit our Deals page to browse our current inventory of vetted properties available for acquisition.' },
    { q: 'How does Penny AI Market Scan work?', a: 'Penny AI analyzes your target markets in real-time, providing comprehensive market data, property recommendations, ROI projections, and regulatory insights. Access it through the operator portal or deals page.' },
    { q: 'Can I submit my own property for consideration?', a: 'Yes! Use our Submit Property form. If approved, your property will be listed on our deal flow within 24 hours.' },
    { q: 'What happens after I book a discovery call?', a: 'Our acquisition team reviews your goals, discusses available deals, and creates a custom strategy. There is no obligation to proceed.' },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-[#1a365d] mb-12">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="bg-white rounded-lg px-6 border">
              <AccordionTrigger className="text-left font-medium">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-gray-600">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
