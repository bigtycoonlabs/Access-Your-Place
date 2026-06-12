import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, DollarSign, User, MapPin, CheckCircle, Clock, ChevronRight,
  Send, FileText, Plane, Camera, Package, Wrench, ClipboardList,
  ArrowRight, Phone, Mail, Calendar, Trash2, Plus, X, Video,
  AlertTriangle, CreditCard, UserPlus, ScrollText, Eye, Sparkles,
  MessageSquare, Settings2, HardHat
} from 'lucide-react';
import { SetupRecapTemplateModal } from './SetupRecapTemplateModal';
import { SetupIntakeFieldConfigurator } from './SetupIntakeFieldConfigurator';
import { SetupProManagement } from './SetupProManagement';

const PHASES = [
  { num: 1, name: 'Acquisition & Payment', icon: DollarSign, color: 'bg-blue-500' },
  { num: 2, name: 'Consultation', icon: Phone, color: 'bg-indigo-500' },
  { num: 3, name: 'Intake & Agreement', icon: FileText, color: 'bg-purple-500' },
  { num: 4, name: 'Logistics & Team', icon: UserPlus, color: 'bg-pink-500' },
  { num: 5, name: 'Sourcing & Approval', icon: Package, color: 'bg-orange-500' },
  { num: 6, name: 'Purchasing & Travel', icon: Plane, color: 'bg-amber-500' },
  { num: 7, name: 'On-Site Setup', icon: Wrench, color: 'bg-emerald-500' },
  { num: 8, name: 'Cleanup & Handover', icon: Camera, color: 'bg-green-600' },
];

interface SetupProject {
  id: string;
  property_address: string;
  investor_name?: string;
  investor_email?: string;
  investor_phone?: string;
  investor_id?: string;
  phase: number;
  status: string;
  package_type?: string;
  assigned_manager_name?: string;
  assigned_manager_id?: string;
  admin_fee_amount?: number;
  admin_fee_paid?: boolean;
  admin_fee_paid_at?: string;
  manager_commission_amount?: number;
  manager_commission_queued?: boolean;
  manager_commission_payout_date?: string;
  consultation_completed?: boolean;
  consultation_date?: string;
  consultation_notes?: string;
  recap_sent?: boolean;
  recap_sent_at?: string;
  recap_type?: string;
  recap_email_body?: string;
  intake_form_submitted?: boolean;
  intake_form_data?: any;
  intake_form_link?: string;
  agreement_generated?: boolean;
  agreement_signed?: boolean;
  agreement_signed_at?: string;
  logistics_fee_amount?: number;
  logistics_fee_paid?: boolean;
  setup_pro_name?: string;
  setup_pro_email?: string;
  setup_pro_fee?: number;
  setup_pro_paid?: boolean;
  pro_contract_sent?: boolean;
  pro_contract_signed?: boolean;
  sourcing_spreadsheet?: any[];
  spreadsheet_approved?: boolean;
  furniture_supply_fee?: number;
  furniture_supply_fee_paid?: boolean;
  items_purchased?: boolean;
  flight_booked?: boolean;
  flight_details?: any;
  pro_arrival_date?: string;
  maintenance_check_completed?: boolean;
  vendor_appointments?: any[];
  delivery_tracking?: any[];
  cleanup_completed?: boolean;
  media_uploaded?: boolean;
  media_approved?: boolean;
  media_urls?: any[];
  final_delivery_sent?: boolean;
  completed_at?: string;
  phase_history?: any[];
  activity_log?: any[];
  budget?: number;
  actual_cost?: number;
  estimated_completion?: string;
  num_properties?: number;
  num_beds?: string;
  num_baths?: string;
  property_type?: string;
  city_state?: string;
  target_start_date?: string;
  created_at: string;
  [key: string]: any;
}

interface Props {
  project: SetupProject;
  open: boolean;
  onClose: () => void;
  onUpdate: (project: SetupProject) => void;
  staffName: string;
}

export function SetupProjectDetail({ project, open, onClose, onUpdate, staffName }: Props) {
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [feeAmount, setFeeAmount] = useState('');
  const [proName, setProName] = useState('');
  const [proEmail, setProEmail] = useState('');
  const [noteText, setNoteText] = useState('');
  const [recapModalOpen, setRecapModalOpen] = useState(false);
  const { toast } = useToast();

  const p = project;
  const currentPhase = p.phase || 1;
  const isDFY = p.package_type === 'dfy';
  const isDIY = p.package_type === 'diy';

  const callAction = async (action: string, extraParams: any = {}) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action, project_id: p.id, staff_name: staffName, ...extraParams }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.project) onUpdate(data.project);
      toast({ title: 'Success', description: 'Project updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleFieldUpdate = async (updates: Record<string, any>) => {
    await callAction('update_project', { updates });
  };

  const handleAdvancePhase = () => callAction('advance_phase');
  const handleRecordAdminFee = () => callAction('record_admin_fee', { amount: parseFloat(feeAmount) || p.admin_fee_amount || 2500 });
  const handleRecordLogisticsFee = () => callAction('record_logistics_fee', { amount: parseFloat(feeAmount) || p.logistics_fee_amount || 3350 });
  const handleRecordFurnitureFee = () => callAction('record_furniture_fee', { amount: parseFloat(feeAmount) || 0 });
  const handleSetPackage = (type: string) => callAction('set_package_type', { package_type: type });
  const handleAssignPro = () => callAction('assign_pro', { pro_name: proName, pro_email: proEmail });

  const phaseProgress = Math.round(((currentPhase - 1) / 7) * 100);

  const getPhaseStatus = (phaseNum: number) => {
    if (isDIY && [4, 6, 7].includes(phaseNum)) return 'skipped';
    if (phaseNum < currentPhase) return 'completed';
    if (phaseNum === currentPhase) return 'active';
    return 'upcoming';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5 text-[#d4a574]" />
              {p.property_address}
            </DialogTitle>
            <DialogDescription>
              {p.investor_name && `Operator: ${p.investor_name}`}
              {p.package_type && ` | ${p.package_type === 'dfy' ? 'Done For You' : 'Do It Yourself'}`}
              {` | Phase ${currentPhase} of 8`}
            </DialogDescription>
          </DialogHeader>

          {/* Phase Timeline */}
          <div className="flex-shrink-0 px-1">
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {PHASES.map((phase, i) => {
                const status = getPhaseStatus(phase.num);
                const Icon = phase.icon;
                return (
                  <div key={phase.num} className="flex items-center flex-shrink-0">
                    <div
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-default
                        ${status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                        ${status === 'active' ? `${phase.color} text-white shadow-md` : ''}
                        ${status === 'upcoming' ? 'bg-gray-100 text-gray-500' : ''}
                        ${status === 'skipped' ? 'bg-gray-50 text-gray-300 line-through' : ''}
                      `}
                      title={`Phase ${phase.num}: ${phase.name}${status === 'skipped' ? ' (Skipped - DIY)' : ''}`}
                    >
                      {status === 'completed' ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden lg:inline">{phase.name}</span>
                      <span className="lg:hidden">{phase.num}</span>
                    </div>
                    {i < PHASES.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
            <Progress value={phaseProgress} className="h-1.5 mt-1" />
          </div>

          {/* Tab Navigation */}
          {/* Tab Navigation */}
          <div className="flex-shrink-0 flex gap-1 border-b overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'phase', label: `Phase ${currentPhase} Actions` },
              { id: 'recap', label: 'Recap Templates', icon: Mail },
              { id: 'intake_fields', label: 'Intake Fields', icon: Settings2 },
              { id: 'setup_pro', label: 'Setup Pro', icon: HardHat },
              { id: 'payments', label: 'Payments' },
              { id: 'sourcing', label: 'Sourcing' },
              { id: 'activity', label: 'Activity Log' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${activeSection === tab.id ? 'border-[#d4a574] text-[#1a365d]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {tab.id === 'recap' && <Mail className="w-3.5 h-3.5" />}
                {tab.id === 'intake_fields' && <Settings2 className="w-3.5 h-3.5" />}
                {tab.id === 'setup_pro' && <HardHat className="w-3.5 h-3.5" />}
                {tab.label}
                {tab.id === 'recap' && p.recap_sent && (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                )}
                {tab.id === 'intake_fields' && p.intake_form_submitted && (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                )}
                {tab.id === 'setup_pro' && p.setup_pro_name && (
                  <Badge variant="outline" className="text-[10px] ml-1 py-0 h-4">{p.setup_pro_name.split(' ')[0]}</Badge>
                )}
              </button>
            ))}
          </div>


          {/* Content Area */}
          <div className="flex-1 overflow-y-auto space-y-4 py-2 px-1">

            {/* ─── OVERVIEW TAB ─── */}
            {activeSection === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-xs text-blue-600">Phase</p>
                      <p className="text-xl font-bold text-blue-800">{currentPhase}/8</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-xs text-green-600">Package</p>
                      <p className="text-xl font-bold text-green-800">{isDFY ? 'DFY' : isDIY ? 'DIY' : 'TBD'}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-xs text-amber-600">Admin Fee</p>
                      <p className="text-xl font-bold text-amber-800">{p.admin_fee_paid ? 'Paid' : 'Pending'}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-xs text-purple-600">Status</p>
                      <p className="text-lg font-bold text-purple-800 capitalize">{p.status?.replace(/_/g, ' ')}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Operator Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Operator Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Name:</span>{' '}
                      <span className="font-medium">{p.investor_name || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>{' '}
                      {p.investor_email ? (
                        <a href={`mailto:${p.investor_email}`} className="font-medium text-blue-600 hover:underline">{p.investor_email}</a>
                      ) : 'Not set'}
                    </div>
                    <div>
                      <span className="text-gray-500">Phone:</span>{' '}
                      {p.investor_phone ? (
                        <a href={`tel:${p.investor_phone}`} className="font-medium text-blue-600 hover:underline">{p.investor_phone}</a>
                      ) : 'Not set'}
                    </div>
                    <div>
                      <span className="text-gray-500">Manager:</span>{' '}
                      <span className="font-medium">{p.assigned_manager_name || 'Unassigned'}</span>
                    </div>
                    {isDFY && (
                      <div>
                        <span className="text-gray-500">Setup Pro:</span>{' '}
                        <span className="font-medium">{p.setup_pro_name || 'Not assigned'}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Created:</span>{' '}
                      <span className="font-medium">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Property Details */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Property Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500"># Properties:</span>{' '}
                      <span className="font-medium">{p.num_properties || 1}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Beds:</span>{' '}
                      <span className="font-medium">{p.num_beds || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Baths:</span>{' '}
                      <span className="font-medium">{p.num_baths || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span>{' '}
                      <span className="font-medium capitalize">{p.property_type || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Location:</span>{' '}
                      <span className="font-medium">{p.city_state || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Target Start:</span>{' '}
                      <span className="font-medium">{p.target_start_date || 'Not set'}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Financial Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center py-1 border-b">
                        <span>Admin Fee</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${(p.admin_fee_amount || 2500).toLocaleString()}</span>
                          <Badge className={p.admin_fee_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {p.admin_fee_paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </div>
                      </div>
                      {isDFY && (
                        <div className="flex justify-between items-center py-1 border-b">
                          <span>Logistics Fee</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">${(p.logistics_fee_amount || 3350).toLocaleString()}</span>
                            <Badge className={p.logistics_fee_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {p.logistics_fee_paid ? 'Paid' : 'Unpaid'}
                            </Badge>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-1 border-b">
                        <span>Furniture & Supply Fee</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.furniture_supply_fee ? `$${p.furniture_supply_fee.toLocaleString()}` : 'TBD'}</span>
                          <Badge className={p.furniture_supply_fee_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                            {p.furniture_supply_fee_paid ? 'Paid' : p.furniture_supply_fee ? 'Unpaid' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                      {p.manager_commission_queued && (
                        <div className="flex justify-between items-center py-1 border-b bg-amber-50 px-2 rounded">
                          <span>Manager Commission (15%)</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">${(p.manager_commission_amount || 0).toFixed(2)}</span>
                            <Badge className="bg-amber-100 text-amber-700">
                              Payout: {p.manager_commission_payout_date || 'Next Friday'}
                            </Badge>
                          </div>
                        </div>
                      )}
                      {isDFY && (
                        <div className="flex justify-between items-center py-1">
                          <span>Setup Pro Fee</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">${(p.setup_pro_fee || 1200).toLocaleString()}</span>
                            <Badge className={p.setup_pro_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                              {p.setup_pro_paid ? 'Disbursed' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ─── PHASE ACTIONS TAB ─── */}
            {activeSection === 'phase' && (
              <div className="space-y-4">
                <Card className="border-[#d4a574] border-2">
                  <CardHeader className="pb-2 bg-gradient-to-r from-[#d4a574]/10 to-transparent">
                    <CardTitle className="text-base flex items-center gap-2">
                      {(() => { const ph = PHASES.find(x => x.num === currentPhase); const Icon = ph?.icon || Clock; return <Icon className="w-5 h-5 text-[#d4a574]" />; })()}
                      Phase {currentPhase}: {PHASES.find(x => x.num === currentPhase)?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-3">

                    {/* Phase 1: Acquisition & Payment */}
                    {currentPhase === 1 && (
                      <>
                        <p className="text-sm text-gray-600">The Operator selects a property with the Acquisition team. Record the Admin Fee payment to proceed.</p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Checkbox checked={!!p.admin_fee_paid} disabled />
                            <span className={`text-sm ${p.admin_fee_paid ? 'line-through text-gray-400' : 'font-medium'}`}>
                              Admin Fee Payment (${(p.admin_fee_amount || 2500).toLocaleString()})
                            </span>
                          </div>
                          {!p.admin_fee_paid && (
                            <div className="flex items-end gap-2 pl-8">
                              <div className="flex-1">
                                <Label htmlFor="admin-fee-amt">Fee Amount</Label>
                                <Input
                                  id="admin-fee-amt"
                                  type="number"
                                  placeholder={String(p.admin_fee_amount || 2500)}
                                  value={feeAmount}
                                  onChange={e => setFeeAmount(e.target.value)}
                                />
                              </div>
                              <Button onClick={handleRecordAdminFee} disabled={saving} className="bg-green-600 hover:bg-green-700">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1" />}
                                Record Payment
                              </Button>
                            </div>
                          )}
                          {p.admin_fee_paid && p.manager_commission_queued && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                              <p className="font-medium text-amber-800">Commission Queued</p>
                              <p className="text-amber-700">
                                ${(p.manager_commission_amount || 0).toFixed(2)} commission queued for payout on {p.manager_commission_payout_date || 'next Friday'}.
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Phase 2: Consultation */}
                    {currentPhase === 2 && (
                      <>
                        <p className="text-sm text-gray-600">Speak with the Operator to explain the process. Determine DFY or DIY package. Send the appropriate recap.</p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.consultation_completed}
                              onCheckedChange={(checked) => handleFieldUpdate({ consultation_completed: !!checked, consultation_date: checked ? new Date().toISOString() : null })}
                            />
                            <span className="text-sm font-medium">Consultation call completed</span>
                          </div>

                          {!p.package_type && (
                            <div className="pl-8 space-y-2">
                              <Label>Select Package Type</Label>
                              <div className="flex gap-2">
                                <Button onClick={() => handleSetPackage('dfy')} variant="outline" className="flex-1 border-2 hover:border-pink-500 hover:bg-pink-50" disabled={saving}>
                                  <Package className="w-4 h-4 mr-2" />
                                  Done For You (DFY)
                                </Button>
                                <Button onClick={() => handleSetPackage('diy')} variant="outline" className="flex-1 border-2 hover:border-blue-500 hover:bg-blue-50" disabled={saving}>
                                  <ClipboardList className="w-4 h-4 mr-2" />
                                  Do It Yourself (DIY)
                                </Button>
                              </div>
                            </div>
                          )}

                          {p.package_type && (
                            <div className="pl-8 flex items-center gap-2">
                              <Badge className={isDFY ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}>
                                {isDFY ? 'Done For You (DFY)' : 'Do It Yourself (DIY)'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-gray-500 h-6"
                                onClick={() => handleSetPackage(isDFY ? 'diy' : 'dfy')}
                                disabled={saving}
                              >
                                Switch to {isDFY ? 'DIY' : 'DFY'}
                              </Button>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <Checkbox checked={!!p.recap_sent} disabled />
                            <span className={`text-sm ${p.recap_sent ? 'line-through text-gray-400' : 'font-medium'}`}>
                              Recap sent to Operator
                            </span>
                            {p.recap_sent && p.recap_sent_at && (
                              <span className="text-xs text-gray-400">
                                ({new Date(p.recap_sent_at).toLocaleDateString()})
                              </span>
                            )}
                          </div>

                          {/* Recap Template Button - opens the full template modal */}
                          {p.package_type && (
                            <div className="pl-8">
                              <div className={`border-2 rounded-xl p-4 ${isDFY ? 'border-pink-200 bg-pink-50/50' : 'border-blue-200 bg-blue-50/50'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <Sparkles className={`w-4 h-4 ${isDFY ? 'text-pink-500' : 'text-blue-500'}`} />
                                  <span className="font-semibold text-sm text-[#1a365d]">
                                    {isDFY ? 'DFY' : 'DIY'} Recap Template
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mb-3">
                                  {p.recap_sent
                                    ? 'Recap was already sent. You can preview or resend with updated details.'
                                    : 'Customize the recap email with property details, fee breakdown, and process steps, then send via email or portal message.'}
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => setRecapModalOpen(true)}
                                    size="sm"
                                    className={isDFY ? 'bg-pink-600 hover:bg-pink-700' : 'bg-blue-600 hover:bg-blue-700'}
                                  >
                                    {p.recap_sent ? (
                                      <Eye className="w-4 h-4 mr-1" />
                                    ) : (
                                      <Send className="w-4 h-4 mr-1" />
                                    )}
                                    {p.recap_sent ? 'View / Resend Recap' : `Compose & Send ${isDFY ? 'DFY' : 'DIY'} Recap`}
                                  </Button>
                                </div>
                                {p.recap_sent && p.recap_type && (
                                  <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    {p.recap_type === 'dfy' ? 'DFY' : 'DIY'} recap sent
                                    {p.recap_sent_at && ` on ${new Date(p.recap_sent_at).toLocaleDateString()}`}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Phase 3: Intake & Agreement */}
                    {currentPhase === 3 && (
                      <>
                        <p className="text-sm text-gray-600">Operator fills out the Intake Form. Generate and get the Service Agreement signed.</p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.intake_form_submitted}
                              onCheckedChange={(checked) => handleFieldUpdate({ intake_form_submitted: !!checked })}
                            />
                            <span className="text-sm font-medium">Intake Form submitted by Operator</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.agreement_generated}
                              onCheckedChange={(checked) => handleFieldUpdate({ agreement_generated: !!checked })}
                            />
                            <span className="text-sm font-medium">Service Agreement generated</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.agreement_signed}
                              onCheckedChange={(checked) => handleFieldUpdate({ agreement_signed: !!checked, agreement_signed_at: checked ? new Date().toISOString() : null })}
                            />
                            <span className="text-sm font-medium">Agreement signed by Operator</span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Phase 4: Logistics & Team (DFY only) */}
                    {currentPhase === 4 && (
                      <>
                        {isDIY ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                            <p className="font-medium">DIY Package - Phase Skipped</p>
                            <p>This phase is skipped for DIY packages. Advance to Phase 5.</p>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-600">Collect Logistics Fee, assign a Setup Pro, and get the contractor agreement signed.</p>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <Checkbox checked={!!p.logistics_fee_paid} disabled />
                                <span className={`text-sm ${p.logistics_fee_paid ? 'line-through text-gray-400' : 'font-medium'}`}>
                                  Logistics Fee (${(p.logistics_fee_amount || 3350).toLocaleString()})
                                </span>
                              </div>
                              {!p.logistics_fee_paid && (
                                <div className="flex items-end gap-2 pl-8">
                                  <div className="flex-1">
                                    <Label htmlFor="logistics-fee-amt">Fee Amount</Label>
                                    <Input id="logistics-fee-amt" type="number" placeholder={String(p.logistics_fee_amount || 3350)} value={feeAmount} onChange={e => setFeeAmount(e.target.value)} />
                                  </div>
                                  <Button onClick={handleRecordLogisticsFee} disabled={saving} className="bg-green-600 hover:bg-green-700">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1" />}
                                    Record Payment
                                  </Button>
                                </div>
                              )}

                              <div className="flex items-center gap-3">
                                <Checkbox checked={!!p.setup_pro_name} disabled />
                                <span className={`text-sm ${p.setup_pro_name ? 'line-through text-gray-400' : 'font-medium'}`}>
                                  Assign Setup Pro
                                </span>
                              </div>
                              {!p.setup_pro_name && (
                                <div className="pl-8 space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label htmlFor="pro-name">Pro Name</Label>
                                      <Input id="pro-name" value={proName} onChange={e => setProName(e.target.value)} placeholder="Full name" />
                                    </div>
                                    <div>
                                      <Label htmlFor="pro-email">Pro Email</Label>
                                      <Input id="pro-email" type="email" value={proEmail} onChange={e => setProEmail(e.target.value)} placeholder="email@example.com" />
                                    </div>
                                  </div>
                                  <Button onClick={handleAssignPro} disabled={saving || !proName} size="sm">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
                                    Assign Pro
                                  </Button>
                                </div>
                              )}
                              {p.setup_pro_name && (
                                <div className="pl-8 text-sm text-gray-600">
                                  Assigned: <span className="font-medium">{p.setup_pro_name}</span> ({p.setup_pro_email || 'no email'})
                                </div>
                              )}

                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={!!p.pro_contract_sent}
                                  onCheckedChange={(checked) => handleFieldUpdate({ pro_contract_sent: !!checked })}
                                />
                                <span className="text-sm font-medium">Contractor Agreement sent</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={!!p.pro_contract_signed}
                                  onCheckedChange={(checked) => handleFieldUpdate({ pro_contract_signed: !!checked, pro_contract_signed_at: checked ? new Date().toISOString() : null })}
                                />
                                <span className="text-sm font-medium">Contractor Agreement signed</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={!!p.setup_pro_paid}
                                  onCheckedChange={(checked) => handleFieldUpdate({ setup_pro_paid: !!checked })}
                                />
                                <span className="text-sm font-medium">Pro fee disbursed (${(p.setup_pro_fee || 1200).toLocaleString()})</span>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* Phase 5: Sourcing & Spreadsheet */}
                    {currentPhase === 5 && (
                      <>
                        <p className="text-sm text-gray-600">Source items (24-48 hrs), populate the spreadsheet, get Operator approval, then collect the Furniture & Supply Fee.</p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.spreadsheet_approved}
                              onCheckedChange={(checked) => handleFieldUpdate({ spreadsheet_approved: !!checked, spreadsheet_approved_at: checked ? new Date().toISOString() : null })}
                            />
                            <span className="text-sm font-medium">Spreadsheet approved by Operator</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Checkbox checked={!!p.furniture_supply_fee_paid} disabled />
                            <span className={`text-sm ${p.furniture_supply_fee_paid ? 'line-through text-gray-400' : 'font-medium'}`}>
                              Furniture & Supply Fee collected
                            </span>
                          </div>
                          {!p.furniture_supply_fee_paid && (
                            <div className="flex items-end gap-2 pl-8">
                              <div className="flex-1">
                                <Label htmlFor="furniture-fee-amt">Fee Amount</Label>
                                <Input id="furniture-fee-amt" type="number" placeholder="Enter total" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} />
                              </div>
                              <Button onClick={handleRecordFurnitureFee} disabled={saving || !feeAmount} className="bg-green-600 hover:bg-green-700">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1" />}
                                Record Payment
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Phase 6: Purchasing & Travel */}
                    {currentPhase === 6 && (
                      <>
                        <p className="text-sm text-gray-600">Purchase all approved items. Book the Setup Pro's flight to arrive on the earliest delivery date.</p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.items_purchased}
                              onCheckedChange={(checked) => handleFieldUpdate({ items_purchased: !!checked })}
                            />
                            <span className="text-sm font-medium">All items purchased</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.flight_booked}
                              onCheckedChange={(checked) => handleFieldUpdate({ flight_booked: !!checked })}
                            />
                            <span className="text-sm font-medium">Pro flight booked</span>
                          </div>
                          <div className="pl-8">
                            <Label htmlFor="arrival-date">Pro Arrival Date</Label>
                            <Input
                              id="arrival-date"
                              type="date"
                              value={p.pro_arrival_date || ''}
                              onChange={e => handleFieldUpdate({ pro_arrival_date: e.target.value })}
                              className="w-48"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Phase 7: On-Site Setup */}
                    {currentPhase === 7 && (
                      <>
                        <p className="text-sm text-gray-600">Pro is on-site (7-14 business days). Track maintenance check, vendor appointments, and delivery verification.</p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.maintenance_check_completed}
                              onCheckedChange={(checked) => handleFieldUpdate({ maintenance_check_completed: !!checked })}
                            />
                            <span className="text-sm font-medium">Maintenance Inventory Check completed</span>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                            <p className="font-medium text-blue-800 mb-1">Vendor Management</p>
                            <p className="text-blue-700">Manager handles booking/scheduling. Pro acts as on-site contact for vendor access.</p>
                          </div>
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                            <p className="font-medium text-amber-800 mb-1">Delivery Verification</p>
                            <p className="text-amber-700">Initiate video calls with Pro to verify delivered items. Pro checks off items on the spreadsheet as they arrive.</p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Phase 8: Cleanup & Handover */}
                    {currentPhase === 8 && (
                      <>
                        <p className="text-sm text-gray-600">Pro cleans up, captures media, uploads for approval. Send final deliverables to Operator.</p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.cleanup_completed}
                              onCheckedChange={(checked) => handleFieldUpdate({ cleanup_completed: !!checked })}
                            />
                            <span className="text-sm font-medium">Property cleaned (boxes, trash removed)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.media_uploaded}
                              onCheckedChange={(checked) => handleFieldUpdate({ media_uploaded: !!checked })}
                            />
                            <span className="text-sm font-medium">Photos & video walkthrough uploaded</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.media_approved}
                              onCheckedChange={(checked) => handleFieldUpdate({ media_approved: !!checked })}
                            />
                            <span className="text-sm font-medium">Media approved by Manager</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={!!p.final_delivery_sent}
                              onCheckedChange={(checked) => handleFieldUpdate({ final_delivery_sent: !!checked })}
                            />
                            <span className="text-sm font-medium">Final photos & video sent to Operator</span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Advance Phase Button */}
                {p.status !== 'complete' && (
                  <Button
                    onClick={handleAdvancePhase}
                    disabled={saving}
                    className="w-full bg-[#d4a574] hover:bg-[#c49464] text-white"
                    size="lg"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="w-4 h-4 mr-2" />
                    )}
                    {currentPhase === 8 ? 'Mark Project Complete' : `Advance to Phase ${currentPhase + 1}`}
                  </Button>
                )}

                {p.status === 'complete' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="font-semibold text-green-800">Project Complete</p>
                    <p className="text-sm text-green-700">Completed {p.completed_at ? new Date(p.completed_at).toLocaleDateString() : ''}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── RECAP TEMPLATES TAB ─── */}
            {activeSection === 'recap' && (
              <div className="space-y-4">
                {/* Template Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* DFY Template Card */}
                  <Card className={`cursor-pointer transition-all hover:shadow-md ${isDFY ? 'border-pink-300 ring-2 ring-pink-200' : 'border-gray-200 hover:border-pink-200'}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Package className="w-4 h-4 text-pink-500" />
                          Done For You (DFY)
                        </CardTitle>
                        {isDFY && <Badge className="bg-pink-100 text-pink-700 text-xs">Selected</Badge>}
                        {p.recap_sent && p.recap_type === 'dfy' && (
                          <Badge className="bg-green-100 text-green-700 text-xs">
                            <CheckCircle className="w-3 h-3 mr-0.5" /> Sent
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-xs text-gray-600 space-y-1.5">
                        <p className="font-medium text-gray-800">Includes in email:</p>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-pink-500 flex-shrink-0" />
                          <span>Administration Team fee</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-pink-500 flex-shrink-0" />
                          <span>On-the-Ground Setup Team: $3,350</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-pink-500 flex-shrink-0" />
                          <span>Furniture Package Fee (variable)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-pink-500 flex-shrink-0" />
                          <span>4-step process with full setup team</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-pink-500 flex-shrink-0" />
                          <span>Cleanup & property photos included</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          if (!isDFY) handleSetPackage('dfy');
                          setRecapModalOpen(true);
                        }}
                        size="sm"
                        className="w-full bg-pink-600 hover:bg-pink-700"
                        disabled={saving}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />
                        {p.recap_sent && p.recap_type === 'dfy' ? 'View / Resend DFY Recap' : 'Compose DFY Recap'}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* DIY Template Card */}
                  <Card className={`cursor-pointer transition-all hover:shadow-md ${isDIY ? 'border-blue-300 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-200'}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-blue-500" />
                          Do It Yourself (DIY)
                        </CardTitle>
                        {isDIY && <Badge className="bg-blue-100 text-blue-700 text-xs">Selected</Badge>}
                        {p.recap_sent && p.recap_type === 'diy' && (
                          <Badge className="bg-green-100 text-green-700 text-xs">
                            <CheckCircle className="w-3 h-3 mr-0.5" /> Sent
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-xs text-gray-600 space-y-1.5">
                        <p className="font-medium text-gray-800">Includes in email:</p>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          <span>Administration Team fee</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          <span>Furniture Package Fee (variable)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          <span>4-step process (operator handles setup)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <X className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-400">No on-site team included</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <X className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-400">Operator handles photos & cleanup</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          if (!isDIY) handleSetPackage('diy');
                          setRecapModalOpen(true);
                        }}
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={saving}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />
                        {p.recap_sent && p.recap_type === 'diy' ? 'View / Resend DIY Recap' : 'Compose DIY Recap'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Recap History */}
                {p.recap_sent && (
                  <Card className="border-green-200 bg-green-50/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-green-800">
                        <CheckCircle className="w-4 h-4" />
                        Recap Delivery History
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Template Used:</span>
                        <Badge className={p.recap_type === 'dfy' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}>
                          {p.recap_type === 'dfy' ? 'Done For You (DFY)' : 'Do It Yourself (DIY)'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Sent On:</span>
                        <span className="font-medium">{p.recap_sent_at ? new Date(p.recap_sent_at).toLocaleString() : 'Unknown'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Recipient:</span>
                        <span className="font-medium">{p.investor_email || p.investor_name || 'Unknown'}</span>
                      </div>
                      {p.recap_email_body && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">View sent message content</summary>
                          <pre className="mt-2 bg-white border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto text-gray-600">
                            {p.recap_email_body}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Quick Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#d4a574]" />
                      Template Features
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-gray-600 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-start gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-700">Email Delivery</p>
                          <p>Professional HTML email sent directly to the operator's inbox with styled formatting.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-700">Portal Message</p>
                          <p>Send as a portal message if the operator has an account. Shows in their notification center.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Eye className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-700">Live Preview</p>
                          <p>Preview the exact email the operator will receive before sending, with all variables filled in.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-700">Variable Substitution</p>
                          <p>Auto-fills client name, property details, fees, and intake form link from project data.</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ─── PAYMENTS TAB ─── */}
            {activeSection === 'payments' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Payment Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: 'Admin Fee', amount: p.admin_fee_amount || 2500, paid: p.admin_fee_paid, paidAt: p.admin_fee_paid_at },
                      ...(isDFY ? [{ label: 'Logistics Fee', amount: p.logistics_fee_amount || 3350, paid: p.logistics_fee_paid, paidAt: p.logistics_fee_paid_at }] : []),
                      { label: 'Furniture & Supply Fee', amount: p.furniture_supply_fee || 0, paid: p.furniture_supply_fee_paid, paidAt: p.furniture_supply_fee_paid_at },
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${item.paid ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                        <div>
                          <p className="font-medium text-sm">{item.label}</p>
                          {item.paidAt && <p className="text-xs text-gray-500">Paid {new Date(item.paidAt).toLocaleDateString()}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">${item.amount.toLocaleString()}</span>
                          {item.paid ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <Clock className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    ))}

                    {p.manager_commission_queued && (
                      <div className="p-3 rounded-lg border bg-amber-50 border-amber-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">Manager Commission (15%)</p>
                            <p className="text-xs text-amber-700">Queued for payout: {p.manager_commission_payout_date}</p>
                          </div>
                          <span className="font-bold text-amber-800">${(p.manager_commission_amount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {isDFY && (
                      <div className={`p-3 rounded-lg border ${p.setup_pro_paid ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">Setup Pro Fee</p>
                            <p className="text-xs text-gray-500">{p.setup_pro_name || 'Not assigned'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">${(p.setup_pro_fee || 1200).toLocaleString()}</span>
                            {p.setup_pro_paid ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-gray-400" />}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ─── SOURCING TAB ─── */}
            {activeSection === 'sourcing' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Sourcing Spreadsheet
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(!p.sourcing_spreadsheet || p.sourcing_spreadsheet.length === 0) ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No items in the sourcing spreadsheet yet.</p>
                        <p className="text-xs text-gray-400 mt-1">Items will appear here once the Setup Manager begins sourcing.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-2 pr-3">Item</th>
                              <th className="pb-2 pr-3">Qty</th>
                              <th className="pb-2 pr-3">Price</th>
                              <th className="pb-2 pr-3">Status</th>
                              <th className="pb-2">Delivered</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.sourcing_spreadsheet.map((item: any, i: number) => (
                              <tr key={i} className="border-b last:border-0">
                                <td className="py-2 pr-3">{item.name || 'Item'}</td>
                                <td className="py-2 pr-3">{item.quantity || 1}</td>
                                <td className="py-2 pr-3">${item.price || 0}</td>
                                <td className="py-2 pr-3">
                                  <Badge variant="outline" className="text-xs">{item.status || 'pending'}</Badge>
                                </td>
                                <td className="py-2">
                                  {item.delivered ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Clock className="w-4 h-4 text-gray-300" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {p.spreadsheet_approved && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
                        <CheckCircle className="w-4 h-4" />
                        Approved by Operator {p.spreadsheet_approved_at ? `on ${new Date(p.spreadsheet_approved_at).toLocaleDateString()}` : ''}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ─── ACTIVITY LOG TAB ─── */}
            {activeSection === 'activity' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Activity Log</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(!p.activity_log || p.activity_log.length === 0) ? (
                      <p className="text-sm text-gray-500 text-center py-4">No activity recorded yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {[...(p.activity_log || [])].reverse().map((entry: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                            <div className="w-2 h-2 rounded-full bg-[#d4a574] mt-1.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{entry.action}</p>
                              <p className="text-xs text-gray-500">
                                {entry.by} &middot; {new Date(entry.at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Phase History */}
                {p.phase_history && p.phase_history.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Phase History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {p.phase_history.map((entry: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs">Phase {entry.from}</Badge>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <Badge className="bg-[#d4a574]/20 text-[#8b6f47] text-xs">Phase {entry.to}</Badge>
                            <span className="text-gray-500 text-xs ml-auto">
                              {entry.by} &middot; {new Date(entry.at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ─── INTAKE FIELDS CONFIGURATOR TAB ─── */}

            {activeSection === 'intake_fields' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-[#d4a574]" />
                      Intake Form Field Configurator
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-500 mb-4">
                      Customize which fields the operator sees on their intake form. Add, remove, reorder, and edit fields.
                      Save configurations as reusable templates for different property types.
                    </p>
                    <SetupIntakeFieldConfigurator
                      projectId={p.id}
                      currentFields={p.intake_form_fields || []}
                      staffName={staffName}
                      onUpdate={onUpdate}
                    />
                  </CardContent>
                </Card>

                {/* Submitted Intake Data Preview */}
                {p.intake_form_submitted && p.intake_form_data && (
                  <Card className="border-green-200 bg-green-50/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-green-800">
                        <CheckCircle className="w-4 h-4" />
                        Submitted Intake Data
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(p.intake_form_data).map(([key, value]: [string, any]) => (
                          <div key={key} className="text-sm">
                            <span className="text-gray-500 capitalize text-xs">{key.replace(/_/g, ' ')}:</span>
                            <p className="font-medium">{String(value || 'Not provided')}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ─── SETUP PRO MANAGEMENT TAB ─── */}
            {activeSection === 'setup_pro' && (
              <SetupProManagement
                project={p}
                staffName={staffName}
                onUpdate={onUpdate}
              />
            )}
          </div>


          <DialogFooter className="flex-shrink-0 border-t pt-3">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recap Template Modal */}
      <SetupRecapTemplateModal
        project={p}
        open={recapModalOpen}
        onClose={() => setRecapModalOpen(false)}
        onUpdate={onUpdate}
        staffName={staffName}
      />
    </>
  );
}
