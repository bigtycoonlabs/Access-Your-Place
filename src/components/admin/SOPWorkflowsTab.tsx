import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Search, Plus, Edit2, Trash2, BookOpen, FileText, Shield, Database, Store, Scale,
  Loader2, CheckCircle2, Lock, Clock, Users, Briefcase, Home, Wrench, MessageSquare,
  Target, Handshake, ClipboardList, Package, RefreshCw, Download, History, Eye, User,
  ChevronDown, ChevronRight, X, Brain, Sparkles, ChevronLeft, Maximize2, Minimize2
} from 'lucide-react';

import { SOPDiffViewer } from './SOPDiffViewer';
import { SOPPendingReviewsWidget } from './SOPPendingReviewsWidget';

interface SOP {
  id: string;
  role_id: string;
  category: string;
  title: string;
  content_html: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  last_updated: string;
  updated_by?: string;
  version?: number;
  change_summary?: string;
}

interface SOPVersion {
  id: string;
  sop_id: string;
  version_number: number;
  title: string;
  content_html: string;
  previous_content_html: string | null;
  change_summary: string;
  changed_by: string;
  created_at: string;
}

interface SOPWorkflowsTabProps {
  userRole: string;
  userName?: string;
  staffId?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  'Onboarding': <BookOpen className="w-5 h-5" aria-hidden="true" />,
  'Compliance': <Shield className="w-5 h-5" aria-hidden="true" />,
  'Data Research': <Database className="w-5 h-5" aria-hidden="true" />,
  'Marketplace Maintenance': <Store className="w-5 h-5" aria-hidden="true" />,
  'Dispute Resolution': <Scale className="w-5 h-5" aria-hidden="true" />,
  'Consultative Framework': <Briefcase className="w-5 h-5" aria-hidden="true" />,
  'Property Research': <Target className="w-5 h-5" aria-hidden="true" />,
  'Landlord Outreach': <MessageSquare className="w-5 h-5" aria-hidden="true" />,
  'Deal Negotiation': <Handshake className="w-5 h-5" aria-hidden="true" />,
  'Success Team Handoff': <Users className="w-5 h-5" aria-hidden="true" />,
  'Property Preparation': <Home className="w-5 h-5" aria-hidden="true" />,
  'Furniture Procurement': <Package className="w-5 h-5" aria-hidden="true" />,
  'Quality Inspection': <ClipboardList className="w-5 h-5" aria-hidden="true" />,
  'Vendor Management': <Wrench className="w-5 h-5" aria-hidden="true" />,
  'Cross-Team Handoffs': <RefreshCw className="w-5 h-5" aria-hidden="true" />,
  'Communication Standards': <MessageSquare className="w-5 h-5" aria-hidden="true" />,
  'Setup Management': <Wrench className="w-5 h-5" aria-hidden="true" />,
  'Penny AI': <Brain className="w-5 h-5" aria-hidden="true" />,
};

const categoryColors: Record<string, string> = {
  'Onboarding': 'from-amber-500 to-amber-600',
  'Compliance': 'from-red-500 to-red-600',
  'Data Research': 'from-blue-500 to-blue-600',
  'Marketplace Maintenance': 'from-green-500 to-green-600',
  'Dispute Resolution': 'from-purple-500 to-purple-600',
  'Consultative Framework': 'from-indigo-500 to-indigo-600',
  'Property Research': 'from-cyan-500 to-cyan-600',
  'Landlord Outreach': 'from-teal-500 to-teal-600',
  'Deal Negotiation': 'from-orange-500 to-orange-600',
  'Success Team Handoff': 'from-pink-500 to-pink-600',
  'Property Preparation': 'from-emerald-500 to-emerald-600',
  'Furniture Procurement': 'from-violet-500 to-violet-600',
  'Quality Inspection': 'from-rose-500 to-rose-600',
  'Vendor Management': 'from-slate-500 to-slate-600',
  'Cross-Team Handoffs': 'from-fuchsia-500 to-fuchsia-600',
  'Communication Standards': 'from-sky-500 to-sky-600',
  'Setup Management': 'from-lime-500 to-lime-600',
  'Penny AI': 'from-purple-600 to-indigo-700',
};


const roleLabels: Record<string, { label: string; color: string }> = {
  'Success_Team': { label: 'Success Team', color: 'bg-amber-100 text-amber-800' },
  'Acquisition_Manager': { label: 'Acquisition Manager', color: 'bg-indigo-100 text-indigo-800' },
  'Setup_Manager': { label: 'Setup Manager', color: 'bg-emerald-100 text-emerald-800' },
  'Cross_Team': { label: 'All Teams', color: 'bg-purple-100 text-purple-800' },
};

export function SOPWorkflowsTab({ userRole, userName, staffId }: SOPWorkflowsTabProps) {
  const [roleSop, setRoleSop] = useState<Array<{ role: string; section: string; title: string; body: string }>>([]);
  const [sopRole, setSopRole] = useState('');
  const [sopError, setSopError] = useState('');

  useEffect(() => {
    let dead = false;
    (async () => {
      if (!staffId) return;
      try {
        const { data, error } = await supabase.functions.invoke('penny-staff-brief', {
          body: { staff_id: staffId, sop_only: true },
        });
        if (dead) return;
        if (error || !data?.sop) {
          // Said, not swallowed. A missing procedure is worth knowing about — somebody
          // reading an empty tab concludes they have no responsibilities.
          setSopError('Could not load your role procedures just now. Ask Penny for them directly.');
          return;
        }
        setRoleSop(data.sop.sections || []);
        setSopRole(data.sop.role || '');
      } catch {
        if (!dead) setSopError('Could not load your role procedures just now. Ask Penny for them directly.');
      }
    })();
    return () => { dead = true; };
  }, [staffId]);

  const [sops, setSOPs] = useState<SOP[]>([]);
  const [groupedSOPs, setGroupedSOPs] = useState<Record<string, SOP[]>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [canEdit, setCanEdit] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSOP, setEditingSOP] = useState<SOP | null>(null);
  const [sopToDelete, setSOPToDelete] = useState<SOP | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  // Selected SOP for viewing - now in full screen modal
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  // Flat list of all SOPs for navigation
  const [flatSOPList, setFlatSOPList] = useState<SOP[]>([]);
  const [currentSOPIndex, setCurrentSOPIndex] = useState(0);
  
  // Version history state
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedSOPForHistory, setSelectedSOPForHistory] = useState<SOP | null>(null);
  const [versionHistory, setVersionHistory] = useState<SOPVersion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Diff viewer state
  const [diffViewerOpen, setDiffViewerOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<SOPVersion | null>(null);
  
  // Accessibility: Live region for announcements
  const [announcement, setAnnouncement] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    content_html: '',
    role_id: 'Success_Team',
    sort_order: 0,
    change_summary: ''
  });

  // Announce changes to screen readers
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    setTimeout(() => setAnnouncement(''), 1000);
  }, []);

  useEffect(() => {
    fetchSOPs();
    fetchCategories();
  }, [userRole, searchQuery, selectedCategory]);

  // Build flat list when grouped SOPs change
  useEffect(() => {
    const filteredGrouped = getFilteredGroupedSOPs();
    const flat: SOP[] = [];
    Object.values(filteredGrouped).forEach(categorySOPs => {
      flat.push(...categorySOPs);
    });
    setFlatSOPList(flat);
  }, [groupedSOPs, activeTab]);

  const fetchSOPs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-sop-repository', {
        body: {
          action: 'get_sops',
          user_role: userRole,
          category: selectedCategory,
          search_query: searchQuery
        }
      });

      if (error) throw error;

      setSOPs(data.sops || []);
      setGroupedSOPs(data.grouped || {});
      setCanEdit(data.can_edit || false);
      
      // Expand all categories by default
      if (data.grouped) {
        setExpandedCategories(Object.keys(data.grouped));
      }
      
      const sopCount = data.sops?.length || 0;
      announce(`Loaded ${sopCount} standard operating procedure${sopCount !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast({ title: 'Error loading SOPs', description: err.message, variant: 'destructive' });
      announce('Error loading standard operating procedures');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-sop-repository', {
        body: { action: 'get_categories', user_role: userRole }
      });
      if (error) throw error;
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchVersionHistory = async (sop: SOP) => {
    setLoadingHistory(true);
    setSelectedSOPForHistory(sop);
    setVersionHistoryOpen(true);
    announce(`Loading version history for ${sop.title}`);
    try {
      const { data, error } = await supabase.functions.invoke('manage-sop-repository', {
        body: { action: 'get_sop_version_history', sop_id: sop.id }
      });
      if (error) throw error;
      setVersionHistory(data.versions || []);
      announce(`Loaded ${data.versions?.length || 0} versions`);
    } catch (err: any) {
      toast({ title: 'Error loading history', description: err.message, variant: 'destructive' });
      announce('Error loading version history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSeedSOPs = async () => {
    setSeeding(true);
    announce('Loading default standard operating procedures');
    try {
      const { data: businessData, error: businessError } = await supabase.functions.invoke('manage-sop-repository', {
        body: { action: 'seed_all_sops' }
      });
      if (businessError) throw businessError;

      const { data: platformData, error: platformError } = await supabase.functions.invoke('manage-sop-repository', {
        body: { action: 'seed_platform_sops' }
      });
      if (platformError) throw platformError;

      toast({ title: 'SOPs Seeded Successfully', description: `${businessData?.message || ''} ${platformData?.message || ''}` });
      announce('Standard operating procedures loaded successfully');
      fetchSOPs();
      fetchCategories();
    } catch (err: any) {
      toast({ title: 'Error seeding SOPs', description: err.message, variant: 'destructive' });
      announce('Error loading standard operating procedures');
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateSOP = () => {
    setEditingSOP(null);
    setFormData({ title: '', category: categories[0] || 'Onboarding', content_html: '', role_id: 'Success_Team', sort_order: 0, change_summary: '' });
    setEditDialogOpen(true);
    announce('Create new SOP dialog opened');
  };

  const handleEditSOP = (sop: SOP) => {
    setEditingSOP(sop);
    setFormData({ title: sop.title, category: sop.category, content_html: sop.content_html, role_id: sop.role_id, sort_order: sop.sort_order, change_summary: '' });
    setEditDialogOpen(true);
    announce(`Edit SOP dialog opened for ${sop.title}`);
  };

  const handleDeleteClick = (sop: SOP) => {
    setSOPToDelete(sop);
    setDeleteDialogOpen(true);
    announce(`Delete confirmation dialog opened for ${sop.title}`);
  };

  const handleSaveSOP = async () => {
    if (!formData.title || !formData.content_html) {
      toast({ title: 'Validation Error', description: 'Title and content are required', variant: 'destructive' });
      announce('Validation error: Title and content are required');
      return;
    }

    setSaving(true);
    announce(editingSOP ? 'Saving changes' : 'Creating new SOP');
    try {
      const action = editingSOP ? 'update_sop' : 'create_sop';
      const body: any = { action, user_role: userRole, updated_by: userName, ...formData };
      if (editingSOP) body.sop_id = editingSOP.id;

      const { error } = await supabase.functions.invoke('manage-sop-repository', { body });
      if (error) throw error;

      toast({ title: editingSOP ? 'SOP Updated' : 'SOP Created', description: `"${formData.title}" has been ${editingSOP ? 'updated' : 'created'} successfully.` });
      announce(`${formData.title} ${editingSOP ? 'updated' : 'created'} successfully`);
      setEditDialogOpen(false);
      fetchSOPs();
    } catch (err: any) {
      toast({ title: 'Error saving SOP', description: err.message, variant: 'destructive' });
      announce('Error saving SOP');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!sopToDelete) return;
    setSaving(true);
    announce(`Deleting ${sopToDelete.title}`);
    try {
      const { error } = await supabase.functions.invoke('manage-sop-repository', {
        body: { action: 'delete_sop', user_role: userRole, sop_id: sopToDelete.id }
      });
      if (error) throw error;
      toast({ title: 'SOP Deleted', description: `"${sopToDelete.title}" has been removed.` });
      announce(`${sopToDelete.title} deleted successfully`);
      setDeleteDialogOpen(false);
      setSOPToDelete(null);
      if (selectedSOP?.id === sopToDelete.id) {
        setSelectedSOP(null);
        setFullScreenOpen(false);
      }
      fetchSOPs();
    } catch (err: any) {
      toast({ title: 'Error deleting SOP', description: err.message, variant: 'destructive' });
      announce('Error deleting SOP');
    } finally {
      setSaving(false);
    }
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
    announce(`${category} category ${expandedCategories.includes(category) ? 'collapsed' : 'expanded'}`);
  };

  // Select an SOP to view in full screen
  const handleSelectSOP = (sop: SOP) => {
    setSelectedSOP(sop);
    const index = flatSOPList.findIndex(s => s.id === sop.id);
    setCurrentSOPIndex(index >= 0 ? index : 0);
    setFullScreenOpen(true);
    announce(`Viewing ${sop.title}`);
  };

  // Navigate to previous SOP
  const handlePreviousSOP = () => {
    if (currentSOPIndex > 0) {
      const newIndex = currentSOPIndex - 1;
      setCurrentSOPIndex(newIndex);
      setSelectedSOP(flatSOPList[newIndex]);
      announce(`Navigated to ${flatSOPList[newIndex].title}`);
    }
  };

  // Navigate to next SOP
  const handleNextSOP = () => {
    if (currentSOPIndex < flatSOPList.length - 1) {
      const newIndex = currentSOPIndex + 1;
      setCurrentSOPIndex(newIndex);
      setSelectedSOP(flatSOPList[newIndex]);
      announce(`Navigated to ${flatSOPList[newIndex].title}`);
    }
  };

  // Close full screen view
  const handleCloseFullScreen = () => {
    setFullScreenOpen(false);
    announce('Closed SOP view');
  };

  // Keyboard navigation for full screen view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fullScreenOpen) return;
      
      if (e.key === 'Escape') {
        handleCloseFullScreen();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePreviousSOP();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextSOP();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fullScreenOpen, currentSOPIndex, flatSOPList]);

  const getFilteredGroupedSOPs = () => {
    if (activeTab === 'all') return groupedSOPs;
    const filtered: Record<string, SOP[]> = {};
    Object.entries(groupedSOPs).forEach(([category, categorySOPs]) => {
      const filteredSOPs = categorySOPs.filter(sop => {
        if (activeTab === 'success') return sop.role_id === 'Success_Team';
        if (activeTab === 'acquisition') return sop.role_id === 'Acquisition_Manager';
        if (activeTab === 'setup') return sop.role_id === 'Setup_Manager';
        if (activeTab === 'cross') return sop.role_id === 'Cross_Team';
        return true;
      });
      if (filteredSOPs.length > 0) filtered[category] = filteredSOPs;
    });
    return filtered;
  };

  const filteredGroupedSOPs = getFilteredGroupedSOPs();

  // Handle tab change with announcement
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSelectedSOP(null);
    setFullScreenOpen(false);
    const tabLabels: Record<string, string> = {
      'all': 'All SOPs',
      'success': 'Success Team',
      'acquisition': 'Acquisition Manager',
      'setup': 'Setup Manager',
      'cross': 'Cross-Team'
    };
    announce(`Showing ${tabLabels[value]} procedures`);
  };

  if (loading && sops.length === 0) {
    return (
      <div 
        className="flex items-center justify-center py-12"
        role="status"
        aria-live="polite"
        aria-label="Loading standard operating procedures"
      >
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" aria-hidden="true" />
        <span className="ml-3 text-gray-600">Loading SOPs & Workflows...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="Standard Operating Procedures">
      {/* YOUR ROLE'S PROCEDURE, FIRST.
          These are written from how the platform actually works and each step names the
          tool that does it. They sit above everything else because the question this tab
          exists to answer is "what am I responsible for", and that should not require
          scrolling past a workflow builder. Owners see every role's. */}
      {roleSop.length > 0 && (
        <section aria-labelledby="role-sop-heading" className="rounded-lg border border-slate-300 bg-white">
          <h2 id="role-sop-heading" className="border-b border-slate-200 px-4 py-3 text-base font-bold text-slate-900">
            {sopRole === 'owner' ? 'Every role\u2019s responsibilities' : 'What you are responsible for'}
          </h2>
          <div className="divide-y divide-slate-100">
            {roleSop.map((sec, i) => (
              <article key={i} className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {sec.role} \u00b7 {sec.section}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">{sec.title}</h3>
                {/* whitespace-pre-line keeps the numbered steps as written rather than
                    collapsing them into a wall a screen reader reads as one sentence */}
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {sec.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
      {sopError && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate-800">
          {sopError}
        </p>
      )}
      {/* Screen reader announcements */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announcement}
      </div>

      {/* Pending Reviews Widget */}
      {staffId && (
        <SOPPendingReviewsWidget
          staffId={staffId}
          staffName={userName || 'Staff'}
          staffRole={userRole}
        />
      )}

      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-amber-50 to-amber-100">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg"
                aria-hidden="true"
              >
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-[#1a365d]">
                  Standard Operating Procedures
                </CardTitle>
                <CardDescription className="text-amber-700">
                  Official procedures for {userRole.replace('_', ' ')}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2" role="group" aria-label="SOP actions">
              {canEdit && sops.length === 0 && (
                <Button 
                  onClick={handleSeedSOPs} 
                  disabled={seeding} 
                  variant="outline" 
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  {seeding ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                  )}
                  Load Default SOPs
                </Button>
              )}
              {canEdit && (
                <Button 
                  onClick={handleCreateSOP} 
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                  aria-label="Add new standard operating procedure"
                >
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  Add SOP
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Role Filter Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList 
          className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid"
          aria-label="Filter SOPs by team"
        >
          <TabsTrigger value="all" className="gap-2">
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">All SOPs</span>
            <span className="sm:hidden">All</span>
          </TabsTrigger>
          <TabsTrigger value="success" className="gap-2">
            <Users className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Success Team</span>
            <span className="sm:hidden">Success</span>
          </TabsTrigger>
          <TabsTrigger value="acquisition" className="gap-2">
            <Briefcase className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Acquisition</span>
            <span className="sm:hidden">Acq</span>
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-2">
            <Home className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Setup</span>
            <span className="sm:hidden">Setup</span>
          </TabsTrigger>
          <TabsTrigger value="cross" className="gap-2">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Cross-Team</span>
            <span className="sm:hidden">Cross</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="sop-search" className="sr-only">Search SOPs</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <Input 
                  id="sop-search"
                  ref={searchInputRef}
                  placeholder="Search SOPs by title or content..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="pl-10"
                  aria-describedby="search-hint"
                />
              </div>
              <p id="search-hint" className="sr-only">
                Type to search through all standard operating procedures
              </p>
            </div>
            <div>
              <Label htmlFor="category-filter" className="sr-only">Filter by category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category-filter" className="w-full md:w-[220px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {!canEdit && (
            <div 
              className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg"
              role="note"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>You have read-only access. Contact Admin or Success Team to request changes.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SOP Grid - Click to open full screen */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" aria-hidden="true" />
            Browse Procedures
            <Badge variant="outline" className="ml-2">{flatSOPList.length} total</Badge>
          </CardTitle>
          <CardDescription>
            Click on any procedure to view it in full screen. Use arrow keys to navigate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(filteredGroupedSOPs).length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
              <p className="text-gray-500 mb-4">
                {searchQuery ? 'No SOPs match your search criteria.' : 'No SOPs found.'}
              </p>
              {canEdit && sops.length === 0 && (
                <Button 
                  onClick={handleSeedSOPs} 
                  disabled={seeding} 
                  className="bg-gradient-to-r from-amber-500 to-amber-600"
                >
                  {seeding ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                  )}
                  Load Default SOPs
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(filteredGroupedSOPs).map(([category, categorySOPs]) => (
                <div key={category} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full px-4 py-3 flex items-center gap-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    aria-expanded={expandedCategories.includes(category)}
                    aria-label={`${category} category, ${categorySOPs.length} procedures`}
                  >
                    <div 
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${categoryColors[category] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white flex-shrink-0`}
                      aria-hidden="true"
                    >
                      {categoryIcons[category] || <FileText className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1a365d]">{category}</p>
                      <p className="text-sm text-gray-500">{categorySOPs.length} procedure{categorySOPs.length !== 1 ? 's' : ''}</p>
                    </div>
                    {expandedCategories.includes(category) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                    )}
                  </button>
                  
                  {expandedCategories.includes(category) && (
                    <div className="divide-y">
                      {categorySOPs.map((sop, index) => (
                        <button
                          key={sop.id}
                          onClick={() => handleSelectSOP(sop)}
                          className="w-full px-4 py-3 text-left hover:bg-amber-50 transition-colors flex items-center gap-3"
                          aria-label={`${sop.title}, ${roleLabels[sop.role_id]?.label || sop.role_id}`}
                        >
                          <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-sm flex items-center justify-center flex-shrink-0 font-medium" aria-hidden="true">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{sop.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`text-xs ${roleLabels[sop.role_id]?.color || 'bg-gray-100'}`}>
                                {roleLabels[sop.role_id]?.label || sop.role_id}
                              </Badge>
                              {sop.version && sop.version > 1 && (
                                <Badge variant="outline" className="text-xs">v{sop.version}</Badge>
                              )}
                            </div>
                          </div>
                          <Maximize2 className="w-4 h-4 text-gray-400" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Screen SOP Viewer Modal */}
      <Dialog open={fullScreenOpen} onOpenChange={setFullScreenOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          {selectedSOP && (
            <>
              {/* Header with navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-amber-100">
                <div className="flex items-center gap-4">
                  <div 
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${categoryColors[selectedSOP.category] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white`}
                    aria-hidden="true"
                  >
                    {categoryIcons[selectedSOP.category] || <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#1a365d]">{selectedSOP.title}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={roleLabels[selectedSOP.role_id]?.color || 'bg-gray-100'}>
                        {roleLabels[selectedSOP.role_id]?.label || selectedSOP.role_id}
                      </Badge>
                      <Badge variant="outline">{selectedSOP.category}</Badge>
                      {selectedSOP.version && selectedSOP.version > 1 && (
                        <Badge variant="outline">v{selectedSOP.version}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => fetchVersionHistory(selectedSOP)}
                    aria-label="View version history"
                  >
                    <History className="w-4 h-4 mr-1" aria-hidden="true" />
                    History
                  </Button>
                  {canEdit && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setFullScreenOpen(false);
                          handleEditSOP(selectedSOP);
                        }}
                        aria-label="Edit this SOP"
                      >
                        <Edit2 className="w-4 h-4 mr-1" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setFullScreenOpen(false);
                          handleDeleteClick(selectedSOP);
                        }}
                        className="text-red-600 hover:text-red-700"
                        aria-label="Delete this SOP"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleCloseFullScreen}
                    aria-label="Close SOP view"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Navigation bar */}
              <div className="flex items-center justify-between px-6 py-3 border-b bg-gray-50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousSOP}
                  disabled={currentSOPIndex === 0}
                  className="gap-2"
                  aria-label="Previous procedure"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Previous
                </Button>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{currentSOPIndex + 1}</span> of <span className="font-medium">{flatSOPList.length}</span> procedures
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextSOP}
                  disabled={currentSOPIndex === flatSOPList.length - 1}
                  className="gap-2"
                  aria-label="Next procedure"
                >
                  Next
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 p-6">
                <div className="max-w-3xl mx-auto">
                  {selectedSOP.change_summary && (
                    <div 
                      className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800"
                      role="note"
                    >
                      <strong>Latest change:</strong> {selectedSOP.change_summary}
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    Last updated {new Date(selectedSOP.last_updated).toLocaleDateString()}
                    {selectedSOP.updated_by && ` by ${selectedSOP.updated_by}`}
                  </div>
                  
                  <article 
                    className="sop-content prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedSOP.content_html }}
                    aria-label={`Content for ${selectedSOP.title}`}
                  />
                </div>
              </ScrollArea>

              {/* Footer navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Use</span>
                  <kbd className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">←</kbd>
                  <kbd className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">→</kbd>
                  <span>to navigate, </span>
                  <kbd className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">Esc</kbd>
                  <span>to close</span>
                </div>
                <div className="flex gap-2">
                  {currentSOPIndex > 0 && (
                    <Button variant="ghost" size="sm" onClick={handlePreviousSOP}>
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      {flatSOPList[currentSOPIndex - 1]?.title.substring(0, 30)}...
                    </Button>
                  )}
                  {currentSOPIndex < flatSOPList.length - 1 && (
                    <Button variant="ghost" size="sm" onClick={handleNextSOP}>
                      {flatSOPList[currentSOPIndex + 1]?.title.substring(0, 30)}...
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSOP ? 'Edit SOP' : 'Create New SOP'}</DialogTitle>
            <DialogDescription>
              {editingSOP 
                ? 'Update the standard operating procedure. A change summary is required.' 
                : 'Add a new SOP to the repository. Fill in all required fields.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveSOP(); }} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sop-title">Title <span className="text-red-500">*</span></Label>
                <Input 
                  id="sop-title"
                  value={formData.title} 
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                  placeholder="e.g., Step 1: Welcome Email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="sop-category">Category <span className="text-red-500">*</span></Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger id="sop-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Onboarding', 'Compliance', 'Data Research', 'Marketplace Maintenance', 'Dispute Resolution', 'Consultative Framework', 'Property Research', 'Landlord Outreach', 'Deal Negotiation', 'Success Team Handoff', 'Property Preparation', 'Furniture Procurement', 'Quality Inspection', 'Vendor Management', 'Cross-Team Handoffs', 'Communication Standards'].map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sop-role">Role Access <span className="text-red-500">*</span></Label>
                <Select value={formData.role_id} onValueChange={(v) => setFormData({ ...formData, role_id: v })}>
                  <SelectTrigger id="sop-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Success_Team">Success Team</SelectItem>
                    <SelectItem value="Acquisition_Manager">Acquisition Manager</SelectItem>
                    <SelectItem value="Setup_Manager">Setup Manager</SelectItem>
                    <SelectItem value="Cross_Team">All Teams (Cross-Team)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sop-sort">Sort Order</Label>
                <Input 
                  id="sop-sort"
                  type="number" 
                  value={formData.sort_order} 
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
              </div>
            </div>
            {editingSOP && (
              <div>
                <Label htmlFor="sop-change-summary">
                  Change Summary <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="sop-change-summary"
                  value={formData.change_summary} 
                  onChange={(e) => setFormData({ ...formData, change_summary: e.target.value })} 
                  placeholder="Briefly describe what changed..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Staff will see this summary when reviewing the update.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="sop-content">Content (HTML) <span className="text-red-500">*</span></Label>
              <Textarea 
                id="sop-content"
                value={formData.content_html} 
                onChange={(e) => setFormData({ ...formData, content_html: e.target.value })} 
                placeholder="<h4>Title</h4><p>Content...</p>" 
                className="min-h-[250px] font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Use HTML tags for formatting: h4, h5, p, ul, ol, li, strong, em
              </p>
            </div>
            {formData.content_html && (
              <div>
                <Label>Preview</Label>
                <div 
                  className="border rounded-lg p-4 bg-gray-50 mt-2 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: formData.content_html }}
                />
              </div>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSOP} 
              disabled={saving || (editingSOP && !formData.change_summary)} 
              className="bg-gradient-to-r from-amber-500 to-amber-600"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              {editingSOP ? 'Update SOP' : 'Create SOP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SOP</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{sopToDelete?.title}"? This action cannot be undone and will remove all version history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              disabled={saving} 
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Version History Dialog */}
      <Dialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-600" aria-hidden="true" />
              Version History
            </DialogTitle>
            <DialogDescription>
              {selectedSOPForHistory?.title}
            </DialogDescription>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8" role="status">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" aria-hidden="true" />
              <span className="ml-2">Loading version history...</span>
            </div>
          ) : versionHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
              <p>No version history available</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <ul className="space-y-3" role="list" aria-label="Version history">
                {versionHistory.map((version, idx) => (
                  <li 
                    key={version.id} 
                    className={`border rounded-lg p-4 ${idx === 0 ? 'border-amber-300 bg-amber-50' : 'bg-white'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={idx === 0 ? 'default' : 'outline'}>v{version.version_number}</Badge>
                          {idx === 0 && <Badge className="bg-green-100 text-green-800">Current</Badge>}
                        </div>
                        <p className="text-sm font-medium mt-2">{version.change_summary || 'No summary provided'}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" aria-hidden="true" />
                            {version.changed_by || 'Unknown'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            <time dateTime={version.created_at}>
                              {new Date(version.created_at).toLocaleString()}
                            </time>
                          </span>
                        </div>
                      </div>
                      {version.previous_content_html && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setSelectedVersion(version); setDiffViewerOpen(true); }}
                          aria-label={`View changes in version ${version.version_number}`}
                        >
                          <Eye className="w-4 h-4 mr-1" aria-hidden="true" />
                          View Diff
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Diff Viewer */}
      <SOPDiffViewer 
        open={diffViewerOpen} 
        onOpenChange={setDiffViewerOpen} 
        version={selectedVersion} 
        sopTitle={selectedSOPForHistory?.title || ''} 
      />

      {/* Styles for SOP content */}
      <style>{`
        .sop-content h4 { font-size: 1.25rem; font-weight: 600; color: #1a365d; margin-bottom: 1rem; margin-top: 1.5rem; }
        .sop-content h5 { font-size: 1.1rem; font-weight: 600; color: #374151; margin-top: 1.25rem; margin-bottom: 0.75rem; }
        .sop-content p { color: #4b5563; margin-bottom: 1rem; line-height: 1.7; }
        .sop-content ul, .sop-content ol { margin-left: 1.5rem; margin-bottom: 1rem; }
        .sop-content li { color: #4b5563; margin-bottom: 0.5rem; line-height: 1.6; }
        .sop-content .alert-info { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem 1.25rem; border-radius: 0.375rem; color: #1e40af; margin: 1rem 0; }
        .sop-content .alert-warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 1rem 1.25rem; border-radius: 0.375rem; color: #92400e; margin: 1rem 0; }
        .sop-content .alert-critical { background: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem 1.25rem; border-radius: 0.375rem; color: #991b1b; margin: 1rem 0; }
        .sop-content strong { font-weight: 600; color: #1f2937; }
        .sop-content em { font-style: italic; }
        .sop-content a { color: #2563eb; text-decoration: underline; }
        .sop-content a:hover { color: #1d4ed8; }
        .sop-content a:focus { outline: 2px solid #2563eb; outline-offset: 2px; }
      `}</style>
    </div>
  );
}
