import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Monitor, Smartphone, Tablet, Globe, Clock, 
  LogOut, Shield, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, History
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Session {
  id: string;
  device_info: {
    deviceType: string;
    browser: string;
    os: string;
  };
  ip_address: string;
  created_at: string;
  last_activity: string;
  is_remember_me: boolean;
  is_current: boolean;
}

interface LoginHistoryEntry {
  id: string;
  login_at: string;
  ip_address: string;
  device_type: string;
  login_method: string;
  success: boolean;
  failure_reason?: string;
}

export default function SessionManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const { toast } = useToast();

  const sessionToken = localStorage.getItem('investorSessionToken');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchSessions(), fetchLoginHistory()]);
    setLoading(false);
  };

  const fetchSessions = async () => {
    if (!sessionToken) return;

    try {
      // Use the new investor-session function
      const { data, error } = await supabase.functions.invoke('investor-auth-v2', {
        body: { action: 'get_active_sessions', session_token: sessionToken }
      });

      if (error) throw error;
      if (data?.success) {
        setSessions(data.sessions || []);
      }
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      toast({
        title: 'Error',
        description: 'Failed to load active sessions',
        variant: 'destructive'
      });
    }
  };

  const fetchLoginHistory = async () => {
    if (!sessionToken) return;

    try {
      // Use the new investor-session function
      const { data, error } = await supabase.functions.invoke('investor-auth-v2', {
        body: { action: 'get_login_history', session_token: sessionToken }
      });

      if (error) throw error;
      if (data?.success) {
        setLoginHistory(data.history || []);
      }
    } catch (err: any) {
      console.error('Error fetching login history:', err);
    }
  };


  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      // Use the new investor-session function
      const { data, error } = await supabase.functions.invoke('investor-auth-v2', {
        body: { 
          action: 'revoke_session', 
          session_token: sessionToken,
          target_session_id: sessionId 
        }
      });

      if (error) throw error;
      if (data?.success) {
        toast({
          title: 'Session Revoked',
          description: 'The session has been logged out successfully.'
        });
        fetchSessions();
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to revoke session',
        variant: 'destructive'
      });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    setRevokingAll(true);
    try {
      // Use the new investor-login function for logout_all
      const { data, error } = await supabase.functions.invoke('investor-login', {
        body: { action: 'logout_all', session_token: sessionToken }
      });

      if (error) throw error;
      if (data?.success) {
        toast({
          title: 'All Sessions Revoked',
          description: 'All sessions have been logged out. You will need to log in again.'
        });
        // Clear local session and redirect
        localStorage.removeItem('investorSession');
        localStorage.removeItem('investorSessionToken');
        window.location.href = '/investor/login';
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to revoke all sessions',
        variant: 'destructive'
      });
    } finally {
      setRevokingAll(false);
    }
  };


  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Session & Security</h2>
          <p className="text-gray-600">Manage your active sessions and view login history</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Active Sessions
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Login History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Active Sessions</CardTitle>
                <CardDescription>
                  {sessions.length} active session{sessions.length !== 1 ? 's' : ''} on your account
                </CardDescription>
              </div>
              {sessions.length > 1 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={revokingAll}>
                      {revokingAll ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4 mr-2" />
                      )}
                      Log Out All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Log out of all sessions?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will log you out of all devices including this one. You will need to log in again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRevokeAllSessions} className="bg-red-600 hover:bg-red-700">
                        Log Out All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active sessions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        session.is_current ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${
                          session.is_current ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {getDeviceIcon(session.device_info?.deviceType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {session.device_info?.browser || 'Unknown Browser'} on {session.device_info?.os || 'Unknown OS'}
                            </span>
                            {session.is_current && (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                Current Session
                              </Badge>
                            )}
                            {session.is_remember_me && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                                Remember Me
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {session.ip_address || 'Unknown IP'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last active: {getTimeAgo(session.last_activity)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Started: {formatDate(session.created_at)}
                          </p>
                        </div>
                      </div>
                      {!session.is_current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={revoking === session.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {revoking === session.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <LogOut className="w-4 h-4 mr-1" />
                              Revoke
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Login History</CardTitle>
              <CardDescription>
                Recent login attempts on your account (last 50)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loginHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No login history found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {loginHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        entry.success ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          entry.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {entry.success ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {entry.success ? 'Successful Login' : 'Failed Login'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {entry.device_type || 'Unknown'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {entry.ip_address || 'Unknown IP'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(entry.login_at)}
                            </span>
                          </div>
                          {entry.failure_reason && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {entry.failure_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Security Tips */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
            <Shield className="w-5 h-5" />
            Security Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-amber-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Regularly review your active sessions and revoke any you don't recognize</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Use "Remember Me" only on personal devices you trust</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>If you see suspicious login attempts, change your password immediately</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Always log out when using shared or public computers</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
