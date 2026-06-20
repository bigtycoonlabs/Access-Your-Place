import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { 
  SlidersHorizontal, X, ChevronDown, ChevronUp, 
  Building2, Home, Users, Briefcase, MapPin, DollarSign,
  Bed, Bath, CheckCircle, Star
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface MarketplaceFiltersState {
  operationType: string[];
  propertyType: string[];
  priceRange: [number, number];
  bedroomRange: [number, number];
  bathroomRange: [number, number];
  furnished: boolean | null;
  verified: boolean | null;
  states: string[];
}

interface MarketplaceFiltersProps {
  filters: MarketplaceFiltersState;
  onFiltersChange: (filters: MarketplaceFiltersState) => void;
  availableStates: string[];
  resultCount: number;
  onClearFilters: () => void;
}

const OPERATION_TYPES = [
  { id: 'str', label: 'Short-Term Rental', icon: Building2, color: 'bg-blue-500' },
  { id: 'coliving', label: 'Co-Living', icon: Users, color: 'bg-purple-500' },
  { id: 'both', label: 'STR + Co-Living', icon: Star, color: 'bg-amber-500' },
  { id: 'peerspace', label: 'Peer Space', icon: Briefcase, color: 'bg-emerald-500' },
];

const PROPERTY_TYPES = [
  { id: 'single_family', label: 'Single Family' },
  { id: 'apartment', label: 'Apartment' },
  { id: 'condo', label: 'Condo' },
  { id: 'townhouse', label: 'Townhouse' },
  { id: 'multi_family', label: 'Multi-Family' },
  { id: 'duplex', label: 'Duplex' },
];

export function MarketplaceFilters({
  filters,
  onFiltersChange,
  availableStates,
  resultCount,
  onClearFilters
}: MarketplaceFiltersProps) {
  const [openSections, setOpenSections] = useState({
    operation: true,
    property: true,
    price: true,
    bedrooms: false,
    location: false,
    features: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleOperationType = (type: string) => {
    const newTypes = filters.operationType.includes(type)
      ? filters.operationType.filter(t => t !== type)
      : [...filters.operationType, type];
    onFiltersChange({ ...filters, operationType: newTypes });
  };

  const togglePropertyType = (type: string) => {
    const newTypes = filters.propertyType.includes(type)
      ? filters.propertyType.filter(t => t !== type)
      : [...filters.propertyType, type];
    onFiltersChange({ ...filters, propertyType: newTypes });
  };

  const toggleState = (state: string) => {
    const newStates = filters.states.includes(state)
      ? filters.states.filter(s => s !== state)
      : [...filters.states, state];
    onFiltersChange({ ...filters, states: newStates });
  };

  const activeFilterCount = [
    filters.operationType.length > 0,
    filters.propertyType.length > 0,
    filters.priceRange[0] > 0 || filters.priceRange[1] < 50000,
    filters.bedroomRange[0] > 0 || filters.bedroomRange[1] < 10,
    filters.furnished !== null,
    filters.verified !== null,
    filters.states.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-900">Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="bg-[#d4a574]">{activeFilterCount}</Badge>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearFilters}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {resultCount.toLocaleString()} deals found
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Operation Type */}
        <Collapsible open={openSections.operation} onOpenChange={() => toggleSection('operation')}>
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <span className="font-medium text-gray-900">Operation Type</span>
            {openSections.operation ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className="space-y-2">
              {OPERATION_TYPES.map(type => (
                <label
                  key={type.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    filters.operationType.includes(type.id) 
                      ? 'bg-[#d4a574]/10 border border-[#d4a574]' 
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <Checkbox
                    checked={filters.operationType.includes(type.id)}
                    onCheckedChange={() => toggleOperationType(type.id)}
                  />
                  <div className={`w-8 h-8 rounded-lg ${type.color} flex items-center justify-center`}>
                    <type.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">{type.label}</span>
                </label>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Property Type */}
        <Collapsible open={openSections.property} onOpenChange={() => toggleSection('property')}>
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <span className="font-medium text-gray-900">Property Type</span>
            {openSections.property ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
              {PROPERTY_TYPES.map(type => (
                <label
                  key={type.id}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm transition-colors ${
                    filters.propertyType.includes(type.id) 
                      ? 'bg-[#d4a574]/10 border border-[#d4a574]' 
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <Checkbox
                    checked={filters.propertyType.includes(type.id)}
                    onCheckedChange={() => togglePropertyType(type.id)}
                  />
                  <span>{type.label}</span>
                </label>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Price Range */}
        <Collapsible open={openSections.price} onOpenChange={() => toggleSection('price')}>
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <span className="font-medium text-gray-900">Acquisition Fee</span>
            {openSections.price ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className="space-y-4">
              <Slider
                value={[filters.priceRange[0], filters.priceRange[1]]}
                onValueChange={(value) => onFiltersChange({ ...filters, priceRange: [value[0], value[1]] })}
                min={0}
                max={50000}
                step={1000}
                className="mt-2"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">${filters.priceRange[0].toLocaleString()}</span>
                <span className="text-gray-600">${filters.priceRange[1].toLocaleString()}{filters.priceRange[1] >= 50000 ? '+' : ''}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Under $5K', range: [0, 5000] },
                  { label: '$5K-$10K', range: [5000, 10000] },
                  { label: '$10K-$20K', range: [10000, 20000] },
                  { label: '$20K+', range: [20000, 50000] },
                ].map(preset => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => onFiltersChange({ ...filters, priceRange: preset.range as [number, number] })}
                    className={`text-xs ${
                      filters.priceRange[0] === preset.range[0] && filters.priceRange[1] === preset.range[1]
                        ? 'bg-[#d4a574] text-white border-[#d4a574]'
                        : ''
                    }`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Bedrooms */}
        <Collapsible open={openSections.bedrooms} onOpenChange={() => toggleSection('bedrooms')}>
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <span className="font-medium text-gray-900">Bedrooms</span>
            {openSections.bedrooms ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, '6+'].map(num => (
                <Button
                  key={num}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const value = typeof num === 'string' ? 6 : num;
                    onFiltersChange({ 
                      ...filters, 
                      bedroomRange: [value, typeof num === 'string' ? 10 : value] 
                    });
                  }}
                  className={`min-w-[50px] ${
                    filters.bedroomRange[0] === (typeof num === 'string' ? 6 : num)
                      ? 'bg-[#d4a574] text-white border-[#d4a574]'
                      : ''
                  }`}
                >
                  {num}
                </Button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Location */}
        <Collapsible open={openSections.location} onOpenChange={() => toggleSection('location')}>
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <span className="font-medium text-gray-900">Location</span>
            {openSections.location ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {availableStates.map(state => (
                <label
                  key={state}
                  className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <Checkbox
                    checked={filters.states.includes(state)}
                    onCheckedChange={() => toggleState(state)}
                  />
                  <span className="text-sm">{state}</span>
                </label>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Features */}
        <Collapsible open={openSections.features} onOpenChange={() => toggleSection('features')}>
          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <span className="font-medium text-gray-900">Features</span>
            {openSections.features ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50">
                <Checkbox
                  checked={filters.furnished === true}
                  onCheckedChange={(checked) => onFiltersChange({ ...filters, furnished: checked ? true : null })}
                />
                <span className="text-sm">Furnished Only</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50">
                <Checkbox
                  checked={filters.verified === true}
                  onCheckedChange={(checked) => onFiltersChange({ ...filters, verified: checked ? true : null })}
                />
                <span className="text-sm">YP Verified Only</span>
              </label>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
