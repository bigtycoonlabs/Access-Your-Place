import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, CreditCard, DollarSign, TrendingUp, TrendingDown,
  Plus, Minus, ArrowRight, Clock, AlertTriangle, CheckCircle,
  History, BarChart3, RefreshCw, Coins
} from 'lucide-react';

interface CreditHistoryEntry {
  id: string;
  action: string;
  details: string;
  amount_change?: number;
  new_balance?: number;
  staff_name?: string;
  reason?: string;
  created_at: string;
}

interface Props {
  investorId: string;
  investorName: string;
  currentBalance: number;
  onBalanceChanged: (newBalance: number) => void;
}

const QUICK_REASONS = [
  { label: 'Referral Bonus', value: 'referral bonus' },
  { label: 'Compensation', value: 'compensation' },
  { label: 'Property Search Used', value: 'property search used' },
  { label: 'Deal Acquisition', value: 'deal acquisition' },
  { label: 'Promotional Credit', value: 'promotional credit' },
  { label: 'Account Adjustment', value: 'account adjustment' },
  { label: 'Incomplete Acquisition Refund', value: 'incomplete acquisition refund' },
  { label: 'Loyalty Reward', value: 'loyalty reward' },
];

export function InvestorCreditsManager({ investorId, investorName, currentBalance, onBalanceChanged }: Props) {
  const [creditHistory, setCreditHistory] = useState<CreditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operation, setOperation] = useState<'set' | 'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [quickReason, setQuickReason] = useState('');
  const { toast } = useToast();

  const staffSession = JSON.parse(localStorage.getItem('staffSession') || '{}');
  const staffName = staffSession.first_name ? `${staffSession.first_name} ${staffSession.last_name || ''}`.trim() : staffSession.name || 'Staff';

  useEffect(() => {
    fetchCreditHistory();
  }, [investorId]);

  const fetchCreditHistory = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'get_credit_history', investor_id: investorId }
      });
      if (data?.history) {
        setCreditHistory(data.history);
      } else {
        // Fallback: try activity logs
        const { data: logs } = await supabase
          .from('investor_activity_logs')
          .select('*')
          .eq('investor_id', investorId)
          .or('action.ilike.%credit%,action.ilike.%Credit%')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (logs) {
          setCreditHistory(logs.map((l: any) => ({
            id: l.id,
            action: l.action || 'Credit Change',
            details: l.details || l.description || '',
            amount_change: l.metadata?.amount_change || l.metadata?.credits,
            new_balance: l.metadata?.new_balance,
            staff_name: l.metadata?.staff_name || l.performed_by,
            reason: l.metadata?.reason,
            created_at: l.created_at,
          })));
        }
      }
    } catch (err) {
      console.error('Failed to fetch credit history:', err);
    }
    setLoading(false);
  };

  const handleUpdateCredits = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    const finalReason = reason || quickReason || `${operation} credits`;

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: 'update_credits',
          investor_id: investorId,
          credits: amount,
          operation,
          reason: finalReason,
          staff_name: staffName
        }
      });
      if (error) throw error;

      const newBalance = data?.new_balance ?? currentBalance;
      onBalanceChanged(newBalance);
      toast({ title: 'Credits Updated', description: `New balance: ${newBalance} credits` });
      setAmount('');
      setReason('');
      setQuickReason('');
      fetchCreditHistory();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  // Calculate chart data (last 30 days of credit changes)
  const chartData = useMemo(() => {
    const last30 = creditHistory
      .filter(h => {
        const d = new Date(h.created_at);
        const now = new Date();
        return now.getTime() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
      })
      .reverse();

    if (last30.length === 0) return [];

    return last30.map(entry => ({
      date: new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: entry.new_balance || 0,
      change: entry.amount_change || 0,
    }));
  }, [creditHistory]);

  const maxBalance = Math.max(...chartData.map(d => d.balance), currentBalance, 10);

  // Low credit alert
  const isLowCredits = currentBalance <= 1;
  const isModerateCredits = currentBalance > 1 && currentBalance <= 3;

  return (
    <div className="space-y-6">
      {/* Balance Display */}
      <div className="p-5 bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] rounded-xl text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80 flex items-center gap-1">
              <Coins className="w-4 h-4" />
              Current Credit Balance
            </p>
            <p className="text-4xl font-bold mt-1">{currentBalance}</p>
            <p className="text-sm opacity-60 mt-1">credits available</p>
          </div>
          <div className="text-right">
            {isLowCredits && (
              <Badge className="bg-red-500 text-white animate-pulse">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Low Credits
              </Badge>
            )}
            {isModerateCredits && (
              <Badge className="bg-amber-500 text-white">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Running Low
              </Badge>
            )}
            {!isLowCredits && !isModerateCredits && currentBalance > 0 && (
              <Badge className="bg-green-500 text-white">
                <CheckCircle className="w-3 h-3 mr-1" />
                Healthy
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Low Credit Alert */}
      {isLowCredits && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Low Credit Alert</p>
            <p className="text-sm text-red-600 mt-1">
              {investorName} has {currentBalance} credit{currentBalance !== 1 ? 's' : ''} remaining. 
              Consider adding credits if they need to use property search or acquire deals.
            </p>
          </div>
        </div>
      )}

      {/* Credit Operations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#d4a574]" />
            Manage Credits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Operation Type Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={operation === 'set' ? 'default' : 'outline'}
              onClick={() => setOperation('set')}
              className={operation === 'set' ? 'bg-[#1a365d]' : ''}
              size="sm"
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              Set To
            </Button>
            <Button
              variant={operation === 'add' ? 'default' : 'outline'}
              onClick={() => setOperation('add')}
              className={operation === 'add' ? 'bg-green-600 hover:bg-green-700' : ''}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
            <Button
              variant={operation === 'subtract' ? 'default' : 'outline'}
              onClick={() => setOperation('subtract')}
              className={operation === 'subtract' ? 'bg-red-600 hover:bg-red-700' : ''}
              size="sm"
            >
              <Minus className="w-4 h-4 mr-1" />
              Subtract
            </Button>
          </div>

          {/* Amount and Reason */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
              {operation === 'set' && amount && (
                <p className="text-xs text-gray-500 mt-1">
                  Balance will be set to {amount} (currently {currentBalance})
                </p>
              )}
              {operation === 'add' && amount && (
                <p className="text-xs text-green-600 mt-1">
                  New balance: {currentBalance + (parseFloat(amount) || 0)}
                </p>
              )}
              {operation === 'subtract' && amount && (
                <p className="text-xs text-red-600 mt-1">
                  New balance: {Math.max(0, currentBalance - (parseFloat(amount) || 0))}
                </p>
              )}
            </div>
            <div>
              <Label>Quick Reason</Label>
              <Select value={quickReason} onValueChange={(v) => { setQuickReason(v); setReason(''); }}>
                <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {QUICK_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Custom Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => { setReason(e.target.value); setQuickReason(''); }}
              placeholder="Describe the reason for this credit change..."
            />
          </div>

          <Button
            onClick={handleUpdateCredits}
            disabled={saving || !amount}
            className={`w-full ${
              operation === 'add' ? 'bg-green-600 hover:bg-green-700' :
              operation === 'subtract' ? 'bg-red-600 hover:bg-red-700' :
              'bg-[#1a365d] hover:bg-[#2d4a7c]'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : operation === 'add' ? (
              <Plus className="w-4 h-4 mr-2" />
            ) : operation === 'subtract' ? (
              <Minus className="w-4 h-4 mr-2" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            {operation === 'set' ? 'Set Credits' : operation === 'add' ? 'Add Credits' : 'Subtract Credits'}
          </Button>
        </CardContent>
      </Card>

      {/* Credit Usage Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#d4a574]" />
              Credit Balance (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-end gap-1">
              {chartData.map((d, i) => {
                const height = Math.max(4, (d.balance / maxBalance) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.balance} credits (${d.change >= 0 ? '+' : ''}${d.change})`}>
                    <div
                      className={`w-full rounded-t transition-all ${
                        d.change > 0 ? 'bg-green-400' : d.change < 0 ? 'bg-red-400' : 'bg-blue-400'
                      }`}
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    />
                    {chartData.length <= 10 && (
                      <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.date}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-400" /> Added</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-400" /> Subtracted</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-400" /> Set</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credit History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-5 h-5 text-[#d4a574]" />
              Credit History
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchCreditHistory}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" />
            </div>
          ) : creditHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No credit history yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[250px]">
              <div className="space-y-3">
                {creditHistory.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      (entry.amount_change || 0) > 0 ? 'bg-green-100' :
                      (entry.amount_change || 0) < 0 ? 'bg-red-100' :
                      'bg-blue-100'
                    }`}>
                      {(entry.amount_change || 0) > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (entry.amount_change || 0) < 0 ? (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{entry.action}</p>
                        {entry.amount_change != null && (
                          <Badge className={`text-xs ${
                            entry.amount_change > 0 ? 'bg-green-100 text-green-800' :
                            entry.amount_change < 0 ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {entry.amount_change > 0 ? '+' : ''}{entry.amount_change}
                          </Badge>
                        )}
                      </div>
                      {(entry.reason || entry.details) && (
                        <p className="text-xs text-gray-600 mt-0.5">{entry.reason || entry.details}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(entry.created_at).toLocaleString()}</span>
                        {entry.staff_name && (
                          <>
                            <span>by</span>
                            <span className="font-medium text-gray-500">{entry.staff_name}</span>
                          </>
                        )}
                        {entry.new_balance != null && (
                          <span className="ml-auto text-gray-500">Balance: {entry.new_balance}</span>
                        )}
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
