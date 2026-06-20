import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, ExternalLink, Plus } from 'lucide-react';

interface RegulationAlert {
  id: string;
  title: string;
  description: string;
  source: string;
  source_url: string;
  city: string;
  state: string;
  alert_type: string;
  severity: string;
  discovered_at: string;
  processed: boolean;
  added_to_queue: boolean;
}

interface RegulationAlertsTabProps {
  alerts: RegulationAlert[];
  onAddToQueue: (alert: RegulationAlert) => void;
}

export function RegulationAlertsTab({ alerts, onAddToQueue }: RegulationAlertsTabProps) {
  const getSeverityBadge = (severity: string) => {
    const styles = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-blue-500 text-white'
    };
    return <Badge className={styles[severity as keyof typeof styles] || styles.medium}>{severity.toUpperCase()}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    if (type === 'regulation') return <Shield className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regulation Alerts & Breaking News</CardTitle>
        <CardDescription>
          Monitor city regulations and breaking news about rental arbitrage
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-2xl font-bold">{criticalCount}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Critical Alerts</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-600" />
              <span className="text-2xl font-bold">{highCount}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">High Priority</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold">{alerts.length}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Total Alerts</p>
          </div>
        </div>

        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No regulation alerts yet</p>
            </div>
          ) : (
            alerts
              .sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return severityOrder[a.severity as keyof typeof severityOrder] - 
                       severityOrder[b.severity as keyof typeof severityOrder];
              })
              .map(alert => (
                <div key={alert.id} className="border p-4 rounded-lg bg-white">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(alert.alert_type)}
                        <h3 className="font-semibold">{alert.title}</h3>
                        {getSeverityBadge(alert.severity)}
                        {alert.added_to_queue && (
                          <Badge className="bg-green-100 text-green-800">In Queue</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Source: {alert.source}</span>
                        {alert.city && <span>Location: {alert.city}, {alert.state}</span>}
                        <span>Type: {alert.alert_type}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {alert.source_url && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(alert.source_url, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      {!alert.added_to_queue && (
                        <Button 
                          size="sm" 
                          className="bg-[#d4a574]"
                          onClick={() => onAddToQueue(alert)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add to Queue
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
