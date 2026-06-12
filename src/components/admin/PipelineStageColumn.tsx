import { useState } from 'react';
import { Users, UserCheck, Zap, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PipelineInvestorCard } from './PipelineInvestorCard';

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
}

interface PipelineStageColumnProps {
  stage: string;
  investors: Investor[];
  onDrop: (investorId: string, newStage: string) => void;
  onInvestorClick: (investor: Investor) => void;
}

const stageConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  lead: { label: 'Leads', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', icon: Users },
  qualified: { label: 'Qualified', color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200', icon: UserCheck },
  active: { label: 'Active', color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', icon: Zap },
  closed: { label: 'Closed', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200', icon: CheckCircle }
};

export function PipelineStageColumn({ stage, investors, onDrop, onInvestorClick }: PipelineStageColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const config = stageConfig[stage];
  const Icon = config.icon;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const investorId = e.dataTransfer.getData('investorId');
    if (investorId) onDrop(investorId, stage);
  };

  const handleDragStart = (e: React.DragEvent, investor: Investor) => {
    e.dataTransfer.setData('investorId', investor.id);
  };

  const totalBudget = investors.reduce((sum, inv) => sum + (inv.budget_max || inv.budget_min || 0), 0);
  const avgScore = investors.length > 0 
    ? Math.round(investors.reduce((sum, inv) => sum + (inv.engagement_score || 0), 0) / investors.length)
    : 0;

  return (
    <div
      className={`flex-1 min-w-[280px] max-w-[320px] rounded-lg border-2 transition-colors ${
        isDragOver ? 'border-blue-400 bg-blue-50' : config.bgColor
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.color}`} />
            <h3 className={`font-semibold ${config.color}`}>{config.label}</h3>
          </div>
          <Badge variant="secondary">{investors.length}</Badge>
        </div>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>Avg Score: {avgScore}</span>
          <span>Value: ${(totalBudget / 1000000).toFixed(1)}M</span>
        </div>
      </div>

      <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
        {investors.map(investor => (
          <PipelineInvestorCard
            key={investor.id}
            investor={investor}
            onDragStart={handleDragStart}
            onClick={onInvestorClick}
          />
        ))}
        {investors.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Drag investors here
          </div>
        )}
      </div>
    </div>
  );
}
