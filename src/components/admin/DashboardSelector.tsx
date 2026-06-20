import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, Target, Wrench, ChevronRight, Lock,
  Users, BarChart3, Building, Settings
} from 'lucide-react';

export type DashboardType = 'success' | 'acquisitions' | 'setups';

interface DashboardSelectorProps {
  activeDashboard: DashboardType;
  onSelect: (dashboard: DashboardType) => void;
  canAccessSuccess: boolean;
  canAccessAcquisitions: boolean;
  canAccessSetups: boolean;
  isSuccessManager: boolean;
  investorCount?: number;
  unassignedCount?: number;
}

export function DashboardSelector({
  activeDashboard,
  onSelect,
  canAccessSuccess,
  canAccessAcquisitions,
  canAccessSetups,
  isSuccessManager,
  investorCount = 0,
  unassignedCount = 0
}: DashboardSelectorProps) {
  const dashboards = [
    {
      id: 'success' as DashboardType,
      title: 'Success Team',
      description: 'Master controls, analytics, investors, staff, content, communications, disputes & Penny AI',
      icon: Shield,
      gradient: 'from-amber-500 to-amber-600',
      bgGradient: 'from-amber-50 to-amber-100',
      borderColor: 'border-amber-300',
      activeRing: 'ring-amber-400',
      textColor: 'text-amber-900',
      descColor: 'text-amber-700',
      accessible: canAccessSuccess,
      stats: [
        { label: 'Full Platform Access', icon: Settings },
        { label: 'All Investors', icon: Users },
        { label: 'Analytics & Reports', icon: BarChart3 },
      ]
    },
    {
      id: 'acquisitions' as DashboardType,
      title: 'Acquisition Manager',
      description: 'Manage assigned investors, deal pipeline, verifications, workflow & submissions',
      icon: Target,
      gradient: 'from-indigo-500 to-indigo-600',
      bgGradient: 'from-indigo-50 to-indigo-100',
      borderColor: 'border-indigo-300',
      activeRing: 'ring-indigo-400',
      textColor: 'text-indigo-900',
      descColor: 'text-indigo-700',
      accessible: canAccessAcquisitions,
      stats: [
        { label: `${investorCount} Investors`, icon: Users },
        { label: 'Deal Pipeline', icon: Building },
        { label: `${unassignedCount} Unassigned`, icon: Target },
      ]
    },
    {
      id: 'setups' as DashboardType,
      title: 'Setup Manager',
      description: 'Property setups, furniture procurement, quality inspections & project tracking',
      icon: Wrench,
      gradient: 'from-emerald-500 to-emerald-600',
      bgGradient: 'from-emerald-50 to-emerald-100',
      borderColor: 'border-emerald-300',
      activeRing: 'ring-emerald-400',
      textColor: 'text-emerald-900',
      descColor: 'text-emerald-700',
      accessible: canAccessSetups,
      stats: [
        { label: 'Setup Projects', icon: Wrench },
        { label: 'Task Management', icon: Settings },
      ]
    }
  ];

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dashboards.map((db) => {
          const Icon = db.icon;
          const isActive = activeDashboard === db.id;
          const isLocked = !db.accessible;

          return (
            <Card
              key={db.id}
              className={`cursor-pointer transition-all duration-200 relative overflow-hidden ${
                isActive
                  ? `bg-gradient-to-br ${db.bgGradient} ${db.borderColor} ring-2 ${db.activeRing} shadow-lg`
                  : isLocked
                    ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                    : `hover:shadow-md hover:${db.borderColor} border-gray-200`
              }`}
              onClick={() => {
                if (!isLocked) onSelect(db.id);
              }}
              role="button"
              aria-pressed={isActive}
              aria-disabled={isLocked}
              aria-label={`${db.title} Dashboard${isLocked ? ' (locked)' : isActive ? ' (active)' : ''}`}
              tabIndex={isLocked ? -1 : 0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isLocked) {
                  e.preventDefault();
                  onSelect(db.id);
                }
              }}
            >
              {isActive && (
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${db.gradient}`} />
              )}
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${db.gradient}`}>
                    {isLocked ? (
                      <Lock className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className="w-5 h-5 text-white" />
                    )}
                  </div>
                  {isActive && (
                    <Badge className={`bg-gradient-to-r ${db.gradient} text-white text-xs`}>
                      Active
                    </Badge>
                  )}
                  {isLocked && (
                    <Badge variant="outline" className="text-gray-400 border-gray-300 text-xs">
                      No Access
                    </Badge>
                  )}
                </div>
                <h3 className={`font-bold text-lg ${isActive ? db.textColor : isLocked ? 'text-gray-400' : 'text-gray-900'}`}>
                  {db.title}
                </h3>
                <p className={`text-sm mt-1 ${isActive ? db.descColor : isLocked ? 'text-gray-400' : 'text-gray-500'}`}>
                  {db.description}
                </p>
                {!isLocked && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {db.stats.map((stat, i) => {
                      const StatIcon = stat.icon;
                      return (
                        <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                          isActive ? 'bg-white/60' : 'bg-gray-100'
                        } ${isActive ? db.textColor : 'text-gray-600'}`}>
                          <StatIcon className="w-3 h-3" />
                          {stat.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
