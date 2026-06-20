import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { NotificationCenter } from './NotificationCenter';
import { DealAlerts } from './DealAlerts';
import { Bell, BellRing, Shield } from 'lucide-react';
import { MarketAlertsDashboard } from './MarketAlertsDashboard';

interface Props {
  investorId: string;
  investorEmail?: string;
  investorPhone?: string;
}

export function UnifiedNotificationsHub({ investorId, investorEmail, investorPhone }: Props) {
  const [activeSubTab, setActiveSubTab] = useState('notifications');

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1a365d] rounded-lg">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Notifications & Alerts Hub</CardTitle>
              <CardDescription>
                Manage all your notifications, deal alerts, and market intelligence in one place
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="bg-white shadow w-full justify-start">
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="deal-alerts" className="flex items-center gap-2">
            <BellRing className="w-4 h-4" />
            Deal Alerts
          </TabsTrigger>
          <TabsTrigger value="market-alerts" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Market Intelligence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <NotificationCenter investorId={investorId} />
        </TabsContent>

        <TabsContent value="deal-alerts">
          <DealAlerts investorId={investorId} />
        </TabsContent>

        <TabsContent value="market-alerts">
          <MarketAlertsDashboard 
            investorId={investorId}
            investorEmail={investorEmail || ''}
            investorPhone={investorPhone || ''}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
