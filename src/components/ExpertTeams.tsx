import { Search, TrendingUp, Wrench } from 'lucide-react';

export default function ExpertTeams() {
  const teams = [
    {
      name: 'Acquisition Team',
      image: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1762829033083_696bdc81.webp',
      icon: Search,
      description: 'Expert negotiators who secure the best rental arbitrage deals across 64+ cities using proprietary data analysis.',
    },
    {
      name: 'Success Team',
      image: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1762829034795_e84b2d68.webp',
      icon: TrendingUp,
      description: 'Strategic advisors who optimize your portfolio performance and maximize ROI through data-driven insights.',
    },
    {
      name: 'Setup Team',
      image: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1762829036565_ae1a103b.webp',
      icon: Wrench,
      description: 'Operations specialists who handle furnishing, photography, and listing optimization for rapid deployment.',
    },
  ];

  return (
    <section id="expertise" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-[#1a2332] mb-4">Meet Our Expert Teams</h2>
          <p className="text-xl text-gray-600">
            Three specialized departments working together to ensure your success
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {teams.map((team, idx) => {
            const Icon = team.icon;
            return (
              <div key={idx} className="text-center">
                <div className="mb-4 relative">
                  <img
                    src={team.image}
                    alt={team.name}
                    className="w-32 h-32 rounded-full mx-auto object-cover shadow-lg"
                  />
                  <div className="absolute bottom-0 right-1/2 transform translate-x-16 bg-[#d4a574] p-3 rounded-full">
                    <Icon size={24} className="text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-[#1a2332] mb-3">{team.name}</h3>
                <p className="text-gray-600">{team.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
