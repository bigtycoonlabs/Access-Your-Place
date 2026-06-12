export interface MarketData {
  id: string;
  city: string;
  state: string;
  adr: number;
  occupancy: number;
  monthlyRevenue: number;
  licensingRequired: boolean;
  licensingComplexity: 'Low' | 'Medium' | 'High';
  hotelTaxRate: number;
  regulatoryFriction: 'Low' | 'Medium' | 'High';
  bestFor: string;
}

export const marketData: MarketData[] = [
  { id: 'tampa', city: 'Tampa', state: 'FL', adr: 185, occupancy: 72, monthlyRevenue: 4000, licensingRequired: true, licensingComplexity: 'Medium', hotelTaxRate: 12.5, regulatoryFriction: 'Medium', bestFor: 'Beach & Events' },
  { id: 'orlando', city: 'Orlando', state: 'FL', adr: 195, occupancy: 78, monthlyRevenue: 4550, licensingRequired: true, licensingComplexity: 'Medium', hotelTaxRate: 13.5, regulatoryFriction: 'Medium', bestFor: 'Theme Parks' },
  { id: 'jacksonville', city: 'Jacksonville', state: 'FL', adr: 165, occupancy: 68, monthlyRevenue: 3400, licensingRequired: true, licensingComplexity: 'Low', hotelTaxRate: 12, regulatoryFriction: 'Low', bestFor: 'Beach Market' },
  { id: 'miami', city: 'Miami', state: 'FL', adr: 245, occupancy: 75, monthlyRevenue: 5500, licensingRequired: true, licensingComplexity: 'High', hotelTaxRate: 13, regulatoryFriction: 'High', bestFor: 'Luxury Market' },
  { id: 'austin', city: 'Austin', state: 'TX', adr: 205, occupancy: 74, monthlyRevenue: 4550, licensingRequired: true, licensingComplexity: 'High', hotelTaxRate: 17, regulatoryFriction: 'High', bestFor: 'Tech & Music' },
  { id: 'leander', city: 'Leander', state: 'TX', adr: 175, occupancy: 70, monthlyRevenue: 3675, licensingRequired: false, licensingComplexity: 'Low', hotelTaxRate: 15, regulatoryFriction: 'Low', bestFor: 'Austin Suburb' },
  { id: 'georgetown', city: 'Georgetown', state: 'TX', adr: 170, occupancy: 69, monthlyRevenue: 3520, licensingRequired: false, licensingComplexity: 'Low', hotelTaxRate: 15, regulatoryFriction: 'Low', bestFor: 'Historic Charm' },
  { id: 'arlington', city: 'Arlington', state: 'TX', adr: 180, occupancy: 71, monthlyRevenue: 3835, licensingRequired: true, licensingComplexity: 'Medium', hotelTaxRate: 15, regulatoryFriction: 'Medium', bestFor: 'Sports & Events' },
  { id: 'columbia', city: 'Columbia', state: 'SC', adr: 155, occupancy: 67, monthlyRevenue: 3120, licensingRequired: true, licensingComplexity: 'Low', hotelTaxRate: 11, regulatoryFriction: 'Low', bestFor: 'College Town' },
  { id: 'charleston', city: 'Charleston', state: 'SC', adr: 220, occupancy: 76, monthlyRevenue: 5020, licensingRequired: true, licensingComplexity: 'Medium', hotelTaxRate: 12.5, regulatoryFriction: 'Medium', bestFor: 'Historic Tourism' },
  { id: 'nashville', city: 'Nashville', state: 'TN', adr: 210, occupancy: 75, monthlyRevenue: 4725, licensingRequired: true, licensingComplexity: 'High', hotelTaxRate: 15.25, regulatoryFriction: 'High', bestFor: 'Music City' },
  { id: 'atlanta', city: 'Atlanta', state: 'GA', adr: 190, occupancy: 72, monthlyRevenue: 4100, licensingRequired: true, licensingComplexity: 'Medium', hotelTaxRate: 14, regulatoryFriction: 'Medium', bestFor: 'Business Hub' },
  { id: 'charlotte', city: 'Charlotte', state: 'NC', adr: 185, occupancy: 71, monthlyRevenue: 3940, licensingRequired: true, licensingComplexity: 'Medium', hotelTaxRate: 13, regulatoryFriction: 'Medium', bestFor: 'Banking Center' },
  { id: 'phoenix', city: 'Phoenix', state: 'AZ', adr: 195, occupancy: 73, monthlyRevenue: 4270, licensingRequired: true, licensingComplexity: 'Low', hotelTaxRate: 12.57, regulatoryFriction: 'Low', bestFor: 'Desert Resort' },
  { id: 'denver', city: 'Denver', state: 'CO', adr: 200, occupancy: 72, monthlyRevenue: 4320, licensingRequired: true, licensingComplexity: 'Medium', hotelTaxRate: 14.85, regulatoryFriction: 'Medium', bestFor: 'Mountain Access' },
];
