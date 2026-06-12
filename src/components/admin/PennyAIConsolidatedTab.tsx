import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TabErrorBoundary } from './TabErrorBoundary';
import { Activity, MessageSquare, Brain, BarChart3 } from 'lucide-react';

const PennyScoreMonitoringDashboard = lazy(() => import('./PennyScoreMonitoringDashboard').then(m => ({ default: m.PennyScoreMonitoringDashboard })));
const PennyConversationAnalytics = lazy(() => import('./PennyConversationAnalytics').then(m => ({ default: m.PennyConversationAnalytics })));
const PerformanceTrackingDashboard = lazy(() => import('./PerformanceTrackingDashboard').then(m => ({ default: m.PerformanceTrackingDashboard })));
const PennyMonthlyAccuracyReport = lazy(() => import('./PennyMonthlyAccuracyReport').then(m => ({ default: m.PennyMonthlyAccuracyReport })));

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <Card><CardContent className="py-8"><Skeleton className="h-40 w-full" /></CardContent></Card>
    </div>
  );
}

type PennySubTab = 'monitoring' | 'conversations' | 'ml' | 'accuracy';

interface PennyAIConsolidatedTabProps {
  staffId: string;
  staffName: string;
}

const SUB_TABS: { value: PennySubTab; label: string; icon: React.ElementType }[] = [
  { value: 'monitoring', label: 'Monitoring', icon: Activity },
  { value: 'conversations', label: 'Conversations', icon: MessageSquare },
  { value: 'ml', label: 'ML Training', icon: Brain },
  { value: 'accuracy', label: 'Accuracy Report', icon: BarChart3 },
];

export function PennyAIConsolidatedTab({ staffId, staffName }: PennyAIConsolidatedTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<PennySubTab>('monitoring');

  return (
    <div className="space-y-4">
      {/* Sub-navigation buttons */}
      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-lg" role="tablist" aria-label="Penny AI sections">
        {SUB_TABS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={activeSubTab === value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveSubTab(value)}
            className={`flex items-center gap-2 ${
              activeSubTab === value 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
            role="tab"
            aria-selected={activeSubTab === value}
            aria-controls={`penny-panel-${value}`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </div>

      {/* Sub-tab content */}
      <Suspense fallback={<TabSkeleton />}>
        <div id="penny-panel-monitoring" role="tabpanel" className={activeSubTab === 'monitoring' ? '' : 'hidden'}>
          <TabErrorBoundary tabName="Penny Score Monitoring">
            <PennyScoreMonitoringDashboard staffId={staffId} staffName={staffName} />
          </TabErrorBoundary>
        </div>

        <div id="penny-panel-conversations" role="tabpanel" className={activeSubTab === 'conversations' ? '' : 'hidden'}>
          <TabErrorBoundary tabName="Penny Conversation Analytics">
            <PennyConversationAnalytics staffId={staffId} staffName={staffName} />
          </TabErrorBoundary>
        </div>

        <div id="penny-panel-ml" role="tabpanel" className={activeSubTab === 'ml' ? '' : 'hidden'}>
          <TabErrorBoundary tabName="Penny ML Training">
            <PerformanceTrackingDashboard staffId={staffId} />
          </TabErrorBoundary>
        </div>

        <div id="penny-panel-accuracy" role="tabpanel" className={activeSubTab === 'accuracy' ? '' : 'hidden'}>
          <TabErrorBoundary tabName="Penny Accuracy Report">
            <PennyMonthlyAccuracyReport />
          </TabErrorBoundary>
        </div>
      </Suspense>
    </div>
  );
}
