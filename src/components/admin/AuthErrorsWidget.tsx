import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertTriangle, CheckCircle, Clock, Search, RefreshCw, 
  User, Mail, Key, Shield, XCircle, Eye, MessageSquare
} from 'lucide-react';

interface AuthError {
  id: string;
  error_type: string;
  email: string | null;
  investor_id: string | null;
  error_message: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

interface AuthErrorCounts {
  total_24h: number;
  login_failed: number;
  verification_failed: number;
  password_reset_failed: number;
  unresolved: number;
}

interface Props {
  staffId?: string;
}

export function AuthErrorsWidget({ staffId }: Props) {
  const [errors, setErrors] = useState<AuthError[]>([]);
  const [counts, setCounts] = useState<AuthErrorCounts>({
    total_24h: 0,
    login_failed: 0,
    verification_failed: 0,
    password_reset_failed: 0,
    unresolved: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedError, setSelectedError] = useState<AuthError | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadErrors();
    // Refresh every 60 seconds
    const interval = setInterval(loadErrors, 60000);
    return () => clearInterval(interval);
  }, [activeFilter, searchEmail]);

  const loadErrors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-login', {
        body: {
          action: 'get_auth_errors',
          limit: 50,
          error_type: activeFilter !== 'all' ? activeFilter : undefined,
          resolved: activeFilter === 'resolved' ? true : activeFilter === 'unresolved' ? false : undefined,
          email_filter: searchEmail || undefined
        }
      });

      if (error) throw error;
      setErrors(data?.errors || []);
      if (data?.counts) setCounts(data.counts);
    } catch (err) {
      console.error('Failed to load auth errors:', err);
    }
    setLoading(false);
  };

  const handleResolve = async () => {
    if (!selectedError) return;
    setResolving(true);
    try {
      const { error } = await supabase.functions.invoke('investor-login', {
        body: {
          action: 'resolve_auth_error',
          error_id: selectedError.id,
          staff_id: staffId,
          notes: resolveNotes
        }
      });

      if (error) throw error;
      toast({ title: 'Error Resolved', description: 'The authentication error has been marked as resolved.' });
      setSelectedError(null);
      setResolveNotes('');
      loadErrors();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to resolve error', variant: 'destructive' });
    }
    setResolving(false);
  };

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'login_failed': return <Key className="w-4 h-4 text-red-500" />;
      case 'verification_failed': return <Mail className="w-4 h-4 text-yellow-500" />;
      case 'password_reset_failed': return <Shield className="w-4 h-4 text-orange-500" />;
      case 'session_expired': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'rate_limited': return <XCircle className="w-4 h-4 text-purple-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getErrorBadge = (type: string) => {
    const styles: Record<string, string> = {
      login_failed: 'bg-red-100 text-red-700',
      verification_failed: 'bg-yellow-100 text-yellow-700',
      password_reset_failed: 'bg-orange-100 text-orange-700',
      session_expired: 'bg-blue-100 text-blue-700',
      rate_limited: 'bg-purple-100 text-purple-700'
    };
    return styles[type] || 'bg-gray-100 text-gray-700';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Skeleton loading state
  if (loading && errors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Authentication Errors
          </CardTitle>
          <CardDescription>Monitor login failures and verification issues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Authentication Errors
              {counts.unresolved > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {counts.unresolved} unresolved
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Monitor login failures and verification issues to proactively help investors
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadErrors} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-600 font-medium">Login Failures</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{counts.login_failed}</p>
            <p className="text-xs text-red-500">Last 24 hours</p>
          </div>
          
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-600 font-medium">Verification</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{counts.verification_failed}</p>
            <p className="text-xs text-yellow-500">Last 24 hours</p>
          </div>
          
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-orange-600 font-medium">Password Reset</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">{counts.password_reset_failed}</p>
            <p className="text-xs text-orange-500">Last 24 hours</p>
          </div>
          
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-600 font-medium">Total Errors</span>
            </div>
            <p className="text-2xl font-bold text-gray-700">{counts.total_24h}</p>
            <p className="text-xs text-gray-500">Last 24 hours</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input aria-label="Search by email"
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={activeFilter} onValueChange={setActiveFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unresolved">Unresolved</TabsTrigger>
              <TabsTrigger value="login_failed">Login</TabsTrigger>
              <TabsTrigger value="verification_failed">Verify</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Error List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {errors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
              <p className="font-medium">No authentication errors found</p>
              <p className="text-sm">All systems operating normally</p>
            </div>
          ) : (
            errors.map((error) => (
              <div
                key={error.id}
                className={`p-4 border rounded-lg ${error.resolved ? 'bg-gray-50 border-gray-200' : 'bg-white border-red-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getErrorIcon(error.error_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={getErrorBadge(error.error_type)}>
                          {error.error_type.replace(/_/g, ' ')}
                        </Badge>
                        {error.resolved && (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1">
                        {error.email || 'Unknown email'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {error.error_message}
                      </p>
                      {error.metadata?.reason && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Reason: {error.metadata.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatTime(error.created_at)}</span>
                    {!error.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedError(error)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resolve Dialog */}
        <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Authentication Error</DialogTitle>
              <DialogDescription>
                Review this error and take action to help the investor
              </DialogDescription>
            </DialogHeader>
            
            {selectedError && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">{selectedError.email || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getErrorBadge(selectedError.error_type)}>
                      {selectedError.error_type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{selectedError.error_message}</p>
                  <p className="text-xs text-gray-400">
                    Occurred: {new Date(selectedError.created_at).toLocaleString()}
                  </p>
                  {selectedError.metadata?.investor_name && (
                    <p className="text-xs text-gray-500">
                      Investor: {selectedError.metadata.investor_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium" htmlFor="resolution-notes-optional">Resolution Notes (optional)</label>
                  <Textarea id="resolution-notes-optional"
                    placeholder="e.g., Contacted investor via email, reset password manually..."
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  {selectedError.email && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(`mailto:${selectedError.email}?subject=Help with your Access Your Place account`, '_blank')}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email Investor
                    </Button>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedError(null)}>
                Cancel
              </Button>
              <Button onClick={handleResolve} disabled={resolving} className="bg-green-600 hover:bg-green-700">
                {resolving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Mark Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
