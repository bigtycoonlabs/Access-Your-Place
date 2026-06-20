import { MapPin, DollarSign, Home } from 'lucide-react';

interface PropertyCardProps {
  image: string;
  title: string;
  location: string;
  price: string;
  type: string;
  beds: number;
  baths: number;
}

export default function PropertyCard({ image, title, location, price, type, beds, baths }: PropertyCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">
      <img src={image} alt={title} className="w-full h-48 object-cover" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="bg-[#d4a574] text-white text-xs px-3 py-1 rounded-full">{type}</span>
          <span className="text-[#1a2332] font-bold text-lg">{price}/mo</span>
        </div>
        <h3 className="text-xl font-semibold text-[#1a2332] mb-2">{title}</h3>
        <div className="flex items-center text-gray-600 mb-3">
          <MapPin size={16} className="mr-1" />
          <span className="text-sm">{location}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-700">
          <span>{beds} Beds</span>
          <span>{baths} Baths</span>
        </div>
        <button className="w-full mt-4 bg-[#1a2332] text-white py-2 rounded-lg hover:bg-[#2a3d52] transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
}
