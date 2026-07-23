import { useCallback, useEffect, useState } from 'react';
import { Brain, RefreshCw, AlertTriangle, CheckCircle, Clock, Loader2, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface HealthStats {
  totalLive: number;
  fresh: number;
  stale: number;
  neverScored: number;
  freshPct: number;
}

interface RefreshLogRow {
  id: string;
  run_id: string;
  started_at: string;
  completed_at: string | null;
  trigger_type: 'cron' | 'manual';
  triggered_by: string | null;
  properties_scanned: number;
  properties_scored: number;
  errors_encountered: number;
  status: 'running' | 'completed' | 'failed' | 'partial';
  duration_ms: number | null;
}

interface Props {
  staffId?: string;
  staffName?: string;
}

const STALE_DAYS = 7;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

export function PennyScoreHealthWidget({ staffId, staffName }: Props) {
  const { toast } = useToast();
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [latestRun, setLatestRun] = useState<RefreshLogRow | null>(null);
  const [recentRuns, setRecentRuns] = useState<RefreshLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('id, penny_scored_at, deal_status')
      .in('deal_status', ['live', 'published', 'active', 'available']);

    if (error) throw error;

    const cutoff = Date.now() - STALE_MS;
    let fresh = 0;
    let stale = 0;
    let neverScored = 0;

    for (const property of data || []) {
      if (!property.penny_scored_at) neverScored += 1;
      else if (new Date(property.penny_scored_at).getTime() < cutoff) stale += 1;
      else fresh += 1;
    }

    const totalLive = data?.length || 0;
    setStats({
      totalLive,
      fresh,
      stale,
      neverScored,
      freshPct: totalLive ? Math.round((fresh / totalLive) * 100) : 0,
    });
  }, []);

  const fetchLatestRun = useCallback(async () => {
    if (!staffId) {
      setRecentRuns([]);
      setLatestRun(null);
      return;
    }

    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: {
        action: 'get_penny_score_refresh_log',
        staff_id: staffId,
        limit: 5,
      },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Could not load Penny refresh history');

    const rows = Array.isArray(data.runs) ? (data.runs as RefreshLogRow[]) : [];
    setRecentRuns(rows);
    setLatestRun(rows[0] || null);
  }, [staffId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchLatestRun()]);
    } catch (error) {
      console.warn('[PennyScoreHealthWidget] refresh failed:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchLatestRun, fetchStats]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (latestRun?.status !== 'running') return;
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(interval);
  }, [latestRun?.status, refresh]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('nightly-penny-score-refresh', {
        body: {
          trigger_type: 'manual',
          triggered_by: staffName || staffId || 'staff',
          only_stale: true,
        },
      });
      if (error) throw error;
      toast({
        title: 'Refresh started',
        description: `Scanning ${data?.properties_scanned ?? '...'} stale properties.`,
      });
      await refresh();
    } catch (error: any) {
      toast({
        title: 'Refresh failed',
        description: error?.message || 'Could not start the manual refresh.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const statusBadge = (status: RefreshLogRow['status']) => {
    if (status === 'completed') return <Badge className="bg-emerald-500">Completed</Badge>;
    if (status === 'partial') return <Badge className="bg-amber-500">Partial</Badge>;
    if (status === 'failed') return <Badge className="bg-red-500">Failed</Badge>;
    return <Badge className="bg-blue-500"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Running</Badge>;
  };

  const healthClass = !stats
    ? 'text-gray-400'
    : stats.freshPct >= 90
      ? 'text-emerald-600'
      : stats.freshPct >= 70
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/40 to-indigo-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Penny Score Health</CardTitle>
              <CardDescription className="text-xs">Freshness of AI deal scores across the live portfolio</CardDescription>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleManualRefresh} disabled={refreshing || latestRun?.status === 'running'}>
            {refreshing || latestRun?.status === 'running'
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running…</>
              : <><RefreshCw className="mr-2 h-4 w-4" />Refresh All Stale</>}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && !stats ? (
          <div className="flex items-center justify-center py-6 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading score health…
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-white p-4">
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-600">Fresh Scores</div>
                  <div className={`text-4xl font-bold ${healthClass}`}>{stats?.freshPct ?? 0}%</div>
                  <div className="text-xs text-gray-500">{stats?.fresh ?? 0} of {stats?.totalLive ?? 0} live properties</div>
                </div>
                <div className="space-y-1 text-right text-xs text-gray-600">
                  <div><Clock className="inline h-3 w-3" /> Stale: <strong>{stats?.stale ?? 0}</strong></div>
                  <div><AlertTriangle className="inline h-3 w-3 text-orange-500" /> Never scored: <strong>{stats?.neverScored ?? 0}</strong></div>
                </div>
              </div>
              <Progress value={stats?.freshPct ?? 0} className="h-2" />
            </div>

            <div className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Activity className="h-4 w-4 text-purple-600" />Last Refresh
                </div>
                {latestRun && statusBadge(latestRun.status)}
              </div>
              {latestRun ? (
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><div className="text-gray-500">Started</div><div className="font-medium">{new Date(latestRun.started_at).toLocaleString()}</div></div>
                  <div><div className="text-gray-500">Scored / Scanned</div><div className="font-medium">{latestRun.properties_scored} / {latestRun.properties_scanned}</div></div>
                  <div><div className="text-gray-500">Errors</div><div className="font-medium">{latestRun.errors_encountered}</div></div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No refresh runs logged yet.</p>
              )}
            </div>

            {recentRuns.length > 1 && (
              <div className="space-y-1 rounded-lg border bg-white p-3 text-xs">
                {recentRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50">
                    <span className="flex items-center gap-2">
                      {run.status === 'completed' ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                    <span>{run.properties_scored}/{run.properties_scanned}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
