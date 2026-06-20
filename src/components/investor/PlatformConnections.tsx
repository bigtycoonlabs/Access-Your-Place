import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { BookingCalendar } from './BookingCalendar';
import { 
  Loader2, Link2, Unlink, RefreshCw, CheckCircle, XCircle, 
  AlertTriangle, Clock, Building2, Calendar, DollarSign,
  Upload, Download, ExternalLink, Shield,
  Home, FileSpreadsheet, Info, Wifi, CalendarDays, List, Plus
} from 'lucide-react';

interface Props {
  investorId: string;
}

interface Platform {
  id: string;
  name: string;
  authType: string;
  description: string;
}

interface Connection {
  id: string;
  platform: string;
  platform_name: string;
  connection_type: string;
  account_email?: string;
  is_active: boolean;
  last_sync_at?: string;
  sync_status: string;
  sync_error?: string;
  listing_count: number;
  booking_count: number;
  created_at: string;
}

interface PlatformListing {
  id: string;
  platform: string;
  platform_listing_id: string;
  listing_name: string;
  listing_url?: string;
  address?: string;
  city?: string;
  state?: string;
  bedrooms?: number;
  bathrooms?: number;
  property_id?: string;
  platform_connections?: {
    platform: string;
    account_email?: string;
  };
}

interface Booking {
  id: string;
  platform: string;
  guest_name?: string;
  check_in: string;
  check_out: string;
  nights: number;
  gross_revenue: number;
  net_revenue: number;
  status: string;
  platform_listings?: {
    listing_name: string;
    property_id?: string;
  };
}

interface AggregatedStats {
  total_revenue: number;
  total_bookings: number;
  total_nights: number;
  avg_nightly_rate: number;
  avg_booking_value: number;
  platform_breakdown: Record<string, {
    revenue: number;
    bookings: number;
    nights: number;
  }>;
}

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  records_synced: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  platform_connections?: {
    platform: string;
    account_email?: string;
  };
}

interface ExportFilters {
  start_date: string;
  end_date: string;
  platform: string;
  property_id: string;
}

interface DirectBookingForm {
  listing_id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  gross_revenue: string;
  net_revenue: string;
  notes: string;
}

const PLATFORM_LOGOS: Record<string, string> = {
  airbnb: '🏠',
  vrbo: '🏡',
  guesty: '📊',
  hospitable: '🤖',
  ownerrez: '📋',
  hostaway: '🌐',
  lodgify: '🏨',
  pricelabs: '💰',
  csv_import: '📁',
  direct: '✅'
};

const PLATFORM_COLORS: Record<string, string> = {
  airbnb: 'bg-[#FF5A5F] text-white',
  vrbo: 'bg-[#3B5998] text-white',
  guesty: 'bg-purple-600 text-white',
  hospitable: 'bg-blue-600 text-white',
  ownerrez: 'bg-green-600 text-white',
  hostaway: 'bg-orange-600 text-white',
  lodgify: 'bg-indigo-600 text-white',
  pricelabs: 'bg-yellow-600 text-white',
  csv_import: 'bg-gray-600 text-white',
  direct: 'bg-emerald-600 text-white'
};

export function PlatformConnections({ investorId }: Props) {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [listings, setListings] = useState<PlatformListing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDirectBookingModal, setShowDirectBookingModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('connections');
  const [bookingsViewMode, setBookingsViewMode] = useState<'calendar' | 'list'>('calendar');
  const [csvData, setCsvData] = useState('');
  const [selectedPropertyForCSV, setSelectedPropertyForCSV] = useState('');
  const [portfolioProperties, setPortfolioProperties] = useState<any[]>([]);
  const [savingDirectBooking, setSavingDirectBooking] = useState(false);
  const [directBookingForm, setDirectBookingForm] = useState<DirectBookingForm>({
    listing_id: '',
    guest_name: '',
    guest_email: '',
    check_in: '',
    check_out: '',
    gross_revenue: '',
    net_revenue: '',
    notes: ''
  });
  
  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportFilters, setExportFilters] = useState<ExportFilters>({
    start_date: '',
    end_date: '',
    platform: 'all',
    property_id: 'all'
  });
  const [exportOptions, setExportOptions] = useState<{
    platforms: { id: string; name: string }[];
    properties: { id: string; address: string; city: string; state: string }[];
    date_range: { min: string | null; max: string | null };
  } | null>(null);
  
  const { toast } = useToast();


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch platforms
      const { data: platformsData } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'get_platforms' }
      });
      if (platformsData?.platforms) {
        setPlatforms(platformsData.platforms);
      }

      // Fetch connections
      const { data: connectionsData } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'get_connections', investor_id: investorId }
      });
      if (connectionsData?.connections) {
        setConnections(connectionsData.connections);
      }

      // Fetch listings
      const { data: listingsData } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'get_listings', investor_id: investorId }
      });
      if (listingsData?.listings) {
        setListings(listingsData.listings);
      }

      // Fetch recent bookings
      const { data: bookingsData } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'get_bookings', investor_id: investorId, limit: 50 }
      });
      if (bookingsData?.bookings) {
        setBookings(bookingsData.bookings);
      }

      // Fetch aggregated stats
      const { data: statsData } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'get_aggregated_stats', investor_id: investorId }
      });
      if (statsData) {
        setStats(statsData);
      }

      // Fetch sync logs
      const { data: logsData } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'get_sync_logs', investor_id: investorId }
      });
      if (logsData?.logs) {
        setSyncLogs(logsData.logs);
      }

      // Fetch portfolio properties for matching
      const { data: propertiesData } = await supabase
        .from('investor_properties')
        .select('id, address, city, state')
        .eq('investor_id', investorId);
      if (propertiesData) {
        setPortfolioProperties(propertiesData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast({ title: 'Error', description: 'Failed to load platform data', variant: 'destructive' });
    }
    setLoading(false);
  }, [investorId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch export options when export modal opens
  const fetchExportOptions = async () => {
    try {
      const { data } = await supabase.functions.invoke('export-booking-data', {
        body: { action: 'get_export_options', investor_id: investorId }
      });
      if (data?.success) {
        setExportOptions(data);
        // Set default date range
        if (data.date_range?.min) {
          setExportFilters(prev => ({
            ...prev,
            start_date: data.date_range.min?.split('T')[0] || '',
            end_date: data.date_range.max?.split('T')[0] || new Date().toISOString().split('T')[0]
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching export options:', err);
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-booking-data', {
        body: {
          action: 'export_bookings',
          investor_id: investorId,
          format,
          filters: {
            start_date: exportFilters.start_date || undefined,
            end_date: exportFilters.end_date || undefined,
            platform: exportFilters.platform !== 'all' ? exportFilters.platform : undefined,
            property_id: exportFilters.property_id !== 'all' ? exportFilters.property_id : undefined
          }
        }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        // Decode base64 and create download
        const binaryString = atob(data.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.content_type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Export Complete',
          description: `Downloaded ${data.record_count} bookings. Total revenue: $${data.summary?.total_net?.toFixed(2) || 0}`
        });
        setShowExportModal(false);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast({ title: 'Export Failed', description: err.message, variant: 'destructive' });
    }
    setExporting(false);
  };

  const handleConnect = async () => {
    if (!selectedPlatform || !apiKey) {
      toast({ title: 'Error', description: 'Please enter your API key', variant: 'destructive' });
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-platform-connections', {
        body: {
          action: 'connect_platform',
          investor_id: investorId,
          platform: selectedPlatform.id,
          api_key: apiKey,
          api_secret: apiSecret || undefined,
          account_email: accountEmail || undefined
        }
      });

      if (data?.connection) {
        toast({ 
          title: 'Platform Connected', 
          description: data.message || 'Your account has been connected. Initial sync started.' 
        });
        setShowConnectModal(false);
        setApiKey('');
        setApiSecret('');
        setAccountEmail('');
        setSelectedPlatform(null);
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to connect platform');
      }
    } catch (err: any) {
      toast({ title: 'Connection Failed', description: err.message, variant: 'destructive' });
    }
    setConnecting(false);
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this platform? All synced data will be removed.')) {
      return;
    }

    try {
      const { data } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'disconnect_platform', connection_id: connectionId }
      });

      if (data?.success) {
        toast({ title: 'Disconnected', description: 'Platform has been disconnected.' });
        fetchData();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      const { data } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'sync_data', connection_id: connectionId }
      });

      if (data?.success) {
        toast({ 
          title: 'Sync Complete', 
          description: `Successfully synced ${data.records_synced} records.` 
        });
        fetchData();
      }
    } catch (err: any) {
      toast({ title: 'Sync Failed', description: err.message, variant: 'destructive' });
    }
    setSyncing(null);
  };

  const handleSyncAll = async () => {
    setSyncing('all');
    try {
      const { data } = await supabase.functions.invoke('manage-platform-connections', {
        body: { action: 'sync_all', investor_id: investorId }
      });

      if (data?.results) {
        const successCount = data.results.filter((r: any) => r.status === 'success').length;
        toast({ 
          title: 'Sync Complete', 
          description: `Successfully synced ${successCount} of ${data.results.length} connections.` 
        });
        fetchData();
      }
    } catch (err: any) {
      toast({ title: 'Sync Failed', description: err.message, variant: 'destructive' });
    }
    setSyncing(null);
  };

  const handleCSVImport = async () => {
    if (!csvData.trim() || !selectedPropertyForCSV) {
      toast({ title: 'Error', description: 'Please select a property and paste CSV data', variant: 'destructive' });
      return;
    }

    try {
      // Parse CSV data
      const lines = csvData.trim().split('\n');
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header.replace(/\s+/g, '_')] = values[index];
        });
        rows.push(row);
      }

      const { data } = await supabase.functions.invoke('manage-platform-connections', {
        body: {
          action: 'import_csv',
          investor_id: investorId,
          property_id: selectedPropertyForCSV,
          data: rows
        }
      });

      if (data?.success) {
        toast({ 
          title: 'Import Complete', 
          description: `Successfully imported ${data.imported} bookings.` 
        });
        setShowCSVImport(false);
        setCsvData('');
        setSelectedPropertyForCSV('');
        fetchData();
      }
    } catch (err: any) {
      toast({ title: 'Import Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleMatchListing = async (listingId: string, propertyId: string) => {
    try {
      const { data } = await supabase.functions.invoke('manage-platform-connections', {
        body: {
          action: 'match_listing',
          listing_id: listingId,
          property_id: propertyId
        }
      });

      if (data?.success) {
        toast({ title: 'Listing Matched', description: 'Listing has been linked to your portfolio property.' });
        fetchData();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSaveDirectBooking = async () => {
    if (!directBookingForm.listing_id || !directBookingForm.check_in || !directBookingForm.check_out || !directBookingForm.gross_revenue) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setSavingDirectBooking(true);
    try {
      const checkIn = new Date(directBookingForm.check_in);
      const checkOut = new Date(directBookingForm.check_out);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      
      const { data, error } = await supabase.functions.invoke('manage-platform-connections', {
        body: {
          action: 'add_direct_booking',
          investor_id: investorId,
          listing_id: directBookingForm.listing_id,
          booking: {
            guest_name: directBookingForm.guest_name || 'Direct Guest',
            guest_email: directBookingForm.guest_email,
            check_in: directBookingForm.check_in,
            check_out: directBookingForm.check_out,
            nights,
            gross_revenue: parseFloat(directBookingForm.gross_revenue),
            net_revenue: directBookingForm.net_revenue ? parseFloat(directBookingForm.net_revenue) : parseFloat(directBookingForm.gross_revenue),
            platform: 'direct',
            status: 'confirmed',
            notes: directBookingForm.notes
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Direct Booking Added', description: 'Your direct booking has been added to the calendar.' });
        setShowDirectBookingModal(false);
        setDirectBookingForm({
          listing_id: '',
          guest_name: '',
          guest_email: '',
          check_in: '',
          check_out: '',
          gross_revenue: '',
          net_revenue: '',
          notes: ''
        });
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to add direct booking');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSavingDirectBooking(false);
  };

  const getSyncStatusBadge = (status: string, error?: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Synced</Badge>;
      case 'syncing':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Syncing</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800" title={error}><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading platform connections">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
        <span className="sr-only">Loading platform connections...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Platform Connections</h2>
          <p className="text-gray-500">Connect your booking platforms to automatically sync revenue and occupancy data</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => {
              setShowExportModal(true);
              fetchExportOptions();
            }}
            disabled={bookings.length === 0}
            aria-label="Export booking data"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" onClick={() => setShowCSVImport(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          {connections.length > 0 && (
            <Button 
              variant="outline" 
              onClick={handleSyncAll}
              disabled={syncing === 'all'}
            >
              {syncing === 'all' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync All
            </Button>
          )}
          <Button 
            onClick={() => setShowConnectModal(true)}
            className="bg-[#d4a574] hover:bg-[#c49464]"
          >
            <Link2 className="w-4 h-4 mr-2" />
            Connect Platform
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && stats.total_bookings > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                ${stats.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{stats.total_bookings}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Nights</p>
              <p className="text-2xl font-bold">{stats.total_nights}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Avg Nightly Rate</p>
              <p className="text-2xl font-bold">${stats.avg_nightly_rate.toFixed(0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Avg Booking Value</p>
              <p className="text-2xl font-bold">${stats.avg_booking_value.toFixed(0)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connections">
            <Link2 className="w-4 h-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="listings">
            <Building2 className="w-4 h-4 mr-2" />
            Listings
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <Calendar className="w-4 h-4 mr-2" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Sync Logs
          </TabsTrigger>
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          {connections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wifi className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Platforms Connected</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  Connect your Airbnb, VRBO, or property management system to automatically import booking data.
                </p>
                <Button 
                  onClick={() => setShowConnectModal(true)}
                  className="mt-4 bg-[#d4a574] hover:bg-[#c49464]"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect Your First Platform
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {connections.map((connection) => (
                <Card key={connection.id} className="overflow-hidden">
                  <CardHeader className={`py-3 ${PLATFORM_COLORS[connection.platform] || 'bg-gray-600 text-white'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{PLATFORM_LOGOS[connection.platform] || '🔗'}</span>
                        <div>
                          <CardTitle className="text-lg">{connection.platform_name}</CardTitle>
                          {connection.account_email && (
                            <p className="text-sm opacity-80">{connection.account_email}</p>
                          )}
                        </div>
                      </div>
                      {getSyncStatusBadge(connection.sync_status, connection.sync_error)}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold">{connection.listing_count}</p>
                        <p className="text-sm text-gray-500">Listings</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold">{connection.booking_count}</p>
                        <p className="text-sm text-gray-500">Bookings</p>
                      </div>
                    </div>

                    {connection.last_sync_at && (
                      <p className="text-sm text-gray-500 mb-4">
                        Last synced: {new Date(connection.last_sync_at).toLocaleString()}
                      </p>
                    )}

                    {connection.sync_error && (
                      <Alert className="mb-4 border-red-200 bg-red-50">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <AlertDescription className="text-red-700 text-sm">
                          {connection.sync_error}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleSync(connection.id)}
                        disabled={syncing === connection.id}
                      >
                        {syncing === connection.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Sync Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(connection.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Unlink className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Available Platforms */}
          <Card>
            <CardHeader>
              <CardTitle>Available Platforms</CardTitle>
              <CardDescription>Connect additional booking platforms to sync your data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {platforms.filter(p => !connections.some(c => c.platform === p.id)).map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => {
                      setSelectedPlatform(platform);
                      setShowConnectModal(true);
                    }}
                    className="p-4 border rounded-lg hover:border-[#d4a574] hover:bg-[#d4a574]/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{PLATFORM_LOGOS[platform.id] || '🔗'}</span>
                      <span className="font-medium">{platform.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{platform.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Listings Tab */}
        <TabsContent value="listings" className="space-y-4">
          {listings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Listings Synced</h3>
                <p className="text-gray-500 mt-2">
                  Connect a platform and sync to import your listings.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {listings.map((listing) => (
                <Card key={listing.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${PLATFORM_COLORS[listing.platform] || 'bg-gray-600 text-white'}`}>
                          <span className="text-xl">{PLATFORM_LOGOS[listing.platform] || '🔗'}</span>
                        </div>
                        <div>
                          <h4 className="font-medium">{listing.listing_name}</h4>
                          <p className="text-sm text-gray-500">
                            {listing.address && `${listing.address}, `}{listing.city}, {listing.state}
                          </p>
                          {listing.bedrooms && (
                            <p className="text-xs text-gray-400">
                              {listing.bedrooms} bed • {listing.bathrooms} bath
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {listing.property_id ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Matched
                          </Badge>
                        ) : (
                          <Select onValueChange={(value) => handleMatchListing(listing.id, value)}>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Match to property..." />
                            </SelectTrigger>
                            <SelectContent>
                              {portfolioProperties.map((prop) => (
                                <SelectItem key={prop.id} value={prop.id}>
                                  {prop.address}, {prop.city}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {listing.listing_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={listing.listing_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bookings Tab - Updated with Calendar/List Toggle */}
        <TabsContent value="bookings" className="space-y-4">
          {bookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Bookings Synced</h3>
                <p className="text-gray-500 mt-2">
                  Connect a platform and sync to import your booking history, or add direct bookings manually.
                </p>
                <Button 
                  onClick={() => setShowDirectBookingModal(true)}
                  className="mt-4 bg-[#d4a574] hover:bg-[#c49464]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Direct Booking
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* View Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex border rounded-lg overflow-hidden" role="group" aria-label="Booking view mode">
                  <Button
                    variant={bookingsViewMode === 'calendar' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setBookingsViewMode('calendar')}
                    className={bookingsViewMode === 'calendar' ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}
                    aria-pressed={bookingsViewMode === 'calendar'}
                  >
                    <CalendarDays className="w-4 h-4 mr-1" />
                    Calendar
                  </Button>
                  <Button
                    variant={bookingsViewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setBookingsViewMode('list')}
                    className={bookingsViewMode === 'list' ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}
                    aria-pressed={bookingsViewMode === 'list'}
                  >
                    <List className="w-4 h-4 mr-1" />
                    List
                  </Button>
                </div>
                <Button onClick={() => setShowDirectBookingModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Direct Booking
                </Button>
              </div>

              {/* Calendar View */}
              {bookingsViewMode === 'calendar' ? (
                <BookingCalendar 
                  bookings={bookings} 
                  onAddDirectBooking={() => setShowDirectBookingModal(true)} 
                />
              ) : (
                /* List View */
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full" role="table" aria-label="Booking history">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th scope="col" className="text-left p-4 font-medium text-gray-600">Platform</th>
                            <th scope="col" className="text-left p-4 font-medium text-gray-600">Listing</th>
                            <th scope="col" className="text-left p-4 font-medium text-gray-600">Guest</th>
                            <th scope="col" className="text-left p-4 font-medium text-gray-600">Dates</th>
                            <th scope="col" className="text-right p-4 font-medium text-gray-600">Nights</th>
                            <th scope="col" className="text-right p-4 font-medium text-gray-600">Revenue</th>
                            <th scope="col" className="text-center p-4 font-medium text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookings.map((booking) => (
                            <tr key={booking.id} className="border-b hover:bg-gray-50">
                              <td className="p-4">
                                <Badge className={PLATFORM_COLORS[booking.platform] || 'bg-gray-600 text-white'}>
                                  {PLATFORM_LOGOS[booking.platform]} {booking.platform}
                                </Badge>
                              </td>
                              <td className="p-4 text-sm">
                                {booking.platform_listings?.listing_name || '-'}
                              </td>
                              <td className="p-4 text-sm">{booking.guest_name || 'Guest'}</td>
                              <td className="p-4 text-sm">
                                {new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}
                              </td>
                              <td className="p-4 text-right">{booking.nights}</td>
                              <td className="p-4 text-right font-medium text-green-600">
                                ${booking.net_revenue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="p-4 text-center">
                                <Badge variant={booking.status === 'completed' ? 'default' : 'outline'}>
                                  {booking.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>


        {/* Sync Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          {syncLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Sync History</h3>
                <p className="text-gray-500 mt-2">
                  Sync logs will appear here after you sync your connected platforms.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full" role="table" aria-label="Sync history">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th scope="col" className="text-left p-4 font-medium text-gray-600">Platform</th>
                        <th scope="col" className="text-left p-4 font-medium text-gray-600">Type</th>
                        <th scope="col" className="text-left p-4 font-medium text-gray-600">Started</th>
                        <th scope="col" className="text-left p-4 font-medium text-gray-600">Completed</th>
                        <th scope="col" className="text-right p-4 font-medium text-gray-600">Records</th>
                        <th scope="col" className="text-center p-4 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncLogs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            {log.platform_connections?.platform || 'Unknown'}
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{log.sync_type}</Badge>
                          </td>
                          <td className="p-4 text-sm">
                            {new Date(log.started_at).toLocaleString()}
                          </td>
                          <td className="p-4 text-sm">
                            {log.completed_at ? new Date(log.completed_at).toLocaleString() : '-'}
                          </td>
                          <td className="p-4 text-right">{log.records_synced}</td>
                          <td className="p-4 text-center">
                            {log.status === 'completed' ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Completed
                              </Badge>
                            ) : log.status === 'failed' ? (
                              <Badge className="bg-red-100 text-red-800" title={log.error_message}>
                                <XCircle className="w-3 h-3 mr-1" />
                                Failed
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                {log.status}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Export Data Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-lg" aria-describedby="export-dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Booking Data
            </DialogTitle>
            <DialogDescription id="export-dialog-description">
              Download your synced booking data as CSV or Excel file
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="export-start-date">Start Date</Label>
                <Input
                  id="export-start-date"
                  type="date"
                  value={exportFilters.start_date}
                  onChange={(e) => setExportFilters({ ...exportFilters, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="export-end-date">End Date</Label>
                <Input
                  id="export-end-date"
                  type="date"
                  value={exportFilters.end_date}
                  onChange={(e) => setExportFilters({ ...exportFilters, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Platform Filter */}
            <div>
              <Label htmlFor="export-platform">Platform</Label>
              <Select 
                value={exportFilters.platform} 
                onValueChange={(value) => setExportFilters({ ...exportFilters, platform: value })}
              >
                <SelectTrigger id="export-platform">
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {exportOptions?.platforms.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Property Filter */}
            <div>
              <Label htmlFor="export-property">Property</Label>
              <Select 
                value={exportFilters.property_id} 
                onValueChange={(value) => setExportFilters({ ...exportFilters, property_id: value })}
              >
                <SelectTrigger id="export-property">
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {exportOptions?.properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address}, {p.city}, {p.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                Export includes: Platform, Listing, Guest Name, Check-in/out Dates, Nights, Revenue, Status
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowExportModal(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={exporting}
            >
              {exporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            <Button
              onClick={() => handleExport('excel')}
              disabled={exporting}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {exporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Download className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Platform Modal */}
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent className="max-w-lg" aria-describedby="connect-dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPlatform ? (
                <>
                  <span className="text-2xl">{PLATFORM_LOGOS[selectedPlatform.id] || '🔗'}</span>
                  Connect {selectedPlatform.name}
                </>
              ) : (
                'Connect Platform'
              )}
            </DialogTitle>
            <DialogDescription id="connect-dialog-description">
              {selectedPlatform?.description || 'Select a platform to connect'}
            </DialogDescription>
          </DialogHeader>

          {!selectedPlatform ? (
            <div className="grid grid-cols-2 gap-3">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform)}
                  className="p-4 border rounded-lg hover:border-[#d4a574] hover:bg-[#d4a574]/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{PLATFORM_LOGOS[platform.id] || '🔗'}</span>
                    <span className="font-medium">{platform.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">{platform.authType === 'oauth' ? 'OAuth' : 'API Key'}</p>
                </button>
              ))}
            </div>
          ) : selectedPlatform.authType === 'oauth' ? (
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  {selectedPlatform.name} uses OAuth for secure authentication. Click the button below to authorize access to your account.
                </AlertDescription>
              </Alert>

              <div className="text-center py-6">
                <div className={`w-20 h-20 mx-auto rounded-full ${PLATFORM_COLORS[selectedPlatform.id] || 'bg-gray-600'} flex items-center justify-center mb-4`}>
                  <span className="text-4xl">{PLATFORM_LOGOS[selectedPlatform.id] || '🔗'}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Connect with {selectedPlatform.name}</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                  You'll be redirected to {selectedPlatform.name} to authorize access. Your credentials are never stored on our servers.
                </p>
                <Button 
                  onClick={async () => {
                    setConnecting(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('manage-platform-connections', {
                        body: {
                          action: 'get_oauth_url',
                          platform: selectedPlatform.id,
                          investor_id: investorId,
                          redirect_uri: `${window.location.origin}/oauth/callback`
                        }
                      });
                      
                      if (error) throw error;
                      if (data?.oauth_url) {
                        window.location.href = data.oauth_url;
                      } else {
                        throw new Error('Failed to get OAuth URL');
                      }
                    } catch (err: any) {
                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                      setConnecting(false);
                    }
                  }}
                  disabled={connecting}
                  className={`${PLATFORM_COLORS[selectedPlatform.id]?.replace('text-white', '') || 'bg-gray-600'} text-white hover:opacity-90 px-8`}
                >
                  {connecting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Connect with {selectedPlatform.name}
                </Button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedPlatform(null)}>
                  Back
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <Shield className="w-4 h-4" />
                <AlertDescription>
                  Your API credentials are encrypted and stored securely. We only use them to sync your booking data.
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="api_key">API Key *</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Find this in your {selectedPlatform.name} account settings under API or Integrations.
                </p>
              </div>

              {selectedPlatform.id !== 'airbnb' && (
                <div>
                  <Label htmlFor="api_secret">API Secret (if required)</Label>
                  <Input
                    id="api_secret"
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Enter your API secret"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="account_email">Account Email (optional)</Label>
                <Input
                  id="account_email"
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedPlatform(null)}>
                  Back
                </Button>
                <Button 
                  onClick={handleConnect}
                  disabled={connecting || !apiKey}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {connecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Connect
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* CSV Import Modal */}
      <Dialog open={showCSVImport} onOpenChange={setShowCSVImport}>
        <DialogContent className="max-w-2xl" aria-describedby="csv-import-description">
          <DialogHeader>
            <DialogTitle>Import Booking Data from CSV</DialogTitle>
            <DialogDescription id="csv-import-description">
              Paste your CSV data below. Required columns: check_in, check_out, revenue (or gross_revenue)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-property">Select Property *</Label>
              <Select value={selectedPropertyForCSV} onValueChange={setSelectedPropertyForCSV}>
                <SelectTrigger id="csv-property">
                  <SelectValue placeholder="Select a property..." />
                </SelectTrigger>
                <SelectContent>
                  {portfolioProperties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.address}, {prop.city}, {prop.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="csv-data">CSV Data *</Label>
              <Textarea
                id="csv-data"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder={`check_in,check_out,revenue,guest_name
2024-01-15,2024-01-18,450,John Doe
2024-01-20,2024-01-25,875,Jane Smith`}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                Supported columns: check_in, check_out, revenue (or gross_revenue), net_revenue, platform_fees, cleaning_fee, guest_name
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCSVImport(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCSVImport}
              disabled={!csvData.trim() || !selectedPropertyForCSV}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Booking Modal */}
      <Dialog open={showDirectBookingModal} onOpenChange={setShowDirectBookingModal}>
        <DialogContent className="max-w-lg" aria-describedby="direct-booking-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add Direct Booking
            </DialogTitle>
            <DialogDescription id="direct-booking-description">
              Manually add a direct booking that wasn't made through a connected platform
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="direct-listing">Listing *</Label>
              <Select 
                value={directBookingForm.listing_id} 
                onValueChange={(value) => setDirectBookingForm({ ...directBookingForm, listing_id: value })}
              >
                <SelectTrigger id="direct-listing">
                  <SelectValue placeholder="Select a listing..." />
                </SelectTrigger>
                <SelectContent>
                  {listings.map((listing) => (
                    <SelectItem key={listing.id} value={listing.id}>
                      {listing.listing_name}
                    </SelectItem>
                  ))}
                  {portfolioProperties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.address}, {prop.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="direct-guest">Guest Name</Label>
              <Input
                id="direct-guest"
                value={directBookingForm.guest_name}
                onChange={(e) => setDirectBookingForm({ ...directBookingForm, guest_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div>
              <Label htmlFor="direct-email">Guest Email</Label>
              <Input
                id="direct-email"
                type="email"
                value={directBookingForm.guest_email}
                onChange={(e) => setDirectBookingForm({ ...directBookingForm, guest_email: e.target.value })}
                placeholder="guest@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="direct-checkin">Check-in Date *</Label>
                <Input
                  id="direct-checkin"
                  type="date"
                  value={directBookingForm.check_in}
                  onChange={(e) => setDirectBookingForm({ ...directBookingForm, check_in: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="direct-checkout">Check-out Date *</Label>
                <Input
                  id="direct-checkout"
                  type="date"
                  value={directBookingForm.check_out}
                  onChange={(e) => setDirectBookingForm({ ...directBookingForm, check_out: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="direct-gross">Gross Revenue *</Label>
                <Input
                  id="direct-gross"
                  type="number"
                  value={directBookingForm.gross_revenue}
                  onChange={(e) => setDirectBookingForm({ ...directBookingForm, gross_revenue: e.target.value })}
                  placeholder="500"
                />
              </div>
              <div>
                <Label htmlFor="direct-net">Net Revenue (after fees)</Label>
                <Input
                  id="direct-net"
                  type="number"
                  value={directBookingForm.net_revenue}
                  onChange={(e) => setDirectBookingForm({ ...directBookingForm, net_revenue: e.target.value })}
                  placeholder="Same as gross if empty"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="direct-notes">Notes</Label>
              <Textarea
                id="direct-notes"
                value={directBookingForm.notes}
                onChange={(e) => setDirectBookingForm({ ...directBookingForm, notes: e.target.value })}
                placeholder="Any additional notes about this booking..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDirectBookingModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveDirectBooking}
              disabled={savingDirectBooking || !directBookingForm.listing_id || !directBookingForm.check_in || !directBookingForm.check_out || !directBookingForm.gross_revenue}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {savingDirectBooking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Plus className="w-4 h-4 mr-2" />
              Add Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
