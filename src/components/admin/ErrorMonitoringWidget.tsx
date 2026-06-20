import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, Shield, Clock, Database, Wifi, WifiOff, 
  RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle,
  Zap, Server, Eye, EyeOff, Trash2, Bell,
  Mail, Play, CalendarClock, FileBarChart, ArrowUpRight, ArrowDownRight, Minus,
  Copy, Download, Send, CheckCheck, BarChart3
} from 'lucide-react';


import { errorTracker, TrackedError, ErrorCategory, ErrorType } from '@/services/ErrorTrackingService';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface ErrorMonitoringWidgetProps {
  staffId?: string;
  staffName?: string;
}

interface AlertLogEntry {
  id: string;
  alert_type: string;
  alert_key: string;
  function_name: string | null;
  error_category: string | null;
  error_count: number;
  details: { severity?: string; title?: string; description?: string };
  email_sent_to: string[];
  created_at: string;
}

interface DigestEntry {
  id: string;
  digest_date: string;
  total_errors: number;
  auto_resolved_count: number;
  deleted_count: number;
  top_functions: Array<{ name: string; count: number; category?: string }>;
  category_breakdown: Record<string, number>;
  comparison_vs_previous: {
    today_total?: number;
    yesterday_total?: number;
    change_pct?: number;
    today_unresolved?: number;
    new_functions_failing?: string[];
  };
  email_sent: boolean;
  email_sent_to: string[] | null;
  created_at: string;
}

type ViewTab = 'errors' | 'alerts' | 'digest';

// ═══ SPARKLINE COMPONENT ═══
function MiniSparkline({ data, color, height = 32, width = 120 }: { data: number[]; color: string; height?: number; width?: number }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const step = width / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4)}`).join(' ');
  const areaPoints = `0,${height} ${points} ${(data.length - 1) * step},${height}`;
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polygon points={areaPoints} fill={color} opacity="0.15" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.length > 0 && data[data.length - 1] > 0 && (
        <circle cx={(data.length - 1) * step} cy={height - (data[data.length - 1] / max) * (height - 4)} r="2.5" fill={color} />
      )}
    </svg>
  );
}

interface CronExecution {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: string;
  result: any;
  error_message: string | null;
}

export function ErrorMonitoringWidget({ staffId, staffName }: ErrorMonitoringWidgetProps) {
  const [errors, setErrors] = useState<TrackedError[]>([]);
  const [dbErrors, setDbErrors] = useState<TrackedError[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeWindow, setTimeWindow] = useState<'1h' | '24h'>('24h');
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | 'all'>('all');
  const [activeTab, setActiveTab] = useState<ViewTab>('errors');
  const [recentAlerts, setRecentAlerts] = useState<AlertLogEntry[]>([]);
  const [latestDigest, setLatestDigest] = useState<DigestEntry | null>(null);
  const [cronExecutions, setCronExecutions] = useState<CronExecution[]>([]);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [runningThresholdCheck, setRunningThresholdCheck] = useState(false);
  const [resolvingAll, setResolvingAll] = useState(false);
  const { toast } = useToast();

  const loadErrors = useCallback(async () => {
    const localErrors = timeWindow === '1h' 
      ? errorTracker.getErrorsInLastHour() 
      : errorTracker.getErrorsInLast24Hours();
    setErrors(localErrors);
    setLoading(true);
    try {
      const hours = timeWindow === '1h' ? 1 : 24;
      const persisted = await errorTracker.fetchPersistedErrors(hours);
      setDbErrors(persisted);
    } catch {
      setDbErrors([]);
    }
    setLoading(false);
  }, [timeWindow]);

  const loadAlerts = useCallback(async () => {
    try {
      const { data } = await supabase.from('error_alert_log').select('*').order('created_at', { ascending: false }).limit(20);
      setRecentAlerts(data || []);
    } catch { setRecentAlerts([]); }
  }, []);

  const loadDigest = useCallback(async () => {
    try {
      const { data } = await supabase.from('error_digest_log').select('*').order('digest_date', { ascending: false }).limit(1);
      setLatestDigest(data && data.length > 0 ? data[0] : null);
    } catch { setLatestDigest(null); }
  }, []);

  const loadCronStatus = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('cron_execution_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      setCronExecutions(data || []);
    } catch { setCronExecutions([]); }
  }, []);

  useEffect(() => {
    loadErrors(); loadAlerts(); loadDigest(); loadCronStatus();
    const unsubscribe = errorTracker.subscribe(loadErrors);
    const interval = setInterval(() => { loadErrors(); loadAlerts(); }, 30000);
    return () => { unsubscribe(); clearInterval(interval); };
  }, [loadErrors, loadAlerts, loadDigest, loadCronStatus]);


  // ═══ MERGED ERROR POOL (local + DB, deduplicated, UNFILTERED) ═══
  // This is the single source of truth for all export/analysis methods.
  // It includes resolved errors and all categories so that CSV, copy,
  // sparklines, and comparison badge all operate on the complete dataset.
  const mergedAllErrors = useMemo(() => {
    const merged = new Map<string, TrackedError>();
    errors.forEach(e => merged.set(e.id, e));
    dbErrors.forEach(e => {
      if (!merged.has(e.id)) {
        const isDupe = Array.from(merged.values()).some(
          existing => existing.function_name === e.function_name && 
            Math.abs(new Date(existing.created_at).getTime() - new Date(e.created_at).getTime()) < 5000
        );
        if (!isDupe) merged.set(e.id, e);
      }
    });
    return Array.from(merged.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [errors, dbErrors]);

  // ═══ FILTERED VIEW (for the error list display only) ═══
  const allErrors = useMemo(() => {
    let result = [...mergedAllErrors];
    if (!showResolved) result = result.filter(e => !e.resolved);
    if (selectedCategory !== 'all') result = result.filter(e => e.error_category === selectedCategory);
    return result;
  }, [mergedAllErrors, showResolved, selectedCategory]);

  // Counts
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  const now = Date.now();
  const lastHourCount = mergedAllErrors.filter(e => now - new Date(e.created_at).getTime() < hourMs && !e.resolved).length;
  const last24hCount = mergedAllErrors.filter(e => now - new Date(e.created_at).getTime() < dayMs && !e.resolved).length;

  const categoryCounts = useMemo(() => {
    const windowMs = timeWindow === '1h' ? hourMs : dayMs;
    const counts: Record<string, number> = { auth: 0, timeout: 0, db: 0, network: 0, parse: 0, unknown: 0 };
    mergedAllErrors.filter(e => now - new Date(e.created_at).getTime() < windowMs && !e.resolved)
      .forEach(e => { counts[e.error_category] = (counts[e.error_category] || 0) + 1; });
    return counts;
  }, [mergedAllErrors, timeWindow, now]);

  const typeCounts = useMemo(() => {
    const windowMs = timeWindow === '1h' ? hourMs : dayMs;
    const counts: Record<string, number> = { edge_function: 0, realtime: 0, db_query: 0, auth: 0, timeout: 0, unknown: 0 };
    mergedAllErrors.filter(e => now - new Date(e.created_at).getTime() < windowMs && !e.resolved)
      .forEach(e => { counts[e.error_type] = (counts[e.error_type] || 0) + 1; });
    return counts;
  }, [mergedAllErrors, timeWindow, now]);

  // ═══ PERIOD COMPARISON (uses merged pool) ═══
  const comparison = useMemo(() => {
    const windowMs = timeWindow === '1h' ? hourMs : dayMs;
    return errorTracker.getPeriodComparison(windowMs, mergedAllErrors);
  }, [timeWindow, mergedAllErrors]);

  // ═══ HOURLY TREND DATA (uses merged pool) ═══
  const trendData = useMemo(() => {
    return errorTracker.getHourlyTrend(24, mergedAllErrors);
  }, [mergedAllErrors]);


  const handleResolve = async (errorId: string) => {
    await errorTracker.resolveError(errorId, staffName || 'Staff');
    loadErrors();
  };

  const handleClearLocal = () => { errorTracker.clearErrors(); loadErrors(); };

  // ═══ MARK ALL RESOLVED ═══
  const handleResolveAll = async () => {
    setResolvingAll(true);
    const windowMs = timeWindow === '1h' ? hourMs : dayMs;
    const count = await errorTracker.resolveAllErrors(staffName || 'Staff', windowMs);
    toast({ title: 'All Errors Resolved', description: `${count} error(s) marked as resolved.` });
    loadErrors();
    setResolvingAll(false);
  };

  // ═══ DOWNLOAD CSV (uses merged pool) ═══
  const handleDownloadCSV = () => {
    const windowMs = timeWindow === '1h' ? hourMs : dayMs;
    const csv = errorTracker.formatErrorsAsCSV(windowMs, mergedAllErrors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${timeWindow}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // Count the actual rows in the CSV (header + data rows)
    const csvRowCount = csv.split('\n').length - 1; // subtract header
    toast({ title: 'CSV Downloaded', description: `Error report saved as CSV (${csvRowCount} rows).` });
  };

  // ═══ SHARE VIA EMAIL (uses merged pool) ═══
  const handleShareEmail = () => {
    const windowMs = timeWindow === '1h' ? hourMs : dayMs;
    const report = errorTracker.formatAllErrorsForCopy(windowMs, mergedAllErrors);
    const subject = encodeURIComponent(`Error Report - ${allErrors.length} errors (${timeWindow}) - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(report);
    // mailto: has a ~2000 char limit in some clients, truncate if needed
    const truncatedBody = body.length > 1800 ? body.slice(0, 1800) + encodeURIComponent('\n\n... [Report truncated - use CSV export for full data]') : body;
    window.open(`mailto:?subject=${subject}&body=${truncatedBody}`, '_blank');
    toast({ title: 'Email Composer Opened', description: 'Your email client should open with the error report pre-filled.' });
  };

  // ═══ COPY ALL ERRORS (uses merged pool) ═══
  const handleCopyAll = () => {
    const windowMs = timeWindow === '1h' ? 3600000 : 86400000;
    const report = errorTracker.formatAllErrorsForCopy(windowMs, mergedAllErrors);
    // Count actual errors in the report (not the filtered view count)
    const reportIsEmpty = report === 'No errors in the selected time window.';
    const exportedCount = reportIsEmpty ? 0 : allErrors.length;
    navigator.clipboard.writeText(report).then(() => {
      toast({ title: 'All Errors Copied', description: reportIsEmpty ? 'No unresolved errors to copy.' : `${exportedCount} error(s) copied to clipboard as a formatted report.` });
    }).catch(() => {
      const w = window.open('', '_blank');
      if (w) { w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap;padding:20px;">${report.replace(/</g, '&lt;')}</pre>`); w.document.title = 'Error Report'; }
      toast({ title: 'Clipboard unavailable', description: 'Error report opened in a new tab.', variant: 'destructive' });
    });
  };


  const handleRunCleanup = async () => {
    setRunningCleanup(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-error-logs', { body: {} });
      if (error) throw error;
      toast({ title: 'Cleanup Complete', description: `Auto-resolved: ${data?.cleanup?.auto_resolved || 0}, Deleted: ${data?.cleanup?.deleted || 0}.` });
      loadErrors(); loadDigest();
    } catch (err: any) { toast({ title: 'Cleanup Failed', description: err.message, variant: 'destructive' }); }
    setRunningCleanup(false);
  };

  const handleRunThresholdCheck = async () => {
    setRunningThresholdCheck(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-error-thresholds', { body: {} });
      if (error) throw error;
      const alertCount = data?.alerts_new || 0;
      toast({ title: 'Threshold Check Complete', description: alertCount > 0 ? `${alertCount} new alert(s).` : `No breaches. ${data?.errors_in_window || 0} errors.` });
      loadAlerts();
    } catch (err: any) { toast({ title: 'Threshold Check Failed', description: err.message, variant: 'destructive' }); }
    setRunningThresholdCheck(false);
  };

  const getCategoryIcon = (category: ErrorCategory) => {
    switch (category) {
      case 'auth': return <Shield className="w-3.5 h-3.5" />;
      case 'timeout': return <Clock className="w-3.5 h-3.5" />;
      case 'db': return <Database className="w-3.5 h-3.5" />;
      case 'network': return <WifiOff className="w-3.5 h-3.5" />;
      case 'parse': return <Zap className="w-3.5 h-3.5" />;
      default: return <AlertTriangle className="w-3.5 h-3.5" />;
    }
  };

  const getCategoryColor = (category: ErrorCategory) => {
    switch (category) {
      case 'auth': return 'bg-red-100 text-red-700 border-red-200';
      case 'timeout': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'db': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'network': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'parse': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeIcon = (type: ErrorType) => {
    switch (type) {
      case 'edge_function': return <Server className="w-3.5 h-3.5" />;
      case 'realtime': return <Wifi className="w-3.5 h-3.5" />;
      case 'db_query': return <Database className="w-3.5 h-3.5" />;
      default: return <AlertTriangle className="w-3.5 h-3.5" />;
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = now - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const totalActive = timeWindow === '1h' ? lastHourCount : last24hCount;
  const hasErrors = totalActive > 0;
  const recentCriticalAlerts = recentAlerts.filter(a => a.details?.severity === 'critical' && (now - new Date(a.created_at).getTime()) < dayMs);

  const severityClass = recentCriticalAlerts.length > 0 ? 'border-red-300' : totalActive === 0 ? 'border-green-200' : totalActive <= 5 ? 'border-amber-300' : 'border-red-300';
  const severityBg = recentCriticalAlerts.length > 0 ? 'bg-gradient-to-r from-red-50 to-rose-50' : totalActive === 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50' : totalActive <= 5 ? 'bg-gradient-to-r from-amber-50 to-orange-50' : 'bg-gradient-to-r from-red-50 to-rose-50';

  return (
    <Card className={`${severityClass} ${severityBg} shadow-sm`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalActive === 0 && recentCriticalAlerts.length === 0 ? 'bg-green-100' : totalActive <= 5 && recentCriticalAlerts.length === 0 ? 'bg-amber-100' : 'bg-red-100'}`}>
              {totalActive === 0 && recentCriticalAlerts.length === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className={`w-5 h-5 ${totalActive <= 5 && recentCriticalAlerts.length === 0 ? 'text-amber-600' : 'text-red-600'}`} />
              )}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                Infrastructure Health Monitor
                {hasErrors && (
                  <Badge className={`${totalActive <= 5 ? 'bg-amber-500' : 'bg-red-500'} text-white`}>
                    {totalActive} {totalActive === 1 ? 'issue' : 'issues'}
                  </Badge>
                )}
                {!hasErrors && recentCriticalAlerts.length === 0 && (
                  <Badge className="bg-green-500 text-white">All Clear</Badge>
                )}
                {recentCriticalAlerts.length > 0 && (
                  <Badge className="bg-red-600 text-white animate-pulse">
                    {recentCriticalAlerts.length} Alert{recentCriticalAlerts.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {/* ═══ COMPARISON BADGE ═══ */}
                {comparison.trend !== 'flat' && (
                  <Badge className={`text-[10px] px-1.5 py-0.5 gap-0.5 ${
                    comparison.trend === 'up' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'
                  }`}>
                    {comparison.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(comparison.changePercent)}% vs prev {timeWindow === '1h' ? 'hour' : 'day'}
                  </Badge>
                )}
                {comparison.trend === 'flat' && comparison.current === 0 && comparison.previous === 0 && null}
              </CardTitle>
              <CardDescription className={totalActive === 0 && recentCriticalAlerts.length === 0 ? 'text-green-700' : totalActive <= 5 && recentCriticalAlerts.length === 0 ? 'text-amber-700' : 'text-red-700'}>
                {recentCriticalAlerts.length > 0
                  ? `${recentCriticalAlerts.length} critical alert(s) triggered in the last 24h`
                  : totalActive === 0 
                    ? 'No errors detected in the selected time window'
                    : `${totalActive} error${totalActive !== 1 ? 's' : ''} detected — click to view details`
                }
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button onClick={() => setTimeWindow('1h')} className={`px-3 py-1.5 transition-colors ${timeWindow === '1h' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                1h{lastHourCount > 0 && <span className="ml-1 text-[10px] opacity-80">({lastHourCount})</span>}
              </button>
              <button onClick={() => setTimeWindow('24h')} className={`px-3 py-1.5 transition-colors ${timeWindow === '24h' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                24h{last24hCount > 0 && <span className="ml-1 text-[10px] opacity-80">({last24hCount})</span>}
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { loadErrors(); loadAlerts(); loadDigest(); }} disabled={loading} className="h-8 w-8 p-0">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="h-8 w-8 p-0">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Summary Stats Row */}
      <CardContent className="pt-0 pb-3">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {(['auth', 'timeout', 'db', 'network', 'parse', 'all'] as const).map(cat => {
            const count = cat === 'all' ? totalActive : categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat && activeTab === 'errors';
            const colorMap: Record<string, { ring: string; bg: string; text: string; icon: string }> = {
              auth: { ring: 'ring-red-400', bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: 'text-red-500' },
              timeout: { ring: 'ring-amber-400', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
              db: { ring: 'ring-purple-400', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', icon: 'text-purple-500' },
              network: { ring: 'ring-orange-400', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
              parse: { ring: 'ring-blue-400', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
              all: { ring: 'ring-gray-400', bg: 'bg-white border-gray-100', text: 'text-gray-700', icon: 'text-gray-600' },
            };
            const c = colorMap[cat] || colorMap.all;
            const icons: Record<string, React.ReactNode> = {
              auth: <Shield className={`w-3.5 h-3.5 ${count > 0 ? c.icon : 'text-gray-400'}`} />,
              timeout: <Clock className={`w-3.5 h-3.5 ${count > 0 ? c.icon : 'text-gray-400'}`} />,
              db: <Database className={`w-3.5 h-3.5 ${count > 0 ? c.icon : 'text-gray-400'}`} />,
              network: <WifiOff className={`w-3.5 h-3.5 ${count > 0 ? c.icon : 'text-gray-400'}`} />,
              parse: <Zap className={`w-3.5 h-3.5 ${count > 0 ? c.icon : 'text-gray-400'}`} />,
              all: <AlertTriangle className={`w-3.5 h-3.5 ${count > 0 ? c.icon : 'text-gray-400'}`} />,
            };
            const label = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
            return (
              <button key={cat} onClick={() => { setSelectedCategory(cat === 'all' ? 'all' : cat as ErrorCategory); setActiveTab('errors'); setExpanded(true); }}
                className={`flex items-center gap-1.5 p-2 rounded-lg border transition-all hover:shadow-sm ${isSelected ? `ring-2 ${c.ring}` : ''} ${count > 0 ? c.bg : 'bg-white border-gray-100'}`}>
                {icons[cat]}
                <div className="text-left">
                  <p className={`text-sm font-bold ${count > 0 ? c.text : 'text-gray-400'}`}>{count}</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Source Type Breakdown */}
        {hasErrors && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200/60">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Sources:</span>
            {typeCounts.edge_function > 0 && <div className="flex items-center gap-1 text-xs text-gray-600"><Server className="w-3 h-3 text-indigo-500" /><span><span className="font-semibold">{typeCounts.edge_function}</span> Edge Fn</span></div>}
            {typeCounts.realtime > 0 && <div className="flex items-center gap-1 text-xs text-gray-600"><Wifi className="w-3 h-3 text-cyan-500" /><span><span className="font-semibold">{typeCounts.realtime}</span> Realtime</span></div>}
            {typeCounts.db_query > 0 && <div className="flex items-center gap-1 text-xs text-gray-600"><Database className="w-3 h-3 text-purple-500" /><span><span className="font-semibold">{typeCounts.db_query}</span> DB Query</span></div>}
          </div>
        )}

        {/* ═══ SPARKLINE TREND CHARTS ═══ */}
        {trendData.some(d => d.total > 0) && (
          <div className="mt-3 pt-3 border-t border-gray-200/60">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">24h Error Trend by Category</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {([
                { key: 'total', label: 'Total', color: '#6b7280' },
                { key: 'auth', label: 'Auth', color: '#ef4444' },
                { key: 'timeout', label: 'Timeout', color: '#f59e0b' },
                { key: 'db', label: 'DB', color: '#8b5cf6' },
                { key: 'network', label: 'Network', color: '#f97316' },
                { key: 'parse', label: 'Parse', color: '#3b82f6' },
              ] as const).map(({ key, label, color }) => {
                const series = trendData.map(d => d[key]);
                const sum = series.reduce((a, b) => a + b, 0);
                if (sum === 0 && key !== 'total') return null;
                return (
                  <div key={key} className="flex items-center gap-2 p-1.5 bg-white/60 rounded-lg border border-gray-100">
                    <MiniSparkline data={series} color={color} height={24} width={80} />
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-500 truncate">{label}</p>
                      <p className="text-xs font-semibold" style={{ color }}>{sum}</p>
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        )}
      </CardContent>

      {/* Expanded Detail View */}
      {expanded && (
        <CardContent className="pt-0 border-t border-gray-200/60">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 pt-3 mb-3 border-b border-gray-200/60 pb-2">
            <button onClick={() => setActiveTab('errors')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'errors' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <AlertTriangle className="w-3 h-3" /> Error Log
              {totalActive > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'errors' ? 'bg-white/20' : 'bg-red-100 text-red-700'}`}>{totalActive}</span>}
            </button>
            <button onClick={() => setActiveTab('alerts')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'alerts' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Bell className="w-3 h-3" /> Alerts
              {recentCriticalAlerts.length > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'alerts' ? 'bg-white/20' : 'bg-red-100 text-red-700'}`}>{recentCriticalAlerts.length}</span>}
            </button>
            <button onClick={() => setActiveTab('digest')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'digest' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <FileBarChart className="w-3 h-3" /> Digest & Cleanup
            </button>
          </div>

          {/* ═══ ERRORS TAB ═══ */}
          {activeTab === 'errors' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Showing {allErrors.length} error{allErrors.length !== 1 ? 's' : ''}
                    {selectedCategory !== 'all' && ` (${selectedCategory})`}
                  </span>
                  {selectedCategory !== 'all' && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCategory('all')} className="h-6 text-xs px-2">Clear filter</Button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* ═══ EXPORT BUTTONS ═══ */}
                  {allErrors.length > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCopyAll} className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                        <Copy className="w-3 h-3" /> Copy All ({allErrors.length})
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                        <Download className="w-3 h-3" /> CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleShareEmail} className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50">
                        <Send className="w-3 h-3" /> Email
                      </Button>
                    </>
                  )}
                  {/* ═══ MARK ALL RESOLVED ═══ */}
                  {allErrors.filter(e => !e.resolved).length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleResolveAll} disabled={resolvingAll}
                      className="h-7 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50">
                      {resolvingAll ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                      Resolve All
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowResolved(!showResolved)} className="h-7 text-xs gap-1">
                    {showResolved ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showResolved ? 'Hide' : 'Show'} resolved
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClearLocal} className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" /> Clear local
                  </Button>
                </div>
              </div>

              {/* Error List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {allErrors.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No errors to display</p>
                    <p className="text-xs text-gray-400 mt-1">{selectedCategory !== 'all' ? 'Try clearing the filter' : 'All systems operating normally'}</p>
                  </div>
                ) : (
                  allErrors.slice(0, 50).map((error) => (
                    <div key={error.id} className={`p-3 rounded-lg border transition-all ${error.resolved ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="mt-0.5 flex-shrink-0">{getTypeIcon(error.error_type)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-medium text-gray-900 truncate">{error.function_name}</span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${getCategoryColor(error.error_category)}`}>
                                {getCategoryIcon(error.error_category)}<span className="ml-1">{error.error_category}</span>
                              </Badge>
                              {error.http_status && <Badge variant="outline" className="text-[10px] px-1.5 py-0">HTTP {error.http_status}</Badge>}
                              {error.resolved && <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">Resolved</Badge>}
                            </div>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2 break-all">{error.error_message}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                              <span>{formatTime(error.created_at)}</span>
                              {error.staff_name && <span>by {error.staff_name}</span>}
                              {error.page_context && <span>on {error.page_context}</span>}
                            </div>
                          </div>
                        </div>
                        {!error.resolved && (
                          <Button variant="ghost" size="sm" onClick={() => handleResolve(error.id)} className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 flex-shrink-0" title="Mark as resolved">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {allErrors.length > 50 && <p className="text-center text-xs text-gray-400 py-2">Showing 50 of {allErrors.length} errors</p>}
              </div>

              {/* Top Failing Functions */}
              {allErrors.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200/60">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Top Failing Functions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {errorTracker.getTopFailingFunctions(6, timeWindow === '1h' ? 3600000 : 86400000, mergedAllErrors).map((fn, idx) => (

                      <div key={fn.name} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-red-100 text-red-700' : idx === 1 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{fn.count}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono font-medium truncate">{fn.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{fn.lastError}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ ALERTS TAB ═══ */}
          {activeTab === 'alerts' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">{recentAlerts.length} alert{recentAlerts.length !== 1 ? 's' : ''} sent</span>
                <Button variant="outline" size="sm" onClick={handleRunThresholdCheck} disabled={runningThresholdCheck} className="h-7 text-xs gap-1.5">
                  {runningThresholdCheck ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Run Threshold Check Now
                </Button>
              </div>

              <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-indigo-500" />Proactive Alerting Rules (every 15 min)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-start gap-2 p-2 bg-red-50 rounded-md border border-red-100">
                    <div className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center flex-shrink-0 mt-0.5"><AlertTriangle className="w-3 h-3 text-red-700" /></div>
                    <div><p className="text-[11px] font-semibold text-red-800">Threshold Breach</p><p className="text-[10px] text-red-600">10+ errors of same type in 15 min</p></div>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-orange-50 rounded-md border border-orange-100">
                    <div className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0 mt-0.5"><XCircle className="w-3 h-3 text-orange-700" /></div>
                    <div><p className="text-[11px] font-semibold text-orange-800">Total Failure</p><p className="text-[10px] text-orange-600">5+ consecutive failures for a function in 1h</p></div>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md border border-amber-100">
                    <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5"><Shield className="w-3 h-3 text-amber-700" /></div>
                    <div><p className="text-[11px] font-semibold text-amber-800">Auth Error</p><p className="text-[10px] text-amber-600">Any JWT/session auth failures detected</p></div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Duplicate alerts are suppressed for 2 hours per issue.</p>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {recentAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No alerts triggered yet</p>
                  </div>
                ) : recentAlerts.map((alert) => {
                  const severity = alert.details?.severity || 'info';
                  const severityStyles = severity === 'critical' ? 'border-l-red-500 bg-red-50/50' : severity === 'warning' ? 'border-l-amber-500 bg-amber-50/50' : 'border-l-blue-500 bg-blue-50/50';
                  const severityBadge = severity === 'critical' ? 'bg-red-100 text-red-700' : severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
                  return (
                    <div key={alert.id} className={`p-3 rounded-lg border border-l-4 ${severityStyles}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge className={`text-[10px] px-1.5 py-0 ${severityBadge}`}>{severity.toUpperCase()}</Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{alert.alert_type.replace(/_/g, ' ')}</Badge>
                            {alert.error_count > 0 && <span className="text-[10px] font-semibold text-gray-600">{alert.error_count} errors</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-900">{alert.details?.title || alert.alert_type}</p>
                          {alert.function_name && <p className="text-xs text-gray-500 mt-0.5">Function: <code className="bg-gray-100 px-1 rounded text-[11px]">{alert.function_name}</code></p>}
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                            <span>{formatTime(alert.created_at)}</span>
                            {alert.email_sent_to?.length > 0 && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />Sent to {alert.email_sent_to.length}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══ DIGEST & CLEANUP TAB ═══ */}
          {activeTab === 'digest' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-500">Automated maintenance & reporting</span>
                <Button variant="outline" size="sm" onClick={handleRunCleanup} disabled={runningCleanup} className="h-7 text-xs gap-1.5">
                  {runningCleanup ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Run Cleanup & Digest Now
                </Button>
              </div>

              <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-indigo-500" />Automated Schedule</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-md border border-blue-100"><p className="text-[11px] font-semibold text-blue-800">Auto-Resolve</p><p className="text-[10px] text-blue-600 mt-0.5">Errors older than 7 days auto-resolved (daily 6 AM UTC)</p></div>
                  <div className="p-2.5 bg-purple-50 rounded-md border border-purple-100"><p className="text-[11px] font-semibold text-purple-800">Auto-Delete</p><p className="text-[10px] text-purple-600 mt-0.5">Entries older than 30 days permanently deleted</p></div>
                  <div className="p-2.5 bg-green-50 rounded-md border border-green-100"><p className="text-[11px] font-semibold text-green-800">Daily Digest Email</p><p className="text-[10px] text-green-600 mt-0.5">Top 5 failing functions + trend emailed daily</p></div>
                </div>
              </div>

              {latestDigest ? (
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><FileBarChart className="w-3.5 h-3.5 text-indigo-500" />Latest Digest: {latestDigest.digest_date}</h4>
                    {latestDigest.email_sent ? <Badge className="bg-green-100 text-green-700 text-[10px]"><Mail className="w-2.5 h-2.5 mr-1" />Emailed</Badge> : <Badge variant="outline" className="text-[10px]">Not emailed</Badge>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-center">
                      <p className="text-lg font-bold text-gray-800">{latestDigest.total_errors}</p><p className="text-[10px] text-gray-500">Total Errors</p>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-center">
                      {(() => {
                        const pct = latestDigest.comparison_vs_previous?.change_pct || 0;
                        const color = pct > 0 ? 'text-red-600' : pct < 0 ? 'text-green-600' : 'text-gray-500';
                        const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
                        return (<><p className={`text-lg font-bold ${color} flex items-center justify-center gap-0.5`}><Icon className="w-4 h-4" />{Math.abs(pct)}%</p><p className="text-[10px] text-gray-500">vs Previous Day</p></>);
                      })()}
                    </div>
                    <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100 text-center">
                      <p className="text-lg font-bold text-blue-700">{latestDigest.auto_resolved_count}</p><p className="text-[10px] text-gray-500">Auto-Resolved</p>
                    </div>
                    <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100 text-center">
                      <p className="text-lg font-bold text-purple-700">{latestDigest.deleted_count}</p><p className="text-[10px] text-gray-500">Deleted (30d+)</p>
                    </div>
                  </div>

                  {latestDigest.category_breakdown && Object.keys(latestDigest.category_breakdown).length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Category Breakdown</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(latestDigest.category_breakdown).sort(([,a], [,b]) => (b as number) - (a as number)).map(([cat, count]) => (
                          <Badge key={cat} className={`text-[10px] ${getCategoryColor(cat as ErrorCategory)}`}>{getCategoryIcon(cat as ErrorCategory)}<span className="ml-1 capitalize">{cat}: {count as number}</span></Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {latestDigest.top_functions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Top Failing Functions</p>
                      <div className="space-y-1">
                        {latestDigest.top_functions.map((fn, idx) => (
                          <div key={fn.name} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded border border-gray-100">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-red-100 text-red-700' : idx === 1 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{idx + 1}</div>
                            <code className="text-[11px] font-mono flex-1 truncate">{fn.name}</code>
                            <span className="text-[11px] font-semibold text-gray-700">{fn.count}x</span>
                            {fn.category && <Badge className={`text-[9px] px-1 py-0 ${getCategoryColor(fn.category as ErrorCategory)}`}>{fn.category}</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {latestDigest.comparison_vs_previous?.new_functions_failing?.length > 0 && (
                    <div className="mt-3 p-2.5 bg-red-50 rounded-md border border-red-200">
                      <p className="text-[11px] font-semibold text-red-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />New Functions Failing:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {latestDigest.comparison_vs_previous.new_functions_failing.map(fn => (
                          <code key={fn} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{fn}</code>
                        ))}
                      </div>
                    </div>
                  )}

                  {latestDigest.email_sent && latestDigest.email_sent_to?.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400">Digest emailed to: {latestDigest.email_sent_to.join(', ')}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                  <FileBarChart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No digest generated yet</p>
                  <p className="text-xs text-gray-400 mt-1">Click "Run Cleanup & Digest Now" to generate the first report</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
