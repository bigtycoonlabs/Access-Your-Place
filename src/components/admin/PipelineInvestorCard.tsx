import { User, Mail, Phone, DollarSign, MapPin, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

interface PipelineInvestorCardProps {
  investor: Investor;
  onDragStart: (e: React.DragEvent, investor: Investor) => void;
  onClick: (investor: Investor) => void;
}

export function PipelineInvestorCard({ investor, onDragStart, onClick }: PipelineInvestorCardProps) {
  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return 'Not set';
    const fmt = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}K`;
    if (min && max) return `${fmt(min)} - ${fmt(max)}`;
    return min ? `${fmt(min)}+` : `Up to ${fmt(max!)}`;
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-600';
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const daysSinceChange = investor.last_stage_change 
    ? Math.floor((Date.now() - new Date(investor.last_stage_change).getTime()) / 86400000)
    : 0;

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, investor)}
      onClick={() => onClick(investor)}
      className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-white"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-sm truncate max-w-[120px]">{investor.name || 'Unknown'}</p>
            <p className="text-xs text-gray-500 truncate max-w-[120px]">{investor.email}</p>
          </div>
        </div>
        <Badge className={`text-xs ${getScoreColor(investor.engagement_score)}`}>
          {investor.engagement_score || 0}
        </Badge>
      </div>

      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          <span>{formatBudget(investor.budget_min, investor.budget_max)}</span>
        </div>
        {investor.preferred_markets?.length > 0 && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{investor.preferred_markets.slice(0, 2).join(', ')}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-gray-400">
          <Calendar className="w-3 h-3" />
          <span>{daysSinceChange}d in stage</span>
        </div>
      </div>

      {investor.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {investor.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
