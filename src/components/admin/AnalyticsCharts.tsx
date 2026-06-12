
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ChartsProps {
  pipelineStats: Array<{ stage: string; count: number }>;
  topMarkets: Array<{ market: string; inquiries: number; conversions: number; revenue: number }>;
}

const stageLabels: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  negotiating: 'Negotiating',
  under_contract: 'Under Contract',
  due_diligence: 'Due Diligence',
  closed: 'Closed'
};

const stageColors: Record<string, string> = {
  lead: 'bg-gray-400',
  qualified: 'bg-blue-400',
  negotiating: 'bg-yellow-400',
  under_contract: 'bg-orange-400',
  due_diligence: 'bg-purple-400',
  closed: 'bg-green-500'
};

export function AnalyticsCharts({ pipelineStats, topMarkets }: ChartsProps) {
  const totalPipeline = pipelineStats.reduce((sum, s) => sum + s.count, 0) || 1;
  const maxInquiries = Math.max(...topMarkets.map(m => m.inquiries), 1);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pipeline Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pipelineStats.map((stage) => (
              <div key={stage.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{stageLabels[stage.stage] || stage.stage}</span>
                  <span className="text-gray-500">{stage.count} ({((stage.count / totalPipeline) * 100).toFixed(0)}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${stageColors[stage.stage] || 'bg-gray-400'} transition-all`}
                    style={{ width: `${(stage.count / totalPipeline) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total in Pipeline</span>
              <span className="font-bold">{totalPipeline}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Markets by Inquiries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topMarkets.slice(0, 8).map((market, i) => (
              <div key={market.market}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1a365d] text-white text-xs flex items-center justify-center">{i + 1}</span>
                    {market.market}
                  </span>
                  <span className="text-gray-500">{market.inquiries} inquiries</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#d4a574] transition-all"
                    style={{ width: `${(market.inquiries / maxInquiries) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{market.conversions} converted</span>
                  <span>${(market.revenue / 1000).toFixed(0)}K revenue</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
