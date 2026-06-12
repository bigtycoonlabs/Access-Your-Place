
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, Clock, TrendingUp, DollarSign, Timer, ChevronDown, ChevronUp } from 'lucide-react';

interface TimeEntry {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
}

interface TimeStats {
  total_minutes: number;
  total_hours: number;
  week_earnings: number;
  effective_hourly_rate: number;
  session_count: number;
}

interface TimeTrackerWidgetProps {
  staffId: string;
  compact?: boolean;
}

export function TimeTrackerWidget({ staffId, compact = false }: TimeTrackerWidgetProps) {
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [stopNotes, setStopNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    const [timerRes, statsRes, entriesRes] = await Promise.all([
      supabase.functions.invoke('manage-hr-commissions', { body: { action: 'get_active_timer', staff_id: staffId } }),
      supabase.functions.invoke('manage-hr-commissions', { body: { action: 'get_time_stats', staff_id: staffId } }),
      supabase.functions.invoke('manage-hr-commissions', { body: { action: 'get_time_entries', staff_id: staffId } })
    ]);
    if (timerRes.data?.entry) setActiveTimer(timerRes.data.entry);
    if (statsRes.data?.stats) setStats(statsRes.data.stats);
    if (entriesRes.data?.entries) setEntries(entriesRes.data.entries.slice(0, 20));
  }, [staffId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (activeTimer) {
      const updateElapsed = () => {
        const start = new Date(activeTimer.start_time).getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));
      };
      updateElapsed();
      intervalRef.current = setInterval(updateElapsed, 1000);
    } else {
      setElapsed(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTimer]);

  const startTimer = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'start_timer', staff_id: staffId }
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { setActiveTimer(data.entry); toast({ title: 'Timer Started', description: 'Clock is running.' }); }
    setLoading(false);
  };

  const stopTimer = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'stop_timer', staff_id: staffId, notes: stopNotes }
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else {
      setActiveTimer(null);
      setStopNotes('');
      toast({ title: 'Timer Stopped', description: `Session: ${data.entry.duration_minutes} minutes` });
      loadData();
    }
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Compact mode for header
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {activeTimer ? (
          <>
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-mono font-semibold text-red-700">{formatTime(elapsed)}</span>
            </div>
            <Button size="sm" variant="destructive" onClick={stopTimer} disabled={loading} className="h-8">
              <Square className="w-3 h-3 mr-1" /> Stop
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={startTimer} disabled={loading} className="h-8 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100">
            <Play className="w-3 h-3 mr-1" /> Clock In
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timer Control */}
      <Card className={activeTimer ? 'border-red-200 bg-gradient-to-r from-red-50 to-orange-50' : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                <Timer className={`w-5 h-5 ${activeTimer ? 'text-red-600' : 'text-emerald-600'}`} />
                <span className="font-semibold text-gray-700">
                  {activeTimer ? 'Timer Running' : 'Ready to Clock In'}
                </span>
                {activeTimer && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              </div>
              {activeTimer && (
                <p className="text-4xl font-mono font-bold text-red-700 tracking-wider">{formatTime(elapsed)}</p>
              )}
              {activeTimer && (
                <p className="text-xs text-gray-500 mt-1">
                  Started: {new Date(activeTimer.start_time).toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {activeTimer ? (
                <>
                  <Input
                    placeholder="Session notes (optional)"
                    value={stopNotes}
                    onChange={(e) => setStopNotes(e.target.value)}
                    className="w-48"
                  />
                  <Button onClick={stopTimer} disabled={loading} variant="destructive" className="w-48">
                    <Square className="w-4 h-4 mr-2" /> Stop Timer
                  </Button>
                </>
              ) : (
                <Button onClick={startTimer} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 w-48">
                  <Play className="w-4 h-4 mr-2" /> Start Timer
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ROI Calculator Widget */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_hours}h</p>
                  <p className="text-xs text-gray-500">Hours This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">${stats.week_earnings.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Earned This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700">${stats.effective_hourly_rate}/hr</p>
                  <p className="text-xs text-gray-500">Effective Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Timer className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.session_count}</p>
                  <p className="text-xs text-gray-500">Sessions This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Session History */}
      <Card>
        <CardHeader className="pb-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between w-full"
          >
            <CardTitle className="text-base">Session History</CardTitle>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No sessions recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {entries.filter(e => e.end_time).map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-gray-700">
                        {new Date(entry.start_time).toLocaleDateString()} 
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {entry.end_time ? new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Running'}
                      </p>
                      {entry.notes && <p className="text-xs text-gray-400 mt-0.5">{entry.notes}</p>}
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {entry.duration_minutes ? formatDuration(entry.duration_minutes) : '--'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
