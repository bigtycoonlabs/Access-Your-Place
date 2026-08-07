import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Smartphone,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Phone,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface SMSLog {
  id: string;
  investor_id: string | null;
  phone_number: string;
  notification_type: string;
  message_content: string;
  status: string;
  error_message: string | null;
  twilio_message_sid: string | null;
  created_at: string;
  investor?: {
    full_name: string;
    email: string;
  } | null;
}

const notificationTypeLabels: Record<string, string> = {
  first_refusal_approved: 'First Right of Refusal',
  first_refusal_reminder: 'Refusal Reminder',
  document_signature_required: 'Document Signature',
  application_approved: 'Application Approved',
  acquisition_agreement_ready: 'Agreement Ready',
  new_deal_match: 'New Deal Match',
  payment_confirmed: 'Payment Confirmed',
  manager_assigned: 'Manager Assigned',
  deal_publicly_available: 'Deal Available',
  refusal_expired: 'Refusal Expired',
  test: 'Test Message'
};

export function SMSLogsTab() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to fetch from database
      const { data, error: fetchError } = await supabase
        .from('sms_logs')
        .select(`
          *,
          investor:investors(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (fetchError) {
        // Check if it's a table not found error
        if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
          console.log('[SMSLogsTab] sms_logs table does not exist yet');
          setLogs([]);
          setError(null);
        } else {
          console.error('[SMSLogsTab] Error fetching SMS logs:', fetchError);
          setError('Unable to load SMS logs. The SMS logging feature may not be configured yet.');
          setLogs([]);
        }
      } else {
        setLogs(data || []);
      }
    } catch (err: any) {
      console.error('[SMSLogsTab] Exception fetching SMS logs:', err);
      setError('Unable to connect to the database. Please try again later.');
      setLogs([]);
    }
    
    setLoading(false);
  };

  const getFilteredLogs = () => {
    return logs.filter(log => {
      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      
      // Type filter
      if (typeFilter !== 'all' && log.notification_type !== typeFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPhone = log.phone_number?.includes(query);
        const matchesInvestor = log.investor?.full_name?.toLowerCase().includes(query);
        const matchesMessage = log.message_content?.toLowerCase().includes(query);
        if (!matchesPhone && !matchesInvestor && !matchesMessage) return false;
      }
      
      return true;
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return 'Unknown';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const filteredLogs = getFilteredLogs();
  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" aria-hidden="true" />
        <span className="sr-only">Loading SMS logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg" aria-hidden="true">
                <Smartphone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle>SMS Notification Logs</CardTitle>
                <CardDescription>
                  View all SMS notifications sent to investors via Twilio
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium text-amber-800">SMS Logs Unavailable</p>
                <p className="text-sm text-amber-700 mt-1">{error}</p>
                <p className="text-xs text-amber-600 mt-2">
                  SMS notifications require Twilio configuration. Contact your administrator if you need this feature enabled.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg" aria-hidden="true">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.length}</p>
                <p className="text-sm text-gray-500">Total SMS</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg" aria-hidden="true">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sentCount}</p>
                <p className="text-sm text-gray-500">Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg" aria-hidden="true">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{failedCount}</p>
                <p className="text-sm text-gray-500">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg" aria-hidden="true">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Set(logs.filter(l => l.investor_id).map(l => l.investor_id)).size}
                </p>
                <p className="text-sm text-gray-500">Unique Recipients</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <Input aria-label="Search by phone, name, or message"
                  placeholder="Search by phone, name, or message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  aria-label="Search SMS logs"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]" aria-label="Filter by notification type">
                <SelectValue placeholder="Notification Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(notificationTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Smartphone className="w-12 h-12 mb-4 text-gray-300" aria-hidden="true" />
              <p className="text-lg font-medium">No SMS logs found</p>
              <p className="text-sm">
                {logs.length === 0 
                  ? 'No SMS notifications have been sent yet'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y" role="list" aria-label="SMS notification logs">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-gray-50" role="listitem">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${
                        log.status === 'sent' 
                          ? 'bg-green-100' 
                          : log.status === 'failed'
                          ? 'bg-red-100'
                          : 'bg-gray-100'
                      }`} aria-hidden="true">
                        {log.status === 'sent' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : log.status === 'failed' ? (
                          <XCircle className="w-5 h-5 text-red-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {notificationTypeLabels[log.notification_type] || log.notification_type}
                          </Badge>
                          <Badge 
                            variant={log.status === 'sent' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {log.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" aria-hidden="true" />
                            {formatPhoneDisplay(log.phone_number)}
                          </span>
                          {log.investor && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" aria-hidden="true" />
                              {log.investor.full_name}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mb-2">
                          {log.message_content}
                        </p>
                        
                        {log.error_message && (
                          <p className="text-xs text-red-600 mb-2">
                            Error: {log.error_message}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" aria-hidden="true" />
                            {formatDate(log.created_at)}
                          </span>
                          {log.twilio_message_sid && (
                            <span className="font-mono">
                              SID: {log.twilio_message_sid.substring(0, 20)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
