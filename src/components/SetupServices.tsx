import { Plane, Warehouse, Users, Wrench, Truck, Sparkles } from 'lucide-react';

export default function SetupServices() {
  const services = [
    { icon: Users, title: 'Army of YP Pros', desc: 'Nationwide network of trained professionals ready to deploy' },
    { icon: Plane, title: 'Fly-Out Service', desc: 'We fly our pros to your property anywhere in the US' },
    { icon: Warehouse, title: 'Storage Network', desc: 'Strategic storage units across 64 cities for furniture & supplies' },
    { icon: Wrench, title: 'Furniture Suppliers', desc: 'Vetted suppliers for fast, cost-effective furnishing' },
    { icon: Truck, title: 'Junk Removal', desc: 'Coordinated junk removal services in all our markets' },
    { icon: Sparkles, title: 'Housekeeping', desc: 'Professional cleaning teams ready for turnover' },
  ];

  return (
    <section className="py-16 bg-gradient-to-br from-[#1a2332] to-[#2a3d52] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Full-Service Property Setup</h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            We've built a nationwide logistics network to set up your rental arbitrage properties from start to finish. 
            Our army of YP pros can be deployed to any of our 64 markets at a moment's notice.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {services.map((service, idx) => {
            const Icon = service.icon;
            return (
              <div key={idx} className="bg-white/10 backdrop-blur-sm p-6 rounded-lg hover:bg-white/20 transition-all">
                <Icon size={40} className="text-[#d4a574] mb-4" />
                <h3 className="text-xl font-bold mb-2">{service.title}</h3>
                <p className="text-gray-300">{service.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-[#d4a574] text-[#1a2332] p-8 rounded-lg text-center">
          <h3 className="text-2xl font-bold mb-4">Ready to Launch Your Property?</h3>
          <p className="text-lg mb-6">
            From acquisition to furnishing to first guest—we handle it all. Our setup services are available across all 64 markets.
          </p>
          <a href="#book-call" className="inline-block bg-[#1a2332] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#2a3d52] transition-colors">
            Schedule Setup Consultation
          </a>
        </div>
      </div>
    </section>
  );
}
