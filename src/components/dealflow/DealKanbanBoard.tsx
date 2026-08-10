import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Building, MapPin, DollarSign, Clock, ChevronRight, 
  Search, Phone, Handshake, CheckCircle, Globe, 
  GripVertical, Eye, History, AlertCircle, Loader2,
  UserPlus, X, User, ExternalLink
} from 'lucide-react';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  listing_title?: string;
  workflow_stage?: string;
  workflow_stage_entered_at?: string;
  photos?: string[];
  created_at: string;
  assigned_investor_id?: string;
  assigned_to?: string;
}

interface Investor {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company_name?: string;
  phone?: string;
  status?: string;
}

interface DealKanbanBoardProps {
  properties: Property[];
  onRefresh: () => void;
  onViewDetails: (property: Property) => void;
  staffId?: string;
  staffName?: string;
  canAssign?: boolean;
  onOpenFullAssignModal?: (property: Property) => void;
}

const WORKFLOW_STAGES = [
  { 
    id: 'new', 
    label: 'New', 
    icon: Building, 
    color: 'bg-gray-100 border-gray-300',
    headerColor: 'bg-gray-500',
    description: 'Newly added deals awaiting research'
  },
  { 
    id: 'researching', 
    label: 'Researching', 
    icon: Search, 
    color: 'bg-blue-50 border-blue-300',
    headerColor: 'bg-blue-500',
    description: 'Analyzing market data and property details'
  },
  { 
    id: 'landlord_contact', 
    label: 'Landlord Contact', 
    icon: Phone, 
    color: 'bg-purple-50 border-purple-300',
    headerColor: 'bg-purple-500',
    description: 'Reaching out to property owner'
  },
  { 
    id: 'negotiating', 
    label: 'Negotiating', 
    icon: Handshake, 
    color: 'bg-amber-50 border-amber-300',
    headerColor: 'bg-amber-500',
    description: 'Terms being negotiated'
  },
  { 
    id: 'approved', 
    label: 'Approved', 
    icon: CheckCircle, 
    color: 'bg-green-50 border-green-300',
    headerColor: 'bg-green-500',
    description: 'Deal approved, ready for publishing'
  },
  { 
    id: 'published', 
    label: 'Published', 
    icon: Globe, 
    color: 'bg-emerald-50 border-emerald-300',
    headerColor: 'bg-emerald-600',
    description: 'Live on the platform'
  }
];

// ── Inline Quick-Assign Popover (rendered via portal to avoid clipping) ──
function KanbanQuickAssign({ 
  property, 
  onClose, 
  onAssigned, 
  onOpenFullModal,
  staffId, 
  staffName,
  anchorRect
}: { 
  property: Property; 
  onClose: () => void; 
  onAssigned: () => void;
  onOpenFullModal?: () => void;
  staffId?: string; 
  staffName?: string;
  anchorRect: DOMRect | null;
}) {
  const [query, setQuery] = useState('');
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selected, setSelected] = useState<Investor | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load investors
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('investors')
          .select('id, email, full_name, first_name, last_name, company_name, phone, status')
          .order('full_name', { ascending: true })
          .limit(50);
        setInvestors(data || []);
      } catch { setInvestors([]); }
      setLoading(false);
    })();
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  // Click outside / Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 80);
    document.addEventListener('keydown', handleKey);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [onClose]);

  const filtered = investors.filter(inv => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (inv.full_name?.toLowerCase().includes(q) || inv.email?.toLowerCase().includes(q) || inv.company_name?.toLowerCase().includes(q));
  });

  const handleAssign = async () => {
    if (!selected) return;
    setAssigning(true);
    try {
      // Try edge function
      try {
        await supabase.functions.invoke('manage-property-assignments', {
          body: { action: 'assign', staff_id: staffId, property_id: property.id, investor_id: selected.id, assigned_by: staffId, notes: `Quick-assigned from kanban by ${staffName || 'staff'}` }
        });
      } catch {
        // The direct-insert fallback is gone. Anon INSERT on investor_portfolio was
        // revoked, so it could no longer work — and it swallowed its own errors, so a
        // failed assignment looked identical to a successful one.
        console.error('[DealKanbanBoard] assignment failed:', property.id, selected.id);
        throw new Error('Could not assign that deal. Nothing was saved.');
      }
      // Update property record
      await supabase.from('properties').update({ assigned_investor_id: selected.id, assigned_to: selected.full_name || selected.email }).eq('id', property.id);
      toast({ title: 'Assigned!', description: `${property.address} assigned to ${selected.full_name || selected.email}` });
      onAssigned();
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Assignment failed', variant: 'destructive' });
    }
    setAssigning(false);
  };

  // Position: use fixed positioning based on anchor rect
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    width: 320,
  };
  if (anchorRect) {
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    if (spaceBelow > 360) {
      style.top = anchorRect.bottom + 4;
    } else {
      style.bottom = window.innerHeight - anchorRect.top + 4;
    }
    // Horizontal: try to align left with button, but keep on screen
    style.left = Math.min(anchorRect.left, window.innerWidth - 330);
  }

  return (
    <div ref={popRef} style={style} className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 flex items-center justify-between">
        <span className="text-white text-xs font-semibold flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5" /> Quick Assign
        </span>
        <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-3.5 h-3.5" /></button>
      </div>

      {/* Property info */}
      <div className="px-3 py-2 bg-gray-50 border-b text-xs">
        <p className="font-medium text-gray-800 truncate">{property.address}</p>
        <p className="text-gray-500">{property.city}, {property.state}</p>
      </div>

      {!selected ? (
        <>
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <Input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search investors..." className="h-8 pl-7 text-xs" />
              {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
            </div>
          </div>
          {/* List */}
          <div className="max-h-48 overflow-y-auto divide-y">
            {loading ? (
              <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-500">No investors found</div>
            ) : filtered.map(inv => (
              <button key={inv.id} onClick={() => setSelected(inv)} className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">{inv.full_name || 'Unnamed'}</p>
                  <p className="text-[10px] text-gray-500 truncate">{inv.email}</p>
                </div>
              </button>
            ))}
          </div>
          {/* Footer */}
          {onOpenFullModal && (
            <div className="p-2 border-t bg-gray-50">
              <button onClick={() => { onClose(); onOpenFullModal(); }} className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Open full assignment modal
              </button>
            </div>
          )}
        </>
      ) : (
        /* Confirm step */
        <div className="p-3 space-y-3">
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-xs font-medium text-blue-800">Assign to:</p>
            <p className="text-sm font-semibold text-blue-900">{selected.full_name || selected.email}</p>
            {selected.company_name && <p className="text-[10px] text-blue-600">{selected.company_name}</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(null)} className="flex-1 h-7 text-xs">Back</Button>
            <Button size="sm" onClick={handleAssign} disabled={assigning} className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700">
              {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Kanban Board ──
export function DealKanbanBoard({ properties, onRefresh, onViewDetails, staffId, staffName, canAssign = false, onOpenFullAssignModal }: DealKanbanBoardProps) {
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [targetStage, setTargetStage] = useState('');
  const [moveNotes, setMoveNotes] = useState('');
  const [moving, setMoving] = useState(false);
  const [stageHistory, setStageHistory] = useState<any[]>([]);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  // Quick assign state
  const [quickAssignProperty, setQuickAssignProperty] = useState<Property | null>(null);
  const [quickAssignRect, setQuickAssignRect] = useState<DOMRect | null>(null);
  const { toast } = useToast();

  const getStageProperties = (stageId: string) => {
    return properties.filter(p => (p.workflow_stage || 'new') === stageId);
  };

  const handleMoveClick = (property: Property, stage: string) => {
    setSelectedProperty(property);
    setTargetStage(stage);
    setMoveNotes('');
    setMoveDialogOpen(true);
  };

  const handleMove = async () => {
    if (!selectedProperty || !targetStage) return;
    setMoving(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({ 
          workflow_stage: targetStage,
          workflow_stage_entered_at: new Date().toISOString()
        })
        .eq('id', selectedProperty.id);

      if (error) throw error;

      // Log the stage change
      try {
        await supabase.from('property_stage_history').insert({
          property_id: selectedProperty.id,
          from_stage: selectedProperty.workflow_stage || 'new',
          to_stage: targetStage,
          notes: moveNotes || null,
          changed_at: new Date().toISOString()
        });
      } catch (histErr) {
        console.warn('Stage history logging failed:', histErr);
      }

      toast({ title: 'Stage Updated', description: `Moved to ${WORKFLOW_STAGES.find(s => s.id === targetStage)?.label}` });
      setMoveDialogOpen(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setMoving(false);
  };

  const viewHistory = async (property: Property) => {
    setSelectedProperty(property);
    try {
      const { data } = await supabase
        .from('property_stage_history')
        .select('*')
        .eq('property_id', property.id)
        .order('changed_at', { ascending: false });
      setStageHistory(data || []);
    } catch { setStageHistory([]); }
    setHistoryDialogOpen(true);
  };

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };

  const getDaysInStage = (property: Property) => {
    if (!property.workflow_stage_entered_at) return null;
    const days = Math.floor((Date.now() - new Date(property.workflow_stage_entered_at).getTime()) / 86400000);
    return days;
  };

  const handleQuickAssignClick = (property: Property, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setQuickAssignProperty(property);
    setQuickAssignRect(rect);
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {WORKFLOW_STAGES.map(stage => {
          const stageProps = getStageProperties(stage.id);
          const StageIcon = stage.icon;
          
          return (
            <div key={stage.id} className={`w-72 rounded-lg border-2 ${stage.color} flex flex-col max-h-[calc(100vh-220px)]`}>
              {/* Column Header */}
              <div className={`${stage.headerColor} text-white px-3 py-2 rounded-t-md`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StageIcon className="w-4 h-4" />
                    <span className="font-semibold text-sm">{stage.label}</span>
                  </div>
                  <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                    {stageProps.length}
                  </Badge>
                </div>
                <p className="text-xs text-white/70 mt-0.5">{stage.description}</p>
              </div>

              {/* Cards Container - scrollable */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {stageProps.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No deals in this stage</p>
                  </div>
                ) : (
                  stageProps.map(property => {
                    const days = getDaysInStage(property);
                    const isAssigned = !!(property.assigned_investor_id || property.assigned_to);
                    const currentStageIndex = WORKFLOW_STAGES.findIndex(s => s.id === stage.id);
                    
                    return (
                      <Card key={property.id} className="cursor-pointer hover:shadow-md transition-shadow group relative">
                        <CardContent className="p-3">
                          {/* Quick Assign Button - top right */}
                          {canAssign && (
                            <button
                              onClick={(e) => handleQuickAssignClick(property, e)}
                              className={`absolute top-2 right-2 z-10 p-1 rounded-md transition-all ${
                                isAssigned 
                                  ? 'bg-green-100 text-green-600' 
                                  : 'bg-blue-50 text-blue-400 opacity-0 group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-600'
                              }`}
                              title={isAssigned ? `Assigned to ${property.assigned_to || 'investor'}` : 'Quick assign to investor'}
                            >
                              {isAssigned ? <CheckCircle className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Property Info */}
                          <div className="pr-7" onClick={() => onViewDetails(property)}>
                            <p className="font-medium text-sm text-gray-900 line-clamp-1">
                              {property.listing_title || property.address}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{property.city}, {property.state}</span>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2">
                              {property.monthly_rent ? (
                                <span className="text-sm font-semibold text-green-600 flex items-center gap-0.5">
                                  <DollarSign className="w-3 h-3" />
                                  {property.monthly_rent.toLocaleString()}/mo
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">No rent listed</span>
                              )}
                              
                              {days !== null && (
                                <span className={`text-xs flex items-center gap-0.5 ${days > 14 ? 'text-red-500' : days > 7 ? 'text-amber-500' : 'text-gray-400'}`}>
                                  <Clock className="w-3 h-3" />
                                  {days}d
                                </span>
                              )}
                            </div>

                            {/* Assigned badge */}
                            {isAssigned && (
                              <div className="mt-1.5">
                                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                  <User className="w-2.5 h-2.5 mr-0.5" />
                                  {property.assigned_to || 'Assigned'}
                                </Badge>
                              </div>
                            )}

                            {property.bedrooms && (
                              <div className="flex gap-2 mt-1.5 text-xs text-gray-500">
                                <span>{property.bedrooms} bed</span>
                                {property.bathrooms && <span>{property.bathrooms} bath</span>}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-1 mt-2 pt-2 border-t">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 text-xs flex-1 px-1"
                              onClick={() => onViewDetails(property)}
                            >
                              <Eye className="w-3 h-3 mr-1" /> View
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 text-xs px-1"
                              onClick={() => viewHistory(property)}
                            >
                              <History className="w-3 h-3" />
                            </Button>
                            {currentStageIndex < WORKFLOW_STAGES.length - 1 && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 text-xs flex-1 px-1 text-blue-600 hover:text-blue-700"
                                onClick={() => handleMoveClick(property, WORKFLOW_STAGES[currentStageIndex + 1].id)}
                              >
                                <ChevronRight className="w-3 h-3 mr-0.5" />
                                {WORKFLOW_STAGES[currentStageIndex + 1].label}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Assign Popover - rendered as fixed-position portal */}
      {quickAssignProperty && (
        <KanbanQuickAssign
          property={quickAssignProperty}
          onClose={() => { setQuickAssignProperty(null); setQuickAssignRect(null); }}
          onAssigned={() => { setQuickAssignProperty(null); setQuickAssignRect(null); onRefresh(); }}
          onOpenFullModal={onOpenFullAssignModal ? () => onOpenFullAssignModal(quickAssignProperty) : undefined}
          staffId={staffId}
          staffName={staffName}
          anchorRect={quickAssignRect}
        />
      )}

      {/* Move Stage Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Deal</DialogTitle>
            <DialogDescription>
              Move "{selectedProperty?.address}" to {WORKFLOW_STAGES.find(s => s.id === targetStage)?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes-optional">Notes (optional)</Label>
              <Textarea id="notes-optional" value={moveNotes} onChange={e => setMoveNotes(e.target.value)} placeholder="Add notes about this stage change..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMove} disabled={moving}>
              {moving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Move to {WORKFLOW_STAGES.find(s => s.id === targetStage)?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stage History</DialogTitle>
            <DialogDescription>{selectedProperty?.address}</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {stageHistory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No stage history recorded</p>
            ) : stageHistory.map((h, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded bg-gray-50">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{WORKFLOW_STAGES.find(s => s.id === h.from_stage)?.label || h.from_stage}</span>
                    {' → '}
                    <span className="font-medium">{WORKFLOW_STAGES.find(s => s.id === h.to_stage)?.label || h.to_stage}</span>
                  </p>
                  {h.notes && <p className="text-xs text-gray-500 mt-0.5">{h.notes}</p>}
                  <p className="text-xs text-gray-400">{formatDate(h.changed_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
