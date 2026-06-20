import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, RefreshCw, Sparkles, MapPin, Home, Plus, FileSpreadsheet } from 'lucide-react';

interface DealFlowFiltersProps {
  zipCode: string;
  onZipCodeChange: (zip: string) => void;
  addressSearch: string;
  onAddressSearchChange: (addr: string) => void;
  onSearch: () => void;
  onDiscover: () => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (source: string) => void;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  onRefresh: () => void;
  searching: boolean;
  discovering: boolean;
  cityState?: string;
  onCityStateChange?: (value: string) => void;
  onAddDeal?: () => void;
  onImportCSV?: () => void;
}

export function DealFlowFilters({
  zipCode, onZipCodeChange, addressSearch, onAddressSearchChange, onSearch, onDiscover, 
  statusFilter, onStatusFilterChange, sourceFilter, onSourceFilterChange, typeFilter, 
  onTypeFilterChange, onRefresh, searching, discovering, cityState = '', onCityStateChange, onAddDeal, onImportCSV
}: DealFlowFiltersProps) {
  return (
    <div className="space-y-4" role="search" aria-label="Deal flow search and filters">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <Input 
            placeholder="Search by address..." 
            value={addressSearch} 
            onChange={(e) => onAddressSearchChange(e.target.value)} 
            className="pl-10" 
            onKeyDown={(e) => e.key === 'Enter' && onSearch()} 
            aria-label="Search by property address"
          />
        </div>
        <div className="relative min-w-[120px] max-w-[140px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <Input 
            placeholder="ZIP Code" 
            value={zipCode} 
            onChange={(e) => onZipCodeChange(e.target.value)} 
            className="pl-10" 
            onKeyDown={(e) => e.key === 'Enter' && onSearch()} 
            aria-label="Search by ZIP code"
          />
        </div>
        <div className="relative min-w-[140px] max-w-[180px]">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <Input 
            placeholder="City, State" 
            value={cityState} 
            onChange={(e) => onCityStateChange?.(e.target.value)} 
            className="pl-10" 
            aria-label="Search by city and state"
          />
        </div>
        <Button 
          onClick={onSearch} 
          disabled={searching} 
          className="bg-[#d4a574] hover:bg-[#c49464]"
          aria-label="Search properties"
        >
          {searching ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
          <span className="ml-2 hidden sm:inline">Search</span>
        </Button>
        <Button 
          onClick={onDiscover} 
          disabled={discovering || !zipCode} 
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          aria-label="Use AI to discover properties in the entered ZIP code"
        >
          {discovering ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
          <span className="ml-2">AI Discover</span>
        </Button>
        {onAddDeal && (
          <Button onClick={onAddDeal} className="bg-green-600 hover:bg-green-700" aria-label="Add a new deal manually">
            <Plus className="w-4 h-4" aria-hidden="true" /><span className="ml-2">Add Deal</span>
          </Button>
        )}
        {onImportCSV && (
          <Button onClick={onImportCSV} variant="outline" className="border-[#d4a574] text-[#d4a574] hover:bg-[#d4a574]/10" aria-label="Import deals from CSV file">
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" /><span className="ml-2">Import CSV</span>
          </Button>
        )}
        <Button variant="outline" onClick={onRefresh} aria-label="Refresh deal list">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 items-center" role="group" aria-label="Filter options">
        <Filter className="w-4 h-4 text-gray-500" aria-hidden="true" />
        <span className="sr-only">Filter by:</span>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="researching">Researching</SelectItem>
            <SelectItem value="outreach">Outreach</SelectItem>
            <SelectItem value="negotiating">Negotiating</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by source"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="third_party_submission">Third Party</SelectItem>
            <SelectItem value="acquisition_team">Acquisition Team</SelectItem>
            <SelectItem value="yp_discovery">AI Discovery</SelectItem>
            <SelectItem value="csv_import">CSV Import</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by property type"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="apartment">Apartment</SelectItem>
            <SelectItem value="private_landlord">Private Landlord</SelectItem>
            <SelectItem value="townhome">Townhome</SelectItem>
            <SelectItem value="single_family">Single Family</SelectItem>
            <SelectItem value="condo">Condo</SelectItem>
            <SelectItem value="multi_family">Multi-Family</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
