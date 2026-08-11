import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Loader2, Plus, Calendar, DollarSign, User, MapPin,
  CheckCircle, Clock, ChevronRight, Search, RefreshCw,
  Phone, FileText, Package, Plane, Wrench, Camera,
  UserPlus, Filter, ArrowUpDown, LayoutGrid, List,
  TrendingUp, CreditCard, AlertCircle, Truck,
} from 'lucide-react';
import { SOPHelpButton } from './SOPHelpButton';
import { SetupProjectDetail } from './SetupProjectDetail';

const PHASES = [
  { num: 1, name: 'Acquisition & Payment', shortName: 'Payment', icon: DollarSign, color: 'bg-blue-500', lightColor: 'bg-blue-50 border-blue-200 text-blue-700' },
  { num: 2, name: 'Consultation', shortName: 'Consult', icon: Phone, color: 'bg-indigo-500', lightColor: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { num: 3, name: 'Intake & Agreement', shortName: 'Intake', icon: FileText, color: 'bg-purple-500', lightColor: 'bg-purple-50 border-purple-200 text-purple-700' },
  { num: 4, name: 'Logistics & Team', shortName: 'Logistics', icon: UserPlus, color: 'bg-pink-500', lightColor: 'bg-pink-50 border-pink-200 text-pink-700' },
  { num: 5, name: 'Sourcing & Approval', shortName: 'Sourcing', icon: Package, color: 'bg-orange-500', lightColor: 'bg-orange-50 border-orange-200 text-orange-700' },
  { num: 6, name: 'Purchasing & Travel', shortName: 'Purchase', icon: Plane, color: 'bg-amber-500', lightColor: 'bg-amber-50 border-amber-200 text-amber-700' },
  // Purchasing used to hand straight to On-Site, which modelled the old way of working
  // where furniture shipped direct to the property. It does not any more: everything
  // lands at the Texas warehouse, is checked against the order, and travels to the
  // launch site on our own truck. That is where compliance and security over large
  // merchandise purchases is held, and the workflow had no stage for it, so a setup
  // manager had nowhere to answer "has it all arrived, and is it all correct".
  { num: 7, name: 'Warehouse & Transport', shortName: 'Freight', icon: Truck, color: 'bg-cyan-600', lightColor: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
  { num: 8, name: 'On-Site Setup', shortName: 'On-Site', icon: Wrench, color: 'bg-emerald-500', lightColor: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { num: 9, name: 'Cleanup & Handover', shortName: 'Handover', icon: Camera, color: 'bg-green-600', lightColor: 'bg-green-50 border-green-200 text-green-700' },
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
  recap_sent?: boolean;
  intake_form_submitted?: boolean;
  agreement_signed?: boolean;
  logistics_fee_paid?: boolean;
  setup_pro_name?: string;
  furniture_supply_fee?: number;
  furniture_supply_fee_paid?: boolean;
  completed_at?: string;
  budget?: number;
  actual_cost?: number;
  estimated_completion?: string;
  created_at: string;
  updated_at?: string;
  activity_log?: any[];
  phase_history?: any[];
  [key: string]: any;
}

interface Props {
  currentStaffId?: string;
  currentStaffName?: string;
}

export function SetupManagementDashboard({ currentStaffId, currentStaffName }: Props) {
  const [projects, setProjects] = useState<SetupProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<SetupProject | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<number | null>(null);
  const [packageFilter, setPackageFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const { toast } = useToast();

  const [newProject, setNewProject] = useState({
    property_address: '',
    investor_name: '',
    investor_email: '',
    investor_phone: '',
    estimated_completion: '',
    admin_fee_amount: '2500',
    budget: '',
    num_properties: '1',
    num_beds: '',
    num_baths: '',
    property_type: 'apartment',
    city_state: '',
    target_start_date: '',
  });


  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'list_projects' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProjects(data?.projects || []);
    } catch (err: any) {
      console.error('Error loading projects:', err);
      // Fallback to direct DB query
      try {
        const { data, error } = await supabase
          .from('setup_projects')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error) setProjects(data || []);
      } catch (e) {
        toast({ title: 'Error', description: 'Failed to load setup projects', variant: 'destructive' });
      }
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleAddProject = async () => {
    if (!newProject.property_address) {
      toast({ title: 'Error', description: 'Property address is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: {
          action: 'create_project',
          project_data: {
            property_address: newProject.property_address,
            investor_name: newProject.investor_name,
            investor_email: newProject.investor_email,
            investor_phone: newProject.investor_phone,
            estimated_completion: newProject.estimated_completion || null,
            admin_fee_amount: parseFloat(newProject.admin_fee_amount) || 2500,
            budget: parseFloat(newProject.budget) || 0,
            assigned_manager_id: currentStaffId,
            assigned_manager_name: currentStaffName,
            num_properties: parseInt(newProject.num_properties) || 1,
            num_beds: newProject.num_beds || null,
            num_baths: newProject.num_baths || null,
            property_type: newProject.property_type || 'apartment',
            city_state: newProject.city_state || null,
            target_start_date: newProject.target_start_date || null,
          },
          staff_name: currentStaffName
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.project) {
        setProjects(prev => [data.project, ...prev]);
      }
      setAddOpen(false);
      setNewProject({
        property_address: '', investor_name: '', investor_email: '', investor_phone: '',
        estimated_completion: '', admin_fee_amount: '2500', budget: '',
        num_properties: '1', num_beds: '', num_baths: '', property_type: 'apartment',
        city_state: '', target_start_date: '',
      });
      toast({ title: 'Success', description: 'Setup project created' });

    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleProjectUpdate = (updated: SetupProject) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedProject(updated);
  };

  // Filtering
  const filtered = projects.filter(p => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!p.property_address?.toLowerCase().includes(s) &&
          !p.investor_name?.toLowerCase().includes(s) &&
          !p.assigned_manager_name?.toLowerCase().includes(s)) return false;
    }
    if (phaseFilter !== null && p.phase !== phaseFilter) return false;
    if (packageFilter !== 'all' && p.package_type !== packageFilter) return false;
    return true;
  });

  // Stats
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status !== 'complete').length;
  const completedProjects = projects.filter(p => p.status === 'complete').length;
  const totalRevenue = projects.reduce((sum, p) => {
    let rev = 0;
    if (p.admin_fee_paid) rev += Number(p.admin_fee_amount || 0);
    if (p.logistics_fee_paid) rev += Number(p.logistics_fee_amount || 0);
    if (p.furniture_supply_fee_paid) rev += Number(p.furniture_supply_fee || 0);
    return sum + rev;
  }, 0);
  const pendingCommissions = projects.reduce((sum, p) => {
    if (p.manager_commission_queued && p.manager_commission_amount) return sum + Number(p.manager_commission_amount);
    return sum;
  }, 0);

  const getPhaseInfo = (phaseNum: number) => PHASES.find(p => p.num === phaseNum) || PHASES[0];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1a365d]">Setup Workflow Dashboard</h2>
          <p className="text-gray-500">8-phase property setup pipeline</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SOPHelpButton sopKey="Setup Workflow" category="Property Preparation" userRole="Setup_Manager" buttonText="Setup SOP" />
          <Button onClick={loadProjects} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button onClick={() => setAddOpen(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
            <Plus className="w-4 h-4 mr-1" /> New Project
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-blue-800">{totalProjects}</p>
                <p className="text-xs text-blue-600">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-800">{activeProjects}</p>
                <p className="text-xs text-amber-600">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-green-800">{completedProjects}</p>
                <p className="text-xs text-green-600">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-800">${totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-emerald-600">Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-purple-800">${pendingCommissions.toFixed(0)}</p>
                <p className="text-xs text-purple-600">Commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phase Pipeline Summary (clickable filters) */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setPhaseFilter(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${phaseFilter === null ? 'bg-[#1a365d] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All ({projects.length})
            </button>
            {PHASES.map(phase => {
              const count = projects.filter(p => p.phase === phase.num).length;
              const Icon = phase.icon;
              return (
                <button
                  key={phase.num}
                  onClick={() => setPhaseFilter(phaseFilter === phase.num ? null : phase.num)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                    ${phaseFilter === phase.num ? `${phase.color} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden md:inline">{phase.shortName}</span>
                  <span className="md:hidden">{phase.num}</span>
                  {count > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                      ${phaseFilter === phase.num ? 'bg-white/30' : 'bg-gray-200'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            {/* Completed filter */}
            <button
              onClick={() => setPhaseFilter(phaseFilter === 9 ? null : 9)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${phaseFilter === 9 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <CheckCircle className="w-3 h-3" />
              Done
              {completedProjects > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${phaseFilter === 9 ? 'bg-white/30' : 'bg-gray-200'}`}>
                  {completedProjects}
                </span>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input aria-label="Search by address, operator, or manager"
            placeholder="Search by address, operator, or manager..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={packageFilter} onValueChange={setPackageFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Package" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Packages</SelectItem>
            <SelectItem value="dfy">DFY Only</SelectItem>
            <SelectItem value="diy">DIY Only</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <button
            onClick={() => setViewMode('pipeline')}
            className={`px-3 py-2 text-sm ${viewMode === 'pipeline' ? 'bg-[#1a365d] text-white' : 'text-gray-600 hover:bg-gray-100'} rounded-l-md transition-colors`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-[#1a365d] text-white' : 'text-gray-600 hover:bg-gray-100'} rounded-r-md transition-colors`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Projects Display */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-600">No projects found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm || phaseFilter !== null ? 'Try adjusting your filters' : 'Create your first setup project to get started'}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'pipeline' ? (
        /* Pipeline View - grouped by phase */
        <div className="space-y-4">
          {PHASES.map(phase => {
            const phaseProjects = (phaseFilter === 9
              ? [] // Don't show in pipeline if filtering completed
              : filtered.filter(p => p.phase === phase.num && p.status !== 'complete')
            );
            if (phaseFilter !== null && phaseFilter !== phase.num && phaseFilter !== 9) return null;
            if (phaseProjects.length === 0 && phaseFilter !== null) return null;

            const Icon = phase.icon;
            return (
              <div key={phase.num}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg ${phase.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm text-[#1a365d]">
                    Phase {phase.num}: {phase.name}
                  </h3>
                  <Badge variant="secondary" className="text-xs">{phaseProjects.length}</Badge>
                </div>
                {phaseProjects.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-400 mb-2">
                    No active projects in this phase
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-2">
                    {phaseProjects.map(project => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onClick={() => { setSelectedProject(project); setDetailOpen(true); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Completed Projects */}
          {(phaseFilter === null || phaseFilter === 9) && (() => {
            const completedList = filtered.filter(p => p.status === 'complete');
            if (completedList.length === 0) return null;
            return (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm text-[#1a365d]">Completed</h3>
                  <Badge variant="secondary" className="text-xs">{completedList.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {completedList.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onClick={() => { setSelectedProject(project); setDetailOpen(true); }}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium">Property</th>
                    <th className="text-left p-3 font-medium">Operator</th>
                    <th className="text-left p-3 font-medium">Phase</th>
                    <th className="text-left p-3 font-medium">Package</th>
                    <th className="text-left p-3 font-medium">Manager</th>
                    <th className="text-left p-3 font-medium">Admin Fee</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(project => {
                    const phaseInfo = getPhaseInfo(project.phase || 1);
                    const PhaseIcon = phaseInfo.icon;
                    return (
                      <tr
                        key={project.id}
                        onClick={() => { setSelectedProject(project); setDetailOpen(true); }}
                        className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">{project.property_address}</span>
                          </div>
                        </td>
                        <td className="p-3 text-gray-600">{project.investor_name || '-'}</td>
                        <td className="p-3">
                          <Badge className={`${phaseInfo.lightColor} border text-xs`}>
                            <PhaseIcon className="w-3 h-3 mr-1" />
                            {project.status === 'complete' ? 'Complete' : `P${project.phase}`}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {project.package_type ? (
                            <Badge variant="outline" className="text-xs">
                              {project.package_type === 'dfy' ? 'DFY' : 'DIY'}
                            </Badge>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="p-3 text-gray-600 text-xs">{project.assigned_manager_name || '-'}</td>
                        <td className="p-3">
                          {project.admin_fee_paid ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">Paid</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 text-xs">Unpaid</Badge>
                          )}
                        </td>
                        <td className="p-3 text-gray-500 text-xs">
                          {new Date(project.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Project Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Setup Project</DialogTitle>
            <DialogDescription>
              Create a new property setup project. This starts at Phase 1 (Acquisition & Payment).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label htmlFor="new-address">Property Address *</Label>
              <Input
                id="new-address"
                value={newProject.property_address}
                onChange={e => setNewProject({ ...newProject, property_address: e.target.value })}
                placeholder="123 Main St, City, State"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new-investor">Operator Name</Label>
                <Input
                  id="new-investor"
                  value={newProject.investor_name}
                  onChange={e => setNewProject({ ...newProject, investor_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="new-email">Operator Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newProject.investor_email}
                  onChange={e => setNewProject({ ...newProject, investor_email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new-phone">Operator Phone</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  value={newProject.investor_phone}
                  onChange={e => setNewProject({ ...newProject, investor_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="new-admin-fee">Admin Fee ($)</Label>
                <Input
                  id="new-admin-fee"
                  type="number"
                  value={newProject.admin_fee_amount}
                  onChange={e => setNewProject({ ...newProject, admin_fee_amount: e.target.value })}
                  placeholder="2500"
                />
              </div>
            </div>

            {/* Property Details Section */}
            <div className="border-t pt-3 mt-1">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Property Details (for Recap Template)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="new-beds">Beds</Label>
                  <Input
                    id="new-beds"
                    value={newProject.num_beds}
                    onChange={e => setNewProject({ ...newProject, num_beds: e.target.value })}
                    placeholder="3"
                  />
                </div>
                <div>
                  <Label htmlFor="new-baths">Baths</Label>
                  <Input
                    id="new-baths"
                    value={newProject.num_baths}
                    onChange={e => setNewProject({ ...newProject, num_baths: e.target.value })}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label htmlFor="new-num-props"># Properties</Label>
                  <Input
                    id="new-num-props"
                    type="number"
                    min="1"
                    value={newProject.num_properties}
                    onChange={e => setNewProject({ ...newProject, num_properties: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="new-prop-type">Property Type</Label>
                  <Select value={newProject.property_type} onValueChange={v => setNewProject({ ...newProject, property_type: v })}>
                    <SelectTrigger id="new-prop-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['apartment', 'house', 'condo', 'townhouse', 'studio', 'duplex', 'loft', 'villa'].map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-city-state">City, State</Label>
                  <Input
                    id="new-city-state"
                    value={newProject.city_state}
                    onChange={e => setNewProject({ ...newProject, city_state: e.target.value })}
                    placeholder="Austin, Texas"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="new-start-date">Target Start Date</Label>
                  <Input
                    id="new-start-date"
                    type="date"
                    value={newProject.target_start_date}
                    onChange={e => setNewProject({ ...newProject, target_start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="new-est-completion">Est. Completion</Label>
                  <Input
                    id="new-est-completion"
                    type="date"
                    value={newProject.estimated_completion}
                    onChange={e => setNewProject({ ...newProject, estimated_completion: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor="new-budget">Total Budget ($)</Label>
                <Input
                  id="new-budget"
                  type="number"
                  value={newProject.budget}
                  onChange={e => setNewProject({ ...newProject, budget: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddProject} disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Detail */}
      {selectedProject && (
        <SetupProjectDetail
          project={selectedProject}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          onUpdate={handleProjectUpdate}
          staffName={currentStaffName || 'Staff'}
        />
      )}
    </div>
  );
}

/* ─── Project Card Component ─── */
function ProjectCard({ project, onClick }: { project: SetupProject; onClick: () => void }) {
  const phase = PHASES.find(p => p.num === project.phase) || PHASES[0];
  const Icon = phase.icon;
  const isComplete = project.status === 'complete';
  const phaseProgress = isComplete ? 100 : Math.round(((project.phase - 1) / 7) * 100);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-all hover:border-[#d4a574]/50 ${
        isComplete ? 'border-green-200 bg-green-50/30' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate text-[#1a365d]">{project.property_address}</p>
          {project.investor_name && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3" />
              {project.investor_name}
            </p>
          )}
        </div>
        <Badge className={`${isComplete ? 'bg-green-100 text-green-700' : phase.lightColor} border text-[10px] flex-shrink-0 ml-2`}>
          {isComplete ? (
            <><CheckCircle className="w-3 h-3 mr-0.5" /> Done</>
          ) : (
            <><Icon className="w-3 h-3 mr-0.5" /> P{project.phase}</>
          )}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
          <span>{isComplete ? 'Completed' : phase.shortName}</span>
          <span>{phaseProgress}%</span>
        </div>
        <Progress value={phaseProgress} className="h-1" />
      </div>

      {/* Meta info */}
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <div className="flex items-center gap-2">
          {project.package_type && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {project.package_type === 'dfy' ? 'DFY' : 'DIY'}
            </Badge>
          )}
          {project.admin_fee_paid ? (
            <span className="flex items-center gap-0.5 text-green-600">
              <DollarSign className="w-3 h-3" /> Paid
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-red-500">
              <AlertCircle className="w-3 h-3" /> Unpaid
            </span>
          )}
        </div>
        {project.assigned_manager_name && (
          <span className="truncate max-w-[100px]">{project.assigned_manager_name}</span>
        )}
      </div>
    </div>
  );
}
