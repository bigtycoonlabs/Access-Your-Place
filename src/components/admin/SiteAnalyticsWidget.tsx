import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import {
  BarChart3,
  Eye,
  Users,
  TrendingUp,
  Globe,
  ArrowRight,
  RefreshCw,
  LineChart as LineChartIcon,
} from 'lucide-react';

interface Summary {
  total_sessions: number;
  total_pageviews: number;
  logged_in_sessions: number;
  avg_pages_per_session: number;
}
interface TopPage { path: string; views: number; unique_sessions: number; }
interface TopSource { source: string; sessions: number; }
interface DailyPoint { date: string; sessions: number; views: number; }
interface FunnelStage { stage: string; sessions: number; }

interface AnalyticsResponse {
  ok: boolean;
  days: number;
  summary: Summary;
  topPages: TopPage[];
  topSources: TopSource[];
  dailySeries: DailyPoint[];
  funnel: FunnelStage[];
  error?: string;
}

const RANGE_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
];

export function SiteAnalyticsWidget() {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (rangeDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('get-site-analytics', {
        body: { days: rangeDays },
      });
      if (err) throw err;
      if (!res?.ok) throw new Error(res?.error || 'Failed to load analytics');
      setData(res as AnalyticsResponse);
    } catch (e: any) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); }, [days]);

  const maxDaily = useMemo(() => {
    if (!data?.dailySeries?.length) return 1;
    return Math.max(1, ...data.dailySeries.map((d) => d.views));
  }, [data]);

  const maxFunnel = useMemo(() => {
    if (!data?.funnel?.length) return 1;
    return Math.max(1, ...data.funnel.map((s) => s.sessions));
  }, [data]);

  const maxSource = useMemo(() => {
    if (!data?.topSources?.length) return 1;
    return Math.max(1, ...data.topSources.map((s) => s.sessions));
  }, [data]);

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Site Analytics</CardTitle>
              <CardDescription>
                Self-hosted page-event tracking — pageviews, traffic sources, and conversion funnel.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-white p-0.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDays(opt.value as 7 | 30)}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    days === opt.value
                      ? 'bg-amber-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(days)}
              disabled={loading}
              aria-label="Refresh analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Users className="w-4 h-4 text-amber-600" />}
            label="Sessions"
            value={data?.summary?.total_sessions}
            loading={loading}
          />
          <StatCard
            icon={<Eye className="w-4 h-4 text-amber-600" />}
            label="Pageviews"
            value={data?.summary?.total_pageviews}
            loading={loading}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
            label="Pages / session"
            value={data?.summary?.avg_pages_per_session}
            loading={loading}
            format="decimal"
          />
          <StatCard
            icon={<Globe className="w-4 h-4 text-amber-600" />}
            label="Logged-in sessions"
            value={data?.summary?.logged_in_sessions}
            loading={loading}
          />
        </div>

        {/* Daily traffic mini chart */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <LineChartIcon className="w-4 h-4" /> Daily traffic
          </h3>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="border rounded-md p-3 bg-white">
              <div className="flex items-end gap-1 h-28">
                {data?.dailySeries?.map((d) => {
                  const heightPct = Math.max(2, (d.views / maxDaily) * 100);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                      <div
                        className="w-full bg-gradient-to-t from-amber-500 to-amber-300 rounded-t hover:from-amber-600 hover:to-amber-400 transition-colors"
                        style={{ height: `${heightPct}%` }}
                        title={`${d.date}: ${d.views} views, ${d.sessions} sessions`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                <span>{data?.dailySeries?.[0]?.date}</span>
                <span>{data?.dailySeries?.[data.dailySeries.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Top pages */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Top pages</h3>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : data?.topPages?.length ? (
              <ul className="space-y-1.5" role="list">
                {data.topPages.map((p) => (
                  <li
                    key={p.path}
                    className="flex items-center justify-between gap-3 text-sm bg-white border rounded-md px-3 py-2"
                  >
                    <span className="truncate font-mono text-xs text-gray-800" title={p.path}>
                      {p.path}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">
                        {p.unique_sessions} sess
                      </Badge>
                      <span className="font-semibold text-amber-700 tabular-nums">
                        {p.views.toLocaleString()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No pageviews yet in this window.</p>
            )}
          </section>

          {/* Traffic sources */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Traffic sources</h3>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : data?.topSources?.length ? (
              <ul className="space-y-1.5" role="list">
                {data.topSources.map((s) => {
                  const pct = Math.round((s.sessions / maxSource) * 100);
                  return (
                    <li key={s.source} className="text-sm bg-white border rounded-md px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="truncate" title={s.source}>{s.source}</span>
                        <span className="font-semibold text-amber-700 tabular-nums">
                          {s.sessions.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No sessions recorded yet.</p>
            )}
          </section>
        </div>

        {/* Conversion funnel */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Conversion funnel</h3>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : data?.funnel?.length ? (
            <div className="space-y-2">
              {data.funnel.map((stage, i) => {
                const width = Math.max(4, (stage.sessions / maxFunnel) * 100);
                const prev = i > 0 ? data.funnel[i - 1].sessions : null;
                const conv = prev && prev > 0
                  ? Math.round((stage.sessions / prev) * 1000) / 10
                  : null;
                return (
                  <div key={stage.stage} className="bg-white border rounded-md p-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 flex items-center gap-1.5">
                        {i > 0 && <ArrowRight className="w-3 h-3 text-gray-400" />}
                        {stage.stage}
                      </span>
                      <span className="flex items-center gap-2">
                        {conv !== null && (
                          <span className="text-gray-500">{conv}% conv.</span>
                        )}
                        <span className="font-semibold text-amber-700 tabular-nums">
                          {stage.sessions.toLocaleString()}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-700"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No funnel data yet.</p>
          )}
        </section>

        <p className="text-[11px] text-gray-400">
          Data captured by the in-app tracker writing to <code>page_events</code>. Custom events like
          <code className="mx-1">deal_inquiry_submitted</code>,
          <code className="mx-1">investor_registered</code>, and
          <code className="ml-1">investor_logged_in</code> drive the funnel — call
          <code className="ml-1">trackEvent()</code> from your code to add more.
        </p>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
  format,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  format?: 'decimal';
}) {
  return (
    <div className="border rounded-md bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div className="text-2xl font-bold text-gray-900 tabular-nums">
          {value === undefined || value === null
            ? '—'
            : format === 'decimal'
              ? value.toFixed(2)
              : value.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default SiteAnalyticsWidget;
