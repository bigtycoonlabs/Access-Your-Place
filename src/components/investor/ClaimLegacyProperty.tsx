import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Search, Building2, MapPin, Bed, Bath, 
  CheckCircle, AlertCircle, History, ArrowRight
} from 'lucide-react';

interface Props {
  investorId: string;
  investorEmail: string;
  onPropertyClaimed: () => void;
}

interface LegacyProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthly_rent?: number;
  property_type?: string;
  acquisition_date?: string;
  legacy_system?: string;
  original_investor_name?: string;
}

export function ClaimLegacyProperty({ investorId, investorEmail, onPropertyClaimed }: Props) {
  const [searchAddress, setSearchAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LegacyProperty[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<LegacyProperty | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchAddress.trim() && searchAddress.length < 3) {
      toast({ 
        title: 'Enter an Address', 
        description: 'Please enter at least 3 characters of your property address to search.',
        variant: 'destructive' 
      });
      return;
    }

    setSearching(true);
    setHasSearched(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'search_legacy_properties',
          investor_id: investorId,
          investor_email: investorEmail,
          search_address: searchAddress.trim()
        }
      });

      if (error) throw error;

      if (data?.success) {
        setSearchResults(data.properties || []);
        if (data.properties?.length === 0) {
          toast({
            title: 'No Properties Found',
            description: 'No legacy properties match your search. Try a different address or contact support.',
          });
        }
      } else {
        throw new Error(data?.error || 'Search failed');
      }
    } catch (err: any) {
      toast({ title: 'Search Error', description: err.message, variant: 'destructive' });
      setSearchResults([]);
    }
    
    setSearching(false);
  };

  const handleSearchByEmail = async () => {
    setSearching(true);
    setHasSearched(true);
    setSearchAddress('');
    
    try {
      const { data, error } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'search_legacy_properties',
          investor_id: investorId,
          investor_email: investorEmail
        }
      });

      if (error) throw error;

      if (data?.success) {
        setSearchResults(data.properties || []);
        if (data.properties?.length === 0) {
          toast({
            title: 'No Properties Found',
            description: 'No legacy properties are associated with your email address.',
          });
        } else {
          toast({
            title: 'Properties Found!',
            description: `Found ${data.properties.length} property(ies) associated with your account.`,
          });
        }
      } else {
        throw new Error(data?.error || 'Search failed');
      }
    } catch (err: any) {
      toast({ title: 'Search Error', description: err.message, variant: 'destructive' });
      setSearchResults([]);
    }
    
    setSearching(false);
  };

  const handleClaimProperty = async () => {
    if (!selectedProperty) return;

    setClaiming(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'claim_legacy_property',
          investor_id: investorId,
          legacy_property_id: selectedProperty.id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Property Claimed!',
          description: 'Your property has been added to your portfolio. Our team will verify it shortly.',
        });
        setShowConfirmDialog(false);
        setSelectedProperty(null);
        setSearchResults(prev => prev.filter(p => p.id !== selectedProperty.id));
        onPropertyClaimed();
      } else {
        throw new Error(data?.error || 'Failed to claim property');
      }
    } catch (err: any) {
      toast({ title: 'Claim Error', description: err.message, variant: 'destructive' });
    }
    
    setClaiming(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card className="border-[#d4a574]/30 bg-gradient-to-br from-[#d4a574]/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#d4a574]" />
          Claim Existing Property
        </CardTitle>
        <CardDescription>
          If you previously acquired properties through Master Spaces or our legacy team, 
          you can claim them here to add to your portfolio for live tracking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Options */}
        <div className="space-y-4">
          {/* Search by Email */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium text-blue-900">Find My Properties</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Search for all properties associated with your email: <strong>{investorEmail}</strong>
                </p>
              </div>
              <Button 
                onClick={handleSearchByEmail}
                disabled={searching}
                className="bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Find My Properties
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Search by Address */}
          <div className="space-y-2">
            <Label htmlFor="search-address">Or Search by Address</Label>
            <div className="flex gap-2">
              <Input
                id="search-address"
                placeholder="Enter property address (e.g., 123 Main St)"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button 
                onClick={handleSearch}
                disabled={searching || searchAddress.length < 3}
                className="bg-[#d4a574] hover:bg-[#c49464] shrink-0"
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Enter at least 3 characters of your property address
            </p>
          </div>
        </div>

        {/* Search Results */}
        {hasSearched && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">
              {searchResults.length > 0 
                ? `Found ${searchResults.length} claimable property(ies)` 
                : 'No properties found'}
            </h4>
            
            {searchResults.length === 0 && (
              <div className="p-6 text-center bg-gray-50 rounded-lg">
                <AlertCircle className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">
                  No legacy properties found matching your search.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  If you believe you have properties that should appear here, 
                  please contact our support team at{' '}
                  <a href="mailto:success@accessyourplace.com" className="text-[#d4a574] hover:underline">
                    success@accessyourplace.com
                  </a>
                </p>
              </div>
            )}

            {searchResults.map((property) => (
              <Card key={property.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-[#d4a574]/10 rounded-lg shrink-0">
                          <Building2 className="w-5 h-5 text-[#d4a574]" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{property.address}</h4>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {property.city}, {property.state} {property.zip_code}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {property.bedrooms && (
                              <Badge variant="outline" className="text-xs">
                                <Bed className="w-3 h-3 mr-1" />
                                {property.bedrooms} bed
                              </Badge>
                            )}
                            {property.bathrooms && (
                              <Badge variant="outline" className="text-xs">
                                <Bath className="w-3 h-3 mr-1" />
                                {property.bathrooms} bath
                              </Badge>
                            )}
                            {property.legacy_system && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                {property.legacy_system === 'master_spaces' ? 'Master Spaces' : property.legacy_system}
                              </Badge>
                            )}
                          </div>
                          {property.acquisition_date && (
                            <p className="text-xs text-gray-400 mt-2">
                              Originally acquired: {formatDate(property.acquisition_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedProperty(property);
                        setShowConfirmDialog(true);
                      }}
                      className="bg-[#d4a574] hover:bg-[#c49464] shrink-0"
                    >
                      Claim
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Box */}
        {!hasSearched && (
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="font-medium text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Legacy Credit Honor
            </h4>
            <p className="text-sm text-amber-800 mt-2">
              For our long-term partners, if you held credits with Master Spaces, 
              you can request those to be audited and added to your new account balance 
              after claiming your properties. Contact our success team for credit reconciliation.
            </p>
          </div>
        )}

        {/* Confirm Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Property Claim</DialogTitle>
              <DialogDescription>
                You are about to claim this property and add it to your portfolio.
              </DialogDescription>
            </DialogHeader>
            
            {selectedProperty && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Building2 className="w-6 h-6 text-[#d4a574] shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold">{selectedProperty.address}</h4>
                    <p className="text-sm text-gray-500">
                      {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}
                    </p>
                    {selectedProperty.legacy_system && (
                      <Badge className="mt-2 bg-purple-100 text-purple-800 text-xs">
                        From: {selectedProperty.legacy_system === 'master_spaces' ? 'Master Spaces' : selectedProperty.legacy_system}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-gray-600 space-y-2">
              <p className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                This property will be added to your portfolio
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                Our team will verify the claim within 24-48 hours
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                You can track performance once verified
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleClaimProperty}
                disabled={claiming}
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Claim
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
