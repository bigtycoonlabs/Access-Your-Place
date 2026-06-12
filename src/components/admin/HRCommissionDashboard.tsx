
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TabErrorBoundary } from '@/components/admin/TabErrorBoundary';
import {
  DollarSign, Wallet, Shield, ClipboardCheck, Timer, Briefcase, PieChart
} from 'lucide-react';

// Direct imports to avoid lazy-loading complexity
import { CommissionLedger } from './CommissionLedger';
import { PaymentProfileManager } from './PaymentProfileManager';
import { ComplianceDocuments } from './ComplianceDocuments';
import { WeeklyReportForm } from './WeeklyReportForm';
import { TimeTrackerWidget } from './TimeTrackerWidget';
import { ExecutiveOverview } from './ExecutiveOverview';

interface HRCommissionDashboardProps {
  staffId: string;
  staffName: string;
  isAdmin: boolean;
}

export function HRCommissionDashboard({ staffId, staffName, isAdmin }: HRCommissionDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState(isAdmin ? 'executive' : 'commissions');

  const SUB_TABS = [
    ...(isAdmin ? [{ id: 'executive', label: 'Executive Overview', icon: PieChart, description: 'Deal tracking & master report' }] : []),
    { id: 'commissions', label: 'Commissions', icon: DollarSign, description: 'Track earnings & request payouts' },
    { id: 'payment', label: 'Payment Profile', icon: Wallet, description: 'Manage payout methods' },
    { id: 'compliance', label: 'Compliance', icon: Shield, description: 'Contracts & tax documents' },
    { id: 'weekly', label: 'Weekly Report', icon: ClipboardCheck, description: 'Submit performance data' },
    { id: 'time', label: 'Time Tracker', icon: Timer, description: 'Track hours & ROI' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-[#1a365d]/20 bg-gradient-to-r from-[#1a365d]/5 to-[#d4a574]/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-[#1a365d]">HR & Commission Center</CardTitle>
              <CardDescription>
                {isAdmin 
                  ? 'Executive overview, commissions, payment profiles, compliance docs, and staff reports'
                  : 'Track your commissions, manage payments, and submit weekly reports'
                }
              </CardDescription>
            </div>
            {isAdmin && (
              <Badge className="ml-auto bg-amber-100 text-amber-800 border-amber-200">
                Admin Access
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-gray-400'}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeSubTab === 'executive' && isAdmin && (
          <TabErrorBoundary tabName="Executive Overview">
            <ExecutiveOverview staffId={staffId} staffName={staffName} isAdmin={isAdmin} />
          </TabErrorBoundary>
        )}

        {activeSubTab === 'commissions' && (
          <TabErrorBoundary tabName="Commission Ledger">
            <CommissionLedger staffId={staffId} staffName={staffName} isAdmin={isAdmin} />
          </TabErrorBoundary>
        )}
        {activeSubTab === 'payment' && (
          <TabErrorBoundary tabName="Payment Profile">
            <PaymentProfileManager staffId={staffId} />
          </TabErrorBoundary>
        )}
        {activeSubTab === 'compliance' && (
          <TabErrorBoundary tabName="Compliance Documents">
            <ComplianceDocuments staffId={staffId} staffName={staffName} isAdmin={isAdmin} />
          </TabErrorBoundary>
        )}
        {activeSubTab === 'weekly' && (
          <TabErrorBoundary tabName="Weekly Report">
            <WeeklyReportForm staffId={staffId} staffName={staffName} isAdmin={isAdmin} />
          </TabErrorBoundary>
        )}
        {activeSubTab === 'time' && (
          <TabErrorBoundary tabName="Time Tracker">
            <TimeTrackerWidget staffId={staffId} />
          </TabErrorBoundary>
        )}
      </div>
    </div>
  );
}
