import React, { useState } from 'react';
import { marketData, MarketData } from '../data/marketComparisonData';
import { Button } from './ui/button';
import { Check, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MarketComparisonTool: React.FC = () => {
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  const toggleCity = (cityId: string) => {
    if (selectedCities.includes(cityId)) {
      setSelectedCities(selectedCities.filter(id => id !== cityId));
    } else if (selectedCities.length < 4) {
      setSelectedCities([...selectedCities, cityId]);
    }
  };

  const selectedMarkets = marketData.filter(m => selectedCities.includes(m.id));

  const getBestValue = (key: keyof MarketData, higher: boolean = true) => {
    if (selectedMarkets.length === 0) return null;
    const values = selectedMarkets.map(m => m[key] as number);
    return higher ? Math.max(...values) : Math.min(...values);
  };

  const getIndicator = (value: number, bestValue: number | null, higher: boolean = true) => {
    if (bestValue === null || bestValue === value) {
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    }
    const threshold = higher ? bestValue * 0.9 : bestValue * 1.1;
    if (higher ? value >= threshold : value <= threshold) {
      return <Minus className="w-4 h-4 text-yellow-600" />;
    }
    return <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  const getFrictionColor = (level: string) => {
    if (level === 'Low') return 'text-green-600 bg-green-50';
    if (level === 'Medium') return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Market Comparison Tool</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Compare up to 4 markets side-by-side to find the best STR opportunities
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h3 className="text-xl font-semibold mb-4">Select 2-4 Cities to Compare</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {marketData.map(market => (
              <button
                key={market.id}
                onClick={() => toggleCity(market.id)}
                disabled={!selectedCities.includes(market.id) && selectedCities.length >= 4}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  selectedCities.includes(market.id)
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                } ${!selectedCities.includes(market.id) && selectedCities.length >= 4 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{market.city}</div>
                    <div className="text-sm text-gray-500">{market.state}</div>
                  </div>
                  {selectedCities.includes(market.id) && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedMarkets.length >= 2 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">Metric</th>
                    {selectedMarkets.map(market => (
                      <th key={market.id} className="px-6 py-4 text-center font-semibold text-gray-700">
                        {market.city}, {market.state}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">Average Daily Rate</td>
                    {selectedMarkets.map(market => (
                      <td key={market.id} className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-semibold">${market.adr}</span>
                          {getIndicator(market.adr, getBestValue('adr', true), true)}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">Occupancy Rate</td>
                    {selectedMarkets.map(market => (
                      <td key={market.id} className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-semibold">{market.occupancy}%</span>
                          {getIndicator(market.occupancy, getBestValue('occupancy', true), true)}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">Monthly Revenue</td>
                    {selectedMarkets.map(market => (
                      <td key={market.id} className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-semibold">${market.monthlyRevenue.toLocaleString()}</span>
                          {getIndicator(market.monthlyRevenue, getBestValue('monthlyRevenue', true), true)}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">Hotel Tax Rate</td>
                    {selectedMarkets.map(market => (
                      <td key={market.id} className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-semibold">{market.hotelTaxRate}%</span>
                          {getIndicator(market.hotelTaxRate, getBestValue('hotelTaxRate', false), false)}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">Licensing Required</td>
                    {selectedMarkets.map(market => (
                      <td key={market.id} className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          market.licensingRequired ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {market.licensingRequired ? 'Yes' : 'No'}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">Licensing Complexity</td>
                    {selectedMarkets.map(market => (
                      <td key={market.id} className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getFrictionColor(market.licensingComplexity)}`}>
                          {market.licensingComplexity}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">Regulatory Friction</td>
                    {selectedMarkets.map(market => (
                      <td key={market.id} className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getFrictionColor(market.regulatoryFriction)}`}>
                          {market.regulatoryFriction}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-gray-50 bg-blue-50">
                    <td className="px-6 py-4 font-medium">Best For</td>
                    {selectedMarkets.map(market => (
                      <td key={market.id} className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-blue-700">{market.bestFor}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedMarkets.length < 2 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">Select at least 2 cities to see the comparison</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default MarketComparisonTool;
