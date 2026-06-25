import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BriefcaseBusiness, CheckCircle, FileText, Handshake, Search, Shield, Users } from 'lucide-react';

const departments = [
  {
    title: 'Acquisition',
    description: 'Source and qualify real estate opportunities, guide operator clients, and use Penny to evaluate market fit.',
    items: ['Acquisition Manager', 'Market Research Associate', 'Landlord Relationship Specialist'],
    icon: Search,
  },
  {
    title: 'Success Team',
    description: 'Handle compliance, screening, sensitive documents, landlord communication, and completed acquisition handoffs.',
    items: ['Client Success Manager', 'Screening Coordinator', 'Compliance Operations'],
    icon: Shield,
  },
  {
    title: 'Platform & Education',
    description: 'Build the knowledge library, operator resources, product systems, and tools that help flexible housing companies grow.',
    items: ['Content Strategist', 'Product Operations', 'Knowledge Library Editor'],
    icon: FileText,
  },
];

const principles = [
  'Use data before assumptions.',
  'Protect client and landlord trust.',
  'Create more real estate access than traditional models allow.',
  'Build systems that make operators more capable.',
];

export default function Careers() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SEO
        title="Careers - Access Your Place"
        description="Join Access Your Place and help build the technology, acquisition, and success systems powering flexible housing operators."
        canonicalUrl="/careers"
        ogType="website"
      />
      <Header />
      <main id="main-content" className="flex-grow">
        <section className="bg-[#0a0f1a] text-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <Badge className="bg-[#d4a574]/15 text-[#e8c99d] border border-[#d4a574]/30 mb-5">
                Careers at Access Your Place
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
                Help operators access real estate opportunities faster.
              </h1>
              <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-3xl">
                We are building a consultancy and technology suite for the flexible housing industry: market research, acquisition support, operator education, vendor resources, and portfolio systems that help housing companies scale.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
              <div>
                <h2 className="text-3xl font-bold text-slate-950 mb-4">Teams We Are Building</h2>
                <p className="text-slate-600 leading-relaxed">
                  Our hiring structure follows how the platform works. Acquisition managers guide opportunity selection, the success team handles screening and compliance, and platform roles turn internal knowledge into tools operators can use.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                {departments.map((department) => (
                  <article key={department.title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="w-11 h-11 rounded-xl bg-[#0a0f1a] text-[#d4a574] flex items-center justify-center mb-4">
                      <department.icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-950 mb-2">{department.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">{department.description}</p>
                    <ul className="space-y-2">
                      {department.items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-slate-700">
                          <CheckCircle className="w-4 h-4 text-[#d4a574] flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10">
              <div className="rounded-3xl bg-slate-950 text-white p-8">
                <div className="w-12 h-12 rounded-2xl bg-[#d4a574] text-slate-950 flex items-center justify-center mb-5">
                  <BriefcaseBusiness className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Hiring Principles</h2>
                <div className="space-y-3">
                  {principles.map((principle) => (
                    <div key={principle} className="flex gap-3 text-slate-300">
                      <CheckCircle className="w-5 h-5 text-[#d4a574] flex-shrink-0 mt-0.5" />
                      <span>{principle}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 border border-slate-200 p-8">
                <div className="w-12 h-12 rounded-2xl bg-[#0a0f1a] text-[#d4a574] flex items-center justify-center mb-5">
                  <Handshake className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-bold text-slate-950 mb-4">Vendor-Related Applicants</h2>
                <p className="text-slate-600 leading-relaxed mb-5">
                  Applicants with housing-related companies can still participate in the vendor network when their services do not conflict with Access Your Place acquisition support or setup services. Eligible vendor categories include housekeeping, maintenance, funding, cohosting, property management, virtual management, logistics, and other operator support services.
                </p>
                <Button asChild className="bg-[#d4a574] hover:bg-[#c49464] text-slate-950 font-bold">
                  <a href="mailto:careers@accessyourplace.com">Contact Careers</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Users className="w-10 h-10 mx-auto text-[#d4a574] mb-4" />
            <h2 className="text-3xl font-bold text-slate-950 mb-4">Application Flow</h2>
            <p className="text-slate-600 leading-relaxed mb-8">
              Send your resume, the department you are interested in, and a short note on how your background helps operators gain better access to real estate opportunities.
            </p>
            <Button asChild size="lg" className="bg-[#0a0f1a] hover:bg-[#172033] text-white">
              <a href="mailto:careers@accessyourplace.com?subject=Access%20Your%20Place%20Career%20Interest">Apply by Email</a>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
