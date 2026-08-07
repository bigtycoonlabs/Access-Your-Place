import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  Loader2, Search, User, Mail, Phone, Calendar, Building,
  Home, CheckCircle, Clock, Wrench, MessageSquare, MapPin,
  DollarSign, RefreshCw, ExternalLink, ArrowRight
} from 'lucide-react';

interface AssignedInvestor {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  setup_manager_assigned_at?: string;
  preferred_markets?: string[];
  operation_types?: string[];
  status?: string;
  onboarding_completed?: boolean;
}

interface SetupProject {
  id: string;
  property_address: string;
  investor_id?: string;
  investor_name?: string;
  status: 'pending' | 'in_progress' | 'furniture_delivery' | 'final_inspection' | 'complete';
  estimated_completion?: string;
  actual_completion?: string;
  budget: number;
  actual_cost: number;
  tasks: { id: string; name: string; completed: boolean }[];
  created_at: string;
}

interface Props {
  staffId: string;
  staffName: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  furniture_delivery: { label: 'Furniture Delivery', color: 'bg-yellow-100 text-yellow-700' },
  final_inspection: { label: 'Final Inspection', color: 'bg-purple-100 text-purple-700' },
  complete: { label: 'Complete', color: 'bg-green-100 text-green-700' }
};

export function MySetupProjectsTab({ staffId, staffName }: Props) {
  const [assignedInvestors, setAssignedInvestors] = useState<AssignedInvestor[]>([]);
  const [setupProjects, setSetupProjects] = useState<SetupProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<AssignedInvestor | null>(null);
  const [investorDetailOpen, setInvestorDetailOpen] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [staffId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load investors assigned to this setup manager
      const { data: investorData } = await supabase.functions.invoke('manage-investor-admin', {
        body: { 
          action: 'get_all_investors', 
          assigned_manager_id: staffId,
          limit: 500 
        }
      });

      if (investorData?.investors) {
        // Filter to only investors assigned to this SM
        const myInvestors = investorData.investors.filter(
          (inv: any) => inv.assigned_setup_manager_id === staffId
        );
        setAssignedInvestors(myInvestors);
      }

      // Load setup projects assigned to this manager
      const { data: projectData, error } = await supabase
        .from('setup_projects')
        .select('*')
        .eq('assigned_manager_id', staffId)
        .order('created_at', { ascending: false });

      if (!error && projectData) {
        setSetupProjects(projectData);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast({ title: 'Error', description: 'Failed to load your assignments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getTaskProgress = (tasks: { completed: boolean }[]) => {
    if (!tasks || tasks.length === 0) return 0;
    return Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);
  };

  // Filter investors
  const filteredInvestors = assignedInvestors.filter(inv => 
    inv.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter projects
  const filteredProjects = setupProjects.filter(proj =>
    proj.property_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proj.investor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const activeProjects = setupProjects.filter(p => p.status !== 'complete').length;
  const completedProjects = setupProjects.filter(p => p.status === 'complete').length;
  const totalBudget = setupProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const totalSpent = setupProjects.reduce((sum, p) => sum + (p.actual_cost || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
          <p className="mt-2 text-gray-500">Loading your assignments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1a365d]">My Setup Projects</h2>
          <p className="text-gray-600">View and manage your assigned investors and setup projects</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{assignedInvestors.length}</p>
            <p className="text-xs text-emerald-600">Assigned Investors</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{activeProjects}</p>
            <p className="text-xs text-blue-600">Active Projects</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-700">{completedProjects}</p>
            <p className="text-xs text-green-600">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-700">${totalBudget.toLocaleString()}</p>
            <p className="text-xs text-amber-600">Total Budget</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-purple-700">${totalSpent.toLocaleString()}</p>
            <p className="text-xs text-purple-600">Total Spent</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input aria-label="Search investors or projects"
          placeholder="Search investors or projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="investors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="investors" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            My Investors ({assignedInvestors.length})
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Setup Projects ({setupProjects.length})
          </TabsTrigger>
        </TabsList>

        {/* Investors Tab */}
        <TabsContent value="investors">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Assigned Investors
              </CardTitle>
              <CardDescription>
                Investors assigned to you for property setup assistance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredInvestors.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No investors assigned yet</p>
                  <p className="text-sm text-gray-500">
                    Investors will appear here when assigned to you by the Success Team
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredInvestors.map((investor) => {
                    const investorProjects = setupProjects.filter(
                      p => p.investor_name?.toLowerCase() === investor.full_name?.toLowerCase()
                    );
                    
                    return (
                      <div
                        key={investor.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                              {investor.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                            </div>
                            <div>
                              <h4 className="font-semibold">{investor.full_name || 'Unknown'}</h4>
                              {investor.company_name && (
                                <p className="text-sm text-gray-600">{investor.company_name}</p>
                              )}
                              <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  <a href={`mailto:${investor.email}`} className="hover:text-emerald-600">
                                    {investor.email}
                                  </a>
                                </span>
                                {investor.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    <a href={`tel:${investor.phone}`} className="hover:text-emerald-600">
                                      {investor.phone}
                                    </a>
                                  </span>
                                )}
                              </div>
                              {investor.setup_manager_assigned_at && (
                                <p className="text-xs text-gray-400 mt-1">
                                  Assigned {new Date(investor.setup_manager_assigned_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                                <Home className="w-3 h-3 mr-1" />
                                {investorProjects.length} Project{investorProjects.length !== 1 ? 's' : ''}
                              </Badge>
                              {investor.preferred_markets && investor.preferred_markets.length > 0 && (
                                <Badge variant="outline">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {investor.preferred_markets[0]}
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedInvestor(investor);
                                setInvestorDetailOpen(true);
                              }}
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5 text-emerald-600" />
                Setup Projects
              </CardTitle>
              <CardDescription>
                Properties you're setting up for investors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No setup projects yet</p>
                  <p className="text-sm text-gray-500">
                    Create projects from the Setup Management dashboard
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProjects.map((project) => {
                    const progress = getTaskProgress(project.tasks);
                    const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.pending;
                    
                    return (
                      <div
                        key={project.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <h4 className="font-semibold">{project.property_address}</h4>
                              <Badge className={statusInfo.color}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                            
                            {project.investor_name && (
                              <p className="text-sm text-gray-600 mb-2">
                                <User className="w-3 h-3 inline mr-1" />
                                {project.investor_name}
                              </p>
                            )}

                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">Progress</span>
                                <span className="font-medium">{progress}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>

                            {/* Budget Info */}
                            <div className="flex flex-wrap gap-4 text-sm">
                              <span className="flex items-center gap-1 text-gray-600">
                                <DollarSign className="w-3 h-3" />
                                Budget: ${project.budget.toLocaleString()}
                              </span>
                              <span className={`flex items-center gap-1 ${
                                project.actual_cost > project.budget ? 'text-red-600' : 'text-green-600'
                              }`}>
                                <DollarSign className="w-3 h-3" />
                                Spent: ${project.actual_cost.toLocaleString()}
                              </span>
                              {project.estimated_completion && (
                                <span className="flex items-center gap-1 text-gray-600">
                                  <Calendar className="w-3 h-3" />
                                  Due: {new Date(project.estimated_completion).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Badge variant="outline">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {project.tasks?.filter(t => t.completed).length || 0}/{project.tasks?.length || 0} Tasks
                            </Badge>
                            {project.status === 'complete' && project.actual_completion && (
                              <span className="text-xs text-green-600">
                                Completed {new Date(project.actual_completion).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Investor Detail Modal */}
      <Dialog open={investorDetailOpen} onOpenChange={setInvestorDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              Investor Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvestor && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xl font-bold">
                  {selectedInvestor.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedInvestor.full_name}</h3>
                  {selectedInvestor.company_name && (
                    <p className="text-gray-600">{selectedInvestor.company_name}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <a href={`mailto:${selectedInvestor.email}`} className="text-sm font-medium text-emerald-600 hover:underline">
                    {selectedInvestor.email}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  {selectedInvestor.phone ? (
                    <a href={`tel:${selectedInvestor.phone}`} className="text-sm font-medium text-emerald-600 hover:underline">
                      {selectedInvestor.phone}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Not provided</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Assigned Date</p>
                  <p className="text-sm font-medium">
                    {selectedInvestor.setup_manager_assigned_at 
                      ? new Date(selectedInvestor.setup_manager_assigned_at).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <Badge className={selectedInvestor.onboarding_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                    {selectedInvestor.onboarding_completed ? 'Active' : 'Onboarding'}
                  </Badge>
                </div>
              </div>

              {selectedInvestor.preferred_markets && selectedInvestor.preferred_markets.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Preferred Markets</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedInvestor.preferred_markets.map((market, i) => (
                      <Badge key={i} variant="outline">
                        <MapPin className="w-3 h-3 mr-1" />
                        {market}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedInvestor.operation_types && selectedInvestor.operation_types.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Operation Types</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedInvestor.operation_types.map((type, i) => (
                      <Badge key={i} variant="outline">
                        <Building className="w-3 h-3 mr-1" />
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-gray-600">
                  <strong>{setupProjects.filter(p => 
                    p.investor_name?.toLowerCase() === selectedInvestor.full_name?.toLowerCase()
                  ).length}</strong> setup project(s) for this investor
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvestorDetailOpen(false)}>
              Close
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <MessageSquare className="w-4 h-4 mr-2" />
              Message Investor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
