import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, MapPin, SlidersHorizontal, Bell, Heart, 
  TrendingUp, Shield, Clock, Zap, ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MarketplaceHeaderProps {
  totalDeals: number;
  totalStates: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  selectedLocation: string;
  onLocationChange: (location: string) => void;
  locations: string[];
}

export function MarketplaceHeader({
  totalDeals,
  totalStates,
  searchQuery,
  onSearchChange,
  onSearch,
  selectedLocation,
  onLocationChange,
  locations
}: MarketplaceHeaderProps) {
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  return (
    <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white">
      {/* Top Bar */}
      <div className="border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-white/80">All deals pre-verified</span>
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-white/80">24-hour response time</span>
              </span>
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-white/80">Instant deal alerts</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                <Heart className="w-4 h-4 mr-2" />
                Saved Deals
              </Button>
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                <Bell className="w-4 h-4 mr-2" />
                Deal Alerts
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 mb-4">
            <TrendingUp className="w-3 h-3 mr-1" />
            {totalDeals.toLocaleString()} Active Opportunities
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Rental Arbitrage Marketplace
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Browse pre-negotiated deals across {totalStates} states. Every property is landlord-approved and ready for acquisition.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-2 shadow-2xl flex flex-col md:flex-row gap-2">
            {/* Location Dropdown */}
            <DropdownMenu open={showLocationDropdown} onOpenChange={setShowLocationDropdown}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="justify-start text-gray-700 hover:bg-gray-100 min-w-[180px]"
                >
                  <MapPin className="w-4 h-4 mr-2 text-[#d4a574]" />
                  {selectedLocation || 'All Locations'}
                  <ChevronDown className="w-4 h-4 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] max-h-[300px] overflow-y-auto">
                <DropdownMenuItem onClick={() => onLocationChange('')}>
                  All Locations
                </DropdownMenuItem>
                {locations.map(loc => (
                  <DropdownMenuItem key={loc} onClick={() => onLocationChange(loc)}>
                    {loc}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by city, ZIP code, or property type..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                className="pl-10 border-0 text-gray-900 text-base h-12 focus-visible:ring-0"
              />
            </div>

            {/* Search Button */}
            <Button 
              onClick={onSearch}
              className="bg-[#d4a574] hover:bg-[#c49464] text-white h-12 px-8"
            >
              <Search className="w-5 h-5 mr-2" />
              Search Deals
            </Button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['Under $5K', '$5K-$10K', '$10K+', 'Furnished', 'STR Ready', 'Co-Living'].map((filter) => (
              <Button
                key={filter}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-black/20 border-t border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-[#d4a574]">{totalDeals.toLocaleString()}</div>
              <div className="text-sm text-white/60">Active Deals</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">{totalStates}</div>
              <div className="text-sm text-white/60">States Covered</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">100%</div>
              <div className="text-sm text-white/60">Pre-Approved</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">$2.5M+</div>
              <div className="text-sm text-white/60">Deals Closed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
