import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, Search, RefreshCw, CheckCircle, XCircle, Clock, 
  AlertTriangle, ChevronLeft, ChevronRight, Filter,
  MailOpen, Send, Ban, AlertCircle, Loader2
} from 'lucide-react';

interface EmailLog {
  id: string;
  template_type: string;
  recipient_email: string;
  subject: string;
  status: string;
  error_message?: string;
  resend_id?: string;
  sent_at: string;
}

interface EmailStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
  failed: number;
}

export function EmailDeliveryTab() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EmailStats>({ total: 0, sent: 0, delivered: 0, opened: 0, bounced: 0, failed: 0 });
  const [templateTypes, setTemplateTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { toast } = useToast();

  const limit = 25;

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter, typeFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('manage-email-logs', {
        body: { 
          action: 'get_logs',
          page,
          limit,
          search: search || undefined,
          status_filter: statusFilter,
          type_filter: typeFilter
        }
      });

      if (fetchError) {
        console.error('[EmailDeliveryTab] Error fetching logs:', fetchError);
        setError('Unable to load email logs. Please try again later.');
        setLogs([]);
        setStats({ total: 0, sent: 0, delivered: 0, opened: 0, bounced: 0, failed: 0 });
        setTemplateTypes([]);
        setTotalPages(1);
      } else {
        setLogs(data?.logs || []);
        setStats(data?.stats || { total: 0, sent: 0, delivered: 0, opened: 0, bounced: 0, failed: 0 });
        setTemplateTypes(data?.template_types || []);
        setTotalPages(Math.max(1, Math.ceil((data?.total || 0) / limit)));
      }
    } catch (err: any) {
      console.error('[EmailDeliveryTab] Exception:', err);
      setError('Unable to connect to the server. Please try again later.');
      setLogs([]);
      setStats({ total: 0, sent: 0, delivered: 0, opened: 0, bounced: 0, failed: 0 });
    }
    
    setLoading(false);
  };

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      sent: { color: 'bg-blue-100 text-blue-800', icon: <Send className="w-3 h-3" aria-hidden="true" />, label: 'Sent' },
      delivered: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" aria-hidden="true" />, label: 'Delivered' },
      opened: { color: 'bg-purple-100 text-purple-800', icon: <MailOpen className="w-3 h-3" aria-hidden="true" />, label: 'Opened' },
      bounced: { color: 'bg-orange-100 text-orange-800', icon: <Ban className="w-3 h-3" aria-hidden="true" />, label: 'Bounced' },
      failed: { color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" aria-hidden="true" />, label: 'Failed' },
      pending: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="w-3 h-3" aria-hidden="true" />, label: 'Pending' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getTemplateTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'investor_password_reset': 'Password Reset',
      'staff_password_reset': 'Staff Password Reset',
      'welcome_email': 'Welcome Email',
      'deal_notification': 'Deal Notification',
      'document_notification': 'Document Notification',
      'acquisition_update': 'Acquisition Update',
      'dispute_notification': 'Dispute Notification',
      'referral_notification': 'Referral Notification',
      'staff_reset': 'Staff Reset',
      'investor_invitation': 'Investor Invitation',
      'campaign': 'Bulk Campaign',
      'custom': 'Custom Email'
    };
    return labels[type] || type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };


  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Sent</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Mail className="w-8 h-8 text-gray-400" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Sent</p>
                <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
              </div>
              <Send className="w-8 h-8 text-blue-400" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Delivered</p>
                <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Opened</p>
                <p className="text-2xl font-bold text-purple-600">{stats.opened}</p>
              </div>
              <MailOpen className="w-8 h-8 text-purple-400" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Bounced</p>
                <p className="text-2xl font-bold text-orange-600">{stats.bounced}</p>
              </div>
              <Ban className="w-8 h-8 text-orange-400" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium text-amber-800">Email Logs Unavailable</p>
                <p className="text-sm text-amber-700 mt-1">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={fetchLogs}
                >
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" aria-hidden="true" />
                Email Delivery Tracking
              </CardTitle>
              <CardDescription>Monitor all sent emails and their delivery status</CardDescription>
            </div>
            <Button 
              onClick={fetchLogs} 
              variant="outline" 
              size="sm"
              disabled={loading}
              aria-label="Refresh email logs"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <Input aria-label="Search by email or subject"
                placeholder="Search by email or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
                aria-label="Search emails"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full md:w-40" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="opened">Opened</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full md:w-48" aria-label="Filter by email type">
                <SelectValue placeholder="Email Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {templateTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {getTemplateTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleSearch} aria-label="Apply search filter">
              <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
              Search
            </Button>
          </div>

          {/* Email Logs Table */}
          <div className="overflow-x-auto">
            <table className="w-full" role="table" aria-label="Email delivery logs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-700" scope="col">Recipient</th>
                  <th className="text-left p-3 font-medium text-gray-700" scope="col">Subject</th>
                  <th className="text-left p-3 font-medium text-gray-700" scope="col">Type</th>
                  <th className="text-left p-3 font-medium text-gray-700" scope="col">Status</th>
                  <th className="text-left p-3 font-medium text-gray-700" scope="col">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" aria-hidden="true" />
                      Loading email logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      <Mail className="w-8 h-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                      No email logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{log.recipient_email}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-gray-700 max-w-xs truncate" title={log.subject}>
                          {log.subject || '-'}
                        </div>
                        {log.error_message && (
                          <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            {log.error_message.substring(0, 50)}...
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {getTemplateTypeLabel(log.template_type)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {formatDate(log.sent_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
