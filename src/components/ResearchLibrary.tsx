import { TrendingUp, MapPin, DollarSign, BarChart3 } from 'lucide-react';

const markets = [
  { city: 'Austin', state: 'TX', adr: '$215', occupancy: '68%', trend: 'up' },
  { city: 'Nashville', state: 'TN', adr: '$195', occupancy: '72%', trend: 'up' },
  { city: 'Tampa', state: 'FL', adr: '$175', occupancy: '75%', trend: 'stable' },
  { city: 'Charlotte', state: 'NC', adr: '$155', occupancy: '65%', trend: 'up' },
  { city: 'Phoenix', state: 'AZ', adr: '$185', occupancy: '70%', trend: 'stable' },
  { city: 'Denver', state: 'CO', adr: '$205', occupancy: '62%', trend: 'down' },
];

export default function ResearchLibrary() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#1a2332] mb-4">Market Research Library</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Real-time market data to inform your investment decisions</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {markets.map((market, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#d4a574]" />
                  <h3 className="font-semibold text-lg">{market.city}, {market.state}</h3>
                </div>
                <TrendingUp className={`w-5 h-5 ${market.trend === 'up' ? 'text-green-500' : market.trend === 'down' ? 'text-red-500' : 'text-gray-400'}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <div><p className="text-xs text-gray-500">ADR</p><p className="font-semibold">{market.adr}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                  <div><p className="text-xs text-gray-500">Occupancy</p><p className="font-semibold">{market.occupancy}</p></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[#d4a574] text-white p-6 rounded-lg text-center">
          <p className="text-lg font-semibold mb-3">Ready to act on this data?</p>
          <a href="/deals" className="inline-block bg-white text-[#1a2332] px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            See Current Deals Vetted by Our Team
          </a>
        </div>
      </div>
    </section>
  );
}
