import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Home, Users, DollarSign } from 'lucide-react';
import { DealAnalytics } from '@/types/dealflow';

interface PropertyAnalyticsProps {
  analytics: DealAnalytics | null;
  monthlyRent: number;
}

export function PropertyAnalytics({ analytics, monthlyRent }: PropertyAnalyticsProps) {
  if (!analytics) {
    return (
      <div className="text-center py-8 text-gray-500">
        <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No analytics data available yet</p>
        <p className="text-sm">Run market analysis to generate projections</p>
      </div>
    );
  }

  const strROI = ((analytics.str_yearly_revenue - (monthlyRent * 12)) / (monthlyRent * 12) * 100).toFixed(1);
  const colivingROI = ((analytics.coliving_yearly_revenue - (monthlyRent * 12)) / (monthlyRent * 12) * 100).toFixed(1);

  return (
    <div className="space-y-4">
      {/* STR Analysis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            Short-Term Rental Projections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">${analytics.str_adr}</p>
              <p className="text-xs text-gray-600">Avg Daily Rate</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{analytics.str_occupancy}%</p>
              <p className="text-xs text-gray-600">Occupancy Rate</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">${analytics.str_yearly_revenue.toLocaleString()}</p>
              <p className="text-xs text-gray-600">Yearly Revenue</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm">Viability Score</span>
            <Badge className={analytics.str_viability_score >= 70 ? 'bg-green-500' : analytics.str_viability_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}>
              {analytics.str_viability_score}/100
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm">Projected ROI</span>
            <span className={`font-bold ${Number(strROI) > 0 ? 'text-green-600' : 'text-red-600'}`}>{strROI}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Co-Living Analysis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Co-Living Projections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">${analytics.coliving_adr}</p>
              <p className="text-xs text-gray-600">Avg Daily Rate</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{analytics.coliving_occupancy}%</p>
              <p className="text-xs text-gray-600">Occupancy Rate</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">${analytics.coliving_yearly_revenue.toLocaleString()}</p>
              <p className="text-xs text-gray-600">Yearly Revenue</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm">Viability Score</span>
            <Badge className={analytics.coliving_viability_score >= 70 ? 'bg-green-500' : analytics.coliving_viability_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}>
              {analytics.coliving_viability_score}/100
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm">Projected ROI</span>
            <span className={`font-bold ${Number(colivingROI) > 0 ? 'text-green-600' : 'text-red-600'}`}>{colivingROI}%</span>
          </div>
        </CardContent>
      </Card>

      {analytics.ai_recommendation && (
        <Card className="border-[#d4a574]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">AI Recommendation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{analytics.ai_recommendation}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
