import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, ShieldAlert, ShieldCheck, Loader2, Monitor, MapPin, 
  AlertTriangle, Key, RefreshCw, CheckCircle, Clock, Trash2
} from 'lucide-react';

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  device_info: any;
  ip_address: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

interface Props {
  investorId: string;
  securityAlertsEnabled?: boolean;
  onUpdate?: (enabled: boolean) => void;
}

export function SecurityAlertsSettings({ investorId, securityAlertsEnabled = true, onUpdate }: Props) {
  const [enabled, setEnabled] = useState(securityAlertsEnabled);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAlerts();
  }, [investorId]);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('security-alerts', {
        body: { action: 'get_alerts', investor_id: investorId }
      });

      if (data?.success) {
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (newValue: boolean) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-alerts', {
        body: { 
          action: 'update_settings', 
          investor_id: investorId,
          security_alerts_enabled: newValue
        }
      });

      if (data?.success) {
        setEnabled(newValue);
        onUpdate?.(newValue);
        toast({
          title: newValue ? 'Security Alerts Enabled' : 'Security Alerts Disabled',
          description: newValue 
            ? 'You will receive email notifications for suspicious login activity.'
            : 'You will no longer receive security alert emails.',
        });
      } else {
        throw new Error(data?.error || 'Failed to update settings');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update security settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearKnownDevices = async () => {
    setClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-alerts', {
        body: { action: 'clear_known_devices', investor_id: investorId }
      });

      if (data?.success) {
        toast({
          title: 'Known Devices Cleared',
          description: data.message || 'You will receive alerts for your next login from any device.',
        });
      } else {
        throw new Error(data?.error || 'Failed to clear devices');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to clear known devices',
        variant: 'destructive'
      });
    } finally {
      setClearing(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const { data } = await supabase.functions.invoke('security-alerts', {
        body: { action: 'acknowledge_alert', alert_id: alertId }
      });

      if (data?.success) {
        setAlerts(prev => prev.map(a => 
          a.id === alertId ? { ...a, acknowledged: true, acknowledged_at: new Date().toISOString() } : a
        ));
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'new_device':
        return <Monitor className="w-5 h-5" />;
      case 'new_location':
        return <MapPin className="w-5 h-5" />;
      case 'failed_attempts':
        return <AlertTriangle className="w-5 h-5" />;
      case 'password_changed':
        return <Key className="w-5 h-5" />;
      default:
        return <ShieldAlert className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="space-y-6">
      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1a365d]" />
            Security Alerts
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unacknowledgedCount} new
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Get notified when suspicious activity is detected on your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="security-alerts-toggle" className="font-medium flex items-center gap-2 cursor-pointer">
                {enabled ? (
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-gray-400" />
                )}
                Email Security Alerts
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Receive email notifications for new device logins, new locations, and failed login attempts
              </p>
            </div>
            <Switch
              id="security-alerts-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={saving}
            />
          </div>

          {/* What triggers alerts */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700">We'll alert you when:</h4>
            <div className="grid gap-2">
              <div className="flex items-center gap-3 text-sm">
                <Monitor className="w-4 h-4 text-[#d4a574]" />
                <span>Someone logs in from a new device or browser</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-[#d4a574]" />
                <span>Your account is accessed from a new IP address</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-[#d4a574]" />
                <span>Multiple failed login attempts are detected</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Key className="w-4 h-4 text-[#d4a574]" />
                <span>Your password is changed (always sent)</span>
              </div>
            </div>
          </div>

          {/* Clear Known Devices */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Reset Trusted Devices</h4>
                <p className="text-sm text-muted-foreground">
                  Clear all known devices and locations. You'll receive alerts on your next login.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearKnownDevices}
                disabled={clearing}
              >
                {clearing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#1a365d]" />
            Recent Security Alerts
          </CardTitle>
          <CardDescription>
            Review recent security events on your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="font-medium">No security alerts</p>
              <p className="text-sm">Your account hasn't had any suspicious activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.acknowledged ? 'bg-gray-50 opacity-75' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                      {getAlertIcon(alert.alert_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{alert.title}</h4>
                        {!alert.acknowledged && (
                          <Badge variant="outline" className="text-xs">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {alert.description}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <span>{formatDate(alert.created_at)}</span>
                        {alert.device_info && (
                          <span>
                            {alert.device_info.browser} on {alert.device_info.os}
                          </span>
                        )}
                        {alert.ip_address && (
                          <span>IP: {alert.ip_address}</span>
                        )}
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAcknowledge(alert.id)}
                        className="shrink-0"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {alerts.length > 10 && (
                <p className="text-center text-sm text-muted-foreground pt-2">
                  Showing 10 of {alerts.length} alerts
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
