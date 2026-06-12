import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Bed, Bath, DollarSign, TrendingUp, Users } from 'lucide-react';
import { Property, DealAnalytics, PropertyPhoto } from '@/types/dealflow';

interface DealPreviewProps {
  property: Property;
  analytics: DealAnalytics | null;
  photos: PropertyPhoto[];
}

export function DealPreview({ property, analytics, photos }: DealPreviewProps) {
  const typeLabels: Record<string, string> = {
    apartment: 'Apartment',
    private_landlord: 'Private Landlord',
    townhome: 'Townhome',
    single_family: 'Single Family'
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-3 text-center">Preview - How this deal will appear to visitors</p>
      
      <Card className="overflow-hidden">
        {/* Photo Gallery */}
        <div className="relative h-48 bg-gray-200">
          {photos.length > 0 ? (
            <img 
              src={photos[0].processed_url || photos[0].original_url} 
              alt="Property" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No photos available
            </div>
          )}
          <div className="absolute top-2 left-2 flex gap-1">
            <Badge className="bg-[#d4a574]">{typeLabels[property.property_type]}</Badge>
            {property.units_available > 1 && (
              <Badge variant="secondary">{property.units_available} units</Badge>
            )}
          </div>
          <div className="absolute bottom-2 right-2">
            <Badge className="bg-black/70 text-white">
              ${property.acquisition_fee.toLocaleString()} Acquisition Fee
            </Badge>
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className="font-bold text-lg mb-1">
            {property.listing_title || `${property.bedrooms}BR/${property.bathrooms}BA in ${property.city}`}
          </h3>
          
          <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
            <MapPin className="w-4 h-4" />
            {property.city}, {property.state} {property.zip_code}
          </div>

          <div className="flex gap-4 text-sm mb-3">
            <span className="flex items-center gap-1"><Bed className="w-4 h-4" /> {property.bedrooms}</span>
            <span className="flex items-center gap-1"><Bath className="w-4 h-4" /> {property.bathrooms}</span>
            <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> ${property.monthly_rent}/mo rent</span>
          </div>

          {analytics && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2 bg-blue-50 rounded text-center">
                <div className="flex items-center justify-center gap-1 text-blue-600 font-bold">
                  <TrendingUp className="w-4 h-4" />
                  ${analytics.str_yearly_revenue.toLocaleString()}
                </div>
                <p className="text-xs text-gray-600">STR Revenue/yr</p>
              </div>
              <div className="p-2 bg-purple-50 rounded text-center">
                <div className="flex items-center justify-center gap-1 text-purple-600 font-bold">
                  <Users className="w-4 h-4" />
                  ${analytics.coliving_yearly_revenue.toLocaleString()}
                </div>
                <p className="text-xs text-gray-600">Co-Living Revenue/yr</p>
              </div>
            </div>
          )}

          {property.listing_description && (
            <p className="text-sm text-gray-700 line-clamp-3">{property.listing_description}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
