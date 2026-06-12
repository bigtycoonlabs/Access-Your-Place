import { useState, useEffect } from 'react';
import { RefreshCw, Settings, Filter, Search, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PipelineStageColumn } from './PipelineStageColumn';
import { AutomationRulesModal } from './AutomationRulesModal';
import { InvestorDetailModal } from './InvestorDetailModal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Investor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  budget_min?: number;
  budget_max?: number;
  preferred_markets?: string[];
  engagement_score?: number;
  last_stage_change?: string;
  tags?: string[];
  pipeline_stage?: string;
}

interface PipelineData {
  lead: Investor[];
  qualified: Investor[];
  active: Investor[];
  closed: Investor[];
}

export function InvestorPipelineTab() {
  const [pipeline, setPipeline] = useState<PipelineData>({ lead: [], qualified: [], active: [], closed: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAutomation, setShowAutomation] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadPipeline(); }, []);

  const loadPipeline = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('manage-investor-pipeline', {
      body: { action: 'get_pipeline' }
    });
    if (data) setPipeline(data);
    setLoading(false);
  };

  const handleDrop = async (investorId: string, newStage: string) => {
    const allInvestors = [...pipeline.lead, ...pipeline.qualified, ...pipeline.active, ...pipeline.closed];
    const investor = allInvestors.find(i => i.id === investorId);
    if (!investor || investor.pipeline_stage === newStage) return;

    // Optimistic update
    const oldStage = investor.pipeline_stage || 'lead';
    setPipeline(prev => ({
      ...prev,
      [oldStage]: prev[oldStage as keyof PipelineData].filter(i => i.id !== investorId),
      [newStage]: [...prev[newStage as keyof PipelineData], { ...investor, pipeline_stage: newStage }]
    }));

    const { error } = await supabase.functions.invoke('manage-investor-pipeline', {
      body: { action: 'update_stage', investor_id: investorId, stage: newStage, trigger_type: 'manual', reason: 'Drag and drop' }
    });

    if (error) {
      toast({ title: 'Error updating stage', variant: 'destructive' });
      loadPipeline();
    } else {
      toast({ title: `Moved to ${newStage}` });
    }
  };

  const filterInvestors = (investors: Investor[]) => {
    if (!searchTerm) return investors;
    const term = searchTerm.toLowerCase();
    return investors.filter(i => 
      i.name?.toLowerCase().includes(term) || 
      i.email?.toLowerCase().includes(term) ||
      i.preferred_markets?.some(m => m.toLowerCase().includes(term))
    );
  };

  const totalInvestors = pipeline.lead.length + pipeline.qualified.length + pipeline.active.length + pipeline.closed.length;
  const totalValue = [...pipeline.lead, ...pipeline.qualified, ...pipeline.active, ...pipeline.closed]
    .reduce((sum, i) => sum + (i.budget_max || i.budget_min || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Investor Pipeline</h2>
          <p className="text-gray-500">Drag investors between stages to update their status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAutomation(true)}>
            <Settings className="w-4 h-4 mr-2" />Automation
          </Button>
          <Button variant="outline" onClick={loadPipeline} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-blue-100">
          <p className="text-sm text-gray-600">Total Investors</p>
          <p className="text-2xl font-bold">{totalInvestors}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-r from-green-50 to-green-100">
          <p className="text-sm text-gray-600">Pipeline Value</p>
          <p className="text-2xl font-bold">${(totalValue / 1000000).toFixed(1)}M</p>
        </Card>
        <Card className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100">
          <p className="text-sm text-gray-600">Conversion Rate</p>
          <p className="text-2xl font-bold">{totalInvestors > 0 ? Math.round((pipeline.closed.length / totalInvestors) * 100) : 0}%</p>
        </Card>
        <Card className="p-4 bg-gradient-to-r from-purple-50 to-purple-100">
          <p className="text-sm text-gray-600">Active Deals</p>
          <p className="text-2xl font-bold">{pipeline.active.length}</p>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search investors..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {(['lead', 'qualified', 'active', 'closed'] as const).map(stage => (
          <PipelineStageColumn
            key={stage}
            stage={stage}
            investors={filterInvestors(pipeline[stage])}
            onDrop={handleDrop}
            onInvestorClick={setSelectedInvestor}
          />
        ))}
      </div>

      <AutomationRulesModal open={showAutomation} onClose={() => setShowAutomation(false)} />
      {selectedInvestor && (
        <InvestorDetailModal investor={selectedInvestor} onClose={() => { setSelectedInvestor(null); loadPipeline(); }} />
      )}
    </div>
  );
}
