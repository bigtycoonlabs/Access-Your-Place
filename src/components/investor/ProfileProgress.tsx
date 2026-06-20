import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, Circle, User, Phone, MapPin, DollarSign, 
  Bell, FileText, ArrowRight, Sparkles
} from 'lucide-react';

interface ProfileProgressProps {
  investor: any;
  onNavigate: (tab: string) => void;
}

interface ProgressItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  action?: string;
  tab?: string;
}

export function ProfileProgress({ investor, onNavigate }: ProfileProgressProps) {
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const progressItems: ProgressItem[] = [
      {
        id: 'basic_info',
        label: 'Basic Information',
        description: 'Name and email verified',
        icon: <User className="w-4 h-4" />,
        completed: !!(investor.full_name && investor.email)
      },
      {
        id: 'phone',
        label: 'Phone Number',
        description: 'Add phone for SMS alerts',
        icon: <Phone className="w-4 h-4" />,
        completed: !!investor.phone,
        action: 'Add phone number',
        tab: 'settings'
      },
      {
        id: 'markets',
        label: 'Preferred Markets',
        description: 'Select target investment markets',
        icon: <MapPin className="w-4 h-4" />,
        completed: investor.preferred_markets?.length > 0,
        action: 'Select markets',
        tab: 'settings'
      },
      {
        id: 'budget',
        label: 'Investment Budget',
        description: 'Set your budget range',
        icon: <DollarSign className="w-4 h-4" />,
        completed: !!(investor.investment_budget_min || investor.investment_budget_max),
        action: 'Set budget',
        tab: 'settings'
      },
      {
        id: 'deal_alerts',
        label: 'Deal Alerts',
        description: 'Get notified about matching deals',
        icon: <Bell className="w-4 h-4" />,
        completed: investor.deal_alerts_enabled || false,
        action: 'Set up alerts',
        tab: 'deal-alerts'
      },
      {
        id: 'first_report',
        label: 'Generate First Report',
        description: 'Create a market analysis',
        icon: <FileText className="w-4 h-4" />,
        completed: investor.reports_generated > 0,
        action: 'Generate report',
        tab: 'reports'
      }
    ];

    setItems(progressItems);
    
    const completedCount = progressItems.filter(item => item.completed).length;
    setProgress(Math.round((completedCount / progressItems.length) * 100));
  }, [investor]);

  const incompleteItems = items.filter(item => !item.completed);
  const completedItems = items.filter(item => item.completed);

  if (progress === 100) {
    return null; // Hide when profile is complete
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Complete Your Profile
          </CardTitle>
          <span className="text-sm font-semibold text-amber-700">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next Steps */}
        {incompleteItems.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Next Steps</p>
            <div className="space-y-2">
              {incompleteItems.slice(0, 3).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>
                  </div>
                  {item.tab && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onNavigate(item.tab!)}
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                    >
                      {item.action}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Items (collapsed) */}
        {completedItems.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Completed ({completedItems.length}/{items.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {completedItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs"
                >
                  <CheckCircle className="w-3 h-3" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incentive message */}
        <div className="p-3 bg-gradient-to-r from-amber-100 to-orange-100 rounded-lg">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Complete your profile</span> to get personalized deal recommendations and priority access to new listings!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
