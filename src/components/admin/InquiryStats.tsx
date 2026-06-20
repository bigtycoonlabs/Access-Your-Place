import { Card } from '@/components/ui/card';
import { Users, Phone, CheckCircle, XCircle } from 'lucide-react';

interface InquiryStatsProps {
  statistics: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    closed: number;
  };
}

export function InquiryStats({ statistics }: InquiryStatsProps) {
  const stats = [
    { label: 'Total Inquiries', value: statistics.total, icon: Users, color: 'bg-blue-500' },
    { label: 'New', value: statistics.new, icon: Users, color: 'bg-yellow-500' },
    { label: 'Contacted', value: statistics.contacted, icon: Phone, color: 'bg-purple-500' },
    { label: 'Qualified', value: statistics.qualified, icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Closed', value: statistics.closed, icon: XCircle, color: 'bg-gray-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`${stat.color} p-2 rounded-lg`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
