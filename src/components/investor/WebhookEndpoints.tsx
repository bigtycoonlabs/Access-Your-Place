
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Webhook, Copy, CheckCircle, XCircle, 
  RefreshCw, Play, Clock, AlertTriangle, Link2,
  Activity, FileJson, ExternalLink, Info, Zap
} from 'lucide-react';

interface Props {
  investorId: string;
}

interface Connection {
  id: string;
  platform: string;
  platform_name: string;
  webhook_url?: string;
  webhook_secret?: string;
  is_active: boolean;
  supports_webhooks: boolean;
}

interface WebhookEvent {
  id: string;
  platform: string;
  event_type: string;
  event_id?: string;
  payload: any;
  processed: boolean;
  processing_error?: string;
  received_at: string;
  processed_at?: string;
  platform_connections?: {
    platform: string;
    account_email?: string;
  };
}

const PLATFORM_COLORS: Record<string, string> = {
  airbnb: 'bg-[#FF5A5F]',
  vrbo: 'bg-[#3B5998]',
  guesty: 'bg-purple-600',
  hospitable: 'bg-blue-600',
  ownerrez: 'bg-green-600',
  hostaway: 'bg-orange-600',
  lodgify: 'bg-indigo-600',
  pricelabs: 'bg-yellow-600'
};

export function WebhookEndpoints({ investorId }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingUrl, setGeneratingUrl] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [testEventType, setTestEventType] = useState('new_booking');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('endpoints');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch connections
      const { data: connectionsData } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'get_connections', investor_id: investorId }
      });
      
      if (connectionsData?.connections) {
        setConnections(connectionsData.connections.filter((c: Connection) => c.supports_webhooks));
      }

      // Fetch webhook events
      const { data: eventsData } = await supabase.functions.invoke('handle-platform-webhook', {
        body: { action: 'get_webhook_events', investor_id: investorId, limit: 100 }
      });
      
      if (eventsData?.events) {
        setWebhookEvents(eventsData.events);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast({ title: 'Error', description: 'Failed to load webhook data', variant: 'destructive' });
    }
    setLoading(false);
  }, [investorId, toast]);

  useEffect(() => {
    fetchData();
    
    // Polling replaces Realtime subscription — avoids "Channel timed out" errors
    const pollHandle = setInterval(() => {
      fetchData();
    }, 20_000); // 20 seconds

    return () => {
      clearInterval(pollHandle);
    };
  }, [fetchData]);



  const generateWebhookUrl = async (connectionId: string) => {
    setGeneratingUrl(connectionId);
    try {
      const { data, error } = await supabase.functions.invoke('handle-platform-webhook', {
        body: { action: 'generate_webhook_url', connection_id: connectionId }
      });

      if (error) throw error;

      toast({ 
        title: 'Webhook URL Generated', 
        description: 'Copy the URL and configure it in your platform settings.' 
      });
      
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setGeneratingUrl(null);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(id);
      setTimeout(() => setCopiedUrl(null), 2000);
      toast({ title: 'Copied!', description: 'URL copied to clipboard' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  const testWebhook = async () => {
    if (!selectedConnection) return;
    
    setTestingWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-platform-webhook', {
        body: { 
          action: 'test_webhook', 
          connection_id: selectedConnection.id,
          event_type: testEventType
        }
      });

      if (error) throw error;

      toast({ 
        title: data.success ? 'Test Successful' : 'Test Failed',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive'
      });
      
      setShowTestModal(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setTestingWebhook(false);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="w-6 h-6 text-[#d4a574]" />
            Webhook Endpoints
          </h2>
          <p className="text-gray-500">
            Configure webhooks to receive real-time booking notifications from your platforms
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="endpoints">
            <Link2 className="w-4 h-4 mr-2" />
            Webhook URLs
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity Feed
          </TabsTrigger>
        </TabsList>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints" className="space-y-4">
          {connections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Webhook className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Webhook-Enabled Connections</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  Connect a platform that supports webhooks (Guesty, Hostaway, OwnerRez, etc.) to set up real-time notifications.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => (
                <Card key={connection.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${PLATFORM_COLORS[connection.platform] || 'bg-gray-600'} flex items-center justify-center`}>
                          <Webhook className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{connection.platform_name}</CardTitle>
                          <CardDescription>
                            {connection.webhook_url ? 'Webhook configured' : 'No webhook URL generated'}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={connection.is_active ? 'default' : 'secondary'}>
                        {connection.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {connection.webhook_url ? (
                      <>
                        <div>
                          <Label className="text-sm text-gray-500" htmlFor="webhook-url">Webhook URL</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input id="webhook-url" 
                              value={connection.webhook_url} 
                              readOnly 
                              className="font-mono text-sm bg-gray-50"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Copy webhook URL"
                              onClick={() => copyToClipboard(connection.webhook_url!, connection.id)}
                            >
                              {copiedUrl === connection.id ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {connection.webhook_secret && (
                          <div>
                            <Label className="text-sm text-gray-500" htmlFor="webhook-secret">Webhook Secret</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input id="webhook-secret" 
                                value={connection.webhook_secret} 
                                readOnly 
                                type="password"
                                className="font-mono text-sm bg-gray-50"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Copy webhook signing secret"
                                onClick={() => copyToClipboard(connection.webhook_secret!, `${connection.id}-secret`)}
                              >
                                {copiedUrl === `${connection.id}-secret` ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        <Alert>
                          <Info className="w-4 h-4" />
                          <AlertDescription className="text-sm">
                            Configure this URL in your {connection.platform_name} dashboard under webhook settings. 
                            Enable events for new bookings, modifications, and cancellations.
                          </AlertDescription>
                        </Alert>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedConnection(connection);
                              setShowTestModal(true);
                            }}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Test Webhook
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => generateWebhookUrl(connection.id)}
                            disabled={generatingUrl === connection.id}
                          >
                            {generatingUrl === connection.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Regenerate URL
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 mb-4">
                          Generate a unique webhook URL to receive real-time booking notifications.
                        </p>
                        <Button
                          onClick={() => generateWebhookUrl(connection.id)}
                          disabled={generatingUrl === connection.id}
                          className="bg-[#d4a574] hover:bg-[#c49464]"
                        >
                          {generatingUrl === connection.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4 mr-2" />
                          )}
                          Generate Webhook URL
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Setup Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Setup Instructions</CardTitle>
              <CardDescription>How to configure webhooks in each platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center">
                      <span className="text-white text-xs">G</span>
                    </div>
                    Guesty
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li>Go to Settings → Webhooks</li>
                    <li>Click "Add Webhook"</li>
                    <li>Paste your webhook URL</li>
                    <li>Select reservation events</li>
                    <li>Save and test</li>
                  </ol>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded bg-orange-600 flex items-center justify-center">
                      <span className="text-white text-xs">H</span>
                    </div>
                    Hostaway
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li>Go to Settings → API</li>
                    <li>Click "Webhooks" tab</li>
                    <li>Add new webhook URL</li>
                    <li>Enable booking events</li>
                    <li>Save configuration</li>
                  </ol>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded bg-green-600 flex items-center justify-center">
                      <span className="text-white text-xs">O</span>
                    </div>
                    OwnerRez
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li>Go to Settings → API</li>
                    <li>Find Webhooks section</li>
                    <li>Add endpoint URL</li>
                    <li>Configure booking triggers</li>
                    <li>Enable and save</li>
                  </ol>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
                      <span className="text-white text-xs">H</span>
                    </div>
                    Hospitable
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li>Go to Settings → Integrations</li>
                    <li>Find Webhooks</li>
                    <li>Add your endpoint</li>
                    <li>Select event types</li>
                    <li>Activate webhook</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Feed Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#d4a574]" />
                Real-Time Activity Feed
              </CardTitle>
              <CardDescription>
                Recent webhook events from your connected platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {webhookEvents.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600">No Events Yet</h3>
                  <p className="text-gray-500 mt-2">
                    Webhook events will appear here as they're received from your platforms.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {webhookEvents.map((event) => (
                      <div 
                        key={event.id} 
                        className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg ${PLATFORM_COLORS[event.platform] || 'bg-gray-600'} flex items-center justify-center flex-shrink-0`}>
                              <FileJson className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium capitalize">{event.platform}</span>
                                <Badge variant="outline" className="text-xs">
                                  {event.event_type}
                                </Badge>
                                {event.processed ? (
                                  event.processing_error ? (
                                    <Badge variant="destructive" className="text-xs">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Error
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-green-100 text-green-800 text-xs">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Processed
                                    </Badge>
                                  )
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pending
                                  </Badge>
                                )}
                              </div>
                              
                              {event.payload && (
                                <div className="mt-2 text-sm text-gray-600">
                                  {event.payload.guest_name || event.payload.guestName || event.payload.guest?.fullName ? (
                                    <span>Guest: {event.payload.guest_name || event.payload.guestName || event.payload.guest?.fullName}</span>
                                  ) : null}
                                  {(event.payload.check_in || event.payload.checkIn || event.payload.arrivalDate) && (
                                    <span className="ml-3">
                                      {new Date(event.payload.check_in || event.payload.checkIn || event.payload.arrivalDate).toLocaleDateString()} - 
                                      {new Date(event.payload.check_out || event.payload.checkOut || event.payload.departureDate).toLocaleDateString()}
                                    </span>
                                  )}
                                  {(event.payload.total_price || event.payload.totalPrice || event.payload.money?.totalPrice) && (
                                    <span className="ml-3 text-green-600 font-medium">
                                      ${(event.payload.total_price || event.payload.totalPrice || event.payload.money?.totalPrice || 0).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              )}

                              {event.processing_error && (
                                <p className="text-sm text-red-600 mt-1">{event.processing_error}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatTimestamp(event.received_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test Webhook Modal */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Webhook</DialogTitle>
            <DialogDescription>
              Send a test event to verify your webhook is configured correctly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="platform">Platform</Label>
              <Input id="platform" value={selectedConnection?.platform_name || ''} readOnly className="bg-gray-50" />
            </div>

            <div>
              <Label>Event Type</Label>
              <Select value={testEventType} onValueChange={setTestEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_booking">New Booking</SelectItem>
                  <SelectItem value="modification">Booking Modification</SelectItem>
                  <SelectItem value="cancellation">Cancellation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                This will create a test booking record in your system. Test bookings are marked with "test_" prefix.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={testWebhook}
              disabled={testingWebhook}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {testingWebhook && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Test Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
