import { Card, CardContent } from '@/components/ui/card';
import { Users, MessageSquare, TrendingUp, Bell } from 'lucide-react';

interface Props {
  analytics: any;
  followUps: any[];
}

export function LandlordAnalytics({ analytics, followUps }: Props) {
  const stats = [
    { label: 'Total Landlords', value: analytics?.totalLandlords || 0, icon: Users, color: 'text-blue-600' },
    { label: 'Total Communications', value: analytics?.totalCommunications || 0, icon: MessageSquare, color: 'text-green-600' },
    { label: 'Avg Response Rate', value: `${(analytics?.avgResponseRate || 0).toFixed(0)}%`, icon: TrendingUp, color: 'text-purple-600' },
    { label: 'Pending Follow-ups', value: followUps?.length || 0, icon: Bell, color: 'text-orange-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
      
      {followUps && followUps.length > 0 && (
        <Card className="col-span-full">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Bell className="w-4 h-4 text-orange-500" /> Due Follow-ups</h3>
            <div className="space-y-2">
              {followUps.slice(0, 5).map((f, i) => (
                <div key={i} className="flex justify-between items-center text-sm bg-orange-50 p-2 rounded">
                  <span className="font-medium">{f.landlord_contacts?.name || 'Unknown'}</span>
                  <span className="text-gray-500">{f.subject}</span>
                  <span className="text-orange-600">{new Date(f.follow_up_date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
