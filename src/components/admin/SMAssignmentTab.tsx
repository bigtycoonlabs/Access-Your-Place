import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  Loader2, CheckCircle, XCircle, Clock, Search, User, Mail, 
  Phone, Calendar, UserPlus, AlertTriangle, UserCheck, RefreshCw,
  Wrench, Home, Building, ArrowRight
} from 'lucide-react';

interface Investor {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  assigned_acquisition_manager_id?: string;
  acquisition_manager_name?: string;
  assigned_setup_manager_id?: string;
  assigned_setup_manager_name?: string;
  setup_manager_assigned_at?: string;
  created_at: string;
  status?: string;
  onboarding_completed?: boolean;
}

interface SetupManager {
  id: string;
  full_name: string;
  email: string;
  department: string;
  investor_count?: number;
}

interface Props {
  staffId: string;
  staffName: string;
}

export function SMAssignmentTab({ staffId, staffName }: Props) {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [setupManagers, setSetupManagers] = useState<SetupManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unassigned' | 'assigned'>('unassigned');
  
  // Assignment modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load investors
      const { data: investorData } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'get_all_investors', limit: 500 }
      });

      if (investorData?.investors) {
        setInvestors(investorData.investors);
      }

      // Load setup managers
      const { data: staffData } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'get_staff_list', department: 'setup_managers' }
      });

      if (staffData?.staff) {
        // Count investors per setup manager
        const smWithCounts = staffData.staff.map((s: any) => {
          const count = investorData?.investors?.filter(
            (inv: Investor) => inv.assigned_setup_manager_id === s.id
          ).length || 0;
          
          return {
            id: s.id,
            full_name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email,
            email: s.email,
            department: s.department,
            investor_count: count
          };
        });
        setSetupManagers(smWithCounts);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSM = async () => {
    if (!selectedInvestor || !selectedManagerId) return;

    setProcessing(selectedInvestor.id);
    try {
      const selectedManager = setupManagers.find(sm => sm.id === selectedManagerId);
      
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: 'assign_setup_manager',
          investor_id: selectedInvestor.id,
          manager_id: selectedManagerId,
          manager_name: selectedManager?.full_name
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to assign setup manager');
      }

      toast({ 
        title: 'Setup Manager Assigned!', 
        description: `${selectedManager?.full_name} has been assigned to ${selectedInvestor.full_name}. The investor has been notified.`
      });
      
      setAssignModalOpen(false);
      setSelectedInvestor(null);
      setSelectedManagerId('');
      setAssignmentNotes('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleRemoveSM = async (investor: Investor) => {
    if (!confirm(`Remove ${investor.assigned_setup_manager_name} from ${investor.full_name}?`)) return;

    setProcessing(investor.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: 'assign_setup_manager',
          investor_id: investor.id,
          manager_id: null,
          manager_name: null
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to remove setup manager');
      }

      toast({ 
        title: 'Setup Manager Removed', 
        description: `Setup manager has been removed from ${investor.full_name}`
      });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  // Filter investors
  const filteredInvestors = investors.filter(inv => {
    const matchesSearch = 
      inv.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'unassigned') {
      return matchesSearch && !inv.assigned_setup_manager_id;
    } else if (filterStatus === 'assigned') {
      return matchesSearch && inv.assigned_setup_manager_id;
    }
    return matchesSearch;
  });

  const unassignedCount = investors.filter(inv => !inv.assigned_setup_manager_id).length;
  const assignedCount = investors.filter(inv => inv.assigned_setup_manager_id).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
          <p className="mt-2 text-gray-500">Loading setup manager assignments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{setupManagers.length}</p>
                <p className="text-sm text-emerald-600">Setup Managers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{unassignedCount}</p>
                <p className="text-sm text-amber-600">Need SM Assignment</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{assignedCount}</p>
                <p className="text-sm text-green-600">SM Assigned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{investors.length}</p>
                <p className="text-sm text-blue-600">Total Investors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by investor name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Investors</SelectItem>
            <SelectItem value="unassigned">Needs SM Assignment</SelectItem>
            <SelectItem value="assigned">SM Assigned</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={loadData} variant="outline" size="icon">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="investors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="investors">
            Investor Assignments
            {unassignedCount > 0 && (
              <Badge className="ml-2 bg-amber-500">{unassignedCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="managers">
            Setup Manager Workload
          </TabsTrigger>
        </TabsList>

        {/* Investor Assignments Tab */}
        <TabsContent value="investors">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-600" />
                Setup Manager Assignments
              </CardTitle>
              <CardDescription>
                Assign setup managers to investors to help them prepare their properties for rental.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredInvestors.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No investors found</p>
                  <p className="text-sm text-gray-500">
                    {filterStatus === 'unassigned' 
                      ? 'All investors have setup managers assigned!' 
                      : 'Try adjusting your search or filter'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredInvestors.map((investor) => (
                    <div
                      key={investor.id}
                      className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                        investor.assigned_setup_manager_id 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Investor Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold">{investor.full_name || 'Unknown'}</span>
                            {investor.assigned_acquisition_manager_id && (
                              <Badge variant="outline" className="text-blue-600 border-blue-300">
                                Has AM
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {investor.email}
                            </span>
                            {investor.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {investor.phone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Joined {new Date(investor.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Current SM Info */}
                        <div className="flex-1">
                          {investor.assigned_setup_manager_id ? (
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Assigned Setup Manager:</p>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  <Wrench className="w-3 h-3 mr-1" />
                                  {investor.assigned_setup_manager_name}
                                </Badge>
                                {investor.setup_manager_assigned_at && (
                                  <span className="text-xs text-gray-500">
                                    since {new Date(investor.setup_manager_assigned_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                No Setup Manager
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setSelectedInvestor(investor);
                              if (investor.assigned_setup_manager_id) {
                                setSelectedManagerId(investor.assigned_setup_manager_id);
                              }
                              setAssignModalOpen(true);
                            }}
                            disabled={processing === investor.id}
                            className={investor.assigned_setup_manager_id 
                              ? 'bg-blue-600 hover:bg-blue-700' 
                              : 'bg-emerald-600 hover:bg-emerald-700'}
                          >
                            {processing === investor.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <UserCheck className="w-4 h-4 mr-2" />
                            )}
                            {investor.assigned_setup_manager_id ? 'Change SM' : 'Assign SM'}
                          </Button>
                          {investor.assigned_setup_manager_id && (
                            <Button
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => handleRemoveSM(investor)}
                              disabled={processing === investor.id}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Setup Manager Workload Tab */}
        <TabsContent value="managers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-600" />
                Setup Manager Workload
              </CardTitle>
              <CardDescription>
                View the current workload distribution across setup managers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {setupManagers.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No Setup Managers Found</p>
                  <p className="text-sm text-gray-500">Add setup managers in the Staff Management section</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {setupManagers.map((sm) => {
                    const assignedInvestors = investors.filter(
                      inv => inv.assigned_setup_manager_id === sm.id
                    );
                    
                    return (
                      <Card key={sm.id} className="border-emerald-200">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                              {sm.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold">{sm.full_name}</h4>
                              <p className="text-sm text-gray-500">{sm.email}</p>
                              <div className="mt-2">
                                <Badge className={`${
                                  assignedInvestors.length === 0 ? 'bg-gray-100 text-gray-600' :
                                  assignedInvestors.length < 5 ? 'bg-green-100 text-green-700' :
                                  assignedInvestors.length < 10 ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {assignedInvestors.length} Investor{assignedInvestors.length !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                              
                              {assignedInvestors.length > 0 && (
                                <div className="mt-3 space-y-1">
                                  <p className="text-xs text-gray-500 font-medium">Assigned Investors:</p>
                                  {assignedInvestors.slice(0, 3).map(inv => (
                                    <p key={inv.id} className="text-xs text-gray-600 truncate">
                                      {inv.full_name || inv.email}
                                    </p>
                                  ))}
                                  {assignedInvestors.length > 3 && (
                                    <p className="text-xs text-gray-400">
                                      +{assignedInvestors.length - 3} more
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign SM Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-600" />
              {selectedInvestor?.assigned_setup_manager_id ? 'Change' : 'Assign'} Setup Manager
            </DialogTitle>
            <DialogDescription>
              {selectedInvestor?.assigned_setup_manager_id 
                ? `Change the setup manager for ${selectedInvestor?.full_name}. The investor will be notified of the change.`
                : `Assign a setup manager to ${selectedInvestor?.full_name}. The investor will receive an email notification.`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Investor Info */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <p className="text-sm text-gray-500 mb-2">Investor:</p>
              <p className="font-medium">{selectedInvestor?.full_name}</p>
              <p className="text-sm text-gray-600">{selectedInvestor?.email}</p>
            </div>

            {/* Current SM if exists */}
            {selectedInvestor?.assigned_setup_manager_id && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <p className="text-sm text-amber-600">
                  Current SM: <strong>{selectedInvestor.assigned_setup_manager_name}</strong>
                </p>
              </div>
            )}

            {/* SM Selection */}
            <div>
              <Label htmlFor="sm-select">Select Setup Manager</Label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a setup manager..." />
                </SelectTrigger>
                <SelectContent>
                  {setupManagers
                    .filter(sm => sm.id !== selectedInvestor?.assigned_setup_manager_id)
                    .map((sm) => (
                      <SelectItem key={sm.id} value={sm.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{sm.full_name}</span>
                          <span className="text-gray-500 text-xs ml-2">
                            ({sm.investor_count || 0} investors)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="assignment-notes">Internal Notes (Optional)</Label>
              <Textarea
                id="assignment-notes"
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="Any notes about this assignment..."
                rows={2}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssignModalOpen(false);
              setSelectedInvestor(null);
              setSelectedManagerId('');
              setAssignmentNotes('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignSM}
              disabled={!selectedManagerId || processing === selectedInvestor?.id}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {processing === selectedInvestor?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Assign & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
