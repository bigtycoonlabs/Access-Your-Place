import { useState, useEffect } from 'react';
import { 
  Calculator, 
  Building, 
  Home, 
  MapPin, 
  BedDouble,
  ArrowRight,
  Info,
  DollarSign,
  CheckCircle2,
  Sparkles,
  FileText
} from 'lucide-react';
import QuoteOptionsModal from './QuoteOptionsModal';

interface CalculatorProps {
  onGetQuote: (data: CalculatorData) => void;
}

export interface CalculatorData {
  propertyCount: number;
  bedrooms: string;
  propertyType: string;
  location: string;
  operationType: string;
  totals: {
    adminFee: number;
    furnitureCost: number;
    logisticsFee: number;
    total: number;
    perProperty: number;
    savings: number;
  };
}

export default function SetupCostCalculator({ onGetQuote }: CalculatorProps) {
  const [propertyCount, setPropertyCount] = useState(1);
  const [bedrooms, setBedrooms] = useState('2');
  const [propertyType, setPropertyType] = useState('apartment');
  const [location, setLocation] = useState('');
  const [operationType, setOperationType] = useState('str');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // Calculate costs based on inputs
  const calculateCosts = () => {
    // Setup Administration Fee with bulk discounts
    let adminFeePerProperty = 2500;
    if (propertyCount >= 10) {
      adminFeePerProperty = 1500;
    } else if (propertyCount >= 6) {
      adminFeePerProperty = 1800;
    } else if (propertyCount >= 4) {
      adminFeePerProperty = 2000;
    } else if (propertyCount >= 2) {
      adminFeePerProperty = 2250;
    }
    const totalAdminFee = adminFeePerProperty * propertyCount;

    // Furniture & Supplies based on bedroom count
    let furniturePerProperty = 4000;
    if (bedrooms === 'studio') {
      furniturePerProperty = 2500;
    } else if (bedrooms === '1') {
      furniturePerProperty = 3000;
    } else if (bedrooms === '2') {
      furniturePerProperty = 3800;
    } else if (bedrooms === '3') {
      furniturePerProperty = 4500;
    } else if (bedrooms === '4') {
      furniturePerProperty = 5500;
    } else if (bedrooms === '5+') {
      furniturePerProperty = 7000;
    }

    // Adjust for co-living (no bedroom furniture)
    if (operationType === 'coliving') {
      furniturePerProperty = furniturePerProperty * 0.5; // Roughly half since no bedroom furniture
    }

    const totalFurniture = furniturePerProperty * propertyCount;

    // Logistics Fee with bundled pricing
    let logisticsFee = 3350;
    if (propertyCount >= 10) {
      // Need 2-3 YP Pros
      logisticsFee = 8500;
    } else if (propertyCount >= 6) {
      // Need 2 YP Pros
      logisticsFee = 6000;
    } else if (propertyCount >= 4) {
      logisticsFee = 4800;
    } else if (propertyCount >= 2) {
      logisticsFee = 4500;
    }

    const total = totalAdminFee + totalFurniture + logisticsFee;
    const perProperty = Math.round(total / propertyCount);

    // Calculate savings vs individual launches
    const individualTotal = (2500 + furniturePerProperty + 3350) * propertyCount;
    const savings = propertyCount > 1 ? individualTotal - total : 0;

    return {
      adminFee: totalAdminFee,
      adminFeePerProperty,
      furnitureCost: totalFurniture,
      furniturePerProperty,
      logisticsFee,
      total,
      perProperty,
      savings
    };
  };

  const costs = calculateCosts();

  useEffect(() => {
    if (propertyCount > 0) {
      setShowBreakdown(true);
    }
  }, [propertyCount, bedrooms, propertyType, operationType]);

  const getQuoteData = (): CalculatorData => ({
    propertyCount,
    bedrooms,
    propertyType,
    location,
    operationType,
    totals: {
      adminFee: costs.adminFee,
      furnitureCost: costs.furnitureCost,
      logisticsFee: costs.logisticsFee,
      total: costs.total,
      perProperty: costs.perProperty,
      savings: costs.savings
    }
  });

  const handleGetQuote = () => {
    setShowQuoteModal(true);
  };

  const handleScrollToForm = () => {
    onGetQuote(getQuoteData());
  };

  const getBedroomLabel = (value: string) => {
    const labels: Record<string, string> = {
      'studio': 'Studio',
      '1': '1 Bedroom',
      '2': '2 Bedrooms',
      '3': '3 Bedrooms',
      '4': '4 Bedrooms',
      '5+': '5+ Bedrooms'
    };
    return labels[value] || value;
  };

  const getPropertyTypeLabel = (value: string) => {
    const labels: Record<string, string> = {
      'apartment': 'Apartment',
      'condo': 'Condo',
      'townhome': 'Townhome',
      'single-family': 'Single Family',
      'high-rise': 'High-Rise'
    };
    return labels[value] || value;
  };

  const getOperationTypeLabel = (value: string) => {
    const labels: Record<string, string> = {
      'str': 'Short-Term Rental',
      'mtr': 'Mid-Term Rental',
      'coliving': 'Co-Living',
      'corporate': 'Corporate Housing',
      'peerspace': 'Peerspace'
    };
    return labels[value] || value;
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2a3d52] p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center">
              <Calculator className="w-6 h-6 text-[#d4a574]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Setup Cost Calculator</h3>
              <p className="text-gray-300 text-sm">Get an instant estimate for your property setup</p>
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <div className="space-y-6">
              {/* Number of Properties */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#1a2332] mb-3" htmlFor="number-of-properties">
                  <Building size={18} className="text-[#d4a574]" />
                  Number of Properties
                </label>
                <div className="flex items-center gap-4">
                  <input id="number-of-properties"
                    type="range"
                    min="1"
                    max="20"
                    value={propertyCount}
                    onChange={(e) => setPropertyCount(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#d4a574]"
                  />
                  <div className="w-16 h-12 bg-[#d4a574]/10 rounded-lg flex items-center justify-center">
                    <span className="text-xl font-bold text-[#d4a574]">{propertyCount}</span>
                  </div>
                </div>
                {propertyCount >= 2 && (
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <Sparkles size={14} />
                    Bulk discount applied!
                  </p>
                )}
              </div>

              {/* Average Bedroom Count */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#1a2332] mb-3">
                  <BedDouble size={18} className="text-[#d4a574]" />
                  Average Bedroom Count
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['studio', '1', '2', '3', '4', '5+'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setBedrooms(option)}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        bedrooms === option
                          ? 'bg-[#d4a574] text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {getBedroomLabel(option)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Property Type */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#1a2332] mb-3">
                  <Home size={18} className="text-[#d4a574]" />
                  Property Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['apartment', 'condo', 'townhome', 'single-family', 'high-rise'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setPropertyType(option)}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        propertyType === option
                          ? 'bg-[#d4a574] text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {getPropertyTypeLabel(option)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Operation Type */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#1a2332] mb-3">
                  <Sparkles size={18} className="text-[#d4a574]" />
                  Operation Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['str', 'mtr', 'coliving', 'corporate', 'peerspace'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setOperationType(option)}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        operationType === option
                          ? 'bg-[#d4a574] text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {getOperationTypeLabel(option)}
                    </button>
                  ))}
                </div>
                {operationType === 'coliving' && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <Info size={14} />
                    Co-living setups don't include bedroom furniture—reduced cost reflected
                  </p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#1a2332] mb-3" htmlFor="property-location">
                  <MapPin size={18} className="text-[#d4a574]" />
                  Property Location
                </label>
                <input id="property-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, State (e.g., Austin, TX)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                />
              </div>
            </div>

            {/* Results Section */}
            <div>
              {showBreakdown && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 h-full">
                  <h4 className="text-lg font-bold text-[#1a2332] mb-6 flex items-center gap-2">
                    <DollarSign className="text-[#d4a574]" />
                    Estimated Cost Breakdown
                  </h4>

                  <div className="space-y-4 mb-6">
                    {/* Admin Fee */}
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-[#1a2332]">Setup Administration Fee</p>
                          <p className="text-xs text-gray-500">
                            ${costs.adminFeePerProperty.toLocaleString()}/property × {propertyCount}
                          </p>
                        </div>
                        <span className="text-lg font-bold text-[#1a2332]">
                          ${costs.adminFee.toLocaleString()}
                        </span>
                      </div>
                      {propertyCount >= 2 && (
                        <span className="inline-block bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full">
                          Bulk discount applied
                        </span>
                      )}
                    </div>

                    {/* Furniture */}
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-[#1a2332]">Furniture & Supplies</p>
                          <p className="text-xs text-gray-500">
                            ~${costs.furniturePerProperty.toLocaleString()}/property × {propertyCount}
                          </p>
                        </div>
                        <span className="text-lg font-bold text-[#1a2332]">
                          ${costs.furnitureCost.toLocaleString()}
                        </span>
                      </div>
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                        {getBedroomLabel(bedrooms)} estimate
                      </span>
                    </div>

                    {/* Logistics */}
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-[#1a2332]">Logistics Fee</p>
                          <p className="text-xs text-gray-500">
                            {propertyCount >= 10 ? '2-3 YP Pros' : propertyCount >= 6 ? '2 YP Pros' : '1 YP Pro'} on-site
                          </p>
                        </div>
                        <span className="text-lg font-bold text-[#1a2332]">
                          ${costs.logisticsFee.toLocaleString()}
                        </span>
                      </div>
                      {propertyCount >= 2 && (
                        <span className="inline-block bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full">
                          Bundled rate
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="border-t-2 border-dashed border-gray-300 pt-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-bold text-[#1a2332]">Total Estimate</span>
                      <span className="text-3xl font-bold text-[#d4a574]">
                        ${costs.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>Per Property</span>
                      <span className="font-semibold">${costs.perProperty.toLocaleString()}</span>
                    </div>
                    {costs.savings > 0 && (
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                        <p className="text-emerald-700 font-semibold flex items-center justify-center gap-2">
                          <CheckCircle2 size={18} />
                          You save ${costs.savings.toLocaleString()} with bulk pricing!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={handleGetQuote}
                    className="w-full bg-[#d4a574] text-[#1a2332] py-4 rounded-lg font-bold text-lg hover:bg-[#c49564] transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    <FileText size={20} />
                    Get Detailed Quote
                    <ArrowRight size={20} />
                  </button>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    * Estimates are approximate. Final pricing may vary based on specific requirements, design complexity, and market conditions.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quote Options Modal */}
      <QuoteOptionsModal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        quoteData={getQuoteData()}
        onScrollToForm={handleScrollToForm}
      />
    </>
  );
}
