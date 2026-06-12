
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, DollarSign, Building, Target, Clock, Percent } from 'lucide-react';

interface OverviewProps {
  data: {
    totalInquiries: number;
    convertedInquiries: number;
    conversionRate: number | string;
    totalRevenue: number;
    avgDealSize: number;
    activeInvestors: number;
    totalInvestors: number;
    totalProperties: number;
  };
}

export function AnalyticsOverview({ data }: OverviewProps) {
  const cards = [
    { title: 'Total Inquiries', value: data.totalInquiries, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Conversion Rate', value: `${data.conversionRate}%`, icon: Percent, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Total Revenue', value: `$${(data.totalRevenue / 1000000).toFixed(2)}M`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Avg Deal Size', value: `$${(data.avgDealSize / 1000).toFixed(0)}K`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Active Investors', value: data.activeInvestors, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Total Investors', value: data.totalInvestors, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Properties', value: data.totalProperties, icon: Building, color: 'text-pink-600', bg: 'bg-pink-50' },
    { title: 'Converted', value: data.convertedInquiries, icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <Card key={i} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{card.title}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-full ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
