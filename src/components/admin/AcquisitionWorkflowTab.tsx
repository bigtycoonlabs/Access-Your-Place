
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle, Clock, FileText, Home, Settings, Rocket, DollarSign, ListTodo, Send, BookOpen } from 'lucide-react';
import { AcquisitionAssignmentModal } from './AcquisitionAssignmentModal';
import { SetupTasksManager } from './SetupTasksManager';
import { SOPHelpButton } from './SOPHelpButton';

const WORKFLOW_STAGES = [
  { value: 'payment_received', label: 'Payment', icon: DollarSign, color: 'bg-green-500' },
  { value: 'application_process', label: 'Application', icon: FileText, color: 'bg-blue-500' },
  { value: 'lease_review', label: 'Lease Review', icon: FileText, color: 'bg-purple-500' },
  { value: 'setup_furniture', label: 'Furniture', icon: Home, color: 'bg-orange-500' },
  { value: 'setup_software', label: 'Software', icon: Settings, color: 'bg-indigo-500' },
  { value: 'setup_utilities', label: 'Utilities', icon: Settings, color: 'bg-teal-500' },
  { value: 'vendor_matching', label: 'Vendors', icon: Settings, color: 'bg-pink-500' },
  { value: 'marketing_launch', label: 'Marketing', icon: Rocket, color: 'bg-yellow-500' },
  { value: 'completed', label: 'Complete', icon: CheckCircle, color: 'bg-emerald-600' }
];

interface AcquisitionWorkflowTabProps {
  userRole?: string;
}

export function AcquisitionWorkflowTab({ userRole = 'Success_Team' }: AcquisitionWorkflowTabProps) {
  const [acquisitions, setAcquisitions] = useState<any[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('all');
  const [assignModal, setAssignModal] = useState<any>(null);
  const [tasksModal, setTasksModal] = useState<any>(null);
  const { toast } = useToast();


  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: props } = await supabase.from('properties').select('*').not('assigned_investor_id', 'is', null);
    const { data: unassignedProps } = await supabase.from('properties').select('*').is('assigned_investor_id', null).eq('status', 'approved');
    setAcquisitions(props || []);
    setUnassigned(unassignedProps || []);
    setLoading(false);
  };

  const advanceStage = async (propertyId: string, currentStage: string) => {
    await supabase.functions.invoke('manage-acquisition-workflow', { body: { action: 'advance_stage', property_id: propertyId, stage: currentStage } });
    toast({ title: 'Stage advanced!' }); fetchData();
  };

  const recordPayment = async (propertyId: string) => {
    await supabase.functions.invoke('manage-acquisition-workflow', { body: { action: 'record_payment', property_id: propertyId, data: { amount: 2500 } } });
    toast({ title: 'Payment recorded!' }); fetchData();
  };

  const filtered = stageFilter === 'all' ? acquisitions : acquisitions.filter(a => a.workflow_stage === stageFilter);

  return (
    <div className="space-y-6">
      {/* Header with SOP Help */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1a365d]">Acquisition Workflow</h2>
          <p className="text-sm text-gray-600">Track and manage property acquisitions through each stage</p>
        </div>
        <div className="flex gap-2">
          <SOPHelpButton
            sopKey="Success Team Handoff"
            category="Success Team Handoff"
            userRole={userRole}
            buttonText="Handoff SOP"
            ariaLabel="View Success Team Handoff SOP"
          />
          <SOPHelpButton
            sopKey="Cross-Team Handoff"
            category="Cross-Team Handoffs"
            userRole={userRole}
            buttonText="Cross-Team SOP"
            ariaLabel="View Cross-Team Handoff SOP"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button variant={stageFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStageFilter('all')}>All ({acquisitions.length})</Button>
        {WORKFLOW_STAGES.map(s => <Button key={s.value} variant={stageFilter === s.value ? 'default' : 'outline'} size="sm" onClick={() => setStageFilter(s.value)}>{s.label}</Button>)}
      </div>


      {unassigned.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader className="pb-2"><CardTitle className="text-lg text-yellow-800">Ready to Assign ({unassigned.length})</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3">
            {unassigned.map(p => (
              <Card key={p.id} className="p-3">
                <p className="font-semibold">{p.title || 'Property'}</p>
                <p className="text-sm text-gray-600">{p.city}, {p.state}</p>
                <Button size="sm" className="mt-2 w-full bg-green-600" onClick={() => setAssignModal(p)}>Assign Investor</Button>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : (
        <div className="space-y-4">
          {filtered.map(acq => {
            const stage = WORKFLOW_STAGES.find(s => s.value === acq.workflow_stage);
            const StageIcon = stage?.icon || Clock;
            const stageIdx = WORKFLOW_STAGES.findIndex(s => s.value === acq.workflow_stage);
            return (
              <Card key={acq.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={stage?.color}><StageIcon className="w-3 h-3 mr-1" />{stage?.label}</Badge>
                        {acq.acquisition_fee_paid && <Badge className="bg-green-600">Paid</Badge>}
                      </div>
                      <h3 className="font-semibold">{acq.title || acq.address}</h3>
                      <p className="text-sm text-gray-600">{acq.city}, {acq.state} {acq.zip_code}</p>
                    </div>
                    <div className="flex gap-2">
                      {stageIdx >= 3 && <Button size="sm" variant="outline" onClick={() => setTasksModal(acq)}><ListTodo className="w-4 h-4 mr-1" />Tasks</Button>}
                      {!acq.acquisition_fee_paid && acq.workflow_stage === 'payment_received' && <Button size="sm" className="bg-green-600" onClick={() => recordPayment(acq.id)}>Mark Paid</Button>}
                      {acq.workflow_stage !== 'completed' && <Button size="sm" onClick={() => advanceStage(acq.id, acq.workflow_stage)}>Advance</Button>}
                    </div>
                  </div>
                  <div className="flex gap-1">{WORKFLOW_STAGES.map((s, i) => <div key={s.value} className={`h-2 flex-1 rounded ${i < stageIdx ? 'bg-green-500' : i === stageIdx ? 'bg-blue-500' : 'bg-gray-200'}`} />)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {assignModal && <AcquisitionAssignmentModal property={assignModal} open={!!assignModal} onOpenChange={() => setAssignModal(null)} onAssigned={fetchData} />}
      
      <Dialog open={!!tasksModal} onOpenChange={() => setTasksModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Setup Tasks - {tasksModal?.title || tasksModal?.city}</DialogTitle></DialogHeader>
          {tasksModal && <SetupTasksManager propertyId={tasksModal.id} investorId={tasksModal.assigned_investor_id} propertyTitle={tasksModal.title} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
