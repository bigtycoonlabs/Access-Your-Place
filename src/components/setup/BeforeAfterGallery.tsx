import { useState, useRef } from 'react';
import { 
  Filter, 
  Home, 
  BedDouble, 
  MapPin, 
  Calendar, 
  Palette,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

interface PropertyTransformation {
  id: number;
  beforeImage: string;
  afterImage: string;
  propertyType: 'apartment' | 'townhome' | 'single-family' | 'high-rise';
  bedrooms: number;
  location: string;
  timeline: string;
  designTheme: string;
  totalInvestment: number;
  operationType: 'str' | 'coliving' | 'mtr' | 'corporate';
  description: string;
}

const transformations: PropertyTransformation[] = [
  {
    id: 1,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364871930_c51140a6.png',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364942870_3503b6ee.jpg',
    propertyType: 'apartment',
    bedrooms: 2,
    location: 'Tampa, FL',
    timeline: '28 days',
    designTheme: 'Coastal',
    totalInvestment: 8950,
    operationType: 'str',
    description: 'Light and airy coastal design with natural textures and beach-inspired accents.'
  },
  {
    id: 2,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364872349_0c50f8f1.png',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364965627_a7586e90.png',
    propertyType: 'townhome',
    bedrooms: 3,
    location: 'Nashville, TN',
    timeline: '32 days',
    designTheme: 'Modern Farmhouse',
    totalInvestment: 10200,
    operationType: 'str',
    description: 'Warm neutral tones with rustic wood accents and comfortable, inviting furniture.'
  },
  {
    id: 3,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364870765_0953980d.jpg',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767365000080_7ddf5d90.jpg',
    propertyType: 'high-rise',
    bedrooms: 1,
    location: 'Austin, TX',
    timeline: '25 days',
    designTheme: 'Contemporary Luxury',
    totalInvestment: 7500,
    operationType: 'corporate',
    description: 'Sleek modern design with clean lines and sophisticated neutral palette.'
  },
  {
    id: 4,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364885807_6d224720.png',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767365035071_b64ff3d2.jpg',
    propertyType: 'apartment',
    bedrooms: 2,
    location: 'Charlotte, NC',
    timeline: '30 days',
    designTheme: 'Cozy Chic',
    totalInvestment: 8800,
    operationType: 'str',
    description: 'Warm blush and cream tones with soft textures and inviting atmosphere.'
  },
  {
    id: 5,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364917348_9093d066.png',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767365152277_2762c6b7.png',
    propertyType: 'single-family',
    bedrooms: 4,
    location: 'Atlanta, GA',
    timeline: '35 days',
    designTheme: 'Co-Living Communal',
    totalInvestment: 6500,
    operationType: 'coliving',
    description: 'Communal-focused setup with large sectional, dining for groups, and labeled spaces.'
  },
  {
    id: 6,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364903640_53e743a6.jpg',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364945056_787441ec.jpg',
    propertyType: 'apartment',
    bedrooms: 1,
    location: 'Miami, FL',
    timeline: '24 days',
    designTheme: 'Coastal',
    totalInvestment: 7200,
    operationType: 'str',
    description: 'Bright coastal vibes with white and blue palette, perfect for beach getaways.'
  },
  {
    id: 7,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364904991_b6226527.jpg',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364984173_c86e95d3.png',
    propertyType: 'townhome',
    bedrooms: 2,
    location: 'Dallas, TX',
    timeline: '29 days',
    designTheme: 'Modern Farmhouse',
    totalInvestment: 9100,
    operationType: 'mtr',
    description: 'Cozy farmhouse aesthetic with modern amenities for extended stays.'
  },
  {
    id: 8,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364912417_ffa945a9.png',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767365074896_ddcd4a82.png',
    propertyType: 'high-rise',
    bedrooms: 2,
    location: 'Denver, CO',
    timeline: '27 days',
    designTheme: 'Contemporary Classic',
    totalInvestment: 8600,
    operationType: 'corporate',
    description: 'Timeless design with elegant neutrals and sophisticated furnishings.'
  },
  {
    id: 9,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364871930_c51140a6.png',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767365018361_4dfc6447.png',
    propertyType: 'apartment',
    bedrooms: 3,
    location: 'Phoenix, AZ',
    timeline: '31 days',
    designTheme: 'Contemporary Luxury',
    totalInvestment: 10500,
    operationType: 'str',
    description: 'Modern luxury with sleek furniture and high-end finishes throughout.'
  },
  {
    id: 10,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364903640_53e743a6.jpg',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767365117064_efb0fa5f.jpg',
    propertyType: 'single-family',
    bedrooms: 5,
    location: 'Orlando, FL',
    timeline: '38 days',
    designTheme: 'Co-Living Communal',
    totalInvestment: 7800,
    operationType: 'coliving',
    description: 'Large communal space optimized for group living with smart lock integration.'
  },
  {
    id: 11,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364872349_0c50f8f1.png',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767365036378_ee767fee.jpg',
    propertyType: 'townhome',
    bedrooms: 2,
    location: 'San Antonio, TX',
    timeline: '28 days',
    designTheme: 'Cozy Chic',
    totalInvestment: 8400,
    operationType: 'str',
    description: 'Warm and welcoming design with plush textures and thoughtful decor.'
  },
  {
    id: 12,
    beforeImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364885807_6d224720.png',
    afterImage: 'https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1767364942870_3503b6ee.jpg',
    propertyType: 'apartment',
    bedrooms: 1,
    location: 'Jacksonville, FL',
    timeline: '23 days',
    designTheme: 'Coastal',
    totalInvestment: 6900,
    operationType: 'mtr',
    description: 'Relaxed coastal aesthetic perfect for traveling professionals.'
  }
];

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  onExpand: () => void;
}

function BeforeAfterSlider({ beforeImage, afterImage, onExpand }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current || !isDragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video overflow-hidden rounded-t-xl cursor-col-resize select-none"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      onTouchMove={handleTouchMove}
      onClick={onExpand}
    >
      {/* After Image (Background) */}
      <img
        src={afterImage}
        alt="After transformation"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      
      {/* Before Image (Clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={beforeImage}
          alt="Before transformation"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ width: containerRef.current?.offsetWidth || '100%' }}
          draggable={false}
        />
      </div>

      {/* Slider Line */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-col-resize z-10"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
          <ChevronLeft size={16} className="text-gray-600 -mr-1" />
          <ChevronRight size={16} className="text-gray-600 -ml-1" />
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
        BEFORE
      </div>
      <div className="absolute top-3 right-3 bg-[#d4a574] text-white text-xs px-2 py-1 rounded">
        AFTER
      </div>
    </div>
  );
}

export default function BeforeAfterGallery() {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBedrooms, setFilterBedrooms] = useState<string>('all');
  const [expandedImage, setExpandedImage] = useState<PropertyTransformation | null>(null);

  const filteredTransformations = transformations.filter((item) => {
    const typeMatch = filterType === 'all' || item.propertyType === filterType;
    const bedroomMatch = filterBedrooms === 'all' || 
      (filterBedrooms === '1' && item.bedrooms === 1) ||
      (filterBedrooms === '2' && item.bedrooms === 2) ||
      (filterBedrooms === '3' && item.bedrooms === 3) ||
      (filterBedrooms === '4+' && item.bedrooms >= 4);
    return typeMatch && bedroomMatch;
  });

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'apartment': 'Apartment',
      'townhome': 'Townhome',
      'single-family': 'Single Family',
      'high-rise': 'High-Rise'
    };
    return labels[type] || type;
  };

  const getOperationLabel = (type: string) => {
    const labels: Record<string, string> = {
      'str': 'Short-Term Rental',
      'coliving': 'Co-Living',
      'mtr': 'Mid-Term Rental',
      'corporate': 'Corporate Housing'
    };
    return labels[type] || type;
  };

  const getThemeColor = (theme: string) => {
    const colors: Record<string, string> = {
      'Coastal': 'bg-blue-100 text-blue-700',
      'Modern Farmhouse': 'bg-amber-100 text-amber-700',
      'Contemporary Luxury': 'bg-gray-100 text-gray-700',
      'Cozy Chic': 'bg-pink-100 text-pink-700',
      'Contemporary Classic': 'bg-slate-100 text-slate-700',
      'Co-Living Communal': 'bg-purple-100 text-purple-700'
    };
    return colors[theme] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-[#d4a574]" />
          <h3 className="font-semibold text-[#1a2332]">Filter Portfolio</h3>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Property Type Filter */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Property Type</label>
            <div className="flex flex-wrap gap-2">
              {['all', 'apartment', 'townhome', 'single-family', 'high-rise'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === type
                      ? 'bg-[#d4a574] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type === 'all' ? 'All Types' : getPropertyTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Bedroom Filter */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Bedrooms</label>
            <div className="flex flex-wrap gap-2">
              {['all', '1', '2', '3', '4+'].map((beds) => (
                <button
                  key={beds}
                  onClick={() => setFilterBedrooms(beds)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterBedrooms === beds
                      ? 'bg-[#d4a574] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {beds === 'all' ? 'All' : beds === '4+' ? '4+ BR' : `${beds} BR`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-gray-600 mb-6">
        Showing {filteredTransformations.length} of {transformations.length} transformations
      </p>

      {/* Gallery Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTransformations.map((item) => (
          <div key={item.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            <BeforeAfterSlider
              beforeImage={item.beforeImage}
              afterImage={item.afterImage}
              onExpand={() => setExpandedImage(item)}
            />
            
            <div className="p-5">
              {/* Theme Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getThemeColor(item.designTheme)}`}>
                  {item.designTheme}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  {getOperationLabel(item.operationType)}
                </span>
              </div>

              {/* Property Details */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Home size={14} className="text-[#d4a574]" />
                  <span>{getPropertyTypeLabel(item.propertyType)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <BedDouble size={14} className="text-[#d4a574]" />
                  <span>{item.bedrooms} Bedroom{item.bedrooms > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={14} className="text-[#d4a574]" />
                  <span>{item.location}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={14} className="text-[#d4a574]" />
                  <span>{item.timeline}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {item.description}
              </p>

              {/* Investment */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">Total Investment</span>
                <span className="text-lg font-bold text-[#d4a574]">
                  ${item.totalInvestment.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTransformations.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-500">No transformations match your filters. Try adjusting your selection.</p>
        </div>
      )}

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setExpandedImage(null)}
          >
            <X size={32} />
          </button>
          
          <div 
            className="max-w-5xl w-full bg-white rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video">
              <BeforeAfterSlider
                beforeImage={expandedImage.beforeImage}
                afterImage={expandedImage.afterImage}
                onExpand={() => {}}
              />
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${getThemeColor(expandedImage.designTheme)}`}>
                  {expandedImage.designTheme}
                </span>
                <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                  {getOperationLabel(expandedImage.operationType)}
                </span>
              </div>
              
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Home size={18} className="text-[#d4a574]" />
                  <span>{getPropertyTypeLabel(expandedImage.propertyType)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BedDouble size={18} className="text-[#d4a574]" />
                  <span>{expandedImage.bedrooms} Bedroom{expandedImage.bedrooms > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-[#d4a574]" />
                  <span>{expandedImage.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-[#d4a574]" />
                  <span>{expandedImage.timeline}</span>
                </div>
              </div>
              
              <p className="text-gray-600 mb-4">{expandedImage.description}</p>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <DollarSign size={20} className="text-[#d4a574]" />
                  <span className="text-gray-600">Total Investment</span>
                </div>
                <span className="text-2xl font-bold text-[#d4a574]">
                  ${expandedImage.totalInvestment.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
