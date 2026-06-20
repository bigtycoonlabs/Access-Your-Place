/**
 * PennyScoreHealthWidget
 *
 * Staff-admin dashboard widget that shows the freshness health of Penny
 * scores across the portfolio of live properties:
 *
 *   - % of live properties with FRESH scores (scored within the last 7 days)
 *   - count of stale / never-scored properties
 *   - last nightly refresh run summary (timestamp, scored, errors)
 *   - manual "Refresh All Stale Scores" button — invokes the
 *     `nightly-penny-score-refresh` edge function on demand with
 *     trigger_type='manual'.
 *
 * Polls the latest row of `penny_score_refresh_log` every 30s while a run is
 * in 'running' state so the staff sees live progress without having to
 * refresh.
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  Brain, RefreshCw, AlertTriangle, CheckCircle, Clock, Loader2,
  TrendingUp, Activity
} from 'lucide-react';

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
    try {
      // Pull live properties with their scored timestamp
      const { data: liveProps } = await supabase
        .from('properties')
        .select('id, penny_scored_at, deal_status')
        .in('deal_status', ['live', 'published', 'active', 'available']);

      const total = liveProps?.length || 0;
      const cutoff = Date.now() - STALE_MS;
      let fresh = 0;
      let stale = 0;
      let neverScored = 0;
      for (const p of liveProps || []) {
        if (!p.penny_scored_at) {
          neverScored++;
        } else {
          const ts = new Date(p.penny_scored_at).getTime();
          if (isNaN(ts) || ts < cutoff) stale++;
          else fresh++;
        }
      }
      const freshPct = total > 0 ? Math.round((fresh / total) * 100) : 0;
      setStats({ totalLive: total, fresh, stale, neverScored, freshPct });
    } catch (err) {
      console.warn('[PennyScoreHealthWidget] fetchStats failed:', err);
    }
  }, []);

  const fetchLatestRun = useCallback(async () => {
    try {
      const { data: latest } = await supabase
        .from('penny_score_refresh_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);
      const rows = (latest as RefreshLogRow[]) || [];
      setRecentRuns(rows);
      setLatestRun(rows[0] || null);
    } catch (err) {
      console.warn('[PennyScoreHealthWidget] fetchLatestRun failed:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchLatestRun()]);
    setLoading(false);
  }, [fetchStats, fetchLatestRun]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while a run is active so staff see live progress
  useEffect(() => {
    if (latestRun?.status !== 'running') return;
    const interval = setInterval(() => {
      fetchLatestRun();
      fetchStats();
    }, 15000);
    return () => clearInterval(interval);
  }, [latestRun?.status, fetchLatestRun, fetchStats]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('nightly-penny-score-refresh', {
        body: {
          trigger_type: 'manual',
          triggered_by: staffName || staffId || 'staff',
          only_stale: true
        }
      });
      if (error) throw error;
      toast({
        title: 'Refresh started',
        description: `Scanning ${data?.properties_scanned ?? '...'} stale properties. ${data?.properties_scored ?? 0} scored so far.`
      });
      await refresh();
    } catch (err: any) {
      toast({
        title: 'Refresh failed',
        description: err?.message || 'Could not start the manual refresh. Check edge function logs.',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const renderStatusBadge = (s: RefreshLogRow['status']) => {
    if (s === 'completed') return <Badge className="bg-emerald-500">Completed</Badge>;
    if (s === 'partial') return <Badge className="bg-amber-500">Partial</Badge>;
    if (s === 'failed') return <Badge className="bg-red-500">Failed</Badge>;
    return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
  };

  const healthColor =
    !stats ? 'text-gray-400' :
    stats.freshPct >= 90 ? 'text-emerald-600' :
    stats.freshPct >= 70 ? 'text-amber-600' :
    'text-red-600';

  const healthBg =
    !stats ? 'bg-gray-100' :
    stats.freshPct >= 90 ? 'bg-emerald-50 border-emerald-200' :
    stats.freshPct >= 70 ? 'bg-amber-50 border-amber-200' :
    'bg-red-50 border-red-200';

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/40 to-indigo-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Penny Score Health</CardTitle>
              <CardDescription className="text-xs">
                Freshness of AI deal scores across live portfolio
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualRefresh}
            disabled={refreshing || latestRun?.status === 'running'}
            className="bg-white"
          >
            {refreshing || latestRun?.status === 'running' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running…</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" />Refresh All Stale</>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && !stats ? (
          <div className="flex items-center justify-center py-6 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading score health…
          </div>
        ) : (
          <>
            {/* Headline freshness gauge */}
            <div className={`rounded-lg border p-4 ${healthBg}`}>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="text-xs text-gray-600 uppercase tracking-wide">Fresh Scores</div>
                  <div className={`text-4xl font-bold ${healthColor}`}>
                    {stats?.freshPct ?? 0}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {stats?.fresh ?? 0} of {stats?.totalLive ?? 0} live properties
                  </div>
                </div>
                <div className="text-right text-xs text-gray-600 space-y-1">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" /> Stale (&gt; {STALE_DAYS}d): <strong>{stats?.stale ?? 0}</strong>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <AlertTriangle className="w-3 h-3 text-orange-500" /> Never scored: <strong>{stats?.neverScored ?? 0}</strong>
                  </div>
                </div>
              </div>
              <Progress value={stats?.freshPct ?? 0} className="h-2" />
            </div>

            {/* Latest run summary */}
            <div className="rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Activity className="w-4 h-4 text-purple-600" />
                  Last Nightly Refresh
                </div>
                {latestRun && renderStatusBadge(latestRun.status)}
              </div>
              {latestRun ? (
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-gray-500">Started</div>
                    <div className="font-medium">{new Date(latestRun.started_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Scored / Scanned</div>
                    <div className="font-medium text-emerald-700">
                      {latestRun.properties_scored} / {latestRun.properties_scanned}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Errors</div>
                    <div className={`font-medium ${latestRun.errors_encountered > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {latestRun.errors_encountered}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  No refresh runs logged yet. Click "Refresh All Stale" or wait for the 2 AM cron.
                </p>
              )}
            </div>

            {/* Recent runs history */}
            {recentRuns.length > 1 && (
              <div className="rounded-lg border bg-white p-3">
                <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  Recent Runs
                </div>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {recentRuns.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-gray-50">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.status === 'completed' ? (
                          <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        ) : r.status === 'partial' ? (
                          <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        ) : r.status === 'failed' ? (
                          <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                        ) : (
                          <Loader2 className="w-3 h-3 text-blue-500 animate-spin flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {new Date(r.started_at).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {r.trigger_type}
                        </Badge>
                      </div>
                      <div className="text-gray-600 ml-2 flex-shrink-0">
                        {r.properties_scored}/{r.properties_scanned}
                        {r.errors_encountered > 0 && (
                          <span className="text-red-500 ml-1">({r.errors_encountered} err)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-gray-500 leading-relaxed">
              <Clock className="w-3 h-3 inline mr-1" />
              Automatically runs nightly at 2 AM (UTC) via pg_cron. Properties are scored in
              batches of 5. Stale = scored more than {STALE_DAYS} days ago.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
