import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { SetupIntakeForm } from './SetupIntakeForm';
import { RequestSetupForm } from './RequestSetupForm';
import {
  Loader2, CheckCircle, Circle, Clock, DollarSign, 
  FileText, Package, Truck, Camera, Home, Wrench,
  Phone, ClipboardList, Users, ShoppingCart, Plane,
  HardHat, Sparkles, ChevronDown, ChevronUp, Eye,
  Play, Image, Video, RefreshCw, AlertCircle, ArrowRight
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
  investorEmail: string;
}

const PHASES = [
  { num: 1, name: 'Acquisition & Payment', icon: DollarSign, description: 'Property selection and admin fee payment' },
  { num: 2, name: 'Consultation', icon: Phone, description: 'Setup Manager consultation and package selection' },
  { num: 3, name: 'Intake & Agreement', icon: ClipboardList, description: 'Fill out intake form and sign service agreement' },
  { num: 4, name: 'Team Activation', icon: Users, description: 'Logistics payment and Setup Pro assignment (DFY only)' },
  { num: 5, name: 'Product Sourcing', icon: ShoppingCart, description: 'Item sourcing, spreadsheet review, and furniture fee' },
  { num: 6, name: 'Purchasing & Travel', icon: Plane, description: 'Items purchased and Pro travel arranged (DFY only)' },
  { num: 7, name: 'Warehouse & Transport', icon: Truck, description: 'Everything lands at our Texas warehouse, is checked against the order, and travels to your property on our own truck' },
  { num: 8, name: 'On-Site Setup', icon: HardHat, description: 'Delivery, assembly, and live tracking' },
  { num: 9, name: 'Final Handover', icon: Sparkles, description: 'Cleanup, photos, video walkthrough, and delivery' },
];

export function SetupProgressTracker({ investorId, investorName, investorEmail }: Props) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [approvingSpreadsheet, setApprovingSpreadsheet] = useState(false);
  const [mediaViewOpen, setMediaViewOpen] = useState(false);
  const { toast } = useToast();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'get_investor_projects', investor_id: investorId }
      });
      if (error) throw error;
      const projs = data?.projects || [];
      setProjects(projs);
      if (projs.length > 0 && !selectedProject) {
        setSelectedProject(projs[0]);
      } else if (selectedProject) {
        const updated = projs.find((p: any) => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      }
    } catch (err: any) {
      // DB fallback
      try {
        const { data } = await supabase.from('setup_projects').select('*').eq('investor_id', investorId).order('created_at', { ascending: false });
        setProjects(data || []);
        if (data && data.length > 0 && !selectedProject) setSelectedProject(data[0]);
      } catch (e) {
        console.error('Failed to fetch projects:', e);
      }
    }
    setLoading(false);
  }, [investorId, selectedProject?.id]);

  useEffect(() => { fetchProjects(); }, [investorId]);

  const handleApproveSpreadsheet = async () => {
    if (!selectedProject) return;
    setApprovingSpreadsheet(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'approve_spreadsheet', project_id: selectedProject.id, investor_id: investorId }
      });
      if (error || data?.error) throw new Error(data?.error || 'Failed to approve');
      toast({ title: 'Spreadsheet Approved!', description: 'Your Setup Manager has been notified. The Furniture & Supply Fee payment is next.' });
      fetchProjects();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setApprovingSpreadsheet(false);
  };

  const getPhaseStatus = (phaseNum: number, project: any) => {
    const currentPhase = project.phase || 1;
    const isDIY = project.package_type === 'diy';
    const skippedPhases = isDIY ? [4, 6, 7] : [];
    
    if (skippedPhases.includes(phaseNum)) return 'skipped';
    if (phaseNum < currentPhase) return 'completed';
    if (phaseNum === currentPhase) return 'active';
    return 'upcoming';
  };

  const getPhaseColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500 text-white';
      case 'active': return 'bg-blue-500 text-white ring-4 ring-blue-100';
      case 'skipped': return 'bg-gray-200 text-gray-400 line-through';
      default: return 'bg-gray-200 text-gray-500';
    }
  };

  const getLineColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-400';
      case 'active': return 'bg-blue-300';
      case 'skipped': return 'bg-gray-200 border-dashed';
      default: return 'bg-gray-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <p className="text-gray-500">Loading your setup projects...</p>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    // This used to say "once you begin the setup process with your Acquisition Manager,
    // your project will appear here", which is a wall in front of a service we sell on
    // its own. An operator can ask us to launch any property they own, acquired through
    // us or not, so the empty state is the request itself.
    return (
      <div className="space-y-4">
        <Card className="border-gray-200">
          <CardContent className="py-8 text-center">
            <Wrench className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No launches in progress</h3>
            <p className="text-gray-500 max-w-md mx-auto text-sm">
              When a launch is running you will see every stage here, from sourcing through
              our Texas warehouse to the final walkthrough.
            </p>
          </CardContent>
        </Card>
        <RequestSetupForm onRequested={fetchProjects} />
      </div>
    );
  }

  const project = selectedProject || projects[0];
  const currentPhase = project.phase || 1;
  const isDIY = project.package_type === 'diy';
  const spreadsheet = Array.isArray(project.sourcing_spreadsheet) ? project.sourcing_spreadsheet : [];
  const totalItems = spreadsheet.length;
  const deliveredItems = spreadsheet.filter((i: any) => i.delivered).length;
  const placedItems = spreadsheet.filter((i: any) => i.placed).length;

  return (
    <div className="space-y-6">
      {/* Project Selector (if multiple) */}
      {projects.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {projects.map((p: any) => (
            <Button
              key={p.id}
              variant={selectedProject?.id === p.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedProject(p)}
              className={selectedProject?.id === p.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <Home className="w-3 h-3 mr-1.5" />
              {p.property_address || `Project ${p.id.slice(0, 6)}`}
            </Button>
          ))}
        </div>
      )}

      {/* Header Card */}
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-600" />
                {project.property_address || 'Property Setup'}
              </CardTitle>
              <CardDescription className="mt-1">
                {project.city_state && <span>{project.city_state} · </span>}
                {project.num_beds && <span>{project.num_beds} bed / {project.num_baths} bath · </span>}
                <Badge variant="outline" className={isDIY ? 'border-blue-300 text-blue-700 bg-blue-50' : 'border-amber-300 text-amber-700 bg-amber-50'}>
                  {isDIY ? 'DIY' : 'DFY'} Package
                </Badge>
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchProjects}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Phase Progress Bar */}
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">Phase {currentPhase} of 8</span>
            <span className="font-medium text-emerald-700">{PHASES[currentPhase - 1]?.name}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(currentPhase / 8) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Phase Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Setup Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {PHASES.map((phase, idx) => {
              const status = getPhaseStatus(phase.num, project);
              const isLast = idx === PHASES.length - 1;
              const isExpanded = expandedPhase === phase.num;
              const PhaseIcon = phase.icon;

              return (
                <div key={phase.num} className="relative">
                  <div 
                    className={`flex items-start gap-4 py-3 cursor-pointer rounded-lg px-2 transition-colors ${status === 'active' ? 'bg-blue-50' : 'hover:bg-gray-50'} ${status === 'skipped' ? 'opacity-50' : ''}`}
                    onClick={() => setExpandedPhase(isExpanded ? null : phase.num)}
                  >
                    {/* Phase Circle */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${getPhaseColor(status)}`}>
                        {status === 'completed' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : status === 'skipped' ? (
                          <span className="text-xs font-bold">N/A</span>
                        ) : (
                          <PhaseIcon className="w-5 h-5" />
                        )}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 h-8 mt-1 ${getLineColor(status)}`} />
                      )}
                    </div>

                    {/* Phase Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={`font-medium ${status === 'skipped' ? 'text-gray-400 line-through' : status === 'active' ? 'text-blue-800' : status === 'completed' ? 'text-emerald-800' : 'text-gray-600'}`}>
                            Phase {phase.num}: {phase.name}
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">{phase.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {status === 'active' && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs">Current</Badge>
                          )}
                          {status === 'completed' && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">Complete</Badge>
                          )}
                          {status === 'skipped' && (
                            <Badge variant="outline" className="text-xs text-gray-400">Skipped (DIY)</Badge>
                          )}
                          {status !== 'skipped' && (
                            isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Phase Details */}
                  {isExpanded && status !== 'skipped' && (
                    <div className="ml-14 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      {/* Phase 1: Payment Status */}
                      {phase.num === 1 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium">Admin Fee</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">${Number(project.admin_fee_amount || 2500).toLocaleString()}</span>
                              {project.admin_fee_paid ? (
                                <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Phase 3: Intake Form */}
                      {phase.num === 3 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium">Intake Form</span>
                            </div>
                            {project.intake_form_submitted ? (
                              <Badge className="bg-emerald-100 text-emerald-700">Submitted</Badge>
                            ) : (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowIntakeForm(true)}>
                                Fill Out Form <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium">Service Agreement</span>
                            </div>
                            {project.agreement_signed ? (
                              <Badge className="bg-emerald-100 text-emerald-700">Signed</Badge>
                            ) : project.agreement_generated ? (
                              <Badge variant="outline" className="text-blue-600 border-blue-300">Ready to Sign</Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-400">Pending</Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Phase 4: Logistics (DFY only) */}
                      {phase.num === 4 && !isDIY && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium">Logistics Fee</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">${Number(project.logistics_fee_amount || 3350).toLocaleString()}</span>
                              {project.logistics_fee_paid ? (
                                <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>
                              )}
                            </div>
                          </div>
                          {project.setup_pro_name && (
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">Setup Pro</span>
                              </div>
                              <span className="text-sm font-semibold text-gray-800">{project.setup_pro_name}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Phase 5: Spreadsheet */}
                      {phase.num === 5 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium">Furniture & Supply Fee</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {project.furniture_supply_fee ? (
                                <span className="text-sm font-bold">${Number(project.furniture_supply_fee).toLocaleString()}</span>
                              ) : (
                                <span className="text-sm text-gray-400">TBD</span>
                              )}
                              {project.furniture_supply_fee_paid ? (
                                <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>
                              )}
                            </div>
                          </div>
                          {project.spreadsheet_approved && (
                            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-sm text-emerald-800">
                              <CheckCircle className="w-4 h-4 inline mr-1" /> Spreadsheet approved on {new Date(project.spreadsheet_approved_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Phase 7: Live Tracking */}
                      {phase.num === 7 && !isDIY && totalItems > 0 && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 bg-white rounded-lg border">
                              <p className="text-2xl font-bold text-gray-800">{totalItems}</p>
                              <p className="text-xs text-gray-500">Total Items</p>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border">
                              <p className="text-2xl font-bold text-blue-600">{deliveredItems}</p>
                              <p className="text-xs text-gray-500">Delivered</p>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border">
                              <p className="text-2xl font-bold text-emerald-600">{placedItems}</p>
                              <p className="text-xs text-gray-500">Placed</p>
                            </div>
                          </div>
                          {project.maintenance_check_completed && (
                            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-sm text-emerald-800">
                              <CheckCircle className="w-4 h-4 inline mr-1" /> Maintenance check completed
                            </div>
                          )}
                        </div>
                      )}

                      {/* Phase 8: Final Delivery */}
                      {phase.num === 8 && (
                        <div className="space-y-3">
                          {project.media_uploaded && (
                            <div className="p-3 bg-white rounded-lg border">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Property Media</span>
                                {project.media_approved ? (
                                  <Badge className="bg-emerald-100 text-emerald-700">Approved</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-blue-600 border-blue-300">Under Review</Badge>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {Array.isArray(project.media_photos) && project.media_photos.length > 0 && (
                                  <Button variant="outline" size="sm" onClick={() => setMediaViewOpen(!mediaViewOpen)}>
                                    <Image className="w-3 h-3 mr-1" /> {project.media_photos.length} Photos
                                  </Button>
                                )}
                                {Array.isArray(project.media_videos) && project.media_videos.length > 0 && (
                                  <Button variant="outline" size="sm" onClick={() => setMediaViewOpen(!mediaViewOpen)}>
                                    <Video className="w-3 h-3 mr-1" /> {project.media_videos.length} Videos
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                          {project.final_delivery_sent && (
                            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-emerald-600" />
                                <span className="font-semibold text-emerald-800">Setup Complete!</span>
                              </div>
                              <p className="text-sm text-emerald-700">
                                Your property has been fully set up. Final photos and video walkthrough have been delivered.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Generic: no specific details */}
                      {![1, 3, 4, 5, 7, 8].includes(phase.num) && (
                        <p className="text-sm text-gray-500">
                          {status === 'completed' ? 'This phase has been completed.' : 
                           status === 'active' ? 'This phase is currently in progress.' : 
                           'This phase has not started yet.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sourcing Spreadsheet (Read-Only) */}
      {totalItems > 0 && currentPhase >= 5 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  Sourcing Spreadsheet
                </CardTitle>
                <CardDescription>
                  {deliveredItems} of {totalItems} items delivered · {placedItems} placed
                </CardDescription>
              </div>
              {!project.spreadsheet_approved && currentPhase >= 5 && (
                <Button
                  onClick={handleApproveSpreadsheet}
                  disabled={approvingSpreadsheet}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {approvingSpreadsheet ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Approve Spreadsheet
                </Button>
              )}
              {project.spreadsheet_approved && (
                <Badge className="bg-emerald-100 text-emerald-700">Approved</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Item</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Category</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Qty</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600">Delivered</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {spreadsheet.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-400">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {item.image_url && (
                            <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <div>
                            <p className="font-medium text-gray-800">{item.name || item.item_name || `Item ${idx + 1}`}</p>
                            {item.link && (
                              <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                                View Product
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-gray-600">{item.category || '—'}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{item.quantity || 1}</td>
                      <td className="py-2 px-3 text-center">
                        {item.delivered ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.placed ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grand Total */}
            {project.furniture_supply_fee && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border flex items-center justify-between">
                <span className="font-semibold text-gray-700">Furniture & Supply Fee Total</span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-gray-900">${Number(project.furniture_supply_fee).toLocaleString()}</span>
                  {project.furniture_supply_fee_paid ? (
                    <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">Payment Required</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Administration Fee</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">${Number(project.admin_fee_amount || 2500).toLocaleString()}</span>
                {project.admin_fee_paid ? (
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">Paid</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Pending</Badge>
                )}
              </div>
            </div>

            {!isDIY && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Setup Logistics Fee</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">${Number(project.logistics_fee_amount || 3350).toLocaleString()}</span>
                  {project.logistics_fee_paid ? (
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">Paid</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Pending</Badge>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Furniture & Supply Fee</span>
              <div className="flex items-center gap-2">
                {project.furniture_supply_fee ? (
                  <span className="font-bold">${Number(project.furniture_supply_fee).toLocaleString()}</span>
                ) : (
                  <span className="text-gray-400 text-sm">To be determined</span>
                )}
                {project.furniture_supply_fee_paid ? (
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">Paid</Badge>
                ) : project.furniture_supply_fee ? (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Pending</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200 mt-2">
              <span className="font-semibold text-emerald-800">Total</span>
              <span className="text-xl font-bold text-emerald-800">
                ${(
                  Number(project.admin_fee_amount || 2500) +
                  (isDIY ? 0 : Number(project.logistics_fee_amount || 3350)) +
                  Number(project.furniture_supply_fee || 0)
                ).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Delivery Media Gallery */}
      {project.final_delivery_sent && project.media_approved && (
        <Card className="border-emerald-200">
          <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-lg">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-600" />
              Your Furnished Property
            </CardTitle>
            <CardDescription>Professional photos and video walkthrough</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {Array.isArray(project.media_photos) && project.media_photos.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <Image className="w-4 h-4" /> Photos ({project.media_photos.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {project.media_photos.map((photo: any, idx: number) => (
                    <div key={idx} className="aspect-[4/3] rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                      <img
                        src={typeof photo === 'string' ? photo : photo.url}
                        alt={`Property photo ${idx + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(project.media_videos) && project.media_videos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <Video className="w-4 h-4" /> Video Walkthrough
                </h4>
                <div className="grid gap-3">
                  {project.media_videos.map((video: any, idx: number) => (
                    <div key={idx} className="rounded-lg overflow-hidden border border-gray-200 bg-black">
                      <video
                        src={typeof video === 'string' ? video : video.url}
                        controls
                        className="w-full max-h-[400px]"
                        poster=""
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Intake Form Modal/Section */}
      {showIntakeForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="w-full max-w-2xl">
            <div className="flex justify-end mb-2">
              <Button variant="ghost" size="sm" onClick={() => setShowIntakeForm(false)} className="text-white hover:bg-white/20">
                Close
              </Button>
            </div>
            <SetupIntakeForm
              projectId={project.id}
              investorId={investorId}
              investorName={investorName}
              onSubmitted={() => {
                setShowIntakeForm(false);
                fetchProjects();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
